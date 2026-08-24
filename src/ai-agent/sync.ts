/**
 * AI Agent 同步纯函数（AIAgent.js 逐字移植）
 * syncRename：重命名 → 引用路径/标题/notePath 更新
 * syncDelete：删除 → 清空 linkedNote 关联
 * syncAutoLink：创建/打开 → 同名未关联条目自动关联（仅收藏本）
 */
import type { App } from 'obsidian';

export interface SyncItem {
  linkedNote?: string | null;
  title?: string;
  notePath?: string | null;
  [key: string]: any;
}

/** 笔记重命名：同步引用路径 / 标题 / notePath */
export function syncRename(
  items: SyncItem[],
  { oldPath, newPath, oldTitle, newTitle }: { oldPath: string; newPath: string; oldTitle: string; newTitle: string }
): boolean {
  let changed = false;
  for (const item of items) {
    if (item.linkedNote === oldPath) { item.linkedNote = newPath; changed = true; }
    if (item.title === oldTitle) { item.title = newTitle; changed = true; }
    if (item.notePath === oldPath) { item.notePath = newPath; changed = true; }
  }
  return changed;
}

/** 笔记删除：清空关联 */
export function syncDelete(items: SyncItem[], path: string): boolean {
  let changed = false;
  for (const item of items) {
    if (item.linkedNote === path) { item.linkedNote = null; changed = true; }
  }
  return changed;
}

/** 打开/新建笔记：同名且未关联的条目自动关联（仅收藏本） */
export function syncAutoLink(items: SyncItem[], noteTitle: string, notePath: string): boolean {
  let changed = false;
  for (const item of items) {
    if (!item.linkedNote && item.title === noteTitle) {
      item.linkedNote = notePath;
      changed = true;
    }
  }
  return changed;
}

/** 默认监听目录（设置 aiAgentWatchedFolders 未配置时的兜底） */
export const WATCH_FOLDERS = ['卡片盒', '归档/网页剪藏'];
export const CLIP_FOLDER = '归档/网页剪藏';

/** 监听目录范围检查：路径等于目录本身或位于其下 */
export function inFolders(path: string, folders: string[]): boolean {
  return folders.some((f) => path.startsWith(f + '/') || path === f);
}

/** 默认监听目录范围检查（index.ts 实际经 inFolders + getWatchedFolders() 动态判断） */
export function inWatchedFolders(path: string): boolean {
  return inFolders(path, WATCH_FOLDERS);
}

// ---------- JSON 读写 ----------

export async function loadJSON(app: App, filePath: string): Promise<any[]> {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) return [];
  try {
    return JSON.parse(await app.vault.read(file as any));
  } catch {
    return [];
  }
}

export async function saveJSON(app: App, filePath: string, data: any): Promise<void> {
  const file = app.vault.getAbstractFileByPath(filePath);
  const json = JSON.stringify(data, null, 2);
  if (file) await app.vault.modify(file as any, json);
  else await app.vault.create(filePath, json);
}
