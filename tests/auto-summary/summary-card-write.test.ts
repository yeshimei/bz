/**
 * 摘要卡写回链路（ADR-0290）：auto-summary 摘要生成成功 → 剪藏笔记正文顶部生成原生 callout。
 * 边界：开关关掉 / 不在剪藏目录 / AI 失败 / 摘要为空 都不写卡。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { processFile } from '../../src/auto-summary/processor';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const LONG_BODY = '段落内容。'.repeat(30); // >100 字

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

function makeAI(result: string | null, reject = false) {
  const prompt = reject
    ? vi.fn().mockRejectedValue(new Error('AI 挂了'))
    : vi.fn().mockResolvedValue(result);
  return { prompt } as any;
}

/** 全量默认设置（剪藏目录固定「归档/网页剪藏」，摘要卡开关按用例覆盖） */
function settingsWith(over: Record<string, any> = {}): any {
  return { articleDirectory: '归档/网页剪藏', clipbookSummaryCard: true, ...over };
}

describe('摘要卡写回（ADR-0290）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    resetAIProviderCache();
    setAISettingsProvider(() => ({}));
    vault = new MockVault();
    setApp(makeApp(vault));
  });

  it('摘要生成成功 → 正文顶部落原生卡，笔记里不再出现任何 dataview 指令', async () => {
    setSettingsProvider(() => settingsWith());
    vault.files.set('归档/网页剪藏/a.md', `---\ntitle: "已有标题"\nurl: "https://x.com/a"\n---\n\n${LONG_BODY}`);

    const ai = makeAI('{"summary":"生成的摘要","tags":["AI","阅读"]}');
    const r = await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/a.md'));
    expect(r).toBe('ok');

    const out = vault.files.get('归档/网页剪藏/a.md')!;
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('> [!summary] a');
    expect(out).toContain('> 生成的摘要');
    expect(out).toContain('> #AI #阅读');
    expect(out).not.toContain('dataviewjs');
    expect(out).not.toContain('dv.view');
    // 卡片在正文最顶：frontmatter 之后紧跟卡，摘要段之后再是正文
    expect(out.indexOf('> [!summary]')).toBeLessThan(out.indexOf('段落内容。'));
  });

  it('开关关掉 → 摘要只写 frontmatter，正文保持纯正文', async () => {
    setSettingsProvider(() => settingsWith({ clipbookSummaryCard: false }));
    vault.files.set('归档/网页剪藏/b.md', `---\nurl: "https://x.com/b"\n---\n\n${LONG_BODY}`);

    const ai = makeAI('{"summary":"只进属性","tags":["AI"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/b.md'));

    const out = vault.files.get('归档/网页剪藏/b.md')!;
    expect(out).toContain('summary: "只进属性"');
    expect(out).not.toContain('> [!summary]');
    expect(out).toContain(LONG_BODY);
  });

  it('AI 失败 → 不落卡、正文原样（不留半张空卡）', async () => {
    setSettingsProvider(() => settingsWith());
    const before = `---\nurl: "https://x.com/c"\n---\n\n${LONG_BODY}`;
    vault.files.set('归档/网页剪藏/c.md', before);

    const ai = makeAI(null);
    const r = await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/c.md'));
    expect(r).toBe('ai-failed');
    expect(vault.files.get('归档/网页剪藏/c.md')).toBe(before);
  });

  it('AI 返回空摘要 → 不落卡', async () => {
    setSettingsProvider(() => settingsWith());
    vault.files.set('归档/网页剪藏/d.md', `---\nurl: "https://x.com/d"\n---\n\n${LONG_BODY}`);

    const ai = makeAI('{"tags":["只有标签"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/d.md'));

    expect(vault.files.get('归档/网页剪藏/d.md')!).not.toContain('> [!summary]');
  });

  it('旧版 dataviewjs 摘要块 → 重新生成摘要时原地换成原生卡', async () => {
    setSettingsProvider(() => settingsWith());
    // summary 置空（模型没给过摘要的老笔记）：走缺失补全，写回时顺带清旧块
    vault.files.set(
      '归档/网页剪藏/e.md',
      `---\nurl: "https://x.com/e"\nsummary: ""\n---\n\n\`\`\`dataviewjs\nawait dv.view(\`CONFIG/SCRIPTS/DataView/摘要\`)\n\`\`\`\n\n${LONG_BODY}`,
    );

    const ai = makeAI('{"summary":"升级后的摘要","tags":["升级"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/e.md'));

    const out = vault.files.get('归档/网页剪藏/e.md')!;
    expect(out).toContain('> [!summary] e');
    expect(out).toContain('> 升级后的摘要');
    expect(out).not.toContain('dataviewjs');
    expect(out).not.toContain('dv.view');
  });

  it('剪藏目录之外的笔记 → 不落卡（摘要照常写回）', async () => {
    setSettingsProvider(() => settingsWith());
    vault.files.set('笔记/f.md', `---\nurl: "https://x.com/f"\n---\n\n${LONG_BODY}`);

    const ai = makeAI('{"summary":"目录外摘要","tags":["AI"]}');
    await processFile(makeApp(vault), ai, vault.file('笔记/f.md'));

    const out = vault.files.get('笔记/f.md')!;
    expect(out).toContain('summary: "目录外摘要"');
    expect(out).not.toContain('> [!summary]');
  });
});
