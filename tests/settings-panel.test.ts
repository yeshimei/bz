/**
 * 设置面板域测试（settings-panel，ADR-0080）
 * UI 层：桌面侧栏工作台构建 / 移动命令面板构建 / 搜索过滤 / 关闭 / 卸载清理。
 * 数据层：无独立数据（面板是聚合导航，设置读写走既有 schema）。
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

describe('设置面板（settings-panel）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    mobileFlag = false;
    document.body.innerHTML = '';
    unloadSettingsPanel();
    // escManager 单例状态复位（register 会堆积）
    (escManager as any).handlers = new Map();
    // 注入设置提供者（移动端默认全屏键默认 true）
    setSettingsProvider(() => ({ settingsPanelMobileDefaultFullscreen: true } as any));
  });

  it('桌面端：构建侧栏工作台（品牌+搜索+域导航+右侧面板）', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(popup).toBeTruthy();
    expect(popup.classList.contains('bz-sp-desk')).toBe(true);
    // 品牌「设置」+ emoji 图标
    expect(popup.querySelector('.bz-sp-brand-name')!.textContent).toBe('设置');
    // 域导航 22 项（全局 + 20 域 + 文献）
    expect(popup.querySelectorAll('.bz-sp-nav-item').length).toBe(22);
    // 右侧面板显示当前域（全局）
    expect(popup.querySelector('.bz-sp-pane-title')!.textContent).toBe('全局');
    // 无底部快捷键提示 / 无右侧导航条
    expect(popup.querySelector('.bz-sp-foot')).toBeNull();
    expect(popup.querySelector('.bz-sp-crumb')).toBeNull();
    ui.cleanup();
  });

  it('桌面端：点击域导航切换右侧面板', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    // 点击「复习计划」（index 11）
    (items[11] as HTMLElement).click();
    expect(popup.querySelector('.bz-sp-pane-title')!.textContent).toBe('复习计划');
    // 选中态高亮
    expect(popup.querySelector('.bz-sp-nav-item.on .bz-sp-nav-name')!.textContent).toBe('复习计划');
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
    // 全屏类（settingsPanelMobileDefaultFullscreen 默认 true）
    expect(popup.classList.contains('bz-win-mfs')).toBe(true);
    // 关闭按钮存在
    expect(popup.querySelector('.bz-sp-mob-close')).toBeTruthy();
    // 域列表 22 项
    expect(popup.querySelectorAll('.bz-sp-mob-item').length).toBe(22);
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
    // 重开（幂等顶置）
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
    // 点击遮罩本体（非弹窗）→ 隐藏
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(popup.style.display).toBe('none');
    ui.cleanup();
  });
});
