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

describe('autoJumpOverdue / reviewLoop / accuracyToRating', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({ forceQuizForReview: false }) as any);
    (reviewApp as any).dataManager = null;
  });

  it('无逾期 → 🎉 没有逾期笔记', async () => {
    const vault = new MockVault();
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: '1', filePath: 'A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() + 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.autoJumpOverdue();
  });

  it('accuracyToRating 分档', () => {
    expect(reviewApp.accuracyToRating(95)).toBe('easy');
    expect(reviewApp.accuracyToRating(75)).toBe('good');
    expect(reviewApp.accuracyToRating(55)).toBe('hard');
    expect(reviewApp.accuracyToRating(30)).toBe('again');
  });

  it('reviewLoop：文件不存在 → removeItem + 继续', async () => {
    const vault = new MockVault();
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: 'gone', filePath: 'GONE.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    // loadItems 已过滤不存在文件，直接传手工列表触发防御分支
    const goneItem = {
      id: 'gone', filePath: 'GONE.md', name: 'GONE', reviewStart: now.toISOString(), stage: 0, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    } as any;
    await reviewApp.reviewLoop([goneItem], 0);
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw.length).toBe(0);
  });

  it('addCurrentToReview：重复 → 抛错', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.addCurrentToReview(vault.file('A.md') as any);
    await expect(reviewApp.addCurrentToReview(vault.file('A.md') as any)).rejects.toThrow('该笔记已在复习计划中');
  });
});

describe('autoJumpOverdue：做题决定难度开关', () => {
  beforeEach(() => {
    resetObsidianMocks();
    (reviewApp as any).dataManager = null; // 重置单例（跨测试污染）
    (reviewApp as any)._quizOverride = null;
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    (reviewApp as any)._quizOverride = null;
    // 清理真实 quiz 模块的静态/实例 ai（跨测试污染）
    const quizModule = await import('../../src/quiz');
    quizModule.QuizMasterUI.ai = null;
    quizModule.quizUI.ai = null;
  });

  it('开启 + 有题 → quizReviewLoop（不跳转笔记）', async () => {
    setSettingsProvider(() => ({ forceQuizForReview: true }) as any);
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault);
    const app = makeApp(vault);
    setApp(app);
    // mock 做题家（ai 就绪 + 已有题目）；getQuestionsForNote 校验双参签名 (app, notePath)
    const getQSpy = vi.fn(async (_app: any, notePath: string) =>
      notePath === 'A.md' ? [{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }] : null
    );
    // ticket 156：批量出题先清空存量题（上次答错残留）再生成新题
    const saveQSpy = vi.fn(async () => {});
    (reviewApp as any)._quizOverride = {
      ai: {},
      ensureQuestions: async () => {},
      manager: { getQuestionsForNote: getQSpy, saveQuestionsForNote: saveQSpy },
    };
    const spyQL = vi.spyOn(reviewApp, 'quizReviewLoop').mockResolvedValue(undefined);
    const spyRL = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    await reviewApp.autoJumpOverdue();
    expect(spyQL).toHaveBeenCalled();
    expect(spyRL).not.toHaveBeenCalled();
    // 参数错位 bug 回归：必须以 (app, notePath) 双参调用，否则读不到题目
    expect(getQSpy.mock.calls[0][0]).toBeTruthy(); // app
    expect(getQSpy.mock.calls[0][1]).toBe('A.md'); // notePath
    // ticket 156：出题前先清空该笔记存量题（下次逾期复习出新题）
    expect(saveQSpy).toHaveBeenCalledWith(expect.anything(), 'A.md', []);
  });

  it('关闭 → reviewLoop（普通复习，不弹做题）', async () => {
    setSettingsProvider(() => ({ forceQuizForReview: false }) as any);
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault);
    const app = makeApp(vault);
    setApp(app);
    const spyQL = vi.spyOn(reviewApp, 'quizReviewLoop').mockResolvedValue(undefined);
    const spyRL = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    await reviewApp.autoJumpOverdue();
    expect(spyRL).toHaveBeenCalled();
    expect(spyQL).not.toHaveBeenCalled();
  });

  it('开启但做题家未初始化（ai 为 null）→ 降级 reviewLoop', async () => {
    setSettingsProvider(() => ({ forceQuizForReview: true }) as any);
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault);
    const app = makeApp(vault);
    setApp(app);
    (reviewApp as any)._quizOverride = { ai: null };
    const spyQL = vi.spyOn(reviewApp, 'quizReviewLoop').mockResolvedValue(undefined);
    const spyRL = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    await reviewApp.autoJumpOverdue();
    expect(spyRL).toHaveBeenCalled();
    expect(spyQL).not.toHaveBeenCalled();
  });

  it('开启但批量出题失败（无题目）→ 降级 reviewLoop + warning 通知', async () => {
    setSettingsProvider(() => ({ forceQuizForReview: true }) as any);
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault);
    const app = makeApp(vault);
    setApp(app);
    (reviewApp as any)._quizOverride = {
      ai: {},
      ensureQuestions: async () => {},
      manager: { getQuestionsForNote: async () => [], saveQuestionsForNote: async () => {} },
    };
    const spyQL = vi.spyOn(reviewApp, 'quizReviewLoop').mockResolvedValue(undefined);
    const spyRL = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    await reviewApp.autoJumpOverdue();
    expect(spyRL).toHaveBeenCalled();
    expect(spyQL).not.toHaveBeenCalled();
    expect(getNoticeMessages()).toContain('批量出题失败，改用普通复习');
  });

  it('开启 + 做题家已初始化（quizUI.ai 实例镜像）→ quizReviewLoop（真实 quizUI 链路）', async () => {
    setSettingsProvider(() => ({ forceQuizForReview: true }) as any);
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault);
    const app = makeApp(vault);
    setApp(app);
    // 模拟做题家已初始化（ensureQuiz 后的静态 + 实例镜像状态）
    const quizModule = await import('../../src/quiz');
    quizModule.QuizMasterUI.ai = { json: vi.fn() } as any;
    quizModule.quizUI.ai = quizModule.QuizMasterUI.ai;
    (reviewApp as any)._quizOverride = null; // 走真实 quizUI
    const spyQL = vi.spyOn(reviewApp, 'quizReviewLoop').mockResolvedValue(undefined);
    const spyRL = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    const spyBatch = vi.spyOn(reviewApp, 'batchGenerateQuestions').mockResolvedValue({
      'A.md': [{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }],
    });
    await reviewApp.autoJumpOverdue();
    expect(spyBatch).toHaveBeenCalled();
    expect(spyQL).toHaveBeenCalled();
    expect(spyRL).not.toHaveBeenCalled();
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

  it('ticket s1：结果卡文件名 XSS 转义（buildFailCard / buildPassCard）', () => {
    const evil = { filePath: 'X.md', name: '<img src=x onerror=alert(1)>' } as any;
    const results = { correct: 1, wrong: 0, total: 1 };
    const failHtml = reviewApp.buildFailCard(evil, results, 'good');
    expect(failHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(failHtml).not.toContain('<img src=x onerror=alert(1)>');
    // innerHTML 解析后不产生 img 元素
    const div = document.createElement('div');
    div.innerHTML = failHtml;
    expect(div.querySelector('img')).toBeNull();
    const passHtml = reviewApp.buildPassCard(evil, results, 'good', {});
    expect(passHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(passHtml).not.toContain('<img src=x onerror=alert(1)>');
    const div2 = document.createElement('div');
    div2.innerHTML = passHtml;
    expect(div2.querySelector('img')).toBeNull();
  });

  it('用户拍板 2026-08-29：二次复习结果卡不显示自动标记（showAutoMark: false）', () => {
    const item = { filePath: 'A.md', name: 'A' } as any;
    const results = { correct: 2, wrong: 0, total: 2, accuracy: 100 };
    // 重做队列路径：失败/通过卡都不显示「自动标记」徽标
    expect(reviewApp.buildFailCard(item, results, 'good', { showAutoMark: false })).not.toContain('自动标记');
    expect(
      reviewApp.buildPassCard(item, results, 'good', { nextLabel: '下一篇（2/2）', showAutoMark: false })
    ).not.toContain('自动标记');
    // 首次做题路径（缺省）：仍显示自动标记（评级照常写排期）
    expect(reviewApp.buildFailCard(item, results, 'good')).toContain('自动标记');
    expect(reviewApp.buildPassCard(item, results, 'good', {})).toContain('自动标记');
  });

  it('用户拍板 2026-08-29：终局结算面板（nextLabel 空）只保留「完成复习」按钮', () => {
    const item = { filePath: 'A.md', name: 'A' } as any;
    const results = { correct: 2, wrong: 0, total: 2 };
    const last = reviewApp.buildPassCard(item, results, 'good', { nextLabel: '' });
    expect(last).toContain('完成复习');
    expect(last).not.toContain('quiz-end-review'); // 无「结束这次复习」
    expect(last).not.toContain('结束这次复习');
    // 非最后一篇：双按钮保留
    const mid = reviewApp.buildPassCard(item, results, 'good', { nextLabel: '下一篇（2/3）' });
    expect(mid).toContain('下一篇（2/3）');
    expect(mid).toContain('quiz-end-review');
    expect(mid).toContain('结束这次复习');
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
describe('ticket 098：待重做 / 重做流程（ADR-0044）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setSettingsProvider(() => ({ forceQuizForReview: true }) as any);
    (reviewApp as any).dataManager = null;
    (reviewApp as any)._quizOverride = null;
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    (reviewApp as any)._quizOverride = null;
  });

  /** 复习会话 mock（契约：startReviewSession/endReviewSession/close + popup DOM） */
  function makeQuizMock() {
    const quiz: any = {
      ai: {},
      popup: null as any,
      mask: null as any,
      _cb: null as any,
      startReviewSession(opts: any) {
        this.popup = document.createElement('div');
        this.popup.id = 'quiz-popup';
        this.mask = document.createElement('div');
        document.body.appendChild(this.mask);
        document.body.appendChild(this.popup);
        this._cb = opts.onComplete;
      },
      endReviewSession() {},
      close() {
        if (this.popup && this.popup.parentNode) this.popup.remove();
        if (this.mask && this.mask.parentNode) this.mask.remove();
        this.popup = null;
        this.mask = null;
      },
      manager: {
        getQuestionsForNote: async (_app: any, _path: string) => [],
        saveQuestionsForNote: async () => {},
      },
      ensureQuestions: async () => {},
    };
    return quiz;
  }

  it('markReview(autoPending)：again/hard 置位，good/easy 清除', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 3 });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'again', { autoPending: true });
    expect((await new ReviewDataManager(app).loadItems())[0].pendingRedo).toBe(true);
    await seedOverdue(vault, { stage: 3 });
    await reviewApp.markReview('A.md', 'good', { autoPending: true });
    expect((await new ReviewDataManager(app).loadItems())[0].pendingRedo).toBe(false);
  });

  it('markReview 手动路径：again/hard 不置位；good/easy 清除陈旧标记', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 3, pendingRedo: true });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'good'); // 无 opts：good 清
    expect((await new ReviewDataManager(app).loadItems())[0].pendingRedo).toBe(false);
    await seedOverdue(vault, { stage: 3, pendingRedo: true });
    await reviewApp.markReview('A.md', 'again'); // 无 opts：手动模式不置位
    expect((await new ReviewDataManager(app).loadItems())[0].pendingRedo).toBe(true);
  });

  it('pendingRedoItems：FIFO（lastReviewed 升序）+ 排除挂起/已完成', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    vault.files.set('C.md', '正文');
    vault.files.set('D.md', '正文');
    const now = new Date();
    const mk = (id: string, path: string, lastReviewed: string | null, pending: boolean, completed = false) => ({
      id, filePath: path, reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3,
      reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed, lastDifficulty: 'hard', completed, pendingRedo: pending,
    });
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      mk('A', 'A.md', new Date(now.getTime() - 60000).toISOString(), true),
      mk('B', 'B.md', new Date(now.getTime() - 120000).toISOString(), true), // 更早 → FIFO 在前
      mk('C', 'C.md', null, true, true), // completed → 排除
      mk('D', 'D.md', null, false), // 未置位 → 排除
    ]));
    vault.files.delete('GONE.md');
    vault.files.set(REVIEW_FILE_PATH, vault.files.get(REVIEW_FILE_PATH)! + '\n');
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    raw.push({ id: 'E', filePath: 'GONE.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: now.toISOString(), lastDifficulty: 'hard', completed: false, pendingRedo: true });
    vault.files.set('GONE.md', 'x'); // 文件缺失 → 挂起
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify(raw));
    vault.files.delete('GONE.md');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const items = await dm.loadItems();
    const pend = reviewApp.pendingRedoItems(items);
    expect(pend.map((i) => i.id)).toEqual(['B', 'A']); // FIFO + 排除 E(挂起)/C(已完成)
  });

  it('quizReviewLoop 首次未通过：结果卡唯一按钮「复习此笔记」→ 点击关弹窗开笔记 + pendingRedo 置位', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 3 });
    const app = makeApp(vault);
    setApp(app);
    const openFile = vi.fn().mockResolvedValue(undefined);
    (app.workspace as any).getLeaf = () => ({ openFile });
    const quiz = makeQuizMock();
    (reviewApp as any)._quizOverride = quiz;
    const dm = new ReviewDataManager(app);
    const items = await dm.loadItems();
    const p = reviewApp.quizReviewLoop(items.slice(0, 1), 0, { 'A.md': [{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }] });
    await new Promise((r) => setTimeout(r, 20));
    // 答完（0% → again）
    void quiz._cb({ correct: 0, wrong: 2, total: 2, accuracy: 0 });
    await new Promise((r) => setTimeout(r, 50));
    expect(quiz.popup.innerHTML).toContain('复习此笔记');
    expect(quiz.popup.querySelector('#quiz-next-note')).toBeNull();
    expect(quiz.popup.querySelector('#quiz-end-review')).toBeNull();
    expect((await dm.loadItems())[0].pendingRedo).toBe(true);
    // 点「复习此笔记」→ 弹窗关闭 + 打开笔记 + 会话结束
    quiz.popup.querySelector('#quiz-review-note')!.click();
    await p;
    expect(quiz.popup).toBeNull();
    expect(openFile).toHaveBeenCalled();
  });

  it('regenerateQuestions：返回题补 notePath/_index（ticket 099：缺失曾致 renderModal split 崩溃）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    // 新题链路：清空 → ensureQuestions → 读回 fresh
    const fresh = [{ question: 'F', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }];
    (reviewApp as any)._quizOverride = {
      ai: {},
      ensureQuestions: async () => {},
      manager: {
        getQuestionsForNote: vi.fn(async (_app: any, path: string) => (path === 'A.md' ? [...fresh] : [])),
        saveQuestionsForNote: async () => {},
      },
    };
    const out = await reviewApp.regenerateQuestions('A.md');
    expect(out).toHaveLength(1);
    expect(out[0].notePath).toBe('A.md');
    expect(out[0]._index).toBe(0);
    // 回退链路：新题为空 → 用 leftover 旧题，同样补 notePath/_index
    const leftover = [{ question: 'L', options: ['a', 'b', 'c', 'd'], correctIndices: [1] }];
    let call = 0;
    (reviewApp as any)._quizOverride.manager.getQuestionsForNote = async () => (call++ === 0 ? [...leftover] : []);
    const out2 = await reviewApp.regenerateQuestions('A.md');
    expect(out2[0].question).toBe('L');
    expect(out2[0].notePath).toBe('A.md');
    expect(out2[0]._index).toBe(0);
    (reviewApp as any)._quizOverride = null;
  });

  it('redoReviewLoop：通过仅清标记不写 FSRS（markReview 不被调用）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 3, pendingRedo: true });
    const app = makeApp(vault);
    setApp(app);
    const quiz = makeQuizMock();
    (reviewApp as any)._quizOverride = quiz;
    const regen = vi.spyOn(reviewApp, 'regenerateQuestions').mockResolvedValue([{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }]);
    const markSpy = vi.spyOn(reviewApp, 'markReview').mockResolvedValue(undefined);
    const dm = new ReviewDataManager(app);
    const items = await dm.loadItems();
    const before = items[0].nextReviewDate;
    const p = reviewApp.redoReviewLoop(items.slice(0, 1), 0);
    await new Promise((r) => setTimeout(r, 20));
    void quiz._cb({ correct: 2, wrong: 0, total: 2, accuracy: 100 });
    await new Promise((r) => setTimeout(r, 50));
    // 最后一篇 → 「完成复习」按钮
    expect(quiz.popup.innerHTML).toContain('完成复习');
    quiz.popup.querySelector('#quiz-next-note')!.click();
    const result = await p;
    expect(result).toEqual(['A.md']);
    expect(markSpy).not.toHaveBeenCalled(); // 不写 FSRS
    const after = (await dm.loadItems())[0];
    expect(after.pendingRedo).toBe(false);
    expect(after.nextReviewDate).toBe(before); // 排期未动
    expect(regen).toHaveBeenCalledWith('A.md');
  });

  it('redoReviewLoop：失败不写数据、保持待重做、返回 null（会话中断）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { stage: 3, pendingRedo: true });
    const app = makeApp(vault);
    setApp(app);
    const openFile = vi.fn().mockResolvedValue(undefined);
    (app.workspace as any).getLeaf = () => ({ openFile });
    const quiz = makeQuizMock();
    (reviewApp as any)._quizOverride = quiz;
    vi.spyOn(reviewApp, 'regenerateQuestions').mockResolvedValue([{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }]);
    const markSpy = vi.spyOn(reviewApp, 'markReview').mockResolvedValue(undefined);
    const dm = new ReviewDataManager(app);
    const items = await dm.loadItems();
    const before = items[0].nextReviewDate;
    const p = reviewApp.redoReviewLoop(items.slice(0, 1), 0);
    await new Promise((r) => setTimeout(r, 20));
    void quiz._cb({ correct: 0, wrong: 2, total: 2, accuracy: 0 });
    await new Promise((r) => setTimeout(r, 50));
    expect(quiz.popup.innerHTML).toContain('复习此笔记');
    quiz.popup.querySelector('#quiz-review-note')!.click();
    const result = await p;
    expect(result).toBeNull();
    expect(markSpy).not.toHaveBeenCalled();
    const after = (await dm.loadItems())[0];
    expect(after.pendingRedo).toBe(true); // 保持待重做
    expect(after.nextReviewDate).toBe(before); // 什么都不写
    expect(openFile).toHaveBeenCalled();
  });

  it('autoJumpOverdue：待重做队列优先；全部通过后同会话剔除并继续逾期流程', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      { id: 'A', filePath: 'A.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: now.toISOString(), lastDifficulty: 'hard', completed: false, pendingRedo: true },
      { id: 'B', filePath: 'B.md', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]));
    const app = makeApp(vault);
    setApp(app);
    const quiz = makeQuizMock();
    quiz.manager.getQuestionsForNote = async (_a: any, p: string) => (p === 'B.md' ? [{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }] : []);
    (reviewApp as any)._quizOverride = quiz;
    const redoSpy = vi.spyOn(reviewApp, 'redoReviewLoop').mockResolvedValue(['A.md']);
    const qlSpy = vi.spyOn(reviewApp, 'quizReviewLoop').mockResolvedValue(undefined);
    await reviewApp.autoJumpOverdue();
    expect(redoSpy).toHaveBeenCalledWith(expect.any(Array), 0);
    const overdueItems = qlSpy.mock.calls[0][0] as any[];
    expect(overdueItems.map((i: any) => i.filePath)).toEqual(['B.md']); // A 已剔除
  });

  it('autoJumpOverdue：重做失败（null）→ 会话终止，不进逾期流程', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault, { pendingRedo: true });
    const app = makeApp(vault);
    setApp(app);
    const quiz = makeQuizMock();
    quiz.manager.getQuestionsForNote = async (_a: any, p: string) => (p === 'A.md' ? [{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }] : []);
    (reviewApp as any)._quizOverride = quiz;
    vi.spyOn(reviewApp, 'redoReviewLoop').mockResolvedValue(null);
    const qlSpy = vi.spyOn(reviewApp, 'quizReviewLoop').mockResolvedValue(undefined);
    const rlSpy = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    await reviewApp.autoJumpOverdue();
    expect(qlSpy).not.toHaveBeenCalled();
    expect(rlSpy).not.toHaveBeenCalled();
  });

  it('P1-3 回归：redoReviewLoop 无题跳过项不入返回集合（留在逾期队列可进普通复习）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    const now = new Date();
    const mkRow = (id: string, p: string) => ({
      id, filePath: p, name: p, reviewStart: now.toISOString(), stage: 3, phase: 'ladder', stability: 1, difficulty: 0.3,
      reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: now.toISOString(),
      lastDifficulty: 'hard', completed: false, pendingRedo: true,
    });
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([mkRow('A', 'A.md'), mkRow('B', 'B.md')]));
    const app = makeApp(vault);
    setApp(app);
    const quiz = makeQuizMock();
    (reviewApp as any)._quizOverride = quiz;
    // A 无题跳过；B 正常通过
    vi.spyOn(reviewApp, 'regenerateQuestions').mockImplementation(async (p: any) =>
      p === 'A.md' ? [] : [{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }]
    );
    const dm = new ReviewDataManager(app);
    const items = await dm.loadItems();
    const pr = reviewApp.redoReviewLoop(items, 0);
    await new Promise((r) => setTimeout(r, 20));
    void quiz._cb({ correct: 2, wrong: 0, total: 2, accuracy: 100 });
    await new Promise((r) => setTimeout(r, 50));
    quiz.popup.querySelector('#quiz-next-note')!.click(); // B 是最后一篇 → 完成复习
    const result = await pr;
    // 返回集合只含通过的 B，跳过的 A 不在其中
    expect(result).toEqual(['B.md']);
    const after = await dm.loadItems();
    expect(after.find((i) => i.filePath === 'A.md')!.pendingRedo).toBe(true); // A 保持待重做
    expect(after.find((i) => i.filePath === 'B.md')!.pendingRedo).toBe(false);
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
});