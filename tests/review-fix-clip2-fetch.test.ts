// @vitest-environment node
/**
 * 剪藏本抓取侧 review 修复回归（review-clipbook-bugs.md C2/C3/C23/C24/C26）：
 * - C2：抓取写只声明本轮 newArticles + 窗口裁剪 removeArticleKeys——抓取窗口期内的
 *   并发用户写（标读/删除）不被旧快照回退/复活（writeNewsDataMerged 磁盘并集保留未声明条目）；
 * - C3：四源列表级请求失败传导 failedSources（知乎/果壳列表失败上抛；B站/RSS 全量请求失败
 *   走 requestFailed 标志），allFailed 检测激活——全失败轮不推进 lastFetchAt；
 * - C23：Promise.race 超时胜出后迟到的 requestUrl rejection 不产生 unhandled rejection
 *   （requestUrlHttpGet + fetchRssFeedTitle 同构兜底）；
 * - C24：readNewsData 区分「读抛错（瞬时 IO，可重试，corrupt:false）」与「JSON 损坏态（corrupt:true）」；
 * - C26：bilibiliUpInfo / rssFeeds 按条补丁（patchBilibiliUpInfo/patchRssFeedTitles）——
 *   窗口期内被移除的 UP 资料/订阅源不被旧快照整段声明复活，窗口期新增不被回退。
 * mock 参照 tests/clipbook/news-fetcher.test.ts（obsidian 模块已被 vitest alias 替换）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks, requestUrl } from './mock-obsidian-entry';
import { MockVault, mockAppWithVault } from './mock-vault';
import { setApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { getNewsFilePath, readNewsData, writeNewsDataMerged } from '../src/clipbook/news-data';
import {
  runNewsFetchRound, defaultFetchStore, fetchZhihu, fetchGuokr, fetchBilibiliUp, fetchRss,
  requestUrlHttpGet, FETCH_TIMEOUT_MS, type FetchStoreDeps, type HttpGet,
} from '../src/clipbook/news-fetcher';
import { fetchRssFeedTitle } from '../src/clipbook/news-sources-group';

beforeEach(() => {
  resetObsidianMocks();
  setApp(mockAppWithVault(new MockVault()));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
});

function seedVault(vault: MockVault, data: Record<string, unknown>): void {
  vault.files.set(getNewsFilePath(), JSON.stringify({ articles: [], bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: 'ck', sources: { zhihu: true, guokr: true, bilibili: true, rss: true }, rssFeeds: [], ...data }));
}

const disk = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

/** 写盘侧用户并发写模拟：直接改 news.json（任何写方最终都落到这里） */
function rewriteDisk(vault: MockVault, mutate: (d: any) => void): void {
  const d = disk(vault);
  mutate(d);
  vault.files.set(getNewsFilePath(), JSON.stringify(d));
}

const NOW = new Date(2026, 8, 13, 12, 0, 0).getTime();

/** B站动态条目（UP甲 / 指定 bvid） */
const biliAv = (bvid: string, pubTsSec: number) => ({
  type: 'DYNAMIC_TYPE_AV',
  modules: {
    module_author: { name: 'UP甲', pub_ts: pubTsSec, face: 'https://i0.hdslb.com/f.jpg' },
    module_dynamic: { major: { archive: { bvid, title: `视频${bvid}`, desc: '简介', cover: 'https://img/c.jpg' } }, module_desc: { desc: '' } },
  },
});

// ---------- C2：抓取窗口期内的并发用户写不被旧快照回退/复活 ----------

describe('C2 抓取写声明收窄（runNewsFetchRound + defaultFetchStore）', () => {
  it('窗口期用户标读不回退、用户删除不复活、B站窗口裁剪仍生效、新增照常入库', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, {
      sources: { zhihu: false, guokr: false, bilibili: true, rss: false },
      bilibiliUps: ['1001'],
      articles: [
        // B站窗口裁剪对象（窗口外老条目）
        { platform: 'B站', author: 'UP甲', url: 'https://www.bilibili.com/video/BVold', date: '2026-09-01 00:00:00' },
        // 抓取窗口期内被用户标读（快照里仍是未读版）
        { platform: '知乎日报', title: '窗口期被标读', url: 'https://daily.zhihu.com/story/1' },
        // 抓取窗口期内被用户删除
        { platform: '知乎日报', title: '窗口期被删除', url: 'https://daily.zhihu.com/story/2' },
      ],
    });
    const realStore = defaultFetchStore();
    const stale = await realStore.read(); // 抓取轮开始：读旧快照
    expect(stale).toBeTruthy();

    // —— 抓取窗口期内，用户并发写盘：标读一篇 + 删除一篇 ——
    rewriteDisk(vault, (d) => {
      d.articles = d.articles.filter((a: any) => a.url !== 'https://daily.zhihu.com/story/2');
      const s1 = d.articles.find((a: any) => a.url === 'https://daily.zhihu.com/story/1');
      s1.read = true;
    });

    // 旧快照进 read，真实磁盘进 write（复刻抓取轮读写窗口）
    const store: FetchStoreDeps = { read: async () => stale!, write: realStore.write };
    const httpGet: HttpGet = async (url) => {
      if (url.includes('feed/space')) {
        return JSON.stringify({ code: 0, data: { items: [biliAv('BVnew', Math.floor(NOW / 1000) - 3600)], has_more: false, offset: '' } });
      }
      return null;
    };
    const r = await runNewsFetchRound({ httpGet, store, now: () => NOW });
    expect(r.added).toBe(1);
    expect(r.prunedBilibili).toBe(1);

    const d = disk(vault);
    const urls = d.articles.map((a: any) => a.url);
    expect(urls).toContain('https://www.bilibili.com/video/BVnew'); // 新增入库
    expect(urls).not.toContain('https://www.bilibili.com/video/BVold'); // 窗口裁剪仍生效（removeArticleKeys）
    expect(urls).not.toContain('https://daily.zhihu.com/story/2'); // C2：用户删除不复活
    expect(d.articles.find((a: any) => a.url === 'https://daily.zhihu.com/story/1').read).toBe(true); // C2：用户标读不回退
    expect(d.lastFetchAt).toBe(NOW); // 非全失败轮锚点照常推进
  });

  it('无新增无裁剪轮：磁盘存量不被声明覆盖（合并写按磁盘保留）', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, {
      sources: { zhihu: false, guokr: false, bilibili: false, rss: false },
      articles: [{ platform: '知乎日报', title: '存量文', url: 'https://daily.zhihu.com/story/9', read: true }],
      lastFetchAt: 1000,
    });
    const realStore = defaultFetchStore();
    const stale = await realStore.read();
    const store: FetchStoreDeps = { read: async () => stale!, write: realStore.write };
    const r = await runNewsFetchRound({ httpGet: async () => null, store, now: () => NOW });
    expect(r.added).toBe(0);
    const d = disk(vault);
    expect(d.articles).toHaveLength(1); // 存量不被清掉
    expect(d.articles[0].read).toBe(true);
    expect(d.lastFetchAt).toBe(NOW);
  });
});

// ---------- C3：列表级请求失败传导 failedSources，allFailed 检测激活 ----------

describe('C3 列表级失败传导（failedSources / lastFetchAt）', () => {
  it('四源全失败：failedSources 全记 + lastFetchAt 不推进（下次打开即重试）', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, {
      bilibiliUps: ['1001'],
      bilibiliCookie: 'ck',
      rssFeeds: [{ url: 'https://x.example/rss.xml' }],
    });
    const r = await runNewsFetchRound({ httpGet: async () => null, store: defaultFetchStore(), now: () => NOW });
    expect(r.failedSources).toHaveLength(4);
    expect(r.failedSources).toEqual(expect.arrayContaining(['知乎日报', '果壳科学人', 'B站', 'RSS']));
    expect(r.added).toBe(0);
    expect(disk(vault).lastFetchAt).toBe(0); // allFailed 生效：锚点不动
  });

  it('部分失败（B站全 UP 请求失败、RSS 正常）：failedSources 只记 B站 + 锚点照常推进', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, {
      sources: { zhihu: false, guokr: false, bilibili: true, rss: true },
      bilibiliUps: ['1001'],
      bilibiliCookie: 'ck',
      rssFeeds: [{ url: 'https://y.example/rss.xml' }],
    });
    const httpGet: HttpGet = async (url) => {
      if (url.includes('feed/space')) return null; // B站列表请求失败
      if (url.endsWith('.xml')) return '<rss><channel><title>测试源</title><item><title>FOO</title><link>https://y.example/1</link></item></channel></rss>';
      return null;
    };
    const r = await runNewsFetchRound({ httpGet, store: defaultFetchStore(), now: () => NOW });
    expect(r.failedSources).toEqual(['B站']);
    expect(r.added).toBe(1);
    expect(disk(vault).lastFetchAt).toBe(NOW); // 非全失败：锚点照常推进
  });

  it('单元：fetchZhihu / fetchGuokr 列表请求 null 与解析失败上抛（guarded 计失败源）', async () => {
    await expect(fetchZhihu(async () => null)).rejects.toThrow('知乎日报列表请求失败');
    await expect(fetchZhihu(async () => 'not-json')).rejects.toThrow('知乎日报列表解析失败');
    await expect(fetchGuokr(async () => null)).rejects.toThrow('果壳科学人列表请求失败');
    await expect(fetchGuokr(async () => 'not-json')).rejects.toThrow('果壳科学人列表解析失败');
  });

  it('单元：fetchBilibiliUp 区分 requestFailed（请求 null）与 rejected（风控 code 非 0）', async () => {
    const netFail = await fetchBilibiliUp('1001', 'ck', 10, async () => null);
    expect(netFail.requestFailed).toBe(true);
    expect(netFail.rejected).toBe(false);
    const rejected = await fetchBilibiliUp('1001', 'ck', 10, async () => JSON.stringify({ code: -352, message: '风控' }));
    expect(rejected.requestFailed).toBe(false);
    expect(rejected.rejected).toBe(true);
    const okEmpty = await fetchBilibiliUp('1001', 'ck', 10, async () => JSON.stringify({ code: 0, data: { items: [], has_more: false, offset: '' } }));
    expect(okEmpty.requestFailed).toBe(false); // 正常空动态 ≠ 请求失败
  });

  it('单元：fetchRss 全 feed 请求失败 → requestFailed；部分失败/解析失败不标', async () => {
    const allFail = await fetchRss([{ url: 'https://a.example/rss.xml' }, { url: 'https://b.example/rss.xml' }], async () => null);
    expect(allFail.requestFailed).toBe(true);
    const partial = await fetchRss([{ url: 'https://a.example/rss.xml' }, { url: 'https://b.example/rss.xml' }], async (url) =>
      url.includes('a.') ? '<rss><channel><title>A</title></channel></rss>' : null);
    expect(partial.requestFailed).toBe(false);
    const parseFail = await fetchRss([{ url: 'https://a.example/rss.xml' }], async () => '<html>非 feed 结构（服务端可达）</html>');
    expect(parseFail.requestFailed).toBe(false); // 请求成功仅解析失败：不算列表请求失败
  });
});

// ---------- C23：Promise.race 超时胜出后迟到 rejection 不产生 unhandled rejection ----------

describe('C23 超时竞速兜底（requestUrlHttpGet / fetchRssFeedTitle）', () => {
  /** 公共断言体：requestUrl 返回迟到 reject 的 promise → 超时先胜出 → 迟到 rejection 无 unhandled 噪音 */
  async function assertLateRejectionSilent(call: (url: string) => Promise<unknown>, timeoutMs: number): Promise<void> {
    vi.useFakeTimers();
    let lateReject: (e: Error) => void = () => {};
    (requestUrl as any).mockImplementationOnce(
      () => new Promise((_res, rej) => { lateReject = rej; })
    );
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => { unhandled.push(e); };
    process.on('unhandledRejection', onUnhandled);
    try {
      const p = call('https://slow.example/api');
      await vi.advanceTimersByTimeAsync(timeoutMs); // 超时先胜出
      expect(await p).toBeNull();
      lateReject(new Error('迟到的网络错误'));
      for (let i = 0; i < 10; i++) await Promise.resolve(); // 冲刷微任务，让 unhandled 检查有机会触发
      vi.useRealTimers();
      await new Promise((r) => setTimeout(r, 0));
      expect(unhandled).toEqual([]); // 兜底 catch 在位：无 unhandled rejection
    } finally {
      process.off('unhandledRejection', onUnhandled);
      vi.useRealTimers();
    }
  }

  it('requestUrlHttpGet：超时返回 null，迟到 rejection 无 unhandled rejection', async () => {
    await assertLateRejectionSilent((url) => requestUrlHttpGet()(url), FETCH_TIMEOUT_MS);
  });

  it('fetchRssFeedTitle：超时返回 null，迟到 rejection 无 unhandled rejection', async () => {
    await assertLateRejectionSilent((url) => fetchRssFeedTitle(url), 10000);
  });
});

// ---------- C24：readNewsData 区分读抛错（瞬时 IO）与 JSON 损坏态 ----------

describe('C24 readNewsData 错误态分流', () => {
  it('JSON 损坏：ok:false + corrupt:true，文件原样保留（不清盘）', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    const broken = '{ "articles": [broken json';
    vault.files.set(getNewsFilePath(), broken);
    const res = await readNewsData();
    expect(res.ok).toBe(false);
    expect(res.corrupt).toBe(true);
    expect(vault.files.get(getNewsFilePath())).toBe(broken); // 原文件原样保留
  });

  it('读抛错（Syncthing 占用等瞬时 IO）：ok:false + corrupt:false（可重试，非损坏）', async () => {
    const vault = new MockVault();
    vault.files.set(getNewsFilePath(), JSON.stringify({ articles: [] }));
    const app = mockAppWithVault(vault);
    const origRead = vault.read.bind(vault);
    vault.read = async (f: any) => {
      if (f && f.path === getNewsFilePath()) throw new Error('EACCES: Syncthing 同步占用');
      return origRead(f);
    };
    setApp(app);
    const res = await readNewsData();
    expect(res.ok).toBe(false);
    expect(res.corrupt).toBe(false); // C24：不再与损坏态混归
  });

  it('正常读取：ok:true + corrupt:false', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, { articles: [{ platform: '知乎日报', title: '文', url: 'https://z/1' }] });
    const res = await readNewsData();
    expect(res.ok).toBe(true);
    expect(res.corrupt).toBe(false);
    expect(res.data.articles).toHaveLength(1);
  });
});

// ---------- C26：bilibiliUpInfo / rssFeeds 按条补丁，不用旧快照拼整段声明 ----------

describe('C26 按条补丁写（writeNewsDataMerged / runNewsFetchRound）', () => {
  it('数据层：patchBilibiliUpInfo 与磁盘现值按键合并；patchRssFeedTitles 只改对应条目，url 不在磁盘不新增', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, {
      articles: [{ platform: '知乎日报', title: '存量文', url: 'https://z/1' }],
      bilibiliUpInfo: { a: { name: 'A旧名' } },
      rssFeeds: [{ url: 'https://x.example/rss' }, { url: 'https://y.example/rss', title: 'Y' }],
    });
    await writeNewsDataMerged({
      set: {},
      patchBilibiliUpInfo: { b: { name: 'B新名' } },
      patchRssFeedTitles: { 'https://x.example/rss': 'X标题', 'https://z.example/rss': 'Z幽灵' },
    });
    const d = disk(vault);
    expect(d.bilibiliUpInfo).toEqual({ a: { name: 'A旧名' }, b: { name: 'B新名' } });
    expect(d.rssFeeds).toEqual([
      { url: 'https://x.example/rss', title: 'X标题' },
      { url: 'https://y.example/rss', title: 'Y' }, // 未补丁条目原样保留
    ]); // 磁盘没有的 url（Z幽灵）不被补丁进列表（防复活）
    expect(d.articles).toHaveLength(1); // articles 段未声明不动
  });

  it('集成：窗口期内被移除的 UP 资料 / 订阅源不复活，窗口期新增订阅源不丢', async () => {
    const vault = new MockVault();
    setApp(mockAppWithVault(vault));
    seedVault(vault, {
      sources: { zhihu: false, guokr: false, bilibili: true, rss: true },
      bilibiliUps: ['1001', '9999'],
      bilibiliUpInfo: { '9999': { name: '孤儿UP' } }, // 本轮抓不到资料的 UP（动态为空）
      rssFeeds: [{ url: 'https://f1.example/rss.xml' }, { url: 'https://f2.example/rss.xml' }],
    });
    const realStore = defaultFetchStore();
    const stale = await realStore.read(); // 抓取轮开始：读旧快照
    expect(stale).toBeTruthy();

    // —— 抓取窗口期内，用户并发写盘：移除 UP 9999、移除 f2、新增 f3 ——
    rewriteDisk(vault, (d) => {
      d.bilibiliUps = d.bilibiliUps.filter((u: string) => u !== '9999');
      delete d.bilibiliUpInfo['9999'];
      d.rssFeeds = [
        { url: 'https://f1.example/rss.xml' },
        { url: 'https://f3.example/rss.xml', title: 'F3新增' },
      ];
    });

    const store: FetchStoreDeps = { read: async () => stale!, write: realStore.write };
    const httpGet: HttpGet = async (url) => {
      if (url.includes('host_mid=1001')) {
        return JSON.stringify({ code: 0, data: { items: [biliAv('BVu1', Math.floor(NOW / 1000) - 3600)], has_more: false, offset: '' } });
      }
      if (url.includes('host_mid=9999')) {
        return JSON.stringify({ code: 0, data: { items: [], has_more: false, offset: '' } }); // 本轮无资料产出
      }
      if (url.includes('f1.example')) {
        return '<rss><channel><title>T1源</title><item><title>文章甲</title><link>https://f1.example/1</link></item></channel></rss>';
      }
      return null; // f2 请求失败（部分失败，源仍可用）
    };
    const r = await runNewsFetchRound({ httpGet, store, now: () => NOW });
    expect(r.failedSources).toEqual([]); // f2 单 feed 失败不升级为源级失败
    expect(r.added).toBe(2); // B站 1 + RSS 1

    const d = disk(vault);
    // C26：UP 资料按条补丁——本轮没抓到资料的 9999 不被旧快照整段复活（旧实现 {...旧快照, ...本轮} 会复活）
    expect(d.bilibiliUpInfo).toEqual({ '1001': { name: 'UP甲', avatar: 'https://i0.hdslb.com/f.jpg' } });
    expect(d.bilibiliUps).toEqual(['1001']); // 名单段未声明不动
    // C26：RSS 标题按条补丁——被移除的 f2 不复活，窗口期新增的 f3 不被旧快照整段声明挤掉
    expect(d.rssFeeds).toEqual([
      { url: 'https://f1.example/rss.xml', title: 'T1源' },
      { url: 'https://f3.example/rss.xml', title: 'F3新增' },
    ]);
    const urls = d.articles.map((a: any) => a.url);
    expect(urls).toContain('https://www.bilibili.com/video/BVu1');
    expect(urls).toContain('https://f1.example/1');
  });
});
