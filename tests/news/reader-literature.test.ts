/**
 * 聚合讯「保存至文献」测试（ticket 134，ADR-0067）：
 * B站视频条目底栏按钮换「保存至文献」、点击改道文献盒入口（预填链接/标题/UP主）且
 * 不落剪藏/不标已读/不发 'news' 域事件；B站条目「下一篇」不发事件但统计照记；
 * 普通文章（果壳/知乎）原行为保留（ticket 123 跳过仍发）；url 缺失回退剪藏按钮。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
// 跨域入口 mock：reader 仅函数级 import openBiliAddTask（真实实现会拉起文献盒面板 DOM，
// 聚合讯侧只断言调用参数——面板自身行为由 tests/bili-downloader/* 覆盖）
vi.mock('../../src/bili-downloader', () => ({ openBiliAddTask: vi.fn() }));
import { openBiliAddTask } from '../../src/bili-downloader';
import { setApp } from '../../src/core/app';
import { loadArticles, loadStats, render, skipArticle, markAsRead, init } from '../../src/news/reader';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { onDomainEvent } from '../../src/core/domain-bus';

let newsSpy: import('vitest').Mock<(evt?: unknown) => void>;
let offNewsSpy: () => void = () => {};

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {},
    workspace: { openLinkText: vi.fn() },
  } as any;
}

const NEWS_JSON = [
  {
    title: 'B站视频一',
    url: 'https://www.bilibili.com/video/BV1xx411c7mD',
    platform: 'B站',
    author: 'UP主甲',
    date: '2025-06-10 09:00:00',
    summary: '简介',
    tags: ['视频'],
    body: '简介正文',
  },
  {
    title: '果壳文章',
    url: 'https://guokr.com/b',
    platform: '果壳',
    author: '乙',
    date: '2025-06-11 10:00:00',
    summary: '摘要',
    tags: ['科学'],
    body: '正文',
  },
];

// 测试内共享 vault 引用
let _vault: MockVault | null = null;
function getVault(): MockVault {
  return _vault!;
}

describe('聚合讯保存至文献（ticket 134）', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetObsidianMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({ articles: NEWS_JSON, stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} }, bilibiliUps: [], sources: { zhihu: true, guokr: true, bilibili: true } }));
    setApp(makeApp(vault));
    _vault = vault;
    newsSpy = vi.fn((_evt?: unknown) => {});
    offNewsSpy = onDomainEvent('news', (evt) => newsSpy(evt));
    init(false);
  });

  afterEach(() => {
    offNewsSpy();
    _vault = null;
  });

  it('B站条目：按钮「保存至文献」，点击改道文献盒预填（不落剪藏/不标已读/不发事件/留在本篇）', async () => {
    await loadArticles();
    render();
    const saveBtn = document.querySelector('[data-action="save"]')! as HTMLElement;
    expect(saveBtn.textContent).toContain('保存至文献');
    expect(saveBtn.textContent).not.toContain('剪藏');
    saveBtn.click();
    expect(openBiliAddTask).toHaveBeenCalledTimes(1);
    expect(openBiliAddTask).toHaveBeenCalledWith(expect.anything(), {
      url: 'https://www.bilibili.com/video/BV1xx411c7mD',
      title: 'B站视频一',
      uploader: 'UP主甲',
    });
    // 不发任何 'news' 域事件（不进小橘行为流）
    expect(newsSpy).not.toHaveBeenCalled();
    // 不落剪藏文件、不标已读（news.json 零写入）
    expect(getVault().files.get('归档/网页剪藏/B站视频一.md')).toBeUndefined();
    const saved = JSON.parse(getVault().files.get('CONFIG/STORAGE/news.json')!);
    expect(saved.articles[0].read).toBeFalsy();
    expect(saved.articles[0].state).toBeUndefined();
    // 阅读器留在本篇未读
    expect(document.querySelector('.news-card-title')!.textContent).toBe('B站视频一');
  });

  it('B站条目「下一篇」：不发 news 事件、统计照记、落盘 skipped 并切篇', async () => {
    await loadStats();
    await loadArticles();
    render();
    skipArticle();
    await new Promise((r) => setTimeout(r, 0));
    expect(newsSpy).not.toHaveBeenCalled(); // ADR-0067：B站条目跳过静音（部分推翻 ticket 123）
    const saved = JSON.parse(getVault().files.get('CONFIG/STORAGE/news.json')!);
    expect(saved.articles[0].read).toBe(true);
    expect(saved.articles[0].state).toBe('skipped');
    expect(saved.stats.totalSkipped).toBe(1);
    // 正常切到下一篇，且普通文章按钮仍「保存至剪藏」
    expect(document.querySelector('.news-card-title')!.textContent).toBe('果壳文章');
    expect(document.querySelector('[data-action="save"]')!.textContent).toContain('保存至剪藏');
  });

  it('普通文章「下一篇」仍发 read 事件（ticket 123 保留）', async () => {
    await loadStats();
    await loadArticles();
    render();
    skipArticle(); // B站条目：静音
    await new Promise((r) => setTimeout(r, 0));
    skipArticle(); // 果壳：发
    expect(newsSpy).toHaveBeenCalledTimes(1);
    expect(newsSpy).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'read',
      evt: expect.objectContaining({ title: '果壳文章', platform: '果壳', state: 'skipped' }),
    }));
  });

  it('B站条目 markAsRead("saved") 直接调用也不发事件（防御，正常路径不可达）', async () => {
    await loadArticles();
    render();
    markAsRead('saved');
    expect(newsSpy).not.toHaveBeenCalled();
  });

  it('B站条目 url 缺失回退「保存至剪藏」按钮，点击走剪藏保存（不进文献盒）', async () => {
    const vault = getVault();
    const data = JSON.parse(vault.files.get('CONFIG/STORAGE/news.json')!);
    data.articles[0].url = '';
    vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify(data));
    await loadArticles();
    render();
    expect(document.querySelector('[data-action="save"]')!.textContent).toContain('保存至剪藏');
    (document.querySelector('[data-action="save"]') as HTMLElement).click();
    await vi.waitFor(() => expect(vault.files.get('归档/网页剪藏/B站视频一.md')).toBeDefined());
    expect(openBiliAddTask).not.toHaveBeenCalled();
  });
});
