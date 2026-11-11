/**
 * 卡片题库的落盘（review/card-quiz-store.ts）。
 *
 * 题库为什么不塞进 review.json：那个文件是整份读写的，一条长划线加十几道题
 * 就是好几 KB，上千张卡能把它撑到十几兆——每次排期改动都得读一遍写一遍。
 * 所以单开一个文件、按卡片钥匙索引；卡片移出计划时顺手清掉它的题库。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';
import { addCards, removeCard } from '../../src/review/plan-ops';
import { getCardQuiz, getCardQuizFilePath, removeCardQuiz, saveCardQuiz } from '../../src/review/card-quiz-store';
import type { QuizQuestion } from '../../src/review/quiz-core/manager';

const KEY = 'reader:b1:hl-1';

function qs(): QuizQuestion[] {
  return [
    { question: '这段在说什么？', options: ['甲', '乙', '丙', '丁'], correctIndices: [0], explain: '原文依据' },
    { question: '天气如何？', options: ['闷', '冷', '雨', '雪'], correctIndices: [0] },
  ];
}

function card(over: Record<string, unknown> = {}) {
  return { key: KEY, bookTitle: '围城', chapterTitle: '第一章', text: '红海早过了', ...over };
}

describe('题库存取', () => {
  let vault: MockVault;
  let app: ReturnType<typeof makeApp>;
  let dm: ReviewDataManager;

  beforeEach(() => {
    resetObsidianMocks();
    vault = new MockVault();
    app = makeApp(vault);
    setApp(app);
    dm = new ReviewDataManager(app);
    vault.files.clear();
  });

  it('存进去能原样读回来', async () => {
    await saveCardQuiz(KEY, qs());
    const got = await getCardQuiz(KEY);
    expect(got).toHaveLength(2);
    expect(got![0].question).toBe('这段在说什么？');
    expect(got![0].options).toHaveLength(4);
  });

  it('题库落在自己的文件里，不挤进 review.json', async () => {
    await addCards(dm, [card()]);
    await saveCardQuiz(KEY, qs());
    const reviewRaw = vault.files.get(REVIEW_FILE_PATH) ?? '';
    expect(reviewRaw).not.toContain('这段在说什么');
    expect(vault.files.get(getCardQuizFilePath())).toContain('这段在说什么');
  });

  it('同一张卡重新生成是覆盖，不是追加', async () => {
    await saveCardQuiz(KEY, qs());
    await saveCardQuiz(KEY, [qs()[0]]);
    expect(await getCardQuiz(KEY)).toHaveLength(1);
  });

  it('没存过的卡读出来是 null', async () => {
    expect(await getCardQuiz('reader:none:x')).toBeNull();
  });

  it('移出复习计划时把题库一起清掉', async () => {
    await addCards(dm, [card()]);
    await saveCardQuiz(KEY, qs());
    expect(await removeCard(dm, KEY)).toBe(true);
    expect(await getCardQuiz(KEY)).toBeNull();
  });

  it('清一张不影响别的卡', async () => {
    await saveCardQuiz(KEY, qs());
    await saveCardQuiz('reader:b2:hl-9', qs());
    await removeCardQuiz(KEY);
    expect(await getCardQuiz(KEY)).toBeNull();
    expect(await getCardQuiz('reader:b2:hl-9')).toHaveLength(2);
  });
});
