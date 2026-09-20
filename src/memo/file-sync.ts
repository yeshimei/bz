/**
 * 备忘录域文件同步（memo.json 引用同步；ADR-0092 自旧 memo 域迁入）：
 *   rename → 同步引用路径/标题/notePath（memo.json）
 *   delete → 清空关联（linkedNote + notePath/notePosition）
 * 队列/去抖/批量冲刷/事件订阅/生命周期收编至公共壳 core/file-sync（issue 347），
 * 域侧只留同步纯函数、监听范围与装配；rename 经域事件总线 'vault:md-renamed'
 * 按 DEBOUNCE_DELAY 合并去抖回放保序，delete 走 'vault:md-deleted' 即时通道
 * （obsidian-adapter 恒发、仅 md，载荷见 src/core/obsidian-adapter.ts）。
 */
import { stripMdExt } from '../core/utils';
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import { SYNC_WATCHED_FOLDERS } from '../core/settings-common';
import { createFileSync, type FileSyncRenameEvent } from '../core/file-sync';
import { purgeStaleFields } from './data';

// ---------- 同步纯函数（域内私有） ----------

interface SyncItem {
  linkedNote?: string | null;
  title?: string;
  notePath?: string | null;
  [key: string]: any;
}

/** memo rename 事件：基础路径对 + 标题联动字段 */
interface MemoRenameEvent extends FileSyncRenameEvent {
  oldTitle: string;
  newTitle: string;
}

/** 笔记重命名：同步引用路径 / 标题 / notePath。
 *  E21：标题联动只对「本条引用了该笔记」（notePath/linkedNote 命中）的条目生效——
 *  此前按「标题 === 旧文件名」盲改，内容恰好与文件同名的无关条目标题被悄悄改掉。 */
function syncRename(items: SyncItem[], { oldPath, newPath, oldTitle, newTitle }: MemoRenameEvent): boolean {
  let changed = false;
  for (const item of items) {
    const linkedHit = item.linkedNote === oldPath;
    const noteHit = item.notePath === oldPath;
    if (linkedHit) { item.linkedNote = newPath; changed = true; }
    if (noteHit) { item.notePath = newPath; changed = true; }
    if ((linkedHit || noteHit) && item.title === oldTitle) { item.title = newTitle; changed = true; }
  }
  return changed;
}

/**
 * 笔记删除：清空关联。
 *
 * 同时清 `linkedNote` 与 `notePath`/`notePosition`——**与 syncRename 的口径对齐**。
 * 此前只清 linkedNote，但当前域从不写非空 linkedNote（新建/编辑器一律置 null，
 * 见 ui.ts 的 addFromComposer/openEditor），真正在用的是 notePath（编辑器「定位到笔记」写的）：
 * 于是删掉笔记后条目仍留着指向不存在文件的 notePath，卡片 meta 继续渲染「位置」tag
 * （render.ts 的 data-memo-pos），点它 = jumpToNote 跳一个已删文件。
 * rename 分支本就同步改 notePath，删除分支只清一半属实现遗漏（两分支口径不对称）。
 */
function syncDelete(items: SyncItem[], path: string): boolean {
  let changed = false;
  for (const item of items) {
    if (item.linkedNote === path) { item.linkedNote = null; changed = true; }
    if (item.notePath === path) {
      item.notePath = null;
      item.notePosition = null;
      changed = true;
    }
  }
  return changed;
}

// ---------- 路径 / 设置 ----------

/** 备忘录数据文件路径（ADR-0009 共享数据路径） */
function getMemoPath(): string {
  return storageFile('memo.json', tryGetSettings().storagePath || 'CONFIG/STORAGE');
}

/** 监听文件夹列表（issue 187：原 aiAgentWatchedFolders 键退役，固定默认范围） */
function getWatchedFolders(): string[] {
  return SYNC_WATCHED_FOLDERS.split(',').map((x) => x.trim()).filter(Boolean);
}

// ---------- 壳装配（issue 347：队列/去抖/订阅/生命周期走 core/file-sync） ----------

const agent = createFileSync<SyncItem[], MemoRenameEvent>({
  logTag: '[memo-file-sync]',
  failNotice: '备忘录同步失败，数据可能不一致',
  failDedupeKey: 'memo-file-sync',
  watchedFolders: getWatchedFolders,
  /** 对 memo.json 执行同步改写，有变化才写回。读改写整体入 per-path 串行队列：
   *  与 memo UI 的 CRUD 同队列互斥，后台同步不得用陈旧基线覆盖面板刚写入的数据（写竞态收敛）。 */
  commit: async (apply) => {
    const path = getMemoPath();
    await enqueueFileTask(path, async () => {
      const items = await jsonFileStore<any[]>(path).read();
      // 直写绕过 MemoData.write，残留 recur/checklist 同样消毒（见 data.ts purgeStaleFields 注）
      if (apply(items)) await jsonFileStore<any[]>(path).write(purgeStaleFields(items));
    });
  },
  /** E22：范围外笔记只要被 memo.json 实际引用（notePath/linkedNote 命中）也放行同步——
   *  notePath 可指向任意笔记（编辑器「定位到笔记」），监听范围只覆盖两个目录时，
   *  范围外笔记 rename/delete 引用不同步（卡片「位置」tag 跳不存在的文件）。 */
  referencedBy: async (path) => {
    if (!path) return false;
    try {
      const items = (await jsonFileStore<any[]>(getMemoPath()).read()) as SyncItem[];
      return items.some((it) => it?.linkedNote === path || it?.notePath === path);
    } catch (e) {
      return false;
    }
  },
  /** 标题联动载荷：oldTitle 自旧路径文件名提取，newTitle 即新路径 basename */
  buildRenameEvent: (evt, newBasename) => ({
    oldPath: evt.oldPath,
    newPath: evt.newPath,
    oldTitle: stripMdExt((evt.oldPath ?? '').split('/').pop() || ''),
    newTitle: newBasename,
  }),
  applyRename: syncRename,
  applyDelete: syncDelete,
});

/** 幂等初始化（memo 域总入口，main.ts onLayoutReady 调用） */
export function ensureFileSync(app: App): void {
  agent.ensure(app);
}

/** 卸载清理（壳置位 _cancelled 短路积压任务、丢弃去抖窗口内事件并退订全部监听） */
export function unloadFileSync(): void {
  agent.unload();
}
