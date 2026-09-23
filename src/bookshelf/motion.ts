/**
 * 书库动效层（2026-09-22 动效批，与影院/备忘录/首页同打法：原 UI 上做全量演出，布局零改动）。
 *
 * ── 语义词汇表（书库自己的语言，不借别的域的招） ──
 *  - 灯光（lamp）：面板开 = 书房灯亮（brightness 从暗到明 + 上浮落定）；关 = 灯灭下沉。
 *  - 码墙（shelve-in）：书脊一根根立着插上架——分类区从平转立落位，一排排哗啦啦码上。
 *  - 倒扣（stack-down）：倒叠区的未读书从上方扣下来落位（灰着落，终态保持倒扣灰）。
 *  - 抽书（pull-out）：点书脊 = 把书从架上抽出来——书脊上抽亮一下再弹回，借书卡随后摊上桌。
 *  - 墨爬（ink-crawl）：阅读进度 / 批注密度 / 报告条形 = 墨从左往右爬满（clip-path 揭示），
 *    数字同步跳动——「进度是墨迹」是书库报告的统一动词。
 *  - 盖印（stamp）：已读书脊的「讫」印、借书卡的印章——落章带过冲，一次成型。
 *  - 垂带（ribbon-drop）：在读书的书签带从书底垂落，之后轻摆（长驻循环，句柄池必收）。
 *  - 翻找（riffle）：搜索 = 目光扫过书架（整墙快模糊一拍）再快速码上命中结果。
 *  - 入架（admit）：渲染 diff 出的新收录书脊（含 EPUB）做一次强调落位 + 顶部扫光。
 *  - 摊卡（card-spread）：借书卡 = 卡片落桌摊开，台账行接力、墨条爬满、印章压角。
 *  - 铺稿（unroll）：阅读报告每段 = 一页墨稿铺开，段内月柱长出、热力格逐格点亮。
 *
 * 原则（与 home/motion.ts 同口径）：
 *  - 只动表现：注入件（扫光层）全部 absolute + pointer-events:none + aria-hidden，
 *    演出完自移除；只动 transform/opacity/filter/clip-path，几何从不改写。
 *  - reduced() 只认 ?rm=1（评审期默认无视系统 RM 放完整演出）；无 WAAPI 宿主
 *    （jsdom/老内核）完全不动——内容已由渲染层落终态，域内测试零感知。
 *  - markup 纯层一字不改：本层只在 ui.ts / notes-ui.ts 的生命周期挂点被调用。
 *  - 终态即今天：入场动画关键帧的终点取自元素现算样式（rest），在读抽出的 -22px、
 *    标签的歪贴角、未读的倒扣灰都原样落回，不写死魔法值。
 *  - 面板是即弃节点（closeOverlay 销毁重建），退场 fill:forwards 随节点销毁；
 *    motionPanelOut 仍在 finish 后 cancel（首页教训的防御性照抄）。
 */

/* ================= 台账与口径 ================= */

const M = { fast: 160, move: 200, base: 280, impulse: 740 } as const;
const E = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
} as const;
const STAG = 30;

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，见 home/motion.ts 头注）。 */
function reduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}
/** 能播吗：rm 时一律不播（内容已由渲染层落终态）；无 WAAPI 宿主同理完全不动。 */
function playable(el?: HTMLElement | null): boolean {
  if (reduced()) return false;
  if (el && typeof el.animate !== 'function') return false;
  return true;
}

/** 安全 WAAPI：不可播时返回 null 且**完全不动元素**（渲染层终态即真相，绝不内联污染） */
function waapi(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || !playable(el)) return null;
  try { return el.animate(frames, opts); } catch { return null; }
}

/** rAF 补间（数字跳动用；宿主节点摘除即自停，无句柄泄漏） */
function tween(dur: number, step: (v: number) => void, ease: (t: number) => number = (t) => 1 - Math.pow(1 - t, 3)): void {
  if (typeof requestAnimationFrame !== 'function') return;
  const t0 = performance.now();
  const tick = (now: number): void => {
    const p = Math.min(1, (now - t0) / dur);
    step(ease(p));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** 延时调度（面板级取消，防快速刷新时编排叠加） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  if (typeof setTimeout !== 'function') { try { fn(); } catch { /* 忽略 */ } return; }
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/* ================= 句柄池：动画 / 循环 / 观察器，motionTeardown 一把收 ================= */

const liveAnims = new Set<Animation>();
function track(a: Animation | null, onfinish?: () => void): void {
  if (!a) return;
  liveAnims.add(a);
  const done = () => { liveAnims.delete(a); try { onfinish?.(); } catch { /* 收尾钩子失败不追 */ } };
  a.finished.then(done).catch(done);
}

/** 长驻循环（书签带轻摆）的活体集合：面板销毁即随节点消失，teardown 再兜一层摘类 */
const liveSway = new Set<HTMLElement>();

/** 报告分片渲染观察器（报告视图切换 / 面板关闭必收） */
let rrObserver: MutationObserver | null = null;

/** 渲染过的书脊 id 全集（union）：refresh 渲染 diff 出新收录书脊 → 入架演出 */
let knownSpines: Set<string> | null = null;

/** 上一次 hint 文本（计数变化 pulse 用） */
let lastHint = '';

/** boot 消费标志：面板入口置位，首次墙渲染消费即熄——后台刷新等非首次渲染静默不重播 */
let bootPending = false;

/** 演出进行中（busyUntil 前）：墙编排尚未落定。此间「数据签名未变的自动刷新」不该
 *  把正在演的墙换血（评审壳双 iframe 同源共享 localStorage，另一 iframe 重灌种子会
 *  触发本侧 autoRefresh；插件侧 boot 演出中的数据落盘同理）——由 ui.ts renderWall
 *  藉此跳过本次重渲染（签名变了照常渲染，数据真变绝不因为演出而丢失）。 */
let busyUntil = 0;

/** 墙编排是否进行中（ui.ts 渲染跳过判定用；rm/无 WAAPI 宿主恒 false） */
export function motionBusy(): boolean {
  try { return typeof performance !== 'undefined' && performance.now() < busyUntil; }
  catch { return false; }
}

/** 全量清场（面板关闭 / 插件卸载）：动画、循环、观察器、调度、diff 账本一次收干净 */
export function motionTeardown(): void {
  cancelPending();
  for (const a of [...liveAnims]) { try { a.cancel(); } catch { /* 已收口忽略 */ } }
  liveAnims.clear();
  for (const el of liveSway) el.classList.remove('bz-bsm-sway');
  liveSway.clear();
  stopReportObserver();
  knownSpines = null;
  lastHint = '';
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.bz-bsm-sheen').forEach((el) => el.remove());
  }
}

/* ================= 小工具 ================= */

/** 元素现算终态（transform/filter）：入场动画的落点，保「在读 -22px / 标签歪贴 / 未读灰」原样 */
function restOf(el: HTMLElement): { transform: string; filter: string } {
  try {
    const cs = getComputedStyle(el);
    return {
      transform: cs.transform && cs.transform !== 'none' ? cs.transform : 'none',
      filter: cs.filter && cs.filter !== 'none' ? cs.filter : 'none',
    };
  } catch { return { transform: 'none', filter: 'none' }; }
}

/** 宿主必要时内联 relative（扫光层的定位锚；relative 不移位，几何零变化） */
function ensureRelative(el: HTMLElement): void {
  try { if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; }
  catch { /* 测试宿主无 computedStyle：跳过（sheen 也不会注入） */ }
}

/** 扫光注入件：一次性演出完自移除（absolute + 不吃事件 + aria-hidden） */
function sheen(host: HTMLElement, vertical: boolean): void {
  if (!playable(host)) return;
  ensureRelative(host);
  const i = document.createElement('i');
  i.className = 'bz-bsm-sheen' + (vertical ? ' v' : '');
  i.setAttribute('aria-hidden', 'true');
  host.appendChild(i);
  after(760, () => i.remove());
}

/** 数字跳动：抽取文本中的数字补间到原值，结束强制还原原文（终态逐字一致） */
function countUp(el: HTMLElement, dur: number): void {
  if (!el.isConnected || reduced()) return;
  const raw = el.textContent || '';
  const m = raw.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!m) return;
  const target = parseFloat(m[0].replace(/,/g, ''));
  if (!isFinite(target) || target === 0) return;
  const decimals = (m[0].split('.')[1] || '').length;
  const fmt = (v: number): string => v.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  tween(dur, (v) => {
    if (!el.isConnected) return;
    el.textContent = raw.replace(m[0], fmt(target * v));
  });
  after(dur + 40, () => { if (el.isConnected) el.textContent = raw; });
}

/* ================= 面板壳：开（灯亮）/ 关（灯灭） ================= */

/** 退场动画的 id（motionPanelOut finish 后 cancel，不留 forwards 钉死残留） */
const EXIT_ANIM_ID = 'bz-bs-panel-exit';

/**
 * 面板入场 = 书房灯亮：整面板从暗处浮起、亮度爬升。同时置位 boot 消费标志——
 * 首次墙渲染（rebuild 完成）消费它播放首屏编排，后台刷新等非首次渲染静默。
 */
export function motionPanelIn(overlay: HTMLElement): void {
  bootPending = true;
  const panel = overlay.querySelector<HTMLElement>('.bz-bs-panel');
  if (!panel) return;
  panel.style.opacity = ''; panel.style.transform = ''; panel.style.filter = '';
  waapi(panel,
    [{ opacity: 0, transform: 'translateY(16px) scale(.984)', filter: 'brightness(.5) blur(9px)' },
     { opacity: 1, transform: 'none', filter: 'brightness(1) blur(0px)' }],
    { duration: 480, easing: E.out });
}

/**
 * 关闭 = 灯灭下沉（240ms）再交还销毁（done 由调用方收口，闭包捕获自己的 overlay，
 * 退场期间被重开也不误伤新面板）。rm / 无 WAAPI：同步收口，绝不让销毁晚到。
 */
export function motionPanelOut(overlay: HTMLElement, done: () => void): void {
  const panel = overlay.querySelector<HTMLElement>('.bz-bs-panel');
  if (!panel) { done(); return; }
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    try { if (a && a.playState !== 'idle') a.cancel(); } catch { /* 已收口忽略 */ }
    done();
  };
  const a = waapi(panel,
    [{ opacity: 1, transform: 'none', filter: 'brightness(1) blur(0px)' },
     { opacity: 0, transform: 'translateY(10px) scale(.988)', filter: 'brightness(.55) blur(5px)' }],
    { duration: M.move + 40, easing: E.out, fill: 'forwards', id: EXIT_ANIM_ID });
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  after(M.move + 200, finish);
}

/* ================= 墙渲染完成：首屏编排 / 各档快排 / 静默 diff ================= */

/** 墙渲染原因（ui.ts 各交互点置位；boot 由本层 bootPending 覆盖判定） */
export type BsWallAction = 'boot' | 'filter' | 'search' | 'refresh' | 'layout' | 'reshelf';

/**
 * 墙渲染完成挂点（ui.ts renderWall 调）：
 *  boot     首屏全编排（灯亮掩护下：匾额钉匾 → 标签图钉 → 分区码墙 → 垂带/盖印/扫光）
 *  filter   筛选/排序/清词：快速码墙
 *  search   搜索：整墙翻找一拍 + 命中结果极速码墙
 *  reshelf  报告返回书库：快速码墙
 *  refresh  数据自动刷新：静默（只对新收录书脊补一次入架）
 *  layout   窗口缩放重装箱：完全静默
 */
export function motionWallRendered(
  overlay: HTMLElement | null,
  shelf: HTMLElement,
  hint: HTMLElement | null,
  action: BsWallAction,
): void {
  // 新渲染覆盖旧编排（快速连点筛选/搜索时上批书脊动画立刻撤）
  for (const a of [...liveAnims]) { try { a.cancel(); } catch { /* 已收口忽略 */ } }
  liveAnims.clear();
  const boot = bootPending;
  bootPending = false;
  if (reduced()) { snapshotSpines(shelf); return; }
  busyUntil = 0;
  hintBeat(hint, boot);
  if (action === 'refresh' || action === 'layout') {
    reSway(shelf); // innerHTML 换血会洗掉轻摆类：在读的书永远「活」着，静默重排后重挂
    admitNewSpines(shelf);
    return;
  }
  // 编排预算（busy 窗口 = 最后一段落章/扫光收尾；期间签名未变的刷新被 ui 跳过）
  busyUntil = (typeof performance !== 'undefined' ? performance.now() : 0)
    + (boot ? 2400 : action === 'search' ? 1100 : 1500);
  if (!boot && action === 'filter') choreographWall(shelf, 'filter');
  else if (!boot && action === 'search') choreographWall(shelf, 'search');
  else if (!boot && action === 'reshelf') choreographWall(shelf, 'reshelf');
  else choreographBoot(overlay, shelf);
  snapshotSpines(shelf);
}

/** 记录见过的书脊（union——筛选/搜索少见的书不清账，refresh diff 才准） */
function snapshotSpines(shelf: HTMLElement): void {
  if (!knownSpines) knownSpines = new Set();
  shelf.querySelectorAll<HTMLElement>('.bz-bs-spine').forEach((sp) => {
    if (sp.dataset.bsId) knownSpines!.add(sp.dataset.bsId);
  });
}

/** 静默重排（refresh/layout）后重挂在读书签带的轻摆循环（类入 liveSway 池） */
function reSway(shelf: HTMLElement): void {
  if (reduced()) return;
  shelf.querySelectorAll<HTMLElement>('.bz-bs-spine.reading .ribbon').forEach((ribbon) => {
    if (!ribbon.classList.contains('bz-bsm-sway')) {
      ribbon.classList.add('bz-bsm-sway');
      liveSway.add(ribbon);
    }
  });
}

/** refresh 档：diff 出新收录书脊 → 入架强调演出（书脊插架 + 顶部扫光；EPUB 一定扫） */
function admitNewSpines(shelf: HTMLElement): void {
  if (!knownSpines) { snapshotSpines(shelf); return; }
  const fresh: HTMLElement[] = [];
  shelf.querySelectorAll<HTMLElement>('.bz-bs-spine').forEach((sp) => {
    const id = sp.dataset.bsId || '';
    if (id && !knownSpines!.has(id)) fresh.push(sp);
  });
  if (!fresh.length) return;
  snapshotSpines(shelf);
  fresh.forEach((sp, i) => {
    shelveIn(sp, i * 90, { fast: false, accent: true, unread: sp.classList.contains('unread'), reading: sp.classList.contains('reading') });
  });
}

/* ================= 首屏编排：chrome + 码墙 ================= */

function choreographBoot(overlay: HTMLElement | null, shelf: HTMLElement): void {
  if (!overlay) { choreographWall(shelf, 'boot'); return; }
  /* —— 木匾：钉匾 + 金线扫光 —— */
  const plaque = overlay.querySelector<HTMLElement>('.bz-bs-plaque');
  if (plaque) {
    track(waapi(plaque,
      [{ opacity: 0, transform: 'translateY(-12px) scale(1.1)', filter: 'blur(5px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base + 120, easing: E.out, fill: 'backwards' }));
    after(380, () => { if (plaque.isConnected) sheen(plaque, false); });
  }
  /* —— 纸质标签：图钉钉上（歪贴终态取现算值，不写死角度） —— */
  overlay.querySelectorAll<HTMLElement>('.bz-bs-taglabel').forEach((lb, i) => {
    const rest = restOf(lb);
    track(waapi(lb,
      [{ opacity: 0, transform: 'translateY(-9px) scale(1.14)', filter: 'blur(2px)' },
       { opacity: 1, transform: rest.transform, filter: 'none' }],
      { duration: M.base, delay: 90 + Math.min(i, 12) * STAG + 5, easing: E.out, fill: 'backwards' }));
  });
  /* —— 工具行 / 墙脚注 —— */
  const tools = overlay.querySelector<HTMLElement>('.bz-bs-tools');
  if (tools) track(waapi(tools,
    [{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.base, delay: 150, easing: E.out, fill: 'backwards' }));
  const note = overlay.querySelector<HTMLElement>('.bz-bs-wallnote');
  if (note) track(waapi(note, [{ opacity: 0 }, { opacity: 1 }],
    { duration: M.base + 140, delay: 460, easing: E.out, fill: 'backwards' }));
  choreographWall(shelf, 'boot');
}

/**
 * 码墙编排（boot 全速 / filter·reshelf 快档 / search 极速）：
 * 每区 隔板挂牌滑落 → 书挡立起 → 书脊依次插架（关键帧终点 = 各书现算终态）。
 * 同帧创建动画 + delay + fill:backwards：渲染帧内即隐形，绝不先闪终态再重播。
 */
function choreographWall(shelf: HTMLElement, mode: 'boot' | 'filter' | 'search' | 'reshelf'): void {
  const zones = [...shelf.querySelectorAll<HTMLElement>('.bz-bs-zone')];
  if (!zones.length) {
    const empty = shelf.querySelector<HTMLElement>('.bz-bs-wall-empty');
    if (empty) track(waapi(empty,
      [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base + 100, delay: 160, easing: E.out, fill: 'backwards' }));
    return;
  }
  const zGap = mode === 'boot' ? 55 : mode === 'search' ? 22 : 40;
  const sGap = mode === 'boot' ? 11 : mode === 'search' ? 4.5 : 7;
  const sCap = mode === 'boot' ? 18 : mode === 'search' ? 26 : 14;
  const zBase = mode === 'boot' ? 190 : mode === 'search' ? 30 : 50;
  const fast = mode !== 'boot';
  if (mode === 'search') {
    // 翻找：整墙快模糊一拍（视线扫过书架），命中结果随后码上
    track(waapi(shelf,
      [{ opacity: .3, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)' }],
      { duration: M.move + 80, easing: E.out }));
  }
  zones.forEach((zone, zi) => {
    const divider = zone.querySelector<HTMLElement>('.bz-bs-divider');
    const zDelay = zBase + zi * zGap;
    const unreadZone = !!divider && (divider.textContent || '').includes('倒');
    if (divider) track(waapi(divider,
      [{ opacity: 0, transform: 'translateY(-16px)', filter: 'blur(3px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, delay: Math.max(0, zDelay - 40), easing: E.out, fill: 'backwards' }));
    zone.querySelectorAll<HTMLElement>('.bz-bs-bookend').forEach((bk, bi) => track(waapi(bk,
      [{ opacity: 0, transform: 'scaleY(.55)', transformOrigin: '50% 100%' },
       { opacity: 1, transform: 'none', transformOrigin: '50% 100%' }],
      { duration: M.base, delay: zDelay + bi * 60, easing: E.out, fill: 'backwards' })));
    let j = 0;
    zone.querySelectorAll<HTMLElement>('.bz-bs-spine').forEach((sp) => {
      const idx = j++;
      const delay = zDelay + 60 + Math.min(idx, sCap) * sGap;
      shelveIn(sp, delay, {
        fast,
        accent: false,
        unread: unreadZone || sp.classList.contains('unread'),
        reading: sp.classList.contains('reading'),
      });
    });
  });
}

/**
 * 单根书脊入场（码墙的最小动作）：
 *  普通书   = 插架：平转立起、从架沿落下（rotateX + translateY，落点亮一拍）
 *  倒叠未读 = 倒扣：从上方扣落，灰着下来
 *  在读     = 已抽出的书原地亮起（不重复插回），随后书签带垂落 + 轻摆
 *  accent   = 新收录/EPUB 入架：更亮的落点 + 顶部扫光
 */
function shelveIn(
  sp: HTMLElement,
  delay: number,
  opts: { fast: boolean; accent: boolean; unread: boolean; reading: boolean },
): void {
  const rest = restOf(sp);
  const dur = opts.fast ? M.move + 60 : M.base + 140;
  const from: Keyframe = opts.reading
    ? { opacity: 0, transform: 'translateY(-10px)', filter: opts.accent ? 'brightness(1.8) blur(2px)' : 'brightness(1.5) blur(2px)' }
    : opts.unread
      ? { opacity: 0, transform: 'translateY(-18px) rotate(-4deg)', filter: 'grayscale(1) brightness(.7) blur(1px)' }
      : { opacity: 0, transform: 'perspective(520px) rotateX(-16deg) translateY(22px)', filter: opts.accent ? 'brightness(1.6) blur(1px)' : 'brightness(1.3) blur(2px)' };
  const a = waapi(sp, [from, { opacity: 1, transform: rest.transform, filter: rest.filter }],
    { duration: dur, delay, easing: E.out, fill: 'backwards' });
  track(a);
  if (!a) return; // 无 WAAPI 宿主：终态即真相，串联演出也一并免
  sp.style.willChange = 'transform, opacity, filter';
  const clear = (): void => { sp.style.willChange = ''; };
  a.finished.then(clear).catch(clear);
  const tail = delay + dur - 60;
  if (sp.isConnected) {
    if (opts.reading) dropRibbon(sp.querySelector<HTMLElement>('.ribbon'), tail);
    else popStamp(sp.querySelector<HTMLElement>('.stamp'), tail);
    if (opts.accent || sp.dataset.bsEpub === '1') after(tail + 120, () => { if (sp.isConnected) sheen(sp, true); });
  }
}

/** 书签带垂落（在读）：从书底展开，垂完交给 CSS 轻摆循环（类名入 liveSway 池） */
function dropRibbon(ribbon: HTMLElement | null, delay: number): void {
  if (!ribbon) return;
  const a = waapi(ribbon,
    [{ transform: 'translateX(-50%) scaleY(0)', transformOrigin: '50% 0%' },
     { transform: 'translateX(-50%) scaleY(1)', transformOrigin: '50% 0%' }],
    { duration: M.base, delay, easing: E.out, fill: 'backwards' });
  track(a, () => {
    if (!ribbon.isConnected) return;
    ribbon.classList.add('bz-bsm-sway');
    liveSway.add(ribbon);
  });
}

/** 「讫」印落章（已读）：过冲一次成型（印自身歪角 -8deg 全程保留） */
function popStamp(stamp: HTMLElement | null, delay: number): void {
  if (!stamp) return;
  track(waapi(stamp,
    [{ opacity: 0, transform: 'rotate(-8deg) scale(.3)' },
     { opacity: 1, transform: 'rotate(-8deg) scale(1.45)', offset: .62 },
     { opacity: .85, transform: 'rotate(-8deg) scale(1)' }],
    { duration: 380, delay, easing: E.out, fill: 'backwards' }));
}

/** 「N 册在墙」：boot 淡入；计数变化 pulse 一拍 */
function hintBeat(hint: HTMLElement | null, boot: boolean): void {
  if (!hint) return;
  const changed = (hint.textContent || '') !== lastHint;
  lastHint = hint.textContent || '';
  if (boot) track(waapi(hint,
    [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.base, delay: 260, easing: E.out, fill: 'backwards' }));
  else if (changed) track(waapi(hint, [{ opacity: .2 }, { opacity: 1 }], { duration: M.move, easing: E.out }));
}

/* ================= 借书卡：抽书 → 摊卡 → 墨爬 → 盖印 ================= */

/**
 * 借书卡演出（openBookDetail 调）：
 *  1) 被点书脊抽出（上抽亮一拍再弹回架上——书还在，卡是台账）；
 *  2) 纸卡落桌摊开（歪贴终态取现算值）、封面浮现、台账行接力；
 *  3) 阅读进度 / 批注密度两条墨从左往右爬满，进度数字同步跳动；
 *  4) 印章压角盖下。
 */
export function motionDetailOpen(popup: HTMLElement, spine: HTMLElement | null): void {
  if (reduced()) return;
  if (spine && spine.isConnected) {
    const rest = restOf(spine);
    track(waapi(spine,
      [{ transform: rest.transform, filter: rest.filter },
       { transform: 'translateY(-30px) scale(1.04)', filter: 'brightness(1.3)', offset: .42 },
       { transform: rest.transform, filter: rest.filter }],
      { duration: M.move + 240, easing: E.move }));
    after(60, () => { if (spine.isConnected) sheen(spine, true); });
  }
  const card = popup.querySelector<HTMLElement>('.bz-bs-d-card');
  if (card) {
    const rest = restOf(card);
    track(waapi(card,
      [{ opacity: 0, transform: 'rotate(1.6deg) translateY(16px) scale(.96)', filter: 'blur(5px)' },
       { opacity: 1, transform: rest.transform, filter: 'blur(0px)' }],
      { duration: M.base + 140, easing: E.out }));
  }
  const pull = popup.querySelector<HTMLElement>('.bz-bs-d-pull');
  if (pull) track(waapi(pull,
    [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.base, delay: 140, easing: E.out, fill: 'backwards' }));
  popup.querySelectorAll<HTMLElement>('.bz-bs-d-cover img, .bz-bs-d-cover-ph').forEach((cover) => {
    track(waapi(cover,
      [{ opacity: 0, transform: 'translateX(-10px) rotate(-2deg)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 180, easing: E.out, fill: 'backwards' }));
  });
  popup.querySelectorAll<HTMLElement>('.bz-bs-d-ledger tr').forEach((tr, i) => {
    track(waapi(tr,
      [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 220 + i * 35, easing: E.out, fill: 'backwards' }));
  });
  popup.querySelectorAll<HTMLElement>('.bz-bs-d-meter').forEach((meter, mi) => {
    const fill = meter.querySelector<HTMLElement>('.bar > i');
    if (fill) track(waapi(fill,
      [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)' }],
      { duration: M.impulse, delay: 320 + mi * 180, easing: E.move, fill: 'backwards' }));
  });
  const num = popup.querySelector<HTMLElement>('.bz-bs-d-prognum');
  if (num) after(320, () => countUp(num, M.impulse));
  const seal = popup.querySelector<HTMLElement>('.bz-bs-d-seal');
  if (seal) {
    const rest = restOf(seal);
    track(waapi(seal,
      [{ opacity: 0, transform: 'rotate(-14deg) scale(1.9)', filter: 'blur(3px)' },
       { opacity: 1, transform: rest.transform, filter: 'blur(0px)' }],
      { duration: 360, delay: 560, easing: E.out, fill: 'backwards' }));
  }
}

/* ================= 阅读报告视图（bookshelf 面板内嵌，ADR-0091） ================= */

/**
 * 报告视图入场：从书墙前翻出一页（轻 perspective + 上浮）。冷开报告（墙还没渲染）
 * 在这里消费 bootPending——报告先播了首演，之后回墙走 reshelf 快档而不是重播首屏。
 */
export function motionReportEnter(view: HTMLElement | null): void {
  bootPending = false;
  if (!view || reduced()) return;
  track(waapi(view,
    [{ opacity: 0, transform: 'perspective(1100px) rotateX(5deg) translateY(14px)', filter: 'blur(4px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + 120, easing: E.out }));
  const head = view.querySelector<HTMLElement>('.bz-rr-head');
  if (head) track(waapi(head,
    [{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.base, delay: 90, easing: E.out, fill: 'backwards' }));
}

/**
 * 报告分片渲染观察：每段落布即「墨稿铺开」+ 段内图表各归各的动词
 * （条形墨爬 / 月柱长出 / 热力格逐格点亮 / 大数跳动）。silent 档（自动刷新）不挂——
 * 在途旧演出也一并撤，silent 期间内容静默换血。
 */
export function motionReportWatch(content: HTMLElement, silent?: boolean): void {
  stopReportObserver();
  if (silent || !playable(content) || typeof MutationObserver !== 'function') return;
  try {
    rrObserver = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n instanceof HTMLElement && n.classList.contains('bz-rr-skeleton')) continue;
          if (n instanceof HTMLElement) motionReportSection(n);
        }
      }
    });
    rrObserver.observe(content, { childList: true });
  } catch { rrObserver = null; }
}

/** 停观察（视图切走 / 面板关闭；幂等） */
export function motionReportStop(): void {
  stopReportObserver();
}
function stopReportObserver(): void {
  if (rrObserver) { try { rrObserver.disconnect(); } catch { /* 已断 */ } rrObserver = null; }
}

/** 单段报告：铺稿 + 段内图表编排 */
function motionReportSection(sec: HTMLElement): void {
  if (reduced()) return;
  track(waapi(sec,
    [{ opacity: 0, transform: 'translateY(12px)', filter: 'blur(3px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + 80, easing: E.out }));
  // 墨爬：条形行 / 专注档位 / 速度条——报告里所有「比例」都是墨
  sec.querySelectorAll<HTMLElement>('.bz-rr-bar-track > i, .bz-rr-focus-fill, .bz-rr-speed-fill').forEach((bar, i) => {
    track(waapi(bar,
      [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)' }],
      { duration: M.impulse, delay: 120 + i * 70, easing: E.move, fill: 'backwards' }));
  });
  // 月柱长出（趋势 / 年卡展开体 / 热力共用的柱语）
  sec.querySelectorAll<HTMLElement>('.bz-rr-mbar').forEach((col, i) => {
    track(waapi(col,
      [{ transform: 'scaleY(0)', transformOrigin: '50% 100%' },
       { transform: 'scaleY(1)', transformOrigin: '50% 100%' }],
      { duration: M.base, delay: 140 + i * 28, easing: E.out, fill: 'backwards' }));
  });
  // 热力格逐格点亮（按格序波浪推进）
  sec.querySelectorAll<HTMLElement>('.bz-rr-hm-cell--data').forEach((cell, i) => {
    track(waapi(cell,
      [{ opacity: .08, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: M.move, delay: 160 + Math.min(i, 42) * 14, easing: E.out, fill: 'backwards' }));
  });
  // 大数跳动（概览四宫格 / 总时长 / 年卡数）
  sec.querySelectorAll<HTMLElement>('.bz-rr-hero-num, .bz-rr-total, .bz-rr-metric-num, .bz-rr-metric-num--lg, .bz-rr-metric-num--xl').forEach((n, i) => {
    after(140 + i * 80, () => countUp(n, M.impulse));
  });
  // 作者卡 / 年卡接力
  sec.querySelectorAll<HTMLElement>('.bz-rr-author-card, .bz-rr-year-cell').forEach((c, i) => {
    track(waapi(c,
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 100 + Math.min(i, 8) * 60, easing: E.out, fill: 'backwards' }));
  });
}

/** 热力图翻月：新月份格子快速波浪点亮（navHeatmap 重渲 body 后由 ui.ts 调） */
export function motionHeatmapNav(body: HTMLElement | null): void {
  if (!body || reduced()) return;
  body.querySelectorAll<HTMLElement>('.bz-rr-hm-cell--data').forEach((cell, i) => {
    track(waapi(cell,
      [{ opacity: .05, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: M.fast + 60, delay: Math.min(i, 42) * 9, easing: E.out, fill: 'backwards' }));
  });
}

/** 年卡展开：12 月柱次第长出（收起不演——合上是安静的） */
export function motionYearToggle(body: HTMLElement | null): void {
  if (!body || !body.classList.contains('open') || reduced()) return;
  body.querySelectorAll<HTMLElement>('.bz-rr-mbar').forEach((col, i) => {
    track(waapi(col,
      [{ transform: 'scaleY(0)', transformOrigin: '50% 100%' },
       { transform: 'scaleY(1)', transformOrigin: '50% 100%' }],
      { duration: M.base, delay: i * 26, easing: E.out, fill: 'backwards' }));
  });
}

/* ================= 读书笔记弹窗：批注墨迹接力 ================= */

/** 划线 / 批注按文档序接力浮现（标题先行；长列表 cap 14 防拖沓） */
export function motionNotesList(body: HTMLElement): void {
  if (!playable(body)) return;
  const blocks = body.querySelectorAll<HTMLElement>('.bz-bs-note-heading, .bz-bs-hl');
  blocks.forEach((el, i) => {
    if (i >= 14) return;
    track(waapi(el,
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 60 + i * (STAG + 5), easing: E.out, fill: 'backwards' }));
  });
}
