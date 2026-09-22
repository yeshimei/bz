// @vitest-environment node
/**
 * clipbook 批 B 修复回归（数据写链·抓取·扫描·锚定）：
 * - CB2  writeNewsData 写失败透传（不再静默假成功）；
 * - CB3  flowMarkAllRead/flowUndoHandled stats 子桶守卫 + 批量已读撤销双还原（flowUndoMarkAllRead）；
 * - 新-9 flowMarkAllRead 返回实际 bumped 数（竞态不虚报）；
 * - CB12 executeFetchRound 补 catch（手动轮人话 notice、自动轮静默）；
 * - 新-1 B站风控通知文案（不再指向已移除的 Cookie 设置）；
 * - 新-2 anchor 同词双锚定不产出嵌套双链；
 * - 新-8 resolveUidFromInput 走 core/http 单源 + 网络失败/无法识别分型；
 * - 效率#2 scanClipDirectory 被拒诊断（rejected/rejectedPaths，数组附加属性非破坏）；
 * - 效率#3 抓取完成通知挂「去剪藏本」action。
 * 纯数据层 node 环境；core/notice mock 成 spy（断言文案/动作参数，不触 DOM）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
// notice/notify 打桩：本文件断言通知文案与 action 参数；保留真实导出供其余依赖方
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return { ...actual, notice: vi.fn(), notify: vi.fn() };
});
import { resetObsidianMocks, requestUrl } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getNewsFilePath, readNewsData, writeNewsData, resolveUidFromInputDetailed } from '../../src/clipbook/news-data';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { flowMarkAllRead, flowUndoHandled, flowUndoMarkAllRead } from '../../src/clipbook/flow';
import { applyBodyTransforms, applyClipContentTransforms } from '../../src/clipbook/anchor';
import { scanClipDirectory } from '../../src/clipbook/scan';
import { fetchNowNews, maybeFetchNews, notifyManualFetchResult, type FetchStoreDeps, type FetchDiskState } from '../../src/clipbook/news-fetcher';
import type { NewsWriteIntent } from '../../src/clipbook/news-data';

const { notice, notify } = await import('../../src/core/notice');
const noticeMock = vi.mocked(notice);
const notifyMock = vi.mocked(notify);

beforeEach(() => {
  resetObsidianMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  noticeMock.mockClear();
  notifyMock.mockClear();
  vi.mocked(requestUrl).mockClear();
});

function seedDisk(articles: any[], stats?: any): MockVault {
  const vault = new MockVault();
  vault.files.set(
    getNewsFilePath(),
    JSON.stringify({
      articles,
      stats: stats || { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [],
      bilibiliUpInfo: {},
      bilibiliMaxItems: 10,
      bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true },
    })
  );
  setApp(mockAppWithVault(vault));
  return vault;
}

const diskJson = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

// ---------- 条目1（CB2）：writeNewsData 写失败透传 ----------

describe('CB2 writeNewsData 写失败透传', () => {
  it('vault.modify 抛错 → writeNewsData reject，磁盘不被假成功覆盖', async () => {
    const vault = seedDisk([{ platform: '果壳科学人', title: '甲', url: 'https://gk.com/1' }]);
    const before = vault.files.get(getNewsFilePath());
    vi.spyOn(vault, 'modify').mockRejectedValue(new Error('disk full'));
    await expect(writeNewsData({ articles: [], stats: { totalRead: 9, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} }, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', sources: { zhihu: true, guokr: true, bilibili: true, rss: true }, rssFeeds: [], lastFetchAt: 0, fetchIntervalMin: 30 }))
      .rejects.toThrow('disk full');
    expect(vault.files.get(getNewsFilePath())).toBe(before); // 原文件未被静默替换
  });

  it('上游合并写链路（enqueueNewsWrite + writeNewsDataMerged）同样 reject 不假成功', async () => {
    const vault = seedDisk([{ platform: '果壳科学人', title: '甲', url: 'https://gk.com/1' }]);
    vi.spyOn(vault, 'modify').mockRejectedValue(new Error('disk full'));
    const { writeNewsDataMerged } = await import('../../src/clipbook/news-data');
    const { enqueueNewsWrite } = await import('../../src/clipbook/write-queue');
    await expect(enqueueNewsWrite(() => writeNewsDataMerged({ set: { bilibiliMaxItems: 20 } })))
      .rejects.toThrow('disk full');
    const res = await readNewsData();
    expect(res.ok).toBe(true);
    expect(res.data.bilibiliMaxItems).not.toBe(20); // 未落盘（无假成功）
  });
});

// ---------- 条目2+3（CB3/新-9）：批量已读快照·撤销·桶守卫·实际 bumped ----------

describe('flowMarkAllRead 返回实际 bumped + 动作前快照（新-9/批量撤销兜底）', () => {
  it('返回实际标读数（已读条目不重复计）与受影响条目动作前快照（盘上升序）', async () => {
    const vault = seedDisk([
      { platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', body: 'b1', date: '2026-09-01 08:00:00' },
      { platform: '知乎日报', title: '乙', url: 'https://zh.com/2', body: 'b2', date: '2026-09-01 09:00:00' },
      { platform: '知乎日报', title: '已读丙', url: 'https://zh.com/3', read: true, state: 'skipped', date: '2026-09-01 10:00:00' },
    ]);
    const raws = diskJson(vault).articles; // 三条全传（含已读丙）
    const r = await flowMarkAllRead(raws);
    expect(r.bumped).toBe(2); // 已读丙不被重复计（新-9：通知不虚报）
    expect(r.snapshot).toHaveLength(2);
    expect(r.snapshot.map((s: any) => s.url)).toEqual(['https://gk.com/1', 'https://zh.com/2']);
    expect(r.snapshot[0].read).toBeUndefined(); // 快照是动作前态
  });

  it('批量已读 → flowUndoMarkAllRead 撤销：条目态与 stats 双还原', async () => {
    const vault = seedDisk([
      { platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', body: 'b1', date: '2026-09-01 08:00:00' },
      { platform: '知乎日报', title: '乙', url: 'https://zh.com/2', body: 'b2', date: '2026-09-01 09:00:00' },
    ]);
    const { bumped, snapshot } = await flowMarkAllRead(diskJson(vault).articles);
    await drainNewsWritesForTests();
    expect(bumped).toBe(2);
    let disk = diskJson(vault);
    expect(disk.stats.totalRead).toBe(2);
    expect(disk.stats.totalSkipped).toBe(2);
    expect(disk.articles.every((a: any) => a.read === true)).toBe(true);
    // 撤销（重复撤销不二次回退统计）
    await flowUndoMarkAllRead(snapshot);
    await drainNewsWritesForTests();
    await flowUndoMarkAllRead(snapshot);
    await drainNewsWritesForTests();
    disk = diskJson(vault);
    expect(disk.articles[0]).toEqual({ platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', body: 'b1', date: '2026-09-01 08:00:00' });
    expect(disk.articles[1].read).toBeUndefined();
    expect(disk.stats.totalRead).toBe(0);
    expect(disk.stats.totalSkipped).toBe(0);
    expect(disk.stats.byPlatform['果壳科学人']).toBe(0);
  });

  it('stats 缺 byPlatform/byDate 子段：批量标读与单篇撤销都不抛（CB3 桶守卫）', async () => {
    const vault = seedDisk(
      [
        { platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', body: 'b1', date: '2026-09-01 08:00:00' },
      ],
      { totalRead: 0, totalSaved: 0, totalSkipped: 0 }, // 无 byPlatform/byDate（旧数据/手改盘形态）
    );
    const r = await flowMarkAllRead(diskJson(vault).articles);
    await drainNewsWritesForTests();
    expect(r.bumped).toBe(1);
    const disk = diskJson(vault);
    expect(disk.stats.byPlatform['果壳科学人']).toBe(1); // 守卫补建桶后照常计
    // 单篇撤销（flowUndoHandled）缺桶同样不抛
    await flowUndoHandled(r.snapshot[0]);
    await drainNewsWritesForTests();
    expect(diskJson(vault).stats.totalRead).toBe(0);
  });

  it('空列表 / 全部已读：bumped=0、快照空', async () => {
    const vault = seedDisk([{ platform: '果壳科学人', title: '甲', url: 'https://gk.com/1', read: true, state: 'skipped' }]);
    const r0 = await flowMarkAllRead([]);
    expect(r0).toEqual({ bumped: 0, snapshot: [] });
    const r1 = await flowMarkAllRead(diskJson(vault).articles);
    expect(r1.bumped).toBe(0);
    expect(r1.snapshot).toEqual([]);
  });
});

// ---------- 条目3（CB12）+ 条目4（新-1）：executeFetchRound catch 与风控文案 ----------

function fakeDisk(over: Partial<FetchDiskState> = {}): FetchDiskState {
  return {
    articles: [], sources: { zhihu: true, guokr: true, bilibili: true, rss: true },
    bilibiliUps: [], bilibiliMaxItems: 10, bilibiliCookie: '', bilibiliUpInfo: {},
    rssFeeds: [], lastFetchAt: 0, fetchIntervalMin: 30, ...over,
  };
}

function makeStore(disk: FetchDiskState, opts?: { readThrows?: Error }): FetchStoreDeps {
  let cur = disk;
  return {
    read: async () => {
      if (opts?.readThrows) throw opts.readThrows;
      return { ...cur, articles: [...cur.articles] };
    },
    write: async (_intent: NewsWriteIntent) => {},
  };
}

describe('executeFetchRound 补 catch（CB12）', () => {
  it('手动轮存储层抛错 → 人话错误通知 + 返回 null（不再 unhandled）', async () => {
    const store = makeStore(fakeDisk(), { readThrows: new Error('news.json 被占用') });
    const r = await fetchNowNews({ httpGet: async () => '{}', store });
    expect(r).toBeNull();
    expect(noticeMock).toHaveBeenCalledWith(
      expect.stringContaining('聚合讯抓取失败'),
      'error',
    );
    expect(noticeMock.mock.calls[0][0]).toContain('news.json 被占用');
  });

  it('自动轮（maybeFetchNews）失败静默：只 console.warn 计数，不弹通知', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = makeStore(fakeDisk(), { readThrows: new Error('boom') });
    const r = await maybeFetchNews({ httpGet: async () => '{}', store });
    expect(r).toBeNull();
    expect(noticeMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('B站风控通知文案（新-1：不再指向已移除的 Cookie 设置）', () => {
  it('风控轮（code≠0）→ 文案如实描述自动重试，无「设置/更新 Cookie」指引', async () => {
    const store = makeStore(fakeDisk({ bilibiliUps: ['546195'] }));
    const riskHttpGet = async (url: string) => {
      if (url.includes('polymer/web-dynamic')) return JSON.stringify({ code: 412, message: '请求被拦截' });
      return '{}';
    };
    const r = await fetchNowNews({ httpGet: riskHttpGet, store, now: () => 1_000_000 });
    expect(r).not.toBeNull();
    expect(r!.needsCookieNotice).toBe(true);
    const riskNotice = noticeMock.mock.calls.find((c) => String(c[0]).includes('风控'));
    expect(riskNotice).toBeTruthy();
    expect(riskNotice![0]).toBe('B站接口被风控，将自动重试，也可稍后手动抓取');
    expect(String(riskNotice![0])).not.toContain('设置');
    expect(String(riskNotice![0])).not.toContain('Cookie');
  });
});

// ---------- 条目5（新-2）：anchor 嵌套双链 ----------

const mark = (find: string, notePath: string, kind: 'term' | 'passage' = 'term') => ({ find, notePath, kind });

describe('anchor 同词双锚定不产出嵌套双链（新-2）', () => {
  it('同词先后锚定两个笔记：无 [[A|[[B|词]]]]，两链各自成立', () => {
    const body = '前文 词 中段 词 尾文';
    const r = applyBodyTransforms(body, [mark('词', '文献盒/A.md'), mark('词', '文献盒/B.md')], []);
    expect(r.body).toBe('前文 [[A|词]] 中段 [[B|词]] 尾文');
    expect(r.marks).toHaveLength(2);
    // 无嵌套破链形态
    expect(r.body).not.toMatch(/\[\[[^\]]*\[\[/);
  });

  it('正文原有 wikilink 内的同词不被再锚定（顺延找裸文本，找不到则放弃）', () => {
    // 首处「词」在合法双链显示文本内 → 跳过；替换第二处裸词
    const r = applyBodyTransforms('看 [[X|词]] 与 词。', [mark('词', '文献盒/B.md')], []);
    expect(r.body).toBe('看 [[X|词]] 与 [[B|词]]。');
    expect(r.marks).toHaveLength(1);
    // 全部命中都在双链内 → 不替换不进明细（宁缺勿破）
    const r2 = applyBodyTransforms('只有 [[X|词]] 一处。', [mark('词', '文献盒/B.md')], []);
    expect(r2.body).toBe('只有 [[X|词]] 一处。');
    expect(r2.marks).toEqual([]);
  });

  it('已保存条目直写路径（applyClipContentTransforms）对已有双链同病同修', () => {
    const content = '---\nurl: "https://x.com/a"\n---\n正文 [[A|词]] 与 词。';
    const next = applyClipContentTransforms(content, [mark('词', '文献盒/B.md')], []);
    expect(next).toContain('[[A|词]] 与 [[B|词]]');
    expect(next).not.toMatch(/\[\[[^\]]*\[\[/);
  });
});

// ---------- 条目6（新-8）：resolveUidFromInput 走 core/http 单源 + 分型 ----------

describe('resolveUidFromInputDetailed（新-8）', () => {
  it('视频链接经 requestUrl 通道回填 mid', async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ code: 0, data: { owner: { mid: 546195 } } }),
    } as any);
    const r = await resolveUidFromInputDetailed('https://www.bilibili.com/video/BV1xx411c7mD');
    expect(r).toEqual({ uid: '546195', networkFailed: false });
  });

  it('网络失败（请求 reject / 非 2xx）→ networkFailed:true，与「无法识别」分型', async () => {
    vi.mocked(requestUrl).mockRejectedValue(new Error('network'));
    const r = await resolveUidFromInputDetailed('https://www.bilibili.com/video/BV1xx411c7mD');
    expect(r).toEqual({ uid: null, networkFailed: true });
    vi.mocked(requestUrl).mockResolvedValue({ status: 412, text: '' } as any);
    const r2 = await resolveUidFromInputDetailed('https://www.bilibili.com/video/BV1xx411c7mD');
    expect(r2).toEqual({ uid: null, networkFailed: true });
  });

  it('服务端正常应答但无 mid → 无法识别（networkFailed:false）', async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ code: 0, data: {} }),
    } as any);
    const r = await resolveUidFromInputDetailed('https://www.bilibili.com/video/BV1xx411c7mD');
    expect(r).toEqual({ uid: null, networkFailed: false });
  });

  it('纯 uid / 主页链接本地解析不走网络；坏响应 JSON 容错', async () => {
    const r = await resolveUidFromInputDetailed('546195');
    expect(r).toEqual({ uid: '546195', networkFailed: false });
    expect(requestUrl).not.toHaveBeenCalled();
    vi.mocked(requestUrl).mockResolvedValue({ status: 200, text: '<html>not json</html>' } as any);
    const r2 = await resolveUidFromInputDetailed('https://www.bilibili.com/video/BV1xx411c7mD');
    expect(r2).toEqual({ uid: null, networkFailed: false });
  });

  it('长 uid 同样本地解析（位数不设上限，2026-09-22 拍板）', async () => {
    for (const id of ['3706929260006322', '12345678901', '1234567890123456789012345']) {
      const r = await resolveUidFromInputDetailed(id);
      expect(r).toEqual({ uid: id, networkFailed: false });
    }
    expect(requestUrl).not.toHaveBeenCalled();
  });
});

// ---------- 条目8（效率#2）：scanClipDirectory 被拒诊断 ----------

describe('scanClipDirectory 被拒诊断（效率#2）', () => {
  it('返回数组形态不变（非破坏），附加 rejected/rejectedPaths 计数', async () => {
    const vault = new MockVault();
    vault.files.set('归档/网页剪藏/新篇.md', '---\nurl: "https://x.com/2"\ncreated: 2026-09-01 10:00:00\n---\n');
    vault.files.set('归档/网页剪藏/废稿A.md', '没有 frontmatter');
    vault.files.set('归档/网页剪藏/废稿B.md', '---\nsite: 果壳\n---\n'); // 缺 url/created
    setApp(mockAppWithVault(vault));
    const notes = await scanClipDirectory('归档/网页剪藏', { vault });
    expect(notes).not.toBeNull();
    expect(Array.isArray(notes)).toBe(true);
    expect(notes!.length).toBe(1); // 数组本体只含合法条目（旧消费方零改动）
    expect(notes!.rejected).toBe(2); // 附加诊断字段
    expect(notes!.rejectedPaths).toEqual(['归档/网页剪藏/废稿A.md', '归档/网页剪藏/废稿B.md']);
  });

  it('全合法 → rejected=0；解析抛异常的文件计入 rejected', async () => {
    const vault = new MockVault();
    vault.files.set('归档/网页剪藏/好篇.md', '---\nurl: "https://x.com/1"\ncreated: 2026-09-01 10:00:00\n---\n');
    setApp(mockAppWithVault(vault));
    const ok = await scanClipDirectory('归档/网页剪藏', { vault });
    expect(ok!.rejected).toBe(0);
    expect(ok!.rejectedPaths).toEqual([]);
    const boomVault = new MockVault();
    boomVault.files.set('归档/网页剪藏/炸篇.md', '---\nurl: "https://x.com/2"\ncreated: 2026-09-01 10:00:00\n---\n');
    setApp(mockAppWithVault(boomVault));
    const boom = await scanClipDirectory('归档/网页剪藏', {
      vault: boomVault,
      parse: () => { throw new Error('解析炸了'); },
    });
    expect(boom!.length).toBe(0);
    expect(boom!.rejected).toBe(1);
    expect(boom!.rejectedPaths).toEqual(['归档/网页剪藏/炸篇.md']);
  });
});

// ---------- 条目9（效率#3 半）：抓取完成通知挂「去剪藏本」action ----------

describe('notifyManualFetchResult 挂「去剪藏本」action（效率#3）', () => {
  it('成功轮 → notify 带 action{label:去剪藏本, onClick}', () => {
    notifyManualFetchResult({ added: 3, prunedBilibili: 0, prunedRss: 0, failedSources: [], needsCookieNotice: false });
    expect(notifyMock).toHaveBeenCalledTimes(1);
    const opts = notifyMock.mock.calls[0][1];
    expect(opts).toBeTruthy();
    expect(opts!.type).toBe('success');
    expect(opts!.action!.label).toBe('去剪藏本');
    expect(typeof opts!.action!.onClick).toBe('function');
    expect(notifyMock.mock.calls[0][0]).toContain('新增 3 篇');
  });

  it('零新增轮照常挂 action；部分失败轮不叠加 success；抓取中走 notice', () => {
    notifyManualFetchResult({ added: 0, prunedBilibili: 0, prunedRss: 0, failedSources: [], needsCookieNotice: false });
    expect(notifyMock.mock.calls[0][1]!.action!.label).toBe('去剪藏本');
    notifyManualFetchResult({ added: 0, prunedBilibili: 0, prunedRss: 0, failedSources: ['B站'], needsCookieNotice: false });
    expect(notifyMock).toHaveBeenCalledTimes(1); // 部分失败不叠加
    notifyManualFetchResult(null);
    expect(noticeMock).toHaveBeenCalledWith('抓取已在进行中，请稍候', 'info');
  });
});
