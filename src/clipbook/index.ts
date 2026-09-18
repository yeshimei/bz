/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：域入口/懒加载（ADR-0003）。
 *
 * 命令（bz-clipbook-open / bz-clipbook-mark-all-read）由 main.ts 裸注册回调；
 * 幂等初始化 ensure → ui.initPanel 建面板（首次）+ show；卸载 unloadClipbook。
 * 旧 news/clipping 入口命令断开后，本域是「剪藏本」唯一入口。
 */
import type { App } from 'obsidian';
import { onDomainEvent } from '../core/domain-bus';
import { notice, notifyUndo } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { readNewsData } from './news-data';
import { maybeFetchNews, setNewsFetchDoneListener } from './news-fetcher';
import { flowMarkAllRead, flowUndoMarkAllRead } from './flow';
import { clipDir } from './save';
import { initPanel, showPanel, unloadPanel, reloadIfOpen, invalidateClipBodyCache } from './ui';
import { openClipbookReport, unloadClipbookReport } from './report-ui';
import { unloadManagerModals } from './news-sources-group';

let initialized = false;
let autoRefreshRegistered = false;
/** 域事件退订句柄（A7）：registerAutoRefresh 四订阅的 off 收集于此，unloadClipbook 逐个闭环 */
let autoRefreshUnsubs: Array<() => void> = [];


/** 打开剪藏本（bz-clipbook-open 命令回调） */
export function openClipbook(app: App): void {
  if (!initialized) {
    initialized = true;
    registerAutoRefresh(app);
    // 抓到新文章后面板开着就刷新（issue 302 / ADR-0128；数据层经回调反向通知，不直接依赖 UI）
    setNewsFetchDoneListener(() => reloadIfOpen());
    initPanel(app, true);
  } else {
    showPanel();
  }
  // 打开即后台抓一轮（间隔判定在 fetcher 内；启动触发走 main.ts onload）
  void maybeFetchNews();
}

/**
 * 未读全部标为已读（命令 bz-clipbook-mark-all-read，2026-09-11 首页入口菜单）：
 * 面板里「全部标为已读」原本只作用于**单个源行**（rail 右键），跨全库没有入口；
 * 本命令取全库未读（news.json 里 read !== true 的全部条目）→ 确认框写明篇数 → 一次读改写落盘。
 *
 * 风格：与面板内同款动作**同一个确认框皮**（core/flow-dialog + 剪藏本的
 * `.bz-clip-dialog-editorial`），文案口径也一致（「将把…N 篇…全部标为已读」）——
 * 同一动作从面板走还是从首页走，视觉与措辞都得是同一个人写的。
 * 取消/ESC/点遮罩一律放弃（openFlowDialog 的取消语义），不做任何写入。
 */
export async function markAllUnreadRead(): Promise<void> {
  const res = await readNewsData();
  if (!res.ok || res.missing) {
    notice('读不到未读流（news.json）', 'warning');
    return;
  }
  const unread = (res.data.articles || []).filter((a: any) => a && a.read !== true);
  if (!unread.length) {
    notice('未读流已经空了');
    return;
  }
  const ok = await openFlowDialog({
    className: 'bz-clip-dialog-editorial',
    title: '未读全部标为已读',
    message: `将把未读流里的 ${unread.length} 篇全部标为已读。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: `全部已读（${unread.length} 篇）`, value: 'ok', cta: true },
    ],
  });
  if (ok !== 'ok') return;
  // 新-9/CB12：通知篇数取返回的实际 bumped（确认框停留窗口内竞态不虚报）；
  // 批量撤销兜底（flowUndoMarkAllRead 按动作前快照整批恢复 + 统计回退）
  const { bumped, snapshot } = await flowMarkAllRead(unread);
  if (!bumped) { void reloadIfOpen(); return; }
  notifyUndo(`已把 ${bumped} 篇标为已读`, () => void (async () => {
    await flowUndoMarkAllRead(snapshot);
    notice('已撤销：条目恢复未读', 'success');
    void reloadIfOpen();
  })());
  // 面板开着就同步刷新（首页侧由 home 的 keepHome 路径自行刷新）
  void reloadIfOpen();
}

/** 卸载清理（main.ts onunload） */
export function unloadClipbook(): void {
  // 阅读报告弹层可由命令直开（不经 openClipbook 初始化），卸载无条件收口
  unloadClipbookReport();
  // CB10 域内兜底：UP/RSS 管理弹窗可从设置面板直开（不经 openClipbook 装载），无条件收口——
  // 先走 close（幂等：DOM+esc+单例旗标），再按 id 摘可能的残留（close 已收则此处空转）
  unloadManagerModals();
  for (const id of ['bz-up-manager-mask', 'bz-up-manager-popup', 'bz-rss-manager-mask', 'bz-rss-manager-popup']) {
    document.getElementById(id)?.remove();
  }
  if (!initialized) return;
  initialized = false;
  unloadPanel();
  autoRefreshRegistered = false;
  // A7：四个域事件订阅逐个退订 + 抓取完成回调清槽（空函数占位，不依赖 news-fetcher 改口）
  for (const off of autoRefreshUnsubs.splice(0)) off();
  setNewsFetchDoneListener(() => {});
}

/** 打开剪藏阅读报告弹层（命令 bz-clipbook-report；issue 358）：
 *  只读 clipbook.json 侧写 readLog，不依赖剪藏本主面板装载态 */
export { openClipbookReport };

/** clipbook.json 引用同步（issue 336 / ADR-0149 决策 4，main.ts onLayoutReady 常驻接线；
 *  实现同 memo file-sync 范式：域事件订阅 + 去抖 + 读改写事务） */
export { ensureFileSync as ensureClipbookFileSync, unloadFileSync as unloadClipbookFileSync } from './file-sync';

/** 目录/数据变化自动刷新（clipping:file-* 域事件，仅面板打开时重载；300ms 防抖）。
 *  A7：四个订阅句柄收集存模块级 autoRefreshUnsubs，unloadClipbook 逐个退订（不再依赖
 *  main onunload 末尾 clearDomainEvents 的调用顺序兜底）。 */
function registerAutoRefresh(app: App): void {
  if (autoRefreshRegistered) return;
  autoRefreshRegistered = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** 缓存失效 + 目录内变更防抖刷新。
   *  C18：rename 携带 oldPath——正文缓存键是**旧路径**（notePath 快照），只失效 newPath 等于没失效
   *  （旧键常驻内存，重命名回原名会读到陈旧正文）；且「移出剪藏目录」的改名 newPath 不在目录内，
   *  旧路径条目却已消失，命中判定必须新旧都看，否则面板留着幽灵条目。 */
  const schedule = (path?: string, stalePath?: string) => {
    // CB11：载荷缺 path/stalePath 的异常事件显式跳过——原 `path &&` 前置短路在缺失时
    // 放行到防抖窗口，300ms 后白做一次全量重扫
    if (!path && !stalePath) return;
    if (path) invalidateClipBodyCache(path); // 正文缓存失效（enh 包 3：clipping:file-modified 等）
    if (stalePath) invalidateClipBodyCache(stalePath);
    const d = clipDir();
    const inDir = (p?: string) => !!p && p.startsWith(d + '/');
    if (!inDir(path) && !inDir(stalePath)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void reloadIfOpen();
    }, 300);
  };
  autoRefreshUnsubs = [
    onDomainEvent<{ path: string }>('clipping:file-created', (e) => schedule(e && e.path)),
    onDomainEvent<{ path: string }>('clipping:file-modified', (e) => schedule(e && e.path)),
    onDomainEvent<{ path: string }>('clipping:file-deleted', (e) => schedule(e && e.path)),
    onDomainEvent<{ oldPath: string; newPath: string }>('clipping:file-renamed', (e) => schedule(e && e.newPath, e && e.oldPath)),
  ];
}
