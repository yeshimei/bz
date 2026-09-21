/**
 * 影院（cinema）域 UI：风格化面板·行为层（issue 236 / ADR-0103）
 * markup 单源已迁 render 纯层（ADR-0104/0105）：共享件（详情/表单/菜单/抽屉/确认/AI/设置
 * 弹窗）在 shared.ts，午夜场 desk/mob 壳与渲染胶水在 layouts/midnight/——ui.ts 经域入口
 * render.ts 消费同一份（与原型壳 prototype-render.js 同源）。本文件只留：
 * 事件绑定 / core 服务（落盘、通知、域事件、ESC、全屏、图标物化）/ AI·分析·海报守护接线。
 * 三风格单键 = cinemaStyle 设置键（settings.ts，深审批A P3-17 措辞修正：无 CINEMA_STYLES
 * 清单常量，风格枚举即该设置键的合法值域）；共享弹窗宿主为 display:contents 的
 * .bz-cinema--midnight 锚类容器。业务层零迁移：persistItem 落盘 / smartcat movie 域事件 /
 * AI 推荐 / 分析统计 / 海报守护全部原样。
 * 落域适配（ADR-0103 §5，原型不出）：移动头行补 ✕ 关闭钮；移动 ✦ 再点回列表。
 * 图标：lucide（纯层 data-lucide 占位 → mountIcons 统一 setIcon）；弹窗 ESC 走 escManager 层级。
 */
import type { App, IconName } from 'obsidian';
import { TFile } from 'obsidian';
import { notice, notifySaveError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { emitDomainEvent } from '../core/domain-bus';
import { escManager, registerPanelEsc } from '../core/esc-manager';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { isMobileEnv } from '../core/mobile';
import { topifyZ, longPress } from '../core/dom';
import { openItemMenu, openItemSheet, closeItemMenu, resetItemMenuClickGuard, type ItemAction } from '../core/item-actions';
import { tryGetSettings } from '../core/settings-provider';
import { mountIcons } from '../core/ui';
import { openExternalUrl } from '../core/utils';
import { bindFormSubmit } from '../core/ui/modal';
import {
  STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED, DEFAULT_RATING,
  getGroupForTag, hasIllegalNameChar, ILLEGAL_NAME_HINT,
} from './constants';
import { M, type CinemaItem, type CinemaSortMode } from './state';
import { rebuildItems, getDisplayItems, normalizeTags } from './data';
import { localNow } from '../core/ui/str';
import { runAIRecommend, runSimilarRecommend, buildTasteProfile, quickAddWant } from './recommend';
import { buildAnalysisHTML } from './analysis';
import { enqueueDoubanFetch, dequeueDoubanFetch, isFetching, queryDoubanForPreview } from './douban-queue';
import { normalizeListValue, type DoubanQuery } from './douban-fetcher';
import { decideCinemaType } from './type-decide';
import {
  ICON, statusText, itemByKey, doubanSearchUrl,
  detailModalHtml, seriesDetailModalHtml, formModalHtml, formBackHtml,
  formTagChipHtml, formStChipHtml, type FormPreviewData,
  aiPageHtml, sheetHeadHtml, seriesSheetHeadHtml, cardHtml, facePiecesHtml, type AiPageInput,
  midnightDeskHtml, midnightMobHtml, renderMidnightDesk, renderMidnightMob,
  type MidnightRenderInput,
} from './render';
import { mergeSeasonCards, isSeriesKey, cardFace, type SeriesCard } from './seasons';

// ---------- 小工具 ----------

// ---------- 海报 ----------

/** 海报资源 URL（vault 资源路径）；无图返回 null（markup 侧只认 URL，资源解析留行为层）。
 *  白名单补齐 avif/bmp/svg（深审批A P3-12）——Obsidian 库内合法图片格式都能给到资源路径，
 *  真不支持的格式由 posterInner 的 onerror 兜底 */
function posterUrl(item: CinemaItem, app: App): string | null {
  if (!item.poster) return null;
  const f = app.vault.getAbstractFileByPath(item.poster);
  if (f && f instanceof TFile && /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(f.name)) {
    return app.vault.getResourcePath(f);
  }
  return null;
}

// ---------- 稳定键（CM3：file.path / new:name） ----------

function itemByKeyInState(key: string | undefined): CinemaItem | undefined {
  return itemByKey(M.items, key);
}

// ---------- 通用业务（菜单/抽屉动作、快速状态、豆瓣） ----------

/** 在豆瓣打开：有豆瓣链接走链接，否则走片名搜索页（openExternalUrl 单源：
 *  openUrl → electron shell → window.open 兜底链 + 全链失败人话提示；深审批A P3-9，
 *  私有裸 window.open + try/catch 退役） */
function openDouban(item: CinemaItem): void {
  const url = item.doubanUrl || doubanSearchUrl(item.name);
  openExternalUrl(M.appRef, url);
}

/** 快速标记状态（菜单/抽屉「标记在看」）：状态流转 + 刷新观影日期 + 域事件补发。
 *  「标记已看」已改走编辑窗（评分影评由用户在表单输入，saveEdit 落盘时补发同款域事件） */
async function markStatus(item: CinemaItem, target: '在看' | '已看', app: App): Promise<void> {
  const fromSt = item.status === STATUS_WANT ? 'want' : item.status === STATUS_WATCHING ? 'watching' : 'watched';
  const prevRating = item.rating && item.rating > 0 ? item.rating : null;
  // G7：先记快照，落盘失败回滚内存（saveEdit 同法）——否则面板显示与磁盘相反
  const prev = { status: item.status, rating: item.rating, watchDate: item.watchDate };
  item.status = target === '已看' ? STATUS_WATCHED : STATUS_WATCHING;
  if (target === '在看') {
    item.rating = 0;
  } else if (!prevRating) {
    item.rating = DEFAULT_RATING;
  }
  item.watchDate = localNow();
  try {
    await persistItem(item, app);
    notice(`已把「${item.name}」标记为${target}`, 'success');
    const toSt = target === '已看' ? 'watched' : 'watching';
    if (toSt !== fromSt) emitDomainEvent('movie', { kind: 'status', name: item.name, from: fromSt, to: toSt });
    if (item.rating !== null && item.rating > 0 && item.rating !== prevRating) {
      emitDomainEvent('movie', { kind: 'rated', name: item.name, fromRating: prevRating, toRating: item.rating });
    }
    renderAll(app);
  } catch (e) {
    Object.assign(item, prev);
    notifySaveError(e);
    console.error(e);
    renderAll(app);
  }
}

/** 菜单/抽屉动作列表（顺序即显示顺序） */
interface MenuAct { icon: string; label: string; danger?: boolean; run: () => void }
function itemActions(it: CinemaItem, sec: HTMLElement, app: App): MenuAct[] {
  const out: MenuAct[] = [{ icon: ICON.eye, label: '打开详情', run: () => openDetail(sec, it, app) }];
  if (it.status !== STATUS_WATCHING && it.status !== STATUS_WATCHED) {
    out.push({ icon: ICON.play, label: '标记在看', run: () => void markStatus(it, '在看', app) });
  }
  if (it.status !== STATUS_WATCHED) {
    // 标记已看不直改状态/评分：改走编辑窗预选「已看」，评分影评由用户确认后保存（memo item-1789105594322）
    out.push({ icon: 'check', label: '标记已看', run: () => openForm(sec, it, app, '已看') });
  }
  out.push(
    { icon: ICON.ai, label: '找同类', run: () => void runSimilarRecommend(it, app) },
    { icon: ICON.globe, label: '在豆瓣打开', run: () => openDouban(it) },
    { icon: ICON.edit, label: '编辑', run: () => openForm(sec, it, app) },
    { icon: ICON.del, label: '删除', danger: true, run: () => openConfirm(it, app) },
  );
  return out;
}

// ---------- 落盘（数据契约零改动） ----------

/**
 * 把条目落盘：新增建笔记，编辑/快速状态写 frontmatter（保留海报/豆瓣字段）；
 * 改名走 fileManager.renameFile（自动更新双链）；类型写入 frontmatter tags。
 */
async function persistItem(item: CinemaItem, app: App, edit?: { prevName: string; prevTag: string }, douban?: DoubanQuery | null): Promise<void> {
  if (!item.file) {
    const folder = M.folderPath;
    if (!app.vault.getAbstractFileByPath(folder)) {
      await app.vault.createFolder(folder);
    }
    const filePath = `${folder}/《${item.name}》.md`;
    // 建档模板只写最小安全集（无影评，深审批A P2-1）：影评值可多行/含「: 」「#」，
    // 裸值直拼模板会写破 YAML → 影片从面板黏性消失、豆瓣 sweep 永不补抓。
    // 影评在建档后与编辑路径同通道（processFrontMatter，Obsidian YAML 序列化兜底）写入。
    // 观影日期加双引号（深审批A P3-8）：裸日期被真机 YAML 解析成 timestamp（Moment 对象）
    // → 展示英文星期；评分/(tags 列表项) 是纯数字/固定枚举，无需引号。
    const content = `---\ntags:\n- ${item.typeTag}\n观影日期: "${item.watchDate || localNow()}"\n评分: ${item.rating ?? 0}\n海报: \n---\n`;
    const f = await app.vault.create(filePath, content);
    item.file = f;
    if (item.review || douban) {
      await app.fileManager.processFrontMatter(f, (fm: Record<string, unknown>) => {
        if (item.review) fm['影评'] = item.review;
        // 解析阶段已拿到豆瓣字段 → 建档时直接写入（issue 395）：省掉落盘后再抓一次的往返。
        // 口径与 fetchNoteDouban 一致（ApiZero 优先、rexxar 兜底、缺失才填由本处新檔天然满足）。
        if (douban) {
          const az = douban.apizero;
          if (douban.detailUrl) fm['豆瓣链接'] = douban.detailUrl;
          if (az) {
            if (az.score) fm['豆瓣评分'] = az.score;
            if (az.genre) fm['类型'] = normalizeListValue(az.genre);
            if (az.area) fm['制片国家/地区'] = normalizeListValue(az.area);
            if (az.duration) fm['片长'] = az.duration;
            if (az.year) fm['上映日期'] = az.year;
            if (az.shortComment) fm['热门短评'] = az.shortComment;
          }
          const director = az?.director ? normalizeListValue(az.director) : douban.celebrities?.directors ?? '';
          const actors = az?.actor ? normalizeListValue(az.actor) : douban.celebrities?.casts ?? '';
          if (director) fm['导演'] = director;
          if (actors) fm['主演'] = actors;
          if (douban.celebrities?.writers) fm['编剧'] = douban.celebrities.writers;
        }
      });
    }
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
      const tags = normalizeTags(fm['tags']);
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

/** 剧集按季合并（设置 cinemaMergeSeasons；缺省开）。渲染前实时读——设置面板一改即生效 */
export function mergeSeasonsOn(): boolean {
  return (tryGetSettings() as Record<string, unknown>).cinemaMergeSeasons === true;
}

/** 当前展示列表里的合并卡（点击分流用；与网格同一份入参，保证键能对上） */
function seriesCardByKey(key: string): SeriesCard | undefined {
  return mergeSeasonCards(getDisplayItems(), mergeSeasonsOn())
    .find((c): c is SeriesCard => c.kind === 'series' && c.key === key);
}

/**
 * 合并卡的手势（桌面右键菜单 / 移动长按抽屉）：**只有一条入口**——打开各季明细弹窗。
 * 卡片级没有具体条目可指，所以不放标记/编辑/删除这类**笔记级**动作（要动哪一条就进列表点它）；
 * 文案不用「各季列表」：合并卡里除了各季还可能挂着电影版 / 特别篇 / 外传，
 * 「查看全部」不带类型限定，与弹窗头部「共 N 季 · M 部电影」互补。
 */
function seriesAllAct(sec: HTMLElement, key: string, app: App): MenuAct {
  return { icon: 'layers', label: '查看全部', run: () => openSeriesDetail(sec, key, app) };
}

/** 卡片条目 → HTML（正脸季的海报与抓取态；网格与局部重刷共用一份口径） */
function cardEntryHtml(e: Parameters<typeof cardHtml>[0], app: App): string {
  const face = cardFace(e);
  return cardHtml(e, posterUrl(face, app), isFetching(face.file?.path));
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

/** 活跃弹窗层 close 句柄集（深审批A P3-10 双保险之一）：关面板时统一结算。
 *  ESC 层 id 固定 'bz-cinema-ovl' 交 escManager 同 id 清扫自愈（原递增 id 会随
 *  close 未走到的路径在层表里无限堆积）；这里再留 close 引用，closeOverlay 遍历
 *  补一刀 unregister，双路径都能把层表清干净。 */
const liveOvlCloses = new Set<() => void>();

/** 面板内弹窗层（.cn-ovl 挂共享宿主；ESC 走 escManager 层级，后注册先关） */
function ovl(sec: HTMLElement, html: string, opts: { sticky?: boolean } = {}): OvlHandle {
  const el = document.createElement('div');
  el.className = 'cn-ovl';
  el.innerHTML = html;
  ovHost(sec).appendChild(el);
  let close = () => {};
  const handle = escManager.register('bz-cinema-ovl', { isVisible: () => el.isConnected, close: () => close() });
  close = () => { handle.unregister(); liveOvlCloses.delete(close); el.remove(); };
  liveOvlCloses.add(close);
  el.addEventListener('click', (e) => { if (e.target === el && !opts.sticky) close(); });
  return { el, close };
}

// 面板内 toast 已收编 core notice 单源（一致审查#2）：不再自绘 .cn-toast——通知偏好
// （issue 297 级别/时长/位置）与类型图标语义全部生效，调 notice(msg, type) 直达。
// 各消费点：成功 completion → 'success'，校验拦截（空名/重名）→ 'warning'，失败 → 'error'。

// ---------- 弹窗：跟手菜单 / 长按抽屉（统一走 core/item-actions） ----------
//
// 手势与浮层实现全部交由共享层：桌面 contextmenu → core openItemMenu；移动端长按 →
// core/dom.longPress → core openItemSheet。防穿透（长按松手补发的合成 click 会命中刚
// 打开的遮罩把抽屉关掉，用户感知「长按没反应」）、下滑关闭、ESC、外部点击关闭、键盘导航
// 均由 core 承载；本域只传动作集与皮肤类（观感见 styles.css 的皮肤段）。

/** 浮层皮肤类（取色锚 cn-skin：core 浮层挂 body，不在面板树内，取不到午夜场调色板） */
const MENU_SKIN = 'cn-skin cn-menu-skin';
const SHEET_SKIN = 'cn-skin cn-sheet-skin';

/** 域动作 → core ItemAction（icon 为 lucide 名，与 ItemAction.icon 同源） */
function toItemActions(acts: MenuAct[]): ItemAction[] {
  return acts.map((a) => ({
    icon: a.icon as IconName,
    label: a.label,
    kind: a.danger ? 'danger' : undefined,
    onClick: a.run,
  }));
}

/** 动作包一层「先收弹窗再执行」：合并卡弹窗里的动作都要换层（钻详情 / 开表单 / 开确认），
 *  弹窗留着会压在新层上。菜单 ESC / 点外部关闭时弹窗仍在，用户可接着操作别的季。 */
function deferClose(acts: MenuAct[], close: () => void): MenuAct[] {
  return acts.map((a) => ({ ...a, run: () => { close(); a.run(); } }));
}

/** 抽屉头部 markup → 节点（core 侧要元素，markup 单源在 shared） */
function headElOf(html: string): HTMLElement {
  const box = document.createElement('div');
  box.innerHTML = html;
  return (box.firstElementChild as HTMLElement) ?? box;
}

/** 抽屉头部节点（海报 + 名称 + meta）：markup 单源 shared.sheetHeadHtml */
function sheetHeadEl(it: CinemaItem, url: string | null): HTMLElement {
  return headElOf(sheetHeadHtml(it, url));
}

/** 合并卡抽屉头部节点（剧名 + 共 N 季 · M 部电影）：markup 单源 shared.seriesSheetHeadHtml */
function seriesSheetHeadEl(card: SeriesCard, url: string | null): HTMLElement {
  return headElOf(seriesSheetHeadHtml(card, url));
}

/** 悬浮换脸前的静息态快照（卡片元素 → 四件 innerHTML）。合并卡正脸口径与单季不同
 *  （名字是归一名称、评分取最新已评季），复原必须回快照、不能靠重算。
 *  卡片每次重渲染都是新元素，旧键自然被 GC → WeakMap 不积残留。 */
const faceStash = new WeakMap<HTMLElement, string[]>();

/** 正脸四件挂点（海报内芯 / 名字 / meta / 星级）；缺一即不换（如非合并卡） */
function faceSlots(card: HTMLElement): HTMLElement[] {
  return (['pw-face', 'pname', 'pmeta', 'pstars'] as const)
    .map((c) => card.querySelector<HTMLElement>(`.${c}`)).filter((x): x is HTMLElement => !!x);
}

/** 悬浮季圆点：把卡片正脸换成该季的海报 + 名字/meta/星级（格式走 shared.facePiecesHtml 单源） */
function peekSeasonDot(dot: HTMLElement, app: App): void {
  const card = dot.closest<HTMLElement>('.pcard');
  const it = itemByKeyInState(dot.dataset.cinemaSeasonKey);
  const slots = card ? faceSlots(card) : [];
  if (!card || !it || slots.length !== 4) return;
  if (!faceStash.has(card)) faceStash.set(card, slots.map((s) => s.innerHTML));
  const p = facePiecesHtml(it, posterUrl(it, app));
  slots[0].innerHTML = p.poster;
  slots[1].innerHTML = p.name;
  slots[2].innerHTML = p.meta;
  slots[3].innerHTML = p.stars;
  card.classList.add('is-peek');
}

/** 离开圆点：正脸复原为静息态（快照回填） */
function restFace(dot: HTMLElement): void {
  const card = dot.closest<HTMLElement>('.pcard');
  const snap = card ? faceStash.get(card) : undefined;
  if (!card || !snap) return;
  const slots = faceSlots(card);
  if (slots.length !== 4) return;
  slots.forEach((s, i) => { s.innerHTML = snap[i]; });
  card.classList.remove('is-peek');
}

/** 移动端长按 → 底部抽屉（手势 core/dom.longPress；卡片每次重渲染重建后重挂）。
 *  合并卡（剧集按季合并）长按只出「查看全部」一条（同桌面右键口径）；左键点击也是它。 */
function attachLongPress(sec: HTMLElement, app: App): void {
  sec.querySelectorAll<HTMLElement>('.m-grid .pcard').forEach((c) => {
    // 原生长按菜单（保存图片/复制链接）让位给抽屉
    c.addEventListener('contextmenu', (ev) => ev.preventDefault());
    longPress(c, () => {
      const key = c.dataset.cinemaKey;
      if (isSeriesKey(key)) {
        const card = seriesCardByKey(key as string);
        if (card) openSheet(sec, seriesSheetTarget(card, sec, app));
        return;
      }
      const it = itemByKeyInState(key);
      if (!it) return;
      openSheet(sec, itemSheetTarget(it, sec, app));
    });
  });
}

/** 抽屉目标：动作集 + 头部节点（单条目 / 合并卡两种来源，禁在调用处各拼一套） */
interface SheetTarget { acts: MenuAct[]; head: HTMLElement }

/** 单条目抽屉目标：该条目的单条动作 + 该条目信息 */
function itemSheetTarget(it: CinemaItem, sec: HTMLElement, app: App): SheetTarget {
  return { acts: itemActions(it, sec, app), head: sheetHeadEl(it, posterUrl(it, app)) };
}

/** 合并卡抽屉目标：只有「查看全部」一条 + 剧名（正脸季海报）+ 共 N 季 · M 部电影 */
function seriesSheetTarget(card: SeriesCard, sec: HTMLElement, app: App): SheetTarget {
  return { acts: [seriesAllAct(sec, card.key, app)], head: seriesSheetHeadEl(card, posterUrl(card.face, app)) };
}

/** 移动端抽屉：core openItemSheet（遮罩 + 底部滑入 + 头部信息 + 动作行，皮肤保午夜场观感）
 *  @param preFire 动作执行前先跑（各季明细弹窗里长按出的抽屉：点动作时先把弹窗收掉，
 *                  否则弹窗压在新层上） */
function openSheet(sec: HTMLElement, target: SheetTarget, preFire?: () => void): void {
  if (!sec.isConnected) return;
  openItemSheet(toItemActions(preFire ? deferClose(target.acts, preFire) : target.acts), {
    sheetClass: SHEET_SKIN,
    sheetHead: target.head,
  });
}

// ---------- 弹窗：详情 ----------

function openDetail(sec: HTMLElement, it: CinemaItem, app: App): void {
  const url = posterUrl(it, app);
  const { el, close } = ovl(sec, detailModalHtml(it, url));
  mountIcons(el);
  el.querySelector('.j-edit')?.addEventListener('click', () => { close(); openForm(sec, it, app); });
  el.querySelector('.j-del')?.addEventListener('click', () => { close(); openConfirm(it, app); });
  el.querySelector('.j-similar')?.addEventListener('click', () => { close(); void runSimilarRecommend(it, app); });
  // 热门短评展开/收起（纯层对超阈值长评打 .is-fold 收 3 行；短评无按钮）
  const foldBtn = el.querySelector<HTMLElement>('[data-dm-fold]');
  const quote = el.querySelector<HTMLElement>('[data-dm-quote]');
  if (foldBtn && quote) {
    const foldText = foldBtn.textContent ?? '展开全文';
    foldBtn.addEventListener('click', () => {
      foldBtn.textContent = quote.classList.toggle('is-fold') ? foldText : '收起';
    });
  }
}

/**
 * 合并卡详情：头部 + 各季明细行 + 特别篇行（2026-09-20 用户拍板：行上补手势，
 * 桌面右键出**该行**的跟手菜单、移动长按出底部抽屉；行点击仍是钻入该行详情）。
 * 入口 = 左键点卡片 / 卡片浮层的「查看全部」；卡片级不落笔记级动作，行级才有落点。
 *
 * 坑位（都踩过）：
 * - 行内条目**触发时现取**，不在绑定时闭包捕获：面板重刷后条目对象会换，旧引用指向陈货；
 * - 桌面右键后必须 `resetItemMenuClickGuard()`：Chromium 右键时序（mousedown → contextmenu →
 *   mouseup 落在菜单外）会置位残余 click 抑制，吞掉用户下一次左键（菜单项要点两次才生效）；
 * - 长按回调里**不关弹窗**：`longPress` 靠元素级捕获吞长按后的合成 click，元素一旦被移除，
 *   合成 click 落到 document 层 → 被 item-actions 的「外部点击关闭」分支当成外部点击，
 *   抽屉开出即关（正是真机「长按没反应」那个回归）；
 * - 动作一律「先收弹窗再执行」（见 deferClose）。
 */
function openSeriesDetail(sec: HTMLElement, key: string, app: App): void {
  const card = seriesCardByKey(key);
  if (!card) return;
  // mobile 只管长按手势挂载（维持移动壳现状）；右键菜单分流不走壳类，见行内 hoverCapable 注
  const mobile = sec.classList.contains('mob');
  const { el, close } = ovl(sec, seriesDetailModalHtml(card, (it) => posterUrl(it, app)));
  mountIcons(el);
  const rowItem = (row: HTMLElement): CinemaItem | undefined => itemByKeyInState(row.dataset.cinemaSeasonKey);
  el.querySelectorAll<HTMLElement>('.s-row').forEach((row) => {
    row.addEventListener('click', () => {
      const it = rowItem(row);
      if (!it) return;
      close();
      openDetail(sec, it, app);
    });
    // 拦原生右键菜单：桌面换成跟手菜单；移动端只为挡「保存图片 / 复制链接」（触屏长按会同时发它）。
    // 跟手菜单走 hoverCapable（sec 级 contextmenu 同一出口）：壳类近似「桌面=有鼠标」会让
    // 桌面宽度的触屏长按误弹鼠标菜单
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const it = rowItem(row);
      if (!it || !hoverCapable()) return;
      openItemMenu(e.clientX, e.clientY, toItemActions(deferClose(itemActions(it, sec, app), close)), true, MENU_SKIN);
      resetItemMenuClickGuard();
    });
    if (mobile) {
      longPress(row, () => {
        const it = rowItem(row);
        if (it) openSheet(sec, itemSheetTarget(it, sec, app), close); // 弹窗不关（见上），点抽屉动作时再收
      });
    }
  });
}

/**
 * 随机抽一部（命令 bz-cinema-random-pick，2026-09-11 首页入口菜单）：
 * 从「想看」池随机挑一部并**直接开详情**（选择困难时的出口）；想看池空则退到全量并说明，
 * 免得点了没反应。面板未打开则先冷开面板再叠详情弹窗（与「影视分析报告」同一打开口径）。
 */
export function openRandomMovie(app: App): void {
  rebuildItems(app);
  const want = M.items.filter((it) => it.status === STATUS_WANT);
  const pool = want.length ? want : M.items;
  if (!pool.length) {
    notice('影院里还没有片子可抽');
    return;
  }
  const it = pool[Math.floor(Math.random() * pool.length)];
  if (!M.currentOverlay) createOverlay(app);
  // C（补扫 cinema P3）：面板已开时先整刷（pickRandomCinema 已把 M.view 回落 list，样板同
  // openCinemaAnalysis 的「已开则 renderAll」分支）——否则详情弹窗叠在旧 ai/stat 页上，状态与画面错位
  else renderAll(app);
  const root = M.currentOverlay?.querySelector<HTMLElement>('[data-cinema-root]');
  if (!root) return;
  openDetail(root, it, app);
  notice(want.length ? `抽到「${it.name}」` : `想看清单空着，从全部影视里抽到「${it.name}」`, 'success');
}

// ---------- 弹窗：添加 / 编辑表单 ----------

/** 重名文案单源（issue 394）：按钮态用短句，拦截 notice 用完整句 */
const DUP_NAME_HINT = '已存在同名影视';
const DUP_NAME_HINT_FULL = `${DUP_NAME_HINT}，请换个名称`;

/** 重名判据单源（issue 394）：新增时比对全库、编辑时排除自身原名。
 *  保存拦截、输入框红边框、保存按钮禁用三处共用同一判据——各写一份必然漂移。 */
function isDuplicateName(name: string, selfName?: string): boolean {
  return name !== (selfName ?? '') && M.items.some((x) => x.name === name);
}

/** 添加/编辑表单弹窗。presetSt：预选状态（中文口径，如「已看」）——「标记已看」入口传入，
 *  状态 chip 预选、评分滑杆（预填当前评分，无则默认分）与影评框自动展开；弹窗本身不落盘，保存才生效 */
function openForm(sec: HTMLElement, item: CinemaItem | null, app: App, presetSt?: string): void {
  const editing = !!item;
  const initTag = item ? item.typeTag : '电影';
  const initSt = presetSt ?? (item ? statusText(item.status) : '想看');
  const ratingVal = item && item.rating && item.rating > 0 ? item.rating : DEFAULT_RATING;
  const { el, close } = ovl(sec, formModalHtml({
    editing, name: item ? item.name : '', typeTag: initTag, stText: initSt,
    rating: ratingVal, review: item ? item.review ?? '' : '',
  }));
  mountIcons(el);
  // 新增态是双面卡片：遮罩层多留上下留白并允许滚动（垂直居中由 .cn-modal--flip 的 margin:auto 负责，
  // 两种居中手段并存是为了背面比视口高时仍能从头滚起——见 styles.css 那段注释）
  if (!editing) el.classList.add('cn-ovl--flip');
  const cur = { tag: initTag, st: initSt };

  // 表单阶段（issue 395）：新增 = 双面卡片「正面（名称+状态）→ 解析 → 背面（全部信息）→ 保存」；
  // 编辑 = 单面到底（已有笔记不必重解析）。
  let phase: 'idle' | 'parsing' | 'parsed' = editing ? 'parsed' : 'idle';
  /** 翻面之后分类仍在判定（2026-09-21 拆两段：豆瓣信息到手即翻面，分类随后补）。
   *  此间徽标是占位骨架、保存按钮锁着——分类没落定就保存，等于把这个值当默认值用。 */
  let classifying = false;
  let parsed: DoubanQuery | null = null;
  let userPickedTag = false; // 2026-09-21 拍板：用户手点过 chip → 解析出的分类不覆盖他的选择
  const nameInput = el.querySelector<HTMLInputElement>('.j-name');
  const parseBtn = el.querySelector<HTMLButtonElement>('.j-parse');
  const saveBtn = el.querySelector<HTMLButtonElement>('.j-save');
  const flipEl = el.querySelector<HTMLElement>('.j-flip');
  const backSlot = el.querySelector<HTMLElement>('.j-back');

  /** 表单态唯一刷新点：正面按钮文案与禁用、输入框红边框、chip 流动特效都在这。
   *  重名反馈（issue 394）与解析态（issue 395）共用同一个按钮，散着改 class 必然漂移。 */
  const refreshFormState = (): void => {
    const name = nameInput?.value.trim() ?? '';
    const dup = !!name && isDuplicateName(name, item?.name);
    if (nameInput) nameInput.classList.toggle('is-dup', dup);
    if (parseBtn) {
      const busy = phase === 'parsing';
      parseBtn.disabled = dup || busy;
      parseBtn.classList.toggle('is-parsing', busy);
      // 文案写在子节点上：直接赋 textContent 会把转圈那个 span 一起抹掉
      const txt = parseBtn.querySelector('.j-parse-text');
      if (txt) txt.textContent = dup ? DUP_NAME_HINT : busy ? '解析中' : '解析';
    }
    // 背面「保存」与编辑态「保存」是同一个按钮：重名同样锁死（issue 394 的行为不能因双面改造丢掉）。
    // 解析中与分类判定中都锁住（2026-09-21）：分类未落定就保存，可能把那时的占位/默认值当结果用。
    if (saveBtn) {
      saveBtn.disabled = dup || phase === 'parsing' || classifying;
      saveBtn.textContent = dup ? DUP_NAME_HINT : '保存';
    }
    // 解析中：全部分类 chip 的边框走流光（2026-09-21 用户点名）
    el.querySelectorAll('[data-f-tag]').forEach((x) => x.classList.toggle('is-scanning', phase === 'parsing'));
  };

  /** 分类 chip 选中态（手点与解析预选共用，别各写一份 toggle） */
  const applyTagOn = (): void => {
    el.querySelectorAll<HTMLElement>('[data-f-tag]').forEach((b) => b.classList.toggle('is-on', b.dataset.fTag === cur.tag));
  };

  /** 状态 chip 选中态 + 「我的记录」段显隐（正反两面都有状态 chip，用 querySelectorAll 全覆盖） */
  const applyStOn = (): void => {
    el.querySelectorAll<HTMLElement>('[data-f-st]').forEach((b) => b.classList.toggle('is-on', b.dataset.fSt === cur.st));
    const show = cur.st === '已看';
    el.querySelectorAll<HTMLElement>('.j-rating').forEach((x) => { x.style.display = show ? '' : 'none'; });
    el.querySelectorAll<HTMLElement>('.j-review').forEach((x) => { x.style.display = show ? '' : 'none'; });
  };

  /** 翻到背面（新增态只有单向：正面 → 解析 → 背面；2026-09-21 去掉「返回」后没有反向路径）。
   *
   *  **高度不在这层管**：两面用 grid 叠在同一格，容器高度自动取较高那一面（见 styles.css）——
   *  于是翻转全程高度零变化，没有重排可卡。此前是「量高 + height 过渡 + ResizeObserver 持续同步」，
   *  每帧重排整个弹窗，是「翻转时卡顿一下」的根因（2026-09-21 定位并移除）。
   *
   *  旋转只由 keyframes 描述（中段 translateZ 抬起的弧线，两端式过渡做不出来）。
   *  起手前先强制一次布局：把 renderBack 插入整卡 + 海报解码的排版开销结在动画之前，
   *  否则动画首帧要同时做「插入 + 重排 + 合成」，表现为起手一顿。 */
  const flipToBack = (): void => {
    if (!flipEl) return;
    void flipEl.offsetHeight;
    const start = (): void => {
      if (!el.isConnected) return; // 动画起手前弹窗已被关掉（用户手快）
      flipEl.classList.add('is-flipped', 'is-flipping');
      const clear = (): void => flipEl.classList.remove('is-flipping');
      flipEl.addEventListener('animationend', clear, { once: true });
      window.setTimeout(clear, 1200); // 兜底清理：动画被系统关掉时 animationend 不触发
    };
    // 推到下一帧起手（jsdom 无 rAF 时退回定时器，测试不必区分两种环境）
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(start);
    else window.setTimeout(start, 16);
  };

  /** 预览卡数据：字段口径与落盘一致（ApiZero 优先、rexxar 兜底） */
  const previewDataOf = (q: DoubanQuery | null): FormPreviewData | null => {
    if (!q) return null;
    const az = q.apizero;
    return {
      posterUrl: q.posterUrl,
      title: q.title || nameInput?.value.trim() || '',
      typeTag: cur.tag,
      genre: az?.genre ? normalizeListValue(az.genre) : '',
      director: az?.director ? normalizeListValue(az.director) : q.celebrities?.directors ?? '',
      actors: az?.actor ? normalizeListValue(az.actor) : q.celebrities?.casts ?? '',
      region: az?.area ? normalizeListValue(az.area) : '',
      releaseDate: az?.year ?? '',
      duration: az?.duration ?? '',
      doubanRating: az?.score ?? '',
      doubanUrl: q.detailUrl,
      hotComment: az?.shortComment ?? '',
    };
  };

  /** 解析（2026-09-21 拆两段）：
   *  ① 豆瓣信息到手 → **立刻翻面**（不等信息全齐才让用户看到卡）
   *  ② 海报与分类随后补——海报交给 img 自己加载（骨架 → 淡入），分类等 Jev 回来就地填。
   *  判定失败或弃权都不阻断解析：字段已经到手，分类留空、由用户手点。 */
  async function runParse(): Promise<void> {
    const name = nameInput?.value.trim() ?? '';
    if (!name) { notice('请输入名称', 'warning'); return; }
    if (hasIllegalNameChar(name)) { notice(`${ILLEGAL_NAME_HINT}，请修改`, 'error'); return; }
    phase = 'parsing';
    refreshFormState();
    const q = await queryDoubanForPreview(app, name);
    if (!q.ok) {
      phase = 'idle';
      refreshFormState();
      notice(
        q.reason === 'blocked' ? '豆瓣搜索被风控，稍后再试'
          : q.reason === 'notfound' ? '豆瓣没有找到这部影视'
            : '网络不畅，未能获取豆瓣信息',
        'warning',
      );
      return;
    }
    parsed = q.data;
    // ① 字段到手即翻面：分类先占位（骨架），海报由 img 加载完自行淡入
    phase = 'parsed';
    classifying = true;
    renderBack();
    flipToBack();
    refreshFormState();
    // ② 分类随后补：就地换徽标，不重渲染整卡（重渲染会让海报 img 重新发起请求、白闪一下）
    try {
      const az = q.data.apizero;
      const mediaType = q.data.celebrities?.mediaType ?? null;
      const decided = await decideCinemaType({
        title: q.data.title,
        isTv: az ? az.isTv : mediaType ? mediaType === 'tv' : null,
        area: az?.area ?? null,
        genre: az?.genre ?? null,
        year: az?.year ?? null,
      });
      if (decided && !userPickedTag) cur.tag = decided;
    } catch { /* 判定通道不可用不阻断解析：字段已到手，分类由用户手点 */ }
    classifying = false;
    updateBadges();
    refreshFormState();
  }

  /** 背面渲染：与详情弹窗同形制；分类 / 状态是有下拉的徽标（无「我的记录」段） */
  function renderBack(): void {
    if (!backSlot) return;
    backSlot.innerHTML = formBackHtml(previewDataOf(parsed), { typeTag: cur.tag, stText: cur.st, classifying });
    applyTagOn();
    applyStOn();
  }

  /** 收起两个候选下拉（徽标切换、选完都要收）。
   *  走 .is-open 类而非 hidden 属性：hidden 是瞬切、没有中间态，展开会「啪」地弹出来。 */
  const closePickLists = (): void => {
    el.querySelectorAll<HTMLElement>('[data-pick-list]').forEach((l) => l.classList.remove('is-open'));
  };

  /** 两个徽标就地重渲（分类回来、用户改选时用）。
   *  为什么不 renderBack()：整卡重渲染会重建海报 <img>，图片重新加载 → 白闪一下。
   *  为什么不逐个改文本：徽标颜色 / 选中态 / 占位骨架的切换都跟着值走，重渲这两个节点最省心。
   *  背面尚未渲染时（正面点状态）row 取不到，但下面两行仍要跑——正面状态 chip 靠 applyStOn 上选中态。 */
  const updateBadges = (): void => {
    const row = backSlot?.querySelector<HTMLElement>('.dm-badges');
    if (row) row.innerHTML = formTagChipHtml(cur.tag) + formStChipHtml(cur.st);
    applyTagOn();
    applyStOn();
  };

  nameInput?.addEventListener('input', refreshFormState);
  refreshFormState();
  applyStOn();
  // 分类/状态走事件委托（绑 el，不绑具体按钮）：背面是 innerHTML 动态生成的，逐个绑定必然漏一半；
  // 两面共用同一份 cur，点哪一面都同步（issue 395）
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // 背面徽标 → 展开候选下拉（先全收再开目标；同键再点即收起）
    const pick = t.closest<HTMLElement>('[data-pick]');
    if (pick) {
      const key = pick.dataset.pick;
      const target = el.querySelector<HTMLElement>(`[data-pick-list="${key}"]`);
      const willOpen = !!target && !target.classList.contains('is-open');
      closePickLists();
      if (target && willOpen) target.classList.add('is-open');
      return;
    }
    // 选中候选项 → 收回下拉 + 就地换徽标。正面状态 chip 也走这里（同一份 cur，两面同步）
    const tagBtn = t.closest<HTMLElement>('[data-f-tag]');
    if (tagBtn) {
      cur.tag = tagBtn.dataset.fTag ?? cur.tag;
      userPickedTag = true;
      closePickLists();
      updateBadges();
      return;
    }
    const stBtn = t.closest<HTMLElement>('[data-f-st]');
    if (stBtn) {
      cur.st = stBtn.dataset.fSt ?? cur.st;
      closePickLists();
      updateBadges();
    }
  });
  // 表单 Enter 提交（深审批A P3-13）：core bindFormSubmit——名称框纯 Enter 直存，
  // 影评 textarea 回车换行天然豁免；Ctrl/⌘+Enter 恒提交。
  // 双面卡片（issue 395）：正面 Enter = 解析、背面 Enter = 保存，按当前阶段分流。
  bindFormSubmit(el, () => {
    if (phase === 'idle' && !editing) { void runParse(); return; }
    (el.querySelector('.j-save') as HTMLElement | null)?.click();
  });
  // 桌面端打开即聚焦名称框（呈报#7 / C2，2026-09-19 拍板改口径：省一次点击）；
  // 移动端维持不聚焦——弹窗即弹软键盘遮挡表单（core settings-modal「移动端跳过 input 聚焦」同款口径）
  if (!isMobileEnv()) (el.querySelector('.j-name') as HTMLInputElement | null)?.focus();
  parseBtn?.addEventListener('click', () => { void runParse(); });
  el.querySelector('.j-save')?.addEventListener('click', () => {
    if (phase === 'parsing' || classifying) return; // 防御：解析/判定中不落盘（disabled 已挡一层）
    const name = (el.querySelector('.j-name') as HTMLInputElement).value.trim();
    if (!name) { notice('请输入名称', 'warning'); return; }
    if (isDuplicateName(name, item?.name)) { notice(DUP_NAME_HINT_FULL, 'warning'); return; }
    const stChanged = !editing || !item || item.status !== (cur.st === '想看' ? STATUS_WANT : cur.st === '在看' ? STATUS_WATCHING : STATUS_WATCHED);
    const date = stChanged ? localNow() : (item!.watchDate || localNow());
    // 想看编码 -1（评分推断状态的既有合法值，AI「＋想看」quickAddWant 同口径）：
    // 若给 null 会在 persistItem 被 `?? 0` 兜底成 0 → 落盘重解析判为在看，编辑/新增想看当场弹回。
    // 新增态背面已去掉评分滑杆（2026-09-21 拍板去掉「我的记录」段）→ 已看给默认分，
    // 编辑态仍有滑杆，照旧读框。
    const ratingBox = el.querySelector<HTMLInputElement>('.j-range');
    const rating = cur.st === '已看'
      ? (ratingBox ? parseFloat(ratingBox.value) : DEFAULT_RATING)
      : cur.st === '在看' ? 0 : -1;
    // 非「已看」态保留原影评不写空（深审批A P2-2）：影评框在非已看态隐藏，原实现在这里
    // 强置空串 + persistItem `delete fm['影评']`——「已看」影片改回想看/在看保存，影评被静默清空。
    // 影评只在「已看」态的输入框里被用户显式改写/清空（空串保存 = 显式删除，语义保留）。
    // 新增态背面无影评框（同上）→ 走编辑态分支留原值 / 空串。
    const reviewBox = el.querySelector<HTMLTextAreaElement>('.j-review-t');
    const review = reviewBox ? reviewBox.value.trim() : (editing && item ? item.review ?? '' : '');
    if (editing && item) {
      void saveEdit(item, { name, tag: cur.tag, st: cur.st, rating, date, review }, app, close);
    } else {
      void saveNew({ name, tag: cur.tag, st: cur.st, rating, date, review, douban: parsed }, app, close);
    }
  });
}

interface FormPayload { name: string; tag: string; st: string; rating: number | null; date: string; review: string; /** 解析阶段拿到的豆瓣字段（issue 395）：建档时一并写入，省掉落盘后重抓 */ douban?: DoubanQuery | null }

/** 新增落盘（CM2：重名/落盘失败回退；created 域事件 + 抓取队列接管） */
async function saveNew(p: FormPayload, app: App, close: () => void): Promise<void> {
  // 非法字符校验（深审批A P3-7）：原只有编辑改名把关，新增建档裸放行——名称进文件名
  // 《X》.md，含 / : 等直接建档失败或被 Obsidian 改名出「未识别文件」
  if (hasIllegalNameChar(p.name)) {
    notice(`${ILLEGAL_NAME_HINT}，请修改`, 'error');
    return;
  }
  const group = getGroupForTag(p.tag) ?? '其他';
  const st = p.st === '想看' ? STATUS_WANT : p.st === '在看' ? STATUS_WATCHING : STATUS_WATCHED;
  const it: CinemaItem = { file: null, name: p.name, typeTag: p.tag, group, status: st, rating: p.rating, watchDate: p.date, review: p.review, poster: null, genre: null, director: null, actors: null, region: null, year: null, releaseDate: null, doubanRating: null, doubanUrl: null, synopsis: null, duration: null, seasonText: null, hotComment: null };
  try {
    if (app.vault.getAbstractFileByPath(`${M.folderPath}/《${p.name}》.md`)) {
      notice(DUP_NAME_HINT_FULL, 'warning');
      return;
    }
    M.items.unshift(it);
    await persistItem(it, app, undefined, p.douban);
    emitDomainEvent('movie', { kind: 'created', name: p.name, status: st === STATUS_WANT ? 'want' : st === STATUS_WATCHING ? 'watching' : 'watched', rating: p.rating, review: p.review || null });
    if (it.file) enqueueDoubanFetch(it.file, it.name);
    close();
    notice(`已添加「${p.name}」`, 'success');
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

/** 编辑落盘：改名前置校验（非法字符/重名拦截）→ persistItem（rename + frontmatter tags）→ 域事件补发 */
async function saveEdit(item: CinemaItem, p: FormPayload, app: App, close: () => void): Promise<void> {
  const group = getGroupForTag(p.tag) ?? '其他';
  const st = p.st === '想看' ? STATUS_WANT : p.st === '在看' ? STATUS_WATCHING : STATUS_WATCHED;
  // G7 快照回滚 + P3-11（深审批A）：filePath 单独记字符串——真机 renameFile 原地更新同一
  // TFile 引用，比较对象路径（item.file === prev.file）永远相等，半失败检测必须走路径快照
  const prev = { name: item.name, typeTag: item.typeTag, group: item.group, status: item.status, rating: item.rating, watchDate: item.watchDate, review: item.review, file: item.file, filePath: item.file?.path ?? null };
  if (p.name !== item.name) {
    if (hasIllegalNameChar(p.name)) {
      notice(`${ILLEGAL_NAME_HINT}，请修改`, 'error');
      return;
    }
    if (app.vault.getAbstractFileByPath(`${M.folderPath}/《${p.name}》.md`)) {
      notice(DUP_NAME_HINT_FULL, 'warning');
      return;
    }
  }
  item.name = p.name; item.typeTag = p.tag; item.group = group;
  item.status = st; item.rating = p.rating; item.watchDate = p.date; item.review = p.review;
  try {
    await persistItem(item, app, { prevName: prev.name, prevTag: prev.typeTag });
    // 域事件补发（与快速标记 markStatus 同口径）：状态流转 + 评分变化 → 小橘行为流；
    // 「标记已看」改走本函数后由这里承接原 markStatus 的事件语义
    const fromSt = prev.status === STATUS_WANT ? 'want' : prev.status === STATUS_WATCHING ? 'watching' : 'watched';
    if (st !== prev.status) {
      const toSt = st === STATUS_WANT ? 'want' : st === STATUS_WATCHING ? 'watching' : 'watched';
      emitDomainEvent('movie', { kind: 'status', name: item.name, from: fromSt, to: toSt });
    }
    const prevRating = prev.rating && prev.rating > 0 ? prev.rating : null;
    if (item.rating !== null && item.rating > 0 && item.rating !== prevRating) {
      emitDomainEvent('movie', { kind: 'rated', name: item.name, fromRating: prevRating, toRating: item.rating });
    }
    // 影评写/改/删补发 review 域事件（深审批A P2-3）：契约（smartcat/movie-source.ts）与
    // 文案层（movieReviewText）三方俱在唯缺 emitter。prev→new 无变化不发（改状态不改影评时零噪音）
    const prevReview = prev.review || null;
    const toReview = item.review || null;
    if (prevReview !== toReview) {
      emitDomainEvent('movie', { kind: 'review', name: item.name, fromReview: prevReview, toReview });
    }
    close();
    notice(`已保存「${p.name}」`, 'success');
    renderAll(app);
  } catch (e) {
    // 改名半失败回滚（深审批A P3-11）：renameFile 已成功、后续 processFrontMatter 失败 →
    // 文件留在新路径而内存其余字段回旧值的不一致态。先尝试 renameFile 回旧路径；
    // 回滚再失败 console 留痕 + renderAll 兜底（面板至少重刷到当前真实状态）
    if (item.file && prev.filePath && item.file.path !== prev.filePath) {
      try {
        await app.fileManager.renameFile(item.file, prev.filePath);
      } catch (re) {
        console.error('回滚影视笔记改名失败:', re);
        renderAll(app);
      }
    }
    Object.assign(item, prev);
    notifySaveError(e);
    console.error(e);
  }
}

// ---------- 弹窗：删除确认（一致审查#1 收编 core/flow-dialog：全域最后一个自绘确认框退役） ----------

/**
 * 删除确认：走 core openFlowDialog（role=dialog/aria-modal、ESC/遮罩取消、焦点管理、
 * danger 中性形制——焦点反落取消钮，回车不再直通删除）。皮肤类见 styles.css 的
 * `#__shared_confirm_popup__.bz-cinema-flow-dialog` 映射段。
 */
function openConfirm(item: CinemaItem, app: App): void {
  void openFlowDialog({
    title: '删除影视',
    // message 经 core escapeHtml（片名注入防护），\n 渲染为 <br> 分行
    message: `确定删除「${item.name}」吗？\n将移入系统回收站，可在回收站恢复`,
    // 流程框挂 document.body、不在面板树内：cn-skin 取午夜场调色板（菜单/抽屉皮肤同一通道），
    // bz-cinema-flow-dialog = 本域确认框专属类；删除是危险主动作 → core 另挂 bz-flow-dialog--danger
    className: 'cn-skin bz-cinema-flow-dialog',
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'ok', cta: true, danger: true },
    ],
  }).then(async (v) => {
    if (v !== 'ok') return;
    if (item.file) {
      try {
        await app.vault.trash(item.file, true);
      } catch (e) {
        console.error('删除影视笔记失败:', e);
        notice('删除失败：文件可能被占用，请重试', 'error');
        return;
      }
      // G8：删除成功即出队豆瓣抓取——未开始的移出队列、在抓的不再记失败
      // （否则十几秒后弹「以下影片获取失败：《已删的片》」且「重启后会自动重试」文案不实）
      dequeueDoubanFetch(item.file.path);
    }
    const idx = M.items.indexOf(item);
    if (idx > -1) M.items.splice(idx, 1);
    emitDomainEvent('movie', { kind: 'deleted', name: item.name });
    notice(`已删除「${item.name}」`, 'success');
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
  const merge = mergeSeasonsOn();
  // 惰性构建（深审批A P3-14）：list 页不预算 AI 页与分析页两份大字符串——分析页是
  // 19 板块全量统计，而列表页每次标记/筛选/搜索整刷都走这里，两份大 HTML 恒算纯浪费；
  // list 视图的渲染胶水不读这两个字段，真进 ai/stat 页才构建
  const onList = M.view === 'list';
  return {
    allCards: mergeSeasonCards(M.items, merge),
    cards: mergeSeasonCards(getDisplayItems(), merge),
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
    aiHtml: onList ? '' : aiPageHtml(aiInput()),
    aiCount: M.aiResult && M.aiResult.length ? M.aiResult.length : null,
    statHtml: onList ? '' : buildAnalysisHTML(),
    poster: (it) => posterUrl(it, app),
    fetching: (it) => isFetching(it.file?.path),
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

/** 清搜索词（搜索框 ESC 二段清词出口，深审批A P2-5）：清 M.searchKeyword + 取消防抖 +
 *  刷新 + 焦点回框光标在尾（与 onSearchInput 的 mob 回焦样板同款；清词语义与
 *  data-cinema-clear 出口的清词段一致——只清词不动类型/状态筛选） */
function clearSearchKeyword(app: App, sec: HTMLElement, isMob: boolean): void {
  if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
  M.searchDebounceTimer = null;
  M.searchKeyword = '';
  renderAll(app);
  const el = sec.querySelector(isMob ? '.j-mq' : '.j-q') as HTMLInputElement | null;
  if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

/** 输入时只刷列表与计数（保焦点；空了整刷出空态，原型 refreshList 同语义） */
function refreshDeskList(app: App, sec: HTMLElement): void {
  const view = sec.querySelector('.j-view');
  if (!view) { renderAll(app); return; }
  const body = view.querySelector('.d-scroll');
  const head = view.querySelector('.d-head');
  const list = getDisplayItems();
  if (!body || !head || !list.length) {
    renderAll(app);
    // 空态整刷重建了工具行（深审批A P2-4）：焦点跨过空态落到 body，用户接着输入无效——
    // 对 .j-q 补回焦 + 光标到尾（mob 回焦样板同款）
    const el = sec.querySelector('.j-q') as HTMLInputElement | null;
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    return;
  }
  const cards = mergeSeasonCards(list, mergeSeasonsOn());
  const cnt = head.querySelector('.j-cnt');
  if (cnt) cnt.textContent = `· ${cards.length} 部`;
  const grid = body.querySelector('.grid');
  if (grid) grid.innerHTML = cards.map((e) => cardEntryHtml(e, app)).join('');
  mountIcons(sec);
}

// ---------- 事件绑定（sec 级委托一次；重渲染内容全覆盖） ----------

/** 鼠标惯用件（悬浮 + 精指针）能力单判（gameshelf/ui.ts hoverCapable 同口径：'(hover: hover)
 *  and (pointer: fine)'）：消费方一，季圆点悬浮换脸——触屏 tap 会发 mouseover 却不发
 *  mouseout，换脸会滞留；消费方二，桌面右键菜单分流——触屏长按会同时发 pointerdown 与
 *  contextmenu，按壳类近似「桌面=有鼠标」会让桌面宽度的触屏误弹鼠标菜单。core 尚无此口径
 *  单源，与 gameshelf 各持一份（跨域提取涉两域，待收口批上提，不在本批白名单内动）。
 *  测试/评审壳经 bindMidnight 第三参显式开（jsdom 无真 hover 能力，默认关）。 */
function hoverCapable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

function bindMidnight(sec: HTMLElement, app: App, hoverable = hoverCapable()): void {
  // 季圆点悬浮预览（悬浮能力判定——hover 是鼠标惯用件，触屏 tap 会发 mouseover 却不发
  // mouseout，换脸会滞留；旧按 .mob 壳近似「桌面=有鼠标」，桌面宽度的触屏（宽壳 + 无悬浮
  // 能力）仍会粘脸，现与范式批 CSS @media (hover: hover) 全域口径对齐）。sec 级委托：网格
  // 每次重渲染都换新卡片元素，逐个绑定会漏绑/泄漏。
  // 呈报#14（C3）：圆点本体 6px，悬浮换脸经常点不中。外观一点不动（2026-09-18 拍板），
  // 只放宽**委托目标**做等效热区——衬底/间隙也计入命中，落点不在圆点上时取几何最近的一枚
  // （core .bz-touch-target 的 ::after 外扩范式是 pointer:coarse 档，圆点换脸是桌面 hover
  // 主路径且外扩圆会盖住相邻圆点造成误换季，故走「委托改容器最近圆点匹配」这一路）。
  const nearestSeasonDot = (target: EventTarget | null, e: MouseEvent): HTMLElement | null => {
    const el = target as HTMLElement | null;
    const box = el?.closest?.('.season-dots');
    if (!box) return null;
    const direct = el!.closest('.season-dots i') as HTMLElement | null;
    if (direct) return direct;
    let best: HTMLElement | null = null;
    let bestDist = Infinity;
    box.querySelectorAll<HTMLElement>('i').forEach((d) => {
      const r = d.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    });
    return best;
  };
  let peekedDot: HTMLElement | null = null; // 当前换脸中的圆点：同点不重刷（防 mousemove 反复重写 innerHTML 闪图）
  const peekNearest = (e: MouseEvent): void => {
    const dot = nearestSeasonDot(e.target, e);
    if (dot === peekedDot) return;
    if (dot) peekSeasonDot(dot, app);
    else if (peekedDot) restFace(peekedDot);
    peekedDot = dot;
  };
  if (hoverable) {
    sec.addEventListener('mouseover', peekNearest);
    sec.addEventListener('mousemove', peekNearest); // 衬底/间隙内滑行不换元素也跟进最近圆点
    sec.addEventListener('mouseout', (e) => {
      // 还在圆点容器内（圆点↔圆点、圆点↔衬底）交给 mouseover/mousemove 换脸，不打回静息态
      const to = e.relatedTarget as HTMLElement | null;
      if (to?.closest?.('.season-dots')) return;
      if (peekedDot) {
        restFace(peekedDot);
        peekedDot = null;
      }
    });
  }
  // 深审批 B #4：卡片键盘可达——.pcard 已带 tabindex=0/role=button（shared.cardHtml），
  // 聚焦后 Enter/Space 开详情（与 click 分支同一落点分流；对齐 review 域不可达卡整改范式）。
  // sec 级委托同 click：网格每次重渲染换新元素，逐卡绑定会漏绑/泄漏。
  sec.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const cardEl = (e.target as HTMLElement | null)?.closest?.('.pcard[data-cinema-key]') as HTMLElement | null;
    if (!cardEl) return;
    e.preventDefault(); // Space 兼作翻页键：开详情时吞掉滚动
    const key = cardEl.dataset.cinemaKey;
    // 合并卡（剧集按季合并）：点开各季明细；其余走单条目详情（click 分支同构）
    if (isSeriesKey(key)) openSeriesDetail(sec, key as string, app);
    else {
      const it = itemByKeyInState(key);
      if (it) openDetail(sec, it, app);
    }
  });
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
      // 进 ai/stat 不动筛选状态：rail 高亮由渲染层按视图熄灭（render.ts listOn 门控），
      // 返回列表时先前选中的筛选高亮原样恢复
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
      M.view = 'list'; // chips 属列表视图：在 AI/分析页点 chips 必须回落列表（否则筛选生效但页面停在原视图，看着像「点了没反应」）
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
      const key = cardEl.dataset.cinemaKey;
      // 合并卡（剧集按季合并）：点开各季明细；其余走单条目详情
      if (isSeriesKey(key)) openSeriesDetail(sec, key as string, app);
      else {
        const it = itemByKeyInState(key);
        if (it) openDetail(sec, it, app);
      }
    }
  });
  sec.addEventListener('contextmenu', (e) => {
    // 右键菜单是鼠标惯用件，分流走 hoverCapable（与季圆点悬浮同一出口，不再按 .mob 壳近似
    // 「桌面=有鼠标」——桌面宽度的触屏长按会同时发 pointerdown 与 contextmenu，不分流就会
    // 多弹一个鼠标菜单盖在抽屉上）；移动端长按手势走 core/dom.longPress。
    if (!hoverCapable()) return;
    const cardEl = (e.target as HTMLElement).closest('.pcard') as HTMLElement | null;
    if (!cardEl) return;
    e.preventDefault();
    const key = cardEl.dataset.cinemaKey;
    // 合并卡（剧集按季合并）：右键与普通卡同款浮层，但只有「查看全部」一条（2026-09-20 用户拍板）
    if (isSeriesKey(key)) {
      openItemMenu(e.clientX, e.clientY, toItemActions([seriesAllAct(sec, key as string, app)]), true, MENU_SKIN);
      resetItemMenuClickGuard();
      return;
    }
    const it = itemByKeyInState(key);
    if (!it) return;
    // core 跟手菜单（防溢出定位/ESC/外部点击关闭/键盘导航由共享层承载）
    openItemMenu(e.clientX, e.clientY, toItemActions(itemActions(it, sec, app)), true, MENU_SKIN);
    // 右键时序会置位残余 click 抑制（Chromium：mousedown → contextmenu → mouseup 落在菜单外），
    // 吞掉下一次左键（菜单项要点两次才生效）；右键无补发 click，直调后立即复位
    resetItemMenuClickGuard();
  });
}

// ---------- 壳选择 / 创建 / 渲染总入口 ----------

export function createOverlay(app: App): void {
  const overlay = document.createElement('div');
  overlay.className = 'bz-panel-overlay';
  const mobile = isMobileEnv();
  overlay.innerHTML = mobile ? midnightMobHtml() : midnightDeskHtml();

  document.body.appendChild(overlay);
  topifyZ(overlay); // ADR-0067：显示即发号（谁后显示谁在上）
  M.currentOverlay = overlay;
  // 后台刷新（豆瓣补抓落盘 / vault 事件 / AI 流程）走 renderSoft：打字期间顺延，不抢焦点
  M.renderFn = () => renderSoft(app);
  const root = overlay.querySelector<HTMLElement>('[data-cinema-root]');
  if (!root) return;
  // 打开即入焦 + Tab 圈闭（呈报#13 F3+H3 全域范式，core trapPanelFocus 单源）
  trapPanelFocus(root);
  // 点遮罩 = 关闭主面板（桌面；移动全屏无遮罩）
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });

  bindMidnight(root, app);
  // 搜索/滑杆输入（委托；input 冒泡）
  root.addEventListener('input', (e) => {
    M.lastInputAt = Date.now(); // 打字心跳：renderSoft 据此让路（含中文输入法组合期）
    const t = e.target as HTMLElement;
    if (t.classList.contains('j-q') || t.classList.contains('j-mq')) {
      onSearchInput(app, root, t.classList.contains('j-mq'), (t as HTMLInputElement).value);
    } else if (t.classList.contains('j-range')) {
      const out = root.querySelector('.j-rval');
      if (out) out.textContent = Number((t as HTMLInputElement).value).toFixed(1);
    }
  });
  // 搜索框 ESC 二段清词（深审批A P2-5，委托挂 root——搜索框随整刷重建，逐个绑会漏）：
  // 有词时第一段 ESC 只清词（clearSearchKeyword），preventDefault + stopImmediatePropagation
  // 阻断冒泡到 escManager 的关层链；无词放行——ESC 关弹窗/面板语义不变
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented) return;
    const t = e.target as HTMLElement;
    if (!(t.classList.contains('j-q') || t.classList.contains('j-mq'))) return;
    if (!M.searchKeyword) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    clearSearchKeyword(app, root, t.classList.contains('j-mq'));
  });

  rebuildItems(app);
  renderAll(app);
}

// ---------- 输入守护（打字不被整刷打断） ----------
//
// 起因：desk 的搜索框在 .j-view 内，renderAll 重写 .j-view 会连搜索框一起换血 →
// 焦点丢失、未满防抖（300ms）的键入被渲染回退成旧 value；打开面板时 sweepDoubanFetch
// 把缺海报/缺豆瓣链接的条目全入队，补抓每完成一条就整刷两次，于是「打几个字就失焦」。
// 两层处理：
// 1) 后台刷新走 renderSoft：打字静默期内顺延，等手停了再补刷；
// 2) 任何整刷（含用户主动触发的）都过焦点守护：快照文本输入的标识/值/选区，渲染后原样落回。

/** 打字静默期判定（ms）：距上次键入小于此值视为还在打字 */
const TYPING_GUARD_MS = 400;
/** 顺延渲染的补刷延迟（ms）：手停后多久补一次后台刷新 */
const SOFT_RENDER_DELAY_MS = 400;

let softRenderTimer: ReturnType<typeof setTimeout> | null = null;

/** 文本输入判定（排除滑杆/勾选等不支持选区的输入类型） */
function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  return !/^(range|checkbox|radio|button|submit|reset|file|color|image)$/i.test(el.type);
}

/** 稳定选择器（tag + 全量 class）——渲染后按同一标识找回同名输入框 */
function focusSelector(el: HTMLElement): string | null {
  const cls = Array.from(el.classList).filter((c) => /^[A-Za-z][\w-]*$/.test(c));
  return cls.length ? `${el.tagName.toLowerCase()}.${cls.join('.')}` : null;
}

interface FocusSnap { sel: string; value: string; start: number | null; end: number | null }

/** 渲染前快照：焦点在面板文本输入内才记；value 必记（防抖前的键入不能丢） */
function snapshotFocus(root: HTMLElement): FocusSnap | null {
  const el = document.activeElement;
  if (!isTextField(el) || !root.contains(el)) return null;
  const sel = focusSelector(el);
  if (!sel) return null;
  let start: number | null = null;
  let end: number | null = null;
  try { start = el.selectionStart; end = el.selectionEnd; } catch { /* number/email 等不支持选区 */ }
  return { sel, value: el.value, start, end };
}

/** 渲染后落回：value 不同才回写（免打断输入法组合），再恢复焦点与光标位置 */
function restoreFocus(root: HTMLElement, snap: FocusSnap | null): void {
  if (!snap) return;
  const el = root.querySelector(snap.sel);
  if (!isTextField(el)) return; // 视图切换后目标输入框不存在（如切到 AI 页）：不抢焦点
  if (el.value !== snap.value) el.value = snap.value;
  el.focus();
  if (snap.start !== null && snap.end !== null) {
    try { el.setSelectionRange(snap.start, snap.end); } catch { /* 同上 */ }
  }
}

/** 面板内是否还在打字（焦点在文本输入 + 距上次键入未过静默期） */
function isTyping(root: HTMLElement): boolean {
  if (!M.lastInputAt || Date.now() - M.lastInputAt >= TYPING_GUARD_MS) return false;
  return isTextField(document.activeElement) && root.contains(document.activeElement);
}

function clearSoftRender(): void {
  if (softRenderTimer) { clearTimeout(softRenderTimer); softRenderTimer = null; }
}

/**
 * 后台刷新入口（M.renderFn / vault 自动刷新）：打字期间顺延，手停后补刷一次。
 * 用户主动触发的渲染（点筛选、保存、搜索防抖）一律走 renderAll 立即渲染，不延后。
 */
export function renderSoft(app: App): void {
  const overlay = M.currentOverlay;
  if (!overlay) return;
  const root = overlay.querySelector<HTMLElement>('[data-cinema-root]');
  if (!root) return;
  if (isTyping(root)) {
    if (softRenderTimer) clearTimeout(softRenderTimer);
    softRenderTimer = setTimeout(() => { softRenderTimer = null; renderAll(app); }, SOFT_RENDER_DELAY_MS);
    return;
  }
  renderAll(app);
}

/** 渲染总入口：按面板根的风格/端分发（vault 自动刷新与 M.renderFn 都走这里） */
export function renderAll(app: App): void {
  const overlay = M.currentOverlay;
  if (!overlay) return;
  const root = overlay.querySelector<HTMLElement>('[data-cinema-root]');
  if (!root) return;
  clearSoftRender(); // 已排期的顺延渲染作废，本次渲染已覆盖
  const snap = snapshotFocus(root);
  // 滚位记忆（深审批A P2-6）：渲染整写 innerHTML 销毁滚动容器——标记/保存/筛选/队列完成
  // 全跳顶。渲染前存 .d-scroll/.m-scroll 的 scrollTop、渲染后原值恢复（clipbook 会话内
  // 滚位记忆同范式；视图切换时滚动容器换型，恢复自然 no-op）
  const scrollMemo = new Map<string, number>();
  for (const sel of ['.d-scroll', '.m-scroll']) {
    const sc = root.querySelector(sel) as HTMLElement | null;
    if (sc) scrollMemo.set(sel, sc.scrollTop);
  }
  const inp = midnightInput(app);
  if (root.classList.contains('mob')) {
    renderMidnightMob(root, inp);
    attachLongPress(root, app); // m-grid 卡片重渲染重建后重挂（原 mob 渲染胶水同语义）
  } else renderMidnightDesk(root, inp);
  for (const [sel, top] of scrollMemo) {
    const sc = root.querySelector(sel) as HTMLElement | null;
    if (sc) sc.scrollTop = top;
  }
  mountIcons(root);
  restoreFocus(root, snap);
}

export function closeOverlay(): void {
  clearSoftRender(); // 面板已关：顺延渲染不再补，免留下野定时器
  if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
  // 活跃弹窗层统一结算（深审批A P3-10 双保险之二）：closeOverlay 原来只移除面板树，
  // 弹窗层（详情/表单/各季明细）的 ESC 句柄靠 el.isConnected 判死不主动注销——层表残留
  // 堆积。这里遍历句柄补 unregister（close 幂等：句柄集先删后 remove，遍历副本安全）
  for (const close of [...liveOvlCloses]) close();
  closeItemMenu(); // 浮层（跟手菜单/抽屉）挂 body，不随面板移除 → 关面板时一并收掉
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  M.renderFn = null;
  M.view = 'list'; // 复位视图：重开回落列表页
}

// ---------- ESC（主面板；弹窗层各自注册更高优先级） ----------

export function registerEscapeHandler(): void {
  registerPanelEsc('bz-cinema', () => !!M.currentOverlay, () => closeOverlay());
}
