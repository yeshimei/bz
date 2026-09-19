/**
 * 书库（bookshelf）深审修复批回归（bz-fix-bs-core）：
 * P1 continueReading 经 showView 单口（报告视图存活不再假死）/ 冷开报告返回书库兜底重画 /
 * weave-data create·delete 通道 / 检索 ESC 二段清词 + 尾 ✕ / md 写盘→modify 自动刷新集成 /
 * weave 读侧损坏一次性告警 / 卸载摘 resize 监听 / 滚位保持 / 回落口径单源 /
 * 借书卡 × 关闭 + aria / EPUB 编辑失败反馈 / bindFormSubmit / 触控热区与 vvh 契约 / 色板对齐。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { M, resetBookshelfState, applyDefaultView } from '../../src/bookshelf/state';
import {
  ensureBookshelf, unloadBookshelf, continueReading,
} from '../../src/bookshelf';
import {
  createOverlay, closeOverlay, renderAll,
} from '../../src/bookshelf/ui';
import { openEditCommentModal, openEpubEditCommentModal, closeBookNoteModals } from '../../src/bookshelf/notes-ui';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { catColor } from '../../src/bookshelf/render';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WEAVE = 'CONFIG/STORAGE/weave-data.json';

function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
  const vault = new MockVault();
  vault.files.set('书库/认知觉醒.md', `---
tags: [book]
author: 周岭
category: 成长
readingDate: 2026-08-01
readingProgress: 60
highlights: 12
thinks: 3
---`);
  vault.files.set('书库/围城.md', `---
tags: [book]
author: 钱钟书
readingDate: 2026-07-01
completionDate: 2026-08-15
readingProgress: 100
---`);
  const app = mockAppWithVault(vault);
  ensureBookshelf(app);
  setApp(app);
  return { vault, app };
}

/** 轮询等待（防抖 + rebuild 链路对负载敏感，裸 sleep 有 flake 面积） */
async function waitFor(fn: () => boolean, timeout = 5000, step = 15): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('waitFor: 断言轮询超时');
    await new Promise((r) => setTimeout(r, step));
  }
}

function overlayEl(): HTMLElement {
  return document.querySelector('.bz-panel-overlay') as HTMLElement;
}

function spines(overlay: HTMLElement): HTMLElement[] {
  return Array.from(overlay.querySelectorAll('.bz-bs-spine'));
}

async function openPanel(app: ReturnType<typeof mockAppWithVault>): Promise<HTMLElement> {
  createOverlay(app);
  // B8 加载占位与空态共用 .bz-bs-wall-empty 类——以 hint「N 册在墙」为准（renderWallInto 无条件写入）
  await waitFor(() => (overlayEl().querySelector('#bz-bs-hint')?.textContent || '').includes('在墙'));
  return overlayEl();
}

describe('书库深审修复批：continueReading（C1 死锁 / E6 新鲜度）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    clearNotices();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadBookshelf();
    document.body.innerHTML = '';
  });

  it('P1 C1：报告视图开着时执行「继续在读」→ 切回书库视图（容器 active）+ 在读分栏，不再假死', async () => {
    const { vault, app } = seedVault();
    await openPanel(app);
    const { openBookshelfReport } = await import('../../src/bookshelf');
    openBookshelfReport(app);
    expect(M.view).toBe('report');
    expect(overlayEl().querySelector('.bz-bs-view-report')?.classList.contains('active')).toBe(true);
    // 报告视图存活时热切（旧实现裸赋 M.view 绕过 paintViewContainers → 面板假死）
    await continueReading(app);
    expect(M.view).toBe('shelf');
    expect(M.side).toBe('reading');
    expect(M.catFilter).toBe('all');
    expect(overlayEl().querySelector('.bz-bs-view-shelf')?.classList.contains('active')).toBe(true);
    expect(overlayEl().querySelector('.bz-bs-view-report')?.classList.contains('active')).toBe(false);
    // 墙在在读分栏只剩认知觉醒（围城已读完）
    expect(spines(overlayEl()).length).toBe(1);
    expect(spines(overlayEl())[0].title).toContain('认知觉醒');
    // 在途报告渲染已作废：不再向隐藏容器续写（cancelReadingReport 收口）
    void vault;
  });

  it('E6：M.items 陈旧假空态——面板关着期间盘上新增在读书，恒 rebuild 不误报「还没有在读」', async () => {
    const { vault, app } = seedVault();
    await openPanel(app);
    closeOverlay();
    // 模拟会话残留：M.items 被清但盘上有在读（旧实现 M.items.length ? : rebuild 只兜空数组——
    // 这里 M.items 非空但全部非在读，盘上新书是在读）
    M.items.length = 0;
    vault.files.set('书库/新书.md', '---\ntags: [book]\nreadingDate: 2026-09-01\n---');
    await continueReading(app);
    expect(getNoticeMessages().some((m) => m.includes('还没有在读的书'))).toBe(false);
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
    expect(M.side).toBe('reading');
    // 冷开 rebuild.then 渲染是异步——等新书上墙
    await waitFor(() => spines(overlayEl()).some((s) => s.title?.includes('新书')));
  });

  it('在读为空 → 只提示不开面板（不 rebuild 出面板空白分栏）', async () => {
    const { app } = seedVault();
    // 围城已读、认知觉醒在读删掉
    (app.vault as MockVault).files.delete('书库/认知觉醒.md');
    await continueReading(app);
    expect(getNoticeMessages().some((m) => m.includes('还没有在读的书'))).toBe(true);
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
  });
});

describe('书库深审修复批：报告返回书库兜底重画（ui F1/F2）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    clearNotices();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadBookshelf();
    document.body.innerHTML = '';
  });

  it('P2 F1：冷开报告视图 → 返回书库 → 墙体真实渲染（不再永挂「正在整理书架…」占位）', async () => {
    const { app } = seedVault();
    const { openBookshelfReport } = await import('../../src/bookshelf');
    openBookshelfReport(app); // 冷开直落报告视图：墙位只铺了加载占位
    const overlay = overlayEl();
    await waitFor(() => !!overlay.querySelector('.bz-rr-content')?.textContent?.length);
    expect(overlay.querySelector('#bz-bs-shelf')?.textContent).toContain('正在整理书架');
    (overlay.querySelector('[data-rr-goto-shelf]') as HTMLElement).click();
    expect(M.view).toBe('shelf');
    // 旧实现只切容器 active 不重画墙（测试盲区：只断类切换不断内容）
    expect(overlay.querySelector('#bz-bs-shelf')?.textContent).not.toContain('正在整理书架');
    expect(spines(overlay).length).toBe(2);
    expect(overlay.querySelector('#bz-bs-hint')?.textContent).toContain('2 册在墙');
  });

  it('F2：报告视图存续期间书库数据变化 → 返回书库显示新墙（非陈旧墙）', async () => {
    const { vault, app } = seedVault();
    const { openBookshelfReport } = await import('../../src/bookshelf');
    await openPanel(app);
    openBookshelfReport(app); // 热切报告（墙仍是 v1）
    await waitFor(() => !!overlayEl().querySelector('.bz-rr-content')?.textContent?.length);
    vault.files.set('书库/新书.md', '---\ntags: [book]\nauthor: 新作者\n---');
    // 真机链路：md 写盘派发 vault:md-modified 域事件 → schedule → rebuild（报告视图只刷报告区）
    const { emitDomainEvent } = await import('../../src/core/domain-bus');
    emitDomainEvent('vault:md-modified', { path: '书库/新书.md' });
    await waitFor(() => M.items.some((i) => i.title === '新书'));
    (overlayEl().querySelector('[data-rr-goto-shelf]') as HTMLElement).click();
    await waitFor(() => spines(overlayEl()).length === 3);
    expect(spines(overlayEl()).some((s) => s.title?.includes('新书'))).toBe(true);
  });
});

describe('书库深审修复批：检索 ESC 二段清词 + 尾 ✕（eff E2 定稿范式）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    clearNotices();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadBookshelf();
    document.body.innerHTML = '';
  });

  it('有词 ESC = 只清词不冒泡（面板不关、墙恢复全量、防抖尾触不作祟）', async () => {
    const { app } = seedVault();
    await openPanel(app);
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.value = '钱钟书';
    input.dispatchEvent(new Event('input'));
    await waitFor(() => spines(overlayEl()).length === 1);
    // ESC（target 阶段被 input 监听消费；escManager 的 document 层收不到）
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(input.value).toBe('');
    expect(M.searchKeyword).toBe('');
    await waitFor(() => spines(overlayEl()).length === 2);
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy(); // 面板未关
    // 尾 ✕ 显隐同步
    const clearBtn = overlayEl().querySelector('[data-bs-search-clear]') as HTMLElement;
    expect(clearBtn.hidden).toBe(true);
  });

  it('无词 ESC 放行 → 关面板语义不变（二段语义）', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // 放行后经 escManager document 层关面板
    await waitFor(() => !document.querySelector('.bz-panel-overlay'));
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
  });

  it('尾 ✕ 一键清除：清词 + 刷墙 + 焦点回框；有词才显示', async () => {
    const { app } = seedVault();
    await openPanel(app);
    const input = document.querySelector('#bz-bs-dsearch') as HTMLInputElement;
    const clearBtn = overlayEl().querySelector('[data-bs-search-clear]') as HTMLElement;
    expect(clearBtn.hidden).toBe(true);
    input.value = '周岭';
    input.dispatchEvent(new Event('input'));
    await waitFor(() => spines(overlayEl()).length === 1);
    expect(clearBtn.hidden).toBe(false);
    clearBtn.click();
    expect(input.value).toBe('');
    expect(M.searchKeyword).toBe('');
    expect(document.activeElement).toBe(input);
    await waitFor(() => spines(overlayEl()).length === 2);
  });
});

describe('书库深审修复批：weave-data 通道与读侧降级（func F4 / arch A3 / TG1）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    clearNotices();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadBookshelf();
    document.body.innerHTML = '';
  });

  it('F4：面板开着时 weave-data.json 首次落盘（create 事件）→ 防抖后 EPUB 上墙', async () => {
    const { vault, app } = seedVault();
    await openPanel(app);
    expect(spines(overlayEl()).length).toBe(2);
    // Weave 首次落盘：json 此前不存在 → create（旧实现只挂 modify，面板不刷新）
    vault.files.set(WEAVE, JSON.stringify({
      books: { a: { meta: { title: '百年孤独' }, file: { vaultPath: 'books/x.epub' }, reading: { position: { percent: 0.5 } } } },
    }));
    vault.emit('create', vault.file(WEAVE));
    await waitFor(() => spines(overlayEl()).length === 3);
    expect(spines(overlayEl()).some((s) => s.title?.includes('百年孤独'))).toBe(true);
  });

  it('TG1 集成：md 写盘（vault.process 落盘进度）→ vault modify → 300ms 防抖自动刷新墙', async () => {
    const { vault, app } = seedVault();
    await openPanel(app);
    expect(spines(overlayEl()).length).toBe(2);
    // 写链：vault.process 原子读改写改 frontmatter 进度（真机此写必触发 vault modify → 域事件）
    const file = vault.file('书库/认知觉醒.md');
    await vault.process(file, (c: string) => c.replace('readingProgress: 60', 'readingProgress: 80'));
    // 模拟 Obsidian 对落盘派发 modify（MockVault 写方法不自动派发；域事件在 index.ts 订阅）
    const { emitDomainEvent } = await import('../../src/core/domain-bus');
    emitDomainEvent('vault:md-modified', { path: '书库/认知觉醒.md' });
    // 自动刷新链路真通：防抖 300ms → rebuild → renderAll → 书脊 title 进度更新
    await waitFor(() => spines(overlayEl()).find((s) => s.title?.includes('认知觉醒'))?.title.includes('80%') === true);
    expect(spines(overlayEl()).length).toBe(2);
  });

  it('A3：weave-data.json 损坏 → EPUB 区降级空 + 一次性 warning 告警（恢复正常后复位）', async () => {
    const { vault, app } = seedVault();
    vault.files.set(WEAVE, '{ 这不是合法 JSON');
    await openPanel(app);
    // md 书照常、EPUB 静默降级为空；读侧损坏有一次性告警（写侧零侵入契约不变）
    expect(spines(overlayEl()).length).toBe(2);
    expect(getNoticeMessages().some((m) => m.includes('weave 阅读数据文件损坏'))).toBe(true);
    expect(document.querySelector('.bz-notice--warning')).toBeTruthy();
    clearNotices();
    // 同一次损坏存续期内 rebuild 不重复弹（一次性）
    await (await import('../../src/bookshelf/data')).rebuildItems(app);
    renderAll();
    expect(getNoticeMessages().some((m) => m.includes('weave 阅读数据文件损坏'))).toBe(false);
    // 恢复正常后再损坏可再次告警
    vault.files.set(WEAVE, JSON.stringify({ books: { a: { meta: { title: '百年孤独' }, file: { vaultPath: 'books/x.epub' } } } }));
    await (await import('../../src/bookshelf/data')).rebuildItems(app);
    vault.files.set(WEAVE, 'again broken');
    await (await import('../../src/bookshelf/data')).rebuildItems(app);
    renderAll();
    expect(getNoticeMessages().some((m) => m.includes('weave 阅读数据文件损坏'))).toBe(true);
  });
});

describe('书库深审修复批：生命周期与回落口径（func F2 / eff E5 / eff E4）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    clearNotices();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadBookshelf();
    setSettingsProvider(() => ({} as never));
    document.body.innerHTML = '';
  });

  it('F2：unloadBookshelf 经 closeOverlay 摘除 window resize 监听', async () => {
    const { app } = seedVault();
    await openPanel(app);
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    unloadBookshelf();
    expect(removeSpy.mock.calls.some(([type]) => type === 'resize')).toBe(true);
    removeSpy.mockRestore();
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
  });

  it('E5：applyDefaultView 单源回落——分类筛选一并复位 all（设置口径扩到筛选层）', () => {
    M.catFilter = '文学';
    M.searchKeyword = '残词';
    applyDefaultView();
    expect(M.catFilter).toBe('all');
    // 会话残留只留 searchKeyword（重开有回写兜底）
    expect(M.searchKeyword).toBe('残词');
  });

  it('E4：滚位保持——同签名重渲写回实时滚位；签名变化（筛选）不写回', async () => {
    const { app } = seedVault();
    await openPanel(app);
    const room = overlayEl().querySelector('.bz-bs-room') as HTMLElement;
    room.scrollTop = 321;
    // 自动刷新路径：数据重算但列表形状未变 → 滚位保持（渲染后写回实时值）
    renderAll();
    expect(room.scrollTop).toBe(321);
    // 筛选变化：签名变 → 不人为写回（jsdom 无布局不做塌陷 clamp，以 set spy 验证）
    M.side = 'done';
    const setSpy = vi.spyOn(room, 'scrollTop', 'set');
    renderAll();
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });
});

describe('书库深审修复批：借书卡与编辑弹窗（ui F5/F8 / eff E3）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetBookshelfState();
    clearNotices();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadBookshelf();
    closeBookNoteModals();
    document.body.innerHTML = '';
  });

  it('F8：借书卡有「× 关闭」钮（点击关弹窗）+ dialog 有可读名（aria-label）', async () => {
    const { app } = seedVault();
    await openPanel(app);
    spines(overlayEl())[0].click();
    const popup = document.querySelector('.bz-bs-d-popup') as HTMLElement;
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.getAttribute('aria-label') || '').toContain('书籍详情');
    const closeBtn = popup.querySelector('[data-bs-d-close]') as HTMLElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    expect(document.querySelector('.bz-bs-d-popup')).toBeNull();
  });

  it('F5：EPUB 编辑想法保存失败（书已不在 weave 数据）→ 明确 error toast、弹窗保留', async () => {
    const { app } = seedVault();
    const note = {
      highlight: { id: 'h1' }, text: '原文', comment: '', chapterIndex: 0,
      chapterTitle: '第一章', cfiRange: '', createdTime: 0, hasComment: false,
    };
    openEpubEditCommentModal(app, 'books/missing.epub', 'h1', note as any);
    const popup = document.querySelector('.bz-bs-edit-pop') as HTMLElement;
    const saveBtn = popup.querySelector('.bz-btn--primary') as HTMLElement;
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(getNoticeMessages().some((m) => m.includes('保存想法失败'))).toBe(true);
    expect(document.querySelector('.bz-notice--error')).toBeTruthy();
    expect(document.querySelector('.bz-bs-edit-pop')).not.toBeNull(); // 弹窗保留
    closeBookNoteModals();
  });

  it('E3：编辑批注弹窗 Ctrl+Enter 提交——保存成功关弹窗（bindFormSubmit 单源）', async () => {
    const { vault, app } = seedVault();
    vault.files.set('书库/读书笔记.md', '# 章\n<span data-id="h1" data-comment="旧" data-date="2025-06-01" class="__comment cm-highlight">原文一</span>');
    openEditCommentModal(app, '书库/读书笔记.md', 'h1', '原文一', '旧');
    const popup = document.querySelector('.bz-bs-edit-pop') as HTMLElement;
    const textarea = popup.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = '键盘流新批注';
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    expect(vault.files.get('书库/读书笔记.md')).toContain('data-comment="键盘流新批注"');
    expect(document.querySelector('.bz-bs-edit-pop')).toBeNull();
  });
});

describe('书库深审修复批：契约断言（func F5/F6 / cons C6 / ui F3/F6 / A1）', () => {
  it('F5：md progress 负值钳 0（与 EPUB 侧钳制对齐）', async () => {
    resetObsidianMocks();
    resetBookshelfState();
    const { parseBookFile } = await import('../../src/bookshelf/data');
    const vault = new MockVault();
    vault.files.set('书库/负进度.md', '---\ntags: [book]\nreadingProgress: -5\n---');
    const app = mockAppWithVault(vault);
    const item = parseBookFile(vault.file('书库/负进度.md'), app, '书库', 'book');
    expect(item?.progress).toBe(0);
  });

  it('C6：分类色板对齐终稿 20 类——终稿类有专属色；超纲名回落散列兜底', async () => {
    const finals = ['推理', '科幻', '奇幻', '恐怖', '武侠', '戏剧', '历史小说', '历史', '哲学', '心理学',
      '科学', '社科', '艺术', '摄影', '中国古典文学', '中国现当代文学', '中国散文', '外国小说', '外国散文', '纪实'];
    for (const cat of finals) {
      expect(catColor(cat), `${cat} 应有专属色`).not.toBe(catColor('__fallback_probe__'));
      expect(catColor(cat).bg).toMatch(/^#/);
    }
    // 超纲三项（旧板遗留）已移出：走散列兜底仍保底有色
    for (const legacy of ['龙与地下城', '天文学', '生物学']) {
      expect(catColor(legacy).bg).toMatch(/^#/);
    }
    expect(catColor('未分类').bg).toMatch(/^#/);
  });

  it('ui F3/F6：移动端几何契约——vvh 接管面板与借书卡限高；排序钮挂热区类；书脊带命中层', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/bookshelf/styles.css'), 'utf8');
    // --bz-vvh（clipbook C-UI6 同款）：面板高度与借书卡限高都消费
    expect(css).toMatch(/\.bz-bs-panel\s*\{[^}]*height: var\(--bz-vvh, 100vh\)/);
    expect(css).toMatch(/\.bz-bs-d-popup\.bz-overlay-popup\s*\{[^}]*max-height: calc\(var\(--bz-vvh, 100vh\) - 48px\)/);
    // 书脊触屏命中层（bz-touch-target--xl 载体）
    expect(css).toMatch(/\.bz-bs-spine \.bz-bs-touch\s*\{\s*position: absolute; inset: 0;/);
    const wall = readFileSync(resolve(process.cwd(), 'src/bookshelf/layouts/wall/render.ts'), 'utf8');
    // 排序钮挂 core 热区类（§8.2 32px 档外扩）
    expect(wall).toContain('class="bz-touch-target${sortMode === k ? \' on\' : \'\'}"');
    // 书脊 markup 带命中层 span
    expect(wall).toContain('bz-bs-touch bz-touch-target--xl');
  });

  it('A1：data.ts 不再逆向依赖渲染纯层（store→ui 逆向边移除）', async () => {
    const src = readFileSync(resolve(process.cwd(), 'src/bookshelf/data.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\/render'/);
    expect(src).not.toContain('getDisplayItems');
  });
});
