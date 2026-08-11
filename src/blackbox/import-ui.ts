/**
 * 卡片盒导入确认弹窗（一次性工具）：bz-blackbox-import-cardbox「导入卡片盒」。
 * 一张一张确认：扫描「卡片盒/*.md」一次（本地 IO 秒级）→ 规则预筛（空卡/敏感/残渣自动跳过）→
 * 全部按概念导入（不做 AI 类型分类；后台按 20 张预取 + 本地关联构建）→ 每次只展示一张卡的
 * 完整原始内容（Markdown 渲染）→ 「✅ 导入这张」/「🚫 跳过（永不录入）」/「✨ AI 总结」→
 * 自动下一张，直到全部处理完。
 * 跳过/导入只作用于卡片盒导入流程，黑匣子正常录入不受影响。
 */
import type { App } from 'obsidian';
import { Component, MarkdownRenderer } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { createOverlay } from '../core/dom';
import { notice } from '../core/notice';
import { BlackBoxAI } from './ai';
import { BlackBoxDataManager } from './data';
import {
  CLASSIFY_BATCH,
  scanCardboxAsync,
  prefilterCard,
  buildRelations,
  generateSummaries,
  readImportLog,
  runImport,
} from './import-cardbox';
import type { CardItem, ClassifiedCard } from './import-cardbox';

let appRef: App | null = null;
let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;

/** 未处理的剩余卡片（尚未 AI 分类） */
let queue: CardItem[] = [];
/** 已分类的待确认池（一次预取 20 张，UI 逐张展示） */
let pool: ClassifiedCard[] = [];
/** 已处理张数（统计用） */
let doneCount = 0;
/** 用户标记跳过的卡（导入时持久化，永不录入；可撤销） */
let skippedNames: string[] = [];
/** 撤销栈：最近跳过的卡（可恢复回队列） */
let undoStack: ClassifiedCard[] = [];
/** 已导入卡片名（本次会话去重展示） */
let importedNames = new Set<string>();
/** 规则预筛跳过数 */
let ruleSkippedCount = 0;
let busy = false;

/** 打开导入面板（幂等：已开先关；异步：扫描→预筛→预取第一批→渲染第一张） */
export async function openCardboxImport(app: App): Promise<void> {
  appRef = app;
  if (maskEl) {
    maskEl.style.display = 'block';
    return;
  }
  const { mask, popup } = createOverlay({
    maskId: 'bz-blackbox-import-mask',
    popupId: 'bz-blackbox-import-popup',
    zIndex: 10040,
    width: '640px',
    maxWidth: 640,
    onMaskClick: () => closeCardboxImport(),
  });
  maskEl = mask;
  popupEl = popup;
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  // 骨架：标题行 + 统计 + 卡片区 + 操作区
  const head = document.createElement('div');
  head.className = 'bz-blackbox-import-head';
  const title = document.createElement('span');
  title.className = 'bz-blackbox-import-title';
  title.textContent = '📥 导入卡片盒';
  head.appendChild(title);
  const stats = document.createElement('span');
  stats.id = 'bz-blackbox-import-stats';
  stats.className = 'bz-blackbox-import-stats';
  head.appendChild(stats);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bz-blackbox-hdr-btn bz-blackbox-hdr-close';
  closeBtn.textContent = '❌';
  closeBtn.title = '关闭（进度已记录，下次继续）';
  closeBtn.addEventListener('click', () => closeCardboxImport());
  head.appendChild(closeBtn);
  popup.appendChild(head);

  // 当前卡片区：完整原始内容
  const card = document.createElement('div');
  card.id = 'bz-blackbox-import-card';
  card.className = 'bz-blackbox-import-card';
  popup.appendChild(card);

  // 操作区：✨AI 总结 / 🚫跳过 / ✅导入这张
  const ops = document.createElement('div');
  ops.className = 'bz-blackbox-import-ops';
  const aiBtn = document.createElement('button');
  aiBtn.type = 'button';
  aiBtn.id = 'bz-blackbox-import-ai';
  aiBtn.className = 'bz-blackbox-import-ai';
  aiBtn.textContent = '✨ AI 总结';
  aiBtn.title = '勾选后由 AI 生成一句话总结（不勾选用原卡自带描述）';
  aiBtn.addEventListener('click', () => toggleAiSummary());
  ops.appendChild(aiBtn);
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.id = 'bz-blackbox-import-skip';
  skipBtn.className = 'bz-blackbox-import-skip';
  skipBtn.textContent = '🚫 跳过';
  skipBtn.title = '这张卡永不导入（记录后重跑不再出现）';
  skipBtn.addEventListener('click', () => void doSkip());
  ops.appendChild(skipBtn);
  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.id = 'bz-blackbox-import-run';
  importBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary bz-blackbox-guide-main';
  importBtn.textContent = '⏳ 扫描中…';
  importBtn.disabled = true;
  importBtn.addEventListener('click', () => void doImport());
  ops.appendChild(importBtn);
  popup.appendChild(ops);

  // 撤销跳过区
  const undoBox = document.createElement('div');
  undoBox.id = 'bz-blackbox-import-undobox';
  undoBox.className = 'bz-blackbox-import-skipped';
  popup.appendChild(undoBox);

  escHandle = escManager.register('blackbox-import', { isVisible: () => !!maskEl, close: () => closeCardboxImport() });

  // 异步准备：扫描 → 预筛 → 预取第一批
  void prepare();
}

export function closeCardboxImport(): void {
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

export function unloadCardboxImport(): void {
  closeCardboxImport();
  appRef = null;
  queue = [];
  pool = [];
  doneCount = 0;
  skippedNames = [];
  undoStack = [];
  importedNames = new Set();
  ruleSkippedCount = 0;
  busy = false;
}

/** 扫描 + 预筛 + 预取第一批（扫描本地 IO 秒级；AI 只在池空时请求） */
async function prepare(): Promise<void> {
  if (!appRef) return;
  try {
    const cards = await scanCardboxAsync(appRef);
    const log = await readImportLog(appRef);
    importedNames = log.imported;
    const already = new Set([...log.imported, ...log.skipped]);
    queue = [];
    for (const c of cards) {
      if (already.has(c.name)) continue; // 已导入/已跳过的不再出现
      if (prefilterCard(c)) {
        ruleSkippedCount++;
        continue; // 规则预筛（空卡/敏感/残渣）
      }
      queue.push(c);
    }
    updateStats();
    await ensurePool();
    void renderCard();
  } catch (e) {
    console.warn('卡片盒扫描失败', e);
    notice('❌ 扫描失败：无法读取卡片盒', 'error');
    const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = false;
      btn.textContent = '关闭';
      btn.onclick = () => closeCardboxImport();
    }
  }
}

/** 池空时从队列预取一批（全部按概念；本地构建关联：池内双链/TF-IDF） */
async function ensurePool(): Promise<void> {
  if (pool.length || !queue.length) return;
  const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 载入中…';
  }
  const batchCards = queue.splice(0, CLASSIFY_BATCH);
  const classified: ClassifiedCard[] = batchCards.map((c) => ({
    ...c,
    kind: 'concept',
    reason: '全部按概念导入',
    relatedNames: [],
    aiSummary: false,
    summary: '',
  }));
  // 关联：池内互链 + 既有概念（本批外的名字导入时自然落空，可接受）
  try {
    const m = new BlackBoxDataManager(appRef!);
    const data = await m.load();
    const existingConcepts = data.entries.filter((e) => e.type === 'concept');
    const rel = buildRelations(batchCards, existingConcepts);
    for (const c of classified) c.relatedNames = rel.get(c.name) || [];
  } catch (e) {
    /* 关联失败不影响导入 */
  }
  pool.push(...classified);
  updateStats();
}

/** 渲染当前一张卡（完整原始内容） */
async function renderCard(): Promise<void> {
  const card = document.getElementById('bz-blackbox-import-card');
  if (!card) return;
  card.innerHTML = '';
  if (!pool.length && !queue.length) {
    card.innerHTML =
      '<div class="bz-blackbox-empty"><div class="bz-blackbox-empty-title">🎉 全部处理完毕</div>' +
      '<div class="bz-blackbox-empty-desc">卡片盒已全部导入或跳过，可关闭弹窗</div></div>';
    const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✅ 完成';
      btn.onclick = () => closeCardboxImport();
    }
    updateStats();
    renderUndo();
    return;
  }
  const c = pool[0];
  if (!c) return; // 池空（预取中）

  // 头部行：类型 + 名称 + 分类
  const nameLine = document.createElement('div');
  nameLine.className = 'bz-blackbox-import-row-name';
  const kindTag = document.createElement('span');
  kindTag.className = 'bz-blackbox-import-kind';
  kindTag.textContent = '概念'; // 全部按概念导入
  nameLine.appendChild(kindTag);
  nameLine.appendChild(document.createTextNode(c.name));
  if (c.category) {
    const cat = document.createElement('span');
    cat.className = 'bz-blackbox-import-cat';
    cat.textContent = c.category;
    nameLine.appendChild(cat);
  }
  if (c.desc) {
    const desc = document.createElement('div');
    desc.className = 'bz-blackbox-import-desc';
    desc.textContent = `📝 ${c.desc}`;
    nameLine.appendChild(desc);
  }
  card.appendChild(nameLine);

  // 完整原始内容（Markdown 渲染，可滚动；渲染失败回退纯文本）
  const body = document.createElement('div');
  body.className = 'bz-blackbox-import-body';
  body.textContent = c.text || '（无正文）';
  card.appendChild(body);
  if (c.text) {
    try {
      await MarkdownRenderer.render(appRef!, c.text, body, '', new Component());
    } catch (e) {
      /* 渲染失败保留 textContent 回退 */
    }
  }

  // 按钮状态
  const aiBtn = document.getElementById('bz-blackbox-import-ai') as HTMLButtonElement | null;
  if (aiBtn) {
    aiBtn.classList.toggle('on', c.aiSummary);
    aiBtn.textContent = c.aiSummary ? '✨ AI 总结 ✓' : '✨ AI 总结';
  }
  const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = false;
    btn.textContent = '✅ 导入这张';
  }
  updateStats();
  renderUndo();
}

/** 撤销跳过区：最近跳过的卡可恢复 */
function renderUndo(): void {
  const box = document.getElementById('bz-blackbox-import-undobox');
  if (!box) return;
  box.innerHTML = '';
  if (!skippedNames.length) return;
  const label = document.createElement('span');
  label.className = 'bz-blackbox-import-skipped-label';
  label.textContent = `🚫 已跳过 ${skippedNames.length} 张（导入时记录，永不录入）：`;
  box.appendChild(label);
  for (const c of undoStack) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'bz-blackbox-import-restore';
    chip.textContent = `${c.name} ↩`;
    chip.title = '撤销跳过，恢复这张卡';
    chip.addEventListener('click', () => {
      skippedNames = skippedNames.filter((x) => x !== c.name);
      undoStack = undoStack.filter((x) => x.name !== c.name);
      pool.unshift(c); // 回到当前待确认队列头
      void renderCard();
      notice(`↩ 已恢复「${c.name}」`);
    });
    box.appendChild(chip);
  }
}

function updateStats(): void {
  const stats = document.getElementById('bz-blackbox-import-stats');
  if (!stats) return;
  const total = doneCount + queue.length + pool.length + importedNames.size + skippedNames.length;
  const pos = doneCount + 1;
  stats.textContent = `第 ${pos}/${Math.max(total, pos)} 张 · 已导入 ${importedNames.size} · 已跳过 ${skippedNames.length}`;
}

/** ✨ AI 总结开关（只作用于当前这张） */
function toggleAiSummary(): void {
  const c = pool[0];
  if (!c) return;
  c.aiSummary = !c.aiSummary;
  void renderCard();
}

/** 跳过当前这张（永不录入；可撤销） */
async function doSkip(): Promise<void> {
  if (!appRef || busy) return;
  const c = pool[0];
  if (!c) return;
  busy = true;
  try {
    pool.shift();
    doneCount++;
    skippedNames.push(c.name);
    undoStack.push(c);
    if (undoStack.length > 20) undoStack.shift();
    notice(`🚫 已跳过「${c.name}」（可撤销）`);
    if (!pool.length) await ensurePool();
    void renderCard();
  } finally {
    busy = false;
  }
}

/** 导入当前这张：AI 总结（勾选时）→ 批量写入 → 日志（含已跳过）→ 下一张 */
async function doImport(): Promise<void> {
  if (!appRef || busy) return;
  const c = pool[0];
  if (!c) return;
  busy = true;
  const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  try {
    if (c.aiSummary) {
      if (btn) btn.textContent = '⏳ 生成总结…';
      await generateSummaries(new BlackBoxAI(), [c]);
    }
    if (btn) btn.textContent = '⏳ 导入中…';
    const m = new BlackBoxDataManager(appRef);
    const data = await m.load();
    const r = await runImport(appRef, [c], data, skippedNames);
    notice(`✅ 已导入「${c.name}」`);
    importedNames.add(c.name);
    skippedNames = [];
    undoStack = [];
    pool.shift();
    doneCount++;
    if (!pool.length) await ensurePool();
    void renderCard();
  } catch (e) {
    console.warn('卡片盒导入失败', e);
    notice('❌ 导入失败，请重试', 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✅ 导入这张';
    }
  } finally {
    busy = false;
  }
}
