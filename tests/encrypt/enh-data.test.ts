// @vitest-environment node
/**
 * 保险库增强包·数据层纯函数回归（encrypt 域）：
 * 密码强度本地计算（弱/中/强）、fuzzy 匹配得分与条目过滤排序（快速取密选择器数据侧）。
 */
import { describe, it, expect } from 'vitest';
import { passwordStrength, pwStrengthLabel } from '../../src/encrypt/ui';
import { fuzzyScore, fuzzyFilterEntries } from '../../src/encrypt/pw-picker';
import type { PasswordVaultEntry } from '../../src/encrypt/vault-data';

function entry(over: Partial<PasswordVaultEntry>): PasswordVaultEntry {
  return {
    id: over.id || 'pw-1',
    platform: over.platform ?? '',
    url: over.url ?? '',
    account: over.account ?? '',
    password: over.password ?? '',
    note: over.note ?? '',
    createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
    fav: over.fav ?? false,
  };
}

describe('密码强度（纯本地计算）', () => {
  it('空/短密码 = 弱（≤2 分）', () => {
    expect(passwordStrength('')).toBe('weak');
    expect(passwordStrength('abc')).toBe('weak'); // 仅小写 = 1 分
    expect(passwordStrength('abcdefgh')).toBe('weak'); // len8 = 1 分
    expect(passwordStrength('12345678')).toBe('weak'); // len8 + 数字 = 2 分
    expect(passwordStrength('Abcdefgh')).toBe('weak'); // len8 + 大小写 = 2 分
  });

  it('中等（3-4 分）：长度/大小写/数字/符号组合但未全部齐全', () => {
    expect(passwordStrength('Abcdefgh1')).toBe('mid'); // len8 + 大小写 + 数字 = 3
    expect(passwordStrength('Abcdefgh12')).toBe('mid'); // 10 字符：len8 + 大小写 + 数字 = 3
    expect(passwordStrength('Abcdefg12!')).toBe('mid'); // 10 字符：len8 + 大小写 + 数字 + 符号 = 4
  });

  it('强（5 分）：12 位以上 + 大小写 + 数字 + 符号（生成器默认输出形态）', () => {
    expect(passwordStrength('Abcdefgh1234!@')).toBe('strong');
  });

  it('pwStrengthLabel：弱/中/强文案', () => {
    expect(pwStrengthLabel('weak')).toBe('弱');
    expect(pwStrengthLabel('mid')).toBe('中');
    expect(pwStrengthLabel('strong')).toBe('强');
  });
});

describe('快速取密 fuzzy 匹配', () => {
  it('连续子串命中得高分且位置越靠前越高；大小写不敏感', () => {
    expect(fuzzyScore('GitHub', 'hub')).toBeGreaterThan(0);
    expect(fuzzyScore('GitHub', 'git')).toBeGreaterThan(fuzzyScore('GitHub', 'hub'));
    expect(fuzzyScore('GitHub', 'GIT')).toBe(fuzzyScore('GitHub', 'git'));
  });

  it('子序列命中得普通分段（fuzzy 容错）；无命中 -1；空查询 0', () => {
    expect(fuzzyScore('GitHub', 'Gh')).toBe(100); // 子序列（G…h）
    expect(fuzzyScore('GitHub', 'zzz')).toBe(-1);
    expect(fuzzyScore('GitHub', '')).toBe(0);
  });

  it('fuzzyFilterEntries：平台/账号/备注任一命中；得分降序，平分按创建时间倒序', () => {
    const list = [
      entry({ id: '1', platform: '微信', account: 'wx-1', createdAt: '2026-01-01T00:00:00.000Z' }),
      entry({ id: '2', platform: 'GitHub', account: 'me', createdAt: '2026-02-01T00:00:00.000Z' }),
      entry({ id: '3', platform: 'Notion', account: 'gh-backup', createdAt: '2026-03-01T00:00:00.000Z' }),
    ];
    // 连续子串命中（gh-backup 账号含 'gh'，高分）在前；子序列命中（G**h 子序列 'gh'）殿后
    const hits = fuzzyFilterEntries(list, 'gh');
    expect(hits.map((e) => e.id)).toEqual(['3', '2']);
    // 空查询全员 0 分 → 按 createdAt 倒序
    const all = fuzzyFilterEntries(list, '');
    expect(all.map((e) => e.id)).toEqual(['3', '2', '1']);
    // 完全无命中
    expect(fuzzyFilterEntries(list, '不存在')).toEqual([]);
  });
});
