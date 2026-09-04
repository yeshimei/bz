/**
 * 收藏本 UI 测试（ticket 177 重构版：src/favorites/ui.ts 模块函数 openPanel/openForm 契约）
 * 覆盖：主面板开合与空态 / 标签筛选计数 / 卡片渲染 / 排序（created 默认 + title 循环 + 置顶恒前）/
 * 搜索防抖与无结果空态 / 桌面行动作浮层（打开/置顶/归档/删除+撤销/取消）/ 添加表单校验与落盘 13 字段 /
 * 编辑回填与事件载荷 / 余额自动查询与档位色 / AI 整理 / 归档冷存（ADR-0074）/ smartcat 总线 /
 * 设置 schema（移动端组门控）/ 移动抽屉 / 脏表单拦截 / ESC 关闭。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { renderSettingsInto } from '../../src/core/settings-schema';
import { DataManager } from '../../src/favorites/data';
import { FavoritesAIService } from '../../src/favorites/ai';
import { closeItemMenu } from '../../src/core/item-actions';
import { onDomainEvent } from '../../src/core/domain-bus';
import {
  openPanel, openForm, closePanel, unloadFavoritesUI, favoritesSettingsSchema,
} from '../../src/favorites/ui';
import { MockVault } from '../mock-vault';
import {
  resetObsidianMocks, hasNotice, Platform, requestUrl,
} from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {},
    workspace: { openLinkText: vi.fn() },
    openUrl: vi.fn(),
  } as any;
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 桌面：点击卡片 = 行浮层（.bz-item-menu） */
function clickCard(card: HTMLElement): void {
  card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** 当前浮层动作项文案集合（桌面菜单 label / 移动抽屉 label） */
function menuLabels(): (string | null)[] {
  return [...document.querySelectorAll('.bz-item-menu-label, .bz-item-sheet-label')].map((e) => e.textContent);
}

/** 按文案点击浮层动作项 */
function clickAction(label: string): HTMLElement {
  const items = [...document.querySelectorAll('.bz-item-menu-item, .bz-item-sheet-item')] as HTMLElement[];
  const target = items.find((el) => el.querySelector('.bz-item-menu-label, .bz-item-sheet-label')?.textContent === label);
  if (!target) throw new Error('找不到动作项：' + label + '；现有=' + items.map((i) => i.textContent).join('|'));
  target.click();
  return target;
}

/** 确定性新收藏条目构造（id 递增，created 递增便于排序断言） */
function seedItem(seed: { id: string; title: string; created?: string; tags?: string[]; desc?: string; url?: string; pinned?: boolean; linkedNote?: string; llm?: { apiKeys: string; balanceUrl: string } | null; archived?: boolean; archivedAt?: string | null; balance?: string | null; balanceError?: string | null; balanceCacheTime?: number | null }): FavoritesItem {
  const created = seed.created || `2025-01-01 00:00:00`;
  return {
    id: seed.id,
    tags: seed.tags || ['GitHub'],
    title: seed.title,
    description: seed.desc ?? '',
    pinned: seed.pinned ?? false,
    url: seed.url ?? '',
    balance: seed.balance ?? null,
    balanceCacheTime: seed.balanceCacheTime ?? null,
    balanceError: seed.balanceError ?? null,
    linkedNote: seed.linkedNote ?? null,
    created,
    type: (seed.tags || ['GitHub'])[0],
    ...(seed.llm !== undefined ? { llmConfig: seed.llm } : {}),
    ...(seed.archived ? { archived: true, archivedAt: seed.archivedAt ?? '2026-08-30 10:00:00' } : {}),
  } as FavoritesItem;
}

/** 把条目数组写入 vault 预置 favorites.json */
function seedVault(vault: MockVault, items: any[]): void {
  vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify(items));
}

/** 真实总线事件收集器 */
function eventCollector(): { calls: any[]; off: () => void } {
  const calls: any[] = [];
  const off = onDomainEvent('favorites', (evt) => calls.push(evt));
  return { calls, off };
}

/** 当前卡片（[data-fav-content] 下 .bz-fav-card） */
function cards(): HTMLElement[] {
  return [...document.querySelectorAll('.bz-fav-content .bz-fav-card')] as HTMLElement[];
}
function cardTitles(): (string | null)[] {
  return cards().map((c) => c.querySelector('.bz-fav-title')?.textContent ?? null);
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
  const state: Record<string, unknown> = {
    storagePath: 'CONFIG/STORAGE',
    favoritesStoragePath: 'CONFIG/STORAGE',
    favoritesSortKey: 'created',
    favoritesMobileDefaultFullscreen: true,
    aiProvider: 'opencode-go',
    opencodeGoApiKey: 'sk-test',
  };
  setSettingsProvider(() => state as any);
  setSettingsSaver(async () => { saves++; });
  const dm = new DataManager('CONFIG/STORAGE/favorites.json');
  const ai = new FavoritesAIService();
  return {
    vault, dm, ai, state,
    saveCount: () => saves,
  };
}

beforeEach(() => {
  // 清掉上个用例的残留（setup 内 unloadFavoritesUI 依赖注入先执行，保证 state 干净）
  try { unloadFavoritesUI(); } catch { /* 未初始化状态 */ }
  closeItemMenu();
  Platform.isMobile = false;
});

afterEach(() => {
  Platform.isMobile = false;
  vi.useRealTimers();
  closeItemMenu();
  try { unloadFavoritesUI(); } catch { /* 幂等 */ }
  document.body.innerHTML = '';
});

type FavoritesItem = {
  id: string; tags: string[]; title: string; description: string; pinned: boolean;
  url: string; balance: string | null; balanceCacheTime: number | null; balanceError: string | null;
  linkedNote: string | null; created: string; type: string;
  llmConfig?: { apiKeys: string; balanceUrl: string } | null;
  archived?: boolean; archivedAt?: string | null;
};

// ==================== 1. 主面板开合 / 空态 / 结构 ====================

describe('主面板开合与空态', () => {
  it('loadItems 失败 → 空列表 + 错误通知（不再静默显示「暂无收藏」误导数据丢失）', async () => {
    const ctx = await setup();
    vi.spyOn(ctx.dm, 'getAll').mockRejectedValue(new Error('disk error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const overlay = document.querySelector('.bz-fav-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.bz-fav-content .bz-empty')).not.toBeNull();
    expect(hasNotice('收藏数据读取失败，已显示为空列表')).toBe(true);
    consoleSpy.mockRestore();
  });

  it('openPanel 建 DOM：标题「收藏本」+ 左栏 11 项（全部+已归档+9 标签）+ 空态文案', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const overlay = document.querySelector('.bz-fav-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.bz-fav-panel')).not.toBeNull();
    expect(overlay.querySelector('.bz-fav-head .bz-fav-title')!.textContent).toBe('收藏本');
    // 左栏：全部 + 已归档 + 9 类（ticket 188 加已归档入口）
    const sideBtns = overlay.querySelectorAll('[data-fav-tags] .bz-fav-side-item');
    expect(sideBtns.length).toBe(11);
    const labels = [...sideBtns].map((b) => (b as HTMLElement).dataset.favTag);
    expect(labels[0]).toBe('__all');
    expect(labels[1]).toBe('__archived');
    expect(labels).toContain('GitHub');
    expect(labels).toContain('DeepSeek Harness');
    expect(labels).toHaveLength(11);
    // 头行右上移动图标组
    expect(overlay.querySelectorAll('.bz-fav-head-btns .bz-fav-mob-only').length).toBe(4);
    // 主按钮文案含「添加收藏」
    expect(overlay.querySelector('[data-fav-add].bz-btn--primary')!.textContent).toContain('添加收藏');
    // 空态
    const empty = overlay.querySelector('.bz-fav-content .bz-empty') as HTMLElement;
    expect(empty).not.toBeNull();
    expect(empty.querySelector('.bz-empty-title')!.textContent).toBe('暂无收藏');
    expect(empty.querySelector('.bz-empty-desc')!.textContent).toContain('点右上角「添加收藏」记一条');
    // 空库自动建文件
    expect(ctx.vault.files.has('CONFIG/STORAGE/favorites.json')).toBe(true);
    // 计数文案
    expect(overlay.querySelector('[data-fav-count]')!.textContent).toBe('0 条收藏');
    expect(overlay.querySelector('[data-fav-title]')!.textContent).toBe('全部');
  });

  it('再次 openPanel = toggle 关闭；closePanel 清 DOM', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(document.querySelector('.bz-fav-overlay')).not.toBeNull();
    openPanel(getApp(), ctx.dm, ctx.ai); // 开着再开 = 关
    expect(document.querySelector('.bz-fav-overlay')).toBeNull();
    openPanel(getApp(), ctx.dm, ctx.ai); // 再开
    await tick(20);
    expect(document.querySelector('.bz-fav-overlay')).not.toBeNull();
    closePanel();
    expect(document.querySelector('.bz-fav-overlay')).toBeNull();
  });

  it('unloadFavoritesUI 幂等：面板开 → 关 → 再调不抛', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    unloadFavoritesUI();
    expect(document.querySelector('.bz-fav-overlay')).toBeNull();
    expect(() => unloadFavoritesUI()).not.toThrow();
  });

  it('预置数据：openPanel 渲染卡片流', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '甲', created: '2025-01-02 00:00:00' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cards().length).toBe(1);
    expect(overlayText()).toContain('甲');
  });

  it('收尾扫尾：面板/表单遮罩 topifyZ 动态发号（表单恒压主面板）+ 根节点挂 bz-panel-mtop', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const overlay = document.querySelector('.bz-fav-overlay') as HTMLElement;
    // 根节点接线移动全屏顶距工具类
    expect(overlay.querySelector('.bz-fav-panel')!.classList.contains('bz-panel-mtop')).toBe(true);
    // 静态 z 档退役：显示即发号（ADR-0067）
    const zOverlay = Number(overlay.style.zIndex);
    expect(Number.isFinite(zOverlay) && zOverlay > 0).toBe(true);
    openForm(null);
    const mask = document.querySelector('.bz-fav-form-mask') as HTMLElement;
    expect(mask).not.toBeNull();
    const zMask = Number(mask.style.zIndex);
    expect(Number.isFinite(zMask) && zMask > zOverlay).toBe(true);
    // 收尾：取消关表单
    (mask.querySelector('[data-fz-cancel]') as HTMLElement).click();
    expect(document.querySelector('.bz-fav-form-mask')).toBeNull();
    closePanel();
  });
});

function overlayText(): string {
  return (document.querySelector('.bz-fav-content') as HTMLElement)?.textContent ?? '';
}

// ==================== 2. 标签：计数 / 过滤 / 取消 / chips 同步 ====================

describe('标签栏', () => {
  it('计数正确（含归档排除）：全部 3、GitHub 2、网站 1', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '一', tags: ['GitHub'] }),
      seedItem({ id: '2', title: '二', tags: ['GitHub', '网站'] }),
      seedItem({ id: '3', title: '冷', tags: ['GitHub'], archived: true }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const side = [...document.querySelectorAll('[data-fav-tags] .bz-fav-side-item')] as HTMLElement[];
    expect(cntOf(side, '__all')).toBe('2');
    expect(cntOf(side, 'GitHub')).toBe('2');
    expect(cntOf(side, '网站')).toBe('1');
    expect(cntOf(side, '大模型')).toBe('0');
  });

  it('点标签过滤卡片；主标题变「emoji 标签」；计数文案仍全部；再点取消回全部', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: 'Git 收藏', tags: ['GitHub'], created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '网页收藏', tags: ['网站'], created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cards().length).toBe(2);
    expect(document.querySelector('[data-fav-title]')!.textContent).toBe('全部');

    clickTag('GitHub');
    await tick(10);
    expect(cards().length).toBe(1);
    expect(cardTitles()).toEqual(['Git 收藏']);
    // 主标题 = emoji + 标签
    expect(document.querySelector('[data-fav-title]')!.textContent).toContain('🐙');
    expect(document.querySelector('[data-fav-title]')!.textContent).toContain('GitHub');
    // 计数 = 过滤后（1 条收藏）
    expect(document.querySelector('[data-fav-count]')!.textContent).toBe('1 条收藏');
    // 标签高亮
    const side = [...document.querySelectorAll('[data-fav-tags] .bz-fav-side-item')] as HTMLElement[];
    expect(side.find((b) => b.dataset.favTag === 'GitHub')!.classList.contains('bz-fav-nav-active')).toBe(true);

    // 再点同标签 = 取消回全部
    clickTag('GitHub');
    await tick(10);
    expect(cards().length).toBe(2);
    expect(document.querySelector('[data-fav-title]')!.textContent).toBe('全部');
  });

  it('点「全部」（__all）从已选标签回全部；选中的卡片只显示匹配标签徽章', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '双标签', tags: ['GitHub', '网站'], created: '2025-01-01 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickTag('GitHub');
    await tick(10);
    // 卡片 meta 只显示匹配标签徽章
    const card = cards()[0];
    const badges = [...card.querySelectorAll('.bz-badge--accent')].map((e) => e.textContent);
    expect(badges).toEqual(['🐙 GitHub']);
    clickTag('__all');
    await tick(10);
    expect(cards().length).toBe(1);
    expect(document.querySelector('[data-fav-title]')!.textContent).toBe('全部');
    // 回全部后两个徽章都显示
    const badges2 = [...cards()[0].querySelectorAll('.bz-badge--accent')].map((e) => e.textContent);
    expect(badges2).toEqual(['🐙 GitHub', '🌐 网站']);
  });

  it('移动端（Platform.isMobile）：chips 与左栏同语义，点 chip 过滤、激活态同步', async () => {
    Platform.isMobile = true;
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: 'Git 收藏', tags: ['GitHub'] }),
      seedItem({ id: '2', title: 'Claude 收藏', tags: ['Claude'] }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const chips = [...document.querySelectorAll('[data-fav-mobtags] .bz-fav-mobchip')] as HTMLElement[];
    expect(chips.length).toBe(11);
    const ghChip = chips.find((b) => b.dataset.favTag === 'GitHub')!;
    ghChip.click();
    await tick(10);
    expect(cards().length).toBe(1);
    expect(cardTitles()).toEqual(['Git 收藏']);
    // 左栏同步激活 + 主标题同步
    const side = [...document.querySelectorAll('[data-fav-tags] .bz-fav-side-item')] as HTMLElement[];
    expect(side.find((b) => b.dataset.favTag === 'GitHub')!.classList.contains('bz-fav-nav-active')).toBe(true);
    expect(document.querySelector('[data-fav-title]')!.textContent).toContain('GitHub');
  });

  it('归档条目不进任何标签计数', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '活', tags: ['网站'] }),
      seedItem({ id: '2', title: '冷', tags: ['网站'], archived: true }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const side = [...document.querySelectorAll('[data-fav-tags] .bz-fav-side-item')] as HTMLElement[];
    expect(cntOf(side, '网站')).toBe('1');
    expect(cntOf(side, '__all')).toBe('1');
  });
});

function cntOf(btns: HTMLElement[], tag: string): string {
  const b = btns.find((x) => x.dataset.favTag === tag)!;
  return b.querySelector('.bz-fav-nav-cnt')!.textContent!;
}

function clickTag(label: string): void {
  const all = [...document.querySelectorAll('[data-fav-tags] .bz-fav-side-item, [data-fav-mobtags] .bz-fav-mobchip')] as HTMLElement[];
  const target = all.find((b) => b.dataset.favTag === label);
  if (!target) throw new Error('找不到标签：' + label);
  target.click();
}

// ==================== 3. 卡片渲染 ====================

describe('卡片渲染', () => {
  it('标题/简介/时间徽章/标签徽章/关联笔记徽章（去 .md 与路径）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({
        id: '1', title: '项目 A', tags: ['GitHub', 'Claude'], desc: '简介文字', url: 'https://github.com/a/b',
        linkedNote: '我的/AI 工具库.md', created: '2025-06-01 08:00:00',
      }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const card = cards()[0];
    expect(card.dataset.favId).toBe('1');
    expect(card.querySelector('.bz-fav-title')!.textContent).toBe('项目 A');
    expect(card.querySelector('.bz-fav-desc')!.textContent).toBe('简介文字');
    expect(card.classList.contains('bz-fav-card--link')).toBe(true);
    const badges = [...card.querySelectorAll('.bz-badge--accent')].map((e) => e.textContent);
    expect(badges).toEqual(['🐙 GitHub', '🤖 Claude']);
    expect(card.querySelector('.bz-fav-note-badge')!.textContent).toContain('AI 工具库');
    expect(card.querySelector('.bz-fav-note-badge')!.textContent).not.toContain('.md');
    expect(card.querySelector('.bz-fav-note-badge')!.textContent).not.toContain('我的/');
    expect(card.querySelector('.bz-fav-time-badge')!.textContent).toBe('2025-06-01 08:00:00');
  });

  it('置顶卡：bz-fav-card--pinned 类 + 时间徽章带「置顶 · 」前缀', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '置顶项', pinned: true, created: '2025-06-01 08:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const card = cards()[0];
    expect(card.classList.contains('bz-fav-card--pinned')).toBe(true);
    expect(card.querySelector('.bz-fav-time-badge')!.textContent!.trim()).toBe('置顶 · 2025-06-01 08:00:00');
  });

  it('无简介不渲染 desc 行；无 url 不加 link 类', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '纯文本', desc: '', url: '' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const card = cards()[0];
    expect(card.querySelector('.bz-fav-desc')).toBeNull();
    expect(card.classList.contains('bz-fav-card--link')).toBe(false);
  });

  it('多标签卡片徽章齐全', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '三标签', tags: ['GitHub', '大模型', '酒馆'] }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const badges = [...cards()[0].querySelectorAll('.bz-badge--accent')].map((e) => e.textContent);
    expect(badges).toEqual(['🐙 GitHub', '🧠 大模型', '🍺 酒馆']);
  });

  it('余额显示：数字 + 档位色类（ok/warn/err）；查询失败显示「查询失败」', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '富余', balance: '120.5' }),
      seedItem({ id: '2', title: '不足', balance: '50' }),
      seedItem({ id: '3', title: '告急', balance: '9.9' }),
      seedItem({ id: '4', title: '失败', balance: null, balanceError: 'HTTP 500' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const titleOf = (t: string) => cards().find((c) => c.querySelector('.bz-fav-title')!.textContent === t)!;
    expect(titleOf('富余').querySelector('.bz-fav-balance')!.classList.contains('bz-fav-balance--ok')).toBe(true);
    expect(titleOf('不足').querySelector('.bz-fav-balance')!.classList.contains('bz-fav-balance--warn')).toBe(true);
    expect(titleOf('告急').querySelector('.bz-fav-balance')!.classList.contains('bz-fav-balance--err')).toBe(true);
    expect(titleOf('失败').querySelector('.bz-fav-balance')!.textContent).toBe('查询失败');
    expect(titleOf('失败').querySelector('.bz-fav-balance')!.classList.contains('bz-fav-balance--err')).toBe(true);
  });

  it('归档条目主列表不出现（冷存不可见）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '活条目' }),
      seedItem({ id: '2', title: '冷存条目', archived: true, archivedAt: '2026-08-30 10:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cards().length).toBe(1);
    expect(overlayText()).toContain('活条目');
    expect(overlayText()).not.toContain('冷存条目');
  });
});

// ==================== 4. 排序（created 默认 / title 循环 / 置顶恒前） ====================

describe('排序', () => {
  it('默认 created 倒序（最新在前）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '旧条目', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '新条目', created: '2025-01-03 00:00:00' }),
      seedItem({ id: '3', title: '中条目', created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['新条目', '中条目', '旧条目']);
    expect(document.querySelector('[data-fav-sort-label]')!.textContent).toBe('最新收藏');
  });

  it('点排序钮 → 标题序（favoritesSortKey 写设置）+ 按钮 label 变「标题排序」', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: 'C 条目', created: '2025-01-03 00:00:00' }), // 最新
      seedItem({ id: '2', title: 'A 条目', created: '2025-01-01 00:00:00' }), // 最旧
      seedItem({ id: '3', title: 'B 条目', created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    // created 倒序
    expect(cardTitles()).toEqual(['C 条目', 'B 条目', 'A 条目']);
    const sortBtn = document.querySelector('[data-fav-sort].bz-fav-sort-btn') as HTMLElement;
    sortBtn.click();
    await tick(20);
    // 标题序（与时间序相反才可区分）
    expect(cardTitles()).toEqual(['A 条目', 'B 条目', 'C 条目']);
    expect(document.querySelector('[data-fav-sort-label]')!.textContent).toBe('标题排序');
    expect(ctx.state.favoritesSortKey).toBe('title');
    expect(ctx.saveCount()).toBe(1);
    // 再点回 created
    sortBtn.click();
    await tick(20);
    expect(cardTitles()).toEqual(['C 条目', 'B 条目', 'A 条目']);
    expect(document.querySelector('[data-fav-sort-label]')!.textContent).toBe('最新收藏');
    expect(ctx.state.favoritesSortKey).toBe('created');
  });

  it('设置 favoritesSortKey=title：打开面板直接标题序', async () => {
    const ctx = await setup();
    ctx.state.favoritesSortKey = 'title';
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: 'Z', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: 'A', created: '2025-01-03 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['A', 'Z']);
    expect(document.querySelector('[data-fav-sort-label]')!.textContent).toBe('标题排序');
  });

  it('置顶恒最前（created 与 title 排序均置顶优先）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '顶顶', pinned: true, created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: 'AAA', created: '2025-01-03 00:00:00' }),
      seedItem({ id: '3', title: '顶二', pinned: true, created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    // created：置顶组内按 created 倒序排最前
    expect(cardTitles()).toEqual(['顶二', '顶顶', 'AAA']);
    // title 排序：置顶仍在前（组内按标题）
    (document.querySelector('[data-fav-sort].bz-fav-sort-btn') as HTMLElement).click();
    await tick(20);
    expect(cardTitles()).toEqual(['顶顶', '顶二', 'AAA']);
  });
});

// ==================== 5. 搜索 ====================

describe('搜索', () => {
  it('输入过滤 180ms 防抖后渲染；命中标题', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '我的项目', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '其他网页', tags: ['网站'], created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const input = document.querySelector('[data-fav-search]') as HTMLInputElement;
    input.value = '项目';
    input.dispatchEvent(new Event('input'));
    // 防抖窗口内未渲染
    expect(cards().length).toBe(2);
    await tick(250);
    expect(cards().length).toBe(1);
    expect(cardTitles()).toEqual(['我的项目']);
    expect(document.querySelector('[data-fav-count]')!.textContent).toBe('1 条收藏');
  });

  it('防抖：连续输入只按最终关键词渲染', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '项目甲', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '网页乙', tags: ['网站'], created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const input = document.querySelector('[data-fav-search]') as HTMLInputElement;
    input.value = '甲';
    input.dispatchEvent(new Event('input'));
    await tick(60);
    input.value = '乙';
    input.dispatchEvent(new Event('input'));
    await tick(250);
    expect(cards().length).toBe(1);
    expect(cardTitles()).toEqual(['网页乙']);
  });

  it('无结果空态带关键词 + 小字；清空恢复', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '我的项目' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const input = document.querySelector('[data-fav-search]') as HTMLInputElement;
    input.value = '不存在的词';
    input.dispatchEvent(new Event('input'));
    await tick(250);
    const empty = document.querySelector('.bz-fav-content .bz-empty') as HTMLElement;
    expect(empty).not.toBeNull();
    expect(empty.querySelector('.bz-empty-title')!.textContent).toBe('没有匹配「不存在的词」的收藏');
    expect(empty.querySelector('.bz-empty-desc')!.textContent).toBe('试试其他关键词，或清除搜索');
    expect(document.querySelector('[data-fav-count]')!.textContent).toBe('0 条收藏');
    // 清空恢复
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await tick(250);
    expect(cards().length).toBe(1);
  });

  it('搜索匹配简介 / 标签文案 / 关联笔记名', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: 'A', desc: '独有简介词', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: 'B', tags: ['酒馆'], created: '2025-01-02 00:00:00' }),
      seedItem({ id: '3', title: 'C', linkedNote: '我的/库/独有笔记.md', created: '2025-01-03 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const input = document.querySelector('[data-fav-search]') as HTMLInputElement;
    const searchOnce = async (kw: string): Promise<string[]> => {
      input.value = kw;
      input.dispatchEvent(new Event('input'));
      await tick(250);
      return cardTitles() as string[];
    };
    expect(await searchOnce('独有简介词')).toEqual(['A']);
    expect(await searchOnce('酒馆')).toEqual(['B']);
    expect(await searchOnce('独有笔记')).toEqual(['C']);
  });

  it('搜索与标签筛选叠加', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: 'Git 项目甲', tags: ['GitHub'], created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: 'Git 项目乙', tags: ['网站'], created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickTag('GitHub');
    await tick(10);
    const input = document.querySelector('[data-fav-search]') as HTMLInputElement;
    input.value = 'Git';
    input.dispatchEvent(new Event('input'));
    await tick(250);
    expect(cardTitles()).toEqual(['Git 项目甲']);
  });
});

// ==================== 6. 行动作（桌面点卡 → .bz-item-menu） ====================

describe('桌面行动作浮层', () => {
  it('点卡片弹 .bz-item-menu；动作文案集合按数据条件（无 url 无 note：置顶/编辑/归档/删除）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '无链接收藏', url: '', desc: 'x' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    const menu = document.querySelector('.bz-item-menu');
    expect(menu).not.toBeNull();
    expect(menuLabels()).toEqual(['置顶', '编辑', '归档', '删除']);
    // 删除项 danger 类
    const delItem = [...menu!.querySelectorAll('.bz-item-menu-item')].find(
      (i) => i.querySelector('.bz-item-menu-label')?.textContent === '删除'
    );
    expect(delItem!.classList.contains('bz-item-menu-item--danger')).toBe(true);
    closeItemMenu();
  });

  it('右键同样触发浮层', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: 'x', url: '' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const card = cards()[0];
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
    await tick(10);
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    closeItemMenu();
  });

  it('有 url：动作含「打开」且首位；点打开 → app.openUrl 收到 normalizeUrl(url)', async () => {
    const ctx = await setup();
    const app = getApp() as any;
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '我的项目', url: 'https://github.com/a/b', desc: 'x' }),
      seedItem({ id: '2', title: '无协议', url: 'github.com/x/y', desc: 'x', created: '2025-06-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const byTitle = (t: string) => cards().find((c) => c.querySelector('.bz-fav-title')!.textContent === t)!;
    clickCard(byTitle('我的项目'));
    await tick(10);
    expect(menuLabels()[0]).toBe('打开');
    clickAction('打开');
    await tick(10);
    expect(app.openUrl).toHaveBeenCalledWith('https://github.com/a/b');
    expect(document.querySelector('.bz-item-menu')).toBeNull(); // 非 keepOpen 动作浮层收起

    clickCard(byTitle('无协议'));
    await tick(10);
    clickAction('打开');
    await tick(10);
    expect(app.openUrl).toHaveBeenCalledWith('https://github.com/x/y'); // 补协议头
  });

  it('有 linkedNote：动作含「跳转笔记」；点跳转 → closePanel + workspace.openLinkText', async () => {
    const ctx = await setup();
    const app = getApp() as any;
    ctx.vault.files.set('我的/笔记库/A 笔记.md', '# 内容');
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '带笔记', url: '', desc: 'x', linkedNote: '我的/笔记库/A 笔记.md' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    expect(menuLabels()).toContain('跳转笔记');
    clickAction('跳转笔记');
    await tick(10);
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('我的/笔记库/A 笔记.md', '', false);
    expect(document.querySelector('.bz-fav-overlay')).toBeNull(); // 面板关闭
  });

  it('跳转笔记目标不存在 → warning 提示、面板保持', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '孤链', url: '', desc: 'x', linkedNote: '不存在的笔记.md' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('跳转笔记');
    await tick(10);
    expect(hasNotice('笔记文件不存在：不存在的笔记.md')).toBe(true);
    expect(document.querySelector('.bz-fav-overlay')).not.toBeNull();
  });

  it('置顶 toggle：update 写盘 pinned + 列表重排；重开浮层动作翻转为「取消置顶」', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '甲', created: '2025-06-02 00:00:00' }),
      seedItem({ id: '2', title: '乙', created: '2025-06-01 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['甲', '乙']);
    clickCard(cards()[0]); // 甲（未置顶）
    await tick(10);
    expect(menuLabels()).toContain('置顶');
    clickAction('置顶');
    // 桌面菜单点项 = 浮层收起（keepOpen 语义只服务抽屉路径）
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    await tick(40);
    // 写盘
    expect((await ctx.dm.getAll()).find((d) => d.id === '1')!.pinned).toBe(true);
    // 列表重排：置顶最前
    expect(cardTitles()).toEqual(['甲', '乙']);
    // 置顶卡样式
    expect(cards()[0].classList.contains('bz-fav-card--pinned')).toBe(true);
    // 重开浮层：动作翻转为「取消置顶」
    clickCard(cards()[0]);
    await tick(10);
    expect(menuLabels()).toContain('取消置顶');
    closeItemMenu();
  });

  it('置顶：update 失败 → 回滚 + notifySaveError', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '甲', url: '' })]);
    vi.spyOn(ctx.dm, 'update').mockRejectedValue(new Error('磁盘只读'));
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('置顶');
    await tick(30);
    expect(hasNotice('保存失败（置顶收藏）：磁盘只读')).toBe(true);
    expect((await ctx.dm.getAll())[0].pinned).toBe(false); // 数据未变
  });

  it('归档：点归档 → 浮层收起 → flow-dialog（message 文案）→ 确定 → 冷存 + 卡片消失 + 事件 archive', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '归档项', url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('归档');
    await tick(10);
    // 非 keepOpen：浮层收起
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    // flow-dialog
    const popup = document.getElementById('__shared_confirm_popup__');
    expect(popup).not.toBeNull();
    expect(popup!.textContent).toContain('确定归档收藏「归档项」吗？');
    expect(popup!.textContent).toContain('归档后不在主列表显示（数据保留），可在通知中撤销。');
    // B 包扫尾：标题「归档收藏」+ 确认按钮动词化（不是「确定」）
    expect(popup!.querySelector('h4')!.textContent).toBe('归档收藏');
    expect((document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).textContent).toBe('归档');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(30);
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.archived).toBe(true);
    expect(saved.archivedAt).toBeTruthy();
    // 卡片消失；归档带撤销 toast（ticket 188：文案带标题）
    expect(cards().length).toBe(0);
    expect(overlayText()).toContain('暂无收藏');
    expect(hasNotice('已归档收藏「归档项」')).toBe(true);
    expect([...document.querySelectorAll('.bz-notice-action')].some((b) => b.textContent === '撤销')).toBe(true);
    // 事件
    expect(events.calls).toEqual([{ kind: 'archive', title: '归档项' }]);
    events.off();
  });

  it('归档撤销：点撤销 → archived 回 false + 卡片回主列表 + unarchive 事件（ticket 188）', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '归档项', url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('归档');
    await tick(10);
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(30);
    expect((await ctx.dm.getAll())[0].archived).toBe(true);
    events.calls.length = 0;
    const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLElement;
    undoBtn.click();
    await tick(30);
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.archived).toBe(false);
    expect(cards().length).toBe(1);
    expect(events.calls).toEqual([{ kind: 'unarchive', title: '归档项' }]);
    events.off();
  });

  it('归档：flow-dialog 取消 → 不归档、卡片仍在', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '归档项', url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('归档');
    await tick(10);
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await tick(30);
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.archived).toBeUndefined();
    expect(cards().length).toBe(1);
    expect(events.calls.length).toBe(0);
    events.off();
  });

  it('删除：确认 → 卡片消失 + 撤销 toast + 事件 delete；点撤销 → restoreItem 原样 + 卡片回', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '9', title: '被删条目', pinned: true, desc: 'x', created: '2025-06-01 08:00:00' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('删除');
    await tick(10);
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    const popup = document.getElementById('__shared_confirm_popup__');
    expect(popup!.textContent).toContain('确定删除收藏「被删条目」吗？');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(30);
    expect((await ctx.dm.getAll()).length).toBe(0);
    expect(cards().length).toBe(0);
    expect(events.calls).toEqual([{ kind: 'delete', title: '被删条目' }]);
    // 撤销 toast
    expect(hasNotice('已删除收藏「被删条目」')).toBe(true);
    const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLElement;
    expect(undoBtn).toBeTruthy();
    undoBtn.click();
    await tick(30);
    const restored = await ctx.dm.getAll();
    expect(restored.length).toBe(1);
    expect(restored[0]).toMatchObject({ id: '9', title: '被删条目', pinned: true, created: '2025-06-01 08:00:00' });
    expect(cards().length).toBe(1);
    expect(cards()[0].textContent).toContain('被删条目');
    events.off();
  });

  it('删除：flow-dialog 取消 → 不删、无撤销 toast', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '留着', url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('删除');
    await tick(10);
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await tick(30);
    expect((await ctx.dm.getAll()).length).toBe(1);
    expect(cards().length).toBe(1);
    expect(events.calls.length).toBe(0);
    expect([...document.querySelectorAll('.bz-notice-action')].some((b) => b.textContent === '撤销')).toBe(false);
    events.off();
  });

  it('删除写盘失败 → notifySaveError，不弹撤销 toast，数据仍在', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '删不掉', url: '', desc: 'x' })]);
    vi.spyOn(ctx.dm, 'delete').mockRejectedValue(new Error('磁盘只读'));
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('删除');
    await tick(10);
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(30);
    expect(hasNotice('保存失败（删除收藏）：磁盘只读')).toBe(true);
    expect([...document.querySelectorAll('.bz-notice-action')].some((b) => b.textContent === '撤销')).toBe(false);
    expect((await ctx.dm.getAll()).length).toBe(1);
  });
});

// ==================== 7. 添加表单 ====================

describe('添加表单', () => {
  function openAddViaMainBtn(): void {
    const btn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-btn--primary')
    ) as HTMLElement;
    btn.click();
  }

  function formEls() {
    const form = document.querySelector('.bz-fav-form') as HTMLElement;
    if (!form) throw new Error('表单未打开');
    const g = (id: string) => form.querySelector(id) as HTMLInputElement;
    return {
      form,
      title: g('#fz-title'),
      url: g('#fz-url'),
      desc: g('#fz-desc') as unknown as HTMLTextAreaElement,
      note: g('#fz-note'),
      keys: g('#fz-keys') as unknown as HTMLTextAreaElement,
      balurl: g('#fz-balurl'),
      err: form.querySelector('#fz-err') as HTMLElement,
      save: form.querySelector('#fz-save') as HTMLButtonElement,
      pin: form.querySelector('#fz-pin') as HTMLElement,
      llm: form.querySelector('#fz-llm') as HTMLElement,
      tagBtns: [...form.querySelectorAll('#fz-tags [data-tag]')] as HTMLElement[],
      aiBtn: form.querySelector('[data-fz-ai]') as HTMLButtonElement,
      cancel: form.querySelector('[data-fz-cancel]') as HTMLButtonElement,
      titleEl: form.querySelector('.bz-fav-form-title') as HTMLElement,
    };
  }
  const clickTagBtn = (els: ReturnType<typeof formEls>, label: string) => {
    const b = els.tagBtns.find((x) => x.dataset.tag === label)!;
    b.click();
    return b;
  };

  it('主按钮弹表单；标题「添加收藏」+ 保存钮「保存」+ 9 个标签钮', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    expect(document.querySelector('.bz-fav-form-mask')).not.toBeNull();
    expect(els.titleEl.textContent).toBe('添加收藏');
    expect(els.save.textContent).toBe('保存');
    expect(els.tagBtns.length).toBe(9);
    // LLM 区默认隐藏
    expect(els.llm.classList.contains('bz-fav-llm-on')).toBe(false);
  });

  it('校验链：空标题 → 请输入标题；url 非 http → 链接需以 http(s):// 开头；无标签 → 请至少选择一个标签', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.save.click();
    await tick(10);
    expect(els.err.textContent).toBe('请输入标题');

    els.title.value = '标题有了';
    els.url.value = 'github.com/no-protocol';
    els.save.click();
    await tick(10);
    expect(els.err.textContent).toBe('链接需以 http(s):// 开头');

    els.url.value = 'https://github.com/ok';
    els.save.click();
    await tick(10);
    expect(els.err.textContent).toBe('请至少选择一个标签');
    // 库未写入
    expect((await ctx.dm.getAll()).length).toBe(0);
  });

  it('选「大模型」无 keys → 请填写 API Keys', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.title.value = 'LLM 收藏';
    clickTagBtn(els, '大模型');
    expect(els.llm.classList.contains('bz-fav-llm-on')).toBe(true); // 选中展开 LLM 区
    els.save.click();
    await tick(10);
    expect(els.err.textContent).toBe('请填写 API Keys');
    expect((await ctx.dm.getAll()).length).toBe(0);
  });

  it('填全保存：dm.add 落盘 13 字段 + 卡片出现 + toast「收藏已添加」+ 事件 add(item)', async () => {
    const ctx = await setup();
    const events = eventCollector();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.title.value = '新收藏';
    els.url.value = 'https://github.com/x/y';
    els.desc.value = '新简介';
    clickTagBtn(els, 'GitHub');
    els.pin.click(); // 置顶 on
    expect(els.pin.classList.contains('on')).toBe(true);
    els.save.click();
    await tick(40);

    const data = await ctx.dm.getAll();
    expect(data.length).toBe(1);
    const saved = data[0];
    expect(saved.id).toBeTruthy();
    expect(saved.tags).toEqual(['GitHub']);
    expect(saved.title).toBe('新收藏');
    expect(saved.description).toBe('新简介');
    expect(saved.pinned).toBe(true);
    expect(saved.url).toBe('https://github.com/x/y');
    expect(saved.balance).toBeNull();
    expect(saved.balanceCacheTime).toBeNull();
    expect(saved.balanceError).toBeNull();
    expect(saved.linkedNote).toBeNull();
    expect(saved.created).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(saved.type).toBe('GitHub');
    expect(saved.llmConfig).toBeUndefined();
    expect(Object.keys(saved).length).toBe(12); // 12 必选字段，无 llmConfig（无大模型标签）
    // 卡片出现（置顶在最前）
    expect(cardTitles()).toEqual(['新收藏']);
    // toast
    expect(hasNotice('收藏已添加')).toBe(true);
    // 表单关
    expect(document.querySelector('.bz-fav-form')).toBeNull();
    // 事件载荷
    expect(events.calls.length).toBe(1);
    const evt: any = events.calls[0];
    expect(evt.kind).toBe('add');
    expect(evt.item).toMatchObject({
      title: '新收藏', url: 'https://github.com/x/y', description: '新简介',
      tags: ['GitHub'], pinned: true, type: 'GitHub',
    });
    expect(evt.item.id).toBeTruthy();
    events.off();
  });

  it('选「大模型」+ keys 无 url → 保存成功 llmConfig={apiKeys, balanceUrl:""}', async () => {
    const ctx = await setup();
    const events = eventCollector();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.title.value = 'LLM 收藏';
    clickTagBtn(els, '大模型');
    els.keys.value = 'sk-abc';
    els.save.click();
    await tick(40);
    const data = await ctx.dm.getAll();
    expect(data.length).toBe(1);
    expect(data[0].llmConfig).toEqual({ apiKeys: 'sk-abc', balanceUrl: '' });
    expect(data[0].balance).toBeNull();
    expect(events.calls[0].kind).toBe('add');
    events.off();
  });

  it('AI 不可用 → 点 AI 整理只 notice，不调用 ai.chat', async () => {
    const ctx = await setup();
    ctx.state.opencodeGoApiKey = ''; // 清掉 key → isAvailable false
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.url.value = 'https://example.com/x';
    const chat = vi.fn();
    ctx.ai.ai = { chat } as any;
    els.aiBtn.click();
    await tick(20);
    expect(hasNotice('AI 服务未配置或不可用')).toBe(true);
    expect(chat).not.toHaveBeenCalled();
  });

  it('AI 整理：输入全空 → notice「请至少输入标题、链接或简介中的一项」', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.aiBtn.click();
    await tick(20);
    expect(hasNotice('请至少输入标题、链接或简介中的一项，以便 AI 参考')).toBe(true);
  });

  it('AI 整理 happy path：mock ai.chat → 回填 title/url/desc + 标签选中 + 完成 toast', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.url.value = 'https://example.com/x';
    const chat = vi.fn().mockResolvedValue(
      '{"title":"AI标题","url":"https://github.com/foo/bar","description":"AI简介","tags":["GitHub","Claude"]}'
    );
    ctx.ai.ai = { chat } as any;
    els.aiBtn.click();
    await tick(40);
    expect(els.title.value).toBe('AI标题');
    expect(els.desc.value).toBe('AI简介');
    expect(hasNotice('AI 整理完成')).toBe(true);
    // 标签选中（is-on；drawPick 重建过按钮，须重新查询）
    const onTags = [...document.querySelectorAll('#fz-tags [data-tag].is-on')].map((b) => (b as HTMLElement).dataset.tag);
    expect(onTags).toEqual(['GitHub', 'Claude']);
    // 按钮复位
    expect(els.aiBtn.disabled).toBe(false);
    // AI 已填可直接保存
    els.save.click();
    await tick(40);
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.title).toBe('AI标题');
    expect(saved.tags).toEqual(['GitHub', 'Claude']);
  });

  it('AI 整理失败（chat reject）→ progress toast 转 error「AI 整理失败：网络错误」', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.url.value = 'https://example.com/x';
    ctx.ai.ai = { chat: vi.fn().mockRejectedValue(new Error('网络错误')) } as any;
    els.aiBtn.click();
    await tick(40);
    const errNotice = [...document.querySelectorAll('.bz-notice')].find(
      (n) => n.querySelector('.bz-notice--error') || n.classList.contains('bz-notice--error')
    );
    const texts = [...document.querySelectorAll('.bz-notice-msg')].map((e) => e.textContent);
    expect(texts.some((t) => t.includes('AI 整理失败：网络错误'))).toBe(true);
    expect(errNotice).toBeTruthy();
    // 表单字段未被覆盖
    expect(els.title.value).toBe('');
  });

  it('AI 整理：未知标签提示「不在列表中，已忽略」', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.url.value = 'https://example.com/x';
    ctx.ai.ai = { chat: vi.fn().mockResolvedValue('{"title":"T","tags":["不存在标签"]}') } as any;
    els.aiBtn.click();
    await tick(40);
    expect(hasNotice(/不在列表中，已忽略/)).toBe(true);
    // 无有效标签：保存仍被拦截
    els.save.click();
    await tick(10);
    expect(els.err.textContent).toBe('请至少选择一个标签');
  });

  it('AI 整理：GitHub 链接 → 提示词带仓库简介 + GitHub 标签兜底选中', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.url.value = 'https://github.com/hellowind777/helloagents';
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ name: 'helloagents', description: 'A collection of AI experiments' }),
    } as any);
    const chat = vi.fn().mockResolvedValue('{"title":"helloagents","description":"一个 AI 实验合集","tags":["Claude"]}');
    ctx.ai.ai = { chat } as any;
    els.aiBtn.click();
    await tick(60);
    // GitHub 仓库名预填标题（空字段）+ 简介由 AI 回填
    expect(els.title.value).toBe('helloagents');
    expect(els.desc.value).toBe('一个 AI 实验合集');
    // GitHub 标签兜底强制选中（兜底插在列表最前；drawPick 重建过按钮须重新查询）
    const onTags = [...document.querySelectorAll('#fz-tags [data-tag].is-on')].map((b) => (b as HTMLElement).dataset.tag);
    expect(onTags).toEqual(['GitHub', 'Claude']);
    // 提示词含仓库简介原文 + 忠实翻译约束
    const prompt = (chat.mock.calls[0] as any)[0] as string;
    expect(prompt).toContain('A collection of AI experiments');
    expect(prompt).toContain('忠实翻译成中文');
    expect(prompt).toContain('不扩写、不总结、不凑字数');
  });
});

// ==================== 8. 编辑 ====================

describe('编辑收藏', () => {
  it('菜单「编辑」→ 表单回填（title/url/desc/tags/pin）+ 标题「编辑收藏」+ 保存钮「更新」', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({
        id: '7', title: '原标题', desc: '原简介', url: 'https://github.com/a/b', pinned: true,
        tags: ['GitHub', '网站'], linkedNote: '我的/笔记.md',
      }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    const form = document.querySelector('.bz-fav-form') as HTMLElement;
    expect(form).not.toBeNull();
    expect(form.querySelector('.bz-fav-form-title')!.textContent).toBe('编辑收藏');
    expect((form.querySelector('#fz-save') as HTMLButtonElement).textContent).toBe('更新');
    expect((form.querySelector('#fz-title') as HTMLInputElement).value).toBe('原标题');
    expect((form.querySelector('#fz-url') as HTMLInputElement).value).toBe('https://github.com/a/b');
    expect((form.querySelector('#fz-desc') as HTMLTextAreaElement).value).toBe('原简介');
    expect((form.querySelector('#fz-note') as HTMLInputElement).value).toBe('我的/笔记.md');
    // 标签回填选中
    const onTags = [...form.querySelectorAll('#fz-tags [data-tag].is-on')].map((b) => (b as HTMLElement).dataset.tag);
    expect(onTags).toEqual(['GitHub', '网站']);
    // 置顶钮 on
    expect(form.querySelector('#fz-pin')!.classList.contains('on')).toBe(true);
    // 未选大模型 → LLM 区不展开；无 llmConfig 时 keys/balurl 回填空
    expect(form.querySelector('#fz-llm')!.classList.contains('bz-fav-llm-on')).toBe(false);
    expect((form.querySelector('#fz-keys') as unknown as HTMLTextAreaElement).value).toBe('');
    expect((form.querySelector('#fz-balurl') as HTMLInputElement).value).toBe('');
  });

  it('编辑「大模型」收藏：LLM 区展开 + keys/balurl 回填（编辑保存不丢配置）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({
        id: '8', title: 'LLM 条目', tags: ['大模型'], url: '',
        llm: { apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' },
        balance: '9.9', balanceCacheTime: Date.now(),
      }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    const form = document.querySelector('.bz-fav-form') as HTMLElement;
    expect(form.querySelector('#fz-llm')!.classList.contains('bz-fav-llm-on')).toBe(true);
    expect((form.querySelector('#fz-keys') as unknown as HTMLTextAreaElement).value).toBe('sk-1');
    expect((form.querySelector('#fz-balurl') as HTMLInputElement).value).toBe('https://api.example.com/balance');
    // 不改配置直接保存：llmConfig 保留（sameCfg → 不清余额）
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.llmConfig).toEqual({ apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' });
    expect(saved.balance).toBe('9.9'); // 缓存余额保留
  });

  it('改标题保存 → dm.update + 事件 edit changes=["改了标题"] + toast「收藏已更新」+ created 保留', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [
      seedItem({ id: '7', title: '原标题', desc: '原简介', url: 'https://github.com/a/b', tags: ['GitHub', '网站'], created: '2025-06-01 08:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    const titleInput = document.querySelector('#fz-title') as HTMLInputElement;
    titleInput.value = '改后标题';
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.title).toBe('改后标题');
    expect(saved.created).toBe('2025-06-01 08:00:00'); // created 保留
    expect(saved.tags).toEqual(['GitHub', '网站']);
    expect(hasNotice('收藏已更新')).toBe(true);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
    expect(cards()[0].textContent).toContain('改后标题');
    expect(events.calls).toEqual([{ kind: 'edit', title: '改后标题', changes: ['改了标题'] }]);
    events.off();
  });
  it('编辑未改动保存 → changes 空数组（载荷仍发）', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '7', title: '原标题', desc: '原简介', url: '', tags: ['GitHub'] })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    expect(events.calls).toEqual([{ kind: 'edit', title: '原标题', changes: [] }]);
    expect(hasNotice('收藏已更新')).toBe(true);
    events.off();
  });

  it('编辑取消「大模型」标签保存 → llmConfig/balance 显式置 null', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({
        id: '7', title: 'LLM 条目', tags: ['大模型', '网站'], url: '',
        llm: { apiKeys: 'sk-old', balanceUrl: '' }, balance: '9.9', balanceCacheTime: Date.now(),
      }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    // 取消「大模型」标签
    const aiTagBtn = [...document.querySelectorAll('#fz-tags [data-tag]')].find(
      (b) => (b as HTMLElement).dataset.tag === '大模型'
    ) as HTMLElement;
    aiTagBtn.click();
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.tags).toEqual(['网站']);
    expect(saved.llmConfig).toBeNull();
    expect(saved.balance).toBeNull();
    expect(saved.balanceCacheTime).toBeNull();
  });
});

// ==================== 9. 余额 ====================

describe('余额', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('打开面板自动 fetchBalance（非缓存）→ 写盘 balance + 卡片显示余额', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({
        id: '1', title: 'LLM 条目', tags: ['大模型'], url: '',
        llm: { apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' },
      }),
    ]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ balance: 42.5 }) });
    vi.stubGlobal('fetch', fetchMock);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(60);
    expect(fetchMock).toHaveBeenCalled();
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.balance).toBe('42.5');
    expect(saved.balanceCacheTime).toBeTruthy();
    expect(saved.balanceError).toBeNull();
    expect(cards()[0].querySelector('.bz-fav-balance')!.textContent).toBe('42.5');
    expect(cards()[0].querySelector('.bz-fav-balance')!.classList.contains('bz-fav-balance--warn')).toBe(true); // 42.5 < 100
  });

  it('缓存有效（5 分钟内）→ 打开面板不再查询', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({
        id: '1', title: 'LLM 条目', tags: ['大模型'], url: '',
        llm: { apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' },
        balance: '66.6', balanceCacheTime: Date.now(),
      }),
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(60);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cards()[0].querySelector('.bz-fav-balance')!.textContent).toBe('66.6');
  });

  it('查询失败 → 卡片显示「查询失败」+ balanceError 写盘', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({
        id: '1', title: 'LLM 条目', tags: ['大模型'], url: '',
        llm: { apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' },
      }),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('网络不可达')));
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(60);
    expect(cards()[0].querySelector('.bz-fav-balance')!.textContent).toBe('查询失败');
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.balanceError).toBe('网络不可达');
  });

  it('菜单「刷新余额」（llmConfig 齐全时出现）→ 再查 + update 写盘', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({
        id: '1', title: 'LLM 条目', tags: ['大模型'], url: '',
        llm: { apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' },
      }),
    ]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ balance: 10 }) })   // 打开面板自动查
      .mockResolvedValueOnce({ ok: true, json: async () => ({ balance: 88.8 }) }); // 刷新余额
    vi.stubGlobal('fetch', fetchMock);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(60);
    expect(cards()[0].querySelector('.bz-fav-balance')!.textContent).toBe('10');

    clickCard(cards()[0]);
    await tick(10);
    expect(menuLabels()).toContain('刷新余额');
    clickAction('刷新余额');
    await tick(60);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.balance).toBe('88.8');
    expect(cards()[0].querySelector('.bz-fav-balance')!.textContent).toBe('88.8');
    // keepOpen：桌面菜单…… 打开的是菜单（非抽屉）——点刷新后 rebuild 空转，菜单已被点击项收起
    // （keepOpen 语义主要服务于抽屉路径，见移动端用例）
  });

  it('无 apiKeys 或无 balanceUrl 条目 → 不出现「刷新余额」动作', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '普通', url: '', desc: 'x' }),
      seedItem({ id: '2', title: '有 keys 无 url', tags: ['大模型'], url: '', desc: 'x', llm: { apiKeys: 'sk', balanceUrl: '' }, created: '2025-06-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const byTitle = (t: string) => cards().find((c) => c.querySelector('.bz-fav-title')!.textContent === t)!;
    clickCard(byTitle('普通'));
    await tick(10);
    expect(menuLabels()).not.toContain('刷新余额');
    closeItemMenu();
    clickCard(byTitle('有 keys 无 url'));
    await tick(10);
    expect(menuLabels()).not.toContain('刷新余额');
    closeItemMenu();
  });
});

// ==================== 12. smartcat 总线载荷 ====================

describe('smartcat 域事件总线', () => {
  it('add：{kind:add, item} 载荷完整', async () => {
    const ctx = await setup();
    const events = eventCollector();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const mainAdd = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-btn--primary')
    ) as HTMLElement;
    mainAdd.click();
    const title = document.querySelector('#fz-title') as HTMLInputElement;
    title.value = '总线条目';
    (document.querySelector('#fz-tags [data-tag="GitHub"]') as HTMLElement).click();
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    expect(events.calls.length).toBe(1);
    expect(events.calls[0].kind).toBe('add');
    expect(events.calls[0].item).toMatchObject({ title: '总线条目', tags: ['GitHub'], type: 'GitHub' });
    events.off();
  });

  it('edit：表单保存才发（置顶走 update 不 emit）', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '置顶走更新', url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    // 置顶动作：不发事件
    clickCard(cards()[0]);
    await tick(10);
    clickAction('置顶');
    await tick(30);
    expect(events.calls.length).toBe(0);
    closeItemMenu();
    await tick(10);
    // 表单编辑：发 edit
    clickCard(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    const title = document.querySelector('#fz-title') as HTMLInputElement;
    title.value = '改后';
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    expect(events.calls).toEqual([{ kind: 'edit', title: '改后', changes: ['改了标题'] }]);
    events.off();
  });

  it('archive / delete：动作确认后事件载荷（title 型）', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '归档目标', url: '', desc: 'x' }),
      seedItem({ id: '2', title: '删除目标', url: '', desc: 'x', created: '2025-06-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const byTitle = (t: string) => cards().find((c) => c.querySelector('.bz-fav-title')!.textContent === t)!;
    clickCard(byTitle('归档目标'));
    await tick(10);
    clickAction('归档');
    await tick(10);
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(30);
    expect(events.calls).toEqual([{ kind: 'archive', title: '归档目标' }]);
    events.calls.length = 0;

    clickCard(byTitle('删除目标'));
    await tick(10);
    clickAction('删除');
    await tick(10);
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(30);
    expect(events.calls).toEqual([{ kind: 'delete', title: '删除目标' }]);
    events.off();
  });
});

// ==================== 13. 设置 schema ====================

describe('favoritesSettingsSchema（ticket 177 空态 schema；issue 194 补显示组）', () => {
  it('桌面：显示组常显（默认排序直绑 favoritesSortKey）；移动端组门控 false', () => {
    Platform.isMobile = false;
    const schema = favoritesSettingsSchema();
    expect(schema.groups.length).toBe(2);
    // 显示组（issue 194）
    const view = schema.groups[0];
    expect(view.name).toBe('显示');
    const vrow: any = view.rows[0];
    expect(vrow.type).toBe('select');
    expect(vrow.name).toBe('默认排序');
    expect(vrow.binding.key).toBe('favoritesSortKey');
    // 移动端组：桌面门控隐藏
    const group = schema.groups[1];
    expect(group.name).toBe('移动端');
    expect(group.visibleWhen!({} as any)).toBe(false);
    const row: any = group.rows[0];
    expect(row.name).toBe('移动端默认全屏');
    expect(row.binding.key).toBe('favoritesMobileDefaultFullscreen');
  });

  it('移动：移动端组可见性 true + 绑定键不变', () => {
    Platform.isMobile = true;
    const schema = favoritesSettingsSchema();
    const group = schema.groups[1];
    expect(group.visibleWhen!({} as any)).toBe(true);
    expect(group.rows.length).toBe(1);
    expect((group.rows[0] as any).binding.key).toBe('favoritesMobileDefaultFullscreen');
  });

  it('schema 渲染：桌面移动组隐藏（显示组常显）；移动端显示「移动端默认全屏」toggle 行且键直绑写设置', () => {
    // 桌面
    Platform.isMobile = false;
    const state: Record<string, unknown> = { favoritesMobileDefaultFullscreen: true };
    setSettingsProvider(() => state as any);
    const saver = vi.fn(async () => {});
    setSettingsSaver(saver);
    let container = document.createElement('div');
    renderSettingsInto(container, favoritesSettingsSchema());
    const groupEls = [...container.querySelectorAll('.bz-settings-group')] as HTMLElement[];
    expect(groupEls).toHaveLength(2);
    // 桌面：显示组可见；移动端组整组隐藏
    expect(groupEls[0].classList.contains('bz-setting-hidden')).toBe(false);
    expect(groupEls[1].classList.contains('bz-setting-hidden')).toBe(true);
    // 行本身渲染但挂隐藏类（声明式渲染不删 DOM）
    const row0 = container.querySelector('.setting-item[data-name="移动端默认全屏"]') as HTMLElement;
    expect(row0).toBeTruthy();
    expect(row0.classList.contains('bz-setting-hidden')).toBe(true);

    // 移动端
    Platform.isMobile = true;
    container = document.createElement('div');
    renderSettingsInto(container, favoritesSettingsSchema());
    const row = [...container.querySelectorAll('.setting-item')].find(
      (el) => (el as HTMLElement).dataset.name === '移动端默认全屏'
    ) as HTMLElement;
    expect(row).toBeTruthy();
    expect(container.querySelector('.bz-setting-hidden')).toBeNull();
    const toggle = (row as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
    expect(toggle.value).toBe(true); // 键直绑初始值回填
    toggle.trigger(false);
    expect(state.favoritesMobileDefaultFullscreen).toBe(false);
    expect(saver).toHaveBeenCalledTimes(1);
  });
});

// ==================== 14. 移动抽屉 ====================

describe('移动端抽屉', () => {
  it('Platform.isMobile → 点卡弹 .bz-item-sheet（头部 + 动作项），编辑 keepOpen 抽屉仍在', async () => {
    Platform.isMobile = true;
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '抽屉条目', tags: ['GitHub'], desc: 'x', url: '', linkedNote: '我的/说明.md' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    // 移动点卡 = 抽屉
    cards()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(450); // 越过触屏残余 click 静置窗口（400ms），后续点击才不被吞
    const sheet = document.querySelector('.bz-item-sheet');
    expect(sheet).not.toBeNull();
    expect(document.querySelector('.bz-item-sheet-mask')).not.toBeNull();
    // 头部（sheetHead）：emoji + 标题
    expect(document.querySelector('.bz-fav-sheet-title')!.textContent).toBe('抽屉条目');
    expect(document.querySelector('.bz-fav-sheet-emoji')!.textContent).toBe('🐙');
    // 动作项含抽屉专属小字（跳转笔记 = 去 .md 的笔记名）
    const subs = [...document.querySelectorAll('.bz-item-sheet-item-sub')].map((e) => e.textContent);
    expect(subs).toContain('说明');
    // 删除为危险项
    const del = [...document.querySelectorAll('.bz-item-sheet-item')].find(
      (i) => i.querySelector('.bz-item-sheet-label')?.textContent === '删除'
    );
    expect(del!.classList.contains('bz-item-sheet-item--danger')).toBe(true);

    // 编辑：keepOpen 抽屉保持 + 表单叠上（companion）
    clickAction('编辑');
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    // 保存后抽屉关闭（closeForm → closeItemMenu）
    (document.querySelector('#fz-title') as HTMLInputElement).value = '改后';
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    expect((await ctx.dm.getAll())[0].title).toBe('改后');
  });

  it('移动抽屉：点遮罩关闭抽屉', async () => {
    Platform.isMobile = true;
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: 'x', url: '', desc: 'y' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    cards()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(10);
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    const mask = document.querySelector('.bz-item-sheet-mask') as HTMLElement;
    mask.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await tick(10);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
  });
});

// ==================== 脏表单拦截 + ESC ====================

describe('脏表单拦截', () => {
  function openAddForm(): void {
    const btn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-btn--primary')
    ) as HTMLElement;
    btn.click();
  }
  const maskEl = () => document.querySelector('.bz-fav-form-mask') as HTMLElement;

  it('空白表单点遮罩直接关，无 confirm', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    maskEl().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();
  });

  it('有输入点遮罩 → confirmDiscard：继续编辑保持 / 放弃关闭', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    const title = document.querySelector('#fz-title') as HTMLInputElement;
    title.value = '未保存草稿';
    maskEl().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await tick(10);
    // confirm 弹出
    const popup = document.getElementById('__shared_confirm_popup__');
    expect(popup).not.toBeNull();
    expect(popup!.textContent).toContain('弹窗内有未保存的输入，关闭后将丢失');
    expect(document.querySelector('.bz-fav-form')).not.toBeNull(); // 表单保持
    // 继续编辑（第二动作 = __shared_confirm_ok__）
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
    expect((document.querySelector('#fz-title') as HTMLInputElement).value).toBe('未保存草稿');
    // 再点遮罩 → 放弃（第一动作 = __shared_confirm_cancel__）
    maskEl().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await tick(10);
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
  });

  it('取消钮同样走脏拦截', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    (document.querySelector('[data-fz-cancel]') as HTMLElement).click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull(); // 空白直接关

    openAddForm();
    (document.querySelector('#fz-title') as HTMLInputElement).value = '改一半';
    (document.querySelector('[data-fz-cancel]') as HTMLElement).click();
    await tick(10);
    expect(document.getElementById('__shared_confirm_mask__')).not.toBeNull();
  });

  it('编辑模式未改动 → 点遮罩不误拦（基线=回填值）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '7', title: '原标题', url: '', desc: '原简介' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    maskEl().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull(); // 无改动直接关
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();
  });
});

describe('ESC 关闭（escManager bz-fav 层）', () => {
  it('开面板按 Escape → 面板关（无表单）', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(document.querySelector('.bz-fav-overlay')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-overlay')).toBeNull();
  });

  it('面板开着 + 添加表单开着 → ESC 先关表单（requestCloseForm）；表单有脏输入 → confirm', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const mainAdd = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-btn--primary')
    ) as HTMLElement;
    mainAdd.click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();

    // 空白表单：ESC 直接关表单，面板保留
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
    expect(document.querySelector('.bz-fav-overlay')).not.toBeNull();

    // 脏表单：ESC → confirm
    mainAdd.click();
    await tick(10);
    (document.querySelector('#fz-title') as HTMLInputElement).value = '草稿';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick(10);
    expect(document.getElementById('__shared_confirm_mask__')).not.toBeNull();
    expect(document.querySelector('.bz-fav-form')).not.toBeNull(); // 未关
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
    // 面板仍在，再 ESC 关面板
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-overlay')).toBeNull();
  });
});

describe('移动端搜索行与排序钮', () => {
  it('桌面：无移动图标组（bz-fav-mob-only 隐藏语义由 CSS）；移动：点 🔍 展开搜索行', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: 'x', url: '' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const row = document.querySelector('[data-fav-mobsearch-row]') as HTMLElement;
    // 默认无展开类
    expect(row.classList.contains('bz-fav-mobsearch-show')).toBe(false);
    // 移动端：点头部搜索图标钮 → 展开
    Platform.isMobile = true;
    const mobBtn = document.querySelector('[data-fav-mobsearch]') as HTMLElement;
    mobBtn.click();
    await tick(10);
    expect(row.classList.contains('bz-fav-mobsearch-show')).toBe(true);
    // 再点收起
    mobBtn.click();
    await tick(10);
    expect(row.classList.contains('bz-fav-mobsearch-show')).toBe(false);
  });

  it('移动排序钮（头行）循环切换并落盘', async () => {
    Platform.isMobile = true;
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: 'B', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: 'A', created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const mobSort = document.querySelector('[data-fav-sort].bz-fav-mob-only') as HTMLElement;
    mobSort.click();
    await tick(20);
    expect(cardTitles()).toEqual(['A', 'B']);
    expect(ctx.state.favoritesSortKey).toBe('title');
  });
});

// ==================== ticket 188 增强包回归 ====================

describe('已归档视图（ticket 188）', () => {
  it('点「已归档」入口：只显示归档条目 + 标题/计数/高亮切换；点「全部」返回', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '活条目', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '冷一条', archived: true }),
      seedItem({ id: '3', title: '冷二条', archived: true }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['活条目']);
    // 左栏已归档计数 = 2
    const side = [...document.querySelectorAll('[data-fav-tags] .bz-fav-side-item')] as HTMLElement[];
    expect(cntOf(side, '__archived')).toBe('2');
    clickTag('__archived');
    await tick(10);
    expect(cardTitles()).toEqual(['冷二条', '冷一条']); // created 倒序
    expect(document.querySelector('[data-fav-title]')!.textContent).toBe('已归档');
    expect(document.querySelector('[data-fav-count]')!.textContent).toBe('2 条已归档');
    // 渲染重建节点，重查左栏
    const side2 = [...document.querySelectorAll('[data-fav-tags] .bz-fav-side-item')] as HTMLElement[];
    expect(side2.find((b) => b.dataset.favTag === '__archived')!.classList.contains('bz-fav-nav-active')).toBe(true);
    // 回全部
    clickTag('__all');
    await tick(10);
    expect(cardTitles()).toEqual(['活条目']);
    expect(document.querySelector('[data-fav-title]')!.textContent).toBe('全部');
    expect(document.querySelector('[data-fav-count]')!.textContent).toBe('1 条收藏');
  });

  it('已归档视图动作翻转「取消归档」：点击直接恢复（无确认弹窗）+ unarchive 事件 + 卡片消失', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '冷存条目', archived: true })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickTag('__archived');
    await tick(10);
    clickCard(cards()[0]);
    await tick(10);
    expect(menuLabels()).toContain('取消归档');
    expect(menuLabels()).not.toContain('归档');
    clickAction('取消归档');
    await tick(30);
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.archived).toBe(false);
    // 已归档视图中恢复后卡片消失（数据回到主列表）
    expect(cards().length).toBe(0);
    expect(events.calls).toEqual([{ kind: 'unarchive', title: '冷存条目' }]);
    events.off();
    // 回全部可见
    clickTag('__all');
    await tick(10);
    expect(cardTitles()).toEqual(['冷存条目']);
  });

  it('搜索无结果 + 归档池有命中 → 空态提示「归档中有 N 条匹配」', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '活条目', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '深藏在归档的 DeepSeek 笔记', archived: true }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const input = document.querySelector('[data-fav-search]') as HTMLInputElement;
    input.value = 'DeepSeek';
    input.dispatchEvent(new Event('input'));
    await tick(250);
    const empty = document.querySelector('.bz-fav-content .bz-empty') as HTMLElement;
    expect(empty.querySelector('.bz-empty-desc')!.textContent).toContain('归档中有 1 条匹配');
    // 无归档命中 → 常规提示
    input.value = '不存在的词';
    input.dispatchEvent(new Event('input'));
    await tick(250);
    const empty2 = document.querySelector('.bz-fav-content .bz-empty') as HTMLElement;
    expect(empty2.querySelector('.bz-empty-desc')!.textContent).toBe('试试其他关键词，或清除搜索');
  });
});

describe('搜索覆盖 URL + 域名徽章（ticket 188）', () => {
  it('搜索命中 url（标题不含关键词）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '某好文', url: 'https://rustlang.org/learn', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '另一篇', url: 'https://example.com', created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const input = document.querySelector('[data-fav-search]') as HTMLInputElement;
    input.value = 'rustlang';
    input.dispatchEvent(new Event('input'));
    await tick(250);
    expect(cardTitles()).toEqual(['某好文']);
  });

  it('卡片 meta 行尾弱化域名徽章（去 www.）；无 url 无徽章', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '有链接', url: 'https://www.github.com/a/b', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '无链接', url: '', created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const withUrl = cards().find((c) => c.dataset.favId === '1')!;
    const badge = withUrl.querySelector('.bz-fav-host-badge') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('github.com');
    expect(badge.textContent).not.toContain('www.');
    const noUrl = cards().find((c) => c.dataset.favId === '2')!;
    expect(noUrl.querySelector('.bz-fav-host-badge')).toBeNull();
  });
});

describe('贴链自动搬家（ticket 188）', () => {
  function openAddForm() {
    const btn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-btn--primary')
    ) as HTMLElement;
    btn.click();
  }
  /** 构造带 clipboardData 的 paste 事件（jsdom 无 DataTransfer，手挂属性） */
  function pasteEvent(text: string): ClipboardEvent {
    const ev = new Event('paste', { bubbles: true, cancelable: true }) as any;
    ev.clipboardData = { getData: (t: string) => (t === 'text' ? text : '') };
    return ev as ClipboardEvent;
  }

  it('标题框粘贴 https URL → 搬入链接框（补协议）+ 回焦标题', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    const title = document.querySelector('#fz-title') as HTMLInputElement;
    const url = document.querySelector('#fz-url') as HTMLInputElement;
    title.dispatchEvent(pasteEvent('https://github.com/x/y'));
    await tick(10);
    expect(url.value).toBe('https://github.com/x/y');
    expect(document.activeElement).toBe(title);
  });

  it('www. 形态自动补 https://；非 URL 粘贴不搬家；链接框已有值不覆盖', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    const title = document.querySelector('#fz-title') as HTMLInputElement;
    const url = document.querySelector('#fz-url') as HTMLInputElement;
    // www. 形态
    title.dispatchEvent(pasteEvent('www.example.com/a'));
    await tick(10);
    expect(url.value).toBe('https://www.example.com/a');
    // 非 URL 粘贴：不搬家不拦截
    const plain = pasteEvent('一篇好文章');
    title.dispatchEvent(plain);
    await tick(10);
    expect(plain.defaultPrevented).toBe(false);
    // 链接框已有值：不覆盖
    url.value = 'https://keep.me';
    title.dispatchEvent(pasteEvent('https://github.com/new'));
    await tick(10);
    expect(url.value).toBe('https://keep.me');
    expect(document.activeElement).toBe(title);
  });
});

describe('表单防丢检查补全（ticket 188：标签/置顶/关联笔记）', () => {
  function openAddForm() {
    const btn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-btn--primary')
    ) as HTMLElement;
    btn.click();
  }
  const maskEl = () => document.querySelector('.bz-fav-form-mask') as HTMLElement;

  it('只点置顶钮（无文本输入）→ 点遮罩弹 confirm', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    (document.querySelector('#fz-pin') as HTMLElement).click();
    maskEl().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await tick(10);
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
    // 继续编辑 = __shared_confirm_ok__
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull(); // 继续编辑
  });

  it('只改标签选择 → 点取消弹 confirm；放弃后关闭', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    (document.querySelector('#fz-tags [data-tag="GitHub"]') as HTMLElement).click();
    (document.querySelector('[data-fz-cancel]') as HTMLElement).click();
    await tick(10);
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    // 放弃 = __shared_confirm_cancel__
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
  });

  it('只改关联笔记 → ESC 关表单弹 confirm', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    (document.querySelector('#fz-note') as HTMLInputElement).value = '我的/笔记.md';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick(10);
    expect(document.getElementById('__shared_confirm_popup__')).not.toBeNull();
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
  });

  it('编辑模式：关联笔记保持回填值不误拦（基线=回填值）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '7', title: '原标题', url: '', desc: '', linkedNote: '我的/笔记.md' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickCard(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    maskEl().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();
  });
});

describe('保存不被余额查询阻塞（ticket 188）', () => {
  function openAddForm() {
    const btn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-btn--primary')
    ) as HTMLElement;
    btn.click();
  }

  it('保存先落盘关表单：fetch 未决时 favorites.json 已有数据；resolve 后余额写回', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    (document.querySelector('#fz-title') as HTMLInputElement).value = 'LLM 收藏';
    (document.querySelector('#fz-tags [data-tag="大模型"]') as HTMLElement).click();
    (document.querySelector('#fz-keys') as HTMLTextAreaElement).value = 'sk-abc';
    (document.querySelector('#fz-balurl') as HTMLInputElement).value = 'https://api.example.com/balance';
    // 手动 deferred fetch：resolve 时机由测试控制
    let resolveFetch!: (v: any) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((res) => { resolveFetch = res; })));
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(30);
    // 落盘先行（余额查询仍挂起）：数据已在 favorites.json + 表单已关
    const saved = await ctx.dm.getAll();
    expect(saved.length).toBe(1);
    expect(saved[0].title).toBe('LLM 收藏');
    expect(saved[0].balance).toBeNull();
    expect(document.querySelector('.bz-fav-form')).toBeNull();
    expect(hasNotice('收藏已添加')).toBe(true);
    // fetch 放行 → 余额后台写回 + 列表刷新
    resolveFetch({ ok: true, json: async () => ({ balance: 77.7 }) });
    await tick(40);
    const after = (await ctx.dm.getAll())[0];
    expect(after.balance).toBe('77.7');
    expect(after.balanceError).toBeNull();
    expect(cards()[0].querySelector('.bz-fav-balance')!.textContent).toBe('77.7');
    vi.unstubAllGlobals();
  });

  it('后台余额查询失败：balanceError 写盘 + warning toast，不影响已保存数据', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    (document.querySelector('#fz-title') as HTMLInputElement).value = 'LLM 收藏';
    (document.querySelector('#fz-tags [data-tag="大模型"]') as HTMLElement).click();
    (document.querySelector('#fz-keys') as HTMLTextAreaElement).value = 'sk-abc';
    (document.querySelector('#fz-balurl') as HTMLInputElement).value = 'https://api.example.com/balance';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('网络不可达')));
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.title).toBe('LLM 收藏'); // 保存不受影响
    expect(saved.balance).toBeNull();
    expect(saved.balanceError).toBe('网络不可达');
    expect(hasNotice('余额查询失败')).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('关联笔记候选补全（ticket 188）', () => {
  function openAddForm() {
    const btn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-btn--primary')
    ) as HTMLElement;
    btn.click();
  }

  it('输入过滤 vault 笔记候选：点选回填；Escape 只收下拉不关表单；无匹配不弹层', async () => {
    const ctx = await setup();
    ctx.vault.files.set('我的/仓库/A 笔记.md', '# A');
    ctx.vault.files.set('我的/仓库/B 笔记.md', '# B');
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    const note = document.querySelector('#fz-note') as HTMLInputElement;
    note.value = 'A';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    const pop = document.querySelector('.bz-fav-notepop') as HTMLElement;
    expect(pop).not.toBeNull();
    const opts = [...pop.querySelectorAll('.bz-fav-noteopt')] as HTMLElement[];
    expect(opts.length).toBe(1);
    expect(opts[0].textContent).toBe('我的/仓库/A 笔记.md');
    // 点选回填 + 弹层收起（回焦/同值 input 不复弹自身——候选排除当前值）
    opts[0].click();
    expect(note.value).toBe('我的/仓库/A 笔记.md');
    note.dispatchEvent(new Event('focus', { bubbles: true }));
    note.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('.bz-fav-notepop')).toBeNull();
    // 再输关键词 → 候选重新拉起 → Escape 只收下拉（表单保留）
    note.value = 'A';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('.bz-fav-notepop')).not.toBeNull();
    note.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.querySelector('.bz-fav-notepop')).toBeNull();
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
    // 无匹配不弹层
    note.value = '不存在词';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('.bz-fav-notepop')).toBeNull();
  });
});
