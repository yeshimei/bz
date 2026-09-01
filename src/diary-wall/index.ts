/**
 * 回忆墙（diary-wall）域入口（ADR-0081）
 *
 * 懒加载（ADR-0003）：ensureDiaryWall 幂等初始化（模块标记 + 控制器单例创建）；
 * 命令 bz-diary-wall-open 由 main.ts COMMANDS 裸注册（ADR-0004），onunload 调 unloadDiaryWall。
 * 数据：只读 `我的/日记/*.md`（复用 src/diary/parser.ts，旧域不改写），
 *       媒体走 vault getResourcePath（src/diary-wall/data.ts）。
 * 设置：diaryWallMobileDefaultFullscreen（src/settings.ts）+ diaryWallSettingsSchema（src/diary-wall/settings.ts）。
 *
 * 接口契约（main.ts 依赖）：
 * - ensureDiaryWall(app)  懒加载幂等初始化
 * - openDiaryWall(app)    打开回忆墙主窗口（ensure 后调 controller.show()）
 * - unloadDiaryWall()     卸载清理（幂等）
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { DiaryWallAppController } from './ui';

let initialized = false;
let controller: DiaryWallAppController | null = null;

function getController(): DiaryWallAppController {
  if (!controller) {
    // 移动端默认全屏（ADR-0019 同款键；DEFAULT_SETTINGS 兜底缺字段）
    const mobileDefaultFullscreen = tryGetSettings()?.diaryWallMobileDefaultFullscreen === true;
    controller = DiaryWallAppController.getInstance({ mobileDefaultFullscreen });
  }
  return controller;
}

/** 懒加载幂等初始化（ADR-0003） */
export async function ensureDiaryWall(_app: App): Promise<void> {
  if (initialized) return;
  initialized = true;
  getController();
}

/** 打开回忆墙主窗口（命令回调；ensure 后 show——controller.show 内部惰性创建 DOM） */
export function openDiaryWall(app: App): void {
  void ensureDiaryWall(app).then(() => getController().show());
}

/** 卸载清理（main.ts onunload 调用；未初始化调用为幂等空清理） */
export function unloadDiaryWall(): void {
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
}
