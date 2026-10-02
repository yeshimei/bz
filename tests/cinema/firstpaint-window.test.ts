/**
 * 影院首屏提速（ADR-0231 / issue 539）守卫。
 *
 * 守的是四条**看不见的**不变量——它们坏了页面不报错，只是「又变慢了」或「库空了」：
 *  1) 打开面板只渲 `FIRST_PAINT_CARDS` 张（不是全量）；
 *  2) 其余由空闲追加按 `LIST_BATCH_SIZE` 逐批补上，最终能铺满全量（窗口不能烂尾）；
 *  3) 筛选/搜索/排序一变，窗口收回首屏值（不然「刚滚出来的几百张」会被当场收走或永不回收）；
 *  4) 冷启动（目录有 .md、metadataCache 未就绪）出**骨架页**而不是「影片空空如也」，
 *     就绪后重扫出卡；真空库才落空态页。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, Platform } from '../mock-obsidian-entry';
import { M, resetCinemaState, FIRST_PAINT_CARDS } from '../../src/cinema/state';
import { resetMetaReady } from '../../src/cinema/data';
import { createOverlay, closeOverlay, renderAll } from '../../src/cinema/ui';
import { ensureCinema, unloadCinema } from '../../src/cinema';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { clearDomainEvents } from '../../src/core/domain-bus';
import { LIST_BATCH_SIZE } from '../../src/core/paging';

/** 造 n 条互不相同的影视笔记（无季集字段 → 一文件一卡，不被合并卡吃掉） */
function seedMany(n: number): MockVault {
  const vault = new MockVault();
  for (let i = 0; i < n; i++) {
    const day = String((i % 28) + 1).padStart(2, '0');
    vault.files.set(
      `我的/影视/《片${String(i).padStart(3, '0')}》.md`,
      `---\ntags: [电影]\n评分: ${(i % 9) + 1}\n观影日期: 2026-01-${day}\n---\n`
    );
  }
  return vault;
}

function gridCards(): number {
  return document.querySelectorAll('.grid .pcard, .m-grid .pcard').length;
}

function mount(vault: MockVault) {
  const app = mockAppWithVault(vault);
  ensureCinema(app);
  return app;
}

beforeEach(() => {
  resetObsidianMocks();
  resetCinemaState();
  resetMetaReady(); // 模块级「已就绪」标记跨用例残留会让冷启动例假绿
  clearDomainEvents();
  M.folderPath = '我的/影视';
  setSettingsProvider(() => ({ cinemaMergeSeasons: false }) as any);
  document.body.innerHTML = '';
});

afterEach(() => {
  Platform.isMobile = false;
  unloadCinema();
  closeOverlay();
  document.body.innerHTML = '';
  setSettingsProvider(() => ({}) as any);
});

describe('影院首屏窗口（ADR-0231）', () => {
  it(`首屏只渲 ${FIRST_PAINT_CARDS} 张，不是全量（25 条 → 先出 20）`, () => {
    const app = mount(seedMany(25));
    createOverlay(app);
    expect(M.items.length).toBe(25); // 数据是全体
    expect(gridCards()).toBe(FIRST_PAINT_CARDS); // 上屏只是窗口
  });

  it(`空闲追加补齐：等一拍后铺满全量（25 条 → 最终 25 张）`, async () => {
    const app = mount(seedMany(25));
    createOverlay(app);
    expect(gridCards()).toBe(FIRST_PAINT_CARDS);
    await vi.waitFor(() => expect(gridCards()).toBe(25));
    expect(M.shown).toBe(25);
  });

  it(`批粒度 = LIST_BATCH_SIZE：60 条一次补满（20 → 70 封顶 60）`, async () => {
    const app = mount(seedMany(60));
    createOverlay(app);
    expect(gridCards()).toBe(FIRST_PAINT_CARDS);
    await vi.waitFor(() => expect(gridCards()).toBe(60));
    expect(FIRST_PAINT_CARDS + LIST_BATCH_SIZE).toBeGreaterThanOrEqual(60); // 一批装得下
  });

  it('排序一变窗口收回首屏（不是把已铺开的几百张留着）', async () => {
    const app = mount(seedMany(60));
    createOverlay(app);
    await vi.waitFor(() => expect(gridCards()).toBe(60));
    M.sortMode = 'rating'; // 视图身份变化
    renderAll(app);
    expect(gridCards()).toBe(FIRST_PAINT_CARDS);
  });

  it('搜索一变窗口同样收回首屏', async () => {
    const app = mount(seedMany(60));
    createOverlay(app);
    await vi.waitFor(() => expect(gridCards()).toBe(60));
    M.searchKeyword = '片0'; // 命中若干，非全量
    renderAll(app);
    expect(gridCards()).toBeLessThanOrEqual(FIRST_PAINT_CARDS);
    expect(M.shown).toBe(FIRST_PAINT_CARDS);
  });

  it('移动端同口径（m-grid 也只首屏 20 张）', () => {
    Platform.isMobile = true;
    const app = mount(seedMany(25));
    createOverlay(app);
    expect(document.querySelectorAll('.m-grid .pcard').length).toBe(FIRST_PAINT_CARDS);
  });

  it('计数仍按全量（窗口只决定渲多少，不改变数多少）', () => {
    const app = mount(seedMany(25));
    createOverlay(app);
    const cnt = document.querySelector('.j-mcnt')?.textContent ?? '';
    // desk 侧栏「全部」计数 = 全量 25，与上屏 20 张无关
    const allRow = document.querySelector('.rail-item[data-g="全部"] .n')?.textContent;
    expect(allRow).toBe('25');
    // mob 标题计数（若为 mob 壳）；desk 壳无 .j-mcnt，断言容错
    if (cnt) expect(cnt).toContain('25');
  });

  it('空库落空态页（不是骨架页）：库真的空 ≠ 还没读完', () => {
    const app = mount(new MockVault());
    createOverlay(app);
    expect(document.querySelector('.cn-empty-page')).toBeTruthy();
    expect(document.querySelector('.cn-skel-grid')).toBeNull();
  });

  it('冷启动出骨架页 → metadataCache 就绪后重扫出卡', async () => {
    const vault = seedMany(6);
    const app = mockAppWithVault(vault);
    const spy = vi.spyOn(app.metadataCache as any, 'getFileCache').mockReturnValue(null); // 未就绪
    ensureCinema(app);
    createOverlay(app);
    // 目录有 .md 却解析不出 → 骨架，不是「影片空空如也」
    expect(document.querySelector('.cn-skel-grid')).toBeTruthy();
    expect(document.querySelector('.cn-empty-page')).toBeNull();
    // 就绪：恢复缓存 + 发 resolved（一次性订阅）
    spy.mockRestore();
    (app.metadataCache as any).emit('resolved');
    await vi.waitFor(() => expect(gridCards()).toBe(6));
    expect(document.querySelector('.cn-skel-grid')).toBeNull();
  });
});
