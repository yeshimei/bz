/**
 * 内容首页（home 域）本周聚合（R1 生活周报轻卡）：跨五域「本周」数字故事。
 *
 * 口径：自然周、周一为一周起点（本地时区；对齐 smartcat dossier weekStartMs /
 * review stats heatmap 的周一对齐先例）。全部只读，延续 snapshot.ts 快照契约：
 * json 文件先探测存在再读（不建文件）、目录缺失不建目录、各源独立容错该项回落 0，
 * 不拖垮整份快照，也不写任何域。
 *
 * 数据源逐项口径：
 *  - movies   影院已看条目（status=WATCHED）：观影日期落本周；无有效观影日期才
 *             回退笔记创建时间（file.stat.ctime）落本周
 *  - books    书架墙读完：completionDate 落本周（md 书目，口径同快照在读徽标）
 *  - pomodoro pomodoro.json history：完成时刻落本周条数 + duration 秒折分钟
 *  - todo     memo.json（todo 同源）：completed 落本周=完成数，created 落本周=创建数
 *             （完成率 P%=完成/创建，创建 0 则 UI 侧只显示完成数）
 *  - diary    日记目录文件名（YYYY-MM-DD.md，同快照「今日已写」口径）落本周条数
 */
import type { App, TFile } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { storageFile } from '../core/storage';
import { parseMovieFile } from '../cinema/data';
import { STATUS_WATCHED } from '../cinema/constants';
import { scanMarkdownBooks } from '../bookshelf/data';
import { PomodoroDataManager } from '../pomodoro/data';

/** 周窗口（本地毫秒）：start = 本周一 0 点（含），end = 下周一 0 点（不含） */
export interface WeekRange {
  start: number;
  end: number;
}

/** 本周聚合值（周卡五格；缺数据一律 0，UI 格子常驻不隐藏不跳变） */
export interface WeeklyStat {
  /** 本周影视（已看：观影日期/创建落本周） */
  movies: number;
  /** 本周读完（completionDate 落本周） */
  booksFinished: number;
  /** 本周番茄个数 */
  pomodoros: number;
  /** 本周专注分钟数（duration 秒求和四舍五入折分） */
  pomodoroMinutes: number;
  /** 本周完成待办（completed 落本周） */
  todoDone: number;
  /** 本周创建待办（created 落本周） */
  todoCreated: number;
  /** 本周日记条数 */
  diary: number;
}

export const EMPTY_WEEKLY: WeeklyStat = {
  movies: 0,
  booksFinished: 0,
  pomodoros: 0,
  pomodoroMinutes: 0,
  todoDone: 0,
  todoCreated: 0,
  diary: 0,
};

const DAY_MS = 86400000;

/** 本周窗口（周一 0 点 ~ 下周一 0 点，本地时区）；anchor 为本周内任意时刻 */
export function currentWeekRange(anchor: number): WeekRange {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  const start = d.getTime() - ((d.getDay() + 6) % 7) * DAY_MS; // 周一=0（getDay 0=周日）
  return { start, end: start + 7 * DAY_MS };
}

/** 日期串前缀解析（'YYYY-MM-DD…' → 本地当日 0 点毫秒；非法返回 null）。
 *  刻意不走 new Date(str)：'YYYY-MM-DD' 会被按 UTC 解析，时区西移处周边界漂移一天 */
export function parseLocalDay(s: unknown): number | null {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s ?? ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(y, mo - 1, d).getTime();
}

/** 时间戳是否落在周窗口 [start, end) */
function inWeek(t: number | null | undefined, range: WeekRange): boolean {
  return typeof t === 'number' && Number.isFinite(t) && t >= range.start && t < range.end;
}

/** 本周影视计数（纯函数）：已看条目按观影日期判周；无有效日期回退创建时间 */
export function countMoviesThisWeek(
  items: Array<{ watchDate: string | null; ctime: number; watched: boolean }>,
  range: WeekRange
): number {
  return items.filter((it) => {
    if (!it.watched) return false;
    const wd = parseLocalDay(it.watchDate);
    if (wd !== null) return inWeek(wd, range);
    return inWeek(it.ctime, range);
  }).length;
}

/** 本周读完计数（纯函数）：completionDate 落本周的条目数 */
export function countBooksFinished(
  items: Array<{ completionDate: string | null }>,
  range: WeekRange
): number {
  return items.filter((it) => inWeek(parseLocalDay(it.completionDate), range)).length;
}

/** 本周番茄聚合（纯函数）：完成时刻落本周的个数与专注分钟数（duration 秒求和折分钟，四舍五入） */
export function sumPomodoroWeek(
  history: Array<{ ts: number; duration: number }>,
  range: WeekRange
): { count: number; minutes: number } {
  let count = 0;
  let seconds = 0;
  for (const h of history) {
    if (!inWeek(h.ts, range)) continue;
    count++;
    seconds += Number(h.duration) || 0;
  }
  return { count, minutes: Math.round(seconds / 60) };
}

/** 本周待办聚合（纯函数）：completed 落本周=完成数，created 落本周=创建数（两项独立计） */
export function todoWeekStats(
  items: Array<Record<string, unknown>>,
  range: WeekRange
): { done: number; created: number } {
  let done = 0;
  let created = 0;
  for (const it of items) {
    if (inWeek(parseLocalDay(it.completed), range)) done++;
    if (inWeek(parseLocalDay(it.created), range)) created++;
  }
  return { done, created };
}

/** 本周日记计数（纯函数）：文件名（basename，'YYYY-MM-DD'）落本周的条数；非日期名忽略 */
export function countDiaryThisWeek(basenames: string[], range: WeekRange): number {
  return basenames.filter((n) => inWeek(parseLocalDay(n), range)).length;
}

/* ---------- 采集 helpers（与 snapshot.ts 同款只读口径；本地副本防跨文件牵连） ---------- */

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

/** 读 json 文件原始内容（仅文件存在时读，不触发建文件；解析失败回落 null） */
async function readJsonIfExists(app: App, filePath: string): Promise<unknown | null> {
  if (!fileExists(app, filePath)) return null;
  try {
    const f = app.vault.getAbstractFileByPath(filePath) as TFile;
    return JSON.parse(await app.vault.read(f));
  } catch {
    return null;
  }
}

/** 目录下 md 文件 basename 清单（目录不存在返回 []，不建目录） */
function dirMdBasenames(app: App, dir: string): string[] {
  try {
    const f = app.vault.getAbstractFileByPath(dir);
    if (!f || !('children' in f)) return [];
    const children = (f as { children: unknown[] }).children;
    if (!Array.isArray(children)) return [];
    return children
      .filter((c: unknown) => !!c && (c as { extension?: string }).extension === 'md')
      .map((c) => String((c as { basename?: string }).basename ?? ''));
  } catch {
    return [];
  }
}

/** 采集本周聚合（各源独立容错，失败该项回落 0；全程只读不建文件/目录） */
export async function collectWeeklyStat(app: App, now: number = Date.now()): Promise<WeeklyStat> {
  const range = currentWeekRange(now);
  const out: WeeklyStat = { ...EMPTY_WEEKLY };

  // 影视：影院目录已看条目（观影日期落本周；无日期回退笔记创建时间）
  try {
    const folder = settingDir(['cinemaFolderPath'], '我的/影视');
    const items: Array<{ watchDate: string | null; ctime: number; watched: boolean }> = [];
    for (const f of app.vault.getMarkdownFiles()) {
      if (!f.path.startsWith(folder + '/')) continue;
      const item = parseMovieFile(f as TFile, app);
      if (!item) continue;
      const st = (item.file as { stat?: { ctime?: unknown } } | null)?.stat;
      items.push({
        watchDate: item.watchDate,
        ctime: typeof st?.ctime === 'number' ? st.ctime : 0,
        watched: item.status === STATUS_WATCHED,
      });
    }
    out.movies = countMoviesThisWeek(items, range);
  } catch {
    /* 目录缺失/解析失败：回落 0 */
  }

  // 读完：书架 md 书目 completionDate 落本周（口径同快照在读徽标的 md 书目）
  try {
    out.booksFinished = countBooksFinished(scanMarkdownBooks(app), range);
  } catch {
    /* 目录缺失等：回落 0 */
  }

  // 番茄：pomodoro.json history（文件缺失不建文件）
  try {
    const filePath = storageFile('pomodoro.json');
    if (fileExists(app, filePath)) {
      const data = await new PomodoroDataManager(app).load();
      const history = (data as { history?: Array<{ ts: number; duration: number }> })?.history ?? [];
      const s = sumPomodoroWeek(history, range);
      out.pomodoros = s.count;
      out.pomodoroMinutes = s.minutes;
    }
  } catch {
    /* 读失败：回落 0 */
  }

  // 待办：memo.json 直读（todo 同源；不依赖 DataManager 单例初始化，文件缺失不建）
  try {
    const raw = await readJsonIfExists(app, storageFile('memo.json'));
    const all = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
    const s = todoWeekStats(all, range);
    out.todoDone = s.done;
    out.todoCreated = s.created;
  } catch {
    /* 读失败：回落 0 */
  }

  // 日记：目录文件名 YYYY-MM-DD 落本周
  try {
    const dir = settingDir(['diaryDirectory'], '我的/日记');
    out.diary = countDiaryThisWeek(dirMdBasenames(app, dir), range);
  } catch {
    /* 目录缺失：回落 0 */
  }

  return out;
}
