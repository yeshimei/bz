/**
 * issue 291：全域子弹窗统一 —— memo 确认框随面板皮肤。
 *
 * 前情（缺陷）：编辑 / 添加场景 / 重命名三个 uiModal 弹窗早已传 `skinClass()`，
 * 但「删除场景」等 openFlowDialog 确认框漏传 —— 弹窗挂 body 后掉回 core 裸皮，
 * 同一域里「表单弹窗有皮、确认框没皮」。
 * 本用例守护：确认框带皮肤类，且 popup 同时带统一壳类（与 uiModal 同壳）。
 * 口径更新（memo2-consistency 旧-2 / B7 全局删除口径）：**条目删除已免确认直达
 * notifyUndo**，唯一保留的确认框 = 删除场景（批量迁移 + 写设置串影响面大且无撤销链，
 * 旧-2 明文区分），皮肤断言随之改走该框。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel } from '../../src/memo/ui';
import { MemoData } from '../../src/memo/data';
import { resetSkinPackState } from '../../src/core/skin-pack';
import { seedRemoteSkins } from '../skin-pack-helpers';

vi.mock('../../src/settings-panel', () => ({ openSettingsPanel: vi.fn() }));

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoAutoArchive: true,
  cinemaFolderPath: '我的/影视',
};

function seed(skin?: string): { app: ReturnType<typeof mockAppWithVault>; settings: any } {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([
    { id: 'a', title: '待删条目', scene: '学习', priority: 'minor', created: '2026-09-01 10:00:00', completed: null, due: null },
    // 自定义场景（默认场景禁删，issue 200）——删除场景确认框（唯一保留确认的流程框）用
    { id: 'g', title: '副业条目', scene: '副业', priority: 'minor', created: '2026-09-01 11:00:00', completed: null, due: null },
  ], null, 2));
  const settings: any = { ...SETTINGS, memoScenarios: '剪藏,工作,学习,生活,代码,公开课,副业' };
  if (skin) settings.memoSkin = skin; // 不传 = skinClass() 返回 ''（测试基线）
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings);
  return { app, settings };
}

/** 在浮层菜单里按文案点菜单项 */
function clickMenuItem(label: string): void {
  const hit = ([...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[])
    .find((b) => b.querySelector('.bz-item-menu-label')?.textContent === label);
  expect(hit, `菜单项「${label}」应存在`).toBeTruthy();
  (hit as HTMLElement).click();
}

/** 打开面板 → 右键场景 → 点「删除场景」→ 等确认框 */
async function openSceneDeleteConfirm(): Promise<HTMLElement> {
  const navBtn = document.querySelector('[data-memo-nav] [data-memo-scene="副业"]') as HTMLElement;
  expect(navBtn).toBeTruthy();
  navBtn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
  await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
  clickMenuItem('删除场景');
  await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
  return document.getElementById('__shared_confirm_popup__') as HTMLElement;
}

describe('memo 确认框随皮肤（issue 291；条目删除已免确认，唯一保留 = 删除场景）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
    resetSkinPackState();
  });
  afterEach(() => {
    closeMemoPanel();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
  });

  it('paper 皮肤：确认框挂 bz-overlay-popup + bz-flow-dialog + bz-memo-skin-paper（与编辑弹窗同壳同皮）', async () => {
    seedRemoteSkins('memo', ['paper']); // paper 远端化：就绪后才挂得上（ADR-0199）
    const { app } = seed('paper');
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-nav] [data-memo-scene="副业"]')).toBeTruthy());
    const popup = await openSceneDeleteConfirm();
    expect(popup.classList.contains('bz-overlay-popup')).toBe(true); // 统一壳（issue 291 核心）
    expect(popup.classList.contains('bz-flow-dialog')).toBe(true);
    expect(popup.classList.contains('bz-memo-skin-paper')).toBe(true);
    expect(popup.classList.contains('bz-flow-dialog--danger')).toBe(true); // 删除 = 危险主动作
    expect(popup.querySelector('h4')?.textContent).toBe('删除场景');
  });

  it('editorial 皮肤：确认框跟着换成 bz-memo-skin-editorial（皮肤类由 settings 驱动，非硬编码）', async () => {
    const { app } = seed('editorial');
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-nav] [data-memo-scene="副业"]')).toBeTruthy());
    const popup = await openSceneDeleteConfirm();
    expect(popup.classList.contains('bz-memo-skin-editorial')).toBe(true);
    expect(popup.classList.contains('bz-memo-skin-paper')).toBe(false);
  });

  it('皮肤未设置：回落编辑部（与 applyMemoSkin 同口径，绝不因缺省掉回 core 裸皮）', async () => {
    const { app } = seed();
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('[data-memo-nav] [data-memo-scene="副业"]')).toBeTruthy());
    const popup = await openSceneDeleteConfirm();
    expect(popup.classList.contains('bz-overlay-popup')).toBe(true);
    expect(popup.classList.contains('bz-memo-skin-editorial')).toBe(true); // 面板回落编辑部 → 弹窗同皮
  });

  it('条目删除免确认（旧-2 / B7 口径）：右键删除不弹确认框，直达删除 + 撤销通知', async () => {
    const { app } = seed('paper');
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="a"]')).toBeTruthy());
    const card = document.querySelector('.bz-memo-card[data-memo-id="a"]') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    clickMenuItem('删除');
    await vi.waitFor(() => {
      const undo = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销');
      expect(undo).toBeTruthy(); // 直接出撤销通知
    });
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull(); // 无确认框
  });
});
