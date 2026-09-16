/**
 * 归物本域入口（ticket 06 移植 + ticket 177 重构）
 * 命令（belongings-add-item/belongings-open/belongings-report）由 main.ts 裸注册，此处提供回调。
 * 归物本无常驻监听，无需懒加载初始化。
 */
import type { App } from 'obsidian';
import { openPanel, openForm, cleanupBelongings, openBelongingsReportView } from './ui';

/** 添加物品（bz-belongings-add 命令：直接弹记一笔表单） */
export function addBelongingsItem(app: App): void {
  openForm(null);
}

/** 打开归物本面板（bz-belongings-open 命令） */
export function openBelongings(app: App): void {
  void openPanel();
}

/** 打开年度资产报告页（bz-belongings-report 命令，issue 356；面板未开也从盘载库直开） */
export function openBelongingsReport(app: App): void {
  void openBelongingsReportView();
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadBelongings(): void {
  cleanupBelongings();
}
