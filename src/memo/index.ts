/**
 * 备忘录（memo）域入口
 * 命令（bz-memo-open / bz-memo-add）由 main.ts 裸注册，此处提供回调。
 * 懒加载：ensureMemo 幂等初始化（ADR-0003）。
 *
 * memo.json 唯一属主（ADR-0092：旧 memo 域已退役删除，memo 全面接管）：
 *   - UI/交互/写盘：本域负责；
 *   - 被动捕获入口（启动自动弹出 / file-open 提醒 / ribbon）：本域提醒后台承担
 *     （src/memo/reminder.ts，落点=备忘录面板）；
 *   - memo.json 引用同步（file-sync）：本域后台承担（src/memo/file-sync.ts，
 *     订阅 vault:md-renamed/deleted，写 memo.json 语义不变）。
 */
import type { App } from 'obsidian';
import { openMemoPanel as uiOpenPanel, addMemo, ensureMemo, unloadMemo as uiUnload } from './ui';
import { ensureMemoReminders as remindersEnsure, unloadMemoReminders as remindersUnload } from './reminder';
import { MemoData } from './data';
import { tryGetSettings } from '../core/settings-provider';

export { ensureFileSync, unloadFileSync } from './file-sync';

/** main.ts 命令回调：打开备忘录面板（toggle：开着再点关闭） */
export function openMemoPanel(app: App): void {
  MemoData.init(tryGetSettings());
  ensureMemo(app);
  uiOpenPanel(app);
}

/** main.ts 命令回调：直接打开创建弹窗（bz-memo-add） */
export function addMemoItem(app: App): void {
  MemoData.init(tryGetSettings());
  ensureMemo(app);
  addMemo(app);
}

/** main.ts onLayoutReady：备忘录提醒后台（启动自动弹出 + 打开笔记提醒；落点=备忘录面板） */
export function ensureMemoReminders(app: App): void {
  MemoData.init(tryGetSettings());
  ensureMemo(app);
  remindersEnsure(app);
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadMemo(): void {
  uiUnload();
  remindersUnload();
}
