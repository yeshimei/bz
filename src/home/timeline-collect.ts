/* ============================================================
 * bz · 首页时间线采集（home/timeline-collect.ts）
 *
 * 存在的理由：时间线原来读小橘行为流（smartcat-behavior.json），只有埋过点的动作才出现，
 * 而且埋点本身就是「谁记得加就算谁」。改成直接从各域**自己的数据文件**算事件之后，
 * 能不能进时间线只取决于一件事：这条数据里有没有可信的时间。
 *
 * 只读契约（与 river.ts 同一套，别破）：
 *  - json 一律先探测存在再读，缺失回落空——**不能**触发 jsonFileStore 自动建文件；
 *  - 目录缺失不建目录；不调任何带 DOM / 轮询 / 通知副作用的 ensure/open；
 *  - 每个域独立 try/catch，一个域炸了不拖垮整条时间线。
 *
 * 不进时间线的域（数据里根本没有可信时间，别费劲）：
 *  - 密码本（条目无创建时间）、第二大脑（chatHistory 无时间戳）、自动摘要、
 *    附件搬移（纯计算层，无持久化）、阅读报告 / 数据体检 / 设置 / 首页本身；
 *  - 保险库（`.safe.enc` 是密文清单，不输主密码读不出 createdAt）；
 *  - 工具坞（runs.jsonl 是按工具分散的外部文件，收益低、扫描成本高）。
 * ============================================================ */
import type { App, TFile } from 'obsidian';
import { storageFile } from '../core/storage';
import { localDayKey } from '../core/utils';
import { pad2 } from '../core/ui/str';
import { settingDir, fileIfExists, readJsonIfExists } from '../recap/aggregate';
import { diaryMetaFromEntryPath } from '../core/diary-format';
import { achRowFromText } from '../gameshelf/steam';
import { COPY, clip } from './timeline-copy';
import type { RiverEvent } from './shared';

const DAY_MS = 86400000;

/** 采集窗口：now 毫秒 + 天数（含今天，往回 days-1 天）+ 现成的 md 文件表（避免再扫一遍库） */
export interface TimelineWindow {
  now: number;
  days: number;
  mdFiles?: TFile[];
}

/** 时间线事件（kind 必填：采集时已定死，渲染层不再靠文案前缀猜类别） */
export type TimelineEvent = RiverEvent & { kind: NonNullable<RiverEvent['kind']> };

/* ---------- 时间工具 ---------- */

/** 本地当天 00:00 的毫秒 */
export function dayStartOf(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 时间标签 'HH:mm' */
export function toTimeLabel(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * 把各种落盘形态归一成毫秒；拿不准一律 null（宁缺勿假）。
 * 支持：数字毫秒、'YYYY-MM-DD'、'YYYY-MM-DD HH:mm(:ss)'、ISO 串。
 * 注意「只有日期」按**本地 00:00** 落，与前端展示口径一致。
 */
export function parseWhen(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    // 秒级时间戳（Steam unlocktime 那种）也兼容一下
    return value < 1e11 ? value * 1000 : value;
  }
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dayOnly) {
    return new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3])).getTime();
  }
  const local = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (local) {
    return new Date(
      Number(local[1]), Number(local[2]) - 1, Number(local[3]),
      Number(local[4]), Number(local[5]), Number(local[6] ?? 0),
    ).getTime();
  }
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 两个时间点之间的整天数（向下取整，最小 0） */
function daysBetween(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return Math.floor((dayStartOf(to) - dayStartOf(from)) / DAY_MS);
}

/* ---------- 采集上下文 ---------- */

interface Ctx {
  app: App;
  /** 窗口起点（最早那天 00:00） */
  since: number;
  now: number;
  mdFiles: TFile[];
  out: TimelineEvent[];
}

function push(ctx: Ctx, seed: Omit<TimelineEvent, 'timeLabel'>): void {
  if (!Number.isFinite(seed.ts) || seed.ts < ctx.since || seed.ts > ctx.now + DAY_MS) return;
  ctx.out.push({ ...seed, timeLabel: toTimeLabel(seed.ts) });
}

/** 取 JSON 里的条目数组：不同域的外壳键不一样（items / tasks / list），按序兜底 */
function pickArray(json: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === 'object') {
    for (const k of keys) {
      const v = (json as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
      if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>) as Record<string, unknown>[];
    }
  }
  return [];
}

async function readStorageJson(app: App, fileName: string): Promise<unknown> {
  const path = storageFile(fileName);
  if (!fileIfExists(app, path)) return undefined;
  try {
    return await readJsonIfExists(app, path);
  } catch {
    return undefined; // 坏 JSON：当没有，不制造半条时间线
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** 正文字数（去掉 frontmatter 与空白） */
function bodyChars(raw: string): number {
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  return [...body.replace(/\s+/g, '')].length;
}

/** 从 frontmatter 里取一个字符串字段（轻量正则，不引 YAML 解析器） */
function fmValue(raw: string, key: string): string {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(raw.slice(0, 4000));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

/* ---------- 各域采集 ---------- */

/** 日记本：写日记（文件名即时刻）+ 写信（frontmatter date） */
async function collectDiary(ctx: Ctx): Promise<void> {
  const diaryDir = settingDir(['diaryDirectory'], '');
  const prefix = diaryDir + '/';
  for (const f of ctx.mdFiles) {
    if (!f.path.startsWith(prefix) || f.path.slice(prefix.length).includes('/')) continue;
    const meta = diaryMetaFromEntryPath(f.path);
    if (!meta) continue;
    const [y, m, d] = meta.date.split('-').map(Number);
    const [hh, mm] = meta.time.split(':').map(Number);
    const ts = new Date(y, m - 1, d, hh, mm).getTime();
    if (ts < ctx.since) continue;
    let kind = '日记';
    let chars = 0;
    try {
      const raw = await ctx.app.vault.cachedRead(f);
      kind = fmValue(raw, 'category') || '日记';
      chars = bodyChars(raw);
    } catch {
      /* 读不到就只报「写了一段日记」 */
    }
    push(ctx, { domain: 'diary', ts, text: COPY.diary(kind, chars), kind: 'produce' });
  }

  const letterDir = settingDir(['letterDirectory'], '');
  const letterPrefix = letterDir + '/';
  for (const f of ctx.mdFiles) {
    if (!f.path.startsWith(letterPrefix)) continue;
    let raw = '';
    try {
      raw = await ctx.app.vault.cachedRead(f);
    } catch {
      continue;
    }
    const ts = parseWhen(fmValue(raw, 'date'));
    if (ts === null || ts < ctx.since) continue;
    push(ctx, { domain: 'diary', ts, text: COPY.letter(f.basename), kind: 'produce' });
  }
}

/** 备忘录：新增（created）+ 完成（completed，带「挂了几天」） */
async function collectMemo(ctx: Ctx): Promise<void> {
  const json = await readStorageJson(ctx.app, 'memo.json');
  for (const it of pickArray(json, ['items', 'list'])) {
    const title = clip(str(it.title), 16) || '一条备忘';
    const created = parseWhen(it.created);
    if (created !== null) {
      const due = str(it.due);
      push(ctx, {
        domain: 'memo',
        ts: created,
        text: COPY.memoAdd(title, due ? due.slice(0, 10) : ''),
        kind: 'progress',
      });
    }
    const done = parseWhen(it.completed);
    if (done !== null && created !== null) {
      push(ctx, { domain: 'memo', ts: done, text: COPY.memoDone(title, daysBetween(created, done)), kind: 'produce' });
    }
  }
}

/** 归物本：登记（created_date）+ 闲置 / 离场（status_at、exit_date） */
async function collectBelongings(ctx: Ctx): Promise<void> {
  const json = await readStorageJson(ctx.app, 'belongings.json');
  const items = json && typeof json === 'object'
    ? Object.values(((json as Record<string, unknown>).items ?? {}) as Record<string, Record<string, unknown>>)
    : [];
  for (const it of items) {
    const name = clip(str(it.name), 16);
    if (!name) continue;
    const status = str(it.current_status);

    const created = parseWhen(it.created_date);
    if (created !== null) {
      push(ctx, { domain: 'belongings', ts: created, text: COPY.belongingsAdded(name, it.purchase_price), kind: 'produce' });
    }

    const statusAt = parseWhen(it.status_at) ?? parseWhen(it.exit_date);
    if (statusAt === null) continue;
    if (status === '闲置') {
      push(ctx, { domain: 'belongings', ts: statusAt, text: COPY.belongingsIdle(name), kind: 'progress' });
    } else if (status === '已转卖') {
      push(ctx, { domain: 'belongings', ts: statusAt, text: COPY.belongingsSold(name, it.sold_price), kind: 'note' });
    } else if (status === '已丢弃') {
      push(ctx, { domain: 'belongings', ts: statusAt, text: COPY.belongingsDiscard(name), kind: 'note' });
    }
  }
}

/** 影院：想看 / 在看 / 已看 / 影评 / 重温（五项都从同一篇笔记的 frontmatter 拆） */
async function collectCinema(ctx: Ctx): Promise<void> {
  const folder = settingDir(['cinemaFolderPath'], '');
  const prefix = folder + '/';
  for (const f of ctx.mdFiles) {
    if (!f.path.startsWith(prefix)) continue;
    let raw = '';
    try {
      raw = await ctx.app.vault.cachedRead(f);
    } catch {
      continue;
    }
    const title = clip(f.basename, 20);
    const ratingRaw = fmValue(raw, '评分');
    const rating = Number(ratingRaw);
    const ratingValue = Number.isFinite(rating) && rating > 0 ? Math.round(rating * 10) / 10 : null;

    const want = parseWhen(fmValue(raw, '想看日期'));
    if (want !== null) push(ctx, { domain: 'cinema', ts: want, text: COPY.cinemaWant(title), kind: 'progress' });

    const watching = parseWhen(fmValue(raw, '在看日期'));
    if (watching !== null) push(ctx, { domain: 'cinema', ts: watching, text: COPY.cinemaWatching(title), kind: 'progress' });

    const watched = parseWhen(fmValue(raw, '已看日期'));
    if (watched !== null) {
      push(ctx, { domain: 'cinema', ts: watched, text: COPY.cinemaWatched(title, ratingValue), kind: 'produce' });
      const review = fmValue(raw, '影评');
      if (review) {
        push(ctx, { domain: 'cinema', ts: watched + 1000, text: COPY.cinemaReview(title, clip(review, 16)), kind: 'note' });
      }
    }

    // 重温：frontmatter 里是一行行 `at|rating`，只取窗口内的
    const rewatchLines = /^重映:[ \t]*\n((?:[ \t]*-.*\n)+)/m.exec(raw);
    if (rewatchLines) {
      const stamps = [...rewatchLines[1].matchAll(/(\d{4}-\d{2}-\d{2}[ T][\d:]{5,8})/g)].map((m) => parseWhen(m[1]));
      const valid = stamps.filter((x): x is number => x !== null && x >= ctx.since);
      valid.forEach((ts, i) => push(ctx, { domain: 'cinema', ts, text: COPY.cinemaRewatch(title, i + 1), kind: 'produce' }));
    }
  }
}

/** 书库：开始读 / 读完（EPUB 与 md 书同一口径，只到日期） */
async function collectBookshelf(ctx: Ctx): Promise<void> {
  const mod = await import('../bookshelf/data');
  const items = await mod.rebuildItems(ctx.app);
  for (const it of items as unknown as Array<Record<string, unknown>>) {
    const title = clip(str(it.title), 20);
    if (!title) continue;
    // 优先用 EPUB 的精确时刻（readingAt / completedAt）；md 书只有日期，回落
    const start = parseWhen(it.readingAt) ?? parseWhen(it.readingDate);
    const done = parseWhen(it.completedAt) ?? parseWhen(it.completionDate);
    if (start !== null) push(ctx, { domain: 'bookshelf', ts: start, text: COPY.bookStart(title), kind: 'progress' });
    if (done !== null) {
      push(ctx, { domain: 'bookshelf', ts: done, text: COPY.bookDone(title, start !== null ? daysBetween(start, done) : null), kind: 'produce' });
    }
  }
}

/** 游戏库：最后游玩 + 成就解锁（成就日期在 frontmatter 的 `成就` 行里） */
async function collectGameshelf(ctx: Ctx): Promise<void> {
  const mod = await import('../gameshelf/notes');
  const items = mod.rebuildItems(ctx.app) as unknown as Array<Record<string, unknown>>;
  for (const it of items) {
    const game = clip(str(it.name), 16);
    if (!game) continue;
    const played = parseWhen(it.lastPlayed);
    if (played !== null) {
      const minutes = Number(it.playtimeMin) || 0;
      const hours = minutes > 0 ? Math.round((minutes / 60) * 10) / 10 : null;
      push(ctx, { domain: 'gameshelf', ts: played, text: COPY.gamePlayed(game, hours), kind: 'progress' });
    }
    if (it.hasAch !== true || !it.file) continue;
    let raw = '';
    try {
      raw = await ctx.app.vault.cachedRead(it.file as TFile);
    } catch {
      continue;
    }
    const block = /^成就:[ \t]*\n((?:[ \t]*-.*\n)+)/m.exec(raw);
    if (!block) continue;
    for (const line of block[1].split('\n')) {
      const row = achRowFromText(line.replace(/^[ \t]*-[ \t]*/, '').replace(/^["']|["']$/g, ''));
      if (!row || !row.unlocked) continue;
      const ts = parseWhen(row.date);
      if (ts === null) continue;
      const percent = typeof row.percent === 'number' && Number.isFinite(row.percent) ? Number(row.percent.toFixed(1)) : null;
      push(ctx, { domain: 'gameshelf', ts, text: COPY.gameAchievement(clip(row.name, 16), game, percent), kind: 'produce' });
    }
  }
}

/** 剪藏本：保存成剪藏笔记 */
async function collectClipbook(ctx: Ctx): Promise<void> {
  const json = await readStorageJson(ctx.app, 'clipbook.json');
  for (const it of pickArray(json, ['items', 'clips'])) {
    const ts = parseWhen(it.created);
    if (ts === null) continue;
    const title = clip(str(it.title) || str(it.url), 20);
    if (!title) continue;
    push(ctx, { domain: 'clipping', ts, text: COPY.clipSaved(title), kind: 'produce' });
  }
}

/** 收藏本：收藏 + 归档 */
async function collectFavorites(ctx: Ctx): Promise<void> {
  const json = await readStorageJson(ctx.app, 'favorites.json');
  for (const it of pickArray(json, ['items'])) {
    const title = clip(str(it.title), 16) || clip(str(it.url), 16);
    if (!title) continue;
    const created = parseWhen(it.created);
    if (created !== null) {
      push(ctx, { domain: 'favorites', ts: created, text: COPY.favSaved(title, clip(str(it.description), 12)), kind: 'produce' });
    }
    const archived = parseWhen(it.archivedAt);
    if (archived !== null) push(ctx, { domain: 'favorites', ts: archived, text: COPY.favArchived(title), kind: 'note' });
  }
}

/** 知识盒：新增任务（按类型分文案）+ 处理完成 */
async function collectKnowledge(ctx: Ctx): Promise<void> {
  const json = await readStorageJson(ctx.app, 'knowledge.json');
  for (const it of pickArray(json, ['tasks', 'items'])) {
    const title = clip(str(it.title) || str(it.url), 20);
    if (!title) continue;
    const created = parseWhen(it.created);
    if (created !== null) {
      const kind = str(it.kind) || str(it.type);
      const text =
        kind === 'passage' ? COPY.knowledgePassage(title)
          : kind === 'image' ? COPY.knowledgeImage(title)
            : kind === 'video' ? COPY.knowledgeVideo(title)
              : COPY.knowledgeTerm(title);
      push(ctx, { domain: 'knowledge', ts: created, text, kind: 'produce' });
    }
    const processed = parseWhen(it.processedAt);
    if (processed !== null) push(ctx, { domain: 'knowledge', ts: processed, text: COPY.knowledgeDone(title), kind: 'produce' });
  }
}

/** 复习计划：加入 + 当天复习汇总（一轮三十条不能一行一条） */
async function collectReview(ctx: Ctx): Promise<void> {
  const json = await readStorageJson(ctx.app, 'review.json');
  const items = pickArray(json, ['items']);
  const perDay = new Map<string, { ts: number; count: number }>();
  for (const it of items) {
    const added = parseWhen(it.reviewStart);
    if (added !== null) {
      const name = clip(str(it.title) || str(it.filePath).split('/').pop()?.replace(/\.md$/, '') || '', 18);
      if (name) push(ctx, { domain: 'review', ts: added, text: COPY.reviewAdded(name), kind: 'progress' });
    }
    const done = parseWhen(it.lastReviewed);
    if (done === null) continue;
    const key = localDayKey(done);
    const cur = perDay.get(key);
    if (cur) cur.count += 1;
    else perDay.set(key, { ts: done, count: 1 });
  }
  for (const { ts, count } of perDay.values()) {
    push(ctx, { domain: 'review', ts, text: COPY.reviewRound(count), kind: 'produce' });
  }
}

/** 番茄钟：每完成一轮一条 */
async function collectPomodoro(ctx: Ctx): Promise<void> {
  const json = await readStorageJson(ctx.app, 'pomodoro.json');
  const history = pickArray(json && typeof json === 'object' ? (json as Record<string, unknown>).history : undefined, []);
  for (const it of history) {
    const ts = parseWhen(it.ts);
    if (ts === null) continue;
    const minutes = Math.round((Number(it.duration) || 0) / 60000) || 25;
    push(ctx, { domain: 'pomodoro', ts, text: COPY.pomodoro(minutes, clip(str(it.task), 12)), kind: 'produce' });
  }
}

/** 脸谱：新建联系人 + 随手记 */
async function collectPeople(ctx: Ctx): Promise<void> {
  const json = await readStorageJson(ctx.app, 'people.json');
  for (const person of pickArray(json, ['people', 'entries', 'items'])) {
    const name = clip(str(person.name), 12);
    if (!name) continue;
    const created = parseWhen(person.createdAt);
    if (created !== null) push(ctx, { domain: 'people', ts: created, text: COPY.peopleAdded(name), kind: 'produce' });
    const events = Array.isArray(person.events) ? (person.events as Record<string, unknown>[]) : [];
    for (const ev of events) {
      const ts = parseWhen(ev.createdAt) ?? parseWhen(ev.ts);
      if (ts === null) continue;
      push(ctx, { domain: 'people', ts, text: COPY.peopleNote(name, clip(str(ev.text) || str(ev.content), 12)), kind: 'note' });
    }
  }
}

/* ---------- 入口 ---------- */

/** 采集窗口内所有能进时间线的事件（全程只读；每个域独立容错） */
export async function collectTimelineEvents(app: App, win: TimelineWindow): Promise<TimelineEvent[]> {
  const days = Math.max(1, Math.min(31, Math.floor(win.days) || 1));
  let mdFiles: TFile[] = win.mdFiles ?? [];
  if (!mdFiles.length) {
    try {
      mdFiles = app.vault.getMarkdownFiles();
    } catch {
      mdFiles = [];
    }
  }
  const ctx: Ctx = {
    app,
    now: win.now,
    since: dayStartOf(win.now) - (days - 1) * DAY_MS,
    mdFiles,
    out: [],
  };

  const safe = (fn: (c: Ctx) => Promise<void>): Promise<void> =>
    fn(ctx).catch(() => undefined);

  await Promise.all([
    safe(collectDiary),
    safe(collectMemo),
    safe(collectBelongings),
    safe(collectCinema),
    safe(collectBookshelf),
    safe(collectGameshelf),
    safe(collectClipbook),
    safe(collectFavorites),
    safe(collectKnowledge),
    safe(collectReview),
    safe(collectPomodoro),
    safe(collectPeople),
  ]);

  return ctx.out;
}
