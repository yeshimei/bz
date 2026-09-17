// @vitest-environment node
/**
 * 域组 D 文案 lint（2026-09-12 补缺口批）：home/memo/bookshelf/knowledge/password-vault + 通知面板页。
 * 原组 A/B/C 没覆盖这几个域 —— 首页「点评 ✦」符号组名（实为行名）就是这么漏网的。
 * 注册时零豁免；存量违规按 ticket 100 规范整改（标题/描述可改，键名/行为/通知文案不动），
 * 确实无法整改的才往 WHITELIST 加 id 并注明年/票与理由。
 */
import { describe, it, expect } from 'vitest';
import { lintTargets } from './settings-copy-lint-engine';
import { homeSettingsSchema } from '../../src/home/settings';
import { memoSettingsSchema } from '../../src/memo/settings';
import { bookshelfSettingsSchema } from '../../src/bookshelf/settings';
import { knowledgeSettingsSchema } from '../../src/knowledge/ui';
import { passwordVaultSettingsSchema } from '../../src/password-vault/settings';
import { noticeSettingsSchema } from '../../src/core/settings-main-schema';
import { gameshelfSettingsSchema } from '../../src/gameshelf/settings';

const WHITELIST = new Set<string>([
  // 注册时零豁免；确需豁免时在此加 id 并注明年/票与理由
  // 2026-09-17 游戏库补纳管：SteamID64 是 Valve 官方字段名（官网申请页/URL 里就叫这个），
  // 折算后仅 2 字宽 → 触发 title-length。改名会让用户对不上官网说明，故豁免整行标题长度。
  'gameshelf#SteamID64:title-length',
]);

const TARGETS = [
  { source: 'home', schema: homeSettingsSchema() },
  { source: 'memo', schema: memoSettingsSchema() },
  { source: 'bookshelf', schema: bookshelfSettingsSchema() },
  { source: 'knowledge', schema: knowledgeSettingsSchema() },
  { source: 'password-vault', schema: passwordVaultSettingsSchema() },
  { source: 'notice', schema: noticeSettingsSchema() },
  // 游戏库（2026-09-17 补纳管：issue 368 建域时漏登记；本次补外观组顺带入表）
  { source: 'gameshelf', schema: gameshelfSettingsSchema() },
];

describe('域组 D 文案 lint（2026-09-12 补缺口批）', () => {
  it('home/memo/bookshelf/knowledge/password-vault/notice/gameshelf 已注册 schema 无未豁免违规', () => {
    const violations = lintTargets(TARGETS, WHITELIST);
    expect(
      violations,
      `文案违规（如需豁免遗留项，往 WHITELIST 加 id 并注明年/票与理由）:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});
