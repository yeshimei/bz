/**
 * 内容首页（home 域）跨域统计快照：为每张域卡读取真实数据。
 *
 * 只读契约（重点）：
 *  - 不调任何带 DOM/轮询/通知副作用的 ensure/open；
 *  - json 数据文件（memo/review/favorites/pomodoro/quiz/belongings/news）一律
 *    **先探测文件是否存在，不存在直接回落空徽标**——统一读写层 jsonFileStore 的
 *    read 缺省会自动建默认文件，首页只是快照，不得制造写盘副作用；
 *  - memo 不依赖 DataManager 单例（其 _store 需 memo 域 init 才可用），改直读
 *    core/storage 的 jsonFileStore（文件存在才读）；
 *  - 目录（日记/影院/剪藏/书库）不存在 → null → 回落默认，不建目录。
 *
 * 数据源逐域口径：
 *  - diary    目录 children md 数 + 今日已写（文件名 = 日期）
 *  - memo     memo.json 未完成条数（completed === null）+ 到期（overdue/today）
 *  - cinema   cinemaFolderPath 前缀扫描 frontmatter（评分 -1/0/正 → 想看/在看/已看）
 *  - review   review.json 经 reviewApp.dataManager.loadItems（isOverdue/isMissing
 *             运行时字段由该域判定），徽标 = isOverdue 未完成非缺失条目数
 *  - pomodoro pomodoro.json（new PomodoroDataManager(app).load()）
 *  - favorites favorites.json（排除 archived）
 *  - news     news.json（readNewsData，缺失本身不建文件）
 *  - quiz     quiz.json 题目总数（loadQuiz(app)）
 *  - bookshelf 书库目录扫描（bookshelf scanMarkdownBooks(app) 在读本数；旧 library 域退役后换线）
 *  - belongings belongings.json（loadDatabase 物品总数）
 *  - clipping 目录 children md 计数（最轻）
 *  - attach/encrypt/smartcat/settings/wall/vault：无持久化数字统计（徽标留空）
 */
import type { App, TFile } from 'obsidian';
import { getApp } from '../core/app';
import { tryGetSettings } from '../core/settings-provider';
import { jsonFileStore, storageFile } from '../core/storage';
import { reviewApp } from '../review/app';
import type { ReviewItem } from '../review/data';
import { PomodoroDataManager } from '../pomodoro/data';
import { todayCount } from '../pomodoro/stats';
import { DataManager as FavoritesDataManager } from '../favorites/data';
import { getStoragePath as favoritesStoragePath } from '../favorites/config';
import { scanMarkdownBooks } from '../bookshelf/data';
import { QuizManager } from '../review/quiz-core/manager';
import { loadDatabase as loadBelongings } from '../belongings/data';
import { parseMovieFile } from '../cinema/data';
import { STATUS_WANT, STATUS_WATCHING } from '../cinema/constants';

/** 首页不出统计徽标的域：纯工具/无持久化数据（attach/encrypt/smartcat/settings/wall）
 *  + 有数据但暂未接快照口径的内容域（literature 文献盒 / reading-report 阅读报告，
 *    本轮只补曝光位，徽标留空不挡「各域一览」副题文案） */
export const NO_STAT_DOMAINS: ReadonlySet<string> = new Set([
  'attach', 'encrypt', 'smartcat', 'settings', 'wall',
  'literature', 'reading-report',
]);

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

/** 路径上文件是否存在（vault 内） */
function fileExists(app: App, path: string): boolean {
  try {
    return !!app.vault.getAbstractFileByPath(path);
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

const DAY_MS = 86400000;

/** memo 到期数（completed === null 条目中 due 为 overdue/today 的） */
function dueActiveCount(items: Array<{ completed: string | null; due: string | null }>): number {
  let n = 0;
  for (const it of items) {
    if (it.completed || !it.due) continue;
    const d = new Date(it.due.replace(/-/g, '/'));
    const t = d.getTime();
    if (Number.isNaN(t)) continue;
    const now = Date.now();
    if (t < now) n++; // 已过期
    else {
      const dd = new Date(now);
      const start = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate()).getTime();
      if (t < start + DAY_MS) n++; // 今天
    }
  }
  return n;
}

/** 复习到期口径：loadItems 已算 isOverdue/isMissing（review/app.ts 同源），仅过滤展示 */
function overdueCount(items: ReviewItem[]): number {
  return items.filter((i) => i.isOverdue && !i.completed && !i.isMissing).length;
}

/** 今日到期数（nextReviewDate 落在今天；未完成非缺失） */
function todayDue(items: ReviewItem[], now: number): number {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const end = start + DAY_MS;
  return items.filter((i) => {
    if (i.completed || i.isMissing || !i.nextReviewDate) return false;
    const t = new Date(i.nextReviewDate).getTime();
    return Number.isFinite(t) && t >= start && t < end;
  }).length;
}

/** 聚合快照（注入 app 用显式参数；纯读取，不触发任何 ensure/轮询/写盘） */
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

  // ---- memo：直读 memo.json（不依赖 DataManager 单例初始化；文件缺失回落空） ----
  try {
    const filePath = storageFile('memo.json');
    const raw = await readJsonIfExists(a, filePath);
    const all = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
    const active = all.filter((i) => i.completed === null || i.completed === undefined);
    if (!active.length) {
      out.memo = EMPTY;
    } else {
      const due = dueActiveCount(active as Array<{ completed: string | null; due: string | null }>);
      out.memo = { text: `${active.length} 条待办`, hl: active.length > 0, sub: due ? `到期 ${due}` : '' };
    }
  } catch {
    out.memo = EMPTY;
  }

  // ---- cinema：folderPath 前缀扫描（同步，纯 metadataCache） ----
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

  // ---- review：reviewApp.ensure + loadItems（loadItems 由该域判 isOverdue/isMissing；
  //      文件缺失 loadItems 返回 []，不建文件——jsonFileStore 缺失自动建，须先探测） ----
  try {
    const filePath = storageFile('review.json');
    if (!fileExists(a, filePath)) {
      out.review = EMPTY;
    } else {
      reviewApp.ensure(a);
      const items = (await reviewApp.dataManager!.loadItems()) as ReviewItem[];
      const ov = overdueCount(items);
      const td = todayDue(items, now);
      out.review = ov ? { text: `${ov} 张到期`, hl: ov > 0, sub: td ? `今日 ${td}` : '' } : EMPTY;
    }
  } catch {
    out.review = EMPTY;
  }

  // ---- pomodoro：今日完成 + 运行中剩余（文件缺失回落空，不建文件） ----
  try {
    const filePath = storageFile('pomodoro.json');
    if (!fileExists(a, filePath)) {
      out.pomodoro = EMPTY;
    } else {
      const data = await new PomodoroDataManager(a).load();
      const st = data?.state ?? null;
      const running = !!st && typeof st.endTime === 'number' && st.endTime !== null;
      const done = st ? todayCount(data.history, now) : 0;
      let sub = '';
      if (running && st) {
        const left = st.endTime !== null ? Math.max(0, Math.ceil((st.endTime - now) / 1000)) : 0;
        sub = `剩 ${fmtClock(left)}`;
      }
      out.pomodoro = done || running ? { text: `今日 ${done} 轮`, hl: running, sub } : EMPTY;
    }
  } catch {
    out.pomodoro = EMPTY;
  }

  // ---- favorites：条数（排除归档；文件缺失回落空） ----
  try {
    const dir = settingDir(['favoritesStoragePath'], 'CONFIG/STORAGE');
    const filePath = favoritesStoragePath(dir);
    if (!fileExists(a, filePath)) {
      out.favorites = EMPTY;
    } else {
      const dm = new FavoritesDataManager(filePath);
      const all = await dm.getAll();
      const n = (Array.isArray(all) ? all : []).filter((i) => !(i as { archived?: boolean }).archived).length;
      out.favorites = n ? { text: `${n} 条收藏`, hl: n > 0, sub: '' } : EMPTY;
    }
  } catch {
    out.favorites = EMPTY;
  }

  // ---- quiz：题目总数（文件缺失回落空，不建文件） ----
  try {
    const filePath = storageFile('quiz.json');
    if (!fileExists(a, filePath)) {
      out.quiz = EMPTY;
    } else {
      const quiz = await new QuizManager().loadQuiz(a);
      const notes = (quiz as { notes?: Record<string, unknown[]> }).notes ?? {};
      let total = 0;
      for (const qs of Object.values(notes)) total += Array.isArray(qs) ? qs.length : 0;
      out.quiz = total ? { text: `${total} 题`, hl: false, sub: '' } : EMPTY;
    }
  } catch {
    out.quiz = EMPTY;
  }

  // ---- bookshelf：在读本数（书库目录扫描；口径同 bookshelf 域——readingDate && !completionDate 为在读） ----
  try {
    const books = scanMarkdownBooks(a);
    const reading = (Array.isArray(books) ? books : []).filter((b) => b.status === '在读').length;
    out.bookshelf = reading ? { text: `在读 ${reading}`, hl: reading > 0, sub: '' } : EMPTY;
  } catch {
    out.bookshelf = EMPTY;
  }

  // ---- belongings：物品总数（文件缺失回落空，不建文件） ----
  try {
    const filePath = storageFile('belongings.json');
    if (!fileExists(a, filePath)) {
      out.belongings = EMPTY;
    } else {
      const db = await loadBelongings();
      const items = (db as { items?: Record<string, unknown> }).items ?? {};
      const n = Object.keys(items).length;
      out.belongings = n ? { text: `${n} 件`, hl: false, sub: '' } : EMPTY;
    }
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
