/**
 * 更新日志弹窗测试（issue 472 立，issue 474 UI 层）
 * 链路：设置面板侧栏 footer 入口（data-sp-changelog）→ 点击一键（无日志先下载再打开，
 * 已下载直接打开）→ 下载期 .is-loading + 图标换 loader 转圈（防重入），完成/失败复原
 * history 图标；失败不兜底（用户拍板）→ notice 出人话原因且不弹窗。
 * 就绪后 openChangelogModal 在 OB 内独立弹窗内嵌渲染（iframe srcdoc 直灌，与手册同范式）。
 * 弹窗本体（ESC/遮罩/内容注入/卸载清理）随本文件覆盖。下载链路口径见 tests/core/changelog.test.ts。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { SettingsPanelUI } from '../../src/settings-panel/ui';
import { unloadSettingsPanel } from '../../src/settings-panel';
import { openChangelogModal, unloadChangelog } from '../../src/settings-panel/changelog';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { CHANGELOG_FILENAME } from '../../src/core/changelog';
import { MockVault } from '../mock-vault';

// mock Platform.isMobile 切换（与 settings-panel.test.ts 同口径；本弹窗仅桌面入口）
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

const CHG_HTML = '<!DOCTYPE html><html><body><script>\nconst DATA = {"current":"1.24.0","releases":[]};\n</script></body></html>';
const STORED = `.obsidian/plugins/bz/${CHANGELOG_FILENAME}`;

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('更新日志弹窗（issue 472 立，issue 474 改在线下载）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    mobileFlag = false;
    document.body.innerHTML = '';
    unloadSettingsPanel();
    unloadChangelog();
    setSettingsProvider(() => ({}) as any);
    vault = new MockVault();
    setApp({ vault, workspace: {} } as any);
    vi.mocked(requestUrl).mockReset();
    vi.mocked(requestUrl).mockResolvedValue({ status: 200, text: CHG_HTML } as any);
  });

  it('侧栏入口：日志挂在导航末尾「文档」组内（不再常驻底缘），不入域契约类', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const panel = document.getElementById('bz-settings-panel-popup')!;
    const btn = panel.querySelector('[data-sp-changelog]') as HTMLElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('更新日志');
    // 2026-09-26 用户拍板：手册/日志从底缘 footer 移入导航末尾「文档」组，随列表滚动、可被搜索命中
    expect(btn.closest('.bz-sp-nav')).toBeTruthy();
    expect(btn.closest('.bz-sp-nav-sec')).toBeTruthy();
    // 必须是 .bz-sp-nav-doc 而非 .bz-sp-nav-item —— 后者是域契约类（切域 / 数域项按它走），日志不是域
    expect(btn.classList.contains('bz-sp-nav-doc')).toBe(true);
    expect(btn.classList.contains('bz-sp-nav-item')).toBe(false);
  });

  it('点击（未下载）→ 图标转 loading → 下载写入插件目录 → OB 内弹窗 srcdoc 内嵌 → 图标复原', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const btn = document.querySelector('[data-sp-changelog]') as HTMLElement;
    btn.click();
    // 下载已在途：按钮带 loading 态（防重入口径）
    expect(btn.classList.contains('is-loading')).toBe(true);
    await tick(50);
    expect(vault.files.get(STORED)).toBe(CHG_HTML);
    const popup = document.getElementById('bz-changelog-popup')!;
    expect(popup.classList.contains('bz-panel-frame')).toBe(true);
    expect(popup.classList.contains('bz-sp-skin')).toBe(true);
    const frame = popup.querySelector('iframe.bz-chg-frame') as HTMLIFrameElement;
    expect(frame.srcdoc).toBe(CHG_HTML); // srcdoc 直灌，无 file:// 中转
    expect(btn.classList.contains('is-loading')).toBe(false);
  });

  it('点击（已下载）→ 直接打开不再下载；loading 期重复点击防重入', async () => {
    vault.files.set(STORED, CHG_HTML);
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const btn = document.querySelector('[data-sp-changelog]') as HTMLElement;
    btn.click();
    btn.click(); // 途中的第二次点击应被吞掉
    await tick(50);
    expect(requestUrl).not.toHaveBeenCalled();
    expect(document.getElementById('bz-changelog-popup')).toBeTruthy();
    expect(btn.classList.contains('is-loading')).toBe(false);
  });

  it('下载失败 → notice 出人话原因，loading 复原，不弹窗（不兜底内置快照）', async () => {
    vi.mocked(requestUrl).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const btn = document.querySelector('[data-sp-changelog]') as HTMLElement;
    btn.click();
    await tick(50);
    expect(btn.classList.contains('is-loading')).toBe(false);
    expect(hasNotice(/更新日志下载失败.*ENOTFOUND/s)).toBe(true);
    expect(document.getElementById('bz-changelog-popup')).toBeNull();
  });

  it('弹窗：无头行（与手册弹窗同形态）+ iframe 内嵌内容；ESC 关闭并清空 srcdoc；重开换内容', () => {
    openChangelogModal(CHG_HTML);
    const overlay = document.getElementById('bz-changelog-overlay')!;
    expect(overlay.style.display).toBe('flex');
    const popup = document.getElementById('bz-changelog-popup')!;
    // 用户拍板：外壳不出标题，日志文档自带内容即全部信息（与使用手册弹窗对齐）
    expect(popup.querySelector('.bz-panel-head')).toBeNull();
    expect(popup.querySelector('iframe.bz-chg-frame')).toBeTruthy();
    expect((popup.querySelector('iframe') as HTMLIFrameElement).srcdoc).toBe(CHG_HTML);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.style.display).toBe('none');
    expect((popup.querySelector('iframe') as HTMLIFrameElement).srcdoc).toBe(''); // 释放渲染树

    const v2 = CHG_HTML.replace('1.24.0', '1.25.0');
    openChangelogModal(v2);
    expect(overlay.style.display).toBe('flex');
    expect((popup.querySelector('iframe') as HTMLIFrameElement).srcdoc).toBe(v2);
  });

  it('弹窗：遮罩点击关闭，弹窗本体点击不关', () => {
    openChangelogModal(CHG_HTML);
    const overlay = document.getElementById('bz-changelog-overlay')!;
    (overlay.querySelector('.bz-chg-popup') as HTMLElement).click();
    expect(overlay.style.display).toBe('flex');
    overlay.click();
    expect(overlay.style.display).toBe('none');
  });

  it('unloadChangelog：拆弹窗（幂等），再开可重建', () => {
    openChangelogModal(CHG_HTML);
    expect(document.getElementById('bz-changelog-overlay')).toBeTruthy();
    unloadChangelog();
    expect(document.getElementById('bz-changelog-overlay')).toBeNull();
    unloadChangelog(); // 幂等
    openChangelogModal(CHG_HTML);
    expect(document.getElementById('bz-changelog-overlay')).toBeTruthy();
    unloadChangelog();
  });
});
