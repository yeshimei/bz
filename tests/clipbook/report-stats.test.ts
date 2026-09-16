// @vitest-environment node
/**
 * clipbook 阅读报告·统计纯函数（issue 358）。
 * 覆盖：周期起点（周一/月初口径）、周期过滤、聚合口径（去重篇数/时长求和/来源 Top N/
 * 24 小时桶/活跃天数/读得最久）、时长人话格式化。now 显式入参，不依赖真实时钟。
 */
import { describe, it, expect } from 'vitest';
import {
  periodStartTs, filterReadLogByPeriod, buildClipReport, formatMinutes, REPORT_TOP_N,
  type ClipReportData,
} from '../../src/clipbook/report-stats';
import type { ClipReadLogEntry } from '../../src/clipbook/data';

/** 固定「现在」= 2026-09-16（周三）14:30 本地：本周一 = 09-14，本月 1 日 = 09-01 */
const NOW = new Date(2026, 8, 16, 14, 30, 0);

const e = (patch: Partial<ClipReadLogEntry>): ClipReadLogEntry => ({
  key: 'url:https://x.com/a', title: '标题', src: '知乎日报', minutes: 5, ts: NOW.getTime(),
  ...patch,
});

describe('periodStartTs 周期起点', () => {
  it('本周 = 本周一 00:00（周三回退 2 天）', () => {
    const monday = new Date(2026, 8, 14, 0, 0, 0, 0).getTime();
    expect(periodStartTs('week', NOW)).toBe(monday);
  });
  it('周一日当天 = 当天 00:00（不落上周）', () => {
    const mon = new Date(2026, 8, 14, 9, 0, 0);
    expect(periodStartTs('week', mon)).toBe(new Date(2026, 8, 14, 0, 0, 0).getTime());
  });
  it('周日 = 其所在周（6 天前）的周一', () => {
    const sun = new Date(2026, 8, 20, 9, 0, 0);
    expect(periodStartTs('week', sun)).toBe(new Date(2026, 8, 14, 0, 0, 0).getTime());
  });
  it('本月 = 1 日 00:00', () => {
    expect(periodStartTs('month', NOW)).toBe(new Date(2026, 8, 1, 0, 0, 0).getTime());
  });
});

describe('filterReadLogByPeriod 周期过滤', () => {
  it('只保留起点之后的记录；null/undefined → 空', () => {
    const log = [
      e({ ts: NOW.getTime() }),
      e({ ts: new Date(2026, 8, 10).getTime() }),    // 本月但上周
      e({ ts: new Date(2026, 7, 20).getTime() }),    // 上月
    ];
    expect(filterReadLogByPeriod(log, 'week', NOW)).toHaveLength(1);
    expect(filterReadLogByPeriod(log, 'month', NOW)).toHaveLength(2);
    expect(filterReadLogByPeriod(null, 'month', NOW)).toEqual([]);
    // 非法 ts 丢弃
    expect(filterReadLogByPeriod([e({ ts: NaN }), e({ ts: Infinity })], 'week', NOW)).toEqual([]);
  });
});

describe('buildClipReport 聚合口径', () => {
  it('篇数按 key 去重；时长/会话数全量求和；小时桶按 ts 归桶', () => {
    const log = [
      e({ key: 'url:a', title: '甲', src: '知乎日报', minutes: 10, ts: new Date(2026, 8, 15, 9, 0).getTime() }),
      e({ key: 'url:a', title: '甲', src: '知乎日报', minutes: 5, ts: new Date(2026, 8, 15, 22, 0).getTime() }), // 同篇二段
      e({ key: 'url:b', title: '乙', src: 'B站UP·影视飓风', minutes: 30, ts: new Date(2026, 8, 16, 9, 0).getTime() }),
    ];
    const d: ClipReportData = buildClipReport(log, 'week', NOW);
    expect(d.articles).toBe(2);          // 甲同篇两段只计 1 篇
    expect(d.sessions).toBe(3);
    expect(d.totalMinutes).toBe(45);
    expect(d.activeDays).toBe(2);        // 09-15 与 09-16
    expect(d.hours[9]).toBe(40);         // 两天 9 点合计
    expect(d.hours[22]).toBe(5);
    expect(d.topArticles[0]).toMatchObject({ key: 'url:b', minutes: 30 });
    expect(d.topArticles[1]).toMatchObject({ key: 'url:a', minutes: 15 });
  });

  it('来源分布：分钟降序；篇数按来源去重计；空 src 归「未知」', () => {
    const log = [
      e({ key: 'url:a', src: '知乎日报', minutes: 10 }),
      e({ key: 'url:b', src: '知乎日报', minutes: 8 }),
      e({ key: 'url:c', src: '果壳科学人', minutes: 25 }),
      e({ key: 'url:d', src: '', minutes: 3 }),
    ];
    const d = buildClipReport(log, 'week', NOW);
    expect(d.bySrc.map((r) => r.name)).toEqual(['果壳科学人', '知乎日报', '未知']);
    expect(d.bySrc[0]).toMatchObject({ articles: 1, minutes: 25 });
    expect(d.bySrc[1]).toMatchObject({ articles: 2, minutes: 18 });
    expect(d.bySrc[2]).toMatchObject({ articles: 1, minutes: 3 });
  });

  it('空数据 → 零值结果（篇数 0、24 桶全 0）', () => {
    const d = buildClipReport([], 'week', NOW);
    expect(d.articles).toBe(0);
    expect(d.totalMinutes).toBe(0);
    expect(d.hours).toHaveLength(24);
    expect(d.hours.every((h) => h === 0)).toBe(true);
    expect(d.bySrc).toEqual([]);
    expect(d.topArticles).toEqual([]);
  });

  it('minutes 非法（0/负数/非数字）的段不计入', () => {
    const log = [e({ minutes: 0 }), e({ minutes: -5 }), e({ minutes: NaN as any }), e({ minutes: 4 })];
    const d = buildClipReport(log, 'week', NOW);
    expect(d.sessions).toBe(4);
    expect(d.articles).toBe(1);
    expect(d.totalMinutes).toBe(4);
  });

  it('REPORT_TOP_N = 5（来源/最长阅读榜口径）', () => {
    expect(REPORT_TOP_N).toBe(5);
  });
});

describe('formatMinutes 时长人话', () => {
  it('不足 1 小时只报分钟；跨小时带分钟；整小时省略分钟', () => {
    expect(formatMinutes(45)).toBe('45 分钟');
    expect(formatMinutes(75)).toBe('1 小时 15 分钟');
    expect(formatMinutes(120)).toBe('2 小时');
    expect(formatMinutes(0)).toBe('0 分钟');
  });
});
