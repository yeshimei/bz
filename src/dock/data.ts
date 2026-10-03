/**
 * dock 数据层：路径常量、工具登记（插件设置）、四份文件的读写口径。
 *
 * **四份文件、三个互斥写者**（spec §3 / D9，D4 修订后）——本模块把这几条写者边界钉在类型上：
 *
 * | 文件 | 位置 | 唯一写者 | 本模块的角色 |
 * |---|---|---|---|
 * | `data.json` → `dockTools` 段 | 插件设置 | **bz** | 读写（`readToolEntries` / `saveToolEntries`） |
 * | `dock.json`（声明） | **工具目录** | **工具作者** | **只读**（经 `declaration.ts`，不缓存） |
 * | `dock.settings.json`（参数值） | **工具目录** | **bz** | 读写（`readToolValues` / `saveToolValues`） |
 * | `CONFIG/STORAGE/dock/runs/<id>.json` | vault 内 | **工具** | **只读**（`readRunsFile` —— 永不创建、永不改写） |
 *
 * 运行记录那条尤其要紧：bz 一旦写回去就变成第二个写者，`news.json` 当年被这个问题逼出
 * 段级合并写（ADR-0128）、外部写者最后直接退役。所以读侧一律走
 * `vault.getAbstractFileByPath` + `vault.read`，**不用 `jsonFileStore`**（它会顺手把缺失的
 * 文件建出来 —— 那是写）。
 *
 * 读侧对畸形输入一律容错：坏 JSON / 版本不符 / 结构不符 → `null`，由 UI 降级为
 * 「该工具记录不可读」，绝不连累整个面板打不开（同 `parseBzLine` 的「永不抛异常」精神）。
 */

import type { App } from 'obsidian';
import { storageDir } from '../core/storage';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import {
  DOCK_RUNS_PER_TOOL_LIMIT,
  parseManifest,
  parseRunsFileText,
  type DockManifest,
  type DockRunsFile,
  type DockRunRecord,
} from './schema';
import { parseToolEntries, runSignature, type DockToolEntry } from './registry';
import {
  readDeclaration,
  readSettings,
  resolveRun,
  settingsPathFor,
  writeSettings,
  type ResolvedRun,
} from './declaration';
import {
  judgeDue,
  lastRun,
  overviewOf,
  recentStrip,
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

/** 域数据目录名（挂在共享数据根下；共享数据根由 settings.storagePath 决定） */
export const DOCK_DIR_NAME = 'dock';

/** 域数据根：`<存储路径>/dock` —— 面板上「复制数据根路径」给的就是它 */
export function dockDir(): string {
  return `${storageDir()}/${DOCK_DIR_NAME}`;
}

/** 运行记录目录（**工具写**） */
export function dockRunsDir(): string {
  return `${dockDir()}/runs`;
}

/** 某工具的运行记录文件路径（约定路径，工具不声明 —— spec D10） */
export function runsFilePath(id: string): string {
  return `${dockRunsDir()}/${id}.json`;
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

// ==================== 读侧（运行记录：只读、不创建、不抛） ====================

/** 读一个 vault 文本文件；不存在 / 读失败一律 null（不创建、不抛） */
async function readTextIfExists(app: App, path: string): Promise<string | null> {
  try {
    const f = app.vault.getAbstractFileByPath(path);
    if (!f) return null;
    const raw = await app.vault.read(f as never);
    return typeof raw === 'string' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * 读某工具的运行记录（只读）。
 * 返回 null = 文件不存在或读不出；`ok:false` 表示「文件在但读不懂」（UI 要区分这两者）。
 */
export async function readRunsFile(
  app: App,
  id: string,
): Promise<{ file: DockRunsFile | null; existed: boolean }> {
  const path = runsFilePath(id);
  const raw = await readTextIfExists(app, path);
  if (raw === null) return { file: null, existed: false };
  const parsed = parseRunsFileText(raw, id);
  return { file: parsed, existed: true };
}

// ==================== 参数值（工具侧设置文件） ====================

/** 读某工具的参数值（工具目录里的 `dock.settings.json`；读不到 = 空对象） */
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

/** 自动化 / 手动：**由声明的节奏推出**（`triggerOf` 是唯一判据，登记里没有第二个字段） */
export function triggerOfView(view: DockToolView): 'auto' | 'manual' {
  return triggerOf(view.manifest?.schedule);
}

/** 健康态 → 是否要「标红」（due 才算欠；pending/unknown/none 都不标） */
export function isOverdue(state: DockRunHealth): boolean {
  return state === 'due';
}

/** 一次把全部工具的视图读出来（并行读，互不阻塞） */
export async function loadToolViews(app: App): Promise<DockToolView[]> {
  const entries = readToolEntries();
  return Promise.all(entries.map((entry) => loadToolView(app, entry)));
}

/** 读单个工具的视图 */
export async function loadToolView(app: App, entry: DockToolEntry): Promise<DockToolView> {
  const decl = readDeclaration(entry.path);
  const manifest = decl.manifest ?? null;
  const run = resolveRun(manifest, entry.path);
  // 信任比对在**每次读视图时**做，不只在「重新读声明」那条路径上 —— 声明是文件，
  // 面板没开的时候也可能被人改掉；跑之前必须还能核出「这条命令我信过」。
  const trustStale = isTrusted(entry) && (run ? runSignature(run) : undefined) !== entry.trustedRun;
  const runsRead = await readRunsFile(app, entry.id);
  const runs = runsRead.file?.runs ?? [];
  return {
    entry,
    manifest,
    declError: manifest ? null : (decl.error ?? '声明读不到'),
    declPath: entry.path,
    valuesPath: settingsPathFor(entry.path),
    run,
    values: readToolValues(entry),
    trustStale,
    runs,
    runsUnreadable: runsRead.existed && runsRead.file === null,
    due: judgeDue(manifest?.schedule, runs),
    overLimit: runs.length > DOCK_RUNS_PER_TOOL_LIMIT,
    runsPath: runsFilePath(entry.id),
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
      schedule: v.manifest?.schedule,
      runs: v.runs,
      overdue: isOverdue(v.due.state),
    })),
    now,
  );
}

export type { DockOverview } from './schedule';

export { lastRun, recentStrip, successRate, judgeDue, triggerOf };
