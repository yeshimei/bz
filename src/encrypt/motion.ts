/**
 * 保险库动效层（encrypt 域，2026-09-22 动效批；与首页/影院同打法，按保险库自己的语义出招）。
 *
 * 语义词汇表（本域所有演出只从这组词里取意象，不借他域特效）：
 *   - 铁门（gate）：上锁瞬间两条横档门闩从上下缘合拢，「咔哒」锁死再退场——盖住
 *     lockNow 的同步重绘，锁定态揭出时已经是锁定的世界；
 *   - 锁芯（seal）：品牌印记/锁屏印章的旋转与压落——开锁=拧开，上锁=拧死；
 *   - 密文显影（reveal）：解密内容从「雾面」里浮出（blur+亮度梯度收拢）——预览正文、
 *     日记正文、原图加载共用同一显影语汇；只做状态转换氛围，**节拍恒定不随内容长度变**
 *     （涉密纪律：不泄露明文时序）；
 *   - 光缝（sweep）：门缝里漏进来的一道斜光扫过面板——解锁成功/boot 编排的开场白；
 *   - 封条验印（lockscreen）：解锁屏入场=印章压落封蜡；密码错误=整盒三摇拒盖；
 *   - 验讫余韵（burst）：开锁成功的一圈光环+金屑，DOM 已收、余韵另燃（自毁覆层）；
 *   - 体检扫描（scan）：体检窗内的巡逻光带，扫完即收，不留长驻循环。
 *
 * 原则（对齐 home/motion.ts）：
 *  - **只动表现，不动布局**——注入件全部 absolute/fixed、pointer-events:none、
 *    aria-hidden；入场用 transform/opacity/filter，几何从不改写；演完即自毁，
 *    终态 UI 与没有动效层时逐像素一致。
 *  - 台账对齐 cinema/motion.ts（issue 400 口径）：fast 160 / move 200 / base 280 /
 *    impulse 740，接力 30ms；揭示用 out 曲线，位移用 move 曲线。
 *  - reduced-motion（评审期口径）：默认**无视**系统设置放完整演出，?rm=1 显式模拟
 *    RM 直达终态。jsdom / 无 matchMedia 环境按非 RM 走，无 WAAPI 时直达终态，
 *    域内测试零感知。
 *  - **退场纪律**：面板 hide 是同步收 display（测试锁死该语义）——退场演出走
 *    「同步收 + body 自毁覆层替身」，绝不在常驻节点上留 fill:forwards 残留
 *    （首页「关→再开」整屏不可见的教训）。
 *  - 与渲染纯层解耦：markup 一字不改；本层只在 ui.ts 生命周期挂点被调用。
 *  - 纯浏览器 API：禁 import obsidian / 任何 core 服务——评审壳与插件两侧都能跑。
 *  - password-vault/motion.ts 复用本文件底层（waapi/after/veil/loop 池），
 *    场景函数各自成文，两域不互相串演出。
 */

/* ================= 台账与口径 ================= */

export const M = { fast: 160, move: 200, base: 280, impulse: 740 } as const;
export const E = {
  out: 'cubic-bezier(.22,.82,.3,1)',
  move: 'cubic-bezier(.34,.06,.16,1)',
} as const;
export const STAG = 30;

/** 评审模拟 RM（?rm=1）：直达终态。系统 RM 不拦演出（评审期口径，见文件头）。 */
export function motionReduced(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('rm=1'); }
  catch { return false; }
}

/** 安全 WAAPI：?rm=1 时直达终态（落最后一帧）；否则真实演出，宿主不支持也落终态 */
export function motionWaapi(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || motionReduced() || typeof el.animate !== 'function') {
    const last = frames[frames.length - 1];
    if (el && last) for (const k of Object.keys(last)) {
      if (k === 'offset') continue;
      try { (el.style as unknown as Record<string, string>)[k] = String((last as Record<string, unknown>)[k]); } catch { /* 不可内联属性忽略 */ }
    }
    return null;
  }
  try { return el.animate(frames, opts); } catch { return null; }
}

/** 延时调度（渲染编排池：motionRendered 开头 cancelPending 覆盖旧编排） */
const timers = new Set<ReturnType<typeof setTimeout>>();
export function motionAfter(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
export function motionCancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/**
 * 壳层/自毁调度（独立池，**不受 cancelPending 影响**）：面板入场、铁门揭幕、覆层
 * 自毁兜底等「与渲染编排无关」的调度走这里——否则紧随其后的 renderAll 会把
 * 铁门的揭幕定时杀掉，门闩永远钉在面板上（编排覆盖不能误伤自毁兜底）。
 */
export function motionShellAfter(ms: number, fn: () => void): void {
  setTimeout(fn, ms);
}

/* ================= 长驻循环句柄池（相位切换/面板关闭/teardown 必收，禁永动孤儿） ================= */

const loops = new Map<string, () => void>();
export function motionLoopAdd(key: string, stop: () => void): void {
  motionLoopStop(key);
  loops.set(key, stop);
}
export function motionLoopStop(key: string): void {
  const stop = loops.get(key);
  if (stop) { loops.delete(key); try { stop(); } catch { /* 已失效忽略 */ } }
}
export function motionLoopStopAll(): void {
  for (const key of [...loops.keys()]) motionLoopStop(key);
}

/** 面板关闭/插件卸载清场（ui.ts cleanup 调；收全部调度与循环） */
export function motionTeardown(): void {
  motionCancelPending();
  motionLoopStopAll();
}

/* ================= 自毁覆层基座（body 级，演出完自动移除） ================= */

/**
 * 在 rect 处放一块 fixed 覆层（pointer-events:none + aria-hidden），build 返回动画
 * 收场后的自毁调度由调用方完成——本函数只负责建节点与挂载。rect 无效（width<5，
 * 测试宿主/隐藏态）返回 null，调用方直接跳过。
 */
export function motionVeil(rect: DOMRect, cls: string): HTMLElement | null {
  if (!rect || rect.width < 5 || rect.height < 5) return null;
  if (typeof document === 'undefined' || !document.body) return null;
  const veil = document.createElement('div');
  veil.className = cls;
  veil.setAttribute('aria-hidden', 'true');
  veil.style.cssText =
    `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;` +
    'pointer-events:none;z-index:var(--bz-z-overlay,1000);';
  document.body.appendChild(veil);
  return veil;
}

/** 覆层自毁：动画 finished 后移除节点（兜底定时防事件丢失；走壳层池不被编排取消） */
export function motionVeilGone(veil: HTMLElement, anim: Animation | null, dur: number): void {
  const gone = () => { try { veil.remove(); } catch { /* 已摘忽略 */ } };
  if (anim) anim.finished.then(gone).catch(gone);
  motionShellAfter(dur + 150, gone);
}

/** 元素可见性（display:none 的桌面/移动双实例只演可见侧） */
export function motionVisible(el: HTMLElement | null | undefined): el is HTMLElement {
  return !!el && el.offsetWidth > 0 && el.offsetHeight > 0;
}

/* ================= 渲染编排：boot 消费标志 / switch / search / 默认轻揭出 ================= */

/** 渲染意图（模块级，arm 即置位，motionRendered 消费即熄——前后台刷新静默不重播） */
let intent: 'boot' | 'switch' | 'search' | null = null;
export function motionArmBoot(): void { intent = 'boot'; }
export function motionArmSwitch(): void { if (!intent) intent = 'switch'; }
export function motionArmSearch(): void { if (!intent) intent = 'search'; }

/** 单元素揭出（上浮 + 去雾；fill backwards 起播前不遮挡内容直达） */
function rise(
  el: HTMLElement,
  delay: number,
  dur: number = M.base,
  from: { y?: number; blur?: number; scale?: number } = {},
): void {
  const y = from.y ?? 8;
  const blur = from.blur ?? 4;
  const scale = from.scale ?? 1;
  motionAfter(delay, () => {
    motionWaapi(el,
      [{ opacity: 0, transform: `translateY(${y}px)${scale !== 1 ? ` scale(${scale})` : ''}`, filter: `blur(${blur}px)` },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: dur, easing: E.out, fill: 'backwards' });
  });
}

/**
 * 渲染完成钩子（ui.ts renderAll 尾部调用）：按意图播编排。
 *  - boot（打开面板/解锁成功后的首次渲染）：锁芯落定 + 光缝扫过 + 各区接力揭出；
 *  - switch（资产切换）：列表/详情分块揭出，导航不动；
 *  - search（搜索刷新）：列表行快级联 + 详情揭出；
 *  - 无意图（选中行/写操作等普通重绘）：详情轻揭出，几乎无感但有衔接。
 */
export function motionRendered(popup: HTMLElement): void {
  motionCancelPending(); // 新渲染覆盖旧编排（对齐 home clearPending 口径）
  const phase = intent;
  intent = null;
  if (!popup || motionReduced() || !motionVisible(popup)) return;
  const desk = popup.querySelector<HTMLElement>('.bz-vault-desk');
  const mob = popup.querySelector<HTMLElement>('.bz-vault-mob');
  const deskOn = motionVisible(desk);

  /* —— 桌面（或面板级）编排 —— */
  if (deskOn && desk) {
    const seal = desk.querySelector<HTMLElement>('.bz-vault-brand .seal');
    const items = [...desk.querySelectorAll<HTMLElement>('.bz-vault-item')];
    const side = [desk.querySelector<HTMLElement>('.bz-vault-health'), desk.querySelector<HTMLElement>('.bz-vault-lockbtn')];
    const rows = [...desk.querySelectorAll<HTMLElement>('.bz-vault-lc-body .bz-vault-row')];
    const detail = desk.querySelector<HTMLElement>('.bz-vault-detail');
    if (phase === 'boot') {
      if (seal) motionAfter(0, () => motionWaapi(seal,
        [{ opacity: 0, transform: 'rotate(-120deg) scale(.55)', filter: 'blur(3px)' },
         { opacity: 1, transform: 'rotate(8deg) scale(1.06)', filter: 'blur(0px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: 380, easing: E.out, fill: 'backwards' }));
      items.forEach((el, i) => rise(el, 90 + i * 45, M.base, { y: 6 }));
      side.forEach((el, i) => { if (el) rise(el, 240 + i * 60, M.base, { y: 6 }); });
      const title = desk.querySelector<HTMLElement>('[data-vault-title]');
      if (title) rise(title, 60, M.base, { y: 5 });
      motionBootSweep(popup);
    }
    // 列表行接力（boot/switch/search 三档都有，越往后越快）
    if (phase === 'boot') rows.forEach((el, i) => { if (i < 14) rise(el, 300 + i * STAG, M.base, { y: 7 }); });
    else if (phase === 'switch') rows.forEach((el, i) => { if (i < 12) rise(el, i * 20, M.fast + 60, { y: 6, blur: 3 }); });
    else if (phase === 'search') rows.forEach((el, i) => { if (i < 10) rise(el, i * 14, M.fast + 40, { y: 4, blur: 2 }); });
    // 详情/概览揭出（boot/switch/search 分档，默认档轻揭出）
    if (detail) {
      if (phase === 'boot' || phase === 'switch') revealDetail(detail, phase === 'boot' ? 220 : 40);
      else if (phase === 'search') revealDetail(detail, 30, true);
      else rise(detail, 0, M.fast + 40, { y: 4, blur: 2 });
    }
  }

  /* —— 移动端编排（≤768px 可见侧）—— */
  if (motionVisible(mob) && mob) {
    const rows = [...mob.querySelectorAll<HTMLElement>('[data-mob-body] > .bz-vault-row')];
    if (phase === 'boot') rows.forEach((el, i) => { if (i < 12) rise(el, 260 + i * STAG, M.base, { y: 7 }); });
    else if (phase === 'switch') rows.forEach((el, i) => { if (i < 10) rise(el, i * 20, M.fast + 60, { y: 6, blur: 3 }); });
    else if (phase === 'search') rows.forEach((el, i) => { if (i < 8) rise(el, i * 14, M.fast + 40, { y: 4, blur: 2 }); });
  }
}

/** 详情区（列表详情 / 概览跨栏区）分块揭出：头先落、块接力 */
function revealDetail(detail: HTMLElement, base: number, light = false): void {
  const blocks = [
    detail.querySelector<HTMLElement>('.bz-vault-dhead'),
    detail.querySelector<HTMLElement>('.bz-vault-hero'),
    detail.querySelector<HTMLElement>('.bz-vault-cards'),
    detail.querySelector<HTMLElement>('.bz-vault-two'),
  ].filter((b): b is HTMLElement => !!b);
  blocks.forEach((b, i) => rise(b, base + i * (light ? 40 : 70), light ? M.fast + 60 : M.base, { y: light ? 4 : 7 }));
  const fields = [...detail.querySelectorAll<HTMLElement>('.bz-vault-dcontent .field, .bz-vault-dcontent .bigbtns')];
  fields.forEach((f, i) => rise(f, base + blocks.length * 60 + i * 55, M.base, { y: 5 }));
  const minis = [...detail.querySelectorAll<HTMLElement>('.bz-vault-minirow')];
  minis.forEach((m, i) => { if (i < 6) rise(m, base + 260 + i * 50, M.base, { y: 4, blur: 2 }); });
}

/* ================= 面板壳：开 / 关（同步收语义下的替身退场） ================= */

/**
 * 面板打开（ui.ts show 调）：壳体入场有既有 CSS slideUp 兜底，本函数补
 * 遮罩淡入 + 顶栏标题揭出——boot 全编排由 motionRendered 接管。
 */
export function motionPanelIn(popup: HTMLElement): void {
  if (!popup || motionReduced()) return;
  const mask = document.getElementById('bz-encrypt-mask');
  if (mask) motionWaapi(mask, [{ opacity: 0 }, { opacity: 1 }], { duration: M.move, easing: E.out });
  const title = popup.querySelector<HTMLElement>('[data-vault-title]');
  if (title && motionVisible(popup)) {
    // 面板壳层动画走壳层调度（紧随其后的 renderAll 取消编排池时不得误伤）
    motionShellAfter(80, () => {
      motionWaapi(title,
        [{ opacity: 0, transform: 'translateY(5px)', filter: 'blur(3px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base, easing: E.out, fill: 'backwards' });
    });
  }
}

/**
 * 面板关闭替身（ui.ts hide 在置 display:none **之前**调用）：
 * 取面板现位，body 上放一块同位覆层演「钢门沉入暗场」，面板本体同步消失——
 * 同步收语义不被延迟，退场演出也不缺。覆层自毁，无残留。
 */
export function motionPanelCollapse(popup: HTMLElement | null): void {
  if (!popup || motionReduced()) return;
  const rect = popup.getBoundingClientRect();
  let bg = '';
  let radius = '12px';
  try {
    const cs = getComputedStyle(popup);
    bg = cs.backgroundColor;
    if (cs.borderRadius) radius = cs.borderRadius;
  } catch { /* 读不到走缺省 */ }
  const veil = motionVeil(rect, 'bz-vlt-collapse');
  if (!veil) return;
  veil.style.cssText += `background:${bg || 'var(--bz-surface-2, #20242b)'};border-radius:${radius};box-shadow:var(--bz-shadow-lg, 0 20px 60px rgba(0,0,0,.4));`;
  const anim = motionWaapi(veil,
    [{ opacity: 1, transform: 'scale(1)', filter: 'brightness(1) blur(0px)' },
     { opacity: 0, transform: 'scale(.965)', filter: 'brightness(.45) blur(5px)' }],
    { duration: M.move + 20, easing: E.out });
  motionVeilGone(veil, anim, M.move + 20);
}

/* ================= 上锁：铁门合拢（盖住 lockNow 同步重绘） ================= */

/**
 * 铁门横档合拢（ui.ts lockNow 在数据上锁前调用）：两条门闩从上下缘冲向中缝，
 * 260ms 后「咔哒」锁死（金线相触 + 一记微光），短暂停驻后再整体退场。
 * 覆层挂 **body**（按面板现位 fixed）：本域上锁广播会同步触发 onExternalLock 收起
 * 面板（master 既有语义），门在面板消失的原地继续合拢——「大门锁死后退场」，
 * 安全模式下紧随的 collapse 替身再叠一层沉没暗场。总时长 ~640ms；覆层自毁。
 */
export function motionLockSealing(popup: HTMLElement | null): void {
  if (!popup || motionReduced() || !motionVisible(popup)) return;
  const rect = popup.getBoundingClientRect();
  let radius = '12px';
  let z = 1000;
  try {
    const cs = getComputedStyle(popup);
    if (cs.borderRadius) radius = cs.borderRadius;
    z = (parseInt(cs.zIndex, 10) || 1000) + 1;
  } catch { /* 读不到走缺省 */ }
  const gate = motionVeil(rect, 'bz-vlt-gate');
  if (!gate) return;
  gate.style.cssText += `border-radius:${radius};z-index:${z};`;
  const top = document.createElement('div');
  top.className = 'bz-vlt-gate-bar is-top';
  const bot = document.createElement('div');
  bot.className = 'bz-vlt-gate-bar is-bot';
  gate.append(top, bot);
  motionWaapi(top,
    [{ transform: 'translateY(-102%)' }, { transform: 'translateY(0)' }],
    { duration: 260, easing: E.move, fill: 'forwards' });
  motionWaapi(bot,
    [{ transform: 'translateY(102%)' }, { transform: 'translateY(0)' }],
    { duration: 260, easing: E.move, fill: 'forwards' });
  // 锁死一记：金线亮度脉冲（门闩描边即封条）——铁门全程走壳层调度，
  // 紧随的 lockNow→renderAll 会取消编排池，不得波及揭幕与自毁
  motionShellAfter(268, () => {
    motionWaapi(top, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.55)' }, { filter: 'brightness(1)' }],
      { duration: 240, easing: E.out });
    motionWaapi(bot, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.55)' }, { filter: 'brightness(1)' }],
      { duration: 240, easing: E.out });
  });
  // 品牌锁芯同步拧死半圈
  const seal = popup.querySelector<HTMLElement>('.bz-vault-brand .seal');
  if (seal) motionWaapi(seal, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }],
    { duration: 460, easing: E.move });
  // 揭幕：整体退场（fill forwards 的门闩随节点一起销毁，无残留）
  motionShellAfter(430, () => {
    const out = motionWaapi(gate, [{ opacity: 1 }, { opacity: 0 }], { duration: 190, easing: E.out, fill: 'forwards' });
    const gone = () => { try { gate.remove(); } catch { /* 已摘忽略 */ } };
    if (out) out.finished.then(gone).catch(gone);
    motionShellAfter(320, gone);
  });

}

/* ================= 光缝（解锁成功 / boot 的开场白） ================= */

/** 一道斜光从左上扫到右下（门缝漏光）；注入件演完自毁 */
export function motionBootSweep(popup: HTMLElement): void {
  if (motionReduced() || !motionVisible(popup)) return;
  const sweep = document.createElement('div');
  sweep.className = 'bz-vlt-sweep';
  sweep.setAttribute('aria-hidden', 'true');
  popup.appendChild(sweep);
  const anim = motionWaapi(sweep,
    [{ transform: 'translateX(-72%)' }, { transform: 'translateX(72%)' }],
    { duration: M.impulse, easing: E.out });
  motionVeilGone(sweep, anim, M.impulse);
}

/* ================= 解锁屏：封条验印 / 拒盖 / 验讫余韵 ================= */

/**
 * 解锁屏入场（ui.ts openUnlockScreen / confirmDestroyWithPassword 挂 body 后调用）：
 * 印章带一点过冲压落（封蜡感），标题/统计/输入行接力升起。core 骨架不动。
 */
export function motionLockScreenIn(lsEl: HTMLElement): void {
  if (!lsEl || motionReduced()) return;
  const box = lsEl.querySelector<HTMLElement>('[data-ls="box"]');
  if (!box) return;
  motionWaapi(box,
    [{ opacity: 0, transform: 'translateY(16px) scale(.985)', filter: 'blur(6px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 360, easing: E.out, fill: 'backwards' });
  const seal = lsEl.querySelector<HTMLElement>('[data-ls="seal"]');
  if (seal) motionWaapi(seal,
    [{ opacity: 0, transform: 'rotate(-16deg) scale(1.55)', filter: 'blur(3px)' },
     { opacity: 1, transform: 'rotate(4deg) scale(.97)', filter: 'blur(0px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 440, easing: E.out, fill: 'backwards' });
  const lines = ['[data-ls="title"]', '[data-ls="sub"]', '[data-ls="row"]'];
  lines.forEach((sel, i) => {
    const el = lsEl.querySelector<HTMLElement>(sel);
    if (el) {
      // 解锁屏编排走壳层调度：解锁成功后的 renderAll 取消编排池时，解锁屏已在收场链上
      motionShellAfter(120 + i * 70, () => {
        motionWaapi(el,
          [{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(3px)' },
           { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
          { duration: M.base, easing: E.out, fill: 'backwards' });
      });
    }
  });
  const stats = [...lsEl.querySelectorAll<HTMLElement>('[data-ls="stats"] .bz-lockscreen-stat')];
  stats.forEach((el, i) => {
    motionShellAfter(200 + i * 60, () => {
      motionWaapi(el,
        [{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(3px)' },
         { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
        { duration: M.base, easing: E.out, fill: 'backwards' });
    });
  });
}

/**
 * 开锁验讫余韵（ui.ts 解锁/销毁确认成功分支在 close/摘 DOM **前**调用）：
 * 印章处一圈光环扩散 + 几粒金屑迸开——锁屏本体照旧同步收场，余韵挂在 body 自毁。
 */
export function motionUnlockBurst(seal: HTMLElement | null): void {
  if (!seal || motionReduced()) return;
  const rect = seal.getBoundingClientRect();
  const veil = motionVeil(rect, 'bz-vlt-burst');
  if (!veil) return;
  const ring = document.createElement('div');
  ring.className = 'bz-vlt-burst-ring';
  veil.appendChild(ring);
  for (let i = 0; i < 7; i++) {
    const bit = document.createElement('div');
    bit.className = 'bz-vlt-burst-bit';
    veil.appendChild(bit);
    const ang = (i / 7) * Math.PI * 2 + Math.random() * .6;
    const dist = 26 + Math.random() * 26;
    motionWaapi(bit,
      [{ opacity: 1, transform: 'translate(-50%,-50%) translate(0,0) scale(1)' },
       { opacity: 0, transform: `translate(-50%,-50%) translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(.4)` }],
      { duration: 380 + Math.random() * 120, easing: E.out });
  }
  const anim = motionWaapi(ring,
    [{ opacity: .95, transform: 'translate(-50%,-50%) scale(.55)' },
     { opacity: 0, transform: 'translate(-50%,-50%) scale(2.3)' }],
    { duration: 460, easing: E.out });
  motionVeilGone(veil, anim, 460);
}

/** 密码错误拒盖：整盒水平三摇（固定节拍，与输入内容无关——涉密纪律） */
export function motionRejectShake(lsEl: HTMLElement): void {
  if (!lsEl || motionReduced()) return;
  const box = lsEl.querySelector<HTMLElement>('[data-ls="box"]');
  if (!box) return;
  motionWaapi(box,
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' },
     { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }],
    { duration: 300, easing: E.out });
}

/* ================= 预览窗：升起 + 密文显影 + 原图曝光 ================= */

/** 预览弹窗升起 + 一道短光缝（骨架先显，内容后到——与既有异步填充节奏同拍） */
export function motionPreviewIn(popup: HTMLElement): void {
  if (!popup || motionReduced() || !motionVisible(popup)) return;
  motionWaapi(popup,
    [{ opacity: 0, transform: 'translateY(12px) scale(.985)', filter: 'blur(5px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 300, easing: E.out, fill: 'backwards' });
  motionBootSweep(popup);
}

/**
 * 密文显影（解密内容落定时调）：blur+亮度从雾面收拢到清晰——预览正文、日记正文
 * 共用语汇。节拍恒定 460ms，不随内容长短变化（涉密纪律）。
 */
export function motionRevealBody(el: HTMLElement | null): void {
  if (!el || motionReduced() || !motionVisible(el)) return;
  motionWaapi(el,
    [{ opacity: .3, filter: 'blur(7px) brightness(1.35)' },
     { opacity: 1, filter: 'blur(0px) brightness(1)' }],
    { duration: 460, easing: E.out, fill: 'backwards' });
}

/** 原图/视频原始层加载完成：曝光一闪（照片在灯箱下亮起来的那一下） */
export function motionOriginalFlash(slot: HTMLElement): void {
  if (!slot || motionReduced()) return;
  const media = slot.querySelector<HTMLElement>('img.bz-encrypt-preview-media, video.bz-encrypt-preview-video');
  const target = media || slot;
  motionWaapi(target,
    [{ filter: 'brightness(1.6) contrast(1.05)' }, { filter: 'brightness(1) contrast(1)' }],
    { duration: 300, easing: E.out });
}

/* ================= 体检窗：入场 + 巡逻扫描线 + 报告揭出 ================= */

/** 体检窗入场：盒体升起 + 光缝短扫 */
export function motionHealthIn(box: HTMLElement): void {
  if (!box || motionReduced() || !motionVisible(box)) return;
  motionWaapi(box,
    [{ opacity: 0, transform: 'translateY(12px) scale(.985)', filter: 'blur(5px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 300, easing: E.out, fill: 'backwards' });
  motionBootSweep(box);
}

/** 扫描线开（runHealthScan 开始）：巡逻光带在报告体内往返，句柄入池，扫完 motionScanStop 必收 */
export function motionScanStart(box: HTMLElement | null): void {
  motionScanStop(box); // 幂等
  if (!box || motionReduced()) return;
  const body = box.querySelector<HTMLElement>('.bz-encrypt-health-body');
  if (!body || !motionVisible(body)) return;
  const host = document.createElement('div');
  host.className = 'bz-vlt-scanhost';
  host.setAttribute('aria-hidden', 'true');
  const beam = document.createElement('div');
  beam.className = 'bz-vlt-scanbeam';
  host.appendChild(beam);
  box.appendChild(host);
  motionLoopAdd('encrypt-scan', () => { try { host.remove(); } catch { /* 已摘忽略 */ } });
}

/** 扫描线收（runHealthScan finally / 锁定态分支）：句柄池摘除，光带退场 */
export function motionScanStop(box: HTMLElement | null): void {
  void box;
  motionLoopStop('encrypt-scan');
}

/** 体检报告落定：摘要行验讫一闪 + 各分区接力揭出（renderHealthReport 尾调用） */
export function motionReportIn(body: HTMLElement): void {
  if (!body || motionReduced()) return;
  const summary = body.querySelector<HTMLElement>('.bz-encrypt-health-summary');
  if (summary) motionWaapi(summary,
    [{ opacity: 0, transform: 'translateY(5px)', filter: 'blur(3px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.base, easing: E.out, fill: 'backwards' });
  const secs = [...body.querySelectorAll<HTMLElement>('.bz-encrypt-health-section, .bz-encrypt-health-item, .bz-encrypt-health-hint')];
  secs.forEach((el, i) => { if (i < 12) rise(el, 90 + i * 35, M.base, { y: 4, blur: 2 }); });
}

/** 扫描中实时发现行：微揭出（onProgress 追加处调用） */
export function motionFindRowIn(row: HTMLElement): void {
  if (!row || motionReduced()) return;
  motionWaapi(row,
    [{ opacity: 0, transform: 'translateX(-6px)', filter: 'blur(2px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: M.fast + 40, easing: E.out, fill: 'backwards' });
}

/* ================= 状态栏：锁芯小转 ================= */

/** 状态栏锁图标开合小转（attachStatusBar 解锁态变化时；图标容器转动，几何不变） */
export function motionStatusbarSpin(el: HTMLElement | null): void {
  if (!el || motionReduced()) return;
  const ic = el.querySelector<HTMLElement>('.bz-vault-ic');
  if (!ic) return;
  motionWaapi(ic,
    [{ transform: 'rotate(-100deg) scale(.7)', opacity: .4 },
     { transform: 'rotate(10deg) scale(1.08)', opacity: 1 },
     { transform: 'none', opacity: 1 }],
    { duration: 360, easing: E.out });
}
