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
import { escManager } from '../esc-manager';

/** 下拉（.bz-select），返回容器 + setValue + detach 句柄 */
export function uiSelect<T extends string>(opts: BzSelectOpts<T>): {
  el: HTMLDivElement;
  setValue: (v: T) => void;
  detach: () => void;
} {
  const el = document.createElement('div');
  el.className = 'bz-select' + (opts.className ? ' ' + opts.className : '');
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-expanded', 'false');
  el.tabIndex = 0;

  const val = document.createElement('span');
  val.className = 'bz-select-val';
  el.appendChild(val);
  el.appendChild(uiIcon('chevron-down', 'bz-select-car'));

  let current = opts.value;
  let menu: HTMLDivElement | null = null;
  /** ESC 层句柄（C5）：菜单开着时经 escManager 注册，随 close 注销——替代私挂 document 级 ESC 监听 */
  let escHandle: ReturnType<typeof escManager.register> | null = null;

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
    if (escHandle) {
      escHandle.unregister();
      escHandle = null;
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
    opts.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bz-select-item' + (o.value === current ? ' is-on' : '');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(o.value === current));
      b.dataset.index = String(i);
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
    // 宽度兜底：部分宿主环境（旧 WebView2 内核）把绝对定位菜单收缩宽钳回触发器宽，
    // 溢出被选项内 ellipsis 吸收（菜单级 scrollWidth 察觉不到），须逐项比对 span 完整
    // 文本宽取最大差，把菜单 min-width 撑过需求宽（选项 width:100% 链等量传导，菜单
    // 加宽多少 span 就分到多少）。ellipsis 下 scrollWidth 首测可能低估，迭代至收敛
    for (let round = 0; round < 3; round++) {
      let delta = 0;
      m.querySelectorAll<HTMLElement>('.bz-select-item > span').forEach((sp) => {
        delta = Math.max(delta, sp.scrollWidth - sp.clientWidth);
      });
      if (delta <= 0) break;
      const cs = getComputedStyle(m);
      const border = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
      m.style.minWidth = `${m.clientWidth + delta - border}px`;
    }
    // 溢出兜底：菜单贴视口右缘时 width:max-content 的加宽仍可能向右外溢
    // （宿主对绝对定位盒的锚定/钳宽行为不一致），实测右缘溢出量后整体左移收进；
    // 左移又顶穿左缘的极窄视口则放弃位移，交由选项 ellipsis 吸收。
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const rect = m.getBoundingClientRect();
    const over = Math.ceil(rect.right - vw) + 2;
    if (over > 0) {
      m.style.right = `${over}px`;
      if (m.getBoundingClientRect().left < 2) m.style.right = '';
    }
    // ESC 关闭走 escManager 统一层序（C5）：私挂 document 级 ESC 监听会被 escManager 命中
    // 可见层后的 stopImmediatePropagation 抢先短路——宿主面板开着时按 ESC 整面板直关、下拉不动。
    // 立约见 esc-manager.ts：禁止私挂 document 级 ESC 监听，一律注册层级。
    escHandle = escManager.register('bz-ui-select', {
      isVisible: () => !!menu && menu.isConnected,
      close: () => close(),
    });
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

  /** 方向键导航：在当前菜单内移动 is-on 高亮 + aria-selected，Enter 确认（焦点保持在 el 上，高亮仅视觉指示） */
  const moveFocus = (delta: number) => {
    if (!menu) return;
    const curIdx = opts.options.findIndex((o) => o.value === current);
    const nextIdx = Math.min(opts.options.length - 1, Math.max(0, (curIdx < 0 ? 0 : curIdx) + delta));
    // 仅移动高亮（不落值）；Enter/Space 才提交
    opts.options.forEach((o, i) => {
      const item = menu?.querySelectorAll('.bz-select-item')[i] as HTMLElement | undefined;
      if (!item) return;
      const on = i === nextIdx;
      item.classList.toggle('is-on', on);
      item.setAttribute('aria-selected', String(on));
    });
  };

  el.addEventListener('click', () => {
    if (menu) close();
    else open();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (menu) {
        // 菜单开着：提交当前高亮项
        const on = menu?.querySelector<HTMLElement>('.bz-select-item.is-on');
        if (on && on !== el) {
          const v = opts.options[Number(on.dataset.index)];
          if (v) {
            setValue(v.value);
            opts.onChange(v.value);
          }
        }
        close();
      } else open();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!menu) open();
      moveFocus(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Escape') {
      close();
    }
  });
  // 点外部关闭（点 el 自身已由上方开合处理，这里只关不误开；ESC 不在此挂——走 escManager 层，C5）。
  // 句柄持有供 detach 移除，避免每次实例永久泄漏全局监听（L5）
  const onDocClick = (e: MouseEvent) => {
    if (menu && !el.contains(e.target as Node)) close();
  };
  document.addEventListener('click', onDocClick);
  return {
    el,
    setValue,
    detach: () => {
      document.removeEventListener('click', onDocClick);
      close(false);
    },
  };
}
