/**
 * 小橘动效层（2026-09-23 动效批：与影院/备忘录/首页同量级同打法，按小橘自己的语义出招）。
 *
 * 原则：
 *  - **只动表现，不动布局**——注入件（爪印/高光/思考波纹）全部绝对定位、不吃事件、
 *    aria-hidden、演出完自移除；入场只用 transform/opacity/filter，几何从不改写
 *    （数值条/作息柱的生长走 scaleX/scaleY，宽高内联值一字不碰）。
 *  - 台账对齐 cinema/motion.ts（issue 400 口径）：fast 160 / move 200 / base 280 /
 *    impulse 740，接力 30ms；揭示用 out 曲线，位移用 move 曲线。
 *  - reduced-motion（评审期口径）：默认**无视**系统设置放完整动画；?rm=1 显式模拟 RM
 *    直达终态。jsdom / 无 WAAPI 宿主全部编排静默跳过（渲染层已落终态），域测试零感知。
 *  - **boot 消费标志**：ensureSmartCat 装配完 motionMarkBoot() 置位，首个 motionCatArrival
 *    消费即熄——卸载重装才重播完整登场，其余一切重渲染静默。
 *  - **长驻循环句柄池**：英雄情绪呼吸、拖拽拎起挂起态（耳朵后贴 fill:forwards）全部
 *    入池管理；阶段切换（放下/换页签/面板关闭）与 motionTeardown 必收，禁止永动孤儿。
 *  - **退场纪律（首页线上 bug 教训）**：聊天/数据面板壳是关闭后不销毁的长驻节点——
 *    退场 fill:forwards 动画在收口前按 id 撤销（cancel），绝不把 opacity:0 钉到下一次打开；
 *    猫容器退场（slink）随节点销毁，无此顾虑。
 *  - 禁止 import obsidian / 任何 core 服务：纯浏览器 API，评审台与插件两侧都能跑。
 *
 * 语义词汇表（猫 / 爪印 / 尾巴 / 行为流——不抄他域特效）：
 *   arrival    登场     boot 首挂——从屏幕下缘跃上蹲稳，落地双爪印，尾巴定场一摆
 *   recall     召回     hide 后再唤——探头弹出 + 双耳抖
 *   slink      溜走     hide——压低身子溜下屏幕缘（随节点销毁）
 *   recoat     换毛     皮肤切换——一道高光从头扫到尾 + 抖毛
 *   lift/drop  拎起/放下 拖拽起止——耳朵后贴、尾巴绷住（被拎住的猫）；落地抖毛
 *   pet        抚摸     摸猫——爪印三连绽开
 *   muse       思考     绿点亮起——外圈 ping 一记（节流 400ms）
 *   pop/pin    气泡     弹出过冲 + 竖尾一摆（要说话了）；钉住轻弹一记
 *   chat       聊天台   开=上浮揭示+消息接力+输入行；关=下沉折回；
 *                       消息条=用户右入 / 小橘左入踱步 / 打字占位轻浮
 *   dash       档案台   开=揭示+页签接力；关=折回；boot 首屏编排=卡片接力 +
 *                       PAD 潮汐条生长 + 爪账数字滚动 + 作息柱拔节 + 英雄情绪呼吸
 *                       （驻场循环入池）；页签轻揭；行为流新批沿时间线踏入
 */

/* ================= 台账与口径 ================= */

const M = { fast: 160, move: 200, base: 280, impulse: 740 } as const;
const E = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
} as const;
const STAG = 30;

const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，见文件头）。 */
function reduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}

/** 动效可用（本域总闸）：无 DOM / 评审模拟 RM / 无 rAF 的宿主一律静默——
 *  渲染层已落终态，动效层零痕迹（jsdom 测试零感知的根）。 */
function enabled(): boolean {
  try {
    return typeof document !== 'undefined' && !reduced() && typeof requestAnimationFrame === 'function';
  } catch { return false; }
}

/** 安全 WAAPI：reduced() 直达终态（落最后一帧内联）；宿主不支持返回 null（不写任何样式） */
function waapi(
  el: HTMLElement,
  frames: Keyframe[],
  opts: { duration?: number; delay?: number; easing?: string; fill?: FillMode; id?: string; iterations?: number },
): Animation | null {
  if (!el || reduced() || typeof el.animate !== 'function') {
    const last = frames[frames.length - 1];
    if (el && reduced() && last) {
      for (const k of Object.keys(last)) {
        if (k === 'offset') continue;
        try { (el.style as unknown as Record<string, string>)[k] = String((last as Record<string, unknown>)[k]); } catch { /* 不可内联属性忽略 */ }
      }
    }
    return null;
  }
  try {
    return el.animate(frames, {
      duration: opts.duration, delay: opts.delay, easing: opts.easing,
      fill: opts.fill, id: opts.id, iterations: opts.iterations,
    });
  } catch { return null; }
}

/** rAF 补间 */
function tween(dur: number, step: (v: number) => void, ease: (t: number) => number = (t) => 1 - Math.pow(1 - t, 3)): void {
  const t0 = performance.now();
  const tick = (now: number): void => {
    const p = Math.min(1, (now - t0) / dur);
    step(ease(p));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** 延时调度（motionTeardown 级取消，防快速开合时编排叠加） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/* ================= 句柄池：一次性编排 / 长驻循环 / 注入件残渣 ================= */

/** 一次性编排（带 delay 的接力入场等）：新编排/关闭/卸载时整批 cancel。
 *  cancel 掉 fill:'backwards' 的动画 = 元素回落自然终态，绝不会钉住不可见。 */
const orchestra = new Set<Animation>();
function trackOrch(a: Animation | null): void {
  if (!a) return;
  orchestra.add(a);
  a.finished.then(() => orchestra.delete(a)).catch(() => orchestra.delete(a));
}
function cancelOrchestra(): void {
  for (const a of orchestra) { try { a.cancel(); } catch { /* 已收口忽略 */ } }
  orchestra.clear();
}

/** 长驻循环句柄池（英雄呼吸 / 拎起挂起态）：phase 切换与卸载必收 */
const loops = new Map<string, Animation>();
function trackLoop(key: string, a: Animation | null): void {
  if (!a) return;
  const prev = loops.get(key);
  if (prev) { try { prev.cancel(); } catch { /* 已收口忽略 */ } }
  loops.set(key, a);
}
function stopLoops(prefix?: string): void {
  for (const [key, a] of [...loops.entries()]) {
    if (prefix && !key.startsWith(prefix)) continue;
    try { a.cancel(); } catch { /* 已收口忽略 */ }
    loops.delete(key);
  }
}

/** 注入件残渣登记（爪印/高光/波纹）：自毁之外，motionTeardown 兜底全收 */
const debris = new Set<HTMLElement>();
function inject(host: HTMLElement, cls: string): HTMLElement | null {
  try {
    const n = document.createElement('span');
    n.className = cls;
    n.setAttribute('aria-hidden', 'true');
    n.dataset.bzScMotion = '1';
    host.appendChild(n);
    debris.add(n);
    return n;
  } catch { return null; }
}
function removeDebris(n: HTMLElement | null): void {
  if (!n) return;
  debris.delete(n);
  try { n.remove(); } catch { /* 已移除忽略 */ }
}

/** 退场动画 id（长驻面板壳：重开入场前按 id 撤上次退场残留——首页教训的通用化） */
const EXIT_CHAT = 'bz-sc-chat-exit';
const EXIT_CHAT_MASK = 'bz-sc-chat-exit-mask';
const EXIT_DASH = 'bz-sc-dash-exit';
const EXIT_DASH_MASK = 'bz-sc-dash-exit-mask';
function cancelById(el: HTMLElement | null | undefined, id: string): void {
  if (!el || typeof el.getAnimations !== 'function') return;
  for (const a of el.getAnimations()) {
    if (a.id === id) { try { a.cancel(); } catch { /* 已收口忽略 */ } }
  }
}

/** boot 消费标志：入口置位、首个登场消费即熄 */
let bootPending = false;
export function motionMarkBoot(): void { bootPending = true; }
function consumeBoot(): boolean {
  const v = bootPending;
  bootPending = false;
  return v;
}

/** 拎起挂起态标记（drop 抖毛只在该真拎过时播） */
let liftMark = false;

/**
 * 重开代数（复用型长驻节点的关→开竞态守卫）：退场中节点被重开（入场把代数 +1），
 * 退场收口发现代数变了就不再交还隐藏/移除——否则「关 → 立刻再开」会被退场尾回调
 * 把刚打开的面板/猫重新藏掉（首页教训的同型竞态）。档案台重开永远建新节点，
 * 退场收口照常移除旧节点（不设守卫正是正确清理）。
 */
let catEpoch = 0;
let chatEpoch = 0;

/** 气泡位移组合（视口夹紧 --bz-sc-shift 由 styles.css transform 承载，动效帧必须带上） */
const BUBBLE_X = 'translateX(var(--bz-sc-shift, 0px))';

/* ================= 猫本体：登场 / 召回 / 溜走 / 换毛 / 拎起 / 抚摸 ================= */

/** 爪印 SVG（一大四小肉垫） */
const PAW_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<ellipse cx="12" cy="15.6" rx="5.4" ry="4.4"/>'
  + '<ellipse cx="5.2" cy="9.8" rx="2.1" ry="2.8" transform="rotate(-20 5.2 9.8)"/>'
  + '<ellipse cx="9.7" cy="6.6" rx="2.1" ry="2.9"/>'
  + '<ellipse cx="14.3" cy="6.6" rx="2.1" ry="2.9"/>'
  + '<ellipse cx="18.8" cy="9.8" rx="2.1" ry="2.8" transform="rotate(20 18.8 9.8)"/>'
  + '</svg>';

/** 单枚爪印：淡入绽开 → 淡出，自毁 */
function pawPrint(host: HTMLElement, x: number, y: number, size: number, ang: number, delay: number): void {
  const paw = inject(host, 'bz-sc-paw');
  if (!paw) return;
  paw.innerHTML = PAW_SVG;
  paw.style.left = `${x}px`;
  paw.style.top = `${y}px`;
  paw.style.width = `${size}px`;
  paw.style.height = `${size}px`;
  const a = waapi(paw,
    [
      { opacity: 0, transform: `rotate(${ang}deg) scale(.45)` },
      { opacity: .85, offset: .38 },
      { opacity: 0, transform: `rotate(${ang}deg) scale(1.06)` },
    ],
    { delay, duration: 820, easing: E.out });
  trackOrch(a);
  after(delay + 900, () => removeDebris(paw));
}

/** 双耳抖（保留左右耳基础角的互补关键帧，不与样式表 class 打架） */
function earFlick(container: HTMLElement, delay: number): void {
  const l = container.querySelector<HTMLElement>('.cat-ear-left');
  const r = container.querySelector<HTMLElement>('.cat-ear-right');
  if (l) trackOrch(waapi(l,
    [{ transform: 'rotate(-15deg)' }, { transform: 'rotate(-30deg)', offset: .4 }, { transform: 'rotate(-15deg)' }],
    { delay, duration: 420, easing: E.out, fill: 'backwards' }));
  if (r) trackOrch(waapi(r,
    [{ transform: 'rotate(15deg)' }, { transform: 'rotate(30deg)', offset: .4 }, { transform: 'rotate(15deg)' }],
    { delay, duration: 420, easing: E.out, fill: 'backwards' }));
}

/** 尾巴一摆（猫说话/定场专用；transform-origin left center 由样式表持有） */
function tailWave(container: HTMLElement, delay: number, peak: number): void {
  const tail = container.querySelector<HTMLElement>('.cat-tail');
  if (!tail) return;
  trackOrch(waapi(tail,
    [
      { transform: 'rotate(0deg)' },
      { transform: `rotate(${peak}deg)`, offset: .38 },
      { transform: `rotate(${-peak * .55}deg)`, offset: .72 },
      { transform: 'rotate(0deg)' },
    ],
    { delay, duration: 820, easing: E.out, fill: 'backwards' }));
}

/**
 * 登场（ensureSmartCat 装配完调用）：消费 boot 标志——
 * 首次 = 完整版（跃上过冲 + 落地双爪印 + 尾巴定场 + 双耳抖），
 * 非首次 = 短版（快速落定）。宿主不可动 / RM：静默（内容已终态）。
 */
export function motionCatArrival(container: HTMLElement): void {
  const full = consumeBoot();
  catEpoch++; // 登场 = 新一代猫（在飞的溜走收口作废）
  if (!container || !enabled()) return;
  cancelOrchestra();
  stopLoops();
  // 整猫跃上：容器基础 transform: translateX(-50%) 必须逐帧携带
  trackOrch(waapi(container,
    [
      { opacity: 0, transform: 'translateX(-50%) translateY(64px)', filter: 'blur(5px)' },
      { opacity: 1, transform: 'translateX(-50%) translateY(-7px)', filter: 'blur(0px)', offset: .72 },
      { opacity: 1, transform: 'translateX(-50%) translateY(0)', filter: 'blur(0px)' },
    ],
    { duration: full ? 620 : 400, easing: E.out, fill: 'backwards' }));
  const landAt = full ? 420 : 260;
  after(landAt, () => {
    if (!container.isConnected) return;
    // 落地双爪印（左右肉垫先后拍地）
    pawPrint(container, 5, 34, 13, -28, 0);
    pawPrint(container, 30, 36, 13, 22, 90);
  });
  tailWave(container, landAt - 60, 28);
  if (full) earFlick(container, landAt + 240);
}

/** 召回（openSmartCat 幂等 remount：hide 后再唤）——探头弹出 + 双耳抖 */
export function motionCatRecall(container: HTMLElement | null): void {
  catEpoch++; // 召回 = 溜走退场作废（容器复用，收口不得再摘）
  if (!container || !enabled()) return;
  cancelOrchestra();
  trackOrch(waapi(container,
    [
      { opacity: 0, transform: 'translateX(-50%) translateY(46px)', filter: 'blur(4px)' },
      { opacity: 1, transform: 'translateX(-50%) translateY(-5px)', filter: 'blur(0px)', offset: .7 },
      { opacity: 1, transform: 'translateX(-50%) translateY(0)', filter: 'blur(0px)' },
    ],
    { duration: 460, easing: E.out, fill: 'backwards' }));
  earFlick(container, 300);
  tailWave(container, 240, 22);
}

/**
 * 溜走（hideSmartCat）：压低身子滑下屏幕缘。fill:forwards 但节点随收口移除——
 * 无长驻残留顾虑；无动效宿主同步收口（remove 时序与今天逐字一致）。
 */
export function motionCatSlink(container: HTMLElement, done: () => void): void {
  if (!container || !enabled()) { done(); return; }
  stopLoops('lift'); // 拖拽中被隐藏：挂起态随退场收掉（新容器可重新拎起）
  liftMark = false;
  const myEpoch = catEpoch;
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    if (catEpoch !== myEpoch) return; // 溜走中已被召回/重装：容器归新演出，不摘
    done();
  };
  const a = waapi(container,
    [
      { opacity: 1, transform: 'translateX(-50%) translateY(0)', filter: 'blur(0px)' },
      { opacity: 0, transform: 'translateX(-50%) translateY(54px) scaleY(.94)', filter: 'blur(4px)' },
    ],
    { duration: 230, easing: E.out, fill: 'forwards' });
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  after(430, finish); // 兜底：动画事件丢失也不能卡住隐藏
}

/** 换毛（皮肤切换）：一道高光从头扫到尾 + 全身抖毛 */
export function motionCatRecoat(container: HTMLElement): void {
  if (!container || !enabled()) return;
  const body = container.querySelector<HTMLElement>('.cat-body');
  if (!body) return;
  const shine = inject(body, 'bz-sc-shine');
  if (shine) {
    trackOrch(waapi(shine,
      [{ transform: 'translateX(-130%)' }, { transform: 'translateX(300%)' }],
      { duration: 560, easing: E.move }));
    after(660, () => removeDebris(shine));
  }
  trackOrch(waapi(body,
    [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(-2.4deg)', offset: .3 },
      { transform: 'rotate(2deg)', offset: .62 },
      { transform: 'rotate(0deg)' },
    ],
    { duration: 340, easing: E.out, fill: 'backwards' }));
}

/**
 * 拎起/放下（拖拽起止）。up=true：耳朵后贴 + 尾巴绷住——挂起态 fill:forwards，
 * 句柄入池，放下/隐藏/卸载必收（首页教训的自律用法：绝不无人认领）。
 * 返回本次是否发生状态切换（drop 侧用来决定要不要抖毛）。
 */
export function motionCatLift(container: HTMLElement, up: boolean): boolean {
  if (!container) return false;
  if (up) {
    if (liftMark || !enabled()) return false;
    liftMark = true;
    const l = container.querySelector<HTMLElement>('.cat-ear-left');
    const r = container.querySelector<HTMLElement>('.cat-ear-right');
    const tail = container.querySelector<HTMLElement>('.cat-tail');
    if (l) trackLoop('lift-ear-l', waapi(l,
      [{ transform: 'rotate(-15deg)' }, { transform: 'rotate(-34deg) translateY(1px)' }],
      { duration: 180, easing: E.out, fill: 'forwards' }));
    if (r) trackLoop('lift-ear-r', waapi(r,
      [{ transform: 'rotate(15deg)' }, { transform: 'rotate(34deg) translateY(1px)' }],
      { duration: 180, easing: E.out, fill: 'forwards' }));
    if (tail) trackLoop('lift-tail', waapi(tail,
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(7deg)' }],
      { duration: 160, easing: E.out, fill: 'forwards' }));
    return true;
  }
  if (!liftMark) return false;
  liftMark = false;
  stopLoops('lift'); // 耳朵弹回基础循环（earsTwitch），尾巴回落 tailSway
  if (enabled()) {
    const body = container.querySelector<HTMLElement>('.cat-body');
    // 落地抖毛
    if (body) trackOrch(waapi(body,
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-2deg)', offset: .28 },
        { transform: 'rotate(1.8deg)', offset: .6 },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 300, easing: E.out, fill: 'backwards' }));
  }
  return true;
}

/** 抚摸（showPetMessage）：爪印三连在猫身上绽开 */
export function motionPetBurst(container: HTMLElement): void {
  if (!container || !enabled()) return;
  for (let i = 0; i < 3; i++) {
    after(i * 100, () => {
      if (!container.isConnected) return;
      pawPrint(container, 8 + Math.random() * 22, -6 + i * 9, 12 + Math.random() * 4,
        -40 + Math.random() * 80, 0);
    });
  }
}

/* ================= 思考指示器：外圈 ping ================= */

let lastPingAt = 0;

/** 思考点亮起的一记波纹（state.startThinking 接线；节流 400ms 防连点满屏涟漪） */
export function motionThinkingPing(dot: HTMLElement | null): void {
  if (!enabled() || !dot) return;
  const now = Date.now();
  if (now - lastPingAt < 400) return;
  lastPingAt = now;
  const ring = inject(dot, 'bz-sc-ping');
  if (!ring) return;
  trackOrch(waapi(ring,
    [
      { opacity: .75, transform: 'translate(-50%,-50%) scale(.6)' },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(2.5)' },
    ],
    { duration: 640, easing: E.out }));
  after(720, () => removeDebris(ring));
}

/* ================= 气泡：弹出过冲 + 竖尾一摆 / 钉住轻弹 ================= */

/** 气泡弹出（showBubbleInternal 挂 .show 后）：过冲上浮；同拍小橘竖尾一摆——要说话了 */
export function motionBubbleIn(bubble: HTMLElement): void {
  if (!bubble || !enabled()) return;
  trackOrch(waapi(bubble,
    [
      { opacity: 0, transform: `${BUBBLE_X} translateY(14px) scale(.8)` },
      { opacity: 1, transform: `${BUBBLE_X} translateY(-3px) scale(1.05)`, offset: .68 },
      { opacity: 1, transform: `${BUBBLE_X} translateY(0) scale(1)` },
    ],
    { duration: 340, easing: E.out, fill: 'backwards' }));
  const container = bubble.closest<HTMLElement>('#smart-companion-cat');
  if (container) tailWave(container, 60, 24);
}

/** 气泡钉住（单击 pin）：绿框亮起同拍轻弹一记 */
export function motionBubblePin(bubble: HTMLElement): void {
  if (!bubble || !enabled()) return;
  trackOrch(waapi(bubble,
    [
      { transform: `${BUBBLE_X} scale(1)` },
      { transform: `${BUBBLE_X} scale(1.045)`, offset: .42 },
      { transform: `${BUBBLE_X} scale(1)` },
    ],
    { duration: 320, easing: E.out, fill: 'backwards' }));
}

/* ================= 聊天台：开 / 关 / 消息条 ================= */

/** 聊天面板开（showChatPanel）：遮罩淡入 + 壳上浮揭示 + 历史消息接力 + 输入行升起 */
export function motionChatIn(mask: HTMLElement, popup: HTMLElement): void {
  chatEpoch++; // 重开 = 在飞的关闭收口作废（面板壳复用）
  if (!popup) return;
  cancelById(popup, EXIT_CHAT); // 撤上次退场残留（长驻壳，首页教训）
  cancelById(mask, EXIT_CHAT_MASK);
  cancelOrchestra();
  if (!enabled()) return;
  if (mask) trackOrch(waapi(mask, [{ opacity: 0 }, { opacity: 1 }], { duration: M.move, easing: E.out, fill: 'backwards' }));
  trackOrch(waapi(popup,
    [
      { opacity: 0, transform: 'translateY(16px) scale(.97)', filter: 'blur(6px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0px)' },
    ],
    { duration: 340, easing: E.out, fill: 'backwards' }));
  const input = popup.querySelector<HTMLElement>('.chat-input-area');
  if (input) trackOrch(waapi(input,
    [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
    { delay: 100, duration: M.base + 60, easing: E.out, fill: 'backwards' }));
  const msgs = popup.querySelectorAll<HTMLElement>('.chat-messages .message');
  const tail8 = Array.from(msgs).slice(-8);
  tail8.forEach((m, i) => {
    trackOrch(waapi(m,
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { delay: 140 + i * STAG, duration: M.base, easing: E.out, fill: 'backwards' }));
  });
}

/** 聊天面板关（hideChatPanel）：下沉折回，收口前撤退场动画再交还 display:none */
export function motionChatOut(mask: HTMLElement, popup: HTMLElement, done: () => void): void {
  if (!popup || !enabled()) { done(); return; }
  const myEpoch = chatEpoch;
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    if (chatEpoch !== myEpoch) return; // 关闭中已被重开：显示归新入场，不抢（首页教训）
    cancelById(popup, EXIT_CHAT);
    cancelById(mask, EXIT_CHAT_MASK);
    done();
  };
  const a = waapi(popup,
    [
      { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      { opacity: 0, transform: 'translateY(10px) scale(.97)', filter: 'blur(5px)' },
    ],
    { duration: M.move + 40, easing: E.out, fill: 'forwards', id: EXIT_CHAT });
  if (mask) trackOrch(waapi(mask, [{ opacity: 1 }, { opacity: 0 }], { duration: M.move + 40, easing: E.out, fill: 'forwards', id: EXIT_CHAT_MASK }));
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  after(M.move + 220, finish);
}

/** 聊天消息条（sendChatMessage）：用户右入 / 小橘左入踱步 / 打字占位轻浮 */
export function motionChatMessage(el: HTMLElement, who: 'user' | 'cat' | 'typing'): void {
  if (!el || !enabled()) return;
  if (who === 'typing') {
    trackOrch(waapi(el,
      [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.fast + 40, easing: E.out, fill: 'backwards' }));
    return;
  }
  const from = who === 'user' ? 16 : -16;
  trackOrch(waapi(el,
    [{ opacity: 0, transform: `translateX(${from}px)` }, { opacity: 1, transform: 'none' }],
    { duration: who === 'user' ? M.move : M.base, easing: E.out, fill: 'backwards' }));
}

/* ================= 档案台（数据面板）：开 / 关 / 首屏编排 / 页签 / 行为流 ================= */

/** 数值条生长的公共尾处理：transform-origin 内联随手清（终态零残留） */
function growFill(el: HTMLElement, axis: 'x' | 'y', delay: number, duration: number): void {
  el.style.transformOrigin = axis === 'x' ? 'left center' : 'bottom center';
  const a = waapi(el,
    [{ transform: axis === 'x' ? 'scaleX(0)' : 'scaleY(0)' }, { transform: 'none' }],
    { delay, duration, easing: E.out, fill: 'backwards' });
  trackOrch(a);
  if (a) a.finished.then(() => { el.style.transformOrigin = ''; }).catch(() => { el.style.transformOrigin = ''; });
}

/** 爪账数字滚动：渲染层终态文案先记下，tween 中途只动文本，末帧精确还原 */
function countUp(el: HTMLElement, delay: number): void {
  const raw = el.textContent ?? '';
  const m = raw.match(/-?\d[\d,]*/);
  if (!m) return;
  const target = Number(m[0].replace(/,/g, ''));
  if (!Number.isFinite(target) || target === 0) return;
  after(delay, () => {
    if (!el.isConnected) return;
    tween(460, (v) => {
      if (!el.isConnected) return;
      el.textContent = v >= 1 ? raw : raw.replace(m![0], String(Math.round(target * v)));
    }, easeOutQuart);
  });
}

/** 英雄情绪呼吸（驻场循环，入池；离开总览/关面板/卸载必收） */
function heroBreath(pane: HTMLElement): void {
  const hero = pane.querySelector<HTMLElement>('.bz-sc-dash-hero-emoji');
  if (!hero) return;
  trackLoop('dash-hero', waapi(hero,
    [
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'scale(1.07) rotate(-3deg)', offset: .5 },
      { transform: 'scale(1) rotate(0deg)' },
    ],
    { duration: 3600, easing: 'ease-in-out', iterations: Infinity }));
}

/**
 * 首屏编排（openSmartcatDashboard 打开时 boot=true；C1 静默自动刷新 boot=false 不重播）。
 * 新编排覆盖旧编排（cancelOrchestra）——快速开合不叠加。
 */
export function motionDashRendered(pane: HTMLElement | null, boot: boolean): void {
  if (!boot || !pane || !enabled()) return;
  cancelOrchestra();
  stopLoops('dash');
  // 卡片接力上浮（cap 9，其余直达终态）
  const cards = pane.querySelectorAll<HTMLElement>('.bz-sc-dash-card');
  Array.from(cards).slice(0, 9).forEach((c, i) => {
    trackOrch(waapi(c,
      [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { delay: 60 + i * 45, duration: M.base + 80, easing: E.out, fill: 'backwards' }));
  });
  // PAD 潮汐 / 信任依恋等数值条：从零生长
  pane.querySelectorAll<HTMLElement>('.bz-sc-dash-row-fill').forEach((f, i) => {
    if (i >= 16) return;
    growFill(f, 'x', 260 + i * 36, M.base + 140);
  });
  // 作息直方图：拔节
  pane.querySelectorAll<HTMLElement>('.bz-sc-dash-rhythm-col').forEach((col, i) => {
    if (i >= 24) return;
    growFill(col, 'y', 220 + i * 14, M.base + 120);
  });
  // 爪账数字滚动（小橘掰着爪子数自己的记忆）
  pane.querySelectorAll<HTMLElement>('.bz-sc-dash-stat-num').forEach((n, i) => countUp(n, 280 + i * 70));
  // 英雄情绪呼吸驻场
  heroBreath(pane);
}

/** 数据面板开（openSmartcatDashboard）：遮罩淡入 + 壳揭示 + 页签接力 */
export function motionDashIn(mask: HTMLElement, popup: HTMLElement): void {
  if (!popup) return;
  cancelById(popup, EXIT_DASH);
  cancelById(mask, EXIT_DASH_MASK);
  cancelOrchestra();
  if (!enabled()) return;
  if (mask) trackOrch(waapi(mask, [{ opacity: 0 }, { opacity: 1 }], { duration: M.move, easing: E.out, fill: 'backwards' }));
  trackOrch(waapi(popup,
    [
      { opacity: 0, transform: 'translateY(18px) scale(.98)', filter: 'blur(6px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0px)' },
    ],
    { duration: 360, easing: E.out, fill: 'backwards' }));
  popup.querySelectorAll<HTMLElement>('.bz-sc-dash-tab').forEach((t, i) => {
    trackOrch(waapi(t,
      [{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'none' }],
      { delay: 90 + i * STAG, duration: M.base, easing: E.out, fill: 'backwards' }));
  });
}

/** 数据面板关（closeSmartcatDashboard）：折回 + 收口前撤退场动画再交还 remove；
 *  英雄呼吸与编排一并收池。 */
export function motionDashOut(mask: HTMLElement, popup: HTMLElement, done: () => void): void {
  stopLoops('dash');
  cancelOrchestra();
  if (!popup || !enabled()) { done(); return; }
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    cancelById(popup, EXIT_DASH);
    cancelById(mask, EXIT_DASH_MASK);
    done();
  };
  const a = waapi(popup,
    [
      { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      { opacity: 0, transform: 'translateY(12px) scale(.98)', filter: 'blur(5px)' },
    ],
    { duration: M.move + 30, easing: E.out, fill: 'forwards', id: EXIT_DASH });
  if (mask) trackOrch(waapi(mask, [{ opacity: 1 }, { opacity: 0 }], { duration: M.move + 30, easing: E.out, fill: 'forwards', id: EXIT_DASH_MASK }));
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  after(M.move + 210, finish);
}

/** 页签切换（activateTab）：新 pane 轻揭 + 英雄呼吸随总览进出挂/收 */
export function motionDashTab(pane: HTMLElement | null): void {
  stopLoops('dash');
  if (!pane || !enabled()) return;
  trackOrch(waapi(pane,
    [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.fast + 50, easing: E.out, fill: 'backwards' }));
  heroBreath(pane);
}

/** 行为流新批（appendBehaviorBatch）：沿时间线踏入（cap 20，其余直达） */
export function motionDashBatch(items: Element[]): void {
  if (!enabled() || !items.length) return;
  items.slice(0, 20).forEach((el, i) => {
    if (!(el instanceof HTMLElement)) return;
    trackOrch(waapi(el,
      [{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }],
      { delay: i * 24, duration: M.base, easing: E.out, fill: 'backwards' }));
  });
}

/** 行为流筛选重渲（applyBehaviorFilter）：列表轻接力（cap 12） */
export function motionDashFilter(tl: Element | null): void {
  if (!tl) return;
  motionDashBatch(Array.from(tl.children).slice(0, 12));
}

/* ================= 清场 ================= */

/** 面板关闭/卸载统一清场：编排、循环、注入件残渣、挂起标记全收 */
export function motionTeardown(): void {
  cancelPending();
  cancelOrchestra();
  stopLoops();
  for (const n of [...debris]) removeDebris(n);
  bootPending = false;
  liftMark = false;
}
