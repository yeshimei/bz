/**
 * 阅读数据分析报告 index 测试（读书报告内嵌化）：面板内容区渲染 + 完整链路。
 * 保留机制补测：l3 骨架占位先行、ticket 40 分片渲染时序（容器移除/取消不报错不残留）、
 * 热力图 ‹ › 翻月、年卡展开、空库空态带动作、l1 unloadReadingReport 清理。
 * 深审修复批（bz-fix-rr-core）：
 * - EFF-7 小库静默档：小 fixture 全程无 toast；大库（≥QUIET_TOAST_MIN_BOOKS）progress→success；
 * - RR-A2/RR-F2/RR-UX1：silent 档无 toast + 翻月/年卡/滚位保留；dataSignature 签名短路；
 * - EFF-2/RR-U2：键盘 Enter/Space 激活（年卡域内直处理 + aria-expanded 同步）；
 * - C-6：dedupeKey 退役——连续两次渲染各自有独立 toast（去重契约不再被唯一键虚化）。
 * （报告容器由 bookshelf 面板提供，此处直接传容器。）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import * as noticeModule from '../../src/core/notice';
import { __resetNoticeForTests } from '../../src/core/notice';
import {
  renderReadingReport, cancelReadingReport, handleReportInteraction, unloadReadingReport,
  QUIET_TOAST_MIN_BOOKS,
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

/** 大库 fixture（≥ QUIET_TOAST_MIN_BOOKS 本，触发满配 toast 档；带 pages/wordCount 保证速度段在场） */
function seedBigVault(): MockVault {
  const vault = new MockVault();
  for (let i = 0; i < QUIET_TOAST_MIN_BOOKS + 10; i++) {
    vault.files.set(`书库/书${i}.md`, '---\ntags: [book]\nauthor: 群Author\ncategory: 小说\nreadingDate: 2025-06-01\nreadingProgress: 50\nreadingTime: 60000\npages: 300\nwordCount: 80000\n---\n正文');
  }
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

function notices(): HTMLElement[] {
  return Array.from(document.querySelectorAll('#bz-notice-container .bz-notice')) as HTMLElement[];
}

/**
 * 轮询等待分片渲染完成：全部 10 段中 9 段产 .bz-rr-card（stats 段走 grid/panel）。
 * EFF-7 后小库无 success toast 可等，改以容器段数为完成标记（与 toast 档位解耦）。
 */
async function waitReportRendered(container: HTMLElement, timeout = 6000): Promise<void> {
  await until(() => container.querySelectorAll('.bz-rr-card').length >= 9, timeout);
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

  it('renderReadingReport：骨架占位先行 + 分片渐进填充完成（EFF-7：小库静默无 toast）', async () => {
    const vault = seedVault();
    const app = makeApp(vault);
    const container = newContainer();
    renderReadingReport(container, app);

    // 同步返回后（首个让出点前）骨架占位已在容器内；小库不弹 progress toast
    expect(container.textContent).toContain('统计中');
    expect(notices().length).toBe(0);

    // 分片逐段渲染完成：全部段落落地（进度反馈由骨架与段落渐进给出）
    await waitReportRendered(container);
    expect(container.textContent).toContain('已读');
    expect(container.textContent).toContain('阅读分类');
    expect(container.textContent).toContain('页/小时');
    // 小库全程静默（EFF-7）：无 progress/success 双 toast 噪音
    expect(notices().length).toBe(0);
  });

  it('EFF-7/C-6：大库满配 toast——progress→success；30s 抑制窗口内重开仍再弹（dedupeKey 契约退役）', async () => {
    const vault = seedBigVault();
    const app = makeApp(vault);
    const container = newContainer();
    const notifySpy = vi.spyOn(noticeModule, 'notify');

    renderReadingReport(container, app);
    // progress toast 先弹（大库不再静默；「正在统计」窗口极短，经 spy 断言创建事实）
    await until(() => notices().some((n) => n.textContent?.includes('阅读统计完成')));
    expect(notifySpy.mock.calls.some(([, opts]) => (opts as any)?.type === 'progress')).toBe(true);

    // C-6：紧接第二轮（30s 抑制窗口内）——不传 dedupeKey 的调用恒新弹，不被静默
    const callsAfterFirst = notifySpy.mock.calls.length;
    renderReadingReport(container, app);
    await until(() => notices().filter((n) => n.textContent?.includes('阅读统计完成')).length >= 1 && notifySpy.mock.calls.length > callsAfterFirst);
    // 契约守护：渲染器的 notify 调用不再携带 dedupeKey（唯一键让去重恒不生效的误用已删）
    for (const [, opts] of notifySpy.mock.calls) {
      expect(opts && typeof opts === 'object' && 'dedupeKey' in (opts as object)).toBe(false);
    }
    vi.restoreAllMocks();
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
    const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('去书库添加')) as HTMLElement;
    expect(btn).toBeTruthy();
    btn.click();
    expect(back).toBe(1);
  });

  it('ticket 40 分片渲染时序：渲染中途取消不报错、不再写容器', async () => {
    const vault = seedVault();
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    // 同步取消（分片渲染尚未开始；小库本无 toast，cancel 幂等无残留）
    cancelReadingReport();
    container.remove();
    await new Promise((r) => setTimeout(r, 450));
    expect(document.querySelector('#bz-notice-container .bz-notice')).toBeNull();
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
    await waitReportRendered(container);
    expect(container.textContent).toContain('已读');
    expect(container.textContent).toContain('阅读分类');
    // 只有 single 报告体（骨架/旧渲染不残留双份）
    expect(container.querySelectorAll('.bz-empty').length).toBe(0);
  });

  it('l1 unloadReadingReport：渲染中卸载 → 模块复位、再渲染正常', async () => {
    const vault = seedVault();
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    unloadReadingReport();
    await new Promise((r) => setTimeout(r, 450));
    expect(document.querySelector('#bz-notice-container .bz-notice')).toBeNull();
    renderReadingReport(container, makeApp(vault));
    await waitReportRendered(container);
    expect(container.textContent).toContain('已读');
  });

  it('RR-A2 dataSignature：同签名重入零重算（内容原样保留），签名变化重算', async () => {
    const vault = seedVault();
    const app = makeApp(vault);
    const container = newContainer();
    renderReadingReport(container, app, { dataSignature: 'sig-1' });
    await waitReportRendered(container);
    const probe = document.createElement('div');
    probe.id = 'sig-probe';
    container.appendChild(probe);

    // 同签名：短路返回——探针仍在（容器未被重写）、无 toast
    renderReadingReport(container, app, { dataSignature: 'sig-1' });
    await new Promise((r) => setTimeout(r, 80));
    expect(container.querySelector('#sig-probe')).not.toBeNull();
    expect(notices().length).toBe(0);

    // 签名变化：正常重算——探针随 innerHTML 重建消失，报告内容重新落地
    vault.files.set('书库/B.md', '---\ntags: [book]\nauthor: 刘慈欣\ncategory: 科幻\nreadingDate: 2025-07-01\n---');
    renderReadingReport(container, app, { dataSignature: 'sig-2' });
    await waitReportRendered(container);
    expect(container.querySelector('#sig-probe')).toBeNull();
    expect(container.textContent).toContain('刘慈欣');
  });

  it('RR-F2/RR-UX1：silent 重算（自动刷新档）——无 toast、翻月游标/年卡展开/滚位保留', async () => {
    const vault = seedVault();
    // 会话覆盖 2025-05 / 2025-06 两月，供翻月
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
    const app = makeApp(vault);
    const container = newContainer();
    renderReadingReport(container, app);
    await waitReportRendered(container);

    // 用户翻到 2025-05、展开 2025 年卡、滚到中间
    handleReportInteraction(container, container.querySelector('[data-rr-hm-prev]') as HTMLElement);
    expect((container.querySelector('[data-rr-hm-title]') as HTMLElement).textContent).toBe('2025年五月');
    const yearCard = container.querySelector('[data-rr-year="2025"]') as HTMLElement;
    handleReportInteraction(container, yearCard);
    expect(yearCard.classList.contains('open')).toBe(true);
    container.scrollTop = 120;

    // silent 重算（宿主 refreshReportView 自动刷新路径的降档）
    renderReadingReport(container, app, { silent: true });
    await waitReportRendered(container);
    expect(notices().length).toBe(0); // 无 progress/success toast
    // 翻月游标保留（RR-A4：游标单容器归宿 dataset.rrCursor，段生成透传）
    expect(container.dataset.rrCursor).toBe('2025-05');
    expect((container.querySelector('[data-rr-hm-title]') as HTMLElement).textContent).toBe('2025年五月');
    // 年卡展开保留（.open 按 data-rr-year 值恢复 + aria-expanded 同步）
    expect((container.querySelector('[data-rr-year="2025"]') as HTMLElement).classList.contains('open')).toBe(true);
    expect((container.querySelector('[data-rr-year="2025"]') as HTMLElement).getAttribute('aria-expanded')).toBe('true');
    // 滚位保留
    expect(container.scrollTop).toBe(120);
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
    // 游标写回容器（RR-A4 单容器归宿）
    expect(container.dataset.rrCursor).toBe('2025-05');
    // G10 回归：翻月边界同步——点 ‹ 到最早月后 ‹ 禁用、› 恢复可用（旧缺陷：disabled 按初始
    // 游标一次性渲染，点一次 ‹ 后 › 永久失效回不去）
    expect((container.querySelector('[data-rr-hm-prev]') as HTMLButtonElement).disabled).toBe(true);
    expect((container.querySelector('[data-rr-hm-next]') as HTMLButtonElement).disabled).toBe(false);
    // › 回到 2025-06：边界态复原（‹ 可用、› 禁用）
    handleReportInteraction(container, container.querySelector('[data-rr-hm-next]') as HTMLElement);
    expect((container.querySelector('[data-rr-hm-title]') as HTMLElement).textContent).toBe('2025年六月');
    expect((container.querySelector('[data-rr-hm-prev]') as HTMLButtonElement).disabled).toBe(false);
    expect((container.querySelector('[data-rr-hm-next]') as HTMLButtonElement).disabled).toBe(true);
    // 再 ‹ 越界（最早月）→ 空操作
    handleReportInteraction(container, container.querySelector('[data-rr-hm-prev]') as HTMLElement);
    expect((container.querySelector('[data-rr-hm-title]') as HTMLElement).textContent).toBe('2025年五月');
  });

  it('年卡展开：点击切换 12 月柱展开体 + aria-expanded 同步（EFF-2）', async () => {
    const vault = seedVault();
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    await until(() => !!container.querySelector('[data-rr-year="2025"]'));

    const card = container.querySelector('[data-rr-year="2025"]') as HTMLElement;
    const body = container.querySelector('[data-rr-year-body="2025"]') as HTMLElement;
    expect(body.classList.contains('open')).toBe(false);
    expect(card.getAttribute('aria-expanded')).toBe('false');
    expect(body.querySelectorAll('.bz-rr-mcol').length).toBe(12); // 固定 12 月柱
    handleReportInteraction(container, card);
    expect(body.classList.contains('open')).toBe(true);
    expect(card.classList.contains('open')).toBe(true);
    expect(card.getAttribute('aria-expanded')).toBe('true');
    handleReportInteraction(container, card);
    expect(body.classList.contains('open')).toBe(false);
    expect(card.getAttribute('aria-expanded')).toBe('false');
  });

  it('EFF-2：键盘 Enter/Space 激活——年卡域内翻转（作者卡/分类行合成交互在 bookshelf 接缝测试验证委托路径）', async () => {
    const vault = seedVault();
    const container = newContainer();
    renderReadingReport(container, makeApp(vault));
    await waitReportRendered(container);

    // 年卡：Enter 触发展开、Space 收起（域内处理路径）+ aria-expanded 同步
    const card = container.querySelector('[data-rr-year="2025"]') as HTMLElement;
    expect(card.getAttribute('tabindex')).toBe('0');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect((container.querySelector('[data-rr-year-body="2025"]') as HTMLElement).classList.contains('open')).toBe(true);
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect((container.querySelector('[data-rr-year-body="2025"]') as HTMLElement).classList.contains('open')).toBe(false);

    // 作者卡/分类行 markup 达标（tabindex + role）；行为级委托断言见 tests/bookshelf/ui.test.ts 接缝用例
    const authorCard = container.querySelector('[data-rr-author="余华"]') as HTMLElement;
    expect(authorCard.getAttribute('tabindex')).toBe('0');
    expect(authorCard.getAttribute('role')).toBe('button');
    const catRow = container.querySelector('[data-rr-cat="小说"]') as HTMLElement;
    expect(catRow.getAttribute('tabindex')).toBe('0');
    expect(catRow.getAttribute('role')).toBe('button');
  });
});
