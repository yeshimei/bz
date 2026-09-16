/**
 * 知识盒域文件同步（issue 336 / ADR-0149 决策 4）：knowledge.json 路径引用同步 + 卡片
 * source 断链摘除消费（摘除编排在 source-retire.ts，本模块负责事件接线）。
 *   rename → 同步任务 notePath/videoPath（knowledge.json）
 *   delete → notePath/videoPath 置空（UI 对空路径全部有守卫：渲染行条件跳过、打开钮不挂）
 *           + source-retire 消费体（摘除指向被删文件的卡片 source 行）
 * sync 纯函数与队列/去抖为域内私有副本（勿跨域 import，同 memo/file-sync 范式）；
 * rename 经域事件总线 'vault:md-renamed' 按 DEBOUNCE_DELAY 合并去抖回放保序，
 * delete 走 'vault:md-deleted' 即时通道（obsidian-adapter 恒发、仅 md）。
 */
import { stripMdExt } from '../core/utils';
import type { App } from 'obsidian';
import { notify } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { enqueueFileTask, storageFile } from '../core/storage';
import { KnowledgeData } from './data';
import { knowledgeDirOf, retireSourcesOnMdDeleted } from './source-retire';

// ---------- 同步纯函数（域内私有副本） ----------

interface SyncTask {
  notePath?: string | null;
  videoPath?: string | null;
  [key: string]: any;
}

/** 笔记重命名：同步任务引用路径（notePath=生成的文献笔记；videoPath=交付视频，口径同键防遗漏） */
function syncRename(
  tasks: SyncTask[],
  { oldPath, newPath }: { oldPath: string; newPath: string }
): boolean {
  let changed = false;
  for (const task of tasks) {
    if (task?.notePath === oldPath) { task.notePath = newPath; changed = true; }
    if (task?.videoPath === oldPath) { task.videoPath = newPath; changed = true; }
  }
  return changed;
}

/** 笔记删除：引用置空（最小惊讶——任务历史保留，仅路径引用清掉；UI 空路径守卫齐全） */
function syncDelete(tasks: SyncTask[], path: string): boolean {
  let changed = false;
  for (const task of tasks) {
    if (task?.notePath === path) { task.notePath = null; changed = true; }
    if (task?.videoPath === path) { task.videoPath = null; changed = true; }
  }
  return changed;
}

/** 监听目录范围检查：路径等于目录本身或位于其下（同 memo/file-sync 口径） */
function inFolders(path: string, folders: string[]): boolean {
  return folders.some((f) => path.startsWith(f + '/') || path === f);
}

// ---------- knowledge.json 读写（复用 KnowledgeData 读写层；队列键与其 CRUD 同一路径） ----------

/** knowledge.json 路径（与 KnowledgeData.init 的拼接口径一致，保证 per-path 队列键相同） */
function getKnowledgePath(): string {
  if (KnowledgeData.filePath) return KnowledgeData.filePath;
  return storageFile('knowledge.json', tryGetSettings().storagePath || 'CONFIG/STORAGE');
}

/** 对 knowledge.json 执行同步函数，有变化才写回（读改写整体入 per-path 串行队列，
 *  与任务 CRUD（_mutate 同队列）互斥，后台同步不得用陈旧基线覆盖面板刚写入的数据） */
async function syncTasks(fn: (tasks: SyncTask[], ...args: any[]) => boolean, ...args: any[]) {
  const path = getKnowledgePath();
  await enqueueFileTask(path, async () => {
    const tasks = (await KnowledgeData.read()) as SyncTask[];
    if (fn(tasks, ...args)) await KnowledgeData.write(tasks);
  });
}

// ---------- 路径 / 设置 / 范围 ----------

function getWatchedFolders(): string[] {
  return [knowledgeDirOf()];
}

// ---------- 队列 / 去抖（memo/file-sync 逐行等价移植） ----------

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
      console.error('[knowledge-file-sync]', e);
      notify('知识盒同步失败，数据可能不一致', { type: 'error', dedupeKey: 'knowledge-file-sync' });
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
  /** knowledge.json 引用命中检查（范围外放行口径，同 memo E22） */
  const referencedByTasks = async (path: string): Promise<boolean> => {
    if (!path) return false;
    try {
      const tasks = (await KnowledgeData.read()) as SyncTask[];
      return tasks.some((t) => t?.notePath === path || t?.videoPath === path);
    } catch (e) {
      return false;
    }
  };

  const isMd = (file: any) => file && file.extension === 'md' && inFolders(file.path, getWatchedFolders());

  /** 总线载荷 → 现有闭包期望的伪 TFile 形状（{path, basename, extension:'md'}，rename 另附 oldPath） */
  const pseudoFile = (path: string): any => ({
    path,
    basename: stripMdExt(path.split('/').pop() || ''),
    extension: 'md',
  });

  const flushRenames = createBatchFlusher<any>(async (batch) => {
    for (const ev of batch) {
      await syncTasks(syncRename, ev);
    }
  });
  _flushers.push(flushRenames);
  _refs.push(onDomainEvent<{ oldPath: string; newPath: string }>('vault:md-renamed', (evt) => {
    const file = pseudoFile(evt.newPath);
    // 范围外放行看新旧两条路径（改名移出/移入监听范围都算被引用）
    void (async () => {
      if (!(isMd(file) || (await referencedByTasks(evt.oldPath)) || (await referencedByTasks(evt.newPath)))) return;
      flushRenames({ oldPath: evt.oldPath, newPath: evt.newPath });
    })();
  }));

  _refs.push(onDomainEvent<{ path: string }>('vault:md-deleted', (evt) => {
    const file = pseudoFile(evt.path);
    void (async () => {
      // 范围外但被 knowledge.json 引用的笔记删除同样要清引用
      if (isMd(file) || (await referencedByTasks(evt.path))) {
        enqueue(() => syncTasks(syncDelete, evt.path));
      }
      // source 退役消费者（ADR-0149 决策 2）：卡片 source 可指向任意笔记（不限目录），
      // 任何被删 md 都过一遍 metadataCache 预筛；已降级卡片天然幂等跳过
      await retireSourcesOnMdDeleted(app, evt.path);
    })();
  }));
}

/** 幂等初始化（main.ts onLayoutReady 常驻接线；ADR-0003 同款幂等） */
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
