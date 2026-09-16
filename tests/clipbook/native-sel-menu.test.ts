// @vitest-environment jsdom
/**
 * clipbook（issue 341）：正文原生长按选择菜单的屏蔽（iOS Callout / Android 选择 ActionMode）。
 *
 * 缘起：issue 329 给正文开了 user-select:text 让划选工具框拿得到原生选区（ADR-0144）。
 * 代价是移动端长按正文会同时弹出**系统**的选择菜单（iOS Callout「拷贝/查询/共享」、
 * Android 选择工具条），与自绘工具框同位抢位。系统菜单是 OS 层 UI 不是 DOM，只能：
 *   - iOS WKWebView：`-webkit-touch-callout: none`（唯一开关，落在 styles.css 正文容器规则）
 *   - Android WebView：正文容器内拦 `contextmenu` + preventDefault（ui.ts onReaderContextMenu）
 * 两条路均为 best-effort（Android ActionMode 未必认 preventDefault）——拦不住时靠
 * MOBILE_SYS_BAR_CLEARANCE 48px 让位兜底，故让位逻辑不在本文件断言范围内（toolbar.test.ts 覆盖）。
 *
 * 作用域铁律：只拦移动端 + 只拦 [data-clip-md]/[data-clip-mob-md] 内的目标。
 * 列表卡片右键菜单（item-actions）与桌面右键是鼠标惯用件，不得被误伤。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { M } from '../../src/clipbook/state';
import { getNewsFilePath } from '../../src/clipbook/news-data';
const { Platform } = await import('obsidian');

// ==================== 脚手架 ====================

function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set(getNewsFilePath(), JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '甲文', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '正文讲到了**量子纠缠** 是现象。' },
    ],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  return vault;
}

function boot(): MockVault {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  const vault = seedVault();
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({
    storagePath: 'CONFIG/STORAGE',
    articleDirectory: '归档/网页剪藏',
    knowledgeDirectory: '文献盒',
    clipbookImageFolder: '',
  } as any));
  return vault;
}

/** 开面板并等到首篇正文落定（DOM 结构桌面/移动同构，端别只影响事件分支） */
async function openPanel(): Promise<void> {
  boot();
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  await vi.waitFor(() => expect(M.articles.length).toBe(1));
}

/** 派发可取消的 contextmenu，返回是否被拦下（preventDefault 生效 → true） */
function fireContextMenu(target: EventTarget): boolean {
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev.defaultPrevented;
}

/** 模拟正文内文字选区（commonAncestorContainer 指向正文容器） */
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

function closePanelSafe(): void {
  (document.querySelector('.bz-panel-overlay') as HTMLElement | null)?.style.setProperty('display', 'none');
  M.open = false;
}

afterEach(() => {
  vi.restoreAllMocks();
  (Platform as any).isMobile = false; // 移动端用例置位后复位，防污染后续用例
  clearNotices();
});

// ==================== 行为层：contextmenu 拦截与作用域 ====================

describe('正文原生选择菜单屏蔽（issue 341）', () => {
  it('移动端：桌面阅读正文 [data-clip-md] 内 → contextmenu 被拦（defaultPrevented）', async () => {
    await openPanel();
    const md = document.querySelector('[data-clip-md]') as HTMLElement;
    expect(md).toBeTruthy();
    (Platform as any).isMobile = true;
    expect(fireContextMenu(md)).toBe(true);
    closePanelSafe();
  });

  it('移动端：正文内子元素（委托路径）同样被拦', async () => {
    await openPanel();
    const md = document.querySelector('[data-clip-md]') as HTMLElement;
    const inner = document.createElement('span');
    inner.textContent = '量子纠缠';
    md.appendChild(inner);
    (Platform as any).isMobile = true;
    // 事件落在 span 上，靠 closest 命中正文容器
    expect(fireContextMenu(inner)).toBe(true);
    closePanelSafe();
  });

  it('桌面：同一目标不拦（本机右键是鼠标惯用件）', async () => {
    await openPanel();
    const md = document.querySelector('[data-clip-md]') as HTMLElement;
    (Platform as any).isMobile = false;
    expect(fireContextMenu(md)).toBe(false);
    closePanelSafe();
  });

  it('移动端：移动详情正文 [data-clip-mob-md] 内 → 被拦（双端正文同一口径）', async () => {
    await openPanel();
    (Platform as any).isMobile = true;
    (document.querySelector('.bz-clip-mob-item') as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    await vi.waitFor(() => expect(document.querySelector('[data-clip-mob-md]')).toBeTruthy());
    expect(fireContextMenu(document.querySelector('[data-clip-mob-md]') as HTMLElement)).toBe(true);
    closePanelSafe();
  });

  it('移动端：正文外的目标不拦（面板骨架与 rail 源行照旧）', async () => {
    await openPanel();
    (Platform as any).isMobile = true;
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    const rail = document.querySelector('[data-clip-rail]') as HTMLElement;
    expect(rail).toBeTruthy();
    expect(fireContextMenu(overlay)).toBe(false); // 遮罩空白处（target === overlayEl）
    expect(fireContextMenu(rail)).toBe(false);
    closePanelSafe();
  });

  it('列表卡片右键菜单不被误伤：桌面卡片 contextmenu 仍由 item-actions 接管并弹出菜单', async () => {
    await openPanel();
    const card = document.querySelector('.bz-clip-item') as HTMLElement;
    expect(card).toBeTruthy();
    fireContextMenu(card);
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    closePanelSafe();
  });

  it('移动端卡片 contextmenu 不被本拦截吞掉（卡片菜单由触屏长按接管，contextmenu 本就不管）', async () => {
    await openPanel();
    (Platform as any).isMobile = true;
    const card = document.querySelector('.bz-clip-item') as HTMLElement;
    // item-actions 在移动端对 contextmenu 直接 return（不 preventDefault）——
    // 这里若为 true，说明我们的正文拦截越界吞了卡片菜单
    expect(fireContextMenu(card)).toBe(false);
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    closePanelSafe();
  });

  it('屏蔽不伤划选工具框：拦下 contextmenu 后，正文划选仍能弹出工具框', async () => {
    await openPanel();
    (Platform as any).isMobile = true;
    const md = document.querySelector('[data-clip-md]') as HTMLElement;
    expect(fireContextMenu(md)).toBe(true);
    mockTextSelection('量子纠缠', md);
    (document.querySelector('[data-clip-read-pane]') as HTMLElement).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await vi.waitFor(() => {
      const bar = document.querySelector('.bz-clip-selbar') as HTMLElement | null;
      expect(bar).toBeTruthy();
      expect(bar!.style.display).toBe('flex');
      expect(bar!.querySelectorAll('[data-clip-selbar-act]')).toHaveLength(3);
    });
    closePanelSafe();
  });
});

// ==================== 样式源静态断言（jsdom 不算 CSS 级联） ====================

const css = fs.readFileSync(path.join(process.cwd(), 'src/clipbook/styles.css'), 'utf8');

/** 取某条规则的声明块（选择器后第一个 {...}；styles.css 经 prettier，选择器与 { 有空格） */
function declBlock(selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `规则 ${selector} 应存在`).toBeGreaterThan(-1);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('正文容器 Callout 抑制（issue 341，样式源断言）', () => {
  it('正文容器规则含 -webkit-touch-callout:none（iOS 侧唯一开关）', () => {
    const decl = declBlock('.bz-clip-read,');
    expect(decl).toMatch(/-webkit-touch-callout:\s*none/);
  });

  it('同一规则仍保留 user-select:text —— 收回豁免会连原生选区一起没，工具框拿不到文本', () => {
    const decl = declBlock('.bz-clip-read,');
    expect(decl).toMatch(/user-select:\s*text/);
    expect(decl).toMatch(/-webkit-user-select:\s*text/);
  });

  it('touch-callout 只出现在这一处（不外溢到其它域；剪藏本是全插件唯一选择豁免域）', () => {
    const hits = css.match(/-webkit-touch-callout/g) || [];
    expect(hits).toHaveLength(1);
  });
});
