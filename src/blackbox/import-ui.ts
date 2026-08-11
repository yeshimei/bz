/**
 * 卡片盒导入预览确认弹窗（一次性工具）：bz-blackbox-import-cardbox「导入卡片盒」。
 * 逐批处理：扫描「卡片盒/*.md」一次（本地 IO 秒级）→ 规则预筛（空卡/敏感/残渣自动跳过）→
 * 每次只分类并展示一批（20 张，AI 请求不积压）→ 用户确认本批（行内 🚫跳过 / ✨AI 总结勾选）→
 * 「导入本批 N 张」→ 写入 + 日志 → 自动加载下一批；直到全部处理完毕。
 * 跳过/导入只作用于卡片盒导入流程，黑匣子正常录入不受影响。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { createOverlay } from '../core/dom';
import { notice } from '../core/notice';
import { BlackBoxAI } from './ai';
import { BlackBoxDataManager } from './data';
import {
  CLASSIFY_BATCH,
  scanCardboxAsync,
  prefilterCard,
  classifyCards,
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
/** 当前展示批次（已分类，待用户确认） */
let batch: ClassifiedCard[] = [];
/** 本批中用户标记跳过的卡（导入时持久化，永不录入） */
let skippedNames: string[] = [];
/** 已导入卡片名（本次会话去重展示） */
let importedNames = new Set<string>();
/** 规则预筛跳过（一次性展示在统计里） */
let ruleSkippedCount = 0;
let busy = false;

/** 打开导入面板（幂等：已开先关；异步：扫描→预筛→第一批分类→渲染） */
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

  // 骨架：标题行 + 统计 + 列表 + 底部导入按钮
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

  const list = document.createElement('div');
  list.id = 'bz-blackbox-import-list';
  list.className = 'bz-blackbox-import-list';
  popup.appendChild(list);

  const foot = document.createElement('div');
  foot.className = 'bz-blackbox-import-foot';
  const skipBox = document.createElement('div');
  skipBox.id = 'bz-blackbox-import-skipped';
  skipBox.className = 'bz-blackbox-import-skipped';
  foot.appendChild(skipBox);
  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.id = 'bz-blackbox-import-run';
  importBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary bz-blackbox-guide-main';
  importBtn.textContent = '⏳ 扫描中…';
  importBtn.disabled = true;
  importBtn.addEventListener('click', () => void doImport());
  foot.appendChild(importBtn);
  popup.appendChild(foot);

  escHandle = escManager.register('blackbox-import', { isVisible: () => !!maskEl, close: () => closeCardboxImport() });

  // 异步准备：扫描 → 预筛 → 分类第一批
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
  batch = [];
  skippedNames = [];
  importedNames = new Set();
  ruleSkippedCount = 0;
  busy = false;
}

/** 扫描 + 预筛 + 分类第一批（扫描本地 IO 秒级；AI 只在需要时逐批请求） */
async function prepare(): Promise<void> {
  if (!appRef) return;
  const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
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
    const total = queue.length;
    updateStats();
    await loadNextBatch();
  } catch (e) {
    console.warn('卡片盒扫描失败', e);
    notice('❌ 扫描失败：无法读取卡片盒', 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '关闭';
      btn.onclick = () => closeCardboxImport();
    }
  }
}

/** 从队列取一批 → AI 分类（失败整批降级 concept，永不拒收）→ 渲染 */
async function loadNextBatch(): Promise<void> {
  const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
  if (!queue.length) {
    renderList();
    renderSkipped();
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = `⏳ 分类本批…`;
  }
  const batchCards = queue.splice(0, CLASSIFY_BATCH);
  const classified = await classifyCards(new BlackBoxAI(), batchCards);
  batch.push(...classified);
  renderList();
  renderSkipped();
}

/** 渲染当前批（每行：名/类型/内容预览/AI 总结开关/跳过） */
function renderList(): void {
  const list = document.getElementById('bz-blackbox-import-list');
  if (!list) return;
  list.innerHTML = '';
  if (!batch.length && !queue.length) {
    const empty = document.createElement('div');
    empty.className = 'bz-blackbox-empty';
    empty.innerHTML =
      '<div class="bz-blackbox-empty-title">🎉 全部处理完毕</div>' +
      '<div class="bz-blackbox-empty-desc">卡片盒已全部导入或跳过，可关闭弹窗</div>';
    list.appendChild(empty);
  }
  for (const c of batch) {
    const row = document.createElement('div');
    row.className = 'bz-blackbox-import-row';
    row.dataset.name = c.name;

    const main = document.createElement('div');
    main.className = 'bz-blackbox-import-row-main';
    const nameLine = document.createElement('div');
    nameLine.className = 'bz-blackbox-import-row-name';
    const kindTag = document.createElement('span');
    kindTag.className = 'bz-blackbox-import-kind';
    kindTag.textContent = c.kind === 'literature' ? '文献' : '概念';
    nameLine.appendChild(kindTag);
    nameLine.appendChild(document.createTextNode(c.name));
    if (c.category) {
      const cat = document.createElement('span');
      cat.className = 'bz-blackbox-import-cat';
      cat.textContent = c.category;
      nameLine.appendChild(cat);
    }
    main.appendChild(nameLine);
    // 内容预览（让用户确认原卡内容）
    const preview = document.createElement('div');
    preview.className = 'bz-blackbox-import-preview';
    preview.textContent = clip(c.text, 90) || '（无正文）';
    preview.title = c.text;
    main.appendChild(preview);
    if (c.desc) {
      const desc = document.createElement('div');
      desc.className = 'bz-blackbox-import-desc';
      desc.textContent = `📝 ${clip(c.desc, 50)}`;
      main.appendChild(desc);
    }
    row.appendChild(main);

    // AI 总结开关（默认关：优先用原卡内容；勾选后 AI 生成一句话总结）
    const aiBtn = document.createElement('button');
    aiBtn.type = 'button';
    aiBtn.className = 'bz-blackbox-import-ai' + (c.aiSummary ? ' on' : '');
    aiBtn.textContent = c.aiSummary ? '✨ AI 总结 ✓' : '✨ AI 总结';
    aiBtn.title = '勾选后由 AI 生成一句话总结（不勾选用原卡自带描述）';
    aiBtn.addEventListener('click', () => {
      c.aiSummary = !c.aiSummary;
      aiBtn.classList.toggle('on', c.aiSummary);
      aiBtn.textContent = c.aiSummary ? '✨ AI 总结 ✓' : '✨ AI 总结';
    });
    row.appendChild(aiBtn);

    // 跳过（持久化，永不录入；可恢复）
    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'bz-blackbox-import-skip';
    skipBtn.textContent = '🚫 跳过';
    skipBtn.title = '这张卡永不导入（记录后重跑不再出现）';
    skipBtn.addEventListener('click', () => {
      batch = batch.filter((x) => x.name !== c.name);
      skippedNames.push(c.name);
      restoredCache.set(c.name, { ...c });
      renderList();
      renderSkipped();
      notice(`🚫 已跳过「${c.name}」`);
    });
    row.appendChild(skipBtn);

    list.appendChild(row);
  }
  updateStats();
  const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = false;
    if (!batch.length && !queue.length) {
      btn.textContent = '✅ 完成';
      btn.onclick = () => closeCardboxImport();
    } else {
      btn.textContent = `导入本批 ${batch.length} 张`;
    }
  }
}

/** 已跳过区（可恢复；恢复的卡回到当前批） */
function renderSkipped(): void {
  const box = document.getElementById('bz-blackbox-import-skipped');
  if (!box) return;
  box.innerHTML = '';
  if (!skippedNames.length) return;
  const label = document.createElement('span');
  label.className = 'bz-blackbox-import-skipped-label';
  label.textContent = `🚫 本批跳过 ${skippedNames.length} 张（导入后记录，永不录入）：`;
  box.appendChild(label);
  for (const n of skippedNames) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'bz-blackbox-import-restore';
    chip.textContent = `${n} ↩`;
    chip.title = '恢复导入';
    chip.addEventListener('click', () => {
      skippedNames = skippedNames.filter((x) => x !== n);
      const orig = restoredCache.get(n);
      if (orig) {
        batch.push(orig);
      }
      restoredCache.delete(n);
      renderList();
      renderSkipped();
    });
    box.appendChild(chip);
  }
}

/** 恢复缓存：跳过时暂存原卡片对象（恢复用） */
const restoredCache = new Map<string, ClassifiedCard>();

function updateStats(): void {
  const stats = document.getElementById('bz-blackbox-import-stats');
  if (!stats) return;
  stats.textContent = `本批 ${batch.length} · 待处理 ${queue.length + batch.length} · 已导入 ${importedNames.size} · 已跳过 ${skippedNames.length}`;
  const _ = ruleSkippedCount;
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/** 执行导入本批：AI 总结（勾选的行）→ 批量写入 → 日志（含跳过）→ 自动加载下一批 */
async function doImport(): Promise<void> {
  if (!appRef || busy) return;
  const selected = batch.slice();
  if (!selected.length) {
    notice('ℹ️ 本批没有卡片');
    return;
  }
  busy = true;
  const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  try {
    // 1) 对勾选 AI 总结的卡生成（失败行留空不阻断）
    const needAi = selected.filter((c) => c.aiSummary);
    if (needAi.length) {
      if (btn) btn.textContent = `⏳ 生成总结中（${needAi.length} 张）…`;
      await generateSummaries(new BlackBoxAI(), needAi);
    }
    // 2) 写前重载 → 批量写入 + 日志（本批跳过的卡一并记录）
    if (btn) btn.textContent = '⏳ 导入中…';
    const m = new BlackBoxDataManager(appRef);
    const data = await m.load();
    const r = await runImport(appRef, selected, data, skippedNames);
    notice(`✅ 已导入本批 ${r.imported} 张（剩余 ${queue.length}）`);
    for (const c of selected) importedNames.add(c.name);
    batch = [];
    skippedNames = [];
    restoredCache.clear();
    await loadNextBatch();
  } catch (e) {
    console.warn('卡片盒导入失败', e);
    notice('❌ 导入失败，请重试', 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = `导入本批 ${batch.length} 张`;
    }
  } finally {
    busy = false;
  }
}
