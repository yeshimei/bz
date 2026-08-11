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
let conceptGenerated = false;
// 文献表单
let literatureText = '';
let literatureSource = '';
let literatureSuggest: { id: string | null; label: string; checked: boolean }[] = [];
let literatureTerms = new Set<string>();
let literatureInsight = '';
// 想法表单
let thoughtText = '';
let sceneText = '';
/** 追问降级文案轮换计数 */
let fallbackIdx = 0;

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
  resetEntry();
  buildDOM();
  renderStep();
}

/** 重置一条录入的全部状态（重开/换类型/保存完成后） */
function resetEntry(): void {
  activeStep = 'type';
  activeType = 'thought';
  selectedTags = [];
  peopleChips = [];
  newProfileOpen = false;
  conceptName = '';
  conceptDefinition = '';
  conceptRelatedIds = [];
  conceptGenerated = false;
  literatureText = '';
  literatureSource = '';
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

/** 顶部轻导航：类型名 + 「←」图标（悬停提示换类型；引导文案由输入框 placeholder 承担） */
function guideHead(typeLabel: string, backToType = true): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-blackbox-guide-head';
  const label = document.createElement('span');
  label.className = 'bz-blackbox-guide-type';
  label.textContent = typeLabel;
  head.appendChild(label);
  if (backToType) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'bz-blackbox-guide-back';
    back.textContent = '←';
    back.title = '换一个类型';
    back.addEventListener('click', () => {
      resetEntry();
      renderStep();
    });
    head.appendChild(back);
  }
  return head;
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
      gotoStep('content');
    });
    box.appendChild(card);
  }
}

// ---------------- ② 内容输入 ----------------

function renderStepContent(): void {
  const box = document.getElementById('bz-blackbox-step-content');
  if (!box) return;
  box.innerHTML = '';
  if (activeType === 'concept') {
    box.appendChild(guideHead('🧩 概念'));
    box.appendChild(fieldLabel('名词', '想搞懂的概念或实体，如「提喻法」'));
    const input = document.createElement('textarea');
    input.id = 'bz-blackbox-concept-name';
    input.className = 'bz-blackbox-textarea';
    input.placeholder = '输入名词，点「✨ 生成卡片」（← 换类型）';
    input.value = conceptGenerated ? conceptDefinition : conceptName;
    input.addEventListener('input', () => {
      if (conceptGenerated) conceptDefinition = input.value;
      else conceptName = input.value.trim();
    });
    box.appendChild(input);
    const genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.id = 'bz-blackbox-concept-gen';
    genBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary bz-blackbox-guide-main';
    genBtn.textContent = conceptGenerated ? '✅ 确认录入' : '✨ 生成卡片';
    genBtn.addEventListener('click', () => void onConceptMainBtn(genBtn));
    box.appendChild(genBtn);
  } else if (activeType === 'literature') {
    box.appendChild(guideHead('📎 文献'));
    box.appendChild(fieldLabel('摘抄（必填）', '从别处摘下的信息片段'));
    const text = document.createElement('textarea');
    text.id = 'bz-blackbox-lit-text';
    text.className = 'bz-blackbox-textarea';
    text.placeholder = '粘贴摘抄内容……（← 换类型）';
    text.value = literatureText;
    text.addEventListener('input', () => (literatureText = text.value));
    box.appendChild(text);
    box.appendChild(fieldLabel('来源', 'URL 或书名/出处'));
    const source = document.createElement('input');
    source.id = 'bz-blackbox-lit-source';
    source.className = 'bz-blackbox-input';
    source.placeholder = 'https://… 或《书名》';
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
    box.appendChild(guideHead('💡 想法'));
    box.appendChild(fieldLabel('想法（必填）', '你自己的思考、感受、念头'));
    const text = document.createElement('textarea');
    text.id = 'bz-blackbox-thought-text';
    text.className = 'bz-blackbox-textarea';
    text.placeholder = '此刻在想什么……（← 换类型）';
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

// ----- 概念：生成卡片 / 确认录入 -----

async function onConceptMainBtn(btn: HTMLButtonElement): Promise<void> {
  if (conceptGenerated) {
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
    notice('❌ 生成失败：AI 暂时无法说话，可手动编辑后确认录入', 'error');
  }
  conceptGenerated = true;
  btn.disabled = false;
  renderStepContent();
}

/** 概念：确认即保存 → 展示连接关系（流程结束） */
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
    notice('✅ 已录入概念卡片');
    // 连接展示（写前快照已含 related 概念条目）
    gotoStep('conn');
    if (r.shouldReview) {
      void triggerAutoReview(appRef, latest);
    }
  } catch (e) {
    console.warn('黑匣子概念保存失败', e);
    notice('❌ 存入失败', 'error');
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
  const head = document.createElement('div');
  head.className = 'bz-blackbox-guide-head';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'bz-blackbox-guide-back';
  back.textContent = '← 返回';
  back.addEventListener('click', () => gotoStep('content'));
  head.appendChild(back);
  const label = document.createElement('span');
  label.className = 'bz-blackbox-guide-type';
  label.textContent = activeType === 'literature' ? '📎 文献 · 补充感触' : '💡 想法 · 补充感触';
  head.appendChild(label);
  box.appendChild(head);

  if (activeType === 'literature') {
    // 名词表（分析后才有）
    if (literatureSuggest.length) {
      box.appendChild(fieldLabel('名词表', '勾选要关联的概念（✦ 为新概念，存入时生成卡片）'));
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
    box.appendChild(fieldLabel('💡 提炼想法（可选）', '包仔从摘抄提炼，可编辑，存入时作为独立想法条目'));
    const insight = document.createElement('textarea');
    insight.id = 'bz-blackbox-insight';
    insight.className = 'bz-blackbox-textarea';
    insight.placeholder = literatureInsight || '（无提炼，可直接跳过）';
    insight.value = literatureInsight;
    insight.addEventListener('input', () => (literatureInsight = insight.value));
    box.appendChild(insight);
  }

  box.appendChild(fieldLabel('情绪', `可选，最多 ${MAX_EMOTIONS} 个`));
  const emotionRow = document.createElement('div');
  emotionRow.className = 'bz-blackbox-emotions';
  emotionRow.id = 'bz-blackbox-emotions';
  box.appendChild(emotionRow);
  renderEmotions();

  box.appendChild(fieldLabel('涉及的人', `可选，最多 ${MAX_PEOPLE} 个：输入名字回车，或从已有画像选择`));
  const peopleRow = document.createElement('div');
  peopleRow.className = 'bz-blackbox-people-row';
  peopleRow.id = 'bz-blackbox-people-row';
  box.appendChild(peopleRow);
  renderPeopleChips();

  box.appendChild(fieldLabel('场景', '可选，当时在做什么'));
  const scene = document.createElement('input');
  scene.id = 'bz-blackbox-scene';
  scene.className = 'bz-blackbox-input';
  scene.placeholder = '深夜通勤、午休、看完那本书……';
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

async function saveEntry(): Promise<void> {
  if (!appRef) return;
  let entries: Entry[] = [];
  if (activeType === 'literature') {
    if (!literatureText.trim()) {
      notice('⚠️ 摘抄不能为空');
      return;
    }
    entries.push(
      createEntry({
        type: 'literature',
        text: literatureText.trim(),
        source: literatureSource.trim(),
        terms: [...literatureTerms],
        emotions: selectedTags,
        people: peopleChips,
        scene: sceneText.trim(),
        toward: '',
        links: [],
      })
    );
    // 提炼想法（可编辑/清空）：非空时同一次保存写入独立 thought 条目（共享感触）
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
    entries.push(
      createEntry({
        type: 'thought',
        text: thoughtText.trim(),
        emotions: selectedTags,
        people: peopleChips,
        scene: sceneText.trim(),
        toward: '',
        links: [],
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
    data = latest;
    notice(`✅ 已存入黑匣子（${entries.length} 条）`);
    resetEntry();
    renderStep();
    if (shouldReview) {
      // 静默复盘：不弹窗不通知，产物公开写入对话面板（打开时可见）
      void triggerAutoReview(appRef, latest);
    }
  } catch (e) {
    console.warn('黑匣子保存失败', e);
    notice('❌ 存入失败', 'error');
  }
}
