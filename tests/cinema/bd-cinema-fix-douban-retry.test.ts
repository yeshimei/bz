/**
 * 影院深审拍板修复批回归（呈报#23 / C4）：豆瓣抓取失败通知挂「重试」动作——
 * 一键清会话去重标记重新入队，替代「重启 Obsidian（重载插件）」三步以上的恢复路径。
 * 风/普通两份失败通知各有「重试」；笔记已删的条目跳过并如实说明；重复点击不重复入队。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import {
  sweepDoubanFetch,
  shutdownDoubanQueue,
  configureFetchQueue,
  isFetching,
  type FetchNote,
} from '../../src/cinema/douban-queue';
import type { DoubanFetchOutcome } from '../../src/cinema/douban-fetcher';

const settle = () => new Promise((r) => setTimeout(r, 25));
const TEST_HOOKS = { gapMs: 0, refreshDelayMs: 0 };
const okOutcome = (): DoubanFetchOutcome => ({ ok: true });

/** 通知上的动作按钮（core notice action：span.bz-notice-action） */
function noticeActions(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.bz-notice-action')) as HTMLElement[];
}

function retryButtons(): HTMLElement[] {
  return noticeActions().filter((b) => b.textContent === '重试');
}

beforeEach(() => {
  resetObsidianMocks();
  resetCinemaState();
  shutdownDoubanQueue();
  clearNotices();
  M.folderPath = '我的/影视';
  document.body.innerHTML = '';
});

afterEach(() => {
  shutdownDoubanQueue();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('呈报#23（C4）：豆瓣失败通知「重试」', () => {
  it('失败通知挂「重试」按钮：点击清去重标记重新入队，本轮即可抓成（不必重启重载）', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《小众片A》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    rebuildItems(app);
    let fails = true;
    const fetch: FetchNote = async (file) => {
      if (fails) return { ok: false, reason: 'network' };
      const content = vault.files.get(file.path) ?? '';
      vault.files.set(file.path, `${content.replace(/\n*$/, '\n')}海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n`);
      return okOutcome();
    };
    configureFetchQueue({ ...TEST_HOOKS, fetch });

    sweepDoubanFetch(app);
    await settle();
    expect(getNoticeMessages().some((m) => m.includes('豆瓣信息获取失败'))).toBe(true);
    expect(retryButtons()).toHaveLength(1); // 失败通知带「重试」动作（修复前无）

    fails = false; // 网络恢复
    retryButtons()[0].click();
    await settle();
    expect(isFetching('我的/影视/《小众片A》.md')).toBe(false); // 重试已跑完
    expect(vault.files.get('我的/影视/《小众片A》.md')).toContain('豆瓣链接'); // 本轮真抓成了
    expect(getNoticeMessages().some((m) => m.includes('已重新入队'))).toBe(true);
  });

  it('风控与一般失败两份通知各挂「重试」；点击只重入队各自轮次的条目', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《风控片》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    vault.files.set('我的/影视/《普通失败片》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    rebuildItems(app);
    const fetched: string[] = [];
    configureFetchQueue({
      ...TEST_HOOKS,
      fetch: async (file) => (file.name.includes('风控') ? { ok: false, reason: 'blocked' } : { ok: false, reason: 'notfound' }),
    });

    sweepDoubanFetch(app);
    await settle();
    expect(retryButtons()).toHaveLength(2); // 风/普通各一份通知，各带「重试」

    configureFetchQueue({
      ...TEST_HOOKS,
      fetch: async (file) => {
        fetched.push(file.path);
        return okOutcome();
      },
    });
    // 点风控通知的重试：只重新入队风控那一枚（本轮条目消费即出列）
    retryButtons()[0].click();
    await settle();
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toContain('风控片');
    expect(getNoticeMessages().some((m) => m.includes('已重新入队 1 部'))).toBe(true);
  });

  it('笔记已删的条目重试时跳过（去重标记对齐审计#12 清掉）；全部不可重试时如实说明', async () => {
    const vault = new MockVault();
    vault.files.set('我的/影视/《临别删除》.md', '---\ntags: [电影]\n评分: 8\n海报: CONFIG/MOVIE POSTER/a.jpg\n---');
    const app = mockAppWithVault(vault);
    M.appRef = app;
    rebuildItems(app);
    let calls = 0;
    configureFetchQueue({ ...TEST_HOOKS, fetch: async () => { calls++; return { ok: false, reason: 'notfound' }; } });

    sweepDoubanFetch(app);
    await settle();
    expect(retryButtons()).toHaveLength(1);
    vault.files.delete('我的/影视/《临别删除》.md'); // 失败后、重试前被删
    retryButtons()[0].click();
    await settle();
    expect(calls).toBe(1); // 不重复请求已删笔记
    expect(getNoticeMessages().some((m) => m.includes('没有可重试的影片'))).toBe(true);
  });
});
