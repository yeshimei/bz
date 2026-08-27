// @vitest-environment node
/**
 * 行为流滚动窗口测试（P1 数据基座，ticket 123）
 * 覆盖：天数清理、条数清理、双重约束、空流、边界条件。
 */
import { describe, it, expect } from 'vitest';
import { trimBehaviorStream, BEHAVIOR_TRIM_DEFAULTS } from '../../src/smartcat/behavior-trim';
import type { BehaviorItem } from '../../src/smartcat/types';

function makeItem(ts: string, id?: string): BehaviorItem {
  return {
    id: id || `beh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: ts,
    type: 'test',
    source: 'test',
    description: 'test item',
  };
}

describe('trimBehaviorStream', () => {
  it('空流 → 空', () => {
    const result = trimBehaviorStream([]);
    expect(result).toEqual([]);
  });

  it('所有条目在窗口内 → 不清理', () => {
    const now = new Date('2026-08-27T12:00:00Z').getTime();
    const items = [
      makeItem('2026-08-26T12:00:00Z'),
      makeItem('2026-08-27T06:00:00Z'),
    ];
    const result = trimBehaviorStream(items, {}, now);
    expect(result.length).toBe(2);
  });

  it('超出天数的旧条目被删除', () => {
    const now = new Date('2026-08-27T12:00:00Z').getTime();
    const items = [
      makeItem('2026-07-20T12:00:00Z'), // 38 天前，超出 30 天
      makeItem('2026-08-10T12:00:00Z'), // 17 天前，在窗口内
      makeItem('2026-08-27T12:00:00Z'), // 当天
    ];
    const result = trimBehaviorStream(items, {}, now);
    expect(result.length).toBe(2);
    expect(result.find((i) => i.timestamp === '2026-07-20T12:00:00Z')).toBeUndefined();
  });

  it('超出条数限制时按时间截断（保留最新）', () => {
    const now = new Date('2026-08-27T12:00:00Z').getTime();
    const items: BehaviorItem[] = [];
    for (let i = 0; i < 1005; i++) {
      const d = new Date(now - i * 60000); // 每分钟一条
      items.push(makeItem(d.toISOString(), `beh_${i}`));
    }
    const result = trimBehaviorStream(items, {}, now);
    expect(result.length).toBe(1000); // 默认 maxCount=1000
  });

  it('自定义 maxDays', () => {
    const now = new Date('2026-08-27T12:00:00Z').getTime();
    const items = [
      makeItem('2026-08-25T12:00:00Z'), // 2 天前
      makeItem('2026-08-20T12:00:00Z'), // 7 天前
      makeItem('2026-08-01T12:00:00Z'), // 26 天前
    ];
    const result = trimBehaviorStream(items, { maxDays: 5 }, now);
    expect(result.length).toBe(1); // 只有 8-25 在 5 天内
  });

  it('自定义 maxCount', () => {
    const now = new Date('2026-08-27T12:00:00Z').getTime();
    const items: BehaviorItem[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(now - i * 86400000); // 每天一条
      items.push(makeItem(d.toISOString(), `beh_${i}`));
    }
    const result = trimBehaviorStream(items, { maxCount: 5 }, now);
    expect(result.length).toBe(5);
  });

  it('双重约束：天数和条数同时生效', () => {
    const now = new Date('2026-08-27T12:00:00Z').getTime();
    const items: BehaviorItem[] = [];
    // 20 条，全在 30 天内
    for (let i = 0; i < 20; i++) {
      const d = new Date(now - i * 86400000);
      items.push(makeItem(d.toISOString(), `beh_${i}`));
    }
    // maxCount=10 截断到 10 条
    const result = trimBehaviorStream(items, { maxCount: 10 }, now);
    expect(result.length).toBe(10);
  });

  it('不修改原数组', () => {
    const now = new Date('2026-08-27T12:00:00Z').getTime();
    const items = [
      makeItem('2026-07-20T12:00:00Z'),
      makeItem('2026-08-27T12:00:00Z'),
    ];
    const original = [...items];
    trimBehaviorStream(items, {}, now);
    expect(items).toEqual(original); // 原数组未被修改
  });

  it('无效时间戳的条目被过滤', () => {
    const now = new Date('2026-08-27T12:00:00Z').getTime();
    const items = [
      makeItem('invalid-date'),
      makeItem('2026-08-27T12:00:00Z'),
    ];
    const result = trimBehaviorStream(items, {}, now);
    expect(result.length).toBe(1);
  });

  it('默认参数值正确', () => {
    expect(BEHAVIOR_TRIM_DEFAULTS.maxDays).toBe(30);
    expect(BEHAVIOR_TRIM_DEFAULTS.maxCount).toBe(1000);
  });

  it('刚好在天数边界上的条目保留', () => {
    const now = new Date('2026-08-27T12:00:00Z').getTime();
    // 恰好 30 天前（减去精确的 30 天毫秒数）
    const exactly30Days = new Date(now - 30 * 86400000).toISOString();
    const items = [makeItem(exactly30Days)];
    const result = trimBehaviorStream(items, {}, now);
    expect(result.length).toBe(1); // 边界值保留
  });
});
