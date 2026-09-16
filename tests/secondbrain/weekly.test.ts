// @vitest-environment node
/**
 * 每周知识动态 · 数据层测试（issue 360，纯 node 环境）：
 * - 周界判定 isWeeklyRunDue（lastRunAt 滚动 7 天；首轮无 lastRunAt 不算到期）；
 * - 新增差分 diffNewNotes（快照键差、mtime 降序）与新增关联 collectNewLinks
 *   （窗口 (since, now]、empty「已尝试且 0 条」不计、非法时间戳剔除）；
 * - 撞车阈值口径（代码即注释、测试同锚）：
 *   · 向量通道 pickVectorCollision：vectorSearch 锐化后分数（score^0.35，参考面板百分比同尺）
 *     ≥ WEEKLY_COLLISION_SCORE(0.85) 判高度重合（≈原始余弦 0.63，高于建链候选下限 0.65）；
 *   · TF-IDF 降级 pickTfidfCollision：BM25 只作短名单，token 覆盖率 ≥ WEEKLY_COLLISION_CONTAINMENT(0.7)；
 *   · 撞车目标只认既有笔记（上轮快照内的 path），自身剔除，同 path 取最高分；
 * - 聚合编排 runWeeklyDigest：首轮立基线不产出 / 未到周界不聚 / 有内容产出并落盘 /
 *   空轮零产出且保留上一份摘要 / force 手动直跑 / AI 文案可选（失败降级纯列表）；
 * - 落盘与冲突合并：secondbrain.json weekly 段读写、Syncthing 冲突取 lastRunAt 大者。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { loadStore, mutateStore, mergeStoreWithConflict } from '../../src/secondbrain/store-file';
import type { WeeklyDigest } from '../../src/secondbrain/store-file';
import {
  WEEKLY_COLLISION_SCORE,
  WEEKLY_COLLISION_CONTAINMENT,
  WEEKLY_INTERVAL_MS,
  WEEKLY_MAX_COLLISION_CHECKS,
  buildWeeklySummaryPrompt,
  collectNewLinks,
  diffNewNotes,
  formatDigestRange,
  isWeeklyRunDue,
  pickTfidfCollision,
  pickVectorCollision,
  runWeeklyDigest,
  tokenContainment,
} from '../../src/secondbrain/weekly';
import type { WeeklyStoreLike } from '../../src/secondbrain/weekly';

/** 基准时刻（固定，避免依赖真实时钟）：2026-09-08 08:00（周二） */
const T0 = Date.parse('2026-09-08T08:00:00');
const DAY = 24 * 3600 * 1000;

function makeEnv() {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, storagePath: 'CONFIG/STORAGE' }) as any);
  return { vault, app };
}

/** 假向量库：meta.notes 可变；vectorSearch 可编程（默认无命中） */
function makeStore(notes: Record<string, string>, vectorSearch?: any): WeeklyStoreLike & { vectorSearch: any } {
  return {
    meta: {
      notes: Object.fromEntries(
        Object.entries(notes).map(([path, text]) => [path, { mtime: T0, chunks: [{ text }] }])
      ),
    },
    vectorSearch: vectorSearch ?? (vi.fn().mockResolvedValue([])),
  };
}

/** 直接种一份 weekly 段（绕过编排，控制 lastRunAt 精确值） */
async function seedWeekly(lastRunAt: number, knownPaths: string[], digest: WeeklyDigest | null = null): Promise<void> {
  await mutateStore((s) => {
    s.weekly = { lastRunAt, knownPaths, digest };
  });
}

describe('周界判定 isWeeklyRunDue（issue 360：lastRunAt 滚动 7 天）', () => {
  it('无 lastRunAt（null/undefined/0/非有限数）不算到期：首轮立基线，不产出', () => {
    expect(isWeeklyRunDue(null, T0 + WEEKLY_INTERVAL_MS)).toBe(false);
    expect(isWeeklyRunDue(undefined, T0 + WEEKLY_INTERVAL_MS)).toBe(false);
    expect(isWeeklyRunDue(0, T0 + WEEKLY_INTERVAL_MS)).toBe(false);
    expect(isWeeklyRunDue(NaN, T0)).toBe(false);
  });

  it('距上次不足 7 天不到期；恰好 7 天即到期（≥ 语义）', () => {
    expect(isWeeklyRunDue(T0, T0 + WEEKLY_INTERVAL_MS - 1)).toBe(false);
    expect(isWeeklyRunDue(T0, T0 + WEEKLY_INTERVAL_MS)).toBe(true);
    expect(isWeeklyRunDue(T0, T0 + 8 * DAY)).toBe(true);
    expect(isWeeklyRunDue(T0 - 8 * DAY, T0)).toBe(true); // 久未启动，一开就补聚一次
  });
});

describe('新增差分与新增关联（数据来源：meta.notes 键 × link.state linkedAt）', () => {
  it('diffNewNotes：当前键 − 快照键，mtime 降序；快照为空（首轮后手动清）全量算新', () => {
    const notes = {
      '盒/新1.md': { mtime: T0 + 3 * DAY },
      '盒/新2.md': { mtime: T0 + DAY },
      '盒/旧.md': { mtime: T0 - 100 * DAY },
      '盒/无mtime.md': {}, // 畸形条目按 0 兜底排尾
    };
    const out = diffNewNotes(notes as any, ['盒/旧.md']);
    expect(out.map((n) => n.path)).toEqual(['盒/新1.md', '盒/新2.md', '盒/无mtime.md']);
    // 快照缺失（null）：全部笔记都算新（不传快照的极端防御）
    expect(diffNewNotes(notes as any, null)).toHaveLength(4);
  });

  it('collectNewLinks：只收窗口 (since, +∞) 内非空跑条目，时间降序', () => {
    const state = {
      '盒/a.md': { hash: 'h', linkedAt: new Date(T0 + 2 * DAY).toISOString() }, // 窗口内
      '盒/b.md': { hash: 'h', linkedAt: new Date(T0 - DAY).toISOString() }, // 窗口前
      '盒/c.md': { hash: 'h', linkedAt: new Date(T0 + 3 * DAY).toISOString(), empty: true }, // 0 条空跑
      '盒/d.md': { hash: 'h', linkedAt: '' }, // 非法时间戳
      '盒/e.md': { hash: 'h', linkedAt: new Date(T0 + DAY).toISOString() },
    };
    const out = collectNewLinks(state as any, T0);
    expect(out.map((l) => l.path)).toEqual(['盒/a.md', '盒/e.md']);
  });
});

describe('撞车阈值口径（向量 0.85 / TF-IDF 覆盖率 0.7；代码注释与测试同锚）', () => {
  const existing = new Set(['盒/既有.md']);

  it('向量通道：锐化后分数 ≥ WEEKLY_COLLISION_SCORE(0.85) 才算高度重合', () => {
    const hits = [
      { path: '盒/既有.md', chunk: 'x', score: WEEKLY_COLLISION_SCORE }, // 恰在阈值上（含）
      { path: '盒/既有.md', chunk: 'y', score: 0.7 }, // 同 path 低分命中不覆盖结论
    ];
    const c = pickVectorCollision('盒/新.md', hits, existing);
    expect(c).toEqual({ path: '盒/新.md', targetPath: '盒/既有.md', score: WEEKLY_COLLISION_SCORE, mode: 'vector' });
  });

  it('向量通道：恰低于阈值不算；自身剔除；目标不在既有快照内剔除；同 path 取最高分', () => {
    const below = pickVectorCollision('盒/新.md', [{ path: '盒/既有.md', chunk: '', score: 0.8499 }], existing);
    expect(below).toBeNull();
    const self = pickVectorCollision('盒/既有.md', [{ path: '盒/既有.md', chunk: '', score: 0.99 }], existing);
    expect(self).toBeNull(); // 自身不算撞
    const outsider = pickVectorCollision(
      '盒/新.md',
      [{ path: '盒/本轮新.md', chunk: '', score: 0.99 }],
      existing
    );
    expect(outsider).toBeNull(); // 本轮新笔记互撞不冒充「与既有内容重合」
    const best = pickVectorCollision(
      '盒/新.md',
      [
        { path: '盒/既有.md', chunk: 'a', score: 0.86 },
        { path: '盒/既有.md', chunk: 'b', score: 0.9 },
      ],
      existing
    );
    expect(best?.score).toBe(0.9);
  });

  it('token 覆盖率：同文 1、无关 0、部分覆盖给比例；query 无有效 token 返回 0 不误报', () => {
    expect(tokenContainment('知识管理方法论', '知识管理方法论')).toBe(1);
    expect(tokenContainment('量子纠缠实验', '猫在垫子上睡觉')).toBe(0);
    const partial = tokenContainment('知识管理方法论', '知识就是力量');
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
    expect(tokenContainment('的了是在', '知识管理')).toBe(0); // 全停用词
  });

  it('TF-IDF 降级通道：短名单内按覆盖率复检，≥ WEEKLY_COLLISION_CONTAINMENT(0.7) 判撞', () => {
    const selfText = '第二大脑的向量检索与自动关联管线设计笔记，讨论嵌入模型选型与近邻召回阈值口径。';
    const docTextOf = (p: string) =>
      p === '盒/既有.md'
        ? '第二大脑的向量检索与自动关联管线设计笔记，讨论嵌入模型选型与近邻召回阈值口径。加上一些旧补充。'
        : '完全无关的内容';
    const hits = [
      { path: '盒/无关.md' },
      { path: '盒/既有.md' }, // BM25 短名单（覆盖率与 BM25 排序不必一致，复检说了算）
    ];
    const c = pickTfidfCollision('盒/新.md', selfText, hits, docTextOf, existing);
    expect(c?.mode).toBe('tfidf');
    expect(c?.targetPath).toBe('盒/既有.md');
    expect(c!.score).toBeGreaterThanOrEqual(WEEKLY_COLLISION_CONTAINMENT);
    // 覆盖不足：不算撞
    const weak = pickTfidfCollision('盒/新.md', selfText, hits, () => '风马牛不相及的另一个话题', existing);
    expect(weak).toBeNull();
  });
});

describe('聚合编排 runWeeklyDigest（首轮基线 / 周界 / 产出 / 空轮 / force）', () => {
  beforeEach(() => {
    makeEnv();
  });

  it('首轮（无 weekly 段）：只立基线不产出——knownPaths 存当前键，digest 保持空', async () => {
    const store = makeStore({ '盒/a.md': '甲的内容' });
    const r = await runWeeklyDigest(store, { now: T0, probe: async () => true });
    expect(r.status).toBe('baseline');
    expect(r.digest).toBeNull();
    const s = await loadStore();
    expect(s.weekly?.lastRunAt).toBe(T0);
    expect(s.weekly?.knownPaths).toEqual(['盒/a.md']);
    expect(s.weekly?.digest).toBeNull();
  });

  it('未到周界（force=false）：不聚合，返回上一份摘要', async () => {
    await seedWeekly(T0, ['盒/a.md']);
    const store = makeStore({ '盒/a.md': '甲', '盒/新.md': '乙' });
    const r = await runWeeklyDigest(store, { now: T0 + 3 * DAY, probe: async () => true });
    expect(r.status).toBe('not-due');
    const s = await loadStore();
    expect(s.weekly?.knownPaths).toEqual(['盒/a.md']); // 快照未被刷新
    expect(Object.keys(store.meta.notes)).toContain('盒/新.md');
  });

  it('到周界且有新内容：产出摘要并落盘（新增笔记/新增关联/向量撞车），快照刷新', async () => {
    const since = T0;
    await seedWeekly(since, ['盒/既有.md']);
    // 新增一篇与其高度重合的笔记（向量通道命中既有 0.9）+ 一篇本周建链的
    const store = makeStore({
      '盒/既有.md': '旧笔记内容',
      '盒/重合.md': '与既有高度重合的新内容',
      '盒/独立.md': '另一篇新内容',
    });
    store.vectorSearch = vi.fn(async (query: string) =>
      query.includes('重合') ? [{ path: '盒/既有.md', chunk: '旧笔记内容', score: 0.9 }] : []
    );
    await mutateStore((s) => {
      s.link.state['盒/独立.md'] = { hash: 'h', linkedAt: new Date(since + DAY).toISOString() };
    });

    const r = await runWeeklyDigest(store, { now: since + 8 * DAY, probe: async () => true });
    expect(r.status).toBe('done');
    expect(r.digest!.newNotes.map((n) => n.path).sort()).toEqual(['盒/独立.md', '盒/重合.md']);
    expect(r.digest!.newLinks.map((l) => l.path)).toEqual(['盒/独立.md']);
    expect(r.digest!.collisions).toEqual([
      { path: '盒/重合.md', targetPath: '盒/既有.md', score: 0.9, mode: 'vector' },
    ]);
    expect(r.digest!.since).toBe(since);
    // 落盘：digest 持久化、快照刷新为当前键、lastRunAt 前移
    const s = await loadStore();
    expect(s.weekly?.digest?.collisions).toHaveLength(1);
    expect(s.weekly?.knownPaths.slice().sort()).toEqual(['盒/独立.md', '盒/既有.md', '盒/重合.md'].sort());
    expect(s.weekly?.lastRunAt).toBe(since + 8 * DAY);
  });

  it('空轮（无新笔记无新关联）：零产出不写摘要，但保留上一份非空摘要并刷新基线', async () => {
    const prevDigest: WeeklyDigest = {
      generatedAt: T0,
      since: T0 - 7 * DAY,
      until: T0,
      newNotes: [{ path: '盒/旧.md', mtime: T0 }],
      newLinks: [],
      collisions: [],
    };
    await seedWeekly(T0, ['盒/a.md'], prevDigest);
    const store = makeStore({ '盒/a.md': '甲' });
    const r = await runWeeklyDigest(store, { now: T0 + 8 * DAY, probe: async () => true });
    expect(r.status).toBe('empty');
    expect(r.digest).toBeNull(); // 本轮无产出
    const s = await loadStore();
    expect(s.weekly?.digest).toEqual(prevDigest); // 面板入口卡仍可回放上一份
    expect(s.weekly?.lastRunAt).toBe(T0 + 8 * DAY); // 基线照常前移（否则每周都会重扫同一批）
  });

  it('force（手动命令）：跳过周界直跑；AI 文案成功则写入摘要', async () => {
    await seedWeekly(T0, ['盒/a.md']);
    const store = makeStore({ '盒/a.md': '甲', '盒/新.md': '乙' });
    const r = await runWeeklyDigest(store, {
      force: true,
      now: T0 + DAY, // 不足 7 天，force 直跑
      probe: async () => true,
      askAI: async () => '本周新增一篇卡片，节奏平稳。',
    });
    expect(r.status).toBe('done');
    expect(r.digest?.aiSummary).toBe('本周新增一篇卡片，节奏平稳。');
  });

  it('AI 文案失败（未配置/网络错误）：降级纯列表，不阻塞产出', async () => {
    await seedWeekly(T0, ['盒/a.md']);
    const store = makeStore({ '盒/a.md': '甲', '盒/新.md': '乙' });
    const r = await runWeeklyDigest(store, {
      now: T0 + 8 * DAY,
      probe: async () => true,
      askAI: async () => {
        throw new Error('未配置 AI');
      },
    });
    expect(r.status).toBe('done');
    expect(r.digest?.aiSummary).toBeUndefined();
    expect(r.digest?.newNotes).toHaveLength(1);
  });

  it('成本护栏：新笔记超过 WEEKLY_MAX_COLLISION_CHECKS 篇时只检索最近几篇', async () => {
    await seedWeekly(T0, []);
    const notes: Record<string, string> = {};
    for (let i = 0; i < WEEKLY_MAX_COLLISION_CHECKS + 5; i++) notes[`盒/n${i}.md`] = `内容${i}`;
    const store = makeStore(notes);
    store.vectorSearch = vi.fn().mockResolvedValue([]);
    await runWeeklyDigest(store, { now: T0 + 8 * DAY, probe: async () => true });
    expect(store.vectorSearch).toHaveBeenCalledTimes(WEEKLY_MAX_COLLISION_CHECKS);
  });

  it('embedding 不可达：降级 TF-IDF 覆盖率通道判撞（probe=false，不调 vectorSearch）', async () => {
    await seedWeekly(T0, ['盒/既有.md']);
    const text = '每周知识动态的聚合口径与撞车判定阈值说明，覆盖向量近邻与分词覆盖率两条通道。';
    const store = makeStore({
      '盒/既有.md': text + '（既有篇另有补充段落，正文基本一致）',
      '盒/新.md': text,
    });
    store.vectorSearch = vi.fn();
    const r = await runWeeklyDigest(store, { now: T0 + 8 * DAY, probe: async () => false });
    expect(r.status).toBe('done');
    expect(store.vectorSearch).not.toHaveBeenCalled();
    expect(r.digest?.collisions).toHaveLength(1);
    expect(r.digest?.collisions[0].mode).toBe('tfidf');
    expect(r.digest?.collisions[0].targetPath).toBe('盒/既有.md');
    expect(r.digest?.collisions[0].score).toBeGreaterThanOrEqual(WEEKLY_COLLISION_CONTAINMENT);
  });
});

describe('summary prompt 与区间文案（AI 文案可选步）', () => {
  it('buildWeeklySummaryPrompt：给全计数与撞车名单，要求平实无 emoji', () => {
    const digest: WeeklyDigest = {
      generatedAt: T0,
      since: T0 - 7 * DAY,
      until: T0,
      newNotes: [
        { path: '盒/费曼学习法.md', mtime: T0 },
        { path: '盒/番茄钟实践.md', mtime: T0 },
      ],
      newLinks: [{ path: '盒/费曼学习法.md', linkedAt: new Date(T0).toISOString() }],
      collisions: [{ path: '盒/番茄钟实践.md', targetPath: '盒/旧番茄.md', score: 0.91, mode: 'vector' }],
    };
    const p = buildWeeklySummaryPrompt(digest);
    expect(p).toContain('新增笔记 2 篇');
    expect(p).toContain('新增关联 1 条');
    expect(p).toContain('1 篇与既有内容高度重合');
    expect(p).toContain('番茄钟实践');
    expect(p).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/u); // 提示词本身不带 emoji
  });

  it('formatDigestRange：同月/跨月/跨年区间', () => {
    expect(formatDigestRange(Date.parse('2026-09-08T00:00:00'), Date.parse('2026-09-15T00:00:00'))).toBe('9 月 8 日 – 9 月 15 日');
    expect(formatDigestRange(Date.parse('2026-08-30T00:00:00'), Date.parse('2026-09-06T00:00:00'))).toBe('8 月 30 日 – 9 月 6 日');
    expect(formatDigestRange(Date.parse('2025-12-29T00:00:00'), Date.parse('2026-01-04T00:00:00'))).toBe('2025 年 12 月 29 日 – 1 月 4 日');
  });
});

describe('weekly 段落盘与 Syncthing 冲突合并', () => {
  beforeEach(() => {
    makeEnv();
  });

  it('mutateStore 写入 weekly 段后 loadStore 读回结构一致；畸形 weekly 归 null（冷启动重立基线）', async () => {
    await seedWeekly(T0, ['盒/a.md'], {
      generatedAt: T0,
      since: T0 - DAY,
      until: T0,
      newNotes: [{ path: '盒/a.md', mtime: T0 }],
      newLinks: [],
      collisions: [],
    });
    const s = await loadStore();
    expect(s.weekly?.lastRunAt).toBe(T0);
    expect(s.weekly?.digest?.newNotes).toEqual([{ path: '盒/a.md', mtime: T0 }]);

    // 畸形：直接写坏段（缺 knownPaths）→ 读回 null
    await mutateStore((st) => {
      (st as any).weekly = { lastRunAt: 'not-a-number' };
    });
    const bad = await loadStore();
    expect(bad.weekly).toBeNull();
  });

  it('冲突合并：weekly 取 lastRunAt 大者（后聚合的设备权威）', () => {
    const base = {
      version: 1,
      meta: {},
      panel: null,
      link: { queue: [], state: {} },
      chatHistory: [],
      weekly: { lastRunAt: 100, knownPaths: ['a.md'], digest: null },
    } as any;
    const conflict = {
      version: 1,
      meta: {},
      panel: null,
      link: { queue: [], state: {} },
      chatHistory: [],
      weekly: { lastRunAt: 200, knownPaths: ['a.md', 'b.md'], digest: null },
    } as any;
    expect(mergeStoreWithConflict(base, conflict).weekly?.lastRunAt).toBe(200);
    expect(mergeStoreWithConflict(conflict, base).weekly?.lastRunAt).toBe(200);
    // 一侧无 weekly 段（旧版本文件）：保留有值一侧
    const noWeekly = { ...base, weekly: null };
    expect(mergeStoreWithConflict(noWeekly, conflict).weekly?.lastRunAt).toBe(200);
    expect(mergeStoreWithConflict(conflict, noWeekly).weekly?.lastRunAt).toBe(200);
  });
});
