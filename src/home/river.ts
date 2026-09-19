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
 *  - 时间线痕迹 = 小橘行为流（issue 305 / ADR-0132，映射见 ./behavior-timeline；外部文件改动免疫）；
 *  - 时间线所在天的摘要 summary 仍由 recap collectRecap（五域文件统计）供给，anchor 天然支持任意天；
 *  - 计数复用各域既有口径：cinema 评分三分（同 snapshot）、bookshelf md+EPUB 状态三分
 *    （同 bookshelf 域）、review 到期/逾期（同 snapshot reviewApp.loadItems）、
 *    clipping 未读 = news.json !read 计数、favorites/belongings 同 snapshot、
 *    游戏库 = rebuildItems 款数/时长（同 gameshelf 域）、知识盒 = 三盒目录 md 计数、
 *    第二大脑 = json+vec 字节数、番茄 = history+周归档（2026-09-18 用户点名四项）；
 *  - 日记连击：日记目录「YYMMDDHHmm(-N).md」条目题目日期，从今天往回连续存在的天数
 *    （今天未写不断签；ADR-0130 一目一文件口径）。
 */
import type { App, TFile } from 'obsidian';
import { collectRecap, settingDir, fileIfExists, readJsonIfExists } from '../recap/aggregate';
import { behaviorToDays, readBehaviorItems, type TimelineEvent } from './behavior-timeline';
import type { RecapSummary } from '../recap/aggregate';
import { tryGetSettings } from '../core/settings-provider';
import { storageFile } from '../core/storage';
import { diaryDateFromEntryPath } from '../core/diary-format';
import { reviewApp } from '../review/app';
import type { ReviewItem } from '../review/data';
import { parseMovieFile } from '../cinema/data';
import { STATUS_WANT, STATUS_WATCHING } from '../cinema/constants';
import { scanMarkdownBooks, loadEpubItems } from '../bookshelf/data';
import { loadDatabase as loadBelongings } from '../belongings/data';
import { DataManager as FavoritesDataManager } from '../favorites/data';
import { getStoragePath as getFavoritesPath } from '../favorites/config';
import { rebuildItems } from '../gameshelf/notes';
import { getKnowledgeBoxes } from '../core/knowledge-boxes';
import { getPomodoroFilePath } from '../pomodoro/data';
import { EMPTY_COUNTS, EMPTY_SUMMARY, dateStrOf, timelineRangeDays } from './shared';
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

/* ---------- 行为流事件 → RiverDay ---------- */

/** 一天的时间线：事件升序 + memoCreated 派生（行为流「新增备忘录」文案前缀契约）。
 *  summary 数字仍来自 recap（issue 305 / ADR-0132：只换痕迹源，不动计数面）。 */
function toRiverDay(dateStr: string, summary: RecapSummary, events: TimelineEvent[]): RiverDay {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const full: RiverSummary = { ...summary, memoCreated: sorted.filter((e) => e.text.startsWith('新增备忘录')).length };
  return { dateStr, events: sorted, summary: full, firstTs: sorted.length ? sorted[0].ts : null };
}

/* ---------- 计数采集（各源独立容错） ----------
   只读小工具收编 recap 正典（cons P3-4）：settingDir/fileIfExists/readJsonIfExists，
   本文件已静态依赖 recap（collectRecap），收编零新增依赖边、不引环。 */

/* ---------- 计数采集（各源独立容错） ---------- */

/** 复习：总数 / 逾期 / 明天到期（口径同 snapshot reviewApp.loadItems） */
async function collectReviewCounts(app: App, now: number, c: RiverCounts): Promise<void> {
  const filePath = storageFile('review.json');
  if (!fileIfExists(app, filePath)) return;
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
  if (!fileIfExists(app, filePath)) return;
  const dm = new FavoritesDataManager(filePath);
  const all = await dm.getAll();
  c.favoritesTotal = (Array.isArray(all) ? all : []).filter((i) => !(i as { archived?: boolean }).archived).length;
}

/** 归物：登记件数（口径同 snapshot） */
async function collectBelongingsCounts(app: App, c: RiverCounts): Promise<void> {
  const filePath = storageFile('belongings.json');
  if (!fileIfExists(app, filePath)) return;
  const db = await loadBelongings();
  c.belongingsTotal = Object.keys((db as { items?: Record<string, unknown> }).items ?? {}).length;
}

/** 备忘录：未完成条数 + 重要未完成条数（memo.json 同源直读，不依赖 DataManager 单例；文件缺失不建）。
 *  「重要」判定先例 = memo/reminder.ts（priority==='important' 且未完成；item-1789106079981 彩点 hot 条件）；
 *  memoOpen 继续全量口径（riverCountText「N 条待办」在用），两字段互不覆盖。 */
async function collectMemoCounts(app: App, c: RiverCounts): Promise<void> {
  const raw = await readJsonIfExists(app, storageFile('memo.json'));
  const all = Array.isArray(raw) ? raw : [];
  const open = (all as Array<Record<string, unknown>>).filter((m) => !m?.completed);
  c.memoOpen = open.length;
  c.memoUrgentOpen = open.filter((m) => m?.priority === 'important').length;
}

/** 游戏库：款数 + 总时长（2026-09-18 用户点名）。rebuildItems 单源口径（AppID 合法笔记，含已下架；
 *  metadataCache 零 IO）；顺手刷新 gameshelf 内存缓存无害——面板打开时本就整体重建。 */
function collectGameshelfCounts(app: App, c: RiverCounts): void {
  const items = rebuildItems(app);
  c.gameshelfTotal = items.length;
  c.gameshelfMinutes = items.reduce((s, it) => s + (it.playtimeMin || 0), 0);
}

/** 知识盒：文献/卡片/主题三盒各自笔记数（2026-09-18 用户点名；目录前缀 md 计数，盒目录实时读设置）。
 *  效率 P2-1：一次遍历三盒合计（原三次全库 filter——同一份文件列表过滤三遍）。 */
function collectKnowledgeCounts(mdFiles: TFile[], c: RiverCounts): void {
  const boxes = getKnowledgeBoxes();
  const dirs: Array<[keyof RiverCounts, string]> = [
    ['knowledgeLit', boxes.lit],
    ['knowledgeCards', boxes.cardbox],
    ['knowledgeTopics', boxes.topic],
  ];
  for (const [key, dir] of dirs) {
    if (!dir) continue; // 盒目录未配置 → 0（同旧 countIn 空目录口径）
    for (const f of mdFiles) {
      if (f.path.startsWith(dir + '/')) c[key]++;
    }
  }
}

/** 第二大脑：存储占用（2026-09-18 用户点名）= secondbrain.json + secondbrain.vec 字节数；
 *  只 stat 不读内容，文件缺失跳过（json+vec 可能只存在其一）。 */
function collectSecondbrainBytes(app: App, c: RiverCounts): void {
  for (const p of [storageFile('secondbrain.json'), storageFile('secondbrain.vec')]) {
    try {
      const f = app.vault.getAbstractFileByPath(p) as TFile | null;
      if (f && f.stat && typeof f.stat.size === 'number') c.secondbrainBytes += f.stat.size;
    } catch {
      /* 单文件失败不拖垮 */
    }
  }
}

/** 番茄钟：累计专注轮数（2026-09-18 用户点名）= history 明细条数 + 周归档 count 合计。
 *  trimWithArchive 落账口径：明细与归档按日恒不交（issue 357），两段相加不双计；
 *  pomodoro.json 同源直读（getPomodoroFilePath 跟随 storagePath），缺失/坏数据回落 0。 */
async function collectPomodoroTotal(app: App, c: RiverCounts): Promise<void> {
  const raw = await readJsonIfExists(app, getPomodoroFilePath());
  if (!raw || typeof raw !== 'object') return;
  const d = raw as { history?: unknown[]; archived?: Array<{ count?: unknown }> };
  c.pomodoroTotal =
    (Array.isArray(d.history) ? d.history.length : 0)
    + (Array.isArray(d.archived)
      ? d.archived.reduce((s, r) => s + (r && typeof r.count === 'number' && r.count > 0 ? r.count : 0), 0)
      : 0);
}

/** 番茄钟是否正在专注（计时中或暂停中；item-1789106079981 彩点 warn 条件）——
 *  跨域**只读**：isFocusing 无副作用（不加载、不恢复、不通知），动态 import 遵守 ADR-0002；
 *  失败回落 false（同 ui.ts readPomodoroFocusing 先例；ensure 兜底留给 ui 层，本层不触发恢复副作用）。 */
async function collectFocusing(): Promise<boolean> {
  try {
    const m = await import('../pomodoro');
    return m.isFocusing();
  } catch {
    return false;
  }
}

/** 日记总数（目录前缀 md 数，含子目录）+ 写作连击（今天未写不算断）。
 *  效率 P2-1：一次遍历把条目日期收进 Set 再数连击（原「连击天数 × 全库遍历」——
 *  hasDiaryDay 每天一次 getMarkdownFiles().some，O(连击 × 文件数)）。 */
function collectDiary(now: number, mdFiles: TFile[], c: RiverCounts): RiverStreak {
  const dir = settingDir(['diaryDirectory'], '我的/日记');
  const dates = new Set<string>();
  let total = 0;
  for (const f of mdFiles) {
    if (!f.path.startsWith(dir + '/')) continue;
    total++;
    const d = diaryDateFromEntryPath(f.path);
    if (d) dates.add(d);
  }
  c.diaryTotal = total;
  const writtenToday = dates.has(dateStrOf(now));
  let streak = 0;
  // 今天已写从今天起算；未写从昨天起算（连击不断签），再往回数连续日期
  for (let t = writtenToday ? now : now - DAY_MS; dates.has(dateStrOf(t)); t -= DAY_MS) {
    streak++;
  }
  return { diaryStreak: streak, diaryWrittenToday: writtenToday };
}

/* ---------- 聚合入口 ---------- */

/** 采集窗口下限：渲染点评 buildNotes 要读「昨天首动」（data.yesterday.firstTs），
 *  窗口只含今天会在渲染层崩——「当天」档也保底采 2 天，渲染层 slice 自行裁显示。 */
const DAYS_MIN = 2;
/** 采集窗口上限（week 档 = 周历全长） */
const DAYS_MAX = 7;

/** 采集窗口（eff P2-1）：随「时间范围」设置档裁剪（today=2 / 3d=3 / week=7）。
 *  渲染消费面（ui.renderAll 的 days/week slice(0, rangeDays)）行为等价——
 *  范围档本就只显示前 rangeDays 天，采集恒 7 天全量是纯浪费。 */
function collectDaysN(): number {
  let range = 'week';
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    if (typeof s.homeTimelineRange === 'string' && s.homeTimelineRange) range = s.homeTimelineRange;
  } catch {
    /* 设置读取失败按 week 全量 */
  }
  return Math.min(DAYS_MAX, Math.max(DAYS_MIN, timelineRangeDays(range)));
}

/** 采集活动河全量数据（今天/昨天时间线 + 连击 + 全部域计数；全程只读） */
export async function collectRiver(app: App, now: number = Date.now()): Promise<RiverData> {
  // 采集窗口（今天起往回 DAYS_N 天）一次并行采集；recap anchor 参数天然支持任意天
  const DAYS_N = collectDaysN();
  const [dayRecaps, behaviorItems] = await Promise.all([
    Promise.all(
      Array.from({ length: DAYS_N }, (_, i) => collectRecap(app, now - i * DAY_MS).catch(() => null))
    ),
    // 时间线痕迹源 = 小橘行为流（issue 305 / ADR-0132）：文件推导口径退役，外部改动免疫
    readBehaviorItems(app).catch(() => []),
  ]);
  const behaviorDays = behaviorToDays(behaviorItems, now, DAYS_N);

  const counts: RiverCounts = { ...EMPTY_COUNTS };
  const safe = (fn: () => void | Promise<void>): Promise<void> =>
    Promise.resolve()
      .then(fn)
      .catch(() => undefined);
  // 全库 md 文件列表一轮采集内取一次，计数/连击分支共享（eff P2-1 同刷新内结果复用：
  // 原 collectDiary/collectKnowledgeCounts 各自调 getMarkdownFiles，连击循环里更是每天一遍）
  let mdFiles: TFile[] = [];
  try {
    mdFiles = app.vault.getMarkdownFiles();
  } catch {
    mdFiles = []; // 目录读取失败：knowledge/diary 计数回落 0（同旧各自容错口径）
  }
  // 专注相位与计数同一波并发（collectFocusing 自带失败回落 false）；
  // as const 保二元组型——否则 spread 数组并入后 focusing 会被 widen 成 void | boolean
  const [, focusing] = await Promise.all([
    Promise.all(
      [
        () => collectReviewCounts(app, now, counts),
        () => collectCinemaCounts(app, counts),
        () => collectBookshelfCounts(app, counts),
        () => collectClippingCounts(app, counts),
        () => collectFavoritesCounts(app, counts),
        () => collectBelongingsCounts(app, counts),
        () => collectMemoCounts(app, counts),
        () => collectGameshelfCounts(app, counts),
        () => collectKnowledgeCounts(mdFiles, counts),
        () => collectSecondbrainBytes(app, counts),
        () => collectPomodoroTotal(app, counts),
      ].map(safe)
    ),
    collectFocusing(),
  ] as const);
  let streak: RiverStreak = { diaryStreak: 0, diaryWrittenToday: false };
  try {
    streak = collectDiary(now, mdFiles, counts);
  } catch {
    /* 连击计算失败回落空 */
  }

  // 时间线痕迹源 = 小橘行为流（issue 305 / ADR-0132）：recap 只继续供 summary/周历 hit，
  // items 不再进时间线——文件推导口径退役，外部批量改动不再产生任何时间线条目。
  const days: RiverDay[] = dayRecaps.map((r, i) =>
    toRiverDay(dateStrOf(now - i * DAY_MS), r?.summary ?? EMPTY_SUMMARY, behaviorDays[i]?.events ?? [])
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
    pomodoroFocusing: focusing,
  };
}
