/**
 * 书架墙（bookshelf）域入口：懒加载初始化 + 打开/关闭 + 卸载
 * 并存式新域（cinema 先例）：与旧 library 域数据同源但独立实现；
 * 用户后续会删除旧 library 域，本域独立承担书库 UI。
 * 读书报告内嵌化：报告是本域面板内的视图——openBookshelfReport 供命令
 * bz-reading-report-open（home 报告磁贴/剪藏本深链/本域报告入口同一去向）调用。
 */
import type { App, EventRef } from 'obsidian';
import { onDomainEvent } from '../core/domain-bus';
import { notice } from '../core/notice';
import { M, resetBookshelfState, applyDefaultView } from './state';
import { currentSideItems } from './shared';
import { isBookshelfPath, resolveFolderPath, rebuildItems, WEAVE_DATA_FILE } from './data';
import {
  createOverlay, closeOverlay, registerEscapeHandler, unregisterEscapeHandler,
  renderAll, refreshReportView, openReportView, showView,
} from './ui';
import { cancelReadingReport } from '../reading-report';
import { closeBookNoteModals } from './notes-ui';

let initialized = false;
let autoRefreshRegistered = false;
// B5：订阅句柄统一收集（域事件退订函数 + vault EventRef），卸载时全部释放
let autoRefreshOffs: (() => void)[] = [];
let weaveVaultRefs: EventRef[] = [];

/** 幂等初始化（懒加载）：目录设置注入 + ESC + 自动刷新 */
export function ensureBookshelf(app: App): void {
  if (initialized) return;
  initialized = true;
  M.appRef = app;
  registerEscapeHandler();
  registerAutoRefresh(app);
}

/** 域事件自动刷新（vault 通道 + EPUB json，防抖 300ms，仅 overlay 打开时刷新）。
 *  audit H：bookshelf:file-* / library:file-* 六个订阅已删除——FileDomainKind 不含这两域，
 *  `<域>:file-*` 通道对它们从不发布（白挂 8 个监听）；vault:md-* + vault modify 已覆盖刷新面。
 *  读书报告内嵌化：报告视图存续期间书库数据变化 → 自动重算只更新报告内容区（renderAll 免跑）。 */
function registerAutoRefresh(app: App): void {
  if (autoRefreshRegistered) return;
  autoRefreshRegistered = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (file: { path?: string }) => {
    // 收录谓词单源（深审 RR-A1/RR-F7）：isBookshelfPath 含「目录本身是单个 md 笔记」形态——
    // 旧过滤只认目录前缀，单文件书库（书库.md）写盘面板不刷新（收录两侧认、刷新通道不认）
    if (file && file.path && !file.path.endsWith(WEAVE_DATA_FILE)
      && !isBookshelfPath(file.path, resolveFolderPath())) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!M.currentOverlay) return;
      void rebuildItems(app).then(() => {
        if (M.view === 'report') refreshReportView(app); // 报告视图：只重算报告内容区
        else renderAll(app);
      });
    }, 300);
  };
  for (const ch of ['vault:md-created', 'vault:md-deleted', 'vault:md-modified']) {
    autoRefreshOffs.push(onDomainEvent<{ path: string }>(ch, (evt) => schedule({ path: evt.path })));
  }
  // B4：EPUB 数据来自 weave-data.json（外部 Weave 阅读器直写，core vault 适配器只转发 .md），
  // 域内自挂 vault modify 补 json 通道；B5：EventRef 一并登记，卸载 offref。
  // 深审 func F4：补 create/delete——json 尚不存在时 Weave 首次落盘走 create（面板开着不刷新），
  // json 被外部删除走 delete（EPUB 区残留旧数据），与 modify 复用同一 schedule，零额外成本
  const weaveFile = app.vault;
  weaveVaultRefs = [
    weaveFile.on('modify', (file) => schedule({ path: (file as { path?: string })?.path })),
    weaveFile.on('create', (file) => schedule({ path: (file as { path?: string })?.path })),
    weaveFile.on('delete', (file) => schedule({ path: (file as { path?: string })?.path })),
  ];
}

/** 打开书架墙（命令 bz-bookshelf-open，toggle 语义） */
export function openBookshelf(app: App): void {
  ensureBookshelf(app);
  if (M.currentOverlay) {
    closeOverlay();
    return;
  }
  applyDefaultView();
  createOverlay(app);
}

/** 打开书架墙并切到阅读分析报告视图（命令 bz-reading-report-open；原独立报告弹窗已退役）。
 *  面板已开则只切视图（重入重算报告内容）；未开则冷开面板直落报告视图。 */
export function openBookshelfReport(app: App): void {
  ensureBookshelf(app);
  openReportView(app);
}

/**
 * 继续在读（命令 bz-bookshelf-continue，2026-09-11 首页入口菜单）：
 * 开书架墙并直接落到「在读」分栏（首页入口有在读时才亮彩点，见 home/shared.buildDots）。
 * 在读为空 → 只提示不面板（空白分栏比一句提示更让人困惑）；
 * 面板已开则就地切分栏重渲染，不 toggle 关闭（与「阅读分析报告」同一幂等口径）。
 * 深审 cons C1/eff E6：
 *  - 视图切换必须经 showView 单口——裸赋 M.view 绕过 paintViewContainers，报告视图
 *    存活时命令假死（墙渲染进隐藏容器，连「返回书库」钮都失联）；showView changed
 *    时自动 cancelReadingReport，在途报告分片渲染不再向隐藏容器续写；
 *  - 恒 rebuild 保数据新鲜——M.items 是上次会话快照，期间读完/开新书不反映，
 *    「首页彩点亮 → 点进来却说没有在读」的入口承诺矛盾（修法是删条件不是加缓存）。
 */
export async function continueReading(app: App): Promise<void> {
  ensureBookshelf(app);
  const items = await rebuildItems(app);
  if (!currentSideItems(items, 'reading').length) {
    notice('书库里还没有在读的书', 'warning');
    return;
  }
  M.side = 'reading';
  M.catFilter = 'all';
  if (M.currentOverlay) {
    showView(app, 'shelf');
  } else {
    // 冷开：面板未开，直接定视图后随 createOverlay 初始化（同 openReportView 冷开先例）——
    // 「继续在读」承诺落在读墙，不复现上次会话的报告视图
    M.view = 'shelf';
    createOverlay(app);
  }
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadBookshelf(): void {
  initialized = false;
  autoRefreshRegistered = false;
  // B5：退订全部域事件 + vault EventRef
  autoRefreshOffs.forEach((off) => off());
  autoRefreshOffs = [];
  for (const ref of weaveVaultRefs) M.appRef?.vault.offref(ref);
  weaveVaultRefs = [];
  unregisterEscapeHandler(); // B1：注销 ESC 层
  closeBookNoteModals(); // 读书笔记弹窗（uiModal 壳挂 body，面板未开也可能存活）：卸载不留孤儿浮层
  // 深审 func F2/ui F7：卸载也走 closeOverlay 单口——window resize 监听、搜索/resize
  // 防抖 timer、借书卡弹窗、报告在途渲染、面板壳一并收口（内部各步幂等，重复调用无害；
  // 原先手工 overlay.remove() 漏摘 resize 监听，禁用→启用循环每次残留一个）
  closeOverlay();
  // 孤儿浮层兜底清理（按域锚点：面板壳已改共享 .bz-panel-overlay，经本域 .bz-bs-panel 定位其遮罩根，
  // 防止误删同时开着的其他域面板）
  document.querySelectorAll('.bz-bs-panel').forEach((el) => {
    const root = el.closest('.bz-panel-overlay');
    if (root) root.remove();
  });
  resetBookshelfState();
}
