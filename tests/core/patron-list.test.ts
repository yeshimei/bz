import { beforeEach, describe, expect, it } from 'vitest';
import {
  PATRON_CACHE_KEY,
  _resetPatronsForTests,
  _setPatronsHttpForTests,
  currentPatrons,
  onPatronsChange,
  parsePatrons,
  patronsFetchedAt,
  patronsStatus,
  refreshPatrons,
} from '../../src/core/patron-list';

/* ============================================================
 * 在线赞赏名单（tests/core/patron-list.test.ts）
 *
 * 2026-11-11 起名单不内置：从主仓 docs/patrons.json 的两个地址并发取。
 * 这份测「远端不可信」的那一面——格式坏、条目坏、两个源都挂、缓存是半截，
 * 任何一种都不能让赞赏窗崩、不能显示假数据、更不能把好缓存覆盖掉。
 * 真实网络走真机（请求函数可注入）。
 *
 * 与 bz-reader 的 tests/patrons.test.ts 是同一套用例：两边解析规则必须一致，
 * 改一边的规则时另一边要跟着改（格式说明见 docs/patrons.md）。
 * ============================================================ */

/** 当前这批 mock 的请求记录（每条 URL 一次） */
let calls: string[] = [];

function setHttp(fn: (url: string) => Promise<string | null> | string | null): void {
  calls = [];
  _setPatronsHttpForTests(async (url) => {
    calls.push(url);
    return await fn(url);
  });
}

function doc(list: unknown[], updatedAt = '2026-11-11'): string {
  return JSON.stringify({ version: 1, updatedAt, patrons: list });
}

const GOOD = [
  { name: '沁弦', amount: 6.66, date: '2026-11-11', message: 'KEEP IT UP!Love from Charis523' },
  { name: '面包', amount: 'patron', date: '2026-11-10' },
  { name: '执徐', amount: 12, date: '2026-11-08', message: '伟大无需多言！' },
];

beforeEach(() => {
  window.localStorage.clear();
  _resetPatronsForTests();
  _setPatronsHttpForTests(null);
  calls = [];
});

describe('解析 · 一份远端 JSON 能变成什么', () => {
  it('合法文档：条目原样保留，倒序排好', () => {
    const list = parsePatrons(doc(GOOD));
    expect(list).not.toBeNull();
    expect(list!.map((p) => p.name)).toEqual(['沁弦', '面包', '执徐']);
    expect(list![0]!.amount).toBe(6.66);
    expect(list![1]!.amount).toBe('patron');
    expect(list![2]!.message).toBe('伟大无需多言！');
  });

  it('顺序反了也能救：按日期倒序重排，同一天保持文件顺序', () => {
    const list = parsePatrons(
      doc([
        { name: '最早', amount: 1, date: '2026-11-01' },
        { name: '同天甲', amount: 2, date: '2026-11-10' },
        { name: '最新', amount: 3, date: '2026-11-11' },
        { name: '同天乙', amount: 4, date: '2026-11-10' },
      ]),
    );
    expect(list!.map((p) => p.name)).toEqual(['最新', '同天甲', '同天乙', '最早']);
  });

  it('坏一条丢一条，不连累其余', () => {
    const list = parsePatrons(
      doc([
        { name: '好一', amount: 3, date: '2026-11-11' },
        { name: '', amount: 3, date: '2026-11-10' },
        { name: '缺金额', date: '2026-11-09' },
        { name: '金额零', amount: 0, date: '2026-11-08' },
        { name: '金额离谱', amount: 100000, date: '2026-11-07' },
        { name: '日期假的', amount: 5, date: '2026-13-01' },
        { name: '好二', amount: 'patron', date: '2026-11-06' },
      ]),
    );
    expect(list!.map((p) => p.name)).toEqual(['好一', '好二']);
  });

  it('全坏 = 整份不可用（不是空名单）', () => {
    expect(parsePatrons(doc([{ name: '' }, { date: '昨天' }]))).toBeNull();
  });

  it('空数组是合法的「还没有人」', () => {
    expect(parsePatrons(doc([]))).toEqual([]);
  });

  it('顶层不对：不是对象、缺 patrons、JSON 语法错，一律 null', () => {
    expect(parsePatrons('not json')).toBeNull();
    expect(parsePatrons('null')).toBeNull();
    expect(parsePatrons({ names: GOOD })).toBeNull();
    expect(parsePatrons({ patrons: 'oops' })).toBeNull();
  });

  it('留言折行压成空格、超长截断；昵称超长整条丢弃', () => {
    const list = parsePatrons(
      doc([
        { name: '折行', amount: 1, date: '2026-11-11', message: '第一行\n第二行' },
        { name: '长留言', amount: 1, date: '2026-11-10', message: '字'.repeat(200) },
        { name: '名'.repeat(41), amount: 1, date: '2026-11-09' },
      ]),
    );
    expect(list!.map((p) => p.name)).toEqual(['折行', '长留言']);
    expect(list![0]!.message).toBe('第一行 第二行');
    expect(list![1]!.message!.length).toBe(120);
  });

  it('金额写成字符串数字不算数（防手改）', () => {
    expect(parsePatrons(doc([{ name: '手滑', amount: '12', date: '2026-11-10' }]))).toBeNull();
  });
});

describe('拉取 · 两个源谁先回用谁', () => {
  it('第一个源挂、第二个源通：拿第二个，状态 ready', async () => {
    setHttp((url) => (url.includes('gitee') ? doc(GOOD) : null));
    expect(await refreshPatrons()).toBe(true);
    expect(currentPatrons().map((p) => p.name)).toEqual(['沁弦', '面包', '执徐']);
    expect(patronsStatus()).toBe('ready');
  });

  it('第一个源回坏 JSON、第二个合法：跳过坏的用好的', async () => {
    setHttp((url) => (url.includes('github') ? '{oops' : doc(GOOD)));
    expect(await refreshPatrons()).toBe(true);
    expect(currentPatrons().length).toBe(3);
  });

  it('两个源都挂：false，状态 failed，名单仍为空', async () => {
    setHttp(() => null);
    expect(await refreshPatrons()).toBe(false);
    expect(currentPatrons()).toEqual([]);
    expect(patronsStatus()).toBe('failed');
  });

  it('已经有一份好数据时再失败：旧名单原样留着，不降级', async () => {
    setHttp(() => doc(GOOD));
    await refreshPatrons();
    const before = currentPatrons().map((p) => p.name);

    setHttp(() => null);
    expect(await refreshPatrons({ force: true })).toBe(false);
    expect(currentPatrons().map((p) => p.name)).toEqual(before);
    expect(patronsStatus()).toBe('ready');
  });

  it('请求 URL 带破缓存参数（否则 CDN 五分钟的老名单）', async () => {
    setHttp(() => doc(GOOD));
    await refreshPatrons();
    expect(calls.length).toBeGreaterThan(0);
    for (const url of calls) expect(url).toMatch(/[?&]t=\d+/);
  });

  it('空名单也是一份有效结果：状态 ready、人数 0', async () => {
    setHttp(() => doc([]));
    expect(await refreshPatrons()).toBe(true);
    expect(currentPatrons()).toEqual([]);
    expect(patronsStatus()).toBe('ready');
  });
});

describe('缓存 · 秒开靠它，但坏缓存不能毒人', () => {
  it('拉到之后写进缓存；内存清掉还能从缓存恢复', async () => {
    setHttp(() => doc(GOOD));
    await refreshPatrons();
    expect(window.localStorage.getItem(PATRON_CACHE_KEY)).toBeTruthy();

    _resetPatronsForTests();
    expect(currentPatrons().length).toBe(3);
    expect(patronsStatus()).toBe('ready');
    expect(patronsFetchedAt()).toBeGreaterThan(0);
  });

  it('缓存是半截 JSON：当作没有，不抛错', () => {
    window.localStorage.setItem(PATRON_CACHE_KEY, '{"v":1,"at":');
    expect(() => currentPatrons()).not.toThrow();
    expect(currentPatrons()).toEqual([]);
    expect(patronsStatus()).toBe('idle');
  });

  it('缓存里全是坏条目：当作没有', () => {
    window.localStorage.setItem(
      PATRON_CACHE_KEY,
      JSON.stringify({ v: 1, at: Date.now(), list: [{ name: '' }] }),
    );
    expect(currentPatrons()).toEqual([]);
  });

  it('localStorage 写不进去（隐私模式）：照常返回新名单', async () => {
    const original = window.localStorage;
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as unknown as Storage;
    Object.defineProperty(window, 'localStorage', { value: broken, configurable: true });
    try {
      setHttp(() => doc(GOOD));
      expect(await refreshPatrons()).toBe(true);
      expect(currentPatrons().length).toBe(3);
    } finally {
      Object.defineProperty(window, 'localStorage', { value: original, configurable: true });
    }
  });
});

describe('节流与订阅', () => {
  it('60 秒内重复打开弹窗不重复发请求', async () => {
    setHttp(() => doc(GOOD));
    await refreshPatrons();
    const first = calls.length;
    await refreshPatrons();
    await refreshPatrons();
    expect(calls.length).toBe(first);
  });

  it('force 绕过节流（手动重试用）', async () => {
    setHttp(() => doc(GOOD));
    await refreshPatrons();
    const first = calls.length;
    await refreshPatrons({ force: true });
    expect(calls.length).toBe(first * 2);
  });

  it('名单变了通知订阅者；退订之后不再收到', async () => {
    setHttp(() => doc(GOOD));
    const seen: number[] = [];
    const off = onPatronsChange((list) => seen.push(list.length));

    await refreshPatrons();
    expect(seen).toEqual([3]);

    off();
    await refreshPatrons({ force: true });
    expect(seen).toEqual([3]);
  });
});
