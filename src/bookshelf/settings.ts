/**
 * 书架墙（bookshelf）域设置 schema（接入设置面板；窗口内无设置按钮，收敛进 Obsidian 设置面板）
 * 数据与旧 library 域同源：bookshelfFolderPath 缺省回落 libraryFolderPath（同一批书两域同显）；
 * 空值时 chips 区显示实际生效目录（fallbackValue → data.resolveFolderPath，回落链已内置）。
 */
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import { resolveFolderPath } from './data';
import { applyBookshelfSkin } from './ui';

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
            // 面板皮肤（issue 235 五肤×亮暗）：choiceCards「看脸选」；每肤配亮暗两套变体，
            // Obsidian 主题切模式（bz-bs-mode-*）；默认雪松白；onChange 热切换已开面板；
            // 存量退役肤值（dark/wabi/bauhaus/blueprint/neon）读取时回落雪松白（normalizeSkin）
            type: 'choiceCards',
            name: '面板皮肤',
            binding: { key: 'bookshelfSkin' },
            options: [
              { value: 'nordic', label: '雪松白', prevClass: 'bz-skinprev-bs-nordic' },
              { value: 'noir', label: '黑金夜曲', prevClass: 'bz-skinprev-bs-noir' },
              { value: 'kraft', label: '牛皮手帐', prevClass: 'bz-skinprev-bs-kraft' },
              { value: 'velvet', label: '丝绒剧院', prevClass: 'bz-skinprev-bs-velvet' },
              { value: 'mono', label: '极简黑白', prevClass: 'bz-skinprev-bs-mono' },
            ],
            onChange: (v) => applyBookshelfSkin(v),
          },
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
            desc: '打开面板时书脊按所选规则排序',
            binding: { key: 'bookshelfSortMode' },
            options: [
              { value: 'recent', label: '最近读完' },
              { value: 'time', label: '时长最长' },
              { value: 'title', label: '书名' },
            ],
          },
        ],
      },
      mobileFullscreenGroup('bookshelfMobileDefaultFullscreen'),
    ],
  };
}
