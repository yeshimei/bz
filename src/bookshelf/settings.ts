/**
 * 书架墙（bookshelf）域设置 schema（接入设置面板；窗口内无设置按钮，收敛进 Obsidian 设置面板）
 * 数据与旧 library 域同源：bookshelfFolderPath 缺省回落 libraryFolderPath（同一批书两域同显）；
 * 空值时 chips 区显示实际生效目录（fallbackValue → data.resolveFolderPath，回落链已内置）。
 */
import type { SettingsSchema } from '../core/settings-schema';
import { skinPackOptions } from '../core/skin-pack';
import { resolveFolderPath } from './data';
import { applyBookshelfSkin, BUILTIN_SKIN } from './ui';

/**
 * 面板主题选项：**内置首套（恒首位）+ 已就绪的远端皮肤（清单顺序）**——
 * 不生效（未下载/下架/版本区间外）的皮肤不进选择卡（ADR-0199 决策 6）。
 * 清单在设置面板打开时才求值，故启动同步完成后重开面板即可见新皮肤。
 */
function skinOptions() {
  return skinPackOptions('bookshelf', [
    {
      value: BUILTIN_SKIN,
      label: '雪松白',
      layout: 'default',
      prevClass: `bz-skinprev-bs-${BUILTIN_SKIN}`,
    },
  ]);
}

export function bookshelfSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（标准化：布局行占位单卡 + 主题=bookshelfSkin，layoutKey 联动同范式；
        // onChange 热切换已开面板；退役肤/未就绪远端肤值读取回落雪松白（normalizeSkin））
        icon: 'palette',
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'bookshelfLayout' }, options: [{ value: 'default', label: '书架墙', prevClass: 'bz-sp-prev-panel' }] },
          {
            type: 'choiceCards',
            name: '面板主题',
            binding: { key: 'bookshelfSkin' },
            layoutKey: 'bookshelfLayout',
            options: skinOptions(),
            onChange: (v) => applyBookshelfSkin(v),
          },
        ],
      },
      {
        icon: 'folder-open',
        name: '目录',
        rows: [
          {
            type: 'path',
            mode: 'single',
            name: '书库文件夹',
            desc: '存放书籍笔记的文件夹',
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
    ],
  };
}
