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
import { openMemoPanel as uiOpenPanel, addMemo, openEditor, ensureMemo, unloadMemo as uiUnload } from './ui';
import { ensureMemoReminders as remindersEnsure, unloadMemoReminders as remindersUnload } from './reminder';
import { MemoData } from './data';
import { tryGetSettings } from '../core/settings-provider';
import { notice } from '../core/notice';
import { getCurrentNoteInfo, getCurrentCursorPosition } from '../core/utils';

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

/**
 * 给当前笔记记一笔（命令 bz-memo-note-binding，2026-09-11 首页入口菜单）：
 * 与「写备忘」同一个创建弹窗，区别是**关联笔记已预置**——把当前打开的笔记（含光标位置）
 * 直接写进表单的「定位」字段，省掉进弹窗再点一次「定位到笔记」。
 * 当前没有打开的笔记（空工作区/首页背后不是笔记）时照常开弹窗，只提示未绑定。
 */
export function addMemoForActiveNote(app: App): void {
  MemoData.init(tryGetSettings());
  ensureMemo(app);
  const info = getCurrentNoteInfo();
  if (!info) {
    notice('当前没有打开的笔记，未绑定', 'warning');
    addMemo(app);
    return;
  }
  openEditor(null, { presetNote: { path: info.path, position: getCurrentCursorPosition() } });
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
