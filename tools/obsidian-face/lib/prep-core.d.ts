/**
 * prep-core.js 的类型声明（机制同 doctor-core.d.ts：包本体纯 JS CommonJS，
 * 仓库 vitest 测试要 import 本模块；tsconfig include 不含 tools/，放同名 .d.ts 后
 * tsc 解析 import 走声明文件，包内 .js 实现完全不进类型检查面。勿删。）
 */

/** prep 的一次跑完四段；id 同时是 [bz-p] 协议的 phase 词（wxgf 随 media、缩略图只导出不派生） */
export interface PrepPhase {
  id: 'media' | 'derive' | 'map' | 'transcribe';
  label: string;
  detail: string;
}

export declare const PREP_PHASES: PrepPhase[];

/** 阶段计划副本（防调用方改到词汇表本体） */
export declare function buildPrepPlan(): PrepPhase[];

/** 数据根内工具私有目录名（464 预留） */
export declare const BZ_DIR_NAME: string;
/** 协作式控制文件名：<数据根>/.bz-face/control.json */
export declare const CONTROL_FILE: string;
/** 让行待命轮询间隔（毫秒） */
export declare const CONTROL_POLL_MS: number;

/**
 * 控制文件内容 → 指令（'' | 'pause' | 'resume' | 'stop'）。
 * 坏 JSON / 非对象 / 未知 action 一律无指令——长任务绝不因半截写的控制文件而中断。永不抛。
 */
export declare function parseControlAction(text: string | Buffer | null | undefined): '' | 'pause' | 'resume' | 'stop';

export interface PrepArgv {
  command: 'prep' | null;
  /** 联系人（sync 导出的目录名；位置参数，必填） */
  contact?: string;
  dataRoot?: string;
  python?: string;
  /** 账号目录覆盖（默认取 key.json 的 source_dir） */
  src?: string;
  /** ffmpeg 命令 / 路径（wxgf 解码用；默认 ffmpeg） */
  ffmpeg?: string;
  /** 派生档长边像素，默认 1280 */
  deriveEdge: number;
  /** 派生档 JPEG 质量，默认 80 */
  deriveQuality: number;
  /** 转写引擎，默认 sensevoice */
  asrEngine: 'sensevoice' | 'faster-whisper';
  /** faster-whisper 档位，默认 small */
  asrModel: string;
  /** ≥0，默认 0（不限；调试用） */
  limit: number;
  help?: boolean;
  version?: boolean;
  error?: string;
}

/**
 * 解析 bz-face prep 的 argv（容忍开头重复的 prep）。联系人与 --data-root 必填（help/version
 * 除外）；未知参数 / 缺参记入 error，绝不猜。永不抛。
 */
export declare function parsePrepArgv(argv: string[]): PrepArgv;

/** 协议行格式化（'step'/'p'/'info'/'result'，同 sync-core 口径）；畸形输入返回 ''，永不抛 */
export declare function formatBzLine(kind: 'step' | 'p' | 'info' | 'result', body: unknown): string;

export interface PrepRelay {
  /** 是否已透传过 [bz-result] 行 */
  readonly sawResult: boolean;
  /** 子进程一行进来 → 要对外发出的行（原样透传；空行给 []） */
  write(line: string): string[];
  /**
   * 进程终结。见过结果行 → []；否则补一条 {ok:false,error} 兜底结果行
   * （errorMessage 显式给了就优先用，如启动失败归类）。
   */
  finish(code: number | null, stderr: string, errorMessage?: string): string[];
}

/** stdout 逐行转发中继：透传 + 结果行兜底（插件永远能拿到一个确定的结果事件） */
export declare function createPrepRelay(): PrepRelay;

export interface PrepPreflightProbes {
  /** probeDataRoot() 结果：configured/exists/writable/path… */
  dataRoot?: Record<string, any>;
  /** probeContactDir() 结果：configured/exists/hasChat/path… */
  contact?: Record<string, any>;
}

/** prep 预检判定：数据根缺失不可写 / 联系人目录或 chat.json 不在位 → {ok:false, error 中文} */
export declare function judgePrepPreflight(probes: PrepPreflightProbes): { ok: boolean; error?: string };

/** 子进程启动失败归类（spawn error → 中文人话；ENOENT/EACCES/其它） */
export declare function classifyPrepSpawnFailure(
  err: { code?: string; message?: string } | null | undefined,
  pythonCmd?: string,
): string;
