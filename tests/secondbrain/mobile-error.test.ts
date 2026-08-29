/**
 * 移动端参考 tab 检索失败提示（ticket 141，jsdom）：
 * 修复「检索失败被吞成『暂无相关笔记』」——与桌面 reference-panel 同款真实错误文案与形态；
 * 检索成功后失败态清除；空结果仍为「暂无相关笔记」。MobilePanel 直造 + 手写 store fake。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MobilePanel } from '../../src/secondbrain/mobile-panel';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import BzSettings, { DEFAULT_SETTINGS } from '../../src/settings';

function makeApp(): any {
  return {
    vault: { getAbstractFileByPath: () => null },
    workspace: { on: () => ({}), offref: () => {}, getActiveFile: () => null, activeEditor: null },
  };
}

function makePanel(searchMobile: () => Promise<unknown[]>): { panel: MobilePanel; store: any } {
  const store: any = {
    notes: {},
    initMobile: async () => '',
    searchMobile: vi.fn(searchMobile),
  };
  return { panel: new MobilePanel(makeApp(), store), store };
}

describe('secondbrain/mobile-panel 检索失败提示（ticket 141）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as BzSettings);
  });

  it('searchMobile 抛错 → 显示真实错误（不再吞成「暂无相关笔记」）', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { panel } = makePanel(async () => {
      throw new Error('Ollama 无响应');
    });
    try {
      await panel.refreshResults('足够长的查询词');
      expect(panel.refError).toBe('检索失败：请检查 Ollama 服务后重试');
      expect(panel.body.textContent).toContain('检索失败：请检查 Ollama 服务后重试');
      expect(panel.body.textContent).not.toContain('暂无相关笔记');
    } finally {
      warnSpy.mockRestore();
      panel.close();
    }
  });

  it('失败后检索成功 → 失败态清除，结果照常渲染', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { panel, store } = makePanel(async () => {
      throw new Error('Ollama 无响应');
    });
    try {
      await panel.refreshResults('足够长的查询词');
      expect(panel.refError).not.toBeNull();
      (store.searchMobile as any).mockImplementation(async () => [{ path: '笔记A.md', score: 0.9, chunk: '命中' }]);
      await panel.refreshResults('另一个查询词');
      expect(panel.refError).toBeNull();
      expect(panel.body.textContent).toContain('笔记A');
      expect(panel.body.textContent).not.toContain('检索失败');
    } finally {
      warnSpy.mockRestore();
      panel.close();
    }
  });

  it('空结果（未抛错）仍为「暂无相关笔记」', async () => {
    const { panel } = makePanel(async () => []);
    try {
      await panel.refreshResults('足够长的查询词');
      expect(panel.refError).toBeNull();
      expect(panel.body.textContent).toContain('暂无相关笔记');
    } finally {
      panel.close();
    }
  });
});
