// @vitest-environment node
/**
 * B4（呈报#20）：0 元物品的日均花费显示「￥0.0000」像 bug → 0 元时显示「—」。
 * 拍板口径：单源收 trimDailyNum（shared.ts），卡片层 moneyWith 不给「—」加货币符号。
 * 修复前必红：trimDailyNum(0) === '0.0000'，0 元卡片日均段渲染「￥0.0000」。
 */
import { describe, it, expect } from 'vitest';
import { trimDailyNum, dailyCostOf } from '../../src/belongings/shared';
import { cellHtml } from '../../src/belongings/layouts/poster/render';
import type { BelongingsItem } from '../../src/belongings/types';

/** 0 元在库物品（购入一年整，日均 = 0/365 = 0） */
function zeroPriceItem(): BelongingsItem {
  return {
    id: 'item_zero',
    name: '免费赠品',
    category: '杂项',
    purchase_price: 0,
    purchase_date: '2024-06-01T12:00:00',
    current_status: '使用中',
    description: '',
    created_date: '2024-06-01T10:00:00.000Z',
    last_updated: '2024-06-01T10:00:00.000Z',
  } as BelongingsItem;
}

describe('B4：0 元日均显示「—」（trimDailyNum 单源）', () => {
  it('修复前必红：trimDailyNum(0) 曾渲染 "0.0000"，拍板后为「—」', () => {
    expect(trimDailyNum(0)).toBe('—');
    expect(trimDailyNum(-0)).toBe('—');
    expect(trimDailyNum(Number('NaN'))).toBe('—'); // Number(n)||0 兜底路径同为 0
  });

  it('非零行为不变（<0.01 保四位、去尾零），回归口径不回潮', () => {
    expect(trimDailyNum(0.004)).toBe('0.0040');
    expect(trimDailyNum(12.5)).toBe('12.5');
    expect(trimDailyNum(5)).toBe('5');
  });

  it('0 元物品卡片日均段 = 「日均 —」，不再出现「￥0.0000」', () => {
    const it0 = zeroPriceItem();
    expect(dailyCostOf(it0)).toBe(0);
    const html = cellHtml(it0, 0);
    expect(html).toContain('日均 —');
    expect(html).not.toContain('0.0000');
    expect(html).not.toContain('￥0.0000');
  });

  it('非 0 元物品日均仍带货币符号（moneyWith 路径不受影响）', () => {
    const item = { ...zeroPriceItem(), purchase_price: 36500 } as BelongingsItem;
    const html = cellHtml(item, 0);
    // 日均 = 36500/持有天数 ≈ 43+（远离进位边界）→ moneyWith 前缀保留
    expect(html).toMatch(/日均 ￥[1-9]/);
  });
});
