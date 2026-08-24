/**
 * 复习计划监听器测试（ticket 098；ticket 099 修订+追加）：isUnderFolder / 自动加入四态 /
 * 收编确认（取消=什么都不做）/ 删除确认移除/保留 / 改名自动更新 / 移除目录清空其下排除记录
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { isUnderFolder, ReviewWatcher } from '../../src/review/watch';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

describe('isUnderFolder', () => {
  it('恰为目录/子路径命中；兄弟目录/前缀相似不命中；空目录不命中', () => {
    expect(isUnderFolder('我的/复习', '我的/复习')).toBe(true);
    expect(isUnderFolder('我的/复习', '我的/复习/A.md')).toBe(true);
    expect(isUnderFolder('我的/复习', '我的/复习/子/B.md')).toBe(true);
    expect(isUnderFolder('我的/复习', '我的/复习2/A.md')).toBe(false);
    expect(isUnderFolder('我的/复习', '我的/其他/A.md')).toBe(false);
    expect(isUnderFolder('', 'A.md')).toBe(false);
    expect(isUnderFolder('我的/复习/', '我的/复习/A.md')).toBe(true); // 尾斜杠归一
  });
});

describe('ReviewWatcher 自动加入', () => {
  function makeSettings() {
    return { reviewWatchedFolders: [] as string[], reviewExcludedNotes: [] as string[] };
  }

  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    document.body.innerHTML = '';
    setSettingsProvider(() => ({}) as any);
  });

  it('onVaultCreate：监听目录内新建自动加入；非监听/已排除/已在计划跳过', async () => {
    const vault = new MockVault();
    vault.files.set('我的/复习/A.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: '我的/复习/A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 60000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const w = new ReviewWatcher(app, dm);
    const settings = makeSettings();
    settings.reviewWatchedFolders = ['我的/复习'];
    setSettingsProvider(() => settings as any);

    // 监听目录内新建 → 自动加入
    await w.onVaultCreate({ path: '我的/复习/E.md', extension: 'md', basename: 'E' } as any);
    let paths = (await dm.loadItems()).map((i) => i.filePath);
    expect(paths).toContain('我的/复习/E.md');
    // 已在计划 → 跳过
    await w.onVaultCreate({ path: '我的/复习/A.md', extension: 'md', basename: 'A' } as any);
    paths = (await dm.loadItems()).map((i) => i.filePath);
    expect(paths.filter((p) => p === '我的/复习/A.md').length).toBe(1);
    // 非监听目录 → 跳过
    await w.onVaultCreate({ path: 'X.md', extension: 'md', basename: 'X' } as any);
    paths = (await dm.loadItems()).map((i) => i.filePath);
    expect(paths).not.toContain('X.md');
    // 已排除 → 跳过
    settings.reviewExcludedNotes = ['我的/复习/F.md'];
    await w.onVaultCreate({ path: '我的/复习/F.md', extension: 'md', basename: 'F' } as any);
    paths = (await dm.loadItems()).map((i) => i.filePath);
    expect(paths).not.toContain('我的/复习/F.md');
  });

  it('confirmBatchAddForFolder：确认 → 批量加入（报存量数与 toast）返回 true；取消 → 什么都不做返回 false（不写排除）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/复习/A.md', '正文');
    vault.files.set('我的/复习/B.md', '正文');
    vault.files.set('我的/复习/C.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: '我的/复习/A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 60000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const settings = makeSettings();
    settings.reviewWatchedFolders = ['我的/复习'];
    setSettingsProvider(() => settings as any);
    const w = new ReviewWatcher(app, dm);

    // 确认路径：弹窗出现 → 点「加入」→ 批量加入 + 返回 true
    const confirmedP = w.confirmBatchAddForFolder('我的/复习');
    await new Promise((r) => setTimeout(r, 20));
    const popup = document.getElementById('__shared_confirm_popup__')!;
    expect(popup).not.toBeNull();
    expect(popup.textContent).toContain('2 篇'); // A 已在计划 → 候选 B,C
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(await confirmedP).toBe(true);
    const paths = (await dm.loadItems()).map((i) => i.filePath);
    expect(paths).toContain('我的/复习/B.md');
    expect(paths).toContain('我的/复习/C.md');
    // 取消路径：什么都不做（返回 false，不写排除名单）
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify(raw.filter((r: any) => r.filePath !== '我的/复习/B.md' && r.filePath !== '我的/复习/C.md')));
    const w2 = new ReviewWatcher(app, dm);
    const confirmedP2 = w2.confirmBatchAddForFolder('我的/复习');
    await new Promise((r) => setTimeout(r, 20));
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(await confirmedP2).toBe(false);
    expect(settings.reviewExcludedNotes).toEqual([]);
  });

  it('confirmBatchAddForFolder：无存量候选 → 直接接受（true，不弹窗）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/复习/A.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: '我的/复习/A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 60000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    setSettingsProvider(() => ({ reviewWatchedFolders: ['我的/复习'], reviewExcludedNotes: [] } as any));
    const w = new ReviewWatcher(app, dm);
    const confirmed = await w.confirmBatchAddForFolder('我的/复习');
    expect(confirmed).toBe(true);
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
  });

  it('onVaultDelete：确认移除 → 记录删除 + 监听目录内写排除；保留 → 挂起不动', async () => {
    const vault = new MockVault();
    vault.files.set('我的/复习/A.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: '我的/复习/A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const settings = makeSettings();
    settings.reviewWatchedFolders = ['我的/复习'];
    setSettingsProvider(() => settings as any);
    const w = new ReviewWatcher(app, dm);

    // 保留
    w.onVaultDelete({ path: '我的/复习/A.md', extension: 'md', basename: 'A' } as any);
    await new Promise((r) => setTimeout(r, 350));
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect((await dm.loadItems()).some((i) => i.filePath === '我的/复习/A.md')).toBe(true);
    expect(settings.reviewExcludedNotes).toEqual([]);
    // 移除 → 记录删除 + 监听目录内写排除
    w.onVaultDelete({ path: '我的/复习/A.md', extension: 'md', basename: 'A' } as any);
    await new Promise((r) => setTimeout(r, 350));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect((await dm.loadItems()).some((i) => i.filePath === '我的/复习/A.md')).toBe(false);
    expect(settings.reviewExcludedNotes).toContain('我的/复习/A.md');
  }, 10000);

  it('onVaultRename：自动更新路径（ticket 099：无确认弹窗）；计划外改名不操作', async () => {
    const vault = new MockVault();
    vault.files.set('我的/复习/A.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: '我的/复习/A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 60000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const settings = makeSettings();
    settings.reviewWatchedFolders = ['我的/复习'];
    setSettingsProvider(() => settings as any);
    const w = new ReviewWatcher(app, dm);

    // 计划内改名 → 自动更新，无需点击确认
    w.onVaultRename({ path: '我的/复习/A-new.md', extension: 'md', basename: 'A-new' } as any, '我的/复习/A.md');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    const items = await dm.loadItems();
    expect(items.some((i) => i.filePath === '我的/复习/A-new.md')).toBe(true);
    // 移动（跨目录）→ 同样自动跟随
    w.onVaultRename({ path: '归档/A-new.md', extension: 'md', basename: 'A-new' } as any, '我的/复习/A-new.md');
    await new Promise((r) => setTimeout(r, 30));
    const items2 = await dm.loadItems();
    expect(items2.some((i) => i.filePath === '归档/A-new.md')).toBe(true);
    // 不在计划的文件改名 → 不产生任何记录
    w.onVaultRename({ path: 'X-new.md', extension: 'md', basename: 'X-new' } as any, 'X.md');
    await new Promise((r) => setTimeout(r, 30));
    expect((await dm.loadItems()).some((i) => i.filePath === 'X-new.md')).toBe(false);
  });

  it('removeWatchedFolder（ticket 099 追加）：移除目录 + 清空其下排除记录（目录外保留）；返回清理条数', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const settings = makeSettings();
    settings.reviewWatchedFolders = ['我的/复习', '卡片盒'];
    // 目录内两条排除（递归命中子路径）+ 目录外一条排除（须保留）
    settings.reviewExcludedNotes = ['我的/复习/A.md', '我的/复习/子/B.md', '书库/C.md'];
    setSettingsProvider(() => settings as any);
    const w = new ReviewWatcher(app, dm);

    const cleared = await w.removeWatchedFolder('我的/复习');
    expect(cleared).toBe(2);
    expect(settings.reviewWatchedFolders).toEqual(['卡片盒']);
    expect(settings.reviewExcludedNotes).toEqual(['书库/C.md']);
    // 移除不存在的目录 → 幂等，清理 0 条
    const cleared2 = await w.removeWatchedFolder('不存在');
    expect(cleared2).toBe(0);
    expect(settings.reviewWatchedFolders).toEqual(['卡片盒']);
  });
});