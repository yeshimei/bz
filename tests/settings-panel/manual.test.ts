/**
 * 使用手册 footer 入口 + OB 内弹窗测试（issue 473，UI 层）
 * 链路：设置面板侧栏 footer 入口（data-sp-manual，更新日志上方）→ 点击一键
 * （无手册先下载再打开，已下载直接打开）→ 下载期 .is-loading + 图标换 loader
 * 转圈（防重入），完成/失败复原图标；就绪后 openManualViewer 在 OB 内独立
 * 弹窗内嵌渲染（iframe srcdoc 直灌，无「浏览器打开」钮——用户拍板）；失败原因经
 * notice 出人话。弹窗本体（ESC/遮罩/内容注入/卸载清理）随本文件覆盖。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { SettingsPanelUI } from '../../src/settings-panel/ui';
import { unloadSettingsPanel } from '../../src/settings-panel';
import { openManualViewer, unloadManualViewer } from '../../src/settings-panel/manual-viewer';
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

describe('使用手册 footer 入口 + OB 内弹窗（issue 473）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    mobileFlag = false;
    document.body.innerHTML = '';
    unloadSettingsPanel();
    unloadManualViewer();
    setSettingsProvider(() => ({}) as any);
    vault = new MockVault();
    setApp({ vault, workspace: {} } as any);
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

  it('点击（未下载）→ 图标转 loading → 下载写入插件目录 → OB 内弹窗 srcdoc 内嵌 → 图标复原', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const man = document.querySelector('[data-sp-manual]') as HTMLElement;
    man.click();
    // 下载已在途：按钮带 loading 态（防重入口径）
    expect(man.classList.contains('is-loading')).toBe(true);
    await tick(50);
    expect(vault.files.get(STORED)).toBe(MANUAL_HTML);
    const popup = document.getElementById('bz-manual-popup')!;
    expect(popup.classList.contains('bz-panel-frame')).toBe(true);
    expect(popup.classList.contains('bz-sp-skin')).toBe(true);
    const frame = popup.querySelector('iframe.bz-manv-frame') as HTMLIFrameElement;
    expect(frame.srcdoc).toBe(MANUAL_HTML); // srcdoc 直灌，无 file:// 中转
    expect(man.classList.contains('is-loading')).toBe(false);
    // 用户拍板：不留「浏览器打开」类系统打开通道
    expect(popup.textContent).not.toContain('浏览器');
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
    expect(document.getElementById('bz-manual-popup')).toBeTruthy();
    expect(man.classList.contains('is-loading')).toBe(false);
  });

  it('下载失败 → notice 出人话原因，loading 复原，不弹窗', async () => {
    vi.mocked(requestUrl).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const man = document.querySelector('[data-sp-manual]') as HTMLElement;
    man.click();
    await tick(50);
    expect(man.classList.contains('is-loading')).toBe(false);
    expect(hasNotice(/手册下载失败.*ENOTFOUND/s)).toBe(true);
    expect(document.getElementById('bz-manual-popup')).toBeNull();
  });

  it('弹窗：无头行（用户拍板：外壳不出标题，手册自带内容即全部信息）；ESC 关闭并清空 srcdoc；重开抬顶且注入新内容', () => {
    openManualViewer(MANUAL_HTML);
    const overlay = document.getElementById('bz-manual-overlay')!;
    expect(overlay.style.display).toBe('flex');
    const popup = document.getElementById('bz-manual-popup')!;
    expect(popup.querySelector('.bz-panel-head')).toBeNull(); // 无头行形态
    expect(popup.querySelector('iframe.bz-manv-frame')).toBeTruthy();
    expect((popup.querySelector('iframe') as HTMLIFrameElement).srcdoc).toBe(MANUAL_HTML);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.style.display).toBe('none');
    expect((popup.querySelector('iframe') as HTMLIFrameElement).srcdoc).toBe(''); // 释放渲染树

    const v2 = MANUAL_HTML.replace('包仔手册', '包仔手册 v2');
    openManualViewer(v2);
    expect(overlay.style.display).toBe('flex');
    expect((popup.querySelector('iframe') as HTMLIFrameElement).srcdoc).toBe(v2);
  });

  it('弹窗：遮罩点击关闭，弹窗本体点击不关', () => {
    openManualViewer(MANUAL_HTML);
    const overlay = document.getElementById('bz-manual-overlay')!;
    (overlay.querySelector('.bz-manv-popup') as HTMLElement).click();
    expect(overlay.style.display).toBe('flex');
    overlay.click();
    expect(overlay.style.display).toBe('none');
  });

  it('unloadManualViewer：拆弹窗（幂等），再开可重建', () => {
    openManualViewer(MANUAL_HTML);
    expect(document.getElementById('bz-manual-overlay')).toBeTruthy();
    unloadManualViewer();
    expect(document.getElementById('bz-manual-overlay')).toBeNull();
    unloadManualViewer(); // 幂等
    openManualViewer(MANUAL_HTML);
    expect(document.getElementById('bz-manual-overlay')).toBeTruthy();
    unloadManualViewer();
  });
});
