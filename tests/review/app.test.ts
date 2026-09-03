/**
 * 复习计划核心逻辑测试（ticket 16 修正版）：markReview 阶梯/FSRS/未到期/autoJumpOverdue
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { reviewApp } from '../../src/review/app';
import { ReviewDataManager, REVIEW_FILE_PATH, ReviewItem } from '../../src/review/data';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

/** 预置一条逾期复习数据 */
async function seedOverdue(vault: MockVault, partial: Partial<ReviewItem> = {}) {
  const now = new Date();
  vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
    {
      id: 'x', filePath: 'A.md', name: 'A',
      reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3,
      reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
      ...partial,
    },
  ]));
  return now;
}

describe('markReview 阶梯分支', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({}) as any);
    (reviewApp as any).dataManager = null; // 重置单例（跨测试污染）
  });

  it('again→stage-1（clamp 0）；hard 不变；good+1；easy+2（clamp 9）；ISO 时间落盘', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 3 });
    const app = makeApp(vault);
    setApp(app);

    // 每次复习前重置种子（避免未到期拦截）
    await reviewApp.markReview('A.md', 'again');
    let items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(2);
    expect(items[0].phase).toBe('ladder');
    expect(typeof items[0].nextReviewDate).toBe('string');
    expect(typeof items[0].lastReviewed).toBe('string');
    expect(items[0].reviewHistory[0]).toMatchObject({ rating: 'again', stage: 3 });
    expect(typeof items[0].reviewHistory[0].timestamp).toBe('string');

    await seedOverdue(vault, { stage: 3 });
    await reviewApp.markReview('A.md', 'hard');
    items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(3);

    await seedOverdue(vault, { stage: 3 });
    await reviewApp.markReview('A.md', 'good');
    items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(4);
  });

  it('easy 从 stage 8 → clamp 9 进入 fsrs：stability=initS、difficulty、Notice 文案', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 8 });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'easy');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(9);
    expect(items[0].phase).toBe('fsrs');
    expect(items[0].stability).toBe(5.8); // initS('easy')
    expect(items[0].difficulty).toBe(0.3);
    // 进入 fsrs 的 nextReviewDate = 阶梯 interval[9] = 120 天（源码语义）
    const diffDays = (new Date(items[0].nextReviewDate!).getTime() - new Date(items[0].reviewStart).getTime()) / 86400000;
    expect(diffDays).toBeCloseTo(120, 5);
  });

  it('again 从阶梯不可达 fsrs（9-1=8 仍阶梯）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 9 });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'again');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(8);
    expect(items[0].phase).toBe('ladder');
  });

  it('未到期 → ceil 分钟 Notice 且不推进', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    await seedOverdue(vault, { stage: 2, nextReviewDate: new Date(now.getTime() + 10 * 60000 + 30000).toISOString() });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(2); // 未变
  });

  it('P1 回归：R 阈值提前逾期（未到 nextReviewDate 但 R<阈值）→ 放行评级写盘刷新排期', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    // R(t=10, S=1) ≈ 0.106 < 0.9：dueItems 判提前逾期；但 nextReviewDate 在 5 天后（未到期守卫原会拦截）
    const futureNext = new Date(now.getTime() + 5 * 86400e3).toISOString();
    await seedOverdue(vault, {
      stage: 12, phase: 'fsrs', stability: 1, difficulty: 0.3,
      lastReviewed: new Date(now.getTime() - 10 * 86400e3).toISOString(),
      nextReviewDate: futureNext,
    });
    const app = makeApp(vault);
    setApp(app);
    expect(reviewApp.dueItems(await new ReviewDataManager(app).loadItems()).map((i) => i.filePath)).toContain('A.md');
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].totalReviews).toBe(1); // 写盘成功
    expect(items[0].nextReviewDate).not.toBe(futureNext); // 排期刷新
    expect(items[0].reviewHistory).toHaveLength(1);
    // 通过（good）+ autoPending → 不挂待重做
    expect(items[0].pendingRedo).toBeFalsy();
  });

  it('P1 回归：R 阈值提前逾期 + 答错（again）+ autoPending → 挂待重做', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    await seedOverdue(vault, {
      stage: 12, phase: 'fsrs', stability: 1, difficulty: 0.3,
      lastReviewed: new Date(now.getTime() - 10 * 86400e3).toISOString(),
      nextReviewDate: new Date(now.getTime() + 5 * 86400e3).toISOString(),
    });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'again', { autoPending: true });
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].pendingRedo).toBe(true); // 未通过 → 待重做（原被守卫整体拒掉）
    expect(items[0].totalReviews).toBe(1);
  });

  it('P1 回归：未提前逾期（R≥阈值）→ 未到期拦截维持，不写盘', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    // R(t=1, S=100) ≈ 0.99 ≥ 0.9：不满足放行 → 拦截
    const futureNext = new Date(now.getTime() + 5 * 86400e3).toISOString();
    await seedOverdue(vault, {
      stage: 12, phase: 'fsrs', stability: 100, difficulty: 0.3,
      lastReviewed: new Date(now.getTime() - 1 * 86400e3).toISOString(),
      nextReviewDate: futureNext,
    });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].totalReviews).toBe(0); // 未写盘
    expect(items[0].nextReviewDate).toBe(futureNext);
  });

  it('completed 条目 → 该笔记已完成全部复习', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { completed: true });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(0); // 未变
  });
});

describe('markReview FSRS 分支', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({}) as any);
    (reviewApp as any).dataManager = null;
  });

  it('stage 不递增（源码语义）；S/D 舍入；history stage=currentStage+1', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    await seedOverdue(vault, {
      stage: 12, phase: 'fsrs', stability: 5, difficulty: 0.3,
      lastReviewed: new Date(now.getTime() - 3 * 86400000).toISOString(),
    });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(12); // FSRS 分支不递增 stage
    expect(items[0].totalReviews).toBe(1);
    expect(items[0].reviewHistory[0]).toMatchObject({ rating: 'good', stage: 13 });
    expect(typeof items[0].reviewHistory[0].R).toBe('number');
    expect(items[0].nextReviewDate).toBeTruthy();
  });

  it('again → stability 显著降低', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    await seedOverdue(vault, {
      stage: 15, phase: 'fsrs', stability: 0.4, difficulty: 0.3,
      lastReviewed: new Date(now.getTime() - 86400000).toISOString(),
    });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'again');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stability).toBeLessThan(1);
  });
});





describe('applyReviewStyles', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({}) as any);
    (reviewApp as any).dataManager = null;
    (reviewApp as any)._styledPaths = new Set(); // ticket 48：曾染色集合逐用例隔离
  });

  it('data-path 选择器 + 时间徽标（d/h/m）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 2, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 5 * 3600000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    // 文件树 DOM（源码选择器）
    const treeItem = document.createElement('div');
    treeItem.setAttribute('data-path', 'A.md');
    const inner = document.createElement('div');
    inner.className = 'tree-item-inner';
    treeItem.appendChild(inner);
    document.body.appendChild(treeItem);

    const app = makeApp(vault);
    setApp(app);
    await reviewApp.applyReviewStyles(app, vault.file('A.md') as any);
    expect(inner.style.color).toBe('rgb(24, 144, 255)'); // stage<=2 #1890ff
    const badge = inner.querySelector('.review-stage-badge');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toMatch(/^\d+[dhm]$/); // 时间文本
  });

  it('completed → ✅ + #52c41a', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: now.toISOString(), lastReviewed: null, lastDifficulty: null, completed: true },
    ]));
    const treeItem = document.createElement('div');
    treeItem.setAttribute('data-path', 'A.md');
    const inner = document.createElement('div');
    inner.className = 'tree-item-inner';
    treeItem.appendChild(inner);
    document.body.appendChild(treeItem);

    const app = makeApp(vault);
    setApp(app);
    await reviewApp.applyReviewStyles(app, vault.file('A.md') as any);
    expect(inner.style.color).toBe('rgb(82, 196, 26)'); // #52c41a
    expect(inner.querySelector('.review-stage-badge')!.textContent).toBe('✅');
  });

  it('ticket 100：文件树标记关闭 → 不染色不挂徽章', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 2, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 5 * 3600000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const treeItem = document.createElement('div');
    treeItem.setAttribute('data-path', 'A.md');
    const inner = document.createElement('div');
    inner.className = 'tree-item-inner';
    treeItem.appendChild(inner);
    document.body.appendChild(treeItem);
    setSettingsProvider(() => ({ reviewTreeBadge: false } as any));
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.applyReviewStyles(app, vault.file('A.md') as any);
    expect(inner.style.color).toBe('');
    expect(inner.querySelector('.review-stage-badge')).toBeNull();
  });

  it('ticket 48：changedFile 单文件路径——非条目节点不被触碰（他方颜色保持）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文'); // 非复习条目
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([]));
    const treeItem = document.createElement('div');
    treeItem.setAttribute('data-path', 'A.md');
    const inner = document.createElement('div');
    inner.className = 'tree-item-inner';
    treeItem.appendChild(inner);
    document.body.appendChild(treeItem);
    inner.style.color = '#1890ff'; // 模拟他方设置的颜色
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.applyReviewStyles(app, vault.file('A.md') as any);
    expect(inner.style.color).toBe('rgb(24, 144, 255)'); // 未被重置
    expect(inner.querySelector('.review-stage-badge')).toBeNull();
  });

  

  

  
});

describe('ticket 100：到期提醒 / 每日上限 / 间隔缩放', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    (reviewApp as any).dataManager = null;
    (reviewApp as any)._notifiedOverdue = new Set();
    (reviewApp as any)._overdueNotice = null;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    (reviewApp as any)._notifiedOverdue = new Set();
    (reviewApp as any)._overdueNotice = null;
  });

  function seedOverdueWith(vault: MockVault, paths: string[]) {
    const now = new Date();
    const rows = paths.map((p, i) => ({
      id: String(i), filePath: p, reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1,
      difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    }));
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify(rows));
  }

  it('到期提醒：新增逾期弹篇数常驻通知；再次检查不重复弹；移出逾期后再逾期重现', async () => {
    const noticeSpy = vi.spyOn(await import('../../src/core/notice'), 'notify');
    const vault = new MockVault();
    for (const p of ['A.md', 'B.md']) vault.files.set(p, '正文');
    seedOverdueWith(vault, ['A.md', 'B.md']);
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ enableAutoNotify: true } as any));
    // 首次：两篇全新逾期 → 一条篇数通知（不列题目，duration 0 常驻）
    await reviewApp.checkOverdueAndNotify();
    expect(noticeSpy).toHaveBeenCalledTimes(1);
    expect(String(noticeSpy.mock.calls[0][0])).toBe('有 2 篇笔记逾期');
    expect((noticeSpy.mock.calls[0][1] as any).duration).toBe(0);
    // 再次检查：无新逾期 → 不再弹
    noticeSpy.mockClear();
    await reviewApp.checkOverdueAndNotify();
    expect(noticeSpy).not.toHaveBeenCalled();
    // B 保持逾期，A 移出（nextReviewDate 推后）→ 集合剔除；A 再逾期 → 重新弹
    seedOverdueWith(vault, ['B.md']);
    await reviewApp.checkOverdueAndNotify();
    noticeSpy.mockClear();
    seedOverdueWith(vault, ['A.md', 'B.md']);
    await reviewApp.checkOverdueAndNotify();
    expect(noticeSpy).toHaveBeenCalledTimes(1);
    expect(String(noticeSpy.mock.calls[0][0])).toBe('有 2 篇笔记逾期');
  });

  it('ticket 153：到期提醒挂「去复习」action → 走 autoJumpOverdue（做题分流，非单篇打开）', async () => {
    const noticeSpy = vi.spyOn(await import('../../src/core/notice'), 'notify');
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    const now = new Date();
    // A 最早到期（最紧迫），B 次之；本轮都属 newly
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 2 * 86400000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
      { id: '2', filePath: 'B.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1 * 86400000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    const openFile = vi.fn().mockResolvedValue(undefined);
    (app.workspace as any).getLeaf = () => ({ openFile });
    setApp(app);
    setSettingsProvider(() => ({ enableAutoNotify: true } as any));
    // 拦截 autoJumpOverdue：验证「去复习」触发统一复习流程（而非直接 openFile）
    const jumpSpy = vi.spyOn(reviewApp, 'autoJumpOverdue').mockResolvedValue(undefined);
    await reviewApp.checkOverdueAndNotify();
    const opts = noticeSpy.mock.calls[0][1] as any;
    expect(opts.action).toBeTruthy();
    expect(opts.action.label).toBe('去复习'); // 无 emoji
    expect(String(noticeSpy.mock.calls[0][0])).toBe('有 2 篇笔记逾期');
    opts.action.onClick();
    await new Promise((r) => setTimeout(r, 10));
    expect(jumpSpy).toHaveBeenCalledTimes(1); // 走统一流程
    expect(openFile).not.toHaveBeenCalled(); // 不再裸开单篇
  });

  it('ticket 153：已通知的旧逾期不重复弹——「去复习」仍只对 newly 弹通知', async () => {
    const noticeSpy = vi.spyOn(await import('../../src/core/notice'), 'notify');
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    const now = new Date();
    const seed = (rows: any[]) => vault.files.set(REVIEW_FILE_PATH, JSON.stringify(rows));
    const aRow = { id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, lastReviewed: null, lastDifficulty: null, completed: false };
    // 首轮：仅 A 逾期（最紧迫）；B 未逾期 → 通知 A
    seed([{ ...aRow, nextReviewDate: new Date(now.getTime() - 2 * 86400000).toISOString() }]);
    const app = makeApp(vault);
    const openFile = vi.fn().mockResolvedValue(undefined);
    (app.workspace as any).getLeaf = () => ({ openFile });
    setApp(app);
    setSettingsProvider(() => ({ enableAutoNotify: true } as any));
    await reviewApp.checkOverdueAndNotify();
    expect(String(noticeSpy.mock.calls[0][0])).toBe('有 1 篇笔记逾期');
    // 第二轮：A 仍逾期（已在已通知集合），B 变逾期且晚于 A → 通知内容不变（不重复弹 A）
    noticeSpy.mockClear();
    const jumpSpy = vi.spyOn(reviewApp, 'autoJumpOverdue').mockResolvedValue(undefined);
    seed([
      { ...aRow, nextReviewDate: new Date(now.getTime() - 2 * 86400000).toISOString() },
      { id: '2', filePath: 'B.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1 * 86400000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]);
    await reviewApp.checkOverdueAndNotify();
    expect(String(noticeSpy.mock.calls[0][0])).toBe('有 2 篇笔记逾期');
    const opts = noticeSpy.mock.calls[0][1] as any;
    opts.action.onClick();
    await new Promise((r) => setTimeout(r, 10));
    expect(jumpSpy).toHaveBeenCalledTimes(1); // 点「去复习」走统一流程
    expect(openFile).not.toHaveBeenCalled();
  });

  it('逾期通知只报篇数（多/单篇一致，不列题目；duration 0 常驻）', async () => {
    const noticeSpy = vi.spyOn(await import('../../src/core/notice'), 'notify');
    const vault = new MockVault();
    for (const p of ['A.md', 'B.md', 'C.md', 'D.md', 'E.md']) vault.files.set(p, '正文');
    seedOverdueWith(vault, ['A.md', 'B.md', 'C.md', 'D.md', 'E.md']);
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ enableAutoNotify: true } as any));
    await reviewApp.checkOverdueAndNotify();
    const msg = String(noticeSpy.mock.calls[0][0]);
    expect(msg).toBe('有 5 篇笔记逾期'); // 不含任何题目名
    expect((noticeSpy.mock.calls[0][1] as any).duration).toBe(0); // 常驻
    // 单篇同口径
    noticeSpy.mockClear();
    (reviewApp as any)._notifiedOverdue = new Set();
    (reviewApp as any)._overdueNotice = null;
    seedOverdueWith(vault, ['F.md']);
    vault.files.set('F.md', '正文');
    await reviewApp.checkOverdueAndNotify();
    expect(String(noticeSpy.mock.calls[0][0])).toBe('有 1 篇笔记逾期');
  });

  it('逾期清零 → 常驻通知主动收起', async () => {
    const noticeModule = await import('../../src/core/notice');
    noticeModule.__resetNoticeForTests(); // 清 30s 去重窗口，保证本测真实建框
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    seedOverdueWith(vault, ['A.md']);
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ enableAutoNotify: true } as any));
    await reviewApp.checkOverdueAndNotify();
    expect(document.querySelector('.bz-notice')).not.toBeNull();
    // 全部逾期清除 → 常驻通知失去时效被收起
    seedOverdueWith(vault, []);
    await reviewApp.checkOverdueAndNotify();
    expect((reviewApp as any)._overdueNotice).toBeNull();
    await new Promise((r) => setTimeout(r, 280)); // 退出动画 200ms
    expect(document.querySelector('.bz-notice')).toBeNull();
  });

  it('到期提醒开关关 → 完全静默', async () => {
    const noticeSpy = vi.spyOn(await import('../../src/core/notice'), 'notify');
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    seedOverdueWith(vault, ['A.md']);
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ enableAutoNotify: false } as any));
    await reviewApp.checkOverdueAndNotify();
    expect(noticeSpy).not.toHaveBeenCalled();
  });

  it('每日复习上限：逾期队列截断；默认 0 不限', async () => {
    const vault = new MockVault();
    for (const p of ['A.md', 'B.md', 'C.md']) vault.files.set(p, '正文');
    seedOverdueWith(vault, ['A.md', 'B.md', 'C.md']);
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ reviewDailyLimit: 1, forceQuizForReview: false } as any));
    const spy = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    await reviewApp.autoJumpOverdue();
    expect(spy).toHaveBeenCalledTimes(1);
    const passed = spy.mock.calls[0][0] as any[];
    expect(passed.length).toBe(1);
  });

  it('FSRS 间隔缩放：scale 2 翻倍；scale 0.5 减半（相对 scale 1 基准）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    const runWith = async (scale: number): Promise<number> => {
      vault.files.set(REVIEW_FILE_PATH, JSON.stringify([{
        id: '1', filePath: 'A.md', reviewStart: new Date(now.getTime() - 100 * 86400000).toISOString(), stage: 12, phase: 'fsrs', stability: 100, difficulty: 0.3, reviewHistory: [{ timestamp: new Date(now.getTime() - 30 * 86400000).toISOString() }], totalReviews: 1, averageConfidence: 0, nextReviewDate: now.toISOString(), lastReviewed: new Date(now.getTime() - 30 * 86400000).toISOString(), lastDifficulty: 'good', completed: false,
      }]));
      const app = makeApp(vault);
      setApp(app);
      setSettingsProvider(() => ({ reviewIntervalScale: scale } as any));
      await reviewApp.markReview('A.md', 'good');
      const items = await new ReviewDataManager(app).loadItems();
      return new Date(items[0].nextReviewDate!).getTime() - now.getTime();
    };
    const base = await runWith(1);
    const d2 = await runWith(2);
    const dHalf = await runWith(0.5);
    expect(Math.abs(d2 / base - 2)).toBeLessThan(0.05); // 翻倍
    expect(Math.abs(dHalf / base - 0.5)).toBeLessThan(0.05); // 减半
  });
});


describe('P1-2 回归：reviewLoop 活动文件切走收尾', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({ forceQuizForReview: false }) as any);
    (reviewApp as any).dataManager = null;
    (reviewApp as any)._quizOverride = null;
    (reviewApp as any)._reviewNotice = null;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    (reviewApp as any)._reviewNotice = null;
  });

  it('切走后常驻通知 warning 收尾并置空（与超时分支同样收尾）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    const item = {
      id: '1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 0, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    } as any;
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    (app.workspace as any).getActiveFile = () => ({ path: 'OTHER.md' }); // 已切走
    setApp(app);
    const handle = { setType: vi.fn(), setMessage: vi.fn(), hide: vi.fn() };
    const notifySpy = vi.spyOn(await import('../../src/core/notice'), 'notify').mockReturnValue(handle as any);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await reviewApp.reviewLoop([item], 0);
    await vi.advanceTimersByTimeAsync(1100); // 首个 1s 轮询即检测到切走
    vi.useRealTimers();
    expect(handle.setMessage).toHaveBeenCalledWith('已切换到其他笔记，本轮复习中断');
    expect(handle.setType).toHaveBeenCalledWith('warning');
    expect((reviewApp as any)._reviewNotice).toBeNull();
  });

  it('正常在目标笔记上复习 → 通知不收尾（保持「复习中」）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    const item = {
      id: '1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 0, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    } as any;
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    (app.workspace as any).getActiveFile = () => ({ path: 'A.md' });
    setApp(app);
    const handle = { setType: vi.fn(), setMessage: vi.fn(), hide: vi.fn() };
    vi.spyOn(await import('../../src/core/notice'), 'notify').mockReturnValue(handle as any);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await reviewApp.reviewLoop([item], 0);
    await vi.advanceTimersByTimeAsync(1100);
    vi.useRealTimers();
    expect(handle.setType).not.toHaveBeenCalledWith('warning');
    expect((reviewApp as any)._reviewNotice).not.toBeNull();
    (reviewApp as any)._reviewNotice = null;
  });

  it('P3 回归：stopReviewLoops 终止 1s 轮询（卸载后不再读盘）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    const item = {
      id: '1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 0, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    } as any;
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    (app.workspace as any).getActiveFile = () => ({ path: 'A.md' }); // 停留在目标笔记：轮询保持活动
    setApp(app);
    const handle = { setType: vi.fn(), setMessage: vi.fn(), hide: vi.fn() };
    vi.spyOn(await import('../../src/core/notice'), 'notify').mockReturnValue(handle as any);
    (reviewApp as any)._reviewNotice = null;
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await reviewApp.reviewLoop([item], 0);
    const loadSpy = vi.spyOn((reviewApp as any).dataManager, 'loadItems');
    await vi.advanceTimersByTimeAsync(2100);
    const pollsBefore = loadSpy.mock.calls.length;
    expect(pollsBefore).toBeGreaterThan(0); // 轮询进行中
    reviewApp.stopReviewLoops();
    await vi.advanceTimersByTimeAsync(10000);
    expect(loadSpy.mock.calls.length).toBe(pollsBefore); // 终止后不再读盘
    vi.useRealTimers();
    (reviewApp as any)._reviewNotice = null;
  });
});

describe('ADR-0077：置顶排序 + R 优先级 + 抽查 + 拟合触发', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({} as any));
    (reviewApp as any).dataManager = null;
    (reviewApp as any)._fittedW = null;
    (reviewApp as any)._reviewCountSinceFit = 0;
    (reviewApp as any)._fitRunning = false;
  });
  afterEach(() => {
    vi.restoreAllMocks(); // spy 跨用例累积清零
  });

  it('sortOverdue：R 升序（遗忘风险最高优先）→ 到期时间；每日上限截断', async () => {
    const now = new Date();
    const mk = (path: string, nextDate: string, stability?: number, lastReviewed?: string, phase = 'fsrs') => ({
      id: path, filePath: path, name: path.replace('.md', ''), reviewStart: now.toISOString(),
      stage: 10, phase, stability: stability ?? 1, difficulty: 0.3, reviewHistory: [],
      totalReviews: 0, averageConfidence: 0, nextReviewDate: nextDate, lastReviewed: lastReviewed ?? null,
      lastDifficulty: null, completed: false,
    });
    // A：短间隔高稳定（R 高）；B：短间隔低稳定（R 中）；C：长间隔低稳定（R 低）
    const items = [
      mk('A.md', new Date(now.getTime() - 3600e3).toISOString(), 20, new Date(now.getTime() - 1 * 86400e3).toISOString()),
      mk('B.md', new Date(now.getTime() - 86400e3 * 3).toISOString(), 5, new Date(now.getTime() - 2 * 86400e3).toISOString()),
      mk('C.md', new Date(now.getTime() - 86400e3 * 2).toISOString(), 5, new Date(now.getTime() - 20 * 86400e3).toISOString()),
    ];
    const sorted = reviewApp.sortOverdue(items as any);
    // C（R 最低）先于 B（R 中）先于 A（R 高）
    expect(sorted[0].filePath).toBe('C.md');
    expect(sorted[1].filePath).toBe('B.md');
    expect(sorted[2].filePath).toBe('A.md');
    // 每日上限截断
    const limited = reviewApp.sortOverdue(items as any, 2);
    expect(limited).toHaveLength(2);
    expect(limited[0].filePath).toBe('C.md');
    expect(limited[1].filePath).toBe('B.md');
  });

  it('maybeRunFit：每 N 次触发拟合重算（样本不足静默跳过）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    (reviewApp as any).dataManager = dm;
    // 样本不足（<100）→ 不落盘、不提示
    setSettingsProvider(() => ({ reviewEnableFit: true, reviewFitEveryN: 3 } as any));
    await reviewApp.maybeRunFit(app);
    await reviewApp.maybeRunFit(app);
    await reviewApp.maybeRunFit(app); // 达阈值 3
    const fitFile = vault.files.get('CONFIG/STORAGE/review-fit.json');
    expect(fitFile).toBeUndefined(); // 样本不足未落盘
  });

  it('P2 回归：拟合重算 fire-and-forget——不 await（挂起的拟合不阻塞评级写盘）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    await seedOverdue(vault, {
      stage: 12, phase: 'fsrs', stability: 5, difficulty: 0.3,
      lastReviewed: new Date(now.getTime() - 3 * 86400e3).toISOString(),
    });
    const app = makeApp(vault);
    setApp(app);
    const never = new Promise<void>(() => {}); // 永不 resolve：若 markReview 仍 await 则本用例超时红
    const fitSpy = vi.spyOn(reviewApp, 'maybeRunFit').mockReturnValue(never);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].totalReviews).toBe(1); // 评级已写盘
    expect(fitSpy).toHaveBeenCalledTimes(1); // 拟合已入队后台执行
  });

  it('P2 回归：阶梯评级路径同样 fire-and-forget 拟合', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 3 });
    const app = makeApp(vault);
    setApp(app);
    const never = new Promise<void>(() => {});
    const fitSpy = vi.spyOn(reviewApp, 'maybeRunFit').mockReturnValue(never);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(4); // 评级已写盘
    expect(fitSpy).toHaveBeenCalledTimes(1);
  });

  it('currentR：FSRS 相位且有 lastReviewed 可算；否则 null', () => {
    const now = new Date();
    const item = {
      phase: 'fsrs', stability: 5, lastReviewed: new Date(now.getTime() - 86400e3).toISOString(),
    } as any;
    const r = reviewApp.currentR(item);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0);
    expect(r!).toBeLessThan(1);
    const ladder = { phase: 'ladder' } as any;
    expect(reviewApp.currentR(ladder)).toBeNull();
  });

  it('拟合链路源头：markReview 历史补 difficulty，生产旧数据（无 difficulty 历史）可积累样本', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    // 生产旧数据形态：FSRS 相位历史只含 stability/R，无 difficulty（旧版 markReview 不写）
    await seedOverdue(vault, {
      stage: 12, phase: 'fsrs', stability: 5, difficulty: 0.3,
      lastReviewed: new Date(now.getTime() - 3 * 86400e3).toISOString(),
      reviewHistory: [
        { timestamp: new Date(now.getTime() - 30 * 86400e3).toISOString(), stage: 12, rating: 'good', stability: 5, R: 62 },
      ],
    });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    const history = items[0].reviewHistory;
    // 新写入的记录带 difficulty（good 不变难度 → 0.3）与 stability
    expect(history[1].difficulty).toBe(0.3);
    expect(history[1].stability).toEqual(expect.any(Number));
    // 走拟合层真实入口：旧记录缺 difficulty 回退条目级值 → 旧→新配对产出可拟合样本
    const { buildFitSamples } = await import('../../src/review/fit');
    const samples = buildFitSamples(history, { fallbackDifficulty: items[0].difficulty });
    expect(samples.length).toBeGreaterThanOrEqual(1);
    expect(samples[0].S).toBe(5);
  });

  it('拟合链路源头：进入 FSRS（阶梯→fsrs）的历史记录同样带 stability/difficulty', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 8 });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'easy'); // 8 → 9 进入 fsrs
    const items = await new ReviewDataManager(app).loadItems();
    const entry = items[0].reviewHistory[0];
    expect(items[0].phase).toBe('fsrs');
    expect(typeof entry.stability).toBe('number');
    expect(typeof entry.difficulty).toBe('number');
  });
});
describe('sprint 编排（2026-09-04 形态：startRoundSprint / startSingleSprint / runSprintSession）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({ forceQuizForReview: false, reviewDailyLimit: 0, reviewRThreshold: 0.9 }) as any);
    (reviewApp as any).dataManager = null;
    (reviewApp as any)._quizOverride = null;
  });
  afterEach(() => {
    (reviewApp as any)._quizOverride = null;
    vi.restoreAllMocks();
  });

  it('forceQuizForReview=false：startRoundSprint 走 reviewLoop（不触碰 sprint）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    (reviewApp as any).dataManager = dm;
    const loopSpy = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    await reviewApp.startRoundSprint();
    expect(loopSpy).toHaveBeenCalled();
  });

  it('startSingleSprint：无 AI 降级 reviewLoop；有 AI 驱动 runSprintSession', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    (reviewApp as any).dataManager = dm;
    const items = await dm.loadItems();
    // 无 AI：显式清 quizUI.ai（模块级 initialized 跨用例污染 → 需手动置 null 模拟未初始化）。
    // 先幂等跑一次 ensureQuiz（吃掉 initialized 首跑标志），否则 startSingleSprint 内部
    // ensureQuiz 会重建 AI → 首运必失败、仅 retry 通过（稳定性修复）
    const quizMod = await import('../../src/review/quiz-core');
    quizMod.ensureQuiz(app);
    quizMod.quizUI.ai = null;
    quizMod.QuizMasterUI.ai = null;
    const loopSpy = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    const sessionSpy = vi.spyOn(reviewApp, 'runSprintSession').mockResolvedValue(undefined);
    await reviewApp.startSingleSprint(items[0]);
    expect(loopSpy).toHaveBeenCalled();
    expect(sessionSpy).not.toHaveBeenCalled();
  });

  it('dueItems：逾期 + R<阈值 提前逾期过滤', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    await seedOverdue(vault, { filePath: 'A.md', name: 'A' });
    // B 未逾期：未来很远
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: 'a', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
      { id: 'b', filePath: 'B.md', name: 'B', reviewStart: now.toISOString(), stage: 10, phase: 'fsrs', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 86400e3 * 30).toISOString(), lastReviewed: new Date(now.getTime() - 86400e3 * 10).toISOString(), lastDifficulty: 'good', completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    (reviewApp as any).dataManager = dm;
    const items = await dm.loadItems();
    const due = reviewApp.dueItems(items);
    expect(due.some((i) => i.filePath === 'A.md')).toBe(true);
    // B：R(t=10, S=1) < 0.9 → 也提前逾期（FSRS 阈值）
    expect(due.some((i) => i.filePath === 'B.md')).toBe(true);
  });
});
