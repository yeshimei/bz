/**
 * 收藏本配置（ticket 11）：源码 收藏本.js L12-25 逐字。
 */
export const CONFIG = {
  /** 默认存储目录（文件名固定 favorites.json，设置只允许改目录） */
  DEFAULT_STORAGE_PATH: 'CONFIG/STORAGE',
  /** 数据文件名（固定，不允许用户修改） */
  STORAGE_FILE: 'favorites.json',
  DEFAULT_TAGS: [
    { tag: 'GitHub', emoji: '🐙' },
    { tag: '桌面软件', emoji: '💻' },
    { tag: '网站', emoji: '🌐' },
    { tag: '大模型', emoji: '🧠' },
    { tag: 'pi', emoji: '⌨️' },
    { tag: 'Claude', emoji: '🤖' },
    { tag: 'skills', emoji: '⚡' },
    { tag: '酒馆', emoji: '🍺' },
    { tag: 'DeepSeek Harness', emoji: '🐋' },
  ],
  LONG_PRESS_DELAY: 600,
};

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
