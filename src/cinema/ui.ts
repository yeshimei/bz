/**
 * 影院（cinema）域 UI：风格化面板（issue 236 / ADR-0103）
 * 三风格单键 cinemaStyle（清单 CINEMA_STYLES）：午夜场（完整功能）/ 场刊 / 放映室；
 * DOM 与 src/cinema/prototype.html 逐字同构（桌面 desk 壳 900×620 / 移动 mob 壳独立自绘，两套按端渲染其一）。
 * 共享件（详情/表单/菜单/抽屉/确认/AI/分析/设置弹窗）= 午夜场视觉，三风格共用：
 * 弹窗宿主为 display:contents 的 .bz-cinema--midnight 锚类容器，共享样式（scoped 午夜场锚下）零复制生效。
 * 业务层零迁移：persistItem 落盘 / smartcat movie 域事件 / AI 推荐 / 分析统计 / 海报守护全部原样。
 * 落域适配（ADR-0103 §5，原型不出）：移动头行补 ✕ 关闭钮；移动 ✦ 再点回列表；
 * 演示「模拟失败」按钮退役。gazette/booth 风格延后（清单与设置键已备，本批仅午夜场）。
 * 图标：lucide（data-lucide 占位 → mountIcons 统一 setIcon）；弹窗 ESC 一律走 escManager 层级。
 */
import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { notify, notice, notifySaveError } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { topifyZ } from '../core/dom';
import { tryGetSettings, saveSettings } from '../core/settings-provider';
import { mountIcons } from '../core/ui';
import {
  STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED, DEFAULT_RATING,
  GROUP_ORDER, TYPE_COLORS, getGroupForTag, cinemaStyleOf,
} from './constants';
import { M, type CinemaItem } from './state';
import { rebuildItems, getDisplayItems } from './data';
import { formatRelativeTime, escapeHtml } from '../core/utils';
import { runAIRecommend, runSimilarRecommend, buildTasteProfile, quickAddWant } from './recommend';
import { buildStatPageHtml } from './analysis';
import { watchPosterFetch } from './poster-watch';

// ---------- 小工具 ----------

/** lucide 图标名（均为 Obsidian setIcon 已注册名） */
const ICON = {
  ai: 'bot',
  stat: 'bar-chart-3',
  close: 'x',
  search: 'search',
  add: 'plus',
  edit: 'pencil',
  del: 'trash-2',
  confirm: 'alert-circle',
  back: 'chevron-left',
  grid: 'layout-grid',
  eye: 'eye',
  play: 'play',
  globe: 'globe',
  film: 'clapperboard',
  gear: 'sliders-horizontal',
} as const;

/** lucide 占位 HTML（innerHTML 拼接用；渲染后 mountIcons 统一 setIcon） */
function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}

/** HTML 转义（core escapeHtml 的 unknown 容错壳） */
function esc(s: unknown): string {
  return escapeHtml(String(s ?? ''));
}

/** 相对日期：统一走 core formatRelativeTime；本域仅保留「未标注日期」兜底语义 */
export function relDate(d: string | null, now: Date = new Date()): string {
  if (!d) return '未标注日期';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '未标注日期';
  return formatRelativeTime(d, now);
}

/** 类型色（原型 TYPE_C 口径：其他 = #8a8578） */
function typeColor(group: string): string {
  return group === '其他' ? '#8a8578' : (TYPE_COLORS[group] ?? '#8a8578');
}

/** 状态色（原型 ST_C 口径） */
const ST_COLOR: Record<string, string> = { 想看: '#98917f', 在看: '#d97c1d', 已看: '#4a9a5c' };
function statusColor(status: number): string {
  return status === STATUS_WANT ? ST_COLOR['想看'] : status === STATUS_WATCHING ? ST_COLOR['在看'] : ST_COLOR['已看'];
}
function statusText(status: number): string {
  return status === STATUS_WANT ? '想看' : status === STATUS_WATCHING ? '在看' : '已看';
}

/** 星星串（沿用 floor 口径：半星=空心；5 星轨道文本） */
function stars(rating: number): string {
  if (!rating || rating <= 0) return '';
  const st = Math.min(Math.round((rating / 2) * 2) / 2, 5);
  const full = Math.floor(st);
  let s = '';
  for (let i = 0; i < full; i++) s += '★';
  for (let j = full; j < 5; j++) s += '☆';
  return s;
}

// ---------- 海报 ----------

/** 海报资源 URL（vault 资源路径）；无图返回 null */
function posterUrl(item: CinemaItem, app: App): string | null {
  if (!item.poster) return null;
  const f = app.vault.getAbstractFileByPath(item.poster);
  if (f && f instanceof TFile && /\.(png|jpe?g|gif|webp)$/i.test(f.name)) {
    return app.vault.getResourcePath(f);
  }
  return null;
}

/** 海报内芯 HTML：有图出图（onerror 兜底换首字占位），无图出首字占位（原型 .pw>.ph 同构） */
function posterInner(item: CinemaItem, app: App): string {
  const url = posterUrl(item, app);
  const ph = `<div class="ph">${esc(item.name[0] ?? '')}</div>`;
  if (!url) return ph;
  return `<img loading="lazy" src="${esc(url)}" onerror="this.outerHTML='<div class=\\'ph\\'>${esc(item.name[0] ?? '')}</div>'">`;
}

// ---------- 稳定键（CM3：file.path / new:name） ----------

function itemKey(it: CinemaItem): string {
  return esc(it.file?.path ?? `new:${it.name}`);
}
function itemByKey(key: string | undefined): CinemaItem | undefined {
  if (!key) return undefined;
  return M.items.find((it) => (it.file?.path ?? `new:${it.name}`) === key);
}

// ---------- 通用业务（菜单/抽屉动作、快速状态、豆瓣） ----------

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

/** 快速标记状态（菜单/抽屉「标记在看/已看」）：评分映射 + 状态流转即刷新观影日期 + 域事件补发 */
async function markStatus(item: CinemaItem, target: '在看' | '已看', sec: HTMLElement, app: App): Promise<void> {
  const fromSt = item.status === STATUS_WANT ? 'want' : item.status === STATUS_WATCHING ? 'watching' : 'watched';
  const prevRating = item.rating && item.rating > 0 ? item.rating : null;
  item.status = target === '已看' ? STATUS_WATCHED : STATUS_WATCHING;
  if (target === '在看') {
    item.rating = 0;
  } else if (!prevRating) {
    item.rating = DEFAULT_RATING;
  }
  item.watchDate = localNow();
  try {
    await persistItem(item, app);
    panelToast(sec, `已把「${item.name}」标记为${target}`);
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

/** 菜单/抽屉动作列表（顺序即显示顺序；业务语义与旧版一致） */
interface MenuAct { icon: string; label: string; danger?: boolean; run: () => void }
function itemActions(it: CinemaItem, sec: HTMLElement, app: App): MenuAct[] {
  const out: MenuAct[] = [{ icon: ICON.eye, label: '打开详情', run: () => openDetail(sec, it, app) }];
  if (it.status !== STATUS_WATCHING && it.status !== STATUS_WATCHED) {
    out.push({ icon: ICON.play, label: '标记在看', run: () => void markStatus(it, '在看', sec, app) });
  }
  if (it.status !== STATUS_WATCHED) {
    out.push({ icon: 'check', label: '标记已看', run: () => void markStatus(it, '已看', sec, app) });
  }
  out.push(
    { icon: ICON.ai, label: '找同类', run: () => void runSimilarRecommend(it, app) },
    { icon: ICON.globe, label: '在豆瓣打开', run: () => openDouban(it) },
    { icon: ICON.edit, label: '编辑', run: () => openForm(sec, it, app) },
    { icon: ICON.del, label: '删除', danger: true, run: () => openConfirm(sec, it, app) },
  );
  return out;
}

// ---------- 落盘（数据契约零改动） ----------

/** 本地时间 YYYY-MM-DD HH:mm:ss */
function localNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 文件名非法字符（Windows 保留集；名称源自文件名《X》，改名前拦截） */
const ILLEGAL_NAME_RE = /[\\/:*?"<>|]/;

/**
 * 把条目落盘：新增建笔记，编辑/快速状态写 frontmatter（保留海报/豆瓣字段）；
 * 改名走 fileManager.renameFile（自动更新双链）；类型写入 frontmatter tags。
 */
async function persistItem(item: CinemaItem, app: App, edit?: { prevName: string; prevTag: string }): Promise<void> {
  if (!item.file) {
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
  if (edit && item.name !== edit.prevName) {
    const newPath = `${M.folderPath}/《${item.name}》.md`;
    if (newPath !== item.file.path) {
      await app.fileManager.renameFile(item.file, newPath);
      item.file = (app.vault.getAbstractFileByPath(newPath) as CinemaItem['file']) || item.file;
    }
  }
  await app.fileManager.processFrontMatter(item.file, (fm: Record<string, unknown>) => {
    fm['评分'] = item.rating ?? 0;
    fm['观影日期'] = item.watchDate || localNow();
    if (item.review) fm['影评'] = item.review;
    else delete fm['影评'];
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
  const root = M.currentOverlay?.querySelector<HTMLElement>('[data-cinema-root]');
  if (root) openForm(root, null, app);
}

// ---------- 面板统计/标题 ----------

function statusCounts(): Record<string, number> {
  const c: Record<string, number> = { 想看: 0, 在看: 0, 已看: 0 };
  M.items.forEach((it) => { c[statusText(it.status)]++; });
  return c;
}
function groupCounts(): Record<string, number> {
  const g: Record<string, number> = {};
  M.items.forEach((it) => { g[it.group] = (g[it.group] || 0) + 1; });
  return g;
}
function watchedCount(): number {
  return M.items.filter((it) => it.status === STATUS_WATCHED).length;
}
/** 列表标题 = 筛选名（组 + 状态叠加） */
function listTitle(): string {
  return (M.typeFilter || '全部') + (M.statusFilter ? ` · ${M.statusFilter}` : '');
}
/** 网格每行列数（设置 cinemaGridColumns；空值/非法回退 5，钳制 2~12） */
export function gridColumns(): number {
  const raw = Number((tryGetSettings() as Record<string, unknown>).cinemaGridColumns);
  if (!Number.isFinite(raw) || raw <= 0) return 5;
  return Math.min(12, Math.max(2, Math.round(raw)));
}

// ---------- 共享弹窗宿主（display:contents 午夜场锚类：三风格共用弹窗样式，ADR-0103 §3） ----------

function ovHost(sec: HTMLElement): HTMLElement {
  let host = sec.querySelector<HTMLElement>('[data-cinema-ovhost]');
  if (!host) {
    host = document.createElement('div');
    host.className = 'bz-cinema--midnight';
    host.setAttribute('data-cinema-ovhost', '');
    host.style.display = 'contents';
    sec.appendChild(host);
  }
  return host;
}

interface OvlHandle { el: HTMLDivElement; close: () => void }

let ovlSeq = 0;

/** 面板内弹窗层（.cn-ovl 挂共享宿主；ESC 走 escManager 层级，后注册先关） */
function ovl(sec: HTMLElement, html: string, opts: { sticky?: boolean } = {}): OvlHandle {
  const el = document.createElement('div');
  el.className = 'cn-ovl';
  el.innerHTML = html;
  ovHost(sec).appendChild(el);
  let close = () => {};
  const handle = escManager.register(`bz-cinema-ovl-${++ovlSeq}`, { isVisible: () => el.isConnected, close: () => close() });
  close = () => { handle.unregister(); el.remove(); };
  el.addEventListener('click', (e) => { if (e.target === el && !opts.sticky) close(); });
  return { el, close };
}

/** 面板内 toast（原型 .cn-toast 同构；无面板时回落 core notice） */
function panelToast(sec: HTMLElement | null, msg: string): void {
  if (!sec || !sec.isConnected) { notice(msg); return; }
  const t = document.createElement('div');
  t.className = 'cn-toast';
  t.textContent = msg;
  ovHost(sec).appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// ---------- 弹窗：右键菜单 / 长按抽屉 ----------

function closeMenus(): void {
  M.currentOverlay?.querySelectorAll('.cn-menu').forEach((m) => m.remove());
}
function closeSheets(): void {
  M.currentOverlay?.querySelectorAll('.cn-sheet,.cn-sheet-mask').forEach((x) => x.remove());
}

/** 桌面右键菜单（.cn-menu；坐标相对面板根） */
function openMenu(sec: HTMLElement, it: CinemaItem, app: App, x: number, y: number): void {
  closeMenus();
  const acts = itemActions(it, sec, app);
  const el = document.createElement('div');
  el.className = 'cn-menu';
  el.innerHTML = acts.map((a, i) => `<button class="cn-menu-item${a.danger ? ' danger' : ''}" data-i="${i}">${iconSpan(a.icon)}${a.label}</button>`).join('');
  ovHost(sec).appendChild(el);
  mountIcons(el);
  const mw = el.offsetWidth, mh = el.offsetHeight, W = sec.clientWidth, H = sec.clientHeight;
  el.style.left = Math.min(x, W - mw - 8) + 'px';
  el.style.top = Math.min(y, H - mh - 8) + 'px';
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
    if (!b) return;
    el.remove();
    acts[Number(b.dataset.i)].run();
  });
  setTimeout(() => document.addEventListener('click', function h() { el.remove(); document.removeEventListener('click', h); }), 0);
}

/** 移动端长按抽屉（.cn-sheet-mask + .cn-sheet，头=海报+名称+meta） */
function openSheet(sec: HTMLElement, it: CinemaItem, app: App): void {
  if (!sec.isConnected) return;
  closeSheets();
  const acts = itemActions(it, sec, app);
  const url = posterUrl(it, app);
  const mask = document.createElement('div');
  mask.className = 'cn-sheet-mask';
  const el = document.createElement('div');
  el.className = 'cn-sheet';
  el.innerHTML = `<div class="cn-sheet-head">${url ? `<img class="cn-sheet-poster" src="${esc(url)}" onerror="this.remove()">` : ''}
    <div><div class="cn-sheet-name">${esc(it.name)}</div><div class="cn-sheet-sub">${esc(it.year || '')} · ${esc(it.director || it.group)} · ${statusText(it.status)}</div></div></div>` +
    acts.map((a, i) => `<button class="cn-sheet-item${a.danger ? ' danger' : ''}" data-i="${i}">${iconSpan(a.icon)}${a.label}</button>`).join('');
  ovHost(sec).appendChild(mask);
  ovHost(sec).appendChild(el);
  mountIcons(el);
  const closeAll = () => { mask.remove(); el.remove(); };
  mask.addEventListener('click', closeAll);
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
    if (!b) return;
    closeAll();
    acts[Number(b.dataset.i)].run();
  });
}

/** 长按绑定（m-grid 卡片每次重渲染重建后重挂；lpFired 吞长按后的终端 click 防双开） */
let lpTimer: ReturnType<typeof setTimeout> | null = null;
let lpFired = false;
function attachLongPress(sec: HTMLElement, app: App): void {
  sec.querySelectorAll<HTMLElement>('.m-grid .pcard').forEach((c) => {
    c.addEventListener('pointerdown', () => {
      const it = itemByKey(c.dataset.cinemaKey);
      if (!it) return;
      lpFired = false;
      lpTimer = setTimeout(() => { lpFired = true; openSheet(sec, it, app); }, 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => c.addEventListener(ev, () => { if (lpTimer) clearTimeout(lpTimer); }));
    c.addEventListener('click', (e) => { if (lpFired) { e.stopImmediatePropagation(); lpFired = false; } });
    c.addEventListener('contextmenu', (ev) => ev.preventDefault());
  });
}

// ---------- 弹窗：详情 ----------

function openDetail(sec: HTMLElement, it: CinemaItem, app: App): void {
  const badge = (color: string, text: string) => `<span class="dm-chip" style="background:${color}">${esc(text)}</span>`;
  const rows: [string, string][] = ([
    ['类型', it.genre ?? ''],
    ['导演', it.director ?? ''],
    ['主演', it.actors ?? ''],
    ['制片国家/地区', it.region ?? ''],
    ['上映日期', it.year ?? ''],
    ['豆瓣评分', it.doubanRating ?? ''],
  ] as [string, string][]).filter(([, v]) => v !== '');
  const url = posterUrl(it, app);
  const { el, close } = ovl(sec, `<div class="cn-modal" style="max-width:400px;width:100%">
    <button class="cn-modal-x j-close" title="关闭">${iconSpan(ICON.close)}</button>
    <div class="dm-head"><div class="dm-poster">${url ? `<img src="${esc(url)}" onerror="this.remove()">` : ''}</div>
      <div style="flex:1;min-width:0"><div class="dm-title">${esc(it.name)}</div>
        <div class="dm-badges">${badge(typeColor(it.group), it.typeTag)}
          ${it.status !== STATUS_WATCHED ? badge(statusColor(it.status), statusText(it.status)) : ''}
          ${it.rating && it.rating > 0 ? `<span class="dm-stars">${stars(it.rating)}</span><span class="dm-rating">${Number(it.rating).toFixed(1)}</span>` : ''}
          ${it.watchDate ? `<span class="dm-date">${esc((it.watchDate || '').slice(0, 10))}</span>` : ''}</div>
        ${it.review ? `<div class="dm-review">${esc(it.review)}</div>` : ''}</div></div>
    ${rows.length ? '<div class="dm-sec">豆 瓣 信 息</div>' + rows.map(([k, v]) => `<div class="dm-kv"><span class="dm-kv-k">${k}</span><span class="dm-kv-v">${esc(v)}</span></div>`).join('') : ''}
    ${it.doubanUrl ? `<div class="dm-kv"><span class="dm-kv-k">豆瓣链接</span><span class="dm-kv-v"><a href="${esc(it.doubanUrl)}" target="_blank" rel="noopener">${esc(it.doubanUrl)}</a></span></div>` : ''}
    ${it.synopsis ? `<div class="dm-sec">简 介</div><div style="font-size:12px;line-height:1.8;color:var(--ink-2);text-align:justify">${esc(it.synopsis)}</div>` : ''}
    <div class="dm-actions"><button class="dm-btn j-similar">${iconSpan(ICON.ai)}找同类</button><button class="dm-btn j-edit">${iconSpan(ICON.edit)}编辑</button><button class="dm-btn danger j-del">${iconSpan(ICON.del)}删除</button></div>
  </div>`);
  mountIcons(el);
  el.querySelector('.j-close')?.addEventListener('click', close);
  el.querySelector('.j-edit')?.addEventListener('click', () => { close(); openForm(sec, it, app); });
  el.querySelector('.j-del')?.addEventListener('click', () => { close(); openConfirm(sec, it, app); });
  el.querySelector('.j-similar')?.addEventListener('click', () => { close(); void runSimilarRecommend(it, app); });
}

// ---------- 弹窗：添加 / 编辑表单 ----------

/** 组 → 细分 tag 映射（表单 choices 用） */
const GROUP_SUBS_OF: Record<string, string[]> = {
  电影: [], 剧集: ['国产剧', '美剧', '英剧', '德剧', '日剧', '韩剧', '哥伦比亚剧'], 动漫: ['日漫', '国漫', '美漫'], 纪录片: [], 公开课: ['公开课', 'TED'],
};

function openForm(sec: HTMLElement, item: CinemaItem | null, app: App): void {
  const editing = !!item;
  const initTag = item ? item.typeTag : '电影';
  const initSt = item ? statusText(item.status) : '想看';
  const ratingVal = item && item.rating && item.rating > 0 ? item.rating : DEFAULT_RATING;
  const allTags: string[] = [];
  for (const g of GROUP_ORDER) {
    if (g === '其他') continue;
    const subs = GROUP_SUBS_OF[g];
    if (subs.length) subs.forEach((t) => allTags.push(t));
    else allTags.push(g);
  }
  const choices = (values: string[], cur: string, attr: string) => values.map((v) =>
    `<button type="button" class="f-choice-btn${v === cur ? ' is-on' : ''}" data-${attr}="${v}"><span class="dot" style="background:${attr === 'f-tag' ? typeColor(getGroupForTag(v) ?? '其他') : ST_COLOR[v] ?? '#888'}"></span>${v}</button>`).join('');
  const { el, close } = ovl(sec, `<div class="cn-modal" style="width:100%">
    <div class="cn-modal-title">${editing ? '编辑影视' : '添加影视'}</div><button class="cn-modal-x j-close" title="关闭">${iconSpan(ICON.close)}</button>
    <div class="f-field"><span class="f-label">名 称</span><input class="f-input j-name" value="${item ? esc(item.name) : ''}" placeholder="影视名称"></div>
    <div class="f-field"><span class="f-label">类 型</span><div class="f-choice j-tags">${choices(allTags, initTag, 'f-tag')}</div></div>
    <div class="f-field"><span class="f-label">状 态</span><div class="f-choice j-sts">${choices(['想看', '在看', '已看'], initSt, 'f-st')}</div></div>
    <div class="f-field j-rating" style="display:${initSt === '已看' ? '' : 'none'}"><span class="f-label">评 分</span>
      <div class="f-range-row"><input type="range" class="f-range j-range" min="1" max="10" step="0.1" value="${ratingVal}"><span class="f-range-val j-rval">${Number(ratingVal).toFixed(1)}</span></div></div>
    <div class="f-field j-review" style="display:${initSt === '已看' ? '' : 'none'}"><span class="f-label">影 评</span><textarea class="f-input j-review-t" placeholder="写点什么…">${item ? esc(item.review ?? '') : ''}</textarea></div>
    <div class="dm-actions"><button class="dm-btn gold j-save">${editing ? '保存' : '添加'}</button></div>
  </div>`);
  mountIcons(el);
  const cur = { tag: initTag, st: initSt };
  el.querySelectorAll<HTMLElement>('[data-f-tag]').forEach((b) => b.addEventListener('click', () => {
    cur.tag = b.dataset.fTag ?? cur.tag;
    el.querySelectorAll('[data-f-tag]').forEach((x) => x.classList.toggle('is-on', x === b));
  }));
  el.querySelectorAll<HTMLElement>('[data-f-st]').forEach((b) => b.addEventListener('click', () => {
    cur.st = b.dataset.fSt ?? cur.st;
    el.querySelectorAll('[data-f-st]').forEach((x) => x.classList.toggle('is-on', x === b));
    const show = cur.st === '已看';
    (el.querySelector('.j-rating') as HTMLElement).style.display = show ? '' : 'none';
    (el.querySelector('.j-review') as HTMLElement).style.display = show ? '' : 'none';
  }));
  el.querySelector('.j-close')?.addEventListener('click', close);
  el.querySelector('.j-save')?.addEventListener('click', () => {
    const name = (el.querySelector('.j-name') as HTMLInputElement).value.trim();
    if (!name) { panelToast(sec, '请输入名称'); return; }
    if (editing && item && name !== item.name && M.items.some((x) => x.name === name)) { panelToast(sec, '已存在同名影视，请换个名称'); return; }
    if (!editing && M.items.some((x) => x.name === name)) { panelToast(sec, '已存在同名影视，请换个名称'); return; }
    const stChanged = !editing || !item || item.status !== (cur.st === '想看' ? STATUS_WANT : cur.st === '在看' ? STATUS_WATCHING : STATUS_WATCHED);
    const date = stChanged ? localNow() : (item!.watchDate || localNow());
    const rating = cur.st === '已看' ? parseFloat((el.querySelector('.j-range') as HTMLInputElement).value) : cur.st === '在看' ? 0 : null;
    const review = cur.st === '已看' ? (el.querySelector('.j-review-t') as HTMLTextAreaElement).value.trim() : '';
    if (editing && item) {
      void saveEdit(sec, item, { name, tag: cur.tag, st: cur.st, rating, date, review }, app, close);
    } else {
      void saveNew(sec, { name, tag: cur.tag, st: cur.st, rating, date, review }, app, close);
    }
  });
}

interface FormPayload { name: string; tag: string; st: string; rating: number | null; date: string; review: string }

/** 新增落盘（CM2：重名/落盘失败回退；created 域事件 + 海报守护接管） */
async function saveNew(sec: HTMLElement, p: FormPayload, app: App, close: () => void): Promise<void> {
  const group = getGroupForTag(p.tag) ?? '其他';
  const st = p.st === '想看' ? STATUS_WANT : p.st === '在看' ? STATUS_WATCHING : STATUS_WATCHED;
  const it: CinemaItem = { file: null, name: p.name, typeTag: p.tag, group, status: st, rating: p.rating, watchDate: p.date, review: p.review, poster: null, genre: null, director: null, actors: null, region: null, year: null, doubanRating: null, doubanUrl: null, synopsis: null, duration: null, seasonText: null };
  try {
    if (app.vault.getAbstractFileByPath(`${M.folderPath}/《${p.name}》.md`)) {
      panelToast(sec, '已存在同名影视，请换个名称');
      return;
    }
    M.items.unshift(it);
    await persistItem(it, app);
    emitDomainEvent('movie', { kind: 'created', name: p.name, status: st === STATUS_WANT ? 'want' : st === STATUS_WATCHING ? 'watching' : 'watched', rating: p.rating, review: p.review || null });
    if (it.file) {
      const handle = notify('正在获取海报和豆瓣信息…', { type: 'progress' });
      watchPosterFetch(app, it.file, handle);
    }
    close();
    panelToast(sec, `已添加「${p.name}」`);
    renderAll(app);
  } catch (e) {
    if (!it.file) {
      const i = M.items.indexOf(it);
      if (i >= 0) M.items.splice(i, 1);
      renderAll(app);
    }
    notifySaveError(e);
    console.error(e);
  }
}

/** 编辑落盘：改名前置校验（非法字符/重名拦截）→ persistItem（rename + frontmatter tags） */
async function saveEdit(sec: HTMLElement, item: CinemaItem, p: FormPayload, app: App, close: () => void): Promise<void> {
  const group = getGroupForTag(p.tag) ?? '其他';
  const st = p.st === '想看' ? STATUS_WANT : p.st === '在看' ? STATUS_WATCHING : STATUS_WATCHED;
  const prev = { name: item.name, typeTag: item.typeTag, group: item.group, status: item.status, rating: item.rating, watchDate: item.watchDate, review: item.review };
  if (p.name !== item.name) {
    if (ILLEGAL_NAME_RE.test(p.name)) {
      notice('名称含非法字符（\\ / : * ? " < > |），请修改', 'error');
      return;
    }
    if (app.vault.getAbstractFileByPath(`${M.folderPath}/《${p.name}》.md`)) {
      panelToast(sec, '已存在同名影视，请换个名称');
      return;
    }
  }
  item.name = p.name; item.typeTag = p.tag; item.group = group;
  item.status = st; item.rating = p.rating; item.watchDate = p.date; item.review = p.review;
  try {
    await persistItem(item, app, { prevName: prev.name, prevTag: prev.typeTag });
    close();
    panelToast(sec, `已保存「${p.name}」`);
    renderAll(app);
  } catch (e) {
    Object.assign(item, prev);
    notifySaveError(e);
    console.error(e);
  }
}

// ---------- 弹窗：删除确认 ----------

function openConfirm(sec: HTMLElement, item: CinemaItem, app: App): void {
  const { el, close } = ovl(sec, `<div class="cn-modal cn-confirm" style="max-width:320px;width:100%">
    <span class="cn-confirm-ic">${iconSpan(ICON.confirm)}</span>
    <div class="cn-confirm-title">删除影视</div>
    <p>确定删除「${esc(item.name)}」吗？</p>
    <div class="cn-confirm-sub">将移入系统回收站，可在回收站恢复</div>
    <div class="dm-actions"><button class="dm-btn j-cancel">取消</button><button class="dm-btn danger j-del">${iconSpan(ICON.del)}删除</button></div>
  </div>`, { sticky: true });
  mountIcons(el);
  el.querySelector('.j-cancel')?.addEventListener('click', close);
  el.querySelector('.j-del')?.addEventListener('click', async () => {
    if (item.file) {
      try {
        await app.vault.trash(item.file, true);
      } catch (e) {
        console.error('删除影视笔记失败:', e);
        notice('删除失败：文件可能被占用，请重试', 'error');
        return;
      }
    }
    const idx = M.items.indexOf(item);
    if (idx > -1) M.items.splice(idx, 1);
    emitDomainEvent('movie', { kind: 'deleted', name: item.name });
    close();
    panelToast(sec, `已删除「${item.name}」`);
    renderAll(app);
  });
}

// ---------- 弹窗：影院设置（面板内；写插件设置经 saveSettings 持久化） ----------

type CinemaStateSort = 'date' | 'created' | 'rating';

function openSet(sec: HTMLElement, app: App): void {
  const s = tryGetSettings() as Record<string, unknown>;
  const sort = s.cinemaSortMode === 'created' || s.cinemaSortMode === 'rating' ? (s.cinemaSortMode as string) : 'date';
  const stf = typeof s.cinemaStatusFilter === 'string' ? s.cinemaStatusFilter : '';
  const cols = gridColumns();
  const mobFull = s.cinemaMobileDefaultFullscreen === true;
  const { el, close } = ovl(sec, `<div class="cn-modal" style="width:100%">
    <div class="cn-modal-title">影院设置</div><button class="cn-modal-x j-close" title="关闭">${iconSpan(ICON.close)}</button>
    <div class="set-row"><div class="set-name">默认排序<div class="set-desc">打开面板时列表按所选规则排序</div></div>
      <div class="set-ctl"><select class="j-sort">${[['date', '最近观看'], ['created', '按创建时间'], ['rating', '按评分']].map(([v, l]) => `<option value="${v}"${sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div class="set-row"><div class="set-name">默认状态筛选<div class="set-desc">打开面板时选中的状态筛选</div></div>
      <div class="set-ctl"><select class="j-stf">${['', '想看', '在看', '已看'].map((v) => `<option value="${v}"${stf === v ? ' selected' : ''}>${v || '全部'}</option>`).join('')}</select></div></div>
    <div class="set-row"><div class="set-name">网格每行列数<div class="set-desc">海报网格每一行的列数（2-12）</div></div>
      <div class="set-ctl"><input type="number" class="j-cols" min="2" max="12" step="1" value="${cols}"></div></div>
    <div class="set-row"><div class="set-name">移动端默认全屏<div class="set-desc">打开面板时移动端进入全屏态</div></div>
      <div class="set-ctl"><button class="set-sw j-sw${mobFull ? ' on' : ''}"></button></div></div>
    <div class="set-row"><div class="set-name">影视文件夹<div class="set-desc">影院读取的影视文件夹</div></div>
      <div class="set-ctl" style="font-size:11px;color:var(--ink-3);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(M.folderPath)}</div></div>
    <div class="dm-actions"><button class="dm-btn gold j-save">保存</button></div>
  </div>`);
  mountIcons(el);
  el.querySelector('.j-close')?.addEventListener('click', close);
  el.querySelector('.j-sw')?.addEventListener('click', (e) => (e.currentTarget as HTMLElement).classList.toggle('on'));
  el.querySelector('.j-save')?.addEventListener('click', () => {
    s.cinemaSortMode = (el.querySelector('.j-sort') as HTMLSelectElement).value;
    s.cinemaStatusFilter = (el.querySelector('.j-stf') as HTMLSelectElement).value;
    s.cinemaGridColumns = String(Math.min(12, Math.max(2, parseInt((el.querySelector('.j-cols') as HTMLInputElement).value, 10) || 5)));
    s.cinemaMobileDefaultFullscreen = el.querySelector('.j-sw')?.classList.contains('on') ?? false;
    void saveSettings();
    M.sortMode = s.cinemaSortMode as CinemaStateSort;
    M.statusFilter = (s.cinemaStatusFilter as string) || null;
    close();
    panelToast(sec, '设置已保存');
    renderAll(app);
  });
}

// ---------- 共享页：AI 荐片 ----------

/** 偏好行（buildTasteProfile 真实画像；无数据回退「暂无」） */
function prefLine(): string {
  const p = buildTasteProfile();
  const parts = [p.groups[0] || '', p.genres[0] || '', p.directors[0] || '', p.actors[0] || ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : '暂无';
}

function aiPageHtml(app: App): string {
  if (M.aiRunning) {
    return `<div class="ai-guide"><div class="ai-spin"></div>
      <span class="ai-ic">${iconSpan(ICON.ai)}</span><div class="ai-title">${esc(M.aiWaitMsg || 'AI 正在分析你的观影口味…')}</div>
      <div class="ai-sub">正在生成推荐，请稍候</div></div>`;
  }
  if (M.aiError) {
    return `<div class="ai-guide"><span class="ai-ic ai-err-ic">${iconSpan(ICON.ai)}</span>
      <div class="ai-title">AI 分析失败</div><div class="ai-sub">${esc(M.aiError)}</div>
      <button class="ai-start j-ai-start" data-cinema-ai-start>重试</button></div>`;
  }
  if (M.aiResult && M.aiResult.length > 0) {
    const cards = M.aiResult.map((rec: any, i: number) => {
      const name = rec?.title || rec?.name || '未命名';
      const meta = [rec?.type, rec?.director].filter(Boolean).join(' · ');
      const inLib = M.items.some((it) => it.name === name);
      return `<div class="rec-card"><div class="rec-main"><div class="rec-name">${esc(name)}
        <a href="${esc(doubanSearchUrl(name))}" target="_blank" rel="noopener" title="在豆瓣搜索">${iconSpan(ICON.globe)}</a></div>
        <div class="rec-meta">${esc(meta)}</div><div class="rec-reason">${esc(rec?.reason || '')}</div></div>
        <button class="rec-add" data-rec-add="${i}"${inLib ? ' disabled' : ''}>${inLib ? '已在库中' : '＋ 想看'}</button></div>`;
    }).join('');
    return `<div class="ai-pref">偏好：<b>${esc(prefLine())}</b></div>
      <div class="rec-list">${cards}</div>
      <div style="text-align:center;margin-top:14px"><button class="dm-btn j-ai-more" data-cinema-ai-start>${iconSpan(ICON.ai)}换一批</button></div>`;
  }
  return `<div class="ai-pref">偏好：<b>${esc(prefLine())}</b></div>
    <div class="ai-guide"><span class="ai-ic">${iconSpan(ICON.ai)}</span>
      <div class="ai-title">让 AI 读懂你的片库</div>
      <div class="ai-sub">基于你的评分、影评与偏好标签生成荐片，<br>结果可直接加入想看清单</div>
      <button class="ai-start j-ai-start" data-cinema-ai-start>${iconSpan(ICON.ai)}开始推荐</button></div>`;
}

// ---------- 午夜场：desk 壳 ----------

function midnightDeskHtml(): string {
  return `<section class="bz-cinema--midnight" data-cinema-root="midnight">
    <div class="d-body">
      <aside class="d-rail">
        <div class="rail-brand"><h1>影院</h1><div class="en">CINEMA CLUB</div></div>
        <div class="rail-sec">
          <div class="rail-label">类 型</div>
          <div class="j-groups"></div>
          <div class="rail-label" style="padding-top:14px">状 态</div>
          <div class="j-status"></div>
        </div>
        <div class="rail-foot">
          <button class="rail-item j-tool" data-tool="ai">${iconSpan(ICON.ai)}AI 荐片</button>
          <button class="rail-item j-tool" data-tool="stat">${iconSpan(ICON.stat)}观影分析</button>
        </div>
      </aside>
      <div class="d-main j-view"></div>
    </div>
  </section>`;
}

const railRow = (on: boolean, attr: string, color: string, name: string, n: number) =>
  `<button class="rail-item${on ? ' is-on' : ''}" ${attr}><span class="dot" style="background:${color}"></span>${esc(name)}<span class="n">${n}</span></button>`;

function midnightRailHtml(): { groups: string; status: string } {
  const g = groupCounts();
  const c = statusCounts();
  let groups = railRow(!M.typeFilter && !M.statusFilter, 'data-g="全部"', 'var(--gold)', '全部', M.items.length);
  for (const name of GROUP_ORDER) {
    groups += railRow(M.typeFilter === name && !M.statusFilter, `data-g="${name}"`, typeColor(name), name, g[name] || 0);
  }
  let status = '';
  for (const s of ['想看', '在看', '已看'] as const) {
    status += railRow(M.statusFilter === s, `data-s="${s}"`, ST_COLOR[s], s, c[s]);
  }
  return { groups, status };
}

function pcardHtml(it: CinemaItem, app: App): string {
  const r = it.rating;
  return `<div class="pcard" data-cinema-key="${itemKey(it)}"><div class="pw">${posterInner(it, app)}
    ${it.status !== STATUS_WATCHED ? `<span class="badge" style="background:${statusColor(it.status)}">${statusText(it.status)}</span>` : ''}</div>
    <div class="pname">${esc(it.name)}</div>
    <div class="pmeta">${esc(it.year || '')}${it.year && it.director ? ' · ' : ''}${esc(it.director || '')}</div>
    <div class="pstars">${r && r > 0 ? stars(r) + `<span class="num">${Number(r).toFixed(1)}</span>` : '<span style="opacity:.35">未评分</span>'}</div></div>`;
}

function emptyPageHtml(): string {
  const filtered = !!(M.typeFilter || M.statusFilter || M.searchKeyword);
  return `<div class="cn-empty-page"><div class="big">${filtered ? '无匹配影片' : '影片空空如也'}</div>
    ${filtered ? '<button class="dm-btn j-clear" data-cinema-clear style="margin-top:6px">清空筛选</button>' : '<span style="font-size:11.5px">点右上「添加影片」开始记录</span>'}</div>`;
}

function midnightViewHtml(app: App): string {
  if (M.view === 'ai') {
    return `<div class="sp-head"><button class="sp-back j-back">${iconSpan(ICON.back)}</button><span class="sp-title">AI 荐片</span><span class="sp-cnt j-spcnt">${M.aiResult && M.aiResult.length ? `· ${M.aiResult.length} 部` : ''}</span></div><div class="sp-body">${aiPageHtml(app)}</div>`;
  }
  if (M.view === 'stat') {
    return `<div class="sp-head"><button class="sp-back j-back">${iconSpan(ICON.back)}</button><span class="sp-title">观影分析</span><span class="sp-cnt j-spcnt">· ${watchedCount()} 部已看</span></div><div class="sp-body">${buildStatPageHtml()}</div>`;
  }
  const list = getDisplayItems();
  let html = `<div class="d-head"><h2 class="j-title">${esc(listTitle())}</h2><span class="cnt j-cnt">· ${list.length} 部</span>
    <button class="add j-add" data-cinema-add>${iconSpan(ICON.add)}添加影片</button></div>`;
  html += `<div class="d-tools"><label class="d-search">${iconSpan(ICON.search)}<input class="j-q" placeholder="搜索影视（名称、类型、影评）..." value="${esc(M.searchKeyword)}"></label>
    <div class="seg j-sort">${([['date', '最近观看'], ['created', '加入先后'], ['rating', '按评分']] as const).map(([k, l]) => `<button data-k="${k}" class="${M.sortMode === k ? 'is-on' : ''}">${l}</button>`).join('')}</div></div>`;
  html += list.length
    ? `<div class="d-scroll"><div class="grid" style="grid-template-columns:repeat(${gridColumns()},1fr)">${list.map((it) => pcardHtml(it, app)).join('')}</div></div>`
    : emptyPageHtml();
  return html;
}

function renderMidnightDesk(app: App, sec: HTMLElement): void {
  const rail = midnightRailHtml();
  const groupsEl = sec.querySelector('.j-groups');
  const statusEl = sec.querySelector('.j-status');
  if (groupsEl) groupsEl.innerHTML = rail.groups;
  if (statusEl) statusEl.innerHTML = rail.status;
  const view = sec.querySelector('.j-view');
  if (view) view.innerHTML = midnightViewHtml(app);
}

// ---------- 午夜场：mob 壳 ----------

function midnightMobHtml(): string {
  return `<section class="mob bz-cinema--midnight" data-cinema-root="midnight">
    <div class="m-head"><h2 class="j-mtitle">全部</h2><span class="cnt j-mcnt"></span>
      <span class="m-acts">
        <button class="m-tool j-mclose" title="关闭">${iconSpan(ICON.close)}</button>
        <button class="m-tool j-mai" title="AI 荐片">${iconSpan(ICON.ai)}</button>
        <button class="m-tool j-mstat" title="观影分析">${iconSpan(ICON.stat)}</button>
        <button class="m-tool j-mgear" title="影院设置">${iconSpan(ICON.gear)}</button>
        <button class="add j-madd" data-cinema-add>${iconSpan(ICON.add)}</button>
      </span>
    </div>
    <div class="m-chips j-chips"></div>
    <label class="m-search">${iconSpan(ICON.search)}<input class="j-mq" placeholder="搜索片名 / 导演…"></label>
    <div class="m-scroll j-mview"></div>
  </section>`;
}

function midnightChipsHtml(): string {
  let html = `<button class="chip${!M.typeFilter && !M.statusFilter ? ' is-on' : ''}" data-c="all">${iconSpan(ICON.grid)}全部</button>`;
  for (const name of GROUP_ORDER) {
    html += `<button class="chip${M.typeFilter === name && !M.statusFilter ? ' is-on' : ''}" data-c="${name}">${name}</button>`;
  }
  for (const s of ['想看', '在看', '已看'] as const) {
    html += `<button class="chip${M.statusFilter === s ? ' is-on' : ''}" data-s="${s}">${s}</button>`;
  }
  return html;
}

function renderMidnightMob(app: App, sec: HTMLElement): void {
  const list = getDisplayItems();
  const t = M.view === 'list' ? listTitle() : M.view === 'ai' ? 'AI 荐片' : '观影分析';
  const titleEl = sec.querySelector('.j-mtitle');
  const cntEl = sec.querySelector('.j-mcnt');
  if (titleEl) titleEl.textContent = t;
  if (cntEl) cntEl.textContent = M.view === 'list' ? `· ${list.length}` : '';
  const mv = sec.querySelector<HTMLElement>('.j-mview');
  if (mv) {
    if (M.view === 'list') {
      mv.className = 'm-scroll j-mview';
      mv.innerHTML = `<div class="m-grid">${list.map((it) => pcardHtml(it, app)).join('')}</div>`;
    } else if (M.view === 'ai') {
      mv.className = 'sp-body j-mview';
      mv.innerHTML = aiPageHtml(app);
    } else {
      mv.className = 'sp-body j-mview';
      mv.innerHTML = buildStatPageHtml();
    }
    attachLongPress(sec, app);
  }
  const chips = sec.querySelector('.j-chips');
  if (chips) chips.innerHTML = midnightChipsHtml();
}

// ---------- 搜索（防抖；desk 部分刷新保焦点 / mob 全刷+回焦） ----------

function onSearchInput(app: App, sec: HTMLElement, isMob: boolean, raw: string): void {
  if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
  M.searchDebounceTimer = setTimeout(() => {
    M.searchKeyword = raw.trim();
    M.view = 'list';
    if (isMob) {
      renderAll(app);
      const el = sec.querySelector('.j-mq') as HTMLInputElement | null;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    } else {
      refreshDeskList(app, sec);
    }
  }, 300);
}

/** 输入时只刷列表与计数（保焦点；空了整刷出空态，原型 refreshList 同语义） */
function refreshDeskList(app: App, sec: HTMLElement): void {
  const view = sec.querySelector('.j-view');
  if (!view) { renderAll(app); return; }
  const body = view.querySelector('.d-scroll');
  const head = view.querySelector('.d-head');
  const list = getDisplayItems();
  if (!body || !head || !list.length) { renderAll(app); return; }
  const cnt = head.querySelector('.j-cnt');
  if (cnt) cnt.textContent = `· ${list.length} 部`;
  const grid = body.querySelector('.grid');
  if (grid) grid.innerHTML = list.map((it) => pcardHtml(it, app)).join('');
  mountIcons(sec);
}

// ---------- 事件绑定（sec 级委托一次；重渲染内容全覆盖） ----------

function bindMidnight(sec: HTMLElement, app: App): void {
  sec.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // AI 页按钮（开始/重试/换一批/加入想看）先行分流（页内与共享弹窗内同享）
    const aiBtn = t.closest('[data-cinema-ai-start],[data-rec-add]') as HTMLElement | null;
    if (aiBtn) {
      if (aiBtn.hasAttribute('data-rec-add')) {
        if (aiBtn.hasAttribute('disabled')) return;
        const rec = M.aiResult?.[Number(aiBtn.dataset.recAdd)];
        if (rec) void quickAddWant(app, rec.title || rec.name || '', rec.type || '');
      } else {
        if (M.aiBase) void runSimilarRecommend(M.aiBase, app);
        else void runAIRecommend(app);
      }
      return;
    }
    const clear = t.closest('[data-cinema-clear]') as HTMLElement | null;
    if (clear) {
      M.typeFilter = null; M.statusFilter = null; M.searchKeyword = '';
      renderAll(app);
      return;
    }
    const tool = t.closest('.j-tool') as HTMLElement | null;
    if (tool && tool.dataset.tool) {
      M.view = M.view === tool.dataset.tool ? 'list' : (tool.dataset.tool as 'ai' | 'stat');
      renderAll(app);
      return;
    }
    const mb = t.closest('.j-mai,.j-mstat,.j-mgear,.j-mclose') as HTMLElement | null;
    if (mb) {
      if (mb.classList.contains('j-mgear')) openSet(sec, app);
      else if (mb.classList.contains('j-mclose')) closeOverlay();
      else {
        const v = mb.classList.contains('j-mai') ? 'ai' : 'stat';
        M.view = M.view === v ? 'list' : v; // 落域适配：再点回列表
        renderAll(app);
      }
      return;
    }
    const back = t.closest('.j-back') as HTMLElement | null;
    if (back) { M.view = 'list'; renderAll(app); return; }
    const railBtn = t.closest('[data-g],[data-s]') as HTMLElement | null;
    if (railBtn) {
      M.view = 'list';
      if (railBtn.dataset.g) {
        M.typeFilter = railBtn.dataset.g === '全部' ? null : railBtn.dataset.g;
        M.statusFilter = null;
      } else {
        const s = railBtn.dataset.s ?? null;
        M.statusFilter = M.statusFilter === s ? null : s;
      }
      renderAll(app);
      return;
    }
    const chip = t.closest('.chip') as HTMLElement | null;
    if (chip) {
      if (chip.dataset.c) {
        M.typeFilter = chip.dataset.c === 'all' ? null : chip.dataset.c;
        M.statusFilter = null;
      } else {
        const s = chip.dataset.s ?? null;
        M.statusFilter = M.statusFilter === s ? null : s;
      }
      renderAll(app);
      return;
    }
    const sortBtn = t.closest('.j-sort button') as HTMLElement | null;
    if (sortBtn && sortBtn.dataset.k) {
      M.sortMode = sortBtn.dataset.k as CinemaStateSort;
      renderAll(app);
      return;
    }
    const analysisAdd = t.closest('[data-cinema-analysis-add]') as HTMLElement | null;
    if (analysisAdd) { openForm(sec, null, app); return; }
    const add = t.closest('[data-cinema-add]') as HTMLElement | null;
    if (add) { openForm(sec, null, app); return; }
    const cardEl = t.closest('.pcard') as HTMLElement | null;
    if (cardEl) {
      const it = itemByKey(cardEl.dataset.cinemaKey);
      if (it) openDetail(sec, it, app);
    }
  });
  sec.addEventListener('contextmenu', (e) => {
    const cardEl = (e.target as HTMLElement).closest('.pcard') as HTMLElement | null;
    if (!cardEl) return;
    e.preventDefault();
    const it = itemByKey(cardEl.dataset.cinemaKey);
    if (!it) return;
    const h = sec.getBoundingClientRect();
    openMenu(sec, it, app, e.clientX - h.left + 4, e.clientY - h.top + 4);
  });
}

// ---------- 壳选择 / 创建 / 渲染总入口 ----------

export function createOverlay(app: App): void {
  const overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay';
  cinemaStyleOf(); // 风格单源（gazette/booth 延后，issue 236：本批仅午夜场上岸）
  const mobile = isMobileEnv();
  overlay.innerHTML = mobile ? midnightMobHtml() : midnightDeskHtml();

  document.body.appendChild(overlay);
  topifyZ(overlay); // ADR-0067：显示即发号（谁后显示谁在上）
  M.currentOverlay = overlay;
  M.renderFn = () => renderAll(app);
  const root = overlay.querySelector<HTMLElement>('[data-cinema-root]');
  if (!root) return;
  if (mobile) {
    applyMobileWindowFullscreen(root, (tryGetSettings() as Record<string, unknown>).cinemaMobileDefaultFullscreen === true);
  }
  // 点遮罩 = 关闭主面板（桌面；移动全屏无遮罩）
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });

  bindMidnight(root, app);
  // 搜索/滑杆输入（委托；input 冒泡）
  root.addEventListener('input', (e) => {
    const t = e.target as HTMLElement;
    if (t.classList.contains('j-q') || t.classList.contains('j-mq')) {
      onSearchInput(app, root, t.classList.contains('j-mq'), (t as HTMLInputElement).value);
    } else if (t.classList.contains('j-range')) {
      const out = root.querySelector('.j-rval');
      if (out) out.textContent = Number((t as HTMLInputElement).value).toFixed(1);
    }
  });

  rebuildItems(app);
  renderAll(app);
}

/** 渲染总入口：按面板根的风格/端分发（vault 自动刷新与 M.renderFn 都走这里） */
export function renderAll(app: App): void {
  const overlay = M.currentOverlay;
  if (!overlay) return;
  const root = overlay.querySelector<HTMLElement>('[data-cinema-root]');
  if (!root) return;
  if (root.classList.contains('mob')) renderMidnightMob(app, root);
  else renderMidnightDesk(app, root);
  mountIcons(root);
}

export function closeOverlay(): void {
  if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  M.renderFn = null;
  M.view = 'list'; // 复位视图：重开回落列表页
}

// ---------- ESC（主面板；弹窗层各自注册更高优先级） ----------

let mainEscRegistered = false;
export function registerEscapeHandler(): void {
  if (mainEscRegistered) return;
  mainEscRegistered = true;
  escManager.register('bz-cinema', {
    isVisible: () => !!M.currentOverlay,
    close: () => closeOverlay(),
  });
}

