// @vitest-environment node
import { makeApp } from '../helpers/app';
/**
 * 影院（cinema）数据层测试：解析/排序/筛选
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetCinemaState, type CinemaItem } from '../../src/cinema/state';
import { rebuildItems, getDisplayItems, sortByDateDesc, sortByCreatedDesc, dateVal, normalizeRewatches } from '../../src/cinema/data';
import { getStarString, getGroupForTag, getGroupSafe, avgRating, rewatchCount, type Rewatch } from '../../src/cinema/constants';


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

  it('解析条目：完整上映日期 / 片长 / 季集 / 热门短评（详情弹窗字段补齐）', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《24小时 第一季》.md', md(`---
tags: [美剧]
评分: 9.2
上映日期: 2001-11-06
片长: 42分钟
季集: "24"
热门短评: 第一季的剧情比较单纯
---`));
    const app = makeApp(vault);
    const it = rebuildItems(app)[0];
    expect(it.year).toBe('2001'); // 卡片副行 / 分析页片龄仍按年
    expect(it.releaseDate).toBe('2001-11-06'); // 详情弹窗要完整年月日
    expect(it.duration).toBe('42分钟');
    expect(it.seasonText).toBe('24');
    expect(it.hotComment).toBe('第一季的剧情比较单纯');
  });

  it('状态单源键直读；评分编码兼容已移除——无「状态」键一律落已看，评分只当分值', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《A》.md', '---\ntags: [电影]\n状态: 想看\n---');
    vault.files.set('我的/影视/《B》.md', '---\ntags: [电影]\n状态: 在看\n评分: 0\n---');
    vault.files.set('我的/影视/《C》.md', '---\ntags: [电影]\n评分: 8.2\n---');
    vault.files.set('我的/影视/《D》.md', '---\ntags: [电影]\n评分: 8\n观影日期: 2026-01-01\n---');
    const app = makeApp(vault);
    const items = rebuildItems(app);
    const byName = Object.fromEntries(items.map((i) => [i.name, i]));
    expect(byName['A'].status).toBe(0); // STATUS_WANT：状态键直读
    expect(byName['B'].status).toBe(1); // STATUS_WATCHING
    expect(byName['B'].rating).toBe(0); // 评分 0 不再被清洗，就是分值 0
    expect(byName['C'].status).toBe(2); // STATUS_WATCHED：无状态键一律落已看（-1/0 推断已随兼容层移除）
    expect(byName['C'].rating).toBe(8.2); // 评分只当分值，不承担状态语义
    expect(byName['D'].status).toBe(2);
    expect(byName['D'].watchedDate).toBeNull(); // 已看日期只读新键：旧档回落观影日期已随兼容层移除
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

  it('rebuildItems：metadataCache 未就绪（cache null）的文件保留内存既有条目，防新建闪失（issue 256）', () => {
    const vault = new MockVault();
    // 无 frontmatter 也无 embeds → mock cache 返回 null（≈ 真库中新建文件尚未被 metadataCache 索引）
    vault.files.set('我的/影视/《缓存未就绪》.md', '正文');
    const app = makeApp(vault);
    const tfile = vault.getMarkdownFiles()[0];
    const handItem: CinemaItem = {
      file: tfile, name: '缓存未就绪', typeTag: '电影', group: '电影', watchDate: null, rating: null,
      status: 2, wantDate: null, watchingDate: null, watchedDate: null, rewatches: [], lists: [], shelvedOnly: false, poster: null, review: null, genre: null, director: null, actors: null,
      region: null, year: null, releaseDate: null, doubanRating: null, doubanUrl: null, synopsis: null, duration: null, seasonText: null, hotComment: null, mergeInto: null,
    };
    M.items.push(handItem);
    const items = rebuildItems(app);
    expect(items).toHaveLength(1);
    expect(items[0]).toBe(handItem);
  });

  it('rebuildItems：已索引但无效的文件（frontmatter 无 tags）不被保留分支救回', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《无效》.md', '---\n评分: 8\n---');
    const app = makeApp(vault);
    const tfile = vault.getMarkdownFiles()[0];
    M.items.push({
      file: tfile, name: '无效', typeTag: '电影', group: '电影', watchDate: null, rating: null,
      status: 2, wantDate: null, watchingDate: null, watchedDate: null, rewatches: [], lists: [], shelvedOnly: false, poster: null, review: null, genre: null, director: null, actors: null,
      region: null, year: null, releaseDate: null, doubanRating: null, doubanUrl: null, synopsis: null, duration: null, seasonText: null, hotComment: null, mergeInto: null,
    });
    rebuildItems(app);
    expect(M.items).toHaveLength(0);
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

  it('状态筛选', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《想看》.md', '---\ntags: [电影]\n状态: 想看\n---');
    vault.files.set('我的/影视/《在看》.md', '---\ntags: [电影]\n状态: 在看\n---');
    vault.files.set('我的/影视/《已看》.md', '---\ntags: [电影]\n评分: 8\n---'); // 无状态键 → 默认已看
    const app = makeApp(vault);
    rebuildItems(app);
    M.statusFilter = '想看';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['想看']);
    M.statusFilter = '在看';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['在看']);
  });

  it('按创建排序用 ctime：后编辑（mtime 新）不改排名', () => {
    // 旧片先创建但最近被编辑过（mtime 最新）；新片后创建未编辑——按创建应新片在前
    const mk = (name: string, ctime: number, mtime: number): CinemaItem => ({
      file: { path: `我的/影视/《${name}》.md`, stat: { ctime, mtime } } as any,
      name, typeTag: '电影', group: '电影',
      watchDate: null, rating: null, status: 2, wantDate: null, watchingDate: null, watchedDate: null, rewatches: [], lists: [], shelvedOnly: false, poster: null, review: null,
      genre: null, director: null, actors: null, region: null, year: null, releaseDate: null,
      doubanRating: null, doubanUrl: null, synopsis: null, duration: null, seasonText: null, hotComment: null, mergeInto: null,
    });
    const t0 = 1000;
    const old = mk('旧片', t0, 9000); // 先创建，后被编辑 → mtime 最大
    const newer = mk('新片', t0 + 1000, t0 + 1000); // 后创建，未编辑
    const list = sortByCreatedDesc([old, newer]);
    expect(list.map((i) => i.name)).toEqual(['新片', '旧片']); // 按 ctime 倒序，mtime 不参与
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

  it('frontmatter「合集」→ mergeInto（缺键、空串都归 null）', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《续命之徒：绝命毒师电影》.md', '---\ntags: [电影]\n合集: 绝命毒师\n---');
    vault.files.set('我的/影视/《普通片》.md', '---\ntags: [电影]\n合集: ""\n---');
    const app = makeApp(vault);
    rebuildItems(app);
    const byName = new Map(M.items.map((i) => [i.name, i]));
    expect(byName.get('续命之徒：绝命毒师电影')?.mergeInto).toBe('绝命毒师');
    expect(byName.get('普通片')?.mergeInto).toBeNull();
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

  it('片单收纳条目浏览时不混入正常视图；片单筛选命中显示', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《普通想看》.md', '---\ntags: [电影]\n状态: 想看\n---');
    vault.files.set('我的/影视/《收纳片》.md', '---\ntags: [电影]\n状态: 想看\n片单收纳: true\n片单:\n- 豆列合集\n---');
    const app = makeApp(vault);
    M.folderPath = '我的/影视';
    // 前序用例可能残留筛选态（本文件无全局 reset），显式清场再断「正常视图」
    M.typeFilter = null;
    M.statusFilter = null;
    M.listFilter = null;
    M.searchKeyword = '';
    rebuildItems(app);
    // 浏览态（无筛选/类型/状态）排除收纳条目
    expect(getDisplayItems().map((i) => i.name)).toEqual(['普通想看']);
    // 片单筛选命中 → 收纳条目出现
    M.listFilter = '豆列合集';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['收纳片']);
    M.listFilter = null;
  });

  it('搜索是全局的（2026-10-05 拍板）：忽略类型/状态/片单筛选，片单收纳条目也能命中', () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《普通想看》.md', '---\ntags: [电影]\n状态: 想看\n---');
    vault.files.set('我的/影视/《收纳片》.md', '---\ntags: [电影]\n状态: 想看\n片单收纳: true\n片单:\n- 豆列合集\n---');
    vault.files.set('我的/影视/《已看剧集》.md', '---\ntags: [国产剧]\n状态: 已看\n---');
    const app = makeApp(vault);
    M.folderPath = '我的/影视';
    M.typeFilter = null;
    M.statusFilter = null;
    M.listFilter = null;
    M.searchKeyword = '';
    rebuildItems(app);
    // ① 收纳条目不因 shelvedOnly 被排除（旧口径「搜索也排除」已废，搜得到）
    M.searchKeyword = '收纳';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['收纳片']);
    // ② 叠加类型/状态筛选也照样全库命中（数据层短路，不依赖 UI 清筛选）
    M.typeFilter = '电影';
    M.statusFilter = '想看';
    M.searchKeyword = '剧集';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['已看剧集']);
    // ③ 片单筛选同理不设限
    M.typeFilter = null;
    M.statusFilter = null;
    M.listFilter = '豆列合集';
    M.searchKeyword = '普通';
    expect(getDisplayItems().map((i) => i.name)).toEqual(['普通想看']);
    // 收尾清场，不污染后续用例
    M.typeFilter = null;
    M.statusFilter = null;
    M.listFilter = null;
    M.searchKeyword = '';
  });

  it('组映射', () => {
    expect(getGroupForTag('美剧')).toBe('剧集');
    expect(getGroupForTag('日漫')).toBe('动漫');
    expect(getGroupSafe('未知tag')).toBe('其他');
  });

  it('avgRating（ADR-0240）：首评 + 各刷等权平均、一位小数；缺分刷次不进分母', () => {
    // 基本平均：首评 9 + 重温 8 → 8.5
    expect(avgRating({ rating: 9, rewatches: [{ at: '2026-03-08', rating: 8 }] })).toBe(8.5);
    // 一位小数四舍五入：(9.6+7.6+7.5)/3 = 8.233… → 8.2
    expect(avgRating({ rating: 9.6, rewatches: [{ at: 'a', rating: 7.6 }, { at: 'b', rating: 7.5 }] })).toBe(8.2);
    // 某刷没打分（rating: null）不进分母：(9+7)/2 = 8，而不是 (9+null+7) 兜底
    expect(avgRating({ rating: 9, rewatches: [{ at: 'a', rating: null }, { at: 'b', rating: 7 }] })).toBe(8);
    // 只重温打分、首评缺席（想看建档后从未评过）：只平均有分的刷次
    expect(avgRating({ rating: null, rewatches: [{ at: 'a', rating: 6 }] })).toBe(6);
    // 全缺席 → null（界面回落「未评分」）
    expect(avgRating({ rating: null, rewatches: [] })).toBeNull();
    expect(avgRating({ rating: null, rewatches: [{ at: 'a', rating: null }] })).toBeNull();
    // 0 / 负值不是真分（未评分占位），不进分母
    expect(avgRating({ rating: 0, rewatches: [{ at: 'a', rating: 8 }] })).toBe(8);
    // 等权语义：第 2 刷与第 9 刷分量相同，不做近因加权
    expect(avgRating({ rating: 5, rewatches: Array.from({ length: 8 }, (_, i) => ({ at: `刷${i}`, rating: 9 })) })).toBe(8.6);
  });

  it('rewatchCount：首看占 1 刷 + 重温次数（新结构口径不变）', () => {
    expect(rewatchCount({ rewatches: [] })).toBe(1);
    expect(rewatchCount({ rewatches: [{ at: 'a', rating: 8 }, { at: 'b', rating: null }] })).toBe(3);
  });

  it('normalizeRewatches 兼容旧字符串数组（ADR-0240 前存量：缺分记 null，不伪造历史分）', () => {
    // 旧档：纯时间戳字符串数组（date-only / 时刻粒度混存）→ 逐项补 rating: null
    expect(normalizeRewatches(['2026-03-08', '2026-10-01 19:57:46'])).toEqual([
      { at: '2026-03-08', rating: null },
      { at: '2026-10-01 19:57:46', rating: null },
    ]);
    // 旧档单字符串（流式）同样兼容
    expect(normalizeRewatches('2026-03-08')).toEqual([{ at: '2026-03-08', rating: null }]);
    // 新档对象数组照收；rating 非法（空串/NaN）归 null
    expect(normalizeRewatches([{ at: '2026-10-05 01:11:50', rating: 9 }])).toEqual([
      { at: '2026-10-05 01:11:50', rating: 9 },
    ]);
    expect(normalizeRewatches([{ at: 'a', rating: '' }, { at: 'b', rating: 'x' }])).toEqual([
      { at: 'a', rating: null },
      { at: 'b', rating: null },
    ]);
    // 无 at 的条目无从定位，跳过；缺失/非数组 → 空
    expect(normalizeRewatches([{ rating: 8 }, '2026-03-08'])).toEqual([{ at: '2026-03-08', rating: null }]);
    expect(normalizeRewatches(undefined)).toEqual([]);
    expect(normalizeRewatches(null)).toEqual([]);
    // 混合旧新（手工编辑中间态）：各自归位
    expect(normalizeRewatches(['2026-01-01', { at: '2026-02-02', rating: 7 }])).toEqual([
      { at: '2026-01-01', rating: null },
      { at: '2026-02-02', rating: 7 },
    ]);
  });

  it('dateVal：date-only 归一化为当日 0 点（与同日 00:00:00 等值，避免同日重温排到老记录后）', () => {
    const base = { name: 'x', tag: '电影', status: 2, created: 0, rewatches: [] as Rewatch[] } as unknown as CinemaItem;
    expect(dateVal({ ...base, watchDate: '2026-03-08' })).toBe(dateVal({ ...base, watchDate: '2026-03-08 00:00:00' }));
    // 带时刻的下午场晚于同日 0 点
    expect(dateVal({ ...base, watchDate: '2026-03-08 14:30:00' })).toBeGreaterThan(dateVal({ ...base, watchDate: '2026-03-08' }));
    // 无日期 / 非法 → 0（排最后）
    expect(dateVal({ ...base, watchDate: '' })).toBe(0);
    expect(dateVal({ ...base, watchDate: '垃圾值' })).toBe(0);
  });

});
