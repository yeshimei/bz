/**
 * 黑匣子录入弹窗（ticket 35）：bz-blackbox-capture「写感触」。
 * 必填（素材/感受）+ 情绪 chips（24 词多选最多 3 + 强度 1-5）+ 折叠「更多维度」（场景/涉及的人/指向/链接）
 * + AI 辅助（追问/联想/查概念，均可选，失败降级不打断录入）。
 * 保存后阈值命中 → 静默复盘（triggerAutoReview，不打扰）。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { createOverlay } from '../core/dom';
import { notice } from '../core/notice';
import { BlackBoxAI, fallbackAsk } from './ai';
import { BlackBoxDataManager, createImpression } from './data';
import { triggerAutoReview } from './review';
import { DIRECTION_OPTIONS, EMOTION_TAGS, MAX_EMOTIONS, MAX_INTENSITY } from './types';
import type { Direction, Impression } from './types';

let appRef: App | null = null;
let dataManager: BlackBoxDataManager | null = null;
let maskEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;

/** 表单状态（弹窗内实时） */
let selectedTags: string[] = [];
let intensityByTag: Record<string, number> = {};
let direction: Direction = '';

function manager(app: App): BlackBoxDataManager {
  if (!dataManager) dataManager = new BlackBoxDataManager(app);
  return dataManager;
}

/** 打开录入弹窗（幂等） */
export function openBlackBoxCapture(app: App): void {
  appRef = app;
  if (maskEl) {
    maskEl.style.display = 'block';
    return;
  }
  selectedTags = [];
  intensityByTag = {};
  direction = '';
  buildDOM();
}

export function closeBlackBoxCapture(): void {
  if (maskEl) {
    maskEl.remove();
    maskEl = null;
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
}

// ---------------- DOM ----------------

function buildDOM(): void {
  const { mask, popup } = createOverlay({
    maskId: 'bz-blackbox-capture-mask',
    popupId: 'bz-blackbox-capture-popup',
    zIndex: 10040,
    width: '480px',
    onMaskClick: () => closeBlackBoxCapture(),
  });
  maskEl = mask;
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  // header
  const header = document.createElement('div');
  header.className = 'bz-blackbox-modal-header';
  header.textContent = '🕳️ 写感触';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'bz-blackbox-modal-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closeBlackBoxCapture());
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // body
  const body = document.createElement('div');
  body.className = 'bz-blackbox-capture-body';

  // 素材（必填）
  body.appendChild(fieldLabel('素材（必填）', '别人说的话、文章段落——让你触动的那个东西'));
  const material = document.createElement('textarea');
  material.id = 'bz-blackbox-material';
  material.className = 'bz-blackbox-textarea';
  material.placeholder = '那段话、那个句子、那件事……';
  body.appendChild(material);

  // 感受（必填）
  body.appendChild(fieldLabel('感受（必填）', '为什么触动你、勾起什么回忆、想对谁说'));
  const feeling = document.createElement('textarea');
  feeling.id = 'bz-blackbox-feeling';
  feeling.className = 'bz-blackbox-textarea';
  feeling.placeholder = '写下来，这是真正属于你的部分';
  body.appendChild(feeling);

  // 情绪（chips + 强度）
  body.appendChild(fieldLabel('情绪', `最多 ${MAX_EMOTIONS} 个，每个带强度 1-${MAX_INTENSITY}`));
  const emotionRow = document.createElement('div');
  emotionRow.className = 'bz-blackbox-emotions';
  emotionRow.id = 'bz-blackbox-emotions';
  body.appendChild(emotionRow);
  const intensityRow = document.createElement('div');
  intensityRow.id = 'bz-blackbox-intensity';
  intensityRow.className = 'bz-blackbox-intensity';
  body.appendChild(intensityRow);

  // 更多维度（折叠）
  const details = document.createElement('details');
  details.className = 'bz-blackbox-details';
  const summary = document.createElement('summary');
  summary.textContent = '更多维度（可选）';
  details.appendChild(summary);

  details.appendChild(fieldLabel('场景', '当时在做什么'));
  const scene = document.createElement('input');
  scene.id = 'bz-blackbox-scene';
  scene.className = 'bz-blackbox-input';
  scene.placeholder = '深夜通勤、午休、看完那本书……';
  details.appendChild(scene);

  details.appendChild(fieldLabel('涉及的人', ''));
  const people = document.createElement('input');
  people.id = 'bz-blackbox-people';
  people.className = 'bz-blackbox-input';
  people.placeholder = '谁在里面';
  details.appendChild(people);

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
  body.appendChild(details);

  // AI 辅助
  const aiRow = document.createElement('div');
  aiRow.className = 'bz-blackbox-ai-row';
  const aiAsk = mkAiBtn('❓ 追问', () => runAssist('ask'));
  const aiRecall = mkAiBtn('💭 联想', () => runAssist('recall'));
  const aiConcept = mkAiBtn('🔍 查概念', () => openConceptInput());
  aiRow.append(aiAsk, aiRecall, aiConcept);
  body.appendChild(aiRow);
  const aiResult = document.createElement('div');
  aiResult.id = 'bz-blackbox-ai-result';
  aiResult.className = 'bz-blackbox-ai-result';
  body.appendChild(aiResult);

  popup.appendChild(body);

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
  save.addEventListener('click', () => void saveImpression());
  footer.append(cancel, save);
  popup.appendChild(footer);

  escHandle = escManager.register('blackbox-capture', { isVisible: () => !!maskEl, close: () => closeBlackBoxCapture() });
  renderEmotions();
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

function mkAiBtn(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bz-blackbox-ai-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function renderEmotions(): void {
  const row = document.getElementById('bz-blackbox-emotions');
  if (!row) return;
  row.innerHTML = '';
  for (const tag of EMOTION_TAGS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'bz-blackbox-chip' + (selectedTags.includes(tag) ? ' bz-blackbox-chip-on' : '');
    chip.textContent = tag;
    chip.addEventListener('click', () => toggleTag(tag));
    row.appendChild(chip);
  }
  renderIntensity();
}

function toggleTag(tag: string): void {
  const i = selectedTags.indexOf(tag);
  if (i >= 0) {
    selectedTags.splice(i, 1);
    delete intensityByTag[tag];
  } else {
    if (selectedTags.length >= MAX_EMOTIONS) {
      notice(`⚠️ 最多选 ${MAX_EMOTIONS} 个情绪`);
      return;
    }
    selectedTags.push(tag);
    intensityByTag[tag] = 3;
  }
  renderEmotions();
}

function renderIntensity(): void {
  const row = document.getElementById('bz-blackbox-intensity');
  if (!row) return;
  row.innerHTML = '';
  for (const tag of selectedTags) {
    const group = document.createElement('div');
    group.className = 'bz-blackbox-intensity-group';
    const name = document.createElement('span');
    name.textContent = tag;
    group.appendChild(name);
    for (let v = 1; v <= MAX_INTENSITY; v++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bz-blackbox-intensity-btn' + (intensityByTag[tag] === v ? ' bz-blackbox-intensity-on' : '');
      b.textContent = String(v);
      b.addEventListener('click', () => {
        intensityByTag[tag] = v;
        renderIntensity();
      });
      group.appendChild(b);
    }
    row.appendChild(group);
  }
}

function renderDirection(row: HTMLElement): void {
  for (const btn of Array.from(row.querySelectorAll('.bz-blackbox-dir'))) {
    btn.classList.toggle('bz-blackbox-dir-on', (btn as HTMLElement).dataset.dir === direction);
  }
}

// ---------------- 保存 ----------------

async function saveImpression(): Promise<void> {
  if (!appRef) return;
  const material = (document.getElementById('bz-blackbox-material') as HTMLTextAreaElement).value.trim();
  const feeling = (document.getElementById('bz-blackbox-feeling') as HTMLTextAreaElement).value.trim();
  if (!material) {
    notice('⚠️ 素材不能为空');
    return;
  }
  if (!feeling) {
    notice('⚠️ 感受不能为空');
    return;
  }
  const scene = (document.getElementById('bz-blackbox-scene') as HTMLInputElement).value.trim();
  const people = (document.getElementById('bz-blackbox-people') as HTMLInputElement).value.trim();
  const links = (document.getElementById('bz-blackbox-links') as HTMLInputElement).value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const imp: Impression = createImpression({
    material,
    feeling,
    emotions: selectedTags.map((tag) => ({ tag, intensity: intensityByTag[tag] || 3 })),
    scene,
    people,
    direction,
    links,
  });
  try {
    const m = manager(appRef);
    const data = await m.load();
    const { shouldReview } = await m.addImpression(data, imp);
    notice('✅ 已存入黑匣子');
    closeBlackBoxCapture();
    if (shouldReview) {
      // 静默复盘：不弹窗不通知，产物公开写入对话面板（打开时可见）
      void triggerAutoReview(appRef, data);
    }
  } catch (e) {
    console.warn('黑匣子保存失败', e);
    notice('❌ 存入失败', 'error');
  }
}

// ---------------- AI 辅助（均可选，失败降级） ----------------

function setAiBusy(busy: boolean): void {
  const row = document.querySelector('.bz-blackbox-ai-row');
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

async function runAssist(kind: 'ask' | 'recall'): Promise<void> {
  if (!appRef) return;
  const material = (document.getElementById('bz-blackbox-material') as HTMLTextAreaElement).value.trim();
  const feeling = (document.getElementById('bz-blackbox-feeling') as HTMLTextAreaElement).value.trim();
  const input = kind === 'ask' ? (feeling || material) : material;
  if (!input) {
    notice('⚠️ 先写点素材或感受吧');
    return;
  }
  setAiBusy(true);
  try {
    const ai = new BlackBoxAI();
    const data = await manager(appRef).load();
    const reply = await ai.assist(kind, input, data.impressions);
    const append = document.createElement('button');
    append.className = 'bz-blackbox-ai-append';
    append.textContent = '加入感受';
    append.addEventListener('click', () => {
      const f = document.getElementById('bz-blackbox-feeling') as HTMLTextAreaElement;
      f.value = (f.value ? f.value + '\n' : '') + `「${reply}」`;
      f.focus();
    });
    showAiResult(`<div class="bz-blackbox-ai-msg">${escapeHtml(reply)}</div>`);
    document.getElementById('bz-blackbox-ai-result')!.appendChild(append);
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

function openConceptInput(): void {
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
    void runConcept(term);
  });
  el.innerHTML = '';
  el.append(input, go);
  input.focus();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const term = input.value.trim();
      if (term) void runConcept(term);
    }
  });
}

async function runConcept(term: string): Promise<void> {
  if (!appRef) return;
  setAiBusy(true);
  try {
    const ai = new BlackBoxAI();
    const reply = await ai.assist('concept', term);
    const append = document.createElement('button');
    append.className = 'bz-blackbox-ai-append';
    append.textContent = '加入素材';
    append.addEventListener('click', () => {
      const m = document.getElementById('bz-blackbox-material') as HTMLTextAreaElement;
      m.value = (m.value ? m.value + '\n' : '') + `📎 ${term}：${reply}`;
      m.focus();
    });
    showAiResult(`<div class="bz-blackbox-ai-msg">📎 <b>${escapeHtml(term)}</b>：${escapeHtml(reply)}</div>`);
    document.getElementById('bz-blackbox-ai-result')!.appendChild(append);
  } catch (e) {
    notice('❌ 查询失败：AI 暂时无法说话', 'error');
  } finally {
    setAiBusy(false);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
