/**
 * 书库 UI 测试（ticket 12）：showLibrary 面板/设置弹窗/读书笔记弹窗。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { showLibrary, showBookNotes, openFilterModal, _testResetLibrary } from '../../src/library/ui';
import { openBookNotes } from '../../src/library/index';
import { MockVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';

function makeApp(vault: MockVault, extra: any = {}) {
  return {
    vault,
    metadataCache: {
      getFileCache: (f: any) => {
        const content = vault.files.get(f.path) ?? '';
        const fm = parseFrontmatter(content);
        return fm && Object.keys(fm).length ? { frontmatter: fm } : null;
      },
    },
    workspace: {
      openLinkText: vi.fn(),
      getActiveFile: vi.fn(() => null),
    },
    commands: { executeCommandById: vi.fn() },
    ...extra,
  } as any;
}

const BOOK_MD = `---
tags: ["book"]
author: "余华"
category: "小说"
readingDate: 2025-06-01
readingProgress: 60
readingTimeFormat: "2小时"
highlights: 5
thinks: 2
bookReview: "活着真好"
---
正文
`;

const NOTE_MD = `# 第一章

<span data-id="h1" data-comment="批注一" data-date="2025-06-01" class="__comment cm-highlight">原文一</span>
`;

describe('书库面板', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    _testResetLibrary();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book', showFileSize: true, showReadingTime: true, showHighlights: true, showThinks: true, showReview: true }) as any);
  });

  afterEach(() => {
    _testResetLibrary();
    document.body.innerHTML = '';
  });

  it('无书 → Notice 提示', () => {
    showLibrary(makeApp(vault));
    expect(hasNotice(/未找到任何书籍笔记/)).toBe(true);
    expect(document.getElementById('__book_library__')).toBeNull();
  });

  it('渲染卡片（标题/作者/进度/时长/划线/想法/书评）', async () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    showLibrary(makeApp(vault));
    await new Promise((r) => setTimeout(r, 20));
    const overlay = document.getElementById('__book_library__')!;
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('活着');
    expect(overlay.textContent).toContain('✍️ 余华');
    expect(overlay.textContent).toContain('📊 60%');
    expect(overlay.textContent).toContain('⏱️ 2小时');
    expect(overlay.textContent).toContain('💡 划线5');
    expect(overlay.textContent).toContain('🧠 想法2');
    expect(overlay.textContent).toContain('活着真好');
    // 已读状态不显示徽章
    expect(overlay.textContent).toContain('在读');
  });

  it('🧮 按钮 → executeCommandById bz-reading-report-open', () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    const app = makeApp(vault);
    showLibrary(app);
    const reportBtn = [...document.querySelectorAll<HTMLElement>('#__book_library__ button')].find((b) => b.textContent === '🧮')!;
    reportBtn.click();
    expect(app.commands.executeCommandById).toHaveBeenCalledWith('bz-reading-report-open');
  });

  it('设置弹窗：分类/状态/排序胶囊', () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    const app = makeApp(vault);
    showLibrary(app);
    openFilterModal(app);
    const modal = [...document.querySelectorAll('div')].find((d) => d.textContent!.includes('视图与筛选'))!;
    expect(modal.textContent).toContain('小说');
    expect(modal.textContent).toContain('未读');
    expect(modal.textContent).toContain('书名 A-Z');
    // 点状态「在读」→ 过滤
    const readBtn = [...modal.querySelectorAll('button')].find((b) => b.textContent === '在读')!;
    readBtn.click();
    expect(document.getElementById('__book_library__')!.textContent).toContain('活着');
  });

  it('⚙️ 打开书库设置弹窗（文件夹/识别标签/显示开关）；🔀 为筛选弹窗', () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', libraryNotePath: '我的/读书笔记', bookTag: 'book' }));
    const app = makeApp(vault);
    showLibrary(app);
    const filterBtn = [...document.querySelectorAll('button')].find((b) => b.title === '视图与筛选')!;
    expect(filterBtn.textContent).toBe('🔀');
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '书库设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('书库设置');
    const names = [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    expect(names).toContain('书库文件夹');
    expect(names).toContain('读书笔记路径');
    expect(names).toContain('书籍识别标签');
    expect(names).toContain('显示文件大小');
    expect(names).toContain('显示书评摘要');
  });

  it('读书笔记弹窗：标题/❝ 高亮/批注', async () => {
    vault.files.set('书库/活着.md', NOTE_MD);
    const app = makeApp(vault);
    showBookNotes(app, '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    const overlay = [...document.querySelectorAll('div')].find((d) => d.textContent!.includes('的读书笔记'))!;
    expect(overlay.textContent).toContain('📚 《活着》的读书笔记');
    expect(overlay.textContent).toContain('❝ 原文一');
    expect(overlay.textContent).toContain('批注一');
    expect(overlay.textContent).toContain('2025-06-01');
  });

  it('无高亮 → 「📭 没有找到高亮或批注」', async () => {
    vault.files.set('书库/活着.md', '# 第一章\n\n无高亮');
    showBookNotes(makeApp(vault), '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    const overlay = [...document.querySelectorAll('div')].find((d) => d.textContent!.includes('的读书笔记'))!;
    expect(overlay.textContent).toContain('📭 没有找到高亮或批注');
  });

  it('openBookNotes：无活动文件 → 「没有打开的文件」', () => {
    openBookNotes(makeApp(vault));
    expect(hasNotice('没有打开的文件')).toBe(true);
  });

  it('openBookNotes：有活动文件 → 打开笔记弹窗', async () => {
    vault.files.set('书库/活着.md', NOTE_MD);
    const app = makeApp(vault);
    app.workspace.getActiveFile = vi.fn(() => ({ path: '书库/活着.md', basename: '活着' }));
    openBookNotes(app);
    await new Promise((r) => setTimeout(r, 20));
    const overlay = [...document.querySelectorAll('div')].find((d) => d.textContent!.includes('的读书笔记'))!;
    expect(overlay.textContent).toContain('❝ 原文一');
  });

  it('双击高亮块 → jumpToHighlight（openLinkText path#^id）', async () => {
    vault.files.set('书库/活着.md', NOTE_MD);
    const app = makeApp(vault);
    showBookNotes(app, '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    const quote = [...document.querySelectorAll('div')].find((d) => d.style.cssText.includes('font-style: italic') && d.textContent === '❝ 原文一')!;
    const block = quote.parentElement!.parentElement!; // quote → contentArea → block
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('书库/活着.md#^h1', '', false);
  });
});
