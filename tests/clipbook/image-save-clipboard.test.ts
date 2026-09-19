// @vitest-environment jsdom
/**
 * memo item-1789790237962-3884qs 回归：保存图片成功后，把图片的嵌入 wikilink
 * `![[本地路径]]` 写入系统剪贴板。
 * - 成功路径：clipboard.writeText 收到 `![[归档/网页剪藏/assets/<名>]]`，且**不新增成功通知**
 *   （只有 image-save 单源既有「图片已保存…」单弹，防双弹）；
 * - 写入被拒（权限/非安全上下文）：不出未捕获异常，notifyActionError 带原因反馈，保存本身不受影响；
 * - 环境 clipboard API 整体缺席（原型 fake 环境同款）：静默跳过，保存照常成功、无误报错误。
 * UI 动线走真实面板（core-fix-c CB7 手法）：桌面开面板自动选中首篇 → 正文 img 单击
 * → 图片工具框 → 「保存图片」。mock MarkdownRenderer 只落纯文本，水合后的正文图以
 * 手插 <img> 等价替代（单击委托只认 [data-clip-md] 内 img，与水合产物同构）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, Platform as MockPlatform, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { unloadPanel } from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { notifyActionError, notice } from '../../src/core/notice';

// notice 层包装（默认透传真实实现，DOM toast 照常渲染；断言调用参数用）
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return {
    ...actual,
    notice: vi.fn(actual.notice),
    notifyActionError: vi.fn(actual.notifyActionError),
  };
});

const IMG_URL = 'https://cdn.example.com/pic.png';
const IMG_LOCAL = '归档/网页剪藏/assets/pic.png';

function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles: [
      {
        platform: '果壳科学人', title: '带图文章', url: 'https://guokr.com/1', author: '果壳',
        date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00',
        body: '正文开头 ![配图](' + IMG_URL + ') 正文结尾。',
      },
    ],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
    lastFetchAt: Date.now(), // 拦住开面板自动抓取（本文件是 UI 回归）
  }));
  return vault;
}

/** 替换 navigator.clipboard（configurable: true，setup.ts 的补齐桩可被覆盖；clipboard-fallback.test.ts 手法） */
function stubClipboard(writeText: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText, readText: vi.fn(() => Promise.resolve('')) },
    configurable: true,
  });
}

/** 摘掉 clipboard API（模拟原型 fake 环境/非安全上下文的整体缺席） */
function removeClipboard(): void {
  try { delete (navigator as any).clipboard; } catch (e) { /* 摘不掉（不可配置）→ 忽略 */ }
}

/** requestUrl 出假图：200 png 二进制（image-save.test.ts 同款） */
function mockImageFetch(): void {
  (requestUrl as ReturnType<typeof vi.fn>).mockImplementation(async (opts: any) => ({
    status: 200,
    arrayBuffer: new TextEncoder().encode('bytes:' + String(opts.url)).buffer,
    headers: { 'content-type': 'image/png' },
  }));
}

/** 桌面开面板（自动选中首篇）→ 往正文容器手插 <img>（等价水合后的正文图） */
async function openDesktopWithImage(): Promise<MockVault> {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  unloadPanel();
  resetObsidianMocks();
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
  const vault = seedVault();
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({
    storagePath: 'CONFIG/STORAGE',
    articleDirectory: '归档/网页剪藏',
    clipbookImageFolder: '',
  } as any));
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  await vi.waitFor(() => expect(M.articles.length).toBe(1));
  const md = await vi.waitFor(() => {
    const el = document.querySelector('[data-clip-md]') as HTMLElement | null;
    expect(el?.textContent?.length ?? 0).toBeGreaterThan(0);
    return el!;
  });
  const img = document.createElement('img');
  img.setAttribute('src', IMG_URL);
  md.appendChild(img);
  return vault;
}

/** 单击正文图 → 等图片工具框出「保存图片」钮 → 点下（真实委托链进 actSaveImage） */
async function clickSaveImage(): Promise<void> {
  (document.querySelector('[data-clip-md] img') as HTMLElement).click();
  const btn = await vi.waitFor(() => {
    const el = document.querySelector('[data-clip-selbar-act="save-img"]') as HTMLElement | null;
    expect(el, '图片工具框应出现「保存图片」钮').toBeTruthy();
    return el!;
  });
  btn.click();
}

const vaultOf = (): MockVault => getApp().vault as unknown as MockVault;

beforeEach(() => {
  clearNotices();
  removeClipboard();
  vi.mocked(notice).mockClear();
  vi.mocked(notifyActionError).mockClear();
  (requestUrl as ReturnType<typeof vi.fn>).mockReset();
});

afterEach(() => {
  removeClipboard();
});

describe('保存图片后自动复制嵌入 wikilink（memo item-1789790237962-3884qs）', () => {
  it('保存成功 → 剪贴板收到 ![[本地路径]]，且只有「图片已保存…」单弹（不新增成功通知）', async () => {
    const vault = await openDesktopWithImage();
    mockImageFetch();
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    await clickSaveImage();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(`![[${IMG_LOCAL}]]`);
    // 图片真的落盘（wikilink 指向的路径存在）
    await drainNewsWritesForTests();
    expect(vault.binaryFiles.has(IMG_LOCAL)).toBe(true);
    // 通知恰好一条：image-save 单源既有成功文案，无「复制成功」类第二弹
    expect(getNoticeMessages()).toEqual(['图片已保存，保存剪藏时一并换链']);
  });

  it('clipboard 写入被拒 → 不抛未捕获异常，notifyActionError 带原因反馈，保存本身照常成功', async () => {
    const vault = await openDesktopWithImage();
    mockImageFetch();
    stubClipboard(vi.fn(() => Promise.reject(new Error('denied'))));
    await clickSaveImage();
    await vi.waitFor(() => expect(notifyActionError).toHaveBeenCalledTimes(1));
    const [err, action] = vi.mocked(notifyActionError).mock.calls[0];
    expect((err as Error).message).toBe('denied');
    expect(action).toBe('复制图片链接');
    // 真实透传实现渲染的 DOM 文案（动作 + 原因 + 重试途径，一致#15）
    expect(getNoticeMessages()).toContain('复制图片链接失败：denied，请重试');
    // 保存不受剪贴板失败影响
    await drainNewsWritesForTests();
    expect(vault.binaryFiles.has(IMG_LOCAL)).toBe(true);
  });

  it('环境无 clipboard API（原型 fake 同款）→ 静默跳过：保存成功、无错误误报、无异常', async () => {
    const vault = await openDesktopWithImage();
    mockImageFetch();
    removeClipboard(); // navigator.clipboard 整体缺席
    await clickSaveImage();
    // 保存完成（二进制落盘）即证明 actSaveImage 走完未抛
    await vi.waitFor(() => expect(vault.binaryFiles.has(IMG_LOCAL)).toBe(true));
    await drainNewsWritesForTests();
    expect(getNoticeMessages()).toEqual(['图片已保存，保存剪藏时一并换链']);
  });
});
