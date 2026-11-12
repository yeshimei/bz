/** 本机计数账本：跨天、会话、小时桶、裁剪与坏数据兜底。 */
import { describe, expect, it } from 'vitest';
import { addActiveMinute, isDayKey, normalizeLedger, pruneDays, recordCommand, startSession } from '../../src/core/usage/ledger';
import { emptyLedger } from '../../src/core/usage/types';

/** 本地时刻（不用 UTC，跨天口径必须按用户本地时间） */
const at = (y: number, mo: number, d: number, h = 9, mi = 0): number => new Date(y, mo - 1, d, h, mi).getTime();

describe('usage · 账本', () => {
  it('命令计数同时进命令表与域表', () => {
    const l = emptyLedger(at(2026, 11, 11));
    recordCommand(l, 'bz-memo-open', at(2026, 11, 11, 9, 1));
    recordCommand(l, 'bz-memo-open', at(2026, 11, 11, 9, 2));
    recordCommand(l, 'bz-diary-open', at(2026, 11, 11, 9, 3));
    const day = l.days['2026-11-11'];
    expect(day.commands['bz-memo-open']).toBe(2);
    expect(day.domains.memo).toBe(2);
    expect(day.domains.diary).toBe(1);
    expect(day.firstAt).toBe(at(2026, 11, 11, 9, 1));
    expect(day.lastAt).toBe(at(2026, 11, 11, 9, 3));
  });

  it('跨天自动分桶（本地日期，不是 UTC 日期）', () => {
    const l = emptyLedger(at(2026, 11, 11));
    recordCommand(l, 'bz-memo-open', at(2026, 11, 11, 23, 59));
    recordCommand(l, 'bz-memo-open', at(2026, 11, 12, 0, 1));
    expect(Object.keys(l.days).sort()).toEqual(['2026-11-11', '2026-11-12']);
    expect(l.days['2026-11-12'].commands['bz-memo-open']).toBe(1);
  });

  it('会话：30 分钟内连续动作算一段，断开才算新会话', () => {
    const l = emptyLedger(at(2026, 11, 11));
    recordCommand(l, 'bz-memo-open', at(2026, 11, 11, 9, 0));
    recordCommand(l, 'bz-memo-open', at(2026, 11, 11, 9, 20));
    expect(l.days['2026-11-11'].sessions).toBe(1);
    recordCommand(l, 'bz-memo-open', at(2026, 11, 11, 10, 5));
    expect(l.days['2026-11-11'].sessions).toBe(2);
  });

  it('startSession：30 分钟内重载不算新会话', () => {
    const l = emptyLedger(at(2026, 11, 11));
    startSession(l, at(2026, 11, 11, 9, 0));
    startSession(l, at(2026, 11, 11, 9, 10));
    expect(l.days['2026-11-11'].sessions).toBe(1);
    startSession(l, at(2026, 11, 11, 11, 0));
    expect(l.days['2026-11-11'].sessions).toBe(2);
  });

  it('活跃分钟落进对应小时桶', () => {
    const l = emptyLedger(at(2026, 11, 11));
    addActiveMinute(l, at(2026, 11, 11, 21, 0));
    addActiveMinute(l, at(2026, 11, 11, 21, 1));
    addActiveMinute(l, at(2026, 11, 11, 8, 0));
    const day = l.days['2026-11-11'];
    expect(day.activeMinutes).toBe(3);
    expect(day.hourMinutes[21]).toBe(2);
    expect(day.hourMinutes[8]).toBe(1);
    expect(day.hourMinutes).toHaveLength(24);
  });

  it('14 天裁剪只删更老的，今天一定在', () => {
    const l = emptyLedger(at(2026, 11, 11));
    for (let i = 0; i < 20; i += 1) {
      recordCommand(l, 'bz-memo-open', at(2026, 11, 11) - i * 86_400_000);
    }
    const removed = pruneDays(l, at(2026, 11, 11), 14);
    expect(removed).toBe(6);
    expect(Object.keys(l.days)).toHaveLength(14);
    expect(l.days['2026-11-11']).toBeTruthy();
  });

  it('坏账本兜底：合法字段救回来，非法整条丢', () => {
    const now = at(2026, 11, 11);
    const l = normalizeLedger(
      {
        createdAt: 'x',
        lastSentDate: '2026-13-99',
        failures: -5,
        days: {
          '2026-11-10': { sessions: '3', activeMinutes: 9999, hourMinutes: [1, 2], commands: { 'bz-memo-open': 2, bad: 9 }, domains: { memo: 2 } },
          '不是日期': { sessions: 1 },
        },
      },
      now,
    );
    expect(l.lastSentDate).toBe('');
    expect(l.failures).toBe(0);
    expect(l.createdAt).toBe(now);
    expect(Object.keys(l.days)).toEqual(['2026-11-10']);
    const d = l.days['2026-11-10'];
    expect(d.sessions).toBe(3);
    expect(d.activeMinutes).toBe(1440);
    expect(d.hourMinutes).toHaveLength(24);
    expect(d.hourMinutes[0]).toBe(1);
    expect(d.commands).toEqual({ 'bz-memo-open': 2 });
    expect(d.domains).toEqual({ memo: 2 });
  });

  it('日期键校验拦住不存在的日子', () => {
    expect(isDayKey('2026-11-11')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-1-1')).toBe(false);
    expect(isDayKey('')).toBe(false);
  });
});
