/**
 * 书架墙（bookshelf）域设置 schema（接入设置面板；窗口内无设置按钮，收敛进 Obsidian 设置面板）
 * 数据与旧 library 域同源：bookshelfFolderPath 缺省回落 libraryFolderPath（同一批书两域同显）。
 */
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';

export function bookshelfSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'folder-open',
        name: '目录',
        rows: [
          {
            type: 'path',
            mode: 'single',
            name: '书库文件夹',
            desc: '存放书籍笔记的文件夹路径（未设置时沿用书库设置）',
            binding: { key: 'bookshelfFolderPath' },
          },
        ],
      },
      mobileFullscreenGroup('bookshelfMobileDefaultFullscreen'),
    ],
  };
}
