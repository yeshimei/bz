/**
 * 游戏库（gameshelf）域入口：懒加载初始化 + 打开/关闭 + 卸载（影院同范式）。
 * 打开时自动同步：已配置才拉，间隔判定在 runSync 内（无笔记 syncedAt=0 必过期 → 首次必拉）。
 *
 * 2026-09-17 补两条命令入口（首页右键菜单 / 长按抽屉）：syncGameshelf（立即同步，不开面板）
 * 与 openGameshelfStats（直开数据统计页）——命令 id 两段式仍守 `bz-<域>-<动作>` 铁律 2。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { M, resetGameshelfState, resolveGameshelfFolderPath } from './state';
import { rebuildItems } from './notes';
import { ensurePosters, mediaItemsOf, unloadPosters } from './posters';
import { ensureBackfill, unloadBackfill } from './backfill';
import { ensureZhNames, unloadZhNames } from './names';
import { closePanel, openPanel, renderAll } from './ui';

let initialized = false;

/** 幂等初始化：目录每次读设置（域内改目录立即生效），ESC 随面板开关注册注销 */
export function ensureGameshelf(app: App): void {
  M.folderPath = resolveGameshelfFolderPath();
  if (initialized) return;
  initialized = true;
  M.appRef = app;
}

/** 打开面板后的后台收尾（自动同步 → 重渲 → 补媒体与中文名）；两条打开类命令共用 */
function afterOpen(app: App): void {
  void import('./sync').then(async (m) => {
    await m.autoSyncOnOpen(app);
    renderAll(app);
    ensurePosters(app, mediaItemsOf(M.items));
    ensureZhNames(app, M.items);
    // 后台全量回填商店资料 + 成就三键（2026-09-18 用户拍板：数据全在笔记属性，
    // 不等逐款点开；只补缺「详情时间」的，幂等）
    ensureBackfill(app, M.items);
  });
}

/** 打开游戏库（命令 bz-gameshelf-open，toggle 语义） */
export function openGameshelf(app: App): void {
  ensureGameshelf(app);
  if (M.currentOverlay) {
    closePanel();
    return;
  }
  rebuildItems(app);
  // 面板先出（本地数据立即可见），自动同步后台补新鲜度
  openPanel(app);
  afterOpen(app);
}

/** 打开游戏库并落到数据统计页（命令 bz-gameshelf-stats；面板已开就地切页，影院分析报告同范式） */
export function openGameshelfStats(app: App): void {
  ensureGameshelf(app);
  if (M.currentOverlay) {
    M.view = 'stats';
    renderAll(app);
    return;
  }
  rebuildItems(app);
  openPanel(app, 'stats');
  afterOpen(app);
}

/**
 * 立即同步（命令 bz-gameshelf-sync，首页菜单「立即同步」）：不开面板也能拉，忽略间隔。
 * 通知口径同剪藏本手动抓取（core/notice，2026-09-17）：有变化 runSync 内已弹成功条，
 * 无变化这里补一句「已同步，暂无变化」——命令是显式意图，静默会让人以为没反应；
 * 未配置给明话指引。其余失败原因（网络/密钥/接口）runSync 内部已弹错误条，不重复弹。
 */
export async function syncGameshelf(app: App): Promise<void> {
  ensureGameshelf(app);
  const { runSync } = await import('./sync');
  const r = await runSync(app, { force: true });
  if (r.ok) {
    // 新入库的游戏要补本地封面/图标与中文名——「拉到的都存本地」不依赖打开面板
    // （两条队列都幂等：已齐的项 needsWork=false 直接跳过，不会重复下载）
    ensurePosters(app, mediaItemsOf(M.items));
    ensureZhNames(app, M.items);
    ensureBackfill(app, M.items);
    if (r.added + r.updated + r.offShelf === 0) notice('已同步，暂无变化', 'success');
    return;
  }
  if (r.reason === 'config') notice('游戏库尚未配置：先在设置面板填写 SteamID64 与 Web API 密钥', 'warning');
  else if (r.reason === 'busy') notice('同步已在进行中', 'info');
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadGameshelf(): void {
  initialized = false;
  closePanel();
  unloadPosters();
  unloadZhNames();
  unloadBackfill();
  resetGameshelfState();
}
