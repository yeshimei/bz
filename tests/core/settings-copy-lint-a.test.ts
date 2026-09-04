// @vitest-environment node
/**
 * ticket 131 域组 A（diary/memo/belongings）文案 lint（Q8 / ticket 100 规范）。
 * 注册本组三域 schema 断言零违规；违规按 ticket 100 修正（标题可改、描述可改自然句，
 * 键名/行为/通知文案不动）；无法整改的在本文件局部白名单豁免并注明理由。
 * password 域已退役（共享加密服务迁入 core/crypto），不再参与本组 lint。
 */
import { describe, it, expect } from 'vitest';
import { lintTargets } from './settings-copy-lint-engine';
import { diarySettingsSchema } from '../../src/diary/ui/panel';
import { memoSettingsSchema } from '../../src/memo/ui';
import { belongingSettingsSchema } from '../../src/belongings/ui';

const WHITELIST = new Set<string>([
  // 组 A 无豁免项：迁移时已按 ticket 100 对齐文案（移动端组统一为多数派文案，belongings/favorites
  // 原符号文案「（≤768px；关=常规卡）」随统一收敛；如后续迁移发现存量违规再按 id 添加并注明）。
]);

const TARGETS = [
  { source: 'diary', schema: diarySettingsSchema() },
  { source: 'memo', schema: memoSettingsSchema() },
  { source: 'belongings', schema: belongingSettingsSchema() },
];

describe('域组 A 文案 lint（ticket 131 / ticket 100）', () => {
  it('diary/memo/belongings 已注册 schema 无未豁免违规', () => {
    const violations = lintTargets(TARGETS, WHITELIST);
    expect(
      violations,
      `文案违规（如需豁免遗留项，往 WHITELIST 加 id 并注明年/票与理由）:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});