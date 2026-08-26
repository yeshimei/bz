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
import { createChatPanel } from '../../src/smartcat/ui';
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

  it('openSmartCatChat 打开聊天面板（bz-win-head 头行；头行无 ⚙️——设置统一长按打开）', async () => {
    const { app } = makeApp();
    await openSmartCatChat(app);
    const chatPanel = document.getElementById('chat-panel');
    expect(chatPanel).not.toBeNull();
    expect(chatPanel!.querySelector('.bz-win-head')).not.toBeNull();
    expect(chatPanel!.querySelector('#smartcat-btn-settings')).toBeNull();
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

  it('P1-28：hide→open 猫容器重新挂载（召回不能修复）+ 隐藏期入队消息被消费', async () => {
    const { app } = makeApp();
    await openSmartCat(app);
    hideSmartCat();
    expect(document.getElementById('smart-companion-cat')).toBeNull();
    // 容器缺失期入队的气泡（打字锁已在早退分支复位、消息保留队首）
    __getSmartcatInternals().bubbleManager.showBubble('隐藏期消息');
    await openSmartCat(app);
    // 幂等 remount：容器重新挂载 + 皮肤重刷 + 气泡队列推进
    const container = document.getElementById('smart-companion-cat');
    expect(container).not.toBeNull();
    expect(container!.querySelector('#cat-bubbles-container')).not.toBeNull();
    expect(container!.classList.contains('bz-sc-skin-orange')).toBe(true);
    expect(document.querySelectorAll('.cat-bubble').length).toBe(1); // 隐藏期消息被消费
    // 再次 open 幂等（不产生第二个容器）
    await openSmartCat(app);
    expect(document.querySelectorAll('#smart-companion-cat').length).toBe(1);
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

describe('聊天输入回车发送（UX 30 中文输入法）', () => {
  function buildPanel() {
    const sent: string[] = [];
    const panels = createChatPanel({
      onSend: (m: string) => sent.push(m),
      onClose: () => {},
    });
    return { panels, sent };
  }

  function keydown(el: HTMLElement, init: KeyboardEventInit): void {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ...init }));
  }

  it('composition 组合态回车（isComposing/keyCode 229）不发送', () => {
    const { panels, sent } = buildPanel();
    panels.chatInput.value = '你好';
    keydown(panels.chatInput, { isComposing: true, keyCode: 229 });
    expect(sent).toEqual([]);
    expect(panels.chatInput.value).toBe('你好'); // 未清空，交还 IME 选字
    panels.dispose();
  });

  it('普通 Enter 发送；Shift+Enter 不发送（输入清空由 sendChatMessage 层负责，面板本身不清）', () => {
    const { panels, sent } = buildPanel();
    panels.chatInput.value = '喵~';
    keydown(panels.chatInput, { shiftKey: true });
    expect(sent).toEqual([]);
    keydown(panels.chatInput, { shiftKey: false });
    expect(sent).toEqual(['喵~']);
    panels.dispose();
  });
});