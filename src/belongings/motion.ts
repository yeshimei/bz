/**
 * 归物本动效层（2026-09-22 全量动效批，对齐影院 issue 400 台账与首页快速原型批打法）。
 *
 * 语义词汇表——归物本的动效语汇 = 纸面大字报的「出入库台账」，每个动作都是一次台账操作：
 *   盖章   入库（记一笔保存 / 撤销恢复 / 新入列）：物件卡落位 + 赤橙印圈一压
 *   勾销   出库（删除）：一道赤橙划线勾掉该件，货架自行补位（FLIP）
 *   换牌   状态流转（转卖 / 丢弃 / 回场）：纸面一闪 + 状态徽章重盖
 *   重排   筛选 / 排序 / 搜索：在册物件滑到新坑位（FLIP），新入列的逐件上架
 *   开册   面板首开：海报上墙 + 特大标题盖章 + KPI 铅字滚数 + 物件逐件上架
 *   抽卡   详情弹窗：档案卡从货架抽出，字段逐行显影，流转条接力落位
 *   填单   记一笔表单：入库单铺开，字段接力落纸
 *   纸签   年份 / 排序自绘下拉：纸签从触发器下方弹出
 *   报表   年度报告：分片段落各自显影（搭分片渲染的便车），柱条从零线生长、占比条从左展开
 *
 * 原则：
 *  - **只动表现，不动布局**——注入件（印圈 / 勾销线 / 冲洗层）全部 absolute + 不吃事件 +
 *    aria-hidden，演出完自摘；只动 transform/opacity/filter/clip-path，几何从不改写，
 *    终态 UI 与无动效版逐像素一致。
 *  - 台账对齐 cinema/motion.ts（issue 400 口径）：fast 160 / move 200 / base 280 /
 *    impulse 740，接力 30ms；揭示用 out 曲线，位移与冲量用 move 曲线。个别面板级揭示
 *    在 base 上加长（与首页 480ms 面板入场同先例），注释逐处标明。
 *  - reduced-motion（评审期口径，同首页）：默认**无视**系统「减少动态效果」放完整演出
 *    （用户系统即报 reduce，放缓等于替他改决定）；?rm=1 显式直达终态。
 *  - 与渲染纯层解耦：render.ts / layouts/poster markup 一字不改；本层只在 ui.ts /
 *    report.ts 生命周期挂点被调用。**非首次渲染静默**：外部 modify 自动刷新与主题切换
 *    走 'silent'，不重播任何编排。
 *  - 弹窗卡（.bz-bel-detail/.bz-bel-form）由 core uiModal 用 `transform: translate(-50%,-50%)`
 *    居中——对它们只动 **individual transform 属性**（translate/scale），与居中 transform
 *    正交合成；主面板是 flex 居中，transform 可直接动。
 */

/* ================= 台账与口径（与 cinema/motion.ts 同源值） ================= */

const M = { fast: 160, move: 200, base: 280, impulse: 740 } as const;
const STAG = 30;
const E = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
} as const;

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，见文件头）。 */
function reduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}

/** 安全 WAAPI：?rm=1 / 宿主不支持时直达终态（落最后一帧内联），演出路径异常也落终态 */
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

/** rAF 补间（滚数专用；无 rAF / RM 宿主直接不动——文本本就是终态，零感知） */
function tween(dur: number, step: (v: number) => void, ease: (t: number) => number = (t) => 1 - Math.pow(1 - t, 3)): void {
  if (typeof requestAnimationFrame !== 'function' || reduced()) return;
  const t0 = performance.now();
  const tick = (now: number): void => {
    const p = Math.min(1, (now - t0) / dur);
    step(ease(p));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** 延时调度（渲染级取消：新渲染覆盖旧编排，防快速连点时编排叠加） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/** 面板关闭清场：作废全部在途延时编排（deco 元素随面板 DOM 一并消亡）+ 丢弃 FLIP 台账 */
export function motionTeardown(): void {
  cancelPending();
  flipBook = null;
}

/* ================= 几何与注入小件 ================= */

/** 可演出判定：有几何且在视口附近（jsdom / 隐藏元素 / 视口外一律不演，终态直出） */
function stageable(el: HTMLElement | null | undefined): el is HTMLElement {
  if (!el) return false;
  try {
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return false;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 900;
    return r.top < vh + 120 && r.bottom > -120;
  } catch { return false; }
}

/** 装饰注入件：absolute + 不吃事件 + aria-hidden；宿主须自带 position:relative（cell 已有） */
function deco(host: HTMLElement, cls: string, css: Partial<CSSStyleDeclaration>): HTMLElement {
  const d = document.createElement('i');
  d.className = cls;
  d.setAttribute('aria-hidden', 'true');
  d.style.position = 'absolute';
  d.style.pointerEvents = 'none';
  Object.assign(d.style, css);
  host.appendChild(d);
  return d;
}

/* ================= 面板壳：开册 / 合册 ================= */

/** 面板入场 = 海报上墙：整卡上浮落定（面板级揭示，base 加长档，与首页面板入场同先例） */
export function motionPanelIn(overlay: HTMLElement): void {
  const panel = overlay.querySelector<HTMLElement>('.bz-bel-panel');
  if (!panel) return;
  panel.style.opacity = ''; panel.style.transform = ''; // 清退场残留（fill 挂留 / RM 内联）
  waapi(panel,
    [{ opacity: 0, transform: 'translateY(16px) scale(.982) rotate(.3deg)', filter: 'blur(6px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + 140, easing: E.out });
}

/** 面板关闭 = 合册：先演退场再交还移除（done 由调用方收口）。
 *  兜底定时器走裸 setTimeout（不入 after 集）——closePanel 里的 motionTeardown 会清集，
 *  不能把在途退场的收口一起清掉（清了面板就赖在屏上）。无 WAAPI 宿主同步收口。 */
export function motionPanelOut(overlay: HTMLElement, done: () => void): void {
  const panel = overlay.querySelector<HTMLElement>('.bz-bel-panel');
  if (!panel) { done(); return; }
  let finished = false;
  const finish = (): void => { if (!finished) { finished = true; done(); } };
  const a = waapi(panel,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(-12px) scale(.985)', filter: 'blur(4px)' }],
    { duration: M.move + 40, easing: E.out, fill: 'forwards' });
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  setTimeout(finish, M.move + 400); // 兜底：动画事件丢失也必须收口
}

/* ================= 渲染编排：首屏 / 重排 / 静默 ================= */

export type BelRenderMotion = 'boot' | 'flip' | 'silent';

/** FLIP 台账：重渲前的旧坑位（data-bel-id → 矩形）+ 旧标题（换筛选时标题重盖章用） */
let flipBook: { rects: Map<string, DOMRect>; title: string } | null = null;

/** 重渲前量测（renderAll 内、innerHTML 替换前调）——先量后变再演的「量」半步 */
export function motionBeforePaint(panel: HTMLElement): void {
  flipBook = null;
  try {
    const grid = panel.querySelector<HTMLElement>('[data-bel-content]');
    if (!grid) return;
    const rects = new Map<string, DOMRect>();
    grid.querySelectorAll<HTMLElement>('[data-bel-id]').forEach((c) => {
      const id = c.dataset.belId;
      if (id) rects.set(id, c.getBoundingClientRect());
    });
    flipBook = { rects, title: panel.querySelector<HTMLElement>('[data-bel-herotitle]')?.textContent ?? '' };
  } catch { /* 无几何环境：台账留空，重排零感知 */ }
}

/** 渲染后接管：boot = 开册编排；flip = 货架重排（FLIP）+ 换章反馈；silent = 什么都不做 */
export function motionRendered(panel: HTMLElement, mode: BelRenderMotion): void {
  cancelPending(); // 新渲染覆盖旧编排
  const book = flipBook;
  flipBook = null;
  if (mode === 'silent' || reduced()) return;
  if (mode === 'boot') { bootReveal(panel); return; }
  if (book) flipRepaint(panel, book);
}

/* ---- 开册（首屏编排）---- */

/** 铅字滚数：数字从 0 滚到终值，**首帧即归零起跳**（避免「终值→0」闪变）。
 *  格式保真——前缀/后缀/千分位/小数位按终串原样复刻，末帧直接写回原串（终态逐字符一致）。
 *  非纯数字串（如「4 件 · ￥1,200」）与无 rAF / RM 宿主不滚：终态直出，零感知。 */
function rollText(el: HTMLElement, dur: number): void {
  const finalText = el.textContent ?? '';
  const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(\D*)$/.exec(finalText);
  if (!m) return; // 后缀带数字的复合串：静态直出
  const prefix = m[1], target = parseFloat(m[2].replace(/,/g, '')), suffix = m[3];
  if (!Number.isFinite(target)) return;
  const decimals = (m[2].split('.')[1] || '').length;
  const fmt = (v: number): string =>
    (target * v).toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (reduced() || typeof requestAnimationFrame !== 'function') return; // 不滚：终态原样
  el.textContent = prefix + fmt(0) + suffix; // 首帧归零（能滚才归零，不存在回不去的路径）
  tween(dur, (v) => { el.textContent = v >= 1 ? finalText : prefix + fmt(v) + suffix; });
}

function bootReveal(panel: HTMLElement): void {
  /* —— 特大标题盖章：从高处一压落定（冲量语义，时长取 base 加长档收束）—— */
  const title = panel.querySelector<HTMLElement>('[data-bel-herotitle]');
  if (stageable(title)) {
    waapi(title,
      [{ opacity: 0, transform: 'scale(1.9) rotate(-4deg)', filter: 'blur(10px)' },
       { opacity: 1, transform: 'scale(.965) rotate(.5deg)', filter: 'blur(0px)', offset: .68 },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base + 120, easing: E.move, fill: 'backwards' });
  }
  /* —— 字距标语：从左向右揭出（印刷头版语义；clip 只揭示不位移）—— */
  const sub = panel.querySelector<HTMLElement>('[data-bel-herosub]');
  if (stageable(sub)) {
    waapi(sub,
      [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' },
       { opacity: 1, clipPath: 'inset(0 -2% 0 0)' }],
      { duration: M.base, delay: M.fast, easing: E.out, fill: 'backwards' });
  }
  /* —— 移动印章头：小章同款一压 —— */
  const stamp = panel.querySelector<HTMLElement>('.bz-bel-stamp');
  if (stageable(stamp)) {
    waapi(stamp,
      [{ opacity: 0, transform: 'scale(1.7) rotate(-6deg)' },
       { opacity: 1, transform: 'scale(.96) rotate(1deg)', offset: .66 },
       { opacity: 1, transform: 'none' }],
      { duration: M.base + 80, easing: E.move, fill: 'backwards' });
  }
  /* —— KPI 行：铅字落版接力 + 纯数字滚数（在库件数 / 在库投入 / 日均成本）—— */
  panel.querySelectorAll<HTMLElement>('[data-bel-kpis] .bz-bel-kpi').forEach((kpi, i) => {
    if (!stageable(kpi)) return;
    waapi(kpi,
      [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(3px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, delay: 140 + i * STAG, easing: E.out, fill: 'backwards' });
    const num = kpi.querySelector<HTMLElement>('b');
    if (num && stageable(num)) rollText(num, M.impulse);
  });
  const stampN = panel.querySelector<HTMLElement>('[data-bel-stampn]');
  if (stageable(stampN)) rollText(stampN, M.impulse);
  /* —— chips / 工具行：工具上桌 —— */
  panel.querySelectorAll<HTMLElement>('[data-bel-chips] .bz-chip').forEach((chip, i) => {
    if (!stageable(chip)) return;
    waapi(chip,
      [{ opacity: 0, transform: 'translateY(7px)' },
       { opacity: 1, transform: 'none' }],
      { duration: M.fast + 40, delay: 220 + i * STAG, easing: E.out, fill: 'backwards' });
  });
  const toolrow = panel.querySelector<HTMLElement>('.bz-bel-toolrow');
  if (stageable(toolrow)) {
    waapi(toolrow,
      [{ opacity: 0, transform: 'translateY(8px)' },
       { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 260, easing: E.out, fill: 'backwards' });
  }
  /* —— 网格：物件逐件上架（前 15 件 30ms 接力，其余同波跟上；视口外直出终态）—— */
  const cells = panel.querySelectorAll<HTMLElement>('[data-bel-content] [data-bel-id]');
  cells.forEach((cell, i) => {
    if (!stageable(cell)) return;
    after(300 + Math.min(i, 14) * STAG, () => {
      waapi(cell,
        [{ opacity: 0, transform: 'translateY(14px) scale(.97) rotate(.35deg)', filter: 'blur(4px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base, easing: E.out, fill: 'backwards' });
    });
  });
  /* —— 空态：整块上浮 —— */
  const empty = panel.querySelector<HTMLElement>('[data-bel-content] .bz-empty');
  if (stageable(empty)) {
    waapi(empty,
      [{ opacity: 0, transform: 'translateY(10px)' },
       { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 240, easing: E.out, fill: 'backwards' });
  }
}

/* ---- 货架重排（筛选 / 排序 / 搜索的 FLIP）---- */

function flipRepaint(panel: HTMLElement, book: { rects: Map<string, DOMRect>; title: string }): void {
  /* 换章反馈：筛选切换 = 大字标题换了内容 → 快速重盖一次（move 曲线，冲量小样） */
  const title = panel.querySelector<HTMLElement>('[data-bel-herotitle]');
  if (stageable(title) && (title.textContent ?? '') !== book.title && book.title !== '') {
    waapi(title,
      [{ opacity: .15, transform: 'scale(1.14)', filter: 'blur(2px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.move, easing: E.move, fill: 'backwards' });
  }
  /* FLIP：在册物件从旧坑位滑到新坑位；新入列的逐件上架 */
  const cells = [...panel.querySelectorAll<HTMLElement>('[data-bel-content] [data-bel-id]')];
  let fresh = 0;
  for (const cell of cells) {
    const id = cell.dataset.belId ?? '';
    const old = book.rects.get(id);
    if (!old) {
      // 新入列（筛选放行 / 记一笔 / 撤销恢复）：逐件上架，最多 8 件接力
      if (stageable(cell)) {
        waapi(cell,
          [{ opacity: 0, transform: 'translateY(12px) scale(.98)' },
           { opacity: 1, transform: 'none' }],
          { duration: M.base, delay: Math.min(fresh, 8) * STAG, easing: E.out, fill: 'backwards' });
      }
      fresh++;
      continue;
    }
    if (!stageable(cell)) continue;
    const now = cell.getBoundingClientRect();
    const dx = old.left - now.left, dy = old.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    waapi(cell,
      [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` },
       { transform: 'none' }],
      { duration: M.move, easing: E.out });
  }
}

/* ================= 台账动作：盖章（入库）/ 勾销（出库）/ 换牌（流转） ================= */

/** 盖章 = 入库（记一笔保存后的新卡 / 撤销恢复）：印圈从高处一压，物件落位。
 *  卡片上浮由 FLIP 的「新入列」分支负责，这里只添印圈与一次墨色透亮。 */
export function motionCellStamp(cell: HTMLElement): void {
  if (!stageable(cell) || typeof cell.animate !== 'function') return;
  const ring = deco(cell, 'bz-bel-mstamp', {
    inset: '6px', border: '2.5px solid var(--bz-bel-accent)', opacity: '0',
  });
  const a = waapi(ring,
    [{ opacity: 0, transform: 'scale(1.6) rotate(-5deg)' },
     { opacity: .95, transform: 'scale(1) rotate(-1deg)', offset: .55 },
     { opacity: 0, transform: 'scale(1) rotate(0deg)' }],
    { duration: M.base + 140, easing: E.move });
  if (a) a.finished.then(() => ring.remove()).catch(() => ring.remove());
  else after(M.base + 160, () => ring.remove());
  // 卡面内容短暂透亮一拍：墨刚落纸的反光
  const flash = deco(cell, 'bz-bel-mink', {
    inset: '0', background: 'var(--bz-bel-accent)', opacity: '0',
  });
  const f = waapi(flash,
    [{ opacity: 0 }, { opacity: .12, offset: .3 }, { opacity: 0 }],
    { duration: M.base, easing: E.out });
  if (f) f.finished.then(() => flash.remove()).catch(() => flash.remove());
  else after(M.base + 20, () => flash.remove());
}

/** 勾销 = 删除前在**旧 DOM**上演（真渲染随后接管）：赤橙划线横扫 + 卡面隐去。
 *  落盘很快时划线只闪一拍也成立——货架补位（FLIP）紧随其后，语义连贯。 */
export function motionCellStrike(cell: HTMLElement): void {
  if (!stageable(cell) || typeof cell.animate !== 'function') return;
  const box = deco(cell, 'bz-bel-mstrike', { inset: '4px', overflow: 'hidden' });
  const line = document.createElement('i');
  line.setAttribute('aria-hidden', 'true');
  line.style.cssText = 'position:absolute;left:0;right:0;top:50%;height:3px;margin-top:-1.5px;'
    + 'background:var(--bz-bel-accent);transform:scaleX(0);transform-origin:0 50%;';
  box.appendChild(line);
  waapi(line,
    [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
    { duration: M.fast + 60, easing: E.move, fill: 'forwards' });
  waapi(cell,
    [{ opacity: 1 }, { opacity: .12, transform: 'scale(.985)' }],
    { duration: M.fast + 80, delay: M.fast + 40, easing: 'linear', fill: 'forwards' });
  after(M.move + 200, () => box.remove()); // 兜底自摘（正常由重渲随 innerHTML 收走）
}

/** 换牌 = 状态流转后：纸面一闪（出库偏灰、回库偏橙）+ 状态徽章重盖。
 *  出离灰化（.bz-bel-cell--gone）由渲染即时生效，这里补的是「换牌被看见」的一拍。 */
export function motionCellFlow(cell: HTMLElement, toExited: boolean): void {
  if (!stageable(cell) || typeof cell.animate !== 'function') return;
  const wash = deco(cell, 'bz-bel-mwash', {
    inset: '0',
    background: toExited ? 'var(--bz-bel-line)' : 'var(--bz-bel-accent)',
    opacity: '0',
  });
  const a = waapi(wash,
    [{ opacity: 0 }, { opacity: toExited ? .55 : .2, offset: .35 }, { opacity: 0 }],
    { duration: M.base + 60, easing: E.out });
  if (a) a.finished.then(() => wash.remove()).catch(() => wash.remove());
  else after(M.base + 80, () => wash.remove());
  const tag = cell.querySelector<HTMLElement>('.bz-bel-tag');
  if (stageable(tag)) {
    waapi(tag,
      [{ opacity: 0, transform: 'scale(1.55) rotate(-6deg)' },
       { opacity: 1, transform: 'scale(.97) rotate(1deg)', offset: .62 },
       { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.move, fill: 'backwards' });
  }
}

/* ================= 自绘下拉：纸签弹出 ================= */

/** 年份 / 移动排序下拉开：纸签从触发器下方弹出，选项快速接力显影 */
export function motionDropOpen(wrap: HTMLElement): void {
  if (reduced()) return;
  const menu = wrap.querySelector<HTMLElement>('.bz-bel-dropmenu');
  if (!stageable(menu)) return;
  menu.style.transformOrigin = '50% 0';
  waapi(menu,
    [{ opacity: 0, transform: 'translateY(-5px) scaleY(.92)' },
     { opacity: 1, transform: 'none' }],
    { duration: M.fast, easing: E.out, fill: 'backwards' });
  menu.querySelectorAll<HTMLElement>('.bz-bel-dropopt').forEach((opt, i) => {
    if (i >= 6 || !stageable(opt)) return;
    waapi(opt,
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: M.fast, delay: M.fast + i * STAG, easing: E.out, fill: 'backwards' });
  });
}

/* ================= 弹窗：抽卡（详情）/ 填单（表单） =================
 * core uiModal 的 popup 用 transform 居中 → 只动 individual translate/scale，与居中正交。 */

/** 弹窗卡入场（共享）：档案卡从货架抽出 */
function popupIn(popup: HTMLElement | null): void {
  if (!stageable(popup)) return;
  waapi(popup,
    [{ opacity: 0, translate: '0 18px', scale: '.98' },
     { opacity: 1, translate: '0 0px', scale: '1' }],
    { duration: M.base, easing: E.out, fill: 'backwards' });
}

/** 一组元素接力显影（字段 / 流转条 / 按钮行），对 DOM 顺序即视觉顺序 */
function relay(els: HTMLElement[], base: number, step = STAG): void {
  els.forEach((el, i) => {
    if (!stageable(el)) return;
    waapi(el,
      [{ opacity: 0, transform: 'translateY(7px)' },
       { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: base + i * step, easing: E.out, fill: 'backwards' });
  });
}

/** 详情 = 抽档案卡：卡抽出，识别行 / 字段逐行显影，流转条四档接力，底部按钮收尾 */
export function motionDetailIn(mask: HTMLElement): void {
  if (reduced()) return;
  popupIn(mask.querySelector<HTMLElement>('.bz-bel-detail'));
  const detail = mask.querySelector<HTMLElement>('.bz-bel-detail');
  if (!detail) return;
  const seq = [
    ...(detail.querySelector('.bz-bel-detail-head') ? [detail.querySelector('.bz-bel-detail-head') as HTMLElement] : []),
    ...(detail.querySelector('.bz-bel-detail-idrow') ? [detail.querySelector('.bz-bel-detail-idrow') as HTMLElement] : []),
    ...[...detail.querySelectorAll<HTMLElement>('.bz-bel-dfield')],
    ...(detail.querySelector('.bz-bel-detail-acts') ? [detail.querySelector('.bz-bel-detail-acts') as HTMLElement] : []),
    ...(detail.querySelector('.bz-bel-detail-btns') ? [detail.querySelector('.bz-bel-detail-btns') as HTMLElement] : []),
  ];
  relay(seq, 60);
  // 流转条四档：容器显影后档位再各领一拍（换牌在这里发生，档位要「各就各位」）
  detail.querySelectorAll<HTMLElement>('.bz-bel-flowbtn').forEach((btn, i) => {
    if (!stageable(btn)) return;
    waapi(btn,
      [{ opacity: 0, transform: 'translateY(5px)' },
       { opacity: 1, transform: 'none' }],
      { duration: M.fast + 40, delay: 60 + (seq.length - 1) * STAG + 60 + i * STAG, easing: E.out, fill: 'backwards' });
  });
}

/** 表单 = 填入库单：单据铺开，标题与字段接力落纸 */
export function motionFormIn(mask: HTMLElement): void {
  if (reduced()) return;
  popupIn(mask.querySelector<HTMLElement>('.bz-bel-form'));
  const form = mask.querySelector<HTMLElement>('.bz-bel-form');
  if (!form) return;
  const seq: HTMLElement[] = [];
  const title = form.querySelector<HTMLElement>('.bz-bel-form-title');
  if (title) seq.push(title);
  seq.push(...[...form.querySelectorAll<HTMLElement>('.bz-bel-form-body > .bz-field')]);
  const actions = form.querySelector<HTMLElement>('.bz-bel-form-actions');
  if (actions) seq.push(actions);
  relay(seq, 40);
}

/* ================= 年度报告：报表铺开 ================= */

/** 报告段落显影（搭分片渲染便车：每段插入即显影，段内柱条 / 占比条随后生长）。
 *  在 report.ts 分片循环的插入点逐段调用——cascade 由分片节奏天然给出。
 *  柱/条先内联压零再起演（防「终值→0→生长」闪变）；无 WAAPI 宿主不压零，终态直出。 */
export function motionReportSection(sec: HTMLElement | null): void {
  if (!sec || reduced()) return;
  waapi(sec,
    [{ opacity: 0, transform: 'translateY(12px)' },
     { opacity: 1, transform: 'none' }],
    { duration: M.base, easing: E.out, fill: 'backwards' });
  // 柱条从零线生长（柱列图）：transform-origin 压底，几何不改写
  sec.querySelectorAll<HTMLElement>('.bz-belr-col-bar').forEach((bar, i) => {
    if (!stageable(bar) || typeof bar.animate !== 'function') return;
    bar.style.transformOrigin = '50% 100%';
    bar.style.transform = 'scaleY(0)';
    after(M.base, () => {
      const a = waapi(bar,
        [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
        { duration: M.base, delay: Math.min(i, 12) * STAG, easing: E.out, fill: 'forwards' });
      const clear = (): void => { bar.style.transform = ''; };
      if (a) a.finished.then(clear).catch(clear);
      else clear();
    });
  });
  // 占比条从左展开
  sec.querySelectorAll<HTMLElement>('.bz-belr-row-track i').forEach((bar, i) => {
    if (!stageable(bar) || typeof bar.animate !== 'function') return;
    bar.style.transformOrigin = '0 50%';
    bar.style.transform = 'scaleX(0)';
    after(M.base, () => {
      const a = waapi(bar,
        [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: M.base, delay: Math.min(i, 8) * STAG, easing: E.out, fill: 'forwards' });
      const clear = (): void => { bar.style.transform = ''; };
      if (a) a.finished.then(clear).catch(clear);
      else clear();
    });
  });
  // 概览卡 / 陪伴榜行：轻接力
  relay([...sec.querySelectorAll<HTMLElement>('.bz-belr-hero, .bz-belr-comp')], M.fast, 40);
}
