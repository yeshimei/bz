/**
 * 通知系统（ticket 25）——自绘 toast，替代 Obsidian 原生 Notice。
 *
 * 设计决策（grilling 会话敲定 + 修订）：
 * - 位置：桌面端右上角、从右侧滑入；移动端（max-width 768px）顶部居中、从上往下
 * - 堆叠 + 上限 5 条（超出挤掉最旧；常驻帧 duration<=0 / progress 默认不参与驱逐——P1-33：
 *   连续任务的常驻句柄不会被后续 toast 挤掉，setMessage/setType 始终有效）
 * - 类型图标用 emoji（info ℹ️ / success ✅ / warning ⚠️ / error ❌ / pause ⏸️ / accept ✨ /
 *   delete 🗑️ / confirm ✓ / restore ↩️ / skip 🚫 / archive 📁 / progress 转圈）；
 *   类型由调用方显式指定（notice(msg, type)），不做消息内容自动归类
 * - 通知文案规范（2026-08-1x 用户决策）：消息正文一律不带 emoji 前缀（类型图标即视觉前缀，重复）
 * - 新增通知类型规范：新语义先查下方 ICONS 表——已有类型直接用；确无匹配再新增
 *   （加 ICONS 项 + 颜色 class + 默认时长，progress 除外）；不得把 emoji 写进消息正文
 * - dedupeKey：同键且通知存活 → 原地合并更新消息并重置计时（连续任务单框语义）；
 *   已消失后 30s 窗口内同键不重复弹（防后台自动事件刷屏）
 * - duration <= 0 = 常驻不自动消失（连续任务配合 setMessage/setType 使用）
 * - 动态能力：setMessage（原地更新文本）/ setProgress（0-100 或 -1 不确定态）
 * - 富文本：title 标题行 + action 操作按钮（点击后自动收起）
 * - 时长：默认 info/success/warning 3s、error 5s；显式 duration 优先；
 *   未指定时按文字长度动态计算（≤20 字用默认值，>20 字每多 1 字加 60ms，上限 15s）；
 *   progress 类型默认不自动消失（调用方控制）
 * - 点击通知本体即关闭
 * - z-index 动态发号（ADR-0067）：每次弹出抬顶容器——toast 永远盖过最新打开的 overlay
 */
import { allocZ } from './z-order';

export type NoticeType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'pause'
  | 'accept'
  | 'delete'
  | 'confirm'
  | 'restore'
  | 'skip'
  | 'archive';
/** 通知类型：常规类型 + progress（进度条形态，默认不自动消失） */
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
const LEAVE_MS = 200;
/** 去重窗口：同 dedupeKey 的通知已消失后，在此窗口内重复触发不新弹 */
const DEDUPE_WINDOW_MS = 30000;
/** 移动端断点（项目惯例 max-width: 768px） */
const MOBILE_QUERY = '(max-width: 768px)';

/**
 * 类型 → 图标 emoji（progress 用转圈 SVG，见 SPINNER_SVG）。
 * 新增类型规范：此处加图标 + CSS 颜色 class + 默认时长（defaultDuration 非 error 均 3s）。
 */
const ICONS: Record<NoticeType, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  pause: '⏸️',
  accept: '✨',
  delete: '🗑️',
  confirm: '✓',
  restore: '↩️',
  skip: '🚫',
  archive: '📁',
};

const SPINNER_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>';

/**
 * 便捷 API：显式指定类型（不做消息内容自动归类）；
 * 不传类型默认 info；duration <= 0 常驻不自动消失。
 */
export function notice(msg: string, type?: NoticeType, duration?: number): void {
  notify(msg, { type: type || 'info', duration });
}

/** 撤销型通知默认停留时长：比常规 toast 长，给用户足够的反悔窗口 */
const UNDO_DURATION_MS = 6000;

/**
 * 撤销型通知（ticket 141 通病 1）：删除/移出/跳过类操作落地后，给 toast 挂「撤销」按钮，
 * 点击执行回滚回调。把「此操作不可撤销」的事前威慑改成「已删除 + 可反悔」的事后兜底。
 * 默认 delete 类型（🗑️）、6s 停留；跳过/归档等语义由调用方显式传 type。
 */
export function notifyUndo(
  msg: string,
  onUndo: () => void,
  opts?: { type?: NoticeType; duration?: number }
): NoticeHandle {
  return notify(msg, {
    type: (opts && opts.type) || 'delete',
    duration: opts && opts.duration !== undefined ? opts.duration : UNDO_DURATION_MS,
    action: { label: '撤销', onClick: onUndo },
  });
}

/**
 * 写盘失败统一提示（ticket 141 通病 2）：数据域裸 await 的保存调用失败时的人话错误 toast。
 * 以前静默吞掉的 unhandled rejection 改走这里——用户改了但没存上，必须知道。
 */
export function notifySaveError(err: unknown, what?: string): void {
  const msg = err instanceof Error ? err.message : String(err);
  notify(what ? `保存失败（${what}）：${msg}` : `保存失败：${msg}`, { type: 'error' });
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

function defaultDuration(type: NoticeType): number {
  return type === 'error' ? 5000 : 3000;
}

/** 基础阅读速度：每字符约 60ms（中英文混合均值）；短文本用 base 兜底 */
const PER_CHAR_MS = 60;
/** 低于此字符数不加时长，直接用 base */
const SHORT_THRESHOLD = 20;

/**
 * 根据文字长度动态计算停留时间。
 * 公式：base + max(0, len - 20) × 60ms，上限 15s 防止过长。
 * 调用方显式指定 duration 时直接用显式值，不走此函数。
 */
function calcDuration(text: string, base: number): number {
  const len = text.length;
  if (len <= SHORT_THRESHOLD) return base;
  const extra = (len - SHORT_THRESHOLD) * PER_CHAR_MS;
  return Math.min(base + extra, 15000);
}

function ensureContainer(): HTMLElement {
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
  /** 常驻帧（无自动消失计时且语义为常驻）：堆叠挤兑时不被驱逐（P1-33）；随 armTimer 更新 */
  persistent: boolean;
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
  // 为即将入栈的新通知腾位：最多驱逐「超员数 + 1」条最旧的可驱逐帧。
  // 常驻帧跳过不驱逐（P1-33）；配额封顶防止常驻帧滞留时循环吞掉全部普通帧。
  let quota = live.length - MAX_VISIBLE + 1;
  for (let i = 0; quota > 0 && i < live.length; ) {
    const candidate = live[i];
    if (candidate.persistent) {
      i++;
      continue;
    }
    // 最旧通知直接移除（不播退出动画，保证不刷屏）
    removeInternal(candidate);
    quota--;
  }
}

/** 按类型更新元素类名与图标（创建/合并/setType 共用） */
function applyTypeToEl(n: InternalNotice, kind: NoticeKind): void {
  const isProgressNow = kind === 'progress';
  // 类型类名：全部清掉再添加（防多次切换残留）
  n.el.classList.remove(
    'bz-notice--info',
    'bz-notice--success',
    'bz-notice--warning',
    'bz-notice--error',
    'bz-notice--pause',
    'bz-notice--accept',
    'bz-notice--delete',
    'bz-notice--confirm',
    'bz-notice--restore',
    'bz-notice--skip',
    'bz-notice--archive',
    'bz-notice--progress'
  );
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

/**
 * 按类型/显式 duration 设定自动消失计时。
 * - 显式 duration 优先
 * - 未指定时根据文字长度动态计算（短文本用类型默认值，长文本按字数加时）
 * - duration <= 0 或 progress 默认 = 常驻（persistent，不参与堆叠驱逐）
 */
function armTimer(n: InternalNotice, kind: NoticeKind, explicitDuration?: number, text?: string): void {
  if (n.timer !== null) {
    window.clearTimeout(n.timer);
    n.timer = null;
  }
  n.persistent = false;
  if (kind === 'progress') {
    // progress 默认常驻；显式 duration > 0 才计时
    if (explicitDuration !== undefined && explicitDuration > 0) {
      n.timer = window.setTimeout(() => hideNow(n), explicitDuration);
    } else {
      n.persistent = true;
    }
    return;
  }
  const base = defaultDuration(kind);
  const dur = explicitDuration !== undefined ? explicitDuration : (text ? calcDuration(text, base) : base);
  if (dur <= 0) {
    n.persistent = true; // <= 0 = 常驻
    return;
  }
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

/**
 * 插件卸载清理（UX 整改 l2-toast，main.ts onunload 调用）：
 * 清空容器 DOM + 存活/去重状态（语义同 __resetNoticeForTests，正式版出口），
 * 随后移除通知容器节点；幂等，可重复调用。
 */
export function cleanupNotices(): void {
  for (const n of live.splice(0)) {
    if (n.timer !== null) {
      window.clearTimeout(n.timer);
      n.timer = null;
    }
    if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
  }
  for (const k of Object.keys(recent)) delete recent[k];
  const container = document.getElementById('bz-notice-container');
  if (container && container.parentNode) container.parentNode.removeChild(container);
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
      armTimer(r.n, kind, opts.duration, msg);
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

  const n: InternalNotice = { el, timer: null, msgEl, progressEl, iconEl: icon, variant, isProgress, persistent: false };

  // 操作按钮（可选；span 而非 button——Obsidian 核心 button 默认 height: var(--input-height) 会把通知框撑高）
  if (opts && opts.action) {
    const btn = document.createElement('span');
    btn.className = 'bz-notice-action';
    btn.setAttribute('role', 'button');
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

  // 抬顶（ADR-0067）：toast 与 overlay 共享动态层级空间，弹出时重发号保证永远可见
  container.style.zIndex = String(allocZ());
  container.appendChild(el);

  live.push(n);
  // 记录去重引用（同键重复触发时原地更新消息）
  if (opts && opts.dedupeKey) {
    const r = recent[opts.dedupeKey];
    if (r) r.n = n;
  }

  // 自动消失计时（无显式 duration 时按文字长度动态计算）
  const fullText = (opts && opts.title ? opts.title + ' ' : '') + msg;
  armTimer(n, kind, opts && opts.duration, fullText);

  return {
    el,
    setMessage(text: string): void {
      n.msgEl.textContent = text;
    },
    setType(t: NoticeKind): void {
      applyTypeToEl(n, t);
      // 重排计时（UX 整改 16）：传入当前正文，progress→success 等长文案按 60ms/字
      // 动态显示，不再固定 3s；显式 duration 优先规则不变
      armTimer(n, t, undefined, n.msgEl.textContent || undefined);
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
