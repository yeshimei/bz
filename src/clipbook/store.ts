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
 *   body 清空/stats 计数，串行队列 + 写前段级合并——write-queue.ts / news-data
 *   writeNewsDataMerged，对 daemon 双写者不丢段）与 clipbook.json 侧写。
 * - saveToClip 写剪藏笔记 + 发 news:read/saved 域事件（smartcat 行为流三跳依赖）。
 */
import { readNewsData, writeNewsDataMerged } from './news-data';
import type { ClipArticle, ClipOrigin, ClipState } from './types';
import { articleKeyOf, excerpt } from './constants';
import { updateClipbookData, type ClipbookData } from './data';
import { enqueueNewsWrite } from './write-queue';


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

/** 平台归一（B站/果壳科学人/知乎日报；守护进程新旧写法都收敛；rail 动态分组共用，issue 206 导出） */
export function platformOf(a: any): string {
  const p = a.platform || '';
  if (p === 'B站') return 'B站';
  if (p === '果壳' || p === '果壳科学人') return '果壳科学人';
  if (p === '知乎日报' || p === '知乎') return '知乎日报';
  return p || '未知';
}

/** 平台兜底根域（url 缺失/解析失败时 favicon 仍有源可取，issue 206） */
const PLATFORM_DOMAIN: Record<string, string> = {
  'B站': 'bilibili.com',
  '果壳科学人': 'guokr.com',
  '知乎日报': 'zhihu.com',
};

function siteDomain(a: any): string {
  const u = String(a.url || '').trim();
  if (u) {
    try {
      return new URL(u).hostname;
    } catch (e) { /* 无协议等非常规写法，补 https 重试 */ }
    try {
      return new URL('https://' + u.replace(/^\/+/, '')).hostname;
    } catch (e) { /* 继续走平台兜底 */ }
  }
  return PLATFORM_DOMAIN[platformOf(a)] || '';
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
  // C6：UP 主名用 upInfo 回填（后台抓到名字则显名，回退 author/uid——ticket 126 展示契约）
  const feedUp = isBili ? upName(a, upInfo[String(a.author || '')]) : '';
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
 * - site（issue 222）：该站点未处理 news（saved 隐藏）+ 该站剪藏全量，时间降序；
 * - clip：剪藏目录全部（ClipArticle 直接返回，天然 saved）。
 * news 面按 timeTs 降序（issue 206：聚合讯新文章排对应列表最前）。
 */
export type ClipSource = { kind: RailKindLike; platform?: string; up?: string; site?: string; note?: any };

type RailKindLike = 'inbox' | 'clip' | 'all' | 'site';

export function queryBySource(
  articles: any[],
  sidecar: ClipbookData,
  clipByUrl: Set<string>,
  clipNotes: any[],
  source: { kind: 'all' } | { kind: 'inbox'; platform: string; up?: string } | { kind: 'clip' } | { kind: 'site'; site: string },
  upInfoMap: Record<string, any> = {}
): ClipArticle[] {
  if (source.kind === 'clip') {
    return (clipNotes || []).map((n) => clipFromNote(n));
  }
  // news 面：只取未处理（read!==true；骨架/已处理不进收件流）
  const pool = (articles || []).filter((a) => !a.read);
  const savedKeys = new Set((sidecar.savedArchive || []).map((s) => s.url));
  // site 源（issue 222）：该站未读 news 流（saved 命中照常隐藏）+ 该站剪藏全量
  if (source.kind === 'site') {
    const s = normSite(source.site);
    const newsPart = pool
      .filter((a) => normSite(siteName(a)) === s)
      .map((a) => clipArticle(a, { overrides: sidecar.articleOverrides, clipByUrl, savedKeys, upInfo: upInfoMap }))
      .filter((a) => a.st !== 'saved');
    const clipPart = (clipNotes || [])
      .filter((n) => normSite(String((n && n.site) || '')) === s)
      .map((n) => clipFromNote(n));
    return [...newsPart, ...clipPart].sort((a, b) => b.timeTs - a.timeTs);
  }
  let out: ClipArticle[] = [];
  if (source.kind === 'all') {
    out = pool.map((a) => clipArticle(a, { overrides: sidecar.articleOverrides, clipByUrl, savedKeys, upInfo: upInfoMap }));
  } else {
    const isBili = source.platform === 'B站';
    const list = pool.filter((a) => {
      const p = platformOf(a);
      if (p !== source.platform) return false;
      if (isBili && source.up && String(a.author || '') !== source.up) return false;
      return true;
    });
    out = list.map((a) => clipArticle(a, { overrides: sidecar.articleOverrides, clipByUrl, savedKeys, upInfo: upInfoMap }));
  }
  // saved（含 url 命中剪藏）在收件流里隐藏（保留在「剪藏本」源）；新文章排最前
  return out.filter((a) => a.st !== 'saved').sort((a, b) => b.timeTs - a.timeTs);
}





/**
 * 动作执行（状态写回）。
 * @param act save|unsave|read|skip|reading|delete|open-note
 * 返回需要触发 UI 重渲染的提示文案（或空）。
 */

/** 写回 news.json 单篇状态（read=true + state + 删 body；串行队列 + 段级合并——与 loader/
 *  news-source-settings/flow 共用同一条写链，daemon 并发追加的文章不被覆盖） */
export async function writeNewsState(raw: any, action: 'save' | 'read' | 'skip'): Promise<void> {
  const key = articleKeyOf(raw);
  await enqueueNewsWrite(async () => {
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
    await writeNewsDataMerged({ set: { articles: list } });
  });
}


// ===== 站点聚合（issue 222：rail 按 site 属性分类，平台聚合行退役）=====

/** site 归一：去首尾空白，空值归「未知」桶 */
function normSite(s: string): string {
  const t = String(s || '').trim();
  return t || '未知';
}

/** 站点聚合行（rail 与移动源胶囊共用） */
export interface SiteRow {
  /** 归一站点名（空值已归「未知」） */
  site: string;
  /** 该站全库条目数（未读 news 流 + 剪藏全量；已存 news 骨架不计——saved 命中转由剪藏承接，防重复计数） */
  total: number;
  /** 其中未读 news 流条数（剪藏天然 saved 不占） */
  unread: number;
}

/**
 * 全库站点行聚合：剪藏全量 site + 未读 news 面 site（已存 news 骨架不进——
 * saved 命中（侧写归档 ∨ url 命中剪藏）的条目转由剪藏目录承接，与 queryBySource
 * site 源的可见口径一致，行总数 = 该源列表长度）。排序：总数降序 → 未读降序 → 名 zh 序。
 */
export function aggregateSites(
  articles: any[],
  clipNotes: any[],
  savedUrls?: Set<string>,
  clipUrls?: Set<string>
): SiteRow[] {
  const saved = savedUrls || new Set<string>();
  const byUrl = clipUrls || new Set<string>();
  const rows = new Map<string, SiteRow>();
  const bump = (rawSite: string, unread: boolean) => {
    const site = normSite(rawSite);
    let r = rows.get(site);
    if (!r) {
      r = { site, total: 0, unread: 0 };
      rows.set(site, r);
    }
    r.total++;
    if (unread) r.unread++;
  };
  for (const n of clipNotes || []) bump(String((n && n.site) || ''), false);
  for (const a of articles || []) {
    if (!a || a.read) continue;
    if (saved.has(String(a.url || ''))) continue;
    if (a.url && byUrl.has(String(a.url))) continue;
    bump(siteName(a), true);
  }
  return [...rows.values()].sort((x, y) =>
    y.total - x.total || y.unread - x.unread || x.site.localeCompare(y.site, 'zh'));
}
