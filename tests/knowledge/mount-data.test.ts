// @vitest-environment node
/**
 * 挂载树数据层测试（issues 314 / 315；ADR-0137 §1–§4、ADR-0138 后果节、ADR-0139）
 * - 314：正文双链语法解析（六类形态 / 别名 / 全路径 / 大小写 / 重复 / 自链 / 断链）、
 *   锚点按文本重定位、标题与块引用片段。
 * - 315：同名文献实时对齐与改名跟随、frontmatter `mounted` 与 `related` 纯字符串读写、
 *   挂载树构建（三源 + 六类 + 可达/非回指/严格跨代 + 顺序稳定 + 方向翻转）、引用计数、孤儿卡。
 * 共享 mock 未实现 getFirstLinkpathDest（先例 tests/diary/data.test.ts:35 自挂 stub），本文件同样补最小实现。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  buildMountTree,
  classifyKind,
  findSameNameNote,
  mountCtx,
  orphanCards,
  parseMountLinks,
  readMounts,
  readRelated,
  readSubpathBody,
  refCounts,
  relocateAnchor,
  removeMount,
  resolveMountLinks,
  writeMount,
} from '../../src/knowledge/mount-data';
import type { MountTree } from '../../src/knowledge/mount-types';

/* ------------------------------------------------------------------ *
 * 测试夹具
 * ------------------------------------------------------------------ */

const MAIN_CARD = [
  '---',
  'tags: []',
  'mounted:',
  '  - "[[卡片盒/丙卡|丙]]"',
  'related:',
  '  - "[[卡片盒/乙卡|乙]]"',
  '---',
  '',
  '主卡正文第一句 [[卡片盒/甲卡|甲]] 收尾。',
  '第二句 [[文献盒/背景.md]] 与第三句 [[卡片盒/甲卡]] 重复。',
  '自链 [[主卡]] 与 [[主卡#小节]] 不该长出来。',
  '嵌入 ![[附件/图.png]] 与 ![[附件/片.mp4]]。',
  '引用 [[文献盒/背景.md#要点]] 与 [[文献盒/背景.md#^blk1]]。',
  '盒外 [[我的/日记/x.md]]，断链 [[不存在的卡]]。',
  '显式双链同名文献 [[文献盒/主卡.md]] 也不该拉线。',
].join('\n');

const NOTE_BG = [
  '---',
  'tags: []',
  '---',
  '## 要点',
  '',
  '要点第一段。',
  '',
  '要点第二段 ^blk1',
  '',
  '## 别的',
  '',
  '别的内容。',
].join('\n');

/** 主树夹具：主卡（双链 + related + mounted + 同名文献）→ 甲卡 → 丁卡 */
function mainFiles(): Record<string, string> {
  return {
    '卡片盒/主卡.md': MAIN_CARD,
    '卡片盒/甲卡.md': '甲卡正文：回指 [[主卡]]、同代 [[乙卡]]、下探 [[丁卡]]。',
    '卡片盒/乙卡.md': '乙卡正文：逆流 [[文献盒/背景.md]]。',
    '卡片盒/丙卡.md': '丙卡正文：没有挂载项。',
    '卡片盒/丁卡.md': '丁卡正文：逆流 [[文献盒/背景.md]]。',
    '文献盒/主卡.md': '文献背景：与主卡同名，吸附对齐用。',
    '文献盒/背景.md': NOTE_BG,
    '我的/日记/x.md': '日记正文。',
    '附件/图.png': '<png>',
    '附件/片.mp4': '<mp4>',
  };
}

/** 构造 mock app（MockVault + 共享 mock；补 getFirstLinkpathDest 最小实现：精确路径 → 同名全局匹配） */
function makeApp(files: Record<string, string> = {}) {
  const vault = new MockVault();
  for (const [p, c] of Object.entries(files)) vault.files.set(p, c);
  const app = mockAppWithVault(vault) as any;
  app.metadataCache.getFirstLinkpathDest = (link: string, _src: string) => {
    const raw = String(link ?? '').replace(/\\/g, '/').trim();
    if (!raw) return null;
    const exact = vault.getAbstractFileByPath(raw);
    if (exact && !exact.children) return exact;
    const want = raw.split('/').pop()!.replace(/\.md$/i, '').toLowerCase();
    return vault.getFiles().find((f: any) => String(f.path).split('/').pop()!.replace(/\.md$/i, '').toLowerCase() === want) ?? null;
  };
  setApp(app);
  setSettingsProvider(() => ({ knowledgeCardboxDirectory: '卡片盒', knowledgeDirectory: '文献盒' }) as any);
  return { app, vault };
}

/** 便捷：解析 + 解析路径 */
async function mountLinks(body: string, sourcePath: string, ctx = mountCtx()) {
  return resolveMountLinks(parseMountLinks(body), ctx, sourcePath);
}

const ids = (t: MountTree) => t.nodes.map((n) => n.id);
const edgePairs = (t: MountTree) => t.edges.map((e) => `${e.from}>${e.to}`);
const depthOf = (t: MountTree, id: string) => t.nodes.find((n) => n.id === id)?.depth;
/** parent 链自检：根为 null；每个节点沿 parent 上溯必须回到根，且层数 = depth（面包屑可据此回溯） */
function assertParentChain(t: MountTree) {
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  expect(byId.get(t.root)!.parent).toBeNull();
  for (const n of t.nodes) {
    let cur = n;
    let hops = 0;
    while (cur.parent !== null) {
      const p = byId.get(cur.parent);
      expect(p, `${cur.id} 的父节点 ${cur.parent} 必须在树内`).toBeTruthy();
      cur = p!;
      hops++;
    }
    expect(cur.id).toBe(t.root);
    expect(hops).toBe(n.depth);
  }
}

beforeEach(() => {
  makeApp({});
});

/* ------------------------------------------------------------------ *
 * 上下文
 * ------------------------------------------------------------------ */

describe('mountCtx', () => {
  it('目录缺省「卡片盒 / 文献盒」', () => {
    setSettingsProvider(() => ({}) as any);
    const ctx = mountCtx();
    expect(ctx.cardboxDir).toBe('卡片盒');
    expect(ctx.litDir).toBe('文献盒');
    expect(ctx.app).toBeTruthy();
  });

  it('读设置键并归一（反斜杠转正、去首尾斜杠）', () => {
    setSettingsProvider(() => ({ knowledgeCardboxDirectory: '/我的\\卡片/', knowledgeDirectory: '文献' }) as any);
    const ctx = mountCtx();
    expect(ctx.cardboxDir).toBe('我的/卡片');
    expect(ctx.litDir).toBe('文献');
  });
});

/* ------------------------------------------------------------------ *
 * 314：双链语法解析与六类形态
 * ------------------------------------------------------------------ */

describe('parseMountLinks：双链语法（314）', () => {
  it('六类各一例（语法层 kind 粗判 + 解析层精化）', async () => {
    makeApp(mainFiles());
    const ctx = mountCtx();
    const body = ['[[卡片盒/甲卡]]', '[[文献盒/背景.md]]', '[[文献盒/背景.md#要点]]', '[[文献盒/背景.md#^blk1]]', '![[附件/图.png]]', '![[附件/片.mp4]]'].join('\n');
    const parsed = parseMountLinks(body);
    expect(parsed.map((l) => l.kind)).toEqual(['note', 'note', 'head', 'para', 'image', 'video']);
    expect(parsed.map((l) => l.embed)).toEqual([false, false, false, false, true, true]);
    const resolved = await mountLinks(body, '卡片盒/主卡.md', ctx);
    expect(resolved.map((l) => l.kind)).toEqual(['card', 'note', 'head', 'para', 'image', 'video']);
    expect(resolved.map((l) => l.missing)).toEqual([false, false, false, false, false, false]);
    expect(resolved.map((l) => l.path)).toEqual([
      '卡片盒/甲卡.md',
      '文献盒/背景.md',
      '文献盒/背景.md',
      '文献盒/背景.md',
      '附件/图.png',
      '附件/片.mp4',
    ]);
  });

  it('别名 / 全路径 / 大小写不敏感 / 同名去重 / 非嵌入的图片按扩展名判', async () => {
    makeApp(mainFiles());
    const [alias] = parseMountLinks('[[卡片盒/甲卡|甲]]');
    expect(alias.alias).toBe('甲');
    expect(alias.target).toBe('卡片盒/甲卡');
    // `卡片盒/甲卡` 与 `甲卡` 解析到同一文件 → 解析后按路径去重，只剩一条
    const resolved = await mountLinks('[[卡片盒/甲卡]] [[甲卡]] [[附件/图.png]]', '卡片盒/主卡.md');
    expect(resolved.map((l) => l.path)).toEqual(['卡片盒/甲卡.md', '附件/图.png']);
    expect(resolved.map((l) => l.kind)).toEqual(['card', 'image']);
    const lower = await mountLinks('[[甲卡]]', '卡片盒/主卡.md');
    expect(lower[0].path).toBe('卡片盒/甲卡.md');
  });

  it('同一目标重复出现只产一条（保留首条锚点）；自链照常产出', async () => {
    makeApp(mainFiles());
    const body = '开头 [[卡片盒/甲卡|甲]] 中段 [[卡片盒/甲卡]] 结尾 [[主卡]]。';
    const parsed = parseMountLinks(body);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].anchor.text).toBe('[[卡片盒/甲卡|甲]]');
    expect(parsed[0].anchor.from).toBe(3);
    expect(parsed[0].anchor.to).toBe(3 + '[[卡片盒/甲卡|甲]]'.length);
    const resolved = await mountLinks(body, '卡片盒/主卡.md');
    expect(resolved[1].target).toBe('主卡');
    expect(resolved[1].path).toBe('卡片盒/主卡.md'); // 自链解析层照常产出（剪线在树构建）
  });

  it('断链：不存在 → missing；盒外但文件在 → 正常节点（口径：missing 只看解析）', async () => {
    makeApp(mainFiles());
    const resolved = await mountLinks('[[不存在的卡]] [[我的/日记/x.md]]', '卡片盒/主卡.md');
    expect(resolved[0]).toMatchObject({ path: null, missing: true, kind: 'note' });
    expect(resolved[1]).toMatchObject({ path: '我的/日记/x.md', missing: false, kind: 'note' });
  });

  it('getFirstLinkpathDest 返回 null 时走全库同名兜底', async () => {
    const { app } = makeApp(mainFiles());
    vi.spyOn(app.metadataCache, 'getFirstLinkpathDest').mockReturnValue(null);
    const resolved = await mountLinks('[[甲卡]] [[背景.md]]', '卡片盒/主卡.md');
    expect(resolved.map((l) => l.path)).toEqual(['卡片盒/甲卡.md', '文献盒/背景.md']);
    expect(resolved.every((l) => !l.missing)).toBe(true);
  });

  it('`[[#标题]]` 同文件引用不产挂载项；`!` 与普通链接的 kind 同判', () => {
    expect(parseMountLinks('[[#小节]] 与 [[卡片盒/甲卡]]')).toHaveLength(1);
    expect(classifyKind('图.png', null, false, null, '卡片盒')).toBe('image');
    expect(classifyKind('片.mp4', null, true, null, '卡片盒')).toBe('video');
    expect(classifyKind('卡片盒/某卡', null, false, null, '卡片盒')).toBe('note'); // 无解析路径时按语法
    expect(classifyKind('某卡', '^blk', false, '卡片盒/某卡.md', '卡片盒')).toBe('card');
    expect(classifyKind('某卡', '小节', false, '卡片盒/某卡.md', '卡片盒')).toBe('card');
    expect(classifyKind('文献', '^blk', false, '文献盒/文献.md', '卡片盒')).toBe('para');
    expect(classifyKind('文献', '小节', false, '文献盒/文献.md', '卡片盒')).toBe('head');
    expect(classifyKind('文献', null, false, '文献盒/文献.md', '卡片盒')).toBe('note');
  });
});

describe('relocateAnchor：按文本重定位（314 / ADR-0138 后果节）', () => {
  it('编辑后仍可定位（偏移失效不影响）', () => {
    const body = '第一段 [[卡片盒/甲卡|甲]] 收尾。';
    const [link] = parseMountLinks(body);
    const edited = '新增一行\n' + body;
    expect(relocateAnchor(edited, link.anchor)).toBe(edited.indexOf('[[卡片盒/甲卡|甲]]'));
  });

  it('文本被改写 → null', () => {
    const [link] = parseMountLinks('第一段 [[卡片盒/甲卡|甲]] 收尾。');
    expect(relocateAnchor('这里换成了 [[卡片盒/乙卡]]。', link.anchor)).toBeNull();
  });

  it('精确匹配失败时退化为去空白匹配', () => {
    expect(relocateAnchor('前 卡片 甲卡 后', { from: 0, to: 0, text: '卡片甲卡' })).toBe(2);
    expect(relocateAnchor('', { from: 0, to: 0, text: '卡片' })).toBeNull();
    expect(relocateAnchor('任意正文', { from: 0, to: 0, text: '' })).toBeNull();
  });
});

describe('readSubpathBody：标题与块引用片段（314）', () => {
  const file = '文献盒/背景.md';

  it('块引用（行扫描）：取块并从片段里剥掉 ^id 标记', async () => {
    makeApp(mainFiles());
    expect(await readSubpathBody(file, '^blk1', mountCtx())).toBe('要点第二段');
    expect(await readSubpathBody(file, '^不存在', mountCtx())).toBeNull();
  });

  it('标题（行扫描）：取下级标题之前的内容（不含标题行）', async () => {
    makeApp(mainFiles());
    expect(await readSubpathBody(file, '要点', mountCtx())).toBe('要点第一段。\n\n要点第二段 ^blk1');
    expect(await readSubpathBody(file, '别的', mountCtx())).toBe('别的内容。');
    expect(await readSubpathBody(file, '没有这个标题', mountCtx())).toBeNull();
  });

  it('metadataCache headings 优先（行号 = 文件绝对行，含 frontmatter）', async () => {
    const { app } = makeApp(mainFiles());
    // 缓存说「要点」在第 3 行（0 起、含 frontmatter 的绝对行）→ 内容从第 4 行起，连带后面「## 别的」，
    // 证明走了缓存（行扫描会停在下一个同级标题前）
    app.metadataCache.getFileCache = () => ({
      headings: [{ heading: '要点', level: 2, position: { start: { line: 3 } } }],
    });
    const text = await readSubpathBody(file, '要点', mountCtx());
    expect(text).toContain('## 别的');
  });

  it('metadataCache blocks 优先，缓存路径同样剥掉 ^id 标记', async () => {
    const { app } = makeApp(mainFiles());
    app.metadataCache.getFileCache = () => ({
      blocks: { blk1: { position: { start: { line: 11 }, end: { line: 11 } } } },
    });
    expect(await readSubpathBody(file, '^blk1', mountCtx())).toBe('别的内容。');
  });
});

/* ------------------------------------------------------------------ *
 * 315：同名文献对齐
 * ------------------------------------------------------------------ */

describe('findSameNameNote：同名对齐（315）', () => {
  it('先卡后文献：文献后落也顶上；先文献后卡：建卡即对齐', async () => {
    // 先卡后文献
    const first = makeApp({ '卡片盒/DeepSeek.md': '卡', '文献盒/DeepSeek.md': '文献' });
    expect(await findSameNameNote('卡片盒/DeepSeek.md', mountCtx())).toBe('文献盒/DeepSeek.md');
    // 先文献后卡
    const second = makeApp({ '文献盒/DeepSeek.md': '文献', '卡片盒/DeepSeek.md': '卡' });
    expect(await findSameNameNote('卡片盒/DeepSeek.md', mountCtx())).toBe('文献盒/DeepSeek.md');
    expect(first.vault.files.size).toBe(second.vault.files.size);
  });

  it('名字不匹配 / 文献盒之外的同名笔记都不算；改名跟随（重算跟着走）', async () => {
    const { vault } = makeApp({ '卡片盒/DeepSeek.md': '卡', '文献盒/DeepSeek.md': '文献', '其他/DeepSeek.md': '别的同名' });
    expect(await findSameNameNote('卡片盒/DeepSeek.md', mountCtx())).toBe('文献盒/DeepSeek.md');
    vault.files.delete('文献盒/DeepSeek.md');
    expect(await findSameNameNote('卡片盒/DeepSeek.md', mountCtx())).toBeNull();
    vault.files.set('文献盒/DeepSeek.md', '文献');
    vault.files.delete('卡片盒/DeepSeek.md');
    vault.files.set('卡片盒/DeepSeek-R1.md', '卡');
    expect(await findSameNameNote('卡片盒/DeepSeek-R1.md', mountCtx())).toBeNull(); // 改名后按新名字对齐
  });
});

/* ------------------------------------------------------------------ *
 * 315：mounted / related 纯字符串读写
 * ------------------------------------------------------------------ */

const FM_TEXT = [
  '---',
  'tags: [电影]',
  'category: 未分类',
  'mounted:',
  '  - "[[卡片盒/甲卡|甲]]"',
  'related:',
  '  - "[[文献盒/源.md|源]]"',
  'date: "2024-01-01"',
  '---',
  '',
  '正文 [[卡片盒/乙卡]]。',
].join('\n');

describe('mounted 读写（315，纯字符串）', () => {
  it('readMounts 取目标路径（剥别名）', () => {
    expect(readMounts(FM_TEXT)).toEqual(['卡片盒/甲卡']);
    expect(readMounts('无 frontmatter 的正文')).toEqual([]);
  });

  it('writeMount 追加、幂等、按目标去重（别名不同也算同一条），不碰其它键', () => {
    const added = writeMount(FM_TEXT, '卡片盒/乙卡|乙');
    expect(readMounts(added)).toEqual(['卡片盒/甲卡', '卡片盒/乙卡']);
    expect(added).toContain('category: 未分类');
    expect(added).toContain('related:\n  - "[[文献盒/源.md|源]]"');
    expect(added).toContain('正文 [[卡片盒/乙卡]]。');
    expect(writeMount(added, '卡片盒/乙卡|别名不同')).toBe(added); // 幂等
    expect(writeMount(FM_TEXT, '卡片盒/甲卡.md|甲')).toBe(FM_TEXT); // 去重（去 .md 同目标）
  });

  it('无 mounted 键则整键插入；无 frontmatter 原样返回', () => {
    const noKey = ['---', 'tags: []', '---', '', '正文'].join('\n');
    const added = writeMount(noKey, '卡片盒/甲卡|甲');
    expect(readMounts(added)).toEqual(['卡片盒/甲卡']);
    expect(added).toContain('tags: []');
    expect(writeMount('没有 frontmatter', '卡片盒/甲卡')).toBe('没有 frontmatter');
  });

  it('内联空列表升级为列表形态；内联非空列表不动（不猜用户手写格式）', () => {
    const empty = ['---', 'mounted: []', '---', '', '正文'].join('\n');
    const added = writeMount(empty, '卡片盒/甲卡|甲');
    expect(added).toContain('mounted:\n  - "[[卡片盒/甲卡|甲]]"');
    expect(added).not.toContain('[]');
    const inline = ['---', 'mounted: [卡片盒/甲卡]', '---', '', '正文'].join('\n');
    expect(writeMount(inline, '卡片盒/乙卡')).toBe(inline);
  });

  it('removeMount 删同目标行；列表清空则连键行一起删；其它键与正文不动', () => {
    const removed = removeMount(FM_TEXT, '卡片盒/甲卡|甲');
    expect(readMounts(removed)).toEqual([]);
    expect(removed).not.toContain('mounted:');
    expect(removed).toContain('related:\n  - "[[文献盒/源.md|源]]"');
    expect(removed).toContain('正文 [[卡片盒/乙卡]]。');
    expect(removeMount(FM_TEXT, '卡片盒/没有这个')).toBe(FM_TEXT); // 不存在 → 原样
    const two = writeMount(FM_TEXT, '卡片盒/乙卡|乙');
    const one = removeMount(two, '卡片盒/甲卡');
    expect(readMounts(one)).toEqual(['卡片盒/乙卡']);
    expect(one).toContain('mounted:'); // 还有条目 → 键保留
  });

  it('追加→删除往返回到原文', () => {
    expect(removeMount(writeMount(FM_TEXT, '卡片盒/乙卡|乙'), '卡片盒/乙卡|乙')).toBe(FM_TEXT);
  });

  it('去重/删除只认卡片本体：`[[甲卡#标题]]` 与 `[[甲卡|别名]]` 同一条', () => {
    const withSub = ['---', 'mounted:', '  - "[[卡片盒/甲卡#标题|甲]]"', '---', '', '正文'].join('\n');
    expect(readMounts(withSub)).toEqual(['卡片盒/甲卡']); // readMounts 剥 subpath/别名
    expect(writeMount(withSub, '卡片盒/甲卡')).toBe(withSub); // 幂等
    expect(writeMount(withSub, '卡片盒/甲卡.md|甲')).toBe(withSub); // 去 .md 同一条
    expect(writeMount(FM_TEXT, '卡片盒/甲卡#标题')).toBe(FM_TEXT); // 已有本体 → 不重复追加
    expect(readMounts(removeMount(withSub, '卡片盒/甲卡'))).toEqual([]); // 删得掉
  });

  it('键下有空行也能去重/删除（空行不结束列表，不吞后面的键）', () => {
    const spaced = ['---', 'mounted:', '', '  - "[[卡片盒/甲卡|甲]]"', 'related:', '  - "[[文献盒/源.md|源]]"', '---', '', '正文'].join('\n');
    expect(readMounts(spaced)).toEqual(['卡片盒/甲卡']);
    expect(writeMount(spaced, '卡片盒/甲卡|别名不同')).toBe(spaced); // 空行后的项也认得出
    const added = writeMount(spaced, '卡片盒/乙卡|乙');
    expect(readMounts(added)).toEqual(['卡片盒/甲卡', '卡片盒/乙卡']);
    expect(added).toContain('related:\n  - "[[文献盒/源.md|源]]"'); // 后面的键没被吞
    const removed = removeMount(spaced, '卡片盒/甲卡');
    expect(removed).not.toContain('mounted:');
    expect(removed).toContain('related:'); // 空行随空列表一起清掉，别的键留着
  });

  it('空目标（空串/空白/`[[]]`）不写脏行也不误删', () => {
    expect(writeMount(FM_TEXT, '')).toBe(FM_TEXT);
    expect(writeMount(FM_TEXT, '   ')).toBe(FM_TEXT);
    expect(writeMount(FM_TEXT, '[[]]')).toBe(FM_TEXT);
    expect(writeMount(FM_TEXT, '|别名')).toBe(FM_TEXT);
    expect(removeMount(FM_TEXT, '')).toBe(FM_TEXT);
    expect(readMounts(FM_TEXT)).toEqual(['卡片盒/甲卡']); // 原文未动
  });
});

describe('readRelated（315）', () => {
  it('取 frontmatter related 的目标路径（而非展示名）', async () => {
    makeApp({ '卡片盒/主卡.md': FM_TEXT });
    expect(await readRelated('卡片盒/主卡.md', mountCtx())).toEqual(['文献盒/源.md']);
    expect(await readRelated('卡片盒/不存在.md', mountCtx())).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 315：挂载树构建
 * ------------------------------------------------------------------ */

describe('buildMountTree：三源 + 六类 + 剪线（315）', () => {
  it('主卡为根：同名吸附、双链/related/mounted 三源、六类形态、顺序稳定', async () => {
    makeApp(mainFiles());
    const tree = await buildMountTree('卡片盒/主卡.md', { direction: 'downstream', ctx: mountCtx() });
    expect(tree.root).toBe('卡片盒/主卡.md');
    expect(tree.direction).toBe('downstream');
    expect(ids(tree)).toEqual([
      '卡片盒/主卡.md',
      '文献盒/主卡.md',
      '卡片盒/甲卡.md',
      '文献盒/背景.md',
      '附件/图.png',
      '附件/片.mp4',
      '文献盒/背景.md#要点',
      '文献盒/背景.md#^blk1',
      '我的/日记/x.md',
      '不存在的卡',
      '卡片盒/乙卡.md',
      '卡片盒/丙卡.md',
      '卡片盒/丁卡.md',
    ]);
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    expect(byId.get('卡片盒/主卡.md')).toMatchObject({ kind: 'card', source: 'self', depth: 0, attached: false, missing: false, parent: null });
    expect(byId.get('卡片盒/主卡.md')!.body).toContain('主卡正文第一句');
    expect(byId.get('文献盒/主卡.md')).toMatchObject({ kind: 'note', source: 'sameName', attached: true, depth: 1, anchor: null, parent: '卡片盒/主卡.md' });
    expect(byId.get('卡片盒/甲卡.md')).toMatchObject({ source: 'link', kind: 'card', depth: 1 });
    expect(byId.get('卡片盒/甲卡.md')!.anchor!.text).toBe('[[卡片盒/甲卡|甲]]');
    expect(byId.get('文献盒/背景.md')).toMatchObject({ source: 'link', kind: 'note', depth: 1 });
    expect(byId.get('文献盒/背景.md')!.body).toContain('## 要点');
    expect(byId.get('附件/图.png')).toMatchObject({ kind: 'image', body: null, depth: 1 });
    expect(byId.get('附件/片.mp4')).toMatchObject({ kind: 'video', body: null, depth: 1 });
    expect(byId.get('文献盒/背景.md#要点')).toMatchObject({ kind: 'head', title: '要点', body: '要点第一段。\n\n要点第二段 ^blk1' });
    expect(byId.get('文献盒/背景.md#^blk1')).toMatchObject({ kind: 'para', title: '要点第二段', body: '要点第二段' });
    expect(byId.get('我的/日记/x.md')).toMatchObject({ kind: 'note', source: 'link', depth: 1 });
    expect(byId.get('不存在的卡')).toMatchObject({ missing: true, path: '不存在的卡', body: null, depth: 1, kind: 'note' });
    expect(byId.get('卡片盒/乙卡.md')).toMatchObject({ source: 'related', anchor: null, depth: 1 });
    expect(byId.get('卡片盒/丙卡.md')).toMatchObject({ source: 'manual', anchor: null, depth: 1 });
    expect(byId.get('卡片盒/丁卡.md')).toMatchObject({ source: 'link', depth: 2 });
    // 边：顺序稳定 + 严格跨代不变式
    expect(edgePairs(tree)).toEqual([
      '卡片盒/主卡.md>卡片盒/甲卡.md',
      '卡片盒/主卡.md>文献盒/背景.md',
      '卡片盒/主卡.md>附件/图.png',
      '卡片盒/主卡.md>附件/片.mp4',
      '卡片盒/主卡.md>文献盒/背景.md#要点',
      '卡片盒/主卡.md>文献盒/背景.md#^blk1',
      '卡片盒/主卡.md>我的/日记/x.md',
      '卡片盒/主卡.md>不存在的卡',
      '卡片盒/主卡.md>卡片盒/乙卡.md',
      '卡片盒/主卡.md>卡片盒/丙卡.md',
      '卡片盒/甲卡.md>卡片盒/丁卡.md',
    ]);
    for (const e of tree.edges) expect(depthOf(tree, e.to)!).toBeGreaterThan(depthOf(tree, e.from)!);
    // 同名文献不产边：正文里**显式**写了 `[[文献盒/主卡.md]]` 也不拉线（attached 恒无边）
    expect(byId.get('文献盒/主卡.md')!.attached).toBe(true);
    expect(tree.edges.some((e) => e.to === '文献盒/主卡.md')).toBe(false);
    expect(tree.edges.some((e) => e.from === '文献盒/主卡.md')).toBe(false);
    expect(tree.edges).toHaveLength(11);
    // parent：多层节点（丁卡 = 甲卡的子）指向发现它的上一环，全树上溯都能回到根
    expect(byId.get('卡片盒/丁卡.md')!.parent).toBe('卡片盒/甲卡.md');
    expect(byId.get('卡片盒/甲卡.md')!.parent).toBe('卡片盒/主卡.md');
    assertParentChain(tree);
  });

  it('parent 链：多层「孙卡」沿 parent 上溯层数 = depth，且回到 root', async () => {
    makeApp({ '卡片盒/A.md': 'A [[B|乙]]', '卡片盒/B.md': 'B [[C]]', '卡片盒/C.md': 'C [[D]]', '卡片盒/D.md': 'D 到底了' });
    const tree = await buildMountTree('卡片盒/A.md', { direction: 'downstream', ctx: mountCtx() });
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    expect(byId.get('卡片盒/B.md')).toMatchObject({ parent: '卡片盒/A.md', depth: 1 });
    expect(byId.get('卡片盒/C.md')).toMatchObject({ parent: '卡片盒/B.md', depth: 2 });
    expect(byId.get('卡片盒/D.md')).toMatchObject({ parent: '卡片盒/C.md', depth: 3 });
    assertParentChain(tree);
  });

  it('剪线三类：回指（甲卡→主卡）、同代互指（甲卡→乙卡）、逆流（丁卡→背景）都不画', async () => {
    makeApp(mainFiles());
    const tree = await buildMountTree('卡片盒/主卡.md', { direction: 'downstream', ctx: mountCtx() });
    const pairs = edgePairs(tree);
    expect(pairs).not.toContain('卡片盒/甲卡.md>卡片盒/主卡.md');
    expect(pairs).not.toContain('卡片盒/甲卡.md>卡片盒/乙卡.md');
    expect(pairs).not.toContain('卡片盒/丁卡.md>文献盒/背景.md');
    expect(pairs).not.toContain('卡片盒/乙卡.md>文献盒/背景.md');
    // 节点唯一：乙卡只出现一次（related 与同代双链都指向它）
    expect(ids(tree).filter((id) => id === '卡片盒/乙卡.md')).toHaveLength(1);
  });

  it('自链剪线：`[[主卡]]` 与 `[[主卡#小节]]` 都不产节点不产边', async () => {
    makeApp(mainFiles());
    const tree = await buildMountTree('卡片盒/主卡.md', { direction: 'downstream', ctx: mountCtx() });
    expect(ids(tree).some((id) => id.includes('主卡#'))).toBe(false);
    expect(tree.edges.every((e) => e.from !== e.to)).toBe(true);
    expect(ids(tree).filter((id) => id === '卡片盒/主卡.md')).toHaveLength(1);
  });

  it('同一目标重复只出一条节点一条边（保留首条锚点）', async () => {
    makeApp({ '卡片盒/主卡.md': 'A [[甲卡|甲]] B [[甲卡]] C', '卡片盒/甲卡.md': '甲' });
    const tree = await buildMountTree('卡片盒/主卡.md', { direction: 'downstream', ctx: mountCtx() });
    expect(ids(tree)).toEqual(['卡片盒/主卡.md', '卡片盒/甲卡.md']);
    expect(tree.edges).toHaveLength(1);
    expect(tree.nodes[1].anchor!.text).toBe('[[甲卡|甲]]');
  });

  it('非卡目标不再展开（文献笔记里的双链不成节点）', async () => {
    makeApp({
      '卡片盒/主卡.md': '[[文献盒/背景.md]]',
      '文献盒/背景.md': '背景正文 [[卡片盒/甲卡]]',
      '卡片盒/甲卡.md': '甲',
    });
    const tree = await buildMountTree('卡片盒/主卡.md', { direction: 'downstream', ctx: mountCtx() });
    expect(ids(tree)).toEqual(['卡片盒/主卡.md', '文献盒/背景.md']);
  });

  it('顺序稳定：同输入两次构建结果完全一致', async () => {
    makeApp(mainFiles());
    const ctx = mountCtx();
    const a = await buildMountTree('卡片盒/主卡.md', { direction: 'downstream', ctx });
    const b = await buildMountTree('卡片盒/主卡.md', { direction: 'downstream', ctx });
    expect(b).toEqual(a);
  });

  it('改名跟随：改 mock vault 后重跑，节点跟着新路径（实时读、零快照）', async () => {
    const { vault } = makeApp({ '卡片盒/主卡.md': '[[甲卡]]', '卡片盒/甲卡.md': '甲' });
    const before = await buildMountTree('卡片盒/主卡.md', { direction: 'downstream', ctx: mountCtx() });
    expect(ids(before)).toEqual(['卡片盒/主卡.md', '卡片盒/甲卡.md']);
    // 只挪文件不更新双链文本（模拟用户手动改名）→ 断链节点，不自动清
    vault.files.delete('卡片盒/甲卡.md');
    vault.files.set('卡片盒/甲卡-新版.md', '甲');
    const mid = await buildMountTree('卡片盒/主卡.md', { direction: 'downstream', ctx: mountCtx() });
    expect(mid.nodes[1]).toMatchObject({ id: '甲卡', missing: true, path: '甲卡', body: null });
    // 双链同步改到新名（Obsidian 改名时更新全库链接）→ 重算即跟随
    vault.files.set('卡片盒/主卡.md', '[[甲卡-新版]]');
    const after = await buildMountTree('卡片盒/主卡.md', { direction: 'downstream', ctx: mountCtx() });
    expect(ids(after)).toEqual(['卡片盒/主卡.md', '卡片盒/甲卡-新版.md']);
    expect(after.nodes[1].missing).toBe(false);
  });

  it('同名文献改名跟随：重命名后吸附位置空悬', async () => {
    const { vault } = makeApp({ '卡片盒/DeepSeek.md': '卡', '文献盒/DeepSeek.md': '文献' });
    const t1 = await buildMountTree('卡片盒/DeepSeek.md', { direction: 'downstream', ctx: mountCtx() });
    expect(ids(t1)).toEqual(['卡片盒/DeepSeek.md', '文献盒/DeepSeek.md']);
    vault.files.delete('文献盒/DeepSeek.md');
    vault.files.set('文献盒/改名了.md', '文献');
    const t2 = await buildMountTree('卡片盒/DeepSeek.md', { direction: 'downstream', ctx: mountCtx() });
    expect(ids(t2)).toEqual(['卡片盒/DeepSeek.md']);
  });

  it('方向翻转（看谁挂了我）：反查全库挂载项，同一构建器、同样剪线、深度仍递增', async () => {
    makeApp({
      '卡片盒/主卡.md': '主卡正文（上游基准）。',
      '卡片盒/上卡.md': '上卡正文 [[主卡]]。',
      '卡片盒/上上卡.md': ['---', 'mounted:', '  - "[[卡片盒/上卡|上卡]]"', '---', '', '上上卡正文。'].join('\n'),
      '我的/日记/x.md': '日记正文 [[主卡]]。',
      '文献盒/主卡.md': '文献盒里的同名笔记。',
    });
    const tree = await buildMountTree('卡片盒/主卡.md', { direction: 'upstream', ctx: mountCtx() });
    expect(tree.direction).toBe('upstream');
    expect(ids(tree)).toEqual([
      '卡片盒/主卡.md',
      '文献盒/主卡.md',
      '卡片盒/上卡.md',
      '我的/日记/x.md',
      '卡片盒/上上卡.md',
    ]);
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    expect(byId.get('文献盒/主卡.md')).toMatchObject({ source: 'sameName', attached: true, depth: 1 });
    expect(byId.get('卡片盒/上卡.md')).toMatchObject({ source: 'link', kind: 'card', depth: 1 });
    expect(byId.get('卡片盒/上卡.md')!.anchor!.text).toBe('[[主卡]]'); // 锚点在挂载方正文里
    expect(byId.get('我的/日记/x.md')).toMatchObject({ source: 'link', kind: 'note', depth: 1, attached: false });
    expect(byId.get('卡片盒/上上卡.md')).toMatchObject({ source: 'manual', depth: 2 });
    expect(edgePairs(tree)).toEqual([
      '卡片盒/主卡.md>卡片盒/上卡.md',
      '卡片盒/主卡.md>我的/日记/x.md',
      '卡片盒/上卡.md>卡片盒/上上卡.md',
    ]);
    expect(tree.edges).toHaveLength(3); // 同名文献不产边
    for (const e of tree.edges) expect(depthOf(tree, e.to)!).toBeGreaterThan(depthOf(tree, e.from)!);
    // parent：上游方向同样给链路（上卡挂到主卡、上上卡挂到上卡），同名文献仍是「所属卡片」
    expect(byId.get('文献盒/主卡.md')!.parent).toBe('卡片盒/主卡.md');
    expect(byId.get('卡片盒/上卡.md')!.parent).toBe('卡片盒/主卡.md');
    expect(byId.get('卡片盒/上上卡.md')!.parent).toBe('卡片盒/上卡.md');
    assertParentChain(tree);
  });

  it('上游方向同样剪线：互指环只留跨代那一根（回指不画）', async () => {
    makeApp({ '卡片盒/甲卡.md': '甲卡 [[乙卡]]', '卡片盒/乙卡.md': '乙卡 [[甲卡]]' });
    const tree = await buildMountTree('卡片盒/甲卡.md', { direction: 'upstream', ctx: mountCtx() });
    expect(ids(tree)).toEqual(['卡片盒/甲卡.md', '卡片盒/乙卡.md']);
    expect(edgePairs(tree)).toEqual(['卡片盒/甲卡.md>卡片盒/乙卡.md']); // 乙卡→甲卡 是回指，剪掉
  });
});

/* ------------------------------------------------------------------ *
 * 315：引用计数与孤儿卡
 * ------------------------------------------------------------------ */

describe('refCounts / orphanCards（315）', () => {
  function countFiles(): Record<string, string> {
    return {
      '卡片盒/甲卡.md': '甲卡自身没有挂载项。',
      '卡片盒/乙卡.md': '乙卡正文 [[甲卡]]。',
      '卡片盒/丙卡.md': ['---', 'related:', '  - "[[卡片盒/甲卡|甲]]"', 'mounted:', '  - "[[甲卡]]"', '---', '', '丙卡正文。'].join('\n'),
      '卡片盒/孤立.md': '孤立卡。',
      '卡片盒/同名.md': '同名卡。',
      '文献盒/甲卡.md': '同名文献（不计数）。',
      '文献盒/同名.md': '同名文献（不解除孤儿）。',
      '我的/日记/x.md': '日记正文 [[卡片盒/甲卡.md]]。',
    };
  }

  it('只数用户双链（正文 wikilink + related + mounted），不数同名文献', async () => {
    makeApp(countFiles());
    expect(await refCounts(mountCtx())).toEqual({
      '卡片盒/甲卡.md': 4, // 乙卡正文 + 丙卡 related + 丙卡 mounted + 日记正文
      '卡片盒/乙卡.md': 0,
      '卡片盒/丙卡.md': 0,
      '卡片盒/孤立.md': 0,
      '卡片盒/同名.md': 0,
    });
  });

  it('孤儿卡 = 无入链且自身挂载项全空；同名文献不解除孤儿', async () => {
    makeApp(countFiles());
    expect(await orphanCards(mountCtx())).toEqual(['卡片盒/同名.md', '卡片盒/孤立.md'].sort());
    // 有出向链接（乙卡）或被引用（甲卡）都不是孤儿
    expect(await orphanCards(mountCtx())).not.toContain('卡片盒/乙卡.md');
    expect(await orphanCards(mountCtx())).not.toContain('卡片盒/甲卡.md');
  });

  it('断链也算「有挂载」（卡不长草不因目标已被删）', async () => {
    makeApp({ '卡片盒/主卡.md': '正文 [[早就删掉的卡]]。' });
    expect(await orphanCards(mountCtx())).toEqual([]);
  });

  it('自链不计入被引、也不算「有挂载」（与树内剪线同口径）', async () => {
    makeApp({
      '卡片盒/自恋卡.md': '自恋卡正文 [[自恋卡]] 只指自己。',
      '卡片盒/被指卡.md': '被指卡正文。',
      '卡片盒/他卡.md': '他卡正文 [[被指卡]]。',
    });
    const counts = await refCounts(mountCtx());
    expect(counts['卡片盒/自恋卡.md']).toBe(0); // 自链不算被引
    expect(counts['卡片盒/被指卡.md']).toBe(1); // 他卡的双链照常算
    // 自链也不构成「有挂载」：只指自己的卡仍是孤儿；有入链的不是
    expect(await orphanCards(mountCtx())).toEqual(['卡片盒/自恋卡.md']);
  });

  it('orphanCards 可复用外部 counts（缺省仍自算，两种调用结果一致）', async () => {
    makeApp(countFiles());
    const counts = await refCounts(mountCtx());
    const want = ['卡片盒/同名.md', '卡片盒/孤立.md'].sort();
    expect(await orphanCards(mountCtx(), counts)).toEqual(want);
    expect(await orphanCards(mountCtx())).toEqual(want);
  });
});
