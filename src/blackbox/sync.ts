/**
 * 黑匣子实时同步（ticket 05，ADR-0015 笔记即事实源的运行时承诺）：
 * 用户在 Obsidian 里改黑匣子笔记的标题或内容 → 索引与主面板实时跟随。
 * - 内容编辑：metadataCache 'changed' 命中 `黑匣子/` → 重新水合 + 面板打开时实时刷新（保留类型筛选/搜索词/滚动）
 * - 改名/删除/新建：vault rename/delete/create → 重新水合（索引按 frontmatter id 重映射/移除/新增，缺失跳过）
 * - 对话/复盘/事件提炼读取时总是读最新笔记（BlackBoxDataManager.load 每次全量水合，不缓存正文）
 * 常驻注册（onload 即注册，无设置开关）；同一文件高频事件 300ms 防抖合并。
 */
import type { App } from 'obsidian';
import { getApp } from '../core/app';
import { BlackBoxDataManager } from './data';
import { isBlackBoxNotePath } from './notes';
import type { BlackBoxData } from './types';

let registered = false;
let offRefs: { off: () => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let pendingPaths = new Set<string>();
/** 面板注册的刷新回调（打开时挂、关闭时摘；null = 面板未打开） */
let notify: ((data: BlackBoxData) => void) | null = null;

/** 幂等注册同步监听（main.ts onload 调用；卸载走 unloadBlackBoxSync） */
export function ensureBlackBoxSync(app: App): void {
  if (registered) return;
  registered = true;
  const onEvent = (path: string): void => {
    if (isBlackBoxNotePath(path)) schedule();
  };
  const mc: any = (app as any).metadataCache;
  if (mc && typeof mc.on === 'function') {
    const ref = mc.on('changed', (file: any) => {
      if (file && file.path) onEvent(file.path);
    });
    offRefs.push({ off: () => mc.offref(ref) });
  }
  const v: any = app.vault;
  // 仅监听 rename/delete：create 由 load 孤儿自愈兜底（防插件自身写笔记触发 refresh → 并发迁移循环）
  for (const ev of ['rename', 'delete']) {
    const ref = v.on(ev, (file: any) => {
      if (file && file.path) onEvent(file.path);
    });
    offRefs.push({ off: () => v.offref(ref) });
  }
}

/** 面板打开时挂刷新回调（数据变更 → 实时刷新；保留筛选与滚动由 refreshAll 保证） */
export function setBlackBoxSyncNotify(cb: ((data: BlackBoxData) => void) | null): void {
  notify = cb;
}

/** 防抖合并（300ms）：一次事件窗口内的多次变更只重水合一次 */
function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void refresh();
  }, 300);
}

/** 重新水合 + 通知面板（索引重映射/移除/新增由 hydrate 孤儿自愈完成） */
async function refresh(): Promise<void> {
  try {
    const app = getApp();
    if (!app) return;
    const data = await new BlackBoxDataManager(app).load();
    const cb = notify;
    if (cb) cb(data);
  } catch (e) {
    /* 同步失败静默（下次事件重试） */
  }
}

/** 卸载清理（onunload/测试重置）：移除全部监听 + 摘回调 */
export function unloadBlackBoxSync(): void {
  for (const ref of offRefs) {
    try {
      ref.off();
    } catch (e) {
      /* 幂等 */
    }
  }
  offRefs = [];
  registered = false;
  if (timer) clearTimeout(timer);
  timer = null;
  pendingPaths = new Set();
  notify = null;
}
