/**
 * clipbook 渲染纯层测试（issue 247/ADR-0104：markup 单源 render.ts）。
 * 面板骨架锚 / rail JSON 转义（G 回归锚）/ 目录序号制与未读类 / 段落化
 * 引文·图片·拒载 / 状态章映射 / 站点短名。纯函数，node 环境可测。
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  panelHtml, railItemHtml, railFootHtml, tocListHtml, paragraphsHtml, summaryHtml,
  readerHtml, mobListHtml, mobDetailHtml, mobTocHtml, mobFoldHtml, mobChHeadHtml, clipLoadingHtml,
  siteShort, siteTint, stateFlag, stateLabel,
} from '../../src/clipbook/render';
import type { ClipArticle } from '../../src/clipbook/render';

function art(partial: Partial<ClipArticle>): ClipArticle {
  return {
    id: 'url:https://x.com/1',
    origin: 'news',
    title: '测试标题',
    url: 'https://x.com/1',
    site: '果壳科学人',
    domain: 'x.com',
    author: '',
    srcName: '果壳科学人',
    typeLabel: '',
    timeText: '',
    timeTs: 0,
    summary: '摘要',
    body: '',
    tags: [],
    notePath: null,
    st: 'unread',
    clipped: false,
    backlinks: [],
    ...partial,
  };
}

describe('clipbook render 纯层（issue 247）', () => {
  it('面板骨架：桌面三栏 + 移动双屏 + data-clip-* 钩子契约', () => {
    const html = panelHtml();
    expect(html).toContain('bz-clip-desk');
    expect(html).toContain('bz-clip-mob');
    expect(html).toContain('data-clip-rail');
    expect(html).toContain('data-clip-list');
    expect(html).toContain('data-clip-reader');
    expect(html).toContain('data-clip-desk-search');
    expect(html).toContain('data-clip-mob-close');
    expect(html).toContain('data-clip-mob-detail-body');
  });

  it('rail 行：data-src JSON 过转义（UP 名含单引号不裂属性）+ 计数口径', () => {
    const sel = { kind: 'inbox', platform: 'B站', up: "it's uid" } as any;
    const html = railItemHtml(sel, 'UP名', 3, 10, 'bili', '', true);
    expect(html).toContain('bz-rail-item on');
    // JSON 内的单引号须被转义为 &#39;，属性不提前闭合
    expect(html).not.toContain("up=it's");
    expect(html).toContain('&#39;');
    expect(html).toContain('<b>3</b>/10');
    // 零未读不产 <b>
    const html0 = railItemHtml({ kind: 'all' }, '全部未读', 0, 5, 'inbox', '', false);
    expect(html0).toContain('>0/5<');
  });

  it('目录：序号补零 + 未读/在读类 + 选中态 + 站点短名', () => {
    const list = [
      art({ st: 'unread', srcName: '果壳科学人' }),
      art({ st: 'reading', id: 'u2', srcName: '知乎日报' }),
      art({ st: 'saved', id: 'u3', srcName: '少数派' }),
    ];
    const html = tocListHtml(list, 'u2', () => '昨天 14:00');
    expect(html).toContain('bz-clip-item--unread');
    expect(html).toContain('bz-clip-item--reading on');
    expect(html).toContain('>01<');
    expect(html).toContain('>03<');
    expect(html).toContain('果壳 · 昨天 14:00');
  });

  it('段落化：引文块 / 图片段（解析失败丢段）/ 普通段', () => {
    const html = paragraphsHtml(
      [
        { type: 'p', text: '第一段' },
        { type: 'quote', text: '引文' },
        { type: 'img', text: 'https://x.com/a.png' },
        { type: 'img', text: '![[本地图.png]]' },
      ],
      (src) => (src.startsWith('https') ? src : null),
    );
    expect(html).toContain('<p>第一段</p>');
    expect(html).toContain('<blockquote>引文</blockquote>');
    expect(html).toContain('src="https://x.com/a.png"');
    expect(html).not.toContain('本地图'); // 拒载段不产 markup
  });

  it('阅读面：状态文字 + 摘要块 + 剪藏「打开笔记」文字脚（news 无）', () => {
    const clip = art({ origin: 'clip', st: 'saved', notePath: '归档/网页剪藏/A.md' });
    const htmlClip = readerHtml(clip, { time: '08-29', paras: '<p>正文</p>' });
    expect(htmlClip).toContain('已保存');
    expect(htmlClip).toContain('data-clip-open-note');
    expect(htmlClip).toContain('bz-clip-art-sum');
    const news = art({ st: 'unread' });
    const htmlNews = readerHtml(news, { time: '昨天', paras: '' });
    expect(htmlNews).toContain('未读');
    expect(htmlNews).not.toContain('data-clip-open-note');
    expect(htmlNews).toContain('正文已清空（已处理条目）');
  });

  it('移动端：章头计数 / 折叠行 / 章目录组装 / 详情状态章映射 / 加载占位', () => {
    const hd = mobChHeadHtml('果壳科学人', 2, 3, 5);
    expect(hd).toContain('bz-clip-mob-ch-hd');
    expect(hd).toContain('data-src=');
    expect(hd).toContain('<b>2</b> 未读 · 3 已收 / 5');
    expect(mobChHeadHtml('孤站', 0, 0, 1)).toContain('1 则');
    const fold = mobFoldHtml(6);
    expect(fold).toContain('bz-clip-mob-fold');
    expect(fold).toContain('data-fold');
    expect(fold).toContain('已收 <b>6</b> 篇');
    expect(fold).toContain('aria-expanded="false"');
    // 非搜索：常显 + 折叠行 + arch 段（arch 显隐由 CSS .open/容器 .searching 驱动）
    const toc = mobTocHtml([
      { site: '果壳科学人', unread: 2, activeN: 2, savedN: 1,
        activeHtml: mobListHtml([art({ title: '未读甲' }), art({ title: '在读乙', st: 'reading', id: 'u2' })], () => '昨天'),
        archHtml: mobListHtml([art({ title: '已收丙', st: 'saved', id: 'u3' })], () => '08-29') },
    ], false);
    expect(toc).toContain('bz-clip-mob-ch');
    expect(toc).toContain('bz-clip-mob-arch');
    expect(toc).toContain('bz-clip-mob-fold');
    expect(toc).toContain('未读甲');
    expect(toc).toContain('已收丙');
    // 搜索态：折叠行不渲染（命中全平铺）
    const tocS = mobTocHtml([
      { site: '果壳科学人', unread: 0, activeN: 1, savedN: 1,
        activeHtml: mobListHtml([art({ title: '甲' })], () => '昨天'),
        archHtml: mobListHtml([art({ title: '乙', st: 'saved', id: 'u2' })], () => '08-29') },
    ], true);
    expect(tocS).not.toContain('bz-clip-mob-fold');
    expect(tocS).toContain('bz-clip-mob-arch');
    expect(tocS).toContain('乙');
    // 无已收：不产折叠行与空 arch 段
    expect(mobTocHtml([{ site: 'B站', unread: 1, activeN: 1, savedN: 0, activeHtml: 'x', archHtml: '' }], false)).not.toContain('bz-clip-mob-fold');
    expect(mobDetailHtml(art({ st: 'reading' }), { time: '', paras: '' })).toContain('bz-clip-art-flag warn');
    expect(mobDetailHtml(art({ st: 'saved' }), { time: '', paras: '' })).toContain('bz-clip-art-flag ok');
    expect(mobDetailHtml(art({ st: 'unread' }), { time: '', paras: '' })).toContain('bz-clip-art-flag info');
    // 剪藏条目详情含「打开笔记」脚（news 无）
    expect(mobDetailHtml(art({ origin: 'clip', st: 'saved', notePath: '归档/网页剪藏/A.md' }), { time: '', paras: '' })).toContain('data-clip-open-note');
    expect(mobDetailHtml(art({ st: 'unread' }), { time: '', paras: '' })).not.toContain('data-clip-open-note');
    expect(clipLoadingHtml()).toContain('正在读取剪藏正文');
    expect(stateLabel('reading')).toBe('在读');
    expect(stateFlag('saved')).toEqual({ icon: 'check', cls: 'ok' });
    expect(mobListHtml([art({})], () => '刚刚')).toContain('bz-clip-mob-item');
    expect(railFootHtml(7)).toContain('<b>7</b>');
    expect(summaryHtml('摘')).toContain('bz-clip-art-sum-h');
  });

  it('站点短名与徽标色：果壳科学人→果壳；同站恒色', () => {
    expect(siteShort('果壳科学人')).toBe('果壳');
    expect(siteShort('知乎日报')).toBe('知乎日报');
    expect(siteTint('果壳')).toBe(siteTint('果壳'));
    expect(siteTint('果壳')).toMatch(/^hsl\(\d+, 42%, 52%\)$/);
  });
});
