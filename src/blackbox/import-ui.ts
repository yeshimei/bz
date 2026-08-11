/**
 * 卡片盒导入预览确认弹窗（一次性工具）：bz-blackbox-import-cardbox「导入卡片盒」。
 * 流程：扫描「卡片盒/*.md」→ 规则预筛（空卡/敏感/残渣自动跳过）→ AI 批量分类（概念/文献）→
 * 预览列表逐行确认：✓ 默认全部导入；[✨ AI 总结] 勾选后导入前 AI 生成一句话总结；
 * [🚫 跳过] 移入已跳过区（持久化，重跑不再出现，可恢复）；底部「导入 N 张」→ 批量写入 + 日志。
 * 跳过/导入只作用于卡片盒导入流程，黑匣子正常录入不受任何影响。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { createOverlay } from '../core/dom';
import { notice } from '../core/notice';
import { BlackBoxAI } from './ai';
import { BlackBoxDataManager } from './data';
import {
  scanCardboxAsync,
  prefilterCard,
  classifyCards,
  generateSummaries,
  readImportLog,
  runImport,
} from './import-cardbox';
import type { ClassifiedCard } from './import-cardbox';

let appRef: App | null = null;
let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;

/** 待导入列表（预览确认用，含用户标记） */
let pending: ClassifiedCard[] = [];
/** 用户标记跳过的卡（导入时持久化） */
let skippedNames: string[] = [];
/** 已导入 / 已跳过历史（本次会话去重展示） */
let importedNames = new Set<string>();

/** 打开导入面板（幂等：已开先关；异步：扫描→预筛→AI 分类→渲染） */
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
  const popupEl_ = popup;
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
  closeBtn.title = '关闭';
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
  importBtn.addEventListener('click', () => void doImport(importBtn));
  foot.appendChild(importBtn);
  popup.appendChild(foot);

  escHandle = escManager.register('blackbox-import', { isVisible: () => !!maskEl, close: () => closeCardboxImport() });

  // 异步准备：扫描 → 预筛 → AI 分类
  void prepare(importBtn);
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
  pending = [];
  skippedNames = [];
  importedNames = new Set();
}

/** 扫描 + 预筛 + AI 分类（失败降级：分类失败按 concept 入列，永不拒收） */
async function prepare(importBtn: HTMLButtonElement): Promise<void> {
  if (!appRef) return;
  try {
    const cards = await scanCardboxAsync(appRef);
    const log = await readImportLog(appRef);
    importedNames = log.imported;
    const ruleSkipped: string[] = [];
    const candidates: ClassifiedCard[] = [];
    for (const c of cards) {
      if (log.imported.has(c.name) || log.skipped.has(c.name)) continue; // 已处理过的不再出现
      const pf = prefilterCard(c);
      if (pf) {
        ruleSkipped.push(`${c.name}（${pf.reason}）`);
        continue;
      }
      candidates.push({ ...c, kind: 'concept', reason: '', relatedNames: [], aiSummary: false, summary: '' });
    }
    const ai = new BlackBoxAI();
    pending = await classifyCards(ai, candidates);
    renderList(importBtn, ruleSkipped);
    renderSkipped();
  } catch (e) {
    console.warn('卡片盒扫描失败', e);
    notice('❌ 扫描失败：无法读取卡片盒', 'error');
    importBtn.disabled = false;
    importBtn.textContent = '关闭';
    importBtn.addEventListener('click', () => closeCardboxImport());
  }
}

/** 渲染列表（每行：名/类型/内容预览/AI 总结开关/跳过） */
function renderList(importBtn: HTMLButtonElement | undefined, ruleSkipped: string[]): void {
  const list = document.getElementById('bz-blackbox-import-list');
  if (!list) return;
  list.innerHTML = '';
  if (!pending.length) {
    const empty = document.createElement('div');
    empty.className = 'bz-blackbox-empty';
    empty.innerHTML =
      '<div class="bz-blackbox-empty-title">没有可导入的卡片</div>' +
      '<div class="bz-blackbox-empty-desc">全部卡片已处理完毕（已导入 / 已跳过）</div>';
    list.appendChild(empty);
  }
  for (const c of pending) {
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

    // 跳过（持久化，重跑不再出现；可恢复）
    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'bz-blackbox-import-skip';
    skipBtn.textContent = '🚫 跳过';
    skipBtn.title = '这张卡永不导入（导入时记录，重跑不再出现）';
    skipBtn.addEventListener('click', () => {
      pending = pending.filter((x) => x.name !== c.name);
      skippedNames.push(c.name);
      restoredCache.set(c.name, { ...c }); // 恢复用暂存
      renderList(importBtn, ruleSkipped);
      renderSkipped();
      notice(`🚫 已跳过「${c.name}」`);
    });
    row.appendChild(skipBtn);

    list.appendChild(row);
  }
  updateStats();
  if (importBtn) {
    importBtn.disabled = false;
    importBtn.textContent = `导入 ${pending.length} 张`;
  }
}

/** 已跳过区（可恢复） */
function renderSkipped(): void {
  const box = document.getElementById('bz-blackbox-import-skipped');
  if (!box) return;
  box.innerHTML = '';
  if (!skippedNames.length) return;
  const label = document.createElement('span');
  label.className = 'bz-blackbox-import-skipped-label';
  label.textContent = `🚫 本次跳过 ${skippedNames.length} 张（导入时记录，不再出现）：`;
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
        pending.push(orig);
        pending.sort((a, b) => (a.name < b.name ? -1 : 1));
      }
      restoredCache.delete(n);
      const btn = document.getElementById('bz-blackbox-import-run') as HTMLButtonElement | null;
      renderList(btn ?? undefined, []);
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
  stats.textContent = `待确认 ${pending.length} · 已导入 ${importedNames.size} · 已跳过 ${skippedNames.length}`;
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/** 执行导入：AI 总结（勾选的行）→ 批量写入 → 日志（含跳过）→ 刷新 */
async function doImport(importBtn: HTMLButtonElement): Promise<void> {
  if (!appRef) return;
  const selected = pending.slice();
  if (!selected.length) {
    notice('ℹ️ 没有待导入的卡片');
    return;
  }
  importBtn.disabled = true;
  // 1) 对勾选 AI 总结的卡批量生成（分批，失败行留空不阻断）
  const needAi = selected.filter((c) => c.aiSummary);
  if (needAi.length) {
    importBtn.textContent = `⏳ 生成总结中（${needAi.length} 张）…`;
    await generateSummaries(new BlackBoxAI(), needAi);
  }
  // 2) 写前重载 → 批量写入 + 日志
  importBtn.textContent = `⏳ 导入中…`;
  try {
    const m = new BlackBoxDataManager(appRef);
    const data = await m.load();
    const r = await runImport(appRef, selected, data, skippedNames);
    notice(`✅ 已导入 ${r.imported} 张卡片`);
    for (const c of selected) importedNames.add(c.name);
    pending = pending.filter((c) => !selected.some((s) => s.name === c.name));
    skippedNames = [];
    restoredCache.clear();
    renderList(importBtn, []);
    renderSkipped();
    if (!pending.length) {
      notice('🎉 卡片盒导入完成');
    }
  } catch (e) {
    console.warn('卡片盒导入失败', e);
    notice('❌ 导入失败，请重试', 'error');
    importBtn.disabled = false;
    importBtn.textContent = `导入 ${pending.length} 张`;
  }
}
