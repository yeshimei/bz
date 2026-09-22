/**
 * 知识盒（knowledge 域）动效层（2026-09-22 全量动效批）。
 * 用户命题：与影院 / 备忘录 / 首页同量级同打法，但**按知识盒自己的语义出招**，
 * 覆盖每一个舞台与交互点；只动表现，几何 / DOM 结构 / 文案一字不动。
 *
 * 语义词汇表（全部取自「卡片盒 / 词典」本体，不借其他域的招）：
 *  - **抽卡**：词典行入场 = 从卡片盒抽出一张索引卡——clip-path 自左向右揭开 + 微转回正；
 *  - **盖章**：被引 / 孤儿徽标落位 = 图章拍下（scale 1.7→1 + 微转，move 曲线冲压）；
 *  - **翻部**：部壹 / 贰 / 叁切换 = 词典翻部签——旧内容不拖泥，新内容按 cue 接力揭开；
 *  - **落纸 / 收纸**：主窗与弹层开关 = 纸面落下（blur 揭出）与折回收起；
 *  - **墨印揭字**：题字「知 识 盒」「影 像」= clip 自左向右墨印揭出；头部双细线自中心向两侧描出；
 *  - **显影**：影像任务卡入场 = 相纸在药水里显影（sepia + blur → 清晰）；
 *  - **展开释义**：影像解析完成 = 词典条目展开释义（clip 自上而下揭示 + 行接力）；
 *  - **落墨**：属性行 AI 值到达 = 墨字落纸（blur 收清）；首个正文字符到达同款；
 *  - **笔还在写**：流式生成期间内容卡角一枚呼吸墨滴（循环指示，句柄池管理，写完即收，禁永动孤儿）；
 *  - **签片弹出**：关联候选 / 来源 chip = 索引签逐张插进卡槽（scale .72→1 接力）；
 *  - **摇铃**：名词重名提醒 = 一次性横摇（警示，不循环）；
 *  - **上墙 / 连线生长**：挂载树卡片按深度钉上白板；墨线自主卡向外逐条生长（实线边描线，建议虚线边随层浮现）。
 *
 * 台账对齐 cinema/motion.ts（issue 400 口径）：fast 160 / move 200 / base 280 / impulse 740，
 * 接力 30ms；揭示用 out 曲线，位移与冲压用 move 曲线。
 * reduced-motion（评审期口径）：默认**无视**系统设置放完整演出；?rm=1 显式模拟 RM 直达终态。
 * jsdom / 无 WAAPI 宿主：内容已由渲染层落终态，动画层直通返回（域内测试零感知）。
 *
 * 与渲染解耦：ui.ts / mount-canvas.ts 的 markup 一字不改，本层只在生命周期挂点被调用。
 * boot 消费标志由 ui 持有（motionCue: 'boot'|'part'|'silent'）：showMain 置 'boot'，点部签置 'part'，
 * 首个渲染消费即熄复位 'silent'——后台文件变更刷新（300ms 防抖）静默不重播。
 */

/* ================= 台账与口径 ================= */

const M = { fast: 160, move: 200, base: 280, impulse: 740 } as const;
const E = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
} as const;
const STAG = 30;

/** 内容编排的类型：boot = 首次开面板（等壳落定后起编排）/ part = 翻部与主动切换（立即接力）/ silent = 后台刷新（不播） */
export type MotionCue = 'boot' | 'part' | 'silent';

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，见文件头）。 */
function reduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}

/** 安全 WAAPI：?rm=1 直通；无 WAAPI（jsdom / 老内核）直通——内容已由渲染层落终态，无需补笔 */
function waapi(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || reduced() || typeof (el as HTMLElement).animate !== 'function') return null;
  try { return el.animate(frames, opts); } catch { return null; }
}

/** rAF 补间（备用手势：WAAPI 覆盖不了的逐帧语义才用它） */
function tween(dur: number, step: (v: number) => void, ease: (t: number) => number = (t) => 1 - Math.pow(1 - t, 3)): void {
  if (typeof requestAnimationFrame !== 'function') { step(1); return; }
  const t0 = performance.now();
  const tick = (now: number): void => {
    const p = Math.min(1, (now - t0) / dur);
    step(ease(p));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** 延时调度（模块级取消，防快速开关时编排叠加） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/* ================= 退场簿记：closing 标志 + 在途退场作废 =================
   面板壳（主窗 / 影像 / 录入 / 挂载树）关闭后不销毁，只切 display——
   退场动画绝不能把 fill:forwards 的 opacity:0 钉在常驻节点上（首页线上事故）。
   做法：退场起跑即打 closing 标志（重复关闭早退），收口时 cancel 动画再交还 display；
   退场中途被重开 = in 侧调 abortOut 作废在途退场（done 不再收 display）。 */

const outRuns = new Map<HTMLElement, { abort(): void }>();

/** 该元素是否正处退场中（调用方据此忽略重复关闭，防 ESC 连按二次弹确认框） */
export function motionClosing(el: HTMLElement | null): boolean {
  return !!el && el.dataset.bzMotionClosing === '1';
}

function abortOut(el: HTMLElement): void {
  const run = outRuns.get(el);
  if (!run) return;
  outRuns.delete(el);
  run.abort();
}

/** 撤该元素上本域动效残留（按动画 id；不误伤面板自身 CSS 动画） */
function sweepExit(el: HTMLElement, id: string): void {
  try {
    if (typeof el.getAnimations !== 'function') return;
    for (const a of el.getAnimations()) if (a.id === id) a.cancel();
  } catch { /* 测试宿主无 getAnimations */ }
}

/** 通用退场编排：fill:forwards 钉住终帧 → 收口 cancel 后才交还 display（done 由调用方收口） */
function runOut(
  el: HTMLElement | null,
  id: string,
  frames: Keyframe[],
  opts: KeyframeAnimationOptions,
  done: () => void,
): void {
  if (!el) { done(); return; }
  if (motionClosing(el)) return; // 退场中：忽略重复关闭
  el.dataset.bzMotionClosing = '1';
  let finished = false;
  let anim: Animation | null = null;
  const run = {
    abort: (): void => {
      run.aborted = true;
      delete el.dataset.bzMotionClosing; // 重开侧（motionXxxIn）要清标志继续用面板
      try { anim?.cancel(); } catch { /* 已收口 */ }
    },
    aborted: false,
  };
  outRuns.set(el, run);
  const finish = (): void => {
    if (finished || run.aborted) return;
    finished = true;
    outRuns.delete(el);
    delete el.dataset.bzMotionClosing;
    try { anim?.cancel(); } catch { /* 已收口 */ } // forwards 钉住的 opacity:0 不得活到下一次打开
    done();
  };
  anim = waapi(el, frames, { ...opts, fill: 'forwards', id });
  if (!anim) { finish(); return; } // 无 WAAPI / RM：同步收口，绝不让 display:none 晚到
  anim.finished.then(finish).catch(() => { /* abort 触发的取消：收口由 abort / 新开负责 */ });
  after(Number(opts.duration ?? 240) + 200, finish); // 兜底：动画事件丢失也不能卡住关闭
}

/* ================= 主窗：落纸 / 收纸 + 墨印揭字 + 双细线描线 ================= */

const MAIN_EXIT = 'bz-kb-main-exit';

/** 主窗打开 = 卡片盒抽屉拉开：壳落纸 + 题字墨印揭出 + 头部双细线自中心描出 + 部签依次入位 */
export function motionMainIn(popup: HTMLElement | null): void {
  cancelPending();
  if (!popup || reduced()) return;
  abortOut(popup); // 退场中途被重开：作废在途退场（done 不再收 display）
  sweepExit(popup, MAIN_EXIT);
  popup.style.opacity = ''; popup.style.transform = ''; popup.style.filter = '';
  const reopen = popup.dataset.kbMotionOpened === '1';
  popup.dataset.kbMotionOpened = '1';
  waapi(popup,
    [{ opacity: 0, transform: 'translateY(12px) scale(.975)', filter: 'blur(7px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: reopen ? 300 : 460, easing: E.out });
  // 题字「知 识 盒」：墨印自左向右揭出（clip 只裁表现层，几何不动）
  const title = popup.querySelector<HTMLElement>('.bz-kb-title');
  if (title) {
    waapi(title,
      [{ opacity: .2, clipPath: 'inset(0 100% 0 0)', filter: 'blur(2px)' },
       { opacity: 1, clipPath: 'inset(0 0 0 0)', filter: 'blur(0px)' }],
      { duration: M.base + 160, delay: 140, easing: E.out, fill: 'backwards' });
  }
  const top = popup.querySelector<HTMLElement>('.bz-kb-top');
  if (top) {
    waapi(top, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 60, easing: E.out, fill: 'backwards' });
  }
  // 头部双细线：注入一条同位双线，自中心向两侧描出，演完即撤（终态 = 原生 border）
  const head = popup.querySelector<HTMLElement>('.bz-kb-head');
  if (head) {
    const line = document.createElement('i');
    line.className = 'bz-kb-headline';
    line.setAttribute('aria-hidden', 'true');
    head.appendChild(line);
    const a = waapi(line,
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: M.base + 120, delay: 180, easing: E.out, fill: 'backwards' });
    if (a) a.finished.then(() => line.remove()).catch(() => line.remove());
    else line.remove();
  }
  // 部签三枚：依次入位（抽屉里的分类签）
  popup.querySelectorAll<HTMLElement>('.bz-kb-part').forEach((b, i) => {
    waapi(b, [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 200 + i * 45, easing: E.out, fill: 'backwards' });
  });
}

/** 主窗关闭 = 折回收纸：先演退场再交还 display:none（done 由调用方收口） */
export function motionMainOut(popup: HTMLElement | null, done: () => void): void {
  motionPenOff(); // 主窗收纸：挂在其注入件一并收
  runOut(popup, MAIN_EXIT,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(8px) scale(.985)', filter: 'blur(5px)' }],
    { duration: M.move + 40, easing: E.out }, done);
}

/* ================= 三部内容：抽卡接力（词典行 / 入口钮 / 芯片 / 空态） ================= */

const REVEAL_CAP = 14;

function cardFrames(to: string): Keyframe[] {
  return [
    { opacity: 0, transform: 'translateX(-7px) rotate(.2deg)', clipPath: 'inset(0 100% 0 0)', filter: 'blur(2px)' },
    { opacity: 1, transform: to, clipPath: 'inset(0 0 0 0)', filter: 'blur(0px)' },
  ];
}

/**
 * 部壹 / 部叁内容揭出：词典行抽卡接力（前 14 行，其余直达；boot 等壳落定，part 立即）。
 * 部壹多带录入入口四钮（进货口四张工具签）与空态；cue=silent 零动作。
 */
export function motionLitReveal(sc: HTMLElement | null, cue: MotionCue): void {
  if (!sc || cue === 'silent' || reduced()) return;
  const base = cue === 'boot' ? 340 : 40;
  const step = cue === 'boot' ? STAG : 22;
  sc.querySelectorAll<HTMLElement>('.bz-kb-lexrow').forEach((row, i) => {
    if (i >= REVEAL_CAP) return;
    waapi(row, cardFrames('none'),
      { duration: M.base + 80, delay: base + i * step, easing: E.out, fill: 'backwards' });
  });
  sc.querySelectorAll<HTMLElement>('.bz-kb-entrybtn').forEach((btn, i) => {
    waapi(btn,
      [{ opacity: 0, transform: 'translateY(9px)', clipPath: 'inset(0 0 100% 0)' },
       { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' }],
      { duration: M.base + 60, delay: (cue === 'boot' ? 230 : 20) + i * 45, easing: E.out, fill: 'backwards' });
  });
  const bar = sc.querySelector<HTMLElement>('.bz-kb-cbar');
  if (bar) {
    waapi(bar, [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: base - 60 > 0 ? base - 60 : 0, easing: E.out, fill: 'backwards' });
  }
  const empty = sc.querySelector<HTMLElement>('.bz-kb-empty');
  if (empty) {
    waapi(empty, [{ opacity: 0 }, { opacity: 1 }],
      { duration: M.base + 80, delay: base, easing: E.out, fill: 'backwards' });
  }
}

/**
 * 部贰卡片行揭出（增量感知）：`from` = 追加前已渲染行数。
 * 首屏（from=0）随 cue 编排（silent 全静默）；滚动加载的增量行（from>0）永远播——
 * 新批次本来是突然出现的，抽卡揭出是纯增益。
 */
export function motionCardsAppended(rowsEl: HTMLElement | null, from: number, cue: MotionCue): void {
  if (!rowsEl || reduced()) return;
  const total = rowsEl.children.length;
  if (from >= total) return;
  if (from === 0 && cue === 'silent') return; // 后台全量重建：整屏不闪
  const base = from > 0 ? 30 : cue === 'boot' ? 340 : 50;
  const step = from > 0 ? 18 : STAG;
  for (let i = from; i < total; i++) {
    const row = rowsEl.children[i] as HTMLElement | null;
    if (!row || i - from >= REVEAL_CAP) break;
    waapi(row, cardFrames('none'),
      { duration: M.base + 60, delay: base + (i - from) * step, easing: E.out, fill: 'backwards' });
  }
}

/** 盖章：徽标落位 = 图章拍下（move 曲线冲压 + 微转，一次性） */
export function motionStampBadge(badge: HTMLElement | null): void {
  if (!badge || reduced()) return;
  waapi(badge,
    [{ opacity: 0, transform: 'scale(1.7) rotate(-7deg)' },
     { opacity: 1, transform: 'scale(1) rotate(0deg)' }],
    { duration: M.fast + 70, easing: E.move, fill: 'backwards' });
}

/* ================= 预览弹层：摊开纸面 + 摘录逐段浮现 + 签片弹出 ================= */

/**
 * 预览弹层开：遮罩快淡入 + 纸面摊开揭出。
 * ovl 是自毁节点（closeSheet 即 remove）——退场随节点销毁，不受常驻节点 fill 纪律约束。
 */
export function motionSheetIn(ovl: HTMLElement | null): void {
  if (!ovl || reduced()) return;
  cancelPending();
  waapi(ovl, [{ opacity: 0 }, { opacity: 1 }], { duration: M.fast, easing: E.out, fill: 'backwards' });
  const sheet = ovl.querySelector<HTMLElement>('.bz-kb-sheet');
  if (sheet) {
    waapi(sheet,
      [{ opacity: 0, transform: 'translateY(12px) scale(.97)', filter: 'blur(6px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base + 60, easing: E.out, fill: 'backwards' });
    const head = sheet.querySelector<HTMLElement>('.bz-kb-sheet-head');
    if (head) {
      waapi(head, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: M.base, delay: 80, easing: E.out, fill: 'backwards' });
    }
  }
}

/** 预览弹层收 = 折回纸叠：先演 180ms 退场再 remove（done 由调用方收口；无 WAAPI 同步收口） */
export function motionSheetOut(ovl: HTMLElement | null, done: () => void): void {
  if (!ovl) { done(); return; }
  if (ovl.dataset.bzMotionClosing === '1') return;
  ovl.dataset.bzMotionClosing = '1';
  const sheet = ovl.querySelector<HTMLElement>('.bz-kb-sheet');
  const a = waapi(ovl, [{ opacity: 1 }, { opacity: 0 }], { duration: M.move - 20, easing: E.out, fill: 'forwards' });
  const b = sheet
    ? waapi(sheet,
      [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
       { opacity: 0, transform: 'translateY(8px) scale(.98)', filter: 'blur(4px)' }],
      { duration: M.move - 20, easing: E.out, fill: 'forwards' })
    : null;
  const finish = (): void => {
    ovl.dataset.bzMotionClosing = '';
    try { a?.cancel(); } catch { /* 已收口 */ }
    try { b?.cancel(); } catch { /* 已收口 */ }
    done();
  };
  if (!a && !b) { finish(); return; }
  let waited = 0;
  const hit = (): void => { waited++; if (waited >= 2) finish(); };
  if (a) a.finished.then(hit).catch(hit); else hit();
  if (b) b.finished.then(hit).catch(hit); else hit();
  after(M.move + 160, finish); // 兜底
}

/**
 * 摘录逐段浮现：预览正文（Markdown 渲染完）顶层元素接力揭出 + 关联签片 / 来源链接随后弹出。
 * 「摘录摘取」语义：一段段铺在纸面上，而不是整块砸下来。
 */
export function motionPreviewBody(ovl: HTMLElement | null): void {
  if (!ovl || reduced()) return;
  const body = ovl.querySelector<HTMLElement>('#bz-kb-preview-body');
  if (body) {
    [...body.children].forEach((el, i) => {
      if (i >= 12) return;
      waapi(el as HTMLElement,
        [{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(3px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base + 60, delay: 60 + i * STAG, easing: E.out, fill: 'backwards' });
    });
  }
  ovl.querySelectorAll<HTMLElement>('.bz-kb-cite').forEach((chip, i) => {
    waapi(chip, [{ opacity: 0, transform: 'scale(.75)' }, { opacity: 1, transform: 'none' }],
      { duration: M.fast + 60, delay: 300 + i * 35, easing: E.out, fill: 'backwards' });
  });
  const link = ovl.querySelector<HTMLElement>('.bz-kb-cliplink');
  if (link) {
    waapi(link, [{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 340, easing: E.out, fill: 'backwards' });
  }
}

/* ================= 影像 · 处理面板：升场 + 任务卡显影 ================= */

const VIDEO_EXIT = 'bz-kb-video-exit';

/** 处理面板开 = 小一号纸面落纸 + 题字「影 像」墨印揭出 */
export function motionVideoIn(popup: HTMLElement | null): void {
  if (!popup || reduced()) return;
  abortOut(popup);
  sweepExit(popup, VIDEO_EXIT);
  popup.style.opacity = ''; popup.style.transform = ''; popup.style.filter = '';
  waapi(popup,
    [{ opacity: 0, transform: 'translateY(10px) scale(.98)', filter: 'blur(6px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + 60, easing: E.out });
  const title = popup.querySelector<HTMLElement>('.bz-kb-title');
  if (title) {
    waapi(title,
      [{ opacity: .2, clipPath: 'inset(0 100% 0 0)', filter: 'blur(2px)' },
       { opacity: 1, clipPath: 'inset(0 0 0 0)', filter: 'blur(0px)' }],
      { duration: M.base + 100, delay: 90, easing: E.out, fill: 'backwards' });
  }
}

/** 处理面板关 = 折回收纸 */
export function motionVideoOut(popup: HTMLElement | null, done: () => void): void {
  runOut(popup, VIDEO_EXIT,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(8px) scale(.985)', filter: 'blur(4px)' }],
    { duration: M.move + 20, easing: E.out }, done);
}

/**
 * 任务卡显影接力（相纸在药水里显影：sepia + blur → 清晰；前 10 张，其余直达）。
 * 批量处理途中（silent）逐任务刷新不重播，防止列表反复闪显影。
 */
export function motionVideoRows(list: HTMLElement | null, cue: MotionCue): void {
  if (!list || cue === 'silent' || reduced()) return;
  list.querySelectorAll<HTMLElement>('.bz-kb-taskcard').forEach((card, i) => {
    if (i >= 10) return;
    waapi(card,
      [{ opacity: 0, filter: 'sepia(.85) contrast(.65) blur(3px)', transform: 'translateY(6px)' },
       { opacity: 1, filter: 'sepia(0) contrast(1) blur(0px)', transform: 'none' }],
      { duration: M.base + 140, delay: 30 + i * STAG, easing: E.out, fill: 'backwards' });
  });
  const banner = list.querySelector<HTMLElement>('.bz-kb-banner');
  if (banner) {
    waapi(banner, [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 10, easing: E.out, fill: 'backwards' });
  }
  const empty = list.querySelector<HTMLElement>('.bz-kb-empty');
  if (empty) {
    waapi(empty, [{ opacity: 0 }, { opacity: 1 }], { duration: M.base + 60, easing: E.out, fill: 'backwards' });
  }
}

/* ================= 影像 · 录入界面：落纸 + 解析展开释义 ================= */

const ADD_EXIT = 'bz-kb-add-exit';

/** 影像录入弹层开 = 落纸 */
export function motionAddIn(popup: HTMLElement | null): void {
  if (!popup || reduced()) return;
  abortOut(popup);
  sweepExit(popup, ADD_EXIT);
  popup.style.opacity = ''; popup.style.transform = ''; popup.style.filter = '';
  waapi(popup,
    [{ opacity: 0, transform: 'translateY(10px) scale(.98)', filter: 'blur(5px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + 40, easing: E.out });
}

/** 影像录入弹层关 = 收纸 */
export function motionAddOut(popup: HTMLElement | null, done: () => void): void {
  runOut(popup, ADD_EXIT,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(6px) scale(.99)', filter: 'blur(3px)' }],
    { duration: M.move, easing: E.out }, done);
}

/**
 * 展开释义：解析跑完下半表单展开（display:none → block 的同一帧调用）——
 * 整块自上而下 clip 揭示 + 内部行接力浮出。词典条目「展开释义」的翻页感。
 */
export function motionAddReveal(more: HTMLElement | null): void {
  if (!more || reduced()) return;
  waapi(more,
    [{ opacity: 0, clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-5px)' },
     { opacity: 1, clipPath: 'inset(0 0 0 0)', transform: 'none' }],
    { duration: M.base + 120, easing: E.out, fill: 'backwards' });
  more.querySelectorAll<HTMLElement>('.bz-lit-term-row, #lit-add-rb, .bz-lit-term-actions').forEach((row, i) => {
    if (i >= 9) return;
    waapi(row,
      [{ opacity: 0, transform: 'translateY(5px)', filter: 'blur(2px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, delay: 90 + i * 26, easing: E.out, fill: 'backwards' });
  });
}

/* ================= 文字录入面板（名词 / 段落 / 图版）：落纸 / 收纸 ================= */

const TERM_EXIT = 'bz-kb-term-exit';

/** 录入面板开 = 落纸 + 题字（名词 / 段落 / 图版）揭出 */
export function motionEntryIn(popup: HTMLElement | null): void {
  if (!popup || reduced()) return;
  abortOut(popup);
  sweepExit(popup, TERM_EXIT);
  popup.style.opacity = ''; popup.style.transform = ''; popup.style.filter = '';
  waapi(popup,
    [{ opacity: 0, transform: 'translateY(10px) scale(.98)', filter: 'blur(5px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + 40, easing: E.out });
  const title = popup.querySelector<HTMLElement>('#lit-entry-title');
  if (title) {
    waapi(title,
      [{ opacity: .2, clipPath: 'inset(0 100% 0 0)', filter: 'blur(2px)' },
       { opacity: 1, clipPath: 'inset(0 0 0 0)', filter: 'blur(0px)' }],
      { duration: M.base + 80, delay: 70, easing: E.out, fill: 'backwards' });
  }
}

/** 录入面板关 = 收纸（写入成功 / 放弃草稿同款） */
export function motionEntryOut(popup: HTMLElement | null, done: () => void): void {
  motionPenOff();
  runOut(popup, TERM_EXIT,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(6px) scale(.99)', filter: 'blur(3px)' }],
    { duration: M.move, easing: E.out }, done);
}

/* ================= 生成预览：纸卡浮凸 + 笔还在写 ================= */

/**
 * 点下生成：预览区立即展开（display:flex 的同一帧调用）——
 * 属性卡先浮凸成形（编目在先），内容卡随后随墨迹揭开（正文在后），底部动作行收尾。
 */
export function motionEntryPreviewIn(preview: HTMLElement | null): void {
  if (!preview || reduced()) return;
  const cards = preview.querySelectorAll<HTMLElement>('.bz-lit-term-card');
  cards.forEach((card, i) => {
    waapi(card,
      [{ opacity: 0, transform: 'translateY(10px) scale(.985)', filter: 'blur(4px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base + 80, delay: i * 120, easing: E.out, fill: 'backwards' });
  });
  const actions = preview.querySelector<HTMLElement>('.bz-lit-term-actions');
  if (actions) {
    waapi(actions, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: cards.length * 120 + 60, easing: E.out, fill: 'backwards' });
  }
}

/* —— 「笔还在写」：流式期间的呼吸墨滴（长驻循环动画，句柄池管理） —— */

const penPool = new Set<HTMLElement>();

/**
 * 起笔：内容卡（.bz-lit-term-card 第二张）右下角注入呼吸墨滴——「摘录摘取中」的活性信号。
 * 纯 CSS 循环动画，移除节点即收；reduced 下不注入（「正在生成…」灰字与 sweep 条兜底信号）。
 */
export function motionEntryPenOn(card: HTMLElement | null): void {
  motionPenOff();
  if (!card || reduced() || typeof document === 'undefined') return;
  const pen = document.createElement('i');
  pen.className = 'bz-kb-pen';
  pen.setAttribute('aria-hidden', 'true');
  card.appendChild(pen);
  card.style.position = card.style.position || 'relative';
  penPool.add(pen);
}

/** 收笔：移除全部在途墨滴（写完 / 中止 / 关窗 / 销毁都要走到，绝不留永动孤儿） */
export function motionPenOff(): void {
  for (const pen of penPool) pen.remove();
  penPool.clear();
}

/* ================= 落墨：AI 值到达的墨字落纸 ================= */

/** 属性行从「分析中…」落到真值：墨字落纸（blur 收清 + 微浮），一次性 */
export function motionMetaSetValue(el: HTMLElement | null): void {
  if (!el || reduced()) return;
  waapi(el,
    [{ opacity: .25, transform: 'translateY(3px)', filter: 'blur(3px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.fast + 80, easing: E.out, fill: 'backwards' });
}

/** 首个正文字符到达（「正在生成…」→ 正文）：内容区墨迹入纸，一次性 */
export function motionContentArrive(el: HTMLElement | null): void {
  if (!el || reduced()) return;
  waapi(el,
    [{ filter: 'blur(1.5px)' }, { filter: 'blur(0px)' }],
    { duration: M.fast + 60, easing: E.out, fill: 'backwards' });
}

/* ================= 关联行 / 重名 / 图版 / 来源 chip ================= */

/** 关联行整行出现（idle → loading 的同一帧）：轻揭出，让「正在分析」看得见地登场 */
export function motionRelRowIn(row: HTMLElement | null): void {
  if (!row || reduced()) return;
  waapi(row, [{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.fast + 60, easing: E.out, fill: 'backwards' });
}

/** 签片弹出：关联候选 chips 逐张插进卡槽（30ms 接力） */
export function motionRelChips(relEl: HTMLElement | null): void {
  if (!relEl || reduced()) return;
  relEl.querySelectorAll<HTMLElement>('.bz-lit-rel-chip').forEach((chip, i) => {
    waapi(chip, [{ opacity: 0, transform: 'scale(.72) translateY(2px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.fast + 60, delay: 40 + i * STAG, easing: E.out, fill: 'backwards' });
  });
}

/** 摇铃：重名提醒出现 = 一次性横摇警示（不循环、不落 forwards） */
export function motionDupHint(hint: HTMLElement | null): void {
  if (!hint || reduced()) return;
  waapi(hint,
    [{ opacity: 0, transform: 'translateX(0)' },
     { opacity: 1, transform: 'translateX(-3px)', offset: .3 },
     { transform: 'translateX(3px)', offset: .55 },
     { transform: 'translateX(-2px)', offset: .78 },
     { opacity: 1, transform: 'translateX(0)' }],
    { duration: M.fast * 2 + 60, easing: E.out, fill: 'backwards' });
}

/**
 * 图版缩略图入格：新增的（下标 >= from）照片「贴上卡纸」——微缩 + 微转回正，30ms 接力。
 * 删图路径（无新增）不播，避免整格闪动。
 */
export function motionThumbsIn(grid: HTMLElement | null, from: number): void {
  if (!grid || reduced()) return;
  const items = grid.querySelectorAll<HTMLElement>('.bz-lit-drop-item');
  items.forEach((item, i) => {
    if (i < from) return;
    waapi(item,
      [{ opacity: 0, transform: 'scale(.88) rotate(-2deg)', filter: 'blur(2px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, delay: (i - from) * STAG, easing: E.out, fill: 'backwards' });
  });
}

/** 来源 chip 弹出：落定来源 = 索引签拍进卡槽（外部标题异步抓回重渲时同款轻弹） */
export function motionSrcChipIn(chip: HTMLElement | null): void {
  if (!chip || reduced()) return;
  waapi(chip, [{ opacity: 0, transform: 'scale(.9) translateY(2px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.fast + 50, easing: E.out, fill: 'backwards' });
}

/* ================= 挂载树白板：升板 / 收板 + 卡片上墙 + 连线生长 ================= */

const TREE_EXIT = 'bz-kb-mt-exit';

/** 白板开 = 大板升起；`fresh` = 面板此前不可见（抬层重入不重播壳动画） */
export function motionTreeIn(win: HTMLElement | null, fresh: boolean): void {
  if (!win || reduced() || !fresh) return;
  abortOut(win);
  sweepExit(win, TREE_EXIT);
  win.style.opacity = ''; win.style.transform = ''; win.style.filter = '';
  waapi(win,
    [{ opacity: 0, transform: 'translateY(14px) scale(.985)', filter: 'blur(7px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + 140, easing: E.out });
}

/** 白板关 = 收板 */
export function motionTreeOut(win: HTMLElement | null, done: () => void): void {
  runOut(win, TREE_EXIT,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(10px) scale(.99)', filter: 'blur(5px)' }],
    { duration: M.move + 40, easing: E.out }, done);
}

/* —— 卡片上墙：按深度接力钉上白板 —— */

/** 已上过墙的节点 id（建议并入的重画只补新卡，不整墙重播）；换卡 / 重跑 = fresh 清记忆 */
let treeShownIds = new Set<string>();

/**
 * 卡片上墙：主卡先落，越深的层越晚上（30ms 接力，cap 18）；ghost（AI 建议）卡加一次虚线脉冲。
 * `fresh` = 这一轮画布是重建（换卡 / 重跑 / 本地刷新）：清上墙记忆、全部重播。
 */
export function motionTreeCards(worldEl: HTMLElement | null, opts: { fresh: boolean; rootId: string }): void {
  if (!worldEl || reduced()) return;
  if (opts.fresh) treeShownIds = new Set();
  const nodes = [...worldEl.querySelectorAll<HTMLElement>('.bz-kb-mt-node')];
  // 主卡排最前，其余按 DOM 序（布局已按深度铺开）
  nodes.sort((a, b) => {
    const ra = a.getAttribute('data-mt-id') === opts.rootId ? -1 : 0;
    const rb = b.getAttribute('data-mt-id') === opts.rootId ? -1 : 0;
    return ra - rb;
  });
  let step = 0;
  for (const node of nodes) {
    const id = node.getAttribute('data-mt-id') || '';
    if (treeShownIds.has(id)) continue;
    treeShownIds.add(id);
    if (node.style.display === 'none') continue; // 被 culled 的卡不上墙
    if (step >= 18) break;
    const ghost = node.classList.contains('is-ghost');
    waapi(node,
      [{ opacity: 0, transform: 'translateY(8px) scale(.96)', filter: 'blur(4px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base + 80, delay: 40 + step * STAG, easing: E.out, fill: 'backwards' });
    if (ghost) {
      // 建议卡落墙后虚线边闪一次「正在提议」的轮廓脉冲（amber 已由类配色，这里只动透明度）
      waapi(node, [{ opacity: .4 }, { opacity: 1 }], { duration: M.impulse - 300, delay: 300 + step * STAG, easing: E.out, fill: 'backwards' });
    }
    step++;
  }
}

/**
 * 连线生长：实线边逐条描线（stroke-dash 自起点画向目标，「知识连线从主卡晕开」）；
 * 建议 / 回退虚线边自带 dasharray，改为随层浮现。端点圆点与虚线边跟随连线层一起显影。
 */
export function motionTreeEdges(svg: SVGElement | null): void {
  if (!svg || reduced()) return;
  const paths = [...svg.querySelectorAll<SVGPathElement>('.bz-kb-mt-edge')];
  let step = 0;
  for (const p of paths) {
    const dashed = p.classList.contains('is-sug') || p.classList.contains('is-fb');
    if (dashed) continue; // 虚线边不描线（dasharray 冲突），随层浮现即可
    if (step >= 24) break;
    let len = 0;
    try { len = p.getTotalLength(); } catch { continue; } // jsdom 无 getTotalLength：直通终态
    if (!len || !Number.isFinite(len)) continue;
    waapi(p,
      [{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` },
       { strokeDasharray: `${len}`, strokeDashoffset: '0' }],
      { duration: M.base + 160, delay: 160 + step * 24, easing: E.move, fill: 'backwards' });
    step++;
  }
  if (step || paths.length) {
    waapi(svg, [{ opacity: 0 }, { opacity: 1 }], { duration: M.fast + 60, easing: E.out, fill: 'backwards' });
  }
}

/** 右键 / 长按菜单弹出：从落点摊开（菜单是自毁节点，随 closeMenu remove） */
export function motionTreeMenu(menu: HTMLElement | null): void {
  if (!menu || reduced()) return;
  menu.style.transformOrigin = '0 0';
  waapi(menu,
    [{ opacity: 0, transform: 'scale(.93) translateY(-2px)', filter: 'blur(2px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.fast + 40, easing: E.out, fill: 'backwards' });
}

/** 挂载建议进度卡出现：轻揭出（进度条宽度的推进由域内 CSS transition 自理，此处只管登场） */
export function motionProgressIn(loadingEl: HTMLElement | null): void {
  if (!loadingEl || reduced()) return;
  waapi(loadingEl,
    [{ opacity: 0, transform: 'translate(-50%, -48%) scale(.97)', filter: 'blur(3px)' },
     { opacity: 1, transform: 'translate(-50%, -50%)', filter: 'blur(0px)' }],
    { duration: M.base, easing: E.out, fill: 'backwards' });
}

/* ================= 清场 ================= */

/**
 * 面板销毁清场：撤全部在途退场簿记 + 编排定时器 + 长驻循环注入件。
 * ui.destroy / destroyMountTree 调用；幂等。
 */
export function motionTeardown(): void {
  cancelPending();
  for (const [el, run] of [...outRuns.entries()]) {
    outRuns.delete(el);
    run.abort();
  }
  motionPenOff();
  treeShownIds = new Set();
}

/* ================= 评审便利：#replay 重播首屏编排（插件内同样无害） =================
   壳在页面加载时就跑 openPanel，首屏编排可能发生在你看到页面之前——带 #replay 打开（或刷新）
   会在 0.6s 后重播一次：主窗收起再落纸 + 内容全编排。ui.ts 在 showMain 里挂 __bzKbReplay。 */
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#replay') return;
    location.hash = '';
    const replay = (window as unknown as Record<string, unknown>).__bzKbReplay as (() => void) | undefined;
    if (typeof replay === 'function') setTimeout(replay, 600);
  });
  if (location.hash === '#replay') {
    const wait = (): void => {
      const replay = (window as unknown as Record<string, unknown>).__bzKbReplay as (() => void) | undefined;
      if (typeof replay === 'function') { location.hash = ''; setTimeout(replay, 600); }
      else setTimeout(wait, 120);
    };
    setTimeout(wait, 120);
  }
}
