/**
 * 知识盒视频教程（2026-11：空态入口 + 首次打开弹一次）：
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
  KNOWLEDGE_TUTORIAL_URL,
  maybeShowKnowledgeTutorial,
  openKnowledgeTutorial,
  resetKnowledgeTutorialState,
} from '../../src/knowledge/tutorial';

function makeEnv() {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  const settings = { ...DEFAULT_SETTINGS } as BzSettings;
  setSettingsProvider(() => settings);
  return { vault, app, settings };
}

describe('知识盒视频教程', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    resetKnowledgeTutorialState();
  });

  afterEach(() => {
    resetKnowledgeTutorialState();
  });

  it('第一次打开弹一次：票根/说明/两个按钮，弹窗带本域皮肤类', () => {
    const { settings } = makeEnv();
    maybeShowKnowledgeTutorial();

    const popup = document.querySelector('.bz-overlay-popup.bz-kb-tutorial') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.textContent).toContain('三分钟看懂知识盒');
    expect(popup.querySelector('.bz-tut-cover')).toBeTruthy();
    expect(popup.querySelectorAll('.bz-btn').length).toBe(2);
    expect(settings.knowledgeTutorialSeen).toBe(true);
  });

  it('第二次打开不弹（设置里已记账）', () => {
    makeEnv();
    maybeShowKnowledgeTutorial();
    expect(document.querySelector('.bz-overlay-popup.bz-kb-tutorial')).toBeTruthy();

    document.body.innerHTML = '';
    resetKnowledgeTutorialState(); // 只清会话内状态，设置里的标记留着
    maybeShowKnowledgeTutorial();
    expect(document.querySelector('.bz-overlay-popup.bz-kb-tutorial')).toBeNull();
  });

  it('票根指向 B 站视频，点击走外链打开', () => {
    const { app } = makeEnv();
    const openSpy = vi.fn();
    (app as any).openUrl = openSpy;
    expect(KNOWLEDGE_TUTORIAL_URL).toContain('bilibili.com/video/');

    openKnowledgeTutorial();
    (document.querySelector('.bz-tut-cover') as HTMLElement).click();

    expect(openSpy).toHaveBeenCalledWith(KNOWLEDGE_TUTORIAL_URL);
  });
});
