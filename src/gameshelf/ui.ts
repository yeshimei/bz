/**
 * 游戏架（gameshelf）域 UI v3（2026-09-17：V1 海报墙方向落域 + 数据统计面板 + 全量详情弹窗）。
 *
 * 单源约定：markup 纯函数（heroHtml/shelfHtml/statsHtml/详情三段）与行为层同文件，
 * 插件面板与评审壳消费同一份——改一处两侧生效（docs/prototype-first.md）。
 * 面板基座 = core .bz-panel-overlay / .bz-panel-frame / .bz-panel-mtop（13 域同款），
 * 头行 = uiMainHead，视图切换 = uiSegmented，统计卡 = uiStat，空态 = uiEmpty，
 * 筛选 = uiChip，排序 = uiSegmented，搜索 = uiSearch。
 *
 * 亮暗：全部消费 --bz token（tokens.css 的 .theme-dark/.theme-light 双组），零固定色——
 * 评审壳默认亮色、可切暗色，插件内跟随宿主主题。
 * 移动端：≤768px 真全屏（--bz-vvh 口径，软键盘不遮底）+ .bz-panel-mtop 44px 顶部避让。
 * 无入场动效；滚动条不自造（ADR-0122 界面级单源隐藏）。
 */
import type { App } from 'obsidian';
import { topifyZ } from '../core/dom';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { tryGetSettings } from '../core/settings-provider';
import { uiMainHead, uiSegmented, uiSelect, uiStat, uiEmpty, uiBtn, uiChip, uiSearch, uiModal, mountIcons, openLightbox } from '../core/ui';
import { M, displayNameOf, nameMatches, type GameItem, type GameshelfBucket, type GameshelfSort, type GameshelfViewKind } from './state';
import { BUCKETS, bucketOf, buildReport, REPORT_CAVEAT, type GameshelfReport } from './report';
import {
  clearDetailCache, fmToAchSummary, fmToStore, loadAchievements, loadStore, safeDetailFm, storeUrlOf,
  type AchSection, type StoreSection,
} from './detail';
import { ensureZhNames, unloadZhNames } from './names';
import { coverDisplayUrl, iconDisplayUrl } from './posters';

const ESC_ID = 'gameshelf';

let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let sortSegRef: { setValue: (v: GameshelfSort) => void } | null = null;
let countRef: { setCount: (c?: string) => void } | null = null;
/** 游戏墙的两个动态区（renderList 只重填这两块，保住搜索框焦点与滚动位置） */
let heroEl: HTMLElement | null = null;
let gridEl: HTMLElement | null = null;
/** 本次渲染的报告（工具行计数与统计页共用一次计算） */
let lastReport: GameshelfReport | null = null;
/** 移动端两个下拉的句柄（每次重建工具行都要 detach——uiSelect 挂了 document 级点击监听） */
let selectRefs: Array<{ detach: () => void }> = [];

/** 释放上一轮下拉（漏了就是每渲染一次攒一个 document 监听） */
function disposeSelects(): void {
  for (const s of selectRefs) s.detach();
  selectRefs = [];
}

/** 视图入口按钮：随当前视图只出一条（游戏墙 ↔ 数据统计） */
function fillViewSlot(app: App): void {
  const slot = popupEl?.querySelector('.bz-gs-viewslot');
  if (!slot) return;
  const onStats = M.view === 'stats';
  const b = uiBtn({
    label: onStats ? '游戏墙' : '数据统计',
    icon: onStats ? 'layout-grid' : 'bar-chart-3',
    on: onStats,
    title: onStats ? '返回游戏墙' : '数据统计',
    onClick: () => {
      M.view = onStats ? 'shelf' : 'stats';
      renderAll(app);
    },
  });
  b.classList.add('bz-gs-viewbtn');
  b.setAttribute('aria-label', onStats ? '返回游戏墙' : '数据统计');
  slot.replaceChildren(b);
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

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const escAttr = escHtml;

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
    title: '接上 Steam，游戏架自己长出来',
    desc: '在设置面板游戏架页填 SteamID64 和 Web API 密钥，保存后回来点同步，库和时长自动拉进来，不用手动登记。',
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
 */
export function heroHtml(item: GameItem, cover: string, rp: GameshelfReport, tag = heroTag()): string {
  const zh = displayNameOf(item);
  const orig = item.zhName && item.zhName !== item.name ? item.name : '';
  const sub = [
    hoursOf(item.playtimeMin) > 0 ? `${numText(hoursOf(item.playtimeMin))} 小时` : '从未启动',
    item.lastPlayed ? `最后游玩 ${dateText(item.lastPlayed)}` : '没有游玩记录',
    `在库 ${M.items.length} 款中第 ${indexInList(item) + 1} 位`,
  ].join(' · ');
  const bg = cover ? ` style="background-image:url('${escAttr(cover)}')"` : '';
  return `
  <div class="bz-gs-hero${cover ? '' : ' bz-gs-hero--bare'}">
    <div class="bz-gs-hero-art"${bg}></div>
    <div class="bz-gs-hero-veil"></div>
    <div class="bz-gs-hero-in">
      <div class="bz-gs-hero-left">
        <span class="bz-gs-hero-tag">${escHtml(tag)}</span>
        <div class="bz-gs-hero-name" title="${escAttr(item.name)}">${escHtml(zh)}</div>
        ${orig ? `<div class="bz-gs-hero-orig">${escHtml(orig)}</div>` : ''}
        <div class="bz-gs-hero-sub">${escHtml(sub)}</div>
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

/** 门面里「在库第几位」按全库时长为序（不随筛选跳动，口径稳定） */
function indexInList(item: GameItem): number {
  const all = [...M.items].sort((a, b) => b.playtimeMin - a.playtimeMin);
  return Math.max(0, all.findIndex((it) => it.appid === item.appid));
}

/** 时长条/排名基准（全库最长时长） */
function maxPlaytime(): number {
  return Math.max(1, ...M.items.map((it) => it.playtimeMin));
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
 * 游戏墙网格：封面卡（Steam header 比例）+ 名字/时长 + 时长条。
 * - 时长条基准 = 全库最长时长（maxMin 显式传入，纯函数不读模块状态）——
 *   基准固定，筛掉长时长游戏后条长仍然可比；
 * - 排名角标只在「未筛选 + 按时长排」时出现（换了口径的序号没有意义，宁可不显示）。
 */
export function shelfHtml(
  items: GameItem[],
  coverOf: (it: GameItem) => string,
  opts: { showRank?: boolean; maxMin?: number } = {},
): string {
  const max = Math.max(1, opts.maxMin ?? 1);
  const cards = items
    .map((it, i) => {
      const cover = coverOf(it);
      const zh = displayNameOf(it);
      const orig = it.zhName && it.zhName !== it.name ? it.name : '';
      const rank = opts.showRank && i < 3 ? `<span class="bz-gs-rank">NO.${i + 1}</span>` : '';
      const pct = Math.max(1, Math.min(100, Math.round(((it.playtimeMin || 0) / max) * 100)));
      const hint = it.playtimeMin > 0
        ? `${numText(hoursOf(it.playtimeMin))} 小时`
        : '从未启动';
      const last = it.lastPlayed ? dateText(it.lastPlayed) : '—';
      return `
      <button type="button" class="bz-gs-card${it.offShelf ? ' bz-gs-card--off' : ''}" data-appid="${it.appid}" title="${escAttr(orig ? `${zh} · ${orig}` : zh)}">
        <span class="bz-gs-cover" data-initial="${escAttr(firstChar(zh))}">
          ${cover ? `<img loading="lazy" src="${escAttr(cover)}" data-fallback-src="${escAttr(it.coverSrc ?? '')}" alt="">` : '<span class="bz-gs-cover-ic" data-lucide="gamepad-2"></span>'}
          ${rank}
          ${it.offShelf ? '<span class="bz-gs-off">已下架</span>' : ''}
          <span class="bz-gs-hint"><span>${escHtml(hint)}</span><span class="bz-gs-hint-d">${escHtml(last)}</span></span>
        </span>
        <span class="bz-gs-cardbar">
          <span class="bz-gs-namebox">
            <span class="bz-gs-name">${escHtml(zh)}</span>
            ${orig ? `<span class="bz-gs-orig">${escHtml(orig)}</span>` : ''}
          </span>
          <span class="bz-gs-hours">${hoursText(it.playtimeMin)}</span>
        </span>
        <span class="bz-gs-strip"><i style="width:${pct}%"></i></span>
      </button>`;
    })
    .join('');
  return `<div class="bz-gs-grid">${cards}</div>`;
}

/** 首字符（封面加载失败时的占位字） */
function firstChar(name: string): string {
  return name.slice(0, 1) || '?';
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
        <span class="bz-gs-rankno">${String(i + 1).padStart(2, '0')}</span>
        <span class="bz-gs-rankname" title="${escAttr(t.name)}">${escHtml(t.name)}</span>
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
      <span class="bz-gs-collabel">${escHtml(b.label)}</span>
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
      <span class="bz-gs-collabel">${escHtml(y.year)}</span>
    </div>`,
        )
        .join('')
    : '<div class="bz-gs-dim">还没有带日期的游玩记录</div>';

  const platRows = rp.platforms.length
    ? rp.platforms
        .map(
          (p) => `
    <div class="bz-gs-rankrow">
      <span class="bz-gs-rankname">${escHtml(p.label)}</span>
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
    <div class="bz-gs-latestrow" data-appid="${it.appid}">
      <span class="bz-gs-latestdate">${escHtml(dateText(it.lastPlayed))}</span>
      <span class="bz-gs-rankname" title="${escAttr(it.name)}">${escHtml(displayNameOf(it))}</span>
      <span class="bz-gs-latesth">${hoursText(it.playtimeMin)}</span>
    </div>`,
        )
        .join('')
    : '<div class="bz-gs-dim">Steam 没给最后游玩日期</div>';

  const achPct = rp.total > 0 ? Math.round((rp.achCount / rp.total) * 100) : 0;

  return `
  <div class="bz-gs-stats" id="bz-gs-stats"></div>
  <div class="bz-gs-caveat">${escHtml(REPORT_CAVEAT)}</div>
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
          <span title="${escAttr(orig ? `${zh} · ${orig}` : zh)}">${escHtml(zh)}</span>
        </div>
        <div class="bz-gs-detail-chips" id="bz-gs-detail-chips">
          ${chips.map((c) => `<span class="bz-gs-chiplet">${escHtml(c)}</span>`).join('')}
        </div>
        <div class="bz-gs-detail-appid">${orig ? `原名 ${escHtml(orig)} · ` : ''}AppID ${item.appid}</div>
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
          (p) => `<div class="bz-gs-platrow"><span class="bz-gs-platlabel">${escHtml(p.label)}</span>
        <span class="bz-gs-platbar"><i style="width:${Math.max(2, Math.round((p.min / maxP) * 100))}%"></i></span>
        <span class="bz-gs-platval">${numText(hoursOf(p.min))} h</span></div>`,
        )
        .join('')}</div>`
    : '<div class="bz-gs-dim">Steam 没有给出平台分项时长</div>';

  const achLine = sum
    ? `<div class="bz-gs-mine-ach">
        <div class="bz-gs-mine-achhead"><span>成就进度</span><span class="bz-gs-mine-achval">${sum.unlocked} / ${sum.total}</span></div>
        <span class="bz-gs-platbar"><i style="width:${Math.max(1, Math.round((sum.unlocked / sum.total) * 100))}%"></i></span>
        ${sum.rare ? `<div class="bz-gs-mine-rare">稀有成就：${escHtml(sum.rare)}</div>` : ''}
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
        <div><u>最后游玩</u><span>${escHtml(dateText(item.lastPlayed, '没有记录'))}</span></div>
        <div><u>同步时间</u><span>${escHtml(item.syncedAt ? dateText(item.syncedAt) : '没有记录')}</span></div>
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
        return `
      <div class="bz-gs-achrow${r.unlocked ? ' is-on' : ''}" title="${escAttr(desc)}">
        ${r.icon ? `<img class="bz-gs-achicon" src="${escAttr(r.icon)}" alt="" loading="lazy">` : '<span class="bz-gs-achicon bz-gs-achicon--none"></span>'}
        <span class="bz-gs-achtext">
          <span class="bz-gs-achname">${escHtml(r.name)}</span>
          ${desc ? `<span class="bz-gs-achdesc">${escHtml(desc)}</span>` : ''}
        </span>
        <span class="bz-gs-achmeta">
          ${pct ? `<span class="bz-gs-achpct" title="全球解锁率">${escHtml(pct)}</span>` : ''}
          <span class="bz-gs-achwhen">${escHtml(r.unlocked ? (when || '已解锁') : '未解锁')}</span>
        </span>
      </div>`;
      })
      .join('');
    return `${head}
    <div class="bz-gs-achhead">
      <span class="bz-gs-achsum">${d.unlocked} / ${d.total}（${d.percent}%）</span>
      <span class="bz-gs-platbar"><i style="width:${Math.max(1, d.percent)}%"></i></span>
    </div>
    ${d.rarestName ? `<div class="bz-gs-mine-rare">稀有成就：${escHtml(d.rarestName)}（全球 ${d.rarestPercent}% 拥有）</div>` : ''}
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
    ${s.rare ? `<div class="bz-gs-mine-rare">稀有成就：${escHtml(s.rare)}</div>` : ''}
    <div class="bz-gs-dim">${escHtml(sec.error || '成就明细未拉取')}${sec.fromCache ? '（上方为上次同步缓存）' : ''}</div>`;
  }
  return `${head}<div class="bz-gs-dim">${escHtml(sec.error || '这款游戏没有成就页')}</div>`;
}

/** 游戏资料段：kv 行 + 评价 + 简介 + 商店链接（拿不到的项不出现） */
export function storeRowsHtml(item: GameItem, sec: StoreSection): string {
  const m = sec.meta;
  const row = (label: string, v: unknown): string => {
    const s = v === undefined || v === null || v === '' ? '' : String(v);
    return s ? `<div class="bz-gs-kv"><u>${escHtml(label)}</u><span>${escHtml(s)}</span></div>` : '';
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
  const desc = m.shortDescription ? `<div class="bz-gs-desc">${escHtml(m.shortDescription)}</div>` : '';
  const link = `<div class="bz-gs-detail-actions">
      <button type="button" class="bz-btn bz-btn--md" id="bz-gs-open-store"><span class="bz-ic" data-lucide="external-link"></span>在商店打开</button>
    </div>`;
  const err = sec.error ? `<div class="bz-gs-dim">${escHtml(sec.error)}</div>` : '';
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

/** 打开详情弹窗（本地数据秒出；成就/资料各拉各的，互不阻塞） */
function openDetail(app: App, appid: number): void {
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

  const achBox = popup.querySelector('#bz-gs-detail-ach');
  void loadAchievements(app, item, cached).then((sec) => {
    if (achBox && achBox.isConnected) achBox.innerHTML = achListHtml(item, sec);
    mountIcons(popup);
  });
  const storeBox = popup.querySelector('#bz-gs-detail-store');
  const shotsBox = popup.querySelector('#bz-gs-detail-shots');
  void loadStore(app, item, cached).then((sec) => {
    if (storeBox && storeBox.isConnected) storeBox.innerHTML = storeRowsHtml(item, sec);
    if (shotsBox && shotsBox.isConnected) shotsBox.innerHTML = shotsHtml(sec.screenshots);
    const open = popup.querySelector('#bz-gs-open-store') as HTMLButtonElement | null;
    if (open) open.addEventListener('click', () => window.open(storeUrlOf(item.appid), '_blank'));
    mountIcons(popup);
  });
  // 截图 → 灯箱（委托：截图段整体 innerHTML 替换后依然生效）
  popup.addEventListener('click', (e) => {
    const shot = (e.target as HTMLElement).closest('.bz-gs-shot') as HTMLElement | null;
    if (shot?.dataset.src) openLightbox({ src: shot.dataset.src, type: 'image', title: item.name });
  });
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
  frame.setAttribute('aria-label', '游戏架');

  const head = uiMainHead({
    title: '游戏架',
    action: { label: '立即同步', icon: 'refresh-cw', onClick: () => void onSyncClick(app) },
  });
  countRef = head;
  // 视图入口 = 头行右侧工具位（一个槽位随状态只出一条）：游戏墙上写「数据统计」，
  // 统计页上写「游戏墙」——不做平级页签，因为面板默认就是游戏墙，统计是有需要才进的入口。
  const slot = document.createElement('span');
  slot.className = 'bz-gs-viewslot';
  const primaryBtn = head.el.querySelector('.bz-btn--primary') as HTMLButtonElement | null;
  if (primaryBtn) {
    primaryBtn.title = '立即同步'; // 移动端按钮只留图标，靠 title/aria-label 表意
    head.el.insertBefore(slot, primaryBtn);
  } else {
    head.el.appendChild(slot);
  }
  // 关闭：桌面走点遮罩 / ESC（issue 271：头行不放关闭钮）；移动端全屏面板遮不住——
  // 那个 ✕ 只在 ≤768px 出现（styles.css 里控显隐），否则手机上出去了回不来。
  const close = uiBtn({ label: '关闭', icon: 'x', title: '关闭', onClick: () => closePanel() });
  close.classList.add('bz-gs-close');
  close.setAttribute('aria-label', '关闭');
  head.el.appendChild(close);
  frame.appendChild(head.el);

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
  frame.appendChild(body);

  document.body.appendChild(mask);
  document.body.appendChild(frame);
  topifyZ(mask, frame);
  maskEl = mask;
  popupEl = frame;
  M.currentOverlay = frame;
  registerPanelEsc(ESC_ID, () => !!M.currentOverlay, closePanel);
}

async function onSyncClick(app: App): Promise<void> {
  const { runSync } = await import('./sync');
  await runSync(app, { force: true });
  void ensurePostersFor(app);
  ensureZhNames(app, M.items); // 新入库的游戏也要补中文名
  renderAll(app);
}

/** 同步/打开后补本地媒体（缺封面/图标的入队后台串行下载，并把属性改写成 vault 路径） */
async function ensurePostersFor(app: App): Promise<void> {
  const { ensurePosters, mediaItemsOf } = await import('./posters');
  ensurePosters(app, mediaItemsOf(M.items));
}

/** 面板全量重渲染（视图分派；工具行/门面/网格整块重建） */
export function renderAll(app: App): void {
  const frame = M.currentOverlay;
  if (!frame || !document.body.contains(frame)) return;
  const configured = isConfigured();
  fillViewSlot(app);
  countRef?.setCount(configured ? `${M.items.filter((it) => !it.offShelf).length} 款` : '');
  const syncBtn = frame.querySelector('.bz-btn--primary') as HTMLButtonElement | null;
  if (syncBtn) syncBtn.disabled = M.syncing || !configured;
  const status = frame.querySelector('#bz-gs-status');
  if (status) status.textContent = M.statusMsg;
  const body = frame.querySelector('#bz-gs-body');
  if (!body) return;
  body.innerHTML = '';
  disposeSelects(); // 工具行重建前先摘掉上一轮下拉的 document 监听
  heroEl = null;
  gridEl = null;
  lastReport = null;

  if (!configured) {
    body.appendChild(guidanceEl(app));
    mountIcons(frame);
    return;
  }
  const rp = buildReport(M.items);
  lastReport = rp;
  if (M.view === 'stats') {
    body.insertAdjacentHTML('beforeend', statsHtml(rp));
    fillStatsRow(app, rp);
  } else {
    body.appendChild(shelfBody(app, rp));
  }
  mountIcons(frame);
}

/** 游戏墙主体：门面 + 工具行 + 网格（三块容器固定，列表变化只重填门面与网格） */
function shelfBody(app: App, rp: GameshelfReport): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'bz-gs-wall';
  // 工具行两套形态（同一份状态，CSS 按屏宽取一套）：
  //   桌面 = 6 个档位 chip + 三档分段排序；移动 = 档位/排序两个下拉 + 搜索同行。
  // 两套都渲染而不是按 Platform 分支：媒体查询能随窗口宽实时切，Platform 是启动时定值。
  wrap.innerHTML = `
    <div id="bz-gs-hero"></div>
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
    <div id="bz-gs-grid"></div>`;
  heroEl = wrap.querySelector('#bz-gs-hero');
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
        renderList(app);
      },
    });
    chip.classList.add('bz-gs-chip');
    chip.dataset.k = def.key;
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

  // 搜索（实时过滤；只重填列表，输入框不重建，焦点不丢）
  const search = uiSearch({
    placeholder: '搜索游戏名',
    value: M.query,
    onInput: (v) => {
      M.query = v;
      renderList(app);
    },
  });
  search.el.classList.add('bz-gs-search');
  wrap.querySelector('#bz-gs-search')!.appendChild(search.el);

  renderList(app);
  return wrap;
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
  if (!heroEl || !gridEl) return;
  const rp = lastReport ?? buildReport(M.items);
  lastReport = rp;
  const list = sortList(filterList(M.items));
  const showRank = M.bucket === 'all' && !M.query.trim() && M.sort === 'hours';
  if (list.length === 0) {
    heroEl.innerHTML = '';
    gridEl.innerHTML = '';
    gridEl.appendChild(emptyResult(app));
  } else {
    const top = list[0];
    heroEl.innerHTML = heroHtml(top, coverDisplayUrl(app, top.appid, top.cover, top.coverSrc), rp);
    gridEl.innerHTML = shelfHtml(list, (it) => coverDisplayUrl(app, it.appid, it.cover, it.coverSrc), { showRank, maxMin: maxPlaytime() });
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

/** 打开面板（挂壳 + 首渲 + 补海报与中文名）；已挂则跳过（toggle 关分支走 closePanel） */
export function openPanel(app: App): void {
  createUI(app);
  M.view = 'shelf'; // 面板默认落在游戏墙（统计是点右侧入口才进的一页）
  M.renderFn = () => renderAll(app);
  renderAll(app);
  void ensurePostersFor(app);
  ensureZhNames(app, M.items);
}

/** 关闭（toggle 语义的关分支）：DOM 摘除 + ESC 注销；状态保留（下次打开重建） */
export function closePanel(): void {
  unregisterPanelEsc(ESC_ID);
  maskEl?.remove();
  maskEl = null;
  popupEl = null;
  M.currentOverlay?.remove();
  M.currentOverlay = null;
  disposeSelects();
  heroEl = null;
  gridEl = null;
  lastReport = null;
  clearDetailCache();
  unloadZhNames();
}
