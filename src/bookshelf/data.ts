/**
 * 书架墙（bookshelf）域数据层：书库 md 书目解析 / EPUB(weave-data) 条目 / 排序 / 筛选 / 统计。
 * 复刻迁移自旧 src/library/items.ts（同语义、独立实现；新旧域并存互不依赖）。
 * - md 书：书库目录（bookshelfFolderPath 空 = 运行时回落旧 libraryFolderPath 存量值）下 frontmatter tags 含 bookTag（旧键存量值）的笔记
 * - EPUB 书：<weaveDataPath>/weave-data.json 聚合（ADR-0013 口径；与旧域同源同格式）
 * - status 派生：readingDate && !completionDate → 在读；都有 → 已读；否则未读
 */
import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { localDayKey } from '../core/utils';
import type { BookshelfItem } from './state';
import { M } from './state';
import { getDisplayItems as pipeDisplay } from './render';
const WEAVE_PLUGIN_ID = 'weave-epub-reader';
/** Weave 阅读数据文件名（EPUB 自动刷新按此后缀识别 json 通道；index.ts 引用） */
export const WEAVE_DATA_FILE = 'weave-data.json';
const COVER_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/** 书库文件夹：新设置键优先；旧键 libraryFolderPath 已随 library 域退役从接口删除，
 *  此处运行时读存量值（用户 data.json 可能仍存有该键），零感知迁移；最终回落「书库」 */
export function resolveFolderPath(): string {
  const s = tryGetSettings() as Record<string, unknown>;
  const v = typeof s.bookshelfFolderPath === 'string' && s.bookshelfFolderPath.trim()
    ? s.bookshelfFolderPath
    : typeof s.libraryFolderPath === 'string' && s.libraryFolderPath.trim()
      ? s.libraryFolderPath
      : '书库';
  return v.replace(/^\/+|\/+$/g, '');
}

/** 书标签：bookTag 键已随 library 域退役从接口删除——运行时读存量值（零感知迁移），缺省 'book' */
export function resolveBookTag(): string {
  const s = tryGetSettings() as Record<string, unknown>;
  return typeof s.bookTag === 'string' && s.bookTag.trim() ? s.bookTag.trim() : 'book';
}


function parseStatus(readingDate: string | null, completionDate: string | null): string {
  if (readingDate && !completionDate) return '在读';
  if (readingDate && completionDate) return '已读';
  return '未读';
}

/** md 书阅读时长毫秒（issue 226 修书脊全同高）：frontmatter `readingTime`（毫秒数）直读；
 *  缺了再解析 `readingTimeFormat`——中文「N小时M分/N分」或 weave 英文「NhMmSs」双格式 */
function parseReadingTimeMs(fm: Record<string, unknown> | undefined | null): number {
  const raw = Number(fm?.readingTime);
  if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
  const fmt = String(fm?.readingTimeFormat ?? '').trim();
  if (!fmt) return 0;
  let ms = 0;
  for (const m of fmt.matchAll(/(\d+(?:\.\d+)?)\s*(小时|h|分|min|m|秒|s)/gi)) {
    const v = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === '小时' || unit === 'h') ms += v * 3600000;
    else if (unit === '分' || unit === 'min' || unit === 'm') ms += v * 60000;
    else ms += v * 1000;
  }
  return Math.round(ms);
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
    readingTimeMs: parseReadingTimeMs(fm),
    highlights,
    thinks,
    // 书脊厚度量（issue 218）：字数（缺省 0，UI 层回退批注密度）
    wordCount: Number(fm.wordCount) || 0,
    pages: Number(fm.pages) || 0,
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
  // 本地时区 YYYY-MM-DD（原 UTC 切片会在时区边界偏移一天，audit H；core localDayKey 转发壳）
  return localDayKey(timestamp as number);
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
  // B11：分类接 Weave 元数据 subjects[0]（issue 221/ADR-0099）；无则置 null（kwFilter 搜「未分类」不误命中 EPUB）
  const subjects: unknown[] = Array.isArray(meta?.subjects) ? meta.subjects : [];
  const epubCategory = typeof subjects[0] === 'string' && subjects[0].trim() ? subjects[0].trim() : null;
  return {
    file: vaultFile instanceof TFile ? vaultFile : null,
    title,
    author: typeof meta?.author === 'string' && meta.author.trim() ? meta.author.trim() : '未知作者',
    category: epubCategory,
    cover: resolveEpubCoverPath(app, meta),
    bookReview: null,
    readingDate,
    completionDate,
    progress,
    readingTimeFormat: formatReadingTime(totalReadTimeMs),
    readingTimeMs: totalReadTimeMs,
    highlights: Array.isArray(notes?.highlights) ? notes.highlights.length : 0,
    thinks: Array.isArray(notes?.excerpts) ? notes.excerpts.length : 0,
    wordCount: 0,
    pages: 0,
    status: completionDate ? '已读' : progress > 0 ? '在读' : '未读',
    isEpub: true,
    epubVaultPath: vaultPath,
  };
}

/** 读 weave-data.json 聚合（缺失/解析失败返回 []） */
export async function readWeaveAggregates(app: App): Promise<any[]> {
  try {
    const dataPath = resolveWeaveDataPath(app);
    const dataFilePath = `${dataPath}/${WEAVE_DATA_FILE}`;
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

/** 重建在途序号（audit I）：并发 rebuild 只有最新一次落袋——旧快照（同步扫描结果）晚到时
 *  不得回写覆盖新数据；参照 library ui 的 bookNotesLoadSeq 先例 */
let rebuildSeq = 0;

/** 重建条目列表（md 同步 + EPUB 异步并入；返回 promise 供 UI 层完成后统一渲染） */
export async function rebuildItems(app: App): Promise<BookshelfItem[]> {
  const seq = ++rebuildSeq;
  const mdItems = scanMarkdownBooks(app);
  const epubItems = await loadEpubItems(app);
  if (seq !== rebuildSeq) return M.items; // 过期在途重建：已被更新一次的重建取代
  const merged = [...mdItems, ...epubItems];
  M.items.length = 0;
  M.items.push(...merged);
  return merged;
}


/** 当前展示列表（状态 + 分类 + 关键字 + 排序），UI 层统一入口（读 M；纯管道在 render.ts） */
export function getDisplayItems(): BookshelfItem[] {
  return pipeDisplay(M.items, { side: M.side, catFilter: M.catFilter, q: M.searchKeyword, sortMode: M.sortMode });
}
