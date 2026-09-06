/**
 * 内容首页（home 域）活动河数据层（issue 232，p16-full 原型一比一落域）：
 * 「今日活动河全域入口版」= 时间线（今天痕迹流）+ 全部域入口（实时数 + 今日动静彩点）+ 明天预告。
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

const DAY_MS = 86400000;

/* ---------- 类型 ---------- */

/** 时间线一条痕迹（recap RecapItem 的域展宽版：todo 保留原名，前端图标/名称映射） */
export type RiverEvent = RecapItem;

/** 日记连击态 */
export interface RiverStreak {
  /** 从今天（未写不算断）往回连续写日记的天数 */
  diaryStreak: number;
  diaryWrittenToday: boolean;
}

/** 全部域入口实时计数（口径注释见各采集分支） */
export interface RiverCounts {
  diaryTotal: number;
  reviewTotal: number;
  reviewOverdue: number;
  reviewDueTomorrow: number;
  cinemaWant: number;
  cinemaWatching: number;
  bookshelfReading: number;
  bookshelfFinished: number;
  clippingUnread: number;
  favoritesTotal: number;
  belongingsTotal: number;
}

export const EMPTY_COUNTS: RiverCounts = {
  diaryTotal: 0,
  reviewTotal: 0,
  reviewOverdue: 0,
  reviewDueTomorrow: 0,
  cinemaWant: 0,
  cinemaWatching: 0,
  bookshelfReading: 0,
  bookshelfFinished: 0,
  clippingUnread: 0,
  favoritesTotal: 0,
  belongingsTotal: 0,
};

/** 时间线摘要（recap RecapSummary + todoCreated：原型 buildDots 的待办动静需要） */
export interface RiverSummary extends RecapSummary {
  /** 今日新增待办条数（recap 摘要无此字段，由时间线「新增待办」条目数派生） */
  todoCreated: number;
}

export const EMPTY_SUMMARY: RiverSummary = {
  diary: 0, movies: 0, books: 0, todoDone: 0, todoCreated: 0, pomodoros: 0, pomodoroMinutes: 0,
};

/** 一天的时间线（今天/昨天同构） */
export interface RiverDay {
  dateStr: string;
  events: RiverEvent[];
  summary: RiverSummary;
  /** 第一条痕迹时刻（无痕迹为 null；点评「动手早晚」比较用） */
  firstTs: number | null;
}

/** 周历一格（头行动静历，可点切天） */
export interface RiverWeekDay {
  /** 完整日期 'YYYY-MM-DD'（视图键，与 days[].dateStr 同键） */
  dateStr: string;
  /** 展示用 'MM-DD' */
  label: string;
  dayOfMonth: number;
  weekday: string;
  /** 当天有动静（时间线非空） */
  hit: boolean;
}

/** 活动河聚合结果 */
export interface RiverData {
  today: RiverDay;
  yesterday: RiverDay;
  /** 本周 7 天窗口（index 0 = 今天，往回 6 天；周历切天的数据源） */
  days: RiverDay[];
  week: RiverWeekDay[];
  streak: RiverStreak;
  counts: RiverCounts;
}

/* ---------- 小工具（本地副本防跨文件牵连，同 recap 口径） ---------- */

function p2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD'（本地时区） */
export function dateStrOf(anchor: number): string {
  const d = new Date(anchor);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

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

/* ---------- RecapItem → RiverDay ---------- */

function toRiverDay(dateStr: string, summary: RecapSummary, items: RecapItem[]): RiverDay {
  const events = [...items].sort((a, b) => a.ts - b.ts);
  // todoCreated：recap 摘要没有，由「新增待办」痕迹数派生（buildRecap 文案契约）
  const full: RiverSummary = { ...summary, todoCreated: events.filter((e) => e.text.startsWith('新增待办')).length };
  return { dateStr, events, summary: full, firstTs: events.length ? events[0].ts : null };
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

/* ---------- 规则纯函数（原型 buildNotes/buildPreviews/buildDots 一比一移植） ---------- */

/** 时间线规则点评：index = 挂靠的事件下标（-1 = 空河整条点评，UI 层渲染在时间线顶部） */
export interface RiverNote {
  index: number;
  text: string;
}

function fmtHm(t: number): string {
  const d = new Date(t);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** 点评规则（node 可测）：
 *  - 首条动静 vs 昨天首条：早晚分钟差点评（昨天无痕迹则报首动时刻）；
 *  - 今晚（≥18 点）有动静、日记还空着且连击 >0 → 末条挂连击提醒 */
export function buildNotes(data: RiverData): RiverNote[] {
  const notes: RiverNote[] = [];
  const day = data.today;
  if (!day.events.length) return notes;
  if (day.firstTs !== null) {
    if (data.yesterday.firstTs !== null) {
      const diff = Math.round((day.firstTs - data.yesterday.firstTs) / 60000);
      if (diff > 0) notes.push({ index: 0, text: `动手比昨天晚了 ${diff} 分钟，不过来了就好。` });
      else if (diff < 0) notes.push({ index: 0, text: `动手比昨天早了 ${-diff} 分钟，好开头。` });
      else notes.push({ index: 0, text: '和昨天几乎同一时间动手，节奏很稳。' });
    } else {
      notes.push({ index: 0, text: `今天第一笔动静在 ${fmtHm(day.firstTs)}。` });
    }
  }
  const last = day.events[day.events.length - 1];
  const evening = new Date(last.ts);
  evening.setHours(18, 0, 0, 0);
  if (!data.streak.diaryWrittenToday && data.streak.diaryStreak > 0 && last.ts >= evening.getTime()) {
    notes.push({ index: day.events.length - 1, text: `晚上效率回来了——但日记还空着，×${data.streak.diaryStreak} 连击在等你。` });
  }
  return notes;
}

/** 明天预告卡 */
export interface RiverPreview {
  h: string;
  b: string;
  go: string;
  goLabel: string;
}

/** 预告规则（node 可测）：复习到期/逾期 → 剪藏库存 → 日记连击，三张卡 */
export function buildPreviews(data: RiverData): RiverPreview[] {
  const c = data.counts;
  const t = data.today.summary;
  const s = data.streak;
  const out: RiverPreview[] = [];
  if (c.reviewDueTomorrow > 0) {
    out.push({ h: `复习将到期 ${c.reviewDueTomorrow} 张`, b: '按 SRS 间隔推算，明天到期。今晚顺手过一遍队列，明天正好清干净。', go: 'review', goLabel: '去复习计划 →' });
  } else if (c.reviewOverdue > 0) {
    out.push({ h: `还有 ${c.reviewOverdue} 张逾期卡`, b: '逾期是唯一会随时间变贵的债。约 4 分钟一张，还掉最划算。', go: 'review', goLabel: '去还卡 →' });
  } else {
    out.push({ h: t.pomodoros > 0 ? `今天已专注 ${t.pomodoros} 轮` : '番茄引擎待命', b: '排一轮 25 分钟给明天最重要的那件事。', go: 'pomodoro', goLabel: '开番茄钟 →' });
  }
  out.push(
    c.clippingUnread > 0
      ? { h: `剪藏还压 ${c.clippingUnread} 篇`, b: '挑 1 篇放进明早：通勤读一篇，保持进出平衡。', go: 'clipping', goLabel: '挑一篇放明早 →' }
      : { h: '剪藏库已清空', b: '库存干净了，明天遇到好文章放心收。', go: 'clipping', goLabel: '去剪藏本 →' }
  );
  if (!s.diaryWrittenToday && s.diaryStreak > 0) {
    out.push({ h: `日记连击 ×${s.diaryStreak} 待续`, b: '写三行也算数。今晚补上，明天它自己接着长。', go: 'diary', goLabel: '去写日记 →' });
  } else if (s.diaryWrittenToday) {
    out.push({ h: `今日日记已写 · 连击 ×${s.diaryStreak + 1}`, b: '明天同一时间回来续上，连击就是这么长起来的。', go: 'diary', goLabel: '看日记本 →' });
  } else {
    out.push({ h: '给明天留一句话', b: '今晚写一篇日记，明晚它会变成回忆墙上的新格子。', go: 'diary', goLabel: '去写日记 →' });
  }
  return out;
}

/** 入口行彩点状态：ok=今天有动静 / warn=提醒（日记连击）/ hot=逾期 / off=无动静 */
export type RiverDot = 'ok' | 'warn' | 'hot' | 'off';

/** 彩点规则（node 可测；与原型 buildDots 一致，映射到 home 域 id：todo/memo 同源） */
export function buildDots(data: RiverData): Record<string, RiverDot> {
  const day = data.today;
  const hasEvent = (d: string): boolean => day.events.some((e) => e.domain === d);
  return {
    diary: day.summary.diary > 0 ? 'ok' : data.streak.diaryStreak > 0 ? 'warn' : 'off',
    review: data.counts.reviewOverdue > 0 ? 'hot' : 'off',
    memo: day.summary.todoDone + day.summary.todoCreated > 0 ? 'ok' : 'off',
    pomodoro: day.summary.pomodoros > 0 ? 'ok' : 'off',
    cinema: hasEvent('cinema') ? 'ok' : 'off',
    bookshelf: hasEvent('bookshelf') ? 'ok' : 'off',
  };
}

/** 全部域入口行计数文案（id 与 domains.ts 一致；缺数据回落域副题） */
export function riverCountText(id: string, data: RiverData): string | null {
  const c = data.counts;
  switch (id) {
    case 'diary':
      return `${c.diaryTotal} 篇${data.streak.diaryWrittenToday ? ' · 今日已写' : ''}`;
    case 'review':
      return c.reviewOverdue > 0 ? `${c.reviewTotal} 张 · 逾期 ${c.reviewOverdue}` : `${c.reviewTotal} 张在册`;
    case 'cinema':
      return `想看 ${c.cinemaWant} · 在看 ${c.cinemaWatching}`;
    case 'bookshelf':
      return `在读 ${c.bookshelfReading} · 读完 ${c.bookshelfFinished}`;
    case 'clipping':
      return `未读 ${c.clippingUnread} 篇`;
    case 'favorites':
      return `${c.favoritesTotal} 条`;
    case 'belongings':
      return `登记 ${c.belongingsTotal} 件`;
    case 'wall':
      return `${c.diaryTotal} 格`;
    default:
      return null; // recap/literature/reading-report/attach/encrypt/smartcat/settings/pomodoro 走域副题
  }
}
