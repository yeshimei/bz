/**
 * 影院（cinema）域 UI：风格化面板·行为层（issue 236 / ADR-0103）
 * markup 单源已迁 render 纯层（ADR-0104/0105）：共享件（详情/表单/菜单/抽屉/确认/AI/设置
 * 弹窗）在 shared.ts，午夜场 desk/mob 壳与渲染胶水在 layouts/midnight/——ui.ts 经域入口
 * render.ts 消费同一份（与原型壳 prototype-render.js 同源）。本文件只留：
 * 事件绑定 / core 服务（落盘、通知、域事件、ESC、全屏、图标物化）/ AI·分析·海报守护接线。
 * 三风格单键 cinemaStyle（清单 CINEMA_STYLES）；共享弹窗宿主为 display:contents 的
 * .bz-cinema--midnight 锚类容器。业务层零迁移：persistItem 落盘 / smartcat movie 域事件 /
 * AI 推荐 / 分析统计 / 海报守护全部原样。
 * 落域适配（ADR-0103 §5，原型不出）：移动头行补 ✕ 关闭钮；移动 ✦ 再点回列表。
 * 图标：lucide（纯层 data-lucide 占位 → mountIcons 统一 setIcon）；弹窗 ESC 走 escManager 层级。
 */
import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { notify, notice, notifySaveError } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { topifyZ } from '../core/dom';
import { tryGetSettings } from '../core/settings-provider';
import { mountIcons } from '../core/ui';
import {
  STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED, DEFAULT_RATING,
  getGroupForTag, type CinemaStyle,
} from './constants';
import { M, type CinemaItem, type CinemaSortMode } from './state';
import { rebuildItems, getDisplayItems } from './data';
import { localNow } from '../core/ui/str';
import { runAIRecommend, runSimilarRecommend, buildTasteProfile, quickAddWant } from './recommend';
import { buildAnalysisHTML } from './analysis';
import { watchPosterFetch } from './poster-watch';
import {
  ICON, statusText, itemByKey, doubanSearchUrl,
  detailModalHtml, confirmModalHtml, formModalHtml,
  aiPageHtml, actionRowsHtml, sheetHeadHtml, pcardHtml, type AiPageInput,
  midnightDeskHtml, midnightMobHtml, renderMidnightDesk, renderMidnightMob,
  type MidnightRenderInput,
} from './render';

// ---------- 小工具 ----------

/** 当前风格（设置 cinemaStyle；非法值回默认午夜场；重开面板生效。读设置属行为层，ADR-0104） */
function cinemaStyleOf(): CinemaStyle {
  const raw = (tryGetSettings() as Record<string, unknown>).cinemaStyle;
  return raw === 'gazette' || raw === 'booth' ? raw : 'midnight';
}

// ---------- 海报 ----------

/** 海报资源 URL（vault 资源路径）；无图返回 null（markup 侧只认 URL，资源解析留行为层） */
function posterUrl(item: CinemaItem, app: App): string | null {
  if (!item.poster) return null;
  const f = app.vault.getAbstractFileByPath(item.poster);
  if (f && f instanceof TFile && /\.(png|jpe?g|gif|webp)$/i.test(f.name)) {
    return app.vault.getResourcePath(f);
  }
  return null;
}

// ---------- 稳定键（CM3：file.path / new:name） ----------

function itemByKeyInState(key: string | undefined): CinemaItem | undefined {
  return itemByKey(M.items, key);
}

// ---------- 通用业务（菜单/抽屉动作、快速状态、豆瓣） ----------

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

/** 桌面右键菜单（.cn-menu；坐标相对面板根；动作行 markup 单源 actionRowsHtml） */
function openMenu(sec: HTMLElement, it: CinemaItem, app: App, x: number, y: number): void {
  closeMenus();
  const acts = itemActions(it, sec, app);
  const el = document.createElement('div');
  el.className = 'cn-menu';
  el.innerHTML = actionRowsHtml(acts, 'cn-menu-item');
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
  el.innerHTML = sheetHeadHtml(it, url) + actionRowsHtml(acts, 'cn-sheet-item');
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
      const it = itemByKeyInState(c.dataset.cinemaKey);
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
  const url = posterUrl(it, app);
  const { el, close } = ovl(sec, detailModalHtml(it, url));
  mountIcons(el);
  el.querySelector('.j-close')?.addEventListener('click', close);
  el.querySelector('.j-edit')?.addEventListener('click', () => { close(); openForm(sec, it, app); });
  el.querySelector('.j-del')?.addEventListener('click', () => { close(); openConfirm(sec, it, app); });
  el.querySelector('.j-similar')?.addEventListener('click', () => { close(); void runSimilarRecommend(it, app); });
}

// ---------- 弹窗：添加 / 编辑表单 ----------

function openForm(sec: HTMLElement, item: CinemaItem | null, app: App): void {
  const editing = !!item;
  const initTag = item ? item.typeTag : '电影';
  const initSt = item ? statusText(item.status) : '想看';
  const ratingVal = item && item.rating && item.rating > 0 ? item.rating : DEFAULT_RATING;
  const { el, close } = ovl(sec, formModalHtml({
    editing, name: item ? item.name : '', typeTag: initTag, stText: initSt,
    rating: ratingVal, review: item ? item.review ?? '' : '',
  }));
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
  const { el, close } = ovl(sec, confirmModalHtml(item), { sticky: true });
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

// ---------- 共享页：AI 荐片（画像行 + 页面状态快照 → 纯层 aiPageHtml） ----------

/** 偏好行（buildTasteProfile 真实画像；无数据回退「暂无」） */
function aiPrefLine(): string {
  const p = buildTasteProfile();
  const parts = [p.groups[0] || '', p.genres[0] || '', p.directors[0] || '', p.actors[0] || ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : '暂无';
}

function aiInput(): AiPageInput {
  return {
    running: M.aiRunning,
    waitMsg: M.aiWaitMsg,
    error: M.aiError,
    results: M.aiResult,
    pref: aiPrefLine(),
    inLibrary: (name: string) => M.items.some((it) => it.name === name),
  };
}

// ---------- 渲染（布局胶水入参装配；vault 自动刷新与 M.renderFn 都走 renderAll） ----------

function midnightInput(app: App): MidnightRenderInput {
  return {
    items: M.items,
    list: getDisplayItems(),
    view: {
      view: M.view,
      typeFilter: M.typeFilter,
      statusFilter: M.statusFilter,
      sortMode: M.sortMode,
      searchKeyword: M.searchKeyword,
    },
    cols: gridColumns(),
    title: listTitle(),
    watchedCount: watchedCount(),
    aiHtml: aiPageHtml(aiInput()),
    aiCount: M.aiResult && M.aiResult.length ? M.aiResult.length : null,
    statHtml: buildAnalysisHTML(),
    poster: (it) => posterUrl(it, app),
  };
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
  if (grid) grid.innerHTML = list.map((it) => pcardHtml(it, posterUrl(it, app))).join('');
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
    const mb = t.closest('.j-mai,.j-mstat,.j-mclose') as HTMLElement | null;
    if (mb) {
      if (mb.classList.contains('j-mclose')) closeOverlay();
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
      M.sortMode = sortBtn.dataset.k as CinemaSortMode;
      renderAll(app);
      return;
    }
    const add = t.closest('[data-cinema-analysis-add],[data-cinema-add]') as HTMLElement | null;
    if (add) { openForm(sec, null, app); return; }
    const cardEl = t.closest('.pcard') as HTMLElement | null;
    if (cardEl) {
      const it = itemByKeyInState(cardEl.dataset.cinemaKey);
      if (it) openDetail(sec, it, app);
    }
  });
  sec.addEventListener('contextmenu', (e) => {
    const cardEl = (e.target as HTMLElement).closest('.pcard') as HTMLElement | null;
    if (!cardEl) return;
    e.preventDefault();
    const it = itemByKeyInState(cardEl.dataset.cinemaKey);
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
  const inp = midnightInput(app);
  if (root.classList.contains('mob')) {
    renderMidnightMob(root, inp);
    attachLongPress(root, app); // m-grid 卡片重渲染重建后重挂（原 mob 渲染胶水同语义）
  } else renderMidnightDesk(root, inp);
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
