/**
 * 脸谱面板（issue 435/436 / ADR-0191）：body 级 overlay 自有面板，完整独立主页面——
 * 亚麻纹理底板 + 卡墙 + 印章式品牌区（favorites 同款设计语言，域内自持变量）。
 *
 * 视图：list（人物卡墙）/ import（三步向导：选文件 → 勾选联系人 → 批量生成）/ detail（脸谱详情）。
 * 多人备份支持（issue 436）：一份导出可含多位联系人，勾选后逐人提炼生成脸谱。
 * 聊天原文只在本层内存流转（ADR-0191）：File 文本 → parse → buildFace → 只落提炼产物。
 */
import { notice, notifyActionError } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { getApp } from '../core/app';
import { createAI } from '../core/ai';
import { PeopleStore } from './data';
import { parseWechatExport, type ContactGroup } from './parse';
import {
  buildFace,
  chunkMessages,
  type AskLLM,
} from './digest';
import { buildFaceIncremental, mergeManualEvents, planIncremental } from './incremental';
import { buildMediaNote, emptyMediaStats, formatMediaCount, type MediaStats } from './media';
import { computeStats, formatCount, formatReplySec } from './stats';
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
  shouldGenerate,
  type PreviewStats,
} from './datasource';
import { tryGetSettings } from '../core/settings-provider';

const ESC_ID = 'people-panel';

/** 头像色板（按名字 hash 取色——卡墙面孔识别） */
const AVATAR_COLORS = ['#b5534a', '#5a8f6d', '#4a7d9e', '#8a6bb0', '#b08a3e', '#7a8b4a', '#a05d7a', '#5f6b7a'];

type Stage = 'list' | 'import' | 'detail';
type ImportStep = 'file' | 'pick' | 'run';
/** 卡墙排序键（issue 442）：最近互动（默认）/ 消息量 / 建卡时间 / 名字 */
type SortKey = 'recent' | 'msgs' | 'created' | 'name';

let overlay: HTMLElement | null = null;
let store: PeopleStore | null = null;
let stage: Stage = 'list';
let step: ImportStep = 'file';
/** 已解析待勾选的导入（关闭面板即弃——原文不落盘） */
let pending: { file: string; contacts: ContactGroup[] } | null = null;
let selected = new Set<string>();
let names = new Map<string, string>();
let detailId: string | null = null;
let fileInput: HTMLInputElement | null = null;
let running = false;
let runMain = '';
let runSub = '';
let runResult: { ok: number; failed: string[]; skipped: string[] } | null = null;
/** pick 阶段的人物快照（issue 441 成本预告用：勾选频繁变化，不逐次异步查库） */
let peopleSnap: PersonEntry[] = [];
/** 删除二次确认（第一次点进入武装态，3 秒回落） */
let deleteArmId: string | null = null;
let deleteArmTimer: ReturnType<typeof setTimeout> | null = null;
/** 卡墙排序 / 标签筛选 / 搜索状态（issue 442，与 stage / selected 同款模块级持久） */
let sortKey: SortKey = 'recent';
let filterTag = '';
let searchText = '';
/** 最近一次 renderList 拉到的人物（工具条原位刷新用——搜索时不 refetch、不重建输入框） */
let listCache: PersonEntry[] = [];
/** 合并流程（issue 442）：mergeFromId = 待并出的人物；mergeToId = 已点选、待二次确认的目标 */
let mergeFromId: string | null = null;
let mergeToId: string | null = null;

// ---------------- 数据源（issue 446：预处理导出目录直连） ----------------

/** 一位数据源联系人的扫描快照（内存态，不入盘） */
interface DsContact {
  /** 目录名（即预览桶键 / PersonEntry.id） */
  name: string;
  /** chat.json 原始条数 */
  rawCount: number;
  isGroup: boolean;
  /** 归一化后能进预览的口径统计（按当前预览组开关） */
  stats: PreviewStats;
  /** 预览桶已有条数 */
  previewCount: number;
  /** 扫描时发现的新消息条数（原始 keys − 预览 keys） */
  newCount: number;
  /** 预览桶最新消息 ts（毫秒） */
  lastTs: number | null;
  /** 已画到的提炼锚点（PersonEntry.lastProcessedTs） */
  processedTs: number | null;
}

let dsContacts: DsContact[] | null = null;
let dsSelected = new Set<string>();
let dsScanning = false;
let dsImporting = false;
/** 未纳入列表的群聊数（peopleIncludeGroups=false 时隐藏，meta 行提示） */
let dsHiddenGroups = 0;
/** 数据源区反馈行（扫描 / 导入 / 生成进行时与结果文案） */
let dsNotice = '';
/** 导入完成但未触发生成（manual）→ 反馈行出「画脸谱」手动入口 */
let dsGenerateable = false;

export function isPeopleOpen(): boolean {
  return overlay !== null;
}

/** 打开面板（已开则聚到前台） */
export function openPeoplePanel(app?: unknown): void {
  if (overlay) {
    topifyZ(overlay);
    return;
  }
  store = new PeopleStore(app ?? getApp());
  overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay bz-people-scope';
  overlay.innerHTML = [
    '<div class="bz-people-panel">',
    '  <div class="bz-people-head">',
    '    <div class="bz-people-brand">',
    '      <div class="bz-people-mark" aria-hidden="true">脸</div>',
    '      <div class="bz-people-brand-text">',
    '        <h1 class="bz-people-title">脸谱</h1>',
    '        <div class="bz-people-sub">微信聊天 · AI 人物画像</div>',
    '      </div>',
    '    </div>',
    '    <div class="bz-people-head-actions">',
    '      <button type="button" class="bz-people-btn bz-people-btn-acc" data-people-import-btn>导入聊天</button>',
    '      <button type="button" class="bz-people-btn bz-people-btn-ghost" data-people-close>关闭</button>',
    '    </div>',
    '  </div>',
    '  <div class="bz-people-stats" data-people-stats></div>',
    '  <div class="bz-people-body" data-people-body></div>',
    '</div>',
  ].join('');
  document.body.appendChild(overlay);
  topifyZ(overlay);
  registerPanelEsc(ESC_ID, isPeopleOpen, closePeoplePanel);
  trapPanelFocus(overlay.querySelector<HTMLElement>('.bz-people-panel') ?? overlay);
  overlay.addEventListener('click', onOverlayClick);
  overlay.addEventListener('change', onOverlayChange);
  overlay.addEventListener('input', onOverlayInput);
  void renderBody();
  // 数据源自动扫描（issue 446）：配置了数据目录且开关未关时，打开面板即扫（结果供自动导入+生成判定）
  if (dsDataDir() && tryGetSettings()?.peopleScanOnOpen !== false) void runScan();
}

export function closePeoplePanel(): void {
  unregisterPanelEsc(ESC_ID);
  overlay?.remove();
  overlay = null;
  store = null;
  fileInput = null;
  pending = null;
  selected = new Set();
  names = new Map();
  detailId = null;
  stage = 'list';
  step = 'file';
  running = false;
  runResult = null;
  peopleSnap = [];
  sortKey = 'recent';
  filterTag = '';
  searchText = '';
  listCache = [];
  mergeFromId = null;
  mergeToId = null;
  profEditId = null; // 编辑态不随面板存续（评审 P1-2：此前漏重置，重开面板会落回编辑态）
  noteAddId = null;
  dsContacts = null;
  dsSelected = new Set();
  dsScanning = false;
  dsImporting = false;
  dsHiddenGroups = 0;
  dsNotice = '';
  dsGenerateable = false;
  disarmDelete();
}

/** 直开导入向导（bz-people-import 命令回调；面板未开先开） */
export function startImport(): void {
  if (!overlay) { openPeoplePanel(); return; }
  if (running) return;
  stage = 'import';
  step = pending ? 'pick' : 'file';
  if (step === 'pick') void refreshPeopleSnap().then(() => { if (stage === 'import' && step === 'pick') updatePickFooter(); });
  renderBody();
  if (step === 'file') pickFile();
}

// ---------------- 事件委托 ----------------

function onOverlayClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  if (e.target === overlay) { closePeoplePanel(); return; }
  if (t.closest('[data-people-close]')) { closePeoplePanel(); return; }
  if (t.closest('[data-people-import-btn]')) { if (!running) startImport(); return; }
  // —— issue 446 数据源区（元素只在 list 视图出现，属性名独立不侵入下方分支） ——
  if (t.closest('[data-people-ds-scan]')) { void runScan(); return; }
  if (t.closest('[data-people-ds-import]')) { void importDsSelected(); return; }
  if (t.closest('[data-people-ds-generate]')) { void generateDs([...dsSelected]); return; }
  if (t.closest('[data-people-pick-btn]')) { pickFile(); return; }
  if (t.closest('[data-people-repick-btn]')) { pending = null; selected = new Set(); names = new Map(); step = 'file'; pickFile(); return; }
  if (t.closest('[data-people-select-all]')) { selectAll(pending?.contacts ?? []); return; }
  if (t.closest('[data-people-select-none]')) { selected = new Set(); renderBody(); return; }
  if (t.closest('[data-people-start]')) { void runGeneration(); return; }
  if (t.closest('[data-people-back-btn]')) {
    if (running) return;
    stage = 'list'; pending = null; selected = new Set(); names = new Map(); runResult = null;
    void renderBody();
    return;
  }
  // —— issue 442 分支：筛选清除 / 导出 / 合并（目标点选走独立分支，不侵入下方卡片分支） ——
  if (t.closest('[data-people-filter-clear]')) { clearFilters(); return; }
  if (t.closest('[data-people-export]')) { void handleExport(); return; }
  const mergeBtn = t.closest<HTMLElement>('[data-people-merge]');
  if (mergeBtn) { mergeFromId = mergeBtn.dataset.peopleMerge || null; mergeToId = null; void renderBody(); return; }
  if (t.closest('[data-people-merge-cancel]')) { mergeFromId = null; mergeToId = null; void renderBody(); return; }
  if (t.closest('[data-people-merge-confirm]')) { void handleMergeConfirm(); return; }
  const mergePick = mergeFromId ? t.closest<HTMLElement>('[data-people-card]') : null;
  if (mergePick) {
    // 合并模式：点其他卡 = 选目标；点自己这张卡不响应
    const id = mergePick.dataset.peopleCard || '';
    if (id && id !== mergeFromId) { mergeToId = id; void renderBody(); }
    return;
  }
  const del = t.closest<HTMLElement>('[data-people-del]');
  if (del) { void handleDelete(del.dataset.peopleDel ?? ''); return; }
  const card = t.closest<HTMLElement>('[data-people-card]');
  if (card) { detailId = card.dataset.peopleCard ?? null; stage = 'detail'; void renderBody(); return; }
  // —— issue 439：档案与随手记（元素只在详情页出现，属性名互不重叠） ——
  if (t.closest('[data-people-prof-new]') || t.closest('[data-people-prof-edit]')) { profEditId = detailId; void renderBody(); return; }
  if (t.closest('[data-people-prof-cancel]')) { profEditId = null; void renderBody(); return; }
  if (t.closest('[data-people-prof-save]')) { void saveProfile(); return; }
  if (t.closest('[data-people-prof-add-social]')) { addSocialRow(); return; }
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
  if (el.matches('[data-people-check]')) {
    const tk = el.dataset.peopleCheck ?? '';
    if (el.checked) selected.add(tk); else selected.delete(tk);
    updatePickFooter();
  }
  // —— issue 446：数据源联系人勾选 ——
  if (el.matches('[data-people-ds-check]')) {
    const name = el.dataset.peopleDsCheck ?? '';
    if (el.checked) dsSelected.add(name); else dsSelected.delete(name);
    updateDsFooter();
  }
  // —— issue 442：排序 / 标签筛选（原位刷卡墙，工具条不重建） ——
  if (el.matches('[data-people-sort]')) { sortKey = (el.value || 'recent') as SortKey; refreshWall(); }
  if (el.matches('[data-people-tag]')) { filterTag = el.value || ''; refreshWall(); }
}

function onOverlayInput(e: Event): void {
  const el = e.target as HTMLInputElement;
  if (el.matches('[data-people-name]')) {
    names.set(el.dataset.peopleName ?? '', el.value);
  }
  // —— issue 442：搜索（原位刷卡墙，输入框不重建、焦点不丢） ——
  if (el.matches('[data-people-search]')) { searchText = el.value; refreshWall(); }
}

function selectAll(contacts: ContactGroup[]): void {
  selected = new Set(contacts.filter((c) => c.messages.length > 0).map((c) => c.talker));
  renderBody();
}

// ---------------- 渲染分发 ----------------

async function renderBody(): Promise<void> {
  const body = overlay?.querySelector<HTMLElement>('[data-people-body]');
  if (!body || !store) return;
  if (stage === 'list') await renderList(body);
  else if (stage === 'import') renderImport(body);
  else await renderDetail(body);
}

function renderStats(people: PersonEntry[]): void {
  const el = overlay?.querySelector<HTMLElement>('[data-people-stats]');
  if (!el) return;
  const total = people.reduce((s, p) => s + p.imports.reduce((x, r) => x + r.messageCount, 0), 0);
  const faces = people.filter((p) => p.digest).length;
  el.textContent = people.length
    ? `${people.length} 位人物 · ${total} 条消息 · ${faces} 张脸谱`
    : '还没有人物';
}

// ---------------- 列表（卡墙） ----------------

async function renderList(body: HTMLElement): Promise<void> {
  const people = store ? await store.list() : [];
  renderStats(people);
  listCache = people;
  body.replaceChildren();
  // 数据源区（issue 446）：配置了数据目录才出现；渲染扫描快照 / 联系人勾选 / 反馈行
  if (dsDataDir()) body.appendChild(buildDataSource(people));
  if (!people.length) {
    body.appendChild(el('div', 'bz-people-empty', [
      el('div', 'bz-people-empty-mark', text('脸')),
      el('div', 'bz-people-empty-title', text('还没有脸谱')),
      el('div', 'bz-people-empty-hint', text('用「留痕 MemoTrace」导出微信聊天（CSV / JSON），导入后 AI 会为对方画一张脸谱——画像、性格、共同回忆。')),
      button('bz-people-btn bz-people-btn-acc', '导入聊天记录', { 'data-people-import-btn': '' }),
    ]));
    return;
  }
  // 工具条（issue 442）：排序 / 标签筛选 / 搜索——追加在卡墙上方，头部结构不动
  body.appendChild(buildToolbar(people));
  // 合并流程横幅（issue 442）：待选目标 → 已选目标待二次确认
  const from = mergeFromId ? people.find((x) => x.id === mergeFromId) : null;
  if (mergeFromId && !from) { mergeFromId = null; mergeToId = null; } // 人已删，流程自愈回落
  else if (from) {
    const to = mergeToId && mergeToId !== mergeFromId ? people.find((x) => x.id === mergeToId) : null;
    if (to) {
      body.appendChild(el('div', 'bz-people-merge-bar', [
        el('div', 'bz-people-merge-text', text(`确认合并：把「${from.name}」的导入记录与随手记并到「${to.name}」，「${from.name}」将被删除；对方（${from.name}）的脸谱不带入，合并后建议重画。`)),
        button('bz-people-btn bz-people-btn-acc', '确认合并', { 'data-people-merge-confirm': '' }),
        button('bz-people-btn bz-people-btn-ghost', '取消', { 'data-people-merge-cancel': '' }),
      ]));
    } else {
      body.appendChild(el('div', 'bz-people-merge-bar', [
        el('div', 'bz-people-merge-text', text(`合并重复人物：点选一张卡片，把「${from.name}」的导入记录与随手记并过去——对方保留，「${from.name}」这张将删除。`)),
        button('bz-people-btn bz-people-btn-ghost', '取消合并', { 'data-people-merge-cancel': '' }),
      ]));
    }
  }
  const wall = el('div', 'bz-people-wall');
  wall.setAttribute('data-people-wall', '');
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

// ---------------- 导入向导 ----------------

function pickFile(): void {
  if (!overlay || running) return;
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.json,text/csv,application/json';
    fileInput.style.display = 'none';
    overlay.appendChild(fileInput);
    fileInput.addEventListener('change', () => void onFilePicked());
  }
  fileInput.value = '';
  fileInput.click();
}

async function onFilePicked(): Promise<void> {
  const f = fileInput?.files?.[0];
  if (!f) return;
  try {
    const text = await f.text();
    const parsed = parseWechatExport(f.name, text);
    pending = { file: f.name, contacts: parsed.contacts };
    selected = new Set(parsed.contacts.filter((c) => c.messages.length > 0).map((c) => c.talker)); // 默认全选有消息的
    names = new Map();
    stage = 'import';
    step = 'pick';
    await refreshPeopleSnap();
    renderBody();
  } catch (e) {
    notifyActionError(e, '解析聊天文件');
  }
}

function renderImport(body: HTMLElement): void {
  body.replaceChildren();
  body.appendChild(stepBar());
  if (step === 'run') { renderRun(body); return; }
  if (!pending || step === 'file') {
    body.appendChild(el('div', 'bz-people-empty', [
      el('div', 'bz-people-empty-mark', text('导')),
      el('div', 'bz-people-empty-title', text('选择聊天导出文件')),
      el('div', 'bz-people-empty-hint', text('支持「留痕 MemoTrace」导出的 CSV / JSON（单人聊天或含多人的完整备份）。聊天原文只在本机内存提炼，不会存进任何文件。')),
      button('bz-people-btn bz-people-btn-acc', '选择文件', { 'data-people-pick-btn': '' }),
    ]));
    return;
  }
  // pick：联系人勾选
  const contacts = pending.contacts.filter((c) => c.messages.length > 0);
  const skipped = pending.contacts.reduce((s, c) => s + c.skippedCount, 0);
  const totalMsgs = contacts.reduce((s, c) => s + c.messages.length, 0);
  if (!contacts.length) {
    body.appendChild(el('div', 'bz-people-empty', [
      el('div', 'bz-people-empty-title', text('这个文件里没有可用的文本消息')),
      el('div', 'bz-people-empty-hint', text(`已跳过 ${skipped} 条非文本或无效消息。换一个文件试试。`)),
      button('bz-people-btn', '重选文件', { 'data-people-repick-btn': '' }),
    ]));
    return;
  }
  body.appendChild(el('div', 'bz-people-pick-head', [
    el('div', 'bz-people-pick-file', text(pending.file)),
    el('div', 'bz-people-card-meta', text(`解析出 ${contacts.length} 位联系人 · ${totalMsgs} 条文本消息${skipped ? ` · 跳过 ${skipped} 条非文本` : ''}`)),
  ]));
  body.appendChild(el('div', 'bz-people-pick-tools', [
    button('bz-people-btn bz-people-btn-ghost', '全选', { 'data-people-select-all': '' }),
    button('bz-people-btn bz-people-btn-ghost', '全不选', { 'data-people-select-none': '' }),
    button('bz-people-btn bz-people-btn-ghost', '重选文件', { 'data-people-repick-btn': '' }),
  ]));
  const list = el('div', 'bz-people-pick-list');
  contacts.forEach((c, i) => {
    const on = selected.has(c.talker);
    const from = new Date(c.messages[0].ts);
    const to = new Date(c.messages[c.messages.length - 1].ts);
    const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = el('label', `bz-people-pick-row${on ? ' bz-people-pick-on' : ''}`, [
      (() => {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = on;
        cb.setAttribute('data-people-check', c.talker);
        return cb;
      })(),
      el('div', 'bz-people-ava bz-people-ava-sm', { style: `background:${avatarColor(displayName(c.talker))}` }, text(initials(displayName(c.talker)))),
      el('div', 'bz-people-pick-main', [
        (() => {
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.className = 'bz-people-pick-name';
          inp.value = names.get(c.talker) ?? '';
          inp.placeholder = displayName(c.talker);
          inp.setAttribute('data-people-name', c.talker);
          return inp;
        })(),
        el('div', 'bz-people-card-meta', text(`${c.messages.length} 条 · ${day(from)} ~ ${day(to)}`)),
      ]),
    ]);
    if (i === 0) {
      // 默认把第一位的称呼填进 names，便于直接生成
      if (!names.has(c.talker)) names.set(c.talker, displayName(c.talker));
    }
    list.appendChild(row);
  });
  body.appendChild(list);
  body.appendChild(el('div', 'bz-people-pick-foot', [
    el('div', 'bz-people-pick-count', { 'data-people-count': '' }, text(pickFooterLabel(contacts))),
    button('bz-people-btn bz-people-btn-acc', '开始生成脸谱', { 'data-people-start': '' }),
  ]));
}

function updatePickFooter(): void {
  const el2 = overlay?.querySelector<HTMLElement>('[data-people-count]');
  if (el2) el2.textContent = pickFooterLabel(pending?.contacts ?? []);
  // 勾选态行高亮
  overlay?.querySelectorAll<HTMLElement>('[data-people-check]').forEach((cb) => {
    const input = cb as HTMLInputElement;
    const row = input.closest('.bz-people-pick-row');
    if (row) row.classList.toggle('bz-people-pick-on', input.checked);
  });
}

/** pick 页脚文案：已选人数 + 成本预告（issue 441：开始生成前给出 AI 调用次数与新增消息条数） */
function pickFooterLabel(contacts: ContactGroup[]): string {
  const sel = contacts.filter((c) => c.messages.length > 0 && selected.has(c.talker));
  const head = `已选 ${sel.length} 位`;
  if (!sel.length) return head;
  const est = estimateCost(sel);
  if (!est.calls) return `${head} · 所选均无新消息，开始后不调用 AI`;
  return `${head} · 预计 ${est.calls} 次 AI 调用 · 新增 ${est.newMsgs} 条消息`;
}

function renderRun(body: HTMLElement): void {
  if (runResult) {
    const hints: string[] = [];
    if (runResult.failed.length) hints.push(`失败 ${runResult.failed.length} 位：${runResult.failed.join('、')}。可稍后重试。`);
    if (runResult.skipped.length) hints.push(`${runResult.skipped.length} 位没有新消息、无需重画：${runResult.skipped.join('、')}。`);
    if (!hints.length) hints.push('点开卡片查看画像与交往事件。');
    body.appendChild(el('div', 'bz-people-empty', [
      el('div', 'bz-people-empty-mark', text('成')),
      el('div', 'bz-people-empty-title', text(`已生成 ${runResult.ok} 张脸谱`)),
      el('div', 'bz-people-empty-hint', text(hints.join(''))),
      button('bz-people-btn bz-people-btn-acc', '回到列表', { 'data-people-back-btn': '' }),
    ]));
    return;
  }
  body.appendChild(el('div', 'bz-people-run', [
    el('div', 'bz-people-run-main', { 'data-people-run-main': '' }, text(runMain || '准备中…')),
    el('div', 'bz-people-run-sub', { 'data-people-run-sub': '' }, text(runSub)),
  ]));
}

/** 生成目标（文件向导 / 数据源两条路径共用的内核入参） */
interface GenTarget {
  talker: string;
  name: string;
  msgs: UnifiedMessage[];
  /** 全形态计数（文件路径 = 解析切片口径；数据源路径 = chat.json 全量口径，见 datasource） */
  kindCounts: Record<string, number>;
  /** 被过滤的非文本 / 空消息条数（导入记录 skippedCount 口径，评审 P2-2） */
  skippedCount: number;
  /** 导入记录的 file 标注（数据源路径 = `数据源:<名>`） */
  fileLabel: string;
}

async function runGeneration(): Promise<void> {
  if (!pending || !store || running) return;
  const targets: GenTarget[] = pending.contacts
    .filter((c) => c.messages.length > 0 && selected.has(c.talker))
    .map((c) => ({
      talker: c.talker,
      name: (names.get(c.talker) ?? '').trim() || displayName(c.talker),
      msgs: c.messages,
      kindCounts: c.kindCounts,
      skippedCount: c.skippedCount,
      fileLabel: pending!.file,
    }));
  if (!targets.length) { notice('还没有勾选联系人', 'warning'); return; }
  running = true;
  step = 'run';
  runResult = null;
  renderBody();
  const res = await generateForTargets(targets, setRun);
  running = false;
  runResult = res;
  pending = null;
  const parts: string[] = [];
  if (res.ok) parts.push(`已生成 ${res.ok} 张脸谱`);
  if (res.skipped.length) parts.push(`${res.skipped.length} 位没有新消息、无需重画`);
  if (res.failed.length) parts.push(`${res.failed.length} 位失败`);
  notice(parts.join('，') || '没有可生成的脸谱', res.failed.length ? 'warning' : 'success');
  renderBody();
}

/**
 * 批量生成内核（issue 446 自 runGeneration 收编，两条导入路径共用）：
 * 逐人 planIncremental（441 机制不动）→ full 走 buildFace / 其余走 buildFaceIncremental →
 * 落导入记录 / 脸谱 / 锚点。skip 不落 0 条记录；失败逐人收集不中断。
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

function setRun(main: string, sub: string): void {
  runMain = main;
  runSub = sub;
  const m = overlay?.querySelector<HTMLElement>('[data-people-run-main]');
  const s = overlay?.querySelector<HTMLElement>('[data-people-run-sub]');
  if (m) m.textContent = main;
  if (s) s.textContent = sub;
}

// ---------------- 数据源区（issue 446：预处理导出目录直连） ----------------
//
// list 视图顶部的常驻区（peopleDataDir 配置后才出现）：扫描列联系人 → 勾选「导入所选」
// 进预览桶（第一段增量，key 判重）→ 按 peopleGenTrigger / peopleGenThreshold 自动接
// 预览→脸谱的第二段（441 planIncremental）。manual 默认不自动，反馈行出「画脸谱」手动入口。

/** 数据目录（设置键；空串 = 不显示数据源入口） */
function dsDataDir(): string {
  return String(tryGetSettings()?.peopleDataDir ?? '').trim();
}

/** 生成触发设置（trigger / threshold；非法值回落默认 manual / 0） */
function genTriggerSettings(): { trigger: 'manual' | 'auto'; threshold: number } {
  const s = tryGetSettings() as Record<string, unknown> | null;
  const trigger = s?.peopleGenTrigger === 'auto' ? 'auto' : 'manual';
  const n = Number(s?.peopleGenThreshold ?? 0);
  return { trigger, threshold: Number.isFinite(n) && n > 0 ? Math.round(n) : 0 };
}

/** 水位行文案：预览桶条数 + 已画脸谱的锚点日期 */
function dsWatermarkLabel(c: DsContact): string {
  if (!c.previewCount) return '未导入';
  const drawn = c.processedTs ? ` · 已画到 ${formatDay(c.processedTs)}` : ' · 未画脸谱';
  return `已导 ${c.previewCount} 条${drawn}`;
}

function formatDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 数据源区 DOM（含空态：目录读不到 / 没有联系人时给一行说明，不整块消失） */
function buildDataSource(people: PersonEntry[]): HTMLElement {
  const contacts = dsContacts;
  const wrap = el('div', 'bz-people-ds');
  wrap.appendChild(el('div', 'bz-people-ds-head', [
    el('div', 'bz-people-ds-title', text('数据源')),
    el('div', 'bz-people-ds-meta', text(dsHeadMeta())),
    el('div', 'bz-people-ds-tools', [
      button('bz-people-btn bz-people-btn-ghost', dsScanning ? '扫描中…' : '扫描', { 'data-people-ds-scan': '' }),
      button('bz-people-btn bz-people-btn-acc', dsImporting ? '导入中…' : '导入所选', { 'data-people-ds-import': '' }),
    ]),
  ]));
  if (!dsScanning && contacts !== null && contacts.length) {
    const byId = new Map(people.map((p) => [p.id, p]));
    const list = el('div', 'bz-people-ds-list');
    for (const c of contacts) {
      // 已画脸谱的锚点以人物卡为准（扫描后生成会推进锚点，刷新水位行）
      const entry = byId.get(c.name);
      if (entry && entry.lastProcessedTs && entry.lastProcessedTs !== c.processedTs) c.processedTs = entry.lastProcessedTs;
      const on = dsSelected.has(c.name);
      const badge = previewMediaBadge(c.stats);
      const row = el('label', `bz-people-ds-row${on ? ' bz-people-ds-on' : ''}`, [
        (() => {
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = on;
          cb.setAttribute('data-people-ds-check', c.name);
          return cb;
        })(),
        el('div', 'bz-people-ava bz-people-ava-sm', { style: `background:${avatarColor(c.name)}` }, text(initials(c.name))),
        el('div', 'bz-people-ds-main', [
          el('div', 'bz-people-ds-name', text(c.name)),
          el('div', 'bz-people-card-meta', text([
            c.isGroup ? '群聊 · ' : '',
            `${c.rawCount} 条`,
            badge ? formatMediaCount(badge) : '',
          ].filter(Boolean).join(' · '))),
        ]),
        el('div', 'bz-people-ds-side', [
          ...(c.newCount > 0 ? [el('span', 'bz-people-ds-new', text(`新 ${c.newCount} 条`))] : []),
          el('span', 'bz-people-ds-mark', text(dsWatermarkLabel(c))),
        ]),
      ]);
      list.appendChild(row);
    }
    wrap.appendChild(list);
    wrap.appendChild(el('div', 'bz-people-ds-foot', [
      el('span', 'bz-people-ds-count', { 'data-people-ds-count': '' }, text(dsFooterLabel())),
      ...(dsGenerateable && !dsImporting && !running
        ? [button('bz-people-btn bz-people-btn-acc', '画脸谱', { 'data-people-ds-generate': '' })]
        : []),
    ]));
  } else if (!dsScanning) {
    wrap.appendChild(el('div', 'bz-people-ds-empty', text(
      contacts === null
        ? '还没扫描。点「扫描」读取数据文件夹里的联系人。'
        : dsHiddenGroups > 0
          ? `没有可导入的单聊（另有 ${dsHiddenGroups} 个群聊未纳入，可在设置开启）。`
          : '数据文件夹里没有找到联系人（各联系人目录下需有 chat.json）。'
    )));
  }
  if (dsNotice) {
    wrap.appendChild(el('div', 'bz-people-ds-notice', text(dsNotice)));
  }
  return wrap;
}

function dsHeadMeta(): string {
  const parts: string[] = [];
  if (dsScanning) parts.push('正在扫描…');
  else if (dsContacts) parts.push(`${dsContacts.length} 位联系人`);
  if (dsHiddenGroups > 0) parts.push(`${dsHiddenGroups} 个群聊未纳入`);
  return parts.join(' · ');
}

function dsFooterLabel(): string {
  if (!dsContacts) return '';
  const sel = dsContacts.filter((c) => dsSelected.has(c.name));
  if (!sel.length) return '未勾选联系人';
  const fresh = sel.reduce((s, c) => s + c.newCount, 0);
  return fresh ? `已选 ${sel.length} 位 · 新素材 ${fresh} 条` : `已选 ${sel.length} 位 · 所选暂无新素材`;
}

function updateDsFooter(): void {
  const count = overlay?.querySelector<HTMLElement>('[data-people-ds-count]');
  if (count) count.textContent = dsFooterLabel();
  overlay?.querySelectorAll<HTMLInputElement>('[data-people-ds-check]').forEach((cb) => {
    cb.closest('.bz-people-ds-row')?.classList.toggle('bz-people-ds-on', cb.checked);
  });
}

/** 扫描数据源：列目录 → 逐人读 chat.json 归一化 → 对照预览桶算新素材 → 落快照（不导入）。 */
async function runScan(): Promise<void> {
  const dataDir = dsDataDir();
  if (!overlay || !store || !dataDir || dsScanning || dsImporting || running) return;
  if (typeof window === 'undefined' || !(window as any).require) {
    dsNotice = '数据源扫描仅桌面端支持（需要读取库外文件夹）。';
    renderBody();
    return;
  }
  dsScanning = true;
  dsGenerateable = false;
  dsNotice = '';
  renderBody();
  const contacts: DsContact[] = [];
  let hidden = 0;
  try {
    const names = listContactDirs(dataDir);
    const includeGroups = tryGetSettings()?.peopleIncludeGroups === true;
    const opts = normalizeOptionsFromSettings();
    const previewStore = new PreviewStore(getApp());
    const [previewData, people] = await Promise.all([previewStore.read(), store.list()]);
    for (const name of names) {
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
        lastTs: pv?.msgs.length ? pv.msgs[pv.msgs.length - 1].ts : null,
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
    dsContacts = contacts.sort((a, b) => b.newCount - a.newCount || a.name.localeCompare(b.name, 'zh'));
    if (!dsSelected.size && dsContacts.some((c) => c.newCount > 0)) {
      dsSelected = new Set(dsContacts.filter((c) => c.newCount > 0).map((c) => c.name)); // 默认勾有新素材的
    }
    renderBody();
    // 扫描流程里的自动判定（issue 446）：auto 或 threshold 达标 → 自动导入 + 重画
    void autoFromScan();
  }
}

/** 扫描完成后的自动导入+生成（触发条件见 shouldGenerate；无匹配则静默等手动） */
async function autoFromScan(): Promise<void> {
  const { trigger, threshold } = genTriggerSettings();
  const auto = (dsContacts ?? []).filter((c) => c.newCount > 0 && shouldGenerate(c.newCount, trigger, threshold));
  if (!auto.length) return;
  dsSelected = new Set(auto.map((c) => c.name));
  await importDsSelected();
}

/**
 * 导入所选（第一段：原始→预览桶增量）：逐人读 chat.json → normalizeChatJson → mergePreview
 * 只补新消息 → 落 people-preview.json。完成后按 trigger/threshold 判定是否自动接第二段；
 * 未触发时反馈行出「画脸谱」手动入口（manual 模式默认）。
 */
async function importDsSelected(): Promise<void> {
  const dataDir = dsDataDir();
  if (!overlay || !dataDir || dsImporting || dsScanning || running) return;
  const chosen = (dsContacts ?? []).filter((c) => dsSelected.has(c.name));
  if (!chosen.length) { notice('还没有勾选联系人', 'warning'); return; }
  if (typeof window === 'undefined' || !(window as any).require) {
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
      c.lastTs = contact.msgs.length ? contact.msgs[contact.msgs.length - 1].ts : null;
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
  // 第二段判定：auto 导入即画（threshold 作门槛）；manual 下 threshold 达标也自动
  const { trigger, threshold } = genTriggerSettings();
  const genNames = chosen
    .filter((c) => (addedOf.get(c.name) ?? 0) > 0 && shouldGenerate(addedOf.get(c.name) ?? 0, trigger, threshold))
    .map((c) => c.name);
  const summary = [
    `已导入预览（新增 ${fresh} 条）`,
    readFail.length ? ` · ${readFail.length} 位读文件失败` : '',
  ].join('');
  if (genNames.length) {
    dsNotice = summary;
    renderBody();
    await generateDs(genNames, summary);
    return;
  }
  dsNotice = readFail.length
    ? summary
    : fresh > 0
      ? `${summary}。要点「画脸谱」才会调用 AI 生成。`
      : `${summary}，所选暂无新素材。`;
  dsGenerateable = fresh > 0 && !readFail.length;
  renderBody();
}

/**
 * 第二段：预览桶 → 脸谱（441 增量管线，generateForTargets 内核）。
 * 手动「画脸谱」与自动触发共用；不设门槛（门槛只在自动判定 shouldGenerate 里）。
 */
async function generateDs(names: string[], prefix = ''): Promise<void> {
  if (!overlay || !store || running || dsImporting || dsScanning) return;
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
        skippedCount: 0, // 预览桶内全是有效文本；原始过滤数已在导入时计入 chat.json 口径，不在导入记录重复报
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
    dsNotice = `${prefix}。所选还没有预览数据，先「导入所选」。`;
    renderBody();
    return;
  }
  running = true;
  dsGenerateable = false;
  dsNotice = `${prefix} · 正在生成脸谱…`;
  renderBody();
  const res = await generateForTargets(targets, (main, sub) => {
    dsNotice = `${prefix} · ${sub ? `${main} ${sub}` : main}`;
    const el2 = overlay?.querySelector<HTMLElement>('.bz-people-ds-notice');
    if (el2) el2.textContent = dsNotice;
  });
  running = false;
  const parts: string[] = [];
  if (res.ok) parts.push(`已生成 ${res.ok} 张脸谱`);
  if (res.skipped.length) parts.push(`${res.skipped.length} 位没有新消息、无需重画`);
  if (res.failed.length) parts.push(`${res.failed.length} 位失败：${res.failed.join('、')}`);
  dsNotice = `${prefix} · ${parts.join('，') || '没有可生成的脸谱'}`;
  notice(parts.join('，') || '没有可生成的脸谱', res.failed.length ? 'warning' : 'success');
  // 刷新水位行（锚点已推进）与卡墙（新人物卡）
  dsGenerateable = false;
  await refreshDsWatermarks();
  renderBody();
}

/** 生成后把人物卡最新锚点回填进扫描快照（水位行「已画到 …」即时跟进） */
async function refreshDsWatermarks(): Promise<void> {
  if (!store || !dsContacts?.length) return;
  const people = await store.list();
  const byId = new Map(people.map((p) => [p.id, p.lastProcessedTs ?? null]));
  for (const c of dsContacts) c.processedTs = byId.get(c.name) ?? c.processedTs;
}

function stepBar(): HTMLElement {
  const labels: Array<[ImportStep, string]> = [['file', '选文件'], ['pick', '勾选联系人'], ['run', '生成脸谱']];
  const order: ImportStep[] = ['file', 'pick', 'run'];
  const cur = order.indexOf(step);
  return el('div', 'bz-people-steps', labels.map(([k, label], i) =>
    el('div', `bz-people-step${i === cur ? ' bz-people-step-on' : ''}${i < cur ? ' bz-people-step-done' : ''}`, [
      el('span', 'bz-people-step-dot', text(String(i + 1))),
      el('span', 'bz-people-step-label', text(label)),
    ])
  ));
}

// ---------------- 详情 ----------------

async function renderDetail(body: HTMLElement): Promise<void> {
  const people = store ? await store.list() : [];
  renderStats(people);
  const p = people.find((x) => x.id === detailId);
  body.replaceChildren();
  if (!p) { stage = 'list'; await renderList(body); return; }
  const badge = mediaBadge(p);
  body.appendChild(el('div', 'bz-people-detail-head', [
    el('div', 'bz-people-detail-id', [
      el('div', 'bz-people-ava bz-people-ava-lg', { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
      el('div', '', [
        el('div', 'bz-people-detail-name', text(p.name)),
        el('div', 'bz-people-card-meta', text([
          p.imports.reduce((s, r) => s + r.messageCount, 0) ? `${p.imports.reduce((s, r) => s + r.messageCount, 0)} 条消息 · ${p.imports.length} 次导入` : '尚无导入',
          p.digest ? `脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}` : '脸谱未生成',
        ].join(' · '))),
        ...(badge ? [badge] : []),
      ]),
    ]),
    button('bz-people-btn bz-people-btn-ghost', '返回列表', { 'data-people-back-btn': '' }),
  ]));
  if (p.digest) {
    const portrait = el('div', 'bz-people-portrait');
    renderMiniMarkdown(p.digest.portrait, portrait);
    body.appendChild(portrait);
    renderProfileBlock(p, body);
    if (p.digest.chronicle) {
      body.appendChild(el('div', 'bz-people-section-title', text('关系时间线')));
      const chronicle = el('div', 'bz-people-chronicle');
      renderMiniMarkdown(p.digest.chronicle, chronicle);
      body.appendChild(chronicle);
    }
    if (p.digest.quotes?.length) {
      body.appendChild(el('div', 'bz-people-section-title', text('代表原话')));
      const quotes = el('div', 'bz-people-quotes');
      for (const q of p.digest.quotes) {
        quotes.appendChild(el('div', 'bz-people-quote', [
          el('div', 'bz-people-quote-text', text(`「${q.text}」`)),
          el('div', 'bz-people-quote-meta', text(`${q.who === '我' ? '我' : p.name} · ${q.ts}`)),
        ]));
      }
      body.appendChild(quotes);
    }
    if (p.digest.events.length) {
      body.appendChild(el('div', 'bz-people-section-title', text('交往事件')));
      const events = el('div', 'bz-people-events');
      for (const ev of p.digest.events) {
        events.appendChild(el('div', `bz-people-event${ev.kind === 'major' ? ' bz-people-event-major' : ''}`, [
          el('span', 'bz-people-event-ts', text(ev.ts)),
          el('span', 'bz-people-event-dot'),
          el('span', 'bz-people-event-summary', text(ev.summary)),
        ]));
      }
      body.appendChild(events);
    }
  } else {
    body.appendChild(el('div', 'bz-people-empty-hint', text('还没有脸谱。导入聊天记录后自动生成。')));
    renderProfileBlock(p, body);
  }
  renderInsights(body, p);
  body.appendChild(el('div', 'bz-people-detail-foot', [
    button('bz-people-btn bz-people-btn-ghost', '导出为笔记', { 'data-people-export': '' }),
    button('bz-people-btn', '再导一次聊天（重画脸谱）', { 'data-people-import-btn': '' }),
  ]));
}

// ---------------- 互动数据（issue 440：纯本地统计展示） ----------------

/** 详情页互动数据卡：只展示最近一次导入的统计；旧数据无 stats 时只给一句占位说明 */
function renderInsights(body: HTMLElement, p: PersonEntry): void {
  if (!p.imports.length) return;
  const latest = [...p.imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
  body.appendChild(el('div', 'bz-people-section-title', text('互动数据')));
  if (!latest.stats) {
    body.appendChild(el('div', 'bz-people-empty-hint', text('这次导入还没有互动统计（旧版数据）。再导一次聊天即可生成。')));
    return;
  }
  const s = latest.stats;
  const totalMsg = s.monthly.reduce((a, [, n]) => a + n, 0);
  const card = el('div', 'bz-people-insights');
  card.appendChild(el('div', 'bz-people-ins-head', [
    // 「共 X 条」只数进提炼的文本消息，与下方形态占比（含全部形态）分母不同——meta 行注明口径（评审 P2-5）
    el('div', 'bz-people-ins-range', text(`${latest.timeFrom.slice(0, 7)} ~ ${latest.timeTo.slice(0, 7)} · 共 ${formatCount(totalMsg)} 条文本（形态占比含图片/语音等全部消息形态）`)),
    el('div', 'bz-people-ins-file', text(latest.file)),
  ]));
  if (s.monthly.length) card.appendChild(buildMonthlyChart(s.monthly));

  const rows = el('div', 'bz-people-ins-rows');
  // 谁主动：会话发起占比条 + 数字
  const initiated = s.initiatedByMe + s.initiatedByOther;
  rows.appendChild(el('div', 'bz-people-ins-row', [
    el('span', 'bz-people-ins-label', text('谁主动')),
    initiated
      ? el('div', 'bz-people-duo', [
        el('div', 'bz-people-duo-me', { style: `width:${Math.round((s.initiatedByMe / initiated) * 100)}%` }),
        el('div', 'bz-people-duo-other', { style: `width:${Math.round((s.initiatedByOther / initiated) * 100)}%` }),
      ])
      : el('div', 'bz-people-duo'),
    el('span', 'bz-people-ins-val', text(initiated ? `我 ${s.initiatedByMe} · 对方 ${s.initiatedByOther}` : '暂无会话')),
  ]));
  // 平均回复时延（秒/分/小时自适应）
  rows.appendChild(el('div', 'bz-people-ins-row', [
    el('span', 'bz-people-ins-label', text('平均回复')),
    el('span', 'bz-people-ins-val', text(`我 ${formatReplySec(s.myAvgReplySec)} · 对方 ${formatReplySec(s.otherAvgReplySec)}`)),
  ]));
  // 活跃时段：双方合计的 24 小时分布
  const hourly = s.myHourly.map((n, i) => n + (s.otherHourly[i] ?? 0));
  const hourTotal = hourly.reduce((a, n) => a + n, 0);
  const hourMax = Math.max(...hourly);
  rows.appendChild(el('div', 'bz-people-ins-row', [
    el('span', 'bz-people-ins-label', text('活跃时段')),
    el('div', 'bz-people-strip', hourly.map((n, i) => {
      const h = hourMax > 0 && n > 0 ? Math.max(Math.round((n / hourMax) * 100), 6) : 0;
      return el('div', 'bz-people-strip-bar', { style: `height:${h}%`, title: `${i} 点 · ${n} 条` });
    })),
    el('span', 'bz-people-ins-val', text(hourTotal ? `峰值 ${hourly.indexOf(hourMax)} 点` : '—')),
  ]));
  // 形态占比
  const kinds = Object.entries(s.kindCounts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const kindTotal = kinds.reduce((a, [, n]) => a + n, 0);
  if (kinds.length) {
    rows.appendChild(el('div', 'bz-people-ins-row', [
      el('span', 'bz-people-ins-label', text('消息形态')),
      el('div', 'bz-people-kinds', kinds.map(([k, n]) =>
        el('span', 'bz-people-kind', text(`${k} ${formatCount(n)} · ${Math.round((n / kindTotal) * 100)}%`)))),
    ]));
  }
  card.appendChild(rows);
  body.appendChild(card);
}

/** 温度曲线：按月消息量柱条（纯 CSS，无依赖）；月份标签首尾必显，中段抽稀 */
function buildMonthlyChart(monthly: Array<[string, number]>): HTMLElement {
  const max = monthly.reduce((a, [, n]) => Math.max(a, n), 0);
  const wrap = el('div', 'bz-people-chart-wrap');
  const chart = el('div', 'bz-people-chart');
  for (const [month, n] of monthly) {
    const h = max > 0 ? Math.max(Math.round((n / max) * 100), 4) : 0;
    chart.appendChild(el('div', 'bz-people-col', { title: `${month} · ${n} 条` },
      el('div', 'bz-people-col-bar', { style: `height:${h}%` })));
  }
  wrap.appendChild(chart);
  const labels = el('div', 'bz-people-chart-labels');
  const step = monthly.length <= 8 ? 1 : Math.ceil(monthly.length / 6);
  monthly.forEach(([month], i) => {
    const show = i === 0 || i === monthly.length - 1 || i % step === 0;
    labels.appendChild(el('span', '', text(show ? month.slice(2) : '')));
  });
  wrap.appendChild(labels);
  return wrap;
}
// ---------------- 卡墙工具条：排序 / 筛选 / 搜索（issue 442） ----------------

const SORT_OPTIONS: Array<[SortKey, string]> = [
  ['recent', '最近互动'],
  ['msgs', '消息量'],
  ['created', '建卡时间'],
  ['name', '名字'],
];

/** 工具条：排序下拉 + 关系标签下拉（只列实际出现过的）+ 搜索框。仅在有人物时渲染。 */
function buildToolbar(people: PersonEntry[]): HTMLElement {
  const tags = collectTags(people);
  if (filterTag && !tags.includes(filterTag)) filterTag = ''; // 标签已消失（合并/改档案）→ 回落全部
  const sortSel = document.createElement('select');
  sortSel.className = 'bz-people-select';
  sortSel.setAttribute('data-people-sort', '');
  sortSel.setAttribute('aria-label', '排序方式');
  for (const [k, label] of SORT_OPTIONS) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = label;
    if (k === sortKey) o.selected = true;
    sortSel.appendChild(o);
  }
  const tagSel = document.createElement('select');
  tagSel.className = 'bz-people-select';
  tagSel.setAttribute('data-people-tag', '');
  tagSel.setAttribute('aria-label', '按关系标签筛选');
  const all = document.createElement('option');
  all.value = '';
  all.textContent = '全部标签';
  tagSel.appendChild(all);
  for (const tag of tags) {
    const o = document.createElement('option');
    o.value = tag;
    o.textContent = tag;
    if (tag === filterTag) o.selected = true;
    tagSel.appendChild(o);
  }
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'bz-people-search';
  search.placeholder = '搜称呼 / 标签 / 备注';
  search.value = searchText;
  search.setAttribute('data-people-search', '');
  search.setAttribute('aria-label', '搜索人物');
  return el('div', 'bz-people-toolbar', [sortSel, tagSel, search]);
}

/** 全库实际出现过的关系标签（去重 + 中文序） */
function collectTags(people: PersonEntry[]): string[] {
  const set = new Set<string>();
  for (const p of people) for (const tag of p.profile?.tags ?? []) if (tag.trim()) set.add(tag.trim());
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
}

/** 消息总量（卡墙 meta 与排序共用） */
function msgTotal(p: PersonEntry): number {
  return p.imports.reduce((s, r) => s + r.messageCount, 0);
}

// ---------------- 媒体徽章（issue 445） ----------------

/**
 * 人物媒体统计：跨导入累计（与卡片「N 条消息」同口径；旧数据无媒体字段按 0 计）。
 * 无媒体素材返回 null——徽章空数据不渲染。
 */
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

/** 媒体徽章：「语音 26 条 · 4 分 · 图片 14 张」（零项不出现）；空数据返回 null 不渲染 */
export function mediaBadge(p: PersonEntry): HTMLElement | null {
  const s = personMedia(p);
  const label = s ? formatMediaCount(s) : '';
  return label ? el('span', 'bz-people-media-badge', text(label)) : null;
}

function sortPeople(list: PersonEntry[]): PersonEntry[] {
  const arr = [...list];
  const lastSeen = (p: PersonEntry) => p.imports.reduce((m, r) => (r.timeTo > m ? r.timeTo : m), '');
  switch (sortKey) {
    case 'msgs':
      return arr.sort((a, b) => msgTotal(b) - msgTotal(a) || a.createdAt.localeCompare(b.createdAt));
    case 'created':
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'name':
      return arr.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    case 'recent':
    default:
      // 无导入记录的人物按建卡时间兜底，不沉底到不可预期位置
      return arr.sort((a, b) => (lastSeen(b) || b.createdAt).localeCompare(lastSeen(a) || a.createdAt));
  }
}

/** 标签筛选 + 关键词搜索（称呼 / 标签 / 备注，大小写不敏感） */
function matchPerson(p: PersonEntry): boolean {
  if (filterTag && !(p.profile?.tags ?? []).includes(filterTag)) return false;
  const q = searchText.trim().toLowerCase();
  if (!q) return true;
  return [p.name, ...(p.profile?.tags ?? []), p.profile?.note ?? ''].join('\n').toLowerCase().includes(q);
}

/** 按当前排序 / 筛选 / 搜索状态刷卡墙（merge 状态也在这里反映为卡片样式） */
function applyWall(people: PersonEntry[], wall: HTMLElement): void {
  wall.replaceChildren();
  const shown = sortPeople(people.filter((p) => matchPerson(p)));
  if (!shown.length) {
    wall.appendChild(el('div', 'bz-people-nomatch', [
      el('div', 'bz-people-empty-hint', text('没有匹配的人物')),
      button('bz-people-btn bz-people-btn-ghost', '清除筛选', { 'data-people-filter-clear': '' }),
    ]));
    return;
  }
  const canMerge = people.length > 1;
  for (const p of shown) {
    const total = msgTotal(p);
    const from = p.imports.map((r) => r.timeFrom).sort()[0];
    const to = p.imports.map((r) => r.timeTo).sort().pop();
    const span = from && to ? `${from.slice(0, 7)} ~ ${to.slice(0, 7)}` : '';
    const badge = mediaBadge(p);
    const side = el('div', 'bz-people-card-side');
    if (canMerge && !mergeFromId) {
      side.appendChild(button('bz-people-btn bz-people-btn-ghost', '合并到…', { 'data-people-merge': p.id }));
    }
    // 合并选择模式（mergeFromId 非空）下不渲染删除（评审 P2-3）：卡片点击被「选目标」分支先吃掉，
    // 摆出来的删除按钮点不到还诱误触；单人库（canMerge=false）保留删除入口不受影响
    if (!mergeFromId) {
      side.appendChild(button('bz-people-btn bz-people-btn-ghost bz-people-del', deleteArmId === p.id ? '再点确认删除' : '删除', { 'data-people-del': p.id }));
    }
    const card = el('div', 'bz-people-card', [
      el('div', 'bz-people-ava', { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
      el('div', 'bz-people-card-main', [
        el('div', 'bz-people-card-name', text(p.name)),
        el('div', 'bz-people-card-meta', text([total ? `${total} 条消息` : '尚无消息', span].filter(Boolean).join(' · '))),
        el('div', `bz-people-chip ${p.digest ? 'bz-people-chip-on' : ''}`, text(p.digest ? '已画脸谱' : '待生成')),
        ...(badge ? [badge] : []),
      ]),
      side,
    ]);
    if (p.id === mergeFromId) card.classList.add('bz-people-card-merge-from');
    else if (mergeFromId) card.classList.add('bz-people-card-merge-pick');
    card.setAttribute('data-people-card', p.id);
    wall.appendChild(card);
  }
}

/** 工具条原位刷新：只刷卡墙，不 refetch、不重建工具条（搜索焦点不丢） */
function refreshWall(): void {
  const wall = overlay?.querySelector<HTMLElement>('[data-people-wall]');
  if (wall) applyWall(listCache, wall);
}

function clearFilters(): void {
  filterTag = '';
  searchText = '';
  const search = overlay?.querySelector<HTMLInputElement>('[data-people-search]');
  const tagSel = overlay?.querySelector<HTMLSelectElement>('[data-people-tag]');
  if (search) search.value = '';
  if (tagSel) tagSel.value = '';
  refreshWall();
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
    notice(`已把「${from?.name ?? fromId}」的导入记录与随手记并到「${to?.name ?? toId}」，原人物已删除。要更新脸谱可再导入聊天重画`, 'success');
  } catch (e) {
    notifyActionError(e, '合并人物');
  }
  mergeFromId = null;
  mergeToId = null;
  void renderBody();
}

// ---------------- 导出为 markdown 笔记（issue 442） ----------------

/** 导出目录单源（issue 442）：我的/脸谱 */
const EXPORT_DIR = '我的/脸谱';

async function handleExport(): Promise<void> {
  if (!store || !detailId) return;
  const p = (await store.list()).find((x) => x.id === detailId);
  if (!p) return;
  const app = getApp();
  try {
    if (!app.vault.getAbstractFileByPath(EXPORT_DIR)) await app.vault.createFolder(EXPORT_DIR);
    const base = cleanFileNameOf(p.name) || '未命名';
    let path = `${EXPORT_DIR}/${base}.md`;
    // 同名不静默覆盖：追加序号「名字 2.md」「名字 3.md」…
    for (let n = 2; app.vault.getAbstractFileByPath(path); n++) path = `${EXPORT_DIR}/${base} ${n}.md`;
    await app.vault.create(path, buildFaceNote(p));
    notice(`已导出到 ${path}`, 'success');
  } catch (e) {
    notifyActionError(e, '导出脸谱笔记');
  }
}

/** 脸谱 → 笔记 markdown：画像 + 关系时间线 + 代表原话 + 事件列表 + 档案（有则含） */
function buildFaceNote(p: PersonEntry): string {
  const lines: string[] = [`# 脸谱 · ${p.name}`, ''];
  const meta = [
    msgTotal(p) ? `${msgTotal(p)} 条消息` : '尚无消息',
    `${p.imports.length} 次导入`,
    p.digest ? `脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}` : '脸谱未生成',
    `导出于 ${new Date().toISOString().slice(0, 10)}`,
  ].join(' · ');
  lines.push(`> ${meta}`, '');
  if (p.digest?.portrait) lines.push('## 画像', '', p.digest.portrait.trim(), '');
  if (p.digest?.chronicle) lines.push('## 关系时间线', '', p.digest.chronicle.trim(), '');
  if (p.digest?.quotes?.length) {
    lines.push('## 代表原话', '');
    for (const q of p.digest.quotes) lines.push(`- **${q.ts} · ${q.who === '我' ? '我' : p.name}**：「${q.text}」`);
    lines.push('');
  }
  if (p.digest?.events.length) {
    lines.push('## 交往事件', '');
    for (const ev of p.digest.events) lines.push(ev.kind === 'major' ? `- **${ev.ts}** ${ev.summary}` : `- ${ev.ts} ${ev.summary}`);
    lines.push('');
  }
  const prof = p.profile;
  if (prof) {
    const rows: string[] = [];
    if (prof.tags?.length) rows.push(`- 标签：${prof.tags.join('、')}`);
    if (prof.birthday) rows.push(`- 生日：${prof.birthday}`);
    if (prof.metVia) rows.push(`- 怎么认识：${prof.metVia}`);
    if (prof.metAt) rows.push(`- 什么时候认识：${prof.metAt}`);
    if (prof.hometown) rows.push(`- 家乡 / 现居：${prof.hometown}`);
    if (prof.job) rows.push(`- 职业：${prof.job}`);
    if (prof.socials?.length) rows.push(`- 社交账号：${prof.socials.map((s) => `${s.platform} ${s.handle}`).join('；')}`);
    if (prof.note) rows.push(`- 备注：${prof.note}`);
    if (rows.length) lines.push('## 档案', '', ...rows, '');
  }
  return lines.join('\n');
}

/** 文件名清洗（issue 442）：剥 `[\\/:*?"<>|]` + Windows 命名边界——尾点/尾空格剥掉，
 *  设备名（con/prn/aux/nul/com1-9/lpt1-9，大小写不敏感）前置 `_`，否则 vault.create 恒失败（clipbook 同款口径） */
function cleanFileNameOf(name: string): string {
  let t = String(name ?? '').replace(/[\\/:*?"<>|]/g, '').trim();
  t = t.replace(/[. ]+$/, '');
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(t)) t = `_${t}`;
  return t;
}

// ---------------- 迷你 markdown（受限语法，ADR-0191 §4） ----------------

/** 只认：## / ### 小节、- 列表、> 引用块、**粗体**、普通段落。其余语法原样输出文本。 */
function renderMiniMarkdown(md: string, root: HTMLElement): void {
  let list: HTMLUListElement | null = null;
  let quote: HTMLQuoteElement | null = null;
  for (const raw of md.replace(/```+/g, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { list = null; quote = null; continue; }
    if (line.startsWith('### ')) { list = null; quote = null; root.appendChild(textEl('h5', line.slice(4))); continue; }
    if (line.startsWith('## ')) { list = null; quote = null; root.appendChild(textEl('h4', line.slice(3))); continue; }
    if (line.startsWith('- ')) {
      quote = null;
      if (!list) { list = document.createElement('ul'); root.appendChild(list); }
      const li = document.createElement('li');
      appendInline(li, line.slice(2));
      list.appendChild(li);
      continue;
    }
    // 连续 > 行合成同一引用块（画像「表达 DNA」的原话例句即此形态）
    if (line.startsWith('>')) {
      list = null;
      if (!quote) { quote = document.createElement('blockquote'); root.appendChild(quote); }
      const p = document.createElement('p');
      appendInline(p, line.slice(1).replace(/^\s/, ''));
      quote.appendChild(p);
      continue;
    }
    list = null;
    quote = null;
    const p = document.createElement('p');
    appendInline(p, line);
    root.appendChild(p);
  }
}

function appendInline(el: HTMLElement, text: string): void {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  parts.forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1) el.appendChild(textEl('strong', part));
    else el.appendChild(document.createTextNode(part));
  });
}

// ---------------- 小件 ----------------

/** 展示名：wxid 形态取可读尾段，其余原样 */
function displayName(talker: string): string {
  if (/^wxid_/i.test(talker)) return talker.slice(0, 10);
  return talker;
}

function initials(name: string): string {
  const s = name.trim();
  return s ? [...s][0] : '?';
}

function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** DOM 小件：第三参可传属性表（plain object）或子节点（单个 / 数组），子节点续在 rest 里也可 */
function el(
  tag: string,
  cls?: string,
  arg?: Node | Node[] | Record<string, string>,
  ...rest: Node[]
): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (arg === undefined) {
    for (const c of rest) node.appendChild(c);
  } else if (Array.isArray(arg)) {
    for (const c of [...arg, ...rest]) node.appendChild(c);
  } else if (arg instanceof Node) {
    node.appendChild(arg);
    for (const c of rest) node.appendChild(c);
  } else {
    for (const [k, v] of Object.entries(arg)) node.setAttribute(k, v);
    for (const c of rest) node.appendChild(c);
  }
  return node;
}

function text(s: string): Text {
  return document.createTextNode(s);
}

function textEl(tag: string, s: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = s;
  return node;
}

function button(cls: string, label: string, attrs: Record<string, string>): HTMLElement {
  const b = el('button', cls, attrs) as HTMLButtonElement;
  b.type = 'button';
  b.textContent = label;
  return b;
}

// ---------------- 增量提炼（issue 441） ----------------
//
// 「哪条消息算新」的判定与素材合并去重是纯逻辑，评审 443 迁到 incremental.ts（可整管单测）；
// ui 层只做编排：planIncremental 出计划 → full 走 digest.buildFace，其余走 buildFaceIncremental。

/** 成本预告（与真实跑批同口径：批数按 chunkMessages 默认参数，每人 +2 = 画像 + 时间线） */
function estimateCost(sel: ContactGroup[]): { calls: number; newMsgs: number } {
  let calls = 0;
  let newMsgs = 0;
  for (const c of sel) {
    const plan = planIncremental(c.messages, peopleSnap.find((p) => p.id === c.talker));
    if (plan.mode === 'skip') continue;
    calls += chunkMessages(plan.msgs).length + 2;
    newMsgs += plan.msgs.length;
  }
  return { calls, newMsgs };
}

/** pick 阶段的人物快照（勾选频繁变化，不逐次异步查库） */
async function refreshPeopleSnap(): Promise<void> {
  peopleSnap = store ? await store.list() : [];
}

// ---------------- 档案与随手记（issue 439） ----------------
// 手动输入路径：档案（社交账号/生日/认识方式/标签/备注…）落盘走 store.updateProfile，
// 随手记走 store.addManualEvent / removeManualEvent；显式保存按钮写盘，不随 input 落盘。

/** 编辑态 / 记一笔态只对当前人物生效（换人即自然退出；面板关闭在 closePeoplePanel 一并重置，评审 P1-2） */
let profEditId: string | null = null;
let noteAddId: string | null = null;

/** 档案是否至少填了一项（决定详情页出不出现档案区块） */
function profileFilled(prof: PersonProfile | undefined): boolean {
  if (!prof) return false;
  return Boolean(
    (prof.socials && prof.socials.length) ||
    (prof.tags && prof.tags.length) ||
    (prof.birthday ?? '').trim() || (prof.metVia ?? '').trim() || (prof.metAt ?? '').trim() ||
    (prof.hometown ?? '').trim() || (prof.job ?? '').trim() || (prof.note ?? '').trim()
  );
}

/** 详情页档案区：有档案/有随手记/在编辑才出对应区块；全空时只给一行入口 */
function renderProfileBlock(p: PersonEntry, body: HTMLElement): void {
  const prof = p.profile;
  const hasProf = profileFilled(prof);
  const evs = p.manualEvents ?? [];
  const editing = profEditId === p.id;
  const addingNote = noteAddId === p.id;

  if (hasProf || editing) {
    body.appendChild(el('div', 'bz-people-section-title', text('人物档案')));
    body.appendChild(editing ? buildProfileEditor(prof) : buildProfileView(prof));
  }
  if (evs.length || addingNote) {
    body.appendChild(el('div', 'bz-people-section-title', text('随手记')));
    if (addingNote) body.appendChild(buildNoteAddRow());
    if (evs.length) {
      const list = el('div', 'bz-people-notes');
      for (const ev of evs) {
        list.appendChild(el('div', 'bz-people-note', [
          el('span', 'bz-people-note-ts', text(ev.ts)),
          el('span', 'bz-people-note-summary', text(ev.summary)),
          button('bz-people-btn bz-people-btn-ghost bz-people-note-del', '删', { 'data-people-ev-del': ev.id }),
        ]));
      }
      body.appendChild(list);
    }
  }
  // 入口行：缺什么补什么；档案与随手记全空时加一句提示，避免凭空两个按钮
  const entries: HTMLElement[] = [];
  if (!hasProf && !editing) entries.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '补人物档案', { 'data-people-prof-new': '' }));
  if (!evs.length && !addingNote) entries.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '记一笔', { 'data-people-note-add': '' }));
  if (entries.length) {
    const solo = !hasProf && !editing && !evs.length && !addingNote;
    body.appendChild(el('div', `bz-people-prof-entry${solo ? ' bz-people-prof-entry-solo' : ''}`, [
      ...(solo ? [el('span', 'bz-people-prof-entry-hint', text('聊天之外的也可以记：'))] : []),
      ...entries,
    ]));
  }
}

/** 档案展示卡：只列填过的字段 */
function buildProfileView(prof: PersonProfile | undefined): HTMLElement {
  const rows: HTMLElement[] = [];
  const addRow = (label: string, value: string) => {
    rows.push(el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text(label)),
      el('span', 'bz-people-prof-value', text(value)),
    ]));
  };
  if (prof?.socials?.length) {
    rows.push(el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text('社交账号')),
      el('span', 'bz-people-prof-value', text(prof.socials.map((s) => [s.platform, s.handle].filter(Boolean).join(' ')).filter(Boolean).join(' · '))),
    ]));
  }
  if (prof?.birthday?.trim()) addRow('生日', prof.birthday.trim());
  if (prof?.metVia?.trim()) addRow('认识方式', prof.metVia.trim());
  if (prof?.metAt?.trim()) addRow('认识时间', prof.metAt.trim());
  if (prof?.hometown?.trim()) addRow('家乡 / 现居', prof.hometown.trim());
  if (prof?.job?.trim()) addRow('职业', prof.job.trim());
  if (prof?.tags?.length) {
    rows.push(el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text('标签')),
      el('span', 'bz-people-prof-value bz-people-prof-tags', prof.tags.filter(Boolean).map((t) => el('span', 'bz-people-chip', text(t)))),
    ]));
  }
  if (prof?.note?.trim()) addRow('备注', prof.note.trim());
  rows.push(el('div', 'bz-people-prof-actions', [
    button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '编辑档案', { 'data-people-prof-edit': '' }),
  ]));
  return el('div', 'bz-people-prof', rows);
}

function profInput(value: string, placeholder: string, attr: [string, string], cls = 'bz-people-prof-input'): HTMLInputElement {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = cls;
  inp.value = value;
  inp.placeholder = placeholder;
  inp.setAttribute(attr[0], attr[1]);
  return inp;
}

function socialRow(platform: string, handle: string): HTMLElement {
  return el('div', 'bz-people-prof-social-row', [
    profInput(platform, '平台（微信 / 微博…）', ['data-people-prof-social-platform', ''], 'bz-people-prof-input bz-people-prof-social-platform'),
    profInput(handle, '账号', ['data-people-prof-social-handle', ''], 'bz-people-prof-input bz-people-prof-social-handle'),
    button('bz-people-btn bz-people-btn-ghost bz-people-prof-x', '×', { 'data-people-prof-social-del': '', 'aria-label': '删除这条社交账号' }),
  ]);
}

function tagChip(t: string): HTMLElement {
  return el('span', 'bz-people-prof-tag', [
    el('span', 'bz-people-prof-tag-text', text(t)),
    button('bz-people-btn bz-people-btn-ghost bz-people-prof-x', '×', { 'data-people-prof-tag-del': '', 'aria-label': `删除标签 ${t}` }),
  ]);
}

/** 档案编辑卡：行内增删（社交行 / 标签）只动 DOM，点「保存档案」才读全量写盘 */
function buildProfileEditor(prof: PersonProfile | undefined): HTMLElement {
  const grid = (label: string, input: HTMLElement) =>
    el('div', 'bz-people-prof-row', [el('span', 'bz-people-prof-label', text(label)), input]);
  const socialList = el('div', 'bz-people-prof-social-list', { 'data-people-prof-social-list': '' });
  for (const s of prof?.socials ?? []) socialList.appendChild(socialRow(s.platform, s.handle));
  const tagList = el('div', 'bz-people-prof-tag-list', { 'data-people-prof-tag-list': '' });
  for (const t of prof?.tags ?? []) tagList.appendChild(tagChip(t));
  const tagInput = profInput('', '加标签…', ['data-people-prof-tag-input', ''], 'bz-people-prof-input bz-people-prof-tag-input');
  return el('div', 'bz-people-prof bz-people-prof-edit', [
    el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text('社交账号')),
      el('div', 'bz-people-prof-social', [
        socialList,
        el('div', 'bz-people-prof-social-tools', [
          button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '+ 社交账号', { 'data-people-prof-add-social': '' }),
        ]),
      ]),
    ]),
    grid('生日', profInput(prof?.birthday ?? '', 'YYYY-MM-DD 或 MM-DD', ['data-people-prof-field', 'birthday'])),
    grid('认识方式', profInput(prof?.metVia ?? '', '怎么认识的', ['data-people-prof-field', 'metVia'])),
    grid('认识时间', profInput(prof?.metAt ?? '', '比如 2023 年夏天', ['data-people-prof-field', 'metAt'])),
    grid('家乡 / 现居', profInput(prof?.hometown ?? '', '家乡 · 现居', ['data-people-prof-field', 'hometown'])),
    grid('职业', profInput(prof?.job ?? '', '职业', ['data-people-prof-field', 'job'])),
    el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text('标签')),
      el('div', 'bz-people-prof-tags-edit', [
        tagList,
        el('div', 'bz-people-prof-tag-tools', [
          tagInput,
          button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '+ 标签', { 'data-people-prof-tag-add': '' }),
        ]),
      ]),
    ]),
    grid('备注', profInput(prof?.note ?? '', '一句话备注', ['data-people-prof-field', 'note'])),
    el('div', 'bz-people-prof-actions', [
      button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', '保存档案', { 'data-people-prof-save': '' }),
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '取消', { 'data-people-prof-cancel': '' }),
    ]),
  ]);
}

function addSocialRow(): void {
  overlay?.querySelector<HTMLElement>('[data-people-prof-social-list]')?.appendChild(socialRow('', ''));
}

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

/** 随手记录入行：日期（默认今天）+ 一句话，显式「记一笔」写盘 */
function buildNoteAddRow(): HTMLElement {
  const date = document.createElement('input');
  date.type = 'date';
  date.className = 'bz-people-prof-input bz-people-note-date';
  date.value = todayStr();
  date.setAttribute('data-people-note-date', '');
  const txt = profInput('', '一句话记下这一天……', ['data-people-note-text', ''], 'bz-people-prof-input bz-people-note-text');
  txt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); void saveManualNote(); }
  });
  return el('div', 'bz-people-note-add', [
    date,
    txt,
    button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', '记一笔', { 'data-people-note-save': '' }),
    button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '收起', { 'data-people-note-cancel': '' }),
  ]);
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
    await store.removeManualEvent(detailId, evId);
    notice('已删除随手记', 'delete');
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
