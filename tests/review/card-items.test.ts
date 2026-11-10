/**
 * 划线卡（review/data.ts 的 kind:'card'）。
 *
 * 这类条目没有文件：内容就在排期表里。最危险的一处是 loadItems——它原本按
 * 路径查文件，查不到就把条目标成「挂起」（删除线、不进队列）。卡片要是漏了
 * 分流，用户加完一条就看见一条划掉的线，复习永远进不去。
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { ReviewDataManager, REVIEW_FILE_PATH, cardTitleOf, isCardItem } from '../../src/review/data';
import { addCards, removeCard } from '../../src/review/plan-ops';
import { promptOf, sourceOf } from '../../src/review/card-session';

const KEY = 'reader:b1:hl-1';

function card(over: Record<string, unknown> = {}) {
  return {
    key: KEY,
    bookTitle: '围城',
    chapterTitle: '第一章',
    text: '红海早过了，船在印度洋面上开驶着',
    comment: '写的是闷热',
    backlink: 'obsidian://bz-reader?book=b1&cfi=x',
    ...over,
  };
}

describe('划线卡入库', () => {
  let vault: MockVault;
  let app: ReturnType<typeof makeApp>;
  let dm: ReviewDataManager;

  beforeEach(() => {
    resetObsidianMocks();
    vault = new MockVault();
    app = makeApp(vault);
    setApp(app);
    dm = new ReviewDataManager(app);
  });

  it('addCards 写进 review.json，kind 是 card、内容原样带着', async () => {
    const res = await addCards(dm, [card()]);
    expect(res).toEqual({ added: 1, exists: 0, notFound: 0 });
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw).toHaveLength(1);
    expect(raw[0].kind).toBe('card');
    expect(raw[0].filePath).toBe(KEY);
    expect(raw[0].card.text).toContain('红海');
    expect(raw[0].card.comment).toBe('写的是闷热');
  });

  it('钥匙重复跳过，不排第二次', async () => {
    await addCards(dm, [card()]);
    const res = await addCards(dm, [card()]);
    expect(res).toEqual({ added: 0, exists: 1, notFound: 0 });
    expect(JSON.parse(vault.files.get(REVIEW_FILE_PATH)!)).toHaveLength(1);
  });

  it('缺钥匙或缺原文的算无效，不写盘', async () => {
    const res = await addCards(dm, [card({ key: '' }), card({ text: '   ' }), card({ key: 'reader:b1:hl-2' })]);
    expect(res).toEqual({ added: 1, exists: 0, notFound: 2 });
    expect(JSON.parse(vault.files.get(REVIEW_FILE_PATH)!)).toHaveLength(1);
  });

  it('卡片不会被标成挂起：loadItems 不查文件', async () => {
    await addCards(dm, [card()]);
    const items = await dm.loadItems();
    expect(items).toHaveLength(1);
    expect(items[0].isMissing).toBe(false);
    expect(isCardItem(items[0])).toBe(true);
    expect(items[0].file).toBeNull();
  });

  it('卡片有正常排期：新卡就是今天到期，不是永远不逾期', async () => {
    await addCards(dm, [card()]);
    const [it] = await dm.loadItems();
    expect(it.stage).toBe(0);
    expect(it.phase).toBe('ladder');
    expect(it.currentStage).toBe(1);
    expect(it.nextReviewDate).toBeTruthy();
  });

  it('removeCard 按钥匙移出；不在返回 false', async () => {
    await addCards(dm, [card()]);
    expect(await removeCard(dm, KEY)).toBe(true);
    expect(await dm.loadItems()).toHaveLength(0);
    expect(await removeCard(dm, KEY)).toBe(false);
  });

  it('笔记类条目不受影响：文件不在仍然标挂起', async () => {
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify([{ filePath: '没有这篇.md', name: '没有这篇' }]));
    const [it] = await dm.loadItems();
    expect(it.isMissing).toBe(true);
    expect(isCardItem(it)).toBe(false);
  });
});

describe('卡片在列表与复习界面的那两行字', () => {
  it('书名 · 章节；缺章节只写书名', () => {
    expect(cardTitleOf({ key: KEY, bookTitle: '围城', chapterTitle: '第一章', text: 'x' } as any)).toBe('围城 · 第一章');
    expect(cardTitleOf({ key: KEY, bookTitle: '围城', text: 'x' } as any)).toBe('围城');
  });

  it('提示面：长划线给开头，短划线只给几个字（否则等于念答案）', () => {
    const long = promptOf({
      card: { key: KEY, bookTitle: '书', text: '红海早过了，船在印度洋面上开驶着，但是太阳依然不饶人地迟落早起' },
    } as any);
    expect(long.endsWith('…')).toBe(true);
    expect(Array.from(long).length).toBeLessThanOrEqual(19);

    const short = promptOf({ card: { key: KEY, bookTitle: '书', text: '她转过身' } } as any);
    expect(short).toBe('她转过身…');
  });

  it('出处那行优先书名 · 章节', () => {
    expect(sourceOf({ card: { key: KEY, bookTitle: '围城', chapterTitle: '第一章', text: 'x' } } as any)).toBe('围城 · 第一章');
  });
});
