/**
 * 设置面板动效层（2026-09-23 动效批，用户命题：为设置面板补它自己的动效语义世界，布局零改动）。
 *
 * ── 语义词汇表：设置面板 = 一台仪器的「校准台」——每枚拨杆拨到位、每格读数收进槽位，
 *    台面都要给一声确认的回响；通电即亮，翻层揭帘，灯下有尘。动效全部从这里长出来，
 *    不借书库/收藏的招。──
 *   通电        面板打开：遮罩睁眼 + 台面立起。桌面壳走 core 居中链（fixed + translate
 *               (-50%,-50%)），位移关键帧必须自带居中位移，否则台面瞬移出屏；移动壳的
 *               transform 被 !important 钉死（动画值被层叠盖掉，永远 none），只做睁眼。
 *   翻层        切域/重渲：分组卡依次「揭帘」（clip-path 自上而下揭示 + 轻浮 + 微缩），
 *               行件只做 transform 微浮——行不碰 opacity：isChild 行 CSS 终态 opacity .6，
 *               动画帧 opacity 1 收场回 CSS 会闪一帧；fill backwards 播完回 CSS 终态才是
 *               零跳变。加载失败页与搜索过滤（功能性显隐）不编场。
 *   萤标        左栏导航选中项背后的一团柔光：拨动分区时它以弹簧滑过去，带一点过冲回摆
 *               （spring-阻尼积分，持续趋近系统 #1）。光垫在实底后面（side 内 prepend），
 *               从选中项四周露出——光晕不与选中态实底抢色。持续活着：滚动/重建后它一直
 *               追着选中项。
 *   灯下尘      内容区上方一层常驻微尘 canvas：台灯下的浮尘绕各自锚点缓缓漂移（build 期
 *               种子 rng + 纯 t 正弦，无逐帧随机），指针划过时被气流推开，随后被「回家
 *               弹簧」缓缓拽回锚位（pointer 力场 + spring-阻尼，持续活着系统 #2）。
 *   拨杆        开关切换：轨道一记按弹 + 到位微光（通电确认）；旋钮滑行归 CSS transition。
 *   旋钮位      下拉选定：触发器提亮一拍 + 箭头回弹。菜单展开克制——2026-09-11 用户拍板
 *               「弹出菜单不要过度动效」，本层不给菜单加入场。
 *   选卡        choiceCards 选定：卡按实 + 提亮一拍（mini 预览跟着亮一下）。
 *   入槽        文本/数字/密钥提交落盘：极轻一呼吸（已收进槽位；轻到不打断输入流）。
 *   卡簧弹回    数字校验拒绝（R9 非法输入不写入）：摇头 + 红晕一闪——色彩反馈走 CSS 类
 *               transition（与「滑轨动画归 CSS」同口径），位移走 transform，几何零改写。
 *   规整        数字被钳制回显：轻弹一记（值被修正到位，是「规整」不是「拒绝」）。
 *   按压        按钮/开关/选卡/chip/导航项/页头重置钮：按实微陷，松手回弹——硬料旋钮手感
 *               （委托绑 popup，行重建免疫）。
 *   危险位      「重置本域」：hover 色温转警示暖红（CSS transition 承担）；确认后整层重揭
 *               （复用翻层，renderDomain 重走）。
 *   空层        空态：轻浮一次（一次性揭示，克制）。
 *
 * ── 纪律（与 cinema/favorites/home 动效批同口径） ──
 *  - 纯浏览器 API，不 import obsidian / core 服务（评审壳与插件两侧同跑）。
 *  - 台账 fast 160 / move 200 / base 280 / impulse 740，接力 30ms；揭示 out 曲线、
 *    位移 move 曲线。
 *  - reduced-motion（评审期口径）：默认无视系统「减少动态效果」放完整演出；?rm=1 显式
 *    直达终态。jsdom / 无 WAAPI 宿主经 waapi 落最后一帧，域内测试零感知。
 *  - 注入件（萤标/灯下尘画布）一律 absolute + pointer-events:none + aria-hidden；只动
 *    transform/opacity/filter/clip-path，几何零改写，终态 UI 与无动效版一致。
 *  - rAF 单泵：萤标弹簧与灯下尘共用同一泵，泵空自停，220ms 定时兜底（宿主节流时演出
 *    继续推进）；每帧 getBoundingClientRect 0 次（萤标坐标由事件驱动的 sync 更新，尘光
 *    尺寸走 ResizeObserver/scroll 缓存）；粒子 ≤60；尘光随面板 hide 睡眠、重开唤醒，
 *    cleanup/unload 全清（motionTeardown 幂等）。
 *  - markup 纯层一字不改；本层只在 ui.ts / renderer.ts 生命周期挂点被调用。
 */

/* ================= 台账与口径 ================= */

const M = { fast: 160, move: 200, base: 280, impulse: 740 } as const;
const E = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
} as const;
const STAG = 30;

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，见文件头）。 */
function reduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}
function canHover(): boolean {
  try { return typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches; }
  catch { return false; }
}

/** 安全 WAAPI：?rm=1 时直达终态（落最后一帧）；否则真实演出，宿主不支持也落终态 */
function waapi(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || reduced() || typeof el.animate !== 'function') {
    const last = frames[frames.length - 1];
    if (el && last) for (const k of Object.keys(last)) {
      if (k === 'offset') continue;
      try { (el.style as unknown as Record<string, string>)[k] = String((last as Record<string, unknown>)[k]); } catch { /* 不可内联属性忽略 */ }
    }
    return null;
  }
  try { return el.animate(frames, opts); } catch { return null; }
}

/** 延时调度（面板级取消，防快速刷新时编排叠加） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/* ================= rAF 单泵（萤标弹簧 + 灯下尘共用；泵空自停 + 220ms 定时兜底） ================= */

type PumpTick = (now: number) => void;
const pumpTicks = new Set<PumpTick>();
let pumpRaf = 0;
let pumpGuard = 0;

function pumpFrame(now: number): void {
  pumpRaf = 0;
  for (const tick of [...pumpTicks]) {
    try { tick(now); } catch { /* 单个系统异常不拖垮泵；下一轮由收敛/清场自然收尾 */ }
  }
  if (pumpTicks.size) pumpEnsure();
}
function pumpEnsure(): void {
  if (pumpRaf || typeof requestAnimationFrame !== 'function') return;
  pumpRaf = requestAnimationFrame(pumpFrame);
}
function pumpStart(): void {
  pumpEnsure();
  if (!pumpGuard && typeof window !== 'undefined' && typeof window.setInterval === 'function') {
    // 220ms 兜底：rAF 被宿主节流/丢失时演出仍被推进（代价极低：空转只查一个布尔）
    pumpGuard = window.setInterval(() => { if (pumpTicks.size && !pumpRaf) pumpEnsure(); }, 220);
  }
}
function pumpAdd(tick: PumpTick): void {
  pumpTicks.add(tick);
  pumpStart();
}
function pumpDel(tick: PumpTick): void {
  pumpTicks.delete(tick);
  if (!pumpTicks.size && pumpGuard) { clearInterval(pumpGuard); pumpGuard = 0; }
}

/* ================= 通电：面板打开 / 软重开唤醒 ================= */

/**
 * 开面板 = 通电：遮罩睁眼 + 台面立起。桌面壳的关键帧自带 translate(-50%,-50%) 居中位移
 * （WAAPI 值整体覆盖 CSS transform，丢了居中链台面就瞬移出屏）；移动壳 transform 被
 * !important 钉死，只做睁眼（位移帧写了也会被层叠盖掉，不如不写）。
 * 软重开（hide 后 open）同样走这里——唤醒感一致；内联残留每次进场均先清。
 */
export function motionPanelIn(popup: HTMLElement, mask?: HTMLElement | null): void {
  if (!popup) return;
  popup.style.opacity = '';
  popup.style.filter = '';
  if (mask) { mask.style.opacity = ''; waapi(mask, [{ opacity: 0 }, { opacity: 1 }], { duration: M.move + 40, easing: E.out }); }
  if (popup.classList.contains('bz-sp-mobile')) {
    waapi(popup,
      [{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)' }],
      { duration: M.base + 60, easing: E.out });
    return;
  }
  // 桌面：台面立起——起手略沉、微缩带糊，收平（末帧与 core 居中链的 CSS transform 同值）
  waapi(popup,
    [{ opacity: 0, transform: 'translate(-50%, calc(-50% + 16px)) scale(.976)', filter: 'blur(9px)' },
     { opacity: 1, transform: 'translate(-50%, calc(-50% - 2px)) scale(1.004)', offset: .72 },
     { opacity: 1, transform: 'translate(-50%, -50%)', filter: 'blur(0px)' }],
    { duration: M.base + 180, easing: E.out });
}

/* ================= 翻层：域渲染完成的揭帘编排 ================= */

/**
 * 域渲染落定（DOM 已全部就位后才调——本函数绝不推迟重写，契约同 favorites「重写先行」）：
 * 页头先落 → 分组卡依次揭帘（前 8 张，其余同波收尾）→ 每组前几行轻浮 → 空态浮起。
 * 行不碰 opacity（isChild 终态 .6 陷阱，见文件头），fill backwards 播完即回 CSS 终态。
 * 搜索命中过滤（applyHitFilter）是功能性显隐，不编场。
 */
export function motionRendered(pane: HTMLElement): void {
  if (!pane || !pane.isConnected) return;
  cancelPending(); // 新一层覆盖旧编排（切域/重渲快速连击防叠加）
  if (reduced()) return;

  /* —— 页头（域名/描述/重置钮/徽标）先落定 —— */
  const head = pane.querySelector<HTMLElement>('.bz-sp-page-head');
  if (head) {
    [...head.children].forEach((el, i) => {
      waapi(el as HTMLElement,
        [{ opacity: 0, transform: 'translateY(-5px)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base, delay: i * 40, easing: E.out, fill: 'backwards' });
    });
  }

  /* —— 分组卡：揭帘（clip 自上而下揭示 + 轻浮 + 微缩；蒙尘轻拂） —— */
  const groups = [...pane.querySelectorAll<HTMLElement>('.bz-sp-group')]
    .filter((g) => g.style.display !== 'none');
  groups.forEach((g, i) => {
    waapi(g,
      [{ opacity: 0, transform: 'translateY(12px) scale(.988)', clipPath: 'inset(0 0 100% 0)', filter: 'blur(4px)' },
       { opacity: 1, transform: 'translateY(3px) scale(.996)', clipPath: 'inset(0 0 -6% 0)', offset: .72, filter: 'blur(0px)' },
       { opacity: 1, transform: 'none', clipPath: 'inset(0 0 -6% 0)' }],
      { duration: M.base + 140, delay: 80 + Math.min(i, 7) * 70, easing: E.out, fill: 'backwards' });
    // 行件轻浮（transform-only：不碰 isChild 的 CSS 终态 opacity；前 6 行，其余托底不编）
    [...g.querySelectorAll<HTMLElement>(':scope .bz-sp-set-row')].slice(0, 6).forEach((row, j) => {
      if (row.style.display === 'none') return;
      waapi(row,
        [{ transform: 'translateY(7px)', filter: 'blur(2px)' }, { transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base, delay: 80 + Math.min(i, 7) * 70 + 60 + j * STAG, easing: E.out, fill: 'backwards' });
    });
  });

  /* —— 空层（空态）轻浮一次 —— */
  const empty = pane.querySelector<HTMLElement>('.bz-empty');
  if (empty && !groups.length) {
    waapi(empty,
      [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base + 60, delay: 160, easing: E.out, fill: 'backwards' });
  }
}

/**
 * 移动端域列表轻浮接力（buildMobile 的 render 重绘末尾调用；DOM 已就位的纯表现层）：
 * 前 12 项 30ms 接力上浮，其余直达（搜索防抖 180ms 高频重建，编排必须短促且可被
 * cancelPending 覆盖——不推迟任何 DOM 就位）。
 */
export function motionMobList(list: HTMLElement): void {
  if (!list || !list.isConnected || reduced()) return;
  const items = [...list.querySelectorAll<HTMLElement>('.bz-sp-mob-item')];
  items.forEach((el, i) => {
    if (i >= 12) return;
    waapi(el,
      [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, delay: Math.min(i, 11) * STAG, easing: E.out, fill: 'backwards' });
  });
}

/* ================= 萤标：导航选中柔光（spring-阻尼积分 · 持续系统 #1） ================= */

interface CursorState {
  side: HTMLElement;
  nav: HTMLElement;
  el: HTMLElement;
  x: number; y: number; vx: number; vy: number;
  tx: number; ty: number;
  init: boolean;
  tick: PumpTick;
  onScroll: () => void;
}
const cursorStates = new Map<HTMLElement, CursorState>(); // nav → state

/**
 * 挂/同步萤标：renderNav 每次重建导航后调用（幂等）。柔光垫在 nav 之下（side 内 prepend，
 * DOM 序保证实底画在光上），位置 = 当前 .on 项。无选中项（搜索过滤）时渐隐但继续跟随。
 * 弹簧积分：vx += (tx-x)*k → vx *= damp → x += vx，k .14 / damp .68 = 轻过冲回摆。
 * 坐标全部事件驱动（renderNav 重建/侧栏滚动时 sync），每帧零 getBoundingClientRect。
 */
export function motionNavSynced(nav: HTMLElement): void {
  if (!nav || reduced()) return;
  const side = nav.parentElement;
  if (!side) return;
  let st = cursorStates.get(nav);
  if (!st) {
    const el = document.createElement('span');
    el.className = 'bz-spm-cursor';
    el.setAttribute('aria-hidden', 'true');
    try { side.prepend(el); } catch { return; }
    st = {
      side, nav, el,
      x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, init: false,
      onScroll: () => motionNavSynced(nav),
      tick: (now: number) => {
        if (!st) return;
        void now;
        // spring-阻尼积分（帧单位步长；轻过冲 = 萤火落枝的回摆）
        st.vx = (st.vx + (st.tx - st.x) * 0.14) * 0.68;
        st.vy = (st.vy + (st.ty - st.y) * 0.14) * 0.68;
        st.x += st.vx; st.y += st.vy;
        st.el.style.transform = `translate3d(${st.x.toFixed(2)}px, ${st.y.toFixed(2)}px, 0)`;
        if (Math.abs(st.tx - st.x) < .3 && Math.abs(st.ty - st.y) < .3 && Math.abs(st.vx) < .05 && Math.abs(st.vy) < .05) {
          pumpDel(st.tick); // 收敛落定：泵空自停（下次 sync 再唤醒）
        }
      },
    };
    cursorStates.set(nav, st);
    // 侧栏滚动 → 重算一次（换算到内容坐标后，滚动中 tx/ty 其实不变——萤标随 side 一起滚，
    // 天然贴住选中项；这里的重算只为宽度/高度与搜索过滤后的落位兜底）
    side.addEventListener('scroll', st.onScroll, { passive: true });
  }
  const target = nav.querySelector<HTMLElement>('.bz-sp-nav-item.on');
  if (!target) {
    st.el.classList.remove('is-on'); // 搜索过滤无选中：光渐隐（CSS transition 承担）
    return;
  }
  const tr = target.getBoundingClientRect();
  const sr = st.side.getBoundingClientRect();
  // ⚠️ 坐标帧必须是「side 的内容坐标」，不是视口相对量：光标是 side 的绝对定位子元素
  // （.bz-spm-cursor absolute/left:0/top:0，containing block = side 的 padding box），它随
  // side 一起滚；而 tr.top - sr.top 是**视口**相对差 —— side 一滚就差出一个 scrollTop，
  // 萤标于是停在比选中项高 scrollTop 的位置（2026-09-23 用户报：点靠下的侧栏项，光晕留在
  // 上面几行）。补回 side 的滚动量才换算到内容坐标，滚动中萤标与选中项严丝合缝。
  st.tx = tr.left - sr.left + st.side.scrollLeft;
  st.ty = tr.top - sr.top + st.side.scrollTop;
  st.el.style.width = `${Math.max(1, tr.width).toFixed(1)}px`;
  st.el.style.height = `${Math.max(1, tr.height).toFixed(1)}px`;
  if (!st.init) {
    // 首次落位直接贴住（不要从 (0,0) 飞进来）
    st.init = true;
    st.x = st.tx; st.y = st.ty; st.vx = 0; st.vy = 0;
    st.el.style.transform = `translate3d(${st.tx.toFixed(2)}px, ${st.ty.toFixed(2)}px, 0)`;
  } else if (Math.abs(st.tx - st.x) > .5 || Math.abs(st.ty - st.y) > .5) {
    pumpAdd(st.tick); // 目标挪了：弹簧醒来追过去（幂等，泵内去重由 Set 保证）
  }
  st.el.classList.add('is-on');
}

/* ================= 灯下尘：常驻微尘力场（canvas 粒子 + spring 回家 · 持续系统 #2） ================= */

interface Mote {
  hx: number; hy: number;          // 锚点（home，build 期布点）
  ox: number; oy: number;          // 被扰动偏离锚点的位移（回家弹簧作用量）
  ovx: number; ovy: number;        // 偏移速度
  ax: number; ay: number;          // 漂移振幅
  fa: number; fb: number;          // 漂移频率（李萨如两轴异频）
  ph: number;                      // 相位（build 期 rng）
  tw: number;                      // 闪烁频率
  r: number;                       // 半径
  ink: boolean;                    // 少数为墨色尘（多数是暖橙光尘）
}
interface DustState {
  host: HTMLElement;
  fx: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  motes: Mote[];
  w: number; h: number;
  rect: { left: number; top: number };
  px: number; py: number;          // 指针位（相对 host；离场时甩到视野外）
  ro: ResizeObserver | null;
  onMove: (e: PointerEvent) => void;
  onLeave: () => void;
  onScroll: () => void;
  tick: PumpTick;
}
const dustStates = new Map<HTMLElement, DustState>(); // host → state
const DUST_MAX = 44; // 性能硬顶 ≤60：台灯下的浮尘贵在稀疏

/** build 期种子 rng（mulberry32；粒子布点/相位全部出自它——运行期零逐帧随机） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** hex → rgb（token 取色失败回落暖橙；暗皮 token 同格式） */
function hexToRgb(v: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function dustResize(st: DustState): void {
  const w = st.host.clientWidth;
  const h = st.host.clientHeight;
  if (w < 10 || h < 10) return;
  st.w = w; st.h = h;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  st.fx.width = Math.round(w * dpr);
  st.fx.height = Math.round(h * dpr);
  st.fx.style.width = `${w}px`;
  st.fx.style.height = `${h}px`;
  st.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  st.rect = readHostRect(st.host);
  // 粒子锚点按新尺寸重布（build 期 rng 固定种子重掷——确定性不变）
  const rng = mulberry32(20260923);
  for (const m of st.motes) {
    m.hx = rng() * w; m.hy = rng() * h;
  }
}

function readHostRect(host: HTMLElement): { left: number; top: number } {
  try {
    const r = host.getBoundingClientRect();
    return { left: r.left, top: r.top };
  } catch {
    return { left: 0, top: 0 };
  }
}

/**
 * 挂灯下尘（幂等）：内容滚动域（桌面 .bz-sp-desk-main / 移动 .bz-sp-mob-page-body）上层
 * 一块 absolute 画布。粒子模型 = 锚点 + 李萨如漂移（纯 t）+ 指针力场（半径 110 内顺气流
 * 推开）+ 回家弹簧（k .03 / damp .9，缓缓归位）。canvas 不可用宿主（jsdom）干净退出。
 */
export function motionEnsureDust(popup: HTMLElement): void {
  if (!popup || reduced()) return;
  const host = popup.querySelector<HTMLElement>('.bz-sp-desk-main') ??
    popup.querySelector<HTMLElement>('.bz-sp-mob-page-body');
  if (!host) return;
  // 已挂过（软重开/hide 后唤醒）：重新量尺寸 + 把 tick 挂回泵（Set 去重，幂等）
  const exist = dustStates.get(host);
  if (exist) {
    dustResize(exist);
    if (exist.fx.isConnected) pumpAdd(exist.tick);
    return;
  }
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    const probe = document.createElement('canvas');
    ctx = probe.getContext('2d');
  } catch { ctx = null; }
  if (!ctx) return; // 无 2d 上下文宿主：不注入（测试宿主零负担）

  const fx = document.createElement('canvas');
  fx.className = 'bz-spm-dust';
  fx.setAttribute('aria-hidden', 'true');
  host.appendChild(fx);
  const ctx2 = fx.getContext('2d');
  if (!ctx2) { fx.remove(); return; }

  // 取皮上两枚 token 当尘色（暖橙为主、墨色点缀；取不到回落定值）
  let accent: [number, number, number] = [201, 90, 40];
  let inkc: [number, number, number] = [122, 116, 102];
  try {
    const cs = getComputedStyle(host);
    accent = hexToRgb(cs.getPropertyValue('--sp-accent')) ?? accent;
    inkc = hexToRgb(cs.getPropertyValue('--sp-ink-2')) ?? inkc;
  } catch { /* 取色失败用回落 */ }

  const rng = mulberry32(20260923);
  const motes: Mote[] = [];
  for (let i = 0; i < DUST_MAX; i++) {
    motes.push({
      hx: 0, hy: 0, ox: 0, oy: 0, ovx: 0, ovy: 0,
      ax: 5 + rng() * 10, ay: 5 + rng() * 10,
      fa: .05 + rng() * .12, fb: .05 + rng() * .12,
      ph: rng() * Math.PI * 2, tw: .4 + rng() * 1.1,
      r: .7 + rng() * 1.5,
      ink: rng() < .22,
    });
  }
  const st: DustState = {
    host, fx, ctx: ctx2, motes, w: 0, h: 0,
    rect: { left: 0, top: 0 },
    px: -9999, py: -9999,
    ro: null,
    onMove: (e) => {
      st.px = e.clientX - st.rect.left;
      st.py = e.clientY - st.rect.top;
    },
    onLeave: () => { st.px = -9999; st.py = -9999; },
    onScroll: () => { st.rect = readHostRect(st.host); },
    tick: (_now: number) => {
      const now = _now || 0;
      if (!st.fx.isConnected) { disposeDust(host); return; }
      const t = now / 1000;
      const c = st.ctx;
      c.clearRect(0, 0, st.w + 2, st.h + 2);
      for (const m of st.motes) {
        // 环境漂移：绕锚点的李萨如（纯 t 函数，无随机）
        const dx = Math.sin(t * m.fa + m.ph) * m.ax;
        const dy = Math.cos(t * m.fb + m.ph * 1.7) * m.ay;
        // 指针力场：半径 110 内顺气流推开（平方衰减）
        const bx = m.hx + dx + m.ox;
        const by = m.hy + dy + m.oy;
        const fxp = bx - st.px;
        const fyp = by - st.py;
        const d2 = fxp * fxp + fyp * fyp;
        if (d2 < 110 * 110 && d2 > .01) {
          const d = Math.sqrt(d2);
          const push = (1 - d / 110) * (1 - d / 110) * 1.15;
          m.ovx += (fxp / d) * push;
          m.ovy += (fyp / d) * push;
        }
        // 回家弹簧（k .03 / damp .9：推得开、缓缓归位）
        m.ovx = (m.ovx - m.ox * 0.03) * 0.9;
        m.ovy = (m.ovy - m.oy * 0.03) * 0.9;
        m.ox += m.ovx; m.oy += m.ovy;
        const x = m.hx + dx + m.ox;
        const y = m.hy + dy + m.oy;
        if (x < -8 || x > st.w + 8 || y < -8 || y > st.h + 8) continue;
        // 呼吸闪烁：正弦纯 t（0.05~0.3 低透明，光尘不与文字抢眼）
        const a = 0.05 + 0.11 * (0.5 + 0.5 * Math.sin(t * m.tw + m.ph));
        const col = m.ink ? inkc : accent;
        // 光晕（大而淡）+ 尘核（小而实）
        c.globalAlpha = a * .5;
        c.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        c.beginPath(); c.arc(x, y, m.r * 2.6, 0, 7); c.fill();
        c.globalAlpha = a * 2;
        c.beginPath(); c.arc(x, y, m.r, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
    },
  };
  dustStates.set(host, st);
  dustResize(st);
  if (typeof ResizeObserver === 'function') {
    st.ro = new ResizeObserver(() => dustResize(st));
    st.ro.observe(host);
  }
  host.addEventListener('pointermove', st.onMove, { passive: true });
  host.addEventListener('pointerleave', st.onLeave, { passive: true });
  host.addEventListener('scroll', st.onScroll, { passive: true });
  pumpAdd(st.tick);
}

/** 摘灯下尘（teardown 用；句柄与监听全清） */
function disposeDust(host: HTMLElement): void {
  const st = dustStates.get(host);
  if (!st) return;
  pumpDel(st.tick);
  try { st.ro?.disconnect(); } catch { /* 宿主无 RO */ }
  try {
    st.host.removeEventListener('pointermove', st.onMove);
    st.host.removeEventListener('pointerleave', st.onLeave);
    st.host.removeEventListener('scroll', st.onScroll);
  } catch { /* 宿主已 detach */ }
  try { st.fx.remove(); } catch { /* 已随面板摘除 */ }
  dustStates.delete(host);
}

/* ================= 控件反馈：拨杆 / 旋钮位 / 选卡 / 入槽 / 卡簧弹回 ================= */

/** 开关拨杆：轨道一记按弹；开到位多一记提亮（通电确认）。旋钮滑行归 CSS transition。 */
export function motionSwitchFlip(sw: HTMLElement, on: boolean): void {
  if (!sw || reduced()) return;
  waapi(sw,
    on
      ? [{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.14)', offset: .38, filter: 'brightness(1.25)' }, { transform: 'none', filter: 'brightness(1)' }]
      : [{ transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: .4 }, { transform: 'none' }],
    { duration: M.base - 40, easing: E.out });
}

/** 下拉旋钮位：选定后触发器提亮一拍 + 箭头（.bz-select-car）回弹。菜单本体不加动效（用户拍板）。 */
export function motionSelectPick(sel: HTMLElement): void {
  if (!sel || reduced()) return;
  waapi(sel,
    [{ filter: 'brightness(1)' }, { filter: 'brightness(1.09)', offset: .45 }, { filter: 'brightness(1)' }],
    { duration: M.base - 60, easing: E.out });
  const car = sel.querySelector<HTMLElement>('.bz-select-car');
  if (car) {
    // 末帧恒写 rotate(90deg)（CSS 终态），箭头转过去再弹回来
    waapi(car,
      [{ transform: 'rotate(90deg)' }, { transform: 'rotate(112deg) scale(1.22)', offset: .42 }, { transform: 'rotate(90deg)' }],
      { duration: M.base - 20, easing: E.out });
  }
}

/** 选卡选定：按实 + 提亮一拍（mini 预览跟着亮一下）。 */
export function motionCardChoose(card: HTMLElement): void {
  if (!card || reduced()) return;
  waapi(card,
    [{ transform: 'scale(1)', filter: 'brightness(1)' },
     { transform: 'scale(.96)', offset: .3, filter: 'brightness(1.12)' },
     { transform: 'scale(1.03)', offset: .66 },
     { transform: 'none', filter: 'brightness(1)' }],
    { duration: M.base, easing: E.out });
}

/** 入槽：文本/数字/密钥提交落盘——极轻一呼吸（不挪几何不晃行，轻到不打断输入流）。 */
export function motionInputSaved(input: HTMLElement): void {
  if (!input || reduced()) return;
  waapi(input,
    [{ filter: 'brightness(1)' }, { filter: 'brightness(1.045)', offset: .5 }, { filter: 'brightness(1)' }],
    { duration: M.move + 60, easing: E.out });
}

/** 卡簧弹回：数字校验拒绝（R9 不写入回显旧值）——摇头 + 红晕一闪（红晕走 CSS 类 transition）。 */
export function motionInputReject(input: HTMLElement): void {
  if (!input || reduced()) return;
  waapi(input,
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)', offset: .22 },
     { transform: 'translateX(4px)', offset: .46 }, { transform: 'translateX(-2px)', offset: .72 },
     { transform: 'translateX(0)' }],
    { duration: M.base + 20, easing: E.out });
  input.classList.add('bz-spm-reject');
  after(M.base + 160, () => input.classList.remove('bz-spm-reject'));
}

/** 规整：数字被钳制回显（值被修正到位）——轻弹一记，不算拒绝。 */
export function motionInputAdjust(input: HTMLElement): void {
  if (!input || reduced()) return;
  waapi(input,
    [{ transform: 'scale(.985)' }, { transform: 'scale(1.012)', offset: .55 }, { transform: 'none' }],
    { duration: M.move + 40, easing: E.out });
}

/* ================= 按压手感（委托绑 popup，行/导航重建免疫） ================= */

const PRESS_SEL = '.bz-sp-btn, .bz-sw, .bz-sp-cardpick-card, .bz-sp-page-reset, .bz-sp-nav-item, .bz-sp-mob-item, .bz-btn';

/**
 * 按压实感：硬料旋钮——按住微陷 scale .955，松手过冲回弹。
 * 开关/选卡的后续切换反馈（SwitchFlip/CardChoose）会自然盖过回弹段，不打架。
 */
export function motionBindPressFeel(popup: HTMLElement): void {
  if (!popup || popup.dataset.spmFeel) return;
  popup.dataset.spmFeel = '1';
  const pressed = new WeakMap<HTMLElement, number>();
  popup.addEventListener('pointerdown', (e) => {
    if (reduced()) return;
    const el = (e.target as HTMLElement).closest?.(PRESS_SEL) as HTMLElement | null;
    if (!el || !popup.contains(el)) return;
    pressed.set(el, Date.now());
    waapi(el, [{ transform: 'scale(1)' }, { transform: 'scale(.955)' }], { duration: 110, easing: E.out, fill: 'forwards' });
  });
  const release = (e: Event): void => {
    const el = (e.target as HTMLElement).closest?.(PRESS_SEL) as HTMLElement | null;
    const target = el && pressed.has(el) ? el : null;
    if (!target) return;
    pressed.delete(target);
    waapi(target, [{ transform: 'scale(.955)' }, { transform: 'scale(1.02)', offset: .6 }, { transform: 'none' }], { duration: M.move + 40, easing: E.out });
  };
  popup.addEventListener('pointerup', release);
  popup.addEventListener('pointercancel', release);
}

/* ================= 导航悬停微浮（委托绑 nav，重建免疫） ================= */

export function motionBindNavFeel(nav: HTMLElement): void {
  if (!nav || nav.dataset.spmNavFeel) return;
  nav.dataset.spmNavFeel = '1';
  if (!canHover() || reduced()) return;
  nav.addEventListener('pointerover', (e) => {
    const item = (e.target as HTMLElement).closest?.('.bz-sp-nav-item') as HTMLElement | null;
    if (!item || item.classList.contains('on')) return;
    if ((e.relatedTarget as HTMLElement | null)?.closest?.('.bz-sp-nav-item') === item) return;
    waapi(item, [{ transform: 'translateY(0)' }, { transform: 'translateY(-1.5px)' }], { duration: M.fast, easing: E.out });
  });
  nav.addEventListener('pointerout', (e) => {
    const item = (e.target as HTMLElement).closest?.('.bz-sp-nav-item') as HTMLElement | null;
    if (!item) return;
    if ((e.relatedTarget as HTMLElement | null)?.closest?.('.bz-sp-nav-item') === item) return;
    waapi(item, [{ transform: 'translateY(-1.5px)' }, { transform: 'translateY(0)' }], { duration: M.fast, easing: E.out });
  });
}

/* ================= 睡眠 / 清场 ================= */

/**
 * 面板软关（hide）：编排定时器清空 + 双系统入睡（泵停；注入件留在 display:none 的壳里，
 * 重开 open 由 motionPanelIn / motionEnsureDust / renderNav→motionNavSynced 唤醒）。
 */
export function motionSleep(): void {
  cancelPending();
  for (const st of [...dustStates.values()]) pumpDel(st.tick);
  for (const st of cursorStates.values()) pumpDel(st.tick);
}

/**
 * 全清（cleanup / unload）：句柄、监听、注入件、内联演出残留全收。幂等，连调不抛。
 * 注入件本体随 popup.remove() 走，这里负责模块级 Map/泵/定时器不残留。
 */
export function motionTeardown(): void {
  cancelPending();
  for (const host of [...dustStates.keys()]) disposeDust(host);
  for (const st of [...cursorStates.values()]) {
    pumpDel(st.tick);
    try { st.el.remove(); } catch { /* 已随面板摘除 */ }
    try { st.side.removeEventListener('scroll', st.onScroll); } catch { /* 宿主已 detach */ }
  }
  cursorStates.clear();
  if (pumpRaf && typeof cancelAnimationFrame === 'function') { try { cancelAnimationFrame(pumpRaf); } catch { /* 已停 */ } }
  pumpRaf = 0;
  if (pumpGuard) { window.clearInterval(pumpGuard); pumpGuard = 0; }
  pumpTicks.clear();
}
