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
}

function onOverlayInput(e: Event): void {
  const el = e.target as HTMLInputElement;
  if (el.matches('[data-people-name]')) {
    names.set(el.dataset.peopleName ?? '', el.value);
  }
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
  const wall = el('div', 'bz-people-wall');
  for (const p of people) {
    const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
    const from = p.imports.map((r) => r.timeFrom).sort()[0];
    const to = p.imports.map((r) => r.timeTo).sort().pop();
    const span = from && to ? `${from.slice(0, 7)} ~ ${to.slice(0, 7)}` : '';
    const card = el('div', 'bz-people-card', [
      el('div', 'bz-people-ava', { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
      el('div', 'bz-people-card-main', [
        el('div', 'bz-people-card-name', text(p.name)),
        el('div', 'bz-people-card-meta', text([total ? `${total} 条消息` : '尚无消息', span].filter(Boolean).join(' · '))),
        el('div', `bz-people-chip ${p.digest ? 'bz-people-chip-on' : ''}`, text(p.digest ? '已画脸谱' : '待生成')),
      ]),
      button('bz-people-btn bz-people-btn-ghost bz-people-del', deleteArmId === p.id ? '再点确认删除' : '删除', { 'data-people-del': p.id }),
    ]);
    card.setAttribute('data-people-card', p.id);
    wall.appendChild(card);
  }
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
    button('bz-people-btn', '再导一次聊天（重画脸谱）', { 'data-people-import-btn': '' }),
  ]));
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
