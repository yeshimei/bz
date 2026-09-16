/**
 * 做题练习独立面板 · UI 层测试（issue 362）：
 * 面板骨架/显隐与 ESC 层、范围切换（文件夹选择器范式/单篇联想范式）、AI 未配置降级引导、
 * 会话契约接线（startReviewSession 开题 → close 收口 → 成绩小结渲染 → 再来一轮）、卸载清理。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resetAIProviderCache, setAISettingsProvider } from '../../src/core/ai';
import { cancelActiveFlowDialog } from '../../src/core/flow-dialog';
import { closePathPicker } from '../../src/core/path-picker';
import { QuizManager } from '../../src/review/quiz-core/manager';
import { quizUI } from '../../src/review/quiz-core/session';
import { openQuizPanel, unloadQuizPanel } from '../../src/review/quiz-panel';

const POPUP_ID = 'bz-quiz-practice-popup';
const MASK_ID = 'bz-quiz-practice-mask';

async function open(vault: MockVault, settings: Record<string, unknown> = { aiProvider: 'ollama' }) {
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  // core/ai 自带独立设置注入器（main.ts onload 时 setAISettingsProvider），测试同步注入
  setAISettingsProvider(() => settings as any);
  resetAIProviderCache();
  await openQuizPanel(app);
  // show() 内 renderSetup 异步（先探题库计数再渲染），等骨架就位再交互
  await vi.waitFor(() => expect(document.querySelector('[data-scope="all"]')).toBeTruthy());
  return app;
}

describe('做题练习面板（issue 362）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    setAISettingsProvider(() => ({} as any));
  });
  afterEach(() => {
    cancelActiveFlowDialog();
    closePathPicker();
    unloadQuizPanel();
    vi.restoreAllMocks();
  });

  it('打开：壳常驻 body（display none→flex）+ 设置视图骨架（范围/题量段选/开始钮/头行）', async () => {
    await open(new MockVault());
    const popup = document.getElementById(POPUP_ID)!;
    expect(popup).toBeTruthy();
    expect(document.getElementById(MASK_ID)).toBeTruthy();
    // 组件库壳类（ADR-0094）+ 移动端真全屏标记
    expect(popup.classList.contains('bz-panel-frame')).toBe(true);
    expect(popup.classList.contains('bz-panel-mtop')).toBe(true);
    expect(popup.style.display).toBe('flex');
    // 骨架：头行标题/副题、范围三档、题量四档、开始钮
    expect(popup.querySelector('.bz-panel-title')!.textContent).toBe('做题练习');
    expect(popup.querySelectorAll('[data-scope]').length).toBe(3);
    expect(popup.querySelector('[data-scope="all"]')!.classList.contains('is-on')).toBe(true);
    expect(popup.querySelectorAll('[data-batch]').length).toBe(4);
    expect(popup.querySelector('[data-act="start"]')!.textContent).toBe('开始做题');
    // 默认范围 = 全部：整库说明 + 题库 meta 行
    expect(popup.querySelector('.bz-qp-detail')!.textContent).toContain('整库笔记');
    expect(popup.querySelector('[data-role="bank-meta"]')).toBeTruthy();
  });

  it('ESC / 遮罩点击隐藏（壳不销毁，可重开）', async () => {
    await open(new MockVault());
    const popup = document.getElementById(POPUP_ID)!;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popup.style.display).toBe('none');
    await openQuizPanel(mockAppWithVault(new MockVault()));
    expect(popup.style.display).toBe('flex');
    // 遮罩点击同语义
    document.getElementById(MASK_ID)!.click();
    expect(popup.style.display).toBe('none');
  });

  it('范围切换：按文件夹 → 库内路径选择器弹卡选定回填 chips；单篇 → 联想输入框', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', 'x');
    vault.files.set('sub/B.md', 'x');
    await open(vault);
    const popup = document.getElementById(POPUP_ID)!;
    (popup.querySelector('[data-scope="folder"]') as HTMLElement).click();
    await vi.waitFor(() => expect(popup.querySelector('[data-act="pick-folders"]')).toBeTruthy());
    // 库内路径选择器范式（core openPathPicker）
    (popup.querySelector('[data-act="pick-folders"]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-path-picker-row[data-path="sub"]')).toBeTruthy());
    (document.querySelector('.bz-path-picker-row[data-path="sub"]') as HTMLElement).click();
    (document.querySelector('.bz-path-picker-btn--primary') as HTMLElement).click();
    await vi.waitFor(() => expect(popup.querySelector('.bz-qp-chip-name')).toBeTruthy());
    expect(popup.querySelector('.bz-qp-chip-name')!.textContent).toBe('sub');
    // ✕ 移除 chip 回「还没选文件夹」
    (popup.querySelector('[data-rm-folder]') as HTMLElement).click();
    await vi.waitFor(() => expect(popup.textContent).toContain('还没选文件夹'));

    // 单篇：联想输入框（uiSuggest 范式——点选回填全路径）
    (popup.querySelector('[data-scope="note"]') as HTMLElement).click();
    await vi.waitFor(() => expect(popup.querySelector('[data-role="note-input"]')).toBeTruthy());
    const input = popup.querySelector('[data-role="note-input"]') as HTMLInputElement;
    input.focus();
    input.value = 'sub/';
    input.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(popup.querySelector('.bz-popover-item')).toBeTruthy());
    (popup.querySelector('.bz-popover-item') as HTMLElement).click();
    await vi.waitFor(() => expect((popup.querySelector('[data-role="note-input"]') as HTMLInputElement).value).toBe('sub/B.md'));
  });

  it('AI 未配置：点开始出人话引导框（不出题不崩），「稍后再说」收框面板仍在', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    await open(vault, {});
    const popup = document.getElementById(POPUP_ID)!;
    (popup.querySelector('[data-act="start"]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    const text = document.getElementById('__shared_confirm_popup__')!.textContent || '';
    expect(text).toContain('AI 还没配置');
    expect(text).toContain('做题练习靠 AI 出题');
    // 未出题：无题面弹窗；面板未被关闭
    expect(document.getElementById('quiz-mask')).toBeNull();
    expect(popup.style.display).toBe('flex');
    // 稍后再说 = 标准双动作右钮（ok id）→ 收框，面板原样
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeNull());
    expect(popup.style.display).toBe('flex');
  });

  it('会话契约接线：开始 → startReviewSession 出题面（面板让位）→ close 收口 → 成绩小结（对/错/跳过/正确率）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文 A');
    vault.files.set('B.md', '正文 B');
    const app = await open(vault, { aiProvider: 'ollama', shuffleQuestions: false });
    // 播种题库：A 两题 + B 一题（已有题的笔记 ensureQuestions 跳过，不触发 AI）
    const qm = new QuizManager();
    await qm.saveQuestionsForNote(app, 'A.md', [
      { question: 'A1?', options: ['a', 'b', 'c', 'd'], correctIndices: [0] },
      { question: 'A2?', options: ['a', 'b', 'c', 'd'], correctIndices: [1] },
    ]);
    await qm.saveQuestionsForNote(app, 'B.md', [
      { question: 'B1?', options: ['a', 'b', 'c', 'd'], correctIndices: [2] },
    ]);
    const popup = document.getElementById(POPUP_ID)!;
    // 重开设置视图以读到播种后的题库计数
    await openQuizPanel(app);
    await vi.waitFor(() => expect(popup.querySelector('[data-role="bank-meta"]')!.textContent).toContain('3'));

    (popup.querySelector('[data-act="start"]') as HTMLElement).click();
    // 契约：startReviewSession 开启 → 引擎题面弹窗出现，面板让位
    // （引擎按「打乱出题顺序」设置洗牌，首题不定——只断言题面/进度渲染自本轮 3 题）
    await vi.waitFor(() => expect(document.getElementById('quiz-mask')).toBeTruthy());
    expect(quizUI._sessionActive).toBe(true);
    expect(popup.style.display).toBe('none');
    expect(document.getElementById('quiz-popup')!.querySelector('.bz-quiz-title')!.textContent).toContain('(1/3)');
    const first = document.getElementById('quiz-popup')!.querySelector('.bz-quiz-question')!.textContent || '';
    expect(['A1?', 'A2?', 'B1?']).toContain(first);

    // 契约强制收口 → 防御性结算回调 → 面板回前台渲染成绩小结
    quizUI.close();
    await vi.waitFor(() => expect(popup.querySelector('.bz-summary')).toBeTruthy());
    expect(quizUI._sessionActive).toBe(false);
    expect(document.getElementById('quiz-mask')).toBeNull();
    expect(popup.style.display).toBe('flex');
    // 对/错/跳过三卡：0 对 0 错 3 跳过（备题 3 − 已答 0）
    const nums = [...popup.querySelectorAll('.bz-summary-stats .st b')].map((b) => b.textContent);
    expect(nums).toEqual(['0', '0', '3']);
    expect(popup.querySelector('.bz-qp-acc')!.textContent).toContain('0%');
    // 小结动作：再来一轮回设置视图
    (popup.querySelector('[data-act="again"]') as HTMLElement).click();
    await vi.waitFor(() => expect(popup.querySelector('[data-act="start"]')).toBeTruthy());
  });

  it('unloadQuizPanel：壳 DOM 摘除 + 会话在途契约收口（不留孤儿题面）', async () => {
    const vault = new MockVault();
    vault.files.set('A.md', '正文 A');
    const app = await open(vault);
    const qm = new QuizManager();
    await qm.saveQuestionsForNote(app, 'A.md', [
      { question: 'A1?', options: ['a', 'b', 'c', 'd'], correctIndices: [0] },
    ]);
    const popup = document.getElementById(POPUP_ID)!;
    (popup.querySelector('[data-act="start"]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('quiz-mask')).toBeTruthy());
    unloadQuizPanel();
    expect(document.getElementById(MASK_ID)).toBeNull();
    expect(document.getElementById(POPUP_ID)).toBeNull();
    // 会话在途被契约收口：题面弹窗一并拆除
    expect(quizUI._sessionActive).toBe(false);
    expect(document.getElementById('quiz-mask')).toBeNull();
    // 幂等：未开面板时重复清理不抛
    expect(() => unloadQuizPanel()).not.toThrow();
  });
});
