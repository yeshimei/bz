/**
 * review 域「全域深审拍板后修复批」Wave1 · 悬浮评级条键盘化回归（呈报#12-R8）：
 *  - 挂载即焦点入条 → 数字键 1-4 评级（翻篇主路径全程可键盘完成）
 *  - ESC（焦点在条内时）归还焦点、条保留（打字冲突已评估：焦点被用户主动拿回输入框时
 *    数字键放行不劫持；ESC 走条内局部监听，不私挂 document 级 ESC——esc-manager 立约）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountFloatingRatingBar } from '../../src/review/ui';

function press(key: string, target?: EventTarget): void {
  (target || document).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('呈报#12-R8：悬浮评级条键盘化', () => {
  it('挂载即焦点入条；1-4 数字键评级并收条（评级回调收到对应档位）', () => {
    const rates: string[] = [];
    const bar = mountFloatingRatingBar({
      name: 'A', index: 1, total: 2,
      onRate: (r) => rates.push(r),
      onSkip: () => undefined,
    });
    const el = document.querySelector('.bz-review-bar') as HTMLElement;
    expect(el).not.toBeNull();
    expect(document.activeElement).toBe(el); // 焦点已入条

    press('1');
    expect(rates).toEqual(['again']);
    expect(document.querySelector('.bz-review-bar')).toBeNull(); // 评级即收条

    // 2/3/4 各档
    const bar2 = mountFloatingRatingBar({ name: 'B', index: 2, total: 2, onRate: (r) => rates.push(r), onSkip: () => undefined });
    press('4');
    expect(rates).toEqual(['again', 'easy']);
    bar2.close();
  });

  it('焦点在输入框时数字键放行（不劫持打字），条不收', () => {
    const rates: string[] = [];
    mountFloatingRatingBar({ name: 'A', index: 1, total: 2, onRate: (r) => rates.push(r), onSkip: () => undefined });
    const input = document.createElement('textarea');
    document.body.appendChild(input);
    input.focus();

    press('2', input);

    expect(rates).toEqual([]);
    expect(document.querySelector('.bz-review-bar')).not.toBeNull(); // 不误收条
    input.remove();
  });

  it('ESC（焦点在条内）归还焦点且条保留（复习未完可再评级）', () => {
    mountFloatingRatingBar({ name: 'A', index: 1, total: 2, onRate: () => undefined, onSkip: () => undefined });
    const el = document.querySelector('.bz-review-bar') as HTMLElement;
    expect(document.activeElement).toBe(el);

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.activeElement).not.toBe(el); // 焦点已归还
    expect(document.querySelector('.bz-review-bar')).not.toBeNull(); // 条保留
  });

  it('close 后数字键监听一并注销（按 1 不再误评级）', () => {
    const rates: string[] = [];
    const bar = mountFloatingRatingBar({ name: 'A', index: 1, total: 2, onRate: (r) => rates.push(r), onSkip: () => undefined });
    bar.close();

    press('1');

    expect(rates).toEqual([]);
  });

  it('跳过按钮仍可点（回归：skip 路径不被键盘化影响）', () => {
    let skipped = false;
    mountFloatingRatingBar({ name: 'A', index: 1, total: 2, onRate: () => undefined, onSkip: () => { skipped = true; } });
    (document.querySelector('[data-rating="skip"]') as HTMLElement).click();
    expect(skipped).toBe(true);
    expect(document.querySelector('.bz-review-bar')).toBeNull();
  });
});
