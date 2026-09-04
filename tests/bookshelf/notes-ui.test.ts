/**
 * 书架墙读书笔记 UI 测试（迁移自旧 tests/library/ui.test.ts 读书笔记部分 + 详情入口新增）：
 * 详情弹窗「N 划线 · N 批注」入口 / md 划线弹窗（加载占位/空态/双击跳转/双开竞态/编辑批注/删除划线）
 * / EPUB 划线弹窗（章节分组/weave-cfi 深链）/ 移动端全屏 / 关面板与卸载不留孤儿弹窗。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks, Platform as MockPlatform, hasNotice } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { M, resetBookshelfState } from '../../src/bookshelf/state';
import { ensureBookshelf, unloadBookshelf, openBookshelf } from '../../src/bookshelf';
import { createOverlay } from '../../src/bookshelf/ui';
import { showBookNotes, showEpubBookNotes, closeBookNoteModals } from '../../src/bookshelf/notes-ui';

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
readingDate: 2025-06-01
readingProgress: 60
highlights: 5
thinks: 2
---
正文
`;

const NOTE_MD = `# 第一章

<span data-id="h1" data-comment="批注一" data-date="2025-06-01" class="__comment cm-highlight">原文一</span>
`;

const EPUB_WEAVE = (vaultPath = '书库/悉达多.epub') => JSON.stringify({
  schemaVersion: 2,
  books: {
    bk_001: {
      id: 'bk_001',
      file: { vaultPath, sourceId: 'epubsrc-demo' },
      meta: { title: '悉达多', author: '赫尔曼·黑塞' },
      reading: { position: { chapterIndex: 0, cfi: '', percent: 0.6 }, stats: { totalReadTime: 0, lastReadTime: 0, createdTime: 0 } },
      notes: {
        bookmarks: [],
        highlights: [
          { id: 'h1', text: '原文一', commentText: '想法一', chapterIndex: 0, chapterTitle: '第一章', cfiRange: 'epubcfi(/6/2)!/4/4', createdTime: 1700000000000 },
        ],
        excerpts: [],
      },
    },
  },
});

/** 打开主面板并等待首次异步重建完成 */
async function openPanel(app: any) {
  createOverlay(app);
  await new Promise((r) => setTimeout(r, 20));
}

function detailPopup(): HTMLElement | null {
  return document.querySelector('.bz-bs-d-popup');
}

function notesPopup(): HTMLElement | null {
  return document.querySelector('.bz-bs-notes-pop');
}

/** 长按（core/dom longPress：mousedown 起 500ms 定时器） */
async function longPress(el: HTMLElement) {
  vi.useFakeTimers();
  el.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 10, clientY: 10 }));
  vi.advanceTimersByTime(550);
  el.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
  vi.useRealTimers();
  await new Promise((r) => setTimeout(r, 10));
}

describe('书架墙详情弹窗读书笔记入口（迁移自旧 library 域）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    closeBookNoteModals();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ bookshelfFolderPath: '', bookTag: 'book', bookshelfMobileDefaultFullscreen: true }) as any);
  });

  afterEach(() => {
    closeBookNoteModals();
    unloadBookshelf();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });

  it('详情弹窗出现「N 划线 · N 批注」可点入口；点击打开 md 读书笔记弹窗', async () => {
    // 书笔记正文含划线 span（高亮与书目同文件，旧域口径）
    vault.files.set('书库/活着.md', BOOK_MD + '\n' + NOTE_MD);
    const app = makeApp(vault);
    ensureBookshelf(app);
    await openPanel(app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card = Array.from(overlay.querySelectorAll('.bz-bs-book')).find((b) => b.textContent?.includes('活着')) as HTMLElement;
    card.click();
    const popup = detailPopup();
    expect(popup).toBeTruthy();
    const entry = popup!.querySelector('[data-bs-notes]') as HTMLElement;
    expect(entry).toBeTruthy();
    expect(entry.textContent).toContain('5 划线');
    expect(entry.textContent).toContain('2 批注');
    entry.click();
    await new Promise((r) => setTimeout(r, 30));
    // md 读书笔记弹窗打开：标题 + 划线内容 + 批注 + 日期
    const notes = notesPopup();
    expect(notes).toBeTruthy();
    expect(notes!.textContent).toContain('《活着》的读书笔记');
    expect(notes!.textContent).toContain('❝ 原文一');
    expect(notes!.textContent).toContain('批注一');
    expect(notes!.textContent).toContain('2025-06-01');
  });

  it('EPUB 书详情：读书笔记入口 → weave 划线/想法弹窗（章节分组）', async () => {
    vault.files.set('书库/活着.md', BOOK_MD);
    vault.files.set('CONFIG/STORAGE/weave-data.json', EPUB_WEAVE());
    const app = makeApp(vault);
    ensureBookshelf(app);
    await openPanel(app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card = Array.from(overlay.querySelectorAll('.bz-bs-book')).find((b) => b.textContent?.includes('悉达多')) as HTMLElement;
    card.click();
    const entry = detailPopup()!.querySelector('[data-bs-notes]') as HTMLElement;
    expect(entry.textContent).toContain('1 划线');
    entry.click();
    await new Promise((r) => setTimeout(r, 30));
    const notes = notesPopup();
    expect(notes).toBeTruthy();
    expect(notes!.textContent).toContain('《悉达多》的读书笔记');
    expect(notes!.textContent).toContain('第一章');
    expect(notes!.textContent).toContain('❝ 原文一');
    expect(notes!.textContent).toContain('想法一');
  });

  it('无划线无批注（0/0）→ 详情不出现读书笔记入口', async () => {
    vault.files.set('书库/算法导论.md', '---\ntags: [book]\nauthor: CLRS\n---');
    const app = makeApp(vault);
    ensureBookshelf(app);
    await openPanel(app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card = Array.from(overlay.querySelectorAll('.bz-bs-book')).find((b) => b.textContent?.includes('算法导论')) as HTMLElement;
    card.click();
    expect(detailPopup()!.querySelector('[data-bs-notes]')).toBeFalsy();
  });
});

describe('读书笔记弹窗（md 书）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    closeBookNoteModals();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ bookTag: 'book', bookshelfMobileDefaultFullscreen: true }) as any);
  });

  afterEach(() => {
    closeBookNoteModals();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });

  it('先建壳放「正在加载…」占位，read 完成后填入内容（l4 保持）', async () => {
    vault.files.set('书库/活着.md', NOTE_MD);
    let release!: (v: string) => void;
    const app = makeApp(vault);
    app.vault.read = vi.fn(() => new Promise<string>((r) => { release = r; })) as any;
    showBookNotes(app, '书库/活着.md');
    await new Promise((r) => setTimeout(r, 10));
    const shell = notesPopup();
    expect(shell).not.toBeNull();
    expect(shell!.querySelector('.bz-bs-notes-body')!.textContent).toContain('正在加载…');
    release(NOTE_MD);
    await new Promise((r) => setTimeout(r, 20));
    expect(shell!.textContent).toContain('❝ 原文一');
  });

  it('无高亮 → 组件库空态「没有找到高亮或批注」', async () => {
    vault.files.set('书库/活着.md', '# 第一章\n\n无高亮');
    showBookNotes(makeApp(vault), '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    expect(notesPopup()!.textContent).toContain('没有找到高亮或批注');
  });

  it('read 失败 → 壳内人话错误文案（不崩溃、壳保留）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vault.files.set('书库/活着.md', NOTE_MD);
    const app = makeApp(vault);
    app.vault.read = vi.fn().mockRejectedValue(new Error('disk io')) as any;
    showBookNotes(app, '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    expect(notesPopup()!.textContent).toContain('笔记读取失败，请稍后重试');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('文件不存在 → notice「文件不存在」且不建窗', async () => {
    showBookNotes(makeApp(vault), '书库/缺失.md');
    await new Promise((r) => setTimeout(r, 20));
    expect(hasNotice('文件不存在')).toBe(true);
    expect(notesPopup()).toBeNull();
  });

  it('P2 双弹窗竞态：vault.read 在途窗口内连开两本书，仅弹最后一本的一个弹窗', async () => {
    vault.files.set('书库/甲.md', NOTE_MD);
    vault.files.set('书库/乙.md', NOTE_MD.replace('第一章', '第二章'));
    const app = makeApp(vault);
    showBookNotes(app, '书库/甲.md'); // read 异步在途
    showBookNotes(app, '书库/乙.md'); // 紧接第二次打开
    await new Promise((r) => setTimeout(r, 30));
    const shells = document.querySelectorAll('.bz-bs-notes-pop');
    expect(shells.length).toBe(1);
    expect(shells[0].textContent).toContain('《乙》的读书笔记');
    expect(shells[0].textContent).toContain('第二章');
  });

  it('双击高亮块 → jumpToHighlight（openLinkText path#^id）+ 200ms 后关壳', async () => {
    vault.files.set('书库/活着.md', NOTE_MD);
    const app = makeApp(vault);
    showBookNotes(app, '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    const quote = [...document.querySelectorAll<HTMLElement>('.bz-bs-quote')].find((d) => d.textContent === '❝ 原文一')!;
    const block = quote.parentElement!.parentElement!; // quote → contentArea → block
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('书库/活着.md#^h1', '', false);
    await new Promise((r) => setTimeout(r, 260));
    expect(notesPopup()).toBeNull(); // 跳转后壳已关
  });

  it('audit H：跳转后 200ms 定时器只关当次弹窗，不误关 200ms 内重开的新弹窗', async () => {
    vault.files.set('书库/活着.md', NOTE_MD);
    const app = makeApp(vault);
    showBookNotes(app, '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    const quote = [...document.querySelectorAll<HTMLElement>('.bz-bs-quote')].find((d) => d.textContent === '❝ 原文一')!;
    const block = quote.parentElement!.parentElement!;
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); // 挂 200ms 定时器
    showBookNotes(app, '书库/活着.md'); // 立刻重开（新弹窗替换旧弹窗）
    await new Promise((r) => setTimeout(r, 300)); // 越过 200ms 定时器
    const shells = document.querySelectorAll('.bz-bs-notes-pop');
    expect(shells.length).toBe(1);
    expect(shells[0].textContent).toContain('❝ 原文一'); // 重开的弹窗未被旧定时器误关
  });

  it('长按内容 → 编辑批注弹窗；保存写盘（vault.process）并重开刷新', async () => {
    vault.files.set('书库/活着.md', NOTE_MD);
    const app = makeApp(vault);
    showBookNotes(app, '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    const contentArea = document.querySelector('.bz-bs-hl-body') as HTMLElement;
    await longPress(contentArea);
    const editPopup = document.querySelector('.bz-bs-edit-pop') as HTMLElement;
    expect(editPopup).toBeTruthy();
    expect(editPopup.textContent).toContain('编辑批注');
    expect(editPopup.textContent).toContain('❝ 原文一');
    const textarea = editPopup.querySelector('.bz-bs-edit-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('批注一');
    textarea.value = '新批注';
    (editPopup.querySelector('.bz-btn--primary') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 40));
    // 写盘（旧域 audit D 收口语义保持：vault.process 原子读改写）
    expect(vault.files.get('书库/活着.md')).toContain('data-comment="新批注"');
    // 编辑成功 → 弹窗关闭 + 笔记壳重开（刷新后显示新批注）
    expect(document.querySelector('.bz-bs-edit-pop')).toBeNull();
    expect(notesPopup()!.textContent).toContain('新批注');
  });

  it('长按日期 → 先关壳弹确认框；确认删除划线并重开（B2），取消则原样重开', async () => {
    vault.files.set('书库/活着.md', NOTE_MD);
    const app = makeApp(vault);
    showBookNotes(app, '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    const dateEl = document.querySelector('.bz-bs-hl-date--pointer') as HTMLElement;
    await longPress(dateEl);
    // 壳先关，确认框出现
    expect(notesPopup()).toBeNull();
    const okBtn = document.querySelector('#__shared_confirm_ok__') as HTMLElement;
    expect(okBtn).toBeTruthy();
    okBtn.click();
    await new Promise((r) => setTimeout(r, 40));
    expect(vault.files.get('书库/活着.md')).not.toContain('data-id="h1"');
    expect(hasNotice('已删除 1 条划线')).toBe(true);
    // 删除后重开壳（刷新列表）
    expect(notesPopup()).not.toBeNull();
    expect(notesPopup()!.textContent).toContain('没有找到高亮或批注');
  });

  it('移动端默认全屏：bookshelfMobileDefaultFullscreen 开 → 笔记弹窗挂 bz-win-mfs', async () => {
    vault.files.set('书库/活着.md', NOTE_MD);
    MockPlatform.isMobile = true;
    showBookNotes(makeApp(vault), '书库/活着.md');
    await new Promise((r) => setTimeout(r, 30));
    expect(notesPopup()!.classList.contains('bz-win-mfs')).toBe(true);
  });

  it('closeBookNoteModals / unloadBookshelf：不留孤儿弹窗（audit H 迁移面）', async () => {
    vault.files.set('书库/活着.md', BOOK_MD + '\n' + NOTE_MD);
    const app = makeApp(vault);
    ensureBookshelf(app);
    await openPanel(app);
    const overlay = document.querySelector('.bz-bs-overlay') as HTMLElement;
    const card = Array.from(overlay.querySelectorAll('.bz-bs-book')).find((b) => b.textContent?.includes('活着')) as HTMLElement;
    card.click();
    (detailPopup()!.querySelector('[data-bs-notes]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(notesPopup()).not.toBeNull();
    // toggle 关主面板：详情 + 读书笔记弹窗一并收口
    openBookshelf(app);
    expect(document.querySelector('.bz-bs-overlay')).toBeFalsy();
    expect(notesPopup()).toBeNull();
    expect(detailPopup()).toBeNull();
  });
});

describe('读书笔记弹窗（EPUB）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    closeBookNoteModals();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
    vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ bookTag: 'book' }) as any);
  });

  afterEach(() => {
    closeBookNoteModals();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });

  it('未找到阅读数据 → 组件库空态「未找到该书阅读数据」', async () => {
    showEpubBookNotes(makeApp(vault), '书库/缺失.epub', '缺失');
    await new Promise((r) => setTimeout(r, 30));
    expect(notesPopup()!.textContent).toContain('未找到该书阅读数据');
  });

  it('双击划线块 → weave-cfi 深链跳原文', async () => {
    vault.files.set('CONFIG/STORAGE/weave-data.json', EPUB_WEAVE());
    const app = makeApp(vault);
    showEpubBookNotes(app, '书库/悉达多.epub', '悉达多');
    await new Promise((r) => setTimeout(r, 30));
    const quote = [...document.querySelectorAll<HTMLElement>('.bz-bs-quote')].find((d) => d.textContent === '❝ 原文一')!;
    const block = quote.parentElement!.parentElement!;
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith(
      '书库/悉达多.epub#weave-cfi=epubcfi(/6/2)!/4/4&chapter=0&sid=epubsrc-demo',
      '',
      false
    );
  });

  it('长按内容 → 编辑想法；写回 weave-data.json 并重开刷新', async () => {
    vault.files.set('CONFIG/STORAGE/weave-data.json', EPUB_WEAVE());
    const app = makeApp(vault);
    showEpubBookNotes(app, '书库/悉达多.epub', '悉达多');
    await new Promise((r) => setTimeout(r, 30));
    const contentArea = document.querySelector('.bz-bs-hl-body') as HTMLElement;
    await longPress(contentArea);
    const editPopup = document.querySelector('.bz-bs-edit-pop') as HTMLElement;
    expect(editPopup.textContent).toContain('编辑想法');
    const textarea = editPopup.querySelector('.bz-bs-edit-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('想法一');
    textarea.value = '新想法';
    (editPopup.querySelector('.bz-btn--primary') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 40));
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/weave-data.json')!);
    expect(data.books.bk_001.notes.highlights[0].commentText).toBe('新想法');
    // 重开壳显示新想法
    expect(notesPopup()!.textContent).toContain('新想法');
  });

  it('长按日期 → 确认删除整条划线（weave-data.json 移除）+ 失败重开壳（B2）', async () => {
    vault.files.set('CONFIG/STORAGE/weave-data.json', EPUB_WEAVE());
    const app = makeApp(vault);
    showEpubBookNotes(app, '书库/悉达多.epub', '悉达多');
    await new Promise((r) => setTimeout(r, 30));
    const dateEl = document.querySelector('.bz-bs-hl-date--pointer') as HTMLElement;
    await longPress(dateEl);
    expect(notesPopup()).toBeNull(); // 先关壳
    (document.querySelector('#__shared_confirm_ok__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 40));
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/weave-data.json')!);
    expect(data.books.bk_001.notes.highlights).toHaveLength(0);
    // onChanged → 重开壳（此时已无划线 → 空态）
    expect(notesPopup()!.textContent).toContain('没有找到高亮或想法');
  });

  it('删除失败（weave-data 被并发移除）→ error toast + 重开壳（B2 不留死局）', async () => {
    vault.files.set('CONFIG/STORAGE/weave-data.json', EPUB_WEAVE());
    const app = makeApp(vault);
    showEpubBookNotes(app, '书库/悉达多.epub', '悉达多');
    await new Promise((r) => setTimeout(r, 30));
    const dateEl = document.querySelector('.bz-bs-hl-date--pointer') as HTMLElement;
    await longPress(dateEl);
    // 确认前外部把书从 weave-data.json 移除 → deleteEpubNote false
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify({ schemaVersion: 2, books: {} }));
    (document.querySelector('#__shared_confirm_ok__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 40));
    expect(hasNotice('删除划线和想法失败，请重试')).toBe(true);
    expect(notesPopup()).not.toBeNull(); // 失败也重开壳（未找到阅读数据空态）
  });
});

describe('mockAppWithVault 兼容（bookshelf 主面板数据源贯通读书笔记）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    closeBookNoteModals();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadBookshelf();
    document.body.innerHTML = '';
  });

  it('md 笔记行被划线解析消费：M.items → 详情入口 → 弹窗渲染同源数据', async () => {
    const vault = new MockVault();
    vault.files.set('书库/活着.md', BOOK_MD);
    vault.files.set('书库/读书笔记.md', NOTE_MD);
    const app = mockAppWithVault(vault) as any;
    (app as any).workspace = {
      ...(app as any).workspace,
      openLinkText: vi.fn(),
    };
    setApp(app);
    ensureBookshelf(app);
    await openPanel(app);
    expect(M.items.length).toBe(1);
    expect(M.items[0].highlights).toBe(5);
    // 直接走 showBookNotes（详情入口内部路径）
    showBookNotes(app, '书库/活着.md', '活着');
    await new Promise((r) => setTimeout(r, 20));
    expect(notesPopup()!.textContent).toContain('《活着》的读书笔记');
  });
});
