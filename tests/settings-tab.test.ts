/**
 * 设置页测试（覆盖 main.ts BzSettingTab）：issue 345（2026-09-16 用户拍板）原生设置页
 * 退役平铺——不再渲染任何 schema 设置组，只留一个「打开设置面板」按钮，点击打开
 * settings-panel 面板（openSettingsPanel）。原平铺（服务商/密钥/存储路径/通知行）
 * 的数据断言改由 tests/core/settings-schema.test.ts（mainSettingsSchema 纯数据）与
 * settings-panel.test.ts（面板内嵌渲染）承接。
 * 依赖 mock-obsidian-entry 的 Setting 链式 mock（MockButton 渲染真实 button 元素）。
 */
import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest';
import BzPlugin, { BzSettingTab } from '../src/main';
import { unloadSmartCat } from '../src/smartcat/index';
import { MockVault } from './mock-vault';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { openSettingsPanel } from '../src/settings-panel';

// 插件加载经 onLayoutReady 触发 `void ensureSmartCat(app)`（fire-and-forget 常驻装配）。
// 文件结束时若装配链仍在 await，jsdom 拆除后会跑到 mountCatContainer 读 document →
// Unhandled Rejection；按生产卸载路径短路（竞态守卫以 initialized=false 中止装配）。
afterAll(() => { unloadSmartCat(); });

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

  it('从宿主设置进入：先收宿主，宿主真正离场后才开面板（移动端焦点交接）', () => {
    vi.useFakeTimers();
    try {
      const host = document.createElement('div');
      host.className = 'modal-container is-visible';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-close-button';
      const onClose = vi.fn();
      closeBtn.addEventListener('click', onClose);
      host.appendChild(closeBtn);
      host.appendChild(tab.containerEl);
      document.body.appendChild(host);

      const btn = tab.containerEl.querySelector('.setting-item-control button') as HTMLButtonElement;
      btn.click();

      // 宿主先收，面板还不能开——否则焦点仍被宿主 Modal 攥着
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(openSettingsPanel).not.toHaveBeenCalled();

      // 宿主离场（关闭动画结束、容器摘除）后下一拍开面板
      host.remove();
      vi.advanceTimersByTime(60);
      expect(openSettingsPanel).toHaveBeenCalledTimes(1);
      expect(openSettingsPanel).toHaveBeenCalledWith(plugin.app);
    } finally {
      vi.useRealTimers();
    }
  });

  it('宿主迟迟不收起：最多等一秒，超时照开面板（不让人点了没反应）', () => {
    vi.useFakeTimers();
    try {
      const host = document.createElement('div');
      host.className = 'modal-container is-visible';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-close-button';
      closeBtn.addEventListener('click', () => {}); // 点了也不收起
      host.appendChild(closeBtn);
      host.appendChild(tab.containerEl);
      document.body.appendChild(host);

      const btn = tab.containerEl.querySelector('.setting-item-control button') as HTMLButtonElement;
      btn.click();

      vi.advanceTimersByTime(600);
      expect(openSettingsPanel).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(openSettingsPanel).toHaveBeenCalledTimes(1);
      expect(openSettingsPanel).toHaveBeenCalledWith(plugin.app);
    } finally {
      vi.useRealTimers();
    }
  });
});
