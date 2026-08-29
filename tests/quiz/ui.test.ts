/**
 * 做题家 UI 测试（ticket 141 重构版）：纯复习会话语义（普通模式随 ticket 098 退役入口一并删除）。
 * 覆盖：startReviewSession 契约 / 单选多选判定 / 持久化后计数 / 用户掌控跳题（无 800ms 强制）/ 
 * 键盘快捷键 / 头部对错计数 / 退出确认闸门 / 结果卡阶段防拆 DOM。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { QuizMasterUI, quizUI } from '../../src/quiz/ui';
import { QUIZ_FILE_PATH } from '../../src/quiz/manager';
import type { QuizQuestion } from '../../src/quiz/manager';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

/** 预置题库（manager.removeQuestion 落盘断言需要 quiz.json 存在对应笔记键） */
function seedQuiz(vault: MockVault, notes: Record<string, any[]>) {
  vault.files.set(QUIZ_FILE_PATH, JSON.stringify({ notes }));
}

/** 微任务落盘等待（removeQuestion → jsonStore 写盘在微任务内结算） */
async function flushPersist(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
  await Promise.resolve();
}

const Q = (question: string, correctIndices: number[], notePath = 'A.md'): QuizQuestion =>
  ({ question, options: ['甲', '乙', '丙', '丁'], correctIndices, notePath } as QuizQuestion);

describe('QuizMasterUI（纯复习会话）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    document.body.innerHTML = '';
    QuizMasterUI.ai = { json: vi.fn() } as any;
    QuizMasterUI.settings = { enableMultipleChoice: true, questionsPerNote: '0', shuffleQuestions: false, difficulty: 'random' };
  });

  it('startReviewSession：渲染标题/题目/选项（A. 前缀结构）+ 头部对错计数', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    ui.startReviewSession({ questions: [Q('Q1?', [0])], onComplete: vi.fn() });
    const popup = document.getElementById('quiz-popup')!;
    expect(popup).not.toBeNull();
    expect(popup.textContent).toContain('Q1?');
    expect(popup.textContent).toContain('(1/1)');
    expect(popup.textContent).toContain('A.');
    const btns = popup.querySelectorAll('.quiz-option-btn');
    expect(btns.length).toBe(4);
    expect(btns[0].querySelector('.check-mark')).not.toBeNull();
    // ticket 141：头部实时对错计数（初始 0/0）
    expect(popup.querySelector('.bz-quiz-stats')!.textContent).toBe('✅ 0 · ❌ 0');
  });

  it('普通做题模式已删除：实例无 startQuiz/showLoadingPopup', () => {
    const ui = new QuizMasterUI();
    expect((ui as any).startQuiz).toBeUndefined();
    expect((ui as any).showLoadingPopup).toBeUndefined();
  });

  it('选项文本 HTML 转义：含 < & 字符按文本显示，不截断/不解析为标签', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    ui.startReviewSession({
      questions: [{ question: 'Q?', options: ['a < b & c', 'x>y', '正常文本', 'd'], correctIndices: [0], notePath: 'A.md' } as QuizQuestion],
      onComplete: vi.fn(),
    });
    const popup = document.getElementById('quiz-popup')!;
    const spans = popup.querySelectorAll('.quiz-option-btn span');
    const texts = [...spans].map((s) => s.textContent || '');
    expect(texts.some((t) => t.includes('a < b & c'))).toBe(true);
    expect(texts.some((t) => t.includes('x>y'))).toBe(true);
    // 未被当作 HTML 解析（每个按钮 3 个 span：标签/文本/check-mark，4 按钮 = 12）
    expect(popup.querySelectorAll('.quiz-option-btn span').length).toBe(12);
  });

  it('单选答对：标绿 + 持久化成功自动进入下一题（无「下一题」按钮）+ splice 计数', async () => {
    const vault = new MockVault();
    seedQuiz(vault, { 'A.md': [Q('Q1?', [0]), Q('Q2?', [1])] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [Q('Q1?', [0]), Q('Q2?', [1])], onComplete });
    expect(ui.totalQuestions).toBe(2);
    // 答对 Q1：答对不出现「下一题」按钮，正确选项即时标绿
    (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click();
    expect(document.querySelector('.quiz-next-btn')).toBeNull();
    expect(document.querySelectorAll('.quiz-option-btn')[0].classList.contains('correct')).toBe(true);
    // 持久化成功：计数 + 头部计数同步 + 自动进入 Q2（题号 = 已完成数 + 1 = 2/2）
    await flushPersist();
    expect(ui.correctCount).toBe(1);
    expect(document.querySelector('.bz-quiz-stats')!.textContent).toBe('✅ 1 · ❌ 0');
    expect(document.getElementById('quiz-popup')!.textContent).toContain('Q2?');
    expect(document.getElementById('quiz-popup')!.textContent).toContain('(2/2)');
    // P0-2 落盘终态：被答对的 Q1 已删除，恰剩未答的 Q2
    let quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md'].map((q: any) => q.question)).toEqual(['Q2?']);
    // 答对 Q2 → 全部完成（持久化成功后自动 onComplete 回调）
    (document.querySelectorAll('.quiz-option-btn')[1] as HTMLElement).click();
    await flushPersist();
    expect(ui.correctCount).toBe(2);
    expect(onComplete).toHaveBeenCalledWith({ correct: 2, wrong: 0, total: 2, accuracy: 100 });
    expect(document.getElementById('quiz-popup')).not.toBeNull(); // 回调不关弹窗
    quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md']).toEqual([]);
  });

  it('P0-2：同笔记 5 题全对 → 库清空、会话完成回调 accuracy=100（答对自动跳题）', async () => {
    const vault = new MockVault();
    seedQuiz(vault, { 'A.md': [1, 2, 3, 4, 5].map((n) => Q(`Q${n}?`, [0])) });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [1, 2, 3, 4, 5].map((n) => Q(`Q${n}?`, [0])), onComplete });
    for (let round = 1; round <= 5; round++) {
      (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click();
      await flushPersist();
      expect(ui.correctCount).toBe(round);
    }
    expect(onComplete).toHaveBeenCalledWith({ correct: 5, wrong: 0, total: 5, accuracy: 100 });
    const quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md']).toEqual([]); // 全对 → 库空
  });

  it('P2：持久化失败 → 恢复作答态且不重复计数；重答成功只计一次并自动完成落盘删除', async () => {
    const vault = new MockVault();
    seedQuiz(vault, { 'A.md': [Q('Q1?', [0])] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [Q('Q1?', [0])], onComplete });
    // 仅首次调用注入失败，其后走真实实现（验证重答真正落盘删除）
    const removeSpy = vi.spyOn(ui.manager, 'removeQuestion')
      .mockImplementationOnce(async () => {
        throw new Error('磁盘写入失败');
      });
    const btns = () => document.querySelectorAll('.quiz-option-btn');
    // 第一次答对：持久化失败
    (btns()[0] as HTMLElement).click();
    await flushPersist();
    expect(ui.correctCount).toBe(0); // 失败不计数
    expect(getNoticeMessages().some((m) => m.includes('删除题目失败'))).toBe(true);
    // 作答态已恢复：按钮不再 disabled，仍停在当前题
    expect(btns()[0].classList.contains('disabled')).toBe(false);
    expect(document.getElementById('quiz-popup')!.textContent).toContain('Q1?');
    // 重答成功：只计一次，自动完成
    (btns()[0] as HTMLElement).click();
    await flushPersist();
    expect(ui.correctCount).toBe(1);
    expect(removeSpy).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledWith({ correct: 1, wrong: 0, total: 1, accuracy: 100 });
    const quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md']).toEqual([]);
  });

  it('单选答错：正确标绿 + 点击项标红 + 下一题按钮（不删题）+ 头部计数', () => {
    const vault = new MockVault();
    seedQuiz(vault, { 'A.md': [Q('Q1?', [0])] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    ui.startReviewSession({ questions: [Q('Q1?', [0])], onComplete: vi.fn() });
    const btns = document.querySelectorAll('.quiz-option-btn');
    (btns[1] as HTMLElement).click(); // 选错
    expect(ui.wrongCount).toBe(1);
    expect(document.querySelector('.bz-quiz-stats')!.textContent).toBe('✅ 0 · ❌ 1');
    expect(btns[0].classList.contains('correct')).toBe(true);
    expect(btns[1].classList.contains('wrong')).toBe(true);
    const nextBtn = document.querySelector('.quiz-next-btn') as HTMLElement;
    expect(nextBtn).not.toBeNull();
    expect(nextBtn.textContent).toBe('下一题 →');
    // 题目未删除
    const quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md']).toHaveLength(1);
  });

  it('题号进度：答错点下一题 → 题号递增（2/N）', () => {
    const vault = new MockVault();
    seedQuiz(vault, { 'A.md': [Q('Q1?', [0]), Q('Q2?', [0])] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    ui.startReviewSession({ questions: [Q('Q1?', [0]), Q('Q2?', [0])], onComplete: vi.fn() });
    expect(document.getElementById('quiz-popup')!.textContent).toContain('(1/2)');
    // 第一题答错 → 点下一题
    (document.querySelectorAll('.quiz-option-btn')[1] as HTMLElement).click();
    (document.querySelector('.quiz-next-btn') as HTMLElement).click();
    expect(document.getElementById('quiz-popup')!.textContent).toContain('Q2?');
    expect(document.getElementById('quiz-popup')!.textContent).toContain('(2/2)');
  });

  it('多选：selected 勾选 + 提交判定（正确：绿 + 自动完成 + 持久化计数）', async () => {
    const vault = new MockVault();
    seedQuiz(vault, { 'A.md': [{ ...Q('Q1?', [0, 2]) }] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [Q('Q1?', [0, 2])], onComplete });
    const submit = document.querySelector('.quiz-submit-btn') as HTMLElement;
    expect(submit).not.toBeNull();
    expect(submit.textContent).toBe('提交答案');
    const btns = document.querySelectorAll('.quiz-option-btn');
    (btns[0] as HTMLElement).click();
    (btns[2] as HTMLElement).click();
    expect(btns[0].classList.contains('selected')).toBe(true);
    expect(btns[0].querySelector('.check-mark')).not.toBeNull();
    submit.click();
    expect(btns[0].classList.contains('correct')).toBe(true);
    await flushPersist();
    // ticket 098（ADR-0044）：多选答对递增 correctCount（P2：持久化成功后）
    expect(ui.correctCount).toBe(1);
    // 题目被 splice 移除 → 答对自动完题 → onComplete（accuracy=100）；落盘同步删除
    expect(onComplete).toHaveBeenCalledWith({ correct: 1, wrong: 0, total: 1, accuracy: 100 });
    const quiz = JSON.parse(vault.files.get(QUIZ_FILE_PATH)!);
    expect(quiz.notes['A.md']).toEqual([]);
  });

  it('多选答错：正确绿 + 错误选中红 + 下一题按钮', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    ui.startReviewSession({ questions: [Q('Q1?', [0, 2])], onComplete: vi.fn() });
    const btns = document.querySelectorAll('.quiz-option-btn');
    (btns[0] as HTMLElement).click();
    (btns[1] as HTMLElement).click(); // 选 0+1，正确 0+2
    (document.querySelector('.quiz-submit-btn') as HTMLElement).click();
    expect(btns[0].classList.contains('correct')).toBe(true);
    expect(btns[1].classList.contains('wrong')).toBe(true);
    expect(document.querySelector('.quiz-next-btn')).not.toBeNull();
  });

  it('ticket 15：多选零选择点提交 → notice「请至少选择一项」，不提交不判题', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    ui.startReviewSession({ questions: [Q('Q1?', [0, 2])], onComplete: vi.fn() });
    (document.querySelector('.quiz-submit-btn') as HTMLElement).click();
    expect(getNoticeMessages().some((m) => m === '请至少选择一项')).toBe(true);
    // 未判题：无正确/错误高亮，无「下一题」，题目仍保留
    const btns = document.querySelectorAll('.quiz-option-btn');
    expect(btns[0].classList.contains('correct')).toBe(false);
    expect(document.querySelector('.quiz-next-btn')).toBeNull();
    expect(ui.correctCount).toBe(0);
    expect(ui.wrongCount).toBe(0);
  });

  it('ticket 141/152：键盘快捷键——1-4/A-D 选择、Enter 提交/答错下一题', async () => {
    const vault = new MockVault();
    seedQuiz(vault, { 'A.md': [Q('Q1?', [0])] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [Q('Q1?', [0])], onComplete });
    // 数字键 1 选择第一项（单选即判）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    await flushPersist();
    expect(ui.correctCount).toBe(1);
    expect(document.querySelectorAll('.quiz-option-btn')[0].classList.contains('correct')).toBe(true);
    // 答对自动完题（唯一一题）→ onComplete 已触发，无「下一题」按钮可点
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.quiz-next-btn')).toBeNull();
    // 字母键 A：焦点在 body 时点击选项（无题可答，静默无害）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('ticket 153：答错显示「下一题」按钮，Enter 可触发进入下一题', async () => {
    const vault = new MockVault();
    seedQuiz(vault, { 'A.md': [Q('Q1?', [0]), Q('Q2?', [1])] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [Q('Q1?', [0]), Q('Q2?', [1])], onComplete });
    // 数字键 2 选错（正确为索引 0）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    expect(ui.wrongCount).toBe(1);
    const nextBtn = document.querySelector('.quiz-next-btn') as HTMLElement;
    expect(nextBtn).not.toBeNull(); // 答错才出现「下一题」按钮
    // Enter 点「下一题」→ 进入 Q2
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(document.getElementById('quiz-popup')!.textContent).toContain('Q2?');
    expect(document.getElementById('quiz-popup')!.textContent).toContain('(2/2)');
  });

  it('ticket 141：键盘 Enter 多选提交（零选择时走 warning 不判题）', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    ui.startReviewSession({ questions: [Q('Q1?', [0, 2])], onComplete: vi.fn() });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(ui.correctCount).toBe(0);
    // 勾选 0+2 后 Enter 提交 → 判对
    await flushPersist();
    expect(document.querySelectorAll('.quiz-option-btn')[0].classList.contains('correct')).toBe(true);
  });

  it('打乱出题顺序设置在会话入口生效（shuffleQuestions=false 保序；true 打乱后总题数不变）', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const questions = ['RQ1?', 'RQ2?', 'RQ3?'].map((q) => Q(q, [0]));
    ui.startReviewSession({ questions, onComplete: vi.fn() });
    expect(ui.currentQuestions.map((q) => q.question)).toEqual(['RQ1?', 'RQ2?', 'RQ3?']); // false 保序
    ui.close();
    QuizMasterUI.settings = { ...QuizMasterUI.settings, shuffleQuestions: true };
    const rngSpy = vi.spyOn(ui, 'shuffleArray').mockImplementation((arr) => [...arr].reverse());
    ui.startReviewSession({ questions, onComplete: vi.fn() });
    expect(ui.totalQuestions).toBe(3); // 打乱不改总数
    expect(ui.currentQuestions.map((q) => q.question)).toEqual(['RQ3?', 'RQ2?', 'RQ1?']);
    rngSpy.mockRestore();
    ui.close();
  });

  it('题目缺 notePath → 标题降级不崩溃（待重做队列曾致 split 报错）', () => {
    const vault = new MockVault();
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

describe('复习联动契约', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    document.body.innerHTML = '';
    QuizMasterUI.ai = { json: vi.fn() } as any;
    QuizMasterUI.settings = { enableMultipleChoice: true, questionsPerNote: '0', shuffleQuestions: false, difficulty: 'random' };
  });

  it('startReviewSession 设置会话状态并开始出题，endReviewSession 收尾弹窗', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const questions = [Q('RQ?', [0])];
    const onComplete = vi.fn();
    ui.startReviewSession({ questions, onComplete });
    expect(ui._sessionActive).toBe(true);
    expect(ui.currentIndex).toBe(0);
    expect(ui.correctCount).toBe(0);
    expect(ui.wrongCount).toBe(0);
    expect(ui.totalQuestions).toBe(1);
    expect(ui.onComplete).toBe(onComplete);
    expect(document.getElementById('quiz-popup')!.textContent).toContain('RQ?');
    // 结束会话：有未消费回调时防御性结算（防复习域外层 Promise 悬挂）
    ui.endReviewSession();
    expect(ui._sessionActive).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    // 回调已消费后再结束 → 纯收尾
    ui.endReviewSession();
    expect(document.getElementById('quiz-popup')).toBeNull();
  });

  it('复习做题中途 ESC → 先确认，确认后按 total=0 结算，外层 Promise 不悬挂', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const questions = [Q('RQ1?', [0]), Q('RQ2?', [1])];
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

  it('复习做题中途 ESC → 取消（继续做题）不结算；答完恰好一次回调', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [Q('RQ1?', [0]), Q('RQ2?', [1])], onComplete });
    // ESC → 确认弹窗 → 取消 → 继续做题（会话不结算、弹窗保留）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    expect(onComplete).not.toHaveBeenCalled();
    expect(document.getElementById('quiz-popup')).not.toBeNull();
    expect(document.getElementById('quiz-popup')!.textContent).toContain('RQ1?');
    // 继续作答到完成 → 恰好一次回调（答对自动跳题）
    (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click(); // 答对 RQ1
    await flushPersist();
    (document.querySelectorAll('.quiz-option-btn')[1] as HTMLElement).click(); // 答对 RQ2（自动进入）
    await flushPersist();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ correct: 2, wrong: 0, total: 2, accuracy: 100 });
  });

  it('复习做题中途点遮罩 → 确认闸门；取消继续、确认按已答结算', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [Q('RQ1?', [0]), Q('RQ2?', [1])], onComplete });
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
    await Promise.resolve(); // 流程框确认走 Promise 微任务（ticket 131），等一拍再断言
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ correct: 0, wrong: 0, total: 0, accuracy: 0 });
  });

  it('结果卡阶段（回调已消费）点遮罩/ESC 被忽略——不拆 DOM，复习循环 Promise 不悬挂', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [Q('RQ1?', [0])], onComplete });
    // 答对唯一一题 → 自动完题消费回调（复习域显示结果卡）
    (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click();
    await flushPersist();
    expect(onComplete).toHaveBeenCalledTimes(1);
    // 结果卡阶段：遮罩/ESC 均被忽略（弹窗 DOM 保留给复习域驱动）
    (document.getElementById('quiz-mask') as HTMLElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('quiz-popup')).not.toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);
    // 复习域收尾：close 强制拆除
    ui.close();
    expect(document.getElementById('quiz-popup')).toBeNull();
  });

  it('复习换题过渡不结算——多题会话中途回调不触发，完成后恰好一次', async () => {
    const vault = new MockVault();
    seedQuiz(vault, { 'A.md': [Q('RQ1?', [0]), Q('RQ2?', [1])] });
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [Q('RQ1?', [0]), Q('RQ2?', [1])], onComplete });
    // 答对第一题 → 自动进入下一题（无 800ms 强制等待）
    (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click();
    await flushPersist();
    expect(onComplete).not.toHaveBeenCalled(); // 过渡不得误触发结算
    expect(document.getElementById('quiz-popup')!.textContent).toContain('RQ2?');
    // 答对第二题 → 会话完成 → 回调恰好一次
    (document.querySelectorAll('.quiz-option-btn')[1] as HTMLElement).click();
    await flushPersist();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ correct: 2, wrong: 0, total: 2, accuracy: 100 });
  });

  it('ticket 099：多选不显示徽标/提示条，提交按钮位于选项下方', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    ui.startReviewSession({
      questions: [Q('M?', [0, 2]), Q('S?', [0])],
      onComplete: vi.fn(),
    });
    const popup = document.getElementById('quiz-popup')!;
    expect(popup.querySelector('.quiz-multi-badge')).toBeNull();
    expect(popup.textContent).not.toContain('本题为多选题');
    expect(popup.textContent).toContain('📝 A (1/2)');
    const opts = popup.querySelectorAll('.quiz-option-btn');
    const submit = popup.querySelector('.quiz-submit-btn') as HTMLElement;
    // submit 与最后一个选项同容器且位于其后（compareDocumentPosition：FOLLOWING=4）
    expect(opts[opts.length - 1].compareDocumentPosition(submit) & 4).toBeTruthy();
    ui.close();
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
