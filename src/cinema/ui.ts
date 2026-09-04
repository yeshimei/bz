/**
 * 影院（cinema）域 UI：试点收编组件库（铁律 6）
 * 桌面：左栏分类树（类型+状态+底部 AI 荐片/分析）＋ 右侧海报网格（观影日期倒序）
 * 移动：右上角 AI/分析/关闭 ＋ 搜索/添加 ＋ 分类横滑 ＋ 海报网格（3 列）
 * 交互：点海报 → 详情弹窗（无关闭按钮，编辑/删除在弹窗内）
 *       想看/在看 灰色小字 → 快速状态窗（升级+评分滑杆+影评）
 *       左栏分类对齐待办：类型/状态顶部均有「全部」；点组=筛组并展开其二级（手风琴互斥）；
 *       再点同组不取消（回全部靠「全部」）；点二级=筛该二级；再点同二级=回该组全部；点其他组/全部=收起二级
 *       搜索框上方主头行（标题=当前筛选名 + · N 部 + 添加按钮）；搜索框后排序 segmented（最近观看/按创建/按评分）
 *       AI 荐片：点入口切 AI 页（按需触发不自动请求），等待消息与结果列表就地渲染在页内（不弹窗）；
 *       结果页有「换一批」重跑（找同类按基准影片重跑），已入库推荐卡置「已在库中」禁用态
 *       海报卡：桌面右键/移动端长按出统一操作菜单（core/item-actions；打开详情/标记在看/标记已看/找同类/在豆瓣打开/编辑/删除）
 * 基线：按钮/图标钮/输入/空态/弹窗骨架走组件库（src/core/ui）；域内只留影院特有布局。
 * 图标：一律 lucide（emoji 已全换，字符串模板用 data-lucide 占位 → mountIcons 统一 setIcon）。
 */
import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { notice, notify, notifySaveError } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { topifyZ } from '../core/dom';
import { tryGetSettings } from '../core/settings-provider';
import { uiModal, uiIcon, uiSegmented, uiEmpty, uiBtn, uiBtnRow } from '../core/ui';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import {
  STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED, RATING_MAX, DEFAULT_RATING,
  GROUP_ORDER, GROUP_SUBS, TYPE_COLORS, STATUS_COLORS, ALL_TAGS, getGroupForTag,
} from './constants';
import { M, resetCinemaState, type CinemaItem, type CinemaState } from './state';
import { rebuildItems, getDisplayItems } from './data';
import { runAIRecommend, runSimilarRecommend, buildTasteProfile, quickAddWant } from './recommend';
import { buildAnalysisHTML } from './analysis';
import { watchPosterFetch } from './poster-watch';

// ---------- 小工具 ----------

/** lucide 图标名常量（均为 Obsidian setIcon 已注册名） */
const ICON = {
  ai: 'bot',
  stat: 'bar-chart-3',
  close: 'x',
  search: 'search',
  add: 'plus',
  edit: 'pencil',
  del: 'trash-2',
  empty: 'clapperboard',
  confirm: 'alert-circle',
  sort: 'arrow-up-down',
  refresh: 'refresh-cw',
  eye: 'eye',
  play: 'play',
  globe: 'globe',
  check: 'check',
  ext: 'external-link',
};

/** lucide 占位 HTML（innerHTML 拼接用；渲染后 mountIcons 统一 setIcon） */
function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]));
}

/** 相对日期（仿 core formatRelativeTime）：刚刚/N分钟前/N小时前/昨天/前天/周几/MM-DD/YYYY-MM-DD */
export function relDate(d: string | null, now: Date = new Date()): string {
  if (!d) return '未标注日期';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '未标注日期';
  const nowMs = now.getTime();
  const diffSeconds = Math.floor((nowMs - t) / 1000);
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  if (diffSeconds < 0) return fmt(new Date(t)); // 未来 → 原样日期
  if (diffSeconds < 60) return '刚刚';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const todayStart = startOfDay(now);
  const targetDay = startOfDay(new Date(t));
  const dayDiff = Math.round((todayStart - targetDay) / 86400000);
  if (dayDiff === 0) return `${Math.floor(diffMinutes / 60)}小时前`;
  if (dayDiff === 1) return '昨天';
  if (dayDiff === 2) return '前天';
  const day = now.getDay();
  const weekStart = todayStart - (day === 0 ? 6 : day - 1) * 86400000;
  if (targetDay >= weekStart && targetDay < todayStart) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(t).getDay()];
  }
  if (new Date(t).getFullYear() === now.getFullYear()) {
    return `${String(new Date(t).getMonth() + 1).padStart(2, '0')}-${String(new Date(t).getDate()).padStart(2, '0')}`;
  }
  return fmt(new Date(t));
}

/** 类型徽章色（数据语义功能色，域内直给） */
function groupColor(group: string): string {
  return TYPE_COLORS[group] ?? '#888';
}

/** 状态徽章色 */
function statusColor(status: number): string {
  return status === STATUS_WANT ? STATUS_COLORS['想看'] : status === STATUS_WATCHING ? STATUS_COLORS['在看'] : STATUS_COLORS['已看'];
}

function statusText(status: number): string {
  return status === STATUS_WANT ? '想看' : status === STATUS_WATCHING ? '在看' : '已看';
}

// ---------- 海报 ----------

/** 海报资源 URL（file 相对路径 → vault 资源路径）；无图返回 null */
function posterUrl(item: CinemaItem, app: App): string | null {
  if (!item.poster) return null;
  const f = app.vault.getAbstractFileByPath(item.poster);
  if (f && f instanceof TFile && /\.(png|jpe?g|gif|webp)$/i.test(f.name)) {
    return app.vault.getResourcePath(f);
  }
  return null;
}

/** 海报区块 HTML：有图出图（onerror 兜底），无图出占位 */
function posterBlock(item: CinemaItem, app: App, cls: string): string {
  const url = posterUrl(item, app);
  if (!url) return `<div class="bz-cinema-poster-blank ${cls}"></div>`;
  return `<div class="${cls}"><img src="${esc(url)}" alt="" loading="lazy" onerror="this.parentNode.innerHTML=''"></div>`;
}

// ---------- 图标挂载（data-lucide 占位 → setIcon） ----------

/** 容器内所有 data-lucide 占位替换为 setIcon 渲染的真图标（保持 class 修饰） */
function mountIcons(container: HTMLElement): void {
  container.querySelectorAll('i[data-lucide]').forEach((el) => {
    const name = el.getAttribute('data-lucide') || '';
    const cls = el.className;
    const fresh = uiIcon(name, '');
    if (cls && cls !== 'bz-ic') fresh.className = cls;
    el.replaceWith(fresh);
  });
}

// ---------- 渲染：左栏 ----------

function countBy(list: CinemaItem[], key: (it: CinemaItem) => string): Record<string, number> {
  const acc: Record<string, number> = {};
  list.forEach((it) => {
    const k = key(it);
    acc[k] = (acc[k] || 0) + 1;
  });
  return acc;
}

/** 当前标题名：全部 / 组名 / 二级名（主头行 + 头部一致性） */
export function currentTitle(): string {
  if (M.subFilter) return M.subFilter;
  if (M.typeFilter) return M.typeFilter;
  return '全部';
}

function renderNavHtml(app: App): string {
  const groupCounts = countBy(M.items, (it) => it.group);
  const subCounts = countBy(M.items, (it) => it.typeTag);
  const statusCounts = { 想看: 0, 在看: 0, 已看: 0 };
  M.items.forEach((it) => { statusCounts[statusText(it.status)]++; });

  let html = '<div class="bz-cinema-nav-label">类型</div>';
  html += `<button class="bz-cinema-nav-item${!M.typeFilter && !M.subFilter ? ' bz-cinema-nav-active' : ''}" data-cinema-type="all">
    <span class="bz-cinema-nav-cnt" style="margin-left:0;margin-right:auto">全部</span><span class="bz-cinema-nav-cnt">${M.items.length}</span></button>`;
  for (const g of GROUP_ORDER) {
    if (!groupCounts[g]) continue;
    const isOpen = !!M.expanded[g];
    // 组选中 = 筛该组；若正筛着该组某个二级，组名仍高亮（联动）
    const active = M.typeFilter === g;
    const groupActive = active && !M.subFilter;
    html += `<button class="bz-cinema-nav-item${groupActive ? ' bz-cinema-nav-active' : ''}" data-cinema-type="${g}">
      <span class="bz-cinema-nav-dot" style="background:${groupColor(g)}"></span>${g}<span class="bz-cinema-nav-cnt">${groupCounts[g]}</span></button>`;
    const hasSub = (GROUP_SUBS[g] || []).some((s) => subCounts[s]);
    if (hasSub) {
      // 展开态 = 当前组被选中（typeFilter 指向该组）或有子项被选中
      const expanded = active;
      html += `<div class="bz-cinema-nav-sub${expanded ? ' bz-cinema-nav-sub-open' : ''}">`;
      for (const s of GROUP_SUBS[g]) {
        if (!subCounts[s]) continue;
        html += `<button class="bz-cinema-nav-sub-item${M.subFilter === s ? ' bz-cinema-nav-active' : ''}" data-cinema-sub="${s}">${s}<span class="bz-cinema-nav-cnt">${subCounts[s]}</span></button>`;
      }
      html += '</div>';
    }
  }
  html += '<div class="bz-cinema-nav-label">状态</div>';
  html += `<button class="bz-cinema-nav-item${!M.statusFilter ? ' bz-cinema-nav-active' : ''}" data-cinema-status="all">
    <span class="bz-cinema-nav-cnt" style="margin-left:0;margin-right:auto">全部</span><span class="bz-cinema-nav-cnt">${M.items.length}</span></button>`;
  (['想看', '在看', '已看'] as const).forEach((s) => {
    const active = M.statusFilter === s;
    html += `<button class="bz-cinema-nav-item${active ? ' bz-cinema-nav-active' : ''}" data-cinema-status="${s}">
      <span class="bz-cinema-nav-dot" style="background:${STATUS_COLORS[s]}"></span>${s}<span class="bz-cinema-nav-cnt">${statusCounts[s]}</span></button>`;
  });
  html += '<div class="bz-cinema-nav-tools">';
  html += `<button class="bz-cinema-nav-tool${M.view === 'ai' ? ' bz-cinema-nav-active' : ''}" data-cinema-tool="ai"><span class="bz-cinema-tool-ic">${iconSpan(ICON.ai)}</span>AI 荐片</button>`;
  html += `<button class="bz-cinema-nav-tool${M.view === 'stat' ? ' bz-cinema-nav-active' : ''}" data-cinema-tool="stat"><span class="bz-cinema-tool-ic">${iconSpan(ICON.stat)}</span>影视分析</button>`;
  html += '</div>';
  return html;
}

/** 主头行：当前筛选名 + “· N 部” + 右侧添加按钮（对齐待办主头行） */
function renderMainHeadHtml(app: App): string {
  const visible = getDisplayItems();
  return `<div class="bz-cinema-main-head">
    <div class="bz-cinema-main-title" data-cinema-main-title>${esc(currentTitle())}</div>
    <div class="bz-cinema-main-count" data-cinema-main-count>· ${visible.length} 部</div>
    <div class="bz-cinema-main-spacer"></div>
    <button class="bz-btn bz-btn--primary bz-cinema-add" data-cinema-add>${iconSpan(ICON.add, 'bz-ic--sm')} 添加影视</button>
  </div>`;
}

// ---------- 渲染：海报网格 ----------

/** CM3：按稳定键回查条目（与 pcardHtml 的 data 属性一致：file.path，未落盘用 new:name） */
function cinemaItemByKey(key: string | undefined): CinemaItem | undefined {
  if (!key) return undefined;
  return M.items.find((it) => (it.file?.path ?? `new:${it.name}`) === key);
}

// ---------- 海报卡统一操作（右键菜单/长按抽屉，复用 core/item-actions；先例 clipbook） ----------

/** 豆瓣搜索页 URL（无豆瓣链接条目的直达兜底） */
export function doubanSearchUrl(name: string): string {
  return 'https://movie.douban.com/search?q=' + encodeURIComponent(name);
}

/** 在豆瓣打开：有豆瓣链接走链接，否则走片名搜索页（新窗） */
function openDouban(item: CinemaItem): void {
  const url = item.doubanUrl || doubanSearchUrl(item.name);
  try {
    window.open(url, '_blank');
  } catch {
    /* jsdom 未实现 window.open：忽略 */
  }
}

/** 快速标记状态（右键菜单「标记在看/已看」）：与快速状态窗同一套语义（评分映射 + CM1 观影日期 + 事件补发） */
async function markStatus(item: CinemaItem, target: '在看' | '已看', app: App): Promise<void> {
  const fromSt = item.status === STATUS_WANT ? 'want' : item.status === STATUS_WATCHING ? 'watching' : 'watched';
  const prevRating = item.rating && item.rating > 0 ? item.rating : null;
  item.status = target === '已看' ? STATUS_WATCHED : STATUS_WATCHING;
  if (target === '在看') {
    item.rating = 0;
  } else {
    if (!prevRating) item.rating = DEFAULT_RATING;
    // CM1：流转为「已看」时刷新观影日期（统计口径按看完时间）
    item.watchDate = localNow();
  }
  try {
    await persistItem(item, app);
    notice(`已标记${target}`, 'success');
    const toSt = target === '已看' ? 'watched' : 'watching';
    if (toSt !== fromSt) emitDomainEvent('movie', { kind: 'status', name: item.name, from: fromSt, to: toSt });
    if (item.rating !== null && item.rating > 0 && item.rating !== prevRating) {
      emitDomainEvent('movie', { kind: 'rated', name: item.name, fromRating: prevRating, toRating: item.rating });
    }
    renderAll(app);
  } catch (e) {
    notifySaveError(e);
    console.error(e);
    renderAll(app);
  }
}

/** 海报卡动作列表（顺序即菜单/抽屉显示顺序；删除类 danger 自接确认框） */
function cinemaItemActions(item: CinemaItem, app: App): ItemAction[] {
  const out: ItemAction[] = [{ icon: 'eye', label: '打开详情', title: '打开详情弹窗', onClick: () => openDetail(item, app) }];
  if (item.status !== STATUS_WATCHING && item.status !== STATUS_WATCHED) {
    out.push({ icon: 'play', label: '标记在看', title: '标记为在看', onClick: () => void markStatus(item, '在看', app) });
  }
  if (item.status !== STATUS_WATCHED) {
    out.push({ icon: 'check', label: '标记已看', title: '标记为已看', onClick: () => void markStatus(item, '已看', app) });
  }
  out.push(
    { icon: ICON.ai, label: '找同类', title: 'AI 找同类影片', onClick: () => void runSimilarRecommend(item, app) },
    { icon: 'globe', label: '在豆瓣打开', title: '打开豆瓣页面', onClick: () => openDouban(item) },
    { icon: 'pencil', label: '编辑', title: '编辑影视', onClick: () => openEditForm(item, app) },
    { icon: 'trash-2', label: '删除', kind: 'danger', title: '删除影视', onClick: () => openDeleteConfirm(item, app) },
  );
  return out;
}

/** 移动端抽屉头部（条目名 + 类型/状态/日期 meta，参照网易云底部页） */
function buildCinemaSheetHead(item: CinemaItem): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-cinema-sheet-head';
  const t = document.createElement('div');
  t.className = 'bz-cinema-sheet-title';
  t.textContent = item.name;
  const s = document.createElement('div');
  s.className = 'bz-cinema-sheet-sub';
  s.textContent = `${item.typeTag} · ${statusText(item.status)} · ${relDate(item.watchDate)}`;
  head.appendChild(t);
  head.appendChild(s);
  return head;
}

/** 给海报卡挂统一操作（桌面右键菜单 / 移动端长按抽屉；卡片每次重渲染重建，无重复挂载） */
function bindPosterActions(container: HTMLElement, app: App): void {
  container.querySelectorAll<HTMLElement>('[data-cinema-idx]').forEach((card) => {
    const item = cinemaItemByKey(card.dataset.cinemaIdx);
    if (!item) return;
    attachItemActions(card, cinemaItemActions(item, app), { sheetHead: buildCinemaSheetHead(item) });
  });
}

function pcardHtml(item: CinemaItem, app: App): string {
  const badge = item.status !== STATUS_WATCHED
    ? `<span class="bz-cinema-p-badge" style="background:${statusColor(item.status)}">${statusText(item.status)}</span>` : '';
  const upgradeable = item.status !== STATUS_WATCHED;
  // CM3：卡片用稳定键（file.path；未落盘新增用 name）而非数组下标——异步刷新重排后下标会指错条目
  const key = esc(item.file?.path ?? `new:${item.name}`);
  // 灰色小字：想看/在看 = 可点状态 + 相对日期；已看 = 星星（无数字）+ 相对日期
  let metaInner = esc(relDate(item.watchDate));
  if (item.status === STATUS_WANT || item.status === STATUS_WATCHING) {
    metaInner = `<span class="bz-cinema-st-label" data-cinema-upgrade="${key}">${statusText(item.status)}</span> · ${metaInner}`;
  } else if (item.rating && item.rating > 0) {
    metaInner = `<span class="bz-cinema-p-stars">${stars(item.rating)}</span> · ${metaInner}`;
  }
  return `<div class="bz-cinema-pcard" data-cinema-idx="${key}">
    ${posterBlock(item, app, 'bz-cinema-poster-wrap')}${badge}
    <div class="bz-cinema-p-name">${esc(item.name)}</div>
    <div class="bz-cinema-p-meta${upgradeable ? ' bz-cinema-p-meta-up' : ''}">${metaInner}</div></div>`;
}

/** 星星串（5 星轨道，黄色）——星级为分数语义展示，保留文本 ★☆（非图标用途） */
function stars(rating: number): string {
  if (!rating || rating <= 0) return '';
  const st = Math.min(Math.round((rating / 2) * 2) / 2, 5);
  const full = Math.floor(st);
  let s = '';
  for (let i = 0; i < full; i++) s += '★';
  for (let j = full; j < 5; j++) s += '☆';
  return s;
}

function renderListHtml(app: App): string {
  const list = getDisplayItems();
  return `<div class="bz-cinema-grid">${list.map((it) => pcardHtml(it, app)).join('')}</div>`;
}

/**
 * 列表空态两种（增强包需求 2）：
 * - 库为空（M.items.length === 0）→ 引导添加（uiEmpty + 「添加第一部影视」）；
 * - 筛选/搜索无结果 → 「清空筛选」按钮一键回全部。
 * 空态指路文案统一用「影院」术语。
 */
function buildListEmpty(app: App): HTMLDivElement {
  const libEmpty = M.items.length === 0;
  let btn: HTMLElement;
  if (libEmpty) {
    btn = uiBtn({ label: '添加第一部影视', tone: 'primary', className: 'bz-cinema-empty-add', onClick: () => openEditForm(null, app) });
    return uiEmpty({
      icon: ICON.empty,
      title: '还没有收藏的影视',
      desc: '在影院添加你的第一部影视，观影足迹从这里开始',
      actions: uiBtnRow([btn], { center: true }),
    });
  }
  btn = uiBtn({ label: '清空筛选', tone: 'primary', className: 'bz-cinema-empty-clear', onClick: () => {
    M.typeFilter = null;
    M.subFilter = null;
    M.statusFilter = null;
    M.searchKeyword = '';
    const input = M.currentOverlay?.querySelector('[data-cinema-search]') as HTMLInputElement | null;
    if (input) input.value = '';
    renderAll(app);
  } });
  return uiEmpty({
    icon: ICON.search,
    title: '没有符合条件的影视',
    desc: '当前筛选或搜索没有命中，试试清空',
    actions: uiBtnRow([btn], { center: true }),
  });
}

// ---------- 渲染：AI 荐片 / 分析页 ----------

/**
 * AI 页内渲染：待机 = 引导；运行中 = 等待消息；完成/失败 = 结果列表或错误。
 * 全程不弹窗（用户拍板：等待消息与结果都在页面内显示）。
 */
function renderAiPageHtml(app: App): string {
  if (M.aiRunning) {
    return `<div class="bz-cinema-page"><div class="bz-cinema-page-head"><span class="bz-cinema-page-title">${iconSpan(ICON.ai)}${esc(M.aiTitle)}</span></div>
      <div class="bz-cinema-ai-wait">
        <div class="bz-cinema-ai-spin"><span class="bz-spinner bz-spinner--lg"></span></div>
        <span class="bz-cinema-ai-guide-ic">${iconSpan(ICON.ai)}</span>
        <div class="bz-cinema-ai-guide-title">${esc(M.aiWaitMsg || 'AI 正在分析你的观影口味…')}</div>
        <div class="bz-cinema-ai-guide-sub">正在生成推荐，请稍候</div>
      </div></div>`;
  }
  if (M.aiError) {
    return `<div class="bz-cinema-page"><div class="bz-cinema-page-head"><span class="bz-cinema-page-title">${iconSpan(ICON.ai)}${esc(M.aiTitle)}</span></div>
      <div class="bz-cinema-ai-wait">
        <span class="bz-cinema-ai-guide-ic bz-cinema-ai-err">${iconSpan(ICON.ai)}</span>
        <div class="bz-cinema-ai-guide-title">AI 分析失败</div>
        <div class="bz-cinema-ai-guide-sub">${esc(M.aiError)}</div>
        <button class="bz-btn bz-btn--primary bz-cinema-ai-start" data-cinema-ai-start style="margin-top:16px;">重试</button>
      </div></div>`;
  }
  if (M.aiResult && M.aiResult.length > 0) {
    return renderAIResultList(app);
  }
  // 待机：引导页
  const profile = buildTasteProfile();
  let html = `<div class="bz-cinema-page"><div class="bz-cinema-page-head"><span class="bz-cinema-page-title">${iconSpan(ICON.ai)}${esc(M.aiTitle)}</span><span class="bz-cinema-page-sub">基于 ${profile.total} 部已看影视的口味画像</span></div>`;
  html += '<div class="bz-cinema-page-sub" style="margin-bottom:12px;">偏好：' + (profile.groups[0] || '暂无') + ' · ' + (profile.genres[0] || '—') + ' · ' + (profile.directors[0] || '—') + ' · ' + (profile.actors[0] || '—') + '</div>';
  html += '<div class="bz-cinema-ai-guide">';
  html += `<span class="bz-cinema-ai-guide-ic">${iconSpan(ICON.ai)}</span>`;
  html += '<div class="bz-cinema-ai-guide-title">AI 正在分析你的观影口味</div>';
  html += '<div class="bz-cinema-ai-guide-sub">点击下方按钮，AI 将基于你的 ' + profile.total + ' 部观影历史推荐 5 部影视</div>';
  html += '<button class="bz-btn bz-btn--primary bz-cinema-ai-start" data-cinema-ai-start>开始 AI 荐片</button>';
  html += '</div></div>';
  return html;
}

/** AI 结果页内列表（卡片+加入想看），替代原 showResultWindow 弹窗。
 *  反馈闭环（增强包需求 3）：头部「换一批」；已入库推荐卡按钮置「已在库中」禁用态；片名旁豆瓣外链小图标。 */
function renderAIResultList(app: App): string {
  const head = `<div class="bz-cinema-page-head"><span class="bz-cinema-page-title">${iconSpan(ICON.ai)}${esc(M.aiTitle)}</span><span class="bz-cinema-page-sub">为你推荐</span><button class="bz-btn bz-btn--ghost bz-btn--sm bz-cinema-ai-refresh" data-cinema-ai-refresh title="重新生成一批推荐">${iconSpan(ICON.refresh, 'bz-ic--sm')}换一批</button></div>`;
  const cards = (M.aiResult || []).map((rec, i) => {
    const name = rec?.title || rec?.name || '未命名';
    const year = rec?.year ? `（${rec.year}）` : '';
    const meta = [rec?.type, rec?.director].filter(Boolean).join(' · ');
    const reason = rec?.reason || '';
    const inLib = M.items.some((it) => it.name === name);
    const action = inLib
      ? `<button class="bz-btn bz-btn--sm bz-cinema-rec-inlib" data-rec-inlib disabled title="已在库中">${iconSpan(ICON.check, 'bz-ic--sm')}已在库中</button>`
      : `<button class="bz-icon-btn bz-icon-btn--accent bz-cinema-rec-add" data-rec-add="${i}" title="加入想看">${iconSpan(ICON.add)}</button>`;
    return `<div class="bz-cinema-rec-card${inLib ? ' bz-cinema-rec-card--inlib' : ''}" data-rec-idx="${i}">
      <div class="bz-cinema-rec-main">
        <div class="bz-cinema-rec-name">《${esc(name)}》${esc(year)}<a class="bz-cinema-rec-douban" href="${esc(doubanSearchUrl(name))}" target="_blank" rel="noopener" title="在豆瓣搜索「${esc(name)}」">${iconSpan(ICON.ext, 'bz-ic--xs')}</a></div>
        ${meta ? `<div class="bz-cinema-rec-meta">${esc(meta)}</div>` : ''}
        ${reason ? `<div class="bz-cinema-rec-reason">${esc(reason)}</div>` : ''}
      </div>
      ${action}
    </div>`;
  }).join('');
  return `<div class="bz-cinema-page">${head}<div class="bz-cinema-rec-list">${cards}</div></div>`;
}

function renderStatPageHtml(): string {
  return `<div class="bz-cinema-page"><div class="bz-cinema-page-head"><span class="bz-cinema-page-title">${iconSpan(ICON.stat)}影视分析</span></div>${buildAnalysisHTML()}</div>`;
}

function renderContent(app: App): void {
  const content = M.currentOverlay?.querySelector('.bz-cinema-content') as HTMLElement | null;
  if (!content) return;
  if (M.view === 'ai') content.innerHTML = renderAiPageHtml(app);
  else if (M.view === 'stat') content.innerHTML = renderStatPageHtml();
  else {
    const list = getDisplayItems();
    if (!list.length) {
      content.innerHTML = '';
      content.appendChild(buildListEmpty(app));
    } else {
      content.innerHTML = renderListHtml(app);
      bindPosterActions(content, app);
    }
  }
  mountIcons(content);
}

export function renderAll(app: App): void {
  const nav = M.currentOverlay?.querySelector('.bz-cinema-nav') as HTMLElement | null;
  if (nav) {
    nav.innerHTML = renderNavHtml(app);
    mountIcons(nav);
  }
  const mobNav = M.currentOverlay?.querySelector('.bz-cinema-mob-nav') as HTMLElement | null;
  if (mobNav) mobNav.innerHTML = renderMobNavHtml();
  const mainHead = M.currentOverlay?.querySelector('.bz-cinema-main-head') as HTMLElement | null;
  if (mainHead) {
    mainHead.outerHTML = renderMainHeadHtml(app);
    const freshHead = M.currentOverlay?.querySelector('.bz-cinema-main-head') as HTMLElement | null;
    if (freshHead) mountIcons(freshHead);
  }
  renderContent(app);
}

/** 移动端分类横滑条（类型 + 状态，顶部「全部」chip；点击筛选单选切换） */
function renderMobNavHtml(): string {
  const groupCounts = countBy(M.items, (it) => it.group);
  const statusCounts = { 想看: 0, 在看: 0, 已看: 0 };
  M.items.forEach((it) => { statusCounts[statusText(it.status)]++; });
  let html = '';
  html += `<span class="bz-cinema-mob-chip${!M.typeFilter && !M.subFilter ? ' bz-cinema-mob-chip-active' : ''}" data-cinema-mob data-cinema-type="all">全部</span>`;
  for (const g of GROUP_ORDER) {
    if (!groupCounts[g]) continue;
    // 类型 chip 选中 = 筛该组（或组内二级）
    html += `<span class="bz-cinema-mob-chip${M.typeFilter === g ? ' bz-cinema-mob-chip-active' : ''}" data-cinema-mob data-cinema-type="${g}">${g}</span>`;
  }
  html += `<span class="bz-cinema-mob-chip${!M.statusFilter ? ' bz-cinema-mob-chip-active' : ''}" data-cinema-mob data-cinema-status="all">状态全部</span>`;
  (['想看', '在看', '已看'] as const).forEach((s) => {
    html += `<span class="bz-cinema-mob-chip${M.statusFilter === s ? ' bz-cinema-mob-chip-active' : ''}" data-cinema-mob data-cinema-status="${s}">${s}</span>`;
  });
  return html;
}

// ---------- 弹窗基础设施（组件库 uiModal：ESC/遮罩已统一） ----------

/** 通用弹窗（遮罩 + 内容容器），返回 uiModal 句柄 */
function openModal(contentHtml: string, maxWidth = 400): ReturnType<typeof uiModal> {
  return uiModal({ content: contentHtml, maxWidth });
}

/** 平铺单选组（.bz-choice）：按钮带 data-value，点按钮切 .is-on；返回当前值读函数 */
function bindChoice(scope: HTMLElement, btnSel: string): () => string {
  const btns = Array.from(scope.querySelectorAll<HTMLElement>(btnSel));
  let value = btns.find((b) => b.classList.contains('is-on'))?.dataset.value ?? '';
  btns.forEach((b) => {
    b.addEventListener('click', () => {
      value = b.dataset.value ?? value;
      btns.forEach((x) => x.classList.toggle('is-on', x === b));
    });
  });
  return () => value;
}

// ---------- 详情弹窗（无关闭按钮；编辑/删除在弹窗内） ----------

function openDetail(item: CinemaItem, app: App): void {
  const html = `<div class="bz-cinema-dm-head">${posterBlock(item, app, 'bz-cinema-dm-poster')}
    <div><div class="bz-cinema-dm-title">${esc(item.name)}</div>
    <div class="bz-cinema-dm-badges">
      <span class="bz-chip bz-chip--tint" style="--bz-chip-tint:${groupColor(item.group)};--bz-chip-tint-fg:var(--bz-on-overlay)">${esc(item.typeTag)}</span>
      ${item.status !== STATUS_WATCHED ? `<span class="bz-chip bz-chip--tint" style="--bz-chip-tint:${statusColor(item.status)};--bz-chip-tint-fg:var(--bz-on-overlay)">${statusText(item.status)}</span>` : ''}
      ${item.rating && item.rating > 0 ? `<span class="bz-cinema-dm-stars">${stars(item.rating)}</span><span class="bz-cinema-dm-rating">${Number(item.rating).toFixed(1)}</span>` : ''}
      ${item.watchDate ? `<span class="bz-cinema-dm-date">${esc(relDate(item.watchDate))}</span>` : ''}
    </div>
    ${item.review ? `<div class="bz-cinema-dm-review">${esc(item.review)}</div>` : ''}
    </div></div>`;
  const rows: [string, string][] = ([
    ['类型', item.genre ?? ''],
    ['导演', item.director ?? ''],
    ['主演', item.actors ?? ''],
    ['制片国家/地区', item.region ?? ''],
    ['上映日期', item.year ?? ''],
    ['豆瓣评分', item.doubanRating ?? ''],
  ] as [string, string][]).filter(([, v]) => v !== '');
  let body = html;
  if (rows.length) {
    body += '<div class="bz-cinema-sec-title">豆瓣信息</div>';
    rows.forEach(([k, v]) => { body += `<div class="bz-cinema-kv"><span class="bz-cinema-kv-k">${k}</span><span class="bz-cinema-kv-v">${esc(v)}</span></div>`; });
  }
  // 豆瓣直达（增强包需求 6）：链接行附「豆瓣页面」外链按钮
  if (item.doubanUrl) body += `<div class="bz-cinema-kv"><span class="bz-cinema-kv-k">豆瓣链接</span><span class="bz-cinema-kv-v"><a href="${esc(item.doubanUrl)}" target="_blank" rel="noopener">${esc(item.doubanUrl)}</a><a class="bz-btn bz-btn--ghost bz-btn--sm bz-cinema-dm-douban" href="${esc(item.doubanUrl)}" target="_blank" rel="noopener">${iconSpan(ICON.ext, 'bz-ic--xs')}豆瓣页面</a></span></div>`;
  if (item.synopsis) body += `<div class="bz-cinema-sec-title">简介</div><div class="bz-cinema-synopsis">${esc(item.synopsis)}</div>`;
  body += `<div class="bz-cinema-form-actions"><button class="bz-btn bz-btn--ghost" data-cinema-dm-similar>${iconSpan(ICON.ai, 'bz-ic--sm')}找同类</button><button class="bz-btn bz-btn--ghost" data-cinema-dm-edit>${iconSpan(ICON.edit, 'bz-ic--sm')}编辑</button><button class="bz-btn bz-btn--danger" data-cinema-dm-del>${iconSpan(ICON.del, 'bz-ic--sm')}删除</button></div>`;
  const { popup, close } = uiModal({ content: body, maxWidth: 400, className: 'bz-cinema-dm' });
  mountIcons(popup);
  popup.querySelector('[data-cinema-dm-similar]')?.addEventListener('click', () => {
    close();
    void runSimilarRecommend(item, app);
  });
  popup.querySelector('[data-cinema-dm-edit]')?.addEventListener('click', () => {
    close();
    openEditForm(item, app);
  });
  popup.querySelector('[data-cinema-dm-del]')?.addEventListener('click', () => {
    close();
    openDeleteConfirm(item, app);
  });
}

// ---------- 添加 / 编辑（评分滑杆） ----------

/** 本地时间 YYYY-MM-DD HH:mm:ss（写笔记用） */
function localNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 本地日期 YYYY-MM-DD（观影日期字段的默认值：今天） */
function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 文件名非法字符（Windows 保留集；名称源自文件名《X》，改名前拦截） */
const ILLEGAL_NAME_RE = /[\\/:*?"<>|]/;

/**
 * 把条目落盘：新增建笔记（movie 域同格式），编辑/快速状态写 frontmatter（保留海报/豆瓣字段）。
 * 编辑分支（P1 修复）：名称源自文件名《X》→ 改名走 fileManager.renameFile（Obsidian 内建，
 * 自动更新全库双链）；类型写入 frontmatter tags（替换旧类型 tag 项、保留其他 tag）。
 * @param edit 编辑态信息（prevName=改名前的名称 / prevTag=改类型前的 tag；快速状态窗不传）
 */
async function persistItem(item: CinemaItem, app: App, edit?: { prevName: string; prevTag: string }): Promise<void> {
  if (!item.file) {
    // 新增：创建《名称》.md（与 movie 域文件格式一致；海报/豆瓣字段由外部工具补）
    const folder = M.folderPath;
    if (!app.vault.getAbstractFileByPath(folder)) {
      await app.vault.createFolder(folder);
    }
    const filePath = `${folder}/《${item.name}》.md`;
    const content = `---\ntags:\n- ${item.typeTag}\n观影日期: ${item.watchDate || localNow()}\n评分: ${item.rating ?? 0}\n${item.review ? `影评: ${item.review}\n` : ''}海报: \n---\n`;
    const f = await app.vault.create(filePath, content);
    item.file = f;
    return;
  }
  // 编辑改名：文件重命名（重名/非法字符已在保存入口前置拦截；此处失败走统一「保存失败」）
  if (edit && item.name !== edit.prevName) {
    const newPath = `${M.folderPath}/《${item.name}》.md`;
    if (newPath !== item.file.path) {
      await app.fileManager.renameFile(item.file, newPath);
      item.file = (app.vault.getAbstractFileByPath(newPath) as CinemaItem['file']) || item.file;
    }
  }
  // 编辑/快速状态：写 frontmatter（不动海报/豆瓣等字段）
  await app.fileManager.processFrontMatter(item.file, (fm: Record<string, unknown>) => {
    fm['评分'] = item.rating ?? 0;
    fm['观影日期'] = item.watchDate || localNow();
    if (item.review) fm['影评'] = item.review;
    else delete fm['影评'];
    // 类型 → tags：编辑态替换旧类型 tag 项（保留其他 tag）；无 tags 键则新建
    if (edit) {
      const tags = Array.isArray(fm['tags'])
        ? (fm['tags'] as unknown[]).map((t) => String(t))
        : typeof fm['tags'] === 'string' && fm['tags']
          ? [fm['tags'] as string]
          : [];
      const at = tags.indexOf(edit.prevTag);
      if (at >= 0) tags[at] = item.typeTag;
      else if (!tags.includes(item.typeTag)) tags.unshift(item.typeTag);
      fm['tags'] = tags;
    }
  });
}

/** 打开添加弹窗（命令 bz-cinema-add 直达；未开主面板则先建） */
export function openAddModalDirect(app: App): void {
  if (!M.currentOverlay) createOverlay(app);
  openEditForm(null, app);
}

/** 平铺单选按钮组 HTML（组件库 .bz-choice；initial 不在选项时默认第一项） */
function choiceGroupHtml(opts: { values: string[]; initial: string; attr: string; dots?: Record<string, string> }): string {
  const fallback = !opts.values.includes(opts.initial) ? opts.values[0] : '';
  return opts.values.map((v) => {
    const on = v === opts.initial || v === fallback ? ' is-on' : '';
    const dot = opts.dots?.[v] ? `<span class="bz-choice-dot" style="background:${opts.dots[v]}"></span>` : '';
    return `<button type="button" class="bz-choice-btn${on}" data-${opts.attr} data-value="${v}">${dot}${v}</button>`;
  }).join('');
}

function openEditForm(item: CinemaItem | null, app: App): void {
  const editing = !!item;
  const ratingVal = item && item.rating && item.rating > 0 ? item.rating : DEFAULT_RATING;
  const initTag = item ? item.typeTag : ALL_TAGS[0];
  const initStatus = item ? statusText(item.status) : '已看';
  // 观影日期（增强包需求 8）：补录已看可指定；默认今天；编辑回填原日期的日期部分
  const initDate = editing && item?.watchDate ? item.watchDate.slice(0, 10) : localToday();
  const html = `<div class="bz-cinema-form-title">${editing ? '编辑影视' : '添加影视'}</div>
    <div class="bz-cinema-form">
      <div class="bz-field"><span class="bz-field-label">名称</span><input class="bz-input" id="bz-cinema-f-name" value="${item ? esc(item.name) : ''}" placeholder="影视名称"></div>
      <div class="bz-field"><span class="bz-field-label">类型</span><span class="bz-choice">${choiceGroupHtml({ values: ALL_TAGS, initial: initTag, attr: 'cinema-f-tag' })}</span></div>
      <div class="bz-field"><span class="bz-field-label">状态</span><span class="bz-choice">${choiceGroupHtml({ values: ['想看', '在看', '已看'], initial: initStatus, attr: 'cinema-f-status' })}</span></div>
      <div class="bz-field" id="bz-cinema-f-date-field"><span class="bz-field-label">观影日期</span><input type="date" class="bz-input" id="bz-cinema-f-date" value="${esc(initDate)}"></div>
      <div class="bz-field" id="bz-cinema-f-rating-field"><span class="bz-field-label">评分（已看）</span><span class="bz-cinema-rating-row"><input type="range" class="bz-range" id="bz-cinema-f-rating" min="1" max="${RATING_MAX}" step="0.1" value="${ratingVal}"><span class="bz-cinema-rating-val" id="bz-cinema-f-rating-val">${Number(ratingVal).toFixed(1)}</span></span></div>
      <div class="bz-field" id="bz-cinema-f-review-field"><span class="bz-field-label">影评</span><textarea class="bz-input" id="bz-cinema-f-review" placeholder="写点什么…">${item ? esc(item.review ?? '') : ''}</textarea></div>
    </div>
    <div class="bz-cinema-form-actions"><button class="bz-btn bz-btn--primary" id="bz-cinema-f-save">${editing ? '保存' : '添加'}</button></div>`;
  const { popup, close } = uiModal({ content: html, maxWidth: 400, className: 'bz-cinema-dm' });
  const getTag = bindChoice(popup, '[data-cinema-f-tag]');
  const getStatus = bindChoice(popup, '[data-cinema-f-status]');
  const ratingInput = popup.querySelector('#bz-cinema-f-rating') as HTMLInputElement;
  const ratingValEl = popup.querySelector('#bz-cinema-f-rating-val') as HTMLElement;
  ratingInput.addEventListener('input', () => { ratingValEl.textContent = Number(ratingInput.value).toFixed(1); });
  // 需求：想看/在看 不显示观影日期/评分/影评（仅「已看」显示——观影日期只对已看有统计意义）
  const dateField = popup.querySelector('#bz-cinema-f-date-field') as HTMLElement;
  const ratingField = popup.querySelector('#bz-cinema-f-rating-field') as HTMLElement;
  const reviewField = popup.querySelector('#bz-cinema-f-review-field') as HTMLElement;
  const syncFieldsByStatus = (status: string): void => {
    const show = status === '已看';
    dateField.style.display = show ? '' : 'none';
    ratingField.style.display = show ? '' : 'none';
    reviewField.style.display = show ? '' : 'none';
  };
  popup.querySelectorAll('[data-cinema-f-status]').forEach((b) => {
    b.addEventListener('click', () => syncFieldsByStatus((b as HTMLElement).dataset.value ?? '已看'));
  });
  syncFieldsByStatus(initStatus);
  popup.querySelector('#bz-cinema-f-save')?.addEventListener('click', () => {
    const name = (popup.querySelector('#bz-cinema-f-name') as HTMLInputElement).value.trim();
    if (!name) { notice('请输入名称'); return; }
    const tag = getTag() || ALL_TAGS[0];
    const status = getStatus() || '已看';
    const rating = parseFloat(ratingInput.value);
    // 观影日期（增强包需求 8）：已看可指定（默认今天）；编辑未改日期时保留原值（含时间部分，避免无谓改写格式）
    const dateInput = popup.querySelector('#bz-cinema-f-date') as HTMLInputElement;
    const pickedDate = dateInput.value;
    const date = editing && item
      ? (pickedDate
        ? (item.watchDate && item.watchDate.slice(0, 10) === pickedDate ? item.watchDate : pickedDate)
        : (item.watchDate || localNow()))
      : (pickedDate ? pickedDate : localNow());
    // 需求：非已看状态不保存影评
    const review = status === '已看' ? (popup.querySelector('#bz-cinema-f-review') as HTMLTextAreaElement).value.trim() : '';
    const group = getGroupForTag(tag) ?? '其他';
    const mapped = status === '已看' ? rating : status === '想看' ? -1 : 0;
    const st = status === '想看' ? STATUS_WANT : status === '在看' ? STATUS_WATCHING : STATUS_WATCHED;
    void (async () => {
      let newItem: CinemaItem | null = null; // CM2：新增落盘失败时回退用
      // 编辑改名前置校验（重名/非法字符拦截；名称源自文件名《X》）
      if (editing && item && name !== item.name) {
        if (ILLEGAL_NAME_RE.test(name)) {
          notice('名称含非法字符（\\ / : * ? " < > |），请修改', 'error');
          return;
        }
        if (app.vault.getAbstractFileByPath(`${M.folderPath}/《${name}》.md`)) {
          notice('已存在同名影视，请换个名称');
          return;
        }
      }
      const prev = editing && item ? { name: item.name, typeTag: item.typeTag, group: item.group, status: item.status, rating: item.rating, watchDate: item.watchDate, review: item.review } : null;
      try {
        if (editing && item) {
          item.name = name; item.typeTag = tag; item.group = group;
          item.status = st; item.rating = mapped; item.watchDate = date; item.review = review;
          await persistItem(item, app, { prevName: prev!.name, prevTag: prev!.typeTag });
          // 编辑表单对齐旧 movie 语义：不发域事件（smartcat 观察只覆盖新增/快速状态/删除）
        } else {
          // CM2：同笔记名已存在时 vault.create 会抛错，提前拦截提示
          if (app.vault.getAbstractFileByPath(`${M.folderPath}/《${name}》.md`)) {
            notice('已存在同名影视，请换个名称');
            return;
          }
          const it: CinemaItem = { file: null, name, typeTag: tag, group, status: st, rating: mapped, watchDate: date, review, poster: null, genre: null, director: null, actors: null, region: null, year: null, doubanRating: null, doubanUrl: null, synopsis: null };
          newItem = it;
          M.items.unshift(it);
          await persistItem(it, app);
          // 新增：发 movie 域事件（smartcat 行为流观察；ADR-0087 cinema 接管）
          emitDomainEvent('movie', {
            kind: 'created',
            name,
            status: st === STATUS_WANT ? 'want' : st === STATUS_WATCHING ? 'watching' : 'watched',
            rating: mapped,
            review: review || null,
          });
          // 新增：poster 占位 → progress 通知轮询等外部 watcher 写入海报后收尾（vault modify 自动刷新链会替换占位图）
          if (it.file) {
            const handle = notify('正在获取海报和豆瓣信息…', { type: 'progress' });
            watchPosterFetch(app, it.file, handle);
          }
        }
        close();
        notice(editing ? '已保存' : '已添加', 'success');
        renderAll(app);
      } catch (e) {
        // CM2：新增落盘失败回退内存条目，避免 file:null 幽灵卡；编辑失败回滚内存（磁盘未动，300ms 重建不会弹回）
        if (newItem && !newItem.file) {
          const i = M.items.indexOf(newItem);
          if (i >= 0) M.items.splice(i, 1);
          renderAll(app);
        } else if (editing && item && prev) {
          Object.assign(item, prev);
        }
        notifySaveError(e);
        console.error(e);
      }
    })();
  });
}

// ---------- 删除确认（增强包需求 5：回收站语义；三段式：标题 + 问句「」引号 + 后果说明） ----------

function openDeleteConfirm(item: CinemaItem, app: App): void {
  const html = `<div class="bz-cinema-confirm">
    <span class="bz-cinema-confirm-ic">${iconSpan(ICON.confirm)}</span>
    <div class="bz-cinema-confirm-title">删除影视</div>
    <p>确定删除「${esc(item.name)}」吗？</p>
    <div class="bz-cinema-confirm-sub">将移入系统回收站，可在回收站恢复</div>
    <div class="bz-btn-row bz-btn-row--center" style="margin-top:16px;">
      <button class="bz-btn bz-btn--ghost" id="bz-cinema-d-cancel">取消</button>
      <button class="bz-btn bz-btn--danger" id="bz-cinema-d-del">删除</button>
    </div></div>`;
  const { popup, close } = uiModal({ content: html, maxWidth: 320, className: 'bz-cinema-dm' });
  mountIcons(popup);
  popup.querySelector('#bz-cinema-d-cancel')?.addEventListener('click', () => close());
  popup.querySelector('#bz-cinema-d-del')?.addEventListener('click', async () => {
    if (item.file) {
      try {
        // 回收站语义：system=true 移入系统回收站（.trash），可在回收站恢复
        await app.vault.trash(item.file, true);
      } catch (e) {
        // 删除失败（如 Windows 文件被占用）：报错并保留条目，不摘列表不报成功（下次 rebuild 会「复活」）
        console.error('删除影视笔记失败:', e);
        notice('删除失败：文件可能被占用，请重试', 'error');
        return;
      }
    }
    const idx = M.items.indexOf(item);
    if (idx > -1) M.items.splice(idx, 1);
    // 事件补发（smartcat 行为流观察；ADR-0087 cinema 接管）
    emitDomainEvent('movie', { kind: 'deleted', name: item.name });
    close();
    notice('已移入回收站', 'success');
    renderAll(app);
  });
}

// ---------- 快速状态窗（升级 + 评分滑杆 + 影评） ----------

function openQuickStatus(item: CinemaItem, app: App): void {
  // 升级路径：想看 →（在看/已看）；在看 →（已看）——平铺单选（组件库 .bz-choice）
  // 增强包需求 9：默认选「已看」（终态占比最高，少一次点选）
  const targets = item.status === STATUS_WANT ? ['在看', '已看'] : ['已看'];
  const def = targets.includes('已看') ? '已看' : targets[0];
  const btns = targets.map((s) => `<button type="button" class="bz-choice-btn${s === def ? ' is-on' : ''}" data-cinema-qs="${s}" data-value="${s}">${s}</button>`).join('');
  const curRating = item.rating && item.rating > 0 ? item.rating : DEFAULT_RATING;
  const html = `<div class="bz-cinema-qs-title">${esc(item.name)}</div>
    <div class="bz-cinema-qs-btns">${btns}</div>
    <div class="bz-cinema-qs-rating"><div class="bz-field"><span class="bz-field-label">评分（已看时生效）</span>
      <span class="bz-cinema-rating-row"><input type="range" class="bz-range" id="bz-cinema-qs-rating" min="1" max="${RATING_MAX}" step="0.1" value="${curRating}">
      <span class="bz-cinema-rating-val" id="bz-cinema-qs-rating-val">${Number(curRating).toFixed(1)}</span></span></div></div>
    <div class="bz-cinema-qs-review"><div class="bz-field"><span class="bz-field-label">影评</span><textarea class="bz-input" id="bz-cinema-qs-review" placeholder="写点什么…">${item.review ? esc(item.review) : ''}</textarea></div></div>
    <div class="bz-cinema-form-actions"><button class="bz-btn bz-btn--primary" id="bz-cinema-qs-save">保存</button></div>
    <div class="bz-cinema-qs-hint">想快速看完？点「在看」→「已看」，评分与影评一步保存。</div>`;
  const { popup, close } = uiModal({ content: html, maxWidth: 360, className: 'bz-cinema-dm' });
  const getSelected = bindChoice(popup, '[data-cinema-qs]');
  const ratingInput = popup.querySelector('#bz-cinema-qs-rating') as HTMLInputElement;
  const ratingValEl = popup.querySelector('#bz-cinema-qs-rating-val') as HTMLElement;
  ratingInput.addEventListener('input', () => { ratingValEl.textContent = Number(ratingInput.value).toFixed(1); });
  popup.querySelector('#bz-cinema-qs-save')?.addEventListener('click', () => {
    const ratingVal = parseFloat(ratingInput.value);
    const review = (popup.querySelector('#bz-cinema-qs-review') as HTMLTextAreaElement).value.trim();
    const selected = getSelected() || def;
    const mapped = selected === '已看' ? ratingVal : selected === '在看' ? 0 : -1;
    // from 快照（事件载荷用；对齐旧 movie 语义，见 ADR-0087）
    const fromSt = item.status === STATUS_WANT ? 'want' : item.status === STATUS_WATCHING ? 'watching' : 'watched';
    const fromRating = item.rating && item.rating > 0 ? item.rating : null;
    const fromReview = item.review || null;
    item.status = selected === '已看' ? STATUS_WATCHED : selected === '在看' ? STATUS_WATCHING : STATUS_WANT;
    item.rating = mapped;
    if (review) item.review = review;
    else item.review = null;
    // CM1：流转为「已看」时刷新观影日期（统计口径按看完时间，非加入时间）
    if (item.status === STATUS_WATCHED && fromSt !== 'watched') item.watchDate = localNow();
    void (async () => {
      try {
        await persistItem(item, app);
        close();
        notice(`已标记${selected}`, 'success');
        // 事件补发（smartcat 行为流观察）：状态流转 + 条件评分/影评（对齐旧 movie 快速状态窗）
        const toSt = item.status === STATUS_WANT ? 'want' : item.status === STATUS_WATCHING ? 'watching' : 'watched';
        if (toSt !== fromSt) emitDomainEvent('movie', { kind: 'status', name: item.name, from: fromSt, to: toSt });
        const toRating = item.rating && item.rating > 0 ? item.rating : null;
        if (toRating !== null && toRating !== fromRating) emitDomainEvent('movie', { kind: 'rated', name: item.name, fromRating, toRating });
        const toReview = item.review || null;
        if (toReview !== fromReview) emitDomainEvent('movie', { kind: 'review', name: item.name, fromReview, toReview: toReview });
        renderAll(app);
      } catch (e) {
        notifySaveError(e);
        console.error(e);
      }
    })();
  });
}

// ---------- 主 overlay ----------

/** 头部图标钮 HTML（移动端工具/关闭） */
function iconBtnHTML(icon: string, title: string, extraCls: string, toolAttr: string): string {
  return `<button class="bz-icon-btn${extraCls ? ' ' + extraCls : ''}" data-cinema-tool="${toolAttr}" title="${title}">${iconSpan(icon)}</button>`;
}

export function createOverlay(app: App): void {
  const overlay = document.createElement('div');
  overlay.className = 'bz-cinema-overlay';
  const fullscreen = (tryGetSettings() as Record<string, unknown>).cinemaMobileDefaultFullscreen === true;

  overlay.innerHTML = `
    <div class="bz-cinema-panel">
      <div class="bz-cinema-head">
        <div class="bz-cinema-title">影视</div>
        <div class="bz-cinema-head-btns">
          ${iconBtnHTML(ICON.ai, 'AI 荐片', 'bz-cinema-mob-only', 'ai')}
          ${iconBtnHTML(ICON.stat, '影视分析', 'bz-cinema-mob-only', 'stat')}
          ${iconBtnHTML(ICON.close, '关闭', 'bz-cinema-mob-only bz-cinema-close', 'close')}
        </div>
      </div>
      <div class="bz-cinema-body">
        <div class="bz-cinema-nav"></div>
        <div class="bz-cinema-main">
          <div class="bz-cinema-main-head" data-cinema-main-head></div>
          <div class="bz-cinema-top">
            <div class="bz-cinema-search"><i class="bz-ic" data-lucide="${ICON.search}"></i><input class="bz-input" type="text" data-cinema-search placeholder="搜索影视（名称、类型、影评）..."></div>
            <div class="bz-cinema-sort" data-cinema-sort></div>
          </div>
          <div class="bz-cinema-mob-nav"></div>
          <div class="bz-cinema-content"></div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  topifyZ(overlay); // ADR-0067：显示即发号——home 等静态档面板先开时影院仍置顶（谁后显示谁在上）
  M.currentOverlay = overlay;
  M.renderFn = () => renderAll(app);
  applyMobileWindowFullscreen(overlay.querySelector('.bz-cinema-panel') as HTMLElement, fullscreen);
  mountIcons(overlay);

  // 排序 segmented（组件库；桌面工具行；移动不显示——同待办）
  const sortEl = overlay.querySelector('[data-cinema-sort]') as HTMLElement | null;
  if (sortEl) {
    const seg = uiSegmented<string>({
      options: [
        { value: 'date', label: '最近观看' },
        { value: 'created', label: '按创建' },
        { value: 'rating', label: '按评分' },
      ],
      value: M.sortMode,
      onChange: (v) => {
        M.sortMode = v as CinemaState['sortMode'];
        if (M.view === 'list') renderAll(app);
      },
    });
    seg.el.classList.add('bz-segmented--sm');
    sortEl.appendChild(seg.el);
  }

  // 事件
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // 点遮罩 = 关闭主面板（桌面端无关闭按钮，靠遮罩/ESC 关闭）
    if (e.target === overlay) {
      closeOverlay();
      return;
    }
    // 类型：全部/组。点组=筛组+展开其二级（互斥收起其他组）；点「全部」=清空类型与二级；
    // 点已选组不取消（回全部靠「全部」）；点组内二级=筛二级（组跟随选中）
    const navItem = t.closest('[data-cinema-type]') as HTMLElement | null;
    if (navItem) {
      const g = navItem.dataset.cinemaType as string;
      const isMob = navItem.hasAttribute('data-cinema-mob');
      if (g === 'all') {
        M.typeFilter = null;
        M.subFilter = null;
      } else if (M.typeFilter === g && !M.subFilter) {
        // 再点已选组：不取消（对齐待办全部模型），保持筛选
      } else {
        M.typeFilter = g;
        M.subFilter = null;
        // 展开态 = 本组选中；其他组自动收起（手风琴）
        if (!isMob) {
          const subs = (GROUP_SUBS[g] || []).filter((s) => M.items.some((i) => i.typeTag === s));
          if (subs.length) M.expanded[g] = true;
        }
      }
      M.view = 'list';
      renderAll(app);
      return;
    }
    const subItem = t.closest('[data-cinema-sub]') as HTMLElement | null;
    if (subItem) {
      const s = subItem.dataset.cinemaSub as string;
      const grp = getGroupForTag(s);
      if (M.subFilter === s) {
        // 再点同二级 → 回到该组全部（清二级，保持组）
        M.subFilter = null;
        M.typeFilter = grp;
      } else {
        M.subFilter = s;
        M.typeFilter = grp;
      }
      M.view = 'list';
      renderAll(app);
      return;
    }
    const statusItem = t.closest('[data-cinema-status]') as HTMLElement | null;
    if (statusItem) {
      const s = statusItem.dataset.cinemaStatus as string;
      if (s === 'all') M.statusFilter = null;
      else M.statusFilter = M.statusFilter === s ? null : s; // 再点已选状态可取消回全部
      M.view = 'list';
      renderAll(app);
      return;
    }
    const tool = t.closest('[data-cinema-tool]') as HTMLElement | null;
    if (tool) {
      if (tool.dataset.cinemaTool === 'ai') {
        // AI 荐片（增强包需求 4：按需触发）：切页只渲染引导/上次结果，不发请求；
        // 触发靠页内「开始 AI 荐片 / 重试 / 换一批」按钮
        M.view = 'ai';
        renderAll(app);
      } else if (tool.dataset.cinemaTool === 'stat') {
        M.view = 'stat';
        renderAll(app);
      } else if (tool.dataset.cinemaTool === 'close') {
        closeOverlay();
      }
      return;
    }
    // AI 引导页「开始 AI 荐片」（点选按钮同 AI 工具）
    const aiStart = t.closest('[data-cinema-ai-start]') as HTMLElement | null;
    if (aiStart) {
      void runAIRecommend(app);
      return;
    }
    // AI 结果页「换一批」（增强包需求 3）：荐片重跑；找同类按基准影片重跑
    const aiRefresh = t.closest('[data-cinema-ai-refresh]') as HTMLElement | null;
    if (aiRefresh) {
      if (M.aiBase) void runSimilarRecommend(M.aiBase, app);
      else void runAIRecommend(app);
      return;
    }
    // AI 结果页内「加入想看」
    const recAdd = t.closest('[data-rec-add]') as HTMLElement | null;
    if (recAdd) {
      const idx = Number(recAdd.dataset.recAdd);
      const rec = M.aiResult?.[idx];
      if (rec) {
        void quickAddWant(app, rec.title || rec.name || '', rec.type || '');
      }
      return;
    }
    // 快速状态升级（想看/在看 灰色小字）
    const up = t.closest('[data-cinema-upgrade]') as HTMLElement | null;
    if (up) {
      const item = cinemaItemByKey(up.dataset.cinemaUpgrade);
      if (item) openQuickStatus(item, app);
      return;
    }
    // 海报卡片 → 详情
    const pcard = t.closest('[data-cinema-idx]') as HTMLElement | null;
    if (pcard) {
      const item = cinemaItemByKey(pcard.dataset.cinemaIdx);
      if (item) openDetail(item, app);
      return;
    }
    const add = t.closest('[data-cinema-add]') as HTMLElement | null;
    if (add) { openEditForm(null, app); return; }
  });

  // 搜索（防抖）
  const searchInput = overlay.querySelector('[data-cinema-search]') as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
    M.searchDebounceTimer = setTimeout(() => {
      M.searchKeyword = searchInput.value.trim();
      M.view = 'list';
      renderAll(app);
    }, 300);
  });

  rebuildItems(app);
  renderAll(app);
}

export function closeOverlay(): void {
  if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  M.renderFn = null;
  M.view = 'list'; // 复位视图：重开回落列表页（AI 页/分析页不跨开合残留）
}

// ---------- ESC（主面板） ----------

let mainEscRegistered = false;
export function registerEscapeHandler(): void {
  if (mainEscRegistered) return;
  mainEscRegistered = true;
  escManager.register('bz-cinema', {
    isVisible: () => !!M.currentOverlay,
    close: () => closeOverlay(),
  });
}
