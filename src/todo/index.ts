/**
 * 待办（todo）域入口
 * 命令（bz-todo-open / bz-todo-add）由 main.ts 裸注册，此处提供回调。
 * 懒加载：ensureTodo 幂等初始化（ADR-0003）。
 *
 * 与旧 memo 域并存（数据同源 memo.json）：
 *   - UI/交互/写盘：本域负责；
 *   - 后台任务（memo.json 引用同步 file-sync、剪藏 AI 匹配归档 clip-archive、
 *     启动自动弹出与 file-open 提醒）：仍由旧 memo 域执行（main.ts ensureMemoFileSync）。
 *   ★ 旧 memo 域删除时迁移清单：
 *     1. main.ts：删 './memo' 相关 import/命令/ensureMemoFileSync 调用，把 openBzPanel/
 *        createMemoItem 接线换成 './todo'（openTodoPanel/addTodoItem），unload 换 unloadTodo；
 *     2. 把 src/memo/file-sync.ts 与 src/memo/clip-archive.ts 迁入本域并接线
 *        （订阅 vault:md-renamed/deleted + clipping:file-created，写 memo.json 语义不变）；
 *     3. 把 memo/app.ts 的 autoPopupOnStart / file-open 提醒逻辑迁入本域
 *        （todoSettingsSchema「提醒」组已就位，设置键 autoPopupOnStart/openNoteReminder 共享）。
 */
import type { App } from 'obsidian';
import { openTodoPanel as uiOpenPanel, addTodo, ensureTodo, unloadTodo as uiUnload } from './ui';
import { TodoData } from './data';
import { tryGetSettings } from '../core/settings-provider';

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

/** 卸载清理（main.ts onunload 调用） */
export function unloadTodo(): void {
  uiUnload();
}
