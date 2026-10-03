/**
 * 工具坞（dock）域设置 schema（接入设置面板）。
 *
 * 有意为之的「少」——dock 的配置**绝大多数是每个工具自己的**：标题、描述、参数、节奏、
 * 怎么跑，全随工具目录里的声明文件（`dock.json`）走，住在工具侧，不在这里。而登记表
 * （「导入哪份声明」）是本插件权限最高的数据，按 ADR-0235 决策只走面板内「导入声明」、
 * 不做设置页行编辑（一旦能从别处改，「打开别人的 vault」就等于「在他机器上执行任意命令」）。
 *
 * 于是本页只剩两件**全域**的事：去哪儿管工具，以及漏跑提不提醒。
 */
import type { SettingsSchema } from '../core/settings-schema';
import { getApp } from '../core/app';
import { openDock } from './ui';

export function dockSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'container',
        name: '工具',
        rows: [
          {
            type: 'info',
            name: '外部工具登记',
            desc: '添加、编辑、信任与运行都在工具坞面板里',
            actions: [
              {
                text: '打开工具坞',
                cta: true,
                onClick: () => openDock(getApp()),
              },
            ],
          },
        ],
      },
      {
        icon: 'bell',
        name: '提醒',
        rows: [
          {
            type: 'toggle',
            name: '漏跑提醒',
            desc: '工具声明了节奏、当天却没有记录时发一条通知',
            binding: { key: 'dockNotifyMissed' },
          },
        ],
      },
    ],
  };
}
