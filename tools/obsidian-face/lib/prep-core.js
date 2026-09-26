// ================================================================
// bz-face prep —— 编排判定层（纯函数，零依赖，注入即可测）
//
// 职责切分（issue 468，照 464 sync 的三层切分）：
//   python/bz_prep.py  prep 本体（媒体导出→派生图片档→图片关联表→语音转写），自己吐四行协议行
//   lib/prep-core.js   本文件——阶段计划 / 参数解析 / 控制文件契约 / 协议行格式化 /
//                      转发中继与结果兜底 / 预检判定 / 启动失败归类
//   lib/probes.js      预检真探测（数据根 / 联系人目录）与子进程管道（probes.runSyncProcess 复用）
//   bin/bz-face.js     CLI 薄壳——预检 → 起子进程 → 逐行转发 → 汇总退出码
//
// prep 是单人重活（实测某联系人 1631 图 / 1289 语音 / 2.8GB，转写 20–60 分钟，ADR-0196）：
//   · 幂等可续——媒体 / 派生档「存在即跳过」，转写按 voice.json 已有 wav 键跳过；
//   · 协作式让行——<数据根>/.bz-face/control.json（464 预留的路径）出现暂停指令时，
//     Python 在步骤边界与每条媒体之间让行待命，进程不退出不丢进度（本地语音模型冷加载
//     按分钟计，绝不硬杀）；收到 stop 则留状态退出（[bz-result] 带 stopped:true）。
//     本文件 parseControlAction 是这条契约的 Node 侧权威表述，插件侧（469 阶段机）照此写文件。
//   · 绝不写回 chat.json（语音仍 [语音 N秒]、图片仍 [图片]）；转写 / 关联走旁路表。
//
// 协议口径（src/core/external-tool.ts）：[bz-step] / [bz-p]{phase,pct} / [bz-info] / [bz-result]。
// stdout 只产协议行（与 sync 同口径）：Python 的行原样透传，Node 只补「预检行」与「兜底结果行」。
//
// 铁的约定：
//   1. 本文件任何函数不得抛异常——畸形输入一律降级成失败结果行；
//   2. 绝不执行任何安装；语音转写引擎 / ffmpeg / 派生档参数全部走 CLI 显式传参，
//      绝不回读插件设置文件（插件侧接线时下发设置值）；
//   3. 阶段词（phase）是机器契约：media / derive / map / transcribe。
// ================================================================
'use strict';

const doctor = require('./doctor-core');
const sync = require('./sync-core');

// ---- 阶段计划（步骤词汇表；--help 渲染与测试同源，Python 侧 bz_prep.py 镜像同一顺序）----

/**
 * prep 的一次跑完四段（票 468 / ADR-0196 决策 1 的 prep 段）。id 同时是 [bz-p] 的 phase 词；
 * wxgf 解码随 media 段逐条进行、缩略图只导出不派生，都不单开阶段。
 */
const PREP_PHASES = [
  {
    id: 'media',
    label: '媒体导出',
    detail: '语音 silk→wav、图片 .dat 解码（wxgf 就地转 jpg/gif）、视频、文件、缩略图（仅留档，绝不当 AI 输入）；已存在即跳过',
  },
  {
    id: 'derive',
    label: '派生图片档',
    detail: '原图（非缩略图）→ desc/ 长边 1280、JPEG 质量 80（--derive-edge/--derive-quality 可配），供 AI 图片描述上行',
  },
  {
    id: 'map',
    label: '图片关联表',
    detail: 'image_map.json：图片↔消息关联（[{file,ct,sid}]，ct 升序）——旁路表，不写回 chat.json',
  },
  {
    id: 'transcribe',
    label: '语音转写',
    detail: '本地转写（--asr-engine，SenseVoice 缺省 / faster-whisper 备选）→ voice.json 转写结果表；已完成音频幂等跳过',
  },
];

/** 阶段计划副本（防调用方改到词汇表本体） */
function buildPrepPlan() {
  return PREP_PHASES.map((p) => ({ ...p }));
}

// ---- 控制文件契约（协作式暂停 / 中断；Python 侧按同口径消费）----

/** 数据根内工具私有目录（464 预留）；控制文件与密钥缓存、解密库都在这 */
const BZ_DIR_NAME = '.bz-face';
/** 协作式控制文件：<数据根>/.bz-face/control.json */
const CONTROL_FILE = 'control.json';
/** 让行待命时的轮询间隔（毫秒）；每条媒体之间另有一次「步骤边界」检查点 */
const CONTROL_POLL_MS = 1000;

/**
 * 控制文件内容 → 指令。契约（469 阶段机照此写文件）：
 *   {"action":"pause"}  → 在安全点让行待命（进程不退出）；
 *   {"action":"resume"} → 继续（等价于文件删除 / 内容无关）；
 *   {"action":"stop"}   → 留状态退出（[bz-result] 带 stopped:true，退出码 0）。
 * 其余一律视为无指令：文件不存在、坏 JSON、非对象、action 缺失 / 未知——
 * 长任务绝不因半截写的控制文件而中断。永不抛。
 * @param {string|Buffer|null} text 控制文件原始内容
 * @returns {''|'pause'|'resume'|'stop'}
 */
function parseControlAction(text) {
  if (text == null) return '';
  let obj;
  try {
    obj = JSON.parse(String(text));
  } catch {
    return '';
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
  const a = obj.action;
  return a === 'pause' || a === 'resume' || a === 'stop' ? a : '';
}

// ---- CLI 参数解析（prep 子命令；bin 先按首个非旗标参数路由到这）----

/**
 * 解析 bz-face prep 的 argv。支持：
 *   bz-face prep <联系人> --data-root <路径> [--python <命令>] [--src <账号目录>]
 *                 [--ffmpeg <路径>] [--derive-edge N] [--derive-quality N]
 *                 [--asr-engine sensevoice|faster-whisper] [--asr-model <名>] [--limit N]
 *                 [--help] [--version]
 * <联系人与 --data-root 必填（help/version 除外）；参数面即插件设置的下发面（462 外部工具
 * 组 + AI 面板转写组），CLI 不回读任何设置文件。未知参数记入 error，绝不猜。
 * @param {string[]} argv process.argv.slice(2)（容忍开头重复的 prep）
 */
function parsePrepArgv(argv) {
  const out = {
    command: 'prep',
    contact: undefined,
    deriveEdge: 1280,
    deriveQuality: 80,
    asrEngine: 'sensevoice',
    asrModel: 'small',
    limit: 0,
  };
  const args = argv || [];
  let i = 0;
  if (args[i] === 'prep') i += 1; // bin 路由后仍传整体 argv，跳过命令词
  for (; i < args.length; i++) {
    let arg = String(args[i]);
    if (!arg.startsWith('-')) {
      // 位置参数：第一个 = 联系人（sync 导出的目录名）；再来就是多余
      if (out.contact === undefined) {
        out.contact = arg;
      } else {
        return { command: null, error: `多余的位置参数「${arg}」——联系人只要一个，选项请用旗标传入` };
      }
      continue;
    }
    let inlineValue;
    const eq = arg.indexOf('=');
    if (eq > 2) {
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
    const takeInt = (label, min, max) => {
      const v = takeValue();
      const n = v === undefined ? NaN : Number(v);
      if (!Number.isInteger(n) || n < min || (max !== undefined && n > max)) {
        return { ok: false, error: max === undefined ? `${label} 需要 ≥${min} 的整数` : `${label} 需要 ${min}～${max} 的整数` };
      }
      return { ok: true, n };
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
      case '--ffmpeg': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--ffmpeg 需要一个路径参数' };
        out.ffmpeg = v;
        break;
      }
      case '--derive-edge': {
        const r = takeInt('--derive-edge', 64);
        if (!r.ok) return { command: null, error: r.error };
        out.deriveEdge = r.n;
        break;
      }
      case '--derive-quality': {
        const r = takeInt('--derive-quality', 1, 100);
        if (!r.ok) return { command: null, error: r.error };
        out.deriveQuality = r.n;
        break;
      }
      case '--asr-engine': {
        const v = takeValue();
        if (v !== 'sensevoice' && v !== 'faster-whisper') {
          return { command: null, error: `--asr-engine 只认 sensevoice 或 faster-whisper（得到「${v}」）` };
        }
        out.asrEngine = v;
        break;
      }
      case '--asr-model': {
        const v = takeValue();
        if (!v) return { command: null, error: '--asr-model 需要一个模型名参数' };
        out.asrModel = v;
        break;
      }
      case '--limit': {
        const r = takeInt('--limit', 0);
        if (!r.ok) return { command: null, error: r.error };
        out.limit = r.n;
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
  if (out.help || out.version) return out;
  if (out.contact === undefined) {
    return {
      command: null,
      error: 'prep 需要联系人：bz-face prep <联系人> --data-root <路径>（联系人 = sync 导出的目录名）',
    };
  }
  if (!out.dataRoot) {
    return {
      command: null,
      error: 'prep 需要数据根：--data-root <路径>（sync 的产物与 prep 的媒体 / 旁路表都落在这里）',
    };
  }
  return out;
}

// ---- 协议行格式化（复用 sync-core 的实现，一处分点）----

/**
 * 格式化一条协议行（实现与口径同 lib/sync-core.js formatBzLine：step 文案 / p {phase,pct} /
 * info·result JSON 体；畸形输入返回 ''，永不抛）。这里再导出一份，prep 侧调用与测试不用跨模块。
 */
function formatBzLine(kind, body) {
  return sync.formatBzLine(kind, body);
}

// ---- 转发中继（结果汇总兜底；结构同 sync，兜底文案换成 prep 口径）----

/**
 * stdout 逐行转发中继（createSyncRelay 的 prep 版）：
 *   1. 子进程行原样透传（空行丢弃；协议 / 非协议都不改写——插件自己解析）；
 *   2. 记住是否见过 [bz-result]；进程终结仍没见过 → 补一条兜底失败结果行
 *      （正常路径下 Python 自己的结果行唯一权威，绝不二次包装）。
 */
function createPrepRelay() {
  const inner = sync.createSyncRelay();
  return {
    get sawResult() {
      return inner.sawResult;
    },
    write(line) {
      return inner.write(line);
    },
    finish(code, stderr, errorMessage) {
      if (inner.sawResult) return [];
      let error;
      if (errorMessage) {
        error = String(errorMessage);
      } else if (code === 0) {
        error = '预处理进程正常结束但没有输出结果行——产物可能不完整，重跑 bz-face prep 只补缺口';
      } else {
        const tail = String(stderr || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .pop();
        error = `预处理进程异常退出（退出码 ${code === null ? '未知' : code}）${tail ? '：' + tail : ''}`;
      }
      return [formatBzLine('result', { ok: false, error })];
    },
  };
}

// ---- 预检判定（与 sync 的 judge* 同款纯函数口径）----

/**
 * prep 预检：注入 probeDataRoot / probeContactDir 的探测结果，判这条 prep 该不该起跑。
 *   数据根必须存在且可写（同 sync 口径）；联系人与 chat.json 必须在位——prep 的消息流
 *   对齐全靠 sync 产出的 chat.json，没有它就没有可导出的语音定位与图片关联（绝不静默降级）。
 *   微信**不需要**在跑：prep 不取密钥，只吃 sync 已落盘的解密库与媒体源。
 * @returns {{ ok: boolean, error?: string }}
 */
function judgePrepPreflight(probes) {
  const d = (probes && probes.dataRoot) || {};
  const c = (probes && probes.contact) || {};
  if (!d.configured) {
    return { ok: false, error: 'prep 需要数据根：--data-root <路径>（sync 的产物与 prep 的媒体 / 旁路表都落在这里）' };
  }
  if (!d.exists) {
    return { ok: false, error: `数据根目录不存在：${d.path || d.error || '（路径读不出）'}——先建目录或检查路径` };
  }
  if (d.writable === false) {
    return { ok: false, error: `数据根不可写：${d.path || ''}——检查目录权限或被占用后重试` };
  }
  if (!c.configured) {
    return { ok: false, error: 'prep 需要联系人：bz-face prep <联系人>（数据根下以联系人名命名的目录）' };
  }
  if (!c.exists) {
    return { ok: false, error: `联系人目录不存在：${c.path || ''}——先跑 bz-face sync 生成同步产物` };
  }
  if (!c.hasChat) {
    return { ok: false, error: `联系人目录里没有 chat.json：${c.path || ''}——先跑 bz-face sync（prep 的语音定位与图片关联都靠它对齐）` };
  }
  return { ok: true };
}

/**
 * 子进程启动失败归类（spawn error → 中文人话）。只管「起不动」，跑起来之后的失败
 * 由 Python 的协议行 / relay.finish 兜底表达。
 */
function classifyPrepSpawnFailure(err, pythonCmd) {
  const cmd = pythonCmd || 'python';
  const code = err && err.code;
  if (code === 'ENOENT') {
    return `找不到 Python 命令「${cmd}」——先跑 bz-face doctor 自检环境，或用 --python 指向 python.exe 完整路径`;
  }
  if (code === 'EACCES') {
    return `Python 命令「${cmd}」无执行权限——检查路径后重试，或用 --python 另指定`;
  }
  const msg = (err && err.message) || String(err || '未知错误');
  return `预处理进程启动失败：${msg.split('\n')[0]}`;
}

module.exports = {
  PREP_PHASES,
  buildPrepPlan,
  BZ_DIR_NAME,
  CONTROL_FILE,
  CONTROL_POLL_MS,
  parseControlAction,
  parsePrepArgv,
  formatBzLine,
  createPrepRelay,
  judgePrepPreflight,
  classifyPrepSpawnFailure,
};
