// @vitest-environment node
/**
 * 番茄钟周归档层测试（issue 357）：周 key / 周聚合 / 归档合并 / 裁剪归档 / 月趋势合成。
 * 纯数据层：「history 只留 7 天明细」拍板不变，离开保留窗的明细按自然周（周一起始）聚合成
 * archived 归档行；月趋势 = 归档行 + 当前 7 天明细合成（两源按日不交，不重复累计）。
 */
import { describe, it, expect } from 'vitest';
import { weekKeyOf, aggregateWeeks, mergeArchived, lastNMonths, TREND_MONTHS } from '../../src/pomodoro/stats';
import { trimWithArchive } from '../../src/pomodoro/data';
import type { HistoryEntry, ArchivedWeek } from '../../src/pomodoro/state';

// NOW = 2026-08-10 周一 10:00 本地（与 stats.test.ts 同基准）
const NOW = new Date(2026, 7, 10, 10, 0, 0).getTime();
const DAY = 86_400_000;

function entry(y: number, m: number, d: number, duration = 1500, task?: string): HistoryEntry {
  return { ts: new Date(y, m - 1, d, 9, 0, 0).getTime(), duration, ...(task ? { task } : {}) };
}

describe('weekKeyOf（自然周 key：周一日期）', () => {
  it('周一即当周 key；周日归上周一；周六归本周一', () => {
    expect(weekKeyOf(new Date(2026, 7, 10, 10, 0, 0).getTime())).toBe('2026-08-10'); // 周一
    expect(weekKeyOf(new Date(2026, 7, 9, 23, 0, 0).getTime())).toBe('2026-08-03'); // 周日 → 上周一
    expect(weekKeyOf(new Date(2026, 7, 15, 8, 0, 0).getTime())).toBe('2026-08-10'); // 周六 → 本周一
  });

  it('跨月与跨年周：周二 9/1 → 8/31；周五 2027/1/1 → 2026-12-28', () => {
    expect(weekKeyOf(new Date(2026, 8, 1, 9, 0, 0).getTime())).toBe('2026-08-31');
    expect(weekKeyOf(new Date(2027, 0, 1, 9, 0, 0).getTime())).toBe('2026-12-28');
  });
});

describe('aggregateWeeks（被裁明细按自然周聚合）', () => {
  it('同周合并、跨周分行、按周升序', () => {
    const rows = aggregateWeeks([entry(2026, 8, 10), entry(2026, 8, 12), entry(2026, 8, 5), entry(2026, 7, 20)]);
    expect(rows).toEqual([
      { week: '2026-07-20', count: 1, minutes: 25 },
      { week: '2026-08-03', count: 1, minutes: 25 },
      { week: '2026-08-10', count: 2, minutes: 50 },
    ]);
  });

  it('任务分布按分钟记账；无归属任务的周不带 tasks 键', () => {
    const rows = aggregateWeeks([entry(2026, 8, 10, 1500, '写报告'), entry(2026, 8, 10), entry(2026, 8, 11, 3600, '写报告')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(3);
    expect(rows[0].minutes).toBe(110); // 25 + 25 + 60
    expect(rows[0].tasks).toEqual({ 写报告: 85 }); // 25 + 60
  });

  it('空明细 → 空数组', () => {
    expect(aggregateWeeks([])).toEqual([]);
  });
});

describe('mergeArchived（周 key 判重增量合并，同一周不重复建行）', () => {
  it('无既有段 → 传入行原样（副本）', () => {
    const incoming: ArchivedWeek[] = [{ week: '2026-08-03', count: 1, minutes: 25 }];
    expect(mergeArchived(undefined, incoming)).toEqual(incoming);
  });

  it('同周增量累加（count/minutes/tasks），结果按周升序', () => {
    const existing: ArchivedWeek[] = [{ week: '2026-08-10', count: 2, minutes: 50, tasks: { 写报告: 50 } }];
    const incoming: ArchivedWeek[] = [
      { week: '2026-08-03', count: 1, minutes: 25 },
      { week: '2026-08-10', count: 1, minutes: 25, tasks: { 写报告: 25 } },
    ];
    const merged = mergeArchived(existing, incoming);
    expect(merged.map((r) => r.week)).toEqual(['2026-08-03', '2026-08-10']);
    expect(merged[1]).toEqual({ week: '2026-08-10', count: 3, minutes: 75, tasks: { 写报告: 75 } });
  });

  it('incoming 无 tasks、既有有 tasks → 既有任务分布保留', () => {
    const existing: ArchivedWeek[] = [{ week: '2026-08-03', count: 1, minutes: 25, tasks: { 旧任务: 25 } }];
    expect(mergeArchived(existing, [{ week: '2026-08-03', count: 1, minutes: 25 }])).toEqual([
      { week: '2026-08-03', count: 2, minutes: 50, tasks: { 旧任务: 25 } },
    ]);
  });
});

describe('trimWithArchive（裁剪 + 周归档：F13 保留窗口径不变）', () => {
  // NOW2 = 2026-08-12 周三 10:00 → 保留窗起点 = 2026-08-06 零点
  const NOW2 = new Date(2026, 7, 12, 10, 0, 0).getTime();

  it('窗外条目被裁并按周归档；窗内不动', () => {
    const history = [entry(2026, 8, 12), entry(2026, 8, 8), entry(2026, 8, 5), entry(2026, 7, 20)];
    const r = trimWithArchive(history, undefined, NOW2);
    expect(r.history).toEqual([entry(2026, 8, 12), entry(2026, 8, 8)]); // 窗内保留（顺序不变）
    expect(r.archived).toEqual([
      { week: '2026-07-20', count: 1, minutes: 25 },
      { week: '2026-08-03', count: 1, minutes: 25 },
    ]);
  });

  it('与既有归档段同周增量合并（同一周不重复建行）', () => {
    const existing: ArchivedWeek[] = [{ week: '2026-08-03', count: 2, minutes: 50, tasks: { 旧任务: 50 } }];
    const r = trimWithArchive([entry(2026, 8, 5, 1500, '新任务')], existing, NOW2);
    expect(r.history).toEqual([]);
    expect(r.archived).toEqual([{ week: '2026-08-03', count: 3, minutes: 75, tasks: { 旧任务: 50, 新任务: 25 } }]);
  });

  it('幂等：对裁剪结果二次裁剪不增账（明细已从 history 移除，至多入账一次）', () => {
    const history = [entry(2026, 8, 12), entry(2026, 8, 5)];
    const once = trimWithArchive(history, undefined, NOW2);
    const twice = trimWithArchive(once.history, once.archived, NOW2);
    expect(twice.history).toEqual(once.history);
    expect(twice.archived).toEqual(once.archived);
  });

  it('全部在窗内 → 明细原样、归档段不变；未来时间戳（时钟回拨）保守保留', () => {
    const history = [entry(2026, 8, 12), { ts: NOW2 + DAY, duration: 1500 }];
    const r = trimWithArchive(history, [], NOW2);
    expect(r.history).toEqual(history);
    expect(r.archived).toEqual([]);
  });
});

describe('lastNMonths（月趋势合成：归档行 + 当前 7 天明细，不重复累计）', () => {
  it('默认近 6 个月（含当月，旧→新）；归档行整周记入周一所属月', () => {
    const archived: ArchivedWeek[] = [
      { week: '2026-07-06', count: 2, minutes: 50 },
      { week: '2026-08-03', count: 1, minutes: 25 },
    ];
    const history = [entry(2026, 8, 10), entry(2026, 8, 9)];
    const months = lastNMonths(archived, history, NOW);
    expect(months).toHaveLength(TREND_MONTHS);
    expect(months.map((m) => m.month)).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
    expect(months[4]).toEqual({ month: '2026-07', count: 2, minutes: 50 });
    expect(months[5]).toEqual({ month: '2026-08', count: 3, minutes: 75 }); // 归档 1 + 明细 2
    expect(months[0]).toEqual({ month: '2026-03', count: 0, minutes: 0 });
  });

  it('不重复累计：同周「窗外归档部分 + 窗内明细部分」按日恒不交，合成=全量', () => {
    // NOW2 = 周三 8/12：本周一 8/10、上 8/3 周的 8/6-8/9 在窗内（明细）；8/3-8/5 已归档
    const NOW2 = new Date(2026, 7, 12, 10, 0, 0).getTime();
    const archived: ArchivedWeek[] = [{ week: '2026-08-03', count: 3, minutes: 75 }]; // 8/3、8/4、8/5
    const history = [entry(2026, 8, 6), entry(2026, 8, 7), entry(2026, 8, 8), entry(2026, 8, 9)];
    const months = lastNMonths(archived, history, NOW2);
    expect(months[5]).toEqual({ month: '2026-08', count: 7, minutes: 175 }); // 3+4 条、75+100 分钟
  });

  it('趋势窗外（更早月份）的归档行不计；旧文件无 archived 段 → 只有当月明细', () => {
    const archived: ArchivedWeek[] = [{ week: '2026-01-05', count: 9, minutes: 225 }];
    const months = lastNMonths(archived, [entry(2026, 8, 10)], NOW);
    expect(months[5]).toEqual({ month: '2026-08', count: 1, minutes: 25 });
    expect(months.reduce((s, m) => s + m.count, 0)).toBe(1);

    const noArchive = lastNMonths(undefined, [entry(2026, 8, 10)], NOW); // 零迁移：无段照常
    expect(noArchive[5]).toEqual({ month: '2026-08', count: 1, minutes: 25 });
    expect(noArchive.reduce((s, m) => s + m.count, 0)).toBe(1);
  });

  it('自定义档位数 n=2 → [上月, 当月]', () => {
    const months = lastNMonths([{ week: '2026-07-06', count: 1, minutes: 25 }], [], NOW, 2);
    expect(months.map((m) => m.month)).toEqual(['2026-07', '2026-08']);
    expect(months[0]).toEqual({ month: '2026-07', count: 1, minutes: 25 });
  });

  it('空输入 → 6 个月全 0 桶', () => {
    expect(lastNMonths(undefined, [], NOW)).toEqual([
      { month: '2026-03', count: 0, minutes: 0 },
      { month: '2026-04', count: 0, minutes: 0 },
      { month: '2026-05', count: 0, minutes: 0 },
      { month: '2026-06', count: 0, minutes: 0 },
      { month: '2026-07', count: 0, minutes: 0 },
      { month: '2026-08', count: 0, minutes: 0 },
    ]);
  });
});
