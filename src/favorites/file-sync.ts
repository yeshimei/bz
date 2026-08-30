/**
 * 收藏本文件同步（引用同步 + 同名自动关联）
 * 自 ai-agent（ticket 19）拆分出的 favorites 域本地实现：
 *   rename → 同步引用路径/标题/notePath（favorites.json）
 *   delete → 清空 linkedNote 关联
 *   create/file-open → 同名未关联条目自动关联
 * sync 纯函数与队列/去抖为 ai-agent 的本地私有副本（勿跨域 import，语义逐行等价）；
 * vault 三类事件经域事件总线通用兜底通道订阅（obsidian-adapter 恒发、仅 md，
 * 载荷见 src/core/obsidian-adapter.ts）；file-open 保持 workspace 原生订阅
 * （总线首期只收编 vault 事件，workspace 事件后续再迁）。
 */
import type { App } from 'obsidian';
import { notify } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { jsonFileStore } from '../core/storage';
import { getStoragePath } from './config';

// ---------- 同步纯函数（ai-agent/sync.ts 私有副本） ----------

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

/** 打开/新建笔记：同名且未关联的条目自动关联 */
function syncAutoLink(items: SyncItem[], noteTitle: string, notePath: string): boolean {
  let changed = false;
  for (const item of items) {
    if (!item.linkedNote && item.title === noteTitle) {
      item.linkedNote = notePath;
      changed = true;
    }
  }
  return changed;
}

/** 监听目录范围检查：路径等于目录本身或位于其下 */
function inFolders(path: string, folders: string[]): boolean {
  return folders.some((f) => path.startsWith(f + '/') || path === f);
}

// ---------- JSON 读写（统一数据读写层；原 ai-agent 私有副本语义已统一至 jsonFileStore） ----------

async function loadJSON(app: App, filePath: string): Promise<any[]> {
  return jsonFileStore<any[]>(filePath).read();
}

async function saveJSON(app: App, filePath: string, data: any): Promise<void> {
  await jsonFileStore<any[]>(filePath).write(data);
}

// ---------- 路径 / 设置 ----------

/** 收藏本数据文件路径（照抄旧 ai-agent/index.ts：ADR-0009 storagePath 优先，旧字段兼容兜底） */
function getFavoritesPath(): string {
  const s = tryGetSettings() as any;
  return getStoragePath(s && (s.storagePath || s.favoritesStoragePath));
}

/** 监听文件夹列表（设置 aiAgentWatchedFolders 可配，逗号分隔；默认 卡片盒,归档/网页剪藏） */
function getWatchedFolders(): string[] {
  const s = tryGetSettings() as any;
  const raw = (s && s.aiAgentWatchedFolders) || '卡片盒,归档/网页剪藏';
  return raw.split(',').map((x: string) => x.trim()).filter(Boolean);
}

// ---------- 队列 / 去抖（ai-agent/index.ts 逐行等价移植） ----------

let initialized = false;
/** 已注册订阅的退订函数集合（unload 统一调用：总线退订幂等无双清，workspace ref 包装成退订闭包防泄漏） */
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
      console.error('[favorites-file-sync]', e);
      notify('收藏本同步失败，数据可能不一致', { type: 'error', dedupeKey: 'favorites-file-sync' });
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

function createFavoritesFileSyncAgent(app: App): void {
  /** 对 favorites.json 执行同步函数，有变化才写回 */
  async function syncSource(fn: (items: any[], ...args: any[]) => boolean, ...args: any[]) {
    const path = getFavoritesPath();
    const items = await loadJSON(app, path);
    if (fn(items, ...args)) await saveJSON(app, path, items);
  }

  const isMd = (file: any) => file && file.extension === 'md' && inFolders(file.path, getWatchedFolders());

  /** 同名未关联条目自动关联（create / file-open 共用） */
  const autoLinkFavorites = async (file: any) => {
    const items = await loadJSON(app, getFavoritesPath());
    if (syncAutoLink(items, file.basename, file.path)) {
      await saveJSON(app, getFavoritesPath(), items);
    }
  };

  // rename/create 同类事件按 DEBOUNCE_DELAY 合并去抖回放保序；delete 保持即时。

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

  const flushCreates = createBatchFlusher<any>(async (batch) => {
    for (const file of batch) {
      // 同名条目自动关联
      await autoLinkFavorites(file);
    }
  });
  _flushers.push(flushCreates);
  _refs.push(onDomainEvent<{ path: string }>('vault:md-created', (evt) => {
    const file = pseudoFile(evt.path);
    if (!isMd(file)) return;
    flushCreates(file);
  }));

  const flushOpens = createBatchFlusher<any>(async (batch) => {
    const seen = new Set<string>();
    for (const file of batch) {
      if (seen.has(file.path)) continue; // 同文件连开只关联一次
      seen.add(file.path);
      await autoLinkFavorites(file);
    }
  });
  _flushers.push(flushOpens);
  // workspace.on('file-open') 保持原生订阅：域总线首期只收编 vault 事件，workspace 事件后续再迁
  const openRef = app.workspace.on('file-open', (file: any) => {
    if (!isMd(file)) return;
    flushOpens(file);
  });
  _refs.push(() => {
    try {
      (app.workspace as any).offref?.(openRef);
    } catch (e) { /* 忽略 */ }
  });
}

/** 幂等初始化（favorites 域启用时调用） */
export function ensureFavoritesFileSync(app: App): void {
  if (initialized) return;
  initialized = true;
  _cancelled = false; // 重新启用后恢复任务受理
  createFavoritesFileSyncAgent(app);
}

/** 卸载清理：置位 _cancelled 使积压任务首行短路并丢弃去抖窗口内未回放的事件，
 *  退订全部监听（总线退订幂等，重复卸载无双清风险）后重置模块状态。 */
export function unloadFavoritesFileSync(): void {
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
