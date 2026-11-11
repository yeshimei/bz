/**
 * 划线卡的题库（review/card-quiz.ts）。
 *
 * 三条口径：
 *   · 题数跟着原文长短走——一句话的划线出 3 道，长段落出到 15 道封顶，
 *     不能不管多长都出一样的题量。
 *   · 题库一次生成、之后固定，每轮只抽三分之一——不抽的话每轮都是同一批
 *     题，第二次复习就是背选项。
 *   · 模型给的东西不可信：选项不是四个、正确项索引越界、整段不是 JSON，
 *     一律在解析这层挡掉，别让脏题进会话。
 */
import { describe, expect, it, vi } from 'vitest';
import {
  QUIZ_MAX,
  QUIZ_MIN,
  buildCardQuizPrompt,
  generateCardQuiz,
  parseCardQuiz,
  pickCardQuestions,
  quizCountFor,
} from '../../src/review/card-quiz';
import type { ReviewCard } from '../../src/review/data';
import type { QuizQuestion } from '../../src/review/quiz-core/manager';

const card: ReviewCard = {
  key: 'reader:b1:hl-1',
  bookTitle: '围城',
  chapterTitle: '第一章',
  text: '红海早过了，船在印度洋面上开驶着，但是太阳依然不饶人地迟落早起，侵占去大部分的夜。',
};

function q(n: number): QuizQuestion {
  return {
    question: `第 ${n} 题：这段在说什么？`,
    options: ['甲', '乙', '丙', '丁'],
    correctIndices: [0],
  };
}

describe('题数跟着长短走', () => {
  it('一句话的划线出 3 道', () => {
    expect(quizCountFor('她转过身')).toBe(QUIZ_MIN);
  });

  it('几百字的段子出到十道上下', () => {
    expect(quizCountFor('字'.repeat(200))).toBe(5);
    expect(quizCountFor('字'.repeat(400))).toBe(10);
  });

  it('再长也封顶 15 道', () => {
    expect(quizCountFor('字'.repeat(2000))).toBe(QUIZ_MAX);
  });

  it('空内容也给下限，不会出 0 道', () => {
    expect(quizCountFor('')).toBe(QUIZ_MIN);
    expect(quizCountFor('   ')).toBe(QUIZ_MIN);
  });
});

describe('提示词', () => {
  it('说清题数与「只输出 JSON」', () => {
    const p = buildCardQuizPrompt(card, 6);
    expect(p).toContain('6');
    expect(p).toContain('questions');
    expect(p).toContain('围城');
  });

  it('带上划线原文，题目才有内容可问', () => {
    expect(buildCardQuizPrompt(card, 3)).toContain('红海早过了');
  });
});

describe('解析模型回复', () => {
  it('正常返回四选一', () => {
    const reply = JSON.stringify({
      questions: [
        { question: '这段写了什么天气？', options: ['闷热', '寒冷', '下雨', '下雪'], correctIndices: [0], explain: '原文说太阳不饶人' },
      ],
    });
    const list = parseCardQuiz(reply, card);
    expect(list).toHaveLength(1);
    expect(list![0].question).toBe('这段写了什么天气？');
    expect(list![0].options).toHaveLength(4);
    expect(list![0].correctIndices).toEqual([0]);
    expect(list![0].explain).toContain('太阳');
  });

  it('包着代码块和前言也能取出来', () => {
    const reply = '好的，题目如下：\n```json\n{"questions":[{"question":"问了什么？","options":["a","b","c","d"],"correctIndices":[2]}]}\n```';
    expect(parseCardQuiz(reply, card)).toHaveLength(1);
  });

  it('选项不是四个的那道丢掉，其余保留', () => {
    const reply = JSON.stringify({
      questions: [
        { question: '好的题', options: ['a', 'b', 'c', 'd'], correctIndices: [1] },
        { question: '坏题', options: ['a', 'b'], correctIndices: [0] },
      ],
    });
    const list = parseCardQuiz(reply, card);
    expect(list).toHaveLength(1);
    expect(list![0].question).toBe('好的题');
  });

  it('正确项索引越界的那道丢掉', () => {
    const reply = JSON.stringify({
      questions: [
        { question: '越界题', options: ['a', 'b', 'c', 'd'], correctIndices: [7] },
        { question: '好的题', options: ['a', 'b', 'c', 'd'], correctIndices: [3] },
      ],
    });
    const list = parseCardQuiz(reply, card);
    expect(list).toHaveLength(1);
    expect(list![0].question).toBe('好的题');
  });

  it('多给的题按题数裁掉', () => {
    const reply = JSON.stringify({ questions: [1, 2, 3, 4, 5, 6].map((n) => q(n)) });
    expect(parseCardQuiz(reply, card, 4)).toHaveLength(4);
  });

  it('一道都不合格返回 null，不返回空数组', () => {
    expect(parseCardQuiz('模型胡言乱语', card)).toBeNull();
    expect(parseCardQuiz('{"questions":[]}', card)).toBeNull();
  });

  it('模型吐尾逗号（本地小模型常见）也能救回来', () => {
    /* 实测 Ollama 上的 qwen2.5 会写 ["A","B","C","D",] —— 严格解析整段失败 */
    const reply = '{"questions":[{"question":"这段写了什么？","options":["a","b","c","d",],"correctIndices":[1],}]}';
    const list = parseCardQuiz(reply, card);
    expect(list).toHaveLength(1);
    expect(list![0].options).toHaveLength(4);
    expect(list![0].correctIndices).toEqual([1]);
  });

  it('别的语法错误照样当失败，不硬猜', () => {
    expect(parseCardQuiz('{"questions":[{"question": "没写完', card)).toBeNull();
  });
});

describe('每轮只抽三分之一', () => {
  it('9 道抽 3 道', () => {
    const list = Array.from({ length: 9 }, (_, i) => q(i));
    expect(pickCardQuestions(list, 3)).toHaveLength(3);
  });

  it('3 道抽 1 道，1 道也给 1 道', () => {
    expect(pickCardQuestions(Array.from({ length: 3 }, (_, i) => q(i)), 3)).toHaveLength(1);
    expect(pickCardQuestions([q(1)], 3)).toHaveLength(1);
  });

  it('15 道抽 5 道', () => {
    expect(pickCardQuestions(Array.from({ length: 15 }, (_, i) => q(i)), 3)).toHaveLength(5);
  });

  it('抽出来的不重复', () => {
    const list = Array.from({ length: 12 }, (_, i) => q(i));
    const picked = pickCardQuestions(list, 3);
    expect(new Set(picked.map((x) => x.question)).size).toBe(picked.length);
  });

  it('空题库给空数组', () => {
    expect(pickCardQuestions([], 3)).toEqual([]);
  });
});

describe('生成', () => {
  it('没配 AI 返回 null，不抛', async () => {
    await expect(generateCardQuiz(card, () => null)).resolves.toBeNull();
  });

  it('模型抛错返回 null，不抛', async () => {
    const ai = { json: vi.fn().mockRejectedValue(new Error('网络断了')) } as any;
    await expect(generateCardQuiz(card, () => ai)).resolves.toBeNull();
  });

  it('拿到合格回复就返回题目', async () => {
    const ai = {
      json: vi.fn().mockResolvedValue(JSON.stringify({ questions: [1, 2, 3].map((n) => q(n)) })),
    } as any;
    const list = await generateCardQuiz(card, () => ai, 3);
    expect(list).toHaveLength(3);
  });

  it('题数按原文长短自动定，并写进提示词', async () => {
    const ai = { json: vi.fn().mockResolvedValue(JSON.stringify({ questions: [q(1)] })) } as any;
    await generateCardQuiz(card, () => ai);
    const prompt = ai.json.mock.calls[0][0] as string;
    expect(prompt).toContain(String(quizCountFor(card.text)));
  });
});
