/**
 * 首页 → 行为 → 「关闭后回到首页」接线测试（2026-11-10 用户拍板，GitHub issue #2 补充答复）：
 *  - 开关开：从首页点入口 → 首页让位 → 功能主面板关闭 → 首页回来；
 *  - 开关关（默认）：同样的操作不回首页；
 *  - 直接打开功能（不经过首页）→ 不触发回首页。
 * core 侧逻辑另有 tests/core/home-return.test.ts；这里只验 home 域的 arm 接线与主面板定位。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { openHome, unloadHome } from '../../src/home';
import { resetHomeState, H } from '../../src/home/state';
import { disarmHomeReturn } from '../../src/core/home-return';
import { MAIN_PANEL_CLASS } from '../../src/core/ui/main-panel';

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

let vault: MockVault;
let app: any;

/** 假功能面板：模拟任意域「打开即建主面板」的最小形态 */
function fakeDomainPanel(id: string): HTMLElement {
  const p = document.createElement('div');
  p.className = `bz-panel-overlay ${MAIN_PANEL_CLASS}`;
  p.style.zIndex = '1001';
  p.dataset.fakeDomain = id;
  document.body.appendChild(p);
  return p;
}

function makeApp(): any {
  const a = mockAppWithVault(vault) as any;
  a.__executed = [] as string[];
  a.commands = {
    listCommands: () => [],
    executeCommandById: (id: string) => {
      a.__executed.push(id);
      fakeDomainPanel(id);
    },
  };
  return a;
}

async function clickEntry(id: string): Promise<void> {
  const row = await waitEntry(id);
  row.click();
}

async function waitEntry(id: string): Promise<HTMLElement> {
  for (let i = 0; i < 100; i++) {
    const el = document.querySelector<HTMLElement>(`[data-home-go="${id}"]`);
    if (el) return el;
    await wait(20);
  }
  throw new Error(`首页入口没渲染出来：${id}`);
}

beforeEach(() => {
  vault = new MockVault();
  setApp(mockAppWithVault(vault) as any);
  setSettingsProvider(() => ({
    ...DEFAULT_SETTINGS,
    storagePath: 'CONFIG/STORAGE',
    homeReturnAfterClose: false,
  }));
  resetHomeState();
  disarmHomeReturn();
  app = makeApp();
});

afterEach(() => {
  disarmHomeReturn();
  unloadHome();
  document.body.innerHTML = '';
});

describe('首页「关闭后回到首页」', () => {
  it('开关开：从首页进入 → 功能关闭 → 首页回来', async () => {
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, storagePath: 'CONFIG/STORAGE', homeReturnAfterClose: true }));
    openHome(app);
    await waitEntry('favorites');
    expect(H.overlayVisible).toBe(true);

    await clickEntry('favorites');
    expect(app.__executed).toContain('bz-favorites-open');
    expect(H.overlayVisible).toBe(false); // 首页让位

    document.querySelectorAll(`.${MAIN_PANEL_CLASS}`).forEach((el) => el.remove()); // 关掉功能
    await wait(400);
    expect(H.overlayVisible).toBe(true); // 首页回来
  });

  it('开关关（默认）：同样的操作不回首页', async () => {
    openHome(app);
    await waitEntry('favorites');
    await clickEntry('favorites');
    expect(H.overlayVisible).toBe(false);
    document.querySelectorAll(`.${MAIN_PANEL_CLASS}`).forEach((el) => el.remove());
    await wait(400);
    expect(H.overlayVisible).toBe(false);
  });

  it('直接打开功能（不经首页）：没有上膛，关闭时不会被拉出首页', async () => {
    // 首页没开，直接开一个功能（命令/快捷键路径）
    const panel = fakeDomainPanel('bz-memo-open');
    await wait(100);
    panel.remove();
    await wait(300);
    expect(document.querySelector('.bz-home-overlay')).toBeNull(); // 首页从未被创建
  });
});
