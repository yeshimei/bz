/**
 * 待办域文件同步（memo.json 引用同步；ADR-0092 自旧 memo 域迁入，语义逐行等价）
 *   rename → 同步引用路径/标题/notePath（memo.json）
 *   delete → 清空 linkedNote 关联
 * sync 纯函数与队列/去抖为域内私有副本（勿跨域 import）；
 * rename 经域事件总线 'vault:md-renamed' 按 DEBOUNCE_DELAY 合并去抖回放保序，
 * delete 走 'vault:md-deleted' 即时通道（obsidian-adapter 恒发、仅 md，
 * 载荷见 src/core/obsidian-adapter.ts）。
 */
import type { App } from 'obsidian';
import { notify } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import { SYNC_WATCHED_FOLDERS } from '../core/settings-common';

// ---------- 同步纯函数（域内私有副本） ----------

interface SyncItem {
  linkedNote?: string | null;
  title?: string;
  notePath?: string | null;
  [key: string]: any;
}

/** 笔记重命名：同步引用路径 / 标题 / notePath */
function syncRename(
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
function syncDelete(items: SyncItem[], path: string): boolean {
  let changed = false;
  for (const item of items) {
    if (item.linkedNote === path) { item.linkedNote = null; changed = true; }
  }
  return changed;
}

/** 监听目录范围检查：路径等于目录本身或位于其下 */
function inFolders(path: string, folders: string[]): boolean {
  return folders.some((f) => path.startsWith(f + '/') || path === f);
}

// ---------- JSON 读写（统一数据读写层；原 ai-agent 私有副本语义已统一至 jsonFileStore） ----------

/** 读取 memo.json（jsonFileStore 语义：缺失建文件返回 []，损坏改名留档重建） */
async function loadJSON(app: App, filePath: string): Promise<any[]> {
  return jsonFileStore<any[]>(filePath).read();
}

async function saveJSON(app: App, filePath: string, data: any): Promise<void> {
  await jsonFileStore<any[]>(filePath).write(data);
}

// ---------- 路径 / 设置 ----------

/** 备忘录数据文件路径（ADR-0009 共享数据路径） */
function getMemoPath(): string {
  const s = tryGetSettings() as any;
  return storageFile('memo.json', (s && s.storagePath) || 'CONFIG/STORAGE');
}

/** 监听文件夹列表（issue 187：原 aiAgentWatchedFolders 键退役，固定默认范围） */
function getWatchedFolders(): string[] {
  return SYNC_WATCHED_FOLDERS.split(',').map((x) => x.trim()).filter(Boolean);
}

// ---------- 队列 / 去抖（ai-agent/index.ts 逐行等价移植） ----------

let initialized = false;
/** 已注册订阅的退订函数集合（unload 统一调用：总线退订幂等无双清） */
let _refs: (() => void)[] = [];
/** 卸载标志：置位后积压任务首行短路、去抖窗口内事件直接丢弃 */
let _cancelled = false;
/** 待清理的去抖器（unload 时清定时器） */
let _flushers: { cancel(): void }[] = [];

/** 任务队列：串行执行（防并发读写同一 JSON）；失败通知（去重防刷屏）。
 *  任务执行前检查 _cancelled，卸载后积压任务首行短路。 */
let queue: Promise<any> = Promise.resolve();
function enqueue(task: () => Promise<any> | void) {
  queue = queue
    .then(() => {
      if (_cancelled) return;
      return task();
    })
    .catch((e) => {
      console.error('[todo-file-sync]', e);
      notify('待办同步失败，数据可能不一致', { type: 'error', dedupeKey: 'todo-file-sync' });
    });
}

/** 去抖延迟：复用既有 DEBOUNCE_DELAY 设置（字符串毫秒，缺省 300） */
function debounceDelay(): number {
  const s: any = tryGetSettings();
  return Number(s && s.DEBOUNCE_DELAY) || 300;
}

/** 同类事件合并去抖：DEBOUNCE_DELAY 窗口内同型事件收集成批，静默期后作为单个
 *  队列任务按序回放——既削队列峰值，又保留 rename 链（A→B→C）等顺序语义。 */
function createBatchFlusher<T>(run: (batch: T[]) => Promise<void>): ((ev: T) => void) & { cancel(): void } {
  let pending: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (_cancelled) {
      pending = [];
      return;
    }
    const batch = pending;
    pending = [];
    enqueue(() => run(batch));
  };
  const push = (ev: T): void => {
    if (_cancelled) return;
    pending.push(ev);
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceDelay());
  };
  return Object.assign(push, {
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pending = [];
    },
  });
}

// ---------- 事件编排 ----------

function createFileSyncAgent(app: App): void {
  /** 对 memo.json 执行同步函数，有变化才写回。
   *  读改写整体入 per-path 串行队列：与 memo UI / todo UI 的 CRUD 同队列互斥，
   *  后台同步不得用陈旧基线覆盖面板刚写入的数据（写竞态收敛）。 */
  async function syncSource(fn: (items: any[], ...args: any[]) => boolean, ...args: any[]) {
    const path = getMemoPath();
    await enqueueFileTask(path, async () => {
      const items = await loadJSON(app, path);
      if (fn(items, ...args)) await saveJSON(app, path, items);
    });
  }

  const isMd = (file: any) => file && file.extension === 'md' && inFolders(file.path, getWatchedFolders());

  // rename 同类事件按 DEBOUNCE_DELAY 合并去抖回放保序；delete 保持即时。

  /** 总线载荷 → 现有闭包期望的伪 TFile 形状（{path, basename, extension:'md'}，rename 另附 oldPath） */
  const pseudoFile = (path: string): any => ({
    path,
    basename: (path.split('/').pop() || '').replace(/\.md$/, ''),
    extension: 'md',
  });

  const flushRenames = createBatchFlusher<any>(async (batch) => {
    for (const ev of batch) {
      await syncSource(syncRename, ev);
    }
  });
  _flushers.push(flushRenames);
  _refs.push(onDomainEvent<{ oldPath: string; newPath: string }>('vault:md-renamed', (evt) => {
    const file = pseudoFile(evt.newPath);
    if (!isMd(file)) return;
    const oldTitle = (evt.oldPath ?? '').split('/').pop()!.replace(/\.md$/, '');
    flushRenames({
      oldPath: evt.oldPath,
      newPath: evt.newPath,
      oldTitle,
      newTitle: file.basename,
    });
  }));

  _refs.push(onDomainEvent<{ path: string }>('vault:md-deleted', (evt) => {
    const file = pseudoFile(evt.path);
    if (!isMd(file)) return;
    enqueue(() => syncSource(syncDelete, evt.path));
  }));
}

/** 幂等初始化（todo 域总入口，main.ts onLayoutReady 调用） */
export function ensureFileSync(app: App): void {
  if (initialized) return;
  initialized = true;
  _cancelled = false; // 重新启用后恢复任务受理
  createFileSyncAgent(app);
}

/** 卸载清理：置位 _cancelled 使积压任务首行短路并丢弃去抖窗口内未回放的事件，
 *  退订全部监听（总线退订幂等，重复卸载无双清风险）后重置模块状态。 */
export function unloadFileSync(): void {
  _cancelled = true;
  for (const f of _flushers) {
    try {
      f.cancel();
    } catch (e) { /* 忽略 */ }
  }
  _flushers = [];
  for (const off of _refs) {
    try {
      off();
    } catch (e) { /* 忽略 */ }
  }
  _refs = [];
  initialized = false;
  queue = Promise.resolve();
}
