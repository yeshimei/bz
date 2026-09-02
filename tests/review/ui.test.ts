/**
 * 复习计划 UI 测试（2026-09-04 三区队列形态）：常驻 DOM/三区渲染/到期可点/归档/底部信息行/
 * 难度弹窗 XSS/移动全屏/搜索。旧单列 UI 测试随形态重写收编于此（含原 ui-cov/ui-enhance 有效断言）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeSettingsModal } from '../../src/core/settings-modal';
import { closeItemMenu } from '../../src/core/item-actions';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';
import { UIManager, isPlayable } from '../../src/review/ui';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function seed(vault: MockVault, extra: any[] = []) {
  const now = new Date();
  vault.files.set('A.md', '正文');
  vault.files.set('B.md', '正文');
  vault.files.set('C.md', '正文');
  vault.files.set('D.md', '正文');
  vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
    // A：逾期（可做题）
    {
      id: '1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 1, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    },
    // B：已到期（今天）
    {
      id: '2', filePath: 'B.md', name: 'B', reviewStart: now.toISOString(), stage: 8, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    },
    // C：未来（不可点）
    {
      id: '3', filePath: 'C.md', name: 'C', reviewStart: now.toISOString(), stage: 2, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() + 86400e3 * 5).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    },
    // D：已完成
    {
      id: '4', filePath: 'D.md', name: 'D', reviewStart: now.toISOString(), stage: 1, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 1, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() - 1000).toISOString(), lastReviewed: now.toISOString(), lastDifficulty: 'good', completed: true,
    },
    ...extra,
  ]));
}

async function makeUI(vault: MockVault) {
  const app = makeApp(vault);
  setApp(app);
  const dm = new ReviewDataManager(app);
  const ui = new UIManager(app, dm);
  return { app, dm, ui };
}

describe('UIManager 三区队列', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    setSettingsProvider(() => ({}) as any);
  });
  afterEach(() => {
    closeSettingsModal();
    closeItemMenu();
  });

  it('构造即建常驻 DOM（display none）+ zIndex 发号', () => {
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
    expect(Number.isFinite(parseInt(mask.style.zIndex, 10))).toBe(true);
    expect(document.getElementById('review-entries-container')).not.toBeNull();
    // 无 .bz-win-head 头行按钮组（拍板去按钮）
    expect(popup.querySelector('.bz-win-head')).toBeNull();
    ui.destroy();
    expect(document.getElementById('review-mask')).toBeNull();
  });

  it('showMain 渲染三区列（逾期/今天/未来）与底部信息行', async () => {
    const vault = new MockVault();
    seed(vault);
    const { ui } = await makeUI(vault);
    await ui.showMain();
    const cols = document.querySelectorAll('.bz-q-col');
    expect(cols.length).toBe(3);
    const headNames = [...document.querySelectorAll('.bz-q-col-head .name')].map((e) => e.textContent);
    expect(headNames).toEqual(['已逾期', '今天到期', '未来']);
    // 卡片：A/B 可点（逾期/到期），C 未来禁用；D 已完成不在队列
    const cards = [...document.querySelectorAll<HTMLButtonElement>('.bz-q-card')];
    expect(cards.length).toBe(3);
    const canClick = cards.filter((c) => !c.disabled);
    expect(canClick.length).toBe(2);
    // 底部信息行存在（归档/统计文本落位）
    const footer = document.querySelector('.bz-q-footer')!;
    expect(footer).not.toBeNull();
    expect(footer.textContent).toContain('已完成 1 篇');
    expect(footer.textContent).toContain('累计复习');
    // 无 data-lucide 占位残留（全部已替换成真实图标）
    expect(document.querySelectorAll('[data-lucide]').length).toBe(0);
    ui.destroy();
  });

  it('归档切换：点底部归档信息行 → 只显示已完成列', async () => {
    const vault = new MockVault();
    seed(vault);
    const { ui } = await makeUI(vault);
    await ui.showMain();
    (document.querySelector('[data-act="arch"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0)); // 等 refreshPanel 异步渲染
    const cols = document.querySelectorAll('.bz-q-col');
    expect(cols.length).toBe(1);
    expect(document.querySelector('.bz-q-col-head .name')!.textContent).toBe('已完成');
    expect(document.querySelectorAll('.bz-q-card').length).toBe(1); // D
    ui.destroy();
  });

  it('搜索防抖：输入过滤队列（名称）', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    seed(vault);
    const { ui } = await makeUI(vault);
    await ui.showMain();
    const input = document.getElementById('bz-q-search') as HTMLInputElement;
    input.value = 'C';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(200);
    const cards = [...document.querySelectorAll<HTMLButtonElement>('.bz-q-card')];
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('C');
    vi.useRealTimers();
    ui.destroy();
  });

  it('难度弹窗（评分命令用）：按钮触发 onSelect + XSS 文件名转义', async () => {
    const vault = new MockVault();
    seed(vault);
    const { dm, ui } = await makeUI(vault);
    const items = await dm.loadItems();
    const evil = { ...items[0], name: '<img src=x onerror=alert(1)>' };
    const onSelect = vi.fn();
    ui.showDifficultyDialog(evil, onSelect);
    const dlg = document.querySelector('.difficulty-dialog')!;
    expect(dlg.textContent).toContain('标记复习');
    expect(dlg.querySelector('img')).toBeNull(); // XSS 转义
    (dlg.querySelector('.diff-btn[data-diff="good"]') as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith('good');
    expect(document.querySelector('.difficulty-dialog')).toBeNull();
    ui.destroy();
  });

  it('移动端默认全屏：showMain 后 popup 挂 bz-win-mfs；开关关不挂；桌面恒不挂', async () => {
    const vault = new MockVault();
    seed(vault);
    // 移动端 + 默认开
    MockPlatform.isMobile = true;
    setSettingsProvider(() => ({ reviewMobileDefaultFullscreen: true }) as any);
    let { ui } = await makeUI(vault);
    await ui.showMain();
    expect(document.getElementById('review-popup')!.classList.contains('bz-win-mfs')).toBe(true);
    ui.destroy();
    // 移动端 + 关
    setSettingsProvider(() => ({ reviewMobileDefaultFullscreen: false }) as any);
    ({ ui } = await makeUI(vault));
    await ui.showMain();
    expect(document.getElementById('review-popup')!.classList.contains('bz-win-mfs')).toBe(false);
    ui.destroy();
    // 桌面恒不挂
    MockPlatform.isMobile = false;
    setSettingsProvider(() => ({ reviewMobileDefaultFullscreen: true }) as any);
    ({ ui } = await makeUI(vault));
    await ui.showMain();
    expect(document.getElementById('review-popup')!.classList.contains('bz-win-mfs')).toBe(false);
    ui.destroy();
  });

  it('isPlayable：到期可做；未来/挂起/已完成不可', () => {
    const now = new Date();
    const base = {
      id: 'x', filePath: 'X.md', name: 'X', reviewStart: now.toISOString(), stage: 1, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      lastReviewed: null, lastDifficulty: null, completed: false,
    } as any;
    expect(isPlayable({ ...base, nextReviewDate: new Date(now.getTime() - 1000).toISOString() })).toBe(true);
    expect(isPlayable({ ...base, nextReviewDate: null })).toBe(false);
    expect(isPlayable({ ...base, nextReviewDate: new Date(now.getTime() + 86400e3).toISOString() })).toBe(false);
    expect(isPlayable({ ...base, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), isMissing: true })).toBe(false);
    expect(isPlayable({ ...base, nextReviewDate: new Date(now.getTime() - 1000).toISOString(), completed: true })).toBe(false);
  });

  it('冲刺中 refreshPanel 不覆盖队列（宿主被会话占用）', async () => {
    const vault = new MockVault();
    seed(vault);
    const { ui } = await makeUI(vault);
    await ui.showMain();
    (ui as any).sprint = { destroy: () => {} };
    await ui.refreshPanel();
    expect(document.querySelector('.bz-q-view')).not.toBeNull();
    (ui as any).sprint = null;
    ui.destroy();
  });
});

describe('settings schema 驻留（设置面板消费契约）', () => {
  it('reviewSettingsSchema 可从 review/ui re-export（组数含做题家/复习节奏）', async () => {
    const mod = await import('../../src/review/ui');
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const schema = mod.reviewSettingsSchema({ app, dataManager: dm });
    expect(Array.isArray(schema.groups)).toBe(true);
    expect(schema.groups.length).toBeGreaterThanOrEqual(5);
    const names = schema.groups.map((g: any) => g.name);
    expect(names).toContain('做题家');
    expect(names).toContain('复习节奏');
  });
});
