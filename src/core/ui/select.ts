/* ============================================================
 * bz 组件库 · 下拉选择（src/core/ui/select.ts）
 * uiSelect：单行单选下拉（.bz-select，点击开合 .bz-select-menu）。
 * 供选项多/文案长/行内放不下的选择行使用；短选项组请直接用
 * .bz-choice 平铺胶囊替代（设计口味：表单优先平铺，下拉兜底）。
 * 外部点击 / 再点自身 / 选中后关闭；组件自身不感知宿主结构，
 * 需要把所在容器 z 提层（菜单溢出被后续卡片遮挡）时经
 * onOpenChange 回调联动。
 * ============================================================ */
import type { BzSelectOpts } from './types';
import { uiIcon } from './icon';

/** 下拉（.bz-select），返回容器 + setValue 句柄 */
export function uiSelect<T extends string>(opts: BzSelectOpts<T>): { el: HTMLDivElement; setValue: (v: T) => void } {
  const el = document.createElement('div');
  el.className = 'bz-select' + (opts.className ? ' ' + opts.className : '');
  el.setAttribute('role', 'button');
  el.setAttribute('aria-haspopup', 'listbox');
  el.setAttribute('aria-expanded', 'false');
  el.tabIndex = 0;

  const val = document.createElement('span');
  val.className = 'bz-select-val';
  el.appendChild(val);
  el.appendChild(uiIcon('chevron-down', 'bz-select-car'));

  let current = opts.value;
  let menu: HTMLDivElement | null = null;

  const labelOf = (v: T): string => {
    const o = opts.options.find((x) => x.value === v);
    return o ? o.label : '';
  };
  const renderVal = () => {
    val.textContent = labelOf(current) || opts.placeholder || '';
  };
  renderVal();

  const close = (notify = true) => {
    if (menu) {
      menu.remove();
      menu = null;
    }
    el.classList.remove('open');
    el.setAttribute('aria-expanded', 'false');
    if (notify) opts.onOpenChange?.(false);
  };
  const open = () => {
    close(false);
    el.classList.add('open');
    el.setAttribute('aria-expanded', 'true');
    opts.onOpenChange?.(true);
    const m = document.createElement('div');
    m.className = 'bz-select-menu';
    m.setAttribute('role', 'listbox');
    menu = m;
    opts.options.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bz-select-item' + (o.value === current ? ' is-on' : '');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(o.value === current));
      const span = document.createElement('span');
      span.textContent = o.label;
      b.appendChild(span);
      b.appendChild(uiIcon('check', 'bz-select-item-ck'));
      b.addEventListener('click', (ev) => {
        ev.stopPropagation(); // 选中即关（含 el/document 监听不连锁）
        setValue(o.value);
        opts.onChange(o.value);
        close();
      });
      m.appendChild(b);
    });
    el.appendChild(m);
  };
  const setValue = (v: T) => {
    current = v;
    renderVal();
    if (menu) {
      // 菜单开着时选中态跟随（选项点击后即关，此分支兜底程序化 setValue）
      opts.options.forEach((o, i) => {
        const item = menu?.querySelectorAll('.bz-select-item')[i] as HTMLElement | undefined;
        if (!item) return;
        const on = o.value === v;
        item.classList.toggle('is-on', on);
        item.setAttribute('aria-selected', String(on));
      });
    }
  };

  el.addEventListener('click', () => {
    if (menu) close();
    else open();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (menu) close();
      else open();
    }
  });
  // 点外部关闭（点 el 自身已由上方开合处理，这里只关不误开）
  document.addEventListener('click', (e) => {
    if (menu && !el.contains(e.target as Node)) close();
  });
  return { el, setValue };
}
