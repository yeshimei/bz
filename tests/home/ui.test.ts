/**
 * 内容首页（home 域）UI 测试：面板开合、卡片渲染/编辑移除/加域 pick、
 * 迷你 chips、搜索面板过滤与执行、统计徽标、ESC/遮罩关闭。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { resetHomeState, H } from '../../src/home/state';
import { loadHomeData, saveHomeData, DEFAULT_PINNED } from '../../src/home/data';
import { openHome, unloadHome } from '../../src/home/index';
import { DOMAINS } from '../../src/home/domains';

/** 带 listCommands/executeCommandById 的 app（mockAppWithVault 的 commands 只存注册） */
function homeApp(vault: MockVault, commandIds: string[] = ['bz-diary-open', 'bz-cinema-open', 'bz-memo-open', 'bz-review-open']) {
  const base = mockAppWithVault(vault);
  const names: Record<string, string> = {
    'bz-diary-open': '日记本',
    'bz-cinema-open': '影院',
    'bz-memo-open': '备忘录',
    'bz-review-open': '复习计划',
  };
  const executed: string[] = [];
  (base as any).commands.listCommands = () =>
    (commandIds || []).map((id) => ({ id, name: names[id] ?? '命令' + id }));
  (base as any).commands.executeCommandById = async (id: string) => {
    executed.push(id);
  };
  (base as any).__executed = executed;
  return base as any;
}

const executedOf = (app: any): string[] => app.__executed;

function seedHome(vault: MockVault, pinned = DEFAULT_PINNED) {
  vault.files.set('CONFIG/STORAGE/home.json', JSON.stringify({ version: 1, pinned }));
}

describe('home UI', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }));
    resetObsidianMocks();
    resetHomeState();
    document.body.innerHTML = '';
    clearNotices();
  });

  afterEach(() => {
    unloadHome();
    document.body.innerHTML = '';
  });

  it('openHome：渲染桌面骨架（hero/卡片区/侧栏/迷你）', async () => {
    seedHome(vault);
    const app = homeApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0)); // ensurePinned 微任务
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('[data-home-hello]')!.textContent).toContain('包仔');
    const cards = overlay.querySelectorAll('[data-home-card]');
    expect(cards.length).toBe(DEFAULT_PINNED.length);
    // 编辑钮 / 加域卡默认隐藏 / 迷你 chips = 其余域
    expect(overlay.querySelector('[data-home-addcard]')!.hasAttribute('hidden')).toBe(true);
    const minis = overlay.querySelectorAll('[data-home-mini]');
    expect(minis.length).toBe(DOMAINS.length - DEFAULT_PINNED.length);
  });

  it('openHome toggle：再开关闭；无数据懒建默认钉选', async () => {
    const app = homeApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.bz-home-overlay')).toBeTruthy();
    expect(H.pinned).toEqual(DEFAULT_PINNED);
    openHome(app);
    expect(document.querySelector('.bz-home-overlay')).toBeFalsy();
  });

  it('编辑态：加域卡出现、点卡移除、移除后迷你 chips 补齐', async () => {
    seedHome(vault);
    const app = homeApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    // 进编辑态
    (overlay.querySelector('[data-home-edit]') as HTMLElement).click();
    expect(H.editing).toBe(true);
    const addBtn = overlay.querySelector('[data-home-addcard]') as HTMLElement;
    expect(addBtn.hasAttribute('hidden')).toBe(false);
    // 移除第一张卡
    const firstCard = overlay.querySelector('[data-home-card]') as HTMLElement;
    const firstId = firstCard.dataset.homeCard!;
    firstCard.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(H.pinned.includes(firstId)).toBe(false);
    expect(overlay.querySelectorAll('[data-home-card]').length).toBe(DEFAULT_PINNED.length - 1);
    // 落盘
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/home.json')!);
    expect(saved.pinned.includes(firstId)).toBe(false);
    // 迷你 chips 补齐被移除域
    const miniIds = [...overlay.querySelectorAll('[data-home-mini]')].map((m) => (m as HTMLElement).dataset.homeMini);
    expect(miniIds.includes(firstId)).toBe(true);
  });

  it('编辑态：加域 pick 钉选（进编辑 → 点加域卡 → 选未钉域）', async () => {
    seedHome(vault);
    const app = homeApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    (overlay.querySelector('[data-home-edit]') as HTMLElement).click();
    (overlay.querySelector('[data-home-addcard]') as HTMLElement).click();
    const pick = overlay.querySelector('.bz-home-pick') as HTMLElement;
    expect(pick).toBeTruthy();
    const availId = pick.querySelector('[data-home-pickopt]')!.getAttribute('data-home-pickopt')!;
    expect(H.pinned.includes(availId)).toBe(false);
    (pick.querySelector('[data-home-pickopt]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(H.pinned.includes(availId)).toBe(true);
    expect(H.editing).toBe(false); // 钉选后退出编辑
    expect(overlay.querySelectorAll('[data-home-card]').length).toBe(DEFAULT_PINNED.length + 1);
    // pick 已收起
    expect(overlay.querySelector('.bz-home-pick')).toBeFalsy();
  });

  it('普通态点卡：关闭首页并执行对应命令', async () => {
    seedHome(vault, ['diary']);
    const app = homeApp(vault, ['bz-diary-open', 'bz-memo-open']);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    (overlay.querySelector('[data-home-card]') as HTMLElement).click();
    expect(document.querySelector('.bz-home-overlay')).toBeFalsy(); // 已关
    expect(executedOf(app)).toEqual(['bz-diary-open']);
  });

  it('普通态点迷你 chip：执行对应命令', async () => {
    seedHome(vault);
    const app = homeApp(vault, ['bz-diary-open', 'bz-memo-open']);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    const mini = [...overlay.querySelectorAll('[data-home-mini]')].find((m) => (m as HTMLElement).dataset.homeMini === 'clipping') as HTMLElement;
    expect(mini).toBeTruthy();
    mini.click();
    expect(executedOf(app)).toEqual(['bz-clipping-open']);
  });

  it('搜索：过滤命令/域、键盘选中、回车执行', async () => {
    seedHome(vault);
    const app = homeApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    const q = overlay.querySelector('[data-home-q]') as HTMLInputElement;
    const pal = overlay.querySelector('[data-home-pal]') as HTMLElement;
    q.value = '备忘录';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    expect(pal.hidden).toBe(false);
    // 备忘录域 + bz-memo-open 命令（行文本均为「备忘录」：域行 + 命令行）
    const rows = overlay.querySelectorAll('[data-home-pal-i]');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const names = [...rows].map((r) => (r as HTMLElement).textContent);
    expect(names.filter((n) => n!.includes('备忘录')).length).toBe(2);
    // 回车执行第一条（域：备忘录）
    q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(executedOf(app)).toEqual(['bz-memo-open']);
  });

  it('搜索无匹配：空态', async () => {
    seedHome(vault);
    const app = homeApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    const q = overlay.querySelector('[data-home-q]') as HTMLInputElement;
    q.value = 'zzz_no_such';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    const pal = overlay.querySelector('[data-home-pal]') as HTMLElement;
    expect(pal.hidden).toBe(false);
    expect(pal.textContent).toContain('没有匹配');
  });

  it('点遮罩 / ESC 关闭面板', async () => {
    seedHome(vault);
    const app = homeApp(vault);
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.querySelector('.bz-home-overlay') as HTMLElement;
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: false }));
    expect(document.querySelector('.bz-home-overlay')).toBeFalsy();
    // ESC
    openHome(app);
    await new Promise((r) => setTimeout(r, 0));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-home-overlay')).toBeFalsy();
  });

  it('unloadHome：清 DOM + 复位状态', async () => {
    seedHome(vault);
    openHome(homeApp(vault));
    await new Promise((r) => setTimeout(r, 0));
    unloadHome();
    expect(document.querySelector('.bz-home-overlay')).toBeFalsy();
    expect(H.currentOverlay).toBeNull();
    expect(H.pinned).toEqual([]);
    expect(H.editing).toBe(false);
  });
});
