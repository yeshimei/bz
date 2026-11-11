/**
 * AI 抽认卡（review/flashcard.ts）。
 *
 * 这块最容易坏在「提示等于答案」：模型很爱写「划线中『红海早过了』指的是
 * 什么」，那等于把原文念了一遍，复习退化成认字。所以这里钉住的不只是解析，
 * 还有**问句不许含原文片段**这条闸。
 */
import { describe, expect, it, vi } from 'vitest';
import { buildFlashcardPrompt, checkQuestion, generateFlashcard, parseFlashcard } from '../../src/review/flashcard';
import type { ReviewCard } from '../../src/review/data';

const card: ReviewCard = {
  key: 'reader:b1:hl-1',
  bookTitle: '围城',
  chapterTitle: '第一章',
  text: '红海早过了，船在印度洋面上开驶着，但是太阳依然不饶人地迟落早起',
};

describe('提示词', () => {
  it('带上书名、章节与原文', () => {
    const p = buildFlashcardPrompt(card);
    expect(p).toContain('围城');
    expect(p).toContain('第一章');
    expect(p).toContain('红海早过了');
  });

  it('明确要求问句不能照抄原文', () => {
    expect(buildFlashcardPrompt(card)).toContain('不能照抄原文');
  });
});

describe('解析回复', () => {
  it('正常 JSON', () => {
    const r = parseFlashcard('{"q": "这段在形容船舱里怎样的感受？", "a": "原文"}', card);
    expect(r?.q).toBe('这段在形容船舱里怎样的感受？');
    expect(r?.a).toBe('原文');
  });

  it('包着代码块与前言也能取出来', () => {
    const reply = '好的，这是卡片：\n```json\n{"q": "这段写的是船上怎样的天气？"}\n```\n希望有帮助';
    expect(parseFlashcard(reply, card)?.q).toBe('这段写的是船上怎样的天气？');
  });

  it('模型吐尾逗号的也能救回来', () => {
    expect(parseFlashcard('{"q": "这段写的是船上怎样的天气？",}', card)?.q).toBe(
      '这段写的是船上怎样的天气？',
    );
  });

  it('没给答案时用原文兜底', () => {
    expect(parseFlashcard('{"q": "这段写的是船上怎样的天气？"}', card)?.a).toBe(card.text);
  });

  it('坏 JSON / 空字段 → null', () => {
    expect(parseFlashcard('不是 JSON', card)).toBeNull();
    expect(parseFlashcard('{"q": ""}', card)).toBeNull();
    expect(parseFlashcard('{"q": "短"}', card)).toBeNull();
  });

  it('问句里抄了原文 → 判为不合格', () => {
    const leak = '{"q": "文中「红海早过了」是在说什么？"}';
    expect(parseFlashcard(leak, card)).toBeNull();
  });
});

describe('问句合格判定', () => {
  it('四字以上重合就算泄露', () => {
    expect(checkQuestion('「船在印度洋面上」这句话什么意思？', card)).toBe(false);
    expect(checkQuestion('这段描写的是旅途中的什么状态？', card)).toBe(true);
  });

  it('太短或太长都不合格', () => {
    expect(checkQuestion('讲什么', card)).toBe(false);
    expect(checkQuestion('这'.repeat(200), card)).toBe(false);
  });
});

describe('生成（模型这一层）', () => {
  it('没配 AI → null，不抛错', async () => {
    expect(await generateFlashcard(card, () => null)).toBeNull();
  });

  it('模型抛错 → null', async () => {
    const ai: any = { json: vi.fn(async () => { throw new Error('401'); }) };
    expect(await generateFlashcard(card, () => ai)).toBeNull();
  });

  it('模型给了合格问句 → 原样返回', async () => {
    const ai: any = { json: vi.fn(async () => '{"q": "这段描写的是旅途中的什么状态？"}') };
    expect((await generateFlashcard(card, () => ai))?.q).toBe('这段描写的是旅途中的什么状态？');
  });

  it('取消之后不再返回结果（用户已经翻到下一张）', async () => {
    const ai: any = { json: vi.fn(async () => '{"q": "这段描写的是旅途中的什么状态？"}') };
    expect(await generateFlashcard(card, () => ai, () => true)).toBeNull();
  });
});
