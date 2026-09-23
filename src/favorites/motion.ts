/**
 * 收藏本动效层（2026-09-22 动效批，用户命题：与影院/备忘录/首页同量级，布局零改动，
 * 按「收藏本自己的语义」出招）。
 *
 * ── 语义词汇表（动效全部从这里长出来，不借别的域的招） ──
 *   亚麻板      面板本体：亚麻十字纹软木板——开场是「把板支上台面」（微倾立起 → 收平），
 *               收场是「把板放回抽屉」（沉一下再合眼）。
 *   磁贴        标签贴纸（顶上一枚磁点）：入场是「啪地吸上板」（从上方带过冲落下）；
 *               换筛后激活贴纸「咔哒」一声定住；指尖按下微陷（磁贴是硬的）。
 *   卡片墙      白卡贴在板上：入场是「贴卡」——微微斜着按上去再压平，胶带随后补一记压实。
 *   收藏落定    新卡上板：从手里放下去（略高、略大、微倾）→ 压平 → 一道光泽扫过（刚贴的胶还亮）。
 *   拾取        点卡/右键/长按：卡被拿起来看一眼又放回（一次呼吸起伏）。
 *   按压        按住卡片：把卡往板上按实（scale .98），松手回弹——胶带的物理感。
 *   置顶        金圈卡飞到队首：全墙 FLIP 让位（旧位 → 新位一次滑到位），置顶卡落位时金光一提。
 *   冷存        归档箱：进去是「折起来收走」（顺时针折角下沉），出来是「回暖升起」；
 *               直接开进归档箱的墙，卡片不带模糊入场（冷存是清楚的旧物，只是褪色）。
 *   删除        揉掉：逆时针一缩一糊，像被揉成团扔走。
 *   撤销        复贴：卡从上方落回来，胶带再压实一次。
 *   表单        亚麻卡弹层：字段一行行浮上来（纸面一行行显字）；出错整行摇头；
 *               置顶滑钮/标签胶囊有按弹；AI 整理中星芒图标轻摆（功能性指示，不入台账节奏）。
 *   标签管理    设置面板里的行：重排后整列重新落定（上移/下移的回声）。
 *   空态        板上没卡：空态图标缓缓漂浮（板还在等你贴第一张）。
 *
 * ── 纪律 ──
 *  - 纯浏览器 API，不 import obsidian / core 服务（评审壳与插件两侧同跑）。
 *  - 台账对齐 cinema/motion.ts（issue 400 口径）：fast 160 / move 200 / base 280 / impulse 740，
 *    接力 30ms；揭示用 out 曲线，位移/让位用 move 曲线。加载循环（AI 摆动 / 空态漂浮）是
 *    功能性指示，不入台账。
 *  - reduced-motion（评审期口径）：默认无视系统「减少动态效果」放完整演出；?rm=1 显式直达
 *    终态。jsdom / 无 WAAPI 宿主经 waapi 落最后一帧，域内测试零感知。
 *  - 注入件（光泽扫层）一律 absolute + pointer-events:none + aria-hidden，演出完即摘；
 *    只动 transform/opacity/filter，几何零改写，终态 UI 与无动效版一致。
 *  - markup 纯层一字不改；本层只在 ui.ts 生命周期挂点被调用。
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
function canHover(): boolean {
  try { return typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches; }
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

/** 延时调度（面板级取消，防快速刷新时编排叠加） */
const timers = new Set<ReturnType<typeof setTimeout>>();
function after(ms: number, fn: () => void): void {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}
function cancelPending(): void {
  timers.forEach(clearTimeout); timers.clear();
}

/** 按 data-fav-id 找卡（id 来自数据，容错非常规字符——querySelector 失败退化为遍历） */
function findCard(board: HTMLElement, id: string): HTMLElement | null {
  try {
    const hit = board.querySelector<HTMLElement>(`.bz-fav-card[data-fav-id="${CSS.escape(id)}"]`);
    if (hit) return hit;
  } catch { /* CSS.escape 缺席或选择器异常，走遍历 */ }
  return board.querySelector<HTMLElement>(`.bz-fav-card[data-fav-id="${id.replace(/"/g, '')}"]`);
}

/* ================= 面板壳：支板 / 收板 ================= */

/** 退场动画 id（2026-09-23 修复，对齐 home 口径）：fill:forwards 会把末帧永久钉在动画层，
    收口不 cancel、重开不按 id 撤残留 → 二次打开入场播完后旧退场重新接管（透明/闪烁） */
const EXIT_ANIM_ID = 'bz-fav-exit';
const EXIT_MASK_ANIM_ID = 'bz-fav-exit-mask';

/** 撤掉指定 id 的残留动画（getAnimations 不可用的宿主安全跳过） */
function cancelAnimsBy(el: HTMLElement, ids: string[]): void {
  if (typeof el.getAnimations !== 'function') return;
  for (const a of el.getAnimations()) {
    if (ids.includes(a.id)) { try { a.cancel(); } catch { /* 已结束 */ } }
  }
}

/** 开场：亚麻板支上台面——微倾立起 → 收平；遮罩同步睁眼 */
export function motionPanelIn(overlay: HTMLElement): void {
  const panel = overlay.querySelector<HTMLElement>('.bz-fav-panel');
  if (!panel) return;
  cancelAnimsBy(panel, [EXIT_ANIM_ID]); // 撤退场残留（动画层钉值内联样式清不掉）
  cancelAnimsBy(overlay, [EXIT_MASK_ANIM_ID]);
  panel.style.opacity = ''; panel.style.transform = ''; panel.style.filter = ''; // 清退场残留
  waapi(overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: M.move + 40, easing: E.out });
  waapi(panel,
    [{ opacity: 0, transform: 'translateY(18px) scale(.972) rotate(-.4deg)', filter: 'blur(10px)' },
     { opacity: 1, transform: 'translateY(-2px) scale(1.004) rotate(.15deg)', offset: .72 },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 460, easing: E.out });
}

/**
 * 收板 = 先演 200ms 退场再摘 DOM（done 由调用方收口）。兜底走自持 setTimeout——
 * 面板关闭会 motionTeardown 清编排计时器，收板兜底不能被自己人掐掉。
 * 宿主不支持 WAAPI（测试 / 老宿主）：同步收口，绝不让 DOM 晚走。
 */
export function motionPanelOut(overlay: HTMLElement, done: () => void): void {
  const panel = overlay.querySelector<HTMLElement>('.bz-fav-panel');
  if (!panel) { done(); return; }
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    // 收口即撤退场动画：forwards 钉住的末帧不得活到下一次打开（2026-09-23 修复）
    try { if (maskAnim && maskAnim.playState !== 'idle') maskAnim.cancel(); } catch { /* 已收口忽略 */ }
    try { if (a && a.playState !== 'idle') a.cancel(); } catch { /* 已收口忽略 */ }
    done();
  };
  let maskAnim: Animation | null = waapi(overlay, [{ opacity: 1 }, { opacity: 0 }],
    { duration: M.fast + 40, easing: E.out, fill: 'forwards', id: EXIT_MASK_ANIM_ID });
  const a = waapi(panel,
    [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
     { opacity: 0, transform: 'translateY(12px) scale(.982) rotate(.25deg)', filter: 'blur(6px)' }],
    { duration: M.fast + 40, easing: E.out, fill: 'forwards', id: EXIT_ANIM_ID });
  if (!a) { finish(); return; }
  a.finished.then(finish).catch(finish);
  setTimeout(finish, M.fast + 120);
}

/* ================= 渲染完成：首屏编排 / 刷新静默 ================= */

export function motionRendered(overlay: HTMLElement, boot: boolean): void {
  cancelPending(); // 新渲染覆盖旧编排（对齐 cinema/home clearSoftRender 口径）
  const panel = overlay.querySelector<HTMLElement>('.bz-fav-panel');
  if (!panel) return;
  const board = overlay.querySelector<HTMLElement>('[data-fav-content]');
  if (!boot) {
    if (board) ensureEmptyFloat(board); // 静默路径只补挂空态漂浮（innerHTML 重建会冲掉循环）
    return;
  }
  if (reduced()) return; // 评审模拟 RM：内容已由 render 直接落终态，零编排

  /* —— 头行「收藏本」：标题先落定（板上的名牌） —— */
  const h1 = panel.querySelector<HTMLElement>('.bz-fav-head h1');
  if (h1) waapi(h1,
    [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.base, easing: E.out, fill: 'both' });

  /* —— 磁贴行：磁贴依次「吸」上板（带过冲的落点 = 磁吸的哒的一声；接力 30ms，前 14 枚，其余同波） —— */
  const chips = [...panel.querySelectorAll<HTMLElement>('[data-fav-tags] button')];
  chips.forEach((chip, i) => {
    waapi(chip,
      [{ opacity: 0, transform: 'translateY(-9px) scale(1.16)', filter: 'blur(2px)' },
       { opacity: 1, transform: 'translateY(1px) scale(.97)', offset: .68 },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base + 60, delay: 60 + Math.min(i, 13) * STAG, easing: E.out, fill: 'both' });
  });

  /* —— 卡片墙：贴卡。斜着按上去再压平（先快后缓），胶带随后补一记压实；
      归档箱视图不带模糊帧（冷存是清楚的旧物，只是褪色——终态 CSS 的 grayscale 不被覆盖） —— */
  if (board) {
    const cards = [...board.querySelectorAll<HTMLElement>('.bz-fav-card')];
    const cold = cards[0]?.classList.contains('bz-fav-arch') ?? false;
    cards.forEach((card, i) => {
      const delay = 200 + Math.min(i, 16) * STAG;
      if (cold) {
        // 冷存终态 = CSS 的 .bz-fav-arch（opacity .5 + grayscale .5）：fill both 会把末帧
        // 永久钉住，末帧必须就是归档视觉本身，否则透明弱化被 opacity:1 盖掉（2026-09-23 修复）
        waapi(card,
          [{ opacity: 0, transform: 'translateY(8px) rotate(1.2deg) scale(.985)' },
           { opacity: .5, filter: 'grayscale(.5)', transform: 'none' }],
          { duration: M.base + 100, delay, easing: E.out, fill: 'both' });
      } else {
        waapi(card,
          [{ opacity: 0, transform: 'translateY(12px) rotate(2deg) scale(.955)', filter: 'blur(4px)' },
           { opacity: 1, transform: 'translateY(2px) rotate(-.6deg) scale(1.004)', offset: .7, filter: 'blur(0px)' },
           { opacity: 1, transform: 'none' }],
          { duration: M.base + 90, delay, easing: E.out, fill: 'both' });
        const tape = card.querySelector<HTMLElement>('.bz-fav-tape');
        if (tape) tapePress(tape, delay + 140);
      }
    });
    const empty = board.querySelector<HTMLElement>('.bz-fav-empty');
    if (empty && !cards.length) {
      waapi(empty,
        [{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'none' }],
        { duration: M.base + 80, delay: 240, easing: E.out, fill: 'both' });
    }
    ensureEmptyFloat(board);
  }
}

/* ================= 磁贴切换筛选：揭下旧墙 → 重写 → 新墙轻浮上板 ================= */

/**
 * 换筛 = 重新排一张板。**重写先行（同步）**——评审壳自检与测试对「点磁贴 → DOM 立即就位」
 * 有 50ms 级契约，本函数绝不推迟重写；表现层只负责「换板」的入场编排：
 * 整板微暗一拍回亮（换了一张板的手感）→ 新卡轻浮上板（比首屏短促）→ 激活磁贴「咔哒」定住。
 * 旧墙不做揭下波——那是推迟重写才换得来的画面，契约优先。
 */
export function motionFilterSwitch(board: HTMLElement, tagsRow: HTMLElement | null, rewrite: () => void): void {
  rewrite();
  if (reduced() || typeof board.animate !== 'function') return;
  waapi(board,
    [{ opacity: .55, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.fast + 60, easing: E.out });
  const fresh = board.querySelectorAll<HTMLElement>('.bz-fav-card');
  const cold = !!board.querySelector('.bz-fav-card.bz-fav-arch');
  fresh.forEach((card, i) => {
    waapi(card,
      // 冷存末帧 = 归档视觉本身（.bz-fav-arch）：fill both 钉末帧，别用 opacity:1 盖掉褪色
      cold
        ? [{ opacity: 0, transform: 'translateY(7px) rotate(1deg) scale(.99)' }, { opacity: .5, filter: 'grayscale(.5)', transform: 'none' }]
        : [{ opacity: 0, transform: 'translateY(9px) rotate(.8deg) scale(.985)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: Math.min(i, 14) * STAG, easing: E.out, fill: 'both' });
  });
  const ne = board.querySelector<HTMLElement>('.bz-fav-empty');
  if (ne) waapi(ne, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
    { duration: M.base, easing: E.out, fill: 'both' });
  if (tagsRow) chipSnap(tagsRow);
  ensureEmptyFloat(board);
}

/** 换筛落定：激活磁贴「咔哒」一记（磁吸到位的回声） */
function chipSnap(row: HTMLElement): void {
  const on = row.querySelector<HTMLElement>('button.bz-fav-on');
  if (!on) return;
  waapi(on,
    [{ transform: 'scale(1)' }, { transform: 'scale(1.13)', offset: .4 }, { transform: 'scale(.97)', offset: .72 }, { transform: 'none' }],
    { duration: M.base - 20, easing: E.out });
}

/* ================= 磁贴手感：悬停微浮 / 按下微陷（委托绑行，行内存活卡重建） ================= */

export function motionBindChipFeel(row: HTMLElement): void {
  if (row.dataset.favmFeel) return;
  row.dataset.favmFeel = '1';
  const pressed = new WeakMap<HTMLElement, number>(); // chip → 入场时刻（防悬停与按下打架）
  row.addEventListener('pointerover', (e) => {
    if (!canHover() || reduced()) return;
    const chip = (e.target as HTMLElement).closest?.('button');
    if (!chip || !row.contains(chip)) return;
    if ((e.relatedTarget as HTMLElement | null)?.closest?.('button') === chip) return; // 行内子元素移动不重放
    pressed.delete(chip);
    waapi(chip, [{ transform: 'translateY(0)' }, { transform: 'translateY(-1.5px)' }], { duration: M.fast, easing: E.out });
  });
  row.addEventListener('pointerout', (e) => {
    const chip = (e.target as HTMLElement).closest?.('button');
    if (!chip || !row.contains(chip)) return;
    if ((e.relatedTarget as HTMLElement | null)?.closest?.('button') === chip) return;
    if (pressed.get(chip)) return; // 正被按住不回落
    waapi(chip, [{ transform: 'translateY(-1.5px)' }, { transform: 'translateY(0)' }], { duration: M.fast, easing: E.out });
  });
  row.addEventListener('pointerdown', (e) => {
    if (reduced()) return;
    const chip = (e.target as HTMLElement).closest?.('button');
    if (!chip || !row.contains(chip)) return;
    pressed.set(chip, Date.now());
    waapi(chip, [{ transform: 'scale(1)' }, { transform: 'scale(.94)' }], { duration: 110, easing: E.out, fill: 'forwards' });
  });
  const release = (e: Event): void => {
    const chip = (e.target as HTMLElement).closest?.('button');
    if (!chip || !pressed.get(chip)) return;
    pressed.delete(chip);
    waapi(chip, [{ transform: 'scale(.94)' }, { transform: 'scale(1.04)', offset: .6 }, { transform: 'none' }], { duration: M.base - 60, easing: E.out });
  };
  row.addEventListener('pointerup', release);
  row.addEventListener('pointercancel', release);
  row.addEventListener('pointerleave', release);
}

/* ================= 卡片手感：按实 / 拾取 ================= */

/** 按住卡片 = 把卡往板上按实；松手回弹（胶带物理感；委托绑内容区，重建免疫） */
export function motionBindCardFeel(content: HTMLElement): void {
  if (content.dataset.favmFeel) return;
  content.dataset.favmFeel = '1';
  let held: HTMLElement | null = null;
  content.addEventListener('pointerdown', (e) => {
    if (reduced()) return;
    const card = (e.target as HTMLElement).closest?.('[data-fav-id]') as HTMLElement | null;
    if (!card) return;
    held = card;
    waapi(card, [{ transform: 'scale(1)' }, { transform: 'scale(.98)' }], { duration: 110, easing: E.out, fill: 'forwards' });
  });
  const release = (e: Event): void => {
    const card = (e.target as HTMLElement).closest?.('[data-fav-id]') as HTMLElement | null;
    const target = card ?? held;
    if (!target) return;
    if (card && card !== held) return;
    held = null;
    waapi(target, [{ transform: 'scale(.98)' }, { transform: 'scale(1.005)', offset: .62 }, { transform: 'none' }], { duration: M.move + 40, easing: E.out });
  };
  content.addEventListener('pointerup', release);
  content.addEventListener('pointercancel', release);
  content.addEventListener('pointerleave', release);
}

/** 拾取：点卡/右键/长按时卡被拿起来看一眼又放回（一次呼吸起伏，无 fill 自动归位） */
export function motionCardPick(card: HTMLElement): void {
  if (reduced()) return;
  waapi(card,
    [{ transform: 'none' }, { transform: 'translateY(-3px) scale(1.025)', offset: .45 }, { transform: 'none' }],
    { duration: M.move + 160, easing: E.out });
}

/* ================= 收藏落定 / 编辑 / 复贴：单卡高光 ================= */

/** 胶带压实（入场/落定的补拍；rot 对齐三种胶带变体的终态角度，帧内不得丢 translateX(-50%)） */
function tapePress(tape: HTMLElement, delay: number): void {
  const rot = tape.classList.contains('bz-fav-tape--r') ? 2 : tape.classList.contains('bz-fav-tape--g') ? -1 : -2;
  waapi(tape,
    [{ transform: `translateX(-50%) rotate(${rot}deg) scaleX(.35)`, opacity: .4 },
     { transform: `translateX(-50%) rotate(${rot}deg) scaleX(1.12)`, offset: .7 },
     { transform: `translateX(-50%) rotate(${rot}deg) scaleX(1)`, opacity: 1 }],
    { duration: M.move + 80, delay, easing: E.out });
}

/** 光泽扫层（刚贴的胶还亮）：注入 absolute + 不吃事件 + aria-hidden，演出完即摘 */
function sheen(card: HTMLElement, delay: number): void {
  if (reduced() || card.querySelector('.bz-favm-sheen')) return;
  const wrap = document.createElement('span');
  wrap.className = 'bz-favm-sheen';
  wrap.setAttribute('aria-hidden', 'true');
  const band = document.createElement('i');
  band.className = 'bz-favm-sheen-band';
  wrap.appendChild(band);
  card.appendChild(wrap);
  after(delay, () => {
    const a = waapi(band,
      [{ transform: 'translateX(-140%) skewX(-18deg)' }, { transform: 'translateX(360%) skewX(-18deg)' }],
      { duration: 620, easing: E.out });
    after(a ? 680 : 0, () => wrap.remove());
  });
}

/**
 * 单卡高光（reload 后按 id 命中；卡不在当前视图 = 静默）：
 *   add     收藏落定——从手里放下去压平，胶带补拍，光泽扫过
 *   edit    轻提一拍（改过了，看一眼）
 *   pin     金光一提（配 FLIP 用；单用也有落位感）
 *   restore 复贴——从上方落回来，胶带再压实一次
 */
export function motionCardLanded(board: HTMLElement, id: string, kind: 'add' | 'edit' | 'pin' | 'restore'): void {
  if (reduced()) return;
  const card = findCard(board, id);
  if (!card) return;
  if (kind === 'add') {
    waapi(card,
      [{ opacity: .4, transform: 'translateY(-12px) scale(1.1) rotate(-1.2deg)', filter: 'brightness(1.12)' },
       { opacity: 1, transform: 'translateY(2px) scale(.992) rotate(.5deg)', offset: .62, filter: 'brightness(1.05)' },
       { opacity: 1, transform: 'none', filter: 'brightness(1)' }],
      { duration: M.base + 160, easing: E.out });
    tapePress(card.querySelector<HTMLElement>('.bz-fav-tape') as HTMLElement, 100);
    sheen(card, 140);
  } else if (kind === 'edit') {
    waapi(card,
      [{ transform: 'none', filter: 'brightness(1)' },
       { transform: 'scale(1.018)', offset: .5, filter: 'brightness(1.07)' },
       { transform: 'none', filter: 'brightness(1)' }],
      { duration: M.base + 80, easing: E.out });
  } else if (kind === 'pin') {
    waapi(card,
      [{ transform: 'none', filter: 'brightness(1)' },
       { transform: 'translateY(-6px) scale(1.02)', offset: .5, filter: 'brightness(1.16)' },
       { transform: 'none', filter: 'brightness(1)' }],
      { duration: M.base + 140, easing: E.out });
  } else {
    waapi(card,
      [{ opacity: 0, transform: 'translateY(-14px) scale(1.05)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base + 100, easing: E.out });
    tapePress(card.querySelector<HTMLElement>('.bz-fav-tape') as HTMLElement, 120);
  }
}

/* ================= 置顶飞行：全墙 FLIP 让位 ================= */

/** 旧位快照（pin 动作前、innerHTML 重建前调；非动画宿主返回 null → 退化为单卡高光） */
export type MotionRects = Map<string, { x: number; y: number }>;

export function motionCaptureRects(board: HTMLElement | null): MotionRects | null {
  if (!board || reduced() || typeof board.animate !== 'function') return null;
  const map: MotionRects = new Map();
  board.querySelectorAll<HTMLElement>('.bz-fav-card[data-fav-id]').forEach((c) => {
    const r = c.getBoundingClientRect();
    map.set(c.dataset.favId as string, { x: r.left, y: r.top });
  });
  return map;
}

/**
 * 置顶恒最前的可视化：重建后各卡从旧位滑到新位（一次 move 让位），置顶卡落位时金光一提。
 * 只有「全员有旧位」才整墙 FLIP（数据集没变），缺位（视图切换竞态）退化为单卡高光。
 */
export function motionPinFlip(board: HTMLElement, before: MotionRects | null, pinnedId: string): void {
  if (!before || before.size === 0 || reduced()) {
    if (!reduced()) motionCardLanded(board, pinnedId, 'pin');
    return;
  }
  let played = false;
  board.querySelectorAll<HTMLElement>('.bz-fav-card[data-fav-id]').forEach((card) => {
    const old = before.get(card.dataset.favId as string);
    if (!old) return;
    const r = card.getBoundingClientRect();
    const dx = old.x - r.left, dy = old.y - r.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    played = true;
    if (card.dataset.favId === pinnedId) {
      waapi(card,
        [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`, filter: 'brightness(1)' },
         { transform: 'translate(0, -5px) scale(1.02)', offset: .78, filter: 'brightness(1.16)' },
         { transform: 'none', filter: 'brightness(1)' }],
        { duration: M.move + 140, easing: E.move });
    } else {
      waapi(card,
        [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` }, { transform: 'none' }],
        { duration: M.move + 60, delay: 30, easing: E.move });
    }
  });
  if (!played) motionCardLanded(board, pinnedId, 'pin');
}

/* ================= 离场：归档折收 / 删除揉掉 / 取消归档回暖升起 ================= */

/**
 * 卡先退场、墙再补位：返回退场 Promise（写盘 Promise.all 等它），动画结束后再 reload。
 * 无动画宿主 / 卡不在视图 / ?rm=1：立即兑现，时序与今日完全一致（测试零感知）。
 */
export function motionCardDepart(board: HTMLElement | null, id: string, kind: 'archive' | 'del' | 'unarchive'): Promise<void> {
  const card = board ? findCard(board, id) : null;
  if (!card || reduced() || typeof card.animate !== 'function') return Promise.resolve();
  return new Promise<void>((res) => {
    let settled = false;
    const finish = (): void => { if (!settled) { settled = true; res(); } };
    const frames: Keyframe[] = kind === 'del'
      ? [{ opacity: 1, transform: 'none', filter: 'blur(0px)' },
         { opacity: 0, transform: 'rotate(-3deg) scale(.82) translateY(6px)', filter: 'blur(4px)' }]
      : kind === 'archive'
        ? [{ opacity: 1, transform: 'none' },
           { opacity: 0, transform: 'rotate(2deg) scale(.9) translateY(10px)' }]
        : [{ opacity: 1, transform: 'none' },
           { opacity: 0, transform: 'translateY(-12px) scale(1.03)' }];
    const a = waapi(card, frames, { duration: M.move + (kind === 'del' ? 0 : 40), easing: E.out, fill: 'forwards' });
    if (!a) { finish(); return; }
    a.finished.then(finish).catch(finish);
    setTimeout(finish, M.move + 140); // 自持兜底：动画事件丢失也不能卡住写盘链
  });
}

/* ================= 表单：纸面显字 / 滑钮与胶囊按弹 / 出错摇头 / AI 星芒 ================= */

/** 表单字段逐行浮上来（纸面一行行显字；标签编辑弹窗同皮同用） */
export function motionFormIn(popup: HTMLElement): void {
  if (reduced()) return;
  const rows = [
    ...popup.querySelectorAll<HTMLElement>(':scope > h2, :scope > .bz-fav-fld, :scope > .bz-fav-err, :scope > .bz-fav-btns'),
  ];
  rows.forEach((el, i) => {
    waapi(el,
      [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(2px)' },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: M.base, delay: i * 24, easing: E.out, fill: 'both' });
  });
}

/** 置顶滑钮按弹（开合的回声；滑轨本体动画归 CSS transition） */
export function motionSwitchPop(el: HTMLElement): void {
  if (reduced()) return;
  waapi(el,
    [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: .42 }, { transform: 'none' }],
    { duration: M.base - 40, easing: E.out });
}

/** 表单标签胶囊选中/取消按弹（选中多一记提亮 = 贴上一枚新徽章） */
export function motionPickPop(btn: HTMLElement, on: boolean): void {
  if (reduced()) return;
  waapi(btn,
    on
      ? [{ transform: 'scale(.92)', filter: 'brightness(1)' }, { transform: 'scale(1.07)', offset: .55, filter: 'brightness(1.22)' }, { transform: 'none', filter: 'brightness(1)' }]
      : [{ transform: 'scale(.94)' }, { transform: 'none' }],
    { duration: M.base - 60, easing: E.out });
}

/** 校验错误：错误行摇头（不挪几何，纯 transform 抖动） */
export function motionErrShake(errEl: HTMLElement): void {
  if (reduced()) return;
  waapi(errEl,
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)', offset: .2 },
     { transform: 'translateX(4px)', offset: .45 }, { transform: 'translateX(-2px)', offset: .72 },
     { transform: 'translateX(0)' }],
    { duration: M.base + 20, easing: E.out });
}

/* AI 整理中：星芒轻摆（功能性指示，不入台账节奏；off 取消） */
const aiAnims = new Map<HTMLElement, Animation>();

export function motionAiBusy(btn: HTMLElement, on: boolean): void {
  const prev = aiAnims.get(btn);
  if (prev) { prev.cancel(); aiAnims.delete(btn); }
  if (!on || reduced()) return;
  const star = btn.querySelector<HTMLElement>('svg');
  const target = star ?? btn;
  const a = waapi(target,
    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-14deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0deg)' }],
    { duration: 1100, iterations: Infinity, easing: 'ease-in-out' });
  if (a) aiAnims.set(btn, a);
}

/* ================= 标签管理：整列重新落定 ================= */

/** 设置面板标签管理列表（重排/增删后整列轻落 = 上移下移的回声） */
export function motionTagMgrRows(wrap: HTMLElement): void {
  if (reduced()) return;
  [...wrap.querySelectorAll<HTMLElement>('.bz-fav-tagmgr-row, .bz-fav-tagmgr-add')].forEach((el, i) => {
    waapi(el,
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: M.base, delay: Math.min(i, 10) * STAG, easing: E.out, fill: 'both' });
  });
}

/* ================= 空态：图标漂浮 ================= */

const floatAnims = new Map<HTMLElement, Animation>();

/** 板上没卡：空态图标缓缓漂浮（innerHTML 重建后由 motionRendered 补挂；元素级幂等） */
function ensureEmptyFloat(board: HTMLElement): void {
  const ic = board.querySelector<HTMLElement>('.bz-empty .bz-empty-ic');
  if (!ic || ic.dataset.favmFloat) return;
  ic.dataset.favmFloat = '1';
  const a = waapi(ic,
    [{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }],
    { duration: 2600, iterations: Infinity, easing: 'ease-in-out' });
  if (a) floatAnims.set(ic, a);
}

/* ================= 清场 ================= */

/** 面板关闭/重开时清空编排：待发计时器、漂浮与 AI 循环、残留光泽扫层 */
export function motionTeardown(): void {
  cancelPending();
  for (const a of floatAnims.values()) { try { a.cancel(); } catch { /* 已结束 */ } }
  floatAnims.clear();
  for (const a of aiAnims.values()) { try { a.cancel(); } catch { /* 已结束 */ } }
  aiAnims.clear();
  try { document.querySelectorAll('.bz-favm-sheen').forEach((el) => el.remove()); } catch { /* 无文档环境 */ }
}

/* ================= 评审便利：#replay 重播首屏编排（原型壳加载即开面板，编排可能一闪而过；
   带 #replay 打开（或刷新）会在 0.6s 后重播一次。ui.ts 在 openPanel 里挂 __bzFavReplay。 ================= */
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#replay') return;
    location.hash = '';
    const replay = (window as unknown as Record<string, unknown>).__bzFavReplay as (() => void) | undefined;
    if (typeof replay === 'function') setTimeout(replay, 600);
  });
  if (location.hash === '#replay') {
    const wait = (): void => {
      const replay = (window as unknown as Record<string, unknown>).__bzFavReplay as (() => void) | undefined;
      if (typeof replay === 'function') { location.hash = ''; setTimeout(replay, 600); }
      else setTimeout(wait, 120);
    };
    setTimeout(wait, 120);
  }
}
