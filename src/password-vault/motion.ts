/**
 * 密码本动效层（password-vault 域，2026-09-22 动效批；与保险库同批同台账，各说各的行话）。
 *
 * 语义词汇表（密码本自己的行话，与保险库共锁同库但演出互不串味）：
 *   - 金印（seal）：品牌印章与锁屏金印的压落 / 微正冠 / 待机辉光——印章是密码本的脸面，
 *     开锁 = 金印拧开，锁屏候场 = 金印呼吸；
 *   - 显影（reveal）：点眼后明文从雾面里浮出（blur+亮度收拢 + 一道扫光）——恒定节拍
 *     260ms，不随密码长度变（涉密纪律：不泄露明文时序）；掩回不演，瞬间归掩更安全；
 *   - 金屑（burst）：复制得手 / 开锁验讫迸出的几粒金屑，body 自毁覆层，演完即散；
 *   - 封蜡（dialog）：添加/编辑弹窗升起时一道金线扫过卡面，像火漆封缄；
 *   - 快取（qp）：快速取密选择器弹入接力，选中行一道金光抽出——钥匙离库。
 *
 * 原则（与 encrypt/motion.ts 同一批纪律）：
 *  - 只动表现不动布局：注入件 fixed/absolute + pointer-events:none + aria-hidden，
 *    演完自毁；只动 transform/opacity/filter，几何从不改写；
 *  - 台账同源（M/E/STAG 从 encrypt/motion 复用导出，两域一块表）；
 *  - reduced-motion：默认无视系统 RM 放完整演出，?rm=1 直达终态；无 WAAPI 落终态；
 *  - 退场纪律：面板 hide 同步收 display（测试锁死），退场演出走「同步收 + body 替身
 *    覆层」；常驻节点上不留 fill:forwards 残留；
 *  - 渲染意图（boot/switch/search）arm 即置位、motionRendered 消费即熄，刷新静默；
 *  - 行为层运行时 dataset 标注（data-pwv-entry / data-pwv-plat）只作动效锚点，
 *    与 loadOriginal 的 slot.dataset 先例同口径，无视觉与布局影响；
 *  - 纯浏览器 API，禁 import obsidian / core 服务；底层封装复用 encrypt/motion 导出
 *    （依赖方向 password-vault → encrypt 与既有 getSafeManager 同向，ADR-0002 允许）。
 */

import {
  M, E, STAG,
  motionReduced, motionWaapi, motionAfter, motionShellAfter, motionCancelPending,
  motionVeil, motionVeilGone, motionVisible,
  motionLoopAdd, motionLoopStop,
  motionTeardown,
} from '../encrypt/motion';

export { motionTeardown };

/** 单元素揭出（上浮 + 去雾；渲染编排池——被下一次 motionRendered 覆盖是预期） */
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

/** 壳层揭出（独立池：面板/锁屏/弹层动画不随 renderAll 的编排取消而丢） */
function shellRise(
  el: HTMLElement,
  delay: number,
  dur: number = M.base,
  from: { y?: number; blur?: number } = {},
): void {
  const y = from.y ?? 6;
  const blur = from.blur ?? 3;
  motionShellAfter(delay, () => {
    motionWaapi(el,
      [{ opacity: 0, transform: `translateY(${y}px)`, filter: `blur(${blur}px)` },
       { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: dur, easing: E.out, fill: 'backwards' });
  });
}

/* ================= 渲染意图：boot 消费标志 / switch / search / eye·fav 锚点 ================= */

let intent: 'boot' | 'switch' | 'search' | null = null;
export function motionArmBoot(): void { intent = 'boot'; }
export function motionArmSwitch(): void { if (!intent) intent = 'switch'; }
export function motionArmSearch(): void { if (!intent) intent = 'search'; }

/** eye 显影锚点（entry id）——渲染重绘后由 motionRendered 找回那张卡播显影 */
const revealIds = new Map<string, number>();
export function motionArmReveal(entryId: string): void { revealIds.set(entryId, Date.now()); }
/** 收藏点亮锚点（entry id 或 platform 名） */
const favIds = new Map<string, number>();
export function motionArmFav(key: string): void { favIds.set(key, Date.now()); }

/** 过期锚点回收（消费时顺手清 10s 前的残账） */
function sweepAnchors(ids: Map<string, number>): void {
  const now = Date.now();
  for (const [k, t] of ids) if (now - t > 10000) ids.delete(k);
}

/* ================= 面板壳：开 / 关 ================= */

/**
 * 面板打开（ui.ts show 置 display:flex 后调）：工作台卡升起 + 金印压落正冠 +
 * （移动可见时）FAB 弹入。boot 内容编排由 motionRendered 接管。
 */
export function motionPanelIn(root: HTMLElement): void {
  if (!root || motionReduced()) return;
  const card = visibleCard(root);
  if (!card) return;
  motionWaapi(card,
    [{ opacity: 0, transform: 'translateY(14px) scale(.985)', filter: 'blur(6px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 340, easing: E.out, fill: 'backwards' });
  const seal = card.querySelector<HTMLElement>('.bz-password-vault-logo .seal, .bz-password-vault-mobbar .seal');
  if (seal) motionWaapi(seal,
    [{ opacity: 0, transform: 'rotate(-130deg) scale(.5)', filter: 'blur(3px)' },
     { opacity: 1, transform: 'rotate(10deg) scale(1.07)', filter: 'blur(0px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 420, easing: E.out, fill: 'backwards' });
  const fab = card.querySelector<HTMLElement>('.bz-password-vault-fab');
  if (fab && motionVisible(fab)) {
    motionShellAfter(320, () => motionWaapi(fab,
      [{ opacity: 0, transform: 'scale(.4)' },
       { opacity: 1, transform: 'scale(1.1)' },
       { opacity: 1, transform: 'scale(1)' }],
      { duration: 340, easing: E.out, fill: 'backwards' }));
  }
}

/** 当前可见实例卡（桌面居中卡 / 移动全屏列；≤768px 时 desk display:none） */
function visibleCard(root: HTMLElement): HTMLElement | null {
  const desk = root.querySelector<HTMLElement>('.bz-password-vault-desk');
  if (motionVisible(desk)) return desk;
  const mob = root.querySelector<HTMLElement>('.bz-password-vault-mob');
  if (motionVisible(mob)) return mob;
  return null;
}

/**
 * 面板关闭替身（ui.ts hide 置 display:none **之前**调）：取可见卡现位，
 * body 上放同位覆层演「金印卡沉入暗场」，本体同步消失。覆层自毁无残留。
 */
export function motionPanelCollapse(root: HTMLElement | null): void {
  if (!root || motionReduced()) return;
  const card = visibleCard(root);
  if (!card) return;
  const rect = card.getBoundingClientRect();
  let radius = '14px';
  try {
    const cs = getComputedStyle(card);
    if (cs.borderRadius && cs.borderRadius !== '0px') radius = cs.borderRadius;
  } catch { /* 读不到走缺省 */ }
  const veil = motionVeil(rect, 'bz-pwv-m-collapse');
  if (!veil) return;
  veil.style.cssText += `background:var(--pwv-bg, var(--background-primary, #fff));border-radius:${radius};box-shadow:0 20px 60px rgba(0,0,0,.45);`;
  const anim = motionWaapi(veil,
    [{ opacity: 1, transform: 'scale(1)', filter: 'brightness(1) blur(0px)' },
     { opacity: 0, transform: 'scale(.965)', filter: 'brightness(.4) blur(5px)' }],
    { duration: M.move + 30, easing: E.out });
  motionVeilGone(veil, anim, M.move + 30);
}

/* ================= 渲染完成钩子 ================= */

/**
 * 渲染完成（ui.ts renderAll 尾部调）：
 *  - boot（开面板/解锁成功后的首次渲染）：金印正冠 + 导航接力 + 列表接力 + 详情揭出；
 *  - switch（全部/收藏切换）：行级联 + 详情揭出；
 *  - search（搜索刷新）：行快级联；
 *  - 无意图（eye/fav/选中/写操作重绘）：详情轻揭出——然后消费 eye/fav 锚点。
 * 锚点消费不受档位影响：重绘后按 data-pwv-entry / data-pwv-plat 找回目标播显影/点亮。
 */
export function motionRendered(root: HTMLElement): void {
  motionCancelPending();
  const phase = intent;
  intent = null;
  if (!root || motionReduced()) return;
  if (root.style.display !== 'flex') return;
  sweepAnchors(revealIds); sweepAnchors(favIds);
  const card = visibleCard(root);
  if (!card) return;
  const isDesk = card.classList.contains('bz-password-vault-desk');
  const rows = [...card.querySelectorAll<HTMLElement>(
    isDesk ? '.bz-password-vault-rows > .bz-password-vault-plrow, .bz-password-vault-rows > .bz-password-vault-row' : '.bz-password-vault-moblist > .bz-password-vault-mobcard',
  )];
  const detail = card.querySelector<HTMLElement>('.bz-password-vault-detail');
  const navitems = [...card.querySelectorAll<HTMLElement>('.bz-password-vault-navitem')];

  if (phase === 'boot') {
    const logo = card.querySelector<HTMLElement>('.bz-password-vault-logo .seal');
    if (logo && isDesk) motionWaapi(logo,
      [{ transform: 'rotate(-100deg) scale(.6)', opacity: 0 },
       { transform: 'rotate(8deg) scale(1.06)', opacity: 1 },
       { transform: 'none', opacity: 1 }],
      { duration: 380, easing: E.out, fill: 'backwards' });
    navitems.forEach((el, i) => rise(el, 100 + i * 50, M.base, { y: 5 }));
    const count = card.querySelector<HTMLElement>('.bz-password-vault-count');
    if (count) rise(count, 180, M.base, { y: 4, blur: 2 });
  }
  const rowBase = phase === 'boot' ? 220 : 0;
  const rowStag = phase === 'boot' ? STAG : phase === 'switch' ? 18 : 13;
  const rowCap = phase === 'boot' ? 14 : phase === 'switch' ? 12 : 10;
  const rowDur = phase === 'search' ? M.fast + 40 : M.base;
  if (phase) rows.forEach((el, i) => { if (i < rowCap) rise(el, rowBase + i * rowStag, rowDur, { y: phase === 'boot' ? 7 : 4, blur: phase === 'search' ? 2 : 3 }); });

  if (detail && motionVisible(detail)) {
    if (phase === 'boot' || phase === 'switch') {
      const head = detail.querySelector<HTMLElement>('.bz-password-vault-detailhead');
      if (head) rise(head, phase === 'boot' ? 300 : 30, M.base, { y: 6 });
      const cards = [...detail.querySelectorAll<HTMLElement>('.bz-password-vault-acctcard')];
      cards.forEach((el, i) => { if (i < 8) rise(el, (phase === 'boot' ? 360 : 60) + i * 60, M.base, { y: 6 }); });
    } else if (!phase) {
      rise(detail, 0, M.fast + 40, { y: 3, blur: 2 });
    }
  }
  // 空态揭出（桌面列表 / 移动列表 / 详情占位）
  card.querySelectorAll<HTMLElement>('.bz-password-vault-empty, .bz-password-vault-mobempty').forEach((el, i) => {
    if (i < 2) rise(el, 60, M.base, { y: 5, blur: 3 });
  });

  // —— eye / fav 锚点消费 ——
  if (revealIds.size || favIds.size) {
    card.querySelectorAll<HTMLElement>('[data-pwv-entry]').forEach((el) => {
      const id = el.getAttribute('data-pwv-entry') || '';
      if (revealIds.has(id)) {
        const pw = el.querySelector<HTMLElement>('.pw');
        if (pw) revealPw(pw);
        revealIds.delete(id);
      }
      if (favIds.has(id)) {
        const star = el.querySelector<HTMLElement>('.star');
        if (star) favFlash(star);
        favIds.delete(id);
      }
    });
    if (favIds.size) {
      card.querySelectorAll<HTMLElement>('[data-pwv-plat]').forEach((el) => {
        const key = el.getAttribute('data-pwv-plat') || '';
        if (favIds.has(key)) {
          const star = el.querySelector<HTMLElement>('.star');
          if (star) favFlash(star);
          favIds.delete(key);
        }
      });
    }
  }
}

/** eye 显影：明文从雾面浮出 + 一道扫光（节拍恒定，涉密纪律） */
function revealPw(pw: HTMLElement): void {
  motionWaapi(pw,
    [{ opacity: .3, filter: 'blur(6px) brightness(1.4)' },
     { opacity: 1, filter: 'blur(0px) brightness(1)' }],
    { duration: 260, easing: E.out, fill: 'backwards' });
  const rect = pw.getBoundingClientRect();
  const veil = motionVeil(rect, 'bz-pwv-m-glint');
  if (!veil) return;
  const beam = document.createElement('div');
  beam.className = 'bz-pwv-m-glint-beam';
  veil.appendChild(beam);
  const anim = motionWaapi(beam,
    [{ transform: 'translateX(-130%) skewX(-18deg)' }, { transform: 'translateX(130%) skewX(-18deg)' }],
    { duration: 320, easing: E.out });
  motionVeilGone(veil, anim, 320);
}

/** 收藏点亮：星标弹跳 + 一记金晕 */
function favFlash(star: HTMLElement): void {
  motionWaapi(star,
    [{ transform: 'scale(.5) rotate(-18deg)' }, { transform: 'scale(1.45) rotate(8deg)' }, { transform: 'scale(1) rotate(0)' }],
    { duration: 360, easing: E.out });
}

/* ================= 锁屏（inline 双实例）：金印压落 / 待机辉光 / 拧开余韵 ================= */

/**
 * 锁屏候场（ui.ts showLock 装配/刷新后调）：
 *  - strong=首次装配：金印大压落（封蜡感）+ 标题/副题/统计/输入行接力；
 *  - 重入刷新：金印微正冠一下即可。
 * 待机辉光 = 金印呼吸循环（CSS 类，句柄入池；closeLock 侧 motionLockIdle(off) 必收）。
 */
export function motionLockIn(lockEl: HTMLElement, strong: boolean): void {
  if (!lockEl || motionReduced()) return;
  const ls = lockEl.querySelector<HTMLElement>('.bz-lockscreen');
  if (!ls) return;
  const seal = ls.querySelector<HTMLElement>('[data-ls="seal"]');
  if (seal) {
    motionWaapi(seal,
      strong
        ? [{ opacity: 0, transform: 'rotate(-18deg) scale(1.6)', filter: 'blur(3px)' },
           { opacity: 1, transform: 'rotate(5deg) scale(.96)', filter: 'blur(0px)' },
           { opacity: 1, transform: 'none', filter: 'blur(0px)' }]
        : [{ transform: 'rotate(-5deg) scale(.97)' }, { transform: 'none' }],
      { duration: strong ? 440 : 220, easing: E.out, fill: 'backwards' });
    motionLockIdle(lockEl, true);
  }
  if (!strong) return;
  const box = ls.querySelector<HTMLElement>('[data-ls="box"]');
  if (box) motionWaapi(box,
    [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
    { duration: 320, easing: E.out, fill: 'backwards' });
  (['[data-ls="title"]', '[data-ls="sub"]', '[data-ls="row"]'] as const).forEach((sel, i) => {
    const el = ls.querySelector<HTMLElement>(sel);
    if (el) shellRise(el, 130 + i * 70, M.base, { y: 6 });
  });
  const stats = [...ls.querySelectorAll<HTMLElement>('[data-ls="stats"] .bz-lockscreen-stat')];
  stats.forEach((el, i) => shellRise(el, 210 + i * 60, M.base, { y: 6 }));
}

/** 金印待机辉光开关（on=呼吸循环入池；off=摘池去类）。幂等。 */
export function motionLockIdle(lockEl: HTMLElement, on: boolean): void {
  const key = 'pwv-idle-' + (lockEl.getAttribute('data-lock') || 'x');
  motionLoopStop(key);
  if (!on || motionReduced()) return;
  const seal = lockEl.querySelector<HTMLElement>('[data-ls="seal"]');
  if (!seal) return;
  seal.classList.add('bz-pwv-m-idle');
  motionLoopAdd(key, () => { seal.classList.remove('bz-pwv-m-idle'); });
}

/**
 * 开锁验讫余韵（ui.ts bindLock 解锁成功分支在 closeLock **前**调）：
 * 金印处一圈金环扩散 + 金屑迸开；锁屏本体照旧同步收场。
 */
export function motionUnlockBurst(seal: HTMLElement | null): void {
  if (!seal || motionReduced()) return;
  const rect = seal.getBoundingClientRect();
  const veil = motionVeil(rect, 'bz-pwv-m-burst');
  if (!veil) return;
  const ring = document.createElement('div');
  ring.className = 'bz-pwv-m-burst-ring';
  veil.appendChild(ring);
  for (let i = 0; i < 8; i++) {
    const bit = document.createElement('div');
    bit.className = 'bz-pwv-m-burst-bit';
    veil.appendChild(bit);
    const ang = (i / 8) * Math.PI * 2 + Math.random() * .5;
    const dist = 26 + Math.random() * 28;
    motionWaapi(bit,
      [{ opacity: 1, transform: 'translate(-50%,-50%) translate(0,0) scale(1)' },
       { opacity: 0, transform: `translate(-50%,-50%) translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(.35)` }],
      { duration: 380 + Math.random() * 140, easing: E.out });
  }
  const anim = motionWaapi(ring,
    [{ opacity: .95, transform: 'translate(-50%,-50%) scale(.55)' },
     { opacity: 0, transform: 'translate(-50%,-50%) scale(2.4)' }],
    { duration: 470, easing: E.out });
  motionVeilGone(veil, anim, 470);
}

/* ================= 弹窗：封蜡金线 ================= */

/** 弹窗升起 + 卡面一道金线扫过（添加/编辑 与 平台编辑共用；火漆封缄语汇） */
export function motionDialogIn(dlg: HTMLElement): void {
  if (!dlg || motionReduced() || !motionVisible(dlg)) return;
  motionWaapi(dlg,
    [{ opacity: 0, transform: 'translateY(12px) scale(.975)', filter: 'blur(4px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 280, easing: E.out, fill: 'backwards' });
  const rect = dlg.getBoundingClientRect();
  const veil = motionVeil(rect, 'bz-pwv-m-glint');
  if (!veil) return;
  veil.style.cssText += 'border-radius:18px;overflow:hidden;';
  const beam = document.createElement('div');
  beam.className = 'bz-pwv-m-glint-beam';
  veil.appendChild(beam);
  const anim = motionWaapi(beam,
    [{ transform: 'translateX(-130%) skewX(-18deg)' }, { transform: 'translateX(130%) skewX(-18deg)' }],
    { duration: 420, easing: E.out });
  motionVeilGone(veil, anim, 420);
}

/** 生成密码 / 点眼显影后的输入框确认闪：亮度脉冲 + 一记微光（框体本身动 filter，不动值） */
export function motionGenFlash(input: HTMLInputElement): void {
  if (!input || motionReduced()) return;
  motionWaapi(input,
    [{ filter: 'brightness(1.45)' }, { filter: 'brightness(1)' }],
    { duration: 280, easing: E.out });
}

/* ================= 卡面交互：复制金屑 / 快取 ================= */

/** 复制得手：按钮处迸几粒金屑（body 自毁覆层，按钮几何不动） */
export function motionCopyBurst(btn: HTMLElement): void {
  if (!btn || motionReduced()) return;
  const rect = btn.getBoundingClientRect();
  const veil = motionVeil(rect, 'bz-pwv-m-burst');
  if (!veil) return;
  for (let i = 0; i < 5; i++) {
    const bit = document.createElement('div');
    bit.className = 'bz-pwv-m-burst-bit is-small';
    veil.appendChild(bit);
    const ang = -Math.PI / 2 + (Math.random() - .5) * 2.2;
    const dist = 14 + Math.random() * 18;
    motionWaapi(bit,
      [{ opacity: 1, transform: 'translate(-50%,-50%) translate(0,0) scale(1)' },
       { opacity: 0, transform: `translate(-50%,-50%) translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(.3)` }],
      { duration: 300 + Math.random() * 120, easing: E.out });
  }
  motionVeilGone(veil, null, 460);
}

/* ================= 快速取密选择器（quick-pick.ts 消费） ================= */

/** 选择器弹入 + 行接力（顶部「生成新」恒首位，随批揭出） */
export function motionQuickPickIn(popup: HTMLElement): void {
  if (!popup || motionReduced() || !motionVisible(popup)) return;
  motionWaapi(popup,
    [{ opacity: 0, transform: 'translateY(10px) scale(.985)', filter: 'blur(4px)' },
     { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
    { duration: 240, easing: E.out, fill: 'backwards' });
  popup.querySelectorAll<HTMLElement>('.bz-popover-item').forEach((el, i) => {
    if (i < 8) shellRise(el, 60 + i * 24, M.fast + 60, { y: 5, blur: 2 });
  });
}

/** 选中行：一道金光抽出（钥匙离库；覆层独立于选择器生命周期，先关后散互不拖拽） */
export function motionQpPick(row: HTMLElement): void {
  if (!row || motionReduced()) return;
  const rect = row.getBoundingClientRect();
  const veil = motionVeil(rect, 'bz-pwv-m-glint');
  if (!veil) return;
  const beam = document.createElement('div');
  beam.className = 'bz-pwv-m-glint-beam';
  veil.appendChild(beam);
  const anim = motionWaapi(beam,
    [{ transform: 'translateX(-130%) skewX(-18deg)' }, { transform: 'translateX(130%) skewX(-18deg)' }],
    { duration: 260, easing: E.out });
  motionVeilGone(veil, anim, 260);
}

/* ================= 移动详情页 ================= */

/** 移动详情页内容接力（壳体入场有既有 CSS sheetup；本函数只接力页内 seg 卡） */
export function motionMobPageIn(pageBody: HTMLElement): void {
  if (!pageBody || motionReduced()) return;
  const head = pageBody.querySelector<HTMLElement>('.bz-password-vault-mobplathead');
  if (head) shellRise(head, 40, M.base, { y: 5 });
  pageBody.querySelectorAll<HTMLElement>('.bz-password-vault-seg').forEach((el, i) => {
    if (i < 8) shellRise(el, 90 + i * 50, M.base, { y: 6 });
  });
}
