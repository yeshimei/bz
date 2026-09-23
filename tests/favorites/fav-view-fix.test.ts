/**
 * 收藏夹（favorites）域深审批 B（bz-fix-fav-view）UI 交互与通知链修复回归。
 * 覆盖（对照 .scratch/review-deep/favorites-{ui,efficiency,func,consistency,arch}.md 台账）：
 * - E1/C2  归档/删除免确认直达 notifyUndo（契约翻转在 ui.test.ts / flow-dialog-skin.test.ts，此处补同域一制细节）
 * - E2     动作后全量重刷滚位保持（renderBoardInto 保存/回写链）
 * - E3     openForm 单例守卫走 requestCloseForm 口径（脏 → confirmDiscard 不丢草稿；净 → 直换）
 * - UI-01/02/13  样式断言在 styles.test.ts
 * - UI-03  表单/标签弹窗初始聚焦归 uiModal firstFocusable（移动端跳过 input 防软键盘）
 * - UI-04/11/C6  主表单 + 标签编辑弹窗提交通道收编 core bindFormSubmit（isComposing 守卫）
 * - UI-05/func-7  磁贴哨兵与用户标签解耦 + 保留字防御
 * - UI-06  置顶开关 role=switch/aria-checked/键盘；卡片键盘可达；chips aria-pressed
 * - UI-07  打开面板读盘占位（不白板）
 * - UI-08  激活筛选计数归零 chip 保渲染（灰显），面板不悬空
 * - UI-09  空态文案区分筛选/归档/真空
 * - UI-10  动态标签图标 safeTagIcon 白名单（注入面收口）
 * - UI-12  标签编辑弹窗 requestClose 脏拦截
 * - func-2 删除撤销补发 restored 事件（载荷断言在 ui.test.ts，此处补 smartcat 文案构造）
 * - func-6 标签编辑弹窗独立类名（单例守卫/ESC 判活不再误命中双层遮罩）
 * - E5     boardHtml Map 建表与 indexOf 基准逐字节等价（胶带轮换不变）
 * - arch-4 tagManagerDm 收口恒等（与主面板同实例，storagePath 运行中变更不热切换）
 * 纪律：纯代码级修复回归，全部自造 fixture，零用户 vault 数据。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { renderSettingsInto } from '../../src/core/settings-schema';
import { DataManager } from '../../src/favorites/data';
import { FavoritesAIService } from '../../src/favorites/ai';
import { closeItemMenu } from '../../src/core/item-actions';
import { FavoritesApp } from '../../src/favorites/app';
import {
  openPanel, openForm, closePanel, unloadFavoritesUI, favoritesSettingsSchema, initFavoritesUI,
} from '../../src/favorites/ui';
import { boardHtml } from '../../src/favorites/render';
import { getTags } from '../../src/favorites/config';
import { buildFavoritesActionText } from '../../src/smartcat/favorites-source';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, Platform } from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: { openLinkText: vi.fn() }, openUrl: vi.fn() } as any;
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

function seedItem(seed: { id: string; title: string; created?: string; tags?: string[]; desc?: string; url?: string; pinned?: boolean; archived?: boolean }): any {
  return {
    id: seed.id,
    tags: seed.tags || ['GitHub'],
    title: seed.title,
    description: seed.desc ?? '',
    pinned: seed.pinned ?? false,
    url: seed.url ?? '',
    balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null,
    created: seed.created || '2025-01-01 00:00:00',
    type: (seed.tags || ['GitHub'])[0],
    ...(seed.archived ? { archived: true, archivedAt: '2026-08-30 10:00:00' } : {}),
  };
}

function seedVault(vault: MockVault, items: any[]): void {
  vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify(items));
}

function seedTags(state: Record<string, unknown>, tags: any[]): void {
  state.favoriteTags = JSON.parse(JSON.stringify(tags));
}

/** 磁贴行按钮查找（data-fav-tag 契约值） */
function chip(dataVal: string): HTMLElement {
  const b = [...document.querySelectorAll('[data-fav-tags] [data-fav-tag]')].find(
    (x) => (x as HTMLElement).dataset.favTag === dataVal
  ) as HTMLElement | undefined;
  if (!b) throw new Error('找不到磁贴：' + dataVal);
  return b;
}
function cards(): HTMLElement[] {
  return [...document.querySelectorAll('.bz-fav-board .bz-fav-card')] as HTMLElement[];
}

interface Ctx {
  vault: MockVault;
  dm: DataManager;
  ai: FavoritesAIService;
  state: Record<string, unknown>;
  saveCount: () => number;
}

async function setup(): Promise<Ctx> {
  resetObsidianMocks();
  document.body.innerHTML = '';
  closePanel();
  unloadFavoritesUI();
  const vault = new MockVault();
  setApp(makeApp(vault));
  let saves = 0;
  const state: Record<string, unknown> = { storagePath: 'CONFIG/STORAGE' };
  setSettingsProvider(() => state as any);
  setSettingsSaver(async () => { saves++; });
  const dm = new DataManager('CONFIG/STORAGE/favorites.json');
  const ai = new FavoritesAIService();
  return { vault, dm, ai, state, saveCount: () => saves };
}

function openAddViaMainBtn(): void {
  const btn = [...document.querySelectorAll('[data-fav-add]')].find(
    (b) => (b as HTMLElement).classList.contains('bz-fav-chip-add')
  ) as HTMLElement;
  btn.click();
}

beforeEach(() => {
  try { unloadFavoritesUI(); } catch { /* 未初始化状态 */ }
  closeItemMenu();
  Platform.isMobile = false;
});

afterEach(() => {
  Platform.isMobile = false;
  closeItemMenu();
  try { unloadFavoritesUI(); } catch { /* 幂等 */ }
  // arch-4 注入面清理：FavoritesApp 单例残留会影响后续用例 tagManagerDm 的取实例路径
  FavoritesApp.getInstance().dataManager = null;
  FavoritesApp.getInstance().aiService = null;
  document.body.innerHTML = '';
});

// ==================== E2：滚位保持 ====================

describe('E2 动作后滚位保持', () => {
  it('置顶动作触发全量重刷时，renderBoardInto 保存并回写 scrollTop（视野不跳回顶部）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '甲', created: '2025-06-02 00:00:00' }),
      seedItem({ id: '2', title: '乙', created: '2025-06-01 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const board = document.querySelector('[data-fav-content]') as HTMLElement;
    // jsdom 无布局引擎，scrollTop 是纯存储值——用读写记录断言「保存→重建→回写」链真实发生
    // （若保存/回写逻辑被移除，set:300 不会出现在重建后的调用序里）
    const calls: string[] = [];
    Object.defineProperty(board, 'scrollTop', {
      configurable: true,
      get() { calls.push('get'); return 300; },
      set(v: number) { calls.push('set:' + v); },
    });
    // 右键甲 → 置顶（reload → renderAll → renderBoardInto）
    cards()[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await tick(10);
    const items = [...document.querySelectorAll('.bz-item-menu button')];
    (items.find((b) => b.textContent?.includes('置顶')) as HTMLElement).click();
    await tick(40);
    expect(calls.filter((c) => c === 'get').length).toBeGreaterThanOrEqual(1);
    expect(calls).toContain('set:300'); // 重建后回写原滚位
    expect((await ctx.dm.getAll()).find((d) => d.id === '1')!.pinned).toBe(true);
  });
});

// ==================== E3：单例守卫走脏检 ====================

describe('E3 openForm 单例守卫（E3/FV2）', () => {
  it('脏表单时再触发 openForm → confirmDiscard 弹出且原表单保持（草稿不丢、不开新表单）', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    (document.querySelector('#fz-title') as HTMLInputElement).value = '未保存草稿';
    openForm(null); // 单例守卫命中（脏）
    await tick(10);
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull(); // 放弃确认弹出
    expect(document.querySelector('.bz-fav-form')).not.toBeNull(); // 原表单保持
    expect((document.querySelector('#fz-title') as HTMLInputElement).value).toBe('未保存草稿');
    // 确认放弃（confirmDiscard 取消钮 = 放弃）后才收表单
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
  });

  it('干净表单时再触发 openForm → 旧表单直关、新表单直接换上（无确认框）', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
    openForm(null);
    await tick(10);
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull(); // 净表单无确认
    expect(document.querySelector('.bz-fav-form')).not.toBeNull(); // 新表单在位
    expect(document.querySelectorAll('.bz-overlay-mask').length).toBe(1); // 单层（旧壳已收）
  });
});

// ==================== UI-03：初始聚焦归 uiModal 单源 ====================

describe('UI-03 初始聚焦', () => {
  function formEls() {
    return {
      title: document.querySelector('#fz-title') as HTMLInputElement,
    };
  }

  it('桌面：打开表单聚焦 #fz-title（uiModal firstFocusable 首个 input，等价原 setTimeout 行为）', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    await tick(10);
    expect(document.activeElement).toBe(formEls().title);
  });

  it('移动端：打开表单不聚焦 input（core 跳过 input/textarea 防软键盘顶起盖表单）', async () => {
    Platform.isMobile = true;
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
    expect(document.activeElement).not.toBe(formEls().title); // 不再强制聚焦输入框
  });
});

// ==================== UI-04/11/C6：bindFormSubmit 提交通道 ====================

describe('UI-04/11 表单键盘提交（core bindFormSubmit 单源）', () => {
  function openAdd(): void {
    openAddViaMainBtn();
  }
  const pressEnter = (el: HTMLElement, init: KeyboardEventInit = {}) =>
    el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true, ...init }));
  const pressCtrlEnter = (el: HTMLElement) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));

  it('标题框纯 Enter → 提交链触发（校验错误出现 = saveForm 被调）', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAdd();
    const title = document.querySelector('#fz-title') as HTMLInputElement;
    pressEnter(title);
    await tick(10);
    expect((document.querySelector('#fz-err') as HTMLElement).textContent).toBe('请输入标题');
  });

  it('textarea 内纯 Enter 不拦换行（不提交）；Ctrl+Enter 恒提交', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAdd();
    const desc = document.querySelector('#fz-desc') as HTMLTextAreaElement;
    const err = document.querySelector('#fz-err') as HTMLElement;
    pressEnter(desc);
    await tick(10);
    expect(err.textContent).toBe(''); // 纯 Enter 未触发保存校验
    pressCtrlEnter(desc);
    await tick(10);
    expect(err.textContent).toBe('请输入标题'); // Ctrl+Enter 恒提交
  });

  it('标签编辑弹窗：名称框 isComposing=true 的 Ctrl+Enter 不提交（IME 守卫），落定后纯 Enter 提交', async () => {
    const ctx = await setup();
    await ctx.dm.loadTags();
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    (document.querySelector('.bz-fav-tagmgr-add') as HTMLElement).click();
    await tick(10);
    const input = document.querySelector('#fz-tag-name') as HTMLInputElement;
    expect(input).not.toBeNull();
    // IME 组合中（isComposing）：手写 keydown 时代会误触发保存；收编 core 后被首行守卫拦下
    input.value = '育儿';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, bubbles: true, cancelable: true }));
    await tick(10);
    expect((ctx.state.favoriteTags as any[] | undefined)?.some((t) => t.label === '育儿')).toBeFalsy();
    // 组合落定：纯 Enter（keypress 段）提交
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    await tick(20);
    expect((ctx.state.favoriteTags as any[]).some((t) => t.label === '育儿')).toBe(true);
  });
});

// ==================== UI-05/func-7：哨兵解耦 + 保留字防御 ====================

describe('UI-05/func-7 标签撞名防御', () => {
  const TAGS = [
    { id: 'github', label: 'GitHub', ic: 'github' },
    { id: 't-arch', label: '已归档', ic: 'tag' }, // 用户自建与内置视图同名的标签（issue 363 允许）
  ];

  it('名为「已归档」的用户标签：磁贴 data 值唯一可区分（哨兵 __archived vs 字面），点击按标签筛选不被劫持', async () => {
    const ctx = await setup();
    seedTags(ctx.state, TAGS);
    seedVault(ctx.vault, [seedItem({ id: '1', title: '双标签卡', tags: ['已归档', 'GitHub'] })]);
    await ctx.dm.loadTags();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    // 内置贴纸发哨兵、用户标签贴纸发字面——同屏两枚 chip 的 data 值唯一
    const builtin = chip('__archived');
    const user = chip('已归档');
    expect(builtin).not.toBe(user);
    expect(builtin.classList.contains('bz-fav-chip--grey')).toBe(true);
    // 点用户「已归档」标签 → 按标签筛出卡片（修复前被字面分支劫持进归档视图）
    user.click();
    await tick(10);
    expect(cards().length).toBe(1);
    expect(cards()[0].querySelector('h3')!.textContent).toBe('双标签卡');
  });

  it('标签编辑器拒收保留字（全部/已归档/@last 等）：提示冲突不落盘', async () => {
    const ctx = await setup();
    await ctx.dm.loadTags();
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    for (const reserved of ['全部', '已归档', '@last', '@archived', '__all']) {
      (document.querySelector('.bz-fav-tagmgr-add') as HTMLElement).click();
      await tick(10);
      const input = document.querySelector('#fz-tag-name') as HTMLInputElement;
      input.value = reserved;
      (document.querySelector('#fz-tag-save') as HTMLElement).click();
      await tick(10);
      expect(ctx.state.favoriteTags, `保留字「${reserved}」不应落盘`).toBeUndefined();
      // 关掉弹窗进入下一轮
      (document.querySelector('[data-fz-tag-cancel]') as HTMLElement).click();
      await tick(10);
    }
    expect(getTags().some((t) => ['全部', '已归档'].includes(t.label) && t.id.startsWith('t'))).toBe(false);
  });
});

// ==================== UI-06：可达性 ====================

describe('UI-06 键盘可达与 aria', () => {
  it('置顶开关：role=switch + aria-checked 随点击/Space/Enter 翻转', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    await tick(10);
    const pin = document.querySelector('#fz-pin') as HTMLElement;
    expect(pin.getAttribute('role')).toBe('switch');
    expect(pin.getAttribute('tabindex')).toBe('0');
    expect(pin.getAttribute('aria-checked')).toBe('false');
    pin.click();
    expect(pin.getAttribute('aria-checked')).toBe('true');
    pin.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(pin.getAttribute('aria-checked')).toBe('false');
    pin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(pin.getAttribute('aria-checked')).toBe('true');
    expect(pin.classList.contains('bz-fav-on')).toBe(true);
  });

  it('磁贴 chips：激活态写 aria-pressed（「全部」默认激活）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '甲' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(chip('__all').getAttribute('aria-pressed')).toBe('true');
    expect(chip('__archived').getAttribute('aria-pressed')).toBe('false');
    chip('__archived').click();
    await tick(10);
    expect(chip('__archived').getAttribute('aria-pressed')).toBe('true');
    expect(chip('__all').getAttribute('aria-pressed')).toBe('false');
  });

  it('卡片 role=button + tabindex=0，键盘 Enter 与点击同径（2026-09-23 拍板：同径=只给拾取反馈，均不导航）', async () => {
    const ctx = await setup();
    const app = getApp() as any;
    seedVault(ctx.vault, [seedItem({ id: '1', title: '键盘卡', url: 'https://github.com/a/b' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const card = cards()[0];
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');
    card.focus();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await tick(10);
    // 点卡不再跳网站（开链/复制网址走右键菜单）：键盘 Enter 同径，也不导航、不弹菜单
    expect(app.openUrl).not.toHaveBeenCalled();
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });
});

// ==================== UI-07/08/09：占位与空态 ====================

describe('UI-07 打开面板读盘占位', () => {
  it('loadItems 未决时卡墙先立空态（不白板），数据到位后全量重渲', async () => {
    const ctx = await setup();
    let resolveGet!: (v: any[]) => void;
    vi.spyOn(ctx.dm, 'getAll').mockImplementation(() => new Promise((r) => { resolveGet = r; }));
    openPanel(getApp(), ctx.dm, ctx.ai);
    // 同步占位帧：磁贴行 + 空态立现（修复前 data-fav-content 为空白 div）
    expect(document.querySelector('[data-fav-tags] button')).not.toBeNull();
    expect(document.querySelector('.bz-fav-board .bz-empty')).not.toBeNull();
    resolveGet([seedItem({ id: '1', title: '占位后到货' })]);
    await tick(20);
    expect(cards().length).toBe(1);
    expect(cards()[0].querySelector('h3')!.textContent).toBe('占位后到货');
  });
});

describe('UI-08 激活筛选计数归零不悬空', () => {
  it('筛 GitHub 后把条目全部归档：GitHub chip 保渲染（灰显 aria-pressed），「全部」不亮，空态指向标签', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '唯一 GitHub', tags: ['GitHub'] })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    chip('GitHub').click();
    await tick(10);
    // 归档该条目（免确认直达）
    cards()[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await tick(10);
    const items = [...document.querySelectorAll('.bz-item-menu button')];
    (items.find((b) => b.textContent?.includes('归档')) as HTMLElement).click();
    await tick(40);
    // 激活 chip 仍在（零计数灰显），用户看得见自己筛在哪、可点回
    const gh = chip('GitHub');
    expect(gh.classList.contains('bz-fav-chip--empty')).toBe(true);
    expect(gh.getAttribute('aria-pressed')).toBe('true');
    expect(chip('__all').classList.contains('bz-fav-on')).toBe(false);
    // 空态文案指向标签（UI-09 联动），不再是误导的「这块板上还没有卡片」
    expect((document.querySelector('.bz-empty-title') as HTMLElement).textContent).toBe('「GitHub」标签下还没有收藏');
    // 点灰显 chip = 取消筛选回全部
    gh.click();
    await tick(10);
    expect(chip('__all').classList.contains('bz-fav-on')).toBe(true);
  });

  it('激活标签被删除（不在标签集）→ reload 渲染时归一回落全部（面板不悬空）', async () => {
    const ctx = await setup();
    seedTags(ctx.state, [{ id: 't-x', label: '临时标签', ic: 'tag' }]);
    seedVault(ctx.vault, [seedItem({ id: '1', title: '卡', tags: ['临时标签'] })]);
    await ctx.dm.loadTags();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    chip('临时标签').click();
    await tick(10);
    expect(chip('临时标签').classList.contains('bz-fav-on')).toBe(true);
    // 模拟设置面板删除该标签：运行时集裁剪（getTags 缓存引用清空）
    getTags().splice(0, getTags().length);
    // 触发数据刷新链（reload → renderAll）——归一在渲染入口生效：M.tag 悬空回落全部
    cards()[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await tick(10);
    const items = [...document.querySelectorAll('.bz-item-menu button')];
    (items.find((b) => b.textContent?.includes('置顶')) as HTMLElement).click();
    await tick(40);
    // 归一后「全部」高亮，悬空标签的激活 chip 不再出现（标签集已无此标签）
    expect(chip('__all').classList.contains('bz-fav-on')).toBe(true);
    expect(document.querySelector('[data-fav-tag="临时标签"]')).toBeNull();
    expect(cards().length).toBe(1);
  });
});

describe('UI-09 空态文案分视图', () => {
  it('归档箱空 → 「归档箱是空的」；真空 → 默认文案', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '活卡' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    chip('__archived').click();
    await tick(10);
    expect((document.querySelector('.bz-empty-title') as HTMLElement).textContent).toBe('归档箱是空的');
    // 回全部：非空不是空态
    chip('__all').click();
    await tick(10);
    expect(document.querySelector('.bz-empty-title')).toBeNull();
  });
});

// ==================== UI-10：动态图标白名单 ====================

describe('UI-10 动态标签图标注入防御', () => {
  it('恶意 ic（手改 data.json 注入）渲染回落安全值，不产 img/逃逸属性', async () => {
    const ctx = await setup();
    seedTags(ctx.state, [
      { id: 't-evil', label: '邪恶标签', ic: '"><img src=x onerror=alert(1)>' },
      { id: 'github', label: 'GitHub', ic: 'github' },
    ]);
    seedVault(ctx.vault, [seedItem({ id: '1', title: '带恶意标签卡', tags: ['邪恶标签'] })]);
    await ctx.dm.loadTags();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(document.querySelector('.bz-fav-board img')).toBeNull();
    expect(document.querySelector('[data-fav-tags] img')).toBeNull();
    // 白名单不合 → 回落 'tag'（图标胶囊正常兑现，恶意串零残留）
    const chipEl = document.querySelector('[data-fav-tags] [data-fav-tag="邪恶标签"]') as HTMLElement;
    expect(chipEl).not.toBeNull();
    expect(chipEl.innerHTML).not.toContain('img');
    expect(chipEl.innerHTML).not.toContain('onerror');
    expect(chipEl.querySelector('.bz-ic, svg, i')).not.toBeNull();
  });
});

// ==================== UI-12：标签弹窗脏拦截 ====================

describe('UI-12 标签编辑弹窗关闭礼节', () => {
  async function openEditor(ctx: Ctx): Promise<{ input: HTMLInputElement }> {
    await ctx.dm.loadTags();
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    (document.querySelector('.bz-fav-tagmgr-add') as HTMLElement).click();
    await tick(10);
    return { input: document.querySelector('#fz-tag-name') as HTMLInputElement };
  }
  const maskEl = () => document.querySelector('.bz-overlay-mask') as HTMLElement;

  it('名称非空（非初值）点遮罩 → confirmDiscard 弹出、弹窗保持；确认放弃后才关', async () => {
    const ctx = await setup();
    const { input } = await openEditor(ctx);
    input.value = '敲了一半';
    maskEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(10);
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    expect(document.querySelector('.bz-fav-tageditor')).not.toBeNull(); // 弹窗保持
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click(); // 放弃
    await tick(10);
    expect(document.querySelector('.bz-fav-tageditor')).toBeNull();
  });

  it('空白名称点遮罩 → 直关（无确认框）', async () => {
    const ctx = await setup();
    const { input } = await openEditor(ctx);
    expect(input.value.trim()).toBe('');
    maskEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(10);
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    expect(document.querySelector('.bz-fav-tageditor')).toBeNull();
  });

  it('编辑态名称未改点遮罩 → 直关（不误判脏）', async () => {
    const ctx = await setup();
    seedTags(ctx.state, [{ id: 't-e', label: '既有', ic: 'tag' }]);
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    const row = [...document.querySelectorAll('.bz-fav-tagmgr-row')].find((r) => r.textContent!.includes('既有')) as HTMLElement;
    (row.querySelector('[title="编辑"]') as HTMLElement).click();
    await tick(10);
    maskEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(10);
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    expect(document.querySelector('.bz-fav-tageditor')).toBeNull();
  });
});

// ==================== func-6：弹窗类名互扰 ====================

describe('func-6 标签编辑弹窗与收藏表单解耦', () => {
  it('tageditor 开着时触发 openForm：收藏表单叠加而非误判「已有表单」，标签弹窗不被误关', async () => {
    const ctx = await setup();
    await ctx.dm.loadTags();
    initFavoritesUI(getApp(), ctx.dm, ctx.ai);
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    (document.querySelector('.bz-fav-tagmgr-add') as HTMLElement).click();
    await tick(10);
    expect(document.querySelector('.bz-fav-tageditor')).not.toBeNull();
    expect(document.querySelector('.bz-fav-form')).toBeNull(); // 独立类名：tageditor 不再命中 .bz-fav-form
    // 单例守卫（查 .bz-fav-form）不命中 tageditor → 收藏表单正常打开，两层叠加
    openForm(null);
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
    expect(document.querySelector('.bz-fav-tageditor')).not.toBeNull(); // 标签弹窗纹丝不动
    expect(document.querySelectorAll('.bz-overlay-mask').length).toBe(2);
  });
});

// ==================== E5：boardHtml Map 建表等价 ====================

describe('E5 boardHtml 胶带轮换口径', () => {
  it('Map 建表与 indexOf 基准逐字节等价（胶带三色轮换按全量条目位）', () => {
    const items = [
      seedItem({ id: 'a', title: 'A', created: '2025-01-05 00:00:00' }),
      { ...seedItem({ id: 'b', title: 'B', created: '2025-01-04 00:00:00' }), archived: true }, // 归档占位但不进主列表
      seedItem({ id: 'c', title: 'C', created: '2025-01-03 00:00:00' }),
      seedItem({ id: 'd', title: 'D', created: '2025-01-02 00:00:00' }),
      seedItem({ id: 'e', title: 'E', created: '2025-01-01 00:00:00' }),
    ];
    const view = { tag: null, archived: false, sort: 'new' as const };
    const html = boardHtml(items, view);
    // 胶带序列 = 卡在全量 items 中的下标 % 3（b 占 index 1，其后可见卡的轮换跳过它）：
    // idx0=基础、idx1=--r、idx2=--g、idx3=基础、idx4=--r（类形态「基础 + 变体」拼接）
    const tapeSeq = [...html.matchAll(/class="(bz-fav-tape[^"]*)"/g)].map((m) => m[1]);
    const expectSeq = [
      'bz-fav-tape',
      'bz-fav-tape bz-fav-tape--g',
      'bz-fav-tape',
      'bz-fav-tape bz-fav-tape--r',
    ];
    expect(tapeSeq).toEqual(expectSeq);
    // 卡序 = 最新在前（a c d e）
    const idSeq = [...html.matchAll(/data-fav-id="([^"]+)"/g)].map((m) => m[1]);
    expect(idSeq).toEqual(['a', 'c', 'd', 'e']);
  });
});

// ==================== func-2：restored 事件文案（smartcat 消费侧） ====================

describe('func-2 restored kind 消费侧', () => {
  it('buildFavoritesActionText：restored → 「你撤销了删除《X》」', () => {
    expect(buildFavoritesActionText({ kind: 'restored', title: '找回项' })).toBe('你撤销了删除《找回项》');
  });
});

// ==================== arch-4：tagManagerDm 收口恒等 ====================

describe('arch-4 tagManagerDm 收口恒等', () => {
  it('注入主面板实例后，标签改名 bulk 迁移写主面板固化路径（storagePath 运行中变更不热切换）', async () => {
    const ctx = await setup();
    seedTags(ctx.state, [
      { id: 't-m', label: '旧名', ic: 'tag' },
      { id: 'github', label: 'GitHub', ic: 'github' },
    ]);
    seedVault(ctx.vault, [seedItem({ id: '1', title: '跟随卡', tags: ['旧名'] })]);
    await ctx.dm.loadTags();
    // 与主面板同实例注入（生产链路 = FavoritesApp.init 后恒非空）
    FavoritesApp.getInstance().dataManager = ctx.dm;
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    // 运行中改 storagePath（ADR-0009：需重载插件后全面生效，主面板实例不跟随）
    ctx.state.storagePath = '我的/数据';
    const row = [...document.querySelectorAll('.bz-fav-tagmgr-row')].find((r) => r.textContent!.includes('旧名')) as HTMLElement;
    (row.querySelector('[title="编辑"]') as HTMLElement).click();
    await tick(10);
    const input = document.querySelector('#fz-tag-name') as HTMLInputElement;
    input.value = '新名';
    (document.querySelector('#fz-tag-save') as HTMLElement).click();
    await tick(30);
    // bulk 迁移落在主面板固化路径（若收口失效回退现构造，会写到「我的/数据/favorites.json」）
    const saved = JSON.parse(ctx.vault.files.get('CONFIG/STORAGE/favorites.json')!);
    expect(saved.find((d: any) => d.id === '1').tags).toEqual(['新名']);
    expect(ctx.vault.files.has('我的/数据/favorites.json')).toBe(false);
  });
});
