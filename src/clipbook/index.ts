/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：域入口/懒加载（ADR-0003）。
 *
 * 命令（bz-clipbook-open / bz-clipbook-mark-all-read）由 main.ts 裸注册回调；
 * 幂等初始化 ensure → ui.initPanel 建面板（首次）+ show；卸载 unloadClipbook。
 * 旧 news/clipping 入口命令断开后，本域是「剪藏本」唯一入口。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { notice } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { readNewsData } from './news-data';
import { flowMarkAllRead } from './flow';
import { initPanel, showPanel, unloadPanel, reloadIfOpen, invalidateClipBodyCache } from './ui';

let initialized = false;
let autoRefreshRegistered = false;


/** 打开剪藏本（bz-clipbook-open 命令回调） */
export function openClipbook(app: App): void {
  if (!initialized) {
    initialized = true;
    registerAutoRefresh(app);
    initPanel(app, true);
  } else {
    showPanel();
  }
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
  await flowMarkAllRead(unread);
  notice(`已把 ${unread.length} 篇标为已读`, 'success');
  // 面板开着就同步刷新（首页侧由 home 的 keepHome 路径自行刷新）
  void reloadIfOpen();
}

/** 卸载清理（main.ts onunload） */
export function unloadClipbook(): void {
  if (!initialized) return;
  initialized = false;
  unloadPanel();
  autoRefreshRegistered = false;
}

/** 目录/数据变化自动刷新（clipping:file-* 域事件，仅面板打开时重载；300ms 防抖） */
function registerAutoRefresh(app: App): void {
  if (autoRefreshRegistered) return;
  autoRefreshRegistered = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const dir = () => {
    const s = tryGetSettings() as any;
    return ((s && s.articleDirectory) || '归档/网页剪藏').replace(/\/+$/, '');
  };
  const schedule = (path?: string) => {
    if (path) invalidateClipBodyCache(path); // 正文缓存失效（enh 包 3：clipping:file-modified 等）
    const d = dir();
    if (path && !path.startsWith(d + '/')) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void reloadIfOpen();
    }, 300);
  };
  onDomainEvent<{ path: string }>('clipping:file-created', (e) => schedule(e && e.path));
  onDomainEvent<{ path: string }>('clipping:file-modified', (e) => schedule(e && e.path));
  onDomainEvent<{ path: string }>('clipping:file-deleted', (e) => schedule(e && e.path));
  onDomainEvent<{ oldPath: string; newPath: string }>('clipping:file-renamed', (e) => schedule(e && e.newPath));
}
