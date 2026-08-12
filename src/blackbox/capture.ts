/**
 * 黑匣子录入弹窗（引导式 v3）：bz-blackbox-capture「录入」。
 * 无 header/菜单栏/保存关闭按钮（ESC 或点遮罩关闭）：
 * ① 类型选择（三张大卡片）→ ② 内容输入（类型专属）→ ③ 感触（文献/想法）或 连接展示（概念）。
 * 🧩 概念：一个输入框 + ✨ 生成卡片 → 生成内容（百科式正式定义）填入输入框可编辑，按钮变「确认录入」
 *          → 确认即保存 → 显示与既有概念的连接关系，流程结束（✓ 完成回类型选择，可连续录入）；
 * 📎 文献：摘抄 + 来源 → 📋 分析名词（自动）→ 名词表勾选 + 提炼想法 + 情绪/涉及的人/场景 → 存入黑匣子；
 * 💡 想法：文本 + ⚡ 联想 / ❓ 追问（无查概念）→ 情绪/涉及的人/场景 → 存入黑匣子。
 * 去掉「指向」「链接」两个感触字段（数据字段保留，迁移兼容）。
 * 涉及的人 = 画像选择器（匹配补全 / 现场新建画像 / 仅存名字，≤5）；情绪 24 词多选 ≤3 无强度。
 * AI 不可用：三类纯文本录入仍可保存（生成失败降级为确认录入，永不拒收）。
 * 保存后阈值命中 → 静默复盘（triggerAutoReview，不打扰）。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { createOverlay } from '../core/dom';
import { notice } from '../core/notice';
import { BlackBoxAI, fallbackAsk, parseConceptJson, parseLiteratureJson } from './ai';
import { BlackBoxDataManager, createEntry, createProfile } from './data';
import { triggerAutoReview } from './review';
import { getSelectionSnapshot } from '../core/selection';
import type { SelectionSnapshot } from '../core/selection';
import { entryNoteTitle } from './notes';
import { injectIntoSourceNote } from './inject';
import { MAX_EMOTIONS, MAX_PEOPLE } from './types';
import type { BlackBoxData, Entry, Profile } from './types';

let appRef: App | null = null;
let dataManager: BlackBoxDataManager | null = null;
let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;

type CaptureType = 'concept' | 'literature' | 'thought';
type GuideStep = 'type' | 'content' | 'feel' | 'conn';

/** 当前引导步骤 */
let activeStep: GuideStep = 'type';
/** 当前录入类型 */
let activeType: CaptureType = 'thought';
/** 情绪词表（弹窗打开时从数据加载） */
let emotionWords: string[] = [];
/** 画像库（补全用） */
let profiles: Profile[] = [];
/** 数据快照（打开时加载；写前重载防并发覆盖） */
let data: BlackBoxData | null = null;

// 感触（literature/thought 共享）
let selectedTags: string[] = [];
let peopleChips: string[] = [];
/** 新建画像 mini 表单展开态 */
let newProfileOpen = false;

// 概念表单
let conceptName = '';
let conceptDefinition = '';
let conceptRelatedIds: string[] = [];
/** 概念名由选中文字自动填充 → 只读锁定（内容 ≡ 选区） */
let conceptNameLocked = false;
// 文献表单
let literatureText = '';
let literatureSource = '';
/** 摘抄文本由选中文字自动填充 → 只读锁定（内容 ≡ 选区） */
let literatureTextLocked = false;
/** 分析名词返回的标题建议（保存时优先复用为文件名） */
let literatureTitle = '';
let literatureSuggest: { id: string | null; label: string; checked: boolean }[] = [];
let literatureTerms = new Set<string>();
let literatureInsight = '';
// 想法表单
let thoughtText = '';
let sceneText = '';
/** 追问降级文案轮换计数 */
let fallbackIdx = 0;

/** 直达录入类型（null = 引导式）；直达命令保存后直接关闭 */
let directType: CaptureType | null = null;
/** 选区快照（打开时读取一次；自动填充 + 锁定 + 原位注入复用） */
let selectionSnap: SelectionSnapshot | null = null;

function manager(app: App): BlackBoxDataManager {
  if (!dataManager) dataManager = new BlackBoxDataManager(app);
  return dataManager;
}

/** 打开录入弹窗（幂等；异步加载词表/画像库/数据快照；读取当前选区快照） */
export async function openBlackBoxCapture(app: App): Promise<void> {
  appRef = app;
  if (maskEl) {
    maskEl.style.display = 'block';
    return;
  }
  data = await manager(app).load();
  emotionWords = data.settings.words;
  profiles = data.profiles;
  selectionSnap = getSelectionSnapshot(app);
  resetEntry();
  buildDOM();
  renderStep();
}

/** 直达命令（ticket 02/03）：跳过类型选择直达对应类型；保存后直接关闭。入口页/热键裸调用约定。 */
async function openBlackBoxCaptureDirect(app: App, type: CaptureType): Promise<void> {
  await openBlackBoxCapture(app);
  directType = type;
  activeType = type;
  applySelectionFill();
  gotoStep('content');
}

/** 概念直达（bz-blackbox-capture-concept「概念录入」，保存后直接关闭） */
export async function openBlackBoxCaptureConcept(app: App): Promise<void> {
  await openBlackBoxCaptureDirect(app, 'concept');
}

/** 摘抄直达（bz-blackbox-capture-literature「摘抄录入」，保存后直接关闭） */
export async function openBlackBoxCaptureLiterature(app: App): Promise<void> {
  await openBlackBoxCaptureDirect(app, 'literature');
}

/** 想法直达（bz-blackbox-capture-thought「想法录入」，保存后直接关闭） */
export async function openBlackBoxCaptureThought(app: App): Promise<void> {
  await openBlackBoxCaptureDirect(app, 'thought');
}

/** 选区自动填充（概念名/摘抄文本由选中文字填充并锁定只读；摘抄来源自动填来源笔记；无选区不动作） */
function applySelectionFill(): void {
  if (!selectionSnap || !selectionSnap.text) return;
  if (activeType === 'concept') {
    conceptName = selectionSnap.text;
    conceptNameLocked = true;
  } else if (activeType === 'literature') {
    literatureText = selectionSnap.text;
    literatureTextLocked = true;
    if (selectionSnap.filePath) {
      const base = selectionSnap.filePath.split('/').pop() || selectionSnap.filePath;
      literatureSource = `[[${base.replace(/\.md$/, '')}]]`;
    }
  }
}

/** 重置一条录入的全部状态（重开/换类型/保存完成后） */
function resetEntry(): void {
  activeStep = 'type';
  activeType = 'thought';
  directType = null;
  selectedTags = [];
  peopleChips = [];
  newProfileOpen = false;
  conceptName = '';
  conceptDefinition = '';
  conceptRelatedIds = [];
  conceptNameLocked = false;
  literatureText = '';
  literatureSource = '';
  literatureTextLocked = false;
  literatureTitle = '';
  literatureSuggest = [];
  literatureTerms = new Set();
  literatureInsight = '';
  thoughtText = '';
  sceneText = '';
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
  directType = null;
  selectionSnap = null;
}

export function unloadBlackBoxCapture(): void {
  closeBlackBoxCapture();
  dataManager = null;
  appRef = null;
  data = null;
}

// ---------------- DOM 骨架 ----------------

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

  // 引导步骤容器（常驻，display 切换保留各步已填内容）
  const body = document.createElement('div');
  body.className = 'bz-blackbox-guide-body';
  for (const s of ['type', 'content', 'feel', 'conn'] as GuideStep[]) {
    const el = document.createElement('div');
    el.id = `bz-blackbox-step-${s}`;
    el.className = 'bz-blackbox-guide-step';
    el.style.display = 'none';
    body.appendChild(el);
  }
  popup.appendChild(body);

  escHandle = escManager.register('blackbox-capture', { isVisible: () => !!maskEl, close: () => closeBlackBoxCapture() });
}

/** 切换到指定步骤并渲染（各步容器常驻，切换不丢已填内容） */
function gotoStep(step: GuideStep): void {
  activeStep = step;
  renderStep();
}

function renderStep(): void {
  for (const s of ['type', 'content', 'feel', 'conn'] as GuideStep[]) {
    const el = document.getElementById(`bz-blackbox-step-${s}`);
    if (el) el.style.display = s === activeStep ? 'block' : 'none';
  }
  if (activeStep === 'type') renderStepType();
  else if (activeStep === 'content') renderStepContent();
  else if (activeStep === 'feel') renderStepFeel();
  else renderStepConn();
}

/** 分组轻提示（chips 组前一行小字，替代 label） */
function groupHint(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bz-blackbox-field-hint';
  el.style.margin = '10px 0 6px';
  el.textContent = text;
  return el;
}

// ---------------- ① 类型选择 ----------------

function renderStepType(): void {
  const box = document.getElementById('bz-blackbox-step-type');
  if (!box) return;
  box.innerHTML = '';
  const cards: { type: CaptureType; icon: string; name: string }[] = [
    { type: 'concept', icon: '🧩', name: '概念' },
    { type: 'literature', icon: '📎', name: '文献' },
    { type: 'thought', icon: '💡', name: '想法' },
  ];
  for (const c of cards) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bz-blackbox-guide-card';
    card.dataset.ct = c.type;
    const icon = document.createElement('span');
    icon.className = 'bz-blackbox-guide-card-icon';
    icon.textContent = c.icon;
    const name = document.createElement('span');
    name.className = 'bz-blackbox-guide-card-name';
    name.textContent = c.name;
    const arrow = document.createElement('span');
    arrow.className = 'bz-blackbox-guide-card-arrow';
    arrow.textContent = '›';
    card.append(icon, name, arrow);
    card.addEventListener('click', () => {
      activeType = c.type;
      applySelectionFill(); // 选中文字自动填充（概念名锁定只读；文献/想法 ticket 03）
      gotoStep('content');
    });
    box.appendChild(card);
  }
}

// ---------------- ② 内容输入 ----------------

/** 内容输入框 auto-grow（复用 memo 先例）：高度 = clamp(scrollHeight, 一行, 8 行) */
const DEF_LINE_HEIGHT = 37;
const DEF_MAX_HEIGHT = 184;
function autoGrowDef(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  const h = Math.max(el.scrollHeight, DEF_LINE_HEIGHT);
  el.style.height = `${Math.min(h, DEF_MAX_HEIGHT)}px`;
  el.style.overflowY = el.scrollHeight > DEF_MAX_HEIGHT ? 'auto' : 'hidden';
}

function renderStepContent(): void {
  const box = document.getElementById('bz-blackbox-step-content');
  if (!box) return;
  box.innerHTML = '';
  if (activeType === 'concept') {
    // 双输入（ticket 02）：概念名（单行）+ 文本（textarea ≤8 行）；主按钮按文本内容判定
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'bz-blackbox-concept-name';
    nameInput.className = 'bz-blackbox-input' + (conceptNameLocked ? ' bz-blackbox-locked' : '');
    nameInput.placeholder = '想搞懂的概念或实体，如「提喻法」';
    nameInput.value = conceptName;
    nameInput.readOnly = conceptNameLocked;
    nameInput.addEventListener('input', () => {
      if (!conceptNameLocked) conceptName = nameInput.value.trim();
    });
    box.appendChild(nameInput);
    const defInput = document.createElement('textarea');
    defInput.id = 'bz-blackbox-concept-def';
    defInput.className = 'bz-blackbox-textarea';
    defInput.placeholder = '定义（可编辑）：AI 生成或手动填写，确认后落盘为概念笔记正文';
    defInput.value = conceptDefinition;
    defInput.addEventListener('input', () => {
      conceptDefinition = defInput.value;
      autoGrowDef(defInput);
      const btn = document.getElementById('bz-blackbox-concept-gen');
      if (btn) btn.textContent = conceptDefinition.trim() ? '✅ 确定录入' : '✨ 生成卡片';
    });
    box.appendChild(defInput);
    autoGrowDef(defInput);
    const genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.id = 'bz-blackbox-concept-gen';
    genBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary bz-blackbox-guide-main';
    genBtn.textContent = conceptDefinition.trim() ? '✅ 确定录入' : '✨ 生成卡片';
    genBtn.addEventListener('click', () => void onConceptMainBtn(genBtn));
    box.appendChild(genBtn);
  } else if (activeType === 'literature') {
    const text = document.createElement('textarea');
    text.id = 'bz-blackbox-lit-text';
    text.className = 'bz-blackbox-textarea' + (literatureTextLocked ? ' bz-blackbox-locked' : '');
    text.placeholder = '摘抄（必填）：从别处摘下的信息片段';
    text.value = literatureText;
    text.readOnly = literatureTextLocked;
    text.addEventListener('input', () => {
      if (!literatureTextLocked) literatureText = text.value;
    });
    box.appendChild(text);
    autoGrowDef(text);
    const source = document.createElement('input');
    source.id = 'bz-blackbox-lit-source';
    source.className = 'bz-blackbox-input';
    source.placeholder = '来源：URL 或书名/出处（有选区自动填来源笔记）';
    source.value = literatureSource;
    source.addEventListener('input', () => (literatureSource = source.value));
    box.appendChild(source);
    const analyzeBtn = document.createElement('button');
    analyzeBtn.type = 'button';
    analyzeBtn.id = 'bz-blackbox-lit-analyze';
    analyzeBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary bz-blackbox-guide-main';
    analyzeBtn.textContent = '📋 分析名词';
    analyzeBtn.addEventListener('click', () => void analyzeLiterature(analyzeBtn));
    box.appendChild(analyzeBtn);
  } else {
    const text = document.createElement('textarea');
    text.id = 'bz-blackbox-thought-text';
    text.className = 'bz-blackbox-textarea';
    text.placeholder = '想法（必填）：你自己的思考、感受、念头';
    text.value = thoughtText;
    text.addEventListener('input', () => (thoughtText = text.value));
    box.appendChild(text);
    const aiRow = document.createElement('div');
    aiRow.className = 'bz-blackbox-ai-row';
    const recall = mkAiBtn('⚡ 联想', () => void runThoughtAssist('recall'));
    const ask = mkAiBtn('❓ 追问', () => void runThoughtAssist('ask'));
    aiRow.append(recall, ask);
    box.appendChild(aiRow);
    const result = document.createElement('div');
    result.id = 'bz-blackbox-ai-result';
    result.className = 'bz-blackbox-ai-result';
    box.appendChild(result);
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.id = 'bz-blackbox-thought-confirm';
    confirmBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary bz-blackbox-guide-main';
    confirmBtn.textContent = '✅ 确认';
    confirmBtn.addEventListener('click', () => {
      if (!thoughtText.trim()) {
        notice('⚠️ 先写下想法');
        return;
      }
      gotoStep('feel');
    });
    box.appendChild(confirmBtn);
  }
}

function mkAiBtn(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bz-blackbox-ai-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

// ----- 概念：生成卡片 / 确定录入（ticket 02：按钮按文本内容判定，无 generated 标志） -----

async function onConceptMainBtn(btn: HTMLButtonElement): Promise<void> {
  // 文本输入框有内容 → 确定录入；空 → 生成卡片（内容判定，无重新生成入口）
  if (conceptDefinition.trim()) {
    await saveConcept();
    return;
  }
  const name = conceptName;
  if (!name) {
    notice('⚠️ 先输入名词');
    return;
  }
  btn.disabled = true;
  btn.textContent = '⏳ 正在生成…';
  try {
    const ai = new BlackBoxAI();
    const existing = data ? data.entries.filter((e) => e.type === 'concept') : [];
    const raw = await ai.assist('concept', name, undefined, existing);
    if (!maskEl) return; // 弹窗已关
    const parsed = parseConceptJson(raw);
    if (parsed) {
      conceptDefinition = parsed.definition;
      conceptRelatedIds = parsed.relatedNames
        .map((n) => existing.find((c) => !!c.name && (c.name === n || c.name.includes(n) || n.includes(c.name))))
        .filter((c): c is Entry => !!c)
        .map((c) => c.id);
    } else {
      conceptDefinition = raw;
      notice('⚠️ 卡片生成不完整（已按纯文本填入，可编辑）');
    }
  } catch (e) {
    // 永不拒收：AI 失败降级为直接录入（定义=原名词，用户可编辑）
    conceptDefinition = conceptName;
    notice('❌ 生成失败：AI 暂时无法说话，可手动编辑后确定录入', 'error');
  }
  btn.disabled = false;
  renderStepContent();
}

/** 概念：确定即保存 → 直达模式保存后直接关闭；引导式展示连接关系（流程结束） */
async function saveConcept(): Promise<void> {
  if (!appRef) return;
  const name = conceptName;
  if (!name) {
    notice('⚠️ 名词不能为空');
    return;
  }
  if (!conceptDefinition.trim()) {
    notice('⚠️ 卡片内容不能为空');
    return;
  }
  const entry = createEntry({
    type: 'concept',
    name,
    definition: conceptDefinition.trim(),
    related: conceptRelatedIds,
  });
  try {
    const m = manager(appRef);
    const latest = await m.load();
    const r = await m.addEntry(latest, entry);
    data = latest;
    // 动态双向关联：新概念关联的既有概念也反向指向新卡（关联是相互的，随录入动态维护）
    if (conceptRelatedIds.length) {
      await m.backfillRelated(latest, entry.id, conceptRelatedIds);
      data = await m.load();
    }
    // 原位注入（ticket 06）：来源笔记选区原文 → [[概念名|原文字]]（守卫命中跳过 + toast）
    await injectIntoSourceNote(appRef, selectionSnap, entry.name || '');
    notice('✅ 已录入概念卡片');
    void autoClassify(appRef, entry.id);
    if (directType) {
      // 直达命令：保存后直接关闭（可连续快速录入）
      closeBlackBoxCapture();
    } else {
      // 连接展示（写前快照已含 related 概念条目）
      gotoStep('conn');
    }
    if (r.shouldReview) {
      void triggerAutoReview(appRef, latest);
    }
  } catch (e) {
    console.warn('黑匣子概念保存失败', e);
    notice('❌ 存入失败', 'error');
  }
}

/** AI 自动分类（2026-08-12 需求：分类由 AI 自动生成，自动放入对应分类文件夹）：
 *  保存后异步：load 最新 → AI 判类 → applyCategory 移动+fm+index；失败静默留根目录不打扰录入。 */
async function autoClassify(app: App, id: string): Promise<void> {
  try {
    const m = manager(app);
    const d = await m.load();
    const entry = d.entries.find((e) => e.id === id);
    if (!entry) return;
    const cat = await new BlackBoxAI().classifyCard(entry);
    if (!cat || cat === '未分类') return;
    const ok = await m.applyCategory(d, id, cat);
    if (ok) notice(`📁 已自动归入「${cat}」`);
  } catch {
    // 静默：AI 不可用/失败 → 卡片留在根目录
  }
}

// ----- 文献：分析名词 -----

async function analyzeLiterature(btn: HTMLButtonElement): Promise<void> {
  if (!appRef || !data) return;
  const text = literatureText.trim();
  if (!text) {
    notice('⚠️ 先粘贴摘抄内容');
    return;
  }
  btn.disabled = true;
  btn.textContent = '⏳ 正在分析…';
  try {
    const ai = new BlackBoxAI();
    const existing = data.entries.filter((e) => e.type === 'concept');
    const input = `来源：${literatureSource || '未知'}\n摘抄：${text.slice(0, 800)}`;
    const raw = await ai.assist('literature', input, undefined, existing);
    if (!maskEl) return; // 弹窗已关
    const parsed = parseLiteratureJson(raw);
    literatureTerms = new Set();
    literatureSuggest = [];
    literatureInsight = '';
    literatureTitle = parsed ? parsed.title : '';
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
      literatureInsight = parsed.insight;
    } else {
      notice('⚠️ 分析结果无法识别（仍可直接存入）');
    }
  } catch (e) {
    // 永不拒收：分析失败仍进入感触步，纯文本可保存
    notice('❌ 分析失败：AI 暂时无法说话，仍可直接存入', 'error');
  } finally {
    btn.disabled = false;
    gotoStep('feel');
  }
}

// ---------------- ③ 感触（文献/想法）与连接（概念） ----------------

function renderStepFeel(): void {
  const box = document.getElementById('bz-blackbox-step-feel');
  if (!box) return;
  box.innerHTML = '';

  if (activeType === 'literature') {
    // 名词表（分析后才有）
    if (literatureSuggest.length) {
      box.appendChild(groupHint('勾选要关联的概念（✦ 新概念）'));
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
          renderStepFeel();
        });
        chips.appendChild(chip);
      }
      box.appendChild(chips);
    }
    // 提炼想法（AI 生成，可编辑/清空）
    const insight = document.createElement('textarea');
    insight.id = 'bz-blackbox-insight';
    insight.className = 'bz-blackbox-textarea';
    insight.placeholder = '提炼想法（可选）：包仔从摘抄提炼，可编辑';
    insight.value = literatureInsight;
    insight.addEventListener('input', () => (literatureInsight = insight.value));
    box.appendChild(insight);
  }

  box.appendChild(groupHint(`情绪（可选，最多 ${MAX_EMOTIONS} 个）`));
  const emotionRow = document.createElement('div');
  emotionRow.className = 'bz-blackbox-emotions';
  emotionRow.id = 'bz-blackbox-emotions';
  box.appendChild(emotionRow);
  renderEmotions();

  const peopleRow = document.createElement('div');
  peopleRow.className = 'bz-blackbox-people-row';
  peopleRow.id = 'bz-blackbox-people-row';
  box.appendChild(peopleRow);
  renderPeopleChips();

  const scene = document.createElement('input');
  scene.id = 'bz-blackbox-scene';
  scene.className = 'bz-blackbox-input';
  scene.placeholder = `场景（可选）：当时在做什么，如深夜通勤（最多 ${MAX_PEOPLE} 个人）`;
  scene.value = sceneText;
  scene.addEventListener('input', () => (sceneText = scene.value));
  box.appendChild(scene);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.id = 'bz-blackbox-save';
  saveBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary bz-blackbox-guide-main';
  saveBtn.textContent = '💾 存入黑匣子';
  saveBtn.addEventListener('click', () => void saveEntry());
  box.appendChild(saveBtn);
}

/** 概念连接展示（确认录入后，流程结束） */
function renderStepConn(): void {
  const box = document.getElementById('bz-blackbox-step-conn');
  if (!box) return;
  box.innerHTML = '';
  const ok = document.createElement('div');
  ok.className = 'bz-blackbox-guide-conn-ok';
  ok.textContent = `✅ 已录入「${conceptName}」`;
  box.appendChild(ok);
  const rels = conceptRelatedIds
    .map((id) => (data ? data.entries.find((e) => e.id === id) : undefined))
    .filter((c): c is Entry => !!c);
  if (rels.length) {
    const label = document.createElement('div');
    label.className = 'bz-blackbox-section-label';
    label.textContent = `与 ${rels.length} 个概念建立了连接`;
    box.appendChild(label);
    for (const r of rels) {
      const card = document.createElement('div');
      card.className = 'bz-blackbox-guide-conn-card';
      const name = document.createElement('div');
      name.className = 'bz-blackbox-guide-conn-name';
      name.textContent = r.name || r.id;
      const def = document.createElement('div');
      def.className = 'bz-blackbox-guide-conn-def';
      def.textContent = r.definition ? clip(r.definition, 60) : '（暂无定义）';
      card.append(name, def);
      box.appendChild(card);
    }
  } else {
    const tip = document.createElement('div');
    tip.className = 'bz-blackbox-ai-msg bz-blackbox-ai-fallback';
    tip.textContent = '暂时没有关联概念，之后复盘会让它慢慢交到朋友';
    box.appendChild(tip);
  }
  const done = document.createElement('button');
  done.type = 'button';
  done.id = 'bz-blackbox-guide-done';
  done.className = 'bz-blackbox-btn bz-blackbox-btn-primary bz-blackbox-guide-main';
  done.textContent = '✓ 完成';
  done.addEventListener('click', () => {
    resetEntry();
    renderStep();
  });
  box.appendChild(done);
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ---------------- 感触渲染（情绪 / 涉及的人） ----------------

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

// ---------------- 想法 AI 辅助（联想 / 追问，均不打断录入流，失败降级） ----------------

function setAiBusy(busy: boolean): void {
  const row = document.querySelector('#bz-blackbox-step-content .bz-blackbox-ai-row');
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------- 保存（文献/想法：感触步 → 存入黑匣子） ----------------

/** 标题解析（ticket 03）：分析标题优先 → AI 生成 → 正文前 20 字降级（永不拒收） */
async function resolveEntryTitle(entry: Entry, prefer?: string): Promise<string> {
  if (prefer && prefer.trim()) return prefer.trim();
  try {
    const ai = new BlackBoxAI();
    const t = await ai.suggestTitle(entry.text || '');
    if (t && t.trim()) return t.trim();
  } catch (e) {
    /* AI 不可用：降级正文前 20 字 */
  }
  return entryNoteTitle(entry);
}

async function saveEntry(): Promise<void> {
  if (!appRef) return;
  let entries: Entry[] = [];
  if (activeType === 'literature') {
    if (!literatureText.trim()) {
      notice('⚠️ 摘抄不能为空');
      return;
    }
    const lit = createEntry({
      type: 'literature',
      text: literatureText.trim(),
      source: literatureSource.trim(),
      terms: [...literatureTerms],
      emotions: selectedTags,
      people: peopleChips,
      scene: sceneText.trim(),
      toward: '',
      links: [],
    });
    // 标题：分析结果优先 → AI 生成 → 前 20 字降级；提炼想法 → 独立想法笔记 + 摘抄底部「来自：[[摘抄]]」
    lit.title = await resolveEntryTitle(lit, literatureTitle);
    entries.push(lit);
    if (literatureInsight.trim()) {
      entries.push(
        createEntry({
          type: 'thought',
          text: literatureInsight.trim(),
          emotions: selectedTags,
          people: peopleChips,
          scene: sceneText.trim(),
          toward: '',
          links: [],
          from: lit.id,
        })
      );
    }
    // 勾选的新概念（无 id）→ 落为概念条目（定义由后续生成补充）
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
    const thought = createEntry({
      type: 'thought',
      text: thoughtText.trim(),
      emotions: selectedTags,
      people: peopleChips,
      scene: sceneText.trim(),
      toward: '',
      links: [],
    });
    thought.title = await resolveEntryTitle(thought);
    entries.push(thought);
  }

  try {
    const m = manager(appRef);
    // 写前重载：弹窗开着期间可能已有其他写入（自动复盘/对话）
    const latest = await m.load();
    let shouldReview = false;
    for (const e of entries) {
      const r = await m.addEntry(latest, e);
      shouldReview = shouldReview || r.shouldReview;
      // AI 自动分类（2026-08-12 需求）：保存后异步归入分类文件夹，失败静默留根目录
      void autoClassify(appRef, e.id);
    }
    data = latest;
    // 原位注入（ticket 06）：摘抄目标 = AI 标题（保存时已确定）；概念/摘抄保存时带选区才触发
    if (activeType === 'literature' && entries[0] && entries[0].title) {
      await injectIntoSourceNote(appRef, selectionSnap, entries[0].title);
    }
    notice(`✅ 已存入黑匣子（${entries.length} 条）`);
    if (directType) {
      // 直达命令：保存后直接关闭（可连续快速录入）
      closeBlackBoxCapture();
    } else {
      resetEntry();
      renderStep();
    }
    if (shouldReview) {
      // 静默复盘：不弹窗不通知，产物公开写入对话面板（打开时可见）
      void triggerAutoReview(appRef, latest);
    }
  } catch (e) {
    console.warn('黑匣子保存失败', e);
    notice('❌ 存入失败', 'error');
  }
}
