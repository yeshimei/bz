/**
 * 复习统计弹窗 + 复习历史弹窗（ADR-0077，ticket 174 修订版）
 *
 * 用户拍板（2026-09-01）：
 *  - 统计界面参考影视统计布局：600px 窄卡、浅色统计卡 + 色条板块容器
 *  - 复习历史：独立弹窗，无标题栏、无「返回统计」按钮、无 🔁 名称标题行
 *  - 统计页「复习时间线」点文件 → 弹独立复习历史界面
 *  - 日期统一用 bz 相对日期函数 formatRelativeTime
 *
 * 签名保持：showStatsModal(app, dm) / showTimeline(app, dm, item) / closeStatsModal()（测试依赖）
 */

import { type App } from 'obsidian';
import { topifyZ, allocZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { escapeHtml, formatRelativeTime } from '../core/utils';
import type { ReviewDataManager, ReviewItem } from './data';
import { computeStats, loadDistribution, historyOf, RATING_NAMES, RATING_COLORS } from './stats';

let statsMask: HTMLElement | null = null;
let statsPopup: HTMLElement | null = null;
let statsEsc: { unregister: () => void } | null = null;
let lastDm: ReviewDataManager | null = null;

// ======================= 浅色统计卡（对齐影视 PASTEL_CARDS） =======================
const PASTEL_CARDS = ['#D6E4FF', '#D8F3DC', '#CDF0EA', '#FADDE1', '#FFE5CC', '#E6DFF5'];

function statCardHTML(label: string, value: any, idx: number): string {
  const bg = PASTEL_CARDS[idx % PASTEL_CARDS.length];
  return `<div style="flex:1;min-width:80px;padding:12px 6px;background:${bg};border-radius:10px;text-align:center;border:1px solid rgba(0,0,0,0.06);">
    <div style="font-size:1.3rem;font-weight:700;color:#3D4456;line-height:1.2;">${value}</div>
    <div style="font-size:.68rem;color:rgba(61,68,86,0.65);margin-top:3px;">${label}</div>
  </div>`;
}

/** 色条板块容器（对齐影视 sectionHTML） */
function sectionHTML(title: string, body: string, accent = '#D6E4FF'): string {
  return `<div style="margin:12px 16px;padding:14px 14px 12px;background:var(--background-secondary);border-radius:12px;border:1px solid var(--background-modifier-border);">
    <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:.92rem;margin-bottom:12px;">
      <span style="width:4px;height:14px;border-radius:2px;background:${accent};flex-shrink:0;"></span>
      <span>${title}</span>
    </div>
    ${body}
  </div>`;
}

function emptyHTML(): string {
  return '<p style="text-align:center;color:var(--text-muted);font-size:.8rem;padding:12px 0;">暂无数据</p>';
}

/** 软进度条（对齐影视 softBarHTML） */
function softBarHTML(entries: Array<{ label: string; value: number }>, color: string): string {
  if (!entries.length) return emptyHTML();
  const max = Math.max(...entries.map((e) => e.value), 1);
  return entries.map((e) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
      <span style="width:56px;flex-shrink:0;font-size:.76rem;color:var(--text-muted);text-align:right;white-space:nowrap;">${e.label}</span>
      <div style="flex:1;height:10px;background:var(--background-modifier-border);border-radius:5px;overflow:hidden;">
        <div style="height:100%;width:${Math.max((e.value / max) * 100, 2)}%;background:${color};border-radius:5px;"></div>
      </div>
      <span style="width:30px;flex-shrink:0;font-size:.76rem;color:var(--text-normal);text-align:right;">${e.value}</span>
    </div>`).join('');
}

/** 竖柱状图（对齐影视 barChartHTML） */
function barChartHTML(entries: Array<{ label: string; value: number }>, color: string): string {
  if (!entries.length) return emptyHTML();
  const max = Math.max(...entries.map((e) => e.value), 1);
  const minH = 26, maxH = 92;
  return `
    <div style="overflow-x:auto;margin:8px 0 4px;">
      <div style="display:flex;align-items:flex-end;gap:6px;min-width:${Math.max(entries.length * 34, 200)}px;padding:0 4px;">
      ${entries.map((e) => {
    const h = max > 0 ? minH + (e.value / max) * (maxH - minH) : minH;
    return `
        <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
          <div style="width:100%;min-width:22px;height:${h}px;background:${color};border-radius:6px 6px 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:3px;color:#3D4456;font-weight:700;font-size:.7rem;">${e.value || ''}</div>
          <div style="margin-top:5px;font-size:.66rem;color:var(--text-muted);text-align:center;white-space:nowrap;">${e.label}</div>
        </div>`;
  }).join('')}
      </div>
    </div>`;
}

/** chips 行内小统计（对齐影视 statInlineHTML） */
function statInlineHTML(items: string[]): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">${items.map((s) => `
    <span style="font-size:.74rem;color:var(--text-muted);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;padding:3px 10px;">${s}</span>`).join('')}</div>`;
}

/** 排名列表行（对齐影视 topListHTML；点击 → 独立复习历史弹窗） */
function rankListHTML(items: Array<{ name: string; sub: string; meta: string }>, onClick: (i: number) => void): string {
  if (!items.length) return emptyHTML();
  const badges = ['#FFF3C4', '#D8F3DC', '#D6E4FF'];
  return items.map((it, i) => {
    const rank = i < 3
      ? `<span style="width:20px;height:20px;flex-shrink:0;border-radius:50%;background:${badges[i]};color:#3D4456;font-size:.68rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,0.06);">${i + 1}</span>`
      : `<span style="width:20px;flex-shrink:0;font-size:.72rem;color:var(--text-muted);text-align:center;">${i + 1}</span>`;
    return `<div class="bz-review-stats-tl-row" data-idx="${i}" style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid var(--background-modifier-border);cursor:pointer;">
      ${rank}
      <span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(it.name)}</span>
      ${it.sub ? `<span style="font-size:.7rem;color:var(--text-muted);flex-shrink:0;">${it.sub}</span>` : ''}
      <span style="font-size:.72rem;color:var(--text-muted);flex-shrink:0;">${it.meta}</span>
    </div>`;
  }).join('');
}

// ======================= 统计弹窗 =======================
/** 打开统计弹窗（全局视图） */
export async function showStatsModal(app: App, dm: ReviewDataManager): Promise<void> {
  lastDm = dm;
  const items = await dm.loadItems();
  renderStatsModal(app, dm, items);
}

/** 渲染统计弹窗（600px 窄卡，影视布局） */
function renderStatsModal(app: App, dm: ReviewDataManager, items: ReviewItem[]): void {
  closeStatsModal();
  statsMask = document.createElement('div');
  statsMask.id = 'review-stats-mask';
  statsMask.style.display = 'block';
  statsMask.style.zIndex = String(allocZ());
  statsMask.onclick = closeStatsModal;

  statsPopup = document.createElement('div');
  statsPopup.id = 'review-stats-popup';
  statsPopup.style.display = 'flex';
  statsPopup.style.zIndex = String(allocZ());
  topifyZ(statsMask, statsPopup);

  const header = document.createElement('div');
  header.className = 'bz-win-head bz-review-stats-head';
  header.innerHTML = `
    <h3 class="bz-review-title">复习统计</h3>
    <div><button id="review-stats-close" class="bz-win-close" title="关闭">❌</button></div>
  `;
  statsPopup.appendChild(header);

  const body = document.createElement('div');
  body.id = 'review-stats-body';
  body.className = 'bz-review-stats-body';
  statsPopup.appendChild(body);

  document.body.appendChild(statsMask);
  document.body.appendChild(statsPopup);

  header.querySelector('#review-stats-close')!.addEventListener('click', closeStatsModal);

  const stats = computeStats(items);
  body.innerHTML = buildStatsHTML(app, dm, items, stats);

  // 时间线列表行 → 独立复习历史弹窗
  body.querySelectorAll('.bz-review-stats-tl-row').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = Number((el as HTMLElement).dataset.idx);
      const target = items.filter((i) => (i.reviewHistory || []).length)
        .sort((a, b) => {
          const la = a.reviewHistory?.[a.reviewHistory.length - 1]?.timestamp || '';
          const lb = b.reviewHistory?.[b.reviewHistory.length - 1]?.timestamp || '';
          return lb.localeCompare(la);
        })[idx];
      if (target) showTimeline(app, dm, target);
    });
  });

  statsEsc = escManager.register('review-stats', {
    isVisible: () => !!statsMask && statsMask.style.display === 'block',
    close: closeStatsModal,
  });
}

/** 构建统计弹窗 HTML（影视布局：浅色卡 + 色条板块） */
function buildStatsHTML(app: App, dm: ReviewDataManager, items: ReviewItem[], stats: ReturnType<typeof computeStats>): string {
  // 浅色统计卡（6 个）
  const cards = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;padding:16px 16px 0;">
      ${statCardHTML('总复习（天）', stats.totalReviews, 0)}
      ${statCardHTML('连续天数', stats.streak, 1)}
      ${statCardHTML('今日复习', stats.todayReviews, 2)}
      ${statCardHTML('逾期率', Math.round(stats.overdueRate * 100) + '%', 3)}
      ${statCardHTML('平均 R', stats.avgR === null ? '-' : Math.round(stats.avgR * 100) + '%', 4)}
      ${statCardHTML('复习笔记', stats.reviewedNotes, 5)}
    </div>`;

  // 评级分布（软进度条，窄卡更紧凑）
  const total = Object.values(stats.ratingDist).reduce((a, b) => a + b, 0) || 1;
  const ratingBars = (['again', 'hard', 'good', 'easy'] as const).map((r) => ({
    label: RATING_NAMES[r],
    value: stats.ratingDist[r] || 0,
  }));
  const ratingHTML = sectionHTML('评级分布',
    softBarHTML(ratingBars, '#D6E4FF') +
    statInlineHTML([`共 ${total} 次评级`]),
    '#FFE5CC');

  // 复习负载：今日/明日 + 未来 14 天分布 + 日历热力图
  const dist = loadDistribution(items, 14);
  const todayKey = new Date();
  const tmrKey = new Date(); tmrKey.setDate(tmrKey.getDate() + 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayCnt = dist.find((d) => d.date === fmt(todayKey))?.count || 0;
  const tmrCnt = dist.find((d) => d.date === fmt(tmrKey))?.count || 0;
  const maxDist = Math.max(1, ...dist.map((d) => d.count));
  const distBars = dist.map((d) => ({
    label: d.date === fmt(todayKey) ? '今' : `+${dist.indexOf(d)}`,
    value: d.count,
  }));
  const loadHTML = sectionHTML('复习负载',
    statInlineHTML([`今日 ${todayCnt} 篇`, `明日 ${tmrCnt} 篇`, `峰值 ${maxDist} 篇/天`]) +
    barChartHTML(distBars, '#D6E4FF'),
    '#D6E4FF');

  // 复习时间线（点文件 → 独立复习历史弹窗）
  const withHistory = items
    .filter((i) => (i.reviewHistory || []).length)
    .sort((a, b) => {
      const la = a.reviewHistory?.[a.reviewHistory.length - 1]?.timestamp || '';
      const lb = b.reviewHistory?.[b.reviewHistory.length - 1]?.timestamp || '';
      return lb.localeCompare(la);
    });
  const tlItems = withHistory.slice(0, 10).map((i) => {
    const h = i.reviewHistory || [];
    const lastTs = h[h.length - 1]?.timestamp;
    const cnt = h.length;
    return {
      name: i.name.replace(/^《|》$/g, ''),
      sub: `${cnt} 次`,
      meta: lastTs ? formatRelativeTime(new Date(lastTs)) : '',
    };
  });
  const timelineHTML = sectionHTML('复习时间线',
    rankListHTML(tlItems, () => {}) + '<div style="font-size:.68rem;color:var(--text-faint);text-align:center;padding-top:8px;">点击笔记查看复习历史</div>',
    '#FADDE1');

  // 最近 7 天
  const daily7 = stats.daily7.map((d) => ({ label: d.date.slice(5).replace('-', '/'), value: d.count }));
  const weekHTML = sectionHTML('最近 7 天复习量', barChartHTML(daily7, '#E6DFF5'), '#E6DFF5');

  return cards + ratingHTML + loadHTML + timelineHTML + weekHTML +
    '<p style="text-align:center;font-size:.68rem;color:var(--text-muted);margin:16px;">浅色卡 + 色条板块，对齐影视统计界面</p>';
}

// ======================= 复习历史独立弹窗 =======================
let histMask: HTMLElement | null = null;
let histPopup: HTMLElement | null = null;
let histEsc: { unregister: () => void } | null = null;

/** 单条笔记复习历史（独立弹窗：无标题栏、无返回统计按钮、无 🔁 名称标题行；时间轴竖线式） */
export function showTimeline(app: App, dm: ReviewDataManager, item: ReviewItem): void {
  closeTimeline();
  const history = historyOf(item);

  histMask = document.createElement('div');
  histMask.id = 'review-history-mask';
  histMask.style.display = 'block';
  histMask.style.zIndex = String(allocZ());
  histMask.onclick = closeTimeline;

  histPopup = document.createElement('div');
  histPopup.id = 'review-history-popup';
  histPopup.style.display = 'flex';
  histPopup.style.zIndex = String(allocZ());
  topifyZ(histMask, histPopup);

  const body = document.createElement('div');
  body.id = 'review-history-body';
  body.className = 'bz-review-history-body';
  histPopup.appendChild(body);

  document.body.appendChild(histMask);
  document.body.appendChild(histPopup);

  // 无标题栏：内容直接顶到卡片；仅右上角 ❌（无 bz-win-head，无返回按钮）
  const closeBtn = document.createElement('button');
  closeBtn.id = 'review-history-close';
  closeBtn.className = 'bz-win-close bz-review-history-close';
  closeBtn.title = '关闭';
  closeBtn.textContent = '❌';
  closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;z-index:2;background:none;border:none;font-size:.55rem;cursor:pointer;color:var(--text-muted);padding:4px;box-shadow:none !important;';
  closeBtn.addEventListener('click', closeTimeline);
  histPopup.appendChild(closeBtn);

  // 当前状态（替代标题栏：笔记名 + 阶段/当前 R 小字，紧凑一行）
  const status = document.createElement('div');
  status.className = 'bz-review-history-status';
  status.style.cssText = 'padding:16px 18px 10px;';
  const stageText = item.phase === 'fsrs'
    ? `FSRS Lv.${(item.stage || 0) - 9 + 1}`
    : `${(item.stage || 0) + 1}/10`;
  let curR: string | null = null;
  if (item.phase === 'fsrs' && item.stability && item.lastReviewed) {
    const t = (new Date().getTime() - new Date(item.lastReviewed).getTime()) / 86400000;
    if (t > 0) {
      // R 公式同 fsrs.ts（d=0.9 默认口径；统计展示用）
      const R = Math.pow(1 + t / (item.stability * 0.9), -0.9);
      curR = ` · 当前 R ${Math.round(R * 100)}%`;
    }
  }
  status.innerHTML = `
    <div style="font-size:15px;font-weight:600;color:var(--text-normal);">${escapeHtml(item.name.replace(/^《|》$/g, ''))}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${stageText} · 共 ${history.length} 次复习${curR || ''}</div>
  `;
  body.appendChild(status);

  if (!history.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:30px;text-align:center;color:var(--text-faint);font-size:13px;';
    empty.textContent = '暂无复习记录';
    body.appendChild(empty);
    histEsc = escManager.register('review-history', { isVisible: () => !!histMask && histMask.style.display === 'block', close: closeTimeline });
    return;
  }

  // 时间轴竖线式（变体 D）：圆点 + 竖线连接 + 时间/评级/元数据
  const tl = document.createElement('div');
  tl.className = 'bz-review-history-tl';
  tl.style.cssText = 'flex:1;overflow-y:auto;padding:4px 18px 20px;';
  const itemsHTML = history.map((h, i) => {
    const isLast = i === history.length - 1;
    const ratingName = RATING_NAMES[h.rating] || h.rating;
    const color = RATING_COLORS[h.rating] || '#888';
    const rText = h.R !== undefined ? `R=${Math.round(h.R * 100)}%` : '';
    const sText = h.stability !== undefined ? `S=${h.stability}` : '';
    const meta = [rText, sText].filter(Boolean).join(' · ');
    const line = isLast ? '' : '<div style="position:absolute;left:5px;top:14px;bottom:-4px;width:2px;background:var(--background-modifier-border);"></div>';
    return `
      <div style="position:relative;padding-left:20px;padding-bottom:${isLast ? '4px' : '14px'};">
        ${line}
        <div style="position:absolute;left:0;top:4px;width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0;"></div>
        <div style="display:flex;align-items:baseline;gap:10px;font-size:13px;">
          <span style="color:var(--text-muted);font-size:12px;min-width:86px;flex-shrink:0;">${formatRelativeTime(new Date(h.timestamp))}</span>
          <span style="font-weight:500;color:${color};min-width:32px;">${ratingName}</span>
          <span style="color:var(--text-faint);font-size:12px;">阶段${h.stage}${meta ? ' · ' + meta : ''}</span>
        </div>
      </div>`;
  }).join('');
  tl.innerHTML = itemsHTML;
  body.appendChild(tl);

  histEsc = escManager.register('review-history', {
    isVisible: () => !!histMask && histMask.style.display === 'block',
    close: closeTimeline,
  });
}

/** 关闭复习历史弹窗 */
export function closeTimeline(): void {
  histEsc?.unregister();
  histEsc = null;
  if (histMask) histMask.remove();
  if (histPopup) histPopup.remove();
  histMask = null;
  histPopup = null;
}

export function closeStatsModal(): void {
  statsEsc?.unregister();
  statsEsc = null;
  if (statsMask) statsMask.remove();
  if (statsPopup) statsPopup.remove();
  statsMask = null;
  statsPopup = null;
  closeTimeline();
}
