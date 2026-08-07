/**
 * 豆瓣海报自动抓取 - 配置
 * 从 ~/.douban-posterrc 读取配置
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_PATH = path.join(os.homedir(), '.douban-posterrc');

const DEFAULTS = {
  vaultPath: '',
  movieFolder: '我的/影视',
  posterFolder: 'CONFIG/MOVIE POSTER',
};

/**
 * 加载配置。如果配置文件不存在，返回默认值并提示。
 */
export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { ...DEFAULTS, _missing: true };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const user = JSON.parse(raw);
    return { ...DEFAULTS, ...user };
  } catch (err) {
    console.error(`[配置] 读取 ${CONFIG_PATH} 失败: ${err.message}`);
    return { ...DEFAULTS, _missing: true };
  }
}

/**
 * 检查配置是否有效，无效时打印提示并返回 false
 */
export function ensureConfig(config) {
  if (config._missing || !config.vaultPath) {
    console.error(`[配置] 请先创建配置文件: ${CONFIG_PATH}`);
    console.error(`[配置] 内容示例:`);
    console.error(JSON.stringify({
      vaultPath: 'E:/Obsidian/你的vault名',
      movieFolder: '我的/影视',
      posterFolder: 'CONFIG/MOVIE POSTER',
    }, null, 2));
    return false;
  }
  return true;
}

export { CONFIG_PATH };
