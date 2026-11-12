/** 本地考古：从本机痕迹推出「最早使用日」，只产出日期，不产出任何路径。 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  EARLIEST_DAY,
  clampSince,
  dayFromName,
  earlierDay,
  probeSince,
  readSinceLocal,
  writeSinceLocal,
} from '../../src/core/usage/since';
import { setSettingsProvider } from '../../src/core/settings-provider';

const NOW = new Date(2026, 10, 12, 12, 0).getTime(); // 2026-11-12 12:00 本地时区
const TODAY = '2026-11-12';

function ms(day: string, hour = 12): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0).getTime();
}

/** 假 adapter：files 的键就是完整路径，值是 mtime；list 按目录前缀筛 */
function fakeApp(mtimes: Record<string, number>, opts: { failList?: boolean } = {}) {
  return {
    vault: {
      adapter: {
        list: async (dir: string) => {
          if (opts.failList) throw new Error('目录不存在');
          const prefix = `${String(dir || '').replace(/\/+$/, '')}/`;
          return { files: Object.keys(mtimes).filter((p) => p.startsWith(prefix)), folders: [] };
        },
        stat: async (p: string) => ({ mtime: mtimes[p] }),
      },
    },
  };
}

function settings(patch: { storagePath?: string; diaryDirectory?: string } = {}): void {
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', diaryDirectory: '', ...patch }) as never);
}

describe('usage · 最早使用日考古', () => {
  afterEach(() => {
    setSettingsProvider(() => ({}) as never);
  });

  it('数据目录里最早那个文件的日子（同步工具保留 mtime）', async () => {
    settings();
    const app = fakeApp({
      'CONFIG/STORAGE/memo.json': ms('2026-09-20'),
      'CONFIG/STORAGE/news.json': ms('2026-10-02'),
    });
    await expect(probeSince(app, NOW)).resolves.toEqual({ day: '2026-09-20', source: 'data' });
  });

  it('日记文件名比数据文件更早时用日记（内容自带日期，不受搬运影响）', async () => {
    settings({ diaryDirectory: '日记' });
    const app = fakeApp({
      '日记/2026-08-18.md': ms('2026-11-11'),
      '日记/2026-10-01.md': ms('2026-11-11'),
      'CONFIG/STORAGE/memo.json': ms('2026-09-20'),
    });
    await expect(probeSince(app, NOW)).resolves.toEqual({ day: '2026-08-18', source: 'diary' });
  });

  it('日记目录留空（跟随 Obsidian 日记位置）时只认数据目录，不瞎猜路径', async () => {
    settings({ diaryDirectory: '' });
    const app = fakeApp({ '日记/2026-08-18.md': ms('2026-11-11') });
    await expect(probeSince(app, NOW)).resolves.toEqual({ day: '', source: 'none' });
  });

  it('什么都没查到（新装）返回空，由服务端按 firstSeen 兜底', async () => {
    settings();
    await expect(probeSince(fakeApp({}), NOW)).resolves.toEqual({ day: '', source: 'none' });
  });

  it('目录列不出来 / 适配器不支持时静默返回空，不抛错', async () => {
    settings();
    await expect(probeSince(fakeApp({}, { failList: true }), NOW)).resolves.toEqual({ day: '', source: 'none' });
    await expect(probeSince({ vault: {} }, NOW)).resolves.toEqual({ day: '', source: 'none' });
  });

  it('从别处拷来的老文件不超过插件最早可能的日子', async () => {
    settings();
    const app = fakeApp({ 'CONFIG/STORAGE/memo.json': ms('2024-03-05') });
    await expect(probeSince(app, NOW)).resolves.toEqual({ day: EARLIEST_DAY, source: 'data' });
  });

  it('时钟漂移导致未来日期时夹到今天', async () => {
    settings();
    const app = fakeApp({ 'CONFIG/STORAGE/memo.json': ms('2027-01-01') });
    await expect(probeSince(app, NOW)).resolves.toEqual({ day: TODAY, source: 'data' });
  });

  it('单个文件 stat 失败不影响其它文件', async () => {
    settings();
    const base = fakeApp({
      'CONFIG/STORAGE/good.json': ms('2026-10-03'),
      'CONFIG/STORAGE/bad.json': 0,
    });
    base.vault.adapter.stat = async (p: string) => {
      if (p.endsWith('bad.json')) throw new Error('读不到');
      return { mtime: ms('2026-10-03') };
    };
    await expect(probeSince(base, NOW)).resolves.toEqual({ day: '2026-10-03', source: 'data' });
  });
});

describe('usage · 日期解析与夹取', () => {
  it('认 ISO 与中文两种日记文件名，其它文件名一律不认', () => {
    expect(dayFromName('日记/2026-08-18.md')).toBe('2026-08-18');
    expect(dayFromName('2026年8月18日.md')).toBe('2026-08-18');
    expect(dayFromName('2026年12月5日.md')).toBe('2026-12-05');
    expect(dayFromName('读书笔记.md')).toBe('');
    expect(dayFromName('2026-W45.md')).toBe('');
    expect(dayFromName('12-05.md')).toBe('');
  });

  it('夹取：太早按插件最早日子，太晚按今天，空串保持空', () => {
    expect(clampSince('2024-03-05', TODAY)).toBe(EARLIEST_DAY);
    expect(clampSince('2027-01-01', TODAY)).toBe(TODAY);
    expect(clampSince('', TODAY)).toBe('');
    expect(clampSince('2026-09-09', TODAY)).toBe('2026-09-09');
  });
});

describe('usage · 设备级起点（跨库共享）', () => {
  function stubLocalStorage(): Map<string, string> {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    } as Storage;
    return store;
  }

  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('只往早里走：两个库各算出不同起点时取更早那个', () => {
    expect(earlierDay('2026-08-31', '2026-11-09')).toBe('2026-08-31');
    expect(earlierDay('2026-11-09', '2026-08-31')).toBe('2026-08-31');
    expect(earlierDay('', '2026-11-09')).toBe('2026-11-09');
    expect(earlierDay('2026-11-09', '')).toBe('2026-11-09');
    expect(earlierDay('', '')).toBe('');
  });

  it('写进去的日子跨库读得回来', () => {
    stubLocalStorage();
    expect(readSinceLocal()).toBe('');
    writeSinceLocal('2026-08-31');
    expect(readSinceLocal()).toBe('2026-08-31');
  });

  it('脏值不写、读出来也不认（只认 YYYY-MM-DD）', () => {
    const store = stubLocalStorage();
    writeSinceLocal('8月31日');
    writeSinceLocal('');
    expect([...store.values()]).toEqual([]);
    store.set('bz.usage.sinceDay', '../etc/passwd');
    expect(readSinceLocal()).toBe('');
    store.set('bz.usage.sinceDay', '2026-13-45');
    expect(readSinceLocal()).toBe('2026-13-45'); // 只挡形态，不挡具体日子：越界由 clampSince 管
  });

  it('没有 localStorage 的宿主不炸，退回空串', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(readSinceLocal()).toBe('');
    expect(() => writeSinceLocal('2026-08-31')).not.toThrow();
  });
});
