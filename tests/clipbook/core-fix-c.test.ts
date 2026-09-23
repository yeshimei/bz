// @vitest-environment jsdom
/**
 * clipbook 修复批 C 回归（UI 核心动线 / 删除口径 / 生命周期）：
 * - 条目1/3：删除免确认直达撤销（效率整改 5）+ 标读/撤销/删除链写层失败可感知（CB2 UI 半）；
 * - 条目2：主面板 topifyZ 发号（CB1）；条目4：j/k 焦点接力 + 修饰键排除（效率#6+CB5）；
 * - 条目5：会话内滚位记忆（效率#17）；条目6/7：桌面搜索 ESC 清词 / ✕ 清除 + 打开聚焦（效率#11/#12）；
 * - 条目8/9：错误态分流重试（效率#16）/ 首开装载骨架（效率#17）；
 * - 条目10：CB6 已失败图摘除 / CB7 关面板收划选框 / CB8 卸载引用对称（CB9 loader 归批 B，跳过）；
 * - 条目11/12：C-UI3 打开笔记键盘可达 / C-UI7 移动搜索栏复位；
 * - 条目13/14：undoTrashClip 目录兜底与分型文案（新-5）/ 错误通知人话化（一致#15）。
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import {
  closePanel, revealClipArticle, deleteClipNote, __bindImgFallbackForTests,
} from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';
import { emptySidecar } from '../../src/clipbook/data';
import { notifyActionError, notifySaveError, notifyUndo, notice } from '../../src/core/notice';
import { readNewsAndSidecar } from '../../src/clipbook/loader';
import { flowMarkRead, flowUndoHandled, flowDeleteNews } from '../../src/clipbook/flow';

// flow 层包装（CB2 注入 reject 用）；默认透传真实实现，beforeEach 复位
vi.mock('../../src/clipbook/flow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/clipbook/flow')>();
  return {
    ...actual,
    flowMarkRead: vi.fn(actual.flowMarkRead),
    flowUndoHandled: vi.fn(actual.flowUndoHandled),
    flowDeleteNews: vi.fn(actual.flowDeleteNews),
  };
});
// loader 层包装（效率#16/#17 注入 corrupt/异常/延迟用）
vi.mock('../../src/clipbook/loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/clipbook/loader')>();
  return { ...actual, readNewsAndSidecar: vi.fn(actual.readNewsAndSidecar) };
});
// knowledge 契约 API 打桩：锚定/删除降级链在 jsdom 里不可拖真模块
vi.mock('../../src/knowledge', () => ({
  openTermNote: vi.fn((_app: any, _text: string, opts: any) => opts?.onCreated?.('文献盒/词.md')),
  openPassageNote: vi.fn((_app: any, opts: any) => opts?.onCreated?.('文献盒/段.md')),
  openImageNote: vi.fn((_app: any, opts: any) => opts?.onCreated?.('文献盒/图.md')),
  retireKnowledgeSourcesForClip: vi.fn(async () => {}),
  upgradeNoteSourceInternal: vi.fn(async () => {}),
}));
// notice 层包装（默认透传真实实现，DOM toast 照常渲染；测试可断言调用参数 / 捕获撤销回调）
vi.mock('../../src/core/notice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/notice')>();
  return {
    ...actual,
    notice: vi.fn(actual.notice),
    notify: vi.fn(actual.notify),
    notifyUndo: vi.fn(actual.notifyUndo),
    notifySaveError: vi.fn(actual.notifySaveError),
    notifyActionError: vi.fn(actual.notifyActionError),
  };
});

let actualFlow: typeof import('../../src/clipbook/flow');
let actualLoader: typeof import('../../src/clipbook/loader');

/** 种子：news.json 未读 2（影视飓风 B站 + 果壳文章一，均未剪藏）+ 剪藏目录 1 篇（独立 url）。
 *  注意：all 视图排除已被剪藏承接的 news（queryBySourceFull isClippedNews 过滤），种子须两篇都不可承接 */
function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '果壳文章一', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '果壳正文段落，可划选。' },
      { platform: 'B站', title: '影视飓风视频', url: 'https://bilibili.com/video/BV1', author: '影视飓风', date: '2026-09-01 09:00:00', body: '视频简介内容' },
    ],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
    lastFetchAt: Date.now(), // 拦住开面板自动抓取（本文件是 UI 回归）
  }));
  vault.files.set('归档/网页剪藏/剪藏笔记A.md', '---\nurl: "https://example.com/clip-a"\nsite: "果壳"\ncreated: 2026-08-20 10:00:00\n---\n剪藏正文第一段。');
  return vault;
}

function boot(): { vault: MockVault } {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
  const vault = seedVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return { vault };
}

async function openDesktop(): Promise<MockVault> {
  const { vault } = boot();
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  await vi.waitFor(() => expect(M.articles.length).toBe(2));
  return vault;
}

const diskJson = (vault: MockVault) => JSON.parse(vault.files.get('CONFIG/STORAGE/news.json')!);

beforeAll(async () => {
  actualFlow = await vi.importActual('../../src/clipbook/flow');
  actualLoader = await vi.importActual('../../src/clipbook/loader');
});

beforeEach(() => {
  // 包装层复位：清调用记录 + 还原透传实现（防上一条用例的 once 注入泄漏）
  vi.mocked(flowMarkRead).mockReset().mockImplementation(actualFlow.flowMarkRead);
  vi.mocked(flowUndoHandled).mockReset().mockImplementation(actualFlow.flowUndoHandled);
  vi.mocked(flowDeleteNews).mockReset().mockImplementation(actualFlow.flowDeleteNews);
  vi.mocked(readNewsAndSidecar).mockReset().mockImplementation(actualLoader.readNewsAndSidecar);
  vi.mocked(notice).mockClear();
  vi.mocked(notifyUndo).mockClear();
  vi.mocked(notifySaveError).mockClear();
  vi.mocked(notifyActionError).mockClear();
});

afterEach(() => {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
});

// ================= 条目1+3：删除免确认直达撤销 + 写层失败可感知 =================

describe('删除免确认直达撤销（效率整改 5）+ CB2 UI 半 catch 链', () => {
  it('删除 news 条目：无确认框直落 + notifyUndo 在 + 撤销插回 news.json', async () => {
    const vault = await openDesktop();
    const item = document.querySelector('.bz-clip-item') as HTMLElement; // 首篇 = 影视飓风（收件流分支）
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const delBtn = [...document.querySelectorAll('.bz-item-menu-item')]
      .find((b) => b.textContent!.trim() === '删除') as HTMLElement;
    expect(delBtn.title).toBe('从收件流删除');
    delBtn.click();
    await new Promise((r) => setTimeout(r, 30));
    // 免确认：flow-dialog 弹层不出现
    expect(document.querySelector('#__shared_confirm_popup__')).toBeNull();
    await vi.waitFor(() => expect(diskJson(vault).articles).toHaveLength(1));
    // 撤销通知在
    expect(vi.mocked(notifyUndo).mock.calls.some(([msg]) => msg === '已删除条目「影视飓风视频」')).toBe(true);
    // 撤销 → raw 快照插回
    const undoCb = vi.mocked(notifyUndo).mock.calls.find(([msg]) => String(msg).startsWith('已删除条目'))![1];
    await undoCb();
    await drainNewsWritesForTests();
    await vi.waitFor(() => expect(diskJson(vault).articles).toHaveLength(2));
  });

  it('删除剪藏：无确认框直落 trash + 撤销原路径重建（文件级双兜底）', async () => {
    const vault = await openDesktop();
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const delBtn = [...document.querySelectorAll('.bz-item-menu-item')]
      .find((b) => b.textContent!.trim() === '删除') as HTMLElement;
    delBtn.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('#__shared_confirm_popup__')).toBeNull();
    await vi.waitFor(() => {
      expect(vault.trashed.some((t) => t.path === '归档/网页剪藏/剪藏笔记A.md' && t.system)).toBe(true);
      expect(vault.files.has('归档/网页剪藏/剪藏笔记A.md')).toBe(false);
    });
    const undoCb = vi.mocked(notifyUndo).mock.calls.find(([msg]) => String(msg).startsWith('已删除剪藏'))![1];
    await undoCb();
    await vi.waitFor(() => expect(vault.files.has('归档/网页剪藏/剪藏笔记A.md')).toBe(true));
  });

  it('CB2：flowMarkRead 写层 reject → notifySaveError(标记已读)，不给假撤销通知', async () => {
    await openDesktop();
    await drainNewsWritesForTests(); // 冲掉开面板「打开即已读」的在途写
    vi.mocked(flowMarkRead).mockRejectedValueOnce(new Error('盘被占用'));
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const readBtn = [...document.querySelectorAll('.bz-item-menu-item')]
      .find((b) => b.textContent!.includes('标记为已读')) as HTMLElement;
    readBtn.click();
    await vi.waitFor(() => {
      const call = vi.mocked(notifySaveError).mock.calls[0];
      expect(call?.[1]).toBe('标记已读');
      expect(String(call?.[0])).toContain('盘被占用');
    });
    // 失败路径不给撤销通知
    expect(vi.mocked(notifyUndo).mock.calls.some(([msg]) => String(msg).includes('标为已读'))).toBe(false);
  });

  it('CB2：flowDeleteNews 写层 reject → notifySaveError(删除条目)，条目不动盘', async () => {
    const vault = await openDesktop();
    vi.mocked(flowDeleteNews).mockRejectedValueOnce(new Error('盘只读'));
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const delBtn = [...document.querySelectorAll('.bz-item-menu-item')]
      .find((b) => b.textContent!.trim() === '删除') as HTMLElement;
    delBtn.click();
    await vi.waitFor(() => expect(vi.mocked(notifySaveError).mock.calls[0]?.[1]).toBe('删除条目'));
    expect(vi.mocked(notifyUndo).mock.calls.some(([msg]) => String(msg).startsWith('已删除条目'))).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(diskJson(vault).articles).toHaveLength(2); // 盘面未动
  });

  it('CB2：撤销链 reject → notifySaveError(撤销)，不误报恢复成功', async () => {
    await openDesktop();
    await drainNewsWritesForTests();
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const readBtn = [...document.querySelectorAll('.bz-item-menu-item')]
      .find((b) => b.textContent!.includes('标记为已读')) as HTMLElement;
    readBtn.click();
    await vi.waitFor(() => expect(vi.mocked(notifyUndo).mock.calls.some(([msg]) => String(msg).includes('标为已读'))).toBe(true));
    vi.mocked(flowUndoHandled).mockRejectedValueOnce(new Error('回写失败'));
    const undoCb = vi.mocked(notifyUndo).mock.calls.find(([msg]) => String(msg).includes('标为已读'))![1];
    await undoCb();
    await vi.waitFor(() => expect(vi.mocked(notifySaveError).mock.calls[0]?.[1]).toBe('撤销'));
    expect(notice).not.toHaveBeenCalledWith('已撤销：条目恢复未读', 'success');
  });
});

// ================= 条目2：CB1 主面板 topifyZ 发号 =================

describe('CB1：showPanel 显示即 topifyZ 发号（ADR-0067）', () => {
  it('overlay 带动态 z 值，重开发号严格递增（与已发号面板同屏恒在上）', async () => {
    await openDesktop();
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    const z1 = Number(overlay.style.zIndex);
    expect(z1).toBeGreaterThan(0); // 发过号（此前无任何 z 写入）
    closePanel();
    openClipbook(getApp()); // 再开 = 新发号（谁后显示谁在上）
    await vi.waitFor(() => expect(M.open).toBe(true));
    const z2 = Number((document.querySelector('.bz-panel-overlay') as HTMLElement).style.zIndex);
    expect(z2).toBeGreaterThan(z1);
  });
});

// ================= 条目4：j/k 焦点接力 + 修饰键排除（效率#6 + CB5） =================

describe('效率#6 + CB5：j/k 焦点接力与修饰键排除', () => {
  it('点目录卡焦点接力右栏；showPanel 桌面先右栏后搜索框落焦', async () => {
    await openDesktop();
    const pane = document.querySelector('[data-clip-read-pane]') as HTMLElement;
    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    // 开面板：右栏先落焦（效率#6），尾部搜索框接管（效率#12）
    expect(document.activeElement).toBe(input);
    // 点目录卡 → 焦点进右栏（j/k 通电）
    (document.querySelector('.bz-clip-item') as HTMLElement).click();
    await vi.waitFor(() => expect(document.activeElement).toBe(pane));
  });

  it('修饰键组合不切篇（Ctrl/Cmd/Alt + j 原样放行），裸 j 正常步进', async () => {
    await openDesktop();
    const pane = document.querySelector('[data-clip-read-pane]') as HTMLElement;
    const before = M.cur!.id; // 倒序后首篇 = 影视飓风
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true }));
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', metaKey: true, bubbles: true }));
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', altKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    expect(M.cur!.id).toBe(before);
    // 裸 j：照常步进到下一篇（果壳文章一）
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://guokr.com/1'));
  });
});

// ================= 条目5：会话内滚位记忆（效率#17） =================

describe('效率#17：会话内滚位记忆', () => {
  it('切走存当前篇 scrollTop，切回恢复记忆值；新会话（beginSession）记忆归零', async () => {
    await openDesktop();
    const sc = document.querySelector('.bz-clip-read-scroll') as HTMLElement;
    const items = [...document.querySelectorAll('.bz-clip-item')] as HTMLElement[];
    expect(items).toHaveLength(2); // [影视飓风（首篇）, 果壳文章一]
    // 首篇滚到中部 → 切到第二篇（无记忆 = 归顶）→ 切回首篇（恢复 120）
    sc.scrollTop = 120;
    items[1].click();
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://guokr.com/1'));
    expect(sc.scrollTop).toBe(0);
    items[0].click();
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://bilibili.com/video/BV1'));
    expect(sc.scrollTop).toBe(120);
    // 会话边界清空：重开面板后旧记忆（120）不再生效——切走时按本会话现值（55）重新入账
    closePanel();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
    sc.scrollTop = 55;
    (([...document.querySelectorAll('.bz-clip-item')] as HTMLElement[])[1]).click();
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://guokr.com/1'));
    (([...document.querySelectorAll('.bz-clip-item')] as HTMLElement[])[0]).click();
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://bilibili.com/video/BV1'));
    expect(sc.scrollTop).toBe(55); // 恢复的是本会话切走时的 55，不是上一会话的 120（beginSession 已清）
  });
});

// ================= 条目6/7：桌面搜索 ESC 清词 / ✕ 清除 + 打开聚焦（效率#11/#12） =================

describe('效率#11/#12：桌面搜索 ESC 清词、✕ 一键清除、打开聚焦', () => {
  it('有词 ESC：清词刷列表、面板不关；无词 ESC：放行关面板', async () => {
    await openDesktop();
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    input.value = '果壳';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(input.value).toBe('');
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
    expect(overlay.style.display).toBe('flex'); // 清词不关面板
    // 无词 ESC → escManager 关面板语义不变
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(overlay.style.display).toBe('none'));
  });

  it('✕ 清除钮：无词隐藏、有词显示；点 = 清词 + 刷新 + 焦点回框', async () => {
    await openDesktop();
    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    const btn = document.querySelector('[data-clip-search-clear]') as HTMLElement;
    expect(btn).toBeTruthy(); // render.ts 搜索壳 markup（原型 × 插件单源）
    expect(btn.hidden).toBe(true);
    input.value = '果壳';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    expect(btn.hidden).toBe(false);
    btn.click();
    expect(input.value).toBe('');
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
    expect(document.activeElement).toBe(input); // 焦点回框
  });
});

// ================= 条目8/9：错误态分流（效率#16）/ 首开装载骨架（效率#17） =================

describe('效率#16：错误态/假空态分流 + 重试', () => {
  it('装载通道异常 → 错误空态（原因 + 重试钮）+ onRetry 通知；重试恢复列表', async () => {
    vi.mocked(readNewsAndSidecar).mockRejectedValueOnce(new Error('盘被锁住'));
    boot();
    openClipbook(getApp());
    const listEl = await vi.waitFor(() => {
      const el = document.querySelector('[data-clip-list]') as HTMLElement;
      expect(el.textContent).toContain('剪藏本数据读取失败：盘被锁住');
      return el;
    });
    expect(vi.mocked(notifyActionError).mock.calls[0]?.[1]).toBe('剪藏本数据读取');
    expect((vi.mocked(notifyActionError).mock.calls[0]?.[2] as any)?.onRetry).toBeTypeOf('function');
    // 错误空态不是引导空态（不误报「暂无内容」）
    expect(listEl.textContent).not.toContain('这个源暂无内容');
    // 重试 → 真实装载恢复
    const retry = [...listEl.querySelectorAll('button')].find((b) => b.textContent!.includes('重试')) as HTMLButtonElement;
    expect(retry).toBeTruthy();
    retry.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
    expect((document.querySelector('[data-clip-list]') as HTMLElement).textContent).not.toContain('读取失败');
  });

  it('news.json 损坏（corrupt）→ 错误空态替代引导空态，重试可恢复', async () => {
    vi.mocked(readNewsAndSidecar).mockResolvedValueOnce({
      status: 'corrupt', articles: [], sidecar: emptySidecar(), clipNotes: null, clipUrls: new Set(), upInfo: {},
    } as any);
    boot();
    openClipbook(getApp());
    const listEl = await vi.waitFor(() => {
      const el = document.querySelector('[data-clip-list]') as HTMLElement;
      expect(el.textContent).toContain('剪藏本数据读取失败：news.json 损坏（原文件已保留）');
      return el;
    });
    expect(listEl.textContent).not.toContain('这个源暂无内容');
    const retry = [...listEl.querySelectorAll('button')].find((b) => b.textContent!.includes('重试')) as HTMLButtonElement;
    retry.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
  });
});

describe('效率#17：首开装载骨架', () => {
  it('未装载先显「正在装载剪藏…」占位，装载完成 renderAll 覆盖', async () => {
    let resolveLoad!: (v: any) => void;
    vi.mocked(readNewsAndSidecar).mockImplementationOnce(() => new Promise((res) => { resolveLoad = res; }));
    boot();
    openClipbook(getApp());
    const listEl = await vi.waitFor(() => {
      const el = document.querySelector('[data-clip-list]') as HTMLElement;
      expect(el.textContent).toContain('正在装载剪藏');
      return el;
    });
    resolveLoad({ status: 'ok', articles: [], sidecar: emptySidecar(), clipNotes: null, clipUrls: new Set(), upInfo: {} });
    await vi.waitFor(() => expect(listEl.textContent).not.toContain('正在装载剪藏'));
  });
});

// ================= 条目10：CB6 / CB7 / CB8（CB9 loader 归并行批 B，本批跳过） =================

describe('CB6/CB7/CB8 生命周期微修', () => {
  it('CB6：挂监听前已加载失败的图（complete && naturalWidth===0）直判摘除；健康图靠 error 兜底', () => {
    const box = document.createElement('div');
    document.body.appendChild(box); // isConnected 依赖挂到文档
    const dead = document.createElement('img');
    Object.defineProperty(dead, 'complete', { value: true });
    Object.defineProperty(dead, 'naturalWidth', { value: 0 });
    const live = document.createElement('img'); // 未完成加载：等 error 事件
    Object.defineProperty(live, 'complete', { value: false });
    Object.defineProperty(live, 'naturalWidth', { value: 0 });
    box.append(dead, live);
    __bindImgFallbackForTests(box);
    expect(dead.isConnected).toBe(false); // 已失败 → 立即摘
    expect(live.isConnected).toBe(true);  // 在途 → 保留
    live.dispatchEvent(new Event('error'));
    expect(live.isConnected).toBe(false); // 加载失败 → error 摘（既有语义不回退）
    box.remove();
  });

  it('CB7：划选工具框显示中关面板 → 工具框随面板收起（不再悬到下一次 mousedown）', async () => {
    await openDesktop();
    const md = await vi.waitFor(() => {
      const el = document.querySelector('[data-clip-md]') as HTMLElement;
      expect(el.textContent!.length).toBeGreaterThan(0);
      return el;
    });
    // 构造正文内选区 → mouseup 触发工具框
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(md);
    sel.addRange(range);
    (document.querySelector('.bz-clip-read-scroll') as HTMLElement)
      .dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const bar = await vi.waitFor(() => {
      const el = document.querySelector('.bz-clip-selbar') as HTMLElement;
      expect(el.style.display).toBe('flex');
      return el;
    });
    closePanel();
    expect(bar.style.display).toBe('none'); // 关面板即收（原实现残留）
  });

  it('CB8：卸载后重开移动面板，详情头引用无残留（title 正常回写）', async () => {
    MockPlatform.isMobile = true;
    boot();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(document.querySelector('[data-clip-mob-list] [data-id]')).toBeTruthy());
    (document.querySelector('[data-clip-mob-list] [data-id]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-clip-mob-title]')!.textContent).toContain('· 目录');
    });
    unloadClipbook();
    // 重开（重建 DOM）：若卸载未清引用且后续误用旧节点，新面板 title 会写空
    boot();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(document.querySelector('[data-clip-mob-list] [data-id]')).toBeTruthy());
    (document.querySelector('[data-clip-mob-list] [data-id]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-clip-mob-title]')!.textContent).toContain('· 目录');
    });
  });
});

// ================= 条目11/12：C-UI3 打开笔记键盘 / C-UI7 移动搜索栏复位 =================

describe('C-UI3：「打开笔记」键盘可达（Enter/Space）', () => {
  async function gotoClipArticle() {
    await openDesktop();
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    (document.querySelector('.bz-clip-item') as HTMLElement).click();
    const foot = await vi.waitFor(() => document.querySelector('[data-clip-open-note]') as HTMLElement);
    const spy = vi.fn(async () => {});
    (getApp().workspace as any).openLinkText = spy;
    return foot;
  }

  it('Enter 触发 openNote（开笔记 + 关面板）', async () => {
    const foot = await gotoClipArticle();
    foot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect((getApp().workspace as any).openLinkText).toHaveBeenCalledWith('归档/网页剪藏/剪藏笔记A.md', '', false, { active: true });
    });
    await vi.waitFor(() => {
      expect((document.querySelector('.bz-panel-overlay') as HTMLElement).style.display).toBe('none');
    });
  });

  it('Space 同触发（同分支口径）', async () => {
    const foot = await gotoClipArticle();
    foot.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect((getApp().workspace as any).openLinkText).toHaveBeenCalled();
    });
  });
});

describe('C-UI7：selectSource 移动搜索栏复位', () => {
  it('移动搜索栏开着有词时换源（通知「查看」定位链）→ 搜索栏收起 + 输入框清空', async () => {
    MockPlatform.isMobile = true;
    boot();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    // 打开移动搜索栏并输入
    (document.querySelector('[data-clip-mob-search]') as HTMLElement).click();
    const mobInput = document.querySelector('[data-clip-mob-input]') as HTMLInputElement;
    mobInput.value = '影视';
    mobInput.dispatchEvent(new Event('input', { bubbles: true }));
    // 通知「查看」→ revealClipArticle → selectSource({kind:'clip'})
    await revealClipArticle('归档/网页剪藏/剪藏笔记A.md');
    const bar = document.querySelector('[data-clip-mob-searchbar]') as HTMLElement;
    expect(bar.style.display).toBe('none');
    expect((document.querySelector('[data-clip-mob-input]') as HTMLInputElement).value).toBe('');
  });
});

describe('效率#12：移动搜索 ✕ 一键清除（有词才现、清空即隐）', () => {
  it('无词隐藏 / 有词显示；点 = 清词 + 收搜索栏 + 钮即隐', async () => {
    MockPlatform.isMobile = true;
    boot();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    (document.querySelector('[data-clip-mob-search]') as HTMLElement).click(); // 开搜索栏
    const input = document.querySelector('[data-clip-mob-input]') as HTMLInputElement;
    const btn = document.querySelector('[data-clip-mob-search-clear]') as HTMLElement;
    expect(btn).toBeTruthy();
    expect(btn.hidden).toBe(true); // 无词初始态
    input.value = '影视';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(btn.hidden).toBe(false); // 有词即显
    btn.click();
    expect(input.value).toBe('');
    expect(btn.hidden).toBe(true);
    expect((document.querySelector('[data-clip-mob-searchbar]') as HTMLElement).style.display).toBe('none'); // 收起
  });
});

// ================= 条目13：undoTrashClip 目录兜底（新-5） =================

describe('新-5：undoTrashClip 目录兜底与分型文案', () => {
  const CLIP_PATH = '归档/网页剪藏/剪藏笔记A.md';
  function clipArticle(vault: MockVault) {
    return {
      id: 'url:https://guokr.com/1',
      origin: 'clip',
      title: '剪藏笔记A',
      url: 'https://guokr.com/1',
      notePath: CLIP_PATH,
      note: { path: CLIP_PATH, file: vault.file(CLIP_PATH) },
      st: 'saved',
    } as any;
  }

  it('目录缺失：撤销前补建目录，原路径重建成功', async () => {
    const vault = await openDesktop();
    await deleteClipNote(clipArticle(vault));
    await vi.waitFor(() => expect(vault.trashed.some((t) => t.path === CLIP_PATH)).toBe(true));
    // 模拟用户顺手清空目录：文件已入回收站，目录下无任何子路径（getAbstractFileByPath → null）
    const undoCb = vi.mocked(notifyUndo).mock.calls.find(([msg]) => String(msg).startsWith('已删除剪藏'))![1];
    await undoCb();
    await vi.waitFor(() => {
      expect(vault.files.has(CLIP_PATH)).toBe(true);
      expect(vault.files.get(CLIP_PATH)).toContain('剪藏正文第一段');
    });
    expect(notice).toHaveBeenCalledWith('已撤销删除：剪藏已恢复', 'success');
  });

  it('同名冲突：文案归因「原路径已存在同名文件」；其他失败型不误归因', async () => {
    const vault = await openDesktop();
    await deleteClipNote(clipArticle(vault));
    const undoCb = vi.mocked(notifyUndo).mock.calls.find(([msg]) => String(msg).startsWith('已删除剪藏'))![1];
    const app = getApp();
    vi.mocked(notice).mockClear();
    // 型 1：同名冲突（消息含 exist）——撤销回调是 fire-and-forget，断言走 waitFor
    (app.vault as any).create = vi.fn(async () => { throw new Error('File already exists'); });
    await undoCb();
    await vi.waitFor(() => expect(notice).toHaveBeenCalledWith('撤销失败：原路径已存在同名文件', 'error'));
    // 型 2：目录/其他原因（不再单一归因同名）
    vi.mocked(notice).mockClear();
    (app.vault as any).create = vi.fn(async () => { throw new Error('disk full'); });
    await undoCb();
    await vi.waitFor(() => expect(notice).toHaveBeenCalledWith('撤销失败：disk full，请重试', 'error'));
  });
});

// ================= 条目14：错误通知人话化（一致#15） =================

describe('一致#15：错误通知人话化（notifyActionError 收口）', () => {
  it('删除剪藏失败：文案 = 动作名 + 原因 + 重试途径（不再「请检查文件权限」）', async () => {
    const vault = await openDesktop();
    const app = getApp();
    (app.vault as any).trash = vi.fn(async () => { throw new Error('权限不足'); });
    await deleteClipNote({
      id: 'url:https://guokr.com/1',
      origin: 'clip',
      title: '剪藏笔记A',
      url: 'https://guokr.com/1',
      notePath: '归档/网页剪藏/剪藏笔记A.md',
      note: { path: '归档/网页剪藏/剪藏笔记A.md', file: vault.file('归档/网页剪藏/剪藏笔记A.md') },
      st: 'saved',
    } as any);
    expect(vi.mocked(notifyActionError).mock.calls.some(([, action]) => action === '删除剪藏')).toBe(true);
    expect(vi.mocked(notifyActionError).mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('复制失败：文案 = 复制 + 原因（剪贴板不可用不再裸「复制失败」）', async () => {
    await openDesktop();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => { throw new Error('剪贴板被禁用'); }) },
      configurable: true,
    });
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const copyBtn = [...document.querySelectorAll('.bz-item-menu-item')]
      .find((b) => b.textContent!.includes('复制原文链接')) as HTMLElement;
    copyBtn.click();
    await vi.waitFor(() => expect(vi.mocked(notifyActionError).mock.calls[0]?.[1]).toBe('复制'));
  });
});
