/**
 * 脸谱面板行为层（issue 447 / ADR-0106）：markup 全部出自 render.ts（折子语义单源），
 * 本文件只做生命周期 / 事件委托 / 数据流。
 *
 * 视图：list（折子封面墙）/ detail（折页册：画像/事件/大事记/数据/档案五折）+
 * 数据源独立弹窗（447 拍板：默认不打开、打开即扫、默认不勾选、四态水位、
 * 「导入所选」只进预览、「画脸谱」关弹窗回面板跑生成）。
 * 文件向导已退役（447）：bz-people-import 命令改开数据源弹窗；聊天原文只在本层内存流转
 * （ADR-0191），预览桶只落标签化文本。
 */
import { notice, notifyActionError } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { getApp } from '../core/app';
import { createAI } from '../core/ai';
import { buildFace } from './digest';
import type { AskLLM } from './digest';
import { PeopleStore } from './data';
import { buildFaceIncremental, mergeManualEvents, planIncremental } from './incremental';
import { buildMediaNote, emptyMediaStats, formatMediaCount, type MediaStats } from './media';
import { computeStats, formatReplySec } from './stats';
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
  foldWall,
  importMeta,
  insightsCard,
  kindChips,
  mergeBar,
  miniMarkdown,
  monthlyChart,
  panelShell,
  socialRow,
  statsText,
  tagChip,
  wallEmpty,
  type DsRowState,
  type FoldId,
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
let running = false;
/** 删除二次确认（第一次点进入武装态，3 秒回落） */
let deleteArmId: string | null = null;
let deleteArmTimer: ReturnType<typeof setTimeout> | null = null;
/** 最近一次 renderList 拉到的人物（合并确认取名用） */
let listCache: PersonEntry[] = [];
/** 合并流程（issue 442）：mergeFromId = 待并出的人物；mergeToId = 已点选、待二次确认的目标 */
let mergeFromId: string | null = null;
let mergeToId: string | null = null;

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
}

export function closePeoplePanel(): void {
  unregisterPanelEsc(ESC_ID);
  overlay?.remove();
  overlay = null;
  store = null;
  detailId = null;
  detailFold = 'p';
  stage = 'list';
  running = false;
  listCache = [];
  mergeFromId = null;
  mergeToId = null;
  profEditId = null; // 编辑态不随面板存续（评审 P1-2：重开面板不落回编辑态）
  noteAddId = null;
  disarmDelete();
  closeDsState();
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
  if (running) { notice('正在生成脸谱，请等这批结束再开数据源', 'info'); return; }
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
  if (!overlay || !store || !dataDir || dsScanning || dsImporting || running) return;
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
  if (!overlay || !dataDir || dsImporting || dsScanning || running) return;
  const chosen = (dsContacts ?? []).filter((c) => dsSelected.has(c.name) && !c.isGroup);
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
 * 「画脸谱」（447 拍板 Q5）：关闭弹窗回面板跑生成——进度走面板进度行，完成 notice + 刷新。
 * 不设门槛：弹窗里手动点，选了就画（skip 人物自动跳过）。
 */
async function generateFromDs(): Promise<void> {
  if (!overlay || !store || running || dsImporting || dsScanning) return;
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
  await runGenerationNow(targets);
}

/** 面板级生成（数据源路径专用）：进度行走面板头下进度行 */
async function runGenerationNow(targets: GenTarget[]): Promise<void> {
  if (!store || running) return;
  running = true;
  renderBody();
  showRunLine('准备中…', '');
  const res = await generateForTargets(targets, (main, sub) => {
    setRunLine(main, sub);
  });
  running = false;
  hideRunLine();
  const parts: string[] = [];
  if (res.ok) parts.push(`已生成 ${res.ok} 张脸谱`);
  if (res.skipped.length) parts.push(`${res.skipped.length} 位没有新消息、无需重画`);
  if (res.failed.length) parts.push(`${res.failed.length} 位失败`);
  notice(parts.join('，') || '没有可生成的脸谱', res.failed.length ? 'warning' : 'success');
  renderBody();
}

/**
 * 详情「画脸谱」（448：仅未生成脸谱时出）：用预览桶里该人物的消息素材单人生成，
 * 进度走面板进度行。还没有预览素材时提示先走数据源导入。
 */
async function generateOne(): Promise<void> {
  if (!store || !detailId || running) return;
  const name = detailId;
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
      };
    }
  } catch (e) {
    console.warn('[people] 读取预览桶失败:', e);
  }
  if (!target) { notice('还没有可画的消息素材——点右上「数据源」导入后再画', 'warning'); return; }
  await runGenerationNow([target]);
}

// ---------------- 事件委托 ----------------

function onOverlayClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  if (e.target === overlay) { closePeoplePanel(); return; }
  // —— 数据源弹窗（弹层在 body 之上，分支放前面；遮罩点击 = 关闭） ——
  if (t.closest('[data-people-ds-open]')) { if (running) notice('正在生成脸谱，请等这批结束再开数据源', 'info'); else openDs(); return; }
  if (t.closest('[data-people-ds-close]') || t.closest('[data-people-ds-dim]')) { closeDs(); return; }
  if (t.closest('[data-people-ds-scan]')) { void runScan(true); return; }
  if (t.closest('[data-people-ds-pickfresh]')) { pickFresh(); return; }
  if (t.closest('[data-people-ds-import]')) { void importDsSelected(); return; }
  if (t.closest('[data-people-ds-generate]')) { void generateFromDs(); return; }
  if (t.closest('[data-people-back-btn]')) {
    if (running) { notice('正在生成脸谱，完成后即可返回', 'info'); return; }
    stage = 'list'; detailId = null; detailFold = 'p';
    void renderBody();
    return;
  }
  // —— 详情「画脸谱」（仅未生成时出） ——
  if (t.closest('[data-people-generate-one]')) { void generateOne(); return; }
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
  renderRunLine();
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

function renderRunLine(): void {
  const line = overlay?.querySelector<HTMLElement>('[data-people-runline]');
  if (line) line.hidden = !running;
}

function showRunLine(main: string, sub: string): void {
  const line = overlay?.querySelector<HTMLElement>('[data-people-runline]');
  if (line) line.hidden = false;
  setRunLine(main, sub);
}

function setRunLine(main: string, sub: string): void {
  const m = overlay?.querySelector<HTMLElement>('[data-people-run-main]');
  const s = overlay?.querySelector<HTMLElement>('[data-people-run-sub]');
  if (m) m.textContent = main;
  if (s) s.textContent = sub;
}

function hideRunLine(): void {
  const line = overlay?.querySelector<HTMLElement>('[data-people-runline]');
  if (line) line.hidden = true;
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

// ---------------- 生成内核（文件向导退役后唯一入口 = 数据源路径） ----------------
/** 生成目标（预览桶路径内核入参） */
interface GenTarget {
  talker: string;
  name: string;
  msgs: UnifiedMessage[];
  /** 全形态计数（数据源路径 = chat.json 全量口径，见 datasource） */
  kindCounts: Record<string, number>;
  /** 被过滤的非文本 / 空消息条数（导入记录 skippedCount 口径，评审 P2-2） */
  skippedCount: number;
  /** 导入记录的 file 标注 */
  fileLabel: string;
}

/**
 * 批量生成内核（446 收编形态保留）：逐人 planIncremental（441 机制不动）→
 * full 走 buildFace / 其余走 buildFaceIncremental → 落导入记录 / 脸谱 / 锚点。
 * skip 不落 0 条记录；失败逐人收集不中断。
 */
async function generateForTargets(
  targets: GenTarget[],
  onProgress?: (main: string, sub: string) => void
): Promise<{ ok: number; failed: string[]; skipped: string[] }> {
  const ai = createAI();
  const askExtract: AskLLM = (p) => ai.json(p);
  const askPortrait: AskLLM = (p) => ai.chat(p);
  let ok = 0;
  const failed: string[] = [];
  const skipped: string[] = [];
  for (let i = 0; i < targets.length; i++) {
    // 面板中途被关（store 已置空）：余下目标直接中止，不计入失败——旧实现会把它们全误报成「生成失败」
    if (!overlay || !store) {
      notice('面板已关闭，剩余人物停止生成（已完成的不受影响）');
      break;
    }
    const { talker, name, msgs, kindCounts, skippedCount, fileLabel } = targets[i];
    const main = `正在生成「${name}」（${i + 1}/${targets.length}）`;
    onProgress?.(main, '');
    try {
      const existing = (await store!.list()).find((p) => p.id === talker);
      const plan = planIncremental(msgs, existing);
      const now = new Date().toISOString();
      // 纯本地聚合（issue 440），与原文一起用完即弃，落盘只有统计结果；媒体计数见 issue 445
      const stats = computeStats(msgs, kindCounts);
      // 非 skip 才落一条导入记录（评审 P2-2：skip 不落 0 条记录）；messageCount 记本次实际进提炼的条数
      const rec: ImportRecord = {
        file: fileLabel,
        importedAt: now,
        messageCount: plan.msgs.length,
        skippedCount,
        timeFrom: new Date(msgs[0].ts).toISOString(),
        timeTo: new Date(msgs[msgs.length - 1].ts).toISOString(),
        stats,
      };
      if (plan.mode === 'skip') {
        // skip 只可能发生在已有导入的人物上（无锚点走 full）；这里顺带应用改名，
        // 并给 issue 440 之前的旧数据补一份互动统计到最近一条导入记录（没有记录则不动）
        if (existing) {
          let imports = existing.imports;
          if (imports.length && !imports.some((r) => r.stats)) {
            imports = [...imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
            imports[0] = { ...imports[0], stats };
            await store!.upsert({ ...existing, name, imports });
          } else {
            await store!.upsert({ ...existing, name });
          }
        }
        skipped.push(name);
        continue;
      }
      // 「早于锚点的消息」不静默丢：补录明确说仍会提炼；混合导入明确说不重复提炼
      if (plan.mode === 'older') {
        notice(`「${name}」这批 ${plan.msgs.length} 条消息早于上次提炼点，将作为补充素材提炼`);
      } else if (plan.olderCount > 0) {
        notice(`「${name}」另有 ${plan.olderCount} 条消息早于上次提炼点，本次不重复提炼`);
      }
      // 媒体素材清单说明（issue 445）：按本次导入的统计口径（与 stats 同源）
      const mediaNote = buildMediaNote({
        voiceCount: stats.voiceCount ?? 0,
        voiceTotalSec: stats.voiceTotalSec ?? 0,
        imageCount: stats.imageCount ?? 0,
      });
      const face = plan.mode === 'full'
        ? await buildFace(askExtract, askPortrait, plan.msgs, name, (done, total) => {
            onProgress?.(main, `第 ${done} / ${total} 批`);
          }, undefined, mediaNote)
        : await buildFaceIncremental(askExtract, askPortrait, plan.msgs, name, existing?.digest, (done, total) => {
            const lead = plan.mode === 'older' ? `补录 ${plan.msgs.length} 条` : `新消息 ${plan.msgs.length} 条`;
            onProgress?.(main, `${lead} · 第 ${done} / ${total} 批`);
          }, mediaNote);
      const entry: PersonEntry = existing ? { ...existing, name } : { id: talker, name, createdAt: now, imports: [] };
      await store!.upsert(entry);
      await store!.appendImport(talker, rec);
      const digest: FaceDigest = {
        portrait: face.portrait,
        events: mergeManualEvents(face.events, existing?.manualEvents), // issue 439：手动随手记并入事件素材
        quotes: face.quotes,
        chronicle: face.chronicle || undefined,
        generatedAt: now,
      };
      await store!.setDigest(talker, digest);
      // 锚点写回：已提炼过的最大消息时间戳（组内升序取末条；补录不回退锚点）
      await store!.setLastProcessedTs(talker, Math.max(existing?.lastProcessedTs ?? 0, plan.msgs[plan.msgs.length - 1].ts));
      ok++;
    } catch (e) {
      failed.push(name);
      console.warn('[people] 生成失败:', name, e);
    }
  }
  return { ok, failed, skipped };
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
  // 平均回复时延（秒/分/时自适应）
  rows.appendChild(insRow('平均回复', '', `我 ${formatReplySec(s.myAvgReplySec)} · 对方 ${formatReplySec(s.otherAvgReplySec)}`));
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
  for (const p of sortPeople(people)) {
    wall.appendChild(foldCard(p, {
      media: personMedia(p),
      mergeFrom: p.id === mergeFromId,
      mergePick: Boolean(mergeFromId) && p.id !== mergeFromId,
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
