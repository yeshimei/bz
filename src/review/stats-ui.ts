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
import { topifyZ } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { escapeHtml, formatRelativeTime, stripTitleMarks } from '../core/utils';
import type { ReviewDataManager, ReviewItem, FittedParams } from './data';
import { computeStats, loadDistribution, historyOf, dateKey, RATING_NAMES, RATING_COLORS } from './stats';
import { FSRS, DEFAULT_W } from './fsrs';
import { uiIcon } from '../core/ui';

let statsMask: HTMLElement | null = null;
let statsPopup: HTMLElement | null = null;
let statsEsc: { unregister: () => void } | null = null;

// ======================= 浅色统计卡 =======================
// issue 270：静态样式收编 src/review/styles.css（.bz-stats-*），仅数据驱动动态色保留内联。
// 形制沿革：初版拷自 cinema 旧版统计，cinema 侧此后重构（lucide 板块头/esc 口径），
// 本域未跟随——两侧已是各自形制，注释不再宣称「对齐影视」（深审新-13）。
const PASTEL_CARDS = ['#D6E4FF', '#D8F3DC', '#CDF0EA', '#FADDE1', '#FFE5CC', '#E6DFF5'];

function statCardHTML(label: string, value: any, idx: number): string {
  const bg = PASTEL_CARDS[idx % PASTEL_CARDS.length];
  return `<div class="bz-stats-card" style="background:${bg};">
    <div class="bz-stats-card-val">${value}</div>
    <div class="bz-stats-card-lbl">${label}</div>
  </div>`;
}

/** 色条板块容器：accent 色动态内联，其余静态样式在 styles.css .bz-stats-section */
function sectionHTML(title: string, body: string, accent = '#D6E4FF'): string {
  return `<div class="bz-stats-section">
    <div class="bz-stats-section-head">
      <span class="bz-stats-section-accent" style="background:${accent};"></span>
      <span>${escapeHtml(title)}</span>
    </div>
    ${body}
  </div>`;
}

function emptyHTML(): string {
  return '<p class="bz-stats-empty">暂无数据</p>';
}

/** 软进度条：fill 宽度/颜色动态内联，其余静态样式在 styles.css .bz-stats-bar-* */
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

/** 竖柱状图：容器 min-width、柱体高度/颜色动态内联，其余静态样式在 styles.css .bz-stats-chart-* */
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

/** chips 行内小统计（支持 title 悬浮注解） */
function statInlineHTML(items: Array<string | { text: string; title?: string }>): string {
  return `<div class="bz-stats-inline">${items
    .map((s) => {
      const o = typeof s === 'string' ? { text: s } : s;
      return `<span class="bz-stats-inline-chip"${o.title ? ` title="${escapeHtml(o.title)}"` : ''}>${o.text}</span>`;
    })
    .join('')}</div>`;
}

/** 排名列表行（点击行为由渲染方事件委托处理） */
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
/** 打开统计弹窗（全局视图）。R 口径与调度同源：读拟合权重 currentW()（item 12）；
 *  issue 361：同时取拟合元数据，标注当前拟合档位（基础拟合/全参拟合） */
export async function showStatsModal(app: App, dm: ReviewDataManager): Promise<void> {
  const items = await dm.loadItems();
  let w: number[] | undefined;
  let fit: FittedParams | null = null;
  try {
    const appMod = await import('./app');
    w = appMod.reviewApp.currentW();
    fit = typeof appMod.reviewApp.fitMeta === 'function' ? appMod.reviewApp.fitMeta() : null;
  } catch {
    w = undefined; // 取不到拟合权重 → computeStats 回退默认
  }
  renderStatsModal(app, dm, items, w, fit);
}

/** 渲染统计弹窗（600px 窄卡） */
function renderStatsModal(app: App, dm: ReviewDataManager, items: ReviewItem[], w?: number[], fit?: FittedParams | null): void {
  closeStatsModal();
  statsMask = document.createElement('div');
  statsMask.id = 'review-stats-mask';
  statsMask.className = 'bz-overlay-mask'; // issue 365：遮罩底/blur 收编 core 单源（弹窗 fixed 自居中不受 flex/padding 影响）
  statsMask.style.display = 'block';
  statsMask.onclick = closeStatsModal;

  statsPopup = document.createElement('div');
  statsPopup.id = 'review-stats-popup';
  statsPopup.style.display = 'flex';
  topifyZ(statsMask, statsPopup); // ADR-0067：显示时发号单形制（构造期不再 allocZ 占号）

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
  body.innerHTML = buildStatsHTML(app, dm, items, stats, fit);

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

  statsEsc = escManager.register('bz-review-stats', {
    isVisible: () => !!statsMask && statsMask.style.display === 'block',
    close: closeStatsModal,
  });
}

/** 构建统计弹窗 HTML（浅色卡 + 色条板块） */
function buildStatsHTML(app: App, dm: ReviewDataManager, items: ReviewItem[], stats: ReturnType<typeof computeStats>, fit?: FittedParams | null): string {
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

  // 拟合档位标注（issue 361；审查体验修复——「全参拟合/基础拟合」是天书，改人话 + title 悬浮注解）：
  // 全参 = 按你的记录定制（19 参数全拟合）；基础 = 简化版（8 参数）；默认参数 = 尚未拟合。
  // 附样本量与拟合时间。
  const fitChips = fit
    ? statInlineHTML([
        {
          text: fit.full ? '记忆曲线：按你的记录定制' : '记忆曲线：简化版',
          title: fit.full
            ? '用全部 19 个记忆参数拟合你的复习记录，越用越贴合你的节奏'
            : '先用 8 个核心参数拟合的简化版，复习记录攒够后会自动升级为完整定制',
        },
        `样本 ${fit.fitCount} 条`,
        `拟合于 ${formatRelativeTime(new Date(fit.fitAt))}`,
      ])
    : statInlineHTML([{ text: '记忆曲线：默认参数，复习积累后自动拟合', title: '复习记录攒够（约 100 条评级）后会自动拟合你的记忆曲线' }]);

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

  return cards + fitChips + ratingHTML + loadHTML + timelineHTML + weekHTML;
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
  histMask.className = 'bz-overlay-mask'; // issue 365：遮罩底/blur 收编 core 单源
  histMask.style.display = 'block';
  histMask.onclick = closeTimeline;

  histPopup = document.createElement('div');
  histPopup.id = 'review-history-popup';
  histPopup.style.display = 'flex';
  topifyZ(histMask, histPopup); // ADR-0067：显示时发号单形制（构造期不再 allocZ 占号）

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
    histEsc = escManager.register('bz-review-history', { isVisible: () => !!histMask && histMask.style.display === 'block', close: closeTimeline });
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

  histEsc = escManager.register('bz-review-history', {
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
