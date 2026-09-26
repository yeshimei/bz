// ================================================================
// bz-face doctor —— 判定层（纯函数，零依赖，注入探测结果即可测）
//
// 职责切分（issue 463）：
//   lib/probes.js     真探测（child_process / fs）——每个探测独立兜错，绝不抛栈
//   lib/doctor-core.js 本文件——探测结果 → 检查行（通过/缺失/留意/未配置 + 修复命令）
//   bin/bz-face.js    CLI 薄壳——采集真探测结果 → 调本文件 → 打印
//
// 输出格式决策：doctor 打「人话纯文本」，不走 [bz-*] 四行协议。
// 理由：四行协议（src/core/external-tool.ts）是给插件编排长任务消费进度/结果用的；
// doctor 是用户自己在终端跑的一次性自检，产出是多行判定 + 可直接粘贴的修复命令，
// 人读优先。后续票（465 数据源同步按钮）若插件要内嵌 doctor 结果，届时加 --json
// 输出结构化行（协议行可由调用壳包一层），本票不做。
//
// 铁的约定：
//   1. 本文件任何函数不得抛异常——判定面对残缺/畸形输入一律按「缺失/留意」降级；
//   2. 绝不执行任何安装（pip install 等只出现在打印的命令文本里）；
//   3. 单项缺失不影响其余项的判定。
// ================================================================
'use strict';

// ---- 阈值与口径常量（测试直接引用）----

/** Python 最低版本：上游 wxManager 用了 PEP 604 注解（str | bytes），需 ≥3.10 */
const MIN_PYTHON_VERSION = [3, 10];

/** 微信封堵线：4.0.3.36 起内存取密钥被官方封堵，需退回 4.0.3.19（ADR-0195 / 票 460） */
const WECHAT_BLOCKED_VERSION = [4, 0, 3, 36];
const WECHAT_ROLLBACK_VERSION = '4.0.3.19';

/** 微信进程名：4.x = Weixin.exe（本工具目标）；3.x = WeChat.exe（过旧，不支持） */
const WECHAT_4X_PROCESS = 'Weixin.exe';
const WECHAT_3X_PROCESS = 'WeChat.exe';

/**
 * 解密组依赖（取密钥 → 解密 → 读库 → 导 CSV/JSON）。
 * mod = Python import 名；pip = pip 包名（两者不同时标注）。
 * 清单来源：收编脚本的 import 闭包逐一核对（详见 tools/obsidian-face/ARCHIVE.md）。
 */
const DECRYPT_DEPS = [
  { mod: 'pymem', pip: 'pymem' }, // 内存取密钥（wx_info_v4）
  { mod: 'psutil', pip: 'psutil' }, // 微信进程探测（decrypt/__init__、common）
  { mod: 'win32api', pip: 'pywin32' }, // 进程句柄 / exe 版本读取（common）
  { mod: 'Crypto', pip: 'pycryptodome' }, // AES / PBKDF2 / SHA512 数据库解密
  { mod: 'zstandard', pip: 'zstandard' }, // 4.x 消息体 zstd 解压
  { mod: 'google.protobuf', pip: 'protobuf' }, // parser 生成码（*_pb2 必须与生成版本同大版本；import 名是 google.protobuf）
  { mod: 'PIL', pip: 'pillow' }, // 头像库（db_v4/head_image）
  { mod: 'xmltodict', pip: 'xmltodict' }, // 消息 XML 解析
  { mod: 'lxml', pip: 'lxml' }, // 硬链接信息解析（db_v4/hardlink）
  { mod: 'dateparser', pip: 'dateparser' }, // 链接消息时间解析（parser/link_parser）
  { mod: 'aiofiles', pip: 'aiofiles' }, // 解密中间层异步读（decrypt/decrypt_dat）
  { mod: 'yara', pip: 'yara-python' }, // 内存密钥扫描规则（wx_info_v4）
];

/**
 * 转写组依赖（语音转写 + silk 解码；本票仅自检，468 才接线）。
 * funasr 安装时会连带装 torch/torchaudio（体积大属正常）；首次运行另下 SenseVoice 模型。
 */
const TRANSCRIBE_DEPS = [
  { mod: 'funasr', pip: 'funasr' }, // SenseVoice-Small 转写引擎
  { mod: 'pysilk', pip: 'pysilk-mod' }, // 微信 silk 语音解码
];

/** yara-python 的已知坑：Python 3.14 暂无预编译 wheel（收编日 2026-09 核实），3.12/3.13 可直装 */
const YARA_NOTE =
  'yara-python 在 Python 3.14 暂无预编译 wheel（3.12/3.13 可直接装）；' +
  '装不上时仅「取密钥」不可用，用已缓存密钥的解密链不受影响';

// ---- 工具 ----

/** 点分版本号比较：a < b 返回 -1，相等 0，大于 1；畸形段按 0 兜底，绝不抛 */
function compareDotVersions(a, b) {
  const pa = String(a || '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '').split('.').map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

/** 版本数组 [4,0,3,36] → '4.0.3.36'（展示用） */
function versionLabel(arr) {
  return (arr || []).join('.');
}

// ---- 探测结果采集（注入缝：CLI 传真探测，测试传假件/抛错函数） ----

/**
 * 逐项执行探测函数并兜错。任何探测抛异常都折成 { ok:false, error }，
 * 绝不让单项探测炸掉整轮采集——这是「单项缺失不中断其余检查」的第一道闸。
 * @param {Record<string, () => any>} probeFns 键与检查项同名：python/decryptDeps/
 *   transcribeDeps/ffmpeg/ffprobe/wechat/dataRoot；缺键的项得 { missing:true }
 * @returns {Promise<Record<string, any>>} 每项一个结果对象（形状由判定层宽容消费）
 */
async function collectDoctorProbes(probeFns) {
  const out = {};
  const fns = probeFns || {};
  for (const key of ['python', 'decryptDeps', 'transcribeDeps', 'ffmpeg', 'ffprobe', 'wechat', 'dataRoot']) {
    const fn = fns[key];
    if (typeof fn !== 'function') {
      out[key] = { missing: true };
      continue;
    }
    try {
      const r = await fn();
      out[key] = r && typeof r === 'object' ? r : { ok: false, error: '探测函数无有效返回' };
    } catch (e) {
      out[key] = { ok: false, error: (e && e.message) || String(e) };
    }
  }
  return out;
}

// ---- 判定层 ----

/**
 * 单行检查结果。state 取值：
 *   pass    通过 ✓
 *   fail    缺失/不满足 ✗（fix = 可直接粘贴的安装/修复命令或行动指引）
 *   warn    在跑但存疑 !（有提示但不判死）
 *   neutral 未配置 ·（中性项，不计失败——如数据根缺省）
 * @typedef {{ key: string, state: 'pass'|'fail'|'warn'|'neutral', text: string, fix?: string }} DoctorLine
 */

/**
 * 逐项判定。输入 collectDoctorProbes 的结果对象，输出检查行列表与汇总。
 * @param {Record<string, any>} results 探测结果（允许残缺/畸形）
 * @param {{ pkgRoot?: string }} opts pkgRoot = 包根目录（组清单兜底命令里的路径用）
 * @returns {{ lines: DoctorLine[], passCount: number, failCount: number, warnCount: number, allPass: boolean }}
 */
function runDoctorChecks(results, opts) {
  const options = opts || {};
  const pkgRoot = options.pkgRoot || '<包目录>';
  const lines = [];

  /** 依赖组判定（解密组 / 转写组共用一个形状）；依赖项可带 note（缺失时追加提示行） */
  const judgeDepGroup = (key, label, deps, reqFile) => {
    const res = results[key] || {};
    if (res.missing || res.error || !res.results) {
      lines.push({
        key,
        state: 'fail',
        text: `✗ ${label}依赖探测失败${res.error ? '（' + res.error + '）' : ''}`,
        fix: `python -m pip install -r "${pkgRoot}/python/${reqFile}"`,
      });
      return;
    }
    const missing = deps.filter((d) => {
      const r = res.results[d.mod];
      return !r || !r.ok;
    });
    if (missing.length === 0) {
      lines.push({ key, state: 'pass', text: `✓ ${label}依赖齐全（${deps.length} 项）` });
      return;
    }
    const missingPips = missing.map((d) => d.pip);
    lines.push({
      key,
      state: 'fail',
      text: `✗ ${label}依赖缺失：${missingPips.join('、')}`,
      fix: `python -m pip install ${missingPips.join(' ')}`,
    });
    for (const d of missing) {
      if (d.note) lines.push({ key: key + '-note', state: 'warn', text: '! ' + d.note });
    }
  };

  // 1. Python
  const py = results.python || {};
  if (py.missing || !py.ok || !py.version) {
    lines.push({
      key: 'python',
      state: 'fail',
      text: `✗ Python 不可用${py.error ? '（' + py.error + '）' : '（未找到或无法执行）'}`,
      fix: 'winget install -e --id Python.Python.3.12',
    });
  } else if (compareDotVersions(py.version, versionLabel(MIN_PYTHON_VERSION)) < 0) {
    lines.push({
      key: 'python',
      state: 'fail',
      text: `✗ Python ${py.version} 过旧（需 ≥ ${versionLabel(MIN_PYTHON_VERSION)}，上游库用了 3.10 语法）`,
      fix: 'winget install -e --id Python.Python.3.12',
    });
  } else {
    lines.push({ key: 'python', state: 'pass', text: `✓ Python ${py.version}` });
  }

  // 2/3. 依赖两组（各自缺失只提示各自那行安装命令；yara 带 3.14 wheel 坑的提示）
  judgeDepGroup('decryptDeps', '解密组', DECRYPT_DEPS.map((d) => (d.mod === 'yara' ? { ...d, note: YARA_NOTE } : d)), 'requirements-decrypt.txt');
  judgeDepGroup('transcribeDeps', '转写组', TRANSCRIBE_DEPS, 'requirements-transcribe.txt');

  // 4/5. ffmpeg / ffprobe（本票只查 PATH；后续票接插件「外部工具」设置路径）
  const judgePathTool = (key, name) => {
    const res = results[key] || {};
    if (res.missing || !res.ok || !res.found) {
      lines.push({
        key,
        state: 'fail',
        text: `✗ ${name} 不在 PATH`,
        fix: 'winget install -e --id Gyan.FFmpeg',
      });
      return;
    }
    lines.push({ key, state: 'pass', text: `✓ ${name}（PATH）${res.version ? ' ' + res.version : ''}` });
  };
  judgePathTool('ffmpeg', 'ffmpeg');
  judgePathTool('ffprobe', 'ffprobe');

  // 6. 微信进程 + 版本
  lines.push(judgeWechat(results.wechat || {}));

  // 7. 数据根（缺省=未配置，中性展示，不报错）
  lines.push(judgeDataRoot(results.dataRoot || {}));

  const passCount = lines.filter((l) => l.state === 'pass').length;
  const failCount = lines.filter((l) => l.state === 'fail').length;
  const warnCount = lines.filter((l) => l.state === 'warn').length;
  return { lines, passCount, failCount, warnCount, allPass: failCount === 0 };
}

/** 微信检查行判定（独立函数便于单测） */
function judgeWechat(res) {
  // 探测层自身失败（tasklist / powershell 不可用等）：存疑，不判死
  if (res.missing || (res.error && res.running === undefined)) {
    return {
      key: 'wechat',
      state: 'warn',
      text: `! 微信状态未知${res.error ? '（' + res.error + '）' : ''}`,
      fix: '请手动确认微信已登录并停在主界面，再重跑 bz-face doctor',
    };
  }
  if (!res.running) {
    const saw3x = res.wx3Running
      ? '（检测到微信 3.x ' + WECHAT_3X_PROCESS + ' 在跑，本工具只支持 4.x）'
      : '';
    return {
      key: 'wechat',
      state: 'fail',
      text: `✗ 未检测到微信进程（${WECHAT_4X_PROCESS}）${saw3x}`,
      fix: '请先打开并登录微信（登录后停在主界面），再重跑 bz-face doctor',
    };
  }
  // 在跑但版本读不出：不判死，给手动核对路径
  if (!res.version) {
    return {
      key: 'wechat',
      state: 'warn',
      text: `! 微信在跑，但版本号读不出${res.versionError ? '（' + res.versionError + '）' : ''}——${WECHAT_4X_PROCESS} ${versionLabel(WECHAT_BLOCKED_VERSION)} 及以上将无法取密钥`,
      fix: '请在微信「设置 → 关于微信」核对版本；若 ≥ ' + versionLabel(WECHAT_BLOCKED_VERSION) + ' 需退回 ' + WECHAT_ROLLBACK_VERSION,
    };
  }
  if (compareDotVersions(res.version, versionLabel(WECHAT_BLOCKED_VERSION)) >= 0) {
    return {
      key: 'wechat',
      state: 'fail',
      text: `✗ 微信 ${res.version}：官方已封堵内存取密钥（≥ ${versionLabel(WECHAT_BLOCKED_VERSION)}）`,
      fix: `请卸载后退回安装微信 ${WECHAT_ROLLBACK_VERSION}，关闭自动更新，再重跑 bz-face doctor`,
    };
  }
  return { key: 'wechat', state: 'pass', text: `✓ 微信 ${res.version}（< ${versionLabel(WECHAT_BLOCKED_VERSION)}，可取密钥）` };
}

/** 数据根检查行判定（独立函数便于单测） */
function judgeDataRoot(res) {
  if (res.missing || !res.configured) {
    return { key: 'dataRoot', state: 'neutral', text: '· 数据根：未配置（用 --data-root <路径> 指定；不影响其余检查）' };
  }
  if (res.error) {
    return {
      key: 'dataRoot',
      state: 'warn',
      text: `! 数据根不可读（${res.error}）：${res.path}`,
      fix: `检查路径是否存在：explorer "${res.path}"`,
    };
  }
  if (!res.exists) {
    return {
      key: 'dataRoot',
      state: 'fail',
      text: `✗ 数据根目录不存在：${res.path}`,
      fix: `mkdir "${res.path}"`,
    };
  }
  if (!res.writable) {
    return {
      key: 'dataRoot',
      state: 'fail',
      text: `✗ 数据根目录不可写：${res.path}`,
      fix: `检查目录权限或被占用后重试：attrib "${res.path}"`,
    };
  }
  return { key: 'dataRoot', state: 'pass', text: `✓ 数据根可写：${res.path}` };
}

// ---- CLI 参数解析（薄壳用；放判定层以便单测） ----

/**
 * 解析 bz-face 的 argv。支持：
 *   bz-face doctor [--data-root <路径>] [--python <命令>] [--help] [--version]
 *   --data-root=X 等号写法同样接受；未知参数记入 error。
 * @param {string[]} argv process.argv.slice(2)
 * @returns {{ command: string|null, dataRoot?: string, python?: string, help?: boolean, version?: boolean, error?: string }}
 */
function parseDoctorArgv(argv) {
  const out = { command: null };
  const args = argv || [];
  for (let i = 0; i < args.length; i++) {
    let arg = String(args[i]);
    if (arg === 'doctor' && !out.command) {
      out.command = 'doctor';
      continue;
    }
    let inlineValue;
    const eq = arg.indexOf('=');
    if (eq > 2 && arg.startsWith('--')) {
      inlineValue = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      if (i + 1 < args.length) {
        i += 1;
        return String(args[i]);
      }
      return undefined;
    };
    switch (arg) {
      case '--data-root':
      case '-d': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--data-root 需要一个路径参数' };
        out.dataRoot = v;
        break;
      }
      case '--python':
      case '-p': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--python 需要一个命令参数' };
        out.python = v;
        break;
      }
      case '--help':
      case '-h':
        out.help = true;
        break;
      case '--version':
      case '-v':
        out.version = true;
        break;
      default:
        return { command: null, error: `未知参数：${args[i]}` };
    }
  }
  return out;
}

// ---- 输出格式化 ----

/** 检查行 → 终端文本（单行：glyph + 文案 + 「 → 修复命令」） */
function formatDoctorLine(line) {
  if (!line || !line.text) return '';
  if (line.state === 'neutral') return line.text;
  if (line.fix) return `${line.text}\n    → ${line.fix}`;
  return line.text;
}

module.exports = {
  MIN_PYTHON_VERSION,
  WECHAT_BLOCKED_VERSION,
  WECHAT_ROLLBACK_VERSION,
  WECHAT_4X_PROCESS,
  WECHAT_3X_PROCESS,
  DECRYPT_DEPS,
  TRANSCRIBE_DEPS,
  YARA_NOTE,
  compareDotVersions,
  versionLabel,
  collectDoctorProbes,
  runDoctorChecks,
  judgeWechat,
  judgeDataRoot,
  parseDoctorArgv,
  formatDoctorLine,
};
