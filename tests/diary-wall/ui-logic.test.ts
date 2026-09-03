// @vitest-environment node
/**
 * 回忆墙 UI 纯逻辑回归（P1 审查修复：滚动高亮坐标系）。
 * pickCurrentMonth 只认「节头顶相对墙体的相对量 relTop ≤ 8」——不再与 scrollTop 比较。
 */
import { describe, expect, it } from 'vitest';
import { pickCurrentMonth } from '../../src/diary-wall/ui';

describe('pickCurrentMonth（滚动高亮月份选取）', () => {
  it('滚到 8 月中段：命中最后一个已过线的节头（8 月），不因 scrollTop 增大全量命中', () => {
    // 9 月节头 relTop=100（还在视口下方）不得命中
    const heads = [
      { date: '2026-08-01', relTop: -500 },
      { date: '2026-08-15', relTop: -120 },
      { date: '2026-09-01', relTop: 100 },
    ];
    expect(pickCurrentMonth(heads)).toBe('2026-08');
  });

  it('滚过半程后仍按几何位置高亮（旧实现混用 scrollTop 会恒指最后月份）', () => {
    // 顶部两个月份已滚出（负值），当前停在 10 月
    const heads = [
      { date: '2026-08-01', relTop: -3000 },
      { date: '2026-09-01', relTop: -1500 },
      { date: '2026-10-01', relTop: 3 },
      { date: '2026-11-01', relTop: 900 },
    ];
    expect(pickCurrentMonth(heads)).toBe('2026-10');
  });

  it('全部节头已过线（滚到底）：命中最后月份', () => {
    const heads = [
      { date: '2026-08-01', relTop: -900 },
      { date: '2026-09-01', relTop: -400 },
    ];
    expect(pickCurrentMonth(heads)).toBe('2026-09');
  });

  it('全部未过线（墙顶未滚动）：返回 null，调用方回退首节头', () => {
    const heads = [
      { date: '2026-08-01', relTop: 30 },
      { date: '2026-09-01', relTop: 500 },
    ];
    expect(pickCurrentMonth(heads)).toBeNull();
  });

  it('容差 8px：节头刚过线（relTop=8）即命中，9 不命中', () => {
    expect(pickCurrentMonth([{ date: '2026-08-01', relTop: 8 }])).toBe('2026-08');
    expect(pickCurrentMonth([{ date: '2026-08-01', relTop: 9 }])).toBeNull();
  });
});
