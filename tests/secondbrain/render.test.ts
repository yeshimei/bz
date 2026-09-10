// @vitest-environment node
/**
 * 第二大脑渲染纯层（issue 251 / ADR-0104）：markup 构建器 + 统计纯函数收编后的锚点断言。
 * 零依赖（node 环境直跑）；行为链与评审壳消费同一份 render.ts（prototype-render.js）。
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
  panelSummaryHtml,
  panelLogHtml,
  chatShellHtml,
  chatThinkingHtml,
  chatCitesHtml,
  CHAT_CHIPS,
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
    expect(html.match(/bz-sb-panel-func/g)!.length).toBe(2); // 引导期收起的功能钮
  });

  it('统计带/趋势/树/最近/摘要/日志构建器', () => {
    expect(panelCardsHtml([{ v: '1,677', k: '笔记', acc: true }, { v: '⚠ 2', k: '索引健康', warn: true }])).toContain('bz-sb-card--acc');
    expect(panelTrendHtml([0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 2])).toContain('bz-sb-trend-col--last');
    const tree: SourceTreeNode[] = [{ name: '归档', path: '归档', notes: 1, chunks: 2, children: [{ name: '网页剪藏', path: '归档/网页剪藏', notes: 1, chunks: 2, children: [] }] }];
    const expanded = new Set(['归档']);
    const dist = panelDistHtml(tree, expanded, () => '#0f766e', 2);
    expect(dist).toContain('bz-sb-dist-row--dir');
    expect(dist).toContain('网页剪藏'); // 展开态渲染子行
    const recent = panelRecentHtml([{ path: '卡片盒/A.md', name: 'A', chunks: 3, when: '今天', color: '#0f766e' }]);
    expect(recent).toContain('data-path="卡片盒/A.md"');
    expect(panelSummaryHtml('', '')).toBe(''); // 无摘要整卡隐藏
    expect(panelSummaryHtml('摘要', '昨天')).toContain('摘要');
    expect(panelLogHtml([{ text: 'a' }, { text: 'b', warn: true }])).toContain('bz-sb-log-item--warn');
  });
});

describe('对话 markup', () => {
  it('骨架含输入/发送/清空锚点与推荐词', () => {
    const html = chatShellHtml(20);
    expect(html).toContain('id="bz-sb-chat-input"');
    expect(html).toContain('id="bz-sb-chat-send"');
    expect(html).toContain('id="bz-sb-chat-clear"');
    expect(html.match(/class="bz-sb-chat-chip"/g)!.length).toBe(CHAT_CHIPS.length);
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
