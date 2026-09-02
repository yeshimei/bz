// @vitest-environment jsdom
/**
 * 做题冲刺会话（sprint.ts）回归测试：
 *  - bug2：点选答案后反馈渲染停留在「刚答的题」，不得闪现下一题答案（cur 固化）
 *  - P0：答错本篇最后一题 → 出现「结束并结算」出口，不再卡死
 *  - 答对自动跳题 / 通过结算路径
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SprintSession, CORRECT_JUMP_DELAY_MS } from '../../src/review/sprint';
import type { ReviewItem } from '../../src/review/data';
import type { QuizQuestion } from '../../src/review/quiz-core/manager';

function mkItem(name: string, filePath: string): ReviewItem {
  return {
    id: name,
    filePath,
    name,
    reviewStart: new Date().toISOString(),
    stage: 5,
    phase: 'fsrs',
    stability: 10,
    difficulty: 0.5,
    reviewHistory: [],
    totalReviews: 1,
    averageConfidence: 0,
    nextReviewDate: new Date(Date.now() - 1000).toISOString(),
    lastReviewed: new Date(Date.now() - 3600_000).toISOString(),
    lastDifficulty: null,
    completed: false,
  } as ReviewItem;
}
function mkQ(question: string, correct: number[]): QuizQuestion {
  return { question, options: ['甲', '乙', '丙', '丁'], correctIndices: correct };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 组装一次会话（不自动 start），返回宿主/会话/结束 Promise */
function setup(opts: {
  queue: ReviewItem[];
  questionsOf: (item: ReviewItem) => Promise<QuizQuestion[]> | QuizQuestion[];
  quiz?: any;
}) {
  const host = document.createElement('div');
  const events: string[] = [];
  const session = new SprintSession({
    app: { vault: {} } as any,
    host,
    queue: opts.queue,
    mode: 'round',
    quiz: opts.quiz ?? null,
    fetchQuestions: async (item) => {
      const qs = await opts.questionsOf(item);
      return qs.length ? qs : null;
    },
    onPassed: async (item, rating) => {
      events.push(`passed:${item.name}:${rating}`);
    },
    onFailed: async (item, rating) => {
      events.push(`failed:${item.name}:${rating}`);
    },
    onExit: () => {
      events.push('exit');
    },
  } as any);
  const done = session.start();
  return { host, session, events, done };
}

const settled = (p: Promise<unknown>, ms = 600) =>
  Promise.race([p.then(() => 'done'), new Promise<string>((res) => setTimeout(() => res('UNSETTLED'), ms))]);

describe('sprint 答题时序（bug2 回归）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('点选答案后，反馈渲染的是刚答的题而非下一题（不闪现答案）', async () => {
    vi.useFakeTimers();
    const { host, session } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('第一题？', [0]), mkQ('第二题？', [3])],
    });
    await vi.advanceTimersByTimeAsync(30);

    // 点「乙」（第一题错误选项）
    const wrong = host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="1"]');
    expect(wrong).toBeTruthy();
    wrong!.click();
    await vi.advanceTimersByTimeAsync(30);

    // 反馈期：题干仍是第一题，正确答案是「甲」被标绿，错误选项「乙」标红
    const qtext = host.querySelector<HTMLElement>('.bz-sprint-qtext')!.textContent;
    expect(qtext).toBe('第一题？');
    const correctEl = host.querySelector('.bz-sprint-opt.is-correct');
    const wrongEl = host.querySelector('.bz-sprint-opt.is-wrong');
    expect(correctEl?.getAttribute('data-i')).toBe('0'); // 第一题的正确答案
    expect(wrongEl?.getAttribute('data-i')).toBe('1');
    // 下一题题干不得提前出现
    expect(host.innerHTML).not.toContain('第二题？');
    // 有「下一题」可点
    expect(host.querySelector('[data-action="next"]')).toBeTruthy();
  });

  it('答对自动跳题：0.8s 后进入下一题且答题态复位', async () => {
    vi.useFakeTimers();
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('第一题？', [0]), mkQ('第二题？', [3])],
    });
    await vi.advanceTimersByTimeAsync(30);
    host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="0"]')!.click(); // 答对
    await vi.advanceTimersByTimeAsync(CORRECT_JUMP_DELAY_MS + 60);

    const qtext = host.querySelector<HTMLElement>('.bz-sprint-qtext')!.textContent;
    expect(qtext).toBe('第二题？');
    // 无残留正确/错误标记与 disabled
    expect(host.querySelector('.bz-sprint-opt.is-correct')).toBeFalsy();
    expect(host.querySelector('.bz-sprint-opt.is-wrong')).toBeFalsy();
    expect(host.querySelector('.bz-sprint-opt:disabled')).toBeFalsy();
  });

  it('答错本篇最后一题 → 出现「结束并结算」按钮（P0 死局修复）', async () => {
    vi.useFakeTimers();
    const { host, events, done } = setup({
      queue: [mkItem('单篇', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await vi.advanceTimersByTimeAsync(30);
    host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="1"]')!.click(); // 答错（唯一题）
    await vi.advanceTimersByTimeAsync(30);

    const settle = host.querySelector<HTMLElement>('[data-action="note"]');
    expect(settle).toBeTruthy(); // 不再无出口
    settle!.click();
    await vi.advanceTimersByTimeAsync(60);

    // 未通过 → onFailed（评级 again/hard）→ 会话 fail 结束 + exit
    expect(events.some((e) => e.startsWith('failed:单篇'))).toBe(true);
    const st = await settled(done);
    expect(st).toBe('done');
    expect(events).toContain('exit');
  });

  it('全答对 → 通过 → 结果卡 → 完成回面板', async () => {
    vi.useFakeTimers();
    const { host, events, done } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await vi.advanceTimersByTimeAsync(30);
    host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="0"]')!.click(); // 答对
    await vi.advanceTimersByTimeAsync(CORRECT_JUMP_DELAY_MS + 60);
    // 结果卡（通过态）
    expect(host.querySelector('.bz-result')).toBeTruthy();
    expect(host.innerHTML).toContain('自动评级');
    host.querySelector<HTMLElement>('[data-action="next"]')!.click();
    await vi.advanceTimersByTimeAsync(30);
    // 无剩余 → 结算屏
    expect(host.querySelector('.bz-summary')).toBeTruthy();
    host.querySelector<HTMLElement>('[data-action="done"]')!.click();
    await vi.advanceTimersByTimeAsync(30);
    const st = await settled(done);
    expect(st).toBe('done');
    expect(events.some((e) => e.startsWith('passed:笔记'))).toBe(true);
    expect(events).toContain('exit');
  });
});
