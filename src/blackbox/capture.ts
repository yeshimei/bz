/**
 * 黑匣子录入弹窗（ticket 40/41）：bz-blackbox-capture「录入」三类型切换。
 * 🧩 概念：名词 → ✨ 生成知识卡片（定义 + 关联概念）→ 确认录入（无感触外壳）；
 * 📎 文献：摘抄 + 来源 → ✨ 分析名词表勾选关联 → 可带出想法（同一次保存写 thought 条目）→ 感触外壳；
 * 💡 想法：想法 + 可选 AI 辅助（⚡ 联想 / 🔍 查概念 / ❓ 追问）→ 感触外壳。
 * 涉及的人 = 画像选择器（匹配补全 / 现场新建画像 / 仅存名字，≤5）；情绪 24 词多选 ≤3 无强度。
 * AI 不可用：三类纯文本录入仍可保存（无卡片/无名词表/无辅助），黑匣子永不拒收。
 * 保存后阈值命中 → 静默复盘（triggerAutoReview，不打扰）。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { createOverlay } from '../core/dom';
import { notice } from '../core/notice';
import { BlackBoxAI, fallbackAsk, parseConceptJson, parseLiteratureJson } from './ai';
import { BlackBoxDataManager, createEntry, createProfile } from './data';
import { triggerAutoReview } from './review';
import { DIRECTION_OPTIONS, MAX_EMOTIONS, MAX_PEOPLE } from './types';
import type { BlackBoxData, Direction, Entry, Profile } from './types';

let appRef: App | null = null;
let dataManager: BlackBoxDataManager | null = null;
let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;

type CaptureType = 'concept' | 'literature' | 'thought';

let activeType: CaptureType = 'thought';
/** 情绪词表（弹窗打开时从数据加载，设置增删实时生效） */
let emotionWords: string[] = [];
/** 画像库（弹窗打开时加载，选择器补全用） */
let profiles: Profile[] = [];
/** 数据快照（弹窗打开时加载；保存前重载防并发覆盖） */
let data: BlackBoxData | null = null;

// 感触外壳（literature/thought 共享；concept 不显示）
let selectedTags: string[] = [];
let peopleChips: string[] = [];
let direction: Direction = '';
/** 新建画像 mini 表单展开态 */
let newProfileOpen = false;

// 概念表单
let conceptName = '';
let conceptGenerated: { definition: string; relatedIds: string[] } | null = null;
// 文献表单
let literatureTerms: Set<string> = new Set(); // 勾选的概念 id
let literatureSuggest: { id: string | null; label: string; checked: boolean }[] = [];
let carryThoughtOpen = false;
// 想法表单（无额外状态，text 存 DOM）

function manager(app: App): BlackBoxDataManager {
  if (!dataManager) dataManager = new BlackBoxDataManager(app);
  return dataManager;
}

/** 打开录入弹窗（幂等；异步加载词表/画像库/数据快照） */
export async function openBlackBoxCapture(app: App): Promise<void> {
  appRef = app;
  if (maskEl) {
    maskEl.style.display = 'block';
    return;
  }
  data = await manager(app).load();
  emotionWords = data.settings.words;
  profiles = data.profiles;
  activeType = 'thought';
  selectedTags = [];
  peopleChips = [];
  direction = '';
  newProfileOpen = false;
  conceptName = '';
  conceptGenerated = null;
  literatureTerms = new Set();
  literatureSuggest = [];
  carryThoughtOpen = false;
  // 文本状态一并重置（防重开残留上次内容导致重复录入）
  literatureText = '';
  literatureSource = '';
  carryThoughtText = '';
  thoughtText = '';
  sceneText = '';
  linksText = '';
  buildDOM();
  renderType();
}

export function closeBlackBoxCapture(): void {
  // mask 与 popup 是 body 下兄弟元素（createOverlay），必须同时移除——否则 popup 残留盖屏拦截点击
  if (maskEl) {
    maskEl.remove();
    maskEl = null;
  }
  if (popupEl) {
    popupEl.remove();
    popupEl = null;
  }
  if (escHandle) {
    escHandle.unregister();
    escHandle = null;
  }
}

export function unloadBlackBoxCapture(): void {
  closeBlackBoxCapture();
  dataManager = null;
  appRef = null;
  data = null;
}

// ---------------- DOM ----------------

function buildDOM(): void {
  const { mask, popup } = createOverlay({
    maskId: 'bz-blackbox-capture-mask',
    popupId: 'bz-blackbox-capture-popup',
    zIndex: 10040,
    width: '520px',
    maxWidth: 520,
    onMaskClick: () => closeBlackBoxCapture(),
  });
  maskEl = mask;
  popupEl = popup;
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  // header
  const header = document.createElement('div');
  header.className = 'bz-blackbox-modal-header';
  header.textContent = '🕳️ 录入';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'bz-blackbox-modal-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closeBlackBoxCapture());
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // 三类型切换胶囊
  const tabs = document.createElement('div');
  tabs.className = 'bz-blackbox-type-tabs';
  const tabDefs: { type: CaptureType; label: string }[] = [
    { type: 'concept', label: '🧩 概念' },
    { type: 'literature', label: '📎 文献' },
    { type: 'thought', label: '💡 想法' },
  ];
  for (const t of tabDefs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.type = t.type;
    btn.className = 'bz-blackbox-type-btn';
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      collectDOMState();
      activeType = t.type;
      renderType();
    });
    tabs.appendChild(btn);
  }
  popup.appendChild(tabs);

  // 三个 tab 内容容器（切换保留 DOM 即保留已填内容）
  const conceptTab = document.createElement('div');
  conceptTab.className = 'bz-blackbox-tab';
  conceptTab.id = 'bz-blackbox-tab-concept';
  popup.appendChild(conceptTab);
  const literatureTab = document.createElement('div');
  literatureTab.className = 'bz-blackbox-tab';
  literatureTab.id = 'bz-blackbox-tab-literature';
  popup.appendChild(literatureTab);
  const thoughtTab = document.createElement('div');
  thoughtTab.className = 'bz-blackbox-tab';
  thoughtTab.id = 'bz-blackbox-tab-thought';
  popup.appendChild(thoughtTab);

  // 感触外壳（literature/thought 共享）
  const shell = buildShell();
  popup.appendChild(shell);

  // footer
  const footer = document.createElement('div');
  footer.className = 'bz-blackbox-modal-footer';
  const cancel = document.createElement('button');
  cancel.textContent = '取消';
  cancel.className = 'bz-blackbox-btn';
  cancel.addEventListener('click', () => closeBlackBoxCapture());
  const save = document.createElement('button');
  save.id = 'bz-blackbox-save';
  save.textContent = '存入黑匣子';
  save.className = 'bz-blackbox-btn bz-blackbox-btn-primary';
  save.addEventListener('click', () => void saveEntry());
  footer.append(cancel, save);
  popup.appendChild(footer);

  escHandle = escManager.register('blackbox-capture', { isVisible: () => !!maskEl, close: () => closeBlackBoxCapture() });
}

/** 感触外壳（情绪/涉及的人/场景/指向/链接） */
function buildShell(): HTMLElement {
  const details = document.createElement('details');
  details.className = 'bz-blackbox-details';
  details.id = 'bz-blackbox-shell';
  const summary = document.createElement('summary');
  summary.textContent = '感触（情绪/涉及的人，可选）';
  details.appendChild(summary);

  details.appendChild(fieldLabel('情绪', `最多 ${MAX_EMOTIONS} 个`));
  const emotionRow = document.createElement('div');
  emotionRow.className = 'bz-blackbox-emotions';
  emotionRow.id = 'bz-blackbox-emotions';
  details.appendChild(emotionRow);

  details.appendChild(fieldLabel('涉及的人', `最多 ${MAX_PEOPLE} 个：输入名字回车，或从已有画像选择`));
  const peopleRow = document.createElement('div');
  peopleRow.className = 'bz-blackbox-people-row';
  peopleRow.id = 'bz-blackbox-people-row';
  details.appendChild(peopleRow);

  details.appendChild(fieldLabel('场景', '当时在做什么'));
  const scene = document.createElement('input');
  scene.id = 'bz-blackbox-scene';
  scene.className = 'bz-blackbox-input';
  scene.placeholder = '深夜通勤、午休、看完那本书……';
  details.appendChild(scene);

  details.appendChild(fieldLabel('指向', '这条感触关于谁'));
  const dirRow = document.createElement('div');
  dirRow.className = 'bz-blackbox-dir-row';
  for (const opt of DIRECTION_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.dir = opt.value;
    btn.textContent = opt.label;
    btn.className = 'bz-blackbox-dir';
    btn.addEventListener('click', () => {
      direction = direction === opt.value ? '' : opt.value;
      renderDirection(dirRow);
    });
    dirRow.appendChild(btn);
  }
  details.appendChild(dirRow);

  details.appendChild(fieldLabel('链接', '逗号分隔：URL 或 [[笔记]]'));
  const links = document.createElement('input');
  links.id = 'bz-blackbox-links';
  links.className = 'bz-blackbox-input';
  links.placeholder = 'https://…, [[某篇笔记]]';
  details.appendChild(links);
  return details;
}

function fieldLabel(text: string, hint: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'bz-blackbox-field-label';
  const label = document.createElement('span');
  label.textContent = text;
  wrap.appendChild(label);
  if (hint) {
    const h = document.createElement('span');
    h.className = 'bz-blackbox-field-hint';
    h.textContent = hint;
    wrap.appendChild(h);
  }
  return wrap;
}

// ---------------- tab 渲染 ----------------

function renderType(): void {
  // 切换时把 DOM 值写回状态（people chips/情绪已由事件维护，其余读 DOM）
  collectDOMState();
  const tabs = document.querySelectorAll('.bz-blackbox-type-btn');
  for (const b of Array.from(tabs)) {
    (b as HTMLElement).classList.toggle('bz-blackbox-type-btn-on', (b as HTMLElement).dataset.type === activeType);
  }
  for (const t of ['concept', 'literature', 'thought'] as CaptureType[]) {
    const tab = document.getElementById(`bz-blackbox-tab-${t}`);
    if (tab) tab.style.display = t === activeType ? 'block' : 'none';
  }
  const shell = document.getElementById('bz-blackbox-shell');
  if (shell) shell.style.display = activeType === 'concept' ? 'none' : 'block';
  renderConceptTab();
  renderLiteratureTab();
  renderThoughtTab();
  renderEmotions();
  renderPeopleChips();
  renderDirection(document.querySelector('.bz-blackbox-dir-row') as HTMLElement);
}

/** 将各 tab DOM 值写回状态（切换/保存前调用，保证不丢） */
function collectDOMState(): void {
  const cn = document.getElementById('bz-blackbox-concept-name') as HTMLInputElement;
  if (cn) conceptName = cn.value.trim();
  const lt = document.getElementById('bz-blackbox-lit-text') as HTMLTextAreaElement;
  const ls = document.getElementById('bz-blackbox-lit-source') as HTMLInputElement;
  if (lt) literatureText = lt.value;
  if (ls) literatureSource = ls.value;
  const carry = document.getElementById('bz-blackbox-carry-text') as HTMLTextAreaElement;
  if (carry) carryThoughtText = carry.value;
  const th = document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement;
  if (th) thoughtText = th.value;
  const sc = document.getElementById('bz-blackbox-scene') as HTMLInputElement;
  if (sc) sceneText = sc.value;
  const lk = document.getElementById('bz-blackbox-links') as HTMLInputElement;
  if (lk) linksText = lk.value;
}

// 文献/想法/外壳 DOM 值（collectDOMState 同步）
let literatureText = '';
let literatureSource = '';
let carryThoughtText = '';
let thoughtText = '';
let sceneText = '';
let linksText = '';

// ----- 概念 tab -----
function renderConceptTab(): void {
  const tab = document.getElementById('bz-blackbox-tab-concept');
  if (!tab) return;
  tab.innerHTML = '';
  tab.appendChild(fieldLabel('名词', '想搞懂的概念或实体，如「提喻法」'));
  const nameInput = document.createElement('input');
  nameInput.id = 'bz-blackbox-concept-name';
  nameInput.className = 'bz-blackbox-input';
  nameInput.placeholder = '输入一个名词';
  nameInput.value = conceptName;
  nameInput.addEventListener('input', () => {
    conceptName = nameInput.value.trim();
    conceptGenerated = null;
    renderConceptPreview(tab);
  });
  tab.appendChild(nameInput);

  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.id = 'bz-blackbox-concept-gen';
  genBtn.className = 'bz-blackbox-ai-btn';
  genBtn.textContent = '✨ 生成卡片';
  genBtn.addEventListener('click', () => void generateConcept(tab, genBtn));
  tab.appendChild(genBtn);

  const preview = document.createElement('div');
  preview.id = 'bz-blackbox-concept-preview';
  preview.className = 'bz-blackbox-concept-preview';
  tab.appendChild(preview);
  renderConceptPreview(tab);
}

function renderConceptPreview(tab: HTMLElement): void {
  const preview = document.getElementById('bz-blackbox-concept-preview');
  if (!preview) return;
  preview.innerHTML = '';
  if (!conceptName) return;
  if (!conceptGenerated) {
    const tip = document.createElement('div');
    tip.className = 'bz-blackbox-ai-msg bz-blackbox-ai-fallback';
    tip.textContent = '点「✨ 生成卡片」，让包仔先认识这个概念';
    preview.appendChild(tip);
    return;
  }
  const card = document.createElement('div');
  card.className = 'bz-blackbox-concept-card';
  const def = document.createElement('div');
  def.className = 'bz-blackbox-concept-def';
  def.textContent = conceptGenerated.definition;
  card.appendChild(def);
  if (conceptGenerated.relatedIds.length) {
    const rel = document.createElement('div');
    rel.className = 'bz-blackbox-concept-related';
    rel.textContent = `🔗 关联：${conceptGenerated.relatedIds.map((id) => conceptNameById(id)).join('、')}`;
    card.appendChild(rel);
  }
  preview.appendChild(card);
  const actions = document.createElement('div');
  actions.className = 'bz-blackbox-ai-row';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.id = 'bz-blackbox-concept-confirm';
  confirm.className = 'bz-blackbox-btn bz-blackbox-btn-primary';
  confirm.textContent = '确认录入';
  confirm.addEventListener('click', () => void saveEntry());
  const regen = document.createElement('button');
  regen.type = 'button';
  regen.id = 'bz-blackbox-concept-regen';
  regen.className = 'bz-blackbox-ai-btn';
  regen.textContent = '重新生成';
  regen.addEventListener('click', () => void generateConcept(tab, null));
  actions.append(confirm, regen);
  preview.appendChild(actions);
}

async function generateConcept(tab: HTMLElement, btn: HTMLButtonElement | null): Promise<void> {
  if (!appRef || !data) return;
  const name = conceptName;
  if (!name) {
    notice('⚠️ 先输入要查的名词');
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳';
  }
  try {
    const ai = new BlackBoxAI();
    const existing = data.entries.filter((e) => e.type === 'concept');
    const raw = await ai.assist('concept', name, undefined, existing);
    if (!maskEl) return; // 弹窗已关
    const parsed = parseConceptJson(raw);
    if (parsed) {
      conceptGenerated = {
        definition: parsed.definition,
        relatedIds: parsed.relatedNames
          .map((n) => existing.find((c) => !!c.name && (c.name === n || c.name.includes(n) || n.includes(c.name))))
          .filter((c): c is Entry => !!c)
          .map((c) => c.id),
      };
    } else {
      conceptGenerated = { definition: raw, relatedIds: [] };
      notice('⚠️ 卡片生成不完整（已按纯文本保留）');
    }
  } catch (e) {
    notice('❌ 生成失败：AI 暂时无法说话', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✨ 生成卡片';
    }
    renderConceptPreview(tab);
  }
}

function conceptNameById(id: string): string {
  if (!data) return id;
  const c = data.entries.find((e) => e.id === id);
  return c ? c.name || id : id;
}

// ----- 文献 tab -----
function renderLiteratureTab(): void {
  const tab = document.getElementById('bz-blackbox-tab-literature');
  if (!tab) return;
  tab.innerHTML = '';
  tab.appendChild(fieldLabel('摘抄（必填）', '从别处摘下的信息片段'));
  const text = document.createElement('textarea');
  text.id = 'bz-blackbox-lit-text';
  text.className = 'bz-blackbox-textarea';
  text.placeholder = '粘贴摘抄内容……';
  text.value = literatureText;
  text.addEventListener('input', () => (literatureText = text.value));
  tab.appendChild(text);

  tab.appendChild(fieldLabel('来源', 'URL 或书名/出处'));
  const source = document.createElement('input');
  source.id = 'bz-blackbox-lit-source';
  source.className = 'bz-blackbox-input';
  source.placeholder = 'https://… 或《书名》';
  source.value = literatureSource;
  source.addEventListener('input', () => (literatureSource = source.value));
  tab.appendChild(source);

  const analyzeBtn = document.createElement('button');
  analyzeBtn.type = 'button';
  analyzeBtn.id = 'bz-blackbox-lit-analyze';
  analyzeBtn.className = 'bz-blackbox-ai-btn';
  analyzeBtn.textContent = '✨ 分析名词';
  analyzeBtn.addEventListener('click', () => void analyzeLiterature(tab, analyzeBtn));
  tab.appendChild(analyzeBtn);

  const termsBox = document.createElement('div');
  termsBox.id = 'bz-blackbox-lit-terms';
  termsBox.className = 'bz-blackbox-lit-terms';
  tab.appendChild(termsBox);
  renderLiteratureTerms(tab);

  // 带出想法（折叠）
  const details = document.createElement('details');
  details.className = 'bz-blackbox-details';
  details.id = 'bz-blackbox-carry';
  const summary = document.createElement('summary');
  summary.textContent = '💡 带出想法？';
  details.appendChild(summary);
  const hint = document.createElement('div');
  hint.className = 'bz-blackbox-field-hint';
  hint.textContent = '摘抄引出的想法，同一次录入（将作为独立想法条目保存）';
  details.appendChild(hint);
  const carry = document.createElement('textarea');
  carry.id = 'bz-blackbox-carry-text';
  carry.className = 'bz-blackbox-textarea';
  carry.placeholder = '这段摘抄让我想到……';
  carry.value = carryThoughtText;
  carry.addEventListener('input', () => (carryThoughtText = carry.value));
  details.appendChild(carry);
  if (carryThoughtOpen) details.open = true;
  details.addEventListener('toggle', () => (carryThoughtOpen = details.open));
  tab.appendChild(details);
}

function renderLiteratureTerms(tab: HTMLElement): void {
  const box = document.getElementById('bz-blackbox-lit-terms');
  if (!box) return;
  box.innerHTML = '';
  if (!literatureSuggest.length) {
    const tip = document.createElement('div');
    tip.className = 'bz-blackbox-ai-msg bz-blackbox-ai-fallback';
    tip.textContent = '点「✨ 分析名词」，让包仔找出摘抄里的概念';
    box.appendChild(tip);
    return;
  }
  const label = document.createElement('div');
  label.className = 'bz-blackbox-field-label';
  label.textContent = '名词表（勾选要关联的概念）';
  box.appendChild(label);
  const chips = document.createElement('div');
  chips.className = 'bz-blackbox-term-chips';
  for (const s of literatureSuggest) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'bz-blackbox-term-chip' + (s.checked ? ' bz-blackbox-term-chip-on' : '');
    chip.textContent = (s.checked ? '✓ ' : '') + s.label + (s.id ? '' : ' ✦');
    chip.title = s.id ? '已有概念' : '新概念（确认后录入为概念卡片）';
    chip.addEventListener('click', () => {
      s.checked = !s.checked;
      if (s.checked && s.id) literatureTerms.add(s.id);
      if (!s.checked && s.id) literatureTerms.delete(s.id);
      renderLiteratureTerms(tab);
    });
    chips.appendChild(chip);
  }
  box.appendChild(chips);
}

async function analyzeLiterature(tab: HTMLElement, btn: HTMLButtonElement): Promise<void> {
  if (!appRef || !data) return;
  const text = literatureText.trim();
  if (!text) {
    notice('⚠️ 先粘贴摘抄内容');
    return;
  }
  btn.disabled = true;
  btn.textContent = '⏳';
  try {
    const ai = new BlackBoxAI();
    const existing = data.entries.filter((e) => e.type === 'concept');
    const input = `来源：${literatureSource || '未知'}\n摘抄：${text.slice(0, 800)}`;
    const raw = await ai.assist('literature', input, undefined, existing);
    if (!maskEl) return; // 弹窗已关
    const parsed = parseLiteratureJson(raw);
    literatureTerms = new Set();
    literatureSuggest = [];
    if (parsed) {
      for (const n of parsed.matched) {
        const c = existing.find((x) => !!x.name && (x.name === n || x.name.includes(n) || n.includes(x.name)));
        if (c) {
          literatureSuggest.push({ id: c.id, label: c.name || n, checked: true });
          literatureTerms.add(c.id);
        }
      }
      for (const n of parsed.newConcepts) {
        if (!literatureSuggest.some((s) => s.label === n)) {
          literatureSuggest.push({ id: null, label: n, checked: false });
        }
      }
    } else {
      notice('⚠️ 分析结果无法识别（已按原文保留，可直接录入）');
    }
  } catch (e) {
    notice('❌ 分析失败：AI 暂时无法说话', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ 分析名词';
    renderLiteratureTerms(tab);
  }
}

// ----- 想法 tab -----
function renderThoughtTab(): void {
  const tab = document.getElementById('bz-blackbox-tab-thought');
  if (!tab) return;
  tab.innerHTML = '';
  tab.appendChild(fieldLabel('想法（必填）', '你自己的思考、感受、念头'));
  const text = document.createElement('textarea');
  text.id = 'bz-blackbox-thought-text';
  text.className = 'bz-blackbox-textarea';
  text.placeholder = '此刻在想什么……';
  text.value = thoughtText;
  text.addEventListener('input', () => (thoughtText = text.value));
  tab.appendChild(text);

  const aiRow = document.createElement('div');
  aiRow.className = 'bz-blackbox-ai-row';
  const recall = mkAiBtn('⚡ 联想', () => void runThoughtAssist('recall'));
  const concept = mkAiBtn('🔍 查概念', () => openConceptLookup());
  const ask = mkAiBtn('❓ 追问', () => void runThoughtAssist('ask'));
  aiRow.append(recall, concept, ask);
  tab.appendChild(aiRow);
  const result = document.createElement('div');
  result.id = 'bz-blackbox-ai-result';
  result.className = 'bz-blackbox-ai-result';
  tab.appendChild(result);
}

function mkAiBtn(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bz-blackbox-ai-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

// ---------------- 感触外壳渲染 ----------------

function renderEmotions(): void {
  const row = document.getElementById('bz-blackbox-emotions');
  if (!row) return;
  row.innerHTML = '';
  for (const tag of emotionWords) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'bz-blackbox-chip' + (selectedTags.includes(tag) ? ' bz-blackbox-chip-on' : '');
    chip.textContent = tag;
    chip.addEventListener('click', () => toggleTag(tag));
    row.appendChild(chip);
  }
}

function toggleTag(tag: string): void {
  const i = selectedTags.indexOf(tag);
  if (i >= 0) {
    selectedTags.splice(i, 1);
  } else {
    if (selectedTags.length >= MAX_EMOTIONS) {
      notice(`⚠️ 最多选 ${MAX_EMOTIONS} 个情绪`);
      return;
    }
    selectedTags.push(tag);
  }
  renderEmotions();
}

/** 涉及的人：chips + 输入框（补全建议 / 回车添加）+ 新建画像 */
function renderPeopleChips(): void {
  const row = document.getElementById('bz-blackbox-people-row');
  if (!row) return;
  row.innerHTML = '';
  const chips = document.createElement('div');
  chips.className = 'bz-blackbox-people-chips';
  for (const p of peopleChips) {
    const chip = document.createElement('span');
    chip.className = 'bz-blackbox-people-tag';
    chip.textContent = personLabel(p);
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'bz-blackbox-people-remove';
    x.textContent = '✕';
    x.addEventListener('click', () => {
      peopleChips = peopleChips.filter((q) => q !== p);
      renderPeopleChips();
    });
    chip.appendChild(x);
    chips.appendChild(chip);
  }
  row.appendChild(chips);

  const inputWrap = document.createElement('div');
  inputWrap.className = 'bz-blackbox-people-input-wrap';
  const input = document.createElement('input');
  input.id = 'bz-blackbox-people-input';
  input.className = 'bz-blackbox-input';
  input.placeholder = '输入名字，回车添加；可匹配已有画像';
  inputWrap.appendChild(input);

  // 补全建议下拉
  const suggest = document.createElement('div');
  suggest.className = 'bz-blackbox-people-suggest';
  suggest.id = 'bz-blackbox-people-suggest';
  inputWrap.appendChild(suggest);
  input.addEventListener('input', () => renderSuggest(input, suggest));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      addPeople(v);
    }
  });
  input.addEventListener('blur', () => {
    // 延迟隐藏建议（点击建议项先于 blur 触发）
    setTimeout(() => (suggest.style.display = 'none'), 150);
  });
  row.appendChild(inputWrap);

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.id = 'bz-blackbox-profile-new';
  newBtn.className = 'bz-blackbox-ai-btn';
  newBtn.textContent = '➕ 新建画像';
  newBtn.addEventListener('click', () => {
    newProfileOpen = !newProfileOpen;
    renderPeopleChips();
  });
  row.appendChild(newBtn);

  if (newProfileOpen) {
    const form = document.createElement('div');
    form.className = 'bz-blackbox-profile-form';
    form.id = 'bz-blackbox-profile-form';
    const name = document.createElement('input');
    name.id = 'bz-blackbox-profile-form-name';
    name.className = 'bz-blackbox-input';
    name.placeholder = '名字（必填）';
    const relation = document.createElement('input');
    relation.id = 'bz-blackbox-profile-form-relation';
    relation.className = 'bz-blackbox-input';
    relation.placeholder = '关系（可选，如 家人/前任）';
    const create = document.createElement('button');
    create.type = 'button';
    create.id = 'bz-blackbox-profile-form-create';
    create.className = 'bz-blackbox-btn bz-blackbox-btn-primary';
    create.textContent = '创建并关联';
    create.addEventListener('click', () => void createProfileNow(name.value.trim(), relation.value.trim()));
    form.append(name, relation, create);
    row.appendChild(form);
  }
}

/** 录入弹窗内的现场新建画像（冷启动双路径） */
async function createProfileNow(name: string, relation: string): Promise<void> {
  if (!appRef || !data) return;
  if (!name) {
    notice('⚠️ 画像名字不能为空');
    return;
  }
  if (profiles.some((p) => p.name === name)) {
    notice('⚠️ 已有同名画像，直接选择即可');
    return;
  }
  const pf = await createProfileWithSeed(appRef, name, relation);
  const latest = await manager(appRef).load();
  data = latest;
  profiles = latest.profiles;
  addPeople(pf.id);
  newProfileOpen = false;
  renderPeopleChips();
  notice(`✅ 画像「${name}」已创建`);
}

function renderSuggest(input: HTMLInputElement, suggest: HTMLElement): void {
  const q = input.value.trim();
  suggest.innerHTML = '';
  if (!q) {
    suggest.style.display = 'none';
    return;
  }
  const hits = profiles.filter((p) => p.name.includes(q) && !peopleChips.includes(p.id));
  if (!hits.length) {
    suggest.style.display = 'none';
    return;
  }
  suggest.style.display = 'block';
  for (const p of hits) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'bz-blackbox-people-suggest-item';
    item.textContent = `${p.name}${p.relation ? `（${p.relation}）` : ''}`;
    item.addEventListener('click', () => {
      addPeople(p.id);
      input.value = '';
      suggest.style.display = 'none';
    });
    suggest.appendChild(item);
  }
}

/** 添加涉及的人：名字精确匹配已有画像 → 画像 id；否则存纯名字 */
function addPeople(v: string): void {
  if (peopleChips.length >= MAX_PEOPLE) {
    notice(`⚠️ 最多 ${MAX_PEOPLE} 个人`);
    return;
  }
  const pf = profiles.find((p) => p.name === v);
  const key = pf ? pf.id : v;
  if (peopleChips.includes(key)) return;
  peopleChips.push(key);
  renderPeopleChips();
}

/** 现场新建画像（冷启动双路径，capture 与主面板共用）：创建画像 → 关联当前条目 → AI 异步提炼初始印象 */
export async function createProfileWithSeed(app: App, name: string, relation: string): Promise<Profile> {
  const m = manager(app);
  const latest = await m.load();
  const pf = createProfile({ name, relation });
  latest.profiles.push(pf);
  await m.save(latest);
  // AI 提炼初始印象（异步，失败静默——画像已建不阻断）
  void seedProfileImpression(app, pf);
  return pf;
}

/** 新建画像后 AI 从已有条目提炼初始画像（失败静默，用户可后续在人物页重生成） */
async function seedProfileImpression(app: App, pf: Profile): Promise<void> {
  try {
    const m = manager(app);
    const latest = await m.load();
    const related = latest.entries.filter((e) => e.people.includes(pf.id) || e.people.includes(pf.name));
    const ai = new BlackBoxAI();
    const impression = await ai.extractProfileImpression(pf.name, related);
    if (!impression) return;
    const fresh = await m.load();
    const target = fresh.profiles.find((p) => p.id === pf.id);
    if (target) {
      target.impression = impression;
      await m.save(fresh);
      notice(`✨ 包仔已为「${pf.name}」写下初始印象`);
    }
  } catch (e) {
    /* AI 不可用：画像已建，印象留空待手动 */
  }
}

function personLabel(idOrName: string): string {
  if (idOrName.startsWith('pf_')) {
    const pf = profiles.find((p) => p.id === idOrName);
    return pf ? pf.name : idOrName;
  }
  return idOrName;
}

function renderDirection(row: HTMLElement | null): void {
  if (!row) return;
  for (const btn of Array.from(row.querySelectorAll('.bz-blackbox-dir'))) {
    btn.classList.toggle('bz-blackbox-dir-on', (btn as HTMLElement).dataset.dir === direction);
  }
}

// ---------------- 想法 AI 辅助（均可不打断录入流，失败降级） ----------------

function setAiBusy(busy: boolean): void {
  const row = document.querySelector('#bz-blackbox-tab-thought .bz-blackbox-ai-row');
  if (!row) return;
  for (const btn of Array.from(row.querySelectorAll('button'))) {
    const b = btn as HTMLButtonElement;
    if (busy) {
      b.dataset.label = b.textContent || '';
      b.disabled = true;
      b.textContent = '⏳';
    } else {
      b.disabled = false;
      b.textContent = b.dataset.label || '…';
    }
  }
}

function showAiResult(html: string): void {
  const el = document.getElementById('bz-blackbox-ai-result');
  if (!el) return;
  el.innerHTML = html;
}

async function runThoughtAssist(kind: 'recall' | 'ask'): Promise<void> {
  if (!appRef || !data) return;
  const input = thoughtText.trim();
  if (!input) {
    notice('⚠️ 先写点想法吧');
    return;
  }
  setAiBusy(true);
  try {
    const ai = new BlackBoxAI();
    const latest = await manager(appRef).load();
    const reply = await ai.assist(kind, input, latest.entries);
    if (!maskEl) return; // 弹窗已在 AI 调用期间关闭，放弃写入
    const append = document.createElement('button');
    append.className = 'bz-blackbox-ai-append';
    append.textContent = '加入想法';
    append.addEventListener('click', () => {
      const f = document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement;
      if (!f) return; // 弹窗已关闭
      f.value = (f.value ? f.value + '\n' : '') + `「${reply}」`;
      thoughtText = f.value;
      f.focus();
    });
    showAiResult(`<div class="bz-blackbox-ai-msg">${escapeHtml(reply)}</div>`);
    const resultEl = document.getElementById('bz-blackbox-ai-result');
    if (resultEl) resultEl.appendChild(append);
  } catch (e) {
    if (kind === 'ask') {
      fallbackIdx += 1;
      showAiResult(`<div class="bz-blackbox-ai-msg bz-blackbox-ai-fallback">${fallbackAsk(fallbackIdx)}</div>`);
    } else {
      notice('❌ 联想失败：AI 暂时无法说话', 'error');
    }
  } finally {
    setAiBusy(false);
  }
}

/** 追问降级文案轮换计数 */
let fallbackIdx = 0;

function openConceptLookup(): void {
  const el = document.getElementById('bz-blackbox-ai-result');
  if (!el) return;
  const input = document.createElement('input');
  input.className = 'bz-blackbox-input bz-blackbox-concept-input';
  input.placeholder = '想查的概念词';
  const go = document.createElement('button');
  go.className = 'bz-blackbox-ai-btn';
  go.textContent = '查';
  go.addEventListener('click', () => {
    const term = input.value.trim();
    if (!term) return;
    void runConceptLookup(term);
  });
  el.innerHTML = '';
  el.append(input, go);
  input.focus();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      const term = input.value.trim();
      if (term) void runConceptLookup(term);
    }
  });
}

async function runConceptLookup(term: string): Promise<void> {
  if (!appRef || !data) return;
  setAiBusy(true);
  try {
    const ai = new BlackBoxAI();
    const latest = await manager(appRef).load();
    const reply = await ai.assist('concept', term, undefined, latest.entries.filter((e) => e.type === 'concept'));
    if (!maskEl) return; // 弹窗已在 AI 调用期间关闭，放弃写入
    const append = document.createElement('button');
    append.className = 'bz-blackbox-ai-append';
    append.textContent = '加入想法';
    append.addEventListener('click', () => {
      const f = document.getElementById('bz-blackbox-thought-text') as HTMLTextAreaElement;
      if (!f) return; // 弹窗已关闭
      f.value = (f.value ? f.value + '\n' : '') + `📎 ${term}：${reply}`;
      thoughtText = f.value;
      f.focus();
    });
    showAiResult(`<div class="bz-blackbox-ai-msg">📎 <b>${escapeHtml(term)}</b>：${escapeHtml(reply)}</div>`);
    const resultEl = document.getElementById('bz-blackbox-ai-result');
    if (resultEl) resultEl.appendChild(append);
  } catch (e) {
    notice('❌ 查询失败：AI 暂时无法说话', 'error');
  } finally {
    setAiBusy(false);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------- 保存 ----------------

async function saveEntry(): Promise<void> {
  if (!appRef) return;
  collectDOMState();
  let entries: Entry[] = [];
  if (activeType === 'concept') {
    if (!conceptName) {
      notice('⚠️ 名词不能为空');
      return;
    }
    entries.push(
      createEntry({
        type: 'concept',
        name: conceptName,
        definition: (conceptGenerated && conceptGenerated.definition) || '',
        related: (conceptGenerated && conceptGenerated.relatedIds) || [],
      })
    );
  } else if (activeType === 'literature') {
    if (!literatureText.trim()) {
      notice('⚠️ 摘抄不能为空');
      return;
    }
    const entry = createEntry({
      type: 'literature',
      text: literatureText.trim(),
      source: literatureSource.trim(),
      terms: [...literatureTerms],
      emotions: selectedTags,
      people: peopleChips,
      scene: sceneText.trim(),
      toward: direction,
      links: parseLinks(linksText),
    });
    entries.push(entry);
    // 带出想法：同一次保存写入独立 thought 条目（共享感触外壳）
    if (carryThoughtText.trim()) {
      entries.push(
        createEntry({
          type: 'thought',
          text: carryThoughtText.trim(),
          emotions: selectedTags,
          people: peopleChips,
          scene: sceneText.trim(),
          toward: direction,
          links: parseLinks(linksText),
        })
      );
    }
    // 勾选的新概念（无 id）→ 落为概念条目（暂无定义，可后续在概念墙补充）
    for (const s of literatureSuggest) {
      if (s.checked && !s.id) {
        entries.push(createEntry({ type: 'concept', name: s.label, definition: '' }));
      }
    }
  } else {
    if (!thoughtText.trim()) {
      notice('⚠️ 想法不能为空');
      return;
    }
    entries.push(
      createEntry({
        type: 'thought',
        text: thoughtText.trim(),
        emotions: selectedTags,
        people: peopleChips,
        scene: sceneText.trim(),
        toward: direction,
        links: parseLinks(linksText),
      })
    );
  }

  try {
    const m = manager(appRef);
    // 写前重载：弹窗开着期间可能已有其他写入（自动复盘/对话）
    const latest = await m.load();
    let shouldReview = false;
    for (const e of entries) {
      const r = await m.addEntry(latest, e);
      shouldReview = shouldReview || r.shouldReview;
    }
    notice(`✅ 已存入黑匣子（${entries.length} 条）`);
    closeBlackBoxCapture();
    if (shouldReview) {
      // 静默复盘：不弹窗不通知，产物公开写入对话面板（打开时可见）
      void triggerAutoReview(appRef, latest);
    }
  } catch (e) {
    console.warn('黑匣子保存失败', e);
    notice('❌ 存入失败', 'error');
  }
}

function parseLinks(v: string): string[] {
  return v
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
