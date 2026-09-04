/**
 * 影院（cinema）域设置 schema（接入设置面板；窗口内无设置按钮，收敛进 Obsidian 设置面板）
 * issue 194：补「显示」组——默认排序/默认状态筛选（打开面板时读，非法值回落，见 index.ts readDefaultView）。
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
          { type: 'path', mode: 'single', name: '影视文件夹', desc: '影院读取的影视文件夹，日记本设置的影视目录仅用于归类', binding: { key: 'cinemaFolderPath' } },
          // 旧「每批加载数量」（cinemaPageSize）已删除：全仓无消费点（列表一次全量渲染），属死配置
        ],
      },
      {
        icon: 'eye',
        name: '显示',
        rows: [
          {
            type: 'select',
            name: '默认排序',
            desc: '打开面板时列表按所选规则排序',
            binding: { key: 'cinemaSortMode' },
            options: [
              { value: 'date', label: '最近观看' },
              { value: 'created', label: '按创建时间' },
              { value: 'rating', label: '按评分' },
            ],
          },
          {
            type: 'select',
            name: '默认状态筛选',
            desc: '打开面板时选中的状态筛选',
            binding: { key: 'cinemaStatusFilter' },
            options: [
              { value: '', label: '全部' },
              { value: '想看', label: '想看' },
              { value: '在看', label: '在看' },
              { value: '已看', label: '已看' },
            ],
          },
        ],
      },
      mobileFullscreenGroup('cinemaMobileDefaultFullscreen', { desc: '' }),
    ],
  };
}
