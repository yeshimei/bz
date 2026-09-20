/**
 * review 域「全域深审拍板后修复批」Wave1 · 视图层回归（bd-review-fix-* 独立命名防撞）：
 *  - 呈报#54（R4）：做题题面 📝/✔️ 换 lucide 图标体系（全站 emoji 清零）
 *  - 呈报#57（R5）：做题冲刺头行补当前模式说明（规格：开始本轮/待重做/单条复习）
 *  - 呈报#12-R6：未来列「假可达」卡片改 tabindex=-1（聚焦了也没用 → 键盘直达可做题）
 *  - 呈报#19-R13：列内/右栏自绘纯文本空态统一 uiEmpty 小图标口径（emptyHtmlStr 同 markup 单源）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeApp } from '../helpers/app';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { cardHtml, queueViewHtml, sprintHeadHtml } from '../../src/review/render';
import type { ReviewItem } from '../../src/review/data';

function row(partial: any = {}): ReviewItem {
  const now = new Date();
  return {
    id: 'x', filePath: 'A.md', name: 'A',
    reviewStart: now.toISOString(), stage: 0, phase: 'ladder', stability: 1, difficulty: 0.3,
    reviewHistory: [], totalReviews: 0, averageConfidence: 0,
    nextReviewDate: new Date(now.getTime() + 86400e3).toISOString(), lastReviewed: null, lastDifficulty: null,
    completed: false,
    ...partial,
  } as ReviewItem;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  setApp(null as any);
  setSettingsProvider(() => ({}) as any);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('呈报#12-R6：不可做卡片不再假可达', () => {
  it('未来卡 tabindex=-1（键盘 Tab 直达可做题，不再聚焦无响应）', () => {
    const future = row({ nextReviewDate: new Date(Date.now() + 86400e3).toISOString() });
    const html = cardHtml(future, { now: Date.now() });
    expect(html).toMatch(/class="bz-q-card[^"]*\bno\b/);
    expect(html).toMatch(/tabindex="-1"/);
    expect(html).toMatch(/aria-disabled="true"/);
  });

  it('逾期到期卡保持 tabindex=0 可达可做（行为不变）', () => {
    const overdue = row({ nextReviewDate: new Date(Date.now() - 1000).toISOString() });
    const html = cardHtml(overdue, { now: Date.now() });
    expect(html).toMatch(/tabindex="0"/);
    expect(html).toMatch(/aria-disabled="false"/);
  });
});

describe('呈报#57（R5）：冲刺头行模式副标题', () => {
  it('round/redo/single 三模式分别出「开始本轮/待重做/单条复习」副标题', () => {
    expect(sprintHeadHtml('round')).toContain('开始本轮');
    expect(sprintHeadHtml('redo')).toContain('待重做');
    expect(sprintHeadHtml('single')).toContain('单条复习');
    for (const m of ['round', 'redo', 'single'] as const) {
      expect(sprintHeadHtml(m)).toMatch(/bz-sprint-sub/);
    }
  });

  it('无参调用不出副标题（兼容旧契约），标题仍是「做题冲刺」', () => {
    const html = sprintHeadHtml();
    expect(html).toContain('做题冲刺');
    expect(html).not.toMatch(/bz-sprint-sub/);
  });
});

describe('呈报#54（R4）：题面 emoji 退役换 lucide', () => {
  function openModal(): HTMLElement {
    const vault = new MockVault();
    vault.files.set('A.md', '正文');
    const app = makeApp(vault);
    setApp(app);
    return app;
  }

  it('题头不再有 📝，改 lucide file-text 图标（setIcon 兑现）', async () => {
    openModal();
    const { QuizMasterUI } = await import('../../src/review/quiz-core/session');
    const ui = new QuizMasterUI();
    ui.startReviewSession({
      questions: [{ question: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndices: [0], notePath: 'A.md' } as any],
      onComplete: vi.fn(),
    });
    const head = document.querySelector('.bz-quiz-head') as HTMLElement;
    expect(head.textContent).not.toContain('📝');
    expect(head.textContent).toContain('A (1/1)'); // 笔记名与题号保留
    // 图标：mock setIcon 记 dataset.icon；占位未兑现时也有 data-lucide 可断
    const ic = head.querySelector('[data-icon="file-text"], [data-lucide="file-text"]');
    expect(ic).not.toBeNull();
    ui.close();
  });

  it('选项对错标记不再用 ✔️ 字符，改 lucide check', async () => {
    openModal();
    const { QuizMasterUI } = await import('../../src/review/quiz-core/session');
    const ui = new QuizMasterUI();
    ui.startReviewSession({
      questions: [{ question: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndices: [0] } as any],
      onComplete: vi.fn(),
    });
    const popup = document.getElementById('quiz-popup')!;
    expect(popup.textContent).not.toContain('✔️');
    const mark = popup.querySelector('.check-mark') as HTMLElement;
    expect(mark).not.toBeNull();
    expect(mark.querySelector('[data-icon="check"], [data-lucide="check"]')).not.toBeNull();
    ui.close();
  });
});

describe('呈报#19-R13：空态统一 uiEmpty 小图标口径', () => {
  it('三区列空 → .bz-empty 结构 + inbox 图标占位（不再是纯文本 .bz-q-hint）', () => {
    const now = Date.now();
    // 只有已完成条目：逾期/今天/未来三列全空
    const done = row({ completed: true, nextReviewDate: new Date(now - 1000).toISOString() });
    const html = queueViewHtml([done], { now });
    expect(html).not.toMatch(/bz-q-hint/);
    expect(html.match(/bz-empty/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toMatch(/data-lucide="inbox"/);
  });

  it('冲刺右栏「队列完毕」空态同口径带图标（不再是 icon 空串纯文本版）', async () => {
    const { sprintAsideHtml } = await import('../../src/review/render');
    const html = sprintAsideHtml([]);
    expect(html).toMatch(/bz-empty/);
    expect(html).toMatch(/data-lucide="inbox"/);
    expect(html).toContain('队列完毕');
  });
});
