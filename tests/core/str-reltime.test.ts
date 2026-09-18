/**
 * core/ui/str relTime 跨域单源回归（review-deep 一致#4 收编）：
 * - 档位与说法 = favorites 原版蓝本拍板（「N 分钟前」带空格，7 天封顶回落 M-D）；
 * - favorites/shared、password-vault/render 两处转发后与单源输出逐字一致
 *   （pwv 原「今天/昨天/N 天前/N月N日」另一套词汇退役）；
 * - core/utils formatRelativeTime 今天内基础档同说法（昨天/前天/周几增强档留 utils）。
 */
import { describe, it, expect } from 'vitest';
import { relTime } from '../../src/core/ui/str';
import { relTime as favRelTime } from '../../src/favorites/shared';
import { relTime as pwvRelTime } from '../../src/password-vault/render';

const NOW = new Date(2025, 5, 15, 12, 0, 0).getTime(); // 2025-06-15 12:00
const fmt = (d: Date) => `${d.getFullYear()}-06-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

describe('str.relTime 档位（拍板口径：带空格 + 7 天封顶）', () => {
  it('空值 → 空串；无效串 → 原串返回', () => {
    expect(relTime('', NOW)).toBe('');
    expect(relTime(undefined, NOW)).toBe('');
    expect(relTime('not-a-date', NOW)).toBe('not-a-date');
  });

  it('1 分钟内 → 刚刚', () => {
    expect(relTime('2025-06-15 11:59:40', NOW)).toBe('刚刚');
  });

  it('1 小时内 → N 分钟前（带空格）', () => {
    expect(relTime('2025-06-15 11:55:00', NOW)).toBe('5 分钟前');
  });

  it('今天更早 → N 小时前（带空格）', () => {
    expect(relTime('2025-06-15 09:00:00', NOW)).toBe('3 小时前');
  });

  it('昨天起 7 天内 → N 天前', () => {
    expect(relTime('2025-06-14 12:00:00', NOW)).toBe('1 天前');
    expect(relTime('2025-06-09 11:59:00', NOW)).toBe('6 天前');
  });

  it('超 7 天回落 M-D 短日期（月不补零、日补零）', () => {
    expect(relTime('2025-06-08 11:00:00', NOW)).toBe('6-08');
    expect(relTime('2024-12-31 08:00:00', NOW)).toBe('12-31');
  });

  it('now 可注入（测试/评审壳重放时钟不旁路）', () => {
    const s = '2025-06-15 11:00:00';
    expect(relTime(s, NOW)).toBe('1 小时前');
    expect(relTime(s, NOW + 3 * 3600000)).toBe('4 小时前');
  });
});

describe('转发收编：域内 relTime 与单源逐字一致', () => {
  const samples: Array<[string, number]> = [
    ['2025-06-15 11:59:40', NOW], // 刚刚
    ['2025-06-15 11:55:00', NOW], // N 分钟前
    ['2025-06-15 09:00:00', NOW], // N 小时前
    ['2025-06-14 12:00:00', NOW], // N 天前
    ['2025-06-08 11:00:00', NOW], // M-D 封顶
    ['', NOW], // 空串
    ['not-a-date', NOW], // 无效串
  ];
  it('favorites/shared relTime = str.relTime', () => {
    for (const [s, now] of samples) expect(favRelTime(s, now)).toBe(relTime(s, now));
  });
  it('password-vault/render relTime = str.relTime（原「今天/昨天」档位退役）', () => {
    for (const [s, now] of samples) expect(pwvRelTime(s, now)).toBe(relTime(s, now));
    // 同日 3 小时前：不再是 pwv 旧版的「今天」
    expect(pwvRelTime(fmt(new Date(NOW - 3 * 3600000)), NOW)).toBe('3 小时前');
  });
});
