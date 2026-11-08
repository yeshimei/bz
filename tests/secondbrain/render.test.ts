// @vitest-environment node
/**
 * 第二大脑渲染纯层（issue 251 / ADR-0104）：markup 构建器 + 统计纯函数收编后的锚点断言。
 * 零依赖（node 环境直跑）；行为链消费同一份 render.ts（旧评审壳已退役，ADR-0276）。
 */
import { describe, it, expect } from 'vitest';
import {
  computeStats,
  buildSourceTree,
  fmtCompact,
  panelShellHtml,
  panelCardsHtml,
  panelTrendHtml,
  panelDistHtml,
  panelRecentHtml,
  mergeRecent,
  bookDistNodes,
  SB_BOOK_COLOR,
  panelSummaryHtml,
  panelLogHtml,
  chatShellHtml,
  chatThinkingHtml,
  chatCitesHtml,
  refCardHtml,
  refStateHtml,
  sbSourceColor,
  escapeHtml,
  type SourceTreeNode,
} from '../../src/secondbrain/render';

function meta(notes: Record<string, { mtime: number; chunks: { text: string }[] }>) {
  return { version: 9, notes, _dim: 2 };
}

describe('fmtCompact', () => {
  it('≥10,000 缩写 K/M，万以下千分位', () => {
    expect(fmtCompact(6320)).toBe('6,320');
    expect(fmtCompact(19700)).toBe('19.7K');
    expect(fmtCompact(1200000)).toBe('1.2M');
  });
});

describe('computeStats（口径冻结）', () => {
  it('聚合段落/字符/平均段长/12 周桶/来源分布', () => {
    const now = Date.now();
    // 12 周桶按 epoch 周锚定（floor(now/week)），mtime=now 会随「周内位置」漂桶（周四 08:00 后必挂）——
    // 种子改按周锚点确定性落桶：A 落当前桶 [11]，B 落上一桶 [10]
    const weekMs = 7 * 24 * 3600 * 1000;
    const thisWeekStart = Math.floor(now / weekMs) * weekMs;
    const s = computeStats(
      meta({
        '卡片盒/A.md': { mtime: thisWeekStart, chunks: [{ text: 'aaaaaaaaaa' }] },
        '归档/网页剪藏/B.md': { mtime: thisWeekStart - 8 * 86400000, chunks: [{ text: 'bbbb' }, { text: 'cc' }] },
      }),
      now
    );
    expect(s.noteCount).toBe(2);
    expect(s.chunkCount).toBe(3);
    expect(s.totalChars).toBe(16);
    expect(s.bySource[0].name).toBe('归档');
    expect(s.trend12w[11]).toBe(1);
    expect(s.trend12w[10]).toBe(1);
    expect(s.avgChunkLen).toBe(Math.round(16 / 3));
  });
});

describe('buildSourceTree（树形口径）', () => {
  it('逐级聚合并按 chunks 降序', () => {
    const tree = buildSourceTree(
      meta({
        '归档/网页剪藏/B.md': { mtime: 1, chunks: [{ text: 'b' }, { text: 'b2' }] },
        '卡片盒/A.md': { mtime: 1, chunks: [{ text: 'a' }] },
      })
    );
    expect(tree.map((n) => n.name)).toEqual(['归档', '卡片盒']);
    const archive: SourceTreeNode = tree[0];
    expect(archive.chunks).toBe(2);
    expect(archive.children[0].name).toBe('网页剪藏');
  });
});

describe('主面板 markup', () => {
  it('骨架含全部行为锚点 id 与 data-lucide 占位', () => {
    const html = panelShellHtml();
    for (const id of ['bz-sb-content', 'bz-sb-onboard', 'bz-sb-cards', 'bz-sb-trend', 'bz-sb-dist', 'bz-sb-recent', 'bz-sb-init-btn', 'bz-sb-init-fill', 'bz-sb-init-status', 'bz-sb-pill-txt', 'bz-sb-log']) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('data-lucide="brain"');
    expect(html.match(/bz-sb-panel-func/g)!.length).toBe(4); // 周报入口 + 对话 + 参考 + 关闭（issue 272/360）
    expect(html).toContain('id="bz-sb-panel-close"');
    expect(html).toContain('id="bz-sb-weekly-open"'); // 本周知识动态头行入口（issue 360）
  });

  it('统计带/趋势/树/最近/摘要/日志构建器', () => {
    expect(panelCardsHtml([{ v: '1,677', k: '笔记', acc: true }, { v: '⚠ 2', k: '索引健康', warn: true }])).toContain('bz-sb-card--acc');
    expect(panelTrendHtml([0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 2])).toContain('bz-sb-trend-col--last');
    const tree: SourceTreeNode[] = [{ name: '归档', path: '归档', notes: 1, chunks: 2, children: [{ name: '网页剪藏', path: '归档/网页剪藏', notes: 1, chunks: 2, children: [] }] }];
    const expanded = new Set(['归档']);
    const dist = panelDistHtml(tree, expanded, () => '#0f766e', 2);
    expect(dist).toContain('bz-sb-dist-row--dir');
    expect(dist).toContain('网页剪藏'); // 展开态渲染子行
    const recent = panelRecentHtml([{ path: '卡片盒/A.md', name: 'A', chunks: 3, unit: '段', when: '今天', color: '#0f766e' }]);
    expect(recent).toContain('data-path="卡片盒/A.md"');
    expect(panelSummaryHtml('', '')).toBe(''); // 无摘要整卡隐藏
    expect(panelSummaryHtml('摘要', '昨天')).toContain('摘要');
    expect(panelLogHtml([{ text: 'a' }, { text: 'b', warn: true }])).toContain('bz-sb-log-item--warn');
  });
});

/**
 * 书籍并入统计（2026-11-08）：来源分布与最近向量化都要把阅读器的书摆进来。
 * 书不是目录——计数单位是「本 / 块」，点开走 data-book（阅读器协议），不是库内路径。
 */
describe('书籍并入统计（2026-11-08）', () => {
  const bookNodes: SourceTreeNode[] = [
    { name: '归档', path: '归档', notes: 2, chunks: 4, children: [] },
    {
      name: '书籍',
      path: '__books__',
      notes: 2,
      chunks: 30,
      book: 'group',
      children: [
        { name: '《心流》', path: '__book__:b1', notes: 1, chunks: 20, children: [], book: 'book', bookId: 'b1' },
        { name: '《存在》', path: '__book__:b2', notes: 1, chunks: 10, children: [], book: 'book', bookId: 'b2' },
      ],
    },
  ];

  it('来源分布：书籍汇总按「本 / 块」出数，单本书行带 data-book，书不参与笔记配色', () => {
    const html = panelDistHtml(bookNodes, new Set(['__books__']), () => '#0f766e', 20);
    expect(html).toContain('2 本 / 30 块');
    expect(html).toContain('data-book="b1"');
    expect(html).toContain('data-book="b2"');
    expect(html).toContain('20 块');
    expect(html).toContain(SB_BOOK_COLOR); // 书籍固定色
    expect(html).not.toContain('1 篇 / 20 段'); // 书的计数单位不能沿用笔记
  });

  it('最近向量化：书行没有路径、单位是「块」，点开走 data-book', () => {
    const html = panelRecentHtml([
      { bookId: 'b1', name: '《心流》', chunks: 20, unit: '块', when: '昨天', color: SB_BOOK_COLOR },
      { path: '卡片盒/A.md', name: 'A', chunks: 3, unit: '段', when: '今天', color: '#0f766e' },
    ]);
    expect(html).toContain('data-book="b1"');
    expect(html).toContain('20 块');
    expect(html).toContain('data-path="卡片盒/A.md"');
    expect(html).toContain('3 段');
  });

  it('混排：笔记与书按时间降序共用一把尺，取前 N 条', () => {
    const rows = mergeRecent(
      [
        { path: '卡片盒/旧.md', mtime: 100, chunks: 2 },
        { path: '卡片盒/新.md', mtime: 300, chunks: 1 },
      ],
      [{ bookId: 'b1', title: '心流', blocks: 20, updatedAt: 200 }],
      3
    );
    expect(rows.map((r) => r.name)).toEqual(['新.md', '《心流》', '旧.md']);
    expect(rows[1]).toMatchObject({ bookId: 'b1', chunks: 20, unit: '块' });
    expect(mergeRecent([], [{ bookId: 'b1', title: '', blocks: 1, updatedAt: 1 }], 10)[0].name).toBe('《未命名》');
  });

  it('老版阅读器只有汇总：最近列表补一行书籍汇总（没有书号 → 点不开）', () => {
    const rows = mergeRecent(
      [{ path: '卡片盒/A.md', mtime: 500, chunks: 1 }],
      [],
      10,
      { books: 4, blocks: 90, lastAt: 100 }
    );
    expect(rows.map((r) => r.name)).toEqual(['A.md', '书籍 4 本']);
    expect(rows[1]).toMatchObject({ chunks: 90, unit: '块' });
    expect(rows[1].bookId).toBeUndefined();
  });

  it('书籍节点：清单只列前 N 本，其余折成「等 N 本」', () => {
    const books = Array.from({ length: 3 }, (_, i) => ({ bookId: `b${i}`, title: `书${i}`, blocks: 10 }));
    const nodes = bookDistNodes(books, { books: 3, blocks: 30 }, 2);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ name: '书籍', notes: 3, chunks: 30, book: 'group' });
    expect(nodes[0].children.map((c) => c.name)).toEqual(['《书0》', '《书1》', '等 1 本']);
  });

  it('书籍节点：老版阅读器只有汇总 → 一行不可展开；都没有 → 不加节点', () => {
    const [only] = bookDistNodes([], { books: 4, blocks: 90 }, 8);
    expect(only).toMatchObject({ name: '书籍', notes: 4, chunks: 90, book: 'group' });
    expect(only.children).toEqual([]);
    expect(bookDistNodes([], null, 8)).toEqual([]);
  });
});

describe('对话 markup', () => {
  it('骨架含输入/发送/清空锚点；推荐词默认空', () => {
    const html = chatShellHtml(20);
    expect(html).toContain('id="bz-sb-chat-input"');
    expect(html).toContain('id="bz-sb-chat-send"');
    expect(html).toContain('id="bz-sb-chat-clear"');
    expect(html.match(/class="bz-sb-chat-chip"/g)).toBeNull();
    expect(html).toContain('id="bz-sb-chat-chips" hidden');
    expect(chatThinkingHtml(20)).toContain('检索 20 条');
    const cites = chatCitesHtml([{ path: '卡片盒/享乐适应.md', pct: 86, color: '#0f766e' }]);
    expect(cites).toContain('data-path');
    expect(chatCitesHtml([])).toBe('');
  });
});

describe('参考 markup', () => {
  it('卡片含分数条（定稿原型新元素）；占位态转义', () => {
    const card = refCardHtml('享乐适应', 86, '#a33d2a');
    expect(card).toContain('86%');
    expect(card).toContain('bz-sb-ref-card-bar');
    expect(card).toContain('bz-sb-ref-card-body');
    expect(refStateHtml('检索中…')).toContain('检索中…');
    expect(refStateHtml('<script>')).not.toContain('<script>');
  });
});

describe('色板与转义', () => {
  it('来源取色循环兜底；escapeHtml 防注入', () => {
    const order = new Map([['卡片盒', 0], ['归档', 1]]);
    expect(sbSourceColor('卡片盒', order)).toBe('#0f766e');
    expect(sbSourceColor('未知目录', order)).toBe('#a39b8c');
    expect(escapeHtml('<a href="x">')).toContain('&lt;a');
  });
});
