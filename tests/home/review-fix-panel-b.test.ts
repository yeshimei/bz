/**
 * 内容首页 review 面板组回归（review-all-bugs.md H11-H13）：
 * H11 预告卡连击不再 +1（diaryStreak 已含今天） / H12 collectRiver 失败出「失败+重试」空态
 * （不再永挂加载骨架） / H13 入口顺序落盘失败出提示（不再静默回弹）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { H, resetHomeState } from '../../src/home/state';
import { EMPTY_COUNTS, EMPTY_SUMMARY } from '../../src/home/shared';
import { buildPreviews } from '../../src/home/shared';
import type { RiverData } from '../../src/home/river';

/** collectRiver mock（H12）：默认 reject，测试内改实现控制成败 */
const collectRiverMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/home/river', () => ({
  collectRiver: (...args: unknown[]) => collectRiverMock(...args),
}));

/** 入口顺序落盘 mock（H13）：saveHomeConfig 可编程 reject；loadHomeOrder 回默认 */
const orderMock = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn() }));
vi.mock('../../src/home/order', () => ({
  saveHomeConfig: (...args: unknown[]) => orderMock.save(...args),
  loadHomeOrder: (...args: unknown[]) => orderMock.load(...args),
}));

import { createOverlay, closeOverlay } from '../../src/home/ui';
import { mountHomeEntryEditor } from '../../src/home/entry-editor';

/** 最小合法 RiverData（today/yesterday/days(7)/week/streak/counts） */
function makeRiver(): RiverData {
  const day = (dateStr: string) => ({ dateStr, events: [], summary: { ...EMPTY_SUMMARY }, firstTs: null });
  const days = Array.from({ length: 7 }, (_, i) => day(`2025-06-1${i}`));
  const week = days.map((d, i) => ({ dateStr: d.dateStr, label: d.dateStr.slice(5), dayOfMonth: 10 + i, weekday: '一', hit: false }));
  return {
    today: days[0], yesterday: days[1], days, week,
    streak: { diaryStreak: 0, diaryWrittenToday: false },
    counts: { ...EMPTY_COUNTS },
    pomodoroFocusing: false,
  };
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn: () => boolean, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (fn()) return;
    await tick(30);
  }
  throw new Error('waitFor 超时');
}

describe('内容首页 review 回归（H11-H13）', () => {
  beforeEach(() => {
    resetHomeState();
    resetObsidianMocks();
    document.body.innerHTML = '';
    clearNotices();
    setApp({ vault: new MockVault() } as any);
    setSettingsProvider(() => ({}) as any);
    orderMock.load.mockResolvedValue(null);
    orderMock.save.mockResolvedValue(undefined);
    collectRiverMock.mockResolvedValue(makeRiver());
  });

  it('H11：今天已写日记的预告卡连击不 +1（diaryStreak 已含今天，同未写分支口径）', () => {
    const river = makeRiver();
    river.streak = { diaryStreak: 3, diaryWrittenToday: true };
    const cards = buildPreviews(river);
    const diary = cards.find((c) => c.h.includes('今日日记已写'));
    expect(diary?.h).toBe('今日日记已写 · 连击 ×3'); // 修复前恒显示 ×4
    // 未写分支不受影响
    river.streak = { diaryStreak: 3, diaryWrittenToday: false };
    const cards2 = buildPreviews(river);
    expect(cards2.find((c) => c.h.includes('日记连击'))?.h).toBe('日记连击 ×3 待续');
  });

  it('H12：collectRiver 聚合失败 → 「失败 + 重试」空态（修复前永挂加载骨架）；重试成功恢复渲染', async () => {
    collectRiverMock.mockRejectedValue(new Error('aggregate boom'));
    const app = { vault: new MockVault() } as any;
    H.appRef = app; // index.ts openHome 同款接线（refreshRiverAndRender 的守卫前提）
    createOverlay(app);
    await waitFor(() => !!H.currentOverlay!.querySelector('.bz-empty'));
    const entries = H.currentOverlay!.querySelector('[data-home-entries]') as HTMLElement;
    expect(entries.querySelector('.bz-empty-title')?.textContent).toContain('采集失败');
    const retry = [...entries.querySelectorAll('button')].find((b) => b.textContent === '重试') as HTMLElement;
    expect(retry).toBeTruthy();
    // 重试：采集恢复 → 正常渲染入口行
    collectRiverMock.mockResolvedValue(makeRiver());
    retry.click();
    await waitFor(() => !!H.currentOverlay!.querySelector('[data-home-entries] .bz-home-erow'));
    expect(H.currentOverlay!.querySelector('[data-home-entries] .bz-empty')).toBeNull();
    closeOverlay();
  });

  it('H13：入口顺序落盘失败 → 出提示（修复前 .catch(() => undefined) 静默回弹）', async () => {
    orderMock.load.mockResolvedValue({ version: 3, desk: [], mob: [], hiddenDesk: [], hiddenMob: [] });
    orderMock.save.mockRejectedValue(new Error('disk full'));
    const body = document.createElement('div');
    document.body.appendChild(body);
    mountHomeEntryEditor(body, { vault: new MockVault() } as any);
    // 等 order 加载 + 列表渲染出移除钮
    await waitFor(() => !!body.querySelector('[data-ent-remove]'));
    clearNotices();
    (body.querySelector('[data-ent-remove]') as HTMLElement).click();
    await waitFor(() => hasNotice(/入口顺序保存失败/));
    expect(hasNotice(/入口顺序保存失败/)).toBe(true);
  });
});
