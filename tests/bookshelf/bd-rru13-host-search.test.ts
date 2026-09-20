/**
 * RR-U13（全域深审残款移交）：报告视图下书库宿主搜索框「可点且只刷隐藏的墙」。
 * 现状：EFF-5 已拍板报告态隐藏宿主 chrome（reading-report/styles.css :has() 收起，
 * 本批不动）——收起即现行口径；本批在 bookshelf 行为层对齐收窄：报告视图（M.view !==
 * 'shelf'）下搜索输入/清除/ESC 清词全部零动作，消灭「CSS 失配或焦点残留时输入有动静
 * 但界面没变化」的假动作。取行为收窄而非禁用（已隐藏场景冗余）或输入切回书架
 * （与「报告态 chrome 收起」的既定拍板相悖）。
 * 修复前必红：报告态输入穿过防抖写入 M.searchKeyword 并重刷隐藏墙。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeApp } from '../helpers/app';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetBookshelfState } from '../../src/bookshelf/state';
import { ensureBookshelf, unloadBookshelf } from '../../src/bookshelf';
import { createOverlay, closeOverlay } from '../../src/bookshelf/ui';

async function waitFor(fn: () => boolean, timeout = 3000, step = 15): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('waitFor: 断言轮询超时');
    await new Promise((r) => setTimeout(r, step));
  }
}

function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
  const vault = new MockVault();
  vault.files.set('书库/认知觉醒.md', `---
tags: [book]
author: 周岭
category: 成长
readingDate: 2026-08-01
readingProgress: 60
highlights: 12
thinks: 3
wordCount: 180000
pages: 288
---`);
  vault.files.set('书库/围城.md', `---
tags: [book]
author: 钱钟书
readingDate: 2026-07-01
completionDate: 2026-08-15
readingProgress: 100
wordCount: 130000
---`);
  const app = makeApp(vault);
  ensureBookshelf(app);
  return { vault, app };
}

async function openPanel(vault: MockVault, app: ReturnType<typeof mockAppWithVault>) {
  createOverlay(app);
  await new Promise((r) => setTimeout(r, 20)); // rebuildItems 微任务
}

describe('RR-U13：报告视图宿主搜索行为收窄', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    resetBookshelfState();
  });

  afterEach(() => {
    closeOverlay();
    unloadBookshelf();
  });

  it('修复前必红：报告态输入不写 M.searchKeyword、不重刷隐藏墙', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    // 切报告视图（复用面板；报告内容区渲染与否不影响本断言）
    const { openBookshelfReport } = await import('../../src/bookshelf');
    openBookshelfReport(app);
    await waitFor(() => M.view === 'report');

    // 给隐藏墙打标：若被重刷（innerHTML 重建）标记即消失
    const shelf = document.querySelector('#bz-bs-shelf') as HTMLElement;
    shelf.dataset.rru13Mark = '1';

    // 模拟 CSS 失配/焦点残留场景：搜索框仍收到完整输入（含防抖窗口）
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.value = '钱钟书';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 260));

    expect(M.searchKeyword).toBe(''); // 修复前必红：词穿过防抖写进状态
    expect((document.querySelector('#bz-bs-shelf') as HTMLElement).dataset.rru13Mark).toBe('1'); // 隐藏墙未被重刷
  });

  it('报告态清除/ESC 清词同样零动作（预填词保留，回书架仍可见）', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    // 书架搜词 → 切报告（词保留 = 报告筛选回墙预填语义）
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.value = '钱钟书';
    input.dispatchEvent(new Event('input'));
    await waitFor(() => M.searchKeyword === '钱钟书');
    const { openBookshelfReport } = await import('../../src/bookshelf');
    openBookshelfReport(app);
    await waitFor(() => M.view === 'report');

    // 清除钮（CSS 失配场景可点）：零动作
    const clearBtn = document.querySelector('[data-bs-search-clear]') as HTMLElement;
    clearBtn.click();
    expect(M.searchKeyword).toBe('钱钟书');
    expect(input.value).toBe('钱钟书'); // 输入框值不被清

    // ESC 清词路径：报告态放行，不劫持（有词也不清——词是回墙预填态）
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(M.searchKeyword).toBe('钱钟书');
  });

  it('书架视图搜索不受影响（回归不误伤）：输入过滤 + ESC 有词清词照旧', async () => {
    const { vault, app } = seedVault();
    await openPanel(vault, app);
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.value = '钱钟书';
    input.dispatchEvent(new Event('input'));
    await waitFor(() => M.searchKeyword === '钱钟书');
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    await waitFor(() => overlay.querySelectorAll('.bz-bs-spine').length === 1);

    // ESC 有词清词（eff E2 既有语义不回潮）
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(M.searchKeyword).toBe('');
    expect(input.value).toBe('');
  });
});
