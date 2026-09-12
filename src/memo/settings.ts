/**
 * 备忘录（memo）域设置 schema（接入设置面板；窗口内无设置按钮，收敛进 Obsidian 设置面板）
 * 设置键全部绑定旧 memo 既有键（memoScenarios/memoSortMode/…）——并存期与旧 memo 共享
 * 设置、删旧域后零迁移。
 * 提醒组：启动自动弹出 / 打开笔记提醒已由本域提醒后台承担（memo/reminder.ts，
 * 落点=备忘录面板；memo→memo 接管迁移第 3 项提前实施），旧 memo 侧对应入口已改道移除。
 */
import { getSettings, saveSettings } from '../core/settings-provider';
import type { SettingsSchema } from '../core/settings-schema';
import { MemoData } from './data';
import { applyMemoSkin } from './ui';

/** 场景变更后即时生效：重建数据层场景列表（打开中的面板下次渲染即用） */
function memoReloadScenes() {
  MemoData.init(getSettings());
}

export function memoSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（标准化：与其他域同范式置顶——布局行占位单卡，主题=memoSkin 两肤；
        // 布局维度待皮肤设计时接入）
        icon: 'palette',
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'memoLayout' }, options: [{ value: 'default', label: '清单', prevClass: 'bz-sp-prev-panel' }] },
          {
            type: 'choiceCards',
            name: '面板主题',
            binding: { key: 'memoSkin' },
            layoutKey: 'memoLayout',
            options: [
              { value: 'paper', label: '纸感手账', layout: 'default', prevClass: 'bz-skinprev-paper' },
              { value: 'editorial', label: '编辑部', layout: 'default', prevClass: 'bz-skinprev-editorial' },
            ],
            onChange: (v) => applyMemoSkin(v),
          },
        ],
      },
      {
        icon: 'eye',
        name: '显示',
        rows: [
          {
            type: 'select',
            name: '打开默认场景',
            desc: '打开备忘录面板时默认选中的场景',
            binding: { key: 'memoOpenScene' },
            options: [
              { value: '@last', label: '上次停留' },
              { value: '全部', label: '全部' },
              { value: '今日', label: '今日' },
              { value: '重要', label: '重要' },
              ...MemoData.getScenarios().map((sc) => ({ value: sc, label: sc })),
            ],
          },
          {
            type: 'select',
            name: '默认排序方式',
            desc: '面板条目按所选规则排序',
            binding: { key: 'memoSortMode' },
            options: [
              { value: 'priority', label: '紧急优先' },
              { value: 'due', label: '仅按到期时间' },
              { value: 'created', label: '按创建时间' },
            ],
          },
          {
            type: 'toggle',
            name: '默认显示已完成',
            desc: '打开面板时同时展开已完成折叠区',
            binding: { key: 'memoShowArchivedByDefault' },
          },
          {
            type: 'select',
            name: '已完成显示范围',
            desc: '展开已完成折叠区时列出最近多少天完成的条目',
            binding: { key: 'memoDoneWindow' },
            options: [
              { value: '7', label: '近 7 天' },
              { value: '30', label: '近 30 天' },
              { value: '90', label: '近 90 天' },
              { value: 'all', label: '全部' },
            ],
          },
        ],
      },
      {
        icon: 'pencil-line',
        name: '新建',
        rows: [
          {
            type: 'select',
            name: '新条目默认优先级',
            desc: '新建备忘录时默认选中的优先级',
            binding: { key: 'memoDefaultPriority' },
            options: [
              { value: 'minor', label: '次要' },
              { value: 'important', label: '重要' },
            ],
          },
          {
            type: 'select',
            name: '新条目默认场景',
            desc: '新建备忘录时默认选用的场景',
            binding: { key: 'memoDefaultScene' },
            options: [
              { value: '', label: '第一个场景' },
              ...MemoData.getScenarios().map((sc) => ({ value: sc, label: sc })),
            ],
          },
        ],
      },
      {
        icon: 'tags',
        name: '场景列表',
        rows: [
          {
            type: 'textarea',
            name: '自定义场景列表',
            desc: '场景名用逗号分隔，留空使用默认场景',
            placeholder: '剪藏,工作,学习,生活,代码,公开课',
            binding: { key: 'memoScenarios' },
            onCommit: memoReloadScenes,
          },
        ],
      },
      {
        icon: 'bell',
        name: '提醒',
        rows: [
          {
            type: 'toggle',
            name: '启动时自动弹出',
            desc: '启动时若有重要或到期未完成的备忘录，自动打开备忘录面板提醒',
            binding: { key: 'autoPopupOnStart' },
          },
          {
            type: 'toggle',
            name: '打开笔记自动提醒',
            desc: '打开笔记时若有重要或到期的备忘录，自动弹出面板并定位到它',
            binding: {
              get: () => getSettings().openNoteReminder !== false,
              set: (v) => {
                (getSettings() as any).openNoteReminder = v;
              },
              save: () => saveSettings(),
            },
          },
        ],
      },
    ],
  };
}
