// ================================================================
// bz-face sync —— 编排判定层（纯函数，零依赖，注入即可测）
//
// 职责切分（issue 464，照 463 doctor 的三层切分）：
//   python/bz_sync.py  sync 本体（取密钥→解密→逐联系人导出+头像），自己吐四行协议行
//   lib/sync-core.js   本文件——阶段计划 / 参数解析 / 协议行格式化 / 转发中继与结果兜底 /
//                      预检判定 / 启动失败归类
//   lib/probes.js      预检真探测（微信进程 / 数据根）与子进程管道（spawn / 行缓冲 / stderr 留尾）
//   bin/bz-face.js     CLI 薄壳——预检 → 起子进程 → 逐行转发 → 汇总退出码
//
// 协议口径（src/core/external-tool.ts）：[bz-step] / [bz-p]{phase,pct} / [bz-info] / [bz-result]。
// sync 是给插件编排消费的长任务（465 数据源同步按钮驱动），与 doctor 的人读纯文本不同：
// 本命令 stdout 只产协议行——Python 的行原样透传，Node 只补「预检行」与「兜底结果行」，
// 绝不二次包装 Python 已给出的 [bz-result]。人读摘要看 [bz-result] 体（或跑 doctor）。
//
// 铁的约定：
//   1. 本文件任何函数不得抛异常——畸形输入一律降级成失败结果行；
//   2. 绝不执行任何安装；绝不静默降级（微信未运行 / 版本被封堵 = 预检即硬失败）；
//   3. 阶段词（phase）是机器契约：key / decrypt / contacts（头像随 contacts 逐人进行）。
// ================================================================
'use strict';

const doctor = require('./doctor-core');

// ---- 阶段计划（步骤词汇表；--help 渲染与测试同源，Python 侧 bz_sync.py 镜像同一顺序）----

/**
 * sync 的一次跑完四步（票 464 / ADR-0196 决策 1）。id 同时是 [bz-p] 的 phase 词；
 * 头像不单开进度阶段——它随「导出聊天」逐联系人进行。
 */
const SYNC_PHASES = [
  { id: 'key', label: '取密钥', detail: '从微信进程内存提取（微信需已登录运行；未运行立即失败，绝不静默降级）' },
  { id: 'decrypt', label: '解密数据库', detail: '增量解密到数据根 .bz-face/decrypted（已解密的库自动跳过）' },
  { id: 'contacts', label: '导出聊天', detail: '逐联系人生成 chat.json：文本、[表情·名]（当场命名）、图片定位（月/文件名）、语音时长' },
  { id: 'avatar', label: '头像源', detail: '从微信头像库抽头像落到各联系人目录（随上一步逐人进行）' },
];

/** 阶段计划副本（防调用方改到词汇表本体） */
function buildSyncPlan() {
  return SYNC_PHASES.map((p) => ({ ...p }));
}

// ---- CLI 参数解析（sync 子命令；bin 先按首个非旗标参数路由到这）----

/**
 * 解析 bz-face sync 的 argv。支持：
 *   bz-face sync --data-root <路径> [--python <命令>] [--src <账号目录>]
 *                [--min-messages N] [--limit N] [--help] [--version]
 * --data-root 必填（help/version 除外）；--min-messages ≥1（默认 1 = 全量非空联系人）；
 * --limit ≥0（默认 0 = 不限，调试用）。未知参数记入 error，绝不猜。
 * @param {string[]} argv process.argv.slice(2)（容忍开头重复的 sync）
 * @returns {{ command:'sync'|null, dataRoot?:string, python?:string, src?:string,
 *            minMessages:number, limit:number, help?:boolean, version?:boolean, error?:string }}
 */
function parseSyncArgv(argv) {
  const out = { command: 'sync', minMessages: 1, limit: 0 };
  const args = argv || [];
  let i = 0;
  if (args[i] === 'sync') i += 1; // bin 路由后仍传整体 argv，跳过命令词
  for (; i < args.length; i++) {
    let arg = String(args[i]);
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
      case '--src': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--src 需要一个账号目录参数' };
        out.src = v;
        break;
      }
      case '--min-messages': {
        const v = takeValue();
        const n = v === undefined ? NaN : Number(v);
        if (!Number.isInteger(n) || n < 1) return { command: null, error: '--min-messages 需要 ≥1 的整数' };
        out.minMessages = n;
        break;
      }
      case '--limit': {
        const v = takeValue();
        const n = v === undefined ? NaN : Number(v);
        if (!Number.isInteger(n) || n < 0) return { command: null, error: '--limit 需要 ≥0 的整数' };
        out.limit = n;
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
  if (!out.help && !out.version && !out.dataRoot) {
    return {
      command: null,
      error: 'sync 需要数据根：--data-root <路径>（密钥、解密库与各联系人目录都落在这里）',
    };
  }
  return out;
}

// ---- 协议行格式化（Node 自己要发的行；与 src/core/external-tool.ts 的解析口径对齐）----

/**
 * 格式化一条协议行。kind：
 *   'step'   body = 文案（空/纯空白 → ''，调用方跳过）
 *   'p'      body = {phase?, pct?}（pct 非有限数一律归 null——绝不假报）
 *   'info'   body = 对象（非对象/序列化失败 → ''）
 *   'result' body = 对象（同上）
 * 任何输入都不抛。
 */
function formatBzLine(kind, body) {
  try {
    if (kind === 'step') {
      const text = String(body == null ? '' : body).trim();
      return text ? `[bz-step] ${text}` : '';
    }
    if (kind === 'p') {
      const o = body && typeof body === 'object' ? body : {};
      const phase = o.phase == null ? null : String(o.phase);
      const pct = Number.isFinite(o.pct) ? Number(o.pct) : null;
      return `[bz-p] ${JSON.stringify({ phase, pct })}`;
    }
    if (kind === 'info' || kind === 'result') {
      const o = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
      return `[bz-${kind}] ${JSON.stringify(o)}`;
    }
    return '';
  } catch {
    return ''; // 循环引用等序列化失败：空串，调用方跳过
  }
}

// ---- 转发中继（结果汇总兜底）----

/**
 * stdout 逐行转发中继。职责：
 *   1. 子进程行原样透传（空行丢弃；协议 / 非协议都不改写——插件自己解析）；
 *   2. 记住是否见过 [bz-result]；进程终结仍没见过 → 补一条兜底失败结果行，
 *      让插件永远能拿到一个确定的结果事件（正常路径下 Python 自己的结果行唯一权威）。
 */
function createSyncRelay() {
  let sawResult = false;
  return {
    get sawResult() {
      return sawResult;
    },
    /** 子进程一行进来 → 要对外发出的行（数组；空行给 []） */
    write(line) {
      const text = String(line == null ? '' : line);
      if (!text.trim()) return [];
      if (/^\[bz-result\]/.test(text)) sawResult = true;
      return [text];
    },
    /**
     * 进程终结。sawResult → 不补行；否则合成 {ok:false,error} 结果行。
     * @param {number|null} code 退出码（null = 进程未能启动）
     * @param {string} stderr stderr 尾部（取最后一行进错误文案）
     * @param {string=} errorMessage 显式错误（如启动失败归类结果），给了就优先用
     */
    finish(code, stderr, errorMessage) {
      if (sawResult) return [];
      let error;
      if (errorMessage) {
        error = String(errorMessage);
      } else if (code === 0) {
        error = '导出进程正常结束但没有输出结果行——产物可能不完整，请重跑 bz-face sync';
      } else {
        const tail = String(stderr || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .pop();
        error = `导出进程异常退出（退出码 ${code === null ? '未知' : code}）${tail ? '：' + tail : ''}`;
      }
      return [formatBzLine('result', { ok: false, error })];
    },
  };
}

// ---- 预检判定（与 doctor 的 judge* 同款纯函数口径）----

/**
 * sync 预检：注入 probeWeixin / probeDataRoot 的探测结果，判这条 sync 该不该起跑。
 *   微信明确未在跑（running===false）→ 硬失败（绝不静默降级读旧目录，票 464 验收）；
 *   微信版本 ≥ 封堵线 → 硬失败 + 退回指引（复用 doctor 的常量与比较，不另立口径）；
 *   微信探测自身失败 / 版本读不出 → 不挡（Python 取密钥兜底，doctor 负责环境报告）；
 *   数据根必须存在且可写（sync 没有可写的落点就没有意义）。
 * @returns {{ ok: boolean, error?: string }}
 */
function judgeSyncPreflight(probes) {
  const w = (probes && probes.wechat) || {};
  const d = (probes && probes.dataRoot) || {};
  if (!d.configured) {
    return { ok: false, error: 'sync 需要数据根：--data-root <路径>（密钥、解密库与各联系人目录都落在这里）' };
  }
  if (!d.exists) {
    return { ok: false, error: `数据根目录不存在：${d.path || d.error || '（路径读不出）'}——先建目录或检查路径` };
  }
  if (d.writable === false) {
    return { ok: false, error: `数据根不可写：${d.path || ''}——检查目录权限或被占用后重试` };
  }
  if (w.running === false) {
    const saw3x = w.wx3Running ? '（检测到微信 3.x 在跑，本工具只支持 4.x）' : '';
    return {
      ok: false,
      error: `未检测到微信进程（${doctor.WECHAT_4X_PROCESS}）${saw3x}——请先打开并登录微信（登录后停在主界面），再重跑 bz-face sync`,
    };
  }
  if (w.running === true && w.version && doctor.compareDotVersions(w.version, doctor.versionLabel(doctor.WECHAT_BLOCKED_VERSION)) >= 0) {
    return {
      ok: false,
      error: `微信 ${w.version}：官方已封堵内存取密钥（≥ ${doctor.versionLabel(doctor.WECHAT_BLOCKED_VERSION)}），请退回安装微信 ${doctor.WECHAT_ROLLBACK_VERSION} 后再同步`,
    };
  }
  return { ok: true };
}

/**
 * 子进程启动失败归类（spawn error → 中文人话）。只管「起不动」，跑起来之后的失败
 * 由 Python 的协议行 / relay.finish 兜底表达。
 */
function classifySyncSpawnFailure(err, pythonCmd) {
  const cmd = pythonCmd || 'python';
  const code = err && err.code;
  if (code === 'ENOENT') {
    return `找不到 Python 命令「${cmd}」——先跑 bz-face doctor 自检环境，或用 --python 指向 python.exe 完整路径`;
  }
  if (code === 'EACCES') {
    return `Python 命令「${cmd}」无执行权限——检查路径后重试，或用 --python 另指定`;
  }
  const msg = (err && err.message) || String(err || '未知错误');
  return `导出进程启动失败：${msg.split('\n')[0]}`;
}

module.exports = {
  SYNC_PHASES,
  buildSyncPlan,
  parseSyncArgv,
  formatBzLine,
  createSyncRelay,
  judgeSyncPreflight,
  classifySyncSpawnFailure,
};
