/**
 * smartcat 接入测试（UI 层）：ensure 幂等挂载猫容器与面板、打开聊天（bz-win-head）、
 * 移动端全屏设置写回、hide 清理、unload 全量清理。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { ensureSmartCat, unloadSmartCat, openSmartCat, openSmartCatChat, hideSmartCat, __getSmartcatInternals } from '../../src/smartcat/index';
import { getSmartcatFilePath, defaultSmartCatData } from '../../src/smartcat/data';

const diskData: Record<string, any> = {};

function makeApp() {
  const vault = new MockVault();
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(async () => {});
  // workspace 事件收集（file-open 等）
  const wsListeners: Record<string, Function[]> = {};
  app.workspace.on = (ev: string, cb: any) => { (wsListeners[ev] ||= []).push(cb); return { ev, cb }; };
  app.workspace.offref = (ref: any) => {
    const arr = wsListeners[ref?.ev] || [];
    const idx = arr.indexOf(ref?.cb);
    if (idx >= 0) arr.splice(idx, 1);
  };
  app.emitWs = (ev: string, ...args: any[]) => { for (const cb of wsListeners[ev] || []) void cb(...args); };
  app.wsListeners = wsListeners;
  return { app, vault };
}

let settings: any = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
});

describe('ensureSmartCat', () => {
  it('幂等初始化：挂载猫容器 + 子系统 + 常驻监听', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const container = document.getElementById('smart-companion-cat');
    expect(container).not.toBeNull();
    expect(container!.querySelector('#cat-body')).not.toBeNull();
    const internals = __getSmartcatInternals();
    expect(internals.bubbleManager).not.toBeNull();
    expect(internals.moodSystem).not.toBeNull();
    expect(internals.animation).not.toBeNull();
    expect(internals.initialized).toBe(true);
    // 再次调用幂等（不重建 DOM）
    await ensureSmartCat(app);
    expect(document.querySelectorAll('#smart-companion-cat').length).toBe(1);
  }, 15000);

  it('数据落盘 smartcat.json（迁移默认）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    expect(vault.files.has(getSmartcatFilePath())).toBe(true);
  }, 15000);

  it('file-open 监听注册（wsListeners.file-open 挂载）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    expect(app.wsListeners['file-open']?.length).toBe(1);
  }, 15000);
});

describe('openSmartCat / 命令回调', () => {
  it('openSmartCat 不抛错且挂载容器', async () => {
    const { app } = makeApp();
    await openSmartCat(app);
    expect(document.getElementById('smart-companion-cat')).not.toBeNull();
  }, 15000);

  it('openSmartCatChat 打开聊天面板（bz-win-head 头行）', async () => {
    const { app } = makeApp();
    await openSmartCatChat(app);
    const chatPanel = document.getElementById('chat-panel');
    expect(chatPanel).not.toBeNull();
    expect(chatPanel!.querySelector('.bz-win-head')).not.toBeNull();
    expect(chatPanel!.querySelector('#smartcat-btn-settings')).not.toBeNull();
    expect(chatPanel!.querySelector('#smartcat-btn-close')).not.toBeNull();
    expect(chatPanel!.querySelector('.chat-messages')).not.toBeNull();
    expect(chatPanel!.querySelector('.chat-input')).not.toBeNull();
  }, 15000);

  it('hideSmartCat 卸载容器与面板', async () => {
    const { app } = makeApp();
    await openSmartCatChat(app);
    expect(document.getElementById('chat-panel')).not.toBeNull();
    hideSmartCat();
    expect(document.getElementById('smart-companion-cat')).toBeNull();
    expect(document.getElementById('chat-panel')).toBeNull();
  }, 15000);
});

describe('unloadSmartCat', () => {
  it('全量清理：容器移除、监听解除、子系统置空', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    unloadSmartCat();
    expect(document.getElementById('smart-companion-cat')).toBeNull();
    expect(app.wsListeners['file-open']?.length ?? 0).toBe(0);
    const internals = __getSmartcatInternals();
    expect(internals.bubbleManager).toBeNull();
    expect(internals.initialized).toBe(false);
  }, 15000);
});