/**
 * 读 Obsidian 核心插件「日记」的两件事：**新日记落在哪个文件夹**、**文件名用哪种日期格式**。
 *
 * 为什么需要：bz 的日记目录缺省留空时，用户往往已经在 Obsidian 里设过日记位置与日期格式。
 * 再让他在插件里填一遍是多余的，所以缺省跟随它；只有两边都没设时才引导。day 存储格式的
 * 文件名也要跟 Obsidian 一致（`2026-06-13.md` / `2026/06/13.md` / `2026.06.13.md`…），
 * 否则同一个「今天的日记」会被两个插件写成两个文件。
 *
 * 目录（与 Obsidian 自己 `getDailyNote` 同序，2026-11-05）：
 *   1. 日记插件设置里的 `options.folder`（「新日记的存放位置」指定文件夹时非空）；
 *   2. 否则看 Obsidian 全局「新笔记的存放位置」（`vault.getConfig('newFileLocation')`）：
 *      `'folder'` → `newFileFolderPath`；`'root'` / `'current'` / 缺失 → 库根（返回空串）。
 *   3. 都拿不到 → 空串（folderState 按「未配置」走引导；运行时内部另有「我的/日记」兜底，
 *      写入口由引导闸挡住，用户看不到那层兜底）。
 *
 * 读法（社区标准库 obsidian-daily-notes-interface 同款）：
 *   app.internalPlugins.getPluginById('daily-notes')?.instance?.options.{folder,format}
 * 同步读取、不做缓存——用户随时会在 Obsidian 设置里改，改完下次解析即生效。
 * 拿不到（插件未启用/老版本宿主/抛错）一律回落 Obsidian 的缺省值。
 */
import { getApp } from './app';

/** Obsidian 日记缺省日期格式（与核心插件内置缺省一致） */
export const OBSIDIAN_DAILY_NOTES_DEFAULT_FORMAT = 'YYYY-MM-DD';

interface DailyNotesOptions {
  folder?: unknown;
  format?: unknown;
}

/** 取日记核心插件的 options；未启用 / 老宿主 / 抛错 → null */
function dailyNotesOptions(): DailyNotesOptions | null {
  try {
    const app = getApp() as unknown as {
      internalPlugins?: {
        getPluginById?: (id: string) => { instance?: { options?: DailyNotesOptions } } | null;
      };
    };
    const plugin = app.internalPlugins?.getPluginById?.('daily-notes');
    const options = plugin?.instance?.options;
    return options && typeof options === 'object' ? options : null;
  } catch (e) {
    return null;
  }
}

/** vault 相对目录归一：trim + 反斜杠转正斜杠 + 去首尾斜杠；非字符串 → 空串 */
function cleanVaultDir(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

/**
 * Obsidian 全局「新笔记的存放位置」里指定的文件夹；没设成「指定文件夹」→ 空串（= 库根）。
 * 日记插件自己的 folder 为空时，Obsidian 就是用这个全局设置决定新日记落点的。
 */
function globalNewFileFolder(): string {
  try {
    const vault = (getApp() as unknown as { vault?: { getConfig?: (key: string) => unknown } }).vault;
    if (vault?.getConfig?.('newFileLocation') !== 'folder') return '';
    return cleanVaultDir(vault.getConfig?.('newFileFolderPath'));
  } catch (e) {
    return '';
  }
}

/** Obsidian 日记文件夹（vault 相对路径，已去首尾斜杠）；没有则空串 */
export function obsidianDailyNotesFolder(): string {
  const folder = cleanVaultDir(dailyNotesOptions()?.folder);
  if (folder) return folder;
  return globalNewFileFolder();
}

/** Obsidian 日记日期格式（moment 格式串）；没设 / 空串 → `YYYY-MM-DD` */
export function obsidianDailyNotesFormat(): string {
  const raw = dailyNotesOptions()?.format;
  if (typeof raw !== 'string') return OBSIDIAN_DAILY_NOTES_DEFAULT_FORMAT;
  const fmt = raw.trim();
  return fmt || OBSIDIAN_DAILY_NOTES_DEFAULT_FORMAT;
}
