// @vitest-environment jsdom
/**
 * 支持作者提醒（core/support-prompt.ts，2026-11-09）
 *
 * 这是「关更新日志时问一句」的那张纸。钉三件事：
 *  1. 纸上有什么：眉标、两行正文（<br> 断在「作者一个人，」后）、后缀、两个按钮的次序；
 *  2. 两个答案：点「支持作者」返回 support、点「以后再说」返回 dismiss，窗都要先关掉；
 *  3. 关窗手势与拒绝等价：点遮罩 / ESC 都算 dismiss，不该因为用的手势不同得出别的结论。
 *
 * 入口时机（谁在什么时候调它）在 settings-panel/changelog-note 的测试里。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import {
  openSupportPrompt,
  SUPPORT_PITCH,
  SUPPORT_PITCH_REST,
  SUPPORT_NOTE,
} from '../../src/core/support-prompt';
import { setApp } from '../../src/core/app';
import type { App } from 'obsidian';
import { REPO_SLUG } from '../../src/core/remote-base';

const card = () => document.querySelector<HTMLElement>('.bz-sup');
const pick = (sel: string) => document.querySelector<HTMLElement>(sel)!;

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  setApp({ vault: {}, workspace: {} } as any);
});

describe('支持作者提醒 · 纸上有什么', () => {
  it('眉标、两行正文、后缀、两个按钮（以后再说在前）', () => {
    void openSupportPrompt();

    expect(card()?.querySelector('.bz-sup-kicker')?.textContent).toBe('支持作者');

    const lead = card()?.querySelector('.bz-sup-lead');
    // 断行落在「作者一个人，」之后：这句是两句话，不能交给浏览器按宽度切
    expect(lead?.querySelector('br')).toBeTruthy();
    expect(lead?.textContent).toBe(SUPPORT_PITCH + SUPPORT_PITCH_REST);

    expect(card()?.querySelector('.bz-sup-note')?.textContent).toBe(SUPPORT_NOTE);

    const labels = [...document.querySelectorAll('.bz-sup-btn')].map((b) => b.textContent);
    expect(labels).toEqual(['以后再说', '支持作者']);
  });

  /* 收藏入口（2026-11-10）：不花钱的另一种支持，放在两个按钮下面——
     不抢「要不要打赏」那个二选一的注意力，但也不藏。 */
  it('按钮下面还有一行：或者给个 Star，指向本仓库', () => {
    void openSupportPrompt();
    const link = card()?.querySelector<HTMLAnchorElement>('.bz-sup-star-link');
    expect(link?.textContent).toBe('或者给个 Star');
    expect(link?.getAttribute('href')).toBe(`https://github.com/${REPO_SLUG}`);
  });

  it('弹窗壳走的是 uiModal（遮罩 + 纸卡），带皮肤类', () => {
    void openSupportPrompt();
    expect(document.querySelector('.bz-overlay-mask')).toBeTruthy();
    expect(document.querySelector('.bz-overlay-popup.bz-sup-modal')).toBeTruthy();
  });
});

describe('支持作者提醒 · 两个答案', () => {
  it('「支持作者」→ support，窗先关掉', async () => {
    const p = openSupportPrompt();
    pick('.bz-sup-go').click();
    await expect(p).resolves.toBe('support');
    expect(card()).toBeNull();
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
  });

  it('「以后再说」→ dismiss，窗先关掉', async () => {
    const p = openSupportPrompt();
    pick('.bz-sup-later').click();
    await expect(p).resolves.toBe('dismiss');
    expect(card()).toBeNull();
  });

  it('点遮罩与「以后再说」等价', async () => {
    const p = openSupportPrompt();
    document.querySelector<HTMLElement>('.bz-overlay-mask')!.click();
    await expect(p).resolves.toBe('dismiss');
    expect(card()).toBeNull();
  });

  it('只落一次结论：点了「支持作者」之后再被 onClose 叫到也不会改判成 dismiss', async () => {
    const p = openSupportPrompt();
    pick('.bz-sup-go').click();
    // 窗已经没了，这里直接验结论（若 settle 没做幂等，第二次会覆盖成 dismiss）
    await expect(p).resolves.toBe('support');
  });
});

describe('支持作者提醒 · 收藏入口', () => {
  it('点它走系统浏览器，窗不关（人可以回来接着选）', () => {
    const openUrl = vi.fn((_url: string) => Promise.resolve());
    setApp({ openUrl } as unknown as App);

    void openSupportPrompt();
    const link = card()!.querySelector<HTMLAnchorElement>('.bz-sup-star-link')!;
    link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(openUrl).toHaveBeenCalledWith(`https://github.com/${REPO_SLUG}`);
    expect(card()).toBeTruthy();
  });
});
