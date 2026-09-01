/**
 * 回忆墙（diary-wall）域数据层
 * 读取 `我的/日记/YYYY-MM-DD.md` 日记文件，解析出带媒体的条目列表。
 * 数据格式冻结：每文件多条目，`# emoji序列 HH:mm` 标题行为条目边界（复用 src/diary/parser.ts，旧域不修改）。
 * 依赖方向（ADR-0002）：core ← config/state ← parser ← store ← ui ← main；本文件不碰 DOM，App 一律参数注入。
 * 媒体 URL 走 vault API（getResourcePath / getFirstLinkpathDest）：原型里硬编码 file:// 路径在 vault 内不可播放，
 * 必须经 Obsidian 资源路径才能被 img/video/audio 加载。
 */
import type { App, TFile } from 'obsidian';
import { parseFile } from '../diary/parser';
import type { DiaryEntry } from '../diary/types';

/** 媒体文件（从正文 `![[...]]` 内链提取） */
export interface WallMedia {
  /** 引用名：纯文件名或完整引用路径（不含 `|参数` 后缀） */
  name: string;
  /** 按扩展名判定的媒体类型 */
  kind: 'img' | 'video' | 'audio';
}

/** 回忆墙条目 = 日记条目核心字段 + 媒体列表（content 保留原文，media 由内容提取） */
export interface WallEntry extends Pick<DiaryEntry, 'date' | 'time' | 'tags' | 'emoji' | 'content'> {
  media: WallMedia[];
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

/**
 * 从正文提取 `![[文件名.扩展名]]` / `![[路径/文件名.扩展名]]` 媒体引用（Obsidian 内链语法）。
 * - 只提取图片/视频/音频扩展名，忽略 `.md` 等非媒体内链；
 * - 支持 `![[xxx.jpg|400]]` 尺寸参数（去掉 `|...` 后缀）；
 * - 支持带路径引用（保留完整引用路径，media.name 即引用原文）；
 * - 去重：同一引用只保留首次出现。
 * vaultDir：媒体归属目录（loadWallEntries 传入日记目录），为「按目录过滤媒体」预留的解析基目录；
 * 当前提取阶段不改变引用原文——Obsidian 链接是全局解析，拼接目录会破坏 getFirstLinkpathDest 解析。
 */
export function extractMedia(content: string, vaultDir: string): WallMedia[] {
  void vaultDir; // 预留参数：目录过滤语义待 UI 联调确定，接口先行稳定
  const seen = new Set<string>();
  const media: WallMedia[] = [];
  const re = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
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

/**
 * 读取 diaryDir 下所有 `YYYY-MM-DD.md` 日记文件，解析出带媒体的条目列表。
 * - 日期从文件名取（YYYY-MM-DD），非该格式（或非法日期）的文件跳过；
 * - 逐文件 vault.read → parseFile → 对每条内容 extractMedia（content 保留原文）；
 * - 排序：日期降序、同日时间降序（HH:mm 字典序与数值序一致）。
 */
export async function loadWallEntries(app: App, diaryDir: string): Promise<WallEntry[]> {
  const vault = app.vault;
  const mdPaths = await collectMdPaths(app, diaryDir);

  const mdFiles: TFile[] = [];
  for (const p of mdPaths) {
    const f = vault.getAbstractFileByPath(p);
    if (f && !(f as any).children && (f as TFile).extension === 'md') mdFiles.push(f as TFile);
  }

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
        return parseFile(content, dateStr).map((e) => ({
          date: e.date,
          time: e.time,
          tags: e.tags,
          emoji: e.emoji,
          content: e.content,
          media: extractMedia(e.content, diaryDir),
        }));
      })
    );
    for (const r of batchResults) entries.push(...r);
  }

  // 排序：日期降序、时间降序
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
 * 优先 Obsidian 链接解析（getFirstLinkpathDest，纯文件名引用全局解析），带路径引用回退
 * getAbstractFileByPath；找不到（或命中目录）返回 ''。
 */
export function mediaSrc(app: App, mediaName: string): string {
  if (!mediaName) return '';
  const file =
    (app.metadataCache?.getFirstLinkpathDest?.(mediaName, '') as TFile | null) ??
    (app.vault.getAbstractFileByPath(mediaName) as TFile | null);
  if (!file || (file as any).children) return ''; // 目录不是媒体文件
  try {
    return app.vault.getResourcePath(file as TFile);
  } catch {
    return ''; // 资源路径解析失败（异常/mock 环境）安全降级
  }
}
