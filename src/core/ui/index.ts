/* ============================================================
 * bz 组件库（src/core/ui/）
 * 在样式库（tokens.css + components.css）之上，提供"带功能"的
 * 组件工厂：选项对象 + 命名导出纯函数 + 句柄/回调（对齐
 * core 既有 notice/flow-dialog/item-actions 风格）。
 *
 * 命名：bz 组件库函数带 ui 前缀（uiBtn / uiChip / uiIcon…），
 * 避免与既有 createIconBtn（dom.ts，文本式旧工厂）冲突。
 * DOM：createElement + BEM 类名拼接 + textContent 防注入；
 * 图标：调用方传 lucide 图标名，由本库生成 <i data-lucide>。
 * ============================================================ */

/* ═══════════ 类型 ═══════════ */
export type BzTone = 'default' | 'primary' | 'danger' | 'ghost';
export type BzSize = 'sm' | 'md' | 'lg';
export type BzIconName = string; // lucide 图标名

export interface BzButtonOpts {
  label?: string;          // 文字
  icon?: BzIconName;       // lucide 图标名
  tone?: BzTone;
  size?: BzSize;
  title?: string;          // tooltip
  disabled?: boolean;
  danger?: boolean;        // 图标红（icon-btn 用）
  className?: string;      // 附加类
  onClick?: () => void;
}

export interface BzChipOpts {
  label: string;
  icon?: BzIconName;
  count?: number;          // 徽标计数
  selected?: boolean;      // --on
  removable?: boolean;     // 带 ✕
  locked?: boolean;        // 锁定虚线
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export interface BzFieldOpts {
  label?: string;
  desc?: string;           // 说明
  error?: string;          // 错误态文字
  control: HTMLElement;    // 已建好的控件（input/select…）
}

export interface BzEmptyOpts {
  icon?: BzIconName;
  title: string;
  desc?: string;
  actions?: HTMLElement;   // 按钮行容器（.bz-btn-row）
}

export interface BzSegOpts<T extends string = string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/* ═══════════ 工具：lucide 图标元素 ═══════════ */
/** 生成 lucide 图标 <i>（Obsidian 用 lucide 图标库，调用方确保 createIcons 已跑） */
export function uiIcon(name: BzIconName, extraClass = ''): HTMLElement {
  const i = document.createElement('i');
  i.className = `bz-ic${extraClass ? ' ' + extraClass : ''}`;
  i.setAttribute('data-lucide', name);
  return i;
}

/* ═══════════ 按钮 ═══════════ */
/** 通用按钮（.bz-btn），样式库规格由 components.css 提供 */
export function uiBtn(opts: BzButtonOpts): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  const cls = ['bz-btn'];
  if (opts.tone && opts.tone !== 'default') cls.push(`bz-btn--${opts.tone}`);
  if (opts.size && opts.size !== 'md') cls.push(`bz-btn--${opts.size}`);
  if (opts.className) cls.push(opts.className);
  b.className = cls.join(' ');
  if (opts.title) b.title = opts.title;
  if (opts.disabled) b.disabled = true;
  if (opts.icon) b.appendChild(uiIcon(opts.icon));
  if (opts.label) {
    const span = document.createElement('span');
    span.textContent = opts.label;
    b.appendChild(span);
  }
  if (opts.onClick) b.addEventListener('click', opts.onClick);
  return b;
}

/** 按钮行容器（.bz-btn-row，右对齐） */
export function uiBtnRow(buttons: HTMLElement[], opts?: { center?: boolean; grow?: boolean }): HTMLDivElement {
  const row = document.createElement('div');
  const cls = ['bz-btn-row'];
  if (opts?.center) cls.push('bz-btn-row--center');
  if (opts?.grow) cls.push('bz-btn-row--grow');
  row.className = cls.join(' ');
  buttons.forEach((x) => row.appendChild(x));
  return row;
}

/** 图标按钮（.bz-icon-btn，无文字小按钮） */
export function uiIconBtn(opts: { icon: BzIconName; title?: string; on?: boolean; lg?: boolean; xs?: boolean; close?: boolean; danger?: boolean; disabled?: boolean; onClick?: () => void; className?: string }): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  const cls = ['bz-icon-btn'];
  if (opts.on) cls.push('bz-icon-btn--on');
  if (opts.lg) cls.push('bz-icon-btn--lg');
  if (opts.xs) cls.push('bz-icon-btn--xs');
  if (opts.close) cls.push('bz-icon-btn--close');
  if (opts.className) cls.push(opts.className);
  b.className = cls.join(' ');
  if (opts.title) b.title = opts.title;
  if (opts.disabled) b.disabled = true;
  if (opts.danger) b.setAttribute('data-danger', '');
  b.appendChild(uiIcon(opts.icon));
  if (opts.onClick) b.addEventListener('click', opts.onClick);
  return b;
}

/** 弹窗底部主/次按钮对（取消 + 确认），返回 [row, cancelBtn, okBtn] */
export function uiDialogActions(opts: {
  cancelText?: string;
  okText: string;
  okTone?: 'primary' | 'danger';
  onCancel?: () => void;
  onOk: () => void;
}): { row: HTMLDivElement; cancelBtn: HTMLButtonElement; okBtn: HTMLButtonElement } {
  const cancel = uiBtn({ label: opts.cancelText || '取消', onClick: opts.onCancel });
  const ok = uiBtn({ label: opts.okText, tone: opts.okTone || 'primary', onClick: opts.onOk });
  const row = uiBtnRow([cancel, ok]);
  return { row, cancelBtn: cancel, okBtn: ok };
}

/* ═══════════ Chip ═══════════ */
/** 胶囊 chip（筛选/标签），带选中/锁定/计数/可删 */
export function uiChip(opts: BzChipOpts): HTMLButtonElement {
  const c = document.createElement('button');
  c.type = 'button';
  const cls = ['bz-chip'];
  if (opts.selected) cls.push('bz-chip--on');
  else if (opts.removable) cls.push('bz-chip--sel');
  if (opts.locked) cls.push('bz-chip--locked');
  c.className = cls.join(' ');
  if (opts.title) c.title = opts.title;
  if (opts.disabled) c.disabled = true;
  if (opts.icon) c.appendChild(uiIcon(opts.icon));
  const label = document.createElement('span');
  label.textContent = opts.label;
  c.appendChild(label);
  if (typeof opts.count === 'number') {
    const cnt = document.createElement('span');
    cnt.className = 'bz-chip-cnt';
    cnt.textContent = String(opts.count);
    c.appendChild(cnt);
  }
  if (opts.removable && !opts.locked) {
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'bz-chip-x';
    x.appendChild(uiIcon('x'));
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onRemove?.();
    });
    c.appendChild(x);
  }
  if (opts.onClick) c.addEventListener('click', () => opts.onClick?.());
  return c;
}

/* ═══════════ 表单字段 ═══════════ */
/** 字段行（label + 控件 + desc/error），对照 settings 行 */
export function uiField(opts: BzFieldOpts): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.className = 'bz-field';
  if (opts.label) {
    const l = document.createElement('span');
    l.className = 'bz-field-label';
    l.textContent = opts.label;
    wrap.appendChild(l);
  }
  wrap.appendChild(opts.control);
  if (opts.error) {
    opts.control.classList.add('bz-input--error');
    const e = document.createElement('span');
    e.className = 'bz-field-error';
    e.textContent = opts.error;
    wrap.appendChild(e);
  } else if (opts.desc) {
    const d = document.createElement('span');
    d.className = 'bz-field-desc';
    d.textContent = opts.desc;
    wrap.appendChild(d);
  }
  return wrap;
}

/** 文本输入（.bz-input） */
export function uiInput(opts: {
  type?: 'text' | 'password' | 'number' | 'date';
  placeholder?: string;
  value?: string;
  error?: boolean;
  disabled?: boolean;
  onInput?: (value: string) => void;
}): HTMLInputElement {
  const inp = document.createElement('input');
  inp.className = 'bz-input' + (opts.error ? ' bz-input--error' : '');
  inp.type = opts.type || 'text';
  if (opts.placeholder) inp.placeholder = opts.placeholder;
  if (opts.value !== undefined) inp.value = opts.value;
  if (opts.disabled) inp.disabled = true;
  if (opts.onInput) inp.addEventListener('input', () => opts.onInput?.(inp.value));
  return inp;
}

/* ═══════════ 空态 ═══════════ */
/** 空态（图标 + 标题 + 描述 + CTA），对齐手册 §8.3 */
export function uiEmpty(opts: BzEmptyOpts): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'bz-empty';
  if (opts.icon) {
    const ic = uiIcon(opts.icon);
    ic.classList.add('bz-empty-ic');
    el.appendChild(ic);
  }
  const t = document.createElement('div');
  t.className = 'bz-empty-title';
  t.textContent = opts.title;
  el.appendChild(t);
  if (opts.desc) {
    const d = document.createElement('div');
    d.className = 'bz-empty-desc';
    d.textContent = opts.desc;
    el.appendChild(d);
  }
  if (opts.actions) el.appendChild(opts.actions);
  return el;
}

/* ═══════════ 分段控件 ═══════════ */
/** 分段（单选多段），返回容器 + setValue 句柄 */
export function uiSegmented<T extends string>(opts: BzSegOpts<T>): { el: HTMLDivElement; setValue: (v: T) => void } {
  const el = document.createElement('div');
  el.className = 'bz-segmented' + (opts.className ? ' ' + opts.className : '');
  const btns = new Map<T, HTMLButtonElement>();
  opts.options.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bz-segmented-btn' + (o.value === opts.value ? ' is-on' : '');
    b.textContent = o.label;
    b.addEventListener('click', () => { setValue(o.value); opts.onChange(o.value); });
    btns.set(o.value, b);
    el.appendChild(b);
  });
  function setValue(v: T) {
    btns.forEach((b, k) => b.classList.toggle('is-on', k === v));
  }
  return { el, setValue };
}


/* ═══════════ 灯箱（lightbox.ts 转发） ═══════════ */
export { openLightbox, closeLightbox } from './lightbox';
export type { BzLightboxOpts } from './lightbox';
