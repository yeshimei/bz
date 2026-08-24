/**
 * 书库 UI 测试（ticket 12）：showLibrary 面板/设置弹窗/读书笔记弹窗。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { escManager } from '../../src/core/esc-manager';
import { showLibrary, showBookNotes, openFilterModal, _testResetLibrary } from '../../src/library/ui';
import { openBookNotes } from '../../src/library/index';
import { MockVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks, Platform as MockPlatform, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { closeItemMenu } from '../../src/core/item-actions';

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
    plugins: { plugins: { 'weave-epub-reader': { settings: { dataPath: 'CONFIG/STORAGE' } } } },
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
    closeItemMenu();
    MockPlatform.isMobile = false;
  });

  it('抽屉（移动端长按）：头部📖书名+作者·状态·进度；动作=打开原文/读书笔记；点打开原文跳转', async () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    const app = makeApp(vault);
    showLibrary(app);
    await new Promise((r) => setTimeout(r, 20));
    const card = document.querySelector('#__book_library__ .bz-lib-card') as HTMLElement;
    expect(card.classList.contains('bz-item-card')).toBe(true);

    MockPlatform.isMobile = true;
    vi.useFakeTimers();
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 20));

    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    // 头部：📖 + 书名；小字=作者 · 状态 · 进度
    expect(sheet.querySelector('.bz-item-sheet-title')!.textContent).toBe('活着');
    expect(sheet.querySelector('.bz-item-sheet-sub')!.textContent).toContain('余华');
    expect(sheet.querySelector('.bz-item-sheet-sub')!.textContent).toContain('在读');
    expect(sheet.querySelector('.bz-item-sheet-sub')!.textContent).toContain('60%');
    // 动作清单（用户拍板：无编辑无删除）
    const labels = [...sheet.querySelectorAll('.bz-item-sheet-label')].map((e) => e.textContent);
    expect(labels).toEqual(['打开原文', '读书笔记']);

    // 点「打开原文」→ openLinkText + 主面板隐藏
    const openItem = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('打开原文')
    ) as HTMLElement;
    openItem.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('书库/活着.md', '', false);
  });

  it('桌面右键 → 菜单「读书笔记」→ 划线弹窗打开', async () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    vault.files.set('书库/读书笔记/活着.md', NOTE_MD);
    const app = makeApp(vault);
    showLibrary(app);
    const card = document.querySelector('#__book_library__ .bz-lib-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
    const noteItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('读书笔记')
    ) as HTMLElement;
    expect(noteItem).toBeTruthy();
    noteItem.click();
    await new Promise((r) => setTimeout(r, 30));
    const overlay = [...document.querySelectorAll('div')].find((d) => d.textContent!.includes('的读书笔记'))!;
    expect(overlay.textContent).toContain('📚 《活着》的读书笔记');
  });

  it('无书 → Notice 提示且遮罩移除（EPUB 合并后判空）', async () => {
    showLibrary(makeApp(vault));
    await new Promise((r) => setTimeout(r, 20));
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

  it('⚙️ 打开书库设置弹窗（分组卡片：目录/列表显示/移动端）；🔀 为筛选弹窗', () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' } as any));
    const app = makeApp(vault);
    showLibrary(app);
    const filterBtn = [...document.querySelectorAll('button')].find((b) => b.title === '视图与筛选')!;
    expect(filterBtn.textContent).toBe('🔀');
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '书库设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('书库设置');
    // 分组卡片结构：桌面 2 组（目录/列表显示；移动端组移动端才渲染），原生图标 + 徽标回填项数
    const heads = [...popup.querySelectorAll('.bz-settings-group-head')];
    expect(heads.map((el) => (el as HTMLElement).textContent!.trim())).toEqual(['目录2 项', '列表显示5 项']);
    expect(heads.map((el) => el.querySelector('.bz-settings-group-icon')!.getAttribute('data-icon'))).toEqual(['folder-open', 'eye']);
    const names = [...popup.querySelectorAll('.bz-settings-group-body .setting-item')].map((el) => (el as HTMLElement).dataset.name);
    expect(names).toEqual([
      '书库文件夹', '书籍识别标签',
      '显示文件大小', '显示阅读时长', '显示划线数', '显示想法数', '显示书评摘要',
    ]);
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
    const quote = [...document.querySelectorAll<HTMLElement>('.bz-lib-quote')].find((d) => d.textContent === '❝ 原文一')!;
    const block = quote.parentElement!.parentElement!; // quote → contentArea → block
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('书库/活着.md#^h1', '', false);
  });

  it('EPUB 条目并入列表（读 weave-data.json）；双击封面跳 Weave 打开', async () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      schemaVersion: 2,
      books: {
        bk_001: {
          id: 'bk_001',
          file: { vaultPath: 'Books/悉达多.epub' },
          meta: { title: '悉达多', author: '赫尔曼·黑塞', chapterCount: 10 },
          reading: { position: { chapterIndex: 0, cfi: '', percent: 0 }, stats: { totalReadTime: 0, lastReadTime: 0, createdTime: 0 } },
          notes: { bookmarks: [], highlights: [], excerpts: [] },
        },
      },
    }));
    const app = makeApp(vault);
    showLibrary(app);
    await new Promise((r) => setTimeout(r, 20));
    const overlay = document.getElementById('__book_library__')!;
    expect(overlay.textContent).toContain('悉达多');
    // 双击封面 → 打开阅读器（用户拍板保留双击转跳）
    const cover = [...overlay.querySelectorAll('.bz-lib-cover')].pop() as HTMLElement;
    cover.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('Books/悉达多.epub', '', false);
  });

  it('EPUB 封面单击 → 读书笔记弹窗（划线+想法+章节标题）', async () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      schemaVersion: 2,
      books: {
        bk_001: {
          id: 'bk_001',
          file: { vaultPath: '书库/悉达多.epub', sourceId: 'epubsrc-demo' },
          meta: { title: '悉达多', author: '赫尔曼·黑塞', chapterCount: 10 },
          reading: { position: { chapterIndex: 0, cfi: '', percent: 0 }, stats: { totalReadTime: 0, lastReadTime: 0, createdTime: 0 } },
          notes: {
            bookmarks: [],
            highlights: [
              { id: 'h1', text: '原文一', commentText: '想法一', chapterIndex: 0, chapterTitle: '第一章', cfiRange: 'epubcfi(/6/2)!/4/4', createdTime: 1700000000000 },
            ],
            excerpts: [],
          },
        },
      },
    }));
    const app = makeApp(vault);
    showLibrary(app);
    await new Promise((r) => setTimeout(r, 20));
    // 找封面容器（EPUB 卡片第一个 coverWghapter 区域）：直接调 showEpubBookNotes
    const { showEpubBookNotes } = await import('../../src/library/ui');
    showEpubBookNotes(app, {
      file: { path: '书库/悉达多.epub' },
      title: '悉达多',
      isEpub: true,
    } as any);
    await new Promise((r) => setTimeout(r, 30));
    const overlay = [...document.querySelectorAll('div')].find((d) => d.textContent!.includes('的读书笔记'))!;
    expect(overlay.textContent).toContain('📚 《悉达多》的读书笔记');
    expect(overlay.textContent).toContain('第一章');
    expect(overlay.textContent).toContain('❝ 原文一');
    expect(overlay.textContent).toContain('想法一');
  });

  it('EPUB 读书笔记：双击划线块 → 跳原文 weave-cfi 深链', async () => {
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({
      schemaVersion: 2,
      books: {
        bk_001: {
          id: 'bk_001',
          file: { vaultPath: '书库/悉达多.epub', sourceId: 'epubsrc-demo' },
          meta: { title: '悉达多', author: '', chapterCount: 10 },
          reading: { position: { chapterIndex: 0, cfi: '', percent: 0 }, stats: { totalReadTime: 0, lastReadTime: 0, createdTime: 0 } },
          notes: {
            bookmarks: [],
            highlights: [
              { id: 'h1', text: '原文一', commentText: '', chapterIndex: 0, chapterTitle: '第一章', cfiRange: 'epubcfi(/6/2)!/4/4', createdTime: 1700000000000 },
            ],
            excerpts: [],
          },
        },
      },
    }));
    const app = makeApp(vault);
    const { showEpubBookNotes } = await import('../../src/library/ui');
    showEpubBookNotes(app, { file: { path: '书库/悉达多.epub' }, title: '悉达多', isEpub: true } as any);
    await new Promise((r) => setTimeout(r, 30));
    const quote = [...document.querySelectorAll<HTMLElement>('.bz-lib-quote')].find((d) => d.textContent === '❝ 原文一')!;
    const block = quote.parentElement!.parentElement!;
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith(
      '书库/悉达多.epub#weave-cfi=epubcfi(/6/2)!/4/4&chapter=0&sid=epubsrc-demo',
      '',
      false
    );
  });
});

describe('移动端默认全屏（ticket 68）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    _testResetLibrary();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });

  afterEach(() => {
    _testResetLibrary();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });

  it('主面板：桌面不挂；移动端+开关开 → .bz-lib-modal--full 挂 bz-win-mfs（复用打开也重挂）', async () => {
    const vault = new MockVault();
    vault.files.set('书库/活着.md', BOOK_MD);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book', libraryMobileDefaultFullscreen: true } as any));
    const app = makeApp(vault);
    showLibrary(app);
    await new Promise((r) => setTimeout(r, 60));
    const modal = document.querySelector('.bz-lib-modal--full') as HTMLElement | null;
    expect(modal).not.toBeNull();
    expect(modal!.classList.contains('bz-win-mfs')).toBe(false);
    // 移动端：复用打开路径（visibility 常驻）也重挂
    MockPlatform.isMobile = true;
    showLibrary(app);
    await new Promise((r) => setTimeout(r, 60));
    expect(document.querySelector('.bz-lib-modal--full')!.classList.contains('bz-win-mfs')).toBe(true);
  });

  it('读书笔记弹窗：移动端+开关开 → .bz-lib-modal--full-lg 挂 bz-win-mfs（与主面板同控）', async () => {
    const vault = new MockVault();
    vault.files.set('书库/活着.md', NOTE_MD);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book', libraryMobileDefaultFullscreen: true } as any));
    MockPlatform.isMobile = true;
    showBookNotes(makeApp(vault), '书库/活着.md');
    await new Promise((r) => setTimeout(r, 60));
    const modal = document.querySelector('.bz-lib-modal--full-lg') as HTMLElement | null;
    expect(modal).not.toBeNull();
    expect(modal!.classList.contains('bz-win-mfs')).toBe(true);
  });

  it('书库设置弹窗：仅移动端显示「移动端默认全屏」行', async () => {
    const vault = new MockVault();
    vault.files.set('书库/活着.md', BOOK_MD);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' } as any));
    const app = makeApp(vault);
    showLibrary(app);
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '书库设置')!;
    const settingNames = () =>
      [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].map((el) => (el as HTMLElement).dataset.name);
    settingsBtn.click();
    expect(settingNames()).not.toContain('移动端默认全屏');
    MockPlatform.isMobile = true;
    settingsBtn.click(); // toggle：关旧开新
    expect(settingNames()).toContain('移动端默认全屏');
  });
});

describe('书库修复回归（fx-library）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    _testResetLibrary();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' }) as any);
  });

  afterEach(() => {
    _testResetLibrary();
    document.body.innerHTML = '';
    closeItemMenu();
    MockPlatform.isMobile = false;
  });

  it('P0-9：关书库（visibility 常驻）后，注册序更早的他域层能收到 ESC（两层模拟）；三条关闭路径语义一致', async () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    const app = makeApp(vault);
    const closedOrder: string[] = [];
    // 他域层先注册（注册序早于 lib → ESC 优先级更低）
    const other = escManager.register('other-domain', { isVisible: () => true, close: () => closedOrder.push('other') });
    try {
      showLibrary(app);
      await new Promise((r) => setTimeout(r, 20));
      const overlay = document.getElementById('__book_library__')!;
      expect(overlay).not.toBeNull();

      // ① 面板开着：ESC 只关书库层（更高优先），他域层不动
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closedOrder).toEqual([]);
      expect(overlay.style.visibility).toBe('hidden');
      expect(overlay.isConnected).toBe(true); // visibility:hidden 复用机制保留

      // ② 已关：lib 层 isVisible 判假 → 他域层收到 ESC
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closedOrder).toEqual(['other']);

      // ③ 另两条关闭路径同样置 hidden 且不卸载：关闭按钮 / 遮罩点击
      showLibrary(app); // 复用打开
      const closeBtn = [...overlay.querySelectorAll<HTMLElement>('button')].find((b) => b.title === '关闭')!;
      closeBtn.click();
      expect(overlay.style.visibility).toBe('hidden');
      showLibrary(app);
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true })); // target === overlay
      expect(overlay.style.visibility).toBe('hidden');
    } finally {
      other.unregister();
    }
  });

  it('P0-7：读书笔记壳 z-index 落在 11100/11101 档（压过抽屉遮罩 10999/本体 11000）', async () => {
    vault.files.set('书库/活着.md', NOTE_MD);
    showBookNotes(makeApp(vault), '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    // 壳元素挂新档类名；jsdom 不做 CSS 级联，z-index 档位以源样式表规则为准断言 ≥11100
    const shell = document.querySelector('.bz-lib-overlay--11100') as HTMLElement | null;
    expect(shell).not.toBeNull();
    const css = readFileSync(resolve(process.cwd(), 'src/library/styles.css'), 'utf8');
    const zi = (cls: string): number => {
      const m = css.match(new RegExp(`\\.bz-lib-overlay--${cls}\\s*\\{\\s*z-index:\\s*(\\d+)`));
      return m ? parseInt(m[1], 10) : -1;
    };
    expect(zi('11100')).toBeGreaterThanOrEqual(11100); // 壳：压过遮罩 10999 与抽屉本体 11000
    expect(zi('11101')).toBeGreaterThan(zi('11100')); // 编辑弹窗档仍压过壳
    // 旧低档类名不再被读书笔记壳使用
    expect(shell!.className).not.toContain('--1200');
  });

  it('P1-19：复用打开重扫数据——打开→外部加书目→重开可见新书', async () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    const app = makeApp(vault);
    showLibrary(app);
    await new Promise((r) => setTimeout(r, 20));
    let overlay = document.getElementById('__book_library__')!;
    expect(overlay.textContent).not.toContain('三体');

    // 关闭（visibility 常驻复用），外部新增书目后重开
    ([...overlay.querySelectorAll<HTMLElement>('button')].find((b) => b.title === '关闭')!).click();
    vault.files.set('书库/三体.md', BOOK_MD.replace('余华', '刘慈欣'));
    showLibrary(app);
    await new Promise((r) => setTimeout(r, 20));

    overlay = document.getElementById('__book_library__')!;
    expect(overlay.style.visibility).toBe('visible');
    expect(overlay.textContent).toContain('三体');
    expect(overlay.textContent).toContain('刘慈欣');
  });

  it('P2 双弹窗竞态：vault.read 在途窗口内连开两本书，仅弹最后一本的一个弹窗', async () => {
    vault.files.set('书库/甲.md', NOTE_MD);
    vault.files.set('书库/乙.md', NOTE_MD.replace('第一章', '第二章'));
    const app = makeApp(vault);
    showBookNotes(app, '书库/甲.md'); // read 异步在途
    showBookNotes(app, '书库/乙.md'); // 紧接第二次打开
    await new Promise((r) => setTimeout(r, 30));

    const notesShells = [...document.querySelectorAll('.bz-lib-overlay--11100')];
    expect(notesShells.length).toBe(1);
    expect(notesShells[0].textContent).toContain('📚 《乙》的读书笔记');
    expect(notesShells[0].textContent).toContain('第二章');
  });
});
