// @vitest-environment jsdom
/**
 * 赞赏弹窗（core/reward-dialog.ts）。
 *
 * 2026-11-11 用户拍板：原来码下面两行「或者成为赞助人」「或者给个 Star」并成一行
 * 「成为赞助人 · 给个 Star」，两个入口各自可点、各去各的地址。这里钉四件事：
 *  - 两个去处都渲染在同一行里，顺序是赞助在前、收藏在后；
 *  - 赞助指向赞助商店、收藏指向本仓库（不是别处，也不是另一个 slug）；
 *  - 中间的点只是分隔符，不可点；
 *  - 点赞助、收藏都走系统浏览器（openExternalUrl），不是裸跳转。
 *
 * 版式、字号、纸面配色走真机，这里只管「有没有、指向哪、点了去哪」。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import type { App } from 'obsidian';
import { REPO_SLUG } from '../../src/core/remote-base';
import { buildRewardBody, SPONSOR_URL } from '../../src/core/reward-dialog';

const REPO_URL = `https://github.com/${REPO_SLUG}`;

/** 弹窗正文挂进 body：元素上的事件要能冒泡到 document 才有意义 */
function mount(): HTMLElement {
  const body = buildRewardBody([], () => undefined);
  document.body.appendChild(body);
  return body;
}

/** 出口行里的链接（赞助在前、收藏在后） */
function exitLinks(root: HTMLElement): HTMLAnchorElement[] {
  return [...root.querySelectorAll<HTMLAnchorElement>('.bz-rw-exits a')];
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('一行出口', () => {
  it('赞助在前、收藏在后，文案去掉「或者」', () => {
    const links = exitLinks(mount());
    expect(links.map((a) => a.textContent)).toEqual(['成为赞助人', '给个 Star']);
  });

  it('两个入口在同一行里，中间的点只作分隔、不是链接', () => {
    const row = mount().querySelector('.bz-rw-exits')!;
    expect(row).toBeTruthy();
    expect(row.querySelectorAll('a').length).toBe(2);
    const sep = row.querySelector('.bz-rw-exit-sep')!;
    expect(sep.textContent).toBe('·');
    expect(sep.tagName).not.toBe('A');
  });

  it('各自指向自己的地址', () => {
    const links = exitLinks(mount());
    expect(links[0]?.getAttribute('href')).toBe(SPONSOR_URL);
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

  it('赞助入口：也走系统浏览器，去的是赞助商店', () => {
    const openUrl = vi.fn((_url: string) => Promise.resolve());
    setApp({ openUrl } as unknown as App);

    const sponsor = exitLinks(mount())[0]!;
    sponsor.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl.mock.calls[0]![0]).toBe(SPONSOR_URL);
  });
});
