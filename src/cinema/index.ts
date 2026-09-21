/**
 * 影院（cinema）域入口：懒加载初始化 + 打开/关闭 + 卸载
 * 自 ADR-0087 起接管原 movie 域（旧 src/movie 已退役）；目录回落 cinemaFolderPath → 默认。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { unregisterPanelEsc } from '../core/esc-manager';
import { M, resetCinemaState, resolveCinemaFolderPath, DEFAULT_FOLDER } from './state';
import { rebuildItems, findPosterRenameTargets } from './data';
import { createOverlay, closeOverlay, registerEscapeHandler, renderAll, renderSoft, openAddModalDirect, openRandomMovie, openYearbookOverlay } from './ui';
import { shutdownDoubanQueue, sweepDoubanFetch } from './douban-queue';

let initialized = false;
let autoRefreshRegistered = false;

/** 打开面板时的默认视图接线（issue 194）：每次打开读设置，非法值回落
 *  （排序 date/created/rating 之外回落 date；状态筛选仅认想看/在看/已看，其余回全部）。
 *  与收藏本 openPanel 同语义：设置是「下次打开的初始值」，面板内改选为会话内临时态。 */
export function applyDefaultView(): void {
  const s = tryGetSettings() as Record<string, unknown>;
  const sort = s.cinemaSortMode;
  M.sortMode = sort === 'created' || sort === 'rating' ? sort : 'date';
  const st = s.cinemaStatusFilter;
  M.statusFilter = st === '想看' || st === '在看' || st === '已看' ? st : null;
}

/** 幂等初始化（懒加载）：设置注入 + ESC + 自动刷新 */
export function ensureCinema(app: App): void {
  // G6：目录每次调用同步读设置（resolveCinemaFolderPath 唯一单源）——会话内改「影视文件夹」
  // 立即生效；否则 M.folderPath 首次初始化缓存旧值，面板/新建仍走旧目录，
  // 与日记本（实时读设置）对不上直到重载。DEFAULT_FOLDER 保留导出（域外引用）
  M.folderPath = resolveCinemaFolderPath();
  if (initialized) return;
  initialized = true;
  M.appRef = app;
  registerEscapeHandler();
  registerAutoRefresh(app);
  registerPosterRenameSync(app);
}

/** 域事件自动刷新（cinema/vault 多通道，防抖 300ms，仅 overlay 打开时刷新）。
 *  订阅 cinema:file-* 与 vault:md-*（movie:file-* 通道已随旧域退役）——按 M.folderPath 前缀过滤 */
function registerAutoRefresh(app: App): void {
  if (autoRefreshRegistered) return;
  autoRefreshRegistered = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (file: { path?: string }) => {
    if (file && file.path && !file.path.startsWith(M.folderPath + '/')) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!M.currentOverlay) return;
      rebuildItems(app);
      renderSoft(app); // 后台通道：打字期间顺延，不抢搜索框焦点
    }, 300);
  };
  onDomainEvent<{ path: string }>('cinema:file-created', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('cinema:file-deleted', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('cinema:file-modified', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('vault:md-created', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('vault:md-deleted', (evt) => schedule({ path: evt.path }));
  onDomainEvent<{ path: string }>('vault:md-modified', (evt) => schedule({ path: evt.path }));
}

// ---------- 海报路径 rename 联动（issue 337 审计#11） ----------

/** `海报` frontmatter 存的是纯路径非双链，Obsidian 改名海报文件不联动（审计#11）。
 *  订阅 vault:md-renamed（消费先例：上方 md-deleted 自动刷新），命中任一影院笔记
 *  海报==oldPath 才 processFrontMatter 改写（回调内复核，只动该键，其余键不碰）。
 *  事件按 DEBOUNCE 同窗口合并去抖、保序回放（A→B→C 连改名不丢中间态——
 *  只留末事件会漏改，参照 memo file-sync 同语义）；改写落盘经真实环境 modify 事件
 *  走既有自动刷新，此处不手动重渲染（避免双刷）。 */
const POSTER_RENAME_DEBOUNCE_MS = 300;
let posterSyncRegistered = false;
let posterRenameQueue: { oldPath: string; newPath: string }[] = [];
let posterRenameTimer: ReturnType<typeof setTimeout> | null = null;

/** 幂等注册（ensureCinema 初始化分支调用，与 registerAutoRefresh 同生命周期） */
function registerPosterRenameSync(app: App): void {
  if (posterSyncRegistered) return;
  posterSyncRegistered = true;
  onDomainEvent<{ oldPath: string; newPath: string }>('vault:md-renamed', (evt) => {
    if (!evt || typeof evt.oldPath !== 'string' || !evt.oldPath || typeof evt.newPath !== 'string' || !evt.newPath) return;
    posterRenameQueue.push({ oldPath: evt.oldPath, newPath: evt.newPath });
    if (posterRenameTimer) clearTimeout(posterRenameTimer);
    posterRenameTimer = setTimeout(() => void flushPosterRenames(app), POSTER_RENAME_DEBOUNCE_MS);
  });
}

/** 防抖到期：保序回放积压 rename 事件，逐个改写命中笔记（无命中零写盘） */
async function flushPosterRenames(app: App): Promise<void> {
  posterRenameTimer = null;
  const batch = posterRenameQueue;
  posterRenameQueue = [];
  for (const { oldPath, newPath } of batch) {
    for (const file of findPosterRenameTargets(app, oldPath)) {
      try {
        await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
          if (fm['海报'] != null && String(fm['海报']) === oldPath) fm['海报'] = newPath;
        });
      } catch (e) {
        console.warn('bz 影院：海报路径联动改写失败:', file.path, e);
      }
    }
  }
}

/** 打开影院（命令 bz-cinema-open，toggle 语义） */
export function openCinema(app: App): void {
  ensureCinema(app);
  if (M.currentOverlay) {
    closeOverlay();
    return;
  }
  applyDefaultView();
  createOverlay(app);
  // 豆瓣抓取队列（ADR-0113）：打开即扫未齐条目，入队串行补抓
  sweepDoubanFetch(app);
}

/**
 * 观影分析（命令 bz-cinema-analysis）：独立全屏长片《观影志》（2026-09-22 重写为 26 幕，
 * 面板开不开都能看；命令 ID 与首页入口不变）。幂等语义：已开着就不叠第二层（再点晃一下提示）。
 */
export function openCinemaAnalysis(app: App): void {
  ensureCinema(app);
  openYearbookOverlay(app);
}

/** 添加影视（命令 bz-cinema-add） */
export function addCinemaItem(app: App): void {
  ensureCinema(app);
  openAddModalDirect(app);
}

/**
 * 随机抽一部（命令 bz-cinema-random-pick，2026-09-11 首页入口菜单）：
 * 从「想看」池随机挑一部并直接开详情；面板未开则冷开（详情叠在列表页上，
 * 故先把视图回落 list —— 上次停在分析/AI 页时不清掉会叠在错误的页面上）。
 */
export function pickRandomCinema(app: App): void {
  ensureCinema(app);
  M.view = 'list';
  openRandomMovie(app);
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadCinema(): void {
  initialized = false;
  autoRefreshRegistered = false;
  posterSyncRegistered = false;
  // 面板 ESC 层注销（对齐 bookshelf/gameshelf/home 三域样板；escManager 层不随插件卸载自动清理，
  // 残层占住 panelEscHandles 槽位会吞掉重启用后 registerPanelEsc('bz-cinema') 的幂等注册）
  unregisterPanelEsc('bz-cinema');
  if (posterRenameTimer) {
    clearTimeout(posterRenameTimer);
    posterRenameTimer = null;
  }
  posterRenameQueue = [];
  shutdownDoubanQueue(); // 清队列与状态（ADR-0129 执行层已在插件内，无子进程可杀；卸载后会话语义重置）
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  resetCinemaState();
}
