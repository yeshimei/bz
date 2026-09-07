/**
 * 设置面板自绘渲染器（settings-panel，ADR-0080；ADR-0104 markup 单源迁移）
 * 数据 = 各域真实 schema（xxxSettingsSchema() 行声明，与 ⚙️ 弹窗同源）；
 * markup = 渲染纯层（./render：控件级工厂 + 行/组骨架，原型与插件同一份——
 * 本文件只做「schema 行 → 纯数据视图 → 纯层串」的投影与事件绑定/落盘），
 * 视觉 tokens 取值域 styles.css（.bz-sp-set-row/.bz-sp-group 契约类）。
 * 绑定逻辑照抄 core/settings-schema.ts：键直绑（getSettings/saveSettings）/
 * 三函数逃生口 / visibleWhen 求值 / onChange 回调 / text 防抖落盘。
 *
 * 与 core/settings-schema.ts 渲染器的关键差异：
 * 1. 行渲染完全不使用 Obsidian Setting 组件——路径行也是自绘（chips + 选择按钮 +
 *    openDirPicker 选择器），不再出现「设置行里再套一层原生设置行」的嵌套；
 * 2. custom 行走自绘卡片行骨架（custom 内容渲染进控件区，插槽占满整行），
 *    兼容现有各域 custom 插槽内的 new Setting() 代码；
 * 3. 图标：纯层出 `<i data-lucide>` 占位，渲染完成后 mountIcons 一次性物化；
 *    运行期动态节点（下拉菜单勾标）就地 setIcon。
 */
import { getSettings, saveSettings } from '../core/settings-provider';
import type { SettingsSchema, SettingsRow, SettingsSnapshot, SettingsRowContext } from '../core/settings-schema';
import { setIcon } from 'obsidian';
import { mountIcons } from '../core/ui/icons';
import { openDirPicker } from './dir-picker';
import { notice } from '../core/notice';
import {
  toggleHtml, selectTriggerHtml, selectItemHtml, textInputHtml, textareaHtml,
  sliderHtml, pathChipsItemsHtml, pathAddBtnHtml, rowBtnHtml, badgeHtml, cardpickHtml,
  rowHtml, groupCardHtml, type SpRowVm,
} from './render';

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

/* ==================== 路径行（纯层 chips 串 + 事件层重渲） ==================== */

/** 路径行 chips 视图（纯层 pathChipsHtml 输入）：绑定值清单 + 回落/空态投影 */
function pathChipsVm(opts: {
  mode: 'single' | 'multi';
  current: string[];
  fallbackChip?: string;
}): Array<{ path: string; label: string; locked?: boolean; muted?: boolean; multi?: boolean }> {
  const multi = opts.mode === 'multi';
  if (!opts.current.length && opts.fallbackChip) {
    return [{ path: '', label: opts.fallbackChip, locked: true }];
  }
  if (!opts.current.length) {
    return [{ path: '', label: multi ? '未选择' : '未设置', muted: true }];
  }
  return opts.current.map((p) => ({
    path: p,
    label: p === '' ? '（库根目录）' : p,
    multi,
  }));
}

/**
 * 路径行控件区：chips（已选目录，✕ 移除、文本点击重开选择器）+ 选择按钮（恒显，并存——
 * 旧 ticket 133「已选态移出按钮」口径废止）。与 core/path-picker 的 renderPathSettingRow 行为对齐：
 * - 选择器确定 / ✕ 移除后统一回调 onChange（支持返回 Promise 改写，异步解析后重渲）；
 * - fallbackChip = 绑定值为空时的回落展示（锁定态，仅显示实际生效目录不落盘）。
 * markup 全部出自纯层 pathChipsHtml/pathAddBtnHtml（重渲 = 重设 ctrl.innerHTML + 重绑）。
 */
export function makePathRowCtrl(opts: {
  name: string;
  mode: 'single' | 'multi';
  value: string | string[];
  pickerTitle?: string;
  pickerDesc?: string;
  buttonText?: string;
  okText?: string;
  /** 绑定值为空时的回落展示 chip（锁定态，仅显示实际生效目录不落盘；点击重开选择器可改显式值） */
  fallbackChip?: string;
  onChange: (list: string[]) => void | string[] | Promise<void | string[]>;
}): HTMLElement {
  const readValue = (): string[] => {
    const v = opts.value;
    return Array.isArray(v) ? [...v] : v ? [v] : [];
  };
  let current = readValue();

  const ctrl = document.createElement('div');
  ctrl.className = 'bz-sp-chips';

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
    openDirPicker({
      title: (opts.mode === 'multi' ? '添加文件夹 · ' : '选择文件夹 · ') + (opts.pickerTitle || opts.name),
      multi: opts.mode === 'multi',
      selected: current,
      okText: opts.okText,
      onConfirm: (list) => {
        void apply(list);
      },
    });
  };

  const renderAll = (): void => {
    ctrl.innerHTML = pathChipsItemsHtml(pathChipsVm({ mode: opts.mode, current, fallbackChip: opts.fallbackChip })) +
      pathAddBtnHtml(opts.buttonText || (opts.mode === 'multi' ? '添加…' : '选择…'));
    // chips 文本点击重开选择器；✕ 移除（multi）；回落锁定 chip 点击重开选择器
    ctrl.querySelectorAll<HTMLElement>('.bz-sp-chip').forEach((chip) => {
      const path = chip.dataset.spPath ?? '';
      const muted = chip.classList.contains('bz-sp-chip--muted');
      const locked = chip.classList.contains('bz-sp-chip--locked');
      if (!muted) chip.addEventListener('click', openPicker);
      if (locked) chip.title = '未单独设置时的实际生效目录（点击可改为显式设置）';
      const x = chip.querySelector<HTMLElement>('.x');
      if (x) {
        x.addEventListener('click', (ev) => {
          ev.stopPropagation();
          void apply(current.filter((p) => p !== path));
        });
      }
    });
    (ctrl.querySelector('.bz-sp-path-btn') as HTMLElement).addEventListener('click', openPicker);
  };
  renderAll();
  return ctrl;
}

/* ==================== 行渲染（schema 行 → 纯层视图 → 串 + 绑定） ==================== */

/** 渲染单行（返回行元素；isChild 仅挂 child 语义类，样式不缩进——issue 186 全部行左缘对齐） */
function renderRow(
  row: SettingsRow,
  refresh: () => void,
  regRefresh?: (fn: () => void) => void
): HTMLElement {
  const ctx = makeCtx(document.createElement('div'), refresh);
  const rowName = (row as { name?: string }).name;
  const vm: SpRowVm = {
    cls: (row as { isChild?: boolean }).isChild ? 'child' : undefined,
    name: rowName,
    desc: (row as { desc?: string }).desc,
    note: (row as { note?: string }).note,
  };
  /** 各分支填 vm.ctrlHtml / 特殊标志；统一出串后 innerHTML + 绑定 */
  const el = document.createElement('div');
  // 行上下文的 rowEl 即本行元素（switch 内 custom 分支渲染插槽时已可用）
  (ctx as { rowEl: HTMLElement }).rowEl = el;

  switch (row.type) {
    case 'toggle': {
      const acc = bindValue<boolean>(row.binding as unknown as AnyBinding);
      vm.ctrlHtml = toggleHtml(acc.read() === true);
      el.innerHTML = rowHtml(vm);
      const sw = el.querySelector<HTMLElement>('.bz-sw')!;
      sw.addEventListener('click', () => {
        const v = !sw.classList.contains('on');
        sw.classList.toggle('on', v);
        sw.setAttribute('aria-checked', String(v));
        acc.write(v);
        void acc.persist();
        row.onChange?.(v, ctx);
        refresh();
      });
      break;
    }
    case 'text':
    case 'number': {
      const acc = bindValue<string | number>(row.binding as unknown as AnyBinding);
      const isNum = row.type === 'number';
      const numRow = row as { min?: number; max?: number; step?: number };
      const ph = typeof row.placeholder === 'function' ? row.placeholder(snapshot()) : row.placeholder;
      const value: string = String(acc.read() ?? '');
      vm.ctrlHtml = textInputHtml({
        value,
        type: isNum ? 'number' : 'text',
        mono: !!(row as { mono?: boolean }).mono,
        num: !!(row as { num?: boolean }).num || isNum,
        secret: !!(row as { secret?: boolean }).secret,
        placeholder: ph,
        min: numRow.min,
        max: numRow.max,
        step: isNum ? (numRow.step ?? 1) : undefined,
      });
      el.innerHTML = rowHtml(vm);
      const input = el.querySelector<HTMLInputElement>('input.bz-input')!;
      // 防抖落盘（对齐 TEXT_COMMIT_DELAY=800 + 失焦/回车）+ 程序化刷新不置脏（防 blur 假写）
      let timer: number | null = null;
      let dirty = false;
      const commit = () => {
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
        if (!dirty) return; // 未编辑（仅程序化刷新显示值）不落盘
        const raw = input.value;
        if (isNum) {
          // 空串不写不删键（对齐 core 渲染器 parseClampedNumber 空→null→不写语义）：
          // 显式「0」才触发删键回落默认；空串仅清显示
          if (raw.trim() === '') return;
          let v = Number(raw);
          if (Number.isNaN(v)) v = 0;
          if (numRow.min !== undefined && v < numRow.min) v = numRow.min;
          if (numRow.max !== undefined && v > numRow.max) v = numRow.max;
          input.value = String(v);
          acc.write(v);
        } else {
          acc.write(raw);
        }
        void acc.persist();
        (row.onChange as unknown as ((v: string | number, c: SettingsRowContext) => void) | undefined)?.(
          isNum ? Number(input.value) : raw, ctx
        );
      };
      input.addEventListener('input', () => {
        dirty = true;
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(commit, 800);
      });
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
      });
      // refreshKey 联动：任意行变更（含 aiProvider 切换）后重读显示值写回输入框（不落盘）
      if (regRefresh && row.refreshKey !== undefined) {
        const ref = row.refreshKey; // 闭包内窄化不保留，先提为局部常量
        regRefresh(() => {
          const snap = snapshot();
          const fresh = typeof ref === 'function' ? ref(snap) : String((snap as any)[ref]);
          dirty = false;
          const f = String(fresh ?? '');
          if (input.value !== f) input.value = f;
        });
      }
      break;
    }
    case 'textarea': {
      const acc = bindValue<string>(row.binding as unknown as AnyBinding);
      vm.ctrlHtml = textareaHtml(acc.read() ?? '', row.placeholder);
      el.innerHTML = rowHtml(vm);
      const ta = el.querySelector<HTMLTextAreaElement>('textarea')!;
      let timer: number | null = null;
      let dirty = false; // refreshKey 程序化写值不置脏（防 blur 假写覆盖）
      const commit = () => {
        if (timer !== null) window.clearTimeout(timer);
        if (!dirty) return;
        acc.write(ta.value);
        void acc.persist();
      };
      ta.addEventListener('input', () => {
        dirty = true;
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(commit, 800);
      });
      ta.addEventListener('blur', commit);
      // refreshKey 联动：任意行变更后重读显示值写回（不落盘）
      if (regRefresh && row.refreshKey !== undefined) {
        const ref = row.refreshKey;
        regRefresh(() => {
          const snap = snapshot();
          const fresh = typeof ref === 'function' ? ref(snap) : String((snap as any)[ref]);
          dirty = false;
          const f = String(fresh ?? '');
          if (ta.value !== f) ta.value = f;
        });
      }
      break;
    }
    case 'select': {
      const acc = bindValue<string>(row.binding as unknown as AnyBinding);
      const options = row.options;
      const labelOf = (v: string) => (options.find((o) => o.value === v) || { label: v }).label;
      const curOf = () => String(acc.read() ?? '') || (options[0] && options[0].value) || '';
      vm.ctrlHtml = selectTriggerHtml(labelOf(curOf()));
      el.innerHTML = rowHtml(vm);
      const sel = el.querySelector<HTMLElement>('.bz-select')!;
      const vspan = sel.querySelector<HTMLElement>('.bz-select-val')!;
      sel.addEventListener('click', () => {
        if (sel.querySelector('.bz-select-menu')) return;
        // 组卡 overflow:hidden 会裁剪伸出的菜单——展开期间放开并提层
        const group = sel.closest<HTMLElement>('.bz-sp-group');
        if (group) { group.style.overflow = 'visible'; group.style.zIndex = '10'; }
        const closeMenu = () => {
          sel.querySelector('.bz-select-menu')?.remove();
          if (group) { group.style.overflow = ''; group.style.zIndex = ''; }
          document.removeEventListener('click', h);
        };
        const h = (ev: MouseEvent) => {
          if (!sel.contains(ev.target as Node)) closeMenu();
        };
        setTimeout(() => document.addEventListener('click', h));
        // 菜单 = 纯层 selectItemHtml 串 + 就地物化勾标
        const menu = document.createElement('div');
        menu.className = 'bz-select-menu';
        const curNow = curOf();
        menu.innerHTML = options
          .map((o) => selectItemHtml(o.label, o.value === curNow))
          .join('');
        mountIcons(menu);
        const items = menu.querySelectorAll<HTMLElement>('.bz-select-item');
        options.forEach((o, i) => {
          items[i].addEventListener('click', (ev) => {
            ev.stopPropagation();
            closeMenu();
            vspan.textContent = labelOf(o.value);
            acc.write(o.value);
            void acc.persist();
            row.onChange?.(o.value, ctx);
            refresh();
          });
        });
        sel.appendChild(menu);
      });
      break;
    }
    case 'slider': {
      const acc = bindValue<number>(row.binding as unknown as AnyBinding);
      const cur = acc.read() ?? row.min ?? 0;
      vm.ctrlHtml = sliderHtml(row.min, row.max, row.step, cur);
      el.innerHTML = rowHtml(vm);
      const range = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      const em = el.querySelector<HTMLElement>('.bz-sp-slider-val')!;
      range.addEventListener('input', () => {
        em.textContent = range.value;
        const v = Number(range.value);
        acc.write(v);
        void acc.persist();
        row.onChange?.(v, ctx);
      });
      break;
    }
    case 'path': {
      const acc = bindValue<string | string[]>(row.binding as unknown as AnyBinding);
      const multi = row.mode === 'multi';
      const fallbackFn = (row as { fallbackValue?: () => string }).fallbackValue;
      const ctrl = makePathRowCtrl({
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
        fallbackChip: typeof fallbackFn === 'function' ? fallbackFn() : '',
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
      });
      vm.ctrlHtml = ''; // 控件 DOM 直接挂（makePathRowCtrl 内部已走纯层串）
      el.innerHTML = rowHtml(vm);
      el.querySelector<HTMLElement>('.bz-sp-set-ctrl')!.appendChild(ctrl);
      break;
    }
    case 'button': {
      vm.ctrlHtml = rowBtnHtml(row.buttonText, row.cta);
      el.innerHTML = rowHtml(vm);
      el.querySelector<HTMLElement>('.bz-sp-btn')!.addEventListener('click', () => row.onClick(ctx));
      break;
    }
    case 'info': {
      vm.ctrlHtml = badgeHtml(row.name);
      el.innerHTML = rowHtml(vm);
      break;
    }
    case 'choiceCards': {
      // 视觉卡片单选（纯层 cardpickHtml 串；空值回退首个选项同 select 口径）。
      // options.layout + layoutKey：布局绑定的主题行只渲当前布局配套的单卡——主题不通用（拍板）。
      const acc = bindValue<string>(row.binding as unknown as AnyBinding);
      const layoutKey = (row as { layoutKey?: string }).layoutKey;
      const curLayout = layoutKey ? String((snapshot() as any)[layoutKey] ?? '') : '';
      const opts2 = row.options.filter((o) => {
        const lo = (o as { layout?: string }).layout;
        return !lo || !layoutKey || lo === curLayout;
      });
      const cur = String(acc.read() ?? '') || (opts2[0] && opts2[0].value) || '';
      vm.isCards = true;
      vm.ctrlHtml = cardpickHtml(opts2.map((o) => ({
        value: o.value,
        label: o.label,
        on: o.value === cur,
        prevClass: o.prevClass,
      })));
      el.innerHTML = rowHtml(vm);
      const wrap = el.querySelector<HTMLElement>('.bz-sp-cardpick')!;
      wrap.querySelectorAll<HTMLElement>('.bz-sp-cardpick-card').forEach((c) => {
        c.addEventListener('click', () => {
          wrap.querySelectorAll('.is-on').forEach((x) => x.classList.remove('is-on'));
          c.classList.add('is-on');
          acc.write(c.dataset.spCard ?? '');
          void acc.persist();
          row.onChange?.(c.dataset.spCard ?? '', ctx);
          refresh();
        });
      });
      break;
    }
    case 'custom': {
      // custom 行：内容插槽自带标题/描述（各域 new Setting().setName/setDesc），面板不再渲染 info 区
      // （否则标题描述两遍）；插槽直接占满整行，custom 内容（含原生 Setting 行）渲染进插槽，
      // 原生设置行在面板内同样被自绘容器包裹（视觉由本面板容器收敛）。
      vm.isCustom = true;
      el.innerHTML = rowHtml(vm);
      const slot = el.querySelector<HTMLElement>('.bz-sp-custom-slot--full')!;
      try {
        row.render(slot, ctx);
      } catch (e) {
        notice(`自定义设置行渲染失败：${e instanceof Error ? e.message : String(e)}`, 'error');
      }
      // custom 行 onRefresh：与 core 渲染器对齐（模型行等切 provider 后联动刷新内部输入框显示值）
      if (regRefresh && (row as { onRefresh?: (c: SettingsRowContext) => void }).onRefresh) {
        const onRefresh = (row as { onRefresh: (c: SettingsRowContext) => void }).onRefresh;
        regRefresh(() => onRefresh(ctx));
      }
      return el;
    }
    default:
      return el;
  }
  return el;
}

/** 渲染整组（分组卡：纯层 groupCardHtml 骨架 + 逐行 append；项数徽标动态计算） */
function renderGroup(
  container: HTMLElement,
  group: { name: string; icon?: string; rows: SettingsRow[] },
  refresh: () => void,
  regRefresh?: (fn: () => void) => void
): HTMLElement {
  const card = document.createElement('div');
  // 项数徽标初值：全部行数（渲染后 updateCount 按可见行重算；button 操作行不计）
  card.innerHTML = groupCardHtml(group.icon, group.name, `${group.rows.length} 项`);
  const body = card.querySelector<HTMLElement>('.bz-sp-group-body')!;
  const count = card.querySelector<HTMLElement>('.bz-sp-group-count')!;
  const rowEls: HTMLElement[] = [];
  group.rows.forEach((r) => {
    const rowEl = renderRow(r, refresh, regRefresh);
    rowEls.push(rowEl);
    body.appendChild(rowEl);
  });
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
 * 渲染 schema 到容器（与 ⚙️ 同数据源）。
 * visibleWhen 求值：false 的行/组挂 display none（含组级 visibleWhen，如移动端组桌面隐藏）；
 * isChild 行只参与显隐联动，不缩进（issue 186）。
 * 显隐条件用 WeakMap 存函数引用（不可序列化，避免 new Function 脆弱方案）。
 * 返回 { refresh }（重求值显隐）。
 */
export function renderPanelSchema(container: HTMLElement, schema: SettingsSchema): { refresh: () => void } {
  const visibleConditions = new WeakMap<HTMLElement, (s: SettingsSnapshot) => boolean>();
  // refreshKey 联动：登记「任意行变更后重读显示值」的回调（refresh 内统一执行，不落盘）
  const valueRefreshes: Array<() => void> = [];
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
    // refreshKey：重读绑定值写回已渲染输入框（如 per-provider 输入随 aiProvider 切换联动）
    for (const fn of valueRefreshes) fn();
  };

  schema.groups.forEach((g) => {
    const card = renderGroup(container, g, refresh, (fn) => valueRefreshes.push(fn));
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

  // 纯层 `<i data-lucide>` 占位一次性物化（分组卡图标等；未知图标静默忽略）
  mountIcons(container);

  return { refresh };
}
