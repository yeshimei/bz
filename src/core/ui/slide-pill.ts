/* ============================================================
 * bz 组件库 · 滑动底片（src/core/ui/slide-pill.ts）
 * 一块滑动高亮：容器里放一片绝对定位底片（.bz-slide-pill），位置与尺寸按目标项矩形驱动。
 * - 悬停跟随：鼠标落到哪一项，底片滑到哪一项；
 * - 离开回落：鼠标离开容器 → 滑回当前选中项；
 * - 点击固定：选中项由渲染结果决定，渲染后按键重新解析（悬停中的项重渲染后仍按同一键锁定）。
 * 底片与监听挂在**容器**上：各域渲染都会重写容器的 innerHTML，挂在项上会被一起冲掉。
 * 悬停只在有悬浮能力的设备上接（触屏不许悬浮态粘住）。
 * 收编影院（侧栏 rail / 排序钮 seg）与备忘录（侧栏场景 / 排序钮）两处同类实现，
 * 禁止域内各写一份。
 * ============================================================ */

/** 底片类名（容器直接子元素；定位/过渡在 components.css 的 .bz-slide-pill） */
export const BZ_PILL_CLS = 'bz-slide-pill';

/** 悬停能力（触屏不给悬浮态；matchMedia 缺失按无悬停处理）。
 *  刻意不导出：影院 / 游戏库各持一份同名判定（等跨域收口批统一下提），
 *  这里只为底片的悬停跟随自用，别再多一处调用点。 */
function hoverCapable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

/** 一个滑动底片的挂载点描述 */
export interface BzSlidePillTarget {
  /** 容器（底片的宿主，需 position: relative；选择器相对 root 查） */
  box: string;
  /** 候选项选择器（容器内） */
  item: string;
  /** 项的稳定键：按序取第一个有值的 data- 字段（不含 data- 前缀） */
  keys: readonly string[];
  /** 选中项类名（默认 is-on） */
  onClass?: string;
  /** 可滚祖先选择器：项滚出该祖先可视区时不画底片（底片挂在容器上不会被祖先裁掉） */
  clip?: string;
}

/** 项的稳定键（渲染后按键重新解析悬停项） */
export function pillKeyOf(el: HTMLElement, keys: readonly string[]): string {
  for (const k of keys) {
    const v = el.dataset[k];
    if (v) return v;
  }
  return '';
}

/** 绑定一次（容器被重渲染换掉时随新元素重绑）：悬停跟随 / 离开回落 / 滚动重定位。
 *  必须**先于**任何落位早退执行——首帧没有几何（测试环境 / 尚未布局）就早退的话，
 *  监听会永远绑不上，之后无论怎么悬停滚都不再重定位。 */
function ensurePillBound(box: HTMLElement, t: BzSlidePillTarget, hoverable: boolean): void {
  if (box.dataset.pillBound) return;
  box.dataset.pillBound = '1';
  const resync = (animate: boolean): void => syncSlidePill(box, t, hoverable, animate);
  if (hoverable) {
    box.addEventListener('mouseover', (e) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(t.item);
      if (!el || !box.contains(el)) return;
      const k = pillKeyOf(el, t.keys);
      if (!k || box.dataset.pillHover === k) return; // 同一项内移动不重排
      box.dataset.pillHover = k;
      resync(true);
    });
    box.addEventListener('mouseleave', () => {
      if (!box.dataset.pillHover) return;
      delete box.dataset.pillHover;
      resync(true);
    });
  }
  // 容器（或祖先）可滚：滚动时即时落位，别让底片追着滑
  box.addEventListener('scroll', () => resync(false), true);
}

/** 重定位一块滑动底片。`animate=false` 用于渲染/滚动后落位（不演滑行） */
export function syncSlidePill(box: HTMLElement, t: BzSlidePillTarget, hoverable: boolean, animate = true): void {
  ensurePillBound(box, t, hoverable);
  const onClass = t.onClass ?? 'is-on';
  let pill = box.querySelector<HTMLElement>(`:scope > .${BZ_PILL_CLS}`);
  if (!pill) {
    pill = document.createElement('span');
    pill.className = BZ_PILL_CLS;
    pill.setAttribute('aria-hidden', 'true'); // 纯装饰：选中语义仍在选中类上（读屏不重复）
    // 宿主必须是定位上下文：static 的话绝对定位的底片会去相对更外层的祖先（整块底色跑到面板
    // 别处，且是静默的、极难查）。这里补一刀兜底，省得每域都记着给容器加 position: relative。
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    box.prepend(pill);
  }
  const items = [...box.querySelectorAll<HTMLElement>(t.item)];
  const hoverKey = box.dataset.pillHover ?? '';
  // 悬停项按键现取（渲染后是同一键的新元素）；没有悬停或悬停项已消失 → 回落到选中项
  const hovered = hoverKey ? items.find((el) => pillKeyOf(el, t.keys) === hoverKey) : undefined;
  const target = hovered ?? items.find((el) => el.classList.contains(onClass));

  if (!target) { pill.classList.remove('is-visible'); return; }
  const r = target.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  // 滚出可视区的项不画
  if (t.clip) {
    const sc = target.closest<HTMLElement>(t.clip);
    if (sc) {
      const sr = sc.getBoundingClientRect();
      if (r.bottom < sr.top + 1 || r.top > sr.bottom - 1) { pill.classList.remove('is-visible'); return; }
    }
  }
  if (!animate) pill.classList.add('is-instant');
  pill.style.width = `${Math.round(r.width)}px`;
  pill.style.height = `${Math.round(r.height)}px`;
  pill.style.transform = `translate(${Math.round(r.left - b.left)}px, ${Math.round(r.top - b.top)}px)`;
  pill.classList.add('is-visible');
  // 即时落位只这一次：强制 reflow 提交后立刻恢复过渡，否则之后悬停也不演滑行
  if (!animate) { void pill.offsetWidth; pill.classList.remove('is-instant'); }
}

/** 渲染后重定位全部滑动底片（底片坐在选中项上；悬停中的项按键续锁，落位不演滑行） */
export function syncSlidePills(root: HTMLElement, targets: readonly BzSlidePillTarget[], hoverable = hoverCapable()): void {
  for (const t of targets) {
    const box = root.querySelector<HTMLElement>(t.box);
    if (box) syncSlidePill(box, t, hoverable, false);
  }
}
