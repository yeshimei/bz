/**
 * 日记本设置 schema。
 * 组序：外观 / 目录 / 存储 / 分类 / 显示。
 * - 目录：只保留日记文件夹（信件文件夹按用户要求从设置页隐藏，键与读写逻辑保留）；
 * - 存储：custom 行（两种格式卡片 + 切换确认 + 转换进度，见 ./settings-format）；
 * - 分类：custom 行（清单式，全部平级，见 ./settings-types）；
 * - 显示：写日记时间口径、每卷则数。
 * 「维护」组与「日记格式体检」弹窗按用户拍板退役（2026-09-25）——格式 lint 仍留在
 * src/diary/repair.ts（store 写入路径消费），只是不再有手动体检入口。
 * ⚙️ 弹窗 / 设置面板「日记本」页共用本 schema。
 */
import type { SettingsSchema } from '../core/settings-schema';
import { getSettings } from '../core/settings-provider';
import { applyDirectories } from './config';
import { mountDiaryFormatEditor } from './settings-format';
import { mountDiaryTypeEditor } from './settings-types';

/** 日记本设置 schema */
export function diarySettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（issue 246 范式）：布局/主题各一档，域 UI 消费待皮肤设计时接入
        icon: 'palette',
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'diarySkin' }, options: [{ value: 'default', label: '媒体墙', prevClass: 'bz-sp-prev-panel' }] },
          { type: 'choiceCards', name: '面板主题', binding: { key: 'diarySkinTheme' }, layoutKey: 'diarySkin', options: [{ value: 'gallery', label: '画廊白', layout: 'default', prevClass: 'bz-sp-prev-gallery' }] },
        ],
      },
      {
        icon: 'folder-open',
        name: '目录',
        rows: [
          {
            type: 'path',
            mode: 'single',
            name: '日记文件夹',
            desc: '留空则跟随 Obsidian 日记本的目录',
            binding: { key: 'diaryDirectory' },
            onChange: () => applyDirectories(getSettings()),
          },
        ],
      },
      {
        icon: 'hard-drive',
        name: '存储',
        rows: [{ type: 'custom', render: (body) => mountDiaryFormatEditor(body) }],
      },
      {
        icon: 'tags',
        name: '分类',
        rows: [{ type: 'custom', render: (body) => mountDiaryTypeEditor(body) }],
      },
      {
        icon: 'eye',
        name: '显示',
        rows: [
          { type: 'toggle', name: '默认日期取自文件', desc: '默认日期取自当前打开的日记文件', binding: { key: 'useFileDateTime' } },
          {
            type: 'number',
            name: '每卷装多少则',
            desc: '一册只摊开一卷，凑够这么多则就另装一卷',
            binding: { key: 'diaryPageSize' },
            min: 10,
            max: 500,
            step: 10,
          },
        ],
      },
    ],
  };
}
