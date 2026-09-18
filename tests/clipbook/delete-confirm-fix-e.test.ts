// @vitest-environment jsdom
/**
 * 剪藏本（clipbook）· 删除免确认口径可翻转钉死（review-deep clipbook-consistency 条目 2）
 *
 * 【可配置期望约定】（写明以防无意识漂移，勿删用例）：
 * 开关 DELETE_WITHOUT_CONFIRM 钉死的是本批基线（master @ 92dba387，批 E 零源码改动）的「现状行为」。
 * 对应并行修复批：
 *   - DELETE_WITHOUT_CONFIRM → 批 C（删除免确认 / 焦点 / 错误态，consistency #2）：
 *     两路删除（剪藏笔记 deleteClipNote / 收件流条目 deleteNewsItem）接了 notifyUndo 即不再走
 *     openFlowDialog 二次确认（core/notice.ts 效率整改 5 定稿；memo/favorites/belongings 已落地，
 *     clipbook 是四域中唯一滞后者），落盘成功后直达 notifyUndo。
 * 并行修复合并进 master 后，主线程把开关翻 true 即断言翻转为「必须」语义
 * （免确认直达成为契约）；开关值必须始终与被钉死的可观测行为一致。
 * 参考先例：tests/memo/flip-switches-fix-e.test.ts、tests/clipbook/delete-retire.test.ts。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { deleteClipNote } from '../../src/clipbook/ui';
import { getNewsFilePath } from '../../src/clipbook/news-data';

/** 【期望配置】见文件头「可配置期望约定」：现状 false（钉旧基线行为），批 C 合并后翻转 */
const DELETE_WITHOUT_CONFIRM = true; // 批 C 已合并：删除免确认直达撤销

vi.mock('../../src/core/flow-dialog', () => ({
  openFlowDialog: vi.fn(async () => 'ok'), // 现状确认流自动「确定」；翻转分支断言其根本不被调
}));
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return { ...actual, notice: vi.fn(), notifyUndo: vi.fn() };
});
vi.mock('../../src/knowledge', () => ({
  openKnowledgeAddTask: vi.fn(),
  upgradeNoteSourceInternal: vi.fn(),
  retireKnowledgeSourcesForClip: vi.fn(),
}));

import { openFlowDialog } from '../../src/core/flow-dialog';
import { notifyUndo } from '../../src/core/notice';

const CLIP_PATH = '归档/网页剪藏/待删剪藏.md';
const CLIP_NOTE = '---\nurl: "https://gk.com/del-1"\ncreated: 2026-08-20 10:00:00\n---\n待删正文。';

function seedVault(articles: any[]): MockVault {
  const vault = new MockVault();
  vault.files.set(
    getNewsFilePath(),
    JSON.stringify({
      articles,
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true }, rssFeeds: [], lastFetchAt: 0, fetchIntervalMin: 30,
    })
  );
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

beforeEach(() => {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  vi.mocked(openFlowDialog).mockClear();
  vi.mocked(notifyUndo).mockClear();
  document.body.innerHTML = '';
});

describe('删除免确认口径（开关 DELETE_WITHOUT_CONFIRM，批 C / consistency #2）', () => {
  it('deleteClipNote（剪藏笔记删除）：现状弹 openFlowDialog 确认；修复后直达 notifyUndo', async () => {
    const vault = seedVault([]);
    vault.files.set(CLIP_PATH, CLIP_NOTE);
    const article = {
      id: 'clip:' + CLIP_PATH,
      origin: 'clip',
      title: '待删剪藏',
      url: 'https://gk.com/del-1',
      notePath: CLIP_PATH,
      note: { path: CLIP_PATH, file: vault.file(CLIP_PATH) },
      st: 'saved',
    } as any;

    await deleteClipNote(article);

    // 两态共同面：删除确实发生 + 撤销兜底在位
    expect(vault.trashed.some((t) => t.path === CLIP_PATH && t.system)).toBe(true);
    expect(notifyUndo).toHaveBeenCalledWith('已删除剪藏「待删剪藏」（已移入系统回收站）', expect.any(Function));

    if (DELETE_WITHOUT_CONFIRM) {
      expect(openFlowDialog, '【必须】接了 notifyUndo 的删除不再二次确认（效率整改 5）').not.toHaveBeenCalled();
    } else {
      // 现状（钉死）：确认框先弹（标题「删除剪藏」，文案自许「可在通知中撤销」——双保险多一次打断）
      expect(openFlowDialog).toHaveBeenCalledTimes(1);
      expect(vi.mocked(openFlowDialog).mock.calls[0][0]).toMatchObject({ title: '删除剪藏' });
    }
  });

  it('deleteNewsItem（收件流条目删除，条目菜单入口）：现状弹确认；修复后直达 notifyUndo', async () => {
    const vault = seedVault([
      { platform: '果壳科学人', title: '待删条目', url: 'https://gk.com/del-item', author: '果壳', date: '2026-09-01 08:00:00', body: 'b' },
    ]);
    const app = getApp();
    openClipbook(app);
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(1));

    // 右键 → 条目菜单 → 「删除」
    (document.querySelector('.bz-clip-item') as HTMLElement).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
    );
    const menu = await vi.waitFor(() => {
      const m = document.querySelector('.bz-item-menu') as HTMLElement | null;
      expect(m).toBeTruthy();
      return m!;
    });
    const delBtn = ([...menu.querySelectorAll('button')] as HTMLElement[]).find((b) => (b.textContent || '').includes('删除'));
    expect(delBtn).toBeTruthy();
    delBtn!.click();

    // 删除确实落盘 + 撤销兜底在位（两态共同面）
    await vi.waitFor(() => {
      const disk = JSON.parse(vault.files.get(getNewsFilePath())!);
      expect(disk.articles).toHaveLength(0);
    });
    await vi.waitFor(() => expect(notifyUndo).toHaveBeenCalledWith('已删除条目「待删条目」', expect.any(Function)));

    if (DELETE_WITHOUT_CONFIRM) {
      expect(openFlowDialog, '【必须】条目删除免确认直达撤销').not.toHaveBeenCalled();
    } else {
      // 现状（钉死）：先弹「删除条目」确认框
      expect(openFlowDialog).toHaveBeenCalledTimes(1);
      expect(vi.mocked(openFlowDialog).mock.calls[0][0]).toMatchObject({ title: '删除条目' });
    }
  });
});
