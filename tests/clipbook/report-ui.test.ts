// @vitest-environment jsdom
/**
 * clipbook 阅读报告弹层（issue 358「我读了什么」）UI 层测试。
 * 覆盖：弹层骨架与分段渲染（概览/来源分布/阅读时段）、本周/本月周期切换、
 * 周期过滤生效（窗口外记录不计入）、空态人话、关闭收口。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openClipbookReport, closeClipbookReport, unloadClipbookReport } from '../../src/clipbook/report-ui';
import { unloadClipbook } from '../../src/clipbook';

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
  resetObsidianMocks();
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

beforeEach(() => {
  try { unloadClipbookReport(); } catch (e) { /* 幂等 */ }
});

describe('clipbook 阅读报告弹层', () => {
  it('渲染骨架 → 三段报告（概览 hero / 来源分布 / 阅读时段），本周窗口外记录不计入', async () => {
    bootWithLog([
      { key: 'url:today', title: '今天的文章', src: '知乎日报', minutes: 12, ts: Date.now() - 3600_000 },
      { key: 'url:old', title: '四十天前的文章', src: '果壳科学人', minutes: 30, ts: Date.now() - 40 * DAY },
    ]);
    openClipbookReport(getApp());
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
    openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    await waitForRendered(overlay, '已读篇数');

    const monthBtn = overlay.querySelector('[data-period="month"]') as HTMLElement;
    (monthBtn as HTMLElement).click();
    await vi.waitFor(() => expect(monthBtn.classList.contains('on')).toBe(true));
    expect((overlay.querySelector('[data-period="week"]') as HTMLElement).classList.contains('on')).toBe(false);
    // 重算后报告体仍在（本月窗口同样含今天记录）
    await waitForRendered(overlay, '已读篇数');
  });

  it('空态人话：还没有阅读记录', async () => {
    bootWithLog([]);
    openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    await waitForRendered(overlay, '还没有阅读记录');
    expect(overlay.textContent).toContain('在剪藏本里打开文章阅读');
  });

  it('关闭钮收口：弹层隐藏；unloadClipbook 摘 DOM', async () => {
    bootWithLog([{ key: 'url:a', title: '甲', src: 's', minutes: 3, ts: Date.now() }]);
    openClipbookReport(getApp());
    const overlay = document.querySelector('.bz-clip-report-overlay') as HTMLElement;
    (overlay.querySelector('[data-clp-rep-close]') as HTMLElement).click();
    expect(overlay.style.display).toBe('none');

    openClipbookReport(getApp()); // 重开复用
    expect(overlay.style.display).toBe('flex');
    unloadClipbook();             // 域卸载链（含 unloadClipbookReport）摘 DOM
    expect(document.querySelector('.bz-clip-report-overlay')).toBeNull();
  });
});
