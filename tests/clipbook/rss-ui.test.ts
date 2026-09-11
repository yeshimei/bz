// @vitest-environment jsdom
/**
 * clipbook UI 层：RSS 订阅管理弹窗 schema（ADR-0121）——
 * 行形态（info + text 添加行 + list 订阅列表）、添加动作（试拉校验预取名：成功入库/坏址拦截/重复去重）、
 * 移除联动（removeRssFeed 落盘 + onChanged）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks, requestUrl } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { getNewsFilePath, type RssFeed } from '../../src/clipbook/news-data';
import { rssManagerSettingsSchema } from '../../src/clipbook/news-sources-group';
import { readDataSourceState } from '../../src/clipbook/news-source-settings';
import type { SettingsRow } from '../../src/core/settings-schema';

const rowByName = (rows: SettingsRow[], name: string) => rows.find((r) => (r as { name?: string }).name === name) as any;

function seedVault(feeds: RssFeed[] = []): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({
    articles: [], stats: {}, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true, rss: true }, rssFeeds: feeds,
  }));
  setApp(mockAppWithVault(vault));
  return vault;
}

const RSS_OK = '<rss><channel><title>橘鸦AI早报</title></channel></rss>';

beforeEach(() => {
  resetObsidianMocks();
  (requestUrl as ReturnType<typeof vi.fn>).mockReset();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', newsRetentionUnsavedDays: '30', articleDirectory: '归档/网页剪藏' }) as any);
  seedVault();
});

describe('rssManagerSettingsSchema（ADR-0121）', () => {
  it('行形态：守护版本提示 info + 添加 text 行（行内添加按钮）+ 订阅 list 行', () => {
    const schema = rssManagerSettingsSchema({ feeds: [], onChanged: () => {} });
    expect(schema.groups).toHaveLength(1);
    const rows = schema.groups[0].rows;
    expect(rowByName(rows, '守护需更新').type).toBe('info');
    const add = rowByName(rows, '添加 RSS 源');
    expect(add.type).toBe('text');
    expect(add.actions[0].text).toBe('添加');
    const list = rowByName(rows, '订阅列表');
    expect(list.type).toBe('list');
    expect(list.items()).toEqual([]);
  });

  it('添加动作：试拉成功 → 预取 feed 名入库 + onChanged', async () => {
    (requestUrl as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, text: RSS_OK });
    const onChanged = vi.fn();
    const schema = rssManagerSettingsSchema({ feeds: [], onChanged });
    const add = rowByName(schema.groups[0].rows, '添加 RSS 源');
    await add.actions[0].onClick('https://daily.juya.uk/rss.xml ');
    const st = await readDataSourceState();
    expect(st.rssFeeds).toEqual([{ url: 'https://daily.juya.uk/rss.xml', title: '橘鸦AI早报' }]);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('添加动作：试拉失败（不可达）→ 不入库', async () => {
    (requestUrl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const onChanged = vi.fn();
    const schema = rssManagerSettingsSchema({ feeds: [], onChanged });
    const add = rowByName(schema.groups[0].rows, '添加 RSS 源');
    await add.actions[0].onClick('https://broken.example/rss.xml');
    const st = await readDataSourceState();
    expect(st.rssFeeds).toEqual([]);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('添加动作：普通 HTML 网页（无 feed 结构标记）拦截不入库', async () => {
    (requestUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      text: '<!DOCTYPE html><html><head><title>普通网页</title></head><body>内容</body></html>',
    });
    const onChanged = vi.fn();
    const schema = rssManagerSettingsSchema({ feeds: [], onChanged });
    const add = rowByName(schema.groups[0].rows, '添加 RSS 源');
    await add.actions[0].onClick('https://example.com/page');
    const st = await readDataSourceState();
    expect(st.rssFeeds).toEqual([]);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('添加动作：非 http(s) 地址本地拦截，不发起试拉', async () => {
    (requestUrl as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, text: RSS_OK });
    const schema = rssManagerSettingsSchema({ feeds: [], onChanged: () => {} });
    const add = rowByName(schema.groups[0].rows, '添加 RSS 源');
    await add.actions[0].onClick('ftp://a.com/rss.xml');
    expect(requestUrl).not.toHaveBeenCalled();
  });

  it('订阅列表：label 取 feed 名（缺省回退 url）、sub 为 url；onChange 移除落盘 + onChanged', async () => {
    seedVault([{ url: 'https://a.com/rss.xml', title: 'A 源' }, { url: 'https://b.com/rss.xml' }]);
    const onChanged = vi.fn();
    const schema = rssManagerSettingsSchema({ feeds: [{ url: 'https://a.com/rss.xml', title: 'A 源' }, { url: 'https://b.com/rss.xml' }], onChanged });
    const list = rowByName(schema.groups[0].rows, '订阅列表');
    expect(list.items()).toEqual([
      { key: 'https://a.com/rss.xml', label: 'A 源', sub: 'https://a.com/rss.xml' },
      { key: 'https://b.com/rss.xml', label: 'https://b.com/rss.xml', sub: '' },
    ]);
    await list.onChange(['https://b.com/rss.xml']);
    const st = await readDataSourceState();
    expect(st.rssFeeds.map((f) => f.url)).toEqual(['https://b.com/rss.xml']);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
