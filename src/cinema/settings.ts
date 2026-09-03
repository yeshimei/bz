/**
 * 影院（cinema）域设置 schema（接入设置面板；窗口内无设置按钮，收敛进 Obsidian 设置面板）
 */
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';

export function cinemaSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'folder-open',
        name: '目录',
        rows: [
          { type: 'path', mode: 'single', name: '影视文件夹', desc: '存放影视笔记的文件夹路径', binding: { key: 'cinemaFolderPath' } },
          // 旧「每批加载数量」（cinemaPageSize）已删除：全仓无消费点（列表一次全量渲染），属死配置
        ],
      },
      mobileFullscreenGroup('cinemaMobileDefaultFullscreen', { desc: '' }),
    ],
  };
}
