/**
 * 内容首页（home 域）跨域统计快照：为每张域卡读取真实数据（只读，不调任何
 * 带 DOM/轮询/通知副作用的 ensure/open；读失败一律静默回落默认，保证首页可开）。
 *
 * 数据源逐域对齐（直连各域 data/stats 纯函数层与常量；目录取设置字符串，
 * 因各域模块常量可能尚未被该域 apply 覆写——目录不存在一律 null → 计数回落默认）：
 *  - diary    目录 children md 数 + 今日已写（文件名 = 日期）
 *  - memo     memo.json（memo DataManager.loadItems 无参，走 core getApp）
 *  - cinema   cinemaFolderPath 前缀扫描（纯 metadataCache，同步）
 *  - review   review.json（reviewApp.dataManager.loadItems，需先 reviewApp.ensure(app)）
 *  - pomodoro pomodoro.json（new PomodoroDataManager(app).load()）
 *  - favorites favs.json（favorites DataManager 构造参数 = 完整文件路径）
 *  - news     news.json（readNewsData）
 *  - quiz     quiz.json（loadQuiz(app)）
 *  - library  书库目录扫描（getBookItems(app)，settings 键 libraryFolderPath/bookTag）
 *  - belongings belongings.json（loadDatabase，需 setSettingsProvider 注入）
 *  - clipping 目录 children md 计数（最轻；该域无导出读取函数）
 *  - attach/encrypt/smartcat/settings：无持久化数字统计（徽标留空）
 */
import type { App, TFile } from 'obsidian';
import { getApp } from '../core/app';
import { tryGetSettings } from '../core/settings-provider';
import { DataManager as MemoDataManager } from '../memo/data';
import type { MemoItem } from '../memo/types';
import { getDueStatus } from '../memo/due';
import { reviewApp } from '../review/app';
import type { ReviewItem } from '../review/data';
import { PomodoroDataManager } from '../pomodoro/data';
import { todayCount } from '../pomodoro/stats';
import { DataManager as FavoritesDataManager } from '../favorites/data';
import { getStoragePath as favoritesStoragePath } from '../favorites/config';
import { readNewsData } from '../news/data';
import { QuizManager } from '../quiz/manager';
import { getBookItems } from '../library/items';
import { loadDatabase as loadBelongings } from '../belongings/data';
import { parseMovieFile } from '../cinema/data';
import { STATUS_WANT, STATUS_WATCHING } from '../cinema/constants';

/** 首页无需统计的域（纯工具/无持久化数据） */
export const NO_STAT_DOMAINS: ReadonlySet<string> = new Set(['attach', 'encrypt', 'smartcat', 'settings']);

export interface DomainStat {
  /** 徽标主文案（如「3 条待办」；无数字统计为 ''） */
  text: string;
  /** 徽标高亮（数值>0 或「进行中/已写」等醒目态） */
  hl: boolean;
  /** 辅助文本（运行中的番茄剩余时间、今日已写等；无则 ''） */
  sub: string;
}

const EMPTY: DomainStat = { text: '', hl: false, sub: '' };

export interface HomeSnapshot {
  byDomain: Record<string, DomainStat>;
  ok: boolean;
}

function p2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${p2(m)}:${p2(s)}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** 设置里目录键 → 字符串目录（未注入/空 → 默认目录） */
function settingDir(keys: string[], def: string): string {
  const s = tryGetSettings() as Record<string, unknown>;
  for (const k of keys) {
    const v = s[k];
    if (typeof v === 'string' && v.trim()) return v.trim().replace(/\/+$/, '');
  }
  return def;
}

/** 目录下的 md 文件数（目录不存在返回 -1 让调用方回落默认） */
function countMdInDir(app: App, dir: string): number {
  try {
    const f = app.vault.getAbstractFileByPath(dir);
    if (!f || !('children' in f)) return -1;
    const children = (f as { children: unknown[] }).children;
    if (!Array.isArray(children)) return -1;
    return children.filter((c: unknown) => !!c && (c as { extension?: string }).extension === 'md').length;
  } catch {
    return -1;
  }
}

/** 路径上文件是否存在 */
function fileExists(app: App, path: string): boolean {
  try {
    return !!app.vault.getAbstractFileByPath(path);
  } catch {
    return false;
  }
}

const DAY_MS = 86400000;
const R_DEFAULT = 0.9;

/** 复习到期口径（review/app.ts 同款：逾期或 R 提前逾期的未完成非缺失条目） */
function overdueCount(items: ReviewItem[], now: number): number {
  const s = tryGetSettings() as Record<string, unknown>;
  const threshold = typeof s.reviewRThreshold === 'number' && s.reviewRThreshold > 0 ? (s.reviewRThreshold as number) : R_DEFAULT;
  return items.filter((i) => {
    if (i.completed || i.isMissing) return false;
    if (i.isOverdue) return true;
    if (i.phase === 'fsrs' && typeof i.stability === 'number' && i.lastReviewed) {
      const t = i.nextReviewDate ? new Date(i.nextReviewDate).getTime() : NaN;
      const dueDays = Number.isFinite(t) ? Math.max(0, (t - now) / DAY_MS) : 0;
      // 简化 R 估算（仅供「提前逾期」展示口径；与 review 域 loadItems isOverdue 逻辑对齐）
      const r = Math.exp(-dueDays / 30);
      return r < threshold;
    }
    return false;
  }).length;
}

/** 今日到期数（nextReviewDate 落在今天） */
function todayDue(items: ReviewItem[], now: number): number {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const end = start + DAY_MS;
  return items.filter((i) => {
    if (i.completed || i.isMissing) return false;
    if (!i.nextReviewDate) return false;
    const t = new Date(i.nextReviewDate).getTime();
    return Number.isFinite(t) && t >= start && t < end;
  }).length;
}

/** 当前剩余秒（运行中按 endTime 实时算；否则 remaining） */
function pomLeftSec(state: { endTime: number | null; remaining: number }, now: number): number {
  if (typeof state.endTime === 'number' && state.endTime !== null) {
    return Math.max(0, Math.ceil((state.endTime - now) / 1000));
  }
  return Math.max(0, state.remaining);
}

/** 聚合快照（注入 app 用显式参数；纯读取，不触发任何 ensure/轮询） */
export async function collectHomeSnapshot(app?: App): Promise<HomeSnapshot> {
  const a = app ?? getApp();
  const now = Date.now();
  const out: Record<string, DomainStat> = {};

  // ---- diary：目录 md 数 + 今日已写 ----
  try {
    const dir = settingDir(['diaryDirectory'], '我的/日记');
    const n = countMdInDir(a, dir);
    const written = fileExists(a, `${dir}/${todayStr()}.md`);
    out.diary =
      n <= 0 ? EMPTY : written ? { text: `${n} 篇`, hl: false, sub: '今日已写' } : { text: `${n} 篇`, hl: false, sub: '' };
  } catch {
    out.diary = EMPTY;
  }

  // ---- memo：未完成待办 + 到期 ----
  try {
    const items = await MemoDataManager.loadItems();
    const active = (Array.isArray(items) ? items : []).filter((i: MemoItem) => !i.completed);
    if (!active.length) {
      out.memo = EMPTY;
    } else {
      let due = 0;
      for (const it of active) {
        const st = it.due ? getDueStatus(it.due) : null;
        if (st === 'overdue' || st === 'today') due++;
      }
      out.memo = { text: `${active.length} 条待办`, hl: active.length > 0, sub: due ? `到期 ${due}` : '' };
    }
  } catch {
    out.memo = EMPTY;
  }

  // ---- cinema：folderPath 前缀扫描（同步） ----
  try {
    const folder = settingDir(['cinemaFolderPath'], '我的/影视');
    const files = a.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folder + '/'));
    let want = 0;
    let watching = 0;
    for (const f of files) {
      const item = parseMovieFile(f, a);
      if (!item) continue;
      if (item.status === STATUS_WANT) want++;
      else if (item.status === STATUS_WATCHING) watching++;
    }
    out.cinema =
      want || watching ? { text: `想看 ${want} · 在看 ${watching}`, hl: want > 0, sub: '' } : EMPTY;
  } catch {
    out.cinema = EMPTY;
  }

  // ---- review：reviewApp.ensure + loadItems（jsonFileStore 无 app 注入走模块级 getApp） ----
  try {
    reviewApp.ensure(a);
    const items = (await reviewApp.dataManager!.loadItems()) as ReviewItem[];
    const ov = overdueCount(items, now);
    const td = todayDue(items, now);
    out.review = ov ? { text: `${ov} 张到期`, hl: ov > 0, sub: td ? `今日 ${td}` : '' } : EMPTY;
  } catch {
    out.review = EMPTY;
  }

  // ---- pomodoro：今日完成 + 运行中剩余 ----
  try {
    const data = await new PomodoroDataManager(a).load();
    const st = data?.state ?? null;
    const running = !!st && typeof st.endTime === 'number' && st.endTime !== null;
    const done = st ? todayCount(data.history, now) : 0;
    const sub = running && st ? `剩 ${fmtClock(pomLeftSec(st, now))}` : '';
    out.pomodoro = done || running ? { text: `今日 ${done} 轮`, hl: running, sub } : EMPTY;
  } catch {
    out.pomodoro = EMPTY;
  }

  // ---- favorites：条数（排除归档） ----
  try {
    const dir = settingDir(['favoritesStoragePath'], 'CONFIG/STORAGE');
    const dm = new FavoritesDataManager(favoritesStoragePath(dir));
    const all = await dm.getAll();
    const n = (Array.isArray(all) ? all : []).filter((i) => !(i as { archived?: boolean }).archived).length;
    out.favorites = n ? { text: `${n} 条收藏`, hl: n > 0, sub: '' } : EMPTY;
  } catch {
    out.favorites = EMPTY;
  }

  // ---- news：已读计数 ----
  try {
    const r = await readNewsData();
    const read = Number(r.data?.stats?.totalRead ?? 0);
    out.news = read > 0 ? { text: `已读 ${read}`, hl: false, sub: '' } : EMPTY;
  } catch {
    out.news = EMPTY;
  }

  // ---- quiz：题目总数 ----
  try {
    const quiz = await new QuizManager().loadQuiz(a);
    const notes = (quiz as { notes?: Record<string, unknown[]> }).notes ?? {};
    let total = 0;
    for (const qs of Object.values(notes)) total += Array.isArray(qs) ? qs.length : 0;
    out.quiz = total ? { text: `${total} 题`, hl: false, sub: '' } : EMPTY;
  } catch {
    out.quiz = EMPTY;
  }

  // ---- library：在读本数 ----
  try {
    const books = getBookItems(a);
    const reading = (Array.isArray(books) ? books : []).filter((b) => (b as { status?: string }).status === '在读').length;
    out.library = reading ? { text: `在读 ${reading}`, hl: reading > 0, sub: '' } : EMPTY;
  } catch {
    out.library = EMPTY;
  }

  // ---- belongings：物品总数 ----
  try {
    const db = await loadBelongings();
    const items = (db as { items?: Record<string, unknown> }).items ?? {};
    const n = Object.keys(items).length;
    out.belongings = n ? { text: `${n} 件`, hl: false, sub: '' } : EMPTY;
  } catch {
    out.belongings = EMPTY;
  }

  // ---- clipping：目录 children md 计数（最轻路径） ----
  try {
    const dir = settingDir(['articleDirectory'], '归档/网页剪藏');
    const n = countMdInDir(a, dir);
    out.clipping = n > 0 ? { text: `${n} 篇`, hl: false, sub: '' } : EMPTY;
  } catch {
    out.clipping = EMPTY;
  }

  // ---- 无统计域：空 ----
  for (const id of NO_STAT_DOMAINS) out[id] = EMPTY;

  return { byDomain: out, ok: true };
}
