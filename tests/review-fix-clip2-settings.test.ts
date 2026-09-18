// @vitest-environment jsdom
/**
 * 剪藏本「设置/弹窗」侧 review 修复回归（review-clipbook-bugs.md C4 / C25）：
 * - C4：news.json 损坏/读盘失败期间写路径静默丢弃 + UI 假反馈——
 *   ① 数据层：writeSources/writeBilibiliMaxItems/writeBilibiliCookie/writeFetchInterval 返回是否落盘（false 不再静默）；
 *   ② addBilibiliUp/addRssFeed 返回值区分 invalid/exists/added/read-failed（旧布尔把「已存在」与「读盘失败」混同）；
 *   ③ removeRssFeed/removeBilibiliUp 以磁盘写结果定成败；
 *   ④ 调用方：写失败必弹 error 提示（正文无 emoji）；remove 成功通知只在落盘成功后弹（消灭假成功），
 *      失败时条目保留在弹窗字盒（重开不复现假删除）。
 * - C25：UP 主/RSS 管理弹窗单例守卫——连点「管理」不叠层（mask 已在 DOM 或首开尚在异步加载中即 return），
 *   关闭后守卫复位可再次打开。
 * mock 参照 tests/clipbook/news-sources-settings.test.ts / rss-ui.test.ts（obsidian 模块已被 vitest alias 替换）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, clearNotices, hasNotice, requestUrl } from './mock-obsidian-entry';
import { MockVault, mockAppWithVault } from './mock-vault';
import { setApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { getNewsFilePath } from '../src/clipbook/news-data';
import {
  readDataSourceState, writeSources, writeBilibiliMaxItems, writeBilibiliCookie, writeFetchInterval,
  addBilibiliUp, addRssFeed, removeBilibiliUp, removeRssFeed,
} from '../src/clipbook/news-source-settings';
import { dataSourceGroupRows, upManagerSettingsSchema, rssManagerSettingsSchema } from '../src/clipbook/news-sources-group';
import type { SettingsRow } from '../src/core/settings-schema';

/** 损坏的 news.json 原文（保留态：onCorrupt 不清盘，原文件原样留存） */
const BROKEN_JSON = '{ "articles": [broken json';

const rowByName = (rows: SettingsRow[], name: string) => rows.find((r) => (r as { name?: string }).name === name) as any;
const disk = (vault: MockVault) => JSON.parse(vault.files.get(getNewsFilePath())!);

/** 正常 news.json 种子（可覆盖任意段） */
function seedVault(over: Record<string, unknown> = {}): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({
    articles: [],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [],
    bilibiliUpInfo: {},
    bilibiliMaxItems: 10,
    bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true, rss: true },
    rssFeeds: [],
    ...over,
  }));
  setApp(mockAppWithVault(vault));
  return vault;
}

/** 损坏 news.json 种子（写路径应放弃落盘且不清盘） */
function seedBroken(): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), BROKEN_JSON);
  setApp(mockAppWithVault(vault));
  return vault;
}

/** 弹窗行 onClick 的最小 ctx（本组 onClick 只用到 rowEl/refreshVisibility） */
const fakeCtx = () => ({ rowEl: document.createElement('div'), refreshVisibility: () => {} }) as any;

beforeEach(() => {
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', newsRetentionUnsavedDays: '30', articleDirectory: '归档/网页剪藏' }) as any);
});

afterEach(() => {
  clearNotices();
  document.body.innerHTML = '';
});

// ---------- C4-①：写路径以「是否落盘」返回，不再静默丢弃 ----------

describe('C4 设置写路径（news.json 损坏态）', () => {
  it('损坏：四个写函数返回 false 且原文件原样保留（不清盘不写空库）', async () => {
    const vault = seedBroken();
    expect(await writeSources({ zhihu: false, guokr: false, bilibili: true, rss: true })).toBe(false);
    expect(await writeBilibiliMaxItems(25)).toBe(false);
    expect(await writeBilibiliCookie('ck')).toBe(false);
    expect(await writeFetchInterval(120)).toBe(false);
    expect(vault.files.get(getNewsFilePath())).toBe(BROKEN_JSON); // 原文件仍在（F8 恢复现场不被销毁）
  });

  it('正常：四个写函数返回 true 且对应段落盘（回归不误伤成功路径）', async () => {
    const vault = seedVault();
    expect(await writeSources({ zhihu: false, guokr: true, bilibili: true, rss: true })).toBe(true);
    expect(await writeBilibiliMaxItems(25)).toBe(true);
    expect(await writeBilibiliCookie('ck')).toBe(true);
    expect(await writeFetchInterval(120)).toBe(true);
    const d = disk(vault);
    expect(d.sources.zhihu).toBe(false);
    expect(d.bilibiliMaxItems).toBe(25);
    expect(d.bilibiliCookie).toBe('ck');
    expect(d.fetchIntervalMin).toBe(120);
  });
});

// ---------- C4-②③：add 四义返回值 / remove 以磁盘结果定成败 ----------

describe('C4 名单与订阅增删结果（数据层）', () => {
  it('add 四义：invalid / exists / added / read-failed（损坏态不得被当成「已存在」）', async () => {
    seedBroken();
    expect(await addBilibiliUp('123')).toBe('read-failed');
    expect(await addRssFeed('https://a.com/rss.xml')).toBe('read-failed');

    seedVault({ bilibiliUps: ['123'], rssFeeds: [{ url: 'https://a.com/rss.xml' }] });
    expect(await addBilibiliUp('   ')).toBe('invalid');
    expect(await addRssFeed('not-a-url')).toBe('invalid');
    expect(await addBilibiliUp('123')).toBe('exists');
    expect(await addRssFeed('https://a.com/rss.xml')).toBe('exists');
    expect(await addBilibiliUp('456')).toBe('added');
    expect(await addRssFeed('https://b.com/rss.xml', 'B 源')).toBe('added');
  });

  it('remove：损坏态返回 false 且不落盘（旧实现静默 no-op，调用方却已弹「已移除」）', async () => {
    const vault = seedBroken();
    expect(await removeRssFeed('https://a.com/rss.xml')).toBe(false);
    expect(await removeBilibiliUp('123')).toBe(false);
    expect(vault.files.get(getNewsFilePath())).toBe(BROKEN_JSON);
  });

  it('remove：正常态返回 true 且逐段删除（UP 资料一并清）', async () => {
    const vault = seedVault({ bilibiliUps: ['123'], bilibiliUpInfo: { '123': { name: '甲' } }, rssFeeds: [{ url: 'https://a.com/rss.xml' }] });
    expect(await removeBilibiliUp('123')).toBe(true);
    expect(await removeRssFeed('https://a.com/rss.xml')).toBe(true);
    const d = disk(vault);
    expect(d.bilibiliUps).toEqual([]);
    expect(d.bilibiliUpInfo).toEqual({});
    expect(d.rssFeeds).toEqual([]);
  });
});

// ---------- C4-④：调用方提示（设置组绑定 + 管理弹窗） ----------

describe('C4 设置组写失败提示（绑定 save）', () => {
  it('损坏：三个绑定的 save 各弹对应「保存失败」提示（无 emoji error 档）', async () => {
    seedBroken();
    const rows = dataSourceGroupRows(await readDataSourceState());
    await rowByName(rows, '知乎日报').binding.save();
    expect(hasNotice('保存失败（数据源开关）：news.json 不可读或已损坏')).toBe(true);
    await rowByName(rows, '抓取间隔').binding.save();
    expect(hasNotice('保存失败（抓取间隔）：news.json 不可读或已损坏')).toBe(true);
    await rowByName(rows, 'B站抓取条数').binding.save();
    expect(hasNotice('保存失败（B站抓取条数）：news.json 不可读或已损坏')).toBe(true);
  });

  it('正常：绑定 save 落盘且不弹失败提示', async () => {
    const vault = seedVault();
    const rows = dataSourceGroupRows(await readDataSourceState());
    await rowByName(rows, 'B站抓取条数').binding.save();
    expect(disk(vault).bilibiliMaxItems).toBe(10);
    expect(hasNotice(/保存失败/)).toBe(false);
  });
});

describe('C4 管理弹窗增删提示（调用方文案准确）', () => {
  it('UP 添加：损坏态弹「添加 UP 主保存失败」，不再误报「已在名单中」', async () => {
    seedBroken();
    const schema = upManagerSettingsSchema({ ups: [], upInfo: {}, onChanged: () => {} });
    await rowByName(schema.groups[0].rows, '添加 UP 主').actions[0].onClick('123456');
    expect(hasNotice('保存失败（添加 UP 主）：news.json 不可读或已损坏')).toBe(true);
    expect(hasNotice('该 UP 主已在名单中')).toBe(false);
  });

  it('UP 添加：已存在 → info 文案；新增 → 落盘 + 通知 + onChanged', async () => {
    const vault = seedVault({ bilibiliUps: ['123456'] });
    const onChanged = vi.fn();
    const schema = upManagerSettingsSchema({ ups: ['123456'], upInfo: {}, onChanged });
    const addRow = rowByName(schema.groups[0].rows, '添加 UP 主');
    await addRow.actions[0].onClick('123456');
    expect(hasNotice('该 UP 主已在名单中')).toBe(true);
    expect(onChanged).not.toHaveBeenCalled();

    clearNotices();
    await addRow.actions[0].onClick('654321');
    expect(hasNotice('已添加 UP 主 654321')).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(disk(vault).bilibiliUps).toEqual(['123456', '654321']);
  });

  it('UP 移除：损坏态条目保留 + 失败提示（无假成功）；正常态才弹已移除', async () => {
    seedBroken();
    const onChangedFail = vi.fn();
    const schema = upManagerSettingsSchema({ ups: ['11'], upInfo: {}, onChanged: onChangedFail });
    const listRow = rowByName(schema.groups[0].rows, '名单列表');
    await listRow.onChange([]);
    expect(hasNotice('保存失败（移除 UP 主 11）：news.json 不可读或已损坏')).toBe(true);
    expect(hasNotice('已移除 UP 主 11')).toBe(false); // 假成功消灭
    expect(listRow.items()).toHaveLength(1); // 字盒保留条目：重开不「复活」
    expect(onChangedFail).not.toHaveBeenCalled();

    clearNotices();
    const vault = seedVault({ bilibiliUps: ['11'] });
    const onChangedOk = vi.fn();
    const schema2 = upManagerSettingsSchema({ ups: ['11'], upInfo: {}, onChanged: onChangedOk });
    await rowByName(schema2.groups[0].rows, '名单列表').onChange([]);
    expect(hasNotice('已移除 UP 主 11')).toBe(true);
    expect(onChangedOk).toHaveBeenCalledTimes(1);
    expect(disk(vault).bilibiliUps).toEqual([]);
  });

  it('RSS 添加：损坏态弹「添加 RSS 源保存失败」；已存在 → info 文案', async () => {
    (requestUrl as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, text: '<rss><channel><title>甲源</title></channel></rss>' });
    seedBroken();
    const schema = rssManagerSettingsSchema({ feeds: [], onChanged: () => {} });
    await rowByName(schema.groups[0].rows, '添加 RSS 源').actions[0].onClick('https://a.com/rss.xml');
    expect(hasNotice('保存失败（添加 RSS 源）：news.json 不可读或已损坏')).toBe(true);
    expect(hasNotice('该 RSS 源已在订阅列表中')).toBe(false);

    clearNotices();
    seedVault({ rssFeeds: [{ url: 'https://a.com/rss.xml' }] });
    const schema2 = rssManagerSettingsSchema({ feeds: [{ url: 'https://a.com/rss.xml' }], onChanged: () => {} });
    await rowByName(schema2.groups[0].rows, '添加 RSS 源').actions[0].onClick('https://a.com/rss.xml');
    expect(hasNotice('该 RSS 源已在订阅列表中')).toBe(true);
  });

  it('RSS 移除：损坏态条目保留 + 失败提示；正常态落盘 + 已移除', async () => {
    seedBroken();
    const onChangedFail = vi.fn();
    const schema = rssManagerSettingsSchema({ feeds: [{ url: 'https://a.com/rss.xml', title: 'A 源' }], onChanged: onChangedFail });
    const listRow = rowByName(schema.groups[0].rows, '订阅列表');
    await listRow.onChange([]);
    expect(hasNotice('保存失败（移除 RSS 源 A 源）：news.json 不可读或已损坏')).toBe(true);
    expect(hasNotice('已移除 RSS 源 A 源')).toBe(false);
    expect(listRow.items()).toHaveLength(1);
    expect(onChangedFail).not.toHaveBeenCalled();

    clearNotices();
    const vault = seedVault({ rssFeeds: [{ url: 'https://a.com/rss.xml', title: 'A 源' }] });
    const onChangedOk = vi.fn();
    const schema2 = rssManagerSettingsSchema({ feeds: [{ url: 'https://a.com/rss.xml', title: 'A 源' }], onChanged: onChangedOk });
    await rowByName(schema2.groups[0].rows, '订阅列表').onChange([]);
    expect(hasNotice('已移除 RSS 源 A 源')).toBe(true);
    expect(onChangedOk).toHaveBeenCalledTimes(1);
    expect(disk(vault).rssFeeds).toEqual([]);
  });
});

// ---------- C25：管理弹窗单例守卫（连点不叠层） ----------

describe('C25 管理弹窗单例（连点不叠层）', () => {
  const masks = (id: string) => document.querySelectorAll(`#${id}`).length;

  it('UP 主管理：同帧连点 + 已开复点都只留一层 mask/popup，关闭后守卫复位可再开', async () => {
    seedVault({ bilibiliUps: ['11'] });
    const rows = dataSourceGroupRows(await readDataSourceState());
    const row = rowByName(rows, 'UP 主名单');
    const ctx = fakeCtx();

    // 同帧连点（首开还在 await 动态加载，mask 尚未挂 DOM——仅查 DOM 会漏，靠开启中标志拦住）
    await Promise.all([row.onClick(ctx), row.onClick(ctx), row.onClick(ctx)]);
    expect(masks('bz-up-manager-mask')).toBe(1);
    expect(masks('bz-up-manager-popup')).toBe(1);

    // 已开状态再点「管理」：仍只有一层
    await row.onClick(ctx);
    expect(masks('bz-up-manager-mask')).toBe(1);

    // 关遮罩 → 守卫复位，可再次打开
    (document.getElementById('bz-up-manager-mask') as HTMLElement).click();
    expect(masks('bz-up-manager-mask')).toBe(0);
    await row.onClick(ctx);
    expect(masks('bz-up-manager-mask')).toBe(1);
    (document.getElementById('bz-up-manager-mask') as HTMLElement).click();
  });

  it('RSS 订阅管理：同帧连点 + 已开复点都只留一层 mask/popup，关闭后守卫复位可再开', async () => {
    seedVault({ rssFeeds: [{ url: 'https://a.com/rss.xml' }] });
    const rows = dataSourceGroupRows(await readDataSourceState());
    const row = rowByName(rows, 'RSS 订阅源');
    const ctx = fakeCtx();

    await Promise.all([row.onClick(ctx), row.onClick(ctx)]);
    expect(masks('bz-rss-manager-mask')).toBe(1);
    expect(masks('bz-rss-manager-popup')).toBe(1);

    await row.onClick(ctx);
    expect(masks('bz-rss-manager-mask')).toBe(1);

    (document.getElementById('bz-rss-manager-mask') as HTMLElement).click();
    expect(masks('bz-rss-manager-mask')).toBe(0);
    await row.onClick(ctx);
    expect(masks('bz-rss-manager-mask')).toBe(1);
    (document.getElementById('bz-rss-manager-mask') as HTMLElement).click();
  });
});
