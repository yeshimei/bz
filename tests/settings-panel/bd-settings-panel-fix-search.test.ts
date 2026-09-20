/**
 * 设置面板搜索键盘闭环 + 命中词高亮 + 会话滚位/缓存回归（SP2/SP3/SP4/SP5，
 * 呈报#17/#26/#49；全域深审拍板后修复批 Wave1）：
 * - SP3：搜索框 ESC 二段语义——有词清词（面板不关、焦点回框），无词放行关面板；
 * - SP4：搜索框 Enter 直接跳第一个命中（域段优先，与点击同动线）；
 * - SP2：命中行词级 mark 高亮（行名/描述段），清词还原；
 * - SP5：切域/重进域记住滚位（会话内），schema loader 会话缓存不再重跑读盘。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { SettingsPanelUI } from '../../src/settings-panel/ui';
import { escManager } from '../../src/core/esc-manager';

const flush = () => new Promise((r) => setTimeout(r, 5));
const flushSearch = () => new Promise((r) => setTimeout(r, 260)); // E-5：180ms 防抖 + 余量

/** 等预载填充行缓存（导航项全部出现；并发跑下动态 import 变慢，给足窗口） */
async function waitPreload(popup: HTMLElement): Promise<void> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && popup.querySelectorAll('.bz-sp-nav-item').length < 15) {
    await new Promise((r) => setTimeout(r, 30));
  }
}

/** 等 pane 页头出现且域内容渲染完成（页头在 loader await 前就位，须再等行/组就绪） */
async function waitPageHead(popup: HTMLElement, name?: string): Promise<HTMLElement | null> {
  const deadline = Date.now() + 5000;
  for (;;) {
    const head = popup.querySelector('.bz-sp-page-head') as HTMLElement | null;
    const ready = head
      && (!name || head.textContent?.includes(name))
      && popup.querySelectorAll('.bz-sp-group, .bz-empty').length > 0;
    if (head && ready) return head;
    if (Date.now() > deadline) return head;
    await new Promise((r) => setTimeout(r, 30));
  }
}

/** 点击导航域项并等待该域渲染完成（并发跑下动态 import 变慢，固定 sleep 不可靠） */
async function clickDomain(popup: HTMLElement, id: string, name: string): Promise<void> {
  const item = popup.querySelector<HTMLElement>(`.bz-sp-nav-item[data-sp-domain="${id}"]`);
  item!.click();
  await waitPageHead(popup, name);
}

describe('设置面板搜索闭环与滚位回归（SP2/SP3/SP4/SP5）', () => {
  let state: Record<string, unknown>;
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    (escManager as any).handlers = new Map();
    state = {};
    setSettingsProvider(() => state as any);
    vault = new MockVault();
    setApp({ vault, workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  });

  it('SP3：搜索框有词按 ESC = 清词不关面板（焦点回框）；无词按 ESC = 放行关面板', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await waitPreload(popup);
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    search.focus();

    search.value = '番茄';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushSearch();
    // 修复前必红：有词 ESC 直关整个面板，重开还得重输
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await flush();
    expect(search.value).toBe('');
    expect(popup.style.display).not.toBe('none');
    expect(document.activeElement).toBe(search);
    // 导航恢复全集（清词即复显）
    expect(popup.querySelectorAll('.bz-sp-nav-item').length).toBeGreaterThanOrEqual(15);

    // 无词：ESC 放行（escManager 收到 → hide）
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await flush();
    expect(popup.style.display).toBe('none');
    ui.cleanup();
  });

  it('SP4：搜索框按 Enter 直接跳第一个命中域（与点击同动线）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await waitPreload(popup);
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    search.value = '番茄';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushSearch();
    // 修复前必红：Enter 空转，仍需鼠标点选
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await flush();
    const head = await waitPageHead(popup, '番茄钟');
    expect(head?.textContent).toContain('番茄钟');
    expect(search.value).toBe('番茄'); // 词保留（跳转 ≠ 清词，清词是 ESC 的职责）
    ui.cleanup();
  });

  it('SP2：命中行行名/描述内命中词包 mark.bz-sp-mark，清词还原原文', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await waitPreload(popup);
    // 默认域 = 通用：「数据存储路径」组行名含「存储」（等行真正渲染完再搜）
    await waitPageHead(popup, '通用');
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    search.value = '存储';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushSearch();

    const hitRows = [...popup.querySelectorAll<HTMLElement>('.bz-sp-set-row.hit')];
    expect(hitRows.length).toBeGreaterThanOrEqual(1);
    const marked = hitRows.flatMap((r) => [...r.querySelectorAll('mark.bz-sp-mark')]);
    expect(marked.length, '修复前必红：只有整行色条，无词级 mark').toBeGreaterThanOrEqual(1);
    expect(marked.some((m) => m.textContent === '存储')).toBe(true);

    // 清词还原：mark 全部消失、文本还原为原文
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushSearch();
    expect(popup.querySelectorAll('mark.bz-sp-mark').length).toBe(0);
    const names = [...popup.querySelectorAll<HTMLElement>('.bz-sp-set-name')].map((el) => el.textContent ?? '');
    expect(names.some((t) => t.includes('数据存储路径'))).toBe(true);
    ui.cleanup();
  });

  it('SP5：切域再回到原域，滚位恢复到离开时的位置（会话内记忆）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await waitPreload(popup);
    const pane = popup.querySelector('.bz-sp-pane') as HTMLElement;
    const scroller = pane.parentElement as HTMLElement; // 桌面滚动元素 = .bz-sp-desk-main
    await waitPageHead(popup, '通用');

    // 在通用域滚下去，再切去番茄钟再切回
    scroller.scrollTop = 88;
    await clickDomain(popup, 'pomodoro', '番茄钟');
    expect(scroller.scrollTop).toBe(0); // 新域从顶部开始
    await clickDomain(popup, 'global', '通用');
    expect(scroller.scrollTop, '修复前必红：重进域回顶').toBe(88);
    // 切到没去过的域不回填旧值
    await clickDomain(popup, 'memo', '备忘录');
    expect(scroller.scrollTop).toBe(0);
    ui.cleanup();
    // cleanup 清会话滚位
    expect((ui as any).scrollMem.size).toBe(0);
  });

  it('SP5：schema loader 会话缓存——进域/重进域/软重开均不重跑读盘（preload 后全走缓存）', async () => {
    const readSpy = vi.spyOn(vault.adapter, 'read');
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // preload 全量跑一轮 loader（含剪藏本 readDataSourceState 读盘）并落 schemaCache
    await waitPreload(popup);
    readSpy.mockClear();

    // 修复前必红：进域 renderDomain 每次 await schemaLoader() 重跑读盘；修复后 preload 已
    // 缓存 schema，进域零读盘
    await clickDomain(popup, 'clipping', '剪藏本');
    expect(readSpy.mock.calls.length).toBe(0);
    // 切走再切回：仍零读盘
    await clickDomain(popup, 'global', '通用');
    readSpy.mockClear();
    await clickDomain(popup, 'clipping', '剪藏本');
    expect(readSpy.mock.calls.length).toBe(0);
    // 软重开（open 复用面板）：preload 重算徽标但不重跑 loader（重开不重载）
    readSpy.mockClear();
    ui.open();
    await new Promise((r) => setTimeout(r, 60));
    expect(readSpy.mock.calls.length).toBe(0);
    ui.cleanup();
  });
});
