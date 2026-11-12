/** 发送内容的键白名单与脏键清洗。 */
import { describe, expect, it } from 'vitest';
import { buildDailyPayload, exportDay, pendingDates, retryDelay } from '../../src/core/usage/rollup';
import { emptyDay, emptyLedger, type DayBucket, type UsageMeta } from '../../src/core/usage/types';

const META: UsageMeta = {
  installId: '11111111-2222-4333-8444-555555555555',
  pluginVersion: '1.44.0',
  obsidianVersion: '1.9.12',
  platform: 'win32',
  isMobile: false,
  tz: 'Asia/Shanghai',
  locale: 'zh-CN',
};

const DAY: DayBucket = {
  ...emptyDay('2026-11-10'),
  sessions: 2,
  activeMinutes: 46,
  hourMinutes: (() => {
    const h = new Array<number>(24).fill(0);
    h[9] = 12;
    h[20] = 34;
    return h;
  })(),
  commands: { 'bz-memo-open': 5, 'bz-diary-open': 2 },
  domains: { memo: 5, diary: 2 },
  firstAt: 1,
  lastAt: 2,
};

describe('usage · 发送内容', () => {
  it('发送内容的键只有白名单里的那些', () => {
    const payload = buildDailyPayload(META, [DAY]);
    expect(Object.keys(payload).sort()).toEqual(
      ['days', 'installId', 'isMobile', 'locale', 'obsidianVersion', 'platform', 'pluginVersion', 'schema', 'tz'].sort(),
    );
    expect(Object.keys(payload.days[0]).sort()).toEqual(
      ['activeMinutes', 'commands', 'date', 'domains', 'firstAt', 'hourMinutes', 'lastAt', 'sessions'].sort(),
    );
  });

  it('没有任何内容类字段可乘虚而入（标题/路径/正文/搜索词）', () => {
    const json = JSON.stringify(buildDailyPayload(META, [DAY]));
    for (const forbidden of ['title', 'path', 'content', 'body', 'query', 'search', 'vault', 'file', 'url', 'apiKey']) {
      expect(json.includes(`"${forbidden}"`)).toBe(false);
    }
  });

  it('脏命令 id 与脏域键在出口被洗掉', () => {
    const dirty: DayBucket = {
      ...emptyDay('2026-11-10'),
      commands: { 'bz-memo-open': 1, '../../etc/passwd': 9, 'bz-Bad Key': 9, '': 9 } as Record<string, number>,
      domains: { memo: 1, '../evil': 9, 'UPPER': 9 } as Record<string, number>,
    };
    const out = exportDay(dirty);
    expect(out.commands).toEqual({ 'bz-memo-open': 1 });
    expect(out.domains).toEqual({ memo: 1 });
  });

  it('只发早于今天的日子，一次最多 7 天，且从最早的补起', () => {
    const l = emptyLedger(0);
    for (let i = 1; i <= 10; i += 1) {
      const d = `2026-11-${String(i).padStart(2, '0')}`;
      l.days[d] = emptyDay(d);
    }
    l.days['2026-11-11'] = emptyDay('2026-11-11'); // 今天：不发
    const now = new Date(2026, 10, 11, 22, 0).getTime();
    expect(pendingDates(l, now)).toHaveLength(7);
    expect(pendingDates(l, now)).not.toContain('2026-11-11');
    expect(pendingDates(l, now)[0]).toBe('2026-11-01'); // 10 天里取最早 7 天
    l.lastSentDate = '2026-11-07';
    expect(pendingDates(l, now)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']);
  });

  it('积压超过一批时分轮发完，中间的日子不会被留在窗口外', () => {
    const l = emptyLedger(0);
    for (let i = 1; i <= 10; i += 1) {
      const d = `2026-11-${String(i).padStart(2, '0')}`;
      l.days[d] = emptyDay(d);
    }
    const now = new Date(2026, 10, 11, 22, 0).getTime();
    const first = pendingDates(l, now);
    l.lastSentDate = first[first.length - 1];
    const second = pendingDates(l, now);
    expect([...first, ...second]).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
    ]);
  });

  it('退避档位：6h → 12h → 24h 封顶', () => {
    expect(retryDelay(1)).toBe(6 * 3600_000);
    expect(retryDelay(2)).toBe(12 * 3600_000);
    expect(retryDelay(3)).toBe(24 * 3600_000);
    expect(retryDelay(99)).toBe(24 * 3600_000);
  });
});
