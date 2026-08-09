/**
 * 写日记命令注册（原脚本 3763-3774）。
 * 原「写摘抄」命令（bz-diary-create-quote）及其辅助代码已按用户决策删除（命令清理）。
 */
import { getApp } from '../app';
import { openAddDialog } from './dialogs';

// ===== 命令注册（原 3763-3774） =====

let diaryCommandRegistered = false;

export async function registerOpenDialogCommand() {
  if (!diaryCommandRegistered) {
    (getApp() as any).commands.addCommand({
      id: 'bz-diary-write',
      name: '写日记',
      icon: 'notebook-pen',
      callback: () => {
        openAddDialog();
      },
    });
    diaryCommandRegistered = true;
  }
}
