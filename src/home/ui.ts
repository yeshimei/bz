/**
 * 内容首页（home 域）UI：活动河全域入口版（issue 232，p16-full 原型一比一落域）。
 *
 * 形态（桌面/移动同一 overlay，CSS ≤768px 断点切换；与 cinema 同构）：
 *  - 桌面：头行（今日活动河 + 日期）+ 三栏 grid（全部域 16 行 | 时间线 | 明天预告）；
 *          点遮罩/ESC 关闭（无关闭钮，头行去设置/关闭范式）
 *  - 移动：头行（活动河 + 关闭钮）+ 单列（时间线 → 明天预告 → 全部域两列瓦片）
 *  - 入口行/瓦片：今日动静彩点（ok/warn/hot/off）+ lucide 图标 + 实时计数，点击执行域命令
 *  - 时间线：recap 五域痕迹流 + 规则点评（✦ 域内自算，非 AI 调用）
 *  - 明天预告：复习/剪藏/日记三张规则卡，点击直达
 * 组件库纪律（铁律 6）：图标一律 lucide（data-lucide 占位 → mountIcons 统一 setIcon）。
 */
import { escManager } from '../core/esc-manager';
import { notice } from '../core/notice';
import { escapeHtml } from '../core/utils';
import { mountIcons } from '../core/ui';
import { topifyZ } from '../core/dom';
import { H } from './state';
import { DOMAINS, DOMAIN_MAP, DOMAIN_DOT } from './domains';
import { collectRiver, buildNotes, buildPreviews, buildDots, riverCountText } from './river';
import type { RiverData, RiverDay, RiverDot } from './river';

/** 周历当前查看日（'YYYY-MM-DD'；null = 今天。周历点按切天，只重渲时间线不重采） */
let riverView: string | null = null;

/* ---------- lucide 占位 + 挂载 ---------- */

function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}

function esc(s: unknown): string {
  return escapeHtml(String(s ?? ''));
}

function p2(n: number): string {
  return String(n).padStart(2, '0');
}

function headDateText(): string {
  const d = new Date();
  const wd = '日一二三四五六'[d.getDay()];
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} 周${wd} · ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/* ---------- 面板骨架 ---------- */

export function createOverlay(app: any): void {
  const overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay bz-home-overlay';
  overlay.innerHTML = `
    <div class="bz-panel-frame bz-home-panel bz-panel-mtop">
      <div class="bz-home-head">
        <h1 class="bz-home-title">首页</h1>
        <div class="bz-home-week" data-home-week></div>
        <span class="bz-home-date" data-home-date></span>
        <button class="bz-home-close" data-home-close title="关闭" aria-label="关闭">${iconSpan('x')}</button>
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
  document.body.appendChild(overlay);
  topifyZ(overlay); // ADR-0067：显示即发号（cinema 等后开面板可压过首页）
  H.currentOverlay = overlay;
  bindEvents(overlay, app);
  renderAll();
  void refreshRiverAndRender();
}

/** 重新采集活动河数据并重绘（打开时调用） */
export async function refreshRiverAndRender(): Promise<void> {
  if (!H.currentOverlay || !H.appRef) return;
  try {
    H.river = await collectRiver(H.appRef);
  } catch {
    H.river = null;
  }
  renderAll();
}

export function closeOverlay(): void {
  if (!H.currentOverlay) return;
  H.currentOverlay.remove();
  H.currentOverlay = null;
  H.river = null;
}

/* ---------- 事件 ---------- */

function bindEvents(overlay: HTMLElement, app: any): void {
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) {
      closeOverlay();
      return;
    }
    if (t.closest('[data-home-close]')) {
      closeOverlay();
      return;
    }
    const go = t.closest('[data-home-go]') as HTMLElement | null;
    if (go) {
      const id = go.dataset.homeGo || '';
      if (id && DOMAIN_MAP.has(id)) openDomain(id, app);
      return;
    }
    // 周历切天：切换选中格并只重渲时间线（数据已在采集窗口内）
    const wk = t.closest('[data-home-weekday]') as HTMLElement | null;
    if (wk && H.river) {
      riverView = wk.dataset.homeWeekday || null;
      const overlay2 = H.currentOverlay;
      if (overlay2) {
        overlay2.querySelectorAll('[data-home-weekday]').forEach((b) =>
          b.classList.toggle('bz-home-wk--sel', (b as HTMLElement).dataset.homeWeekday === riverView));
        const flow = overlay2.querySelector('[data-home-flow]') as HTMLElement | null;
        if (flow) {
          flow.innerHTML = flowHtml(H.river!, riverView ?? '');
          mountIcons(flow);
        }
      }
    }
  });
}

function openDomain(id: string, app: any): void {
  const d = DOMAIN_MAP.get(id);
  if (!d) return;
  closeOverlay();
  try {
    void app.commands.executeCommandById(d.commandId);
  } catch {
    notice(`「${d.name}」暂时不可用`, 'warning');
  }
}

/* ---------- 渲染 ---------- */

/** 入口行彩点（river 规则只覆盖有动静语义的 6 域，其余恒 off） */
function dotOf(dots: Record<string, RiverDot>, id: string): RiverDot {
  return dots[id] ?? 'off';
}

function entriesHtml(data: RiverData): string {
  const dots = buildDots(data);
  return DOMAINS.map((d) => {
        const dot = dotOf(dots, d.id);
        const ct = riverCountText(d.id, data) ?? d.sub;
        return '<button type="button" class="bz-home-erow" data-home-go="' + d.id + '">'
          + '<span class="bz-home-dot bz-home-dot--' + dot + '"></span>'
          + '<span class="bz-home-eic" style="color:' + (DOMAIN_DOT[d.id] ?? '#8a8f99') + '">' + iconSpan(d.icon) + '</span>'
          + '<span class="bz-home-enm">' + esc(d.name) + '</span>'
          + '<span class="bz-home-ect">' + esc(ct) + '</span>'
          + '<span class="bz-home-ego">→</span></button>';
      }).join('');
}

function flowHtml(data: RiverData, view: string): string {
  const day: RiverDay = data.days.find((d) => d.dateStr === view) ?? data.today;
  const isToday = day.dateStr === data.today.dateStr;
  const notes = isToday ? buildNotes(data) : [];
  const title = '<div class="bz-home-sec-t">时 间 线 · ' + (isToday ? '今 天' : esc(day.dateStr.slice(5))) + '</div>';
  const body = day.events.length
    ? day.events.map((e, i) => {
        const note = notes.find((n) => n.index === i);
        const lastDiary = i === day.events.length - 1 && note && note.text.indexOf('日记') >= 0 ? ' bz-home-ev--warn' : '';
        const dmColor = DOMAIN_DOT[e.domain === 'todo' ? 'memo' : e.domain] ?? '#8a8f99';
        const dmName = DOMAIN_MAP.get(e.domain === 'todo' ? 'memo' : e.domain)?.name ?? e.domain;
        const dmIcon = DOMAIN_MAP.get(e.domain === 'todo' ? 'memo' : e.domain)?.icon ?? '';
        return '<div class="bz-home-ev' + lastDiary + '">'
          + '<span class="bz-home-ev-tm">' + esc(e.timeLabel) + '</span>'
          + '<div class="bz-home-ev-bd"><div class="bz-home-ev-tx">'
          + '<span class="bz-home-ev-dm" style="background:' + dmColor + '">' + iconSpan(dmIcon) + esc(dmName) + '</span>'
          + esc(e.text) + '</div>'
          + (note ? '<div class="bz-home-ev-note">' + esc(note.text) + '</div>' : '')
          + '</div></div>';
      }).join('')
    : '<div class="bz-home-flow-empty">这一天还没有留下痕迹。<br><b>写一篇日记</b>、点一轮番茄、读几页书——<br>都会出现在这条河里。</div>';
  return title + (day.events.length ? '<div class="bz-home-timeline">' + body + '</div>' : body);
}

function nextHtml(data: RiverData): string {
  return '<div class="bz-home-sec-t bz-home-sec-t--ai">明 天 预 告</div>'
    + buildPreviews(data).map((pr) =>
        '<button type="button" class="bz-home-pr" data-home-go="' + pr.go + '">'
        + '<div class="bz-home-pr-h">' + esc(pr.h) + '</div><div>' + esc(pr.b) + '</div>'
        + '<span class="bz-home-pr-go">' + esc(pr.goLabel) + '</span></button>'
      ).join('');
}

/** 移动端全部域两列瓦片（桌面隐藏；单列顺序 时间线 → 预告 → 瓦片） */
function tilesHtml(data: RiverData): string {
  const dots = buildDots(data);
  return '<div class="bz-home-m-tiles">'
    + DOMAINS.map((d) => {
        const dot = dotOf(dots, d.id);
        const ct = riverCountText(d.id, data) ?? d.sub;
        return '<button type="button" class="bz-home-m-tile" data-home-go="' + d.id + '">'
          + '<span class="bz-home-dot bz-home-dot--' + dot + '"></span>'
          + '<span class="bz-home-eic" style="color:' + (DOMAIN_DOT[d.id] ?? '#8a8f99') + '">' + iconSpan(d.icon) + '</span>'
          + '<span class="bz-home-enm">' + esc(d.name) + '</span>'
          + '<span class="bz-home-ect">' + esc(ct) + '</span></button>';
      }).join('')
    + '</div>';
}

function renderAll(): void {
  const overlay = H.currentOverlay;
  if (!overlay) return;
  const date = overlay.querySelector('[data-home-date]');
  if (date) date.textContent = headDateText();

  if (!H.river) {
    // 数据未到/采集失败：结构占位（骨架），不闪空内容
    const entries = overlay.querySelector('[data-home-entries]') as HTMLElement;
    const flow = overlay.querySelector('[data-home-flow]') as HTMLElement;
    const next = overlay.querySelector('[data-home-next]') as HTMLElement;
    entries.innerHTML = '<div class="bz-home-sec-t">全 部 域</div>';
    flow.innerHTML = '<div class="bz-home-sec-t">时 间 线 · 今 天</div><div class="bz-home-flow-empty">正在汇入今天的痕迹…</div>';
    next.innerHTML = '';
    (overlay.querySelector('[data-home-tiles]') as HTMLElement).innerHTML = '';
    (overlay.querySelector('[data-home-week]') as HTMLElement).innerHTML = '';
    return;
  }
  const river = H.river;
  const view = riverView && river.days.some((d) => d.dateStr === riverView) ? riverView : null;
  riverView = view;
  // 周历（7 格动静历，hit=当天有动静，sel=当前查看日）
  const week = overlay.querySelector('[data-home-week]') as HTMLElement;
  if (week) {
    week.innerHTML = river.week.map((w) =>
      '<button type="button" class="bz-home-wk' + (w.hit ? ' bz-home-wk--hit' : '') + (w.dateStr === (view ?? river.today.dateStr) ? ' bz-home-wk--sel' : '') + '"'
      + ' data-home-weekday="' + w.dateStr + '" aria-label="' + w.label + (w.hit ? '，有动静' : '') + '">'
      + '<i></i><span class="bz-home-wk-n">' + w.dayOfMonth + '</span></button>').join('');
    mountIcons(week);
  }
  const entries = overlay.querySelector('[data-home-entries]') as HTMLElement;
  const flow = overlay.querySelector('[data-home-flow]') as HTMLElement;
  const next = overlay.querySelector('[data-home-next]') as HTMLElement;
  entries.innerHTML = entriesHtml(river);
  flow.innerHTML = flowHtml(river, view ?? river.today.dateStr);
  next.innerHTML = nextHtml(river);
  const tiles = overlay.querySelector('[data-home-tiles]') as HTMLElement;
  tiles.innerHTML = tilesHtml(river); // 桌面隐藏；移动端单列置前（CSS order）
  mountIcons(entries);
  mountIcons(flow);
  mountIcons(next);
  mountIcons(tiles);
}

/* ---------- ESC / 通知 ---------- */

let escRegistered = false;
let escHandle: { unregister: () => void } | null = null;
export function registerEscapeHandler(): void {
  if (escRegistered) return;
  escRegistered = true;
  escHandle = escManager.register('bz-home', {
    isVisible: () => !!H.currentOverlay,
    close: closeOverlay,
  });
}

/** 注销 ESC 层（关闭面板/卸载时调用；escManager 层不随插件卸载自动清理） */
export function unregisterEscapeHandler(): void {
  if (!escRegistered) return;
  escRegistered = false;
  escHandle?.unregister();
  escHandle = null;
}
