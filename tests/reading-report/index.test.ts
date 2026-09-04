/**
 * 阅读数据分析报告 index 测试（读书报告内嵌化）：面板内容区渲染 + 完整链路。
 * 保留机制补测：l3 骨架占位先行、ticket 40 分片渲染时序（容器移除/取消不报错不残留）、
 * 热力图 ‹ › 翻月、年卡展开、空库空态带动作、l1 unloadReadingReport 清理。
 * （原独立弹窗用例随独立窗退役删除；报告容器由 bookshelf 面板提供，此处直接传容器。）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { __resetNoticeForTests } from '../../src/core/notice';
import {
  renderReadingReport, cancelReadingReport, handleReportInteraction, unloadReadingReport,
} from '../../src/reading-report/index';
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

function newContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/** 条件轮询（局部 DOM 标记；防并行负载钉死时长） */
async function until(cond: () => boolean, timeout = 6000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('until: 条件超时');
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** 轮询等待分片渲染完成（成功反馈 toast = finishDone 标记；防并行负载钉死时长） */
async function waitReportDone(timeout = 6000): Promise<void> {
  const start = Date.now();
  while (!document.querySelector('#bz-notice-container')?.textContent?.includes('阅读统计完成')) {
    if (Date.now() - start > timeout) throw new Error('waitReportDone: 报告渲染超时');
    await new Promise((r) => setTimeout(r, 15));
  }
}

describe('报告视图渲染（面板内容区）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    document.body.classList.remove('theme-dark');
    __resetNoticeForTests();
    setSettingsProvider(() => ({}) as any);
    unloadReadingReport();
  });

  it('renderReadingReport：骨架占位先行 + progress toast 先弹 + 完成后报告内容替换占位', async () => {
    const vault = seedVault();
    const app = makeApp(vault);
    const container = newContainer();
    renderReadingReport(container, app);

    // 同步返回后（首个让出点前）骨架占位已在容器内，progress toast 已先弹
    expect(container.textContent).toContain('统计中');
    const toast = document.querySelector('#bz-notice-container .bz-notice') as HTMLElement;
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('正在读取书库');

    // 分片逐段渲染：等完成反馈再断言全部段落（首段落地早于末段，不能只等骨架消失）
    await waitReportDone();
    expect(container.textContent).toContain('已读');
    expect(container.textContent).toContain('阅读分类');
    expect(container.textContent).toContain('页/小时');
    // 完成反馈 toast（success）
    expect((document.querySelector('#bz-notice-container .bz-notice') as HTMLElement).textContent)
      .toContain('阅读统计完成');
  });

  it('lucide 化：报告输出无 emoji（🧮 标题/❌ 关闭/🏆 排名均换 lucide 占位）', async () => {
    const vault = seedVault();
    vault.files.set('书库/B.md', '---\ntags: [book]\nauthor: 刘慈欣\ncategory: 科幻\n---');
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    await until(() => container.querySelectorAll('.bz-rr-bar-row').length > 0);
    const html = container.innerHTML;
    expect(html).not.toContain('🧮');
    expect(html).not.toContain('❌');
    expect(html).not.toContain('🏆');
    expect(html).not.toContain('📈');
  });

  it('空库空态带动作：无任何书目 → 空态 + 主按钮（点击回调 onBack），不渲染空报告', async () => {
    const vault = new MockVault();
    let back = 0;
    const container = newContainer();
    renderReadingReport(container, makeApp(vault), { onBack: () => back++ });
    await until(() => container.querySelector('.bz-empty') !== null);
    expect(container.textContent).toContain('书库还没有可统计的书');
    // 收录说明（目录名在场）
    expect(container.textContent).toContain('书库');
    // 主按钮 → onBack 回书架
    const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('去书架墙添加')) as HTMLElement;
    expect(btn).toBeTruthy();
    btn.click();
    expect(back).toBe(1);
  });

  it('ticket 40 分片渲染时序：渲染中途取消不报错、不再写容器', async () => {
    const vault = seedVault();
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    // 同步取消（分片渲染尚未开始）
    cancelReadingReport();
    container.remove();
    // 等 toast 离场动画（hide 200ms）结束再断言容器清空
    await new Promise((r) => setTimeout(r, 450));
    expect(document.querySelector('#bz-notice-container .bz-notice')).toBeNull(); // toast 收起
  });

  it('ticket 40 分片渲染时序：容器渲染中途被移除（面板关闭）→ 中止且不抛错', async () => {
    const vault = seedVault();
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    container.remove(); // 模拟 closeOverlay 摘除面板
    await new Promise((r) => setTimeout(r, 120));
    // 不抛错即通过（分片循环逐段检查 container.isConnected）
    expect(container.isConnected).toBe(false);
  });

  it('重入：渲染中再触发 → 旧渲染作废、新渲染完成（序号守卫，不双写）', async () => {
    const vault = seedVault();
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    renderReadingReport(container, makeApp(vault)); // 重入取消第一轮
    await waitReportDone();
    expect(container.textContent).toContain('已读');
    expect(container.textContent).toContain('阅读分类');
    // 只有 single 报告体（骨架/旧渲染不残留双份）
    expect(container.querySelectorAll('.bz-empty').length).toBe(0);
  });

  it('l1 unloadReadingReport：渲染中卸载 → toast 收起、再渲染正常', async () => {
    const vault = seedVault();
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    unloadReadingReport();
    // 等 toast 离场动画结束再断言容器清空
    await new Promise((r) => setTimeout(r, 450));
    expect(document.querySelector('#bz-notice-container .bz-notice')).toBeNull();
    renderReadingReport(container, makeApp(vault));
    await waitReportDone();
    expect(container.textContent).toContain('已读');
  });

  it('热力图翻月：段头 ‹ › 与月份标题在场；点击 ‹ 切上一月（标题/网格联动，域内交互）', async () => {
    const vault = seedVault();
    // 会话经 weave-data.json（EPUB 聚合 reading.sessions）注入，覆盖 2025-05 / 2025-06 两个月
    const ms = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h).getTime();
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      books: {
        a: {
          meta: { title: '会话之书', author: '村上春树' },
          file: { vaultPath: 'books/s.epub' },
          reading: {
            position: { percent: 0.5 },
            stats: { totalReadTime: 7200000, lastReadTime: ms(2025, 6, 2, 14) },
            sessions: [
              { start: ms(2025, 5, 10, 8), end: ms(2025, 5, 10, 9), durationSeconds: 1200 },
              { start: ms(2025, 5, 11, 9), end: ms(2025, 5, 11, 10), durationSeconds: 2400 },
              { start: ms(2025, 5, 12, 21), end: ms(2025, 5, 12, 22), durationSeconds: 1800 },
              { start: ms(2025, 5, 13, 3), end: ms(2025, 5, 13, 4), durationSeconds: 900 },
              { start: ms(2025, 6, 1, 8), end: ms(2025, 6, 1, 9), durationSeconds: 3000 },
              { start: ms(2025, 6, 2, 14), end: ms(2025, 6, 2, 15), durationSeconds: 1500 },
            ],
          },
        },
      },
    }));
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    await until(() => !!container.querySelector('[data-rr-hm-body]'));

    // 段头：‹ › 按钮 + 月份标题（缺省游标 = 最近有阅读的月份 2025-06）
    expect(container.querySelector('[data-rr-hm-prev]')).toBeTruthy();
    expect(container.querySelector('[data-rr-hm-next]')).toBeTruthy();
    const title = container.querySelector('[data-rr-hm-title]') as HTMLElement;
    expect(title.textContent).toBe('2025年六月');
    // 下一月按钮在最新月应禁用（边界）
    expect((container.querySelector('[data-rr-hm-next]') as HTMLButtonElement).disabled).toBe(true);

    // 点 ‹ → 上一月（2025-05），标题与网格联动（reading-report 域内交互，面板委托转调）
    const handled = handleReportInteraction(container, container.querySelector('[data-rr-hm-prev]') as HTMLElement);
    expect(handled).toBe(true);
    expect((container.querySelector('[data-rr-hm-title]') as HTMLElement).textContent).toBe('2025年五月');
    // 再 ‹ 越界（最早月）→ 空操作
    handleReportInteraction(container, container.querySelector('[data-rr-hm-prev]') as HTMLElement);
    expect((container.querySelector('[data-rr-hm-title]') as HTMLElement).textContent).toBe('2025年五月');
  });

  it('年卡展开：年卡点击切换该年 12 月柱展开体（.open 类翻转）', async () => {
    const vault = seedVault();
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    await until(() => !!container.querySelector('[data-rr-year="2025"]'));

    const card = container.querySelector('[data-rr-year="2025"]') as HTMLElement;
    const body = container.querySelector('[data-rr-year-body="2025"]') as HTMLElement;
    expect(body.classList.contains('open')).toBe(false);
    expect(body.querySelectorAll('.bz-rr-mcol').length).toBe(12); // 固定 12 月柱
    handleReportInteraction(container, card);
    expect(body.classList.contains('open')).toBe(true);
    expect(card.classList.contains('open')).toBe(true);
    handleReportInteraction(container, card);
    expect(body.classList.contains('open')).toBe(false);
  });
});
