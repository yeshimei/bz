/**
 * 复习计划增强 UI 测试（ADR-0077，ticket 174）：统计弹窗/置顶/抽查/文件夹筛选/预告条
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeItemMenu } from '../../src/core/item-actions';
import { ReviewDataManager, REVIEW_FILE_PATH } from '../../src/review/data';
import { UIManager } from '../../src/review/ui';
import { closeStatsModal } from '../../src/review/stats-ui';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function seed(vault: MockVault) {
  const now = new Date();
  vault.files.set('A.md', '正文');
  vault.files.set('B.md', '正文');
  // A：逾期 + 有历史；B：未逾期
  vault.files.set(REVIEW_FILE_PATH, JSON.stringify([
    {
      id: '1', filePath: 'A.md', name: 'A', reviewStart: now.toISOString(), stage: 10, phase: 'fsrs',
      stability: 5, difficulty: 0.3,
      reviewHistory: [
        { timestamp: new Date(now.getTime() - 3 * 86400e3).toISOString(), stage: 10, rating: 'good', stability: 5, R: 0.8 },
        { timestamp: new Date(now.getTime() - 2 * 86400e3).toISOString(), stage: 10, rating: 'easy', stability: 8, R: 0.9 },
      ],
      totalReviews: 2, averageConfidence: 0, nextReviewDate: new Date(now.getTime() - 1000).toISOString(),
      lastReviewed: new Date(now.getTime() - 2 * 86400e3).toISOString(), lastDifficulty: 'easy', completed: false,
    },
    {
      id: '2', filePath: 'B.md', name: 'B', reviewStart: now.toISOString(), stage: 1, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() + 3600000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    },
  ]));
}

describe('UIManager 增强（ADR-0077）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
    closeStatsModal();
  });

  it('头部含 📊 统计 / 🎲 抽查按钮；点击抽查展开输入区', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    const statsBtn = document.getElementById('review-btn-stats');
    const drillBtn = document.getElementById('review-btn-drill');
    expect(statsBtn).not.toBeNull();
    expect(drillBtn).not.toBeNull();
    // 点抽查 → 输入区显示
    drillBtn!.click();
    const wrap = document.getElementById('review-drill-wrap');
    expect(wrap!.style.display).toBe('block');
    ui.destroy();
  });

  it('统计弹窗：全局指标 + 负载 + 时间线列表渲染', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    const statsBtn = document.getElementById('review-btn-stats') as HTMLElement;
    statsBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    const popup = document.getElementById('review-stats-popup');
    expect(popup).not.toBeNull();
    const text = popup!.textContent || '';
    expect(text).toContain('全局指标');
    expect(text).toContain('复习负载');
    expect(text).toContain('复习时间线');
    // 指标值：总复习（天）= 2（两天）、连续天数、今日
    expect(text).toContain('总复习');
    // 时间线列表有 A（有历史）
    expect(text).toContain('A');
    closeStatsModal();
    ui.destroy();
  });

  it('单条时间线：点时间线列表条目 → 展示该笔记历史（评级/R/阶段）', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    (document.getElementById('review-btn-stats') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    const row = document.querySelector('.bz-review-stats-tl-row') as HTMLElement;
    expect(row).not.toBeNull();
    row.click();
    await new Promise((r) => setTimeout(r, 20));
    const body = document.getElementById('review-stats-body')!;
    const text = body.textContent || '';
    expect(text).toContain('返回统计');
    expect(text).toContain('一般'); // good 评级中文
    expect(text).toContain('简单'); // easy 评级中文
    expect(text).toContain('R='); // R 值展示
    closeStatsModal();
    ui.destroy();
  });

  it('置顶：抽屉含「置顶」动作，点击后条目 pinned 落盘 + 卡片出现 📌', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    await ui.refreshPanel();
    const card = document.querySelector('#review-entries-container .review-card') as HTMLElement;
    // 触发抽屉（桌面右键 → 跟手菜单 .bz-item-menu）
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
    await new Promise((r) => setTimeout(r, 10));
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    const pinItem = [...menu.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('置顶')
    ) as HTMLElement;
    expect(pinItem).not.toBeNull();
    pinItem.click();
    await new Promise((r) => setTimeout(r, 20));
    const items = await dm.loadItems();
    expect(items.some((i) => i.filePath === 'A.md' && i.pinned)).toBe(true);
    // 卡片 📌 标记（刷新后）
    await ui.refreshPanel();
    const cardAfter = document.querySelector('#review-entries-container .review-card') as HTMLElement;
    expect(cardAfter.textContent).toContain('📌');
    closeItemMenu();
    ui.destroy();
  });

  it('文件夹筛选：输入文件夹名过滤列表', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    // A.md/B.md 在根目录；加一个子目录笔记
    const now = new Date();
    vault.files.set('Proj/X.md', '正文');
    const items = JSON.parse(vault.files.get(REVIEW_FILE_PATH)!);
    items.push({
      id: '3', filePath: 'Proj/X.md', name: 'X', reviewStart: now.toISOString(), stage: 1, phase: 'ladder',
      stability: 1, difficulty: 0.3, reviewHistory: [], totalReviews: 0, averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() + 3600000).toISOString(), lastReviewed: null, lastDifficulty: null, completed: false,
    });
    vault.files.set(REVIEW_FILE_PATH, JSON.stringify(items));
    await ui.refreshPanel();
    // 默认 3 张卡
    expect(document.querySelectorAll('#review-entries-container .review-card').length).toBe(3);
    // 筛选 Proj/
    ui.folderFilter = 'Proj/';
    await ui.refreshPanel();
    const cards = document.querySelectorAll('#review-entries-container .review-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('X');
    ui.destroy();
  });

  it('预告条：面板顶部显示今日/明日篇数', async () => {
    const vault = new MockVault();
    seed(vault);
    const app = makeApp(vault);
    setApp(app);
    const dm = new ReviewDataManager(app);
    const ui = new UIManager(app, dm);
    ui.showMain();
    await ui.refreshPreviewBar();
    const bar = document.getElementById('review-preview-bar')!;
    expect(bar.style.display).toBe('flex');
    expect(bar.textContent).toContain('今日');
    ui.destroy();
  });
});
