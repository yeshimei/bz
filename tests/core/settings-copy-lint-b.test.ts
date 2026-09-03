// @vitest-environment node
/**
 * ticket 131 域组 B（clipbook 剪藏本/数据源/favorites/library）文案 lint（Q8 / ticket 100 规范）。
 * 注册本组四源 schema 断言零违规；违规按 ticket 100 修正（标题可改、描述可改自然句，
 * 键名/行为/通知文案不动）；无法整改的在本文件局部白名单豁免并注明理由。
 * custom 插槽内文案不经 lint（引擎只扫行 name/desc——up-manager 三行全 custom，天然豁免）。
 * ADR-0085：旧 clipping 域退役，clippingSettingsSchema 已并入 clipbook（clipbookSettingsSchema，
 * 见 src/clipbook/ui.ts）；up-manager 设置随 news-sources-group.ts 迁入 src/clipbook/。
 */
import { describe, it, expect } from 'vitest';
import { lintTargets } from './settings-copy-lint-engine';
import { clipbookSettingsSchema } from '../../src/clipbook/ui';
import { upManagerSettingsSchema } from '../../src/clipbook/news-sources-group';
import { favoritesSettingsSchema } from '../../src/favorites/ui';
import { librarySettingsSchema } from '../../src/library/ui';

const WHITELIST = new Set<string>([
  // 组 B 无豁免项：迁移时已按 ticket 100 对齐文案——「标签数量」原描述「如 "3-6" 表示 3 到 6 个」
  // 含引号/符号违规，已改自然句「生成的标签个数写成区间，如 3-6」；favorites 移动端原文案
  // 「（≤768px；关=常规卡）」符号文案随域组 A 收敛口径统一为多数派（settings-copy-lint-a 注释）。
]);

const TARGETS = [
  // clipbook 融合域 schema 取代旧 clippingSettingsSchema（ADR-0085）
  { source: 'clipbook', schema: clipbookSettingsSchema() },
  // up-manager 三行全为 custom 插槽（复合控件行 + 动态 desc），无行 name/desc 可 lint
  { source: 'up-manager', schema: upManagerSettingsSchema({ ups: [], upInfo: {}, cookie: '', onChanged: () => {} }) },
  { source: 'favorites', schema: favoritesSettingsSchema() },
  { source: 'library', schema: librarySettingsSchema() },
];

describe('域组 B 文案 lint（ticket 131 / ticket 100）', () => {
  it('clipbook/up-manager/favorites/library 已注册 schema 无未豁免违规', () => {
    const violations = lintTargets(TARGETS, WHITELIST);
    expect(
      violations,
      `文案违规（如需豁免遗留项，往 WHITELIST 加 id 并注明年/票与理由）:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});