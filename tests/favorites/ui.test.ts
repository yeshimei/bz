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
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { renderSettingsInto } from '../../src/core/settings-schema';
import { DataManager } from '../../src/favorites/data';
import { FavoritesAIService } from '../../src/favorites/ai';
import { closeItemMenu } from '../../src/core/item-actions';
import { onDomainEvent } from '../../src/core/domain-bus';
import {
  openPanel, openForm, closePanel, unloadFavoritesUI, favoritesSettingsSchema, initFavoritesUI,
} from '../../src/favorites/ui';
import { getTags } from '../../src/favorites/config';
import { hueOf } from '../../src/favorites/render';
import { MockVault } from '../mock-vault';
import {
  resetObsidianMocks, hasNotice, clearNotices, Platform, requestUrl,
} from '../mock-obsidian-entry';
import { formatRelativeTime } from '../../src/core/utils';

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {},
    workspace: { openLinkText: vi.fn() },
    openUrl: vi.fn(),
  } as any;
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 桌面：右键卡片 = 行浮层（.bz-item-menu）。issue 201 起点卡片不再弹菜单（bug 修复），菜单只走右键 */
function openCardMenu(card: HTMLElement): void {
  card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
}

/** 当前浮层动作项文案集合（桌面菜单 label / 移动抽屉 label） */
function menuLabels(): (string | null)[] {
  return [...document.querySelectorAll('.bz-item-menu button, .bz-item-sheet .bz-item-sheet-item')]
    .map((b) => { const sp = b.querySelectorAll('span'); return sp.length ? sp[sp.length - 1].textContent : null; });
}

/** 触屏按压（core/dom.longPress 手势）：touchstart → 停留 ms → touchend；越过 500ms 即长按。
 *  jsdom 不自动合成 click，故短按不会误走「点卡开抽屉」路径，断言只反映长按入口本身 */
async function touchPress(el: HTMLElement, ms: number): Promise<void> {
  const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
  Object.defineProperty(ts, 'touches', { value: [{ clientX: 10, clientY: 10 }] });
  el.dispatchEvent(ts);
  await tick(ms);
  el.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
}

/** 按文案点击浮层动作项 */
function clickAction(label: string): HTMLElement {
  const items = [...document.querySelectorAll('.bz-item-menu button, .bz-item-sheet .bz-item-sheet-item')] as HTMLElement[];
  const target = items.find((el) => {
    const sp = el.querySelectorAll('span');
    return sp.length > 0 && sp[sp.length - 1].textContent === label;
  });
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
  return [...document.querySelectorAll('.bz-fav-board .bz-fav-card')] as HTMLElement[];
}
function cardTitles(): (string | null)[] {
  return cards().map((c) => c.querySelector('h3')?.textContent ?? null);
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
    // arch-3（深审批 A）：死键 favoritesStoragePath / favoritesSortKey 不再播种——两键在 src
    // 全树零消费（ADR-0009 七路径收敛 / issue 364 退役），「退役不生效」语义由下方
    // 「设置 favoritesSortKey=title 不再生效」独立用例显式承载，setup 常驻播种反成噪音。
    aiProvider: 'opencode-go',
    opencodeGoApiKey: 'sk-test',
  };
  setSettingsProvider(() => state as any);
  // issue 334：isAvailable 判定单源 core getAIProvider——桥接同一份 state（活读）并重置 provider 缓存
  setAISettingsProvider(() => state as any);
  resetAIProviderCache();
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
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.bz-fav-board .bz-fav-empty')).not.toBeNull();
    expect(hasNotice('收藏数据读取失败，已显示为空列表')).toBe(true);
    consoleSpy.mockRestore();
  });

  it('openPanel 建 DOM：手写体标题「收藏本」+ 磁贴 12 张（全部+已归档+9 标签+新收藏）+ 空态文案；无壳头行（issue 219c）', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.bz-fav-panel')).not.toBeNull();
    // 壳头行彻底删除（issue 219c）：无品牌块/⚙/✕ 头行（桌面点遮罩/Esc 关，移动浮动 ✕）
    expect(overlay.querySelector('.bz-panel-head')).toBeNull();
    expect(overlay.querySelector('[data-fav-settings]')).toBeNull();
    // 头区：仅「收藏本」16px 标题（ADR-0101：副题删除）
    expect(overlay.querySelector('.bz-fav-head h1')!.textContent).toBe('收藏本');
    expect(overlay.querySelector('[data-fav-sub]')).toBeNull();
    // 磁贴行（空库）：全部 + 已归档 + 新收藏（零计数标签不显示，原型口径）
    const stickers = overlay.querySelectorAll('[data-fav-tags] button');
    expect(stickers.length).toBe(3);
    const labels = [...stickers].map((b) => (b as HTMLElement).dataset.favTag);
    expect(labels[0]).toBe('__all'); // UI-05/func-7：内置贴纸 data 值发哨兵（显示文本仍「全部」）
    expect(labels[1]).toBe('__archived');
    const addBtn = overlay.querySelector('[data-fav-add]') as HTMLElement;
    expect(addBtn).not.toBeNull();
    expect(addBtn.classList.contains('bz-fav-chip-add')).toBe(true);
    expect(addBtn.textContent).toContain('新收藏');
    // 空态（原型文案保留为 title；内芯收编 emptyHtmlStr 单源 = 图标+标题+引导，一致#16）
    const empty = overlay.querySelector('.bz-fav-board .bz-fav-empty') as HTMLElement;
    expect(empty).not.toBeNull();
    expect(empty.querySelector('.bz-empty')).not.toBeNull();
    expect(empty.querySelector('.bz-empty-title')!.textContent).toBe('这块板上还没有卡片');
    expect(empty.querySelector('.bz-empty-desc')!.textContent).toBe('添加第一条收藏试试');
    expect(empty.querySelector('.bz-empty-ic')).not.toBeNull();
    // 空库自动建文件
    expect(ctx.vault.files.has('CONFIG/STORAGE/favorites.json')).toBe(true);
    // 计数文案（C5 白卡口径）
  });

  it('再次 openPanel = toggle 关闭；closePanel 清 DOM', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(document.querySelector('.bz-panel-overlay')).not.toBeNull();
    openPanel(getApp(), ctx.dm, ctx.ai); // 开着再开 = 关
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
    openPanel(getApp(), ctx.dm, ctx.ai); // 再开
    await tick(20);
    expect(document.querySelector('.bz-panel-overlay')).not.toBeNull();
    closePanel();
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
  });

  it('unloadFavoritesUI 幂等：面板开 → 关 → 再调不抛', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    unloadFavoritesUI();
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
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

});

function overlayText(): string {
  return (document.querySelector('.bz-fav-board') as HTMLElement)?.textContent ?? '';
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
    const side = [...document.querySelectorAll('[data-fav-tags] button')] as HTMLElement[];
    expect(cntOf(side, '__all')).toBe('2');
    expect(cntOf(side, 'GitHub')).toBe('2');
    expect(cntOf(side, '网站')).toBe('1');
    expect(side.find((b) => b.dataset.favTag === '大模型')).toBeUndefined(); // 零计数标签不渲染（原型口径）
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

    clickTag('GitHub');
    await tick(10);
    expect(cards().length).toBe(1);
    expect(cardTitles()).toEqual(['Git 收藏']);
    // 标签高亮（副题已随 ADR-0101 删除）
    const side = [...document.querySelectorAll('[data-fav-tags] button')] as HTMLElement[];
    expect(side.find((b) => b.dataset.favTag === 'GitHub')!.classList.contains('bz-fav-on')).toBe(true);

    // 再点同标签 = 取消回全部
    clickTag('GitHub');
    await tick(10);
    expect(cards().length).toBe(2);
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
    // 卡片脚注竖排徽记=全部标签（displayTagsOf 随 1:1 照搬退役）
    const card = cards()[0];
    const badges = [...card.querySelectorAll('.bz-fav-tagb')].map((e) => e.textContent);
    expect(badges.join('|')).toContain('GitHub');
    clickTag('__all');
    await tick(10);
    expect(cards().length).toBe(1);
    const badges2 = [...cards()[0].querySelectorAll('.bz-fav-tagb')].map((e) => e.textContent);
    expect(badges2.join('|')).toContain('网站');
  });

  it('移动端（Platform.isMobile）：磁贴行同一容器同语义，点贴纸过滤、激活态同步', async () => {
    Platform.isMobile = true;
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: 'Git 收藏', tags: ['GitHub'] }),
      seedItem({ id: '2', title: 'Claude 收藏', tags: ['Claude'] }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    // 桌面/移动共用 [data-fav-tags] 磁贴行（CSS 切换换行/横滑）
    const stickers = [...document.querySelectorAll('[data-fav-tags] button')] as HTMLElement[];
    expect(stickers.length).toBe(5); // 全部+已归档+GitHub+Claude+新收藏
    const ghStk = stickers.find((b) => b.dataset.favTag === 'GitHub')!;
    ghStk.click();
    await tick(10);
    expect(cards().length).toBe(1);
    expect(cardTitles()).toEqual(['Git 收藏']);
    // 渲染重建节点，重查激活态
    const stickers2 = [...document.querySelectorAll('[data-fav-tags] button')] as HTMLElement[];
    expect(stickers2.find((b) => b.dataset.favTag === 'GitHub')!.classList.contains('bz-fav-on')).toBe(true);
  });

  it('磁贴结构（issue 219c）：分类贴纸 emoji 直出、全部/已归档纯文字、计数紧贴名后', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const side = [...document.querySelectorAll('[data-fav-tags] button')] as HTMLElement[];
    // 分类贴纸：emoji + 名字，无 lucide 图标
    // 空库只 3 张；GitHub 零计数不渲染（原型口径）
    expect(side.find((b) => b.dataset.favTag === 'GitHub')).toBeUndefined();
    const all = side.find((b) => b.dataset.favTag === '__all')!;
    expect(all.querySelector('.bz-ic')).toBeNull();
    expect(all.textContent).toContain('全部');
    const arch = side.find((b) => b.dataset.favTag === '__archived')!;
    expect(arch.classList.contains('bz-fav-chip--grey')).toBe(true);
    const add = side.find((b) => b.classList.contains('bz-fav-chip-add'))!;
    expect(add.textContent).toContain('新收藏');
  });

  it('归档条目不进任何标签计数', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '活', tags: ['网站'] }),
      seedItem({ id: '2', title: '冷', tags: ['网站'], archived: true }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const side = [...document.querySelectorAll('[data-fav-tags] button')] as HTMLElement[];
    expect(cntOf(side, '网站')).toBe('1');
    expect(cntOf(side, '__all')).toBe('1');
    expect(side.find((b) => b.dataset.favTag === 'GitHub')).toBeUndefined();
  });
});

function cntOf(btns: HTMLElement[], tag: string): string {
  const b = btns.find((x) => x.dataset.favTag === tag)!;
  const m = (b.textContent || '').match(/(\d+)\s*$/); return m ? m[1] : '';
}

function clickTag(label: string): void {
  const all = [...document.querySelectorAll('[data-fav-tags] button')] as HTMLElement[];
  const target = all.find((b) => (b.dataset.favTag) === label);
  if (!target) throw new Error('找不到标签：' + label);
  target.click();
}

// ==================== 3. 卡片渲染 ====================

describe('卡片渲染', () => {
  it('标题/简介/竖排标签徽记/相对时间脚注（原型 1:1；host/笔记徽记退役）', async () => {
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
    expect(card.querySelector('h3')!.textContent).toBe('项目 A');
    expect(card.querySelector('p')!.textContent).toBe('简介文字');
    // 脚注（原型 1:1）：竖排标签徽记（emoji+名）+ 相对时间行；host/笔记徽记已退役
    const tagbs = [...card.querySelectorAll('.bz-fav-tagb')].map((e) => e.textContent);
    expect(tagbs.length).toBe(2);
    expect(tagbs[0]).toContain('GitHub');
    expect(tagbs[1]).toContain('Claude');
    expect(card.querySelector('.bz-fav-ft')!.textContent).not.toContain('工具库');
    expect(card.querySelector('.bz-fav-host-badge')).toBeNull();
    expect(card.querySelector('.bz-fav-ft')!.textContent).toMatch(/天前|刚刚|分钟前|小时前|\d{1,2}-\d{2}/);
  });


  it('置顶卡：bz-fav-pinc 类；meta 不再有「置顶 · 」文字前缀（视觉走左缘品牌条）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '置顶项', pinned: true, created: '2025-06-01 08:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const card = cards()[0];
    expect(card.classList.contains('bz-fav-pinc')).toBe(true);
    expect(card.querySelector('.bz-fav-ft')!.textContent).not.toContain('置顶');
  });

  it('无简介不渲染 desc 行（link 类随 1:1 照搬退役）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '纯文本', desc: '', url: '' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const card = cards()[0];
    // 原型 1:1：无简介渲染占位文案「（这张卡只写了个名字）」
    expect(card.querySelector('p')!.textContent).toBe('（这张卡只写了个名字）');
  });

  it('多标签卡片徽章齐全', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '三标签', tags: ['GitHub', '大模型', '酒馆'] }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const badges = [...cards()[0].querySelectorAll('.bz-fav-tagb')].map((e) => e.textContent);
    expect(badges.length).toBe(3);
    expect(badges[0]).toContain('GitHub');
    expect(badges[1]).toContain('大模型');
    expect(badges[2]).toContain('酒馆');
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

// ==================== 4. 排序（issue 219b：固定「最新收藏」，置顶恒前；搜索/排序工具随原型化退役） ====================

describe('排序（固定最新收藏）', () => {
  it('默认 created 倒序（最新在前），无排序 UI 入口', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '旧条目', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '新条目', created: '2025-01-03 00:00:00' }),
      seedItem({ id: '3', title: '中条目', created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['新条目', '中条目', '旧条目']);
    // 工具行退役：无排序浮岛、无搜索框
    expect(document.querySelector('[data-fav-sort]')).toBeNull();
    expect(document.querySelector('[data-fav-search]')).toBeNull();
    expect(document.querySelector('.bz-toolrow')).toBeNull();
  });

  it('设置 favoritesSortKey=title 不再生效（键退役保留兼容）', async () => {
    const ctx = await setup();
    ctx.state.favoritesSortKey = 'title';
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: 'Z', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: 'A', created: '2025-01-03 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['A', 'Z']); // 仍按最新收藏
  });

  it('置顶恒最前（组内按 created 倒序）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '顶顶', pinned: true, created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: 'AAA', created: '2025-01-03 00:00:00' }),
      seedItem({ id: '3', title: '顶二', pinned: true, created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['顶二', '顶顶', 'AAA']);
  });
});

// ==================== 4b. 打开默认筛选 + 默认排序（issue 296） ====================

/** 磁贴行当前高亮贴纸的 data-fav-tag 值集合（bz-fav-on；文案带计数，断言取键不取文本） */
function activeChipKeys(): string[] {
  return [...document.querySelectorAll('[data-fav-tags] [data-fav-tag].bz-fav-on')]
    .map((el) => (el as HTMLElement).dataset.favTag || '');
}

describe('打开默认筛选（issue 296）', () => {
  const TWO = [
    seedItem({ id: '1', title: 'GH', tags: ['GitHub'], created: '2025-01-02 00:00:00' }),
    seedItem({ id: '2', title: '站', tags: ['网站'], created: '2025-01-01 00:00:00' }),
  ];

  it("缺省 ''=全部：磁贴「全部」高亮，不筛选（原行为）", async () => {
    const ctx = await setup();
    seedVault(ctx.vault, TWO);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['GH', '站']);
    expect(activeChipKeys()).toContain('__all');
  });

  it("'@last'：筛选 GitHub → 关面板写回 favoritesLastFilter → 重开仍在 GitHub", async () => {
    const ctx = await setup();
    ctx.state.favoritesOpenFilter = '@last';
    seedVault(ctx.vault, TWO);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    (document.querySelector('[data-fav-tags] [data-fav-tag="GitHub"]') as HTMLElement).click();
    expect(cardTitles()).toEqual(['GH']);
    closePanel();
    expect(ctx.state.favoritesLastFilter).toBe('GitHub');
    expect(ctx.saveCount()).toBeGreaterThan(0);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['GH']);
    expect(activeChipKeys()).toContain('GitHub');
  });

  it("'@last' 且上次为已归档视图：重开直接进归档视图；关面板记忆保持", async () => {
    const ctx = await setup();
    ctx.state.favoritesOpenFilter = '@last';
    ctx.state.favoritesLastFilter = '@archived';
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '活的', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '存档', created: '2025-01-02 00:00:00', archived: true }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['存档']);
    closePanel();
    expect(ctx.state.favoritesLastFilter).toBe('@archived');
  });

  it("固定标签='网站'：每次打开直选该标签，记忆不覆盖", async () => {
    const ctx = await setup();
    ctx.state.favoritesOpenFilter = '网站';
    seedVault(ctx.vault, TWO);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['站']);
    expect(activeChipKeys()).toContain('网站');
    // 固定标签模式：关面板写记忆只是记录当下，重开仍以设置为准
    closePanel();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['站']);
  });

  it('非法值回落全部：标签不在九类 / 未知枚举', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, TWO);
    ctx.state.favoritesOpenFilter = '不存在的标签';
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['GH', '站']);
    closePanel();
    ctx.state.favoritesOpenFilter = '@weird';
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['GH', '站']);
  });
});

describe('默认排序（issue 296）', () => {
  const FOUR = [
    seedItem({ id: '1', title: '新A', created: '2025-01-03 00:00:00' }),
    seedItem({ id: '2', title: '旧B', created: '2025-01-01 00:00:00' }),
    seedItem({ id: '3', title: '中C', created: '2025-01-02 00:00:00' }),
    seedItem({ id: '4', title: '顶D', pinned: true, created: '2025-01-01 12:00:00' }),
  ];

  it('old=最早收藏在前，置顶仍恒最前', async () => {
    const ctx = await setup();
    ctx.state.favoritesDefaultSort = 'old';
    seedVault(ctx.vault, FOUR);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['顶D', '旧B', '中C', '新A']);
  });

  it('title=按标题升序，置顶恒最前（纯拉丁标题——各 collation 无歧义）', async () => {
    const ctx = await setup();
    ctx.state.favoritesDefaultSort = 'title';
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: 'Banana', created: '2025-01-03 00:00:00' }),
      seedItem({ id: '2', title: 'Apple', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '3', title: 'Cherry', created: '2025-01-02 00:00:00' }),
      seedItem({ id: '4', title: '顶D', pinned: true, created: '2025-01-01 12:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['顶D', 'Apple', 'Banana', 'Cherry']);
  });

  it('非法值回落最新收藏（缺省行为不变）', async () => {
    const ctx = await setup();
    ctx.state.favoritesDefaultSort = 'weird';
    seedVault(ctx.vault, FOUR);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['顶D', '新A', '中C', '旧B']);
  });
});

// ==================== 6. 行动作（桌面右键 → .bz-item-menu；点卡不弹菜单 bug 修复） ====================

describe('桌面行动作浮层', () => {
  it('桌面点卡片不导航不弹菜单（2026-09-23 拍板：点卡不再跳网站，开链/复制网址走右键）；菜单只走右键', async () => {
    const ctx = await setup();
    const app = getApp() as any;
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '有链收藏', url: 'https://github.com/a/b' }),
      seedItem({ id: '2', title: '无链收藏', url: '' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    // 点有链卡片 → 不开浏览器、不弹菜单（2026-09-23 拍板：点卡不再跳网站，开链/复制网址走右键菜单）
    cards().find((c) => c.querySelector('h3')!.textContent === '有链收藏')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(10);
    expect(app.openUrl).not.toHaveBeenCalled();
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    // 点无链卡片 → 同样不动作、不弹菜单
    cards().find((c) => c.querySelector('h3')!.textContent === '无链收藏')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(10);
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    // 右键仍弹菜单（2026-09-11 收编 core .bz-item-menu：不携域皮肤变量，统一观感）
    openCardMenu(cards()[0]);
    await tick(10);
    const menuEl = document.querySelector('.bz-item-menu');
    expect(menuEl).not.toBeNull();
    expect(menuEl!.classList.contains('bz-fav-scope')).toBe(false);
    document.querySelector('.bz-item-menu')?.remove();
  });

  it('右键卡片弹 .bz-item-menu；动作文案集合按数据条件（无 url 无 note：置顶/编辑/归档/删除）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '无链接收藏', url: '', desc: 'x' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openCardMenu(cards()[0]);
    await tick(10);
    const menu = document.querySelector('.bz-item-menu');
    expect(menu).not.toBeNull();
    expect(menuLabels()).toEqual(['置顶', '编辑', '归档', '删除']);
    // 删除项 danger 类
    const delItem = [...menu!.querySelectorAll('button')].find((i) => i.textContent?.includes('删除'));
    expect(delItem!.classList.contains('bz-item-menu-item--danger')).toBe(true);
    document.querySelector('.bz-item-menu')?.remove();
  });

  it('右键（contextmenu 事件）同样触发浮层', async () => {
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
    const byTitle = (t: string) => cards().find((c) => c.querySelector('h3')!.textContent === t)!;
    openCardMenu(byTitle('我的项目'));
    await tick(10);
    expect(menuLabels()[0]).toBe('打开');
    clickAction('打开');
    await tick(10);
    expect(app.openUrl).toHaveBeenCalledWith('https://github.com/a/b');
    expect(document.querySelector('.bz-item-menu')).toBeNull(); // 非 keepOpen 动作浮层收起

    openCardMenu(byTitle('无协议'));
    await tick(10);
    clickAction('打开');
    await tick(10);
    expect(app.openUrl).toHaveBeenCalledWith('https://github.com/x/y'); // 补协议头
  });

  it('app.openUrl 缺失 → 调用抛错落 catch 走 electron shell 兜底（F9：去掉 ?. 短路；点卡退役后入口=右键「打开」）', async () => {
    const ctx = await setup();
    const app = getApp() as any;
    delete app.openUrl; // 宿主未提供 openUrl：?. 写法会静默 no-op，兜底永不触发
    const shellSpy = vi.fn();
    (window as any).require = () => ({ shell: { openExternal: shellSpy } });
    try {
      seedVault(ctx.vault, [seedItem({ id: '1', title: '有链收藏', url: 'https://github.com/a/b' })]);
      openPanel(getApp(), ctx.dm, ctx.ai);
      await tick(20);
      openCardMenu(cards()[0]);
      await tick(10);
      clickAction('打开');
      await tick(10);
      expect(shellSpy).toHaveBeenCalledWith('https://github.com/a/b');
    } finally {
      delete (window as any).require;
    }
  });

  it('有 url：动作含「复制网址」紧跟「打开」；无 url 不含（点卡退役后复制入口只在右键，2026-09-23 拍板）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '有链收藏', url: 'github.com/a/b', desc: 'x' }),
      seedItem({ id: '2', title: '无链收藏', url: '', desc: 'x' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const byTitle = (t: string) => cards().find((c) => c.querySelector('h3')!.textContent === t)!;
    openCardMenu(byTitle('有链收藏'));
    await tick(10);
    expect(menuLabels().slice(0, 2)).toEqual(['打开', '复制网址']);
    document.querySelector('.bz-item-menu')?.remove();
    openCardMenu(byTitle('无链收藏'));
    await tick(10);
    expect(menuLabels()).not.toContain('复制网址');
    document.querySelector('.bz-item-menu')?.remove();
  });

  it('点「复制网址」→ clipboard.writeText 收到 normalizeUrl(url)，成功弹「网址已复制」且不开浏览器', async () => {
    const ctx = await setup();
    const app = getApp() as any;
    seedVault(ctx.vault, [seedItem({ id: '1', title: '有链收藏', url: 'github.com/a/b' })]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      openPanel(getApp(), ctx.dm, ctx.ai);
      await tick(20);
      openCardMenu(cards()[0]);
      await tick(10);
      clickAction('复制网址');
      await tick(10);
      expect(writeText).toHaveBeenCalledWith('https://github.com/a/b'); // 补协议头
      expect(app.openUrl).not.toHaveBeenCalled(); // 复制是无副作用替代：不开链
      expect(hasNotice('网址已复制')).toBe(true);
    } finally {
      clearNotices();
      delete (navigator as any).clipboard;
    }
  });

  it('复制网址失败（clipboard 拒绝写入）→ 弹「无法复制网址」', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '有链收藏', url: 'https://github.com/a/b' })]);
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      openPanel(getApp(), ctx.dm, ctx.ai);
      await tick(20);
      openCardMenu(cards()[0]);
      await tick(10);
      clickAction('复制网址');
      await tick(10);
      expect(writeText).toHaveBeenCalledWith('https://github.com/a/b');
      expect(hasNotice('无法复制网址')).toBe(true);
    } finally {
      clearNotices();
      delete (navigator as any).clipboard;
    }
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
    openCardMenu(cards()[0]); // 甲（未置顶）
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
    expect(cards()[0].classList.contains('bz-fav-pinc')).toBe(true);
    // 重开浮层：动作翻转为「取消置顶」
    openCardMenu(cards()[0]);
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
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('置顶');
    await tick(30);
    expect(hasNotice('保存失败（置顶收藏）：磁盘只读')).toBe(true);
    expect((await ctx.dm.getAll())[0].pinned).toBe(false); // 数据未变
  });

  it('归档免确认直达（E1/C2 效率整改 5）：点归档 → 冷存 + 卡片消失 + 事件 archive + 撤销 toast', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '归档项', url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('归档');
    await tick(30);
    // 非 keepOpen：浮层收起；确认框退役——撤销 toast 兜底直达（与 unarchive 同域一制）
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    const saved = (await ctx.dm.getAll())[0];
    expect(saved.archived).toBe(true);
    expect(saved.archivedAt).toBeTruthy();
    // 卡片消失；归档带撤销 toast（ticket 188：文案带标题）
    expect(cards().length).toBe(0);
    expect(overlayText()).toContain('这块板上还没有卡片'); // 原型空态文案（ADR-0101）
    expect(hasNotice('已归档收藏「归档项」')).toBe(true);
    expect([...document.querySelectorAll('.bz-notice-action')].some((b) => b.textContent === '撤销')).toBe(true);
    // 事件载荷不变
    expect(events.calls).toEqual([{ kind: 'archive', title: '归档项' }]);
    events.off();
  });

  it('归档撤销：点撤销 → archived 回 false + 卡片回主列表 + unarchive 事件（ticket 188）', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '归档项', url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('归档');
    await tick(30); // 免确认直达
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

  it('免确认同域一制（E1/C2）：归档/取消归档/删除三动作均无确认框直达', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '直达项', url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    // 归档直达（归档/删除确认框退役；域内在位确认框仅「删除标签」+「放弃草稿」）
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('归档');
    await tick(30);
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    expect((await ctx.dm.getAll())[0].archived).toBe(true);
    // 取消归档（本就免确认——两制理顺后三动作一制）
    clickTag('__archived');
    await tick(10);
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('取消归档');
    await tick(30);
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    expect((await ctx.dm.getAll())[0].archived).toBe(false);
    // 删除直达
    clickTag('__all');
    await tick(10);
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('删除');
    await tick(30);
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    expect((await ctx.dm.getAll()).length).toBe(0);
  });

  it('删除免确认直达：卡片消失 + 撤销 toast + 事件 delete；点撤销 → restoreItem 原样 + restored 事件（func-2）+ 卡片回', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '9', title: '被删条目', pinned: true, desc: 'x', created: '2025-06-01 08:00:00' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('删除');
    await tick(30);
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull(); // 免确认直达
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
    // func-2：删除撤销补发 restored 事件（与归档撤销补 unarchive 同制）——行为流不再停在「已删」
    expect(events.calls).toEqual([
      { kind: 'delete', title: '被删条目' },
      { kind: 'restored', title: '被删条目' },
    ]);
    events.off();
  });

  it('issue 291：在位确认框收敛两框（放弃草稿 + 删除标签）仍带本域皮肤类；归档/删除确认随免确认直达退役（E1/C2）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '同皮项', url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const confirm = () => document.getElementById('__shared_confirm_popup__') as HTMLElement;

    // 1) 放弃未保存草稿确认（confirmDiscard 第三参透传）：点表单遮罩触发脏拦截
    const addBtn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-fav-chip-add')
    ) as HTMLElement;
    addBtn.click();
    await tick(10);
    (document.querySelector('#fz-title') as HTMLInputElement).value = '脏草稿';
    (document.querySelector('.bz-overlay-mask') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull(); // 表单仍在（拦截未直接关）
    expect(confirm().classList.contains('bz-overlay-popup')).toBe(true);
    expect(confirm().classList.contains('bz-fav-flow-dialog')).toBe(true);
    expect(confirm().classList.contains('bz-fav-scope')).toBe(true);
    expect(confirm().querySelector('h4')!.textContent).toBe('放弃未保存的内容？');
    // 注意 confirmDiscard 的按钮序与常规确认相反：取消钮 id = 「放弃」，确认钮 id = 「继续编辑」
    // （安全焦点落在继续编辑，回车不丢草稿）——与既有「有输入点遮罩」用例同口径
    expect((document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).textContent).toBe('放弃');
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click(); // 放弃
    await tick(20);
    expect(document.querySelector('.bz-fav-form')).toBeNull();

    // 2) 删除标签确认（域内在位的唯一主动作确认框：bulk 迁移有跨条目副作用，保留确认）——
    //    归档/删除收藏确认随免确认直达退役（原归档/删除段删除，防回潮断言见 flow-dialog-skin.test.ts）
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    const row = [...document.querySelectorAll('.bz-fav-tagmgr-row')][0] as HTMLElement;
    (row.querySelector('[title="删除"]') as HTMLElement).click();
    await tick(20);
    expect(confirm().classList.contains('bz-fav-flow-dialog')).toBe(true);
    expect(confirm().classList.contains('bz-fav-scope')).toBe(true);
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await tick(10);
  });

  it('删除写盘失败 → notifySaveError，不弹撤销 toast，数据仍在', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '删不掉', url: '', desc: 'x' })]);
    vi.spyOn(ctx.dm, 'delete').mockRejectedValue(new Error('磁盘只读'));
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('删除');
    await tick(30); // 免确认直达，写盘失败在 notifySaveError 兜底
    expect(hasNotice('保存失败（删除收藏）：磁盘只读')).toBe(true);
    expect([...document.querySelectorAll('.bz-notice-action')].some((b) => b.textContent === '撤销')).toBe(false);
    expect((await ctx.dm.getAll()).length).toBe(1);
  });
});

// ==================== 7. 添加表单 ====================

describe('添加表单', () => {

  function openAddViaMainBtn(): void {
    // issue 219c：添加入口 = 磁贴行尾「＋ 新收藏」贴纸（bz-fav-chip-add）
    const btn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-fav-chip-add')
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
      err: form.querySelector('#fz-err') as HTMLElement,
      save: form.querySelector('#fz-save') as HTMLButtonElement,
      pin: form.querySelector('#fz-pin') as HTMLElement,
      tagBtns: [...form.querySelectorAll('#fz-tags [data-tag]')] as HTMLElement[],
      aiBtn: form.querySelector('#fz-ai') as HTMLButtonElement,
      cancel: form.querySelector('[data-fz-cancel]') as HTMLButtonElement,
      titleEl: form.querySelector('h2') as HTMLElement,
    };
  }
  const clickTagBtn = (els: ReturnType<typeof formEls>, label: string) => {
    const b = els.tagBtns.find((x) => x.dataset.tag === label)!;
    b.click();
    return b;
  };

  it('主按钮弹表单；标题「添加收藏」+ 保存钮「添加」（一致#9：新建=添加）+ 9 个标签钮', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    expect(document.querySelector('.bz-overlay-mask')).not.toBeNull();
    expect(els.titleEl.textContent).toBe('添加收藏');
    expect(els.save.textContent).toBe('添加');
    expect(els.tagBtns.length).toBe(9);
  });

  it('校验链：空标题 → 请输入标题；手输无协议 url 自动补 https://（E6 写侧）+ 无标签 → 请至少选择一个标签', async () => {
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
    // E6 写侧半：saveForm 先 normalizeUrl 归一（无协议自动补），不再被校验拦截——只剩缺标签错
    expect(els.err.textContent).toBe('请至少选择一个标签');
    // 库未写入
    expect((await ctx.dm.getAll()).length).toBe(0);

    // 补协议落盘：选标签保存后 url 带 https://（与贴链/读侧同待遇）
    clickTagBtn(els, 'GitHub');
    els.save.click();
    await tick(40);
    expect((await ctx.dm.getAll())[0].url).toBe('https://github.com/no-protocol');
  });


  it('填全保存：dm.add 落盘 13 字段 + 卡片出现 + 表单关 + 事件 add(item)', async () => {
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
    expect(els.pin.classList.contains('bz-fav-on')).toBe(true);
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


  it('AI 不可用 → 点 AI 整理只 notice，不调用 ai.chat', async () => {
    const ctx = await setup();
    ctx.state.opencodeGoApiKey = ''; // 清掉 key → isAvailable false
    resetAIProviderCache();
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
    const onTags = [...document.querySelectorAll('#fz-tags [data-tag].bz-fav-on')].map((b) => (b as HTMLElement).dataset.tag);
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
    const onTags = [...document.querySelectorAll('#fz-tags [data-tag].bz-fav-on')].map((b) => (b as HTMLElement).dataset.tag);
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
  it('菜单「编辑」→ 表单回填（title/url/desc/tags/pin）+ 标题「编辑收藏」+ 保存钮「保存」（一致#9：编辑=保存）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({
        id: '7', title: '原标题', desc: '原简介', url: 'https://github.com/a/b', pinned: true,
        tags: ['GitHub', '网站'], linkedNote: '我的/笔记.md',
      }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    const form = document.querySelector('.bz-fav-form') as HTMLElement;
    expect(form).not.toBeNull();
    expect(form.querySelector('h2')!.textContent).toBe('编辑收藏');
    expect((form.querySelector('#fz-save') as HTMLButtonElement).textContent).toBe('保存');
    expect((form.querySelector('#fz-title') as HTMLInputElement).value).toBe('原标题');
    expect((form.querySelector('#fz-url') as HTMLInputElement).value).toBe('https://github.com/a/b');
    expect((form.querySelector('#fz-desc') as HTMLTextAreaElement).value).toBe('原简介');
    // 关联笔记字段随 ADR-0101 退役：表单无 #fz-note
    expect(form.querySelector('#fz-note')).toBeNull();
    // 标签回填选中
    const onTags = [...form.querySelectorAll('#fz-tags [data-tag].bz-fav-on')].map((b) => (b as HTMLElement).dataset.tag);
    expect(onTags).toEqual(['GitHub', '网站']);
    // 置顶滑钮 on
    expect(form.querySelector('#fz-pin')!.classList.contains('bz-fav-on')).toBe(true);
    // 大模型配置区随 ADR-0101 退役
    expect(form.querySelector('#fz-llm')).toBeNull();
    expect(form.querySelector('#fz-keys')).toBeNull();
  });


  it('改标题保存 → dm.update + 事件 edit changes=["改了标题"] + created 保留', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [
      seedItem({ id: '7', title: '原标题', desc: '原简介', url: 'https://github.com/a/b', tags: ['GitHub', '网站'], created: '2025-06-01 08:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openCardMenu(cards()[0]);
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
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    expect(events.calls).toEqual([{ kind: 'edit', title: '原标题', changes: [] }]);
    events.off();
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
      (b) => (b as HTMLElement).classList.contains('bz-fav-chip-add')
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
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('置顶');
    await tick(30);
    expect(events.calls.length).toBe(0);
    closeItemMenu();
    await tick(10);
    // 表单编辑：发 edit
    openCardMenu(cards()[0]);
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

  it('archive / delete：免确认直达后事件载荷（title 型）不变', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '归档目标', url: '', desc: 'x' }),
      seedItem({ id: '2', title: '删除目标', url: '', desc: 'x', created: '2025-06-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const byTitle = (t: string) => cards().find((c) => c.querySelector('h3')!.textContent === t)!;
    openCardMenu(byTitle('归档目标'));
    await tick(10);
    clickAction('归档');
    await tick(30); // 免确认直达
    expect(events.calls).toEqual([{ kind: 'archive', title: '归档目标' }]);
    events.calls.length = 0;

    openCardMenu(byTitle('删除目标'));
    await tick(10);
    clickAction('删除');
    await tick(30); // 免确认直达
    expect(events.calls).toEqual([{ kind: 'delete', title: '删除目标' }]);
    events.off();
  });
});

// ==================== 13. 设置 schema ====================


// ==================== 14. 移动抽屉 ====================

describe('移动端抽屉', () => {
  it('Platform.isMobile → 点卡弹 .bz-item-sheet（磁点头 + 动作项），点编辑收抽屉开表单', async () => {
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
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    // 头部（原型 1:1）：磁点 + 标题 + meta（相对时间）
    expect(document.querySelector('.bz-fav-sh-title')!.textContent).toBe('抽屉条目');
    expect(document.querySelector('.bz-fav-sh-dot')).not.toBeNull();
    expect(document.querySelector('.bz-fav-sh-meta')!.textContent).not.toBe('');
    // 动作列：打开（无 url 不出现）/置顶/编辑/归档/删除；删除红字（ADR-0101 跳转笔记退役）
    const labels = [...document.querySelectorAll('.bz-item-sheet .bz-item-sheet-item')].map((b) => b.textContent);
    expect(labels.join('|')).not.toContain('跳转笔记');
    // 删除为危险项
    const del = [...document.querySelectorAll('.bz-item-sheet .bz-item-sheet-item')].find((i) => i.textContent?.includes('删除'));
    expect(del!.classList.contains('bz-item-sheet-item--danger')).toBe(true);

    // 编辑：抽屉先收起 + 表单叠上（companion 防误关，ADR-0101 口径：动作前 closeSheet）
    clickAction('编辑');
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
    // 保存后抽屉不复活
    (document.querySelector('#fz-title') as HTMLInputElement).value = '改后';
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    expect((await ctx.dm.getAll())[0].title).toBe('改后');
  });

  it('移动抽屉：点遮罩关闭抽屉（core 外点关闭；先越过 400ms 触屏残余 click 静置窗口）', async () => {
    Platform.isMobile = true;
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: 'x', url: '', desc: 'y' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    cards()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(450); // 越过触屏残余 click 静置窗口，后续点击才不被吞
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    const mask = document.querySelector('.bz-item-sheet-mask') as HTMLElement;
    expect(mask).not.toBeNull();
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(10);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
  });

  it('长按卡片 → 弹抽屉（统一手势 core/dom.longPress）：桌面长按不弹、移动端短按不弹、移动端长按弹', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '长按条目', url: '', desc: 'y' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    // 桌面（Platform.isMobile=false）：手势过滤不放行
    await touchPress(cards()[0], 550);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    // 移动端短按（未到 500ms）：不弹
    Platform.isMobile = true;
    await touchPress(cards()[0], 100);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    // 移动端长按：弹抽屉，头部标题正确（与点卡入口同一 openMobSheet）
    await touchPress(cards()[0], 550);
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    expect(document.querySelector('.bz-fav-sh-title')!.textContent).toBe('长按条目');
  });
});

// ==================== 脏表单拦截 + ESC ====================

describe('脏表单拦截', () => {
  function openAddForm(): void {
    const btn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-fav-chip-add')
    ) as HTMLElement;
    btn.click();
  }
  const maskEl = () => document.querySelector('.bz-overlay-mask') as HTMLElement;

  it('空白表单点遮罩直接关，无 confirm', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    maskEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
    maskEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
    maskEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    maskEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull(); // 无改动直接关
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();
  });

  it('编辑含 TAGS 外标签条目：未改动直接关不误判脏（F10：基线与 DOM chip 同口径过滤）；保存仍保留未知标签', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '7', title: '带野标签', tags: ['GitHub', '未收录标签'], url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    // 基线只计入九类 chip（GitHub），与 formTagsNow 同口径 → 未改动不算脏
    maskEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();

    // 保存侧口径不变：sel=new Set(it.tags) 保留未知标签
    openCardMenu(cards()[0]);
    await tick(10);
    clickAction('编辑');
    await tick(10);
    (document.querySelector('#fz-save') as HTMLButtonElement).click();
    await tick(40);
    expect((await ctx.dm.getAll())[0].tags).toEqual(['GitHub', '未收录标签']);
  });
});

describe('ESC 关闭（escManager bz-fav 层）', () => {
  it('开面板按 Escape → 面板关（无表单）', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(document.querySelector('.bz-panel-overlay')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick(10);
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
  });

  it('面板开着 + 添加表单开着 → ESC 先关表单（requestCloseForm）；表单有脏输入 → confirm', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const mainAdd = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-fav-chip-add')
    ) as HTMLElement;
    mainAdd.click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();

    // 空白表单：ESC 直接关表单，面板保留
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
    expect(document.querySelector('.bz-panel-overlay')).not.toBeNull();

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
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
  });

  it('命令直开表单（面板从未开过）→ ESC 走 requestCloseForm 能关（F2：ESC 层随表单注册）', async () => {
    const ctx = await setup();
    // 模拟 app.ts openAdd 命令路径：initFavoritesUI 后直接 openForm，openPanel 从未执行
    initFavoritesUI(getApp(), ctx.dm, ctx.ai);
    openForm(null);
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
    // 空白表单：ESC 直接关
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();

    // 脏表单：ESC → confirmDiscard 拦截（完整 requestCloseForm 路径）
    openForm(null);
    await tick(10);
    (document.querySelector('#fz-title') as HTMLInputElement).value = '命令路径草稿';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick(10);
    expect(document.getElementById('__shared_confirm_mask__')).not.toBeNull();
    expect(document.querySelector('.bz-fav-form')).not.toBeNull();
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await tick(10);
    expect(document.querySelector('.bz-fav-form')).toBeNull();
  });

  it('移动抽屉 ESC → closeSheet 遮罩整元素移除（F11：不再只摘 show 类残留 DOM）', async () => {
    Platform.isMobile = true;
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '抽屉项', url: '', desc: 'x' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    cards()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(450); // 越过触屏残余 click 静置窗口（400ms）
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await tick(10);
    // 遮罩元素（连同其监听）整体移除，而非仅摘 bz-fav-show 类
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    // 层序：抽屉关后主面板仍在
    expect(document.querySelector('.bz-panel-overlay')).not.toBeNull();
  });
});

describe('移动端头部（issue 219c：浮动 ✕ 退出；添加走磁贴行尾贴纸）', () => {
  it('桌面与移动：无搜索/排序钮；移动浮动 ✕ 显示可关；添加贴纸桌面/移动同在', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [seedItem({ id: '1', title: 'x', url: '' })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(document.querySelector('[data-fav-mobsearch-row]')).toBeNull();
    expect(document.querySelector('[data-fav-mobsort]')).toBeNull();
    // 桌面关面板 → 切移动 → 重开（openPanel 开着再点 = toggle 关）
    closePanel();
    Platform.isMobile = true;
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(document.querySelector('[data-fav-mobsort]')).toBeNull();
    const mobClose = document.querySelector('.bz-fav-mob-close');
    expect(mobClose).not.toBeNull();
    (mobClose as HTMLElement).click();
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
    // 添加入口 = 磁贴行尾贴纸（移动也在）
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(document.querySelector('[data-fav-tags] .bz-fav-chip-add')).not.toBeNull();
  });
});

// ==================== ticket 188 增强包回归 ====================

describe('已归档视图（ticket 188）', () => {
  it('点「已归档」贴纸：只显示归档条目 + 标题/计数/高亮切换；点「全部」返回', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '活条目', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '冷一条', archived: true }),
      seedItem({ id: '3', title: '冷二条', archived: true }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cardTitles()).toEqual(['活条目']);
    // 已归档贴纸计数 = 2
    const side = [...document.querySelectorAll('[data-fav-tags] button')] as HTMLElement[];
    expect(cntOf(side, '__archived')).toBe('2');
    clickTag('__archived');
    await tick(10);
    expect(cardTitles()).toEqual(['冷二条', '冷一条']); // created 倒序
    // 渲染重建节点，重查磁贴行
    const side2 = [...document.querySelectorAll('[data-fav-tags] button')] as HTMLElement[];
    expect(side2.find((b) => b.dataset.favTag === '__archived')!.classList.contains('bz-fav-on')).toBe(true);
    // 回全部
    clickTag('__all');
    await tick(10);
    expect(cardTitles()).toEqual(['活条目']);
  });

  it('已归档视图动作翻转「取消归档」：点击直接恢复（无确认弹窗）+ unarchive 事件 + 卡片消失', async () => {
    const ctx = await setup();
    const events = eventCollector();
    seedVault(ctx.vault, [seedItem({ id: '1', title: '冷存条目', archived: true })]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    clickTag('__archived');
    await tick(10);
    openCardMenu(cards()[0]);
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
});

describe('域名徽章退役 + 搜索退役（ticket 188 / issue 201 / 219b）', () => {
  it('域名徽章已退役（issue 201 meta 精简）：有链/无链卡片均无 .bz-fav-host-badge', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '有链接', url: 'https://www.github.com/a/b', created: '2025-01-01 00:00:00' }),
      seedItem({ id: '2', title: '无链接', url: '', created: '2025-01-02 00:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(document.querySelectorAll('.bz-fav-host-badge').length).toBe(0);
  });
});

describe('贴链自动搬家（ticket 188）', () => {
  function openAddForm() {
    const btn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-fav-chip-add')
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
      (b) => (b as HTMLElement).classList.contains('bz-fav-chip-add')
    ) as HTMLElement;
    btn.click();
  }
  const maskEl = () => document.querySelector('.bz-overlay-mask') as HTMLElement;

  it('只点置顶钮（无文本输入）→ 点遮罩弹 confirm', async () => {
    const ctx = await setup();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddForm();
    (document.querySelector('#fz-pin') as HTMLElement).click();
    maskEl().dispatchEvent(new MouseEvent('click', { bubbles: true }));
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


});



describe('issue 219「亚麻记事板」卡流视觉', () => {
  it('磁圆点存在且色相随首标签（GitHub=215）', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '带标签项', tags: ['GitHub'] }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    const dot = cards()[0].querySelector('.bz-fav-dot') as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot.style.getPropertyValue('--c')).toContain('hsl(215');
  });

  it('归档视图卡挂 bz-fav-arch 褪色类；主列表不挂', async () => {
    const ctx = await setup();
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '普通项' }),
      seedItem({ id: '2', title: '冷存项', archived: true, archivedAt: '2025-06-02 08:00:00' }),
    ]);
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    expect(cards().find((c) => c.querySelector('h3')!.textContent === '普通项')!.classList.contains('bz-fav-arch')).toBe(false);
    // 主列表过滤归档（ADR-0074），切归档视图后卡挂褪色类
    clickTag('__archived'); // 磁贴行「已归档」贴纸
    await tick(20);
    const archCard = cards()[0];
    expect(archCard.classList.contains('bz-fav-arch')).toBe(true);
  });
});

// ==================== 标签自定义（issue 363 修订：data.json 设置键 favoriteTags + 设置面板标签管理） ====================

describe('标签自定义（issue 363）', () => {
  /** 预置标签定义（issue 363 修订：定义本体 = data.json 设置键 favoriteTags，伴生文件退役） */
  function seedTags(ctx: Ctx, tags: any[]): void {
    ctx.state.favoriteTags = JSON.parse(JSON.stringify(tags));
  }
  const CUSTOM = [
    { id: 'github', label: 'GitHub', ic: 'github' },
    { id: 'web', label: '网站', ic: 'globe' },
    { id: 't1', label: '装修灵感', ic: 'heart' },
  ];
  /** 同「添加表单」describe 的局部 helper（磁贴行尾「＋ 新收藏」贴纸开表单 + 表单控件集） */
  function openAddViaMainBtn(): void {
    const btn = [...document.querySelectorAll('[data-fav-add]')].find(
      (b) => (b as HTMLElement).classList.contains('bz-fav-chip-add')
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
      err: form.querySelector('#fz-err') as HTMLElement,
      save: form.querySelector('#fz-save') as HTMLButtonElement,
      pin: form.querySelector('#fz-pin') as HTMLElement,
      tagBtns: [...form.querySelectorAll('#fz-tags [data-tag]')] as HTMLElement[],
      aiBtn: form.querySelector('#fz-ai') as HTMLButtonElement,
      cancel: form.querySelector('[data-fz-cancel]') as HTMLButtonElement,
      titleEl: form.querySelector('h2') as HTMLElement,
    };
  }

  it('自定义标签全链生效：磁贴行 chip + 卡片 + 表单胶囊读动态标签集', async () => {
    const ctx = await setup();
    seedTags(ctx, CUSTOM);
    seedVault(ctx.vault, [seedItem({ id: '1', title: '灵感卡', tags: ['装修灵感'], created: '2025-01-01 00:00:00' })]);
    await ctx.dm.loadTags();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    // 磁贴行：动态标签渲染（含计数），seed 九类不再出现（未在定义中的「大模型」无磁贴）
    expect(document.querySelector('[data-fav-tag="装修灵感"]')).not.toBeNull();
    expect(document.querySelector('[data-fav-tag="大模型"]')).toBeNull();
    // 表单胶囊 = 动态标签集
    openAddViaMainBtn();
    const pick = [...document.querySelectorAll('#fz-tags [data-tag]')].map((b) => (b as HTMLElement).dataset.tag);
    expect(pick).toContain('装修灵感');
    expect(pick).not.toContain('大模型');
    closePanel();
  });

  it('管理组渲染：seed 回退态出 9 行 + 添加钮；设置键预置出磁盘定义', async () => {
    const ctx = await setup();
    seedTags(ctx, CUSTOM);
    await ctx.dm.loadTags();
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    const rows = [...document.querySelectorAll('.bz-fav-tagmgr-row')];
    expect(rows.map((r) => r.querySelector('.bz-fav-tagmgr-name')!.textContent)).toEqual(['GitHub', '网站', '装修灵感']);
    // 每行四操作：上移/下移/编辑/删除（首行上移禁用）
    expect(rows[0].querySelectorAll('.bz-fav-tagmgr-btn').length).toBe(4);
    expect((rows[0].querySelector('[title="上移"]') as HTMLButtonElement).disabled).toBe(true);
    expect((rows[0].querySelector('[title="下移"]') as HTMLButtonElement).disabled).toBe(false);
    expect(document.querySelector('.bz-fav-tagmgr-add')!.textContent).toContain('添加标签');
  });

  it('添加标签：弹窗填名称保存 → data.json 设置键写入 + 列表即时出现', async () => {
    const ctx = await setup();
    await ctx.dm.loadTags();
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    (document.querySelector('.bz-fav-tagmgr-add') as HTMLElement).click();
    const editor = document.querySelector('.bz-fav-tageditor') as HTMLElement;
    expect(editor).not.toBeNull();
    const input = editor.querySelector('#fz-tag-name') as HTMLInputElement;
    input.value = '育儿';
    // 图标胶囊可选中（点第 4 个）
    (editor.querySelectorAll('.bz-fav-tageditor-ic')[3] as HTMLElement).click();
    (editor.querySelector('#fz-tag-save') as HTMLElement).click();
    await tick(20);
    const saved = ctx.state.favoriteTags as any[]; // 落 data.json 设置键（saveSettings 持久化）
    const added = saved.find((t: any) => t.label === '育儿');
    expect(added).toBeTruthy();
    expect(added.id).toMatch(/^t/); // 新增 id = 't' + 时间戳
    expect(ctx.saveCount()).toBeGreaterThan(0);
    expect(getTags().some((t) => t.label === '育儿')).toBe(true);
    // 列表重画含新行
    expect([...document.querySelectorAll('.bz-fav-tagmgr-row .bz-fav-tagmgr-name')].map((e) => e.textContent)).toContain('育儿');
  });

  it('添加校验：空名 / 同名被拦截不落盘', async () => {
    const ctx = await setup();
    seedTags(ctx, CUSTOM);
    await ctx.dm.loadTags();
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    (document.querySelector('.bz-fav-tagmgr-add') as HTMLElement).click();
    const editor = document.querySelector('.bz-fav-tageditor') as HTMLElement;
    const input = editor.querySelector('#fz-tag-name') as HTMLInputElement;
    const saveBtn = editor.querySelector('#fz-tag-save') as HTMLElement;
    saveBtn.click(); // 空名
    await tick(10);
    expect(hasNotice('请输入标签名称')).toBe(true);
    input.value = 'GitHub'; // 同名
    saveBtn.click();
    await tick(10);
    expect(hasNotice('已有同名标签')).toBe(true);
    // 两次拦截均未落盘：设置键仍为预置 CUSTOM，saveSettings 零触发
    expect(ctx.state.favoriteTags).toEqual(CUSTOM);
    expect(ctx.saveCount()).toBe(0);
  });

  it('改名存量跟随：编辑「酒馆」→「小酒馆」→ 条目 tags[]+type 批量跟随（updateSceneBulk 范式）', async () => {
    const ctx = await setup();
    seedTags(ctx, [
      { id: 'github', label: 'GitHub', ic: 'github' },
      { id: 'pub', label: '酒馆', ic: 'beer' },
      { id: 'web', label: '网站', ic: 'globe' },
    ]);
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '酒馆项', tags: ['酒馆', 'GitHub'], created: '2025-01-01 00:00:00' }),
    ]);
    await ctx.dm.loadTags();
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    const row = [...document.querySelectorAll('.bz-fav-tagmgr-row')].find((r) => r.textContent!.includes('酒馆')) as HTMLElement;
    (row.querySelector('[title="编辑"]') as HTMLElement).click();
    const input = document.querySelector('#fz-tag-name') as HTMLInputElement;
    expect(input.value).toBe('酒馆');
    input.value = '小酒馆';
    (document.querySelector('#fz-tag-save') as HTMLElement).click();
    await tick(20);
    // 条目跟随（tags 与 type 双字段）
    const item = (await ctx.dm.getAll())[0];
    expect(item.tags).toEqual(['小酒馆', 'GitHub']);
    expect(item.type).toBe('小酒馆');
    // 定义落盘（data.json 设置键）
    const saved = ctx.state.favoriteTags as any[];
    expect(saved.find((t: any) => t.id === 'pub')).toMatchObject({ label: '小酒馆' });
  });

  it('删除带条目标签：确认框提示迁入「网站」→ 条目迁移 + 定义移除', async () => {
    const ctx = await setup();
    seedTags(ctx, [
      { id: 'desktop', label: '桌面软件', ic: 'app-window' },
      { id: 'web', label: '网站', ic: 'globe' },
    ]);
    seedVault(ctx.vault, [
      seedItem({ id: '1', title: '软件项', tags: ['桌面软件'], created: '2025-01-01 00:00:00' }),
    ]);
    await ctx.dm.loadTags();
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    const row = [...document.querySelectorAll('.bz-fav-tagmgr-row')].find((r) => r.textContent!.includes('桌面软件')) as HTMLElement;
    (row.querySelector('[title="删除"]') as HTMLElement).click();
    await tick(20); // 删除流程先异步数条目再弹确认框
    const popup = document.getElementById('__shared_confirm_popup__');
    expect(popup!.textContent).toContain('1 条收藏将迁入标签「网站」');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await tick(20);
    expect((await ctx.dm.getAll())[0].tags).toEqual(['网站']);
    const saved = ctx.state.favoriteTags as any[];
    expect(saved.map((t: any) => t.label)).toEqual(['网站']);
  });

  it('删除空标签：确认后仅移除定义，条目不动', async () => {
    const ctx = await setup();
    seedTags(ctx, CUSTOM);
    seedVault(ctx.vault, [seedItem({ id: '1', title: '站', tags: ['网站'] })]);
    await ctx.dm.loadTags();
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    const row = [...document.querySelectorAll('.bz-fav-tagmgr-row')].find((r) => r.textContent!.includes('装修灵感')) as HTMLElement;
    (row.querySelector('[title="删除"]') as HTMLElement).click();
    await tick(20); // 删除流程先异步数条目再弹确认框
    expect(document.getElementById('__shared_confirm_popup__')!.textContent).toContain('标签将从标签列表中移除');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await tick(20);
    expect((await ctx.dm.getAll())[0].tags).toEqual(['网站']); // 无关条目不动
    const saved = ctx.state.favoriteTags as any[];
    expect(saved.map((t: any) => t.id)).toEqual(['github', 'web']);
  });

  it('排序：下移后落盘新顺序', async () => {
    const ctx = await setup();
    seedTags(ctx, CUSTOM);
    await ctx.dm.loadTags();
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderSettingsInto(host, favoritesSettingsSchema());
    await tick(20);
    const row0 = [...document.querySelectorAll('.bz-fav-tagmgr-row')].find((r) => r.textContent!.includes('GitHub')) as HTMLElement;
    (row0.querySelector('[title="下移"]') as HTMLElement).click();
    await tick(20);
    const saved = ctx.state.favoriteTags as any[];
    expect(saved.map((t: any) => t.id)).toEqual(['web', 'github', 't1']);
  });

  it('GitHub 强标签按 id 解耦：改名后 AI 整理兜底用当前 label', async () => {
    const ctx = await setup();
    seedTags(ctx, CUSTOM.map((t) => (t.id === 'github' ? { ...t, label: 'Git格' } : t)));
    seedVault(ctx.vault, []);
    await ctx.dm.loadTags();
    openPanel(getApp(), ctx.dm, ctx.ai);
    await tick(20);
    openAddViaMainBtn();
    const els = formEls();
    els.url.value = 'https://github.com/foo/bar';
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ name: 'bar', description: 'repo desc' }),
    } as any);
    const chat = vi.fn().mockResolvedValue('{"title":"bar","description":"仓库简介","tags":["网站"]}');
    ctx.ai.ai = { chat } as any;
    els.aiBtn.click();
    await tick(60);
    // 兜底强标签 = id 'github' 的当前 label（不再硬编码 'GitHub'）
    const onTags = [...document.querySelectorAll('#fz-tags [data-tag].bz-fav-on')].map((b) => (b as HTMLElement).dataset.tag);
    expect(onTags).toEqual(['Git格', '网站']);
    closePanel();
  });

  it('hueOf：自定义/改名标签走 hash 稳定色相（不再一律兜底蓝 200）', async () => {
    const h1 = hueOf('装修灵感');
    expect(h1).not.toBe(200);
    expect(hueOf('装修灵感')).toBe(h1); // 同名恒定
    expect(hueOf('GitHub')).toBe(215); // 内置原名映射保留（旧数据视觉不变）
  });
});
