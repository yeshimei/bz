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

  it('无条目回空数组（登录页/风控页都表现为空）', () => {
    expect(parseDoubanListHtml('<html>豆瓣登录页</html>')).toEqual([]);
  });
});

describe('豆瓣片单翻页抓取（fetchDoubanList）', () => {
  const page = (names: string[], offset = 0): string =>
    names.map((n, i) => `<a href="https://movie.douban.com/subject/${offset + i + 1}/" title="${n}">x</a>`).join('');

  it('翻页聚合跨页去重，末页（不足 25 条）即停', async () => {
    const calls: string[] = [];
    const base = 'https://movie.douban.com/people/x/wish';
    const pages: Record<string, string> = {
      [`${base}?start=0`]: page(Array.from({ length: 25 }, (_, i) => `片${i}`)),
      [`${base}?start=25`]: page(['尾片A', '尾片B'], 25),
    };
    const { entries, firstPageEmpty } = await fetchDoubanList(base, async (url) => {
      calls.push(url);
      return pages[url] ?? '';
    });
    expect(calls).toEqual([
      'https://movie.douban.com/people/x/wish?start=0',
      'https://movie.douban.com/people/x/wish?start=25',
    ]);
    expect(firstPageEmpty).toBe(false);
    expect(entries).toHaveLength(27);
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
