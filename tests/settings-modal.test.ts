/**
 * 域设置弹窗测试（ADR-0009）：
 * 1) core/settings-modal 机制——打开/标题/build/空态/✕/遮罩/Esc/幂等替换；
 * 2) 备忘录面板 ⚙️ 交互（toggle 写回设置）；
 * 3) 归物本（空弹窗 + 排序按钮改 🔀）、收藏本（空弹窗）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openSettingsModal, closeSettingsModal } from '../src/core/settings-modal';
import { setApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { setBzSettingsProvider } from '../src/memo';
import { App } from '../src/memo/app';
import { UIManager } from '../src/memo/ui';
import { DataManager } from '../src/memo/data';
import { openBelongingsPanel, cleanupBelongings } from '../src/belongings/ui';
import { FavoritesApp } from '../src/favorites/app';
import { MockVault } from './mock-vault';
import { resetObsidianMocks } from './mock-obsidian-entry';
import moment from 'moment';

describe('core settings-modal 机制', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    closeSettingsModal();
  });

  it('打开：mask/popup 挂载 body，标题正确，build 内容渲染', () => {
    openSettingsModal({
      title: '测试设置',
      build: (el) => {
        const s = document.createElement('div');
        s.className = 'setting-item';
        s.dataset.name = '测试项';
        el.appendChild(s);
      },
    });
    const mask = document.getElementById('bz-settings-modal-mask');
    const popup = document.getElementById('bz-settings-modal-popup');
    expect(mask).not.toBeNull();
    expect(popup).not.toBeNull();
    expect(mask!.style.display).toBe('block');
    expect(popup!.textContent).toContain('测试设置');
    expect(popup!.querySelector('[data-name="测试项"]')).not.toBeNull();
  });

  it('层级：设置弹窗 z-index 高于普通面板弹窗（10001-10005），低于入口页 10100', () => {
    openSettingsModal({ title: '层级测试', build: () => {} });
    const mask = document.getElementById('bz-settings-modal-mask');
    expect(mask).not.toBeNull();
    const z = parseInt(mask!.style.zIndex, 10);
    expect(z).toBeGreaterThan(10005);
    expect(z).toBeLessThan(10100);
  });

  it('空态：build 未挂 setting-item 时显示 emptyText/emptyDesc', () => {
    openSettingsModal({ title: '空设置', build: () => {}, emptyText: '没有可配置的设置项', emptyDesc: '路径由全局管理' });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('没有可配置的设置项');
    expect(popup.textContent).toContain('路径由全局管理');
    expect(popup.querySelector('.setting-item')).toBeNull();
  });

  it('✕ 关闭', () => {
    openSettingsModal({ title: '测试设置', build: () => {} });
    const closeBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === '✕')!;
    closeBtn.click();
    expect(document.getElementById('bz-settings-modal-mask')).toBeNull();
  });

  it('点击遮罩关闭', () => {
    openSettingsModal({ title: '测试设置', build: () => {} });
    document.getElementById('bz-settings-modal-mask')!.click();
    expect(document.getElementById('bz-settings-modal-mask')).toBeNull();
  });

  it('Esc 关闭（escManager 层级）', () => {
    openSettingsModal({ title: '测试设置', build: () => {} });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('bz-settings-modal-mask')).toBeNull();
  });

  it('重复打开替换旧弹窗（同一时刻至多一个）', () => {
    openSettingsModal({ title: '旧弹窗', build: () => {} });
    openSettingsModal({ title: '新弹窗', build: () => {} });
    const popups = [...document.querySelectorAll('#bz-settings-modal-popup')];
    expect(popups.length).toBe(1);
    expect(popups[0].textContent).toContain('新弹窗');
  });

  it('onClose：点遮罩关闭时触发一次', () => {
    let closed = 0;
    openSettingsModal({ title: '回调测试', build: () => {}, onClose: () => { closed++; } });
    const mask = document.getElementById('bz-settings-modal-mask')!;
    mask.click();
    expect(closed).toBe(1);
    // 关闭后遮罩已脱离 DOM，再次 click 不应重复触发
    mask.click();
    expect(closed).toBe(1);
  });

  it('onClose：✕ 与 Esc 关闭均触发；无 onClose 不报错', () => {
    let closed = 0;
    openSettingsModal({ title: '回调测试', build: () => {}, onClose: () => { closed++; } });
    const closeBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === '✕')!;
    closeBtn.click();
    expect(closed).toBe(1);
    openSettingsModal({ title: '回调测试2', build: () => {}, onClose: () => { closed++; } });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(2);
    // 无 onClose 的弹窗正常关闭
    openSettingsModal({ title: '无回调', build: () => {} });
    closeSettingsModal();
    expect(document.getElementById('bz-settings-modal-mask')).toBeNull();
  });

  it('onClose：被新弹窗顶替时对旧弹窗触发', () => {
    let oldClosed = 0;
    openSettingsModal({ title: '旧弹窗', build: () => {}, onClose: () => { oldClosed++; } });
    openSettingsModal({ title: '新弹窗', build: () => {} });
    expect(oldClosed).toBe(1);
  });
});

describe('备忘录面板 ⚙️ 设置弹窗', () => {
  const SETTINGS = {
    todoFilePath: 'CONFIG/STORAGE',
    showFileName: true,
    autoPopupOnStart: false,
    movieFolderPath: '我的/影视',
  };

  beforeEach(async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useRealTimers();
    const vault = new MockVault();
    const app = {
      vault,
      workspace: {
        on: vi.fn(() => ({ ref: 'ref' })),
        getLeaf: vi.fn(() => ({ openFile: vi.fn(), view: null })),
        getActiveFile: () => null,
      },
      metadataCache: { getFileCache: () => null },
      commands: { removeCommand: vi.fn() },
    };
    setApp(app as any);
    setBzSettingsProvider(() => SETTINGS);
    setSettingsProvider(() => SETTINGS as any);
    await App.init(SETTINGS);
  });

  it('点 ⚙️ 打开弹窗，切换「启动时自动弹出」写回设置', async () => {
    UIManager.showMain(null, false);
    const settingsBtn = document.querySelector('.todo-btn-settings') as HTMLElement;
    expect(settingsBtn).not.toBeNull();
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('备忘录设置');
    const item = [...popup.querySelectorAll('.setting-item')].find((el) => (el as HTMLElement).dataset.name === '启动时自动弹出') as HTMLElement;
    expect(item).toBeTruthy();
    const toggle = (item as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
    toggle.trigger(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(SETTINGS.autoPopupOnStart).toBe(true);
  });
});

describe('归物本 ⚙️ / 🔀', () => {
  beforeEach(async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/belongings.json', JSON.stringify({ version: '1.0', last_updated: '', items: {} }));
    setApp({ vault, workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
    setSettingsProvider(() => ({ belongingsDataFolder: 'CONFIG/STORAGE' } as any));
    await openBelongingsPanel();
  });

  afterEach(() => cleanupBelongings());

  it('排序按钮为 🔀（非 ⚙️），⚙️ 打开空弹窗', () => {
    const overlay = document.getElementById('__gui_wu_ben__')!;
    const sortBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '🔀')!;
    expect(sortBtn).toBeTruthy();
    const settingsBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === '⚙️')!;
    expect(settingsBtn).toBeTruthy();
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('归物本设置');
    expect(popup.textContent).toContain('没有可配置的设置项');
    expect(popup.querySelector('.setting-item')).toBeNull();
  });
});

describe('收藏本 ⚙️ 空弹窗', () => {
  beforeEach(async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    const vault = new MockVault();
    setApp({
      vault,
      workspace: { getLeaf: () => ({ openFile: vi.fn() }), on: () => ({ ref: 'r' }) },
      metadataCache: { getFileCache: () => null, getBacklinksForFile: () => null },
      commands: { executeCommandById: vi.fn() },
      fileManager: { processFrontMatter: () => Promise.resolve() },
    } as any);
    setSettingsProvider(() => ({ favoritesStoragePath: 'CONFIG/STORAGE' } as any));
    FavoritesApp.instance = null;
    await FavoritesApp.getInstance().init();
  });

  it('⚙️ 打开空弹窗（收藏本无设置项）', () => {
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '收藏本设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('收藏本设置');
    expect(popup.textContent).toContain('没有可配置的设置项');
  });
});
