/**
 * 设置面板自绘渲染器（settings-panel，ADR-0080）
 * 数据 = 各域真实 schema（xxxSettingsSchema() 行声明，与 ⚙️ 弹窗同源）；
 * 视觉 = 原型 .scratch/global-settings-panel-prototype.html 1:1 自绘
 * （抛弃 Obsidian 原生 Setting 样式：自绘开关/输入/下拉/滑块/按钮/chips）。
 * 绑定逻辑照抄 core/settings-schema.ts：键直绑（getSettings/saveSettings）/
 * 三函数逃生口 / visibleWhen 求值 / onChange 回调 / text 防抖落盘。
 *
 * 与 core/settings-schema.ts 渲染器的关键差异：
 * 1. 行渲染完全不使用 Obsidian Setting 组件——路径行也是自绘（chips + 选择按钮 +
 *    openPathPicker 选择器），不再出现「设置行里再套一层原生设置行」的嵌套；
 * 2. custom 行走原型渲染器（自绘卡片行骨架，custom 内容渲染进控件区），
 *    兼容现有各域 custom 插槽内的 new Setting() 代码（它们渲染进本面板的
 *    .bz-sp-settings-body 时同样被自绘样式包裹）。
 */
import { getSettings, saveSettings } from '../core/settings-provider';
import type { SettingsSchema, SettingsRow, SettingsSnapshot, SettingsRowContext } from '../core/settings-schema';
import { setIcon } from 'obsidian';
import { openPathPicker } from '../core/path-picker';
import { notice } from '../core/notice';

/** 快照读取（visibleWhen 求值输入；键直绑行从 getSettings 读，三函数行由外部提供） */
function snapshot(): SettingsSnapshot {
  return getSettings() as unknown as SettingsSnapshot;
}

/** 分组卡图标：schema 的 lucide 图标名 → 原型风格 emoji（原型 .gc-icon 为 emoji）。
 *  找不到映射的图标名回落 setIcon 线条图标（保持可用）。 */
const GROUP_ICON_EMOJI: Record<string, string> = {
  sparkles: '🤖', // AI 服务商
  'folder-open': '📂', // 目录/数据存储
  smartphone: '📱', // 移动端
  bell: '🔔', // 提醒
  'graduation-cap': '🎓', // 做题家
  timer: '⏱️', // 复习节奏 / 番茄时间方案
  brain: '🧠', // 记忆算法 / 做题家
  'sliders-horizontal': '⚙️', // 行为 / 自动化
  eye: '👁️', // 界面 / 显示
  'message-circle': '💬', // 互动 / 对话
  archive: '📦', // 记忆
  database: '🗄️', // 存储与记忆
  moon: '🌙', // 记忆巩固
  link: '🔗', // 关联 / 自动双链
  search: '🔍', // 检索
  'layout-dashboard': '📊', // 面板
  'message-square': '💬', // 对话
  palette: '🎨', // 外观
  'pencil-line': '✏️', // 新建
  tags: '🏷️', // 场景列表
  key: '🔑', // 生成
  'key-round': '🔑', // 生成
  shield: '🛡️', // 安全
  monitor: '🖥️', // 默认视图
  wrench: '🛠️', // 维护 / 工具
  radio: '📡', // 数据源
  image: '🖼️', // 预览
  'book-open': '📖', // 文献 / 书库
  highlighter: '🖍️', // 划线
  terminal: '💻', // 视频处理
  bot: '🤖', // AI
  clock: '⏰', // 时间
  'check-circle': '✅', // 完成
  copy: '📋', // 复制
  'external-link': '🔗', // 打开
  'file-text': '📄', // 文件
  globe: '🌐', // 网络
  history: '🕘', // 历史
  info: 'ℹ️', // 信息
  play: '▶️', // 播放
  'refresh-cw': '🔄', // 刷新
  'rotate-ccw': '↩️', // 恢复
  star: '⭐', // 收藏
};

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
      b.addEventListener('click', (ev) => {
        // 阻止冒泡到 sel：否则选项点击会再次触发 sel 的 open()，菜单反复重开（需多点几次才有反应）
        ev.stopPropagation();
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
    if (e.target !== menu && !menu?.contains(e.target as Node)) open();
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

/* ==================== 路径行（自绘 chips + 选择按钮，原型样式） ==================== */

/**
 * 自绘路径行控件区：chips（已选目录，✕ 移除、文本点击重开选择器）+ 选择按钮（空态显示）。
 * 与 core/path-picker 的 renderPathSettingRow 行为对齐（ticket 133 形态）：
 * - 空态只显示「选择…/添加…」按钮（无「未选择」灰字）；
 * - 已选态按钮移出 DOM，chips 文本点击重开选择器、✕ 清除；
 * - 选择器确定 / ✕ 移除后统一回调 onChange（支持返回 Promise 改写）。
 * 差异：完全自绘 DOM（无 Setting 组件），视觉 1:1 原型 chips（.bz-sp-chip）。
 */
export function makePathRowCtrl(opts: {
  name: string;
  mode: 'single' | 'multi';
  value: string | string[];
  pickerTitle?: string;
  pickerDesc?: string;
  buttonText?: string;
  okText?: string;
  onChange: (list: string[]) => void | string[] | Promise<void | string[]>;
}): HTMLElement {
  const readValue = (): string[] => {
    const v = opts.value;
    return Array.isArray(v) ? [...v] : v ? [v] : [];
  };
  let current = readValue();

  const ctrl = document.createElement('div');
  ctrl.className = 'bz-sp-chips';
  const addBtn = document.createElement('button');
  addBtn.className = 'bz-sp-btn bz-sp-path-btn';
  addBtn.textContent = opts.buttonText || (opts.mode === 'multi' ? '添加…' : '选择…');

  /** 统一变更入口：onChange 返回 Promise 时异步解析改写清单后重渲染；同步返回（含 void）立即重渲染 */
  const apply = (list: string[]): void | Promise<void> => {
    const res = opts.onChange(list);
    if (res && typeof (res as { then?: unknown }).then === 'function') {
      return Promise.resolve(res as Promise<void | string[]>).then((final) => {
        current = Array.isArray(final) ? final : list;
        renderAll();
      });
    }
    current = Array.isArray(res) ? res : list;
    renderAll();
  };

  const openPicker = () => {
    openPathPicker({
      title: opts.pickerTitle || opts.name,
      desc: opts.pickerDesc,
      mode: opts.mode,
      selected: current,
      okText: opts.okText,
      onConfirm: (list) => {
        void apply(list);
      },
    });
  };

  const renderChips = () => {
    ctrl.querySelectorAll('.bz-sp-chip').forEach((c) => c.remove());
    for (const path of current) {
      const label = path === '' ? '（库根目录）' : path;
      const chip = document.createElement('span');
      chip.className = 'bz-sp-chip';
      chip.title = label;
      const name = document.createElement('span');
      name.className = 'bz-sp-chip-name';
      name.textContent = label;
      name.addEventListener('click', openPicker); // 文本点击重开选择器
      const x = document.createElement('button');
      x.className = 'bz-sp-chip-x';
      x.textContent = '✕';
      x.setAttribute('aria-label', `移除 ${label}`);
      x.addEventListener('click', () => {
        void apply(current.filter((p) => p !== path));
      });
      chip.append(name, x);
      ctrl.appendChild(chip);
    }
    addBtn.style.display = current.length ? 'none' : '';
    if (!current.length && !addBtn.isConnected) ctrl.appendChild(addBtn);
    if (current.length && addBtn.isConnected) addBtn.remove();
  };
  const renderAll = () => renderChips();
  addBtn.addEventListener('click', openPicker);
  ctrl.appendChild(addBtn);
  renderChips();
  return ctrl;
}

/* ==================== 行渲染 ==================== */

/** 渲染单行（自绘；返回行元素；子行挂 child 缩进） */
function renderRow(row: SettingsRow, refresh: () => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bz-sp-set-row' + ((row as { isChild?: boolean }).isChild ? ' child' : '');
  const ctx = makeCtx(el, refresh);
  const rowName = (row as { name?: string }).name;

  // custom 行：内容插槽自带标题/描述（各域 custom 内 new Setting().setName/setDesc），
  // 若面板再渲染 info 区会导致标题描述出现两遍（ticket：设置面板内容重复 a/c）。
  // 故 custom 行不渲染 info 区，控件区直接占满整行。
  const isCustom = row.type === 'custom';
  let ctrl: HTMLElement | null = null;
  if (!isCustom) {
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

    ctrl = document.createElement('div');
    ctrl.className = 'bz-sp-set-ctrl';
    el.appendChild(ctrl);
  }
  // 非 custom 分支全部挂到 ctrl（isCustom 时这些分支不可达；断言避免 TS 报 null 窄化）
  const ctrlEl = ctrl as HTMLElement;

  switch (row.type) {
    case 'toggle': {
      const acc = bindValue<boolean>(row.binding as unknown as AnyBinding);
      ctrlEl.appendChild(makeToggle(acc.read() === true, (v) => {
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
      ctrlEl.appendChild(makeInput({
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
      ctrlEl.appendChild(ta);
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
      ctrlEl.appendChild(input);
      break;
    }
    case 'select': {
      const acc = bindValue<string>(row.binding as unknown as AnyBinding);
      ctrlEl.appendChild(makeSelect({
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
      ctrlEl.appendChild(makeSlider({
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
      const multi = row.mode === 'multi';
      ctrlEl.appendChild(makePathRowCtrl({
        name: row.name,
        mode: row.mode,
        value: multi
          ? Array.isArray(acc.read())
            ? [...(acc.read() as string[])]
            : []
          : String(acc.read() ?? ''),
        pickerTitle: row.pickerTitle,
        pickerDesc: row.pickerDesc,
        buttonText: row.buttonText,
        okText: row.okText,
        onChange: (list) => {
          const v = multi ? list : (list[0] || '').trim().replace(/^\/+|\/+$/g, '');
          acc.write(v as string | string[]);
          void acc.persist();
          // 回调在落盘后触发（原口径）；返回清单（含异步解析结果）回传 path 行作 chips 渲染口径——
          // 异步否决场景的落盘改写由回调自行负责（如外部 binding 自管写盘）
          const res = row.onChange?.(list, ctx);
          if (res && typeof (res as { then?: unknown }).then === 'function') {
            return Promise.resolve(res as Promise<void | string[]>).then(
              (final) => (Array.isArray(final) ? final : list)
            );
          }
          return Array.isArray(res) ? res : undefined;
        },
      }));
      break;
    }
    case 'button': {
      ctrlEl.appendChild(makeButton({
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
      ctrlEl.appendChild(badge);
      break;
    }
    case 'custom': {
      // custom 行：内容插槽自带标题/描述（各域 new Setting().setName/setDesc），面板不再渲染 info 区
      // （否则标题描述两遍）；插槽直接占满整行，custom 内容（含原生 Setting 行）渲染进插槽，
      // 原生设置行在面板内同样被自绘容器包裹（视觉由本面板容器收敛）。
      const slot = document.createElement('div');
      slot.className = 'bz-sp-custom-slot bz-sp-custom-slot--full';
      el.appendChild(slot);
      try {
        row.render(slot, ctx);
      } catch (e) {
        notice(`自定义设置行渲染失败：${e instanceof Error ? e.message : String(e)}`, 'error');
      }
      break;
    }
    default:
      break;
  }
  return el;
}

/** 渲染整组（分组卡片，原型样式） */
function renderGroup(
  container: HTMLElement,
  group: { name: string; icon?: string; rows: SettingsRow[] },
  refresh: () => void
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'bz-sp-group';

  const head = document.createElement('div');
  head.className = 'bz-sp-group-head';
  if (group.icon) {
    const ic = document.createElement('span');
    ic.className = 'bz-sp-group-icon';
    // 分组卡图标：lucide 名 → emoji 映射（原型 .gc-icon 为 emoji；找不到映射回落 setIcon 线条）
    const emoji = GROUP_ICON_EMOJI[group.icon];
    if (emoji) {
      ic.textContent = emoji;
    } else {
      try {
        setIcon(ic, group.icon);
      } catch {
        /* ignore */
      }
    }
    head.appendChild(ic);
  }
  const gname = document.createElement('span');
  gname.className = 'bz-sp-group-name';
  gname.textContent = group.name;
  head.appendChild(gname);
  // 项数徽标：动态计算（可见非 button 行数；button 行是操作行不计数，与 ⚙️ 弹窗 refreshSettingsGroupCounts 口径一致）
  const count = document.createElement('span');
  count.className = 'bz-sp-group-count';
  count.textContent = `${group.rows.length} 项`;
  head.appendChild(count);
  card.appendChild(head);

  const body = document.createElement('div');
  body.className = 'bz-sp-group-body';
  const rowEls: HTMLElement[] = [];
  group.rows.forEach((r) => {
    const rowEl = renderRow(r, refresh);
    rowEls.push(rowEl);
    body.appendChild(rowEl);
  });
  card.appendChild(body);
  container.appendChild(card);

  /** 重算项数徽标：排除隐藏行（含 group 整体隐藏时恒 0）与 button 操作行 */
  const updateCount = () => {
    const groupHidden = card.style.display === 'none' || card.classList.contains('bz-sp-hidden');
    let n = 0;
    if (!groupHidden) {
      group.rows.forEach((r, i) => {
        if (r.type === 'button') return; // 操作行不计
        const el = rowEls[i];
        if (el && el.style.display !== 'none') n++;
      });
    }
    count.textContent = `${n} 项`;
    // 功能性显隐（铁律 8 允许）：0 项组隐藏徽标（对齐 ⚙️ 弹窗 refreshSettingsGroupCounts）
    count.style.display = n > 0 ? '' : 'none';
  };
  (card as any).__bzSpUpdateCount = updateCount;
  updateCount();
  return card;
}

/**
 * 自绘渲染 schema 到容器（与 ⚙️ 同数据源，视觉 1:1 原型）。
 * visibleWhen 求值：false 的行/组挂 display none（含组级 visibleWhen，如移动端组桌面隐藏）；
 * isChild 行缩进。
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
    container.querySelectorAll<HTMLElement>('[data-sp-group]').forEach((el) => {
      const cond = visibleConditions.get(el);
      if (!cond) return;
      el.style.display = cond(snapshot()) ? '' : 'none';
    });
    // 行/组显隐变化后重算各分组项数徽标（动态计算；button 操作行与隐藏行不计）
    container.querySelectorAll<HTMLElement>('.bz-sp-group').forEach((card) => {
      const upd = (card as any).__bzSpUpdateCount as (() => void) | undefined;
      if (typeof upd === 'function') upd();
    });
  };

  schema.groups.forEach((g) => {
    const card = renderGroup(container, g, refresh);
    card.dataset.spGroup = g.name;
    // 组级 visibleWhen（如 mobileFullscreenGroup 的 isMobileEnv 门控）：false 整组隐藏
    const groupVw = (g as { visibleWhen?: (s: SettingsSnapshot) => boolean }).visibleWhen;
    if (groupVw) {
      card.dataset.spGroupCond = '1';
      visibleConditions.set(card, groupVw);
      card.style.display = groupVw(snapshot()) ? '' : 'none';
    }
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
