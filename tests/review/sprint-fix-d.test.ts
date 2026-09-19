// @vitest-environment jsdom
/**
 * review 域深审批 D（冲刺会话与渲染层）回归钉死：
 *  - U1：放弃确认框在途——document 层键盘路由挂起（Enter 不吞按钮原生 click、不穿透题面；
 *    数字键不作答），settle 后恢复；顺带 BUTTON target 排除（对齐 quiz-core/session.ts:288）
 *  - U2：loading 中「跳过此篇」双 runNext 竞态——runSeq 发号守卫，旧篇取题返回不顶掉新篇/结算屏
 *  - F4：结果卡「下次 N 后」天/小时/分钟口径与 dueLabelOf 单源（futureInLabel），短间隔不再恒「1 天后」
 *  - A6/C5：评级中文名单源 stats.RATING_NAMES（「简单」），结果卡/评级条不再「轻松」漂移
 *  - C9：删除题目失败提示走 notifyActionError 单源
 *  - U7：未通过无结果卡（死分支已删）——通过结果卡无 note/danger 出口
 *  - U11：做题练习 note 单篇未选笔记 meta 引导文案
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';import { SprintSession, CORRECT_JUMP_DELAY_MS } from '../../src/review/sprint';
import { reviewBarHtml, quizPracticeSetupHtml } from '../../src/review/render';
import type { ReviewItem } from '../../src/review/data';
import type { QuizQuestion } from '../../src/review/quiz-core/manager';

// U1：flow-dialog 换受控 deferred（确认框在途/放行节奏由测试驱动）
vi.mock('../../src/core/flow-dialog', () => ({
  openFlowDialog: vi.fn(
    () =>
      new Promise<string | undefined>((resolve) => {
        (globalThis as any).__bzDialogResolve = resolve;
      })
  ),
}));

// C9：通知单源换成 spy（notice 静音，notifyActionError 断言）
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return { ...actual, notice: vi.fn(), notifyActionError: vi.fn() };
});

import { openFlowDialog } from '../../src/core/flow-dialog';
import { notifyActionError } from '../../src/core/notice';

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

/** 组装一次会话（不自动 start）；fetchQuestions 受控 deferred（U2 用的挂起取题） */
function setup(opts: {
  queue: ReviewItem[];
  questionsOf?: (item: ReviewItem) => QuizQuestion[];
  /** 挂起式取题：每次调用入 pending，由测试手动 resolve（U2 竞态驱动） */
  holdFetch?: boolean;
  quiz?: any;
  onPassedNextReviewAt?: string;
}) {
  const host = document.createElement('div');
  const events: string[] = [];
  const pending: Array<{ item: string; resolve: (q: QuizQuestion[] | null) => void }> = [];
  const session = new SprintSession({
    app: { vault: {} } as any,
    host,
    queue: opts.queue,
    mode: 'round',
    quiz: opts.quiz ?? null,
    fetchQuestions: async (item) => {
      if (opts.holdFetch) {
        return new Promise<QuizQuestion[] | null>((resolve) => {
          pending.push({ item: item.name, resolve });
        });
      }
      const qs = opts.questionsOf ? opts.questionsOf(item) : [mkQ(`${item.name}题？`, [0])];
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
  return { host, session, events, done, pending };
}

const settled = (p: Promise<unknown>, ms = 600) =>
  Promise.race([p.then(() => 'done'), new Promise<string>((res) => setTimeout(() => res('UNSETTLED'), ms))]);

/** 正常通过当前篇走到结果卡（单题全对 → 0.8s 自动跳 → 结果卡） */
async function passToResult(host: HTMLElement, timers: { advance: (ms: number) => Promise<unknown> }): Promise<void> {
  host.querySelector<HTMLElement>('.bz-sprint-opt[data-i="0"]')!.click(); // 答对
  await timers.advance(CORRECT_JUMP_DELAY_MS + 60);
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  delete (globalThis as any).__bzDialogResolve;
});

describe('U1 · 放弃确认框在途：键盘路由挂起', () => {
  const press = (key: string): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  };
  const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  it('确认框在途：Enter 不交卷、数字键不勾选；「继续做题」settle 后键盘恢复', async () => {
    vi.useFakeTimers();
    // 多选题：先勾 1 项，再弹确认框——若键盘穿透，Enter 会直接交卷判错
    const { host, session } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('多选题？', [0, 2])],
    });
    await advance(30);
    press('1');
    await advance(30);
    expect(host.querySelectorAll('.bz-sprint-opt.is-sel').length).toBe(1); // 已勾 1 项

    session.requestQuit();
    await advance(30);
    expect(openFlowDialog).toHaveBeenCalledTimes(1); // 确认框已弹出

    press('Enter'); // 旧缺陷：preventDefault 吞按钮原生 click + submitMulti 直接交卷
    await advance(30);
    expect(host.querySelector('.bz-sprint-opt.is-disabled')).toBeFalsy(); // 未被交卷（answered 未置位）
    press('2'); // 旧缺陷：数字键穿透继续勾选
    await advance(30);
    expect(host.querySelectorAll('.bz-sprint-opt.is-sel').length).toBe(1); // 勾选未变

    // settle：「继续做题」（value cancel）→ 确认框收、键盘恢复
    (globalThis as any).__bzDialogResolve('cancel');
    await advance(30);
    press('2');
    await advance(30);
    expect(host.querySelectorAll('.bz-sprint-opt.is-sel').length).toBe(2); // 恢复作答
  });

  it('确认框在途：再按 ESC/重复 requestQuit 不重入弹第二只框', async () => {
    vi.useFakeTimers();
    const { session } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await advance(30);
    session.requestQuit();
    await advance(30);
    session.requestQuit();
    session.requestQuit();
    await advance(30);
    expect(openFlowDialog).toHaveBeenCalledTimes(1);
  });

  it('G2 顺带：BUTTON target 排除——焦点在头行按钮上 Enter 由原生 click 接管，document 层不抢路由', async () => {
    vi.useFakeTimers();
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await advance(30);
    // Enter 派发在 skip 按钮（BUTTON）上：document 层须忽略（不 preventDefault 不作答不跳过）
    const skipBtn = host.querySelector<HTMLElement>('[data-action="skip"]')!;
    skipBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await advance(30);
    expect(host.querySelector('.bz-sprint-opt.is-correct')).toBeFalsy(); // 未被数字键/Enter 路由作答
    expect(host.querySelector('.bz-sprint-qtext')).toBeTruthy(); // 仍是题面（未被 skip 打进 loading）
  });
});

describe('U2 · loading 中「跳过此篇」：发号守卫不串篇', () => {
  const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  it('取题中跳到下一篇：旧篇 fetch 返回被丢弃，题面/计数都归新篇', async () => {
    vi.useFakeTimers();
    const { host, events, done, pending } = setup({
      queue: [mkItem('甲', 'a.md'), mkItem('乙', 'b.md')],
      holdFetch: true,
    });
    await advance(30);
    expect(host.querySelector('.bz-sprint-loading')).toBeTruthy(); // 甲取题中
    host.querySelector<HTMLElement>('[data-action="skip"]')!.click(); // loading 态跳过：甲回队尾，乙开做
    await advance(30);
    expect(pending.length).toBe(2); // 第二次取题（乙）已发号

    // 旧篇（甲）fetch 此刻才返回：发号失配 → 整体丢弃
    pending[0].resolve([mkQ('甲的题？', [0])]);
    await advance(30);
    expect(host.querySelector('.bz-sprint-loading')).toBeTruthy(); // 仍在乙的 loading，未被旧篇题面顶掉
    expect(host.innerHTML).not.toContain('甲的题');

    // 乙 fetch 返回 → 正常开做乙
    pending[1].resolve([mkQ('乙的题？', [0])]);
    await advance(30);
    expect(host.querySelector<HTMLElement>('.bz-sprint-qtext')!.textContent).toBe('乙的题？');
    await passToResult(host, { advance });
    expect(host.querySelector<HTMLElement>('.bz-result-name')!.textContent).toBe('乙'); // 结果卡是乙不是甲
    expect(events.some((e) => e.startsWith('passed:乙'))).toBe(true);

    // 甲（队尾）回跳后照常可做——跳过能力保留，不因守卫失效
    host.querySelector<HTMLElement>('[data-action="next"]')!.click();
    await advance(30);
    pending[2].resolve([mkQ('甲的题？', [0])]);
    await advance(30);
    expect(host.querySelector<HTMLElement>('.bz-sprint-qtext')!.textContent).toBe('甲的题？');
    await passToResult(host, { advance });
    host.querySelector<HTMLElement>('[data-action="next"]')!.click(); // 无剩余 → 结算
    await advance(30);
    expect(host.querySelector('.bz-summary')).toBeTruthy();
    host.querySelector<HTMLElement>('[data-action="done"]')!.click();
    expect(await settled(done)).toBe('done');
    expect(events.filter((e) => e.startsWith('passed'))).toEqual(['passed:乙:easy', 'passed:甲:easy']); // 计数未串篇
  });

  it('取题中跳过仅剩自身：结算屏不被旧篇 fetch 返回的题面顶掉', async () => {
    vi.useFakeTimers();
    const { host, events, done, pending } = setup({
      queue: [mkItem('单篇', 'a.md')],
      holdFetch: true,
    });
    await advance(30);
    host.querySelector<HTMLElement>('[data-action="skip"]')!.click(); // 仅剩自己 → 直接结算
    await advance(30);
    expect(host.querySelector('.bz-summary')).toBeTruthy();

    pending[0].resolve([mkQ('旧篇的题？', [0])]); // 旧 fetch 迟到
    await advance(30);
    expect(host.querySelector('.bz-summary')).toBeTruthy(); // 结算屏仍在
    expect(host.querySelector('.bz-sprint-qtext')).toBeFalsy(); // 未被题面顶掉
    expect(events.some((e) => e.startsWith('passed') || e.startsWith('failed'))).toBe(false); // 不评级

    host.querySelector<HTMLElement>('[data-action="done"]')!.click();
    expect(await settled(done)).toBe('done');
  });
});

describe('F4 · 结果卡「下次 N 后」天/小时/分钟单源口径', () => {
  const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  it('分钟级间隔展示「N 分钟后」，不再恒「1 天后」', async () => {
    vi.useFakeTimers();
    const in30m = new Date(Date.now() + 30 * 60_000 + 59_000).toISOString();
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
      onPassedNextReviewAt: in30m,
    });
    await advance(30);
    await passToResult(host, { advance });
    const rating = host.querySelector('.bz-result-rating')!;
    expect(rating.textContent).toContain('30 分钟后');
    expect(rating.textContent).not.toContain('1 天后');
  });

  it('小时级间隔展示「N 小时后」', async () => {
    vi.useFakeTimers();
    const in5h = new Date(Date.now() + 5 * 3600_000 + 60_000).toISOString();
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
      onPassedNextReviewAt: in5h,
    });
    await advance(30);
    await passToResult(host, { advance });
    expect(host.querySelector('.bz-result-rating')!.textContent).toContain('5 小时后');
  });

  it('排期已过（diff<=0）回退「已排期」，不展示负数假间隔', async () => {
    vi.useFakeTimers();
    const past = new Date(Date.now() - 60_000).toISOString();
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
      onPassedNextReviewAt: past,
    });
    await advance(30);
    await passToResult(host, { advance });
    expect(host.querySelector('.bz-result-rating')!.textContent).toContain('已排期');
  });
});

describe('A6/C5 + U7 · 结果卡与评级条', () => {
  const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  it('评级名单源「简单」：结果卡与悬浮评级条一致，全仓无「轻松」', async () => {
    vi.useFakeTimers();
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await advance(30);
    await passToResult(host, { advance });
    const rating = host.querySelector('.bz-result-rating')!;
    expect(rating.textContent).toContain('简单'); // A6：easy 与 stats.RATING_NAMES 单源
    expect(rating.textContent).not.toContain('轻松');
  });

  it('U7：通过结果卡无「复习此笔记」note/danger 出口（死分支已删）', async () => {
    vi.useFakeTimers();
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      questionsOf: () => [mkQ('唯一题？', [0])],
    });
    await advance(30);
    await passToResult(host, { advance });
    expect(host.querySelector('[data-action="note"]')).toBeFalsy(); // 结果卡无 note 按钮（题面「结束并结算」不受影响）
    expect(host.querySelector('.bz-btn--danger')).toBeFalsy();
    expect(host.querySelector('[data-action="next"]')).toBeTruthy(); // 主出口仍在
  });

  it('reviewBarHtml 评级条文案与 stats 单源一致（简单/一般/困难/忘了）', () => {
    const html = reviewBarHtml({ name: '某笔记', index: 1, total: 3 });
    expect(html).toContain('简单');
    expect(html).not.toContain('轻松');
    for (const n of ['忘了', '困难', '一般', '跳过']) expect(html).toContain(n);
  });
});

describe('C9 · 删除题目失败提示单源', () => {
  it('removeQuestion 抛错 → notifyActionError(e, 「删除题目」)，自动跳题不阻断', async () => {
    vi.useFakeTimers();
    const quiz = {
      manager: {
        removeQuestion: vi.fn(async () => {
          throw new Error('题库写坏');
        }),
      },
    };
    const { host } = setup({
      queue: [mkItem('笔记', 'n.md')],
      // notePath 在题上：removeQuestionPersist 仅对带 notePath 的题持久化出库
      questionsOf: () => [{ ...mkQ('唯一题？', [0]), notePath: 'n.md' }],
      quiz,
    });
    const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);
    await advance(30);
    await passToResult(host, { advance });
    expect(quiz.manager.removeQuestion).toHaveBeenCalledTimes(1);
    expect(notifyActionError).toHaveBeenCalledTimes(1);
    expect((notifyActionError as any).mock.calls[0][1]).toBe('删除题目');
    expect(host.querySelector('.bz-result')).toBeTruthy(); // 失败不阻断流程
  });
});

describe('U11 · 做题练习 note 单篇空路径 meta 引导', () => {
  it('scope=note 未选笔记 → 「先选择一篇笔记再看题量」（对齐 folder 空名单先例）', () => {
    const html = quizPracticeSetupHtml({ scope: 'note', batch: 10, folders: [], notePath: '', bankCount: 0 });
    expect(html).toContain('先选择一篇笔记再看题量');
    expect(html).not.toContain('当前范围现有');
  });

  it('已选笔记 → 正常题量 meta，不显示引导', () => {
    const html = quizPracticeSetupHtml({ scope: 'note', batch: 10, folders: [], notePath: 'a.md', bankCount: 3 });
    expect(html).toContain('当前范围现有 <b>3</b> 题');
    expect(html).not.toContain('先选择一篇笔记');
  });
});
