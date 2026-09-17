// @vitest-environment jsdom
/**
 * clipbook 阅读报告弹层（issue 358「我读了什么」）UI 层测试。
 * 覆盖：弹层骨架与分段渲染（概览/来源分布/阅读时段）、本周/本月周期切换、
 * 周期过滤生效（窗口外记录不计入）、空态两态人话（首次/本期，审查修复批 ⑨）、
 * uiEmpty 标准件结构（⑩）、重入防 toast 泄漏（③）/小数据量静默（⑪）/
 * await flush 后读到刚读段（⑤）、关闭收口。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openClipbookReport, closeClipbookReport, unloadClipbookReport } from '../../src/clipbook/report-ui';
import { unloadClipbook } from '../../src/clipbook';
import { cleanupNotices } from '../../src/core/notice';
import { M } from '../../src/clipbook/state';
import { setReadingSession, flushReadingSession } from '../../src/clipbook/flow';

const CLIPBOOK_JSON = 'CONFIG/STORAGE/clipbook.json';

const DAY = 24 * 60 * 60 * 1000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 轮询等报告体渲染稳定（出现 needle 且持续到本轮结束）——不用 vi.waitFor：
 *  分段渲染渐进填充 + 让出主线程，轮询真实时钟更直接 */
async function waitForRendered(overlay: HTMLElement, needle: string, timeoutMs = 3000): Promise<HTMLElement> {
  const body = () => overlay.querySelector('[data-clp-rep-body]') as HTMLElement;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (body().textContent!.includes(needle)) {
      await wait(30); // 再等一拍确认不是中间态
      if (body().textContent!.includes(needle)) return body();
    }
    await wait(30);
  }
  return body();
}

function bootWithLog(entries: any[]): MockVault {
  const vault = new MockVault();
  vault.files.set(CLIPBOOK_JSON, JSON.stringify({
    articleOverrides: {}, savedArchive: [], order: [],
    readLog: entries,
  }));
  // 空态动作「去剪藏本读几篇」会 openClipbook——seed 一份最小 news.json 防 fetcher/装载歧义
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles: [],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: false, guokr: false, bilibili: false },
  }));
  resetObsidianMocks();
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

beforeEach(() => {
  try { unloadClipbookReport(); } catch (e) { /* 幂等 */ }
  cleanupNotices(); // 清上一用例残留的 toast（body 级元素，卸载弹层不带清）
});

describe('clipbook 阅读报告弹层', () => {
  it('渲染骨架 → 三段报告（概览 hero / 来源分布 / 阅读时段），本周窗口外记录不计入', async () => {
    bootWithLog([
      { key: 'url:today', title: '今天的文章', src: '知乎日报', minutes: 12, ts: Date.now() - 3600_000 },
      { key: 'url:old', title: '四十天前的文章', src: '果壳科学人', minutes: 30, ts: Date.now() - 40 * DAY },
    ]);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.style.display).toBe('flex');
    expect(overlay.textContent).toContain('我读了什么');
    // 周期 seg 默认本周
    const weekBtn = overlay.querySelector('[data-period="week"]') as HTMLElement;
    expect(weekBtn.classList.contains('on')).toBe(true);

    // 分段渲染完成（needle = 末段「阅读时段」——三段中最后插入）
    const body = await waitForRendered(overlay, '阅读时段');
    expect(body.textContent).toContain('已读篇数');
    expect(body.textContent).toContain('来源分布');
    expect(body.textContent).toContain('今天的文章');      // 本周记录计入
    expect(body.textContent).not.toContain('四十天前的文章'); // 窗口外不计入
    expect(body.textContent).toContain('知乎日报');          // 来源行
    expect(body.textContent).toContain('1');                 // 篇数（同窗去重后 1 篇）
    expect(body.querySelectorAll('.bz-clp-rep-hbar')).toHaveLength(24); // 24 小时柱
    expect(body.querySelector('.bz-clp-rep-skeleton')).toBeNull();      // 骨架已被替换
  });

  it('周期切换（本周 → 本月）：seg 高亮迁移并重算重渲', async () => {
    bootWithLog([
      { key: 'url:a', title: '甲', src: '知乎日报', minutes: 5, ts: Date.now() - 3600_000 },
    ]);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    await waitForRendered(overlay, '已读篇数');

    const monthBtn = overlay.querySelector('[data-period="month"]') as HTMLElement;
    (monthBtn as HTMLElement).click();
    await vi.waitFor(() => expect(monthBtn.classList.contains('on')).toBe(true));
    expect((overlay.querySelector('[data-period="week"]') as HTMLElement).classList.contains('on')).toBe(false);
    // 重算后报告体仍在（本月窗口同样含今天记录）
    await waitForRendered(overlay, '已读篇数');
  });

  it('空态人话·首次（审查修复批 ⑨⑩）：core uiEmpty 标准件 + 「去剪藏本读几篇」动作', async () => {
    bootWithLog([]);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    await waitForRendered(overlay, '还没有阅读记录');
    expect(overlay.textContent).toContain('在剪藏本里打开文章阅读');
    // ⑩ 标准件结构：.bz-empty + CTA 按钮行（手册 §8.3 空态带动作），不再是域自造 empty
    const empty = overlay.querySelector('[data-clp-rep-body] .bz-empty') as HTMLElement;
    expect(empty).toBeTruthy();
    const cta = empty.querySelector('.bz-btn-row .bz-btn') as HTMLButtonElement;
    expect(cta).toBeTruthy();
    expect(cta.textContent).toContain('去剪藏本读几篇');
    // 动作闭环：点击 → 关报告 + 开剪藏本面板
    cta.click();
    await vi.waitFor(() => expect(M.open).toBe(true));
    expect(overlay.style.display).toBe('none');
    unloadClipbook(); // 清理本测试拉起的剪藏本面板（后续测试自建环境）
  });

  it('空态人话·本期（审查修复批 ⑨）：本周没读但本月有 → 文案带周期 + 「切到本月看看」直达', async () => {
    // 锚 = 本月 1 日 01:00（必在本月、且早于本周一——月初与周初重合的日历下场景不适用，跳过）
    const now = new Date();
    const off = (now.getDay() + 6) % 7; // 周一=0
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - off).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    if (monthStart >= weekStart) return; // 不存在「本周外但本月内」时段的日历
    bootWithLog([
      { key: 'url:a', title: '本月早些时候', src: '知乎日报', minutes: 12, ts: monthStart + 3600_000 },
    ]);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    await waitForRendered(overlay, '本周还没读过');
    expect(overlay.textContent).not.toContain('已读篇数'); // 本期空态整页短路
    const cta = overlay.querySelector('[data-clp-rep-body] .bz-btn-row .bz-btn') as HTMLButtonElement;
    expect(cta.textContent).toContain('切到本月看看');
    cta.click();
    await vi.waitFor(() => expect((overlay.querySelector('[data-period="month"]') as HTMLElement).classList.contains('on')).toBe(true));
    await waitForRendered(overlay, '已读篇数'); // 切过去就有数据
  });

  it('本期没读且两期都空（有旧记录）：空态纯文案不给切换按钮——首渲与周期切换两路都短路（issue 358 回归）', async () => {
    bootWithLog([
      { key: 'url:old', title: '四十天前的文章', src: '果壳科学人', minutes: 30, ts: Date.now() - 40 * DAY },
      { key: 'url:zero', title: '零分钟段', src: '果壳科学人', minutes: 0, ts: Date.now() - 3600_000 },
    ]);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    const expectEmptyPage = (): void => {
      const body = overlay.querySelector('[data-clp-rep-body]') as HTMLElement;
      expect(body.textContent).toContain('本周还没读过');
      expect(body.textContent).not.toContain('已读篇数');
      expect(body.textContent).not.toContain('统计概览');
      expect(body.textContent).not.toContain('四十天前的文章');
      expect(body.querySelector('.bz-btn-row')).toBeNull(); // 两期都空 → 无切换动作
    };
    // 首渲（本周窗口）：readLog 非空但本期全被过滤/零分钟 → 空态，无统计段
    await waitForRendered(overlay, '本周还没读过');
    expectEmptyPage();
    // 周期切换（→ 本周显式归位，再切本月）：两路都整页空态（懒生成三路共用同一短路）
    const weekBtn = overlay.querySelector('[data-period="week"]') as HTMLElement;
    (weekBtn as HTMLElement).click();
    await vi.waitFor(() => expect(weekBtn.classList.contains('on')).toBe(true));
    await wait(200); // 分片链（≥50ms 让出）走完
    expectEmptyPage();
    const monthBtn = overlay.querySelector('[data-period="month"]') as HTMLElement;
    (monthBtn as HTMLElement).click();
    await vi.waitFor(() => expect(monthBtn.classList.contains('on')).toBe(true));
    await wait(200);
    const monthBody = overlay.querySelector('[data-clp-rep-body]') as HTMLElement;
    expect(monthBody.textContent).toContain('本月还没读过');
  });

  it('空态图标锚（uiEmpty 标准件兑现）：.bz-empty-ic 为 mountIcons 产物 span，图标名 book-open；域 styles 不得复活自造 empty', async () => {
    bootWithLog([]);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    await waitForRendered(overlay, '还没有阅读记录');
    // 兑现后的真实节点：core uiEmpty 图标容器 .bz-empty-ic，mountIcons 产出 span[data-icon]
    const ic = overlay.querySelector('.bz-empty .bz-empty-ic') as HTMLElement;
    expect(ic).toBeTruthy();
    expect(ic.tagName).toBe('SPAN');
    expect(ic.dataset.icon).toBe('book-open'); // mock setIcon 记录图标名（真机渲染 lucide svg）
    // 样式锚：自造 .bz-clp-rep-empty 不得复活（上次图标失控根因）；域内只留弹层语境留白
    const css = readFileSync('src/clipbook/styles.css', 'utf8');
    expect(css).not.toContain('.bz-clp-rep-empty');
    expect(css).toMatch(/\.bz-clp-rep-body \.bz-empty\s*\{/);
  });

  it('有数据口径锚：同篇两段去重计 1 篇，总时长为两段合计', async () => {
    bootWithLog([
      { key: 'url:a', title: '同一篇', src: '知乎日报', minutes: 12, ts: Date.now() - 3600_000 },
      { key: 'url:a', title: '同一篇', src: '知乎日报', minutes: 8, ts: Date.now() - 7200_000 },
    ]);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    const body = await waitForRendered(overlay, '已读篇数');
    const heroNums = [...body.querySelectorAll('.bz-clp-rep-hero-card')].map((c) => c.querySelector('b')!.textContent);
    expect(heroNums[0]).toBe('1');        // 去重篇数（同篇两段不重复计）
    expect(heroNums[1]).toBe('20 分钟');  // 时长合计
  });

  it('移动端规范锚：弹层挂 .bz-panel-mtop（移动真全屏 + 44px 顶距），桌面遮罩点击关闭', async () => {
    bootWithLog([{ key: 'url:a', title: '甲', src: 's', minutes: 3, ts: Date.now() }]);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    const frame = overlay.querySelector('.bz-clip-report-frame') as HTMLElement;
    expect(frame.classList.contains('bz-panel-mtop')).toBe(true);
    expect(overlay.querySelector('[data-clp-rep-close]')).toBeTruthy(); // 关闭钮在
    // 桌面遮罩点击关闭：点在 overlay 本体（frame 之外）才收口
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay.style.display).toBe('none');
  });

  it('关闭钮收口：弹层隐藏；unloadClipbook 摘 DOM', async () => {
    bootWithLog([{ key: 'url:a', title: '甲', src: 's', minutes: 3, ts: Date.now() }]);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    (overlay.querySelector('[data-clp-rep-close]') as HTMLElement).click();
    expect(overlay.style.display).toBe('none');

    await openClipbookReport(getApp()); // 重开复用
    expect(overlay.style.display).toBe('flex');
    unloadClipbook();             // 域卸载链（含 unloadClipbookReport）摘 DOM
    expect(document.querySelector('.bz-clip-report-overlay')).toBeNull();
  });

  it('审查修复批 ⑪：小数据量（<500 条）跳过统计 toast，全程无 progress 帧', async () => {
    bootWithLog([{ key: 'url:a', title: '甲', src: 's', minutes: 3, ts: Date.now() }]);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    await waitForRendered(overlay, '已读篇数'); // 报告照常渲染
    expect(document.querySelector('.bz-notice--progress')).toBeNull();
    expect(document.querySelector('.bz-notice')).toBeNull(); // 完成转 success 也不弹
  });

  it('审查修复批 ⑪：大数据量（≥500 条）仍弹统计 toast，完成后转 success', async () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ key: `url:k${i}`, title: `篇${i}`, src: '知乎日报', minutes: 1, ts: Date.now() - 3600_000 }));
    bootWithLog(many);
    await openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    await waitForRendered(overlay, '已读篇数');
    await vi.waitFor(() => expect(document.querySelector('.bz-notice--success')).toBeTruthy());
  });

  it('审查修复批 ③：弹层重入先收旧 progress——在途渲染醒来后旧 toast 不泄漏', async () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ key: `url:k${i}`, title: `篇${i}`, src: '知乎日报', minutes: 1, ts: Date.now() - 3600_000 }));
    bootWithLog(many);
    const first = openClipbookReport(getApp()); // 发起即返回（不 await）：第一轮渲染在途
    const second = openClipbookReport(getApp()); // 立即重入：旧 toast 被收、旧渲染作废
    await Promise.all([first, second]);
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    await waitForRendered(overlay, '已读篇数');
    await vi.waitFor(() => expect(document.querySelector('.bz-notice--success')).toBeTruthy());
    // 修复前：旧「正在统计…」toast 因 activeProgress 易主 finishAbort 不回收，永久常驻
    await vi.waitFor(() => expect(document.querySelector('.bz-notice--progress')).toBeNull());
    // 旧 toast 带走退动画（LEAVE_MS 后摘 DOM），等动画走完再数总数：只剩重入后那一条
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-notice').length).toBe(1));
  });

  it('审查修复批 ⑤：openClipbookReport await flush——刚封存的阅读段本次打开即显示', async () => {
    bootWithLog([]);
    // 面板里读了一篇（满 1 分钟的会话还在当前会话位，未切篇未关面板）；
    // 只 fake Date 推进阅读时长，setTimeout/微任务走真实时钟（read-log.test 同款）
    vi.useFakeTimers({ toFake: ['Date'] });
    let opened: Promise<void>;
    try {
      setReadingSession('url:just-read', { title: '刚读完这篇', src: '知乎日报' });
      vi.setSystemTime(Date.now() + 65_000);
      opened = openClipbookReport(getApp()); // 打开报告（内部先 flush 入账再读侧写；不 await，出 try 后恢复真时钟再等）
    } finally {
      vi.useRealTimers(); // 渲染轮询恢复真实时钟
    }
    await opened;
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    await waitForRendered(overlay, '刚读完这篇');
    expect(overlay.textContent).toContain('已读篇数');
    closeClipbookReport();
    flushReadingSession(); // 清测试残留的会话状态（盘是新的，无段可写）
  });
});
