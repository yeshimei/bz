/* ============================================================
 * bz 组件库 · 行级说明浮窗（src/core/ui/help-tip.ts）
 * attachHelpTip：把**已有元素**（设置行的标题）变成说明入口 ——
 *   桌面：鼠标停在标题上约 180ms 出浮窗，移开即收（点击可钉住）；
 *   触屏：点标题开合（手指没有 hover），点外面 / 滚一下即收。
 *   静态零痕迹：不生成图标、不加箭头，只有标题本身 + hover 时的点状下划线提示
 *   （2026-09-26 用户拍板：「hover 标题，移动端点击标题」——此前挂在标题旁的问号圆
 *   图标被否，标题旁常驻任何图元都是噪点）。
 *
 * 正文就是一段普通文字（要分段用 `\n`，不写清单/小标题）——把 desc 说不完的那点补上，
 *   两三句为限。
 *
 * 与既有两件浮层的分工（别混用）：
 *   - uiPopover（.bz-popover）= input 锚定的**候选列表**（选分类/笔记）；
 *   - desc / note（.bz-sp-set-desc / -note）= 一行长度的常驻副文案；
 *   - attachHelpTip = 主动触发的说明浮窗。schema 侧声明 = 行字段 `help`。
 *
 * 浮层挂 document.body（position: fixed）而不是行内 absolute —— 设置行住在
 *   `.bz-sp-group`（overflow: hidden）+ 面板滚动区里，行内浮层会被卡片边缘裁掉。
 *   位置按锚点矩形现算：默认贴标题下方、空间不足向上翻、左右夹在视口内。
 * 开合同源：开挂 document pointerdown 外点 + escManager 层级（ESC）+ 滚动即关；
 *   全局同时只留一个浮窗（新开先关旧）。
 * 已知取舍：锚点不可聚焦（标题不进 tab 序列——设置面板的键盘导航留给搜索与控件），
 *   故键盘用户没有入口；要补的话给锚点挂 tabindex + focus 显形，口径同 hover。
 * ============================================================ */
import { escManager } from '../esc-manager';
import { topifyZ } from '../z-order';

export interface BzHelpTipOpts {
  /** 说明正文（一段普通文字；要分段用 `\n`） */
  text: string;
  /**
   * 宿主皮肤类（同 openPathPicker 口径，ADR-0127）：浮窗挂 body，够不着面板作用域的
   * `--sp-*`；设置面板传 'bz-sp-skin' 即自动同皮（皮肤类自带 token 声明 + `--bz-*` 重定向）。
   */
  skinClassName?: string;
}

/** 悬停停顿阈值（ms）：鼠标扫过页面时不该一行行弹窗，停一下才出 */
const HOVER_OPEN_DELAY = 180;
/** 移出后收起的缓冲（ms）：从标题挪到浮窗上给够时间 */
const CLOSE_DELAY = 140;
/** 触屏判定（tap 的合成 mouseenter 刚开过窗，紧接着的 click 按「钉住」算而非「开→关」） */
const SYNTHETIC_TAP_MS = 400;

/** 当前已打开的浮窗关闭函数（全局唯一：新开先关旧，防重渲染后残留） */
let currentClose: (() => void) | null = null;

/** 正文 → 节点（`\n` 分行；`- ` 开头渲染成列表项——底部罗列数据文件这类清单用；
 *  其余行按普通段落。不认小标题/警示条那套语法） */
function bodyNodes(text: string): Node[] {
  const out: Node[] = [];
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const isItem = line.startsWith('- ');
    const el = document.createElement('div');
    el.className = isItem ? 'bz-help-li' : 'bz-help-p';
    el.textContent = isItem ? line.slice(2).trim() : line;
    out.push(el);
  }
  return out;
}

/**
 * 给锚点元素挂说明浮窗（就地改造：加 `.bz-help-anchor` 语义类，由样式给 cursor 与 hover 提示）。
 * 浮窗按需创建：不打开时不产生任何 DOM。
 */
export function attachHelpTip(anchor: HTMLElement, opts: BzHelpTipOpts): void {
  anchor.classList.add('bz-help-anchor');

  let layer: HTMLDivElement | null = null;
  let escHandle: ReturnType<typeof escManager.register> | null = null;
  /** 钉住（点击开）：钉住后鼠标移开不关，再点 / ESC / 外点才关 */
  let pinned = false;
  let overAnchor = false;
  let overLayer = false;
  let openedAt = 0;
  let closeTimer: number | null = null;
  let openTimer: number | null = null;

  const isOpen = (): boolean => !!layer;

  const clearTimers = (): void => {
    if (closeTimer !== null) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
    if (openTimer !== null) {
      window.clearTimeout(openTimer);
      openTimer = null;
    }
  };

  const onOutside = (e: Event): void => {
    const t = e.target as Node | null;
    if (t && (anchor.contains(t) || layer?.contains(t))) return;
    close();
  };
  /** 滚动即关（capture：滚的是哪个祖先都收得到——浮层挂 body 不会跟着滚，留着就错位） */
  const onScroll = (): void => close();

  const place = (): void => {
    if (!layer) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const h = layer.offsetHeight;
    const w = layer.offsetWidth;
    // 默认贴标题下方；下方不够且上方更宽裕 → 向上翻
    const below = vh - r.bottom;
    const up = below < h + 12 && r.top > below;
    // 纵向钳制：优先贴锚点下方 / 上方，两个方向都不够时把整窗塞进视口（长清单也不截断，
    // 由位置让路——浮窗不设限高、不出滚动条，见 components.css .bz-help-pop）
    const top = Math.min(Math.max(12, up ? r.top - h - 8 : r.bottom + 8), Math.max(12, vh - h - 12));
    const left = Math.min(Math.max(12, r.left), Math.max(12, vw - w - 12));
    layer.style.top = `${top}px`;
    layer.style.left = `${left}px`;
    layer.classList.toggle('is-up', up);
  };

  function close(): void {
    clearTimers();
    pinned = false;
    overAnchor = false;
    overLayer = false;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', place);
    escHandle?.unregister();
    escHandle = null;
    layer?.remove();
    layer = null;
    anchor.classList.remove('is-open');
    if (currentClose === close) currentClose = null;
  }

  function open(): void {
    if (layer || !anchor.isConnected) return;
    if (currentClose && currentClose !== close) currentClose(); // 全局只留一个浮窗
    const pop = document.createElement('div');
    pop.className = 'bz-help-pop' + (opts.skinClassName ? ' ' + opts.skinClassName : '');
    pop.setAttribute('role', 'tooltip');
    for (const n of bodyNodes(opts.text)) pop.appendChild(n);
    pop.addEventListener('mouseenter', () => { overLayer = true; });
    pop.addEventListener('mouseleave', () => {
      overLayer = false;
      if (!pinned) scheduleClose();
    });
    document.body.appendChild(pop);
    topifyZ(pop); // 动态发号（ADR-0067）：面板/弹窗/通知各层之上
    layer = pop;
    openedAt = Date.now();
    place();
    anchor.classList.add('is-open');
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    escHandle = escManager.register('bz-help-tip', { isVisible: isOpen, close });
    currentClose = close;
  }

  function scheduleClose(): void {
    if (pinned) return;
    if (closeTimer !== null) window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      closeTimer = null;
      if (!pinned && !overAnchor && !overLayer) close();
    }, CLOSE_DELAY);
  }

  // 桌面：停顿即开（扫过不弹）；移开即收
  anchor.addEventListener('mouseenter', () => {
    overAnchor = true;
    if (isOpen() || openTimer !== null) return;
    openTimer = window.setTimeout(() => {
      openTimer = null;
      if (overAnchor) open();
    }, HOVER_OPEN_DELAY);
  });
  anchor.addEventListener('mouseleave', () => {
    overAnchor = false;
    if (openTimer !== null) {
      window.clearTimeout(openTimer);
      openTimer = null;
    }
    scheduleClose();
  });
  // 触屏：点标题开合（也是桌面点击的钉住入口）
  anchor.addEventListener('click', (e) => {
    e.stopPropagation(); // 不连锁行内/卡片点击
    // tap 的合成 mouseenter 已经把窗开了（<400ms）→ 这次 click 只是「钉住」，
    // 否则会「开→立刻关」，浮窗一闪而过
    if (isOpen() && Date.now() - openedAt < SYNTHETIC_TAP_MS) {
      pinned = true;
      return;
    }
    if (isOpen()) close();
    else {
      open();
      pinned = true;
    }
  });
}
