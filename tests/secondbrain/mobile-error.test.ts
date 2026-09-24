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

function makePanel(searchMobile: (q: string, k?: number, signal?: AbortSignal) => Promise<unknown[]>): { panel: MobilePanel; store: any } {
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

describe('secondbrain/mobile-panel 检索取消（issue 428「只查最新」）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setApp(null as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as BzSettings);
  });

  it('新查询发起即中断上一轮：旧 signal 已 abort，旧结果不回填、不报错', async () => {
    const signals: AbortSignal[] = [];
    const resolvers: ((v: any) => void)[] = [];
    const { panel } = makePanel((q: string) => {
      signals.push((panel as any).inflight.signal);
      return new Promise((resolve) => resolvers.push((_s) => resolve(q === '第一轮查询' ? [{ path: '旧结果.md', score: 0.9, chunk: '旧' }] : [])));
    });
    try {
      const first = panel.refreshResults('第一轮查询');
      const second = panel.refreshResults('第二轮查询');
      expect(signals[0].aborted).toBe(true); // 上一轮真中断
      expect(signals[1].aborted).toBe(false);
      resolvers.forEach((r) => r(null)); // 旧轮即便已返回数据也不再回填
      await Promise.all([first, second]);
      expect(panel.refError).toBeNull(); // 被中断的一轮不当作失败
      expect(panel.body.textContent).not.toContain('检索失败');
      expect(panel.body.textContent).not.toContain('旧结果');
    } finally {
      panel.close();
    }
  });

  it('中断发生在 store 抛错路径：本轮静默收口，不落失败提示', async () => {
    const { panel, store } = makePanel(async () => {
      throw Object.assign(new Error('请求已中断'), { name: 'AbortError' });
    });
    try {
      (store.searchMobile as any).mockImplementation(async (_q: string, _k: number, signal: AbortSignal) => {
        if (signal.aborted) throw Object.assign(new Error('请求已中断'), { name: 'AbortError' });
        return [];
      });
      await panel.refreshResults('足够长的查询词');
      expect(panel.refError).toBeNull();
      expect(panel.body.textContent).not.toContain('检索失败');
    } finally {
      panel.close();
    }
  });

  it('关闭抽屉：在途检索被中断（无接管者），不抛错', async () => {
    let captured: AbortSignal | undefined;
    const { panel } = makePanel(
      (_q: string) =>
        new Promise((resolve) => {
          const signal: AbortSignal = (panel as any).inflight.signal;
          captured = signal;
          signal.addEventListener('abort', () => resolve([] as any));
        })
    );
    const pending = panel.refreshResults('足够长的查询词');
    panel.close();
    expect(captured?.aborted).toBe(true);
    await expect(pending).resolves.toBeUndefined();
  });
});
