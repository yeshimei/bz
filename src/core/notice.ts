/**
 * 通知系统（ticket 25）——自绘 toast，替代 Obsidian 原生 Notice。
 *
 * 设计决策（grilling 会话敲定）：
 * - 顶部居中，z-index 10300（现有最高 10200 入口页之上）
 * - 堆叠 + 上限 5 条（超出挤掉最旧）
 * - 滑入滑出 200ms；prefers-reduced-motion 降级为淡入淡出
 * - z-index 100000（最顶，盖过 Obsidian 全部 UI 层）
 * - dedupeKey：同键在 30s 窗口内重复触发时合并更新（不刷屏，供后台自动事件用）
 * - 类型：info/success/warning/error + progress（进度条形态）
 * - 动态能力：setMessage（原地更新文本）/ setProgress（0-100 或 -1 不确定态）
 * - 富文本：title 标题行 + action 操作按钮（点击后自动收起）
 * - 时长：默认 info/success/warning 3s、error 5s；显式 duration 优先；
 *   progress 类型默认不自动消失（调用方控制）
 * - 点击通知本体即关闭
 */
export type NoticeType = 'info' | 'success' | 'warning' | 'error';
/** 通知类型：四种常规类型 + progress（进度条形态，默认不自动消失） */
export type NoticeKind = NoticeType | 'progress';

/** 进入/退出动画变体（默认 drop：顶部下滑入） */
export type NoticeVariant =
  | 'drop'
  | 'pop'
  | 'slide-left'
  | 'slide-right'
  | 'bounce'
  | 'shake';

export interface NoticeAction {
  label: string;
  onClick: () => void;
}

export interface NoticeOptions {
  /** 类型（默认 info；'progress' = 进度条形态） */
  type?: NoticeKind;
  /** 显示时长 ms；不传按类型默认（info/success/warning 3000，error 5000）；progress 默认不自动消失 */
  duration?: number;
  /** 富文本标题行（可选） */
  title?: string;
  /** 操作按钮（点击后执行回调并收起通知） */
  action?: NoticeAction;
  /** 动画变体（默认 'drop'） */
  variant?: NoticeVariant;
  /** 去重键：同键在 30s 窗口内重复触发时合并更新消息，不新弹（防后台自动事件刷屏） */
  dedupeKey?: string;
}

export interface NoticeHandle {
  /** 通知 DOM 元素 */
  el: HTMLElement;
  /** 动态更新正文文本 */
  setMessage(msg: string): void;
  /** 更新进度条：0-100；-1 = 不确定态（跑马灯） */
  setProgress(pct: number): void;
  /** 切换类型（如 progress 完成 → success）：更新图标/配色，并接管自动消失计时 */
  setType(t: NoticeKind): void;
  /** 主动关闭（带退出动画） */
  hide(): void;
}

const MAX_VISIBLE = 5;
const STYLE_ID = 'bz-notice';
const LEAVE_MS = 200;
/** 去重窗口：同 dedupeKey 在此窗口内重复触发 → 合并更新，不新弹 */
const DEDUPE_WINDOW_MS = 30000;

/** 类型 → 默认动效变体（不传 variant 时自动选用，保证全站动效一致性） */
const DEFAULT_VARIANT: Record<NoticeType, NoticeVariant> = {
  success: 'pop',
  warning: 'shake',
  error: 'shake',
  info: 'drop',
};

/**
 * 按消息内容自动归类类型（替换原生 Notice 时的统一归类规则）：
 * ✅/🎉 → success；⚠️ → warning；❌/失败/错误 → error；其余 → info。
 */
export function classifyNoticeType(msg: string): NoticeType {
  if (/^(✅|🎉)/.test(msg)) return 'success';
  if (/^⚠️/.test(msg)) return 'warning';
  if (/^❌/.test(msg) || /失败|错误/.test(msg)) return 'error';
  return 'info';
}

/**
 * 便捷 API（原生 Notice 替换入口）：自动归类类型，时长规则与 notify 一致
 * （不传 dur 时 error 默认 5s、其余 3s）。
 */
export function notice(msg: string, dur?: number): void {
  notify(msg, {
    type: classifyNoticeType(msg),
    duration: dur,
  });
}

/** 各变体的退出动画类（默认 out-drop） */
const OUT_CLASS: Record<NoticeVariant, string> = {
  drop: 'bz-notice--out-drop',
  pop: 'bz-notice--out-pop',
  'slide-left': 'bz-notice--out-left',
  'slide-right': 'bz-notice--out-right',
  bounce: 'bz-notice--out-fade',
  shake: 'bz-notice--out-fade',
};

const NOTICE_CSS = `
#bz-notice-container {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 100000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: max-content;
  max-width: calc(100vw - 24px);
}
/* 移动端：Obsidian 顶部栏更高，通知下移（项目断点惯例 max-width: 768px） */
@media (max-width: 768px) {
  #bz-notice-container {
    top: calc(34px + env(safe-area-inset-top, 0px));
  }
}
.bz-notice {
  pointer-events: auto;
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 240px;
  max-width: min(420px, calc(100vw - 24px));
  padding: 10px 14px 11px;
  border-radius: 10px;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-normal);
  cursor: pointer;
  overflow: hidden;
  animation: bzNoticeIn 0.2s ease-out;
}
.bz-notice--leaving {
  animation: bzNoticeOut 0.2s ease-in forwards;
}
.bz-notice--leaving.bz-notice--out-pop {
  animation: bzNoticeOutPop 0.2s ease-in forwards;
}
.bz-notice--leaving.bz-notice--out-left {
  animation: bzNoticeOutLeft 0.2s ease-in forwards;
}
.bz-notice--leaving.bz-notice--out-right {
  animation: bzNoticeOutRight 0.2s ease-in forwards;
}
.bz-notice--leaving.bz-notice--out-fade {
  animation: bzNoticeOutFade 0.2s ease-in forwards;
}
.bz-notice--in-pop {
  animation: bzNoticeInPop 0.25s ease-out;
}
.bz-notice--in-slide-left {
  animation: bzNoticeInLeft 0.25s ease-out;
}
.bz-notice--in-slide-right {
  animation: bzNoticeInRight 0.25s ease-out;
}
.bz-notice--in-bounce {
  animation: bzNoticeInBounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.bz-notice--in-shake {
  animation: bzNoticeShake 0.4s ease-out;
}
.bz-notice-icon {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bz-notice-icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.bz-notice--success .bz-notice-icon path {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  animation: bzNoticeDraw 0.35s ease-out 0.1s forwards;
}
.bz-notice-icon {
  animation: bzNoticeIconPop 0.3s ease-out;
}
.bz-notice--warning .bz-notice-icon { color: var(--color-orange); }
.bz-notice--error .bz-notice-icon { color: var(--color-red); }
.bz-notice--info .bz-notice-icon { color: var(--interactive-accent); }
.bz-notice--progress .bz-notice-icon { color: var(--interactive-accent); }
.bz-notice--progress .bz-notice-icon svg {
  animation: bzNoticeSpin 1s linear infinite;
}
.bz-notice-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bz-notice-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}
.bz-notice-msg {
  word-break: break-word;
  white-space: pre-line;
}
.bz-notice-action {
  flex: 0 0 auto;
  margin-top: 1px;
  padding: 2px 10px;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
  color: var(--interactive-accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.bz-notice-action:hover {
  background: var(--background-modifier-hover);
}
.bz-notice-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: 0;
  background: var(--interactive-accent);
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.25) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.25) 50%,
    rgba(255, 255, 255, 0.25) 75%,
    transparent 75%
  );
  background-size: 16px 16px;
  animation: bzNoticeStripes 0.8s linear infinite;
  transition: width 0.3s ease;
}
.bz-notice-progress--done {
  background: var(--color-green);
  animation: none;
}
.bz-notice-progress--indeterminate {
  width: 40% !important;
  animation: bzNoticeIndeterminate 1.2s ease-in-out infinite;
}
@keyframes bzNoticeIn {
  from { opacity: 0; transform: translateY(-14px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bzNoticeInPop {
  from { opacity: 0; transform: scale(0.88); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes bzNoticeInLeft {
  from { opacity: 0; transform: translateX(-48px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes bzNoticeInRight {
  from { opacity: 0; transform: translateX(48px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes bzNoticeInBounce {
  0% { opacity: 0; transform: translateY(-26px) scale(0.95); }
  60% { opacity: 1; transform: translateY(5px) scale(1.02); }
  80% { transform: translateY(-3px); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes bzNoticeShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(7px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
@keyframes bzNoticeDraw {
  to { stroke-dashoffset: 0; }
}
@keyframes bzNoticeIconPop {
  0% { transform: scale(0.5); }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
@keyframes bzNoticeStripes {
  from { background-position: 0 0; }
  to { background-position: 16px 0; }
}
@keyframes bzNoticeOut {
  to { opacity: 0; transform: translateY(-14px); }
}
@keyframes bzNoticeOutPop {
  to { opacity: 0; transform: scale(0.88); }
}
@keyframes bzNoticeOutLeft {
  to { opacity: 0; transform: translateX(-48px); }
}
@keyframes bzNoticeOutRight {
  to { opacity: 0; transform: translateX(48px); }
}
@keyframes bzNoticeOutFade {
  to { opacity: 0; }
}
@keyframes bzNoticeSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes bzNoticeIndeterminate {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}
@media (prefers-reduced-motion: reduce) {
  .bz-notice,
  .bz-notice--leaving,
  .bz-notice--leaving.bz-notice--out-pop,
  .bz-notice--leaving.bz-notice--out-left,
  .bz-notice--leaving.bz-notice--out-right,
  .bz-notice--leaving.bz-notice--out-fade,
  .bz-notice--in-pop,
  .bz-notice--in-slide-left,
  .bz-notice--in-slide-right,
  .bz-notice--in-bounce,
  .bz-notice--in-shake {
    animation: bzNoticeFade 0.15s ease-out;
  }
  .bz-notice--progress .bz-notice-icon svg {
    animation: none;
  }
  .bz-notice-progress,
  .bz-notice-progress--done {
    animation: none;
  }
  .bz-notice--success .bz-notice-icon path {
    animation: none;
    stroke-dashoffset: 0;
  }
  .bz-notice-icon {
    animation: none;
  }
}
@keyframes bzNoticeFade {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

const ICONS: Record<NoticeType, string> = {
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12" y2="8"/>',
  success: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  warning: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/>',
  error: '<circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>',
};

function defaultDuration(type: NoticeType): number {
  return type === 'error' ? 5000 : 3000;
}

function ensureContainer(): HTMLElement {
  if (!document.querySelector('style[data-shared-style="' + STYLE_ID + '"]')) {
    const s = document.createElement('style');
    s.setAttribute('data-shared-style', STYLE_ID);
    s.textContent = NOTICE_CSS;
    document.head.appendChild(s);
  }
  let container = document.getElementById('bz-notice-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'bz-notice-container';
    document.body.appendChild(container);
  }
  return container;
}

interface InternalNotice {
  el: HTMLElement;
  timer: number | null;
  msgEl: HTMLElement;
  progressEl: HTMLElement | null;
  iconEl: HTMLElement;
  variant: NoticeVariant;
  isProgress: boolean;
}

/** 当前存活通知（最旧在前），用于堆叠上限挤兑 */
const live: InternalNotice[] = [];

/** dedupeKey → 最近一次触发记录（窗口内重复触发合并） */
const recent: Record<string, { at: number; n: InternalNotice | null }> = {};

function removeInternal(n: InternalNotice): void {
  if (n.timer !== null) {
    window.clearTimeout(n.timer);
    n.timer = null;
  }
  const i = live.indexOf(n);
  if (i !== -1) live.splice(i, 1);
  if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
}

function evictOldest(): void {
  while (live.length >= MAX_VISIBLE) {
    const oldest = live[0];
    // 最旧通知直接移除（不播退出动画，保证不刷屏）
    removeInternal(oldest);
  }
}

/** 空操作 handle：去重窗口内重复触发时返回（调用方安全调用 setMessage/setType/hide） */
function noopHandle(): NoticeHandle {
  return {
    el: document.createElement('div'),
    setMessage(): void {},
    setProgress(): void {},
    setType(): void {},
    hide(): void {},
  };
}

export function notify(msg: string, opts?: NoticeOptions): NoticeHandle {
  const kind: NoticeKind = (opts && opts.type) || 'info';
  const isProgress = kind === 'progress';
  const type: NoticeType = isProgress ? 'info' : kind;
  const variant: NoticeVariant =
    (opts && opts.variant) || DEFAULT_VARIANT[type];
  const container = ensureContainer();

  // 去重：窗口内同键重复触发 → 合并更新消息，不新弹
  if (opts && opts.dedupeKey) {
    const key = opts.dedupeKey;
    const r = recent[key];
    const now = Date.now();
    if (r && now - r.at < DEDUPE_WINDOW_MS) {
      if (r.n && r.n.el.isConnected) r.n.msgEl.textContent = msg;
      return noopHandle();
    }
    recent[key] = { at: now, n: null };
  }

  evictOldest();

  const el = document.createElement('div');
  el.className = 'bz-notice bz-notice--' + type + ' bz-notice--in-' + variant;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  // 图标
  const icon = document.createElement('div');
  icon.className = 'bz-notice-icon';
  if (isProgress) {
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>';
  } else {
    icon.innerHTML = '<svg viewBox="0 0 24 24">' + ICONS[type] + '</svg>';
  }
  el.appendChild(icon);

  // 正文（title 可选）
  const body = document.createElement('div');
  body.className = 'bz-notice-body';
  if (opts && opts.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'bz-notice-title';
    titleEl.textContent = opts.title;
    body.appendChild(titleEl);
  }
  const msgEl = document.createElement('div');
  msgEl.className = 'bz-notice-msg';
  msgEl.textContent = msg;
  body.appendChild(msgEl);
  el.appendChild(body);

  // 操作按钮（可选）
  if (opts && opts.action) {
    const btn = document.createElement('button');
    btn.className = 'bz-notice-action';
    btn.textContent = opts.action.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cb = opts && opts.action ? opts.action.onClick : null;
      if (cb) cb();
      hideNow();
    });
    el.appendChild(btn);
  }

  // 进度条（progress 类型）
  let progressEl: HTMLElement | null = null;
  if (isProgress) {
    progressEl = document.createElement('div');
    progressEl.className = 'bz-notice-progress';
    el.appendChild(progressEl);
  }

  // 点击本体关闭
  el.addEventListener('click', () => hideNow());

  container.appendChild(el);

  const n: InternalNotice = { el, timer: null, msgEl, progressEl, iconEl: icon, variant, isProgress };
  live.push(n);
  // 记录去重引用（同键窗口内重复触发时更新消息）
  if (opts && opts.dedupeKey) {
    const r = recent[opts.dedupeKey];
    if (r) r.n = n;
  }

  // 自动消失：progress 类型默认不自动消失，其余按类型默认（显式 duration 优先）
  if (!isProgress) {
    const dur =
      (opts && opts.duration) || defaultDuration(type);
    n.timer = window.setTimeout(() => hideNow(), dur);
  } else if (opts && opts.duration) {
    n.timer = window.setTimeout(() => hideNow(), opts.duration);
  }

  function hideNow(): void {
    if (n.timer !== null) {
      window.clearTimeout(n.timer);
      n.timer = null;
    }
    if (!n.el.classList.contains('bz-notice--leaving')) {
      n.el.classList.add('bz-notice--leaving');
      const out = OUT_CLASS[n.variant];
      if (out) n.el.classList.add(out);
      window.setTimeout(() => removeInternal(n), LEAVE_MS);
    }
  }

  /** 启动/停止自动消失计时（setType 切换时接管） */
  function armTimer(newType: NoticeKind, isProgressNow: boolean, explicitDuration?: number): void {
    if (n.timer !== null) {
      window.clearTimeout(n.timer);
      n.timer = null;
    }
    if (!isProgressNow) {
      const dur = explicitDuration || defaultDuration(newType as NoticeType);
      n.timer = window.setTimeout(() => hideNow(), dur);
    }
  }

  return {
    el,
    setMessage(text: string): void {
      n.msgEl.textContent = text;
    },
    setType(t: NoticeKind): void {
      const isProgressNow = t === 'progress';
      // 类型类名：五选一（先清全部再添加，防多次切换残留）
      n.el.classList.remove('bz-notice--info', 'bz-notice--success', 'bz-notice--warning', 'bz-notice--error', 'bz-notice--progress');
      n.el.classList.add('bz-notice--' + (isProgressNow ? 'progress' : t));
      // 图标
      n.iconEl.innerHTML = isProgressNow
        ? '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>'
        : '<svg viewBox="0 0 24 24">' + ICONS[t as NoticeType] + '</svg>';
      n.isProgress = isProgressNow;
      armTimer(t, isProgressNow, undefined);
    },
    setProgress(pct: number): void {
      if (!n.progressEl) return;
      if (pct === -1) {
        n.progressEl.classList.add('bz-notice-progress--indeterminate');
        return;
      }
      n.progressEl.classList.remove('bz-notice-progress--indeterminate');
      const clamped = Math.max(0, Math.min(100, pct));
      n.progressEl.style.width = clamped + '%';
      // 完成态：进度条变绿
      if (clamped >= 100) n.progressEl.classList.add('bz-notice-progress--done');
      else n.progressEl.classList.remove('bz-notice-progress--done');
    },
    hide(): void {
      hideNow();
    },
  };
}
