// @vitest-environment node
/**
 * 影院（cinema）数据层测试：解析/排序/筛选/相对日期
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems, getDisplayItems, sortByDateDesc, dateVal } from '../../src/cinema/data';
import { getStarString, getGroupForTag, getGroupSafe } from '../../src/cinema/constants';
import { relDate } from '../../src/cinema/ui';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function md(content: string): string {
  return content;
}

describe('cinema 解析', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    M.folderPath = '我的/影视';
  });

  it('解析条目：名称/标签/组/评分/日期/状态/海报/豆瓣字段', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《星际穿越》.md', md(`---
tags:
  - 电影
评分: 9.6
观影日期: 2026-08-01
影评: 爱是穿越维度的唯一力量
海报: CONFIG/MOVIE POSTER/1.jpg
导演: 克里斯托弗·诺兰
主演: 马修·麦康纳 / 安妮·海瑟薇
类型: 剧情 / 科幻
制片国家/地区: 美国
上映日期: 2014-11-07
豆瓣评分: 9.4
豆瓣链接: https://movie.douban.com/subject/1889243/
简介: 近未来的地球黄沙遍野。
---`));
    const app = makeApp(vault);
    const items = rebuildItems(app);
    expect(items.length).toBe(1);
    const it = items[0];
    expect(it.name).toBe('星际穿越');
    expect(it.typeTag).toBe('电影');
    expect(it.group).toBe('电影');
    expect(it.rating).toBe(9.6);
    expect(it.watchDate).toBe('2026-08-01');
    expect(it.review).toBe('爱是穿越维度的唯一力量');
    expect(it.poster).toBe('CONFIG/MOVIE POSTER/1.jpg');
    expect(it.director).toBe('克里斯托弗·诺兰');
    expect(it.actors).toBe('马修·麦康纳 / 安妮·海瑟薇');
    expect(it.genre).toBe('剧情 / 科幻');
    expect(it.region).toBe('美国');
    expect(it.year).toBe('2014');
    expect(it.doubanRating).toBe('9.4');
    expect(it.doubanUrl).toBe('https://movie.douban.com/subject/1889243/');
    expect(it.synopsis).toBe('近未来的地球黄沙遍野。');
  });

  it('状态推断：-1=想看 / 0=在看 / 正数=已看', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n评分: -1\n---');
    vault.files.set('我的/影视/《B》.md', '---\ntags: [电影]\n评分: 0\n---');
    vault.files.set('我的/影视/《C》.md', '---\ntags: [电影]\n评分: 8.2\n---');
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const byName = Object.fromEntries(items.map((i) => [i.name, i]));
    expect(byName['A'].status).toBe(0); // STATUS_WANT
    expect(byName['B'].status).toBe(1); // STATUS_WATCHING
    expect(byName['C'].status).toBe(2); // STATUS_WATCHED
  });

  it('无 frontmatter 跳过；无 tag 跳过', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《无fm》.md', '正文没有 frontmatter');
    vault.files.set('我的/影视/《无tag》.md', '---\n评分: 8\n---');
    const app = makeApp(vault);
    const items = rebuildItems(app);
    expect(items.length).toBe(0);
  });

  it('剧集二级 tag → 组归剧集', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《三体》.md', '---\ntags: [国产剧]\n评分: 9.2\n---');
    vault.files.set('我的/影视/《黑镜》.md', '---\ntags: [英剧]\n评分: 8.1\n---');
    const app = makeApp(vault);
    const items = rebuildItems(app);
    items.forEach((i) => expect(i.group).toBe('剧集'));
  });
});

describe('cinema 排序与筛选', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    M.folderPath = '我的/影视';
  });

  function seed() {
    const vault = new MockVault();
    vault.files.set('我的/影视/《旧片》.md', '---\ntags: [电影]\n评分: 7.0\n观影日期: 2024-01-01\n---');
    vault.files.set('我的/影视/《新片》.md', '---\ntags: [电影]\n评分: 9.0\n观影日期: 2026-08-01\n---');
    vault.files.set('我的/影视/《无日期》.md', '---\ntags: [电影]\n评分: 8.0\n---');
    vault.files.set('我的/影视/《剧》.md', '---\ntags: [美剧]\n评分: 8.5\n观影日期: 2026-07-01\n---');
    const app = makeApp(vault);
    rebuildItems(app);
    return app;
  }

  it('默认排序：观影日期倒序，无日期排最后', () => {
    seed();
    const list = getDisplayItems();
    expect(list.map((i) => i.name)).toEqual(['新片', '剧', '旧片', '无日期']);
  });

  it('类型筛选 + 再点取消（typeFilter 置空 = 全部）', () => {
    seed();
    M.typeFilter = '电影';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['新片', '旧片', '无日期']);
    M.typeFilter = null;
    expect(getDisplayItems().length).toBe(4);
  });

  it('二级筛选（subFilter）', () => {
    seed();
    M.subFilter = '美剧';
    M.typeFilter = '剧集';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['剧']);
  });

  it('状态筛选', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《想看》.md', '---\ntags: [电影]\n评分: -1\n---');
    vault.files.set('我的/影视/《在看》.md', '---\ntags: [电影]\n评分: 0\n---');
    vault.files.set('我的/影视/《已看》.md', '---\ntags: [电影]\n评分: 8\n---');
    const app = makeApp(vault);
    rebuildItems(app);
    M.statusFilter = '想看';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['想看']);
    M.statusFilter = '在看';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['在看']);
  });

  it('搜索：名称/影评/导演命中', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《星际穿越》.md', '---\ntags: [电影]\n评分: 9.6\n影评: 爱是穿越维度的力量\n导演: 诺兰\n---');
    vault.files.set('我的/影视/《三体》.md', '---\ntags: [国产剧]\n评分: 9.2\n---');
    const app = makeApp(vault);
    rebuildItems(app);
    M.searchKeyword = '穿越';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['星际穿越']);
    M.searchKeyword = '诺兰';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['星际穿越']);
    M.searchKeyword = '三体';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['三体']);
  });
});

describe('cinema 工具函数', () => {
  it('星星：5 星轨道（实心+空心）', () => {
    expect(getStarString(9.6)).toBe('★★★★★');
    expect(getStarString(9.2)).toBe('★★★★☆');
    expect(getStarString(8.0)).toBe('★★★★☆');
    expect(getStarString(7.4)).toBe('★★★☆☆');
    expect(getStarString(5.4)).toBe('★★☆☆☆');
    expect(getStarString(1.4)).toBe('☆☆☆☆☆');
    expect(getStarString(0)).toBe('');
    expect(getStarString(-1)).toBe('');
  });

  it('组映射', () => {
    expect(getGroupForTag('美剧')).toBe('剧集');
    expect(getGroupForTag('日漫')).toBe('动漫');
    expect(getGroupSafe('未知tag')).toBe('其他');
  });

  it('相对日期（仿 formatRelativeTime）', () => {
    // 固定 now：2026-09-02 12:00 本地时区
    const now = new Date(2026, 8, 2, 12, 0, 0);
    const iso = (ms: number) => new Date(now.getTime() - ms).toISOString();
    expect(relDate(iso(30 * 1000), now)).toBe('刚刚');
    expect(relDate(iso(5 * 60 * 1000), now)).toBe('5分钟前');
    expect(relDate(iso(3 * 3600 * 1000), now)).toBe('3小时前');
    expect(relDate(iso(26 * 3600 * 1000), now)).toBe('昨天');
    expect(relDate(iso(2.5 * 86400000), now)).toBe('前天');
    // 跨年 → YYYY-MM-DD
    expect(relDate('2025-12-31', now)).toBe('2025-12-31');
    // 未来 → 原样日期
    expect(relDate(iso(-86400000), now)).toBe('2026-09-03');
    expect(relDate(null, now)).toBe('未标注日期');
    expect(relDate('not-a-date', now)).toBe('未标注日期');
  });
});
