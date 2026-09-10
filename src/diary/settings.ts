/**
 * 日记本设置 schema（ADR-0115：旧 diary 12 键按消费面收编为 3 键 + 2 跨域读）。
 * 「外观」沿用 issue 246 范式（diarySkin 布局行「媒体墙」+ diarySkinTheme 主题行「画廊白」layoutKey 联动）；
 * 「目录」仅日记/信两键（影视走影院域 cinemaFolderPath、书库走书架墙域 resolveFolderPath，跨域读）；
 * 「显示」useFileDateTime（写日记弹窗时间口径）；
 * 「维护」日记解析检测按钮（修复弹窗入口落设置页）。
 * ⚙️ 弹窗 / 设置面板「日记本」页共用本 schema。
 */
import type { SettingsSchema } from '../core/settings-schema';
import { getSettings } from '../core/settings-provider';
import { applyDirectories } from './config';
import { openDiaryRepairModal } from './ui/repair-modal';

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
          { type: 'path', mode: 'single', name: '日记目录', desc: '存放日记文件的文件夹路径', binding: { key: 'diaryDirectory' }, onChange: () => applyDirectories(getSettings()) },
          { type: 'path', mode: 'single', name: '信件目录', desc: '存放信件的文件夹路径', binding: { key: 'letterDirectory' }, onChange: () => applyDirectories(getSettings()) },
        ],
      },
      {
        icon: 'eye',
        name: '显示',
        rows: [
          { type: 'toggle', name: '默认日期取自文件', desc: '写日记时默认日期取自当前打开的日记文件，否则用当前时间', binding: { key: 'useFileDateTime' } },
        ],
      },
      {
        icon: 'wrench',
        name: '维护',
        rows: [
          { type: 'button', name: '日记解析检测', desc: '扫描所有日记文件，定位未能解析的行，可一键修复标题格式问题', buttonText: '检测日记解析', cta: true, onClick: () => openDiaryRepairModal() },
        ],
      },
    ],
  };
}
