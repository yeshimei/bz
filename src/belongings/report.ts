/**
 * 归物本年度资产报告 · 视图行为层（issue 356，范式照抄 src/reading-report）
 *
 * 独立遮罩页（对照归物本详情/表单：body 级 mask + topifyZ 发号），面板工具行
 * 「年度报告」按钮与命令 bz-belongings-report 共用同一入口（ui.ts openBelongingsReportView）。
 * 保留的既有机制：
 *   - l3 先渲染骨架占位（计算完成前可见「统计中…」）；
 *   - ticket 40 分片渲染：段落 HTML 逐段生成、每段让出主线程，大库不卡死；
 *   - progress toast 先弹常驻帧随阶段更新（完成转 success、失败转 error、空年静默收起）；
 *   - m1b 错误人话化（不展示原始异常，技术详情留 console）；
 *   - 取消三路收口：关闭报告/面板关闭（closeBelReport）/插件卸载（unloadBelReport）
 *     作废在途渲染 + 收起在途 toast；渲染中途容器被摘除不写已移除 DOM。
 * 年份切换（‹ ›）：头部导航在「有记录年份」间移动，切换即作废在途重渲。
 * 数据层 = ./report-stats 纯函数（belongings.json 只读派生）；图表配色 = core/chart-palette。
 * 本文件不 import ./ui（空态「记一笔」动作经 opts.onAdd 注入，避免环依赖）。
 * issue 356 真机回归批：面板挂 .bz-panel-mtop（移动端真全屏 + 44px 顶部避让，桌面不生效，
 *   对照 secondbrain/panel.ts 与域内主面板挂法）；概览 KPI 卡文字显式取 CHART_INK
 *   （粉彩底不翻主题，继承壳墨色会在暗色下翻成米白 → 看不清）。
 */
import { yieldToMainThread as yieldToMainThreadCore } from '../core/utils';
import { notify } from '../core/notice';
import { mountIcons, uiEmpty, uiBtn, uiBtnRow } from '../core/ui';
import { emptyHtmlStr } from '../core/ui/str';
import { esc, iconSpan } from '../core/ui/str';
import { topifyZ } from '../core/z-order';
import { CHART_PASTEL_SERIES, CHART_HIGHLIGHT, CHART_INK, CHART_RANK_BADGES } from '../core/chart-palette';
import { moneyShort, moneyWith, type MoneyUnit } from './shared';
import { computeYearReport, reportYears, resolveReportYear, type YearReportStats } from './report-stats';
import { trimDailyNum } from './shared';
import { motionReportSection } from './motion';
import type { BelongingsItem } from './types';

// ==================== 模块状态（在途渲染 / 当前报告上下文） ====================

/** 在途渲染序号：cancelBelReport/新渲染使旧渲染全部作废（分片循环逐段检查） */
let renderSeq = 0;

/** progress toast 序号：dedupeKey 每次调用唯一化——绕开 notice.ts 30s 抑制窗口 */
let progressToastSeq = 0;

/** 在途 progress toast 句柄（cancel 时收起，不留常驻残留） */
let activeProgress: ReturnType<typeof notify> | null = null;

/** 当前报告遮罩根（null = 未开） */
let maskEl: HTMLElement | null = null;

/** 报告上下文：物品快照 + 金额单位 + 年份清单 + 当前年份 + 动作回调 */
let ctxItems: BelongingsItem[] = [];
let ctxUnit: MoneyUnit = 'cny';
let ctxYears: string[] = [];
let ctxYear = '';
let ctxOnAdd: (() => void) | null = null;

/** 骨架占位（l3；文案无 emoji） */
const SKELETON_HTML = '<div class="bz-belr-skeleton">统计中…</div>';

/** 统计失败人话模板（m1b：不展示原始异常，技术详情留 console） */
const ERROR_HTML = `<div class="bz-belr-error">
  <div class="bz-belr-error-t">统计失败</div>
  <div>读取归物本数据时出错，请关闭后重试</div>
</div>`;

/** requestIdleCallback 超时兜底（防止长空闲期饿死分片渲染；与 reading-report 同参） */
const IDLE_CALLBACK_TIMEOUT_MS = 50;

function yieldToMainThread(): Promise<void> {
  return yieldToMainThreadCore(IDLE_CALLBACK_TIMEOUT_MS);
}

// ==================== 生命周期（开 / 关 / 取消 / 卸载） ====================

/** 报告是否开着 */
export function isBelReportOpen(): boolean {
  return !!maskEl;
}

/**
 * 打开年度报告页（面板工具行与命令共用）。已开着 → 用新快照就地重开（作废在途重渲）。
 * items 为报告期快照（面板开着取当前库；命令路径由 ui.ts 从盘载后传入），本层不改数据。
 */
export function openBelReport(items: BelongingsItem[], unit: MoneyUnit, opts: { onAdd?: () => void } = {}): void {
  ctxItems = items;
  ctxUnit = unit;
  ctxOnAdd = opts.onAdd ?? null;
  ctxYears = [];
  // 重入保留当前年份（批B 修复15，func P3-4）：面板内保存触发就地重开时，翻年选择不再被跳回最新年
  // （悬空年份由 startReport 的 resolveReportYear 回落兜底）；首开才归零
  if (!maskEl) ctxYear = '';

  if (maskEl) {
    // 重入：遮罩已在 → 只重算内容（keep 视图不闪遮罩）
    startReport();
    return;
  }
  const mask = document.createElement('div');
  mask.className = 'bz-overlay-mask bz-bel-report-mask';
  mask.innerHTML = `
  <div class="bz-bel-report bz-panel-mtop" role="dialog" aria-label="归物本年度资产报告">
    <div class="bz-bel-report-head">
      <div class="bz-bel-report-title">年度资产报告</div>
      <div class="bz-bel-report-nav">
        <button type="button" class="bz-icon-btn bz-touch-target" data-belr-prev title="上一年" aria-label="上一年">${iconSpan('chevron-left')}</button>
        <span class="bz-bel-report-year" data-belr-year>—</span>
        <button type="button" class="bz-icon-btn bz-touch-target" data-belr-next title="下一年" aria-label="下一年">${iconSpan('chevron-right')}</button>
      </div>
      <button type="button" class="bz-icon-btn bz-touch-target bz-bel-report-close" data-belr-close title="关闭" aria-label="关闭报告">${iconSpan('x')}</button>
    </div>
    <div class="bz-bel-report-body" data-belr-body></div>
  </div>`;
  document.body.appendChild(mask);
  topifyZ(mask); // ADR-0067：显示即发号（压主面板/详情）
  mountIcons(mask);
  maskEl = mask;

  // 事件委托（头部导航 + 关闭 + 点遮罩关）
  mask.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === mask) { closeBelReport(); return; }
    if (t.closest('[data-belr-close]')) { closeBelReport(); return; }
    if (t.closest('[data-belr-prev]')) { stepYear(-1); return; }
    if (t.closest('[data-belr-next]')) { stepYear(1); return; }
  });

  startReport();
}

/** 关闭报告（幂等）：作废在途渲染 + 收 toast + 摘遮罩 + 清上下文 */
export function closeBelReport(): void {
  cancelBelReport();
  if (maskEl) {
    maskEl.remove();
    maskEl = null;
  }
  ctxItems = [];
  ctxYears = [];
  ctxYear = '';
  ctxOnAdd = null;
}

/** 作废在途渲染 + 收起在途 progress toast（关闭/切换/面板关闭共用；幂等） */
export function cancelBelReport(): void {
  renderSeq++;
  if (activeProgress) {
    activeProgress.hide();
    activeProgress = null;
  }
}

/** 卸载清理（main.ts onunload → 域 unloadBelongings 链）：作废在途 + 复位模块状态 */
export function unloadBelReport(): void {
  cancelBelReport();
  if (maskEl) {
    maskEl.remove();
    maskEl = null;
  }
  ctxItems = [];
  ctxYears = [];
  ctxYear = '';
  ctxOnAdd = null;
}

// ==================== 年份切换 ====================

/** ‹ = 更早一年 / › = 更晚一年；ctxYears 降序（0 = 最新）→ ‹ 向 index+1、› 向 index-1；越界空操作。
 *  翻年走 quiet 渲染（完成不弹 toast，审查修复批 issue 356） */
function stepYear(dir: number): void {
  const idx = ctxYears.indexOf(ctxYear);
  if (idx < 0) return;
  const next = idx - dir;
  if (next < 0 || next >= ctxYears.length) return;
  ctxYear = ctxYears[next];
  paintYearNav();
  startReport(true);
}

/** 头部导航同步（年份标签 + 两按钮边界禁用） */
function paintYearNav(): void {
  if (!maskEl) return;
  const label = maskEl.querySelector('[data-belr-year]') as HTMLElement | null;
  if (label) label.textContent = ctxYear || '—';
  const idx = ctxYears.indexOf(ctxYear);
  const prev = maskEl.querySelector('[data-belr-prev]') as HTMLButtonElement | null;
  const next = maskEl.querySelector('[data-belr-next]') as HTMLButtonElement | null;
  if (prev) prev.disabled = idx < 0 || idx >= ctxYears.length - 1;
  if (next) next.disabled = idx < 0 || idx <= 0;
}

// ==================== 渲染管线（骨架 → progress → 分片段落） ====================

/**
 * 启动（或重启）报告内容渲染：作废在途 → 骨架 → progress toast → 分片计算渲染。
 * 渲染期间遮罩/内容区被移除 → 立即中止，不写已摘除的 DOM。
 * quiet = 静默完成（翻年切换用，审查修复批 issue 356：连翻数年不再连闪「年度报告完成」toast）
 */
function startReport(quiet = false): void {
  const body = maskEl?.querySelector('[data-belr-body]') as HTMLElement | null;
  if (!body) return;
  cancelBelReport();
  const seq = renderSeq;
  const alive = () => seq === renderSeq && !!maskEl?.isConnected && body.isConnected;

  // l3：骨架占位先行（计算完成前即可见，不再「像没点」）
  body.innerHTML = SKELETON_HTML;

  // 年份解析（快照上最近有记录的一年）+ 头部导航同步
  ctxYears = reportYears(ctxItems);
  ctxYear = resolveReportYear(ctxItems, ctxYear);
  paintYearNav();

  // ticket 40：progress toast 先弹（dedupeKey 唯一化：30s 抑制窗口不吞快速重开）
  const progress = notify('正在统计年度数据…', {
    type: 'progress',
    duration: 0,
    dedupeKey: `bz-belongings-report-progress-${++progressToastSeq}`,
  });
  activeProgress = progress;

  const finishAbort = (): void => {
    progress.hide();
    if (activeProgress === progress) activeProgress = null;
  };
  const finishDone = (quiet: boolean): void => {
    if (activeProgress === progress) activeProgress = null;
    if (quiet) progress.hide();
    else {
      progress.setType('success');
      progress.setMessage('年度报告完成');
    }
  };

  const step = async (): Promise<void> => {
    // 全库空：空态带动作（记一笔 → opts.onAdd），不渲染空报告，静默收尾
    progress.setMessage('正在读取归物本…');
    await yieldToMainThread();
    if (!alive()) return finishAbort();
    if (ctxItems.length === 0) {
      body.innerHTML = '';
      body.appendChild(buildLibraryEmpty());
      mountIcons(body);
      motionReportSection(body.firstElementChild as HTMLElement); // 动效层：空态显影
      return finishDone(true);
    }

    progress.setMessage('正在汇总购入与离场…');
    await yieldToMainThread();
    if (!alive()) return finishAbort();
    const year = ctxYear;
    const stats = computeYearReport(ctxItems, year);
    if (!alive()) return finishAbort();

    // 空年人话：这一年没有记录（导航仍可切走），不渲染零报告
    if (!stats.hasYearData) {
      body.innerHTML = emptyYearHtml(year);
      mountIcons(body);
      motionReportSection(body.firstElementChild as HTMLElement); // 动效层：空年显影
      return finishDone(true);
    }

    // HTML 分片渲染：每段一个宏任务（requestIdleCallback/setTimeout），逐步绘制不冻结
    const sections = buildReportSections(stats);
    body.innerHTML = ''; // 骨架 → 报告区（分片渐进填充）
    for (const section of sections) {
      if (!alive()) return finishAbort();
      await yieldToMainThread();
      // 二次校验：await 让出期间容器可能已被摘除 → 不把本段写进已移除的 DOM
      if (!alive()) return finishAbort();
      body.insertAdjacentHTML('beforeend', section.generate());
      motionReportSection(body.lastElementChild as HTMLElement); // 动效层：段落显影 + 柱条/占比条生长
      progress.setMessage(`正在生成${section.label}…`);
    }

    if (alive()) {
      mountIcons(body);
      finishDone(quiet);
    } else {
      finishAbort();
    }
  };

  void step().catch((error) => {
    // m1b：用户面人话模板，技术详情留 console
    console.error('生成归物本年度报告失败:', error);
    if (activeProgress === progress) activeProgress = null;
    if (alive()) {
      progress.setType('error');
      progress.setMessage('统计失败：读取归物本数据时出错，请重试');
      body.innerHTML = ERROR_HTML;
    } else {
      progress.hide();
    }
  });
}

/** 全库空态（uiEmpty 库皮 + 主按钮「记一笔」经 opts.onAdd） */
function buildLibraryEmpty(): HTMLElement {
  const actions = uiBtnRow(
    [
      uiBtn({
        label: '记一笔',
        icon: 'plus',
        tone: 'primary',
        onClick: () => ctxOnAdd?.(),
      }),
    ],
    { center: true },
  );
  return uiEmpty({
    icon: 'package',
    title: '归物本还没有物品',
    desc: '登记物品后按年生成资产报告',
    actions,
  });
}

/** 空年空态（呈报#19-B8 拍板：统一 uiEmpty 小图标口径——emptyHtmlStr 与 core uiEmpty 同
 *  markup 单源 bz-empty/bz-empty-ic，图标占位由分片循环后的 mountIcons 兑现；人话文案不变） */
function emptyYearHtml(year: string): string {
  return emptyHtmlStr(
    'calendar-days',
    `${year} 年没有物品记录`,
    ctxYears.length > 1 ? '用上方 ‹ › 切换到有记录的年份' : '在归物本补记这一年的物品后，这里会生成报告',
  );
}

// ==================== 段落构建（懒生成；分片循环逐段拼装） ====================

interface ReportSection {
  key: string;
  label: string;
  generate: () => string;
}

/** 报告分段（段落顺序 = 页面结构；逐段 generate 由分片循环调度） */
function buildReportSections(stats: YearReportStats): ReportSection[] {
  return [
    { key: 'summary', label: '购入与离场概览', generate: () => summaryHtml(stats) },
    { key: 'monthly', label: '月度花销走势', generate: () => monthlyHtml(stats) },
    { key: 'categories', label: '分类占比', generate: () => categoriesHtml(stats) },
    { key: 'daily', label: '日均成本走势', generate: () => dailyHtml(stats) },
    { key: 'companions', label: '陪伴最久榜', generate: () => companionsHtml(stats) },
  ];
}

/** 段标题 */
function secHead(title: string, note = ''): string {
  return `<div class="bz-belr-sec-head"><span class="bz-belr-sec-title">${esc(title)}</span>${note ? `<span class="bz-belr-sec-note">${esc(note)}</span>` : ''}</div>`;
}

/** 概览：当年购入件数/金额 + 离场件数/回血（粉彩底 + 深墨字，两主题一致）。
 *  文字色必须显式取 CHART_INK：粉彩底不随主题翻转（chart-palette 契约），若让文字继承
 *  壳的 --bz-bel-ink，暗色下翻成米白 → 粉彩底上看不清（issue 356 真机回归）。陪伴榜
 *  徽章同款先例（background + color:${CHART_INK} 内联成对出现）。 */
function summaryHtml(stats: YearReportStats): string {
  const card = (num: string, label: string, color: string) =>
    `<div class="bz-belr-hero" style="background:${color};color:${CHART_INK}">
      <b>${esc(num)}</b><span>${esc(label)}</span>
    </div>`;
  return `<div class="bz-belr-sec">
  ${secHead(`${stats.year} 年购入与离场`)}
  <div class="bz-belr-grid">
  ${card(String(stats.purchasedCount), '购入件数', CHART_PASTEL_SERIES[0])}
  ${card(moneyShort(stats.purchasedAmount, ctxUnit), '购入金额', CHART_PASTEL_SERIES[1])}
  ${card(String(stats.exitedCount), '离场件数', CHART_PASTEL_SERIES[2])}
  ${card(moneyShort(stats.recoveredAmount, ctxUnit), '转卖回血', CHART_PASTEL_SERIES[4])}
  </div>
  </div>`;
}

/** 柱列描述（月度花销/日均成本共用） */
interface ColSpec {
  label: string;
  /** 柱高归一值（≥0） */
  value: number;
  /** 柱顶数值文本（如 ￥1,200 / 3.25） */
  display: string;
  /** 强调列（花销峰值月） */
  accent?: boolean;
  /** 未到来月（空档占位） */
  future?: boolean;
  /** 悬浮说明 */
  title?: string;
}

/** 柱列图（3px 零线 → 60px 满柱；粉彩底 + 墨字，值在柱顶） */
function columnsHtml(cols: ColSpec[]): string {
  const max = Math.max(0, ...cols.filter((c) => !c.future).map((c) => c.value));
  return `<div class="bz-belr-cols">
  ${cols
    .map((c) => {
      const height = !c.future && c.value > 0 && max > 0 ? 12 + Math.round((c.value / max) * 48) : 3;
      const bg = c.future ? 'transparent' : c.accent ? CHART_HIGHLIGHT : CHART_PASTEL_SERIES[0];
      const num = !c.future && c.value > 0 ? `<span class="bz-belr-col-num">${esc(c.display)}</span>` : '';
      const cls = ['bz-belr-col', c.future ? 'bz-belr-col--future' : '', c.accent ? 'bz-belr-col--accent' : '']
        .filter(Boolean)
        .join(' ');
      return `<div class="${cls}"${c.title ? ` title="${esc(c.title)}"` : ''}>
        ${num}
        <div class="bz-belr-col-bar" style="height:${height}px;${c.future ? '' : `background:${bg}`}"></div>
        <div class="bz-belr-col-label">${esc(c.label)}</div>
      </div>`;
    })
    .join('')}
  </div>`;
}

/** 月度花销走势（当年购入按月；峰值月强调）。
 *  纯离场年（当年零购入，审查修复批 issue 356）：12 根零柱像渲染坏了 → 换人话空态 */
function monthlyHtml(stats: YearReportStats): string {
  if (stats.purchasedAmount === 0) {
    // 呈报#19-B8：纯文本空态退役，统一小图标版（trending-up 走势语义，文案不变）
    return `<div class="bz-belr-sec">
    ${secHead('月度花销走势', '当年无购入')}
    ${emptyHtmlStr('trending-up', '这一年没有购入记录，只有出离', '月度花销无可绘制')}
    </div>`;
  }
  const maxAmount = Math.max(0, ...stats.monthlySpend.map((m) => m.amount));
  const cols: ColSpec[] = stats.monthlySpend.map((m) => ({
    label: m.label,
    value: m.amount,
    display: moneyShort(m.amount, ctxUnit),
    accent: m.amount > 0 && m.amount === maxAmount,
    title: m.count > 0 ? `${m.label}购入 ${m.count} 件 · ${moneyShort(m.amount, ctxUnit)}` : `${m.label}无购入`,
  }));
  return `<div class="bz-belr-sec">
  ${secHead('月度花销走势', `全年购入 ${moneyShort(stats.purchasedAmount, ctxUnit)}`)}
  ${columnsHtml(cols)}
  </div>`;
}

/** 分类占比（当年购入金额份额；Top 8 + 其余合并「其他」）。
 *  纯离场年（当年零购入，审查修复批 issue 356）：「共 0 类」+ 空行区像渲染坏了 → 换人话空态 */
function categoriesHtml(stats: YearReportStats): string {
  if (stats.purchasedAmount === 0) {
    // 呈报#19-B8：统一小图标版（chart-bar 占比语义，文案不变）
    return `<div class="bz-belr-sec">
    ${secHead('分类占比', '当年无购入')}
    ${emptyHtmlStr('chart-bar', '当年无购入 · 只有出离记录', '分类占比无可统计')}
    </div>`;
  }
  const MAX_ROWS = 8;
  const rows = stats.categoryShare.slice(0, MAX_ROWS);
  const rest = stats.categoryShare.slice(MAX_ROWS);
  if (rest.length > 0) {
    rows.push({
      name: `其他（${rest.length} 类）`,
      count: rest.reduce((s, r) => s + r.count, 0),
      amount: rest.reduce((s, r) => s + r.amount, 0),
      pct: Math.round(rest.reduce((s, r) => s + r.pct, 0) * 10) / 10,
    });
  }
  const line = (row: (typeof rows)[number], i: number) => {
    const color = CHART_PASTEL_SERIES[i % CHART_PASTEL_SERIES.length];
    const width = Math.max(0, Math.min(100, row.pct));
    return `<div class="bz-belr-row">
      <span class="bz-belr-row-label" title="${esc(row.name)}">${esc(row.name)}</span>
      <div class="bz-progress bz-progress--lg bz-belr-row-track"><i style="width:${width}%;background:${color}"></i></div>
      <span class="bz-belr-row-val">${row.count} 件 · ${esc(moneyShort(row.amount, ctxUnit))} · ${row.pct}%</span>
    </div>`;
  };
  return `<div class="bz-belr-sec">
  ${secHead('分类占比', `共 ${stats.categoryShare.length} 类 · 按购入金额`)}
  <div class="bz-belr-rows">${rows.map(line).join('')}</div>
  </div>`;
}

/** 日均成本走势（各月末时点的全库日均成本；未来月空档；当年当月截至今日——批B 修复14） */
function dailyHtml(stats: YearReportStats): string {
  // 段注随截止口径走：当年报告最后一根真实柱 = 当月截至今日（旧口径写死「各月末时点」与数据不符）
  const hasCapped = stats.dailyCostTrend.some((c) => c.capped);
  const cols: ColSpec[] = stats.dailyCostTrend.map((c) => ({
    label: c.label,
    value: c.future ? 0 : c.value,
    display: c.value > 0 ? trimDailyNum(c.value) : '0',
    future: c.future,
    title: c.future
      ? `${c.label}末尚未到来`
      : c.capped
        ? `${c.label}截至今日日均 ${trimDailyNum(c.value)}${c.value > 0 ? '/天' : ''}`
        : `${c.label}末日均 ${trimDailyNum(c.value)}${c.value > 0 ? '/天' : ''}`,
  }));
  return `<div class="bz-belr-sec">
  ${secHead('日均成本走势', `口径：各月末时点${hasCapped ? '（当月截至今日）' : ''} ·（总购入 − 转卖回本）/ 累计持有天数`)}
  ${columnsHtml(cols)}
  </div>`;
}

/** 千分位日均数值文本（审查修复批 issue 356）：整数部分与其他金额一致走 zh-CN 千分位（1,234.5） */
function trimNumThousands(n: number): string {
  return (Number(n) || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

/** 陪伴最久榜（Top N；截止口径随 companionAsOf——当年截至今日 / 往年截至年末，审查修复批 issue 356） */
function companionsHtml(stats: YearReportStats): string {
  if (stats.companions.length === 0) {
    // 呈报#19-B8：统一小图标版（history 陪伴时长语义，文案不变）
    return `<div class="bz-belr-sec">
    ${secHead('陪伴最久榜')}
    ${emptyHtmlStr('history', '暂无可统计的物品')}
    </div>`;
  }
  const asOf = stats.companionAsOf === 'today' ? '截至今日' : `截至 ${stats.year} 年末`;
  const line = (row: { item: BelongingsItem; days: number }, i: number) => {
    const it = row.item;
    const price = Number(it.purchase_price) || 0;
    // days=0（购入日出离日同天）无「日均」语义：显示 '—' 而非回退全价（审查修复批 issue 356）
    const daily = row.days > 0 ? moneyWith(trimNumThousands(price / row.days), ctxUnit) : '—';
    const badge =
      i < CHART_RANK_BADGES.length
        ? ` style="background:${CHART_RANK_BADGES[i]};color:${CHART_INK}"`
        : '';
    const goneYear = it.exit_date ? String(it.exit_date).slice(0, 4) : '';
    return `<div class="bz-belr-comp">
      <span class="bz-belr-comp-rank"${badge}>${i + 1}</span>
      <span class="bz-belr-comp-name" title="${esc(it.name)}">${esc(it.name)}</span>
      <span class="bz-belr-comp-meta">${esc(String(it.purchase_date || '').slice(0, 4) || '—')} 年购入${goneYear ? ` · ${esc(goneYear)} 年离场` : ''} · 日均 ${esc(daily)}</span>
      <b class="bz-belr-comp-days">${row.days.toLocaleString('zh-CN')} 天</b>
    </div>`;
  };
  return `<div class="bz-belr-sec">
  ${secHead('陪伴最久榜', `${asOf} · Top ${stats.companions.length}`)}
  <div class="bz-belr-comps">${stats.companions.map(line).join('')}</div>
  </div>`;
}
