/**
 * 第二大脑域入口覆盖补测（ticket 103）：ensureSecondBrain 幂等、open 入口冒烟、unload 复位。
 * VectorStore 以模块级 Fake 替换（isIndexReady 恒真）：入口测试只验证域接线与生命周期，
 * 不关心真实索引装载；同时避免真实 Store 后台 refresh 的落盘/网络副作用。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ensureSecondBrain,
  unloadSecondBrain,
  openSecondBrainPanel,
  openSecondBrainReference,
  openSecondBrainChat,
} from '../../src/secondbrain/index';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import BzSettings, { DEFAULT_SETTINGS } from '../../src/settings';

/** FakeStore 就绪开关：默认 false（面板走浅引导态，无统计渲染副作用），按需武装 */
const fakeState = vi.hoisted(() => ({ ready: false }));

vi.mock('../../src/secondbrain/vector-store', () => {
  class FakeVectorStore {
    initialLoad: Promise<void> | null = Promise.resolve();
    hasPendingChanges(): boolean {
      return false;
    }
    isIndexReady(): boolean {
      return fakeState.ready;
    }
    async load(): Promise<void> {}
    async initMobile(): Promise<string> {
      return '';
    }
    async refresh(): Promise<void> {}
    async rebuildAll(): Promise<void> {}
    async search(): Promise<unknown[]> {
      return [];
    }
  }
  return { VectorStore: FakeVectorStore };
});

function makeMinimalApp(): any {
  return {
    vault: {
      adapter: {}, // read/readBinary/stat 缺失 → 各处 catch 兜底空库
      getMarkdownFiles: () => [],
    },
    workspace: {},
  };
}

describe('secondbrain/index 入口', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as BzSettings);
    fakeState.ready = false;
    unloadSecondBrain(); // 复位模块单例
    // 清掉上一用例遗留 DOM（窄窗/主面板为延迟移除或常驻遮罩）
    document
      .querySelectorAll('.bz-sb-float-win, .bz-sb-panel-mask, .bz-sb-panel')
      .forEach((el) => el.remove());
  });

  it('ensureSecondBrain 幂等：重复调用只初始化一次且不抛错', () => {
    const app = makeMinimalApp();
    expect(() => ensureSecondBrain(app)).not.toThrow();
    expect(() => ensureSecondBrain(app)).not.toThrow();
  });

  it('三个 open 入口在最小 mock 下同步路径不抛错', () => {
    const app = makeMinimalApp();
    expect(() => openSecondBrainPanel(app)).not.toThrow();
    expect(() => openSecondBrainReference(app)).not.toThrow();
    expect(() => openSecondBrainChat(app)).not.toThrow();
  });

  it('unload 后可重新初始化（单例复位）', () => {
    const app = makeMinimalApp();
    ensureSecondBrain(app);
    expect(() => unloadSecondBrain()).not.toThrow();
    expect(() => ensureSecondBrain(app)).not.toThrow();
    unloadSecondBrain();
  });

  it('参考窗 ❌ 关闭后可经命令重开（stale reference 置空重建）', async () => {
    const app = makeMinimalApp();
    setApp(app);
    ensureSecondBrain(app);
    fakeState.ready = true; // 武装就绪：参考命令走真窗路径
    await new Promise((r) => setTimeout(r, 0)); // initialLoad 微任务冲刷

    openSecondBrainReference(app);
    const win1 = document.querySelector('.bz-sb-float-win');
    expect(win1).toBeTruthy();
    // 点 ❌ 关闭（150ms 延迟移除 DOM）
    (win1!.querySelector('.bz-sb-float-btn-close') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 200));
    expect(document.querySelector('.bz-sb-float-win')).toBeFalsy();

    // 重开：必须重建新窄窗（修复前 reference 残留死实例，命令永久失灵）
    openSecondBrainReference(app);
    const win2 = document.querySelector('.bz-sb-float-win');
    expect(win2).toBeTruthy();
    expect(win2).not.toBe(win1);

    unloadSecondBrain();
    await new Promise((r) => setTimeout(r, 200));
    expect(document.querySelector('.bz-sb-float-win')).toBeFalsy();
  });
});
