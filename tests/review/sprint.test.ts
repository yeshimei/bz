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
  /** 模拟 onPassed 返回写盘后的真实排期（默认不返回 → 结果卡用快照回退） */
  onPassedNextReviewAt?: string;
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
      return opts.onPassedNextReviewAt;
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
    const ratingEl = host.querySelector('.bz-result-rating');
    expect(ratingEl).toBeTruthy();
    expect(ratingEl!.textContent).toContain('轻松'); // 全对 → 自动评级 easy
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

  it('结果卡「下次」用 onPassed 返回的真实排期（非快照固定值）', async () => {
    vi.useFakeTimers();
    const in3d = new Date(Date.now() + 3 * 86400_000).toISOString();
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
      onPassedNextReviewAt: in3d,
    });
    await vi.advanceTimersByTimeAsync(30);
    host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="0"]')!.click(); // 答对
    await vi.advanceTimersByTimeAsync(CORRECT_JUMP_DELAY_MS + 60);
    const ratingEl = host.querySelector('.bz-result-rating');
    expect(ratingEl!.textContent).toContain('3 天后');
    expect(ratingEl!.textContent).not.toContain('1 天后');
  });

  it('P3 回归：redo 通过 → 结果卡「已解除待重做」，不回退快照旧排期', async () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    const events: string[] = [];
    const passedSpy = vi.fn(async () => undefined); // redo onPassed 不返回排期（仅清标记）
    const session = new SprintSession({
      app: { vault: {} } as any,
      host,
      queue: [mkItem('重做篇', 'r.md')],
      mode: 'redo',
      quiz: null,
      fetchQuestions: async () => [mkQ('唯一题？', [0])],
      onPassed: passedSpy,
      onFailed: async () => {
        events.push('failed');
      },
      onExit: () => {
        events.push('exit');
      },
    } as any);
    const done = session.start();
    await vi.advanceTimersByTimeAsync(30);
    host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="0"]')!.click(); // 答对
    await vi.advanceTimersByTimeAsync(CORRECT_JUMP_DELAY_MS + 60);
    expect(passedSpy).toHaveBeenCalledTimes(1); // 通过回调执行（清 pendingRedo）
    const ratingEl = host.querySelector('.bz-result-rating')!;
    expect(ratingEl.textContent).toContain('已解除待重做');
    // 快照 nextReviewDate 为过去时点，回退旧值会展示「1 天后」——不得出现
    expect(ratingEl.textContent).not.toContain('天后');
    expect(ratingEl.textContent).not.toContain('下次');
  });
});

describe('sprint 键盘答题（item 2）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const press = (key: string): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  };

  it('1-4 / a-d 答题（与点击同语义）', async () => {
    vi.useFakeTimers();
    const { host, events } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await vi.advanceTimersByTimeAsync(30);
    press('2'); // 乙（错）
    await vi.advanceTimersByTimeAsync(30);
    expect(host.querySelector('.bz-sprint-opt.is-wrong')).toBeTruthy(); // 键盘选择生效
    expect(host.querySelector('[data-action="note"]')).toBeTruthy(); // 唯一题答错 → 「结束并结算」出口
    press('Enter'); // 答错唯一题 → Enter=结束并结算
    await vi.advanceTimersByTimeAsync(60);
    expect(events.some((e) => e.startsWith('failed:笔记'))).toBe(true);
  });

  it('a-d 字母键答题；答对自动跳后 Enter 不抢跑', async () => {
    vi.useFakeTimers();
    const { host, events } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [3])],
    });
    await vi.advanceTimersByTimeAsync(30);
    press('d'); // 丁（对）
    await vi.advanceTimersByTimeAsync(30);
    expect(host.querySelector('.bz-sprint-opt.is-correct')).toBeTruthy();
    press('Enter'); // 答对自动跳在途 → Enter 无效
    await vi.advanceTimersByTimeAsync(20);
    expect(host.querySelector('.bz-result')).toBeFalsy(); // 还没到结果卡
    await vi.advanceTimersByTimeAsync(CORRECT_JUMP_DELAY_MS + 60); // 0.8s 自动进结果卡
    expect(host.querySelector('.bz-result')).toBeTruthy();
    expect(events.some((e) => e.startsWith('passed:笔记'))).toBe(true);
  });

  it('输入框聚焦时按键跳过（不劫持打字）', async () => {
    vi.useFakeTimers();
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await vi.advanceTimersByTimeAsync(30);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true })); // 目标=输入框
    await vi.advanceTimersByTimeAsync(30);
    expect(host.querySelector('.bz-sprint-opt.is-correct')).toBeFalsy(); // 未答题
    expect(host.querySelector('.bz-sprint-opt.is-sel')).toBeFalsy();
  });

  it('多选：数字键勾选/取消，Enter 提交判定', async () => {
    vi.useFakeTimers();
    const { host, events, done } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('多选题？', [0, 2])],
    });
    await vi.advanceTimersByTimeAsync(30);
    press('1');
    press('3'); // 勾 0、2（全对组合）
    await vi.advanceTimersByTimeAsync(30);
    expect(host.querySelectorAll('.bz-sprint-opt.is-sel').length).toBe(2);
    press('3'); // 再按取消勾
    await vi.advanceTimersByTimeAsync(30);
    expect(host.querySelectorAll('.bz-sprint-opt.is-sel').length).toBe(1);
    press('3'); // 重新勾上
    press('Enter'); // 提交
    await vi.advanceTimersByTimeAsync(CORRECT_JUMP_DELAY_MS + 60);
    expect(host.querySelector('.bz-result')).toBeTruthy(); // 全对 → 结果卡
    expect(events.some((e) => e.startsWith('passed:笔记'))).toBe(true);
    press('Enter'); // 结果卡 Enter = 下一篇/结算
    await vi.advanceTimersByTimeAsync(60);
    expect(host.querySelector('.bz-summary')).toBeTruthy();
    press('Enter'); // 结算屏 Enter = 完成
    expect(await settled(done)).toBe('done');
  });

  it('会话 finish 后注销监听：再按 Enter/数字键无效果', async () => {
    vi.useFakeTimers();
    const { events, done } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await vi.advanceTimersByTimeAsync(30);
    press('1'); // 答对
    await vi.advanceTimersByTimeAsync(CORRECT_JUMP_DELAY_MS + 60);
    press('Enter'); // 结果卡 → 结算
    await vi.advanceTimersByTimeAsync(60);
    press('Enter'); // 结算 → finish
    expect(await settled(done)).toBe('done');
    const calls = events.length;
    press('Enter');
    press('1');
    await vi.advanceTimersByTimeAsync(60);
    expect(events.length).toBe(calls); // 注销后无新事件
  });
});

describe('sprint 跳过此篇（item 7）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('头行 skip 钮：该篇回 pending 移到队尾，不评级不写盘，继续下一篇', async () => {
    vi.useFakeTimers();
    const { host, events } = setup({
      queue: [mkItem('甲', 'a.md'), mkItem('乙', 'b.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await vi.advanceTimersByTimeAsync(30);
    // 头行有跳过钮（skip-forward 图标占位已被 uiIcon 替换为 data-icon）
    const skipBtn = host.querySelector<HTMLElement>('[data-action="skip"]')!;
    expect(skipBtn).toBeTruthy();
    skipBtn.click();
    await vi.advanceTimersByTimeAsync(60);
    // 甲未被评级（无 passed/failed），乙接续开做
    expect(events.filter((e) => e.startsWith('passed') || e.startsWith('failed'))).toHaveLength(0);
    expect(host.querySelector('.bz-sprint-qtext')!.textContent).toBe('唯一题？'); // 乙的题面
    // 队列顺序：乙 doing，甲回队尾 pending
    const names = [...host.querySelectorAll('.bz-sq-item .nm')].map((e) => e.textContent);
    expect(names[0]).toContain('乙');
    expect(names[1]).toContain('甲');
  });

  it('仅剩被跳篇自身 pending → 跳过直接结算（防自环），且不评级', async () => {
    vi.useFakeTimers();
    const { host, events, done } = setup({
      queue: [mkItem('单篇', 'a.md'), mkItem('乙', 'b.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await vi.advanceTimersByTimeAsync(30);
    host.querySelector<HTMLElement>('[data-action="skip"]')!.click(); // 甲 → 队尾
    await vi.advanceTimersByTimeAsync(60);
    host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="0"]')!.click(); // 乙答对
    await vi.advanceTimersByTimeAsync(CORRECT_JUMP_DELAY_MS + 60);
    host.querySelector<HTMLElement>('[data-action="next"]')!.click(); // 下一篇 = 甲（回跳）
    await vi.advanceTimersByTimeAsync(60);
    host.querySelector<HTMLElement>('[data-action="skip"]')!.click(); // 再跳（仅剩自己）→ 结算
    await vi.advanceTimersByTimeAsync(60);
    expect(host.querySelector('.bz-summary')).toBeTruthy();
    expect(events.some((e) => e.startsWith('passed:单篇') || e.startsWith('failed:单篇'))).toBe(false);
    host.querySelector<HTMLElement>('[data-action="done"]')!.click();
    expect(await settled(done)).toBe('done');
  });
});

describe('sprint 答错一行解析（item 3）与结算 streak（item 8）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('答错渲染 explain 一行；答对/无 explain 不渲染', async () => {
    vi.useFakeTimers();
    const withExplain = { ...mkQ('第一题？', [0]), explain: '原文第二节：甲为正确表述' };
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [withExplain, mkQ('第二题？', [1])],
    });
    await vi.advanceTimersByTimeAsync(30);
    expect(host.querySelector('.bz-sprint-explain')).toBeFalsy(); // 未答不显示
    host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="1"]')!.click(); // 答错
    await vi.advanceTimersByTimeAsync(30);
    const ex = host.querySelector('.bz-sprint-explain');
    expect(ex).toBeTruthy();
    expect(ex!.textContent).toContain('原文第二节');
    // 下一题答对 → 无解析行
    host.querySelector<HTMLElement>('[data-action="next"]')!.click();
    await vi.advanceTimersByTimeAsync(30);
    host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="1"]')!.click(); // 对
    await vi.advanceTimersByTimeAsync(CORRECT_JUMP_DELAY_MS + 60);
    expect(host.querySelector('.bz-sprint-explain')).toBeFalsy();
  });

  it('存量题无 explain 字段 → 答错静默不显示（零迁移）', async () => {
    vi.useFakeTimers();
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await vi.advanceTimersByTimeAsync(30);
    host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="1"]')!.click();
    await vi.advanceTimersByTimeAsync(30);
    expect(host.querySelector('.bz-sprint-explain')).toBeFalsy();
  });

  it('结算屏追加「连续 N 天」（streakDays>0）；0/缺省不显示', async () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    const session = new SprintSession({
      app: { vault: {} } as any,
      host,
      queue: [mkItem('笔记', 'n.md')],
      mode: 'round',
      quiz: null,
      streakDays: 3,
      fetchQuestions: async () => [mkQ('唯一题？', [0])],
      onPassed: async () => undefined,
      onFailed: async () => {},
      onExit: () => {},
    } as any);
    const done = session.start();
    await vi.advanceTimersByTimeAsync(30);
    host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="0"]')!.click();
    await vi.advanceTimersByTimeAsync(CORRECT_JUMP_DELAY_MS + 60);
    host.querySelector<HTMLElement>('[data-action="next"]')!.click();
    await vi.advanceTimersByTimeAsync(60);
    const streak = host.querySelector('.bz-summary-streak');
    expect(streak).toBeTruthy();
    expect(streak!.textContent).toContain('连续复习');
    expect(streak!.textContent).toContain('3');
    host.querySelector<HTMLElement>('[data-action="done"]')!.click();
    expect(await settled(done)).toBe('done');
  });
});
