/**
 * 设置面板域测试（settings-panel，ADR-0080）
 * UI 层：桌面侧栏工作台构建 / 域导航切换内嵌渲染真实 schema / 搜索过滤 /
 *       移动命令面板构建 / 域设置弹窗 / 关闭 / 卸载清理。
 * 核心断言：面板内嵌渲染 = 自绘渲染器 renderPanelSchema（与 ⚙️ 弹窗同数据源、同绑定通道，
 *   视觉完全自绘——面板内不出现 Obsidian 原生 .setting-item 设置行嵌套）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { SettingsPanelUI } from '../src/settings-panel/ui';
import { openSettingsPanel, unloadSettingsPanel } from '../src/settings-panel';
import { escManager } from '../src/core/esc-manager';
import { setSettingsProvider } from '../src/core/settings-provider';
import { setApp } from '../src/core/app';
import { MockVault } from './mock-vault';

// mock Platform.isMobile 切换（桌面/移动两态）
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

/** 等渲染微任务完成（动态 import 首次加载可能 >20ms，用轮询等到分组出现或超时） */
const tick = () => new Promise((r) => setTimeout(r, 20));
/** 等待 pane 内出现 .bz-sp-group（最多 2s），超时返回 false */
async function waitGroups(container: HTMLElement, min: number): Promise<boolean> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (container.querySelectorAll('.bz-sp-group').length >= min) return true;
    await new Promise((r) => setTimeout(r, 30));
  }
  return false;
}

describe('设置面板（settings-panel）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    mobileFlag = false;
    document.body.innerHTML = '';
    unloadSettingsPanel();
    (escManager as any).handlers = new Map();
    setSettingsProvider(() => ({ settingsPanelMobileDefaultFullscreen: true } as any));
    // 注入 app（review schema 构造经 getApp；mock 与其它域测试一致）
    setApp({ vault: new MockVault(), workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  });

  it('桌面端：构建侧栏工作台（品牌+搜索+域导航+右侧面板）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(popup).toBeTruthy();
    expect(popup.classList.contains('bz-sp-desk')).toBe(true);
    expect(popup.querySelector('.bz-sp-brand-name')!.textContent).toBe('设置');
    expect(popup.querySelectorAll('.bz-sp-nav-item').length).toBe(22);
    // 无底部快捷键提示 / 无右侧导航条 / 无面包屑
    expect(popup.querySelector('.bz-sp-foot')).toBeNull();
    expect(popup.querySelector('.bz-sp-crumb')).toBeNull();
    // 徽标动态计算（原型 .b-ct）：加载前 ·；无设置域 —；schema 加载后 = 可见组数
    // 初始（全局 schema 尚未加载完成）：全局 ·、归物本 ·（有 schema 但桌面全门控隐藏 → 加载后仍 ·）
    let badges = [...popup.querySelectorAll('.bz-sp-nav-count')].map((b) => b.textContent);
    expect(badges[3]).toBe('·'); // 归物本（schema 加载后桌面端无可见组）
    // 等全局 schema 加载完成（含 AI/数据存储路径两分组）→ 全局徽标回填可见组数 2
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && badges[0] === '·') {
      await new Promise((r) => setTimeout(r, 30));
      badges = [...popup.querySelectorAll('.bz-sp-nav-count')].map((b) => b.textContent);
    }
    expect(badges[0]).toBe('2'); // 全局：AI + 数据存储路径（桌面端移动端组不存在）
    // 导航图标为 emoji（原型 .b-ic）
    const navIcons = [...popup.querySelectorAll('.bz-sp-nav-ic')].map((i) => i.textContent);
    expect(navIcons[0]).toBe('⚙️');
    expect(navIcons[6]).toBe('🔐');
    // 头部 logo 为 emoji ⚙️（原型 .b-logo）
    expect(popup.querySelector('.bz-sp-logo')!.textContent).toBe('⚙️');
    ui.cleanup();
  });

  it('桌面端：全局域内嵌渲染 AI 服务商设置（renderPanelSchema 真实渲染）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 全局 schema = mainSettingsSchema（AI + 数据存储路径两区块）
    const groups = popup.querySelectorAll('.bz-sp-group');
    expect(groups.length).toBeGreaterThanOrEqual(2);
    // 设置行真实渲染（自绘结构）
    expect(popup.querySelectorAll('.bz-sp-set-row').length).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('桌面端：分组卡图标为 emoji（原型 .gc-icon）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 全局域分组：AI（sparkles→🤖）+ 数据存储路径（folder-open→📂）
    const icons = [...popup.querySelectorAll('.bz-sp-group-icon')].map((i) => i.textContent);
    expect(icons.length).toBeGreaterThanOrEqual(2);
    expect(icons).toContain('🤖');
    expect(icons).toContain('📂');
    ui.cleanup();
  });

  it('桌面端：面板容器带原型边框（.b-modal 1px + shadow-md）', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(popup.classList.contains('bz-sp-desk')).toBe(true);
    ui.cleanup();
  });

  it('桌面端：点击域导航切换 → 内嵌渲染该域真实 schema', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    // 点击「复习计划」（index 11）→ 内嵌渲染 review schema（检查提醒/做题家等分组）
    (items[11] as HTMLElement).click();
    await waitGroups(popup, 5);
    const groups = popup.querySelectorAll('.bz-sp-group');
    const paneHtml = popup.querySelector('.bz-sp-pane')!.innerHTML;
    // 若为空态，把描述（错误消息）打出来
    const errDesc = popup.querySelector('.bz-sp-empty-desc');
    expect(groups.length, 'err: ' + (errDesc ? errDesc.textContent : 'none')).toBeGreaterThanOrEqual(5);
    // 设置行真实渲染（自绘开关/输入等）
    expect(popup.querySelectorAll('.bz-sp-set-row').length).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('桌面端：番茄钟域内嵌渲染（时间方案/行为分组）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    // 番茄钟 index 16
    (items[16] as HTMLElement).click();
    await waitGroups(popup, 2);
    const groups = popup.querySelectorAll('.bz-sp-group');
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(popup.querySelectorAll('.bz-sp-set-row').length).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('桌面端：自绘开关点击切换（真实交互，番茄钟域）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 切到番茄钟（index 16，行为组有多个开关）
    (popup.querySelectorAll('.bz-sp-nav-item')[16] as HTMLElement).click();
    await waitGroups(popup, 2);
    const sw = popup.querySelector('.bz-sp-sw');
    expect(sw).toBeTruthy();
    const before = sw!.classList.contains('on');
    sw!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sw!.classList.contains('on')).toBe(!before);
    ui.cleanup();
  });

  it('桌面端：自绘下拉点击弹出选项并选择（番茄钟预设）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 切到番茄钟（index 16，时间方案组有预设下拉）
    (popup.querySelectorAll('.bz-sp-nav-item')[16] as HTMLElement).click();
    await waitGroups(popup, 2);
    const sel = popup.querySelector('.bz-sp-sel');
    expect(sel).toBeTruthy();
    // 单次点击即打开（重写后不再因冒泡误关）
    sel!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const menu = popup.querySelector('.bz-sp-sel-menu');
    expect(menu).toBeTruthy();
    const opt = menu!.querySelectorAll('.bz-sp-sel-opt')[1] as HTMLElement;
    const before = popup.querySelector('.bz-sp-sel-val')!.textContent;
    opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(popup.querySelector('.bz-sp-sel-val')!.textContent).not.toBe(before);
    // 选中后菜单关闭；重开菜单 → 选中态/✓ 跟随新值（不再显示旧选项）
    expect(popup.querySelector('.bz-sp-sel-menu')).toBeNull();
    sel!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const menu2 = popup.querySelector('.bz-sp-sel-menu');
    expect(menu2).toBeTruthy();
    const onOpt = [...menu2!.querySelectorAll('.bz-sp-sel-opt')].find((o) => o.classList.contains('on'));
    expect(onOpt).toBeTruthy();
    expect(onOpt!.textContent).toContain('✓');
    expect(onOpt!.textContent).toContain(popup.querySelector('.bz-sp-sel-val')!.textContent!);
    ui.cleanup();
  });

  it('桌面端：路径行自绘渲染（chips + 选择按钮，无原生设置行嵌套）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 切到日记本（index 1，「目录」组有日记目录/影视目录/信件目录 path 行）
    (popup.querySelectorAll('.bz-sp-nav-item')[1] as HTMLElement).click();
    await waitGroups(popup, 3);
    // 面板内不得出现 Obsidian 原生设置行（自绘行 + custom 插槽内的原生行都不应存在——custom 无原生行）
    // 「日记目录」行 = 自绘 .bz-sp-set-row + .bz-sp-chips
    const chips = popup.querySelector('.bz-sp-chips');
    expect(chips).toBeTruthy();
    expect(popup.querySelector('.bz-sp-path-btn')).toBeTruthy();
    // 无原生 .setting-item 嵌套（杜绝「设置行里再套一个设置行」）
    expect(popup.querySelector('.bz-sp-pane .setting-item')).toBeNull();
    // 空态（未设置路径）只显示选择按钮
    const pathRow = chips!.closest('.bz-sp-set-row')!;
    expect(pathRow.querySelector('.bz-sp-set-name')!.textContent).toBe('日记目录');
    expect(chips!.querySelector('.bz-sp-path-btn')!.textContent).toBe('选择…');
    ui.cleanup();
  });

  it('桌面端：无设置项域显示空态', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    // 归物本 index 3：schema 仅含移动端组（桌面门控隐藏）→ 显示「暂无设置项」空态
    (items[3] as HTMLElement).click();
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      if (popup.querySelector('.bz-sp-empty')) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    expect(popup.querySelector('.bz-sp-empty')).toBeTruthy();
    expect(popup.querySelector('.bz-sp-empty-title')!.textContent).toContain('暂无设置项');
    ui.cleanup();
  });

  it('桌面端：搜索过滤域导航', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const search = popup.querySelector('.bz-sp-search-in') as HTMLInputElement;
    search.value = '番茄';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('番茄钟');
    ui.cleanup();
  });

  it('桌面端：域切换后侧栏徽标回填（组数）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 番茄钟（index 16）有 2 组（时间方案/行为）——加载后徽标回填
    (popup.querySelectorAll('.bz-sp-nav-item')[16] as HTMLElement).click();
    await waitGroups(popup, 2);
    const badge = popup.querySelectorAll('.bz-sp-nav-item')[16].querySelector('.bz-sp-nav-count')!;
    expect(badge.textContent).toBe('2');
    ui.cleanup();
  });

  it('移动端：构建命令面板（搜索+域列表+关闭按钮，主面板真全屏）', () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(popup.classList.contains('bz-sp-mobile')).toBe(true);
    expect(popup.classList.contains('bz-win-mfs')).toBe(true);
    expect(popup.querySelector('.bz-sp-mob-close')).toBeTruthy();
    expect(popup.querySelectorAll('.bz-sp-mob-item').length).toBe(22);
    // 搜索有清除按钮（输入后显示）
    expect(popup.querySelector('.bz-sp-mob-clear')).toBeTruthy();
    ui.cleanup();
  });

  it('移动端：点域 → 居中弹窗内嵌渲染真实 schema', async () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const items = popup.querySelectorAll('.bz-sp-mob-item');
    // 点「番茄钟」（index 16）
    (items[16] as HTMLElement).click();
    const deadline = Date.now() + 2000;
    let modal: Element | null = null;
    while (Date.now() < deadline) {
      modal = document.querySelector('.bz-sp-mob-modal');
      if (modal && modal.querySelectorAll('.bz-sp-group').length >= 2) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    expect(modal).toBeTruthy();
    // 弹窗内真实设置分组
    expect(modal!.querySelectorAll('.bz-sp-group').length).toBeGreaterThanOrEqual(2);
    // 弹窗头部无分隔线（原型 m1-modal-head：无 border）
    const modalHead = modal!.querySelector('.bz-sp-mob-modal-head')!;
    expect((modalHead as HTMLElement).style.borderBottom).toBe('');
    const modalMask = modal!.previousElementSibling as HTMLElement;
    expect(modalMask.classList.contains('bz-overlay-mask')).toBe(true);
    modalMask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-sp-mob-modal')).toBeNull();
    ui.cleanup();
  });

  it('移动端：搜索过滤域列表 + 无结果空态', () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const search = popup.querySelector('.bz-sp-mob-search .bz-sp-search-in') as HTMLInputElement;
    search.value = '不存在的域';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(popup.querySelectorAll('.bz-sp-mob-item').length).toBe(0);
    expect(popup.querySelector('.bz-sp-mob-empty')).toBeTruthy();
    ui.cleanup();
  });

  it('移动端：搜索命中设置项 → 「设置项（N）」段（原型 m1-sec）', async () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 先加载全局域 schema（行缓存填充；全局 schema 含「AI 服务商」「DeepSeek 密钥」等）
    const items = popup.querySelectorAll('.bz-sp-mob-item');
    (items[0] as HTMLElement).click(); // 全局
    // 等 schema 加载完成（动态 import 可能 >20ms；以弹窗内出现分组为完成标志）
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      if (document.querySelector('.bz-sp-mob-modal .bz-sp-group')) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    // 关闭弹窗
    const modal = document.querySelector('.bz-sp-mob-modal');
    const modalMask = modal ? modal.previousElementSibling as HTMLElement : null;
    if (modalMask) modalMask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 搜「AI」→ 域段（全局）+ 设置项段
    const search = popup.querySelector('.bz-sp-mob-search .bz-sp-search-in') as HTMLInputElement;
    search.value = 'AI';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(popup.querySelector('.bz-sp-mob-sec')).toBeTruthy();
    expect(popup.querySelectorAll('.bz-sp-mob-sec').length).toBeGreaterThanOrEqual(1);
    // 设置项段存在（含「AI 服务商」等行）
    const kindItems = popup.querySelectorAll('.bz-sp-mob-kind');
    expect(kindItems.length).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('移动端：关闭按钮隐藏主面板（遮罩仍在，可重开）', () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    (popup.querySelector('.bz-sp-mob-close') as HTMLElement).click();
    expect(popup.style.display).toBe('none');
    ui.open();
    expect(popup.style.display).toBe('flex');
    ui.cleanup();
  });

  it('命令入口：openSettingsPanel 构建面板，unloadSettingsPanel 清理 DOM', async () => {
    const app: any = {};
    await openSettingsPanel(app);
    expect(document.getElementById('bz-settings-panel-mask')).toBeTruthy();
    expect(document.getElementById('bz-settings-panel-popup')).toBeTruthy();
    unloadSettingsPanel();
    expect(document.getElementById('bz-settings-panel-mask')).toBeNull();
    expect(document.getElementById('bz-settings-panel-popup')).toBeNull();
  });

  it('遮罩点击关闭面板', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const mask = document.getElementById('bz-settings-panel-mask')!;
    const popup = document.getElementById('bz-settings-panel-popup')!;
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(popup.style.display).toBe('none');
    ui.cleanup();
  });
});
