/**
 * 设置面板域测试（settings-panel，ADR-0080）
 * UI 层：桌面侧栏工作台（影院式整宽头行）构建 / 域导航切换内嵌渲染真实 schema /
 *       搜索过滤 / 移动命令面板构建 / 域设置弹窗 / 关闭 / 卸载清理。
 * 核心断言：面板内嵌渲染 = 渲染器 renderPanelSchema（与 ⚙️ 弹窗同数据源、同绑定通道，
 *   控件全部域内自绘（.bz-input/.bz-sw/.bz-select/.bz-sp-chip/.bz-sp-btn/.bz-sp-cardpick…），图标一律 lucide
 *   （setIcon mock 记 data-icon）——面板内不出现 Obsidian 原生 .setting-item 设置行嵌套，
 *   也不残留 emoji 图标（收编铁律 6）。
 * 行为单源（ADR-0106，issue 245 范式）：行为唯一真理 = 域 ui.ts，原型壳 = 双 iframe 评审壳
 *   （prototype.app.js 已退役删除，不再有「app.js ↔ ui.ts」镜像对齐锚点）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from './mock-obsidian-entry';
import { SettingsPanelUI } from '../src/settings-panel/ui';
import { openSettingsPanel, unloadSettingsPanel } from '../src/settings-panel';
import { escManager } from '../src/core/esc-manager';
import { setSettingsProvider } from '../src/core/settings-provider';
import { setApp, getApp } from '../src/core/app';
import type { SettingsSchema } from '../src/core/settings-schema';
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
    panelState = { settingsPanelMobileDefaultFullscreen: true, belSkin: 'poster', belSkinTheme: 'warmwhite' } as any;
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
    // 无设置项的域不在左侧列表显示（用户拍板）；issue 186 AI 自全局拆出独立成域（通用 + AI 两项）
    // 旧书库（library）域退役：设置组删除后可见域 16 → 15；issue 201 补回忆墙 → 加载前列表 16
    // （issue 246 回忆墙/收藏本桌面得外观组后回归桌面列表 → 加载前即 17）
    expect(popup.querySelectorAll('.bz-sp-nav-item').length).toBeGreaterThanOrEqual(16);
    // 无底部快捷键提示 / 无右侧导航条；顶栏面包屑 = 「设置」（拍板 P1 系统面板布局）
    expect(popup.querySelector('.bz-sp-foot')).toBeNull();
    const crumb = popup.querySelector('.bz-sp-crumb');
    expect(crumb).toBeTruthy();
    expect(crumb!.querySelector('.bz-sp-crumb-cur')!.textContent).toBe('设置');
    // 徽标动态计算：加载前 ·；无设置域 —；schema 加载后 = 设置项总数（非分组数，issue 186）
    let badges = [...popup.querySelectorAll('.bz-sp-nav-count')].map((b) => b.textContent);
    // 等 schema 加载完成（动态 import 首次加载较慢，轮询到首个徽标回填）
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && (badges[0] === '·' || badges[3] === '·')) {
      await new Promise((r) => setTimeout(r, 30));
      badges = [...popup.querySelectorAll('.bz-sp-nav-count')].map((b) => b.textContent);
    }
    expect(badges[0]).toBe('1'); // 通用：数据存储路径 1 项（外观已独立「设置」域）
    expect(badges[1]).toBe('2'); // 设置：布局 + 主题两张卡片行（拍板 P1：外观独立域）
    expect(badges[2]).toBe('4'); // AI：服务商+模型名称+上下文+最大输出（采样参数组已退役；aiProvider 未设 → 密钥行门控隐藏）
    expect(badges[3]).toBe('14'); // 日记本（index 3）：issue 246 补外观组两卡
    expect(badges[4]).toBe('2'); // 回忆墙（index 4）：issue 246 补外观组两卡 → 桌面回归列表
    expect(badges[5]).toBe('9'); // 待办（index 5）：issue 210 补面板皮肤卡片行后 9 项
    expect(badges[6]).toBe('3'); // 归物本（index 6）：外观组布局/主题两卡 + 默认状态筛选，桌面 3 项
    expect(badges[8]).toBe('2'); // 收藏本（index 8）：issue 246 补外观组两卡 → 桌面回归列表
    // 导航图标 = lucide（setIcon mock 记 data-icon；禁止 emoji）
    const navIcons = [...popup.querySelectorAll('.bz-sp-nav-item .bz-sp-nav-ic')];
    expect(navIcons.length).toBe(17); // issue 246 回忆墙/收藏本桌面得外观组回归 → 17
    expect(navIcons[0].getAttribute('data-icon')).toBe('settings'); // 通用
    expect(navIcons[1].getAttribute('data-icon')).toBe('palette'); // 设置（拍板 P1：外观独立域）
    expect(navIcons[2].getAttribute('data-icon')).toBe('sparkles'); // AI
    expect(navIcons[3].getAttribute('data-icon')).toBe('notebook-pen'); // 日记本（enh-sweep-a：与 ribbon/磁贴同款，错开书架墙 book-open）
    expect(navIcons[4].getAttribute('data-icon')).toBe('images'); // 回忆墙
    expect(navIcons[5].getAttribute('data-icon')).toBe('check-square'); // 待办
    expect(navIcons[9].getAttribute('data-icon')).toBe('clapperboard'); // 影院（记录组 6 域后 index 9）
    // 拍板分组顺序（NAV_SECS）：…工具组 = 番茄钟/保险库/小橘陪伴猫
    expect(navIcons[14].getAttribute('data-icon')).toBe('timer'); // 番茄钟
    expect(navIcons[15].getAttribute('data-icon')).toBe('lock'); // 保险库
    expect(navIcons[16].getAttribute('data-icon')).toBe('cat'); // 小橘陪伴猫（issue 194 转可见）
    // 无 emoji 图标残留（头行/列表/徽标全文本或 lucide）
    expect(popup.textContent).not.toMatch(EMOJI_RE);
    ui.cleanup();
  });

  it('域图标单一事实源（enh-sweep-a）：导航图标全部取自 DOMAIN_ICONS，两对历史重复已错开', async () => {
    const { DOMAINS } = await import('../src/settings-panel/ui');
    const { DOMAIN_ICONS } = await import('../src/core/domain-icons');
    // 每个域的导航图标 = DOMAIN_ICONS[域 id]（一处定义、两处引用：命令表 + 本导航）
    for (const d of DOMAINS) {
      expect(d.icon, `域 ${d.id} 导航图标应取自 DOMAIN_ICONS`).toBe(DOMAIN_ICONS[d.id]);
    }
    // 两对历史重复图标错开：日记本（notebook-pen）不再与书架墙（book-open）同用；
    // 阅读报告（bar-chart-3）在导航内独占（复习报告命令侧改 calendar-check，见 smoke）
    const diary = DOMAINS.find((d) => d.id === 'diary')!;
    const shelf = DOMAINS.find((d) => d.id === 'bookshelf')!;
    const reading = DOMAINS.find((d) => d.id === 'reading-report')!;
    expect(diary.icon).toBe('notebook-pen');
    expect(diary.icon).not.toBe(shelf.icon);
    expect(reading.icon).toBe('bar-chart-3');
    // 术语统一（enh-sweep-a）：面板导航「文献笔记」→「文献盒」，与命令/磁贴同词
    expect(DOMAINS.find((d) => d.id === 'literature')!.name).toBe('文献盒');
    // 去黑话（enh-sweep-a）：描述不含「新域/ADR」类开发字样
    for (const d of DOMAINS) {
      expect(d.desc).not.toMatch(/新域|ADR-\d+/);
    }
  });

  it('桌面端：默认渲染通用域（数据存储路径），点 AI 域渲染 AI 服务商设置', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 默认域 = 通用（issue 186：AI 拆出后全局改称通用，仅剩数据存储路径一组）
    // 首次动态 import 冷加载可能超过 tick 的 20ms：改轮询等分组出现，消除时序脆断（原 await tick()）
    expect(await waitGroups(popup, 1)).toBe(true);
    let groups = popup.querySelectorAll('.bz-sp-group');
    expect(groups.length).toBe(1);
    // 外观已独立「设置」域（拍板 P1 十六轮）：通用域恢复单组 = 数据存储路径
    expect(groups[0].querySelector('.bz-sp-group-name')!.textContent).toBe('数据存储路径');
    // 点 AI 域 → 内嵌渲染 AI 组（服务商 select 等）
    const aiItem = Array.from(popup.querySelectorAll('.bz-sp-nav-item')).find(
      (el) => el.textContent?.includes('AI')
    ) as HTMLElement;
    expect(aiItem).toBeTruthy();
    aiItem.click();
    await waitGroups(popup, 1);
    groups = popup.querySelectorAll('.bz-sp-group');
    expect(groups.length).toBe(1); // 仅 AI 组（采样参数组已退役）
    expect(groups[0].querySelector('.bz-sp-group-name')!.textContent).toBe('AI');
    expect(popup.querySelectorAll('.bz-sp-set-row').length).toBeGreaterThan(0);
    ui.cleanup();
  });

  it('桌面端：AI 域 per-provider 上下文窗口/最大输出 token 渲染为组件库 number 输入（无原生 Setting 嵌套）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 切到 AI 域（issue 186 AI 独立成域）
    const aiItem = Array.from(popup.querySelectorAll('.bz-sp-nav-item')).find(
      (el) => el.textContent?.includes('AI')
    ) as HTMLElement;
    aiItem.click();
    await waitGroups(popup, 1);
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
    // 切到 AI 域（issue 186 AI 独立成域）
    const aiItem = Array.from(popup.querySelectorAll('.bz-sp-nav-item')).find(
      (el) => el.textContent?.includes('AI')
    ) as HTMLElement;
    aiItem.click();
    await waitGroups(popup, 1);
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
    // 通用域分组：数据存储路径（folder-open）
    let icons = [...popup.querySelectorAll('.bz-sp-group-icon')].map((i) => i.getAttribute('data-icon'));
    expect(icons).toEqual(['folder-open']);
    // AI 域分组：AI（sparkles）
    const aiItem = Array.from(popup.querySelectorAll('.bz-sp-nav-item')).find(
      (el) => el.textContent?.includes('AI')
    ) as HTMLElement;
    aiItem.click();
    await waitGroups(popup, 1);
    icons = [...popup.querySelectorAll('.bz-sp-group-icon')].map((i) => i.getAttribute('data-icon'));
    expect(icons).toEqual(['sparkles']); // 采样参数组已退役，仅 AI 单组
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
    // isChild 子项行挂 child 语义类（enh-sweep-a：配层级降级透明度样式；隐藏行也带类）
    const childRows = popup.querySelectorAll('.bz-sp-set-row.child');
    expect(childRows.length).toBeGreaterThan(0);
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
    // 切到番茄钟（行为组有多个开关；按文本找，不依赖硬索引）
    const pomoItem = Array.from(popup.querySelectorAll('.bz-sp-nav-item')).find((el) => el.textContent?.includes('番茄钟')) as HTMLElement;
    pomoItem.click();
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

  it('桌面端：「设置」域外观组——布局/主题各一张卡片卡，点主题卡落盘 chenhun（拍板 P1 十六轮）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 点导航「设置」域 → 渲染单组「外观」：上行布局（经纬）+ 下行主题（晨昏），各一张卡
    const apItem = Array.from(popup.querySelectorAll('.bz-sp-nav-item')).find(
      (el) => el.textContent?.includes('设置')
    ) as HTMLElement;
    apItem.click();
    await tick();
    expect(await waitGroups(popup, 1)).toBe(true);
    const group = popup.querySelector('.bz-sp-group')!;
    expect(group.querySelector('.bz-sp-group-name')!.textContent).toBe('外观');
    const picks = group.querySelectorAll('.bz-sp-cardpick');
    expect(picks.length).toBe(2);
    const cards0 = picks[0].querySelectorAll('.bz-sp-cardpick-card');
    const cards1 = picks[1].querySelectorAll('.bz-sp-cardpick-card');
    expect(cards0.length).toBe(1);
    expect(cards0[0].textContent).toContain('经纬');
    expect(cards1.length).toBe(1);
    expect(cards1[0].textContent).toContain('晨昏');
    expect(cards0[0].classList.contains('is-on')).toBe(true); // 默认经纬选中
    expect(cards1[0].classList.contains('is-on')).toBe(true); // 默认晨昏选中
    // 点卡片（默认已选中 = 空值回退首选项口径，uiCardChoice 同值点击直接 return 不重复落盘）
    (cards1[0] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();
    expect(cards1[0].classList.contains('is-on')).toBe(true);
    ui.cleanup();
  });

  it('桌面端：归物本外观组——布局（大字报）/主题（暖白）占位单卡，layoutKey 过滤后主题行单卡（拍板 C）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const belItem = Array.from(popup.querySelectorAll('.bz-sp-nav-item')).find(
      (el) => el.textContent?.includes('归物本')
    ) as HTMLElement;
    expect(belItem).toBeTruthy();
    belItem.click();
    // 归物本桌面可见组 = 外观 + 显示（移动端组按端剔除）
    expect(await waitGroups(popup, 2)).toBe(true);
    const group = popup.querySelector('.bz-sp-group')!;
    expect(group.querySelector('.bz-sp-group-name')!.textContent).toBe('外观');
    const picks = group.querySelectorAll('.bz-sp-cardpick');
    expect(picks.length).toBe(2);
    const cards0 = picks[0].querySelectorAll('.bz-sp-cardpick-card');
    const cards1 = picks[1].querySelectorAll('.bz-sp-cardpick-card');
    // 占位单卡：布局「大字报」/ 主题「暖白」（layoutKey=belSkin 过滤，poster 配套 warmwhite）
    expect(cards0.length).toBe(1);
    expect(cards0[0].textContent).toContain('大字报');
    expect(cards1.length).toBe(1);
    expect(cards1[0].textContent).toContain('暖白');
    expect(cards0[0].classList.contains('is-on')).toBe(true);
    expect(cards1[0].classList.contains('is-on')).toBe(true);
    // prevClass 预览挂卡内 mini 容器（视觉由 settings-panel/styles.css 承载）
    expect(cards0[0].querySelector('.bz-sp-mini.bz-sp-prev-poster')).toBeTruthy();
    expect(cards1[0].querySelector('.bz-sp-mini.bz-sp-prev-warmwhite')).toBeTruthy();
    ui.cleanup();
  });

  it('占位域外观组遍历锚点（issue 246）：9 域 schema 组[0] 均为外观组（布局 default + 域化主题，layoutKey 契约）', async () => {
    // schema 层直接断言（渲染链已被上方待办/归物本/设置域锚点覆盖）；[域id, 布局键, 主题键, 加载器]
    const cases: Array<[string, string, string, () => Promise<SettingsSchema>]> = [
      ['日记本', 'diarySkin', 'diarySkinTheme', async () => (await import('../src/diary/ui/panel')).diarySettingsSchema()],
      ['回忆墙', 'diaryWallSkin', 'diaryWallSkinTheme', async () => (await import('../src/diary-wall/settings')).diaryWallSettingsSchema()],
      ['剪藏本', 'clipbookSkin', 'clipbookSkinTheme', async () => (await import('../src/clipbook/ui')).clipbookSettingsSchema()],
      ['收藏本', 'favoritesSkin', 'favoritesSkinTheme', async () => (await import('../src/favorites/ui')).favoritesSettingsSchema()],
      ['复习计划', 'reviewSkin', 'reviewSkinTheme', async () => (await import('../src/review/settings-schema')).reviewSettingsSchema({ app: getApp(), dataManager: {} as never })],
      ['第二大脑', 'secondbrainSkin', 'secondbrainSkinTheme', async () => (await import('../src/secondbrain/panel')).secondBrainSettingsSchema()],
      ['文献盒', 'literatureSkin', 'literatureSkinTheme', async () => (await import('../src/literature/ui')).literatureSettingsSchema()],
      ['番茄钟', 'pomodoroSkin', 'pomodoroSkinTheme', async () => (await import('../src/pomodoro/ui')).pomodoroSettingsSchema()],
      ['保险库', 'encryptSkin', 'encryptSkinTheme', async () => (await import('../src/encrypt/ui')).encryptSettingsSchema()],
    ];
    for (const [name, layoutKey, themeKey, load] of cases) {
      const schema = await load();
      const look = schema.groups[0];
      expect(look.name, `${name} 组[0] 应为外观组`).toBe('外观');
      expect(look.rows, `${name} 外观组应两行`).toHaveLength(2);
      const [layout, theme] = look.rows as any[];
      expect(layout.type, `${name} 布局行`).toBe('choiceCards');
      expect(layout.binding.key).toBe(layoutKey);
      expect(layout.options).toHaveLength(1);
      expect(layout.options[0].value).toBe('default');
      expect(theme.type).toBe('choiceCards');
      expect(theme.binding.key).toBe(themeKey);
      expect(theme.layoutKey).toBe(layoutKey);
      expect(theme.options).toHaveLength(1);
      expect(theme.options[0].layout).toBe('default');
      expect(typeof theme.options[0].prevClass).toBe('string');
    }
  });

  it('桌面端：路径行自绘渲染（组件库 chips + 选择按钮，无原生设置行嵌套）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 切到日记本（「目录」组有日记目录/影视目录/信件目录 path 行；按文本定位）
    const diaryItem = Array.from(popup.querySelectorAll('.bz-sp-nav-item')).find(
      (el) => el.textContent?.includes('日记本')
    ) as HTMLElement;
    expect(diaryItem).toBeTruthy();
    diaryItem.click();
    await waitGroups(popup, 3);
    // 面板内不得出现 Obsidian 原生设置行
    // 「日记目录」行 = 自绘 .bz-sp-set-row + .bz-sp-chips（空态 = 选择按钮）
    const chips = popup.querySelector('.bz-sp-chips');
    expect(chips).toBeTruthy();
    const pathBtn = chips!.querySelector('.bz-sp-path-btn') as HTMLElement;
    expect(pathBtn).toBeTruthy();
    expect(pathBtn.classList.contains('bz-sp-btn'), '按钮走域内自绘 bz-sp-btn').toBe(true);
    // 无原生 .setting-item 嵌套（杜绝「设置行里再套一个设置行」）
    expect(popup.querySelector('.bz-sp-pane .setting-item')).toBeNull();
    // 空态（未设置路径）只显示选择按钮，无 chip
    const pathRow = chips!.closest('.bz-sp-set-row')!;
    expect(pathRow.querySelector('.bz-sp-set-name')!.textContent).toBe('日记目录');
    expect(pathBtn.textContent).toBe('选择…');
    ui.cleanup();
  });

  it('桌面端：路径行回落显示（bookshelfFolderPath 空值时 chip 显示实际生效目录，旧 library 键存量值优先）', async () => {
    // 场景 1：新键未设 + 旧 libraryFolderPath 存量值 → 回落 chip 显示旧目录
    (panelState as any).libraryFolderPath = '旧书库';
    const ui1 = new SettingsPanelUI();
    ui1.open();
    const popup1 = document.getElementById('bz-settings-panel-popup')!;
    const shelfItem1 = Array.from(popup1.querySelectorAll('.bz-sp-nav-item')).find(
      (el) => el.textContent?.includes('书库')
    ) as HTMLElement;
    expect(shelfItem1).toBeTruthy();
    shelfItem1.click();
    expect(await waitGroups(popup1, 1)).toBe(true);
    const row1 = Array.from(popup1.querySelectorAll('.bz-sp-set-row')).find(
      (el) => el.querySelector('.bz-sp-set-name')?.textContent === '书库文件夹'
    ) as HTMLElement;
    expect(row1).toBeTruthy();
    const chip1 = row1.querySelector('.bz-sp-chip--locked') as HTMLElement;
    expect(chip1, '空值时显示回落目录锁定 chip').toBeTruthy();
    expect(chip1.textContent).toContain('旧书库');
    // 有 chip 即无按钮（2026-09-08 拍板：按钮仅空态在场）；chip 点击重开选择器
    expect(row1.querySelector('.bz-sp-path-btn')).toBeNull();
    chip1.click();
    expect(document.querySelector('.bz-sp-picker-mask'), '回落 chip 点击打开 dir-picker').toBeTruthy();
    (document.querySelector('.bz-sp-picker-foot .bz-sp-btn') as HTMLElement).click(); // 取消关闭
    expect(document.querySelector('.bz-sp-picker-mask')).toBeNull();
    ui1.cleanup();
    delete (panelState as any).libraryFolderPath;

    // 场景 2：新旧键都未设 → 回落缺省「书库」
    const ui2 = new SettingsPanelUI();
    ui2.open();
    const popup2 = document.getElementById('bz-settings-panel-popup')!;
    (Array.from(popup2.querySelectorAll('.bz-sp-nav-item')).find(
      (el) => el.textContent?.includes('书库')
    ) as HTMLElement).click();
    expect(await waitGroups(popup2, 1)).toBe(true);
    const row2 = Array.from(popup2.querySelectorAll('.bz-sp-set-row')).find(
      (el) => el.querySelector('.bz-sp-set-name')?.textContent === '书库文件夹'
    ) as HTMLElement;
    expect(row2.querySelector('.bz-sp-chip--locked')?.textContent).toContain('书库');
    ui2.cleanup();

    // 场景 3：显式设置后回落 chip 消失（值 chip 接管，可移除）
    (panelState as any).bookshelfFolderPath = '我的书';
    const ui3 = new SettingsPanelUI();
    ui3.open();
    const popup3 = document.getElementById('bz-settings-panel-popup')!;
    (Array.from(popup3.querySelectorAll('.bz-sp-nav-item')).find(
      (el) => el.textContent?.includes('书库')
    ) as HTMLElement).click();
    expect(await waitGroups(popup3, 1)).toBe(true);
    const row3 = Array.from(popup3.querySelectorAll('.bz-sp-set-row')).find(
      (el) => el.querySelector('.bz-sp-set-name')?.textContent === '书库文件夹'
    ) as HTMLElement;
    expect(row3.querySelector('.bz-sp-chip--locked')).toBeNull();
    expect(row3.textContent).toContain('我的书');
    // 显式值 chip 在场同样隐藏按钮（chip 点击重开选择器）
    expect(row3.querySelector('.bz-sp-path-btn')).toBeNull();
    ui3.cleanup();
    delete (panelState as any).bookshelfFolderPath;
  });

  it('桌面端：路径行 chips 重渲清旧值（回归：dir-picker 选用后 muted 占位不得残留）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 默认域 = 通用：数据存储路径 path 行（空态 = 仅选择按钮，灰字占位 chip 已退役）
    expect(await waitGroups(popup, 1)).toBe(true);
    const chips = popup.querySelector('.bz-sp-chips') as HTMLElement;
    expect(chips).toBeTruthy();
    expect(chips.querySelector('.bz-sp-chip--muted')).toBeNull();
    // 打开 dir-picker（目录聚合走 MockVault；轮询至目录扫描完成——加载占位行同为
    // .bz-sp-picker-row 但无点击行为，须等到真实目录行（库根目录）出现）
    chips.querySelector('.bz-sp-path-btn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-sp-picker-mask')).toBeTruthy();
    const deadline = Date.now() + 5000;
    let row: Element | null = null;
    while (Date.now() < deadline) {
      row = [...document.querySelectorAll('.bz-sp-picker-row')].find((r) => r.textContent?.includes('（库根目录）')) ?? null;
      if (row) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    expect(row, 'dir-picker 目录行就绪').toBeTruthy();
    (row as HTMLElement).click();
    (document.querySelector('.bz-sp-picker-foot .bz-sp-btn--primary') as HTMLElement).click();
    await tick();
    // 重渲后：唯一 chip =（库根目录）；muted 占位已清（清旧值选择器错类名即残留双 chip 缺陷）
    const after = popup.querySelector('.bz-sp-chips')!;
    const chipsAll = after.querySelectorAll('.bz-sp-chip');
    expect(chipsAll).toHaveLength(1);
    expect(chipsAll[0].textContent).toBe('（库根目录）');
    expect(chipsAll[0].classList.contains('bz-sp-chip--muted')).toBe(false);
    // 键直绑落盘：库根目录 = 空串
    expect(panelState.storagePath).toBe('');
    ui.cleanup();
  });

  it('桌面端：无设置项域深链直达显示空态（组件库 bz-empty）', async () => {
    // issue 194：无设置域已从列表移除（不可点击），深链 open(domainId) 直达仍落空态
    const ui = new SettingsPanelUI();
    ui.open('reading-report');
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
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

  it('桌面端：零设置项域按端隐藏（issue 194，当前端可见项数为 0 的域从列表剔除）', async () => {
    const mod = await import('../src/settings-panel/ui');
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 等 preload 完成（全部有 schema 的域计数回填）
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && (mod.loadedCounts as Map<string, number>).size < 14) {
      await new Promise((r) => setTimeout(r, 30));
    }
    expect((mod.loadedCounts as Map<string, number>).size).toBeGreaterThanOrEqual(14);
    // 模拟某域在当前端零可见项（如设置全为移动端组时处于桌面端）→ 列表剔除
    (mod.loadedCounts as Map<string, number>).set('cinema', 0);
    expect(mod.listableDomains().some((d) => d.id === 'cinema')).toBe(false);
    // 触发导航重绘（搜索输入即重绘）→ 影院从导航消失
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    search.value = '影院';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(popup.querySelectorAll('.bz-sp-nav-item').length).toBe(0);
    // 未加载（无计数）的域保守显示；cleanup 清空计数
    (mod.loadedCounts as Map<string, number>).delete('cinema');
    expect(mod.listableDomains().some((d) => d.id === 'cinema')).toBe(true);
    ui.cleanup();
    expect((mod.loadedCounts as Map<string, number>).size).toBe(0);
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

  it('桌面端：无设置项的域不在左侧列表显示（含搜索）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 等 schema 预载（issue 246 回忆墙/收藏本桌面得外观组回归列表），轮询至徽标回填完成
    const deadline0 = Date.now() + 3000;
    let names: (string | null)[];
    for (;;) {
      names = [...popup.querySelectorAll('.bz-sp-nav-name')].map((b) => b.textContent);
      const badges = [...popup.querySelectorAll('.bz-sp-nav-count')].map((b) => b.textContent);
      if (Date.now() > deadline0 || (names.length === 17 && !badges.includes('·'))) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    // 只看域名（nav-name），避免描述包含（如剪藏本「网页剪藏与聚合讯」）误判
    expect(names).toHaveLength(17); // issue 246 回忆墙/收藏本桌面回归 → 17
    expect(names.slice(0, 3)).toEqual(['通用', '设置', 'AI']); // 基础组：通用 → 设置 → AI
    // 无设置域（聚合讯/阅读报告/自动摘要/附件搬移）一律不出现；小橘陪伴猫有 schema（issue 194 转可见）
    for (const n of ['聚合讯', '阅读报告', '做题家', '自动摘要', '附件搬移']) {
      expect(names).not.toContain(n);
    }
    expect(names).toContain('小橘陪伴猫');
    expect(names).toContain('回忆墙'); // issue 246 外观组落域 → 桌面回归列表
    expect(names).toContain('收藏本'); // issue 246 外观组落域 → 桌面回归列表
    // 旧书库（library）域退役：名称由 bookshelf（书库，issue 207 正名）承接，列表恰好一个「书库」
    expect(names.filter((n) => n === '书库')).toHaveLength(1);
    // 搜索也搜不到该无设置域（无设置域不占列表位；但描述含词的可见域如「剪藏本」仍可能命中）
    const search = popup.querySelector('.bz-sp-search .bz-input') as HTMLInputElement;
    search.value = '聚合讯';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const hitNames = [...popup.querySelectorAll('.bz-sp-nav-name')].map((b) => b.textContent);
    expect(hitNames).not.toContain('聚合讯');
    // 但可见域搜索正常
    search.value = '影院';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(popup.querySelectorAll('.bz-sp-nav-item').length).toBe(1);
    ui.cleanup();
  });

  it('移动端：无设置项的域不在列表显示（含搜索）', async () => {
    mobileFlag = true;
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    // 等 schema 预载（issue 201 回忆墙域移动端 1 项可见），轮询至徽标回填完成
    const deadline0 = Date.now() + 3000;
    let names: (string | null)[];
    for (;;) {
      names = [...popup.querySelectorAll('.bz-sp-mob-name')].map((b) => b.textContent);
      const badges = [...popup.querySelectorAll('.bz-sp-mob-item .bz-sp-mob-count, .bz-sp-mob-item .bz-sp-nav-count')].map((b) => b.textContent);
      if (Date.now() > deadline0 || (names.length === 16 && !badges.includes('·'))) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    // 只看域名（mob-name），避免描述包含误判
    expect(names).toHaveLength(17); // issue 201 补回忆墙域 → 16；拍板 P1 补「设置」域 → 17
    expect(names.slice(0, 3)).toEqual(['通用', '设置', 'AI']);
    expect(names).not.toContain('聚合讯');
    expect(names).toContain('小橘陪伴猫'); // 有 schema，issue 194 转可见
    expect(names).toContain('回忆墙'); // issue 201 补域（移动端有「移动端默认全屏」1 项）
    expect(names.filter((n) => n === '书库')).toHaveLength(1); // 旧书库域退役：名称由 bookshelf 承接（issue 207）
    // 搜索也搜不到该无设置域
    const search = popup.querySelector('.bz-sp-mob-search .bz-input') as HTMLInputElement;
    search.value = '聚合讯';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const hitNames = [...popup.querySelectorAll('.bz-sp-mob-name')].map((b) => b.textContent);
    expect(hitNames).not.toContain('聚合讯');
    // 但可见域搜索正常（「影院」命中：影院域 + 影视文件夹设置项——enh-sweep-a 起该行描述
    // 含「影院」区分说明，经预加载行缓存进设置项段，共 2 条）
    search.value = '影院';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const yingyuanHits = popup.querySelectorAll('.bz-sp-mob-item').length;
    expect(yingyuanHits).toBeGreaterThanOrEqual(1);
    expect(popup.querySelector('.bz-sp-mob-name')!.textContent).toBe('影院');
    ui.cleanup();
  });

  it('桌面端：域切换后侧栏徽标回填（设置项总数）', async () => {
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    await tick();
    // 番茄钟 3 组 14 项，其中 3 个自定义时长项受 pomodoroPreset 门控（未设 → 隐藏）→ 可见 11 项
    // （issue 246 补外观组两卡：9 → 11；组数 2 → 3）
    const items = popup.querySelectorAll('.bz-sp-nav-item');
    const pomoItem = Array.from(items).find((el) => el.textContent?.includes('番茄钟')) as HTMLElement;
    expect(pomoItem).toBeTruthy();
    pomoItem.click();
    await waitGroups(popup, 3);
    const badge = pomoItem.querySelector('.bz-sp-nav-count')!;
    expect(badge.textContent).toBe('11');
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
    // 无设置项的域不在列表显示（用户拍板）；issue 194 小橘陪伴猫转可见 → 15
    // issue 201 补回忆墙域 → 16；拍板 P1 补「设置」域 → 加载前列表 17
    expect(popup.querySelectorAll('.bz-sp-mob-item').length).toBe(17);
    // 移动列表图标为 lucide（tile 内 svg 容器）
    const firstIc = popup.querySelector('.bz-sp-mob-item .bz-sp-mob-ic .bz-ic');
    expect(firstIc).toBeTruthy();
    expect(firstIc!.getAttribute('data-icon')).toBe('settings');
    // 搜索清除按钮已退役（2026-09-08 拍板）：胶囊内仅图标 + 输入框
    expect(popup.querySelector('.bz-sp-mob-clear')).toBeNull();
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
    // 弹窗头行：整宽头行仅标题（图标块/关闭钮已退役——遮罩点击与 ESC 关闭）；无分隔线（原型 m1-modal-head：无 border）
    const modalHead = modal!.querySelector('.bz-sp-mob-modal-head')!;
    expect((modalHead as HTMLElement).style.borderBottom).toBe('');
    expect(modalHead.querySelector('.bz-sp-mob-modal-title')!.textContent).toBe('番茄钟');
    expect(modalHead.querySelector('.bz-sp-mob-modal-ic')).toBeNull();
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
    // 先点开 AI 域（index 1）填充其行缓存（弹窗内出现分组为加载完成标志）
    const items = popup.querySelectorAll('.bz-sp-mob-item');
    (items[1] as HTMLElement).click(); // AI（issue 186 独立域）
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      if (document.querySelector('.bz-sp-mob-modal .bz-sp-group')) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    // 关闭弹窗
    const modal = document.querySelector('.bz-sp-mob-modal');
    const modalMask = modal ? modal.previousElementSibling as HTMLElement : null;
    if (modalMask) modalMask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 搜「AI」→ 域段（AI）+ 设置项段
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

describe('choiceCards 视觉卡片行（issue 210）', () => {
  /** 局部设置单例（原 describe 的 panelState 在其闭包内，此处自管） */
  const skinState: Record<string, unknown> = { todoSkin: 'default' };
  beforeEach(() => {
    resetObsidianMocks();
    mobileFlag = false;
    document.body.innerHTML = '';
    skinState.todoSkin = 'default';
    setSettingsProvider(() => skinState as any);
  });

  it('渲染行头 + 预览卡（无编号无描述）；点击写键落盘并切换选中态', async () => {
    const saveSpy = vi.fn(async () => {});
    const { setSettingsSaver } = await import('../src/core/settings-provider');
    setSettingsSaver(saveSpy);
    const { renderPanelSchema } = await import('../src/settings-panel/renderer');
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderPanelSchema(container, {
      groups: [
        {
          icon: 'eye',
          name: '显示',
          rows: [
            {
              type: 'choiceCards',
              name: '面板皮肤',
              binding: { key: 'todoSkin' },
              options: [
                { value: 'default', label: '默认', prevClass: 'bz-skinprev-default' },
                { value: 'paper', label: '纸感手账', prevClass: 'bz-skinprev-paper' },
                { value: 'editorial', label: '编辑部', prevClass: 'bz-skinprev-editorial' },
              ],
            } as any,
          ],
        },
      ],
    });
    const row = container.querySelector('.bz-sp-set-row--cards') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.querySelector('.bz-sp-set-name')!.textContent).toBe('面板皮肤');
    // 拍板形态：卡片只含预览 + 名称（无编号/描述节点）
    const cards = row.querySelectorAll('.bz-sp-cardpick-card');
    expect(cards.length).toBe(3);
    expect(cards[1].querySelector('.bz-sp-mini')!.classList.contains('bz-skinprev-paper')).toBe(true);
    expect(cards[0].classList.contains('is-on')).toBe(true);
    // 点击「纸感手账」：写键 + 落盘 + 选中态切换
    (cards[1] as HTMLElement).click();
    expect(skinState.todoSkin).toBe('paper');
    expect(saveSpy).toHaveBeenCalled();
    expect(cards[1].classList.contains('is-on')).toBe(true);
    expect(cards[0].classList.contains('is-on')).toBe(false);
  });
});

describe('行为单源回归锚点（ADR-0106：行为唯一真理 = 域 ui.ts，原型壳为双 iframe 评审壳）', () => {
  it('行定位 data-key 契约：纯层 rowHtml 出 data-key（渲染器/ui.ts 消费同一份）', async () => {
    const { readFileSync } = await import('node:fs');
    const shared = readFileSync('src/settings-panel/shared.ts', 'utf8');
    // 渲染器按 data-key 定位行（搜索命中/显隐重算钩子）；纯层行骨架串必须带 data-key
    expect(shared).toMatch(/data-key/);
  });

  it('桌面搜索命中高亮 .hit：行为唯一实现在域侧 ui.ts（prototype.app.js 已退役，无镜像对齐锚点）', async () => {
    const { readFileSync } = await import('node:fs');
    const ui = readFileSync('src/settings-panel/ui.ts', 'utf8');
    expect(ui).toContain("row.classList.toggle('hit'");
  });

  it('choiceCards 卡组结构契约：纯层 cardpickHtml 串（renderer/ui 消费同一份）', async () => {
    const { readFileSync } = await import('node:fs');
    const shared = readFileSync('src/settings-panel/shared.ts', 'utf8');
    expect(shared).toContain('bz-sp-cardpick');
    expect(shared).toContain('bz-sp-set-cards');
  });
});
