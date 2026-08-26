/**
 * 第二大脑移动端入口（ticket 31）：对话命令在移动端复用 MobilePanel 底部抽屉（切到 AI tab），
 * 桌面保持 ChatPanel 居中弹窗——两入口行为一致。VectorStore 全量 Fake 替换（只测接线）。
 * IS_MOBILE 经 vi.mock 动态 getter 切换（桌面/移动端两态各测一次）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ensureSecondBrain, openSecondBrainChat, unloadSecondBrain } from '../../src/secondbrain/index';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import BzSettings, { DEFAULT_SETTINGS } from '../../src/settings';

const mobileState = vi.hoisted(() => ({ on: false }));

vi.mock('../../src/secondbrain/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/secondbrain/config')>();
  return { ...actual, get IS_MOBILE() { return mobileState.on; } };
});

vi.mock('../../src/secondbrain/vector-store', () => {
  class FakeVectorStore {
    initialLoad: Promise<void> | null = Promise.resolve();
    notes: Record<string, unknown> = {}; // MobilePanel 欢迎语读取 store.notes
    isIndexReady(): boolean {
      return true;
    }
    hasPendingChanges(): boolean {
      return false;
    }
    isRefreshing(): boolean {
      return false;
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
    async searchMobile(): Promise<unknown[]> {
      return [];
    }
  }
  return { VectorStore: FakeVectorStore };
});

function makeMinimalApp(): any {
  return {
    vault: {
      adapter: {},
      getMarkdownFiles: () => [],
    },
    workspace: {
      on: () => ({}),
      offref: () => {},
      getActiveFile: () => null,
    },
  };
}

describe('secondbrain/index 移动端对话入口（ticket 31）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as BzSettings);
    unloadSecondBrain(); // 复位模块单例
    // 清掉上一用例遗留 DOM（抽屉/窄窗/面板延迟移除或常驻）
    document
      .querySelectorAll('.bz-sb-float-win, .bz-sb-panel-mask, .bz-sb-panel, .bz-sb-mb-sheet, .bz-sb-mb-mini, .bz-sb-chat-panel, .bz-sb-chat-mask')
      .forEach((el) => el.remove());
  });

  it('移动端：对话命令复用底部抽屉并切到 AI tab（桌面弹窗不创建）', async () => {
    mobileState.on = true;
    const app = makeMinimalApp();
    setApp(app as any);
    ensureSecondBrain(app as any);
    await new Promise((r) => setTimeout(r, 0)); // initialLoad 微任务冲刷
    openSecondBrainChat(app as any);

    const sheet = document.querySelector('.bz-sb-mb-sheet');
    expect(sheet).not.toBeNull(); // 底部抽屉已建
    const pills = [...sheet!.querySelectorAll('.bz-sb-mb-pill')];
    const chatPill = pills.find((p) => p.textContent === '🤖') as HTMLElement;
    expect(chatPill).toBeTruthy();
    expect(chatPill.classList.contains('active')).toBe(true); // AI tab 已激活
    expect((sheet as HTMLElement).classList.contains('bz-sb-mb-open')).toBe(true); // 已展开
    expect(document.getElementById('bz-sb-chat-panel')).toBeNull(); // 桌面 ChatPanel 弹窗未建
    unloadSecondBrain();
  });

  it('桌面：对话仍走 ChatPanel 居中弹窗（移动端分支不介入）', async () => {
    mobileState.on = false;
    const app = makeMinimalApp();
    setApp(app as any);
    ensureSecondBrain(app as any);
    await new Promise((r) => setTimeout(r, 0));
    openSecondBrainChat(app as any);

    expect(document.querySelector('.bz-sb-mb-sheet')).toBeNull(); // 未建移动抽屉
    const popup = document.getElementById('bz-sb-chat-panel');
    expect(popup).not.toBeNull();
    expect(popup!.style.display).toBe('flex'); // 桌面弹窗正常打开
    unloadSecondBrain();
  });
});