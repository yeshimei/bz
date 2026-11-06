/**
 * 日记本 · 首次打开的视频教程弹窗 + 空态入口。
 *
 * 口径（2026-11-05 用户拍板，两次收窄）：
 * - **严格只弹一次**：openDiary 判一次「首次打开」并记账（diaryFirstOpened），之后永不重弹；
 *   弹窗真出现过再写 diaryTutorialSeen，双保险；
 * - **只在非空态弹**：空册/未配置不弹，教程入口常驻在册子空态页与引导纸上；
 * - 地址为空时（预留形态）点入口只给一句人话，不送 404；
 * - 弹窗穿日记域皮（.bz-overlay-popup.bz-diary-tutorial-popup），无标题头，字少。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import {
  DIARY_TUTORIAL_URL,
  consumeFirstDiaryOpen,
  isDiaryTutorialSeen,
  maybeShowDiaryTutorial,
  openTutorialVideo,
  resetDiaryTutorialState,
  shouldShowFirstOpenTutorial,
  showDiaryTutorial,
} from '../../src/diary/tutorial';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';

const mocks = vi.hoisted(() => ({ openExternalUrl: vi.fn() }));
vi.mock('../../src/core/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/utils')>();
  return { ...actual, openExternalUrl: mocks.openExternalUrl };
});

let settings: Record<string, unknown>;
const saver = vi.fn(async () => {});

const popup = (): HTMLElement | null => document.querySelector('.bz-diary-tutorial-popup');
const byClass = (cls: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`.bz-diary-tutorial-popup .${cls}`)!;

beforeEach(() => {
  mocks.openExternalUrl.mockClear();
  saver.mockClear();
  document.body.innerHTML = '';
  clearNotices();
  resetDiaryTutorialState();
  settings = { ...DEFAULT_SETTINGS, diaryFirstOpened: false, diaryTutorialSeen: false };
  setSettingsProvider(() => settings as never);
  setSettingsSaver(saver);
  setApp(mockAppWithVault(new MockVault()));
});

describe('首次打开只判一次', () => {
  it('第一次打开返回 true 并记账；同会话第二次返回 false', () => {
    expect(consumeFirstDiaryOpen()).toBe(true);
    expect(settings.diaryFirstOpened).toBe(true);
    expect(saver).toHaveBeenCalledTimes(1);

    expect(consumeFirstDiaryOpen()).toBe(false);
    expect(saver).toHaveBeenCalledTimes(1); // 第二次不再写盘
  });

  it('设置里已记过账（重启 / 跨会话）→ 不是第一次，也不写盘', () => {
    settings.diaryFirstOpened = true;
    expect(consumeFirstDiaryOpen()).toBe(false);
    expect(saver).not.toHaveBeenCalled();
  });

  it('四个条件全满足才判「该弹」', () => {
    const ok = { firstOpen: true, loadError: null, entries: 3 };
    expect(shouldShowFirstOpenTutorial(ok)).toBe(true);
    expect(shouldShowFirstOpenTutorial({ ...ok, firstOpen: false })).toBe(false);
    expect(shouldShowFirstOpenTutorial({ ...ok, loadError: '读盘失败' })).toBe(false);
    expect(shouldShowFirstOpenTutorial({ ...ok, entries: 0 })).toBe(false); // 空册不弹
    expect(shouldShowFirstOpenTutorial({ ...ok, seen: true })).toBe(false); // 弹过不弹
  });
});

describe('教程弹窗（A · 票根）', () => {
  it('没弹过 → 一张票根 + 两枚按钮，没有标题头；打开即记账', () => {
    maybeShowDiaryTutorial();

    const el = popup();
    expect(el).toBeTruthy();
    expect(el!.classList.contains('bz-overlay-popup')).toBe(true);
    expect(el!.getAttribute('aria-label')).toBe('视频教程');
    expect(el!.querySelector('.bz-dialog-head')).toBeNull(); // 字少：不出标题头
    expect(el!.querySelector('.bz-diary-tut-cover')).toBeTruthy();
    expect(el!.querySelector('.bz-diary-tut-kicker')!.textContent).toContain('视频教程');
    expect(el!.querySelector('.bz-diary-tut-name')!.textContent).toBe('三分钟上手');
    expect(byClass('bz-diary-tut-dismiss').textContent).toContain('先翻翻');
    expect(byClass('bz-diary-tut-go').textContent).toContain('看视频教程');

    expect(isDiaryTutorialSeen()).toBe(true);
    expect(settings.diaryTutorialSeen).toBe(true);
  });

  it('已弹过 → 不再弹', () => {
    settings.diaryTutorialSeen = true;
    maybeShowDiaryTutorial();
    expect(popup()).toBeNull();
  });

  it('同一时刻不叠第二个：重复调用返回同一句柄', () => {
    const a = showDiaryTutorial();
    const b = showDiaryTutorial();
    expect(a).toBeTruthy();
    expect(b).toBe(a);
    expect(document.querySelectorAll('.bz-diary-tutorial-popup').length).toBe(1);
    a?.close();
    expect(popup()).toBeNull();
  });

  it('「先翻翻」只收壳，不打开外链', () => {
    showDiaryTutorial();
    byClass('bz-diary-tut-dismiss').click();
    expect(popup()).toBeNull();
    expect(mocks.openExternalUrl).not.toHaveBeenCalled();
  });
});

describe('B 站链接', () => {
  it('地址已填（2026-11-06 发布）：票根写「视频教程」，不写「即将上线」', () => {
    expect(DIARY_TUTORIAL_URL).toBe('https://www.bilibili.com/video/BV1W44i6yETx');
    showDiaryTutorial();

    expect(popup()!.querySelector('.bz-diary-tut-kicker')!.textContent).toContain('视频教程');
    expect(popup()!.querySelector('.bz-diary-tut-kicker')!.textContent).not.toContain('即将上线');
  });

  it('地址为空（预留的未发布形态）：点「看视频教程」只给一句人话', () => {
    showDiaryTutorial({ url: '' });
    expect(popup()!.querySelector('.bz-diary-tut-kicker')!.textContent).toContain('即将上线');

    byClass('bz-diary-tut-go').click();
    expect(mocks.openExternalUrl).not.toHaveBeenCalled();
    expect(getNoticeMessages().join('\n')).toContain('教程视频还没发');
    expect(popup()).toBeNull();
  });

  it('填了地址：点票根走 core openExternalUrl 单源并收壳', () => {
    const url = 'https://www.bilibili.com/video/BV1test';
    showDiaryTutorial({ url });

    (document.querySelector('.bz-diary-tut-cover') as HTMLButtonElement).click();
    expect(mocks.openExternalUrl).toHaveBeenCalledTimes(1);
    expect(mocks.openExternalUrl.mock.calls[0][1]).toBe(url);
    expect(popup()).toBeNull();
  });

  it('填了地址：点「看视频教程」同样走 openExternalUrl', () => {
    const url = 'https://www.bilibili.com/video/BV1test';
    showDiaryTutorial({ url });

    byClass('bz-diary-tut-go').click();
    expect(mocks.openExternalUrl).toHaveBeenCalledTimes(1);
    expect(mocks.openExternalUrl.mock.calls[0][1]).toBe(url);
  });
});

describe('空态入口', () => {
  it('空册上的「看视频教程」直接开 B 站（不再走占位提示）', () => {
    openTutorialVideo();
    expect(mocks.openExternalUrl).toHaveBeenCalledTimes(1);
    expect(mocks.openExternalUrl.mock.calls[0][1]).toBe(DIARY_TUTORIAL_URL);
    expect(getNoticeMessages().join('\n')).not.toContain('还没发');
  });
});
