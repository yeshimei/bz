// @vitest-environment node
/**
 * 附件搬移域数据层测试（ticket 65）。
 * 注：链接更新已交给 Obsidian 内建 fileManager.renameFile（ADR-0014），
 * 本层只测「解析引用 / 解析目标 / 收集资源 / 去重命名」。
 */
import { describe, it, expect } from 'vitest';
import { parseLinkRefs, resolveTarget, collectResources, collectResourcesCached, planMoves, stripNonLinkSegments } from '../../src/attach/data';

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

  it('md 链接百分号编码解码后再解析（P2 审查修复：含空格文件名 %20）', () => {
    const spaced = ['notes/My Image.png', 'notes/章.md'];
    expect(resolveTarget(spaced, 'My%20Image.png', 'notes/章.md', 'md')).toBe('notes/My Image.png');
    // 相对形式同样先解码
    expect(resolveTarget(spaced, './My%20Image.png', 'notes/章.md', 'md')).toBe('notes/My Image.png');
    // 带子目录的编码串
    expect(resolveTarget(['a/视频 2024.mp4'], 'a/%E8%A7%86%E9%A2%91%202024.mp4', 'any.md', 'md')).toBe(
      'a/视频 2024.mp4'
    );
  });

  it('wiki 链接不解码（无百分号编码语义）；解码后无命中回退原串', () => {
    const literal = ['a/My%20Image.png'];
    // wiki：原样解析字面 % 文件名
    expect(resolveTarget(literal, 'My%20Image.png', 'any.md', 'wiki')).toBe('a/My%20Image.png');
    // md：解码后无命中（库里是字面 % 文件名）→ 回退原串命中
    expect(resolveTarget(literal, 'My%20Image.png', 'any.md', 'md')).toBe('a/My%20Image.png');
  });

  it('非法编码序列（裸 %）不抛错，按原串解析', () => {
    const bare = ['a/100%.png'];
    expect(resolveTarget(bare, '100%.png', 'any.md', 'md')).toBe('a/100%.png');
    expect(resolveTarget([], '100%.png', 'any.md', 'md')).toBeNull();
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
  it('AT1 常态口径：冲突集含文件夹路径——目标同名（子）文件夹占位时同样改名避让', () => {
    // allPaths 里的 '附件/a.png' 既可能是文件也可能是文件夹路径（listAllFilePaths 混入），
    // planMoves 一视同仁避让——此前只含文件时 renameFile 撞文件夹抛错计失败
    const ops = planMoves(['n/a.png'], '附件', ['n/a.png', '附件/a.png']);
    expect(ops).toEqual([{ fromPath: 'n/a.png', toPath: '附件/a (1).png', toName: 'a (1).png', renamed: true }]);
  });
});

describe('stripNonLinkSegments（AF-1 围栏/注释剥离单源）', () => {
  it('fenced code（``` 与 ~~~）整段剥离', () => {
    expect(stripNonLinkSegments('前\n```\n![[a.png]]\n```\n后 [[b.png]]')).toBe('前\n\n后 [[b.png]]');
    expect(stripNonLinkSegments('前\n~~~\n[[t.png]]\n~~~\n后')).toBe('前\n\n后');
    // 缩进围栏与未闭合围栏（到文末）
    expect(stripNonLinkSegments('  ```\n![[a.png]]')).not.toContain('![[a.png]]');
  });
  it('inline code 成对反引号段剥离；孤立反引号保留', () => {
    const out = stripNonLinkSegments('`![[c.png]]` 与 [[b.png]]');
    expect(out).not.toContain('![[c.png]]');
    expect(out).toContain('与 [[b.png]]');
    expect(stripNonLinkSegments('`` `[[x.png]]` `` 尾')).not.toContain('[[x.png]]');
    expect(stripNonLinkSegments("it's [[b.png]]")).toContain('[[b.png]]');
  });
  it('HTML 注释整段剥离（跨行）', () => {
    expect(stripNonLinkSegments('<!-- ![[a.png]] -->\n[[b.png]]')).toBe('\n[[b.png]]');
    expect(stripNonLinkSegments('前 <!-- 多行\n![[a.png]]\n注释 --> 后 [[b.png]]')).toContain('[[b.png]]');
  });
  it('frontmatter 段保留（frontmatter 链接是真机 cache 承认的真引用）', () => {
    const fm = '---\ntitle: 笔记\nbanner: "[[fm图.png]]"\n---\n正文 ![[真.png]]';
    expect(stripNonLinkSegments(fm)).toContain('[[fm图.png]]');
    expect(stripNonLinkSegments(fm)).toContain('![[真.png]]');
  });
});

describe('AF-1：代码块/HTML 注释内引用不收集（正则兜底口径）', () => {
  const files = ['模板图.png', '真.png', 'c.png', '内联.png', 'fm图.png', 't.png', 'a.png'];
  it('fenced code 内 ![[x.png]] 不收集、正文真引用照常收集', () => {
    const out = collectResources('示例：\n```\n![[模板图.png]]\n```\n完 ![[真.png]]', files, 'n.md');
    expect(out).toEqual(['真.png']);
  });
  it('inline code 内引用不收集', () => {
    expect(collectResources('`![[内联.png]]` 与 ![[真.png]]', files, 'n.md')).toEqual(['真.png']);
  });
  it('HTML 注释内引用不收集', () => {
    expect(collectResources('<!-- ![[c.png]] --> ![[真.png]]', files, 'n.md')).toEqual(['真.png']);
  });
  it('frontmatter 内链接仍收集', () => {
    const fm = '---\nbanner: "[[fm图.png]]"\n---\n正文 ![[真.png]]';
    expect(collectResources(fm, files, 'n.md').sort()).toEqual(['fm图.png', '真.png']);
  });
  it('混合场景收集集恰为正文真引用集（~~~ 围栏 + inline + 注释 + 正文）', () => {
    const content = [
      '---',
      'banner: "[[fm图.png]]"',
      '---',
      '![[真.png]] 与 [[a.png]]',
      '~~~',
      '[[t.png]]',
      '~~~',
      '`![[内联.png]]`',
      '<!-- ![[c.png]] -->',
    ].join('\n');
    expect(collectResources(content, files, 'n.md').sort()).toEqual(['a.png', 'fm图.png', '真.png']);
  });
});

describe('AF-2：链接解析大小写不敏感档（Obsidian 链接解析语义）', () => {
  it('精确大小写敏感优先命中', () => {
    expect(resolveTarget(['a.png', 'A.png'], 'a.png', 'n.md', 'wiki')).toBe('a.png');
    expect(resolveTarget(['a.png', 'A.png'], 'A.png', 'n.md', 'wiki')).toBe('A.png');
  });
  it('大小写不同形未精确命中 → 不敏感档唯一命中', () => {
    expect(resolveTarget(['img.png'], 'IMG.PNG', 'n.md', 'wiki')).toBe('img.png');
    expect(resolveTarget(['a/Photo.PNG'], 'photo.png', 'n.md', 'md')).toBe('a/Photo.PNG');
  });
  it('扩展名推断不敏感档：[[IMG]] → img.png', () => {
    expect(resolveTarget(['img.png'], 'IMG', 'n.md', 'wiki')).toBe('img.png');
  });
  it('不敏感档多命中维持 null 消歧口径（敏感零命中 + 不敏感多处同名不误搬）', () => {
    expect(resolveTarget(['b/foo.png', 'c/FOO.PNG'], 'Foo', 'n.md', 'wiki')).toBeNull();
    // 敏感档唯一命中优先采信（不涉不敏感档多命中的既有消歧行为不回退）
    expect(resolveTarget(['b/foo.png', 'c/FOO.PNG'], 'FOO', 'n.md', 'wiki')).toBe('c/FOO.PNG');
  });
  it('basename 兜底同步不敏感（精确优先原则不变；扩展名推断形态）', () => {
    expect(resolveTarget(['b/foo.PNG'], 'FOO', 'n.md', 'wiki')).toBe('b/foo.PNG');
    // 敏感档唯一命中优先于不敏感档（'x' 只敏感命中 b/x.png，不涉不敏感档）
    expect(resolveTarget(['b/x.png', 'c/X.PNG'], 'x.png', 'n.md', 'wiki')).toBe('b/x.png');
  });
  it('端到端：大小写 wikilink 引用可收集（此前漏搬）', () => {
    expect(collectResources('![[IMG.PNG]]', ['img.png'], 'n.md')).toEqual(['img.png']);
  });
});

describe('collectResourcesCached（ARCH-1 cache 主路径）', () => {
  it('cache linktext 双档解析：wiki 短路径 + md 无前缀相对 + 百分号编码', () => {
    const files = ['a/img.png', 'notes/assets/b.png', 'notes/My Image.png', 'notes/n.md'];
    const links = ['img', 'assets/b.png', 'My%20Image.png'];
    expect(collectResourcesCached(links, files, 'notes/n.md').sort()).toEqual(
      ['a/img.png', 'notes/My Image.png', 'notes/assets/b.png'].sort()
    );
  });
  it('wiki 后缀（|别名 #标题 ^锚）与 md url # 锚显式剥除', () => {
    const files = ['a/b.png', 'docs/手册.pdf'];
    expect(collectResourcesCached(['a/b.png|别名', 'a/b.png#图', 'a/b.png^ref', 'docs/手册.pdf#page=3'], files, 'n.md').sort()).toEqual([
      'a/b.png',
      'docs/手册.pdf',
    ]);
  });
  it('断链丢弃；.md 目标不收；空串跳过', () => {
    expect(collectResourcesCached(['ghost.png', 'n2', ''], ['n2.md'], 'n.md')).toEqual([]);
  });
});