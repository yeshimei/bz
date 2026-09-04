// @vitest-environment node
/**
 * 待办（todo）截止日期工具测试（自 memo/due.ts 迁移，语义逐字保留）
 * fake timers 钉死系统时钟：due.ts 走 moment() 真时钟，不钉会随运行时刻漂移
 * （23 点档 +1h 跨午夜 →「今天/明天」口径翻转）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDueStatus, formatDueText } from '../../src/todo/due';
import moment from 'moment';

const fmt = (d: Date) => moment(d).format('YYYY-MM-DD HH:mm');

/** 固定基准：2026-08-10（周一）正午——±1 小时/±N 天全部落在可控日界内 */
const NOW = moment('2026-08-10 12:00');

describe('getDueStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW.toDate());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('无截止 → null', () => {
    expect(getDueStatus(null)).toBeNull();
    expect(getDueStatus('')).toBeNull();
  });
  it('过去日期 → overdue', () => {
    expect(getDueStatus('2020-01-01 12:00')).toBe('overdue');
  });
  it('今天已过时刻 → overdue；今天未到 → today', () => {
    expect(getDueStatus(fmt(NOW.clone().subtract(1, 'hour').toDate()))).toBe('overdue');
    expect(getDueStatus(fmt(NOW.clone().add(1, 'hour').toDate()))).toBe('today');
  });
  it('未来日期 → future', () => {
    expect(getDueStatus(fmt(NOW.clone().add(2, 'days').toDate()))).toBe('future');
  });
});

describe('formatDueText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW.toDate());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('overdue：N天前已过期 / 今天已过时刻', () => {
    expect(formatDueText(fmt(NOW.clone().subtract(2, 'days').toDate()))).toBe('2天前已过期');
    expect(formatDueText(fmt(NOW.clone().subtract(30, 'minutes').toDate()))).toMatch(/^今天 \d{2}:\d{2} 已过期$/);
  });
  it('today：今天 HH:mm 到期', () => {
    const t = NOW.clone().add(1, 'hour');
    expect(formatDueText(fmt(t.toDate()))).toBe(`今天 ${t.format('HH:mm')} 到期`);
  });
  it('明天 / 未来固定日期', () => {
    const tomorrow = NOW.clone().add(1, 'day');
    expect(formatDueText(fmt(tomorrow.toDate()))).toBe(`明天 ${tomorrow.format('HH:mm')} 到期`);
    const later = NOW.clone().add(5, 'days');
    expect(formatDueText(fmt(later.toDate()))).toBe(`${later.format('MM/DD')} ${later.format('HH:mm')} 到期`);
  });
  it('absolute 模式：固定 MM/DD HH:mm + 状态后缀', () => {
    const later = NOW.clone().add(5, 'days');
    expect(formatDueText(fmt(later.toDate()), 'absolute')).toBe(`${later.format('MM/DD')} ${later.format('HH:mm')} 到期`);
    const past = NOW.clone().subtract(3, 'days');
    expect(formatDueText(fmt(past.toDate()), 'absolute')).toBe(`${past.format('MM/DD')} ${past.format('HH:mm')} 已过期`);
  });
});
