/**
 * 脸谱面板（issue 435 / ADR-0191）：body 级 overlay 自有面板（favorites 同款骨架；
 * MVP 无 motion / 占位帧）。三个 stage：list（人物列表）/ import（导入：选文件 →
 * 预览确认 → 提炼进度）/ detail（脸谱展示）。
 *
 * 聊天原文只在本层内存流转（ADR-0191）：File 文本 → parse → buildFace → 只落提炼产物。
 * 关闭即弃 pending，原始消息不持久化。
 */
import { notice, notifyActionError } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { getApp } from '../core/app';
import { createAI } from '../core/ai';
import { PeopleStore } from './data';
import { parseWechatExport, type ParsedWechatExport } from './parse';
import { buildFace, type AskLLM } from './digest';
import type { FaceDigest, ImportRecord, PersonEntry } from './types';

const ESC_ID = 'people-panel';

let overlay: HTMLElement | null = null;
let store: PeopleStore | null = null;
let stage: 'list' | 'import' | 'detail' = 'list';
/** 已解析待确认的导入（关闭面板即弃——原文不落盘） */
let pending: (ParsedWechatExport & { file: string }) | null = null;
let detailId: string | null = null;
let fileInput: HTMLInputElement | null = null;
let importing = false;
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
    '    <div class="bz-people-title">脸谱</div>',
    '    <div class="bz-people-head-actions">',
    '      <button type="button" class="bz-people-btn" data-people-import-btn>导入聊天</button>',
    '      <button type="button" class="bz-people-btn bz-people-btn-ghost" data-people-close>关闭</button>',
    '    </div>',
    '  </div>',
    '  <div class="bz-people-body" data-people-body></div>',
    '</div>',
  ].join('');
  document.body.appendChild(overlay);
  topifyZ(overlay);
  registerPanelEsc(ESC_ID, isPeopleOpen, closePeoplePanel);
  trapPanelFocus(overlay.querySelector<HTMLElement>('.bz-people-panel') ?? overlay);
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) { closePeoplePanel(); return; }
    if (t.closest('[data-people-close]')) { closePeoplePanel(); return; }
    if (t.closest('[data-people-import-btn]')) { startImport(); return; }
    if (t.closest('[data-people-pick-btn]')) { pickFile(); return; }
    if (t.closest('[data-people-repick-btn]')) { pending = null; renderBody(); return; }
    if (t.closest('[data-people-confirm-btn]')) { void confirmImport(); return; }
    if (t.closest('[data-people-back-btn]')) { stage = 'list'; pending = null; renderBody(); return; }
    const del = t.closest<HTMLElement>('[data-people-del]');
    if (del) { void handleDelete(del.dataset.peopleDel ?? ''); return; }
    const card = t.closest<HTMLElement>('[data-people-card]');
    if (card) { detailId = card.dataset.peopleCard ?? null; stage = 'detail'; void renderBody(); return; }
  });
  void renderBody();
}

export function closePeoplePanel(): void {
  unregisterPanelEsc(ESC_ID);
  overlay?.remove();
  overlay = null;
  store = null;
  fileInput = null;
  pending = null;
  detailId = null;
  importing = false;
  disarmDelete();
}

/** 直开导入 stage（bz-people-import 命令回调；面板未开先开） */
export function startImport(): void {
  if (!overlay) { openPeoplePanel(); return; }
  if (importing) return;
  stage = 'import';
  renderBody();
  pickFile();
}

async function renderBody(): Promise<void> {
  const body = overlay?.querySelector<HTMLElement>('[data-people-body]');
  if (!body || !store) return;
  if (stage === 'list') await renderList(body);
  else if (stage === 'import') renderImport(body);
  else await renderDetail(body);
}

// ---------------- 列表 ----------------

async function renderList(body: HTMLElement): Promise<void> {
  const people = store ? await store.list() : [];
  body.replaceChildren();
  if (!people.length) {
    body.appendChild(el('div', 'bz-people-empty', [
      el('div', 'bz-people-empty-title', text('还没有脸谱')),
      el('div', 'bz-people-empty-hint', text('用「留痕 MemoTrace」导出微信聊天（CSV / JSON），导入后 AI 会为对方画一张脸谱。')),
      button('bz-people-btn', '导入聊天记录', { 'data-people-import-btn': '' }),
    ]));
    return;
  }
  const list = el('div', 'bz-people-cards');
  for (const p of people) {
    const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
    const span = p.imports.map((r) => r.timeFrom).sort()[0];
    const spanTo = p.imports.map((r) => r.timeTo).sort().pop();
    list.appendChild(el('div', 'bz-people-card', [
      el('div', 'bz-people-card-main', [
        el('div', 'bz-people-card-name', text(p.name)),
        el('div', 'bz-people-card-meta', text([
          total ? `${total} 条消息` : '尚无消息',
          span && spanTo ? `${span.slice(0, 10)} ~ ${spanTo.slice(0, 10)}` : '',
          p.digest ? '已有脸谱' : '未生成',
        ].filter(Boolean).join(' · '))),
      ]),
      button('bz-people-btn bz-people-btn-ghost bz-people-del', deleteArmId === p.id ? '再点确认删除' : '删除', { 'data-people-del': p.id }),
    ])).setAttribute('data-people-card', p.id);
  }
  body.appendChild(list);
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

// ---------------- 导入 ----------------

function pickFile(): void {
  if (!overlay || importing) return;
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
    pending = { ...parseWechatExport(f.name, text), file: f.name };
    stage = 'import';
    renderBody();
  } catch (e) {
    notifyActionError(e, '解析聊天文件');
  }
}

function renderImport(body: HTMLElement): void {
  body.replaceChildren();
  if (importing) {
    body.appendChild(el('div', 'bz-people-progress-wrap', [
      el('div', 'bz-people-empty-title', text('正在提炼聊天记录…')),
      el('div', 'bz-people-progress', { 'data-people-progress': '' }, text('准备中')),
    ]));
    return;
  }
  if (!pending) {
    body.appendChild(el('div', 'bz-people-empty', [
      el('div', 'bz-people-empty-title', text('选择聊天导出文件')),
      el('div', 'bz-people-empty-hint', text('支持「留痕 MemoTrace」导出的 CSV / JSON。聊天原文只在本机内存提炼，不会存进任何文件。')),
      button('bz-people-btn', '选择文件', { 'data-people-pick-btn': '' }),
    ]));
    return;
  }
  const count = pending.messages.length;
  if (!count) {
    body.appendChild(el('div', 'bz-people-empty', [
      el('div', 'bz-people-empty-title', text('这个文件里没有可用的文本消息')),
      el('div', `bz-people-empty-hint`, text(`已跳过 ${pending.skippedCount} 条非文本或无效消息。换一个文件试试。`)),
      button('bz-people-btn', '重选文件', { 'data-people-repick-btn': '' }),
    ]));
    return;
  }
  const from = new Date(pending.messages[0].ts);
  const to = new Date(pending.messages[pending.messages.length - 1].ts);
  const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  body.appendChild(el('div', 'bz-people-confirm', [
    el('div', 'bz-people-confirm-file', text(pending.file)),
    el('div', 'bz-people-card-meta', text(
      `${count} 条文本消息（跳过 ${pending.skippedCount} 条非文本） · ${day(from)} ~ ${day(to)}`
    )),
    fieldRow('称呼', 'text', pending.talker, { 'data-people-name-input': '' }),
    el('div', 'bz-people-confirm-actions', [
      button('bz-people-btn', '重选文件', { 'data-people-repick-btn': '' }),
      button('bz-people-btn bz-people-btn-acc', '开始生成脸谱', { 'data-people-confirm-btn': '' }),
    ]),
  ]));
}

async function confirmImport(): Promise<void> {
  if (!pending || !store || importing) return;
  const nameInput = overlay?.querySelector<HTMLInputElement>('[data-people-name-input]');
  const name = (nameInput?.value ?? '').trim() || pending.talker;
  const parsed = pending;
  importing = true;
  renderBody();
  const progress = () => overlay?.querySelector<HTMLElement>('[data-people-progress]');
  const id = parsed.talker || name;
  try {
    const ai = createAI();
    const askExtract: AskLLM = (p) => ai.json(p);
    const askPortrait: AskLLM = (p) => ai.chat(p);
    notice(`开始提炼 ${parsed.messages.length} 条消息`, 'info');
    const face = await buildFace(askExtract, askPortrait, parsed.messages, name, (done, total) => {
      const p = progress();
      if (p) p.textContent = `提炼中 ${done} / ${total} 批`;
    });
    const now = new Date().toISOString();
    const rec: ImportRecord = {
      file: parsed.file,
      importedAt: now,
      messageCount: parsed.messages.length,
      skippedCount: parsed.skippedCount,
      timeFrom: new Date(parsed.messages[0].ts).toISOString(),
      timeTo: new Date(parsed.messages[parsed.messages.length - 1].ts).toISOString(),
    };
    const existing = (await store.list()).find((p) => p.id === id);
    const entry: PersonEntry = existing
      ? { ...existing, name }
      : { id, name, createdAt: now, imports: [] };
    await store.upsert(entry);
    await store.appendImport(id, rec);
    const digest: FaceDigest = { portrait: face.portrait, events: face.events, generatedAt: now };
    await store.setDigest(id, digest);
    pending = null;
    detailId = id;
    stage = 'detail';
    notice(`「${name}」的脸谱已生成`, 'success');
  } catch (e) {
    notifyActionError(e, '生成脸谱', { onRetry: () => void confirmImport() });
  } finally {
    importing = false;
    void renderBody();
  }
}

// ---------------- 详情 ----------------

async function renderDetail(body: HTMLElement): Promise<void> {
  const people = store ? await store.list() : [];
  const p = people.find((x) => x.id === detailId);
  body.replaceChildren();
  if (!p) { stage = 'list'; await renderList(body); return; }
  body.appendChild(el('div', 'bz-people-detail-head', [
    el('div', 'bz-people-card-name', text(p.name)),
    button('bz-people-btn bz-people-btn-ghost', '返回列表', { 'data-people-back-btn': '' }),
  ]));
  const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
  const meta = [
    total ? `${total} 条消息 · ${p.imports.length} 次导入` : '尚无导入',
    p.digest ? `脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}` : '脸谱未生成',
  ].filter(Boolean).join(' · ');
  body.appendChild(el('div', 'bz-people-card-meta', text(meta)));
  if (p.digest) {
    const portrait = el('div', 'bz-people-portrait');
    renderMiniMarkdown(p.digest.portrait, portrait);
    body.appendChild(portrait);
    if (p.digest.events.length) {
      body.appendChild(el('div', 'bz-people-section-title', text('交往事件')));
      const events = el('div', 'bz-people-events');
      for (const ev of p.digest.events) {
        events.appendChild(el('div', 'bz-people-event', [
          el('span', 'bz-people-event-ts', text(ev.ts)),
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

/** 只认：## / ### 小节、- 列表、**粗体**、普通段落。其余语法原样输出文本。 */
function renderMiniMarkdown(md: string, root: HTMLElement): void {
  let list: HTMLUListElement | null = null;
  for (const raw of md.replace(/```+/g, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { list = null; continue; }
    if (line.startsWith('### ')) { list = null; root.appendChild(textEl('h5', line.slice(4))); continue; }
    if (line.startsWith('## ')) { list = null; root.appendChild(textEl('h4', line.slice(3))); continue; }
    if (line.startsWith('- ')) {
      if (!list) { list = document.createElement('ul'); root.appendChild(list); }
      const li = document.createElement('li');
      appendInline(li, line.slice(2));
      list.appendChild(li);
      continue;
    }
    list = null;
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

// ---------------- DOM 小件 ----------------

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

function fieldRow(label: string, type: string, value: string, attrs: Record<string, string>): HTMLElement {
  const row = el('div', 'bz-people-field');
  const lab = document.createElement('label');
  lab.textContent = label;
  row.appendChild(lab);
  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, v);
  row.appendChild(input);
  return row;
}
