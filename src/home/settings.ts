/**
 * 首页（home 域）设置 schema（2026-09-10 用户拍板）。
 *
 * 两组，顺序固定：**外观在上、入口在下**（用户 2026-09-10 拍板）。
 *  - 「外观」= 与其他域同范式（issue 246）：布局行「活动河」+ 主题行「米白」，
 *    占位键 homeLayout/homeSkin（可看可选可落盘；域 UI 消费在首页真做皮肤时接入，
 *    届时挂 onChange 热切换——与日记本/剪藏本等占位域同口径）。
 *  - 「入口」= 首页入口的顺序与显隐，**内联在面板里**编辑（custom 行 + ./entry-editor，
 *    不再开浮层弹窗、不再有「编辑入口…」按钮，也不再挂「移除的域仍可从命令面板打开」说明行）。
 * **按端各一份、互不影响**：桌面端只显示/只改桌面那套（顺序 + 隐藏），
 * 移动端只显示/只改移动那套 —— 由 entry-editor 依环境判定，schema 层不传端。
 * 数据落 home.json（见 ./order），与首页渲染共用 shared.visibleDomains 同一口径。
 */
import { getApp } from '../core/app';
import type { SettingsSchema } from '../core/settings-schema';
import { mountHomeEntryEditor } from './entry-editor';

export function homeSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（issue 246 范式，与各域同款置顶）：布局/主题各一档占位单卡
        icon: 'palette',
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'homeLayout' }, options: [{ value: 'default', label: '活动河', prevClass: 'bz-sp-prev-panel' }] },
          { type: 'choiceCards', name: '面板主题', binding: { key: 'homeSkin' }, layoutKey: 'homeLayout', options: [{ value: 'cream', label: '米白', layout: 'default', prevClass: 'bz-sp-prev-cream' }] },
        ],
      },
      {
        // 入口组（排外观之下）：拖动排序 + 移除/加回，内联编辑器
        icon: 'layout-grid',
        name: '入口',
        rows: [
          {
            type: 'custom',
            render: (body) => mountHomeEntryEditor(body, getApp()),
          },
        ],
      },
    ],
  };
}
