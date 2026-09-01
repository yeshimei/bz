/**
 * 回忆墙（diary-wall）域数据层（自包含）
 * 聚合四类内容：日记 + 影视 + 信 + 书，统一按日期时间降序混排。
 * - 日记：`我的/日记/YYYY-MM-DD.md` → parseFile（每文件多条目，filename=dateStr）；
 * - 影视：`我的/影视/*.md` → parseMovieFile（每文件一条，无影评/无观影日期跳过）；
 * - 信：`我的/信/*.md` → parseLetterFile（readonly 跳过）；
 * - 书：`书库/*.md` → parseBookFile（无 completionDate/readingDate 跳过；封面经 extractMedia 提取）。
 * 数据格式冻结：日记每文件多条目，`# emoji序列 HH:mm` 标题行为条目边界（解析逻辑见 ./parser，自包含拷贝自 diary 域）。
 * 依赖方向（ADR-0002）：core ← config/state ← parser ← store ← ui ← main；本文件不碰 DOM，App 一律参数注入。
 * 自包含：不依赖 ../diary/（用户决策「回忆墙自包含，日后删除日记本域」）——config/parser/types 均在本域内。
 * 媒体 URL 走 vault API（getResourcePath / getFirstLinkpathDest）：原型里硬编码 file:// 路径在 vault 内不可播放，
 * 必须经 Obsidian 资源路径才能被 img/video/audio 加载。
 */
import type { App, TFile } from 'obsidian';
import { parseFile, parseMovieFile, parseLetterFile, parseBookFile } from './parser';
import { DIARY_DIRECTORY, MOVIE_DIRECTORY, LETTER_DIRECTORY, BOOK_DIRECTORY } from './config';
import type { DiaryEntry } from './types';

/** 媒体文件（从正文 `![[...]]` 内链提取） */
export interface WallMedia {
  /** 引用名：纯文件名或完整引用路径（不含 `|参数` 后缀） */
  name: string;
  /** 按扩展名判定的媒体类型 */
  kind: 'img' | 'video' | 'audio';
}

/** 回忆墙条目来源类型（UI 渲染/跳转区分用：日记 filename=dateStr，影视/信/书 filename=完整 vault 路径） */
export type WallEntryKind = 'diary' | 'movie' | 'letter' | 'book';

/** 回忆墙条目 = 日记条目核心字段 + 来源类型 + 媒体列表 + 渲染正文（content 保留原文，media/text 由内容派生） */
export interface WallEntry
  extends Pick<
    DiaryEntry,
    'date' | 'time' | 'tags' | 'emoji' | 'content' | 'filename' | 'lineNumber' | 'id' | 'noteId' | 'encrypted'
  > {
  kind: WallEntryKind;
  media: WallMedia[];
  /**
   * 渲染用正文：去除媒体嵌入（`![[图片/视频/音频]]`）后的 markdown 原文（UI 用 MarkdownRenderer 渲染）。
   * 保留其余 markdown 语法（加粗/斜体/标题/列表/引用/`[[笔记链接]]` 等）与普通文本；
   * content 保留完整原文供复制/跳转。
   */
  text: string;
}

/** 扩展名 → 媒体类型（jpg/jpeg/png/webp/gif/avif→img；mp4/mov/webm→video；wav/m4a/mp3/flac/aac/ogg→audio） */
const MEDIA_EXT_KIND: Record<string, WallMedia['kind']> = {
  jpg: 'img',
  jpeg: 'img',
  png: 'img',
  webp: 'img',
  gif: 'img',
  avif: 'img',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  wav: 'audio',
  m4a: 'audio',
  mp3: 'audio',
  flac: 'audio',
  aac: 'audio',
  ogg: 'audio',
};

/** `![[引用]]` 内链正则（含 `|参数` 后缀；`#` 后的块引用定位符不属于链接名，不纳入引用名） */
const WIKILINK_RE = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;

/**
 * 从正文提取 `![[文件名.扩展名]]` / `![[路径/文件名.扩展名]]` 媒体引用（Obsidian 内链语法）。
 * - 只提取图片/视频/音频扩展名，忽略 `.md` 等非媒体内链；
 * - 支持 `![[xxx.jpg|400]]` 尺寸参数（去掉 `|...` 后缀）；
 * - 支持带路径引用（保留完整引用路径，media.name 即引用原文）；
 * - 去重：同一引用只保留首次出现。
 * vaultDir：媒体归属目录（loadWallEntries 传入各内容目录），为「按目录过滤媒体」预留的解析基目录；
 * 当前提取阶段不改变引用原文——Obsidian 链接是全局解析，拼接目录会破坏 getFirstLinkpathDest 解析。
 */
export function extractMedia(content: string, vaultDir: string): WallMedia[] {
  void vaultDir; // 预留参数：目录过滤语义待 UI 联调确定，接口先行稳定
  const seen = new Set<string>();
  const media: WallMedia[] = [];
  const re = new RegExp(WIKILINK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const ref = m[1].trim();
    const dot = ref.lastIndexOf('.');
    if (dot <= 0 || dot === ref.length - 1) continue;
    const ext = ref.slice(dot + 1).toLowerCase();
    const kind = MEDIA_EXT_KIND[ext];
    if (!kind) continue; // 非媒体扩展名（.md 等）忽略
    if (seen.has(ref)) continue;
    seen.add(ref);
    media.push({ name: ref, kind });
  }
  return media;
}

/**
 * 去除正文中的媒体嵌入（`![[...]]`，含图片/视频/音频及 `|400` 尺寸参数），返回剩余 markdown 原文（渲染用）。
 * - 与 extractMedia 同一扩展名判定：只删媒体类 `![[...]]`（整体删除，含 `![[` 与 `]]`）；
 * - 非媒体内链（`[[其他笔记]]`、`[[书库/xx#^block]]`、`![[xx.md]]`）原样保留——不是要隐藏的媒体引用；
 * - 其余 markdown 语法（加粗/斜体/标题/列表/引用/链接等）不受影响，原样保留；
 * - 结果 trim（全媒体条目返回空串）。
 */
export function stripMediaLinks(content: string): string {
  const re = new RegExp(WIKILINK_RE.source, 'g');
  return content.replace(re, (whole, ref: string) => {
    const name = ref.trim();
    const dot = name.lastIndexOf('.');
    if (dot <= 0 || dot === name.length - 1) return whole;
    return MEDIA_EXT_KIND[name.slice(dot + 1).toLowerCase()] ? '' : whole;
  }).trim();
}

/** 日记文件名格式：YYYY-MM-DD.md */
const DIARY_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;

/** 校验 YYYY-MM-DD 是否为真实日期（2024-13-45 之类匹配正则但非合法日期，跳过） */
function isValidDateStr(s: string): boolean {
  const [y, mo, d] = s.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/**
 * 递归枚举目录下全部 .md 文件路径（vault.adapter.list，Obsidian DataAdapter 标准接口；
 * mock vault 与真实 vault 行为一致，且天然支持子目录递归）。
 * 目录不存在/无权限：list 抛错时跳过该目录，不阻断整体加载。
 */
async function collectMdPaths(app: App, dirPath: string): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [dirPath.replace(/\/+$/, '') || '/'];
  const seen = new Set<string>();
  while (stack.length) {
    const dir = stack.pop()!;
    if (seen.has(dir)) continue;
    seen.add(dir);
    let listing: { files: string[]; folders: string[] };
    try {
      listing = await (app.vault.adapter as any).list(dir);
    } catch {
      continue; // 目录不存在：跳过
    }
    if (!listing) continue;
    for (const f of listing.files || []) {
      if (f.toLowerCase().endsWith('.md')) out.push(f);
    }
    for (const d of listing.folders || []) stack.push(d);
  }
  return out;
}

/** 收集目录下全部 .md TFile（路径 → getAbstractFileByPath 转 TFile，过滤目录） */
async function mdFilesUnder(app: App, dirPath: string): Promise<TFile[]> {
  const vault = app.vault;
  const mdPaths = await collectMdPaths(app, dirPath);
  const mdFiles: TFile[] = [];
  for (const p of mdPaths) {
    const f = vault.getAbstractFileByPath(p);
    if (f && !(f as any).children && (f as TFile).extension === 'md') mdFiles.push(f as TFile);
  }
  return mdFiles;
}

/** DiaryEntry → WallEntry（透传定位字段 + kind 标记 + 派生 media/text；dir 为媒体归属目录） */
function toWallEntry(e: DiaryEntry, kind: WallEntry['kind'], dir: string): WallEntry {
  return {
    date: e.date,
    time: e.time,
    tags: e.tags,
    emoji: e.emoji,
    content: e.content,
    // 透传解析层条目的定位/标识信息：供 UI 跳转/动作区分
    // （日记 filename=dateStr；影视/信/书 filename=完整 vault 路径）
    filename: e.filename,
    lineNumber: e.lineNumber,
    id: e.id,
    // 加密日记条目的保险箱 SafeNote id（encrypted=true 时存在；UI 解密时用，非加密条目为 undefined）
    noteId: e.noteId,
    kind,
    media: extractMedia(e.content, dir),
    // 渲染用正文：去媒体嵌入，保留 markdown 语法（content 保留原文供复制/跳转）
    text: stripMediaLinks(e.content),
  };
}

/** 加载日记：diaryDir 下所有 `YYYY-MM-DD.md`，每文件多条目（kind='diary'） */
async function loadDiaryEntries(app: App, diaryDir: string): Promise<WallEntry[]> {
  const vault = app.vault;
  const mdFiles = await mdFilesUnder(app, diaryDir);
  const entries: WallEntry[] = [];
  const BATCH = 10;
  for (let i = 0; i < mdFiles.length; i += BATCH) {
    const batch = mdFiles.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const m = DIARY_FILE_RE.exec(file.name);
        if (!m || !isValidDateStr(m[1])) return [];
        const dateStr = m[1];
        const content = await vault.read(file);
        return parseFile(content, dateStr).map((e) => toWallEntry(e, 'diary', diaryDir));
      })
    );
    for (const r of batchResults) entries.push(...r);
  }
  return entries;
}

/** 加载单文件单条目的特殊内容（影视/信/书）：parse 返回 null 的跳过；kind 由调用方标记 */
async function loadSpecialEntries(
  app: App,
  dir: string,
  kind: WallEntry['kind'],
  parse: (file: TFile, app: App) => Promise<DiaryEntry | null>
): Promise<WallEntry[]> {
  const mdFiles = await mdFilesUnder(app, dir);
  const BATCH = 10;
  const entries: WallEntry[] = [];
  for (let i = 0; i < mdFiles.length; i += BATCH) {
    const batch = mdFiles.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const e = await parse(file, app);
        return e ? [toWallEntry(e, kind, dir)] : [];
      })
    );
    for (const r of batchResults) entries.push(...r);
  }
  return entries;
}

/**
 * 聚合加载回忆墙全部内容（日记 + 影视 + 信 + 书），统一 date 降序、time 降序混排。
 * 目录常量取自自身 config（DIARY/MOVIE/LETTER/BOOK_DIRECTORY，自包含）。
 * 影视/信/书的 filename 为完整 vault 路径，日记的 filename 为 dateStr（UI 跳转时区分）。
 */
export async function loadWallEntries(app: App): Promise<WallEntry[]> {
  const entries = await loadDiaryEntries(app, DIARY_DIRECTORY);
  // 聚合影视/信/书
  entries.push(...(await loadSpecialEntries(app, MOVIE_DIRECTORY, 'movie', parseMovieFile)));
  entries.push(...(await loadSpecialEntries(app, LETTER_DIRECTORY, 'letter', parseLetterFile)));
  entries.push(...(await loadSpecialEntries(app, BOOK_DIRECTORY, 'book', parseBookFile)));

  // 排序：日期降序、时间降序（HH:mm 字典序与数值序一致）
  entries.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    return dateCmp !== 0 ? dateCmp : b.time.localeCompare(a.time);
  });
  return entries;
}

/** 按月份分组（key 为 'YYYY-MM'），组内保持传入顺序 */
export function groupByMonth(entries: WallEntry[]): Map<string, WallEntry[]> {
  const map = new Map<string, WallEntry[]>();
  for (const e of entries) {
    const key = e.date.slice(0, 7); // YYYY-MM
    let list = map.get(key);
    if (!list) {
      list = [];
      map.set(key, list);
    }
    list.push(e);
  }
  return map;
}

/**
 * 媒体 URL 解析：返回 vault 内文件的可访问资源 URL（媒体可播放的关键，原型硬编码 file:// 不可用）。
 * - 优先 Obsidian 链接解析（getFirstLinkpathDest）：传 sourcePath（来源文件路径，如 '我的/影视/xx.md'）
 *   时以该文件为基准解析（Obsidian 链接解析先找同目录/相对路径，修复纯文件名全局解析失败问题）；
 *   sourcePath 不传时保持向后兼容（'' 全局解析，行为同现状）；
 * - 带路径引用回退 getAbstractFileByPath（此时 sourcePath 无关，仍以引用原文为准）；
 * - 找不到（或命中目录）返回 ''。
 */
export function mediaSrc(app: App, mediaName: string, sourcePath?: string): string {
  if (!mediaName) return '';
  const basePath = sourcePath ?? '';
  const file =
    (app.metadataCache?.getFirstLinkpathDest?.(mediaName, basePath) as TFile | null) ??
    (app.vault.getAbstractFileByPath(mediaName) as TFile | null);
  if (!file || (file as any).children) return ''; // 目录不是媒体文件
  try {
    return app.vault.getResourcePath(file as TFile);
  } catch {
    return ''; // 资源路径解析失败（异常/mock 环境）安全降级
  }
}
