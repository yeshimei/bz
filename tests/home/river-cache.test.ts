// @vitest-environment node
/**
 * 首页活动河「会话级缓存」守护（2026-11-15：首页每次重开卡顿）：
 * 同一库里重复打开不必重采全库；但数据真的变了必须回源，且刷新/失败/卸载的语义不能坏。
 *
 * 口径抄 ADR-0170（日记墙）：按 app 键控 + 在途去重 + 域事件失效 + 失败不缓存；
 * 额外两条是首页特有的：5 分钟兜底、跨天必回源（头行日期与「今天」这一列会跟着变）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const collectMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/home/river', () => ({
  collectRiver: (...args: unknown[]) => collectMock(...args),
}));

import { loadRiverCached, invalidateRiverCache, riverCacheFresh, resetRiverCache } from '../../src/home/river-cache';
import { emitDomainEvent } from '../../src/core/domain-bus';
import { setSettingsProvider } from '../../src/core/settings-provider';

const NOW = new Date('2026-11-15T12:00:00').getTime();
const TTL = 5 * 60 * 1000;

function river(tag = 'a'): any {
  return { tag, days: [], week: [], counts: {} };
}

beforeEach(() => {
  resetRiverCache();
  setSettingsProvider(() => ({}) as any);
  collectMock.mockReset();
  collectMock.mockImplementation(async () => river());
});

describe('home · 活动河会话缓存', () => {
  it('同一 app 连续两次只采一次，返回同一份结果', async () => {
    const app = {} as any;
    const a = await loadRiverCached(app, { now: NOW });
    const b = await loadRiverCached(app, { now: NOW + 1000 });
    expect(collectMock).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    expect(riverCacheFresh(app, NOW + 1000)).toBe(true);
  });

  it('显式失效（手动刷新 / keepHome 落地）后回源', async () => {
    const app = {} as any;
    await loadRiverCached(app, { now: NOW });
    invalidateRiverCache();
    expect(riverCacheFresh(app, NOW)).toBe(false);
    await loadRiverCached(app, { now: NOW });
    expect(collectMock).toHaveBeenCalledTimes(2);
  });

  it('force 恒回源，不吃缓存', async () => {
    const app = {} as any;
    await loadRiverCached(app, { now: NOW });
    await loadRiverCached(app, { now: NOW, force: true });
    expect(collectMock).toHaveBeenCalledTimes(2);
  });

  it('超过 5 分钟兜底回源（域事件漏发也不会长期显示旧数）', async () => {
    const app = {} as any;
    await loadRiverCached(app, { now: NOW });
    await loadRiverCached(app, { now: NOW + TTL - 1 });
    expect(collectMock).toHaveBeenCalledTimes(1);
    await loadRiverCached(app, { now: NOW + TTL + 1 });
    expect(collectMock).toHaveBeenCalledTimes(2);
  });

  it('跨天必回源（头行日期 / 今天这一列会变）', async () => {
    const app = {} as any;
    await loadRiverCached(app, { now: NOW });
    await loadRiverCached(app, { now: NOW + 24 * 60 * 60 * 1000 });
    expect(collectMock).toHaveBeenCalledTimes(2);
  });

  it('换 app（换库 / 测试逐例新建）整轮作废', async () => {
    await loadRiverCached({} as any, { now: NOW });
    await loadRiverCached({} as any, { now: NOW });
    expect(collectMock).toHaveBeenCalledTimes(2);
  });

  it('并发两路只采一次（在途去重）', async () => {
    let release!: (v: unknown) => void;
    collectMock.mockImplementationOnce(() => new Promise((res) => { release = res; }));
    const app = {} as any;
    const p1 = loadRiverCached(app, { now: NOW });
    const p2 = loadRiverCached(app, { now: NOW });
    release(river());
    const [a, b] = await Promise.all([p1, p2]);
    expect(collectMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('采集失败不缓存，下次调用重试', async () => {
    const app = {} as any;
    collectMock.mockRejectedValueOnce(new Error('disk busy'));
    await expect(loadRiverCached(app, { now: NOW })).rejects.toThrow('disk busy');
    await loadRiverCached(app, { now: NOW });
    expect(collectMock).toHaveBeenCalledTimes(2);
    expect(riverCacheFresh(app, NOW)).toBe(true);
  });

  it('域数据动作事件（memo / review / vault md 等）置脏后回源', async () => {
    const app = {} as any;
    await loadRiverCached(app, { now: NOW });
    emitDomainEvent('memo', { kind: 'add' });
    await loadRiverCached(app, { now: NOW });
    expect(collectMock).toHaveBeenCalledTimes(2);
  });

  it('采集途中被事件置脏 → 这轮结果不写缓存，下次重采', async () => {
    let release!: (v: unknown) => void;
    collectMock.mockImplementationOnce(() => new Promise((res) => { release = res; }));
    const app = {} as any;
    const p = loadRiverCached(app, { now: NOW });
    emitDomainEvent('review', { kind: 'rated' });
    release(river());
    await p;
    await loadRiverCached(app, { now: NOW });
    expect(collectMock).toHaveBeenCalledTimes(2);
  });

  it('首页设置改了就回源（readHomeSettings 每次现读、刻意不缓存的口径不能破）', async () => {
    const app = {} as any;
    setSettingsProvider(() => ({ homeNextCards: true, homeTimelineRange: 'week' }) as any);
    await loadRiverCached(app, { now: NOW });
    await loadRiverCached(app, { now: NOW });
    expect(collectMock).toHaveBeenCalledTimes(1);
    setSettingsProvider(() => ({ homeNextCards: false, homeTimelineRange: 'week' }) as any);
    await loadRiverCached(app, { now: NOW });
    expect(collectMock).toHaveBeenCalledTimes(2);
  });

  it('reset（插件卸载）后缓存与订阅一起归零', async () => {
    const app = {} as any;
    await loadRiverCached(app, { now: NOW });
    resetRiverCache();
    expect(riverCacheFresh(app, NOW)).toBe(false);
    await loadRiverCached(app, { now: NOW });
    expect(collectMock).toHaveBeenCalledTimes(2);
  });
});
