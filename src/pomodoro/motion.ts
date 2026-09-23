/**
 * 番茄钟动效层（2026-09-23 动效批，对齐 cinema/motion.ts issue 400 台账口径；打法随 home/motion.ts）。
 *
 * 语义词汇表（按番茄钟自己的语言出招——不抄其他域的特效）：
 *  - 入席 motionPanelOpen   弹窗「落座」：遮罩先清、面板升起退焦；空闲时轨道预绕一圈＝上弦
 *  - 离席 motionPanelClose  弹窗「合盖」：面板下沉退焦、遮罩收暗，交还 display 前的 200ms 尾奏
 *  - 相位氛围 motionPhaseSync  五态单点（每秒 render 调，签名变更才动）：
 *      focus-run   专注呼吸：环与时间字 4.2s 一息，环头光点骑环随行、每秒一跳（秒针心跳），环光随行
 *      break-run   休息渐暗：遮罩四周 vignette 缓入（世界退后），呼吸放慢放轻，环光收小
 *      *-pause     凝滞：呼吸停摆、时间字轻颤一记、面板降饱和悬停（暂停＝悬在半空的静）
 *      ready       待发：一切归于安静，主按钮极缓亮息（「按我开始」的邀请）
 *  - 点火 motionIgnite      开始/继续：时间字落定；全新开始加面板一记沉浮 + 主按钮亮脉冲
 *  - 收工仪式 motionCeremony  专注自然完成：环闪光 + 迸花 + 涟漪两记 + 时间字揭新 + 面板沉浮；
 *                             休息结束＝苏醒（亮起 + 软羽上浮，与收工的隆重刻意分层）
 *  - 翻页 motionSkipWhoosh  跳过：面板轻沉一记直接翻相（作废不算收工，故无仪式）
 *  - 倒带 motionRewind      重置：面板呼气回位 + 时间字落回满刻度（环沿既有 CSS 1s 过渡自行退尽）
 *  - 揭新 motionPhaseLabelSwap / 阶段文案换字 blur 交替；motionTimeTick 时间大跳揭新、整分一记脉冲
 *  - 点亮 motionCycleDots   循环方点随完成逐颗「按亮」；长休清零级联释放
 *  - 起立 motionStatsIn     统计柱自底接力起立（30ms 一波）；motionTodayBlip 今日行落墨
 *  - 微跃 motionStatusbarPop 状态栏相位变化一记微跃（插件侧；壳内无状态栏）
 *  - 进度四味 motionProgressFx（2026-09-23 特效批，用户拍板采纳 2/4/7/8）——ui.render 每秒调：
 *      紧迫色移 剩余 ≤5 分钟起，环与时间字连续升温（只覆内联，不动皮肤变量表）
 *      渐变流光 环描边走注入的渐变（20s 一圈 SMIL），渐变 stop 随紧迫度同步升温——两者天然兼容
 *      倒数放大 最后 10 秒时间字逐秒放大（作用在 box，翻牌层一并长大）
 *      色温漂移 弹窗底色随进度极慢漂移（专注偏暖 / 休息偏冷，color-mix 直染 background-color）
 *  - 世界退后 setRestDepth 休息相位：遮罩 backdrop-blur 加深一档 + 弹窗极缓呼吸（.bz-pm-rest）
 *
 * 翻牌机（6）的结构在 render.ts（.pomodoro-time-box 两个兄弟层），滚动位由 ui.ts 写；本层只把
 * 时间字动画目标从 #pomodoro-time 抬到 box（closest），使揭新 / 脉冲 / 放大作用于整体。
 *
 * 台账：fast 160 / move 200 / base 280 / impulse 740，接力 30ms；揭示 out 曲线、位移 move 曲线。
 * 呼吸类长驻循环是氛围指示（同影院「加载循环不入台账」口径），周期自定：专注 4.2s、休息 6.4s。
 *
 * 纪律：
 *  - 零依赖（禁 obsidian / core 服务），纯浏览器 API——插件与评审壳两侧同跑；
 *  - 只动 transform / opacity / filter，不改写几何；render.ts markup 一字不动；
 *  - 注入装饰（vignette / 环头光点 / 迸花涟漪）全部 absolute + pointer-events:none + aria-hidden，
 *    宿主已 position:relative；演出完自移除（环头光点随相位藏显，面板关闭随 DOM 消亡）；
 *  - 长驻循环句柄集中在 loops/glowAnim/toneAnim/readyAnim，相位切换 / 关闭 / 卸载必 cancel，不留永动孤儿；
 *  - reduced-motion（评审期口径）：默认无视系统设置放完整演出；?rm=1 显式直达终态（同 home 口径）；
 *  - 无 WAAPI 宿主（jsdom）：一次性效果落终态内联样式（幂等无害），循环类直接跳过——域内测试零感知。
 */

/** Phase 单源（state.ts）：本文件零**值**依赖——只取类型，编译后退场，Node 单测仍可直载。 */
import type { Phase } from './state';

/* ================= 台账与口径 ================= */

const M = { fast: 160, move: 200, base: 280, impulse: 740 } as const;
const E = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
} as const;
const STAG = 30;

/** 呼吸周期（毫秒；氛围循环不入台账）：专注短促专注感，休息放慢一倍半的松弛感 */
const BREATH_FOCUS = 4200;
const BREATH_BREAK = 6400;

/** 环几何（render.ts 单源 r=52，viewBox 120）——环头光点换算与预绕线共用 */
const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，见文件头）。 */
function reduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}

/** 安全 WAAPI：?rm=1 时直达终态（落最后一帧）；否则真实演出，宿主不支持也落终态 */
function waapi(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || reduced() || typeof el.animate !== 'function') {
    const last = frames[frames.length - 1];
    if (el && last) for (const k of Object.keys(last)) {
      if (k === 'offset') continue;
      try { (el.style as unknown as Record<string, string>)[k] = String((last as unknown as Record<string, unknown>)[k]); } catch { /* 不可内联属性忽略 */ }
    }
    return null;
  }
  try { return el.animate(frames, opts); } catch { return null; }
}

/** 循环类 WAAPI：无「终态」可落——不支持 / RM 时直接跳过，绝不写内联残留 */
function waapiLoop(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || reduced() || typeof el.animate !== 'function') return null;
  try { return el.animate(frames, opts); } catch { return null; }
}

/** 延时调度（面板级取消，防相位快切时编排叠加） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

function byId(id: string): HTMLElement | null { return document.getElementById(id); }

/** 强调色：优先读弹窗皮肤变量（Chromium 返回已代换的 token 串），拿不到回落 var() 链 */
function accentOf(popup: Element | null): string {
  try {
    const v = popup ? getComputedStyle(popup).getPropertyValue('--pz-accent').trim() : '';
    if (v) return v;
  } catch { /* 测试宿主无 computedStyle 走兜底 */ }
  return 'var(--pz-accent, var(--interactive-accent))';
}

/* ================= 句柄池：相位切换 / 关闭 / 卸载必收 ================= */

/** 长驻循环（呼吸 / 待发亮息） */
const loops = new Set<Animation>();
/** 环光（fill:forwards 持有）与面板色调（fill:forwards 持有）——cancel 即回自然态 */
let glowAnim: Animation | null = null;
let toneAnim: Animation | null = null;
/** 入席 / 一次性氛围（面板关闭时统一收） */
const fxAnims = new Set<Animation>();

/** 一次性氛围句柄登记（超量时修剪已完成项，防长会话积攒） */
function trackFx(a: Animation | null): void {
  if (!a) return;
  fxAnims.add(a);
  if (fxAnims.size > 48) {
    for (const x of [...fxAnims]) {
      try { if (x.playState === 'finished') fxAnims.delete(x); } catch { fxAnims.delete(x); }
    }
  }
}
function stopGlow(): void { try { glowAnim?.cancel(); } catch { /* 已完成为 no-op */ } glowAnim = null; }
function stopTone(): void { try { toneAnim?.cancel(); } catch { /* 已完成为 no-op */ } toneAnim = null; }
function stopBreath(): void { for (const a of loops) { try { a.cancel(); } catch { /* no-op */ } } loops.clear(); }
function stopFx(): void { for (const a of fxAnims) { try { a.cancel(); } catch { /* no-op */ } } fxAnims.clear(); }

/* ================= 相位氛围单点（render 每秒调，签名变更才动） ================= */

/**
 * 氛围签名：ready / focus-run / focus-pause / break-run / break-pause。
 * phase 'focus' 停止态（reset 后）与 'idle' 同归 ready——都是「钟已上弦等你按」。
 */
/**
 * 休息相位判据。**Phase 里没有 'break' 这个成员**（只有 short-break / long-break）——曾在这里
 * 写 `phase === 'break'` 导致短休息判成专注、色温取反岔；类型收严成 Phase 后编译器能拦。
 */
function isBreakPhase(phase: Phase): boolean { return phase === 'short-break' || phase === 'long-break'; }

function atmosKey(phase: Phase, running: boolean, paused: boolean): string {
  if (running) return phase === 'focus' ? 'focus-run' : 'break-run';
  if (paused) return phase === 'focus' ? 'focus-pause' : 'break-pause';
  return 'ready';
}

let lastSig = '';
let headLastProgress = -1;

/** 相位氛围同步：ui.render 每秒调用；签名不变零开销。popup 为 null（面板关着后台走秒）只记账不演出。 */
export function motionPhaseSync(popup: HTMLElement | null, phase: Phase, running: boolean, paused: boolean): void {
  const key = atmosKey(phase, running, paused);
  if (key === lastSig) return;
  const prev = lastSig;
  lastSig = key;
  if (!popup || !popup.isConnected) return;
  const svg = byId('pomodoro-ring-svg');
  const timeEl = byId('pomodoro-time');
  const mask = byId('pomodoro-mask');
  stopBreath(); stopGlow();
  setRestDepth(mask, key.startsWith('break'));
  switch (key) {
    case 'focus-run': {
      stopTone();
      setGlow(svg, accentOf(popup), 7);
      setHead(svg, 'show');
      breathe(svg, timeEl, BREATH_FOCUS, 0.012, 0.86);
      if (prev === 'focus-pause' && timeEl) {
        waapi(timeEl, [{ opacity: 0.4, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }],
          { duration: M.base, easing: E.out });
      }
      break;
    }
    case 'break-run': {
      stopTone();
      setGlow(svg, accentOf(popup), 4);
      setHead(svg, 'show');
      breathe(svg, timeEl, BREATH_BREAK, 0.007, 0.92);
      // 收工仪式刚放完 → 暗幕让它先说完话再进（世界慢慢退后）
      setVignette(mask, true, performance.now() < ceremonyUntil ? 620 : 0);
      break;
    }
    case 'focus-pause':
    case 'break-pause': {
      setHead(svg, 'hide');
      if (mask && (key === 'break-pause' || prev.startsWith('break'))) setVignette(mask, true, 0); // 休息暂停：暗幕保留
      if (timeEl) {
        waapi(timeEl,
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-1.2px)' }, { transform: 'translateX(1px)' }, { transform: 'translateX(0)' }],
          { duration: 240, easing: 'ease-out' });
      }
      setTone(popup, 'saturate(.92) brightness(.985)');
      break;
    }
    default: { // ready：一切归静，主按钮极缓亮息
      setHead(svg, 'hide');
      stopTone();
      if (mask) setVignette(mask, false, 0);
      const btn = byId('pomodoro-btn-start') as HTMLButtonElement | null;
      if (btn && !btn.disabled) {
        trackLoop(waapiLoop(btn,
          [{ filter: 'brightness(1)' }, { filter: 'brightness(1.12)' }, { filter: 'brightness(1)' }],
          { duration: 3400, iterations: Infinity, easing: 'ease-in-out' }));
      }
      break;
    }
  }
}

function trackLoop(a: Animation | null): void { if (a) loops.add(a); }

/* ================= 进度四味（2026-09-23 特效批；ui.render 每秒调） ================= */

/** 紧迫窗口：剩余 ≤5 分钟开始升温 */
const URGENT_WINDOW = 300;
/** 倒数窗口：剩余 ≤10 秒，时间字逐秒放大 */
const FINAL_WINDOW = 10;
/**
 * 演出终态色的**变量名**——值住在 styles.css 的 --pz-* token 上。
 * §2 禁写死色值：写死就绕过主题，亮/暗主题切换与新皮肤都不跟；插值需要数值，故运行时
 * 从 computed 里读（与 accentOf 同手法），读不到则该味整条缺席（优于把错色糊上去）。
 */
const HOT_VAR = '--pz-hot';
const TINT_FOCUS_VAR = '--pz-tint-focus';
const TINT_BREAK_VAR = '--pz-tint-break';
const SVG_NS = 'http://www.w3.org/2000/svg';
const FLOW_ID = 'bz-pm-flow';
/** 底色暖/冷层最大不透明度（再高就压字了） */
const TINT_ALPHA = 0.12;

/**
 * 基准色缓存：首帧抓一次。此后 ring 的 computed stroke 已是我们写的 url(#…)、时间字也已被
 * 覆过内联色——现读会读到自己的覆盖值，故必须缓存而非每帧现读。
 */
let baseStroke: string | null = null;
let baseTimeColor: string | null = null;
let flowGrad: SVGLinearGradientElement | null = null;

/** 颜色串 → rgb 三元组（只认 computed 出来的 rgb()/rgba() 与 #rrggbb；var() 串返回 null） */
function parseRgb(v: string): [number, number, number] | null {
  const s = (v || '').trim();
  let m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  }
  return null;
}

/** 朝目标色插值（t=0 原色，t=1 终点色）；目标色由调用方从 --pz-* token 读出 */
function mixTo(a: [number, number, number], t: number, target: [number, number, number]): string {
  const c = [0, 1, 2].map((i) => Math.round(a[i] + (target[i] - a[i]) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** 语法糖：把 CSS 变量读成可用作插值终点的三元组（无该 token → null，整味缺席） */
function varRgb(el: Element | null, name: string): [number, number, number] | null {
  try {
    const v = el ? getComputedStyle(el).getPropertyValue(name).trim() : '';
    return v ? parseRgb(v) : null;
  } catch { return null; } // 测试宿主无 computedStyle
}

/** 时间字动画目标：翻牌层是 #pomodoro-time 的兄弟，动作抬到共同的 box 上才带得住 */
function timeBoxOf(el: HTMLElement | null): HTMLElement | null {
  return (el?.closest('.pomodoro-time-box') as HTMLElement | null) ?? el;
}

/**
 * 流光渐变（defs 注入一次）：环描边换 url(#bz-pm-flow)，停靠点颜色由 motionProgressFx 每帧写，
 * 于是「流光」与「紧迫色移」共用同一条描边而互不打架。RM 下不插 SMIL（静态渐变，语义不损）。
 */
function ensureFlowGrad(svg: Element | null): SVGLinearGradientElement | null {
  if (!svg) return null;
  if (flowGrad && flowGrad.isConnected) return flowGrad;
  let defs = svg.querySelector(':scope > defs');
  if (!defs) {
    defs = svg.ownerDocument.createElementNS(SVG_NS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  let g = defs.querySelector('#' + FLOW_ID) as SVGLinearGradientElement | null;
  if (!g) {
    const doc = svg.ownerDocument;
    g = doc.createElementNS(SVG_NS, 'linearGradient') as SVGLinearGradientElement;
    g.setAttribute('id', FLOW_ID);
    g.setAttribute('x1', '0'); g.setAttribute('y1', '0');
    g.setAttribute('x2', '1'); g.setAttribute('y2', '1');
    const s1 = doc.createElementNS(SVG_NS, 'stop');
    s1.setAttribute('offset', '0');
    const s2 = doc.createElementNS(SVG_NS, 'stop');
    s2.setAttribute('offset', '1'); s2.setAttribute('stop-opacity', '.35');
    g.appendChild(s1); g.appendChild(s2);
    if (!reduced()) {
      const anim = doc.createElementNS(SVG_NS, 'animateTransform');
      anim.setAttribute('attributeName', 'gradientTransform');
      anim.setAttribute('type', 'rotate');
      anim.setAttribute('from', '0 .5 .5');
      anim.setAttribute('to', '360 .5 .5');
      anim.setAttribute('dur', '20s');
      anim.setAttribute('repeatCount', 'indefinite');
      g.appendChild(anim);
    }
    defs.appendChild(g);
  }
  flowGrad = g;
  return g;
}

/**
 * 渐变流光的 SMIL 轮转开关：running 则转，暂停 / 待发则停。
 * 「暂停＝凝滞」是本域动效语义（见文件头 *-pause），环不该在暂停时还在慢慢转；把 SMIL 挂在
 * SVG 根的时间轴上统一收，也避免相位切走后留一个看不到摸不着的后台空转（即僵尸孤儿）。
 */
function setFlowPlay(svg: SVGSVGElement | null | undefined, on: boolean): void {
  if (!svg || typeof svg.pauseAnimations !== 'function') return; // jsdom / 老引擎无 SMIL 时间轴
  try { if (on) svg.unpauseAnimations(); else svg.pauseAnimations(); } catch { /* 宿主不给，转就转着 */ }
}

/**
 * 皮肤失效：名单（className）变了就清掉基准色缓存与旧内联，让本帧重新从 skin 的 computed 取色。
 * 不这么做的话，运行中改皮肤只能等下次开面板才跟手——一秒内改来改去更容易看出来。
 */
let fxSkinSig = '';
function syncFxSkin(popup: HTMLElement, running: boolean): void {
  if (popup.className === fxSkinSig) return;
  resetFxCache(); // 会连带把 fxSkinSig 清成 ''，故必须**先**清、后记账
  fxSkinSig = popup.className;
  const ring = byId('pomodoro-ring-progress');
  if (ring) ring.style.removeProperty('stroke');
  const timeEl = byId('pomodoro-time');
  if (timeEl) timeEl.style.removeProperty('color');
  setFlowPlay(document.getElementById('pomodoro-ring-svg') as SVGSVGElement | null, running);
}

/**
 * 进度四味：全是「持续态」而非一次性演出——不设签名，每帧按当前剩余直接写终值。
 * RM / 无 WAAPI 宿主照写（终值无害），只是渐变不转、放大不补间。
 */
export function motionProgressFx(
  popup: HTMLElement | null,
  remain: number,
  total: number,
  phase: Phase,
  running: boolean,
): void {
  if (!popup || !popup.isConnected) return;
  // 皮肤换了（设置面板改肤→下一次 render）：缓存与旧内联都要退场，否则插值拿到旧皮肤的起点色
  syncFxSkin(popup, running);
  const hotTarget = varRgb(popup, HOT_VAR);
  const hot = hotTarget && remain > 0 && remain <= URGENT_WINDOW ? 1 - remain / URGENT_WINDOW : 0;
  const ratio = total > 0 ? Math.min(1, Math.max(0, 1 - remain / total)) : 0;

  const ring = byId('pomodoro-ring-progress') as SVGElement | null;
  const timeEl = byId('pomodoro-time');

  // 基准色：首帧抓（判据 = 还没被我们自己覆过内联）
  if (ring && !baseStroke && !ring.style.stroke) {
    const cs = getComputedStyle(ring).stroke;
    if (parseRgb(cs)) baseStroke = cs;
  }
  if (timeEl && !baseTimeColor && !timeEl.style.color) {
    baseTimeColor = getComputedStyle(timeEl).color;
  }

  const base = baseStroke ? parseRgb(baseStroke) : null;
  const accent = base && hotTarget ? mixTo(base, hot, hotTarget) : '';

  // 紧迫色移 + 渐变流光：同一条描边
  if (ring && accent) {
    const grad = ensureFlowGrad(ring.ownerSVGElement);
    if (grad) {
      for (const s of Array.from(grad.querySelectorAll('stop'))) s.setAttribute('stop-color', accent);
      ring.style.stroke = `url(#${FLOW_ID})`;
      setFlowPlay(ring.ownerSVGElement, running); // 凝滞＝转也停（暂停 / 待发不空转）
    } else {
      ring.style.stroke = accent;
    }
    const head = ring.ownerSVGElement?.querySelector('.bz-pm-head');
    if (head) {
      for (const c of Array.from(head.querySelectorAll('circle'))) c.setAttribute('fill', accent);
    }
  }

  // 紧迫色移：时间字同步（后段才染，前面留给环）
  if (timeEl && baseTimeColor && hotTarget) {
    const fg = parseRgb(baseTimeColor);
    if (fg && hot > 0.35) timeEl.style.color = mixTo(fg, Math.min(1, (hot - 0.35) / 0.65), hotTarget);
    else if (timeEl.style.color) timeEl.style.removeProperty('color');
  }

  // 倒数放大：作用在 box（含翻牌层）
  const grow = remain > 0 && remain <= FINAL_WINDOW ? 1 + (FINAL_WINDOW - remain) * 0.028 : 0;
  const growEl = timeBoxOf(timeEl);
  if (growEl) {
    if (grow > 1) growEl.style.transform = `scale(${grow.toFixed(3)})`;
    else if (growEl.style.transform) growEl.style.removeProperty('transform');
  }

  // 色温漂移：专注偏暖、休息偏冷，进度越深越浓。直染 background-color 而不注入覆盖层——
  // 覆盖层会盖住文字（负 z 在未建层叠上下文的相对定位父级里并不可靠），且 background 简写会
  // 抹掉「方格纸」皮肤那层格纹。色值是 styles.css 的 --pz-tint-* token（§2 禁 TS 写死）；
  // token 缺席则该味整条不作（宁可无色温，也不把 Judge Me 的暖冷糊上去）。
  const cold = isBreakPhase(phase);
  const tint = varRgb(popup, cold ? TINT_BREAK_VAR : TINT_FOCUS_VAR);
  const keep = Math.round((1 - ratio * TINT_ALPHA) * 100);
  if (tint) {
    popup.style.backgroundColor =
      `color-mix(in srgb, var(--pz-bg, var(--background-primary)) ${keep}%, rgb(${tint[0]}, ${tint[1]}, ${tint[2]}))`;
  } else if (popup.style.backgroundColor) {
    popup.style.removeProperty('background-color');
  }
}

/** 休息退后（break-* 相位）：遮罩 backdrop-blur 加深一档 + 弹窗极缓呼吸（类单源在 styles.css） */
function setRestDepth(mask: HTMLElement | null, on: boolean): void {
  if (!mask) return;
  mask.classList.toggle('bz-pm-rest', on);
  const popup = byId('pomodoro-popup');
  if (popup) popup.classList.toggle('bz-pm-rest', on);
  // RM 口径与流光拉齐（都认 ?rm=1 这一个闸）：没有这行，ERP ?rm=1 下流光停了而 CSS 呼吸还在转
  if (popup) popup.classList.toggle('bz-pm-rm', reduced());
}

/** 基准色与渐变引用清场（开/关/换肤/卸载共用）：下次首帧重抓 */
function resetFxCache(): void {
  baseStroke = null; baseTimeColor = null;
  if (flowGrad) {
    // SMIL 一起摘：节点跟着 defs 留在 svg 里会成为新的数据源（孤儿），必须随引用一并退场
    for (const a of Array.from(flowGrad.querySelectorAll('animateTransform'))) a.remove();
    flowGrad = null;
  }
  fxSkinSig = '';
}

/** 环头藏显（motionPhaseSync 的相位面）；显头尊重 motionRingHead 的进度规则（progress>0.002 才显），
 *  防新相位起步时以旧角度残留幽灵点 */
function setHead(svg: Element | null, mode: 'show' | 'hide'): void {
  if (!svg) return;
  const g = ensureHead(svg);
  if (!g) return;
  if (mode === 'show') {
    if (headLastProgress >= 0) g.style.opacity = '1';
  } else {
    g.style.opacity = '0';
    headLastProgress = -1;
  }
}

/** 环与时间字同步一息：环微胀（scale），时间字微伏（opacity）——「钟活着」 */
function breathe(svg: HTMLElement | null, timeEl: HTMLElement | null, period: number, amp: number, low: number): void {
  if (svg) {
    trackLoop(waapiLoop(svg,
      [{ transform: 'scale(1)' }, { transform: `scale(${1 + amp})` }, { transform: 'scale(1)' }],
      { duration: period, iterations: Infinity, easing: 'ease-in-out' }));
  }
  if (timeEl) {
    trackLoop(waapiLoop(timeEl,
      [{ opacity: 1 }, { opacity: low }, { opacity: 1 }],
      { duration: period, iterations: Infinity, easing: 'ease-in-out' }));
  }
}

/** 环光：进行中随行的一圈辉光（fill:forwards 持有，cancel 即灭） */
function setGlow(svg: HTMLElement | null, accent: string, radius: number): void {
  if (!svg) return;
  const c = byId('pomodoro-ring-progress');
  if (!c) return;
  stopGlow();
  if (typeof c.animate !== 'function' || reduced()) return;
  try {
    glowAnim = c.animate(
      [{ filter: 'drop-shadow(0 0 0px rgba(0,0,0,0))' }, { filter: `drop-shadow(0 0 ${radius}px ${accent})` }],
      { duration: M.base + 140, easing: E.out, fill: 'forwards' });
  } catch { /* 宿主不支持忽略 */ }
}

/** 面板色调（暂停凝滞的降饱和悬停）：fill:forwards 持有 */
function setTone(popup: HTMLElement, value: string): void {
  stopTone();
  if (typeof popup.animate !== 'function' || reduced()) return;
  try {
    toneAnim = popup.animate([{ filter: 'none' }, { filter: value }],
      { duration: M.impulse, easing: E.out, fill: 'forwards' });
  } catch { /* 忽略 */ }
}

/* ================= 休息渐暗：遮罩四周 vignette（注入装饰，可收可放） ================= */

function setVignette(mask: HTMLElement | null, on: boolean, delay: number): void {
  if (!mask) return;
  let v = mask.querySelector<HTMLElement>(':scope > .bz-pm-vignette');
  if (on) {
    if (!v) {
      v = document.createElement('div');
      v.className = 'bz-pm-vignette';
      v.setAttribute('aria-hidden', 'true');
      const s = v.style;
      s.position = 'absolute'; s.inset = '0'; s.pointerEvents = 'none';
      s.background = 'radial-gradient(120% 92% at 50% 42%, rgba(0,0,0,0) 30%, rgba(8,6,4,.5) 100%)';
      s.opacity = '0';
      mask.prepend(v);
    }
    after(delay, () => {
      const cur = v as HTMLElement;
      if (cur.isConnected) trackFx(waapi(cur, [{ opacity: 0 }, { opacity: 1 }], { duration: M.impulse, easing: E.out }));
    });
    return;
  }
  if (!v) return;
  let from = '1';
  try { from = getComputedStyle(v).opacity || '1'; } catch { /* 兜底 1 */ }
  const out = waapi(v, [{ opacity: from }, { opacity: '0' }], { duration: M.base + 60, easing: E.out });
  const remove = (): void => { v?.remove(); };
  if (out) { out.finished.then(remove).catch(remove); }
  after(M.base + 240, remove); // 兜底：动画事件丢失也不能留暗幕
}

/* ================= 环头光点：骑在进度环引导缘的「彗头」，随秒滑行 ================= */

/** transform-box 是环头定位的前提（Chromium/Electron 均备）；测试宿主无则整层跳过 */
function supportsTransformBox(): boolean {
  try { return typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('transform-box', 'view-box'); }
  catch { return false; }
}

function ensureHead(svg: Element): SVGGElement | null {
  if (!supportsTransformBox()) return null;
  let g = svg.querySelector<SVGGElement>(':scope > g.bz-pm-head');
  if (!g) {
    const doc = svg.ownerDocument;
    g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('bz-pm-head');
    const accent = accentOf(svg.closest('#pomodoro-popup'));
    const halo = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    halo.setAttribute('cx', '60'); halo.setAttribute('cy', String(60 - RING_R));
    halo.setAttribute('r', '8'); halo.setAttribute('fill', accent); halo.setAttribute('opacity', '.3');
    const core = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    core.setAttribute('cx', '60'); core.setAttribute('cy', String(60 - RING_R));
    core.setAttribute('r', '3.4'); core.setAttribute('fill', accent);
    core.classList.add('bz-pm-head-core');
    g.appendChild(halo); g.appendChild(core);
    svg.appendChild(g);
    // 环头定位：view-box 原心旋转（rotate θ 落在环引导缘）；透明度缓藏显
    g.style.transformBox = 'view-box';
    g.style.transformOrigin = '60px 60px';
    g.style.transition = 'opacity .2s ease, transform 1s linear'; // transform 与环 dashoffset 同步滑行
    g.style.opacity = '0';
    // 秒针心跳的缩放以自体为中心
    core.style.transformBox = 'fill-box';
    core.style.transformOrigin = 'center';
  }
  return g;
}

/**
 * 环头同步（render 每秒调）：show 时 rotate = 90° + progress·360°（SVG 圆路径自 3 点钟顺时针起），
 * 与环的 1s linear dashoffset 过渡同拍滑行；每前进一秒 core 弹一记＝秒针心跳。
 */
export function motionRingHead(svg: Element | null, progress: number, active: boolean): void {
  if (!svg) return;
  const g = ensureHead(svg);
  if (!g) return;
  if (!active || progress <= 0.002) {
    g.style.opacity = '0';
    headLastProgress = -1;
    return;
  }
  g.style.opacity = '1';
  const rot = `rotate(${(90 + progress * 360).toFixed(2)}deg)`;
  const core = g.querySelector<SVGElement>('.bz-pm-head-core');
  if (headLastProgress < 0) {
    // 首显（含重显）：旋转瞬时落位再恢复滑行过渡——不从 identity 方向幽灵滑入
    g.style.transition = 'opacity .2s ease';
    g.style.transform = rot;
    try { void g.getBoundingClientRect(); } catch { /* flush 失败不碍事 */ }
    g.style.transition = 'opacity .2s ease, transform 1s linear';
  } else {
    g.style.transform = rot;
  }
  if (core && headLastProgress >= 0 && typeof core.animate === 'function' && !reduced()) {
    const d = progress - headLastProgress;
    if (d > 0.0005 && d < 0.02) {
      try {
        core.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.7)' }, { transform: 'scale(1)' }],
          { duration: 340, easing: 'ease-out' });
      } catch { /* 忽略 */ }
    }
  }
  headLastProgress = progress;
}

/* ================= 面板壳：入席 / 离席 ================= */

/**
 * 入席编排：遮罩先清、面板升起退焦（50ms 垫后），随后内容接力揭出——
 * 时间字 → 阶段行 → 循环方点 → 任务行 → 按钮行 → 今日行 → 统计柱；
 * 空闲态加「上弦」：轨道 dashoffset 自 0 转一圈预绕（钟已上弦，等你按开始）。
 * 入场用 delay + fill:backwards 落帧（元素先隐后揭，无内容闪现）。
 * boot 窗口内的 motionStatsIn 让位（防双重起立）。
 */
export function motionPanelOpen(mask: HTMLElement, idleish: boolean): void {
  cancelPending(); stopFx(); stopBreath(); stopGlow(); stopTone();
  lastSig = ''; headLastProgress = -1; lastRemain = -1; lastCount = -1; taskShown = false; todayText = '';
  resetFxCache(); setRestDepth(mask, false);
  bootUntil = performance.now() + 1200;
  const popup = byId('pomodoro-popup');
  if (!popup) return;
  trackFx(waapi(mask, [{ opacity: 0 }, { opacity: 1 }], { duration: M.move, easing: E.out }));
  trackFx(waapi(popup,
    [{ opacity: 0, transform: 'translateY(16px) scale(.97)', filter: 'blur(8px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 480, easing: E.out, delay: 50, fill: 'backwards' }));
  const reveal = (el: HTMLElement | null, delay: number, dy = 5): void => {
    if (!el) return;
    trackFx(waapi(el,
      [{ opacity: 0, transform: `translateY(${dy}px)`, filter: 'blur(4px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base + 60, easing: E.out, delay, fill: 'backwards' }));
  };
  reveal(byId('pomodoro-time'), 300, 7);
  reveal(byId('pomodoro-phase'), 360);
  reveal(byId('pomodoro-task'), 410, 3);
  [...popup.querySelectorAll<HTMLElement>('.pomodoro-controls > button')].forEach((b, i) => reveal(b, 470 + i * STAG, 4));
  reveal(byId('pomodoro-today'), 560, 3);
  reveal(byId('pomodoro-today')?.nextElementSibling as HTMLElement | null, 600, 3);
  const cycle = byId('pomodoro-cycle');
  if (cycle) [...cycle.children].forEach((dot, i) => {
    after(340 + i * 40, () => trackFx(waapi(dot as HTMLElement,
      [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: M.base, easing: E.out, fill: 'backwards' })));
  });
  // 统计柱接力起立（boot 窗口让位逻辑在 motionStatsIn，这里显式编排首屏）
  after(620, () => {
    for (const id of ['pomodoro-week', 'pomodoro-months']) {
      const box = byId(id);
      if (box && !box.hidden) riseBars(box);
    }
  });
  // 空闲上弦：轨道预绕一圈（结束后清内联，交还 CSS 单源）
  if (idleish) {
    const track = popup.querySelector<HTMLElement>('.pomodoro-ring-track');
    if (track) {
      track.style.strokeDasharray = String(RING_C);
      track.style.strokeDashoffset = String(RING_C);
      const draw = waapi(track,
        [{ strokeDashoffset: String(RING_C) }, { strokeDashoffset: '0' }],
        { duration: 950, easing: E.out, delay: 430, fill: 'backwards' });
      const cleanup = (): void => {
        track.style.removeProperty('stroke-dasharray');
        track.style.removeProperty('stroke-dashoffset');
      };
      if (draw) { draw.finished.then(cleanup).catch(cleanup); }
      after(430 + 1050, cleanup);
    }
  }
}

function riseBars(box: HTMLElement): void {
  [...box.querySelectorAll<HTMLElement>('.pomodoro-stat-day')].forEach((day, i) => {
    trackFx(waapi(day,
      [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out, delay: i * STAG, fill: 'backwards' }));
    const bar = day.querySelector<HTMLElement>('.pomodoro-stat-bar');
    if (bar) {
      bar.style.transformOrigin = '50% 100%';
      trackFx(waapi(bar,
        [{ transform: 'scaleY(.15)' }, { transform: 'scaleY(1)' }],
        { duration: M.base + 120, easing: E.out, delay: i * STAG, fill: 'backwards' }));
    }
  });
}

/**
 * 离席：面板下沉退焦 + 遮罩收暗的 200ms 尾奏，演完交还 done（调用方收口 DOM 移除）。
 * immediate（卸载路径）/ 评审 RM / 无 WAAPI 宿主：同步收口，绝不让 DOM 晚走。
 * 兜底计时用裸 setTimeout（不入 after 池）——重开面板的 cancelPending 不许杀掉这场收尾。
 */
export function motionPanelClose(mask: HTMLElement, done: () => void, immediate: boolean): void {
  stopBreath(); stopGlow(); stopTone(); stopFx();
  cancelPending();
  lastSig = ''; headLastProgress = -1; lastRemain = -1; lastCount = -1; taskShown = false; todayText = '';
  resetFxCache();
  if (immediate || reduced() || typeof mask.animate !== 'function') { done(); return; }
  const popup = mask.querySelector<HTMLElement>('#pomodoro-popup');
  let finished = false;
  const finish = (): void => { if (!finished) { finished = true; done(); } };
  const sink = popup
    ? waapi(popup,
        [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
         { opacity: 0, transform: 'translateY(10px) scale(.975)', filter: 'blur(6px)' }],
        { duration: M.move, easing: E.out, fill: 'forwards' })
    : null;
  waapi(mask, [{ opacity: 1 }, { opacity: 0 }], { duration: M.move + 40, easing: E.out, fill: 'forwards' });
  if (!sink) { finish(); return; }
  sink.finished.then(finish).catch(finish);
  setTimeout(finish, M.move + 240);
}

/* ================= 点火 / 收工仪式 / 翻页 / 倒带（applyAction 一次性挂点） ================= */

/** 开始/继续：时间字落定；全新开始（idle → focus）加面板一记沉浮 + 主按钮亮脉冲 */
export function motionIgnite(popup: HTMLElement | null, fresh: boolean): void {
  if (!popup) return;
  const timeBox = timeBoxOf(byId('pomodoro-time'));
  if (timeBox) {
    trackFx(waapi(timeBox,
      [{ transform: 'scale(.985)', opacity: 0.7 }, { transform: 'none', opacity: 1 }],
      { duration: M.base, easing: E.out }));
  }
  if (!fresh) return;
  trackFx(waapi(popup,
    [{ transform: 'scale(1)' }, { transform: 'scale(1.012)' }, { transform: 'scale(1)' }],
    { duration: 440, easing: E.out }));
  const btn = byId('pomodoro-btn-start');
  if (btn) {
    trackFx(waapi(btn,
      [{ filter: 'brightness(1)' }, { filter: 'brightness(1.4)' }, { filter: 'brightness(1)' }],
      { duration: 420, easing: E.out }));
  }
}

/** 收工仪式窗口：刚放完仪式的短暂期内，后续氛围（暗幕）让它先说话 */
let ceremonyUntil = 0;
let bootUntil = 0;
let lastRemain = -1;
let lastCount = -1;
let taskShown = false;
let todayText = '';

/**
 * 收工仪式（仅自然完成，action='tick' 才调）：
 *  - 专注完成＝隆重收工：环闪光 + 迸花 + 涟漪两记 + 面板沉浮 + 时间字揭新（环本体沿 CSS 过渡退尽＝番茄入账）；
 *  - 休息完成＝苏醒：面板亮起 + 几羽上浮的软光（与收工刻意分层：休息的结束是轻的）。
 */
export function motionCeremony(popup: HTMLElement | null, svg: HTMLElement | null, completedPhase: string): void {
  if (!popup || !popup.isConnected) return;
  ceremonyUntil = performance.now() + 900;
  const circle = byId('pomodoro-ring-progress');
  if (circle && typeof circle.animate === 'function' && !reduced()) {
    try {
      trackFx(circle.animate(
        [{ filter: 'brightness(1)' }, { filter: 'brightness(1.9)' }, { filter: 'brightness(1)' }],
        { duration: 480, easing: 'ease-out' }));
    } catch { /* 忽略 */ }
  }
  const timeEl = byId('pomodoro-time');
  revealTime(timeEl);
  if (completedPhase === 'focus') {
    trackFx(waapi(popup,
      [{ transform: 'scale(1)' }, { transform: 'scale(1.013)' }, { transform: 'scale(1)' }],
      { duration: 440, easing: E.out }));
    sparks(popup, svg, 16, true);
    ripples(popup, svg, 2);
  } else {
    trackFx(waapi(popup,
      [{ filter: 'brightness(1)' }, { filter: 'brightness(1.035)' }, { filter: 'brightness(1)' }],
      { duration: 600, easing: E.out }));
    sparks(popup, svg, 8, false);
  }
}

/** 时间字揭新（收工/大跳共用）：blur 升落，新值落定 */
function revealTime(timeEl: HTMLElement | null): void {
  const el = timeBoxOf(timeEl);
  if (!el) return;
  trackFx(waapi(el,
    [{ opacity: 0, transform: 'translateY(7px) scale(.97)', filter: 'blur(5px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + 100, easing: E.out }));
}

/** 迸花：从环心放射的一撮火星（暖 = 收工隆重；冷 = 苏醒轻羽，只向上飘） */
function sparks(popup: HTMLElement, svg: HTMLElement | null, count: number, warm: boolean): void {
  if (reduced() || typeof popup.animate !== 'function') return;
  const pr = popup.getBoundingClientRect();
  const sr = svg ? svg.getBoundingClientRect() : pr;
  if (sr.width < 10) return;
  const cx = sr.left - pr.left + sr.width / 2;
  const cy = sr.top - pr.top + sr.height / 2;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.setAttribute('aria-hidden', 'true');
    const s = p.style;
    const size = 3 + Math.random() * 3.5;
    s.position = 'absolute';
    s.left = `${cx - size / 2}px`; s.top = `${cy - size / 2}px`;
    s.width = `${size}px`; s.height = `${size}px`;
    s.borderRadius = '50%';
    s.pointerEvents = 'none';
    const roll = Math.random();
    s.background = roll < 0.6
      ? 'var(--pz-accent, var(--interactive-accent))'
      : roll < 0.85 ? 'var(--pz-fg, var(--text-normal))' : 'var(--pz-muted, var(--text-muted))';
    popup.appendChild(p);
    const ang = warm ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const dist = warm ? 34 + Math.random() * 52 : 18 + Math.random() * 34;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist + (warm ? 0 : -10);
    let removed = false;
    const remove = (): void => { if (!removed) { removed = true; p.remove(); } };
    try {
      const a = p.animate(
        [{ transform: 'translate(0,0) scale(1)', opacity: 1 },
         { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(.15)`, opacity: 0 }],
        { duration: 620 + Math.random() * 380, easing: E.out });
      a.finished.then(remove).catch(remove);
    } catch { remove(); }
    after(1200, remove);
  }
}

/** 涟漪：环心扩散的一两记圆波（收工波） */
function ripples(popup: HTMLElement, svg: HTMLElement | null, count: number): void {
  if (reduced() || typeof popup.animate !== 'function') return;
  const pr = popup.getBoundingClientRect();
  const sr = svg ? svg.getBoundingClientRect() : pr;
  if (sr.width < 10) return;
  const cx = sr.left - pr.left + sr.width / 2;
  const cy = sr.top - pr.top + sr.height / 2;
  const size = Math.max(150, sr.width * 0.95);
  for (let i = 0; i < count; i++) {
    const r = document.createElement('i');
    r.setAttribute('aria-hidden', 'true');
    const s = r.style;
    s.position = 'absolute';
    s.left = `${cx - size / 2}px`; s.top = `${cy - size / 2}px`;
    s.width = `${size}px`; s.height = `${size}px`;
    s.border = '2px solid var(--pz-accent, var(--interactive-accent))';
    s.borderRadius = '50%';
    s.pointerEvents = 'none';
    s.opacity = '0';
    popup.appendChild(r);
    let removed = false;
    const remove = (): void => { if (!removed) { removed = true; r.remove(); } };
    try {
      const a = r.animate(
        [{ transform: 'scale(.55)', opacity: 0.5 }, { transform: 'scale(1.55)', opacity: 0 }],
        { duration: 740, easing: E.out, delay: i * 150, fill: 'backwards' });
      a.finished.then(remove).catch(remove);
    } catch { remove(); }
    after(1100 + i * 150, remove);
  }
}

/** 跳过翻页：面板轻沉一记直接翻相（作废不算收工，刻意无仪式） */
export function motionSkipWhoosh(popup: HTMLElement | null): void {
  if (!popup) return;
  trackFx(waapi(popup,
    [{ transform: 'scale(1)', filter: 'blur(0px)' },
     { transform: 'scale(.988)', filter: 'blur(1.5px)' },
     { transform: 'none', filter: 'blur(0px)' }],
    { duration: M.move + 80, easing: E.move }));
}

/** 重置倒带：面板呼气回位（环沿既有 CSS 1s 过渡自行退尽，本函数不碰环） */
export function motionRewind(popup: HTMLElement | null): void {
  if (!popup) return;
  trackFx(waapi(popup,
    [{ transform: 'scale(1)' }, { transform: 'scale(.991)' }, { transform: 'scale(1)' }],
    { duration: 480, easing: E.out }));
  revealTime(byId('pomodoro-time'));
}

/* ================= 内容级：时间 / 阶段行 / 任务行 / 方点 / 统计 ================= */

/**
 * 时间字每秒口径（render 每秒调）：大跳（相位切换 / 重置 / 冻结回写）→ 揭新；
 * 运行中整分跨越 → 一记脉冲（42px 大字的「分钟落格」）；普通走秒不出手（秒针心跳在环头上）。
 */
export function motionTimeTick(timeEl: HTMLElement | null, remain: number, running: boolean): void {
  const el = timeBoxOf(timeEl);
  if (!el) { lastRemain = -1; return; }
  if (lastRemain < 0) { lastRemain = remain; return; }
  const delta = lastRemain - remain;
  if (Math.abs(delta) > 2) {
    revealTime(el);
  } else if (running && delta === 1 && remain > 0 && remain % 60 === 0) {
    trackFx(waapi(el,
      [{ transform: 'scale(1)' }, { transform: 'scale(1.035)' }, { transform: 'scale(1)' }],
      { duration: M.fast + 120, easing: E.out }));
  }
  lastRemain = remain;
}

/** 阶段文案换字：blur 交替（render 重建 innerHTML 后调） */
export function motionPhaseLabelSwap(el: HTMLElement | null): void {
  if (!el) return;
  trackFx(waapi(el,
    [{ opacity: 0, transform: 'translateY(4px)', filter: 'blur(3px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base, easing: E.out }));
}

/** 任务行出入：备忘录「专注这个」落名时轻揭（收起交给 DOM 本身，不加戏） */
export function motionTaskLine(el: HTMLElement | null, has: boolean): void {
  if (!el) { taskShown = false; return; }
  if (has && !taskShown) {
    trackFx(waapi(el,
      [{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out }));
  }
  taskShown = has;
}

/** 循环方点：新点亮逐颗「按亮」（30ms 接力）；长休清零级联释放 */
export function motionCycleDots(cycleEl: HTMLElement | null, count: number): void {
  if (!cycleEl) { lastCount = -1; return; }
  if (lastCount < 0) { lastCount = count; return; }
  const dots = [...cycleEl.children] as HTMLElement[];
  if (count > lastCount) {
    for (let i = lastCount; i < count && i < dots.length; i++) {
      const dot = dots[i];
      after((i - lastCount) * STAG, () => {
        trackFx(waapi(dot,
          [{ transform: 'scale(.4)', filter: 'brightness(1.8)' }, { transform: 'scale(1)', filter: 'brightness(1)' }],
          { duration: 320, easing: E.out }));
      });
    }
  } else if (count < lastCount) {
    for (let i = count; i < lastCount && i < dots.length; i++) {
      const dot = dots[i];
      after((i - count) * 24, () => {
        trackFx(waapi(dot,
          [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.55)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: 280, easing: E.out }));
      });
    }
  }
  lastCount = count;
}

/** 统计柱起立（重建后调）：boot 入席窗口内让位（首屏编排已管） */
export function motionStatsIn(box: HTMLElement | null): void {
  if (!box || performance.now() < bootUntil) return;
  riseBars(box);
}

/** 今日行落墨：计数变化时轻揭一次（每次收工「今日 +1」的实体感） */
export function motionTodayBlip(el: HTMLElement | null, text: string): void {
  if (!el) { todayText = ''; return; }
  if (todayText && text && text !== todayText) {
    trackFx(waapi(el,
      [{ opacity: 0.35, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out }));
  }
  todayText = text;
}

/* ================= 交互点：按钮按压 / 状态栏微跃 ================= */

/** 按钮按压反馈：三主钮 + 统计两档 tab，pointer 系（键盘激活不加戏）；演出完清句柄不留持 */
export function motionBindButtons(root: HTMLElement): void {
  if (reduced()) return;
  root.querySelectorAll('button').forEach((b) => {
    const btn = b as HTMLElement;
    if (btn.dataset.pmPress) return;
    btn.dataset.pmPress = '1';
    let press: Animation | null = null;
    const down = (): void => {
      if (typeof btn.animate !== 'function') return;
      try { press = btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(.955)' }], { duration: M.fast, easing: E.out, fill: 'forwards' }); } catch { /* 忽略 */ }
    };
    const up = (): void => {
      if (!press) return;
      const p = press; press = null;
      if (typeof btn.animate !== 'function') return;
      try {
        const rel = btn.animate([{ transform: 'scale(.955)' }, { transform: 'scale(1)' }], { duration: M.fast, easing: E.out, fill: 'forwards' });
        rel.finished.then(() => { try { p.cancel(); rel.cancel(); } catch { /* no-op */ } }).catch(() => { /* no-op */ });
      } catch { /* 忽略 */ }
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });
}

/** 状态栏相位微跃（插件侧；同值/首记不出手） */
export function motionStatusbarPop(el: HTMLElement | null, sig: string, first: boolean): void {
  if (!el || first || reduced()) return;
  trackFx(waapi(el,
    [{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }],
    { duration: M.fast + 80, easing: E.out }));
}

/* ================= 清场 ================= */

/** 卸载/重置统一清场：循环、持有、延时、一次性编排与差异记忆全收，不留永动孤儿 */
export function motionTeardown(): void {
  stopBreath(); stopGlow(); stopTone(); stopFx(); cancelPending();
  resetFxCache();
  lastSig = ''; headLastProgress = -1; lastRemain = -1; lastCount = -1;
  taskShown = false; todayText = ''; ceremonyUntil = 0; bootUntil = 0;
}
