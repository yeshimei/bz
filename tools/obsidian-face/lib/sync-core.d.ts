/**
 * sync-core.js 的类型声明（机制同 doctor-core.d.ts：包本体纯 JS CommonJS，
 * 仓库 vitest 测试要 import 本模块；tsconfig include 不含 tools/，放同名 .d.ts 后
 * tsc 解析 import 走声明文件，包内 .js 实现完全不进类型检查面。勿删。）
 */

/** sync 的一次跑完四步；id 同时是 [bz-p] 协议的 phase 词（头像随 contacts 进行，不单开阶段） */
export interface SyncPhase {
  id: 'key' | 'decrypt' | 'contacts' | 'avatar';
  label: string;
  detail: string;
}

export declare const SYNC_PHASES: SyncPhase[];

/** 阶段计划副本（防调用方改到词汇表本体） */
export declare function buildSyncPlan(): SyncPhase[];

export interface SyncArgv {
  command: 'sync' | null;
  dataRoot?: string;
  python?: string;
  src?: string;
  /** ≥1，默认 1（全量非空联系人） */
  minMessages: number;
  /** ≥0，默认 0（不限） */
  limit: number;
  help?: boolean;
  version?: boolean;
  error?: string;
}

/**
 * 解析 bz-face sync 的 argv（容忍开头重复的 sync）。--data-root 必填（help/version 除外）；
 * 未知参数 / 缺参记入 error，绝不猜。永不抛。
 */
export declare function parseSyncArgv(argv: string[]): SyncArgv;

/** 协议行格式化（'step'/'p'/'info'/'result'）；畸形输入返回 ''，永不抛 */
export declare function formatBzLine(kind: 'step' | 'p' | 'info' | 'result', body: unknown): string;

export interface SyncRelay {
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
export declare function createSyncRelay(): SyncRelay;

export interface SyncPreflightProbes {
  /** probeWeixin() 结果：running/version/wx3Running…；探测自身失败时不挡 */
  wechat?: Record<string, any>;
  /** probeDataRoot() 结果：configured/exists/writable/path… */
  dataRoot?: Record<string, any>;
}

/** sync 预检判定：微信未运行 / 版本被封堵 / 数据根缺失不可写 → {ok:false, error 中文} */
export declare function judgeSyncPreflight(probes: SyncPreflightProbes): { ok: boolean; error?: string };

/** 子进程启动失败归类（spawn error → 中文人话；ENOENT/EACCES/其它） */
export declare function classifySyncSpawnFailure(
  err: { code?: string; message?: string } | null | undefined,
  pythonCmd?: string,
): string;
