// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CLOCK_STORAGE_KEY,
  CLOCK_TOLERANCE_MS,
  _resetClockForTests,
  clockSeenAt,
  clockSuspect,
  noteSeen,
  noteServerDateHeader,
  noteServerTime,
  seedClock,
  setClockStorage,
  trustedNow,
} from '../../src/core/trusted-clock';

/**
 * 内存 Storage：与 license-mirror / revoked 的测试一致，
 * 不引 jsdom，只给模块需要的那三个方法。
 */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
}

const g = globalThis as unknown as Record<string, unknown>;
let storage: MemoryStorage;

beforeAll(() => {
  storage = new MemoryStorage();
  g.window = globalThis;
  g.localStorage = storage;
});

afterAll(() => {
  delete g.localStorage;
});

beforeEach(() => {
  storage.clear();
  setClockStorage(storage);
  _resetClockForTests();
});

/** 2026-11-28 12:00:00 UTC+8 的一个固定时刻，手算期望值用 */
const T0 = Date.UTC(2026, 10, 28, 4, 0, 0);

describe('可信时间：只增不减', () => {
  it('系统时间正常时，可信时间就是当前时间', () => {
    noteSeen(T0);
    expect(trustedNow(T0)).toBe(T0);
    expect(trustedNow(T0 + 60_000)).toBe(T0 + 60_000);
  });

  it('把系统时间往回拨一年，可信时间仍停在上次见过的最晚时刻', () => {
    noteSeen(T0);
    const oneYearBack = T0 - 365 * 86_400_000;
    expect(trustedNow(oneYearBack)).toBe(T0);
  });

  it('重新读本地存储后高水位还在（模拟重启）', () => {
    noteSeen(T0);
    setClockStorage(storage); // 换一次后端 = 清内存缓存，重新从 localStorage 读
    expect(trustedNow(T0 - 86_400_000)).toBe(T0);
  });

  it('从 data.json 灌入的高水位比本地缓存晚时，取更晚的那个', () => {
    noteSeen(T0 - 86_400_000);
    seedClock(T0);
    expect(clockSeenAt()).toBe(T0);
    expect(trustedNow(T0 - 86_400_000)).toBe(T0);
  });

  it('灌入更早的时间不会把高水位拉低', () => {
    noteSeen(T0);
    seedClock(T0 - 86_400_000);
    expect(clockSeenAt()).toBe(T0);
  });
});

describe('时钟异常判定', () => {
  it('回拨几分钟不算异常（NTP 校时、时区抖动都在容差内）', () => {
    noteSeen(T0);
    expect(clockSuspect(T0 - 5 * 60_000)).toBe(false);
  });

  it('回拨超过容差才算异常', () => {
    noteSeen(T0);
    expect(clockSuspect(T0 - CLOCK_TOLERANCE_MS - 60_000)).toBe(true);
  });

  it('从没记录过高水位时不说异常（新装用户）', () => {
    expect(clockSuspect(T0 - 365 * 86_400_000)).toBe(false);
  });
});

describe('服务器时间锚点', () => {
  it('本地时间被调到过去时，服务器时间把高水位顶到真实时刻', () => {
    const local = T0 - 30 * 86_400_000; // 本地往回拨 30 天
    noteServerTime(T0, local);
    expect(clockSeenAt()).toBe(T0);
    expect(trustedNow(local)).toBe(T0);
    expect(clockSuspect(local)).toBe(true);
  });

  it('本地时间正常时，服务器时间只是把高水位对齐到现在', () => {
    noteServerTime(T0, T0 + 3_000);
    expect(clockSeenAt()).toBe(T0);
    expect(clockSuspect(T0 + 3_000)).toBe(false);
  });

  it('服务器时间解析自响应头（大小写都认）', () => {
    noteServerDateHeader({ Date: 'Fri, 28 Nov 2026 04:00:00 GMT' }, T0);
    expect(clockSeenAt()).toBe(T0);
  });

  it('响应头里没有 date / 解析不了时不改高水位', () => {
    noteSeen(T0);
    noteServerDateHeader({ 'content-type': 'application/json' }, T0 - 86_400_000);
    noteServerDateHeader({ date: '不是日期' }, T0 - 86_400_000);
    expect(clockSeenAt()).toBe(T0);
  });

  it('本地时间被调到未来后调回，高水位不会被拉回过去（只增）', () => {
    const future = T0 + 5 * 86_400_000;
    noteSeen(future);
    // 用户又把时间调回正常：高水位仍停在 future，过期码照样按过期算
    expect(trustedNow(T0)).toBe(future);
  });
});

describe('存储', () => {
  it('高水位写进 localStorage，键名固定', () => {
    noteSeen(T0);
    const raw = storage.getItem(CLOCK_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).seenAt).toBe(T0);
  });

  it('坏 JSON 当没记录，不抛错', () => {
    storage.setItem(CLOCK_STORAGE_KEY, '{坏');
    setClockStorage(storage);
    expect(() => trustedNow(T0)).not.toThrow();
    expect(trustedNow(T0)).toBe(T0);
  });
});

