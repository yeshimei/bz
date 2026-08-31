/**
 * 复习统计弹窗（ADR-0077，ticket 174）
 *
 * 面板头部「📊 统计」按钮 → 独立弹窗：
 *  - 全局指标：总复习次数 / streak / 今日 / 评级分布 / 逾期率 / 平均 R / 复习笔记数
 *  - 负载视图：今日/明日预告 + 未来 N 天分布 + 日历热力图（并入统计弹窗，用户拍板）
 *  - 单条时间线：卡片抽屉「查看历史」入口复用此弹窗的 timeline 渲染
 *
 * 视觉：复用 .bz-win-head / .bz-win-close（统一主窗口规范），新类前缀 bz-review-stats-。
 */

import { type App } from 'obsidian';
import { topifyZ, allocZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { escapeHtml } from '../core/utils';
import type { ReviewDataManager, ReviewItem } from './data';
import { computeStats, loadDistribution, loadHeatmap, historyOf, RATING_NAMES, RATING_COLORS } from './stats';

let statsMask: HTMLElement | null = null;
let statsPopup: HTMLElement | null = null;
let statsEsc: { unregister: () => void } | null = null;

/** 打开统计弹窗（全局视图） */
export async function showStatsModal(app: App, dm: ReviewDataManager): Promise<void> {
  lastDm = dm;
  const items = await dm.loadItems();
  renderStatsModal(app, dm, items);
}

/** 渲染统计弹窗（全局指标 + 负载） */
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
  header.className = 'bz-win-head';
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

  // 全局指标
  const stats = computeStats(items);
  body.appendChild(renderStatsSection(stats));

  // 负载：今日/明日 + 未来 N 天分布 + 日历热力图
  body.appendChild(renderLoadSection(items));

  // 单条时间线列表（最近复习的笔记，可点开时间线）
  body.appendChild(renderTimelineList(app, dm, items));

  statsEsc = escManager.register('review-stats', {
    isVisible: () => !!statsMask && statsMask.style.display === 'block',
    close: closeStatsModal,
  });
}

function renderStatsSection(stats: ReturnType<typeof computeStats>): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'bz-review-stats-section';
  sec.innerHTML = `
    <div class="bz-review-stats-title">全局指标</div>
    <div class="bz-review-stats-grid">
      <div class="bz-review-stats-cell"><div class="bz-review-stats-num">${stats.totalReviews}</div><div class="bz-review-stats-label">总复习（天）</div></div>
      <div class="bz-review-stats-cell"><div class="bz-review-stats-num">${stats.streak}</div><div class="bz-review-stats-label">连续天数</div></div>
      <div class="bz-review-stats-cell"><div class="bz-review-stats-num">${stats.todayReviews}</div><div class="bz-review-stats-label">今日复习</div></div>
      <div class="bz-review-stats-cell"><div class="bz-review-stats-num">${Math.round(stats.overdueRate * 100)}%</div><div class="bz-review-stats-label">逾期率</div></div>
      <div class="bz-review-stats-cell"><div class="bz-review-stats-num">${stats.avgR === null ? '-' : Math.round(stats.avgR * 100) + '%'}</div><div class="bz-review-stats-label">平均 R</div></div>
      <div class="bz-review-stats-cell"><div class="bz-review-stats-num">${stats.reviewedNotes}</div><div class="bz-review-stats-label">复习笔记</div></div>
    </div>
    <div class="bz-review-stats-sub">评级分布</div>
    <div class="bz-review-stats-bars">
      ${(['again', 'hard', 'good', 'easy'] as const)
        .map((r) => {
          const c = stats.ratingDist[r] || 0;
          const total = Object.values(stats.ratingDist).reduce((a, b) => a + b, 0) || 1;
          const pct = Math.round((c / total) * 100);
          const color = RATING_COLORS[r];
          return `<div class="bz-review-stats-bar-row">
            <span class="bz-review-stats-bar-label" style="color:${color}">${RATING_NAMES[r]}</span>
            <div class="bz-review-stats-bar-track"><div class="bz-review-stats-bar-fill" style="width:${pct}%;background:${color}"></div></div>
            <span class="bz-review-stats-bar-count">${c}</span>
          </div>`;
        })
        .join('')}
    </div>
    <div class="bz-review-stats-sub">最近 7 天</div>
    <div class="bz-review-stats-days">
      ${stats.daily7
        .map((d) => `<div class="bz-review-stats-day"><div class="bz-review-stats-day-bar" style="height:${Math.max(4, (d.count / 10) * 40)}px"></div><div class="bz-review-stats-day-label">${d.date.slice(5)}</div><div class="bz-review-stats-day-num">${d.count}</div></div>`)
        .join('')}
    </div>
  `;
  return sec;
}

function renderLoadSection(items: ReviewItem[]): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'bz-review-stats-section';
  sec.innerHTML = `<div class="bz-review-stats-title">复习负载</div>`;

  // 未来 N 天分布（默认 14 天，可切换）
  const nSwitch = document.createElement('div');
  nSwitch.className = 'bz-review-stats-nswitch';
  let curN = 14;
  const distBox = document.createElement('div');
  distBox.className = 'bz-review-stats-dist';
  const drawDist = (n: number) => {
    const dist = loadDistribution(items, n);
    const max = Math.max(1, ...dist.map((d) => d.count));
    distBox.innerHTML = dist
      .map(
        (d) => `<div class="bz-review-stats-dist-day" title="${d.date}：${d.count} 篇">
          <div class="bz-review-stats-dist-bar" style="height:${Math.max(3, (d.count / max) * 48)}px;${d.count === 0 ? 'opacity:0.25' : ''}"></div>
          <div class="bz-review-stats-dist-label">${d.count}</div>
        </div>`
      )
      .join('');
  };
  [7, 14, 30].forEach((n) => {
    const btn = document.createElement('button');
    btn.className = 'bz-review-stats-nbtn' + (n === curN ? ' active' : '');
    btn.textContent = `${n}天`;
    btn.onclick = () => {
      curN = n;
      nSwitch.querySelectorAll('.bz-review-stats-nbtn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      drawDist(n);
    };
    nSwitch.appendChild(btn);
  });
  sec.appendChild(nSwitch);
  drawDist(curN);
  sec.appendChild(distBox);

  // 日历热力图（近 35 天，周起始对齐）
  const heat = loadHeatmap(items, 35);
  const heatBox = document.createElement('div');
  heatBox.className = 'bz-review-stats-heat';
  const maxH = Math.max(1, ...heat.map((h) => h.count));
  heatBox.innerHTML = heat
    .map((h) => {
      const intensity = h.count === 0 ? '' : `style="background:rgba(255,71,87,${0.2 + 0.8 * (h.count / maxH)})"`;
      return `<div class="bz-review-stats-heat-cell" title="${h.date}：${h.count} 篇" ${intensity}></div>`;
    })
    .join('');
  sec.appendChild(heatBox);

  return sec;
}

function renderTimelineList(app: App, dm: ReviewDataManager, items: ReviewItem[]): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'bz-review-stats-section';
  const title = document.createElement('div');
  title.className = 'bz-review-stats-title';
  title.textContent = '复习时间线';
  sec.appendChild(title);

  // 有历史的笔记（按最近复习时间倒序）
  const withHistory = items
    .filter((i) => (i.reviewHistory || []).length)
    .sort((a, b) => {
      const la = a.reviewHistory?.[a.reviewHistory.length - 1]?.timestamp || '';
      const lb = b.reviewHistory?.[b.reviewHistory.length - 1]?.timestamp || '';
      return lb.localeCompare(la);
    });

  if (!withHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'bz-review-stats-empty';
    empty.textContent = '还没有复习记录';
    sec.appendChild(empty);
    return sec;
  }

  const list = document.createElement('div');
  list.className = 'bz-review-stats-timeline-list';
  for (const item of withHistory.slice(0, 20)) {
    const row = document.createElement('button');
    row.className = 'bz-review-stats-tl-row';
    row.textContent = item.name.replace(/^《|》$/g, '');
    row.title = item.filePath;
    row.onclick = () => showTimeline(app, dm, item);
    list.appendChild(row);
  }
  sec.appendChild(list);
  return sec;
}

/** 单条笔记复习时间线（弹窗内替换 body；卡片抽屉「查看历史」也复用此渲染） */
export function showTimeline(app: App, dm: ReviewDataManager, item: ReviewItem): void {
  if (!statsPopup) {
    // 非统计弹窗上下文（卡片抽屉入口）：先开统计弹窗再进时间线
    void showStatsModal(app, dm).then(() => showTimelineInner(app, item));
    return;
  }
  showTimelineInner(app, item);
}

function showTimelineInner(app: App, item: ReviewItem): void {
  const body = statsPopup!.querySelector('#review-stats-body');
  if (!body) return;
  const history = historyOf(item);
  body.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'bz-review-stats-back';
  back.textContent = '← 返回统计';
  back.onclick = () => {
    closeStatsModal();
    // 重新打开统计弹窗（时间线来自统计弹窗列表或抽屉入口）
    void showStatsModal(app, lastDm!);
  };
  body.appendChild(back);

  const title = document.createElement('div');
  title.className = 'bz-review-stats-title';
  title.textContent = escapeHtml(item.name.replace(/^《|》$/g, ''));
  body.appendChild(title);

  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'bz-review-stats-empty';
    empty.textContent = '暂无复习记录';
    body.appendChild(empty);
    return;
  }

  const tl = document.createElement('div');
  tl.className = 'bz-review-stats-tl';
  for (const h of history) {
    const row = document.createElement('div');
    row.className = 'bz-review-stats-tl-item';
    const when = new Date(h.timestamp).toLocaleString();
    const ratingName = RATING_NAMES[h.rating] || h.rating;
    const color = RATING_COLORS[h.rating] || '#888';
    const rText = h.R !== undefined ? ` · R=${Math.round(h.R * 100)}%` : '';
    const sText = h.stability !== undefined ? ` · S=${h.stability}` : '';
    row.innerHTML = `<span class="bz-review-stats-tl-when">${when}</span>
      <span class="bz-review-stats-tl-rating" style="color:${color}">${ratingName}</span>
      <span class="bz-review-stats-tl-meta">阶段${h.stage}${rText}${sText}</span>`;
    tl.appendChild(row);
  }
  body.appendChild(tl);
}

/** 全局占位：供 timeline 返回用（重新 showStatsModal 时的 dm） */
let lastDm: ReviewDataManager | null = null;

export function closeStatsModal(): void {
  statsEsc?.unregister();
  statsEsc = null;
  if (statsMask) statsMask.remove();
  if (statsPopup) statsPopup.remove();
  statsMask = null;
  statsPopup = null;
}
