// @vitest-environment node
/**
 * ticket 131 域组 C（cinema/review/pomodoro/encrypt/secondbrain/smartcat/knowledge）文案 lint（Q8 / ticket 100 规范）。
 * 注册本组七域 schema 断言零违规；knowledge 由 issue 325 / ADR-0141 纳入（新增「自动关联」组随设置组迁移一并纳管）；违规按 ticket 100 修正（标题可改、描述可改自然句，
 * 键名/行为/通知文案不动）；无法整改的在本文件局部白名单豁免并注明理由。
 * 渲染回调（custom 插槽内 new Setting 的名称/描述）不在 schema 行声明中——lint 引擎只查
 * schema 行声明的 name/desc；custom 行自行渲染的内部文案由对应域 UI 测试兜底（本组多处已覆盖）。
 * ADR-0087：movie 域退役，schema 源换 cinema（cinemaSettingsSchema）。
 */
import { describe, it, expect } from 'vitest';
import { lintTargets } from './settings-copy-lint-engine';
import { cinemaSettingsSchema } from '../../src/cinema/settings';
import { reviewSettingsSchema } from '../../src/review/ui';
import { pomodoroSettingsSchema } from '../../src/pomodoro/ui';
import { encryptSettingsSchema } from '../../src/encrypt/ui';
import { secondBrainSettingsSchema } from '../../src/secondbrain/panel';
import { smartcatSettingsSchema } from '../../src/smartcat/ui';
import { knowledgeSettingsSchema } from '../../src/knowledge/ui';

const WHITELIST = new Set<string>([
  // secondbrain 本机局域网 IP：desc 为探测到的 IP/接口列表（ticket 122 自查信息本体，符号不可避免）
  'secondbrain#本机局域网 IP:*',
  // 2026-09-12：「启用」开关已随 secondBrainEnabled 键退役（启动常驻），其 title-length 豁免一并删除
  // 2026-09-19：review「每篇笔记出题数量」desc 豁免随批 E 改 number 行新文案删除（desc 已合规）
]);

const TARGETS = [
  { source: 'cinema', schema: cinemaSettingsSchema() },
  { source: 'review', schema: reviewSettingsSchema({ app: {} as any, dataManager: {} as any }) },
  { source: 'pomodoro', schema: pomodoroSettingsSchema() },
  { source: 'encrypt', schema: encryptSettingsSchema() },
  { source: 'secondbrain', schema: secondBrainSettingsSchema() },
  // ADR-0141 §1：自动关联设置组自第二大脑迁入知识盒 → 该域 schema 一并纳管文案 lint
  { source: 'knowledge', schema: knowledgeSettingsSchema() },
  {
    source: 'smartcat',
    schema: smartcatSettingsSchema({
      getConfig: () => ({}) as any,
      saveConfig: async () => {},
      settingsKeys: { enabled: true },
    }),
  },
];

describe('域组 C 文案 lint（ticket 131 / ticket 100）', () => {
  it('cinema/review/pomodoro/encrypt/secondbrain/smartcat 已注册 schema 无未豁免违规', () => {
    const violations = lintTargets(TARGETS, WHITELIST);
    expect(
      violations,
      `文案违规（如需豁免遗留项，往 WHITELIST 加 id 并注明年/票与理由）:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});