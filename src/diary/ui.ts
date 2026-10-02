/**
 * 日记本（diary）域 UI · 「桌上那本」书页界面（ADR-0230）
 *
 * 一本书落在台灯下的桌面上：翻开就是最新那篇，往后翻是更旧的日子；功能全是桌上实物——
 * 书口抽册页索引 / 台历跳日 / 放大镜检索 / 铅笔写 / 贴纸册分类 / 火漆信封加密 / 撕页删除 /
 * 相纸显影灯箱 / 那年今天明信片 / 票根·信笺·藏书票。
 *
 * 分层（ADR-0106 / ADR-0230 决策 2）：
 * - **markup 纯层在 `./render`**（书桌 DOM 骨架 + seal/ticket/exlibris/para/entryBlocks/daystamp/photo），
 *   受 render-purity 守卫约束；两处消费同一份——插件这里，以及评审壳
 *   （`prototypes/diary/fake-sim.ts` 跑的是真 `openDiary` → 真 `show()`，不是复刻件）。
 * - **本文件只放行为**：分页测量与切页、StPageFlip 建书与翻页、文具五项动作、台历/贴纸册/检索/
 *   信封/撕页/灯箱/便签菜单、域事件回刷、加密媒体按需解密。
 * - **数据层不动**（`data.ts`/`store.ts`/`encrypt.ts`/`config.ts`）：本域 content 只读聚合，
 *   写盘全走 `./store` 的守卫 + 串行队列。
 *
 * 与原型（`.scratch/diary-quill/`）的三处刻意不同（ADR-0230 决策 3 / 8 / 9）：
 * 1. **不带外链字体**（决策 3）：`font-family` 一律回归宿主，观感由「手写」转「印刷」。
 * 2. **写日记仍走本域 `openAddDialog`**（决策 8），不搬原型那张会自己写盘的书内写作页——
 *    写层守卫、同刻唯一、串行队列、加密分流、写后跳转都在那边，重造一份必然丢几条。
 * 3. **没有「抹（抹掉全部本地涂改）」这件文具**（决策 9）：那是探索稿 localStorage 覆盖层专有的
 *    概念（added/deleted/tags/encrypted 四本账），单源里对应的是真文件，没有可抹的对象。
 *    同为原型的「拆信/取出」在单源里走真保险箱，也不再需要那个演示用假密码框。
 *
 * 隔离口径：根元素即 `.bz-diary-scene`（全部样式挂它，见 `./styles.css` 头注）；根上只写
 * `position/inset/display/z-index` 这类**行为性内联值**，z-index 经 core 的 `allocZ()`（ADR-0067）。
 */
import { type App, type EventRef } from 'obsidian';
import { PageFlip } from './vendor/page-flip.browser.js';
import { registerPanelEsc, unregisterPanelEsc } from '../core/esc-manager';
import { topifyZ } from '../core/dom';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { onDomainEvent } from '../core/domain-bus';
import { escapeHtml } from '../core/utils';
import { openFlowDialog } from '../core/flow-dialog';
import { DIARY_DIRECTORY, inWallDirs, getTagEmoji, FIRST_PAINT_ENTRIES } from './config';
import {
  loadWallEntries,
  invalidateWallCache,
  onWallProgress,
  mediaSrc,
  extractMedia,
  extractSegments,
  stripMediaLinks,
  type WallEntry,
  type WallMedia,
} from './data';
import { LIST_BATCH_SIZE } from '../core/paging';
import {
  bookPanelHTML,
  daystampHTML,
  entryBlockHTMLs,
  inlineMd,
  mimeOfMediaName,
  splitTextBlocks,
  stripHashInto,
  tiltClassOf,
  cnNum,
  pad2,
  weekdayOf,
  WEEK,
  type RenderCtx,
} from './render';
import {
  findDiaryEntry,
  removeDiaryEntries,
  isUnparsedRefusal,
  isDiaryReadFailure,
  rekeyDiaryMapPath,
  dropDiaryMapPath,
} from './store';
import {
  isUnlocked,
  loadEncryptedEntries,
  encryptEntry,
  reclassifyEntry,
  deleteEncryptedEntry,
} from './encrypt';
import { openAddDialog, showTagPicker, hideAddDialog, hideTagPicker } from './ui/dialogs';
import { copyDiaryLink, showConfirm } from './ui/entry-actions';
/* 纯层只吐 data-lucide 占位（iconSpan），兑现统一在这里做一次：
   插件端走 setIcon（全 lucide 名），评审壳走 prototype-icons.js 的手写白名单。 */
import { mountIcons } from '../core/ui';

// ===== 常量 =====

/** 窄屏单页断点——**与 styles.css 的 `@media (max-width: 720px)` 必须一致**（两侧都改）。
 * 导出是给 `lastReachableCursor` 的条件 ② 守卫用（`ui-book.test.ts`：单页档下 2×页宽必须大于它）。 */
export const SINGLE_MAX_W = 720;
/** StPageFlip 翻页动画时长（原型 620ms 实测偏拖沓，收到 380ms） */
const FLIP_TIME_MS = 380;
/** 页尾能塞下一刀的最小剩余高度：比这更矮就不切，直接换页（切出来两行字没有意义） */
const PAGE_CUT_MIN_PX = 84;
/** 日戳不孤行：本页剩余空间装不下「日戳 + 一点点内容」就提前换页 */
const DAYSTAMP_KEEP_PX = 96;
/** 域事件/vault 变更后的整册回刷防抖 */
const REFRESH_DEBOUNCE_MS = 400;
/** 滚轮翻页节流 */
const WHEEL_LOCK_MS = 560;

// ===== 纯函数（可单测）=====

/** 灯箱条目：媒体文件 + 它属于哪一则 */
export interface PhotoRef {
  entry: WallEntry;
  media: WallMedia;
}

/**
 * 灯箱序列（纯函数，可单测）：按**条目顺序 × 段序**收集图片/视频，**同名媒体只登记一次**
 * （正文里同一张图引用两次不该在灯箱里数成两张）。
 * 录音卡不进灯箱；加密条目的媒体不在其中——`loadWallEntries` 本就不含未解锁的加密条目，
 * 解锁后在册的加密条目其媒体走 `encryptedMediaUrl()` 单独解密。
 */
export function collectPhotoRefs(entries: WallEntry[]): PhotoRef[] {
  const out: PhotoRef[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (e.encrypted) continue;
    for (const seg of e.segments) {
      if (seg.kind !== 'media') continue;
      if (seg.media.kind === 'audio') continue;
      if (seen.has(seg.media.name)) continue;
      seen.add(seg.media.name);
      out.push({ entry: e, media: seg.media });
    }
  }
  return out;
}

/** 分页结果：一页 = 一串块元素 */
export type Page = HTMLElement[];
/** 切页输入：块元素 + 已量好的占位高（`offsetHeight + 上下 margin`）+ 是否「不孤行」 */
export interface FlowItem {
  el: HTMLElement;
  h: number;
  keep?: boolean;
}
/** 段落逐行续排的注入点：返回 `[上半, 下半, 下半高]`，放不下返回 null。测试可换成桩。 */
export type SplitFn = (el: HTMLElement, availPx: number) => [HTMLElement, HTMLElement, number] | null;

/**
 * 块流 → 页（纯函数，可单测）。规则与原型一致，逐条对应：
 * 1. `keep` 块（日戳）= 新的一天 = 新的一张纸，且**对齐到跨页左位**（前一天纸的背面自然留白）；
 * 2. 空页上遇到「自己就超过一整页」的块：先按整页高度切一刀；
 * 3. 装不下时若页尾还够高（≥ PAGE_CUT_MIN_PX）就在剩余空间里逐行切一刀，上半留页尾、下半顶格续下页；
 * 4. `keep` 块还要求剩余高度容得下「它 + 一点内容」，否则提前换页（日戳不孤行）。
 *
 * 抽成纯函数是为了让这段最难的逻辑能脱开 DOM 单测（真实现里 `split` 走 Range 二分）。
 *
 * 注：规则 4 目前**走不到**——规则 1 对 `keep` 块已经先换了页（`cur` 必为空），
 * 此处 `cur!.length` 恒假。移植期照原型逐行对齐（`.scratch/diary-quill/app.js` 同一形态），
 * 不擅自「修好」它：改了会动分页结果，而那要另起一次拍板。测试也不钉这条死分支，只钉可观察行为。
 */
export function paginateFlow(
  items: FlowItem[],
  availH: number,
  split: SplitFn,
  heightOf: (el: HTMLElement) => number
): Page[] {
  const metas = items.map((it) => ({ el: it.el, h: it.h, keep: !!it.keep }));
  const pages: Page[] = [];
  let cur: Page | null = null;
  let used = 0;
  const newPage = () => {
    cur = [];
    pages.push(cur);
    used = 0;
  };
  newPage();

  for (let i = 0; i < metas.length; i++) {
    const it = metas[i];
    /* 1) 新的一天 = 新的一张纸 */
    if (it.keep && (cur!.length || pages.length > 1)) {
      if (pages.length % 2 === 1) pages.push([]); // 补一页空白背面，让日戳落在左页
      newPage();
      used = 0;
    }
    /* 2) 空页上遇到超长块：先按整页高度切一刀 */
    if (!cur!.length && it.h > availH) {
      const c2 = split(it.el, availH - 4);
      if (c2) {
        it.h = heightOf(c2[0]);
        metas.splice(i + 1, 0, { el: c2[1], h: c2[2], keep: false });
      }
    }
    /* 3) 装不下：页尾够高就逐行续排，否则换页 */
    if (used + it.h > availH && cur!.length) {
      const remain = availH - used;
      if (remain >= PAGE_CUT_MIN_PX) {
        const cut = split(it.el, remain - 4);
        if (cut) {
          cur!.push(cut[0]);
          metas.splice(i + 1, 0, { el: cut[1], h: cut[2], keep: false });
          used = availH;
          continue;
        }
      }
      newPage();
    }
    /* 4) 日戳不孤行 */
    if (it.keep && used + it.h + DAYSTAMP_KEEP_PX > availH && cur!.length) newPage();
    cur!.push(it.el);
    used += it.h;
  }
  return pages;
}

/** 月索引项：某月的首页号（书页序号，0 起）与该月条目数 */
export interface MonthMark {
  key: string;
  page1: number;
  n: number;
}

/**
 * 册页索引（纯函数，可单测）：每个月**第一次出现**的页（读日戳的 `data-date`）。
 * 目录纸 / 书口年份染色 / 台历跳日共用这一份口径。
 */
export function monthMarks(pages: Page[], entries: WallEntry[]): MonthMark[] {
  const out: MonthMark[] = [];
  const seen = new Set<string>();
  for (let pi = 0; pi < pages.length; pi++) {
    const dayEl = pages[pi].find((el) => el.classList.contains('bz-diary-b-daystamp'));
    const date = dayEl?.getAttribute('data-date');
    if (!date) continue;
    const key = date.slice(0, 7);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, page1: pi + 1, n: 0 });
  }
  const byMonth = new Map<string, number>();
  for (const e of entries) {
    const k = e.date.slice(0, 7);
    byMonth.set(k, (byMonth.get(k) || 0) + 1);
  }
  for (const m of out) m.n = byMonth.get(m.key) || 0;
  return out;
}

/** 某页的日戳日期（跳日/搜索定位用；无日戳返回 null） */
export function pageDateOf(page: Page): string | null {
  const el = page.find((n) => n.classList.contains('bz-diary-b-daystamp'));
  return el?.getAttribute('data-date') || null;
}

// ===== 小工具 =====

/** HTML 串 → 元素（render 层出串，行为层要 DOM 才量得动） */
function elOf(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content.firstElementChild as HTMLElement;
}

/** `#标签` 收集（换贴纸后要就地重画类型签；口径与 render.entryBlockHTMLs 内部那份一致） */
function hashesOf(e: WallEntry): string[] {
  const out: string[] = [];
  if (e.kind !== 'diary' && e.kind !== 'letter') return out;
  for (const seg of e.segments) {
    if (seg.kind !== 'text') continue;
    for (const b of splitTextBlocks(seg.text)) {
      if (b.t === 'para' || b.t === 'quote') stripHashInto(b.text, out);
    }
  }
  return out;
}

/** 条目 → 誊录用纯文本 */
export function plainTextOf(e: WallEntry): string {
  const x = e.extra || {};
  if (e.kind === 'movie') return `《${x.title || ''}》观影于 ${e.date}\n${x.review || ''}`;
  if (e.kind === 'book') return `《${x.title || ''}》${x.author || ''}\n${x.review || ''}`;
  if (e.kind === 'letter') return `${e.filename ? e.filename.split('/').pop()?.replace(/\.md$/, '') + '\n' : ''}${e.content || ''}`;
  return e.content || '';
}

/** 绝对定位浮层的工作区坐标 → 视口坐标（`.bz-diary-scene` 是 position:fixed，故直接用 clientX/Y） */
interface MenuPos {
  x: number;
  y: number;
}

/** 剪贴板（带 execCommand 兜底：非安全上下文里 navigator.clipboard 不存在） */
function writeClipboard(text: string, okMsg: string, failMsg: string): void {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      notice(okMsg, 'success');
    } catch {
      notice(failMsg, 'error');
    }
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    void navigator.clipboard.writeText(text).then(() => notice(okMsg, 'success'), fallback);
  } else fallback();
}

/**
 * 读者在当前端式下能翻到的**最后一个 `cursor` 值**（= 书尾判据）。抽成纯函数是因为它的正确性
 * 完全由 StPageFlip 的 `flip` 语义决定、跟 DOM 量尺无关，必须能脱开书实例单测。
 *
 * 为什么**不能**用 `pageCount - 1`：跨页（landscape）模式下 StPageFlip 的 `flip` 事件给的是
 * `currentPageIndex`，而库里它等于**当前跨页的左页号**（`showSpread()`：`currentPageIndex =
 * spread[0]`）。`createSpread()` 把页两两配对；本域 `showCover: false`（无封面页）所以从 0 起配：
 * **偶数页数**时最后一跨是 `[n-2, n-1]`，左页号最多到 `n-2` —— 永远到不了 `n-1`。若按
 * `cursor === n-1` 判「已在书尾」，条件在偶数页数下恒不成立、续叠一次都不触发。真机症状：
 * 首屏那批翻完就到底了，后台读进来的一千多则再也翻不到。**奇数**页数时最后一跨是 `[n-1]`，
 * 左页号就是 `n-1`。单页（portrait）模式每页自成跨，最大恒为 `n-1`。
 *
 * 端式参数取本域自己那份判定（`ui.ts` 的 `this.single`，与 `pageWidth()` 同源）。可达布局下它与
 * 库的真实端式**恒等**，两个方向分头看：
 * ① `single === false` ⇒ 建书时 `usePortrait: false` ⇒ 库不可能成 portrait，必 landscape；
 * ② `single === true` ⇒ 屏宽 ≤ `SINGLE_MAX_W`，而 `pageWidth()` 此时 = min(0.92×屏宽, 480)
 *    ⇒ 2×页宽 > 屏宽 ≥ 块宽 ⇒ 库 `calculateBoundsRect` 的 portrait 条件（块宽 < 2×页宽）必成立。
 * 所以这里用 `this.single` 是安全的。（库另有一份「当前端式」的现成答案
 * `this.flip.getOrientation()`——改用它可以免掉上面这条推导，但要给测试替身补上同一层语义。
 * **若日后调 `SINGLE_MAX_W` 或 `pageWidth()` 的 480 上限，必须重核条件 ②**：库的 portrait
 * 不是只看 `usePortrait`，多看一个「块宽 < 2×页宽」；条件 ② 一旦不成立，本判据会把偶数页数的
 * landscape 书当成 portrait，`n-1` 又永远够不到——本轮修掉的缺陷就会以反方向回来。
 * 条件 ② 已由 `ui-book.test.ts` 的「单页档下 2×页宽必大于断点宽」守卫看着，改坏会红。）
 */
export function lastReachableCursor(pageCount: number, single: boolean): number {
  const n = pageCount;
  if (n <= 0) return 0;
  if (single) return n - 1;
  return n % 2 === 1 ? n - 1 : n - 2;
}

/**
 * 回忆墙视图状态（增强 #11）——**已随 ADR-0230 退役**：书页界面没有筛选 chips / 章节栏 / 滚动位置，
 * 跳原文回首时只需重新摊开在同一篇上（`cursor` 由 `keepRatio` 保比例即可）。
 * 类型保留是为了不惊动外部引用面的编译；新代码不要用它。
 * @deprecated 书页界面（ADR-0230）不再需要跨视图恢复筛选与滚动。
 */
export interface WallViewState {
  selTag: string | null;
  selSubTag: string | null;
  selDateFilter: { year: string; month?: string } | null;
  searchKeyword: string;
  lockedVisible: boolean;
  scrollTop: { desk: number; mob: number };
}

// ===== 控制器 =====

/**
 * 日记本 AppController（对齐 password-vault AppController 模式）：
 * 单例 `getInstance()` / `show()` / `hide()` / `cleanup()`。
 * 根容器 `.bz-diary-scene`（position:fixed;inset:0;display:none）挂 body，z-index 走 `topifyZ`。
 */
export class DiaryAppController {
  static instance: DiaryAppController | null = null;

  static getInstance(): DiaryAppController {
    if (!DiaryAppController.instance) DiaryAppController.instance = new DiaryAppController();
    return DiaryAppController.instance;
  }

  // ---------- DOM ----------
  root: HTMLDivElement | null = null;
  private bookEl!: HTMLElement;
  private blockEl!: HTMLElement;
  private flipHost!: HTMLElement;
  private edgeEl!: HTMLElement;
  private toolsEl!: HTMLElement;
  private filterTabEl!: HTMLElement;
  /* 明信片（那年今日）与引导便签已整件退役：开册就往桌上摆的非请求物件，
     与「只要日记本本身」冲突（postcardEl / hintEl 随之摘除） */
  private menuEl!: HTMLElement;
  private sheetEl!: HTMLElement;
  private sheetTitleEl!: HTMLElement;
  private sheetBodyEl!: HTMLElement;
  private slipEl!: HTMLElement;
  private slipTitleEl!: HTMLElement;
  private slipBodyEl!: HTMLElement;
  private slipRowEl!: HTMLElement;
  private albumEl!: HTMLElement;
  private albumSubEl!: HTMLElement;
  private albumGridEl!: HTMLElement;
  private calEl!: HTMLElement;
  private calYmEl!: HTMLElement;
  private calGridEl!: HTMLElement;
  private calTimeRowEl!: HTMLElement;
  private calInputEl!: HTMLInputElement;
  private calErrEl!: HTMLElement;
  private calOkEl!: HTMLElement;
  private lightboxEl!: HTMLElement;
  private lbPhotoEl!: HTMLElement;
  private lbMediaEl!: HTMLElement;
  private lbCapEl!: HTMLElement;
  private lbCountEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private fallbackEl!: HTMLElement;
  /** 右上角常驻的「收起」钮（整屏场景唯一可见出口） */
  private closeEl!: HTMLElement;
  /** 火漆密码框（域内自绘，主密码交给真保险箱校验） */
  private passEl!: HTMLElement;
  private passInputEl!: HTMLInputElement;
  private passErrEl!: HTMLElement;
  /** 密码框在途的结算器（同一时刻至多一个） */
  private passSettle: ((ok: boolean) => void) | null = null;

  // ---------- 状态 ----------
  /** 当前册子里的条目（只读聚合结果；加密条目在解锁时才并入） */
  entries: WallEntry[] = [];
  /**
   * 排版窗口（ADR-0231）：只把前这么多条排成纸页，其余**留在内存里但不排**。
   * 排版是本域最贵的一步（全量块流测高 + 二分切段），1443 条全排会在开册时顿住；
   * 首批按 `FIRST_PAINT_ENTRIES` 成册，用户翻到书尾才把窗口推宽一批（见 extendIfAtTail）。
   */
  private shown = FIRST_PAINT_ENTRIES;
  /** 本轮的「首批已成册」闸门：进度可能连发多次，只认第一次 */
  private firstPaintDone = false;
  /** 续叠窗口的重入闸门（relayout → buildBook 会重挂 flip 事件） */
  private extending = false;
  /** 延后一拍续叠的定时器（`flip` 钩子用；`relayout`/`hide` 复位的旁路遗物） */
  private extendTimer: ReturnType<typeof setTimeout> | null = null;
  private byEid = new Map<string, WallEntry>();
  private pages: Page[] = [];
  private cursor = 0;
  private single = false;
  private filterTag: string | null = null;
  private search: { kw: string | null; hits: { pi: number; el: HTMLElement }[]; i: number } = {
    kw: null,
    hits: [],
    i: 0,
  };
  private photoRefs: PhotoRef[] = [];
  private photoIndex = new Map<string, number>();
  private lbIdx = 0;
  private flip: PageFlip | null = null;
  private menuEid: string | null = null;
  private bookRect: DOMRect | null = null;
  private epoch = 0;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private modifyTimer: ReturnType<typeof setTimeout> | null = null;
  private wheelLock = 0;
  private toolsRaf = 0;
  private toolsShown = false;
  private lastSingle = false;
  private lastW = 0;
  private lastH = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private encMediaCache = new Map<string, Promise<string | null>>();
  private lastSpreadCount = 0;
  private cal = { year: 2026, month: 1 };

  // ---------- 生命周期标记 ----------
  private _initialized = false;
  private _shownOnce = false;
  private _hideMotion = false;
  private _allowCacheNext = false;
  private _loadError: string | null = null;
  private _subs: (() => void)[] = [];
  private _vaultRefs: EventRef[] = [];

  // ============================================================
  //  DOM 构建
  // ============================================================

  /** 幂等建 DOM + 绑事件（show/init 均经此） */
  ensureElements(): void {
    if (this._initialized) return;
    this._initialized = true;

    const root = document.createElement('div');
    root.className = 'bz-diary-scene';
    // root 上只落行为性内联值：几何 + 层级 + 显示与否（视觉样式全在 styles.css）
    root.style.cssText = 'position:fixed;inset:0;display:none;';
    root.innerHTML = bookPanelHTML();
    document.body.appendChild(root);
    this.root = root;
    mountIcons(root); // 兑现「收起」钮与火漆印上的 lucide 占位（缺这步图标是空白）
    this.applyBookZoom(); // 首屏就把书缩放进遮罩（窗口比书窄时）

    const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
    this.bookEl = q('.bz-diary-book');
    this.blockEl = q('.bz-diary-bk-block');
    this.flipHost = q('.bz-diary-flipbook');
    this.edgeEl = q('.bz-diary-bk-edge');
    this.toolsEl = q('.bz-diary-tools');
    this.filterTabEl = q('.bz-diary-filter-tab');
    this.menuEl = q('.bz-diary-menu');
    this.sheetEl = q('.bz-diary-sheet');
    this.sheetTitleEl = q('.bz-diary-sh-title');
    this.sheetBodyEl = q('.bz-diary-sheet-body');
    this.slipEl = q('.bz-diary-slip');
    this.slipTitleEl = q('.bz-diary-slip-title');
    this.slipBodyEl = q('.bz-diary-slip-body');
    this.slipRowEl = q('.bz-diary-slip-row');
    this.albumEl = q('.bz-diary-album-pop');
    this.albumSubEl = q('.bz-diary-ap-sub');
    this.albumGridEl = q('.bz-diary-ap-grid');
    this.calEl = q('.bz-diary-cal-pop');
    this.calYmEl = q('.bz-diary-cal-ym');
    this.calGridEl = q('.bz-diary-cal-grid');
    this.calTimeRowEl = q('.bz-diary-cal-time-row');
    this.calInputEl = q<HTMLInputElement>('.bz-diary-ct-input');
    this.calErrEl = q('.bz-diary-ct-err');
    this.calOkEl = q('.bz-diary-cal-ok');
    this.lightboxEl = q('.bz-diary-lightbox');
    this.lbPhotoEl = q('.bz-diary-lb-photo');
    this.lbMediaEl = q('.bz-diary-lb-media');
    this.lbCapEl = q('.bz-diary-lb-cap');
    this.lbCountEl = q('.bz-diary-lb-count');
    this.toastEl = q('.bz-diary-toast');
    this.fallbackEl = q('.bz-diary-fallback');
    this.closeEl = q('.bz-diary-close');
    this.passEl = q('.bz-diary-pass');
    this.passInputEl = q<HTMLInputElement>('.bz-diary-pass-input');
    this.passErrEl = q('.bz-diary-pass-err');

    this.bindChrome();
    this.bindMenu();
    this.bindBlockEvents();
    this.bindLightbox();
    this.bindAlbum();
    this.bindCal();
    this.bindSlip();
    this.bindPass();
    this.bindTools();

    registerPanelEsc('diary', () => !!this.root && this.root.style.display === 'flex', () => this.escapeStack());

    // 评审便利：`window.__bzDiaryReplay()` 重放首屏（与旧墙同款钩子，插件内无害）
    (window as unknown as Record<string, unknown>).__bzDiaryReplay = () => this.show();
  }

  /** 渲染上下文：纯层要的两条回调——媒体地址 + 灯箱序号 */
  private ctx(): RenderCtx {
    const app = this.app();
    return {
      mediaSrc: (name: string) => this.mediaUrlOf(app, name),
      lbIndexOf: (name: string) => this.photoIndex.get(name) ?? 0,
    };
  }

  /** 媒体地址：data.ts 的解析（vault 相对/全局回退），解析不到返回空串（渲染层走占位） */
  private mediaUrlOf(app: App, name: string): string {
    return mediaSrc(app, name);
  }

  /** 页宽（单页模式跟视口走；桌面读 CSS 变量）——离屏测量盒与 StPageFlip 建书**共用这一个值** */
  private pageWidth(): number {
    if (typeof window !== 'undefined' && window.innerWidth <= SINGLE_MAX_W) {
      return Math.min(window.innerWidth * 0.92, 480);
    }
    const w = parseFloat(this.cssVar('--bz-diary-pg-w'));
    return Number.isFinite(w) && w > 0 ? w : 520;
  }

  /** 读域根上的 CSS 变量（宽度/内边距/书高的唯一来源） */
  private cssVar(name: string): string {
    if (!this.root) return '';
    return getComputedStyle(this.root).getPropertyValue(name);
  }

  /** 块高 = offsetHeight + 上下 margin（原型那张家手写 GAP 表已被这一步取代） */
  private blockHeightOf(el: HTMLElement): number {
    const cs = getComputedStyle(el);
    return el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  }

  // ============================================================
  //  排版：块流 → 测量 → 切页 → 建书
  // ============================================================

  private visibleEntries(): WallEntry[] {
    if (!this.filterTag) return this.entries;
    const tag = this.filterTag;
    return this.entries.filter((e) => e.tags.includes(tag));
  }

  /**
   * 重排整册。`keepRatio`：视口变化/回刷时按上次页数比例保住阅读位置（跟手不跳回最新）；
   * 换筛选、写完一篇等场景传 false（落回第 0 页 = 最新那篇）。
   * `keepPage`（ADR-0231）：钉住**当前页索引**不动——只往尾部续叠纸页时用（见 extendIfAtTail）：
   * 那种场景下总页数变了，按比例映射会把读者往前推，而位置其实本该纹丝不动。
   */
  private relayout(keepRatio: boolean, keepPage = false): number {
    const root = this.root;
    if (!root) return 0;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    this.epoch++;

    // 现场清理：在飞的翻页回调/灯箱/检索命中，引用的旧块马上全部销毁
    this.closeLightbox();
    this.closeSheet();
    this.pauseAllAudio();
    this.search = { kw: null, hits: [], i: 0 };

    // 清空书芯但保住 StPageFlip 容器（库实例随后 destroy/重建；库的 destroy 会摘掉容器）
    const fbHost = this.flipHost;
    this.blockEl.innerHTML = '';
    if (fbHost) this.blockEl.appendChild(fbHost);

    const single = typeof window !== 'undefined' && window.innerWidth <= SINGLE_MAX_W;
    this.single = single;
    root.classList.toggle('bz-diary-single', single);

    // ADR-0231：`all` = 已加载的全部（计数 / 查找 / 灯箱用），`list` = 排版窗口。
    // 排版是这一域最贵的一步，窗口化是首屏能出来、且后台读到新条目时**不必重排**的前提。
    const all = this.visibleEntries();
    const list = all.slice(0, Math.max(0, this.shown));
    this.byEid = new Map(all.map((e) => [e.id || '', e]));
    this.photoRefs = collectPhotoRefs(all);
    this.photoIndex = new Map(this.photoRefs.map((p, i) => [p.media.name, i]));

    // 离屏测量盒：宽度/内边距全读 CSS（.bz-diary-probe），不在 JS 里重复一份
    const probe = document.createElement('div');
    probe.className = 'bz-diary-probe';
    root.appendChild(probe);
    const padT = parseFloat(getComputedStyle(probe).paddingTop) || 88;
    const padB = parseFloat(getComputedStyle(probe).paddingBottom) || 66;
    const bookH = this.bookEl.clientHeight || parseFloat(this.cssVar('--bz-diary-pg-h')) || 700;
    const availH = bookH - padT - padB;

    // 1) 块流：日戳 + 条目块（票根/藏书票/信封的归位由 render 层决定）
    const ctx = this.ctx();
    const flow: FlowItem[] = [];
    let lastDate: string | null = null;
    const dayCount = new Map<string, number>();
    // 日戳「当天几则」按**已加载的全部**算（含窗口外），只排窗口内的条目——
    // 否则窗口边界那天会数少。条目数不参与排版成本，多算不亏。
    for (const e of all) dayCount.set(e.date, (dayCount.get(e.date) || 0) + 1);
    for (const e of list) {
      if (e.date !== lastDate) {
        lastDate = e.date;
        flow.push({ el: elOf(daystampHTML(e.date, dayCount.get(e.date) || 1)), h: 0, keep: true });
      }
      for (const html of entryBlockHTMLs(e, ctx)) flow.push({ el: elOf(html), h: 0 });
    }

    // 2) 一次 reflow 全量测量（读完 offsetHeight 再读 margin，不会再触发一次布局）
    for (const f of flow) probe.appendChild(f.el);
    void probe.offsetHeight;
    for (const f of flow) f.h = this.blockHeightOf(f.el);

    // 3) 切页
    this.pages = paginateFlow(
      flow,
      availH,
      (el, avail) => this.splitParagraph(el, avail, probe),
      (el) => this.blockHeightOf(el)
    );
    probe.innerHTML = '';
    probe.remove();

    this.renderEdgeMarks();

    // 4) 目标页：保比例，否则落第一页（最新排在最前，第一页就是最新）
    const last = Math.max(0, this.pages.length - 1);
    let target = 0;
    if (keepPage) {
      // 只往尾部续叠过纸页：页索引语义没变，钉住它就行（按比例算反而会把读者往前推）
      target = Math.max(0, Math.min(last, this.cursor));
    } else if (keepRatio && this.lastSpreadCount > 1) {
      target = Math.round((this.cursor / (this.lastSpreadCount - 1)) * last);
    }
    this.lastSpreadCount = this.pages.length;
    this.buildBook(Math.max(0, Math.min(last, target)));
    this.refreshBookRect();
    return (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
  }

  /** 段落内第 idx 个字符落在哪个文本节点的哪个偏移 */
  private textPos(root: Node, idx: number): [Node, number] | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let acc = 0;
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const len = n.nodeValue?.length || 0;
      if (idx <= acc + len) return [n, idx - acc];
      acc += len;
    }
    return null;
  }

  /**
   * 段落按目标高度用 Range 二分切两半（逐行续排）；返回 `[上半, 下半, 下半高]` 或 null。
   * 带行内格式（wikilink/加粗/高亮/删除线…）的段同样能切：下半是整段克隆后删掉前缀，
   * 两边的行内格式都保住。切点对齐句读，避免词中腰斩。
   */
  private splitParagraph(el: HTMLElement, availPx: number, probe: HTMLElement): [HTMLElement, HTMLElement, number] | null {
    const text = el.textContent || '';
    if (text.length < 40 || availPx < 70) return null;
    const range = document.createRange();
    let lo = 1;
    let hi = text.length;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const pos = this.textPos(el, mid);
      if (pos) {
        range.setStart(el, 0);
        range.setEnd(pos[0], pos[1]);
        if (range.getBoundingClientRect().height <= availPx) {
          best = mid;
          lo = mid + 1;
          continue;
        }
      }
      hi = mid - 1;
    }
    if (best < 16) return null;
    let cut = best;
    const from = Math.max(0, best - 24);
    const stops = '。!?;,:、~…」』”" ';
    for (let k = best - 1; k >= from; k--) {
      if (stops.indexOf(text[k]) >= 0) {
        cut = k + 1;
        break;
      }
    }
    if (cut < 10 || cut > text.length - 6) return null;

    const down = el.cloneNode(true) as HTMLElement;
    const dp = this.textPos(down, cut);
    const up = this.textPos(el, cut);
    if (!dp || !up) return null;
    const rd = document.createRange();
    rd.setStart(down, 0);
    rd.setEnd(dp[0], dp[1]);
    rd.deleteContents();
    const ru = document.createRange();
    ru.setStart(up[0], up[1]);
    ru.setEnd(el, el.childNodes.length);
    ru.deleteContents();

    down.className = el.className.replace('bz-diary-p-indent', 'bz-diary-p-cont');
    down.dataset.eid = el.dataset.eid || '';
    probe.insertBefore(down, el.nextSibling);
    return [el, down, this.blockHeightOf(down)];
  }

  /** 建 StPageFlip 书：页元素 → 库，翻页动画/拖拽/纸张弯曲全交库 */
  private buildBook(targetPage: number): void {
    const host = this.flipHost;
    if (this.flip) {
      try {
        this.flip.destroy();
      } catch {
        /* 重复销毁无害 */
      }
      this.flip = null;
    }
    /* 库的 destroy() 会把容器整个从 DOM 摘掉，必须放回去 */
    host.innerHTML = '';
    this.blockEl.appendChild(host);

    const items: HTMLElement[] = [];
    for (let pi = 0; pi < this.pages.length; pi++) {
      const d = document.createElement('div');
      d.className = 'bz-diary-page-item';
      const inner = document.createElement('div');
      inner.className = 'bz-diary-page-inner';
      for (const el of this.pages[pi]) inner.appendChild(el);
      d.appendChild(inner);
      /* 为「每天起于左页」补出来的空白背面不印页码（素纸上一个号最扎眼） */
      if (this.pages[pi].length) {
        const no = document.createElement('div');
        no.className = 'bz-diary-page-no';
        no.textContent = `— ${pi + 1} —`;
        d.appendChild(no);
      }
      items.push(d);
    }

    const pgW = this.pageWidth();
    const pgH = this.bookEl.clientHeight || parseFloat(this.cssVar('--bz-diary-pg-h')) || 700;
    this.flip = new PageFlip(host, {
      width: pgW,
      height: pgH,
      size: 'fixed',
      usePortrait: this.single,
      maxShadowOpacity: 0.5,
      showCover: false, // 没有封面页：直接按跨页排（0=左，1=右）
      mobileScrollSupport: false,
      flippingTime: FLIP_TIME_MS,
      useMouseEvents: true,
      disableFlipByClick: true, // 点击翻页由本域自管（且已按用户要求取消四角点击）
      showPageCorners: false,
    });
    this.flip.loadFromHTML(items);
    this.flip.turnToPage(Math.max(0, targetPage));
    this.flip.on('flip', (e) => {
      this.cursor = e.data;
      // 拖拽/键盘翻到书尾也要能续上（点「下一页」那条走 turnPage）。
      // **延后一拍**再续：续叠会 destroy 当前 StPageFlip 实例，而这条回调是库自己
      // 在翻页流程里发的——在它的回调栈里把实例拆掉风险不可控。让出一拍最稳。
      this.scheduleExtend();
    });
    this.cursor = Math.max(0, targetPage);
    this.afterPagesBuilt(host);
  }

  /** 每次建书后要重挂的东西：显影 / 媒体失败态 / 录音卡 */
  private afterPagesBuilt(scope: HTMLElement): void {
    this.developPhotos(scope);
    this.bindMediaErrors(scope);
    this.bindAudios(scope);
  }

  private turnPage(dir: 1 | -1): void {
    if (!this.flip) return;
    if (dir > 0) {
      // 已在书尾而窗口外还有条目 → 续叠一批，别让「下一页」变成没反应
      if (this.extendIfAtTail()) return;
      this.flip.flipNext();
    } else this.flip.flipPrev();
  }

  /**
   * 翻到书尾就推宽排版窗口一批（ADR-0231）。返回是否真的推宽了。
   *
   * 为什么必须「只往尾部追加」：`paginateFlow` 是从最新往最早**顺序**装页的，往流尾加条目
   * 不会改动前面任何一页的边界 ⇒ 当前页索引语义不变、读者看到的那一页原地不动。
   * `relayout(false, true)` 的 `keepPage` 就是为这条准备的。
   *
   * 代价（诚实版）：这是**整窗重排**——`paginateFlow` 对加宽后的窗口重跑一遍、一次 reflow 量高、
   * `buildBook` 重建 StPageFlip 实例；**不是**「只测新增条目」。之所以可接受：成本以**窗口**为界
   * （不是 1243 全量），且只在用户主动翻到书尾这一刻发生。StPageFlip v2.0.7 没有 `addPage`，
   * 动态加页本就得整实例重建，所以这一次重建省不掉；真要省下重测，得按条目 id 缓存块高。
   *
   * 「书尾」的判据见 `lastReachableCursor()`——**不是** `pages.length - 1`，别改回去。
   */
  private extendIfAtTail(): boolean {
    if (this.extending) return false;
    const all = this.visibleEntries();
    if (this.shown >= all.length) return false; // 窗口已覆盖全部已加载条目
    if (!this.pages.length) return false;
    if (this.cursor < lastReachableCursor(this.pages.length, this.single)) return false;
    const next = Math.min(this.shown + LIST_BATCH_SIZE, all.length);
    if (next <= this.shown) return false;
    this.extending = true;
    try {
      this.shown = next;
      this.relayout(false, true);
      return true;
    } finally {
      this.extending = false;
    }
  }

  /** 延后一拍再续叠（见 `buildBook` 的 `flip` 钩子）：合并同一拍内的多次 flip，不排队多份。 */
  private scheduleExtend(): void {
    if (this.extendTimer !== null) return;
    this.extendTimer = setTimeout(() => {
      this.extendTimer = null;
      this.extendIfAtTail();
    }, 0);
  }

  private jumpToPage(pi: number): void {
    if (!this.flip || !this.pages.length) return;
    this.flip.turnToPage(Math.max(0, Math.min(this.pages.length - 1, pi)));
  }

  // ============================================================
  //  书口：年份染色 + 册页索引
  // ============================================================

  private monthMarksOf(): MonthMark[] {
    return monthMarks(this.pages, this.visibleEntries());
  }

  /**
   * 书口年份染色带：只作「这几年各占多厚」的缩影（整条边缘才是那个大按钮——点开抽索引）。
   * 只有一年时不画：一条通高的色带等于没有信息，只是把整条书口刷成一块颜色。
   * `top`/`height` 是量出来的几何（行为性内联值）；颜色按年序轮转走 `.bz-diary-ey-N` 类。
   */
  private renderEdgeMarks(): void {
    const edge = this.edgeEl;
    edge.querySelectorAll('.bz-diary-edge-year').forEach((b) => b.remove());
    const months = this.monthMarksOf();
    if (!months.length) return;
    const total = Math.max(1, this.pages.length);
    const years: { y: string; from: number }[] = [];
    for (const m of months) {
      const y = m.key.slice(0, 4);
      if (!years.length || years[years.length - 1].y !== y) years.push({ y, from: m.page1 });
    }
    if (years.length < 2) return;
    years.forEach((sg, i) => {
      const top = ((sg.from - 1) / total) * 100;
      const endFrom = i + 1 < years.length ? years[i + 1].from : total + 1;
      /* 先按页数占比算高，再夹住 —— 不夹的话最旧那年只占 2% 时会被撑到 5%，
         色带就拖出书口、露出书底一截 */
      let h = Math.max(1.2, ((endFrom - 1) / total) * 100 - top);
      h = Math.min(h, 100 - top);
      const b = document.createElement('div');
      b.className = `bz-diary-edge-year bz-diary-ey-${i % 8}`;
      b.style.top = `${top}%`;
      b.style.height = `${h}%`;
      edge.appendChild(b);
    });
  }

  /** 点书口 → 抽出「册页索引」那张纸：一年一段、一月一行 */
  private openIndexSheet(): void {
    const months = this.monthMarksOf();
    const list = this.visibleEntries();
    if (!months.length || !list.length) {
      this.toast('册页还空着');
      return;
    }
    const total = list.length;
    /* 条目最新在前：list[0] 是最新一篇，list[last] 是最旧一篇 */
    let html =
      '<div class="bz-diary-sheet-meta">自 ' +
      list[total - 1].date +
      ' 至 ' +
      list[0].date +
      ' · 凡 ' +
      cnNum(total) +
      ' 则 · ' +
      cnNum(months.length) +
      ' 个月</div>';
    let curY: string | null = null;
    let open = false;
    for (const m of months) {
      const parts = m.key.split('-');
      if (parts[0] !== curY) {
        if (open) html += '</div></div>';
        html += `<div class="bz-diary-idx-year"><div class="bz-diary-iy-head">${parts[0]} 年</div><div class="bz-diary-iy-months">`;
        curY = parts[0];
        open = true;
      }
      html +=
        `<div class="bz-diary-idx-row" data-jump-page="${m.page1 - 1}">` +
        `<span class="bz-diary-ir-m">${parseInt(parts[1], 10)} 月</span><span class="bz-diary-ir-dots"></span>` +
        `<span class="bz-diary-ir-n">${cnNum(m.n)} 则</span><span class="bz-diary-ir-p">第 ${m.page1} 页</span></div>`;
    }
    if (open) html += '</div></div>';
    this.openSheet('册 页 索 引', html);
  }

  // ============================================================
  //  媒体：显影 / 失败态 / 录音卡 / 加密媒体
  // ============================================================

  /** 照片显影：加载完成即从药水里显出；冲不出来的给占位相纸 */
  private developPhotos(root: HTMLElement): void {
    root.querySelectorAll<HTMLImageElement>('.bz-diary-ph-media img').forEach((img) => {
      if (img.dataset.dev) return;
      img.dataset.dev = '1';
      const dev = () => img.classList.add('bz-diary-develop');
      if (img.complete && img.naturalWidth) {
        dev();
        return;
      }
      img.addEventListener('load', dev, { once: true });
      img.addEventListener(
        'error',
        () => {
          const m = img.parentElement;
          if (m && m.isConnected) {
            img.remove();
            const ph = document.createElement('div');
            ph.className = 'bz-diary-ph-empty';
            ph.textContent = '相片未冲出';
            m.appendChild(ph);
          }
        },
        { once: true }
      );
    });
  }

  /**
   * 媒体失败 → 换占位类（**不写内联样式**：`data-media-err` 的值就是失败时要换上的类全名，
   * 这是 render 层与行为层的约定，见 render.ts 头注第 3 条）。
   */
  private bindMediaErrors(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('img[data-media-err]').forEach((img) => {
      if (img.dataset.mediaErrWired) return;
      img.dataset.mediaErrWired = '1';
      img.addEventListener(
        'error',
        () => {
          const target = img.dataset.mediaErr;
          if (target) img.className = target;
          img.removeAttribute('src');
          delete img.dataset.mediaErr;
        },
        { once: true }
      );
    });
  }

  private fmtClock(s: number): string {
    const v = Math.max(0, Math.floor(s || 0));
    return `${Math.floor(v / 60)}:${pad2(v % 60)}`;
  }

  private pauseAllAudio(): void {
    if (!this.root) return;
    this.root.querySelectorAll('audio').forEach((a) => {
      try {
        a.pause();
      } catch {
        /* 已随重排销毁 */
      }
    });
  }

  private toggleAudio(card: HTMLElement): void {
    const wrap = card.closest('.bz-diary-b-audio');
    const a = wrap?.querySelector('audio');
    if (!a) return;
    if (a.paused) {
      // 一次只放一段：换了这张卡，前面那段自己停
      this.root?.querySelectorAll('audio').forEach((o) => {
        if (o !== a) {
          try {
            o.pause();
          } catch {
            /* 忽略 */
          }
        }
      });
      void a.play().catch(() => this.toast('这段录音放不出来'));
    } else a.pause();
  }

  /** 录音卡：自绘播放键驱动隐藏的 `<audio>` */
  private bindAudios(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('.bz-diary-b-audio').forEach((wrap) => {
      if (wrap.dataset.wired) return;
      wrap.dataset.wired = '1';
      const a = wrap.querySelector('audio');
      const card = wrap.querySelector<HTMLElement>('.bz-diary-ba-card');
      if (!a || !card) return;
      const bar = card.querySelector<HTMLElement>('.bz-diary-ba-bar i');
      const tm = card.querySelector<HTMLElement>('.bz-diary-ba-time');
      const btn = card.querySelector<HTMLElement>('.bz-diary-ba-play');
      const idle = () => {
        if (btn) btn.textContent = '▷';
        wrap.classList.remove('bz-diary-playing');
        if (bar) bar.style.width = '0';
        if (tm) tm.textContent = isFinite(a.duration) && a.duration ? this.fmtClock(a.duration) : '--:--';
      };
      a.addEventListener('loadedmetadata', () => {
        if (a.paused) idle();
      });
      a.addEventListener('play', () => {
        if (btn) btn.textContent = '❚❚';
        wrap.classList.add('bz-diary-playing');
      });
      a.addEventListener('pause', idle);
      a.addEventListener('ended', idle);
      a.addEventListener('timeupdate', () => {
        if (!isFinite(a.duration) || !a.duration) {
          if (tm) tm.textContent = this.fmtClock(a.currentTime);
          return;
        }
        if (bar) bar.style.width = `${(a.currentTime / a.duration) * 100}%`;
        if (tm) tm.textContent = `-${this.fmtClock(a.duration - a.currentTime)}`;
      });
      a.addEventListener('error', () => {
        if (tm) tm.textContent = '放不出';
      });
    });
  }

  /**
   * 加密条目的媒体按需解密（保险箱附件镜像 → 原始层 base64 → data URL）。
   * 带缓存（含失败结果，避免渲染风暴下反复解密）；未解锁/无附件/解密失败返回 null（保持占位）。
   */
  private encryptedMediaUrl(noteId: string, k: WallMedia): Promise<string | null> {
    if (!noteId) return Promise.resolve(null);
    const key = `${noteId}|${k.kind}|${k.name}`;
    let p = this.encMediaCache.get(key);
    if (!p) {
      p = this.decryptEncMedia(noteId, k);
      this.encMediaCache.set(key, p);
    }
    return p;
  }

  private async decryptEncMedia(noteId: string, k: WallMedia): Promise<string | null> {
    try {
      const { getSafeManager } = (await import('../encrypt')) as typeof import('../encrypt');
      const safe = getSafeManager();
      if (!safe.unlocked) return null;
      const note = safe.manifest?.notes.find((n) => n.id === noteId);
      if (!note) return null;
      const att = note.attachments.find((a) => a.path === k.name || a.path.endsWith(`/${k.name}`));
      if (!att) return null;
      const b64 = await safe.decryptAttachmentOriginal(att);
      if (!b64) return null;
      return `data:${mimeOfMediaName(k.name)};base64,${b64}`;
    } catch {
      return null; // 加密域未初始化/密码本未注入：保持占位不阻断
    }
  }

  /** 拆信后的那张纸上若带照片：加密媒体解出后挂 src（并走显影） */
  private async mountEncryptedMedia(scope: HTMLElement, noteId: string): Promise<void> {
    const els = scope.querySelectorAll<HTMLElement>('[data-enc-name]');
    for (const el of Array.from(els)) {
      const name = el.dataset.encName || '';
      const kind = (el.dataset.encKind || 'img') as WallMedia['kind'];
      const url = await this.encryptedMediaUrl(noteId, { name, kind });
      if (!url || !el.isConnected) continue;
      if (el instanceof HTMLImageElement) {
        el.addEventListener('load', () => el.classList.add('bz-diary-develop'), { once: true });
        el.src = url;
      } else if (el instanceof HTMLVideoElement) {
        el.src = url;
        el.preload = 'metadata';
      } else if (el instanceof HTMLAudioElement) {
        el.src = url;
        el.preload = 'metadata';
      }
    }
  }

  // ============================================================
  //  交互：滚轮 / 键盘 / 缩放
  // ============================================================

  private bindChrome(): void {
    /* 四角点击翻页已按用户要求取消：翻页只留 拖拽 / 滚轮 / ← → 三条路 */
    this.bookEl.addEventListener(
      'wheel',
      (ev: WheelEvent) => {
        if (!this.flip) return;
        ev.preventDefault();
        const now = Date.now();
        if (now - this.wheelLock < WHEEL_LOCK_MS) return;
        this.wheelLock = now;
        this.turnPage(ev.deltaY > 0 ? 1 : -1);
      },
      { passive: false }
    );

    /* Esc 必须排在「输入框早退」之前：纸条一打开就自动聚焦输入框，
       早退先挡一道，Esc 就永远到不了 esc 栈。早退只该管方向键。 */
    document.addEventListener('keydown', this.onKeydown);

    /* 常驻出口：右上角「收起」钮 */
    this.closeEl.addEventListener('click', () => this.hide());

    /* 点遮罩空白处 = 收起整本（与其他域「点遮罩关闭」同口径）。
       书 / 文具 / 各浮层都是 desk 的子节点，点它们不会命中这层；
       有浮层开着时交给浮层自己的 click-outside，此处不抢。 */
    const root = this.root;
    root?.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (t !== root && !t.classList.contains('bz-diary-desk')) return;
      if (
        !this.lightboxEl.hidden ||
        !this.sheetEl.hidden ||
        !this.slipEl.hidden ||
        !this.albumEl.hidden ||
        !this.calEl.hidden ||
        !this.menuEl.hidden ||
        !this.passEl.hidden
      ) {
        return;
      }
      this.hide();
    });

    /* 窗口高矮会改书高（--pg-h 的短屏规则），书高变了必须重排，不能只盯宽度 */
    this.lastSingle = typeof window !== 'undefined' && window.innerWidth <= SINGLE_MAX_W;
    this.lastW = typeof window !== 'undefined' ? window.innerWidth : 0;
    this.lastH = typeof window !== 'undefined' ? window.innerHeight : 0;
    window.addEventListener('resize', this.onResize);
  }

  private onKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      this.escapeStack();
      return;
    }
    if (ev.target instanceof Element && ev.target.matches('input, textarea')) return;
    if (!this.lightboxEl.hidden) {
      if (ev.key === 'ArrowLeft') {
        this.lbStep(-1);
        return;
      }
      if (ev.key === 'ArrowRight') {
        this.lbStep(1);
        return;
      }
    }
    if (ev.key === 'ArrowLeft') this.turnPage(-1);
    if (ev.key === 'ArrowRight') this.turnPage(1);
  };

  private onResize = (): void => {
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null;
      this.applyBookZoom();
      const s = window.innerWidth <= SINGLE_MAX_W;
      const h = window.innerHeight;
      const w = window.innerWidth;
      const hChanged = Math.abs(h - this.lastH) > 40;
      /* 单页模式页宽跟着视口走：**宽度变了也得重排**，否则库还按旧宽摆页、CSS 已把书缩了 */
      const wChanged = s && Math.abs(w - this.lastW) > 16;
      this.lastH = h;
      this.lastW = w;
      if (s !== this.lastSingle || hChanged || wChanged) {
        this.lastSingle = s;
        this.relayout(true);
      } else this.refreshBookRect();
    }, 380);
  };

  /**
   * 书的整体缩放：窗口比书窄时把书缩进遮罩。
   * 原本想用 CSS `calc((100vw - 30px) / 1060)` 得纯数 —— 长度除以数**出来还是长度**，
   * `scale()` 吃不下，整条 `transform` 在 ≤1120px 直接失效变 none，书就偏到右半边
   * （左沿钉在视口中线上）。改由 JS 算成无单位数发号；≤720 单页档恒为 1。
   */
  private applyBookZoom(): void {
    if (!this.root) return;
    const w = window.innerWidth;
    // 书皮比纸宽（inset -16px 两侧），1072 = 1040 + 32；留 30px 呼吸边
    const zoom = w <= SINGLE_MAX_W ? 1 : Math.min(1, (w - 30) / 1072);
    this.root.style.setProperty('--bz-diary-book-zoom', zoom.toFixed(4));
  }

  /** Esc 分流：纸条 → 贴纸册 → 台历 → 抽出的一张纸 → 灯箱 → 便签 → 翻回最新 */
  private escapeStack(): void {
    if (!this.root || this.root.style.display !== 'flex') return;
    if (!this.passEl.hidden) {
      this.closePass(false);
      return;
    }
    if (!this.slipEl.hidden) {
      this.closeSlip();
      return;
    }
    if (!this.albumEl.hidden) {
      this.closeAlbum();
      return;
    }
    if (!this.calEl.hidden) {
      this.closeCal();
      return;
    }
    if (!this.sheetEl.hidden) {
      this.closeSheet();
      return;
    }
    if (!this.lightboxEl.hidden) {
      this.closeLightbox();
      return;
    }
    if (!this.menuEl.hidden) {
      this.closeMenu();
      return;
    }
    /* 没有扉页可「合上」：ESC 分两步收尾——先翻回最新那一页，再关掉整本
       （此前只翻回第 0 页就停住，等于面板永远关不掉：整屏场景里再没有别的出口） */
    if (this.flip && this.cursor > 0) {
      this.jumpToPage(0);
      this.toast('翻到最新');
      return;
    }
    this.hide();
  }

  // ============================================================
  //  块级事件（一次委托）：录音 / wiki / 重封 / 照片 / 票根·藏书票 / 信封
  // ============================================================

  private bindBlockEvents(): void {
    this.blockEl.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      const aud = t.closest<HTMLElement>('.bz-diary-ba-card');
      if (aud) {
        this.toggleAudio(aud);
        return;
      }
      const wl = t.closest<HTMLElement>('.bz-diary-wikilink');
      if (wl) {
        this.openWikilink(wl);
        return;
      }
      const reseal = t.closest<HTMLElement>('.bz-diary-env-reseal');
      if (reseal) {
        reseal.closest('.bz-diary-envelope')?.classList.remove('bz-diary-unsealed', 'bz-diary-opening');
        this.closeSheet();
        this.toast('重新封缄了');
        return;
      }
      const ph = t.closest<HTMLElement>('.bz-diary-photo');
      if (ph && ph.dataset.lb != null) {
        /* 加密条目的媒体不入灯箱（无 data-lb），别把 0 当页号 */
        this.openLightbox(Number(ph.dataset.lb));
        return;
      }
      const more = t.closest<HTMLElement>('.bz-diary-tk-more');
      if (more) {
        this.openReviewSheet(this.byEid.get(more.closest<HTMLElement>('.bz-diary-ticket')?.dataset.eid || ''));
        return;
      }
      const env = t.closest<HTMLElement>('.bz-diary-envelope');
      if (env) {
        this.onEnvelope(env);
        return;
      }
      const ex = t.closest<HTMLElement>('.bz-diary-exlibris');
      if (ex) this.openReviewSheet(this.byEid.get(ex.dataset.eid || ''));
    });
  }

  /** `[[双链]]`：书页里点它跳原文 */
  private openWikilink(el: HTMLElement): void {
    const target = el.dataset.target;
    if (!target) return;
    const app = this.app();
    const file = app.metadataCache.getFirstLinkpathDest(target, '');
    if (file) void app.workspace.getLeaf(false).openFile(file);
    else this.toast(`找不到「${el.textContent || target}」`);
  }

  // ============================================================
  //  抽出的一张纸（全文阅读：影评 / 书评 / 拆开的信 / 册页索引）
  // ============================================================

  private openSheet(title: string, src: string | HTMLElement): void {
    this.sheetTitleEl.textContent = title || '';
    this.sheetBodyEl.innerHTML = '';
    if (typeof src === 'string') this.sheetBodyEl.innerHTML = src;
    else this.sheetBodyEl.appendChild(src);
    this.sheetEl.hidden = false;
    this.developPhotos(this.sheetBodyEl);
    this.bindMediaErrors(this.sheetBodyEl);
    this.bindAudios(this.sheetBodyEl);
  }

  private closeSheet(): void {
    if (!this.sheetEl || this.sheetEl.hidden) return;
    this.sheetEl.hidden = true;
    this.pauseAllAudio();
    this.sheetBodyEl.innerHTML = '';
  }

  private bindSheet(): void {
    this.sheetEl.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      const ph = t.closest<HTMLElement>('.bz-diary-photo');
      if (ph && ph.dataset.lb != null) {
        this.openLightbox(Number(ph.dataset.lb));
        return;
      }
      const aud = t.closest<HTMLElement>('.bz-diary-ba-card');
      if (aud) {
        this.toggleAudio(aud);
        return;
      }
      /* 册页索引：点一行跳到那个月，纸就收回去 */
      const row = t.closest<HTMLElement>('.bz-diary-idx-row');
      if (row) {
        this.closeSheet();
        this.jumpToPage(Number(row.dataset.jumpPage || 0));
        return;
      }
      if (t.closest('.bz-diary-sheet-paper') && !t.closest('.bz-diary-sh-close')) return;
      this.closeSheet();
    });
  }

  /** 长文 → 纸上的段落 */
  private sheetParas(text: string): string {
    return String(text || '')
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `<div class="bz-diary-b-para bz-diary-p-indent">${inlineMd(s)}</div>`)
      .join('');
  }

  /** 影评 / 书评全文纸 */
  private openReviewSheet(e: WallEntry | undefined): void {
    if (!e) return;
    const x = e.extra || {};
    if (e.kind === 'movie') {
      this.openSheet(
        `《${x.title || ''}》影评`,
        `<div class="bz-diary-sheet-meta">${e.date} 观影 · ${e.tags
          .map((t) => `${getTagEmoji(t)}${t}`)
          .join(' ')}</div>${this.sheetParas(x.review || '')}`
      );
    } else if (e.kind === 'book') {
      this.openSheet(
        `《${x.title || ''}》书评`,
        `<div class="bz-diary-sheet-meta">${[x.author, x.category, e.date ? `读毕 ${e.date}` : '']
          .filter(Boolean)
          .join(' · ')}</div>${this.sheetParas(x.review || '')}`
      );
    }
  }

  /**
   * 拆开的信 / 解封的加密条目：全文（含照片）按需装进一张纸。
   * render 层对 `encrypted` 条目只出信封，故走 `unwrap`（跳过信封分支）——
   * **条目仍带着 `encrypted` 身份**，媒体段才会发出 `data-enc-name` 挂载点，
   * 由 `mountEncryptedMedia` 解密后补 src（内容一字不差，只是不走信封那条分支）。
   */
  private buildUnsealed(e: WallEntry): HTMLElement {
    const box = document.createElement('div');
    for (const html of entryBlockHTMLs(e, this.ctx(), { unwrap: true })) {
      box.appendChild(elOf(html));
    }
    return box;
  }

  // ============================================================
  //  灯箱（相纸显影）
  // ============================================================

  private openLightbox(i: number): void {
    if (!this.photoRefs[i]) return;
    this.lbIdx = i;
    this.renderLightbox();
    this.lightboxEl.hidden = false;
  }

  private lbStep(d: 1 | -1): void {
    if (this.lightboxEl.hidden || !this.photoRefs.length) return;
    this.lbIdx = (this.lbIdx + d + this.photoRefs.length) % this.photoRefs.length;
    this.renderLightbox();
  }

  private renderLightbox(): void {
    const p = this.photoRefs[this.lbIdx];
    if (!p) return;
    const app = this.app();
    const src = this.mediaUrlOf(app, p.media.name);
    this.lbMediaEl.innerHTML = '';
    if (p.media.kind === 'video') {
      const v = document.createElement('video');
      v.src = src;
      v.controls = true;
      v.autoplay = true;
      v.loop = true;
      v.playsInline = true;
      this.lbMediaEl.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      this.lbMediaEl.appendChild(img);
    }
    /* 确定性微旋角（类，非内联）：原型是 `style.setProperty('--lb-tilt', …)` */
    this.lbPhotoEl.className = `bz-diary-lb-photo ${tiltClassOf(this.lbIdx + 3)}`;
    const cap = p.media.name.split('/').pop() || '';
    this.lbCapEl.textContent = `${p.entry.date} ${p.entry.time} · ${cap}`;
    this.lbCountEl.textContent = `${this.lbIdx + 1} / ${this.photoRefs.length}`;
  }

  private closeLightbox(): void {
    if (!this.lightboxEl) return;
    this.lightboxEl.hidden = true;
    this.lbMediaEl.innerHTML = '';
  }

  private bindLightbox(): void {
    this.lightboxEl.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (t.closest('.bz-diary-lb-prev')) {
        this.lbStep(-1);
        return;
      }
      if (t.closest('.bz-diary-lb-next')) {
        this.lbStep(1);
        return;
      }
      if (t.closest('.bz-diary-lb-media') || t.closest('.bz-diary-lb-photo')) return;
      this.closeLightbox();
    });
  }

  // ============================================================
  //  便签菜单（右键 / 长按）
  // ============================================================

  private openMenu(pos: MenuPos, eid: string): void {
    const e = this.byEid.get(eid);
    if (!e) return;
    this.menuEid = eid;
    const show = (act: string, on: boolean) => {
      const el = this.menuEl.querySelector<HTMLElement>(`.bz-diary-mn-item[data-act="${act}"]`);
      if (el) el.hidden = !on;
    };
    const isDiary = e.kind === 'diary';
    const enc = !!e.encrypted;
    show('retype', isDiary && !enc);
    show('envelope', isDiary && !enc);
    show('unseal', enc);
    show('takeout', enc);
    show('copytext', true);
    /* 影视/信/书没有 filePath（只有完整 vault 路径的 filename），但 copyLink 正是按 filename 拼的
       文件级双链——不能用 filePath 一个字段把它们一起挡在门外。加密条目反倒没有「位置」可誊，
       只给誊录正文（copyLink 对它也是复制正文）。 */
    show('copylink', !enc && !!(e.filePath || e.filename));
    show('tear', isDiary);
    const tear = this.menuEl.querySelector<HTMLElement>('.bz-diary-mn-item[data-act="tear"]');
    if (tear) tear.textContent = enc ? '撕掉（销毁密文）' : '撕掉';
    this.menuEl.hidden = false;
    /* 夹在窗口内：上下都要夹（只有上界时，窗口比菜单窄 left 会是负数） */
    const mw = this.menuEl.offsetWidth;
    const mh = this.menuEl.offsetHeight;
    this.menuEl.style.left = `${Math.max(10, Math.min(pos.x, window.innerWidth - mw - 10))}px`;
    this.menuEl.style.top = `${Math.max(10, Math.min(pos.y, window.innerHeight - mh - 10))}px`;
  }

  private closeMenu(): void {
    if (!this.menuEl) return;
    this.menuEl.hidden = true;
    this.menuEid = null;
  }

  private bindMenu(): void {
    this.menuEl.addEventListener('click', (ev) => {
      const it = (ev.target as HTMLElement).closest<HTMLElement>('.bz-diary-mn-item');
      if (!it || !this.menuEid) return;
      const e = this.byEid.get(this.menuEid);
      this.closeMenu();
      if (!e) return;
      switch (it.dataset.act) {
        case 'retype':
          this.editTags(e);
          break;
        case 'envelope':
          void this.encryptEntryAction(e);
          break;
        case 'unseal':
          this.unsealEntry(e);
          break;
        case 'takeout':
          void this.decryptEntryAction(e);
          break;
        case 'copytext':
          writeClipboard(plainTextOf(e), '誊好了，在剪贴板里', '誊不成……');
          break;
        case 'copylink':
          void this.copyLink(e);
          break;
        case 'tear':
          void this.tearEntry(e);
          break;
      }
    });
    document.addEventListener('pointerdown', this.onDocPointerDown, true);

    this.blockEl.addEventListener('contextmenu', (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-eid]');
      if (!t) return;
      ev.preventDefault();
      this.closeMenu();
      this.openMenu({ x: ev.clientX, y: ev.clientY }, t.dataset.eid || '');
    });

    /* 长按（触屏）：500ms 不动就开便签 */
    let lpTimer: ReturnType<typeof setTimeout> | null = null;
    let lpPos: MenuPos | null = null;
    this.blockEl.addEventListener(
      'touchstart',
      (ev: TouchEvent) => {
        const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-eid]');
        if (!t) return;
        const f = ev.touches[0];
        if (!f) return;
        lpPos = { x: f.clientX, y: f.clientY };
        lpTimer = setTimeout(() => {
          if (lpPos) this.openMenu(lpPos, t.dataset.eid || '');
        }, 500);
      },
      { passive: true }
    );
    this.blockEl.addEventListener(
      'touchmove',
      (ev: TouchEvent) => {
        if (!lpTimer || !lpPos) return;
        const f = ev.touches[0];
        if (f && (Math.abs(f.clientX - lpPos.x) > 12 || Math.abs(f.clientY - lpPos.y) > 12)) {
          clearTimeout(lpTimer);
          lpTimer = null;
        }
      },
      { passive: true }
    );
    /* touchend / touchcancel 都要清计时——真机长按正文时系统选择浮标会发 touchcancel，
       不清的话计时器还会在抬手后补开一次菜单 */
    const cancelLp = () => {
      if (lpTimer) clearTimeout(lpTimer);
      lpTimer = null;
    };
    this.blockEl.addEventListener('touchend', cancelLp);
    this.blockEl.addEventListener('touchcancel', cancelLp);
  }

  private onDocPointerDown = (ev: PointerEvent): void => {
    if (!(ev.target as HTMLElement).closest?.('.bz-diary-menu')) this.closeMenu();
  };

  // ============================================================
  //  条目动作：复制 / 改标签 / 加密 / 解密 / 撕掉
  // ============================================================

  /** 双链：加密条目无 md 锚点 → 复制正文；影视/信/书 → 文件级双链；普通条目 → 本域 copyDiaryLink */
  private async copyLink(e: WallEntry): Promise<void> {
    try {
      if (e.encrypted) {
        await navigator.clipboard.writeText(e.content || e.text || '');
        notice('已复制加密日记正文', 'success');
        return;
      }
      if (e.kind !== 'diary') {
        if (!e.filename) {
          notice('找不到原文，无法复制双链', 'error');
          return;
        }
        const path = e.filename.replace(/\.md$/, '');
        await navigator.clipboard.writeText(`[[${path}]]`);
        notice('已复制双链引用', 'success');
        return;
      }
      if (!e.filePath && !e.filename) {
        notice('找不到原文，无法复制双链', 'error');
        return;
      }
      await copyDiaryLink({ filename: e.filename || '', filePath: e.filePath, emoji: e.emoji, time: e.time });
    } catch {
      notice('复制双链失败', 'error');
    }
  }

  /** 换贴纸：接本域 showTagPicker（写层守卫落盘，结果经 `diary:tags-changed` 回刷整册） */
  private editTags(e: WallEntry): void {
    try {
      showTagPicker({
        filename: e.filename || e.date,
        filePath: e.filePath,
        date: e.date,
        time: e.time,
        lineNumber: e.lineNumber || 0,
        tags: e.tags,
        encrypted: e.encrypted,
        noteId: e.noteId,
      });
    } catch (err) {
      notice(`改标签暂不可用：${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  /**
   * 收进信封（加密）：本域 `encryptEntry`（需保险箱解锁）+ 写层摘除原块；
   * 摘除失败必须回滚密文——密文已入库而原文未删时，解锁后同条出现两次且重试越积越多。
   * 与「撕掉」同为「条目当场从册上消失」，同样补二次确认。
   */
  private async encryptEntryAction(e: WallEntry): Promise<void> {
    if (e.kind !== 'diary') return; // 影视/信/书无加密入口（入库语义错位）
    let enc: Awaited<ReturnType<typeof encryptEntry>> = null;
    try {
      // 解锁走本域火漆框（此前调 encrypt 域的通用锁屏，观感与这本册子不搭）
      const unlocked = await this.ensureUnlocked();
      if (!unlocked) return;
      const ok = await openFlowDialog({
        title: '收进信封',
        message: `将把「${e.date} ${e.time}」这条日记移入保险库加密保存，原位置不再保留明文。`,
        actions: [
          { label: '取消', value: 'cancel' },
          { label: '收进信封', value: 'ok', cta: true, danger: true },
        ],
      });
      if (ok !== 'ok') return;
      const entry = await findDiaryEntry(e.filePath || e.filename || e.date);
      if (!entry) {
        notice('找不到原文条目，无法加密', 'error');
        return;
      }
      enc = await encryptEntry(entry);
      if (!enc) return;
      let removed = 0;
      try {
        removed = await removeDiaryEntries(
          entry.date,
          (x) => x.filePath === entry.filePath && x.time === entry.time && x.lineNumber === entry.lineNumber,
          { filePath: entry.filePath }
        );
      } catch (err) {
        await this.rollbackEncryptedNote(enc);
        throw err;
      }
      if (removed === 0) {
        await this.rollbackEncryptedNote(enc);
        notice('加密失败：原文块摘除未生效', 'error');
        return;
      }
      /* 加密 = 原条目文件摘除，同级磁盘变更须发同通道域事件（对齐删除的发射形态） */
      const { emitDomainEvent } = await import('../core/domain-bus');
      emitDomainEvent('diary:entry-deleted', { date: entry.date, time: entry.time, wasEncrypted: false, encrypted: true });
      await this.loadAndRelayout();
    } catch (err) {
      if (err && (isUnparsedRefusal(err) || isDiaryReadFailure(err))) return; // 守卫拒处理/读失败：写层已发人话通知
      notice('加密失败', 'error');
    }
  }

  /** 加密失败兜底：尽力销毁刚入库的密文（失败只留日志——原始失败原因更要紧） */
  private async rollbackEncryptedNote(enc: NonNullable<Awaited<ReturnType<typeof encryptEntry>>>): Promise<void> {
    if (!enc.noteId) return;
    try {
      await deleteEncryptedEntry(enc.noteId);
    } catch (err) {
      console.warn('[bz-diary] 加密回滚失败（保险箱可能残留密文，请手动删除）:', err);
    }
  }

  /** 从信封取出（解密）：本域 `reclassifyEntry` 降级（还原块 merge 回 md，取出即删） */
  private async decryptEntryAction(e: WallEntry): Promise<void> {
    try {
      const noteId = e.noteId;
      if (!noteId) {
        notice('无法取出（缺少保险箱记录）', 'error');
        return;
      }
      // 此前不问解锁直接取，锁着时只会报一句「主密码可能不正确」（其实是压根没问过密码）
      if (!(await this.ensureUnlocked())) return;
      const newTags = e.tags.filter((t) => t !== '加密');
      const ok = await reclassifyEntry(noteId, newTags);
      if (!ok) {
        notice('取出失败：主密码可能不正确，密文未受影响', 'error');
        return;
      }
      const { emitDomainEvent } = await import('../core/domain-bus');
      emitDomainEvent('diary:entry-decrypted', { noteId, date: e.date, newTags });
      await this.loadAndRelayout();
    } catch {
      notice('取出失败：主密码可能不正确，密文未受影响', 'error');
    }
  }

  /** 拆信看：加密条目在册时（保险箱已解锁）直接摊开全文；内容随密文一起存在内存里 */
  private unsealEntry(e: WallEntry): void {
    const env = this.blockEl.querySelector<HTMLElement>(
      `.bz-diary-envelope[data-eid="${cssEscape(e.id || '')}"]`
    );
    if (env) this.onEnvelope(env);
    else this.openSheet(e.kind === 'letter' ? '火漆封缄 · 全文' : '火漆封缄 · 全文', this.buildUnsealed(e));
  }

  /** 信封被点：演示拆封动效，然后把全文放到抽出来的那张纸上 */
  private onEnvelope(env: HTMLElement): void {
    if (env.classList.contains('bz-diary-unsealed') || env.classList.contains('bz-diary-opening')) return;
    const eid = env.dataset.eid || '';
    const e = this.byEid.get(eid);
    if (!e) return;
    env.classList.add('bz-diary-opening');
    const epoch = this.epoch;
    setTimeout(() => {
      if (epoch !== this.epoch || !env.isConnected) return;
      env.classList.remove('bz-diary-opening');
      env.classList.add('bz-diary-unsealed');
      /* 拆开：火漆碎开，全文在抽出来的那张纸上读（信封本身高度不变，纸面不会被顶破） */
      const box = this.buildUnsealed(e);
      this.openSheet('火漆封缄 · 全文', box);
      if (e.noteId) void this.mountEncryptedMedia(box, e.noteId);
    }, 620);
  }

  /** 撕掉：接本域 `showConfirm`（加密条目走保险箱销毁分支）+ 碎纸动效 */
  private async tearEntry(e: WallEntry): Promise<void> {
    try {
      if (e.kind !== 'diary') {
        notice('影视、信、书条目请在对应面板中管理', 'info');
        return;
      }
      const els = Array.from(this.blockEl.querySelectorAll<HTMLElement>('[data-eid]')).filter(
        (el) => el.dataset.eid === e.id && el.offsetParent
      );
      this.tearAnim(els);
      showConfirm({
        filename: e.filename || e.date,
        filePath: e.filePath,
        date: e.date,
        time: e.time,
        lineNumber: e.lineNumber || 0,
        tags: e.tags,
        encrypted: e.encrypted,
        noteId: e.noteId,
      });
    } catch {
      notice('删除暂不可用', 'error');
    }
  }

  /**
   * 碎纸动效：按元素实测矩形把两片纸撕开抛下（几何是**量出来的**，故走内联；
   * 颜色/材质仍由 `.bz-diary-scrap` 的 CSS 给 —— 零内联视觉样式口径不破）。
   */
  private tearAnim(els: HTMLElement[]): void {
    if (!els.length) return;
    const r0 = els[0].getBoundingClientRect();
    const rN = els[els.length - 1].getBoundingClientRect();
    const box = {
      l: Math.min(r0.left, rN.left),
      t: r0.top,
      r: Math.max(r0.right, rN.right),
      b: Math.max(r0.bottom, rN.bottom),
    };
    const teeth = 7;
    const pts = ['0% 0%'];
    for (let i = 0; i <= teeth; i++) pts.push(`${(i / teeth) * 100}% ${28 + Math.random() * 18}%`);
    pts.push('100% 0%');
    const path = `polygon(${pts.join(',')})`;
    [0, 1].forEach((side) => {
      const frag = document.createElement('div');
      frag.className = 'bz-diary-scrap';
      frag.style.left = `${box.l}px`;
      frag.style.top = `${box.t}px`;
      frag.style.width = `${box.r - box.l}px`;
      frag.style.height = `${box.b - box.t}px`;
      frag.style.clipPath = path;
      frag.style.transformOrigin = side ? '100% 0' : '0 0';
      document.body.appendChild(frag);
      const dir = side ? 1 : -1;
      frag.animate(
        [
          { transform: 'rotate(0deg) translate(0,0)', opacity: 1 },
          { transform: `rotate(${dir * (9 + Math.random() * 13)}deg) translate(${dir * 60}px, 220px)`, opacity: 0 },
        ],
        { duration: 700, easing: 'cubic-bezier(.3,.4,.6,1)', fill: 'forwards' }
      );
      setTimeout(() => frag.remove(), 760);
    });
    for (let i = 0; i < 7; i++) {
      const s = document.createElement('div');
      s.className = 'bz-diary-scrap';
      const sz = 5 + Math.random() * 7;
      s.style.left = `${box.l + Math.random() * (box.r - box.l)}px`;
      s.style.top = `${box.t + Math.random() * (box.b - box.t)}px`;
      s.style.width = `${sz}px`;
      s.style.height = `${sz * (0.7 + Math.random() * 0.7)}px`;
      document.body.appendChild(s);
      s.animate(
        [
          { transform: 'translate(0,0) rotate(0)', opacity: 1 },
          {
            transform: `translate(${-90 + Math.random() * 180}px, ${160 + Math.random() * 140}px) rotate(${
              -260 + Math.random() * 520
            }deg)`,
            opacity: 0,
          },
        ],
        { duration: 650 + Math.random() * 300, easing: 'ease-in', fill: 'forwards' }
      );
      setTimeout(() => s.remove(), 1000);
    }
    els.forEach((el) => {
      el.style.visibility = 'hidden';
    });
  }

  // ============================================================
  //  贴纸册（按类翻）
  // ============================================================

  private tagCounts(): Map<string, number> {
    const m = new Map<string, number>();
    for (const e of this.entries) {
      if (e.encrypted) continue;
      for (const t of e.tags) m.set(t, (m.get(t) || 0) + 1);
    }
    return m;
  }

  /** 贴纸册：按类重装订一本分类册（原型的「换贴纸」模式改走真 showTagPicker，不在这里） */
  private openAlbum(): void {
    this.albumGridEl.innerHTML = '';
    const counts = this.tagCounts();
    this.albumSubEl.textContent = '点一张，就按它重装订一本分类册';
    const tags = Array.from(counts.keys()).filter((t) => t !== '加密').sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
    if (counts.has('加密')) tags.push('加密');
    for (const t of tags) {
      const isEncrypt = t === '加密';
      const b = document.createElement('span');
      b.className = `bz-diary-ap-sticker${isEncrypt ? ' bz-diary-as-encrypt' : ''}`;
      if (this.filterTag === t) b.classList.add('bz-diary-on');
      b.innerHTML =
        `<span class="bz-diary-as-emoji">${getTagEmoji(t)}</span>${escapeHtml(t)}` +
        (isEncrypt ? '' : `<i class="bz-diary-as-count"> ${counts.get(t) || 0}</i>`);
      b.addEventListener('click', () => {
        this.closeAlbum();
        this.filterTag = this.filterTag === t ? null : t;
        this.applyFilter();
      });
      this.albumGridEl.appendChild(b);
    }
    const ok = this.albumEl.querySelector<HTMLElement>('.bz-diary-ap-confirm');
    if (ok) ok.hidden = true; // 只留「按类翻」一种模式（换贴纸在便签菜单里走真标签选择器）
    this.albumEl.hidden = false;
  }

  private closeAlbum(): void {
    if (!this.albumEl) return;
    this.albumEl.hidden = true;
  }

  private applyFilter(): void {
    this.relayout(false);
    if (this.filterTag) {
      this.filterTabEl.classList.add('bz-diary-on');
      const name = this.filterTabEl.querySelector<HTMLElement>('.bz-diary-ft-name');
      if (name) name.textContent = `${getTagEmoji(this.filterTag)} ${this.filterTag}`;
      this.jumpToPage(0);
      this.toast(`分类册装订好了：${this.filterTag}`);
    } else {
      this.filterTabEl.classList.remove('bz-diary-on');
      this.toast('整本册子回来了');
    }
  }

  private bindAlbum(): void {
    this.albumEl.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (t.closest('.bz-diary-ap-cancel') || !t.closest('.bz-diary-ap-book')) this.closeAlbum();
    });
    this.filterTabEl.addEventListener('click', () => {
      this.filterTag = null;
      this.applyFilter();
    });
  }

  // ============================================================
  //  台历（跳日子）
  // ============================================================

  private openCal(): void {
    const newest = this.entries[0];
    const base = newest ? newest.date : '2026-01-01';
    this.cal.year = Number(base.slice(0, 4));
    this.cal.month = Number(base.slice(5, 7));
    this.calTimeRowEl.hidden = true; // 改日子·时辰属写作，已随写链路走 openAddDialog
    this.calOkEl.hidden = true; // 纯跳日模式没有可提交的选中态，「合上」是唯一出口
    this.calErrEl.textContent = '';
    this.renderCal();
    this.calEl.hidden = false;
  }

  private renderCal(): void {
    const { year, month } = this.cal;
    this.calYmEl.textContent = `${year} 年 ${month} 月`;
    const byDay = new Map<number, number>();
    for (const e of this.entries) {
      if (e.date.slice(0, 7) === `${year}-${pad2(month)}`) {
        const d = Number(e.date.slice(8, 10));
        byDay.set(d, (byDay.get(d) || 0) + 1);
      }
    }
    const first = new Date(year, month - 1, 1).getDay();
    const days = new Date(year, month, 0).getDate();
    let html = WEEK.map((w) => `<span class="bz-diary-cal-wd">${w}</span>`).join('');
    for (let i = 0; i < first; i++) html += '<span class="bz-diary-cal-cell"></span>';
    for (let d = 1; d <= days; d++) {
      const n = byDay.get(d);
      /* `data-n` 是角上那枚「当天几则」小字（原型同款）；不设就白留一条 ::after 规则 */
      html += `<span class="bz-diary-cal-cell${n ? ' bz-diary-has' : ''}" data-d="${d}"${
        n ? ` data-n="${n}"` : ''
      }>${d}</span>`;
    }
    this.calGridEl.innerHTML = html;
    this.calGridEl.querySelectorAll<HTMLElement>('.bz-diary-cal-cell.bz-diary-has').forEach((c) => {
      c.addEventListener('click', () => {
        const date = `${year}-${pad2(month)}-${pad2(Number(c.dataset.d))}`;
        this.closeCal();
        this.jumpToDay(date);
      });
    });
  }

  private closeCal(): void {
    if (!this.calEl) return;
    this.calEl.hidden = true;
  }

  private jumpToDay(date: string): void {
    for (let pi = 0; pi < this.pages.length; pi++) {
      if (pageDateOf(this.pages[pi]) === date) {
        this.jumpToPage(pi);
        return;
      }
    }
    this.toast('这一册里，那天没落笔');
  }

  private bindCal(): void {
    this.calEl.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (t.closest('.bz-diary-cal-cancel') || !t.closest('.bz-diary-cal')) {
        this.closeCal();
        return;
      }
      const nav = t.closest<HTMLElement>('.bz-diary-cal-nav');
      if (nav) {
        this.cal.month += Number(nav.dataset.nav || 0);
        if (this.cal.month > 12) {
          this.cal.month = 1;
          this.cal.year++;
        }
        if (this.cal.month < 1) {
          this.cal.month = 12;
          this.cal.year--;
        }
        this.renderCal();
      }
    });
  }

  // ============================================================
  //  放大镜（检索：荧光笔）
  // ============================================================

  private runSearch(kw: string): void {
    this.clearMarks();
    this.search = { kw, hits: [], i: 0 };
    for (let pi = 0; pi < this.pages.length; pi++) {
      for (const el of this.pages[pi]) {
        if (
          el.classList.contains('bz-diary-b-photo') ||
          el.classList.contains('bz-diary-b-audio') ||
          el.classList.contains('bz-diary-b-envelope') ||
          el.classList.contains('bz-diary-b-daystamp')
        ) {
          continue;
        }
        if ((el.textContent || '').indexOf(kw) >= 0) this.search.hits.push({ pi, el });
      }
    }
    if (!this.search.hits.length) {
      this.openSlip({ title: '没 找 到', body: `整本册子都翻了，没有「${escapeHtml(kw)}」这个词。`, ok: '知道了' });
      return;
    }
    this.toast(`寻得 ${this.search.hits.length} 处，荧光笔伺候`);
    this.nextHit();
  }

  private nextHit(): void {
    const s = this.search;
    if (!s.hits.length) return;
    const hit = s.hits[s.i % s.hits.length];
    s.i++;
    this.jumpToPage(hit.pi);
    setTimeout(() => this.markHit(hit.el, s.kw || ''), 80);
  }

  private markHit(el: HTMLElement, kw: string): void {
    if (!el.isConnected || !kw) return;
    if (!el.dataset.orig) el.dataset.orig = el.innerHTML;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement && n.parentElement.closest('mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const texts: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) texts.push(n as Text);
    for (const node of texts) {
      const t = node.textContent || '';
      if (t.indexOf(kw) < 0) continue;
      const frag = document.createDocumentFragment();
      let rest = t;
      while (rest.indexOf(kw) >= 0) {
        const i = rest.indexOf(kw);
        if (i) frag.appendChild(document.createTextNode(rest.slice(0, i)));
        const mk = document.createElement('mark');
        mk.className = 'bz-diary-hl bz-diary-hl-on';
        mk.textContent = kw;
        frag.appendChild(mk);
        rest = rest.slice(i + kw.length);
      }
      if (rest) frag.appendChild(document.createTextNode(rest));
      node.parentNode?.replaceChild(frag, node);
    }
  }

  /**
   * 拆荧光笔。只拆**检索打的那一笔**（`bz-diary-hl-on`）——原文里作者自己写的 `==高亮==`
   * 经 inlineMd 渲染出来也是 `mark`，无差别拆会把全册手写高亮无声拆光。
   */
  private clearMarks(): void {
    if (!this.root) return;
    this.root.querySelectorAll<HTMLElement>('[data-orig]').forEach((el) => {
      el.innerHTML = el.dataset.orig || '';
      delete el.dataset.orig;
    });
    this.root.querySelectorAll('.bz-diary-page-item mark.bz-diary-hl-on').forEach((m) => {
      const p = m.parentNode;
      if (p) {
        p.replaceChild(document.createTextNode(m.textContent || ''), m);
        p.normalize();
      }
    });
  }

  private askSearch(): void {
    this.openSlip({
      title: '放 大 镜',
      body: '要找哪个词？整本册子替你翻。',
      input: { placeholder: '比如：雨、猫、游戏……' },
      ok: '翻找',
      onSubmit: (v) => {
        if (!v) return '写一个词嘛';
        this.runSearch(v);
        return null;
      },
    });
  }

  // ============================================================
  //  纸条（通用输入 / 确认）
  // ============================================================

  private openSlip(opt: {
    title?: string;
    body?: string;
    input?: { placeholder?: string; type?: string };
    ok?: string;
    cancelText?: string;
    danger?: boolean;
    onSubmit?: (v: string | undefined) => string | null;
  }): void {
    this.slipTitleEl.textContent = opt.title || '';
    this.slipBodyEl.innerHTML = opt.body || '';
    this.slipRowEl.innerHTML = '';
    let input: HTMLInputElement | null = null;
    if (opt.input) {
      input = document.createElement('input');
      input.className = 'bz-diary-slip-input';
      input.type = opt.input.type || 'text';
      input.placeholder = opt.input.placeholder || '';
      this.slipBodyEl.appendChild(input);
    }
    const cancel = document.createElement('span');
    cancel.className = 'bz-diary-slip-btn';
    cancel.textContent = opt.cancelText || '算了';
    cancel.addEventListener('click', () => this.closeSlip());
    this.slipRowEl.appendChild(cancel);

    const ok = document.createElement('span');
    ok.className = `bz-diary-slip-btn bz-diary-primary${opt.danger ? ' bz-diary-danger' : ''}`;
    ok.textContent = opt.ok || '好';
    ok.addEventListener('click', () => {
      const v = input ? input.value.trim() : undefined;
      const err = opt.onSubmit ? opt.onSubmit(v) : null;
      if (err) {
        let line = this.slipBodyEl.querySelector<HTMLElement>('.bz-diary-slip-err-line');
        if (!line) {
          line = document.createElement('div');
          line.className = 'bz-diary-slip-err bz-diary-slip-err-line';
          this.slipBodyEl.appendChild(line);
        }
        line.textContent = err;
        return;
      }
      this.closeSlip();
    });
    this.slipRowEl.appendChild(ok);
    this.slipEl.hidden = false;
    if (input) setTimeout(() => input?.focus(), 60);
  }

  private closeSlip(): void {
    if (!this.slipEl) return;
    this.slipEl.hidden = true;
  }

  private bindSlip(): void {
    this.slipEl.addEventListener('click', (ev) => {
      if (!(ev.target as HTMLElement).closest('.bz-diary-slip-paper')) this.closeSlip();
    });
    this.slipEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') this.slipRowEl.querySelector<HTMLElement>('.bz-diary-slip-btn.bz-diary-primary')?.click();
    });
  }

  // ============================================================
  //  文具五项（写 / 找 / 跳 / 类）
  // ============================================================

  private doTact(name: string): void {
    switch (name) {
      case 'pencil':
        this.startWrite();
        break;
      case 'lens':
        this.askSearch();
        break;
      case 'calendar':
        this.openCal();
        break;
      case 'stickers':
        this.openAlbum();
        break;
    }
  }

  /** 写一篇：本域写链路（守卫 / 串行队列 / 加密分流 / 写后跳转都在那边），写完关册子去新笔记 */
  private startWrite(): void {
    try {
      openAddDialog({ yearRange: this.getYearRange() ?? undefined, onSaved: () => this.hide() });
    } catch (e) {
      notice(`写日记暂不可用：${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }

  // ============================================================
  //  火漆密码框（域内自绘）+ 解锁守卫
  // ============================================================

  private bindPass(): void {
    this.passEl.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      const btn = t.closest<HTMLElement>('.bz-diary-pass-btn');
      if (!btn || !this.passSettle) return;
      if (btn.dataset.pact === 'cancel') {
        this.closePass(false);
        return;
      }
      void this.submitPass();
    });
    // 回车提交（与纸条层同口径：Enter = 主行动）
    this.passInputEl.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' || !this.passSettle) return;
      ev.preventDefault();
      void this.submitPass();
    });
  }

  private closePass(ok: boolean): void {
    const settle = this.passSettle;
    this.passSettle = null;
    this.passEl.hidden = true;
    this.passInputEl.value = '';
    this.passErrEl.textContent = '';
    if (settle) settle(ok);
  }

  private async submitPass(): Promise<void> {
    const pw = this.passInputEl.value;
    if (!pw) {
      this.passErrEl.textContent = '先填主密码';
      return;
    }
    const { getSafeManager } = (await import('../encrypt')) as typeof import('../encrypt');
    const safe = getSafeManager();
    let ok = false;
    try {
      ok = await safe.unlock(pw);
    } catch {
      ok = false;
    }
    if (!ok) {
      // 不对就留在框里让人重输（密文没被动过，重输没有代价）
      this.passErrEl.textContent = '主密码不对，再来一次';
      this.passInputEl.select();
      return;
    }
    this.closePass(true);
  }

  /**
   * 动保险箱前的解锁守卫：已解锁直接放行，否则弹本域的火漆密码框。
   * 原型那个演示用假密码框不搬（ui.ts 头部注记）；校验一律走真保险箱，
   * 本域只收字符串、不碰密码学、不存明文。
   */
  private async ensureUnlocked(): Promise<boolean> {
    let safe: Awaited<ReturnType<typeof import('../encrypt')['getSafeManager']>>;
    try {
      const mod = (await import('../encrypt')) as typeof import('../encrypt');
      safe = mod.getSafeManager();
    } catch (err) {
      // 保险箱没起来（评审壳里常见）：说清原因，别静默吞掉动作
      notice(`保险箱暂不可用：${err instanceof Error ? err.message : String(err)}`, 'error');
      return false;
    }
    if (safe.unlocked) return true;
    if (this.passSettle) return false; // 已在等输入
    return new Promise<boolean>((resolve) => {
      this.passSettle = resolve;
      this.passErrEl.textContent = '';
      this.passInputEl.value = '';
      this.passEl.hidden = false;
      this.passInputEl.focus();
    });
  }

  private bindTools(): void {
    this.bindSheet();
    /* 案头文具贴着书的下沿：桌面靠鼠标压到书底那一条浮出来；≤720px 由 CSS 直接常驻 */
    this.toolsEl.addEventListener('click', (ev) => {
      const tl = (ev.target as HTMLElement).closest<HTMLElement>('[data-tact]');
      if (tl) this.doTact(tl.dataset.tact || '');
    });
    this.refreshBookRect();
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseleave', this.onMouseLeave);
    /* 触屏没有 hover：「抽出册页索引」那句提示进来先亮 4 秒 */
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches) {
      const eh = this.root?.querySelector<HTMLElement>('.bz-diary-eb-hint');
      if (eh) {
        eh.classList.add('bz-diary-peek');
        setTimeout(() => eh.classList.remove('bz-diary-peek'), 4000);
      }
    }
    this.edgeEl.addEventListener('click', () => this.openIndexSheet());
  }

  private onMouseMove = (ev: MouseEvent): void => {
    if (this.toolsRaf) return;
    const x = ev.clientX;
    const y = ev.clientY;
    this.toolsRaf = requestAnimationFrame(() => {
      this.toolsRaf = 0;
      /* 弹层开着的时候不凑热闹 */
      if (!this.lightboxEl.hidden || !this.sheetEl.hidden || !this.slipEl.hidden) {
        this.setToolsShown(false);
        return;
      }
      if (!this.bookRect) this.refreshBookRect();
      const r = this.bookRect;
      if (!r) return;
      this.setToolsShown(y > r.bottom - 48 && y < r.bottom + 112 && x > r.left - 70 && x < r.right + 70);
    });
  };

  private onMouseLeave = (): void => this.setToolsShown(false);

  private setToolsShown(on: boolean): void {
    if (on === this.toolsShown) return;
    this.toolsShown = on;
    this.toolsEl.classList.toggle('bz-diary-show', on);
  }

  /** 书在屏幕上的位置：只在窗口尺寸变化时刷新，别每帧量（原来鼠标一动就强制一次整页布局） */
  private refreshBookRect(): void {
    if (!this.bookEl) return;
    this.bookRect = this.bookEl.getBoundingClientRect();
  }

  // ============================================================
  //  纸上的小提示
  // ============================================================
  /* 「那年今日」明信片已按用户要求整件退役（连同 checkOnThisDay 与其「展信」跳页）：
     它和引导便签一样是开册就往桌上摆的非请求物件，与「只要日记本本身」冲突。 */

  private toast(msg: string): void {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.hidden = false;
    this.toastEl.classList.remove('bz-diary-out');
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.add('bz-diary-out');
      setTimeout(() => {
        if (!this.toastEl) return;
        this.toastEl.hidden = true;
        this.toastEl.classList.remove('bz-diary-out');
      }, 420);
    }, 2400);
  }

  // ============================================================
  //  数据：加载 / 回刷 / 订阅
  // ============================================================

  private app(): App {
    return getApp();
  }

  /** 让位首帧：rAF 后再落一拍 setTimeout，等面板画出来再读盘/整册排版 */
  private afterPaint(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'function' || document.hidden) {
        setTimeout(resolve, 0);
        return;
      }
      requestAnimationFrame(() => setTimeout(resolve, 0));
    });
  }

  /** 重新读盘 + 整册重排（事件回刷路径；保阅读位置） */
  private async loadAndRelayout(): Promise<void> {
    await this.loadEntries(false);
    this.relayout(true);
  }

  /**
   * 读盘。`allowCache`：开册路径命中预热/上次刷新后的缓存秒开；
   * 刷新/写后回刷/重试一律先作废回源（保持「每次刷新即读盘」语义，不赌缓存失效是否触发）。
   *
   * `onWindow`（ADR-0231）：攒够 `FIRST_PAINT_ENTRIES` 条就把**部分**结果交出来先成册——
   * 首屏不必等 1243 篇正文读完。只有开册路径传它；刷新/写后回刷不传（那两条要的是完整一致，
   * 中途成册反而会让正在读的那一页被重排）。缓存命中时不会有进度，由调用方在结算后补一次成册。
   */
  private async loadEntries(allowCache: boolean, onWindow?: (partial: WallEntry[]) => void): Promise<void> {
    const off = onWindow
      ? onWallProgress((partial) => {
          if (partial.length >= FIRST_PAINT_ENTRIES) onWindow(partial);
        })
      : null;
    try {
      if (allowCache) {
        this._allowCacheNext = false;
      } else {
        invalidateWallCache();
      }
      this.entries = await loadWallEntries(this.app());
      this._loadError = null;
    } catch (e) {
      this.entries = [];
      this._loadError = e instanceof Error ? e.message : String(e);
      notice(`加载日记失败：${this._loadError}`, 'error');
    } finally {
      off?.();
    }
    // 保险箱已解锁：一并并入加密日记（幂等；上锁态不可见）
    await this.mergeEncryptedEntries();
    if (this._loadError) this.fallbackEl.hidden = false;
    else this.fallbackEl.hidden = true;
  }

  /**
   * 并入加密日记（保险箱已解锁时）。内容随密文一起在内存里，媒体段照常切出来——
   * 纸面只出火漆信封（render 层按 `encrypted` 分流），拆信时再把全文放到抽出的纸上。
   */
  private async mergeEncryptedEntries(): Promise<void> {
    try {
      if (!isUnlocked()) return;
      const encrypted = await loadEncryptedEntries();
      if (!encrypted.length) return;
      const existingIds = new Set(this.entries.filter((e) => e.noteId).map((e) => e.noteId));
      const added: WallEntry[] = [];
      for (const e of encrypted) {
        if (!e.noteId || existingIds.has(e.noteId)) continue;
        existingIds.add(e.noteId);
        added.push({
          date: e.date,
          time: e.time,
          tags: e.tags,
          emoji: e.emoji,
          content: e.content,
          text: stripMediaLinks(e.content),
          media: extractMedia(e.content, DIARY_DIRECTORY),
          segments: extractSegments(e.content),
          filename: e.filename,
          filePath: e.filePath,
          lineNumber: e.lineNumber,
          id: e.id,
          noteId: e.noteId,
          encrypted: true,
          extra: e.extra,
          kind: 'diary',
        });
      }
      if (!added.length) return;
      this.entries.push(...added);
      this.entries.sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        return dateCmp !== 0 ? dateCmp : b.time.localeCompare(a.time);
      });
    } catch {
      /* 加密域未初始化/设置未注入：视为无加密条目（降级链，不阻断） */
    }
  }

  /** 写链路五通道 + 保险箱锁态 + 引用同步：域事件防抖回刷整册 */
  private subscribeEvents(): void {
    if (this._subs.length) return;
    const chs = [
      'diary:entry-added',
      'diary:tags-changed',
      'diary:entry-deleted',
      'diary:entry-decrypted',
      'diary:encrypted-purged',
    ] as const;
    for (const ch of chs) {
      this._subs.push(
        onDomainEvent(ch, () => {
          if (this.root?.style.display !== 'flex') return;
          this.scheduleRelayout();
        })
      );
    }
    this._subs.push(
      onDomainEvent<{ unlocked: boolean }>('encrypt:unlock-changed', (evt) => {
        if (this.root?.style.display !== 'flex') return;
        this.encMediaCache.clear();
        if (!evt || !evt.unlocked) {
          // 上锁：加密条目实时不可见
          if (this.filterTag === '加密') this.filterTag = null;
          void this.loadAndRelayout();
        } else {
          void this.loadAndRelayout();
        }
      })
    );
    /* 引用同步：册子开着时条目文件改名/删除 → 内存条目与 diaryDataMap 键同步（不落盘） */
    this._subs.push(
      onDomainEvent<{ oldPath: string; newPath: string }>('vault:md-renamed', (evt) => {
        const oldPath = evt?.oldPath || '';
        const newPath = evt?.newPath || '';
        if (!oldPath || !newPath || oldPath === newPath) return;
        if (this.root?.style.display !== 'flex' || !inWallDirs(oldPath)) return;
        const movedOut = !inWallDirs(newPath);
        if (movedOut) dropDiaryMapPath(oldPath);
        else rekeyDiaryMapPath(oldPath, newPath);
        let touched = false;
        for (const e of this.entries) {
          if (e.filePath !== oldPath) continue;
          touched = true;
          if (movedOut) continue;
          e.filePath = newPath;
          if (e.filename === oldPath) e.filename = newPath;
        }
        if (movedOut) this.entries = this.entries.filter((e) => e.filePath !== oldPath);
        if (movedOut || touched) this.relayout(true);
      })
    );
    this._subs.push(
      onDomainEvent<{ path: string }>('vault:md-deleted', (evt) => {
        const path = evt?.path || '';
        if (!path) return;
        if (this.root?.style.display !== 'flex' || !inWallDirs(path)) return;
        const hadMap = dropDiaryMapPath(path);
        const before = this.entries.length;
        this.entries = this.entries.filter((e) => e.filePath !== path);
        if (hadMap || this.entries.length !== before) this.relayout(true);
      })
    );
  }

  private unsubscribeEvents(): void {
    this._subs.forEach((off) => off());
    this._subs = [];
  }

  /** vault modify/create 回刷（纯外部变更：其他工具写入条目文件时册子也要跟上） */
  private subscribeVault(): void {
    if (this._vaultRefs.length) return;
    const schedule = () => {
      if (this.root?.style.display !== 'flex') return;
      this.scheduleRelayout();
    };
    this._vaultRefs.push(
      this.app().vault.on('modify', (file: { path?: string }) => {
        const p = file?.path;
        if (p && inWallDirs(p)) schedule();
      })
    );
    this._vaultRefs.push(
      this.app().vault.on('create', (file: { path?: string }) => {
        const p = file?.path;
        if (p && inWallDirs(p)) schedule();
      })
    );
  }

  private unsubscribeVault(): void {
    for (const ref of this._vaultRefs) {
      try {
        this.app().vault.offref(ref);
      } catch {
        /* mock/异常环境：忽略 offref 失败 */
      }
    }
    this._vaultRefs = [];
  }

  /** 防抖整册回刷（域事件与 vault 变更共用；重入时后一次覆盖前一次） */
  private scheduleRelayout(): void {
    if (this.modifyTimer !== null) clearTimeout(this.modifyTimer);
    this.modifyTimer = setTimeout(() => {
      this.modifyTimer = null;
      if (this.root?.style.display !== 'flex') return;
      void this.loadAndRelayout();
    }, REFRESH_DEBOUNCE_MS);
  }

  // ============================================================
  //  显示 / 隐藏 / 卸载
  // ============================================================

  /** 打开日记本（命令路径：ensure 后 show） */
  show(): void {
    if (!this._initialized) this.ensureElements();
    const reopen = this._shownOnce;
    this._shownOnce = true;
    this._hideMotion = false;
    this.root!.style.display = 'flex';
    topifyZ(this.root!); // ADR-0067：域根层级动态发号
    this._allowCacheNext = true;
    this.subscribeEvents();
    this.subscribeVault();
    void (async () => {
      await this.afterPaint();
      this.firstPaintDone = false;
      this.shown = FIRST_PAINT_ENTRIES;
      // ADR-0231：首批一成 -> 立刻成册给用户翻；其余正文在后台继续读，**不重排**。
      await this.loadEntries(this._allowCacheNext, (partial) => {
        if (this.firstPaintDone) return;
        this.firstPaintDone = true;
        this.entries = partial;
        this.shown = Math.min(FIRST_PAINT_ENTRIES, partial.length);
        this.relayout(false);
      });
      if (!this.firstPaintDone) {
        // 缓存命中（结算即全量）或条目本就很少：没有进度可等，读盘结束后成册一次
        this.firstPaintDone = true;
        this.shown = Math.min(this.shown, this.entries.length);
        this.relayout(false);
      }
      this.toast(reopen ? '又翻开了' : '翻开的是最新那篇');
    })();
  }

  hide(): void {
    if (!this.root || this._hideMotion) return;
    this._hideMotion = true;
    this.closeLightbox();
    this.closeSheet();
    this.closeSlip();
    this.closeAlbum();
    this.closeCal();
    this.closeMenu();
    this.closePass(false);
    hideAddDialog();
    hideTagPicker();
    this.pauseAllAudio();
    this.unsubscribeEvents();
    this.unsubscribeVault();
    if (this.modifyTimer !== null) {
      clearTimeout(this.modifyTimer);
      this.modifyTimer = null;
    }
    if (this.extendTimer !== null) {
      clearTimeout(this.extendTimer);
      this.extendTimer = null;
    }
    this.setToolsShown(false);
    this._hideMotion = false;
    this.root.style.display = 'none';
  }

  /** 当前数据的滚轮年份动态范围（无数据返回 null → 控件回落 1900～当前年+1） */
  getYearRange(): { min: number; max: number } | null {
    let earliest: number | null = null;
    for (const entry of this.entries) {
      const y = parseInt(String(entry.date).split('-')[0], 10);
      if (!Number.isNaN(y) && (earliest === null || y < earliest)) earliest = y;
    }
    if (earliest === null) return null;
    return { min: Math.max(1900, earliest), max: new Date().getFullYear() + 1 };
  }

  cleanup(): void {
    unregisterPanelEsc('diary');
    document.removeEventListener('keydown', this.onKeydown);
    document.removeEventListener('pointerdown', this.onDocPointerDown, true);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseleave', this.onMouseLeave);
    window.removeEventListener('resize', this.onResize);
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (this.modifyTimer !== null) {
      clearTimeout(this.modifyTimer);
      this.modifyTimer = null;
    }
    if (this.extendTimer !== null) {
      clearTimeout(this.extendTimer);
      this.extendTimer = null;
    }
    if (this.toolsRaf) cancelAnimationFrame(this.toolsRaf);
    this.unsubscribeEvents();
    this.unsubscribeVault();
    if (this.flip) {
      try {
        this.flip.destroy();
      } catch {
        /* 忽略：销毁失败不阻断卸载 */
      }
      this.flip = null;
    }
    this.encMediaCache.clear();
    this.byEid.clear();
    this.photoRefs = [];
    this.photoIndex.clear();
    this.pages = [];
    this.entries = [];
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this._initialized = false;
    DiaryAppController.instance = null;
  }
}

/** CSS.escape 缺失时的兜底（jsdom 与本仓 mock 环境都得能选中 `data-eid`） */
function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
  return s.replace(/["\\]/g, '\\$&');
}

// 便捷导入（供 index.ts / 测试）
export type { WallEntry, WallMedia } from './data';
