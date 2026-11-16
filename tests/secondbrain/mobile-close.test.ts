/**
 * 移动端引导 / 进度态的主面板没有关闭出口（2026-11-15 备忘录）：
 * 引导与进度态会把头行 `.bz-sb-panel-func` 整组收起（含那枚 ✕），而移动端全屏之后
 * 没有遮罩可点、没有键盘按 ESC —— 建索引界面等于只能杀进程。
 *
 * 口径：引导 / 进度态由一枚**独立类**的关闭钮（`#bz-sb-mb-close`，不挂 `.bz-sb-panel-func`）
 * 顶上；切回内容态时它让位给常规 ✕，两者不同时出现。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import BzSettings, { DEFAULT_SETTINGS } from '../../src/settings';
import { SecondBrainPanel } from '../../src/secondbrain/panel';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

function makeEnv() {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as BzSettings);
  return app;
}

/** 空库 fake store：未就绪、无在跑 → 打开即引导态 */
function makeEmptyStore(): any {
  return {
    initialLoad: Promise.resolve(),
    isIndexReady: () => false,
    isRefreshing: () => false,
    hasPendingChanges: () => false,
    needsModelRebuild: () => false,
    refresh: async () => {},
    meta: { notes: {}, _dim: 0 },
    vectors: [],
  };
}

/** 就绪库 fake store：无待处理 → 打开即内容态 */
function makeReadyStore(): any {
  return {
    ...makeEmptyStore(),
    isIndexReady: () => true,
    meta: { notes: {}, _dim: 2 },
  };
}

const mbClose = () => document.getElementById('bz-sb-mb-close') as HTMLElement | null;
const hidden = (el: HTMLElement | null) => !!el && el.classList.contains('bz-sb-btn-hidden');

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

describe('第二大脑 · 移动端引导/进度态的关闭出口', () => {
  it('引导态：专属关闭钮可见，点一下就关面板', async () => {
    const app = makeEnv();
    const panel = new SecondBrainPanel(app, makeEmptyStore(), { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    await vi.waitFor(() => expect(document.getElementById('bz-sb-onboard')?.style.display).toBe('flex'), { timeout: 1500 });

    const btn = mbClose();
    expect(btn, '引导态应有专属关闭钮').not.toBeNull();
    expect(hidden(btn), '引导态专属关闭钮不得被收起').toBe(false);
    // 常规 ✕ 仍按 ticket 107 收着（引导期头行功能钮整体让位）
    expect(hidden(document.getElementById('bz-sb-panel-close'))).toBe(true);

    btn!.click();
    expect((document.querySelector('.bz-sb-panel') as HTMLElement).style.display).toBe('none');
    panel.destroy();
  });

  it('内容态：专属关闭钮让位，只留常规 ✕（不出现两个关闭钮）', async () => {
    const app = makeEnv();
    const panel = new SecondBrainPanel(app, makeReadyStore(), { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    await vi.waitFor(() => expect(document.getElementById('bz-sb-content')?.style.display).toBe('flex'), { timeout: 1500 });

    expect(hidden(mbClose()), '内容态专属关闭钮应收起').toBe(true);
    expect(hidden(document.getElementById('bz-sb-panel-close')), '内容态常规 ✕ 应恢复').toBe(false);
    panel.destroy();
  });

  it('样式：默认不显示，只在手机宽度放出来（桌面零影响）', () => {
    const css = read('src/secondbrain/styles.css');
    expect(css).toMatch(/\.bz-sb-mb-close\s*\{[^}]*display:\s*none/);
    const mobile = css.slice(css.indexOf('@media (max-width: 768px)'));
    expect(mobile).toMatch(/\.bz-sb-mb-close\s*\{[^}]*display:\s*(inline-)?flex/);
  });
});
