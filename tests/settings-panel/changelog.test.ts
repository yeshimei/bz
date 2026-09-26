/**
 * 更新日志弹窗测试（issue 472 v2，UI 层）
 * 链路：设置面板侧栏 footer 入口（data-sp-changelog）→ 独立弹窗
 * （.bz-panel-frame 新壳 + .bz-sp-skin 同皮）→ 版本栏（最新在前，当前版带签）/
 * 版本内容三段主次（新功能主、修复优化次）/ 版本切换 / 遮罩与 ESC 关闭 /
 * 重开恢复上次所在版本 / 卸载清理。数据形状契约见 changelog-data.test.ts。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { SettingsPanelUI } from '../../src/settings-panel/ui';
import { unloadSettingsPanel } from '../../src/settings-panel';
import { openChangelogModal, unloadChangelog } from '../../src/settings-panel/changelog';
import { CHANGELOG_RELEASES, CHANGELOG_META } from '../../src/settings-panel/changelog-data';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
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

const tick = () => new Promise((r) => setTimeout(r, 20));
/** 版本栏 DOM 顺序 = 数据倒序（最新在前） */
const railOrder = () => [...CHANGELOG_RELEASES].reverse();

describe('更新日志弹窗（issue 472 v2）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    mobileFlag = false;
    document.body.innerHTML = '';
    unloadSettingsPanel();
    unloadChangelog();
    setSettingsProvider(() => ({}) as any);
    setApp({ vault: new MockVault(), workspace: {} } as any);
  });

  it('侧栏底部入口：footer 按钮在 aside 内（nav 兄弟节点），点击打开独立弹窗（同皮）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    await tick();
    const panel = document.getElementById('bz-settings-panel-popup')!;
    const footBtn = panel.querySelector('[data-sp-changelog]') as HTMLElement;
    expect(footBtn).toBeTruthy();
    expect(footBtn.textContent).toContain('更新日志');
    // footer 是 .bz-sp-nav 的兄弟节点：nav 随搜索/切域整树重渲，入口不被波及
    expect(footBtn.closest('.bz-sp-desk-side')).toBeTruthy();
    expect(footBtn.closest('.bz-sp-nav')).toBeNull();
    // 不沾 .bz-sp-nav-item 契约类（测试按它数导航项，footer 入列会污染计数）
    expect(footBtn.classList.contains('bz-sp-nav-item')).toBe(false);

    footBtn.click();
    const popup = document.getElementById('bz-changelog-popup')!;
    expect(popup).toBeTruthy();
    expect(popup.classList.contains('bz-panel-frame')).toBe(true);
    expect(popup.classList.contains('bz-sp-skin')).toBe(true);
  });

  it('弹窗结构：头行汇总 + 版本栏最新在前 + 默认选中最新版', () => {
    openChangelogModal();
    const popup = document.getElementById('bz-changelog-popup')!;
    expect(popup.querySelector('.bz-panel-head-sub')!.textContent).toContain(`v${CHANGELOG_META.current}`);
    const items = popup.querySelectorAll('.bz-chg-nav-item');
    expect(items.length).toBe(CHANGELOG_RELEASES.length);
    // 最新在前且默认选中
    expect(items[0].classList.contains('on')).toBe(true);
    expect(items[0].querySelector('.bz-chg-nav-ver')!.textContent).toBe(`v${CHANGELOG_META.current}`);
    // 最新版带「当前」签
    expect(items[0].querySelector('.bz-chg-nav-cur')).toBeTruthy();
    expect(items[1].querySelector('.bz-chg-nav-cur')).toBeNull();
    // 右栏版本头 = 最新版 + 当前版本徽标
    expect(popup.querySelector('.bz-chg-rel-ver')!.textContent).toBe(`v${CHANGELOG_META.current}`);
    expect(popup.querySelector('.bz-chg-rel-cur')).toBeTruthy();
  });

  it('版本内容三段主次：新功能为主（--pri）、修复/优化为次（--sec）、空段不渲染', () => {
    openChangelogModal();
    const main = document.querySelector('.bz-chg-main')!;
    const secTitles = [...main.querySelectorAll('.bz-chg-sec-t')].map((el) => el.textContent);
    expect(secTitles).toEqual(['新功能', '问题修复', '体验优化'].filter((l) => secTitles.includes(l)));
    expect(secTitles[0]).toBe('新功能');
    // 新功能行为主层级，修复/优化行为次层级
    expect(main.querySelector('.bz-chg-sec .bz-chg-item--pri')).toBeTruthy();
    expect(main.querySelector('.bz-chg-sec .bz-chg-item--sec')).toBeTruthy();
    // 域标签 chip 在行内
    expect(main.querySelector('.bz-chg-item .bz-chg-dom')).toBeTruthy();
    // 主题句有文本
    expect((main.querySelector('.bz-chg-item .bz-chg-text')!.textContent ?? '').length).toBeGreaterThan(0);
  });

  it('版本切换：高亮迁移，版本头随切换更新；旧版本无「当前版本」徽标', () => {
    openChangelogModal();
    const popup = document.getElementById('bz-changelog-popup')!;
    const older = railOrder()[1]; // 栏内第二项 = 数据倒数第二版
    (popup.querySelectorAll('.bz-chg-nav-item')[1] as HTMLElement).click();
    const items = popup.querySelectorAll('.bz-chg-nav-item');
    expect(items[1].classList.contains('on')).toBe(true);
    expect(items[0].classList.contains('on')).toBe(false);
    expect(popup.querySelector('.bz-chg-rel-ver')!.textContent).toBe(`v${older.version}`);
    expect(popup.querySelector('.bz-chg-rel-cur')).toBeNull();
    // 主栏有实际内容
    expect(popup.querySelectorAll('.bz-chg-item').length).toBeGreaterThan(0);
  });

  it('ESC 关闭后重开：恢复可见并停留在上次所在版本', () => {
    openChangelogModal();
    const older = railOrder()[1];
    (document.querySelectorAll('.bz-chg-nav-item')[1] as HTMLElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const overlay = document.getElementById('bz-changelog-overlay')!;
    expect(overlay.style.display).toBe('none');
    openChangelogModal();
    expect(overlay.style.display).toBe('flex');
    expect(document.querySelector('.bz-chg-rel-ver')!.textContent).toBe(`v${older.version}`);
  });

  it('遮罩点击关闭；弹窗本体点击不关', () => {
    openChangelogModal();
    const overlay = document.getElementById('bz-changelog-overlay')!;
    (overlay.querySelector('.bz-chg-popup') as HTMLElement).click();
    expect(overlay.style.display).toBe('flex');
    overlay.click();
    expect(overlay.style.display).toBe('none');
  });

  it('unloadChangelog：拆弹窗（幂等），再开可重建', () => {
    openChangelogModal();
    expect(document.getElementById('bz-changelog-overlay')).toBeTruthy();
    unloadChangelog();
    expect(document.getElementById('bz-changelog-overlay')).toBeNull();
    unloadChangelog(); // 幂等
    openChangelogModal();
    expect(document.getElementById('bz-changelog-overlay')).toBeTruthy();
    unloadChangelog();
  });
});
