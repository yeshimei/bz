/**
 * 剪藏本设置弹窗「数据源」组测试（ticket 124，ADR-0060）：
 * news.json 缺失 → 引导块；存在 → 三源开关 + UP 名单 + 保留天数 + 状态行；
 * 自动摘要详设展开（长度档位/标签开关/时机）。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import {
  resetObsidianMocks, clearNotices, Platform as MockPlatform,
} from '../mock-obsidian-entry';
import { initArticleView, applyArticleSettings, unloadClipping } from '../../src/clipping/view';

const NEWS = 'CONFIG/STORAGE/news.json';

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {
      getFileCache: () => null,
      getBacklinksForFile: () => ({ data: new Map() }),
    },
    workspace: { openLinkText: vi.fn(), executeCommandById: vi.fn() },
    commands: { executeCommandById: vi.fn() },
  } as any;
}

const SETTINGS = {
  articleDirectory: '我的/文章',
  articleBatchSize: '5',
  autoSummaryEnabled: true, // ticket 124：开 → 详设可见
  autoSummaryLength: 'standard',
  autoSummaryTagsEnabled: true,
  autoSummaryTagCount: '3-6',
  autoSummaryTiming: 'immediate',
  newsRetentionSavedDays: '3',
  newsRetentionSkippedDays: '7',
};

async function setup(withNewsJson: boolean) {
  resetObsidianMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  clearNotices();
  const vault = new MockVault();
  vault.files.set('我的/文章/A.md', makeClip('https://x.com/a', '站', 'A', '2025-06-02T08:00:00.000Z'));
  if (withNewsJson) {
    vault.files.set(NEWS, JSON.stringify({
      articles: [{ title: 'B站视频', url: 'https://www.bilibili.com/video/BV1xx', platform: 'B站', author: 'UP主', date: '2026-08-26 10:00:00', fetchedAt: '2026-08-26 12:00:00' }],
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: ['546195'],
      sources: { zhihu: true, guokr: true, bilibili: true },
    }));
  }
  const app = makeApp(vault);
  setApp(app);
  setSettingsProvider(() => SETTINGS as any);
  applyArticleSettings();
  return { vault, app };
}

function makeClip(url: string, site: string, title: string, created: string) {
  return `---
url: "${url}"
author: "甲"
site: "${site}"
summary: "摘要"
tags: ["AI"]
created: ${created}
---

# ${title}

正文内容
`;
}

async function openSettings(): Promise<HTMLElement> {
  await initArticleView(true);
  await new Promise((r) => setTimeout(r, 20));
  const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '剪藏本设置')!;
  settingsBtn.click();
  const popup = document.getElementById('bz-settings-modal-popup')!;
  await new Promise((r) => setTimeout(r, 50)); // 数据源组异步加载
  return popup;
}

/** 按 dataset.name 找 setting 行 */
function findSetting(popup: HTMLElement, name: string): HTMLElement {
  const item = [...popup.querySelectorAll('.setting-item')].find(
    (el) => (el as HTMLElement).dataset.name === name
  ) as HTMLElement | undefined;
  if (!item) throw new Error(`setting not found: ${name}`);
  return item;
}

/** 断言元素存在（找到即通过，找不到抛错） */
function expectSetting(popup: HTMLElement, name: string): HTMLElement {
  const item = [...popup.querySelectorAll('.setting-item')].find(
    (el) => (el as HTMLElement).dataset.name === name
  ) as HTMLElement | undefined;
  expect(item, `setting exists: ${name}`).toBeDefined();
  return item!;
}

function toggleOf(item: HTMLElement): any {
  return (item as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
}

async function flushDom(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('剪藏本设置「数据源」组', () => {
  afterEach(() => {
    unloadClipping();
    document.body.innerHTML = '';
  });

  it('news.json 缺失 → 引导块（显示安装说明 + 复制按钮），无开关/名单行', async () => {
    await setup(false);
    const popup = await openSettings();
    const guide = expectSetting(popup, '尚未启用新闻数据源');
    const setting = (guide as any).__setting;
    expect(setting.desc).toContain('obsidian-news');
    expect(setting.desc).toContain('安装');
    // 按钮：复制安装命令
    const copyBtn = setting.controls.find((c: any) => c.text === '复制安装命令');
    expect(copyBtn).toBeDefined();
    // 无设置项行（开关/名单/保留/状态）
    expect(popup.textContent).not.toContain('UP 主名单');
    expect(popup.textContent).not.toContain('已保存文章保留天数');
    expect(popup.textContent).not.toContain('抓取状态');
  });

  it('news.json 存在 → 三源开关/UP 名单/保留天数/状态行全部出现', async () => {
    await setup(true);
    const popup = await openSettings();
    expectSetting(popup, '知乎日报');
    expectSetting(popup, '果壳科学人');
    expectSetting(popup, 'B站 UP 主');
    expectSetting(popup, 'UP 主名单');
    const upRow = popup.querySelector<HTMLElement>('[data-up-row]');
    expect(upRow).not.toBeNull();
    expect(upRow!.dataset.upRow).toBe('1');
    expect((upRow as any).__setting.name).toBe('UP 546195');
    expectSetting(popup, '已保存文章保留天数');
    expectSetting(popup, '已跳过文章保留天数');
    const status = expectSetting(popup, '抓取状态');
    expect((status as any).__setting.desc).toContain('1 位 UP 主');
    expect((status as any).__setting.desc).toContain('1 篇');
  });

  it('B 站源开关关闭 → UP 名单行隐藏（联动）；再开恢复', async () => {
    await setup(true);
    const popup = await openSettings();
    const bili = findSetting(popup, 'B站 UP 主');
    const toggle = toggleOf(bili);
    toggle.trigger(false);
    await flushDom();
    const upRows = popup.querySelectorAll('[data-up-row]');
    expect(upRows.length).toBeGreaterThanOrEqual(1);
    // 关闭后名单行内联隐藏（style.display none）
    upRows.forEach((r) => expect((r as HTMLElement).style.display).toBe('none'));
    toggle.trigger(true);
    await flushDom();
    popup.querySelectorAll('[data-up-row]').forEach((r) => expect((r as HTMLElement).style.display).not.toBe('none'));
  });

  it('UP 名单删除：点移除 → 名单行消失，news.json bilibiliUps 更新', async () => {
    const { vault } = await setup(true);
    const popup = await openSettings();
    const row = popup.querySelector<HTMLElement>('[data-up-row]')!;
    const deleteBtn = (row as any).__setting.controls.find((c: any) => c.isExtraButton);
    expect(deleteBtn).toBeDefined();
    deleteBtn.trigger();
    await flushDom();
    await new Promise((r) => setTimeout(r, 20)); // 冲刷写回
    expect(popup.querySelector('[data-up-row]')).toBeNull();
    const disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliUps).toEqual([]);
  });

  it('自动摘要详设：开关开 → 长度/标签/时机三项可见；关 → 隐藏', async () => {
    await setup(false);
    const popup = await openSettings();
    // SETTINGS.autoSummaryEnabled=true → 详设行可见
    expectSetting(popup, '摘要长度');
    expectSetting(popup, '生成标签');
    expectSetting(popup, '摘要时机');
    // 关掉自动摘要 → 详设容器隐藏
    const auto = findSetting(popup, '自动摘要');
    const toggle = toggleOf(auto);
    toggle.trigger(false);
    await flushDom();
    const detail = popup.querySelector<HTMLElement>('.auto-summary-detail');
    expect(detail!.style.display).toBe('none');
    toggle.trigger(true);
    await flushDom();
    expect(detail!.style.display).not.toBe('none');
  });
});