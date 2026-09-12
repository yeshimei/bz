/**
 * 流程框声明内核（ADR-0064 决策 6，ticket 131 Wave-1）
 * `openFlowDialog({ title?, message, actions })` → Promise<value>：
 * 点击动作按钮 resolve 该动作的 `value`；遮罩点击 / ESC / 被新流程框顶替
 * 一律按取消语义 resolve `undefined`（约定取消值，见下）。
 *
 * DOM 契约（铁律 3，承继 core/confirm）：
 * - 标准双动作渲染结构与旧 confirm 完全一致——mask id `__shared_confirm_mask__`、
 *   popup id `__shared_confirm_popup__`（role="dialog" aria-modal="true"）、
 *   `<h4>/<p>` 文本、`.confirm-actions` 容器、按钮 id `__shared_confirm_cancel__`/
 *   `__shared_confirm_ok__`，按钮顺序「取消左、确认右」，双动作时按钮不附加任何新类；
 * - 三个及以上（或单个）动作：按钮改用新 id `bz-flow-dialog-action-<i>` 与新类名
 *   `bz-flow-dialog-action`（danger/cta 追加 `bz-flow-dialog-danger`/
 *   `bz-flow-dialog-cta`），既有 id/类名不破坏。
 * - **弹窗壳统一（issue 291）**：popup 额外挂共享壳类 `bz-overlay-popup bz-flow-dialog`
 *   ——流程框与 `uiModal` 同壳（底色/描边/圆角/阴影/限高全由共享壳承担），域皮肤类
 *   （`opts.className`）经 `.bz-overlay-popup.bz-<域>-skin-*` 复合选择器即可一并覆盖
 *   确认框，域内不必再写 `#__shared_confirm_popup__` id 选择器；id 契约与内部结构不变。
 *   右侧主动作为危险动作时，popup 再挂 `bz-flow-dialog--danger`（按钮不加类，契约不破）——
 *   对应设计手册 §9/§10「慎重决策场景按钮保持中性」（主按钮不默认高亮，仅文字用 danger 色）。
 * - 文案（title/message/按钮 label）一律 escapeHtml 后拼 HTML（P0-8 防注入不得回退）。
 * - 焦点（UX 整改 37）：打开默认聚焦确认动作（`cta: true` 的动作，否则最后一个动作；
 *   标准双动作即右侧 `__shared_confirm_ok__`，回车=确认）；关闭还原焦点到触发元素。
 * - ESC 通道沿用 `'q3-confirm'`（escManager）。
 * - danger/cta 标记在标准双动作下只影响焦点（cta），不改动冻结的 DOM 结构。
 */
import { escManager } from './esc-manager';
import { escapeHtml } from './utils';
import { allocZ } from './z-order';

export interface FlowDialogAction {
  /** 按钮文案（纯文本语义，渲染前 escapeHtml） */
  label: string;
  /** 点击该按钮时 Promise resolve 的值 */
  value: string;
  /** 危险动作标记（非标准布局时追加 bz-flow-dialog-danger 类） */
  danger?: boolean;
  /** 主动作标记：打开时默认聚焦该按钮；非标准布局时追加 bz-flow-dialog-cta 类 */
  cta?: boolean;
}

export interface FlowDialogOptions {
  title?: string;
  message: string;
  actions: FlowDialogAction[];
  /** 追加到弹窗根的皮肤类（挂 body，供域自绘皮：如剪藏本编辑部对话框） */
  className?: string;
}

/** 按钮规格（数据层产物；label 为原文，DOM 层拼 HTML 时统一 escapeHtml） */
export interface FlowDialogButtonSpec {
  id: string;
  className: string;
  label: string;
  value: string;
}

/** buildFlowDialogParts 产物：popup innerHTML + 事件/焦点绑定所需的按钮清单 */
export interface FlowDialogParts {
  html: string;
  buttons: FlowDialogButtonSpec[];
  focusId: string;
  /** 主动作（cta 优先，否则最后一个）是危险动作——UI 层据此挂 `bz-flow-dialog--danger` 修饰 */
  dangerPrimary: boolean;
}

/** 标准双动作契约 id（铁律 3，外部依赖，不得改名） */
export const FLOW_DIALOG_CANCEL_ID = '__shared_confirm_cancel__';
export const FLOW_DIALOG_OK_ID = '__shared_confirm_ok__';

/**
 * 数据层（纯函数，node 安全）：title/message/actions → popup HTML 与按钮绑定清单。
 * 标准双动作 = 旧 confirm 逐字节同构（取消左/确认右，无附加类）；
 * 其余数量动作 = 新 id/类名方案；焦点 = cta 动作优先，否则最后一个动作。
 */
export function buildFlowDialogParts(
  title: string | undefined,
  message: string,
  actions: FlowDialogAction[]
): FlowDialogParts {
  let buttons: FlowDialogButtonSpec[];
  if (actions.length === 2) {
    buttons = [
      { id: FLOW_DIALOG_CANCEL_ID, className: '', label: actions[0].label, value: actions[0].value },
      { id: FLOW_DIALOG_OK_ID, className: '', label: actions[1].label, value: actions[1].value },
    ];
  } else {
    buttons = actions.map((a, i) => {
      const cls = ['bz-flow-dialog-action'];
      if (a.danger) cls.push('bz-flow-dialog-danger');
      if (a.cta) cls.push('bz-flow-dialog-cta');
      return { id: `bz-flow-dialog-action-${i}`, className: cls.join(' '), label: a.label, value: a.value };
    });
  }
  const ctaIdx = actions.findIndex((a) => a.cta);
  const focusIdx = ctaIdx >= 0 ? ctaIdx : actions.length - 1;
  const html =
    '<h4>' + escapeHtml(title || '确认') + '</h4>' +
    '<p>' + escapeHtml(message) + '</p>' +
    '<div class="confirm-actions">' +
    buttons
      .map((b) => {
        const clsAttr = b.className ? ' class="' + b.className + '"' : '';
        return '<button id="' + b.id + '"' + clsAttr + '>' + escapeHtml(b.label) + '</button>';
      })
      .join('') +
    '</div>';
  return { html, buttons, focusId: buttons[focusIdx].id, dangerPrimary: !!actions[focusIdx].danger };
}

/** 当前在途流程框的结算函数（同一时刻至多一个；被新框顶替时按取消语义结算） */
let activeSettle: ((v: string | undefined) => void) | null = null;

/**
 * 打开流程框。取消语义约定：遮罩点击 / ESC / 被新流程框顶替 → resolve `undefined`；
 * 因此 `value` 不得使用 undefined 语义值，调用方以 `=== 'ok'` 等显式值判定确认路径。
 */
export function openFlowDialog(opts: FlowDialogOptions): Promise<string | undefined> {
  if (!opts.actions || opts.actions.length === 0) {
    return Promise.reject(new Error('openFlowDialog：actions 不能为空'));
  }
  return new Promise((resolve) => {
    const prevActive = document.activeElement;

    // 同一时刻只保留最上一个流程框：旧框先按取消语义结算（旧 Promise 不悬挂），
    // 随后移除其 DOM（settle 内自会 remove），再挂新框
    if (activeSettle) activeSettle(undefined);

    const parts = buildFlowDialogParts(opts.title, opts.message, opts.actions);

    const mask = document.createElement('div');
    mask.id = '__shared_confirm_mask__';
    // 动态发号（ADR-0067）：每次打开新建 DOM，创建即显示，谁后开谁在上
    mask.style.zIndex = String(allocZ());
    mask.onclick = (e) => {
      if (e.target === mask) settle(undefined);
    };

    const popup = document.createElement('div');
    popup.id = '__shared_confirm_popup__';
    // 统一弹窗壳（issue 291）：与 uiModal 同壳，域皮肤类经 `.bz-overlay-popup.bz-<域>-skin-*`
    // 复合选择器即可覆盖确认框；危险主动作加修饰类（按钮本身不加类，冻结契约不破）
    popup.className = 'bz-overlay-popup bz-flow-dialog' + (parts.dangerPrimary ? ' bz-flow-dialog--danger' : '');
    // className 是「皮肤类串」（域侧惯例含多个类，如 `bz-bs-flow-dialog bz-bs-skin-noir bz-bs-mode-light`），
    // 必须逐个 token add——DOMTokenList.add 收到含空格的整串会抛 InvalidCharacterError，弹窗根本建不出来。
    // 单类（clipbook）与空串（memo 基线）行为不变。
    if (opts.className) for (const cls of opts.className.split(/\s+/)) if (cls) popup.classList.add(cls);
    // UX 整改 37：读屏语义——弹窗容器为 dialog 模态
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    // P0-8：文案全部经 escapeHtml 再拼 HTML（title/message/label 均为纯文本语义），
    // DOM 结构/id/类名不变
    popup.innerHTML = parts.html;

    mask.appendChild(popup);
    document.body.appendChild(mask);

    const escHandle = escManager.register('q3-confirm', {
      isVisible: () => mask.isConnected,
      close: () => settle(undefined),
    });

    let settled = false;
    function restoreFocus(): void {
      if (prevActive && prevActive instanceof HTMLElement && prevActive.isConnected) {
        prevActive.focus();
      }
    }
    function settle(v: string | undefined) {
      if (settled) return;
      settled = true;
      if (activeSettle === settle) activeSettle = null;
      escHandle.unregister();
      mask.remove();
      restoreFocus();
      resolve(v);
    }
    activeSettle = settle;

    for (const b of parts.buttons) {
      const btn = document.getElementById(b.id);
      if (btn) btn.onclick = () => settle(b.value);
    }

    // 打开默认聚焦确认动作（cta 优先，否则最后一个；标准双动作=右侧确认钮，回车=确认）
    const focusBtn = document.getElementById(parts.focusId);
    if (focusBtn) focusBtn.focus();
  });
}

/**
 * 取消结算当前在途流程框（幂等，无在途框时静默；C14）：按取消语义 resolve `undefined`
 * 并走 settle 全量清理（DOM 移除 / esc 注销 / 焦点还原）。插件卸载前调用——原先 onunload
 * 直接 remove 遮罩不走 settle，未决 Promise 永久悬挂，等确认结果的后续操作静默终止。
 */
export function cancelActiveFlowDialog(): void {
  if (activeSettle) activeSettle(undefined);
}

/**
 * 未保存草稿拦截（ticket 141 通病 3）：表单弹窗点遮罩 / ESC 关闭前，若表单已有输入，
 * 先走流程框确认「放弃 or 继续编辑」，确认放弃才执行 proceed。脏检测（getDirty）由调用方负责——
 * 这里只统一确认框文案与「默认聚焦继续编辑」的安全焦点（回车=继续编辑，防误触丢失草稿）。
 * className（issue 291）：域皮肤类透传——调用域的表单弹窗挂 body 时带皮肤，本框同样要带，
 * 否则同一域里「表单弹窗有皮、放弃确认没皮」。
 */
export function confirmDiscard(proceed: () => void, message?: string, className?: string): void {
  void openFlowDialog({
    title: '放弃未保存的内容？',
    message: message || '弹窗内有未保存的输入，关闭后将丢失',
    className,
    actions: [
      { label: '放弃', value: 'ok' },
      { label: '继续编辑', value: 'cancel' },
    ],
  }).then((v) => {
    if (v === 'ok') proceed();
  });
}
