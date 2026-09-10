/**
 * 剪藏本·每日简报（ADR-0119 / issue 263）UI 层测试：
 * 中栏按天分节目录 markup / 阅读面（要点 + 转录稿折叠 + 失败重跑）/ 简报源查询口径 / 设置弹窗名单组。
 */
import { describe, it, expect } from 'vitest';
import { briefListHtml, briefDayHeadHtml, briefPointsHtml, briefReaderHtml, railItemHtml, ICO } from '../../src/clipbook/render';
import { queryBySource, clipBrief } from '../../src/clipbook/store';
import { upManagerSettingsSchema } from '../../src/clipbook/news-sources-group';
import type { ClipArticle } from '../../src/clipbook/types';
import type { ClipbookData } from '../../src/clipbook/data';

const sidecar = (): ClipbookData => ({ articleOverrides: {}, savedArchive: [], order: [] });

function art(over: any = {}): ClipArticle {
  return clipBrief({
    bvid: 'BV1rHYx6fEzy',
    title: '走向灭亡！Anthropic 员工警告',
    url: 'https://www.bilibili.com/video/BV1rHYx6fEzy',
    upMid: 'M1',
    upName: '黑鸦Heya',
    duration: 173,
    pubdate: 1788951454,
    fetchedAt: '2026-09-10 12:00:00',
    body: '## 人事变动\n- Anthropic 员工公开警告\n- 涉及 ASI 风险',
    src: 'transcript',
    transcriptPath: 'C:/cache/resume-brief-BV1rHYx6fEzy.txt',
    read: false,
    state: 'unread',
    ...over,
  });
}

describe('briefDayHeadHtml（日节头）', () => {
  it('日期 + 条数 + data 钩子', () => {
    const h = briefDayHeadHtml('2026-09-10', 3);
    expect(h).toContain('data-clip-day="2026-09-10"');
    expect(h).toContain('2026-09-10');
    expect(h).toContain('3 条');
  });
  it('日期串转义（防注入）', () => {
    expect(briefDayHeadHtml('" onmouseover="x', 1)).not.toContain('onmouseover="x"');
  });
});

describe('briefListHtml（按天分节的目录）', () => {
  it('日节头 + 条目（data-id 复用点击/右键链路）+ 来源小标', () => {
    const html = briefListHtml([{ day: '2026-09-10', items: [art()] }], 'bv:BV1rHYx6fEzy', () => '2 小时前');
    expect(html).toContain('data-clip-day="2026-09-10"');
    expect(html).toContain('data-id="bv:BV1rHYx6fEzy"');
    expect(html).toContain('转写');
    expect(html).toContain('黑鸦Heya');
    expect(html).toContain('2 小时前');
    // 选中态
    expect(html).toContain('bz-clip-item--unread on');
  });

  it('字幕来源标「字幕」，失败条目标 ✗ 且带错误类', () => {
    const ok = briefListHtml([{ day: 'd', items: [art({ src: 'subtitle' })] }], null, () => '');
    expect(ok).toContain('字幕');
    const bad = briefListHtml([{ day: 'd', items: [art({ title: '', body: undefined, error: '转文字失败' })] }], null, () => '');
    expect(bad).toContain('✗');
    expect(bad).toContain('bz-clip-item--err');
  });

  it('空分组 → 空串（调用方走 uiEmpty）', () => {
    expect(briefListHtml([], null, () => '')).toBe('');
  });
});

describe('briefPointsHtml（要点轻渲染）', () => {
  it('## → h3、- → ul/li、其余 → p', () => {
    const h = briefPointsHtml('## 小节一\n- 要点甲\n- 要点乙\n\n普通段落');
    expect(h).toContain('<h3 class="bz-clip-brief-h">小节一</h3>');
    expect(h).toContain('<ul class="bz-clip-brief-ul">');
    expect(h).toContain('<li>要点甲</li>');
    expect(h).toContain('<li>要点乙</li>');
    expect(h).toContain('<p>普通段落</p>');
  });

  it('行内链接成锚（data-clip-ext 由行为层接管打开）', () => {
    const h = briefPointsHtml('- 见 [原文](https://example.com/a)');
    expect(h).toContain('<a class="bz-clip-md-link" href="https://example.com/a" data-clip-ext');
  });

  it('文本转义（不注入标签）', () => {
    const h = briefPointsHtml('- <img src=x onerror=alert(1)>');
    expect(h).not.toContain('<img');
  });

  it('空正文 → 空串', () => {
    expect(briefPointsHtml('')).toBe('');
  });
});

describe('briefReaderHtml（阅读面）', () => {
  const base = { time: '2026-09-09 10:00', durationLabel: '2:53' };

  it('正常：要点 + 打开原视频 + 可展开转录稿', () => {
    const h = briefReaderHtml(art(), { ...base, points: '<h3>x</h3>', transcript: '转录全文内容' });
    expect(h).toContain('bz-clip-brief-points');
    expect(h).toContain('data-clip-open-url');
    expect(h).toContain('打开原视频');
    expect(h).toContain('2:53');
    expect(h).toContain('<details class="bz-clip-brief-tr">');
    expect(h).toContain('完整转录稿');
    expect(h).toContain('转录全文内容');
  });

  it('转录稿取不到（缓存过期）→ 不出该段', () => {
    const h = briefReaderHtml(art(), { ...base, points: '<p>x</p>', transcript: '' });
    expect(h).not.toContain('bz-clip-brief-tr');
    expect(h).toContain('data-clip-open-url');
  });

  it('要点未生成 → 出占位提示', () => {
    const h = briefReaderHtml(art(), { ...base, points: '', transcript: '' });
    expect(h).toContain('正在生成本期要点');
  });

  it('失败条目：错误态 + 重跑入口（不出要点区）', () => {
    const h = briefReaderHtml(art({ title: '', body: undefined, error: '转文字失败：未配置 pythonPath' }), { ...base, points: '', transcript: '' });
    expect(h).toContain('bz-clip-brief-err');
    expect(h).toContain('本期抓取失败');
    expect(h).toContain('未配置 pythonPath');
    expect(h).toContain('data-clip-brief-retry');
    expect(h).not.toContain('正在生成本期要点');
  });
});

describe('rail 源行（每日简报）', () => {
  it('brief 选择器可序列化且计数呈现', () => {
    const h = railItemHtml({ kind: 'brief' }, '每日简报', 2, 5, ICO.brief, '', true, '');
    expect(h).toContain('&quot;kind&quot;:&quot;brief&quot;');
    expect(h).toContain('每日简报');
    expect(h).toContain('<b>2</b>');
    expect(h).toContain('/5');
    expect(h).toContain(' on');
  });
});

describe('queryBySource：brief 源独立成目', () => {
  const briefs = [
    { bvid: 'BV_A', title: 'A', url: 'u-a', pubdate: 1789000000, body: '## x\n- y', read: false, state: 'unread' },
    { bvid: 'BV_B', title: 'B', url: 'u-b', pubdate: 1788000000, body: '## x\n- y', read: true, state: 'read' },
  ];
  const articles = [
    { platform: 'B站', title: '普通动态', url: 'https://www.bilibili.com/video/BV_ART', author: 'U', read: false, date: '2026-09-10 00:00:00' },
  ];

  it('brief 源只出简报条目（时间降序），不混 news 流', () => {
    const list = queryBySource(articles, sidecar(), new Set(), [], { kind: 'brief' }, {}, briefs);
    expect(list.map((a) => a.raw.bvid)).toEqual(['BV_A', 'BV_B']);
    expect(list.every((a) => a.origin === 'brief')).toBe(true);
  });

  it('brief 源保留已读条目（按天翻阅不掏空当天）', () => {
    const list = queryBySource(articles, sidecar(), new Set(), [], { kind: 'brief' }, {}, briefs);
    expect(list.find((a) => a.raw.bvid === 'BV_B')!.st).toBe('read');
  });

  it('全部未读源不含简报条目（两源互不串门）', () => {
    const list = queryBySource(articles, sidecar(), new Set(), [], { kind: 'all' }, {}, briefs);
    expect(list.some((a) => a.origin === 'brief')).toBe(false);
    expect(list.length).toBe(1);
  });

  it('未传 briefs → 空列表（缺省不炸）', () => {
    expect(queryBySource(articles, sidecar(), new Set(), [], { kind: 'brief' }, {})).toEqual([]);
  });
});

describe('UP 主名单弹窗：新增「每日简报」组（ADR-0119）', () => {
  it('两组共存，简报组含添加行与名单列表行', () => {
    const schema = upManagerSettingsSchema({ ups: [], upInfo: {}, cookie: '', briefUps: [], onChanged: () => {} });
    expect(schema.groups.length).toBe(2);
    expect(schema.groups[0].name).toBe('UP 主名单');
    const g = schema.groups[1];
    expect(g.name).toBe('每日简报');
    const names = g.rows.map((r: any) => r.name);
    expect(names).toContain('添加 UP 主');
    expect(names).toContain('深度总结名单');
    expect(g.rows.some((r) => r.type === 'list')).toBe(true);
  });

  it('briefUps 缺省可省（lint 最小参数调用不炸）', () => {
    const schema = upManagerSettingsSchema({ ups: [], upInfo: {}, cookie: '', onChanged: () => {} });
    expect(schema.groups.length).toBe(2);
  });

  it('名单列表为空 → 出空态文案', () => {
    const schema = upManagerSettingsSchema({ ups: [], upInfo: {}, cookie: '', briefUps: [], onChanged: () => {} });
    const listRow = schema.groups[1].rows.find((r) => r.type === 'list') as any;
    expect(listRow.emptyText).toContain('深度总结');
    expect(listRow.items()).toEqual([]);
  });

  it('名单列表按 uid 出条目（名字回填优先）', () => {
    const schema = upManagerSettingsSchema({ ups: [], upInfo: { '3706929260006322': { name: '黑鸦Heya' } }, cookie: '', briefUps: ['3706929260006322'], onChanged: () => {} });
    const listRow = schema.groups[1].rows.find((r) => r.type === 'list') as any;
    const items = listRow.items();
    expect(items.length).toBe(1);
    expect(items[0].label).toBe('黑鸦Heya');
    expect(items[0].sub).toBe('UID 3706929260006322');
  });
});
