// @vitest-environment node
/**
 * 第二大脑纯函数测试（ticket 103 重写对齐）：chunk/vptree/text-search/tfidf/context/parallel
 * 口径要点：smartChunk 空行分段聚合（非全文句界顺序拼接）；vptree_search 无累加器新签名；
 * searchTextIndex(query, notes, topK) 直接评分扫描；getCurrentContext 句界含分号/省略号。
 * ticket 110：stripFrontmatter/embedChunks——YAML 头不进任何 chunk、标题并入首块。
 */
import { describe, it, expect } from 'vitest';
import { euclideanSq, normalizeVec, vptree_build, vptree_search } from '../../src/secondbrain/vptree';
import { smartChunk, CHUNK_SIZE, stripFrontmatter, embedChunks, noteTitleFromPath } from '../../src/secondbrain/chunk';
import { STOP_WORDS, extractTerms, searchTextIndex } from '../../src/secondbrain/text-search';
import { TFIDF, TFIDF_STOP_WORDS } from '../../src/secondbrain/tfidf';
import { getCurrentContext } from '../../src/secondbrain/context';
import { parallelMap } from '../../src/secondbrain/parallel';

describe('smartChunk', () => {
  it('空行分段聚合：块间以 \n 连接，段落边界保留', () => {
    const p1 = '甲'.repeat(60);
    const p2 = '乙'.repeat(60);
    const p3 = '丙'.repeat(60);
    const chunks = smartChunk(`${p1}\n\n${p2}\n\n${p3}`, 50);
    expect(chunks).toEqual([`${p1}\n${p2}\n${p3}`]);
    expect(chunks[0].length).toBeLessThanOrEqual(CHUNK_SIZE);
  });

  it('超长段按句界 [。！？!?\\n]+ 再切；大段 flush 后清空 buffer，后续小段不重复拼接', () => {
    const small = '丁'.repeat(60);
    const h1 = '戊'.repeat(200);
    const h2 = '己'.repeat(200);
    const tiny = '短尾块只有十字';
    const chunks = smartChunk([small, `${h1}。${h2}。`, tiny].join('\n\n'), 50);
    // 旧版缺陷：huge 段处理后 buffer 残留 → tiny 会拼在旧 buffer 后重复入索引
    expect(chunks).toEqual([small, h1, h2]);
    expect(chunks.some((c) => c.includes(tiny))).toBe(false); // 尾块 < minChunk 被丢弃
  });

  it('超长双句段切成两个 ≤256 的块', () => {
    const s1 = '甲'.repeat(130);
    const s2 = '乙'.repeat(130);
    const chunks = smartChunk(`${s1}。${s2}。`, 50);
    expect(chunks).toEqual([s1, s2]);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(256);
  });

  it('空文本/纯空白返回 []（空文件回退首 256 字由调用方负责）', () => {
    expect(smartChunk('', 50)).toEqual([]);
    expect(smartChunk('  \n\n   ', 50)).toEqual([]);
    expect(smartChunk('短文本', 50)).toEqual([]);
  });
});

describe('stripFrontmatter / embedChunks（ticket 110 切块剥离 frontmatter）', () => {
  const FM = '---\nreviewStart: 2026-08-01\nreviewStage: 3\nurl: https://example.com/post\n---\n';
  const b1 = '记忆依据图式构建。'.repeat(15); // 135 字：单独成块
  const b2 = '实验证据支持这一结论。'.repeat(12); // 132 字：与 b1 聚合超 CHUNK_SIZE → 独立成块

  it('stripFrontmatter：剥去开头 --- 界定块；未闭合/非 --- 开头原样返回；容忍 CRLF 与文末无换行闭合', () => {
    expect(stripFrontmatter(`${FM}正文第一段。`)).toBe('正文第一段。');
    expect(stripFrontmatter(`---\na: 1\n---\n\n正文`)).toBe('\n正文'); // 保留正文前空行结构
    // 未闭合（如首行分隔线 + 后文无独占行 ---）：不视为 frontmatter
    expect(stripFrontmatter('---\n甲乙丙丁\n\n正文内容')).toBe('---\n甲乙丙丁\n\n正文内容');
    expect(stripFrontmatter('普通正文没有头部')).toBe('普通正文没有头部');
    expect(stripFrontmatter('---\na: 1\n---')).toBe(''); // 闭合 --- 在文末（无换行）
    expect(stripFrontmatter('---\r\na: 1\r\n---\r\n正文')).toBe('正文');
  });

  it('embedChunks：YAML 头与样板字段不进任何 chunk（验收 a）', () => {
    const chunks = embedChunks(`${FM}${b1}\n\n${b2}`, '幽灵之战', 10);
    expect(chunks).toHaveLength(2);
    for (const c of chunks) {
      expect(c).not.toContain('reviewStart');
      expect(c).not.toContain('reviewStage');
      expect(c).not.toContain('https://example.com');
      expect(c).not.toContain('---');
    }
    expect(chunks[0]).toContain(b1);
    expect(chunks[1]).toBe(b2);
  });

  it('embedChunks：笔记标题并入首块保留主题信号（验收 b）', () => {
    const chunks = embedChunks(`${FM}${b1}\n\n${b2}`, '幽灵之战', 10);
    expect(chunks[0].startsWith('幽灵之战\n')).toBe(true);
    expect(chunks[0]).toContain(b1); // 标题只加前缀，不挤掉正文
    // 无 frontmatter 的普通笔记同样带标题
    expect(embedChunks('单一短块的正文内容足够长了吧。', '短卡', 10)[0].startsWith('短卡\n')).toBe(true);
  });

  it('embedChunks：纯 frontmatter 无正文 → 返回 [] 不入索引；短正文兜底截断块同样带标题', () => {
    expect(embedChunks(FM, '任意标题', 10)).toEqual([]);
    expect(embedChunks('微短正文', '短卡', 50)).toEqual(['短卡\n微短正文']);
  });

  it('noteTitleFromPath：子目录取 basename 去 .md', () => {
    expect(noteTitleFromPath('卡片盒/次卡片盒/幽灵之战：记忆依据图式构建.md')).toBe('幽灵之战：记忆依据图式构建');
    expect(noteTitleFromPath('README.md')).toBe('README');
    expect(noteTitleFromPath('我的/日记/2026-08-01.md')).toBe('2026-08-01');
  });
});

describe('vptree', () => {
  it('euclideanSq 接受 number[] 与 Float32Array', () => {
    expect(euclideanSq([0, 0], [3, 4])).toBe(25);
    expect(euclideanSq(Float32Array.from([0, 0]), [3, 4])).toBe(25);
    expect(euclideanSq([0, 0], Float32Array.from([3, 4]))).toBe(25);
  });

  it('normalizeVec 返回新数组且不改入参；零向量返回副本', () => {
    const src = [3, 4];
    const n = normalizeVec(src);
    expect(src).toEqual([3, 4]); // 入参不被原地修改
    expect(n).not.toBe(src);
    expect(n[0]).toBeCloseTo(0.6, 10);
    expect(n[1]).toBeCloseTo(0.8, 10);
    expect(normalizeVec([0, 0])).toEqual([0, 0]);
  });

  it('build + search（无第 5 参的新签名）返回升序 best-k', () => {
    const items = [
      [0, 0],
      [1, 0],
      [0, 1],
      [10, 10],
    ];
    const tree = vptree_build(items, items.map((_, i) => i));
    const r = vptree_search(tree, items, [0.1, 0.1], 2);
    expect(r).toHaveLength(2);
    expect(r[0].idx).toBe(0); // 最近
    for (let i = 1; i < r.length; i++) expect(r[i].dist).toBeGreaterThanOrEqual(r[i - 1].dist);
  });

  it('mu/minD/maxD 包络剪枝不漏点：大 k 全量结果与树节点枚举一致（QA 同构：vp 复制进子树）', () => {
    const items = [
      [0, 0],
      [1, 1],
      [2, 0],
      [0, 2],
      [5, 5],
      [-3, 4],
      [4, -1],
      [-1, -1],
      [10, 0],
      [0, 10],
      [3, 3],
      [-4, -2],
    ];
    const tree = vptree_build(items, items.map((_, i) => i));
    // 与 QA 一致的实现会把 vp 节点复制进自己的子树（节点数 > 元素数），
    // 故正确性基准取「树节点全枚举」而非元素去重集。
    const enumAll = (n: typeof tree, q: number[]): { idx: number; dist: number }[] =>
      n
        ? [
            { idx: n.idx, dist: euclideanSq(q, items[n.idx]) },
            ...enumAll(n.left, q),
            ...enumAll(n.right, q),
          ]
        : [];
    const canon = (arr: { idx: number; dist: number }[]) =>
      arr.map((r) => ({ idx: r.idx, dist: r.dist })).sort((a, b) => a.dist - b.dist || a.idx - b.idx);
    for (const q of [[0.5, 0.5], [9, 9], [-4, -3], [2, -1]]) {
      const got = vptree_search(tree, items, q, 999); // k 超过节点数 → 全树遍历不剪枝
      const want = enumAll(tree, q);
      expect(canon(got)).toEqual(canon(want)); // 每个节点的 (idx, dist) 完整且升序可达
      const nearest = vptree_search(tree, items, q, 1)[0];
      expect(nearest.dist).toBe(Math.min(...want.map((r) => r.dist))); // 最近邻不丢
    }
  });

  it('空树：build 返回 null、search 返回 []', () => {
    expect(vptree_build([], [])).toBeNull();
    expect(vptree_search(null, [], [], 5)).toEqual([]);
  });
});

describe('extractTerms / searchTextIndex', () => {
  it('STOP_WORDS 是 Set（旧版字符串表已废弃）', () => {
    expect(STOP_WORDS).toBeInstanceOf(Set);
    expect(STOP_WORDS.has('的')).toBe(true);
    expect(STOP_WORDS.size).toBe(29);
  });

  it('CJK 逐字 + 英文 ≥2 字母词，停用词过滤；全空回退整串小写', () => {
    const t = extractTerms('这是一个测试 hello World');
    expect(t).toContain('测');
    expect(t).toContain('试');
    expect(t).not.toContain('这'); // 停用词
    expect(t).toContain('hello');
    expect(t).toContain('world');
    expect(extractTerms('!?')).toEqual(['!?']); // 无有效词 → 回退整串小写
    expect(extractTerms('ABC')).toEqual(['abc']);
  });

  it('精确子串命中：score = 0.7 + 0.3×min(1, qlen/textlen)', () => {
    const notes = {
      'a.md': { chunks: [{ text: '机器学习是人工智能的一个重要分支，本文系统介绍其核心概念与方法论。' }] },
    };
    const r = searchTextIndex('机器学习', notes, 5);
    expect(r).toHaveLength(1);
    const text = notes['a.md'].chunks[0].text;
    expect(r[0].score).toBeCloseTo(0.7 + 0.3 * Math.min(1, 4 / text.length), 10);
  });

  it('词命中路径：命中率×0.5 + min(1,avgFreq/5)×0.25 + density×0.25', () => {
    // 文本 23 字 ≥20 无惩罚；四词各出现 2 次 → 0.5 + (2/5)×0.25 + 1×0.25 = 0.85
    const notes = { 'a.md': { chunks: [{ text: '深度学习入门教程深度学习实战与更多内容补充说明' }] } };
    const r = searchTextIndex('学习深度', notes, 5);
    expect(r[0].score).toBeCloseTo(0.85, 10);
  });

  it('text.length<20 时得分 ×0.7 惩罚', () => {
    const r = searchTextIndex('机器学习', { 'a.md': { chunks: [{ text: '机器学习真棒' }] } }, 5);
    // 子串命中 0.7+0.3×(4/6)=0.9 → ×0.7
    expect(r[0].score).toBeCloseTo(0.63, 10);
  });

  it('阈值 >0.25：低重叠命中被过滤', () => {
    // 命中率 0.1×0.5 + 频次 0.2×0.25 + 密度 0.1×0.25 = 0.125 ≤ 0.25 → 不返回
    const notes = { 'a.md': { chunks: [{ text: '甲' + '水'.repeat(99) }] } };
    expect(searchTextIndex('甲乙丙丁戊己庚辛壬癸', notes, 5)).toEqual([]);
  });

  it('path::chunk 去重：同笔记同文本的多块只留一条', () => {
    const dup = '重复内容片段示例文本';
    const r = searchTextIndex('重复内容', { 'a.md': { chunks: [{ text: dup }, { text: dup }] } }, 5);
    expect(r).toHaveLength(1);
    expect(r[0].chunk).toBe(dup); // 返回命中 chunk 原文
  });

  it('空查询 / 空 notes 返回空', () => {
    expect(searchTextIndex('', { 'a.md': { chunks: [{ text: '内容' }] } }, 5)).toEqual([]);
    expect(searchTextIndex('任意', {}, 5)).toEqual([]);
  });
});

describe('TFIDF（BM25 k1=1.5 b=0.75，chunk 粒度文档）', () => {
  it('停用词表保持独立（44 字版源码原样）', () => {
    expect(TFIDF_STOP_WORDS).toBe('的了是在我有和人这中大为上个国不以到说时要就出会也年对自其他里去子后也得着与把等');
    expect(TFIDF_STOP_WORDS.length).toBe(40);
    expect(STOP_WORDS.has(TFIDF_STOP_WORDS[0])).toBe(true); // 与 35 字表有交集但各自保留
  });

  it('search 返回 {path, chunk, score}，chunk 为原文且最高分归一化', () => {
    const tfidf = new TFIDF();
    const docA = '深度 学习 深度 学习 深度';
    tfidf.build([
      { path: 'a.md', text: docA },
      { path: 'b.md', text: '美食 烹饪' },
      { path: 'c.md', text: '学习 笔记' },
    ]);
    const r = tfidf.search('学习', 10);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].path).toBe('a.md');
    expect(r[0].chunk).toBe(docA); // 新增 chunk 字段回归
    expect(r[0].score).toBe(1);
  });

  it('chunk 粒度：同篇两块各自作为独立文档参与检索', () => {
    const tfidf = new TFIDF();
    const c1 = '机器学习算法的原理介绍与推导过程说明';
    tfidf.build([
      { path: 'a.md', text: c1 },
      { path: 'a.md', text: '红烧肉烹饪方法与家常菜谱步骤' },
      { path: 'b.md', text: '深度学习与神经网络训练入门' },
    ]);
    const r = tfidf.search('机器学习', 5);
    expect(r).toHaveLength(2); // 无重叠的烹饪块不参与结果
    expect(r[0].path).toBe('a.md');
    expect(r[0].chunk).toBe(c1); // 命中的是 a.md 中特定 chunk 而非整篇
  });

  it('空文档集 avgDl=1 不除零；空查询/全停用词查询返回空', () => {
    const empty = new TFIDF();
    empty.build([]);
    expect(empty.N).toBe(0);
    expect(empty.avgDl).toBe(1);
    expect(empty.search('任意')).toEqual([]);
    const tfidf = new TFIDF();
    tfidf.build([{ path: 'a.md', text: '正常内容' }]);
    expect(tfidf.search('')).toEqual([]);
    expect(tfidf.search('的了是')).toEqual([]);
  });
});

describe('getCurrentContext', () => {
  function ed(lines: string[], line: number, ch: number): any {
    return { getCursor: () => ({ line, ch }), getLine: (i: number) => lines[i] };
  }

  it('向前找最近句界、向后包含收尾句界符（end=i+1）', () => {
    expect(getCurrentContext(ed(['甲。乙丙。丁'], 0, 3))).toBe('乙丙。');
  });

  it('句界集含中文分号/半角分号/省略号（旧版缺这三者）', () => {
    const lines = ['甲；乙;丙…丁'];
    expect(getCurrentContext(ed(lines, 0, 3))).toBe('乙;'); // 中文分号作前界、半角分号收尾
    expect(getCurrentContext(ed(lines, 0, 4))).toBe('丙…'); // 半角分号作前界、省略号收尾
  });

  it('当前行整行空白才回退上一行尾 300 字（「<2 字回退」已废）', () => {
    const prev = '前'.repeat(500);
    expect(getCurrentContext(ed([prev, '   '], 1, 0))).toBe('前'.repeat(300));
  });

  it('上一行也空白或编辑器为空 → 空串', () => {
    expect(getCurrentContext(ed(['  ', ''], 1, 0))).toBe('');
    expect(getCurrentContext(ed([''], 0, 0))).toBe('');
    expect(getCurrentContext(null)).toBe('');
  });

  it('剪出的句子修剪后为空 → 回退整行', () => {
    // 光标前是句界、其后到行尾只有空白（无收尾句界）→ 剪出纯空白 → 回退整行
    expect(getCurrentContext(ed(['。   '], 0, 1))).toBe('。');
  });
});

describe('parallelMap', () => {
  it('结果数组按输入顺序排列（与完成顺序无关）', async () => {
    const results = await parallelMap([1, 2, 3, 4, 5], 3, async (n, i) => {
      await new Promise((r) => setTimeout(r, 50 - i * 10)); // 越靠后越先完成
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it('单任务失败以 { error } 占位，不中断整批', async () => {
    const results = await parallelMap([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    });
    expect(results[0]).toBe(1);
    expect(results[1]).toEqual({ error: 'boom' });
    expect(results[2]).toBe(3);
  });

  it('任务数少于初始并发时不增发：一次性全部发出即止', async () => {
    const started: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const p = parallelMap(
      [1, 2, 3],
      10,
      async (n) => {
        started.push(n);
        await gate;
        return n;
      }
    );
    await Promise.resolve();
    expect([...started].sort()).toEqual([1, 2, 3]); // 初始并发 10 ≥ 任务数 → 全部立即启动，无多余派发
    release();
    expect(await p).toEqual([1, 2, 3]);
  });
});
