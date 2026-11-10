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
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import {
  openSupportPrompt,
  SUPPORT_PITCH,
  SUPPORT_PITCH_REST,
  SUPPORT_NOTE,
} from '../../src/core/support-prompt';
import { setApp } from '../../src/core/app';

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

  /* 收藏入口（2026-11-10 加、2026-11-11 删）：不花钱的支持只在赞赏窗里给，
     这张提醒窗只回答「要不要支持作者」这一个问题，按钮下面不再挂任何链接。 */
  it('按钮下面不再有 Star 出口：这张纸只问一个问题', () => {
    void openSupportPrompt();
    expect(card()?.querySelector('.bz-sup-star, .bz-sup-star-link')).toBeNull();
    expect(card()?.querySelectorAll('a').length).toBe(0);
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

/* 发版 review #4：这是模态窗，Tab 不能跑到它后面那扇更新日志窗里。 */
describe('支持作者提醒 · 焦点圈闭', () => {
  it('打开即落焦窗内首个按钮，Tab 从末项绕回首项', () => {
    void openSupportPrompt();
    const popup = document.querySelector<HTMLElement>('.bz-overlay-popup.bz-sup-modal')!;
    const first = popup.querySelector<HTMLElement>('.bz-sup-later')!;
    expect(popup.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(first);

    const last = popup.querySelector<HTMLElement>('.bz-sup-go')!;
    last.focus();
    popup.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first);
  });
});
