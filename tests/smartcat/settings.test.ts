/**
 * smartcat 设置弹窗测试（UI 层）：
 * 1) 移动端长按开设置 → 关闭（遮罩）→ 拖拽恢复（回归：onClose 复位 isSettingsOpen 交互锁）；
 * 2) 外观平铺色块选择器（13 皮肤、active 跟随、点击落盘并即时换肤）；
 * 3) 人格成长可视化与重置成长已移除（ticket 123 UI 拍板），设置弹窗无相关元素；
 * 4) 设置弹窗移动端全屏跟随 smartcatMobileDefaultFullscreen（与聊天/数据面板同一开关）；
 * 5) 「打开数据面板」行替换原「每周懂你报告」（周报移入数据面板「报告」页签）；
 * 6) 分组卡片结构（2026-08 方案 A：外观/可视化/互动/记忆 + 移动端）与文案规范（标题无括号、
 *    描述一句话无禁用符号），旧标题行同步移除。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform } from '../mock-obsidian-entry';
import { ensureSmartCat, unloadSmartCat, __getSmartcatInternals } from '../../src/smartcat/index';
import { openSmartcatSettings } from '../../src/smartcat/ui';
import { CAT_CONTAINER_ID } from '../../src/smartcat/ui';
import { closeSettingsModal } from '../../src/core/settings-modal';

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

    // 弹窗开着仍可拖拽（用户拍板：面板不锁拖拽）
    touch(cat, 'touchstart', 100, 100);
    touch(cat, 'touchmove', 160, 140);
    expect(cat.style.left).not.toBe('');
    const l0 = parseFloat(cat.style.left);
    touch(cat, 'touchmove', 220, 140);
    expect(parseFloat(cat.style.left)).toBeGreaterThan(l0);

    // 点遮罩关闭 → onClose 复位交互锁
    document.getElementById('bz-settings-modal-mask')!.click();
    expect(internals.interaction.isSettingsOpen).toBe(false);

    // 关闭后拖拽照常：位置随手指变化
    touch(cat, 'touchstart', 100, 100);
    touch(cat, 'touchmove', 160, 140);
    expect(cat.style.left).not.toBe('');
    const l1 = parseFloat(cat.style.left);
    touch(cat, 'touchmove', 220, 140);
    expect(parseFloat(cat.style.left)).toBeGreaterThan(l1);
  }, 15000);
});

describe('外观平铺色块选择器', () => {
  function openWith(config: any, hooks: { saves: any[]; appearances: string[] }, keys?: { mobileFullscreen: boolean }) {
    openSmartcatSettings({
      getConfig: () => config,
      saveConfig: async (c) => {
        hooks.saves.push(JSON.parse(JSON.stringify(c)));
      },
      settingsKeys: { enabled: true, mobileFullscreen: keys?.mobileFullscreen ?? false },
      setMobileFullscreen: async () => {},
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

  it('人格成长可视化与重置成长已移除（ticket 123 UI 拍板）', () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    // 桌面端：无人格面板、无重置成长按钮
    Platform.isMobile = false;
    openWith(baseConfig(), hooks);
    expect(document.querySelector('.bz-sc-personality-panel')).toBeNull();
    expect(document.querySelector('.setting-item[data-name="重置成长"]')).toBeNull();
    expect(document.querySelector('.bz-sc-skin-grid')).not.toBeNull();
    // 移动端：同样无人格面板与重置行，皮肤网格仍在
    closeSettingsModal();
    document.body.innerHTML = '';
    Platform.isMobile = true;
    openWith(baseConfig(), hooks);
    expect(document.querySelector('.bz-sc-personality-panel')).toBeNull();
    expect(document.querySelector('.setting-item[data-name="重置成长"]')).toBeNull();
    expect(document.querySelector('.bz-sc-skin-grid')).not.toBeNull();
  });

  it('设置弹窗无彩色条形类元素（.bz-sc-personality-panel / .bz-sc-trait-row 不出现）', () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    openWith(baseConfig(), hooks);
    expect(document.querySelector('.bz-sc-personality-panel')).toBeNull();
    expect(document.querySelector('.bz-sc-trait-row')).toBeNull();
    expect(document.querySelector('.bz-sc-trait-bar')).toBeNull();
    expect(document.querySelector('.bz-sc-trait-fill')).toBeNull();
  });

  it('设置弹窗移动端全屏跟随 smartcatMobileDefaultFullscreen（与聊天/数据面板同一开关）', () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    const config = baseConfig();
    // 移动端 + 开关开 → 弹窗挂 bz-win-mfs
    Platform.isMobile = true;
    openWith(config, hooks, { mobileFullscreen: true });
    expect(document.getElementById('bz-settings-modal-popup')!.classList.contains('bz-win-mfs')).toBe(true);
    // 开关关 → 不挂类（常规卡）
    closeSettingsModal();
    document.body.innerHTML = '';
    openWith(config, hooks, { mobileFullscreen: false });
    expect(document.getElementById('bz-settings-modal-popup')!.classList.contains('bz-win-mfs')).toBe(false);
    // 桌面端恒不挂类
    closeSettingsModal();
    document.body.innerHTML = '';
    Platform.isMobile = false;
    openWith(config, hooks, { mobileFullscreen: true });
    expect(document.getElementById('bz-settings-modal-popup')!.classList.contains('bz-win-mfs')).toBe(false);
  });

  it('「打开数据面板」行替换原「每周懂你报告」；点击关弹窗并回调', async () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    let dashboardOpened = 0;
    Platform.isMobile = false;
    openSmartcatSettings({
      getConfig: () => baseConfig(),
      saveConfig: async (c) => {
        hooks.saves.push(JSON.parse(JSON.stringify(c)));
      },
      settingsKeys: { enabled: true, mobileFullscreen: false },
      setMobileFullscreen: async () => {},
      onOpenDashboard: () => {
        dashboardOpened++;
        closeSettingsModal();
      },
    });
    // 原周报行已不在（mock Setting 契约：行名存 dataset.name）
    expect(document.querySelector('.setting-item[data-name="每周懂你报告"]')).toBeNull();
    // 新入口存在，按钮文本正确
    const dashRow = document.querySelector('.setting-item[data-name="打开数据面板"]') as HTMLElement | null;
    expect(dashRow).not.toBeNull();
    const btn = (dashRow as any).__setting.controls[0];
    expect(btn.text).toBe('打开数据面板');
    // 触发：关设置弹窗 + 打开数据面板回调
    btn.trigger();
    await new Promise((r) => setTimeout(r, 5));
    expect(dashboardOpened).toBe(1);
    // 点击后弹窗已关（onClose 复位交互锁路径）
    expect(document.getElementById('bz-settings-modal-popup')).toBeNull();
  });
});

describe('分组卡片结构（2026-08 方案 A）与文案规范', () => {
  function openWith(config: any, hooks: { saves: any[]; appearances: string[] }) {
    openSmartcatSettings({
      getConfig: () => config,
      saveConfig: async (c) => {
        hooks.saves.push(JSON.parse(JSON.stringify(c)));
      },
      settingsKeys: { enabled: true, mobileFullscreen: false },
      setMobileFullscreen: async () => {},
      onOpenDashboard: () => {},
      onAppearanceChanged: (skin) => hooks.appearances.push(skin),
    });
  }

  it('桌面端九组：外观/可视化/互动/记忆/记忆目录/存储与记忆/记忆巩固/关联/显示，图标与项数徽标正确', () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    Platform.isMobile = false;
    openWith(baseConfig(), hooks);
    const popup = document.getElementById('bz-settings-modal-popup')!;
    // ticket 131：移动端组挂 bz-setting-hidden 整组隐藏但仍留 DOM（可在移动端重求值），可见组过滤后与原行为一致
    const heads = [...popup.querySelectorAll('.bz-settings-group')]
      .filter((g) => !g.classList.contains('bz-setting-hidden'))
      .map((g) => ({
        icon: g.querySelector('.bz-settings-group-icon')!.getAttribute('data-icon'),
        name: g.querySelector('.bz-settings-group-name')!.textContent,
        count: g.querySelector('.bz-settings-group-count')!.textContent,
      }));
    expect(heads).toEqual([
      { icon: 'palette', name: '外观', count: '0 项' },
      // 「打开数据面板」为 button 操作行（bz-setting-action-row 豁免徽标计数，ticket 131 声明式语义）
      { icon: 'bar-chart-3', name: '可视化', count: '0 项' },
      { icon: 'message-circle', name: '互动', count: '3 项' },
      { icon: 'archive', name: '记忆', count: '6 项' },
      // ADR-0069 记忆目录（记忆目录流）：多文件夹选择（path-picker 多选）
      { icon: 'folder-open', name: '记忆目录', count: '1 项' },
      // P3 新增三组（ticket 123）
      { icon: 'database', name: '存储与记忆', count: '2 项' },
      // ticket 160 记忆巩固（三层流水线：行为流→日小结→记忆流→反思/周报）
      { icon: 'moon', name: '记忆巩固', count: '11 项' },
      { icon: 'link', name: '关联', count: '2 项' },
      { icon: 'eye', name: '显示', count: '1 项' },
    ]);
    // 外观组内为色块网格（无 Setting 行，不计徽标），可视化组内仅「打开数据面板」
    expect(popup.querySelector('.bz-settings-group-body .bz-sc-skin-grid')).not.toBeNull();
    expect(popup.querySelector('.bz-settings-group-body .bz-sc-personality-panel')).toBeNull();
    // 弹窗宽度 560（分组卡片方案）
    expect(popup.style.maxWidth).toBe('560px');
  });

  it('文案规范：标题无括号、描述一句话且无禁用符号，旧标题行已移除', () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    Platform.isMobile = false;
    openWith(baseConfig(), hooks);
    // 旧标题（含括号）已不存在
    expect(document.querySelector('.setting-item[data-name="自言自语间隔（分钟）"]')).toBeNull();
    expect(document.querySelector('.setting-item[data-name="短期记忆量（轮数）"]')).toBeNull();
    // 新标题与描述（键名不动，只改文案）
    const interval = document.querySelector('.setting-item[data-name="自言自语间隔"]') as any;
    expect(interval).not.toBeNull();
    expect(interval.__setting.desc).toBe('小橘每隔多久主动说一句话，范围 1 到 60 分钟');
    // 全部行：标题零符号（括号/等号），描述无、·/— 等禁用符号
    for (const row of Array.from(document.querySelectorAll('.setting-item')) as any[]) {
      expect(row.dataset.name).not.toMatch(/[（【=]/);
      expect(row.__setting.desc).not.toMatch(/、|·|\/|—/);
    }
  });

  it('移动端多出「移动端」组（smartphone 图标，1 项）', () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    Platform.isMobile = true;
    openWith(baseConfig(), hooks);
    const mobileGroup = [...document.querySelectorAll('.bz-settings-group')].find(
      (g) => g.querySelector('.bz-settings-group-name')!.textContent === '移动端'
    )! as HTMLElement;
    expect(mobileGroup).not.toBeUndefined();
    expect(mobileGroup.querySelector('.bz-settings-group-icon')!.getAttribute('data-icon')).toBe('smartphone');
    expect(mobileGroup.querySelector('.bz-settings-group-count')!.textContent).toBe('1 项');
  });

  it('可视化组仅有「打开数据面板」1 项、无人格面板', () => {
    const hooks = { saves: [] as any[], appearances: [] as string[] };
    Platform.isMobile = false;
    openSmartcatSettings({
      getConfig: () => baseConfig(),
      saveConfig: async (c) => {
        hooks.saves.push(JSON.parse(JSON.stringify(c)));
      },
      settingsKeys: { enabled: true, mobileFullscreen: false },
      setMobileFullscreen: async () => {},
      onOpenDashboard: () => {},
      onAppearanceChanged: (skin) => hooks.appearances.push(skin),
    });
    const viz = [...document.querySelectorAll('.bz-settings-group')].find(
      (g) => g.querySelector('.bz-settings-group-name')!.textContent === '可视化'
    )! as HTMLElement;
    expect(viz).not.toBeUndefined();
    // 「打开数据面板」为 button 操作行（actionRow 豁免徽标，ticket 131 声明式语义）
    expect(viz.querySelector('.bz-settings-group-count')!.textContent).toBe('0 项');
    expect(viz.querySelector('.setting-item[data-name="打开数据面板"]')).not.toBeNull();
    expect(viz.querySelector('.bz-sc-personality-panel')).toBeNull();
  });
});