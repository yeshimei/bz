/**
 * 第二大脑视频教程（2026-11：空库引导页入口 + 首次打开弹一次）：
 * - 第一次打开弹一次，票根/说明/两个按钮都在，弹窗穿本域皮；
 * - 第二次打开不弹（设置里已记账）；
 * - 链接占位期点击只提示「还没发」，不跳外链。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import BzSettings, { DEFAULT_SETTINGS } from '../../src/settings';
import {
  SECONDBRAIN_TUTORIAL_URL,
  maybeShowSecondBrainTutorial,
  openSecondBrainTutorial,
  resetSecondBrainTutorialState,
} from '../../src/secondbrain/tutorial';

function makeEnv() {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  const settings = { ...DEFAULT_SETTINGS } as BzSettings;
  setSettingsProvider(() => settings);
  return { vault, app, settings };
}

describe('第二大脑视频教程', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    resetSecondBrainTutorialState();
  });

  afterEach(() => {
    resetSecondBrainTutorialState();
  });

  it('第一次打开弹一次：票根/说明/两个按钮，弹窗带本域皮肤类', () => {
    const { settings } = makeEnv();
    maybeShowSecondBrainTutorial();

    const popup = document.querySelector('.bz-overlay-popup.bz-sb-tutorial') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.textContent).toContain('三分钟看懂第二大脑');
    expect(popup.querySelector('.bz-tut-cover')).toBeTruthy();
    expect(popup.querySelectorAll('.bz-btn').length).toBe(2);
    expect(settings.secondbrainTutorialSeen).toBe(true);
  });

  it('第二次打开不弹（设置里已记账）', () => {
    makeEnv();
    maybeShowSecondBrainTutorial();
    expect(document.querySelector('.bz-overlay-popup.bz-sb-tutorial')).toBeTruthy();

    document.body.innerHTML = '';
    resetSecondBrainTutorialState();
    maybeShowSecondBrainTutorial();
    expect(document.querySelector('.bz-overlay-popup.bz-sb-tutorial')).toBeNull();
  });

  it('票根指向 B 站视频，点击走外链打开', () => {
    const { app } = makeEnv();
    const openSpy = vi.fn();
    (app as any).openUrl = openSpy;
    expect(SECONDBRAIN_TUTORIAL_URL).toContain('bilibili.com/video/');

    openSecondBrainTutorial();
    (document.querySelector('.bz-tut-cover') as HTMLElement).click();

    expect(openSpy).toHaveBeenCalledWith(SECONDBRAIN_TUTORIAL_URL);
  });
});
