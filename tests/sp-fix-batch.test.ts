/**
 * 设置面板深审修复批回归（交互收编面）：
 * - F-2 移除聚焦输入框前 flush 防抖（↑↓ 切域不丢防抖窗口文本）；
 * - E-3 打开面板 firstFocusable 初始焦点（键盘流第一步可达）；
 * - E-2 「重置本域」确认弹窗 danger 反焦（破坏性动作不默认持焦）；
 * - F-5 重置批写落盘失败不假成功（人话提示，成功提示跳过）；
 * - C-4 域加载失败收编 notifyActionError+onRetry（非 Error 抛出物不再显示 "undefined"）+ 空态重试钮；
 * - E-6 移动端域页「重置本域」入口；
 * - C-5 registerPanelEsc 幂等样板（open→cleanup→open 不重复注册）；
 * - E-8/ARCH-2 schemaLoader 会话级缓存 + preloadAllBadges 单飞收敛；
 * - ARCH-4 「数据体检」按钮锚点断言（落在「数据存储路径」组卡内，防 core 改组名静默落尾）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks, hasNotice, clearNotices, getNoticeMessages } from './mock-obsidian-entry';
import { setSettingsProvider, setSettingsSaver } from '../src/core/settings-provider';
import { setApp } from '../src/core/app';
import { MockVault } from './mock-vault';
import { SettingsPanelUI, DOMAINS } from '../src/settings-panel/ui';
import { escManager, registerPanelEsc, unregisterPanelEsc } from '../src/core/esc-manager';

// mock Platform.isMobile 切换（E-6 移动端推入页用例）
let mobileFlag = false;
vi.mock('obsidian', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return {
    ...mod,
    Platform: {
      get isMobile() {
        return mobileFlag;
      },
    },
  };
});

const flush = () => new Promise((r) => setTimeout(r, 5));

/** 等待谓词成立（动态 import/批写链路轮询） */
async function waitFor(fn: () => boolean, ms = 4000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error('waitFor 超时');
}

async function waitGroups(container: HTMLElement, min: number): Promise<boolean> {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (container.querySelectorAll('.bz-sp-group').length >= min) return true;
    await new Promise((r) => setTimeout(r, 30));
  }
  return false;
}

describe('面板交互收编回归', () => {
  let state: Record<string, unknown>;
  let saver: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    mobileFlag = false;
    resetObsidianMocks();
    document.body.innerHTML = '';
    clearNotices();
    state = {};
    saver = vi.fn(async () => {});
    setSettingsProvider(() => state as any);
    setSettingsSaver(saver);
    setApp({ vault: new MockVault(), workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  });

  it('F-2：切域移除聚焦输入框前 flush 防抖——防抖窗口内编辑不丢失', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 第二大脑「Ollama 本地 URL」text 行（键直绑，默认可见）
    const sbItem = [...popup.querySelectorAll('.bz-sp-nav-item')].find((el) => el.textContent?.includes('第二大脑')) as HTMLElement;
    sbItem.click();
    expect(await waitGroups(popup, 1)).toBe(true);
    const rows = [...popup.querySelectorAll<HTMLElement>('.bz-sp-set-row')];
    const row = rows.find((r) => r.querySelector('.bz-sp-set-name')?.textContent === 'Ollama 本地 URL')!;
    const input = row.querySelector<HTMLInputElement>('input.bz-input')!;
    // 编辑（不 blur、不等防抖到期）→ 直接点导航切域（renderDomain 移除聚焦元素）
    input.focus();
    input.value = 'http://127.0.0.1:11434';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const otherItem = [...popup.querySelectorAll('.bz-sp-nav-item')].find((el) => el.textContent?.includes('番茄钟')) as HTMLElement;
    otherItem.click();
    await waitFor(() => saver.mock.calls.length > 0);
    // 修复前：输入框随 innerHTML='' 移除不派发 blur → commit 永不执行 → 静默丢字
    expect(state.secondBrainOllamaUrl).toBe('http://127.0.0.1:11434');
    ui.cleanup();
  });

  it('E-3：打开面板初始焦点落在头行搜索框（firstFocusable 圈定）', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    expect(document.activeElement).toBe(search);
    ui.cleanup();
  });

  it('E-2：重置确认弹窗 danger 反焦——popup 挂 danger 修饰，焦点不落在「重置」钮', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(await waitGroups(popup, 1)).toBe(true);
    (popup.querySelector('.bz-sp-page-reset') as HTMLElement).click();
    await flush();
    const dialog = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.classList.contains('bz-flow-dialog--danger'), 'danger 反焦修饰类').toBe(true);
    expect(document.activeElement!.id).toBe('__shared_confirm_cancel__'); // 焦点反落取消
    ui.cleanup();
  });

  it('F-5：重置批写落盘失败 → 人话提示不假成功（成功提示跳过）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(await waitGroups(popup, 1)).toBe(true);
    (popup.querySelector('.bz-sp-page-reset') as HTMLElement).click();
    await flush();
    saver.mockRejectedValueOnce(new Error('disk full'));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await waitFor(() => hasNotice(/保存失败（重置「通用」）：disk full/));
    expect(getNoticeMessages().some((m) => m.includes('已重置'))).toBe(false);
    ui.cleanup();
  });

  it('C-4：域加载失败收编 notifyActionError（非 Error 抛出物不显示 undefined）+ 空态重试钮', async () => {
    const memo = DOMAINS.find((d) => d.id === 'memo')!;
    const original = memo.schemaLoader;
    memo.schemaLoader = () => Promise.reject('boom-plain');
    try {
      const ui = new SettingsPanelUI();
      ui.open();
      const popup = document.getElementById('bz-settings-panel-popup')!;
      const memoItem = [...popup.querySelectorAll('.bz-sp-nav-item')].find((el) => el.textContent?.includes('备忘录')) as HTMLElement;
      memoItem.click();
      await waitFor(() => !!popup.querySelector('.bz-empty-title'));
      expect(popup.querySelector('.bz-empty-title')?.textContent).toBe('加载失败');
      // 非 Error 抛出物原文出现（修复前走 (e as Error).message → "undefined"）
      expect(hasNotice(/加载「备忘录」设置失败：boom-plain，请重试/)).toBe(true);
      expect(getNoticeMessages().some((m) => m.includes('undefined'))).toBe(false);
      // 空态下沿重试钮 → loader 恢复后重渲成功
      const retryBtn = popup.querySelector('.bz-sp-load-retry button') as HTMLElement;
      expect(retryBtn).toBeTruthy();
      memo.schemaLoader = original;
      retryBtn.click();
      const body = popup.querySelector('.bz-sp-settings-body') as HTMLElement;
      expect(await waitGroups(body, 1)).toBe(true);
      ui.cleanup();
    } finally {
      memo.schemaLoader = original;
    }
  });

  it('C-5：open→cleanup→open 的 ESC 注册走幂等样板（同 id 不重复注册）', () => {
    const spy = vi.spyOn(escManager, 'register');
    const ui = new SettingsPanelUI();
    ui.open();
    ui.cleanup();
    ui.open();
    const panelRegs = spy.mock.calls.filter((args) => args[0] === 'bz-settings-panel');
    expect(panelRegs.length).toBe(2); // 每次 build 恰好一次（cleanup 注销后才允许再注册）
    spy.mockRestore();
    ui.cleanup();
    // registerPanelEsc 幂等守卫：同 id 已注册时静默跳过；注销后可再注册
    const spy2 = vi.spyOn(escManager, 'register');
    registerPanelEsc('bz-sp-c5-test', () => true, () => {});
    registerPanelEsc('bz-sp-c5-test', () => true, () => {});
    expect(spy2.mock.calls.filter((a) => a[0] === 'bz-sp-c5-test').length).toBe(1);
    unregisterPanelEsc('bz-sp-c5-test');
    registerPanelEsc('bz-sp-c5-test', () => true, () => {});
    expect(spy2.mock.calls.filter((a) => a[0] === 'bz-sp-c5-test').length).toBe(2);
    unregisterPanelEsc('bz-sp-c5-test');
    spy2.mockRestore();
  });

  it('E-6：移动端推入域页挂「重置本域」入口，点击走 flow 确认', async () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const item = [...popup.querySelectorAll('.bz-sp-mob-item')].find((el) => el.textContent?.includes('番茄钟')) as HTMLElement;
    item.click();
    await waitFor(() => popup.classList.contains('bz-sp-mob-pushed') && popup.querySelectorAll('.bz-sp-mob-page-body .bz-sp-group').length >= 1);
    const resetBtn = popup.querySelector('[data-sp-mob-tools="domain"] .bz-icon-btn') as HTMLElement;
    expect(resetBtn, '域页工具位挂重置钮').toBeTruthy();
    expect(resetBtn.title).toBe('重置本域');
    expect(resetBtn.classList.contains('bz-touch-target'), '触控热区（UI-4）').toBe(true);
    resetBtn.click();
    await flush();
    expect(document.getElementById('__shared_confirm_popup__'), 'flow 确认弹窗在移动端可用').toBeTruthy();
    ui.cleanup();
  });
});

describe('面板生命周期与会话缓存（ARCH-2 / E-8 / ARCH-4）', () => {
  beforeEach(() => {
    mobileFlag = false;
    resetObsidianMocks();
    document.body.innerHTML = '';
    clearNotices();
    setSettingsProvider(() => ({}) as any);
    setSettingsSaver(async () => {});
    setApp({ vault: new MockVault(), workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  });

  it('E-8/ARCH-2：会话内 loader 只跑一次（预载/软重开共享），cleanup 后新会话重跑', async () => {
    const memo = DOMAINS.find((d) => d.id === 'memo')!;
    const original = memo.schemaLoader!;
    const spy = vi.fn(original);
    memo.schemaLoader = spy as typeof memo.schemaLoader;
    try {
      const ui = new SettingsPanelUI();
      ui.open();
      // 等 preload 全量完成（memo 徽标回填）
      const popup = document.getElementById('bz-settings-panel-popup')!;
      const memoBadge = () =>
        ([...popup.querySelectorAll<HTMLElement>('.bz-sp-nav-item')].find((el) => el.dataset.spDomain === 'memo')
          ?.querySelector('.bz-sp-nav-count')?.textContent) || '';
      await waitFor(() => memoBadge() !== '·');
      expect(spy).toHaveBeenCalledTimes(1);
      // 软重开（并发 open）：单飞复用同一轮 + 会话缓存 → loader 不重跑
      ui.open();
      ui.open();
      await new Promise((r) => setTimeout(r, 80));
      expect(spy).toHaveBeenCalledTimes(1);
      ui.cleanup();
      // cleanup 清空会话缓存 → 新实例新会话重跑（H9 新鲜度语义保持）
      const ui2 = new SettingsPanelUI();
      ui2.open();
      await waitFor(() => spy.mock.calls.length >= 2);
      ui2.cleanup();
    } finally {
      memo.schemaLoader = original;
    }
  });

  it('ARCH-4：「数据体检」按钮落在「数据存储路径」组卡内（中文组名锚点防漂移）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(await waitGroups(popup, 2)).toBe(true);
    const checkBtn = [...popup.querySelectorAll<HTMLElement>('.bz-sp-set-row')].find(
      (r) => r.querySelector('.bz-sp-set-name')?.textContent === '数据体检'
    );
    expect(checkBtn, '「数据体检」按钮行存在').toBeTruthy();
    const groupName = checkBtn!.closest('.bz-sp-group')?.querySelector('.bz-sp-group-name')?.textContent;
    expect(groupName).toBe('数据存储路径');
    ui.cleanup();
  });
});
