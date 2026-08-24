// @vitest-environment node
/**
 * 剪藏本解析测试（ticket 08）：parseArticleFile 必需 link+created 字段、
 * title=文件名、作者/站点/摘要/标签、反链笔记名。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { parseArticleFile } from '../../src/clipping/view';
import { MockVault } from '../mock-vault';
import { parseFrontmatter } from '../mock-vault';

function makeApp(vault: MockVault, backlinkSources: string[] = []) {
  return {
    vault,
    metadataCache: {
      getFileCache: (f: any) => {
        const content = vault.files.get(f.path) ?? '';
        const fm = parseFrontmatter(content);
        return fm ? { frontmatter: fm } : null;
      },
      getBacklinksForFile: () => ({ data: new Map(backlinkSources.map((p) => [p, null])) }),
    },
    workspace: {},
  } as any;
}

const ARTICLE_MD = `---
link: "https://zhuanlan.zhihu.com/p/123"
author: "作者甲"
site: "知乎专栏"
summary: "这是一段摘要"
tags: ["AI", "阅读"]
created: 2025-06-01T08:00:00.000Z
---
正文内容
`;

describe('parseArticleFile', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('合法文章 → 解析全部字段（title=文件名）', async () => {
    vault.files.set('我的/文章/《测试文章》.md', ARTICLE_MD);
    setApp(makeApp(vault) as any);
    const entry = await parseArticleFile(vault.file('我的/文章/《测试文章》.md'));
    expect(entry).not.toBeNull();
    expect(entry!.title).toBe('《测试文章》'); // 文件名（含书名号）
    expect(entry!.link).toBe('https://zhuanlan.zhihu.com/p/123');
    expect(entry!.author).toBe('作者甲');
    expect(entry!.site).toBe('知乎专栏');
    expect(entry!.summary).toBe('这是一段摘要');
    expect(entry!.tags).toEqual(['AI', '阅读']);
    expect(entry!.created.toISOString()).toBe('2025-06-01T08:00:00.000Z');
    expect(entry!.rawContent).toBe(ARTICLE_MD);
  });

  it('缺 link → 跳过（null）', async () => {
    vault.files.set('我的/文章/A.md', ARTICLE_MD.replace('link: "https://zhuanlan.zhihu.com/p/123"\n', ''));
    setApp(makeApp(vault) as any);
    expect(await parseArticleFile(vault.file('我的/文章/A.md'))).toBeNull();
  });

  it('缺 created → 跳过（null）', async () => {
    vault.files.set('我的/文章/A.md', ARTICLE_MD.replace('created: 2025-06-01T08:00:00.000Z\n', ''));
    setApp(makeApp(vault) as any);
    expect(await parseArticleFile(vault.file('我的/文章/A.md'))).toBeNull();
  });

  it('无 frontmatter → null', async () => {
    vault.files.set('我的/文章/A.md', '纯正文没有元数据');
    setApp(makeApp(vault) as any);
    expect(await parseArticleFile(vault.file('我的/文章/A.md'))).toBeNull();
  });

  it('反链：被笔记引用时返回来源路径，显示去《》书名号', async () => {
    vault.files.set('我的/文章/《文章B》.md', ARTICLE_MD);
    vault.files.set('卡片盒/引用笔记.md', '链接 [[文章B]]');
    setApp(makeApp(vault, ['卡片盒/《引用》.md']) as any);
    const entry = await parseArticleFile(vault.file('我的/文章/《文章B》.md'));
    expect(entry!.hasBacklink).toBe(true);
    expect(entry!.backlinkSources).toEqual(['卡片盒/《引用》.md']);
  });

  it('无反链 → hasBacklink false / backlinkSources 空', async () => {
    vault.files.set('我的/文章/A.md', ARTICLE_MD);
    setApp(makeApp(vault, []) as any);
    const entry = await parseArticleFile(vault.file('我的/文章/A.md'));
    expect(entry!.hasBacklink).toBe(false);
    expect(entry!.backlinkSources).toEqual([]);
  });

  it('created 为 "1750000000000" 这类值（P1-23）：解析为 Invalid Date 时回退当前时间，不再产出无效日期', async () => {
    const before = Date.now();
    vault.files.set(
      '我的/文章/Bad.md',
      ARTICLE_MD.replace('created: 2025-06-01T08:00:00.000Z', 'created: "1750000000000"')
    );
    setApp(makeApp(vault) as any);
    const entry = await parseArticleFile(vault.file('我的/文章/Bad.md'));
    expect(entry).not.toBeNull();
    expect(isNaN(entry!.created.valueOf())).toBe(false); // 回退 new Date()，非 Invalid
    expect(entry!.created.toISOString()).toBeDefined(); // toISOString 不抛 RangeError
    expect(entry!.created.valueOf()).toBeGreaterThanOrEqual(before);
  });
});