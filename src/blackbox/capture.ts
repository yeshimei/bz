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
import { escapeHtml } from '../core/utils';
import { escManager } from '../core/esc-manager';
import { createOverlay } from '../core/dom';
import { notice } from '../core/notice';
import { BlackBoxAI, fallbackAsk, parseConceptJson, parseLiteratureJson } from './ai';
import { BlackBoxDataManager, createEntry, createProfile } from './data';
import { triggerAutoReview } from './review';
import { getSelectionSnapshot } from '../core/selection';
import type { SelectionSnapshot } from '../core/selection';
import { entryNoteTitle, sanitizeFileName } from './notes';
import { injectIntoSourceNote } from './inject';
import { bookTitleFromSourceLink } from './source-jump';
import { MAX_EMOTIONS, MAX_PEOPLE } from './types';
import type { BlackBoxData, Entry, Profile } from './types';

let appRef: App | null = null;
let dataManager: BlackBoxDataManager | null = null;
let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
/** 打开时后台加载的数据承诺（打开不阻塞；AI/保存前 ensureDataLoaded 等待） */
let dataLoadPromise: Promise<BlackBoxData | null> | null = null;

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

// 概念表单
let conceptName = '';
let conceptDefinition = '';
let conceptRelatedIds: string[] = [];
/** 概念名由选中文字自动填充 → 只读锁定（内容 ≡ 选区） */
let conceptNameLocked = false;
/** 概念来源（ADR-0016，单值）：书内双链 / [[来源笔记]]；无选区为空 */
let conceptSource = '';
// 文献表单
let literatureText = '';
let literatureSource = '';
/** 摘抄文本由选中文字自动填充 → 只读锁定（内容 ≡ 选区） */
let literatureTextLocked = false;
/** 分析名词返回的标题建议（保存时优先复用为文件名） */
let literatureTitle = '';
let literatureSuggest: { id: string | null; label: string; checked: boolean }[] = [];
let literatureTerms = new Set<string>();
/** 想法（ticket 50：手输，不 AI 提炼）：内容步插在摘抄与来源之间 */
let literatureThought = '';
/** 新概念流转（ticket 50）：摘抄勾选 ✦新概念 → 保存后同弹窗依次概念录入 → 全部完成回填摘抄 terms */
let conceptFlowMode = false;
let pendingConceptQueue: string[] = [];
let flowLitId: string | null = null;
let flowCreated: { id: string; name: string }[] = [];
// 想法表单
let thoughtText = '';
let sceneText = '';
/** 追问降级文案轮换计数 */
let fallbackIdx = 0;

/** 直达录入类型（null = 引导式）；直达命令保存后直接关闭 */
let directType: CaptureType | null = null;
/** 选区快照（打开时读取一次；自动填充 + 锁定 + 原位注入复用） */
let selectionSnap: SelectionSnapshot | null = null;
/** 书内选区录入的外部选区（ADR-0016）：阅读器 host 能力传入，优先于编辑器选区快照 */
let externalSel: BlackBoxExternalSelection | null = null;

/** 书内选区录入输入（ADR-0016）：选中文字 + 阅读器双链来源 */
export interface BlackBoxExternalSelection {
  selectedText: string;
  sourceLink: string;
}

function manager(app: App): BlackBoxDataManager {
  if (!dataManager) dataManager = new BlackBoxDataManager(app);
  return dataManager;
}

/** 数据后台加载 + 首次就绪缓存（并发复用；失败 → null，AI/保存前再走 m.load() 重试） */
function ensureDataLoaded(): Promise<BlackBoxData | null> {
  if (data) return Promise.resolve(data);
  if (dataLoadPromise) return dataLoadPromise;
  if (!appRef) return Promise.resolve(null);
  dataLoadPromise = manager(appRef)
    .load()
    .then((d) => {
      data = d;
      emotionWords = d.settings.words;
      profiles = d.profiles;
      return d;
    })
    .catch(() => null);
  return dataLoadPromise;
}

/** 数据就绪后刷新依赖数据的渲染（打开时情绪/画像区可能为空；用户在 feel 步则原地补渲染） */
function refreshLoadedUI(): void {
  if (!maskEl) return;
  if (activeStep === 'feel') {
    renderEmotions();
    renderPeopleChips();
  }
}

/** 打开录入弹窗（幂等；立即渲染不阻塞数据加载；读取当前选区快照；externalSelection = 书内选区外部参数） */
export async function openBlackBoxCapture(app: App, externalSelection?: BlackBoxExternalSelection | null): Promise<void> {
  appRef = app;
  if (maskEl) {
    maskEl.style.display = 'block';
    return;
  }
  selectionSnap = getSelectionSnapshot(app);
  externalSel = externalSelection ?? null;
  resetEntry();
  buildDOM();
  renderStep();
  // 缓存未就绪时先显示「正在扫描」提示（就绪后移除；缓存命中则下一帧前移除，不可见）
  const hint = document.createElement('div');
  hint.className = 'bz-blackbox-scanning';
  hint.id = 'bz-blackbox-capture-scanning';
  hint.textContent = '正在扫描黑匣子…';
  popupEl!.prepend(hint);
  // 数据后台加载（词表/画像/既有概念）：打开不等待，AI 操作前 ensureDataLoaded 兜底
  void ensureDataLoaded().then(() => {
    const el = document.getElementById('bz-blackbox-capture-scanning');
    if (el) el.remove();
    refreshLoadedUI();
  });
}

/** 直达命令（ticket 02/03）：跳过类型选择直达对应类型；保存后直接关闭。入口页/热键裸调用约定。 */
async function openBlackBoxCaptureDirect(app: App, type: CaptureType, externalSelection?: BlackBoxExternalSelection | null): Promise<void> {
  await openBlackBoxCapture(app, externalSelection);
  directType = type;
  activeType = type;
  applySelectionFill();
  gotoStep('content');
}

/** 书内选区录入（ADR-0016）：阅读器 host 能力（captureConceptFromEpub/captureExcerptFromEpub）调用；
 *  直达 + 外部选区填充 + 保存后直接关闭；无原位注入（epub 不可写，externalSel 模式跳过注入） */
export async function openBlackBoxCaptureFromEpub(
  app: App,
  type: CaptureType,
  input: BlackBoxExternalSelection
): Promise<void> {
  await openBlackBoxCaptureDirect(app, type, input);
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

/** 选区自动填充（概念名/摘抄文本锁定只读 + 来源）：外部选区（书内录入）优先于编辑器选区快照；
 *  来源对称规则（ADR-0016）：书内 → 阅读器双链；笔记选区 → [[来源笔记]]；无选区 → 无来源 */
function applySelectionFill(): void {
  const ext = externalSel;
  const snap = selectionSnap;
  if (activeType === 'concept') {
    const text = (ext ? ext.selectedText : '') || (snap ? snap.text : '') || '';
    if (text) {
      conceptName = text;
      conceptNameLocked = true;
    }
    if (ext && ext.sourceLink) {
      conceptSource = ext.sourceLink;
    } else if (snap && snap.filePath) {
      const base = snap.filePath.split('/').pop() || snap.filePath;
      conceptSource = `[[${base.replace(/\.md$/, '')}]]`;
    }
  } else if (activeType === 'literature') {
    const text = (ext ? ext.selectedText : '') || (snap ? snap.text : '') || '';
    if (text) {
      literatureText = text;
      literatureTextLocked = true;
    }
    if (ext && ext.sourceLink) {
      literatureSource = ext.sourceLink;
    } else if (snap && snap.filePath) {
      const base = snap.filePath.split('/').pop() || snap.filePath;
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
  conceptName = '';
  conceptDefinition = '';
  conceptRelatedIds = [];
  conceptNameLocked = false;
  conceptSource = '';
  literatureText = '';
  literatureSource = '';
  literatureTextLocked = false;
  literatureTitle = '';
  literatureSuggest = [];
  literatureTerms = new Set();
  literatureThought = '';
  thoughtText = '';
  sceneText = '';
  conceptFlowMode = false;
  pendingConceptQueue = [];
  flowLitId = null;
  flowCreated = [];
}

export function closeBlackBoxCapture(): void {
  // 流转未完成即关闭（ESC/遮罩，ticket 50）：已确认的概念已落盘仍回填摘抄 terms；未确认的丢弃（跳过不建不加）
  if (flowLitId && flowCreated.length && appRef) {
    const litId = flowLitId;
    const created = flowCreated.slice();
    flowLitId = null;
    flowCreated = [];
    void (async () => {
      try {
        const m = manager(appRef);
        const latest = await m.load();
        await m.appendEntryTerms(latest, litId, created.map((c) => c.id));
      } catch (e) {
        console.warn('黑匣子摘抄关联回填失败', e);
      }
    })();
  }
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
  externalSel = null;
  conceptFlowMode = false;
  pendingConceptQueue = [];
  flowLitId = null;
  flowCreated = [];
}

export function unloadBlackBoxCapture(): void {
  closeBlackBoxCapture();
  dataManager = null;
  appRef = null;
  data = null;
  dataLoadPromise = null;
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
    nameInput.placeholder = '想搞懂的概念或实体';
    nameInput.value = conceptName;
    nameInput.readOnly = conceptNameLocked;
    nameInput.addEventListener('input', () => {
      if (!conceptNameLocked) conceptName = nameInput.value.trim();
    });
    box.appendChild(nameInput);
    const defInput = document.createElement('textarea');
    defInput.id = 'bz-blackbox-concept-def';
    defInput.className = 'bz-blackbox-textarea';
    defInput.placeholder = '定义';
    defInput.value = conceptDefinition;
    defInput.addEventListener('input', () => {
      conceptDefinition = defInput.value;
      autoGrowDef(defInput);
      const btn = document.getElementById('bz-blackbox-concept-gen');
      if (btn) btn.textContent = conceptDefinition.trim() ? '✅ 确定录入' : '✨ 生成卡片';
    });
    box.appendChild(defInput);
    autoGrowDef(defInput);
    // 概念来源（ticket 50：与摘抄面板一致，放定义下、主按钮上；书内选区只读显示纯文字书名）
    const srcInput = document.createElement('input');
    srcInput.type = 'text';
    srcInput.id = 'bz-blackbox-concept-source';
    srcInput.className = 'bz-blackbox-input' + (externalSel && conceptSource ? ' bz-blackbox-locked' : '');
    srcInput.placeholder = '来源';
    srcInput.value = externalSel && conceptSource ? bookTitleFromSourceLink(conceptSource) : conceptSource;
    srcInput.readOnly = !!externalSel && !!conceptSource;
    srcInput.addEventListener('input', () => {
      if (!externalSel) conceptSource = srcInput.value;
    });
    box.appendChild(srcInput);
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
    text.placeholder = '从别处摘下的信息片段';
    text.value = literatureText;
    text.readOnly = literatureTextLocked;
    text.addEventListener('input', () => {
      if (!literatureTextLocked) literatureText = text.value;
    });
    box.appendChild(text);
    autoGrowDef(text);
    // 想法（ticket 50：手输，不 AI 提炼；插在摘抄与来源之间，大间距）
    const thought = document.createElement('textarea');
    thought.id = 'bz-blackbox-lit-thought';
    thought.className = 'bz-blackbox-textarea';
    thought.placeholder = '你自己的感受或联想，不 AI 提炼';
    thought.value = literatureThought;
    thought.addEventListener('input', () => (literatureThought = thought.value));
    box.appendChild(thought);
    autoGrowDef(thought);
    const source = document.createElement('input');
    source.id = 'bz-blackbox-lit-source';
    source.className = 'bz-blackbox-input' + (externalSel && literatureSource ? ' bz-blackbox-locked' : '');
    source.placeholder = '来源';
    source.value = externalSel && literatureSource ? bookTitleFromSourceLink(literatureSource) : literatureSource;
    source.readOnly = !!externalSel && !!literatureSource;
    source.addEventListener('input', () => {
      if (!externalSel) literatureSource = source.value;
    });
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
    text.placeholder = '你自己的思考、感受、念头';
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
        notice('先写下想法', 'warning');
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
    notice('先输入名词', 'warning');
    return;
  }
  btn.disabled = true;
  btn.textContent = '⏳ 正在生成…';
  try {
    const loaded = await ensureDataLoaded();
    if (!loaded || !maskEl) return; // 数据未就绪/弹窗已关
    const ai = new BlackBoxAI();
    const existing = loaded.entries.filter((e) => e.type === 'concept');
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
      notice('卡片生成不完整（已按纯文本填入，可编辑）', 'warning');
    }
  } catch (e) {
    // 永不拒收：AI 失败降级为直接录入（定义=原名词，用户可编辑）
    conceptDefinition = conceptName;
    notice('生成失败：AI 暂时无法说话，可手动编辑后确定录入', 'error');
  }
  btn.disabled = false;
  renderStepContent();
}

/** 概念：确定即保存 → 直达模式保存后直接关闭；引导式展示连接关系（流程结束）。
 *  双向关联回填 + 原位注入 + AI 分类均后台执行（确认即关，成功通知），不阻塞录入流。 */
async function saveConcept(): Promise<void> {
  if (!appRef) return;
  const name = conceptName;
  if (!name) {
    notice('名词不能为空', 'warning');
    return;
  }
  if (!conceptDefinition.trim()) {
    notice('卡片内容不能为空', 'warning');
    return;
  }
  try {
    const m = manager(appRef);
    // 写前重载：弹窗开着期间可能已有其他写入（自动复盘/对话）
    const latest = await m.load();
    // 重名守卫（流转模式，ticket 50）：确认时改名与既有概念同名 → 不新建，摘抄直接关联既有概念
    if (conceptFlowMode) {
      const dup = latest.entries.find((c) => c.type === 'concept' && c.name === name);
      if (dup) {
        notice(`已有同名概念「${name}」，已直接关联`, 'warning');
        flowCreated.push({ id: dup.id, name });
        nextConceptFlow();
        return;
      }
    }
    const entry = createEntry({
      type: 'concept',
      name,
      definition: conceptDefinition.trim(),
      related: conceptRelatedIds,
      links: conceptSource ? [conceptSource] : [],
    });
    const r = await m.addEntry(latest, entry);
    data = latest;
    notice('已录入概念卡片', 'success');
    void autoClassify(appRef, entry.id);
    // 快照副本（closeBlackBoxCapture 会置空 selectionSnap/externalSel，后台补全仍需引用）
    const snap = selectionSnap;
    const ext = externalSel;
    if (conceptFlowMode) {
      // 流转（ticket 50）：记录已建概念 → 下一个新概念或回填收尾
      flowCreated.push({ id: entry.id, name: entry.name || name });
      // 后台：双向关联回填（注入流转模式跳过，摘抄保存时已对来源笔记注入）
      void finalizeConceptSave(appRef, entry.id, conceptRelatedIds, snap, ext, true);
      nextConceptFlow();
      return;
    }
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
    // 后台补全（确认即关后执行）：双向关联回填 + 来源笔记原位注入，失败静默不打扰
    void finalizeConceptSave(appRef, entry.id, conceptRelatedIds, snap, ext, false);
  } catch (e) {
    console.warn('黑匣子概念保存失败', e);
    notice('存入失败', 'error');
  }
}

/** 概念后台补全（确认即关后执行）：双向关联回填 + 来源笔记原位注入；写前重载防并发覆盖，失败静默。 */
async function finalizeConceptSave(
  app: App,
  entryId: string,
  relatedIds: string[],
  snap: SelectionSnapshot | null,
  ext: BlackBoxExternalSelection | null,
  flowMode: boolean
): Promise<void> {
  try {
    const m = manager(app);
    const latest = await m.load();
    const entry = latest.entries.find((e) => e.id === entryId);
    if (!entry) return;
    // 动态双向关联：新概念关联的既有概念也反向指向新卡（关联是相互的，随录入动态维护）
    if (relatedIds.length) await m.backfillRelated(latest, entryId, relatedIds);
    // 原位注入（ticket 06）：来源笔记选区原文 → [[概念名|原文字]]；书内选区（epub 不可写）与流转模式跳过
    if (!ext && !flowMode) {
      await injectIntoSourceNote(app, snap, entry.name || '');
    }
  } catch (e) {
    console.warn('黑匣子概念后台补全失败', e);
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
    if (ok) notice(`已自动归入「${cat}」`, 'archive');
  } catch {
    // 静默：AI 不可用/失败 → 卡片留在根目录
  }
}

// ----- 文献：分析名词 -----

async function analyzeLiterature(btn: HTMLButtonElement): Promise<void> {
  const text = literatureText.trim();
  if (!text) {
    notice('先粘贴摘抄内容', 'warning');
    return;
  }
  const loaded = await ensureDataLoaded();
  if (!loaded || !appRef || !maskEl) return;
  btn.disabled = true;
  btn.textContent = '⏳ 正在分析…';
  try {
    const ai = new BlackBoxAI();
    const existing = loaded.entries.filter((e) => e.type === 'concept');
    const input = `来源：${literatureSource || '未知'}\n摘抄：${text.slice(0, 800)}`;
    const raw = await ai.assist('literature', input, undefined, existing);
    if (!maskEl) return; // 弹窗已关
    const parsed = parseLiteratureJson(raw);
    literatureTerms = new Set();
    literatureSuggest = [];
    literatureTitle = parsed ? parsed.title : '';
    if (parsed) {
      for (const n of parsed.matched) {
        // 同名概念（不同分类）全部匹配：label 带分类后缀区分，terms 关联全部 id
        const hits = existing.filter((x) => !!x.name && (x.name === n || x.name.includes(n) || n.includes(x.name)));
        for (const c of hits) {
          const dup = hits.filter((h) => h.name === c.name).length > 1;
          literatureSuggest.push({
            id: c.id,
            label: dup && c.category ? `${c.name}（${c.category}）` : c.name || n,
            checked: true,
          });
          literatureTerms.add(c.id);
        }
        if (!hits.length) literatureSuggest.push({ id: null, label: n, checked: false });
      }
      for (const n of parsed.newConcepts) {
        if (!literatureSuggest.some((s) => s.label === n)) {
          literatureSuggest.push({ id: null, label: n, checked: false });
        }
      }
    } else {
      notice('分析结果无法识别（仍可直接存入）', 'warning');
    }
  } catch (e) {
    // 永不拒收：分析失败仍进入感触步，纯文本可保存
    notice('分析失败：AI 暂时无法说话，仍可直接存入', 'error');
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
      notice(`最多选 ${MAX_EMOTIONS} 个情绪`, 'warning');
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
}

/** 录入弹窗内的现场新建画像（ticket 50 已删：冷启动双路径收归主面板，涉及的人只能匹配已有画像/仅存名字） */

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
    notice(`最多 ${MAX_PEOPLE} 个人`, 'warning');
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
      notice(`包仔已为「${pf.name}」写下初始印象`, 'accept');
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
  const input = thoughtText.trim();
  if (!input) {
    notice('先写点想法吧', 'warning');
    return;
  }
  const loaded = await ensureDataLoaded();
  if (!loaded || !appRef || !maskEl) return;
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
      notice('联想失败：AI 暂时无法说话', 'error');
    }
  } finally {
    setAiBusy(false);
  }
}

// ---------------- 保存（文献/想法：感触步 → 存入黑匣子） ----------------

/** 标题解析（ticket 03）：分析标题优先直接落盘；无分析标题 → 后台 AI 生成（finalizeEntrySave），正文前 20 字降级（永不拒收） */
async function saveEntry(): Promise<void> {
  if (!appRef) return;
  let entries: Entry[] = [];
  if (activeType === 'literature') {
    if (!literatureText.trim()) {
      notice('摘抄不能为空', 'warning');
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
    // 标题：分析结果优先直接落盘；无 → 先落盘（正文前 20 字降级），AI 后台生成后重命名（ticket：保存即关不阻塞）；
    // 想法手输（ticket 50）非空 → 独立想法笔记 + 摘抄底部「来自：[[摘抄]]」
    lit.title = literatureTitle.trim();
    entries.push(lit);
    if (literatureThought.trim()) {
      entries.push(
        createEntry({
          type: 'thought',
          text: literatureThought.trim(),
          emotions: selectedTags,
          people: peopleChips,
          scene: sceneText.trim(),
          toward: '',
          links: [],
          from: lit.id,
        })
      );
    }
    // 勾选的新概念（无 id）→ 不落空定义条目，保存后同弹窗流转概念录入（ticket 50）
    const pendingNew = literatureSuggest.filter((s) => s.checked && !s.id).map((s) => s.label);
    if (pendingNew.length) {
      conceptFlowMode = true;
      pendingConceptQueue = pendingNew.slice();
    }
  } else {
    if (!thoughtText.trim()) {
      notice('想法不能为空', 'warning');
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
    // 标题后台 AI 生成（finalizeEntrySave），先落盘正文前 20 字降级名
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
      // AI 自动分类（2026-08-12 需求）：仅概念归入分类文件夹（ticket 50：摘抄不分类留根目录），失败静默留根目录
      if (e.type === 'concept') void autoClassify(appRef, e.id);
    }
    data = latest;
    // 后台补全链（确认即关后执行）：AI 标题生成 → 重命名笔记 → 原位注入 → 完成通知；
    // 快照先复制副本（closeBlackBoxCapture 会置空 selectionSnap/externalSel）
    const snap = selectionSnap;
    const ext = externalSel;
    const flowMode = conceptFlowMode;
    void finalizeEntrySave(appRef, entries[0], snap, ext, flowMode);
    if (activeType === 'literature' && flowMode && entries[0]) {
      // 新概念流转（ticket 50）：记录回填目标 → 同弹窗依次概念录入，全部完成后回填摘抄 terms
      flowLitId = entries[0].id;
      notice(`摘抄已存入，依次录入 ${pendingConceptQueue.length} 个新概念`, 'success');
      startConceptFlow();
      return;
    }
    notice(`已存入黑匣子（${entries.length} 条）`, 'success');
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
    notice('存入失败', 'error');
  }
}

/** 文献/想法后台补全（确认即关后执行）：AI 标题生成（无分析标题时）→ 重命名笔记 → 原位注入；
 *  写前重载防并发覆盖；失败静默（已落盘数据永不回滚）；标题生成成功且改名 → 通知。 */
async function finalizeEntrySave(
  app: App,
  first: Entry | undefined,
  snap: SelectionSnapshot | null,
  ext: BlackBoxExternalSelection | null,
  flowMode: boolean
): Promise<void> {
  if (!first || first.type === 'concept') return;
  try {
    const m = manager(app);
    const latest = await m.load();
    const e = latest.entries.find((x) => x.id === first.id);
    if (!e) return;
    // AI 标题：分析标题已在保存时落盘则复用；否则（空 或 正文前 20 字降级名——水合时文件名回退为 title）后台生成，失败保持降级标题
    const fallbackTitle = sanitizeFileName((e.text || '').replace(/\s+/g, ' ').trim().slice(0, 20));
    let title = (e.title || '').trim();
    if (!title || title === fallbackTitle) {
      try {
        const t = await new BlackBoxAI().suggestTitle(e.text || '');
        title = (t || '').trim();
      } catch (err) {
        /* AI 不可用：保持降级标题 */
      }
    }
    if (title && title !== e.title) {
      const ok = await m.renameEntryNote(latest, e.id, title);
      if (ok) notice(`已生成标题「${title}」`, 'info');
    }
    // 原位注入（ticket 06）：摘抄目标 = AI 标题；书内选区（epub 不可写）与流转模式跳过
    if (!ext && !flowMode && e.type === 'literature') {
      await injectIntoSourceNote(app, snap, title || entryNoteTitle(e));
    }
  } catch (err) {
    console.warn('黑匣子后台补全失败', err);
  }
}

// ---------------- 新概念流转（ticket 50） ----------------

/** 启动/推进概念流转：预填当前概念名（可编辑）+ 来源继承摘抄（ADR-0016 单值） */
function startConceptFlow(): void {
  if (!pendingConceptQueue.length) return;
  activeType = 'concept';
  conceptName = pendingConceptQueue[0];
  conceptDefinition = '';
  conceptRelatedIds = [];
  conceptNameLocked = false;
  conceptSource = literatureSource;
  gotoStep('content');
}

/** 一个概念确认（或重名直连）后：推进到下一个新概念，或回填收尾 */
function nextConceptFlow(): void {
  pendingConceptQueue.shift();
  if (pendingConceptQueue.length) {
    startConceptFlow();
  } else {
    void finishConceptFlow();
  }
}

/** 收尾（ticket 50）：回填摘抄 terms（追加全部新建概念）→ 直达模式自动关闭 / 引导模式回类型选择 */
async function finishConceptFlow(): Promise<void> {
  if (appRef && flowLitId && flowCreated.length) {
    try {
      const m = manager(appRef);
      const latest = await m.load();
      const ok = await m.appendEntryTerms(latest, flowLitId, flowCreated.map((c) => c.id));
      if (ok) notice(`已把 ${flowCreated.length} 个新概念加入摘抄关联`, 'success');
    } catch (e) {
      console.warn('黑匣子摘抄关联回填失败', e);
    }
  }
  conceptFlowMode = false;
  pendingConceptQueue = [];
  flowLitId = null;
  flowCreated = [];
  if (directType) {
    // 直达命令（含 EPUB 选区）：全部完成后自动关闭（保持直达「保存即关」语义）
    closeBlackBoxCapture();
  } else {
    resetEntry();
    renderStep();
  }
}
