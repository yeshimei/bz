/**
 * 脸谱面板行为层（issue 447 / ADR-0106）：markup 全部出自 render.ts（折子语义单源），
 * 本文件只做生命周期 / 事件委托 / 数据流。
 *
 * 视图：list（折子封面墙）/ detail（折页册：画像/事件/大事记/数据/档案五折）+
 * 数据源独立弹窗（447 拍板：默认不打开、打开即扫、默认不勾选、四态水位、
 * 「导入所选」只进预览、「画脸谱」关弹窗回面板跑生成）。
 * 文件向导已退役（447）：bz-people-import 命令改开数据源弹窗；聊天原文只在本层内存流转
 * （ADR-0191），预览桶只落标签化文本。
 *
 * 生成链（issue 450 / 451）：本层不再内联跑生成循环——组装 targets 交给 jobs.ts 生成引擎
 * （模块级单例，独立于面板生命周期），面板只订阅快照渲染进度块；done 产物在本层
 * 落 people.json（PeopleStore / ImportRecord 口径沿用 446 收编形态）。关面板转后台，
 * 重开面板 snapshot+resume 渲染当前任务态，中断任务出「继续生成」。
 * 451：折子封面卡的印章升级为四态（未画谱 / 画谱中 / 画谱中断 / 已画谱）且本身就是动作入口
 * （画脸谱 / 暂停 / 继续生成 / 补画），快照每帧原位只换印章节点。
 */
import { notice, notifyActionError } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { getApp } from '../core/app';
import { PeopleStore } from './data';
import { mergeManualEvents, planIncremental } from './incremental';
import { emptyMediaStats, formatMediaCount, type MediaStats } from './media';
import { computeStats, formatReplySec } from './stats';
import * as jobsApi from './jobs';
import type { JobStartOptions, JobTarget, JobView, JobsSnapshot as EngineSnapshot } from './jobs';
import type { FaceDigest, ImportRecord, PersonEntry, PersonProfile, UnifiedMessage } from './types';
import {
  PreviewStore,
  isGroupChat,
  listContactDirs,
  mergePreview,
  normalizeChatJson,
  normalizeOptionsFromSettings,
  previewMediaBadge,
  previewToUnified,
  readContactBundle,
  type PreviewContact,
  type PreviewStats,
} from './datasource';
import {
  dsModal,
  duoBar,
  foldBook,
  foldCard,
  foldChronicleBody,
  foldDataBody,
  foldDetailHead,
  foldEventsBody,
  foldPortraitBody,
  foldProfileBody,
  foldSealNode,
  foldWall,
  importMeta,
  insightsCard,
  kindChips,
  mergeBar,
  miniMarkdown,
  monthlyChart,
  panelShell,
  progressBlock,
  replyLatencySec,
  socialRow,
  statsText,
  tagChip,
  wallEmpty,
  jobsStagesDone,
  type DsRowState,
  type FoldCardJob,
  type FoldId,
  type JobsBlockState,
  type JobsUiStatus,
} from './render';
import { el, text, textEl } from './render';
import { mountIcons } from '../core/ui';
import { tryGetSettings } from '../core/settings-provider';

const ESC_ID = 'people-panel';

type Stage = 'list' | 'detail';

let overlay: HTMLElement | null = null;
let store: PeopleStore | null = null;
let stage: Stage = 'list';
let detailId: string | null = null;
/** 详情当前展开的折（换人回落画像折） */
let detailFold: FoldId = 'p';
/** 删除二次确认（第一次点进入武装态，3 秒回落） */
let deleteArmId: string | null = null;
let deleteArmTimer: ReturnType<typeof setTimeout> | null = null;
/** 最近一次 renderList 拉到的人物（合并确认取名用） */
let listCache: PersonEntry[] = [];
/** 合并流程（issue 442）：mergeFromId = 待并出的人物；mergeToId = 已点选、待二次确认的目标 */
let mergeFromId: string | null = null;
let mergeToId: string | null = null;

// ---------------- 生成引擎接线状态（issue 450；引擎独立于面板生命周期） ----------------

/** 快照退订（订阅跟会话走：关面板后引擎照推，重开面板即时恢复任务态） */
let jobsUnsub: (() => void) | null = null;
/** 引擎最近一次快照（关面板后仍在更新——关面板转后台 + 重开渲染都靠它） */
let jobsCache: EngineSnapshot | null = null;
/** 本次会话提交给引擎的目标（talker → target）：done 落盘要引擎不回传的入参（kindCounts 等） */
const targetsInFlight = new Map<string, GenTarget>();
/** 已落过盘的任务（防引擎保留的 done 任务重复推送重复落盘；重新生成时按 talker 清除） */
const jobsPersisted = new Set<string>();
/** 引擎本会话是否已从 people-jobs.json 重建（resumeJobs 只做一次，防覆盖运行中的内存队列） */
let jobsBooted = false;

// ---------------- 数据源弹窗（issue 447） ----------------

/** 一位数据源联系人的扫描快照（内存态，不入盘） */
interface DsContact {
  /** 目录名（即预览桶键 / PersonEntry.id） */
  name: string;
  rawCount: number;
  isGroup: boolean;
  /** 归一化后能进预览的口径统计（按当前预览组开关） */
  stats: PreviewStats;
  /** 预览桶已有条数 */
  previewCount: number;
  /** 扫描时发现的新消息条数（原始 keys − 预览 keys） */
  newCount: number;
  /** 已画到的提炼锚点（PersonEntry.lastProcessedTs） */
  processedTs: number | null;
}

let dsOpen = false;
let dsContacts: DsContact[] | null = null;
let dsSelected = new Set<string>();
let dsScanning = false;
let dsImporting = false;
let dsHiddenGroups = 0;
let dsNotice = '';
/** 导入完成且新增 >0 → 弹窗出「画脸谱」 */
let dsGenerateable = false;
let dsScannedAt = '';

export function isPeopleOpen(): boolean {
  return overlay !== null;
}

/** 打开面板（已开则聚到前台；不自动开弹窗、不自动扫描——447 拍板） */
export function openPeoplePanel(app?: unknown): void {
  if (overlay) {
    topifyZ(overlay);
    return;
  }
  store = new PeopleStore(app ?? getApp());
  overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay bz-people-scope';
  overlay.appendChild(panelShell());
  document.body.appendChild(overlay);
  topifyZ(overlay);
  // ESC 分层（448 评审）：数据源弹窗开着先关弹窗（保扫描快照与勾选），再层层关面板
  registerPanelEsc(ESC_ID, isPeopleOpen, () => { if (dsOpen) closeDs(); else closePeoplePanel(); });
  trapPanelFocus(overlay.querySelector<HTMLElement>('.bz-people-panel') ?? overlay);
  overlay.addEventListener('click', onOverlayClick);
  overlay.addEventListener('change', onOverlayChange);
  // 输入框 Enter 直提交（448 评审 P3：标签 / 随手记连续录入免鼠标往返）
  overlay.addEventListener('keydown', (e) => {
    const input = e.target instanceof HTMLInputElement ? e.target : null;
    if (e.key !== 'Enter' || !input) return;
    if (!input.hasAttribute('data-people-prof-tag-input') && !input.hasAttribute('data-people-note-text')) return;
    e.preventDefault();
    if (input.hasAttribute('data-people-prof-tag-input')) addTagChip();
    else void saveManualNote();
  });
  void renderBody();
  // 状态恢复（issue 450）：面板打开即拉引擎快照 + 订阅——运行中 / 暂停 / 中断 / done 都有对应呈现
  void restoreJobsView();
}

export function closePeoplePanel(): void {
  // 关面板转后台（issue 450）：引擎照跑；有正在跑的任务才提示，只剩暂停 / 排队不打扰
  const backgrounded = jobsRunning();
  unregisterPanelEsc(ESC_ID);
  overlay?.remove();
  overlay = null;
  store = null;
  detailId = null;
  detailFold = 'p';
  stage = 'list';
  listCache = [];
  mergeFromId = null;
  mergeToId = null;
  profEditId = null; // 编辑态不随面板存续（评审 P1-2：重开面板不落回编辑态）
  noteAddId = null;
  disarmDelete();
  closeDsState();
  if (backgrounded) notice('已转后台继续生成，重开面板查看进度', 'info');
}

function closeDsState(): void {
  dsOpen = false;
  dsContacts = null;
  dsSelected = new Set();
  dsScanning = false;
  dsImporting = false;
  dsHiddenGroups = 0;
  dsNotice = '';
  dsGenerateable = false;
  dsScannedAt = '';
}

/** 直开数据源弹窗（bz-people-import 命令回调；面板未开先开） */
export function openDataSource(): void {
  if (!overlay) openPeoplePanel();
  void openDsIfIdle();
}

/** 生成进行中不开弹窗：导入会动预览桶，正在跑的任务指纹会漂移判废（450 沿用 447 守卫） */
async function openDsIfIdle(): Promise<void> {
  await ensureJobsBoot();
  await ensureJobsWatch();
  if (!overlay) return;
  if (jobsBusy()) { notice('正在生成脸谱，请等这批结束再开数据源', 'info'); return; }
  openDs();
}

// ---------------- 数据源弹窗状态机 ----------------

function dsDataDir(): string {
  return String(tryGetSettings()?.peopleDataDir ?? '').trim();
}

function isDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean((window as unknown as { require?: unknown }).require);
}

function openDs(): void {
  if (dsOpen) return;
  dsOpen = true;
  renderBody();
  // 打开即扫（拍板 Q3）；已有快照不重扫，重扫走按钮
  if (dsContacts === null) void runScan();
}

function closeDs(): void {
  if (!dsOpen) return;
  dsOpen = false;
  dsGenerateable = false;
  renderBody();
}

/** 弹窗行状态（快照 + 水位 → 渲染入参） */
function dsRowStates(): DsRowState[] {
  return (dsContacts ?? []).map((c) => {
    const badge = previewMediaBadge(c.stats);
    return {
      name: c.name,
      rawCount: c.rawCount,
      isGroup: c.isGroup,
      media: badge ? formatMediaCount(badge) : '',
      previewCount: c.previewCount,
      newCount: c.newCount,
      processedTs: c.processedTs,
    };
  });
}

function dsModalState() {
  const sel = (dsContacts ?? []).filter((c) => dsSelected.has(c.name));
  return {
    dataDir: dsDataDir(),
    scanning: dsScanning,
    importing: dsImporting,
    rows: dsContacts === null ? null : dsRowStates(),
    selectedCount: sel.length,
    selected: sel.map((c) => c.name),
    freshCount: sel.reduce((s, c) => s + c.newCount, 0),
    hiddenGroups: dsHiddenGroups,
    notice: dsNotice,
    generateable: dsGenerateable,
    desktopOnly: !isDesktop(),
    scannedAt: dsScannedAt,
  };
}

/**
 * 扫描数据源：列目录 → 逐人读 chat.json 归一化 → 对照预览桶算新素材 → 落快照
 * （不导入、不自动勾选——447 拍板：默认不选任何联系人）。
 */
async function runScan(force = false): Promise<void> {
  const dataDir = dsDataDir();
  if (!overlay || !store || !dataDir || dsScanning || dsImporting || jobsBusy()) return;
  if (!isDesktop()) {
    dsNotice = '';
    renderBody();
    return;
  }
  dsScanning = true;
  dsGenerateable = false;
  if (force) dsContacts = null;
  dsNotice = '';
  renderBody();
  const contacts: DsContact[] = [];
  let hidden = 0;
  try {
    const dirNames = listContactDirs(dataDir);
    const includeGroups = tryGetSettings()?.peopleIncludeGroups === true;
    const opts = normalizeOptionsFromSettings();
    const previewStore = new PreviewStore(getApp());
    const [previewData, people] = await Promise.all([previewStore.read(), store.list()]);
    for (const name of dirNames) {
      if (!overlay) return; // 面板已关，放弃本次扫描
      const bundle = readContactBundle(dataDir, name);
      if (!bundle) continue;
      const group = isGroupChat(bundle.raws);
      if (group && !includeGroups) { hidden++; continue; }
      const norm = normalizeChatJson(bundle.raws, opts, { voice: bundle.voice, imageDesc: bundle.imageDesc });
      const pv = previewData.contacts[name];
      const keys = new Set((pv?.msgs ?? []).map((m) => m.key));
      const entry = people.find((p) => p.id === name);
      contacts.push({
        name,
        rawCount: bundle.raws.length,
        isGroup: group,
        stats: norm.stats,
        previewCount: pv?.msgs.length ?? 0,
        newCount: norm.msgs.reduce((s, m) => s + (keys.has(m.key) ? 0 : 1), 0),
        processedTs: entry?.lastProcessedTs ?? null,
      });
    }
  } catch (e) {
    console.warn('[people] 数据源扫描失败:', e);
    dsNotice = '扫描失败：读不到数据文件夹或文件格式不对。';
  }
  dsScanning = false;
  dsHiddenGroups = hidden;
  if (overlay) {
    // 有更新排最前，其余名字序（拍板 Q4）
    dsContacts = contacts.sort((a, b) => b.newCount - a.newCount || a.name.localeCompare(b.name, 'zh'));
    const names = new Set(dsContacts.map((c) => c.name));
    dsSelected = new Set([...dsSelected].filter((n) => names.has(n)));
    const now = new Date();
    dsScannedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    renderBody();
  }
}

/**
 * 导入所选（第一段：原始→预览桶增量）：逐人读 chat.json → normalizeChatJson → mergePreview
 * 只补新消息 → 落 people-preview.json。完成后弹窗出「画脸谱」（447 拍板：不自动生成）。
 */
async function importDsSelected(): Promise<void> {
  const dataDir = dsDataDir();
  if (!overlay || !dataDir || dsImporting || dsScanning || jobsBusy()) return;
  // 群聊能出现在 dsContacts = 设置已放开（runScan 按 peopleIncludeGroups 筛过），导入照单全收
  const chosen = (dsContacts ?? []).filter((c) => dsSelected.has(c.name));
  if (!chosen.length) { notice('还没有勾选联系人', 'warning'); return; }
  if (!isDesktop()) {
    dsNotice = '数据源导入仅桌面端支持（需要读取库外文件夹）。';
    renderBody();
    return;
  }
  dsImporting = true;
  dsGenerateable = false;
  dsNotice = '正在导入预览…';
  renderBody();
  const opts = normalizeOptionsFromSettings();
  const previewStore = new PreviewStore(getApp());
  const now = new Date().toISOString();
  const addedOf = new Map<string, number>();
  const readFail: string[] = [];
  try {
    for (const c of chosen) {
      if (!overlay) return; // 面板已关，中止
      const bundle = readContactBundle(dataDir, c.name);
      if (!bundle) { readFail.push(c.name); continue; }
      const norm = normalizeChatJson(bundle.raws, opts, { voice: bundle.voice, imageDesc: bundle.imageDesc });
      const existing = (await previewStore.read()).contacts[c.name];
      const { contact, added } = mergePreview(existing, norm, now);
      await previewStore.upsertContact(c.name, contact);
      addedOf.set(c.name, added);
      // 快照同步（水位行即时反映，不重扫）
      c.previewCount = contact.msgs.length;
      c.newCount = 0;
      c.stats = contact.stats;
    }
  } catch (e) {
    console.warn('[people] 预览导入失败:', e);
    dsNotice = '导入失败：读数据文件时出错。';
    dsImporting = false;
    renderBody();
    return;
  }
  dsImporting = false;
  const fresh = [...addedOf.values()].reduce((s, n) => s + n, 0);
  const summary = `已导入预览（新增 ${fresh} 条）${readFail.length ? ` · ${readFail.length} 位读文件失败` : ''}`;
  dsNotice = fresh > 0 && !readFail.length ? `${summary}。点「画脸谱」调用 AI 生成。` : summary;
  dsGenerateable = fresh > 0 && !readFail.length;
  renderBody();
}

/**
 * 「画脸谱」（447 拍板 Q5；450 改走引擎）：关闭弹窗回面板，targets 交生成引擎后台跑，
 * 进度走面板进度块。不设门槛：弹窗里手动点，选了就画（skip 人物自动跳过）。
 */
async function generateFromDs(): Promise<void> {
  if (!overlay || !store || dsImporting || dsScanning) return;
  if (jobsBusy()) { notice('已有生成在进行——等它完成或暂停后再画', 'info'); return; }
  const names = (dsContacts ?? []).filter((c) => dsSelected.has(c.name)).map((c) => c.name);
  if (!names.length) { notice('还没有勾选联系人', 'warning'); return; }
  const targets: GenTarget[] = [];
  try {
    const previewData = await new PreviewStore(getApp()).read();
    for (const name of names) {
      const pv = previewData.contacts[name];
      if (!pv?.msgs.length) continue;
      targets.push({
        talker: name,
        name,
        msgs: previewToUnified(pv.msgs),
        kindCounts: pv.kindCounts ?? {},
        skippedCount: 0, // 预览桶内全是有效文本；原始过滤数已计入 chat.json 口径，不在导入记录重复报
        fileLabel: `数据源:${name}`,
        insights: pv.insights,
      });
    }
  } catch (e) {
    console.warn('[people] 读取预览桶失败:', e);
    dsNotice = '生成失败：读不到预览缓存。';
    renderBody();
    return;
  }
  if (!targets.length) {
    dsNotice = '所选还没有预览数据，先「导入所选」。';
    renderBody();
    return;
  }
  closeDs();
  await startGeneration(targets);
}

/**
 * 详情 / 卡面「画脸谱」（448 仅未生成时出；451 卡上印章的「画脸谱 / 补画」也走这里）：
 * 用预览桶里该人物的消息素材单人生成，交引擎后台跑，进度走面板进度块。
 * 还没有预览素材时提示先走数据源导入。
 */
async function generateOne(id?: string): Promise<void> {
  const name = id ?? detailId;
  if (!store || !name) return;
  if (jobsBusy()) { notice('已有生成在进行——等它完成或暂停后再画', 'info'); return; }
  let target: GenTarget | null = null;
  try {
    const pv = (await new PreviewStore(getApp()).read()).contacts[name];
    if (pv?.msgs.length) {
      target = {
        talker: name,
        name,
        msgs: previewToUnified(pv.msgs),
        kindCounts: pv.kindCounts ?? {},
        skippedCount: 0,
        fileLabel: `数据源:${name}`,
        insights: pv.insights,
      };
    }
  } catch (e) {
    console.warn('[people] 读取预览桶失败:', e);
  }
  if (!target) { notice('还没有可画的消息素材——点右上「数据源」导入后再画', 'warning'); return; }
  await startGeneration([target]);
}

// ---------------- 生成引擎接线（issue 450：引擎化 + 后台化 + 断点续跑） ----------------

/** 生成目标（引擎 JobTarget 同形；msgs 必须是全量预览桶消息——引擎断点续跑要重读校验指纹） */
export interface GenTarget {
  talker: string;
  name: string;
  msgs: UnifiedMessage[];
  /** 全形态计数（数据源路径 = chat.json 全量口径，见 datasource） */
  kindCounts: Record<string, number>;
  /** 被过滤的非文本 / 空消息条数（导入记录 skippedCount 口径，评审 P2-2） */
  skippedCount: number;
  /** 导入记录的 file 标注 */
  fileLabel: string;
  /** 预览桶侧写里的互动统计汇总（issue 449；旧桶可能没有）→ 引擎拼互动统计叙述段喂画像与时间线 */
  insights?: PreviewContact['insights'];
}

/**
 * 生成引擎（jobs.ts）的 ui 消费面——模块本体天然满足；测试经 setJobsModuleForTests 注入假件
 * （测试域避免 vi.mock，与 obsidian alias 同一思路：注入缝比模块 mock 稳）。
 */
export interface JobsApi {
  startJobs(app: unknown, targets: JobTarget[], opts?: JobStartOptions): Promise<{ queued: string[]; skipped: string[] }>;
  /** 读 people-jobs.json 重建队列；崩溃遗留 running → interrupted（本会话只调一次） */
  resumeJobs(app: unknown): Promise<void>;
  /** 从断点继续指定人物（已完成批次不重烧） */
  resume(talker: string): boolean;
  /** 当前批完成后暂停 */
  pauseJobs(): void;
  /** 删除任务（error 态「删除任务」；运行中的也删） */
  removeJob(talker: string): boolean;
  /** 进度快照推送（启动即推一次当前态），返回退订函数 */
  subscribe(fn: (s: EngineSnapshot) => void): () => void;
  snapshot(): EngineSnapshot;
}

let jobsOverride: JobsApi | null = null;

/** 引擎入口（生产 = jobs.ts 模块；测试 = 注入假件） */
function jobs(): JobsApi {
  return jobsOverride ?? (jobsApi as unknown as JobsApi);
}

/** 测试注入缝：假引擎替换 jobs 模块（传 null 还原模块本体；一并清订阅 / 缓存 / 幂等标记） */
export function setJobsModuleForTests(mod: JobsApi | null): void {
  if (jobsUnsub) { jobsUnsub(); jobsUnsub = null; }
  jobsOverride = mod;
  jobsCache = null;
  jobsBooted = false;
  targetsInFlight.clear();
  jobsPersisted.clear();
}

/** 快照进场（订阅回调 / 打开面板恢复共用）：done 落盘 → 渲染进度块 */
function applySnapshot(s: EngineSnapshot | null): void {
  jobsCache = s;
  if (s) handleJobsSnapshot(s);
  else renderJobs();
}

/**
 * 面板打开时恢复任务态（openPeoplePanel 调）：先从 people-jobs.json 重建引擎队列
 * （崩溃遗留 running → interrupted，出「继续生成」），再订阅快照渲染。
 */
async function restoreJobsView(): Promise<void> {
  if (!overlay) return;
  await ensureJobsBoot();
  await ensureJobsWatch();
}

/** 引擎启动扫描（每会话一次；resumeJobs 会整体重建内存队列，不能在运行中重放） */
async function ensureJobsBoot(): Promise<void> {
  if (jobsBooted) return;
  jobsBooted = true;
  await jobs().resumeJobs(getApp());
}

/** 订阅引擎快照（整个会话只订一次；关面板不退订——引擎推送照收，重开面板即时恢复） */
async function ensureJobsWatch(): Promise<void> {
  if (!jobsUnsub) jobsUnsub = jobs().subscribe((s) => applySnapshot(s));
  applySnapshot(jobs().snapshot());
}

/** 快照处理：done 任务落 people.json（每任务恰好一次）+ 进度块原位刷新 */
function handleJobsSnapshot(s: EngineSnapshot): void {
  for (const job of s.queue) {
    if (job.status !== 'done') continue;
    const target = targetsInFlight.get(job.talker);
    if (target) {
      targetsInFlight.delete(job.talker); // 先摘再落盘：快照重复推送不会重复写导入记录
      jobsPersisted.add(job.talker); // 引擎保留的 done 任务再推快照也不重落
      void persistJobDone(job, target);
    } else if (!jobsPersisted.has(job.talker) && job.portrait) {
      // 重启续跑完成的任务：入参走 job.importRecord / job.stats（引擎落盘口径）
      jobsPersisted.add(job.talker);
      void persistJobDone(job);
    }
  }
  renderJobs();
}

/**
 * 生成入口（数据源弹窗 / 详情「画脸谱」共用）：
 * 1) 本地预筛——同一导出再导（指纹命中）不进引擎不烧 AI（441 语义原样保留，顺带应用改名
 *    与旧记录 stats 补齐）；补录 / 增量的提示条数沿用原口径；
 * 2) targets 交 startJobs（引擎内部切批 / 逐批采集 / 画像 / 时间线，每批原子落盘）；
 * 3) 订阅快照渲染进度块——独立于面板生命周期，关面板照跑。
 */
export async function startGeneration(targets: GenTarget[]): Promise<void> {
  const { runnable, skipped } = await planTargets(targets);
  for (const t of runnable) {
    targetsInFlight.set(t.talker, t);
    jobsPersisted.delete(t.talker); // 同人重新生成：上一次的落盘幂等标记不复用
  }
  let engineSkipped = 0;
  if (runnable.length) {
    const res = await jobs().startJobs(getApp(), runnable, {}); // mode 缺省 auto：引擎逐人按增量计划判定
    engineSkipped = res.skipped.length;
    await ensureJobsWatch();
  }
  const started = runnable.length - engineSkipped;
  const parts: string[] = [];
  if (started > 0) parts.push(`已开始生成 ${started} 张脸谱（后台进行，可关面板）`);
  if (skipped.length + engineSkipped > 0) parts.push(`${skipped.length + engineSkipped} 位没有新消息、无需重画`);
  if (parts.length) notice(parts.join('，'), 'success');
  renderJobs();
}

/**
 * 本地预筛（441 planIncremental 语义保留在 ui 层）：skip 不进引擎；补录 / 增量的提示沿用原口径。
 * 模式与旧画像的解析归引擎（startJobs opts / 增量所需 old digest 由引擎内部处理）。
 */
async function planTargets(targets: GenTarget[]): Promise<{ runnable: GenTarget[]; skipped: string[] }> {
  const store = new PeopleStore(getApp());
  const people = await store.list();
  const runnable: GenTarget[] = [];
  const skipped: string[] = [];
  for (const t of targets) {
    const existing = people.find((p) => p.id === t.talker);
    const plan = planIncremental(t.msgs, existing);
    if (plan.mode === 'skip') {
      // skip 只可能发生在已有导入的人物上；顺带应用改名，并给 440 之前的旧数据补一份
      // 互动统计到最近一条导入记录（没有记录则不动）
      if (existing) {
        let imports = existing.imports;
        if (imports.length && !imports.some((r) => r.stats)) {
          imports = [...imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
          imports[0] = { ...imports[0], stats: computeStats(t.msgs, t.kindCounts) };
          await store.upsert({ ...existing, name: t.name, imports });
        } else {
          await store.upsert({ ...existing, name: t.name });
        }
      }
      skipped.push(t.name);
      continue;
    }
    if (plan.mode === 'older') {
      notice(`「${t.name}」这批 ${plan.msgs.length} 条消息早于上次提炼点，将作为补充素材提炼`);
    } else if (plan.olderCount > 0) {
      notice(`「${t.name}」另有 ${plan.olderCount} 条消息早于上次提炼点，本次不重复提炼`);
    }
    runnable.push(t);
  }
  return { runnable, skipped };
}

/**
 * done 落盘（沿用 446 收编形态的 PeopleStore / ImportRecord 口径）：
 * 会话内任务用 targetsInFlight 里的原始入参（时间跨度 / 统计 / 锚点全量可算）；
 * 重启续跑完成的任务走引擎落盘的 importRecord / stats（批元数据口径，不含原文）。
 * 成功后把 done 任务从引擎队列清掉（产物已安全入 people.json，进度块不再挂旧账）。
 */
async function persistJobDone(job: JobView, target?: GenTarget): Promise<void> {
  const talker = target?.talker ?? job.talker;
  const name = target?.name ?? job.name;
  try {
    if (!job.portrait) { notice(`「${name}」生成完成但画像为空`, 'warning'); return; }
    const store = new PeopleStore(getApp());
    const existing = (await store.list()).find((p) => p.id === talker);
    const now = new Date().toISOString();
    const msgs = target?.msgs;
    const rec: ImportRecord = {
      file: target?.fileLabel ?? job.importRecord?.fileLabel ?? job.fileLabel ?? `数据源:${talker}`,
      importedAt: now,
      messageCount: target
        ? (job.importRecord?.messageCount ?? msgs!.length)
        : (job.importRecord?.messageCount ?? 0),
      skippedCount: target?.skippedCount ?? job.importRecord?.skippedCount ?? 0,
      timeFrom: msgs ? new Date(msgs[0].ts).toISOString() : job.importRecord?.timeFrom ?? now,
      timeTo: msgs ? new Date(msgs[msgs.length - 1].ts).toISOString() : job.importRecord?.timeTo ?? now,
      stats: target ? computeStats(msgs!, target.kindCounts) : job.stats,
    };
    const entry: PersonEntry = existing ? { ...existing, name } : { id: talker, name, createdAt: now, imports: [] };
    await store.upsert(entry);
    await store.appendImport(talker, rec);
    const digest: FaceDigest = {
      portrait: job.portrait,
      events: mergeManualEvents(job.events ?? [], existing?.manualEvents), // 439：手动随手记并入事件素材
      quotes: job.quotes,
      moments: job.material?.moments, // 449：场景 / 特质随生成落盘
      traits: job.material?.traits,
      chronicle: job.chronicle || undefined,
      generatedAt: now,
    };
    await store.setDigest(talker, digest);
    // 锚点写回：已提炼过的最大消息时间戳（计划内末条；降级路径从指纹键解出 ts，解不出不动锚点）
    const lastTs = msgs ? msgs[msgs.length - 1].ts : Number(String(job.lastMsgKey ?? '').split('|')[0]);
    if (Number.isFinite(lastTs)) {
      await store.setLastProcessedTs(talker, Math.max(existing?.lastProcessedTs ?? 0, lastTs));
    }
    notice(`「${name}」的脸谱已生成`, 'success');
    jobs().removeJob(talker); // 产物已入 people.json：done 任务清出队列，进度块自然收起
    if (overlay) void renderBody(); // 封面墙 / 详情立即可见新脸谱
  } catch (e) {
    if (target) targetsInFlight.set(talker, target); // 落盘失败放回：下个快照重试
    notifyActionError(e, `写入「${name}」的脸谱`);
  }
}

// ---------------- 进度块渲染与动作（render.progressBlock 的 ui 侧） ----------------

/** 面板进度块：无活跃任务隐藏；有则渲染当前任务态（running 优先，其次可续跑 / 出错 / done） */
function renderJobs(): void {
  const slot = overlay?.querySelector<HTMLElement>('[data-people-jobs-slot]');
  if (!slot) return;
  const item = currentJobsItem();
  if (item) {
    slot.hidden = false;
    slot.replaceChildren(progressBlock(toBlockState(item)));
  } else {
    slot.hidden = true;
    slot.replaceChildren();
  }
  syncWallSeals(); // 451：折子印章四态跟帧刷新（原位只换印章节点）
}

/** 当前展示的任务：running > paused/interrupted > error > done（同档取队列靠前） */
function currentJobsItem(): JobView | null {
  const queue = jobsCache?.queue ?? [];
  if (!queue.length) return null;
  const rank: Record<JobsUiStatus, number> = { running: 0, paused: 1, interrupted: 1, error: 2, done: 3 };
  return [...queue]
    .map((job, i) => ({ job, i }))
    .sort((a, b) => rank[a.job.status] - rank[b.job.status] || a.i - b.i)[0].job;
}

/** 引擎任务 → 进度块视图（百分比口径见 render.jobsPercent；派生字段缺省自算兜底） */
function toBlockState(job: JobView): JobsBlockState {
  const queue = jobsCache?.queue ?? [];
  const pos = queue.findIndex((j) => j.talker === job.talker);
  return {
    talker: job.talker,
    name: job.name || job.talker,
    status: job.status,
    message: job.message ?? '',
    batchesDone: job.batchesDone ?? 0,
    batchesTotal: job.batchesTotal ?? job.chunks?.length ?? 0,
    stagesDone: jobsStagesDone(job.stage, job.status),
    queueIndex: job.queueIndex ?? pos + 1,
    queueTotal: job.queueTotal ?? queue.length,
    errorText: job.error,
  };
}

/** 有无活跃任务（运行中 / 排队或已暂停）：数据源导入类守卫用它（导入会动预览桶 → 指纹漂移判废） */
function jobsBusy(): boolean {
  return (jobsCache?.queue ?? []).some((j) => j.status === 'running' || j.status === 'paused');
}

/** 是否有正在跑的任务（关面板转后台提示用；仅剩暂停 / 排队时关面板不打扰） */
function jobsRunning(): boolean {
  return (jobsCache?.queue ?? []).some((j) => j.status === 'running');
}

/** 进度块动作派发（talker 从块根 data 钩子读） */
function jobsAction(kind: 'pause' | 'resume' | 'dismiss'): void {
  const api = jobs();
  const talker = overlay?.querySelector<HTMLElement>('[data-people-jobs]')?.getAttribute('data-people-jobs-talker') ?? '';
  if (kind === 'pause') {
    api.pauseJobs();
    notice('这一批做完就暂停', 'info');
    return;
  }
  if (kind === 'resume') {
    const who = talker || currentJobsItem()?.talker || '';
    if (!who) return;
    api.resume(who);
    notice('继续生成——已完成的批次不重画', 'info');
    return;
  }
  if (talker && api.removeJob(talker)) {
    notice('已删除该任务', 'delete');
    renderJobs();
  }
}

// ---------------- 折子印章四态接线（issue 451） ----------------

/** 引擎队列按 talker 索引（同人至多一个任务——引擎排队即替换） */
function jobViews(): Map<string, JobView> {
  const m = new Map<string, JobView>();
  for (const j of jobsCache?.queue ?? []) m.set(j.talker, j);
  return m;
}

/** 引擎任务 → 印章任务视图（百分比与进度块同源：render.jobsPercent / jobsStagesDone） */
function sealJobOf(job: JobView | undefined): FoldCardJob | null {
  if (!job) return null;
  return {
    status: job.status,
    batchesDone: job.batchesDone ?? 0,
    batchesTotal: job.batchesTotal ?? job.chunks?.length ?? 0,
    stagesDone: jobsStagesDone(job.stage, job.status),
    // 漂移类失败（消息集已变）接不上——印章改出「重新生成」
    resumable: job.error !== jobsApi.DRIFT_ERROR,
  };
}

/** 封面墙印章原位刷新（快照每帧都来；重建整墙会打断合并点选态与滚动位置，只换印章节点） */
function syncWallSeals(): void {
  const wall = overlay?.querySelector<HTMLElement>('[data-people-wall]');
  if (!wall) return;
  const map = jobViews();
  const byId = new Map(listCache.map((p) => [p.id, p]));
  for (const card of Array.from(wall.querySelectorAll<HTMLElement>('[data-people-card]'))) {
    const p = byId.get(card.dataset.peopleCard ?? '');
    const old = card.querySelector('.bz-people-seal');
    if (!p || !old) continue;
    old.replaceWith(foldSealNode(p, sealJobOf(map.get(p.id))));
  }
}

/**
 * 印章动作派发（451 四态的下一步）：暂停 / 继续生成 / 画脸谱·补画·重新生成。
 * draw 与 redraw 同一实现——都走预览桶素材单人生成，引擎 auto 判全量 / 增量 / 跳过。
 * 只认这四个 kind（不设兜底分支：认不出的 hook 不该顺手烧一次 AI）。
 */
async function sealAction(kind: string, id: string): Promise<void> {
  const api = jobs();
  if (kind === 'pause') {
    api.pauseJobs();
    notice('这一批做完就暂停', 'info');
    return;
  }
  if (kind === 'resume') {
    if (!api.resume(id)) { notice('这个任务接不上了，请重新生成', 'info'); return; }
    notice('继续生成——已完成的批次不重画', 'info');
    return;
  }
  if (kind === 'draw' || kind === 'redraw') await generateOne(id);
}

// ---------------- 事件委托 ----------------

function onOverlayClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  if (e.target === overlay) { closePeoplePanel(); return; }
  // —— 生成进度块动作（450：暂停 / 继续 / 删除任务；块根带 talker 钩子） ——
  if (t.closest('[data-people-jobs-pause]')) { jobsAction('pause'); return; }
  if (t.closest('[data-people-jobs-resume]')) { jobsAction('resume'); return; }
  if (t.closest('[data-people-jobs-dismiss]')) { jobsAction('dismiss'); return; }
  // —— 数据源弹窗（弹层在 body 之上，分支放前面；遮罩点击 = 关闭） ——
  if (t.closest('[data-people-ds-open]')) { void openDsIfIdle(); return; }
  if (t.closest('[data-people-ds-close]') || t.closest('[data-people-ds-dim]')) { closeDs(); return; }
  if (t.closest('[data-people-ds-scan]')) { void runScan(true); return; }
  if (t.closest('[data-people-ds-pickfresh]')) { pickFresh(); return; }
  if (t.closest('[data-people-ds-import]')) { void importDsSelected(); return; }
  if (t.closest('[data-people-ds-generate]')) { void generateFromDs(); return; }
  // 生成已后台化（450）：详情返回列表不再被生成阻塞
  if (t.closest('[data-people-back-btn]')) {
    stage = 'list'; detailId = null; detailFold = 'p';
    void renderBody();
    return;
  }
  // —— 详情「画脸谱」（仅未生成时出） ——
  if (t.closest('[data-people-generate-one]')) { void generateOne(detailId ?? undefined); return; }
  // —— 合并 / 删除（详情头图标工具条；合并回列表点选目标） ——
  const mergeBtn = t.closest<HTMLElement>('[data-people-merge]');
  if (mergeBtn) {
    mergeFromId = mergeBtn.dataset.peopleMerge || null;
    mergeToId = null;
    stage = 'list';
    detailId = null;
    detailFold = 'p';
    void renderBody();
    return;
  }
  if (t.closest('[data-people-merge-cancel]')) { mergeFromId = null; mergeToId = null; void renderBody(); return; }
  if (t.closest('[data-people-merge-confirm]')) { void handleMergeConfirm(); return; }
  const mergePick = mergeFromId ? t.closest<HTMLElement>('[data-people-card]') : null;
  if (mergePick) {
    // 合并模式：点其他折子 = 选目标；点自己这本不响应
    const id = mergePick.dataset.peopleCard || '';
    if (id && id !== mergeFromId) { mergeToId = id; void renderBody(); }
    return;
  }
  const del = t.closest<HTMLElement>('[data-people-del]');
  if (del) { void handleDelete(del.dataset.peopleDel ?? ''); return; }
  // —— 折子印章动作（451：四态各自可继续；放在合并点选之后、开人物详情之前——
  //    合并流程里点印章仍按卡片语义选目标，印章的出入由样式关掉） ——
  const seal = t.closest<HTMLElement>('[data-people-seal-act]');
  if (seal) {
    const id = seal.closest<HTMLElement>('[data-people-card]')?.dataset.peopleCard ?? '';
    if (id) void sealAction(seal.dataset.peopleSealAct ?? '', id);
    return;
  }
  // —— 折脊切换（详情页）：点收起折的头展开该折 ——
  const leafHead = t.closest<HTMLElement>('[data-people-leaf-head]');
  if (leafHead) {
    const id = leafHead.dataset.peopleLeafHead as FoldId | undefined;
    if (id && id !== detailFold) {
      detailFold = id;
      profEditId = null; // 切折退出编辑（编辑态内容不跨折保留）
      noteAddId = null;
      void renderBody();
    }
    return;
  }
  const card = t.closest<HTMLElement>('[data-people-card]');
  if (card) {
    detailId = card.dataset.peopleCard ?? null;
    detailFold = 'p';
    stage = 'detail';
    void renderBody();
    return;
  }
  // —— issue 439：档案与随手记（元素只在详情折内出现，属性名互不重叠） ——
  if (t.closest('[data-people-prof-new]') || t.closest('[data-people-prof-edit]')) { profEditId = detailId; void renderBody(); return; }
  if (t.closest('[data-people-prof-cancel]')) { profEditId = null; void renderBody(); return; }
  if (t.closest('[data-people-prof-save]')) { void saveProfile(); return; }
  if (t.closest('[data-people-prof-add-social]')) {
    overlay?.querySelector<HTMLElement>('[data-people-prof-social-list]')?.appendChild(socialRow('', ''));
    return;
  }
  if (t.closest('[data-people-prof-tag-add]')) { addTagChip(); return; }
  if (t.closest('[data-people-prof-tag-del]')) { t.closest('.bz-people-prof-tag')?.remove(); return; }
  if (t.closest('[data-people-prof-social-del]')) { t.closest('.bz-people-prof-social-row')?.remove(); return; }
  if (t.closest('[data-people-note-add]')) { noteAddId = detailId; void renderBody(); return; }
  if (t.closest('[data-people-note-cancel]')) { noteAddId = null; void renderBody(); return; }
  if (t.closest('[data-people-note-save]')) { void saveManualNote(); return; }
  const evDel = t.closest<HTMLElement>('[data-people-ev-del]');
  if (evDel) { void removeManualNote(evDel.dataset.peopleEvDel ?? ''); return; }
}

function onOverlayChange(e: Event): void {
  const el = e.target as HTMLInputElement;
  // —— 数据源联系人勾选（原位刷新页脚与行高亮，不重建列表） ——
  if (el.matches('[data-people-ds-check]')) {
    const name = el.dataset.peopleDsCheck ?? '';
    if (el.checked) dsSelected.add(name); else dsSelected.delete(name);
    updateDsFooter();
  }
}

/** 「勾有更新的」：一键勾上全部有新素材的单聊（弹窗内原位刷新） */
function pickFresh(): void {
  for (const c of dsContacts ?? []) {
    if (c.newCount > 0 && !c.isGroup) dsSelected.add(c.name);
  }
  syncDsChecks();
}

/** 弹窗勾选集合 → DOM 复选框 + 行高亮 + 页脚（原位） */
function syncDsChecks(): void {
  overlay?.querySelectorAll<HTMLInputElement>('[data-people-ds-check]').forEach((cb) => {
    const name = cb.dataset.peopleDsCheck ?? '';
    cb.checked = dsSelected.has(name);
    cb.closest('.bz-people-ds-row')?.classList.toggle('bz-people-ds-on', cb.checked);
  });
  updateDsFooter();
}

function updateDsFooter(): void {
  const sel = (dsContacts ?? []).filter((c) => dsSelected.has(c.name));
  const fresh = sel.reduce((s, c) => s + c.newCount, 0);
  const label = !sel.length
    ? '未勾选联系人'
    : fresh
      ? `已选 ${sel.length} 位 · 新素材 ${fresh} 条`
      : `已选 ${sel.length} 位 · 所选暂无新素材`;
  const count = overlay?.querySelector<HTMLElement>('[data-people-ds-count]');
  if (count) count.textContent = label;
  overlay?.querySelectorAll<HTMLInputElement>('[data-people-ds-check]').forEach((cb) => {
    cb.closest('.bz-people-ds-row')?.classList.toggle('bz-people-ds-on', cb.checked);
  });
}

// ---------------- 渲染分发 ----------------

async function renderBody(): Promise<void> {
  const body = overlay?.querySelector<HTMLElement>('[data-people-body]');
  if (!body || !store || !overlay) return;
  if (stage === 'list') await renderList(body);
  else await renderDetail(body);
  // 详情态版式类在渲染后按最终 stage 归位——renderDetail 里人物消失回落列表时不再残留详情版式
  overlay.querySelector('.bz-people-panel')?.classList.toggle('bz-people-panel-detail', stage === 'detail');
  renderDsLayer();
  renderJobs();
  mountIcons(overlay); // lucide 占位（头行/详情工具条/弹窗）→ SVG
}

/** 数据源弹层（独立容器；关着只置 hidden） */
function renderDsLayer(): void {
  const layer = overlay?.querySelector<HTMLElement>('[data-people-ds-layer]');
  if (!layer) return;
  layer.hidden = !dsOpen;
  layer.replaceChildren();
  if (dsOpen) layer.appendChild(dsModal(dsModalState()));
}

// ---------------- 列表（折子封面墙） ----------------

async function renderList(body: HTMLElement): Promise<void> {
  const people = store ? await store.list() : [];
  const statsEl = overlay?.querySelector<HTMLElement>('[data-people-stats]');
  if (statsEl) statsEl.textContent = statsText(people);
  listCache = people;
  body.replaceChildren();
  if (!people.length) {
    body.appendChild(wallEmpty());
    return;
  }
  const from = mergeFromId ? people.find((x) => x.id === mergeFromId) : null;
  if (mergeFromId && !from) { mergeFromId = null; mergeToId = null; } // 人已删，流程自愈回落
  else if (from) {
    const to = mergeToId && mergeToId !== mergeFromId ? people.find((x) => x.id === mergeToId) : null;
    body.appendChild(mergeBar(from.name, to?.name ?? null));
  }
  const wall = foldWall();
  applyWall(people, wall);
  body.appendChild(wall);
}

async function handleDelete(id: string): Promise<void> {
  if (deleteArmId !== id) {
    disarmDelete();
    deleteArmId = id;
    deleteArmTimer = setTimeout(() => { disarmDelete(); void renderBody(); }, 3000);
    void renderBody();
    return;
  }
  disarmDelete();
  if (!store) return;
  try {
    await store.remove(id);
    if (detailId === id) { detailId = null; stage = 'list'; }
    notice('已删除', 'delete');
  } catch (e) {
    notifyActionError(e, '删除脸谱');
  }
  void renderBody();
}

function disarmDelete(): void {
  deleteArmId = null;
  if (deleteArmTimer) clearTimeout(deleteArmTimer);
  deleteArmTimer = null;
}

// ---------------- 详情（折页册） ----------------

async function renderDetail(body: HTMLElement): Promise<void> {
  const people = store ? await store.list() : [];
  const statsEl = overlay?.querySelector<HTMLElement>('[data-people-stats]');
  if (statsEl) statsEl.textContent = statsText(people);
  const p = people.find((x) => x.id === detailId);
  body.replaceChildren();
  if (!p) { stage = 'list'; await renderList(body); return; }
  const media = personMedia(p);
  body.appendChild(foldDetailHead(p, media, { canGenerate: !p.digest }));

  // 五折：展开折渲染正文，收起折只渲染竖排引文
  const spillOf = (md: string): string => {
    const t = String(md ?? '')
      .replace(/```+/g, '')
      .split(/\r?\n/)
      .map((l) => l.replace(/^#{1,6}\s*/, '').replace(/^>\s?/, '').replace(/^-\s*/, '').replace(/\*\*/g, '').trim())
      .filter(Boolean)
      .join(' ');
    return [...t].length <= 40 ? t : `${[...t].slice(0, 40).join('')}…`;
  };
  const hint = (msg: string, action?: string): HTMLElement => {
    const d = document.createElement('div');
    d.className = 'bz-people-empty-hint';
    d.textContent = msg;
    if (action) {
      // 空态内联动作钮：复用数据源弹窗钩子，用户不用自己找右上角入口（448 评审 P2）
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bz-people-btn bz-people-btn-ghost';
      b.setAttribute('data-people-ds-open', '');
      b.textContent = action;
      d.appendChild(document.createElement('br'));
      d.appendChild(b);
    }
    return d;
  };
  const quoteOf: Record<FoldId, string> = {
    p: p.digest?.portrait ? spillOf(p.digest.portrait) : '还没有脸谱。从数据源导入一次即可生成。',
    e: p.digest?.events.length
      ? spillOf(p.digest.events[0].summary)
      : (p.manualEvents?.length ? spillOf(p.manualEvents[0].summary) : '还没有交往事件与随手记。'),
    c: p.digest?.chronicle ? spillOf(p.digest.chronicle) : '还没有关系时间线。',
    d: p.imports.length ? `最近导入 ${p.imports.length} 次` : '还没有导入记录。',
    f: (p.profile?.tags ?? []).filter(Boolean).length ? (p.profile?.tags ?? []).filter(Boolean).join(' · ') : '聊天之外的也可以记。',
  };
  const bodies: Record<FoldId, HTMLElement[]> = {
    p: detailFold === 'p'
      ? foldPortraitBody(p.digest?.portrait ? miniMarkdown(p.digest.portrait) : hint('还没有脸谱。从数据源导入一次即可生成。', '打开数据源'), p)
      : [],
    e: detailFold === 'e' ? foldEventsBody(p, noteAddId === p.id, todayStr()) : [],
    c: detailFold === 'c' ? foldChronicleBody(p.digest?.chronicle ? miniMarkdown(p.digest.chronicle) : null) : [],
    d: detailFold === 'd' ? foldDataBody(buildInsightsCard(p), p) : [],
    f: detailFold === 'f' ? foldProfileBody(p, profEditId === p.id) : [],
  };
  body.appendChild(foldBook(p, { fold: detailFold, media, profEdit: profEditId === p.id, noteAdd: noteAddId === p.id }, bodies, quoteOf));
}

// ---------------- 互动数据（issue 440：纯本地统计展示；447 收进「数据」折） ----------------

/** 数据折互动卡：只展示最近一次导入的统计；旧数据无 stats 时返回 null（foldDataBody 出占位） */
function buildInsightsCard(p: PersonEntry): HTMLElement | null {
  if (!p.imports.length) return null;
  const latest = [...p.imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
  if (!latest.stats) return null;
  const s = latest.stats;
  const totalMsg = s.monthly.reduce((a, [, n]) => a + n, 0);
  const rows = document.createElement('div');
  rows.className = 'bz-people-ins-rows';
  // 谁主动：会话发起占比条 + 数字
  const initiated = s.initiatedByMe + s.initiatedByOther;
  rows.appendChild(insRow('谁主动', initiated
    ? duoBar(Math.round((s.initiatedByMe / initiated) * 100), Math.round((s.initiatedByOther / initiated) * 100))
    : duoBar(0, 0), initiated ? `我 ${s.initiatedByMe} · 对方 ${s.initiatedByOther}` : '暂无会话'));
  // 回复时延（issue 449）：优先中位数（更抗刷屏失真），旧数据无中位数字段回落平均
  rows.appendChild(insRow('回复时延', '', `我 ${formatReplySec(replyLatencySec(s.myMedianReplySec, s.myAvgReplySec))} · 对方 ${formatReplySec(replyLatencySec(s.otherMedianReplySec, s.otherAvgReplySec))}`));
  // 活跃时段：双方合计的 24 小时分布
  const hourly = s.myHourly.map((n, i) => n + (s.otherHourly[i] ?? 0));
  const max = Math.max(...hourly);
  const total = hourly.reduce((a, n) => a + n, 0);
  const strip = el('div', 'bz-people-strip', hourly.map((n, i) => {
    const h = max > 0 && n > 0 ? Math.max(Math.round((n / max) * 100), 6) : 0;
    return el('div', 'bz-people-strip-bar', { style: `height:${h}%`, title: `${i} 点 · ${n} 条` });
  }));
  rows.appendChild(insRow('活跃时段', strip, total ? `峰值 ${hourly.indexOf(max)} 点` : '—'));
  // 形态占比
  const kinds = Object.entries(s.kindCounts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (kinds.length) rows.appendChild(insRow('消息形态', kindChips(kinds), ''));
  return insightsCard(importMeta(latest, totalMsg), latest.file, monthlyChart(s.monthly), rows);
}

function insRow(label: string, mid: HTMLElement | string, val: string): HTMLElement {
  return el('div', 'bz-people-ins-row', [
    el('span', 'bz-people-ins-label', text(label)),
    typeof mid === 'string' ? textEl('span', '') : mid,
    el('span', 'bz-people-ins-val', text(val)),
  ]);
}

// ---------------- 卡墙（448：排序固定最近互动，筛选/搜索退役） ----------------

/** 人物媒体统计：跨导入累计（零素材返回 null——徽章空数据不渲染） */
export function personMedia(p: PersonEntry): MediaStats | null {
  const acc = emptyMediaStats();
  for (const r of p.imports) {
    const s = r.stats;
    if (!s) continue;
    acc.voiceCount += s.voiceCount ?? 0;
    acc.voiceTotalSec += s.voiceTotalSec ?? 0;
    acc.imageCount += s.imageCount ?? 0;
  }
  return acc.voiceCount || acc.imageCount ? acc : null;
}

/** 封面墙排序（448：工具条退役，固定最近互动优先；无导入记录按建卡时间兜底） */
function sortPeople(list: PersonEntry[]): PersonEntry[] {
  const lastSeen = (p: PersonEntry) => p.imports.reduce((m, r) => (r.timeTo > m ? r.timeTo : m), '');
  return [...list].sort((a, b) => (lastSeen(b) || b.createdAt).localeCompare(lastSeen(a) || a.createdAt));
}

/** 按最近互动排序刷封面墙（merge 状态也在这里反映为卡片样式） */
function applyWall(people: PersonEntry[], wall: HTMLElement): void {
  wall.replaceChildren();
  const map = jobViews();
  for (const p of sortPeople(people)) {
    wall.appendChild(foldCard(p, {
      media: personMedia(p),
      mergeFrom: p.id === mergeFromId,
      mergePick: Boolean(mergeFromId) && p.id !== mergeFromId,
      job: sealJobOf(map.get(p.id)), // 451：印章四态（任务态压过脸谱水位）
    }));
  }
}

// ---------------- 合并重复人物（issue 442） ----------------

async function handleMergeConfirm(): Promise<void> {
  const fromId = mergeFromId;
  const toId = mergeToId;
  if (!store || !fromId || !toId || fromId === toId) return;
  const from = listCache.find((x) => x.id === fromId);
  const to = listCache.find((x) => x.id === toId);
  try {
    await store.mergeInto(fromId, toId);
    notice(`已把「${from?.name ?? fromId}」的导入记录与随手记并到「${to?.name ?? toId}」，原人物已删除。要更新脸谱可从数据源补画`, 'success');
  } catch (e) {
    notifyActionError(e, '合并人物');
  }
  mergeFromId = null;
  mergeToId = null;
  void renderBody();
}

// ---------------- 档案与随手记（issue 439） ----------------
// 手动输入路径：档案落盘走 store.updateProfile，随手记走 store.addManualEvent /
// removeManualEvent；显式保存按钮写盘，不随 input 落盘。

/** 编辑态 / 记一笔态只对当前人物生效（换人即自然退出；面板关闭在 closePeoplePanel 一并重置） */
let profEditId: string | null = null;
let noteAddId: string | null = null;

function addTagChip(): void {
  const input = overlay?.querySelector<HTMLInputElement>('[data-people-prof-tag-input]');
  const list = overlay?.querySelector<HTMLElement>('[data-people-prof-tag-list]');
  const v = (input?.value ?? '').trim();
  if (!input || !list || !v) return;
  const dupes = new Set(
    Array.from(list.querySelectorAll('.bz-people-prof-tag-text')).map((n) => (n.textContent ?? '').trim())
  );
  if (!dupes.has(v)) list.appendChild(tagChip(v));
  input.value = '';
  input.focus();
}

/** 读编辑卡全量输入 → updateProfile；整卡为空 = 清档案（落盘 undefined） */
async function saveProfile(): Promise<void> {
  if (!store || !detailId || !overlay) return;
  const val = (sel: string) => overlay!.querySelector<HTMLInputElement>(sel)?.value?.trim() ?? '';
  const rows = Array.from(overlay.querySelectorAll('.bz-people-prof-social-row'));
  const socials = rows
    .map((row) => ({
      platform: row.querySelector<HTMLInputElement>('[data-people-prof-social-platform]')?.value?.trim() ?? '',
      handle: row.querySelector<HTMLInputElement>('[data-people-prof-social-handle]')?.value?.trim() ?? '',
    }))
    .filter((s) => s.platform && s.handle);
  const partial = rows.length - socials.length;
  const tagTexts = Array.from(overlay.querySelectorAll('[data-people-prof-tag-list] .bz-people-prof-tag-text'))
    .map((n) => (n.textContent ?? '').trim())
    .filter(Boolean);
  const tags = [...new Set(tagTexts)];
  const profile: PersonProfile = {};
  const f = {
    birthday: val('[data-people-prof-field="birthday"]'),
    metVia: val('[data-people-prof-field="metVia"]'),
    metAt: val('[data-people-prof-field="metAt"]'),
    hometown: val('[data-people-prof-field="hometown"]'),
    job: val('[data-people-prof-field="job"]'),
    note: val('[data-people-prof-field="note"]'),
  };
  if (f.birthday) profile.birthday = f.birthday;
  if (f.metVia) profile.metVia = f.metVia;
  if (f.metAt) profile.metAt = f.metAt;
  if (f.hometown) profile.hometown = f.hometown;
  if (f.job) profile.job = f.job;
  if (f.note) profile.note = f.note;
  if (socials.length) profile.socials = socials;
  if (tags.length) profile.tags = tags;
  const empty = !socials.length && !tags.length && !Object.keys(profile).length;
  try {
    await store.updateProfile(detailId, empty ? undefined : profile);
    profEditId = null;
    notice(empty ? '档案已清空' : '档案已保存', 'success');
    if (partial > 0) notice(`${partial} 行社交账号没填完整，已跳过`, 'warning');
  } catch (e) {
    notifyActionError(e, '保存档案');
  }
  void renderBody();
}

async function saveManualNote(): Promise<void> {
  if (!store || !detailId || !overlay) return;
  const summary = overlay.querySelector<HTMLInputElement>('[data-people-note-text]')?.value?.trim() ?? '';
  if (!summary) { notice('随手记还没写内容', 'warning'); return; }
  const ts = overlay.querySelector<HTMLInputElement>('[data-people-note-date]')?.value?.trim() || todayStr();
  try {
    await store.addManualEvent(detailId, { id: genId(), ts, summary, createdAt: new Date().toISOString() });
    noteAddId = null;
    notice('已记一笔', 'success');
  } catch (e) {
    notifyActionError(e, '记随手记');
  }
  void renderBody();
}

async function removeManualNote(evId: string): Promise<void> {
  if (!store || !detailId || !evId) return;
  try {
    // notice 带内容摘要：手动录入不可再生，误删至少要有感（448 评审 P2 最小改动档）
    const found = (await store.list()).find((p) => p.id === detailId)?.manualEvents?.find((m) => m.id === evId);
    await store.removeManualEvent(detailId, evId);
    const brief = found?.summary ? `：${[...found.summary].slice(0, 20).join('')}${[...found.summary].length > 20 ? '…' : ''}` : '';
    notice(`已删除随手记${brief}`, 'delete');
  } catch (e) {
    notifyActionError(e, '删除随手记');
  }
  void renderBody();
}

/** 本地日期 YYYY-MM-DD（随手记默认值；FaceEvent.ts 同构） */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 随手记 id：优先 crypto.randomUUID，降级时间戳+随机串 */
function genId(): string {
  const c = typeof crypto !== 'undefined' ? (crypto as unknown as { randomUUID?: () => string }) : null;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
