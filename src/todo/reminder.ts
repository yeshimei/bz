/**
 * 待办（todo）提醒后台（memo→todo 接管迁移第 3 项的提前实施）
 * 自 memo/app.ts 迁入的两处被动捕获入口，落点改待办面板：
 *   - 启动自动弹出：autoPopupOnStart 开（缺省开）且存在重要/到期未完成待办 → 300ms 后打开待办面板；
 *   - 打开笔记提醒：openNoteReminder 开（缺省开）且笔记有关联的重要/到期未完成待办 →
 *     打开待办面板并以笔记路径定位（搜索框预设 notePath，列表即只显该笔记关联待办）；
 *     无关联待办则不自动打开。
 * 设置键与旧 memo 共享（autoPopupOnStart/openNoteReminder）；memo 侧旧弹窗已随入口改道移除
 * （见 memo/app.ts）。纯接线层：判断用 todo/due + todo/data，打开走 todo/ui 的 openTodoPanel。
 */
import type { App, EventRef } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { TodoData } from './data';
import { getDueStatus } from './due';
import { M } from './state';
import { openTodoPanel } from './ui';
import type { TodoItem } from './types';

/** 是否存在未完成的重要或到期待办（path 给定时只看该笔记的关联待办）——memo/app.ts 同款语义 */
export function hasPendingUrgent(items: TodoItem[], path?: string | null): boolean {
  return items.some(
    (i) =>
      i.completed === null &&
      (!path || i.notePath === path) &&
      (i.priority === 'important' || (i.due && getDueStatus(i.due) !== 'future'))
  );
}

let fileOpenRef: EventRef | null = null;
let startPopupTimer: ReturnType<typeof setTimeout> | null = null;
/** 已提醒笔记（同 memo remindedFiles 口径：同一笔记只提醒一次，防反复弹出） */
const remindedFiles = new Set<string>();

/** 打开待办面板并定位到该笔记的关联待办（面板已开时不闪关，只更新定位条件） */
function openForNote(app: App, path: string): void {
  if (M.overlay) {
    M.search = path;
    const input = M.overlay.querySelector('[data-todo-search]') as HTMLInputElement | null;
    if (input) input.value = path;
    M.renderFn?.();
    return;
  }
  openTodoPanel(app, { notePath: path });
}

/** 启动自动弹出（memo init 同款 300ms 延迟；无重要/到期未完成待办不弹） */
async function autoPopupOnStart(app: App): Promise<void> {
  const items = await TodoData.loadItems();
  M.items = items;
  if (!hasPendingUrgent(items)) return;
  startPopupTimer = setTimeout(() => {
    startPopupTimer = null;
    if (!M.overlay) openTodoPanel(app);
  }, 300);
}

/** 注册提醒后台（幂等；main.ts onLayoutReady 调用） */
export function ensureTodoReminders(app: App): void {
  if (fileOpenRef) return;
  const s = tryGetSettings() as any;
  // 启动自动弹出（开关注册时判定；关=不弹也不设定时）
  if (s?.autoPopupOnStart !== false) void autoPopupOnStart(app);
  // 打开笔记提醒（开关事件触发时判定——设置变更即时生效，无需重注册）
  fileOpenRef = app.workspace.on('file-open', (file: any) => {
    void (async () => {
      if (!file) return;
      if ((tryGetSettings() as any)?.openNoteReminder === false) return;
      const path = file.path as string;
      if (!path || remindedFiles.has(path)) return;
      const items = await TodoData.loadItems();
      M.items = items;
      if (hasPendingUrgent(items, path)) {
        remindedFiles.add(path);
        openForNote(app, path);
      }
    })();
  });
}

/** 卸载清理（todo/index.ts unloadTodo 调用；幂等） */
export function unloadTodoReminders(): void {
  if (fileOpenRef) {
    try {
      M.appRef?.workspace.offref?.(fileOpenRef as any);
    } catch (e) { /* 环境无 offref 时忽略 */ }
    fileOpenRef = null;
  }
  if (startPopupTimer !== null) {
    clearTimeout(startPopupTimer);
    startPopupTimer = null;
  }
  remindedFiles.clear();
}
