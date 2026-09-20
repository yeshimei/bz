/* ============================================================
 * bz 组件库 · 焦点圈闭（src/core/ui/focus-trap.ts）
 * 弹壳家族共享的键盘焦点工具（效率整改 6）：Tab 循环钳制在容器内，
 * Shift 反向；firstFocusable 供「打开聚焦首个可交互元素」复用
 * （口径同 settings-modal：跳过隐藏项，移动端跳过 input/textarea 防软键盘）；
 * trapPanelFocus 供大面板「打开即入焦 + Tab 圈闭」复用（呈报#13 F3+H3 全域范式）。
 * 消费方：uiModal / openFlowDialog / openSettingsModal（lightbox 暂不接）+ 各域大面板。
 * ============================================================ */
import { isMobileEnv } from '../mobile';

/** 容器内可交互元素选择器（读屏/焦点管理的通用口径，settings-modal 同款） */
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** 元素是否不可见：自身或任一祖先挂 bz-setting-hidden / 内联 display none
 *  （settings-modal isItemHidden 同口径：review 做题家容器等动态隐藏场景） */
function isHidden(el: HTMLElement): boolean {
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body) {
    if (cur.classList.contains('bz-setting-hidden')) return true;
    if (cur.style.display === 'none') return true;
    cur = cur.parentElement;
  }
  return false;
}

/** 容器内首个可聚焦元素（跳过隐藏项；移动端跳过 input/textarea 防软键盘） */
export function firstFocusable(container: HTMLElement): HTMLElement | null {
  const list = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (isHidden(el)) return false;
    if (isMobileEnv()) {
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return false;
    }
    return true;
  });
  return list[0] || null;
}

/**
 * 焦点圈闭（focus trap）：Tab 在容器内 focusable 集合首尾循环，Shift 反向；
 * 焦点已落在容器外（程序化挪走等）时拉回首项。返回解绑函数（弹壳关闭时调用）。
 */
export function trapFocus(container: HTMLElement): () => void {
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => !isHidden(el) && !el.hasAttribute('disabled')
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    // 「焦点在圈内」判定（呈报#13 F3+H3）：active === container 本体也算圈外——
    // 大面板容器入焦（trapPanelFocus）后焦点落在容器上（tabindex=-1 不进 Tab 序），
    // 此时 Tab 该去首项、Shift+Tab 该绕尾项，走「圈外拉回」分支而不是放行出圈。
    const inside =
      active instanceof Node && active !== container && container.contains(active);
    if (e.shiftKey) {
      if (active === first || !inside) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !inside) {
      e.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}

/** 大面板焦点壳类（components.css 据此免画焦点圈——圈住整个视口级面板纯视觉噪音，
 *  内部控件的焦点圈不受影响） */
export const PANEL_FOCUS_CLASS = 'bz-panel-focushost';

/**
 * 大面板「打开即入焦 + Tab 圈闭」（呈报#13 F3+H3 全域范式，belongings 表单 uiModal
 * 先例的容器版）：打开时把焦点放进面板容器本体（tabindex=-1 程序化可焦，不落输入框——
 * 移动端不弹软键盘），Tab / Shift+Tab 由 trapFocus 钳制在面板内。
 * 返回解绑函数（面板关闭时调用；show/hide 复用壳在每次 show 调用幂等无害——
 * 重复 addEventListener 同一函数引用自动去重，tabindex/class 幂等）。
 */
export function trapPanelFocus(panel: HTMLElement): () => void {
  panel.classList.add(PANEL_FOCUS_CLASS);
  if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
  const release = trapFocus(panel);
  panel.focus({ preventScroll: true });
  return release;
}
