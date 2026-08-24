// @vitest-environment node
/**
 * 作息模型测试（2026-08-23：③-5 作息模型 + 主动关心时机判定）
 */
import { describe, it, expect } from 'vitest';
import { buildRhythmProfile, isActiveNow, describeRhythm, periodText, isoWeekKey } from '../../src/smartcat/rhythm';

function entry(iso: string) {
  return { created: iso };
}

describe('buildRhythmProfile', () => {
  it('统计最近 days 天内记忆的小时分布（窗口外忽略）', () => {
    const now = new Date('2026-08-23T12:00:00').getTime();
    const entries = [
      entry(new Date(now - 0).toISOString()),          // 12 点
      entry(new Date(now - 3600e3).toISOString()),     // 11 点
      entry(new Date(now - 2 * 3600e3).toISOString()), // 10 点
      entry(new Date(now - 3 * 3600e3).toISOString()), // 9 点
      entry(new Date(now - 40 * 86400e3).toISOString()), // 窗口外
    ];
    const p = buildRhythmProfile(entries, 30, now);
    expect(p.total).toBe(4);
    expect(p.buckets[12]).toBe(1);
    expect(p.buckets.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('活跃小时 = 计数 ≥ 均值 0.75 倍（总数为 0 → 空）', () => {
    const p0 = buildRhythmProfile([], 30, Date.now());
    expect(p0.activeHours).toEqual([]);
    expect(p0.peakHour).toBe(0);
    const now = new Date('2026-08-23T12:00:00').getTime();
    const entries = Array.from({ length: 10 }, (_, i) => entry(new Date(now - i * 3600e3).toISOString())); // 12-3 点
    const p = buildRhythmProfile(entries, 30, now);
    expect(p.activeHours.length).toBeGreaterThan(0);
    expect(p.activeHours).toContain(12); // 峰值 12 点必活跃
  });

  it('分布过稀 → 退化 top 6（峰值仍保留）', () => {
    const now = new Date('2026-08-23T12:00:00').getTime();
    const entries = [entry(new Date(now).toISOString()), entry(new Date(now).toISOString())]; // 仅 12 点 2 条
    const p = buildRhythmProfile(entries, 30, now);
    expect(p.activeHours.length).toBeLessThanOrEqual(6);
    expect(p.activeHours).toContain(12);
  });
});

describe('isActiveNow', () => {
  it('活跃小时命中返回 true（含指定 hour 参数）', () => {
    const now = new Date('2026-08-23T12:00:00').getTime();
    const p = buildRhythmProfile([entry(new Date(now).toISOString())], 30, now);
    expect(isActiveNow(p, 12)).toBe(true);
    expect(isActiveNow(p, 3)).toBe(false);
  });
});

describe('describeRhythm / periodText', () => {
  it('连续小时合并区间（跨 0 点也合并）', () => {
    expect(describeRhythm({ buckets: [], total: 10, peakHour: 22, activeHours: [20, 21, 22, 23, 0, 1] })).toBe('20-1 点');
    expect(describeRhythm({ buckets: [], total: 10, peakHour: 9, activeHours: [9] })).toBe('9 点');
    expect(describeRhythm({ buckets: [], total: 0, peakHour: 0, activeHours: [] })).toBe('作息数据不足');
  });

  it('时段文本（早晨/下午/晚上/深夜）', () => {
    expect(periodText(8)).toBe('早晨');
    expect(periodText(14)).toBe('下午');
    expect(periodText(20)).toBe('晚上');
    expect(periodText(2)).toBe('深夜');
  });
});

describe('isoWeekKey（主动关心每周计数）', () => {
  it('周键格式 YYYY-Www', () => {
    expect(isoWeekKey(new Date('2026-08-23T12:00:00'))).toMatch(/^\d{4}-W\d{2}$/);
  });
  it('周日/周一跨周 → 键不同', () => {
    const sun = isoWeekKey(new Date('2026-08-23T12:00:00')); // 周日
    const mon = isoWeekKey(new Date('2026-08-24T12:00:00')); // 周一
    expect(sun).not.toBe(mon);
  });
  it('同年不同周 → 键不同', () => {
    const w34 = isoWeekKey(new Date('2026-08-17T12:00:00')); // 2026-08-17 是周一
    const w35 = isoWeekKey(new Date('2026-08-24T12:00:00'));
    expect(w34).not.toBe(w35);
  });
});