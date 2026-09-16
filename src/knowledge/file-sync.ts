/**
 * 知识盒域文件同步（issue 336 / ADR-0149 决策 4）：knowledge.json 路径引用同步 + 卡片
 * source 断链摘除消费（摘除编排在 source-retire.ts，本模块负责事件接线）。
 *   rename → 同步任务 notePath/videoPath（knowledge.json）
 *   delete → notePath/videoPath 置空（UI 对空路径全部有守卫：渲染行条件跳过、打开钮不挂）
 *           + source-retire 消费体（摘除指向被删文件的卡片 source 行）
 * 队列/去抖/批量冲刷/事件订阅/生命周期收编至公共壳 core/file-sync（issue 365），
 * 域侧只留同步纯函数、监听范围与装配；rename 经域事件总线 'vault:md-renamed'
 * 按 DEBOUNCE_DELAY 合并去抖回放保序，delete 走 'vault:md-deleted' 即时通道
 * （obsidian-adapter 恒发、仅 md）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { enqueueFileTask, storageFile } from '../core/storage';
import { createFileSync } from '../core/file-sync';
import { KnowledgeData } from './data';
import { knowledgeDirOf, retireSourcesOnMdDeleted } from './source-retire';

// ---------- 同步纯函数（域内私有） ----------

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

// ---------- knowledge.json 读写（复用 KnowledgeData 读写层；队列键与其 CRUD 同一路径） ----------

/** knowledge.json 路径（与 KnowledgeData.init 的拼接口径一致，保证 per-path 队列键相同） */
function getKnowledgePath(): string {
  if (KnowledgeData.filePath) return KnowledgeData.filePath;
  return storageFile('knowledge.json', tryGetSettings().storagePath || 'CONFIG/STORAGE');
}

/** 对 knowledge.json 执行同步改写，有变化才写回（读改写整体入 per-path 串行队列，
 *  与任务 CRUD（_mutate 同队列）互斥，后台同步不得用陈旧基线覆盖面板刚写入的数据） */
async function syncTasks(apply: (tasks: SyncTask[]) => boolean) {
  const path = getKnowledgePath();
  await enqueueFileTask(path, async () => {
    const tasks = (await KnowledgeData.read()) as SyncTask[];
    if (apply(tasks)) await KnowledgeData.write(tasks);
  });
}

// ---------- 路径 / 设置 / 范围 ----------

function getWatchedFolders(): string[] {
  return [knowledgeDirOf()];
}

// ---------- 壳装配（issue 365：队列/去抖/订阅/生命周期走 core/file-sync） ----------

/** knowledge.json 引用命中检查（范围外放行口径，同 memo E22） */
async function referencedByTasks(path: string): Promise<boolean> {
  if (!path) return false;
  try {
    const tasks = (await KnowledgeData.read()) as SyncTask[];
    return tasks.some((t) => t?.notePath === path || t?.videoPath === path);
  } catch (e) {
    return false;
  }
}

const agent = createFileSync<SyncTask[]>({
  logTag: '[knowledge-file-sync]',
  failNotice: '知识盒同步失败，数据可能不一致',
  failDedupeKey: 'knowledge-file-sync',
  watchedFolders: getWatchedFolders,
  commit: (apply) => syncTasks(apply),
  referencedBy: referencedByTasks,
  applyRename: syncRename,
  applyDelete: syncDelete,
  /** source 退役消费者（ADR-0149 决策 2）：卡片 source 可指向任意笔记（不限目录），
   *  任何被删 md 都过一遍 metadataCache 预筛；已降级卡片天然幂等跳过 */
  onMdDeleted: (app, path) => retireSourcesOnMdDeleted(app, path),
});

/** 幂等初始化（main.ts onLayoutReady 常驻接线；ADR-0003 同款幂等） */
export function ensureFileSync(app: App): void {
  agent.ensure(app);
}

/** 卸载清理（壳置位 _cancelled 短路积压任务、丢弃去抖窗口内事件并退订全部监听） */
export function unloadFileSync(): void {
  agent.unload();
}
