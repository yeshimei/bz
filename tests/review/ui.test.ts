/**
 * 复习计划 UI 测试（ticket 16 修正版）：常驻 DOM/渲染/难度弹窗/确认框/归档语义
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';
import { UIManager } from '../../src/review/ui';
import { reviewApp } from '../../src/review/app';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function seed(vault: MockVault, extra: any[] = []) {
  const now = new Date();
  vault.files.set('A.md', '正文');
  vault.files.set('B.md', '正文');
  vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
    {
      id: '1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 1, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    },
    {
      id: '2', filePath: 'B.md', name: 'B', reviewStart: now.toISOString(), stage: 8, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() + 3600000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    },
    ...extra,
  ]));
}

describe('UIManager', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
  });

  it('构造即建常驻 DOM（display none）+ 样式注入', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    const mask = document.getElementById('review-mask')!;
    const popup = document.getElementById('review-popup')!;
    expect(mask).not.toBeNull();
    expect(popup).not.toBeNull();
    expect(mask.style.display).toBe('none');
    expect(popup.style.display).toBe('none');
    expect(mask.style.zIndex).toBe('9998');
    expect(popup.style.maxWidth).toBe('800px');
    expect(document.querySelector('style[data-review-styles]')).not.toBeNull();
    expect(document.getElementById('review-btn-add')).not.toBeNull();
    // 无 emoji 标题
    expect(popup.querySelector('h3')!.textContent).toBe('复习计划');
    ui.destroy();
  });

  it('showMain 显示 + 渲染卡片（逾期/阶梯/时间单单位）', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    expect(ui.mask!.style.display).toBe('block');
    expect(ui.popup!.style.display).toBe('flex');
    await ui.refreshPanel();
    const container = document.getElementById('review-entries-container')!;
    // A 逾期排前
    const cards = container.querySelectorAll('.review-card');
    expect(cards.length).toBe(2);
    expect(container.textContent).toContain('逾期 (30m)'); // stage=1 → text[1]
    expect(container.textContent).toContain('9/10 60d'); // stage=8 → currentStage 9
    // 时间单单位
    expect(container.textContent).toContain('📅 逾期');
    expect(container.textContent).toContain('⏳ 59m'); // 单单位
    // 归档默认隐藏已完成
    expect(container.textContent).not.toContain('已完成');
    ui.destroy();
  });

  it('归档开关语义：false=仅未完成，true=全部', async () => {
    const vault = new MockVault();
    vault.files.set('C.md', '正文');
    const now = new Date();
    seed(vault, [
      {
        id: '3', filePath: 'C.md', name: 'C', reviewStart: now.toISOString(), stage: 0, phase: 'ladder',
        stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
        nextReviewDate: now.toISOString(), lastReviewed: null, lastDifficulty: null, completed: true,
      },
    ]);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    await ui.refreshPanel();
    const container = document.getElementById('review-entries-container')!;
    expect(container.querySelectorAll('.review-card').length).toBe(2); // 未完成 2 个
    ui.showArchived = true;
    await ui.refreshPanel();
    expect(container.querySelectorAll('.review-card').length).toBe(3); // 全部
    expect(container.textContent).toContain('已完成');
    ui.destroy();
  });

  it('搜索过滤 + 空态文案', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    await ui.refreshPanel();
    ui.searchInput!.value = 'B';
    await ui.refreshPanel();
    const container = document.getElementById('review-entries-container')!;
    expect(container.querySelectorAll('.review-card').length).toBe(1);
    expect(container.textContent).toContain('B');
    ui.searchInput!.value = 'ZZZ';
    await ui.refreshPanel();
    expect(container.textContent).toContain('没有复习计划 🎉');
    ui.destroy();
  });

  it('难度弹窗：标题「标记复习：X」+ 4 色条按钮 + cancel + 外点关闭', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    const items = await dm.loadItems();
    ui.showDifficultyDialog(items[0], () => {});
    const dialog = document.querySelector('.difficulty-dialog') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('标记复习：A');
    const btns = dialog.querySelectorAll('.diff-btn');
    expect(btns.length).toBe(5);
    expect(btns[0].textContent).toContain('🟥 忘了（Again）');
    expect((btns[0] as HTMLElement).style.borderLeft).toContain('3px solid rgb(255, 71, 87)'); // #ff4757
    expect((btns[4] as HTMLElement).dataset.diff).toBe('cancel');
    // 外点关闭（等 100ms 后 handler 注册完成，再点外部区域）
    await new Promise((r) => setTimeout(r, 150));
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('.difficulty-dialog')).toBeNull();
    ui.destroy();
  });

  it('确认框：confirm-* id + 确定按钮 accent', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showConfirm('移出复习计划', '确定移出“A”？', () => {});
    expect(ui.confirmPopup).not.toBeNull();
    expect(ui.confirmPopup!.style.display).toBe('flex');
    expect(document.getElementById('confirm-title')!.textContent).toBe('移出复习计划');
    expect(document.getElementById('confirm-message')!.textContent).toBe('确定移出“A”？');
    ui.destroy();
  });

  it('⚙️ 设置弹窗：检查间隔/逾期通知 + 做题家 5 项', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({
      autoCheckInterval: '60', enableAutoNotify: true, forceQuizForReview: true,
      enableMultipleChoice: true, questionsPerNote: '0', shuffleQuestions: true, difficulty: 'random',
    }));
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    const settingsBtn = document.getElementById('review-btn-settings') as HTMLElement;
    expect(settingsBtn).not.toBeNull();
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('复习计划设置');
    const names = [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    expect(names).toContain('检查间隔（秒）');
    expect(names).toContain('启用逾期通知');
    expect(names).toContain('做题决定难度');
    expect(names).toContain('允许多选题');
    expect(names).toContain('每笔记题目数量（0为自动）');
    expect(names).toContain('打乱题目顺序');
    expect(names).toContain('题目难度');
    ui.destroy();
  });

  it('ESC：confirm 优先，其次主面板', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    ui.showConfirm('t', 'm', () => {});
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ui.confirmPopup!.style.display).toBe('none');
    expect(ui.mask!.style.display).toBe('block');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ui.mask!.style.display).toBe('none');
    ui.destroy();
  });

  it('长按 timeSpan 500ms → 移出确认', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    await ui.refreshPanel();
    const container = document.getElementById('review-entries-container')!;
    const timeSpan = container.querySelector('.review-time') as HTMLElement;
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    timeSpan.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    await vi.advanceTimersByTimeAsync(550);
    vi.useRealTimers();
    expect(document.getElementById('confirm-title')!.textContent).toBe('移出复习计划');
    ui.destroy();
  });
});

describe('quizReviewLoop 集成', () => {
  it('做题完成后 onComplete → 结果弹窗（🎯/答对/自动标记/下一篇）', async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();

    // mock quizUI（按复习联动契约实现 startReviewSession/endReviewSession）
    const quiz: any = {
      _reviewMode: false,
      mask: null,
      popup: null,
      currentQuestions: [],
      currentIndex: 0,
      correctCount: 0,
      wrongCount: 0,
      totalQuestions: 0,
      onComplete: null,
      startReviewSession(opts: any) {
        this._reviewMode = true;
        this.currentQuestions = opts.questions;
        this.currentIndex = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.totalQuestions = opts.questions.length;
        this.onComplete = opts.onComplete;
        this.showQuestion();
      },
      endReviewSession() {
        this._reviewMode = false;
      },
      showQuestion() {
        this.mask = document.createElement('div');
        this.popup = document.createElement('div');
        this.popup.id = 'quiz-popup';
        this.popup.innerHTML = '<div class="quiz-q">题目</div>';
        document.body.appendChild(this.mask);
        document.body.appendChild(this.popup);
      },
    };

    (reviewApp as any)._quizOverride = quiz;
    const items = await dm.loadItems();
    const batch: Record<string, any[]> = {
      'A.md': [{ question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndices: [0] }],
    };
    const p = reviewApp.quizReviewLoop(items.slice(0, 1), 0, batch);
    await new Promise((r) => setTimeout(r, 20));
    expect(quiz._reviewMode).toBe(true);
    // 触发 onComplete（模拟答完）
    quiz.onComplete({ correct: 1, wrong: 0, total: 1, accuracy: 100 });
    await new Promise((r) => setTimeout(r, 50));
    expect(quiz.popup.innerHTML).toContain('🎯 A');
    expect(quiz.popup.innerHTML).toContain('答对 1 题　❌ 答错 0 题');
    expect(quiz.popup.innerHTML).toContain('自动标记：简单');
    expect(quiz.popup.innerHTML).toContain('完成复习'); // 最后一篇
    // 点击完成 → 所有做题复习已完成
    quiz.popup.querySelector('#quiz-next-note')!.click();
    await new Promise((r) => setTimeout(r, 50));
    ui.destroy();
  });
});
