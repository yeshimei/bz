/**
 * 读 Obsidian 核心插件「日记」的目录（daily notes → folder）。
 *
 * 为什么需要：bz 的日记目录缺省留空时，用户往往已经在 Obsidian 里设过「设置 → 核心插件 →
 * 日记」的文件夹。再让他在插件里填一遍是多余的，所以缺省跟随它；只有两边都没设时才引导。
 *
 * 读法（社区标准库 obsidian-daily-notes-interface 同款）：
 *   app.internalPlugins.getPluginById('daily-notes')?.instance?.options.folder
 * 同步读取、不做缓存——用户随时会在 Obsidian 设置里改，改完下次解析即生效。
 * 拿不到（插件未启用/老版本宿主/抛错）一律返回空串，调用方回落自己的缺省。
 */
import { getApp } from './app';

/** Obsidian 日记文件夹（vault 相对路径，已去首尾斜杠）；没有则空串 */
export function obsidianDailyNotesFolder(): string {
  try {
    const app = getApp() as unknown as {
      internalPlugins?: { getPluginById?: (id: string) => { instance?: { options?: { folder?: unknown } } } | null };
    };
    const plugin = app.internalPlugins?.getPluginById?.('daily-notes');
    const raw = plugin?.instance?.options?.folder;
    if (typeof raw !== 'string') return '';
    return raw.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  } catch (e) {
    return '';
  }
}
