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
  // 2026-10-28：最前新增「关于」组 —— 版本 info 行 +「自动更新」toggle +「环境自检」/「反馈」
  // 两个 button 行（button 行不计）+「赞赏」info 行 → +3；基线 8
  global: 8, // 2026-11-05：「插件」组 bz reader info 行（+1；组首「全部更新」button 行不计）。2026-10-29：「赞赏」由 info 行改成禁用的「暂无」button 行（-1，button 行不计；同日「关于」组加「GitHub 主页」「使用教程」两个 button 行，同样不计）2026-10-29：撤「功能域」组「小橘陪伴猫」（-1，小橘默认关）；2026-10-28：「在线资源」组「镜像源」text 行撤掉（-1）；同日撤「外观」组（-2）；2026-10-26：「外部工具」组三行收进 AI 页（-3）；2026-10-24 ADR-0254：「功能域」组「小橘陪伴猫」toggle（+1）；2026-09-27 issue 492：在线资源组回归通用声明行（button 行不计，-1；issue 480 自绘 custom 行曾 +1）
  ai: 20, // 2026-10-26：「外部工具」组三行迁入（+3）与语音转写组「模型目录」text 行（+1）；2026-09-29 issue 518 / ADR-0222：「LLM 校对」toggle（+1）；issue 444 基线 15（「转写引擎」下拉 +1；「Whisper 档位」visibleWhen 门控不计）；issue 431 基线 14
  diary: 9, // 2026-11-06：「显示」组新增「收录影院」「收录书库」两个 toggle（+2，默认开）；2026-11：新增「存储」格式卡 custom 行（+1）与「分类」清单 custom 行（+1）；目录组隐藏信件行（-1）→ 净 +1。2026-10-25 ADR-0258：「显示」组「每次翻开多少则」number 行（+1）
  memo: 11,
  belongings: 6,
  people: 11, // 2026-09-29 复评：聊天仓组新增「我的头像」text 行（+1，逐轮时间轴「我」那一侧的头像路径）。基线 10 的沿革：2026-09-27 回退 496 重复行（转写引擎统一在 AI 设置面板，issue 444）；2026-09-26 issue 470 聊天仓组「每批图片数」+1；issue 467+462 媒体组两行随 peopleMediaDir 退役（头像改走保库记录附件）。现口径：数据源 3 + 聊天仓 6 + 隐私 2（清空按钮不计）
  clipping: 13, // 2026-11-06 ADR-0290：自动摘要组「笔记内摘要卡」toggle（+1，常显不随总开关收起）；2026-09-27 issue 497 / ADR-0209：数据源组新增「RSSHub 实例」text 行（+1）；issue 495 基线 11
  favorites: 5,
  cinema: 7, // 2026-09-26：网格每行列数退役（列数固定 5）
  bookshelf: 5,
  gameshelf: 7,
  review: 12,
  secondbrain: 6, // 2026-09-24 issue 424：检索组四行删（不限制 + 固化）、服务组两行 IP 自查/提示删
  home: 11, // 2026-10-29 时间线换源：「内容过滤」组删掉空转的「跳过痕迹」（-1，聚合讯跳过不再进时间线）；同时「小橘点评」改名「记录与评价」
  pomodoro: 11, // 2026-09-23：后台自动暂停退役（-1）、特效批「倒数滴答」新增（+1）
  encrypt: 4, // 2026-09-26：目录组退役（密文根固定 <数据存储路径>/.ENCRYPT）
  'password-vault': 5,
  smartcat: 15,
  knowledge: 22, // 2026-10-26：「外部工具」三行迁出到通用页「外部工具」组（-3）；此前 25 = 2026-09-26 issue 462 回归三行
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
