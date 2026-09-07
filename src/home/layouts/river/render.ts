/**
 * 内容首页 river 布局（ADR-0105 布局差异层）：面板骨架/头行周历/全部域入口行/
 * 时间线河卡/明天预告卡/移动端瓦片。共享口径与规则纯函数见 ../../shared.ts；
 * 本文件只写「活动河三栏」这一布局的排布 markup。
 */
import {
  esc, iconSpan, DOMAINS, DOMAIN_MAP, DOMAIN_DOT,
  buildDots, buildNotes, buildPreviews, dotOf, riverCountText, memoIdOf,
  type RiverData, type RiverWeekDay,
} from '../../shared';

/* ---------- 面板骨架 ---------- */

/** 面板框架（头行 + 三栏 grid；数据区留空由 renderAll 填充，与 ui.ts createOverlay 同构） */
export function panelFrameHtml(): string {
  return `
    <div class="bz-panel-frame bz-home-panel bz-panel-mtop">
      <div class="bz-home-head">
        <h1 class="bz-home-title">首页</h1>
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

export function entriesHtml(data: RiverData): string {
  const dotsMap = buildDots(data);
  return DOMAINS.map((d) => {
    const dot = dotOf(dotsMap, d.id);
    const ct = riverCountText(d.id, data) ?? d.sub;
    return '<div role="button" tabindex="0" class="bz-home-erow" data-home-go="' + d.id + '">'
      + '<span class="bz-home-dot bz-home-dot--' + dot + '"></span>'
      + '<span class="bz-home-eic" style="color:' + (DOMAIN_DOT[d.id] ?? '#8a8f99') + '">' + iconSpan(d.icon) + '</span>'
      + '<span class="bz-home-enm">' + esc(d.name) + '</span>'
      + '<span class="bz-home-ect">' + esc(ct) + '</span>'
      + '<span class="bz-home-ego">→</span></div>';
  }).join('');
}

/* ---------- 时间线河卡 ---------- */

export function flowHtml(data: RiverData, view: string): string {
  const day = data.days.find((d) => d.dateStr === view) ?? data.today;
  const isToday = day.dateStr === data.today.dateStr;
  const notes = isToday ? buildNotes(data) : [];
  const body = day.events.map((e, i) => {
    const note = notes.find((n) => n.index === i);
    const lastDiary = i === day.events.length - 1 && note && note.text.indexOf('日记') >= 0 ? ' bz-home-ev--warn' : '';
    const memoId = memoIdOf(e.domain);
    const dmColor = DOMAIN_DOT[memoId] ?? '#8a8f99';
    const dmName = DOMAIN_MAP.get(memoId)?.name ?? e.domain;
    const dmIcon = DOMAIN_MAP.get(memoId)?.icon ?? '';
    return '<div class="bz-home-ev' + lastDiary + '">'
      + '<span class="bz-home-ev-tm">' + esc(e.timeLabel) + '</span>'
      + '<div class="bz-home-ev-bd"><div class="bz-home-ev-tx">'
      + '<span class="bz-home-ev-dm" style="background:' + dmColor + '">' + iconSpan(dmIcon) + esc(dmName) + '</span>'
      + esc(e.text) + '</div>'
      + (note ? '<div class="bz-home-ev-note">' + esc(note.text) + '</div>' : '')
      + '</div></div>';
  }).join('');
  const empty = '<div class="bz-home-flow-empty">这一天还没有留下痕迹。<br><b>写一篇日记</b>、点一轮番茄、读几页书——<br>都会出现在这条河里。</div>';
  return day.events.length ? '<div class="bz-home-timeline">' + body + '</div>' : empty;
}

/* ---------- 明天预告卡 ---------- */

export function nextHtml(data: RiverData): string {
  return '<div class="bz-home-sec-t bz-home-sec-t--ai">明 天 预 告</div>'
    + buildPreviews(data).map((pr) =>
        '<div role="button" tabindex="0" class="bz-home-pr" data-home-go="' + pr.go + '">'
        + '<div class="bz-home-pr-h">' + esc(pr.h) + '</div><div>' + esc(pr.b) + '</div>'
        + '<span class="bz-home-pr-go">' + esc(pr.goLabel) + '</span></div>'
      ).join('');
}

/* ---------- 移动端全部域两列瓦片（桌面隐藏；单列顺序 时间线 → 预告 → 瓦片） ---------- */

export function tilesHtml(data: RiverData): string {
  const dotsMap = buildDots(data);
  return '<div class="bz-home-m-tiles">'
    + DOMAINS.map((d) => {
        const dot = dotOf(dotsMap, d.id);
        const ct = riverCountText(d.id, data) ?? d.sub;
        return '<div role="button" tabindex="0" class="bz-home-m-tile" data-home-go="' + d.id + '">'
          + '<span class="bz-home-dot bz-home-dot--' + dot + '"></span>'
          + '<span class="bz-home-eic" style="color:' + (DOMAIN_DOT[d.id] ?? '#8a8f99') + '">' + iconSpan(d.icon) + '</span>'
          + '<span class="bz-home-enm">' + esc(d.name) + '</span>'
          + '<span class="bz-home-ect">' + esc(ct) + '</span></div>';
      }).join('')
    + '</div>';
}
