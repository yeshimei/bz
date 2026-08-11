/**
 * 卡片盒导入确认弹窗（一次性工具）：bz-blackbox-import-cardbox「导入卡片盒」。
 * 组模式：扫描「卡片盒/*.md」一次（本地 IO 秒级）→ 规则预筛（空卡/敏感/残渣自动跳过）→
 * 每次载入一组 20 张 → 逐张浏览完整原始内容（Markdown 渲染）：「✅ 确认导入」暂存 /
 * 「🚫 跳过」从本组删除（可撤销）→ 本组处理完 → 「✨ 生成并导入本组 N 张」：
 * 一次批量 AI 生成黑匣子概念卡（定义+关联）→ 批量写入（一次 load→push→save，不触发复盘）→
 * 自动下一组，直到全部处理完毕。
 * 关联动态双向：AI 挑中的既有概念反向关联新卡（backfillRelated）；跨批 pendingLinks 补链。
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
  readImportLog,
  runImport,
  resolvePendingLinks,
} from './import-cardbox';
import type { CardItem, ClassifiedCard } from './import-cardbox';

let appRef: App | null = null;
let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;

/** 未处理的剩余卡片（尚未载入任何组） */
let queue: CardItem[] = [];
/** 当前组（未处理卡片；已确认的在 staged，已跳过的移除） */
let group: ClassifiedCard[] = [];
/** 本组确认导入的暂存列表 */
let staged: ClassifiedCard[] = [];
/** 本组跳过的卡名（导入时持久化，永不录入；可撤销） */
let skippedNames: string[] = [];
/** 撤销栈：最近跳过的卡（可恢复回本组） */
let undoStack: ClassifiedCard[] = [];
/** 已导入卡片名（累计展示） */
let importedNames = new Set<string>();
/** 规则预筛跳过数 */
let ruleSkippedCount = 0;
/** 当前组序号 */
let groupNo = 0;
let busy = false;

/** 打开导入面板（幂等：已开先关；异步：扫描→预筛→载入第一组） */
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

  // 操作区：🚫跳过 / ✅确认导入 / ✨生成并导入本组
  const ops = document.createElement('div');
  ops.className = 'bz-blackbox-import-ops';
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.id = 'bz-blackbox-import-skip';
  skipBtn.className = 'bz-blackbox-import-skip';
  skipBtn.textContent = '🚫 跳过';
  skipBtn.title = '这张卡永不导入（导入时记录，重跑不再出现；可撤销）';
  skipBtn.addEventListener('click', () => void doSkip());
  ops.appendChild(skipBtn);
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.id = 'bz-blackbox-import-confirm';
  confirmBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary bz-blackbox-guide-main';
  confirmBtn.textContent = '✅ 确认导入';
  confirmBtn.title = '暂存这张卡，本组一起生成并导入';
  confirmBtn.addEventListener('click', () => void doConfirm());
  ops.appendChild(confirmBtn);
  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.id = 'bz-blackbox-import-run';
  runBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary bz-blackbox-guide-main';
  runBtn.textContent = '⏳ 扫描中…';
  runBtn.disabled = true;
  runBtn.addEventListener('click', () => void doGenerateImport());
  ops.appendChild(runBtn);
  popup.appendChild(ops);

  // 撤销跳过区
  const undoBox = document.createElement('div');
  undoBox.id = 'bz-blackbox-import-undobox';
  undoBox.className = 'bz-blackbox-import-skipped';
  popup.appendChild(undoBox);

  escHandle = escManager.register('blackbox-import', { isVisible: () => !!maskEl, close: () => closeCardboxImport() });

  // 异步准备：扫描 → 预筛 → 载入第一组
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
  group = [];
  staged = [];
  skippedNames = [];
  undoStack = [];
  importedNames = new Set();
  ruleSkippedCount = 0;
  groupNo = 0;
  busy = false;
}

/** 扫描 + 预筛 + 载入第一组 */
async function prepare(): Promise<void> {
  if (!appRef) return;
  try {
    const cards = await scanCardboxAsync(appRef);
    const log = await readImportLog(appRef);
    importedNames = log.imported;
    const already = new Set([...log.imported, ...log.skipped]);
    queue = [];
    for (const c of cards) {
      if (already.has(c.name)) continue; // 已导入/已跳过的组不再出现
      if (prefilterCard(c)) {
        ruleSkippedCount++;
        continue; // 规则预筛（空卡/敏感/残渣）
      }
      queue.push(c);
    }
    await loadNextGroup();
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

/** 载入下一组（20 张；队列空则进入完成态） */
async function loadNextGroup(): Promise<void> {
  if (!queue.length) {
    staged = [];
    group = [];
    void renderCard();
    return;
  }
  groupNo++;
  group = queue
    .splice(0, CLASSIFY_BATCH)
    .map((c) => ({
      ...c,
      kind: 'concept' as const,
      reason: '全部按概念导入',
      relatedNames: [],
      aiSummary: false,
      summary: '',
      aiRelated: [],
      aiChecked: false,
    }));
  staged = [];
  skippedNames = [];
  undoStack = [];
  void renderCard();
}

/** 渲染当前一张卡（完整原始内容 Markdown 渲染）或本组完成态 */
async function renderCard(): Promise<void> {
  const card = document.getElementById('bz-blackbox-import-card');
  if (!card) return;
  card.innerHTML = '';
  const c = group[0];
  const allDone = !queue.length && !group.length && !staged.length;
  if (!c) {
    card.innerHTML =
      '<div class="bz-blackbox-empty"><div class="bz-blackbox-empty-title">' +
      (allDone ? '🎉 全部处理完毕' : '本组已处理完') +
      '</div><div class="bz-blackbox-empty-desc">' +
      (allDone ? '卡片盒已全部导入或跳过，可关闭弹窗' : '点下方「✨ 生成并导入本组」一起导入暂存的卡片') +
      '</div></div>';
    updateOps();
    updateStats();
    renderUndo();
    return;
  }

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

  // 完整原始内容：Markdown 渲染（先清空再渲染避免重复）；失败回退纯文本
  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'bz-blackbox-import-body-wrap';
  card.appendChild(bodyWrap);
  const body = document.createElement('div');
  body.className = 'bz-blackbox-import-body';
  bodyWrap.appendChild(body);
  if (c.text) {
    try {
      body.empty();
      await MarkdownRenderer.render(appRef!, c.text, body, '', new Component());
    } catch (e) {
      body.textContent = c.text;
    }
  } else {
    body.textContent = '（无正文）';
  }
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'bz-blackbox-import-edit';
  editBtn.textContent = '✏️ 编辑';
  editBtn.title = '修改原文（确认导入时用修改后的内容生成）';
  editBtn.addEventListener('click', () => {
    const ta = document.createElement('textarea');
    ta.className = 'bz-blackbox-import-ta';
    ta.value = c.text || '';
    bodyWrap.innerHTML = '';
    bodyWrap.appendChild(ta);
    const ops = document.createElement('div');
    ops.className = 'bz-blackbox-import-ta-ops';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'bz-blackbox-btn bz-blackbox-btn-primary';
    save.textContent = '保存';
    save.addEventListener('click', () => {
      c.text = ta.value.trim();
      void renderCard();
      notice('✅ 原文已更新');
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'bz-blackbox-import-cancel';
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => void renderCard());
    ops.append(save, cancel);
    bodyWrap.appendChild(ops);
  });
  bodyWrap.appendChild(editBtn);

  updateOps();
  updateStats();
  renderUndo();
}

/** 更新操作区按钮状态（本组未处理完 → 确认/跳过；处理完 → 生成并导入本组） */
function updateOps(): void {
  const confirmBtn = document.getElementById('bz-blackbox-import-confirm') as HTMLButtonElement | null;
  const skipBtn = document.getElementById('bz-blackbox-import-skip') as HTMLButtonElement | null;
  const runBtn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
  if (!confirmBtn || !skipBtn || !runBtn) return;
  if (group.length) {
    confirmBtn.style.display = '';
    skipBtn.style.display = '';
    confirmBtn.disabled = false;
    skipBtn.disabled = false;
    runBtn.style.display = 'none';
    return;
  }
  // 本组处理完：只有「生成并导入本组」
  confirmBtn.style.display = 'none';
  skipBtn.style.display = 'none';
  runBtn.style.display = '';
  runBtn.disabled = false;
  if (!queue.length && !staged.length) {
    runBtn.textContent = '✅ 完成';
    runBtn.onclick = () => closeCardboxImport();
  } else if (staged.length) {
    runBtn.textContent = `✨ 生成并导入本组 ${staged.length} 张`;
  } else {
    runBtn.textContent = '⏭ 下一组';
  }
}

/** 撤销跳过区：最近跳过的卡可恢复回本组 */
function renderUndo(): void {
  const box = document.getElementById('bz-blackbox-import-undobox');
  if (!box) return;
  box.innerHTML = '';
  if (!skippedNames.length) return;
  const label = document.createElement('span');
  label.className = 'bz-blackbox-import-skipped-label';
  label.textContent = `🚫 本组跳过 ${skippedNames.length} 张（导入时记录，永不录入）：`;
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
      group.unshift(c);
      void renderCard();
      notice(`↩ 已恢复「${c.name}」`);
    });
    box.appendChild(chip);
  }
}

function updateStats(): void {
  const stats = document.getElementById('bz-blackbox-import-stats');
  if (!stats) return;
  const remain = queue.length + group.length;
  const total = importedNames.size + remain + ruleSkippedCount;
  stats.textContent = `第 ${groupNo || 1}/${Math.max(Math.ceil(total / CLASSIFY_BATCH), groupNo || 1)} 组 · 本组已确认 ${staged.length} · 已跳过 ${skippedNames.length} · 待处理 ${remain} · 累计导入 ${importedNames.size}`;
}

/** ✅ 确认导入：暂存本张，进下一张 */
async function doConfirm(): Promise<void> {
  if (!appRef || busy) return;
  const c = group[0];
  if (!c) return;
  staged.push(c);
  group.shift();
  void renderCard();
}

/** 🚫 跳过：从本组删除（可撤销），进下一张 */
async function doSkip(): Promise<void> {
  if (!appRef || busy) return;
  const c = group[0];
  if (!c) return;
  group.shift();
  skippedNames.push(c.name);
  undoStack.push(c);
  if (undoStack.length > 20) undoStack.shift();
  notice(`🚫 已跳过「${c.name}」（可撤销）`);
  void renderCard();
}

/**
 * ✨ 生成并导入本组：批量 AI 生成黑匣子概念卡（定义 + 关联，一次请求）→ 批量写入 →
 * 跨批补链 → 下一组。AI 失败单张降级（定义=原文，无关联），永不拒收。
 */
async function doGenerateImport(): Promise<void> {
  if (!appRef || busy) return;
  const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
  const cards = staged.slice();
  if (!cards.length) {
    if (!queue.length) {
      closeCardboxImport();
      return;
    }
    await loadNextGroup();
    return;
  }
  busy = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = `⏳ AI 生成中（${cards.length} 张）…`;
  }
  try {
    // 1) 批量 AI 生成：定义 + 关联（一次请求；失败整组降级不阻断）
    let existingNames: string[] = [];
    try {
      const m = new BlackBoxDataManager(appRef);
      const d = await m.load();
      existingNames = d.entries.filter((e) => e.type === 'concept').map((e) => e.name).filter((x): x is string => !!x);
    } catch (e) {
      /* 拿不到就空 */
    }
    try {
      const parsed = await new BlackBoxAI().cardBatch(cards, existingNames);
      cards.forEach((c, j) => {
        const hit = parsed.find((p) => p.i === j + 1);
        if (hit) {
          c.summary = hit.summary;
          c.aiRelated = hit.relatedNames;
          for (const n of hit.relatedNames) {
            if (!c.relatedNames.includes(n)) c.relatedNames.push(n);
          }
        }
      });
    } catch (e) {
      console.warn('本组 AI 生成失败（整组按原文导入）', e);
    }
    // 2) 批量写入（一次 load→push→save；关联双向回填 + pendingLinks 补链）
    if (btn) btn.textContent = `⏳ 导入中（${cards.length} 张）…`;
    const m = new BlackBoxDataManager(appRef);
    const data = await m.load();
    const r = await runImport(appRef, cards, data, skippedNames);
    await resolvePendingLinks(appRef);
    for (const c of cards) importedNames.add(c.name);
    notice(`✅ 已导入本组 ${r.imported} 张（累计 ${importedNames.size}）`);
  } catch (e) {
    console.warn('本组导入失败', e);
    notice('❌ 导入失败，请重试', 'error');
  } finally {
    busy = false;
    await loadNextGroup();
  }
}
