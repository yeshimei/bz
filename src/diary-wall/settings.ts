/**
 * 回忆墙（diary-wall）设置 schema（ADR-0081）
 * 回忆墙为「媒体优先只读视图」（不动日记数据），设置项极少：
 * 仅「移动端默认全屏」一行（mobileFullscreenGroup，组级 isMobileEnv 门控）。
 * 与 diary 域共用 mobileFullscreenGroup 预设（src/core/settings-common.ts）。
 */
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';

/** 回忆墙设置 schema（⚙️ 弹窗 / 设置面板共用） */
export function diaryWallSettingsSchema(): SettingsSchema {
  return {
    groups: [
      mobileFullscreenGroup('diaryWallMobileDefaultFullscreen', { desc: '' }),
    ],
  };
}
