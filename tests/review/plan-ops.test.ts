/**
 * 复习计划对外操作（bz-reader 门面背后的纯逻辑）。
 *
 * 这几条是跨插件契约的落点：bz-reader 先写卡片文件、再调门面加进计划，
 * 所以「文件不在」「已经在计划里」都必须收敛成结构化结果，不能抛错——
 * 那边收到一条异常只会在阅读界面里弹一句看不懂的红字。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';
import { addNote, addNotes, hasNote, removeNote, statusOf } from '../../src/review/plan-ops';

describe('复习计划对外操作', () => {
  let vault: MockVault;
  let app: ReturnType<typeof makeApp>;
  let dm: ReviewDataManager;

  beforeEach(() => {
    resetObsidianMocks();
    vault = new MockVault();
    vault.dirs.add('bz-reader');
    vault.dirs.add('bz-reader/review');
    vault.files.set('bz-reader/review/卡片一.md', '正文');
    vault.files.set('bz-reader/review/卡片二.md', '正文');
    app = makeApp(vault);
    setApp(app);
    dm = new ReviewDataManager(app);
  });

  it('addNote：写进 review.json 并返回 added', async () => {
    const res = await addNote(dm, app, 'bz-reader/review/卡片一.md');
    expect(res).toEqual({ added: true });
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw.map((x: any) => x.filePath)).toEqual(['bz-reader/review/卡片一.md']);
    expect(raw[0].name).toBe('卡片一');
  });

  it('addNote：已在计划中 → { added:false, reason:exists }，不重复写', async () => {
    await addNote(dm, app, 'bz-reader/review/卡片一.md');
    const res = await addNote(dm, app, 'bz-reader/review/卡片一.md');
    expect(res).toEqual({ added: false, reason: 'exists' });
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw.length).toBe(1);
  });

  it('addNote：文件不存在 → notFound，不写盘', async () => {
    const res = await addNote(dm, app, 'bz-reader/review/没有这篇.md');
    expect(res).toEqual({ added: false, reason: 'notFound' });
    expect(vault.files.has(REVIEW_FILE_PATH)).toBe(false);
  });

  it('addNote：空路径与空白路径 → notFound', async () => {
    expect(await addNote(dm, app, '')).toEqual({ added: false, reason: 'notFound' });
    expect(await addNote(dm, app, '   ')).toEqual({ added: false, reason: 'notFound' });
  });

  it('hasNote：在 / 不在', async () => {
    expect(await hasNote(dm, 'bz-reader/review/卡片一.md')).toBe(false);
    await addNote(dm, app, 'bz-reader/review/卡片一.md');
    expect(await hasNote(dm, 'bz-reader/review/卡片一.md')).toBe(true);
    expect(await hasNote(dm, 'bz-reader/review/卡片二.md')).toBe(false);
  });

  it('addNotes：批量一趟，混合成功 / 重复 / 不存在', async () => {
    await addNote(dm, app, 'bz-reader/review/卡片一.md');
    const res = await addNotes(dm, app, [
      'bz-reader/review/卡片一.md',
      'bz-reader/review/卡片二.md',
      'bz-reader/review/没有这篇.md',
      '',
    ]);
    expect(res).toEqual({ added: 1, exists: 1, notFound: 2 });
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw.map((x: any) => x.filePath).sort()).toEqual([
      'bz-reader/review/卡片一.md',
      'bz-reader/review/卡片二.md',
    ]);
  });

  it('addNotes：批内重复只算一次，不写第二条', async () => {
    const res = await addNotes(dm, app, [
      'bz-reader/review/卡片一.md',
      'bz-reader/review/卡片一.md',
    ]);
    expect(res).toEqual({ added: 1, exists: 1, notFound: 0 });
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw.length).toBe(1);
  });

  it('removeNote：移出后不在计划里；本来就不在返回 false', async () => {
    await addNote(dm, app, 'bz-reader/review/卡片一.md');
    expect(await removeNote(dm, 'bz-reader/review/卡片一.md')).toBe(true);
    expect(await hasNote(dm, 'bz-reader/review/卡片一.md')).toBe(false);
    expect(await removeNote(dm, 'bz-reader/review/卡片一.md')).toBe(false);
  });

  it('statusOf：按输入顺序返回排期，没进计划的给空态', async () => {
    await addNote(dm, app, 'bz-reader/review/卡片一.md');
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    raw[0] = { ...raw[0], stage: 4, phase: 'fsrs', totalReviews: 9, nextReviewDate: '2026-12-01T00:00:00.000Z' };
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify(raw));

    const res = await statusOf(dm, ['bz-reader/review/卡片二.md', 'bz-reader/review/卡片一.md']);
    expect(res).toEqual([
      { path: 'bz-reader/review/卡片二.md', planned: false, nextReviewDate: null, stage: 0, phase: 'ladder', totalReviews: 0 },
      { path: 'bz-reader/review/卡片一.md', planned: true, nextReviewDate: '2026-12-01T00:00:00.000Z', stage: 4, phase: 'fsrs', totalReviews: 9 },
    ]);
  });

  it('statusOf：空数组与空白路径都不抛错', async () => {
    expect(await statusOf(dm, [])).toEqual([]);
    const res = await statusOf(dm, ['', '   ']);
    expect(res.map((r) => r.planned)).toEqual([false, false]);
    expect(res.map((r) => r.path)).toEqual(['', '   ']);
  });
});
