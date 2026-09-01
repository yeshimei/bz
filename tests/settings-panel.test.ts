/**
 * 设置面板域测试（settings-panel，ADR-0080）
 * UI 层：桌面侧栏工作台构建 / 域导航切换内嵌渲染真实 schema / 搜索过滤 /
 *       移动命令面板构建 / 域设置弹窗 / 关闭 / 卸载清理。
 * 核心断言：面板内嵌渲染 = renderSettingsInto（与 ⚙️ 弹窗同一渲染器同一数据通道）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { SettingsPanelUI } from '../src/settings-panel/ui';
import { openSettingsPanel, unloadSettingsPanel } from '../src/settings-panel';
import { escManager } from '../src/core/esc-manager';
import { setSettingsProvider } from '../src/core/settings-provider';

// mock Platform.isMobile 切换（桌面/移动两态）
let mobileFlag = false;
vi.mock('obsidian', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return {
    ...mod,
    Platform: {
      get isMobile() {
        return mobileFlag;
      },
    },
  };
});

/** 等渲染微任务完成 */
const tick = () => new Promise((r) => setTimeout(r, 20));

describe('设置面板（settings-panel）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    mobileFlag = false;
    document.body.innerHTML = '';
    unloadSettingsPanel();
    (escManager as any).handlers = new Map();
    setSettingsProvider(() => ({ settingsPanelMobileDefaultFullscreen: true } as any));
  });

  it('桌面端：构建侧栏工作台（品牌+搜索+域导航+右侧面板）', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(popup).toBeTruthy();
    expect(popup.classList.contains('bz-sp-desk')).toBe(true);
    expect(popup.querySelector('.bz-sp-brand-name')!.textContent).toBe('设置');
    expect(popup.querySelectorAll('.bz-sp-nav-item').length).toBe(22);
    expect(popup.querySelector('.bz-sp-pane-title')!.textContent).toBe('全局');
    // 无底部快捷键提示 / 无右侧导航条
    expect(popup.querySelector('.bz-sp-foot')).toBeNull();
    expect(popup.querySelector('.bz-sp-crumb')).toBeNull();
    ui.cleanup();
  });

  it('桌面端：全局域内嵌渲染 AI 服务商设置（renderSettingsInto 真实渲染）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 全局 schema = mainSettingsSchema（AI + 数据存储路径两区块）
    const groups = popup.querySelectorAll('.bz-settings-group');
    expect(groups.length).toBeGreaterThanOrEqual(2);
    // 设置行真实渲染（Obsidian Setting 结构）
    expect(popup.querySelectorAll('.setting-item').length).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('桌面端：点击域导航切换 → 内嵌渲染该域真实 schema', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    // 点击「复习计划」（index 11）→ 内嵌渲染 review schema（检查提醒/做题家等分组）
    (items[11] as HTMLElement).click();
    expect(popup.querySelector('.bz-sp-pane-title')!.textContent).toBe('复习计划');
    await tick();
    const groups = popup.querySelectorAll('.bz-settings-group');
    // review schema 至少 5 组（检查提醒/做题家/复习节奏/记忆算法/自动化/界面）
    expect(groups.length).toBeGreaterThanOrEqual(5);
    // 设置行真实渲染（开关/输入等）
    expect(popup.querySelectorAll('.setting-item').length).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('桌面端：番茄钟域内嵌渲染（时间方案/行为分组）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    // 番茄钟 index 16
    (items[16] as HTMLElement).click();
    await tick();
    const groups = popup.querySelectorAll('.bz-settings-group');
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(popup.querySelectorAll('.setting-item').length).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('桌面端：无设置项域显示空态', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    // 归物本 index 3
    (items[3] as HTMLElement).click();
    await tick();
    expect(popup.querySelector('.bz-sp-empty')).toBeTruthy();
    ui.cleanup();
  });

  it('桌面端：搜索过滤域导航', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const search = popup.querySelector('.bz-sp-search-in') as HTMLInputElement;
    search.value = '番茄';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('番茄钟');
    ui.cleanup();
  });

  it('移动端：构建命令面板（搜索+域列表+关闭按钮，主面板真全屏）', () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(popup.classList.contains('bz-sp-mobile')).toBe(true);
    expect(popup.classList.contains('bz-win-mfs')).toBe(true);
    expect(popup.querySelector('.bz-sp-mob-close')).toBeTruthy();
    expect(popup.querySelectorAll('.bz-sp-mob-item').length).toBe(22);
    ui.cleanup();
  });

  it('移动端：点域 → 居中弹窗内嵌渲染真实 schema', async () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const items = popup.querySelectorAll('.bz-sp-mob-item');
    // 点「番茄钟」（index 16）
    (items[16] as HTMLElement).click();
    await tick();
    const modal = document.querySelector('.bz-sp-mob-modal');
    expect(modal).toBeTruthy();
    // 弹窗内真实设置分组
    expect(modal!.querySelectorAll('.bz-settings-group').length).toBeGreaterThanOrEqual(2);
    // 遮罩点击关闭（精确选弹窗遮罩：弹窗 mask 是 modal 的前一个兄弟）
    const modalMask = modal!.previousElementSibling as HTMLElement;
    expect(modalMask.classList.contains('bz-overlay-mask')).toBe(true);
    modalMask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-sp-mob-modal')).toBeNull();
    ui.cleanup();
  });

  it('移动端：搜索过滤域列表 + 无结果空态', () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const search = popup.querySelector('.bz-sp-mob-search .bz-sp-search-in') as HTMLInputElement;
    search.value = '不存在的域';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(popup.querySelectorAll('.bz-sp-mob-item').length).toBe(0);
    expect(popup.querySelector('.bz-sp-mob-empty')).toBeTruthy();
    ui.cleanup();
  });

  it('移动端：关闭按钮隐藏主面板（遮罩仍在，可重开）', () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    (popup.querySelector('.bz-sp-mob-close') as HTMLElement).click();
    expect(popup.style.display).toBe('none');
    ui.open();
    expect(popup.style.display).toBe('flex');
    ui.cleanup();
  });

  it('命令入口：openSettingsPanel 构建面板，unloadSettingsPanel 清理 DOM', async () => {
    const app: any = {};
    await openSettingsPanel(app);
    expect(document.getElementById('bz-settings-panel-mask')).toBeTruthy();
    expect(document.getElementById('bz-settings-panel-popup')).toBeTruthy();
    unloadSettingsPanel();
    expect(document.getElementById('bz-settings-panel-mask')).toBeNull();
    expect(document.getElementById('bz-settings-panel-popup')).toBeNull();
  });

  it('遮罩点击关闭面板', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const mask = document.getElementById('bz-settings-panel-mask')!;
    const popup = document.getElementById('bz-settings-panel-popup')!;
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(popup.style.display).toBe('none');
    ui.cleanup();
  });
});
