/**
 * 工具坞（dock）域设置 schema（接入设置面板）。
 *
 * 有意为之的「少」——dock 的配置**绝大多数是每个工具自己的**：标题、描述、参数、节奏、
 * 怎么跑，全随工具目录里的声明文件（`manifest.json`）走，住在工具侧，不在这里。登记表本身
 * （「导入哪份声明」）也只走面板内「导入声明」，不做设置页行编辑 —— 一旦能从别处直接改命令，
 * 「打开别人的 vault」就等于「在他机器上执行任意命令」（ADR-0235 决策）。
 *
 * 于是本页只有四件**全域**的事，前三件是开关/入口，第四件是**信任**：
 *  1. 去哪儿管工具（打开面板）；
 *  2. 自动跑不跑（`dock.json` 的 `autoRun`，ADR-0236）；
 *  3. 漏跑提不提醒（`dock.json` 的 `notifyMissed`）；
 *  4. 哪些命令已被授权在本机执行（**插件设置**的 `dockTrust`，ADR-0239）。
 *     这一组只做两件事：**撤销**（就地撤，立刻生效）与**授权**（按声明当前那条命令授）。
 *     两边的列表都只显示命令文本，不给「手写一条命令」的入口 —— 授权对象永远是声明文件里
 *     现读出来的那条命令，用户没法在这里凭空造一条信任。
 */
import type { SettingsListItem, SettingsRow, SettingsSchema } from '../core/settings-schema';
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { openDock } from './ui';
import {
  readDockSwitch,
  readToolEntries,
  readTrustRecords,
  runSignature,
  setDockSwitch,
  untrustTool,
  updateToolEntry,
  type DockToolEntry,
} from './data';
import { readDeclaration, resolveRun, type ResolvedRun } from './declaration';
import { loadDockStore, persistDockStore, type DockSwitchKey } from './store';

/**
 * 两个全域开关的绑定 —— 值住面板数据 `dock.json`（ADR-0239），不在插件设置里，
 * 所以走绑定的三函数逃生口（`get` / `set` / `save`，设置行按这个序调用）：
 * `get` 读内存快照、`set` 改内存、`save` 落盘。没有草稿态 —— 开关是「改完立刻可见」的控件。
 */
function switchBinding(key: DockSwitchKey) {
  return {
    get: () => readDockSwitch(key),
    set: (v: boolean) => setDockSwitch(key, v),
    // 落盘前先对齐盘上现值：外部（同步盘）改过 dock.json 的窗口内，不拿过期快照整文件覆盖
    // （persist 是整文件写）。顺序关键 —— 先取用户本次拨的值（还在内存快照里），重载
    // （会用盘上现值覆盖快照），再把本次拨动补回去，最后整文件落盘
    save: async () => {
      const v = readDockSwitch(key);
      await loadDockStore();
      setDockSwitch(key, v);
      await persistDockStore();
    },
  };
}

// ==================== 信任组（ADR-0239） ====================

/** 某工具**当前声明**解析出的启动命令（声明读不到 / 没写 run → null） */
function resolvedRunOf(entry: DockToolEntry): ResolvedRun | null {
  const decl = readDeclaration(entry.path);
  return resolveRun(decl.manifest ?? null, decl.path ?? entry.path, decl.conventionalRun);
}

/** 命令的人话形式（`node main.mjs`）；解析不出来时给一句原因，不当成「没有命令」静默略过 */
function commandTextOf(entry: DockToolEntry, run: ResolvedRun | null): string {
  if (run) return [run.cmd, ...run.args].join(' ');
  return readDeclaration(entry.path).ok ? '声明里没写怎么跑' : '声明文件读不到';
}

/** 一个工具 → 一条列表项（主文案 = 声明里的名字，副文案 = 那条命令） */
function trustItemOf(entry: DockToolEntry): SettingsListItem {
  const run = resolvedRunOf(entry);
  return {
    key: entry.id,
    label: readDeclaration(entry.path).manifest?.name || entry.id,
    sub: commandTextOf(entry, run),
  };
}

/** 已登记工具里「已信任 / 未信任」的那一半（每次现读：列表行会在每次改动后重读重建） */
function trustItems(wantTrusted: boolean): SettingsListItem[] {
  const trust = readTrustRecords();
  return readToolEntries()
    .filter((e) => e.id in trust === wantTrusted)
    .map(trustItemOf);
}

/**
 * 信任组的两行（都是列表行：逐条带动作钮，改完自动重读重建）：
 *  - 「已信任的命令」：撤销 = 从设置里删掉那条授权，不动 `dock.json`；
 *  - 「还没确认的命令」：授权 = 按**声明当前那条命令**算签名写进 `dockTrust`
 *    （签名绑命令，作者后来改了 `run` 就自动作废 —— 与面板内「重新导入声明」同一把尺子）。
 */
function trustRows(): SettingsRow[] {
  if (readToolEntries().length === 0) {
    return [{ type: 'info', name: '还没有登记工具', desc: '在工具坞面板里「导入声明」登记一个外部脚本' }];
  }
  return [
    {
      type: 'list',
      name: '已信任的命令',
      desc: '信任绑的是这条启动命令；声明里的命令一改，信任自动作废',
      variant: 'dense',
      removeLabel: '撤销信任',
      emptyText: '还没有授权过任何命令',
      items: () => trustItems(true),
      onChange: async (rest) => {
        const revoked = Object.keys(readTrustRecords()).filter((id) => !rest.includes(id));
        for (const id of revoked) await untrustTool(id);
        if (revoked.length) notice(`已撤销 ${revoked.length} 个工具的信任`, 'success');
      },
    },
    {
      type: 'list',
      name: '还没确认的命令',
      desc: '确认后才自动运行；点「信任这条命令」即按上面这条命令授权',
      variant: 'dense',
      removeLabel: '信任这条命令',
      emptyText: '没有待确认的工具',
      items: () => trustItems(false),
      onChange: async (rest) => {
        const trust = readTrustRecords();
        const granted = readToolEntries().filter((e) => !(e.id in trust) && !rest.includes(e.id));
        const skipped: string[] = [];
        let ok = 0;
        for (const e of granted) {
          const run = resolvedRunOf(e);
          if (!run) {
            skipped.push(readDeclaration(e.path).manifest?.name || e.id);
            continue;
          }
          await updateToolEntry(e.id, { trustedAt: new Date().toISOString(), trustedRun: runSignature(run) });
          ok += 1;
        }
        if (ok) notice(`已信任 ${ok} 个工具的命令`, 'success');
        if (skipped.length) notice(`${skipped.join('、')} 的声明读不到命令，去工具坞面板里确认`, 'warning');
      },
    },
  ];
}

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
        icon: 'rocket',
        name: '自动运行',
        rows: [
          {
            type: 'toggle',
            name: '启动后自动运行',
            desc: 'Obsidian 就绪后，bz 按各工具声明的节奏触发它：到点跑、该跑没跑就补跑。关掉则全部只手点',
            binding: switchBinding('autoRun'),
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
            binding: switchBinding('notifyMissed'),
          },
        ],
      },
      {
        icon: 'shield-check',
        name: '信任',
        rows: trustRows(),
      },
    ],
  };
}
