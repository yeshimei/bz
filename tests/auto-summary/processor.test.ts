/**
 * 自动摘要 processor 测试（ticket 10）：AI 处理 + 文件写回。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { aiProcess, processFile } from '../../src/auto-summary/processor';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

function makeAI(result: string | null, reject = false) {
  const prompt = reject
    ? vi.fn().mockRejectedValue(new Error('AI 挂了'))
    : vi.fn().mockResolvedValue(result);
  return { prompt } as any;
}

const LONG_BODY = '段落内容。'.repeat(30); // >100 字

describe('aiProcess', () => {
  beforeEach(() => {
    resetObsidianMocks();
  });

  it('正常返回 → 解析 JSON', async () => {
    const ai = makeAI('{"title":"T","author":null,"summary":"S","tags":["a","b"]}');
    const r = await aiProcess(ai, '正文');
    expect(r).toEqual({ title: 'T', author: null, summary: 'S', tags: ['a', 'b'] });
    // 提示词含标题规则
    expect(ai.prompt.mock.calls[0][0]).toContain('生成中文标题');
    expect(ai.prompt.mock.calls[0][0]).toContain('禁止使用');
    // 模型与 modelOptions
    expect(ai.prompt.mock.calls[0][1]).toBe('deepseek-v4-flash');
    expect(ai.prompt.mock.calls[0][2]).toEqual({ modelOptions: { max_tokens: 1024, temperature: 0.3 } });
  });

  it('正文截断 6000 字', async () => {
    const ai = makeAI('{"title":"T"}');
    await aiProcess(ai, 'x'.repeat(10000));
    expect(ai.prompt.mock.calls[0][0]).toContain('x'.repeat(6000));
    expect(ai.prompt.mock.calls[0][0].length).toBeLessThan(10000 + 2000);
  });

  it('AI reject → 返回 null + console.warn', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await aiProcess(makeAI(null, true), '正文');
    expect(r).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('返回带 ```json 包裹文本也能解析', async () => {
    const ai = makeAI('```json\n{"title":"T2"}\n```');
    const r = await aiProcess(ai, '正文');
    expect(r!.title).toBe('T2');
  });
});

describe('processFile', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  it('正常处理 → frontmatter 重建写回', async () => {
    vault.files.set('归档/网页剪藏/a.md', `---\nlink: "https://x.com/a"\n---\n\n${LONG_BODY}`);
    const ai = makeAI('{"title":"新标题","author":"作者乙","summary":"摘要内容","tags":["AI","阅读"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/a.md'));
    const out = vault.files.get('归档/网页剪藏/a.md')!;
    expect(out).toContain('title: "新标题"');
    expect(out).toContain('author: "作者乙"');
    expect(out).toContain('summary: "摘要内容"');
    expect(out).toContain('tags:');
    expect(out).toContain('  - "AI"');
    expect(out).toContain('  - "阅读"');
    expect(out).toContain('link: "https://x.com/a"'); // 原字段保留
  });

  it('已有 summary → 跳过（不 modify）', async () => {
    vault.files.set('归档/网页剪藏/b.md', `---\nsummary: "已有"\n---\n\n${LONG_BODY}`);
    const ai = makeAI('{"title":"T"}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/b.md'));
    expect(vault.files.get('归档/网页剪藏/b.md')).toContain('summary: "已有"');
    expect(vault.modifiedPaths).toHaveLength(0);
  });

  it('正文 <100 字 → 跳过', async () => {
    vault.files.set('归档/网页剪藏/c.md', `---\nlink: "https://x.com/c"\n---\n\n太短`);
    const ai = makeAI('{"title":"T"}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/c.md'));
    expect(vault.modifiedPaths).toHaveLength(0);
  });

  it('AI 返回 null → 不改文件', async () => {
    vault.files.set('归档/网页剪藏/d.md', `---\nlink: "https://x.com/d"\n---\n\n${LONG_BODY}`);
    await processFile(makeApp(vault), makeAI(null), vault.file('归档/网页剪藏/d.md'));
    expect(vault.modifiedPaths).toHaveLength(0);
  });
});
