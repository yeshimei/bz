// @vitest-environment jsdom
/**
 * clipbook 阅读时长收集（issue 358）：会话封存入账侧写 readLog。
 * 覆盖：切篇封存（满 1 分钟入账 / 不足丢弃）、关面板式 pause+flush、保存动作后入账、
 * readLog 段容错解析（旧文件无此段 / 条目非法）、裁剪口径。
 * jsdom 而非 node——flowSave 经 core/notice 弹通知（需 document）；时长用真实时钟
 * 短等（约 1s）验证「满 1 分钟」门槛。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { readClipbookData, emptySidecar } from '../../src/clipbook/data';
import { setReadingSession, pauseReadingSession, flushReadingSession, trimReadLog } from '../../src/clipbook/flow';
import { readNewsData } from '../../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';

const CLIPBOOK_JSON = 'CONFIG/STORAGE/clipbook.json';

function boot(vault: MockVault = new MockVault()): MockVault {
  resetObsidianMocks();
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 入账门槛 = 满 1 分钟（60000ms，整分钟口径）：用只 fake Date 的时钟快进阅读时长，
 *  timer/微任务保持真实（落盘队列照常跑） */
function readFor(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

/** flush 落盘是 fire-and-forget（per-path 串行队列无 drain 钩子）：轮询等 readLog 稳定
 *  （retention-sidecar.test.ts 同款先例） */
async function waitForReadLog(n: number, timeoutMs = 3000): Promise<any[]> {
  const deadline = Date.now() + timeoutMs;
  let data = await readClipbookData();
  while (data.readLog.length !== n && Date.now() < deadline) {
    await wait(50);
    data = await readClipbookData();
  }
  return data.readLog;
}

beforeEach(() => {
  boot();
  // 清上一用例残留的模块级会话状态（flush 会清 accumMs/openedAt 并可能写盘——盘是新的，无碍）
  flushReadingSession();
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('会话封存入账（flow flushReadingSession）', () => {
  it('阅读满 1 分钟后切篇 → 旧篇封存进 readLog（哪篇/哪里来/多久/何时）', async () => {
    setReadingSession('url:https://x.com/1', { title: '文章一', src: '知乎日报' });
    readFor(65_000);
    setReadingSession('url:https://x.com/2', { title: '文章二', src: '果壳科学人' }); // 切篇触发旧篇封存
    const readLog = await waitForReadLog(1);
    expect(readLog).toHaveLength(1);
    expect(readLog[0]).toMatchObject({ key: 'url:https://x.com/1', title: '文章一', src: '知乎日报', minutes: 1 });
    expect(readLog[0].ts).toBeGreaterThan(0);
  });

  it('同篇重渲染（renderReader 反复触发）不重复入账、不重置计时', async () => {
    setReadingSession('url:https://x.com/1', { title: '文章一', src: '知乎日报' });
    readFor(65_000);
    setReadingSession('url:https://x.com/1', { title: '文章一', src: '知乎日报' }); // C7 同 key 不重开
    setReadingSession('url:https://x.com/1', { title: '文章一', src: '知乎日报' });
    readFor(500);
    flushReadingSession();
    const readLog = await waitForReadLog(1);
    expect(readLog).toHaveLength(1);
    expect(readLog[0].minutes).toBe(1);
  });

  it('不足 1 分钟的快速略过不入账（对齐 durationMin 整分钟口径）', async () => {
    setReadingSession('url:https://x.com/1', { title: '文章一', src: '知乎日报' });
    readFor(800);
    setReadingSession('url:https://x.com/2', { title: '文章二', src: '果壳科学人' });
    flushReadingSession();
    const data = await readClipbookData();
    expect(data.readLog).toEqual([]);
  });

  it('关面板式收口：pause 后 flush 仍入账（时长不因关面板丢失）', async () => {
    setReadingSession('clip:归档/网页剪藏/甲.md', { title: '剪藏甲', src: '未知站点' });
    readFor(65_000);
    pauseReadingSession();
    flushReadingSession();
    // 同篇再打开（已收条目可再阅）→ 新段从零，不重复计上一段
    setReadingSession('clip:归档/网页剪藏/甲.md', { title: '剪藏甲', src: '未知站点' });
    readFor(500);
    flushReadingSession();
    const readLog = await waitForReadLog(1);
    expect(readLog).toHaveLength(1);
    expect(readLog[0].minutes).toBe(1);
  });

  it('无 meta（遗留调用形）也能入账：title/src 空串兜底', async () => {
    setReadingSession('url:https://x.com/legacy');
    readFor(65_000);
    flushReadingSession();
    const readLog = await waitForReadLog(1);
    expect(readLog).toHaveLength(1);
    expect(readLog[0].title).toBe('');
    expect(readLog[0].src).toBe('');
  });
});

describe('保存动作后的封存入账（flowSave → flush）', () => {
  it('保存到剪藏本 → readLog 记下本段阅读；news 侧已处理语义不变', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
      articles: [
        { platform: '果壳科学人', title: '甲', url: 'https://guokr.com/1', author: '果壳', body: '正文', date: '2026-09-01 08:00:00' },
      ],
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true },
    }));
    boot(vault);
    const { flowSave } = await import('../../src/clipbook/flow');
    const raw = ((await readNewsData()).data.articles || [])[0];
    setReadingSession('url:https://guokr.com/1', { title: '甲', src: '果壳科学人' });
    readFor(65_000);
    const ok = await flowSave({ raw });
    expect(ok).toBe(true);
    await drainNewsWritesForTests();
    const readLog = await waitForReadLog(1);
    expect(readLog).toHaveLength(1);
    expect(readLog[0]).toMatchObject({ key: 'url:https://guokr.com/1', title: '甲', src: '果壳科学人' });
    // news 侧既有语义不受影响
    const news = await readNewsData();
    expect(news.data.articles[0].read).toBe(true);
    expect(news.data.articles[0].state).toBe('saved');
  });
});

describe('readLog 段容错与裁剪', () => {
  it('旧侧写无 readLog 段 → 空数组兜底（零迁移）；损坏条目整条丢弃', async () => {
    const vault = new MockVault();
    vault.files.set(CLIPBOOK_JSON, JSON.stringify({
      articleOverrides: {}, savedArchive: [], order: [],
      readLog: [
        { key: 'url:ok', title: 't', src: 's', minutes: 3, ts: 1758000000000 },
        { key: '', minutes: 3, ts: 1758000000000 },        // 空 key 丢弃
        { key: 'url:bad', minutes: 'x', ts: 1758000000000 }, // 非法 minutes 丢弃
        { key: 'url:nots', minutes: 3 },                    // 缺 ts 丢弃
        'junk',                                             // 非对象丢弃
      ],
    }));
    boot(vault);
    const data = await readClipbookData();
    expect(data.readLog).toEqual([{ key: 'url:ok', title: 't', src: 's', minutes: 3, ts: 1758000000000 }]);
    expect(emptySidecar().readLog).toEqual([]);
  });

  it('trimReadLog：裁掉窗口外与非法条目，超上限裁最旧', () => {
    const now = 180 * 24 * 60 * 60 * 1000 + 10; // 恰好保留 ts>=0 边界内
    const old = trimReadLog([
      { key: 'a', title: '', src: '', minutes: 1, ts: 0 },           // 边界内（floor = 10-180d < 0? floor=now-180d=10 → ts=0 被裁）
      { key: 'b', title: '', src: '', minutes: 1, ts: now - 1000 },
      { key: 'c', title: '', src: '', minutes: 1, ts: NaN },         // 非法裁
    ], now);
    expect(old.map((x) => x.key)).toEqual(['b']);

    const many = Array.from({ length: 5010 }, (_, i) => ({ key: `k${i}`, title: '', src: '', minutes: 1, ts: now }));
    const trimmed = trimReadLog(many, now);
    expect(trimmed).toHaveLength(5000);
    expect(trimmed[0].key).toBe('k10'); // 裁最旧 10 条
    expect(trimmed[trimmed.length - 1].key).toBe('k5009');
  });
});
