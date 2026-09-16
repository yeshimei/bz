/**
 * 设置页测试（覆盖 main.ts BzSettingTab）：issue 345（2026-09-16 用户拍板）原生设置页
 * 退役平铺——不再渲染任何 schema 设置组，只留一个「打开设置面板」按钮，点击打开
 * settings-panel 面板（openSettingsPanel）。原平铺（服务商/密钥/存储路径/通知行）
 * 的数据断言改由 tests/core/settings-schema.test.ts（mainSettingsSchema 纯数据）与
 * settings-panel.test.ts（面板内嵌渲染）承接。
 * 依赖 mock-obsidian-entry 的 Setting 链式 mock（MockButton 渲染真实 button 元素）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BzPlugin, { BzSettingTab } from '../src/main';
import { MockVault } from './mock-vault';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { openSettingsPanel } from '../src/settings-panel';

// 拦截面板打开（本页只断言「点击 → openSettingsPanel(app)」，面板内部行为归 settings-panel.test.ts）
vi.mock('../src/settings-panel', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return { ...mod, openSettingsPanel: vi.fn() };
});

const diskData: Record<string, any> = {};

function makeMockApp() {
  const vault = new MockVault();
  return {
    vault,
    workspace: {
      onLayoutReady: (cb: () => void) => cb(),
      getActiveFile: () => null,
      activeEditor: null,
      on: () => ({ ref: 'ref' }),
    },
    commands: { addCommand: () => {}, removeCommand: () => {} },
    metadataCache: { getFileCache: () => null, getBacklinksForFile: () => null, on: () => ({ ref: 'ref' }) },
    fileManager: { processFrontMatter: () => Promise.resolve() },
  };
}

async function createPlugin(app: any) {
  const plugin: any = new BzPlugin(app, {} as any);
  plugin.app = app;
  plugin.loadData = async () => diskData['bz'] ?? null;
  plugin.saveData = async (d: any) => {
    diskData['bz'] = d;
  };
  await plugin.onload();
  return plugin;
}

describe('设置页 BzSettingTab（issue 345：只留打开设置面板按钮）', () => {
  let plugin: any;
  let tab: BzSettingTab;

  beforeEach(async () => {
    resetObsidianMocks();
    delete diskData['bz'];
    document.body.innerHTML = '';
    vi.mocked(openSettingsPanel).mockClear();
    plugin = await createPlugin(makeMockApp());
    tab = new BzSettingTab(plugin.app, plugin);
    tab.display();
  });

  afterEach(() => {
    if (plugin && plugin.unregisterGestures) plugin.unregisterGestures();
  });

  it('原生页无任何 schema 设置组：无分组卡片、无密钥/存储路径/通知行，仅一行一按钮', () => {
    expect(tab.containerEl.querySelectorAll('.bz-settings-group-name').length).toBe(0);
    const names = [...tab.containerEl.querySelectorAll('.setting-item')].map((s) => (s as HTMLElement).dataset.name);
    expect(names).toEqual(['打开设置面板']);
    const btn = tab.containerEl.querySelector('.setting-item-control button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('打开设置面板');
    // setCta 强调色按钮（MockButton 记 flag）
    const ctrl = (tab.containerEl.querySelector('.setting-item') as any).__setting.controls[0];
    expect(ctrl.cta).toBe(true);
  });

  it('重复 display 不残留旧内容（containerEl 先 empty）', () => {
    tab.display();
    expect(tab.containerEl.querySelectorAll('.setting-item').length).toBe(1);
  });

  it('点击按钮 → openSettingsPanel(plugin.app)（bz 设置面板打开）', () => {
    const btn = tab.containerEl.querySelector('.setting-item-control button') as HTMLButtonElement;
    btn.click();
    expect(openSettingsPanel).toHaveBeenCalledTimes(1);
    expect(openSettingsPanel).toHaveBeenCalledWith(plugin.app);
  });
});
