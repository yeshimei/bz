/**
 * review 域「全域深审拍板后修复批」Wave1 · 编排层回归（bd-review-fix-* 独立命名防撞）：
 *  - 呈报#4（R2）：整轮复习进行中发起单条做题 → 拦截并提示（拍板取「提示版」，不自动收旧轮）；
 *    对称面：单条冲刺进行中发起整轮复习 → 同口径提示（不再静默双轮并行）
 *  - 呈报#38（R3）：普通复习轮询降频 2.5s + 命中才读盘——review.json 的 stat.mtime
 *    未变化时不再每 tick 全量读盘（大库空耗降下来）；mtime 变化照常翻篇（行为语义不变）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeApp } from '../helpers/app';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  reviewApp, REVIEW_POLL_INTERVAL_MS, __setReviewAwayGraceMsForTests,
} from '../../src/review/app';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';

function row(path: string, partial: any = {}): any {
  const now = new Date();
  return {
    id: path, filePath: path, name: path,
    reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3,
    reviewHistory: [], totalReviews: 0, averageConfidence: 0,
    nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null,
    completed: false,
    ...partial,
  };
}

function seed(vault: MockVault, rows: any[]): void {
  vault.files.set(REVIEW_FILE_PATH, JSON.stringify(rows));
}

/** AI 就绪桩：getAIProvider 试准通过 + quiz 单例假题库（startSingleSprint 走做题路径的前置） */
async function stubAIReady(): Promise<void> {
  const aiMod = await import('../../src/core/ai');
  vi.spyOn(aiMod, 'getAIProvider').mockResolvedValue({ endpoint: 'http://localhost', apiKey: 'k' } as any);
  const store = new Map<string, any[]>([['A.md', [{ question: 'q', options: ['a', 'b'], correctIndices: [0] }]]]);
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
  (reviewApp as any)._quizOverride = quiz;
}

beforeEach(() => {
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  setSettingsProvider(() => ({ forceQuizForReview: false }) as any);
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
  document.body.innerHTML = '';
});

describe('呈报#4（R2）：轮次互斥时给提示（不再无声拦截）', () => {
  it('普通复习轮进行中发起单条做题 → 拦截提示，且不开第二个轮', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    (app.workspace as any).getActiveFile = () => ({ path: 'A.md' });
    setApp(app);
    seed(vault, [row('A.md')]);
    await stubAIReady();
    __setReviewAwayGraceMsForTests(120000);
    // 挂住一轮普通复习（不推进时间即不触发轮询/中断）
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await reviewApp.reviewLoop([row('A.md')], 0);
    expect(reviewApp._reviewLoops.size).toBe(1);

    await reviewApp.startSingleSprint(row('A.md'));

    expect(hasNotice('本轮复习进行中，先完成当前轮次再做单条')).toBe(true);
    expect(reviewApp._reviewLoops.size).toBe(1); // 不产生第二个轮
  });

  it('单条冲刺进行中发起整轮复习 → 拦截提示，且不开普通轮', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    (app.workspace as any).getActiveFile = () => ({ path: 'A.md' });
    setApp(app);
    seed(vault, [row('A.md')]);
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    // 真实 UIManager + 挂住的冲刺会话（fetch 永不 resolve → 会话停 loading 态）
    const idx = await import('../../src/review/index');
    idx.ensureReview(app);
    const ui = idx.uiManager!;
    void ui.startSprint({
      queue: [row('A.md')],
      mode: 'single',
      quiz: null,
      fetchQuestions: () => new Promise<any[] | null>(() => undefined),
      onPassed: async () => undefined,
      onFailed: async () => undefined,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(ui.inSprint).toBe(true);

    await reviewApp.startRoundSprint();

    expect(hasNotice('做题冲刺进行中，先结束当前会话再开始本轮')).toBe(true);
    expect(reviewApp._reviewLoops.size).toBe(0); // 未开普通轮
    // 收场：unloadReview 清首查 timer + 销毁挂住的会话 + 单例复位
    idx.unloadReview();
  });
});

describe('呈报#38（R3）：轮询降频 + 命中才读盘', () => {
  function makeLoopApp() {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    (app.workspace as any).getLeaf = () => ({ openFile: vi.fn().mockResolvedValue(undefined) });
    (app.workspace as any).getActiveFile = () => ({ path: 'A.md' });
    setApp(app);
    reviewApp.ensure(app);
    return { vault, app };
  }

  it('mtime 未变化 → 连续多 tick 只做一次全量读盘（大库空耗降下来）', async () => {
    const { vault } = makeLoopApp();
    seed(vault, [row('A.md')]);
    const dm = reviewApp.dataManager as ReviewDataManager;
    const spy = vi.spyOn(dm, 'loadItems');
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    void reviewApp.reviewLoop([row('A.md')], 0);

    await vi.advanceTimersByTimeAsync(REVIEW_POLL_INTERVAL_MS * 3 + 10);

    expect(spy.mock.calls.length).toBe(1); // 首 tick 建基线必读；此后 mtime 未变不再读
  });

  it('mtime 变化（别处评级写盘）→ 命中读盘照常翻篇（行为语义不变）', async () => {
    const { vault, app } = makeLoopApp();
    seed(vault, [row('A.md')]);
    // mtime 探测桩：stat.mtime 可控（mock vault 的 stat 恒定，真实 Obsidian 写盘后由系统刷新）
    let mtime = 1000;
    const orig = app.vault.getAbstractFileByPath.bind(app.vault);
    vi.spyOn(app.vault, 'getAbstractFileByPath').mockImplementation((p: string) => {
      if (p === REVIEW_FILE_PATH) return { path: p, stat: { mtime } } as any;
      return orig(p);
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
    const p = reviewApp.reviewLoop([row('A.md')], 0);
    await vi.advanceTimersByTimeAsync(REVIEW_POLL_INTERVAL_MS + 10);
    expect(reviewApp._reviewLoops.size).toBe(1); // 未评级：仍挂着

    // 别处评级：写盘（内容变）+ mtime 刷新 → 下一 tick 命中读盘 → lastReviewed 30s 内 → 翻篇
    seed(vault, [row('A.md', { lastReviewed: new Date().toISOString() })]);
    mtime = 2000;
    await vi.advanceTimersByTimeAsync(REVIEW_POLL_INTERVAL_MS + 10);

    vi.useRealTimers();
    await expect(p).resolves.toBeUndefined(); // 单篇队列翻篇即完成收尾
    expect((reviewApp as any)._pendingRound).toBeNull(); // 完成路径清断点
    expect(reviewApp._reviewLoops.size).toBe(0);
  });
});
