/**
 * 内容监控（smartcat/content）补充覆盖：书籍一句话描述、book 标签判定、
 * 光标上下文截取（含向上溢出钳位）、视口/可见内容与当前笔记上下文。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateBookDescription,
  hasBookTag,
  getCursorContext,
  getViewportContent,
  getCurrentNoteContext,
  getVisibleContent,
} from '../../src/smartcat/content';
import { setApp } from '../../src/core/app';
import { eventSystem } from '../../src/smartcat/state';

type CacheMap = Map<any, any>;

function mkView(overrides: Record<string, any> = {}) {
  return { ...overrides };
}

function mkApp(leafView: any, opts: { activeFile?: any; caches?: CacheMap } = {}) {
  return {
    workspace: {
      getMostRecentLeaf: () => (leafView === undefined ? null : { view: leafView }),
      getActiveFile: () => opts.activeFile ?? null,
    },
    metadataCache: {
      getFileCache: (f: any) => (opts.caches ? opts.caches.get(f) ?? null : null),
    },
  } as any;
}

beforeEach(() => setApp(null as any));

describe('generateBookDescription', () => {
  it('frontmatter 全字段逐字拼接（出版年份从字符串提取四位数字）', () => {
    const file = { path: 'b.md' };
    const view = mkView({ file });
    setApp(mkApp(view, { caches: new Map([[file, {
      frontmatter: {
        title: '三体',
        author: '刘慈欣',
        translator: '无',
        publisher: '重庆出版社',
        publicationYear: '初版于2008年',
        category: '科幻',
        readingProgress: 42,
        readingTimeFormat: '5小时20分',
        highlights: 17,
        thinks: 3,
        ISBN: '9787536692930',
      },
    }]]) }));
    expect(generateBookDescription()).toBe(
      '书名：《三体》，作者：刘慈欣，译者：无，出版社：重庆出版社，出版年份：2008，' +
      '分类：科幻，阅读进度：42%，阅读时长：5小时20分，高亮数量：17个，想法数量：3个，ISBN：9787536692930'
    );
  });

  it('publicationYear 数字直用；无年份字符串不提取', () => {
    const file = { path: 'c.md' };
    const view = mkView({ file });
    setApp(mkApp(view, { caches: new Map([[file, {
      frontmatter: { title: 'T', publicationYear: 2008 },
    }]]) }));
    expect(generateBookDescription()).toBe('书名：《T》，出版年份：2008');
  });

  it('空 frontmatter → null；view.file 为空 → frontmatter 取不到 → null', () => {
    const view = mkView({}); // 无 file
    setApp(mkApp(view));
    expect(generateBookDescription()).toBeNull();
    setApp(mkApp(mkView({ file: { path: 'x.md' } }), { caches: new Map([[{ path: 'x.md' }, { frontmatter: {} }]]) }));
    expect(generateBookDescription()).toBeNull();
  });

  it('无活动 leaf / leaf.view 为空 → null', () => {
    setApp(mkApp(undefined));
    expect(generateBookDescription()).toBeNull();
    setApp(mkApp(null)); // { view: null }
    expect(generateBookDescription()).toBeNull();
  });

  it('metadataCache 抛错 → emit bookDescriptionError 并返回 null', () => {
    const errs: any[] = [];
    const handler = (d: any) => errs.push(d);
    eventSystem.on('bookDescriptionError', handler);
    const file = { path: 'e.md' };
    const app = mkApp(mkView({ file }));
    (app.metadataCache as any).getFileCache = () => {
      throw new Error('缓存损坏');
    };
    setApp(app);
    expect(generateBookDescription()).toBeNull();
    expect(errs).toHaveLength(1);
    eventSystem.off('bookDescriptionError', handler);
  });
});

describe('hasBookTag', () => {
  it('正文 tags + frontmatter tags 任一含 book（大小写不敏感）→ true', () => {
    const file = { path: 'a.md' };
    const cache = {
      tags: [{ tag: '#日记' }],
      frontmatter: { tags: ['MyBooks'] },
    };
    setApp(mkApp(null, { activeFile: file, caches: new Map([[file, cache]]) }));
    expect(hasBookTag()).toBe(true);
  });

  it('frontmatter.tags 为单字符串 → 包装后参与匹配', () => {
    const file = { path: 's.md' };
    const cache = { tags: [], frontmatter: { tags: 'book' } };
    setApp(mkApp(null, { activeFile: file, caches: new Map([[file, cache]]) }));
    expect(hasBookTag()).toBe(true);
  });

  it('全部无关标签 → false', () => {
    const file = { path: 'n.md' };
    const cache = {
      tags: [{ tag: '#fiction' }],
      frontmatter: { tags: ['novel'] },
    };
    setApp(mkApp(null, { activeFile: file, caches: new Map([[file, cache]]) }));
    expect(hasBookTag()).toBe(false);
  });

  it('无当前文件 / 无缓存 → false', () => {
    setApp(mkApp(null));
    expect(hasBookTag()).toBe(false);
    const file = { path: 'nc.md' };
    setApp(mkApp(null, { activeFile: file })); // getFileCache → null
    expect(hasBookTag()).toBe(false);
  });
});

describe('getCursorContext', () => {
  function editorApp(lines: string[], cursorLine: number) {
    return mkApp(mkView({
      editor: {
        getValue: () => lines.join('\n'),
        getCursor: () => ({ line: cursorLine, ch: 0 }),
      },
    }));
  }

  it('contextLength=0 → 仅当前行', () => {
    setApp(editorApp(['l0', 'l1', 'l2'], 1));
    expect(getCursorContext(0, 0.5)).toBe('l1');
  });

  it('上下文按比例截取，最终钳到 contextLength（恰好放下）', () => {
    // upLimit=3/downLimit=3：上行 ab(2) 放得下；下行 ef(2) 恰好填满 total=6
    setApp(editorApp(['ab', 'cd', 'ef'], 1));
    expect(getCursorContext(6, 0.5)).toBe('ab\ncd\n'); // substring(0,6) 截断语义（第 6 字符为换行）
  });

  it('上行超长 → 截取剩余额度并钳位（upLimit 分支）', () => {
    // AAAA(4) > 剩余额度 3 → 只取 'AAA'
    setApp(editorApp(['AAAA', 'BB', 'CCCC'], 1));
    expect(getCursorContext(6, 0.5)).toBe('AAA\nBB');
  });

  it('无编辑器 / getValue 抛错 → null', () => {
    setApp(mkApp(undefined));
    expect(getCursorContext(10, 0.5)).toBeNull();
    setApp(mkApp(mkView({
      editor: { getValue: () => { throw new Error('boom'); }, getCursor: () => ({ line: 0 }) },
    })));
    expect(getCursorContext(10, 0.5)).toBeNull();
  });
});

describe('getViewportContent', () => {
  it('全文前 500 字硬编码截断', () => {
    setApp(mkApp(mkView({ editor: { getValue: () => 'a'.repeat(600) } })));
    expect(getViewportContent()).toBe('a'.repeat(500));
  });

  it('短文原样返回；无编辑器 → null', () => {
    setApp(mkApp(mkView({ editor: { getValue: () => '短文' } })));
    expect(getViewportContent()).toBe('短文');
    setApp(mkApp(mkView({})));
    expect(getViewportContent()).toBeNull();
  });
});

describe('getCurrentNoteContext', () => {
  it('有编辑器 + 文件名 → {content, cursorLine, fileName}', () => {
    setApp(mkApp(mkView({
      editor: { getValue: () => '正文', getCursor: () => ({ line: 7 }) },
      file: { basename: '读书笔记' },
    })));
    expect(getCurrentNoteContext()).toEqual({ content: '正文', cursorLine: 7, fileName: '读书笔记' });
  });

  it('basename 为空 → 「未命名文件」；无编辑器 → 空内容 + 「当前笔记」', () => {
    setApp(mkApp(mkView({
      editor: { getValue: () => '', getCursor: () => ({ line: 0 }) },
      file: { basename: '' },
    })));
    expect(getCurrentNoteContext().fileName).toBe('未命名文件');
    setApp(mkApp(mkView({})));
    expect(getCurrentNoteContext()).toEqual({ content: '', cursorLine: -1, fileName: '当前笔记' });
  });

  it('getApp 抛错 → 兜底「未知文件」', () => {
    setApp(null as any);
    expect(getCurrentNoteContext()).toEqual({ content: '', cursorLine: -1, fileName: '未知文件' });
  });
});

describe('getVisibleContent', () => {
  function container(cls: string, textLen: number) {
    const c = document.createElement('div');
    const inner = document.createElement('div');
    inner.className = cls;
    inner.textContent = 'P'.repeat(textLen);
    c.appendChild(inner);
    return c;
  }

  it('预览模式 → .markdown-preview-view 文本，1500 字截断', () => {
    setApp(mkApp(mkView({
      getViewType: () => 'markdown',
      getMode: () => 'preview',
      containerEl: container('markdown-preview-view', 1600),
    })));
    expect(getVisibleContent()).toBe('P'.repeat(1500));
  });

  it('编辑模式 → .markdown-source-view 文本，1500 字截断', () => {
    setApp(mkApp(mkView({
      getViewType: () => 'markdown',
      getMode: () => 'source',
      containerEl: container('markdown-source-view', 2000),
    })));
    expect(getVisibleContent()).toBe('P'.repeat(1500));
  });

  it('无 getMode 默认 source 分支', () => {
    setApp(mkApp(mkView({
      getViewType: () => 'markdown',
      containerEl: container('markdown-source-view', 10),
    })));
    expect(getVisibleContent()).toBe('P'.repeat(10));
  });

  it('预览容器缺失 → null；非 markdown 视图 / 无视图 → null', () => {
    setApp(mkApp(mkView({
      getViewType: () => 'markdown',
      getMode: () => 'preview',
      containerEl: document.createElement('div'),
    })));
    expect(getVisibleContent()).toBeNull();

    setApp(mkApp(mkView({ getViewType: () => 'kanban' })));
    expect(getVisibleContent()).toBeNull();

    setApp(mkApp(undefined));
    expect(getVisibleContent()).toBeNull();
  });
});
