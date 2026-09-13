/**
 * 双把手范围条测试（src/knowledge/range-bar.ts，ADR-0133）：
 * set 钳制与最小间隔、键盘 ←/→（Shift ±10）、pointer 拖拽（位置换算）、disabled 态、onChange 语义。
 */
import { describe, it, expect, vi } from 'vitest';
import { RangeBar } from '../../src/knowledge/range-bar';

/** 读把手当前值（aria-valuenow） */
function vals(bar: RangeBar): [number, number] {
  const hs = bar.el.querySelector('.bz-lit-rb-hs') as HTMLElement;
  const he = bar.el.querySelector('.bz-lit-rb-he') as HTMLElement;
  return [Number(hs.getAttribute('aria-valuenow')), Number(he.getAttribute('aria-valuenow'))];
}

/** jsdom 无 PointerEvent 构造时的通用替身（挂 clientX/button/pointerId 的最小事件） */
function pointer(type: string, clientX: number): Event {
  const e = new Event(type, { bubbles: true }) as any;
  e.clientX = clientX;
  e.pointerId = 1;
  e.button = 0;
  return e;
}

describe('RangeBar（ADR-0133 双把手范围条）', () => {
  it('set：钳制到量程 + 反向/等值钳到最小间隔 1 秒；只重绘不回调', () => {
    const onChange = vi.fn();
    const bar = new RangeBar({ onChange });
    bar.set(300, -10, 999);
    expect(vals(bar)).toEqual([0, 300]);
    bar.set(300, 100, 100);
    expect(vals(bar)).toEqual([100, 101]);
    bar.set(300, 200, 100);
    expect(vals(bar)).toEqual([200, 201]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('量程 < 2 秒 → is-disabled 且拖拽/键盘不响应', () => {
    const onChange = vi.fn();
    const bar = new RangeBar({ onChange });
    bar.set(1, 0, 1);
    expect(bar.el.classList.contains('is-disabled')).toBe(true);
    const hs = bar.el.querySelector('.bz-lit-rb-hs') as HTMLElement;
    hs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    hs.dispatchEvent(pointer('pointerdown', 0));
    hs.dispatchEvent(pointer('pointermove', 10));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('键盘：←/→ ±1 秒、Shift ±10 秒；边界截断；每步回调一次', () => {
    const onChange = vi.fn();
    const bar = new RangeBar({ onChange });
    bar.set(100, 10, 20);
    const hs = bar.el.querySelector('.bz-lit-rb-hs') as HTMLElement;
    hs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(vals(bar)).toEqual([11, 20]);
    hs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
    expect(vals(bar)).toEqual([1, 20]);
    hs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
    expect(vals(bar)).toEqual([0, 20]);
    expect(onChange).toHaveBeenCalledTimes(3);
    // start 不能追上 end（最小间隔 1 秒）
    bar.set(100, 19, 20);
    hs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(vals(bar)).toEqual([19, 20]);
  });

  it('拖拽：位置换算为秒（mock 轨道 rect），松手后解绑不再响应', () => {
    const onChange = vi.fn();
    const bar = new RangeBar({ onChange });
    bar.set(200, 0, 200);
    const track = bar.el.querySelector('.bz-lit-rb-track') as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 6, right: 200, bottom: 6, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const hs = bar.el.querySelector('.bz-lit-rb-hs') as HTMLElement;
    const he = bar.el.querySelector('.bz-lit-rb-he') as HTMLElement;
    hs.dispatchEvent(pointer('pointerdown', 0));
    hs.dispatchEvent(pointer('pointermove', 50)); // 50/200 * 200s = 50s
    expect(vals(bar)).toEqual([50, 200]);
    hs.dispatchEvent(pointer('pointerup', 50));
    hs.dispatchEvent(pointer('pointermove', 100));
    expect(vals(bar)).toEqual([50, 200]); // 松手后不再响应
    // 末端把手
    he.dispatchEvent(pointer('pointerdown', 200));
    he.dispatchEvent(pointer('pointermove', 120)); // 120s
    expect(vals(bar)).toEqual([50, 120]);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
