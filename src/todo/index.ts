/**
 * 待办（todo）域入口
 * 命令（bz-todo-open / bz-todo-add）由 main.ts 裸注册，此处提供回调。
 * 懒加载：ensureTodo 幂等初始化（ADR-0003）。
 *
 * memo.json 唯一属主（ADR-0092：旧 memo 域已退役删除，todo 全面接管）：
 *   - UI/交互/写盘：本域负责；
 *   - 被动捕获入口（启动自动弹出 / file-open 提醒 / ribbon）：本域提醒后台承担
 *     （src/todo/reminder.ts，落点=待办面板）；
 *   - memo.json 引用同步（file-sync）：本域后台承担（src/todo/file-sync.ts，
 *     订阅 vault:md-renamed/deleted，写 memo.json 语义不变）。
 */
import type { App } from 'obsidian';
import { openTodoPanel as uiOpenPanel, addTodo, ensureTodo, unloadTodo as uiUnload } from './ui';
import { ensureTodoReminders as remindersEnsure, unloadTodoReminders as remindersUnload } from './reminder';
import { TodoData } from './data';
import { tryGetSettings } from '../core/settings-provider';

export { ensureFileSync, unloadFileSync } from './file-sync';

/** main.ts 命令回调：打开待办面板（toggle：开着再点关闭） */
export function openTodoPanel(app: App): void {
  TodoData.init(tryGetSettings() as any);
  ensureTodo(app);
  uiOpenPanel(app);
}

/** main.ts 命令回调：直接打开创建弹窗（bz-todo-add） */
export function addTodoItem(app: App): void {
  TodoData.init(tryGetSettings() as any);
  ensureTodo(app);
  addTodo(app);
}

/** main.ts onLayoutReady：待办提醒后台（启动自动弹出 + 打开笔记提醒；落点=待办面板） */
export function ensureTodoReminders(app: App): void {
  TodoData.init(tryGetSettings() as any);
  ensureTodo(app);
  remindersEnsure(app);
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadTodo(): void {
  uiUnload();
  remindersUnload();
}
