// @vitest-environment node
// @vitest-environment jsdom
/**
 * 豆瓣影视名称索引资产层测试（issue 498 / ADR-0210）——core/douban-name-index.ts：
 * validateDoubanNameIndex 合法/畸形矩阵（定长数组行、ID 唯一、total 一致）、
 * load/download 走统一清单（未登记抛错 / 匹配落盘 + 写缓存 / 本地就绪不联网）、
 * 查询纯函数（searchDoubanNameIndex 前缀优先/归一匹配/limit、indexKindCounts）。
 * sha256 与构建脚本同口径（normalizeEol 后取值），与 rss-catalog.test 同款 mock。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { MockVault } from '../mock-vault';
import { textSha256 } from '../../src/core/sha256';
import {
  DOUBAN_NAME_INDEX_FILE,
  DOUBAN_NAME_INDEX_MANIFEST_ID,
  downloadDoubanNameIndex,
  indexKindCounts,
  loadDoubanNameIndex,
  resetDoubanNameIndexCache,
  searchDoubanNameIndex,
  validateDoubanNameIndex,
  type DoubanNameIndex,
} from '../../src/core/douban-name-index';

const appOf = (vault: MockVault) => ({ vault }) as any;

/** 小索引（单元断言用，不引 8.5 万条真源）。raw 形 = 产物原形（rows 定长数组） */
function smallIndexRaw(): Record<string, unknown> {
  return {
    version: 1,
    updatedAt: '2026-09-27',
    stats: { total: 5, kinds: [['电影', 3], ['电视剧', 2]] },
    rows: [
      ['肖申克的救赎', '1994', '9.7', '电影', '1292052'],
      ['三体', '2023', '8.7', '电视剧', '26647087'],
      ['三体', '2011', '8.9', '电视剧', '5351484'],
      ['流浪地球2', '2023', '8.3', '电影', '4920399'],
      ['教父', '1972', '', '电影', '1295038'],
    ],
  };
}

/** requestUrl 桩：按 URL 分发到统一清单 / 索引数据文本 */
function routeFetch(manifestText: string | null, dataText: string): void {
  vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
    let body: string | null = null;
    if (req.url.includes('manifest.json')) body = manifestText;
    else if (req.url.includes(DOUBAN_NAME_INDEX_FILE)) body = dataText;
    if (body === null) throw new Error('unmocked url: ' + req.url);
    return { status: 200, text: body } as any;
  }) as any);
}

function manifestTextFor(sha256: string): string {
  return JSON.stringify({
    version: 1,
    docs: [{ id: DOUBAN_NAME_INDEX_MANIFEST_ID, name: '豆瓣影视索引', file: DOUBAN_NAME_INDEX_FILE, sha256 }],
    skins: [],
  });
}

beforeEach(() => {
  resetObsidianMocks();
  resetDoubanNameIndexCache();
  clearDomainEvents();
  vi.mocked(requestUrl).mockReset();
});

describe('validateDoubanNameIndex', () => {
  it('合法索引 → 非 null 且行结构还原', () => {
    const idx = validateDoubanNameIndex(smallIndexRaw());
    expect(idx).not.toBeNull();
    expect(idx!.rows).toHaveLength(5);
    expect(idx!.rows[0]).toEqual({ n: '肖申克的救赎', y: '1994', s: '9.7', k: '电影', id: '1292052' });
    expect(idx!.stats.kinds).toEqual([['电影', 3], ['电视剧', 2]]);
  });
  it('行数与 stats.total 不一致 → null', () => {
    const raw = smallIndexRaw() as Record<string, unknown>;
    const stats = { ...(raw.stats as Record<string, unknown>), total: 4 };
    expect(validateDoubanNameIndex({ ...raw, stats })).toBeNull();
  });
  it('ID 重复 → null', () => {
    const raw = smallIndexRaw();
    (raw.rows as unknown[][])[1][4] = '1292052';
    expect(validateDoubanNameIndex(raw)).toBeNull();
  });
  it('行不是 5 列 / 列非字符串 → null', () => {
    expect(validateDoubanNameIndex({ ...smallIndexRaw(), rows: [['名', '2023', '8.7', '电影']] })).toBeNull();
    expect(validateDoubanNameIndex({ ...smallIndexRaw(), rows: [['名', '2023', '8.7', '电影', 123]] })).toBeNull();
  });
  it('version/updatedAt/stats 形状坏了 → null', () => {
    expect(validateDoubanNameIndex({ ...smallIndexRaw(), version: '1' })).toBeNull();
    expect(validateDoubanNameIndex({ ...smallIndexRaw(), updatedAt: '' })).toBeNull();
    expect(validateDoubanNameIndex({ ...smallIndexRaw(), stats: { total: 5 } })).toBeNull();
    expect(validateDoubanNameIndex(null)).toBeNull();
  });
});

describe('loadDoubanNameIndex / downloadDoubanNameIndex', () => {
  it('未登记清单 → download 抛错', async () => {
    const vault = new MockVault();
    routeFetch(JSON.stringify({ version: 1, docs: [], skins: [] }), '');
    await expect(downloadDoubanNameIndex(appOf(vault))).rejects.toThrow('尚未登记到下载清单');
  });
  it('下载：sha 匹配 → 落盘 + 写缓存；本地已就绪时 load 不联网', async () => {
    const idx = smallIndexRaw();
    const dataText = JSON.stringify(idx);
    const sha = textSha256(dataText);
    const vault = new MockVault();
    routeFetch(manifestTextFor(sha), dataText);
    const got = await downloadDoubanNameIndex(appOf(vault));
    expect(got.rows).toHaveLength(5);
    expect(vault.files.has(`.obsidian/plugins/bz/downloads/${DOUBAN_NAME_INDEX_FILE}`)).toBe(true);

    // 缓存生效：load 不再读盘也不联网（清掉桩，请求即炸）
    vi.mocked(requestUrl).mockImplementation((async () => {
      throw new Error('不应联网');
    }) as any);
    const again = await loadDoubanNameIndex(appOf(vault));
    expect(again?.rows).toHaveLength(5);
  });
  it('本地就绪：load 直读落盘文件（无需联网）', async () => {
    const idx = smallIndexRaw();
    const vault = new MockVault();
    vault.files.set(`.obsidian/plugins/bz/downloads/${DOUBAN_NAME_INDEX_FILE}`, JSON.stringify(idx));
    vi.mocked(requestUrl).mockImplementation((async () => {
      throw new Error('不应联网');
    }) as any);
    const got = await loadDoubanNameIndex(appOf(vault));
    expect(got?.stats.total).toBe(5);
  });
  it('落盘事件失效缓存：重新下载后 load 读到新内容（issue 495 复检 P1-1 同款守卫）', async () => {
    const vault = new MockVault();
    const v1 = smallIndexRaw();
    const v2 = JSON.parse(JSON.stringify(v1));
    (v2.rows as unknown[][]).push(['新片', '2026', '8.0', '电影', '9999999']);
    v2.stats.total = 6;

    // 第一版下载落盘 + 热缓存
    routeFetch(manifestTextFor(textSha256(JSON.stringify(v1))), JSON.stringify(v1));
    await downloadDoubanNameIndex(appOf(vault));
    expect((await loadDoubanNameIndex(appOf(vault)))!.rows).toHaveLength(5);

    // 第二版直接写盘 + 派发落盘事件 → 缓存必须失效，load 重读到新内容
    vault.files.set(`.obsidian/plugins/bz/downloads/${DOUBAN_NAME_INDEX_FILE}`, JSON.stringify(v2));
    emitDomainEvent('downloads:asset-changed', { fileName: DOUBAN_NAME_INDEX_FILE });
    const fresh = await loadDoubanNameIndex(appOf(vault));
    expect(fresh!.rows).toHaveLength(6);
  });

  it('本地文件被改坏 → load 返回 null（功能静默缺席，不报错）', async () => {
    const vault = new MockVault();
    vault.files.set(`.obsidian/plugins/bz/downloads/${DOUBAN_NAME_INDEX_FILE}`, '{"rows":[');
    expect(await loadDoubanNameIndex(appOf(vault))).toBeNull();
  });
});

describe('searchDoubanNameIndex', () => {
  const idx = validateDoubanNameIndex(smallIndexRaw())!;
  it('前缀命中优先于包含命中', () => {
    const hits = searchDoubanNameIndex(idx, '三体', 10);
    expect(hits[0].n).toBe('三体');
    expect(hits).toHaveLength(2);
  });
  it('包含命中：归一后匹配（大小写/数字混排无碍）', () => {
    const hits = searchDoubanNameIndex(idx, '流浪', 10);
    expect(hits.map((r) => r.n)).toContain('流浪地球2');
  });
  it('归一：空白与括号不影响命中', () => {
    expect(searchDoubanNameIndex(idx, '肖申克 的救赎', 10).map((r) => r.id)).toContain('1292052');
    expect(searchDoubanNameIndex(idx, '  三体 ', 10).map((r) => r.id)).toHaveLength(2);
  });
  it('同档按评分降序、空评分殿后；limit 截断', () => {
    const hits = searchDoubanNameIndex(idx, '', 10);
    expect(hits).toHaveLength(0); // 空查询不开壳
    const two = searchDoubanNameIndex(idx, '体', 1);
    expect(two).toHaveLength(1);
    expect(two[0].s).toBe('8.9'); // 三体 2011(8.9) > 三体 2023(8.7)，同档评分排序
  });
  it('无命中 → 空数组', () => {
    expect(searchDoubanNameIndex(idx, '不存在片名', 10)).toHaveLength(0);
  });
});

describe('indexKindCounts', () => {
  it('按出版期顺序与数值返回', () => {
    const counts = indexKindCounts(validateDoubanNameIndex(smallIndexRaw())!);
    expect(counts).toEqual([{ k: '电影', count: 3 }, { k: '电视剧', count: 2 }]);
  });
});
