/**
 * 书架墙读书笔记 UI 测试（迁移自旧 tests/library/ui.test.ts 读书笔记部分 + 详情入口新增）：
 * 详情弹窗「N 划线 · N 批注」入口 / md 划线弹窗（加载占位/空态/双击跳转/双开竞态/编辑批注/删除划线）
 * / EPUB 划线弹窗（章节分组/weave-cfi 深链）/ 移动端全屏 / 关面板与卸载不留孤儿弹窗。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

describe('书架墙详情弹窗只读化（issue 223）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    closeBookNoteModals();
    document.body.innerHTML = '';
    vault = new MockVault();
  });

  it('详情卡不再提供读书笔记入口按钮（issue 223 只读化：划线/想法为纯展示文字）', async () => {
    vault.files.set('书库/活着.md', BOOK_MD + '\n' + NOTE_MD);
    const app = makeApp(vault);
    ensureBookshelf(app);
    await openPanel(app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    const card = Array.from(overlay.querySelectorAll('.bz-bs-spine')).find((b) => b.textContent?.includes('活着')) as HTMLElement;
    card.click();
    const popup = detailPopup();
    expect(popup).toBeTruthy();
    expect(popup!.querySelector('[data-bs-notes]')).toBeFalsy();
    expect(popup!.textContent).toContain('5 条 / 2 条');
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
    setSettingsProvider(() => ({ bookTag: 'book' }) as any);
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
    const quote = [...document.querySelectorAll<HTMLElement>('.bz-bs-hl-quote')].find((d) => d.textContent === '❝ 原文一')!;
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
    const quote = [...document.querySelectorAll<HTMLElement>('.bz-bs-hl-quote')].find((d) => d.textContent === '❝ 原文一')!;
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
    setSettingsProvider(() => ({ bookTag: 'book', bookshelfSkin: 'noir' }) as any); // issue 291：噪声肤验皮肤类随行
    const app = makeApp(vault);
    showBookNotes(app, '书库/活着.md');
    await new Promise((r) => setTimeout(r, 20));
    const dateEl = document.querySelector('.bz-bs-hl-date--pointer') as HTMLElement;
    await longPress(dateEl);
    // 壳先关，确认框出现
    expect(notesPopup()).toBeNull();
    const okBtn = document.querySelector('#__shared_confirm_ok__') as HTMLElement;
    expect(okBtn).toBeTruthy();
    // issue 291：确认框带统一壳 + 本域流程框类 + 当前皮肤类（挂 body 不掉回 core 裸皮）
    const confirmPopup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(confirmPopup.classList.contains('bz-overlay-popup')).toBe(true);
    expect(confirmPopup.classList.contains('bz-flow-dialog')).toBe(true);
    expect(confirmPopup.classList.contains('bz-bs-flow-dialog')).toBe(true);
    expect(confirmPopup.classList.contains('bz-bs-skin-noir')).toBe(true);
    expect(confirmPopup.classList.contains('bz-bs-mode-light')).toBe(true);
    // issue 291 评审补：删除划线是危险主动作 → 挂危险修饰（主钮中性底 + 红字，手册 §9/§10）
    expect(confirmPopup.classList.contains('bz-flow-dialog--danger')).toBe(true);
    expect(okBtn.className).toBe(''); // 冻结契约：标准双动作按钮不加类
    okBtn.click();
    await new Promise((r) => setTimeout(r, 40));
    expect(vault.files.get('书库/活着.md')).not.toContain('data-id="h1"');
    // 删除后重开壳（刷新列表）
    expect(notesPopup()).not.toBeNull();
    expect(notesPopup()!.textContent).toContain('没有找到高亮或批注');
  });

  it('closeBookNoteModals / unloadBookshelf：不留孤儿弹窗（audit H 迁移面）', async () => {
    vault.files.set('书库/活着.md', BOOK_MD + '\n' + NOTE_MD);
    const app = makeApp(vault);
    ensureBookshelf(app);
    await openPanel(app);
    // 详情卡只读化后笔记入口移除：直开读书笔记弹窗再测关面板收口
    showBookNotes(app, '书库/活着.md', '活着');
    await new Promise((r) => setTimeout(r, 30));
    expect(notesPopup()).not.toBeNull();
    openBookshelf(app);
    expect(document.querySelector('.bz-panel-overlay')).toBeFalsy();
    expect(notesPopup()).toBeNull();
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
    const quote = [...document.querySelectorAll<HTMLElement>('.bz-bs-hl-quote')].find((d) => d.textContent === '❝ 原文一')!;
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
    setSettingsProvider(() => ({ bookTag: 'book', bookshelfSkin: 'kraft' }) as any); // issue 291：EPUB 路径同样验皮肤类
    const app = makeApp(vault);
    showEpubBookNotes(app, '书库/悉达多.epub', '悉达多');
    await new Promise((r) => setTimeout(r, 30));
    const dateEl = document.querySelector('.bz-bs-hl-date--pointer') as HTMLElement;
    await longPress(dateEl);
    expect(notesPopup()).toBeNull(); // 先关壳
    // issue 291：EPUB 删除确认框与 md 路径同壳同皮（挂 body 带 skin 类）
    const confirmPopup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(confirmPopup.classList.contains('bz-bs-flow-dialog')).toBe(true);
    expect(confirmPopup.classList.contains('bz-bs-skin-kraft')).toBe(true);
    // issue 291 评审补：EPUB 路径同样标 danger（删除钮不得高亮）
    expect(confirmPopup.classList.contains('bz-flow-dialog--danger')).toBe(true);
    (document.querySelector('#__shared_confirm_ok__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 40));
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/weave-data.json')!);
    expect(data.books.bk_001.notes.highlights).toHaveLength(0);
    // onChanged → 重开壳（此时已无划线 → 空态）
    expect(notesPopup()!.textContent).toContain('没有找到高亮或想法');
  });

  it('G11 验证：连开两本 EPUB，旧书在途 async 后到 → 旧壳已移除不覆盖新书壳（无残留可交互块）', async () => {
    // 两本书：A/B 各一条划线；A 的首次 weave-data 读取挂起（在途窗口）
    const twoBooks = {
      schemaVersion: 2,
      books: {
        bk_a: {
          id: 'bk_a',
          file: { vaultPath: '书库/A.epub', sourceId: 'sid-a' },
          meta: { title: 'A 书', author: '甲' },
          reading: { position: { chapterIndex: 0, cfi: '', percent: 0.5 }, stats: { totalReadTime: 0, lastReadTime: 0, createdTime: 0 } },
          notes: { bookmarks: [], excerpts: [], highlights: [
            { id: 'ha', text: 'A 的划线', commentText: '', chapterIndex: 0, chapterTitle: '章 A', cfiRange: 'epubcfi(/6/2)!/4/2', createdTime: 1700000000000 },
          ] },
        },
        bk_b: {
          id: 'bk_b',
          file: { vaultPath: '书库/B.epub', sourceId: 'sid-b' },
          meta: { title: 'B 书', author: '乙' },
          reading: { position: { chapterIndex: 0, cfi: '', percent: 0.5 }, stats: { totalReadTime: 0, lastReadTime: 0, createdTime: 0 } },
          notes: { bookmarks: [], excerpts: [], highlights: [
            { id: 'hb', text: 'B 的划线', commentText: '', chapterIndex: 0, chapterTitle: '章 B', cfiRange: 'epubcfi(/6/2)!/4/3', createdTime: 1700000000000 },
          ] },
        },
      },
    };
    vault.files.set('CONFIG/STORAGE/weave-data.json', JSON.stringify(twoBooks));
    const app = makeApp(vault);
    // A 的首次 weave-data 读取挂起：showEpubBookNotes(A) 的 async 停在在途
    let releaseA!: (v: string) => void;
    const gate = new Promise<string>((r) => { releaseA = r; });
    let firstWeaveRead = true;
    const realRead = vault.adapter.read.bind(vault.adapter);
    (vault.adapter as any).read = async (path: string) => {
      if (firstWeaveRead && path === 'CONFIG/STORAGE/weave-data.json') {
        firstWeaveRead = false;
        return gate;
      }
      return realRead(path);
    };

    showEpubBookNotes(app, '书库/A.epub', 'A 书');
    await new Promise((r) => setTimeout(r, 20)); // A 壳建立、async 挂在首次读取
    showEpubBookNotes(app, '书库/B.epub', 'B 书'); // 开 B：先关 A 壳（同步 remove）
    await new Promise((r) => setTimeout(r, 20)); // B 渲染完成
    expect(document.querySelectorAll('.bz-bs-notes-pop')).toHaveLength(1);
    expect(notesPopup()!.textContent).toContain('B 的划线');
    expect(notesPopup()!.textContent).not.toContain('A 的划线');

    // 旧书 async 后到：渲染只落已移除的 A 壳容器（孤立节点），不覆盖 B 壳
    releaseA(JSON.stringify(twoBooks));
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('.bz-bs-notes-pop')).toHaveLength(1);
    expect(notesPopup()!.textContent).toContain('B 的划线');
    expect(notesPopup()!.textContent).not.toContain('A 的划线');
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

describe('issue 291：删除划线确认框随面板皮肤（样式源文本断言）', () => {
  const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
  const bsCss = () => repo('src/bookshelf/styles.css');
  const notesUi = () => repo('src/bookshelf/notes-ui.ts');

  it('notes-ui.ts 两处删除划线确认框都传了流程框类 + 皮肤类（md / EPUB 双路径）', () => {
    const src = notesUi();
    // md 路径（buildMdHighlightBlock）与 EPUB 路径（buildEpubHighlightBlock）各一处
    expect(src.match(/className: 'bz-bs-flow-dialog ' \+ bsSkinClass\(\)/g)?.length).toBe(2);
    expect(src).toContain("import { bsSkinClass } from './ui';");
    // 两处 openFlowDialog 都在（防只改一处后另一处悄悄漏）
    expect(src.match(/openFlowDialog\(\{/g)?.length).toBe(2);
  });

  it('styles.css 有 #__shared_confirm_popup__.bz-bs-flow-dialog 规则块（id 提特异性覆盖 core）', () => {
    const block = bsCss().match(/#__shared_confirm_popup__\.bz-bs-flow-dialog\s*\{([^}]*)\}/);
    expect(block, '缺 #__shared_confirm_popup__.bz-bs-flow-dialog 块').not.toBeNull();
    // 纸卡壳取值：底/描边消费 --bsw-* 域变量（借书卡详情弹窗同套 token）
    expect(block![1]).toContain('background: var(--bsw-paper)');
    expect(block![1]).toContain('border-color: var(--bsw-line)');
    // 字体栈在 body 外取不到 → 必须自带（否则衬线标题失效）
    expect(block![1]).toContain('--bsw-serif');
    expect(block![1]).toContain('--bsw-sans');
  });

  it('标题/正文/按钮映射借书卡详情那套取值；暗色不另写块（skin+mode 变体整组换 token）', () => {
    const css = bsCss();
    expect(css, '缺标题映射').toMatch(/#__shared_confirm_popup__\.bz-bs-flow-dialog h4\s*\{[^}]*font-family: var\(--bsw-serif\)/);
    expect(css, '缺正文映射').toMatch(/#__shared_confirm_popup__\.bz-bs-flow-dialog p\s*\{[^}]*font-family: var\(--bsw-sans\)/);
    expect(css, '缺按钮映射').toMatch(/#__shared_confirm_popup__\.bz-bs-flow-dialog #__shared_confirm_ok__\s*\{[^}]*font-family: var\(--bsw-serif\)/);
    // 本域亮暗由 `.bz-bs-skin-*` × `.bz-bs-mode-*` 变体承担（skin 类随 bsSkinClass() 一起挂到 popup），
    // 故确认框不需要也不该另写 .theme-dark 块——有则是把两套口径混用。
    expect(css).not.toMatch(/\.theme-dark #__shared_confirm_popup__\.bz-bs-flow-dialog/);
  });
});
