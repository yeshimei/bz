/**
 * 设置面板自绘渲染器（settings-panel，ADR-0080）
 * 数据 = 各域真实 schema（xxxSettingsSchema() 行声明，与 ⚙️ 弹窗同源）；
 * 视觉 = 原型 .scratch/global-settings-panel-prototype.html 1:1 自绘
 * （抛弃 Obsidian 原生 Setting 样式：自绘开关/输入/下拉/滑块/按钮/chips）。
 * 绑定逻辑照抄 core/settings-schema.ts：键直绑（getSettings/saveSettings）/
 * 三函数逃生口 / visibleWhen 求值 / onChange 回调 / text 防抖落盘。
 * 路径行复用 renderPathSettingRow + openPathPicker（ADR-0061 核心选择器）。
 */
import { getSettings, saveSettings } from '../core/settings-provider';
import type { SettingsSchema, SettingsRow, SettingsSnapshot, SettingsRowContext } from '../core/settings-schema';
import { setIcon } from 'obsidian';
import { renderPathSettingRow, openPathPicker } from '../core/path-picker';
import { notice } from '../core/notice';

/** 快照读取（visibleWhen 求值输入；键直绑行从 getSettings 读，三函数行由外部提供） */
function snapshot(): SettingsSnapshot {
  return getSettings() as unknown as SettingsSnapshot;
}

/** 绑定统一读写通道（照抄 settings-schema.ts bindValue） */
interface ValueAccess<V> {
  read: () => V;
  write: (v: V) => void;
  persist: () => Promise<void> | void;
}

// 行绑定类型（键直绑 或 三函数逃生口）
type AnyBinding =
  | { key: string }
  | { get: () => unknown; set: (v: unknown) => void; save: () => Promise<void> | void };

function bindValue<V>(binding: AnyBinding): ValueAccess<V> {
  if ('key' in binding) {
    const key = binding.key;
    return {
      read: () => getSettings()[key] as V,
      write: (v) => {
        (getSettings() as unknown as Record<string, unknown>)[key as string] = v;
      },
      persist: () => saveSettings(),
    };
  }
  return {
    read: () => binding.get() as V,
    write: (v) => binding.set(v),
    persist: () => binding.save(),
  };
}

/** 行上下文（供 onChange/custom/button 回调；结构与 core SettingsRowContext 一致） */
function makeCtx(rowEl: HTMLElement, refreshVisibility: () => void): SettingsRowContext {
  return { rowEl, refreshVisibility };
}

/* ==================== 控件工厂（自绘，原型样式） ==================== */

/** 开关（40×22 滑块） */
function makeToggle(on: boolean, onChange: (v: boolean) => void): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'bz-sp-sw' + (on ? ' on' : '');
  wrap.setAttribute('role', 'switch');
  wrap.setAttribute('aria-checked', String(on));
  wrap.tabIndex = 0;
  const tr = document.createElement('span');
  tr.className = 'bz-sp-sw-tr';
  wrap.appendChild(tr);
  const toggle = () => {
    const next = !wrap.classList.contains('on');
    wrap.classList.toggle('on', next);
    wrap.setAttribute('aria-checked', String(next));
    onChange(next);
  };
  wrap.addEventListener('click', toggle);
  wrap.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  });
  return wrap;
}

/** 文本/数字输入 */
function makeInput(opts: {
  value: string;
  type?: 'text' | 'number';
  mono?: boolean;
  num?: boolean;
  secret?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  onCommit: (v: string) => void;
}): HTMLElement {
  const input = document.createElement('input');
  input.type = opts.type === 'number' ? 'number' : 'text';
  const cls = ['bz-sp-input'];
  if (opts.mono) cls.push('mono');
  if (opts.num) cls.push('num');
  if (opts.secret) cls.push('sec');
  input.className = cls.join(' ');
  input.value = opts.value;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  if (opts.min !== undefined) input.min = String(opts.min);
  if (opts.max !== undefined) input.max = String(opts.max);
  // 防抖落盘（照抄 TEXT_COMMIT_DELAY=800 + 失焦/回车）
  let timer: number | null = null;
  const commit = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    opts.onCommit(input.value);
  };
  input.addEventListener('input', () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(commit, 800);
  });
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
  });
  return input;
}

/** 自绘下拉（点击弹出选项菜单） */
function makeSelect(opts: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onPick: (v: string) => void;
}): HTMLElement {
  const sel = document.createElement('span');
  sel.className = 'bz-sp-sel';
  const val = document.createElement('span');
  val.className = 'bz-sp-sel-val';
  const cur = opts.options.find((o) => o.value === opts.value);
  val.textContent = cur ? cur.label : opts.value;
  const car = document.createElement('span');
  car.className = 'bz-sp-sel-car';
  car.textContent = '▾';
  sel.append(val, car);

  let menu: HTMLElement | null = null;
  const close = () => {
    if (menu) {
      menu.remove();
      menu = null;
    }
    sel.classList.remove('open');
  };
  const open = () => {
    close();
    sel.classList.add('open');
    menu = document.createElement('div');
    menu.className = 'bz-sp-sel-menu';
    opts.options.forEach((o) => {
      const b = document.createElement('button');
      b.className = 'bz-sp-sel-opt' + (o.value === opts.value ? ' on' : '');
      b.textContent = o.label;
      if (o.value === opts.value) {
        const ck = document.createElement('span');
        ck.className = 'bz-sp-sel-ck';
        ck.textContent = '✓';
        b.appendChild(ck);
      }
      b.addEventListener('click', () => {
        // 选中后更新显示（label），再回调外部（写绑定 + 落盘）
        val.textContent = o.label;
        opts.onPick(o.value);
        close();
      });
      menu!.appendChild(b);
    });
    sel.appendChild(menu);
  };
  sel.addEventListener('click', (e) => {
    if (e.target !== menu) open();
  });
  document.addEventListener('click', (e) => {
    if (menu && !menu.contains(e.target as Node) && e.target !== sel) close();
  });
  return sel;
}

/** 滑块（range + 值徽标） */
function makeSlider(opts: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onInput: (v: number) => void;
}): HTMLElement {
  const row = document.createElement('span');
  row.className = 'bz-sp-slider-row';
  const range = document.createElement('input');
  range.type = 'range';
  range.className = 'bz-sp-range';
  range.min = String(opts.min);
  range.max = String(opts.max);
  range.step = String(opts.step ?? 1);
  range.value = String(opts.value);
  const badge = document.createElement('span');
  badge.className = 'bz-sp-badge gray';
  badge.textContent = `${opts.value}${opts.unit || ''}`;
  range.addEventListener('input', () => {
    badge.textContent = `${range.value}${opts.unit || ''}`;
    opts.onInput(Number(range.value));
  });
  row.append(range, badge);
  return row;
}

/** 按钮 */
function makeButton(opts: { text: string; primary?: boolean; danger?: boolean; onClick: () => void }): HTMLElement {
  const b = document.createElement('button');
  b.className = 'bz-sp-btn' + (opts.primary ? ' primary' : '') + (opts.danger ? ' danger' : '');
  b.textContent = opts.text;
  b.addEventListener('click', opts.onClick);
  return b;
}

/** 路径 chips（复用 renderPathSettingRow 逻辑：chips + 选择器） */
function makePathRow(
  parent: HTMLElement,
  opts: {
    name: string;
    desc?: string;
    mode: 'single' | 'multi';
    value: string | string[];
    pickerTitle?: string;
    pickerDesc?: string;
    buttonText?: string;
    okText?: string;
    onChange: (list: string[]) => void | string[] | Promise<void | string[]>;
  }
): void {
  renderPathSettingRow({
    parent,
    name: opts.name,
    desc: opts.desc,
    mode: opts.mode,
    value: opts.value,
    pickerTitle: opts.pickerTitle,
    pickerDesc: opts.pickerDesc,
    buttonText: opts.buttonText,
    okText: opts.okText,
    onChange: (list) => opts.onChange(list),
  });
}

/* ==================== 行渲染 ==================== */

/** 渲染单行（自绘；返回行元素；子行挂 child 缩进） */
function renderRow(row: SettingsRow, refresh: () => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bz-sp-set-row' + ((row as { isChild?: boolean }).isChild ? ' child' : '');
  const ctx = makeCtx(el, refresh);
  const rowName = (row as { name?: string }).name;

  const info = document.createElement('div');
  info.className = 'bz-sp-set-info';
  if (rowName) {
    const name = document.createElement('div');
    name.className = 'bz-sp-set-name';
    name.textContent = rowName;
    info.appendChild(name);
  }
  if ((row as { desc?: string }).desc) {
    const desc = document.createElement('div');
    desc.className = 'bz-sp-set-desc';
    desc.textContent = (row as { desc?: string }).desc!;
    info.appendChild(desc);
  }
  el.appendChild(info);

  const ctrl = document.createElement('div');
  ctrl.className = 'bz-sp-set-ctrl';
  el.appendChild(ctrl);

  switch (row.type) {
    case 'toggle': {
      const acc = bindValue<boolean>(row.binding as unknown as AnyBinding);
      ctrl.appendChild(makeToggle(acc.read() === true, (v) => {
        acc.write(v);
        void acc.persist();
        row.onChange?.(v, ctx);
        refresh();
      }));
      break;
    }
    case 'text': {
      const acc = bindValue<string>(row.binding as unknown as AnyBinding);
      const ph = typeof row.placeholder === 'function' ? row.placeholder(snapshot()) : row.placeholder;
      ctrl.appendChild(makeInput({
        value: acc.read() ?? '',
        mono: !!(row as { mono?: boolean }).mono,
        num: !!(row as { num?: boolean }).num,
        secret: !!(row as { secret?: boolean }).secret,
        placeholder: ph,
        onCommit: (v) => {
          acc.write(v);
          void acc.persist();
          row.onChange?.(v, ctx);
        },
      }));
      break;
    }
    case 'textarea': {
      const acc = bindValue<string>(row.binding as unknown as AnyBinding);
      const ta = document.createElement('textarea');
      ta.className = 'bz-sp-input bz-sp-textarea';
      ta.value = acc.read() ?? '';
      if (row.placeholder) ta.placeholder = row.placeholder;
      let timer: number | null = null;
      const commit = () => {
        if (timer !== null) window.clearTimeout(timer);
        acc.write(ta.value);
        void acc.persist();
      };
      ta.addEventListener('input', () => {
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(commit, 800);
      });
      ta.addEventListener('blur', commit);
      ctrl.appendChild(ta);
      break;
    }
    case 'number': {
      const acc = bindValue<number>(row.binding as unknown as AnyBinding);
      const ph = typeof row.placeholder === 'function' ? row.placeholder(snapshot()) : row.placeholder;
      const input = makeInput({
        value: String(acc.read() ?? ''),
        type: 'number',
        num: true,
        placeholder: ph,
        min: row.min,
        max: row.max,
        onCommit: (raw) => {
          let v = Number(raw);
          if (Number.isNaN(v)) v = 0;
          if (row.min !== undefined && v < row.min) v = row.min;
          if (row.max !== undefined && v > row.max) v = row.max;
          acc.write(v);
          void acc.persist();
          row.onChange?.(v, ctx);
        },
      });
      (input as HTMLInputElement).step = String(row.step ?? 1);
      ctrl.appendChild(input);
      break;
    }
    case 'select': {
      const acc = bindValue<string>(row.binding as unknown as AnyBinding);
      ctrl.appendChild(makeSelect({
        value: acc.read() ?? '',
        options: row.options,
        onPick: (v) => {
          acc.write(v);
          void acc.persist();
          row.onChange?.(v, ctx);
          refresh();
        },
      }));
      break;
    }
    case 'slider': {
      const acc = bindValue<number>(row.binding as unknown as AnyBinding);
      ctrl.appendChild(makeSlider({
        value: acc.read() ?? row.min,
        min: row.min,
        max: row.max,
        step: row.step,
        onInput: (v) => {
          acc.write(v);
          void acc.persist();
          row.onChange?.(v, ctx);
        },
      }));
      break;
    }
    case 'path': {
      const acc = bindValue<string | string[]>(row.binding as unknown as AnyBinding);
      makePathRow(ctrl, {
        name: row.name,
        desc: (row as { desc?: string }).desc,
        mode: row.mode,
        value: acc.read(),
        pickerTitle: row.pickerTitle,
        pickerDesc: row.pickerDesc,
        buttonText: row.buttonText,
        okText: row.okText,
        onChange: (list) => {
          const res = row.onChange?.(list, ctx);
          if (res && typeof (res as { then?: unknown }).then === 'function') {
            return Promise.resolve(res as Promise<void | string[]>).then((final) => {
              acc.write((Array.isArray(final) ? final : list) as never);
              void acc.persist();
              return final as never;
            });
          }
          acc.write(list as never);
          void acc.persist();
          return list as never;
        },
      });
      break;
    }
    case 'button': {
      ctrl.appendChild(makeButton({
        text: row.buttonText,
        primary: row.cta,
        onClick: () => row.onClick(ctx),
      }));
      break;
    }
    case 'info': {
      const badge = document.createElement('span');
      badge.className = 'bz-sp-badge gray';
      badge.textContent = row.name;
      ctrl.appendChild(badge);
      break;
    }
    case 'custom': {
      const slot = document.createElement('div');
      slot.className = 'bz-sp-custom-slot';
      ctrl.appendChild(slot);
      row.render(slot, ctx);
      break;
    }
    default:
      break;
  }
  return el;
}

/** 渲染整组（分组卡片，原型样式） */
function renderGroup(container: HTMLElement, group: { name: string; icon?: string; rows: SettingsRow[] }, refresh: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = 'bz-sp-group';

  const head = document.createElement('div');
  head.className = 'bz-sp-group-head';
  if (group.icon) {
    const ic = document.createElement('span');
    ic.className = 'bz-sp-group-icon';
    try {
      setIcon(ic, group.icon);
    } catch {
      /* ignore */
    }
    head.appendChild(ic);
  }
  const gname = document.createElement('span');
  gname.className = 'bz-sp-group-name';
  gname.textContent = group.name;
  head.appendChild(gname);
  const count = document.createElement('span');
  count.className = 'bz-sp-group-count';
  count.textContent = `${group.rows.length} 项`;
  head.appendChild(count);
  card.appendChild(head);

  const body = document.createElement('div');
  body.className = 'bz-sp-group-body';
  group.rows.forEach((r) => {
    const rowEl = renderRow(r, refresh);
    body.appendChild(rowEl);
  });
  card.appendChild(body);
  container.appendChild(card);
  return card;
}

/**
 * 自绘渲染 schema 到容器（与 ⚙️ 同数据源，视觉 1:1 原型）。
 * visibleWhen 求值：false 的行挂 display none；isChild 行缩进。
 * 显隐条件用 WeakMap 存函数引用（不可序列化，避免 new Function 脆弱方案）。
 * 返回 { refresh }（重求值显隐）。
 */
export function renderPanelSchema(container: HTMLElement, schema: SettingsSchema): { refresh: () => void } {
  const visibleConditions = new WeakMap<HTMLElement, (s: SettingsSnapshot) => boolean>();
  const refresh = () => {
    container.querySelectorAll<HTMLElement>('[data-sp-row]').forEach((el) => {
      const cond = visibleConditions.get(el);
      if (!cond) return;
      el.style.display = cond(snapshot()) ? '' : 'none';
    });
  };

  schema.groups.forEach((g) => {
    const card = renderGroup(container, g, refresh);
    card.dataset.spGroup = g.name;
    g.rows.forEach((r, i) => {
      const rowEl = card.querySelectorAll('.bz-sp-set-row')[i] as HTMLElement | undefined;
      if (!rowEl) return;
      const vw = (r as { visibleWhen?: (s: SettingsSnapshot) => boolean }).visibleWhen;
      if (vw) {
        rowEl.dataset.spRow = String(i);
        visibleConditions.set(rowEl, vw);
        rowEl.style.display = vw(snapshot()) ? '' : 'none';
      }
    });
  });

  return { refresh };
}
