// @vitest-environment node
/**
 * smartcat 消息库测试：5 key 全集（446 条）、随机选取、MESSAGE_KEYS 枚举一致性。
 * [54] 解冻文案：SETUP_MESSAGES 98 条已连接语料 → 12 条未配 AI 引导语料。
 * 2026-09-19 机制审计裁剪：删去零生产消费的 13 key（SMART_CAT_MOOD_MESSAGES 6 /
 * SMART_CAT_PET_MESSAGES 5 / LITTLE_ORANGE_COMPLAINTS / THINKING_MESSAGES）
 * 及 getPetMessage→PET_MOOD_KEYS 链路，本文件断言同步收缩；旧文案可从 git 历史取。
 */
import { describe, it, expect } from 'vitest';
import { SMART_CAT_MESSAGES, getSmartCatMessage, MESSAGE_KEYS } from '../../src/smartcat/messages';

describe('消息库全集', () => {
  it('SMART_CAT_MESSAGES 5 key + 各 key 条数（原 Node 求值）', () => {
    expect(Object.keys(SMART_CAT_MESSAGES).sort()).toEqual(
      ['PET_MESSAGES', 'CONNECTED_MESSAGES', 'SETUP_MESSAGES', 'WELCOME_BACK_MESSAGES',
        'THINKING_IN_PROGRESS_MESSAGES'].sort()
    );
    expect(SMART_CAT_MESSAGES.PET_MESSAGES.length).toBe(200);
    expect(SMART_CAT_MESSAGES.CONNECTED_MESSAGES.length).toBe(98);
    expect(SMART_CAT_MESSAGES.SETUP_MESSAGES.length).toBe(12);
    expect(SMART_CAT_MESSAGES.WELCOME_BACK_MESSAGES.length).toBe(85);
    expect(SMART_CAT_MESSAGES.THINKING_IN_PROGRESS_MESSAGES.length).toBe(51);
  });

  it('[54] SETUP_MESSAGES 与 CONNECTED 语料区分：未配 AI 引导语料带「配置/接入 AI」方向且不与已连接语料重复', () => {
    for (const m of SMART_CAT_MESSAGES.SETUP_MESSAGES) {
      expect(m).toContain('AI');
      expect(m).toMatch(/配置|接上|配上/); // 引导方向（配置/接入 AI）
      expect(SMART_CAT_MESSAGES.CONNECTED_MESSAGES).not.toContain(m);
    }
  });

  it('裁剪后总量 446（200+98+12+85+51）', () => {
    const total = Object.values(SMART_CAT_MESSAGES).reduce((s, arr) => s + arr.length, 0);
    expect(total).toBe(446);
  });

  it('message 中文原文保留不空白（抽查）', () => {
    expect(SMART_CAT_MESSAGES.PET_MESSAGES[0]).toContain('喵呜');
    expect(SMART_CAT_MESSAGES.WELCOME_BACK_MESSAGES[0]).toContain('回来');
  });
});

describe('getSmartCatMessage', () => {
  it('已知 key → 返回数组内一条（随机）', () => {
    for (let i = 0; i < 50; i++) {
      const m = getSmartCatMessage('PET_MESSAGES');
      expect(SMART_CAT_MESSAGES.PET_MESSAGES).toContain(m);
    }
  });

  it('未知 key → 空串', () => {
    expect(getSmartCatMessage('NOPE')).toBe('');
  });
});

describe('MESSAGE_KEYS 枚举', () => {
  it('与 SMART_CAT_MESSAGES key 一致', () => {
    expect([...MESSAGE_KEYS].sort()).toEqual(Object.keys(SMART_CAT_MESSAGES).sort());
  });
});
