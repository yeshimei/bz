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
    (reviewApp as any)._quizOverride = {
      ai: {},
      ensureQuestions: async () => {},
      manager: { getQuestionsForNote: getQSpy },
    };
    const spyQL = vi.spyOn(reviewApp, 'quizReviewLoop').mockResolvedValue(undefined);
    const spyRL = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    await reviewApp.autoJumpOverdue();
    expect(spyQL).toHaveBeenCalled();
    expect(spyRL).not.toHaveBeenCalled();
    // 参数错位 bug 回归：必须以 (app, notePath) 双参调用，否则读不到题目
    expect(getQSpy.mock.calls[0][0]).toBeTruthy(); // app
    expect(getQSpy.mock.calls[0][1]).toBe('A.md'); // notePath
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
      manager: { getQuestionsForNote: async () => [] },
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
});