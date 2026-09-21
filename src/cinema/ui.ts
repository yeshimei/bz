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
import { mountIcons, openLightbox } from '../core/ui';
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
import { enqueueDoubanFetch, dequeueDoubanFetch, isFetching, queryDoubanForPreview, downloadPreviewPoster } from './douban-queue';
import { normalizeListValue, insertPosterEmbed, type DoubanQuery } from './douban-fetcher';
import { decideCinemaType } from './type-decide';
import {
  ICON, statusText, itemByKey, doubanSearchUrl, itemKey,
  detailModalHtml, seriesDetailModalHtml, formModalHtml, formBackHtml,
  formTagChipHtml, formStChipHtml, type FormPreviewData,
  aiPageHtml, sheetHeadHtml, seriesSheetHeadHtml, cardHtml, facePiecesHtml, starsHtml, starsLit, type AiPageInput,
  midnightDeskHtml, midnightMobHtml, renderMidnightDesk, renderMidnightMob,
  type MidnightRenderInput,
} from './render';
import { mergeSeasonCards, isSeriesKey, cardFace, type SeriesCard } from './seasons';
import { MOTION, EASE, STAGGER } from './motion';

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
    markCardFlash(itemKey(item), item.rating !== prevRating); // 流转的因果看得见（issue 403）
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
async function persistItem(item: CinemaItem, app: App, edit?: { prevName: string; prevTag: string }, douban?: DoubanQuery | null, posterRel?: string | null): Promise<void> {
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
    let content = `---\ntags:\n- ${item.typeTag}\n观影日期: "${item.watchDate || localNow()}"\n评分: ${item.rating ?? 0}\n海报: \n---\n`;
    // 海报已落库（issue 397：保存时下载进库）→ 正文 embed 与抓取路径同款插入，
    // 免得「建档即齐」的笔记比队列抓过的少一张图（insertPosterEmbed 单源）
    if (posterRel) content = insertPosterEmbed(content, posterRel);
    const f = await app.vault.create(filePath, content);
    item.file = f;
    if (item.review || douban || posterRel) {
      await app.fileManager.processFrontMatter(f, (fm: Record<string, unknown>) => {
        if (posterRel) fm['海报'] = posterRel;
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

interface OvlHandle { el: HTMLDivElement; close: (o?: { skipReturn?: boolean }) => void }

/** 活跃弹窗层 close 句柄集（深审批A P3-10 双保险之一）：关面板时统一结算。
 *  ESC 层 id 固定 'bz-cinema-ovl' 交 escManager 同 id 清扫自愈（原递增 id 会随
 *  close 未走到的路径在层表里无限堆积）；这里再留 close 引用，closeOverlay 遍历
 *  补一刀 unregister，双路径都能把层表清干净。 */
const liveOvlCloses = new Set<() => void>();

/** 面板内弹窗层（.cn-ovl 挂共享宿主；ESC 走 escManager 层级，后注册先关）。
 *  opts.onWillClose：关闭接管协议（issue 396 共享元素过渡用）——返回 true 表示动效接管本次
 *  关闭，真正的移除由动效结束自行调用 finish()；返回 false/缺省则立即移除。ESC、点遮罩、
 *  显式 close() 三条路径都汇到这里，动效不会漏接。close({skipReturn:true}) 供「关了马上开
 *  下一个弹窗」的路径跳过返程动效（编辑/删除/找同类——叠两段过渡只会互相打架）。 */
function ovl(sec: HTMLElement, html: string, opts: { sticky?: boolean; onWillClose?: (finish: () => void) => boolean } = {}): OvlHandle {
  const el = document.createElement('div');
  el.className = 'cn-ovl';
  el.innerHTML = html;
  ovHost(sec).appendChild(el);
  let close: (o?: { skipReturn?: boolean }) => void = () => {};
  const finish = (): void => { handle.unregister(); liveOvlCloses.delete(close); el.remove(); };
  const handle = escManager.register('bz-cinema-ovl', { isVisible: () => el.isConnected, close: () => close() });
  close = (o) => {
    if (!o?.skipReturn && opts.onWillClose?.(finish)) return;
    finish();
  };
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

/** 涟漪原点（.pw 盒内坐标）+ 罩满整盒所需半径（圆点到最远角的距离） */
interface RippleOrigin { x: number; y: number; r: number }

/** 悬浮换脸的静息态快照 + 在飞的涟漪（卡片元素 → 状态）。合并卡正脸口径与单季不同
 *  （名字是归一名称、评分取最新已评季），复原必须回快照、不能靠重算。
 *  卡片每次重渲染都是新元素，旧键自然被 GC → WeakMap 不积残留。
 *  `gen` 是收尾令牌：折回的 finished 回调与兜底定时器都按它判「我这一轮还算不算数」——
 *  折回途中鼠标又落回圆点时，新一轮涟漪把 gen 顶掉，旧的收尾必须自己作废
 *  （否则会 remove 掉新一轮正在用的来片层）。 */
interface PeekState {
  snap: string[];
  anim: Animation | null;
  origin: RippleOrigin | null;
  gen: number;
}
const peekStates = new WeakMap<HTMLElement, PeekState>();

/** 涟漪时长（2026-09-21 用户拍板方案 A「涟漪揭示」：来片从**被悬浮的那枚圆点**扩散开）。
 *  与 396 共享元素、滑动高亮同一口径：**刻意不做 prefers-reduced-motion 分支**——
 *  用户本人系统即报 reduce，而这条动效正是他点名要的，降级/放缓等于替他改决定。 */
const PEEK_MS = MOTION.base;      // 来片从圆点扩散开（台账「揭示」档）
const PEEK_BACK_MS = MOTION.move; // 折回圆点（台账「空间位移」档）

/** 正脸四件挂点（海报内芯 / 名字 / meta / 星级）；缺一即不换（如非合并卡） */
function faceSlots(card: HTMLElement): HTMLElement[] {
  return (['pw-face', 'pname', 'pmeta', 'pstars'] as const)
    .map((c) => card.querySelector<HTMLElement>(`.${c}`)).filter((x): x is HTMLElement => !!x);
}

/** 涟漪原点：圆点中心 → .pw 盒内坐标。涟漪起点跟着圆点走——位置本身编码季号 */
function rippleOrigin(pw: HTMLElement, dot: HTMLElement): RippleOrigin {
  const pr = pw.getBoundingClientRect();
  const dr = dot.getBoundingClientRect();
  const x = dr.left + dr.width / 2 - pr.left;
  const y = dr.top + dr.height / 2 - pr.top;
  return { x, y, r: Math.hypot(Math.max(x, pr.width - x), Math.max(y, pr.height - y)) };
}

/** 来片层：正脸之上的一张覆盖层。**不加 z-index**——.pw 内的绘制序靠 DOM 顺序，
 *  插在 .pw-face 紧后就天然压在正脸上、又垫在角标/季圆点/抓取遮罩之下。 */
function peekLayer(pw: HTMLElement): HTMLElement {
  let layer = pw.querySelector<HTMLElement>('.pw-in');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'pw-in';
    pw.querySelector('.pw-face')?.after(layer);
  }
  return layer;
}

/** 文案三件（名字/meta/星级）淡入：给「换脸了」多一层明确信号 */
function peekTextFade(els: HTMLElement[]): void {
  els.forEach((el, i) => {
    try {
      el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: MOTION.move, delay: i * STAGGER, easing: EASE.out, fill: 'backwards' });
    } catch { /* 动画不可用（jsdom/老宿主）：文案已在终态 */ }
  });
}

/** 悬浮季圆点：来片层从被悬浮的那枚圆点涟漪扩散 + 文案三件淡入（格式走 shared.facePiecesHtml 单源） */
function peekSeasonDot(dot: HTMLElement, app: App): void {
  const card = dot.closest<HTMLElement>('.pcard');
  const pw = card?.querySelector<HTMLElement>('.pw');
  const it = itemByKeyInState(dot.dataset.cinemaSeasonKey);
  const slots = card ? faceSlots(card) : [];
  if (!card || !pw || !it || slots.length !== 4) return;
  let st = peekStates.get(card);
  if (!st) {
    st = { snap: slots.map((s) => s.innerHTML), anim: null, origin: null, gen: 0 };
    peekStates.set(card, st);
  }
  st.gen++;
  const layer = peekLayer(pw);
  // 打断（鼠标在圆点间滑行）：来片层还在 → 先把「刚才那一季」冻结成正脸。
  // 不冻结的话，新涟漪之外露出的会是静息态那一季，划过圆点时会闪回（同点已由调用方拦掉）。
  if (layer.firstChild) slots[0].innerHTML = layer.innerHTML;
  st.anim?.cancel();
  st.anim = null;
  const o = rippleOrigin(pw, dot);
  st.origin = o;
  // 底衬先写「已铺满」的终态：动画不可用（jsdom/老宿主）时停在「这一季已铺满」而不是空盒
  layer.style.clipPath = `circle(${o.r.toFixed(1)}px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)`;
  const p = facePiecesHtml(it, posterUrl(it, app));
  layer.innerHTML = p.poster;
  slots[1].innerHTML = p.name;
  slots[2].innerHTML = p.meta;
  slots[3].innerHTML = p.stars;
  peekTextFade(slots.slice(1));
  card.classList.add('is-peek');
  try {
    st.anim = layer.animate(
      [{ clipPath: `circle(0px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)` },
        { clipPath: `circle(${o.r.toFixed(1)}px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)` }],
      { duration: PEEK_MS, easing: EASE.out, fill: 'forwards' },
    );
  } catch { /* 动画不可用：底衬已是终态 */ }
}

/** 离开圆点：涟漪折回圆点 → 清来片层 → 正脸/文案按快照回填 */
function restFace(dot: HTMLElement): void {
  const card = dot.closest<HTMLElement>('.pcard');
  const st = card ? peekStates.get(card) : undefined;
  if (!card || !st) return;
  const layer = card.querySelector<HTMLElement>('.pw-in');
  card.classList.remove('is-peek');
  const gen = ++st.gen;
  const done = (): void => {
    if (st.gen !== gen) return; // 已被新一轮涟漪接管（本轮折回被 cancel）→ 收尾作废
    st.anim = null;
    layer?.remove();
    const slots = faceSlots(card);
    if (slots.length !== 4) return;
    slots.forEach((s, i) => { s.innerHTML = st.snap[i]; });
    peekTextFade(slots.slice(1));
  };
  if (!layer || !st.origin) { done(); return; }
  const o = st.origin;
  st.anim?.cancel();
  st.anim = null;
  try {
    // 从**当前帧**折回（可能还在扩散途中），不是从满圆重来
    const fold = layer.animate(
      [{ clipPath: getComputedStyle(layer).clipPath }, { clipPath: `circle(0px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)` }],
      { duration: PEEK_BACK_MS, easing: EASE.out },
    );
    st.anim = fold;
    fold.finished.then(done).catch(done);
  } catch {
    done(); // 动画不可用：立即收尾
    return;
  }
  window.setTimeout(done, PEEK_BACK_MS + 400); // 兜底：动画事件丢失也必须收尾（同 396 handOver）
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

/** @param opts.from 过渡来源（网格卡 / 合集弹窗里的季行）；缺省按键反查网格卡
 *  @param opts.borrow 抽离口径，缺省 'card'（整卡抽离）；合集行钻入传 'image'（只借图，列表不动） */
function openDetail(sec: HTMLElement, it: CinemaItem, app: App, opts: { from?: HTMLElement | null; borrow?: Borrow } = {}): void {
  const url = posterUrl(it, app);
  // 共享元素过渡（issue 396）：来源卡 = 调用方显式给的（点卡片 / 键盘激活 / 合集行）；
  // 缺省按键反查——菜单与抽屉动作手里只有条目没有卡元素，反查到同一张卡即可，飞行起点不会飘。
  const from = opts.from ?? sec.querySelector<HTMLElement>(`.pcard[data-cinema-key="${CSS.escape(itemKey(it))}"]`);
  const se = from ? createSharedFlight() : null;
  const { el, close } = ovl(sec, detailModalHtml(it, url), { onWillClose: se?.willClose });
  mountIcons(el);
  if (se) se.begin(el, { el: from as HTMLElement, borrow: opts.borrow ?? 'card' });
  // 编辑 / 删除 / 找同类：关了马上开下一个弹窗，跳过返程动效（叠两段过渡只会互相打架）；
  // 卡片海报的归位由遮罩层移除观察者兜底，不会因为跳过返程而丢
  el.querySelector('.j-edit')?.addEventListener('click', () => { close({ skipReturn: true }); openForm(sec, it, app); });
  el.querySelector('.j-del')?.addEventListener('click', () => { close({ skipReturn: true }); openConfirm(it, app); });
  el.querySelector('.j-similar')?.addEventListener('click', () => { close({ skipReturn: true }); void runSimilarRecommend(it, app); });
  // 热门短评展开/收起（纯层对超阈值长评打 .is-fold 收 3 行；短评无按钮）
  const foldBtn = el.querySelector<HTMLElement>('[data-dm-fold]');
  const quote = el.querySelector<HTMLElement>('[data-dm-quote]');
  if (foldBtn && quote) {
    const foldText = foldBtn.textContent ?? '展开全文';
    foldBtn.addEventListener('click', () => toggleQuoteFold(quote, foldBtn, foldText));
  }
  // 看大图（issue 403）：复用 core 灯箱（单例 / ESC / 点背景 / 滚动锁 / z 发号都在 core）。
  // 不自造一层——「ESC 与层级」正是最难做对的部分，为一段入场动画复刻一套是负收益。
  const dmPoster = el.querySelector<HTMLElement>('.dm-poster');
  dmPoster?.addEventListener('click', () => {
    const src = dmPoster.querySelector('img')?.getAttribute('src');
    if (src) openLightbox({ src, type: 'image', title: it.name });
  });
}

/** 短评展开 / 收起补中间态（issue 401）：下拉候选（.dm-pick-list）早有 max-height 过渡，
 *  同一「揭示」语义的短评却一直走 `is-fold` 类硬切。这里按实测高度演一段：
 *  展开到内容实测高、收回到 3 行高（`.dm-quote.is-fold` 的 line-clamp 口径），
 *  收尾清掉内联样式把文本交回自然回流。无几何环境（jsdom / 老宿主）量不到行高 → 回落即时切换，
 *  行为与旧版一致（单测因此断言的是状态而非像素）。gen 令牌：连点两次时旧的收尾作废。 */
const foldGens = new WeakMap<HTMLElement, number>();
function toggleQuoteFold(quote: HTMLElement, btn: HTMLElement, expandText: string): void {
  const folded = quote.classList.contains('is-fold');
  const lh = parseFloat(getComputedStyle(quote).lineHeight);
  const collapsed = Number.isFinite(lh) && lh > 0 ? lh * 3 : 0;
  const setText = (): void => { btn.textContent = folded ? '收起' : expandText; };
  if (!collapsed || typeof quote.animate !== 'function') {
    quote.classList.toggle('is-fold');
    setText();
    return;
  }
  let full: number;
  if (folded) {
    // 摘掉 clamp 量全高：同一帧内读完即写回，浏览器不在这中间绘制 → 不闪
    quote.classList.remove('is-fold');
    full = quote.getBoundingClientRect().height;
    if (!full || full <= collapsed) { setText(); return; } // 内容本来就短：直接落在展开态
    quote.style.maxHeight = `${collapsed}px`;
  } else {
    full = quote.getBoundingClientRect().height;
    quote.style.maxHeight = `${full}px`;
  }
  quote.style.overflow = 'hidden';
  const gen = (foldGens.get(quote) ?? 0) + 1;
  foldGens.set(quote, gen);
  const done = (): void => {
    if (foldGens.get(quote) !== gen) return; // 已被下一次点击接管 → 旧收尾作废
    quote.style.maxHeight = '';
    quote.style.overflow = '';
    if (!folded) quote.classList.add('is-fold');
    setText();
  };
  try {
    const a = quote.animate(
      [{ maxHeight: `${folded ? collapsed : full}px` }, { maxHeight: `${folded ? full : collapsed}px` }],
      { duration: MOTION.base, easing: EASE.out });
    a.finished.then(done).catch(done);
    window.setTimeout(done, MOTION.base + 400); // 兜底：动画事件丢失也必须收尾
  } catch { done(); }
}

// ---------- 详情弹窗共享元素过渡（issue 396 / 397） ----------

/** 抽离口径（issue 396 点卡 / issue 397 合集行钻入）：两者的**形态完全一致**——
 *  被点的那一件从列表里抽离（display:none）、同容器的其余件 FLIP 补位，关闭时反向让位再插回原位；
 *  差别只在容器与件选择器（网格 .pcard / 合集弹窗 .s-list 里的 .s-row）。
 *  2026-09-21 用户拍板：「合集季中的列表也要移除掉，和在卡片列表中一样」——不是只借走小图。 */
type Borrow = 'card' | 'row';

/** 过渡来源：`el` = 网格卡 或 合集弹窗里的季行（.s-row） */
interface FlightFrom { el: HTMLElement; borrow: Borrow }

/** 过渡时长（2026-09-21 用户拍板：**很短，图片飞行 0.2s**——开 = 飞行 200 + 撑开 200，
 *  关 = 折回 200 + 飞回 200）。刻意不做 prefers-reduced-motion 放缓分支：用户本人系统即报
 *  reduce，时长是他试出来的明确口径，放缓分支等于替他改决定。 */
const SE_FLIGHT = MOTION.move; // 海报单程飞行（去程直达）
const SE_GROW = MOTION.move;   // 面板从海报撑开 / 折回海报

/** 目标尺寸的海报克隆（飞行件）。挂哪层由调用方定：去程挂遮罩层（随弹窗生灭），
 *  返程挂共享宿主——它是 display:contents、自己没有盒，绝对定位实际落在面板根上，
 *  所以遮罩先走也不牵连飞行件。 */
function spawnFlyClone(host: HTMLElement, imgSrc: string, w: number, h: number, radius: string): HTMLElement {
  const clone = document.createElement('div');
  clone.className = 'cn-fly';
  clone.style.width = `${Math.round(w)}px`;
  clone.style.height = `${Math.round(h)}px`;
  clone.style.borderRadius = radius;
  const img = document.createElement('img');
  img.alt = '';
  img.src = imgSrc;
  clone.appendChild(img);
  host.appendChild(clone);
  return clone;
}

/** 飞行 keyframes：clone 是目标尺寸的盒，「平移 + 非均匀缩放」把盒依次对到每个途经矩形。
 *  卡片 2:3 与详情 7:10 差约 5%，飞行中不可辨；transform 动画全程不触布局。
 *  途经点个数不限（直飞给两个，绕行给三个），要「在某点停留」就重复给同一个矩形。 */
function flyKeyframes(base: DOMRect, w: number, h: number, ...stops: DOMRect[]): Keyframe[] {
  const at = (r: DOMRect): string =>
    `translate(${(r.left + r.width / 2 - base.left - w / 2).toFixed(1)}px, ${(r.top + r.height / 2 - base.top - h / 2).toFixed(1)}px) scale(${(r.width / w).toFixed(4)}, ${(r.height / h).toFixed(4)})`;
  return stops.map((r) => ({ transform: at(r) }));
}

/** 列表重排 FLIP 的「量」半步（issue 396 / 397）：mutate 前后各量一次，得到每件的位移差。
 *  **只量不动**——调用方常要在补动画之前再取一次几何（返程落点），而 FLIP 一旦开跑，
 *  被动画元素的**子孙**矩形就被 transform 污染了（祖先带位移，子孙的 getBoundingClientRect 跟着走）。 */
function measureFlip(targets: HTMLElement[], mutate: () => void): { el: HTMLElement; dx: number; dy: number; before: DOMRect; now: DOMRect }[] {
  const before = targets.map((c) => c.getBoundingClientRect());
  mutate();
  // 位移差与「量前/量后矩形」一起量齐：光标卡在补动画之后会读到被污染的值（见上）
  return targets.map((c, i) => {
    const now = c.getBoundingClientRect();
    return { el: c, dx: before[i].left - now.left, dy: before[i].top - now.top, before: before[i], now };
  });
}

/** 列表重排 FLIP 的「演」半步：按量好的位移差补一段位移动画——「其他卡/行移动补齐 / 让位」读得见。
 *  视口外的件跳变看不见，不演（也省下几百个合成层）；display:none 的件全零矩形自然落在视口判断之外。 */
function playFlip(deltas: { el: HTMLElement; dx: number; dy: number; before: DOMRect; now: DOMRect }[], viewport: DOMRect, duration: number = SE_FLIGHT): void {
  const near = (r: DOMRect): boolean =>
    r.width > 0 && r.top < viewport.bottom + 120 && r.bottom > viewport.top - 120
    && r.left < viewport.right + 120 && r.right > viewport.left - 120;
  for (const d of deltas) {
    if (typeof d.el.animate !== 'function') continue;
    if ((Math.abs(d.dx) < 1 && Math.abs(d.dy) < 1) || (!near(d.now) && !near(d.before))) continue;
    d.el.animate([{ transform: `translate(${d.dx.toFixed(1)}px, ${d.dy.toFixed(1)}px)` }, { transform: 'none' }],
      { duration, easing: EASE.out });
  }
}

/**
 * 共享元素过渡状态机（issue 396）。
 *
 * 开：卡片海报「抽出」飞到详情海报位（FLIGHT）→ 面板从海报矩形撑开（GROW）。
 * 关：面板折回海报矩形（GROW 逆放，遮罩同步淡出）→ 海报飞回卡片位（FLIGHT）→ 落地归位。
 * 卡片海报自抽出起保持空框、整卡压暗（.is-out），直到返程落地才归位——
 * 「详情开着 = 这张卡被借走了」（2026-09-21 拍板）。
 *
 * 坑位（都踩过）：
 * - close 闭包在 ovl 内部收口（ESC / 点遮罩都走它），外层拿不到 → 关闭接管走 ovl 的
 *   onWillClose 协议，finish 由动效自行调用，另有超时兜底防动画事件丢失卡死弹窗层；
 * - 返程克隆挂宿主（display:contents，无盒），坐标系是面板根——宿主的
 *   getBoundingClientRect 是全零，照着它算位移会把海报飞到屏幕外；
 * - 编辑 / 删除 / 找同类是「关了马上开下一个弹窗」，skipReturn 跳过返程，归位交给
 *   宿主观察者（遮罩被移除且不在关闭流程 → 归位）；
 * - 面板几何全部**同步**量取（visibility 不影响排版，藏着的间隙里量得准），
 *   异步只留 transform / clip-path 动画，全程不触布局。
 */
function createSharedFlight(): {
  willClose: (finish: () => void) => boolean;
  begin: (ovlEl: HTMLElement, from: FlightFrom) => void;
  bail: () => void;
} {
  let phase: 'idle' | 'flying' | 'open' | 'closing' = 'idle';
  let overlay: HTMLElement | null = null;
  let target: HTMLElement | null = null;
  let src: HTMLImageElement | null = null;   // 被抽离那件里的图（返程落点量它的矩形）
  let taken: HTMLElement | null = null;      // 被抽离的那一件：网格卡（card）/ 合集行（row）
  let borrow: Borrow = 'card';
  let boxEl: HTMLElement | null = null;      // 抽离件的所在容器（补位/让位的量测范围与视口）
  let flyingClone: HTMLElement | null = null; // 去程飞行件（起飞途中被打断时要靠它折返）
  let srcRect: DOMRect | null = null;         // 源件抽离前的矩形（抽离后源件全零矩形，落点只能记着）

  /** 让位/补位的动画集合 = 同容器里的兄弟件；合集模式再带上弹窗本体——
   *  行被抽走后弹窗变矮，而弹窗是 flex 居中的，不带上它会硬跳一下（2026-09-21 实测手感）。 */
  const reflowSet = (): HTMLElement[] => {
    if (!boxEl) return [];
    const sibs = [...boxEl.querySelectorAll<HTMLElement>(borrow === 'row' ? '.s-row' : '.pcard')];
    const panel = borrow === 'row' ? boxEl.closest<HTMLElement>('.cn-modal') : null;
    return panel ? [panel, ...sibs] : sibs;
  };

  /** 抽离：整件 display:none，其余件动画补位。图 rect 要在调用**前**量好——抽离后源件没有几何 */
  const extractSrc = (): void => {
    const t = taken; // 局部非空副本：TS 的收窄穿不进 mutate 闭包
    if (!t) return;
    // 源件必须排除在补位集合外：display:none 后它没有几何，混进去只会领一条无意义动画
    const set = reflowSet().filter((c) => c !== t);
    const viewport = (boxEl ?? t).getBoundingClientRect();
    playFlip(measureFlip(set, () => { t.style.display = 'none'; }), viewport);
  };

  /** 插回：列表让出空位（其余件让位动画），本件以 visibility:hidden 占位，返回图的新 rect
   *  供返程克隆瞄准；显形由调用方在克隆落地时做（揭掉 visibility） */
  const reinsertSrc = (reflowMs: number): DOMRect | null => {
    const t = taken;
    if (!t || !t.isConnected || !boxEl?.isConnected) return null;
    // 让位时长跟返程同长：空位张开的节奏才对得上海报插回的那一下。
    // ⚠ 源件必须排除在让位集合外——它 display:none 时矩形是全零，混进去会领一条
    // 「从 (0,0) 飞到空位」的纠正动画，而 getBoundingClientRect 连 transform 一起量，
    // 返回的就是被位移污染的假坐标 → 返程克隆照着飞，落点跑到面板角落（2026-09-21 实测）
    const set = reflowSet().filter((c) => c !== t);
    const viewport = boxEl.getBoundingClientRect();
    const deltas = measureFlip(set, () => { t.style.display = ''; t.style.visibility = 'hidden'; });
    // ⚠ 落点必须在补动画**之前**量：集合里带了弹窗本体（合集模式），它一开跑，
    // 行的矩形就跟着祖先的 transform 走 —— 量到的是假坐标，海报落点偏一条行高再弹回来，
    // 正是用户 2026-09-21 报的「插回时有一些抖动」。先量后演，两件事互不干扰。
    const to = src?.isConnected ? src.getBoundingClientRect() : null;
    playFlip(deltas, viewport, reflowMs);
    return to;
  };

  const restoreSrc = (): void => {
    if (taken) { taken.style.display = ''; taken.style.visibility = ''; }
  };

  return {
    /** 关闭接管：返回 true = 本模块收下这次关闭，finish 由动效结束（或超时兜底）调用 */
    willClose(finish) {
      // 局部非空副本：TS 的空值收窄穿不进嵌套闭包，handOver 里直接用
      const ov = overlay;
      const t = target;
      const s = src;
      if (phase === 'idle' || !ov || !t || !s) return false; // 没起飞过：按普通关闭走
      // 起飞途中被关（ESC / 点遮罩）：面板立刻藏、遮罩淡出，海报克隆**折返**回源卡（issue 401）。
      // 原来直接 finish() 会让海报凭空消失——与「涟漪 / 滑动高亮都可中断」的口径不齐。
      if (phase === 'flying') {
        phase = 'closing';
        const host = ov.parentNode as HTMLElement | null;
        const frame = (ov.offsetParent as HTMLElement | null) ?? host;
        const clone = flyingClone;
        const back = srcRect;
        const land = (): void => {
          if (phase !== 'closing') return; // 已结算过（动画事件与兜底定时器赛跑）
          clone?.remove();
          restoreSrc();
          phase = 'idle';
          finish();
        };
        try { ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MOTION.move, easing: 'linear' }); } catch { /* 动画不可用：直接撤层 */ }
        const modal = ov.querySelector<HTMLElement>('.cn-modal--detail');
        if (modal) modal.style.visibility = 'hidden'; // 面板本体立刻消失，只有海报自己往回飞
        if (clone && back && host && frame) {
          host.appendChild(clone); // 面板要撤，飞行件搬到共享宿主（坐标系同为面板根，不跳位）
          const cur = clone.getBoundingClientRect(); // 当前视觉矩形：正好是折返的起点（中途打断也不跳）
          const w = clone.offsetWidth || cur.width;
          const h = clone.offsetHeight || cur.height;
          try {
            const fly = clone.animate(flyKeyframes(frame.getBoundingClientRect(), w, h, cur, back),
              { duration: MOTION.move, easing: EASE.move });
            fly.finished.then(land).catch(land);
            window.setTimeout(land, MOTION.move + 400); // 兜底：动画事件丢失也必须收尾
          } catch { land(); }
        } else land();
        return true;
      }
      if (phase === 'closing') { finish(); return true; } // 重入（面板整刷连发 close）：立刻收尾
      phase = 'closing';
      const host = ov.parentNode as HTMLElement;
      const frame = (ov.offsetParent as HTMLElement | null) ?? host; // 返程克隆的坐标系（见上：宿主无盒）
      const modal = ov.querySelector<HTMLElement>('.cn-modal--detail') ?? ov;
      // ① 面板折回海报矩形 + 遮罩同步淡出（只动遮罩背景色，面板由 clip-path 收）
      const or = ov.getBoundingClientRect();
      const posterR = t.getBoundingClientRect();
      const panelRadius = parseFloat(getComputedStyle(modal).borderTopLeftRadius) || 12;
      const foldInset = `inset(${Math.max(0, posterR.top - or.top)}px ${Math.max(0, or.right - posterR.right)}px ${Math.max(0, or.bottom - posterR.bottom)}px ${Math.max(0, posterR.left - or.left)}px round 8px)`;
      let handed = false;
      const handOver = (): void => {
        if (handed || phase !== 'closing') return;
        handed = true;
        // ② 列表让位（其余卡动画挪开、卡本体隐形占位）→ 移除遮罩（背景已淡到全透明，无感）
        //    → 海报从详情海报位**直飞**回列表空位，落地卡才显形。
        //    （2026-09-21 澄清：此前「绕右上角再插入」是用户报的 bug——曾把绕行误当需求实现过，
        //     已拆。绕行若真要，flyKeyframes 的途经点形态还在，加一个矩形就行。）
        const fb = frame.getBoundingClientRect();
        const to = reinsertSrc(SE_FLIGHT);
        finish();
        if (!to) { phase = 'idle'; return; } // 卡已不在线（面板整刷过）：新网格自带它，无需返程
        const clone = spawnFlyClone(host, s.getAttribute('src') ?? '', posterR.width, posterR.height, getComputedStyle(t).borderTopLeftRadius);
        const fly = clone.animate(flyKeyframes(fb, posterR.width, posterR.height, posterR, to),
          { duration: SE_FLIGHT, easing: EASE.move, fill: 'forwards' });
        const done = (): void => {
          if (taken) taken.style.visibility = ''; // 落地：卡（或行内小图）在自己的空位里显形
          clone.remove();
          phase = 'idle';
        };
        fly.finished.then(done).catch(done);
      };
      ov.animate([
        { clipPath: `inset(-64px round ${panelRadius}px)`, backgroundColor: 'rgba(20,16,8,.45)' },
        { clipPath: foldInset, backgroundColor: 'rgba(20,16,8,0)' },
      ], { duration: SE_GROW, easing: EASE.out }); // 折回与撑开同曲线（issue 401）：往返不同缓动会让「关」比「开」急
      const fold = ov.getAnimations().pop();
      if (fold) fold.finished.then(handOver).catch(handOver);
      else handOver();
      window.setTimeout(handOver, SE_GROW + 1200); // 兜底：动画事件丢失也必须交棒，弹窗层不能赖着不走
      return true;
    },

    begin(ovlEl, from) {
      overlay = ovlEl;
      borrow = from.borrow;
      target = overlay.querySelector<HTMLElement>('.cn-modal--detail .dm-poster');
      // 被抽离的那一件 = 整卡 / 整行；图 = 卡面海报（配 .pw img）/ 行内小图（配 .s-thumb img）
      taken = from.el;
      src = from.el.querySelector<HTMLImageElement>(borrow === 'row' ? '.s-thumb img' : '.pw img');
      boxEl = borrow === 'row' ? from.el.closest<HTMLElement>('.s-list') : from.el.closest<HTMLElement>('.d-scroll, .m-scroll');
      // 无海报 / 图对不上（季明细钻入时源是合并卡正脸，与钻入季可能不同图，硬飞会在
      // 落地瞬间跳图）→ 不飞，维持原有整体入场
      if (!overlay || !target || !src?.getAttribute('src')) { this.bail(); return; }
      const dstImg = target.querySelector('img');
      if (!dstImg || dstImg.getAttribute('src') !== src.getAttribute('src')) { this.bail(); return; }
      try {
        const modal = overlay.querySelector<HTMLElement>('.cn-modal--detail');
        if (!modal) { this.bail(); return; }
        modal.classList.add('cn-modal--fly');       // 压整体入场与内容接力（styles.css 末段）
        modal.style.visibility = 'hidden';          // 布局照常，几何量得准
        phase = 'flying';
        const sr = src.getBoundingClientRect();     // 先量：整卡抽离后源就没有几何了
        const tr = target.getBoundingClientRect();
        const base = overlay.getBoundingClientRect();
        if (sr.width < 8 || sr.height < 8 || tr.width < 8 || tr.height < 8) { this.bail(); return; }
        srcRect = sr;                               // 记下落点：抽离之后源件没有几何，起飞途中被打断要靠它折返
        extractSrc();                               // 整卡从列表抽离，其余卡动画补位
        const clone = spawnFlyClone(overlay, src.getAttribute('src') as string, tr.width, tr.height, getComputedStyle(target).borderTopLeftRadius);
        flyingClone = clone;
        const fly = clone.animate(flyKeyframes(base, tr.width, tr.height, sr, tr), { duration: SE_FLIGHT, easing: EASE.move, fill: 'forwards' });
        // 宿主观察：遮罩被移除且不在关闭流程（skipReturn 的编辑/删除、异常路径）→ 源卡归位。
        // 关闭流程中的归位由返程落地负责，这里不能抢（抢了就是飞行途中卡片先长回列表）
        if (overlay.parentNode) {
          const moo = new MutationObserver(() => {
            if (overlay?.isConnected) return;
            moo.disconnect();
            if (phase !== 'closing') restoreSrc();
          });
          moo.observe(overlay.parentNode, { childList: true });
        }
        const land = (): void => {
          if (phase !== 'flying') return;
          phase = 'open';
          modal.style.visibility = '';
          clone.remove();
          flyingClone = null;
          // 面板从海报矩形撑开：clip-path 只揭示、不位移，海报原地不动；
          // 终帧外扩 64px 罩住面板投影（clip-path 连投影一起裁），fill 缺省 none，结束即卸
          try {
            const pr = modal.getBoundingClientRect();
            const t2 = target!.getBoundingClientRect();
            const radius = parseFloat(getComputedStyle(modal).borderTopLeftRadius) || 12;
            modal.animate([
              { clipPath: `inset(${Math.max(0, t2.top - pr.top)}px ${Math.max(0, pr.right - t2.right)}px ${Math.max(0, pr.bottom - t2.bottom)}px ${Math.max(0, t2.left - pr.left)}px round 8px)` },
              { clipPath: `inset(-64px round ${radius}px)` },
            ], { duration: SE_GROW, easing: EASE.out });
          } catch { /* 动画不可用（测试环境）：面板已在终态 */ }
        };
        fly.finished.then(land).catch(() => { if (phase === 'flying') this.bail(); });
      } catch {
        this.bail();
      }
    },

    /** 任何一步走不下去就整体回到「没飞过」的形态，不留半藏的面板或缺一块的列表 */
    bail() {
      overlay?.querySelector<HTMLElement>('.cn-modal--detail')?.classList.remove('cn-modal--fly');
      const modal = overlay?.querySelector<HTMLElement>('.cn-modal--detail');
      if (modal) modal.style.visibility = '';
      restoreSrc();
      overlay = null;
      target = null;
      src = null;
      taken = null;
      borrow = 'card';
      boxEl = null;
      flyingClone = null;
      srcRect = null;
      phase = 'idle';
    },
  };
}

/**
 * 合并卡详情：头部 + 各季明细行 + 特别篇行（2026-09-20 用户拍板：行上补手势，
 * 桌面右键出**该行**的跟手菜单、移动长按出底部抽屉；行点击仍是钻入该行详情）。
 * 入口 = 左键点卡片 / 卡片浮层的「查看全部」；卡片级不落笔记级动作，行级才有落点。
 *
 * 钻入某一季（issue 397, 2026-09-21 用户拍板）：合集弹窗**留着**——「列表页面不会消失」，
 * 单季详情以共享元素过渡叠在它之上，海报从行内小图长成详情海报、关闭再飞回这一行的原位。
 *
 * 坑位（都踩过）：
 * - 行内条目**触发时现取**，不在绑定时闭包捕获：面板重刷后条目对象会换，旧引用指向陈货；
 * - 桌面右键后必须 `resetItemMenuClickGuard()`：Chromium 右键时序（mousedown → contextmenu →
 *   mouseup 落在菜单外）会置位残余 click 抑制，吞掉用户下一次左键（菜单项要点两次才生效）；
 * - 长按回调里**不关弹窗**：`longPress` 靠元素级捕获吞长按后的合成 click，元素一旦被移除，
 *   合成 click 落到 document 层 → 被 item-actions 的「外部点击关闭」分支当成外部点击，
 *   抽屉开出即关（正是真机「长按没反应」那个回归）；
 * - 动作一律「先收弹窗再执行」（见 deferClose）——行右键菜单的动作仍按老口径收掉合集弹窗；
 *   只有**左键点击钻入**保留弹窗（分层：详情压列表，正是用户要的形态）。
 */
function openSeriesDetail(sec: HTMLElement, key: string, app: App, opts: { from?: HTMLElement | null } = {}): void {
  const card = seriesCardByKey(key);
  if (!card) return;
  // mobile 只管长按手势挂载（维持移动壳现状）；右键菜单分流不走壳类，见行内 hoverCapable 注
  const mobile = sec.classList.contains('mob');
  // 共享元素过渡（issue 397）：合集卡与单季卡同款——海报抽出飞入、面板从海报生长、关闭插回原位。
  // 来源 = 调用方显式给的卡（点卡片 / 键盘激活）；缺省按键反查（浮层「查看全部」手里只有键）
  const from = opts.from ?? sec.querySelector<HTMLElement>(`.pcard[data-cinema-key="${CSS.escape(key)}"]`);
  const se = from ? createSharedFlight() : null;
  const { el, close } = ovl(sec, seriesDetailModalHtml(card, (it) => posterUrl(it, app)), { onWillClose: se?.willClose });
  mountIcons(el);
  if (se) se.begin(el, { el: from as HTMLElement, borrow: 'card' });
  const rowItem = (row: HTMLElement): CinemaItem | undefined => itemByKeyInState(row.dataset.cinemaSeasonKey);
  el.querySelectorAll<HTMLElement>('.s-row').forEach((row) => {
    row.addEventListener('click', () => {
      const it = rowItem(row);
      if (!it) return;
      // 钻入某一季：合集弹窗**留着**（2026-09-21 用户拍板「列表页面不会消失」），单季详情叠在它
      // 之上；这一行从明细列表里抽离（其余行上移补位，与网格点卡同一套），海报从行内小图长成
      // 详情海报，关闭时行让位、海报飞回这一行的原位
      openDetail(sec, it, app, { from: row, borrow: 'row' });
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
      void saveEdit(item, { name, tag: cur.tag, st: cur.st, rating, date, review }, app, { el, close });
    } else {
      void saveNew({ name, tag: cur.tag, st: cur.st, rating, date, review, douban: parsed }, app, { el, close });
    }
  });
}

interface FormPayload { name: string; tag: string; st: string; rating: number | null; date: string; review: string; /** 解析阶段拿到的豆瓣字段（issue 395）：建档时一并写入，省掉落盘后重抓 */ douban?: DoubanQuery | null }

/** 新增落盘（CM2：重名/落盘失败回退；created 域事件 + 抓取队列接管） */
/** 表单游标：`el` = 弹窗层（保存后要按它折回卡片），`close` = 收层（issue 403 起成对传递——
 *  只传 close 就折不出去了，那正是「保存后面板凭空消失」的由来） */
interface FormHandle { el: HTMLElement; close: () => void }

async function saveNew(p: FormPayload, app: App, form: FormHandle): Promise<void> {
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
    // 解析阶段已拿到海报与字段（issue 395）→ 保存时一并落库（海报下载进 vault + 属性写入）：
    // 建档即「齐」，于是**不入队后台抓取、也不再有抓取通知与卡片 loading**（2026-09-21 用户拍板）。
    // 只有真没落成海报（没解析 / 没网 / 写盘失败）才回退老路径交队列补齐。
    const posterRel = p.douban?.posterUrl ? await downloadPreviewPoster(app, p.name, p.douban.posterUrl) : null;
    await persistItem(it, app, undefined, p.douban, posterRel);
    if (posterRel) it.poster = posterRel; // 内存同步：本次渲染即可见海报（盘上已写，重解析同值）
    emitDomainEvent('movie', { kind: 'created', name: p.name, status: st === STATUS_WANT ? 'want' : st === STATUS_WATCHING ? 'watching' : 'watched', rating: p.rating, review: p.review || null });
    if (it.file && !posterRel) enqueueDoubanFetch(it.file, it.name);
    notice(`已添加「${p.name}」`, 'success');
    markCardFlash(itemKey(it), p.rating !== null && p.rating > 0); // 新卡落位闪（issue 403）
    renderAll(app);
    foldOverlayToCard(form, itemKey(it)); // 折回新卡；键不在当前视图（被筛选滤掉）则即时关
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
async function saveEdit(item: CinemaItem, p: FormPayload, app: App, form: FormHandle): Promise<void> {
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
    notice(`已保存「${p.name}」`, 'success');
    // 评分变了才点亮星级（只改状态/影评时不给星级加戏）
    markCardFlash(itemKey(item), item.rating !== null && item.rating > 0 && item.rating !== prev.rating);
    renderAll(app);                       // 先刷：卡片就地换成新数据（issue 398「保存即齐」的数据侧）
    foldOverlayToCard(form, itemKey(item)); // 再折回：面板按目标卡矩形收拢（issue 403）
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

/** 方向键 → 网格坐标增量（键盘导航用） */
const ARROW_DIR: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

/** 网格内方向键的目标卡：几何最近法——前进方向上的投影必须为正，侧向偏移加权（×2）惩罚，
 *  于是「右」优先同行右边那张、「下」优先下一行同列那张，而列数不必被读进来。
 *  无几何（jsdom 全零矩形 / 卡片被隐藏）时返回 null。 */
function nearestCardInDir(cur: HTMLElement, dx: number, dy: number): HTMLElement | null {
  const grid = cur.closest<HTMLElement>('.grid, .m-grid');
  if (!grid) return null;
  const cr = cur.getBoundingClientRect();
  if (!cr.width) return null;
  const cx = cr.left + cr.width / 2;
  const cy = cr.top + cr.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  grid.querySelectorAll<HTMLElement>('.pcard[data-cinema-key]').forEach((el) => {
    if (el === cur) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const px = r.left + r.width / 2;
    const py = r.top + r.height / 2;
    const ahead = (px - cx) * dx + (py - cy) * dy;
    if (ahead <= 1) return;
    const cross = Math.abs((px - cx) * dy) + Math.abs((py - cy) * dx);
    const score = ahead + cross * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  });
  return best;
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
  /** 收掉当前换脸（离开圆点、以及开详情/合集前都要走它）。开弹窗前必须先收：
   *  换脸途中正脸可能已被冻结成「刚才那一季」，而弹窗/飞行取的是静息态那一季的海报——
   *  不收就会「看到 A、飞的是 B」。 */
  const endPeek = (): void => {
    if (!peekedDot) return;
    restFace(peekedDot);
    peekedDot = null;
  };
  const peekNearest = (e: MouseEvent): void => {
    const dot = nearestSeasonDot(e.target, e);
    if (dot === peekedDot) return;
    if (dot) peekSeasonDot(dot, app);
    else endPeek();
    peekedDot = dot;
  };
  if (hoverable) {
    sec.addEventListener('mouseover', peekNearest);
    sec.addEventListener('mousemove', peekNearest); // 衬底/间隙内滑行不换元素也跟进最近圆点
    sec.addEventListener('mouseout', (e) => {
      // 还在圆点容器内（圆点↔圆点、圆点↔衬底）交给 mouseover/mousemove 换脸，不打回静息态
      const to = e.relatedTarget as HTMLElement | null;
      if (to?.closest?.('.season-dots')) return;
      endPeek();
    });
  }
  // 深审批 B #4：卡片键盘可达——.pcard 已带 tabindex=0/role=button（shared.cardHtml），
  // 聚焦后 Enter/Space 开详情（与 click 分支同一落点分流；对齐 review 域不可达卡整改范式）。
  // sec 级委托同 click：网格每次重渲染换新元素，逐卡绑定会漏绑/泄漏。
  sec.addEventListener('keydown', (e) => {
    // 网格方向键导航（issue 403）：按**几何最近**移动焦点——左右 = 同行相邻，上下 = 下一行同列，
    // 列数自适应（桌面 5 列 / 移动 3 列，以后改列数这里不用动）。无几何（jsdom / 面板隐藏）时
    // 自然找不到候选，落回浏览器默认行为，不吞键。
    const dir = ARROW_DIR[e.key];
    if (dir && !e.isComposing) {
      const cur = (e.target as HTMLElement | null)?.closest?.('.pcard[data-cinema-key]') as HTMLElement | null;
      const next = cur ? nearestCardInDir(cur, dir[0], dir[1]) : null;
      if (next) {
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return;
      }
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const cardEl = (e.target as HTMLElement | null)?.closest?.('.pcard[data-cinema-key]') as HTMLElement | null;
    if (!cardEl) return;
    e.preventDefault(); // Space 兼作翻页键：开详情时吞掉滚动
    endPeek();          // 换脸先收（弹窗海报取静息态那一季，见 endPeek 注释）
    const key = cardEl.dataset.cinemaKey;
    // 合并卡（剧集按季合并）：点开各季明细；其余走单条目详情（click 分支同构）
    if (isSeriesKey(key)) openSeriesDetail(sec, key as string, app, { from: cardEl });
    else {
      const it = itemByKeyInState(key);
      if (it) openDetail(sec, it, app, { from: cardEl }); // 键盘激活同样走共享元素过渡（起点 = 聚焦的卡）
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
      endPeek(); // 换脸先收（飞行取的是静息态那一季的海报，见 endPeek 注释）
      const key = cardEl.dataset.cinemaKey;
      // 合并卡（剧集按季合并）：点开各季明细；其余走单条目详情
      if (isSeriesKey(key)) openSeriesDetail(sec, key as string, app, { from: cardEl });
      else {
        const it = itemByKeyInState(key);
        if (it) openDetail(sec, it, app, { from: cardEl }); // 海报从这张卡「抽出」飞入详情（issue 396）
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
      const r = Number((t as HTMLInputElement).value);
      if (out) out.textContent = r.toFixed(1);
      updateFormStars(t as HTMLInputElement, r);
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

// ---------- 滑动高亮（侧栏 rail / 排序钮 j-sort；2026-09-21 用户拍板） ----------

/**
 * 一块滑动高亮：容器里放一片绝对定位底片，位置与尺寸按目标项矩形驱动。
 * - 悬停跟随：鼠标落到哪一项，底片滑到哪一项（侧栏跨「类型 / 状态 / 底部工具」三段通吃）；
 * - 离开回落：鼠标离开容器 → 滑回当前选中项（无选中态的 ai/stat 页则隐去）；
 * - 点击固定：选中项由渲染结果决定，渲染后按键重新解析（悬停中的项重渲染后仍按同一键锁定）。
 * 底片与监听挂在**容器**上：侧栏三段与排序钮的 innerHTML 每次渲染都重写，挂项里会被一起冲掉。
 * 悬停只在有悬浮能力的设备上接（呈报#9 F4 范式：触屏不许悬浮态粘住）。
 * 刻意不做 prefers-reduced-motion 分支：用户本人系统即报 reduce，而这条动效正是他点名要的
 * （与 396 共享元素同一口径）——放缓/砍掉都等于替他改决定。
 */
const PILL_CLS = 'slide-pill';

/** 项的稳定键（渲染后按键重新解析悬停项）：rail 的 data-g / data-s / data-tool、排序钮的 data-k */
function pillKeyOf(el: HTMLElement): string {
  const d = el.dataset;
  return d.g ?? d.s ?? d.tool ?? d.k ?? '';
}

/** 绑定一次（容器被重渲染换掉时随新元素重绑）：悬停跟随 / 离开回落 / 滚动重定位。
 *  必须**先于**任何落位早退执行——首帧没有几何（测试环境 / 尚未布局）就早退的话，
 *  监听会永远绑不上，之后无论怎么悬停滚都不再重定位。 */
function ensurePillBound(box: HTMLElement, itemSel: string, hoverable: boolean): void {
  if (box.dataset.pillBound) return;
  box.dataset.pillBound = '1';
  const resync = (animate: boolean): void => syncSlidePill(box, itemSel, hoverable, animate);
  if (hoverable) {
    box.addEventListener('mouseover', (e) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(itemSel);
      if (!el || !box.contains(el)) return;
      const k = pillKeyOf(el);
      if (!k || box.dataset.pillHover === k) return; // 同一项内移动不重排
      box.dataset.pillHover = k;
      resync(true);
    });
    box.addEventListener('mouseleave', () => {
      if (!box.dataset.pillHover) return;
      delete box.dataset.pillHover;
      resync(true);
    });
  }
  // 侧栏 .rail-sec 可滚：滚动时即时落位，别让底片追着滑
  box.addEventListener('scroll', () => resync(false), true);
}

/** 重定位一块滑动高亮。`animate=false` 用于渲染/滚动后落位（不演滑行） */
function syncSlidePill(box: HTMLElement, itemSel: string, hoverable: boolean, animate = true): void {
  ensurePillBound(box, itemSel, hoverable);
  let pill = box.querySelector<HTMLElement>(`:scope > .${PILL_CLS}`);
  if (!pill) {
    pill = document.createElement('span');
    pill.className = PILL_CLS;
    pill.setAttribute('aria-hidden', 'true'); // 纯装饰：选中语义仍在 .is-on 上（读屏不重复）
    box.prepend(pill);
  }
  const items = [...box.querySelectorAll<HTMLElement>(itemSel)];
  const hoverKey = box.dataset.pillHover ?? '';
  // 悬停项按键现取（渲染后是同一键的新元素）；没有悬停或悬停项已消失 → 回落到选中项
  const hovered = hoverKey ? items.find((el) => pillKeyOf(el) === hoverKey) : undefined;
  const target = hovered ?? items.find((el) => el.classList.contains('is-on'));

  if (!target) { pill.classList.remove('is-visible'); return; }
  const r = target.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  // 滚出可视区的项不画：侧栏 .rail-sec 可滚，而底片挂在 .d-rail 上不会被它裁掉
  const sc = target.closest<HTMLElement>('.rail-sec');
  if (sc) {
    const sr = sc.getBoundingClientRect();
    if (r.bottom < sr.top + 1 || r.top > sr.bottom - 1) { pill.classList.remove('is-visible'); return; }
  }
  if (!animate) pill.classList.add('is-instant');
  pill.style.width = `${Math.round(r.width)}px`;
  pill.style.height = `${Math.round(r.height)}px`;
  pill.style.transform = `translate(${Math.round(r.left - b.left)}px, ${Math.round(r.top - b.top)}px)`;
  pill.classList.add('is-visible');
  if (!animate) { void pill.offsetWidth; pill.classList.remove('is-instant'); } // 落位后立刻恢复过渡
}

/** 渲染后重定位全部滑动高亮（底片坐在选中项上；悬停中的项按键续锁，落位不演滑行） */
function syncSlidePills(root: HTMLElement): void {
  const hoverable = hoverCapable();
  const targets: [string, string][] = [['.d-rail', '.rail-item'], ['.j-sort', 'button']];
  for (const [boxSel, itemSel] of targets) {
    const box = root.querySelector<HTMLElement>(boxSel);
    if (box) syncSlidePill(box, itemSel, hoverable, false);
  }
}

// ---------- 反馈与入口（issue 403）：星级点亮、落位闪、保存折回 ----------

/** 表单评分预览：拖动滑杆时五颗星逐颗点亮。星数没变就不重写 DOM（0.1 步进里多数输入帧
 *  星数相同），只在「新点亮了一颗」时补一次微弹；往回拖（星数减少）不弹——那是「减少」，
 *  弹一下反而吵。 */
function updateFormStars(range: HTMLInputElement, rating: number): void {
  const box = range.closest('.f-range-row')?.querySelector<HTMLElement>('.j-stars');
  if (!box) return;
  const lit = starsLit(rating);
  const before = Number(box.dataset.lit ?? '-1');
  if (lit === before) return;
  box.dataset.lit = String(lit);
  box.innerHTML = starsHtml(rating);
  if (before < 0 || lit <= before) return; // 首次渲染 / 往回拖
  [...box.querySelectorAll<HTMLElement>('i.is-on')].slice(before).forEach((el) => {
    if (typeof el.animate !== 'function') return;
    try { el.animate([{ transform: 'scale(1.45)' }, { transform: 'none' }], { duration: MOTION.fast, easing: EASE.out }); } catch { /* 动画不可用：直达终态 */ }
  });
}

/** 待闪的卡：保存 / 快速标记后登记，**下一次渲染**落地时消费一次。
 *  键不在当前视图里就不闪——改完状态被筛掉时用户在看别处，闪给谁看。 */
let pendingFlash: { key: string; stars: boolean } | null = null;
function markCardFlash(key: string, stars = false): void { pendingFlash = { key, stars }; }

/** 渲染后：给刚变更的卡落位闪（金边脉冲）+ 星级逐颗点亮——「就是这张变了」。 */
function flushCardFlash(root: HTMLElement): void {
  const p = pendingFlash;
  pendingFlash = null;
  if (!p) return;
  const card = root.querySelector<HTMLElement>(`.pcard[data-cinema-key="${CSS.escape(p.key)}"]`);
  const pw = card?.querySelector<HTMLElement>('.pw');
  if (!card || !pw) return;
  if (typeof pw.animate === 'function') {
    try {
      pw.animate([
        { boxShadow: '0 0 0 0 rgba(224,170,75,0)' },
        { boxShadow: '0 0 0 3px rgba(224,170,75,.55)' },
        { boxShadow: '0 0 0 0 rgba(224,170,75,0)' },
      ], { duration: MOTION.impulse, easing: EASE.out });
    } catch { /* 动画不可用：跳过（卡本身已是新数据） */ }
  }
  if (!p.stars) return;
  card.querySelectorAll<HTMLElement>('.pstars i.is-on').forEach((el, i) => {
    if (typeof el.animate !== 'function') return;
    try {
      el.animate([{ opacity: .2, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }],
        { duration: MOTION.move, delay: i * STAGGER, easing: EASE.out, fill: 'backwards' });
    } catch { /* 同上 */ }
  });
}

/** 表单保存后折回卡片（与共享元素返程同一语汇：整层 clip-path 收到目标卡矩形 + 遮罩淡出）。
 *  目标卡按键在**新网格**里反查（所以调用点在 renderAll 之后）；查不到——改完状态被当前筛选
 *  滤掉、或面板整刷没了——就直接关：折回一段看不见的动画没有意义。 */
function foldOverlayToCard(form: { el: HTMLElement; close: () => void }, key: string): void {
  const { el, close } = form;
  const card = M.currentOverlay?.querySelector<HTMLElement>(`.pcard[data-cinema-key="${CSS.escape(key)}"]`);
  const modal = el.querySelector<HTMLElement>('.cn-modal');
  const r = card?.querySelector<HTMLElement>('.pw')?.getBoundingClientRect();
  if (!modal || !r || r.width < 8 || typeof modal.animate !== 'function') { close(); return; }
  const o = el.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(modal).borderTopLeftRadius) || 12;
  const inset = `inset(${Math.max(0, r.top - o.top)}px ${Math.max(0, o.right - r.right)}px ${Math.max(0, o.bottom - r.bottom)}px ${Math.max(0, r.left - o.left)}px round 8px)`;
  try {
    const a = el.animate([
      { clipPath: `inset(-64px round ${radius}px)`, backgroundColor: 'rgba(20,16,8,.45)' },
      { clipPath: inset, backgroundColor: 'rgba(20,16,8,0)' },
    ], { duration: MOTION.base, easing: EASE.out });
    const done = (): void => close();
    a.finished.then(done).catch(done);
    window.setTimeout(done, MOTION.base + 400); // 兜底：动画事件丢失也必须收层
  } catch { close(); }
}

// ---------- 网格重排动效（issue 402）：留下来的 FLIP、消失的留幽灵、新来的接力 ----------
//
// 网格是整写 innerHTML 的（renderMidnightDesk/Mob），排序 / 筛选 / 搜索 / 状态流转之后卡片
// 会直接跳位——这是走查里最大的一块空白。三件套一次补齐，语义各不相同：
//   留下来的卡：知道它从哪来 → 按稳定键配对补位（FLIP）
//   消失的卡：渲染后就没了 → 按旧矩形留一枚幽灵淡出，让「筛掉了什么」可读
//   新出现的卡：没有来处 → 前若干张接力淡入（只在内容身份变化时排，免得后台刷新整屏在闪）
// 稳定键用 data-cinema-key（单条目 = 笔记名，合并卡 = series:<组>:<base>，季圆点换脸同键）。

/** 网格卡片快照（键 → 矩形 + 海报图源；海报给离场幽灵用，取不到就只是块底色） */
interface GridCardSnap { rect: DOMRect; src: string | null }

/** 渲染前量一遍网格卡片。**只量不动**：渲染会把整片 DOM 换掉，量完就没机会了。 */
function measureGridCards(root: HTMLElement): Map<string, GridCardSnap> {
  const out = new Map<string, GridCardSnap>();
  root.querySelectorAll<HTMLElement>('.pcard[data-cinema-key]').forEach((el) => {
    const key = el.dataset.cinemaKey;
    if (!key) return;
    out.set(key, { rect: el.getBoundingClientRect(), src: el.querySelector('.pw img')?.getAttribute('src') ?? null });
  });
  return out;
}

/** 离场幽灵上限：超过就整体不演——那种规模本就是一屏换新，逐张淡出只会拖慢感知 */
const GHOST_MAX = 40;
/** 进场接力的张数上限（前 N 张，按 DOM 序） */
const ENTER_MAX = 12;

/** 内容身份（视图 / 分组 / 状态 / 排序 / 关键词）：只有它变了才排进场接力，
 *  标星 / 队列回填 / 保存这类原地刷新不排（否则每次后台刷新整屏都在闪）。 */
let lastViewIdentity: string | null = null;
const viewIdentity = (): string =>
  [M.view, M.typeFilter ?? '', M.statusFilter ?? '', M.sortMode, M.searchKeyword].join('|');

/** 渲染后演网格动效。滚位恢复之后才跑——位移差要跟最终滚位一致，否则算出来的落差是假的。 */
function playGridMotion(root: HTMLElement, before: Map<string, GridCardSnap>): void {
  const identity = viewIdentity();
  const identityChanged = identity !== lastViewIdentity;
  lastViewIdentity = identity;
  const grid = root.querySelector<HTMLElement>('.grid, .m-grid');
  if (!grid) return;                                  // 不在网格页（ai / 分析 / 空态）
  const frame = grid.getBoundingClientRect();
  if (!frame.width || !frame.height) return;          // 无几何（测试环境 / 面板隐藏）：不演
  const viewport = (grid.closest('.d-scroll, .m-scroll') ?? grid).getBoundingClientRect();
  const near = (r: DOMRect): boolean =>
    r.width > 0 && r.top < viewport.bottom + 120 && r.bottom > viewport.top - 120
    && r.left < viewport.right + 120 && r.right > viewport.left - 120;
  const animate = (el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null => {
    if (typeof el.animate !== 'function') return null;
    try { return el.animate(frames, opts); } catch { return null; } // 老宿主：直接落终态
  };
  const seen = new Set<string>();
  let arrival = 0;
  for (const el of grid.querySelectorAll<HTMLElement>('.pcard[data-cinema-key]')) {
    const key = el.dataset.cinemaKey as string;
    seen.add(key);
    const prev = before.get(key);
    if (prev) {
      const now = el.getBoundingClientRect();
      const dx = prev.rect.left - now.left;
      const dy = prev.rect.top - now.top;
      if ((Math.abs(dx) < 1 && Math.abs(dy) < 1) || (!near(now) && !near(prev.rect))) continue;
      animate(el, [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` }, { transform: 'none' }],
        { duration: MOTION.move, easing: EASE.out });
    } else if (identityChanged && arrival < ENTER_MAX) {
      if (!near(el.getBoundingClientRect())) continue;
      animate(el, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: MOTION.base, delay: arrival * STAGGER, easing: EASE.out, fill: 'backwards' });
      arrival++;
    }
  }
  // 离场的：旧矩形处留一枚幽灵淡出（不吃事件、不随重排走；grid 是它的定位祖先）
  const gone = [...before.entries()].filter(([k]) => !seen.has(k));
  if (!gone.length || gone.length > GHOST_MAX) return;
  for (const [, snap] of gone) {
    if (!near(snap.rect)) continue;
    const ghost = document.createElement('div');
    ghost.className = 'cn-exit';
    ghost.style.left = `${(snap.rect.left - frame.left).toFixed(1)}px`;
    ghost.style.top = `${(snap.rect.top - frame.top).toFixed(1)}px`;
    ghost.style.width = `${snap.rect.width.toFixed(1)}px`;
    ghost.style.height = `${snap.rect.height.toFixed(1)}px`;
    if (snap.src) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = snap.src;
      ghost.appendChild(img);
    }
    grid.appendChild(ghost);
    const drop = (): void => ghost.remove();
    const a = animate(ghost, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }],
      { duration: MOTION.fast, easing: EASE.out });
    if (a) {
      a.finished.then(drop).catch(drop);
      window.setTimeout(drop, MOTION.fast + 400); // 兜底：动画事件丢失也不能留下幽灵
    } else drop();
  }
}

/** 渲染总入口：按面板根的风格/端分发（vault 自动刷新与 M.renderFn 都走这里） */
export function renderAll(app: App): void {
  const overlay = M.currentOverlay;
  if (!overlay) return;
  const root = overlay.querySelector<HTMLElement>('[data-cinema-root]');
  if (!root) return;
  clearSoftRender(); // 已排期的顺延渲染作废，本次渲染已覆盖
  const snap = snapshotFocus(root);
  const beforeCards = measureGridCards(root); // 网格动效（issue 402）：渲染前量，渲染后就没机会了
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
  syncSlidePills(root); // 底片跟着新选中项落位（渲染重写了 rail/排序钮的 innerHTML）
  playGridMotion(root, beforeCards); // 滚位恢复之后再演：位移差要跟最终滚位一致
  flushCardFlash(root); // 刚变更的那张卡闪一下（issue 403）
  restoreFocus(root, snap);
}

export function closeOverlay(): void {
  clearSoftRender(); // 面板已关：顺延渲染不再补，免留下野定时器
  pendingFlash = null;      // 本次落位闪作废（面板都关了，没有卡可闪）
  lastViewIdentity = null;  // 下次开面板按「内容身份变了」处理 → 首屏排进场接力
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
