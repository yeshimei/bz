/**
 * 复习计划入口测试（覆盖率目标）：ensureReview 幂等/事件监听/命令分支/
 * 快捷标记/卸载清理。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';
import {
  ensureReview, unloadReview, reviewAddCurrent, reviewRemoveCurrent,
  reviewJumpOverdue, reviewMarkDialog, reviewMarkRating, dataManager, uiManager,
} from '../../src/review/index';
import { REVIEW_FILE_PATH, ReviewDataManager } from '../../src/review/data';
import { reviewApp } from '../../src/review/app';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';

function seed(vault: MockVault) {
  const now = new Date();
  vault.files.set('A.md', '正文');
  vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
    {
      id: '1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 1, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    },
  ]));
}

/** 事件收集型 app（metadataCache/vault/workspace 均可注册与触发） */
function makeApp(vault: MockVault) {
  const app: any = mockAppWithVault(vault);
  setApp(app);
  const meta: Record<string, Function[]> = {};
  const ws: Record<string, Function[]> = {};
  app.metadataCache.on = (ev: string, cb: any) => { (meta[ev] ||= []).push(cb); return { ref: 'm' }; };
  app.workspace.on = (ev: string, cb: any) => { (ws[ev] ||= []).push(cb); return { ref: 'w' }; };
  app.metaListeners = meta;
  app.wsListeners = ws;
  app.emitMeta = (ev: string, ...args: any[]) => { for (const cb of meta[ev] || []) void cb(...args); };
  app.emitWs = (ev: string, ...args: any[]) => { for (const cb of ws[ev] || []) void cb(...args); };
  return app;
}

const activeFile = { path: 'A.md', extension: 'md', basename: 'A' };

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  unloadReview();
});

describe('ensureReview', () => {
  it('幂等初始化 + 2s 后首次逾期检查 + 60s 周期', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    const spy = vi.spyOn(reviewApp, 'checkOverdueAndNotify').mockResolvedValue(undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    ensureReview(app);
    ensureReview(app); // 幂等：不重复初始化
    await vi.advanceTimersByTimeAsync(2100);
    expect(spy).toHaveBeenCalled();
    vi.useRealTimers();
    unloadReview();
  }, 10000);

  it('metadataCache resolved → applyReviewStyles', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    const spy = vi.spyOn(reviewApp, 'applyReviewStyles').mockResolvedValue(undefined);
    ensureReview(app);
    app.emitMeta('resolved');
    await new Promise((r) => setTimeout(r, 20));
    expect(spy).toHaveBeenCalled();
  });

  it('vault modify（md 文件）→ applyReviewStyles', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    const spy = vi.spyOn(reviewApp, 'applyReviewStyles').mockResolvedValue(undefined);
    ensureReview(app);
    vault.emit('modify', vault.file('A.md'));
    await new Promise((r) => setTimeout(r, 20));
    expect(spy).toHaveBeenCalled();
  });

  it('vault rename：非 md 忽略；同路径忽略；命中计划 → 自动更新路径（ticket 099：无确认弹窗）', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    ensureReview(app);
    const updSpy = vi.spyOn(dataManager!, 'updateFilePath').mockResolvedValue(true);
    const refreshSpy = vi.spyOn(uiManager!, 'refreshPanel').mockResolvedValue(undefined);
    // 非 md
    vault.emit('rename', { path: 'x.png', extension: 'png', basename: 'x' }, 'x.png');
    expect(updSpy).not.toHaveBeenCalled();
    // 同路径
    vault.emit('rename', vault.file('A.md'), 'A.md');
    expect(updSpy).not.toHaveBeenCalled();
    // 命中计划 → 直接自动更新 + refresh（无确认弹窗）
    vault.emit('rename', { path: 'A-new.md', extension: 'md', basename: 'A-new' }, 'A.md');
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    expect(updSpy).toHaveBeenCalledWith('A.md', 'A-new.md', 'A-new');
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('workspace quit → 清理周期定时器', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    ensureReview(app);
    await vi.advanceTimersByTimeAsync(2100); // 让 setInterval 注册
    app.emitWs('quit');
    expect(clearSpy).toHaveBeenCalled();
    vi.useRealTimers();
    unloadReview();
  }, 10000);
});

describe('命令分支', () => {
  it('reviewAddCurrent：无活动文件 → 「请先打开一个笔记」', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    await reviewAddCurrent(app);
    expect(hasNotice('请先打开一个笔记')).toBe(true);
  });

  it('reviewRemoveCurrent：无文件/不在计划 → Notice', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    await reviewRemoveCurrent(app);
    expect(hasNotice('请先打开一个笔记')).toBe(true);
    clearNotices();
    app.workspace.getActiveFile = () => ({ path: 'C.md', extension: 'md', basename: 'C' });
    await reviewRemoveCurrent(app);
    expect(hasNotice('该笔记不在复习计划中')).toBe(true);
  });

  it('reviewMarkDialog：不在计划/completed → Notice；正常 → 难度弹窗', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    app.workspace.getActiveFile = () => ({ path: 'C.md', extension: 'md', basename: 'C' });
    await reviewMarkDialog(app);
    expect(hasNotice('该笔记不在复习计划中')).toBe(true);

    clearNotices();
    app.workspace.getActiveFile = () => activeFile;
    const showSpy = vi.spyOn(uiManager!, 'showDifficultyDialog').mockImplementation(() => {});
    await reviewMarkDialog(app);
    expect(showSpy).toHaveBeenCalled();
  });

  it('reviewMarkRating：无文件/不在计划/completed/正常', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    await reviewMarkRating(app, 'good');
    expect(hasNotice('请先打开一个笔记')).toBe(true);

    clearNotices();
    app.workspace.getActiveFile = () => ({ path: 'C.md', extension: 'md', basename: 'C' });
    await reviewMarkRating(app, 'good');
    expect(hasNotice('该笔记不在复习计划中')).toBe(true);

    clearNotices();
    app.workspace.getActiveFile = () => activeFile;
    const markSpy = vi.spyOn(reviewApp, 'markReview').mockResolvedValue(undefined);
    const styleSpy = vi.spyOn(reviewApp, 'applyReviewStyles').mockResolvedValue(undefined);
    await reviewMarkRating(app, 'good');
    expect(markSpy).toHaveBeenCalledWith('A.md', 'good');
    expect(styleSpy).toHaveBeenCalled();
  });

  it('reviewJumpOverdue：调用 autoJumpOverdue', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    const spy = vi.spyOn(reviewApp, 'autoJumpOverdue').mockResolvedValue(undefined);
    await reviewJumpOverdue(app);
    expect(spy).toHaveBeenCalled();
  });
});

describe('unloadReview', () => {
  it('清理引用与定时器', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    ensureReview(app);
    await vi.advanceTimersByTimeAsync(2100);
    vi.useRealTimers();
    unloadReview();
    expect(dataManager).toBeNull();
    expect(uiManager).toBeNull();
  }, 10000);
});
describe('ticket 098：监听文件夹事件（create/delete）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    unloadReview();
    setSettingsProvider(() => ({} as any));
  });

  it('vault create：非监听跳过；监听目录内新建自动加入；已排除/已在计划跳过', async () => {
    const vault = new MockVault();
    seed(vault); // A.md 在计划
    const app = makeApp(vault);
    ensureReview(app);
    // 非监听目录
    vault.emit('create', { path: 'X.md', extension: 'md', basename: 'X' });
    await new Promise((r) => setTimeout(r, 30));
    let items = await new ReviewDataManager(app).loadItems();
    expect(items.map((i) => i.filePath)).not.toContain('X.md');
    // 监听目录内新建 → 自动加入
    const settings = { reviewWatchedFolders: ['我的/复习'], reviewExcludedNotes: [] as string[] };
    setSettingsProvider(() => settings as any);
    vault.emit('create', { path: '我的/复习/Y.md', extension: 'md', basename: 'Y' });
    await new Promise((r) => setTimeout(r, 30));
    items = await new ReviewDataManager(app).loadItems();
    expect(items.map((i) => i.filePath)).toContain('我的/复习/Y.md');
    // 已排除 → 不加入
    settings.reviewExcludedNotes = ['我的/复习/Z.md'];
    vault.emit('create', { path: '我的/复习/Z.md', extension: 'md', basename: 'Z' });
    await new Promise((r) => setTimeout(r, 30));
    items = await new ReviewDataManager(app).loadItems();
    expect(items.map((i) => i.filePath)).not.toContain('我的/复习/Z.md');
    unloadReview();
  });

  it('vault delete：计划内文件删除 → 确认弹窗；点「移除」→ 记录删除；点「保留」→ 挂起保留', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    ensureReview(app);
    vault.emit('delete', { path: 'A.md', extension: 'md', basename: 'A' });
    await new Promise((r) => setTimeout(r, 350)); // 防抖 300ms
    const popup = document.getElementById('__shared_confirm_popup__')!;
    expect(popup).not.toBeNull();
    expect(popup.textContent).toContain('删除');
    // 保留
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    let items = await new ReviewDataManager(app).loadItems();
    expect(items.some((i) => i.filePath === 'A.md')).toBe(true);
    // 再次删除 → 移除
    vault.emit('delete', { path: 'A.md', extension: 'md', basename: 'A' });
    await new Promise((r) => setTimeout(r, 350));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    items = await new ReviewDataManager(app).loadItems();
    expect(items.some((i) => i.filePath === 'A.md')).toBe(false);
    unloadReview();
  }, 10000);
});