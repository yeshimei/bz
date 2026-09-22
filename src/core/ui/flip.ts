/* ============================================================
 * bz 组件库 · 重排动效三件套（src/core/ui/flip.ts）
 * 整块重写 innerHTML 的列表要演"重排"，得把三个语义分开处理：
 *   - **留下来的件**：知道它从哪来 → FLIP 补位（移动）
 *   - **消失的件**：渲染后已经没了 → 按旧矩形留一枚幽灵淡出（离场）
 *   - **新出现的件**：没有来处 → 前若干张接力入场（进场）
 * 用法固定两步：渲染**前** `measureFlip` 量旧矩形，渲染**后** `playFlip` 演。
 * 量/演分离是刻意的——渲染中间那一步由调用方决定（可能还夹着滚位恢复）。
 * ============================================================ */

/** ⚠️ WAAPI 安全包装。**jsdom（测试环境）没有 Element.animate**，直接调用会抛 TypeError 并
 *  中断整条渲染路径——卡片就永远渲染不出来（之前写错 easing 也是同一种死法：一个动画 API
 *  的异常把业务全带走了）。没有 WAAPI 时返回 null，调用方按「不演」处理。
 *  easing 写错（比如传了 var(--x)）会抛，这里一并兜住。 */
export function safeAnimate(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (typeof el.animate !== 'function') return null;
  try {
    return el.animate(frames, opts);
  } catch (e) {
    console.error('[flip] 动画不可用，跳过：', e);
    return null;
  }
}

/** FLIP 的补位时长（与 --bz-dur-base 同口径：空间位移档） */
const FLIP_DUR = 200;

/** ⚠️ WAAPI 的 easing **只认关键字或 cubic-bezier 字面量**，写 `var(--bz-ease-out)` 会抛
 *  「not a valid value for easing」并中断整个脚本。样式侧（CSS transition）照旧用 var()，
 *  这里是与 --bz-ease-out（cubic-bezier(0.33,1,0.68,1)）逐字同值的一份字面量。 */
const EASE_OUT = 'cubic-bezier(0.33, 1, 0.68, 1)';

export interface FlipEnterOpts {
  /** 接力张数上限（长列表只给前几张，省下几百个合成层） */
  n?: number;
  /** 每张之间的步进（ms） */
  stagger?: number;
  /** 入场方向：从右前方推入（视图切换）还是自下浮入（过滤） */
  from?: 'right' | 'bottom';
}

export interface FlipOpts {
  /** 容器内的候选项选择器 */
  item: string;
  /** 稳定键的 dataset 名（不含 data- 前缀）——跨渲染按它配对，认的是"同一个东西" */
  key: string;
  /** 补位时长（缺省 200ms） */
  dur?: number;
  /** 消失的件是否留幽灵淡出（缺省 true） */
  ghost?: boolean;
  /** 幽灵的底色类（缺省走 core 的 .bz-flip-ghost；域内想换色就传自己的类） */
  ghostClass?: string;
  /** 新出现的件接力入场；false / 不传 = 不演（原地刷新别整屏闪） */
  enter?: FlipEnterOpts | false;
  /** 补位时给每张件一点抛起旋转（度）——「重新发牌」那种观感；0/缺省 = 纯平移 */
  spin?: number;
}

/** 渲染前量：键 → 矩形。取不到键的件跳过（它们不参与配对） */
export function measureFlip(root: HTMLElement, item: string, key: string): Map<string, DOMRect> {
  const m = new Map<string, DOMRect>();
  root.querySelectorAll<HTMLElement>(item).forEach((n) => {
    const k = n.dataset[key];
    if (k) m.set(k, n.getBoundingClientRect());
  });
  return m;
}

/** 渲染后演：补位 + 幽灵 + 接力。`before` 为 null 表示没有旧状态（首渲染）→ 只演接力 */
export function playFlip(root: HTMLElement, before: Map<string, DOMRect> | null, opts: FlipOpts): void {
  const dur = opts.dur ?? FLIP_DUR;
  const rr = root.getBoundingClientRect();
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(opts.item));
  const seen = new Set<string>();

  // 1) 留下来的件：FLIP 补位（transform 动画，全程不触布局）。
  //    spin 给了就顺手抛起一点旋转——「重新发牌」的观感全靠它，落地位移本身是直的。
  const spin = opts.spin ?? 0;
  nodes.forEach((n, vi) => {
    const k = n.dataset[opts.key];
    if (!k) return;
    seen.add(k);
    const a = before?.get(k);
    if (!a) return;
    const b = n.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const deg = spin ? (vi % 2 ? spin : -spin) : 0;
    n.style.transition = 'none';
    n.style.transform = `translate(${dx}px, ${dy}px) rotate(${deg}deg) scale(${spin ? 0.96 : 1})`;
    if (spin) n.style.zIndex = '4';
    requestAnimationFrame(() => {
      n.style.transition = spin
        ? `transform ${dur + 60}ms cubic-bezier(0.34, 1.3, 0.5, 1)`
        : `transform ${dur}ms var(--bz-ease-out)`;
      n.style.transform = 'rotate(0deg) scale(1)';
      window.setTimeout(() => {
        n.style.transition = '';
        n.style.transform = '';
        if (spin) n.style.zIndex = '';
      }, dur + 100);
    });
  });

  // 2) 消失的件：按旧矩形留一枚幽灵淡出（不吃渲染时序，也不与软渲染抢管道）。
  //    视口外的旧件不演——一屏几十张时只给看得见的几张留残影。
  if (opts.ghost !== false && before) {
    let i = 0;
    before.forEach((r, k) => {
      if (seen.has(k)) return;
      if (r.bottom < rr.top || r.top > rr.bottom || r.width < 1) return;
      // ⚠️ 旧矩形是**视口坐标**，而 absolute 相对的是容器的内容区（padding box）——
      // 容器带滚动时两者差一个 scrollTop/scrollLeft。不加的话，滚到列表中部再切场景/
      // 敲搜索，残影会整体偏上（偏的距离正好是 scrollTop），列表短、不滚动时看不出来。
      const g = document.createElement('div');
      g.className = 'bz-flip-ghost' + (opts.ghostClass ? ' ' + opts.ghostClass : '');
      g.style.cssText = `position:absolute;left:${Math.round(r.left - rr.left + root.scrollLeft)}px;`
        + `top:${Math.round(r.top - rr.top + root.scrollTop)}px;`
        + `width:${Math.round(r.width)}px;height:${Math.round(r.height)}px`;
      root.appendChild(g);
      const ga = safeAnimate(g, [
        { opacity: 0.9, transform: 'none', filter: 'blur(0px)' },
        { opacity: 0, transform: 'translateY(6px) scale(0.97)', filter: 'blur(3px)' },
      ], { duration: 240, delay: Math.min(i, 10) * 22, easing: 'ease', fill: 'forwards' });
      if (!ga) { g.remove(); return; } // 无 WAAPI：别留一枚不淡出的幽灵在列表里
      ga.onfinish = () => g.remove();
      i++;
    });
  }

  // 3) 新出现的件：接力入场。只在「内容身份变了」时由调用方开这个开关——
  //    标星 / 后台回填 / 保存这类原地刷新只演补位，免得每次刷新整屏都在闪。
  if (opts.enter) {
    const n = opts.enter.n ?? 12;
    const stagger = opts.enter.stagger ?? 26;
    const from = opts.enter.from ?? 'bottom';
    let idx = 0;
    nodes.forEach((el) => {
      const k = el.dataset[opts.key];
      if (!k || before?.has(k)) return;
      if (idx >= n) { el.style.opacity = ''; return; }
      const delay = idx * stagger;
      idx++;
      const fromCss = from === 'right'
        ? 'translateX(22px) scale(0.96)'
        : 'translateY(6px) scale(0.99)';
      const ea = safeAnimate(el, [
        { opacity: 0, transform: fromCss, filter: 'blur(3px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      ], { duration: 300, delay, easing: EASE_OUT, fill: 'both' });
      if (!ea) { el.style.opacity = ''; return; } // 无 WAAPI：宁可不演，也不能让卡片停在 opacity 0
      ea.onfinish = () => { el.style.opacity = ''; };
    });
  }
}
