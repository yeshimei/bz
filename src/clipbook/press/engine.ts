/**
 * 读报特刊 · 引擎（翻幕 + 表演调度 + 底栏 + 指针）
 *
 * 幕是整屏一节，表演按时间演，不靠滚动进度抽：十六幕各占一屏，滚轮/方向键一滚翻一幕，
 * 翻到的那幕从 t=0 重演一遍，翻走时推到终态（t=dur）——回看不会撞见半截画面。
 * 翻幕只是 scrollTop = i × 屏高；换幕的「过片」用两条纸带（上下虚线边）从中线合拢——
 * 合上的那一帧完成换幕与激活，再打开，位移过程全程看不见。
 * 手势：一次滚轮手势只翻一幕（GESTURE_GAP 内的连续 wheel 算同一次，触控板惯性不连翻）；
 * 「自动」按各幕自己的时长往下放，随时可停。
 * 指针：pointermove 归一成 px/py（-1..1）+ 屏内坐标 cx/cy 逐帧喂给当前幕，
 * 各幕自己决定拿来做什么（斥力/悬停浮签/视差）；指针离场归零。
 * 心跳：rAF 优先；窗口被遮挡 rAF 不来时用 220ms 定时器兜底推进（绘制按真实时钟，画面不错位）。
 * 容错：单幕表演抛异常只废那一幕——该幕标 is-err 转全可见，不冻结整场放映。
 */
import type { PressData } from './data';
import { buildPressPerfs, palette, type Palette, type Perf, type PerfCtx } from './motions';
import { bindSwipeTurn } from '../../core/gesture';

export interface PressHandle { stop(): void }

const GESTURE_GAP = 340;

const rafFn = typeof requestAnimationFrame === 'function'
  ? (cb: () => void): number => requestAnimationFrame(cb)
  : (cb: () => void): number => setTimeout(cb, 16) as unknown as number;
const rafStop = (id: number): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
};

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
const clamp01 = (x: number): number => clamp(x, 0, 1);

function qa(root: ParentNode, sel: string): HTMLElement[] {
  return [...root.querySelectorAll(sel)] as HTMLElement[];
}

export function bindPress(root: HTMLElement, data: PressData): PressHandle {
  const sc = root.querySelector<HTMLElement>('.bz-rp-scroll');
  const film = root.querySelector<HTMLElement>('.bz-rp-film');
  const handle: PressHandle = { stop: (): void => undefined };
  if (!sc || !film) return handle;
  const scEl: HTMLElement = sc;
  const filmEl: HTMLElement = film;

  const scenes = qa(film, '.bz-rp-scn');
  if (!scenes.length) return handle;
  const perfs = buildPressPerfs(film, data);
  // 刻度条在 box 层（film 的兄弟），从 box 查
  const box = (filmEl.closest('.bz-rp-box') as HTMLElement | null) ?? root;
  const ticks = qa(box, '.bz-rp-tick');
  const shutter = box.querySelector<HTMLElement>('[data-r="shut"]');

  let pal: Palette = palette(root);
  let cur = -1;
  let t0 = performance.now();
  let raf = 0;
  let fallback = 0;
  let dead = false;
  let navTarget = -1;
  let navUntil = 0;
  /** 指针状态（归一 -1..1 + 屏内坐标；离场归零） */
  let px = 0, py = 0, cx = 0, cy = 0, pin = 0;
  const settled = new Set<number>();
  const broken = new Set<string>();
  let cutTimers: ReturnType<typeof setTimeout>[] = [];

  /** 幕高 = 滚动口高（写在 film 的 --rp-h 上；resize 时引擎重锚） */
  const unit = (): number => Math.max(1, scEl.clientHeight);
  const fitHeight = (): void => filmEl.style.setProperty('--rp-h', `${unit()}px`);
  fitHeight();
  const indexAt = (): number => clamp(Math.round(scEl.scrollTop / unit()), 0, scenes.length - 1);

  function hud(i: number, p: number): void {
    void p;
    ticks.forEach((tk, k) => {
      if (k === i) tk.setAttribute('data-on', '1');
      else tk.removeAttribute('data-on');
    });
    box.dataset.cur = String(i + 1).padStart(2, '0');
  }

  /** 幕表演容错：抛异常只废那一幕（标 is-err 转全可见），不冻结整场 */
  function play(perf: Perf, scn: Element, ctx: PerfCtx): void {
    const id = scn.getAttribute('data-id') ?? '';
    if (broken.has(id)) return;
    try {
      perf.update(ctx);
    } catch (e) {
      broken.add(id);
      scn.classList.add('is-err'); // CSS 兜底：该幕全部转可见
      try { console.error('[读报特刊] 幕表演异常，该幕转静版：', id, e); } catch { /* 忽略 */ }
    }
  }

  /** 激活第 i 幕：重置时间轴从 0 演（replay=false 直接给终态） */
  function activate(i: number, replay = true): void {
    if (dead || (i === cur && !replay)) return;
    if (cur >= 0 && cur !== i) {
      const prev = perfs.get(scenes[cur].getAttribute('data-id') ?? '');
      if (prev && !settled.has(cur)) {
        play(prev, scenes[cur], { t: prev.dur, pal, px, py, cx, cy, pin });
        settled.add(cur);
      }
    }
    cur = i;
    settled.delete(i);
    const perf: Perf | undefined = perfs.get(scenes[i].getAttribute('data-id') ?? '');
    if (replay) t0 = performance.now();
    if (perf) play(perf, scenes[i], { t: replay ? 0 : perf.dur, pal, px, py, cx, cy, pin });
    const scn = scenes[i];
    scn.classList.remove('is-in');
    void scn.offsetWidth; // 重触发入场落定（遮带打开后有一下轻落，不像换静止图）
    scn.classList.add('is-in');
    hud(i, 0);
  }

  const clearCut = (): void => { for (const id of cutTimers) clearTimeout(id); cutTimers = []; };
  const cutTo = (target: number, replay: boolean): void => {
    navTarget = target;
    scEl.scrollTop = target * unit();
    activate(target, replay);
  };

  function goTo(i: number, opts?: { replay?: boolean; cut?: boolean }): void {
    const target = clamp(i, 0, scenes.length - 1);
    navTarget = target;
    navUntil = performance.now() + 900;
    if (target === cur || opts?.cut === false) {
      activate(target, opts?.replay ?? true);
      return;
    }
    if (!shutter) { cutTo(target, opts?.replay ?? true); return; }
    clearCut();
    shutter.classList.remove('is-open');
    shutter.classList.add('is-close');
    cutTimers.push(setTimeout(() => {
      cutTo(target, opts?.replay ?? true); // 合上的这一帧换幕
      shutter.classList.remove('is-close');
      shutter.classList.add('is-open');
      cutTimers.push(setTimeout(() => shutter.classList.remove('is-open'), 240));
    }, 160));
  }

  const goRel = (dN: number): void => goTo(cur < 0 ? 0 : cur + dN, { cut: true });

  /** 滚动落点 → 当前幕（拖滚动条/触控滑动也走这条；程序化翻幕期间只认目标幕） */
  function syncFromScroll(): void {
    if (dead) return;
    const i = indexAt();
    if (performance.now() < navUntil && i !== navTarget) return;
    if (i !== cur) activate(i, true);
  }

  let lastWheel = 0;
  function onWheel(e: WheelEvent): void {
    if (dead) return;
    const now = performance.now();
    const fresh = now - lastWheel > GESTURE_GAP;
    lastWheel = now;
    if (!fresh) { e.preventDefault(); return; }
    if (Math.abs(e.deltaY) < 1) return;
    e.preventDefault();
   
    goRel(e.deltaY > 0 ? 1 : -1);
  }

  function onKey(e: KeyboardEvent): void {
    if (dead || !root.isConnected) return;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown') { e.preventDefault(); goRel(1); }
    else if (k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); goRel(-1); }
    else if (k === 'Home') { e.preventDefault(); goTo(0, { cut: true }); }
    else if (k === 'End') { e.preventDefault(); goTo(scenes.length - 1, { cut: true }); }
  }

  function pump(): void {
    if (dead) return;
    clearTimeout(fallback);
    tick(performance.now());
    raf = rafFn(() => { clearTimeout(fallback); pump(); });
    fallback = setTimeout(() => { rafStop(raf); pump(); }, 220) as unknown as number;
  }

  function tick(now: number): void {
    if (dead || cur < 0) return;
    const perf = perfs.get(scenes[cur].getAttribute('data-id') ?? '');
    if (!perf) return;
    const t = (now - t0) / 1000;
    play(perf, scenes[cur], { t, pal, px, py, cx, cy, pin });
    hud(cur, clamp01(t / perf.dur));
  }

  const onOvlClick = (e: Event): void => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-r="close"]')) return; // 关闭钮由装配层处理
    const tickEl = t.closest<HTMLElement>('.bz-rp-tick');
    if (tickEl) goTo(Number(tickEl.getAttribute('data-i') ?? 0), { cut: true });
  };

  /** 指针归一（−1..1）认**层框逻辑**系（box = .bz-rp-box）：各幕把 px/py 直接映回画布像素，
   *  软横屏旋转态（is-rot90）视觉 rect 会把交互整个转错 90°——归一后换轴反向。
   *  cx/cy 仍是视口值（浮签等 fixed 定位消费方要的就是它）。 */
  const onPointerMove = (e: PointerEvent): void => {
    const r = box.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    const ny = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
    const rot = box.classList.contains('is-rot90');
    cx = e.clientX; cy = e.clientY;
    px = rot ? ny : nx;
    py = rot ? -nx : ny;
    pin = 1;
  };
  const onPointerLeave = (): void => { pin = 0; px = 0; py = 0; };

  // 主题切换（Obsidian 明暗）→ 画布/DOM 取色跟随
  const mo = typeof MutationObserver === 'function'
    ? new MutationObserver(() => { pal = palette(root); })
    : null;
  mo?.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // 滚动口尺寸变化 → 幕高重写 + 当前幕重锚（面板矩形跟随，窗 resize / 旋屏都会改幕高）
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (dead || cur < 0) return;
    fitHeight();
    const want = cur * unit();
    if (Math.abs(scEl.scrollTop - want) > 1) scEl.scrollTop = want;
  }) : null;
  ro?.observe(scEl);

  scEl.addEventListener('wheel', onWheel, { passive: false });
  scEl.addEventListener('scroll', syncFromScroll, { passive: true });
  box.addEventListener('click', onOvlClick); // 底栏（自动/刻度）在 box 层，点测绑 box
  // 触屏没有 wheel（真机上滑翻不动页）：手势区整体接管，一滑一幕（core/gesture 单源）
  const unSwipe = bindSwipeTurn(scEl, (d) => goRel(d));
  root.addEventListener('pointermove', onPointerMove, { passive: true });
  root.addEventListener('pointerleave', onPointerLeave, { passive: true });
  document.addEventListener('keydown', onKey);

  activate(0, true);
  pump();

  handle.stop = (): void => {
    dead = true;
    rafStop(raf);
    clearTimeout(fallback);
    mo?.disconnect();
    ro?.disconnect();
    clearCut();
    scEl.removeEventListener('wheel', onWheel);
    scEl.removeEventListener('scroll', syncFromScroll);
    unSwipe();
    box.removeEventListener('click', onOvlClick);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('keydown', onKey);
  };
  return handle;
}
