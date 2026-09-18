// @vitest-environment jsdom
/**
 * 剪藏本（clipbook）· T2 剪藏 frontmatter 三面契约往返钉死（review-deep clipbook-arch 测试缺口 2，随 A5 立项）
 *
 * 三面键（url/created/site/summary/tags）是 clipbook ↔ auto-summary ↔ smartcat 的正式接口，
 * master 基线（批 E，92dba387）上无任何跨面往返用例——三面靠注释维系。本文件钉死：
 *
 *   写侧 save.writeClipNote 模板
 *     → 读侧 scan.parseClipFile（url+created 必需，缺任一跳过）
 *     → 上游 auto-summary parseFrontmatter + processFile 缺失判定（空 summary/tags 判 missing）
 *     → 第三消费面 smartcat parseClipFrontmatter（url 为 rename 反查主锚点）。
 *
 * 改任一侧键名/引号风格/必需键，本文件即红。缺失判定表达式与
 * src/auto-summary/processor.ts（processFile 内联段）逐字对齐——该判定未导出为纯函数，
 * 以镜像 + 注释锚点方式钉；processor 改判定而不同步本文件 = 红灯。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { writeClipNote } from '../../src/clipbook/save';
import { parseClipFile, scanClipDirectory } from '../../src/clipbook/scan';
import { parseFrontmatter } from '../../src/auto-summary/parser';
import { parseClipFrontmatter } from '../../src/smartcat';

vi.mock('../../src/knowledge', () => ({
  openKnowledgeAddTask: vi.fn(),
  upgradeNoteSourceInternal: vi.fn(),
  retireKnowledgeSourcesForClip: vi.fn(),
}));

const RAW = (over: Record<string, unknown> = {}) => ({
  platform: '果壳科学人',
  title: '三面往返探针文',
  url: 'https://gk.com/fm-1',
  author: '果壳君',
  body: '往返正文一段。',
  date: '2026-09-01 08:00:00',
  summary: '三面探针摘要',
  tags: ['剪藏', '探针'],
  ...over,
});

const CLIP_PATH = '归档/网页剪藏/三面往返探针文.md';

function boot(): MockVault {
  const vault = new MockVault();
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

describe('T2 frontmatter 三面往返（writeClipNote → parseClipFile → auto-summary / smartcat）', () => {
  it('写侧产物 → scan.parseClipFile 读回：url/created/site/summary/tags 全命中、条目不跳过', async () => {
    const vault = boot();
    const ok = await writeClipNote(RAW());
    expect(ok).toBe(true);
    const md = vault.files.get(CLIP_PATH);
    expect(md).toBeTruthy();

    // 读侧（默认走 getApp().metadataCache——mockAppWithVault 与真机同形 getFileCache）
    const note = parseClipFile(vault.file(CLIP_PATH));
    expect(note).not.toBeNull(); // url+created 必需键在位 → 条目不被跳过
    expect(note!.url).toBe('https://gk.com/fm-1');
    expect(note!.site).toBe('果壳科学人');
    expect(note!.summary).toBe('三面探针摘要');
    expect(note!.tags).toEqual(['剪藏', '探针']);
    expect(note!.author).toBe('果壳君');
    expect(Number.isFinite(note!.created)).toBe(true);
    expect(note!.created).toBeGreaterThan(0);
    expect(note!.path).toBe(CLIP_PATH);
  });

  it('目录级往返：scanClipDirectory 对 writeClipNote 产物不整批消失（url 命中保底链）', async () => {
    const vault = boot();
    await writeClipNote(RAW());
    const notes = await scanClipDirectory('归档/网页剪藏', { vault });
    expect(notes).not.toBeNull();
    expect(notes).toHaveLength(1);
    expect(notes![0].url).toBe('https://gk.com/fm-1');
  });

  it('auto-summary 缺失判定：空 summary/tags 判 missing；有值判齐全（镜像 processor.processFile 判定段）', async () => {
    const vault = boot();
    // 场景一：写侧 summary/tags 为空（外部抓取常量缺省）→ 落盘空串/空列表
    await writeClipNote(RAW({ summary: '', tags: [] }));
    const md = vault.files.get(CLIP_PATH)!;
    const { fm } = parseFrontmatter(md);
    expect(fm).not.toBeNull();

    // 缺失判定镜像自 src/auto-summary/processor.ts processFile（tagsEnabled 默认 true）：
    //   if (!fm || !fm.title) missing.push('title');
    //   if (!fm || !fm.summary) missing.push('summary');
    //   if (tagsEnabled !== false && (!fm || !Array.isArray(fm.tags) || fm.tags.length === 0)) missing.push('tags');
    const missing: string[] = [];
    const tagsEnabled = true;
    if (!fm || !fm.title) missing.push('title');
    if (!fm || !fm.summary) missing.push('summary');
    if (tagsEnabled && (!fm || !Array.isArray(fm.tags) || fm.tags.length === 0)) missing.push('tags');
    expect(missing).toContain('summary'); // 空 summary → auto-summary 会补写
    expect(missing).toContain('tags'); // 空 tags → auto-summary 会补写
    expect(missing).toContain('title'); // 剪藏模板无 title 键（既有口径，一并钉死防漂移）

    // 场景二：summary/tags 有值 → 两键不进 missing（字段齐全不重写；title 键缺席仍按上口径）
    await writeClipNote(RAW({ url: 'https://gk.com/fm-2', title: '三面往返探针文二' }));
    const md2 = vault.files.get('归档/网页剪藏/三面往返探针文二.md')!;
    const { fm: fm2 } = parseFrontmatter(md2);
    const missing2: string[] = [];
    if (!fm2 || !fm2.title) missing2.push('title');
    if (!fm2 || !fm2.summary) missing2.push('summary');
    if (tagsEnabled && (!fm2 || !Array.isArray(fm2.tags) || fm2.tags.length === 0)) missing2.push('tags');
    expect(missing2).not.toContain('summary');
    expect(missing2).not.toContain('tags');
    // 键值经 auto-summary 解析后与写侧一致（引号风格不变形）
    expect(fm2!.summary).toBe('三面探针摘要');
    expect(fm2!.tags).toEqual(['剪藏', '探针']);
  });

  it('smartcat 第三消费面：parseClipFrontmatter 从写侧产物读出 url/summary/tags', async () => {
    const vault = boot();
    await writeClipNote(RAW());
    const md = vault.files.get(CLIP_PATH)!;
    const fm = parseClipFrontmatter(md);
    expect(fm.url).toBe('https://gk.com/fm-1'); // rename 反查主锚点（ticket 084b）
    expect(fm.summary).toBe('三面探针摘要');
    expect(fm.tags).toEqual(['剪藏', '探针']);
  });
});
