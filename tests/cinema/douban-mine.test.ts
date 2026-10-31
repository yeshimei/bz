// @vitest-environment node
/**
 * 豆瓣个人收藏页（collect）导入：块级解析 / uid 定位 / 翻页步长。
 * COLLECT_PAGE 取自 2026-10-31 真机 collect 页原件（缩进与属性序照抄）——
 * 正是它暴露了老行级正则的病根：海报 a 的 title 在 href **之前**，标题 a 的片名
 * 又被 <em> 包着，两处回落都截到空，30 个链接全部空名 → 抓到 0 条。
 */
import { describe, expect, it } from 'vitest';
import {
  parseDoubanEntriesHtml, doubanUidFromCookie, doubanMineCollectUrl, fetchDoubanList,
} from '../../src/cinema/douban-fetcher';

const COLLECT_PAGE = `<div class="grid-view">

        <div class="item comment-item" data-cid="4647807625" >
            <div class="pic">
                <a title="731" href="https://movie.douban.com/subject/27605659/" class="nbg">
                    <img alt="731" src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2923955351.jpg">
                </a>
            </div>
            <div class="info">
                <ul>
                    <li class="title">
                        <a href="https://movie.douban.com/subject/27605659/">
                            <em>731</em>
                             / 疯狂731 / 731: 生化启示录
                        </a>
                            <span class="playable">[可播放]</span>
                    </li>
                        <li class="intro">2025-09-18(中国大陆) / 姜武 / 汉语普通话</li>
                    <li>
                                <span class="rating1-t"></span>
                        <span class="date">2025-09-22</span>
                    </li>
                    <li>
                        <span class="comment">垃圾电影。</span>
                            <span class="pl">(4 有用)</span>
                    </li>
                </ul>
            </div>
        </div>
        <div class="item comment-item" data-cid="4647807626" >
            <div class="pic">
                <a title="孤注一掷" href="https://movie.douban.com/subject/35267224/" class="nbg">
                    <img alt="孤注一掷" src="https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2888888888.jpg">
                </a>
            </div>
            <div class="info">
                <ul>
                    <li class="title">
                        <a href="https://movie.douban.com/subject/35267224/">
                            <em>孤注一掷</em>
                        </a>
                    </li>
                    <li>
                                <span class="rating5-t"></span>
                        <span class="date">2023-08-05</span>
                    </li>
                </ul>
            </div>
        </div>`;

describe('个人收藏页块级解析（parseDoubanEntriesHtml）', () => {
  it('collect 页：title 在 href 之前也拿得到片名，评分/日期/短评一并取出', () => {
    expect(parseDoubanEntriesHtml(COLLECT_PAGE)).toEqual([
      { sid: '27605659', name: '731', stars: 1, at: '2025-09-22', comment: '垃圾电影。' },
      { sid: '35267224', name: '孤注一掷', stars: 5, at: '2023-08-05', comment: '' },
    ]);
  });

  it('没打分的条目 only 状态：stars 为 null 而非 0（0 分与未分不是一回事）', () => {
    const html = `<div class="item"><div class="pic"><a title="无评分片" href="https://movie.douban.com/subject/1/"><img></a></div>
      <ul><li class="title"><a href="https://movie.douban.com/subject/1/"><em>无评分片</em></a></li>
      <li><span class="date">2024-01-01</span></li></ul></div>`;
    expect(parseDoubanEntriesHtml(html)).toEqual([
      { sid: '1', name: '无评分片', stars: null, at: '2024-01-01', comment: '' },
    ]);
  });

  it('同一片在页里出现多次按 sid 去重保序（海报块 + 文字块）', () => {
    const html = `${COLLECT_PAGE}<div class="item"><a title="731" href="https://movie.douban.com/subject/27605659/"><img></a></div>`;
    expect(parseDoubanEntriesHtml(html).map((e) => e.sid)).toEqual(['27605659', '35267224']);
  });

  it('无 .item 块（豆列形态）回落行级解析：只出 sid + 片名，评分恒 null', () => {
    const html = `<div class="doulist-item"><a href="https://movie.douban.com/subject/1292052/">肖申克的救赎</a></div>`;
    expect(parseDoubanEntriesHtml(html)).toEqual([
      { sid: '1292052', name: '肖申克的救赎', stars: null, at: null, comment: '' },
    ]);
  });

  it('登录墙 / 风控页 → 空数组（与老解析同口径，调用方据此分流提示）', () => {
    expect(parseDoubanEntriesHtml('<html>豆瓣登录页</html>')).toEqual([]);
    expect(parseDoubanEntriesHtml('')).toEqual([]);
  });
});

describe('豆瓣账号定位（cookie → uid → collect 链接）', () => {
  it('dbcl2 前缀即数字 uid（带引号与不带引号两种 cookie 形态）', () => {
    expect(doubanUidFromCookie('bid=abc; dbcl2="150820610:xyz"; ck=1')).toBe('150820610');
    expect(doubanUidFromCookie('dbcl2=150820610:xyz')).toBe('150820610');
  });

  it('没有 dbcl2 = 不是登录态 cookie → null（不接受自定义域名/ck 顶替）', () => {
    expect(doubanUidFromCookie('bid=abc; ck=xyz')).toBe(null);
    expect(doubanUidFromCookie('')).toBe(null);
  });

  it('collect 链接按数字 uid 拼（数字 id 恒有效，自定义域名可能被改）', () => {
    expect(doubanMineCollectUrl('150820610')).toBe('https://movie.douban.com/people/150820610/collect');
  });
});

/** 每页 n 个条目的假页（用 .item 块拼，sid 依次递增） */
function fakePage(n: number, from: number): string {
  let out = '<div class="grid-view">';
  for (let i = 0; i < n; i++) {
    const sid = String(from + i);
    out += `<div class="item"><a title="片${sid}" href="https://movie.douban.com/subject/${sid}/"><img></a>
      <ul><li><span class="rating4-t"></span><span class="date">2024-01-01</span></li></ul></div>`;
  }
  return out;
}

describe('翻页步长跟实际每页条数（collect 15/页，写死 25 会漏片）', () => {
  it('15/页的收藏页：第二页从 start=15 起，不跳第 16~25 条', async () => {
    const urls: string[] = [];
    // 前两页各 15 条、第三页空（到底）
    const httpGet = async (url: string) => {
      urls.push(url);
      const start = Number(/start=(\d+)/.exec(url)?.[1] ?? '0');
      return fakePage(start >= 30 ? 0 : 15, start + 1);
    };
    const { entries } = await fetchDoubanList('https://movie.douban.com/people/1/collect', httpGet, 'ck=1');
    expect(urls.map((u) => /start=(\d+)/.exec(u)?.[1])).toEqual(['0', '15', '30']);
    expect(entries.length).toBe(30);
    expect(entries.map((e) => e.sid)).toContain('16'); // 第 16 条必须在（写死 25 时会丢）
  });

  it('首页即空 → firstPageEmpty（UI 据此提示登录态/风控，而不是「链接不对」）', async () => {
    const { entries, firstPageEmpty } = await fetchDoubanList('https://movie.douban.com/people/1/collect', async () => '<html>登录</html>', 'ck=1');
    expect(entries).toEqual([]);
    expect(firstPageEmpty).toBe(true);
  });

  it('gapMs 页间留白：只改节奏不改结果', async () => {
    const urls: string[] = [];
    const httpGet = async (url: string) => {
      urls.push(url);
      const start = Number(/start=(\d+)/.exec(url)?.[1] ?? '0');
      return fakePage(start >= 15 ? 0 : 15, start + 1);
    };
    const { entries } = await fetchDoubanList('https://movie.douban.com/people/1/collect', httpGet, 'ck=1', undefined, 1);
    expect(urls.length).toBe(2);
    expect(entries.length).toBe(15);
  });
});
