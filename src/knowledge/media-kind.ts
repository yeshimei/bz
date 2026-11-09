/**
 * 本机音视频文件的类型判定（ADR-0296：知识盒「影像」录入的本地导入）。
 *
 * 只认扩展名，不读文件头——选文件的人比文件内容更可信，判错的代价也只是笔记标签写错。
 * 扩展名表是**白名单**：不在表里的文件在选择器里就挑不出来，选中后仍会再校验一次
 * （用户可能在对话框里手打文件名，或拖进一个改了后缀的文件）。
 */

/** 本机媒体类型（= 文献笔记 type / 任务 mediaKind 的取值域） */
export type LocalMediaKind = 'video' | 'audio';

/** 视频扩展名（不含点，小写）——覆盖 B 站之外常见容器 */
const VIDEO_EXTS = new Set([
  'mp4', 'm4v', 'mkv', 'mov', 'webm', 'flv', 'avi', 'ts', 'mts', 'm2ts', 'wmv', 'mpg', 'mpeg', '3gp', 'ogv',
]);

/** 音声扩展名（不含点，小写）——播客/录音/无损都收 */
const AUDIO_EXTS = new Set([
  'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga', 'opus', 'wma', 'ape', 'amr', 'aiff', 'aif', 'wv',
]);

/** 媒体类型 → 界面标签（与文献类型徽标同源：影像 / 音声） */
export const MEDIA_KIND_LABEL: Record<LocalMediaKind, string> = { video: '影像', audio: '音声' };

/** 路径/文件名 → 小写扩展名（无扩展名 → 空串） */
export function mediaExtOf(pathOrName: string): string {
  const s = String(pathOrName ?? '').replace(/\\/g, '/');
  const base = s.slice(s.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** 路径/文件名 → 媒体类型；不认识 → null（调用方据此拒绝导入并说清楚） */
export function mediaKindOf(pathOrName: string): LocalMediaKind | null {
  const ext = mediaExtOf(pathOrName);
  if (!ext) return null;
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  return null;
}

/** 文件名去扩展名（本地任务的缺省标题；空文件名 → 空串） */
export function mediaTitleOf(pathOrName: string): string {
  const s = String(pathOrName ?? '').replace(/\\/g, '/');
  const base = s.slice(s.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return (dot > 0 ? base.slice(0, dot) : base).trim();
}

/** 系统文件选择器的过滤器（`core/path-picker` 的 PickFilesFilter 形状，不 import 避免域→core 类型耦合） */
export const LOCAL_MEDIA_FILTERS: Array<{ name: string; ext: string[] }> = [
  { name: '视频与音声', ext: [...VIDEO_EXTS, ...AUDIO_EXTS] },
  { name: '视频', ext: [...VIDEO_EXTS] },
  { name: '音声', ext: [...AUDIO_EXTS] },
];
