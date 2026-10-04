// @vitest-environment node
/**
 * 工具坞（dock）域设置 schema（ADR-0235 / ADR-0236 / ADR-0239）。
 *
 * 本域设置页有意「薄」：工具的参数、节奏、怎么跑都随工具目录里的声明文件（`manifest.json`）
 * 住在工具侧；登记表本身只走面板内「导入声明」—— 一旦设置页能直接改命令，「打开别人的 vault」
 * 就等于「在他机器上执行任意命令」（D5/D6 信任边界）。
 *
 * ADR-0239 起本条又多了两件事：两个全局开关的值搬进了数据目录的 `dock.json`（不再是设置键），
 * 信任留在设置的 `dockTrust` 并**在设置页给出逐工具入口**。
 *
 * 守卫六件：
 *  1. 组序 = 工具 → 自动运行 → 提醒 → 信任；
 *  2. 登记行仍是 info + 单钮，且设置页源码里**没有任何行直绑设置键**（D6：登记不走设置页行编辑；
 *     两个开关也必须走三函数绑定，因为值已不在设置里）；
 *  3. 四个旧设置键在 DEFAULT_SETTINGS 里彻底退役，只剩 `dockTrust`；
 *  4. 两个开关域内**真的被读**（2026-10-04 曾发现「只声明不消费」的死设置，这条防它再死一遍
 *     ——同仓先例：一批守卫靠读源码文本断言，模块图里没有这条边）；
 *  5. 信任组只给「撤销」与「按声明现读的命令授权」，没有让人手写一条命令的位置；
 *  6. 信任组的**行为**：授权写进设置里的 `dockTrust`（签名 = 声明现读的那条命令）、
 *     撤销只删授权 —— 两个方向都不动 `dock.json` 里的登记表（授权与登记是两件事）。
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dockSettingsSchema } from '../../src/dock/settings';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { __resetDockStoreForTests, loadDockStore, readTrustMap } from '../../src/dock/store';
import { setDockFs } from '../../src/dock/declaration';
import { runSignature } from '../../src/dock/registry';
import type { SettingsRow } from '../../src/core/settings-schema';

// 本文件跑在 node 环境（无 DOM）：通知层的 toast 渲染会碰 document，替成空探针。
// 授权 / 撤销的**数据效果**照常断言 —— 这里只架开渲染那一半。
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return { ...actual, notice: vi.fn(), notify: vi.fn(), notifySaveError: vi.fn() };
});

type ToggleRow = Extract<SettingsRow, { type: 'toggle' }>;
type InfoRow = Extract<SettingsRow, { type: 'info' }>;
type ListRow = Extract<SettingsRow, { type: 'list' }>;

const readRepoFile = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const dockSettingsSrc = (): string => readRepoFile('../../src/dock/settings.ts');

// 信任组的两行只在「有已登记工具」时才出（没有工具时是一行 info 引导）——
// 所以先把面板数据装成「登记了一个工具」，schema 才有那两行可断言
const APP_VAULT = new MockVault();
APP_VAULT.files.set(
  'CONFIG/STORAGE/dock.json',
  JSON.stringify({
    v: 1,
    tools: [{ id: 'iamtxt-signin', path: 'E:/tools/iamtxt-signin/manifest.json', enabled: true }],
    runState: {},
    autoRun: true,
    notifyMissed: true,
  }),
);
// 设置对象要**稳定同一份**（`writeTrustMap` 就地改它再读回来），别每次新造一个字面量
const SETTINGS: Record<string, unknown> = { storagePath: 'CONFIG/STORAGE' };
setApp({ vault: APP_VAULT } as never);
setSettingsProvider(() => SETTINGS as never);
setSettingsSaver(async () => {});

// 工具目录那片磁盘（vault 外的 fs 缝）：只放一份声明，供「授权」现读命令用
const TOOL_FILES: Record<string, string> = {
  'E:/tools/iamtxt-signin/manifest.json': JSON.stringify({
    v: 1,
    id: 'iamtxt-signin',
    name: 'iamtxt 每日签到',
    run: { cmd: 'node', args: ['main.mjs'] },
  }),
};
setDockFs({
  readText: (p) => TOOL_FILES[p] ?? null,
  writeText: (p, d) => {
    TOOL_FILES[p] = d;
  },
  rename: () => {},
  exists: (p) => p in TOOL_FILES,
  unlink: (p) => {
    delete TOOL_FILES[p];
  },
});

await loadDockStore();

describe('工具坞设置 schema', () => {
  const schema = dockSettingsSchema();
  const [tools, autoRun, notice, trust] = schema.groups;

  it('组序 = 工具 → 自动运行 → 提醒 → 信任', () => {
    expect(schema.groups.map((g) => g.name)).toEqual(['工具', '自动运行', '提醒', '信任']);
    expect(tools.icon).toBe('container'); // 与域图标同源
    expect(autoRun.icon).toBe('rocket');
    expect(notice.icon).toBe('bell');
    expect(trust.icon).toBe('shield-check');
    expect(tools.rows).toHaveLength(1);
    expect(autoRun.rows).toHaveLength(1);
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

  it('D6 信任边界：设置页没有任何行直绑设置键（登记表只走面板内「导入声明」）', () => {
    for (const g of schema.groups) {
      for (const r of g.rows) {
        expect(
          (r as { binding?: { key?: string } }).binding?.key,
          `设置页不得直绑设置键（行「${(r as { name?: string }).name}」）`,
        ).toBeUndefined();
      }
    }
    const src = dockSettingsSrc();
    for (const retired of ['dockTools', 'dockRunState', 'dockAutoRun', 'dockNotifyMissed']) {
      expect(src, `设置页不该再提到退役键 ${retired}`).not.toContain(retired);
    }
  });

  it('两个开关走三函数绑定（值住 dock.json，不在设置里）', () => {
    for (const g of [autoRun, notice]) {
      const row = g.rows[0] as ToggleRow;
      expect(row.type).toBe('toggle');
      const b = row.binding as { get?: unknown; set?: unknown; save?: unknown };
      expect(typeof b.get).toBe('function');
      expect(typeof b.set).toBe('function');
      expect(typeof b.save).toBe('function');
    }
    expect((autoRun.rows[0] as ToggleRow).name).toBe('启动后自动运行');
    expect((notice.rows[0] as ToggleRow).name).toBe('漏跑提醒');
  });

  it('开关 save 先对齐盘上现值再落盘：外部改过 dock.json 时不拿过期快照整文件覆盖', async () => {
    await loadDockStore();
    // 外部（同步盘）改了 dock.json：多了台机器登记的工具、autoRun 被拨成 false
    APP_VAULT.files.set(
      'CONFIG/STORAGE/dock.json',
      JSON.stringify({
        v: 1,
        tools: [
          { id: 'iamtxt-signin', path: 'E:/tools/iamtxt-signin/manifest.json', enabled: true },
          { id: 'other', path: 'E:/tools/other/manifest.json', enabled: true },
        ],
        runState: { other: { consecutiveFailures: 1 } },
        autoRun: false,
        notifyMissed: true,
      }),
    );
    const noticeRow = dockSettingsSchema().groups.flatMap((g) => g.rows).find(
      (r) => r.type === 'toggle' && r.name === '漏跑提醒',
    ) as ToggleRow;
    const b = noticeRow.binding as { set: (v: boolean) => void; save: () => Promise<void> };
    try {
      b.set(false); // 用户拨开关（此刻只进内存快照，盘上还是外部改过的那版）
      await b.save();
      const disk = JSON.parse(APP_VAULT.files.get('CONFIG/STORAGE/dock.json')!);
      expect(disk.autoRun).toBe(false); // 外部拨的 autoRun 保住
      expect(disk.tools.map((t: { id: string }) => t.id)).toEqual(['iamtxt-signin', 'other']); // 外部登记保住
      expect(disk.notifyMissed).toBe(false); // 用户本次拨动落盘
    } finally {
      // 复原共享夹具：dock.json 是模块级 APP_VAULT，外部改动别带给后续用例
      APP_VAULT.files.set(
        'CONFIG/STORAGE/dock.json',
        JSON.stringify({
          v: 1,
          tools: [{ id: 'iamtxt-signin', path: 'E:/tools/iamtxt-signin/manifest.json', enabled: true }],
          runState: {},
          autoRun: true,
          notifyMissed: true,
        }),
      );
      await loadDockStore();
    }
  });

  it('四个旧设置键退役，DEFAULT_SETTINGS 里只剩信任表', () => {
    const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
    for (const retired of ['dockTools', 'dockRunState', 'dockAutoRun', 'dockNotifyMissed']) {
      expect(retired in defaults, `${retired} 应已退役`).toBe(false);
    }
    expect(defaults.dockTrust).toEqual({});
  });

  it('信任组 = 撤销 + 按声明现读的命令授权两行，都不接受手写命令', () => {
    const revoke = trust.rows[0] as ListRow;
    const grant = trust.rows[1] as ListRow;
    expect(revoke.type).toBe('list');
    expect(revoke.removeLabel).toBe('撤销信任');
    expect(grant.type).toBe('list');
    expect(grant.removeLabel).toBe('信任这条命令');
    for (const row of [revoke, grant]) {
      expect(typeof row.items === 'function' ? row.items() : row.items).toBeInstanceOf(Array);
      expect(typeof row.onChange).toBe('function');
    }
    // 授权只按声明现读的命令算签名：源码里必须有「现读声明 → 算签名」这条链
    const src = dockSettingsSrc();
    expect(src).toContain('resolvedRunOf(');
    expect(src).toContain('runSignature(run)');
  });

  it('没有已登记工具时，信任组退成一行引导 info（不摆空列表）', () => {
    __resetDockStoreForTests(); // 清掉上面装载进来的登记表
    const empty = dockSettingsSchema().groups[3];
    expect(empty.name).toBe('信任');
    expect(empty.rows).toHaveLength(1);
    expect((empty.rows[0] as InfoRow).type).toBe('info');
    void loadDockStore(); // 复原，免得影响同文件后续用例
  });

  it('两个开关域内都真的被读（防「只声明不消费」的死设置复发）', () => {
    expect(readRepoFile('../../src/dock/ui.ts')).toContain("readDockSwitch('notifyMissed')");
    expect(readRepoFile('../../src/dock/scheduler.ts')).toContain("readDockSwitch('autoRun')");
  });

  it('信任组的行为：授权按声明现读的命令签名，撤销只删授权、不动登记表', async () => {
    const dockJsonTools = (): unknown => {
      const raw = APP_VAULT.files.get('CONFIG/STORAGE/dock.json')!;
      return JSON.parse(raw).tools;
    };
    const keys = (row: ListRow): string[] =>
      (typeof row.items === 'function' ? row.items() : row.items).map((i) => i.key);
    const trustRowsNow = (): [ListRow, ListRow] =>
      dockSettingsSchema().groups[3].rows as [ListRow, ListRow];
    const ctx = {} as never;
    // 起点复位（vitest 会重试失败用例，模块级状态跨重试存活）
    delete SETTINGS.dockTrust;
    __resetDockStoreForTests();
    await loadDockStore();

    // 没授权过 → 「已信任」空、「还没确认」有它
    let [revoke, grant] = trustRowsNow();
    expect(keys(revoke)).toEqual([]);
    expect(keys(grant)).toEqual(['iamtxt-signin']);
    const toolsBefore = JSON.stringify(dockJsonTools());

    // 授权 = 把它从「还没确认」列表里移除；签名按声明里现读的 node main.mjs 算
    await grant.onChange?.(keys(grant).filter((k) => k !== 'iamtxt-signin'), ctx);
    expect(readTrustMap()).toEqual({
      'iamtxt-signin': { at: expect.any(String), run: runSignature({ cmd: 'node', args: ['main.mjs'] }) },
    });
    // 授权只动设置：登记表内容一个字段都不变（信任没被顺手写回 dock.json）
    expect(JSON.stringify(dockJsonTools())).toBe(toolsBefore);
    expect(dockJsonTools()).toEqual([
      { id: 'iamtxt-signin', path: 'E:/tools/iamtxt-signin/manifest.json', enabled: true },
    ]);

    // 撤销 = 把它从「已信任」列表里移除；同样不碰登记表
    [revoke] = trustRowsNow();
    expect(keys(revoke)).toEqual(['iamtxt-signin']);
    await revoke.onChange?.(keys(revoke).filter((k) => k !== 'iamtxt-signin'), ctx);
    expect(readTrustMap()).toEqual({});
    expect(JSON.stringify(dockJsonTools())).toBe(toolsBefore);
  });
});
