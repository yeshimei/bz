/**
 * 自动摘要入口（ticket 10）：监听剪藏文件夹，新文件创建时 AI 生成摘要/标签。
 * 源码：自动摘要.js L124-140（插件版：删除 quickAddApi 检查；createAI 来自 core）
 */
import { createAI } from '../core/ai';
import { processFile } from './processor';

const WATCH_DIR = '归档/网页剪藏';

let initialized = false;
let vaultRef: any = null;
let fileListenerRef: any = null;
let registerTimer: ReturnType<typeof setTimeout> | null = null;

/** 幂等初始化：延迟 2000ms 注册 create 监听（原脚本防冲突语义） */
export function ensureAutoSummary(app: any): void {
  if (initialized) return;
  initialized = true;
  vaultRef = app.vault;

  const ai = createAI();

  // 延迟注册，避免和其他脚本冲突
  registerTimer = setTimeout(() => {
    if (!vaultRef) return;
    fileListenerRef = vaultRef.on('create', (file: any) => {
      if (!file || file.extension !== 'md') return;
      if (!file.path.startsWith(WATCH_DIR + '/')) return;
      // 延迟处理，等 frontmatter 写入完成
      setTimeout(() => processFile(app, ai, file), 1500);
    });
    console.log(`[自动摘要] 👁️ 监听 ${WATCH_DIR}`);
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
  initialized = false;
  vaultRef = null;
}
