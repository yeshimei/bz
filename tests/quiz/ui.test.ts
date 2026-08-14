/**
 * 做题家 UI 测试（ticket 17 修正版）：startQuiz/单选/多选/loading/mask 点击/onComplete
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { QuizMasterUI, quizUI } from '../../src/quiz/ui';
import { QUIZ_FILE_PATH, REVIEW_DATA_PATH } from '../../src/quiz/manager';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

/** 预置活跃复习条目 + 题库 */
function seedQuiz(vault: MockVault, notes: Record<string, any[]>) {
  const now = new Date();
  vault.files.set(QUIZ_FILE_PATH, JSON.stringify({ notes }));
  vault.files.set(REVIEW_DATA_PATH, JSON.stringify(
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

  it('startQuiz：渲染标题/题目/选项（A. 前缀结构）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    const popup = document.getElementById('quiz-popup')!;
    expect(popup).not.toBeNull();
    expect(popup.textContent).toContain('Q1?');
    expect(popup.textContent).toContain('(1/1)');
    expect(popup.textContent).toContain('A.');
    const btns = popup.querySelectorAll('.quiz-option-btn');
    expect(btns.length).toBe(4);
    expect(btns[0].querySelector('.check-mark')).not.toBeNull();
  });

  it('选项文本 HTML 转义：含 < & 字符按文本显示，不截断/不解析为标签', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, {
      'A.md': [{ question: 'Q?', options: ['a < b & c', 'x>y', '正常文本', 'd'], correctIndices: [0] }],
    });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    const popup = document.getElementById('quiz-popup')!;
    const spans = popup.querySelectorAll('.quiz-option-btn span');
    const texts = [...spans].map((s) => s.textContent || '');
    expect(texts.some((t) => t.includes('a < b & c'))).toBe(true);
    expect(texts.some((t) => t.includes('x>y'))).toBe(true);
    // 未被当作 HTML 解析（每个按钮 3 个 span：标签/文本/check-mark，4 按钮 = 12）
    expect(popup.querySelectorAll('.quiz-option-btn span').length).toBe(12);
  });

  it('单选答对：标绿 + 800ms 自动下一题（splice 不 ++）+ 移除题目', async () => {
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
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    expect(ui.totalQuestions).toBe(2);
    // 答对 Q1
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click();
    expect(ui.correctCount).toBe(1);
    await vi.advanceTimersByTimeAsync(900);
    expect(document.getElementById('quiz-popup')!.textContent).toContain('Q2?');
    // totalQuestions 固定不变（源码语义：splice 后显示 (1/2)）
    expect(document.getElementById('quiz-popup')!.textContent).toContain('(1/2)');
    // 答对 Q2 → 全部完成（弹窗保留，onComplete 回调）
    const onComplete = vi.fn();
    ui.onComplete = onComplete;
    (document.querySelectorAll('.quiz-option-btn')[1] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    expect(onComplete).toHaveBeenCalledWith({ correct: 2, wrong: 0, total: 2, accuracy: 100 });
    expect(document.getElementById('quiz-popup')).not.toBeNull(); // 回调不关弹窗
    vi.useRealTimers();
  });

  it('单选答错：正确标绿 + 点击项标红 + 下一题按钮（不删题）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    const btns = document.querySelectorAll('.quiz-option-btn');
    (btns[1] as HTMLElement).click(); // 选错
    expect(ui.wrongCount).toBe(1);
    expect(btns[0].classList.contains('correct')).toBe(true);
    expect(btns[1].classList.contains('wrong')).toBe(true);
    const nextBtn = document.querySelector('.quiz-next-btn') as HTMLElement;
    expect(nextBtn).not.toBeNull();
    expect(nextBtn.textContent).toBe('下一题 →');
    // 题目未删除
    const quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md']).toHaveLength(1);
  });

  it('多选：selected 勾选 + 提交判定（正确：绿 + splice 下一题；源码不递增计数）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0, 2] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.onComplete = onComplete;
    await ui.startQuiz();
    const submit = document.querySelector('.quiz-submit-btn') as HTMLElement;
    expect(submit).not.toBeNull();
    expect(submit.textContent).toBe('提交答案');
    const btns = document.querySelectorAll('.quiz-option-btn');
    (btns[0] as HTMLElement).click();
    (btns[2] as HTMLElement).click();
    expect(btns[0].classList.contains('selected')).toBe(true);
    expect(btns[0].querySelector('.check-mark')).not.toBeNull();
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    submit.click();
    // 源码缺陷：多选不递增 correctCount（逐字保留）
    expect(ui.correctCount).toBe(0);
    expect(btns[0].classList.contains('correct')).toBe(true);
    await vi.advanceTimersByTimeAsync(900);
    vi.useRealTimers();
    // 题目被 splice 移除 → 无题 → onComplete（total=correct+wrong=0 → accuracy 0）
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('多选答错：正确绿 + 错误选中红 + 下一题按钮', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0, 2] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    const btns = document.querySelectorAll('.quiz-option-btn');
    (btns[0] as HTMLElement).click();
    (btns[1] as HTMLElement).click(); // 选 0+1，正确 0+2
    (document.querySelector('.quiz-submit-btn') as HTMLElement).click();
    expect(btns[0].classList.contains('correct')).toBe(true);
    expect(btns[1].classList.contains('wrong')).toBe(true);
    expect(document.querySelector('.quiz-next-btn')).not.toBeNull();
  });

  it('mask 点击 = finishQuiz（onComplete 回调）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.onComplete = onComplete;
    await ui.startQuiz();
    (document.getElementById('quiz-mask') as HTMLElement).click();
    expect(onComplete).toHaveBeenCalledWith({ correct: 0, wrong: 0, total: 0, accuracy: 0 });
  });

  it('AI 未初始化 → ⚠️ 提示（dur 5000）', async () => {
    QuizMasterUI.ai = null;
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    const { getNoticeMessages } = await import('../mock-obsidian-entry');
    const msgs = getNoticeMessages();
    expect(msgs[msgs.length - 1]).toBe('AI 服务未配置，无法生成题目');
  });

  it('空题库 → loading 弹窗 + 生成第一活跃笔记题目', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '这是一段笔记内容。');
    // 有活跃条目但 quiz.notes 空
    const now = new Date();
    vault.files.set(QUIZ_FILE_PATH, JSON.stringify({ notes: {} }));
    vault.files.set(REVIEW_DATA_PATH, JSON.stringify([{
      id: 'r1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 0, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() + 60000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    }]));
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const gen = vi.spyOn(ui.generator, 'generate').mockResolvedValue([
      { question: 'GQ?', options: ['a', 'b', 'c', 'd'], correctIndices: [0] },
    ]);
    // mock ai.json（generate 内部用）
    (QuizMasterUI.ai as any).json = vi.fn().mockResolvedValue('{"questions":[]}');
    await ui.startQuiz();
    expect(gen).toHaveBeenCalled();
    expect(document.getElementById('quiz-popup')!.textContent).toContain('GQ?');
  });

  it('loading 弹窗：quiz-mask id + ⏳ 在上 + spinner 在下', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    ui.showLoadingPopup('正在获取题库，请稍候...');
    const mask = document.getElementById('quiz-mask')!;
    const loading = document.getElementById('quiz-loading')!;
    expect(mask).not.toBeNull();
    expect(loading.textContent).toContain('⏳ 正在获取题库，请稍候...');
    expect(loading.querySelector('.spinner')).not.toBeNull();
    // ESC 关闭
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ui.loadingMask).toBeNull();
  });

  it('ensureQuiz：quizUI.ai 实例镜像同步（复习域经实例读取判断）', async () => {
    const { setSettingsProvider } = await import('../../src/core/settings-provider');
    setSettingsProvider(() => ({}) as any);
    const { ensureQuiz, QuizMasterUI: QUI } = await import('../../src/quiz');
    ensureQuiz(null as any);
    expect(quizUI.ai).not.toBeNull();
    expect(QUI.ai).not.toBeNull();
    // 清理：还原实例/静态 ai（后续测试经 beforeEach 重置静态，实例需手动还原）
    quizUI.ai = null;
    QUI.ai = null;
  });
});

describe('复习联动契约', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    document.body.innerHTML = '';
    QuizMasterUI.ai = { json: vi.fn() } as any;
    QuizMasterUI.settings = { enableMultipleChoice: true, questionsPerNote: '0', shuffleQuestions: false, difficulty: 'random' };
  });

  it('startReviewSession 设置会话状态并开始出题，endReviewSession 退出复习模式', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const questions = [
      { question: 'RQ?', options: ['a', 'b', 'c', 'd'], correctIndices: [0], notePath: 'A.md' },
    ];
    const onComplete = vi.fn();
    ui.startReviewSession({ questions, onComplete });
    expect(ui._reviewMode).toBe(true);
    expect(ui.currentQuestions).toEqual(questions);
    expect(ui.currentIndex).toBe(0);
    expect(ui.correctCount).toBe(0);
    expect(ui.wrongCount).toBe(0);
    expect(ui.totalQuestions).toBe(1);
    expect(ui.onComplete).toBe(onComplete);
    expect(document.getElementById('quiz-popup')!.textContent).toContain('RQ?');
    // 结束会话：有未消费回调时按 finishQuiz 语义只回调不关闭
    ui.endReviewSession();
    expect(ui._reviewMode).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    // 回调已消费后再结束 → 无回调 → 关闭弹窗
    ui.endReviewSession();
    expect(document.getElementById('quiz-popup')).toBeNull();
  });
});
