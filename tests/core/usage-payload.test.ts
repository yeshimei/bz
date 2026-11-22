/** 发送内容的键白名单与脏键清洗。 */
import { describe, expect, it } from 'vitest';
import { buildDailyPayload, exportDay, markDailySent, pendingDates, retryDelay } from '../../src/core/usage/rollup';
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
    const payload = buildDailyPayload(META, [DAY], '2026-08-15');
    expect(Object.keys(payload).sort()).toEqual(
      ['days', 'installId', 'isMobile', 'locale', 'obsidianVersion', 'platform', 'pluginVersion', 'schema', 'since', 'tz'].sort(),
    );
    expect(Object.keys(payload.days[0]).sort()).toEqual(
      ['activeMinutes', 'commands', 'date', 'domains', 'firstAt', 'hourMinutes', 'lastAt', 'sessions'].sort(),
    );
  });

  it('考古没结果时不发 since 这个键（不是发空串）', () => {
    const payload = buildDailyPayload(META, [DAY]);
    expect('since' in payload).toBe(false);
  });

  it('since 只是一串日期，不是路径也不是文件名', () => {
    const payload = buildDailyPayload(META, [DAY], '2026-08-15');
    expect(payload.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.since).not.toContain('/');
    expect(payload.since!.length).toBeLessThanOrEqual(10);
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

  it('今天也发（当天就能看 DAU），一次最多 7 天，且从最早的补起', () => {
    const l = emptyLedger(0);
    for (let i = 1; i <= 10; i += 1) {
      const d = `2026-11-${String(i).padStart(2, '0')}`;
      l.days[d] = emptyDay(d);
    }
    l.days['2026-11-11'] = emptyDay('2026-11-11'); // 今天：也发
    const now = new Date(2026, 10, 11, 22, 0).getTime();
    expect(pendingDates(l, now)).toHaveLength(7);
    expect(pendingDates(l, now)[0]).toBe('2026-11-01'); // 11 天取最早 7 天，今天排在后面等下一轮
    l.lastSentDate = '2026-11-07';
    expect(pendingDates(l, now)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']);
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

  it('今天的日子发出去也不推进水位（明天要整份重发）', () => {
    const l = emptyLedger(0);
    l.lastSentDate = '2026-11-10';
    l.days['2026-11-11'] = emptyDay('2026-11-11');
    const now = new Date(2026, 10, 11, 22, 0).getTime();
    const sent = pendingDates(l, now);
    expect(sent).toEqual(['2026-11-11']);
    markDailySent(l, sent, '2026-11-11');
    expect(l.lastSentDate).toBe('2026-11-10'); // 只有今天，水位不动

    l.lastSentDate = '';
    l.days['2026-11-10'] = emptyDay('2026-11-10');
    markDailySent(l, ['2026-11-10', '2026-11-11'], '2026-11-11');
    expect(l.lastSentDate).toBe('2026-11-10'); // 只认已过完的昨天
  });

  it('配套插件快照跟着日汇总走（心跳删掉后这是唯一的上报路径）', () => {
    const meta: UsageMeta = {
      ...META,
      reader: {
        state: 'active',
        tier: 'paid',
        version: '1.6.0',
        minutes: 120,
        daysSince: 1,
        licenseId: 'BZR-AF-2026-0017',
      },
      review: {
        state: 'idle',
        tier: 'basic',
        version: '1.0.2',
        items: 0,
        daysSince: -1,
      },
      guideDone: true,
      updateAuto: false,
    };
    const p = buildDailyPayload(meta, [DAY]);
    expect(p.reader?.licenseId).toBe('BZR-AF-2026-0017');
    expect(p.reader?.tier).toBe('paid');
    expect(p.review?.version).toBe('1.0.2');
    expect(p.guideDone).toBe(true);
    expect(p.updateAuto).toBe(false);
    // 没装的设备不带 review 这个键，服务端的旧值就不会被冲掉
    const bare = buildDailyPayload(META, [DAY]);
    expect('reader' in bare).toBe(false);
    expect('review' in bare).toBe(false);
    expect('guideDone' in bare).toBe(false);
  });

  it('退避档位：6h → 12h → 24h 封顶', () => {
    expect(retryDelay(1)).toBe(6 * 3600_000);
    expect(retryDelay(2)).toBe(12 * 3600_000);
    expect(retryDelay(3)).toBe(24 * 3600_000);
    expect(retryDelay(99)).toBe(24 * 3600_000);
  });

  /* ── 2026-11-22：封码状态、档位成因、激活失败、起点版本 ────────────── */

  it('第一次见到的版本只在有值时才带，且与当前版本是两个键', () => {
    expect('firstVersion' in buildDailyPayload(META, [DAY])).toBe(false);
    expect('firstVersion' in buildDailyPayload(META, [DAY], '2026-08-15')).toBe(false);
    const p = buildDailyPayload(META, [DAY], '2026-08-15', '1.30.0');
    expect(p.firstVersion).toBe('1.30.0');
    // 当前版本还是 1.44.0：两个数不一样，才看得出这台是从老版本升上来的
    expect(p.pluginVersion).toBe('1.44.0');
  });

  it('封码状态与激活失败跟着快照走，且不掺码原文', () => {
    const meta: UsageMeta = {
      ...META,
      reader: {
        state: 'active',
        tier: 'basic',
        version: '1.7.0',
        minutes: 30,
        daysSince: 2,
        licenseId: 'BZR-AF-2026-0017',
        revoked: true,
        revokedAt: 1_800_000_000_000,
        tierReason: 'revoked',
        activateFail: 'offline',
        activateFailAt: 1_800_000_100_000,
      },
    };
    const p = buildDailyPayload(meta, [DAY]);
    expect(p.reader?.revoked).toBe(true);
    expect(p.reader?.tierReason).toBe('revoked');
    expect(p.reader?.activateFail).toBe('offline');
    const json = JSON.stringify(p);
    expect(json).not.toContain('BZP2.');
    expect(json).not.toContain('BZR2.');
  });

  it('没探测到的设备不带这些键（不拿 false / none 冒充）', () => {
    const meta: UsageMeta = {
      ...META,
      reader: { state: 'active', tier: 'paid', version: '1.7.0', minutes: 1, daysSince: 0 },
    };
    const p = buildDailyPayload(meta, [DAY]);
    expect('revoked' in (p.reader || {})).toBe(false);
    expect('tierReason' in (p.reader || {})).toBe(false);
    expect('activateFail' in (p.reader || {})).toBe(false);
  });
});
