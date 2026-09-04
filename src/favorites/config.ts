/**
 * 收藏本配置（ticket 11 移植 + ticket 177 重构）：源码 收藏本.js L12-25。
 * 9 类固定标签（顺序即 UI 顺序）：数据 tags[] 存 label（如 'GitHub'），key 为稳定标识。
 * 归档冷存（ADR-0074）为数据层字段扩展，见 types.ts。
 */
export const CONFIG = {
  /** 默认存储目录（文件名固定 favorites.json，设置只允许改目录） */
  DEFAULT_STORAGE_PATH: 'CONFIG/STORAGE',
  /** 数据文件名（固定，不允许用户修改） */
  STORAGE_FILE: 'favorites.json',
  LONG_PRESS_DELAY: 600, // 兼容导出（长按延时实际由 core/item-actions 内部处理）
};

/** 标签定义（key 稳定；label 即数据本体 tags[] 存的值；emoji 属数据展示保留） */
export interface FavTag {
  key: string;
  label: string;
  emoji: string;
}

export const TAGS: FavTag[] = [
  { key: 'github', label: 'GitHub', emoji: '🐙' },
  { key: 'software', label: '桌面软件', emoji: '💻' },
  { key: 'web', label: '网站', emoji: '🌐' },
  { key: 'ai', label: '大模型', emoji: '🧠' },
  { key: 'pi', label: 'pi', emoji: '⌨️' },
  { key: 'claude', label: 'Claude', emoji: '🤖' },
  { key: 'skills', label: 'skills', emoji: '⚡' },
  { key: 'tavern', label: '酒馆', emoji: '🍺' },
  { key: 'harness', label: 'DeepSeek Harness', emoji: '🐋' },
];

/** 旧命名兼容导出（结构由 {tag,emoji} 升级为带 key） */
export const DEFAULT_TAGS: { tag: string; emoji: string }[] = TAGS.map((t) => ({ tag: t.label, emoji: t.emoji }));

/** label → 标签定义（数据里 tags[] 存 label） */
export function tagOf(label: string): FavTag | undefined {
  return TAGS.find((t) => t.label === label);
}
/** label → 稳定 key（未知回退原串） */
export function tagKeyOf(label: string): string {
  return tagOf(label)?.key ?? label;
}
/** key 或 label → label（图标/筛选用） */
export function tagLabel(keyOrLabel: string): string {
  return TAGS.find((t) => t.key === keyOrLabel)?.label ?? keyOrLabel;
}
/** key 或 label → emoji（无匹配返回空） */
export function tagEmoji(keyOrLabel: string): string {
  const label = tagLabel(keyOrLabel);
  return tagOf(label)?.emoji ?? '';
}

/**
 * 归一化存储目录：设置只允许填目录；兼容旧值（旧设置可能存了完整文件路径，
 * 以 .json 结尾时取其所在目录）。
 */
export function getStorageDir(value?: string): string {
  let dir = (value || CONFIG.DEFAULT_STORAGE_PATH).trim().replace(/\/+$/, '');
  if (/\.json$/i.test(dir)) {
    const idx = dir.lastIndexOf('/');
    dir = idx >= 0 ? dir.slice(0, idx) : '';
  }
  return dir || CONFIG.DEFAULT_STORAGE_PATH;
}

/** 完整数据文件路径（目录 + 固定文件名） */
export function getStoragePath(value?: string): string {
  return getStorageDir(value) + '/' + CONFIG.STORAGE_FILE;
}

/** 域名（排序/小字展示用）：解析失败原样返回 */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return (url || '').slice(0, 24);
  }
}

/** 补协议头（无 http(s) 前缀时补 https://） */
export function normalizeUrl(url: string): string {
  const u = (url || '').trim();
  return /^https?:\/\//i.test(u) ? u : 'https://' + u;
}

/** URL 形态判定（ticket 188 贴链自动搬家）：无空白的 http(s):// 或 www. 开头串 */
export function isUrlLike(text: string): boolean {
  const t = (text || '').trim();
  return t.length > 0 && !/\s/.test(t) && (/^https?:\/\//i.test(t) || /^www\./i.test(t));
}
