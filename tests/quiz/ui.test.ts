/**
 * 做题家 UI 测试（ticket 17 修正版）：startQuiz/单选/多选/loading/mask 点击/onComplete
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
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

  it('单选答对：标绿 + 800ms 自动下一题（splice 不 ++）+ 移除题目（落盘终态断言）', async () => {
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
    // P2：计数在持久化成功后递增
    await vi.advanceTimersByTimeAsync(900);
    expect(ui.correctCount).toBe(1);
    expect(document.getElementById('quiz-popup')!.textContent).toContain('Q2?');
    // 题号用已完成数+1：答对 Q1（splice 不递增 currentIndex）后第二题显示 2/2
    expect(document.getElementById('quiz-popup')!.textContent).toContain('(2/2)');
    // P0-2 落盘终态：被答对的 Q1 已删除，恰剩未答的 Q2
    let quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md'].map((q: any) => q.question)).toEqual(['Q2?']);
    // 答对 Q2 → 全部完成（弹窗保留，onComplete 回调）
    const onComplete = vi.fn();
    ui.onComplete = onComplete;
    (document.querySelectorAll('.quiz-option-btn')[1] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    expect(ui.correctCount).toBe(2);
    expect(onComplete).toHaveBeenCalledWith({ correct: 2, wrong: 0, total: 2, accuracy: 100 });
    expect(document.getElementById('quiz-popup')).not.toBeNull(); // 回调不关弹窗
    // P0-2 终态：两题先后答对，落盘删除的恰是被答对的两题（空数组键保留）
    quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md']).toEqual([]);
    vi.useRealTimers();
  });

  it('P0-2：同笔记 5 题全对 → 库清空、会话完成回调 accuracy=100', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, {
      'A.md': [1, 2, 3, 4, 5].map((n) => ({ question: `Q${n}?`, options: ['甲', '乙', '丙', '丁'], correctIndices: [0] })),
    });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    const onComplete = vi.fn();
    ui.onComplete = onComplete; // 开考后挂回调（startQuiz 入口会清理残留）
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    for (let round = 1; round <= 5; round++) {
      (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click();
      await vi.advanceTimersByTimeAsync(900);
      expect(ui.correctCount).toBe(round);
    }
    expect(onComplete).toHaveBeenCalledWith({ correct: 5, wrong: 0, total: 5, accuracy: 100 });
    const quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md']).toEqual([]); // 全对 → 库空
    expect(await import('../../src/quiz/manager').then((m) => new m.QuizManager().getUncompletedQuestions(app))).toHaveLength(0);
    vi.useRealTimers();
  });

  it('P2：持久化失败 → 恢复作答态且不重复计数；重答成功只计一次并落盘删除', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, {
      'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] }],
    });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    // 仅首次调用注入失败，其后走真实实现（验证重答真正落盘删除）
    const removeSpy = vi.spyOn(ui.manager, 'removeQuestion')
      .mockImplementationOnce(async () => {
        throw new Error('磁盘写入失败');
      });
    const btns = () => document.querySelectorAll('.quiz-option-btn');
    // 第一次答对：持久化失败
    (btns()[0] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(50);
    expect(ui.correctCount).toBe(0); // 失败不计数
    expect(getNoticeMessages().some((m) => m.includes('删除题目失败'))).toBe(true);
    // 作答态已恢复：按钮不再 disabled，可重新作答
    expect(btns()[0].classList.contains('disabled')).toBe(false);
    // 重答成功：只计一次
    (btns()[0] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    expect(ui.correctCount).toBe(1);
    expect(removeSpy).toHaveBeenCalledTimes(2);
    const quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md']).toEqual([]);
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

  it('题号进度：答错点下一题 → 题号递增（2/N）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, {
      'A.md': [
        { question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] },
        { question: 'Q2?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] },
      ],
    });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    expect(document.getElementById('quiz-popup')!.textContent).toContain('(1/2)');
    // 第一题答错 → 点下一题
    (document.querySelectorAll('.quiz-option-btn')[1] as HTMLElement).click();
    (document.querySelector('.quiz-next-btn') as HTMLElement).click();
    expect(document.getElementById('quiz-popup')!.textContent).toContain('Q2?');
    expect(document.getElementById('quiz-popup')!.textContent).toContain('(2/2)');
  });

  it('多选：selected 勾选 + 提交判定（正确：绿 + splice 下一题；源码不递增计数）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0, 2] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    const onComplete = vi.fn();
    ui.onComplete = onComplete;
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
    expect(btns[0].classList.contains('correct')).toBe(true);
    await vi.advanceTimersByTimeAsync(900);
    // ticket 098（ADR-0044）：多选计数 bug 解冻——答对递增 correctCount（唯一破铁律 1 项；
    // P2：递增时机为持久化成功后）
    expect(ui.correctCount).toBe(1);
    vi.useRealTimers();
    // 题目被 splice 移除 → 无题 → onComplete（计数修复后 accuracy=100）；落盘同步删除
    expect(onComplete).toHaveBeenCalledWith({ correct: 1, wrong: 0, total: 1, accuracy: 100 });
    const quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md']).toEqual([]);
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

  it('ticket 15：多选零选择点提交 → notice「请至少选择一项」，不提交不判题', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0, 2] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    (document.querySelector('.quiz-submit-btn') as HTMLElement).click();
    expect(getNoticeMessages().some((m) => m === '请至少选择一项')).toBe(true);
    // 未判题：无正确/错误高亮，无「下一题」，题目仍保留
    const btns = document.querySelectorAll('.quiz-option-btn');
    expect(btns[0].classList.contains('correct')).toBe(false);
    expect(document.querySelector('.quiz-next-btn')).toBeNull();
    expect(JSON.parse(vault.files.get(QUIZ_FILE_PATH)!).notes['A.md']).toHaveLength(1);
    expect(ui.correctCount).toBe(0);
    expect(ui.wrongCount).toBe(0);
  });

  it('mask 点击 = finishQuiz（onComplete 回调）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'Q1?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    const onComplete = vi.fn();
    ui.onComplete = onComplete; // 开考后挂回调（startQuiz 入口会清理残留）
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

  it('P2：题库空且无活跃条目 → 提示后收尾，不再静默', async () => {
    const vault = new MockVault();
    // quiz.notes 空 + review.json 无活跃条目（completed 或缺失）
    vault.files.set(QUIZ_FILE_PATH, JSON.stringify({ notes: {} }));
    vault.files.set(REVIEW_DATA_PATH, JSON.stringify([]));
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    const msgs = getNoticeMessages();
    expect(msgs[msgs.length - 1]).toBe('没有活跃笔记，无法生成题目');
    expect(document.getElementById('quiz-loading')).toBeNull(); // loading 已收尾
    expect(document.getElementById('quiz-popup')).toBeNull(); // 不渲染题目
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

  it('P1-1：复习做题中途 ESC（close）→ 先确认（ticket 17），确认后按 total=0 结算，外层 Promise 不悬挂', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const questions = [
      { question: 'RQ1?', options: ['a', 'b', 'c', 'd'], correctIndices: [0], notePath: 'A.md' },
      { question: 'RQ2?', options: ['a', 'b', 'c', 'd'], correctIndices: [1], notePath: 'A.md' },
    ];
    // 模拟复习域：外层 Promise 等待 onComplete
    const outer = new Promise<any>((resolve) => {
      ui.startReviewSession({ questions, onComplete: (r) => resolve(r) });
    });
    expect(document.getElementById('quiz-popup')).not.toBeNull();
    // 答题中途按 ESC → 先弹退出确认（未结算）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const confirmPopup = document.getElementById('__shared_confirm_popup__')!;
    expect(confirmPopup).not.toBeNull();
    expect(confirmPopup.textContent).toContain('放弃本次做题');
    expect(confirmPopup.textContent).toContain('继续做题');
    expect(document.getElementById('quiz-popup')).not.toBeNull(); // 确认前弹窗保留
    // 确认放弃 → 结算 + 关闭
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    const results = await outer;
    expect(results).toEqual({ correct: 0, wrong: 0, total: 0, accuracy: 0 }); // ADR-0044：total=0 → again 既定语义
    expect(document.getElementById('quiz-popup')).toBeNull(); // 结算后关闭
  });

  it('P1-1：复习做题中途 ESC → 取消（继续做题）不结算；答完恰好一次回调', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({
      questions: [
        { question: 'RQ1?', options: ['a', 'b', 'c', 'd'], correctIndices: [0], notePath: 'A.md' },
        { question: 'RQ2?', options: ['a', 'b', 'c', 'd'], correctIndices: [1], notePath: 'A.md' },
      ],
      onComplete,
    });
    // ESC → 确认弹窗 → 取消 → 继续做题（会话不结算、弹窗保留）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    expect(onComplete).not.toHaveBeenCalled();
    expect(document.getElementById('quiz-popup')).not.toBeNull();
    expect(document.getElementById('quiz-popup')!.textContent).toContain('RQ1?');
    // 继续作答到完成 → 恰好一次回调
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click(); // 答对 RQ1
    await vi.advanceTimersByTimeAsync(900);
    expect(document.getElementById('quiz-popup')!.textContent).toContain('RQ2?');
    (document.querySelectorAll('.quiz-option-btn')[1] as HTMLElement).click(); // 答对 RQ2
    await vi.advanceTimersByTimeAsync(900);
    vi.useRealTimers();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ correct: 2, wrong: 0, total: 2, accuracy: 100 });
  });

  it('P1-1：复习做题中途点遮罩 → 确认闸门（ticket 17）；取消继续、确认按已答结算', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({
      questions: [
        { question: 'RQ1?', options: ['a', 'b', 'c', 'd'], correctIndices: [0], notePath: 'A.md' },
        { question: 'RQ2?', options: ['a', 'b', 'c', 'd'], correctIndices: [1], notePath: 'A.md' },
      ],
      onComplete,
    });
    // 点遮罩 → 先确认（不直接结算）
    (document.getElementById('quiz-mask') as HTMLElement).click();
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    // 取消 → 继续做题
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    expect(document.getElementById('quiz-popup')).not.toBeNull();
    // 再点遮罩 → 确认放弃 → 按已答结算（0 题）
    (document.getElementById('quiz-mask') as HTMLElement).click();
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ correct: 0, wrong: 0, total: 0, accuracy: 0 });
  });

  it('P1-1：复习换题过渡不结算——多题会话中途回调不触发，完成后恰好一次', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({
      questions: [
        { question: 'RQ1?', options: ['a', 'b', 'c', 'd'], correctIndices: [0], notePath: 'A.md' },
        { question: 'RQ2?', options: ['a', 'b', 'c', 'd'], correctIndices: [1], notePath: 'A.md' },
      ],
      onComplete,
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    // 答对第一题 → 换题过渡（renderModal 内部只拆 DOM）
    (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    expect(onComplete).not.toHaveBeenCalled(); // 过渡不得误触发结算
    expect(document.getElementById('quiz-popup')!.textContent).toContain('RQ2?');
    // 答对第二题 → 会话完成 → 回调恰好一次
    (document.querySelectorAll('.quiz-option-btn')[1] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ correct: 2, wrong: 0, total: 2, accuracy: 100 });
    vi.useRealTimers();
  });

  it('P1-1：残留回调清理——复习中断后再普通做题，旧回调不再被误触发', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, { 'A.md': [{ question: 'NQ?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const staleCb = vi.fn();
    // 上次复习会话（题不带 notePath：删除安全空转），答题中途 ESC 中断（ticket 17：确认后结算）
    ui.startReviewSession({
      questions: [{ question: 'RQ?', options: ['a', 'b', 'c', 'd'], correctIndices: [0] } as any],
      onComplete: staleCb,
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    expect(staleCb).toHaveBeenCalledTimes(1); // 中断时结算一次
    // 之后普通做题（入口清理残留 onComplete）→ 做完触发新回调，旧回调不再误触发
    await ui.startQuiz();
    const newCb = vi.fn();
    ui.onComplete = newCb;
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    vi.useRealTimers();
    expect(staleCb).toHaveBeenCalledTimes(1);
    expect(newCb).toHaveBeenCalledWith({ correct: 1, wrong: 0, total: 1, accuracy: 100 });
  });
});
describe('ticket 099：多选 UI（无徽标/无提示条，提交位置保留）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    document.body.innerHTML = '';
    QuizMasterUI.ai = { json: vi.fn() } as any;
    QuizMasterUI.settings = { enableMultipleChoice: true, questionsPerNote: '0', shuffleQuestions: false, difficulty: 'random' };
  });

  it('多选不显示「多选」徽标与提示条；提交按钮位于选项下方；单选不受影响', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, {
      'A.md': [
        { question: 'M?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0, 2] },
        { question: 'S?', options: ['甲', '乙', '丙', '丁'], correctIndices: [0] },
      ],
    });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    await ui.startQuiz();
    const popup = document.getElementById('quiz-popup')!;
    // ticket 099：多选静默——无徽标、无提示条
    expect(popup.querySelector('.quiz-multi-badge')).toBeNull();
    expect(popup.textContent).not.toContain('本题为多选题');
    // 标题仍显示笔记名与题号
    expect(popup.textContent).toContain('📝 A (1/2)');
    // 提交按钮位于最后一个选项之后（DOM 顺序）
    const opts = popup.querySelectorAll('.quiz-option-btn');
    const submit = popup.querySelector('.quiz-submit-btn') as HTMLElement;
    // submit 与最后一个选项同容器且位于其后（compareDocumentPosition：FOLLOWING=4）
    expect(opts[opts.length - 1].compareDocumentPosition(submit) & 4).toBeTruthy();
    // 勾选正确项（0+2）→ 提交 → splice → 下一题（单选：同样无徽标/提示条/提交）
    (opts[0] as HTMLElement).click();
    (opts[2] as HTMLElement).click();
    submit.click();
    await new Promise((r) => setTimeout(r, 900));
    const popup2 = document.getElementById('quiz-popup')!;
    expect(popup2.querySelector('.quiz-multi-badge')).toBeNull();
    expect(popup2.textContent).not.toContain('本题为多选题');
    expect(popup2.querySelector('.quiz-submit-btn')).toBeNull();
  });

  it('题目缺 notePath → 标题降级不崩溃（待重做队列曾致 split 报错）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '内容');
    seedQuiz(vault, {
      'A.md': [{ question: 'NP?', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }],
    });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    // 直接以缺 notePath 的题开复习会话（模拟旧数据/异常链路）
    ui.startReviewSession({
      questions: [{ question: 'NP?', options: ['a', 'b', 'c', 'd'], correctIndices: [0] } as any],
      onComplete: null,
    });
    const popup = document.getElementById('quiz-popup')!;
    expect(popup.textContent).toContain('NP?');
    expect(popup.textContent).toContain('(1/1)');
    ui.close();
  });
});