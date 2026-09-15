// @vitest-environment jsdom
/**
 * clipbook（issue 329 / ADR-0144）：划选工具框 + 锚定直写 + 保存物化 UI 层测试。
 * 覆盖：工具框出现与收起、五动作触发与预填参数、复制 Markdown 剪贴板内容、
 * 点击拦截（文献盒内拦/目录外不拦）、保存物化链路（md 含替换/侧写清理/upgrade 被调）、
 * 已保存条目直写路径、保存图片（requestUrl 落盘 + 侧写 + 渲染层换链）。
 * knowledge 契约 API 由并行 worktree 实现——vi.mock 打桩（仿 flow.test.ts 对 knowledge 的 mock）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { initPanel, unloadPanel } from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { writeClipNote } from '../../src/clipbook/save';
import { readClipbookData } from '../../src/clipbook/data';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { getNewsFilePath } from '../../src/clipbook/news-data';

vi.mock('../../src/knowledge', () => ({
  openKnowledgeAddTask: vi.fn(),
  openTermNote: vi.fn(),
  openPassageNote: vi.fn(),
  openImageNote: vi.fn(),
  openKnowledgePreview: vi.fn(async () => {}),
  upgradeNoteSourceInternal: vi.fn(async () => true),
}));
// 契约 API（openTermNote/openPassageNote/openImageNote/openKnowledgePreview/upgradeNoteSourceInternal）
// 由 knowledge 侧并行 worktree 实现，本 worktree 的 src/knowledge/index.ts 尚无这些导出——
// 类型按 any 消费（运行时 vi.mock 工厂提供全部函数），与实现源码「按存在调用」口径一致。
const knowledgeMocks: Record<string, any> = await import('../../src/knowledge');
const { requestUrl, Platform } = await import('obsidian');

/** 种子：未读 news 一篇（正文含划词目标与外链图）+ 剪藏笔记 A（已保存条目直写用） */
function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '甲文', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '正文讲到了**量子纠缠** 是现象，配一张 ![配图](https://img.example/a.png) 图。' },
    ],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  vault.files.set('归档/网页剪藏/剪藏笔记A.md', '---\nurl: "https://guokr.com/old"\ncreated: 2026-08-20 10:00:00\n---\n段落里提到量子纠缠。');
  return vault;
}

function boot(): MockVault {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  const vault = seedVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({
    storagePath: 'CONFIG/STORAGE',
    articleDirectory: '归档/网页剪藏',
    knowledgeDirectory: '文献盒',
    clipbookImageFolder: '',
  } as any));
  return vault;
}

async function openDesktop(): Promise<void> {
  boot();
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  await vi.waitFor(() => expect(M.articles.length).toBe(1));
}

/** 模拟双端阅读正文内的文字选区（commonAncestorContainer 指向正文容器） */
function mockTextSelection(text: string, container: HTMLElement): void {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false,
    rangeCount: 1,
    toString: () => text,
    getRangeAt: () => ({
      commonAncestorContainer: container,
      getBoundingClientRect: () => ({ top: 100, left: 50, bottom: 120, right: 260, width: 210, height: 20 }),
    }),
  } as any);
}

function clearSelection(): void {
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: true, rangeCount: 0, toString: () => '', getRangeAt: () => null } as any);
}

/** 划选并弹工具框（桌面右栏路径），返回工具框元素 */
async function showToolbar(text: string): Promise<HTMLElement> {
  const mdEl = document.querySelector('[data-clip-md]') as HTMLElement;
  expect(mdEl).toBeTruthy();
  mockTextSelection(text, mdEl);
  (document.querySelector('[data-clip-read-pane]') as HTMLElement).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  await vi.waitFor(() => {
    const bar = document.querySelector('.bz-clip-selbar') as HTMLElement | null;
    expect(bar).toBeTruthy();
    expect(bar!.style.display).toBe('flex');
  });
  return document.querySelector('.bz-clip-selbar') as HTMLElement;
}

afterEach(() => {
  vi.restoreAllMocks();
  (Platform as any).isMobile = false; // 移动端让位用例置位后复位，防污染后续用例
  clearNotices(); // progress 常驻通知不自动消失，逐用例清 DOM 防跨用例断言污染
});

beforeEach(() => {
  for (const fn of [knowledgeMocks.openTermNote, knowledgeMocks.openPassageNote, knowledgeMocks.openImageNote, knowledgeMocks.openKnowledgePreview, knowledgeMocks.upgradeNoteSourceInternal, knowledgeMocks.openKnowledgeAddTask]) {
    (fn as ReturnType<typeof vi.fn>).mockClear();
  }
  (requestUrl as ReturnType<typeof vi.fn>).mockClear();
});

// ================= 工具框出现与收起 =================

describe('划选工具框出现与收起（issue 329）', () => {
  it('阅读区划选 → 浮框出三动作（复制 Markdown / 存为名词 / 存为段落）', async () => {
    await openDesktop();
    const bar = await showToolbar('量子纠缠');
    expect(bar.textContent).toContain('复制 Markdown');
    expect(bar.textContent).toContain('存为名词');
    expect(bar.textContent).toContain('存为段落');
    expect(bar.querySelectorAll('[data-clip-selbar-act]')).toHaveLength(3);
    closeAndCleanup();
  });

  it('选区塌陷（selectionchange 防抖后）→ 浮框收起', async () => {
    await openDesktop();
    await showToolbar('量子纠缠');
    clearSelection();
    document.dispatchEvent(new Event('selectionchange'));
    await vi.waitFor(() => {
      const bar = document.querySelector('.bz-clip-selbar') as HTMLElement;
      expect(bar.style.display).toBe('none');
    });
    closeAndCleanup();
  });

  it('Esc → 浮框收起（escManager 层，不动面板）', async () => {
    await openDesktop();
    await showToolbar('量子纠缠');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await vi.waitFor(() => {
      const bar = document.querySelector('.bz-clip-selbar') as HTMLElement;
      expect(bar.style.display).toBe('none');
    });
    expect(M.open).toBe(true); // 面板不随工具框关闭
    closeAndCleanup();
  });

  it('点击工具框外（正文其他处）→ 浮框收起', async () => {
    await openDesktop();
    await showToolbar('量子纠缠');
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      const bar = document.querySelector('.bz-clip-selbar') as HTMLElement;
      expect(bar.style.display).toBe('none');
    });
    closeAndCleanup();
  });

  it('非正文容器内的选区不弹工具框（rail/目录区让位）', async () => {
    await openDesktop();
    const rail = document.querySelector('[data-clip-rail]') as HTMLElement;
    mockTextSelection('剪藏本', rail);
    (document.querySelector('[data-clip-read-pane]') as HTMLElement).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const bar = document.querySelector('.bz-clip-selbar') as HTMLElement | null;
    expect(bar === null || bar.style.display === 'none').toBe(true);
    closeAndCleanup();
  });

  function closeAndCleanup(): void {
    closePanelSafe();
  }
});

function closePanelSafe(): void {
  try {
    // 复用 ui.test.ts 收尾路径：关面板 + 卸载清理（document 级监听与工具框 DOM 一并清）
    // eslint 下个生命周期由下一用例 boot() 的 unloadClipbook 兜底
    (document.querySelector('.bz-panel-overlay') as HTMLElement | null)?.style.setProperty('display', 'none');
    M.open = false;
  } catch (e) { /* 用例内已收 */ }
}

// ================= 移动端浮框让位系统选择菜单（issue 329 Bug 1） =================

describe('移动端浮框让位系统选择菜单（issue 329 Bug 1）', () => {
  it('桌面：定位行为不变（选区上 8px，无让位）', async () => {
    await openDesktop();
    const bar = await showToolbar('量子纠缠');
    // 选区 rect top=100、浮框高 jsdom 零尺寸估算 36 → 100 - 36 - 8 = 56
    expect(bar.style.top).toBe('56px');
    closePanelSafe();
  });

  it('移动端：上方放得下 → 上方再让位 48（系统选择菜单高度）', async () => {
    await openDesktop();
    (Platform as any).isMobile = true;
    const bar = await showToolbar('量子纠缠');
    // 100 - 36 - 8 - 48 = 8（恰贴钳制下限，仍在上方位）
    expect(bar.style.top).toBe('8px');
    closePanelSafe();
  });

  it('移动端：上方放不下 → 翻下方同样让位 48', async () => {
    await openDesktop();
    (Platform as any).isMobile = true;
    const mdEl = document.querySelector('[data-clip-md]') as HTMLElement;
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => '量子纠缠',
      getRangeAt: () => ({
        commonAncestorContainer: mdEl,
        getBoundingClientRect: () => ({ top: 0, left: 50, bottom: 30, right: 260, width: 210, height: 20 }),
      }),
    } as any);
    (document.querySelector('[data-clip-read-pane]') as HTMLElement).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await vi.waitFor(() => {
      const bar = document.querySelector('.bz-clip-selbar') as HTMLElement | null;
      expect(bar).toBeTruthy();
      expect(bar!.style.display).toBe('flex');
    });
    // 上方 0 - 36 - 8 - 48 < 8 放不下 → 翻下方：30 + 8 + 48 = 86
    expect((document.querySelector('.bz-clip-selbar') as HTMLElement).style.top).toBe('86px');
    closePanelSafe();
  });
});

// ================= 移动详情原位重渲（issue 329 Bug 2） =================

describe('移动详情原位重渲（issue 329 Bug 2）', () => {
  it('移动详情打开时划词 onCreated → 详情正文即时出双链（renderMobDetail 一并重渲）', async () => {
    await openDesktop();
    // 进移动详情（mob 层 DOM 桌面下同样构建；openMobDetail 不分端）
    (document.querySelector('.bz-clip-mob-item') as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    await vi.waitFor(() => {
      const mobMd = document.querySelector('[data-clip-mob-md]') as HTMLElement | null;
      expect(mobMd).toBeTruthy();
      expect(mobMd!.textContent).toContain('量子纠缠');
    });
    // 详情正文容器内划选 → mouseup 弹工具框（mobDetailEl 挂 onReaderMouseUp）
    const mobMd = document.querySelector('[data-clip-mob-md]') as HTMLElement;
    mockTextSelection('量子纠缠', mobMd);
    (document.querySelector('[data-clip-mob-detail]') as HTMLElement).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await vi.waitFor(() => {
      const bar = document.querySelector('.bz-clip-selbar') as HTMLElement | null;
      expect(bar).toBeTruthy();
      expect(bar!.style.display).toBe('flex');
    });
    (document.querySelector('[data-clip-selbar-act="term"]') as HTMLElement).click();
    await vi.waitFor(() => expect(knowledgeMocks.openTermNote).toHaveBeenCalledTimes(1));
    const [, , opts] = (knowledgeMocks.openTermNote as ReturnType<typeof vi.fn>).mock.calls[0];
    opts.onCreated('文献盒/量子纠缠笔记.md');
    // 详情 md 容器重渲后出现别名双链（修复前只重渲桌面 reader，移动详情残留旧文）
    await vi.waitFor(() => {
      const md = document.querySelector('[data-clip-mob-md]') as HTMLElement;
      expect(md.textContent).toContain('[[量子纠缠笔记|量子纠缠]]');
    });
    // 顺手覆盖 Bug 4：未保存分支 onCreated 现在也登记 pendingSource（保存物化升级名单）
    const sidecar = await readClipbookData();
    expect(sidecar.pendingSource['url:https://guokr.com/1']).toEqual(['文献盒/量子纠缠笔记.md']);
    closePanelSafe();
  });
});

// ================= 五动作：触发与预填参数 =================

describe('工具框五动作触发与预填参数（issue 329）', () => {
  it('存为名词：openTermNote 预填选区文本 + 原文来源 + onCreated；onCreated 落侧写并渲染双链', async () => {
    await openDesktop();
    const bar = await showToolbar('量子纠缠');
    (bar.querySelector('[data-clip-selbar-act="term"]') as HTMLElement).click();
    await vi.waitFor(() => expect(knowledgeMocks.openTermNote).toHaveBeenCalledTimes(1));
    const [app, term, opts] = (knowledgeMocks.openTermNote as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(app).toBe(getApp());
    expect(term).toBe('量子纠缠');
    expect(opts.source).toEqual({ kind: 'url', url: 'https://guokr.com/1', title: '甲文' });
    expect(typeof opts.onCreated).toBe('function');
    // 动作发起后浮框已收（不自动打开笔记，不打断阅读）
    expect((document.querySelector('.bz-clip-selbar') as HTMLElement).style.display).toBe('none');
    // 面板回调（knowledge 录入生成成功后）：写侧写 marks → 渲染层立即出别名双链；news.json 零写入
    opts.onCreated('文献盒/量子纠缠笔记.md');
    await vi.waitFor(() => {
      const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
      expect(reader.textContent).toContain('[[量子纠缠笔记|量子纠缠]]');
    });
    const sidecar = await readClipbookData();
    expect(sidecar.marks['url:https://guokr.com/1']).toEqual([
      { find: '量子纠缠', notePath: '文献盒/量子纠缠笔记.md', kind: 'term' },
    ]);
    const newsDisk = JSON.parse((getApp().vault as any).files.get(getNewsFilePath())!);
    expect(newsDisk.articles[0].body).not.toContain('[[量子纠缠笔记'); // news.json 永不被写
    closePanelSafe();
  });

  it('存为段落：openPassageNote 预填 { text, source, onCreated }', async () => {
    await openDesktop();
    const bar = await showToolbar('量子纠缠');
    (bar.querySelector('[data-clip-selbar-act="passage"]') as HTMLElement).click();
    await vi.waitFor(() => expect(knowledgeMocks.openPassageNote).toHaveBeenCalledTimes(1));
    const [app, opts] = (knowledgeMocks.openPassageNote as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(app).toBe(getApp());
    expect(opts.text).toBe('量子纠缠');
    expect(opts.source).toEqual({ kind: 'url', url: 'https://guokr.com/1', title: '甲文' });
    closePanelSafe();
  });

  it('复制 Markdown：剪贴板 = 选区回查的源片段（保 markdown 语法，非 DOM textContent）', async () => {
    await openDesktop();
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const bar = await showToolbar('量子纠缠');
    (bar.querySelector('[data-clip-selbar-act="copy"]') as HTMLElement).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    // body 原文该行 = '正文讲到了**量子纠缠** 是现象，…' —— 回查覆盖整行保语法
    const written = writeText.mock.calls[0][0] as string;
    expect(written).toContain('**量子纠缠**');
    expect(written).not.toBe('量子纠缠');
    closePanelSafe();
  });

  it('图片单击 → 浮框两动作；保存图片：requestUrl 落盘 + savedImages 侧写 + 渲染层换链', async () => {
    const vault = boot();
    (requestUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      arrayBuffer: new TextEncoder().encode('fake-png-bytes').buffer,
    });
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(1));
    // 首篇已被默认 mock 渲染完（openDesktop 竞态）——现挂 Once mock 后重选当前条目触发重渲产出 img
    const { MarkdownRenderer } = await import('obsidian');
    (MarkdownRenderer.render as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_app: any, md: string, el: HTMLElement) => {
      if (el) el.innerHTML = String(md).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    });
    (document.querySelector('.bz-clip-item') as HTMLElement).click();
    await vi.waitFor(() => {
      const img = document.querySelector('[data-clip-reader] [data-clip-md] img') as HTMLImageElement | null;
      expect(img).toBeTruthy();
    });
    const img = document.querySelector('[data-clip-reader] [data-clip-md] img') as HTMLImageElement;
    img.click();
    await vi.waitFor(() => {
      const bar = document.querySelector('.bz-clip-selbar') as HTMLElement | null;
      expect(bar).toBeTruthy();
      expect(bar!.textContent).toContain('保存图片');
      expect(bar!.textContent).toContain('存为图版');
      expect(bar!.querySelectorAll('[data-clip-selbar-act]')).toHaveLength(2);
    });
    // 动作一：保存图片（未保存条目 → 落盘 + 侧写，news.json 零写入）。
    // 命名取 URL 自带文件名（issue 329 追加修订：条目标题不再参与命名）
    (document.querySelector('[data-clip-selbar-act="save-img"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect((vault as any).binaryFiles.has('归档/网页剪藏/assets/a.png')).toBe(true);
    });
    const sidecar = await readClipbookData();
    expect(sidecar.savedImages['url:https://guokr.com/1']).toEqual([
      { src: 'https://img.example/a.png', local: '归档/网页剪藏/assets/a.png' },
    ]);
    // 内存侧写同步 → 原位重渲后阅读区出现本地嵌入
    await vi.waitFor(() => {
      const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
      expect(reader.textContent).toContain('![[归档/网页剪藏/assets/a.png]]');
    });
    const newsDisk = JSON.parse((vault as any).files.get(getNewsFilePath())!);
    expect(newsDisk.articles[0].body).toContain('https://img.example/a.png'); // news.json 原文不动
    closePanelSafe();
  });

  it('存为图版：openImageNote 预填 data URL 图片 + 来源；onCreated 记 pendingSource（plate 无正文锚定）', async () => {
    boot();
    (requestUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      arrayBuffer: new TextEncoder().encode('fake-png-bytes').buffer,
    });
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    const { MarkdownRenderer } = await import('obsidian');
    (MarkdownRenderer.render as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_app: any, md: string, el: HTMLElement) => {
      if (el) el.innerHTML = String(md).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    });
    (document.querySelector('.bz-clip-item') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('[data-clip-reader] [data-clip-md] img')).toBeTruthy());
    (document.querySelector('[data-clip-reader] [data-clip-md] img') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('[data-clip-selbar-act="img-note"]')).toBeTruthy());
    (document.querySelector('[data-clip-selbar-act="img-note"]') as HTMLElement).click();
    await vi.waitFor(() => expect(knowledgeMocks.openImageNote).toHaveBeenCalledTimes(1));
    const [app, opts] = (knowledgeMocks.openImageNote as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(app).toBe(getApp());
    expect(opts.images).toHaveLength(1);
    expect(String(opts.images[0]).startsWith('data:image/png;base64,')).toBe(true);
    expect(opts.source).toEqual({ kind: 'url', url: 'https://guokr.com/1', title: '甲文' });
    // plate：onCreated 只记 pendingSource（source 跟随），不写 marks
    opts.onCreated('文献盒/图版甲.md');
    await vi.waitFor(async () => {
      const sidecar = await readClipbookData();
      expect(sidecar.pendingSource['url:https://guokr.com/1']).toEqual(['文献盒/图版甲.md']);
    });
    const sidecar = await readClipbookData();
    expect(sidecar.marks['url:https://guokr.com/1']).toBeUndefined();
    closePanelSafe();
  });
});

// ================= 点击拦截直达文献预览 =================

describe('点击拦截直达文献预览（issue 329 / ADR-0144 决策 3）', () => {
  async function openClipReaderWithLink(href: string, seedExtra?: (v: MockVault) => void): Promise<void> {
    const vault = boot();
    seedExtra?.(vault);
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(1));
    // 切剪藏本源 → 暖渲染（默认 mock 出正文文本、loadClipBody 填缓存）→ 挂 Once mock → 重选触发重渲出链接
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    (document.querySelector('.bz-clip-item') as HTMLElement).click();
    await vi.waitFor(() => {
      const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
      expect(reader.textContent).toContain('段落里提到量子纠缠');
    });
    const { MarkdownRenderer } = await import('obsidian');
    (MarkdownRenderer.render as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_app: any, _md: string, el: HTMLElement) => {
      if (el) el.innerHTML = `<p><a class="internal-link" data-href="${href}" href="${href}">锚链</a></p>`;
    });
    (document.querySelector('.bz-clip-item') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('[data-clip-reader] a.internal-link')).toBeTruthy());
  }

  it('文献盒内的双链 → preventDefault + openKnowledgePreview 直达预览', async () => {
    await openClipReaderWithLink('文献盒/量子纠缠笔记.md', (v) => {
      v.files.set('文献盒/量子纠缠笔记.md', '---\ntitle: 量子纠缠笔记\ntype: term\n---\n简介');
    });
    (document.querySelector('[data-clip-reader] a.internal-link') as HTMLElement).click();
    await vi.waitFor(() => expect(knowledgeMocks.openKnowledgePreview).toHaveBeenCalledTimes(1));
    expect(knowledgeMocks.openKnowledgePreview).toHaveBeenCalledWith(getApp(), '文献盒/量子纠缠笔记.md');
    closePanelSafe();
  });

  it('href 缺 .md 后缀 → 解析补 .md 后同样拦截', async () => {
    await openClipReaderWithLink('文献盒/量子纠缠笔记', (v) => {
      v.files.set('文献盒/量子纠缠笔记.md', '---\ntitle: 量子纠缠笔记\ntype: term\n---\n简介');
    });
    (document.querySelector('[data-clip-reader] a.internal-link') as HTMLElement).click();
    await vi.waitFor(() => expect(knowledgeMocks.openKnowledgePreview).toHaveBeenCalledWith(getApp(), '文献盒/量子纠缠笔记.md'));
    closePanelSafe();
  });

  it('目录外的双链 → 不拦（openKnowledgePreview 不被调，原生导航放行）', async () => {
    await openClipReaderWithLink('归档/网页剪藏/剪藏笔记A.md');
    (document.querySelector('[data-clip-reader] a.internal-link') as HTMLElement).click();
    expect(knowledgeMocks.openKnowledgePreview).not.toHaveBeenCalled();
    closePanelSafe();
  });

  it('目标文件缺失 → 不拦（resolveInternalTarget 返回 null，原生行为自兜）', async () => {
    await openClipReaderWithLink('文献盒/不存在的笔记.md');
    (document.querySelector('[data-clip-reader] a.internal-link') as HTMLElement).click();
    expect(knowledgeMocks.openKnowledgePreview).not.toHaveBeenCalled();
    closePanelSafe();
  });

  it('裸 basename 双链（锚定别名链形态）→ metadataCache 解析兜底命中文献盒 → 拦截直达预览', async () => {
    // 锚定双链写 `[[basename|原文字]]`（anchor.ts aliasLink），data-href 无目录——
    // 全路径直查必空，靠 getFirstLinkfileDest 第三级解析（issue 329 Bug 3）
    await openClipReaderWithLink('量子纠缠笔记', (v) => {
      v.files.set('文献盒/量子纠缠笔记.md', '---\ntitle: 量子纠缠笔记\ntype: term\n---\n简介');
    });
    (getApp() as any).metadataCache.getFirstLinkfileDest = vi.fn(() => '文献盒/量子纠缠笔记.md');
    (document.querySelector('[data-clip-reader] a.internal-link') as HTMLElement).click();
    await vi.waitFor(() =>
      expect(knowledgeMocks.openKnowledgePreview).toHaveBeenCalledWith(getApp(), '文献盒/量子纠缠笔记.md'));
    closePanelSafe();
  });

  it('裸 basename 解析为空 → 不拦（维持原生导航）', async () => {
    await openClipReaderWithLink('不存在的笔记');
    (getApp() as any).metadataCache.getFirstLinkfileDest = vi.fn(() => '');
    (document.querySelector('[data-clip-reader] a.internal-link') as HTMLElement).click();
    expect(knowledgeMocks.openKnowledgePreview).not.toHaveBeenCalled();
    closePanelSafe();
  });

  it('裸 basename 解析目标不在 vault → 不拦（守卫存在性，不拦向幽灵路径）', async () => {
    await openClipReaderWithLink('幽灵笔记');
    (getApp() as any).metadataCache.getFirstLinkfileDest = vi.fn(() => '文献盒/幽灵笔记.md');
    (document.querySelector('[data-clip-reader] a.internal-link') as HTMLElement).click();
    expect(knowledgeMocks.openKnowledgePreview).not.toHaveBeenCalled();
    closePanelSafe();
  });
});

// ================= 保存物化（writeClipNote 链路） =================

describe('保存物化（issue 329 / ADR-0144 决策 4）', () => {
  it('落盘前变换：划词双链 + 已存图片换链进 md；成功后侧写三段清理 + 待升级 source 逐个回写', async () => {
    const vault = boot();
    // 预置侧写三段（未保存条目阅读期的暂存态）
    vault.files.set('CONFIG/STORAGE/clipbook.json', JSON.stringify({
      articleOverrides: {}, savedArchive: [], order: [],
      marks: { 'url:https://guokr.com/1': [{ find: '量子纠缠', notePath: '文献盒/量子纠缠笔记.md', kind: 'term' }] },
      savedImages: { 'url:https://guokr.com/1': [{ src: 'https://img.example/a.png', local: '归档/网页剪藏/assets/甲文.png' }] },
      pendingSource: { 'url:https://guokr.com/1': ['文献盒/量子纠缠笔记.md', '文献盒/图版甲.md'] },
    }));
    const raw = {
      platform: '果壳科学人', title: '甲文', url: 'https://guokr.com/1', author: '果壳',
      date: '2026-09-01 08:00:00',
      body: '正文讲到了量子纠缠，配一张 ![配图](https://img.example/a.png) 图。',
    };
    const ok = await writeClipNote(raw);
    expect(ok).toBe(true);
    const md = vault.files.get('归档/网页剪藏/甲文.md')!;
    expect(md).toContain('[[量子纠缠笔记|量子纠缠]]');     // 划词别名双链进 md
    expect(md).toContain('![[归档/网页剪藏/assets/甲文.png]]'); // 图片外链 → 本地嵌入
    expect(md).not.toContain('https://img.example/a.png');   // 外链不残留
    expect(md).toContain('url: "https://guokr.com/1"');      // frontmatter 契约不动
    await drainNewsWritesForTests();
    // 侧写三段清理
    const sidecar = await readClipbookData();
    expect(sidecar.marks['url:https://guokr.com/1']).toBeUndefined();
    expect(sidecar.savedImages['url:https://guokr.com/1']).toBeUndefined();
    expect(sidecar.pendingSource['url:https://guokr.com/1']).toBeUndefined();
    // 待升级 source 逐个回写 [[剪藏路径|条目标题]]
    expect(knowledgeMocks.upgradeNoteSourceInternal).toHaveBeenCalledTimes(2);
    expect(knowledgeMocks.upgradeNoteSourceInternal).toHaveBeenCalledWith(
      getApp(), '文献盒/量子纠缠笔记.md', '[[归档/网页剪藏/甲文.md|甲文]]',
    );
    expect(knowledgeMocks.upgradeNoteSourceInternal).toHaveBeenCalledWith(
      getApp(), '文献盒/图版甲.md', '[[归档/网页剪藏/甲文.md|甲文]]',
    );
  });

  it('无标记条目保存：body 零改动、侧写无该键（升级不空转）', async () => {
    const vault = boot();
    const raw = { platform: '果壳科学人', title: '乙文', url: 'https://guokr.com/2', body: '普通正文。' };
    const ok = await writeClipNote(raw);
    expect(ok).toBe(true);
    const md = vault.files.get('归档/网页剪藏/乙文.md')!;
    expect(md).toContain('普通正文。');
    expect(knowledgeMocks.upgradeNoteSourceInternal).not.toHaveBeenCalled();
  });
});

// ================= 已保存条目直写路径 =================

describe('已保存条目直写路径（issue 329 / ADR-0144 决策 4）', () => {
  it('clip 条目划词 onCreated → 剪藏 md 直写替换（frontmatter 不动）+ source 立即升级，不走侧写', async () => {
    const vault = boot();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(1));
    // 切剪藏本源 → 打开已保存条目
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    (document.querySelector('.bz-clip-item') as HTMLElement).click();
    await vi.waitFor(() => {
      const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
      expect(reader.textContent).toContain('段落里提到量子纠缠');
    });
    const bar = await showToolbar('量子纠缠');
    (bar.querySelector('[data-clip-selbar-act="term"]') as HTMLElement).click();
    await vi.waitFor(() => expect(knowledgeMocks.openTermNote).toHaveBeenCalledTimes(1));
    const [, , opts] = (knowledgeMocks.openTermNote as ReturnType<typeof vi.fn>).mock.calls[0];
    opts.onCreated('文献盒/量子纠缠笔记.md');
    await vi.waitFor(() => {
      const md = vault.files.get('归档/网页剪藏/剪藏笔记A.md')!;
      expect(md).toContain('[[量子纠缠笔记|量子纠缠]]');
    });
    const md = vault.files.get('归档/网页剪藏/剪藏笔记A.md')!;
    expect(md).toContain('url: "https://guokr.com/old"'); // frontmatter 不误伤
    expect(md).toContain('段落里提到[[量子纠缠笔记|量子纠缠]]。');
    // source 立即升级（内部路径 + 条目标题），侧写 marks 不落（直写不占侧写）
    await vi.waitFor(() => expect(knowledgeMocks.upgradeNoteSourceInternal).toHaveBeenCalledTimes(1));
    expect(knowledgeMocks.upgradeNoteSourceInternal).toHaveBeenCalledWith(
      getApp(), '文献盒/量子纠缠笔记.md', '[[归档/网页剪藏/剪藏笔记A.md|剪藏笔记A]]',
    );
    const sidecar = await readClipbookData();
    expect(sidecar.marks['clip:归档/网页剪藏/剪藏笔记A.md']).toBeUndefined();
    closePanelSafe();
  });
});

// ================= 保存剪藏全量图片本地化（issue 329 追加修订） =================

/** 假图响应：/bad/ 前缀 404，其余 200 png 二进制（带 content-type 头） */
function mockImageFetch(): void {
  (requestUrl as ReturnType<typeof vi.fn>).mockImplementation(async (opts: any) => {
    if (String(opts.url).includes('/bad/')) return { status: 404, arrayBuffer: new ArrayBuffer(0) };
    return {
      status: 200,
      arrayBuffer: new TextEncoder().encode('bytes:' + String(opts.url)).buffer,
      headers: { 'content-type': 'image/png' },
    };
  });
}

describe('保存剪藏全量图片本地化（issue 329 追加修订）', () => {
  it('多图：progress 通知原地更新（正在保存图片 1/2），收口 success 含张数，md 全换本地嵌入', async () => {
    const vault = boot();
    const okResp = (opts: any) => ({
      status: 200,
      arrayBuffer: new TextEncoder().encode('bytes:' + String(opts.url)).buffer,
      headers: { 'content-type': 'image/png' },
    });
    // 第一张挂起：锁存 progress 形态后再放行（单张瞬时完成观察不到中间态）
    let release!: (v: any) => void;
    const gate = new Promise<any>((resolve) => { release = resolve; });
    (requestUrl as ReturnType<typeof vi.fn>).mockImplementation((opts: any) =>
      String(opts.url).includes('slow') ? gate : Promise.resolve(okResp(opts)));
    const p = writeClipNote({
      platform: '果壳科学人', title: '图文丙', url: 'https://guokr.com/3', author: '果壳',
      date: '2026-09-01 08:00:00',
      body: '图一 ![慢](https://img.example/slow.png) 图二 ![乙](https://img.example/b.png)。',
    });
    await vi.waitFor(() => {
      const el = [...document.querySelectorAll('.bz-notice')].find((n) => n.className.includes('bz-notice--progress'));
      expect(el).toBeTruthy();
      expect(el!.textContent).toContain('正在保存图片 1/2');
    });
    release(okResp({ url: 'https://img.example/slow.png' }));
    expect(await p).toBe(true);
    // 收口：progress 原地转 success（含张数，正文无 emoji 无感叹号）
    await vi.waitFor(() => {
      const el = [...document.querySelectorAll('.bz-notice')].find((n) =>
        n.className.includes('bz-notice--success') && (n.textContent || '').includes('已本地化 2 张图片'));
      expect(el).toBeTruthy();
    });
    // md：两图全换本地嵌入（URL 自带名命名），外链零残留；frontmatter 不动
    const md = vault.files.get('归档/网页剪藏/图文丙.md')!;
    expect(md).toContain('![[归档/网页剪藏/assets/slow.png]]');
    expect(md).toContain('![[归档/网页剪藏/assets/b.png]]');
    expect(md).not.toContain('https://img.example');
    expect(md).toContain('url: "https://guokr.com/3"');
    // 二进制真的落盘
    expect((vault as any).binaryFiles.has('归档/网页剪藏/assets/slow.png')).toBe(true);
    expect((vault as any).binaryFiles.has('归档/网页剪藏/assets/b.png')).toBe(true);
  });

  it('部分失败：success 收口含失败数；失败图保留原外链', async () => {
    const vault = boot();
    mockImageFetch();
    const ok = await writeClipNote({
      platform: '果壳科学人', title: '图文丁', url: 'https://guokr.com/4',
      body: '![好](https://img.example/ok.png) ![坏](https://img.example/bad/gone.png)',
    });
    expect(ok).toBe(true);
    await vi.waitFor(() => expect(hasNotice('已本地化 1 张图片，1 张失败保留外链')).toBe(true));
    const md = vault.files.get('归档/网页剪藏/图文丁.md')!;
    expect(md).toContain('![[归档/网页剪藏/assets/ok.png]]');
    expect(md).toContain('![坏](https://img.example/bad/gone.png)');
  });

  it('全部失败：warning 一条含失败数，正文保留全部外链', async () => {
    const vault = boot();
    mockImageFetch();
    const ok = await writeClipNote({
      platform: '果壳科学人', title: '图文戊', url: 'https://guokr.com/5',
      body: '![一](https://img.example/bad/1.png) ![二](https://img.example/bad/2.png)',
    });
    expect(ok).toBe(true);
    await vi.waitFor(() => expect(hasNotice('2 张图片保存失败，正文保留原外链')).toBe(true));
    const warn = [...document.querySelectorAll('.bz-notice')].find((n) => n.className.includes('bz-notice--warning'));
    expect(warn).toBeTruthy();
    const md = vault.files.get('归档/网页剪藏/图文戊.md')!;
    expect(md).toContain('![一](https://img.example/bad/1.png)');
    expect(md).toContain('![二](https://img.example/bad/2.png)');
  });

  it('零图片：不弹图片相关通知（只有保存成功一条）', async () => {
    const vault = boot();
    mockImageFetch();
    await writeClipNote({ platform: '果壳科学人', title: '纯文己', url: 'https://guokr.com/6', body: '没有图的正文。' });
    await vi.waitFor(() => expect(hasNotice('已保存：纯文己')).toBe(true));
    expect(hasNotice(/本地化|保存失败/)).toBe(false);
  });

  it('时机：覆盖确认前不网络等待（确认框挂起时零请求），确认后才拉图', async () => {
    const vault = boot();
    vault.files.set('归档/网页剪藏/图文庚.md', '旧内容');
    mockImageFetch();
    const p = writeClipNote({
      platform: '果壳科学人', title: '图文庚', url: 'https://guokr.com/7',
      body: '![图](https://img.example/confirm.png)',
    });
    // 覆盖确认框已挂起 → 此刻 requestUrl 必须零调用
    await vi.waitFor(() => expect(document.querySelector('.y')).toBeTruthy());
    expect((requestUrl as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    (document.querySelector('.y') as HTMLElement).click();
    expect(await p).toBe(true);
    expect((requestUrl as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    const md = vault.files.get('归档/网页剪藏/图文庚.md')!;
    expect(md).toContain('![[归档/网页剪藏/assets/confirm.png]]');
  });

  it('菜单「保存到剪藏本」→ flowSave 全链路：图下载落盘、md 换链、已处理态照常落盘', async () => {
    const vault = boot();
    mockImageFetch();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(1));
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const btn = [...(document.querySelector('.bz-item-menu') as HTMLElement).querySelectorAll('.bz-item-menu-item')]
      .find((b) => b.textContent!.includes('保存到剪藏本')) as HTMLElement;
    btn.click();
    await vi.waitFor(() => expect(vault.files.get('归档/网页剪藏/甲文.md')).toBeTruthy());
    const md = vault.files.get('归档/网页剪藏/甲文.md')!;
    expect(md).toContain('![[归档/网页剪藏/assets/a.png]]');
    expect(md).not.toContain('https://img.example');
    await vi.waitFor(() => expect(hasNotice('已本地化 1 张图片')).toBe(true));
    await drainNewsWritesForTests();
    const disk = JSON.parse(vault.files.get(getNewsFilePath())!);
    expect(disk.articles[0].state).toBe('saved'); // flow 编排（标已处理/统计）不受拉图影响
  });
});
