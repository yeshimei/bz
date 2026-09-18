// @vitest-environment jsdom
/**
 * 剪藏本（clipbook）· T1 news 域事件发射侧钉死（review-deep clipbook-arch 测试缺口 1，随 A4 立项）
 *
 * 背景：news:read / news:saved 域事件是 smartcat 行为流三跳（C32 门控语义）与
 * auto-summary 补全登记（clipPath 必带）的合同面。master 基线（批 E，92dba387）
 * 上 tests/clipbook 全树对 emitDomainEvent('news', …) 零断言——本文件用真实域事件总线
 * 订阅收集（tests/diary/wall-event-contract.test.ts 同手法）把「UI 动作 → 事件」表驱动钉死。
 *
 * 钉死语义（现状即契约，无并行翻转项）：
 *   - flowSave 成功：恰发 1 次 news:read（bump.changed 门控）+ 1 次 news:saved；
 *     read 载荷含 title/platform/state:'saved'/durationMin≥1，saved 载荷另带 clipPath；
 *   - 重复保存（盘面已 saved，F3 拦截 changed=false）：saved 恒发（覆盖场景同样登记
 *     auto-summary 补全）、read 不发（不重复喂行为流）；
 *   - flowMarkRead changed=false：零事件；
 *   - flowMarkAllRead：批量不逐篇喂行为流（零单篇事件）。
 * 改门控条件或载荷形状（title/platform/state/durationMin/clipPath）本文件即红。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { onDomainEvent } from '../../src/core/domain-bus';
import { getNewsFilePath } from '../../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { flowSave, flowMarkRead, flowMarkAllRead } from '../../src/clipbook/flow';

vi.mock('../../src/knowledge', () => ({
  openKnowledgeAddTask: vi.fn(),
  upgradeNoteSourceInternal: vi.fn(),
  retireKnowledgeSourcesForClip: vi.fn(),
}));

/** news.json 事件收集器（真实总线订阅；用例内自管退订，不污染其他文件） */
function collectNewsEvents() {
  const seen: Array<{ kind: string; evt: any; clipPath?: string }> = [];
  const off = onDomainEvent('news', (evt: any) => seen.push(evt));
  return { seen, stop: off };
}

/** 种子 news.json（全段齐全；条目按用例覆写 read/state） */
function seedDisk(articles: any[]): MockVault {
  const vault = new MockVault();
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
      rssFeeds: [],
      lastFetchAt: 0,
      fetchIntervalMin: 30,
    })
  );
  setApp(mockAppWithVault(vault));
  return vault;
}

const RAW = (over: Record<string, unknown> = {}) => ({
  platform: '果壳科学人',
  title: '事件契约探针文',
  url: 'https://gk.com/evt-1',
  author: '果壳',
  body: '正文一段，用于写剪藏笔记。',
  date: '2026-09-01 08:00:00',
  summary: '探针摘要',
  tags: ['探针'],
  ...over,
});

function diskJson(vault: MockVault) {
  return JSON.parse(vault.files.get(getNewsFilePath())!);
}

beforeEach(() => {
  resetObsidianMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  document.body.innerHTML = '';
});

describe('T1 news 域事件发射侧（flowSave / flowMarkRead / flowMarkAllRead → smartcat+auto-summary 合同面）', () => {
  it('flowSave 成功：恰发 1 次 news:read（bump.changed 门控）+ 1 次 news:saved，载荷形状钉死', async () => {
    const vault = seedDisk([RAW()]);
    const w = collectNewsEvents();
    try {
      const ok = await flowSave({ raw: diskJson(vault).articles[0] });
      expect(ok).toBe(true);
      await drainNewsWritesForTests();
    } finally {
      w.stop();
    }

    // 恰好一 read + 一 saved，通道不串
    const reads = w.seen.filter((e) => e.kind === 'read');
    const saves = w.seen.filter((e) => e.kind === 'saved');
    expect(reads).toHaveLength(1);
    expect(saves).toHaveLength(1);

    // read 载荷（smartcat 行为流三跳合同）：title/platform/state/durationMin
    expect(reads[0].evt).toMatchObject({
      title: '事件契约探针文',
      platform: '果壳科学人',
      state: 'saved',
    });
    expect(typeof reads[0].evt.durationMin).toBe('number');
    expect(reads[0].evt.durationMin).toBeGreaterThanOrEqual(1);
    // read 事件不带 clipPath（补全登记只挂 saved）
    expect(reads[0].clipPath).toBeUndefined();

    // saved 载荷：read 载荷全字段 + clipPath = <剪藏目录>/<清洗标题>.md（auto-summary 补全登记）
    expect(saves[0].evt).toMatchObject({
      title: '事件契约探针文',
      platform: '果壳科学人',
      state: 'saved',
    });
    expect(saves[0].clipPath).toBe('归档/网页剪藏/事件契约探针文.md');
  });

  it('重复保存（盘面已 saved，F3 拦截 changed=false）：saved 恒发、read 不发', async () => {
    const vault = seedDisk([RAW({ read: true, state: 'saved' })]);
    const w = collectNewsEvents();
    try {
      const ok = await flowSave({ raw: diskJson(vault).articles[0] });
      expect(ok).toBe(true); // 笔记确实重新写出（覆盖登记语义）
      await drainNewsWritesForTests();
    } finally {
      w.stop();
    }
    expect(w.seen.filter((e) => e.kind === 'saved')).toHaveLength(1); // 恒发：auto-summary 补全登记不丢
    expect(w.seen.filter((e) => e.kind === 'read')).toHaveLength(0); // C32：不重复喂行为流
  });

  it('flowMarkRead changed=false（盘面已 skipped）：零事件', async () => {
    const vault = seedDisk([RAW({ read: true, state: 'skipped' })]);
    const w = collectNewsEvents();
    try {
      const res = await flowMarkRead({ raw: diskJson(vault).articles[0] });
      expect(res.changed).toBe(false);
      await drainNewsWritesForTests();
    } finally {
      w.stop();
    }
    expect(w.seen).toHaveLength(0);
  });

  it('flowMarkRead changed=true（首次标读）：恰发 1 次 news:read（state=skipped）——对照面防「标读永不发」漂移', async () => {
    const vault = seedDisk([RAW()]);
    const w = collectNewsEvents();
    try {
      const res = await flowMarkRead({ raw: diskJson(vault).articles[0] });
      expect(res.changed).toBe(true);
      await drainNewsWritesForTests();
    } finally {
      w.stop();
    }
    const reads = w.seen.filter((e) => e.kind === 'read');
    expect(reads).toHaveLength(1);
    expect(reads[0].evt).toMatchObject({ title: '事件契约探针文', platform: '果壳科学人', state: 'skipped' });
    expect(w.seen.filter((e) => e.kind === 'saved')).toHaveLength(0);
  });

  it('flowMarkAllRead（批量 N 篇）：零单篇事件——批量不喂 smartcat 行为流', async () => {
    const vault = seedDisk([
      RAW({ title: '批量甲', url: 'https://gk.com/batch-1' }),
      RAW({ title: '批量乙', url: 'https://gk.com/batch-2' }),
      RAW({ title: '批量丙', url: 'https://gk.com/batch-3', platform: '知乎日报' }),
    ]);
    const w = collectNewsEvents();
    try {
      await flowMarkAllRead(diskJson(vault).articles);
      await drainNewsWritesForTests();
    } finally {
      w.stop();
    }
    expect(w.seen).toHaveLength(0);
    // 批量确实落盘（对照：零事件不是因为没干活）
    const disk = diskJson(vault);
    expect(disk.articles.filter((a: any) => a.read === true)).toHaveLength(3);
  });
});
