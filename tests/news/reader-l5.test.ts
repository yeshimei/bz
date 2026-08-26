/**
 * 聚合讯 l5 三态 / 加载反馈 / x2b 本地日期用例：
 * - 解析失败 → error toast + 错误态（不渲染「读完」态），修复后重载恢复
 * - 无数据文件（首次使用）→ 首用引导态（数据从哪来：外部数据源守护写入）
 * - 真读空（文件存在且全部已读）→ 完成态照常
 * - show() 加载期 → .news-loading 占位，加载完成清理并被正文替换；加载中 hide 不强制弹出
 * - 本地日期口径（对齐 src/pomodoro/stats.ts dayKey）：凌晨 0-8 点不落昨日
 * 独立测试文件：vi.resetModules 保证每例全新模块状态（flags/articles/stats 干净）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';

const NEWS_JSON = 'CONFIG/STORAGE/news.json';
const STATS_JSON = 'CONFIG/STORAGE/news-stats.json';

type ReaderModule = typeof import('../../src/news/reader');

function makeArticle(title: string, extra: any = {}) {
  return {
    title,
    url: `https://x.com/${encodeURIComponent(title)}`,
    platform: '站',
    author: '甲',
    date: '2025-06-10 09:00:00',
    summary: `${title}摘要`,
    tags: ['AI'],
    body: `${title} 正文`,
    ...extra,
  };
}

function freshReader(): Promise<{ reader: ReaderModule; vault: MockVault }> {
  return (async () => {
    vi.resetModules();
    const reader = (await import('../../src/news/reader')) as ReaderModule;
    const { setApp: setAppFresh } = await import('../../src/core/app');
    resetObsidianMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    clearNotices();
    const vault = new MockVault();
    setAppFresh({ vault, metadataCache: {}, workspace: { openLinkText: vi.fn() } } as any);
    reader.init(false);
    return { reader, vault };
  })();
}

function flush(ms = 30) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('聚合讯 l5 三态', () => {
  it('无数据文件（首次使用）→ 首用引导态：说明数据由外部数据源守护写入，不渲染「读完」态', async () => {
    const { reader } = await freshReader();
    await reader.loadArticles();
    reader.render();
    const text = document.querySelector('.news-done')!.textContent!;
    expect(text).toContain('数据从哪里来');
    expect(text).toContain('obsidian-news');
    expect(text).toContain('CONFIG/STORAGE/news.json');
    expect(text).not.toContain('今日文章已读完');
    expect(document.querySelector('.news-bottombar')).toBeNull();
  });

  it('解析失败 → error toast + 错误态（不渲染「读完」）；修复文件重载后恢复正常', async () => {
    const { reader, vault } = await freshReader();
    vault.files.set(NEWS_JSON, '{"articles": [');
    await reader.loadArticles();
    reader.render();
    expect(hasNotice(/新闻数据读取失败/)).toBe(true);
    const text = document.querySelector('.news-done')!.textContent!;
    expect(text).toContain('新闻数据读取失败');
    expect(text).not.toContain('今日文章已读完');
    expect(document.querySelector('.news-bottombar')).toBeNull();

    // 修复（守护进程写入完整数据）后重载 → 恢复正常单篇渲染
    vault.files.set(NEWS_JSON, JSON.stringify([makeArticle('A'), makeArticle('B')]));
    clearNotices();
    await reader.loadArticles();
    reader.render();
    expect(document.querySelector('.news-card-title')!.textContent).toBe('A');
    expect(hasNotice(/新闻数据读取失败/)).toBe(false);
  });

  it('真读空（文件存在且全部已读）→ 完成态照常渲染', async () => {
    const { reader, vault } = await freshReader();
    vault.files.set(NEWS_JSON, JSON.stringify([makeArticle('A', { read: true })]));
    await reader.loadArticles();
    reader.render();
    // 完成态走 .news-card-area，非引导/错误卡
    expect(document.querySelector('.news-done')).toBeNull();
    expect(document.querySelector('.news-card-area')!.textContent).toContain('今日文章已读完');
  });

  it('加载期：show() 同步渲染 .news-loading 占位并立即显示弹窗，加载完成后占位被清理并替换为正文', async () => {
    const { reader, vault } = await freshReader();
    vault.files.set(NEWS_JSON, JSON.stringify([makeArticle('A')]));
    reader.show();
    // show() 同步先出占位（异步加载尚未完成）
    expect(document.querySelector('.news-loading')).not.toBeNull();
    expect((document.querySelector('.news-mask') as HTMLElement).style.visibility).toBe('visible');
    await flush();
    // 加载完成 → 占位清理，正文替换
    expect(document.querySelector('.news-loading')).toBeNull();
    expect(document.querySelector('.news-card-title')!.textContent).toBe('A');
  });

  it('加载期间 hide() → 完成后占位被清理但窗口保持隐藏（不强制弹出）', async () => {
    const { reader, vault } = await freshReader();
    vault.files.set(NEWS_JSON, JSON.stringify([makeArticle('A')]));
    reader.show();
    expect(document.querySelector('.news-loading')).not.toBeNull();
    reader.hide();
    await flush();
    expect((document.querySelector('.news-mask') as HTMLElement).style.visibility).toBe('hidden');
    expect(document.querySelector('.news-loading')).toBeNull(); // 内容已渲染但不弹窗
  });
});

describe('聚合讯 x2b 本地日期（对齐 pomodoro dayKey）', () => {
  let reader: ReaderModule;
  let vault: MockVault;

  beforeEach(async () => {
    vi.resetModules();
    reader = (await import('../../src/news/reader')) as ReaderModule;
    const { setApp: setAppFresh } = await import('../../src/core/app');
    resetObsidianMocks();
    vault = new MockVault();
    setAppFresh({ vault, metadataCache: {}, workspace: { openLinkText: vi.fn() } } as any);
  });

  it('localDayKey：本地日键——本地凌晨 0-8 点仍属当天（不落昨日）', () => {
    // 本地组件构造：任何时区下该瞬间的本地日都是 2026-02-03
    const d = new Date(2026, 1, 3, 2, 30, 0); // 本地 2026-02-03 02:30（UTC+8 正是 0-8 点窗口）
    expect(reader.localDayKey(d.getTime())).toBe('2026-02-03');
    // 对照旧口径：toISOString 取 UTC 日，在 UTC+8 会退回 2026-02-02（昨天）——
    // 新口径恒为本地墙钟日，与 src/pomodoro/stats.ts dayKey 同语义
    expect(reader.localDayKey(0)).not.toBe(reader.localDayKey(24 * 3600 * 1000)); // 跨日键不同
  });

  it('localDatetime：本地时间戳（剪藏 created 字段，本地日+时分秒）', () => {
    const d = new Date(2026, 1, 3, 2, 30, 45);
    expect(reader.localDatetime(d.getTime())).toBe('2026-02-03 02:30:45');
  });

  it('recordStat：byDate 键 = 本地日；fake timers 锚定本地凌晨不落昨日', async () => {
    vi.useFakeTimers();
    try {
      vault.files.set(STATS_JSON, JSON.stringify({ totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} }));
      vi.setSystemTime(new Date(2026, 1, 3, 2, 30, 0)); // 本地凌晨 02:30
      reader.recordStat('skipped', makeArticle('X'));
      await vi.runAllTimersAsync(); // 冲刷 saveStats 微任务链
      const stats = JSON.parse(vault.files.get(STATS_JSON)!);
      expect(stats.byDate['2026-02-03']).toBe(1); // 本地日桶（旧口径 UTC+8 会落 2026-02-02）
      expect(stats.byDate).not.toHaveProperty('2026-02-02');
    } finally {
      vi.useRealTimers();
    }
  });
});