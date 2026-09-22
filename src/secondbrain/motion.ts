/**
 * 第二大脑动效层（2026-09-22 快速原型批，用户命题：神经元点亮 / 检索涟漪 / 联想连线 /
 * 记忆星图 / 向量召回——在原 UI 上做全量动效，布局零改动）。
 *
 * 语义词汇表（本域动效的语言，不借其他域的特效）：
 *  - 神经元点亮：一块内容入列 = 一个神经元被点亮（统计六卡 / 趋势柱 / 最近行 / 参考卡 /
 *    对话气泡），点亮一瞬叠一次性辉光，随后归于素常；
 *  - 记忆星图：面板内容态的整屏编排 = 星图逐区点亮（卡带 → 趋势 → 树 → 最近 → 底部），
 *    节奏从「脑核」向外涟开；引导态的大脑图标 = 待充能星核；
 *  - 检索涟漪：发起检索 = 一道竖向微光扫过记忆层（对话消息区 / 参考列表），
 *    命中点再洇出一圈涟漪环（最近行圆点 / 引用卡 / 周报撞车行）；
 *  - 联想连线：命中与出处之间牵出一条发光细线（引用卡组顶线描线生长 / 周报撞车行
 *    「新笔记 → 既有笔记」两名字之间的连线）；
 *  - 向量召回：检索结果逐条浮现 = 向量空间按相似度召回（参考卡 / 引用卡 / 周报分节），
 *    分数条从 0 充能到命中位（transform scaleX，几何不动）；
 *  - 突触呼吸：进度 / 引导态大脑图标的常驻微循环 = 突触缓慢呼吸（集中句柄池管理，
 *    相位切换 / 面板关闭 / motionTeardown 必收，禁止永动孤儿）。
 *
 * 原则（与 home/motion.ts 同口径）：
 *  - **只动表现，不动布局**——注入件（涟漪环 / 扫光带 / 辉光 / 连线）全部绝对定位、
 *    不吃事件、aria-hidden、演出完自动移除；入场只用 transform/opacity/filter，几何从不改写。
 *  - 台账对齐 cinema/motion.ts：fast 160 / move 200 / base 280 / impulse 740，接力 30ms；
 *    揭示用 out 曲线，位移用 move 曲线，点亮回弹用 spring 曲线。
 *  - reduced-motion（评审期口径）：默认**无视**系统设置放完整演出；?rm=1 显式模拟 RM
 *    直达终态。无 WAAPI 宿主（jsdom / 老环境）内容已由渲染层落终态，零编排零感知。
 *  - markup 纯层（render.ts）一字不改；本层只在行为文件生命周期挂点被调用。
 *  - **退场安全（首页线上教训）**：面板 / 对话 / 周报弹层都是关闭后不销毁的常驻节点，
 *    退场 fill:forwards 钉住的 opacity:0 必须在收口时 cancel、重开时再撤一遍
 *    （playExit/cancelExit 成对），否则「关→再开」整屏不可见但可点。自毁注入件不受限。
 *  - 三个居中弹层（主面板 / 对话 / 周报）CSS 基线 transform: translate(-50%,-50%)，
 *    移动端断点翻转为 none——所有弹层级位移都按**当前 computed transform** 合成，
 *    不硬编码居中量（baseTransformOf）。
 */

/* ================= 台账与口径 ================= */

const M = { fast: 160, move: 200, base: 280, impulse: 740 } as const;
const E = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
  spring: 'cubic-bezier(.34,1.56,.64,1)',
} as const;
const STAG = 30;

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，见文件头）。 */
function reduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}

/** 元素当前 transform 基线（居中弹层的 translate(-50%,-50%) / 移动端 none） */
function baseTransformOf(el: HTMLElement): string {
  try {
    const t = getComputedStyle(el).transform;
    return t && t !== 'none' ? t : '';
  } catch { return ''; }
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

/** 延时调度（面板级取消，防快速刷新时编排叠加）；回调自判 isConnected 更稳 */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/* ================= 退场安全封装（常驻节点禁留 fill:forwards） ================= */

/**
 * 撤退场残留：上次退场的 fill:forwards 会把 opacity:0 钉在动画层（内联样式清不掉）——
 * 不撤则「关→再开」入场播完自移除后，节点落回钉住的透明（整屏不可见但可点）。
 */
function cancelExit(el: HTMLElement, id: string): void {
  try {
    if (typeof el.getAnimations !== 'function') return;
    for (const a of el.getAnimations()) if (a.id === id) a.cancel();
  } catch { /* 宿主无 getAnimations 忽略 */ }
}

/**
 * 常驻节点退场：fill:forwards 钉住终帧 → finished/兜底收口时 **cancel** 再交还 done
 * （done 由调用方收 display:none）。无 WAAPI 宿主：同步收口，绝不让 display:none 晚到。
 */
function playExit(el: HTMLElement, id: string, frames: Keyframe[], dur: number, done: () => void): void {
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    try { if (a && a.playState !== 'idle') a.cancel(); } catch { /* 已收口忽略 */ }
    done();
  };
  const a = waapi(el, frames, { duration: dur, easing: E.out, fill: 'forwards', id });
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  after(dur + 160, finish); // 兜底：动画事件丢失也不能卡住关闭
}

/* ================= 长驻循环句柄池（突触呼吸） ================= */

/** el → 停止器；tick 自查 isConnected 自灭，另供相位切换 / teardown 显式收割 */
const loops = new Map<HTMLElement, () => void>();

/**
 * 突触呼吸：进度 / 引导态脑图标的常驻微循环（scale + 辉光，2.4s 一息）。
 * 同元素重复注册先收旧的；返回即已运行。
 */
function synapseLoop(el: HTMLElement): void {
  stopLoop(el);
  if (reduced() || typeof el.animate !== 'function') return;
  const a = el.animate(
    [
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0px rgba(163,61,42,0))' },
      { transform: 'scale(1.055)', filter: 'drop-shadow(0 0 7px rgba(163,61,42,.45))' },
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0px rgba(163,61,42,0))' },
    ],
    { duration: 2400, iterations: Infinity, easing: 'ease-in-out' }
  );
  loops.set(el, () => { try { a.cancel(); } catch { /* 已停忽略 */ } });
}
function stopLoop(el: HTMLElement): void {
  const stop = loops.get(el);
  if (stop) { stop(); loops.delete(el); }
}
function stopAllLoops(): void {
  for (const stop of loops.values()) stop();
  loops.clear();
}

/* ================= 总清场（面板销毁 / 域卸载 / 面板关闭统一入口） ================= */

export function motionTeardown(): void {
  cancelPending();
  stopAllLoops();
}

/* ================= 注入件（自毁装饰，演出完自移除） ================= */

/** 宿主补定位上下文（幂等；position:relative 无偏移不改几何不参与排版，
 *  任务口径明许「宿主必要时内联 position:relative」；不用类——类会永久留在宿主上） */
function ensureRelative(el: HTMLElement): void {
  if (!el) return;
  try {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  } catch { /* 测试宿主无 computedStyle 时跳过（注入件退化为静态定位，无碍断言） */ }
}

/** 检索涟漪环：以 host 内 (cx,cy) 为心向外扩散一圈后自移除 */
function ripple(host: HTMLElement, cx: number, cy: number, r0 = 6): void {
  if (!host.isConnected) return;
  ensureRelative(host);
  const ring = document.createElement('i');
  ring.className = 'bz-sb-mo-ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.style.left = `${cx - r0}px`;
  ring.style.top = `${cy - r0}px`;
  ring.style.width = `${r0 * 2}px`;
  ring.style.height = `${r0 * 2}px`;
  host.appendChild(ring);
  const a = waapi(ring,
    [{ opacity: 0.85, transform: 'scale(.4)' },
     { opacity: 0, transform: 'scale(4.6)' }],
    { duration: M.base + 260, easing: E.out });
  const drop = (): void => { ring.remove(); try { a?.cancel(); } catch { /* 自毁忽略 */ } };
  if (a) a.finished.then(drop).catch(drop);
  else after(M.base + 280, drop);
}

/** 检索扫描微光带：一道竖向光带自上而下掠过 host（检索发起瞬间）。
 *  前插（firstChild）——消息区等宿主存在 lastElementChild 契约（chat-ux 测试取流式气泡），
 *  注入件不得排到内容之后。 */
function sweep(host: HTMLElement): void {
  if (!host.isConnected || reduced()) return;
  ensureRelative(host);
  const band = document.createElement('div');
  band.className = 'bz-sb-mo-sweep';
  band.setAttribute('aria-hidden', 'true');
  const inner = document.createElement('i');
  band.appendChild(inner);
  host.insertBefore(band, host.firstChild);
  const a = waapi(inner,
    [{ transform: 'translateY(-120%)' }, { transform: 'translateY(320%)' }],
    { duration: M.impulse - 60, easing: E.out });
  const drop = (): void => { band.remove(); try { a?.cancel(); } catch { /* 自毁忽略 */ } };
  if (a) a.finished.then(drop).catch(drop);
  else after(M.impulse - 40, drop);
}

/** 神经元点亮辉光：内容卡入列一瞬的一次性光晕 */
function neuronFlash(card: HTMLElement): void {
  if (!card.isConnected || reduced()) return;
  ensureRelative(card);
  const gl = document.createElement('i');
  gl.className = 'bz-sb-mo-flash';
  gl.setAttribute('aria-hidden', 'true');
  card.appendChild(gl);
  const a = waapi(gl,
    [{ opacity: 0.9, transform: 'scale(.92)' }, { opacity: 0, transform: 'scale(1.03)' }],
    { duration: M.impulse - 180, easing: E.out });
  const drop = (): void => { gl.remove(); try { a?.cancel(); } catch { /* 自毁忽略 */ } };
  if (a) a.finished.then(drop).catch(drop);
  else after(M.impulse - 160, drop);
}

/**
 * 联想连线：host 内 y 高度处从 x1 描到 x2 的发光细线，描完驻留一拍再淡出自移除。
 * 语义：检索命中 / 主题撞车的两端牵线。
 */
function thread(host: HTMLElement, x1: number, x2: number, y: number): void {
  if (!host.isConnected || reduced() || x2 <= x1) return;
  ensureRelative(host);
  const ln = document.createElement('i');
  ln.className = 'bz-sb-mo-thread';
  ln.setAttribute('aria-hidden', 'true');
  ln.style.left = `${x1}px`;
  ln.style.top = `${y}px`;
  ln.style.width = `${x2 - x1}px`;
  host.appendChild(ln);
  const draw = waapi(ln,
    [{ transform: 'scaleX(0)', opacity: 0.9 }, { transform: 'scaleX(1)', opacity: 0.75 }],
    { duration: M.move, easing: E.out });
  const fade = (): void => {
    const out = waapi(ln, [{ opacity: 0.75 }, { opacity: 0 }], { duration: M.base, easing: E.out, fill: 'forwards' });
    const drop = (): void => { ln.remove(); try { out?.cancel(); } catch { /* 自毁忽略 */ } };
    if (out) out.finished.then(drop).catch(drop);
    else after(M.base + 20, drop);
  };
  if (draw) draw.finished.then(fade).catch(fade);
  else after(M.move + 20, fade);
}

/* ================= 主面板：唤醒 / 退场 ================= */

const PANEL_EXIT = 'bz-sb-panel-exit';

/** boot 消费标志：motionPanelIn 置位、motionStatsIn 首个渲染消费即熄（刷新静默不重播） */
let panelBootArmed = false;

/** 主面板唤醒：神经暗场 → 星图浮现（弹层级入场，reopen 走快档） */
export function motionPanelIn(popup: HTMLElement | null, reopen: boolean): void {
  if (!popup) return;
  popup.style.opacity = ''; popup.style.transform = ''; popup.style.filter = ''; // 清 RM 内联残留
  cancelExit(popup, PANEL_EXIT);
  const base = baseTransformOf(popup);
  const withBase = (extra: string): string => (base ? `${base} ${extra}` : extra);
  waapi(popup,
    [{ opacity: 0, transform: withBase('scale(.965) translateY(10px)'), filter: 'blur(7px)' },
     { opacity: 1, transform: base || 'none', filter: 'blur(0px)' }],
    { duration: reopen ? 300 : 480, easing: E.out });
  panelBootArmed = true; // 首个统计渲染消费
}

/** 主面板退场：星图沉入记忆深海（先演退场再交还 done 收 display:none） */
export function motionPanelOut(popup: HTMLElement | null, done: () => void): void {
  stopAllLoops();
  if (!popup) { done(); return; }
  const base = baseTransformOf(popup);
  const withBase = (extra: string): string => (base ? `${base} ${extra}` : extra);
  playExit(popup, PANEL_EXIT,
    [{ opacity: 1, transform: base || 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: withBase('scale(.97) translateY(8px)'), filter: 'blur(5px)' }],
    M.move + 40, done);
}

/* ================= 主面板：统计编排（记忆星图点亮） ================= */

/** 统计带 / 趋势 / 来源树 / 最近 / 底部的整屏编排。
 * boot（open 后首个渲染）才演；自动刷新重渲静默（消费标志熄灭即直接返回）。
 * force 供 #replay 评审重播。
 */
export function motionStatsIn(popup: HTMLElement | null, force = false): void {
  cancelPending(); // 新渲染覆盖旧编排（对齐 home motionRendered 口径）
  stopAllLoops();
  if (!popup) return;
  const content = popup.querySelector<HTMLElement>('#bz-sb-content');
  if (!content) return;
  if (!force) {
    if (!panelBootArmed) return;
    panelBootArmed = false;
  }
  if (reduced()) return; // 评审模拟 RM：内容已由渲染层落终态，零编排

  /* —— 健康 pill：星核一次脉冲 —— */
  const pill = popup.querySelector<HTMLElement>('.bz-sb-pill');
  if (pill) {
    ensureRelative(pill);
    waapi(pill,
      [{ opacity: 0, transform: 'translateY(-5px)', filter: 'blur(3px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, easing: E.out, fill: 'backwards' });
    const dot = pill.querySelector<HTMLElement>('.bz-sb-pill-dot');
    if (dot) after(160, () => {
      const pr = pill.getBoundingClientRect();
      const dr = dot.getBoundingClientRect();
      if (!pill.isConnected) return;
      ripple(pill, dr.left - pr.left + dr.width / 2, dr.top - pr.top + dr.height / 2, 5);
    });
  }

  /* —— 统计六卡：神经元逐个点亮（辉光一瞬，30ms 接力） —— */
  const cards = [...content.querySelectorAll<HTMLElement>('#bz-sb-cards .bz-sb-card')];
  cards.forEach((card, i) => {
    after(90 + i * STAG, () => {
      if (!card.isConnected) return;
      card.style.willChange = 'transform,filter,opacity';
      waapi(card,
        [{ opacity: 0, transform: 'translateY(9px) scale(.97)', filter: 'blur(5px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base + 80, easing: E.out, fill: 'backwards' });
      neuronFlash(card);
      after(M.base + 220, () => { card.style.willChange = ''; });
    });
  });

  /* —— 趋势 12 柱：记忆沉淀自左向右生长（scaleY，几何不改写） —— */
  const cols = [...content.querySelectorAll<HTMLElement>('#bz-sb-trend .bz-sb-trend-col')];
  cols.forEach((col, i) => {
    const bar = col.querySelector<HTMLElement>('.bz-sb-trend-bar');
    if (!bar) return;
    bar.style.transformOrigin = '50% 100%';
    after(320 + i * 24, () => {
      if (!col.isConnected) return;
      waapi(bar,
        [{ transform: 'scaleY(0)', filter: 'brightness(1.6)' },
         { transform: 'scaleY(1)', filter: 'brightness(1)' }],
        { duration: M.base + 120, easing: E.out, fill: 'backwards' });
    });
  });
  const trendSum = content.querySelector<HTMLElement>('#bz-sb-trend-sum');
  if (trendSum) after(560, () => {
    if (trendSum.isConnected) waapi(trendSum, [{ opacity: 0 }, { opacity: 1 }], { duration: M.base, easing: E.out, fill: 'backwards' });
  });

  /* —— 来源树：枝突自左伸展 —— */
  const distRows = [...content.querySelectorAll<HTMLElement>('#bz-sb-dist .bz-sb-dist-row')];
  distRows.forEach((row, i) => {
    after(400 + Math.min(i, 16) * 14, () => {
      if (!row.isConnected) return;
      waapi(row,
        [{ opacity: 0, transform: 'translateX(-7px)' }, { opacity: 1, transform: 'none' }],
        { duration: M.base, easing: E.out, fill: 'backwards' });
      const fill = row.querySelector<HTMLElement>('.bz-sb-dist-fill');
      if (fill) {
        fill.style.transformOrigin = 'left center';
        waapi(fill,
          [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
          { duration: M.base + 140, easing: E.out, fill: 'backwards' });
      }
    });
  });

  /* —— 最近向量化：记忆粒子逐条浮现，来源色点处洇开一圈涟漪 —— */
  const recentRows = [...content.querySelectorAll<HTMLElement>('#bz-sb-recent .bz-sb-recent-row')];
  recentRows.forEach((row, i) => {
    after(520 + Math.min(i, 10) * STAG, () => {
      if (!row.isConnected) return;
      row.style.willChange = 'transform,filter,opacity';
      waapi(row,
        [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(4px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base + 80, easing: E.out, fill: 'backwards' });
      after(140, () => {
        if (!row.isConnected) return;
        const dot = row.querySelector<HTMLElement>('.bz-sb-dot');
        if (!dot) return;
        const rr = row.getBoundingClientRect();
        const dr = dot.getBoundingClientRect();
        ripple(row, dr.left - rr.left + dr.width / 2, dr.top - rr.top + dr.height / 2, 4.5);
      });
      after(M.base + 260, () => { row.style.willChange = ''; });
    });
  });

  /* —— 底部操作 + 状态行：晚一拍落定 —— */
  const foot = content.querySelector<HTMLElement>('.bz-sb-foot');
  if (foot) after(700, () => {
    if (!foot.isConnected) return;
    [...foot.children].forEach((el, i) => {
      waapi(el as HTMLElement,
        [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: M.base, easing: E.out, fill: 'backwards', delay: i * 40 });
    });
  });
}

/** 来源树展开 / 复位重渲：枝突伸展微编排（统计编排路径不调这里，不叠加） */
export function motionDistIn(dist: HTMLElement | null): void {
  if (reduced() || !dist) return;
  [...dist.querySelectorAll<HTMLElement>('.bz-sb-dist-row')].forEach((row, i) => {
    after(Math.min(i, 14) * 14, () => {
      if (!row.isConnected) return;
      waapi(row,
        [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }],
        { duration: M.fast + 40, easing: E.out, fill: 'backwards' });
    });
  });
}

/* ================= 引导态 / 进度态：星核充能与突触呼吸 ================= */

/** 空库引导态：大脑星核呼吸常驻 + 文案与按钮接力浮现（loop 句柄入池，相位切换必收） */
export function motionGuideIn(onboard: HTMLElement | null): void {
  if (reduced() || !onboard) return;
  stopAllLoops();
  const icon = onboard.querySelector<HTMLElement>('.bz-sb-onboard-icon');
  if (icon) synapseLoop(icon);
  const seq = ['.bz-sb-onboard-title', '.bz-sb-onboard-desc', '.bz-sb-init-btn'] as const;
  seq.forEach((sel, i) => {
    const el = onboard.querySelector<HTMLElement>(sel);
    if (!el) return;
    after(80 + i * 90, () => {
      if (!el.isConnected) return;
      waapi(el,
        [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(4px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base + 60, easing: E.out, fill: 'backwards' });
    });
  });
}

/** 进度态（初始化 / 增量同步 / 全量重建三形态）：脑核突触呼吸 + 进度槽微光起手 */
export function motionProgressIn(onboard: HTMLElement | null): void {
  if (reduced() || !onboard) return;
  stopAllLoops();
  const icon = onboard.querySelector<HTMLElement>('.bz-sb-onboard-icon');
  if (icon) synapseLoop(icon);
  const title = onboard.querySelector<HTMLElement>('.bz-sb-onboard-title');
  if (title) waapi(title,
    [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.base, easing: E.out, fill: 'backwards' });
  const bar = onboard.querySelector<HTMLElement>('.bz-sb-init-bar');
  if (bar) {
    ensureRelative(bar);
    sweep(bar);
  }
}

/** 相位切换回内容态（引导 / 进度 → 统计）：收呼吸循环（内容编排由 motionStatsIn 接管） */
export function motionPhaseToContent(): void {
  stopAllLoops();
}

/* ================= 异步回填卡：AI 摘要 / 每周动态入口卡 ================= */

/** 异步回填卡浮现（loadSummaryAndLinks / renderPanelWeeklyCard 挂点，一次性） */
export function motionSummaryIn(card: HTMLElement | null): void {
  if (reduced() || !card) return;
  waapi(card,
    [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(4px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + 60, easing: E.out });
}

/* ================= AI 对话：弹层 / 气泡 / 检索涟漪 / 引用召回 ================= */

const CHAT_EXIT = 'bz-sb-chat-exit';
const chatShown = new WeakSet<HTMLElement>();

/** 对话弹层入场（首开整编排，重开短档）；先撤退场残留（常驻节点教训） */
export function motionChatIn(popup: HTMLElement): void {
  if (!popup) return;
  popup.style.opacity = ''; popup.style.transform = ''; popup.style.filter = '';
  cancelExit(popup, CHAT_EXIT);
  const base = baseTransformOf(popup);
  const withBase = (extra: string): string => (base ? `${base} ${extra}` : extra);
  const first = !chatShown.has(popup);
  chatShown.add(popup);
  waapi(popup,
    [{ opacity: 0, transform: withBase(first ? 'scale(.955) translateY(12px)' : 'scale(.99)'), filter: `blur(${first ? 7 : 3}px)` },
     { opacity: 1, transform: base || 'none', filter: 'blur(0px)' }],
    { duration: first ? 420 : 260, easing: E.out });
}

/** 对话弹层退场：先演再收（done 交还 display:none；收口撤钉防「关→再开」隐形） */
export function motionChatOut(popup: HTMLElement, done: () => void): void {
  if (!popup) { done(); return; }
  const base = baseTransformOf(popup);
  const withBase = (extra: string): string => (base ? `${base} ${extra}` : extra);
  playExit(popup, CHAT_EXIT,
    [{ opacity: 1, transform: base || 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: withBase('scale(.975) translateY(9px)'), filter: 'blur(5px)' }],
    M.move + 30, done);
}

/** 气泡入列：user 弹性落座（右轻推回弹）/ assistant 自下浮起（神经元点亮） */
export function motionMsgIn(msg: HTMLElement | null): void {
  if (reduced() || !msg) return;
  const user = msg.classList.contains('user');
  msg.style.willChange = 'transform,opacity,filter';
  waapi(msg,
    user
      ? [{ opacity: 0, transform: 'translateX(12px) scale(.96)', filter: 'blur(3px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }]
      : [{ opacity: 0, transform: 'translateY(9px)', filter: 'blur(4px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base + (user ? 40 : 80), easing: user ? E.spring : E.out });
  after(M.base + 200, () => { msg.style.willChange = ''; });
}

/** 检索涟漪：提问发出，一道微光扫过消息区（记忆层被翻动） */
export function motionSearchWave(area: HTMLElement): void {
  if (reduced() || !area) return;
  sweep(area);
}

/** 引用召回：命中卡按相似度次序逐条浮现（向量召回），组顶牵出一条联想连线，
 *  分数一枚枚点亮回弹，首卡处洇一圈检索涟漪。
 */
export function motionCitesIn(cites: HTMLElement | null): void {
  if (reduced() || !cites) return;
  ensureRelative(cites);
  const chips = [...cites.querySelectorAll<HTMLElement>('.bz-sb-chat-cite')];
  // 联想连线：组顶描线生长（问题 → 命中的牵线意象）
  thread(cites, 0, cites.scrollWidth || chips.length * 90, 1);
  chips.forEach((chip, i) => {
    after(i * STAG, () => {
      if (!chip.isConnected) return;
      chip.style.willChange = 'transform,opacity,filter';
      waapi(chip,
        [{ opacity: 0, transform: 'translateY(7px) scale(.95)', filter: 'blur(3px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base, easing: E.out, fill: 'backwards' });
      const score = chip.querySelector<HTMLElement>('.bz-sb-chat-cite-score');
      if (score) after(M.fast, () => {
        if (!score.isConnected) return;
        waapi(score,
          [{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }],
          { duration: M.move + 80, easing: E.spring });
      });
      after(M.base + 120, () => { chip.style.willChange = ''; });
    });
  });
  after(STAG, () => {
    if (!cites.isConnected || !chips.length) return;
    const cr = cites.getBoundingClientRect();
    const h0 = chips[0].getBoundingClientRect();
    ripple(cites, h0.left - cr.left + 10, h0.top - cr.top + h0.height / 2, 7);
  });
}

/** 清空对话：旧记忆逐条蒸发 → rewrite 交还（welcome 弹出由调用方 motionMsgIn 接） */
export function motionChatClear(area: HTMLElement, rewrite: () => void): void {
  if (reduced() || !area || typeof area.animate !== 'function') {
    area?.replaceChildren(); // 无 WAAPI 宿主 / RM：同步清空再重写（原 innerHTML='' 语义）
    rewrite();
    return;
  }
  const msgs = [...area.children] as HTMLElement[];
  msgs.forEach((msg, i) => {
    const a = waapi(msg,
      [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
       { opacity: 0, transform: 'translateY(-7px) scale(.97)', filter: 'blur(4px)' }],
      { duration: M.fast + 20, easing: E.out, fill: 'forwards', delay: Math.min(i, 14) * 14 });
    if (!a && msg) msg.style.opacity = '0';
  });
  after(M.fast + 40 + Math.min(msgs.length, 14) * 14, () => {
    area.replaceChildren(); // 蒸发完毕再交还重写（markup 由行为层单源重出）
    rewrite();
  });
}

/* ================= 灵感参考：扫描 / 召回 / 预览 / 密度 / 边条 ================= */

/** 参考检索发起：列表上一道扫描微光（检索中的功能意象） */
export function motionRefSweep(list: HTMLElement): void {
  if (reduced() || !list) return;
  sweep(list);
}

/** 向量召回：参考卡逐条浮现 + 分数条从 0 充能到命中位（几何不改写，scaleX） */
export function motionRefResults(list: HTMLElement): void {
  if (reduced() || !list) return;
  const cards = [...list.querySelectorAll<HTMLElement>('.bz-sb-ref-card')];
  cards.forEach((card, i) => {
    card.style.willChange = 'transform,opacity,filter';
    after(Math.min(i, 12) * STAG, () => {
      if (!card.isConnected) return;
      waapi(card,
        [{ opacity: 0, transform: 'translateY(9px)', filter: 'blur(5px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base + 80, easing: E.out, fill: 'backwards' });
      neuronFlash(card);
      const fill = card.querySelector<HTMLElement>('.bz-sb-ref-card-bar-fill');
      if (fill) {
        fill.style.transformOrigin = 'left center';
        after(M.fast, () => {
          if (!fill.isConnected) return;
          waapi(fill,
            [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
            { duration: M.base + 200, easing: E.out, fill: 'backwards' });
        });
      }
      after(M.base + 260, () => { card.style.willChange = ''; });
    });
  });
  after(Math.min(cards.length, 12) * STAG + 120, () => {
    if (!list.isConnected || !cards.length) return;
    const lr = list.getBoundingClientRect();
    const c0 = cards[0].getBoundingClientRect();
    ripple(list, 24, c0.top - lr.top + c0.height / 2, 8);
  });
}

/** 悬停预览浮现：纸页自卡面浮起（常驻自毁件——预览随 mouseleave 移除） */
export function motionPreviewIn(pv: HTMLElement): void {
  if (reduced() || !pv) return;
  waapi(pv,
    [{ opacity: 0, transform: 'translateY(7px) scale(.985)', filter: 'blur(5px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base, easing: E.out });
}

/** 密度切换：列表沉降一拍（形态翻面的意象，轻） */
export function motionDensitySettle(list: HTMLElement): void {
  if (reduced() || !list || typeof list.animate !== 'function') return;
  waapi(list,
    [{ opacity: 0.55, transform: 'translateY(4px)', filter: 'blur(2px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.fast + 40, easing: E.out });
}

/** 窄窗边条唤起：右缘一道退散微光（自毁注入件，400ms 自清） */
export function motionFloatWake(win: HTMLElement): void {
  if (reduced() || !win) return;
  const edge = document.createElement('i');
  edge.className = 'bz-sb-mo-edge';
  edge.setAttribute('aria-hidden', 'true');
  win.appendChild(edge);
  const a = waapi(edge, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: E.out });
  const drop = (): void => { edge.remove(); try { a?.cancel(); } catch { /* 自毁忽略 */ } };
  if (a) a.finished.then(drop).catch(drop);
  else after(420, drop);
}

/* ================= 每周知识动态：弹层壳 / 内容编排 / 退场 ================= */

const WEEKLY_EXIT = 'bz-sb-weekly-exit';

/** 弹层壳入场（ensureModal 显示挂点）：撤退场残留 + 壳体浮现 */
export function motionWeeklyShellIn(overlay: HTMLElement | null): void {
  if (!overlay) return;
  overlay.style.opacity = ''; overlay.style.transform = ''; overlay.style.filter = '';
  cancelExit(overlay, WEEKLY_EXIT);
  const base = baseTransformOf(overlay);
  const withBase = (extra: string): string => (base ? `${base} ${extra}` : extra);
  waapi(overlay,
    [{ opacity: 0, transform: withBase('scale(.965) translateY(10px)'), filter: 'blur(6px)' },
     { opacity: 1, transform: base || 'none', filter: 'blur(0px)' }],
    { duration: 380, easing: E.out });
}

/**
 * 弹层内容编排（showWeeklyModal 渲染挂点）：
 * 聚合中 / 失败 / 空态 → 轻浮现；有货 → 分节星图接力 + 行涟漪 + 撞车行联想连线。
 */
export function motionWeeklyContent(body: HTMLElement): void {
  if (reduced() || !body) return;
  const sections = [...body.querySelectorAll<HTMLElement>('.bz-sb-weekly-section')];
  if (!sections.length) {
    const empty = body.querySelector<HTMLElement>('.bz-sb-weekly-empty');
    if (empty) waapi(empty, [{ opacity: 0 }, { opacity: 1 }], { duration: M.base, easing: E.out, fill: 'backwards' });
    return;
  }
  sections.forEach((sec, i) => {
    after(i * 70, () => {
      if (!sec.isConnected) return;
      waapi(sec,
        [{ opacity: 0, transform: 'translateY(9px)', filter: 'blur(4px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base + 60, easing: E.out, fill: 'backwards' });
    });
    /* 概要 chips：计数逐枚点亮 */
    sec.querySelectorAll<HTMLElement>('.bz-sb-weekly-chip').forEach((chip, j) => {
      after(i * 70 + 120 + j * STAG, () => {
        if (!chip.isConnected) return;
        waapi(chip,
          [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }],
          { duration: M.move + 60, easing: E.spring, fill: 'backwards' });
      });
    });
    /* 行涟漪：圆点洇圈 + 行浮起（cap 14，其余直达） */
    sec.querySelectorAll<HTMLElement>('.bz-sb-weekly-row').forEach((row, j) => {
      after(i * 70 + 160 + Math.min(j, 14) * STAG, () => {
        if (!row.isConnected) return;
        row.style.willChange = 'transform,opacity,filter';
        waapi(row,
          [{ opacity: 0, transform: 'translateY(7px)', filter: 'blur(3px)' },
           { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
          { duration: M.base, easing: E.out, fill: 'backwards' });
        const dot = row.querySelector<HTMLElement>('.bz-sb-weekly-row-dot');
        if (dot) after(120, () => {
          if (!row.isConnected || !dot) return;
          const rr = row.getBoundingClientRect();
          const dr = dot.getBoundingClientRect();
          ripple(row, dr.left - rr.left + dr.width / 2, dr.top - rr.top + dr.height / 2, 4);
        });
        after(M.base + 200, () => { row.style.willChange = ''; });
      });
    });
    /* 撞车行：两名字之间牵联想连线 + 箭头前探 + 百分比点亮 */
    sec.querySelectorAll<HTMLElement>('.bz-sb-weekly-row--hit').forEach((row, j) => {
      after(i * 70 + 260 + Math.min(j, 8) * STAG + 200, () => {
        if (!row.isConnected) return;
        const names = [...row.querySelectorAll<HTMLElement>('.bz-sb-weekly-row-name')];
        const rr = row.getBoundingClientRect();
        if (names.length >= 2) {
          const a = names[0].getBoundingClientRect();
          const b = names[names.length - 1].getBoundingClientRect();
          thread(row, a.right - rr.left + 2, b.left - rr.left - 2, rr.height / 2);
        }
        const arrow = row.querySelector<HTMLElement>('.bz-sb-weekly-row-hit-arrow');
        if (arrow) waapi(arrow,
          [{ transform: 'translateX(-4px)', opacity: 0.4 }, { transform: 'none', opacity: 1 }],
          { duration: M.move, easing: E.out, fill: 'backwards' });
        const pct = row.querySelector<HTMLElement>('.bz-sb-weekly-row-pct');
        if (pct) waapi(pct,
          [{ opacity: 0, transform: 'scale(1.35)' }, { opacity: 1, transform: 'none' }],
          { duration: M.move + 60, easing: E.spring, fill: 'backwards' });
      });
    });
  });
}

/** 弹层退场：先演再收（done 交还 display:none；常驻单例，收口撤钉） */
export function motionWeeklyOut(overlay: HTMLElement | null, done: () => void): void {
  if (!overlay) { done(); return; }
  const base = baseTransformOf(overlay);
  const withBase = (extra: string): string => (base ? `${base} ${extra}` : extra);
  playExit(overlay, WEEKLY_EXIT,
    [{ opacity: 1, transform: base || 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: withBase('scale(.97) translateY(8px)'), filter: 'blur(5px)' }],
    M.move + 30, done);
}

/* ================= 移动端抽屉：参考卡召回 ================= */

/** 移动端参考卡接力（bz-sb-mb-card，与桌面召回同语、幅度更小） */
export function motionMobileCards(body: HTMLElement): void {
  if (reduced() || !body) return;
  [...body.querySelectorAll<HTMLElement>('.bz-sb-mb-card')].forEach((card, i) => {
    after(Math.min(i, 10) * STAG, () => {
      if (!card.isConnected) return;
      waapi(card,
        [{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'none' }],
        { duration: M.base, easing: E.out, fill: 'backwards' });
      const fill = card.querySelector<HTMLElement>('.bz-sb-mb-card-bar span');
      if (fill) {
        fill.style.transformOrigin = 'left center';
        waapi(fill,
          [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
          { duration: M.base + 140, easing: E.out, fill: 'backwards' });
      }
    });
  });
}

/* ================= 评审便利：#replay 重播统计编排（插件内同样无害） =================
   壳在页面加载时就跑 openPanel，编排可能发生在你看到页面之前——带 #replay 打开（或刷新）
   会在 0.6s 后重播一次：面板唤醒 + 统计全编排。panel.ts 在 open 里挂 __bzSbReplay。 */
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#replay') return;
    location.hash = '';
    const replay = (window as unknown as Record<string, unknown>).__bzSbReplay as (() => void) | undefined;
    if (typeof replay === 'function') setTimeout(replay, 600);
  });
  if (location.hash === '#replay') {
    const wait = (): void => {
      const replay = (window as unknown as Record<string, unknown>).__bzSbReplay as (() => void) | undefined;
      if (typeof replay === 'function') { location.hash = ''; setTimeout(replay, 600); }
      else setTimeout(wait, 120);
    };
    setTimeout(wait, 120);
  }
}
