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

function queueProcess(app: any, ai: any, file: any): void {
  if (!file || file.extension !== 'md') return;
  if (!file.path.startsWith(getWatchDir() + '/')) return;
  if (pendingPaths.has(file.path)) return;
  pendingPaths.add(file.path);
  // 延迟处理，等 frontmatter 写入完成
  setTimeout(() => {
    pendingPaths.delete(file.path);
    void processFile(app, ai, file);
  }, 1500);
}

/** 幂等初始化：延迟 2000ms 注册 create + file-open 监听（原脚本防冲突语义） */
export function ensureAutoSummary(app: any): void {
  if (initialized) return;
  initialized = true;
  vaultRef = app.vault;
  workspaceRef = app.workspace;

  const ai = createAI();

  // 延迟注册，避免和其他脚本冲突
  registerTimer = setTimeout(() => {
    if (!vaultRef) return;
    fileListenerRef = vaultRef.on('create', (file: any) => queueProcess(app, ai, file));
    // 打开文件同样触发（file-open 关闭时传 null，queueProcess 内跳过）
    if (workspaceRef && typeof workspaceRef.on === 'function') {
      openListenerRef = workspaceRef.on('file-open', (file: any) => queueProcess(app, ai, file));
    }
    console.log(`[自动摘要] 👁️ 监听 ${getWatchDir()}`);
  }, 2000);
}

export function isAutoSummaryInitialized(): boolean {
  return initialized;
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadAutoSummary(): void {
  if (registerTimer) clearTimeout(registerTimer);
  registerTimer = null;
  if (fileListenerRef && vaultRef) {
    try { vaultRef.offref(fileListenerRef); } catch { /* 忽略 */ }
    fileListenerRef = null;
  }
  if (openListenerRef && workspaceRef) {
    try { workspaceRef.offref(openListenerRef); } catch { /* 忽略 */ }
    openListenerRef = null;
  }
  pendingPaths.clear();
  initialized = false;
  vaultRef = null;
  workspaceRef = null;
}
