/**
 * 复习计划 UI 补测（覆盖率目标）：头部五按钮事件链、设置弹窗 onChange 写回、
 * 难度弹窗选择回调、确认框分支、renderEntries 排序/空态、卡片阶段与到期标签全变体、
 * 抽屉「开始复习/移出」回调闭环、destroy/ESC 幂等。
 * 兼容性冻结：只按现状断言，不改生产代码。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, Platform as MockPlatform, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeSettingsModal } from '../../src/core/settings-modal';
import { closeItemMenu } from '../../src/core/item-actions';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';
import type { ReviewItem } from '../../src/review/data';
import { UIManager } from '../../src/review/ui';
import { reviewApp } from '../../src/review/app';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

/** 手工构造运行时条目（renderEntries 直喂，绕开数据层） */
function mkItem(partial: any = {}): any {
  const now = new Date();
  return {
    id: 'x',
    filePath: 'A.md',
    name: 'A',
    reviewStart: now.toISOString(),
    stage: 0,
    phase: 'ladder',
    stability: 1,
    difficulty: 0.3,
    reviewHistory: [],
    totalReviews: 0,
    averageConfidence: 0,
    nextReviewDate: now.toISOString(),
    lastReviewed: null,
    lastDifficulty: null,
    completed: false,
    isCompleted: false,
    isOverdue: false,
    currentStage: 1,
    totalStages: 10,
    ...partial,
  };
}

function seed(vault: MockVault, rows: any[]) {
  vault.files.set(REVIEW_FILE_PATH, JSON.stringify(rows));
}

describe('UIManager 头部按钮事件链', () => {
  let vault: MockVault;
  let app: any;
  let ui: UIManager;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    clearNotices();
    setApp(null as any);
    vault = new MockVault();
    vault.files.set('A.md', '正文');
    app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({}) as any);
    ui = new UIManager(app, new ReviewDataManager(app));
  });

  afterEach(() => {
    closeItemMenu();
    closeSettingsModal();
    ui.destroy();
    MockPlatform.isMobile = false;
  });

  it('➕ 无活动文件 → 「请先打开一个笔记」；有活动文件 → addCurrentToReview 链路', async () => {
    // ① 无活动文件
    (document.getElementById('review-btn-add') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(getNoticeMessages()).toContain('请先打开一个笔记');

    // ② 有活动文件 → 动态 import('./app') 后三连调用
    app.workspace.getActiveFile = () => ({ path: 'A.md', basename: 'A' });
    const addSpy = vi.spyOn(reviewApp, 'addCurrentToReview').mockResolvedValue(undefined);
    const refreshSpy = vi.spyOn(reviewApp, 'refreshPanel').mockResolvedValue(undefined);
    const styleSpy = vi.spyOn(reviewApp, 'applyReviewStyles').mockResolvedValue(undefined);
    (document.getElementById('review-btn-add') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(addSpy).toHaveBeenCalledWith(app.workspace.getActiveFile());
    expect(refreshSpy).toHaveBeenCalled();
    expect(styleSpy).toHaveBeenCalledWith(app);

    // ③ 注入失败 → 「操作失败：…」
    addSpy.mockRejectedValue(new Error('boom'));
    (document.getElementById('review-btn-add') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(getNoticeMessages()).toContain('操作失败：boom');
  });

  it('▶️ 开始复习按钮 → autoJumpOverdue；🔍 搜索框显隐切换（收起清值并刷新）', async () => {
    const jumpSpy = vi.spyOn(reviewApp, 'autoJumpOverdue').mockResolvedValue(undefined);
    (document.getElementById('review-btn-start') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(jumpSpy).toHaveBeenCalled();

    // 搜索容器初始隐藏
    const searchContainer = ui.popup!.querySelector('input.review-search-input')!.parentElement as HTMLElement;
    expect(searchContainer.style.display).toBe('none');
    const refreshSpy = vi.spyOn(ui, 'refreshPanel').mockResolvedValue(undefined);
    // 开
    (document.getElementById('review-btn-search') as HTMLElement).click();
    expect(searchContainer.style.display).toBe('block');
    // 关：清空输入并刷新
    ui.searchInput!.value = '关键词';
    (document.getElementById('review-btn-search') as HTMLElement).click();
    expect(searchContainer.style.display).toBe('none');
    expect(ui.searchInput!.value).toBe('');
    expect(refreshSpy).toHaveBeenCalled();

    // 输入触发刷新
    refreshSpy.mockClear();
    ui.searchInput!.dispatchEvent(new Event('input'));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('📁 归档按钮切换 📂 并翻转 showArchived；❌ 关闭主面板', () => {
    const archiveBtn = document.getElementById('review-btn-archive') as HTMLElement;
    expect(archiveBtn.textContent).toBe('📁');
    archiveBtn.click();
    expect(ui.showArchived).toBe(true);
    expect(archiveBtn.textContent).toBe('📂');
    archiveBtn.click();
    expect(ui.showArchived).toBe(false);
    expect(archiveBtn.textContent).toBe('📁');

    ui.showMain();
    expect(ui.mask!.style.display).toBe('block');
    (document.getElementById('review-btn-close') as HTMLElement).click();
    expect(ui.mask!.style.display).toBe('none');
  });
});

describe('设置弹窗 onChange 写回（分组项逐个触发）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    vault = new MockVault();
    vault.files.set('A.md', '正文');
    setApp(makeApp(vault));
  });

  afterEach(() => {
    closeSettingsModal();
    MockPlatform.isMobile = false; // 防移动端用例泄漏到后续右键菜单路径
    document.body.innerHTML = '';
  });

  /** 取指定名设置项的首个控件 */
  function controlOf(name: string): any {
    const el = [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].find(
      (e) => (e as HTMLElement).dataset.name === name
    ) as any;
    expect(el, `设置项 ${name} 应存在`).toBeTruthy();
    return el.__setting.controls[0];
  }

  it('检查提醒组：到期提醒 / 新笔记加入提醒写回设置', async () => {
    const settings: any = { enableAutoNotify: true, reviewAutoAddNotice: true };
    setSettingsProvider(() => settings);
    const ui = new UIManager(makeApp(vault), new ReviewDataManager(makeApp(vault)));
    ui.showMain();
    (document.getElementById('review-btn-settings') as HTMLElement).click();
    controlOf('到期提醒').trigger(false);
    controlOf('新笔记加入提醒').trigger(false);
    await new Promise((r) => setTimeout(r, 10));
    expect(settings.enableAutoNotify).toBe(false);
    expect(settings.reviewAutoAddNotice).toBe(false);
    ui.destroy();
  });

  it('做题家组：多选/题量/打乱/难度写回；出题子容器随开关显隐', async () => {
    const settings: any = { forceQuizForReview: true };
    setSettingsProvider(() => settings);
    const ui = new UIManager(makeApp(vault), new ReviewDataManager(makeApp(vault)));
    ui.showMain();
    (document.getElementById('review-btn-settings') as HTMLElement).click();
    controlOf('允许多选题').trigger(true);
    controlOf('每篇笔记出题数量').trigger('3');
    controlOf('打乱出题顺序').trigger(true);
    controlOf('出题难度').trigger('hard');
    await new Promise((r) => setTimeout(r, 10));
    expect(settings.enableMultipleChoice).toBe(true);
    expect(settings.questionsPerNote).toBe('3');
    expect(settings.shuffleQuestions).toBe(true);
    expect(settings.difficulty).toBe('hard');
    ui.destroy();
  });

  it('复习节奏组：每日上限非法归 0；缩放超界回 1', async () => {
    const settings: any = {};
    setSettingsProvider(() => settings);
    const ui = new UIManager(makeApp(vault), new ReviewDataManager(makeApp(vault)));
    ui.showMain();
    (document.getElementById('review-btn-settings') as HTMLElement).click();
    controlOf('每日复习上限').trigger('5');
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.reviewDailyLimit).toBe(5);
    controlOf('每日复习上限').trigger('-3'); // 非正数 → 0
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.reviewDailyLimit).toBe(0);

    controlOf('复习间隔缩放').trigger('2');
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.reviewIntervalScale).toBe(2);
    controlOf('复习间隔缩放').trigger('9'); // >5 → 回 1
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.reviewIntervalScale).toBe(1);
    controlOf('复习间隔缩放').trigger('0'); // <=0 → 回 1
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.reviewIntervalScale).toBe(1);
    ui.destroy();
  });

  it('界面组文件树标记 + 移动端组默认全屏（仅移动端渲染该行）', async () => {
    const settings: any = { reviewTreeBadge: true };
    setSettingsProvider(() => settings);
    MockPlatform.isMobile = true;
    const ui = new UIManager(makeApp(vault), new ReviewDataManager(makeApp(vault)));
    ui.showMain();
    (document.getElementById('review-btn-settings') as HTMLElement).click();
    controlOf('文件树标记').trigger(false);
    controlOf('移动端默认全屏').trigger(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(settings.reviewTreeBadge).toBe(false);
    expect(settings.reviewMobileDefaultFullscreen).toBe(true);
    ui.destroy();
  });
});

describe('难度弹窗与确认框', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    clearNotices();
    vault = new MockVault();
    setApp(null as any);
    setSettingsProvider(() => ({}) as any);
  });

  afterEach(() => {
    closeItemMenu();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function mkUi(): { ui: UIManager; app: any } {
    const app = makeApp(vault);
    setApp(app);
    return { ui: new UIManager(app, new ReviewDataManager(app)), app };
  }

  it('难度弹窗：四个评级回调 onSelect(diff)；取消不回调；重开先移除旧弹窗', () => {
    const { ui } = mkUi();
    const item = mkItem({ name: '《三体》' });
    const picked: string[] = [];
    ui.showDifficultyDialog(item, (d) => picked.push(d));
    let dlg = document.querySelector('.difficulty-dialog')!;
    expect(dlg.textContent).toContain('标记复习：《三体》'); // 名称原样展示（不剥书名号）
    // 重开：旧弹窗先被移除
    ui.showDifficultyDialog(item, (d) => picked.push(d));
    expect(document.querySelectorAll('.difficulty-dialog').length).toBe(1);
    dlg = document.querySelector('.difficulty-dialog')!;
    const diffs = ['again', 'hard', 'good'];
    for (const d of diffs) {
      (dlg.querySelector(`[data-diff="${d}"]`) as HTMLElement).click();
      expect(document.querySelector('.difficulty-dialog')).toBeNull();
      ui.showDifficultyDialog(item, (x) => picked.push(x));
      dlg = document.querySelector('.difficulty-dialog')!;
    }
    (dlg.querySelector('[data-diff="cancel"]') as HTMLElement).click();
    expect(picked).toEqual(['again', 'hard', 'good']); // cancel 未入列
    ui.destroy();
  });

  it('确认框：标题缺省回退「确认」；确定执行回调后关闭；取消/遮罩只关闭', () => {
    const { ui } = mkUi();
    let ran = 0;
    ui.showConfirm('', '', () => ran++);
    expect(document.getElementById('confirm-title')!.textContent).toBe('确认'); // 空标题回退
    expect(document.getElementById('confirm-message')!.textContent).toBe('');
    (document.getElementById('confirm-ok') as HTMLElement).click();
    expect(ran).toBe(1);
    expect(ui.confirmPopup!.style.display).toBe('none');

    // 无回调点确定不炸
    ui.showConfirm('t', 'm');
    (document.getElementById('confirm-ok') as HTMLElement).click();
    // 取消
    ui.showConfirm('t2', 'm2', () => ran++);
    (document.getElementById('confirm-cancel') as HTMLElement).click();
    expect(ran).toBe(1);
    // 点遮罩（target === mask）
    ui.showConfirm('t3', 'm3', () => ran++);
    ui.confirmMask!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ran).toBe(1);
    expect(ui.confirmPopup!.style.display).toBe('none');
    ui.destroy();
  });

  it('registerEscape 幂等：重复注册后单次 ESC 只收一层', () => {
    const { ui } = mkUi();
    ui.showMain();
    ui.registerEscape(); // 二次注册应被 escapeRegistered 挡住
    const hideSpy = vi.spyOn(ui, 'hideMain');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(hideSpy).toHaveBeenCalledTimes(1);
    ui.destroy();
  });
});

describe('renderEntries 与卡片标签全变体', () => {
  let ui: UIManager;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({}) as any);
    ui = new UIManager(app, new ReviewDataManager(app));
  });

  afterEach(() => {
    ui.destroy();
    document.body.innerHTML = '';
  });

  it('排序：逾期在前，同组按 nextReviewDate 升序；归档空态专属文案', () => {
    const now = Date.now();
    const items = [
      mkItem({ id: 'b', filePath: 'B.md', name: 'B', nextReviewDate: new Date(now + 86400000).toISOString(), currentStage: 2 }),
      mkItem({ id: 'a', filePath: 'A.md', name: 'A', isOverdue: true, nextReviewDate: new Date(now - 1000).toISOString(), currentStage: 1 }),
      mkItem({ id: 'c', filePath: 'C.md', name: 'C', nextReviewDate: new Date(now + 3600000).toISOString(), currentStage: 3 }),
    ];
    ui.renderEntries(items);
    const names = [...document.querySelectorAll('#review-entries-container .review-content')].map((e) => e.textContent);
    expect(names).toEqual(['A', 'C', 'B']); // 逾期置顶，未逾期按时间升序

    // 归档视图空态文案
    ui.showArchived = true;
    ui.renderEntries([]);
    expect(document.getElementById('review-entries-container')!.textContent).toContain('没有已完成（归档）的复习');
    ui.showArchived = false;
  });

  it('名称书名号剥离 + 缺失条目删除线 + 双击缺失条目提示', () => {
    const items = [
      mkItem({ name: '《三体》', filePath: 'SANTI.md', isMissing: true, file: null }),
    ];
    ui.renderEntries(items);
    const content = document.querySelector('.review-content') as HTMLElement;
    expect(content.textContent).toBe('三体'); // 剥书名号
    expect(content.classList.contains('review-missing')).toBe(true);
    content.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(getNoticeMessages()).toContain('文件已删除'); // 挂起记录不可打开
  });

  it('阶段标签变体：已完成 / 逾期(FSRS) / 逾期(阶梯) / FSRS Lv.N / N/10 文案', () => {
    const cases: [any, string][] = [
      [{ phase: 'fsrs', stage: 12, currentStage: 13, isOverdue: true }, '⚠️ 逾期 (FSRS)'],
      [{ phase: 'ladder', currentStage: 2, isOverdue: true }, '⚠️ 逾期 (30m)'],
      [{ phase: 'fsrs', stage: 12, currentStage: 13 }, 'FSRS Lv.4'],
      [{ phase: 'ladder', currentStage: 3 }, '3/10'],
    ];
    for (const [partial, expected] of cases) {
      ui.renderEntries([mkItem({ name: 'T', ...partial })]);
      const tag = document.querySelector('.review-tag') as HTMLElement;
      expect(tag.textContent).toContain(expected);
    }
    // 已完成条目默认被归档过滤隐藏：开归档后渲染并显示「✅ 已完成」
    ui.showArchived = true;
    ui.renderEntries([mkItem({ name: 'T', completed: true, isCompleted: true, currentStage: 10 })]);
    expect((document.querySelector('.review-tag') as HTMLElement).textContent).toBe('✅ 已完成');
    ui.showArchived = false;
  });

  it('到期时间变体：2d / 5h / 45m / 📅 逾期 / ⏳ 待定 / 文件缺失 / ✅ 完成', () => {
    const now = Date.now();
    const cases: [any, string][] = [
      [{ nextReviewDate: new Date(now + 2 * 86400000 + 6 * 3600000).toISOString() }, '⏳ 2d'],
      [{ nextReviewDate: new Date(now + 5 * 3600000 + 30 * 60000).toISOString() }, '⏳ 5h'], // 留余量只验单位选择
      [{ nextReviewDate: new Date(now + 45 * 60000 + 30000).toISOString() }, '⏳ 45m'],
      [{ nextReviewDate: new Date(now - 60000).toISOString(), isOverdue: true }, '📅 逾期'],
      [{ nextReviewDate: null }, '⏳ 待定'],
      [{ isMissing: true, file: null }, '文件缺失'],
    ];
    for (const [partial, expected] of cases) {
      ui.renderEntries([mkItem({ name: 'T', ...partial })]);
      const time = document.querySelector('.review-time') as HTMLElement;
      expect(time.textContent).toBe(expected);
    }
    // 已完成条目默认被归档过滤隐藏：开归档渲染后显示「✅ 完成」
    ui.showArchived = true;
    ui.renderEntries([mkItem({ name: 'T', isCompleted: true, completed: true, nextReviewDate: new Date(now).toISOString() })]);
    expect((document.querySelector('.review-time') as HTMLElement).textContent).toBe('✅ 完成');
    ui.showArchived = false;
  });

  it('信心标签（非 FSRS 且 >0）；FSRS R(t) 徽标按保留率着色三档（jsdom rgba 归一化）', () => {
    // ① 信心 85%（阶梯阶段）
    ui.renderEntries([mkItem({ averageConfidence: 0.85 })]);
    const metaText = (document.querySelector('.review-meta') as HTMLElement).textContent!;
    expect(metaText).toContain('🎯 85%');

    // ② FSRS R≥0.9 绿
    const now = Date.now();
    ui.renderEntries([
      mkItem({ phase: 'fsrs', stage: 12, currentStage: 13, stability: 100, lastReviewed: new Date(now).toISOString() }),
    ]);
    let rTag = [...document.querySelectorAll('.review-tag')].find((e) => e.textContent!.startsWith('R=')) as HTMLElement;
    expect(rTag.style.background).toBe('rgba(82, 196, 26, 0.133)'); // #52c41a22

    // ③ 0.7≤R<0.9 黄（stability 5、2 天前）
    ui.renderEntries([
      mkItem({
        phase: 'fsrs', stage: 12, currentStage: 13, stability: 5,
        lastReviewed: new Date(now - 2 * 86400000).toISOString(),
      }),
    ]);
    rTag = [...document.querySelectorAll('.review-tag')].find((e) => e.textContent!.startsWith('R=')) as HTMLElement;
    const pct = parseInt(rTag.textContent!.replace(/\D/g, ''), 10);
    expect(pct).toBeGreaterThanOrEqual(70);
    expect(pct).toBeLessThan(90);
    expect(rTag.style.background).toBe('rgba(250, 173, 20, 0.133)'); // #faad1422

    // ④ R<0.7 红（stability 1、30 天前）
    ui.renderEntries([
      mkItem({
        phase: 'fsrs', stage: 12, currentStage: 13, stability: 1,
        lastReviewed: new Date(now - 30 * 86400000).toISOString(),
      }),
    ]);
    rTag = [...document.querySelectorAll('.review-tag')].find((e) => e.textContent!.startsWith('R=')) as HTMLElement;
    expect(parseInt(rTag.textContent!.replace(/\D/g, ''), 10)).toBeLessThan(70);
    expect(rTag.style.background).toBe('rgba(255, 71, 87, 0.133)'); // #ff475722

    // ⑤ FSRS 但无 lastReviewed → 不渲染 R 标
    ui.renderEntries([mkItem({ phase: 'fsrs', stage: 12, currentStage: 13, stability: 100, lastReviewed: null })]);
    expect([...document.querySelectorAll('.review-tag')].some((e) => e.textContent!.startsWith('R='))).toBe(false);
  });
});

describe('抽屉动作闭环（桌面右键菜单路径）', () => {
  let vault: MockVault;
  let app: any;
  let ui: UIManager;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    clearNotices();
    setApp(null as any);
    setSettingsProvider(() => ({}) as any);
    MockPlatform.isMobile = false;
    vault = new MockVault();
    vault.files.set('A.md', '正文');
    app = makeApp(vault);
    setApp(app);
  });

  afterEach(() => {
    closeItemMenu();
    closeSettingsModal();
    ui?.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    MockPlatform.isMobile = false;
  });

  /** 右键卡片打开菜单 */
  function openMenu(card: HTMLElement) {
    card.dispatchEvent(
      new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 })
    );
    return document.querySelector('.bz-item-menu') as HTMLElement;
  }

  function firstCard(): HTMLElement {
    return document.querySelector('#review-entries-container .review-card') as HTMLElement;
  }

  it('开始复习 → 难度弹窗选「一般」→ markReview/refreshPanel/applyReviewStyles + 收抽屉', async () => {
    const now = new Date();
    seed(vault, [
      { id: '1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]);
    ui = new UIManager(app, new ReviewDataManager(app));
    ui.showMain();
    await ui.refreshPanel();
    const menu = openMenu(firstCard());
    ([...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('开始复习')) as HTMLElement).click();
    const dlg = document.querySelector('.difficulty-dialog') as HTMLElement;
    expect(dlg).not.toBeNull();
    const markSpy = vi.spyOn(reviewApp, 'markReview').mockResolvedValue(undefined);
    const styleSpy = vi.spyOn(reviewApp, 'applyReviewStyles').mockResolvedValue(undefined);
    const refreshSpy = vi.spyOn(ui, 'refreshPanel').mockResolvedValue(undefined);
    (dlg.querySelector('[data-diff="good"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(markSpy).toHaveBeenCalledWith('A.md', 'good');
    expect(refreshSpy).toHaveBeenCalled();
    expect(styleSpy).toHaveBeenCalledWith(app);
    expect(document.querySelector('.bz-item-menu')).toBeNull(); // 列表重绘后抽屉关闭
  });

  it('移出复习计划 → 确认框确定 → removeItem + 刷新 + 染色', async () => {
    const now = new Date();
    seed(vault, [
      { id: '1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]);
    const dm = new ReviewDataManager(app);
    ui = new UIManager(app, dm);
    ui.showMain();
    await ui.refreshPanel();
    const menu = openMenu(firstCard());
    ([...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('移出复习计划')) as HTMLElement).click();
    expect(document.getElementById('confirm-title')!.textContent).toBe('移出复习计划');
    const removeSpy = vi.spyOn(dm, 'removeItem').mockResolvedValue(undefined);
    const styleSpy = vi.spyOn(reviewApp, 'applyReviewStyles').mockResolvedValue(undefined);
    const refreshSpy = vi.spyOn(ui, 'refreshPanel').mockResolvedValue(undefined);
    (document.getElementById('confirm-ok') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(removeSpy).toHaveBeenCalledWith('A.md');
    expect(refreshSpy).toHaveBeenCalled();
    expect(styleSpy).toHaveBeenCalledWith(app);
  });

  it('缺失记录抽屉「打开原文」→ 主面板隐藏 + 「文件已删除」成功通知', async () => {
    const now = new Date();
    seed(vault, [
      { id: '2', filePath: 'GONE.md', name: 'GONE', reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false },
    ]);
    ui = new UIManager(app, new ReviewDataManager(app));
    ui.showMain();
    await ui.refreshPanel();
    const menu = openMenu(firstCard());
    const labels = [...menu.querySelectorAll('.bz-item-menu-item')].map((b) => b.textContent);
    expect(labels).not.toContain('开始复习'); // 挂起记录不给开始复习
    ([...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('打开原文')) as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(getNoticeMessages()).toContain('文件已删除');
    expect(ui.mask!.style.display).toBe('none'); // openItemFile 先收主面板
  });
});
