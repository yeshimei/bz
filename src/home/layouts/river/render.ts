/**
 * 内容首页 river 布局（ADR-0105 布局差异层）：面板骨架/头行周历/全部域入口行/
 * 时间线河卡/明天预告卡/移动端瓦片。共享口径与规则纯函数见 ../../shared.ts；
 * 本文件只写「活动河三栏」这一布局的排布 markup。
 */
import {
  esc, iconSpan, DOMAIN_MAP, domainColor, visibleDomains,
  buildDots, buildNotes, buildPreviews, dotOf, riverCountText,
  DEFAULT_TIMELINE_FILTER, timelineKind,
  type RiverData, type RiverWeekDay, type TimelineFilter,
} from '../../shared';

/* ---------- 面板骨架 ---------- */

/** 面板框架（头行 + 三栏 grid；数据区留空由 renderAll 填充，与 ui.ts createOverlay 同构） */
export function panelFrameHtml(): string {
  return `
    <div class="bz-panel-frame bz-home-panel bz-panel-mtop">
      <div class="bz-home-head">
        <div class="bz-home-week" data-home-week></div>
        <span class="bz-home-date" data-home-date></span>
        <div role="button" tabindex="0" class="bz-home-close" data-home-close title="关闭" aria-label="关闭">${iconSpan('x')}</div>
      </div>
      <div class="bz-home-body">
        <div class="bz-home-grid">
          <div class="bz-home-entries" data-home-entries></div>
          <div class="bz-home-flow" data-home-flow></div>
          <div class="bz-home-next" data-home-next></div>
          <div class="bz-home-tiles" data-home-tiles></div>
        </div>
      </div>
    </div>`;
}

/** 数据未到/采集失败的骨架占位：全部域列（不闪空内容） */
export function loadingEntriesHtml(): string {
  return '<div class="bz-home-sec-t">全 部 域</div>';
}

/** 数据未到/采集失败的骨架占位：时间线列 */
export function loadingFlowHtml(): string {
  return '<div class="bz-home-flow-empty">正在汇入今天的痕迹…</div>';
}

/* ---------- 周历（7 格动静历，hit=当天有动静，sel=当前查看日） ---------- */

/** 倒排：最新在前；今天显示「今」不写数字（原型拍板） */
export function weekHtml(week: RiverWeekDay[], todayDateStr: string, selDate: string): string {
  return week.map((w) => {
    const isToday = w.dateStr === todayDateStr;
    return '<div role="button" tabindex="0" class="bz-home-wk' + (w.hit ? ' bz-home-wk--hit' : '') + (w.dateStr === selDate ? ' bz-home-wk--sel' : '') + '"'
      + ' data-home-weekday="' + w.dateStr + '" aria-label="' + (isToday ? '今天' : w.label) + (w.hit ? '，有动静' : '') + '">'
      + '<i></i><span class="bz-home-wk-n">' + (isToday ? '今' : w.dayOfMonth) + '</span></div>';
  }).join('');
}

/* ---------- 全部域入口行 ---------- */

/**
 * 全部域入口行。order = 该端持久化顺序、hidden = 隐藏域（两者都空 = 默认全量顺序，
 * 见 shared.visibleDomains）；本层只负责按序渲染可见域，顺序/显隐的编辑在设置弹窗里。
 */
export function entriesHtml(data: RiverData, order?: readonly string[], hidden?: readonly string[]): string {
  const dotsMap = buildDots(data);
  return visibleDomains(order, hidden).map((d) => {
    const dot = dotOf(dotsMap, d.id);
    const ct = riverCountText(d.id, data) ?? d.sub;
    return '<div role="button" tabindex="0" class="bz-home-erow" data-home-go="' + d.id + '">'
      + '<span class="bz-home-dot bz-home-dot--' + dot + '"></span>'
      + '<span class="bz-home-eic" style="color:' + domainColor(d.id) + '">' + iconSpan(d.icon) + '</span>'
      + '<span class="bz-home-enm">' + esc(d.name) + '</span>'
      + '<span class="bz-home-ect">' + esc(ct) + '</span>'
      + '<span class="bz-home-ego">→</span></div>';
  }).join('');
}

/* ---------- 时间线河卡 ---------- */

/** 时间线渲染选项（issue 287：内容过滤 / 时刻列 / 字号档 都从设置来）
 *  缺省 = 与改版前观感一致（全类但已跳过 / 显时刻 / 标准字号）。 */
export interface FlowOpts {
  /** 内容过滤（产出/状态推进/点评/已跳过）；缺省 DEFAULT_TIMELINE_FILTER */
  filter?: TimelineFilter;
  /** 显示时刻列（关掉整列隐藏，track 随之收窄）；缺省 true */
  showTime?: boolean;
  /** 字号档（compact/normal/loose → 数据属性，样式见 styles.css）；缺省 normal */
  size?: string;
}

/**
 * 时间线河卡。view = 要渲染哪一天（'YYYY-MM-DD'）。
 * 过滤在**渲染层**做（不是在采集层）：切开关要即时可见，重采一遍 vault 太贵，
 * 而痕迹本身已在 RiverData.days 里。代价是 summary/彩点仍按全量算——这是有意的，
 * 「今天有动静」不该因为我关了「已跳过」就变暗。
 * 过滤后当天为空 + 原本有痕迹 → 给「被过滤掉了」的专属空态，别让用户以为数据丢了。
 */
export function flowHtml(data: RiverData, view: string, opts: FlowOpts = {}): string {
  const filter = opts.filter ?? DEFAULT_TIMELINE_FILTER;
  const showTime = opts.showTime !== false;
  const size = opts.size ?? 'normal';
  const wrap = (inner: string): string =>
    '<div class="bz-home-timeline" data-tl-size="' + size + '" data-tl-time="' + (showTime ? '1' : '0') + '">' + inner + '</div>';
  const day = data.days.find((d) => d.dateStr === view) ?? data.today;
  const isToday = day.dateStr === data.today.dateStr;
  // 点评开关：关掉就整条不生成（而不是生成后不渲染——省得下面 find 拿到空）
  const notes = isToday && filter.notes ? buildNotes(data) : [];
  // 点评的 index 指向**过滤前**的事件下标，故过滤前先把 index 带上，过滤后再丢弃
  const kept = day.events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => (timelineKind(e.text) === 'progress' ? filter.progress : filter.produce));
  const body = kept.map(({ e, i }) => {
    const note = notes.find((n) => n.index === i);
    const lastDiary = i === kept[kept.length - 1]?.i && note && note.text.indexOf('日记') >= 0 ? ' bz-home-ev--warn' : '';
    const memoId = e.domain;
    const dmColor = domainColor(memoId);
    const dmName = DOMAIN_MAP.get(memoId)?.name ?? e.domain;
    const dmIcon = DOMAIN_MAP.get(memoId)?.icon ?? '';
    return '<div class="bz-home-ev' + lastDiary + '">'
      + (showTime ? '<span class="bz-home-ev-tm">' + esc(e.timeLabel) + '</span>' : '')
      + '<div class="bz-home-ev-bd"><div class="bz-home-ev-tx">'
      + '<span class="bz-home-ev-dm" style="background:' + dmColor + '">' + iconSpan(dmIcon) + esc(dmName) + '</span>'
      + esc(e.text) + '</div>'
      + (note ? '<div class="bz-home-ev-note">' + esc(note.text) + '</div>' : '')
      + '</div></div>';
  }).join('');
  if (kept.length) return wrap(body);
  // 空态两种：本来就没痕迹 / 有痕迹但被过滤光了（后者要告诉用户「东西在，只是没显示」）
  if (day.events.length) {
    return wrap('<div class="bz-home-flow-empty">这一天有痕迹，但都被「时间线内容过滤」挡掉了。<br>去 <b>设置 → 首页</b> 把想看的类别勾上。</div>');
  }
  return wrap('<div class="bz-home-flow-empty">这一天还没有留下痕迹。<br><b>写一篇日记</b>、点一轮番茄、读几页书——<br>都会出现在这条河里。</div>');
}

/* ---------- 明天预告卡 ---------- */

/** 明天预告卡（第三栏；issue 287 起整块可由设置关掉 → 关时返回空串，ui 层据此连栏一起收敛） */
export function nextHtml(data: RiverData, enabled = true): string {
  if (!enabled) return '';
  return '<div class="bz-home-sec-t bz-home-sec-t--ai">明 天 预 告</div>'
    + buildPreviews(data).map((pr) =>
        '<div role="button" tabindex="0" class="bz-home-pr" data-home-go="' + pr.go + '">'
        + '<div class="bz-home-pr-h">' + esc(pr.h) + '</div><div>' + esc(pr.b) + '</div>'
        + '<span class="bz-home-pr-go">' + esc(pr.goLabel) + '</span></div>'
      ).join('');
}

/* ---------- 移动端全部域单列瓦片（桌面隐藏；单列顺序 时间线 → 预告 → 瓦片） ----------
 * order = 移动端持久化顺序、hidden = 隐藏域（与桌面各排各的） */

export function tilesHtml(data: RiverData, order?: readonly string[], hidden?: readonly string[]): string {
  const dotsMap = buildDots(data);
  return '<div class="bz-home-m-tiles">'
    + visibleDomains(order, hidden).map((d) => {
        const dot = dotOf(dotsMap, d.id);
        const ct = riverCountText(d.id, data) ?? d.sub;
        return '<div role="button" tabindex="0" class="bz-home-m-tile" data-home-go="' + d.id + '">'
          + '<span class="bz-home-dot bz-home-dot--' + dot + '"></span>'
          + '<span class="bz-home-eic" style="color:' + domainColor(d.id) + '">' + iconSpan(d.icon) + '</span>'
          + '<span class="bz-home-enm">' + esc(d.name) + '</span>'
          + '<span class="bz-home-ect">' + esc(ct) + '</span></div>';
      }).join('')
    + '</div>';
}
