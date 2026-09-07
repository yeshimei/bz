/**
 * 内容首页（home 域）UI 行为层（issue 232 活动河全域入口版）。
 *
 * 形态（桌面/移动同一 overlay，CSS ≤768px 断点切换；与 cinema 同构）：
 *  - 桌面：头行（今日活动河 + 日期）+ 三栏 grid（全部域 | 时间线 | 明天预告）；
 *          点遮罩/ESC 关闭（无关闭钮，头行去设置/关闭范式）
 *  - 移动：头行（活动河 + 关闭钮）+ 单列（时间线 → 明天预告 → 全部域两列瓦片）
 *  - 入口行/瓦片：今日动静彩点（ok/warn/hot/off）+ lucide 图标 + 实时计数，点击执行域命令
 *  - 时间线：recap 五域痕迹流 + 规则点评（✦ 域内自算，非 AI 调用）
 *  - 明天预告：复习/剪藏/日记三张规则卡，点击直达
 * markup 单源（ADR-0104）：面板骨架/周历/入口行/河卡/预告卡 HTML 全部出自 ./render
 * （渲染纯层，与原型壳消费同一份）；本文件只剩行为层——生命周期/事件绑定/ESC/命令直达。
 */
import { escManager } from '../core/esc-manager';
import { notice } from '../core/notice';
import { mountIcons } from '../core/ui';
import { topifyZ } from '../core/dom';
import { H } from './state';
import { DOMAIN_MAP } from './domains';
import { collectRiver } from './river';
import {
  headDateText, panelFrameHtml, loadingEntriesHtml, loadingFlowHtml,
  weekHtml, entriesHtml, flowHtml, nextHtml, tilesHtml,
} from './render';

/** 周历当前查看日（'YYYY-MM-DD'；null = 今天。周历点按切天，只重渲时间线不重采） */
let riverView: string | null = null;

/* ---------- 生命周期 ---------- */

export function createOverlay(app: any): void {
  const overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay bz-home-overlay';
  overlay.innerHTML = panelFrameHtml();
  document.body.appendChild(overlay);
  topifyZ(overlay); // ADR-0067：显示即发号（cinema 等后开面板可压过首页）
  H.currentOverlay = overlay;
  mountIcons(overlay); // 头行关闭钮等静态占位（renderAll 只挂数据区图标）
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
  // 键盘可达性：role=button 元素响应 Enter/Space（button 换 div 后的补偿）
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as HTMLElement;
    const el = t.closest('[role="button"]') as HTMLElement | null;
    if (el) {
      e.preventDefault();
      el.click();
    }
  });
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

/* ---------- 渲染（胶水：把单源 markup 灌进骨架数据区） ---------- */

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
    entries.innerHTML = loadingEntriesHtml();
    flow.innerHTML = loadingFlowHtml();
    next.innerHTML = '';
    (overlay.querySelector('[data-home-tiles]') as HTMLElement).innerHTML = '';
    (overlay.querySelector('[data-home-week]') as HTMLElement).innerHTML = '';
    return;
  }
  const river = H.river;
  const view = riverView && river.days.some((d) => d.dateStr === riverView) ? riverView : null;
  riverView = view;
  const today = river.today.dateStr;
  const week = overlay.querySelector('[data-home-week]') as HTMLElement;
  if (week) week.innerHTML = weekHtml(river.week, today, view ?? today);
  const entries = overlay.querySelector('[data-home-entries]') as HTMLElement;
  const flow = overlay.querySelector('[data-home-flow]') as HTMLElement;
  const next = overlay.querySelector('[data-home-next]') as HTMLElement;
  entries.innerHTML = entriesHtml(river);
  flow.innerHTML = flowHtml(river, view ?? today);
  next.innerHTML = nextHtml(river);
  const tiles = overlay.querySelector('[data-home-tiles]') as HTMLElement;
  tiles.innerHTML = tilesHtml(river); // 桌面隐藏；移动端单列置前（CSS order）
  mountIcons(week);
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
