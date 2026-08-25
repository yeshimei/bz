// @vitest-environment node
/**
 * 第二大脑统计纯函数（ticket 108）：
 * - buildSourceTree：目录树构建（逐级聚合计数/子节点按块数降序/递归）；
 * - computeStats 新维度：总字数/平均块长/平均每篇块数/最厚笔记 Top5。
 */
import { describe, it, expect } from 'vitest';
import { buildSourceTree, computeStats } from '../../src/secondbrain/panel';
import type { SecondBrainMeta } from '../../src/secondbrain/vector-store';

function meta(notes: Record<string, { mtime: number; chunks: { text: string }[] }>): SecondBrainMeta {
  return { version: 8, notes, _dim: 2 };
}

describe('buildSourceTree（ticket 108 来源分布树）', () => {
  it('按目录层级聚合计数，子节点按 chunks 降序，递归展开', () => {
    const m = meta({
      '我的/A.md': { mtime: 1, chunks: [{ text: 'a1' }, { text: 'a2' }] },
      '我的/日记/B.md': { mtime: 1, chunks: [{ text: 'b1' }] },
      '我的/日记/2025/C.md': { mtime: 1, chunks: [{ text: 'c1' }] },
      '卡片盒/D.md': { mtime: 1, chunks: [{ text: 'd1' }, { text: 'd2' }, { text: 'd3' }] },
    });
    const roots = buildSourceTree(m);
    expect(roots.map((r) => r.name)).toEqual(['我的', '卡片盒']); // 按 chunks 降序：我的 4 > 卡片盒 3
    const mine = roots.find((r) => r.name === '我的')!;
    expect(mine.notes).toBe(3);
    expect(mine.chunks).toBe(4); // 2 + 1 + 1
    expect(mine.children.map((c) => c.name)).toEqual(['日记']);
    const sub = mine.children[0];
    expect(sub.notes).toBe(2);
    expect(sub.chunks).toBe(2);
    expect(sub.children.map((c) => c.name)).toEqual(['2025']);
    expect(sub.children[0].notes).toBe(1);
  });

  it('根目录文件（无 /）归入「（根目录）」', () => {
    const m = meta({ 'README.md': { mtime: 1, chunks: [{ text: 'x' }] } });
    const roots = buildSourceTree(m);
    expect(roots[0].name).toBe('（根目录）');
    expect(roots[0].chunks).toBe(1);
  });
});

describe('computeStats 新维度（ticket 108）', () => {
  const m = meta({
    '我的/A.md': { mtime: 10, chunks: [{ text: '一二三四' }, { text: '五六七八九十' }] },
    '我的/日记/B.md': { mtime: 20, chunks: [{ text: '甲' }] },
  });

  it('总字数/平均块长/平均每篇块数', () => {
    const s = computeStats(m, 1000);
    expect(s.totalChars).toBe(11); // 4 + 6 + 1
    expect(s.avgChunkLen).toBe(Math.round(11 / 3));
    expect(s.avgChunksPerNote).toBe(1.5); // 3 块 / 2 篇
  });

  it('最厚笔记 Top5 按块数降序，最多 5 条', () => {
    const m2 = meta({
      'p1.md': { mtime: 1, chunks: [{ text: 'x' }] },
      'p2.md': { mtime: 2, chunks: [{ text: 'x' }, { text: 'y' }] },
      'p3.md': { mtime: 3, chunks: [{ text: 'x' }, { text: 'y' }, { text: 'z' }] },
    });
    const s = computeStats(m2, 1000);
    expect(s.topThickets.map((t) => t.path)).toEqual(['p3.md', 'p2.md', 'p1.md']);
    expect(s.topThickets[0].chunks).toBe(3);
  });
});