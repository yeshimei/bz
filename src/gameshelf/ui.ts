/**
 * 游戏库（gameshelf）域 UI v3（2026-09-17：V1 海报墙方向落域 + 数据统计面板 + 全量详情弹窗）。
 *
 * 单源约定：markup 纯函数（heroHtml/shelfHtml/shotReelHtml/statsHtml/详情三段）与行为层同文件，
 * 插件面板与评审壳消费同一份——改一处两侧生效（docs/prototype-first.md）。
 * HTML 转义亦走 core 单源（cons C1 收编）：文本位 esc / 双引号属性位 escAttr（core/ui/str），
 * CSS url('…') 单引号上下文单独 escCssUrl——域内不再自留转义实现。
 * 面板基座 = core .bz-panel-overlay / .bz-panel-frame / .bz-panel-mtop（13 域同款）。
 * 头行已退役（2026-09-18 用户点版）：标题/N款全去掉，大海报直接顶到面板顶，
 * 常驻操作只剩海报右上角三枚图标钮（统计↔游戏墙 / 立即同步 / 移动端关闭）。
 * 统计卡 = uiStat，空态 = uiEmpty，筛选 = uiChip，排序 = uiSegmented，搜索 = uiSearch。
 *
 * 亮暗：全部消费 --bz token（tokens.css 的 .theme-dark/.theme-light 双组），零固定色——
 * 评审壳默认亮色、可切暗色，插件内跟随宿主主题。
 * 移动端：≤768px 真全屏（100dvh，**显式不用 --bz-vvh**——本面板无贴底输入条，且 --bz-vvh
 * 在评审壳里被模拟成「短 88px」会留底缝，理由详见 styles.css 移动端段）+ .bz-panel-mtop 44px 顶部避让。
 * 无入场动效；滚动条不自造（ADR-0122 界面级单源隐藏）。
 */
import type { App } from 'obsidian';
import { topifyZ } from '../core/dom';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { tryGetSettings } from '../core/settings-provider';
import { debounce, openExternalUrl } from '../core/utils';
import { esc, escAttr, pad2 } from '../core/ui/str';
import { uiSegmented, uiSelect, uiStat, uiEmpty, uiBtn, uiIconBtn, uiChip, uiSearch, uiModal, mountIcons, openLightbox } from '../core/ui';
import { M, displayNameOf, nameMatches, type GameItem, type GameshelfBucket, type GameshelfSort, type GameshelfViewKind } from './state';
import { BUCKETS, bucketOf, buildReport, REPORT_CAVEAT, type GameshelfReport } from './report';
import {
  achRefreshDue, clearDetailCache, fmToAchDetail, fmToAchSummary, fmToShots, fmToStore, hasStoreFm,
  loadAchievements, loadStore, refreshAchievements, refreshStore, safeDetailFm, storeRefreshDue, storeUrlOf,
  type AchSection, type StoreSection,
} from './detail';
import { ensureZhNames, unloadZhNames } from './names';
import { unloadBackfill } from './backfill';
import { unloadPosters } from './posters';
import { coverDisplayUrl, iconDisplayUrl, resolveShotUrls } from './posters';

/** ESC 层 id 沿域内约定 'bz-<域>'（cons C4：全仓面板级层 id 唯一不带前缀的破例，对齐） */
const ESC_ID = 'bz-gameshelf';

let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let sortSegRef: { setValue: (v: GameshelfSort) => void } | null = null;
/** 门面（frame 级常驻，两视图共用）与游戏墙网格（shelf 视图才有） */
let heroEl: HTMLElement | null = null;
let gridEl: HTMLElement | null = null;
/** 本次渲染的报告（工具行计数与统计页共用一次计算） */
let lastReport: GameshelfReport | null = null;
/** 门面静息态 HTML（fillHero 时存；悬浮换脸后复原回它——列表首位口径已含标签与汇报，不重算） */
let heroRestHtml = '';
/** 换脸进行中的款（防抖阀：mouseover 在卡内每个子元素边界都会发，同款不得重写正脸） */
let peekedHeroAppid: number | null = null;
/** 悬浮截图快轮播的进行中卡片与定时器（同一时刻至多一张卡在轮播） */
let reelTimer: ReturnType<typeof setInterval> | null = null;
let reelCard: HTMLElement | null = null;
/** 移动端两个下拉的句柄（每次重建工具行都要 detach——uiSelect 挂了 document 级点击监听） */
let selectRefs: Array<{ detach: () => void }> = [];
/** 档位/排序下拉句柄（G5 三控件互译：chips/分段改值时回写下拉，防换屏宽后另一套显示旧值） */
let bucketSelRef: { setValue: (v: GameshelfBucket) => void } | null = null;
let sortSelRef: { setValue: (v: GameshelfSort) => void } | null = null;

/**
 * 会话滚位记忆（呈报#49-GS4，剪藏本效率#17「记住滚位」同范式）：视图 → scrollTop。
 * 渲染/切页前存、渲染后还；面板 toggle 重开也接回——本条拍板点名「面板重开总回顶部」，
 * 故会话边界定在插件卸载（unloadGameshelf 清空），比剪藏本「重开面板不背旧位」更宽一层。
 * 存取都走「当前实际滚动容器」：桌面/统计页是 .bz-gs-body（唯一滚动容器），
 * ≤768px 的游戏墙滚动权在网格宿主 #bz-gs-grid（styles.css data-view=shelf 段）。
 */
const scrollMemo = new Map<GameshelfViewKind, number>();
/** 当前 DOM 属于哪个视图（切页时旧滚位按它归账，不能记到新视图名下） */
let renderedView: GameshelfViewKind | null = null;

function activeScroller(): HTMLElement | null {
  const body = popupEl?.querySelector<HTMLElement>('#bz-gs-body');
  if (!body) return null;
  if (body.dataset.view === 'shelf' && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches) {
    return gridEl; // 窄屏游戏墙：滚动容器是网格宿主
  }
  return body;
}

function saveScrollMemo(): void {
  if (!renderedView) return;
  const sc = activeScroller();
  if (sc) scrollMemo.set(renderedView, sc.scrollTop);
}

function restoreScrollMemo(): void {
  const sc = activeScroller();
  if (sc) sc.scrollTop = scrollMemo.get(M.view) ?? 0;
}

/** 会话边界（插件卸载）：滚位记忆随域状态一并作废 */
export function resetScrollMemo(): void {
  scrollMemo.clear();
  renderedView = null;
}

/** 释放上一轮下拉（漏了就是每渲染一次攒一个 document 监听） */
function disposeSelects(): void {
  for (const s of selectRefs) s.detach();
  selectRefs = [];
}

/** 常驻操作钮（mk 内统一挂）：触控热区外扩（G2/C5）——30px 钮在 pointer:coarse 下
 *  经 core .bz-touch-target--lg（-8px ::after）扩到 46px ≥ §8.2 40px 下限；视觉不变，
 *  桌面（pointer:fine）零影响。移动端关闭钮是全屏面板唯一关闭出口，热区必须有。 */
const OPS_TOUCH_CLASS = 'bz-touch-target--lg';

/** 海报右上角常驻操作（头行退役后的全部家当）：统计↔游戏墙、立即同步、移动端关闭——三枚图标钮。
 *  每次 renderAll 重挂（图标随视图变、同步钮随 syncing/configured 变）。 */
function mountOps(app: App): void {
  const ops = popupEl?.querySelector('#bz-gs-heroops');
  if (!ops) return;
  const onStats = M.view === 'stats';
  const mk = (icon: string, label: string, onClick: () => void, disabled = false): HTMLButtonElement => {
    const b = uiIconBtn({ icon, title: label, className: `bz-gs-opsbtn ${OPS_TOUCH_CLASS}`, onClick, disabled });
    b.setAttribute('aria-label', label);
    return b;
  };
  const close = mk('x', '关闭', () => closePanel());
  close.classList.add('bz-gs-close'); // 桌面隐藏（点遮罩/ESC 出），≤768px 露出（全屏面板无可点遮罩）
  ops.replaceChildren(
    mk(onStats ? 'layout-grid' : 'bar-chart-3', onStats ? '返回游戏墙' : '数据统计', () => {
      M.view = onStats ? 'shelf' : 'stats';
      renderAll(app);
    }),
    mk('refresh-cw', '立即同步', () => void onSyncClick(app), M.syncing || !isConfigured()),
    close,
  );
}

/* ==================== 小工具 ==================== */

/** 分钟 → 小时（一位小数；卡片/列表用） */
export function hoursOf(min: number): number {
  return Math.round((((min || 0) / 60) * 10)) / 10;
}

/** 小时数字 → 文本（≥1000 千分位、≥100 取整、其余一位小数；图省地方也不丢量级） */
export function numText(n: number): string {
  if (n >= 1000) return Math.round(n).toLocaleString('zh-CN');
  if (n >= 100) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

/** 分钟 → "1,087 h" / "0 h" */
function hoursText(min: number): string {
  return `${numText(hoursOf(min))}h`;
}

/**
 * CSS `url('…')` 单引号上下文转义（G4/F9：域内唯一内联 background-image 插值）——
 * escAttr 是「双引号属性上下文」口径、不转 `'`，罩不住内嵌 CSS 单引号串：路径含 `'`
 * 时 url('') 提前闭合，style 整条断裂成可注入的 CSS 上下文。先百分号编码 `'`（%27 在
 * CSS 字符串里原样保留、由 URL 解码端还原），再过 HTML 属性转义兜 `& < > "`。
 */
function escCssUrl(s: string): string {
  return escAttr(String(s ?? '').replace(/'/g, '%27'));
}

/** 日期串 → 本地可读（YYYY-MM-DD 原样；ISO 取前 10 位；空 → 占位） */
function dateText(s: string | null | undefined, dash = '—'): string {
  const v = String(s ?? '').trim();
  if (!v) return dash;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : v;
}

/* ==================== 引导态（未配置） ==================== */

function guidanceEl(app: App): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'bz-gs-guide-actions';
  const go = uiBtn({ label: '去配置', tone: 'primary', onClick: () => goConfig(app) });
  go.id = 'bz-gs-guide-config';
  const re = uiBtn({ label: '重新检测', onClick: () => renderAll(app) });
  re.id = 'bz-gs-guide-recheck';
  actions.appendChild(go);
  actions.appendChild(re);
  return uiEmpty({
    icon: 'gamepad-2',
    title: '接上 Steam，游戏库自己长出来',
    desc: '在设置面板游戏库页填 SteamID64 和 Web API 密钥，保存后回来点同步，库和时长自动拉进来，不用手动登记。',
    actions,
  });
}

function goConfig(app: App): void {
  closePanel();
  void import('../settings-panel').then((m) => m.openSettingsPanel(app, 'gameshelf'));
}

/* ==================== 游戏墙：门面 + 网格 ==================== */

/** 门面排序口径标签（列表首位为什么是它，写在门面上） */
function heroTag(): string {
  if (M.sort === 'last') return '最近在玩';
  if (M.sort === 'name') return '名称首位';
  return '时长第一';
}

/**
 * 门面（列表首位游戏）：封面放大模糊作环境底 + 中文名（原名另起一行）+ 三个总览数字。
 * 筛选后门面跟着列表首位走——筛出来的是哪款，门面就展示哪款。
 * peek（悬浮换脸态）：口径标签隐去——「时长第一」描述的是列表首位为何是它，
 * 挂在悬浮的那款头上是假信息，宁可不显示（影院换脸同款口径：角标不动、语义漂的不动）。
 */
export function heroHtml(item: GameItem, cover: string, rp: GameshelfReport, tag = heroTag(), peek = false): string {
  const zh = displayNameOf(item);
  const orig = item.zhName && item.zhName !== item.name ? item.name : '';
  const sub = [
    hoursOf(item.playtimeMin) > 0 ? `${numText(hoursOf(item.playtimeMin))} 小时` : '从未启动',
    item.lastPlayed ? `最后游玩 ${dateText(item.lastPlayed)}` : '没有游玩记录',
    `在库 ${M.items.length} 款中第 ${indexInList(item) + 1} 位`,
  ].join(' · ');
  const bg = cover ? ` style="background-image:url('${escCssUrl(cover)}')"` : '';
  return `
  <div class="bz-gs-hero${cover ? '' : ' bz-gs-hero--bare'}">
    <div class="bz-gs-hero-art"${bg}></div>
    <div class="bz-gs-hero-veil"></div>
    <div class="bz-gs-hero-in">
      <div class="bz-gs-hero-left">
        ${peek ? '' : `<span class="bz-gs-hero-tag">${esc(tag)}</span>`}
        <div class="bz-gs-hero-name" title="${escAttr(item.name)}">${esc(zh)}</div>
        ${orig ? `<div class="bz-gs-hero-orig">${esc(orig)}</div>` : ''}
        <div class="bz-gs-hero-sub">${esc(sub)}</div>
      </div>
      <div class="bz-gs-hero-side">
        <div><b>${rp.total}</b><span>在架游戏</span></div>
        <div><b>${numText(rp.totalHours)}</b><span>累计小时</span></div>
        <div><b>${rp.neverPlayed}</b><span>从未启动</span></div>
      </div>
    </div>
  </div>`;
}

/** 当前列表（供门面算「第几位」） */
function currentList(): GameItem[] {
  return sortList(filterList(M.items));
}

/**
 * 门面里「在库第几位」按全库时长为序（不随筛选跳动，口径稳定）。
 * 位次缓存（eff E7）：悬浮换脸/每次过滤都走到这里，逐次全库拷贝排序在千款级可感——
 * 一次算好按 appid 查表。失效键 = M.items 数组身份：条目只在 rebuildItems 整表替换时
 * 重建（playtimeMin 无就地改写），换数组即重算；关面板随手清。
 */
let rankMemo: { src: GameItem[]; ranks: Map<number, number> } | null = null;
function indexInList(item: GameItem): number {
  if (!rankMemo || rankMemo.src !== M.items) {
    const ranks = new Map<number, number>();
    [...M.items].sort((a, b) => b.playtimeMin - a.playtimeMin).forEach((it, i) => ranks.set(it.appid, i));
    rankMemo = { src: M.items, ranks };
  }
  return rankMemo.ranks.get(item.appid) ?? 0;
}

/** 筛选（档位 + 搜索词；原名与中文名都参与匹配） */
export function filterList(items: GameItem[]): GameItem[] {
  const def = bucketOf(M.bucket);
  return items.filter((it) => def.test(it) && nameMatches(it, M.query));
}

/** 排序（时长降 / 最近玩降 / 名称升——名称按**展示名**排，用户看到什么就按什么排） */
export function sortList(items: GameItem[]): GameItem[] {
  const list = [...items];
  if (M.sort === 'last') return list.sort((a, b) => (b.lastPlayed || '').localeCompare(a.lastPlayed || '') || b.playtimeMin - a.playtimeMin);
  if (M.sort === 'name') return list.sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b), 'zh-Hans-CN'));
  return list.sort((a, b) => b.playtimeMin - a.playtimeMin);
}

/**
 * 游戏墙网格：封面卡（Steam header 比例）+ 名字/时长 + 成就进度条。
 * - 进度条口径（2026-09-18 用户点版，取代原「相对全库时长条」）：已解/总成就的百分比，
 *   全成就满条 + 小海报右上角挂奖杯角标；没有成就页的款不显示条（空条会被误读成 0%）；
 * - achOf 由调用方注入（renderList 从笔记属性读，零网络），markup 保持纯函数；
 * - 排名角标只在「未筛选 + 按时长排」时出现（换了口径的序号没有意义，宁可不显示）。
 */
export function shelfHtml(
  items: GameItem[],
  coverOf: (it: GameItem) => string,
  opts: { showRank?: boolean; achOf?: (it: GameItem) => { unlocked: number; total: number } | null } = {},
): string {
  const cards = items
    .map((it, i) => {
      const cover = coverOf(it);
      const zh = displayNameOf(it);
      const orig = it.zhName && it.zhName !== it.name ? it.name : '';
      const rank = opts.showRank && i < 3 ? `<span class="bz-gs-rank">NO.${i + 1}</span>` : '';
      const ach = opts.achOf?.(it) ?? null;
      const achPct = ach && ach.total > 0 ? Math.round((ach.unlocked / ach.total) * 100) : null;
      const isFull = achPct !== null && achPct >= 100;
      // 🏆 直接写字符（2026-09-19 用户点版：lucide 线性杯太丑）；不能带 data-lucide，否则 mountIcons 会把字符换成 SVG
      const trophy = isFull ? '<span class="bz-gs-trophy" title="全成就达成">🏆</span>' : '';
      const hint = it.playtimeMin > 0
        ? `${numText(hoursOf(it.playtimeMin))} 小时`
        : '从未启动';
      const last = it.lastPlayed ? dateText(it.lastPlayed) : '—';
      // 卡片不带 title（2026-09-19 用户点版：悬浮不弹游戏名原生提示，名字本就常驻卡下）
      return `
      <button type="button" class="bz-gs-card${it.offShelf ? ' bz-gs-card--off' : ''}" data-appid="${it.appid}">
        <span class="bz-gs-cover" data-initial="${escAttr(firstChar(zh))}">
          ${cover ? `<img loading="lazy" src="${escAttr(cover)}" data-fallback-src="${escAttr(it.coverSrc ?? '')}" alt="">` : '<span class="bz-gs-cover-ic" data-lucide="gamepad-2"></span>'}
          ${rank}
          ${trophy}
          ${it.offShelf ? '<span class="bz-gs-off">已下架</span>' : ''}
          <span class="bz-gs-hint"><span>${esc(hint)}</span><span class="bz-gs-hint-d">${esc(last)}</span></span>
        </span>
        <span class="bz-gs-cardbar">
          <span class="bz-gs-namebox">
            <span class="bz-gs-name">${esc(zh)}</span>
            ${orig ? `<span class="bz-gs-orig">${esc(orig)}</span>` : ''}
          </span>
          <span class="bz-gs-hours">${hoursText(it.playtimeMin)}</span>
        </span>
        ${achPct !== null ? `<span class="bz-gs-strip${isFull ? ' is-full' : ''}"><i style="width:${achPct}%"></i></span>` : ''}
      </button>`;
    })
    .join('');
  return `<div class="bz-gs-grid">${cards}</div>`;
}

/** 首字符（封面加载失败时的占位字）：按码点取首字，emoji/扩展区汉字不锯成代理对乱码 */
function firstChar(name: string): string {
  return [...name][0] ?? '?';
}

/* ==================== 悬浮预览：卡片截图快轮播 + 门面换脸（issue 378） ==================== */

/** 轮播节奏（用户 2026-09-18 点版 0.3s 一张；淡化相应收紧到 dur-fast，见 styles.css） */
const REEL_INTERVAL_MS = 300;

/**
 * 远端原图 → 商店缩略图（600×338，同一 CDN 的定式改名）：轮播要「快速」，原图一张
 * 400KB 起头悬得等一秒多；缩略图几十 KB 秒出。本地图（resource URL）原样返回。
 * 缩略图万一 404 由 bindShotReel 的 error 委托回退原 URL（data-shot-full）。
 */
function thumbUrlOf(u: string): string {
  return /^https?:\/\//i.test(u) ? u.replace(/\.\d+x\d+\.jpg/i, '.600x338.jpg') : u;
}

/**
 * 悬浮轮播内芯（markup 单源）：全套截图叠放进 .bz-gs-reel，首张亮（is-on），
 * 轮转只翻 is-on 类（只轮已就绪的图，见 peekReel）。层序靠 DOM 先后：reel 以
 * afterbegin 插在封面图之前，角标（NO.x / 已下架）与时长提示是它的后续兄弟，自然压在上面。
 */
export function shotReelHtml(urls: string[], fullUrls: string[] = urls): string {
  return `<span class="bz-gs-reel">${urls
    .map((u, i) => `<img src="${escAttr(u)}" alt="" decoding="async" data-shot-full="${escAttr(fullUrls[i] ?? u)}"${i === 0 ? ' class="is-on"' : ''}>`)
    .join('')}</span>`;
}

/** 该款的商店截图展示 URL（本地优先、远端兜底；零网络——只读属性，悬浮绝不发请求） */
function shotUrlsOfCard(app: App, appid: number): string[] {
  const item = M.items.find((it) => it.appid === appid);
  if (!item) return [];
  const { local, remote } = fmToShots(safeDetailFm(app, item.file));
  return resolveShotUrls(app, local, remote);
}

/** 停轮播 + 摘浮层（封面正脸从未被换过，摘掉即复原） */
function restReel(): void {
  if (reelTimer !== null) {
    clearInterval(reelTimer);
    reelTimer = null;
  }
  reelCard?.querySelector('.bz-gs-reel')?.remove();
  reelCard = null;
}

/** 把「第一张已就绪」的截图点亮（当前 is-on 未就绪时）——首悬最怕悬上去半天没反应，
 *  不能干等 700ms 节拍：缩略图一到（load 事件 / 插入时已缓存）立刻上屏。 */
function promoteFirstReadyShot(): void {
  const reel = reelCard?.querySelector('.bz-gs-reel');
  if (!reel) return;
  const imgs = [...reel.querySelectorAll('img')];
  const cur = imgs.findIndex((im) => im.classList.contains('is-on'));
  if (cur >= 0 && imgs[cur].complete && imgs[cur].naturalWidth > 0) return;
  const ready = imgs.find((im) => im.complete && im.naturalWidth > 0);
  if (!ready) return;
  if (cur >= 0) imgs[cur].classList.remove('is-on');
  ready.classList.add('is-on');
}

/** 进卡片：海报换成商店截图快轮播（单张截图只亮不转；没截图的款封面不动） */
function peekReel(card: HTMLElement, app: App): void {
  if (card === reelCard) return;
  restReel();
  const urls = shotUrlsOfCard(app, Number(card.dataset.appid));
  const cover = card.querySelector('.bz-gs-cover');
  if (!cover || urls.length === 0) return;
  cover.insertAdjacentHTML('afterbegin', shotReelHtml(urls.map(thumbUrlOf), urls));
  reelCard = card;
  // 缩略图一到就点亮（load 不冒泡，捕获段接在 reel 上；reel 摘除时监听随节点一起回收）
  reelCard.querySelector('.bz-gs-reel')?.addEventListener('load', promoteFirstReadyShot, true);
  promoteFirstReadyShot();
  if (urls.length < 2) return;
  reelTimer = setInterval(() => {
    // 网格重渲染会换掉整批卡片元素：旧的已摘除（isConnected 为假）就即刻收摊，别空转
    if (!reelCard?.isConnected) {
      restReel();
      return;
    }
    const imgs = [...reelCard.querySelectorAll<HTMLImageElement>('.bz-gs-reel img')];
    const cur = imgs.findIndex((im) => im.classList.contains('is-on'));
    if (cur < 0) return;
    // 只轮「已就绪」的图（complete + 解码出尺寸）：原图一张 400KB 起，没就绪就被轮到
    // 会亮空框——看起来就是「没轮播、还在闪」（2026-09-18 原型实测）。没图就绪则原地不动，
    // 封面从 reel 透明层底下透出来，等下个节拍。
    for (let step = 1; step < imgs.length; step += 1) {
      const at = (cur + step) % imgs.length;
      const im = imgs[at];
      if (im.complete && im.naturalWidth > 0) {
        imgs[cur].classList.remove('is-on');
        im.classList.add('is-on');
        return;
      }
    }
  }, REEL_INTERVAL_MS);
}

/** 悬浮卡片：门面正脸临时换成该款（海报 + 名字/原名/副行）；库级三个总览数字不动。
 *  防抖：同款重复悬浮直接跳过——mouseover 在卡内每个子元素边界都发（轮播层一插进去
 *  浏览器还会重算 hover 再发一轮），每次都 innerHTML 重写正脸 = 海报背景反复重建，
 *  界面上就是「一直在闪」（2026-09-18 原型实测）。 */
function peekHero(app: App, appid: number): void {
  if (appid === peekedHeroAppid) return;
  if (!heroEl || !heroRestHtml || !lastReport) return;
  const it = M.items.find((i) => i.appid === appid);
  if (!it) return;
  peekedHeroAppid = appid;
  heroEl.innerHTML = heroHtml(it, coverDisplayUrl(app, it.appid, it.cover, it.coverSrc), lastReport, '', true);
}

/** 离开卡片：门面回静息态（回快照不重算——静息口径 = 列表首位 + 排序标签） */
function restHero(): void {
  if (peekedHeroAppid === null) return;
  peekedHeroAppid = null;
  if (heroEl && heroRestHtml) heroEl.innerHTML = heroRestHtml;
}

/** 只在鼠标惯用件上挂：触屏 tap 会发 mouseover 却不发 mouseout，悬浮态会滞留（影院季圆点同款口径） */
function hoverCapable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

/**
 * 悬浮预览委托（host = #bz-gs-body，面板生命周期内绑一次；网格重渲染不换 host）：
 * mouseover 进卡片 → 轮播 + 门面换脸；mouseout 相关目标仍在卡内（子元素间移动）不算离开。
 * 测试/评审壳环境经 hoverable 参数显式开（jsdom 无真 hover 能力，默认关）。
 */
export function bindShotReel(app: App, host: HTMLElement, hoverable = hoverCapable()): void {
  if (!hoverable) return;
  // 缩略图加载失败 → 回退原 URL（一张只试一次，防死循环；error 不冒泡，捕获阶段接）
  host.addEventListener(
    'error',
    (e) => {
      const img = e.target as HTMLImageElement;
      if (img.tagName !== 'IMG' || !img.closest('.bz-gs-reel')) return;
      const full = img.getAttribute('data-shot-full');
      if (full && img.src !== full && !img.dataset.shotTried) {
        img.dataset.shotTried = '1';
        img.src = full;
      }
    },
    true,
  );
  host.addEventListener('mouseover', (e) => {
    const card = (e.target as HTMLElement).closest?.('.bz-gs-card') as HTMLElement | null;
    if (!card) return;
    peekReel(card, app);
    peekHero(app, Number(card.dataset.appid));
  });
  host.addEventListener('mouseout', (e) => {
    if (!reelCard && !heroRestHtml) return;
    const card = (e.target as HTMLElement).closest?.('.bz-gs-card') as HTMLElement | null;
    if (!card) return;
    const to = e.relatedTarget as HTMLElement | null;
    if (to && card.contains(to)) return;
    restReel();
    restHero();
  });
}

/* ==================== 数据统计面板 ==================== */

/** 统计页：大数字卡 + 排行 + 档位分布 + 年份分布 + 平台分项 + 最近玩过 + 口径注记 */
export function statsHtml(rp: GameshelfReport): string {
  const maxTop = Math.max(1, rp.top[0]?.hours ?? 1);
  const maxBucket = Math.max(1, ...rp.buckets.map((b) => b.count));
  const maxYear = Math.max(1, ...rp.years.map((y) => y.count));
  const maxPlat = Math.max(1, ...rp.platforms.map((p) => p.min));
  const thisYear = String(new Date().getFullYear());

  const topRows = rp.top.length
    ? rp.top
        .map((t, i) => `
      <div class="bz-gs-rankrow">
        <span class="bz-gs-rankno">${pad2(i + 1)}</span>
        <span class="bz-gs-rankname" title="${escAttr(t.name)}">${esc(t.name)}</span>
        <span class="bz-gs-rankbar"><i style="width:${Math.max(2, Math.round((t.hours / maxTop) * 100))}%"></i></span>
        <span class="bz-gs-rankval">${numText(t.hours)} h</span>
      </div>`)
        .join('')
    : '<div class="bz-gs-dim">库里还没有游戏</div>';

  const bucketCols = rp.buckets
    .map(
      (b) => `
    <div class="bz-gs-col">
      <b>${b.count}</b>
      <span class="bz-gs-colbar" style="height:${Math.max(3, Math.round((b.count / maxBucket) * 92))}px"></span>
      <span class="bz-gs-collabel">${esc(b.label)}</span>
    </div>`,
    )
    .join('');

  const yearCols = rp.years.length
    ? rp.years
        .map(
          (y) => `
    <div class="bz-gs-col${y.year === thisYear ? ' is-now' : ''}">
      <b>${y.count}</b>
      <span class="bz-gs-colbar" style="height:${Math.max(3, Math.round((y.count / maxYear) * 92))}px"></span>
      <span class="bz-gs-collabel">${esc(y.year)}</span>
    </div>`,
        )
        .join('')
    : '<div class="bz-gs-dim">还没有带日期的游玩记录</div>';

  const platRows = rp.platforms.length
    ? rp.platforms
        .map(
          (p) => `
    <div class="bz-gs-rankrow">
      <span class="bz-gs-rankname">${esc(p.label)}</span>
      <span class="bz-gs-rankbar"><i style="width:${Math.max(2, Math.round((p.min / maxPlat) * 100))}%"></i></span>
      <span class="bz-gs-rankval">${numText(hoursOf(p.min))} h</span>
    </div>`,
        )
        .join('')
    : '<div class="bz-gs-dim">Steam 没有给出平台分项时长</div>';

  const latestRows = rp.latest.length
    ? rp.latest
        .map(
          (it) => `
    <button type="button" class="bz-gs-latestrow" data-appid="${it.appid}">
      <span class="bz-gs-latestdate">${esc(dateText(it.lastPlayed))}</span>
      <span class="bz-gs-rankname" title="${escAttr(it.name)}">${esc(displayNameOf(it))}</span>
      <span class="bz-gs-latesth">${hoursText(it.playtimeMin)}</span>
    </button>`,
        )
        .join('')
    : '<div class="bz-gs-dim">Steam 没给最后游玩日期</div>';

  const achPct = rp.total > 0 ? Math.round((rp.achCount / rp.total) * 100) : 0;

  return `
  <div class="bz-gs-stats" id="bz-gs-stats"></div>
  <div class="bz-gs-caveat">${esc(REPORT_CAVEAT)}</div>
  <section class="bz-gs-sec">
    <div class="bz-gs-sectitle">时长排行 · Top 10</div>
    <div class="bz-gs-rows">${topRows}</div>
  </section>
  <section class="bz-gs-sec">
    <div class="bz-gs-sectitle">时长档位分布</div>
    <div class="bz-gs-cols">${bucketCols}</div>
  </section>
  <section class="bz-gs-sec">
    <div class="bz-gs-sectitle">最后游玩年份分布</div>
    <div class="bz-gs-cols">${yearCols}</div>
    <div class="bz-gs-sechint">按最后游玩日期归年，不代表当年新增；深色柱 = 今年</div>
  </section>
  <section class="bz-gs-sec">
    <div class="bz-gs-sectitle">平台分项时长</div>
    <div class="bz-gs-rows">${platRows}</div>
  </section>
  <section class="bz-gs-sec">
    <div class="bz-gs-sectitle">最近玩过</div>
    <div class="bz-gs-rows bz-gs-rows--flat">${latestRows}</div>
  </section>
  <div class="bz-gs-foot">成就页覆盖 ${rp.achCount} / ${rp.total} 款（${achPct}%）· 平均每款 ${numText(rp.avgHours)} 小时 · 折合 ${numText(rp.days)} 天</div>`;
}

/** 统计卡行（uiStat 出基座；与统计页同一次渲染填装） */
function fillStatsRow(app: App, rp: GameshelfReport): void {
  const row = popupEl?.querySelector('#bz-gs-stats');
  if (!row) return;
  row.innerHTML = '';
  row.appendChild(uiStat({ icon: 'gamepad-2', label: '在架游戏', num: String(rp.total), hint: rp.offShelfCount > 0 ? `另有 ${rp.offShelfCount} 款下架保留` : '' }));
  row.appendChild(uiStat({ icon: 'clock', label: '累计时长', num: `${numText(rp.totalHours)} h`, hint: `折合 ${numText(rp.days)} 天` }));
  row.appendChild(uiStat({ icon: 'package', label: '从未启动', num: String(rp.neverPlayed), hint: `玩过 ${rp.played} 款` }));
  row.appendChild(uiStat({ icon: 'calendar-days', label: '最近玩过', num: String(rp.latest.length), hint: rp.latest[0] ? `最近 ${dateText(rp.latest[0].lastPlayed)}` : '' }));
  row.appendChild(uiStat({ icon: 'trophy', label: '成就页覆盖', num: `${rp.achCount}/${rp.total}` }));
}

/* ==================== 详情弹窗（全量数据） ==================== */

/** 详情骨架：头部（封面+名称+速览 chip）→ 我的游玩数据（本地秒出）→ 成就段 → 资料段 → 截图段 */
export function detailShellHtml(item: GameItem, cover: string, fm: Record<string, unknown>, icon = ''): string {
  const store = fmToStore(fm);
  const zh = displayNameOf(item);
  const orig = item.zhName && item.zhName !== item.name ? item.name : '';
  const chips: string[] = [];
  if (store.genres) chips.push(store.genres);
  if (store.platforms) chips.push(store.platforms);
  if (store.releaseDate) chips.push(store.releaseDate);
  if (store.price) chips.push(store.price);
  if (store.zhSupported) chips.push('支持简体中文');
  if (store.metacritic) chips.push(`Metacritic ${store.metacritic}`);
  if (item.offShelf) chips.push('已下架保留');

  return `
  <div class="bz-gs-detail${item.offShelf ? ' bz-gs-detail--off' : ''}">
    <div class="bz-gs-detail-top">
      <div class="bz-gs-detail-cover" data-initial="${escAttr(firstChar(zh))}">
        ${cover ? `<img src="${escAttr(cover)}" data-fallback-src="${escAttr(item.coverSrc ?? '')}" alt="">` : ''}
      </div>
      <div class="bz-gs-detail-id">
        <div class="bz-gs-detail-name">
          ${icon ? `<img class="bz-gs-detail-icon" src="${escAttr(icon)}" data-fallback-src="${escAttr(item.iconSrc ?? '')}" alt="">` : ''}
          <span title="${escAttr(orig ? `${zh} · ${orig}` : zh)}">${esc(zh)}</span>
        </div>
        <div class="bz-gs-detail-chips" id="bz-gs-detail-chips">
          ${chips.map((c) => `<span class="bz-gs-chiplet">${esc(c)}</span>`).join('')}
        </div>
        <div class="bz-gs-detail-appid">${orig ? `原名 ${esc(orig)} · ` : ''}AppID ${item.appid}</div>
      </div>
    </div>
    ${mineHtml(item, fm)}
    <section class="bz-gs-detail-sec" id="bz-gs-detail-ach">
      <div class="bz-gs-sectitle">成就</div>
      <div class="bz-gs-dim">${item.hasAch ? '加载中…' : '这款游戏没有成就页'}</div>
    </section>
    <section class="bz-gs-detail-sec" id="bz-gs-detail-store">
      <div class="bz-gs-sectitle">游戏资料</div>
      <div class="bz-gs-dim">加载中…</div>
    </section>
    <section class="bz-gs-detail-sec" id="bz-gs-detail-shots"></section>
  </div>`;
}

/** 「我的游玩数据」段：全本地数据（时长/记录/平台分布/成就进度/同步时刻） */
function mineHtml(item: GameItem, fm: Record<string, unknown>): string {
  const h = hoursOf(item.playtimeMin);
  const sum = fmToAchSummary(fm);
  const pcts = [
    { label: 'Windows', min: item.windowsMin },
    { label: 'Steam Deck', min: item.deckMin },
    { label: 'macOS', min: item.macMin },
    { label: 'Linux', min: item.linuxMin },
  ].filter((p) => p.min > 0);
  const maxP = Math.max(1, ...pcts.map((p) => p.min));
  const plat = pcts.length
    ? `<div class="bz-gs-mine-plats">${pcts
        .map(
          (p) => `<div class="bz-gs-platrow"><span class="bz-gs-platlabel">${esc(p.label)}</span>
        <span class="bz-gs-platbar"><i style="width:${Math.max(2, Math.round((p.min / maxP) * 100))}%"></i></span>
        <span class="bz-gs-platval">${numText(hoursOf(p.min))} h</span></div>`,
        )
        .join('')}</div>`
    : '<div class="bz-gs-dim">Steam 没有给出平台分项时长</div>';

  const achLine = sum
    ? `<div class="bz-gs-mine-ach">
        <div class="bz-gs-mine-achhead"><span>成就进度</span><span class="bz-gs-mine-achval">${sum.unlocked} / ${sum.total}</span></div>
        <span class="bz-gs-platbar"><i style="width:${Math.max(1, Math.round((sum.unlocked / sum.total) * 100))}%"></i></span>
        ${sum.rare ? `<div class="bz-gs-mine-rare">稀有成就：${esc(sum.rare)}</div>` : ''}
      </div>`
    : '';

  return `
  <section class="bz-gs-detail-sec">
    <div class="bz-gs-sectitle">我的游玩数据</div>
    <div class="bz-gs-mine">
      <div class="bz-gs-mine-num">
        <b>${item.playtimeMin > 0 ? numText(h) : '0'}</b><span>小时</span>
        ${item.playtimeMin > 0 ? `<em>折合 ${numText(Math.round((h / 24) * 10) / 10)} 天</em>` : '<em>从未启动</em>'}
      </div>
      <div class="bz-gs-mine-grid">
        <div><u>最后游玩</u><span>${esc(dateText(item.lastPlayed, '没有记录'))}</span></div>
        <div><u>同步时间</u><span>${esc(item.syncedAt ? dateText(item.syncedAt) : '没有记录')}</span></div>
        <div><u>库里状态</u><span>${item.offShelf ? '已下架保留' : '在架'}</span></div>
        <div><u>成就页</u><span>${item.hasAch ? '有' : '没有'}</span></div>
      </div>
      ${plat}
      ${achLine}
    </div>
  </section>`;
}

/** 成就段落 HTML（进度 + 稀有行 + 逐条明细；明细可滚，上限 200 条） */
export function achListHtml(item: GameItem, sec: AchSection): string {
  const head = '<div class="bz-gs-sectitle">成就</div>';
  if (sec.detail) {
    const d = sec.detail;
    const rows = d.rows
      .slice(0, 200)
      .map((r) => {
        const pct = r.globalPercent === null ? '' : `${r.globalPercent}%`;
        const when = r.unlockedAt ? dateText(r.unlockedAt) : '';
        const desc = r.desc || (r.hidden ? '隐藏成就，解锁后可见说明' : '');
        // 图标**不落盘**（ADR-0176）：直接吃 Schema 给的远端 URL（icon / icongray），不需要
        // 任何本地文件与解析函数。属性里不存图标地址，所以「从属性反解」的那批行没有图标
        // （画占位方块）——打开详情且 `成就更新` 过 24h 时会重拉一次，拉完当场就有图。
        // 灰图 Steam 个别不给 → 回落彩色 + CSS 灰度（观感接近，不额外存一份图）。
        const iconSrc = r.unlocked ? (r.icon ?? r.iconGray) : (r.iconGray ?? r.icon);
        const grayFallback = !r.unlocked && !r.iconGray && !!r.icon;
        return `
      <div class="bz-gs-achrow${r.unlocked ? ' is-on' : ''}" title="${escAttr(desc)}">
        ${iconSrc ? `<img class="bz-gs-achicon${grayFallback ? ' is-gray' : ''}" src="${escAttr(iconSrc)}" alt="" loading="lazy">` : '<span class="bz-gs-achicon bz-gs-achicon--none"></span>'}
        <span class="bz-gs-achtext">
          <span class="bz-gs-achname">${esc(r.name)}</span>
          ${desc ? `<span class="bz-gs-achdesc">${esc(desc)}</span>` : ''}
        </span>
        <span class="bz-gs-achmeta">
          ${pct ? `<span class="bz-gs-achpct" title="全球解锁率">${esc(pct)}</span>` : ''}
          <span class="bz-gs-achwhen">${esc(r.unlocked ? (when || '已解锁') : '未解锁')}</span>
        </span>
      </div>`;
      })
      .join('');
    return `${head}
    <div class="bz-gs-achhead">
      <span class="bz-gs-achsum">${d.unlocked} / ${d.total}（${d.percent}%）</span>
      <span class="bz-gs-platbar"><i style="width:${Math.max(1, d.percent)}%"></i></span>
    </div>
    ${d.rarestName ? `<div class="bz-gs-mine-rare">稀有成就：${esc(d.rarestName)}（全球 ${d.rarestPercent}% 拥有）</div>` : ''}
    <div class="bz-gs-achlist">${rows}</div>
    <div class="bz-gs-sechint">按全球解锁率从稀有到常见排序${d.rows.length > 200 ? `，仅显示前 200 条（共 ${d.rows.length} 条）` : ''}</div>`;
  }
  // 拉不到明细：有 frontmatter 摘要就把进度条画出来（缓存兜底），否则给错误文案
  if (sec.summary) {
    const s = sec.summary;
    return `${head}
    <div class="bz-gs-achhead">
      <span class="bz-gs-achsum">${s.unlocked} / ${s.total}（${Math.round((s.unlocked / s.total) * 1000) / 10}%）</span>
      <span class="bz-gs-platbar"><i style="width:${Math.max(1, Math.round((s.unlocked / s.total) * 100))}%"></i></span>
    </div>
    ${s.rare ? `<div class="bz-gs-mine-rare">稀有成就：${esc(s.rare)}</div>` : ''}
    <div class="bz-gs-dim">${esc(sec.error || '成就明细未拉取')}${sec.fromCache ? '（上方为上次同步缓存）' : ''}</div>`;
  }
  return `${head}<div class="bz-gs-dim">${esc(sec.error || '这款游戏没有成就页')}</div>`;
}

/** 游戏资料段：kv 行 + 评价 + 简介 + 商店链接（拿不到的项不出现） */
export function storeRowsHtml(item: GameItem, sec: StoreSection): string {
  const m = sec.meta;
  const row = (label: string, v: unknown): string => {
    const s = v === undefined || v === null || v === '' ? '' : String(v);
    return s ? `<div class="bz-gs-kv"><u>${esc(label)}</u><span>${esc(s)}</span></div>` : '';
  };
  const reviewBits: string[] = [];
  if (m.reviewsTotal !== null && m.reviewsTotal !== undefined) reviewBits.push(`${Number(m.reviewsTotal).toLocaleString('zh-CN')} 条评测`);
  if (m.reviewsPositive !== null && m.reviewsPositive !== undefined) reviewBits.push(`好评 ${Number(m.reviewsPositive).toLocaleString('zh-CN')}`);
  if (m.reviewsNegative !== null && m.reviewsNegative !== undefined) reviewBits.push(`差评 ${Number(m.reviewsNegative).toLocaleString('zh-CN')}`);
  const meta = sec.meta as Record<string, unknown>;
  const rows = [
    row('价格', m.price),
    row('类型', m.genres),
    row('开发商', m.developers),
    row('发行商', m.publishers),
    row('发行日期', m.releaseDate),
    row('平台', m.platforms),
    row('玩法', m.categories),
    row('评价', [m.reviewDesc, reviewBits.join(' · ')].filter(Boolean).join('（') + (reviewBits.length ? '）' : '')),
    row('Metacritic', m.metacritic),
    row('推荐数', m.recommendations ? Number(m.recommendations).toLocaleString('zh-CN') : ''),
    row('DLC', meta.dlcCount ? `${meta.dlcCount} 个` : ''),
    row('商店成就数', meta.achievementsTotal),
    row('简体中文', m.zhSupported === undefined ? '' : m.zhSupported ? '支持' : '无官方'),
    row('官网', m.website),
  ].join('');
  const desc = m.shortDescription ? `<div class="bz-gs-desc">${esc(m.shortDescription)}</div>` : '';
  const link = `<div class="bz-gs-detail-actions">
      <button type="button" class="bz-btn bz-btn--md" id="bz-gs-open-store"><span class="bz-ic" data-lucide="external-link"></span>在商店打开</button>
    </div>`;
  const err = sec.error ? `<div class="bz-gs-dim">${esc(sec.error)}</div>` : '';
  const cacheTag = sec.fromCache ? '<div class="bz-gs-sechint">以下为上次同步时缓存的资料</div>' : '';
  return `<div class="bz-gs-sectitle">游戏资料</div>${cacheTag}${err}${rows ? `<div class="bz-gs-kvlist">${rows}</div>` : ''}${desc}${link}`;
}

/** 截图段（点开灯箱） */
export function shotsHtml(urls: string[]): string {
  if (!urls.length) return '';
  return `<div class="bz-gs-sectitle">商店截图</div>
  <div class="bz-gs-shots">${urls
    .map((u) => `<button type="button" class="bz-gs-shot" data-src="${escAttr(u)}"><img loading="lazy" src="${escAttr(u)}" alt=""></button>`)
    .join('')}</div>`;
}

/**
 * 打开详情弹窗：**属性优先、零网络**（2026-09-18 起所有数据都在笔记属性里，
 * 断网/代理没开也能看全）。属性缺该块 → 当场拉一次补齐；属性过期 → 后台静默刷新后重填。
 * 成就与资料两段各走各的，互不阻塞。
 */
function openDetail(app: App, appid: number): void {
  // 进弹窗先收悬浮预览（G6）：轮播定时器与换脸在被遮住的卡上继续空转/闪，
  // 弹窗开着时 mouseout 不会来（指针在弹窗上），只能入口处主动收
  restReel();
  restHero();
  const item = M.items.find((it) => it.appid === appid);
  if (!item) return;
  const cached = safeDetailFm(app, item.file);
  const cover = coverDisplayUrl(app, item.appid, item.cover, item.coverSrc);
  const icon = iconDisplayUrl(app, item.appid, item.icon, item.iconSrc);
  const modal = uiModalSafe(detailShellHtml(item, cover, cached, icon), `《${displayNameOf(item)}》`);
  if (!modal) return;
  const popup = modal.popup;
  bindMediaFallback(popup); // 弹窗不在面板树内，图片兜底要单独绑
  // 遮罩毛玻璃：core 的 .bz-overlay-mask 只有平色（各域自绘遮罩都用 --bz-overlay + blur），
  // 这里给本域弹窗的遮罩补上 blur，与面板遮罩 .bz-panel-overlay 观感一致。
  modal.mask.classList.add('bz-gs-detail-mask');

  // 只在「属性本来就有这块」时才排后台刷新——属性缺块的话 load* 当场就拉了，别再拉一遍
  const fmHadAch = !!fmToAchDetail(cached);
  const fmHadStore = hasStoreFm(cached);

  const achBox = popup.querySelector('#bz-gs-detail-ach');
  const paintAch = (sec: AchSection): void => {
    if (achBox && achBox.isConnected) achBox.innerHTML = achListHtml(item, sec);
    mountIcons(popup);
  };
  void loadAchievements(app, item, cached).then((sec) => {
    paintAch(sec);
    if (fmHadAch && item.hasAch && achRefreshDue(cached)) {
      // 玩家解锁了新成就 → 属性要跟上；失败静默（属性里的旧数据继续显示，不打断阅读）
      void refreshAchievements(app, item).then((fresh) => {
        if (fresh.detail) paintAch(fresh);
      });
    }
  });

  const storeBox = popup.querySelector('#bz-gs-detail-store');
  const shotsBox = popup.querySelector('#bz-gs-detail-shots');
  const paintStore = (sec: StoreSection): void => {
    // 每次重渲都重读属性：后台刷新与媒体队列都会改它，截图因此能立刻从远端地址切到本地文件
    const { local, remote } = fmToShots(safeDetailFm(app, item.file));
    const display = resolveShotUrls(app, local, sec.screenshots.length > 0 ? sec.screenshots : remote);
    if (storeBox && storeBox.isConnected) storeBox.innerHTML = storeRowsHtml(item, sec);
    if (shotsBox && shotsBox.isConnected) shotsBox.innerHTML = shotsHtml(display);
    const open = popup.querySelector('#bz-gs-open-store') as HTMLButtonElement | null;
    // 外链收口（跨域旧账）：window.open 换 core openExternalUrl——四级兜底（app.openUrl →
    // electron.shell → window.open → 人话提示），移动端/环境不支持时不再点了没反应
    if (open) open.addEventListener('click', () => openExternalUrl(app, storeUrlOf(item.appid)));
    mountIcons(popup);
  };
  void loadStore(app, item, cached).then((sec) => {
    paintStore(sec);
    if (fmHadStore && storeRefreshDue(cached)) {
      void refreshStore(app, item).then(paintStore);
    }
  });

  // 截图 → 灯箱（委托：截图段整体 innerHTML 替换后依然生效）
  popup.addEventListener('click', (e) => {
    const shot = (e.target as HTMLElement).closest('.bz-gs-shot') as HTMLElement | null;
    if (shot?.dataset.src) openLightbox({ src: shot.dataset.src, type: 'image', title: item.name });
  });

  // 媒体队列下完图后会调它。**只重画「会随下载变化」的那处**（截图的本地图片路径），
  // 不动成就段与资料段——它们的数据来自属性或当场拉取，不随媒体下载变化。
  // 弹窗关了就自清（uiModal 摘掉节点后 isConnected 为假），免得钩子常驻。
  M.modalRepaintFn = () => {
    if (!popup.isConnected) {
      M.modalRepaintFn = null;
      return;
    }
    const fm = safeDetailFm(app, item.file);
    const { local, remote } = fmToShots(fm);
    const urls = resolveShotUrls(app, local, remote);
    if (shotsBox && shotsBox.isConnected && urls.length > 0) shotsBox.innerHTML = shotsHtml(urls);
  };
}

/** 弹窗工厂薄封装（uiModal 直连；抽一层只为收敛标题与宽度口径，并把 mask 一并透出） */
function uiModalSafe(content: string, title: string): { mask: HTMLElement; popup: HTMLElement } | null {
  return uiModal({ head: true, title, maxWidth: 720, className: 'bz-gs-detail-modal', content });
}

/**
 * 图片兜底（事件委托，捕获阶段：img 的 error 不冒泡）：
 * 本地媒体加载失败 → 用「源」键的远端地址再试一次（只试一次，防死循环）；
 * 再失败才置 is-broken（封面留位显示首字占位）。
 * 面板体与详情弹窗各绑一次——uiModal 把弹窗挂在 document.body，不在面板树内。
 */
function bindMediaFallback(root: HTMLElement): void {
  root.addEventListener(
    'error',
    (e) => {
      const img = e.target as HTMLImageElement;
      if (img.tagName !== 'IMG') return;
      if (img.closest('.bz-gs-reel')) return; // 轮播层的失败只代表那格截图没有，不代表封面裂了
      const fb = img.dataset.fallbackSrc;
      if (fb && img.dataset.fbDone !== '1' && img.src !== fb) {
        img.dataset.fbDone = '1';
        img.src = fb;
        return;
      }
      img.closest('.bz-gs-cover, .bz-gs-detail-cover')?.classList.add('is-broken');
    },
    true,
  );
}

/* ==================== 面板壳与渲染 ==================== */

function createUI(app: App): void {
  if (maskEl && document.body.contains(maskEl)) return;
  const mask = document.createElement('div');
  mask.className = 'bz-panel-overlay';
  mask.addEventListener('click', (e) => {
    if (e.target === mask) closePanel();
  });
  const frame = document.createElement('div');
  frame.className = 'bz-panel-frame bz-gs-panel bz-panel-mtop';
  frame.setAttribute('role', 'dialog');
  frame.setAttribute('aria-label', '游戏库');

  // 海报头（frame 级常驻，头行退役）：大海报直接顶到面板顶，两视图共用——
  // 数据统计也画在它下面，面板因此始终有一张「脸」。常驻操作 = 右上角三枚图标钮。
  const heroz = document.createElement('div');
  heroz.className = 'bz-gs-heroz';
  const hero = document.createElement('div');
  hero.id = 'bz-gs-hero';
  const ops = document.createElement('div');
  ops.className = 'bz-gs-heroops';
  ops.id = 'bz-gs-heroops';
  heroz.appendChild(hero);
  heroz.appendChild(ops);
  frame.appendChild(heroz);
  heroEl = hero;

  const status = document.createElement('div');
  status.className = 'bz-gs-status';
  status.id = 'bz-gs-status';
  frame.appendChild(status);

  const body = document.createElement('div');
  body.className = 'bz-gs-body';
  body.id = 'bz-gs-body';
  // 卡片点击 → 详情弹窗；图片加载失败 → 封面占位（capture：img error 不冒泡）
  body.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('.bz-gs-card') as HTMLElement | null;
    if (card) {
      const appid = Number(card.dataset.appid);
      if (Number.isFinite(appid)) openDetail(app, appid);
      return;
    }
    const latest = (e.target as HTMLElement).closest('.bz-gs-latestrow') as HTMLElement | null;
    if (latest) {
      const appid = Number(latest.dataset.appid);
      if (Number.isFinite(appid)) openDetail(app, appid);
    }
  });
  bindMediaFallback(body);
  bindShotReel(app, body); // 悬浮预览（仅鼠标惯用件）：卡片截图快轮播 + 门面换脸
  frame.appendChild(body);

  // ⚠️ frame **必须是遮罩的子节点**：居中的是 .bz-panel-overlay（position:fixed inset:0
  // + flex 居中），.bz-panel-frame 只是 position:relative、自身没有任何定位——
  // 把它挂到 body 上会落进文档流，真机里 Obsidian 的 .app-container 已占满一屏，
  // frame 被排到视口下方 → 用户看到「只有遮罩层，没有主窗口」（2026-09-17 真机反馈）。
  // 其余 13 域同款：frame 一律是 overlay 内部的子节点。
  mask.appendChild(frame);
  document.body.appendChild(mask);
  topifyZ(mask); // 层档只发给遮罩；frame 作为其子节点随父级层叠
  maskEl = mask;
  popupEl = frame;
  M.currentOverlay = frame;
  registerPanelEsc(ESC_ID, () => !!M.currentOverlay, closePanel);
  // 打开即入焦 + Tab 圈闭（呈报#13 F3+H3 全域范式，core trapPanelFocus 单源；纯接线一行）
  trapPanelFocus(frame);
}

async function onSyncClick(app: App): Promise<void> {
  const { runSync } = await import('./sync');
  // 收尾重渲由 runSync finally 的 M.renderFn 兜（eff E6：此处再 renderAll = 同帧整刷两遍；
  // 入队不改 M.items，多刷一遍渲染不出任何新东西）
  await runSync(app, { force: true });
  void ensurePostersFor(app);
  ensureZhNames(app, M.items); // 新入库的游戏也要补中文名
}

/** 同步/打开后补本地媒体（缺封面/图标的入队后台串行下载，并把属性改写成 vault 路径） */
async function ensurePostersFor(app: App): Promise<void> {
  const { ensurePosters, mediaItemsOf } = await import('./posters');
  ensurePosters(app, mediaItemsOf(M.items));
}

/** 门面填装（两视图共用；悬浮换脸的静息态快照在这里存，复原回它不重算） */
function fillHero(app: App, rp: GameshelfReport): void {
  if (!heroEl) return;
  const list = sortList(filterList(M.items));
  if (list.length === 0) {
    heroEl.innerHTML = '';
    heroRestHtml = '';
    return;
  }
  const top = list[0];
  heroRestHtml = heroHtml(top, coverDisplayUrl(app, top.appid, top.cover, top.coverSrc), rp);
  peekedHeroAppid = null; // 静息态刚换过，上一轮的换脸标记作废
  heroEl.innerHTML = heroRestHtml;
}

/* ==================== 输入守护（打字/下拉菜单不被后台整刷打断，影院同款两层） ==================== */
//
// 起因（G1/eff E1）：names/backfill/posters 三队列逐条干活各自节流调 M.renderFn，
// 直通 renderAll 整刷会把工具行连搜索框一起换血——回填期每 1.2s 夺一次焦点、IME 组合
// 被打断、移动端刚点开的下拉随 disposeSelects 凭空消失。两层处理（照搬 cinema/ui.ts）：
// 1) 后台刷新走 renderSoft：打字静默期内（含下拉菜单开着）顺延，手停/菜单收起后补刷；
// 2) 任何整刷（含用户主动触发的）都过焦点守护：快照搜索框的值/选区，渲染后原样落回。
// 域内文本输入只有搜索框一个，快照/落回比影院的实现简。

/** 打字静默期判定（ms）：距上次键入小于此值视为还在打字 */
const TYPING_GUARD_MS = 400;
/** 顺延渲染的补刷延迟（ms）：手停后多久补一次后台刷新 */
const SOFT_RENDER_DELAY_MS = 400;

let softRenderTimer: ReturnType<typeof setTimeout> | null = null;
/** 打字心跳（搜索 input 事件更新；0 = 面板内还没打过字） */
let lastInputAt = 0;

/** 文本输入判定（排除滑杆/勾选等不支持选区的输入类型） */
function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  return !/^(range|checkbox|radio|button|submit|reset|file|color|image)$/i.test(el.type);
}

/** 面板内是否还在打字（焦点在面板文本输入内 + 距上次键入未过静默期） */
function isTyping(): boolean {
  if (!lastInputAt || Date.now() - lastInputAt >= TYPING_GUARD_MS) return false;
  return isTextField(document.activeElement) && !!popupEl?.contains(document.activeElement);
}

/** 面板内是否有下拉菜单开着（后台整刷 disposeSelects 会连带关菜单——开着就顺延） */
function isSelectMenuOpen(): boolean {
  return !!popupEl?.querySelector('.bz-select.open');
}

function clearSoftRender(): void {
  if (softRenderTimer) {
    clearTimeout(softRenderTimer);
    softRenderTimer = null;
  }
}

/**
 * 后台刷新入口（M.renderFn：三队列 scheduleRerender 与 sync 共用此槽，调用点零改动）：
 * 打字或下拉菜单开着时顺延，手停/菜单收起后补刷一次。用户主动触发的渲染（点筛选、
 * 切视图、搜索防抖）一律走 renderAll 立即渲染，不延后。
 */
function renderSoft(app: App): void {
  if (!M.currentOverlay) return;
  if (isTyping() || isSelectMenuOpen()) {
    if (softRenderTimer) clearTimeout(softRenderTimer);
    softRenderTimer = setTimeout(() => {
      softRenderTimer = null;
      renderAll(app);
    }, SOFT_RENDER_DELAY_MS);
    return;
  }
  renderAll(app);
}

/** 渲染前快照焦点（焦点在面板文本输入内才记；value 必记——防抖前的键入不能丢） */
function snapshotFocus(): { value: string; start: number | null; end: number | null } | null {
  const el = document.activeElement;
  if (!isTextField(el) || !popupEl?.contains(el)) return null;
  let start: number | null = null;
  let end: number | null = null;
  try { start = el.selectionStart; end = el.selectionEnd; } catch { /* 不支持选区的类型 */ }
  return { value: el.value, start, end };
}

/** 渲染后落回：找回搜索框（域内唯一文本输入），value 不同才回写（免打断 IME 组合），再恢复焦点与光标 */
function restoreFocus(snap: { value: string; start: number | null; end: number | null } | null): void {
  if (!snap) return;
  const el = popupEl?.querySelector('.bz-gs-search input') as HTMLInputElement | null;
  if (!el) return; // 切到统计页等没有搜索框的视图：不抢焦点
  if (el.value !== snap.value) el.value = snap.value;
  el.focus();
  if (snap.start !== null && snap.end !== null) {
    try { el.setSelectionRange(snap.start, snap.end); } catch { /* 同上 */ }
  }
}

/** 面板全量重渲染（视图分派；海报头常驻，工具行/网格/统计整块重建） */
export function renderAll(app: App): void {
  const frame = M.currentOverlay;
  if (!frame || !document.body.contains(frame)) return;
  clearSoftRender(); // 已排期的顺延渲染作废，本次渲染已覆盖
  const snap = snapshotFocus();
  saveScrollMemo(); // GS4：旧 DOM 的滚位按 renderedView 归账（须在 body 清空前）
  const configured = isConfigured();
  mountOps(app);
  restReel();
  const status = frame.querySelector('#bz-gs-status');
  if (status) status.textContent = M.statusMsg;
  const body = frame.querySelector<HTMLElement>('#bz-gs-body');
  if (!body) return;
  body.innerHTML = '';
  // 视图标记（只有游戏墙打）：移动端「滚动权交给网格本身」那套布局按它切，统计页/引导态不受影响
  body.removeAttribute('data-view');
  disposeSelects(); // 工具行重建前先摘掉上一轮下拉的 document 监听
  gridEl = null;
  lastReport = null;

  if (!configured) {
    if (heroEl) {
      heroEl.innerHTML = '';
      heroRestHtml = '';
    }
    body.appendChild(guidanceEl(app));
    mountIcons(frame);
    renderedView = null; // 引导态无滚位可言：不把它的 scrollTop 记到任何视图名下
    return;
  }
  const rp = buildReport(M.items);
  lastReport = rp;
  fillHero(app, rp);
  if (M.view === 'stats') {
    body.insertAdjacentHTML('beforeend', statsHtml(rp));
    fillStatsRow(app, rp);
  } else {
    body.appendChild(shelfBody(app, rp));
    body.dataset.view = 'shelf';
  }
  mountIcons(frame);
  restoreFocus(snap);
  renderedView = M.view;
  restoreScrollMemo(); // GS4：落位后还滚位（焦点快照回写可能引发滚动，故放在它之后盖过）
}

/**
 * 游戏墙主体：工具行 + 网格宿主（门面已上移为 frame 级海报头，不随视图重建）。
 * 注意两层「网格」不是同一件东西：`#bz-gs-grid`（.bz-gs-gridhost）是**宿主**，
 * 里面由 shelfHtml 渲染的 `.bz-gs-grid` 才是卡片网格本身——移动端「搜索行固定」那套
 * 把滚动权交给的是宿主（见 styles.css 的 data-view=shelf 段）。
 */
function shelfBody(app: App, rp: GameshelfReport): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'bz-gs-wall';
  // 工具行两套形态（同一份状态，CSS 按屏宽取一套）：
  //   桌面 = 6 个档位 chip + 三档分段排序；移动 = 档位/排序两个下拉 + 搜索同行。
  // 两套都渲染而不是按 Platform 分支：媒体查询能随窗口宽实时切，Platform 是启动时定值。
  wrap.innerHTML = `
    <div class="bz-gs-tools">
      <div class="bz-gs-chips" id="bz-gs-chips"></div>
      <div class="bz-gs-toolsend">
        <div class="bz-gs-sortseg" id="bz-gs-sort"></div>
        <div class="bz-gs-sels">
          <div class="bz-gs-sel" id="bz-gs-bucketsel"></div>
          <div class="bz-gs-sel" id="bz-gs-sortsel"></div>
        </div>
        <div class="bz-gs-searchwrap" id="bz-gs-search"></div>
      </div>
    </div>
    <div class="bz-gs-gridhost" id="bz-gs-grid"></div>`;
  gridEl = wrap.querySelector('#bz-gs-grid');

  // 档位 chips（含「全部」；计数即时从报告口径出）
  const chips = wrap.querySelector('#bz-gs-chips')!;
  const counts = new Map<string, number>(rp.buckets.map((b) => [b.key, b.count]));
  for (const def of BUCKETS) {
    const chip = uiChip({
      label: def.label,
      count: def.key === 'all' ? rp.total : counts.get(def.key) ?? 0,
      selectedSoft: M.bucket === def.key,
      onClick: () => {
        M.bucket = def.key as GameshelfBucket;
        syncChipState();
        bucketSelRef?.setValue(M.bucket); // 回写移动端下拉（G5：两套控件只有一半回路会显示旧值）
        renderList(app);
      },
    });
    chip.classList.add('bz-gs-chip');
    chip.dataset.k = def.key;
    // 挂载即带 aria-pressed（UX 拍板项）：core uiChip 不设缺省选中态属性，等首次点击才补
    // 会让读屏器在首屏拿到「无态」按钮——创建时就按当前档位落一次
    chip.setAttribute('aria-pressed', String(M.bucket === def.key));
    chips.appendChild(chip);
  }

  // 排序（桌面：三档分段；口径标签与 heroTag 一致）
  const sortSeg = uiSegmented<GameshelfSort>({
    value: M.sort,
    label: '排序',
    options: [
      { value: 'hours', label: '时长' },
      { value: 'last', label: '最近玩' },
      { value: 'name', label: '名称' },
    ],
    onChange: (v) => {
      M.sort = v;
      sortSelRef?.setValue(v); // 回写移动端下拉（G5，同上）
      renderList(app);
    },
  });
  sortSegRef = sortSeg;
  wrap.querySelector('#bz-gs-sort')!.appendChild(sortSeg.el);

  // 移动端两个下拉（同样口径：labels 带计数，与 chips 一致）
  const bucketLabel = (key: GameshelfBucket): string => {
    if (key === 'all') return `全部 ${rp.total}`;
    const def = BUCKETS.find((b) => b.key === key);
    return `${def?.label ?? key} ${counts.get(key) ?? 0}`;
  };
  const selRefs: Array<{ detach: () => void }> = [];
  const bucketSel = uiSelect<GameshelfBucket>({
    value: M.bucket,
    className: 'bz-gs-select',
    options: BUCKETS.map((b) => ({ value: b.key, label: bucketLabel(b.key) })),
    onChange: (v) => {
      M.bucket = v;
      syncChipState();
      renderList(app);
    },
  });
  const sortSel = uiSelect<GameshelfSort>({
    value: M.sort,
    className: 'bz-gs-select',
    options: [
      { value: 'hours', label: '按时长' },
      { value: 'last', label: '按最近玩' },
      { value: 'name', label: '按名称' },
    ],
    onChange: (v) => {
      M.sort = v;
      sortSegRef?.setValue(v);
      renderList(app);
    },
  });
  selRefs.push(bucketSel, sortSel);
  wrap.querySelector('#bz-gs-bucketsel')!.appendChild(bucketSel.el);
  wrap.querySelector('#bz-gs-sortsel')!.appendChild(sortSel.el);
  selectRefs = selRefs;
  // 句柄入槽（G5 互译回路）：chips/分段改值时回写下拉，跨屏宽切换另一套不显旧值
  bucketSelRef = bucketSel;
  sortSelRef = sortSel;

  // 搜索（实时过滤；只重填列表，输入框不重建，焦点不丢）。180ms 防抖（对齐保险库/
  // 备忘录/剪藏本三域先例）：打字每键不再全网格重建 + 全库成就行重解析
  const search = uiSearch({
    placeholder: '搜索游戏名',
    value: M.query,
    clearable: false, // 自带 .bz-gs-search-clear 同款钮（下方），关 core 内置钮防双钮
    onInput: (v) => {
      lastInputAt = Date.now(); // 打字心跳：renderSoft 据此让路（含 IME 组合期）
      M.query = v;
      syncSearchClear();
      searchListRender(app);
    },
  });
  search.el.classList.add('bz-gs-search');
  // 尾部 ✕ 一键清除（clipbook 效率#12 定稿范式）：有词才显示，点 = 清词 + 刷新 + 焦点回框
  const searchClear = document.createElement('button');
  searchClear.type = 'button';
  searchClear.className = 'bz-gs-search-clear';
  searchClear.title = '清除搜索';
  searchClear.setAttribute('aria-label', '清除搜索');
  searchClear.hidden = !M.query.trim();
  searchClear.innerHTML = '<i data-lucide="x" class="bz-ic"></i>'; // mountIcons 兑现成 SVG
  searchClear.addEventListener('click', () => clearSearch(app, search.input));
  // ESC 二段清词（clipbook 效率#11 定稿范式）：有词 = 只清词不冒泡（escManager 的
  // document 层收不到，防「清词变成关整个面板」）；无词放行（关面板语义不变）
  search.input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented) return;
    if (!search.input.value.trim()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    clearSearch(app, search.input);
  });
  search.el.appendChild(searchClear);
  wrap.querySelector('#bz-gs-search')!.appendChild(search.el);

  renderList(app);
  return wrap;
}

/** 防抖窗口：对齐保险库/备忘录/剪藏本（clipbook SEARCH_DEBOUNCE_MS = 180 同口径） */
const SEARCH_DEBOUNCE_MS = 180;

/** 搜索防抖（模块级单例，closePanel cancel）：尾触 180ms 后只重填列表一次 */
const searchListRender = debounce((app: App) => renderList(app), SEARCH_DEBOUNCE_MS);

/** ✕ 显隐随词同步（有词才显示） */
function syncSearchClear(): void {
  const btn = popupEl?.querySelector('.bz-gs-search-clear') as HTMLElement | null;
  if (btn) btn.hidden = !M.query.trim();
}

/** 清词 + 刷新 + 焦点回框（ESC 有词段与 ✕ 共用；调用方已拦住事件冒泡） */
function clearSearch(app: App, input: HTMLInputElement): void {
  input.value = '';
  M.query = '';
  syncSearchClear();
  renderList(app);
  input.focus();
}

/** chips 选中态就地更新（不重建 DOM，保留 hover/焦点；选中类 = core chip 的 --sel 软底） */
function syncChipState(): void {
  popupEl?.querySelectorAll<HTMLElement>('.bz-gs-chip').forEach((c) => {
    const on = c.dataset.k === M.bucket;
    c.classList.toggle('bz-chip--sel', on);
    c.setAttribute('aria-pressed', String(on));
  });
}

/** 只重填门面与网格（筛选/排序/搜索走这条，避免整面板重建） */
export function renderList(app: App): void {
  if (!gridEl) return;
  const rp = lastReport ?? buildReport(M.items);
  lastReport = rp;
  restReel();
  fillHero(app, rp);
  const list = sortList(filterList(M.items));
  const showRank = M.bucket === 'all' && !M.query.trim() && M.sort === 'hours';
  // 成就进度（条 + 奖杯）从笔记属性读（属性优先零网络）；无成就页/属性缺 → null，卡上不显示
  const achOf = (it: GameItem): { unlocked: number; total: number } | null => {
    if (!it.hasAch) return null;
    const s = fmToAchSummary(safeDetailFm(app, it.file));
    return s && s.total > 0 ? { unlocked: s.unlocked, total: s.total } : null;
  };
  if (list.length === 0) {
    gridEl.innerHTML = '';
    gridEl.appendChild(emptyResult(app));
  } else {
    gridEl.innerHTML = shelfHtml(list, (it) => coverDisplayUrl(app, it.appid, it.cover, it.coverSrc), { showRank, achOf });
  }
  const frame = M.currentOverlay;
  if (frame) mountIcons(frame);
}

/** 筛选无结果时的空态（一键清筛选） */
function emptyResult(app: App): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'bz-gs-guide-actions';
  const clear = uiBtn({
    label: '清除筛选',
    onClick: () => {
      M.bucket = 'all';
      M.query = '';
      const s = popupEl?.querySelector('.bz-gs-search input') as HTMLInputElement | null;
      if (s) s.value = '';
      syncChipState();
      bucketSelRef?.setValue(M.bucket); // 同 G5：下拉跟回「全部」
      syncSearchClear();
      renderList(app);
    },
  });
  clear.id = 'bz-gs-clear-filter';
  actions.appendChild(clear);
  return uiEmpty({
    icon: 'search',
    title: M.items.length === 0 ? '还没有游戏' : '没有匹配的游戏',
    desc: M.items.length === 0 ? '点右上角立即同步，从 Steam 把库和时长拉进来。' : '换个关键词，或把时长档位放宽。',
    actions,
  });
}

/** 已配置判定：SteamID64 与 Web API 密钥都有值（未配置 → 引导态，不弹设置） */
function isConfigured(): boolean {
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    const id = typeof s.gameshelfSteamId === 'string' ? s.gameshelfSteamId.trim() : '';
    const key = typeof s.gameshelfSteamApiKey === 'string' ? s.gameshelfSteamApiKey.trim() : '';
    return !!id && !!key;
  } catch {
    return false;
  }
}

/* ==================== 开 / 关 ==================== */

/** 打开面板（挂壳 + 首渲 + 补海报与中文名）；已挂则跳过（toggle 关分支走 closePanel）。
 *  view 缺省落游戏墙（统计是点右侧入口才进的一页）；命令 bz-gameshelf-stats 传 'stats' 直达。 */
export function openPanel(app: App, view: GameshelfViewKind = 'shelf'): void {
  createUI(app);
  M.view = view;
  // 三队列 scheduleRerender 与 sync 收尾统一走 renderSoft（G1）：打字/下拉菜单开着时顺延，
  // 不再整刷抢焦点——调用点（names/backfill/posters/sync）零改动即全收
  M.renderFn = () => renderSoft(app);
  renderAll(app);
  void ensurePostersFor(app);
  ensureZhNames(app, M.items);
}

/** 关闭（toggle 语义的关分支）：DOM 摘除 + ESC 注销 + 定时器/状态清理（下次打开不背旧账） */
export function closePanel(): void {
  saveScrollMemo(); // GS4：末次渲染后用户再滚过的位置在摘除 DOM 前补记（重开接回）
  renderedView = null; // DOM 已摘：防下次 openPanel 首渲把新空容器的 scrollTop=0 记到旧视图名下
  unregisterPanelEsc(ESC_ID);
  restReel();
  clearSoftRender(); // 面板已关：顺延渲染不再补，免留野定时器（影院 closeOverlay 同口径）
  searchListRender.cancel(); // 防抖中的搜索重渲一并作废
  maskEl?.remove();
  maskEl = null;
  popupEl = null;
  M.currentOverlay?.remove();
  M.currentOverlay = null;
  disposeSelects();
  bucketSelRef = null;
  sortSelRef = null;
  heroEl = null;
  heroRestHtml = '';
  peekedHeroAppid = null;
  gridEl = null;
  lastReport = null;
  rankMemo = null; // 位次缓存随库会话作废（开面板 rebuildItems 换数组本也会失效）
  lastInputAt = 0; // 打字心跳归零：新会话不被旧心跳误判成「还在打字」
  M.statusMsg = ''; // 状态行不跨开关残留（UX-1）：重开面板不再挂着上次的「同步完成…」
  M.renderFn = null;
  M.modalRepaintFn = null;
  clearDetailCache();
  unloadZhNames();
  // 后台回填（商店资料/成就三键）也随面板关闭停止：别在用户眼皮外继续改笔记，
  // 下次打开面板幂等续跑
  unloadBackfill();
  // 媒体下载（封面/库内图标/截图）同口径关停（深审 F5 关停三选二收口）：
  // 三队列关停语义就此一致
  unloadPosters();
}
