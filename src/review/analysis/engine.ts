/**
 * 记忆分析 · 引擎（翻幕 + 表演调度 + 灯谱 + 更漏 + 巡火）
 *
 * 幕是整屏一节，表演按时间演，不靠滚动进度抽：十六幕各占一屏，滚轮/方向键一滚翻一幕，
 * 翻到的那幕从 t=0 重演一遍，翻走时推到终态（t=dur）——回看不会撞见半截画面。
 * 翻幕只是 scrollTop = i × 屏高；换幕的「过片」用两片隔扇从中线合拢（留一道火色细缝）——
 * 合上的那一帧完成换幕与激活，再打开，位移过程全程看不见。
 * 手势：一次滚轮手势只翻一幕（GESTURE_GAP 内的连续 wheel 算同一次，触控板惯性不连翻）；
 * 「巡火」按各幕自己的时长往下放（dur + 1.4s 停留），随时可停。
 * 指针：pointermove 归一成 px/py（-1..1）+ 屏内坐标 cx/cy 逐帧喂给当前幕，
 * 各幕自己决定拿来做什么（斥力/悬停浮签/视差）；指针离场归零。
 * 心跳：rAF 优先；窗口被遮挡 rAF 不来时用 220ms 定时器兜底推进（绘制按真实时钟，画面不错位）。
 * 容错：单幕表演抛异常只废那一幕——该幕标 is-err 转全可见静版，不冻结整场放映。
 * 减动效：只认 ?rm=1（显式模拟），直达终态不启动心跳。
 */
import type { RaData } from './data';
import { buildPerfs, type Perf, type PerfCtx } from './motions';
import { palette, tip, type Palette } from './kits';

export interface RaHandle { stop(): void; goTo(i: number): void }

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

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，与域内 motion.ts 一致）。 */
function reduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}

function qa(root: ParentNode, sel: string): HTMLElement[] {
  return [...root.querySelectorAll(sel)] as HTMLElement[];
}

export function bindAnalysis(root: HTMLElement, data: RaData): RaHandle {
  const sc = root.querySelector<HTMLElement>('.bz-ra-scroll');
  const film = root.querySelector<HTMLElement>('.ra-film');
  const handle: RaHandle = { stop: (): void => undefined, goTo: (): void => undefined };
  if (!sc || !film) return handle;
  const scEl: HTMLElement = sc;
  const filmEl: HTMLElement = film;

  const scenes = qa(film, '.bz-ra-scn');
  if (!scenes.length) return handle;
  const perfs = buildPerfs(film, data, root);
  // 灯谱/隔扇在固定层里（2026-09-23 起挂 .bz-ra-box 下、滚动容器之外，翻幕不动）——
  // 查询一律走 root；更漏底栏已撤，barI/barN/barLine/pb 保持空值保护（找不到即跳过）
  const lamps = qa(root, '.ra-lamp');
  const shutter = root.querySelector<HTMLElement>('[data-r="shutter"]');
  const barI = root.querySelector<HTMLElement>('[data-r="barI"]');
  const barN = root.querySelector<HTMLElement>('[data-r="barN"]');
  const barLine = root.querySelector<HTMLElement>('[data-r="barLine"]');
  const pb = root.querySelector<HTMLElement>('[data-r="pb"]');

  let pal: Palette = palette(root);
  let cur = -1;
  let t0 = performance.now();
  let raf = 0;
  let fallback = 0;
  let dead = false;
  let autoplay = false;
  let autoAt = 0;
  let navTarget = -1;
  let navUntil = 0;
  /** 指针状态（归一 -1..1 + 屏内坐标；离场归零） */
  let px = 0, py = 0, cx = 0, cy = 0, pin = 0;
  const settled = new Set<number>();
  const broken = new Set<string>();
  let cutTimers: ReturnType<typeof setTimeout>[] = [];

  /** 幕高 = 滚动口高（写在 film 的 --ra-h 上；resize 时引擎重锚） */
  const unit = (): number => Math.max(1, scEl.clientHeight);
  const fitHeight = (): void => filmEl.style.setProperty('--ra-h', `${unit()}px`);
  fitHeight();
  const indexAt = (): number => clamp(Math.round(scEl.scrollTop / unit()), 0, scenes.length - 1);

  function hud(i: number, p: number): void {
    lamps.forEach((lp, k) => {
      if (k === i) lp.setAttribute('data-on', '1');
      else lp.removeAttribute('data-on');
    });
    if (barI) barI.textContent = String(i + 1).padStart(2, '0');
    if (barN) barN.textContent = scenes[i].dataset.name ?? '';
    if (barLine) barLine.style.transform = `scaleX(${p.toFixed(4)})`;
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
      try { console.error('[记忆分析] 幕表演异常，该幕转静版：', id, e); } catch { /* 忽略 */ }
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
      // 翻幕顺手收掉浮签：新一幕的悬停状态是干净的，不能继承上一幕的读数
      tip(root, '');
    }
    cur = i;
    settled.delete(i);
    const perf: Perf | undefined = perfs.get(scenes[i].getAttribute('data-id') ?? '');
    if (replay) t0 = performance.now();
    if (perf) play(perf, scenes[i], { t: replay ? 0 : perf.dur, pal, px, py, cx, cy, pin });
    const scn = scenes[i];
    scn.classList.remove('is-in');
    void scn.offsetWidth; // 重触发入场落定（隔扇打开后有一下轻落，不像换静止图）
    scn.classList.add('is-in');
    hud(i, 0);
    autoAt = performance.now();
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
  handle.goTo = goTo;
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
    setAuto(false);
    goRel(e.deltaY > 0 ? 1 : -1);
  }

  function onKey(e: KeyboardEvent): void {
    if (dead || !root.isConnected) return;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown') { e.preventDefault(); setAuto(false); goRel(1); }
    else if (k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); setAuto(false); goRel(-1); }
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
    // 巡火：本幕演完再停 1.4s 自动下一幕；最后一幕放完即停
    if (autoplay && now - autoAt > (perf.dur + 1.4) * 1000) {
      if (cur >= scenes.length - 1) setAuto(false);
      else goRel(1);
    }
  }

  function setAuto(on: boolean): void {
    if (autoplay === on) return;
    autoplay = on;
    if (pb) {
      pb.textContent = on ? '停火' : '巡火';
      pb.classList.toggle('is-on', on);
    }
    autoAt = performance.now();
  }

  const onOvlClick = (e: Event): void => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-r="pb"]')) { setAuto(!autoplay); return; }
    const lamp = t.closest<HTMLElement>('.ra-lamp');
    if (lamp) { setAuto(false); goTo(Number(lamp.getAttribute('data-i') ?? 0), { cut: true }); }
  };

  const onPointerMove = (e: PointerEvent): void => {
    const r = root.getBoundingClientRect();
    cx = e.clientX; cy = e.clientY;
    px = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    py = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
    pin = 1;
  };
  /** 指针离场：位置归零 + 收掉浮签（不然浮签会挂在上一幕/上一处悬停上） */
  const onPointerLeave = (): void => { pin = 0; px = 0; py = 0; tip(root, ''); };

  // 主题切换（Obsidian 明暗）→ 画布/DOM 取色跟随
  const mo = typeof MutationObserver === 'function'
    ? new MutationObserver(() => { pal = palette(root); })
    : null;
  mo?.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // 滚动口尺寸变化 → 幕高重写 + 当前幕重锚（窗 resize / 旋屏都会改幕高，ADR-0175 同款）
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (dead || cur < 0) return;
    fitHeight();
    const want = cur * unit();
    if (Math.abs(scEl.scrollTop - want) > 1) scEl.scrollTop = want;
  }) : null;
  ro?.observe(scEl);

  filmEl.addEventListener('click', onOvlClick);
  scEl.addEventListener('wheel', onWheel, { passive: false });
  scEl.addEventListener('scroll', syncFromScroll, { passive: true });
  root.addEventListener('pointermove', onPointerMove, { passive: true });
  root.addEventListener('pointerleave', onPointerLeave, { passive: true });
  document.addEventListener('keydown', onKey);

  if (reduced()) {
    // ?rm=1：全部幕一次推到终态，不启心跳、不放自动
    scenes.forEach((scn, i) => {
      const perf = perfs.get(scn.getAttribute('data-id') ?? '');
      if (perf) play(perf, scn, { t: perf.dur, pal, px: 0, py: 0, cx: 0, cy: 0, pin: 0 });
    });
    cur = scenes.length - 1;
    hud(scenes.length - 1, 1);
  } else {
    activate(0, true);
    pump();
  }

  handle.stop = (): void => {
    dead = true;
    rafStop(raf);
    clearTimeout(fallback);
    mo?.disconnect();
    ro?.disconnect();
    clearCut();
    tip(root, '');
    filmEl.removeEventListener('click', onOvlClick);
    scEl.removeEventListener('wheel', onWheel);
    scEl.removeEventListener('scroll', syncFromScroll);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('keydown', onKey);
  };
  return handle;
}
