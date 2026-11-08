/**
 * 教程视频弹窗（core/ui/tutorial-modal）：
 * - 有地址：票根写「B 站 · 视频教程」，点击走外链并关窗；
 * - 没地址（未发布）：票根写「即将上线」，点击只提示不跳、不关窗；
 * - 次动作关窗（幂等）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { showTutorialModal } from '../../src/core/ui/tutorial-modal';

function makeEnv() {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  return app;
}

describe('教程视频弹窗（core）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });

  it('有地址：票根写「B 站 · 视频教程」，点击走外链并关窗', () => {
    const app = makeEnv();
    const openSpy = vi.fn();
    (app as any).openUrl = openSpy;

    showTutorialModal({ className: 'bz-test-tut', title: 'T', desc: 'D', url: 'https://example.com/v' });
    const cover = document.querySelector('.bz-tut-cover') as HTMLElement;
    expect(cover.textContent).toContain('B 站 · 视频教程');

    cover.click();
    expect(openSpy).toHaveBeenCalledWith('https://example.com/v');
    expect(document.querySelector('.bz-overlay-popup.bz-test-tut')).toBeNull();
  });

  it('没地址：票根写「即将上线」，点击只提示不跳、不关窗', () => {
    const app = makeEnv();
    const openSpy = vi.fn();
    (app as any).openUrl = openSpy;

    showTutorialModal({ className: 'bz-test-tut', title: 'T', desc: 'D', url: '' });
    const cover = document.querySelector('.bz-tut-cover') as HTMLElement;
    expect(cover.textContent).toContain('即将上线');

    cover.click();
    expect(getNoticeMessages()).toContain('教程视频还没发');
    expect(openSpy).not.toHaveBeenCalled();
    expect(document.querySelector('.bz-overlay-popup.bz-test-tut')).toBeTruthy();
  });

  it('次动作关窗，句柄重复关闭不炸', () => {
    makeEnv();
    const handle = showTutorialModal({ className: 'bz-test-tut', title: 'T', desc: 'D', url: '' });
    (document.querySelector('.bz-tut-dismiss') as HTMLElement).click();
    expect(document.querySelector('.bz-overlay-popup.bz-test-tut')).toBeNull();
    handle.close();
  });
});
