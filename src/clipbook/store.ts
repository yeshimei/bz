/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：状态机 + 阅读视图派生。
 * 纯数据层（无 DOM；持久化需 getApp 注入——由 index 初始化/UI 调用）。
 *
 * 语义（ADR-0082 §2/§3）：
 * - 内存含两个 article 面：newsJson（磁盘 news.json 文章的只读面，read=true 且
 *   state=saved/skipped 的骨架不出现在任何收件流）与剪藏目录面（scan）。
 * - 阅读流条目（ClipArticle）由 clipArticle 纯函数派生：st=saved 判定 = news
 *   侧 state==='saved' ∨ 侧写 savedArchive 命中 ∨ url 命中剪藏目录（保底「保存过
 *   就是剪藏」）；st=reading 落侧写 articleOverrides。
 * - 动作（save/unsave/read/skip/delete/clear-unread 等）写 news.json（read/state/
 *   body 清空/stats 计数，串行队列 + mergeWithDisk 双写者合并——迁移 news/reader.ts
 *   语义）与 clipbook.json 侧写。
 * - saveToClip 写剪藏笔记 + 发 news:read/saved 域事件（smartcat 行为流三跳依赖）。
 */
import { applyRetention } from '../news/data';
import type { ClipArticle, ClipOrigin, ClipState } from './types';
import { articleKeyOf, excerpt } from './constants';
import { readNewsData, writeNewsData } from '../news/data';
import { readClipbookData, writeClipbookData, type ClipbookData } from './data';

/** B站视频条目判定（ADR-0068：保存分流文献盒；url 异常缺失回退剪藏按钮） */
export const isBiliVideo = (a: any): boolean => a?.platform === 'B站' && !!String(a?.url || '').trim();

/** 展示站点名（news：平台；剪藏：frontmatter site） */
function siteName(a: any): string {
  return a.site ? String(a.site) : a.platform ? String(a.platform) : '未知';
}

/** UP 主展示名（后台回填名字则用之，否则回退 author/「UP」） */
function upName(a: any, info?: any): string {
  const uid = String((a && a.bvid) || (a && a.author) || '');
  const name = info && typeof info === 'object' ? info.name : null;
  return name || uid || '';
}

function platformOf(a: any): string {
  const p = a.platform || '';
  if (p === 'B站') return 'B站';
  if (p === '果壳' || p === '果壳科学人') return '果壳科学人';
  if (p === '知乎日报' || p === '知乎') return '知乎日报';
  return p || '未知';
}

function siteDomain(a: any): string {
  if (!a.url) return '';
  try {
    return new URL(String(a.url)).hostname;
  } catch (e) {
    return '';
  }
}

/** body 截断/清洗（列表摘要与右栏全文共用；news body 可能已清空） */
export function cleanBody(body: string): string {
  return String(body || '').trim();
}

/** 派生阅读视图条目（news 原文 a + 侧写/剪藏命中 → ClipArticle） */
export function clipArticle(
  a: any,
  opts: { overrides?: Record<string, { reading?: boolean }>; clipByUrl?: Set<string>; upInfo?: Record<string, any>; savedKeys?: Set<string> }
): ClipArticle {
  const overrides = opts.overrides || {};
  const clipByUrl = opts.clipByUrl || new Set<string>();
  const upInfo = opts.upInfo || {};
  const savedKeys = opts.savedKeys || new Set<string>();

  const key = articleKeyOf(a);
  const ov = overrides[key];
  const platform = platformOf(a);

  // saved 判定：news 侧 state==='saved' ∨ 侧写归档 ∨ url 命中剪藏目录
  const newsSaved = a.state === 'saved';
  const archived = savedKeys.has(String(a.url || ''));
  const clipped = !!a.url && clipByUrl.has(String(a.url));
  const saved = newsSaved || archived || clipped;
  const reading = !!ov && ov.reading === true;

  const title = String(a.title || '(无标题)');
  const body = cleanBody(a.body);
  const isBili = platform === 'B站';
  const feedUp = isBili ? String(a.author || '') : '';
  const srcName = feedUp || platform;
  const typeLabel = feedUp ? 'UP主' : platform;
  let timeText = String(a.fetchedAt || a.date || '');
  let timeTs = new Date(a.fetchedAt || a.date || '').valueOf();
  if (isNaN(timeTs)) { timeText = ''; timeTs = Date.now(); }

  const st: ClipState = saved ? 'saved' : reading ? 'reading' : 'unread';

  return {
    id: key,
    origin: 'news',
    title,
    url: String(a.url || ''),
    site: siteName(a),
    domain: siteDomain(a),
    author: String(a.author || ''),
    srcName,
    typeLabel,
    timeText,
    timeTs,
    summary: excerpt(body, 110),
    body,
    tags: Array.isArray(a.tags) ? (a.tags as string[]).map(String) : [],
    notePath: null,
    st,
    clipped,
    raw: a,
    backlinks: [],
  };
}

/** 剪藏目录条目 → ClipArticle（origin=clip；saved 语义固定为已保存） */
export function clipFromNote(n: any): ClipArticle {
  return {
    id: 'clip:' + n.path,
    origin: 'clip',
    title: String(n.title || '(无标题)'),
    url: n.url ? String(n.url) : '',
    site: String(n.site || '未知'),
    domain: n.domain || '',
    author: n.author || '',
    srcName: n.site || '剪藏',
    typeLabel: '',
    timeText: '',
    timeTs: n.created || 0,
    summary: String(n.summary || ''),
    body: '',
    tags: Array.isArray(n.tags) ? (n.tags as string[]).map(String) : [],
    notePath: n.path || null,
    st: 'saved',
    clipped: true,
    note: n,
    backlinks: Array.isArray(n.backlinkNames) ? n.backlinkNames : [],
  };
}

/** 剪藏目录 URL 集合（clipByUrl 判定入参） */
export function clipUrlSet(notes: Array<{ url?: string }>): Set<string> {
  const s = new Set<string>();
  for (const n of notes) if (n && n.url) s.add(String(n.url));
  return s;
}

/**
 * 视图查询：按源过滤条目。
 * - all/未读：仅未处理 news（read!==true）的 unread/reading 派生，saved 隐藏；
 * - 平台/UP：该来源未处理 news（read!==true），saved 隐藏；
 * - clip：剪藏目录全部（ClipArticle 直接返回，天然 saved）。
 */
export type ClipSource = { kind: RailKindLike; platform?: string; up?: string; note?: any };

type RailKindLike = 'inbox' | 'clip' | 'all';

export function queryBySource(
  articles: any[],
  sidecar: ClipbookData,
  clipByUrl: Set<string>,
  clipNotes: any[],
  source: { kind: 'all' } | { kind: 'inbox'; platform: string; up?: string } | { kind: 'clip' }
): ClipArticle[] {
  const upInfo = {};
  if (source.kind === 'clip') {
    return (clipNotes || []).map((n) => clipFromNote(n));
  }
  // news 面：只取未处理（read!==true；骨架/已处理不进收件流）
  const pool = (articles || []).filter((a) => !a.read);
  const savedKeys = new Set((sidecar.savedArchive || []).map((s) => s.url));
  let out: ClipArticle[] = [];
  if (source.kind === 'all') {
    out = pool.map((a) => clipArticle(a, { overrides: sidecar.articleOverrides, clipByUrl, savedKeys }));
  } else {
    const isBili = source.platform === 'B站';
    const list = pool.filter((a) => {
      const p = platformOf(a);
      if (p !== source.platform) return false;
      if (isBili && source.up && String(a.author || '') !== source.up) return false;
      return true;
    });
    out = list.map((a) => clipArticle(a, { overrides: sidecar.articleOverrides, clipByUrl, savedKeys }));
  }
  // saved（含 url 命中剪藏）在收件流里隐藏（保留在「剪藏本」源）
  return out.filter((a) => a.st !== 'saved');
}

/** 全量未处理数（rail「全部未读」徽标；不含 saved 命中剪藏的未读回落） */
export function unreadTotal(articles: any[]): number {
  return (articles || []).filter((a) => !a.read).length;
}

/** 某平台/UP 未处理数 */
export function inboxCount(articles: any[], platform: string, up?: string): number {
  return (articles || []).filter((a) => {
    if (a.read) return false;
    if (platformOf(a) !== platform) return false;
    if (up && String(a.author || '') !== up) return false;
    return true;
  }).length;
}

/** 剪藏目录条目数（rail「剪藏本」计数） */
export function clipCount(notes: Array<any> | null): number {
  return notes ? notes.length : 0;
}

/** 已读中「已保存」的条目（saved 源列表侧写，无独立源返回 0——本票 saved 只进剪藏本） */
export function savedCount(articles: any[], sidecar: ClipbookData, clipByUrl: Set<string>): number {
  let n = 0;
  for (const a of articles || []) {
    if (!a.read) continue;
    if (a.state === 'saved') { n++; continue; }
    if (a.url && clipByUrl.has(String(a.url))) n++;
  }
  n += (sidecar.savedArchive || []).length;
  return n;
}

/**
 * 动作执行（状态写回）。
 * @param act save|unsave|read|skip|reading|delete|open-note
 * 返回需要触发 UI 重渲染的提示文案（或空）。
 */
export async function runAction(
  act: string,
  article: ClipArticle | null,
  ctx: { articles: any[]; sidecar: ClipbookData; clipByUrl: Set<string> }
): Promise<{ rerender: boolean; msg?: string; openPath?: string }> {
  if (!article) return { rerender: false };
  // 剪藏条目：删除（vault.delete 由 UI 层做）；打开笔记由 UI 层做
  if (article.origin === 'clip') {
    if (act === 'open-note' && article.notePath) return { rerender: false, openPath: article.notePath };
    return { rerender: false };
  }
  const raw = article.raw;
  if (!raw) return { rerender: false };
  const key = articleKeyOf(raw);
  const overrides = { ...ctx.sidecar.articleOverrides };

  if (act === 'reading') {
    // 在读 ↔ 回未读
    const cur = overrides[key];
    if (cur && cur.reading === true) delete overrides[key];
    else overrides[key] = { reading: true };
    await writeSidecar({ ...ctx.sidecar, articleOverrides: overrides });
    return { rerender: true };
  }
  if (act === 'save' || act === 'unsave' || act === 'read' || act === 'skip') {
    if (act === 'unsave') {
      // 移出剪藏：清 news state + 归档残留（目录文件不动，靠目录保留）
      const fresh = { ...ctx.sidecar };
      fresh.articleOverrides = overrides;
      fresh.savedArchive = (fresh.savedArchive || []).filter((s) => s.url !== String(raw.url || ''));
      await writeSidecar(fresh);
      return { rerender: true };
    }
    // 落 news.json read 面（saved/skipped 语义对齐 news/reader.ts markAsRead）
    if (act === 'save' || act === 'read' || act === 'skip') {
      await writeNewsState(raw, act as 'save' | 'read' | 'skip');
      return { rerender: true };
    }
  }
  return { rerender: false };
}

/** 写回 news.json 单篇状态（read=true + state + 删 body；整段读写保留其它段 + 串行队列防覆盖） */
export async function writeNewsState(raw: any, action: 'save' | 'read' | 'skip'): Promise<void> {
  const key = articleKeyOf(raw);
  const res = await readNewsData();
  if (!res.ok || res.missing) return;
  const list = (res.data.articles || []).map((a: any) => {
    if (articleKeyOf(a) !== key) return a;
    return {
      ...a,
      read: true,
      state: action === 'save' ? 'saved' : action === 'skip' ? 'skipped' : a.state === 'saved' ? 'saved' : 'skipped',
      body: action === 'read' && a.state === 'saved' ? a.body : undefined,
    };
  });
  await writeNewsData({ ...res.data, articles: list });
}

/** 侧写整段写回（幂等去抖由调用方做） */
export async function writeSidecar(data: ClipbookData): Promise<void> {
  await writeClipbookData(data);
}

/** 应用保留策略（news/reader.ts loadAll 语义迁移：未读不处理/已存 N 天删/已跳 M 天删，起算 fetchedAt/date） */
export function applyRetentionTo(articles: any[], savedDays: number, skippedDays: number, now: number = Date.now()): any[] {
  return applyRetention(articles, savedDays, skippedDays, now);
}
