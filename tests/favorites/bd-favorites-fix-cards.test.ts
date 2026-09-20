/**
 * 收藏卡点按反馈与外链标识回归（全域深审拍板后修复批 Wave1 · favorites）：
 * - F1（呈报#24）：桌面点无链卡片不再零反馈——卡片挂 .bz-fav-nolink 轻微晃动动效类
 *   （animationend 摘类；仍不开链、不弹菜单，issue 201「不动作」拍板保持）
 * - F6（呈报#25）：有链接卡片常驻 external-link 外链标识角标（.bz-fav-ext），
 *   无链接卡片不挂角标
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

describe('F1：无链卡片点按反馈（晃动，呈报#24）', () => {
  it('桌面点无链卡片 → 卡片挂 .bz-fav-nolink 晃动类；不开链、不弹菜单（不动作拍板保持）', async () => {
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
    expect(card.classList.contains('bz-fav-nolink'), '点按后挂晃动类（修复前必红：旧版零反馈）').toBe(true);
    expect(app.openUrl).not.toHaveBeenCalled();
    expect(document.querySelector('.bz-item-menu')).toBeNull();
  });

  it('键盘 Enter 触发无链卡片同径晃动；有链卡片点击直开、不挂晃动类', async () => {
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

    const noLink = cards().find((c) => c.querySelector('h3')!.textContent === '无链收藏')!;
    pressEnter(noLink);
    expect(noLink.classList.contains('bz-fav-nolink')).toBe(true);

    const withLink = cards().find((c) => c.querySelector('h3')!.textContent === '有链收藏')!;
    clickCard(withLink);
    expect(app.openUrl).toHaveBeenCalledWith('https://github.com/a/b');
    expect(withLink.classList.contains('bz-fav-nolink')).toBe(false);
  });
});

describe('F6：外链标识角标（呈报#25）', () => {
  it('有链卡片挂 .bz-fav-ext 角标（external-link 占位 + title 提示）；无链卡片不挂', async () => {
    const vault = new MockVault();
    setApp(makeApp(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    vault.files.set('CONFIG/STORAGE/favorites.json', JSON.stringify([
      seedItem({ id: '1', title: '有链收藏', url: 'https://github.com/a/b' }),
      seedItem({ id: '2', title: '无链收藏', url: '' }),
    ]));
    openPanel(getApp(), new DataManager('CONFIG/STORAGE/favorites.json'), new FavoritesAIService());
    await tick(20);

    const withLink = cards().find((c) => c.querySelector('h3')!.textContent === '有链收藏')!;
    const ext = withLink.querySelector('.bz-fav-ext') as HTMLElement | null;
    expect(ext, '有链卡片带外链角标').toBeTruthy();
    expect(ext!.getAttribute('title')).toBe('打开外部链接');
    // 图标占位 data-lucide 经 mountIcons（mock setIcon 记 data-icon）兑现，两态任一在即视为 external-link
    expect(ext!.querySelector('[data-lucide="external-link"], [data-icon="external-link"]')).toBeTruthy();

    const noLink = cards().find((c) => c.querySelector('h3')!.textContent === '无链收藏')!;
    expect(noLink.querySelector('.bz-fav-ext')).toBeNull();
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
