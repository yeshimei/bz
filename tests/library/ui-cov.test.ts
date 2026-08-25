/**
 * 书库 UI 补测（覆盖率目标）：封面分支、卡片 chip 显隐开关、筛选弹窗全量交互、
 * 读书笔记树递归（无高亮小节跳过/标题脚注清理/无批注无日期块）、编辑批注弹窗、
 * EPUB 读书笔记分组/跳转/删除/编辑、纯 EPUB 空态加载占位。
 * 兼容性冻结：只按现状断言，不改生产代码。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  showLibrary,
  showBookNotes,
  showEpubBookNotes,
  openFilterModal,
  closeFilterModal,
  openEditCommentModal,
  openEpubEditCommentModal,
  _testResetLibrary,
} from '../../src/library/ui';
import { MockVault, parseFrontmatter } from '../mock-vault';
import {
  resetObsidianMocks,
  Platform as MockPlatform,
  getNoticeMessages,
  hasNotice,
  clearNotices,
} from '../mock-obsidian-entry';
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

/** 在读书目：作者/分类/进度/时长/划线/想法/书评齐全 */
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

/** 已读书目：readingDate + completionDate → status=已读 */
const BOOK_READ_MD = BOOK_MD.replace('readingDate: 2025-06-01', 'readingDate: 2025-05-01\ncompletionDate: 2025-06-01');

/** 无进度无划线的极简书目 */
const BOOK_MIN_MD = `---
tags: ["book"]
---
正文
`;

/** 嵌套标题读书笔记：一级章×2 + 无高亮二级小节（应被跳过）+ 标题脚注标记 */
const NOTE_TREE_MD = `# 第一章 [^1]

<span data-id="h1" data-comment="批注一" data-date="2025-06-01" class="__comment cm-highlight">原文一</span>

## 无高亮小节

# 第二章

<span data-id="h2" class="__comment cm-highlight">原文二</span>
`;

function flush(ms = 30) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 长按触发（core/dom longPress 默认 500ms） */
async function longPressEl(el: HTMLElement) {
  el.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 40, clientY: 40 }));
  await flush(560);
  el.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
}

/** 构造 weave-data.json 内容 */
function weaveJson(highlights: any[]) {
  return JSON.stringify({
    schemaVersion: 2,
    books: {
      bk_001: {
        id: 'bk_001',
        file: { vaultPath: '书库/悉达多.epub', sourceId: 'epubsrc-demo' },
        meta: { title: '悉达多', author: '', chapterCount: 2 },
        reading: { position: { chapterIndex: 0, cfi: '', percent: 0 }, stats: { totalReadTime: 0, lastReadTime: 0, createdTime: 0 } },
        notes: { bookmarks: [], highlights, excerpts: [] },
      },
    },
  });
}

describe('书库卡片渲染分支', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    _testResetLibrary();
    document.body.innerHTML = '';
    clearNotices();
    vault = new MockVault();
  });

  afterEach(() => {
    _testResetLibrary();
    document.body.innerHTML = '';
    closeItemMenu();
    MockPlatform.isMobile = false;
  });

  /** 移动端长按开抽屉并消费残余 click */
  async function longPressCard(card: HTMLElement) {
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    await flush(560);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush(10);
  }

  it('封面：png 封面渲染 <img>（getResourcePath）；非图片与缺文件回退 📖 占位', async () => {
    // ① png 封面存在
    vault.files.set('书库/活着.md', BOOK_MD.replace('author: "余华"', 'author: "余华"\ncover: "封面.png"'));
    vault.files.set('CONFIG/BOOK/活着/封面.png', '<bin>');
    const app1 = makeApp(vault);
    app1.vault.getResourcePath = vi.fn(() => 'res://cover');
    setApp(app1);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' }) as any);
    showLibrary(app1);
    await flush(40);
    expect(document.querySelector('#__book_library__ .bz-lib-cover-img')).not.toBeNull();
    expect((document.querySelector('.bz-lib-cover-img') as HTMLImageElement).getAttribute('src')).toBe('res://cover');
    _testResetLibrary();
    document.body.innerHTML = '';

    // ② cover 指向非图片扩展名 → 占位
    resetObsidianMocks();
    const vault2 = new MockVault();
    vault2.files.set('书库/活着.md', BOOK_MD.replace('author: "余华"', 'author: "余华"\ncover: "说明.txt"'));
    vault2.files.set('CONFIG/BOOK/活着/说明.txt', 'x');
    const app2 = makeApp(vault2);
    app2.vault.getResourcePath = vi.fn(() => 'res://x');
    setApp(app2);
    showLibrary(app2);
    await flush(40);
    expect(document.querySelector('.bz-lib-cover-img')).toBeNull();
    expect(document.querySelector('.bz-lib-cover-placeholder')!.textContent).toBe('📖');
    _testResetLibrary();
    document.body.innerHTML = '';

    // ③ cover 文件缺失 → 占位
    resetObsidianMocks();
    const vault3 = new MockVault();
    vault3.files.set('书库/活着.md', BOOK_MD.replace('author: "余华"', 'author: "余华"\ncover: "丢了.png"'));
    const app3 = makeApp(vault3);
    app3.vault.getResourcePath = vi.fn(() => 'res://gone');
    setApp(app3);
    showLibrary(app3);
    await flush(40);
    expect(document.querySelector('.bz-lib-cover-img')).toBeNull();
    expect(document.querySelector('.bz-lib-cover-placeholder')).not.toBeNull();
  });

  it('显示开关关闭：时长/划线/想法/文件大小/书评 chip 全部隐藏；进度为 0 无 📊', async () => {
    setSettingsProvider(() =>
      ({ libraryFolderPath: '书库', bookTag: 'book', showFileSize: false, showReadingTime: false, showHighlights: false, showThinks: false, showReview: false }) as any
    );
    vault.files.set('书库/三体.md', BOOK_MD.replace(/余华|活着真好/g, (m) => (m === '余华' ? '刘慈欣' : '三体真好看')));
    const app = makeApp(vault);
    setApp(app);
    showLibrary(app);
    await flush(40);
    const card = document.querySelector('#__book_library__ .bz-lib-card') as HTMLElement;
    expect(card.textContent).not.toContain('⏱️');
    expect(card.textContent).not.toContain('💡');
    expect(card.textContent).not.toContain('🧠');
    expect(card.textContent).not.toContain('📦');
    expect(card.querySelector('.bz-lib-review')).toBeNull();
    // 进度 60 仍显示（readingProgress 与开关无关）
    expect(card.textContent).toContain('📊 60%');

    // 极简书目：进度 0 → 无 📊；作者缺省「未知作者」（用全新 vault 隔离前半段书目）
    _testResetLibrary();
    document.body.innerHTML = '';
    resetObsidianMocks();
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' }) as any);
    const vaultMin = new MockVault();
    vaultMin.files.set('书库/极简书.md', BOOK_MIN_MD);
    showLibrary(makeApp(vaultMin));
    await flush(40);
    const minCard = document.querySelector('#__book_library__ .bz-lib-card')!;
    expect(minCard.textContent).not.toContain('📊');
    expect(minCard.textContent).toContain('未知作者');
  });

  it('已读书目不渲染状态徽章；抽屉头部小字含 作者·状态·进度', async () => {
    vault.files.set('书库/活着.md', BOOK_READ_MD);
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' }) as any);
    showLibrary(app);
    await flush(40);
    const card = document.querySelector('#__book_library__ .bz-lib-card') as HTMLElement;
    expect(card.querySelector('.bz-lib-badge--已读')).toBeNull();
    // 抽屉头部（移动端长按开抽屉验证 sheetHead）
    MockPlatform.isMobile = true;
    await longPressCard(card);
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet.querySelector('.bz-item-sheet-sub')!.textContent).toContain('余华');
    expect(sheet.querySelector('.bz-item-sheet-sub')!.textContent).toContain('已读');
    expect(sheet.querySelector('.bz-item-sheet-sub')!.textContent).toContain('60%');
    closeItemMenu();
  });
});

describe('筛选弹窗全量交互', () => {
  let vault: MockVault;
  let app: any;

  beforeEach(() => {
    resetObsidianMocks();
    _testResetLibrary();
    document.body.innerHTML = '';
    clearNotices();
    vault = new MockVault();
    // 三本不同状态/分类/子目录的书
    vault.files.set('书库/活着.md', BOOK_MD); // 小说 · 在读 · 进度60
    vault.files.set('书库/三体.md', `---\ntags: ["book"]\nauthor: "刘慈欣"\ncategory: "科幻"\n---\n正文`); // 科幻 · 未读
    vault.files.set('书库/子目录/深度工作.md', BOOK_READ_MD.replace('活着真好', '专注')); // 子目录 · 已读
    app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' }) as any);
    showLibrary(app);
  });

  afterEach(() => {
    closeFilterModal();
    _testResetLibrary();
    document.body.innerHTML = '';
    closeItemMenu();
  });

  /** 打开筛选弹窗并返回弹窗根 */
  function openFilter() {
    openFilterModal(app);
    return [...document.querySelectorAll('.bz-lib-overlay--1100')].pop()!.querySelector('.bz-lib-modal--sm') as HTMLElement;
  }

  function pill(modal: HTMLElement, text: string): HTMLButtonElement {
    return [...modal.querySelectorAll('button')].find((b) => b.textContent === text)!;
  }

  it('分类胶囊聚合 category+子目录且排除未分类；点分类过滤主列表', () => {
    const modal = openFilter();
    const cats = [...modal.querySelectorAll('.bz-lib-filter-section')![0].querySelectorAll('button')].map((b) => b.textContent);
    expect(cats).toEqual(['全部', '科幻', '小说', '子目录']); // localeCompare(zh) 排序；「未分类」被排除
    pill(modal, '科幻').click();
    const list = document.getElementById('__book_library__')!;
    expect(list.textContent).toContain('三体');
    expect(list.textContent).not.toContain('活着');
  });

  it('状态胶囊与分类组合过滤：交集为空 → 「📭 没有找到符合条件的书籍」；放宽分类后按状态收敛', () => {
    const modal = openFilter();
    // 深度工作同样挂 category=小说（BOOK_READ_MD 派生），故 小说∩未读 = 空
    pill(modal, '小说').click();
    const modal2 = [...document.querySelectorAll('.bz-lib-overlay--1100')].pop()!.querySelector('.bz-lib-modal--sm') as HTMLElement;
    pill(modal2, '未读').click();
    expect(document.getElementById('__book_library__')!.textContent).toContain('📭 没有找到符合条件的书籍');
    // 回到全部分类（状态仍限「未读」）→ 只剩未读的三体
    const modal3 = [...document.querySelectorAll('.bz-lib-overlay--1100')].pop()!.querySelector('.bz-lib-modal--sm') as HTMLElement;
    pill(modal3, '全部').click(); // 分类区第一个「全部」
    const list = document.getElementById('__book_library__')!;
    expect(list.textContent).toContain('三体');
    expect(list.textContent).not.toContain('深度工作');
    expect(list.textContent).not.toContain('活着');
  });

  it('排序胶囊全部可点（title/author/日期/进度 × 升降序），列表持续重渲染', () => {
    const modal = openFilter();
    const sortSection = modal.querySelectorAll('.bz-lib-filter-section')[2] as HTMLElement;
    const sortBtns = [...sortSection.querySelectorAll('button')] as HTMLButtonElement[];
    expect(sortBtns.length).toBe(10);
    for (const btn of sortBtns) btn.click(); // renderSettings 会重建 DOM，旧按钮监听仍生效
    // 全部点击后列表仍正常渲染（排序状态被反复改写）
    expect(document.getElementById('__book_library__')!.querySelectorAll('.bz-lib-card').length).toBe(3);
    // 最后一次点击是「进度 ↓」→ 首张卡为进度最高的活着（并列时稳定排序保持原序）
    expect(document.querySelector('#__book_library__ .bz-lib-card .bz-lib-title')!.textContent).toBe('活着');
  });

  it('再次调用 openFilterModal 为开关语义（关旧）；closeFilterModal 幂等', () => {
    openFilter();
    expect(document.querySelector('.bz-lib-overlay--1100')).not.toBeNull();
    openFilterModal(app); // 已开 → 关闭
    expect(document.querySelector('.bz-lib-overlay--1100')).toBeNull();
    closeFilterModal(); // 幂等不炸
    expect(document.querySelector('.bz-lib-overlay--1100')).toBeNull();
  });
});

describe('读书笔记树渲染与高亮块交互', () => {
  let vault: MockVault;
  let app: any;
  const NOTE_PATH = '书库/书.md';

  beforeEach(() => {
    resetObsidianMocks();
    _testResetLibrary();
    document.body.innerHTML = '';
    clearNotices();
    vault = new MockVault();
    vault.files.set(NOTE_PATH, NOTE_TREE_MD);
    app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' }) as any);
  });

  afterEach(() => {
    _testResetLibrary();
    document.body.innerHTML = '';
    closeItemMenu();
    vi.restoreAllMocks();
  });

  function openNotes() {
    showBookNotes(app, NOTE_PATH);
    return flush(40).then(() => document.querySelector('.bz-lib-overlay--11100') as HTMLElement);
  }

  it('树递归：一级章渲染；无高亮二级小节跳过；标题脚注 [^1] 清理', async () => {
    const shell = await openNotes();
    const headings = [...shell.querySelectorAll('.bz-lib-note-heading')].map((el) => el.textContent);
    expect(headings).toEqual(['第一章', '第二章']); // 「第一章 [^1]」清理脚注；无高亮小节被跳过
    expect(shell.textContent).not.toContain('无高亮小节');
  });

  it('高亮块：有批注/日期渲染完整；无批注无日期 → 「无日期」且无 pointer 类', async () => {
    const shell = await openNotes();
    const blocks = [...shell.querySelectorAll('.bz-lib-hl')] as HTMLElement[];
    expect(blocks.length).toBe(2);
    // 第一条：批注 + 日期（pointer 类）
    expect(blocks[0].querySelector('.bz-lib-comment')!.textContent).toBe('批注一');
    const date0 = blocks[0].querySelector('.bz-lib-hl-date') as HTMLElement;
    expect(date0.textContent).toBe('2025-06-01');
    expect(date0.classList.contains('bz-lib-hl-date--pointer')).toBe(true);
    // 第二条：无批注无日期
    expect(blocks[1].querySelector('.bz-lib-comment')).toBeNull();
    const date1 = blocks[1].querySelector('.bz-lib-hl-date') as HTMLElement;
    expect(date1.textContent).toBe('无日期');
    expect(date1.classList.contains('bz-lib-hl-date--pointer')).toBe(false);
  });

  it('双击高亮块 → 跳转原文，200ms 后笔记壳自动移除', async () => {
    const shell = await openNotes();
    const block = shell.querySelectorAll('.bz-lib-hl')[1] as HTMLElement;
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith(`${NOTE_PATH}#^h2`, '', false);
    expect(shell.isConnected).toBe(true); // 尚未到 200ms
    await flush(260);
    expect(document.querySelector('.bz-lib-overlay--11100')).toBeNull();
  });

  it('长按内容区 → 编辑批注弹窗；保存写回 data-comment 并重开笔记壳', async () => {
    await openNotes();
    const block = document.querySelector('.bz-lib-overlay--11100 .bz-lib-hl') as HTMLElement;
    await longPressEl(block.querySelector('.bz-lib-hl-body') as HTMLElement);
    const editOverlay = document.querySelector('.bz-lib-overlay--11101') as HTMLElement;
    expect(editOverlay).not.toBeNull();
    expect(editOverlay.querySelector('.bz-lib-modal-title')!.textContent).toBe('编辑批注');
    const textarea = editOverlay.querySelector('.bz-lib-edit-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('批注一'); // 初值 = 旧批注
    textarea.value = '新批注';
    (editOverlay.querySelector('.bz-lib-btn--primary') as HTMLButtonElement).click();
    await flush(80);
    // 写回文件（既有 data-comment 被替换）
    expect(vault.files.get(NOTE_PATH)).toContain('data-comment="新批注"');
    expect(getNoticeMessages()).toContain('批注已更新');
    // 弹窗关闭 + onDone 重开笔记壳
    expect(document.querySelector('.bz-lib-overlay--11101')).toBeNull();
    await flush(40);
    expect(document.querySelector('.bz-lib-overlay--11100')).not.toBeNull();
    expect(document.querySelector('.bz-lib-overlay--11100')!.textContent).toContain('新批注'); // 重开后内容可见
  });

  it('编辑批注弹窗：取消按钮 / ✕ / 点遮罩均直接移除弹窗', async () => {
    await openNotes();
    const block = document.querySelector('.bz-lib-overlay--11100 .bz-lib-hl') as HTMLElement;
    // 取消
    await longPressEl(block.querySelector('.bz-lib-hl-body') as HTMLElement);
    let edit = document.querySelector('.bz-lib-overlay--11101') as HTMLElement;
    (edit.querySelector('.bz-lib-btn--ghost') as HTMLButtonElement).click();
    expect(document.querySelector('.bz-lib-overlay--11101')).toBeNull();
    // ✕
    await longPressEl(block.querySelector('.bz-lib-hl-body') as HTMLElement);
    edit = document.querySelector('.bz-lib-overlay--11101') as HTMLElement;
    (edit.querySelector('.bz-win-close') as HTMLButtonElement).click();
    expect(document.querySelector('.bz-lib-overlay--11101')).toBeNull();
    // 遮罩
    await longPressEl(block.querySelector('.bz-lib-hl-body') as HTMLElement);
    edit = document.querySelector('.bz-lib-overlay--11101') as HTMLElement;
    edit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-lib-overlay--11101')).toBeNull();
  });

  it('openEditCommentModal 导出直调：保存成功回调 onDone 并写回文件', async () => {
    const onDone = vi.fn();
    openEditCommentModal(app, NOTE_PATH, 'h2', '原文二', '', onDone);
    await flush(10);
    const edit = document.querySelector('.bz-lib-overlay--11101') as HTMLElement;
    const textarea = edit.querySelector('.bz-lib-edit-textarea') as HTMLTextAreaElement;
    textarea.value = '补一条想法';
    (edit.querySelector('.bz-lib-btn--primary') as HTMLButtonElement).click();
    await flush(80);
    expect(onDone).toHaveBeenCalled();
    expect(vault.files.get(NOTE_PATH)).toContain('data-comment="补一条想法"');
  });

  it('笔记壳 ❌ 关闭按钮与遮罩点击均可关闭', async () => {
    let shell = await openNotes();
    (shell.querySelector('.bz-lib-modal-close--sm') as HTMLButtonElement).click();
    expect(document.querySelector('.bz-lib-overlay--11100')).toBeNull();
    // 遮罩点击（target === overlay）
    shell = await openNotes();
    shell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-lib-overlay--11100')).toBeNull();
  });

  it('文件不存在 → notice 且不建壳', async () => {
    showBookNotes(app, '书库/不存在.md');
    await flush(20);
    expect(hasNotice('文件不存在')).toBe(true);
    expect(document.querySelector('.bz-lib-overlay--11100')).toBeNull();
  });
});

describe('EPUB 读书笔记（分组/跳转/删除/编辑）', () => {
  let vault: MockVault;
  let app: any;
  const EPUB_ITEM = { file: { path: '书库/悉达多.epub' }, title: '悉达多', isEpub: true };

  beforeEach(() => {
    resetObsidianMocks();
    _testResetLibrary();
    document.body.innerHTML = '';
    clearNotices();
    vault = new MockVault();
    app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' }) as any);
  });

  afterEach(() => {
    _testResetLibrary();
    document.body.innerHTML = '';
    closeItemMenu();
    vi.restoreAllMocks();
  });

  function openEpub() {
    showEpubBookNotes(app, EPUB_ITEM as any);
    return flush(50).then(() => document.querySelector('.bz-lib-overlay--11100') as HTMLElement);
  }

  it('无阅读数据（weave-data.json 缺失）→ 「📭 未找到该书阅读数据」', async () => {
    const shell = await openEpub();
    expect(shell.querySelector('.bz-lib-notes-body')!.textContent).toContain('📭 未找到该书阅读数据');
  });

  it('书存在但无划线 → 「📭 没有找到高亮或想法」', async () => {
    vault.files.set('CONFIG/STORAGE/weave-data.json', weaveJson([]));
    const shell = await openEpub();
    expect(shell.querySelector('.bz-lib-notes-body')!.textContent).toContain('📭 没有找到高亮或想法');
  });

  it('按章节分组保留首现顺序；想法/日期按条渲染；无 createdTime 显示「无日期」', async () => {
    vault.files.set(
      'CONFIG/STORAGE/weave-data.json',
      weaveJson([
        { id: 'e1', text: '原文一', commentText: '想法一', chapterIndex: 0, chapterTitle: '第一章', cfiRange: 'cfi-a', createdTime: 1700000000000 },
        { id: 'e2', text: '跨章原文', commentText: '', chapterIndex: 1, chapterTitle: '第二章', cfiRange: 'cfi-b', createdTime: 0 },
        { id: 'e3', text: '同章第二条', commentText: '想法三', chapterIndex: 0, chapterTitle: '第一章', cfiRange: 'cfi-c', createdTime: 1700000000000 },
      ])
    );
    const shell = await openEpub();
    const headings = [...shell.querySelectorAll('.bz-lib-note-heading')].map((el) => el.textContent);
    expect(headings).toEqual(['第一章', '第二章']); // 首现顺序，不重排
    const blocks = [...shell.querySelectorAll('.bz-lib-hl')] as HTMLElement[];
    expect(blocks.length).toBe(3);
    expect(blocks.map((b) => b.querySelector('.bz-lib-quote')!.textContent)).toEqual([
      '❝ 原文一',
      '❝ 同章第二条',
      '❝ 跨章原文',
    ]);
    expect(blocks[0].querySelector('.bz-lib-comment')!.textContent).toBe('想法一');
    expect(blocks[1].querySelector('.bz-lib-comment')!.textContent).toBe('想法三');
    expect(blocks[2].querySelector('.bz-lib-comment')).toBeNull();
    // 日期：有时间戳格式化 YYYY-MM-DD；0 → 无日期
    expect(blocks[0].querySelector('.bz-lib-hl-date')!.textContent).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(blocks[2].querySelector('.bz-lib-hl-date')!.textContent).toBe('无日期');
  });

  it('双击：cfiRange 缺失 → 不跳转不关壳；正常 cfi → 开深链并关壳', async () => {
    vault.files.set(
      'CONFIG/STORAGE/weave-data.json',
      weaveJson([
        { id: 'e1', text: '无cfi', commentText: '', chapterIndex: 0, chapterTitle: '第一章', cfiRange: '', createdTime: 0 },
        { id: 'e2', text: '有cfi', commentText: '', chapterIndex: 0, chapterTitle: '第一章', cfiRange: 'epubcfi(/6/2)!/4/4', createdTime: 0 },
      ])
    );
    const shell = await openEpub();
    const blocks = [...shell.querySelectorAll('.bz-lib-hl')] as HTMLElement[];
    // ① 空 cfi → 早退
    blocks[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).not.toHaveBeenCalled();
    expect(shell.isConnected).toBe(true);
    // ② 正常 cfi → 深链 + 关壳
    blocks[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(app.workspace.openLinkText).toHaveBeenCalledWith(
      '书库/悉达多.epub#weave-cfi=epubcfi(/6/2)!/4/4&chapter=0&sid=epubsrc-demo',
      '',
      false
    );
    expect(document.querySelector('.bz-lib-overlay--11100')).toBeNull();
  });

  it('长按日期删除：confirm 取消不动数据；确认后整条移除并重开（onChanged）', async () => {
    vault.files.set(
      'CONFIG/STORAGE/weave-data.json',
      weaveJson([
        { id: 'e1', text: '要删的', commentText: '', chapterIndex: 0, chapterTitle: '第一章', cfiRange: 'c1', createdTime: 0 },
        { id: 'e2', text: '要留的', commentText: '', chapterIndex: 0, chapterTitle: '第一章', cfiRange: 'c2', createdTime: 0 },
      ])
    );
    await openEpub();
    const dateEl = document.querySelector('.bz-lib-overlay--11100 .bz-lib-hl-date') as HTMLElement;

    // ① 取消：weave 数据不变
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await longPressEl(dateEl);
    expect(confirmSpy).toHaveBeenCalledWith('确定要删除该划线和想法吗？');
    await flush(40);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/weave-data.json')!).books.bk_001.notes.highlights).toHaveLength(2);

    // ② 确认：删除 e1 → onChanged 重开只剩一条
    confirmSpy.mockReturnValue(true);
    await longPressEl(dateEl);
    await flush(80);
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/weave-data.json')!);
    expect(saved.books.bk_001.notes.highlights.map((h: any) => h.id)).toEqual(['e2']);
    await flush(50);
    const reopened = document.querySelector('.bz-lib-overlay--11100') as HTMLElement;
    expect(reopened.querySelectorAll('.bz-lib-hl').length).toBe(1);
    expect(reopened.textContent).toContain('要留的');
  });

  it('openEpubEditCommentModal 直调：保存成功关弹窗；空 id 失败保持打开', async () => {
    vault.files.set(
      'CONFIG/STORAGE/weave-data.json',
      weaveJson([{ id: 'e1', text: '原文一', commentText: '', chapterIndex: 0, chapterTitle: '第一章', cfiRange: 'c1', createdTime: 0 }])
    );
    const note = { text: '原文一', comment: '' };
    // ① 成功路径：写回 commentText → 弹窗关闭 + onDone
    const onDone = vi.fn();
    openEpubEditCommentModal(app, '书库/悉达多.epub', 'e1', note as any, onDone);
    await flush(10);
    let edit = document.querySelector('.bz-lib-overlay--11101') as HTMLElement;
    expect(edit.querySelector('.bz-lib-modal-title')!.textContent).toBe('编辑想法');
    (edit.querySelector('.bz-lib-edit-textarea') as HTMLTextAreaElement).value = '新想法';
    (edit.querySelector('.bz-lib-btn--primary') as HTMLButtonElement).click();
    await flush(60);
    expect(onDone).toHaveBeenCalled();
    expect(document.querySelector('.bz-lib-overlay--11101')).toBeNull();
    const savedHl = JSON.parse(vault.files.get('CONFIG/STORAGE/weave-data.json')!).books.bk_001.notes.highlights[0];
    expect(savedHl.commentText).toBe('新想法');
    expect(savedHl.hasCommentDivider).toBe(true);

    // ② 失败路径：脏数据空 id → onSave false → 弹窗保留
    openEpubEditCommentModal(app, '书库/悉达多.epub', '', note as any);
    await flush(10);
    edit = document.querySelector('.bz-lib-overlay--11101') as HTMLElement;
    (edit.querySelector('.bz-lib-btn--primary') as HTMLButtonElement).click();
    await flush(60);
    expect(edit.isConnected).toBe(true); // 未关闭
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('纯 EPUB 书库与复用路径', () => {
  beforeEach(() => {
    resetObsidianMocks();
    _testResetLibrary();
    document.body.innerHTML = '';
    clearNotices();
  });

  afterEach(() => {
    _testResetLibrary();
    document.body.innerHTML = '';
    closeItemMenu();
  });

  it('无 markdown 书目但 weave 有书：先「正在加载书库…」占位再并入 EPUB 卡片', async () => {
    const vault = new MockVault();
    vault.files.set(
      'CONFIG/STORAGE/weave-data.json',
      JSON.stringify({
        schemaVersion: 2,
        books: {
          bk_001: {
            id: 'bk_001',
            file: { vaultPath: 'Books/悉达多.epub' },
            meta: { title: '悉达多', author: '黑塞', chapterCount: 10 },
            reading: { position: { chapterIndex: 0, cfi: '', percent: 42 }, stats: { totalReadTime: 90 * 60000, lastReadTime: 0, createdTime: 0 } },
            notes: { bookmarks: [], highlights: [], excerpts: [] },
          },
        },
      })
    );
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ libraryFolderPath: '书库', bookTag: 'book' }) as any);
    showLibrary(app);
    // 同步阶段：markdown 书目为空 → 加载占位
    expect(document.getElementById('__book_library__')!.textContent).toContain('正在加载书库…');
    await flush(40);
    const overlay = document.getElementById('__book_library__')!;
    expect(overlay.textContent).toContain('悉达多');
    expect(overlay.textContent).toContain('42%'); // EPUB 百分比直用
    expect(overlay.textContent).toContain('1小时30分'); // 阅读时长格式化
  });
});
