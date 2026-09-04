/**
 * 书架墙（bookshelf）域设置 schema（接入设置面板；窗口内无设置按钮，收敛进 Obsidian 设置面板）
 * 数据与旧 library 域同源：bookshelfFolderPath 缺省回落 libraryFolderPath（同一批书两域同显）；
 * 空值时 chips 区显示实际生效目录（fallbackValue → data.resolveFolderPath，回落链已内置）。
 */
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import { resolveFolderPath } from './data';

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
            desc: '存放书籍笔记的文件夹路径，留空时读旧书库遗留设置的存量值，再回落书库',
            binding: { key: 'bookshelfFolderPath' },
            fallbackValue: () => resolveFolderPath(),
          },
        ],
      },
      mobileFullscreenGroup('bookshelfMobileDefaultFullscreen'),
    ],
  };
}
