/**
 * 今日回顾（recap 域）聚合层（方向一 R2）：五域「今天」痕迹聚合。
 *
 * 口径与 home/weekly.ts（R1 生活周报）对齐但限当天（本地时区 0 点 ~ 次日 0 点）：
 * 全部只读（json 先探测存在再读、目录缺失不建目录、不 new 任何数据）；
 * 各源独立容错——某源读取失败记入 failed（摘要显示 N/A），不拖垮整面板。
 *
 * 数据源逐项口径：
 *  - diary     当天日记文件（YYYY-MM-DD.md）parseFile 解析条目（diary 数据层只读复用，
 *              同 diary-wall 先例）；时间轴聚合一行「新增 N 条」（时刻取当天最后一条；
 *              加密条目同日记本口径不可见不计数）
 *  - cinema    影院目录：观影日期=今天 → 「标记已看」（带星级，评分制同影院）；
 *              无观影日期而笔记创建在今天 → 「加入片单」
 *  - bookshelf 书架墙 md + EPUB：completionDate=今天 → 「读完」；在读且笔记改动在今天
 *              → 「读到 N%」（进度无历史记录，mtime 是唯一可测信号，口径从宽）
 *  - todo      memo.json（todo 同源直读，不依赖 DataManager 单例、不触发补写）：
 *              completed/created 落今天 → 「完成 / 新增待办」
 *  - pomodoro  pomodoro.json history：完成时刻落今天 → 专注区间（ts=完成时刻，
 *              实际区间 [ts-duration, ts]，归属任务名带上）
 */
import type { App, TFile } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { storageFile } from '../core/storage';
import { parseLocalDay } from '../home/weekly';
import { parseFile, isEncryptedEntry } from '../diary/parser';
import { parseMovieFile } from '../cinema/data';
import { STATUS_WATCHED, getStarString } from '../cinema/constants';
import { scanMarkdownBooks, loadEpubItems } from '../bookshelf/data';

/** 痕迹归属域（与 DOMAIN_ICONS 键一致） */
export type RecapDomain = 'diary' | 'cinema' | 'bookshelf' | 'todo' | 'pomodoro';

/** 时间轴一条痕迹：时刻 + 域 + 一句话（域图标/域名前缀由渲染层拼装） */
export interface RecapItem {
  domain: RecapDomain;
  /** 排序与展示时刻（当天窗口内毫秒；无时刻可考的整日痕迹落 0 点） */
  ts: number;
  /** 时间标签：'HH:mm' 或番茄的 'HH:mm–HH:mm' */
  timeLabel: string;
  /** 一句话正文（如「标记《X》已看 · ★★★★☆」「完成『X』」） */
  text: string;
}

/** 顶部摘要行数字（缺数据一律 0；读取失败的域由 failed 标记显示 N/A） */
export interface RecapSummary {
  /** 今日日记条数 */
  diary: number;
  /** 今日影视（已看） */
  movies: number;
  /** 今日书（读完/有进度，同一本只计一次） */
  books: number;
  /** 今日完成待办 */
  todoDone: number;
  /** 今日番茄个数 */
  pomodoros: number;
  /** 今日专注分钟数（duration 秒求和四舍五入折分） */
  pomodoroMinutes: number;
}

export const EMPTY_SUMMARY: RecapSummary = {
  diary: 0,
  movies: 0,
  books: 0,
  todoDone: 0,
  pomodoros: 0,
  pomodoroMinutes: 0,
};

/** 聚合结果：summary + 时间正序 items + 读取失败域清单 */
export interface RecapData {
  summary: RecapSummary;
  items: RecapItem[];
  /** 读取失败的域（摘要显示 N/A；时间轴缺该域不视为空天） */
  failed: RecapDomain[];
}

/** 当天窗口（本地毫秒）：start = 当天 0 点（含），end = 次日 0 点（不含） */
export interface DayRange {
  start: number;
  end: number;
}

/** 采集源中间形态（纯数据，buildRecap 只吃这个，node 测试无需 vault） */
export interface RecapSources {
  /** 当天日记条目时刻（'HH:mm'，已滤加密条目） */
  diaryTimes: string[];
  /** 影视痕迹：watched=标记已看（带评分）；否则=新增片单 */
  movies: Array<{ name: string; watched: boolean; rating: number | null; ts: number }>;
  /** 读书痕迹：finished=读完；否则带进度 */
  books: Array<{ title: string; finished: boolean; progress: number | null; ts: number }>;
  /** 待办痕迹：done=完成；否则=新增 */
  todos: Array<{ title: string; done: boolean; ts: number }>;
  /** 番茄痕迹：ts=完成时刻，duration 秒 */
  pomodoros: Array<{ task: string | null; duration: number; ts: number }>;
}

export const EMPTY_SOURCES: RecapSources = {
  diaryTimes: [],
  movies: [],
  books: [],
  todos: [],
  pomodoros: [],
};

const DAY_MS = 86400000;

/** 当天窗口：anchor 为当天任意时刻，返回本地 0 点 ~ 次日 0 点 */
export function todayRange(anchor: number): DayRange {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  return { start: d.getTime(), end: d.getTime() + DAY_MS };
}

/** 'YYYY-MM-DD[ HH:mm[:ss]]' 日期串 → 本地毫秒（无时间部分取 0 点；非法返回 null）。
 *  刻意不走 new Date(str)：'YYYY-MM-DD' 会被按 UTC 解析，时区西移处周边界漂移一天
 *  （同 home/weekly.ts parseLocalDay 的坑；此处扩展出时间部分供待办完成时刻排序） */
export function parseLocalDateTime(s: unknown): number | null {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(String(s ?? ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const hh = m[4] !== undefined ? Number(m[4]) : 0;
  const mi = m[5] !== undefined ? Number(m[5]) : 0;
  const ss = m[6] !== undefined ? Number(m[6]) : 0;
  if (hh > 23 || mi > 59 || ss > 59) return null;
  return new Date(y, mo - 1, d, hh, mi, ss).getTime();
}

/** 时刻 → 'HH:mm'（本地时区） */
export function fmtHM(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 时间戳落在当天窗口 [start, end) */
function inRange(t: number, range: DayRange): boolean {
  return Number.isFinite(t) && t >= range.start && t < range.end;
}

/** 无时刻可考的整日痕迹：窗口内用原值，窗外落 0 点（排序沉底为当天最早） */
function clampToDay(t: number, range: DayRange): number {
  return inRange(t, range) ? t : range.start;
}

/** 'HH:mm' → 当天内毫秒偏移（非法返回 null） */
function hmOffset(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? ''));
  if (!m) return null;
  const hh = Number(m[1]);
  const mi = Number(m[2]);
  if (hh > 23 || mi > 59) return null;
  return hh * 3600000 + mi * 60000;
}

/** 聚合纯函数：采集源 → 摘要数字 + 时间正序痕迹流（不碰 vault，node 可测） */
export function buildRecap(
  sources: RecapSources,
  range: DayRange
): { summary: RecapSummary; items: RecapItem[] } {
  const summary: RecapSummary = { ...EMPTY_SUMMARY };
  const items: RecapItem[] = [];

  // 日记：聚合一行「新增 N 条」，时刻 = 当天最后一条条目
  summary.diary = sources.diaryTimes.length;
  if (sources.diaryTimes.length) {
    const offsets = sources.diaryTimes.map(hmOffset).filter((v): v is number => v !== null);
    const last = offsets.length ? Math.max(...offsets) : 0;
    const ts = range.start + last;
    items.push({ domain: 'diary', ts, timeLabel: fmtHM(ts), text: `新增 ${summary.diary} 条` });
  }

  // 影视：已看（带星级，评分制同影院 getStarString）；新增片单
  // （窗口不变式在聚合层统一收口：窗外无时刻可考的痕迹一律落当天 0 点）
  for (const m of sources.movies) {
    const ts = clampToDay(m.ts, range);
    if (m.watched) {
      summary.movies++;
      const star = m.rating !== null && m.rating > 0 ? ` · ${getStarString(m.rating)}` : '';
      items.push({ domain: 'cinema', ts, timeLabel: fmtHM(ts), text: `标记《${m.name}》已看${star}` });
    } else {
      items.push({ domain: 'cinema', ts, timeLabel: fmtHM(ts), text: `《${m.name}》加入片单` });
    }
  }

  // 读书：读完 / 读到 N%；同一本（读完且有进度痕迹）只计一次、只留读完一条
  const bookSeen = new Set<string>();
  const bookDated = [...sources.books].sort((a, b) => a.ts - b.ts);
  for (const b of bookDated) {
    const seen = bookSeen.has(b.title);
    if (!seen) {
      summary.books++;
      bookSeen.add(b.title);
    }
    const ts = clampToDay(b.ts, range);
    if (b.finished) {
      items.push({ domain: 'bookshelf', ts, timeLabel: fmtHM(ts), text: `读完《${b.title}》` });
    } else {
      items.push({
        domain: 'bookshelf',
        ts,
        timeLabel: fmtHM(ts),
        text: `《${b.title}》读到 ${b.progress ?? 0}%`,
      });
    }
  }

  // 待办：完成 / 新增
  for (const t of sources.todos) {
    const ts = clampToDay(t.ts, range);
    if (t.done) {
      summary.todoDone++;
      items.push({ domain: 'todo', ts, timeLabel: fmtHM(ts), text: `完成『${t.title}』` });
    } else {
      items.push({ domain: 'todo', ts, timeLabel: fmtHM(ts), text: `新增待办『${t.title}』` });
    }
  }

  // 番茄：区间标签 [ts-duration, ts] + 归属任务名
  let seconds = 0;
  for (const p of sources.pomodoros) {
    summary.pomodoros++;
    seconds += Number(p.duration) || 0;
    const ts = clampToDay(p.ts, range);
    const durMs = (Number(p.duration) || 0) * 1000;
    const task = p.task ? `《${p.task}》` : '';
    const minutes = Math.round((Number(p.duration) || 0) / 60);
    items.push({
      domain: 'pomodoro',
      ts,
      timeLabel: durMs > 0 ? `${fmtHM(ts - durMs)}–${fmtHM(ts)}` : fmtHM(ts),
      text: `专注${task} · ${minutes} 分钟`,
    });
  }
  summary.pomodoroMinutes = Math.round(seconds / 60);

  items.sort((a, b) => a.ts - b.ts);
  return { summary, items };
}

/* ---------- 采集 helpers（与 home/weekly.ts 同款只读口径；本地副本防跨文件牵连） ---------- */

function settingDir(keys: string[], def: string): string {
  const s = tryGetSettings() as Record<string, unknown>;
  for (const k of keys) {
    const v = s[k];
    if (typeof v === 'string' && v.trim()) return v.trim().replace(/\/+$/, '');
  }
  return def;
}

function numOr0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** 文件存在才返回文件对象（不触发建文件） */
function fileIfExists(app: App, filePath: string): TFile | null {
  try {
    const f = app.vault.getAbstractFileByPath(filePath);
    return f && 'basename' in (f as object) ? (f as TFile) : null;
  } catch {
    return null;
  }
}

/** 读 json 文件：缺失返回 undefined（合法空，不算失败）；存在但读取/解析失败抛错，
 *  由调用方 per-source 容错记入 failed（摘要 N/A，同「某域读取失败不炸面板」契约） */
async function readJsonIfExists(app: App, filePath: string): Promise<unknown | undefined> {
  const f = fileIfExists(app, filePath);
  if (!f) return undefined;
  return JSON.parse(await app.vault.read(f));
}

/** 本地时区日期串 'YYYY-MM-DD'（日记文件名口径） */
function localDayStr(anchor: number): string {
  const d = new Date(anchor);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 采集当天五域痕迹（各源独立容错，失败该域记入 failed 不炸整面板；全程只读不建文件/目录） */
export async function collectRecap(app: App, now: number = Date.now()): Promise<RecapData> {
  const range = todayRange(now);
  const failed: RecapDomain[] = [];
  const sources: RecapSources = {
    diaryTimes: [],
    movies: [],
    books: [],
    todos: [],
    pomodoros: [],
  };

  // 日记：当天文件解析条目（加密条目同日记本口径不可见）
  try {
    const dir = settingDir(['diaryDirectory'], '我的/日记');
    const dateStr = localDayStr(now);
    const f = fileIfExists(app, `${dir}/${dateStr}.md`);
    if (f) {
      const entries = parseFile(await app.vault.read(f), dateStr).filter((e) => !isEncryptedEntry(e));
      sources.diaryTimes = entries.map((e) => e.time);
    }
  } catch {
    failed.push('diary');
  }

  // 影视：观影日期=今天 → 已看；无观影日期而创建在今天 → 加入片单
  try {
    const folder = settingDir(['cinemaFolderPath'], '我的/影视');
    for (const f of app.vault.getMarkdownFiles()) {
      if (!f.path.startsWith(folder + '/')) continue;
      const item = parseMovieFile(f as TFile, app);
      if (!item) continue;
      const stat = (item.file as { stat?: { ctime?: unknown; mtime?: unknown } } | null)?.stat;
      const wd = parseLocalDay(item.watchDate);
      if (item.status === STATUS_WATCHED && wd === range.start) {
        // 标记已看的时刻无独立记录，mtime 是最近一次改动（通常是标记动作）的近似；
        // 窗外时刻由 buildRecap 统一钳回当天 0 点
        sources.movies.push({
          name: item.name,
          watched: true,
          rating: item.rating,
          ts: numOr0(stat?.mtime),
        });
      } else if (inRange(numOr0(stat?.ctime), range)) {
        sources.movies.push({ name: item.name, watched: false, rating: null, ts: numOr0(stat?.ctime) });
      }
    }
  } catch {
    failed.push('cinema');
  }

  // 读书：md + EPUB 读完；在读且笔记改动在今天 → 读到 N%（mtime 从宽口径）
  try {
    for (const b of scanMarkdownBooks(app)) {
      const finished = parseLocalDay(b.completionDate) === range.start;
      const mtime = numOr0((b.file as { stat?: { mtime?: unknown } } | null)?.stat?.mtime);
      if (finished) {
        sources.books.push({ title: b.title, finished: true, progress: null, ts: mtime });
      } else if (b.status === '在读' && b.progress > 0 && inRange(mtime, range)) {
        sources.books.push({ title: b.title, finished: false, progress: b.progress, ts: mtime });
      }
    }
    for (const b of await loadEpubItems(app)) {
      if (parseLocalDay(b.completionDate) === range.start) {
        sources.books.push({ title: b.title, finished: true, progress: null, ts: range.start });
      }
    }
  } catch {
    failed.push('bookshelf');
  }

  // 待办：memo.json 直读（todo 同源；不依赖 DataManager 单例初始化，文件缺失不建）
  try {
    const raw = await readJsonIfExists(app, storageFile('memo.json'));
    const all = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
    for (const it of all) {
      const title = typeof it?.title === 'string' ? it.title : '';
      if (!title) continue;
      const done = parseLocalDateTime(it.completed);
      if (done !== null && inRange(done, range)) sources.todos.push({ title, done: true, ts: done });
      const created = parseLocalDateTime(it.created);
      if (created !== null && inRange(created, range)) sources.todos.push({ title, done: false, ts: created });
    }
  } catch {
    failed.push('todo');
  }

  // 番茄：pomodoro.json history（文件缺失不建文件；直读不走 DataManager 防坏文件触发留档重建）
  try {
    const raw = await readJsonIfExists(app, storageFile('pomodoro.json'));
    const history = Array.isArray((raw as { history?: unknown })?.history)
      ? ((raw as { history: unknown[] }).history as Array<Record<string, unknown>>)
      : [];
    for (const h of history) {
      const ts = numOr0(h?.ts);
      if (!ts || !inRange(ts, range)) continue;
      sources.pomodoros.push({
        task: typeof h?.task === 'string' && h.task ? h.task : null,
        duration: numOr0(h?.duration),
        ts,
      });
    }
  } catch {
    failed.push('pomodoro');
  }

  const { summary, items } = buildRecap(sources, range);
  return { summary, items, failed };
}
