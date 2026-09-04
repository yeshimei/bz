/**
 * 待办（todo）域设置 schema（接入设置面板；窗口内无设置按钮，收敛进 Obsidian 设置面板）
 * 设置键全部绑定旧 memo 既有键（memoScenarios/memoSortMode/…）——并存期与旧 memo 共享
 * 设置、删旧域后零迁移；唯一新键 todoMobileDefaultFullscreen 是本域面板的移动全屏开关。
 * 提醒组：启动自动弹出 / 打开笔记提醒已由本域提醒后台承担（todo/reminder.ts，
 * 落点=待办面板；memo→todo 接管迁移第 3 项提前实施），旧 memo 侧对应入口已改道移除。
 */
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import { TodoData } from './data';

/** 场景变更后即时生效：重建数据层场景列表（打开中的面板下次渲染即用） */
function todoReloadScenes() {
  TodoData.init(getSettings() as any);
}

export function todoSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'eye',
        name: '显示',
        rows: [
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
            name: '到期时间格式',
            desc: '到期时间按相对或绝对格式显示',
            binding: { key: 'memoDueFormat' },
            options: [
              { value: 'relative', label: '相对' },
              { value: 'absolute', label: '绝对' },
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
            desc: '新建待办时默认选中的优先级',
            binding: { key: 'memoDefaultPriority' },
            options: [
              { value: 'minor', label: '次要' },
              { value: 'important', label: '重要' },
            ],
          },
          {
            type: 'select',
            name: '新条目默认场景',
            desc: '新建待办时默认选用的场景',
            binding: { key: 'memoDefaultScene' },
            options: [
              { value: '', label: '第一个场景' },
              ...TodoData.getScenarios().map((sc) => ({ value: sc, label: sc })),
            ],
          },
          {
            type: 'toggle',
            name: '完成后自动归档',
            desc: '勾选完成后条目移入已完成折叠区，关闭则留在主列表并划线显示',
            binding: {
              get: () => getSettings().memoAutoArchive !== false,
              set: (v) => {
                (getSettings() as any).memoAutoArchive = v;
              },
              save: () => saveSettings(),
            },
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
            desc: '场景名用逗号分隔，留空使用默认场景（与旧备忘录共用）',
            placeholder: '剪藏,工作,学习,生活,代码,公开课',
            binding: { key: 'memoScenarios' },
            onCommit: todoReloadScenes,
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
            desc: '启动时若有重要或到期未完成的待办，自动打开待办面板提醒',
            binding: { key: 'autoPopupOnStart' },
          },
          {
            type: 'toggle',
            name: '打开笔记自动提醒',
            desc: '打开笔记时若笔记有重要或到期的未完成待办，自动打开待办面板并定位到关联待办',
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
      // ticket 170 铁律：移动端组不写描述（对齐其余 14 域）
      mobileFullscreenGroup('todoMobileDefaultFullscreen'),
    ],
  };
}
