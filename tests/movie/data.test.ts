// @vitest-environment node
/**
 * 影视数据层测试（ticket 14）：rebuildItems/sortItemList/getDisplayItems
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, parseFrontmatter, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetMovieState } from '../../src/movie/state';
import { rebuildItems, sortItemList, getDisplayItems } from '../../src/movie/data';
import { STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED } from '../../src/movie/constants';

function makeApp(vault: MockVault) {
  const app = mockAppWithVault(vault);
  return app;
}

function md(content: string): string {
  return content;
}

describe('rebuildItems', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMovieState();
    M.folderPath = '我的/影视';
  });

  it('解析条目：书名/标签/组/评分/日期/状态', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《肖申克的救赎》.md', md(`---
tags:
- 电影
观影日期: 2025-06-01T20:00:00
评分: 5
海报: CONFIG/MOVIE POSTER/p1.png
影评: 经典之作
导演: 弗兰克·德拉邦特
主演: 蒂姆·罗宾斯/摩根·弗里曼
制片国家/地区: 美国
---
正文
`));
    const app = makeApp(vault);
    const items = rebuildItems(app);
    expect(items.length).toBe(1);
    const it = items[0];
    expect(it.name).toBe('肖申克的救赎');
    expect(it.typeTag).toBe('电影');
    expect(it.group).toBe('电影');
    expect(it.rating).toBe(5);
    expect(it.status).toBe(STATUS_WATCHED);
    expect(it.watchDate).toBe('2025-06-01T20:00:00');
    expect(it.actors).toBe('蒂姆·罗宾斯/摩根·弗里曼');
    expect(it.region).toBe('美国');
  });

  it('状态推断：rating -1→想看 / 0→在看 / >0→已看 / 无评分→已看', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/A.md', '---\ntags: [电影]\n评分: -1\n---');
    vault.files.set('我的/影视/B.md', '---\ntags: [剧集, 美剧]\n评分: 0\n---');
    vault.files.set('我的/影视/C.md', '---\ntags: [日漫]\n评分: 4\n---');
    vault.files.set('我的/影视/D.md', '---\ntags: [纪录片]\n---');
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const byName = Object.fromEntries(items.map((i) => [i.name, i.status]));
    expect(byName['A']).toBe(STATUS_WANT);
    expect(byName['B']).toBe(STATUS_WATCHING);
    expect(byName['C']).toBe(STATUS_WATCHED);
    expect(byName['D']).toBe(STATUS_WATCHED);
  });

  it('评分空值 → 已看（P2）：`评分:` 空串不再经 Number(\'\')=0 误判在看', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/E.md', '---\ntags: [电影]\n评分: \n---'); // 空串
    vault.files.set('我的/影视/F.md', '---\ntags: [电影]\n观影日期: 2025-06-01T10:00:00\n---'); // 无键（undefined 缺省行为不变）
    const items = rebuildItems(makeApp(vault));
    const byName = Object.fromEntries(items.map((i) => [i.name, i.status]));
    expect(byName['E']).toBe(STATUS_WATCHED);
    expect(items.find((i) => i.name === 'E')!.rating).toBeNull();
    expect(byName['F']).toBe(STATUS_WATCHED);
    expect(items.find((i) => i.name === 'F')!.rating).toBeNull();
  });

  it('无类型标签/无 frontmatter：无 tag 的笔记仍跳过；自定义 tag 归「其他」可见（x4）；非本目录跳过；状态字段被忽略（按评分推断）', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/X.md', '---\ntags: [随笔]\n---'); // 自定义 tag → 归「其他」不再静默消失
    vault.files.set('我的/影视/无标签.md', '---\n评分: 2\n---'); // 完全无 tag → 仍跳过
    vault.files.set('其他/Y.md', '---\ntags: [电影]\n---');
    // 状态字段不再被读取（旧数据兼容）：评分 0 = 在看，即使状态字段写矛盾值
    vault.files.set('我的/影视/Z.md', '---\ntags: [电影]\n状态: 2\n评分: 0\n---');
    vault.files.set('我的/影视/W.md', '正文无 frontmatter');
    const items = rebuildItems(makeApp(vault));
    expect(items.length).toBe(2);
    const x = items.find((i) => i.name === 'X')!;
    expect(x.typeTag).toBe('随笔');
    expect(x.group).toBe('其他');
    expect(items.find((i) => i.name === '无标签')).toBeUndefined();
    expect(items.find((i) => i.name === 'Z')!.status).toBe(STATUS_WATCHING);
  });

  it('tags 字符串单值', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/A.md', '---\ntags: 电影\n---');
    const items = rebuildItems(makeApp(vault));
    expect(items.length).toBe(1);
  });
});

describe('sortItemList', () => {
  beforeEach(() => resetMovieState());

  function item(name: string, watchDate: string | null, rating: number | null) {
    return { name, watchDate, rating } as any;
  }

  it('date：有日期升序，无日期恒排后（desc 也排后）', () => {
    const list = [
      item('B', null, 3),
      item('A', '2025-01-01T10:00:00', 5),
      item('C', '2025-03-01T10:00:00', 2),
    ];
    const asc = sortItemList(list, 'date', 'asc');
    expect(asc.map((i) => i.name)).toEqual(['A', 'C', 'B']);
    const desc = sortItemList(list, 'date', 'desc');
    expect(desc.map((i) => i.name)).toEqual(['C', 'A', 'B']);
  });

  it('rating：有评分按数值，无评分排后', () => {
    const list = [
      item('A', null, null),
      item('B', null, 3),
      item('C', null, 5),
    ];
    expect(sortItemList(list, 'rating', 'desc').map((i) => i.name)).toEqual(['C', 'B', 'A']);
    expect(sortItemList(list, 'rating', 'asc').map((i) => i.name)).toEqual(['B', 'C', 'A']);
  });

  it('name：zh localeCompare', () => {
    const list = [item('张三', null, null), item('李四', null, null), item('阿飞', null, null)];
    expect(sortItemList(list, 'name', 'asc').map((i) => i.name)).toEqual(['阿飞', '李四', '张三']);
    expect(sortItemList(list, 'name', 'desc').map((i) => i.name)).toEqual(['张三', '李四', '阿飞']);
  });
});

describe('getDisplayItems', () => {
  beforeEach(() => {
    resetMovieState();
    M.folderPath = '我的/影视';
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n评分: 5\n观影日期: 2025-01-01T10:00:00\n影评: 好看\n---');
    vault.files.set('我的/影视/《B》.md', '---\ntags: [美剧]\n评分: 0\n观影日期: 2025-02-01T10:00:00\n---');
    vault.files.set('我的/影视/《C》.md', '---\ntags: [日漫]\n评分: -1\n观影日期: 2025-03-01T10:00:00\n---');
    vault.files.set('我的/影视/《D》.md', '---\ntags: [纪录片]\n评分: 3\n观影日期: 2025-04-01T10:00:00\n---');
    rebuildItems(mockAppWithVault(vault));
  });

  it('默认全部 + 日期 desc', () => {
    const r = getDisplayItems();
    expect(r.map((i) => i.name)).toEqual(['D', 'C', 'B', 'A']);
  });

  it('类型过滤（组）+ 状态过滤', () => {
    M.typeFilter = '美剧'; // 单标签（源码语义：typeTag === typeFilter）
    expect(getDisplayItems().map((i) => i.name)).toEqual(['B']);
    M.typeFilter = '全部';
    M.statusFilter = '想看';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['C']);
    M.statusFilter = '在看';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['B']);
  });

  it('搜索：名称/影评匹配', () => {
    M.searchKeyword = '好看';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['A']);
    M.searchKeyword = '日漫';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['C']);
    M.searchKeyword = '不存在';
    expect(getDisplayItems().length).toBe(0);
  });
});

describe('parseFrontmatter 兼容', () => {
  it('数组元素剥引号 + 数字转 Number', () => {
    const fm = parseFrontmatter('---\ntags: ["电影"]\n评分: 5\n---')!;
    expect(fm.tags).toEqual(['电影']);
    expect(fm.评分).toBe(5);
  });
});
