/**
 * 游戏库深审拍板修复批回归（Wave1 bd-gameshelf 批）：
 * 呈报#12-GS2 统计页「最近玩过」行键盘可达——可点 div 改 button（同页卡片同款原生键盘语义）；
 * 呈报#49-GS4 面板会话滚位记忆——视图切换/toggle 重开接回滚位，插件卸载才作废。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closeAllModals } from '../../src/core/ui/modal';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetGameshelfState, type GameItem } from '../../src/gameshelf/state';
import { closePanel, renderAll, statsHtml } from '../../src/gameshelf/ui';
import { buildReport } from '../../src/gameshelf/report';
import { openGameshelf, unloadGameshelf } from '../../src/gameshelf/index';

// 隔离同步编排层的网络面（gs-view-fix 同款）
vi.mock('../../src/gameshelf/sync', () => ({
  AUTO_SYNC_INTERVAL_MS: 30 * 60 * 1000,
  lastSyncedAt: () => 0,
  isSyncDue: () => true,
  readSteamConfig: () => ({ steamId: '76561198366147295', apiKey: 'k'.repeat(32) }),
  runSync: vi.fn(async () => ({ ok: true, added: 0, updated: 0, offShelf: 0 })),
  autoSyncOnOpen: vi.fn(async () => {}),
}));

const CONFIG = { gameshelfSteamId: '76561198366147295', gameshelfSteamApiKey: 'k'.repeat(32) };

function item(appid: number, name: string, playtimeMin: number, lastPlayed = ''): GameItem {
  return {
    file: null, appid, name, zhName: null, playtimeMin, lastPlayed,
    cover: `https://cdn/${appid}.jpg`, coverSrc: `https://cdn/${appid}.jpg`, icon: null, iconSrc: null,
    windowsMin: playtimeMin, deckMin: 0, macMin: 0, linuxMin: 0, hasAch: false, offShelf: false,
    syncedAt: '2026-09-17T05:35:19.664Z',
  };
}

function mkApp(): any {
  return {
    vault: { getMarkdownFiles: () => [], getAbstractFileByPath: () => null, createFolder: async () => {} },
    metadataCache: { getFileCache: () => null },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  resetGameshelfState();
  resetObsidianMocks();
  setApp(mkApp());
  setSettingsProvider(() => CONFIG as any);
});

afterEach(() => {
  closeAllModals();
  unloadGameshelf();
  vi.useRealTimers();
});

describe('呈报#12-GS2：「最近玩过」行键盘可达', () => {
  it('行为 button 化（type=button + data-appid 保留）：原生 Tab/Enter/Space 即达', () => {
    const rp = buildReport([item(1, 'AAA', 600, '2026-08-01'), item(2, 'BBB', 60, '2026-07-01')]);
    const html = statsHtml(rp);
    expect(html).toContain('<button type="button" class="bz-gs-latestrow" data-appid="1">');
    expect(html).not.toContain('<div class="bz-gs-latestrow"');
    // 行内三段结构不变
    expect(html).toContain('bz-gs-latestdate');
    expect(html).toContain('bz-gs-latesth');
  });

  it('面板级：点击「最近玩过」行仍开详情（button 化不改委托行为）', () => {
    const app = mkApp();
    openGameshelf(app);
    M.items = [item(42, 'AAA', 600, '2026-08-01')];
    M.view = 'stats';
    renderAll(app);
    const row = document.querySelector('#bz-gs-body .bz-gs-latestrow') as HTMLButtonElement;
    expect(row).toBeTruthy();
    expect(row.tagName).toBe('BUTTON');
    // 委托在 #bz-gs-body 上（openDetail 对无 file 的条目安全早退——这里只验证命中行分流存在：
    // 点击后不抛错且行保持可聚焦），键盘 Enter 走同一 click 事件，由 button 原生保证
    expect(() => row.click()).not.toThrow();
  });

  it('键盘焦点可视（styles.css）：button 重置整组在位 + :focus-visible 描边', () => {
    const css = readFileSync(resolve(__dirname, '../../src/gameshelf/styles.css'), 'utf8');
    expect(css).toMatch(/\.bz-gs-latestrow:focus-visible/);
    // 裸 button 基线覆盖三件套（height:30px / inline-flex 基线的反制）必须在位
    const rule = css.match(/\.bz-gs-rows--flat \.bz-gs-latestrow \{[^}]*\}/);
    expect(rule, 'latestrow 规则应在位').toBeTruthy();
    expect(rule![0]).toContain('width: 100%');
    expect(rule![0]).toContain('height: auto');
    expect(rule![0]).toContain('background: none');
  });
});

describe('呈报#49-GS4：面板会话滚位记忆', () => {
  it('toggle 重开接回滚位：关前滚到 500，重开仍在 500（修复前恒回顶部）', () => {
    const app = mkApp();
    openGameshelf(app);
    M.items = [item(1, 'AAA', 600), item(2, 'BBB', 60)];
    renderAll(app);
    const bodyAt = () => document.querySelector<HTMLElement>('#bz-gs-body')!;
    bodyAt().scrollTop = 500;
    closePanel();
    openGameshelf(app); // openPanel → renderAll → 还滚位
    expect(bodyAt().scrollTop).toBe(500);
  });

  it('视图切换各自记账：游戏墙 500 ↔ 统计 300 互切不丢', () => {
    const app = mkApp();
    openGameshelf(app);
    M.items = [item(1, 'AAA', 600)];
    renderAll(app);
    const bodyAt = () => document.querySelector<HTMLElement>('#bz-gs-body')!;
    bodyAt().scrollTop = 500;
    M.view = 'stats';
    renderAll(app);
    expect(bodyAt().scrollTop).toBe(0); // 统计页无记忆 → 归顶（首次）
    bodyAt().scrollTop = 300;
    M.view = 'shelf';
    renderAll(app);
    expect(bodyAt().scrollTop).toBe(500); // 回游戏墙：接回
    M.view = 'stats';
    renderAll(app);
    expect(bodyAt().scrollTop).toBe(300); // 回统计：接回
  });

  it('插件卸载 = 会话边界：unload 后重开归顶（不跨卸载背旧位）', () => {
    const app = mkApp();
    openGameshelf(app);
    M.items = [item(1, 'AAA', 600)];
    renderAll(app);
    document.querySelector<HTMLElement>('#bz-gs-body')!.scrollTop = 500;
    unloadGameshelf(); // 内含 closePanel + resetScrollMemo
    document.body.innerHTML = '';
    openGameshelf(app);
    expect(document.querySelector<HTMLElement>('#bz-gs-body')!.scrollTop).toBe(0);
  });
});
