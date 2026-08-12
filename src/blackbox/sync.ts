/**
 * 黑匣子实时同步（ticket 05，ADR-0015 笔记即事实源的运行时承诺）：
 * 用户在 Obsidian 里改黑匣子笔记的标题或内容 → 索引与主面板实时跟随。
 * - 内容编辑：metadataCache 'changed' 命中 `我的/黑匣子/` → 重新水合 + 面板打开时实时刷新（保留类型筛选/搜索词/滚动）
 * - 改名/删除/新建：vault rename/delete/create → 重新水合（索引按 frontmatter id 重映射/移除/新增，缺失跳过）
 * - 对话/复盘/事件提炼读取时总是读最新笔记（BlackBoxDataManager.load 每次全量水合，不缓存正文）
 * 常驻注册（onload 即注册，无设置开关）；同一文件高频事件 300ms 防抖合并。
 */
import type { App } from 'obsidian';
import { getApp } from '../core/app';
import { BlackBoxDataManager, getBlackBoxFilePath, invalidateBlackBoxCache } from './data';
import { BB_NOTE_ROOT, isBlackBoxNotePath } from './notes';
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
  // 缓存失效（同步事件）：外部改笔记/数据文件/移动/删除 → 下次 load 重新水合；插件自身写入先失效、save 后自愈恢复
  const onCacheInvalidate = (path: string): void => {
    if (path && (isBlackBoxNotePath(path) || path === getBlackBoxFilePath())) invalidateBlackBoxCache();
  };
  const refM = v.on('modify', (file: any) => {
    if (file && file.path) onCacheInvalidate(file.path);
  });
  offRefs.push({ off: () => v.offref(refM) });
  // create 仅用于缓存失效（不刷新面板）：插件自身写笔记 → 事件失效 → 随后的 save 自愈恢复；外部新建 → 下次 load 孤儿自愈收录
  const refC = v.on('create', (file: any) => {
    if (file && file.path) onCacheInvalidate(file.path);
  });
  offRefs.push({ off: () => v.offref(refC) });
  // 面板刷新监听：仅监听 rename/delete（create 由 load 孤儿自愈兜底，防插件自身写笔记触发 refresh → 并发迁移循环）
  for (const ev of ['rename', 'delete']) {
    const ref = v.on(ev, (file: any, oldPath?: string) => {
      if (file && file.path) {
        onCacheInvalidate(file.path);
        if (ev === 'rename' && oldPath && oldPath !== file.path) void syncCategoryFromMove(file.path, oldPath);
        onEvent(file.path);
      }
    });
    offRefs.push({ off: () => v.offref(ref) });
  }
}

/** 自动维护（2026-08-12 需求：分类自动维护）：笔记被手动拖到分类子文件夹 → frontmatter
 *  category 跟随目录；拖回类型根目录 → 移除 category。纯文件层操作，失败静默。 */
async function syncCategoryFromMove(newPath: string, oldPath: string): Promise<void> {
  if (!isBlackBoxNotePath(newPath)) return;
  try {
    const app = getApp();
    if (!app) return;
    const newDir = newPath.slice(0, newPath.lastIndexOf('/'));
    const oldDir = oldPath.slice(0, oldPath.lastIndexOf('/'));
    if (newDir === oldDir) return;
    const f = app.vault.getAbstractFileByPath(newPath);
    if (!f) return;
    const raw = await app.vault.read(f as any);
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return;
    const typeRoots = [BB_NOTE_ROOT + '/概念', BB_NOTE_ROOT + '/摘抄', BB_NOTE_ROOT + '/想法'];
    const cat = typeRoots.some((r) => newDir.startsWith(r + '/')) ? newDir.slice(newDir.lastIndexOf('/') + 1) : '';
    const lines = m[1].split('\n');
    const idx = lines.findIndex((l) => /^category:/.test(l));
    if (cat) {
      const line = `category: "${cat}"`;
      if (idx >= 0) lines[idx] = line;
      else lines.splice(1, 0, line);
    } else if (idx >= 0) {
      lines.splice(idx, 1);
    }
    const next = `---\n${lines.join('\n')}\n---${raw.slice(m[0].length)}`;
    if (next !== raw) await app.vault.modify(f as any, next);
  } catch (e) {
    /* 静默：手动移动不同步 fm 也不影响数据完整性 */
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

/** 重新水合 + 通知面板（索引重映射/移除/新增由 hydrate 孤儿自愈完成）；先强制失效缓存保证读到最新笔记 */
async function refresh(): Promise<void> {
  try {
    const app = getApp();
    if (!app) return;
    invalidateBlackBoxCache();
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
