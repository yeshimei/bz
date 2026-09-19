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
 * - prewarmDiary(app, isUnloaded) 启动后台预热墙数据（仅数据，不建 DOM，ADR-0003 兼容）
 * - unloadDiary()       卸载清理（幂等）
 */
import type { App } from 'obsidian';
import { DiaryAppController } from './ui';
import { loadWallEntries, resetWallCache } from './data';
import { createAddDialog, createTagPicker, openAddDialog } from './ui/dialogs';

let initialized = false;
let prewarmed = false;
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

/** 启动后台预热墙数据（②）：仅 loadWallEntries 填数据缓存，不建 DOM/不实例化控制器——
 *  ADR-0003 兼容（UI 仍懒加载，不拖慢启动关键路径）。幂等；延迟一拍到浏览器空闲再读。
 *  isUnloaded 为真（插件在延迟窗口内被禁用）时不预热，防幽灵加载（C13 同 ensureSecondBrainOnReady）。
 *  失败静默：预热只是加速，真正打开时 loadAndRender 会自行重读并呈现错误态。 */
export function prewarmDiary(app: App, isUnloaded: () => boolean = () => false): void {
  if (prewarmed) return;
  prewarmed = true;
  const run = (): void => {
    if (isUnloaded()) return;
    void loadWallEntries(app).catch((e) => console.warn('[diary] 后台预热失败:', e));
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => setTimeout(run, 0));
  } else {
    setTimeout(run, 0);
  }
}

/** 卸载清理（main.ts onunload 调用；未初始化调用为幂等空清理）。
 *  D15：标签选择器/写日记弹窗两个 body 级 mask 随懒加载常驻 body——不摘会成为
 *  不可见不可点的纯残留，卸载时按 id 移除。 */
export function unloadDiary(): void {
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
  prewarmed = false;
  resetWallCache(); // ②：复位墙数据缓存 + 摘域事件失效订阅，重新启用插件时重新预热
  document.getElementById('diary-tag-selector-mask')?.remove();
  document.getElementById('add-diary-mask')?.remove();
}
