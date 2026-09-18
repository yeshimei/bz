/* ============================================================
 * bz 组件库 · 居中模态（src/core/ui/modal.ts）
 * 对齐设计手册 §9/§10 弹窗规格（12px 圆角、shadow-lg、82vh 限高）：
 *   .bz-overlay-mask（遮罩，点关）+ .bz-overlay-popup（内容卡）
 * 供新体系域复用——替换各域自造的 .bz-*-mask/modal 弹窗基座。
 * ESC 经 escManager 单例注册（先开先关，后开优先）。
 * 焦点管理（R13 / 效率整改 2，对齐 settings-modal 样板）：打开聚焦 popup 内
 *   首个可交互元素（autofocus: false 逃生口）、Tab 圈闭在弹窗内（trapFocus）、
 *   关闭（遮罩/ESC/requestClose 放行后的 close）还原焦点到触发元素。
 * ============================================================ */
import { escManager } from '../esc-manager';
import { allocZ } from '../z-order';
import { firstFocusable, trapFocus } from './focus-trap';

/**
 * bindFormSubmit（效率基元，diary 写链路效率#2 首个消费方）：弹窗表单回车提交。
 * - Ctrl/⌘+Enter：恒提交（textarea / 按钮聚焦 / 无聚焦都在内）；
 * - 纯 Enter：仅在单行 input（HTMLInputElement）聚焦时提交；textarea 不拦（回车换行）；
 *   域内已消费（preventDefault）的放行不重复提交——keydown 消费时浏览器不再派发
 *   keypress、keypress 消费时冒泡到本层可见 defaultPrevented，uiSuggest 接管回填与
 *   diary 手输日期 commitManualEdit 两条路径都不双发；uiSuggest 开着但无高亮项时
 *   放行提交（suggest.ts 效率整改 12 口径一致）；
 * - 标 data-bz-no-form-submit 的 input 豁免（弹窗内过滤/搜索框：回车只筛不提交）。
 * 纯 Enter 走 keypress 段监听：输入框的 keypress 消费在 target 阶段先于本层冒泡，
 * defaultPrevented 可见；Ctrl/⌘+Enter 走 keydown 段（Chrome 不为组合键派发 keypress）。
 */
export function bindFormSubmit(popup: HTMLElement, onSubmit: () => void): void {
  popup.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return;
    if (e.key !== 'Enter') return;
    if (!(e.ctrlKey || e.metaKey)) return; // 纯 Enter 交 keypress 段（输入框消费在彼处可见）
    e.preventDefault();
    onSubmit();
  });
  popup.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.defaultPrevented) return; // uiSuggest 接管 / 域内输入框已消费（如手输日期提交）
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return; // Ctrl/⌘+Enter 已在 keydown 段提交
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return; // 仅单行 input；textarea 回车换行不拦
    if (t.dataset.bzNoFormSubmit !== undefined) return; // 过滤/搜索框豁免
    e.preventDefault();
    onSubmit();
  });
}

/**
 * 存活 uiModal 登记表（M13/A1）：open 登记 close 句柄、close 注销（幂等 close 防双注销）。
 * 插件卸载时 closeAllModals() 统一收口（main.ts onunload 清单）——否则禁用插件后遮罩残留
 * 且 ESC 已被 escManager.destroy 短路，只剩点遮罩可关。卸载语义直接 close（绕过 requestClose）：
 * 脏表单确认框在「插件正在消失」的前提下没有意义。遍历副本：close 会同步改集合。
 */
const liveModals = new Set<() => void>();

/** 关闭全部存活 uiModal（unload 收口；未打开时 no-op，可无条件调用） */
export function closeAllModals(): void {
  for (const close of [...liveModals]) close();
}

export interface BzModalOpts {
  content: HTMLElement | string;   // 弹窗内容（元素或 HTML 片段）
  maxWidth?: number;               // 像素宽度（默认 400，≤90vw）
  head?: boolean;                  // 带标题头行——默认 false；头行只有标题，无关闭钮（issue 271：弹窗统一点遮罩/ESC 关闭）
  title?: string;
  onClose?: () => void;            // 关闭回调（遮罩/ESC）
  /** 关闭意图拦截（issue 365 第 5 项，脏表单弹窗用）：提供时遮罩点击/ESC 改调 requestClose——
   *  由消费方决定放行（自行调 close()）还是先弹放弃确认；不直接关。缺省 = 直接关。 */
  requestClose?: () => void;
  className?: string;              // 附加到 popup 的类
  /** 初始焦点管理开关（效率整改 2）：缺省 true = 打开聚焦首个可交互元素 + 关闭还原焦点；
   *  传 false 逃生口——特殊弹窗（如需聚焦特定控件的域自管焦点）完全跳过本组件的焦点接管 */
  autofocus?: boolean;
}

/** 打开居中模态，返回 { mask, popup, close } */
export function uiModal(opts: BzModalOpts): { mask: HTMLElement; popup: HTMLElement; close: () => void } {
  // 打开前记录焦点归属，关闭时还原（遮罩/ESC/requestClose 放行均走 close）
  const prevActive = document.activeElement;
  const focusEnabled = opts.autofocus !== false;

  const mask = document.createElement('div');
  mask.className = 'bz-overlay-mask';
  mask.style.zIndex = String(allocZ());

  const popup = document.createElement('div');
  popup.className = 'bz-overlay-popup' + (opts.className ? ' ' + opts.className : '');
  if (opts.maxWidth) popup.style.maxWidth = `min(${opts.maxWidth}px, calc(100vw - 32px))`;
  // 读屏语义（对齐 flow-dialog 契约）：弹窗容器为模态 dialog，标题随 head 透出
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  if (opts.title) popup.setAttribute('aria-label', opts.title);

  if (opts.head) {
    const head = document.createElement('div');
    head.className = 'bz-dialog-head';
    const title = document.createElement('span');
    title.className = 'bz-dialog-title';
    title.textContent = opts.title || '';
    head.appendChild(title);
    popup.appendChild(head);
  }

  const body = document.createElement('div');
  body.className = 'bz-dialog-body';
  if (typeof opts.content === 'string') body.innerHTML = opts.content;
  else body.appendChild(opts.content);
  popup.appendChild(body);
  mask.appendChild(popup);

  let closed = false;
  let escHandle: ReturnType<typeof escManager.register> | null = null;
  const releaseTrap = focusEnabled ? trapFocus(popup) : null;
  function close() {
    if (closed) return;
    closed = true;
    liveModals.delete(close); // 存活登记表注销（幂等 close 只走一次）
    releaseTrap?.();
    mask.remove();
    escHandle?.unregister();
    // 还原焦点到触发元素（元素仍连接时；被外部清理时跳过）
    if (focusEnabled && prevActive instanceof HTMLElement && prevActive.isConnected) {
      prevActive.focus();
    }
    opts.onClose?.();
  }

  // 关闭意图统一走 attemptClose：有 requestClose 时交消费方拦截（脏表单先确认），否则直接关
  const attemptClose = (): void => {
    if (opts.requestClose) opts.requestClose();
    else close();
  };

  // 点遮罩关闭（弹窗内元素不触发）
  mask.addEventListener('click', (e) => {
    if (e.target === mask) attemptClose();
  });

  // ESC：栈顶后开先关（escManager 会做可见性判断）
  escHandle = escManager.register('bz-modal', {
    isVisible: () => mask.isConnected,
    close: attemptClose,
  });

  document.body.appendChild(mask);
  // 聚焦 popup 内首个可交互元素（跳过隐藏项；移动端跳过 input/textarea 防软键盘）
  if (focusEnabled) firstFocusable(popup)?.focus();
  liveModals.add(close); // 存活登记（closeAllModals 卸载收口用）
  return { mask, popup, close };
}
