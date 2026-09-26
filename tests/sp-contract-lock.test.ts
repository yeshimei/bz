/**
 * 设置面板运行期契约锁（ARCH-3 / ARCH-4 / ARCH-5 承接）：
 * - ARCH-3 键对账：遍历 DOMAINS 全部域 loader 收集 binding.key，断言 ⊆ DEFAULT_SETTINGS
 *   键集合（编译期 SettingsKeyOfType 锁的第二道运行期网；resetDomain「无默认键跳过」
 *   的语义由此钉死——键在契约内必能取到默认值）；
 * - ARCH-4：「数据体检」按钮锚点在「数据存储路径」组（core 改组名时此处红，不再静默落尾组）；
 * - ARCH-5 承接：每域可见项数基准一处维护（失败报具体域；跨域 schema 变更只进贡本文件，
 *   不再逐位重锚面板集成测试）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { setApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { MockVault } from './mock-vault';
import { DOMAINS, visibleItemCount } from '../src/settings-panel/ui';
import { DEFAULT_SETTINGS } from '../src/settings';
import type { SettingsSchema } from '../src/core/settings-schema';

/** 每域可见设置项数基准（visibleItemCount 口径：visibleWhen/isChild 门控隐藏与 button 行不计）。
 *  变更属有意时同步更新本表——一处维护、失败报具体域（ARCH-5 定稿形态）。 */
const COUNT_BASELINE: Record<string, number> = {
  global: 3,
  notice: 4,
  ai: 15, // 2026-09-25 issue 444：「转写引擎」下拉（+1）；「Whisper 档位」visibleWhen 门控不计；issue 431 基线 14
  diary: 5,
  memo: 11,
  belongings: 6,
  people: 9, // 2026-09-26 issue 467+462：媒体组两行随 peopleMediaDir 退役、数据源保留 3 行（462 微信账号目录）——头像改走保库记录附件；数据源 3 + 聊天仓 4 + 隐私 2（清空按钮不计）
  clipping: 11,
  favorites: 5,
  cinema: 7, // 2026-09-26：网格每行列数退役（列数固定 5）
  bookshelf: 5,
  gameshelf: 7,
  review: 12,
  secondbrain: 6, // 2026-09-24 issue 424：检索组四行删（不限制 + 固化）、服务组两行 IP 自查/提示删
  home: 12,
  pomodoro: 11, // 2026-09-23：后台自动暂停退役（-1）、特效批「倒数滴答」新增（+1）
  encrypt: 4, // 2026-09-26：目录组退役（密文根固定 <数据存储路径>/.ENCRYPT）
  'password-vault': 5,
  smartcat: 15,
  knowledge: 25, // 2026-09-26 issue 462：「外部工具」组回归知识盒页（Python/ffmpeg/ffprobe 三行，域无关键位）
};

describe('settings-panel 运行期契约锁', () => {
  const schemas = new Map<string, SettingsSchema>();

  beforeAll(async () => {
    resetObsidianMocks();
    setApp({ vault: new MockVault(), workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
    setSettingsProvider(() => ({}) as any);
    for (const d of DOMAINS) {
      if (!d.schemaLoader) continue;
      schemas.set(d.id, await d.schemaLoader());
    }
  });

  it('ARCH-3：全域 schema 键集合 ⊆ DEFAULT_SETTINGS（运行期键对账锁，动态行无契约外键）', () => {
    const defaultKeys = new Set(Object.keys(DEFAULT_SETTINGS as unknown as Record<string, unknown>));
    const bound: Array<{ domain: string; key: string }> = [];
    for (const [id, schema] of schemas) {
      for (const g of schema.groups) {
        for (const r of g.rows) {
          const key = (r as { binding?: { key?: string } }).binding?.key;
          if (key) bound.push({ domain: id, key });
        }
      }
    }
    expect(bound.length).toBeGreaterThan(50); // 对账面非空（防遍历空转假绿）
    const drifted = bound.filter((r) => !defaultKeys.has(r.key));
    expect(drifted, `契约外键：${JSON.stringify(drifted)}`).toEqual([]);
  });

  it('ARCH-4：「数据体检」按钮锚在「数据存储路径」组（组名漂移即红，不静默落尾组）', () => {
    const schema = schemas.get('global');
    expect(schema).toBeTruthy();
    const storageGroup = schema!.groups.find((g) => g.name === '数据存储路径');
    expect(storageGroup, 'core 侧「数据存储路径」组存在（面板层锚点依赖此名）').toBeTruthy();
    expect(
      storageGroup!.rows.some((r) => (r as { name?: string }).name === '数据体检'),
      '「数据体检」按钮行落在该组内'
    ).toBe(true);
  });

  it('ARCH-5 承接：每域可见项数与基准一致（一处维护，失败报具体域）', () => {
    expect(Object.keys(COUNT_BASELINE).sort()).toEqual([...schemas.keys()].sort()); // 基准表与域集合对账
    for (const [id, schema] of schemas) {
      const count = visibleItemCount(schema);
      expect(count, `域「${id}」可见设置项数漂移（基准 ${COUNT_BASELINE[id]}，实际 ${count}；有意变更请同步 COUNT_BASELINE）`).toBe(COUNT_BASELINE[id]);
    }
  });
});
