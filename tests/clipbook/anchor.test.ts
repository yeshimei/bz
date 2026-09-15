// @vitest-environment node
/**
 * clipbook（issue 329 / ADR-0144）：锚定数据层测试。
 * 覆盖：applyBodyTransforms（划词替换/图片换链/混合/无标记/多 mark/同串多处只换第一处）、
 * applyClipContentTransforms（frontmatter 不误伤）、findMarkdownSnippet（选区回查源片段）、
 * 侧写 marks/savedImages/pendingSource 读写（updateClipbookData 事务）、
 * clipbookImageFolder 设置键回落解析。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { applyBodyTransforms, applyClipContentTransforms, findMarkdownSnippet, noteBasename, aliasLink } from '../../src/clipbook/anchor';
import {
  addArticleMark, addArticleImageSwap, addPendingSourceNote,
  readArticleTracking, clearArticleTracking,
} from '../../src/clipbook/anchor';
import { readClipbookData } from '../../src/clipbook/data';
import { clipbookImageDir } from '../../src/clipbook/image-save';

beforeEach(() => {
  resetObsidianMocks();
  setApp(mockAppWithVault(new MockVault()));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
});

const mark = (find: string, notePath: string, kind: 'term' | 'passage' = 'term') => ({ find, notePath, kind });
const swap = (src: string, local: string) => ({ src, local });

describe('applyBodyTransforms（渲染/物化共用变换管线）', () => {
  it('无标记：body 原样返回，明细为空', () => {
    const r = applyBodyTransforms('普通正文一段。', [], []);
    expect(r.body).toBe('普通正文一段。');
    expect(r.marks).toEqual([]);
    expect(r.images).toEqual([]);
  });

  it('划词替换：find 串 → [[basename|find]] 别名双链，明细记录命中', () => {
    const body = '量子纠缠是一种量子力学现象。';
    const r = applyBodyTransforms(body, [mark('量子纠缠', '文献盒/量子纠缠笔记.md')], []);
    expect(r.body).toBe('[[量子纠缠笔记|量子纠缠]]是一种量子力学现象。');
    expect(r.marks).toEqual([mark('量子纠缠', '文献盒/量子纠缠笔记.md')]);
  });

  it('kind=passage 同机制替换（名词/段落同管线）', () => {
    const r = applyBodyTransforms('前文。被锚定的一段话。后文。', [mark('被锚定的一段话', '文献盒/段落甲.md', 'passage')], []);
    expect(r.body).toBe('前文。[[段落甲|被锚定的一段话]]。后文。');
    expect(r.marks[0].kind).toBe('passage');
  });

  it('同串多处命中只替换第一处（接受）；未命中不进明细', () => {
    const body = '重复词甲 重复词甲';
    const r = applyBodyTransforms(body, [mark('重复词甲', '文献盒/X.md')], []);
    expect(r.body).toBe('[[X|重复词甲]] 重复词甲');
    expect(r.marks).toHaveLength(1);
    const miss = applyBodyTransforms('正文', [mark('不存在的串', '文献盒/Y.md')], []);
    expect(miss.body).toBe('正文');
    expect(miss.marks).toEqual([]);
  });

  it('多 mark 共存：各自替换（同段多次划词多条双链）', () => {
    const body = '甲与乙并列。';
    const r = applyBodyTransforms(body, [mark('甲', '文献盒/A.md'), mark('乙', '文献盒/B.md')], []);
    expect(r.body).toBe('[[A|甲]]与[[B|乙]]并列。');
    expect(r.marks).toHaveLength(2);
  });

  it('图片换链：![alt](src) 精确匹配 → ![[local]]；未命中的映射不进明细', () => {
    const body = '前图 ![配图](https://a.example/x.png) 后文。![另一张](https://b.example/y.jpg)';
    const r = applyBodyTransforms(body, [], [swap('https://a.example/x.png', '归档/网页剪藏/assets/标题.png')]);
    expect(r.body).toBe('前图 ![[归档/网页剪藏/assets/标题.png]] 后文。![另一张](https://b.example/y.jpg)');
    expect(r.images).toEqual([swap('https://a.example/x.png', '归档/网页剪藏/assets/标题.png')]);
  });

  it('混合：先图片换链后划词替换（同一管线顺序稳定）', () => {
    const body = '![图](https://a.example/x.png) 里讲到了量子纠缠。';
    const r = applyBodyTransforms(
      body,
      [mark('量子纠缠', '文献盒/量子纠缠.md')],
      [swap('https://a.example/x.png', '归档/网页剪藏/assets/T.png')],
    );
    expect(r.body).toBe('![[归档/网页剪藏/assets/T.png]] 里讲到了[[量子纠缠|量子纠缠]]。');
  });

  it('src 含正则元字符按字面量匹配（escapeRe 生效）', () => {
    const body = '![图](https://a.example/x.png?p=1&v=2)';
    const r = applyBodyTransforms(body, [], [swap('https://a.example/x.png?p=1&v=2', '归档/网页剪藏/assets/M.png')]);
    expect(r.body).toBe('![[归档/网页剪藏/assets/M.png]]');
  });
});

describe('applyClipContentTransforms（已保存条目直写路径）', () => {
  it('frontmatter 里的同串不误伤，只变换正文', () => {
    const content = '---\nurl: "https://x.com/a"\nsummary: "量子纠缠 topics"\n---\n正文里的量子纠缠。';
    const next = applyClipContentTransforms(content, [mark('量子纠缠', '文献盒/Q.md')], []);
    expect(next).toContain('summary: "量子纠缠 topics"'); // frontmatter 原样
    expect(next).toContain('正文里的[[Q|量子纠缠]]。');
  });

  it('无 frontmatter 的裸正文照常变换', () => {
    const next = applyClipContentTransforms('裸正文 甲', [mark('甲', '文献盒/A.md')], []);
    expect(next).toBe('裸正文 [[A|甲]]');
  });
});

describe('findMarkdownSnippet（复制 Markdown 的选区回查）', () => {
  it('命中返回覆盖完整行（保 markdown 语法）', () => {
    const body = '# 标题\n\n前段。\n\n- **量子纠缠** 是现象\n- 第二条';
    expect(findMarkdownSnippet(body, '量子纠缠')).toBe('- **量子纠缠** 是现象');
  });

  it('DOM textContent 空白归一兜底（换行/连续空白差异）', () => {
    const body = '前文\n\n**跨行加粗\n内容** 后续';
    expect(findMarkdownSnippet(body, '跨行加粗 内容')).toBe('**跨行加粗\n内容** 后续');
  });

  it('未命中返回 null；空选区返回 null', () => {
    expect(findMarkdownSnippet('正文', '不存在')).toBeNull();
    expect(findMarkdownSnippet('正文', '')).toBeNull();
    expect(findMarkdownSnippet('', '任意')).toBeNull();
  });
});

describe('noteBasename / aliasLink', () => {
  it('去目录去 .md；别名双链格式 [[basename|find]]', () => {
    expect(noteBasename('文献盒/量子纠缠笔记.md')).toBe('量子纠缠笔记');
    expect(noteBasename('无扩展名')).toBe('无扩展名');
    expect(aliasLink('文献盒/Q.md', '量子')).toBe('[[Q|量子]]');
  });
});

describe('侧写 marks / savedImages / pendingSource 读写（updateClipbookData 事务）', () => {
  it('addArticleMark：追加 + 同 key 同 find 同目标去重', async () => {
    await addArticleMark('url:https://x.com/1', mark('甲', '文献盒/A.md'));
    await addArticleMark('url:https://x.com/1', mark('乙', '文献盒/B.md', 'passage'));
    await addArticleMark('url:https://x.com/1', mark('甲', '文献盒/A.md')); // 重复不记
    const d = await readClipbookData();
    expect(d.marks['url:https://x.com/1']).toEqual([
      mark('甲', '文献盒/A.md'),
      mark('乙', '文献盒/B.md', 'passage'),
    ]);
  });

  it('addArticleImageSwap：同 src 覆盖旧映射（防多次保存堆记录）', async () => {
    await addArticleImageSwap('url:https://x.com/1', swap('https://a.example/x.png', '归档/网页剪藏/assets/T.png'));
    await addArticleImageSwap('url:https://x.com/1', swap('https://a.example/x.png', '归档/网页剪藏/assets/T_2.png'));
    const d = await readClipbookData();
    expect(d.savedImages['url:https://x.com/1']).toEqual([
      swap('https://a.example/x.png', '归档/网页剪藏/assets/T_2.png'),
    ]);
  });

  it('addPendingSourceNote：追加且去重', async () => {
    await addPendingSourceNote('url:https://x.com/1', '文献盒/A.md');
    await addPendingSourceNote('url:https://x.com/1', '文献盒/A.md');
    await addPendingSourceNote('url:https://x.com/1', '文献盒/图版.md');
    const d = await readClipbookData();
    expect(d.pendingSource['url:https://x.com/1']).toEqual(['文献盒/A.md', '文献盒/图版.md']);
  });

  it('readArticleTracking / clearArticleTracking：读三段与清三段（清前快照返回）', async () => {
    await addArticleMark('url:https://x.com/1', mark('甲', '文献盒/A.md'));
    await addArticleImageSwap('url:https://x.com/1', swap('https://a.example/x.png', 'p.png'));
    await addPendingSourceNote('url:https://x.com/1', '文献盒/图版.md');
    const before = await readArticleTracking('url:https://x.com/1');
    expect(before.marks).toHaveLength(1);
    expect(before.images).toHaveLength(1);
    expect(before.pendingSource).toEqual(['文献盒/图版.md']);
    const cleared = await clearArticleTracking('url:https://x.com/1');
    expect(cleared.pendingSource).toEqual(['文献盒/图版.md']); // 返回清理前快照
    const after = await readArticleTracking('url:https://x.com/1');
    expect(after).toEqual({ marks: [], images: [], pendingSource: [] });
    const d = await readClipbookData();
    expect(d.marks['url:https://x.com/1']).toBeUndefined();
    expect(d.savedImages['url:https://x.com/1']).toBeUndefined();
    expect(d.pendingSource['url:https://x.com/1']).toBeUndefined();
  });

  it('旧侧写（无新段）容错读取 → 三段默认空', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/clipbook.json', JSON.stringify({ articleOverrides: {}, savedArchive: [], order: [] }));
    setApp(mockAppWithVault(vault));
    const d = await readClipbookData();
    expect(d.marks).toEqual({});
    expect(d.savedImages).toEqual({});
    expect(d.pendingSource).toEqual({});
  });

  it('新段结构损坏容错：非法值整段丢弃，合法值保留', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/clipbook.json', JSON.stringify({
      articleOverrides: {},
      savedArchive: [],
      order: [],
      marks: { 'url:1': [{ find: '甲', notePath: '文献盒/A.md', kind: 'term' }, { bad: true }, null, 'x'] },
      savedImages: 'not-an-object',
      pendingSource: { 'url:2': ['文献盒/B.md', '', 42] },
    }));
    setApp(mockAppWithVault(vault));
    const d = await readClipbookData();
    expect(d.marks['url:1']).toEqual([{ find: '甲', notePath: '文献盒/A.md', kind: 'term' }]);
    expect(d.savedImages).toEqual({});
    expect(d.pendingSource['url:2']).toEqual(['文献盒/B.md', '42']); // 与 order 段同口径：map(String) 后滤空
  });
});

describe('clipbookImageFolder 回落解析（issue 329）', () => {
  it('设置留空 → 回落 <articleDirectory>/assets', () => {
    expect(clipbookImageDir()).toBe('归档/网页剪藏/assets');
  });

  it('设置非空 → 原样使用（归一反斜杠与首尾斜杠）', () => {
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏', clipbookImageFolder: ' 附件/网页图 ' } as any));
    expect(clipbookImageDir()).toBe('附件/网页图');
  });

  it('articleDirectory 缺省 → 兜底默认剪藏目录', () => {
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
    expect(clipbookImageDir()).toBe('归档/网页剪藏/assets');
  });
});
