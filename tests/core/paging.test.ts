/**
 * core/paging（ADR-0231 分片口径单源）单元测试。
 *
 * 这是影院与日记本**共用的后台批粒度**：两域各自算首屏窗口，但每批多大是跨域政策。
 * 函数本身很小，守的是边界——越界、空集、铺满、size 退化，这些错法在 820/1443 规模下
 * 表现为「少几张」或「死循环 append」，很难在 UI 上定位。
 */
import { describe, it, expect } from 'vitest';
import { LIST_BATCH_SIZE, nextBatchRange } from '../../src/core/paging';

describe('core/paging', () => {
  it('LIST_BATCH_SIZE = 50（跨域后台批粒度单源，两域不得各写各的）', () => {
    expect(LIST_BATCH_SIZE).toBe(50);
  });

  it('常规：已渲 20 / 共 820 → 下一批 [20, 70)', () => {
    expect(nextBatchRange(20, 820)).toEqual({ from: 20, to: 70 });
  });

  it('末批封顶在 total，不越界', () => {
    expect(nextBatchRange(800, 820)).toEqual({ from: 800, to: 820 });
  });

  it('已铺满 → from >= to（调用方据此收工，不再 append）', () => {
    const r = nextBatchRange(820, 820);
    expect(r.from).toBeGreaterThanOrEqual(r.to);
  });

  it('rendered 越界被钳制（> total 或负数）', () => {
    expect(nextBatchRange(999, 820)).toEqual({ from: 820, to: 820 });
    expect(nextBatchRange(-5, 820)).toEqual({ from: 0, to: 50 });
  });

  it('空集合 → 无批可发', () => {
    expect(nextBatchRange(0, 0)).toEqual({ from: 0, to: 0 });
  });

  it('size 可覆盖；size < 1 时至少发 1 条（防 append 死循环）', () => {
    expect(nextBatchRange(0, 10, 3)).toEqual({ from: 0, to: 3 });
    expect(nextBatchRange(0, 10, 0)).toEqual({ from: 0, to: 1 });
    expect(nextBatchRange(0, 10, -1)).toEqual({ from: 0, to: 1 });
  });
});
