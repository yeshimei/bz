// @vitest-environment node
/**
 * 豆瓣盲区补全触碰测试（ADR-0111 / issue 252）：
 * 判定口径（有海报 ∧ 缺豆瓣链接 ∧ 豆瓣检查≠今日）+ 触碰写盘 + 同日一次节流
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetCinemaState, type CinemaItem } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import { todayStr, needsDoubanTouch, sweepDoubanBacklog } from '../../src/cinema/douban-sweep';

function mkItem(over: Partial<CinemaItem>): CinemaItem {
  return {
    file: null, name: 'X', typeTag: '电影', group: '电影', watchDate: null, rating: null,
    status: 2, poster: null, review: null, genre: null, director: null, actors: null,
    region: null, year: null, doubanRating: null, doubanUrl: null, doubanCheck: null,
    synopsis: null, duration: null, seasonText: null, ...over,
  };
}

describe('豆瓣触碰判定（needsDoubanTouch）', () => {
  const today = '2026-09-09';

  it('有海报缺链接无标记 → 触碰（盲区精确对象）', () => {
    expect(needsDoubanTouch(mkItem({ poster: 'CONFIG/MOVIE POSTER/a.jpg' }), today)).toBe(true);
  });

  it('已有豆瓣链接 → 不碰（口径：链接=完成）', () => {
    expect(
      needsDoubanTouch(
        mkItem({ poster: 'CONFIG/MOVIE POSTER/a.jpg', doubanUrl: 'https://movie.douban.com/subject/1/' }),
        today,
      ),
    ).toBe(false);
  });

  it('缺海报 → 不碰（watcher 原有职责，插件不重复触碰）', () => {
    expect(needsDoubanTouch(mkItem({ poster: null }), today)).toBe(false);
    expect(needsDoubanTouch(mkItem({ poster: '' }), today)).toBe(false);
  });

  it('检查标记=今日 → 不碰（同日一次）；=昨日 → 触碰（跨天再试）', () => {
    const it = mkItem({ poster: 'CONFIG/MOVIE POSTER/a.jpg' });
    expect(needsDoubanTouch(it, today)).toBe(true);
    it.doubanCheck = '2026-09-09';
    expect(needsDoubanTouch(it, today)).toBe(false);
    it.doubanCheck = '2026-09-08';
    expect(needsDoubanTouch(it, today)).toBe(true);
  });

  it('todayStr 为 YYYY-MM-DD 格式', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('豆瓣触碰写盘（sweepDoubanBacklog）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    M.folderPath = '我的/影视';
  });

  it('只触碰缺口笔记，写入当日 豆瓣检查；齐全笔记不动', async () => {
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《缺信息》.md',
      '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---',
    );
    vault.files.set(
      '我的/影视/《齐全》.md',
      '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n---',
    );
    const app = mockAppWithVault(vault);
    rebuildItems(app);

    const n = await sweepDoubanBacklog(app);
    expect(n).toBe(1);
    const fm = parseFrontmatter(vault.files.get('我的/影视/《缺信息》.md')!);
    expect(fm!['豆瓣检查']).toBe(todayStr());
    const done = parseFrontmatter(vault.files.get('我的/影视/《齐全》.md')!);
    expect(done!['豆瓣检查']).toBeUndefined();
  });

  it('同日重复扫描不重复触碰（触碰后重读标记，第二遍为 0）', async () => {
    const vault = new MockVault();
    vault.files.set(
      '我的/影视/《缺信息》.md',
      '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---',
    );
    const app = mockAppWithVault(vault);
    rebuildItems(app);
    expect(await sweepDoubanBacklog(app)).toBe(1);
    // 真实链路：触碰写盘 → 自动刷新 rebuild 重读标记；这里等价模拟
    rebuildItems(app);
    expect(await sweepDoubanBacklog(app)).toBe(0);
  });

  it('file 为 null 的条目跳过（无文件可写）', async () => {
    resetCinemaState();
    M.items.push(mkItem({ file: null, poster: 'CONFIG/MOVIE POSTER/a.jpg' }));
    const n = await sweepDoubanBacklog(mockAppWithVault(new MockVault()));
    expect(n).toBe(0);
  });
});
