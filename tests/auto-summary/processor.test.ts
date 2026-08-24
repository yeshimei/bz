/**
 * 自动摘要 processor 测试（ticket 22）：缺失字段 AI 补全 + 通知 + 重命名。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { aiProcess, processFile, formatSummaryNotice } from '../../src/auto-summary/processor';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';

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

  it('缺全部字段 → 提示词含全部字段规则 + 解析 JSON', async () => {
    const ai = makeAI('{"title":"T","summary":"S","tags":["a","b"]}');
    const r = await aiProcess(ai, '正文', ['title', 'summary', 'tags']);
    expect(r).toEqual({ title: 'T', summary: 'S', tags: ['a', 'b'] });
    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain('生成中文标题');
    expect(prompt).toContain('禁止使用');
    expect(prompt).toContain('tags 规则');
    expect(prompt).toContain('150-250字');
    expect(prompt).not.toContain('author');
    // 模型与 modelOptions
    expect(ai.prompt.mock.calls[0][1]).toBe('deepseek-v4-flash');
    expect(ai.prompt.mock.calls[0][2]).toEqual({ modelOptions: { max_tokens: 1024, temperature: 0.3 } });
  });

  it('只缺 title → 提示词不含 summary/tags 定义', async () => {
    const ai = makeAI('{"title":"T"}');
    await aiProcess(ai, '正文', ['title']);
    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain('生成中文标题');
    expect(prompt).not.toContain('150-250字');
    expect(prompt).not.toContain('tags 规则');
    expect(prompt).not.toContain('标签1');
  });

  it('只缺 tags → 提示词含 tags 规则块、不含标题/摘要定义', async () => {
    const ai = makeAI('{"tags":["a"]}');
    await aiProcess(ai, '正文', ['tags']);
    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain('tags 规则');
    expect(prompt).not.toContain('生成中文标题');
    expect(prompt).not.toContain('150-250字');
  });

  it('missing 为空 → 返回 null 且不调 AI', async () => {
    const ai = makeAI('{"title":"T"}');
    const r = await aiProcess(ai, '正文', []);
    expect(r).toBeNull();
    expect(ai.prompt).not.toHaveBeenCalled();
  });

  it('正文截断 6000 字', async () => {
    const ai = makeAI('{"title":"T"}');
    await aiProcess(ai, 'x'.repeat(10000), ['title']);
    expect(ai.prompt.mock.calls[0][0]).toContain('x'.repeat(6000));
    expect(ai.prompt.mock.calls[0][0].length).toBeLessThan(10000 + 2000);
  });

  it('AI reject → 返回 null + console.warn', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await aiProcess(makeAI(null, true), '正文', ['summary']);
    expect(r).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('返回带 ```json 包裹文本也能解析', async () => {
    const ai = makeAI('```json\n{"title":"T2"}\n```');
    const r = await aiProcess(ai, '正文', ['title']);
    expect(r!.title).toBe('T2');
  });
});

describe('formatSummaryNotice', () => {
  it('《title》+ 空行 + summary + 空行 + #tags', () => {
    expect(formatSummaryNotice({ title: '标题', summary: '摘要', tags: ['AI', '阅读'] })).toBe(
      '《标题》\n\n摘要\n\n#AI #阅读'
    );
  });

  it('缺哪段不显示哪段', () => {
    expect(formatSummaryNotice({ summary: '只有摘要' })).toBe('只有摘要');
    expect(formatSummaryNotice({})).toBe('');
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

  it('缺全部字段 → AI 补全写回 + 缺 title 重命名笔记 + 通知', async () => {
    vault.files.set('归档/网页剪藏/a.md', `---\nlink: "https://x.com/a"\n---\n\n${LONG_BODY}`);
    const ai = makeAI('{"title":"新标题","summary":"摘要内容","tags":["AI","阅读"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/a.md'));
    // 重命名：a.md → 新标题.md
    expect(vault.files.has('归档/网页剪藏/a.md')).toBe(false);
    const out = vault.files.get('归档/网页剪藏/新标题.md')!;
    expect(out).toContain('title: "新标题"');
    expect(out).toContain('summary: "摘要内容"');
    expect(out).toContain('  - "AI"');
    expect(out).toContain('  - "阅读"');
    expect(out).toContain('link: "https://x.com/a"'); // 原字段保留
    // 通知：动态链路（ticket 25）——单条通知原地更新为结果
    expect(getNoticeMessages()).toHaveLength(1);
    expect(getNoticeMessages()[0]).toBe('《新标题》\n\n摘要内容\n\n#AI #阅读');
  });

  it('已有 title/summary 只缺 tags → 只补 tags，不重命名，原字段保留', async () => {
    vault.files.set(
      '归档/网页剪藏/b.md',
      `---\ntitle: "已有标题"\nsummary: "已有摘要"\n---\n\n${LONG_BODY}`
    );
    const ai = makeAI('{"tags":["新标签"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/b.md'));
    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).not.toContain('生成中文标题'); // 只请求 tags
    const out = vault.files.get('归档/网页剪藏/b.md')!;
    expect(out).toContain('title: "已有标题"'); // 不覆盖
    expect(out).toContain('summary: "已有摘要"');
    expect(out).toContain('  - "新标签"');
    expect(getNoticeMessages()).toHaveLength(1);
    expect(getNoticeMessages()[0]).toBe('《已有标题》\n\n已有摘要\n\n#新标签');
  });

  it('字段齐全 → 跳过（不 modify、不通知、不调 AI）', async () => {
    vault.files.set(
      '归档/网页剪藏/c.md',
      `---\ntitle: "T"\nsummary: "S"\ntags:\n  - "a"\n---\n\n${LONG_BODY}`
    );
    const ai = makeAI('{"title":"T"}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/c.md'));
    expect(vault.modifiedPaths).toHaveLength(0);
    expect(getNoticeMessages()).toHaveLength(0);
    expect(ai.prompt).not.toHaveBeenCalled();
  });

  it('空串 title / 空数组 tags 视为缺失', async () => {
    vault.files.set(
      '归档/网页剪藏/d.md',
      `---\ntitle: ""\ntags: []\n---\n\n${LONG_BODY}`
    );
    const ai = makeAI('{"title":"新标题","tags":["a"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/d.md'));
    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain('生成中文标题');
    expect(prompt).toContain('tags 规则');
  });

  it('重命名防重名 → 追加 (1)', async () => {
    vault.files.set('归档/网页剪藏/e.md', `---\nlink: "https://x.com/e"\n---\n\n${LONG_BODY}`);
    vault.files.set('归档/网页剪藏/新标题.md', '占位');
    const ai = makeAI('{"title":"新标题"}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/e.md'));
    expect(vault.files.has('归档/网页剪藏/新标题 (1).md')).toBe(true);
  });

  it('rename 失败 → 回退仅写 frontmatter title', async () => {
    vault.files.set('归档/网页剪藏/f.md', `---\nlink: "https://x.com/f"\n---\n\n${LONG_BODY}`);
    const vault2 = new MockVault();
    vault2.files.set('归档/网页剪藏/f.md', `---\nlink: "https://x.com/f"\n---\n\n${LONG_BODY}`);
    vault2.rename = vi.fn().mockRejectedValue(new Error('rename 失败')) as any;
    const ai = makeAI('{"title":"新标题"}');
    await processFile(makeApp(vault2), ai, vault2.file('归档/网页剪藏/f.md'));
    expect(vault2.files.has('归档/网页剪藏/f.md')).toBe(true);
    expect(vault2.files.get('归档/网页剪藏/f.md')!).toContain('title: "新标题"');
  });

  it('正文 <100 字 → 跳过', async () => {
    vault.files.set('归档/网页剪藏/g.md', `---\nlink: "https://x.com/g"\n---\n\n太短`);
    const ai = makeAI('{"title":"T"}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/g.md'));
    expect(vault.modifiedPaths).toHaveLength(0);
  });

  it('AI 返回 null → 不改文件，动态通知变为失败提示', async () => {
    vault.files.set('归档/网页剪藏/h.md', `---\nlink: "https://x.com/h"\n---\n\n${LONG_BODY}`);
    await processFile(makeApp(vault), makeAI(null), vault.file('归档/网页剪藏/h.md'));
    expect(vault.modifiedPaths).toHaveLength(0);
    // 动态链路：progress → error（ticket 25）
    expect(getNoticeMessages()).toHaveLength(1);
    expect(getNoticeMessages()[0]).toBe('摘要生成失败，请重试');
  });

  it('AI 处理期间外部追加（P1-21）：写回基于最新读——自定义 frontmatter 与正文段落保留，摘要字段已更新', async () => {
    let release!: (v: string) => void;
    const ai = {
      prompt: vi.fn().mockImplementation(() => new Promise<string>((r) => { release = r; })),
    } as any;
    const path = '归档/网页剪藏/a.md';
    vault.files.set(path, `---\nlink: "https://x.com/a"\ncustom: "保留我"\n---\n\n${LONG_BODY}`);

    const running = processFile(makeApp(vault), ai, vault.file(path));
    await new Promise((r) => setTimeout(r, 0)); // 推进到 AI 调用挂起点
    expect(ai.prompt).toHaveBeenCalledTimes(1);

    // AI 处理期间：外部追加正文段落与自定义 frontmatter 字段
    vault.files.set(
      path,
      `---\nlink: "https://x.com/a"\ncustom: "保留我"\nadded: "外部字段"\n---\n\n${LONG_BODY}\n\n外部追加的段落`
    );

    release('{"title":"新标题","summary":"摘要内容","tags":["AI"]}'); // rename → 新路径 a.md → 新标题.md
    await running;

    const out = vault.files.get('归档/网页剪藏/新标题.md')!;
    // 目标字段已更新
    expect(out).toContain('title: "新标题"');
    expect(out).toContain('summary: "摘要内容"');
    expect(out).toContain('  - "AI"');
    // 外部并发修改全部保留（frontmatter 自定义字段 + 磁盘最新正文）
    expect(out).toContain('custom: "保留我"');
    expect(out).toContain('added: "外部字段"');
    expect(out).toContain('外部追加的段落');
    expect(out).toContain('link: "https://x.com/a"');
  });

  it('无重命名场景同样基于最新读合并（P1-21）：已有 title 只缺 summary，外部追加不被覆盖', async () => {
    let release!: (v: string) => void;
    const ai = {
      prompt: vi.fn().mockImplementation(() => new Promise<string>((r) => { release = r; })),
    } as any;
    const path = '归档/网页剪藏/b.md';
    vault.files.set(path, `---\ntitle: "已有标题"\n---\n\n${LONG_BODY}`);

    const running = processFile(makeApp(vault), ai, vault.file(path));
    await new Promise((r) => setTimeout(r, 0));
    vault.files.set(path, `---\ntitle: "已有标题"\nnote: "用户笔记"\n---\n\n${LONG_BODY}\n\n用户新增段落`);

    release('{"summary":"新摘要"}');
    await running;

    const out = vault.files.get(path)!;
    expect(out).toContain('title: "已有标题"'); // 不覆盖已有
    expect(out).toContain('summary: "新摘要"');
    expect(out).toContain('note: "用户笔记"'); // 外部 frontmatter 保留
    expect(out).toContain('用户新增段落'); // 正文取磁盘最新
    expect(getNoticeMessages()).toHaveLength(1);
    expect(getNoticeMessages()[0]).toBe('《已有标题》\n\n新摘要');
  });
});
