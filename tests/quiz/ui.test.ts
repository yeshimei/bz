/**
 * 做题家 UI 测试（ticket 17）：startQuiz 渲染/单选对错/多选提交/onComplete
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { QuizMasterUI } from '../../src/quiz/ui';
import { QuizManager, QUIZ_FILE_PATH } from '../../src/quiz/manager';

const REVIEW_PATH = 'CONFIG/STORAGE/review.json';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

/** 预置题库 + 活跃复习条目（updateQuiz 依赖 review.json 过滤） */
function seedQuiz(vault: MockVault, notes: Record<string, any[]>) {
  vault.files.set(QUIZ_FILE_PATH, JSON.stringify({ notes }));
  const now = new Date();
  vault.files.set(REVIEW_PATH, JSON.stringify(
    Object.keys(notes).map((p, i) => ({
      id: 'r' + i, filePath: p, name: p.split('/').pop()?.replace(/\.md$/, '') || p,
      reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3,
      reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() + 60000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    }))
  ));
}

describe('QuizMasterUI', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    document.body.innerHTML = '';
    QuizMasterUI.ai = { json: vi.fn() } as any;
    QuizMasterUI.settings = { enableMultipleChoice: true, questionsPerNote: '0', shuffleQuestions: false, difficulty: 'random' };
  });

  it('startQuiz：渲染题目标题/选项', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI(app);
    await ui.manager.loadQuiz(app);
    await ui.startQuiz(app);
    const popup = document.getElementById('quiz-popup');
    expect(popup).not.toBeNull();
    expect(popup!.textContent).toContain('Q1?');
    expect(popup!.textContent).toContain('(1/1)');
    expect(popup!.querySelectorAll('.quiz-option-btn').length).toBe(4);
  });

  it('单选答对：标绿 + 800ms 自动下一题 + 移除题目', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, {
      'A.md': [
        { question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] },
        { question: 'Q2?', options: ['甲', '乙', '丙', '丁'], correctIndices: [1] },
      ],
    });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI(app);
    await ui.manager.loadQuiz(app);
    await ui.startQuiz(app);
    expect(ui.totalQuestions).toBe(2);
    // 答对 Q1
    const firstBtn = document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement;
    firstBtn.click();
    expect(ui.correctCount).toBe(1);
    expect(firstBtn.classList.contains('correct')).toBe(true);
    // 800ms 后下一题
    await new Promise((r) => setTimeout(r, 900));
    expect(document.getElementById('quiz-popup')!.textContent).toContain('Q2?');
    expect(document.getElementById('quiz-popup')!.textContent).toContain('(2/2)');
    // 答对 Q2 → finishQuiz：弹窗关闭 + 结果 Notice
    (document.querySelectorAll('.quiz-option-btn')[1] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 900));
    expect(document.getElementById('quiz-mask')).toBeNull();
    const { MockNotice } = await import('../mock-obsidian-entry');
    const last = MockNotice.instances[MockNotice.instances.length - 1];
    expect(last.message).toContain('✅ 答对 2 题 ❌ 答错 0 题');
  });

  it('单选答错：标红 + 正确标绿 + 下一题按钮', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI(app);
    await ui.manager.loadQuiz(app);
    await ui.startQuiz(app);
    const btns = document.querySelectorAll('.quiz-option-btn');
    (btns[1] as HTMLElement).click(); // 选错
    expect(ui.wrongCount).toBe(1);
    expect(btns[0].classList.contains('correct')).toBe(true);
    expect(btns[1].classList.contains('wrong')).toBe(true);
    expect(document.querySelector('.quiz-next-btn')).not.toBeNull();
    expect(document.querySelector('.quiz-next-btn')!.textContent).toBe('下一题 →');
  });

  it('多选：切换选中 → 提交答案判定（对：移除题目+标绿）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0, 2] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI(app);
    await ui.manager.loadQuiz(app);
    await ui.startQuiz(app);
    // 单选模式正确时无提交按钮；多选有
    const submit = document.querySelector('.quiz-submit-btn') as HTMLElement;
    expect(submit).not.toBeNull();
    expect(submit.textContent).toBe('提交答案');
    const btns = document.querySelectorAll('.quiz-option-btn');
    (btns[0] as HTMLElement).click();
    (btns[2] as HTMLElement).click();
    expect(btns[0].classList.contains('selected')).toBe(true);
    submit.click();
    expect(ui.correctCount).toBe(1);
    expect(btns[0].classList.contains('correct')).toBe(true);
  });

  it('多选答错：标红 + 下一题按钮', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0, 2] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI(app);
    await ui.manager.loadQuiz(app);
    await ui.startQuiz(app);
    const btns = document.querySelectorAll('.quiz-option-btn');
    (btns[0] as HTMLElement).click();
    (btns[1] as HTMLElement).click(); // 选 0+1，正确 0+2
    (document.querySelector('.quiz-submit-btn') as HTMLElement).click();
    expect(ui.wrongCount).toBe(1);
    expect(btns[0].classList.contains('correct')).toBe(true);
    expect(btns[1].classList.contains('wrong')).toBe(true);
    expect(document.querySelector('.quiz-next-btn')).not.toBeNull();
  });

  it('全部完成 → onComplete({correct, wrong, total, accuracy})', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI(app);
    await ui.manager.loadQuiz(app);
    const onComplete = vi.fn();
    ui.onComplete = onComplete;
    ui._reviewMode = true;
    await ui.startQuiz(app);
    (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 900));
    expect(onComplete).toHaveBeenCalledWith({ correct: 1, wrong: 0, total: 1, accuracy: 100 });
  });

  it('AI 未初始化 → ⚠️ 提示（dur 5000）', async () => {
    QuizMasterUI.ai = null;
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI(app);
    await ui.startQuiz(app);
    const { MockNotice } = await import('../mock-obsidian-entry');
    const last = MockNotice.instances[MockNotice.instances.length - 1];
    expect(last.message).toBe('⚠️ AI 服务未初始化，无法生成题目。请先运行 Q3.js。');
  });
});
