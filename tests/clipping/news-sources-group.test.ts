/**
 * 剪藏本设置弹窗「数据源」组测试（ticket 124，ADR-0060；ticket 126：UP 名单整段联动 +
 * 管理按钮独立弹窗 + 名字/头像回填展示）：
 * news.json 缺失 → 引导块；存在 → 三源开关 + UP 名单（按钮行）+ 保留天数 + 状态行；
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
      bilibiliUps: ['546195', '999999'],
      // ticket 126：后台抓到消息回填的 UP 主资料（缺资料 → 显示回退 uid）
      bilibiliUpInfo: { '546195': { name: '老番茄', avatar: 'https://i0.hdslb.com/bfs/face/a.jpg' } },
      // ticket 127：每 UP 最近 N 条（默认 10）+ Cookie 配置（空=自动引导）
      bilibiliMaxItems: 10,
      bilibiliCookie: '',
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

/** 点组内「管理」按钮打开 UP 主名单弹窗（返回弹窗节点） */
async function openUpManager(popup: HTMLElement): Promise<HTMLElement> {
  const upRow = findSetting(popup, 'UP 主名单');
  const manageBtn = (upRow as any).__setting.controls.find((c: any) => c.text === '管理');
  expect(manageBtn).toBeDefined();
  manageBtn.trigger();
  await new Promise((r) => setTimeout(r, 20));
  const modal = document.getElementById('bz-up-manager-popup')!;
  expect(modal).not.toBeNull();
  return modal;
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

  it('news.json 存在 → 三源开关/UP 名单按钮行/保留天数/状态行；名单行移入管理弹窗并显示名字头像', async () => {
    await setup(true);
    const popup = await openSettings();
    expectSetting(popup, '知乎日报');
    expectSetting(popup, '果壳科学人');
    expectSetting(popup, 'B站 UP 主');
    const upRow = findSetting(popup, 'UP 主名单');
    const upCtl = (upRow as any).__setting;
    // 按钮行 desc：名字预览（后台回填优先，无资料回退 uid）
    expect(upCtl.desc).toContain('老番茄');
    expect(upCtl.desc).toContain('UP 999999');
    expect(upCtl.controls.some((c: any) => c.text === '管理')).toBe(true);
    // 组内不再直接渲染名单行（已移入弹窗）
    expect(popup.querySelector('[data-up-row]')).toBeNull();
    expectSetting(popup, '已保存文章保留天数');
    expectSetting(popup, '已跳过文章保留天数');
    const status = expectSetting(popup, '抓取状态');
    expect((status as any).__setting.desc).toContain('2 位 UP 主');
    expect((status as any).__setting.desc).toContain('1 篇');
    // 弹窗列表：有资料 → 名字+头像；无资料 → uid 回退
    const modal = await openUpManager(popup);
    const rows = [...modal.querySelectorAll<HTMLElement>('[data-up-row]')];
    expect(rows.length).toBe(2);
    const withInfo = rows.find((r) => r.textContent!.includes('UID 546195'))!;
    expect(withInfo.textContent).toContain('老番茄');
    expect(withInfo.querySelector('.bz-up-manager-avatar')).not.toBeNull();
    const withoutInfo = rows.find((r) => r.textContent!.includes('UID 999999'))!;
    expect(withoutInfo.textContent).toContain('UP 999999');
    expect(withoutInfo.querySelector('.bz-up-manager-avatar')).toBeNull();
    // 点遮罩关闭弹窗：独立 overlay，设置弹窗保留
    (document.getElementById('bz-up-manager-mask') as HTMLElement).click();
    await flushDom();
    expect(document.getElementById('bz-up-manager-popup')).toBeNull();
    expect(document.getElementById('bz-settings-modal-popup')).not.toBeNull();
  });

  it('B 站源开关关闭 → 整个 UP 主名单段隐藏（含按钮行）；再开恢复', async () => {
    await setup(true);
    const popup = await openSettings();
    const section = popup.querySelector<HTMLElement>('[data-up-section]');
    expect(section).not.toBeNull();
    expect(section!.style.display).not.toBe('none');
    const bili = findSetting(popup, 'B站 UP 主');
    const toggle = toggleOf(bili);
    toggle.trigger(false);
    await flushDom();
    expect(section!.style.display).toBe('none');
    // 按钮行随整段隐藏：按钮仍在 DOM 但落在 display:none 的 [data-up-section] 内
    // （mock Setting 渲染真实 button DOM 后，textContent 会含隐藏文本，故按归属断言可见性）
    const manageBtn = [...popup.querySelectorAll('button')].find((b) => b.textContent === '管理');
    expect(manageBtn).toBeTruthy();
    expect(manageBtn!.closest('[data-up-section]')!).toBe(section);
    expect((manageBtn!.closest('[data-up-section]') as HTMLElement).style.display).toBe('none');
    toggle.trigger(true);
    await flushDom();
    expect(section!.style.display).not.toBe('none');
  });

  it('管理弹窗移除 UP 主：名单行消失、news.json 名单与资料同步更新、组内概要刷新', async () => {
    const { vault } = await setup(true);
    const popup = await openSettings();
    const modal = await openUpManager(popup);
    const row = [...modal.querySelectorAll<HTMLElement>('[data-up-row]')].find((r) => r.textContent!.includes('UID 546195'))!;
    row.querySelector<HTMLElement>('.bz-up-manager-remove')!.click();
    await new Promise((r) => setTimeout(r, 30)); // 冲刷删除写回 + onChanged 重读重绘
    expect(modal.querySelectorAll('[data-up-row]').length).toBe(1);
    const disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliUps).toEqual(['999999']);
    expect(disk.bilibiliUpInfo).toEqual({}); // 该 uid 资料一并清除
    const upCtl = (findSetting(popup, 'UP 主名单') as any).__setting;
    expect(upCtl.desc).not.toContain('老番茄');
    expect(upCtl.desc).toContain('UP 999999');
    expect(upCtl.desc).toContain('1 位');
  });

  it('管理弹窗添加 UP 主：解析 uid 入库、弹窗列表与组内概要同步刷新', async () => {
    const { vault } = await setup(true);
    const popup = await openSettings();
    const modal = await openUpManager(popup);
    const addRow = findSetting(modal, '添加 UP 主');
    const ctrls = (addRow as any).__setting.controls;
    const text = ctrls.find((c: any) => typeof c.trigger === 'function' && 'value' in c);
    const addBtn = ctrls.find((c: any) => c.text === '添加');
    text.trigger('888888'); // 纯数字 uid，本地解析无需网络
    addBtn.trigger();
    await new Promise((r) => setTimeout(r, 30));
    expect([...modal.querySelectorAll<HTMLElement>('[data-up-row]')].some((r) => r.textContent!.includes('UID 888888'))).toBe(true);
    const disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliUps).toEqual(['546195', '999999', '888888']);
    const upCtl = (findSetting(popup, 'UP 主名单') as any).__setting;
    expect(upCtl.desc).toContain('3 位');
  });

  it('B 站抓取条数（ticket 127）：默认 10 展示，修改落盘并夹取，随 B 站开关整段隐藏', async () => {
    const { vault } = await setup(true);
    const popup = await openSettings();
    const maxRow = findSetting(popup, 'B站抓取条数');
    const ctrls = (maxRow as any).__setting.controls;
    const text = ctrls.find((c: any) => typeof c.trigger === 'function' && 'value' in c);
    expect(text.value).toBe('10'); // 默认 10（fixture）
    text.trigger('5');
    await new Promise((r) => setTimeout(r, 30)); // 冲刷写回
    let disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliMaxItems).toBe(5);
    // 随 B 站源关闭整段隐藏（同 [data-up-section]，抓取条数行在其内一并隐藏）
    const bili = findSetting(popup, 'B站 UP 主');
    toggleOf(bili).trigger(false);
    await flushDom();
    const section = popup.querySelector<HTMLElement>('[data-up-section]')!;
    expect(section.style.display).toBe('none');
    expect(section.contains(findSetting(popup, 'B站抓取条数'))).toBe(true); // 行仍在该段内（段整体隐藏）
  });

  it('UP 弹窗 B 站 Cookie（ticket 127）：保存/清除落盘，状态文案联动，412 引导文案就位', async () => {
    const { vault } = await setup(true);
    const popup = await openSettings();
    const modal = await openUpManager(popup);
    const cookieRow = findSetting(modal, 'B 站 Cookie（可选）');
    const ctrls = (cookieRow as any).__setting.controls;
    expect((cookieRow as any).__setting.desc).toContain('412'); // 风控引导文案
    expect((cookieRow as any).__setting.desc).toContain('未配置');
    const text = ctrls.find((c: any) => typeof c.trigger === 'function' && 'value' in c);
    const saveBtn = ctrls.find((c: any) => c.text === '保存');
    const clearBtn = ctrls.find((c: any) => c.text === '清除');
    text.trigger('  SESSDATA=abc  ');
    saveBtn.trigger();
    await new Promise((r) => setTimeout(r, 30));
    let disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliCookie).toBe('SESSDATA=abc'); // 去空白落盘
    expect((cookieRow as any).__setting.desc).toContain('已配置');
    clearBtn.trigger();
    await new Promise((r) => setTimeout(r, 30));
    disk = JSON.parse(vault.files.get(NEWS)!);
    expect(disk.bilibiliCookie).toBe('');
    expect((cookieRow as any).__setting.desc).toContain('未配置');
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