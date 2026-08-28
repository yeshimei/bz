// @vitest-environment node
/**
 * ticket 131 域组 C（movie/review/pomodoro/encrypt/secondbrain/smartcat）文案 lint（Q8 / ticket 100 规范）。
 * 注册本组六域 schema 断言零违规；违规按 ticket 100 修正（标题可改、描述可改自然句，
 * 键名/行为/通知文案不动）；无法整改的在本文件局部白名单豁免并注明理由。
 * 渲染回调（custom 插槽内 new Setting 的名称/描述）不在 schema 行声明中——lint 引擎只查
 * schema 行声明的 name/desc；custom 行自行渲染的内部文案由对应域 UI 测试兜底（本组多处已覆盖）。
 */
import { describe, it, expect } from 'vitest';
import { lintTargets } from './settings-copy-lint-engine';
import { movieSettingsSchema } from '../../src/movie/ui';
import { reviewSettingsSchema } from '../../src/review/ui';
import { pomodoroSettingsSchema } from '../../src/pomodoro/ui';
import { encryptSettingsSchema } from '../../src/encrypt/ui';
import { secondBrainSettingsSchema } from '../../src/secondbrain/panel';
import { smartcatSettingsSchema } from '../../src/smartcat/ui';

const WHITELIST = new Set<string>([
  // 复习「每篇笔记出题数量」desc「固定每篇笔记出题的数量，留空/0=自动」：f8-quiz 用户拍板文案
  //（「留空/0=自动」语义），既有 UI 测试锁定该描述子串（review/ui.test.ts），改动需主会话评审——局部豁免。
  'review#每篇笔记出题数量:desc-symbol',
  // 第二大脑「启用」标题：2 字短标题为既有用户约定（测试以 dataset.name 锁定），行为不动，豁免长度。
  'secondbrain#启用:title-length',
]);

const TARGETS = [
  { source: 'movie', schema: movieSettingsSchema() },
  { source: 'review', schema: reviewSettingsSchema({ app: {} as any, dataManager: {} as any }) },
  { source: 'pomodoro', schema: pomodoroSettingsSchema() },
  { source: 'encrypt', schema: encryptSettingsSchema() },
  { source: 'secondbrain', schema: secondBrainSettingsSchema() },
  {
    source: 'smartcat',
    schema: smartcatSettingsSchema({
      getConfig: () => ({}) as any,
      saveConfig: async () => {},
      settingsKeys: { enabled: true, mobileFullscreen: false },
      setMobileFullscreen: async () => {},
    }),
  },
];

describe('域组 C 文案 lint（ticket 131 / ticket 100）', () => {
  it('movie/review/pomodoro/encrypt/secondbrain/smartcat 已注册 schema 无未豁免违规', () => {
    const violations = lintTargets(TARGETS, WHITELIST);
    expect(
      violations,
      `文案违规（如需豁免遗留项，往 WHITELIST 加 id 并注明年/票与理由）:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});