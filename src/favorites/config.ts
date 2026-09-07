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
};

/** 标签定义（key 稳定；label 即数据本体 tags[] 存的值；ic 为 Obsidian 内置 lucide 图标名） */
export interface FavTag {
  key: string;
  label: string;
  ic: string;
}

export const TAGS: FavTag[] = [
  { key: 'github', label: 'GitHub', ic: 'github' },
  { key: 'software', label: '桌面软件', ic: 'app-window' },
  { key: 'web', label: '网站', ic: 'globe' },
  { key: 'ai', label: '大模型', ic: 'brain-circuit' },
  { key: 'pi', label: 'pi', ic: 'keyboard' },
  { key: 'claude', label: 'Claude', ic: 'bot' },
  { key: 'skills', label: 'skills', ic: 'zap' },
  { key: 'tavern', label: '酒馆', ic: 'beer' },
  { key: 'harness', label: 'DeepSeek Harness', ic: 'waypoints' },
];



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
