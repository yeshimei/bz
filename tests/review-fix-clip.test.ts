// @vitest-environment node
/**
 * 剪藏流家族修复批（review-all-bugs.md 第四节 F1-F15）数据层回归：
 * - F1：保留策略清理条目收进 removeArticleKeys——合并写按磁盘并集不被旧值复活；
 * - F3/F5：markHandledAndBump 已处理条目不改写不计数（F3）、未命中条目不空写（F5）；
 * - F8：news.json 损坏时合并写直接放弃，不清盘销毁恢复现场；
 * - F10：attach 收集覆盖 md 链接「尾标题」与「尖括号路径」两种形态；
 * - F13：番茄钟历史按保留窗裁剪（纯函数边界）。
 * UI 层部分见 review-fix-clip-ui.test.ts。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { MockVault, mockAppWithVault } from './mock-vault';
import { setApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { getNewsFilePath, writeNewsDataMerged } from '../src/clipbook/news-data';
import { readNewsAndSidecar } from '../src/clipbook/loader';
import { drainNewsWritesForTests, enqueueNewsWrite } from '../src/clipbook/write-queue';
import { flowMarkRead } from '../src/clipbook/flow';
import { collectResources } from '../src/attach/data';
import { trimHistory } from '../src/pomodoro/data';
import type { HistoryEntry } from '../src/pomodoro/state';

function seedNews(vault: MockVault, articles: any[]): void {
  vault.files.set(
    getNewsFilePath(),
    JSON.stringify({
      articles,
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [],
      bilibiliUpInfo: {},
      bilibiliMaxItems: 10,
      bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true },
    })
  );
}

const diskJson = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

beforeEach(() => {
  resetObsidianMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏', newsRetentionUnsavedDays: '7' } as any));
});

describe('F1：保留策略清理条目收进 removeArticleKeys（防并集复活）', () => {
  it('超龄 saved/skipped 条目装载清理后落盘消失，未读与守护新增条目保留', async () => {
    const vault = new MockVault();
    seedNews(vault, [
      { platform: '果壳科学人', title: '超龄已收', url: 'https://gk.com/old-saved', body: 'b1', date: '2026-08-01 08:00:00', fetchedAt: '2026-08-01 08:00:00', read: true, state: 'saved' },
      { platform: '果壳科学人', title: '超龄已读', url: 'https://gk.com/old-skipped', body: 'b2', date: '2026-08-01 09:00:00', fetchedAt: '2026-08-01 09:00:00', read: true, state: 'skipped' },
      { platform: '知乎日报', title: '新鲜未读', url: 'https://zh.com/fresh', body: 'b3', date: '2026-09-11 08:00:00' },
    ]);
    setApp(mockAppWithVault(vault));
    await readNewsAndSidecar();
    await drainNewsWritesForTests();
    let urls = diskJson(vault).articles.map((a: any) => a.url);
    expect(urls).toContain('https://zh.com/fresh');
    expect(urls).not.toContain('https://gk.com/old-saved'); // 修复前：不在 removeKeys，磁盘并集复活
    expect(urls).not.toContain('https://gk.com/old-skipped');
    // 二次装载：清理已收敛（无残留可清），不再产生删除意图，结果稳定
    await readNewsAndSidecar();
    await drainNewsWritesForTests();
    urls = diskJson(vault).articles.map((a: any) => a.url);
    expect(urls).toEqual(['https://zh.com/fresh']);
  });
});

describe('F3/F5：markHandledAndBump 已处理不计数、未命中不空写', () => {
  it('F3：已收条目（read=true state=saved）再走标读 → 统计不变、state 不被覆盖成 skipped', async () => {
    const vault = new MockVault();
    seedNews(vault, [
      { platform: '果壳科学人', title: '已收甲', url: 'https://gk.com/saved', body: 'b', date: '2026-09-01 08:00:00', read: true, state: 'saved' },
    ]);
    setApp(mockAppWithVault(vault));
    const before = diskJson(vault);
    await flowMarkRead({ raw: diskJson(vault).articles[0] });
    await drainNewsWritesForTests();
    const disk = diskJson(vault);
    expect(disk.articles[0].state).toBe('saved'); // 修复前被覆盖成 'skipped'（剪藏删除后掉进已读）
    expect(disk.articles[0].read).toBe(true);
    expect(disk.stats).toEqual(before.stats); // 修复前重复 +1
  });

  it('F5：条目已被清理（磁盘未命中）→ 不加统计、不产生写盘', async () => {
    const vault = new MockVault();
    seedNews(vault, [
      { platform: '果壳科学人', title: '在盘乙', url: 'https://gk.com/2', body: 'b', date: '2026-09-01 08:00:00' },
    ]);
    setApp(mockAppWithVault(vault));
    const orphan = { platform: '果壳科学人', title: '已被清理', url: 'https://gk.com/gone', body: 'b', date: '2026-09-01 08:00:00' };
    const before = vault.files.get(getNewsFilePath());
    await flowMarkRead({ raw: orphan });
    await drainNewsWritesForTests();
    expect(vault.files.get(getNewsFilePath())).toBe(before); // 字节级不写
    expect(diskJson(vault).stats.totalRead).toBe(0);
  });
});

describe('F8：news.json 损坏时合并写不落盘（保现场）', () => {
  it('损坏文件上执行合并写 → 原文原样保留，不被空库基底覆写', async () => {
    const vault = new MockVault();
    const corrupt = '{"articles":[{"url":"https://gk.com/1"},{"url":'; // 半截 JSON
    vault.files.set(getNewsFilePath(), corrupt);
    setApp(mockAppWithVault(vault));
    await enqueueNewsWrite(() => writeNewsDataMerged({ set: { bilibiliMaxItems: 20 } }));
    await drainNewsWritesForTests();
    expect(vault.files.get(getNewsFilePath())).toBe(corrupt); // 修复前被空库基底+改动段覆写
  });
});

describe('F10：attach 收集覆盖 md 链接尾标题与尖括号路径形态', () => {
  it('`[图](path "标题")` 带标题形态可收集', () => {
    const out = collectResources(
      '![图片](sub/pic.png "我的图片")\n[文档](docs/file.pdf "一份文档")',
      ['sub/pic.png', 'docs/file.pdf'],
      'note.md'
    );
    expect(out).toContain('sub/pic.png');
    expect(out).toContain('docs/file.pdf');
  });

  it('`[图](<path with spaces>)` 尖括号形态可收集；普通形态与外链行为不变', () => {
    const out = collectResources(
      '![](<my image.png>)\n![](plain.png)\n![](https://example.com/remote.png)',
      ['my image.png', 'plain.png'],
      'notes/a.md'
    );
    expect(out).toContain('my image.png');
    expect(out).toContain('plain.png');
    expect(out).not.toContain('https://example.com/remote.png'); // 外链仍不收
  });
});

describe('F13：trimHistory 保留窗边界（近 7 个日历日）', () => {
  const NOW = new Date(2026, 8, 12, 10, 0, 0).getTime(); // 2026-09-12 10:00 本地
  const h = (d: Date): HistoryEntry => ({ ts: d.getTime(), duration: 1500 });

  it('窗口内（含最左日零点）保留，窗外（前一日末尾/一个月前）裁掉，未来时间戳保守保留', () => {
    const kept = [
      h(new Date(2026, 8, 12, 9, 0)), // 今天
      h(new Date(2026, 8, 6, 0, 0)), // 最左日零点（与 last7Days 窗口起点同日）
      h(new Date(2026, 8, 20, 0, 0)), // 未来（时钟回拨场景）
    ];
    const dropped = [h(new Date(2026, 8, 5, 23, 59)), h(new Date(2026, 7, 1, 8, 0))];
    const out = trimHistory([...kept, ...dropped], NOW);
    expect(out.map((x) => x.ts).sort()).toEqual(kept.map((x) => x.ts).sort());
  });
});
