/**
 * 情绪惯性测试（2026-09-20 ADR-0172）。
 * 缺口③「没有纵向时间」的第一块：原实现每条互动独立结算，一次大怒/大喜几小时就被指数回摆抹平。
 * 钉住：偏离基线越远回摆越慢（U 形，正负同侧）、负面额外更慢（Gross 情绪调节）、
 * 高唤醒额外更慢（交感兴奋滞后）、系数恒 ≤1（只会更慢、绝不加速）、非法输入兜底。
 */
import { describe, it, expect } from 'vitest';
import { MoodSystem } from '../../src/smartcat/mood';

const f = (axis: 'pleasure' | 'arousal' | 'dominance', v: number) => MoodSystem.inertiaFactor(axis, v);

describe('MoodSystem.inertiaFactor', () => {
  it('基线（50）→ 1，不改变既有半衰语义', () => {
    expect(f('pleasure', 50)).toBe(1);
    expect(f('arousal', 50)).toBe(1);
    expect(f('dominance', 50)).toBe(1);
  });

  it('偏离越远回摆越慢（快感 U 形，正负同侧）', () => {
    expect(f('dominance', 50)).toBeGreaterThan(f('dominance', 40));
    expect(f('dominance', 40)).toBeGreaterThan(f('dominance', 20));
    expect(f('dominance', 20)).toBeGreaterThan(f('dominance', 0));
    expect(f('dominance', 60)).toBeGreaterThan(f('dominance', 80));
    expect(f('dominance', 80)).toBeGreaterThan(f('dominance', 100));
  });

  it('愉悦侧：低落（<35）比同等偏离的高兴更粘', () => {
    const low = f('pleasure', 30);   // |Δ|=20 → 0.8，且 <35 → ×0.7
    const high = f('pleasure', 70);  // |Δ|=20 → 0.8，无额外项
    expect(low).toBeCloseTo(0.56, 5);
    expect(high).toBeCloseTo(0.8, 5);
    expect(low).toBeLessThan(high);
  });

  it('高唤醒额外更慢（交感兴奋滞后）', () => {
    expect(f('arousal', 80)).toBeCloseTo(0.56, 5); // 0.7 × 0.8
    expect(f('arousal', 80)).toBeLessThan(f('dominance', 80));
  });

  it('系数恒在 (0,1]：只会更慢，绝不加速衰减', () => {
    for (const axis of ['pleasure', 'arousal', 'dominance'] as const) {
      for (const v of [0, 5, 17, 25, 34, 35, 50, 66, 70, 71, 75, 76, 99, 100]) {
        const x = f(axis, v);
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(x).toBeGreaterThanOrEqual(0.2);
      }
    }
  });

  it('非法输入（NaN/缺省）→ 按中性基线处理', () => {
    expect(f('pleasure', NaN)).toBe(1);
    expect(f('pleasure', undefined as unknown as number)).toBe(1);
  });
});
