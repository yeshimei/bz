/**
 * 做题家数据层测试（ticket 17）：quiz.json 往返/removeQuestion/归一化
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { QuizManager, QUIZ_FILE_PATH } from '../../src/quiz/manager';

describe('QuizManager', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    document.body.innerHTML = '';
  });

  it('saveQuiz 结构往返 {notes: {path: [questions]}}', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    await qm.loadQuiz(app);
    await qm.saveQuestionsForNote(app, 'A.md', [{ question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }]);
    const raw = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(raw.notes['A.md']).toHaveLength(1);
    expect(raw.notes['A.md'][0].question).toBe('Q1');
    // 无 completed 字段
    expect(raw.notes['A.md'][0].completed).toBeUndefined();
  });

  it('loadQuiz 归一化：数组 → {notes:{}}；损坏 → {notes:{}}', async () => {
    const vault = new MockVault();
    vault.files.set(QUIZ_FILE_PATH, JSON.stringify([{ question: 'x' }]));
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    await qm.loadQuiz(app);
    expect(qm.quiz).toEqual({ notes: {} });
  });

  it('getUncompletedQuestions 补 notePath/_index', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    await qm.loadQuiz(app);
    await qm.saveQuestionsForNote(app, 'A.md', [
      { question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndices: [0] },
      { question: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndices: [1] },
    ]);
    const all = qm.getUncompletedQuestions();
    expect(all).toHaveLength(2);
    expect(all[0].notePath).toBe('A.md');
    expect(all[0]._index).toBe(0);
    expect(all[1]._index).toBe(1);
  });

  it('removeQuestion splice + 空则删笔记键', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    await qm.loadQuiz(app);
    await qm.saveQuestionsForNote(app, 'A.md', [
      { question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndices: [0] },
    ]);
    await qm.removeQuestion(app, 'A.md', 0);
    expect(qm.quiz.notes['A.md']).toBeUndefined();
    expect(qm.getUncompletedQuestions()).toHaveLength(0);
  });

  it('getQuestionsForNote：无 → null', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    await qm.loadQuiz(app);
    expect(qm.getQuestionsForNote('X.md')).toBeNull();
  });
});
