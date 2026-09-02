/**
 * clipbook 域：剪藏目录扫描（ADR-0082 / issue 177）
 * node 环境：parseClipFile / scanClipDirectory / clipUrlSet。
 * 用 MockVault + metadataCache frontmatter 解析种文件断言。
 */
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { parseClipFile, scanClipDirectory } from '../../src/clipbook/scan';

beforeEach(() => {
  resetObsidianMocks();
  setApp(mockAppWithVault(new MockVault()));
});

function clipNote(fm: string, title = '篇一'): any {
  const md = `---\n${fm}\n---\n\n正文内容`;
  const vault = new MockVault();
  vault.files.set(`归档/网页剪藏/${title}.md`, md);
  setApp(mockAppWithVault(vault)); // parseClipFile defaultCache 自取 metadataCache
  return { vault, file: vault.file(`归档/网页剪藏/${title}.md`), md };
}

describe('clipbook/scan parseClipFile', () => {
  it('合法 frontmatter → ClipNote（site/url/created/反链）', () => {
    const { file } = clipNote('url: "https://www.guokr.com/article/1"\nauthor: "果壳"\nsite: "果壳科学人"\nsummary: "摘要"\ntags:\n  - "a"\n  - "b"\ncreated: 2026-08-30 10:00:00\n', '文章A');
    const n = parseClipFile(file);
    expect(n).not.toBeNull();
    expect(n!.url).toBe('https://www.guokr.com/article/1');
    expect(n!.site).toBe('果壳科学人');
    expect(n!.title).toBe('文章A');
    expect(n!.created).toBe(new Date('2026-08-30 10:00:00').valueOf());
    expect(n!.domain).toBe('www.guokr.com');
  });

  it('缺 url 或 created → null（跳过）', () => {
    const { file } = clipNote('site: 果壳\ncreated: 2026-08-30 10:00:00\n', '无url');
    expect(parseClipFile(file)).toBeNull();
    const f2 = clipNote('url: "https://x.com"\n', '无created').file;
    expect(parseClipFile(f2)).toBeNull();
  });

  it('created 非法 → 回退当前时间（P1-23 不炸）', () => {
    const { file } = clipNote('url: "https://x.com/1"\ncreated: "1750000000000"\n', '坏时间');
    const n = parseClipFile(file);
    expect(n).not.toBeNull();
    expect(Number.isFinite(n!.created)).toBe(true);
  });

  it('无 frontmatter → null', () => {
    const vault = new MockVault();
    vault.files.set('归档/网页剪藏/纯正文.md', '没有 frontmatter 的正文');
    setApp(mockAppWithVault(vault));
    expect(parseClipFile(vault.file('归档/网页剪藏/纯正文.md'))).toBeNull();
  });
});

describe('clipbook/scan scanClipDirectory', () => {
  it('目录存在 → 全量解析按 created 降序；目录不存在 → null', async () => {
    const vault = new MockVault();
    vault.files.set('归档/网页剪藏/新篇.md', '---\nurl: "https://x.com/2"\ncreated: 2026-09-01 10:00:00\n---\n');
    vault.files.set('归档/网页剪藏/旧篇.md', '---\nurl: "https://x.com/1"\ncreated: 2026-08-01 10:00:00\n---\n');
    vault.files.set('归档/网页剪藏/废稿.md', '没有 frontmatter');
    setApp(mockAppWithVault(vault));
    const notes = await scanClipDirectory('归档/网页剪藏', { vault });
    expect(notes!.length).toBe(2);
    expect(notes![0].title).toBe('新篇');
    // 目录不存在
    expect(await scanClipDirectory('不存在目录', { vault })).toBeNull();
  });
});
