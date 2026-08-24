/**
 * 复习计划 UI 测试（ticket 16 修正版）：常驻 DOM/渲染/难度弹窗/确认框/归档语义
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeSettingsModal } from '../../src/core/settings-modal';
import { closeItemMenu } from '../../src/core/item-actions';
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
    expect(document.querySelector('style[data-review-styles]')).toBeNull(); // 样式已收敛 styles.css，不再运行时注入
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

  it('⚙️ 设置弹窗：分组卡片 + 新文案（检查提醒/做题家/复习节奏/自动化/界面），无检查间隔', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const settings: any = {
      enableAutoNotify: true, reviewAutoAddNotice: true, forceQuizForReview: true,
      enableMultipleChoice: true, questionsPerNote: '0', shuffleQuestions: true, difficulty: 'random',
      reviewDailyLimit: 0, reviewIntervalScale: 1, reviewTreeBadge: true,
    };
    setSettingsProvider(() => settings);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    const settingsBtn = document.getElementById('review-btn-settings') as HTMLElement;
    expect(settingsBtn).not.toBeNull();
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('复习计划设置');
    const names = () => [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    // 无检查间隔（已删）
    expect(names()).not.toContain('检查间隔（秒）');
    // 分组卡片头（组名；桌面端无「移动端」组）
    const groupNames = [...popup.querySelectorAll('.bz-settings-group-name')].map((el) => el.textContent);
    expect(groupNames).toEqual(['检查提醒', '做题家', '复习节奏', '自动化', '界面']);
    // 检查提醒组
    expect(names()).toContain('到期提醒');
    expect(names()).toContain('新笔记加入提醒');
    // 做题家组（用做题测难度 toggle + 出题子容器 4 项；forceQuizForReview 开 → 全部计入徽标）
    expect(names()).toContain('用做题测难度');
    expect(names()).toContain('允许多选题');
    expect(names()).toContain('每篇笔记出题数量');
    expect(names()).toContain('打乱出题顺序');
    expect(names()).toContain('出题难度');
    // 复习节奏组
    expect(names()).toContain('每日复习上限');
    expect(names()).toContain('复习间隔缩放');
    // 界面组
    expect(names()).toContain('文件树标记');
    // 分组项数徽标（隐藏项不计；自动化组的「＋ 添加监听文件夹」为纯操作行，挂 bz-setting-action-row 豁免）
    const badge = (groupName: string) =>
      [...popup.querySelectorAll('.bz-settings-group')].find(
        (g) => g.querySelector('.bz-settings-group-name')!.textContent === groupName
      )!.querySelector('.bz-settings-group-count')!.textContent;
    expect(badge('检查提醒')).toBe('2 项');
    expect(badge('做题家')).toBe('5 项');
    expect(badge('复习节奏')).toBe('2 项');
    expect(badge('自动化')).toBe('1 项');
    expect(badge('界面')).toBe('1 项');
    ui.destroy();
  });

  it('⚙️ 设置弹窗：用做题测难度关闭 → 出题子容器隐藏，开启 toggle 后显示，做题家组徽标随显隐刷新', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ forceQuizForReview: false } as any));
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    (document.getElementById('review-btn-settings') as HTMLElement).click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const quizBox = popup.querySelector('#review-quiz-settings') as HTMLElement;
    expect(quizBox.style.display).toBe('none');
    // 做题家组徽标：出题子容器隐藏时仅计 toggle → 1 项
    const badge = () =>
      [...popup.querySelectorAll('.bz-settings-group')].find(
        (g) => g.querySelector('.bz-settings-group-name')!.textContent === '做题家'
      )!.querySelector('.bz-settings-group-count')!.textContent;
    expect(badge()).toBe('1 项');
    // 用做题测难度 toggle 开启 → 出题子容器显示，徽标经 refreshSettingsGroupCounts 刷新 → 5 项
    const toggleSetting = [...popup.querySelectorAll('.setting-item')].find(
      (el) => (el as HTMLElement).dataset.name === '用做题测难度'
    ) as HTMLElement;
    const toggle = (toggleSetting as any).__setting.controls[0];
    toggle.trigger(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(quizBox.style.display).toBe('');
    expect(badge()).toBe('5 项');
    closeSettingsModal();
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

  it('右键卡片 → 菜单「移出复习计划」→ 确认弹窗', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    await ui.refreshPanel();
    const container = document.getElementById('review-entries-container')!;
    const card = container.querySelector('.review-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
    const removeItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('移出复习计划')
    ) as HTMLElement;
    expect(removeItem).toBeTruthy();
    removeItem.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.getElementById('confirm-title')!.textContent).toBe('移出复习计划');
    ui.destroy();
  });

  it('抽屉（移动端长按）：头部🔁名称+阶段·到期；未完成动作=开始复习/打开原文/移出；点开始复习弹难度窗', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    await ui.refreshPanel();
    const card = document.querySelector('#review-entries-container .review-card') as HTMLElement;

    MockPlatform.isMobile = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    await vi.advanceTimersByTimeAsync(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 10));

    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    // 头部：🔁 + 名称 + 阶段·到期小字
    expect(sheet.querySelector('.bz-item-sheet-emoji')!.textContent).toBe('🔁');
    expect(sheet.querySelector('.bz-item-sheet-sub')!.textContent).toContain('逾期');
    // 动作清单
    const labels = [...sheet.querySelectorAll('.bz-item-sheet-label')].map((e) => e.textContent);
    expect(labels).toEqual(['开始复习', '打开原文', '移出复习计划']);

    // 点「开始复习」→ 难度弹窗（companion 叠抽屉）
    const startItem = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('开始复习')
    ) as HTMLElement;
    startItem.click();
    await new Promise((r) => setTimeout(r, 10));
    const dlg = document.querySelector('.difficulty-dialog') as HTMLElement;
    expect(dlg).not.toBeNull();
    expect(dlg.textContent).toContain('标记复习');
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull(); // 抽屉保持

    // 点「取消」难度窗 → 抽屉仍在
    const cancelBtn = [...dlg.querySelectorAll('.diff-btn')].find((b) => b.textContent!.includes('取消')) as HTMLElement;
    cancelBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();

    closeItemMenu();
    MockPlatform.isMobile = false;
    ui.destroy();
  });

  it('双击名称打开对应笔记（保留手势）', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    const openFile = vi.fn().mockResolvedValue(undefined);
    (app.workspace as any).getLeaf = () => ({ openFile });
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    await ui.refreshPanel();
    const content = document.querySelector('#review-entries-container .review-content') as HTMLElement;
    content.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(ui.mask!.style.display).toBe('none'); // 主面板隐藏
    expect(openFile).toHaveBeenCalled();
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

describe('移动端默认全屏（ticket 68）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    MockPlatform.isMobile = false;
  });

  afterEach(() => {
    MockPlatform.isMobile = false;
  });

  it('移动端+开关开（默认开）：showMain 后 popup 挂 bz-win-mfs；开关关不挂；桌面端恒不挂', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    // 桌面端：设置开也不挂
    setSettingsProvider(() => ({ reviewMobileDefaultFullscreen: true } as any));
    ui.showMain();
    expect(ui.popup!.classList.contains('bz-win-mfs')).toBe(false);
    // 移动端 + 开
    setSettingsProvider(() => ({ reviewMobileDefaultFullscreen: true } as any));
    MockPlatform.isMobile = true;
    ui.showMain();
    expect(ui.popup!.classList.contains('bz-win-mfs')).toBe(true);
    // 移动端 + 关
    setSettingsProvider(() => ({ reviewMobileDefaultFullscreen: false } as any));
    ui.showMain();
    expect(ui.popup!.classList.contains('bz-win-mfs')).toBe(false);
    ui.destroy();
  });

  it('设置弹窗：仅移动端显示「移动端默认全屏」行', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    setSettingsProvider(() => ({}) as any);
    const settingNames = () =>
      [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].map((el) => (el as HTMLElement).dataset.name);
    // 桌面端：无该行（设置项名在 dataset.name，与既有断言口径一致）
    (document.getElementById('review-btn-settings') as HTMLElement).click();
    expect(settingNames()).not.toContain('移动端默认全屏');
    // 移动端：有该行（toggle 语义：再点先关旧再开新）
    MockPlatform.isMobile = true;
    (document.getElementById('review-btn-settings') as HTMLElement).click();
    expect(settingNames()).toContain('移动端默认全屏');
    closeSettingsModal();
    ui.destroy();
  });
});
describe('ticket 098 UI：做题家图标移除 / 挂起记录删除线 / 监听文件夹设置行', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('主面板头部不再含 🎯 做题家按钮', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    expect(document.getElementById('review-btn-quiz')).toBeNull();
    (ui as any).createMainUI();
    expect(document.getElementById('review-btn-quiz')).toBeNull();
    ui.destroy();
  });

  it('挂起记录（文件缺失）→ 删除线卡片；抽屉无「开始复习」', async () => {
    const vault = new MockVault();
    const now = new Date();
    seed(vault, [
      {
        id: '3', filePath: 'GONE.md', name: 'GONE', reviewStart: now.toISOString(), stage: 0, phase: 'ladder',
        stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
        nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
      },
    ]);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    await ui.refreshPanel();
    const container = document.getElementById('review-entries-container')!;
    expect(container.textContent).toContain('不存在');
    const contentEl = [...container.querySelectorAll('.review-content')].find((el) => el.textContent === 'GONE') as HTMLElement;
    expect(contentEl).toBeTruthy();
    expect(contentEl.classList.contains('review-missing')).toBe(true);
    // 抽屉：无「开始复习」，保留「打开原文」「移出复习计划」
    const card = contentEl.closest('.review-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    const labels = [...document.querySelectorAll('.bz-item-menu-item')].map((b) => b.textContent);
    expect(labels).toContain('打开原文');
    expect(labels).toContain('移出复习计划');
    expect(labels).not.toContain('开始复习');
    closeItemMenu();
    ui.destroy();
  });

  it('⚙️ 设置弹窗：监听文件夹 chip（名字+关闭标签）+ 添加按钮打开文件夹选择弹窗', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    // 同一 settings 实例：UI 闭包与 ReviewWatcher.removeWatchedFolder 必须读写同一对象
    const settings: any = { reviewWatchedFolders: ['卡片盒'], reviewExcludedNotes: [] };
    setSettingsProvider(() => settings);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    (document.getElementById('review-btn-settings') as HTMLElement).click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const names = () => [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    expect(names()).toContain('监听文件夹');
    // 已有监听目录 → chip 形态（名字 + ✕ 关闭标签）
    const watchBox = popup.querySelector('#review-watch-folders')!;
    expect(watchBox.querySelector('.bz-review-watch-name')!.textContent).toBe('卡片盒');
    const chipClose = watchBox.querySelector('.bz-review-watch-close') as HTMLElement;
    expect(chipClose).not.toBeNull();
    // ✕ 关闭标签移除该目录（同时清空其下排除记录，见 watch.test removeWatchedFolder）；异步链路 → 轮询等待
    chipClose.click();
    for (let i = 0; i < 100 && popup.querySelector('#review-watch-folders .bz-review-watch-chip'); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(popup.querySelector('#review-watch-folders .bz-review-watch-chip')).toBeNull();
    // ＋ 添加监听文件夹 → 打开附件搬移同款选择弹窗（ticket 099 追加复用；层级 200000 压设置弹窗）
    const addBtn = [...popup.querySelectorAll('#review-watch-folders button')].find(
      (b) => b.textContent === '＋ 添加监听文件夹'
    ) as HTMLElement;
    expect(addBtn).toBeTruthy();
    addBtn.click();
    for (let i = 0; i < 100 && !document.getElementById('bz-attach-folder-mask'); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const pickerMask = document.getElementById('bz-attach-folder-mask')!;
    expect(pickerMask).not.toBeNull();
    expect(pickerMask.querySelector('.bz-attach-title')!.textContent).toBe('选择监听文件夹');
    expect(pickerMask.querySelector('.bz-attach-btn--primary')!.textContent).toBe('确定');
    closeSettingsModal();
    ui.destroy();
  });

  it('P2 回归：destroy 注销 document keydown（ESC 处理器不残留）', () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    const hideSpy = vi.spyOn(ui, 'hideMain');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(hideSpy).toHaveBeenCalledTimes(1); // 存活期 ESC 生效
    ui.destroy(); // destroy 内部也会调 hideMain，清空后再验证
    hideSpy.mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(hideSpy).not.toHaveBeenCalled(); // 旧逻辑残留监听会再次触发
  });
});