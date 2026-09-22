/**
 * 首页动效层（2026-09-22 快速原型批，用户命题：在原 UI 上做同量级复杂动画，布局零改动）。
 *
 * 原则：
 *  - **只动表现，不动布局**——注入件（河面 SVG / 迸光画布 / 光泽层）全部绝对定位、
 *    不吃事件、不参与排版；入场用 transform/opacity/filter，几何从不改写。
 *  - 台账对齐 cinema/motion.ts（issue 400 口径）：fast 160 / move 200 / base 280 /
 *    impulse 740，接力 30ms；揭示用 out 曲线，位移用 move 曲线。
 *  - reduced-motion（评审期口径）：默认**无视**系统设置放完整动画——用户系统开着
 *    「减少动态效果」时按正式口径直达终态，评审者将什么都看不到（2026-09-23 实例）。
 *    ?rm=1 显式模拟 RM。jsdom / 无 matchMedia 环境按非 RM 走，无 WAAPI 时直达终态，
 *    域内测试零感知。正式版要不要让步系统 RM（放缓不减义）= 待拍板项。
 *  - 与渲染纯层解耦：render.ts markup 一字不改；本层只在 ui.ts 生命周期挂点被调用。
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
const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

/** 延时调度（面板级取消，防快速刷新时编排叠加） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/* ================= 面板壳：开 / 关 ================= */

export function motionPanelIn(overlay: HTMLElement, reopen: boolean): void {
  const panel = overlay.querySelector<HTMLElement>('.bz-home-panel');
  if (!panel) return;
  panel.style.opacity = ''; panel.style.transform = ''; panel.style.filter = ''; // 清退场残留（fill:forwards / RM 内联）
  waapi(panel,
    [{ opacity: 0, transform: 'translateY(14px) scale(.985)', filter: 'blur(8px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: reopen ? 300 : 480, easing: E.out });
  bindParallax(overlay);
}

/**
 * 关闭 = 先演 240ms 退场再交还 display:none（done 由调用方收口）。
 * 退场期间被重开（showOverlay 已把 display 拉回）：done 里判 H 侧可见位，不抢。
 * 宿主不支持 WAAPI（测试 / 老宿主）：同步收口，绝不让 display:none 晚到。
 */
export function motionPanelOut(overlay: HTMLElement, done: () => void): void {
  const panel = overlay.querySelector<HTMLElement>('.bz-home-panel');
  stopParallax(overlay);
  if (!panel) { done(); return; }
  let finished = false;
  const finish = (): void => { if (!finished) { finished = true; done(); } };
  const a = waapi(panel,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(10px) scale(.985)', filter: 'blur(6px)' }],
    { duration: M.move + 40, easing: E.out, fill: 'forwards' });
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  after(M.move + 200, finish); // 兜底：动画事件丢失也不能卡住关闭
}

/* ================= 渲染完成：首屏编排 / 刷新静默 ================= */

export function motionRendered(overlay: HTMLElement, boot: boolean): void {
  cancelPending(); // 新渲染覆盖旧编排（对齐 cinema clearSoftRender 口径）
  const panel = overlay.querySelector<HTMLElement>('.bz-home-panel');
  if (!panel) return;
  const narrow = panel.clientWidth > 0 && panel.clientWidth <= 768;
  const week = overlay.querySelector<HTMLElement>('[data-home-week]');
  const entries = overlay.querySelector<HTMLElement>('[data-home-entries]');
  const flow = overlay.querySelector<HTMLElement>('[data-home-flow]');
  const next = overlay.querySelector<HTMLElement>('[data-home-next]');
  if (!boot) {
    // 后台刷新（keepHome 落地等）：整屏不闪；河道静默补挂（innerHTML 重建会冲掉注入件）
    if (flow) { const tl = flow.querySelector<HTMLElement>('.bz-home-timeline'); if (tl) ensureRiver(tl, false); }
    return;
  }
  if (reduced()) return; // 评审模拟 RM：内容已由 render 直接落终态，零编排

  /* —— 周历：3D 翻落接力 —— */
  if (week) {
    const cells = [...week.querySelectorAll<HTMLElement>('.bz-home-wk')];
    cells.forEach((el, i) => {
      after(140 + i * 46, () => {
        waapi(el,
          [{ opacity: 0, transform: 'rotateX(-64deg) translateY(6px)' },
           { opacity: 1, transform: 'none' }],
          { duration: 560, easing: E.out, fill: 'backwards' });
      });
    });
    const sel = cells.find((c) => c.classList.contains('bz-home-wk--sel'));
    if (sel) after(620, () => popBar(sel));
  }

  /* —— 入口行：涟漪上浮（30ms 接力，前 14 行，其余直达）—— */
  if (entries) {
    const rows = [...entries.querySelectorAll<HTMLElement>('.bz-home-erow')];
    rows.forEach((el, i) => {
      if (i >= 14) return;
      after(260 + i * STAG, () => {
        waapi(el,
          [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(4px)' },
           { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
          { duration: M.base, easing: E.out, fill: 'backwards' });
      });
    });
  }

  /* —— 时间线：河道描线 + 事件接力揭出 —— */
  if (flow) {
    const tl = flow.querySelector<HTMLElement>('.bz-home-timeline');
    if (tl) {
      after(300, () => ensureRiver(tl, true));
      revealEvents(tl, { base: 460, stagger: 100, cap: 12 });
    }
    const empty = flow.querySelector<HTMLElement>('.bz-home-flow-empty');
    if (empty) waapi(empty, [{ opacity: 0 }, { opacity: 1 }], { duration: M.base, easing: E.out, fill: 'backwards' });
  }

  /* —— 明天预告：clip 展开 +（桌面）倾斜光泽 —— */
  if (next) {
    const head = next.querySelector<HTMLElement>('.bz-home-sec-t');
    if (head) waapi(head, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out, fill: 'backwards' });
    next.querySelectorAll<HTMLElement>('.bz-home-pr').forEach((el, i) => {
      after(640 + i * 90, () => {
        waapi(el,
          [{ opacity: 0, clipPath: 'inset(0 0 100% 0)', transform: 'translateY(7px)' },
           { opacity: 1, clipPath: 'inset(0 0 -8% 0)', transform: 'none' }],
          { duration: M.base + 120, easing: E.out, fill: 'backwards' });
      });
      if (!narrow && canHover()) bindTilt(el);
    });
  }
}

/* ================= 周历切天：旧河退场 → 重写 → 新河揭出 ================= */

/** 重写闭包由 ui.ts 提供（innerHTML 单源不动）；本函数只包退场/揭出的节奏 */
export function motionDaySwitch(flow: HTMLElement, rewrite: () => void): void {
  const tl = flow.querySelector<HTMLElement>('.bz-home-timeline');
  if (reduced() || !tl) { rewrite(); return; }
  const out = waapi(tl,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(-6px)', filter: 'blur(4px)' }],
    { duration: M.fast + 20, easing: E.out, fill: 'forwards' });
  if (!out) { rewrite(); return; } // 无动画宿主：同步重写，内容绝不满天飞
  after(M.fast + 30, () => {
    rewrite();
    const nt = flow.querySelector<HTMLElement>('.bz-home-timeline');
    if (nt) {
      ensureRiver(nt, true);
      revealEvents(nt, { base: 40, stagger: 70, cap: 12 });
    } else {
      const empty = flow.querySelector<HTMLElement>('.bz-home-flow-empty');
      if (empty) waapi(empty, [{ opacity: 0 }, { opacity: 1 }], { duration: M.base, easing: E.out, fill: 'backwards' });
    }
  });
}

/** 选中格彩条弹跳（切天 / 首屏落到选中日） */
export function motionWeekPop(wk: HTMLElement): void {
  if (reduced()) return;
  wk.classList.remove('bz-hm-wkpop');
  void wk.offsetWidth; // 重启动画
  wk.classList.add('bz-hm-wkpop');
}
function popBar(wk: HTMLElement): void { motionWeekPop(wk); }

/* ================= 事件揭出：彩点点亮 + 迸光 + 卡片上浮 ================= */

const SPARK_FALLBACK: Record<string, string> = { ok: '#2f9e5f', warn: '#d98a1f', hot: '#c74a2c' };

/** 圆点锚（::before 的 left/top 随字号档变化）；伪元素读取在测试宿主可能不可用，兜基础档 */
function beforeAnchor(li: HTMLElement): { left: number; top: number } {
  try {
    const cs = getComputedStyle(li, '::before');
    return { left: parseFloat(cs.left) || 6, top: parseFloat(cs.top) || 17 };
  } catch { return { left: 6, top: 17 }; }
}

function sparkColor(tl: HTMLElement, li: HTMLElement): string {
  const key = li.classList.contains('bz-home-ev--hot') ? '--h-red'
    : li.classList.contains('bz-home-ev--warn') ? '--h-amber' : '--h-ok';
  try {
    const v = getComputedStyle(tl).getPropertyValue(key).trim();
    if (v) return v;
  } catch { /* 测试宿主无 computedStyle 时走兜底色 */ }
  return SPARK_FALLBACK[key === '--h-red' ? 'hot' : key === '--h-amber' ? 'warn' : 'ok'];
}

function revealEvents(
  tl: HTMLElement,
  opts: { base: number; stagger: number; cap: number },
): void {
  const lis = [...tl.querySelectorAll<HTMLElement>('.bz-home-ev')];
  lis.forEach((li, i) => {
    const delay = opts.base + Math.min(i, opts.cap) * opts.stagger;
    li.style.willChange = 'transform,filter,opacity';
    after(delay, () => {
      waapi(li,
        [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(5px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base + 140, easing: E.out, fill: 'backwards' });
      li.classList.add('bz-hm-ign');
      after(620, () => li.classList.remove('bz-hm-ign'));
      after(120, () => {
        const a = beforeAnchor(li);
        const r = li.getBoundingClientRect(), tr = tl.getBoundingClientRect();
        burst(tl, r.left - tr.left + a.left + 4, r.top - tr.top + a.top + 4, sparkColor(tl, li));
      });
    });
  });
  // ✦ 规则点评晚一拍浮现（AI 语汇：先事，后评）
  lis.forEach((li, i) => {
    const note = li.querySelector<HTMLElement>('.bz-home-ev-note');
    if (!note) return;
    after(opts.base + Math.min(i, opts.cap) * opts.stagger + 240, () => {
      waapi(note, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: M.base, easing: E.out, fill: 'backwards' });
    });
  });
}

/* ================= 河道：SVG 描线 + 虚线常流（替换 ::before 的视觉，几何同位） ================= */

/**
 * 几何取自事件行的圆点锚（::before left/top 随字号档变化，现算）；
 * 纵向轻微摆幅的贝塞尔串 = 「河」，描完后虚线沿流向缓动（河是活的）。
 * .has-river 同步隐掉原生 ::before 虚线——视觉同位替换，不改任何几何。
 */
function ensureRiver(tl: HTMLElement, animate: boolean): void {
  const lis = [...tl.querySelectorAll<HTMLElement>('.bz-home-ev')];
  let svg = tl.querySelector<SVGSVGElement>(':scope > .bz-hm-river');
  if (!lis.length) { svg?.remove(); tl.classList.remove('has-river'); return; }
  const w = tl.scrollWidth, h = tl.scrollHeight;
  if (w < 10 || h < 10) return;
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('bz-hm-river');
    svg.innerHTML = '<defs></defs>'
      + '<mask id="bz-hm-rv-mask" maskUnits="userSpaceOnUse"><path class="bz-hm-rv-reveal" fill="none" stroke="#fff" stroke-width="8"/></mask>'
      + '<path class="bz-hm-rv-base" fill="none" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3" mask="url(#bz-hm-rv-mask)"/>';
    tl.prepend(svg);
  }
  tl.classList.add('has-river');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.style.width = `${w}px`; svg.style.height = `${h}px`;
  const base = svg.querySelector<SVGPathElement>('.bz-hm-rv-base');
  const reveal = svg.querySelector<SVGPathElement>('.bz-hm-rv-reveal');
  if (!base || !reveal) return;
  base.style.stroke = 'var(--h-line)';
  const tr = tl.getBoundingClientRect();
  const pts = lis.map((li) => {
    const a = beforeAnchor(li);
    const r = li.getBoundingClientRect();
    return { x: r.left - tr.left + a.left + 4, y: r.top - tr.top + a.top + 4 };
  });
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], sway = i % 2 ? 7 : -7, dy = (b.y - a.y) * .4;
    d += ` C ${(a.x + sway).toFixed(1)} ${(a.y + dy).toFixed(1)}, ${(b.x - sway).toFixed(1)} ${(b.y - dy).toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  base.setAttribute('d', d);
  reveal.setAttribute('d', d);
  const len = base.getTotalLength() + 2;
  base.classList.remove('bz-hm-flowing');
  if (!animate) { reveal.style.strokeDasharray = 'none'; reveal.style.strokeDashoffset = '0'; base.classList.add('bz-hm-flowing'); return; }
  reveal.style.strokeDasharray = String(len);
  reveal.style.strokeDashoffset = String(len);
  tween(850, (v) => { reveal.style.strokeDashoffset = String(len * (1 - v)); }, easeOutQuart);
  after(870, () => base.classList.add('bz-hm-flowing'));
}

/* ================= 迸光画布：彩点点亮时的一撮火星（按需起停，各归各画布） ================= */

type Spark = { x: number; y: number; vx: number; vy: number; life: number; r: number; color: string };
const sparkPools = new Map<HTMLCanvasElement, Spark[]>();
let fxRaf = 0;

function burst(tl: HTMLElement, x: number, y: number, color: string): void {
  if (reduced()) return;
  let fx = tl.querySelector<HTMLCanvasElement>(':scope > .bz-hm-fx');
  if (!fx) {
    fx = document.createElement('canvas');
    fx.className = 'bz-hm-fx';
    tl.appendChild(fx);
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = tl.scrollWidth, h = tl.scrollHeight;
  if (fx.width !== Math.round(w * dpr) || fx.height !== Math.round(h * dpr)) {
    fx.width = Math.round(w * dpr); fx.height = Math.round(h * dpr);
    fx.style.width = `${w}px`; fx.style.height = `${h}px`;
  }
  const ctx = fx.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pool = sparkPools.get(fx) ?? [];
  for (let i = 0; i < 8; i++) {
    const ang = -Math.PI / 2 + (Math.random() - .5) * 2.4;
    const sp = 1.1 + Math.random() * 2;
    pool.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, r: .9 + Math.random() * 1.3, color });
  }
  sparkPools.set(fx, pool);
  if (!fxRaf) fxRaf = requestAnimationFrame(fxTick);
}
function fxTick(): void {
  fxRaf = 0;
  for (const [fx, pool] of [...sparkPools.entries()]) {
    const ctx = fx.getContext('2d');
    if (!ctx || !fx.isConnected) { sparkPools.delete(fx); continue; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, fx.width, fx.height);
    for (let i = pool.length - 1; i >= 0; i--) {
      const s = pool[i];
      s.x += s.vx; s.y += s.vy; s.vy += .05; s.vx *= .985; s.life -= .025;
      if (s.life <= 0) { pool.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * s.life, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!pool.length) sparkPools.delete(fx);
  }
  if (sparkPools.size) fxRaf = requestAnimationFrame(fxTick);
}

/* ================= 景深视差（桌面）：三栏 + 头行按深度微移 ================= */

type ParallaxState = { overlay: HTMLElement; layers: { el: HTMLElement; d: number }[]; tx: number; ty: number; x: number; y: number; raf: number; onMove: (e: PointerEvent) => void; onLeave: () => void };
const parallax = new Map<HTMLElement, ParallaxState>();

function bindParallax(overlay: HTMLElement): void {
  const panel = overlay.querySelector<HTMLElement>('.bz-home-panel');
  if (!panel || parallax.has(overlay)) return;
  if (reduced() || !canHover() || panel.clientWidth <= 768) return;
  const layers = [
    { el: panel.querySelector<HTMLElement>('.bz-home-head'), d: 2 },
    { el: panel.querySelector<HTMLElement>('[data-home-entries]'), d: 3.5 },
    { el: panel.querySelector<HTMLElement>('[data-home-flow]'), d: 5 },
    { el: panel.querySelector<HTMLElement>('[data-home-next]'), d: 3 },
  ].filter((l): l is { el: HTMLElement; d: number } => !!l.el);
  const st: ParallaxState = { overlay, layers, tx: 0, ty: 0, x: 0, y: 0, raf: 0,
    onMove: (e) => {
      const r = panel.getBoundingClientRect();
      st.tx = ((e.clientX - r.left) / r.width - .5) * 2;
      st.ty = ((e.clientY - r.top) / r.height - .5) * 2;
      if (!st.raf) st.raf = requestAnimationFrame(parallaxTick);
    },
    onLeave: () => { st.tx = 0; st.ty = 0; if (!st.raf) st.raf = requestAnimationFrame(parallaxTick); },
  };
  panel.addEventListener('pointermove', st.onMove);
  panel.addEventListener('pointerleave', st.onLeave);
  parallax.set(overlay, st);
}
function parallaxTick(): void {
  let active = false;
  for (const st of parallax.values()) {
    st.raf = 0;
    st.x += (st.tx - st.x) * .07; st.y += (st.ty - st.y) * .07;
    if (Math.abs(st.tx - st.x) < .002 && Math.abs(st.ty - st.y) < .002) { st.x = st.tx; st.y = st.ty; }
    for (const l of st.layers) l.el.style.transform = `translate3d(${(st.x * l.d).toFixed(2)}px, ${(st.y * l.d * .6).toFixed(2)}px, 0)`;
    if (st.x !== st.tx || st.y !== st.ty) active = true;
  }
  if (active) for (const st of parallax.values()) if (!st.raf) st.raf = requestAnimationFrame(parallaxTick);
}
function stopParallax(overlay: HTMLElement): void {
  const st = parallax.get(overlay);
  if (!st) return;
  st.overlay.removeEventListener('pointermove', st.onMove);
  st.overlay.removeEventListener('pointerleave', st.onLeave);
  if (st.raf) cancelAnimationFrame(st.raf);
  for (const l of st.layers) l.el.style.transform = '';
  parallax.delete(overlay);
}

/* ================= 明天预告卡：3D 倾斜 + 光泽（桌面） ================= */

function bindTilt(card: HTMLElement): void {
  if (card.dataset.hmTilt) return;
  card.dataset.hmTilt = '1';
  card.classList.add('bz-hm-tilt');
  let rx = 0, ry = 0, trx = 0, tryy = 0, raf = 0;
  const glare = document.createElement('i');
  glare.className = 'bz-hm-glare';
  card.appendChild(glare);
  const loop = (): void => {
    rx += (trx - rx) * .14; ry += (tryy - ry) * .14;
    card.style.transform = (Math.abs(rx) > .02 || Math.abs(ry) > .02)
      ? `perspective(620px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)` : '';
    if (Math.abs(trx - rx) > .01 || Math.abs(tryy - ry) > .01 || trx || tryy) raf = requestAnimationFrame(loop);
    else raf = 0;
  };
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width - .5, my = (e.clientY - r.top) / r.height - .5;
    trx = -my * 4.5; tryy = mx * 5;
    glare.style.setProperty('--gx', `${(mx * 100 + 50).toFixed(1)}%`);
    glare.style.setProperty('--gy', `${(my * 100 + 50).toFixed(1)}%`);
    if (!raf) raf = requestAnimationFrame(loop);
  });
  card.addEventListener('pointerleave', () => { trx = 0; tryy = 0; if (!raf) raf = requestAnimationFrame(loop); });
}

/* ================= 评审便利：#replay 重播首屏编排（快速原型批；插件内同样无害） =================
   壳在页面加载时就跑 openHome，编排可能发生在你看到页面之前——带 #replay 打开（或刷新）
   会在 0.6s 后重播一次：面板唤醒 + 内容全编排。ui.ts 在 createOverlay 里挂 __bzHomeReplay。 */
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#replay') return;
    location.hash = '';
    const replay = (window as unknown as Record<string, unknown>).__bzHomeReplay as (() => void) | undefined;
    if (typeof replay === 'function') setTimeout(replay, 600);
  });
  if (location.hash === '#replay') {
    // 首载即带 hash：hashchange 不会自发触发，等 ui 挂好钩子后播一次
    const wait = (): void => {
      const replay = (window as unknown as Record<string, unknown>).__bzHomeReplay as (() => void) | undefined;
      if (typeof replay === 'function') { location.hash = ''; setTimeout(replay, 600); }
      else setTimeout(wait, 120);
    };
    setTimeout(wait, 120);
  }
}
