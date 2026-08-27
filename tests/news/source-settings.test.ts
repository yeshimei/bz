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
  writeBilibiliMaxItems, writeBilibiliCookie,
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

  it('readDataSourceState：透出 bilibiliUpInfo（后台回填名字/头像；缺失 → 空对象）', async () => {
    const vault = new MockVault();
    vault.files.set(NEWS, JSON.stringify({
      ...fourSegments(),
      bilibiliUpInfo: { '1': { name: '老番茄', avatar: 'http://i0.hdslb.com/bfs/face/a.jpg' } },
    }));
    setApp(makeApp(vault));
    const state = await readDataSourceState();
    expect(state.bilibiliUpInfo).toEqual({ '1': { name: '老番茄', avatar: 'https://i0.hdslb.com/bfs/face/a.jpg' } });
    // 段损坏 → 空对象不崩
    vault.files.set(NEWS, JSON.stringify({ ...fourSegments(), bilibiliUpInfo: 'bad' }));
    const state2 = await readDataSourceState();
    expect(state2.bilibiliUpInfo).toEqual({});
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

  it('增删 UP 主保留/清理 bilibiliUpInfo 段（ticket 126）', async () => {
    const vault = new MockVault();
    vault.files.set(NEWS, JSON.stringify({ ...fourSegments(), bilibiliUpInfo: { '1': { name: '老番茄' }, '9': { name: 'x' } } }));
    setApp(makeApp(vault));
    await addBilibiliUp('999');
    let disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliUps).toEqual(['1', '999']);
    expect(disk.bilibiliUpInfo).toEqual({ '1': { name: '老番茄' }, '9': { name: 'x' } }); // 添加保留资料段
    await removeBilibiliUp('1');
    disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliUps).toEqual(['999']);
    expect(disk.bilibiliUpInfo).toEqual({ '9': { name: 'x' } }); // 移除时清掉该 uid 资料
    expect(disk.articles).toHaveLength(0);
  });

  it('文件缺失路径写骨架：含空 bilibiliUpInfo 段（第五段自洽）', async () => {
    const vault = new MockVault();
    setApp(makeApp(vault));
    await addBilibiliUp('999');
    const disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliUpInfo).toEqual({});
    expect(disk.sources.bilibili).toBe(true);
  });
});

describe('B 站抓取条数与 Cookie（ticket 127）', () => {
  it('readDataSourceState：透出 bilibiliMaxItems（默认 10）与 bilibiliCookie（默认空串）', async () => {
    const vault = new MockVault();
    vault.files.set(NEWS, JSON.stringify({ ...fourSegments(), bilibiliMaxItems: 7, bilibiliCookie: 'SESSDATA=abc' }));
    setApp(makeApp(vault));
    const state = await readDataSourceState();
    expect(state.bilibiliMaxItems).toBe(7);
    expect(state.bilibiliCookie).toBe('SESSDATA=abc');
    // 缺失 → 默认
    const vault2 = new MockVault();
    vault2.files.set(NEWS, JSON.stringify(fourSegments()));
    setApp(makeApp(vault2));
    const state2 = await readDataSourceState();
    expect(state2.bilibiliMaxItems).toBe(10);
    expect(state2.bilibiliCookie).toBe('');
  });

  it('writeBilibiliMaxItems：写回并夹取 1..50，保留其它段；非法回退 10', async () => {
    const vault = new MockVault();
    vault.files.set(NEWS, JSON.stringify({ ...fourSegments([{ title: 'a' }]), bilibiliUpInfo: { '1': { name: '老番茄' } } }));
    setApp(makeApp(vault));
    await writeBilibiliMaxItems('5');
    let disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliMaxItems).toBe(5);
    expect(disk.articles).toHaveLength(1);
    expect(disk.bilibiliUpInfo).toEqual({ '1': { name: '老番茄' } }); // 其它段保留
    await writeBilibiliMaxItems('999');
    disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliMaxItems).toBe(50); // 上夹取
    await writeBilibiliMaxItems('abc');
    disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliMaxItems).toBe(10); // 非法回退 10
  });

  it('writeBilibiliCookie：保存去空白；空串清除；骨架路径自洽', async () => {
    const vault = new MockVault();
    vault.files.set(NEWS, JSON.stringify(fourSegments()));
    setApp(makeApp(vault));
    await writeBilibiliCookie('  buvid3=x; SESSDATA=y  ');
    let disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliCookie).toBe('buvid3=x; SESSDATA=y');
    await writeBilibiliCookie('');
    disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliCookie).toBe('');
    // 文件缺失 → 建骨架
    const vault2 = new MockVault();
    setApp(makeApp(vault2));
    await writeBilibiliCookie('SESSDATA=z');
    const disk2 = JSON.parse(vault2.files.get(NEWS)!);
    expect(disk2.bilibiliCookie).toBe('SESSDATA=z');
    expect(disk2.bilibiliMaxItems).toBe(10);
  });
});