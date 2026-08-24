/**
 * 做题家数据层测试（ticket 17 修正版）：async 读盘接口/removeQuestion 不删空键
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { QuizManager, QUIZ_FILE_PATH, loadActiveItems, REVIEW_DATA_PATH, getQuizFilePath, getReviewDataPath } from '../../src/quiz/manager';

describe('QuizManager', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    document.body.innerHTML = '';
  });

  it('saveQuestionsForNote → getUncompletedQuestions 往返（补 notePath/_index，无 completed）', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    await qm.saveQuestionsForNote(app, 'A.md', [
      { question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndices: [0] },
      { question: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndices: [1] },
    ]);
    const raw = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(raw.notes['A.md']).toHaveLength(2);
    expect(raw.notes['A.md'][0].completed).toBeUndefined();
    const all = await qm.getUncompletedQuestions(app);
    expect(all).toHaveLength(2);
    expect(all[0].notePath).toBe('A.md');
    expect(all[0]._index).toBe(0);
    expect(all[1]._index).toBe(1);
  });

  it('removeQuestion 稳定定位（P0-2）：按题目内容定位删除，不依赖下标；空键保留', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    await qm.saveQuestionsForNote(app, 'A.md', [
      { question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndices: [0] },
      { question: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndices: [1] },
    ]);
    // 按内容删 Q2（若按快照下标 0 会误删 Q1）
    await qm.removeQuestion(app, 'A.md', { question: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndices: [1] });
    const raw = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(raw.notes['A.md']).toHaveLength(1);
    expect(raw.notes['A.md'][0].question).toBe('Q1');
    // 删最后一题 → 空数组键保留（源码语义）
    await qm.removeQuestion(app, 'A.md', { question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndices: [0] });
    const quiz = await qm.loadQuiz(app);
    expect(quiz.notes['A.md']).toEqual([]);
    expect(await qm.getUncompletedQuestions(app)).toHaveLength(0);
  });

  it('removeQuestion：correctIndices 顺序不敏感；目标不在库中 → 静默成功（终态已达成）', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    await qm.saveQuestionsForNote(app, 'A.md', [
      { question: 'M', options: ['a', 'b', 'c', 'd'], correctIndices: [0, 2] },
    ]);
    await qm.removeQuestion(app, 'A.md', { question: 'M', options: ['a', 'b', 'c', 'd'], correctIndices: [2, 0] });
    expect((await qm.loadQuiz(app)).notes['A.md']).toEqual([]);
    // 再删一次：库中已无此题 → 不抛错、不写盘
    const before = vault.files.get(QUIZ_FILE_PATH);
    await qm.removeQuestion(app, 'A.md', { question: 'M', options: ['a', 'b', 'c', 'd'], correctIndices: [0, 2] });
    expect(vault.files.get(QUIZ_FILE_PATH)).toBe(before);
    // 未知 notePath 同样安全
    await expect(qm.removeQuestion(app, 'X.md', { question: 'M', options: ['a', 'b', 'c', 'd'], correctIndices: [0] })).resolves.toBeUndefined();
  });

  it('removeQuestion：同内容多题逐次删除首个匹配（未答优先消费）', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    await qm.saveQuestionsForNote(app, 'A.md', [
      { question: '同文?', options: ['a', 'b', 'c', 'd'], correctIndices: [0] },
      { question: '同文?', options: ['a', 'b', 'c', 'd'], correctIndices: [0] },
    ]);
    const target = { question: '同文?', options: ['a', 'b', 'c', 'd'], correctIndices: [0] };
    await qm.removeQuestion(app, 'A.md', target);
    let raw = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(raw.notes['A.md']).toHaveLength(1); // 只消费一份
    await qm.removeQuestion(app, 'A.md', target);
    raw = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(raw.notes['A.md']).toEqual([]); // 第二份也被消费
  });

  it('loadQuiz 损坏 → {notes:{}}', async () => {
    const vault = new MockVault();
    vault.files.set(QUIZ_FILE_PATH, '损坏数据');
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    const quiz = await qm.loadQuiz(app);
    expect(quiz).toEqual({ notes: {} });
  });

  it('getQuestionsForNote：无 → null', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    expect(await qm.getQuestionsForNote(app, 'X.md')).toBeNull();
  });

  it('loadActiveItems：读 review.json 过滤 completed', async () => {
    const vault = new MockVault();
    const now = new Date();
    vault.files.set(REVIEW_DATA_PATH, JSON.stringify([
      { filePath: 'A.md', completed: false },
      { filePath: 'B.md', completed: true },
      null,
    ]));
    const app = mockAppWithVault(vault);
    setApp(app);
    const items = await loadActiveItems(app);
    expect(items).toHaveLength(1);
    expect(items[0].filePath).toBe('A.md');
    expect(items).toHaveLength(1);
    expect(items[0].filePath).toBe('A.md');
  });
});

describe('数据文件路径设置', () => {
  it('getQuizFilePath 与复习计划共用 reviewStoragePath，缺省回退 CONFIG/STORAGE', () => {
    setSettingsProvider(() => ({ reviewStoragePath: '自定义/数据' }) as any);
    expect(getQuizFilePath()).toBe('自定义/数据/quiz.json');
    setSettingsProvider(() => ({} as any));
    expect(getQuizFilePath()).toBe('CONFIG/STORAGE/quiz.json');
  });

  it('getReviewDataPath 读取 reviewStoragePath 设置，缺省回退 CONFIG/STORAGE', () => {
    setSettingsProvider(() => ({ reviewStoragePath: '自定义/数据' }) as any);
    expect(getReviewDataPath()).toBe('自定义/数据/review.json');
    setSettingsProvider(() => ({} as any));
    expect(getReviewDataPath()).toBe('CONFIG/STORAGE/review.json');
  });
});
