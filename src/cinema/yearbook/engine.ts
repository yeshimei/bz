/**
 * 观影志 · 引擎（翻幕 + 表演调度 + 导航点）
 *
 * 与上一稿最大的不同：**幕是整屏一节，表演按时间演，不靠滚动进度抽**。
 *   26 节各占一屏（`.bz-yb-scn` 高 = 滚动口高），滚轮/方向键/触控一滚就翻一节；
 *   翻到的那一节自己从 t=0 演一遍（motions.ts 的时间轴），演完进常驻；
 *   翻走时把它推到终态（t = dur）——回看一趟不会看到半截画面。
 * 这样就没有「自己滚到底」「幕与幕错位」这类几何问题：翻幕只是 `scrollTop = i × 屏高`。
 *
 * 手势：一次滚轮手势只翻一幕（GESTURE_GAP 内的连续 wheel 事件算同一次，
 * 触控板惯性不再连翻）。
 *
 * 翻幕的「过片」：换幕时先把**遮片**合上（两片纸从上下合到中线，留一道朱红细缝），
 * 遮片合上的那一帧完成滚动与激活，再打开——于是换幕是一刀切，而不是「慢慢滑过去」。
 * 这与「一滚一幕」是同一套节奏：滚轮一响就过片，看不见中间的位移过程。
 */
import type { YbData } from './data';
import { buildPerfs, type Perf } from './motions';
import { palette, qsa, clamp, tip, type Palette } from './kits';
import { MOTION } from '../motion';
import { bindSwipeTurn } from '../../core/gesture';

export interface YbHandle { stop(): void; goTo(i: number, opts?: { replay?: boolean }): void }

const GESTURE_GAP = 340;

export function bindYearbook(root: HTMLElement, data: YbData): YbHandle {
  const sc = root.querySelector<HTMLElement>('.bz-yb-scroll');
  const film = root.querySelector<HTMLElement>('.bz-yb-film');
  const handle: YbHandle = { stop: () => undefined, goTo: () => undefined };
  if (!sc || !film) return handle;
  const scEl: HTMLElement = sc;

  const scenes = qsa(film, '.bz-yb-scn');
  if (!scenes.length) return handle;
  const perfs = buildPerfs(film, data, root); // 浮签挂整屏根：翻幕/离场由这里统一收
  const rails = qsa(root, '.yb-rail-t');
  const boxEl = root.querySelector<HTMLElement>('.bz-yb-box'); // 层框：指针归一化认它的逻辑系

  let pal: Palette = palette(root);
  let cur = -1;
  let t0 = performance.now();
  let raf = 0;
  let fallback = 0;
  let dead = false;
  let navTarget = -1;
  let navUntil = 0;
  const settled = new Set<number>();
  const shutter = root.querySelector<HTMLElement>('[data-r="shutter"]');
  let cutTimers: ReturnType<typeof setTimeout>[] = [];
  // 指针（归一化到 -1..1；指针不在画面里时归零，各幕自己决定要不要缓动跟上）
  let px = 0, py = 0, pin = 0;

  const unit = (): number => Math.max(1, scEl.clientHeight);
  const indexAt = (): number => clamp(Math.round(scEl.scrollTop / unit()), 0, scenes.length - 1);

  function hud(i: number): void {
    if (rails.length) {
      rails.forEach((r, k) => {
        if (k === i) r.setAttribute('data-on', '1');
        else r.removeAttribute('data-on');
      });
    }
    // 幕号写在层根上（固定层在 box 直下、不在 film 子树里，选择器认层根）：
    // 开卷幕的粒子显隐跟着它走：翻幕显隐永远同一帧
    root.dataset.cur = String(i + 1).padStart(2, '0');
  }

  /** 激活第 i 幕：重置它的时间轴并从 0 演（replay=false 时直接给终态） */
  function activate(i: number, replay = true, force = false): void {
    if (dead || (i === cur && !force)) return;
    if (cur >= 0 && cur !== i) {
      const prev = perfs.get(scenes[cur].dataset.id ?? '');
      if (prev && !settled.has(cur)) { prev.update({ t: prev.dur, pal, px: px * pin, py: py * pin, pin }); settled.add(cur); }
      // 翻幕顺手收掉浮签：新一幕的悬停状态是干净的，不能继承上一幕的读数
      tip(root, '');
    }
    cur = i;
    settled.delete(i);
    const perf = perfs.get(scenes[i].dataset.id ?? '');
    if (replay) t0 = performance.now();
    if (perf) perf.update({ t: replay ? 0 : perf.dur, pal, px: px * pin, py: py * pin, pin });
    // 入场定格：遮片打开后本幕内容有一下极轻的落定（不然换幕像换了张静止图）
    const sc = scenes[i];
    sc.classList.remove('is-in');
    void sc.offsetWidth;
    sc.classList.add('is-in');
    hud(i);
  }

  const clearCut = (): void => { for (const id of cutTimers) clearTimeout(id); cutTimers = []; };
  /** 换幕到底：滚到目标幕 + 激活（遮片合上的那一帧才调它，位移过程看不见） */
  const cutTo = (target: number, replay: boolean): void => {
    navTarget = target;
    scEl.scrollTop = target * unit();
    activate(target, replay, true);
  };

  function goTo(i: number, opts?: { replay?: boolean; cut?: boolean }): void {
    const target = clamp(i, 0, scenes.length - 1);
    navTarget = target;
    navUntil = performance.now() + 900;
    // 同幕重放（「再放一遍」/ 点当前刻度）不走遮片：没有换幕就不该有过片
    if (target === cur || opts?.cut === false) {
      activate(target, opts?.replay ?? true, true);
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
      cutTimers.push(setTimeout(() => shutter.classList.remove('is-open'), MOTION.move + 60));
    }, MOTION.fast));
  }
  handle.goTo = goTo;
  const goRel = (d: number): void => goTo((cur < 0 ? 0 : cur + d), { cut: true });

  /** 滚动落点 → 当前幕（拖滚动条 / 触控滑动 / 键盘翻页都走这条）。
   *  程序化翻幕（smooth 滚动）期间只认目标幕，免得中途的过路幕被激活抢走表演。 */
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

  /** 心跳：优先 rAF；**rAF 被节流时用定时器兜底**。
   *  实测（2026-09-22 评审壳）：窗口被遮挡 / 标签被盖住时，iframe 的 rAF 一帧都不来，
   *  连 scroll 事件都跟着冻——时间驱动的表演会整幕僵在起始帧。观影志是「按秒演」的，
   *  所以补一条定时器心跳：rAF 220ms 没来就自己推进（绘制仍按真实时钟算 t，画面不会错位）。 */
  const rafFn = typeof requestAnimationFrame === 'function'
    ? (cb: () => void): number => requestAnimationFrame(cb)
    : (cb: () => void): number => setTimeout(cb, 16) as unknown as number;
  const rafStop = (id: number): void => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id);
  };

  function pump(): void {
    if (dead) return;
    clearTimeout(fallback);
    tick(performance.now());
    raf = rafFn(() => { clearTimeout(fallback); pump(); });
    fallback = setTimeout(() => { rafStop(raf); pump(); }, 220) as unknown as number;
  }

  function tick(now: number): void {
    if (dead || cur < 0) return;
    const perf: Perf | undefined = perfs.get(scenes[cur].dataset.id ?? '');
    if (!perf) return;
    const t = (now - t0) / 1000;
    perf.update({ t, pal, px: px * pin, py: py * pin, pin });
    hud(cur);
  }

  const onOvlClick = (e: Event): void => {
    const t = e.target as HTMLElement;
    const rail = t.closest<HTMLElement>('.yb-rail-t');
    if (rail) { goTo(Number(rail.dataset.i ?? 0), { cut: true }); }
  };

  /** 指针 → **层框逻辑**坐标的归一化（−1..1；旋转态 is-rot90 换轴反向）。
   *  各幕拿 px/py 直接映回画布像素（w/2 + px·w/2），画布位图是逻辑系——
   *  按视觉 rect 归一化会在旋转态把整套指针交互转错 90°；桌面层框≠窗口时也只认层框才不偏。
   *  move/down 里的 cx/cy 仍是视口值：浮签等 fixed 定位的 DOM 消费方要的就是它。 */
  const normPtr = (e: PointerEvent): { px: number; py: number } => {
    const r = (boxEl ?? root).getBoundingClientRect();
    const nx = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    const ny = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
    return boxEl?.classList.contains('is-rot90') ? { px: ny, py: -nx } : { px: nx, py: ny };
  };
  const onPointer = (e: PointerEvent): void => {
    const n = normPtr(e);
    px = n.px; py = n.py; pin = 1;
    // 指针事件只发给**当前这一幕**：不是每帧都来，各幕在这里只记状态（悬停到谁），
    // 把它变成画面的事交给 update——在事件里写样式会在快速划动时写出抖动。
    curPerf()?.move?.({ cx: e.clientX, cy: e.clientY, px, py });
  };
  const onPtrDown = (e: PointerEvent): void => {
    const n = normPtr(e);
    curPerf()?.down?.({ cx: e.clientX, cy: e.clientY, px: n.px, py: n.py });
  };
  const onPtrUp = (): void => { curPerf()?.up?.(); };
  /** 指针离场：位置归零 + 收掉浮签（不然浮签会挂在上一幕或上一处悬停上） */
  const onPtrLeave = (): void => { pin = 0; tip(root, ''); };

  const curPerf = (): Perf | undefined => (cur >= 0 ? perfs.get(scenes[cur].dataset.id ?? '') : undefined);

  // 主题切换（Obsidian 明暗）→ 画布取色跟着换
  const mo = new MutationObserver(() => { pal = palette(root); });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // 滚动口尺寸变化 → 重锚当前幕（覆盖层形态下层框跟面板走，窗 resize / 旋屏都会改幕高；
  // 幕高由滚动口解析，不重锚的话 scrollTop 停在旧倍数上，幕号与画面错位——ADR-0175）
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (dead || cur < 0) return;
    const want = cur * unit();
    if (Math.abs(scEl.scrollTop - want) > 1) scEl.scrollTop = want;
  }) : null;
  ro?.observe(scEl);

  root.addEventListener('pointermove', onPointer);
  root.addEventListener('pointerdown', onPtrDown);
  root.addEventListener('pointerup', onPtrUp);
  root.addEventListener('pointerleave', onPtrLeave);
  // 指针在画面外被系统收走（切窗口 / 触控取消）时也要松手：否则天平会一直压在那一侧
  root.addEventListener('pointercancel', onPtrUp);
  scEl.addEventListener('wheel', onWheel, { passive: false });
  scEl.addEventListener('scroll', syncFromScroll, { passive: true });
  // 触屏没有 wheel（真机上滑翻不动页）：手势区整体接管，一滑一幕（core/gesture 单源）
  const unSwipe = bindSwipeTurn(scEl, (d) => goRel(d));
  root.addEventListener('click', onOvlClick); // 自动钮/导航点都在固定层（film 外），监听得挂层根
  document.addEventListener('keydown', onKey);

  activate(0, true);
  pump();

  handle.stop = (): void => {
    dead = true;
    rafStop(raf);
    clearTimeout(fallback);
    mo.disconnect();
    ro?.disconnect();
    clearCut();
    root.removeEventListener('pointermove', onPointer);
    root.removeEventListener('pointerdown', onPtrDown);
    root.removeEventListener('pointerup', onPtrUp);
    root.removeEventListener('pointerleave', onPtrLeave);
    root.removeEventListener('pointercancel', onPtrUp);
    tip(root, '');
    scEl.removeEventListener('wheel', onWheel);
    scEl.removeEventListener('scroll', syncFromScroll);
    unSwipe();
    root.removeEventListener('click', onOvlClick);
    document.removeEventListener('keydown', onKey);
  };
  return handle;
}
