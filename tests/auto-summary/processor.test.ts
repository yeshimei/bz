/**
 * 自动摘要 processor 测试（ticket 22）：缺失字段 AI 补全 + 通知 + 重命名。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
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

  it('ticket 124：摘要长度简单档 → 50-100 字规则 + max_tokens 1024', async () => {
    const ai = makeAI('{"summary":"S"}');
    await aiProcess(ai, '正文', ['summary'], { summaryLength: 'simple' });
    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain('50-100字');
    expect(prompt).not.toContain('150-250字');
    expect(ai.prompt.mock.calls[0][2]).toEqual({ modelOptions: { max_tokens: 1024, temperature: 0.3 } });
  });

  it('ticket 124：详细档 → 300-400 字规则 + max_tokens 2048', async () => {
    const ai = makeAI('{"summary":"S"}');
    await aiProcess(ai, '正文', ['summary'], { summaryLength: 'detailed' });
    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain('300-400字');
    expect(ai.prompt.mock.calls[0][2]).toEqual({ modelOptions: { max_tokens: 2048, temperature: 0.3 } });
  });

  it('ticket 124：未知长度档 → 回退标准档', async () => {
    const ai = makeAI('{"summary":"S"}');
    await aiProcess(ai, '正文', ['summary'], { summaryLength: 'weird' });
    expect(ai.prompt.mock.calls[0][0]).toContain('150-250字');
  });

  it('ticket 124：标签开关关 → 即使 missing 含 tags 也不生成，提示词无 tags 规则', async () => {
    const ai = makeAI('{"title":"T"}');
    await aiProcess(ai, '正文', ['title', 'tags'], { tagsEnabled: false });
    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain('生成中文标题');
    expect(prompt).not.toContain('tags 规则');
  });

  it('ticket 124：标签数量自定义区间 → 规则含自定义区间', async () => {
    const ai = makeAI('{"tags":["a"]}');
    await aiProcess(ai, '正文', ['tags'], { tagCount: '5-8' });
    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain('5-8 个中文标签');
    expect(prompt).not.toContain('3-6 个中文标签');
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
    resetAIProviderCache();
    setAISettingsProvider(() => ({})); // 默认未配 AI：失败原因走「未配置」文案
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  it('缺全部字段 → AI 补全写回 + 缺 title 重命名笔记 + 通知', async () => {
    vault.files.set('归档/网页剪藏/a.md', `---\nurl: "https://x.com/a"\n---\n\n${LONG_BODY}`);
    const ai = makeAI('{"title":"新标题","summary":"摘要内容","tags":["AI","阅读"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/a.md'));
    // 重命名：a.md → 新标题.md
    expect(vault.files.has('归档/网页剪藏/a.md')).toBe(false);
    const out = vault.files.get('归档/网页剪藏/新标题.md')!;
    expect(out).toContain('title: "新标题"');
    expect(out).toContain('summary: "摘要内容"');
    expect(out).toContain('  - "AI"');
    expect(out).toContain('  - "阅读"');
    expect(out).toContain('url: "https://x.com/a"'); // 原字段保留
    // 通知：摘要单条原地更新为结果 + 改名成功独立弹出「已重命名为《X》」（ticket a1）
    const msgs = getNoticeMessages();
    expect(msgs).toContain('《新标题》\n\n摘要内容\n\n#AI #阅读');
    expect(msgs).toContain('已重命名为《新标题》');
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

  it('重命名防重名 → 追加 (1) + 改名成功通知', async () => {
    vault.files.set('归档/网页剪藏/e.md', `---\nurl: "https://x.com/e"\n---\n\n${LONG_BODY}`);
    vault.files.set('归档/网页剪藏/新标题.md', '占位');
    const ai = makeAI('{"title":"新标题"}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/e.md'));
    expect(vault.files.has('归档/网页剪藏/新标题 (1).md')).toBe(true);
    expect(getNoticeMessages()).toContain('已重命名为《新标题》');
  });

  it('rename 失败 → 回退仅写 frontmatter title + warning 通知（a1）', async () => {
    vault.files.set('归档/网页剪藏/f.md', `---\nurl: "https://x.com/f"\n---\n\n${LONG_BODY}`);
    const vault2 = new MockVault();
    vault2.files.set('归档/网页剪藏/f.md', `---\nurl: "https://x.com/f"\n---\n\n${LONG_BODY}`);
    vault2.rename = vi.fn().mockRejectedValue(new Error('rename 失败')) as any;
    const ai = makeAI('{"title":"新标题"}');
    await processFile(makeApp(vault2), ai, vault2.file('归档/网页剪藏/f.md'));
    expect(vault2.files.has('归档/网页剪藏/f.md')).toBe(true);
    expect(vault2.files.get('归档/网页剪藏/f.md')!).toContain('title: "新标题"');
    expect(getNoticeMessages()).toContain('自动改名失败，标题已写入笔记，请手动重命名');
  });

  it('正文 <100 字 → 跳过', async () => {
    vault.files.set('归档/网页剪藏/g.md', `---\nurl: "https://x.com/g"\n---\n\n太短`);
    const ai = makeAI('{"title":"T"}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/g.md'));
    expect(vault.modifiedPaths).toHaveLength(0);
  });

  it('AI 返回 null → 不改文件，失败通知人话化（未配 AI 引导设置）+ 挂「重试」action', async () => {
    vault.files.set('归档/网页剪藏/h.md', `---\nurl: "https://x.com/h"\n---\n\n${LONG_BODY}`);
    await processFile(makeApp(vault), makeAI(null), vault.file('归档/网页剪藏/h.md'));
    expect(vault.modifiedPaths).toHaveLength(0);
    // 动态链路（ticket 25）：progress 隐藏 → 常驻 error 承载（审计修复：不再 5s 自动消失）
    await new Promise((r) => setTimeout(r, 250)); // 等 progress 通知退出动画移除
    expect(getNoticeMessages()).toHaveLength(1);
    expect(getNoticeMessages()[0]).toBe('AI 服务未配置或不可用，请到设置页配置');
    const retryBtn = document.querySelector('.bz-notice .bz-notice-action') as HTMLButtonElement;
    expect(retryBtn).not.toBeNull();
    expect(retryBtn.textContent).toBe('重试');
  });

  it('失败通知常驻（duration<=0）：6 秒后仍在 DOM（旧实现 error 默认 5s 即消失，「重试」窗口过短）', async () => {
    vi.useFakeTimers();
    try {
      vault.files.set('归档/网页剪藏/persist.md', `---\nurl: "https://x.com/p"\n---\n\n${LONG_BODY}`);
      const running = processFile(makeApp(vault), makeAI(null), vault.file('归档/网页剪藏/persist.md'));
      await vi.advanceTimersByTimeAsync(50);
      await running;
      await vi.advanceTimersByTimeAsync(6000); // 超过 error 默认 5s
      expect(getNoticeMessages()).toContain('AI 服务未配置或不可用，请到设置页配置');
      expect(document.querySelector('.bz-notice .bz-notice-action')).not.toBeNull(); // 重试入口仍在
    } finally {
      vi.useRealTimers();
    }
  });

  it('AI 已配置但请求失败 → 通用人话文案（不误报「未配置」）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }) as any);
    resetAIProviderCache();
    vault.files.set('归档/网页剪藏/k.md', `---\nurl: "https://x.com/k"\n---\n\n${LONG_BODY}`);
    await processFile(makeApp(vault), makeAI(null, true), vault.file('归档/网页剪藏/k.md'));
    expect(vault.modifiedPaths).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 250)); // 等 progress 通知退出动画移除
    expect(getNoticeMessages()[0]).toBe('摘要生成失败，请重试');
  });

  it('失败通知点「重试」→ 重跑当前文件，第二次成功并改名', async () => {
    vault.files.set('归档/网页剪藏/r.md', `---\nurl: "https://x.com/r"\n---\n\n${LONG_BODY}`);
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(null) // 第一次失败
      .mockResolvedValueOnce('{"title":"重试标题","summary":"摘要内容","tags":["AI"]}'); // 重试成功
    const ai = { prompt } as any;
    const file = vault.file('归档/网页剪藏/r.md');
    await processFile(makeApp(vault), ai, file);
    expect(vault.files.has('归档/网页剪藏/r.md')).toBe(true); // 失败不改文件
    const retryBtn = document.querySelector('.bz-notice .bz-notice-action') as HTMLButtonElement;
    expect(retryBtn).not.toBeNull();
    retryBtn.click(); // 点按重跑当前文件
    await new Promise((r) => setTimeout(r, 30));
    expect(vault.files.has('归档/网页剪藏/重试标题.md')).toBe(true);
    expect(getNoticeMessages().some((m) => m.includes('重试标题'))).toBe(true);
  });

  it('连续处理两个文件 → 各自一条完成通知（ticket 1：按文件区分去重键，互不吞结果）', async () => {
    vault.files.set('归档/网页剪藏/m1.md', `---\nurl: "https://x.com/m1"\n---\n\n${LONG_BODY}`);
    vault.files.set('归档/网页剪藏/m2.md', `---\nurl: "https://x.com/m2"\n---\n\n${LONG_BODY}`);
    const ai = makeAI('{"title":"甲","summary":"摘要一","tags":["AI"]}');
    await Promise.all([
      processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/m1.md')),
      processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/m2.md')),
    ]);
    expect(getNoticeMessages().filter((m) => m.includes('摘要一'))).toHaveLength(2);
  });

  it('AI 处理期间外部追加（P1-21）：写回基于最新读——自定义 frontmatter 与正文段落保留，摘要字段已更新', async () => {
    let release!: (v: string) => void;
    const ai = {
      prompt: vi.fn().mockImplementation(() => new Promise<string>((r) => { release = r; })),
    } as any;
    const path = '归档/网页剪藏/a.md';
    vault.files.set(path, `---\nurl: "https://x.com/a"\ncustom: "保留我"\n---\n\n${LONG_BODY}`);

    const running = processFile(makeApp(vault), ai, vault.file(path));
    await new Promise((r) => setTimeout(r, 0)); // 推进到 AI 调用挂起点
    expect(ai.prompt).toHaveBeenCalledTimes(1);

    // AI 处理期间：外部追加正文段落与自定义 frontmatter 字段
    vault.files.set(
      path,
      `---\nurl: "https://x.com/a"\ncustom: "保留我"\nadded: "外部字段"\n---\n\n${LONG_BODY}\n\n外部追加的段落`
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
    expect(out).toContain('url: "https://x.com/a"');
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

  it('外来剪藏 frontmatter 不丢行（审计修复）：中文键/注释/无缩进 tags 原样保留，tags 不被 AI 覆盖', async () => {
    const src = [
      '---',
      'title: "已有标题"',
      '来源: 少数派',
      'published-at: 2024-01-01',
      'tags:',
      '- 阅读',
      '- AI',
      '# 剪藏备注',
      '---',
      '',
      LONG_BODY,
    ].join('\n');
    vault.files.set('归档/网页剪藏/ext.md', src);
    // tags 已存在（无缩进列表）→ 只缺 summary：AI 仅被请求 summary，不生成 tags
    const ai = makeAI('{"summary":"AI 摘要"}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/ext.md'));

    const prompt = ai.prompt.mock.calls[0][0] as string;
    expect(prompt).toContain('150-250字'); // 只请求 summary
    expect(prompt).not.toContain('tags 规则'); // tags 不缺 → 不生成（防覆盖用户标签）

    const out = vault.files.get('归档/网页剪藏/ext.md')!;
    expect(out).toContain('summary: "AI 摘要"'); // 新字段写入
    expect(out).toContain('少数派'); // 中文键值保留（旧实现被整行丢弃）
    expect(out).toContain('2024-01-01'); // 连字符键保留
    expect(out).toContain('  - "阅读"'); // 原有 tags 保留（未被 AI 标签替换）
    expect(out).toContain('  - "AI"');
    expect(out).toContain('# 剪藏备注'); // 注释行原样拼回（旧实现被删除）
    expect(out).toContain(LONG_BODY); // 正文不动
  });
});
