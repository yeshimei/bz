/**
 * 脸谱面板行为层（issue 447 / ADR-0106）：markup 全部出自 render.ts（折子语义单源），
 * 本文件只做生命周期 / 事件委托 / 数据流。
 *
 * 视图：list（折子封面墙）/ detail（折页册：其人/我们/事件/时间线四折，issue 455 双卷拆折；
 * 数据统计与补充背景改独立弹窗，入口在详情头返回钮前）+
 * 数据源独立弹窗（447 拍板：默认不打开、打开即扫、默认不勾选、四态水位、
 * 「导入所选」只进聊天仓、「画脸谱」关弹窗回面板跑生成）。
 * 文件向导已退役（447）：bz-people-import 命令改开数据源弹窗；聊天原文只在本层内存流转
 * （ADR-0191），聊天仓只落标签化文本。
 *
 * 生成链（issue 450 / 451）：本层不再内联跑生成循环——组装 targets 交给 jobs.ts 生成引擎
 * （模块级单例，独立于面板生命周期），面板只订阅快照渲染进度块；done 产物在本层
 * 落 people.json（PeopleStore / ImportRecord 口径沿用 446 收编形态）。关面板转后台，
 * 重开面板 snapshot+resume 渲染当前任务态，中断任务出「继续生成」。
 * 451：折子封面卡的印章升级为四态（未画谱 / 画谱中 / 画谱中断 / 已画谱）且本身就是动作入口
 * （画脸谱 / 暂停 / 继续生成 / 补画），快照每帧原位只换印章节点。
 * 452：墙成员 = 人物卡 ∪ 聊天仓联系人——「导入过素材但没画过」的人也要以「待画」折子上墙
 * （合成占位卡纯内存零写盘；占位卡上写档案 / 随手记前先 ensureEntry 落一张空卡）。
 */
import { notice, notifyActionError } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { getApp } from '../core/app';
import { PeopleStore } from './data';
import { extractJsonLoose } from './digest';
import { createAI } from '../core/ai';
import { mergeManualEvents, planIncremental } from './incremental';
import { emptyMediaStats, formatMediaCount, type MediaStats } from './media';
import { computeStats, formatReplySec } from './stats';
import * as jobsApi from './jobs';
import type { JobStartOptions, JobTarget, JobView, JobsSnapshot as EngineSnapshot } from './jobs';
import type { ContactStats, FaceDigest, ImportRecord, PersonEntry, PersonProfile, UnifiedMessage } from './types';
import { bondOf, personOf } from './types';
import {
  MessageStore,
  importAvatarToVault,
  isGroupChat,
  isVaultRelativePath,
  listContactDirs,
  mergeStore,
  normalizeChatJson,
  normalizeOptionsFromSettings,
  storeMediaBadge,
  storeToUnified,
  readContactBundle,
  type MessageStoreData,
  type StoreContact,
  type StoreStats,
} from './datasource';
import {
  dsModal,
  duoBar,
  foldBondBody,
  foldBook,
  foldCard,
  foldEventsBody,
  foldDetailHead,
  foldPersonBody,
  foldSealNode,
  foldWall,
  importMeta,
  insightsCard,
  kindChips,
  mergeBar,
  miniMarkdown,
  monthlyChart,
  noteAddRow,
  panelShell,
  popShell,
  profilePopBody,
  progressBlock,
  replyLatencySec,
  socialRow,
  statsPopBody,
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
  /** 目录名（即聊天仓键 / PersonEntry.id） */
  name: string;
  rawCount: number;
  isGroup: boolean;
  /** 归一化后的时间线口径统计（按当前聊天仓开关） */
  stats: StoreStats;
  /** 聊天仓已有条数（全量原始消息口径） */
  previewCount: number;
  /** 扫描时发现的新消息条数（原始 keys − 仓内 keys） */
  newCount: number;
  /** 已画到的提炼锚点（PersonEntry.lastProcessedTs） */
  processedTs: number | null;
  /** 头像文件绝对路径（数据目录 avatar.<ext>；无则 null） */
  avatar: string | null;
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

// ---------------- 统计 / 档案弹窗（issue 455：自折册改独立弹窗，同时只开一只） ----------------

/** 「互动统计」弹窗开着（详情头图标 / Esc / 遮罩关闭） */
let statsOpen = false;
/** 「补充背景」弹窗开着（编辑态仍由 profEditId 管，宿主从折册换成弹窗） */
let profOpen = false;
/** 「记一笔」独立弹窗开着（455 评审：随手记自纪事折抽出，入口进详情头工具条） */
let noteOpen = false;

/** 开统计弹窗（另一只开着则换页） */
function openStatsPop(): void {
  statsOpen = true;
  profOpen = false;
  noteOpen = false;
  void renderBody();
}

/** 开补充背景弹窗（另一只开着则换页） */
function openProfPop(): void {
  profOpen = true;
  statsOpen = false;
  noteOpen = false;
  void renderBody();
}

/** 开记一笔弹窗（另一只开着则换页） */
function openNotePop(): void {
  noteOpen = true;
  statsOpen = false;
  profOpen = false;
  void renderBody();
}

/** 关掉统计 / 档案弹窗（都不开着则免渲染） */
function closePops(): void {
  if (!statsOpen && !profOpen && !noteOpen) return;
  statsOpen = false;
  profOpen = false;
  noteOpen = false;
  void renderBody();
}

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
  // ESC 分层（448 评审；455 弹窗再加一层）：统计/档案弹窗最上先关，其次数据源弹窗（保扫描快照与勾选），再层层关面板
  registerPanelEsc(ESC_ID, isPeopleOpen, () => {
    if (statsOpen || profOpen) closePops();
    else if (dsOpen) closeDs();
    else closePeoplePanel();
  });
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
  storeCache = null; // 452：聊天仓缓存随面板关闭失效（下次打开重读，导入在别的会话改过也能看到）
  mergeFromId = null;
  mergeToId = null;
  profEditId = null; // 编辑态不随面板存续（评审 P1-2：重开面板不落回编辑态）
  noteAddId = null;
  statsOpen = false; // 455：统计 / 档案 / 记一笔弹窗同样不随面板存续
  profOpen = false;
  noteOpen = false;
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

/** 生成进行中不开弹窗：导入会动聊天仓，正在跑的任务指纹会漂移判废（450 沿用 447 守卫） */
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
    const badge = storeMediaBadge(c.stats);
    return {
      name: c.name,
      rawCount: c.rawCount,
      isGroup: c.isGroup,
      media: badge ? formatMediaCount(badge) : '',
      previewCount: c.previewCount,
      newCount: c.newCount,
      processedTs: c.processedTs,
      avatar: c.avatar,
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
 * 扫描数据源：列目录 → 逐人读 chat.json 归一化 → 对照聊天仓算新素材 → 落快照
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
    const msgStore = new MessageStore(getApp());
    const [storeData, people] = await Promise.all([msgStore.read(), store.list()]);
    for (const name of dirNames) {
      if (!overlay) return; // 面板已关，放弃本次扫描
      const bundle = readContactBundle(dataDir, name);
      if (!bundle) continue;
      const group = isGroupChat(bundle.raws);
      if (group && !includeGroups) { hidden++; continue; }
      const norm = normalizeChatJson(bundle.raws, opts, { voice: bundle.voice, imageDesc: bundle.imageDesc });
      const pv = storeData.contacts[name];
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
        // 头像入库（456）：外部文件复制进库内媒体文件夹，列表/详情才加载得出来
        avatar: await importAvatarToVault(getApp(), name, bundle.avatar),
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
 * 导入所选（第一段：原始→聊天仓增量）：逐人读 chat.json → normalizeChatJson → mergeStore
 * upsert 合并（同键覆盖升级）→ 落 people-preview.json。完成后弹窗出「画脸谱」（447 拍板：不自动生成）。
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
  dsNotice = '正在导入聊天仓…';
  renderBody();
  const opts = normalizeOptionsFromSettings();
  const msgStore = new MessageStore(getApp());
  const now = new Date().toISOString();
  const addedOf = new Map<string, number>();
  const readFail: string[] = [];
  try {
    for (const c of chosen) {
      if (!overlay) return; // 面板已关，中止
      const bundle = readContactBundle(dataDir, c.name);
      if (!bundle) { readFail.push(c.name); continue; }
      const norm = normalizeChatJson(bundle.raws, opts, { voice: bundle.voice, imageDesc: bundle.imageDesc });
      const existing = (await msgStore.read()).contacts[c.name];
      const { contact, added } = mergeStore(existing, norm, now);
      // 头像入库（456）：复制进库内媒体文件夹后存 vault 相对路径；外部文件删了导入后即清
      const ava = await importAvatarToVault(getApp(), c.name, bundle.avatar);
      if (ava) contact.avatar = ava;
      else delete contact.avatar;
      await msgStore.upsertContact(c.name, contact);
      addedOf.set(c.name, added);
      // 快照同步（水位行即时反映，不重扫）
      c.previewCount = contact.msgs.length;
      c.newCount = 0;
      c.stats = contact.stats;
    }
  } catch (e) {
    console.warn('[people] 聊天仓导入失败:', e);
    dsNotice = '导入失败：读数据文件时出错。';
    dsImporting = false;
    renderBody();
    return;
  }
  dsImporting = false;
  storeCache = null; // 452：聊天仓已变——刚导入的人立刻以「待画」折子上墙
  const fresh = [...addedOf.values()].reduce((s, n) => s + n, 0);
  const summary = `已导入（新增 ${fresh} 条）${readFail.length ? ` · ${readFail.length} 位读文件失败` : ''}`;
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
    const storeData = await new MessageStore(getApp()).read();
    for (const name of names) {
      const pv = storeData.contacts[name];
      const unified = storeToUnified(pv?.msgs ?? []);
      if (!unified.length) continue;
      targets.push({
        talker: name,
        name,
        msgs: unified,
        kindCounts: pv.kindCounts ?? {},
        skippedCount: 0, // 仓内时间线全是有效文本；原始过滤数已计入 chat.json 口径，不在导入记录重复报
        fileLabel: `数据源:${name}`,
        insights: pv.insights,
      });
    }
  } catch (e) {
    console.warn('[people] 读取聊天仓失败:', e);
    dsNotice = '生成失败：读不到聊天仓。';
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
 * 用聊天仓里该人物的消息素材单人生成，交引擎后台跑，进度走面板进度块。
 * 还没有预览素材时提示先走数据源导入。
 *
 * issue 453：**先看有没有可续任务**——中断 / 失败 / 暂停的人直接续跑，绝不走 startJobs。
 * 这是覆盖所有入口的那道闸（详情头按钮、印章的「画脸谱 / 补画」都从这里出去）：error 态下
 * `jobsBusy()` 为 false，过去会一路走到 startJobs 的整体替换 = 从第 1 批重烧 AI。
 * `force` 供「重新生成」用（消息集已变、断点接不上时，用户明确要求从头重画）。
 */
async function generateOne(id?: string, opts: { force?: boolean } = {}): Promise<void> {
  const name = id ?? detailId;
  if (!store || !name) return;
  if (!opts.force && resumeExisting(name)) return;
  if (jobsBusy()) { notice('已有生成在进行——等它完成或暂停后再画', 'info'); return; }
  let target: GenTarget | null = null;
  try {
    const pv = (await new MessageStore(getApp()).read()).contacts[name];
    const unified = storeToUnified(pv?.msgs ?? []);
    if (unified.length) {
      target = {
        talker: name,
        name,
        msgs: unified,
        kindCounts: pv.kindCounts ?? {},
        skippedCount: 0,
        fileLabel: `数据源:${name}`,
        insights: pv.insights,
      };
    }
  } catch (e) {
    console.warn('[people] 读取聊天仓失败:', e);
  }
  if (!target) { notice('还没有可画的消息素材——点右上「数据源」导入后再画', 'warning'); return; }
  await startGeneration([target]);
}

/**
 * 该人有未完成任务（非 running / 非 done）就直接续跑，返回是否接手（issue 453）。
 * `resume` 不受理 = 漂移判废（消息集已变，断点接不上）——**不偷偷重烧**：
 * 明确告知，要重来由用户点印章上的「重新生成」（那条路带 force）。
 */
function resumeExisting(name: string): boolean {
  const pending = (jobsCache?.queue ?? []).find((j) => j.talker === name);
  if (!pending || pending.status === 'running' || pending.status === 'done') return false;
  if (jobs().resume(name)) {
    notice(`「${name}」从第 ${pending.batchesDone + 1} 批继续——已完成的 ${pending.batchesDone} 批不重画`, 'info');
    return true;
  }
  notice(`「${name}」的消息集已变，断点接不上——点印章上的「重新生成」会从头重画`, 'warning');
  return true;
}

// ---------------- 生成引擎接线（issue 450：引擎化 + 后台化 + 断点续跑） ----------------

/** 生成目标（引擎 JobTarget 同形；msgs 必须是全量时间线消息——引擎断点续跑要重读校验指纹） */
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
  /** 聊天仓侧写里的互动统计汇总（issue 449；旧数据可能没有）→ 引擎拼互动统计叙述段喂画像与时间线 */
  insights?: StoreContact['insights'];
  /** 手动档案（issue 455）：planTargets 从人物卡带上 → 引擎拼「档案」素材段进两卷 prompt 头 */
  profile?: PersonProfile;
  /** 跨导入合并的月度密度（issue 455）：planTargets 从导入记录 stats 现算 → buildStatsNote 月度段 */
  monthly?: Array<[string, number]>;
}

/**
 * 跨导入月度密度合并（issue 455）：各导入记录 stats.monthly 同名月相加，按月升序；
 * 没有任何明细（旧数据 / 合成占位卡）返回 undefined——引擎侧不拼月度段。
 */
export function mergedMonthlyOf(imports: Array<{ stats?: Partial<ContactStats> }>): Array<[string, number]> | undefined {
  const acc = new Map<string, number>();
  for (const r of imports) {
    for (const [month, n] of r.stats?.monthly ?? []) acc.set(month, (acc.get(month) ?? 0) + n);
  }
  if (!acc.size) return undefined;
  return [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * 生成引擎（jobs.ts）的 ui 消费面——模块本体天然满足；测试经 setJobsModuleForTests 注入假件
 * （测试域避免 vi.mock，与 obsidian alias 同一思路：注入缝比模块 mock 稳）。
 */
export interface JobsApi {
  startJobs(app: unknown, targets: JobTarget[], opts?: JobStartOptions): Promise<{ queued: string[]; skipped: string[]; resumed: string[] }>;
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
    } else if (!jobsPersisted.has(job.talker) && job.person) {
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
  let resumed: string[] = [];
  if (runnable.length) {
    const res = await jobs().startJobs(getApp(), runnable, {}); // mode 缺省 auto：引擎逐人按增量计划判定
    engineSkipped = res.skipped.length;
    resumed = res.resumed ?? [];
    await ensureJobsWatch();
  }
  const started = runnable.length - engineSkipped;
  const fresh = Math.max(0, started - resumed.length);
  const parts: string[] = [];
  if (fresh > 0) parts.push(`已开始生成 ${fresh} 张脸谱（后台进行，可关面板）`);
  if (resumed.length) parts.push(`${resumed.join('、')} 接着上次没画完的批次继续（已完成的不重烧）`);
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
    // issue 455：档案与跨导入月度密度在这里带上（statsNote 组装在引擎内，入参经 JobTarget 传入）
    runnable.push({ ...t, profile: existing?.profile, monthly: mergedMonthlyOf(existing?.imports ?? []) });
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
    // issue 455 双卷：卷一《其人》为必达产物（旧落盘 portrait 已由引擎 resumeJobs 读入时映射成 person）
    const person = job.person;
    if (!person) { notice(`「${name}」生成完成但其人画像为空`, 'warning'); return; }
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
      person, // 卷一《其人》
      bond: job.bond || undefined, // 卷二《我们》（旧引擎无此产物）
      events: mergeManualEvents(job.events ?? [], existing?.manualEvents), // 439：手动随手记并入事件素材
      quotes: job.quotes,
      moments: job.material?.moments, // 449：场景 / 特质随生成落盘
      traits: job.material?.traits,
      chronicle: job.chronicle || undefined,
      generatedAt: now,
    };
    await store.setDigest(talker, digest);
    // 锚点写回：已提炼过的最大消息时间戳（计划内末条；重启续跑的任务用引擎落盘的导入跨度末点——
    // 466 起指纹是内容哈希、解不出 ts——缺了不动锚点）
    const lastTs = msgs ? msgs[msgs.length - 1].ts : Date.parse(job.importRecord?.timeTo ?? '');
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
  // 455 评审：进度块只在「生成中那个人」的详情页显示（done 不再展示——完成时有通知），
  // 封面墙与其他联系人详情不再被进度 / 报错糊脸；折子印章的状态环照常跟帧。
  const show = Boolean(item && item.status !== 'done' && stage === 'detail' && detailId === item.talker);
  if (show && item) {
    slot.hidden = false;
    slot.replaceChildren(progressBlock(toBlockState(item)));
  } else {
    slot.hidden = true;
    slot.replaceChildren();
  }
  overlay?.querySelector('.bz-people-panel')?.classList.toggle('bz-people-jobs-showing', show);
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
    resumable: isResumable(job),
  };
}

/** 失败态能否断点续跑（issue 453）：漂移判废（消息集已变）接不上——印章与进度块共用同一判定 */
function isResumable(job: JobView): boolean {
  return job.error !== jobsApi.DRIFT_ERROR;
}

/** 有无活跃任务（运行中 / 排队或已暂停）：数据源导入类守卫用它（导入会动聊天仓 → 指纹漂移判废） */
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
    resumable: isResumable(job),
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
 * draw 与 redraw 同一实现——都走聊天仓素材单人生成，引擎 auto 判全量 / 增量 / 跳过。
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
    const pending = (jobsCache?.queue ?? []).find((j) => j.talker === id);
    if (!api.resume(id)) { notice('这个任务接不上了，请点「重新生成」', 'info'); return; }
    notice(pending
      ? `「${id}」从第 ${pending.batchesDone + 1} 批继续——已完成的 ${pending.batchesDone} 批不重画`
      : '继续生成——已完成的批次不重画', 'info');
    return;
  }
  // draw（未画谱）/ redraw（补画 · 重新生成）都走 generateOne：它内部先认可续任务；
  // redraw 带 force 才能越过那道闸——漂移判废时用户要的正是从头重画（印章文案也这么说）
  if (kind === 'draw') await generateOne(id);
  else if (kind === 'redraw') await generateOne(id, { force: true });
}

// ---------------- 事件委托 ----------------

function onOverlayClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  if (e.target === overlay) { closePeoplePanel(); return; }
  // —— 生成进度块动作（450：暂停 / 继续 / 删除任务；块根带 talker 钩子） ——
  if (t.closest('[data-people-jobs-pause]')) { jobsAction('pause'); return; }
  if (t.closest('[data-people-jobs-resume]')) { jobsAction('resume'); return; }
  if (t.closest('[data-people-jobs-dismiss]')) { jobsAction('dismiss'); return; }
  // —— 统计 / 档案弹窗（455：弹层在 body 之上，分支放前面；遮罩与关闭钮同一关闭钩子） ——
  if (t.closest('[data-people-stats-open]')) { openStatsPop(); return; }
  if (t.closest('[data-people-prof-open]')) { openProfPop(); return; }
  if (t.closest('[data-people-pop-close]')) { closePops(); return; }
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
  // —— 事件折月组开合：就地切类，不重渲染 ——
  const evMonHead = t.closest<HTMLElement>('[data-people-ev-mon]');
  if (evMonHead) {
    const group = evMonHead.closest<HTMLElement>('.bz-people-ev-mon');
    if (group) {
      const on = group.classList.toggle('bz-people-ev-mon-on');
      evMonHead.setAttribute('aria-label', `${on ? '收起' : '展开'} ${evMonHead.querySelector('.bz-people-ev-mon-name')?.textContent ?? ''}`);
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
  if (t.closest('[data-people-prof-ai]')) { void aiFillProfile(); return; }
  if (t.closest('[data-people-prof-add-social]')) {
    overlay?.querySelector<HTMLElement>('[data-people-prof-social-list]')?.appendChild(socialRow('', ''));
    return;
  }
  if (t.closest('[data-people-prof-tag-add]')) { addTagChip(); return; }
  if (t.closest('[data-people-prof-tag-del]')) { t.closest('.bz-people-prof-tag')?.remove(); return; }
  if (t.closest('[data-people-prof-social-del]')) { t.closest('.bz-people-prof-social-row')?.remove(); return; }
  if (t.closest('[data-people-note-open]')) { openNotePop(); return; }
  if (t.closest('[data-people-note-cancel]')) { noteOpen = false; void renderBody(); return; }
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
  const people = await wallPeople(); // 一次拉全量：列表 / 详情 / 弹窗三处同源（455 弹窗正文也要人物卡）
  // await 途中面板可能被关（closePeoplePanel 置空 overlay/store）——late 回调不得再触碰已拆 DOM
  if (!overlay || !store) return;
  if (stage === 'list') await renderList(body, people);
  else await renderDetail(body, people);
  // 详情态版式类在渲染后按最终 stage 归位——renderDetail 里人物消失回落列表时不再残留详情版式
  overlay.querySelector('.bz-people-panel')?.classList.toggle('bz-people-panel-detail', stage === 'detail');
  renderDsLayer();
  renderPopLayer(people);
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

/**
 * 统计 / 档案弹层（issue 455，独立容器；关着只置 hidden）。
 * 弹窗跟着详情人物走：人物没了（被删 / 回列表）弹窗自愈收起；补充背景的编辑态由 profEditId 决定。
 */
function renderPopLayer(people: PersonEntry[]): void {
  const layer = overlay?.querySelector<HTMLElement>('[data-people-pop-layer]');
  if (!layer) return;
  const p = statsOpen || profOpen || noteOpen ? people.find((x) => x.id === detailId) : null;
  if (!p) {
    statsOpen = false;
    profOpen = false;
    noteOpen = false;
    layer.hidden = true;
    layer.replaceChildren();
    return;
  }
  layer.hidden = false;
  layer.replaceChildren(
    statsOpen
      ? popShell('互动统计', 'data-people-stats-pop', statsPopBody(buildInsightsCard(p), p))
      : profOpen
        ? popShell('补充背景', 'data-people-prof-pop', profilePopBody(p, profEditId === p.id))
        : popShell('记一笔', 'data-people-note-pop', [noteAddRow(todayStr())])
  );
}

// ---------------- 列表（折子封面墙） ----------------

/** 聊天仓会话缓存（issue 452：墙要聊天仓算素材水位；18k 条的仓每次切视图重读会卡） */
let storeCache: MessageStoreData | null = null;

/** 聊天仓读取（缓存到「导入成功」「关闭面板」失效；读不到按空仓兜底，照常出已有卡） */
async function storeData(): Promise<MessageStoreData> {
  if (storeCache) return storeCache;
  try {
    storeCache = await new MessageStore(getApp()).read();
  } catch (e) {
    console.warn('[people] 读取聊天仓失败:', e);
    storeCache = { version: 2, contacts: {} };
  }
  await migrateAvatars(storeCache);
  return storeCache;
}

/**
 * 旧桶头像迁移（456）：455 落盘的是库外绝对路径，渲染端 app://local 已经加载不了（裂图根因）。
 * 读到即复制进库内媒体文件夹并回写聊天仓；已是库内路径（或外部文件已删且无库内副本）直接跳过——幂等。
 */
async function migrateAvatars(pv: MessageStoreData): Promise<void> {
  const app = getApp();
  const store = new MessageStore(app);
  for (const [name, c] of Object.entries(pv.contacts)) {
    const cur = c.avatar;
    if (!cur || isVaultRelativePath(cur)) continue;
    let vPath: string | null = null;
    try { vPath = await importAvatarToVault(app, name, cur); } catch { vPath = null; }
    if (!vPath || vPath === cur) continue;
    c.avatar = vPath;
    try { await store.upsertContact(name, c); } catch (e) { console.warn('[people] 头像迁移回写失败:', name, e); }
  }
}

/**
 * 聊天仓素材 → 合成导入记录（issue 452）：条数 / 首尾跨度取时间线口径（text 非空，与改前一致）——
 * 这就是「已经导入了什么」的真实写照，让统计行、折子卡、详情头三处口径自动一致。
 * 无素材返回 null（清空后的残留仓不建占位卡）。
 * 合成记录**只喂渲染**：写入路径全走 PeopleStore.mutate（读盘上数据），不会落盘。
 */
function poolRecord(id: string, contact: StoreContact | undefined): ImportRecord | null {
  if (!contact) return null;
  const msgs = storeToUnified(contact.msgs ?? []);
  if (!msgs.length) return null;
  return {
    file: `数据源:${id}`,
    importedAt: contact.updatedAt || new Date(msgs[msgs.length - 1].ts).toISOString(),
    messageCount: msgs.length,
    skippedCount: 0,
    timeFrom: new Date(msgs[0].ts).toISOString(),
    timeTo: new Date(msgs[msgs.length - 1].ts).toISOString(),
    // issue 454：媒体计数取聊天仓侧写（导入时从原始消息算的，语音总时长只有它知道）——
    // 缺了它，合成卡与详情头的「语音 / 图片」永远是「—」（大琳 1289 条语音 / 1615 张图看不见）。
    // 只带媒体三项：月度 / 时段明细聊天仓没有，不在这编造——「数据」折见无 monthly 即出占位。
    stats: {
      voiceCount: contact.stats?.voiceCount ?? 0,
      voiceTotalSec: contact.stats?.voiceTotalSec ?? 0,
      imageCount: contact.stats?.imageCount ?? 0,
    },
  };
}

/**
 * 墙上人员 = 人物卡 ∪ 聊天仓联系人（issue 452）。
 * 447 定的「导入所选只进仓」、「画脸谱」才建卡，会让「导入了素材但没画过」的人在面板上彻底不可见
 * （452 实例：大琳 18477 条只在聊天仓里）。这里给无卡者合成一张占位卡——**纯内存，people.json 不动**。
 * 卡上已有导入记录时不覆盖（那时的「聊天仓更新」归数据源弹窗的「有更新」水位管）。
 */
async function wallPeople(): Promise<PersonEntry[]> {
  const people = store ? await store.list() : [];
  const contacts = (await storeData()).contacts ?? {};
  const out: PersonEntry[] = people.map((p) => {
    const rec = p.imports.length ? null : poolRecord(p.id, contacts[p.id]);
    return rec ? { ...p, imports: [rec] } : p;
  });
  const known = new Set(people.map((p) => p.id));
  for (const [id, contact] of Object.entries(contacts)) {
    if (known.has(id)) continue;
    const rec = poolRecord(id, contact);
    if (!rec) continue;
    out.push({ id, name: id, createdAt: rec.importedAt, imports: [rec] });
  }
  return out;
}

/**
 * 占位卡写入前兜底（issue 452）：PeopleStore.mutate 对盘上不存在的 id 抛「人物不存在」，
 * 所以在占位卡上写档案 / 随手记前先落一张空卡（真卡由此诞生，之后画脸谱正常接上）。
 */
async function ensureEntry(id: string): Promise<void> {
  if (!store || !id) return;
  if ((await store.list()).some((p) => p.id === id)) return;
  const name = listCache.find((x) => x.id === id)?.name ?? id;
  await store.upsert({ id, name, createdAt: new Date().toISOString(), imports: [] });
}

async function renderList(body: HTMLElement, people: PersonEntry[]): Promise<void> {
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
  const preview = await storeData();
  applyWall(people, wall, (name) => preview.contacts[name]?.avatar);
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

async function renderDetail(body: HTMLElement, people: PersonEntry[]): Promise<void> {
  const statsEl = overlay?.querySelector<HTMLElement>('[data-people-stats]');
  if (statsEl) statsEl.textContent = statsText(people);
  const p = people.find((x) => x.id === detailId);
  body.replaceChildren();
  if (!p) { stage = 'list'; await renderList(body, people); return; }
  const media = personMedia(p);
  // 头像：数据目录 avatar.<ext> 的绝对路径随聊天仓走（导入时刷新）；没有回落首字印章
  const avatar = (await storeData()).contacts[p.name]?.avatar;
  body.appendChild(foldDetailHead(p, media, { canGenerate: !p.digest, job: sealJobOf(jobViews().get(p.id)), avatar }));

  // 三折（455 评审拍板：其人 / 相交 / 纪事——编年史并入纪事折）：展开折渲染正文，收起折只剩竖排书脊
  const person = personOf(p.digest); // 旧单卷数据（只有 portrait）由此兼容读进卷一
  const bond = bondOf(p.digest);
  const bodies: Record<FoldId, HTMLElement[]> = {
    p: detailFold === 'p' ? foldPersonBody(person ? miniMarkdown(person) : null, p) : [],
    b: detailFold === 'b' ? foldBondBody(bond ? miniMarkdown(bond) : null) : [],
    e: detailFold === 'e' ? foldEventsBody(p) : [],
  };
  body.appendChild(foldBook(p, { fold: detailFold }, bodies));
}

// ---------------- 互动数据（issue 440：纯本地统计展示；447 收进「数据」折） ----------------

/**
 * 数据折互动卡：只展示最近一次导入的统计。
 * 判定口径是**有没有明细**（monthly），不是「有没有 stats」——452 的合成记录只带媒体三项
 * （issue 454：给详情头 / 卡面徽章供数），拿它画统计卡会得到一张全 0 的空卡，比占位更糟。
 */
function buildInsightsCard(p: PersonEntry): HTMLElement | null {
  if (!p.imports.length) return null;
  const latest = [...p.imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
  const s = latest.stats;
  if (!s?.monthly?.length) return null;
  const totalMsg = s.monthly.reduce((a, [, n]) => a + n, 0);
  const rows = document.createElement('div');
  rows.className = 'bz-people-ins-rows';
  // 谁主动：会话发起占比条 + 数字
  const byMe = s.initiatedByMe ?? 0;
  const byOther = s.initiatedByOther ?? 0;
  const initiated = byMe + byOther;
  rows.appendChild(insRow('谁主动', initiated
    ? duoBar(Math.round((byMe / initiated) * 100), Math.round((byOther / initiated) * 100))
    : duoBar(0, 0), initiated ? `我 ${byMe} · 对方 ${byOther}` : '暂无会话'));
  // 回复时延（issue 449）：优先中位数（更抗刷屏失真），旧数据无中位数字段回落平均
  rows.appendChild(insRow('回复时延', '', `我 ${formatReplySec(replyLatencySec(s.myMedianReplySec, s.myAvgReplySec))} · 对方 ${formatReplySec(replyLatencySec(s.otherMedianReplySec, s.otherAvgReplySec))}`));
  // 活跃时段：双方合计的 24 小时分布
  const hourly = (s.myHourly ?? []).map((n, i) => n + (s.otherHourly?.[i] ?? 0));
  const max = hourly.length ? Math.max(...hourly) : 0;
  const total = hourly.reduce((a, n) => a + n, 0);
  const strip = el('div', 'bz-people-strip', hourly.map((n, i) => {
    const h = max > 0 && n > 0 ? Math.max(Math.round((n / max) * 100), 6) : 0;
    return el('div', 'bz-people-strip-bar', { style: `height:${h}%`, title: `${i} 点 · ${n} 条` });
  }));
  rows.appendChild(insRow('活跃时段', strip, total ? `峰值 ${hourly.indexOf(max)} 点` : '—'));
  // 形态占比
  const kinds = Object.entries(s.kindCounts ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
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
function applyWall(people: PersonEntry[], wall: HTMLElement, avatarOf: (name: string) => string | undefined): void {
  wall.replaceChildren();
  const map = jobViews();
  for (const p of sortPeople(people)) {
    wall.appendChild(foldCard(p, {
      media: personMedia(p),
      mergeFrom: p.id === mergeFromId,
      mergePick: Boolean(mergeFromId) && p.id !== mergeFromId,
      job: sealJobOf(map.get(p.id)), // 451：印章四态（任务态压过脸谱水位）
      avatar: avatarOf(p.name),
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
/** AI 补充背景进行中（防双击；完成/失败都复位） */
let profAiBusy = false;

/**
 * AI 补充背景（455 评审）：读交往素材（事件 / 原话 / 场景）推断缺失档案字段，
 * 只填编辑表单里的**空白**项——手填的绝不覆盖，填完停在编辑态等用户检查保存。
 * 隐私口径不变：只喂已落盘的提炼素材，不送聊天原文。
 */
async function aiFillProfile(): Promise<void> {
  if (profAiBusy || !store || !detailId || !overlay) return;
  const p = listCache.find((x) => x.id === detailId);
  if (!p) return;
  const dg = p.digest;
  if (!dg) { notice('还没有脸谱素材——先导入并画脸谱，AI 才有据可依', 'warning'); return; }
  if (profEditId !== detailId) { profEditId = detailId; await renderBody(); } // 表单在编辑卡里，先进入编辑态
  profAiBusy = true;
  notice('AI 正在读交往素材补充背景…', 'info');
  try {
    const majors = dg.events.filter((e) => e.kind === 'major');
    const mat = [
      ['交往事件', [...majors, ...dg.events.filter((e) => e.kind !== 'major')].slice(0, 200).map((e) => `${e.ts} ${e.summary}`).join('\n')],
      ...(dg.quotes?.length ? [['代表性原话', dg.quotes.slice(0, 40).map((q) => `${q.who}：${q.text}`).join('\n')]] : []),
      ...(dg.moments?.length ? [['场景细节', dg.moments.slice(0, 30).map((m) => `${m.ts} ${m.summary}`).join('\n')]] : []),
    ].map(([t, s]) => `【${t}】\n${s}`).join('\n\n');
    const known = [
      p.profile?.birthday ? `生日 ${p.profile.birthday}` : '',
      p.profile?.hometown ? `家乡/现居 ${p.profile.hometown}` : '',
      p.profile?.job ? `职业 ${p.profile.job}` : '',
      p.profile?.metVia ? `认识方式 ${p.profile.metVia}` : '',
      p.profile?.metAt ? `认识时间 ${p.profile.metAt}` : '',
      p.profile?.tags?.length ? `标签 ${p.profile.tags.join('、')}` : '',
    ].filter(Boolean).join('；');
    const prompt = [
      `你在帮用户完善好友「${p.name}」的档案。以下是已落盘的交往提炼素材。`,
      ...(known ? [`已知档案（用户手填，不要覆盖也不要重复推断）：${known}`] : []),
      '',
      mat,
      '',
      '请推断档案缺失字段，只输出 JSON，不要解释、不要代码围栏：',
      '{"birthday":"","hometown":"","job":"","metVia":"","metAt":"","tags":[],"note":""}',
      '规则：',
      '- 只填素材能明确支撑的；没有证据的字段给空串 / 空数组，绝不编造。',
      '- birthday 仅当素材明确提到出生日期或生日时填（YYYY-MM-DD 或 MM-DD）。',
      '- metVia 一句话写怎么认识的；metAt 写认识时间（如 2023 年夏天）。',
      '- tags 2-3 个、每个不超过 6 字；note 一句话整体备注。',
    ].join('\n');
    const data = extractJsonLoose(await createAI().json(prompt)) as Record<string, unknown>;
    let filled = 0;
    for (const f of ['birthday', 'metVia', 'metAt', 'hometown', 'job', 'note'] as const) {
      const v = String(data[f] ?? '').trim();
      if (!v) continue;
      const inp = overlay.querySelector<HTMLInputElement>(`[data-people-prof-field="${f}"]`);
      if (inp && !inp.value.trim()) { inp.value = v; filled++; }
    }
    const tags = Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim()).filter(Boolean) : [];
    const tagList = overlay.querySelector('[data-people-prof-tag-list]');
    if (tagList && tagList.children.length === 0 && tags.length) {
      for (const t of tags.slice(0, 3)) tagList.appendChild(tagChip(t));
      filled++;
    }
    if (filled > 0) notice(`AI 已补 ${filled} 项，请检查后点「保存档案」`, 'success');
    else notice('素材里没有能支撑的档案信息，未作补充', 'info');
  } catch (e) {
    notifyActionError(e, 'AI 补充背景');
  } finally {
    profAiBusy = false;
  }
}

async function saveProfile(): Promise<void> {
  if (!store || !detailId || !overlay) return;
  await ensureEntry(detailId); // 452：占位卡（聊天仓合成，盘上还没卡）先落一张空卡
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
    await ensureEntry(detailId); // 452：占位卡先落一张空卡，再记（mutate 对不存在的 id 会抛）
    await store.addManualEvent(detailId, { id: genId(), ts, summary, createdAt: new Date().toISOString() });
    noteAddId = null;
    noteOpen = false;
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
