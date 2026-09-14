// @vitest-environment node
/**
 * 挂载树白板 · 纯函数层测试（issues 317 / 319）
 *
 * 只覆盖不碰 DOM 的部分（node 环境）：`insertLinkAtAnchor`（唯一允许改正文的加工）、
 * 面包屑链、血缘集合、缩放钳制、状态文案、双链文本、锚点匹配串。
 * 渲染 / 交互（遮罩、六类节点、右键菜单、缩放器、入口）见 mount-canvas.test.ts。
 */
import { describe, it, expect } from 'vitest';
import {
  anchorNeedles,
  clampMountScale,
  crumbTrail,
  insertLinkAtAnchor,
  lineageOf,
  mountKindLabel,
  mountLinkText,
  mountStatusText,
} from '../../src/knowledge/mount-canvas';
import type { AnchorRef, MountEdge, MountNode } from '../../src/knowledge/mount-types';

function anchor(text: string): AnchorRef {
  return { from: 0, to: text.length, text };
}

function node(part: Partial<MountNode> & { id: string }): MountNode {
  return {
    path: part.id,
    title: part.id,
    kind: 'card',
    source: 'link',
    depth: 0,
    anchor: null,
    missing: false,
    suggested: false,
    attached: false,
    parent: null,
    body: null,
    ...part,
  } as MountNode;
}

describe('insertLinkAtAnchor（固定：锚点处写双链）', () => {
  it('精确重定位：紧随锚点文本之后插入 [[目标]]', () => {
    const body = '第一句。注意力机制很重要。第三句。';
    const out = insertLinkAtAnchor(body, anchor('注意力机制很重要。'), '自注意力机制');
    expect(out).toBe('第一句。注意力机制很重要。[[自注意力机制]]第三句。');
  });

  it('去空白重定位：跨行锚点也能落点（relocateAnchor 的兜底档）', () => {
    const body = '前面一句。\n注意力机制\n很重要。后面。';
    const out = insertLinkAtAnchor(body, anchor('注意力机制很重要。'), '注意力机制');
    expect(out).toContain('[[注意力机制]]');
    expect(out.startsWith('前面一句。')).toBe(true);
  });

  it('前缀兜底：锚点文本含双链（清洗后对不上）→ 用句首前缀找句读后插入', () => {
    const body = '句子里有[[自注意力机制|注意力]]这个词。后面还有别的。';
    const out = insertLinkAtAnchor(body, anchor('句子里有注意力这个词。'), 'Transformer');
    expect(out).toBe('句子里有[[自注意力机制|注意力]]这个词。[[Transformer]]后面还有别的。');
  });

  it('都找不到 → 追加正文末尾（前置换行）', () => {
    const body = '正文一段，和锚点完全无关。';
    const out = insertLinkAtAnchor(body, anchor('这句话不在正文里出现'), '某卡');
    expect(out).toBe('正文一段，和锚点完全无关。\n[[某卡]]\n');
  });

  it('锚点为 null / 空正文 → 直接追加（不抛错）', () => {
    expect(insertLinkAtAnchor('', null, '某卡')).toBe('[[某卡]]\n');
    expect(insertLinkAtAnchor('正文。', null, '某卡')).toBe('正文。\n[[某卡]]\n');
  });

  it('幂等：目标已是双链（本体 / 别名 / 子路径）→ 原样返回，不重复插', () => {
    const a = '正文里已有 [[某卡]] 了。';
    const b = '正文里已有 [[某卡|别名]] 了。';
    const c = '正文里已有 [[某卡#标题]] 了。';
    expect(insertLinkAtAnchor(a, anchor('正文里已有'), '某卡')).toBe(a);
    expect(insertLinkAtAnchor(b, anchor('正文里已有'), '某卡')).toBe(b);
    expect(insertLinkAtAnchor(c, anchor('正文里已有'), '某卡')).toBe(c);
  });

  it('写出去的目标去 .md 后缀；空目标原样返回', () => {
    expect(insertLinkAtAnchor('正文。', null, '卡片盒/某卡.md')).toBe('正文。\n[[卡片盒/某卡]]\n');
    expect(insertLinkAtAnchor('正文。', null, '')).toBe('正文。');
  });

  it('frontmatter 原样保留（调用方整篇传入）', () => {
    const body = '---\ntitle: "主卡"\nrelated:\n  - "[[甲]]"\n---\n\n正文一句话。';
    const out = insertLinkAtAnchor(body, anchor('正文一句话。'), '乙卡');
    expect(out.startsWith('---\ntitle: "主卡"\nrelated:\n  - "[[甲]]"\n---\n\n')).toBe(true);
    expect(out).toContain('正文一句话。[[乙卡]]');
  });
});

describe('crumbTrail（面包屑：沿 parent 上溯到主卡）', () => {
  const nodes: MountNode[] = [
    node({ id: '卡片盒/主卡.md', parent: null, depth: 0 }),
    node({ id: '卡片盒/甲.md', parent: '卡片盒/主卡.md', depth: 1 }),
    node({ id: '文献盒/甲.md', parent: '卡片盒/甲.md', depth: 2, attached: true, source: 'sameName' }),
  ];

  it('末端节点 → 主卡链（含吸附的文献）', () => {
    expect(crumbTrail(nodes, '文献盒/甲.md').map((n) => n.id)).toEqual([
      '卡片盒/主卡.md',
      '卡片盒/甲.md',
      '文献盒/甲.md',
    ]);
  });

  it('未选中（null）/ 不在树上 → 空链（调用方回退到主卡）', () => {
    expect(crumbTrail(nodes, null)).toEqual([]);
    expect(crumbTrail(nodes, '不在树上')).toEqual([]);
  });

  it('parent 成环也必然终止', () => {
    const cyc = [node({ id: 'a', parent: 'b' }), node({ id: 'b', parent: 'a' })];
    expect(crumbTrail(cyc, 'a').map((n) => n.id)).toEqual(['b', 'a']);
  });
});

describe('lineageOf（血缘集合：祖先 / 后代）', () => {
  const edges: MountEdge[] = [
    { from: 'root', to: 'a', suggested: false },
    { from: 'a', to: 'b', suggested: false },
    { from: 'root', to: 'c', suggested: true },
  ];

  it('祖先链 + 后代子树（自身计入两者，与原型 relSets 同口径）', () => {
    const { anc, desc } = lineageOf(edges, 'a');
    expect([...anc].sort()).toEqual(['a', 'root']);
    expect([...desc].sort()).toEqual(['a', 'b']);
  });

  it('叶子节点：后代只有自己', () => {
    const { anc, desc } = lineageOf(edges, 'c');
    expect([...desc]).toEqual(['c']);
    expect([...anc].sort()).toEqual(['c', 'root']);
  });

  it('空边集 / 不存在的节点：只有自身', () => {
    expect([...lineageOf([], 'x').anc]).toEqual(['x']);
    expect([...lineageOf(edges, 'zzz').desc]).toEqual(['zzz']);
  });
});

describe('展示口径：缩放钳制 / 状态文案 / 双链文本 / 锚点匹配串', () => {
  it('缩放钳制在 0.3 ~ 2.5（NaN 回 1）', () => {
    expect(clampMountScale(0.01)).toBe(0.3);
    expect(clampMountScale(9)).toBe(2.5);
    expect(clampMountScale(1.25)).toBe(1.25);
    expect(clampMountScale(Number.NaN)).toBe(1);
  });

  it('建议状态文案（含两种降级与开关关闭，不冒充已缓存）', () => {
    expect(mountStatusText('cached')).toBe('已缓存建议');
    expect(mountStatusText('fresh')).toBe('新生成建议');
    expect(mountStatusText('off')).toBe('自动建议已关闭');
    expect(mountStatusText('no-index')).toBe('未建向量索引 · 只画双链');
    expect(mountStatusText('no-ai')).toBe('AI 不可用 · 只画双链');
    expect(mountStatusText('generating')).toContain('生成中');
  });

  it('双链文本：卡片 / 整篇去 .md；head/para 带子路径；图与视频走嵌入', () => {
    expect(mountLinkText(node({ id: '卡片盒/甲.md', kind: 'card' }))).toBe('[[卡片盒/甲]]');
    expect(mountLinkText(node({ id: '文献盒/乙.md', kind: 'note' }))).toBe('[[文献盒/乙]]');
    expect(mountLinkText(node({ id: '文献盒/乙.md#小节', kind: 'head' }))).toBe('[[文献盒/乙.md#小节]]');
    expect(mountLinkText(node({ id: '附件/图.png', kind: 'image' }))).toBe('![[附件/图.png]]');
    expect(mountLinkText(node({ id: '附件/片.mp4', kind: 'video' }))).toBe('![[附件/片.mp4]]');
  });

  it('失效节点用原始目标文本复制（id 已是原文）', () => {
    expect(mountLinkText(node({ id: '不存在', path: '不存在', kind: 'card', missing: true }))).toBe('[[不存在]]');
  });

  it('形态短名六类齐备', () => {
    expect(['note', 'head', 'para', 'image', 'video', 'card'].map((k) => mountKindLabel(k as never))).toEqual([
      '整篇',
      '标题',
      '段落',
      '图片',
      '视频',
      '卡片',
    ]);
  });

  it('锚点匹配串：双链原文 + 显示文本（渲染后 DOM 里只剩显示文本）', () => {
    expect(anchorNeedles(anchor('[[文献盒/乙.md|乙篇]]'))).toEqual(['[[文献盒/乙.md|乙篇]]', '乙篇']);
    expect(anchorNeedles(anchor('普通句子。'))).toEqual(['普通句子。']);
    expect(anchorNeedles(null)).toEqual([]);
  });
});
