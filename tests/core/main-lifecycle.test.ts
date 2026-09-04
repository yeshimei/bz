/**
 * main.ts 生命周期回归（fix(main)）：
 * 1. onunload 卸载接线补全——各域 unload cleanup 恰好触发一次，开头 closeItemMenu 收口统一浮层；
 *    域模块用 vi.mock 局部替换（仅换 unload* 为 spy，其余导出保持真实实现）。
 * 命令注册清单不变（smoke 全量遍历不受影响），本文件 onLayoutReady 置空以隔离 ensure* 初始化。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/belongings', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  unloadBelongings: vi.fn(),
}));
vi.mock('../../src/favorites', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  unloadFavorites: vi.fn(),
}));
vi.mock('../../src/review', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  unloadReview: vi.fn(),
}));
vi.mock('../../src/clipbook', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return { ...mod, unloadClipbook: vi.fn() };
});
vi.mock('../../src/auto-summary', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  unloadAutoSummary: vi.fn(),
}));
vi.mock('../../src/core/item-actions', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  closeItemMenu: vi.fn(),
}));

import BzPlugin from '../../src/main';
import { MockVault } from '../mock-vault';
import { closeItemMenu } from '../../src/core/item-actions';
import { unloadBelongings } from '../../src/belongings';
import { unloadFavorites } from '../../src/favorites';
import { unloadReview } from '../../src/review';
import { unloadClipbook } from '../../src/clipbook';
import { unloadAutoSummary } from '../../src/auto-summary';

const removedCommands: string[] = [];
const registeredCommands: any[] = [];
const diskData: Record<string, any> = {};

/** mock app（对齐 smoke.test：onLayoutReady 置空，不触发 ensure* 常驻初始化） */
function makeMockApp() {
  const vault = new MockVault();
  return {
    vault,
    workspace: {
      onLayoutReady: () => {},
      getActiveFile: () => null,
      getActiveViewOfType: () => null,
      activeEditor: null,
      on: () => ({ ref: 'ref' }),
    },
    commands: {
      addCommand: (c: any) => registeredCommands.push(c),
      removeCommand: (id: string) => removedCommands.push(id),
      listCommands: () => [],
      executeCommandById: () => {},
    },
    metadataCache: { getFileCache: () => null, getBacklinksForFile: () => null, on: () => ({ ref: 'ref' }) },
    fileManager: { processFrontMatter: () => Promise.resolve() },
  };
}

async function createPlugin(app: any) {
  const plugin: any = new BzPlugin(app, {} as any);
  plugin.app = app;
  plugin.loadData = async () => diskData['bz'] ?? null;
  plugin.saveData = async (d: any) => {
    diskData['bz'] = d;
  };
  await plugin.onload();
  return plugin;
}

/** 清零全部 spy 调用记录 */
function clearSpies(): void {
  [
    closeItemMenu,
    unloadBelongings,
    unloadFavorites,
    unloadReview,
    unloadClipbook,
    unloadAutoSummary,
  ].forEach((fn) => vi.mocked(fn).mockClear());
}

describe('onunload 卸载接线补全（fix(main)）', () => {
  beforeEach(() => {
    delete diskData['bz'];
    removedCommands.length = 0;
    registeredCommands.length = 0;
    document.body.innerHTML = '';
    clearSpies();
  });

  it('onunload 触发各域 cleanup 恰好一次 + 开头 closeItemMenu 收口', async () => {
    const plugin = await createPlugin(makeMockApp());
    clearSpies(); // onload 阶段不应触碰任何 unload
    await plugin.onunload();

    expect(closeItemMenu).toHaveBeenCalledTimes(1);
    expect(unloadBelongings).toHaveBeenCalledTimes(1);
    expect(unloadFavorites).toHaveBeenCalledTimes(1);
    expect(unloadReview).toHaveBeenCalledTimes(1);
    // clipbook 融合域（ADR-0082）：旧 news/clipping unload 由本域接管
    expect(unloadClipbook).toHaveBeenCalledTimes(1);
    expect(unloadAutoSummary).toHaveBeenCalledTimes(1);

    // 卸载接线不影响既有清理：裸注册命令仍全量移除
    //（removed 可能额外含 bz-diary-write：onunload 对其 try/catch 移除，与本接线无关）
    expect(registeredCommands.length).toBeGreaterThanOrEqual(40);
    const removed = new Set(removedCommands);
    for (const c of registeredCommands) expect(removed.has(c.id), c.id).toBe(true);
  });

  it('重复 onunload 幂等：cleanup 各累计两次、命令移除不抛错', async () => {
    const plugin = await createPlugin(makeMockApp());
    await plugin.onunload();
    await plugin.onunload();
    expect(unloadAutoSummary).toHaveBeenCalledTimes(2);
  });
});

