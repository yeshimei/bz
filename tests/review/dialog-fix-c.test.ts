/**
 * review 域深审批 C 回归（2026-09-19）：弹窗浮层与做题练习
 * - U4/A4/E7/U10 难度弹窗迁 openFlowDialog choice 形态（ESC/遮罩/焦点收口 + 1-4 快捷键 + onSelect 兜底）
 * - E1/C1 抽屉「移出复习计划」免确认直达 notifyUndo（效率整改 5 口径）
 * - E6 队列重建滚位/焦点记忆
 * - U1 做题会话放弃确认在途键盘不穿透（confirming 旗标）
 * - U5/C7 quiz ESC 层 handle 显式注销 + id 归 bz-<域>
 * - E5 做题练习「本轮题量」档位免重建 + 题库计数按范围键缓存 + 重建后焦点还原
 * - C15 构造期 z 发号/静态档位删（ADR-0067 仅显示时发号）
 * - F6 resetQuiz 导出（供 unloadReview 接线，归批 B/主线程）
 */
import { makeApp } from '../helpers/app';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeItemMenu } from '../../src/core/item-actions';
import { cancelActiveFlowDialog } from '../../src/core/flow-dialog';
import { escManager } from '../../src/core/esc-manager';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';
import { UIManager } from '../../src/review/ui';
import { QuizMasterUI, quizUI } from '../../src/review/quiz-core/session';
import { QUIZ_FILE_PATH } from '../../src/review/quiz-core/manager';
import { ensureQuiz, resetQuiz } from '../../src/review/quiz-core';
import { openQuizPanel, unloadQuizPanel } from '../../src/review/quiz-panel';
import type { QuizQuestion } from '../../src/review/quiz-core/manager';

const DAY0 = 86400e3;

/** 三区列测试数据：逾期 1 条 + 未来多条（滚位/焦点断言需要列内有内容） */
function seedMany(vault: MockVault, futureCount = 6) {
  const now = Date.now();
  vault.files.set('A.md', '正文');
  for (let i = 1; i <= futureCount; i++) vault.files.set(`F${i}.md`, '正文');
  const items: any[] = [
    {
      id: 'a', filePath: 'A.md', name: 'A', reviewStart: new Date(now).toISOString(), stage: 1, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    },
  ];
  for (let i = 1; i <= futureCount; i++) {
    items.push({
      id: `f${i}`, filePath: `F${i}.md`, name: `F${i}`, reviewStart: new Date(now).toISOString(), stage: 2, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now + DAY0 * (i + 1)).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    });
  }
  vault.files.set(REVIEW_FILE_PATH, JSON.stringify(items));
}

async function makeUI(vault: MockVault) {
  const app = makeApp(vault);
  setApp(app);
  const dm = new ReviewDataManager(app);
  const ui = new UIManager(app, dm);
  return { app, dm, ui };
}

const Q = (question: string, correctIndices: number[], notePath = 'A.md'): QuizQuestion =>
  ({ question, options: ['甲', '乙', '丙', '丁'], correctIndices, notePath } as QuizQuestion);

function seedQuiz(vault: MockVault, notes: Record<string, any[]>) {
  vault.files.set(QUIZ_FILE_PATH, JSON.stringify({ notes }));
}

async function flushPersist(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
  await Promise.resolve();
}

const flushTick = () => new Promise((r) => setTimeout(r, 0));

/** 未来列（按列头名取列元素） */
function colOf(name: string): HTMLElement {
  const col = [...document.querySelectorAll<HTMLElement>('.bz-q-col')].find(
    (c) => c.querySelector('.bz-q-col-head .name')?.textContent === name
  );
  expect(col).toBeTruthy();
  return col!;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  setApp(null as any);
  setSettingsProvider(() => ({}) as any);
});

afterEach(() => {
  cancelActiveFlowDialog();
  closeItemMenu();
  unloadQuizPanel();
  vi.restoreAllMocks();
});

// ==================== U4/A4/E7/U10 难度弹窗迁 openFlowDialog ====================

describe('批 C：难度弹窗迁 openFlowDialog choice 形态', () => {
  it('U4 核心：复习面板开着时 ESC 关的是难度弹窗，面板不再被误关', async () => {
    const vault = new MockVault();
    seedMany(vault);
    const { dm, ui } = await makeUI(vault);
    await ui.showMain();
    const item = (await dm.loadItems())[0];
    ui.showDifficultyDialog(item, vi.fn());
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushTick();
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull(); // 弹窗被 ESC 关闭
    expect(document.getElementById('review-mask')!.style.display).toBe('block'); // 面板仍在（不再关错层）
    ui.destroy();
  });

  it('A4：面板未开时 ESC 也能关弹窗（不再无反应孤儿浮层）', async () => {
    const vault = new MockVault();
    seedMany(vault);
    const { dm, ui } = await makeUI(vault);
    const item = (await dm.loadItems())[0];
    ui.showDifficultyDialog(item, vi.fn());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushTick();
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    ui.destroy();
  });

  it('E7：1-4 快捷键直达四档评级；修饰键组合与 5 不劫持', async () => {
    const vault = new MockVault();
    seedMany(vault);
    const { dm, ui } = await makeUI(vault);
    const item = (await dm.loadItems())[0];
    const onSelect = vi.fn();
    ui.showDifficultyDialog(item, onSelect);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2' })); // 困难
    await flushTick();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('hard');
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    // 修饰键组合不触发
    ui.showDifficultyDialog(item, onSelect);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));
    await flushTick();
    expect(onSelect).toHaveBeenCalledTimes(1); // 未新增
    // 取消（第五动作）→ 不调 onSelect
    (document.getElementById('bz-flow-dialog-action-4') as HTMLElement).click();
    await flushTick();
    expect(onSelect).toHaveBeenCalledTimes(1);
    ui.destroy();
  });

  it('U10：onSelect 返回的 promise 拒绝有兜底（notifySaveError，不再 unhandled rejection）', async () => {
    const vault = new MockVault();
    seedMany(vault);
    const { dm, ui } = await makeUI(vault);
    const item = (await dm.loadItems())[0];
    const onSelect = vi.fn(() => Promise.reject(new Error('条目不存在')));
    ui.showDifficultyDialog(item, onSelect);
    (document.getElementById('bz-flow-dialog-action-2') as HTMLElement).click(); // 一般
    await flushTick();
    await flushTick();
    expect(onSelect).toHaveBeenCalledWith('good');
    const notices = getNoticeMessages().join('\n');
    expect(notices).toContain('保存失败（标记复习）');
    expect(notices).toContain('条目不存在');
    ui.destroy();
  });
});

// ==================== E1/C1 抽屉移出免确认 ====================

describe('批 C：抽屉「移出复习计划」免确认（效率整改 5 口径）', () => {
  it('右键卡片 → 移出：无确认框直达移除 + 通知挂撤销', async () => {
    const vault = new MockVault();
    seedMany(vault);
    const { ui } = await makeUI(vault);
    await ui.showMain();
    const card = document.querySelector<HTMLElement>('.bz-q-card[data-id="a"]')!;
    // 既有行为：首次右键只注册动作（openDrawer 动态 import item-actions），第二次才弹菜单
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await flushTick();
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const menu = document.querySelector('.bz-item-menu')!;
    const btn = [...menu.querySelectorAll<HTMLElement>('.bz-item-menu-item')].find((b) =>
      b.textContent?.includes('移出复习计划')
    )!;
    expect(btn).toBeTruthy();
    btn.click();
    await flushTick();
    await flushTick();
    // 免确认：不再弹 openFlowDialog（E1 核心）
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    // 数据已移除 + 通知可撤销
    const raw = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    expect(raw.find((i: any) => i.id === 'a')).toBeUndefined();
    expect(getNoticeMessages().some((m) => m.includes('已移出'))).toBe(true);
    ui.destroy();
  });
});

// ==================== E6 滚位/焦点记忆 ====================

describe('批 C：队列重建滚位/焦点记忆（E6）', () => {
  it('refreshPanel 重建后还原三区列 scrollTop 与卡片焦点', async () => {
    const vault = new MockVault();
    seedMany(vault, 6);
    const { ui } = await makeUI(vault);
    await ui.showMain();
    const futureCol = colOf('未来');
    const cards = [...futureCol.querySelectorAll<HTMLElement>('.bz-q-card')];
    expect(cards.length).toBe(6);
    const focused = cards[4];
    futureCol.scrollTop = 150;
    focused.focus();
    expect(document.activeElement).toBe(focused);
    await ui.refreshPanel(); // 全量 innerHTML 重建
    const rebuiltCol = colOf('未来');
    // 滚位还原（E6 核心）
    expect(rebuiltCol.scrollTop).toBe(150);
    // 焦点接力到重建后的同位卡片（新节点、同 data-id）
    expect(document.activeElement).not.toBe(focused);
    expect(document.activeElement instanceof HTMLElement).toBe(true);
    expect((document.activeElement as HTMLElement).getAttribute('data-id')).toBe(focused.dataset.id);
    ui.destroy();
  });
});

// ==================== U1 键盘穿透 + U5/C7 ESC 层卫生 ====================

describe('批 C：做题会话放弃确认在途键盘不穿透（U1）', () => {
  beforeEach(() => {
    QuizMasterUI.ai = { json: vi.fn() } as any;
    QuizMasterUI.settings = { enableMultipleChoice: true, questionsPerNote: '0', shuffleQuestions: false, difficulty: 'random' };
  });

  it('确认框在途：字母键/数字键/Enter 均不穿透题面；取消后键盘恢复', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const ui = new QuizMasterUI();
    const onComplete = vi.fn();
    ui.startReviewSession({ questions: [Q('M?', [0, 2])], onComplete });
    // ESC → 放弃确认框在途
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    // 字母键不勾选、数字键不作答、Enter 不提交
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    const btns = document.querySelectorAll('.quiz-option-btn');
    expect(btns[0].classList.contains('selected')).toBe(false);
    expect(btns[2].classList.contains('selected')).toBe(false);
    expect(ui.correctCount).toBe(0);
    expect(ui.wrongCount).toBe(0);
    expect((document.querySelector('.quiz-submit-btn') as HTMLButtonElement).disabled).toBe(false);
    expect(getNoticeMessages().some((m) => m.includes('请至少选择一项'))).toBe(false);
    // 确认框在途点遮罩：不再重开第二个确认框（confirming 防重入）
    (document.getElementById('quiz-mask') as HTMLElement).click();
    expect(document.querySelectorAll('#__shared_confirm_popup__').length).toBe(1);
    // 取消 → 继续做题，键盘恢复工作
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await flushTick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(btns[0].classList.contains('selected')).toBe(true);
    ui.close();
  });

  it('U5/C7：换题每题一次注册、逐题显式注销 ESC 层（层不随题数累积）', async () => {
    const vault = new MockVault();
    seedQuiz(vault, { 'A.md': [Q('Q1?', [0]), Q('Q2?', [1])] });
    const app = makeApp(vault);
    setApp(app);
    const orig = escManager.register;
    const registered: Array<{ id: string; unregister: ReturnType<typeof vi.fn> }> = [];
    vi.spyOn(escManager, 'register').mockImplementation((id, layer) => {
      const h = orig.call(escManager, id, layer);
      registered.push({ id, unregister: vi.spyOn(h, 'unregister') });
      return h;
    });
    const ui = new QuizMasterUI();
    ui.startReviewSession({ questions: [Q('Q1?', [0]), Q('Q2?', [1])], onComplete: vi.fn() });
    expect(registered.length).toBe(1);
    expect(registered[0].id).toBe('bz-review-quiz'); // id 归 bz-<域> 约定（原 'quiz'）
    // 答对 Q1 → 0.8s 后自动进入 Q2（renderModal#2 触发 _teardownModal 注销上一层）
    (document.querySelectorAll('.quiz-option-btn')[0] as HTMLElement).click();
    await flushPersist();
    await new Promise((r) => setTimeout(r, 850));
    expect(registered.length).toBe(2);
    expect(registered[1].id).toBe('bz-review-quiz');
    expect(registered[0].unregister).toHaveBeenCalledTimes(1); // 换题即注销（U5 核心）
    expect(registered[1].unregister).not.toHaveBeenCalled();
    // 会话收口 → 当前层也注销
    ui.close();
    expect(registered[1].unregister).toHaveBeenCalledTimes(1);
  });
});

// ==================== F6 resetQuiz + E5/C15 quiz-panel ====================

describe('批 C：resetQuiz（F6）与做题练习面板（E5/C15）', () => {
  it('F6：resetQuiz 清 initialized/ai，重启用后 ensureQuiz 可重新注入', async () => {
    const { setAISettingsProvider } = await import('../../src/core/ai');
    setAISettingsProvider(() => ({}) as any);
    ensureQuiz(null as any);
    expect(QuizMasterUI.ai).not.toBeNull();
    expect(quizUI.ai).not.toBeNull();
    resetQuiz();
    expect(QuizMasterUI.ai).toBeNull();
    expect(quizUI.ai).toBeNull();
    ensureQuiz(null as any); // 复位后可重新初始化（unloadReview 接线归批 B/主线程）
    expect(QuizMasterUI.ai).not.toBeNull();
    // 还原实例镜像（后续用例 beforeEach 只重置静态）
    resetQuiz();
  });

  it('E5：切「本轮题量」档位只切选中态不重建视图、不重读题库', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ aiProvider: 'ollama' }) as any);
    const { setAISettingsProvider } = await import('../../src/core/ai');
    const { resetAIProviderCache } = await import('../../src/core/ai');
    setAISettingsProvider(() => ({ aiProvider: 'ollama' }) as any);
    resetAIProviderCache();
    await openQuizPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-scope="all"]')).toBeTruthy());
    const loadSpy = vi.spyOn(quizUI.manager, 'loadQuiz');
    const popup = document.getElementById('bz-quiz-practice-popup')!;
    const btn30 = popup.querySelector<HTMLElement>('[data-batch="30"]')!;
    const nodeBefore = btn30;
    btn30.click(); // 纯本地档位
    await flushTick();
    // 不重建：同一 DOM 节点仍在（整表 innerHTML 重建会换节点）
    expect(popup.querySelector('[data-batch="30"]')).toBe(nodeBefore);
    // 选中态已切换（is-on / aria-checked）
    expect(nodeBefore.classList.contains('is-on')).toBe(true);
    expect(nodeBefore.getAttribute('aria-checked')).toBe('true');
    expect(popup.querySelector('[data-batch="20"]')!.classList.contains('is-on')).toBe(false);
    // 不重读题库：档位点击零 loadQuiz（E5 核心）
    expect(loadSpy).not.toHaveBeenCalled();
    expect(quizUI._sessionActive).toBe(false);
  });

  it('E5：范围（scope）切换仍重建视图，但焦点还原到触发控件', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ aiProvider: 'ollama' }) as any);
    const { setAISettingsProvider, resetAIProviderCache } = await import('../../src/core/ai');
    setAISettingsProvider(() => ({ aiProvider: 'ollama' }) as any);
    resetAIProviderCache();
    await openQuizPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-scope="all"]')).toBeTruthy());
    const popup = document.getElementById('bz-quiz-practice-popup')!;
    const folderBtn = popup.querySelector<HTMLElement>('[data-scope="folder"]')!;
    folderBtn.focus();
    folderBtn.click();
    await vi.waitFor(() => expect(popup.querySelector('[data-act="pick-folders"]')).toBeTruthy());
    // 重建后焦点回到同位控件（新节点、同 data-scope）
    const rebuilt = popup.querySelector<HTMLElement>('[data-scope="folder"]')!;
    expect(rebuilt).not.toBe(folderBtn);
    expect(document.activeElement).toBe(rebuilt);
  });

  it('C15：quiz-panel 壳无静态档位，显示时 topifyZ 发号（非 0）', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ aiProvider: 'ollama' }) as any);
    const { setAISettingsProvider, resetAIProviderCache } = await import('../../src/core/ai');
    setAISettingsProvider(() => ({ aiProvider: 'ollama' }) as any);
    resetAIProviderCache();
    await openQuizPanel(app);
    const mask = document.getElementById('bz-quiz-practice-mask')!;
    expect(mask.style.display).toBe('block');
    expect(mask.style.zIndex).not.toBe('');
    expect(mask.style.zIndex).not.toBe('0'); // 不再是构造期静态档位
  });
});
