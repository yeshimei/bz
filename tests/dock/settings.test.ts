// @vitest-environment node
/**
 * 工具坞（dock）域设置 schema（ADR-0235）。
 *
 * 本域设置页有意「薄」：工具的参数、节奏、怎么跑都随工具目录里的声明文件（`dock.json`）
 * 住在工具侧，登记表（「导入哪份声明」）只走面板内「导入声明」——那是本插件权限最高的数据，
 * 一旦设置页也能改，「打开别人的 vault」就等于「在他机器上执行任意命令」（D5/D6 信任边界）。
 *
 * 守卫三件：
 *  1. 组序 = 工具（登记直达）→ 提醒；
 *  2. 登记行是 info + 单钮，且**没有任何行绑定 dockTools**（D6：登记不走设置页行编辑）；
 *  3. 「漏跑提醒」toggle 绑 dockNotifyMissed、默认值在 DEFAULT_SETTINGS 里，且域内**真的读它**
 *     ——2026-10-04 发现该键曾是「只声明不消费」的死设置，这条文本断言防它再死一遍
 *     （同仓先例：一批守卫靠读源码文本断言，模块图里没有这条边）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dockSettingsSchema } from '../../src/dock/settings';
import { DEFAULT_SETTINGS } from '../../src/settings';
import type { SettingsRow } from '../../src/core/settings-schema';

type ToggleRow = Extract<SettingsRow, { type: 'toggle' }>;
type InfoRow = Extract<SettingsRow, { type: 'info' }>;

const readRepoFile = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('工具坞设置 schema', () => {
  const schema = dockSettingsSchema();
  const [tools, notice] = schema.groups;

  it('组序 = 工具（登记直达）→ 提醒，两行而已（配置的绝大多数在工具侧，不搬进设置页）', () => {
    expect(schema.groups.map((g) => g.name)).toEqual(['工具', '提醒']);
    expect(tools.icon).toBe('container'); // 与域图标同源
    expect(notice.icon).toBe('bell');
    expect(tools.rows).toHaveLength(1);
    expect(notice.rows).toHaveLength(1);
  });

  it('登记行 = info + 单个「打开工具坞」强调钮（管理入口在面板，不在设置页）', () => {
    const row = tools.rows[0] as InfoRow;
    expect(row.type).toBe('info');
    expect(row.name).toBe('外部工具登记');
    expect(row.actions).toHaveLength(1);
    expect(row.actions![0].text).toBe('打开工具坞');
    expect(row.actions![0].cta).toBe(true);
    expect(typeof row.actions![0].onClick).toBe('function');
  });

  it('D6 信任边界：设置页没有任何行绑定 dockTools（登记表只走面板内「添加工具」）', () => {
    for (const g of schema.groups) {
      for (const r of g.rows) {
        const key = (r as { binding?: { key?: string } }).binding?.key;
        expect(key, `设置页不得直绑 dockTools（行「${(r as { name?: string }).name}」）`).not.toBe('dockTools');
      }
    }
    // 同上：登记表也不该以 text/list/custom 等任何形态落进设置页（键名扫一遍）
    const src = readRepoFile('../../src/dock/settings.ts');
    expect(src).not.toContain('dockTools');
  });

  it('漏跑提醒 toggle 绑 dockNotifyMissed，默认值在 DEFAULT_SETTINGS 里且为布尔', () => {
    const row = notice.rows[0] as ToggleRow;
    expect(row.type).toBe('toggle');
    expect(row.name).toBe('漏跑提醒');
    expect((row.binding as { key?: string }).key).toBe('dockNotifyMissed');
    expect(typeof DEFAULT_SETTINGS.dockNotifyMissed).toBe('boolean');
  });

  it('该开关域内真的被读（防「只声明不消费」的死设置复发）', () => {
    const ui = readRepoFile('../../src/dock/ui.ts');
    expect(ui).toContain('dockNotifyMissed');
  });
});
