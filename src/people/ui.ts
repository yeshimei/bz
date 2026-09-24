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
import { buildFace, type AskLLM } from './digest';
import type { FaceDigest, ImportRecord, PersonEntry } from './types';

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
let runResult: { ok: number; failed: string[] } | null = null;
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
  sortKey = 'recent';
  filterTag = '';
  searchText = '';
  listCache = [];
  mergeFromId = null;
  mergeToId = null;
  disarmDelete();
}

/** 直开导入向导（bz-people-import 命令回调；面板未开先开） */
export function startImport(): void {
  if (!overlay) { openPeoplePanel(); return; }
  if (running) return;
  stage = 'import';
  step = pending ? 'pick' : 'file';
  renderBody();
  if (step === 'file') pickFile();
}

// ---------------- 事件委托 ----------------

function onOverlayClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  if (e.target === overlay) { closePeoplePanel(); return; }
  if (t.closest('[data-people-close]')) { closePeoplePanel(); return; }
  if (t.closest('[data-people-import-btn]')) { if (!running) startImport(); return; }
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
}

function onOverlayChange(e: Event): void {
  const el = e.target as HTMLInputElement;
  if (el.matches('[data-people-check]')) {
    const tk = el.dataset.peopleCheck ?? '';
    if (el.checked) selected.add(tk); else selected.delete(tk);
    updatePickFooter();
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
        el('div', 'bz-people-merge-text', text(`确认合并：把「${from.name}」的导入记录与随手记并到「${to.name}」，「${from.name}」将被删除。`)),
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
    el('div', 'bz-people-pick-count', { 'data-people-count': '' }, text(selectedCountLabel(contacts))),
    button('bz-people-btn bz-people-btn-acc', '开始生成脸谱', { 'data-people-start': '' }),
  ]));
}

function updatePickFooter(): void {
  const el2 = overlay?.querySelector<HTMLElement>('[data-people-count]');
  if (el2) el2.textContent = selectedCountLabel(pending?.contacts ?? []);
  // 勾选态行高亮
  overlay?.querySelectorAll<HTMLElement>('[data-people-check]').forEach((cb) => {
    const input = cb as HTMLInputElement;
    const row = input.closest('.bz-people-pick-row');
    if (row) row.classList.toggle('bz-people-pick-on', input.checked);
  });
}

function selectedCountLabel(contacts: ContactGroup[]): string {
  const n = contacts.filter((c) => c.messages.length > 0 && selected.has(c.talker)).length;
  return `已选 ${n} 位`;
}

function renderRun(body: HTMLElement): void {
  if (runResult) {
    body.appendChild(el('div', 'bz-people-empty', [
      el('div', 'bz-people-empty-mark', text('成')),
      el('div', 'bz-people-empty-title', text(`已生成 ${runResult.ok} 张脸谱`)),
      el('div', 'bz-people-empty-hint', text(runResult.failed.length ? `失败 ${runResult.failed.length} 位：${runResult.failed.join('、')}。可稍后重试。` : '点开卡片查看画像与交往事件。')),
      button('bz-people-btn bz-people-btn-acc', '回到列表', { 'data-people-back-btn': '' }),
    ]));
    return;
  }
  body.appendChild(el('div', 'bz-people-run', [
    el('div', 'bz-people-run-main', { 'data-people-run-main': '' }, text(runMain || '准备中…')),
    el('div', 'bz-people-run-sub', { 'data-people-run-sub': '' }, text(runSub)),
  ]));
}

async function runGeneration(): Promise<void> {
  if (!pending || !store || running) return;
  const targets = pending.contacts
    .filter((c) => c.messages.length > 0 && selected.has(c.talker))
    .map((c) => ({ talker: c.talker, name: (names.get(c.talker) ?? '').trim() || displayName(c.talker), group: c }));
  if (!targets.length) { notice('还没有勾选联系人', 'warning'); return; }
  const file = pending.file;
  running = true;
  step = 'run';
  runResult = null;
  renderBody();
  const ai = createAI();
  const askExtract: AskLLM = (p) => ai.json(p);
  const askPortrait: AskLLM = (p) => ai.chat(p);
  let ok = 0;
  const failed: string[] = [];
  for (let i = 0; i < targets.length; i++) {
    const { talker, name, group } = targets[i];
    setRun(`正在生成「${name}」（${i + 1}/${targets.length}）`, '');
    try {
      const face = await buildFace(askExtract, askPortrait, group.messages, name, (done, total) => {
        setRun(`正在生成「${name}」（${i + 1}/${targets.length}）`, `第 ${done} / ${total} 批`);
      });
      const now = new Date().toISOString();
      const rec: ImportRecord = {
        file,
        importedAt: now,
        messageCount: group.messages.length,
        skippedCount: group.skippedCount,
        timeFrom: new Date(group.messages[0].ts).toISOString(),
        timeTo: new Date(group.messages[group.messages.length - 1].ts).toISOString(),
      };
      const existing = (await store.list()).find((p) => p.id === talker);
      const entry: PersonEntry = existing ? { ...existing, name } : { id: talker, name, createdAt: now, imports: [] };
      await store.upsert(entry);
      await store.appendImport(talker, rec);
      const digest: FaceDigest = {
        portrait: face.portrait,
        events: face.events,
        quotes: face.quotes,
        chronicle: face.chronicle || undefined,
        generatedAt: now,
      };
      await store.setDigest(talker, digest);
      ok++;
    } catch (e) {
      failed.push(name);
      console.warn('[people] 生成失败:', name, e);
    }
  }
  running = false;
  runResult = { ok, failed };
  pending = null;
  notice(failed.length ? `已生成 ${ok} 张脸谱，${failed.length} 位失败` : `已生成 ${ok} 张脸谱`, failed.length ? 'warning' : 'success');
  renderBody();
}

function setRun(main: string, sub: string): void {
  runMain = main;
  runSub = sub;
  const m = overlay?.querySelector<HTMLElement>('[data-people-run-main]');
  const s = overlay?.querySelector<HTMLElement>('[data-people-run-sub]');
  if (m) m.textContent = main;
  if (s) s.textContent = sub;
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
  body.appendChild(el('div', 'bz-people-detail-head', [
    el('div', 'bz-people-detail-id', [
      el('div', 'bz-people-ava bz-people-ava-lg', { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
      el('div', '', [
        el('div', 'bz-people-detail-name', text(p.name)),
        el('div', 'bz-people-card-meta', text([
          p.imports.reduce((s, r) => s + r.messageCount, 0) ? `${p.imports.reduce((s, r) => s + r.messageCount, 0)} 条消息 · ${p.imports.length} 次导入` : '尚无导入',
          p.digest ? `脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}` : '脸谱未生成',
        ].join(' · '))),
      ]),
    ]),
    button('bz-people-btn bz-people-btn-ghost', '返回列表', { 'data-people-back-btn': '' }),
  ]));
  if (p.digest) {
    const portrait = el('div', 'bz-people-portrait');
    renderMiniMarkdown(p.digest.portrait, portrait);
    body.appendChild(portrait);
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
  }
  body.appendChild(el('div', 'bz-people-detail-foot', [
    button('bz-people-btn bz-people-btn-ghost', '导出为笔记', { 'data-people-export': '' }),
    button('bz-people-btn', '再导一次聊天（重画脸谱）', { 'data-people-import-btn': '' }),
  ]));
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
    const side = el('div', 'bz-people-card-side');
    if (canMerge && !mergeFromId) {
      side.appendChild(button('bz-people-btn bz-people-btn-ghost', '合并到…', { 'data-people-merge': p.id }));
    }
    side.appendChild(button('bz-people-btn bz-people-btn-ghost bz-people-del', deleteArmId === p.id ? '再点确认删除' : '删除', { 'data-people-del': p.id }));
    const card = el('div', 'bz-people-card', [
      el('div', 'bz-people-ava', { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
      el('div', 'bz-people-card-main', [
        el('div', 'bz-people-card-name', text(p.name)),
        el('div', 'bz-people-card-meta', text([total ? `${total} 条消息` : '尚无消息', span].filter(Boolean).join(' · '))),
        el('div', `bz-people-chip ${p.digest ? 'bz-people-chip-on' : ''}`, text(p.digest ? '已画脸谱' : '待生成')),
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
