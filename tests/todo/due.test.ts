// @vitest-environment node
/**
 * 待办（todo）截止日期工具测试（自 memo/due.ts 迁移，语义逐字保留）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDueStatus, formatDueText } from '../../src/todo/due';
import moment from 'moment';

const fmt = (d: Date) => moment(d).format('YYYY-MM-DD HH:mm');

// 冻结到午间固定时刻：±1 小时相对运算不跨天，避免 23 点后运行误判「明天」
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-06-15T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('getDueStatus', () => {
  it('无截止 → null', () => {
    expect(getDueStatus(null)).toBeNull();
    expect(getDueStatus('')).toBeNull();
  });
  it('过去日期 → overdue', () => {
    expect(getDueStatus('2020-01-01 12:00')).toBe('overdue');
  });
  it('今天已过时刻 → overdue；今天未到 → today', () => {
    const now = moment();
    expect(getDueStatus(fmt(now.clone().subtract(1, 'hour').toDate()))).toBe('overdue');
    expect(getDueStatus(fmt(now.clone().add(1, 'hour').toDate()))).toBe('today');
  });
  it('未来日期 → future', () => {
    expect(getDueStatus(fmt(moment().add(2, 'days').toDate()))).toBe('future');
  });
});

describe('formatDueText', () => {
  it('overdue：N天前已过期 / 今天已过时刻', () => {
    const t = moment();
    expect(formatDueText(fmt(t.clone().subtract(2, 'days').toDate()))).toBe('2天前已过期');
    expect(formatDueText(fmt(t.clone().subtract(30, 'minutes').toDate()))).toMatch(/^今天 \d{2}:\d{2} 已过期$/);
  });
  it('today：今天 HH:mm 到期', () => {
    const t = moment().add(1, 'hour');
    expect(formatDueText(fmt(t.toDate()))).toBe(`今天 ${t.format('HH:mm')} 到期`);
  });
  it('明天 / 未来固定日期', () => {
    const tomorrow = moment().add(1, 'day');
    expect(formatDueText(fmt(tomorrow.toDate()))).toBe(`明天 ${tomorrow.format('HH:mm')} 到期`);
    const later = moment().add(5, 'days');
    expect(formatDueText(fmt(later.toDate()))).toBe(`${later.format('MM/DD')} ${later.format('HH:mm')} 到期`);
  });
  it('absolute 模式：固定 MM/DD HH:mm + 状态后缀', () => {
    const later = moment().add(5, 'days');
    expect(formatDueText(fmt(later.toDate()), 'absolute')).toBe(`${later.format('MM/DD')} ${later.format('HH:mm')} 到期`);
    const past = moment().subtract(3, 'days');
    expect(formatDueText(fmt(past.toDate()), 'absolute')).toBe(`${past.format('MM/DD')} ${past.format('HH:mm')} 已过期`);
  });
});
