// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseDoubanListHtml, fetchDoubanList } from '../../src/cinema/douban-fetcher';

describe('豆瓣片单解析（parseDoubanListHtml）', () => {
  it('提取 subject 链接与 title，按 sid 去重保序（页面里同一片常出现海报+文字两条链接）', () => {
    const html = `<a href="https://movie.douban.com/subject/4151650/" title="银翼杀手 2049">x</a>
      <a href="https://movie.douban.com/subject/1292001/" title="一一">y</a>
      <a href="https://movie.douban.com/subject/4151650/" title="银翼杀手 2049">重复</a>`;
    expect(parseDoubanListHtml(html)).toEqual([
      { sid: '4151650', name: '银翼杀手 2049' },
      { sid: '1292001', name: '一一' },
    ]);
  });

  it('反转义 HTML 实体并 trim 片名', () => {
    const html = `<a href="https://movie.douban.com/subject/1/" title="A &amp; B ">x</a>`;
    expect(parseDoubanListHtml(html)[0]).toEqual({ sid: '1', name: 'A & B' });
  });

  it('doulist 豆列形态：链接不带 title 属性，片名取链接文本（真机 doulist 抓 0 条的根因）', () => {
    const html = `<div class="doulist-item"><a href="https://movie.douban.com/subject/1292052/" >肖申克的救赎</a>
      <a href="https://movie.douban.com/subject/3011091/" class="title">  绿里奇迹
  </a></div>`;
    expect(parseDoubanListHtml(html)).toEqual([
      { sid: '1292052', name: '肖申克的救赎' },
      { sid: '3011091', name: '绿里奇迹' },
    ]);
  });

  it('doulist 与 wish 混排同片：title 优先于链接文本，仍按 sid 去重', () => {
    const html = `<a href="https://movie.douban.com/subject/9/" title="正名">文本名</a>
      <a href="https://movie.douban.com/subject/9/">另一文本</a>`;
    expect(parseDoubanListHtml(html)).toEqual([{ sid: '9', name: '正名' }]);
  });

  it('链接文本含换行与多空白折叠为单空格；空文本且无 title 跳过', () => {
    const html = `<a href="https://movie.douban.com/subject/5/" >多 词
      片名</a><a href="https://movie.douban.com/subject/6/"></a>`;
    expect(parseDoubanListHtml(html)).toEqual([{ sid: '5', name: '多 词 片名' }]);
  });

  it('无条目回空数组（登录页/风控页都表现为空）', () => {
    expect(parseDoubanListHtml('<html>豆瓣登录页</html>')).toEqual([]);
  });
});

describe('豆瓣片单翻页抓取（fetchDoubanList）', () => {
  const page = (names: string[], offset = 0): string =>
    names.map((n, i) => `<a href="https://movie.douban.com/subject/${offset + i + 1}/" title="${n}">x</a>`).join('');

  it('翻页聚合跨页去重；末页不足整页（20 条/页的 doulist）继续翻到空页为止', async () => {
    const calls: string[] = [];
    const base = 'https://www.douban.com/doulist/164548718';
    const pages: Record<string, string> = {
      [`${base}?start=0`]: page(Array.from({ length: 20 }, (_, i) => `片${i}`)),
      [`${base}?start=25`]: page(['尾片A', '尾片B'], 25),
    };
    const { entries, firstPageEmpty } = await fetchDoubanList(base, async (url) => {
      calls.push(url);
      return pages[url] ?? '';
    });
    // 不假设每页条数（wish 25 / doulist 20）：末页之后还要探一页空页才停
    expect(calls).toEqual([
      'https://www.douban.com/doulist/164548718?start=0',
      'https://www.douban.com/doulist/164548718?start=25',
      'https://www.douban.com/doulist/164548718?start=50',
    ]);
    expect(firstPageEmpty).toBe(false);
    expect(entries).toHaveLength(22);
  });

  it('翻过界豆瓣回落末页内容 → 无新 sid 即停（不死循环）', async () => {
    const calls: string[] = [];
    const last = page(['甲', '乙'], 0);
    const { entries } = await fetchDoubanList('https://movie.douban.com/people/x/wish', async (url) => {
      calls.push(url);
      return last; // 每页都返回同样内容
    });
    expect(calls.length).toBe(2); // 第二页全是已见 sid → fresh=0 停
    expect(entries).toHaveLength(2);
  });

  it('首页为空标记 firstPageEmpty（需登录/风控的提示口径），条目为空', async () => {
    const { entries, firstPageEmpty } = await fetchDoubanList('https://movie.douban.com/people/x/wish', async () => '<html>登录</html>');
    expect(firstPageEmpty).toBe(true);
    expect(entries).toEqual([]);
  });

  it('cookie 可选走请求头（个人页登录态），不填不带 Cookie 头', async () => {
    let seen: Record<string, string> | undefined;
    await fetchDoubanList('https://movie.douban.com/people/x/wish', async (_u, headers) => { seen = headers; return ''; });
    expect(seen).toBeUndefined();
    await fetchDoubanList('https://movie.douban.com/people/x/wish', async (_u, headers) => { seen = headers; return ''; }, 'bid=abc');
    expect(seen).toEqual({ Cookie: 'bid=abc' });
  });
});
