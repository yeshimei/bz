/**
 * 回忆墙（diary-wall）设置 schema（ADR-0081）
 * 回忆墙为「媒体优先只读视图」（不动日记数据），设置项极少：
 * 「外观」组（issue 246 占位单卡）+「移动端默认全屏」一行（mobileFullscreenGroup）。
 * 与 diary 域共用 mobileFullscreenGroup 预设（src/core/settings-common.ts）。
 */
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';

/** 回忆墙设置 schema（⚙️ 弹窗 / 设置面板共用） */
export function diaryWallSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
        icon: 'palette',
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '布局', binding: { key: 'diaryWallSkin' }, options: [{ value: 'default', label: '媒体墙', prevClass: 'bz-sp-prev-panel' }] },
          { type: 'choiceCards', name: '主题', binding: { key: 'diaryWallSkinTheme' }, layoutKey: 'diaryWallSkin', options: [{ value: 'gallery', label: '画廊白', layout: 'default', prevClass: 'bz-sp-prev-gallery' }] },
        ],
      },
      mobileFullscreenGroup('diaryWallMobileDefaultFullscreen', { desc: '' }),
    ],
  };
}
