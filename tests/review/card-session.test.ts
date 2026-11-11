// @vitest-environment jsdom
/**
 * 划线卡复习会话（review/card-session.ts）。
 *
 * 三种方式各钉一条：
 *   · 展开全文：一进来就是原文，直接评级，不给「看答案」这一步；
 *   · 抽认卡：先问句后原文，问句不能等于答案；
 *   · 做题：只抽一部分题、答完按正确率定难度。
 * 外加一条兜底：题库没生成出来时退回展开全文，不能白屏。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { CardSession } from '../../src/review/card-session';
import type { ReviewCard, ReviewItem } from '../../src/review/data';
import type { QuizQuestion } from '../../src/review/quiz-core/manager';

function mkCard(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    key: 'reader:b1:hl-1',
    bookTitle: '围城',
    chapterTitle: '第一章',
    text: '红海早过了，船在印度洋面上开驶着，但是太阳依然不饶人地迟落早起，侵占去大部分的夜。',
    comment: '写的是闷热',
    backlink: 'obsidian://bz-reader?book=b1&cfi=x',
    ...over,
  };
}

function mkItem(card: ReviewCard): ReviewItem {
  return {
    id: card.key,
    filePath: card.key,
    name: card.bookTitle,
    kind: 'card',
    card,
    reviewStart: new Date().toISOString(),
    stage: 0,
    phase: 'ladder',
    stability: 0,
    difficulty: 0.5,
    reviewHistory: [],
    totalReviews: 0,
    averageConfidence: 0,
    nextReviewDate: new Date().toISOString(),
    lastReviewed: null,
    lastDifficulty: null,
    completed: false,
  } as ReviewItem;
}

function q(n: number, correct = [0]): QuizQuestion {
  return { question: `第 ${n} 题：这段说了什么？`, options: ['甲', '乙', '丙', '丁'], correctIndices: correct };
}

/** 起一个会话，返回宿主、评级记录、退出次数 */
function setup(opts: {
  mode?: 'flashcard' | 'quiz' | 'plain';
  cards?: ReviewCard[];
  loadQuiz?: (item: ReviewItem) => Promise<QuizQuestion[] | null>;
  ask?: (item: ReviewItem) => Promise<{ q: string; a: string } | null>;
  regenerate?: (item: ReviewItem) => Promise<boolean>;
  ratio?: number;
}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const rated: string[] = [];
  let exits = 0;
  const session = new CardSession({
    app: {} as any,
    host,
    mode: opts.mode ?? 'plain',
    ratio: opts.ratio,
    queue: (opts.cards ?? [mkCard()]).map(mkItem),
    loadQuiz: opts.loadQuiz,
    ask: opts.ask,
    regenerate: opts.regenerate,
    onRate: async (item, rating) => {
      rated.push(`${item.filePath}:${rating}`);
    },
    onExit: () => {
      exits += 1;
    },
  });
  session.start();
  sessions.push(session);
  return { host, rated, exits: () => exits, session };
}

const click = (host: HTMLElement, sel: string): void => {
  const el = host.querySelector(sel) as HTMLElement | null;
  if (!el) throw new Error(`没找到 ${sel}`);
  el.click();
};

const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));

let sessions: CardSession[] = [];
afterEach(() => {
  sessions.forEach((s) => s.destroy());
  sessions = [];
  document.body.innerHTML = '';
});
beforeEach(() => {
  sessions = [];
});

describe('展开全文（不用 AI）', () => {
  it('一进来就是原文，没有「看答案」这一步', () => {
    const { host } = setup({ mode: 'plain' });
    expect(host.textContent).toContain('红海早过了');
    expect(host.textContent).toContain('写的是闷热');
    expect(host.querySelector('[data-act="reveal"]')).toBeNull();
  });

  it('四个难度按钮直接就位，点了就写排期', async () => {
    const { host, rated } = setup({ mode: 'plain' });
    expect(host.querySelectorAll('[data-r]')).toHaveLength(4);
    click(host, '[data-r="good"]');
    await sleep();
    expect(rated).toEqual(['reader:b1:hl-1:good']);
  });

  it('不给「重新生成」按钮（这档本来就不用模型）', () => {
    const { host } = setup({ mode: 'plain', regenerate: async () => true });
    expect(host.querySelector('[data-act="regen"]')).toBeNull();
  });
});

describe('AI 抽认卡', () => {
  it('先用卡上存好的问句，不重新请求模型', () => {
    const ask = vi.fn(async () => ({ q: '不该被调用', a: 'x' }));
    const card = mkCard({ qa: { q: '这段在形容怎样的天气？', a: '原文', at: 1 } });
    const { host } = setup({ mode: 'flashcard', cards: [card], ask });
    expect(host.textContent).toContain('这段在形容怎样的天气？');
    expect(host.textContent).not.toContain('红海早过了');
    expect(ask).not.toHaveBeenCalled();
  });

  it('点「看答案」才露原文与想法', () => {
    const card = mkCard({ qa: { q: '这段在形容怎样的天气？', a: '原文', at: 1 } });
    const { host } = setup({ mode: 'flashcard', cards: [card] });
    click(host, '[data-act="reveal"]');
    expect(host.textContent).toContain('红海早过了');
    expect(host.textContent).toContain('写的是闷热');
    expect(host.querySelectorAll('[data-r]')).toHaveLength(4);
  });

  it('卡上没有问句时现场问一次，问的过程中不先露底', async () => {
    const card = mkCard();
    const { host } = setup({
      mode: 'flashcard',
      cards: [card],
      ask: async () => ({ q: '这段在说什么呢？', a: card.text }),
    });
    expect(host.textContent).toContain('正在生成提示');
    await sleep();
    expect(host.textContent).toContain('这段在说什么呢？');
  });

  it('「重新生成」会再问一次模型', async () => {
    const card = mkCard({ qa: { q: '旧问句好不好？', a: '原文', at: 1 } });
    const regenerate = vi.fn(async () => true);
    const { host } = setup({ mode: 'flashcard', cards: [card], regenerate });
    click(host, '[data-act="regen"]');
    await sleep();
    expect(regenerate).toHaveBeenCalledTimes(1);
  });
});

describe('AI 做题', () => {
  it('题库 6 道只抽 2 道', async () => {
    const { host } = setup({
      mode: 'quiz',
      loadQuiz: async () => [1, 2, 3, 4, 5, 6].map((n) => q(n)),
    });
    await sleep();
    expect(host.textContent).toContain('第 1 / 2 题');
  });

  it('点错选项标红、对的标绿，并显示解析', async () => {
    const { host } = setup({
      mode: 'quiz',
      loadQuiz: async () => [{ ...q(1, [0]), explain: '原文说太阳不饶人' }],
    });
    await sleep();
    click(host, '[data-opt="1"]');
    expect(host.querySelector('[data-opt="0"]')!.className).toContain('correct');
    expect(host.querySelector('[data-opt="1"]')!.className).toContain('wrong');
    expect(host.textContent).toContain('原文说太阳不饶人');
  });

  it('模型给的选项自带 A. 序号时不再叠一层', async () => {
    const { host } = setup({
      mode: 'quiz',
      loadQuiz: async () => [
        { question: '这段说了什么？', options: ['A. 甲', 'B. 乙', 'C. 丙', 'D. 丁'], correctIndices: [0] },
      ],
    });
    await sleep();
    expect(host.textContent).not.toContain('AA.');
    expect(host.textContent).toContain('A. 甲');
    expect(host.querySelectorAll('.bz-cs-opt-i')).toHaveLength(0);
  });

  it('全答对按「容易」记', async () => {
    const { host, rated } = setup({
      mode: 'quiz',
      loadQuiz: async () => [q(1, [0])],
      ratio: 3,
    });
    await sleep();
    click(host, '[data-opt="0"]');
    click(host, '[data-act="next"]');
    await sleep();
    expect(host.textContent).toContain('答对 1 / 1');
    click(host, '[data-act="finish"]');
    await sleep();
    expect(rated).toEqual(['reader:b1:hl-1:easy']);
  });

  it('全答错按「忘了」记', async () => {
    const { host, rated } = setup({ mode: 'quiz', loadQuiz: async () => [q(1, [2])] });
    await sleep();
    click(host, '[data-opt="0"]');
    click(host, '[data-act="next"]');
    await sleep();
    click(host, '[data-act="finish"]');
    await sleep();
    expect(rated).toEqual(['reader:b1:hl-1:again']);
  });

  it('题库为空时退回展开全文，不白屏', async () => {
    const { host } = setup({ mode: 'quiz', loadQuiz: async () => null });
    await sleep();
    expect(host.textContent).toContain('红海早过了');
    expect(host.querySelectorAll('[data-r]')).toHaveLength(4);
  });

  it('没有题库读取器时也退回展开全文', async () => {
    const { host } = setup({ mode: 'quiz' });
    await sleep();
    expect(host.textContent).toContain('红海早过了');
  });
});

describe('一条接一条', () => {
  it('评完第一条自动进第二条，走完就退出', async () => {
    const a = mkCard({ key: 'k1' });
    const b = mkCard({ key: 'k2', text: '第二条划线的内容也在这里。' });
    const { host, rated, exits } = setup({ mode: 'plain', cards: [a, b] });
    click(host, '[data-r="good"]');
    await sleep();
    expect(host.textContent).toContain('第二条划线');
    click(host, '[data-r="easy"]');
    await sleep();
    expect(rated).toEqual(['k1:good', 'k2:easy']);
    expect(exits()).toBe(1);
  });
});
