/**
 * 日记本（diary）域入口（ADR-0115：回忆墙升格正名，issue 256）
 *
 * 懒加载（ADR-0003）：ensureDiary 幂等初始化（模块标记 + 控制器单例 + 写链路弹窗 DOM）；
 * 命令 bz-diary-open / bz-diary-write 由 main.ts COMMANDS 裸注册（ADR-0004），onunload 调 unloadDiary。
 * 数据：只读聚合 `我的/日记` + 影视 + 信 + 书（./data），写链路经 ./store 写层（守卫 + 串行队列），
 *       媒体走 vault getResourcePath。
 *
 * 接口契约（main.ts 依赖）：
 * - ensureDiary(app)    懒加载幂等初始化
 * - openDiary(app)      打开日记本主窗口（ensure 后调 controller.show()）
 * - openDiaryWrite(app) 写日记命令回调（ensure 后开写日记弹窗，不拉起主窗口）
 * - unloadDiary()       卸载清理（幂等）
 */
import type { App } from 'obsidian';
import { DiaryAppController } from './ui';
import { createAddDialog, createTagPicker, openAddDialog } from './ui/dialogs';

let initialized = false;
let controller: DiaryAppController | null = null;

function getController(): DiaryAppController {
  if (!controller) {
    controller = DiaryAppController.getInstance();
  }
  return controller;
}

/** 懒加载幂等初始化（ADR-0003）：控制器 + 写链路弹窗 DOM（标签选择器/写日记弹窗，幂等重建） */
export async function ensureDiary(_app: App): Promise<void> {
  if (initialized) return;
  initialized = true;
  getController();
  createTagPicker();
  createAddDialog();
}

/** 打开日记本主窗口（命令回调；ensure 后 show——controller.show 内部惰性创建 DOM） */
export function openDiary(app: App): void {
  void ensureDiary(app).then(() => getController().show());
}

/** 写日记命令回调（bz-diary-write）：ensure 后直接开写日记弹窗；滚轮年份范围取自当前墙数据 */
export function openDiaryWrite(app: App): void {
  void ensureDiary(app).then(() => {
    openAddDialog({ yearRange: getController().getYearRange() ?? undefined });
  });
}

/** 卸载清理（main.ts onunload 调用；未初始化调用为幂等空清理） */
export function unloadDiary(): void {
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
}
