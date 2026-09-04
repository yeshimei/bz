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
            desc: '存放书籍笔记的文件夹，留空用 vault 根下的「书库」',
            binding: { key: 'bookshelfFolderPath' },
            fallbackValue: () => resolveFolderPath(),
          },
        ],
      },
      {
        icon: 'eye',
        name: '显示',
        rows: [
          {
            type: 'select',
            name: '默认筛选',
            desc: '打开面板时侧栏选中的状态',
            binding: { key: 'bookshelfDefaultSide' },
            options: [
              { value: 'all', label: '全部' },
              { value: 'reading', label: '在读' },
              { value: 'unread', label: '未读' },
              { value: 'done', label: '已读' },
            ],
          },
          {
            type: 'select',
            name: '默认排序',
            desc: '打开面板时列表按所选规则排序',
            binding: { key: 'bookshelfSortMode' },
            options: [
              { value: 'date', label: '最近阅读' },
              { value: 'title', label: '书名' },
              { value: 'author', label: '作者' },
              { value: 'progress', label: '进度' },
            ],
          },
        ],
      },
      mobileFullscreenGroup('bookshelfMobileDefaultFullscreen'),
    ],
  };
}
