import type { SettingsSchema } from '../core/settings-schema';

/** 面板「外观」组（拍板原型 P1 落域）：单组「外观」= 上布局行 + 下主题行。
 *  2026-09-12 用户拍板：原独立「设置」域撤销，本组并入「通用」域并排最前
 *  （键与工厂名不变，ui.ts 的 general loader 消费本组）。
 *  布局与主题各一套（拍板：不做多选）；晨昏 = 自动亮暗跟随 Obsidian，无独立亮暗策略键。 */
export function appearanceSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'palette',
        name: '外观',
        rows: [
          {
            type: 'choiceCards',
            name: '布局',
            binding: { key: 'settingsPanelLayout' },
            options: [{ value: 'jingwei', label: '经纬', prevClass: 'bz-sp-prev-jingwei' }],
          },
          {
            type: 'choiceCards',
            name: '主题',
            binding: { key: 'settingsPanelSkin' },
            options: [{ value: 'chenhun', label: '晨昏', prevClass: 'bz-sp-prev-chenhun' }],
          },
        ],
      },
    ],
  };
}
