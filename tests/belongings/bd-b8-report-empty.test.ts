/**
 * B8（呈报#19）：归物本报告段落自绘纯文本空态 → 统一 core uiEmpty 小图标口径。
 * 拍板口径 A「统一小图标版」：与 review 侧 Wave1 落地同款（emptyHtmlStr 与 core uiEmpty
 * 同 markup 单源 bz-empty/bz-empty-ic，图标占位由 mountIcons 兑现）。
 * 覆盖四处自绘形制：空年、月度花销段、分类占比段、陪伴榜段的空态。
 * 修复前必红：空态容器是 .bz-belr-emptyyear / <p class="bz-belr-none">，无 bz-empty 形态。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { openBelReport, closeBelReport, unloadBelReport } from '../../src/belongings/report';import { __resetNoticeForTests } from '../../src/core/notice';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import type { BelongingsItem } from '../../src/belongings/types';

function makeItem(partial: Partial<BelongingsItem>): BelongingsItem {
  return {
    id: 'it',
    name: '物品',
    category: '外设',
    purchase_price: 100,
    purchase_date: '2025-01-01',
    current_status: '使用中',
    description: '',
    created_date: '2025-01-01T00:00:00.000Z',
    last_updated: '2025-01-01T00:00:00.000Z',
    ...partial,
  };
}

const body = () => document.querySelector('[data-belr-body]') as HTMLElement | null;
const emptyHosts = () => [...document.querySelectorAll('.bz-belr-body .bz-empty, [data-belr-body] .bz-empty')] as HTMLElement[];

async function until(cond: () => boolean, timeout = 6000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('until: 条件超时');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('B8：报告空态统一小图标版（bz-empty 口径）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    unloadBelReport();
    setApp({ vault: new MockVault(), workspace: {} } as any);
    setSettingsProvider(() => ({}) as any);
    __resetNoticeForTests();
  });

  it('空年空态：.bz-belr-emptyyear 纯文本退役 → bz-empty 小图标版（人话文案保留）', async () => {
    // 残缺日期年进年份清单但无有效数据 → 空年分支
    openBelReport([
      makeItem({ id: 'good', name: '键盘', purchase_date: '2025-06-01' }),
      makeItem({ id: 'bad', name: '幽灵', purchase_date: '2023-13-01' }),
    ], 'cny');
    await until(() => (body()?.textContent || '').includes('2025 年购入与离场'));
    (document.querySelector('[data-belr-prev]') as HTMLButtonElement)!.click();
    await until(() => (body()?.textContent || '').includes('2023 年没有物品记录'));

    // 修复前必红：空态是 .bz-belr-emptyyear 自绘容器；修复后为 bz-empty + 小图标占位
    expect(body()!.querySelector('.bz-belr-emptyyear')).toBeNull();
    expect(emptyHosts().length).toBeGreaterThanOrEqual(1);
    const empty = emptyHosts()[0];
    expect(empty.querySelector('.bz-empty-ic')).not.toBeNull();
    expect(empty.querySelector('.bz-empty-title')!.textContent).toBe('2023 年没有物品记录');
    expect(empty.querySelector('.bz-empty-desc')!.textContent).toContain('‹ ›');
    closeBelReport();
  });

  it('纯离场年三段空态（月度/分类/陪伴榜）：<p class="bz-belr-none"> 退役 → bz-empty 小图标版', async () => {
    // 2025 = 纯离场年（出离年入清单）；purchase_date 无效 → companions 排除 → 陪伴榜空态
    openBelReport([
      makeItem({ id: 'gone', name: '旧椅', purchase_date: '2023-13-01', current_status: '已丢弃', exit_date: '2025-04-01' }),
    ], 'cny');
    await until(() => (body()?.textContent || '').includes('2025 年购入与离场'));
    await until(() => (body()?.textContent || '').includes('陪伴最久榜'));

    const text = body()!.textContent || '';
    // 人话文案逐字保留（口径不变，只换形制）
    expect(text).toContain('这一年没有购入记录，只有出离');
    expect(text).toContain('当年无购入 · 只有出离记录');
    expect(text).toContain('暂无可统计的物品');
    // 修复前必红：三处空态是 .bz-belr-none 纯文本段；修复后全为 bz-empty 小图标版
    expect(body()!.querySelectorAll('.bz-belr-none').length).toBe(0);
    expect(body()!.querySelectorAll('.bz-empty .bz-empty-ic').length).toBeGreaterThanOrEqual(3);
    closeBelReport();
  });

  it('有数据年份不渲染空态（bz-empty 只出现在空段）', async () => {
    openBelReport([makeItem({ id: 'a', name: '键盘', purchase_date: '2025-06-01' })], 'cny');
    await until(() => (body()?.textContent || '').includes('陪伴最久榜'));
    expect(body()!.querySelectorAll('.bz-empty').length).toBe(0);
    closeBelReport();
  });
});
