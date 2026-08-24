// @vitest-environment node
/**
 * 附件搬移域数据层测试（ticket 65）。
 * 注：链接更新已交给 Obsidian 内建 fileManager.renameFile（ADR-0014），
 * 本层只测「解析引用 / 解析目标 / 收集资源 / 去重命名」。
 */
import { describe, it, expect } from 'vitest';
import { parseLinkRefs, resolveTarget, collectResources, planMoves } from '../../src/attach/data';

describe('parseLinkRefs', () => {
  it('解析 wikilink 嵌入/链接，含别名与标题/块锚点后缀', () => {
    const refs = parseLinkRefs('![[img.png]] + [[a.png|alt]] + [[folder/b.png#图]] + [[c.png^ref]]');
    expect(refs).toHaveLength(4);
    expect(refs[0]).toMatchObject({ kind: 'wiki', embeds: true, target: 'img.png', extra: '', raw: '![[img.png]]' });
    expect(refs[1]).toMatchObject({ kind: 'wiki', embeds: false, target: 'a.png', extra: '|alt' });
    expect(refs[2]).toMatchObject({ kind: 'wiki', embeds: false, target: 'folder/b.png', extra: '#图' });
    expect(refs[3]).toMatchObject({ kind: 'wiki', embeds: false, target: 'c.png', extra: '^ref' });
  });

  it('解析 Markdown 链接/嵌入', () => {
    const refs = parseLinkRefs('![alt](assets/x.png) 与 [文档](files/a.pdf)');
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({ kind: 'md', embeds: true, target: 'assets/x.png', extra: 'alt' });
    expect(refs[1]).toMatchObject({ kind: 'md', embeds: false, target: 'files/a.pdf', extra: '文档' });
  });
});

describe('resolveTarget', () => {
  const files = ['a/img.png', 'a/note.md', 'notes/x.png', 'notes/dir/imgs/p.png', 'b/foo.png', 'z/other.png'];
  it('精确路径', () => {
    expect(resolveTarget(files, 'a/img.png', 'any.md', 'wiki')).toBe('a/img.png');
  });
  it('扩展名推断', () => {
    expect(resolveTarget(files, 'a/img', 'any.md', 'wiki')).toBe('a/img.png');
  });
  it('相对源目录（..）', () => {
    expect(resolveTarget(files, '../x.png', 'notes/dir/章.md', 'md')).toBe('notes/x.png');
  });
  it('md 链接无前缀相对源目录', () => {
    expect(resolveTarget(files, 'imgs/p.png', 'notes/dir/章.md', 'md')).toBe('notes/dir/imgs/p.png');
  });
  it('库内唯一 basename（wikilink 最短路径语义）', () => {
    expect(resolveTarget(files, 'foo', 'any.md', 'wiki')).toBe('b/foo.png');
  });
  it('同 basename 多处 → 优先当前笔记同目录', () => {
    const dup = ['a/foo.png', 'b/foo.png'];
    expect(resolveTarget(dup, 'foo', 'a/章.md', 'wiki')).toBe('a/foo.png');
    expect(resolveTarget(dup, 'foo', 'x.md', 'wiki')).toBeNull();
  });
  it('外链 / 不存在 → null', () => {
    expect(resolveTarget(files, 'https://x/y.png', 'any.md', 'md')).toBeNull();
    expect(resolveTarget(files, 'noexist.png', 'any.md', 'wiki')).toBeNull();
  });
});

describe('collectResources', () => {
  it('只收集引用的非 .md 文件，跳过 .md 与外链', () => {
    const files = ['img.png', 'files/note.md', 'note2.md', 'doc.pdf', 'a.gif'];
    const content = '![[img.png]]\n![alt](files/note.md)\n[[note2]]\n![](https://x/y.png)\n[[doc.pdf]]\n嵌入 ![[a.gif]]';
    expect(collectResources(content, files, 'n.md').sort()).toEqual(['a.gif', 'doc.pdf', 'img.png']);
  });
});

describe('planMoves', () => {
  it('无同名冲突直接移动', () => {
    expect(planMoves(['a/img.png'], '附件', ['a/img.png', 'n.md'])).toEqual([
      { fromPath: 'a/img.png', toPath: '附件/img.png', toName: 'img.png', renamed: false },
    ]);
  });
  it('目标已有同名才改名', () => {
    expect(planMoves(['b/img.png'], '附件', ['b/img.png', '附件/img.png', 'n.md'])).toEqual([
      { fromPath: 'b/img.png', toPath: '附件/img (1).png', toName: 'img (1).png', renamed: true },
    ]);
  });
  it('已在目标文件夹 → 跳过', () => {
    expect(planMoves(['附件/img.png'], '附件', ['附件/img.png', 'n.md'])).toHaveLength(0);
  });
  it('两个同名源依次去重', () => {
    expect(planMoves(['a/x.png', 'b/x.png'], '附件', ['a/x.png', 'b/x.png', 'n.md']).map((m) => m.toName)).toEqual([
      'x.png',
      'x (1).png',
    ]);
  });
  it('冲突号递增到可用', () => {
    expect(planMoves(['a/x.png'], '附件', ['a/x.png', '附件/x.png', '附件/x (1).png', 'n.md'])[0].toName).toBe('x (2).png');
  });
});