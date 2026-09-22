/**
 * 剪藏本动效层（2026-09-22 快速原型批，对齐 issue 400 台账口径；与 cinema/memo/home 同量级）。
 *
 * 语义词汇表（剪藏本自己的话——剪报 / 纸张 / 印刷，不借其他域的特效）：
 *   开印     boot 编排：一期剪报付印——刊名落墨、期号浮出、头行下压一条版线（ink rule 画线）
 *   排字     rail 点线索引自左向右擦出（clip-path 裁切 = 排字机走纸）；目录序号「落号」
 *            （号码机盖下去：scale 1.7 → 1 + 微转）；目录条目接力上浮
 *   上版     首篇上文：右栏纸页落版（perspective rotateX settle）+ 标题滚印（左→右 wipe）
 *            + 摘要奶油底荧光划过 + 正文显影
 *   翻面     换篇（点目录 / jk / ←→ / 处理后前进）：右栏纸页沿阅读方向翻落
 *   裁切     clip-path 揭出系：折叠段（已读/已收）自上而下揭出；检索重排时列表微沉降
 *   剪走     删除条目：剪报被剪下带走——卡片克隆成纸片，向左（rail / 剪藏本方向）滑出消散
 *   钤收     保存入册：卡片右上「收」章盖下（scale 2.1 → 1 落章 → 停 → 提起消散）
 *   勾销     标记已读：标题一道墨线划过（native 灰显是终态，墨线只负责那一下演出）
 *   入屏     移动详情翻入（右→左落页）；报告弹层升帘 + 逐段落版（条形横扫 / 柱形拔起）
 *
 * 原则（与 home/motion.ts 同纪律）：
 *  - 只动表现不动布局：注入件全部 absolute/fixed + pointer-events:none + aria-hidden，
 *    演出完移除；只动 transform/opacity/filter（+ clip-path 揭出，终态恒为自然态）。
 *  - 台账（issue 400）：fast 160 / move 200 / base 280 / impulse 740，接力 30ms；
 *    揭示用 out 曲线，位移与冲量用 move 曲线。
 *  - reduced-motion（评审期口径）：默认无视系统「减少动态效果」放完整演出；
 *    ?rm=1 显式直达终态。无 WAAPI 宿主（jsdom / 老壳）零注入零内联——DOM 与今日全同。
 *  - markup 单源 render.ts 一字不改；本层只被 ui.ts / report-ui.ts 生命周期挂点调用。
 *  - 非首次渲染（前后台刷新 reloadIfOpen）静默：mood 由 ui.ts 按触发源给出。
 */

/* ================= 台账与口径 ================= */

const M = { fast: 160, move: 200, base: 280, impulse: 740 } as const;
const E = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
} as const;
const STAG = 30;

/** 渲染心境（ui.ts 按触发源给出；boot = 开印编排，其余轻反馈或不演） */
export type MotionMood = 'boot' | 'nav' | 'search' | 'mute';

/** 翻面方向（stepArticle 步进给出；点选默认向前） */
export type TurnDir = 'first' | 'fwd' | 'back' | null;

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，见文件头）。 */
function reduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}
/** 真实动画宿主判定：jsdom / 无 WAAPI 环境零注入零内联（测试与终态零感知） */
function canAnimate(): boolean {
  return !reduced() && typeof document !== 'undefined'
    && typeof HTMLElement !== 'undefined'
    && typeof HTMLElement.prototype.animate === 'function';
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

/** rAF 补间（版线画线这类要逐帧改值的演出用） */
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
const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

/** 延时调度（面板级取消，防快速刷新时演出叠加） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  if (typeof setTimeout !== 'function') return;
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
/** 面板关闭/卸载清场（ui.ts unloadPanel 调用）：取消待演 + 在演面板壳动画 */
export function motionTeardown(): void {
  timers.forEach(clearTimeout); timers.clear();
  try { panelAnim?.cancel(); } catch { /* 已结束 */ }
  panelAnim = null;
}

/* ================= 揭出原语 sweep ================= */

/** 动画属性 → CSS 属性名（内联清理用；终态清理保证「关演出后 DOM 与今日全同」） */
const CSS_PROP: Record<string, string> = {
  opacity: 'opacity', transform: 'transform', filter: 'filter',
  clipPath: 'clip-path', transformOrigin: 'transform-origin', willChange: 'will-change',
};

/**
 * 揭出：首帧经 WAAPI fill:backwards 在 delay 期间生效（不预藏内联，杜绝闪现），
 * 结束即清内联回自然态——终态 UI 与今日逐像素一致。
 * to 帧必须是自然态（opacity 1 / transform none / clip-path 全开）。
 */
function sweep(el: HTMLElement | null, from: Keyframe, to: Keyframe, opts: { delay?: number; dur?: number; easing?: string; origin?: string } = {}): void {
  if (!el || !canAnimate()) return;
  const { delay = 0, dur = M.base, easing = E.out, origin } = opts;
  if (origin) el.style.transformOrigin = origin;
  el.style.willChange = 'transform,opacity,filter';
  let a: Animation | null = null;
  try { a = el.animate([from, to], { duration: dur, delay, easing, fill: 'backwards' }); } catch { a = null; }
  if (!a) { // 起播失败：立刻清内联，不留半演残迹
    cleanSweep(el, from, to, !!origin);
    return;
  }
  const done = (): void => { cleanSweep(el, from, to, !!origin); try { a!.cancel(); } catch { /* 已结束 */ } };
  a.finished.then(done).catch(done);
}
function cleanSweep(el: HTMLElement, from: Keyframe, to: Keyframe, hadOrigin: boolean): void {
  const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
  if (hadOrigin) keys.add('transformOrigin');
  keys.add('willChange');
  for (const k of keys) {
    if (k === 'offset' || k === 'easing' || k === 'composite') continue;
    const css = CSS_PROP[k] || k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    try { el.style.removeProperty(css); } catch { /* 忽略 */ }
  }
}

/* ================= 面板壳：开 / 关 ================= */

let panelAnim: Animation | null = null;

/** 面板壳入场（首开慢一些给足开印时间；重开快速唤回）。清退场残留防抖。 */
export function motionPanelIn(overlay: HTMLElement, reopen: boolean): void {
  const frame = overlay.querySelector<HTMLElement>('.bz-clip-frame');
  if (!frame) return;
  try { panelAnim?.cancel(); } catch { /* 已结束 */ }
  panelAnim = null;
  frame.style.opacity = ''; frame.style.transform = ''; frame.style.filter = ''; // 清退场残留
  if (!overlay.style.opacity) overlay.style.opacity = '0';
  waapi(overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: M.fast + 40, easing: E.out });
  const a = waapi(frame,
    [{ opacity: 0, transform: 'translateY(14px) scale(.985)', filter: 'blur(8px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: reopen ? M.base + 20 : 480, easing: E.out });
  if (a) {
    panelAnim = a;
    a.finished.then(() => {
      if (panelAnim === a) panelAnim = null;
      overlay.style.opacity = '';
      frame.style.opacity = ''; frame.style.transform = ''; frame.style.filter = '';
    }).catch(() => { overlay.style.opacity = ''; });
  } else {
    overlay.style.opacity = '';
  }
}

/**
 * 关闭 = 先演 240ms 退场再交还 display:none（done 由调用方收口，判 M.open 防重开竞态）。
 * 宿主不支持 WAAPI（测试 / 老宿主）：同步收口，绝不让 display:none 晚到。
 */
export function motionPanelOut(overlay: HTMLElement, done: () => void): void {
  const frame = overlay.querySelector<HTMLElement>('.bz-clip-frame');
  if (!frame) { done(); return; }
  let finished = false;
  const finish = (): void => { if (!finished) { finished = true; panelAnim = null; done(); } };
  try { panelAnim?.cancel(); } catch { /* 已结束 */ }
  const a = waapi(frame,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(10px) scale(.985)', filter: 'blur(6px)' }],
    { duration: M.move + 40, easing: E.out, fill: 'forwards' });
  waapi(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: M.move + 40, easing: E.out });
  if (!a) { overlay.style.opacity = ''; finish(); return; }
  panelAnim = a;
  a.finished.then(() => { overlay.style.opacity = ''; finish(); }).catch(() => { overlay.style.opacity = ''; finish(); });
  after(M.move + 200, finish); // 兜底：动画事件丢失也不能卡住关闭
}

/* ================= 开印：头行（刊名 / 期号 / 版线） ================= */

/** 头行开印（boot 专属）：刊名落墨、期号浮出、下缘 2px 版线自左向右压印后隐去（原生 border 恒在）。 */
export function motionHeadRevealed(overlay: HTMLElement): void {
  const head = overlay.querySelector<HTMLElement>('.bz-clip-desk .bz-panel-head');
  if (!head || head.offsetParent === null) return; // 移动视口桌面头行不可见，不演
  const title = head.querySelector<HTMLElement>('.bz-panel-title');
  const issue = head.querySelector<HTMLElement>('[data-clip-issue]');
  sweep(title, { opacity: 0, transform: 'translateY(7px)', filter: 'blur(5px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }, { delay: 60, dur: M.base + 40 });
  sweep(issue, { opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }, { delay: 150, dur: M.base });

  // 版线：注入绝对定位线（与原生 border 同几何同色），画完隐去即移除——终态回到纯 border
  if (!canAnimate() || head.querySelector(':scope > .bz-clm-ink-rule')) return;
  const prevStyle = head.getAttribute('style');
  const rule = document.createElement('span');
  rule.className = 'bz-clm-ink-rule';
  rule.setAttribute('aria-hidden', 'true');
  head.appendChild(rule);
  if (getComputedStyle(head).position === 'static') head.style.position = 'relative';
  tween(620, (v) => { rule.style.transform = `scaleX(${Math.max(.001, v).toFixed(3)})`; }, easeOutQuart);
  after(700, () => {
    const fade = waapi(rule, [{ opacity: .95 }, { opacity: 0 }], { duration: M.base - 80, easing: E.out });
    const remove = (): void => {
      rule.remove();
      if (prevStyle === null) head.removeAttribute('style'); else head.setAttribute('style', prevStyle);
    };
    if (fade) fade.finished.then(remove).catch(remove); else after(M.base, remove);
  });
}

/* ================= 左 rail：点线索引排字 ================= */

/** rail 渲染后：boot = 「SITE 站点」标签 + 行自左向右擦出（排字）+ 脚注浮出；
 *  nav = 选中行轻按压一下；search/mute 不演。 */
export function motionRailRendered(railEl: HTMLElement, mood: MotionMood): void {
  if (mood === 'boot') {
    const label = railEl.parentElement ? railEl.parentElement.querySelector<HTMLElement>('.bz-clip-rail-label') : null;
    sweep(label, { opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }, { delay: 140, dur: M.base - 60 });
    const rows = [...railEl.querySelectorAll<HTMLElement>('.bz-rail-item')];
    rows.slice(0, 12).forEach((row, i) => {
      sweep(row,
        { opacity: 0, transform: 'translateX(-8px)', clipPath: 'inset(0 100% 0 0)' },
        { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' },
        { delay: 220 + i * STAG, dur: M.base + 60 });
    });
    const foot = railEl.parentElement ? railEl.parentElement.querySelector<HTMLElement>('.bz-clip-rail-foot') : null;
    sweep(foot, { opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }, { delay: 240 + Math.min(rows.length, 12) * STAG + 40, dur: M.base });
    return;
  }
  if (mood === 'nav') {
    const on = railEl.querySelector<HTMLElement>('.bz-rail-item.on');
    sweep(on, { transform: 'scale(.985)' }, { transform: 'none' }, { dur: M.fast });
  }
}

/* ================= 中栏目录：排字 / 落号 / 折叠揭出 / 检索沉降 ================= */

/** 目录渲染后：
 *  - boot：条目接力上浮（cap 14）+ 序号「落号」（号码机盖下）+ 已自动展开的折叠段揭出；
 *  - nav：换源轻排字（cap 8，更快）；search：列表微沉降（检索重排的一口气）；mute 不演；
 *  - foldKind：刚切换的桌面折叠段（toggle 后重渲）自上而下裁切揭出；
 *  - pressed：换选（点卡片 / jk）时当前卡轻按压。 */
export function motionListRendered(
  listEl: HTMLElement,
  mood: MotionMood,
  foldKind: 'read' | 'saved' | null,
  pressed: boolean,
): void {
  if (mood === 'boot' || mood === 'nav') {
    const boot = mood === 'boot';
    const rows = [...listEl.querySelectorAll<HTMLElement>('.bz-clip-item, .bz-clip-desk-fold')];
    const cap = boot ? 14 : 8;
    rows.slice(0, cap).forEach((row, i) => {
      const delay = (boot ? 300 : 40) + i * STAG;
      sweep(row,
        { opacity: 0, transform: 'translateY(9px)', filter: 'blur(4px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
        { delay, dur: M.base + (boot ? 60 : 0) });
      // 序号落号：目录条目才带序号（折叠行没有）
      const no = row.classList.contains('bz-clip-item') ? row.querySelector<HTMLElement>('.bz-clip-no') : null;
      if (no) sweep(no, { opacity: 0, transform: 'scale(1.7) rotate(-9deg)' }, { opacity: 1, transform: 'none' }, { delay: delay + 70, dur: M.fast + 70, easing: E.move });
    });
    // boot 时自动展开的折叠段体（若有）随之揭出（不在 cap 内也演，内容已由行级接力覆盖一半）
    if (boot) {
      listEl.querySelectorAll<HTMLElement>('.bz-clip-desk-fold-body:not([hidden])').forEach((body, i) => {
        sweep(body, { opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }, { delay: 420 + i * 80, dur: M.base + 80 });
      });
    }
    return;
  }
  if (mood === 'search') {
    sweep(listEl, { opacity: .45, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }, { dur: M.fast + 60 });
    return;
  }
  if (foldKind) {
    // 手动展开的折叠段：找到对应 on 行后的可见段体裁切揭出
    const row = listEl.querySelector<HTMLElement>(`.bz-clip-desk-fold[data-desk-fold="${foldKind}"].on`);
    const body = row ? (row.nextElementSibling as HTMLElement | null) : null;
    if (body && body.classList.contains('bz-clip-desk-fold-body') && !body.hidden) {
      sweep(body, { opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }, { dur: M.move + 60 });
    }
  }
  if (pressed) {
    const on = listEl.querySelector<HTMLElement>('.bz-clip-item.on');
    sweep(on, { transform: 'scale(.988)' }, { transform: 'none' }, { dur: M.fast });
  }
  if (!listEl.querySelector('.bz-clip-item') && !listEl.querySelector('.bz-clip-desk-fold')) {
    // 空态（uiEmpty）：nav 换源到空源 / 错误态时轻浮出
    sweep(listEl.querySelector<HTMLElement>('.bz-empty'), { opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }, { dur: M.base - 40 });
  }
}

/* ================= 右栏阅读：上版 / 翻面 ================= */

let readerAnim: Animation | null = null;

/** 右栏渲染后（换篇才演；同篇刷新 / 后台刷新静默）：
 *  - first（上版）：纸页落版 + 标题滚印 + meta 浮出 + 摘要荧光划过 + 正文显影 + 笔记脚浮出；
 *  - fwd/back（翻面）：整页沿阅读方向翻落（上缘轴向前篇 / 下缘轴向后篇）。 */
export function motionReaderRendered(readerEl: HTMLElement, turn: TurnDir, mood: MotionMood): void {
  try { readerAnim?.cancel(); } catch { /* 已结束 */ }
  readerAnim = null;
  if (!turn) {
    if (mood === 'boot') sweep(readerEl.querySelector<HTMLElement>('.bz-empty'), { opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }, { dur: M.base - 40 });
    return;
  }
  if (turn === 'first') {
    const from: Keyframe = { opacity: .25, transform: 'perspective(1100px) rotateX(6deg) translateY(10px)', filter: 'blur(2px)' };
    let a: Animation | null = null;
    if (canAnimate()) {
      readerEl.style.transformOrigin = '50% 0';
      a = waapi(readerEl, [from, { opacity: 1, transform: 'none', filter: 'blur(0px)' }], { duration: M.base + 80, easing: E.out });
      if (a) {
        readerAnim = a;
        const done = (): void => {
          readerEl.style.transformOrigin = ''; readerEl.style.willChange = '';
          try { a!.cancel(); } catch { /* 已结束 */ }
          if (readerAnim === a) readerAnim = null;
        };
        a.finished.then(done).catch(done);
      }
    }
    // 内容接力：标题滚印（左→右 wipe，印刷机吐头版）
    const title = readerEl.querySelector<HTMLElement>('.bz-clip-art-title');
    sweep(title,
      { opacity: 0, transform: 'translateY(6px)', clipPath: 'inset(0 100% 0 0)' },
      { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' },
      { delay: 90, dur: M.base + 60 });
    sweep(readerEl.querySelector<HTMLElement>('.bz-clip-art-meta'), { opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }, { delay: 170, dur: M.base - 40 });
    const tags = readerEl.querySelector<HTMLElement>('.bz-clip-art-tags');
    sweep(tags, { opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }, { delay: 210, dur: M.base - 60 });
    // 摘要：奶油底荧光笔划过
    sweep(readerEl.querySelector<HTMLElement>('.bz-clip-art-sum'),
      { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
      { opacity: 1, clipPath: 'inset(0 0 0 0)' },
      { delay: 250, dur: M.base + 40 });
    sweep(readerEl.querySelector<HTMLElement>('[data-clip-md]'), { opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }, { delay: 320, dur: M.base + 60 });
    sweep(readerEl.querySelector<HTMLElement>('.bz-clip-art-foot'), { opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }, { delay: 400, dur: M.base - 40 });
    return;
  }
  // 翻面：换篇（向前 = 绕上缘落版；向后 = 绕下缘翻回）
  const rx = turn === 'back' ? -5 : 5;
  const oy = turn === 'back' ? '100%' : '0';
  let a: Animation | null = null;
  if (canAnimate()) {
    readerEl.style.transformOrigin = `50% ${oy}`;
    a = waapi(readerEl,
      [{ opacity: .3, transform: `perspective(1100px) rotateX(${rx}deg) translateY(${turn === 'back' ? -6 : 6}px)` },
       { opacity: 1, transform: 'none' }],
      { duration: M.move + 60, easing: E.out });
    if (a) {
      readerAnim = a;
      const done = (): void => {
        readerEl.style.transformOrigin = ''; readerEl.style.willChange = '';
        try { a!.cancel(); } catch { /* 已结束 */ }
        if (readerAnim === a) readerAnim = null;
      };
      a.finished.then(done).catch(done);
    }
  }
}

/* ================= 移动端：章目录 / 折叠 / 详情入屏 / 搜索栏 ================= */

/** 移动章目录渲染后：boot = 章块接力浮出（cap 8）；search/mute 不演。 */
export function motionMobTocRendered(mobListEl: HTMLElement, mood: MotionMood): void {
  if (mood !== 'boot') return;
  [...mobListEl.querySelectorAll<HTMLElement>('.bz-clip-mob-ch')].slice(0, 8).forEach((ch, i) => {
    sweep(ch,
      { opacity: 0, transform: 'translateY(10px)', filter: 'blur(4px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      { delay: 200 + i * 60, dur: M.base + 40 });
  });
}

/** 移动折叠段展开（toggleMobArch 原位翻 hidden，无重渲）：段体裁切揭出。 */
export function motionMobFoldOpen(archEl: HTMLElement): void {
  sweep(archEl, { opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }, { dur: M.move + 40 });
}

/** 移动详情入屏（openMobDetail display:flex 后）：整页右→左落页 + 内容接力浮出。 */
export function motionMobDetailIn(detailEl: HTMLElement): void {
  let a: Animation | null = null;
  if (canAnimate()) {
    a = waapi(detailEl,
      [{ opacity: .4, transform: 'translateX(36px)', filter: 'blur(2px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.move + 60, easing: E.move });
    if (a) {
      const done = (): void => { detailEl.style.willChange = ''; try { a!.cancel(); } catch { /* 已结束 */ } };
      a.finished.then(done).catch(done);
    }
  }
  ['.bz-clip-mob-d-kicker', '.bz-clip-mob-d-title', '.bz-clip-mob-d-rule', '.bz-clip-mob-d-md', '.bz-clip-mob-d-foot']
    .forEach((sel, i) => {
      sweep(detailEl.querySelector<HTMLElement>(sel),
        { opacity: 0, transform: 'translateY(7px)' },
        { opacity: 1, transform: 'none' },
        { delay: 110 + i * 45, dur: M.base - 20 });
    });
}

/** 移动搜索栏展开（display:none → block 后）：下拉浮现。收起瞬时（与今日一致）。 */
export function motionMobSearchbarIn(barEl: HTMLElement): void {
  sweep(barEl, { opacity: 0, transform: 'translateY(-7px)' }, { opacity: 1, transform: 'none' }, { dur: M.fast + 40 });
}

/* ================= 划选 / 图片工具框 ================= */

/** 工具框浮现（placeSelBar 定位之后调；只动 opacity/transform，不碰 left/top）。 */
export function motionSelbarIn(barEl: HTMLElement): void {
  sweep(barEl, { opacity: 0, transform: 'translateY(5px) scale(.96)' }, { opacity: 1, transform: 'none' }, { dur: M.fast + 20 });
}

/* ================= 钤收 / 勾销 / 剪走（动作语义三件套） ================= */

/** 钤收（保存入册）：host（桌面卡片 / 移动详情正文体）右上盖「收」章——
 *  落章（scale 2.1 → 1）→ 停印 → 提起消散 → 注入件移除、host 内联还原。 */
export function motionArchStamp(host: HTMLElement | null): void {
  if (!host || !canAnimate() || host.querySelector(':scope > .bz-clm-stamp')) return;
  const prevStyle = host.getAttribute('style');
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const stamp = document.createElement('span');
  stamp.className = 'bz-clm-stamp';
  stamp.setAttribute('aria-hidden', 'true');
  stamp.textContent = '收';
  host.appendChild(stamp);
  const a = waapi(stamp,
    [
      { opacity: 0, transform: 'rotate(-14deg) scale(2.1)' },
      { opacity: .95, transform: 'rotate(-12deg) scale(1)', offset: .26 },
      { opacity: .95, transform: 'rotate(-12deg) scale(1)', offset: .74 },
      { opacity: 0, transform: 'rotate(-11deg) scale(1.06)' },
    ],
    { duration: M.impulse + 260, easing: E.move });
  const remove = (): void => {
    stamp.remove();
    if (prevStyle === null) host.removeAttribute('style'); else host.setAttribute('style', prevStyle);
  };
  if (a) a.finished.then(remove).catch(remove);
  else after(M.impulse + 280, remove);
}

/** 勾销（标记已读）：标题一道墨线划过（fast 划入 → 停 → 提笔淡出）。
 *  delay 供批量已读接力。native 灰显类是终态语义，墨线只负责演出。 */
export function motionInkStrike(titleEl: HTMLElement | null, delay = 0): void {
  if (!titleEl || !canAnimate() || titleEl.querySelector(':scope > .bz-clm-strike')) return;
  const prevStyle = titleEl.getAttribute('style');
  if (getComputedStyle(titleEl).position === 'static') titleEl.style.position = 'relative';
  const strike = document.createElement('span');
  strike.className = 'bz-clm-strike';
  strike.setAttribute('aria-hidden', 'true');
  titleEl.appendChild(strike);
  const a = waapi(strike,
    [
      { opacity: .9, transform: 'scaleX(0)' },
      { opacity: .9, transform: 'scaleX(1)', offset: .22 },
      { opacity: .9, transform: 'scaleX(1)', offset: .68 },
      { opacity: 0, transform: 'scaleX(1)' },
    ],
    { duration: 980, delay, easing: E.out });
  const remove = (): void => {
    strike.remove();
    if (prevStyle === null) titleEl.removeAttribute('style'); else titleEl.setAttribute('style', prevStyle);
  };
  if (a) a.finished.then(remove).catch(remove);
  else after(1000 + delay, remove);
}

/** 剪走（删除条目）：卡片克隆成纸片 ghost（fixed 同位覆盖），向左剪走消散；
 *  真卡片随刷新即刻离场，ghost 只补「那一下被剪下」的观感。宿主挂 .bz-clip-frame
 *  （稳定节点：listEl innerHTML 重渲不波及；域变量照常继承）。 */
export function motionSnipGhost(cardEl: HTMLElement | null): void {
  if (!cardEl || !canAnimate() || !cardEl.isConnected) return;
  const rect = cardEl.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return;
  const ghost = cardEl.cloneNode(true) as HTMLElement;
  ghost.classList.add('bz-clm-cutghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  const host = cardEl.closest('.bz-clip-frame') || document.body;
  host.appendChild(ghost);
  const a = waapi(ghost,
    [
      { opacity: 1, transform: 'none', filter: 'none' },
      { opacity: 1, transform: 'translate(-8px,-4px) rotate(-.6deg) scale(1.01)', offset: .28 },
      { opacity: 0, transform: 'translate(-70px,-16px) rotate(-3deg) scale(.96)', filter: 'blur(2px)' },
    ],
    { duration: M.impulse - 160, easing: E.move });
  const remove = (): void => ghost.remove();
  if (a) a.finished.then(remove).catch(remove);
  else after(M.impulse, remove);
}

/* ================= 阅读报告弹层：升帘 + 逐段落版 ================= */

/** 报告弹层入场（openClipbookReport display:flex 后）：遮罩快淡入 + 框体升帘。 */
export function motionReportIn(overlay: HTMLElement): void {
  const frame = overlay.querySelector<HTMLElement>('.bz-clip-report-frame');
  if (!frame) return;
  if (!overlay.style.opacity) overlay.style.opacity = '0';
  waapi(overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: M.fast + 40, easing: E.out });
  const a = waapi(frame,
    [{ opacity: 0, transform: 'translateY(16px) scale(.985)', filter: 'blur(6px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + 60, easing: E.out });
  const clear = (): void => { overlay.style.opacity = ''; };
  if (a) a.finished.then(clear).catch(clear); else clear();
}

/** 报告单段落版（renderBody 每段落进 DOM 后调）：段浮出 + 段内件接力——
 *  hero 三格弹起、Top5 接力、条形横扫（scaleX，origin left）、柱形拔起（scaleY，origin bottom）。 */
export function motionReportSection(secEl: Element | null, idx: number): void {
  const sec = secEl as HTMLElement | null;
  if (!sec || !canAnimate()) return;
  const base = idx * 50;
  sweep(sec, { opacity: 0, transform: 'translateY(10px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }, { delay: base, dur: M.base + 40 });
  sweep(sec.querySelector<HTMLElement>('.bz-clp-rep-sec-h'), { opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }, { delay: base + 80, dur: M.base - 40 });
  sec.querySelectorAll<HTMLElement>('.bz-clp-rep-hero-card').forEach((card, i) => {
    sweep(card, { opacity: 0, transform: 'translateY(8px) scale(.94)' }, { opacity: 1, transform: 'none' }, { delay: base + 140 + i * 60, dur: M.base - 20, easing: E.move });
  });
  sec.querySelectorAll<HTMLElement>('.bz-clp-rep-top-row').forEach((row, i) => {
    sweep(row, { opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }, { delay: base + 180 + Math.min(i, 5) * STAG, dur: M.base - 40 });
  });
  sec.querySelectorAll<HTMLElement>('.bz-clp-rep-bar-row').forEach((row, i) => {
    const bar = row.querySelector<HTMLElement>('.bz-clp-rep-bar-track i');
    sweep(bar,
      { transform: 'scaleX(0)' }, { transform: 'scaleX(1)' },
      { delay: base + 200 + Math.min(i, 8) * 40, dur: M.base + 80, easing: E.move, origin: 'left center' });
  });
  sec.querySelectorAll<HTMLElement>('.bz-clp-rep-hcol').forEach((col, i) => {
    const bar = col.querySelector<HTMLElement>('.bz-clp-rep-hbar');
    sweep(bar,
      { transform: 'scaleY(0)' }, { transform: 'scaleY(1)' },
      { delay: base + 200 + Math.min(i, 24) * 18, dur: M.base + 40, easing: E.move, origin: 'center bottom' });
  });
  sweep(sec.querySelector<HTMLElement>('.bz-clp-rep-hours-note'), { opacity: 0 }, { opacity: 1 }, { delay: base + 460, dur: M.base - 40 });
  sweep(sec.querySelector<HTMLElement>('.bz-clp-rep-none'), { opacity: 0 }, { opacity: 1 }, { delay: base + 120, dur: M.base - 40 });
}

/* ================= 功能性指示（加载类循环，不入台账） ================= */

/** 装载/统计占位呼吸（宿主被替换即随元素消亡，无需清理）。 */
export function motionLoadingPulse(el: HTMLElement | null): void {
  if (!el || reduced() || typeof el.animate !== 'function') return;
  try {
    el.animate([{ opacity: 1 }, { opacity: .45 }, { opacity: 1 }], { duration: 1400, iterations: Infinity, easing: 'ease-in-out' });
  } catch { /* 忽略 */ }
}
