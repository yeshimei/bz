/**
 * 日记本动效层（2026-09-23 动效批，与 home/cinema 同台账同打法，语义按日记本自己的出招）。
 *
 * 语义词汇表（本域四种材料，不借其他域的特效）：
 *  - **纸（落纸）**：日记是一页页纸——卡片 / 时光条 / 弹层内容入场 = 一页纸轻轻落进本子
 *    （translateY + 微 blur 收清，不弹跳；纸是哑光的）。
 *  - **墨（墨迹）**：文字与日期是墨——书名与标题 blur 显影（墨迹未干）；搜索命中 = 墨闪；
 *    日期戳落下时纸面洇开一小撮墨晕（.bz-dm-ink 注入件，演完即撤）。
 *  - **翻页（page turn）**：筛选 / 日期切换 = 翻过一页——纸面（.bz-dm-page 注入件）带假透视
 *    从左扫到右，内容在纸页遮住墙面的瞬间换血；旧内容先墨隐。
 *  - **日历（calendar）**：日期节头 = 台历戳（自上而下盖印）；日期筛选弹窗 = 台历
 *    （年份签接力、月份格逐格翻落）；章节栏月份 = 书签签条依次插入。
 *  - 附：**显影（develop）**——照片从药水里浮出（blur + brightness 收清），用于墙内图片
 *    加载完成与灯箱加密媒体解出（cinema 海报淡入的日记本同位词）。
 *
 * 原则（对齐 home/motion.ts）：
 *  - **只动表现，不动布局**——注入件（翻页纸面 / 墨晕）全部 absolute + pointer-events:none +
 *    aria-hidden，演出完自动移除；入场只动 transform/opacity/filter，几何从不改写，
 *    终态 UI 与无动效版逐像素一致。
 *  - 台账对齐 cinema/motion.ts（issue 400 口径）：fast 160 / move 200 / base 280 /
 *    impulse 740，接力 30ms；揭示用 out 曲线，位移/翻页用 move 曲线。
 *  - reduced-motion（评审期口径）：默认**无视**系统设置放完整动画；?rm=1 显式模拟 RM
 *    （直达终态）。jsdom / 无 WAAPI 环境直达终态（内容已由渲染层落定），域内测试零感知。
 *  - 与渲染纯层解耦：render.ts markup 一字不改；本层只在 ui.ts / ui/dialogs.ts 的
 *    生命周期挂点被调用；禁 import obsidian / core 服务（纯浏览器 API，评审壳同跑）。
 *  - **boot 消费标志**：show() 置位（motionArmBoot），首个 renderWall 消费即熄
 *    （motionConsumeBoot）——写后回刷 / vault modify / 解锁重渲等非首次渲染静默不重播。
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

/** rAF 补间（翻页扫面用：要在过中线的那一拍 precisely 换血，WAAPI 拿不到进度回调） */
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
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** 延时调度（面板级取消，防快速刷新时编排叠加） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/* ================= boot 消费标志 ================= */

let bootArmed = false;

/** 面板打开（show）置位；首个渲染消费即熄——前后台刷新等非首次渲染静默不重播 */
export function motionArmBoot(): void {
  bootArmed = true;
}
/** 渲染层取走档位：true = 本次是打开后的首渲（可演全编排） */
export function motionConsumeBoot(): boolean {
  const was = bootArmed;
  bootArmed = false;
  return was;
}

/* ================= 面板壳：开 / 关 ================= */

/** 清宿主残留动画（退场 fill:forwards 的旧动画在新入场播完后会重新接管——不 cancel 就「重开即隐形」） */
function clearAnims(...els: (HTMLElement | null)[]): void {
  for (const el of els) {
    if (!el || typeof el.getAnimations !== 'function') continue;
    try { el.getAnimations().forEach((a) => a.cancel()); } catch { /* 不可取消环境忽略 */ }
  }
}

/**
 * 打开：根遮罩淡入（台灯亮起）。桌面卡自带的 CSS slide-up 是既有行为不重复演；
 * 内容编排归 motionRendered。重开走短档。
 */
export function motionPanelIn(root: HTMLElement, reopen: boolean): void {
  clearAnims(root); // 清上一次「合上本子」的退场残留（fill:forwards 会压过本次入场）
  root.style.opacity = ''; root.style.transform = ''; root.style.filter = '';
  const card = visibleCard(root);
  clearAnims(card);
  if (card) { card.style.opacity = ''; card.style.transform = ''; card.style.filter = ''; }
  waapi(root, [{ opacity: 0 }, { opacity: 1 }],
    { duration: reopen ? M.fast + 40 : M.base + 120, easing: E.out });
}

/**
 * 关闭 = 先演「合上本子」（卡体微微落回桌面 + 遮罩退光）再交还 display:none
 * （done 由调用方收口）。无 WAAPI（测试 / 老宿主）：同步收口，绝不让 display:none 晚到。
 */
export function motionPanelOut(root: HTMLElement, done: () => void): void {
  const card = visibleCard(root);
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    root.style.opacity = '';
    if (card) { card.style.opacity = ''; card.style.transform = ''; card.style.filter = ''; }
    done();
  };
  const a = waapi(root, [{ opacity: 1 }, { opacity: 0 }],
    { duration: M.move, easing: E.out, fill: 'forwards' });
  if (card) {
    waapi(card,
      [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
       { opacity: 0, transform: 'translateY(9px) scale(.99)', filter: 'blur(5px)' }],
      { duration: M.move + 40, easing: E.out, fill: 'forwards' });
  }
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  after(M.move + 200, finish); // 兜底：动画事件丢失也不能卡住关闭
}

/** 可见端实例卡（桌面卡 / 移动真全屏二取一；均不可见回落 null） */
function visibleCard(root: HTMLElement): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>('.bz-diary-desk, .bz-diary-mob')]
    .find((el) => el.clientWidth > 0) ?? null;
}

/* ================= 渲染完成：首屏编排 / 筛切编排 / 刷新静默 ================= */

export type DiaryMotionMode = 'boot' | 'switch' | 'none';

/**
 * 渲染编排。mode：
 *  - boot   首屏（打开面板后的首个渲染）：全套——书名墨迹显影、纸签/书签接力、
 *           台历戳 + 墨晕、卡片落纸、时光条横展；
 *  - switch 用户筛选切换（翻页后落定）：快速小步接力，不重演头行与章节栏；
 *  - none   后台刷新（写后回刷 / vault modify / 解锁重渲）：整屏不闪，零编排。
 * 所有入场用「delay + fill:backwards」的单次 WAAPI——排程期即处于首帧（透明），
 * 无「先见终态再闪回透明」的破绽，也不用为每张卡排 setTimeout。
 */
export function motionRendered(scope: HTMLElement, mode: DiaryMotionMode): void {
  cancelPending(); // 新渲染覆盖旧编排（对齐 home motionRendered / cinema clearSoftRender 口径）
  if (mode === 'none' || reduced()) return;
  const boot = mode === 'boot';

  /* —— 头行：书名墨迹显影 + 计数淡入（boot；switch 时头行没变，不抢戏）—— */
  if (boot) {
    const bookname = scope.querySelector<HTMLElement>('.bz-diary-bookname');
    if (bookname) {
      waapi(bookname,
        [{ opacity: 0, transform: 'translateY(3px)', filter: 'blur(6px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base + 100, delay: 40, easing: E.out, fill: 'backwards' });
    }
    const range = scope.querySelector<HTMLElement>('.bz-diary-range');
    if (range) {
      waapi(range, [{ opacity: 0 }, { opacity: 1 }],
        { duration: M.base, delay: 180, easing: E.out, fill: 'backwards' });
    }
  }

  /* —— 类型签 / 二级签：纸签一枚枚摆上（switch 用快档小步）—— */
  const chips = [...scope.querySelectorAll<HTMLElement>('.bz-diary-chip, .bz-diary-subchip')];
  chips.forEach((el, i) => {
    if (i >= (boot ? 12 : 10)) return;
    waapi(el,
      [{ opacity: 0, transform: 'translateY(5px) scale(.92)', filter: 'blur(3px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: boot ? M.base : M.fast + 60, delay: boot ? 140 + i * STAG : 10 + i * 14, easing: E.out, fill: 'backwards' });
  });

  /* —— 章节栏：书签签条依次插入（boot；桌面才有章节栏）—— */
  if (boot) {
    const rail = scope.querySelector<HTMLElement>('.bz-rail-scroll');
    if (rail) {
      [...rail.children].forEach((el, i) => {
        if (i >= 16) return;
        waapi(el as HTMLElement,
          [{ opacity: 0, transform: 'translateX(-9px)', filter: 'blur(3px)' },
           { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
          { duration: M.base, delay: 200 + i * 24, easing: E.out, fill: 'backwards' });
      });
    }
  }

  const wall = scope.querySelector<HTMLElement>('.bz-diary-wall');
  if (!wall) return;
  clearAnims(wall); // 翻页墨隐（fill:forwards）被后台刷新打断时，不得压住重渲后的新内容

  /* —— 时光条（那年今天）：题行浮起 + 横滑条自左展开 + 卡片接力（boot）；switch 只快闪 —— */
  const mem = wall.querySelector<HTMLElement>('.bz-diary-memories');
  if (mem && boot) {
    const head = mem.querySelector<HTMLElement>('.bz-diary-memories-head');
    if (head) {
      waapi(head,
        [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: M.base, delay: 240, easing: E.out, fill: 'backwards' });
    }
    const row = mem.querySelector<HTMLElement>('.bz-diary-memories-row');
    if (row) {
      waapi(row,
        [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 -2% 0 0)' }],
        { duration: M.base + 160, delay: 300, easing: E.out, fill: 'backwards' });
      row.querySelectorAll<HTMLElement>('.bz-diary-memory').forEach((el, i) => {
        if (i >= 6) return;
        waapi(el,
          [{ opacity: 0, transform: 'translateX(-10px)', filter: 'blur(3px)' },
           { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
          { duration: M.base, delay: 380 + i * 60, easing: E.out, fill: 'backwards' });
      });
    }
  } else if (mem) {
    waapi(mem, [{ opacity: 0 }, { opacity: 1 }],
      { duration: M.fast + 40, delay: 30, easing: E.out, fill: 'backwards' });
  }

  /* —— 空态 / 错误态：一页白纸浮起 —— */
  const empty = wall.querySelector<HTMLElement>('.bz-empty');
  if (empty) {
    waapi(empty,
      [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(3px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, delay: boot ? 180 : 30, easing: E.out, fill: 'backwards' });
  }

  /* —— 日期节头：台历戳（自上而下盖印）+（boot）戳下时纸面洇墨 —— */
  [...wall.querySelectorAll<HTMLElement>('.bz-diary-day-head')].forEach((h, i) => {
    if (i >= (boot ? 8 : 5)) return;
    const delay = boot ? 300 + i * 70 : 40 + i * 40;
    waapi(h,
      [{ opacity: 0, transform: 'translateY(-7px) scale(1.04)', filter: 'blur(4px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, delay, easing: E.out, fill: 'backwards' });
    if (boot) after(delay + 150, () => inkBlot(h));
  });

  /* —— 卡片：落纸接力（超出上限的直接可见，不参与演出）—— */
  [...wall.querySelectorAll<HTMLElement>('.bz-diary-item')].forEach((el, i) => {
    if (i >= (boot ? 20 : 12)) return;
    waapi(el,
      [{ opacity: 0, transform: 'translateY(11px)', filter: 'blur(4px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base + 80, delay: boot ? 380 + i * 26 : 70 + i * 14, easing: E.out, fill: 'backwards' });
  });
}

/* ================= 翻页：筛选切换的换血编排 ================= */

/**
 * 用户筛选切换（chip / 二级签 / 日期筛选 / 清除）：旧墙先墨隐，一张纸面带假透视
 * 从左扫过面板，过中线遮住墙面的那一拍 rewrite()（markup 单源重建由 ui.ts 闭包提供），
 * 纸面扫走后新内容已以 switch 档接力落定。无 WAAPI / RM：同步 rewrite，内容绝不满天飞。
 * scope = 实例根（桌面卡 / 移动全屏），纸面盖住整个摊开的本子。
 */
export function motionPageTurn(scope: HTMLElement, wall: HTMLElement, rewrite: () => void): void {
  if (reduced() || typeof wall.animate !== 'function') { rewrite(); return; }
  cancelPending();
  activePage?.remove(); // 上一场翻页未收尾又被触发：先撕掉旧纸面（防僵尸注入件）
  /* 旧内容先墨隐（纸页过来前先「晕开」） */
  const out = waapi(wall,
    [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(5px)' }],
    { duration: M.fast + 20, easing: E.out, fill: 'forwards' });
  /* 纸面：假透视翻页扫面（tween 驱动——要在过中线的那一拍 precisely 换血） */
  const page = document.createElement('i');
  page.className = 'bz-dm-page';
  page.setAttribute('aria-hidden', 'true');
  scope.appendChild(page);
  activePage = page;
  let swapped = false;
  tween(M.impulse, (v) => {
    if (!page.isConnected) return;
    const p = v * 2 - 1; // -1 → 1
    page.style.opacity = String(Math.max(0, Math.sin(Math.min(1, v * 1.18) * Math.PI)));
    page.style.transform =
      `perspective(1100px) rotateY(${(-p * 34).toFixed(1)}deg) translateX(${(p * 74).toFixed(1)}%)`;
    if (!swapped && v >= 0.45) {
      swapped = true;
      if (out) out.cancel();
      wall.style.opacity = '';
      wall.style.filter = '';
      rewrite(); // 期间 motionRendered 的 cancelPending 不会波及本纸面：移除走下方 tween 终点
    }
    if (v >= 1) {
      page.remove();
      if (activePage === page) activePage = null;
    }
  }, easeInOut);
}

/** 在场的翻页纸面（同一时刻至多一张；重入即撕旧） */
let activePage: HTMLElement | null = null;

/* ================= 台历（日期筛选弹窗）：开 / 年内切年 / 关 ================= */

/** 打开：遮罩退光淡入 + 题头墨迹 + 年份签接力 + 月份格逐格翻落（impulse 级小台历）。
 *  light = 年内切年（弹窗重建但网格换血而已）：只把月份格重翻一遍，不重演题头与年份签。 */
export function motionDateFilterIn(wrap: HTMLElement, light: boolean): void {
  if (reduced()) return;
  const card = wrap.querySelector<HTMLElement>('.bz-diary-datefilter-card');
  if (!card) return;
  waapi(wrap, [{ opacity: 0 }, { opacity: 1 }],
    { duration: light ? M.fast : M.base, easing: E.out });
  if (light) { flipMonths(card, 40); return; }
  const title = card.querySelector<HTMLElement>('.bz-diary-datefilter-title');
  if (title) {
    waapi(title,
      [{ opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0px)' }],
      { duration: M.base, delay: 30, easing: E.out, fill: 'backwards' });
  }
  [...card.querySelectorAll<HTMLElement>('.bz-diary-datefilter-year')].forEach((el, i) => {
    if (i >= 10) return;
    waapi(el,
      [{ opacity: 0, transform: 'translateY(5px) scale(.92)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 90 + i * STAG, easing: E.out, fill: 'backwards' });
  });
  flipMonths(card, 200);
}

/** 月份格翻落：台历格自上而下放平（假透视 rotateX 归正），24ms 接力 */
function flipMonths(card: HTMLElement, base: number): void {
  [...card.querySelectorAll<HTMLElement>('.bz-diary-datefilter-month')].forEach((el, i) => {
    if (i >= 12) return;
    el.style.transformOrigin = '50% 0%';
    waapi(el,
      [{ opacity: 0, transform: 'perspective(700px) rotateX(-32deg) translateY(6px)' },
       { opacity: 1, transform: 'none' }],
      { duration: M.base + 60, delay: base + i * 24, easing: E.out, fill: 'backwards' });
  });
}

/** 关闭 = 台历合上（整卡微缩下沉 + 遮罩退光）再交 remove（done 由调用方收口） */
export function motionDateFilterOut(wrap: HTMLElement, done: () => void): void {
  const card = wrap.querySelector<HTMLElement>('.bz-diary-datefilter-card');
  if (!card) { done(); return; }
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    wrap.style.opacity = '';
    card.style.opacity = ''; card.style.transform = ''; card.style.filter = '';
    done();
  };
  const a = waapi(wrap, [{ opacity: 1 }, { opacity: 0 }],
    { duration: M.fast, easing: E.out, fill: 'forwards' });
  waapi(card,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(6px) scale(.98)', filter: 'blur(3px)' }],
    { duration: M.fast, easing: E.out, fill: 'forwards' });
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  after(M.fast + 140, finish);
}

/* ================= 章节栏 / 签条 / 日历戳：微反馈 ================= */

/** 签条按压回弹（chip / 二级签 / 章节月份通用；fast 档微反馈） */
export function motionChipPress(el: HTMLElement): void {
  waapi(el, [{ transform: 'scale(.94)' }, { transform: 'none' }],
    { duration: M.fast + 20, easing: E.out });
}

/** 锁定态「加密」签摇头（解锁被取消：纸页后的锁还扣着） */
export function motionChipDeny(el: HTMLElement): void {
  waapi(el,
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' },
     { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
    { duration: M.fast + 80, easing: E.out });
}

/** 章节月份签按压（点击即弹，滚动由既有 smooth 承担） */
export function motionMonthPress(el: HTMLElement): void {
  motionChipPress(el);
}

/** 目标日期节头重盖一次台历戳（章节跳转落定后：告诉你「就是这一页」） */
export function motionDayStamp(head: HTMLElement): void {
  if (reduced()) return;
  waapi(head,
    [{ transform: 'scale(1.03)', filter: 'blur(2px)' }, { transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base, easing: E.out });
  after(70, () => inkBlot(head));
}

/** 清除日期筛选胶囊：pop 入（首次出现才有，一处创建点调用） */
export function motionClearChip(el: HTMLElement): void {
  waapi(el, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }],
    { duration: M.fast + 40, easing: E.out });
}

/** 搜索命中 <mark>：墨闪一次（全文重建路径才有新 mark；增量显隐不重渲不播） */
export function motionMarks(container: HTMLElement): void {
  if (reduced()) return;
  container.querySelectorAll<HTMLElement>('mark.bz-diary-mark').forEach((el, i) => {
    if (i >= 6) return;
    waapi(el, [{ opacity: 0.25 }, { opacity: 1 }],
      { duration: M.fast + 60, delay: i * 40, easing: E.out });
  });
}

/** 搜索行展开：纸条从头行下方滑出（收起是 display:none 直收，不演） */
export function motionSearchRow(row: HTMLElement): void {
  waapi(row,
    [{ opacity: 0, transform: 'translateY(-5px)', filter: 'blur(3px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.move, easing: E.out });
}

/* ================= 显影（develop）：照片从药水里浮出 ================= */

/** 墙内图片加载完成 / 灯箱加密媒体解出：blur + 微缩放收清（调用方已落终态 inline，动画盖在其上） */
export function motionDevelop(el: HTMLElement): void {
  waapi(el,
    [{ opacity: 0, filter: 'blur(9px) brightness(1.05)', transform: 'scale(1.02)' },
     { opacity: 1, filter: 'blur(0px) brightness(1)', transform: 'none' }],
    { duration: M.base + 160, easing: E.out });
}

/* ================= 灯箱：开（显影 / 方向性滑入）/ 关 ================= */

/**
 * 灯箱内容呈现：dir = 0 开箱（媒体显影 + 题注墨迹浮起）；±1 步进（方向性滑入）。
 * 顺带清退场残留（fill:forwards / 关箱未竟的内联态）。
 */
export function motionLightboxShow(
  lb: HTMLElement, box: HTMLElement, cap: HTMLElement | null, sub: HTMLElement | null, dir: number,
): void {
  clearAnims(lb); // 清上一次「合箱」的退场残留（lb 元素跨开关复用）
  lb.style.opacity = ''; lb.style.transform = ''; lb.style.filter = '';
  const media = box.querySelector<HTMLElement>('.bz-diary-lb-media');
  if (media) {
    const enter: Keyframe[] = dir === 0
      ? [{ opacity: 0, transform: 'scale(.965)', filter: 'blur(8px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }]
      : [{ opacity: 0, transform: `translateX(${dir * 26}px)`, filter: 'blur(5px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }];
    waapi(media, enter, { duration: dir === 0 ? M.base + 140 : M.move + 60, easing: E.out });
  }
  const pending = box.querySelector<HTMLElement>('.bz-diary-lb-pending');
  if (pending) waapi(pending, [{ opacity: 0 }, { opacity: 1 }], { duration: M.fast, easing: E.out });
  ([cap, sub].filter((x): x is HTMLElement => !!x)).forEach((el, i) => {
    waapi(el,
      [{ opacity: 0, transform: 'translateY(5px)', filter: 'blur(3px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, delay: 60 + i * 40, easing: E.out, fill: 'backwards' });
  });
}

/** 关箱 = 先退光再交 class 摘除与内容清空（done 由调用方收口；重开竞态由调用方代次兜住） */
export function motionLightboxOut(lb: HTMLElement, done: () => void): void {
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    lb.style.opacity = ''; lb.style.transform = ''; lb.style.filter = '';
    done();
  };
  const a = waapi(lb,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'scale(.985)', filter: 'blur(4px)' }],
    { duration: M.move, easing: E.out, fill: 'forwards' });
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  after(M.move + 160, finish);
}

/* ================= 弹窗内编排（写日记 / 标签选择器：纸页展开 + 章签摆上） ================= */

/** uiModal 壳归 core（域内不动）；只编排域内表单内容：字段行落纸接力 + 类型章签一枚枚摆上 */
export function motionSheetDialog(popup: HTMLElement): void {
  if (reduced()) return;
  const form = popup.querySelector<HTMLElement>('.bz-diary-form');
  if (!form) return;
  [...form.children].forEach((el, i) => {
    if (i >= 6) return;
    waapi(el as HTMLElement,
      [{ opacity: 0, transform: 'translateY(7px)', filter: 'blur(3px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, delay: 40 + i * 50, easing: E.out, fill: 'backwards' });
  });
  popup.querySelectorAll<HTMLElement>('.diary-tag-selector-btn').forEach((el, i) => {
    if (i >= 14) return;
    waapi(el,
      [{ opacity: 0, transform: 'translateY(4px) scale(.94)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: 150 + i * 18, easing: E.out, fill: 'backwards' });
  });
}

/* ================= 骨架 / 墨晕 ================= */

/** 墙区骨架浮现（读盘期的「正在翻日记…」；shimmer 循环是既有 CSS 功能指示，不动） */
export function motionSkeleton(box: HTMLElement): void {
  waapi(box, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.fast + 40, easing: E.out });
}

/**
 * 墨晕：台历戳落下时在日期下洇开的一小撮墨（.bz-dm-ink 注入件，演完即撤；
 * 终态墙上不留任何痕迹）。宿主 = 日期节头（sticky 自带定位上下文）。
 */
function inkBlot(head: HTMLElement): void {
  if (reduced() || !head.isConnected) return;
  const date = head.querySelector<HTMLElement>('.bz-diary-day-date');
  const dot = document.createElement('i');
  dot.className = 'bz-dm-ink';
  dot.setAttribute('aria-hidden', 'true');
  dot.style.left = `${date ? date.offsetWidth / 2 : 20}px`;
  dot.style.top = `${head.offsetHeight / 2}px`;
  head.appendChild(dot);
  waapi(dot,
    [{ opacity: 0, transform: 'scale(.5)' },
     { opacity: 0.5, transform: 'scale(1)', offset: 0.45 },
     { opacity: 0, transform: 'scale(1.8)' }],
    { duration: M.base + 240, easing: E.out });
  after(M.base + 300, () => dot.remove());
}

/* ================= 清场 ================= */

/** 面板卸载（cleanup）：摘全部延时编排 + 复位 boot 标志（rAF 补间自随节点断连熄火） */
export function motionTeardown(): void {
  cancelPending();
  bootArmed = false;
}

/* ================= 评审便利：#replay 重播首屏编排（快速原型批；插件内同样无害） =================
   壳在页面加载时就跑 openPanel，编排可能发生在你看到页面之前——带 #replay 打开（或刷新）
   会在 0.6s 后重播一次：面板唤醒 + 内容全编排。ui.ts 在 ensureElements 里挂 __bzDiaryReplay。 */
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#replay') return;
    location.hash = '';
    const replay = (window as unknown as Record<string, unknown>).__bzDiaryReplay as (() => void) | undefined;
    if (typeof replay === 'function') setTimeout(replay, 600);
  });
  if (location.hash === '#replay') {
    // 首载即带 hash：hashchange 不会自发触发，等 ui 挂好钩子后播一次
    const wait = (): void => {
      const replay = (window as unknown as Record<string, unknown>).__bzDiaryReplay as (() => void) | undefined;
      if (typeof replay === 'function') { location.hash = ''; setTimeout(replay, 600); }
      else setTimeout(wait, 120);
    };
    setTimeout(wait, 120);
  }
}
