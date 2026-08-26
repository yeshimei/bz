/**
 * 阅读数据分析报告 index 测试（ticket 13）：报告弹窗 + 完整链路。
 * UX 整改补测：l3 打开先建窗（骨架占位）、ticket 40 分片渲染时序（计算中关闭不报错）、
 * l1 unloadReadingReport 清理。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { __resetNoticeForTests } from '../../src/core/notice';
import { showReportInPopup, showReadingReport, unloadReadingReport } from '../../src/reading-report/index';
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

/** 报告弹窗选择器（遮罩 z-index: 9999） */
function findModal(): HTMLElement | null {
  return document.querySelector('div[style*="z-index: 9999"]') as HTMLElement | null;
}

/** 带一本已完成书的最小书库（完整链路/占位/卸载共用） */
function seedVault(): MockVault {
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
  return vault;
}

describe('报告弹窗', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    document.body.classList.remove('theme-dark');
    __resetNoticeForTests();
  });

  it('showReportInPopup：DOM 结构 + 内容 + 关闭', () => {
    showReportInPopup('<div id="test-section">测试内容</div>', false);
    const modal = findModal();
    expect(modal).not.toBeNull();
    expect(modal!.textContent).toContain('🧮 阅读数据分析报告');
    expect(modal!.textContent).toContain('测试内容');
    // 背景色 light
    expect(modal!.style.background).toContain('0.5');

    // ESC 关闭
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(findModal()).toBeNull();
  });

  it('dark 模式背景色', () => {
    document.body.classList.add('theme-dark');
    showReportInPopup('x', true);
    const modal = findModal();
    expect(modal!.style.background).toContain('0.7');
    // p1 主题适配：面板底色用主题变量（暗色主题可读）
    const content = document.querySelector('div[style*="max-width: 600px"]') as HTMLElement;
    expect(content.style.background).toContain('var(--background-primary)');
  });

  it('点击遮罩关闭（e.target === modal）', () => {
    showReportInPopup('x', false);
    const modal = findModal();
    modal!.click();
    expect(findModal()).toBeNull();
  });
});

describe('完整链路', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    __resetNoticeForTests();
    setSettingsProvider(() => ({}) as any);
  });

  it('showReadingReport：book 笔记 → 报告包含核心章节', async () => {
    const vault = seedVault();
    setApp(makeApp(vault));
    // getAllBookNotes 经 deriveBookSettings 读取 bookTag 设置（P2 精确等值修复后）
    await showReadingReport(makeApp(vault) as any);

    const modal = findModal();
    expect(modal).not.toBeNull();
    // 核心指标卡
    expect(modal!.textContent).toContain('书库');
    expect(modal!.textContent).toContain('已读');
    expect(modal!.textContent).toContain('总互动');
    expect(modal!.textContent).toContain('平均每本划线');
    // 年度卡（2025年）
    expect(modal!.textContent).toContain('2025年');
    expect(modal!.textContent).toContain('阅读数量');
    // 类别卡
    expect(modal!.textContent).toContain('阅读分类');
    expect(modal!.textContent).toContain('最常阅读');
    // 速度（有 pages → 速度模块）
    expect(modal!.textContent).toContain('页/小时');
  });

  it('l3 打开先建窗：计算完成前弹窗即有「统计中…」占位 + progress toast 先弹', async () => {
    const vault = seedVault();
    setApp(makeApp(vault));
    const pending = showReadingReport(makeApp(vault) as any);

    // 同步返回后（首个让出点前）弹窗已存在且为骨架占位
    const modal = findModal();
    expect(modal).not.toBeNull();
    expect(modal!.textContent).toContain('统计中');
    // progress toast 已先弹（常驻帧，阶段消息）
    const toast = document.querySelector('#bz-notice-container .bz-notice') as HTMLElement;
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('正在读取书库');

    await pending;
    // 完成后占位被报告内容替换
    expect(findModal()!.textContent).toContain('已读');
    expect(findModal()!.textContent).not.toContain('统计中');
  });

  it('ticket 40 分片渲染时序：计算中关闭弹窗不报错、不残留 DOM', async () => {
    const vault = seedVault();
    setApp(makeApp(vault));
    const pending = showReadingReport(makeApp(vault) as any);

    // 同步 ESC 关闭（分片渲染尚未开始）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(findModal()).toBeNull();

    // 完成后不抛错、不再写回已移除的弹窗
    await pending;
    expect(findModal()).toBeNull();
  });

  it('l1 unloadReadingReport：关闭已开弹窗并清 DOM；再次打开正常', async () => {
    const vault = seedVault();
    setApp(makeApp(vault));
    await showReadingReport(makeApp(vault) as any);
    expect(findModal()).not.toBeNull();

    unloadReadingReport();
    expect(findModal()).toBeNull();

    // 卸载后重新打开正常（幂等）
    await showReadingReport(makeApp(vault) as any);
    expect(findModal()).not.toBeNull();
    expect(findModal()!.textContent).toContain('已读');
  });

  it('快速重开（30s 内）：第二轮 progress toast 不静默（dedupeKey 唯一化）', async () => {
    const vault = seedVault();
    setApp(makeApp(vault));
    // 第一轮：打开后立刻 ESC 关闭（首轮中止并在离场动画后移除 toast）
    const p1 = showReadingReport(makeApp(vault) as any);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await p1;
    expect(findModal()).toBeNull();
    // 等首轮 toast 离场动画结束（hide 200ms，留足余量）→ 容器清空
    await new Promise((r) => setTimeout(r, 400));
    expect(document.querySelectorAll('#bz-notice-container .bz-notice').length).toBe(0);

    // 第二轮：仍在 notice 30s 去重抑制窗口内，但必须有全新 progress toast（不被 noopHandle 吞掉）
    const p2 = showReadingReport(makeApp(vault) as any);
    const toast = document.querySelector('#bz-notice-container .bz-notice') as HTMLElement;
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('正在读取书库');
    await p2;
  });

  it('连点两次：第二轮完成反馈不静默（独立 toast 转 success）', async () => {
    const vault = seedVault();
    setApp(makeApp(vault));
    // 第一轮完整跑完（success toast 存活中，3s 自动消失）
    await showReadingReport(makeApp(vault) as any);
    // 立刻第二轮（第一轮 toast 仍在存活窗口内）
    await showReadingReport(makeApp(vault) as any);

    const toasts = Array.from(document.querySelectorAll('#bz-notice-container .bz-notice'));
    // 两轮各自独立 toast（未被 30s 抑制合并吞掉），且有完成反馈
    expect(toasts.length).toBeGreaterThanOrEqual(2);
    expect(toasts.some((t) => (t.textContent || '').includes('阅读统计完成'))).toBe(true);
  });
});