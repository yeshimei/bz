/**
 * 备忘录截止日期工具测试（ticket 04）：getDueStatus / formatDueText 语义
 * （逾期/今日到期/未来；N天前已过期/今天 HH:mm 到期等文案）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import moment from 'moment';
import { getDueStatus, formatDueText } from '../../src/bz/due';

/** 固定当前时间为 2025-06-15 12:00 */
function freezeNow(iso = '2025-06-15 12:00:00') {
  vi.useFakeTimers();
  vi.setSystemTime(moment(iso, 'YYYY-MM-DD HH:mm:ss').toDate());
}

afterEach(() => {
  vi.useRealTimers();
});

describe('getDueStatus', () => {
  it('无截止 → null', () => {
    expect(getDueStatus(null)).toBeNull();
    expect(getDueStatus('')).toBeNull();
  });

  it('过去日期 → overdue', () => {
    freezeNow();
    expect(getDueStatus('2025-06-14 23:59')).toBe('overdue');
  });

  it('未来日期 → future', () => {
    freezeNow();
    expect(getDueStatus('2025-06-16 00:01')).toBe('future');
  });

  it('今日且时间未到 → today', () => {
    freezeNow();
    expect(getDueStatus('2025-06-15 18:00')).toBe('today');
  });

  it('今日且时间已过 → overdue', () => {
    freezeNow();
    expect(getDueStatus('2025-06-15 10:00')).toBe('overdue');
    expect(getDueStatus('2025-06-15 12:00')).toBe('overdue'); // 边界：等于现在
  });

  it('T 分隔符（datetime-local）兼容', () => {
    freezeNow();
    expect(getDueStatus('2025-06-15T18:00')).toBe('today');
  });
});

describe('formatDueText', () => {
  it('今日已过期 → 今天 HH:mm 已过期', () => {
    freezeNow();
    expect(formatDueText('2025-06-15 10:00')).toBe('今天 10:00 已过期');
  });

  it('N天前已过期（跨天）', () => {
    freezeNow();
    expect(formatDueText('2025-06-12 09:00')).toBe('3天前已过期');
  });

  it('今日到期 → 今天 HH:mm 到期', () => {
    freezeNow();
    expect(formatDueText('2025-06-15 18:00')).toBe('今天 18:00 到期');
  });

  it('明天到期 → 明天 HH:mm 到期', () => {
    freezeNow();
    expect(formatDueText('2025-06-16 08:30')).toBe('明天 08:30 到期');
  });

  it('更远未来 → MM/DD HH:mm 到期', () => {
    freezeNow();
    expect(formatDueText('2025-07-01 10:00')).toBe('07/01 10:00 到期');
  });
});
