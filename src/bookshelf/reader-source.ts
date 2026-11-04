/**
 * bz 阅读（bz-reader 插件）数据源：数据目录解析 + 业务 JSON 读取 + 归一。
 *
 * 存储路径（bz-reader 0.1.x，2026-11-04 定稿；同日默认值从「bz 阅读」收进
 * `bz-reader/storage`，提交 68c8bdb「三个目录收进库根 bz-reader/」）：
 *   - 业务数据：`<vault>/<dataDir>/bz-reader.json`
 *     dataDir 存在 `<configDir>/plugins/bz-reader/data.json` 的**顶层** `dataDir`
 *     （不是 settings 里；见 bz-reader src/data/plugin-data.ts），缺省
 *     `bz-reader/storage`（src/core/plugin-path.ts 的 DEFAULT_DATA_DIR）。
 *   - 封面：`<dataDir>/covers/<bookId>.<ext>`；`meta.coverPath` 已是 vault 相对路径。
 *   - 库根容器 `bz-reader/` 下另有 `books/`（用户导入的书）与 `notes/`（导出的书摘），
 *     只有 `storage/` 是业务数据——老用户可能仍把 dataDir 显式指在旧的「bz 阅读」，
 *     所以这里以插件 data.json 的记录为准，缺省值只在它为空/不可读时兜底。
 *     旧 `bz 阅读/` 另做一层**只读兜底**（2026-11-05）：用户来回切数据目录后，
 *     改名可能留在旧目录（bz-reader 的 titleEdited 只写当时那份），读侧补书名；
 *     当前目录整份缺失时用旧目录顶上。见 readReaderData。
 *
 * 为什么不直接读 bz-reader 插件实例（`app.plugins.plugins['bz-reader'].repo`）：
 *   1. 插件被禁用/未加载时书库仍应能显示书——数据是文件，不是内存；
 *   2. 实例字段是插件的内部实现（private），跨插件耦合比读一份对外契约 JSON 更脆。
 *   配置走 adapter 直读：`.obsidian` 在 vault 文件树里不可见，getAbstractFileByPath 取不到。
 *
 * 归一目标：weave-data.json 的聚合形状（ADR-0013），上层 bookshelf / reading-report /
 * home / recap 只认这一种。差异全部收敛在 normalizeReaderAggregates：
 *   - `books` 是数组（weave 是 id → aggregate 的字典）
 *   - `fileRef.vaultPath`（weave 是 `file.vaultPath`）
 *   - 划线想法在 `comment` / `createdAt`（weave 是 `commentText` / `createdTime`）
 *   - `stats.totalReadTime` 是**秒**（weave 是毫秒）→ 归一乘 1000
 *   - `notes.excerpts` 是 highlights 的**全量镜像**（bz-reader data/notes.ts 的 mirrorExcerpt）
 *     → 只保留「有想法」的，否则 bz 的 thinks（读 excerpts.length）会等于划线总数
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';

/** 插件 id（manifest.json 的 id，不随插件显示名/目录名变化） */
export const READER_PLUGIN_ID = 'bz-reader';
/** 业务数据文件名（bz-reader data/store.ts 的 DATA_FILE） */
export const READER_DATA_FILE = 'bz-reader.json';
/** 数据目录缺省值（bz-reader core/plugin-path.ts 的 DEFAULT_DATA_DIR，2026-11-04 起为
 *  `bz-reader/storage`；旧默认「bz 阅读」只作为用户 data.json 里的显式存量值存在） */
export const READER_DEFAULT_DATA_DIR = 'bz-reader/storage';
/** bz-reader 0.1.2 之前的数据目录（库根 `bz 阅读/`）。2026-11-04 起默认值收进
 *  `bz-reader/storage`，但老库升级/用户来回切目录后，旧目录里可能留着**更新的改名**
 *  （bz-reader 的 titleEdited 只写在当时那个目录）。读侧把它当兜底候选，见 readReaderData。 */
export const LEGACY_READER_DATA_DIR = 'bz 阅读';

function isObj(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** 收口径：反斜杠转正斜杠、去首尾斜杠、拒绝上跳与点目录（与 bz-reader normalizeDataDir 同规则）。
 *  拒绝而不是报错：手改坏的 data.json 不该让整本书库消失，回落缺省目录还能用。 */
export function normalizeReaderDataDir(raw: unknown): string {
  const s = String(raw ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim();
  if (!s) return READER_DEFAULT_DATA_DIR;
  const segs = s.split('/').filter(Boolean);
  if (segs.some((x) => x === '..' || x.startsWith('.'))) return READER_DEFAULT_DATA_DIR;
  return segs.join('/');
}

/** bz-reader 插件目录（vault 相对）：manifest.dir 优先（插件目录名用户可改），否则 configDir 兜底 */
export function resolveReaderPluginDir(app: App): string {
  const dir = (app as any)?.plugins?.manifests?.[READER_PLUGIN_ID]?.dir;
  if (typeof dir === 'string' && dir.trim()) return dir.trim().replace(/^\/+|\/+$/g, '');
  const configDir = String((app as any)?.vault?.configDir || '.obsidian').replace(/^\/+|\/+$/g, '');
  return `${configDir || '.obsidian'}/plugins/${READER_PLUGIN_ID}`;
}

/** 数据文件完整路径（vault 相对） */
export function readerDataFilePathOf(dataDir: string): string {
  return `${normalizeReaderDataDir(dataDir)}/${READER_DATA_FILE}`;
}

/**
 * 读 bz-reader 的插件配置（`.obsidian/plugins/bz-reader/data.json`）。
 *
 * 读不到（未安装 / 未启用 / 手改坏）一律 null，由调用方回落缺省数据目录。
 * 不用 getAbstractFileByPath：配置目录不在 vault 的可见文件树里。
 */
export async function readReaderPluginConfig(app: App): Promise<any | null> {
  const path = `${resolveReaderPluginDir(app)}/data.json`;
  try {
    const raw = await (app as any)?.vault?.adapter?.read?.(path);
    if (typeof raw !== 'string') return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 当前数据目录（vault 相对，无首尾斜杠）——以插件 data.json 的 dataDir 为准 */
export async function resolveReaderDataDir(app: App): Promise<string> {
  const cfg = await readReaderPluginConfig(app);
  return normalizeReaderDataDir(cfg?.dataDir);
}

/** 最近一次解析成功的数据文件路径。
 *  体检（checkup）的扫描清单是同步函数，又必须与这里走同一条解析链（用户可在 bz 阅读里
 *  迁数据目录），所以把解析结果留一份快照给它；体检开跑时会先调一次 resolve 刷新。 */
let knownDataFilePath: string | null = null;

/** 同步取「已知的数据文件路径」：尚未解析过时回落缺省目录（与 bz 阅读的默认值一致） */
export function knownReaderDataFilePath(): string {
  return knownDataFilePath || readerDataFilePathOf(READER_DEFAULT_DATA_DIR);
}

/** 当前业务数据文件路径（vault 相对） */
export async function resolveReaderDataFilePath(app: App): Promise<string> {
  const filePath = readerDataFilePathOf(await resolveReaderDataDir(app));
  knownDataFilePath = filePath;
  return filePath;
}

/** 读结果三态：missing = 文件不存在（首次/没用过 bz 阅读）；corrupt = 存在但读/解析失败 */
export interface ReaderDataRead {
  filePath: string;
  state: 'ok' | 'missing' | 'corrupt';
  data?: any;
}

/** 旧数据目录（0.1.2 之前的 `bz 阅读/`）的数据文件路径 */
export function legacyReaderDataFilePath(): string {
  return readerDataFilePathOf(LEGACY_READER_DATA_DIR);
}

/** 读单个数据文件（不写、不建目录） */
async function readReaderFile(app: App, filePath: string): Promise<ReaderDataRead> {
  let raw: string | null = null;
  try {
    raw = await (app as any)?.vault?.adapter?.read?.(filePath);
  } catch {
    return { filePath, state: 'missing' };
  }
  if (typeof raw !== 'string') return { filePath, state: 'missing' };
  try {
    return { filePath, state: 'ok', data: JSON.parse(raw) };
  } catch {
    return { filePath, state: 'corrupt' };
  }
}

/**
 * 旧目录里「用户显式改过名」的书名补进当前数据（只改内存，不写盘）。
 *
 * 为什么只补书名：bz-reader 的改名是 `meta.titleEdited = true`，其余字段（进度、
 * 划线）以当前目录那份为准——写回路径（mutateReaderBook）读的是当前目录，读侧如果
 * 合并出当前文件里不存在的划线，书库编辑/删除会落空。书名只是展示，补进来不会与
 * 写回冲突。
 */
export function mergeLegacyReaderTitles(primary: any, legacy: any): any {
  const books = isObj(primary) && Array.isArray((primary as any).books) ? (primary as any).books : null;
  const oldBooks = isObj(legacy) && Array.isArray((legacy as any).books) ? (legacy as any).books : [];
  if (!books || !oldBooks.length) return primary;
  const byId = new Map<string, any>();
  const byPath = new Map<string, any>();
  for (const old of oldBooks) {
    if (!isObj(old)) continue;
    const id = typeof old.id === 'string' ? old.id.trim() : '';
    if (id) byId.set(id, old);
    const path = typeof old.fileRef?.vaultPath === 'string' ? old.fileRef.vaultPath.trim() : '';
    if (path) byPath.set(path, old);
  }
  for (const book of books) {
    if (!isObj(book) || !isObj(book.meta)) continue;
    if (book.meta.titleEdited === true) continue; // 当前目录自己就是改名后的数据，别回头盖
    const id = typeof book.id === 'string' ? book.id.trim() : '';
    const path = typeof book.fileRef?.vaultPath === 'string' ? book.fileRef.vaultPath.trim() : '';
    const old = (id && byId.get(id)) || (path && byPath.get(path)) || null;
    if (!old || old.meta?.titleEdited !== true) continue;
    const title = typeof old.meta?.title === 'string' ? old.meta.title.trim() : '';
    if (!title) continue;
    book.meta.title = title;
    book.meta.titleEdited = true;
  }
  return primary;
}

/** 只读直读业务 JSON（不写、不建目录）。路径每回现算：用户在 bz 阅读设置里迁目录后下一次就读新的。
 *
 *  旧目录兜底（2026-11-05，书库显示原书名的修复）：
 *    - 当前目录存在时，旧 `bz 阅读/` 里 `titleEdited` 的书名补进来（只补书名，见上）；
 *    - 当前目录整个缺失时，旧目录有一份就整份用——目录迁移失败/被清指针后，书不该从
 *      书库凭空消失（写回仍定位当前目录，可能失败，但读展示优先）。
 *    - 两份路径相同（用户就把数据放在 `bz 阅读`）时只读一次。 */
export async function readReaderData(app: App): Promise<ReaderDataRead> {
  const filePath = await resolveReaderDataFilePath(app);
  const primary = await readReaderFile(app, filePath);
  const legacyPath = legacyReaderDataFilePath();
  if (filePath === legacyPath) return primary;
  if (primary.state === 'ok') {
    const legacy = await readReaderFile(app, legacyPath);
    if (legacy.state === 'ok') {
      return { ...primary, data: mergeLegacyReaderTitles(primary.data, legacy.data) };
    }
    return primary;
  }
  if (primary.state === 'missing') {
    const legacy = await readReaderFile(app, legacyPath);
    if (legacy.state === 'ok') return { filePath, state: 'ok', data: legacy.data };
  }
  return primary;
}

/** 划线归一：comment → commentText，createdAt → createdTime（bz 读书笔记读 weave 口径字段） */
function normalizeHighlights(list: unknown): any[] {
  if (!Array.isArray(list)) return [];
  const out: any[] = [];
  for (const raw of list) {
    if (!isObj(raw)) continue;
    const next: Record<string, any> = { ...raw };
    if (typeof raw.comment === 'string') next.commentText = raw.comment;
    if (typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)) next.createdTime = raw.createdAt;
    out.push(next);
  }
  return out;
}

/**
 * bz-reader 业务 JSON → weave 形状聚合数组（纯函数；坏条目直接丢，不猜）。
 *
 * 想法数口径：bz-reader 的 excerpts 是 highlights 的镜像，无论有没有 comment 都会写；
 * bz 的 thinks 读 excerpts.length，直接透传会把「划线数」当「想法数」（虚高）。
 * 这里只给「comment 非空」的划线生成镜像，thinks 于是等于有想法的划线数。
 */
export function normalizeReaderAggregates(raw: unknown): any[] {
  const books = isObj(raw) && Array.isArray((raw as any).books) ? (raw as any).books : [];
  const out: any[] = [];
  for (const book of books) {
    if (!isObj(book)) continue;
    const vaultPath = typeof book.fileRef?.vaultPath === 'string' ? book.fileRef.vaultPath.trim() : '';
    const title = typeof book.meta?.title === 'string' ? book.meta.title.trim() : '';
    if (!vaultPath || !title) continue;

    const reading = isObj(book.reading) ? book.reading : {};
    const stats = isObj(reading.stats) ? reading.stats : {};
    const notes = isObj(book.notes) ? book.notes : {};
    const highlights = normalizeHighlights(notes.highlights);
    const excerpts = highlights
      .filter((h) => typeof h.commentText === 'string' && h.commentText.trim())
      .map((h) => ({
        id: h.id,
        text: h.text,
        cfiRange: h.cfiRange,
        chapterIndex: h.chapterIndex,
        chapterTitle: h.chapterTitle,
        comment: h.commentText,
        createdAt: h.createdTime,
      }));

    out.push({
      id: typeof book.id === 'string' ? book.id : '',
      meta: book.meta,
      file: { ...book.fileRef, vaultPath },
      reading: {
        position: isObj(reading.position) ? reading.position : { percent: 0 },
        stats: {
          ...stats,
          // bz-reader 按秒记账，weave 按毫秒——上层（书架/报告）统一按毫秒展示
          totalReadTime: num(stats.totalReadTime) * 1000,
          lastReadTime: num(stats.lastReadTime),
          completedTime: num(stats.completedTime),
          startReadTime: num(stats.startReadTime),
        },
        sessions: Array.isArray(reading.sessions) ? reading.sessions : [],
      },
      notes: {
        highlights,
        excerpts,
        bookmarks: Array.isArray(notes.bookmarks) ? notes.bookmarks.filter(isObj) : [],
      },
      addedAt: num(book.addedAt),
      updatedAt: num(book.updatedAt),
      favorite: book.favorite === true,
      shelf: typeof book.shelf === 'string' && book.shelf ? book.shelf : undefined,
    });
  }
  return out;
}

/** 读侧损坏已告警旗标（与 weave 同口径：损坏降级一次性告警，恢复正常后复位） */
let readerCorruptWarned = false;

/** 读 bz-reader.json 聚合（缺失返回 []；损坏降级空 + 一次性告警）。
 *  silent：写路径定位源文件时不弹告警（写入不该被另一份数据的损坏拦住）。 */
export async function readReaderAggregates(
  app: App,
  opts?: { silent?: boolean },
): Promise<any[]> {
  const res = await readReaderData(app);
  if (res.state === 'missing') return [];
  if (res.state === 'corrupt') {
    console.warn('bz-reader.json 读取/解析失败，bz 阅读条目降级为空:', res.filePath);
    if (!readerCorruptWarned && !opts?.silent) {
      readerCorruptWarned = true;
      notice('bz 阅读数据文件损坏，书库 EPUB 条目暂时无法显示', 'warning');
    }
    return [];
  }
  readerCorruptWarned = false;
  return normalizeReaderAggregates(res.data);
}

/** 测试用：复位损坏告警旗标（避免用例之间串状态） */
export function resetReaderCorruptWarned(): void {
  readerCorruptWarned = false;
}
