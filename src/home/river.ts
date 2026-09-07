/**
 * 内容首页（home 域）活动河数据层（issue 232，p16-full 原型一比一落域）：
 * 「今日活动河全域入口版」= 时间线（今天痕迹流）+ 全部域入口（实时数 + 今日动静彩点）+ 明天预告。
 *
 * 职责（ADR-0104 单源化后）：只剩「采集」——把 vault/各域数据聚合成 RiverData；
 * 纯类型与规则纯函数（buildNotes/buildPreviews/buildDots/riverCountText 等）已收编
 * 渲染纯层共享层（./shared），本文件 re-export 保旧引用路径不变（tests/home 等）。
 *
 * 只读契约（与 snapshot.ts 同款）：
 *  - json 数据文件一律先探测存在再读（缺失回落空，不触发 jsonFileStore 自动建文件）；
 *  - 目录缺失不建目录；不调任何带 DOM/轮询/通知副作用的 ensure/open；
 *  - 各源独立容错，某源失败回落空值不拖垮整面板。
 *
 * 数据源口径：
 *  - 时间线（今天/昨天）复用 recap collectRecap（五域痕迹聚合，anchor 参数天然支持昨天）；
 *  - 计数复用各域既有口径：cinema 评分三分（同 snapshot）、bookshelf md+EPUB 状态三分
 *    （同 bookshelf 域）、review 到期/逾期（同 snapshot reviewApp.loadItems）、
 *    clipping 未读 = news.json !read 计数、favorites/belongings 同 snapshot；
 *  - 日记连击：日记目录「YYYY-MM-DD.md」从今天往回连续存在的天数（今天未写不断签）。
 */
import type { App, TFile } from 'obsidian';
import { collectRecap } from '../recap/aggregate';
import type { RecapItem, RecapSummary } from '../recap/aggregate';
import { tryGetSettings } from '../core/settings-provider';
import { storageFile } from '../core/storage';
import { reviewApp } from '../review/app';
import type { ReviewItem } from '../review/data';
import { parseMovieFile } from '../cinema/data';
import { STATUS_WANT, STATUS_WATCHING } from '../cinema/constants';
import { scanMarkdownBooks, loadEpubItems } from '../bookshelf/data';
import { loadDatabase as loadBelongings } from '../belongings/data';
import { DataManager as FavoritesDataManager } from '../favorites/data';
import { getStoragePath as getFavoritesPath } from '../favorites/config';
import { EMPTY_COUNTS, EMPTY_SUMMARY, dateStrOf } from './shared';
import type { RiverData, RiverDay, RiverCounts, RiverStreak, RiverSummary, RiverWeekDay } from './shared';

// 兼容再出口：类型与规则纯函数单源在 ./shared（旧引用 `from './river'` 零改）
export {
  EMPTY_COUNTS, EMPTY_SUMMARY, dateStrOf,
  buildNotes, buildPreviews, buildDots, riverCountText, dotOf,
} from './shared';
export type {
  RiverData, RiverDay, RiverEvent, RiverStreak, RiverCounts,
  RiverSummary, RiverWeekDay, RiverNote, RiverPreview, RiverDot,
} from './shared';

const DAY_MS = 86400000;

/* ---------- RecapItem → RiverDay ---------- */

function toRiverDay(dateStr: string, summary: RecapSummary, items: RecapItem[]): RiverDay {
  const events = [...items].sort((a, b) => a.ts - b.ts);
  // todoCreated：recap 摘要没有，由「新增待办」痕迹数派生（buildRecap 文案契约）
  const full: RiverSummary = { ...summary, todoCreated: events.filter((e) => e.text.startsWith('新增待办')).length };
  return { dateStr, events, summary: full, firstTs: events.length ? events[0].ts : null };
}

/* ---------- 小工具（本地副本防跨文件牵连，同 recap 口径） ---------- */

function settingDir(keys: string[], def: string): string {
  const s = tryGetSettings() as Record<string, unknown>;
  for (const k of keys) {
    const v = s[k];
    if (typeof v === 'string' && v.trim()) return v.trim().replace(/\/+$/, '');
  }
  return def;
}

function fileExists(app: App, filePath: string): boolean {
  try {
    return !!app.vault.getAbstractFileByPath(filePath);
  } catch {
    return false;
  }
}

/** 读 json 文件原始内容（仅存在时读，不触发建文件；解析失败回落 null） */
async function readJsonIfExists(app: App, filePath: string): Promise<unknown | null> {
  if (!fileExists(app, filePath)) return null;
  try {
    const f = app.vault.getAbstractFileByPath(filePath) as TFile;
    return JSON.parse(await app.vault.read(f));
  } catch {
    return null;
  }
}

/* ---------- 计数采集（各源独立容错） ---------- */

/** 复习：总数 / 逾期 / 明天到期（口径同 snapshot reviewApp.loadItems） */
async function collectReviewCounts(app: App, now: number, c: RiverCounts): Promise<void> {
  const filePath = storageFile('review.json');
  if (!fileExists(app, filePath)) return;
  reviewApp.ensure(app);
  const items = (await reviewApp.dataManager!.loadItems()) as ReviewItem[];
  c.reviewTotal = items.filter((i) => !i.isMissing).length;
  c.reviewOverdue = items.filter((i) => i.isOverdue && !i.completed && !i.isMissing).length;
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  c.reviewDueTomorrow = items.filter((i) => {
    if (i.completed || i.isMissing || !i.nextReviewDate) return false;
    const t = new Date(i.nextReviewDate).getTime();
    return Number.isFinite(t) && t >= start + DAY_MS && t < start + 2 * DAY_MS;
  }).length;
}

/** 影院：想看 / 在看（评分三分口径，同 snapshot） */
function collectCinemaCounts(app: App, c: RiverCounts): void {
  const folder = settingDir(['cinemaFolderPath'], '我的/影视');
  for (const f of app.vault.getMarkdownFiles()) {
    if (!f.path.startsWith(folder + '/')) continue;
    const item = parseMovieFile(f as TFile, app);
    if (!item) continue;
    if (item.status === STATUS_WANT) c.cinemaWant++;
    else if (item.status === STATUS_WATCHING) c.cinemaWatching++;
  }
}

/** 书库：在读 / 读完（md + EPUB 三分口径，同 bookshelf 域） */
async function collectBookshelfCounts(app: App, c: RiverCounts): Promise<void> {
  for (const b of scanMarkdownBooks(app)) {
    if (b.status === '在读') c.bookshelfReading++;
    else if (b.status === '已读') c.bookshelfFinished++;
  }
  for (const b of await loadEpubItems(app)) {
    if (b.status === '在读') c.bookshelfReading++;
    else if (b.status === '已读') c.bookshelfFinished++;
  }
}

/** 剪藏：未读数（news.json 直读，文件缺失不建；口径 = articles !read 计数） */
async function collectClippingCounts(app: App, c: RiverCounts): Promise<void> {
  const raw = await readJsonIfExists(app, storageFile('news.json'));
  const articles = Array.isArray((raw as { articles?: unknown })?.articles)
    ? ((raw as { articles: unknown[] }).articles as Array<Record<string, unknown>>)
    : [];
  c.clippingUnread = articles.filter((a) => !a.read).length;
}

/** 收藏：条数（排除归档；口径同 snapshot） */
async function collectFavoritesCounts(app: App, c: RiverCounts): Promise<void> {
  const dir = settingDir(['storagePath'], 'CONFIG/STORAGE');
  const filePath = getFavoritesPath(dir);
  if (!fileExists(app, filePath)) return;
  const dm = new FavoritesDataManager(filePath);
  const all = await dm.getAll();
  c.favoritesTotal = (Array.isArray(all) ? all : []).filter((i) => !(i as { archived?: boolean }).archived).length;
}

/** 归物：登记件数（口径同 snapshot） */
async function collectBelongingsCounts(app: App, c: RiverCounts): Promise<void> {
  const filePath = storageFile('belongings.json');
  if (!fileExists(app, filePath)) return;
  const db = await loadBelongings();
  c.belongingsTotal = Object.keys((db as { items?: Record<string, unknown> }).items ?? {}).length;
}

/** 日记总数（目录前缀递归 md 数，含子目录）+ 写作连击（今天未写不算断） */
function collectDiary(app: App, now: number, c: RiverCounts): RiverStreak {
  const dir = settingDir(['diaryDirectory'], '我的/日记');
  try {
    c.diaryTotal = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(dir + '/')).length;
  } catch {
    /* 目录读取失败：总数留 0 */
  }
  const writtenToday = fileExists(app, `${dir}/${dateStrOf(now)}.md`);
  let streak = 0;
  // 今天已写从今天起算；未写从昨天起算（连击不断签），再往回数连续日期
  for (let t = writtenToday ? now : now - DAY_MS; fileExists(app, `${dir}/${dateStrOf(t)}.md`); t -= DAY_MS) {
    streak++;
  }
  return { diaryStreak: streak, diaryWrittenToday: writtenToday };
}

/* ---------- 聚合入口 ---------- */

/** 采集活动河全量数据（今天/昨天时间线 + 连击 + 全部域计数；全程只读） */
export async function collectRiver(app: App, now: number = Date.now()): Promise<RiverData> {
  // 本周 7 天窗口（今天~6 天前）一次并行采集；recap anchor 参数天然支持任意天
  const DAYS_N = 7;
  const dayRecaps = await Promise.all(
    Array.from({ length: DAYS_N }, (_, i) => collectRecap(app, now - i * DAY_MS).catch(() => null))
  );

  const counts: RiverCounts = { ...EMPTY_COUNTS };
  const safe = (fn: () => void | Promise<void>): Promise<void> =>
    Promise.resolve()
      .then(fn)
      .catch(() => undefined);
  await Promise.all([
    safe(() => collectReviewCounts(app, now, counts)),
    safe(() => collectCinemaCounts(app, counts)),
    safe(() => collectBookshelfCounts(app, counts)),
    safe(() => collectClippingCounts(app, counts)),
    safe(() => collectFavoritesCounts(app, counts)),
    safe(() => collectBelongingsCounts(app, counts)),
  ]);
  let streak: RiverStreak = { diaryStreak: 0, diaryWrittenToday: false };
  try {
    streak = collectDiary(app, now, counts);
  } catch {
    /* 连击计算失败回落空 */
  }

  const days = dayRecaps.map((r, i) =>
    toRiverDay(dateStrOf(now - i * DAY_MS), r?.summary ?? EMPTY_SUMMARY, r?.items ?? [])
  );
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  const week: RiverWeekDay[] = days.map((d) => {
    const dt = new Date(d.dateStr + ' 12:00:00');
    return { dateStr: d.dateStr, label: d.dateStr.slice(5), dayOfMonth: dt.getDate(), weekday: WD[dt.getDay()], hit: d.events.length > 0 };
  });
  return {
    today: days[0],
    yesterday: days[1],
    days,
    week,
    streak,
    counts,
  };
}
