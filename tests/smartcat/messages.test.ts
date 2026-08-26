// @vitest-environment node
/**
 * smartcat 消息库测试：18 key 全集（1146 条）、随机选取、getPetMessage 映射。
 * [54] 解冻文案：SETUP_MESSAGES 98 条已连接语料 → 12 条未配 AI 引导语料（总数 1232 → 1146）。
 */
import { describe, it, expect } from 'vitest';
import {
  SMART_CAT_MESSAGES, SMART_CAT_MOOD_MESSAGES, SMART_CAT_PET_MESSAGES,
  getSmartCatMessage, getPetMessage, PET_MOOD_KEYS, MESSAGE_KEYS,
} from '../../src/smartcat/messages';

describe('消息库全集', () => {
  it('SMART_CAT_MESSAGES 7 key + 各 key 条数（原 Node 求值）', () => {
    expect(Object.keys(SMART_CAT_MESSAGES).sort()).toEqual(
      ['PET_MESSAGES', 'CONNECTED_MESSAGES', 'SETUP_MESSAGES', 'WELCOME_BACK_MESSAGES',
        'LITTLE_ORANGE_COMPLAINTS', 'THINKING_MESSAGES', 'THINKING_IN_PROGRESS_MESSAGES'].sort()
    );
    expect(SMART_CAT_MESSAGES.PET_MESSAGES.length).toBe(200);
    expect(SMART_CAT_MESSAGES.CONNECTED_MESSAGES.length).toBe(98);
    expect(SMART_CAT_MESSAGES.SETUP_MESSAGES.length).toBe(12);
    expect(SMART_CAT_MESSAGES.WELCOME_BACK_MESSAGES.length).toBe(85);
    expect(SMART_CAT_MESSAGES.LITTLE_ORANGE_COMPLAINTS.length).toBe(100);
    expect(SMART_CAT_MESSAGES.THINKING_MESSAGES.length).toBe(50);
    expect(SMART_CAT_MESSAGES.THINKING_IN_PROGRESS_MESSAGES.length).toBe(51);
  });

  it('[54] SETUP_MESSAGES 与 CONNECTED 语料区分：未配 AI 引导语料带「配置/接入 AI」方向且不与已连接语料重复', () => {
    for (const m of SMART_CAT_MESSAGES.SETUP_MESSAGES) {
      expect(m).toContain('AI');
      expect(m).toMatch(/配置|接上|配上/); // 引导方向（配置/接入 AI）
      expect(SMART_CAT_MESSAGES.CONNECTED_MESSAGES).not.toContain(m);
    }
  });

  it('MOOD_MESSAGES 6 key 各 50 条', () => {
    expect(Object.keys(SMART_CAT_MOOD_MESSAGES).length).toBe(6);
    for (const key of Object.keys(SMART_CAT_MOOD_MESSAGES)) {
      expect(SMART_CAT_MOOD_MESSAGES[key].length).toBe(50);
    }
  });

  it('PET_MESSAGES 5 key 各 50 条（总计 1146）', () => {
    expect(Object.keys(SMART_CAT_PET_MESSAGES).length).toBe(5);
    const petTotal = Object.values(SMART_CAT_PET_MESSAGES).reduce((s, arr) => s + arr.length, 0);
    expect(petTotal).toBe(250);
    const total = Object.values(SMART_CAT_MESSAGES).reduce((s, arr) => s + arr.length, 0)
      + Object.values(SMART_CAT_MOOD_MESSAGES).reduce((s, arr) => s + arr.length, 0)
      + petTotal;
    expect(total).toBe(1146);
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

describe('getPetMessage', () => {
  it('5 档心情映射（excellent→poor）与未知回落 neutral', () => {
    expect(PET_MOOD_KEYS.excellent).toBe('PET_EXCELLENT_MESSAGES');
    expect(PET_MOOD_KEYS.poor).toBe('PET_POOR_MESSAGES');
    for (let i = 0; i < 50; i++) {
      expect(SMART_CAT_PET_MESSAGES.PET_EXCELLENT_MESSAGES).toContain(getPetMessage('excellent'));
      expect(SMART_CAT_PET_MESSAGES.PET_NEUTRAL_MESSAGES).toContain(getPetMessage('unknown'));
    }
  });
});

describe('MESSAGE_KEYS 枚举', () => {
  it('与 SMART_CAT_MESSAGES key 一致', () => {
    expect([...MESSAGE_KEYS].sort()).toEqual(Object.keys(SMART_CAT_MESSAGES).sort());
  });
});