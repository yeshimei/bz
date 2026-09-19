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

import { createOverlay, closeOverlay, showOverlay } from '../../src/home/ui';
import { unloadHome } from '../../src/home';
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
    // 失败三态（func P3-1）：时间线列同步出失败位——不再永挂「正在汇入…」假加载文案；
    // 重试入口只在 entries 大卡上一颗（两列同源恢复，不各挂一个）
    const flow = H.currentOverlay!.querySelector('[data-home-flow]') as HTMLElement;
    expect(flow.textContent).toContain('没能汇入');
    expect(flow.textContent).not.toContain('正在汇入');
    // 重试：采集恢复 → 两列一并恢复正常渲染（entries 出入口行、flow 换掉失败位）
    collectRiverMock.mockResolvedValue(makeRiver());
    retry.click();
    await waitFor(() => !!H.currentOverlay!.querySelector('[data-home-entries] .bz-home-erow'));
    expect(H.currentOverlay!.querySelector('[data-home-entries] .bz-empty')).toBeNull();
    expect((H.currentOverlay!.querySelector('[data-home-flow]') as HTMLElement).textContent).not.toContain('没能汇入');
    closeOverlay();
  });

  it('arch A3：unload 后 in-flight 采集不写回（存活守卫）——H.river 保持归零态', async () => {
    let resolveRiver!: (v: RiverData) => void;
    collectRiverMock.mockImplementation(() => new Promise<RiverData>((res) => { resolveRiver = res; }));
    const app = { vault: new MockVault() } as any;
    H.appRef = app;
    createOverlay(app);
    unloadHome(); // 同步卸载：remove + resetHomeState（H 全字段归零）
    resolveRiver(makeRiver()); // in-flight 采集稍后落地
    await tick();
    expect(H.currentOverlay).toBeNull();
    expect(H.river).toBeNull(); // 修复前：脏写回把旧数据填回已清零的 H（重开闪现上一会话渲染）
    expect(H.riverFailed).toBe(false);
  });

  it('arch A3：并发刷新乱序——晚完成的旧一轮不得覆盖新一轮数据（代次守卫）', async () => {
    const app = { vault: new MockVault() } as any;
    H.appRef = app;
    let resolve1!: (v: RiverData) => void;
    let resolve2!: (v: RiverData) => void;
    collectRiverMock.mockImplementationOnce(() => new Promise<RiverData>((res) => { resolve1 = res; }));
    createOverlay(app); // 刷新 #1 采集挂起（showOverlay 入口同源）
    collectRiverMock.mockImplementationOnce(() => new Promise<RiverData>((res) => { resolve2 = res; }));
    closeOverlay();
    showOverlay(); // 刷新 #2（keepHome 动作落地同款并发入口）
    await waitFor(() => collectRiverMock.mock.calls.length >= 2);
    resolve2(makeRiver()); // 新一轮 #2 先落地
    await waitFor(() => H.river !== null);
    const newest = H.river;
    resolve1(makeRiver()); // 旧一轮 #1 晚落地（乱序晚完成者）
    await tick();
    expect(H.river).toBe(newest); // 代次守卫拦截：旧数据不得覆盖新数据
    closeOverlay();
  });

  it('keepHome 行为链：菜单动作 → 不关面板 + busy 提示 + 落地刷新 + 在途防重入；reject 分支出提示', async () => {
    let resolveSync!: () => void;
    let rejectSync: ((e: Error) => void) | null = null;
    const exec = vi.fn((_id: string) => new Promise<void>((res, rej) => {
      resolveSync = res;
      rejectSync = rej;
    }));
    const app = { vault: new MockVault(), commands: { executeCommandById: exec } } as any;
    H.appRef = app;
    createOverlay(app);
    await waitFor(() => !!H.currentOverlay!.querySelector('[data-home-entries] .bz-home-erow'));
    const row = H.currentOverlay!.querySelector('[data-home-go="gameshelf"]') as HTMLElement;
    expect(row).toBeTruthy();
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await waitFor(() => !!document.querySelector('.bz-item-menu'));
    const item = [...document.querySelectorAll('.bz-item-menu button')]
      .find((b) => b.textContent === '立即同步') as HTMLElement;
    expect(item).toBeTruthy();
    clearNotices();
    item.click();
    // 点击瞬间：busy 轻提示（文案单源 DOMAIN_MENU.busyText）+ 面板保留 + 命令已发
    expect(hasNotice(/正在同步游戏库/)).toBe(true);
    expect(H.overlayVisible).toBe(true);
    expect(exec).toHaveBeenCalledTimes(1);
    // 在途重复点击不再重复发命令（eff P3-2 防重入）
    item.click();
    expect(exec).toHaveBeenCalledTimes(1);
    // Promise 落地 → 刷新发生（collectRiver 重采）
    const calls0 = collectRiverMock.mock.calls.length;
    resolveSync();
    await waitFor(() => collectRiverMock.mock.calls.length > calls0);
    // reject 分支（func P3-2 同刀）：不再静默，出人话提示；失败后仍刷新（数据可能部分变化）
    const calls1 = collectRiverMock.mock.calls.length;
    (H.currentOverlay!.querySelector('[data-home-go="gameshelf"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await waitFor(() => !!document.querySelector('.bz-item-menu'));
    const item2 = [...document.querySelectorAll('.bz-item-menu button')]
      .find((b) => b.textContent === '立即同步') as HTMLElement;
    clearNotices();
    item2.click();
    expect(rejectSync).toBeTruthy();
    rejectSync!(new Error('sync boom'));
    await waitFor(() => hasNotice(/动作没有执行成功/));
    await waitFor(() => collectRiverMock.mock.calls.length > calls1);
    closeOverlay();
  });

  it('func P3-2：直达命令（关面板路径）promise reject → 人话通知，不再 unhandled 静默', async () => {
    const app = {
      vault: new MockVault(),
      commands: { executeCommandById: () => Promise.reject(new Error('domain boom')) },
    } as any;
    H.appRef = app;
    createOverlay(app);
    await waitFor(() => !!H.currentOverlay!.querySelector('[data-home-entries] .bz-home-erow'));
    clearNotices();
    (H.currentOverlay!.querySelector('[data-home-go="cinema"]') as HTMLElement).click();
    await tick();
    expect(hasNotice(/暂时不可用/)).toBe(true);
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
    await waitFor(() => hasNotice(/保存失败（入口顺序）/));
    expect(hasNotice(/保存失败（入口顺序）/)).toBe(true);
  });
});
