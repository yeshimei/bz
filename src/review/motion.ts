/**
 * 复习计划动效层（2026-09-22 快速原型批，用户命题：全域动效·复习篇——
 * 每个舞台每个交互点全覆盖，按复习本自有语义出招，布局零改动）
 *
 * 原则：
 *  - **只动表现，不动布局**：注入件（朱批 / 涟漪环 / 光泽 / 红晕）全部绝对定位、
 *    aria-hidden、不吃事件；演出只动 transform/opacity/filter，几何从不改写；
 *    临时装饰演完自毁——终态 UI 与改造前完全一致。
 *  - 台账对齐 cinema/motion.ts（issue 400 口径）：fast 160 / move 200 / base 280 /
 *    impulse 740，接力 30ms；揭示用 out 曲线，位移用 move 曲线。
 *  - reduced-motion（评审期口径）：默认**无视**系统设置放完整动画——用户系统开着
 *    「减少动态效果」时按正式口径直达终态，评审者将什么都看不到；?rm=1 显式模拟
 *    RM 直达终态。正式版要不要让步系统 RM = 待拍板项。
 *  - 与渲染纯层解耦：render.ts markup 一字不改；本层只在 ui.ts / sprint.ts /
 *    stats-ui.ts / quiz-panel.ts / quiz-core/session.ts 的生命周期挂点被调用。
 *
 * 语义词汇表（复习本专属，不与他域共用）：
 *  - 发牌 deal-in：队列卡从状态条飞入三区列位（抽卡入列，逾期列最急先落）
 *  - 朱批盖章 seal：逾期卡「急」、结算屏「优/完成」——批改语义，落章驻留后自淡
 *  - 翻卡 flip：冲刺题卡 3D 翻面揭题（记忆卡语义）；做题家题面俯揭示题（区分风味）
 *  - 判定 judge：对=绿光掠过+对勾描线+正确项微弹；错=卡身震颤+红边洇墨+正确项揭示
 *  - 徽章检定 badge：结果卡对勾描线+光环迸发+评级胶囊盖章落定
 *  - 滚数 count-up：结果分/结算数/统计卡数字滚上去
 *  - 条浪 bar surge：统计条 scaleX 起浪（过冲曲线），逐行接力
 *  - 记忆回放 replay：复习历史圆点逐个点亮、竖线生长（回忆依次浮现）
 *  - 抽卡 draw：点到期卡=从列位抽走一张；开始本轮=状态条蓄力涟漪
 *  - 失利红晕 failflash：未通过会话中断前一记红晕（不阻断写盘流程）
 */

/* ================= 台账与口径 ================= */

const M = { fast: 160, move: 200, base: 280, impulse: 740 } as const;
const E = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
  /** 落章/落定带轻微过冲 */
  land: 'cubic-bezier(.2,.8,.3,1.18)',
} as const;
const STAG = 30;

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，见文件头）。 */
function reduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}

/** 安全 WAAPI：宿主不支持时不动（内容已由渲染层落终态，无编排即终态） */
function waapi(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || typeof el.animate !== 'function') return null;
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

/** 延时调度（带面板级取消，防视图重建后旧编排迟到落点） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/** 面板关闭/销毁清场（挂点：ui.hideMain/destroy、quiz-panel.hide） */
export function motionTeardown(): void {
  cancelPending();
}

/** static→relative：为绝对定位注入件提供定位上下文（无几何变化） */
function ensureRelative(el: HTMLElement): void {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
}

/* ================= 注入装饰件工厂 ================= */

/** 朱批印章：落章（impact 过冲）→ 驻留 → 淡出自毁。big = 结算屏大章。 */
function seal(host: HTMLElement, text: string, big = false): void {
  ensureRelative(host);
  const s = document.createElement('span');
  s.className = 'bz-rv-seal' + (big ? ' bz-rv-seal--big' : '');
  s.setAttribute('aria-hidden', 'true');
  s.textContent = text;
  host.appendChild(s);
  waapi(s,
    [{ opacity: 0, transform: 'rotate(-26deg) scale(2.6)' },
     { opacity: 1, transform: 'rotate(-12deg) scale(1)' }],
    { duration: big ? 260 : 210, easing: E.land, fill: 'both' });
  after(big ? 1500 : 1150, () => {
    waapi(s, [{ opacity: 1 }, { opacity: 0 }], { duration: 340, easing: E.out, fill: 'forwards' });
    after(360, () => s.remove());
  });
}

/** 涟漪环：自元素中心扩散一圈（绝对定位于 offsetParent，不越层不抢层级） */
function ringBurst(el: HTMLElement): void {
  const parent = el.offsetParent instanceof HTMLElement ? el.offsetParent : el.parentElement;
  if (!parent) return;
  const pr = parent.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const ring = document.createElement('i');
  ring.className = 'bz-rv-ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.style.left = (r.left - pr.left + r.width / 2) + 'px';
  ring.style.top = (r.top - pr.top + r.height / 2) + 'px';
  ring.style.width = Math.max(r.width, r.height) * 1.15 + 'px';
  ring.style.height = Math.max(r.width, r.height) * 1.15 + 'px';
  parent.appendChild(ring);
  const a = waapi(ring,
    [{ opacity: 0.85, transform: 'translate(-50%,-50%) scale(.45)' },
     { opacity: 0, transform: 'translate(-50%,-50%) scale(2.35)' }],
    { duration: 640, easing: E.out, fill: 'forwards' });
  const done = (): void => ring.remove();
  if (a) a.finished.then(done).catch(done);
  else after(680, done);
}

/** 光泽一扫：容器内一道高光横扫（注入层演完自毁） */
function sweep(host: HTMLElement): void {
  ensureRelative(host);
  const layer = document.createElement('i');
  layer.className = 'bz-rv-sweep';
  layer.setAttribute('aria-hidden', 'true');
  const band = document.createElement('u');
  layer.appendChild(band);
  host.appendChild(layer);
  const a = waapi(band,
    [{ transform: 'translateX(-150%) skewX(-18deg)' },
     { transform: 'translateX(340%) skewX(-18deg)' }],
    { duration: 840, easing: E.move, fill: 'forwards' });
  const done = (): void => layer.remove();
  if (a) a.finished.then(done).catch(done);
  else after(880, done);
}

/** SVG 描线：对勾等 stroke 自画（演完清内联，图标还原常态） */
function drawStroke(svg: Element, dur = 320): void {
  const parts = svg.querySelectorAll<SVGGeometryElement>('path,line,polyline,circle,rect');
  parts.forEach((p) => {
    try {
      const len = p.getTotalLength();
      if (!isFinite(len) || len <= 0) return;
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      const a = p.animate(
        [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: dur, easing: E.out, fill: 'forwards' });
      a.finished.then(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; })
        .catch(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
    } catch { /* 非 geometry/异常忽略，图标保持常态 */ }
  });
}

/** 数字滚升：节点首个数字段 tween（% 等后缀保留；非数字跳过） */
function countUpNode(el: HTMLElement, dur: number): void {
  const node = el.childNodes[0];
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  const raw = node.textContent || '';
  const m = raw.match(/\d[\d,]*/);
  if (!m) return;
  const target = Number(m[0].replace(/,/g, ''));
  if (!isFinite(target) || target === 0) return;
  tween(dur, (v) => {
    node.textContent = raw.replace(m[0], String(Math.round(target * v)));
  });
}

/** 弹跳 pop（计数/徽标落定） */
function popCnt(el: HTMLElement): void {
  waapi(el,
    [{ transform: 'scale(.4)', opacity: 0 },
     { transform: 'scale(1.18)', opacity: 1, offset: 0.7 },
     { transform: 'scale(1)', opacity: 1 }],
    { duration: 420, easing: E.out, fill: 'backwards' });
}

/* ================= 队列面板（三区） ================= */

/**
 * 队列首屏编排：面板光泽一扫 → 发牌入列（逾期列先落）→ 列头计数弹跳 →
 * 逾期卡朱批「急」→ 状态条/底部信息行收尾。刷新渲染不调用本函数（静默，E6 还原滚位焦点）。
 */
export function motionQueueBoot(container: HTMLElement): void {
  cancelPending();
  if (reduced()) return;
  const popup = container.closest<HTMLElement>('#review-popup');
  if (popup) sweep(popup);

  const strip = container.querySelector<HTMLElement>('.bz-q-strip');
  if (strip) {
    after(80, () => waapi(strip,
      [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out, fill: 'backwards' }));
    // 今日已清空的绿点：一圈涟漪贺清账
    const dot = strip.querySelector<HTMLElement>('.bz-q-strip-dot.ok');
    if (dot) after(420, () => ringBurst(dot));
  }

  // 发牌：卡序=列序（danger→warn→future，或归档单列），逐卡 52ms 接力，列间歇 120ms
  const cols = [...container.querySelectorAll<HTMLElement>('.bz-q-col')];
  let t = 160;
  const total = container.querySelectorAll('.bz-q-card').length;
  const step = total > 26 ? 24 : 52;
  let seals = 0;
  cols.forEach((col, ci) => {
    const cards = [...col.querySelectorAll<HTMLElement>('.bz-q-card')];
    const danger = col.classList.contains('danger');
    cards.forEach((card, cj) => {
      const rot = ((ci * 7 + cj * 13) % 5) - 2; // -2..2deg 确定性散布（发牌手感）
      const fromX = ci === 0 ? 16 : ci === 1 ? 0 : -16;
      const at = t;
      after(at, () => waapi(card,
        [{ opacity: 0, transform: `translate(${fromX}px,22px) rotate(${rot * 2}deg) scale(.9)` },
         { opacity: 1, transform: 'none' }],
        { duration: 340, easing: E.out, fill: 'backwards' }));
      if (danger && seals < 4) {
        seals++;
        after(at + 300, () => seal(card, '急'));
      }
      t += step;
    });
    const cnt = col.querySelector<HTMLElement>('.bz-q-col-head .cnt');
    if (cnt) after(Math.max(120, t - 30), () => popCnt(cnt));
    t += 120;
  });

  const footer = container.querySelector<HTMLElement>('.bz-q-footer');
  if (footer) after(t + 60, () => waapi(footer,
    [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.base, easing: E.out, fill: 'backwards' }));

  // 空库引导（uiEmpty 挂载件）淡现
  const empty = container.querySelector<HTMLElement>('[data-empty-host]');
  if (empty) after(200, () => waapi(empty,
    [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.impulse, easing: E.out, fill: 'backwards' }));
}

/** 「开始本轮」蓄力：按钮涟漪 + 脉冲（点按即出发的召唤感） */
export function motionChargeStrip(strip: HTMLElement): void {
  if (reduced()) return;
  const btn = strip.querySelector<HTMLElement>('[data-act="begin"]');
  const host = btn || strip;
  ringBurst(host);
  waapi(host,
    [{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }],
    { duration: 280, easing: E.out });
}

/** 抽卡：点到期卡开单条冲刺——先一记「抽走」手感再切题面 */
export function motionDrawCard(card: HTMLElement): void {
  if (reduced()) return;
  waapi(card,
    [{ transform: 'none', boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
     { transform: 'scale(.975) translateY(1px)', offset: 0.4 },
     { transform: 'scale(1.04) translateY(-3px)', boxShadow: '0 10px 24px rgba(0,0,0,.16)' }],
    { duration: 260, easing: E.out });
}

/* ================= 整窗冲刺 ================= */

/** 每篇开场：清题面指纹与遗留编排（showLoading 挂点） */
export function motionSprintReset(): void {
  lastQKey = '';
  cancelPending();
}

let lastQKey = '';

/** 出题加载态：轻浮起（spinner 自转已有 CSS） */
export function motionSprintLoading(host: HTMLElement): void {
  if (reduced()) return;
  const ld = host.querySelector<HTMLElement>('.bz-sprint-loading');
  if (ld) waapi(ld,
    [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.base, easing: E.out, fill: 'backwards' });
}

/**
 * 题面动效路由（renderQuestion 挂点，renderQuestion 每次作答态变化都会整壳重渲）：
 *  - 新题（题干指纹变化）：翻卡揭题 + 进度号弹跳 + 选项接力；
 *  - 同题判定（answered 翻转）：对=绿光掠过+对勾描线+正确项微弹；错=震颤+红边洇墨+揭示；
 *  - 同题未判定（多选勾选切换）：零编排。
 */
export function motionQuestion(
  host: HTMLElement,
  sig: { text: string; answered: boolean; correct: boolean },
): void {
  if (reduced()) return;
  const card = host.querySelector<HTMLElement>('.bz-sprint-qcard');
  if (!card) return;

  if (sig.text !== lastQKey) {
    lastQKey = sig.text;
    // 翻卡揭题（rotateY 3D 翻面=记忆卡语义）
    waapi(card,
      [{ opacity: 0, transform: 'perspective(900px) rotateY(-78deg) scale(.94)' },
       { opacity: 1, transform: 'perspective(900px) rotateY(0deg) scale(1)' }],
      { duration: 430, easing: E.out, fill: 'backwards' });
    const prog = host.querySelector<HTMLElement>('.bz-sprint-progress');
    if (prog) after(120, () => popCnt(prog));
    host.querySelectorAll<HTMLElement>('.bz-sprint-opt').forEach((el, i) => {
      after(150 + i * STAG, () => waapi(el,
        [{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }],
        { duration: M.base, easing: E.out, fill: 'backwards' }));
    });
    return;
  }
  if (!sig.answered) return; // 多选勾选切换：不重播

  if (sig.correct) {
    sweep(card); // 绿场高光一扫
    const okSvg = card.querySelector<HTMLElement>('.bz-sprint-opt.is-correct .bz-mark svg');
    if (okSvg) drawStroke(okSvg, 300);
    const okOpt = card.querySelector<HTMLElement>('.bz-sprint-opt.is-correct');
    if (okOpt) waapi(okOpt,
      [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }],
      { duration: 260, easing: E.out });
    return;
  }
  // 答错：卡身震颤 + 红边洇墨 + 正确项揭示脉冲 + 错选小颤
  waapi(card,
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)', offset: 0.15 },
     { transform: 'translateX(7px)', offset: 0.35 }, { transform: 'translateX(-5px)', offset: 0.55 },
     { transform: 'translateX(3px)', offset: 0.75 }, { transform: 'translateX(0)' }],
    { duration: 420, easing: 'ease-out' });
  waapi(card,
    [{ boxShadow: 'inset 0 0 0 0 rgba(0,0,0,0)' },
     { boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--bz-danger, #d64545) 55%, transparent)' },
     { boxShadow: 'inset 0 0 0 0 rgba(0,0,0,0)' }],
    { duration: 760, easing: E.out });
  const bad = card.querySelector<HTMLElement>('.bz-sprint-opt.is-wrong');
  if (bad) waapi(bad,
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }],
    { duration: 260, easing: 'ease-out' });
  const okOpt = card.querySelector<HTMLElement>('.bz-sprint-opt.is-correct');
  if (okOpt) waapi(okOpt,
    [{ boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
     { boxShadow: '0 0 0 3px color-mix(in srgb, var(--bz-success, #3a9e5f) 45%, transparent)' },
     { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }],
    { duration: 700, easing: E.out });
}

/** 未通过中断前一记红晕（不阻断写盘/打开原文流程，纯氛围） */
export function motionFailFlash(host: HTMLElement): void {
  if (reduced()) return;
  const target = host.closest<HTMLElement>('#review-popup') || host;
  ensureRelative(target);
  const v = document.createElement('i');
  v.className = 'bz-rv-failflash';
  v.setAttribute('aria-hidden', 'true');
  target.appendChild(v);
  const a = waapi(v,
    [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }],
    { duration: 620, easing: 'ease-out', fill: 'forwards' });
  const done = (): void => v.remove();
  if (a) a.finished.then(done).catch(done);
  else after(660, done);
}

/** 结果卡（通过态）：对勾描线+光环 → 分数滚升 → 评级胶囊盖章 → 按钮接力 */
export function motionResult(host: HTMLElement): void {
  if (reduced()) return;
  const res = host.querySelector<HTMLElement>('.bz-result');
  if (!res) return;
  const ic = res.querySelector<HTMLElement>('.bz-result-ic');
  const okSvg = ic?.querySelector('svg');
  if (okSvg) drawStroke(okSvg, 380);
  if (ic) after(60, () => ringBurst(ic));
  const score = res.querySelector<HTMLElement>('.bz-result-score');
  if (score) after(140, () => countUpNode(score, 620));
  const pill = res.querySelector<HTMLElement>('.bz-result-rating');
  if (pill) after(340, () => waapi(pill,
    [{ opacity: 0, transform: 'scale(1.8) rotate(-7deg)' }, { opacity: 1, transform: 'none' }],
    { duration: 280, easing: E.land, fill: 'backwards' }));
  res.querySelectorAll<HTMLElement>('.bz-btn').forEach((b, i) => {
    after(430 + i * 60, () => waapi(b,
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out, fill: 'backwards' }));
  });
}

/**
 * 结算屏：标题揭出 → 三数滚升接力 → 朱批大章（优/完成）→ 连续天数暖光 → 按钮收尾。
 * grade 由调用方按语义给：冲刺 failed===0 →「优」，否则「完成」；做题练习正确率≥90 →「优」。
 */
export function motionSummary(host: HTMLElement, grade: string): void {
  if (reduced()) return;
  const box = host.querySelector<HTMLElement>('.bz-summary');
  if (!box) return;
  const title = box.querySelector<HTMLElement>('.bz-summary-title');
  if (title) waapi(title,
    [{ opacity: 0, transform: 'translateY(-6px)', filter: 'blur(4px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base, easing: E.out, fill: 'backwards' });
  box.querySelectorAll<HTMLElement>('.bz-summary-stats .st b').forEach((b, i) => {
    after(120 + i * 90, () => { countUpNode(b, 560); popCnt(b); });
  });
  after(460, () => seal(box, grade, true));
  const tail = box.querySelector<HTMLElement>('.bz-summary-streak, .bz-qp-acc');
  if (tail) after(820, () => {
    waapi(tail,
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out, fill: 'backwards' });
    const b = tail.querySelector('b');
    if (b) waapi(b,
      [{ filter: 'drop-shadow(0 0 0 rgba(255,150,60,0))' },
       { filter: 'drop-shadow(0 0 9px rgba(255,150,60,.85))' },
       { filter: 'drop-shadow(0 0 2px rgba(255,150,60,.3))' }],
      { duration: 900, easing: E.out });
  });
  box.querySelectorAll<HTMLElement>('.bz-btn').forEach((b, i) => {
    after(900 + i * 70, () => waapi(b,
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out, fill: 'backwards' }));
  });
}

/* ================= 统计弹窗 / 复习历史 ================= */

/** 统计弹窗：光泽开场 → 统计卡接力+滚数 → 板块浮起 → 条浪 scaleX 起浪 → 时间线行接力 */
export function motionStats(body: HTMLElement): void {
  if (reduced()) return;
  sweep(body);
  body.querySelectorAll<HTMLElement>('.stat-card').forEach((card, i) => {
    after(60 + i * 60, () => {
      waapi(card,
        [{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }],
        { duration: M.base, easing: E.out, fill: 'backwards' });
      const v = card.querySelector<HTMLElement>('.v');
      if (v) countUpNode(v, 540);
    });
  });
  body.querySelectorAll<HTMLElement>('.sec').forEach((sec, i) => {
    after(240 + i * 80, () => waapi(sec,
      [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out, fill: 'backwards' }));
  });
  body.querySelectorAll<HTMLElement>('.soft-fill, .bar-fill').forEach((fill, i) => {
    after(380 + i * 45, () => {
      fill.style.transformOrigin = 'left center';
      waapi(fill,
        [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: 560, easing: 'cubic-bezier(.3,.9,.35,1.12)', fill: 'backwards' });
    });
  });
  body.querySelectorAll<HTMLElement>('.top-row').forEach((row, i) => {
    after(460 + i * 55, () => waapi(row,
      [{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out, fill: 'backwards' }));
  });
  const first = body.querySelector<HTMLElement>('.top-row.is-top');
  if (first) after(760, () => ringBurst(first));
  body.querySelectorAll<HTMLElement>('.kv-inline').forEach((kv, i) => {
    after(300 + i * 70, () => waapi(kv,
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: M.base, easing: E.out, fill: 'backwards' }));
  });
}

/** 复习历史：记忆回放——圆点逐个点亮、竖线生长、行浮现（依次想起） */
export function motionHistory(body: HTMLElement): void {
  if (reduced()) return;
  const status = body.querySelector<HTMLElement>('.bz-review-history-status');
  if (status) waapi(status,
    [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.base, easing: E.out, fill: 'backwards' });
  body.querySelectorAll<HTMLElement>('.bz-review-history-item').forEach((item, i) => {
    after(110 + i * 110, () => {
      const dot = item.querySelector<HTMLElement>('.bz-review-history-dot');
      if (dot) waapi(dot,
        [{ transform: 'scale(0)' }, { transform: 'scale(1.5)', offset: 0.7 }, { transform: 'scale(1)' }],
        { duration: 320, easing: E.out, fill: 'backwards' });
      const line = item.querySelector<HTMLElement>('.bz-review-history-line');
      if (line) {
        line.style.transformOrigin = 'top center';
        waapi(line,
          [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
          { duration: 230, easing: E.out, fill: 'backwards' });
      }
      const row = item.querySelector<HTMLElement>('.bz-review-history-row');
      if (row) waapi(row,
        [{ opacity: 0, transform: 'translateX(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: M.base, easing: E.out, fill: 'backwards' });
    });
  });
}

/* ================= 悬浮迷你评级条（普通复习路径） ================= */

/** 底部弹升（保留 translateX(-50%) 居中）+ 评级按钮接力 pop */
export function motionRatingBar(el: HTMLElement): void {
  if (reduced()) return;
  waapi(el,
    [{ opacity: 0, transform: 'translateX(-50%) translateY(60px)' },
     { opacity: 1, transform: 'translateX(-50%) translateY(0)' }],
    { duration: 420, easing: 'cubic-bezier(.22,.9,.32,1.15)', fill: 'backwards' });
  el.querySelectorAll<HTMLElement>('.bz-review-bar-btn').forEach((b, i) => {
    after(150 + i * STAG, () => popCnt(b));
  });
}

/* ================= 做题练习面板 ================= */

/** 设置视图：段选板块接力浮起 + meta/foot 淡入 + 开始钮蓄力涟漪 */
export function motionQuizSetup(content: HTMLElement): void {
  if (reduced()) return;
  content.querySelectorAll<HTMLElement>('.bz-qp-sec').forEach((sec, i) => {
    after(i * 90, () => waapi(sec,
      [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out, fill: 'backwards' }));
  });
  const meta = content.querySelector<HTMLElement>('.bz-qp-meta');
  if (meta) after(300, () => waapi(meta, [{ opacity: 0 }, { opacity: 1 }], { duration: M.base, easing: E.out, fill: 'backwards' }));
  const start = content.querySelector<HTMLElement>('.bz-qp-start');
  if (start) after(380, () => ringBurst(start));
  const foot = content.querySelector<HTMLElement>('.bz-qp-foot');
  if (foot) after(460, () => waapi(foot, [{ opacity: 0 }, { opacity: 1 }], { duration: M.base, easing: E.out, fill: 'backwards' }));
}

/** 做题练习成绩小结：复用结算编排（grade=正确率≥90 →「优」，否则「完成」由调用方给） */
export function motionQuizSummary(content: HTMLElement, grade: string): void {
  motionSummary(content, grade);
}

/* ================= 做题家（quiz-core 会话弹窗，做题练习同引擎复用） ================= */

/** 题面入场：题干俯揭示题（与冲刺的 rotateY 翻卡区分风味）+ 选项接力 */
export function motionQuizCard(popup: HTMLElement): void {
  if (reduced()) return;
  const q = popup.querySelector<HTMLElement>('.bz-quiz-question');
  if (q) waapi(q,
    [{ opacity: 0, transform: 'perspective(800px) rotateX(24deg) translateY(6px)', filter: 'blur(4px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 380, easing: E.out, fill: 'backwards' });
  popup.querySelectorAll<HTMLElement>('.quiz-option-btn').forEach((el, i) => {
    after(120 + i * STAG, () => waapi(el,
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, easing: E.out, fill: 'backwards' }));
  });
}

/** 判定（判后 classList 已挂 correct/wrong）：对=高光掠过+对勾弹跳；错=错选震颤+正确项揭示 */
export function motionQuizJudge(popup: HTMLElement, correct: boolean): void {
  if (reduced()) return;
  if (correct) {
    sweep(popup);
    const mark = popup.querySelector<HTMLElement>('.quiz-option-btn.correct .check-mark');
    if (mark) popCnt(mark);
    return;
  }
  const bad = popup.querySelector<HTMLElement>('.quiz-option-btn.wrong');
  if (bad) waapi(bad,
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }],
    { duration: 260, easing: 'ease-out' });
  const ok = popup.querySelector<HTMLElement>('.quiz-option-btn.correct');
  if (ok) waapi(ok,
    [{ boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
     { boxShadow: '0 0 0 3px color-mix(in srgb, var(--bz-success, #3a9e5f) 45%, transparent)' },
     { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }],
    { duration: 700, easing: E.out });
}
