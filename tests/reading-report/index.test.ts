/**
 * 阅读数据分析报告 index 测试（ticket 13）：报告弹窗 + 完整链路。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { showReportInPopup, showReadingReport } from '../../src/reading-report/index';
import { MockVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {
      getFileCache: (f: any) => {
        const content = vault.files.get(f.path) ?? '';
        const fm = parseFrontmatter(content);
        return fm && Object.keys(fm).length ? { frontmatter: fm } : null;
      },
    },
    workspace: {},
  } as any;
}

describe('报告弹窗', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    document.body.classList.remove('theme-dark');
  });

  it('showReportInPopup：DOM 结构 + 内容 + 关闭', () => {
    showReportInPopup('<div id="test-section">测试内容</div>', false);
    const modal = document.querySelector('div[style*="z-index: 9999"]') as HTMLElement;
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain('🧮 阅读数据分析报告');
    expect(modal.textContent).toContain('测试内容');
    // 背景色 light
    expect(modal.style.background).toContain('0.5');

    // ESC 关闭
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('div[style*="z-index: 9999"]')).toBeNull();
  });

  it('dark 模式背景色', () => {
    document.body.classList.add('theme-dark');
    showReportInPopup('x', true);
    const modal = document.querySelector('div[style*="z-index: 9999"]') as HTMLElement;
    expect(modal.style.background).toContain('0.7');
  });

  it('点击遮罩关闭（e.target === modal）', () => {
    showReportInPopup('x', false);
    const modal = document.querySelector('div[style*="z-index: 9999"]') as HTMLElement;
    modal.click();
    expect(document.querySelector('div[style*="z-index: 9999"]')).toBeNull();
  });
});

describe('完整链路', () => {
  it('showReadingReport：book 笔记 → 报告包含核心章节', async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    const vault = new MockVault();
    vault.files.set('书库/A.md', `---
tags: ["book"]
author: "余华"
category: "小说"
readingDate: 2025-06-01
completionDate: 2025-07-01
readingProgress: 100
readingTime: 3600000
highlights: 10
thinks: 2
pages: 300
wordCount: 80000
---
正文
`);
    setApp(makeApp(vault));
    showReadingReport(makeApp(vault) as any);
    await new Promise((r) => setTimeout(r, 20));

    const modal = document.querySelector('div[style*="z-index: 9999"]') as HTMLElement;
    expect(modal).not.toBeNull();
    // 核心指标卡
    expect(modal.textContent).toContain('书库');
    expect(modal.textContent).toContain('已读');
    expect(modal.textContent).toContain('总互动');
    expect(modal.textContent).toContain('平均每本划线');
    // 年度卡（2025年）
    expect(modal.textContent).toContain('2025年');
    expect(modal.textContent).toContain('阅读数量');
    // 类别卡
    expect(modal.textContent).toContain('阅读分类');
    expect(modal.textContent).toContain('最常阅读');
    // 速度（有 pages → 速度模块）
    expect(modal.textContent).toContain('页/小时');
  });
});
