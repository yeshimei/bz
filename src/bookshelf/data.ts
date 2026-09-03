/**
 * 书架墙（bookshelf）域数据层：书库 md 书目解析 / EPUB(weave-data) 条目 / 排序 / 筛选 / 统计。
 * 复刻迁移自旧 src/library/items.ts（同语义、独立实现；新旧域并存互不依赖）。
 * - md 书：书库目录（bookshelfFolderPath 回落 libraryFolderPath）下 frontmatter tags 含 bookTag 的笔记
 * - EPUB 书：<weaveDataPath>/weave-data.json 聚合（ADR-0013 口径；与旧域同源同格式）
 * - status 派生：readingDate && !completionDate → 在读；都有 → 已读；否则未读
 */
import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import type { BookshelfItem } from './state';
import { M } from './state';
const WEAVE_PLUGIN_ID = 'weave-epub-reader';
/** Weave 阅读数据文件名（EPUB 自动刷新按此后缀识别 json 通道；index.ts 引用） */
export const WEAVE_DATA_FILE = 'weave-data.json';
const DEFAULT_WEAVE_DATA_FILE = WEAVE_DATA_FILE;
const COVER_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/** 书库文件夹：新设置键优先，回落旧 libraryFolderPath，最终回落「书库」 */
export function resolveFolderPath(): string {
  const s = tryGetSettings() as Record<string, unknown>;
  const v = typeof s.bookshelfFolderPath === 'string' && s.bookshelfFolderPath.trim()
    ? s.bookshelfFolderPath
    : typeof s.libraryFolderPath === 'string' && s.libraryFolderPath.trim()
      ? s.libraryFolderPath
      : '书库';
  return v.replace(/^\/+|\/+$/g, '');
}

/** 书标签（与旧 library 域共享同一键：同一批书两域同显） */
export function resolveBookTag(): string {
  const s = tryGetSettings() as Record<string, unknown>;
  return typeof s.bookTag === 'string' && s.bookTag.trim() ? s.bookTag.trim() : 'book';
}

/** 去 folderPath 前缀后第一段目录，无则 null（category 未写时按子文件夹归类） */
export function getSubfolder(filePath: string, folderPath: string): string | null {
  const relative = filePath.slice(folderPath.length + 1);
  const firstSlash = relative.indexOf('/');
  return firstSlash !== -1 ? relative.slice(0, firstSlash) : null;
}

function parseStatus(readingDate: string | null, completionDate: string | null): string {
  if (readingDate && !completionDate) return '在读';
  if (readingDate && completionDate) return '已读';
  return '未读';
}

/** md 书目解析（同步；metadataCache frontmatter） */
export function parseBookFile(file: TFile, app: App, folderPath: string, bookTag: string): BookshelfItem | null {
  const metadata = app.metadataCache.getFileCache(file);
  const fm = metadata?.frontmatter;
  if (!fm) return null;
  let tags = fm.tags;
  if (!tags) return null;
  if (!Array.isArray(tags)) tags = [tags];
  if (!tags.includes(bookTag)) return null;

  const title = file.basename;
  const author = fm.author?.toString() || '未知作者';
  const category = fm.category?.toString() || '未分类';
  let cover = fm.cover ? fm.cover.toString() : null;
  if (cover && !cover.includes('/')) {
    cover = `CONFIG/BOOK/${title}/${cover}`;
  }
  const bookReview = fm.bookReview ? fm.bookReview.toString() : null;
  const readingDate = fm.readingDate ? fm.readingDate.toString() : null;
  const completionDate = fm.completionDate ? fm.completionDate.toString() : null;
  const progress = fm.readingProgress !== undefined ? Number(fm.readingProgress) || 0 : 0;
  const readingTimeFormat = fm.readingTimeFormat?.toString() || null;
  const highlights = Number(fm.highlights) || 0;
  const thinks = Number(fm.thinks) || 0;

  return {
    file,
    title,
    author,
    category,
    cover,
    bookReview,
    readingDate,
    completionDate,
    progress: progress > 100 ? 100 : progress,
    readingTimeFormat,
    readingTimeMs: 0,
    highlights,
    thinks,
    status: parseStatus(readingDate, completionDate),
    isEpub: false,
    epubVaultPath: null,
  };
}

/** 扫描书库目录，构建 md 书目列表（不落 M；调用方负责装载）。
 *  B10：目录对象存在时 TFolder 递归直取（大 vault 免全量遍历），否则回落全量过滤。 */
export function scanMarkdownBooks(app: App): BookshelfItem[] {
  const folderPath = resolveFolderPath();
  const bookTag = resolveBookTag();
  const folder = app.vault.getAbstractFileByPath(folderPath) as { children?: any[] } | null;
  const files: any[] = [];
  if (folder && Array.isArray(folder.children)) {
    const stack = [...folder.children];
    while (stack.length) {
      const cur = stack.pop() as any;
      if (Array.isArray(cur?.children)) stack.push(...cur.children);
      else if (cur?.extension === 'md') files.push(cur);
    }
  } else {
    // 回落：目录对象缺失（目录不存在/目录本身是单个 md 笔记）时全量过滤
    files.push(...app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folderPath + '/') || f.path === folderPath + '.md'));
  }
  const items: BookshelfItem[] = [];
  for (const file of files) {
    try {
      const item = parseBookFile(file, app, folderPath, bookTag);
      if (item) items.push(item);
    } catch (e) {
      console.warn('处理书目文件失败:', file.path, e);
    }
  }
  return items;
}

// ===== EPUB 书目条目（ADR-0013 口径；数据与旧 library 域同源） =====

/** 归一化 Weave 数据目录：去首尾斜杠，空值回落 CONFIG/STORAGE */
function normalizeWeaveDataPath(value?: string): string {
  const raw = String(value || '').trim().replace(/^\/+|\/+$/g, '');
  return raw || 'CONFIG/STORAGE';
}

/** 解析 Weave 阅读数据目录：读 Weave 插件 settings.dataPath（ticket 65 语义），缺省回落 CONFIG/STORAGE */
export function resolveWeaveDataPath(app: App): string {
  const plugins = (app as any).plugins?.plugins;
  const fromWeave = plugins?.[WEAVE_PLUGIN_ID]?.settings?.dataPath;
  return normalizeWeaveDataPath(fromWeave);
}

function isVaultImageFile(app: App, path: string): boolean {
  const file = (app as any).vault?.getAbstractFileByPath?.(path);
  return Boolean(file) && /\.(png|jpe?g|gif|webp)$/i.test((file as any).name || path);
}

function resolveEpubCoverPath(app: App, meta: any): string | null {
  const coverPath = typeof meta?.coverPath === 'string' ? meta.coverPath.trim() : '';
  if (coverPath && isVaultImageFile(app, coverPath)) return coverPath;
  const title = typeof meta?.title === 'string' ? meta.title.trim() : '';
  if (title) {
    for (const ext of COVER_EXTENSIONS) {
      const candidate = `CONFIG/BOOK/EPUB COVER/${title}.${ext}`;
      if (isVaultImageFile(app, candidate)) return candidate;
    }
  }
  return null;
}

/** 阅读时长毫秒 → 「N小时M分」展示格式（无时长 null；与旧域同文案） */
export function formatReadingTime(totalReadTimeMs: number | undefined): string | null {
  const totalMinutes = Math.round((Number(totalReadTimeMs) || 0) / 60000);
  if (totalMinutes <= 0) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`;
  return `${minutes}分`;
}

function toDateString(timestamp: number | undefined): string | null {
  if (!Number.isFinite(timestamp) || !timestamp) return null;
  // 本地时区 YYYY-MM-DD（原 UTC 切片会在时区边界偏移一天，audit H；口径同 reading-report/stats.ts）
  const d = new Date(timestamp);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 单本 EPUB 聚合 → 书架条目（缺 title/vaultPath 跳过） */
function buildEpubItem(app: App, aggregate: any): BookshelfItem | null {
  const meta = aggregate?.meta;
  const fileRef = aggregate?.file;
  const reading = aggregate?.reading;
  const notes = aggregate?.notes;
  const stats = reading?.stats;
  const vaultPath = typeof fileRef?.vaultPath === 'string' ? fileRef.vaultPath.trim() : '';
  const title = typeof meta?.title === 'string' ? meta.title.trim() : '';
  if (!vaultPath || !title) return null;

  // B6：progress 归一按 CONTEXT 契约（ticket 081/ADR-0034，与 smartcat libraryWeaveDiff 同口径）：
  // Weave 上报 0-1 小数（1.0=读完 → 100）；>1 为旧版 0-100 口径直接取整（钳 100）
  const rawPercent = typeof reading?.position?.percent === 'number' ? reading.position.percent : 0;
  const progress = rawPercent > 1
    ? Math.min(100, Math.round(rawPercent))
    : Math.round(Math.max(0, Math.min(1, rawPercent)) * 100);
  const lastReadTime = Number.isFinite(stats?.lastReadTime) ? stats.lastReadTime : 0;
  const completedTime = Number.isFinite(stats?.completedTime) ? stats.completedTime : 0;
  const totalReadTimeMs = Number.isFinite(stats?.totalReadTime) ? stats.totalReadTime : 0;

  const readingDate = progress > 0 ? toDateString(lastReadTime) : null;
  const completionDate = toDateString(completedTime);

  const vaultFile = app?.vault?.getAbstractFileByPath?.(vaultPath);
  return {
    file: vaultFile instanceof TFile ? vaultFile : null,
    title,
    author: typeof meta?.author === 'string' && meta.author.trim() ? meta.author.trim() : '未知作者',
    // B11：EPUB 无分类元数据，置 null（不再硬编码「未分类」——kwFilter 搜「未分类」曾误命中全部 EPUB）
    category: null,
    cover: resolveEpubCoverPath(app, meta),
    bookReview: null,
    readingDate,
    completionDate,
    progress,
    readingTimeFormat: formatReadingTime(totalReadTimeMs),
    readingTimeMs: totalReadTimeMs,
    highlights: Array.isArray(notes?.highlights) ? notes.highlights.length : 0,
    thinks: Array.isArray(notes?.excerpts) ? notes.excerpts.length : 0,
    status: completionDate ? '已读' : progress > 0 ? '在读' : '未读',
    isEpub: true,
    epubVaultPath: vaultPath,
  };
}

/** 读 weave-data.json 聚合（缺失/解析失败返回 []） */
export async function readWeaveAggregates(app: App): Promise<any[]> {
  try {
    const dataPath = resolveWeaveDataPath(app);
    const dataFilePath = `${dataPath}/${DEFAULT_WEAVE_DATA_FILE}`;
    const file = app?.vault?.getAbstractFileByPath?.(dataFilePath);
    if (!file) return [];
    const content = await app.vault.adapter.read(dataFilePath);
    const parsed = JSON.parse(content);
    const books = parsed?.books;
    if (!books || typeof books !== 'object') return [];
    return Object.values(books);
  } catch {
    return [];
  }
}

/** EPUB 条目（异步；缺文件返回 []） */
export async function loadEpubItems(app: App): Promise<BookshelfItem[]> {
  const aggregates = await readWeaveAggregates(app);
  const items: BookshelfItem[] = [];
  for (const aggregate of aggregates) {
    const item = buildEpubItem(app, aggregate);
    if (item) items.push(item);
  }
  return items;
}

/** 重建条目列表（md 同步 + EPUB 异步并入；返回 promise 供 UI 层完成后统一渲染） */
export async function rebuildItems(app: App): Promise<BookshelfItem[]> {
  const mdItems = scanMarkdownBooks(app);
  const epubItems = await loadEpubItems(app);
  const merged = [...mdItems, ...epubItems];
  M.items.length = 0;
  M.items.push(...merged);
  return merged;
}

// ===== 排序 / 筛选 / 统计 =====

/** 条目主日期（排序/详情展示）：读完日 > 开始日；无日期按文件创建时间；再无可视化底部 */
function primaryDate(it: BookshelfItem): number {
  const d = it.completionDate || it.readingDate;
  if (d) {
    const t = new Date(d).getTime();
    if (!isNaN(t)) return t;
  }
  if (it.file?.stat?.ctime) return it.file.stat.ctime;
  return 0;
}

/** 排序：date=主日期倒序（无日期排后）；title/author localeCompare('zh')；progress 倒序 */
export function sortItems(list: BookshelfItem[], key: string): BookshelfItem[] {
  const sorted = [...list];
  if (key === 'title' || key === 'author') {
    sorted.sort((a, b) => (a[key] || '').localeCompare(b[key] || '', 'zh'));
  } else if (key === 'progress') {
    sorted.sort((a, b) => b.progress - a.progress);
  } else {
    sorted.sort((a, b) => primaryDate(b) - primaryDate(a));
  }
  return sorted;
}

/** 当前侧栏过滤（全部 = 不过滤） */
export function currentSideItems(items: BookshelfItem[], side: string): BookshelfItem[] {
  if (side === 'all') return items;
  const status = side === 'reading' ? '在读' : side === 'unread' ? '未读' : '已读';
  return items.filter((it) => it.status === status);
}

/** 关键字过滤（书名/作者/分类） */
export function kwFilter(list: BookshelfItem[], kw: string): BookshelfItem[] {
  if (!kw) return list;
  const k = kw.trim().toLowerCase();
  return list.filter((it) => `${it.title} ${it.author || ''} ${it.category || ''}`.toLowerCase().includes(k));
}

/** 当前展示列表（侧栏 + 关键字 + 排序），UI 层统一入口 */
export function getDisplayItems(): BookshelfItem[] {
  let list = currentSideItems(M.items, M.side);
  list = kwFilter(list, M.searchKeyword);
  return sortItems(list, M.sortMode);
}

/** 派生统计（随时从 M.items 重算；与旧 library/原型同口径） */
export interface ShelfStats {
  reading: BookshelfItem[];
  unread: BookshelfItem[];
  done: BookshelfItem[];
  doneThisYear: BookshelfItem[];
  totalHours: number;
  totalHighlights: number;
  bars: { count: number; label: string; isThis: boolean }[];
  maxBar: number;
}

export function computeStats(now: Date = new Date()): ShelfStats {
  const reading = M.items.filter((x) => x.status === '在读');
  const unread = M.items.filter((x) => x.status === '未读');
  const done = M.items.filter((x) => x.status === '已读');
  const thisYear = now.getFullYear();
  const doneThisYear = done.filter((x) => x.completionDate && x.completionDate.startsWith(String(thisYear)));

  // 时长：md 书 frontmatter readingTimeFormat 中文「N小时M分/N小时/M分」；EPUB 直接毫秒
  let totalMs = 0;
  for (const it of M.items) {
    if (it.readingTimeMs) totalMs += it.readingTimeMs;
    else if (it.readingTimeFormat) {
      const m = it.readingTimeFormat.match(/(\d+)\s*小时|(\d+)\s*分/g);
      if (m) {
        for (const part of m) {
          if (part.includes('小时')) totalMs += (parseInt(part, 10) || 0) * 3600000;
          else if (part.includes('分')) totalMs += (parseInt(part, 10) || 0) * 60000;
        }
      }
    }
  }
  const totalHighlights = M.items.reduce((s, x) => s + (x.highlights || 0), 0);

  // 近 12 个月读完（按 completionDate）：bars[0] = 11 个月前，bars[11] = 本月（标签与数据同柱）
  const bars: { count: number; label: string; isThis: boolean }[] = [];
  const nowM = now.getFullYear() * 12 + now.getMonth();
  for (let i = 0; i < 12; i++) {
    const t = nowM - (11 - i);
    const y = Math.floor(t / 12);
    const m = t % 12;
    const count = done.filter((x) => x.completionDate && +x.completionDate.slice(0, 4) === y && +x.completionDate.slice(5, 7) === m + 1).length;
    bars.push({ count, label: i === 11 ? '本月' : `${m + 1}月`, isThis: i === 11 });
  }
  return {
    reading, unread, done, doneThisYear,
    totalHours: Math.round(totalMs / 3600000),
    totalHighlights,
    bars,
    maxBar: Math.max(2, ...bars.map((b) => b.count)),
  };
}
