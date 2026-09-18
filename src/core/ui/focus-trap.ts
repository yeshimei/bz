/* ============================================================
 * bz 组件库 · 焦点圈闭（src/core/ui/focus-trap.ts）
 * 弹壳家族共享的键盘焦点工具（效率整改 6）：Tab 循环钳制在容器内，
 * Shift 反向；firstFocusable 供「打开聚焦首个可交互元素」复用
 * （口径同 settings-modal：跳过隐藏项，移动端跳过 input/textarea 防软键盘）。
 * 消费方：uiModal / openFlowDialog / openSettingsModal（lightbox 暂不接）。
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
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}
