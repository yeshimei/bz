/**
 * 收藏卡点按契约回归（全域深审拍板后修复批 Wave1 · favorites；2026-09-23 拍板更新）：
 * - 点卡不再导航（2026-09-23）：桌面点卡（有链/无链）一律不开浏览器、不弹菜单、
 *   不再挂 .bz-fav-nolink 晃动类（F1 晃动反馈随点卡开链一并退役）；开链/复制网址走右键菜单
 * - F6（呈报#25）2026-09-23 退役：外链角标 .bz-fav-ext 从卡片 markup 摘除，任何卡片不再挂
 * - 复制网址（2026-09-23 新增）：actionSpecs 有 url 才含 copy、紧跟 open（数据层契约；
 *   UI 层 clipboard 行为盖在 ui.test.ts）
 * - F5（呈报#61）：桌面磁贴行限高 + 纵向滚动（样式文本断言，jsdom 不解析 css）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DataManager } from '../../src/favorites/data';
import { FavoritesAIService } from '../../src/favorites/ai';
import { closeItemMenu } from '../../src/core/item-actions';
import { openPanel, closePanel, unloadFavoritesUI } from '../../src/favorites/ui';
import { actionSpecs } from '../../src/favorites/shared';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, Platform } from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {},
    workspace: { openLinkText: vi.fn() },
    openUrl: vi.fn(),
  } as any;
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

function seedItem(seed: { id: string; title: string; url?: string; tags?: string[] }) {
  return {
    id: seed.id,
    tags: seed.tags || ['GitHub'],
    title: seed.title,
    description: '',
    pinned: false,
    url: seed.url ?? '',
    balance: null,
    balanceCacheTime: null,
    balanceError: null,
    linkedNote: null,
    created: '2025-01-01 00:00:00',
    type: (seed.tags || ['GitHub'])[0],
  };
}

function cards(): HTMLElement[] {
  return [...document.querySelectorAll('.bz-fav-board .bz-fav-card')] as HTMLElement[];
}

function clickCard(card: HTMLElement): void {
  card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function pressEnter(card: HTMLElement): void {
  const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'target', { value: card });
  card.dispatchEvent(ev);
}

const repoCss = () => readFileSync(resolve(process.cwd(), 'src/favorites/styles.css'), 'utf8');

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  // openPanel 是 toggle：必须先收掉上一用例残留的模块态 overlay，否则本次 open 走关闭分支
  closePanel();
  unloadFavoritesUI();
  Platform.isMobile = false;
});

afterEach(() => {
  Platform.isMobile = false;
  closeItemMenu();
  closePanel();
  unloadFavoritesUI();
  document.body.innerHTML = '';
});

describe('点卡不再导航（2026-09-23 拍板；F1 晃动随开链退役）', () => {
  it('桌面点无链卡片 → 不开链、不弹菜单、不挂晃动类', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      seedItem({ id: '1', title: '无链收藏', url: '' }),
    ]));
    openPanel(getApp(), new DataManager('CONFIG/STORAGE/favorites.json'), new FavoritesAIService());
    await tick(20);

    const card = cards().find((c) => c.querySelector('h3')!.textContent === '无链收藏')!;
    clickCard(card);
    expect(card.classList.contains('bz-fav-nolink'), '晃动反馈已退役：不再挂类').toBe(false);
    expect(app.openUrl).not.toHaveBeenCalled();
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });

  it('有链卡片点击也不跳网站（开链/复制网址移至右键菜单）；Enter 同径', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      seedItem({ id: '1', title: '无链收藏', url: '' }),
      seedItem({ id: '2', title: '有链收藏', url: 'https://github.com/a/b' }),
    ]));
    openPanel(getApp(), new DataManager('CONFIG/STORAGE/favorites.json'), new FavoritesAIService());
    await tick(20);

    const withLink = cards().find((c) => c.querySelector('h3')!.textContent === '有链收藏')!;
    clickCard(withLink);
    expect(app.openUrl).not.toHaveBeenCalled();
    expect(withLink.classList.contains('bz-fav-nolink')).toBe(false);

    const noLink = cards().find((c) => c.querySelector('h3')!.textContent === '无链收藏')!;
    pressEnter(noLink);
    expect(noLink.classList.contains('bz-fav-nolink')).toBe(false);
    expect(app.openUrl).not.toHaveBeenCalled();
  });
});

describe('F6 退役：外链标识角标摘除（2026-09-23 拍板）', () => {
  it('任何卡片都不再挂 .bz-fav-ext 角标', async () => {
    const vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      seedItem({ id: '1', title: '有链收藏', url: 'https://github.com/a/b' }),
      seedItem({ id: '2', title: '无链收藏', url: '' }),
    ]));
    openPanel(getApp(), new DataManager('CONFIG/STORAGE/favorites.json'), new FavoritesAIService());
    await tick(20);

    expect(document.querySelectorAll('.bz-fav-ext').length, '角标 markup 已从 cardHtml 摘除').toBe(0);
  });
});

describe('actionSpecs：复制网址动作（2026-09-23 拍板，数据层契约）', () => {
  it('有 url：动作序 open→copy 相邻，copy 带「复制网址」文案；无 url：不含 copy', () => {
    const withUrl = actionSpecs(seedItem({ id: '1', title: '有链收藏', url: 'github.com/a/b' }));
    expect(withUrl.map((a) => a.act).slice(0, 2)).toEqual(['open', 'copy']);
    expect(withUrl.find((a) => a.act === 'copy')!.label).toBe('复制网址');
    const noUrl = actionSpecs(seedItem({ id: '2', title: '无链收藏', url: '' }));
    expect(noUrl.map((a) => a.act)).not.toContain('copy');
    expect(noUrl.map((a) => a.act)).toEqual(['pin', 'edit', 'archive', 'del']);
  });
});

describe('F5：桌面磁贴行限高（呈报#61，样式文本断言）', () => {
  it('桌面磁贴行限高 + 纵向滚动；移动端单行横滑不受限', () => {
    const css = repoCss();
    const m = css.match(/\.bz-fav-panel:not\(\.bz-fav-mob\) \.bz-fav-tags \{[^}]*\}/);
    expect(m, '桌面磁贴行限高规则在位').toBeTruthy();
    expect(m![0]).toContain('max-height:');
    expect(m![0]).toContain('overflow-y: auto;');
    // 顶垫防 chip 磁点 ::before(top:-4px) 被 overflow 裁边（移动横滑同款垫法）
    expect(m![0]).toContain('padding: 5px 0 6px;');
    // 移动端分支仍是单行横滑，不带 max-height
    const mob = css.match(/\.bz-fav-panel\.bz-fav-mob \.bz-fav-tags \{[^}]*\}/);
    expect(mob).toBeTruthy();
    expect(mob![0]).not.toContain('max-height');
  });
});
