/**
 * 书架墙（bookshelf）域设置 schema（接入设置面板；窗口内无设置按钮，收敛进 Obsidian 设置面板）
 * 数据与旧 library 域同源：bookshelfFolderPath 缺省回落 libraryFolderPath（同一批书两域同显）；
 * 空值时 chips 区显示实际生效目录（fallbackValue → data.resolveFolderPath，回落链已内置）。
 */
import { mobileFullscreenGroup, numStrBinding } from '../core/settings-common';
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
            // 面板皮肤（issue 216）：对齐待办 choiceCards 范式——预览卡「看脸选」，无编号无描述；
            // 默认雪松白；onChange 热切换已开面板（applyBookshelfSkin），未开仅落盘下次打开生效
            type: 'choiceCards',
            name: '面板皮肤',
            binding: { key: 'bookshelfSkin' },
            options: [
              { value: 'nordic', label: '雪松白', prevClass: 'bz-skinprev-bs-nordic' },
              { value: 'dark', label: '暗木书房', prevClass: 'bz-skinprev-bs-dark' },
              { value: 'noir', label: '黑金夜曲', prevClass: 'bz-skinprev-bs-noir' },
              { value: 'wabi', label: '侘寂素麻', prevClass: 'bz-skinprev-bs-wabi' },
              { value: 'bauhaus', label: '包豪斯', prevClass: 'bz-skinprev-bs-bauhaus' },
              { value: 'blueprint', label: '工程蓝图', prevClass: 'bz-skinprev-bs-blueprint' },
              { value: 'neon', label: '霓虹夜馆', prevClass: 'bz-skinprev-bs-neon' },
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
            desc: '打开面板时列表按所选规则排序',
            binding: { key: 'bookshelfSortMode' },
            options: [
              { value: 'date', label: '最近阅读' },
              { value: 'title', label: '书名' },
              { value: 'author', label: '作者' },
              { value: 'progress', label: '进度' },
            ],
          },
          {
            type: 'number',
            name: '网格每行列数',
            desc: '封面网格每一行的列数，范围 2 到 12，重开面板生效',
            binding: numStrBinding('bookshelfGridColumns', 6),
            min: 2,
            max: 12,
            step: 1,
          },
        ],
      },
      mobileFullscreenGroup('bookshelfMobileDefaultFullscreen'),
    ],
  };
}
