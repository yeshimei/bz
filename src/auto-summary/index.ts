/**
 * 自动摘要入口（ticket 22）：监听剪藏文件夹，文件创建或打开时缺字段 AI 补全。
 * 源码：自动摘要.js L124-140（插件版：删除 quickAddApi 检查；createAI 来自 core）
 */
import { createAI } from '../core/ai';
import { tryGetSettings } from '../core/settings-provider';
import { processFile } from './processor';

/** 监听目录与剪藏本设置一致（articleDirectory，默认 归档/网页剪藏） */
function getWatchDir(): string {
  const s = tryGetSettings() as any;
  return (s && s.articleDirectory) || '归档/网页剪藏';
}

let initialized = false;
let vaultRef: any = null;
let workspaceRef: any = null;
let fileListenerRef: any = null;
let openListenerRef: any = null;
let registerTimer: ReturnType<typeof setTimeout> | null = null;
/** 延迟窗口内同一文件只排队一次（create+open 双触发去重） */
const pendingPaths = new Set<string>();
/** 处理中集合：processFile 开始加入、finally 移除；完成前重复触发直接忽略（替代固定去重窗） */
const processingPaths = new Set<string>();

/** 处理单个文件并维护处理中集合（重复触发在 queueProcess 入口被忽略） */
async function processOnce(app: any, ai: any, file: any): Promise<void> {
  processingPaths.add(file.path);
  try {
    await processFile(app, ai, file);
  } finally {
    processingPaths.delete(file.path);
  }
}

function queueProcess(app: any, ai: any, file: any): void {
  if (!file || file.extension !== 'md') return;
  if (!file.path.startsWith(getWatchDir() + '/')) return;
  if (processingPaths.has(file.path)) return; // 处理中：重复触发直接忽略
  if (pendingPaths.has(file.path)) return;
  pendingPaths.add(file.path);
  // 延迟处理，等 frontmatter 写入完成
  setTimeout(() => {
    pendingPaths.delete(file.path);
    void processOnce(app, ai, file);
  }, 1500);
}

/** 延迟 2000ms 注册 create + file-open 监听（原脚本防冲突语义）。
 *  ticket 124（Q14 详设三）：timing=lazy 时只注册 file-open（仅打开文件时补全），
 *  immediate（默认）保持 create+file-open 双监听（保存后立刻）。 */
function scheduleRegister(app: any): void {
  const ai = createAI();
  registerTimer = setTimeout(() => {
    registerTimer = null; // 注册完成即清引用（stop 后再开的判断依据）
    if (!vaultRef) return;
    const timing = (tryGetSettings() as any)?.autoSummaryTiming || 'immediate';
    if (timing !== 'lazy') {
      fileListenerRef = vaultRef.on('create', (file: any) => queueProcess(app, ai, file));
    }
    // 打开文件同样触发（file-open 关闭时传 null，queueProcess 内跳过）
    if (workspaceRef && typeof workspaceRef.on === 'function') {
      openListenerRef = workspaceRef.on('file-open', (file: any) => queueProcess(app, ai, file));
    }
    console.log(`[自动摘要] 👁️ 监听 ${getWatchDir()}` + (timing === 'lazy' ? '（懒触发：仅打开时）' : ''));
  }, 2000);
}

/** 幂等初始化；stop 后再开启时复用 initialized 状态重新注册监听 */
export function ensureAutoSummary(app: any): void {
  if (initialized) {
    // stop 摘除过监听且无待注册定时器 → 重新注册
    if (!registerTimer && !fileListenerRef) scheduleRegister(app);
    return;
  }
  initialized = true;
  vaultRef = app.vault;
  workspaceRef = app.workspace;
  scheduleRegister(app);
}

export function isAutoSummaryInitialized(): boolean {
  return initialized;
}

/**
 * 设置开关停用（P1-22）：仅摘除 create/file-open 监听与待注册定时器；
 * initialized 状态保留以便再开启时复用（与 unloadAutoSummary 的差异是不置 disposed/清域引用）。
 */
export function stopAutoSummary(): void {
  if (registerTimer) { clearTimeout(registerTimer); registerTimer = null; }
  if (fileListenerRef && vaultRef) {
    try { vaultRef.offref(fileListenerRef); } catch { /* 忽略 */ }
    fileListenerRef = null;
  }
  if (openListenerRef && workspaceRef) {
    try { workspaceRef.offref(openListenerRef); } catch { /* 忽略 */ }
    openListenerRef = null;
  }
  pendingPaths.clear();
  processingPaths.clear();
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadAutoSummary(): void {
  stopAutoSummary();
  initialized = false;
  vaultRef = null;
  workspaceRef = null;
}
