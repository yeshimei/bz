/**
 * bz-face export 驱动（issue 485）：「导入所选」的按需全量导出段——sync 轮只产 stats.json
 * 之后，全量 chat.json 由本驱动对**勾选者**逐个拉取（一条 `bz-face export --data-root …
 * --contact <名>…` 带全部名单，工具侧逐人导出、单人失败不中断整体）。
 *
 * 与 sync 驱动（sync.ts）的分工：
 *   - sync 是模块级单例状态机（独立于面板生命周期、与画谱互斥）；export 是「导入所选」
 *     的前置段，生命周期跟着导入走（面板关闭即 stop，不留后台账）。
 *   - 协议同四行（[bz-step]/[bz-p]/[bz-info]/[bz-result]）；[bz-result] 为结果权威
 *     （mode:"export" 轮：written/unchanged/failed/failures）。
 *   - 进度消费 [bz-info]{phase:"contact"} 逐人事件（onEvent 回调给 UI 显示当前联系人）
 *     与 [bz-info]{phase:"contacts",total} 总人数校正。
 * 错误面分类复用 sync.ts 的 classifySyncFailure（ENOENT 安装指引 / Python 依赖 doctor 引导）。
 */
import { runExternalTool, type ExternalToolCallbacks, type ExternalToolHandle, type ExternalToolSpec, type ExternalToolOutcome } from '../core/external-tool';
import { tryGetSettings } from '../core/settings-provider';
import { classifySyncFailure, emptySyncStats, firstLine, quotePathArg, quotePythonArg, statsFromResult } from './sync';

/** 组装 `bz-face export` 的参数（引号口径与 buildSyncSpec 同源：quotePathArg） */
export interface BuildExportSpecOpts {
  dataRoot: string;
  /** 联系人目录名名单（非空；来自数据源扫描的目录名） */
  contacts: string[];
  /** Python 命令覆盖（非空才传；留空 = 跟随工具默认 python） */
  python?: string;
}

/** `bz-face export --data-root … --contact <名>…`（--contact 可重复；路径类参数包引号） */
export function buildExportSpec(opts: BuildExportSpecOpts): ExternalToolSpec {
  const python = opts.python?.trim() || undefined;
  return {
    cmd: 'bz-face',
    args: [
      'export',
      '--data-root',
      quotePathArg(opts.dataRoot),
      ...opts.contacts.flatMap((c) => ['--contact', quotePathArg(c)]),
      ...(python ? ['--python', quotePythonArg(python)] : []),
    ],
    shell: true,
  };
}

/** [bz-info]{phase:"contact"} 逐人事件 → 上屏形状（识别不出返回 null） */
export interface ExportContactEvent {
  name: string;
  status: 'ok' | 'skipped' | 'failed';
  /** 导出的消息条数（ok 事件带；stats/export 结果行的 msgTotal 同口径） */
  msgs?: number;
}

/** [bz-info] 体 → 联系人事件（纯函数独立可测；非 contact 事件 / 缺名 / 未知 status 返回 null） */
export function exportContactEvent(data: Record<string, unknown>): ExportContactEvent | null {
  if (data.phase !== 'contact' || typeof data.name !== 'string' || !data.name) return null;
  if (data.status === 'ok') {
    return { name: data.name, status: 'ok', ...(Number.isFinite(data.msgs) ? { msgs: Number(data.msgs) } : {}) };
  }
  if (data.status === 'skipped') return { name: data.name, status: 'skipped' };
  if (data.status === 'failed') return { name: data.name, status: 'failed' };
  return null;
}

/** 一轮按需导出的结果（[bz-result] 为权威；stopped / 硬失败时统计字段为零值） */
export interface ContactsExportResult {
  /** 进程跑完且 [bz-result] ok（单人失败不算硬失败——看 failed / failures） */
  ok: boolean;
  /** 经 stop() 主动停止 */
  stopped: boolean;
  /** 硬失败中文原因（ok=false 且非 stopped 时有值） */
  error: string;
  /** 下一步动作（工具未装 / 依赖缺失时的安装与自检指引） */
  hint: string;
  written: number;
  unchanged: number;
  failed: number;
  skipped: number;
  /** 失败名单（名 + 中文原因） */
  failures: Array<{ name: string; error: string }>;
}

export interface ContactsExportHandle {
  /** 进程终结（永不 reject；按 ok / stopped / error 分流） */
  done: Promise<ContactsExportResult>;
  /** 停止在跑进程（面板关闭时中止导入链） */
  stop(): void;
}

/** 进程壳注入缝（测试打桩；生产 = core/external-tool 的 runExternalTool） */
export type ExportRunner = typeof runExternalTool;
let runner: ExportRunner = runExternalTool;

/** 测试注入缝：替换 / 还原进程壳 */
export function setExportRunnerForTests(fn: ExportRunner | null): void {
  runner = fn ?? runExternalTool;
}

function emptyResult(): ContactsExportResult {
  return { ok: false, stopped: false, error: '', hint: '', written: 0, unchanged: 0, failed: 0, skipped: 0, failures: [] };
}

/** 终结分流（[bz-result] 权威；失败归类复用 sync 驱动同款口径） */
export function finishExport(outcome: ExternalToolOutcome, result: Record<string, unknown> | null): ContactsExportResult {
  if (outcome.stopped) return { ...emptyResult(), stopped: true };
  if (result && result.ok === false) {
    const msg = typeof result.error === 'string' && result.error.trim() ? result.error.trim() : '导出失败：工具报错，没有给出原因';
    return { ...emptyResult(), error: firstLine(msg), hint: /微信|数据根|key\.json/.test(msg) ? '' : '到终端运行 bz-face doctor 可自检环境' };
  }
  if (outcome.ok && result && result.ok === true) {
    const st = statsFromResult(result, emptySyncStats());
    return { ok: true, stopped: false, error: '', hint: '', written: st.written, unchanged: st.unchanged, failed: st.failed, skipped: st.skipped, failures: st.failures };
  }
  const cls = classifySyncFailure(outcome);
  return { ...emptyResult(), error: cls.message, hint: cls.hint };
}

/**
 * 起一轮按需导出（同步返回句柄；进度经 onEvent 逐人回调）。
 * 名单为空直接给失败结果（调用方本就该跳过空名单——这里兜底成确定终态）。
 */
export function startContactsExport(
  opts: BuildExportSpecOpts,
  onEvent?: (e: ExportContactEvent & { idx: number; total: number }) => void
): ContactsExportHandle {
  const names = opts.contacts.filter((c) => c && c.trim());
  if (!names.length) {
    return {
      done: Promise.resolve({ ...emptyResult(), error: '导出名单为空——先勾选联系人' }),
      stop: () => {},
    };
  }
  const s = (tryGetSettings() ?? {}) as Record<string, unknown>;
  const python = typeof s.pythonPath === 'string' ? s.pythonPath.trim() : '';
  let spec: ExternalToolSpec;
  try {
    spec = buildExportSpec({ dataRoot: opts.dataRoot, contacts: names, python });
  } catch (e) {
    // 参数面问题（路径含 % 被 quotePathArg 拒绝等）：按失败结果返回，调用方照常走失败分流
    return {
      done: Promise.resolve({ ...emptyResult(), error: e instanceof Error ? e.message : String(e) }),
      stop: () => {},
    };
  }
  let result: Record<string, unknown> | null = null;
  let total = names.length; // [bz-info]{phase:"contacts",total} 来了以后以工具口径为准
  let done = 0;
  const cbs: ExternalToolCallbacks = {
    onStep: () => {},
    onProgress: () => {},
    onInfo: (data) => {
      if (data.phase === 'contacts' && Number.isFinite(data.total)) {
        total = Math.max(1, Number(data.total));
        return;
      }
      const ev = exportContactEvent(data);
      if (ev) {
        done += 1;
        onEvent?.({ ...ev, idx: done, total });
      }
    },
    onResult: (data) => {
      result = data;
    },
  };
  const handle: ExternalToolHandle = runner(spec, cbs);
  return {
    done: handle.done.then((outcome) => finishExport(outcome, result)),
    stop: () => handle.stop(),
  };
}
