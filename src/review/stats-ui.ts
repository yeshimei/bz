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
import { escapeHtml, formatRelativeTime, stripTitleMarks } from '../core/utils';
import type { ReviewDataManager, ReviewItem } from './data';
import { computeStats, loadDistribution, historyOf, dateKey, RATING_NAMES, RATING_COLORS } from './stats';
import { FSRS, DEFAULT_W } from './fsrs';
import { uiIcon } from '../core/ui';

let statsMask: HTMLElement | null = null;
let statsPopup: HTMLElement | null = null;
let statsEsc: { unregister: () => void } | null = null;
let lastDm: ReviewDataManager | null = null;

// ======================= 浅色统计卡（对齐影视 PASTEL_CARDS） =======================
// issue 270：静态样式收编 src/review/styles.css（.bz-stats-*），仅数据驱动动态色保留内联
const PASTEL_CARDS = ['#D6E4FF', '#D8F3DC', '#CDF0EA', '#FADDE1', '#FFE5CC', '#E6DFF5'];

function statCardHTML(label: string, value: any, idx: number): string {
  const bg = PASTEL_CARDS[idx % PASTEL_CARDS.length];
  return `<div class="bz-stats-card" style="background:${bg};">
    <div class="bz-stats-card-val">${value}</div>
    <div class="bz-stats-card-lbl">${label}</div>
  </div>`;
}

/** 色条板块容器（对齐影视 sectionHTML） */
function sectionHTML(title: string, body: string, accent = '#D6E4FF'): string {
  return `<div class="bz-stats-section">
    <div class="bz-stats-section-head">
      <span class="bz-stats-section-accent" style="background:${accent};"></span>
      <span>${title}</span>
    </div>
    ${body}
  </div>`;
}

function emptyHTML(): string {
  return '<p class="bz-stats-empty">暂无数据</p>';
}

/** 软进度条（对齐影视 softBarHTML） */
function softBarHTML(entries: Array<{ label: string; value: number }>, color: string): string {
  if (!entries.length) return emptyHTML();
  const max = Math.max(...entries.map((e) => e.value), 1);
  return entries.map((e) => `
    <div class="bz-stats-bar-row">
      <span class="bz-stats-bar-lbl">${e.label}</span>
      <div class="bz-stats-bar-track">
        <div class="bz-stats-bar-fill" style="width:${Math.max((e.value / max) * 100, 2)}%;background:${color};"></div>
      </div>
      <span class="bz-stats-bar-val">${e.value}</span>
    </div>`).join('');
}

/** 竖柱状图（对齐影视 barChartHTML） */
function barChartHTML(entries: Array<{ label: string; value: number }>, color: string): string {
  if (!entries.length) return emptyHTML();
  const max = Math.max(...entries.map((e) => e.value), 1);
  const minH = 26, maxH = 92;
  return `
    <div class="bz-stats-chart-scroll">
      <div class="bz-stats-chart" style="min-width:${Math.max(entries.length * 34, 200)}px;">
      ${entries.map((e) => {
    const h = max > 0 ? minH + (e.value / max) * (maxH - minH) : minH;
    return `
        <div class="bz-stats-chart-col">
          <div class="bz-stats-chart-bar" style="height:${h}px;background:${color};">${e.value || ''}</div>
          <div class="bz-stats-chart-lbl">${e.label}</div>
        </div>`;
  }).join('')}
      </div>
    </div>`;
}

/** chips 行内小统计（对齐影视 statInlineHTML） */
function statInlineHTML(items: string[]): string {
  return `<div class="bz-stats-inline">${items.map((s) => `
    <span class="bz-stats-inline-chip">${s}</span>`).join('')}</div>`;
}

/** 排名列表行（对齐影视 topListHTML；点击行为由渲染方事件委托处理） */
function rankListHTML(items: Array<{ name: string; sub: string; meta: string }>): string {
  if (!items.length) return emptyHTML();
  const badges = ['#FFF3C4', '#D8F3DC', '#D6E4FF'];
  return items.map((it, i) => {
    const rank = i < 3
      ? `<span class="bz-stats-rank-badge" style="background:${badges[i]};">${i + 1}</span>`
      : `<span class="bz-stats-rank-plain">${i + 1}</span>`;
    return `<div class="bz-review-stats-tl-row" data-idx="${i}">
      ${rank}
      <span class="bz-stats-rank-name">${escapeHtml(it.name)}</span>
      ${it.sub ? `<span class="bz-stats-rank-sub">${it.sub}</span>` : ''}
      <span class="bz-stats-rank-meta">${it.meta}</span>
    </div>`;
  }).join('');
}

// ======================= 统计弹窗 =======================
/** 打开统计弹窗（全局视图）。R 口径与调度同源：读拟合权重 currentW()（item 12） */
export async function showStatsModal(app: App, dm: ReviewDataManager): Promise<void> {
  lastDm = dm;
  const items = await dm.loadItems();
  let w: number[] | undefined;
  try {
    w = (await import('./app')).reviewApp.currentW();
  } catch {
    w = undefined; // 取不到拟合权重 → computeStats 回退默认
  }
  renderStatsModal(app, dm, items, w);
}

/** 渲染统计弹窗（600px 窄卡，影视布局） */
function renderStatsModal(app: App, dm: ReviewDataManager, items: ReviewItem[], w?: number[]): void {
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
  `;
  statsPopup.appendChild(header);

  const body = document.createElement('div');
  body.id = 'review-stats-body';
  body.className = 'bz-review-stats-body';
  statsPopup.appendChild(body);

  document.body.appendChild(statsMask);
  document.body.appendChild(statsPopup);


  const stats = computeStats(items, { w });
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
      if (target) void showTimeline(app, dm, target);
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
    <div class="bz-stats-cards">
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
  const tmr = new Date();
  tmr.setDate(tmr.getDate() + 1);
  const todayKey = dateKey(new Date());
  const tmrKey = dateKey(tmr);
  const todayCnt = dist.find((d) => d.date === todayKey)?.count || 0;
  const tmrCnt = dist.find((d) => d.date === tmrKey)?.count || 0;
  const maxDist = Math.max(1, ...dist.map((d) => d.count));
  const distBars = dist.map((d) => ({
    label: d.date === todayKey ? '今' : `+${dist.indexOf(d)}`,
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
      name: stripTitleMarks(i.name),
      sub: `${cnt} 次`,
      meta: lastTs ? formatRelativeTime(new Date(lastTs)) : '',
    };
  });
  const timelineHTML = sectionHTML('复习时间线',
    rankListHTML(tlItems) + '<div class="bz-stats-hint">点击笔记查看复习历史</div>',
    '#FADDE1');

  // 最近 7 天
  const daily7 = stats.daily7.map((d) => ({ label: d.date.slice(5).replace('-', '/'), value: d.count }));
  const weekHTML = sectionHTML('最近 7 天复习量', barChartHTML(daily7, '#E6DFF5'), '#E6DFF5');

  return cards + ratingHTML + loadHTML + timelineHTML + weekHTML;
}

// ======================= 复习历史独立弹窗 =======================
let histMask: HTMLElement | null = null;
let histPopup: HTMLElement | null = null;
let histEsc: { unregister: () => void } | null = null;

/** 单条笔记复习历史（独立弹窗：无标题栏、无返回统计按钮、无 🔁 名称标题行；时间轴竖线式）。
 *  当前 R 展示与调度同口径：读拟合权重 currentW()（item 12；取不到回退默认） */
export async function showTimeline(app: App, dm: ReviewDataManager, item: ReviewItem): Promise<void> {
  closeTimeline();
  let w: number[] | undefined;
  try {
    w = (await import('./app')).reviewApp.currentW();
  } catch {
    w = undefined;
  }
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

  // 无标题栏：内容直接顶到卡片；关闭 = 点遮罩（issue 271 统一）
  // 当前状态（替代标题栏：笔记名 + 阶段/当前 R 小字，紧凑一行）
  const status = document.createElement('div');
  status.className = 'bz-review-history-status';
  const stageText = item.phase === 'fsrs'
    ? `FSRS Lv.${(item.stage || 0) - 9 + 1}`
    : `${(item.stage || 0) + 1}/10`;
  let curR: string | null = null;
  if (item.phase === 'fsrs' && item.stability && item.lastReviewed) {
    const t = (new Date().getTime() - new Date(item.lastReviewed).getTime()) / 86400000;
    if (t > 0) {
      // R 公式与调度同源 FSRS.R（权重=拟合 currentW 回退默认）
      const R = new FSRS(w || DEFAULT_W).R(t, item.stability);
      curR = ` · 当前 R ${Math.round(R * 100)}%`;
    }
  }
  status.innerHTML = `
    <div class="bz-review-history-name">${escapeHtml(stripTitleMarks(item.name))}</div>
    <div class="bz-review-history-sub">${stageText} · 共 ${history.length} 次复习${curR || ''}</div>
  `;
  body.appendChild(status);

  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'bz-review-history-empty';
    empty.textContent = '暂无复习记录';
    body.appendChild(empty);
    histEsc = escManager.register('review-history', { isVisible: () => !!histMask && histMask.style.display === 'block', close: closeTimeline });
    return;
  }

  // 时间轴竖线式（变体 D）：圆点 + 竖线连接 + 时间/评级/元数据（issue 270：静态样式收编
  // src/review/styles.css .bz-review-history-*，圆点/评级字色为 RATING_COLORS 动态内联）
  const tl = document.createElement('div');
  tl.className = 'bz-review-history-tl';
  const itemsHTML = history.map((h, i) => {
    const isLast = i === history.length - 1;
    const ratingName = RATING_NAMES[h.rating] || h.rating;
    const color = RATING_COLORS[h.rating] || '#888';
    // app.ts 落盘 R 已是 0-100（Math.round(R*100)），直接取整展示；
    // 老数据若存过 0-1 小数 → <=1 分支兼容放大
    const rText = h.R !== undefined ? `R=${h.R <= 1 ? Math.round(h.R * 100) : Math.round(h.R)}%` : '';
    const sText = h.stability !== undefined ? `S=${h.stability}` : '';
    const meta = [rText, sText].filter(Boolean).join(' · ');
    const line = isLast ? '' : '<div class="bz-review-history-line"></div>';
    return `
      <div class="bz-review-history-item${isLast ? ' is-last' : ''}">
        ${line}
        <div class="bz-review-history-dot" style="background:${color};"></div>
        <div class="bz-review-history-row">
          <span class="bz-review-history-time">${formatRelativeTime(new Date(h.timestamp))}</span>
          <span class="bz-review-history-rating" style="color:${color};">${ratingName}</span>
          <span class="bz-review-history-stage">阶段${h.stage}${meta ? ' · ' + meta : ''}</span>
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
