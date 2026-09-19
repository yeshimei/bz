import { makeApp } from '../helpers/app';
/**
 * review 域批 B「app 编排与出题链」修复回归（2026-09-19 深审）：
 *  - A1/T2：批量/重做出题「清空先行、失败不回滚」→ 生成成功才覆盖，失败篇存量题写回
 *  - A2：做题链路降级判据换 getAIProvider 试准（quiz.ai 恒 truthy 的死分支复活）
 *  - F2：reviewLoop/resumeRound 防重入（活动循环中再入 → 拒绝 + notice，不产生双 interval）
 *  - F8：markReview 时间门禁移入 RMW 队列内基于磁盘现值复判（并发双评级不再双写历史）
 *  - F9：vault modify 单文件染色复用快照（不再每次保存任意 md 全量读盘）
 *  - U9：reviewLoop 常驻进度通知句柄复用前验活
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { reviewApp, __setReviewAwayGraceMsForTests, ReviewGateRejected } from '../../src/review/app';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';

async function seedOverdue(vault: MockVault, partial: any = {}) {
  const now = new Date();
  vault.files.set(
    REVIEW_FILE_PATH,
    JSON.stringify([
      {
        id: 'x', filePath: 'A.md', name: 'A',
        reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3,
        reviewHistory: [], totalReviews: 0, averageConfidence: 0,
        nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
        ...partial,
      },
    ])
  );
}

function q(name: string) {
  return { question: `${name}?`, options: ['a', 'b', 'c', 'd'], correctIndices: [0] };
}

/** 题库 mock（Map 存储模拟 quiz.json；saveQuestionsForNote 复刻 RMW 覆盖语义） */
function makeQuizMock() {
  const store = new Map<string, any[]>();
  const quiz: any = {
    ai: { ok: true },
    manager: {
      getQuestionsForNote: async (_app: any, p: string) => store.get(p) || null,
      saveQuestionsForNote: async (_app: any, p: string, qs: any[]) => {
        store.set(p, qs.map((x) => ({ ...x })));
      },
    },
    ensureQuestions: async () => {},
  };
  return { store, quiz };
}

beforeEach(() => {
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  setSettingsProvider(() => ({} as any));
  (reviewApp as any).dataManager = null;
  (reviewApp as any)._quizOverride = null;
  (reviewApp as any)._reviewNotice = null;
  (reviewApp as any)._pendingRound = null;
  (reviewApp as any)._lastItems = null;
  (reviewApp as any)._styledPaths = new Set();
  reviewApp.stopReviewLoops();
});

afterEach(async () => {
  vi.useRealTimers();
  reviewApp.stopReviewLoops();
  reviewApp.hideReviewBar();
  vi.restoreAllMocks();
  (reviewApp as any)._quizOverride = null;
  (reviewApp as any)._lastItems = null;
  const quizMod = await import('../../src/review/quiz-core');
  quizMod.QuizMasterUI.ai = null;
  quizMod.quizUI.ai = null;
});

describe('A1/T2：出题失败不再丢存量题', () => {
  it('批量出题 AI 整体失败（ensureQuestions 抛）→ 存量题原样写回 quiz.json，不静默丢弃', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const aiMod = await import('../../src/core/ai');
    vi.spyOn(aiMod, 'getAIProvider').mockResolvedValue({ endpoint: 'http://localhost', apiKey: 'k' } as any);
    const { store, quiz } = makeQuizMock();
    const old = [q('旧题1'), q('旧题2')];
    store.set('A.md', old.map((x) => ({ ...x })));
    quiz.ensureQuestions = async () => {
      throw new Error('AI 全败');
    };
    (reviewApp as any)._quizOverride = quiz;
    await expect(reviewApp.batchGenerateQuestions([{ id: '1', filePath: 'A.md', name: 'A' } as any])).rejects.toThrow(
      'AI 全败'
    );
    expect(store.get('A.md')).toEqual(old); // T2：存量键原值未动
  });

  it('批量出题部分失败 → 成功篇覆盖写新题，失败篇保留存量', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    vault.files.set('B.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const aiMod = await import('../../src/core/ai');
    vi.spyOn(aiMod, 'getAIProvider').mockResolvedValue({ endpoint: 'http://localhost', apiKey: 'k' } as any);
    const { store, quiz } = makeQuizMock();
    const oldB = [q('B旧题')];
    store.set('B.md', oldB.map((x) => ({ ...x })));
    quiz.ensureQuestions = async () => {
      store.set('A.md', [q('A新题')]); // A 生成成功
      // B 生成失败：键保持清空态 []
    };
    (reviewApp as any)._quizOverride = quiz;
    const out = await reviewApp.batchGenerateQuestions([
      { id: '1', filePath: 'A.md', name: 'A' } as any,
      { id: '2', filePath: 'B.md', name: 'B' } as any,
    ]);
    expect(out['A.md']).toHaveLength(1);
    expect(store.get('B.md')).toEqual(oldB); // 失败篇存量写回
  });

  it('regenerateQuestions AI 异常 → 存量错题写回题库，会话返回空走跳过语义', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const { store, quiz } = makeQuizMock();
    const old = [q('剩余错题')];
    store.set('A.md', old.map((x) => ({ ...x })));
    quiz.ensureQuestions = async () => {
      throw new Error('网络断');
    };
    (reviewApp as any)._quizOverride = quiz;
    const out = await reviewApp.regenerateQuestions('A.md');
    expect(out).toEqual([]);
    expect(store.get('A.md')).toEqual(old); // 异常分支也写回（旧实现清空后不回写）
  });

  it('regenerateQuestions 空题 → leftover 写回题库并作会话兜底', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const { store, quiz } = makeQuizMock();
    const old = [q('剩余错题')];
    store.set('A.md', old.map((x) => ({ ...x })));
    quiz.ensureQuestions = async () => {}; // AI 成功但 0 题
    (reviewApp as any)._quizOverride = quiz;
    const out = await reviewApp.regenerateQuestions('A.md');
    expect(out.map((x: any) => x.question)).toEqual(['剩余错题?']);
    expect(store.get('A.md')).toEqual(old); // 磁盘同步写回
  });
});

describe('A2：AI 未配置 → 降级护栏复活（getAIProvider 试准）', () => {
  it('startSingleSprint：quiz.ai truthy 但 AI 未配置 → 降级普通复习不进做题链路', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault);
    const app = makeApp(vault);
    setApp(app);
    (reviewApp as any).dataManager = new ReviewDataManager(app);
    const aiMod = await import('../../src/core/ai');
    vi.spyOn(aiMod, 'getAIProvider').mockRejectedValue(new Error('未配置 API Key'));
    const quizMod = await import('../../src/review/quiz-core');
    quizMod.ensureQuiz(app); // 吃掉 initialized 首跑标志
    quizMod.quizUI.ai = { ok: true } as any; // 复刻「ensureQuiz 后 ai 恒 truthy」的生产形态
    const loopSpy = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    const sessionSpy = vi.spyOn(reviewApp, 'runSprintSession').mockResolvedValue(undefined);
    const items = await (reviewApp as any).dataManager.loadItems();
    await reviewApp.startSingleSprint(items[0]);
    expect(sessionSpy).not.toHaveBeenCalled(); // 不再空转一圈做题链路
    expect(loopSpy).toHaveBeenCalled(); // 走普通复习降级
  });

  it('startRoundSprint：forceQuiz 开 + quiz.ai truthy + AI 未配置 → 通知降级 + 普通复习', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await seedOverdue(vault);
    const app = makeApp(vault);
    setApp(app);
    (reviewApp as any).dataManager = new ReviewDataManager(app);
    setSettingsProvider(() => ({ forceQuizForReview: true, reviewDailyLimit: 0, reviewRThreshold: 0.9 } as any));
    const aiMod = await import('../../src/core/ai');
    vi.spyOn(aiMod, 'getAIProvider').mockRejectedValue(new Error('未配置 API Key'));
    const quizMod = await import('../../src/review/quiz-core');
    quizMod.ensureQuiz(app);
    quizMod.quizUI.ai = { ok: true } as any;
    const notifySpy = vi.spyOn(await import('../../src/core/notice'), 'notify');
    const loopSpy = vi.spyOn(reviewApp, 'reviewLoop').mockResolvedValue(undefined);
    const sessionSpy = vi.spyOn(reviewApp, 'runSprintSession').mockResolvedValue(undefined);
    await reviewApp.startRoundSprint();
    expect(notifySpy.mock.calls.some((c) => String(c[0]) === '做题家未初始化，已改用普通复习')).toBe(true);
    expect(loopSpy).toHaveBeenCalled();
    expect(sessionSpy).not.toHaveBeenCalled();
  });

  it('batchGenerateQuestions：quiz.ai truthy 但 AI 未配置 → 提示并返回 {}（守卫前置）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    const aiMod = await import('../../src/core/ai');
    vi.spyOn(aiMod, 'getAIProvider').mockRejectedValue(new Error('未配置 API Key'));
    const { store, quiz } = makeQuizMock();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (reviewApp as any)._quizOverride = quiz;
    const out = await reviewApp.batchGenerateQuestions([{ id: '1', filePath: 'A.md', name: 'A' } as any]);
    expect(out).toEqual({});
    expect(store.size).toBe(0); // 未清库未出题
    expect(warnSpy).toHaveBeenCalled();
    expect(getNoticeMessages()).toContain('做题家未初始化（缺少 AI），已改用普通复习');
  });
});

describe('F2：reviewLoop 防重入', () => {
  function mkRow(path: string): any {
    const now = new Date();
    return {
      id: path, filePath: path, name: path, reviewStart: now.toISOString(), stage: 0, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    };
  }

  function setupActiveLoop(paths: string[]) {
    const vault = new MockVault();
    for (const p of paths) vault.files.set(p, '正文');
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    (app.workspace as any).getActiveFile = () => ({ path: paths[0] });
    setApp(app);
    setSettingsProvider(() => ({ forceQuizForReview: false }) as any);
    return paths.map(mkRow);
  }

  it('连点「继续本轮」/复习中重开命令 → 拒绝 + notice，不产生双 interval', async () => {
    const items = setupActiveLoop(['A.md']);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await reviewApp.reviewLoop(items, 0);
    expect((reviewApp as any)._reviewLoops.size).toBe(1);
    clearNotices();
    await reviewApp.reviewLoop(items, 0); // 第二次进入（连点/重开命令）
    expect((reviewApp as any)._reviewLoops.size).toBe(1); // 不叠加
    expect(hasNotice('本轮复习已在进行')).toBe(true);
    // resumeRound（断点在，活动循环自己写入）走同一守卫
    reviewApp.resumeRound();
    expect((reviewApp as any)._reviewLoops.size).toBe(1);
    reviewApp.stopReviewLoops();
  });

  it('正常翻篇递归不受守卫影响：advance 先 clearLoop，续跑仍是单循环', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', 'x');
    vault.files.set('B.md', 'x');
    const nowMs = Date.now();
    const mk = (path: string, lastReviewed: string | null): any => ({
      id: path, filePath: path, name: path, reviewStart: new Date(nowMs).toISOString(), stage: 0, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(nowMs - 1000).toISOString(), lastReviewed, lastDifficulty: null, completed: false,
    });
    // A 已在 5s 前评级 → 首 tick 判完成 → advance（clearLoop）→ 递归进 B
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([mk('A.md', new Date(nowMs - 5000).toISOString()), mk('B.md', null)]));
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    (app.workspace as any).getActiveFile = () => ({ path: 'B.md' }); // 已在 B 上续跑
    setApp(app);
    setSettingsProvider(() => ({ forceQuizForReview: false }) as any);
    (reviewApp as any).dataManager = new ReviewDataManager(app);
    __setReviewAwayGraceMsForTests(120000);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
    const p = reviewApp.reviewLoop([mk('A.md', new Date(nowMs - 5000).toISOString()), mk('B.md', null)], 0);
    await vi.advanceTimersByTimeAsync(1100);
    expect((reviewApp as any)._reviewLoops.size).toBe(1); // 旧 interval 已清、新 interval 在账——无双循环
    reviewApp.stopReviewLoops();
    vi.useRealTimers();
    await expect(p).resolves.toBeUndefined();
  });
});

describe('F8：markReview 时间门禁移入队列内（并发双评级不双写）', () => {
  it('并发双评级 → 后写者队内复判被拒，历史/计数只写一次', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    // stage 7 阶梯：good → stage 8、排期 60d（未来日历日）——后写者队内读到即拒
    await seedOverdue(vault, { stage: 7 });
    const app = makeApp(vault);
    setApp(app);
    await Promise.all([
      reviewApp.markReview('A.md', 'good'),
      reviewApp.markReview('A.md', 'good'),
    ]);
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].totalReviews).toBe(1);
    expect(items[0].reviewHistory).toHaveLength(1);
    expect(items[0].stage).toBe(8); // 只有先写者生效（双写会是两次 +1 或排期互覆）
    expect(hasNotice(/还未到复习时间/)).toBe(true);
  });

  it('ReviewGateRejected 携带分钟数（外层转人话 notice 的载体）', () => {
    const e = new ReviewGateRejected(5);
    expect(e.message).toBe('还未到复习时间（5分钟后）');
  });

  it('未到期（未来日历日）单次评级 → 门禁在队内拒绝且不写盘（G1 语义保持）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    await seedOverdue(vault, { stage: 2, nextReviewDate: new Date(now.getTime() + 2 * 86400e3).toISOString() });
    const app = makeApp(vault);
    setApp(app);
    await reviewApp.markReview('A.md', 'good');
    const items = await new ReviewDataManager(app).loadItems();
    expect(items[0].stage).toBe(2); // 未变
    expect(items[0].totalReviews).toBe(0);
  });
});

describe('F9：vault modify 单文件染色复用快照', () => {
  function treeNode(path: string): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('data-path', path);
    const inner = document.createElement('div');
    inner.className = 'tree-item-inner';
    el.appendChild(inner);
    document.body.appendChild(el);
    return inner;
  }

  it('有快照 → 不再 loadItems；无快照 → 单次读盘；染色结果一致', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const now = new Date();
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
      {
        id: '1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 2, phase: 'ladder',
        stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
        nextReviewDate: new Date(now.getTime() + 5 * 3600000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
      },
    ]));
    const inner = treeNode('A.md');
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    (reviewApp as any).dataManager = dm;
    await reviewApp.applyReviewStyles(app); // 全量刷建立快照
    expect((reviewApp as any)._lastItems).not.toBeNull();
    expect(inner.style.color).toBe('rgb(24, 144, 255)');
    const loadSpy = vi.spyOn(dm, 'loadItems');
    await reviewApp.applyReviewStylesForFile(app, vault.file('A.md') as any);
    expect(loadSpy).not.toHaveBeenCalled(); // 复用快照，零读盘
    expect(inner.querySelector('.review-stage-badge')).not.toBeNull();
    (reviewApp as any)._lastItems = null;
    await reviewApp.applyReviewStylesForFile(app, vault.file('A.md') as any);
    expect(loadSpy).toHaveBeenCalledTimes(1); // 无快照才读盘一次
  });
});

describe('U9：reviewLoop 进度通知句柄验活', () => {
  it('死句柄（el 已断连）→ 重新 notify，不再把 setMessage 打在死句柄上', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    (app.workspace as any).getActiveFile = () => ({ path: 'A.md' });
    setApp(app);
    setSettingsProvider(() => ({ forceQuizForReview: false }) as any);
    const dead = { el: { isConnected: false }, setMessage: vi.fn(), setType: vi.fn(), hide: vi.fn() };
    (reviewApp as any)._reviewNotice = dead; // 预置死句柄（progress 通知已到期消失）
    const handle = { setType: vi.fn(), setMessage: vi.fn(), hide: vi.fn(), el: { isConnected: true } };
    const notifySpy = vi.spyOn(await import('../../src/core/notice'), 'notify').mockReturnValue(handle as any);
    __setReviewAwayGraceMsForTests(120000);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await reviewApp.reviewLoop([{ id: '1', filePath: 'A.md', name: 'A' } as any], 0);
    vi.useRealTimers();
    reviewApp.stopReviewLoops();
    expect(dead.setMessage).not.toHaveBeenCalled(); // 不再打在死句柄上
    expect(notifySpy).toHaveBeenCalledWith('复习中 (1/1): A', expect.objectContaining({ dedupeKey: 'review-loop' }));
    expect((reviewApp as any)._reviewNotice).toBe(handle); // 换存新句柄
  });
});
