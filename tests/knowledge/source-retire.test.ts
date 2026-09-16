// @vitest-environment node
/**
 * source 退役测试（issue 336 / ADR-0149）：剪藏/任意 md 删除后知识盒卡片 source 的
 * 降级回外链与断链摘除。
 * - 纯函数半边：sourcePointsAt 命中判据 / retireSourceLine 行级手术（降级、摘除、
 *   sourceTitle 保持、幂等、CRLF 保真、不命中零扰动）；
 * - 编排半边：retireKnowledgeSources 目录扫描 + metadataCache 预筛（MockVault +
 *   mockAppWithVault）、retireKnowledgeSourcesForClip / retireSourcesOnMdDeleted 通知口径。
 * 通知（core/notice）在 node 环境 mock 掉（同 tests/clipbook/source-upgrade.test.ts 先例）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return {
    ...actual,
    notify: vi.fn(() => ({ setMessage: vi.fn(), setType: vi.fn(), hide: vi.fn() })),
  };
});
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { sourcePointsAt, retireSourceLine } from '../../src/knowledge/source';
import {
  knowledgeDirOf,
  retireKnowledgeSources,
  retireKnowledgeSourcesForClip,
  retireSourcesOnMdDeleted,
} from '../../src/knowledge/source-retire';
import { notify } from '../../src/core/notice';

/** 术语卡片罐头（generateTermNote 落盘形态：source/sourceTitle 引号包裹） */
const termCard = (sourceLine: string) =>
  ['---', 'title: "某名词"', 'type: term', sourceLine, 'sourceTitle: "页面标题"', 'date: "2026-09-15 10:00:00"', '---', '', '正文一段。', '', '正文二段。'].join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', knowledgeDirectory: '文献盒' } as any));
});

describe('sourcePointsAt（退役命中判据：内部双链且路径归一后相等）', () => {
  it('带别名/不带别名/带引号转义的内链 → 指向即命中（.md 后缀与反斜杠归一）', () => {
    expect(sourcePointsAt('[[归档/网页剪藏/甲文.md|甲文]]', '归档/网页剪藏/甲文.md')).toBe(true);
    expect(sourcePointsAt('[[归档/网页剪藏/甲文.md]]', '归档/网页剪藏/甲文.md')).toBe(true);
    expect(sourcePointsAt('[[文献盒/量子.md|量子]]', '文献盒\\量子.md')).toBe(true); // 反斜杠归一
  });

  it('外链 / 手写文字 / 未闭合内链 / 路径不同 / 空 → 不命中', () => {
    expect(sourcePointsAt('https://x.com/a', '归档/网页剪藏/甲文.md')).toBe(false);
    expect(sourcePointsAt('随手写的文字', '归档/网页剪藏/甲文.md')).toBe(false);
    expect(sourcePointsAt('[[归档/网页剪藏/甲文.md|甲文', '归档/网页剪藏/甲文.md')).toBe(false);
    expect(sourcePointsAt('[[文献盒/别的.md|别的]]', '归档/网页剪藏/甲文.md')).toBe(false);
    expect(sourcePointsAt('', '归档/网页剪藏/甲文.md')).toBe(false);
    expect(sourcePointsAt('[[a.md|a]]', '  ')).toBe(false); // 空退役路径拒绝
  });
});

describe('retireSourceLine（行级退役：降级回外链 / 摘除，只动 source 一行）', () => {
  it('降级命中：内部双链 → quoteYaml(url) 外链形态（ADR-0144 物化前两态还原）', () => {
    const out = retireSourceLine(termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"'), '归档/网页剪藏/甲文.md', 'https://zhuanlan.zhihu.com/p/123')!;
    expect(out).toContain('source: "https://zhuanlan.zhihu.com/p/123"');
    expect(out).not.toContain('[[');
  });

  it('摘除命中：整行摘除，sourceTitle 与其余键、正文零扰动（回到「无来源」合法初始态）', () => {
    const content = termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"');
    const out = retireSourceLine(content, '归档/网页剪藏/甲文.md', null)!;
    expect(out).not.toContain('source:');
    expect(out).toContain('sourceTitle: "页面标题"'); // sourceTitle 保留
    expect(out).toContain('title: "某名词"');
    expect(out).toContain('date: "2026-09-15 10:00:00"');
    expect(out).toContain('正文一段。');
    expect(out).toContain('正文二段。');
    // 行数 -1：只少了 source 一行
    expect(out.split('\n').length).toBe(content.split('\n').length - 1);
  });

  it('幂等：已降级为外链 → 原样返回不写盘；已摘除（无 source 行）→ null', () => {
    const downgraded = termCard('source: "https://zhuanlan.zhihu.com/p/123"');
    expect(retireSourceLine(downgraded, '归档/网页剪藏/甲文.md', 'https://zhuanlan.zhihu.com/p/123')).toBe(downgraded);
    const stripped = termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"');
    const after = retireSourceLine(stripped, '归档/网页剪藏/甲文.md', null)!;
    expect(retireSourceLine(after, '归档/网页剪藏/甲文.md', null)).toBeNull(); // source 行已不在
    expect(retireSourceLine(after, '归档/网页剪藏/甲文.md', 'https://x.com/a')).toBeNull();
  });

  it('不指向退役路径 / 非内部形态 → 原样返回零扰动', () => {
    const other = termCard('source: "[[文献盒/别的.md|别的]]"');
    expect(retireSourceLine(other, '归档/网页剪藏/甲文.md', null)).toBe(other);
    const external = termCard('source: "https://x.com/a"');
    expect(retireSourceLine(external, '归档/网页剪藏/甲文.md', null)).toBe(external);
  });

  it('无 frontmatter / 空退役路径 → null（调用方不得写盘）', () => {
    expect(retireSourceLine('没有 frontmatter 的正文', 'a.md', null)).toBeNull();
    expect(retireSourceLine(termCard('source: "[[a.md|a]]"'), '  ', null)).toBeNull();
  });

  it('未加引号的内链同样识别；正文里出现 source: 字样不误伤', () => {
    expect(retireSourceLine(termCard('source: [[归档/网页剪藏/甲文.md|甲文]]'), '归档/网页剪藏/甲文.md', 'https://x.com/a'))
      .toContain('source: "https://x.com/a"');
    const bodyOnly = '---\ntitle: "t"\n---\n\n正文里提到 source: [[归档/网页剪藏/甲文.md|甲文]]';
    expect(retireSourceLine(bodyOnly, '归档/网页剪藏/甲文.md', null)).toBeNull(); // frontmatter 内无 source 行
  });

  it('CRLF 文件行尾保真：降级与摘除都不悄悄改行尾', () => {
    const crlf = termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"').replace(/\n/g, '\r\n');
    const down = retireSourceLine(crlf, '归档/网页剪藏/甲文.md', 'https://x.com/a')!;
    expect(down).toContain('\r\n');
    expect(down).toContain('source: "https://x.com/a"');
    const stripped = retireSourceLine(crlf, '归档/网页剪藏/甲文.md', null)!;
    expect(stripped).toContain('\r\n');
    expect(stripped).not.toContain('source:');
  });
});

describe('retireKnowledgeSources（编排：目录扫描 + metadataCache 预筛 + 行级写回）', () => {
  it('只改写命中卡片，未命中/目录外卡片零扰动；返回改写张数', async () => {
    const vault = new MockVault();
    vault.files.set('文献盒/命中.md', termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"'));
    vault.files.set('文献盒/未命中.md', termCard('source: "[[文献盒/别的.md|别的]]"'));
    vault.files.set('卡片盒/目录外.md', termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"'));
    const app = mockAppWithVault(vault) as any;
    setApp(app);

    const n = await retireKnowledgeSources(app, '归档/网页剪藏/甲文.md', 'https://x.com/a');
    expect(n).toBe(1);
    expect(vault.files.get('文献盒/命中.md')).toContain('source: "https://x.com/a"');
    expect(vault.files.get('文献盒/未命中.md')).toContain('source: "[[文献盒/别的.md|别的]]"');
    expect(vault.files.get('卡片盒/目录外.md')).toContain('source: "[[归档/网页剪藏/甲文.md|甲文]]"');
  });

  it('摘除编排在真实 vault 上同样保 sourceTitle（metadataCache 预筛命中 → 内容级复核摘除）', async () => {
    const vault = new MockVault();
    vault.files.set('文献盒/量子.md', termCard('source: "[[我的/影视/菲尔兹奖.md|菲尔兹奖]]"'));
    const app = mockAppWithVault(vault) as any;
    setApp(app);

    const n = await retireSourcesOnMdDeleted(app, '我的/影视/菲尔兹奖.md');
    expect(n).toBe(1);
    const out = vault.files.get('文献盒/量子.md')!;
    expect(out).not.toContain('source:');
    expect(out).toContain('sourceTitle: "页面标题"');
    // 合并通知一条（正文无 emoji）
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('已摘除 1 张知识卡片的失效来源', { type: 'info' });
  });

  it('无命中不通知；空退役路径直接短路', async () => {
    const vault = new MockVault();
    vault.files.set('文献盒/命中.md', termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"'));
    const app = mockAppWithVault(vault) as any;
    setApp(app);

    expect(await retireSourcesOnMdDeleted(app, '别的/无关.md')).toBe(0);
    expect(await retireKnowledgeSources(app, '', null)).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('retireKnowledgeSourcesForClip（剪藏删除降级契约：通知口径）', () => {
  it('有 url → 降级 + success 通知「已把 N 张知识卡片来源回退为原链接」', async () => {
    const vault = new MockVault();
    vault.files.set('文献盒/甲卡.md', termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"'));
    vault.files.set('文献盒/乙卡.md', termCard('source: "[[归档/网页剪藏/甲文.md|甲文]]"'));
    const app = mockAppWithVault(vault) as any;
    setApp(app);

    const n = await retireKnowledgeSourcesForClip(app, '归档/网页剪藏/甲文.md', 'https://x.com/a');
    expect(n).toBe(2);
    expect(vault.files.get('文献盒/甲卡.md')).toContain('source: "https://x.com/a"');
    expect(notify).toHaveBeenCalledWith('已把 2 张知识卡片来源回退为原链接', { type: 'success' });
  });

  it('无 url 剪藏 → 改调摘除 + info 通知（issue 336 链路 1 的摘除分流）', async () => {
    const vault = new MockVault();
    vault.files.set('文献盒/甲卡.md', termCard('source: "[[归档/网页剪藏/手记.md|手记]]"'));
    const app = mockAppWithVault(vault) as any;
    setApp(app);

    const n = await retireKnowledgeSourcesForClip(app, '归档/网页剪藏/手记.md', '');
    expect(n).toBe(1);
    expect(vault.files.get('文献盒/甲卡.md')).not.toContain('source:');
    expect(notify).toHaveBeenCalledWith('已摘除 1 张知识卡片的失效来源', { type: 'info' });
  });

  it('零命中不弹通知', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    setApp(app);
    expect(await retireKnowledgeSourcesForClip(app, '归档/网页剪藏/甲文.md', 'https://x.com/a')).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('knowledgeDirOf（目录解析：设置键 knowledgeDirectory，缺省「文献盒」）', () => {
  it('设置缺省回退「文献盒」；反斜杠与首尾斜杠归一', () => {
    expect(knowledgeDirOf()).toBe('文献盒');
    setSettingsProvider(() => ({ knowledgeDirectory: '\\我的\\文献盒\\' } as any));
    expect(knowledgeDirOf()).toBe('我的/文献盒');
    setSettingsProvider(() => ({ knowledgeDirectory: '   ' } as any));
    expect(knowledgeDirOf()).toBe('文献盒');
  });
});
