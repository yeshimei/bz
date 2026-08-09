/**
 * 通知系统（ticket 25）——自绘 toast，替代 Obsidian 原生 Notice。
 *
 * 设计决策（grilling 会话敲定 + 修订）：
 * - 位置：桌面端右上角、从右侧滑入；移动端（max-width 768px）顶部居中、从上往下
 * - 堆叠 + 上限 5 条（超出挤掉最旧）
 * - z-index 100000（最顶，盖过 Obsidian 全部 UI 层）
 * - 类型图标用 emoji（info ℹ️ / success ✅ / warning ⚠️ / error ❌ / progress 转圈）；
 *   类型由调用方显式指定（notice(msg, type)），不做消息内容自动归类
 * - dedupeKey：同键且通知存活 → 原地合并更新消息并重置计时（连续任务单框语义）；
 *   已消失后 30s 窗口内同键不重复弹（防后台自动事件刷屏）
 * - duration <= 0 = 常驻不自动消失（连续任务配合 setMessage/setType 使用）
 * - 动态能力：setMessage（原地更新文本）/ setProgress（0-100 或 -1 不确定态）
 * - 富文本：title 标题行 + action 操作按钮（点击后自动收起）
 * - 时长：默认 info/success/warning 3s、error 5s；显式 duration 优先；
 *   progress 类型默认不自动消失（调用方控制）
 * - 点击通知本体即关闭
 */
export type NoticeType = 'info' | 'success' | 'warning' | 'error';
/** 通知类型：四种常规类型 + progress（进度条形态，默认不自动消失） */
export type NoticeKind = NoticeType | 'progress';

/** 进入/退出动画变体（默认：桌面 slide-right 右侧滑入；移动端 drop 顶部下滑） */
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
  /** 显示时长 ms；不传按类型默认（info/success/warning 3000，error 5000）；<= 0 = 常驻；progress 默认不自动消失 */
  duration?: number;
  /** 富文本标题行（可选） */
  title?: string;
  /** 操作按钮（点击后执行回调并收起通知） */
  action?: NoticeAction;
  /** 动画变体（默认：桌面 slide-right，移动端 drop） */
  variant?: NoticeVariant;
  /** 去重键：同键通知存活时合并更新消息不新弹；已消失后 30s 窗口内也不重复弹（防后台自动事件刷屏） */
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
/** 去重窗口：同 dedupeKey 的通知已消失后，在此窗口内重复触发不新弹 */
const DEDUPE_WINDOW_MS = 30000;
/** 移动端断点（项目惯例 max-width: 768px） */
const MOBILE_QUERY = '(max-width: 768px)';

/** 类型 → 图标 emoji（progress 用转圈 SVG，见 SPINNER_SVG） */
const ICONS: Record<NoticeType, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

const SPINNER_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>';

/**
 * 便捷 API：显式指定类型（不做消息内容自动归类）；
 * 不传类型默认 info；duration <= 0 常驻不自动消失。
 */
export function notice(msg: string, type?: NoticeType, duration?: number): void {
  notify(msg, { type: type || 'info', duration });
}

/** 当前视口是否为移动端（决定默认位置/动画：移动端顶部居中，桌面右侧弹出） */
function isMobileView(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_QUERY).matches
  );
}

/** 默认动效变体：桌面右侧滑入；移动端顶部下滑（保证全站位置/动效一致） */
function defaultVariant(): NoticeVariant {
  return isMobileView() ? 'drop' : 'slide-right';
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
  right: 16px;
  z-index: 100000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
  width: max-content;
  max-width: calc(100vw - 24px);
}
/* 移动端：顶部居中 + Obsidian 顶部栏更高，通知下移（项目断点惯例 max-width: 768px） */
@media (max-width: 768px) {
  #bz-notice-container {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    align-items: center;
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
  width: 20px;
  height: 20px;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  animation: bzNoticeIconPop 0.3s ease-out;
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
  /* progress 转圈保留：加载指示属功能性动画，reduced-motion 下不降级
     （Windows 关闭动画效果时 Chromium 报 prefers-reduced-motion: reduce，若禁用则圆圈静态误导用户） */
  .bz-notice-progress,
  .bz-notice-progress--done {
    animation: none;
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

/** dedupeKey → 最近一次触发记录（存活通知引用 + 上次触发时间） */
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

/** 按类型更新元素类名与图标（创建/合并/setType 共用） */
function applyTypeToEl(n: InternalNotice, kind: NoticeKind): void {
  const isProgressNow = kind === 'progress';
  // 类型类名：五选一（先清全部再添加，防多次切换残留）
  n.el.classList.remove('bz-notice--info', 'bz-notice--success', 'bz-notice--warning', 'bz-notice--error', 'bz-notice--progress');
  n.el.classList.add('bz-notice--' + (isProgressNow ? 'progress' : kind));
  // 图标（emoji；progress 转圈）
  n.iconEl.innerHTML = '';
  if (isProgressNow) {
    n.iconEl.innerHTML = SPINNER_SVG;
  } else {
    n.iconEl.textContent = ICONS[kind as NoticeType];
  }
  n.isProgress = isProgressNow;
}

/** 关闭通知（带退出动画）；重复调用幂等 */
function hideNow(n: InternalNotice): void {
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

/** 按类型/显式 duration 设定自动消失计时；duration <= 0 或 progress 默认 = 常驻 */
function armTimer(n: InternalNotice, kind: NoticeKind, explicitDuration?: number): void {
  if (n.timer !== null) {
    window.clearTimeout(n.timer);
    n.timer = null;
  }
  if (kind === 'progress') {
    // progress 默认常驻；显式 duration > 0 才计时
    if (explicitDuration !== undefined && explicitDuration > 0) {
      n.timer = window.setTimeout(() => hideNow(n), explicitDuration);
    }
    return;
  }
  const dur = explicitDuration !== undefined ? explicitDuration : defaultDuration(kind);
  if (dur <= 0) return; // <= 0 = 常驻
  n.timer = window.setTimeout(() => hideNow(n), dur);
}

/**
 * 测试专用：清空存活通知与去重记录（测试隔离用；DOM 清理由 clearNotices 负责）。
 * 不重置会跨测试残留 dedupeKey 抑制窗口（30s），导致后续同键通知不弹出。
 */
export function __resetNoticeForTests(): void {
  live.length = 0;
  for (const k of Object.keys(recent)) delete recent[k];
}

/** 空操作 handle：去重合并时返回（调用方安全调用 setMessage/setType/hide） */
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
    (opts && opts.variant) || defaultVariant();
  const container = ensureContainer();

  // 去重：同键通知存活 → 原地合并更新消息并重置计时（连续任务单框）；
  // 已消失但 30s 窗口内 → 不新弹（防刷屏）
  if (opts && opts.dedupeKey) {
    const key = opts.dedupeKey;
    const r = recent[key];
    const now = Date.now();
    if (r && r.n && r.n.el.isConnected) {
      r.n.msgEl.textContent = msg;
      // 类型变化（如 progress 完成 → success）时同步切换图标/配色
      if (r.n.isProgress !== isProgress || r.n.el.classList.contains('bz-notice--' + type) === false) {
        applyTypeToEl(r.n, kind);
      }
      armTimer(r.n, kind, opts.duration);
      return noopHandle();
    }
    if (r && now - r.at < DEDUPE_WINDOW_MS) {
      return noopHandle();
    }
    recent[key] = { at: now, n: null };
  }

  evictOldest();

  const el = document.createElement('div');
  el.className = 'bz-notice bz-notice--' + (isProgress ? 'progress' : type) + ' bz-notice--in-' + variant;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  // 图标（emoji 类型图标；progress 转圈）
  const icon = document.createElement('div');
  icon.className = 'bz-notice-icon';
  if (isProgress) {
    icon.innerHTML = SPINNER_SVG;
  } else {
    icon.textContent = ICONS[type];
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

  // 进度条（progress 类型）
  let progressEl: HTMLElement | null = null;
  if (isProgress) {
    progressEl = document.createElement('div');
    progressEl.className = 'bz-notice-progress';
    el.appendChild(progressEl);
  }

  const n: InternalNotice = { el, timer: null, msgEl, progressEl, iconEl: icon, variant, isProgress };

  // 操作按钮（可选）
  if (opts && opts.action) {
    const btn = document.createElement('button');
    btn.className = 'bz-notice-action';
    btn.textContent = opts.action.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cb = opts && opts.action ? opts.action.onClick : null;
      if (cb) cb();
      hideNow(n);
    });
    el.appendChild(btn);
  }

  // 点击本体关闭
  el.addEventListener('click', () => hideNow(n));

  container.appendChild(el);

  live.push(n);
  // 记录去重引用（同键重复触发时原地更新消息）
  if (opts && opts.dedupeKey) {
    const r = recent[opts.dedupeKey];
    if (r) r.n = n;
  }

  // 自动消失计时
  armTimer(n, kind, opts && opts.duration);

  return {
    el,
    setMessage(text: string): void {
      n.msgEl.textContent = text;
    },
    setType(t: NoticeKind): void {
      applyTypeToEl(n, t);
      armTimer(n, t);
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
      hideNow(n);
    },
  };
}
