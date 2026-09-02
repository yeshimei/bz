/**
 * clipbook 域：侧写读写 + 状态机派生（ADR-0082 / issue 177）
 * 纯数据层测试（node 环境）：clipArticle 状态派生（saved/reading）、queryBySource 视图语义、
 * articleKeyOf、excerpt、emptySidecar 容错。
 */
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { articleKeyOf, excerpt } from '../../src/clipbook/constants';
import { readClipbookData, emptySidecar } from '../../src/clipbook/data';
import { clipArticle, clipFromNote, queryBySource, unreadTotal, inboxCount, clipUrlSet } from '../../src/clipbook/store';

beforeEach(() => {
  resetObsidianMocks();
  setApp(mockAppWithVault(new MockVault()));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
});

const base = (patch: Record<string, any> = {}) => ({
  url: 'https://x.com/a', title: '标题A', platform: '果壳科学人', author: '果壳',
  date: '2026-08-30 10:00:00', fetchedAt: '2026-08-30 09:00:00',
  ...patch,
});

describe('clipbook/data sidecar', () => {
  it('缺失文件 → 建空侧写可读', async () => {
    const d = await readClipbookData();
    expect(d).toEqual({ articleOverrides: {}, savedArchive: [], order: [] });
  });

  it('容错解析损坏段', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/clipbook.json', JSON.stringify({ articleOverrides: null, savedArchive: [{}, { url: 'u', title: 't' }], order: 'x' }));
    setApp(mockAppWithVault(vault));
    const d = await readClipbookData();
    expect(d.articleOverrides).toEqual({});
    expect(d.savedArchive).toEqual([{ url: 'u', title: 't' }]);
    expect(d.order).toEqual([]);
  });
});

describe('clipbook/store 派生', () => {
  it('articleKeyOf：url 优先', () => {
    expect(articleKeyOf(base())).toBe('url:https://x.com/a');
    expect(articleKeyOf({ title: 't', date: '2026-01-01' })).toBe('td:t|2026-01-01');
  });

  it('clipArticle：未读默认 unread；body 截取摘要', () => {
    const a = clipArticle(base({ body: '正文内容 '.repeat(60) }), {});
    expect(a.st).toBe('unread');
    expect(a.origin).toBe('news');
    expect(a.id).toBe('url:https://x.com/a');
    expect(a.summary.length).toBeLessThanOrEqual(111);
    expect(a.summary.endsWith('…')).toBe(true);
    expect(a.srcName).toBe('果壳科学人');
  });

  it('clipArticle：reading 侧写 → reading', () => {
    const ov = { [articleKeyOf(base())]: { reading: true } };
    const a = clipArticle(base(), { overrides: ov });
    expect(a.st).toBe('reading');
  });

  it('clipArticle：saved 三通道（news state / 归档 / url 命中剪藏）', () => {
    expect(clipArticle(base({ state: 'saved' }), {}).st).toBe('saved');
    expect(clipArticle(base({ state: 'skipped' }), { savedKeys: new Set(['https://x.com/a']) }).st).toBe('saved');
    expect(clipArticle(base(), { clipByUrl: new Set(['https://x.com/a']) }).st).toBe('saved');
  });

  it('B站 UP 展开：srcName=UP 名', () => {
    const a = clipArticle(base({ platform: 'B站', author: '影视飓风', url: 'https://www.bilibili.com/video/BV1' }), {});
    expect(a.srcName).toBe('影视飓风');
    expect(a.typeLabel).toBe('UP主');
  });

  it('queryBySource：all 只含未处理（read!==true），saved/已剪藏隐藏', () => {
    const arts = [
      base({ url: 'u1', read: false }), // 未读保留
      base({ url: 'u2', title: 'B', read: true, state: 'skipped' }), // 已处理不进流
      base({ url: 'u3', title: 'C', read: false, state: 'saved' }), // news saved → 收件流隐藏
      base({ url: 'https://clip.ed/1', title: 'D', read: false }), // url 命中剪藏目录 → 保底 saved 隐藏
    ];
    const sidecar = { ...emptySidecar(), articleOverrides: { 'url:u1': { reading: true } } };
    const list = queryBySource(arts, sidecar, new Set(['https://clip.ed/1']), [], { kind: 'all' });
    expect(list.map((a) => a.url)).toEqual(['u1']);
    expect(list[0].st).toBe('reading'); // reading 侧写保留在流内
  });

  it('queryBySource：平台源 + UP 过滤', () => {
    const arts = [
      base({ url: 'u1', read: false, platform: 'B站', author: '影视飓风' }),
      base({ url: 'u2', read: false, platform: 'B站', author: '亿点点不一样' }),
      base({ url: 'u3', read: false, platform: '果壳科学人' }),
    ];
    const biliAll = queryBySource(arts, emptySidecar(), new Set(), [], { kind: 'inbox', platform: 'B站' });
    expect(biliAll.length).toBe(2);
    const yjf = queryBySource(arts, emptySidecar(), new Set(), [], { kind: 'inbox', platform: 'B站', up: '影视飓风' });
    expect(yjf.length).toBe(1);
    expect(yjf[0].url).toBe('u1');
    const guokr = queryBySource(arts, emptySidecar(), new Set(), [], { kind: 'inbox', platform: '果壳科学人' });
    expect(guokr.length).toBe(1);
  });

  it('queryBySource：clip 源返回剪藏条目（saved）', () => {
    const notes = [{ path: '归档/网页剪藏/笔记一.md', title: '笔记一', site: '知乎日报', url: 'https://zhihu.com/x', created: Date.now() }];
    const list = queryBySource([], emptySidecar(), new Set(), notes, { kind: 'clip' });
    expect(list.length).toBe(1);
    expect(list[0].origin).toBe('clip');
    expect(list[0].st).toBe('saved');
    expect(list[0].notePath).toBe('归档/网页剪藏/笔记一.md');
  });

  it('clipFromNote 直接派生（剪藏详情打开入口）', () => {
    const a = clipFromNote({ path: 'p.md', title: 'T', site: '果壳', url: 'https://g.cn/1', summary: 's', tags: ['a'], created: 1000 });
    expect(a.st).toBe('saved');
    expect(a.backlinks).toEqual([]);
  });

  it('unreadTotal / inboxCount / clipUrlSet', () => {
    const arts = [base({ url: 'u1', read: false }), base({ url: 'u2', read: true, state: 'skipped' })];
    expect(unreadTotal(arts)).toBe(1);
    expect(inboxCount([base({ url: 'u3', read: false, platform: 'B站', author: 'UP1' })], 'B站')).toBe(1);
    expect(inboxCount([base({ url: 'u3', read: true, platform: 'B站' })], 'B站')).toBe(0);
    expect(clipUrlSet([{ url: 'a' }, {}, { url: 'b' }])).toEqual(new Set(['a', 'b']));
  });

  it('excerpt：去图片/链接保文字/去记号', () => {
    expect(excerpt('![图](x) 文字 [链接](https://y) 后文')).toBe('文字 链接 后文');
    expect(excerpt('短文本')).toBe('短文本');
    expect(excerpt('')).toBe('');
    expect(excerpt('*强调* **粗** `码`')).toBe('强调 粗 码');
  });
});
