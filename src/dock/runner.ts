/**
 * dock 执行层：工具启动（`core/external-tool.ts` 的调用方）。
 *
 * 两条铁律落在这里：
 *  1) **只有已信任的命令才会被执行**（spec D7）。但**读声明不受信任门限** —— 声明是文件、
 *     读它不执行任何东西，所以顺序是「先看清它会跑什么，再决定信不信任」。原先靠
 *     `<cmd> --manifest` 自描述时做不到这一点（要读清单就得先执行），D4 修订后成立。
 *  2) **bz 不写运行记录**（spec D8/D9）。本模块只负责「启动 + 把 stdout 的四行协议转给 UI +
 *     报告终结结果」；记录由工具自己写。这也意味着**手动跑一次若工具自己不落账，就没账**
 *     —— 这是 D9 的直接后果，不是缺陷。
 *
 * 另一种形态（**离场**运行：系统计划任务在 Obsidian 关着时跑）不经过本模块 —— 那种情况下
 * bz 不是父进程，没有实时流可读，只能事后读运行记录。UI 上绝不能给自动化工具画假进度条。
 *
 * 依赖注入缝：`setDockRuntimeDeps({ cp })` 供评审壳/测试塞入假 `child_process`
 * （与 `runExternalTool` 的 `deps.cp` 同形）—— 插件侧恒为 null，走真身。
 */

import type { App } from 'obsidian';
import { notify } from '../core/notice';
import {
  runExternalTool,
  type ExternalToolDeps,
  type ExternalToolHandle,
  type ExternalToolOutcome,
  type ExternalToolSpec,
} from '../core/external-tool';
import {
  buildArgs,
  type DockErrorKind,
  type DockManifest,
  type DockParam,
  type DockProgress,
  type DockRunStep,
} from './schema';
import { runsFilePath, type DockToolEntry } from './data';
import type { ResolvedRun } from './declaration';

/** 注入缝（插件侧 null = 真身） */
let deps: ExternalToolDeps | undefined;

/** 注入执行依赖（评审壳/测试用；传 undefined 复原真身） */
export function setDockRuntimeDeps(d: ExternalToolDeps | undefined): void {
  deps = d;
}

// ==================== 运行环境 ====================

/**
 * vault 根路径（绝对）。
 *
 * Obsidian 的类型里 `app.vault.adapter` 没有这个面，所以只能窄取；收在这一个函数里，
 * 免得每个调用点各写一遍 `as unknown as {...}` 长链（那种链一改就散架，还盖住了真正的意图）。
 */
function vaultBasePath(app: App): string | undefined {
  const adapter = (app.vault as unknown as { adapter?: { getBasePath?: () => string } }).adapter;
  try {
    return adapter?.getBasePath?.();
  } catch {
    return undefined;
  }
}

/** 工具的运行环境（规格见 spec §4.3）——**是便利，不是契约**：约定路径才是硬约定 */
export function dockEnvOf(entry: DockToolEntry, app: App): Record<string, string> {
  const vaultPath = vaultBasePath(app);
  const env: Record<string, string> = {
    BZ_DOCK_CONTRACT: '1',
    BZ_DOCK_TOOL: entry.id,
    BZ_DOCK_RUNS_FILE: runsFilePath(entry.id),
  };
  if (vaultPath) env.BZ_DOCK_VAULT = vaultPath;
  return env;
}

// ==================== 在场运行 ====================

/** 一次在场运行的内存态（**不持久化** —— ADR-0218 已拍 bz 的队列内存化） */
export interface DockLiveRun {
  toolId: string;
  startedAt: string;
  steps: DockRunStep[];
  progress: DockProgress;
  infos: unknown[];
  result: unknown;
  /** 原始输出尾部（诊断用；不入运行记录） */
  rawTail: string[];
  handle: ExternalToolHandle;
  done: Promise<DockRunOutcome>;
}

export interface DockRunOutcome {
  ok: boolean;
  stopped: boolean;
  code: number | null;
  stderr: string;
  error: Error | null;
  /** bz 侧推断的失败分类（工具自己的记录里那份才是权威） */
  kind: DockErrorKind;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface DockRunCallbacks {
  onStep?(text: string): void;
  onProgress?(phase: string | null, pct: number | null): void;
  onInfo?(data: Record<string, unknown>): void;
  onResult?(data: Record<string, unknown>): void;
  /** 权威终结包（四行协议 + 过程态都在里面） */
  onDone?(outcome: DockRunOutcome, run: DockLiveRun): void;
}

/** 在场运行中的会话（toolId → 内存态）—— 面板重建后可重新挂上，不丢进度 */
const live = new Map<string, DockLiveRun>();

/** 当前是否在跑（UI 用） */
export function liveRunOf(toolId: string): DockLiveRun | undefined {
  return live.get(toolId);
}

/**
 * 全部**在场**运行（面板顶层进度条的数据源），按启动时刻升序 —— 先跑的在前，堆叠顺序稳定。
 *
 * 这里只会出现在场运行：自动化工具是**离场**跑（bz 不是它的父进程，拿不到任何实时进度），
 * 所以它永远不在这个清单里。这条不是实现细节，是 UI 约束（见本文件顶部说明与 spec §7）——
 * 谁在这上面加「离场进度」就是在骗人。
 */
export function liveRunsAll(): DockLiveRun[] {
  const at = (r: DockLiveRun): number => {
    const t = Date.parse(r.startedAt);
    return Number.isFinite(t) ? t : 0;
  };
  return Array.from(live.values()).sort((a, b) => at(a) - at(b));
}

/** 停止在跑的工具（幂等） */
export function stopRun(toolId: string): void {
  live.get(toolId)?.handle.stop();
}

/**
 * 启动一个工具（**在场**形态）。
 *
 * 前置条件由调用方保证（声明里有 `run`、已信任、桌面端）；`values` 是用户在参数表单里填的值，
 * 经 `buildArgs` 拼成 `--key=value`（值另有一份落在工具目录的 `dock.settings.json`，
 * 那是 bz 的账本，下发通道始终是命令行）。`secret` 类型照发给工具，但**不落任何 bz 侧记录**。
 */
export function runTool(
  app: App,
  entry: DockToolEntry,
  launch: ResolvedRun,
  manifest: Pick<DockManifest, 'params'> | null,
  values: Record<string, unknown>,
  cb: DockRunCallbacks = {},
): DockLiveRun {
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();

  const rawTail: string[] = [];
  const spec: ExternalToolSpec = {
    cmd: launch.cmd,
    args: [...launch.args, ...buildArgs(manifest ?? { params: [] }, values)],
    shell: launch.shell,
    cwd: launch.cwd,
    env: dockEnvOf(entry, app),
  };

  const steps: DockRunStep[] = [];
  const infos: unknown[] = [];
  let result: unknown;
  const myProgress: DockProgress = { phase: null, pct: null };

  const handle = runExternalTool(
    spec,
    {
      onStep: (text) => {
        steps.push({ text, at: new Date().toISOString(), status: 'ok' });
        cb.onStep?.(text);
      },
      onProgress: (phase, pct) => {
        myProgress.phase = phase;
        myProgress.pct = pct;
        cb.onProgress?.(phase, pct);
      },
      onInfo: (data) => {
        infos.push({ at: new Date().toISOString(), data });
        cb.onInfo?.(data);
      },
      onResult: (data) => {
        result = data;
        cb.onResult?.(data);
      },
      onRaw: (t) => {
        rawTail.push(t);
        if (rawTail.length > 200) rawTail.shift();
      },
    },
    deps,
  );

  const run = {
    toolId: entry.id,
    startedAt,
    steps,
    progress: myProgress,
    infos,
    result,
    rawTail,
    handle,
    done: undefined as unknown as Promise<DockRunOutcome>,
  } as DockLiveRun;

  run.done = handle.done.then((o) => {
    const finishedAt = new Date().toISOString();
    const outcome: DockRunOutcome = {
      ok: o.ok,
      stopped: o.stopped,
      code: o.code,
      stderr: o.stderr,
      error: o.error,
      kind: classify(o),
      startedAt,
      finishedAt,
      durationMs: new Date(finishedAt).getTime() - startedAtDate.getTime(),
    };
    live.delete(entry.id);
    cb.onDone?.(outcome, run);
    return outcome;
  });

  live.set(entry.id, run);
  return run;
}

/**
 * 终结结果 → 失败分类。
 * 注意：这是 bz 侧的**推断**，供在场运行时立刻给出可操作提示；权威分类在工具自己写的
 * 运行记录里（`error.kind`）。两者不一致时以记录为准 —— 工具比 bz 更知道自己死在哪儿。
 */
function classify(o: ExternalToolOutcome): DockErrorKind {
  if (o.stopped) return 'aborted';
  if (o.ok) return 'unknown';
  if (o.code === null) return 'config'; // 压根没起来 = 命令/工作目录配错了
  return 'unknown';
}

/** 状态文案（不带 emoji；通知正文口径） */
export function statusText(status: string): string {
  switch (status) {
    case 'ok':
      return '成功';
    case 'failed':
      return '失败';
    case 'stopped':
      return '已中止';
    case 'timeout':
      return '超时';
    case 'running':
      return '运行中';
    default:
      return status;
  }
}

/** 失败分类的可操作提示（「汇报完成情况」真正值钱的地方） */
export function errorHint(kind: DockErrorKind): string {
  switch (kind) {
    case 'auth':
      return '登录态已失效，去重新导出凭据（cookie / token）';
    case 'network':
      return '网络不通，检查代理或稍后重试';
    case 'config':
      return '命令或参数配错了，检查工具的命令路径与工作目录';
    case 'timeout':
      return '执行超时，可能是网络慢或任务量变大';
    case 'aborted':
      return '被手动中止';
    default:
      return '查看运行记录里的 stderr 尾部定位';
  }
}

/** 给一次在场运行收个尾巴（成功/失败/中止各一条通知；失败那条带上「怎么办」） */
export function notifyRunOutcome(
  name: string,
  outcome: DockRunOutcome,
  onView?: () => void,
): void {
  const secs = (outcome.durationMs / 1000).toFixed(outcome.durationMs < 10000 ? 1 : 0);
  const action = onView ? { label: '查看', onClick: onView } : undefined;
  if (outcome.ok) {
    notify(`${name} 完成（${secs} 秒）`, { type: 'success', action });
    return;
  }
  if (outcome.stopped) {
    notify(`${name} 已中止`, { type: 'warning', action });
    return;
  }
  // 分类提示比「失败了」有用得多：`config` 直接指向「命令/目录配错了」
  notify(`${name} 失败：${errorHint(outcome.kind)}`, { type: 'error', action });
}

/**
 * 参数表单初值 = 声明的默认值，叠加**已存的值**（已存的赢 —— 用户填过的不能被默认值盖回去）。
 *
 * 只取声明里出现过的 key：设置文件是手可改的，里面可能留着声明里已经删掉的参数，
 * 那些值不下发、也不显示（否则等于给工具发它不认的参数）。
 */
export function initialValuesOf(
  params: readonly DockParam[] | undefined,
  stored: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of params ?? []) {
    if (p.default !== undefined) out[p.key] = p.default;
    else if (p.type === 'bool') out[p.key] = false;
    else if (p.type === 'multichoice') out[p.key] = [];
  }
  for (const p of params ?? []) {
    if (Object.prototype.hasOwnProperty.call(stored, p.key)) out[p.key] = stored[p.key];
  }
  return out;
}
