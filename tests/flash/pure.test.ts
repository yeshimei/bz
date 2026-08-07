/**
 * 闪念纯函数测试（ticket 18）：vptree/chunk/tfidf/text-search
 */
import { describe, it, expect } from 'vitest';
import { euclideanSq, normalizeVec, vptree_build, vptree_search } from '../../src/flash/vptree';
import { smartChunk } from '../../src/flash/chunk';
import { TFIDF } from '../../src/flash/tfidf';
import { extractTerms, searchTextIndex, searchText, STOP_WORDS } from '../../src/flash/text-search';
import { TFIDF_STOP_WORDS } from '../../src/flash/tfidf';

describe('vptree', () => {
  it('euclideanSq / normalizeVec', () => {
    expect(euclideanSq([0, 0], [3, 4])).toBe(25);
    const n = normalizeVec([3, 4]);
    expect(n[0]).toBeCloseTo(0.6, 10);
    expect(n[1]).toBeCloseTo(0.8, 10);
  });

  it('build + search 返回最近 k 个', () => {
    const items = [[0, 0], [1, 0], [0, 1], [10, 10]];
    const tree = vptree_build(items, [0, 1, 2, 3]);
    const r = vptree_search(tree, items, [0.1, 0.1], 2);
    expect(r).toHaveLength(2);
    expect(r[0].idx).toBe(0); // 最近
  });

  it('空树', () => {
    expect(vptree_build([], [])).toBeNull();
    expect(vptree_search(null, [], [], 5)).toEqual([]);
  });
});

describe('smartChunk', () => {
  it('按句界切块，块长 ≤256', () => {
    const sentences = Array.from({ length: 60 }, (_, i) => `这是第${i}个句子，用于测试分块逻辑。`);
    const text = sentences.join('');
    const chunks = smartChunk(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(256);
      expect(c.length).toBeGreaterThanOrEqual(50);
    }
  });

  it('短文本不切块；空文本返回空', () => {
    expect(smartChunk('短文本', 50)).toEqual([]);
    expect(smartChunk('', 50)).toEqual([]);
  });
});

describe('extractTerms / searchTextIndex', () => {
  it('停用词表（源码字符串原样，蓝图标注 35 字与实际 29 字有出入，以源码为准）', () => {
    expect(STOP_WORDS).toBe('的了是在我有和人这中大为上个国不以到说时要就出会也年对自其');
    expect(STOP_WORDS.length).toBe(29);
  });

  it('CJK 逐字 + 英文词，停用词过滤', () => {
    const t = extractTerms('这是一个测试 hello world');
    expect(t).toContain('测');
    expect(t).toContain('试');
    expect(t).not.toContain('是'); // 停用词
    expect(t).toContain('hello');
  });

  it('searchText 词频加权 + 归一化', () => {
    const docs = [
      { path: 'a.md', text: '机器学习 神经网络 深度学习 深度学习' },
      { path: 'b.md', text: '烹饪 美食 菜谱' },
    ];
    const idx = searchTextIndex(docs);
    const r = searchText('机器学习', idx, 10);
    expect(r[0].path).toBe('a.md');
    expect(r[0].score).toBe(1);
    expect(r.length).toBe(1);
  });

  it('空查询返回空', () => {
    const idx = searchTextIndex([{ path: 'a.md', text: 'x' }]);
    expect(searchText('的了是', idx, 10)).toEqual([]); // 全停用词
  });
});

describe('TFIDF（44 字停用词）', () => {
  it('停用词表与 35 字版不同（源码字符串原样，实际 40 字）', () => {
    expect(TFIDF_STOP_WORDS).toBe('的了是在我有和人这中大为上个国不以到说时要就出会也年对自其他里去子后也得着与把等');
    expect(TFIDF_STOP_WORDS.length).toBe(40);
    expect(TFIDF_STOP_WORDS).not.toBe(STOP_WORDS);
  });

  it('BM25 检索：命中词加权 + 归一化', () => {
    const tfidf = new TFIDF();
    tfidf.build([
      { path: 'a.md', text: '深度 学习 深度 学习 深度' },
      { path: 'b.md', text: '美食 烹饪' },
      { path: 'c.md', text: '学习 笔记' },
    ]);
    const r = tfidf.search('学习', 10);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].path).toBe('a.md');
    expect(r[0].score).toBe(1);
    // a.md 命中的是 '学习'（非停用词）✓
  });

  it('空文档集 avgDl=1 不除零', () => {
    const tfidf = new TFIDF();
    tfidf.build([]);
    expect(tfidf.avgDl).toBe(1);
    expect(tfidf.search('x')).toEqual([]);
  });
});
