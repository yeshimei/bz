/** 同步时序与退避（假时钟）。
 *
 * 2026-11-22 起「上线心跳」整条链路删掉（它每 2 分钟写 4 次，403 台一天 116 万次，
 * 把 Appwrite 额度写爆）。现在只有一条上报路径：日汇总。这份测试跟着改成：
 * 启动后只发日汇总、没有第二条请求、一小时内重载不重发。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUsage, type UsageHost } from '../../src/core/usage/collect';
import { localDayKey } from '../../src/core/ui/str';
import {
  emptyDay,
  emptyLedger,
  type DailyPayload,
  type Ledger,
  type UsageMeta,
} from '../../src/core/usage/types';

const BASE = new Date(2026, 10, 11, 9, 0).getTime();
const META: UsageMeta = {
  installId: '11111111-2222-4333-8444-555555555555',
  pluginVersion: '1.44.0',
  obsidianVersion: '1.9.12',
  platform: 'win32',
  isMobile: false,
  tz: 'Asia/Shanghai',
  locale: 'zh-CN',
};

interface Harness {
  host: UsageHost;
  dailies: DailyPayload[];
  saves: Ledger[];
  advance(ms: number): Promise<void>;
  setVisible(v: boolean): void;
  setDailyOk(v: boolean): void;
}

function makeHarness(
  init: { ledger?: Ledger | null; visible?: boolean; dailyOk?: boolean; enabled?: boolean; since?: string } = {},
): Harness {
  let now = BASE;
  let visible = init.visible ?? true;
  let dailyOk = init.dailyOk ?? true;
  const since = init.since ?? '';
  const dailies: DailyPayload[] = [];
  const saves: Ledger[] = [];
  const host: UsageHost = {
    now: () => now,
    visible: () => visible,
    enabled: () => init.enabled ?? true,
    load: async () => init.ledger ?? null,
    save: async (l) => {
      saves.push(JSON.parse(JSON.stringify(l)) as Ledger);
    },
    sendDaily: async (p) => {
      dailies.push(p);
      return dailyOk;
    },
    meta: () => META,
    probeSince: async () => since,
    warn: () => undefined,
    setInterval: (fn, ms) => globalThis.setInterval(fn, ms) as unknown as number,
    clearInterval: (id) =>
      globalThis.clearInterval(id as unknown as Parameters<typeof globalThis.clearInterval>[0]),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number,
    clearTimeout: (id) =>
      globalThis.clearTimeout(id as unknown as Parameters<typeof globalThis.clearTimeout>[0]),
  };
  return {
    host,
    dailies,
    saves,
    async advance(ms: number) {
      now += ms;
      await vi.advanceTimersByTimeAsync(ms);
    },
    setVisible(v: boolean) {
      visible = v;
    },
    setDailyOk(v: boolean) {
      dailyOk = v;
    },
  };
}

function ledgerWithYesterday(): Ledger {
  const yesterday = localDayKey(BASE - 86_400_000);
  const day = emptyDay(yesterday);
  day.activeMinutes = 25;
  day.sessions = 1;
  day.commands['bz-memo-open'] = 3;
  day.domains.memo = 3;
  const l = emptyLedger(BASE - 86_400_000);
  l.days[yesterday] = day;
  return l;
}

describe('usage · 同步时序', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('心跳已移除：启动后只有日汇总这一条上报，两分钟内没有第二发', async () => {
    const h = makeHarness();
    createUsage(h.host);
    await h.advance(21_000);
    // startSession 建了今天的桶，20 秒那一发就带着「今天」走了
    expect(h.dailies).toHaveLength(1);
    await h.advance(2 * 60_000);
    expect(h.dailies).toHaveLength(1);
    await h.advance(10 * 60_000);
    expect(h.dailies).toHaveLength(1);
  });

  it('窗口不可见时不记活跃分钟（心跳没了，但「真的在看」的判据不变）', async () => {
    const h = makeHarness({ visible: false });
    const handle = createUsage(h.host);
    await h.advance(70_000);
    const today = localDayKey(BASE + 70_000);
    expect(handle.snapshot().days[today]?.activeMinutes ?? 0).toBe(0);
  });

  it('启动 20 秒发送昨天的日汇总，成功后 lastSentDate 推进', async () => {
    const h = makeHarness({ ledger: ledgerWithYesterday() });
    const handle = createUsage(h.host);
    await h.advance(21_000);
    expect(h.dailies).toHaveLength(1);
    const yesterday = localDayKey(BASE - 86_400_000);
    const today = localDayKey(BASE + 21_000);
    // 今天也带一条：当天就能看到今日活跃；水位只认昨天，今天明天会整份重发
    expect(h.dailies[0].days.map((d) => d.date)).toEqual([yesterday, today]);
    expect(h.dailies[0].days[0].commands['bz-memo-open']).toBe(3);
    expect(handle.snapshot().lastSentDate).toBe(yesterday);
  });

  it('发送失败按 6 小时退避，不会每拍重试', async () => {
    const h = makeHarness({ ledger: ledgerWithYesterday(), dailyOk: false });
    const handle = createUsage(h.host);
    await h.advance(21_000);
    expect(h.dailies).toHaveLength(1);
    expect(handle.snapshot().failures).toBe(1);
    await h.advance(60_000);
    expect(h.dailies).toHaveLength(1); // 6 小时内不再试
    h.setDailyOk(true);
    await h.advance(6 * 60 * 60 * 1000);
    expect(h.dailies.length).toBeGreaterThanOrEqual(2);
    expect(handle.snapshot().lastSentDate).toBe(localDayKey(BASE - 86_400_000));
  });

  it('一小时内重载插件不重发同一份（跨重启节流，账本里的 lastAttemptAt 是判据）', async () => {
    const h = makeHarness({ ledger: ledgerWithYesterday() });
    const first = createUsage(h.host);
    await h.advance(21_000);
    expect(h.dailies).toHaveLength(1);
    await first.stop();
    const saved = h.saves[h.saves.length - 1];
    expect(saved.lastAttemptAt).toBeGreaterThan(0);

    // 30 分钟后重载：节流期内，一条都不该发
    const again = makeHarness({ ledger: saved });
    createUsage(again.host);
    await again.advance(30 * 60_000);
    expect(again.dailies).toHaveLength(0);

    // 再过一小时（总间隔超过 MIN_UPLOAD_GAP_MS）：放行
    await again.advance(60 * 60_000);
    expect(again.dailies.length).toBeGreaterThanOrEqual(1);
  });

  it('端点没配（enabled=false）时一条请求都不发，但本地照记', async () => {
    const h = makeHarness({ enabled: false });
    const handle = createUsage(h.host);
    handle.trackCommand('bz-memo-open');
    await h.advance(70_000);
    expect(h.dailies).toHaveLength(0);
    const today = localDayKey(BASE + 70_000);
    expect(handle.snapshot().days[today]?.commands['bz-memo-open']).toBe(1);
  });

  it('卸载时停表并最后落盘一次', async () => {
    const h = makeHarness();
    const handle = createUsage(h.host);
    handle.trackCommand('bz-diary-open');
    await h.advance(1_000);
    const before = h.dailies.length;
    await handle.stop();
    expect(h.saves.length).toBeGreaterThanOrEqual(1);
    const saved = h.saves[h.saves.length - 1];
    const today = localDayKey(BASE + 1_000);
    expect(saved.days[today]?.commands['bz-diary-open']).toBe(1);
    await h.advance(10 * 60_000);
    expect(h.dailies).toHaveLength(before);
  });

  it('装载完成前发生的命令不丢（进队列补记）', async () => {
    const h = makeHarness({ ledger: ledgerWithYesterday() });
    const handle = createUsage(h.host);
    handle.trackCommand('bz-memo-open'); // ready 之前
    await h.advance(1_000);
    const today = localDayKey(BASE + 1_000);
    expect(handle.snapshot().days[today]?.commands['bz-memo-open']).toBe(1);
  });

  it('账本还没读完时定时拍不记活跃分钟', async () => {
    let finish!: () => void;
    const h = makeHarness();
    h.host.load = () =>
      new Promise<Ledger | null>((res) => {
        finish = () => res(null);
      });
    const handle = createUsage(h.host);
    await h.advance(130_000); // 两拍过去，账本还没读回来
    const today = localDayKey(BASE + 130_000);
    expect(handle.snapshot().days[today]?.activeMinutes ?? 0).toBe(0);
    finish();
    await h.advance(60_000);
    expect(handle.snapshot().days[today]?.activeMinutes ?? 0).toBeGreaterThan(0);
  });

  it('上一次请求还没回来时，下一拍不会再叠一份', async () => {
    let release!: () => void;
    const h = makeHarness({ ledger: ledgerWithYesterday() });
    h.host.sendDaily = (p) => {
      h.dailies.push(p);
      return new Promise<boolean>((res) => {
        release = () => res(true);
      });
    };
    createUsage(h.host);
    await h.advance(21_000);
    expect(h.dailies).toHaveLength(1);
    await h.advance(120_000); // 两拍，请求都还挂着
    expect(h.dailies).toHaveLength(1);
    release();
    await h.advance(1_000);
    expect(h.dailies).toHaveLength(1);
  });

  it('考古到的「最早使用日」跟着日汇总一起发', async () => {
    const h = makeHarness({ ledger: ledgerWithYesterday(), since: '2026-08-15' });
    createUsage(h.host);
    await h.advance(21_000);
    expect(h.dailies[0].since).toBe('2026-08-15');
  });

  it('考古没查到就不带 since 这个键（服务端按 firstSeen 兜底）', async () => {
    const h = makeHarness({ ledger: ledgerWithYesterday() });
    createUsage(h.host);
    await h.advance(21_000);
    expect('since' in h.dailies[0]).toBe(false);
  });

  it('每次启动都扫一遍，只往早里走，绝不改晚', async () => {
    const h = makeHarness({ since: '2026-08-15' });
    const handle = createUsage(h.host);
    await h.advance(1_000);
    expect(handle.snapshot().sinceDay).toBe('2026-08-15');
    await handle.stop();
    const saved = h.saves[h.saves.length - 1];
    expect(saved.sinceDay).toBe('2026-08-15');

    // 同一个设备号换一个库启动：这份账本只记了 8-15，新库扫出更早的 8-02 → 取 8-02
    const h2 = makeHarness({ ledger: saved, since: '2026-08-02' });
    const again = createUsage(h2.host);
    await h2.advance(1_000);
    expect(again.snapshot().sinceDay).toBe('2026-08-02');

    // 反过来：新库扫到的比账本里晚（8-20），保持 8-15 不动
    const h3 = makeHarness({ ledger: saved, since: '2026-08-20' });
    const third = createUsage(h3.host);
    await h3.advance(1_000);
    expect(third.snapshot().sinceDay).toBe('2026-08-15');
  });

  it('这次没扫到（目录还没建）时保留账本里的旧值', async () => {
    const h = makeHarness({ ledger: ledgerWithYesterday() });
    h.host.probeSince = async () => '';
    const handle = createUsage(h.host);
    await h.advance(1_000);
    expect(handle.snapshot().sinceDay).toBe('');
  });
});
