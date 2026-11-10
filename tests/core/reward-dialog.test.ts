// @vitest-environment jsdom
/**
 * 赞赏弹窗（core/reward-dialog.ts）。
 *
 * 2026-11-10 加第二行出口：「或者给个 Star」——不花钱的另一种支持，
 * 点开 GitHub 仓库（Star 在页面右上角）。这里钉三件事：
 *  - 两个去处都渲染出来，顺序是赞助在前、收藏在后；
 *  - 收藏那行指向本仓库（不是别处，也不是另一个 slug）；
 *  - 点它走系统浏览器（openExternalUrl），不是裸跳转。
 *
 * 版式、字号、纸面配色走真机，这里只管「有没有、指向哪、点了去哪」。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import type { App } from 'obsidian';
import { REPO_SLUG } from '../../src/core/remote-base';
import { buildRewardBody } from '../../src/core/reward-dialog';

const REPO_URL = `https://github.com/${REPO_SLUG}`;

/** 弹窗正文挂进 body：元素上的事件要能冒泡到 document 才有意义 */
function mount(): HTMLElement {
  const body = buildRewardBody([], () => undefined);
  document.body.appendChild(body);
  return body;
}

/** 两行出口的链接（赞助在前、收藏在后） */
function exitLinks(root: HTMLElement): HTMLAnchorElement[] {
  return [...root.querySelectorAll<HTMLAnchorElement>('a')];
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('两行出口', () => {
  it('赞助在前、收藏在后，文案各是各的', () => {
    const links = exitLinks(mount());
    expect(links.map((a) => a.textContent)).toEqual(['或者成为赞助人', '或者给个 Star']);
  });

  it('收藏那行指向本仓库', () => {
    const links = exitLinks(mount());
    expect(links[1]?.getAttribute('href')).toBe(REPO_URL);
  });
});

describe('点了去哪', () => {
  it('收藏入口：走系统浏览器，不是裸跳转', () => {
    const openUrl = vi.fn((_url: string) => Promise.resolve());
    setApp({ openUrl } as unknown as App);

    const star = exitLinks(mount())[1]!;
    star.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl.mock.calls[0]![0]).toBe(REPO_URL);
  });
});
