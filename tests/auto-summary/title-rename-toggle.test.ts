/**
 * 自动摘要「用 AI 标题重命名笔记」开关（2026-11-28，fb-20261128-qqg-01）：
 *
 * 剪藏笔记写盘时 frontmatter 不带 title，自动摘要一跑就把文件名换成 AI 拟的标题。
 * QQ 群用户 Panda 报「书摘生成之后会把我原本剪藏的文章标题换掉」，作者定成可关：
 * 关掉后只补摘要与标签，不生成标题、也不改名，剪藏时的原标题原样保留。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { processFile } from '../../src/auto-summary/processor';
import { AUTO_SUMMARY_KEYS } from '../../src/auto-summary/keys';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';

const LONG_BODY = '段落内容。'.repeat(30); // >100 字

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

function makeAI(result: string) {
  return { prompt: vi.fn().mockResolvedValue(result) } as any;
}

/** 剪藏目录 + 关掉改名（关掉档的统一设置） */
function offSettings() {
  return { articleDirectory: '归档/网页剪藏', [AUTO_SUMMARY_KEYS.titleRename]: false } as any;
}

describe('自动摘要 · 用 AI 标题重命名笔记（开关）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    resetAIProviderCache();
    setAISettingsProvider(() => ({}));
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ articleDirectory: '归档/网页剪藏' }) as any);
  });

  it('默认开：缺 title 时照旧改名（老行为不变）', async () => {
    vault.files.set('归档/网页剪藏/原标题.md', `---\nurl: "https://x.com/a"\n---\n\n${LONG_BODY}`);
    const ai = makeAI('{"title":"AI 标题","summary":"摘要","tags":["a"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/原标题.md'));
    expect(vault.files.has('归档/网页剪藏/AI 标题.md')).toBe(true);
    expect(getNoticeMessages()).toContain('已重命名为《AI 标题》');
  });

  it('关掉：改名不发生、不写 title，只补摘要与标签，原字段全留', async () => {
    setSettingsProvider(offSettings);
    vault.files.set('归档/网页剪藏/原标题.md', `---\nurl: "https://x.com/a"\nsite: "示例站"\n---\n\n${LONG_BODY}`);
    const ai = makeAI('{"title":"AI 标题","summary":"摘要","tags":["a"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/原标题.md'));

    expect(vault.files.has('归档/网页剪藏/原标题.md')).toBe(true);
    expect(vault.files.has('归档/网页剪藏/AI 标题.md')).toBe(false);
    const out = vault.files.get('归档/网页剪藏/原标题.md')!;
    expect(out).toContain('summary: "摘要"');
    expect(out).toContain('  - "a"');
    expect(out).toContain('url: "https://x.com/a"');
    expect(out).toContain('site: "示例站"');
    expect(out).not.toContain('title: "AI 标题"');
    // 提示词不请求标题（省调用也避免模型白写一个用不上的字段）
    expect(ai.prompt.mock.calls[0][0]).not.toContain('生成中文标题');
    // 不弹改名回执
    expect(getNoticeMessages()).not.toContain('已重命名为《AI 标题》');
  });

  it('关掉后「字段齐全」判定不吃 title：已有 summary/tags 就跳过，不重复跑 AI', async () => {
    setSettingsProvider(offSettings);
    vault.files.set(
      '归档/网页剪藏/齐全.md',
      `---\nsummary: "已有摘要"\ntags:\n  - "a"\n---\n\n${LONG_BODY}`
    );
    const ai = makeAI('{"title":"T"}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/齐全.md'));
    expect(vault.modifiedPaths).toHaveLength(0);
    expect(ai.prompt).not.toHaveBeenCalled();
  });

  it('关掉后已带 title 的文件不被改写（原有字段不许动）', async () => {
    setSettingsProvider(offSettings);
    vault.files.set(
      '归档/网页剪藏/有题.md',
      `---\ntitle: "手工标题"\nurl: "https://x.com/t"\n---\n\n${LONG_BODY}`
    );
    const ai = makeAI('{"summary":"新摘要","tags":["a"]}');
    await processFile(makeApp(vault), ai, vault.file('归档/网页剪藏/有题.md'));
    const out = vault.files.get('归档/网页剪藏/有题.md')!;
    expect(out).toContain('title: "手工标题"');
    expect(out).toContain('summary: "新摘要"');
  });

  it('设置契约：默认值与设置面板行都在（键名走 keys.ts 单源）', () => {
    const s = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
    expect(s[AUTO_SUMMARY_KEYS.titleRename]).toBe(true);
    const ui = readFileSync(resolve(process.cwd(), 'src/clipbook/ui.ts'), 'utf8');
    expect(ui).toContain('AUTO_SUMMARY_KEYS.titleRename');
  });
});
