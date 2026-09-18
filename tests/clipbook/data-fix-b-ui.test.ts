// @vitest-environment jsdom
/**
 * clipbook 批 B 修复回归（孤点接线侧）：index.markAllUnreadRead（孤点授权区 48-73）
 * 用 flowMarkAllRead 返回值构造批量撤销通知——
 * - 通知篇数 = 实际 bumped（新-9：确认框停留窗口内竞态不虚报）；
 * - notifyUndo 撤销回调走 flowUndoMarkAllRead 快照整批恢复（条目态 + stats 双还原）；
 * - bumped=0（窗口内已被「打开即已读」消化）不弹假通知。
 * ui.ts markAllRead 私有函数同构接线，由 flow 层测试（data-fix-b.test.ts）覆盖数据语义。
 * 确认框 mock 成「确定」；通知 spy 断言（delete-retire.test.ts 手法）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../../src/core/flow-dialog', () => ({
  openFlowDialog: vi.fn(async () => 'ok'),
}));
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return {
    ...actual,
    notice: vi.fn(),
    notify: vi.fn(() => ({ setMessage: vi.fn(), setType: vi.fn(), hide: vi.fn() })),
    notifyUndo: vi.fn(),
  };
});
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { markAllUnreadRead, unloadClipbook } from '../../src/clipbook';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { getNewsFilePath } from '../../src/clipbook/news-data';
import { notifyUndo } from '../../src/core/notice';
import { openFlowDialog } from '../../src/core/flow-dialog';

const notifyUndoMock = vi.mocked(notifyUndo);
const openFlowDialogMock = vi.mocked(openFlowDialog);

function seedVault(articles: any[]): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({
    articles,
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

const diskJson = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

const UNREAD = [
  { platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', body: 'b1', date: '2026-09-01 08:00:00' },
  { platform: '知乎日报', title: '乙', url: 'https://zh.com/2', body: 'b2', date: '2026-09-01 09:00:00' },
];

beforeEach(() => {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  notifyUndoMock.mockClear();
  openFlowDialogMock.mockClear();
  openFlowDialogMock.mockResolvedValue('ok');
});

describe('markAllUnreadRead 批量撤销接线（孤点授权区）', () => {
  it('确认后 notifyUndo 通知实际 bumped 数；撤销回调整批恢复条目态与 stats', async () => {
    const vault = seedVault(UNREAD);
    await markAllUnreadRead();
    await drainNewsWritesForTests();
    // 确认框与撤销通知
    expect(openFlowDialogMock).toHaveBeenCalledTimes(1);
    expect(notifyUndoMock).toHaveBeenCalledTimes(1);
    expect(notifyUndoMock.mock.calls[0][0]).toBe('已把 2 篇标为已读');
    // 动作已落盘
    let disk = diskJson(vault);
    expect(disk.articles.every((a: any) => a.read === true)).toBe(true);
    expect(disk.stats.totalRead).toBe(2);
    // 点撤销 → 快照整批恢复
    const onUndo = notifyUndoMock.mock.calls[0][1];
    await onUndo();
    await drainNewsWritesForTests();
    disk = diskJson(vault);
    expect(disk.articles[0].read).toBeUndefined();
    expect(disk.articles[0].state).toBeUndefined();
    expect(disk.articles[0].body).toBe('b1');
    expect(disk.articles[1].read).toBeUndefined();
    expect(disk.stats.totalRead).toBe(0);
    expect(disk.stats.totalSkipped).toBe(0);
    expect(disk.stats.byPlatform['果壳科学人']).toBe(0);
  });

  it('确认框停留窗口内未读被消化（bumped=0）→ 不弹「已把 0 篇」假通知', async () => {
    const vault = seedVault(UNREAD);
    // 模拟窗口竞态：确认框 resolve 前另一写方把全部未读标已读（如「打开即已读」）
    openFlowDialogMock.mockImplementation(async () => {
      const cur = diskJson(vault);
      cur.articles = cur.articles.map((a: any) => ({ ...a, read: true, state: 'skipped' }));
      vault.files.set(getNewsFilePath(), JSON.stringify(cur));
      return 'ok';
    });
    await markAllUnreadRead();
    await drainNewsWritesForTests();
    expect(notifyUndoMock).not.toHaveBeenCalled();
  });
});
