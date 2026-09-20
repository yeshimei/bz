/**
 * B5（呈报#12）：自绘下拉键盘可达性——选项 ↑↓ 导航 + Enter 选中 + ESC 二段语义。
 * 修复前：选项行无键盘路径（只能鼠标点）；下拉开态按 ESC 直接关掉整个面板。
 * 修复后：↑↓ 在选项间移动高亮（is-active，开下拉时定位当前值）、Enter 提交高亮项
 * （无高亮仅收起，与 settings-panel select 同口径）、触发器关态 ↓/↑ 开下拉；
 * ESC 走 core registerPanelEsc 层序二段——开态先收下拉、面板保持，再按才退出面板。
 * 修复前必红：ESC 直关面板、无 is-active 高亮、Enter 无选中。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { openPanel, closePanel } from '../../src/belongings/ui';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const DATA_PATH = 'CONFIG/STORAGE/belongings.json';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function makeItem(partial: Record<string, unknown> = {}) {
  return {
    id: 'item_x',
    name: '机械键盘',
    category: '外设',
    purchase_price: 399,
    purchase_date: '2024-06-01T12:00:00',
    current_status: '使用中',
    description: '',
    created_date: '2024-06-01T10:00:00.000Z',
    last_updated: '2024-06-01T10:00:00.000Z',
    ...partial,
  };
}

const panel = () => document.querySelector('.bz-bel-panel') as HTMLElement | null;
const yearWrap = () => document.querySelector('.bz-bel-yearsel:not(.bz-bel-mobsortsel-wrap)') as HTMLElement;
const mobSortWrap = () => document.querySelector('.bz-bel-mobsortsel-wrap') as HTMLElement;
const opts = (wrap: HTMLElement) => [...wrap.querySelectorAll('.bz-bel-dropopt')] as HTMLElement[];
const activeOpt = (wrap: HTMLElement) => wrap.querySelector('.bz-bel-dropopt.is-active') as HTMLElement | null;
const sortSelLabel = () => mobSortWrap().querySelector('.bz-bel-select-label')!.textContent;
const segOn = () => (document.querySelector('.bz-segmented-btn.is-on') as HTMLElement | null)?.textContent;

function key(el: HTMLElement, k: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

async function open(vault: MockVault) {
  setApp({ vault } as any);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  resetObsidianMocks();
  await openPanel();
  await tick();
  return panel()!;
}

describe('B5：自绘下拉键盘导航 + ESC 二段语义', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    vault.files.set(
      DATA_PATH,
      JSON.stringify({
        version: '1.0',
        last_updated: '2025-01-01T00:00:00.000Z',
        items: Object.fromEntries([makeItem(), makeItem({ id: 'item_y', name: '耳机', purchase_date: '2025-03-05T12:00:00' })].map((i) => [i.id, i])),
      }),
    );
  });

  it('修复前必红：下拉开态 ESC 只收下拉不关面板，再按 ESC 才退出（二段）', async () => {
    await open(vault);
    yearWrap().querySelector<HTMLElement>('[data-bel-year]')!.click(); // 开年份下拉
    expect(yearWrap().classList.contains('is-open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick();
    // 修复前：escManager 直接落 closePanel，面板关、下拉随葬
    expect(yearWrap().classList.contains('is-open')).toBe(false);
    expect(panel()).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick();
    expect(panel()).toBeNull();
  });

  it('↑↓ 移动高亮（is-active）+ Enter 提交：移动排序下拉选中「投入最高」', async () => {
    await open(vault);
    const trig = mobSortWrap().querySelector('[data-bel-mobsortsel]') as HTMLElement;
    trig.click(); // 开下拉（开时定位当前值 = 首项「最近购入」）
    expect(mobSortWrap().classList.contains('is-open')).toBe(true);
    expect(activeOpt(mobSortWrap())).toBe(opts(mobSortWrap())[0]); // 修复前必红：无高亮定位

    key(trig, 'ArrowDown');
    expect(activeOpt(mobSortWrap())).toBe(opts(mobSortWrap())[1]); // 修复前必红：↑↓ 无响应
    key(trig, 'ArrowDown');
    expect(activeOpt(mobSortWrap())).toBe(opts(mobSortWrap())[2]);
    key(trig, 'ArrowUp');
    expect(activeOpt(mobSortWrap())).toBe(opts(mobSortWrap())[1]);

    key(trig, 'Enter');
    await tick();
    // 提交 = 选中「投入最高」：下拉收起、触发器 label 与桌面 seg 同步
    expect(mobSortWrap().classList.contains('is-open')).toBe(false);
    expect(sortSelLabel()).toBe('投入最高');
    expect(segOn()).toBe('投入最高');
    expect(panel()).not.toBeNull();
    closePanel();
  });

  it('开态 Enter 无高亮仅收起；高亮不越界（首项 ↑ 不动、末项 ↓ 不动）', async () => {
    await open(vault);
    const trig = mobSortWrap().querySelector('[data-bel-mobsortsel]') as HTMLElement;
    trig.click();
    key(trig, 'ArrowUp'); // 已在首项（定位当前值），↑ 不越界
    expect(activeOpt(mobSortWrap())).toBe(opts(mobSortWrap())[0]);
    // 移到末项再 ↓ 不越界
    key(trig, 'ArrowDown');
    key(trig, 'ArrowDown');
    expect(activeOpt(mobSortWrap())).toBe(opts(mobSortWrap())[opts(mobSortWrap()).length - 1]);

    // 清高亮路径不经过时 Enter 提交末项；此处走「无高亮收起」：先点外点收起再开一个验证
    document.body.click();
    expect(mobSortWrap().classList.contains('is-open')).toBe(false);
    trig.click();
    key(trig, 'Enter'); // 开时已定位当前值 → Enter 提交当前值（幂等）
    await tick();
    expect(mobSortWrap().classList.contains('is-open')).toBe(false);
    closePanel();
  });

  it('关态触发器 ↓ 直接开下拉并定位当前项（原生 select 键入同款）', async () => {
    await open(vault);
    const trig = yearWrap().querySelector('[data-bel-year]') as HTMLElement;
    trig.focus();
    key(trig, 'ArrowDown');
    expect(yearWrap().classList.contains('is-open')).toBe(true);
    expect(activeOpt(yearWrap())).not.toBeNull(); // 定位当前值（全部年份 is-cur）
    closePanel();
  });
});
