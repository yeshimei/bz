/**
 * 划线卡的 AI 内容编排（review/card-ai.ts）。
 *
 * 这一层管的是「什么时候生成、生成几次」：加入计划时一次，之后固定；用户点
 * 「重新生成」才覆盖。钉住的重点是**跳过**——已有内容还去问模型，既慢又让
 * 题库漂移，复习就没法比较了。
 */
import { describe, expect, it, vi } from 'vitest';
import {
  cardModeOf,
  cardQuizRatioOf,
  ensureCardContent,
  queueCardPreparation,
  type CardPrepareContext,
} from '../../src/review/card-ai';
import type { ReviewCard } from '../../src/review/data';
import type { QuizQuestion } from '../../src/review/quiz-core/manager';

const baseCard: ReviewCard = {
  key: 'reader:b1:hl-1',
  bookTitle: '围城',
  chapterTitle: '第一章',
  text: '红海早过了，船在印度洋面上开驶着，但是太阳依然不饶人地迟落早起。',
};

function q(n: number): QuizQuestion {
  return { question: `第 ${n} 题`, options: ['a', 'b', 'c', 'd'], correctIndices: [0] };
}

/** 一套记录调用的假上下文 */
function ctx(over: Partial<CardPrepareContext> = {}) {
  const calls = {
    updateCard: vi.fn(async (_key: string, _patch: Partial<ReviewCard>) => true),
    saveQuiz: vi.fn(async (_key: string, _questions: QuizQuestion[]) => undefined),
    loadQuiz: vi.fn(async (_key: string) => null as QuizQuestion[] | null),
    loadCard: vi.fn(async (_key: string) => baseCard as ReviewCard | null),
    makeAI: vi.fn(() => null as any),
  };
  return {
    calls,
    ctx: {
      mode: 'flashcard',
      loadCard: calls.loadCard,
      updateCard: calls.updateCard,
      loadQuiz: calls.loadQuiz,
      saveQuiz: calls.saveQuiz,
      makeAI: calls.makeAI,
      ...over,
    } as CardPrepareContext,
  };
}

describe('设置读法', () => {
  it('没设过按抽认卡', () => {
    expect(cardModeOf({})).toBe('flashcard');
    expect(cardModeOf({ reviewCardMode: '乱写' })).toBe('flashcard');
  });

  it('认得出做题与展开全文', () => {
    expect(cardModeOf({ reviewCardMode: 'quiz' })).toBe('quiz');
    expect(cardModeOf({ reviewCardMode: 'plain' })).toBe('plain');
  });

  it('抽题比例钳在 2~4，脏值回三分之一', () => {
    expect(cardQuizRatioOf({ reviewCardQuizRatio: 2 })).toBe(2);
    expect(cardQuizRatioOf({ reviewCardQuizRatio: 9 })).toBe(4);
    expect(cardQuizRatioOf({ reviewCardQuizRatio: 0 })).toBe(3);
    expect(cardQuizRatioOf({})).toBe(3);
  });
});

describe('生成一次就够', () => {
  it('卡上已有问句就不再问模型', async () => {
    const { ctx: c, calls } = ctx();
    const card = { ...baseCard, qa: { q: '这段在说什么？', a: '原文', at: 1 } };
    expect(await ensureCardContent(card, c)).toBe(false);
    expect(calls.makeAI).not.toHaveBeenCalled();
  });

  it('没有问句就生成并写回卡上', async () => {
    const ai = { json: vi.fn(async () => '{"q":"这段在形容怎样的天气？","a":"原文"}') };
    const { ctx: c, calls } = ctx();
    c.makeAI = () => ai as any;
    expect(await ensureCardContent(baseCard, c)).toBe(true);
    expect(calls.updateCard).toHaveBeenCalledTimes(1);
    const [key, patch] = calls.updateCard.mock.calls[0] as any[];
    expect(key).toBe(baseCard.key);
    expect(patch.qa.q).toBe('这段在形容怎样的天气？');
  });

  it('模型给不出合格问句时什么都不写，卡片照常能用', async () => {
    const ai = { json: vi.fn(async () => '我不知道') };
    const { ctx: c, calls } = ctx();
    c.makeAI = () => ai as any;
    expect(await ensureCardContent(baseCard, c)).toBe(false);
    expect(calls.updateCard).not.toHaveBeenCalled();
  });

  it('已有题库时做题模式不再生成', async () => {
    const { ctx: c, calls } = ctx({ mode: 'quiz' });
    calls.loadQuiz.mockResolvedValue([q(1), q(2)]);
    expect(await ensureCardContent(baseCard, c)).toBe(false);
    expect(calls.makeAI).not.toHaveBeenCalled();
  });

  it('没有题库就生成一份存起来', async () => {
    const ai = { json: vi.fn(async () => JSON.stringify({ questions: [q(1), q(2), q(3)] })) };
    const { ctx: c, calls } = ctx({ mode: 'quiz' });
    c.makeAI = () => ai as any;
    expect(await ensureCardContent(baseCard, c)).toBe(true);
    expect(calls.saveQuiz).toHaveBeenCalledTimes(1);
    expect(calls.saveQuiz.mock.calls[0][1]).toHaveLength(3);
  });

  it('展开全文不碰模型', async () => {
    const { ctx: c, calls } = ctx({ mode: 'plain' });
    expect(await ensureCardContent(baseCard, c)).toBe(false);
    expect(calls.makeAI).not.toHaveBeenCalled();
  });

  it('重新生成时无视已有内容', async () => {
    const ai = { json: vi.fn(async () => '{"q":"换一个问法好不好？","a":"原文"}') };
    const { ctx: c, calls } = ctx();
    c.makeAI = () => ai as any;
    const card = { ...baseCard, qa: { q: '旧的', a: '原文', at: 1 } };
    expect(await ensureCardContent(card, c, true)).toBe(true);
    expect(calls.updateCard).toHaveBeenCalledTimes(1);
  });
});

describe('排队生成', () => {
  it('同一张卡连排两次只生成一遍', async () => {
    const { ctx: c, calls } = ctx({ mode: 'plain' });
    await queueCardPreparation(['k1', 'k1', 'k1'], c);
    expect(calls.loadCard).toHaveBeenCalledTimes(1);
  });

  it('空钥匙直接忽略', async () => {
    const { ctx: c, calls } = ctx();
    await queueCardPreparation(['', '  ', null as any], c);
    expect(calls.loadCard).not.toHaveBeenCalled();
  });

  it('一张出错不影响后面几张', async () => {
    const { ctx: c, calls } = ctx();
    calls.loadCard.mockImplementation(async (k: string) => {
      if (k === 'bad') throw new Error('读不出来');
      return { ...baseCard, key: k };
    });
    c.makeAI = () => ({ json: async () => '{"q":"这段在说什么呢？","a":"原文"}' }) as any;
    await queueCardPreparation(['bad', 'ok'], c);
    expect(calls.updateCard).toHaveBeenCalledTimes(1);
    expect((calls.updateCard.mock.calls[0] as any[])[0]).toBe('ok');
  });
});
