/**
 * 书库 items（ticket 12）：书目解析/子文件夹/状态色板/排序，源码逐字移植。
 * 源码：书库.js L100-208、L542-605
 */
import { formatFileSize as coreFormatFileSize } from '../core/utils';
import { getSettings } from '../core/settings-provider';

export interface BookSettings {
  folderPath: string;
  notePath: string;
  bookTag: string;
  showFileSize: boolean;
  showReadingTime: boolean;
  showHighlights: boolean;
  showThinks: boolean;
  showReview: boolean;
  showCategory: boolean;
  /** Weave 阅读数据文件（weave-data.json）所在目录（ADR-0013）。 */
  weaveDataPath: string;
}

/** 从插件设置派生书库设置快照（源码 window._bookSettings 语义） */
export function deriveBookSettings(): BookSettings {
  const s = getSettings() as any;
  return {
    folderPath: s.libraryFolderPath || '书库',
    notePath: s.libraryNotePath || '我的/读书笔记',
    bookTag: s.bookTag || 'book',
    showFileSize: s.showFileSize !== false,
    showReadingTime: s.showReadingTime !== false,
    showHighlights: s.showHighlights !== false,
    showThinks: s.showThinks !== false,
    showReview: s.showReview !== false,
    showCategory: s.showCategory !== true,
    weaveDataPath: s.weaveDataPath || 'CONFIG/STORAGE',
  };
}

/** 去掉 folderPath 前缀后第一段目录，无则 null */
export function getSubfolder(filePath: string, folderPath: string): string | null {
  const relative = filePath.slice(folderPath.length + 1);
  const firstSlash = relative.indexOf('/');
  if (firstSlash !== -1) {
    return relative.slice(0, firstSlash);
  }
  return null;
}

export function formatFileSize(bytes: number): string | null {
  return coreFormatFileSize(bytes);
}

/** 三状态色板（theme-dark 判定） */
export function getStatusColors() {
  const isDark = document.body.classList.contains('theme-dark');
  if (isDark) {
    return {
      badgeBg: { 未读: '#616161', 在读: '#F57C00', 已读: '#388E3C' },
      badgeText: { 未读: '#E0E0E0', 在读: '#FFF3E0', 已读: '#E8F5E9' },
    };
  } else {
    return {
      badgeBg: { 未读: '#BDBDBD', 在读: '#FF8C42', 已读: '#66BB6A' },
      badgeText: { 未读: '#2C2C2C', 在读: '#2D1B00', 已读: '#1B5E20' },
    };
  }
}

export interface BookItem {
  file: any;
  title: string;
  author: string;
  category: string;
  cover: string | null;
  bookReview: string | null;
  readingDate: string | null;
  completionDate: string | null;
  readingProgress: number;
  readingTimeFormat: string | null;
  highlights: number;
  thinks: number;
  status: string;
  subfolder: string | null;
  sizeBytes: number;
  /** true = 由 Weave 数据文件驱动的 EPUB 条目（与 markdown 书目并列、互不影响，ADR-0013）。 */
  isEpub?: boolean;
}

/** 书目解析：frontmatter tags 含 bookTag + 路径在书库目录下 */
export function getBookItems(app: any): BookItem[] {
  const settings = deriveBookSettings();
  const folderPath = settings.folderPath;
  const bookTag = settings.bookTag;
  const allFiles = app.vault.getMarkdownFiles();
  const files = allFiles.filter((f: any) => {
    if (!f.path.startsWith(folderPath + '/') && f.path !== folderPath + '.md') return false;
    const metadata = app.metadataCache.getFileCache(f);
    const fm = metadata?.frontmatter;
    if (!fm) return false;
    let tags = fm.tags;
    if (!tags) return false;
    if (!Array.isArray(tags)) tags = [tags];
    return tags.includes(bookTag);
  });

  const items: BookItem[] = [];
  for (const file of files) {
    const metadata = app.metadataCache.getFileCache(file);
    const fm = metadata?.frontmatter;
    if (!fm) continue;

    const title = file.basename;
    const author = fm.author || '未知作者';
    const category = fm.category || '未分类';
    let cover = fm.cover ? fm.cover.toString() : null;
    if (cover && !cover.includes('/')) {
      cover = `CONFIG/BOOK/${title}/${cover}`;
    }
    const bookReview = fm.bookReview ? fm.bookReview.toString() : null;
    const readingDate = fm.readingDate ? fm.readingDate.toString() : null;
    const completionDate = fm.completionDate ? fm.completionDate.toString() : null;
    const readingProgress = fm.readingProgress !== undefined ? Number(fm.readingProgress) : 0;
    const readingTimeFormat = fm.readingTimeFormat || null;
    const highlights = fm.highlights || 0;
    const thinks = fm.thinks || 0;
    const subfolder = getSubfolder(file.path, folderPath) || null;
    const sizeBytes = file.stat?.size || 0;

    let status = '未读';
    if (readingDate && !completionDate) status = '在读';
    else if (readingDate && completionDate) status = '已读';

    items.push({
      file,
      title,
      author,
      category,
      cover,
      bookReview,
      readingDate,
      completionDate,
      readingProgress,
      readingTimeFormat,
      highlights,
      thinks,
      status,
      subfolder,
      sizeBytes,
    });
  }
  return items;
}

/** 排序：title/author localeCompare('zh')；日期类有值在前无值排后；进度有值在前 */
export function sortItemList(list: BookItem[], key: string, order: string): BookItem[] {
  const sorted = [...list];
  if (key === 'title') {
    sorted.sort((a, b) => {
      const compare = a.title.localeCompare(b.title, 'zh');
      return order === 'asc' ? compare : -compare;
    });
    return sorted;
  } else if (key === 'author') {
    sorted.sort((a, b) => {
      const compare = a.author.localeCompare(b.author, 'zh');
      return order === 'asc' ? compare : -compare;
    });
    return sorted;
  } else if (key === 'readingDate') {
    const withVal: { item: BookItem; dateValue: number }[] = [];
    const withoutVal: BookItem[] = [];
    for (const item of sorted) {
      let dateValue: number | null = null;
      if (item.readingDate && !isNaN(new Date(item.readingDate).getTime())) {
        dateValue = new Date(item.readingDate).getTime();
      } else if (item.file && item.file.stat && item.file.stat.ctime) {
        dateValue = item.file.stat.ctime;
      }
      if (dateValue !== null) {
        withVal.push({ item, dateValue });
      } else {
        withoutVal.push(item);
      }
    }
    withVal.sort((a, b) => {
      return order === 'asc' ? a.dateValue - b.dateValue : b.dateValue - a.dateValue;
    });
    return [...withVal.map((v) => v.item), ...withoutVal];
  } else if (key === 'completionDate') {
    const withVal: BookItem[] = [];
    const withoutVal: BookItem[] = [];
    for (const item of sorted) {
      if (item.completionDate && !isNaN(new Date(item.completionDate).getTime())) {
        withVal.push(item);
      } else {
        withoutVal.push(item);
      }
    }
    withVal.sort((a, b) => {
      const da = new Date(a.completionDate!).getTime();
      const db = new Date(b.completionDate!).getTime();
      return order === 'asc' ? da - db : db - da;
    });
    return [...withVal, ...withoutVal];
  } else if (key === 'readingProgress') {
    const withProgress = sorted.filter(
      (item) => item.readingProgress !== null && item.readingProgress !== undefined
    );
    const withoutProgress = sorted.filter(
      (item) => item.readingProgress === null || item.readingProgress === undefined
    );
    withProgress.sort((a, b) => {
      return order === 'asc' ? a.readingProgress - b.readingProgress : b.readingProgress - a.readingProgress;
    });
    return [...withProgress, ...withoutProgress];
  }
  return sorted;
}

// ===== EPUB 书目条目（ADR-0013）：从 Weave 阅读数据文件（weave-data.json）构建 =====

const DEFAULT_WEAVE_DATA_FILE = 'weave-data.json';
export { DEFAULT_WEAVE_DATA_FILE };
const COVER_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const READING_SESSION_MIN_DURATION_SECONDS = 300;

export function normalizeWeaveDataPath(value?: string): string {
  const raw = String(value || '').trim().replace(/^\/+|\/+$/g, '');
  return raw || 'CONFIG/STORAGE';
}

function isVaultImageFile(app: any, path: string): boolean {
  const file = app?.vault?.getAbstractFileByPath?.(path);
  return Boolean(file) && /\.(png|jpe?g|gif|webp)$/i.test(file.name || path);
}

/** 封面路径：优先 meta.coverPath（Weave 落盘路径）；兜底按书名在默认封面输出目录下推断。 */
function resolveEpubCoverPath(app: any, meta: any): string | null {
  const coverPath = typeof meta?.coverPath === 'string' ? meta.coverPath.trim() : '';
  if (coverPath && isVaultImageFile(app, coverPath)) {
    return coverPath;
  }
  const title = typeof meta?.title === 'string' ? meta.title.trim() : '';
  if (title) {
    for (const ext of COVER_EXTENSIONS) {
      const candidate = `CONFIG/BOOK/EPUB COVER/${title}.${ext}`;
      if (isVaultImageFile(app, candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/** 阅读时长 → 「N小时M分」展示格式（无时长返回 null）。 */
function formatReadingTime(totalReadTimeMs: number | undefined): string | null {
  const totalMinutes = Math.round((Number(totalReadTimeMs) || 0) / 60000);
  if (totalMinutes <= 0) {
    return null;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`;
  }
  return `${minutes}分`;
}

function toDateString(timestamp: number | undefined): string | null {
  if (!Number.isFinite(timestamp) || !timestamp) {
    return null;
  }
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** 单本书聚合 → 书库条目（缺 title/vaultPath 的书跳过）。 */
function buildEpubBookItem(app: any, aggregate: any): BookItem | null {
  const meta = aggregate?.meta;
  const fileRef = aggregate?.file;
  const reading = aggregate?.reading;
  const notes = aggregate?.notes;
  const stats = reading?.stats;
  const vaultPath = typeof fileRef?.vaultPath === 'string' ? fileRef.vaultPath.trim() : '';
  const title = typeof meta?.title === 'string' ? meta.title.trim() : '';
  if (!vaultPath || !title) {
    return null;
  }

  const rawPercent = typeof reading?.position?.percent === 'number' ? reading.position.percent : 0;
  const progressPercent =
    rawPercent > 1
      ? Math.min(100, Math.round(rawPercent))
      : Math.round(Math.max(0, Math.min(1, rawPercent)) * 100);
  const lastReadTime = Number.isFinite(stats?.lastReadTime) ? stats.lastReadTime : 0;
  const completedTime = Number.isFinite(stats?.completedTime) ? stats.completedTime : 0;

  const readingDate = progressPercent > 0 ? toDateString(lastReadTime) : null;
  const completionDate = toDateString(completedTime);
  let status = '未读';
  if (completionDate) status = '已读';
  else if (progressPercent > 0) status = '在读';

  const vaultFile = app?.vault?.getAbstractFileByPath?.(vaultPath);
  return {
    file: {
      path: vaultPath,
      name: vaultPath.split('/').pop() || title,
      stat: {
        size: typeof vaultFile?.stat?.size === 'number' ? vaultFile.stat.size : 0,
        ctime: lastReadTime || 0,
      },
    },
    title,
    author: typeof meta?.author === 'string' && meta.author.trim() ? meta.author.trim() : '未知作者',
    category: '未分类',
    cover: resolveEpubCoverPath(app, meta),
    bookReview: null,
    readingDate,
    completionDate,
    readingProgress: progressPercent,
    readingTimeFormat: formatReadingTime(stats?.totalReadTime),
    highlights: Array.isArray(notes?.highlights) ? notes.highlights.length : 0,
    thinks: Array.isArray(notes?.excerpts) ? notes.excerpts.length : 0,
    status,
    subfolder: null,
    sizeBytes: typeof vaultFile?.stat?.size === 'number' ? vaultFile.stat.size : 0,
    isEpub: true,
  };
}

/**
 * 读取 Weave 阅读数据文件并返回全部书籍聚合数组（文件缺失/解析失败返回 []）。
 * 书库 getBookItems 与阅读报告 getEpubBookNotes 共用此解析通道。
 */
export async function readWeaveDataAggregates(app: any): Promise<any[]> {
  try {
    const settings = deriveBookSettings();
    const dataPath = normalizeWeaveDataPath(settings.weaveDataPath);
    const dataFilePath = `${dataPath}/${DEFAULT_WEAVE_DATA_FILE}`;
    const file = app?.vault?.getAbstractFileByPath?.(dataFilePath);
    if (!file) {
      return [];
    }
    const content = await app.vault.adapter.read(dataFilePath);
    const parsed = JSON.parse(content);
    const books = parsed?.books;
    if (!books || typeof books !== 'object') {
      return [];
    }
    return Object.values(books);
  } catch {
    return [];
  }
}

/**
 * 从 Weave 阅读数据文件（<weaveDataPath>/weave-data.json）构建 EPUB 书目条目。
 * Weave 未启用 / 文件缺失 / 解析失败 → 返回空数组（markdown 部分不受影响）。
 */
export async function loadEpubBookItems(app: any): Promise<BookItem[]> {
  const aggregates = await readWeaveDataAggregates(app);
  const items: BookItem[] = [];
  for (const aggregate of aggregates) {
    const item = buildEpubBookItem(app, aggregate);
    if (item) {
      items.push(item);
    }
  }
  return items;
}
