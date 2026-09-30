/**
 * 第二大脑主面板关闭钮「复位优先」回归（clipbook 同款语义，jsdom）：
 * - 来源分布树有展开目录：✕ 第一击全部收起并重绘、面板不关；已收再点 ✕ 才 close()
 * - 无任何展开：✕ 直接关面板（移动端全屏无遮罩可点，关闭钮是唯一入口）
 * - 追加（issue 291）：panel.ts 单源 confirmFullRebuild 的确认框带域皮肤类 bz-sb-flow-dialog
 *   （挂 body 的流程框不继承 --sb-*，漏传则掉回 core 裸样式）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, hasNotice } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import BzSettings, { DEFAULT_SETTINGS } from '../../src/settings';
import { SecondBrainPanel, confirmFullRebuild } from '../../src/secondbrain/panel';

function makeEnv() {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as BzSettings);
  return app;
}

/** 就绪库 fake store：同顶层下两个子目录 → 来源树根「我的」目录节点带子目录行（可展开；
 *  树只由目录构成，文件不挂 children——平铺路径会退化成叶子行） */
function makeStore(): any {
  return {
    initialLoad: Promise.resolve(),
    isIndexReady: () => true,
    hasPendingChanges: () => false,
    isRefreshing: () => false,
    needsModelRebuild: () => false,
    refresh: async () => {},
    meta: {
      notes: {
        '我的/日记/A.md': { mtime: 1, chunks: [{ text: '甲' }] },
        '我的/摘录/B.md': { mtime: 2, chunks: [{ text: '乙' }] },
      },
      _dim: 2,
    },
    vectors: [],
  };
}

/** 轮询等待异步渲染（open → showContent → autoRefreshThenRender → renderStats 链路） */
async function until(fn: () => boolean, timeoutMs = 1500): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw new Error('until 超时');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('第二大脑主面板：关闭钮复位优先', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });

  it('有展开目录：✕ 第一击全收并重绘不关面板，第二击才关', async () => {
    const app = makeEnv();
    const panel = new SecondBrainPanel(app, makeStore(), { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    await until(() => !!document.querySelector('#bz-sb-dist .bz-sb-dist-row--dir'));
    // 展开根目录（真实路径：点目录行 → 委托监听加 expandedDirs → renderDist）
    const dirRow = document.querySelector<HTMLElement>('#bz-sb-dist .bz-sb-dist-row--dir[data-path="我的"]')!;
    expect(dirRow).toBeTruthy();
    dirRow.click();
    // 子目录行出现 = 已展开
    expect(document.querySelector('#bz-sb-dist [data-path="我的/日记"]')).toBeTruthy();
    // ✕ 第一击：全部收起（子目录行消失）、面板仍开
    (document.getElementById('bz-sb-panel-close') as HTMLElement).click();
    expect(document.querySelector('#bz-sb-dist [data-path="我的/日记"]')).toBeNull();
    expect((document.querySelector('.bz-sb-panel') as HTMLElement).style.display).toBe('flex');
    // ✕ 第二击：无待复位态 → 关面板
    (document.getElementById('bz-sb-panel-close') as HTMLElement).click();
    expect((document.querySelector('.bz-sb-panel') as HTMLElement).style.display).toBe('none');
    panel.destroy();
  });

  it('无展开目录：✕ 直接关面板', async () => {
    const app = makeEnv();
    const panel = new SecondBrainPanel(app, makeStore(), { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    await until(() => !!document.querySelector('#bz-sb-dist .bz-sb-dist-row--dir'));
    (document.getElementById('bz-sb-panel-close') as HTMLElement).click();
    expect((document.querySelector('.bz-sb-panel') as HTMLElement).style.display).toBe('none');
    panel.destroy();
  });
});

describe('issue 291：确认流程框带皮（core/flow-dialog）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });

  it('confirmFullRebuild 单源确认框：popup 带 bz-sb-flow-dialog（挂 body 不继承 --sb-*）', async () => {
    const p = confirmFullRebuild();
    const popup = document.getElementById('__shared_confirm_popup__');
    expect(popup).not.toBeNull();
    expect(popup!.classList.contains('bz-sb-flow-dialog')).toBe(true);
    // 共享壳类仍在（流程框与 uiModal 同壳，issue 291 内核口径）
    expect(popup!.classList.contains('bz-overlay-popup')).toBe(true);
    expect(popup!.classList.contains('bz-flow-dialog')).toBe(true);
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await expect(p).resolves.toBe(false); // 取消 → false（原语义不变）
  });
});

describe('issue 422：换 Embedding 模型 → 打开面板自动全量重建', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
  });

  it('needsModelRebuild 为真：发原因通知 + 走重建（不落空库引导、无需用户点按钮）', async () => {
    const app = makeEnv();
    const store = {
      ...makeStore(),
      needsModelRebuild: () => true,
      rebuildAll: vi.fn(async () => {}),
    };
    const panel = new SecondBrainPanel(app, store, { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    expect(store.rebuildAll).toHaveBeenCalledTimes(1);
    expect(hasNotice(/Embedding 模型已更换/)).toBe(true);
    panel.destroy();
  });
});

describe('主面板拖拽缩放 + 尺寸记忆（ADR-0084/0094）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });

  it('有记忆值时打开即套用内联宽高；close 摘句柄后新记忆生效', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(
      () => ({ ...DEFAULT_SETTINGS, secondbrainPanelWidth: 900, secondbrainPanelHeight: 640 }) as BzSettings,
    );
    const panel = new SecondBrainPanel(app, makeStore(), { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    const popup = document.querySelector('.bz-sb-panel') as HTMLElement;
    expect(popup.style.width).toBe('900px');
    expect(popup.style.height).toBe('640px');
    // close 摘句柄后改记忆值，再开套新值（close detach 生效的间接验证）
    panel.close();
    setSettingsProvider(
      () => ({ ...DEFAULT_SETTINGS, secondbrainPanelWidth: 920, secondbrainPanelHeight: 660 }) as BzSettings,
    );
    await panel.open();
    expect(popup.style.width).toBe('920px');
    expect(popup.style.height).toBe('660px');
    panel.destroy();
  });

  it('0 = 未拖过 → 不写内联尺寸（走 CSS 默认，persist 语义）', async () => {
    const app = makeEnv();
    const panel = new SecondBrainPanel(app, makeStore(), { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    const popup = document.querySelector('.bz-sb-panel') as HTMLElement;
    expect(popup.style.width).toBe('');
    expect(popup.style.height).toBe('');
    panel.destroy();
  });
});
