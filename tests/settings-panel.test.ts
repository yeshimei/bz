/**
 * 设置面板域测试（settings-panel，ADR-0080）
 * UI 层：桌面侧栏工作台（影院式整宽头行）构建 / 域导航切换内嵌渲染真实 schema /
 *       搜索过滤 / 移动命令面板构建 / 域设置弹窗 / 关闭 / 卸载清理。
 * 核心断言：面板内嵌渲染 = 渲染器 renderPanelSchema（与 ⚙️ 弹窗同数据源、同绑定通道，
 *   控件全部走组件库（.bz-input/.bz-sw/.bz-select/.bz-chip/.bz-btn…），图标一律 lucide
 *   （setIcon mock 记 data-icon）——面板内不出现 Obsidian 原生 .setting-item 设置行嵌套，
 *   也不残留 emoji 图标（收编铁律 6）。
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

/** emoji 区间（面板收编后禁止 emoji 当图标，回归守卫） */
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

describe('设置面板（settings-panel）', () => {
  /** 共享 settings 单例（provider 每次返回同对象；beforeEach 重置） */
  let panelState: Record<string, unknown>;
  beforeEach(() => {
    resetObsidianMocks();
    mobileFlag = false;
    document.body.innerHTML = '';
    unloadSettingsPanel();
    (escManager as any).handlers = new Map();
    // 共享单例 state（每次 getSettings 返回同一对象——否则 select 等写入落到临时对象丢失）
    panelState = { settingsPanelMobileDefaultFullscreen: true } as any;
    setSettingsProvider(() => panelState as any);
    // 注入 app（review schema 构造经 getApp；mock 与其它域测试一致）
    setApp({ vault: new MockVault(), workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  });

  it('桌面端：构建侧栏工作台（整宽头行仅标题 + 搜索 + 域导航 + 右侧面板）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(popup).toBeTruthy();
    expect(popup.classList.contains('bz-sp-desk')).toBe(true);
    // 头行：popup 首子元素 = 影院式整宽头行，仅标题「设置」（无 emoji、无工具钮）
    const head = popup.firstElementChild as HTMLElement;
    expect(head.classList.contains('bz-sp-head')).toBe(true);
    expect(head.querySelector('.bz-sp-head-title')!.textContent).toBe('设置');
    expect(head.querySelectorAll('.bz-sp-head-tools *').length).toBe(0);
    expect(popup.querySelector('.bz-sp-brand-name')).toBeNull();
    expect(popup.querySelector('.bz-sp-logo')).toBeNull();
    // 无设置项的域不在左侧列表显示（用户拍板）：22 域中 8 个无 schema（聚合讯/阅读报告/做题家/
    // 自动摘要/入口页/附件搬移/B站下载/小橘陪伴猫）→ 可见 15 个（+影院 cinema +书架墙 bookshelf）
    expect(popup.querySelectorAll('.bz-sp-nav-item').length).toBe(17);
    // 无底部快捷键提示 / 无右侧导航条 / 无面包屑
    expect(popup.querySelector('.bz-sp-foot')).toBeNull();
    expect(popup.querySelector('.bz-sp-crumb')).toBeNull();
    // 徽标动态计算：加载前 ·；无设置域 —；schema 加载后 = 可见组数
    let badges = [...popup.querySelectorAll('.bz-sp-nav-count')].map((b) => b.textContent);
    // 等全局 schema 加载完成（含 AI/数据存储路径两分组）→ 全局徽标回填可见组数 2
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && (badges[0] === '·' || badges[3] === '·')) {
      await new Promise((r) => setTimeout(r, 30));
      badges = [...popup.querySelectorAll('.bz-sp-nav-count')].map((b) => b.textContent);
    }
    expect(badges[0]).toBe('2'); // 全局：AI + 数据存储路径（桌面端移动端组不存在）
    expect(badges[3]).toBe('4'); // 待办（todo 新域，插入备忘录后 index 3：桌面可见 4 组）
    expect(badges[4]).toBe('·'); // 归物本（schema 加载后桌面端无可见组）
    // 导航图标 = lucide（setIcon mock 记 data-icon；禁止 emoji）
    const navIcons = [...popup.querySelectorAll('.bz-sp-nav-item .bz-sp-nav-ic')];
    expect(navIcons.length).toBe(17);
    expect(navIcons[0].getAttribute('data-icon')).toBe('settings'); // 全局
    expect(navIcons[3].getAttribute('data-icon')).toBe('check-square'); // 待办（todo，过滤后 index 3）
    expect(navIcons[6].getAttribute('data-icon')).toBe('lock'); // 密码本（todo 插入后 index 6）
    // 无 emoji 图标残留（头行/列表/徽标全文本或 lucide）
    expect(popup.textContent).not.toMatch(EMOJI_RE);
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

  it('桌面端：per-provider 上下文窗口/最大输出 token 渲染为组件库 number 输入（无原生 Setting 嵌套）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 找「上下文窗口」行：自绘行 .bz-sp-set-name 文本匹配
    const rows = [...popup.querySelectorAll<HTMLElement>('.bz-sp-set-row')];
    const ctxRow = rows.find((r) => r.querySelector('.bz-sp-set-name')?.textContent === '上下文窗口');
    const maxRow = rows.find((r) => r.querySelector('.bz-sp-set-name')?.textContent === '最大输出 token');
    expect(ctxRow, '上下文窗口行存在').toBeTruthy();
    expect(maxRow, '最大输出 token 行存在').toBeTruthy();
    for (const rowEl of [ctxRow!, maxRow!]) {
      const input = rowEl.querySelector<HTMLInputElement>('input.bz-input');
      expect(input, '行内组件库输入框存在').toBeTruthy();
      expect(input!.type).toBe('number');
      expect(input!.classList.contains('num'), '数字行宽度修饰').toBe(true);
      expect(rowEl.querySelector('.setting-item'), '无原生 Setting 嵌套').toBeFalsy();
    }
    ui.cleanup();
  });

  it('桌面端：切 AI 服务商 → 上下文窗口/最大输出 token 输入值联动刷新（refreshKey）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    const ctxInput = () => {
      const rows = [...popup.querySelectorAll<HTMLElement>('.bz-sp-set-row')];
      const row = rows.find((r) => r.querySelector('.bz-sp-set-name')?.textContent === '上下文窗口')!;
      return row.querySelector<HTMLInputElement>('input.bz-input')!;
    };
    // 初始 = 未设置回落 opencode-go（ctx 131072）；下拉初始空值无高亮
    const sel = popup.querySelector('.bz-select')!; // AI 服务商下拉（组内首个下拉）
    const before = ctxInput().value;
    expect(before).toBe('131072');
    // 切 deepseek（注册表第 1 项，ctx 默认 65536）→ ctx 输入值应联动刷新
    sel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const opt = popup.querySelectorAll('.bz-select-item')[0] as HTMLElement; // deepseek
    opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // refreshKey 联动写回输入框（渲染器 valueRefreshes）
    const after = ctxInput().value;
    expect(after).not.toBe(before);
    expect(Number(after)).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('桌面端：分组卡图标为 lucide（schema 图标名 → setIcon data-icon）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 全局域分组：AI（sparkles）+ 数据存储路径（folder-open）
    const icons = [...popup.querySelectorAll('.bz-sp-group-icon')].map((i) => i.getAttribute('data-icon'));
    expect(icons.length).toBeGreaterThanOrEqual(2);
    expect(icons).toContain('sparkles');
    expect(icons).toContain('folder-open');
    ui.cleanup();
  });

  it('桌面端：面板容器带整宽头行 + 面板壳（列布局：头行在内容之上）', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(popup.classList.contains('bz-sp-desk')).toBe(true);
    const head = popup.querySelector(':scope > .bz-sp-head') as HTMLElement;
    const body = popup.querySelector(':scope > .bz-sp-desk-body') as HTMLElement;
    expect(head).toBeTruthy();
    expect(body).toBeTruthy();
    // 头行在内容区之前（整宽头条置于侧栏+内容之上）
    expect(head.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    ui.cleanup();
  });

  it('桌面端：点击域导航切换 → 内嵌渲染该域真实 schema', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    // 点击「复习计划」→ 内嵌渲染 review schema（检查提醒/做题家等分组）
    const reviewItem = Array.from(items).find((el) => el.textContent?.includes('复习计划')) as HTMLElement;
    expect(reviewItem).toBeTruthy();
    reviewItem.click();
    await waitGroups(popup, 5);
    const groups = popup.querySelectorAll('.bz-sp-group');
    const paneHtml = popup.querySelector('.bz-sp-pane')!.innerHTML;
    // 若为空态，把描述（错误消息）打出来
    const errDesc = popup.querySelector('.bz-empty-desc');
    expect(groups.length, 'err: ' + (errDesc ? errDesc.textContent : 'none')).toBeGreaterThanOrEqual(5);
    // 设置行真实渲染（组件库开关/输入等）
    expect(popup.querySelectorAll('.bz-sp-set-row').length).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('桌面端：番茄钟域内嵌渲染（时间方案/行为分组）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    // 点「番茄钟」（列表含 bookshelf 后不按硬索引，按文本找）
    const pomoItem = Array.from(items).find((el) => el.textContent?.includes('番茄钟')) as HTMLElement;
    expect(pomoItem).toBeTruthy();
    pomoItem.click();
    await waitGroups(popup, 2);
    const groups = popup.querySelectorAll('.bz-sp-group');
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(popup.querySelectorAll('.bz-sp-set-row').length).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('桌面端：组件库开关点击切换（真实交互，番茄钟域）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 切到番茄钟（index 13，行为组有多个开关）
    (popup.querySelectorAll('.bz-sp-nav-item')[13] as HTMLElement).click();
    await waitGroups(popup, 2);
    const sw = popup.querySelector('.bz-sw');
    expect(sw).toBeTruthy();
    expect(sw!.getAttribute('role')).toBe('switch');
    const before = sw!.classList.contains('on');
    sw!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sw!.classList.contains('on')).toBe(!before);
    expect(sw!.getAttribute('aria-checked')).toBe(String(!before));
    ui.cleanup();
  });

  it('桌面端：组件库下拉点击弹出选项并选择（番茄钟预设）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 切到番茄钟（时间方案组有预设下拉；按文本定位）
    const pomoItem = Array.from(popup.querySelectorAll('.bz-sp-nav-item')).find((el) => el.textContent?.includes('番茄钟')) as HTMLElement;
    expect(pomoItem).toBeTruthy();
    pomoItem.click();
    await waitGroups(popup, 2);
    const sel = popup.querySelector('.bz-select');
    expect(sel).toBeTruthy();
    // 单次点击即打开
    sel!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const menu = popup.querySelector('.bz-select-menu');
    expect(menu).toBeTruthy();
    const opt = menu!.querySelectorAll('.bz-select-item')[1] as HTMLElement;
    const before = popup.querySelector('.bz-select-val')!.textContent;
    opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(popup.querySelector('.bz-select-val')!.textContent).not.toBe(before);
    // 选中后菜单关闭；重开菜单 → 选中态/✓ 跟随新值（不再显示旧选项）
    expect(popup.querySelector('.bz-select-menu')).toBeNull();
    sel!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const menu2 = popup.querySelector('.bz-select-menu');
    expect(menu2).toBeTruthy();
    const onOpt = [...menu2!.querySelectorAll('.bz-select-item')].find((o) => o.classList.contains('is-on'));
    expect(onOpt).toBeTruthy();
    expect(onOpt!.querySelector('.bz-select-item-ck')).toBeTruthy();
    expect(onOpt!.textContent).toContain(popup.querySelector('.bz-select-val')!.textContent!);
    ui.cleanup();
  });

  it('桌面端：路径行自绘渲染（组件库 chips + 选择按钮，无原生设置行嵌套）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 切到日记本（index 1，「目录」组有日记目录/影视目录/信件目录 path 行）
    (popup.querySelectorAll('.bz-sp-nav-item')[1] as HTMLElement).click();
    await waitGroups(popup, 3);
    // 面板内不得出现 Obsidian 原生设置行
    // 「日记目录」行 = 自绘 .bz-sp-set-row + .bz-sp-chips（空态 = 选择按钮）
    const chips = popup.querySelector('.bz-sp-chips');
    expect(chips).toBeTruthy();
    const pathBtn = chips!.querySelector('.bz-sp-path-btn') as HTMLElement;
    expect(pathBtn).toBeTruthy();
    expect(pathBtn.classList.contains('bz-btn'), '按钮走组件库 bz-btn').toBe(true);
    // 无原生 .setting-item 嵌套（杜绝「设置行里再套一个设置行」）
    expect(popup.querySelector('.bz-sp-pane .setting-item')).toBeNull();
    // 空态（未设置路径）只显示选择按钮，无 chip
    const pathRow = chips!.closest('.bz-sp-set-row')!;
    expect(pathRow.querySelector('.bz-sp-set-name')!.textContent).toBe('日记目录');
    expect(pathBtn.textContent).toBe('选择…');
    ui.cleanup();
  });

  it('桌面端：无设置项域显示空态（组件库 bz-empty）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    // 归物本（schema 仅含移动端组，桌面门控隐藏 → 显示「暂无设置项」空态）
    const belongItem = Array.from(items).find((el) => el.textContent?.includes('归物本')) as HTMLElement;
    expect(belongItem).toBeTruthy();
    belongItem.click();
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      if (popup.querySelector('.bz-empty')) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    expect(popup.querySelector('.bz-empty')).toBeTruthy();
    expect(popup.querySelector('.bz-empty-title')!.textContent).toContain('暂无设置项');
    expect(popup.querySelector('.bz-empty .bz-ic[data-icon]'), '空态图标为 lucide').toBeTruthy();
    ui.cleanup();
  });

  it('桌面端：搜索过滤域导航', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    search.value = '番茄';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('番茄钟');
    ui.cleanup();
  });

  it('桌面端：无设置项的域不在左侧列表显示（含搜索）', () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 只看域名（nav-name），避免描述包含（如剪藏本「网页剪藏与聚合讯」）误判
    const names = [...popup.querySelectorAll('.bz-sp-nav-name')].map((b) => b.textContent);
    expect(names).toHaveLength(17);
    // 8 个无设置域（聚合讯/阅读报告/做题家/自动摘要/入口页/附件搬移/B站下载/小橘陪伴猫）一律不出现
    for (const n of ['聚合讯', '阅读报告', '做题家', '自动摘要', '入口页', '附件搬移', 'B站下载', '小橘陪伴猫']) {
      expect(names).not.toContain(n);
    }
    // 搜索也搜不到该无设置域（无设置域不占列表位；但描述含词的可见域如「剪藏本」仍可能命中）
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    search.value = '聚合讯';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const hitNames = [...popup.querySelectorAll('.bz-sp-nav-name')].map((b) => b.textContent);
    expect(hitNames).not.toContain('聚合讯');
    // 但可见域搜索正常
    search.value = '密码本';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(popup.querySelectorAll('.bz-sp-nav-item').length).toBe(1);
    ui.cleanup();
  });

  it('移动端：无设置项的域不在列表显示（含搜索）', () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 只看域名（mob-name），避免描述包含误判
    const names = [...popup.querySelectorAll('.bz-sp-mob-name')].map((b) => b.textContent);
    expect(names).toHaveLength(17);
    expect(names).not.toContain('聚合讯');
    expect(names).not.toContain('小橘陪伴猫');
    // 搜索也搜不到该无设置域
    const search = popup.querySelector('.bz-sp-mob-search .bz-input') as HTMLInputElement;
    search.value = '聚合讯';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const hitNames = [...popup.querySelectorAll('.bz-sp-mob-name')].map((b) => b.textContent);
    expect(hitNames).not.toContain('聚合讯');
    // 但可见域搜索正常
    search.value = '密码本';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(popup.querySelectorAll('.bz-sp-mob-item').length).toBe(1);
    ui.cleanup();
  });

  it('桌面端：域切换后侧栏徽标回填（组数）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 番茄钟有 2 组（时间方案/行为）——加载后徽标回填（按文本定位，勿用硬索引）
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    const pomoItem = Array.from(items).find((el) => el.textContent?.includes('番茄钟')) as HTMLElement;
    expect(pomoItem).toBeTruthy();
    pomoItem.click();
    await waitGroups(popup, 2);
    const badge = pomoItem.querySelector('.bz-sp-nav-count')!;
    expect(badge.textContent).toBe('2');
    ui.cleanup();
  });

  it('移动端：构建命令面板（头行标题+关闭钮+搜索+域列表，主面板真全屏）', () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    expect(popup.classList.contains('bz-sp-mobile')).toBe(true);
    expect(popup.classList.contains('bz-win-mfs')).toBe(true);
    // 头行：标题「设置」无 emoji + 关闭图标钮（lucide x）
    const headTitle = popup.querySelector('.bz-sp-head-title')!;
    expect(headTitle.textContent).toBe('设置');
    const closeBtn = popup.querySelector('.bz-sp-mob-close') as HTMLElement;
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.querySelector('.bz-ic[data-icon="x"]')).toBeTruthy();
    expect(popup.textContent).not.toMatch(EMOJI_RE);
    // 无设置项的域不在列表显示（用户拍板）：22 域 → 可见 15 个（+影院 cinema +书架墙 bookshelf）
    expect(popup.querySelectorAll('.bz-sp-mob-item').length).toBe(17);
    // 移动列表图标为 lucide（tile 内 svg 容器）
    const firstIc = popup.querySelector('.bz-sp-mob-item .bz-sp-mob-ic .bz-ic');
    expect(firstIc).toBeTruthy();
    expect(firstIc!.getAttribute('data-icon')).toBe('settings');
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
    // 点「番茄钟」（列表含 bookshelf 后不按硬索引，按文本找）
    const pomoItem = Array.from(items).find((el) => el.textContent?.includes('番茄钟')) as HTMLElement;
    expect(pomoItem).toBeTruthy();
    pomoItem.click();
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
    // 弹窗头行：图标方块（lucide）+ 域名 + 关闭钮；无分隔线（原型 m1-modal-head：无 border）
    const modalHead = modal!.querySelector('.bz-sp-mob-modal-head')!;
    expect((modalHead as HTMLElement).style.borderBottom).toBe('');
    expect(modalHead.querySelector('.bz-sp-mob-modal-title')!.textContent).toBe('番茄钟');
    expect(modalHead.querySelector('.bz-sp-mob-modal-ic .bz-ic[data-icon="timer"]')).toBeTruthy();
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
    const search = popup.querySelector('.bz-sp-mob-search .bz-input') as HTMLInputElement;
    search.value = '不存在的域';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(popup.querySelectorAll('.bz-sp-mob-item').length).toBe(0);
    expect(popup.querySelector('.bz-sp-mob-empty')).toBeTruthy();
    ui.cleanup();
  });

  it('移动端：搜索命中设置项 → 「设置项（N）」段', async () => {
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
    const search = popup.querySelector('.bz-sp-mob-search .bz-input') as HTMLInputElement;
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
