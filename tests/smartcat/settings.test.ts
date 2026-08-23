/**
 * smartcat 设置弹窗测试（UI 层）：
 * 1) 移动端长按开设置 → 关闭（遮罩）→ 拖拽恢复（回归：onClose 复位 isSettingsOpen 交互锁）；
 * 2) 外观平铺色块选择器（13 皮肤、active 跟随、点击落盘并即时换肤）；
 * 3) 人格成长数据列表仅桌面端显示（2026-08-23 用户拍板：移动端删除）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform } from '../mock-obsidian-entry';
import { ensureSmartCat, unloadSmartCat, __getSmartcatInternals } from '../../src/smartcat/index';
import { openSmartcatSettings } from '../../src/smartcat/ui';
import { CAT_CONTAINER_ID } from '../../src/smartcat/ui';

let settings: any = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };

function makeApp() {
  const vault = new MockVault();
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(async () => {});
  return { app, vault };
}

/** jsdom 无 TouchEvent：派发带 touches 的普通 Event */
function touch(el: EventTarget, type: string, x: number, y: number): void {
  const e: any = new Event(type, { bubbles: true });
  e.touches = [{ clientX: x, clientY: y }];
  el.dispatchEvent(e);
}

const baseConfig = () => ({
  appearance: 'orange',
  speakInterval: 5,
  speakProbability: 0.3,
  shortTermMemory: 50,
  contextLength: 400,
  contextSplitRatio: 0.5,
  conversationHistory: [],
  proactiveCare: true,
});

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
});

describe('移动端长按设置 → 关闭 → 拖拽恢复', () => {
  it('遮罩关闭设置弹窗后 isSettingsOpen 复位、触摸拖拽恢复', async () => {
    Platform.isMobile = true;
    const { app } = makeApp();
    await ensureSmartCat(app);
    const internals = __getSmartcatInternals();
    expect(internals.initialized).toBe(true);
    const cat = document.getElementById(CAT_CONTAINER_ID)!;

    // 长按 800ms 触发设置弹窗
    touch(cat, 'touchstart', 100, 100);
    await new Promise((r) => setTimeout(r, 900));
    expect(document.getElementById('bz-settings-modal-popup')).not.toBeNull();
    expect(internals.interaction.isSettingsOpen).toBe(true);

    // 弹窗开着时无法拖拽（触摸全部早退）
    touch(cat, 'touchstart', 100, 100);
    touch(cat, 'touchmove', 160, 140);
    expect(cat.style.left).toBe('');

    // 点遮罩关闭 → onClose 复位交互锁
    document.getElementById('bz-settings-modal-mask')!.click();
    expect(internals.interaction.isSettingsOpen).toBe(false);

    // 拖拽恢复：位置随手指变化
    touch(cat, 'touchstart', 100, 100);
    touch(cat, 'touchmove', 160, 140);
    expect(cat.style.left).not.toBe('');
    const l1 = parseFloat(cat.style.left);
    touch(cat, 'touchmove', 220, 140);
    expect(parseFloat(cat.style.left)).toBeGreaterThan(l1);
  }, 15000);
});

describe('外观平铺色块选择器', () => {
  function openWith(config: any, hooks: { saves: any[]; appearances: string[] }) {
    openSmartcatSettings({
      getConfig: () => config,
      saveConfig: async (c) => {
        hooks.saves.push(JSON.parse(JSON.stringify(c)));
      },
      settingsKeys: { enabled: true, mobileFullscreen: false },
      setMobileFullscreen: async () => {},
      getPersonalityGrowth: () => ({
        ocean: { openness: 0.6, conscientiousness: 0.5, extraversion: 0.4, agreeableness: 0.7, neuroticism: 0.3 },
        traits: { warmth: 0.6 },
      }),
      resetPersonalityGrowth: async () => {},
      onAppearanceChanged: (skin) => hooks.appearances.push(skin),
    });
  }

  it('13 皮肤平铺渲染，active 跟随当前配置；色块类名齐全', () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    openWith(baseConfig(), hooks);
    const items = Array.from(document.querySelectorAll('.bz-sc-skin-grid .bz-sc-skin-item'));
    expect(items.length).toBe(13);
    const active = document.querySelector('.bz-sc-skin-grid .bz-sc-skin-item.active') as HTMLElement;
    expect(active.dataset.skin).toBe('orange');
    // 每个色块都有对应皮肤色类（swatch-<skin>）
    const swatches = Array.from(document.querySelectorAll('.bz-sc-skin-swatch'));
    expect(swatches.length).toBe(13);
    expect(document.querySelectorAll('[class*="bz-sc-skin-swatch-fire"]').length).toBe(1);
  });

  it('点击色块：写盘新外观 + active 迁移 + 即时换肤回调', async () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    openWith(baseConfig(), hooks);
    const fire = document.querySelector('.bz-sc-skin-item[data-skin="fire"]') as HTMLElement;
    fire.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(hooks.saves.length).toBe(1);
    expect(hooks.saves[0].appearance).toBe('fire');
    expect(hooks.appearances).toEqual(['fire']);
    const active = document.querySelector('.bz-sc-skin-grid .bz-sc-skin-item.active') as HTMLElement;
    expect(active.dataset.skin).toBe('fire');
    // 点击当前皮肤不重复写盘
    (active as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 5));
    expect(hooks.saves.length).toBe(1);
  });

  it('人格成长数据列表仅桌面端显示；移动端只剩其余设置项', () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    // 桌面端：有人格面板
    Platform.isMobile = false;
    openWith(baseConfig(), hooks);
    expect(document.querySelector('.bz-sc-personality-panel')).not.toBeNull();
    // 移动端：无人格面板（含重置按钮），皮肤网格仍在
    document.body.innerHTML = '';
    Platform.isMobile = true;
    openWith(baseConfig(), hooks);
    expect(document.querySelector('.bz-sc-personality-panel')).toBeNull();
    expect(document.querySelector('.bz-sc-skin-grid')).not.toBeNull();
    expect(document.body.textContent).not.toContain('重置成长');
  });
});