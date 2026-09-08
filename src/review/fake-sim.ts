/**
 * 复习计划行为单源 · sim 启动入口（issue 253/ADR-0106）
 *
 * 评审壳侧启动器：把真行为层（ui.ts/sprint.ts/app.ts/quiz-core 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（core/storage 的 jsonFileStore 真实现跑在 fake vault 上——
 *     读改写/留档/写队列全真，只把「文件系统」换成 localStorage，见 fake/fake-obsidian.ts）；
 *   - 种子数据：window.RVW.SEED（prototype.html 注入，真实 vault 复习条目扩写 + 真实 quiz 题库
 *     节选；iframe 场景读 window.parent.RVW），首启写入 fake vault 的
 *     review.json / quiz.json / 文献盒/*.md（弗洛伊德篇刻意不落文件 = 挂起态演示）；
 *   - 设置注入：setSettingsProvider（真 settings-provider 实现可用，注入做题家默认值——
 *     forceQuizForReview 开 = 「开始本轮」走做题冲刺路径）；
 *   - 出题 AI：fake requestUrl 对出题请求回 canned 响应（题库回放），其余抛错降级。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_review，壳只调 bootReviewSim + openReviewPanel。
 * 插件的 ui.ts / sprint.ts / data.ts / app.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp, seedVaultFile } from './fake/fake-obsidian';
import { getApp, setApp } from '../core/app';
import { setSettingsProvider } from '../core/settings-provider';
import { ensureReview, openReviewPanel as openReviewPanelImpl, unloadReview } from './index';

declare global {
  interface Window {
    RVW?: {
      SEED?: {
        /** 复习条目（review.json 数组同构；日期由壳注入时按「当下」相对计算，演示永不过期） */
        reviewItems?: Array<Record<string, unknown>>;
        /** 题库（quiz.json 同构：notePath → 题目数组；亦作 fake requestUrl 的 canned 回放源） */
        quizBank?: Record<string, Array<{ question: string; options: string[]; correctIndices: number[]; explain?: string }>>;
        /** 笔记全文（文献盒/*.md；「弗洛伊德…」刻意缺文件 = 挂起演示） */
        notes?: Record<string, string>;
      };
    };
  }
}

const REVIEW_KEY = 'bz-sim:CONFIG/STORAGE/review.json';
const QUIZ_KEY = 'bz-sim:CONFIG/STORAGE/quiz.json';

function readStore(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function seedDatabase(): void {
  // 自身 window 优先（同文档场景）；iframe 场景读父页（评审壳持有 RVW）
  const src = window.RVW || ((window.parent as Window)?.RVW ?? null);
  const seed = src?.SEED || {};

  // 空缺或空数据都重新播种（无种子启动会把空态落库，卡死幂等播种成永久空面板）；
  // 非空数据视为用户改动，不覆盖——保持评审壳内操作可持久
  const review = readStore(REVIEW_KEY);
  if ((!Array.isArray(review) || review.length === 0) && seed.reviewItems?.length) {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(seed.reviewItems));
  }
  const quiz = readStore(QUIZ_KEY) as { notes?: Record<string, unknown[]> } | null;
  if ((!quiz?.notes || Object.keys(quiz.notes).length === 0) && seed.quizBank) {
    localStorage.setItem(QUIZ_KEY, JSON.stringify({ notes: seed.quizBank }));
  }
  for (const [path, content] of Object.entries(seed.notes || {})) {
    const key = 'bz-sim:' + path;
    if (!localStorage.getItem(key)) seedVaultFile(path, content, Date.now());
  }
  // 无条件注入 app（core/storage 的 jsonFileStore 经 getApp() 取——每次启动都要可用）。
  // FakeApp 只实现 vault/workspace/metadataCache 的消费面；类型断言收敛处同 belongings 域。
  setApp(new FakeApp() as never);
}

/** 默认设置（键与插件 data.json 同形）：做题家全开 = 「开始本轮/点到期卡」走做题冲刺 */
function injectSettings(): void {
  setSettingsProvider(
    () =>
      ({
        storagePath: 'CONFIG/STORAGE',
        forceQuizForReview: true,
        enableMultipleChoice: true,
        questionsPerNote: '',
        shuffleQuestions: true,
        reviewRThreshold: 0.9,
        reviewDailyLimit: 0,
        watchFolders: [],
      }) as never
  );
}

/** 壳入口：一次性启动（种子 + 注入；幂等） */
export function bootReviewSim(): void {
  const g = window as unknown as { __bzReviewSimBooted?: boolean };
  if (g.__bzReviewSimBooted) return;
  g.__bzReviewSimBooted = true;
  seedDatabase();
  injectSettings();
}

/** 壳入口：打开复习面板（ensureReview 幂等建 UI + showMain；app 取自 core/app 注入单例） */
export function openReviewPanel(): void {
  openReviewPanelImpl(getApp() as never);
}

export { ensureReview, unloadReview };
