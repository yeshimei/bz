/**
 * dock 数据层：路径常量、工具登记（插件设置）、四份文件的读写口径。
 *
 * **四份文件、三个互斥写者**（spec §3 / D9，D4 修订后）——本模块把这几条写者边界钉在类型上：
 *
 * | 文件 | 位置 | 唯一写者 | 本模块的角色 |
 * |---|---|---|---|
 * | 插件 `data.json` → `dockTools` 段 | 插件设置 | **bz** | 读写（`readToolEntries` / `saveToolEntries`） |
 * | `manifest.json`（声明） | **工具目录** | **工具作者** | **只读**（经 `declaration.ts`，不缓存；旧名 `dock.json` 回落认） |
 * | `data.json`（参数值） | **工具目录** | **bz** | 读写（`readToolValues` / `saveToolValues`；旧名 `dock.settings.json` 回落认） |
 * | `runs.json`（运行记录） | **工具目录** | **工具** | **只读**（`readRunsFile` —— 永不创建、永不改写；旧名 `dock.runs.json` 回落认） |
 *
 * 两个 `data.json` 同名不同处，别混：**插件设置**那份在 vault 的插件目录里（登记表），
 * **参数值**那份在每个工具目录里（bz 的账本，ADR-0237 起按 Obsidian 插件惯例命名）。
 *
 * 运行记录那条尤其要紧：bz 一旦写回去就变成第二个写者，`news.json` 当年被这个问题逼出
 * 段级合并写（ADR-0128）、外部写者最后直接退役。所以读侧走 fs 缝的 `readText`
 * （桌面端 = `window.require('fs')`），**不用会顺手把缺失文件建出来的读法**（建文件就是写）。
 * 记录改住工具目录（与声明、参数值同一层，spec D9/D10 修订）—— 一个工具的全部数据都在
 * 它自己的目录里，bz 侧只剩一条登记项。
 *
 * 读侧对畸形输入一律容错：坏 JSON / 版本不符 / 结构不符 → `null`，由 UI 降级为
 * 「该工具记录不可读」，绝不连累整个面板打不开（同 `parseBzLine` 的「永不抛异常」精神）。
 */

import type { App } from 'obsidian';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import {
  DOCK_RUNS_PER_TOOL_LIMIT,
  parseManifest,
  parseRunsFileText,
  type DockManifest,
  type DockRunsFile,
  type DockRunRecord,
  type DockSchedule,
} from './schema';
import { parseToolEntries, runSignature, type DockToolEntry } from './registry';
import {
  readDeclaration,
  readRunsText,
  readSettings,
  resolveRun,
  runsPathFor,
  settingsPathFor,
  writeSettings,
  type ResolvedRun,
} from './declaration';
import {
  effectiveSchedule,
  isDueToRun,
  judgeDue,
  lastRun,
  nextDueAt,
  overviewOf,
  recentStrip,
  scheduleSignature,
  successRate,
  triggerOf,
  type DockDueVerdict,
  type DockOverview,
  type DockRunHealth,
} from './schedule';

// 登记契约（类型 + 校验）住在零依赖的 registry.ts；此处转出，消费方仍然只 import './data'
export type { DockToolEntry, DockTrigger } from './registry';
export { parseToolEntry, parseToolEntries, runSignature, TOOL_ID_RE } from './registry';

// ==================== 路径 ====================

/**
 * 某工具运行记录的路径 = **工具目录下**的 `runs.json`（spec D10 修订；旧名 `dock.runs.json` 读侧回落认）。
 *
 * vault 里**不再有** dock 数据目录：声明、参数值、运行记录三份都在工具自己的目录里，
 * bz 侧只剩一条登记项。工具因此是自包含的 —— 把目录搬走就是搬走它的全部数据。
 */
export function runsPathOf(entry: DockToolEntry): string {
  return runsPathFor(entry.path);
}

// ==================== 工具登记（插件设置 · 唯一写者是 bz） ====================

/** 读全部登记（脏值逐条丢弃；缺省空数组）。
 *  校验本体在 registry.ts（零依赖、可单测）；这里只负责从设置取原始值。 */
export function readToolEntries(): DockToolEntry[] {
  return parseToolEntries((tryGetSettings() as Record<string, unknown> | undefined)?.dockTools);
}

/** 写回全部登记（**唯一的登记写入口**；bump 落盘） */
export async function saveToolEntries(entries: DockToolEntry[]): Promise<void> {
  const s = getSettings() as unknown as Record<string, unknown>;
  s.dockTools = entries;
  await saveSettings();
}

/** 是否已建立过信任 */
export function isTrusted(entry: DockToolEntry): boolean {
  return typeof entry.trustedAt === 'string' && entry.trustedAt !== '';
}

/** 是否参与运行（enabled 缺省视为开） */
export function isEnabled(entry: DockToolEntry): boolean {
  return entry.enabled !== false;
}

/** 自动运行总闸（缺省开）。关掉 = 声明了节奏也不自动跑，只在面板里手动点 */
export function isAutoRun(entry: DockToolEntry): boolean {
  return entry.autoRun !== false;
}

/**
 * 就地改一条登记（按 id 找、合并 patch、整表写回）。
 *
 * 走「读全表 → 改一条 → 写回」而不是「长命数组」：登记表是 bz 的账本，面板与调度器都要写它，
 * 每次现读能最大限度避免「一方拿着过期快照把另一方的改动盖掉」。真正的并发窗口只剩「读与写
 * 之间」那一段同步代码，窄到可以接受。
 *
 * `patch` 里值为 `undefined` 的键表示**清除**该键（不是设成 undefined）。
 */
export async function updateToolEntry(id: string, patch: Partial<DockToolEntry>): Promise<void> {
  const entries = readToolEntries();
  const i = entries.findIndex((e) => e.id === id);
  if (i < 0) return;
  const next = { ...entries[i] } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  entries[i] = next as unknown as DockToolEntry;
  await saveToolEntries(entries);
}

// ==================== bz 侧运行台账（调度的账） ====================

/**
 * bz 对某个工具**调度视角**的记账 —— 自动尝试全记；手动侧只记**成功**（失败不入账）。
 *
 * **刻意不进工具的 `runs.json`**（那是工具唯一写者的地盘，D8/D9）：这里只记 bz 自己看到的
 * 事实 —— 「bz 什么时候试着跑了一次、成没成」。它的存在是为了两件工具记录兜不住的事：
 * ① 工具崩了自己没落记录时，bz 仍知道「它跑过且失败」；② 连续失败熔断要有据可依。
 * 工具自己那份记录仍是**权威**（含 `error.kind`），这里只服务调度决策。
 * 手动成功同样入账（`recordRunSuccess`）：成功是「工具活着」的证据，不分谁拉起的；
 * 手动失败不入 —— 熔断保护的是没人盯着时的自动运行，别让人手动试错把它搞停。
 */
export interface DockToolRunState {
  /** bz 最近一次尝试的时刻（ISO）—— 自动尝试，或手动成功 */
  lastAttemptAt?: string;
  /** 那次尝试 bz 侧的判果（工具记录为权威，这里只判调度） */
  lastAttemptOk?: boolean;
  /** 连续自动失败次数（任一次成功即清零）—— 熔断依据；手动失败不计入 */
  consecutiveFailures?: number;
  /** 熔断触发时刻（ISO）；非空 = 自动运行已暂停，等用户在面板里手动恢复 */
  pausedAt?: string;
}

/** 从设置原始值规整一条台账（脏字段逐个丢，不抛） */
function parseRunState(raw: unknown): DockToolRunState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: DockToolRunState = {};
  if (typeof r.lastAttemptAt === 'string' && r.lastAttemptAt !== '') out.lastAttemptAt = r.lastAttemptAt;
  if (typeof r.lastAttemptOk === 'boolean') out.lastAttemptOk = r.lastAttemptOk;
  if (typeof r.consecutiveFailures === 'number' && Number.isInteger(r.consecutiveFailures) && r.consecutiveFailures > 0) {
    out.consecutiveFailures = r.consecutiveFailures;
  }
  if (typeof r.pausedAt === 'string' && r.pausedAt !== '') out.pausedAt = r.pausedAt;
  return out;
}

/** 读全部台账（缺省空对象） */
export function readRunStates(): Record<string, DockToolRunState> {
  const raw = (tryGetSettings() as Record<string, unknown> | undefined)?.dockRunState;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, DockToolRunState> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const st = parseRunState(v);
    if (Object.keys(st).length) out[id] = st;
  }
  return out;
}

/**
 * 改一条台账（合并 patch；`patch` 里值为 `undefined` 的键 = 清除该键）。整表写回。
 * 传 `null` = 删掉该工具的台账（重新开始）。
 */
export async function patchRunState(id: string, patch: Partial<DockToolRunState> | null): Promise<void> {
  const s = getSettings() as unknown as Record<string, unknown>;
  const all = readRunStates();
  if (patch === null) {
    delete all[id];
  } else {
    const next = { ...all[id] } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete next[k];
      else next[k] = v;
    }
    const st = parseRunState(next);
    if (Object.keys(st).length) all[id] = st;
    else delete all[id];
  }
  s.dockRunState = all;
  await saveSettings();
}

/**
 * 一次**成功**收尾的台账入账，自动（scheduler）与手动（runFlow / 直跑命令）共用这一把笔：
 * 记本次尝试、清零连续失败、解除熔断。入账口径只有这一份 —— 两处手写必漂。
 */
export async function recordRunSuccess(id: string, finishedAt: string): Promise<void> {
  await patchRunState(id, {
    lastAttemptAt: finishedAt,
    lastAttemptOk: true,
    consecutiveFailures: 0,
    pausedAt: undefined,
  });
}

// ==================== 读侧（运行记录：只读、不创建、不抛） ====================

/**
 * 读某工具的运行记录（只读）。
 *
 * 走 fs 直读工具目录 —— 记录不在 vault 里，所以用不上 vault API。这与 `readDeclaration`
 * 是同一条路（同一个 fs 缝）：读文件不执行任何东西，也不创建任何东西。
 * `existed: false` = 文件不存在；`{ existed: true, file: null }` = 文件在但读不懂（UI 要分这两者）。
 */
export function readRunsFile(entry: DockToolEntry): { file: DockRunsFile | null; existed: boolean } {
  const raw = readRunsText(entry.path);
  if (raw === null) return { file: null, existed: false };
  return { file: parseRunsFileText(raw, entry.id), existed: true };
}

// ==================== 参数值（工具侧设置文件） ====================

/** 读某工具的参数值（工具目录里的 `data.json`；新名不在回落认旧名 `dock.settings.json`，都没有 = 空对象） */
export function readToolValues(entry: DockToolEntry): Record<string, unknown> {
  return readSettings(entry.path, entry.id);
}

/**
 * 写某工具的参数值。返回是否写成功 —— 失败不抛：面板要照常能用，最多是这次没存住
 * （凭据只丢这一次，比整块面板崩掉强）。
 */
export function saveToolValues(entry: DockToolEntry, values: Record<string, unknown>): boolean {
  return writeSettings(entry.path, entry.id, values);
}

// ==================== 聚合视图 ====================

/** 单个工具的完整视图（面板渲染的全部输入） */
export interface DockToolView {
  entry: DockToolEntry;
  /** 声明 —— **工具目录那份文件的直读结果**，bz 不缓存；null = 读不到 */
  manifest: DockManifest | null;
  /** 声明读不到的原因（人话）；读得到时 null */
  declError: string | null;
  /** 声明文件路径（详情页「命令」那一行的替代 —— 现在要指到声明上） */
  declPath: string;
  /** 参数值文件路径 */
  valuesPath: string;
  /** 解析后的启动方式；null = 声明里没写 `run`（只能看、不能跑） */
  run: ResolvedRun | null;
  /**
   * **信任过期**：声明当前的启动命令与建立信任时那条不一致（或从没记过签名）。
   *
   * 这是 D5 的补丁。命令现在住在声明文件里，而文件是任何能碰磁盘的东西都能改的 —— 所以
   * 「用户信任的是哪条命令」必须能比对出来：不一致就**不许跑**，重新问一次。
   * 没有这一条，D4 的「命令放声明里」就把 D5 的信任边界让掉了。
   */
  trustStale: boolean;
  /** 参数值（工具侧文件里那份） */
  values: Record<string, unknown>;
  runs: DockRunRecord[];
  /** 记录文件存在但读不懂（≠「还没跑过」） */
  runsUnreadable: boolean;
  due: DockDueVerdict;
  /** 调度判据：现在该不该自动跑（`isDueToRun`；与 `due` 的告警口径刻意不同，interval 首次也跑） */
  dueToRun: boolean;
  /** 声明里的节奏（**作者默认值**） */
  declaredSchedule: DockSchedule | undefined;
  /** **生效节奏**（覆盖 ?? 声明）—— 分区、标红、调度一律用它 */
  schedule: DockSchedule | undefined;
  /** 是否被用户覆盖过 */
  scheduleOverridden: boolean;
  /** 覆盖之后**作者又改了声明**（C4 提示：建议重看一眼） */
  declChangedSinceOverride: boolean;
  /** 自动运行总闸（缺省开） */
  autoRun: boolean;
  /** 下一次「该跑」的时刻（ms）；判不出一律 `null`（绝不编假到期时间） */
  nextDue: number | null;
  /** bz 侧运行台账（缺省 undefined） */
  runState: DockToolRunState | undefined;
  /** 记录条数超约定上限（**裁剪是工具的活**，bz 只检测、只在 UI 提示） */
  overLimit: boolean;
  runsPath: string;
}

/** 注册用 id：**声明里的 id 才作数**；声明读不到时退回登记的 id（键是登记时抄下来的） */
export function displayId(view: DockToolView): string {
  return view.manifest?.id || view.entry.id;
}

/** 显示名：声明名 > id（登记里不再存名字 —— 那是声明的事） */
export function displayName(view: DockToolView): string {
  return view.manifest?.name || view.entry.id;
}

/** 描述（声明给；缺省空串） */
export function displayDesc(view: DockToolView): string {
  return view.manifest?.description || '';
}

/** 图标：声明给 lucide 名，缺省回落域图标 */
export function displayIcon(view: DockToolView): string {
  return view.manifest?.icon || 'square-terminal';
}

/** 自动化 / 手动：**由生效节奏推出**（覆盖优先；`triggerOf` 仍是唯一判据，登记里没有第二个字段） */
export function triggerOfView(view: DockToolView): 'auto' | 'manual' {
  return triggerOf(view.schedule);
}

/** 健康态 → 是否要「标红」（due 才算欠；pending/unknown/none 都不标） */
export function isOverdue(state: DockRunHealth): boolean {
  return state === 'due';
}

/** 一次把全部工具的视图读出来（并行读，互不阻塞） */
export async function loadToolViews(app: App): Promise<DockToolView[]> {
  const entries = readToolEntries();
  const states = readRunStates(); // 台账一次读全，别让每个工具各读一遍
  return Promise.all(entries.map((entry) => loadToolView(app, entry, states)));
}

/** 读单个工具的视图 */
export async function loadToolView(
  app: App,
  entry: DockToolEntry,
  runStates: Record<string, DockToolRunState> = readRunStates(),
): Promise<DockToolView> {
  const decl = readDeclaration(entry.path);
  const manifest = decl.manifest ?? null;
  // 回落命中旧名（dock.json）时用实际读到的路径 —— 参数值 / 运行记录 / 展示都以它为基准
  const declPath = decl.path ?? entry.path;
  const run = resolveRun(manifest, declPath, decl.conventionalRun);
  // 信任比对在**每次读视图时**做，不只在「重新读声明」那条路径上 —— 声明是文件，
  // 面板没开的时候也可能被人改掉；跑之前必须还能核出「这条命令我信过」。
  const trustStale = isTrusted(entry) && (run ? runSignature(run) : undefined) !== entry.trustedRun;
  const runsRead = readRunsFile(entry);
  const runs = runsRead.file?.runs ?? [];

  // 生效节奏 = 用户覆盖 ?? 声明默认。分区、标红、调度**一律从它出发**，声明那份只当默认值。
  const declaredSchedule = manifest?.schedule;
  const schedule = effectiveSchedule(declaredSchedule, entry.scheduleOverride);
  const scheduleOverridden = entry.scheduleOverride !== undefined;
  // 覆盖之后作者又改了声明？比对建立覆盖时留下的签名（没记签名 = 无从判断，不提示）
  const declChangedSinceOverride =
    scheduleOverridden &&
    entry.overrideDeclSig !== undefined &&
    entry.overrideDeclSig !== scheduleSignature(declaredSchedule);

  return {
    entry,
    manifest,
    declError: manifest ? null : (decl.error ?? '声明读不到'),
    declPath,
    valuesPath: settingsPathFor(declPath),
    run,
    values: readToolValues(entry),
    trustStale,
    runs,
    runsUnreadable: runsRead.existed && runsRead.file === null,
    due: judgeDue(schedule, runs),
    dueToRun: isDueToRun(schedule, runs),
    declaredSchedule,
    schedule,
    scheduleOverridden,
    declChangedSinceOverride,
    autoRun: isAutoRun(entry),
    nextDue: nextDueAt(schedule, runs),
    runState: runStates[entry.id],
    overLimit: runs.length > DOCK_RUNS_PER_TOOL_LIMIT,
    runsPath: runsPathOf(entry),
  };
}

/** 供面板头部用的汇总数字 */
export function summarize(views: readonly DockToolView[]): {
  total: number;
  auto: number;
  manual: number;
  overdue: number;
  totalRuns: number;
} {
  let auto = 0;
  let manual = 0;
  let overdue = 0;
  let totalRuns = 0;
  for (const v of views) {
    if (triggerOfView(v) === 'auto') auto += 1;
    else manual += 1;
    if (isOverdue(v.due.state)) overdue += 1;
    totalRuns += v.runs.length;
  }
  return { total: views.length, auto, manual, overdue, totalRuns };
}

/**
 * 面板顶部四格 KPI：把视图压成 `overviewOf` 要的输入，交给它算。
 * 口径本体在 schedule.ts（零 import，node 可直测）；这里只做一次映射 ——
 * 渲染层与测试层因此共用同一份口径，不在渲染里另算一套。
 */
export function overview(views: readonly DockToolView[], now: number = Date.now()): DockOverview {
  return overviewOf(
    views.map((v) => ({
      trigger: triggerOfView(v),
      name: displayName(v),
      schedule: v.schedule,
      runs: v.runs,
      overdue: isOverdue(v.due.state),
    })),
    now,
  );
}

export type { DockOverview } from './schedule';

export { lastRun, recentStrip, successRate, judgeDue, triggerOf };
