/**
 * 使用手册 footer 入口测试（issue 473，UI 层）
 * 链路：设置面板侧栏 footer 入口（data-sp-manual，更新日志上方）→ 点击一键
 * （无手册先下载再打开，已下载直接打开）→ 下载期 .is-loading + 图标换 loader
 * 转圈（防重入），完成/失败复原图标；失败原因经 notice 出人话。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { SettingsPanelUI } from '../../src/settings-panel/ui';
import { unloadSettingsPanel } from '../../src/settings-panel';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

// mock Platform.isMobile 切换（与 changelog.test.ts 同口径；本入口仅桌面 footer）
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

const MANUAL_HTML = '<!DOCTYPE html><html><body>包仔手册</body></html>';
const STORED = '.obsidian/plugins/bz/bz-manual.html';

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

/** mock 桌面端 electron shell（openPath 空串=成功） */
function mockElectron(openPath: (p: string) => Promise<string>): void {
  (window as unknown as { require: (id: string) => unknown }).require = (id: string) => {
    if (id === 'electron') return { shell: { openPath } };
    throw new Error('module not found: ' + id);
  };
}

describe('使用手册 footer 入口（issue 473）', () => {
  let vault: MockVault;
  let openPath: ReturnType<typeof vi.fn<(p: string) => Promise<string>>>;

  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    mobileFlag = false;
    document.body.innerHTML = '';
    unloadSettingsPanel();
    setSettingsProvider(() => ({}) as any);
    vault = new MockVault();
    setApp({ vault, workspace: {} } as any);
    openPath = vi.fn<(p: string) => Promise<string>>(async () => '');
    mockElectron(openPath);
    vi.mocked(requestUrl).mockReset();
    vi.mocked(requestUrl).mockResolvedValue({ status: 200, text: MANUAL_HTML } as any);
  });

  it('入口在 footer：位于「更新日志」上方，不入导航契约类', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const panel = document.getElementById('bz-settings-panel-popup')!;
    const man = panel.querySelector('[data-sp-manual]') as HTMLElement;
    const chg = panel.querySelector('[data-sp-changelog]') as HTMLElement;
    expect(man).toBeTruthy();
    expect(man.textContent).toContain('使用手册');
    // 用户拍板：使用手册放到更新日志上面（DOM 序 = 视觉序）
    expect(man.compareDocumentPosition(chg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(man.closest('.bz-sp-desk-side')).toBeTruthy();
    expect(man.classList.contains('bz-sp-nav-item')).toBe(false);
  });

  it('点击（未下载）→ 图标转 loading → 下载写入插件目录 → openPath 打开 → 图标复原', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const man = document.querySelector('[data-sp-manual]') as HTMLElement;
    man.click();
    // 下载已在途：按钮带 loading 态（防重入口径）
    expect(man.classList.contains('is-loading')).toBe(true);
    await tick(50);
    expect(vault.files.get(STORED)).toBe(MANUAL_HTML);
    expect(openPath).toHaveBeenCalledTimes(1);
    expect(openPath.mock.calls[0][0]).toContain(STORED);
    expect(man.classList.contains('is-loading')).toBe(false);
    expect(hasNotice('手册已打开')).toBe(true);
  });

  it('点击（已下载）→ 直接打开不再下载；loading 期重复点击防重入', async () => {
    vault.files.set(STORED, MANUAL_HTML);
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const man = document.querySelector('[data-sp-manual]') as HTMLElement;
    man.click();
    man.click(); // 途中的第二次点击应被吞掉
    await tick(50);
    expect(requestUrl).not.toHaveBeenCalled();
    expect(openPath).toHaveBeenCalledTimes(1);
    expect(man.classList.contains('is-loading')).toBe(false);
  });

  it('下载失败 → notice 出人话原因，loading 复原', async () => {
    vi.mocked(requestUrl).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const man = document.querySelector('[data-sp-manual]') as HTMLElement;
    man.click();
    await tick(50);
    expect(man.classList.contains('is-loading')).toBe(false);
    expect(hasNotice(/手册下载失败.*ENOTFOUND/s)).toBe(true);
    expect(openPath).not.toHaveBeenCalled();
  });
});
