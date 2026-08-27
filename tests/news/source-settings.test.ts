/**
 * 剪藏本「数据源」组数据层测试（ticket 124，ADR-0060）：news.json 存在性检测、sources 开关读写、
 * UP 主名单增删（保留其它段）、状态行（最近抓取时间/UP 数）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import {
  readDataSourceState, writeSources, addBilibiliUp, removeBilibiliUp,
} from '../../src/news/source-settings';

const NEWS = 'CONFIG/STORAGE/news.json';

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

function fourSegments(articles: any[] = []) {
  return {
    articles,
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: ['1'],
    sources: { zhihu: true, guokr: true, bilibili: true },
  };
}

describe('数据源状态读取', () => {
  it('news.json 缺失 → exists=false，默认开关全开', async () => {
    const vault = new MockVault();
    setApp(makeApp(vault));
    const state = await readDataSourceState();
    expect(state.exists).toBe(false);
    expect(state.sources).toEqual({ zhihu: true, guokr: true, bilibili: true });
    expect(state.bilibiliUps).toEqual([]);
    expect(state.lastFetchAt).toBeNull();
  });

  it('news.json 存在 → 返回 sources/名单/最近抓取时间（取最新 fetchedAt）', async () => {
    const vault = new MockVault();
    vault.files.set(NEWS, JSON.stringify(fourSegments([
      { title: 'a', url: 'u1', platform: 'B站', fetchedAt: '2026-08-25 10:00:00' },
      { title: 'b', url: 'u2', platform: 'B站', fetchedAt: '2026-08-27 08:30:00' },
      { title: 'c', url: 'u3', platform: '知乎日报', fetchedAt: '2026-08-26 09:00:00' },
    ])));
    setApp(makeApp(vault));
    const state = await readDataSourceState();
    expect(state.exists).toBe(true);
    expect(state.bilibiliUps).toEqual(['1']);
    expect(state.lastFetchAt).toBe('2026-08-27 08:30:00');
    expect(state.totalArticles).toBe(3);
  });

  it('news.json 损坏 → exists=true 但骨架默认（防御不崩）', async () => {
    const vault = new MockVault();
    vault.files.set(NEWS, '{broken');
    setApp(makeApp(vault));
    const state = await readDataSourceState();
    expect(state.exists).toBe(true);
    expect(state.sources.bilibili).toBe(true);
    expect(state.bilibiliUps).toEqual([]);
    expect(state.lastFetchAt).toBeNull();
  });
});

describe('sources 开关读写', () => {
  it('writeSources：替换 sources 段，保留 articles/bilibiliUps/stats', async () => {
    const vault = new MockVault();
    vault.files.set(NEWS, JSON.stringify(fourSegments([{ title: 'a', url: 'u1' }])));
    setApp(makeApp(vault));
    await writeSources({ zhihu: false, guokr: true, bilibili: true });
    const disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.sources.zhihu).toBe(false);
    expect(disk.articles).toHaveLength(1);
    expect(disk.bilibiliUps).toEqual(['1']);
    expect(disk.stats.totalRead).toBe(0);
  });

  it('writeSources：news.json 缺失 → 落默认骨架（articles 空）', async () => {
    const vault = new MockVault();
    setApp(makeApp(vault));
    await writeSources({ zhihu: true, guokr: false, bilibili: true });
    const disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.sources.guokr).toBe(false);
    expect(disk.articles).toEqual([]);
  });
});

describe('UP 主名单增删', () => {
  it('addBilibiliUp：追加 uid 去重；保留其它段；缺失文件 → 建骨架', async () => {
    const vault = new MockVault();
    vault.files.set(NEWS, JSON.stringify(fourSegments()));
    setApp(makeApp(vault));
    expect(await addBilibiliUp('546195')).toBe(true);
    expect(await addBilibiliUp('546195')).toBe(false); // 去重
    expect(await addBilibiliUp('  123 ')).toBe(true);
    const disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliUps).toEqual(['1', '546195', '123']);
    expect(disk.articles).toEqual([]);

    const vault2 = new MockVault();
    setApp(makeApp(vault2));
    await addBilibiliUp('999');
    const disk2 = JSON.parse(vault2.files.get(NEWS)!);
    expect(disk2.bilibiliUps).toEqual(['999']);
    expect(disk2.sources.bilibili).toBe(true);
  });

  it('removeBilibiliUp：移除指定 uid，保留其它段', async () => {
    const vault = new MockVault();
    vault.files.set(NEWS, JSON.stringify(fourSegments([{ title: 'a' }])));
    setApp(makeApp(vault));
    await removeBilibiliUp('1');
    const disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliUps).toEqual([]);
    expect(disk.articles).toHaveLength(1);
  });
});