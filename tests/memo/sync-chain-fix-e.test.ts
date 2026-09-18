/**
 * 备忘录（memo）· T1 vault modify 同步链钉死（review-deep memo-arch 测试缺口 2）
 *
 * 覆盖面（src/memo/ui.ts:162-209 subscribeMemoSync/unsubscribeMemoSync，本批零源码改动、按现状钉）：
 *   1. 外部改 memo.json（面板开着）→ 150ms 防抖后面板重读出新条目；
 *   2. 自写短路：MemoData.write 包装置 syncing，写盘窗口内的 modify 事件不再触发防抖重读
 *      （写路径已自 refresh，重复刷新=双倍重渲）；
 *   3. unloadMemo 后：modify 不再刷新、write 包装已还原（MemoData.write 回到原函数）、
 *      二次 unload 不抛（还原幂等）。
 *
 * 注：write 包装的「UI 层猴子补丁」手法为审查登记不修项（memo-arch A7，可维护性债），本文件
 * 按现状断言其可观测行为；若后续把自写旗标下沉 data 层，行为断言应保持成立，仅实现注释过期。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, unloadMemo } from '../../src/memo/ui';
import { MemoData } from '../../src/memo/data';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '@last',
  memoDoneWindow: '30',
  cinemaFolderPath: '我的/影视',
};

function seedVault(): { vault: MockVault; app: any; settings: any } {
  const vault = new MockVault();
  const items = [
    { id: 'a', title: '种子条目一', scene: '工作', priority: 'minor', created: '2026-09-01 10:00:00', completed: null, due: null },
    { id: 'b', title: '种子条目二', scene: '生活', priority: 'minor', created: '2026-09-02 10:00:00', completed: null, due: null },
  ];
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  const settings = { ...SETTINGS };
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app, settings };
}

/** 模拟外部进程改写 memo.json 后发 modify 事件（MockVault 不会自动 emit，手工触发） */
function externalModify(vault: MockVault, items: unknown[]): void {
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  vault.emit('modify', vault.file('CONFIG/STORAGE/memo.json'));
}

/** 打开面板（index 入口 = MemoData.init + ensureMemo 订阅 + 面板）并等初始装载完成（列表出卡片）。
 *  注意 index.openMemoPanel 同步建 overlay：ui 层 openMemoPanel 是 toggle，勿二次调用（会关面板） */
async function openPanel(app: any): Promise<HTMLElement> {
  const { openMemoPanel } = await import('../../src/memo');
  openMemoPanel(app);
  await vi.waitFor(() => {
    expect(document.querySelectorAll('.bz-memo-card').length).toBe(2);
  });
  return document.querySelector('.bz-panel-overlay') as HTMLElement;
}

beforeEach(() => {
  resetObsidianMocks();
  resetMemoState();
  document.body.innerHTML = '';
});

afterEach(() => {
  // 兜底卸载：退订 modify + 还原 write 包装，防模块级状态（vaultSyncRef/origMemoWrite）跨用例残留
  unloadMemo();
  closeMemoPanel();
  document.body.innerHTML = '';
});

describe('memo vault modify 同步链（T1）', () => {
  it('外部改 memo.json：150ms 防抖后面板重读出新条目', async () => {
    const { vault, app } = seedVault();
    // index.openMemoPanel 等价链（MemoData.init + ensureMemo + 面板）——ensureMemo 负责订阅 modify
    const overlay = await openPanel(app);

    // 外部来源（另一面板/守护进程）追加一条
    externalModify(vault, [
      { id: 'a', title: '种子条目一', scene: '工作', priority: 'minor', created: '2026-09-01 10:00:00', completed: null, due: null },
      { id: 'b', title: '种子条目二', scene: '生活', priority: 'minor', created: '2026-09-02 10:00:00', completed: null, due: null },
      { id: 'ext', title: '外部新增条目', scene: '学习', priority: 'minor', created: '2026-09-03 10:00:00', completed: null, due: null },
    ]);

    // 防抖窗口（150ms）内不刷，窗口后重读出新条目
    await vi.waitFor(() => {
      expect(overlay.querySelectorAll('.bz-memo-card').length).toBe(3);
      expect(overlay.textContent).toContain('外部新增条目');
    });
  });

  it('非 memo.json 的 modify 不触发重读；面板未开不刷', async () => {
    const { vault, app } = seedVault();
    const overlay = await openPanel(app);

    // 别的文件 modify：不防抖重读（等过防抖窗口仍 2 张卡）
    vault.emit('modify', vault.file('CONFIG/STORAGE/other.json'));
    await new Promise((r) => setTimeout(r, 300));
    expect(overlay.querySelectorAll('.bz-memo-card').length).toBe(2);

    // 关面板后 memo.json modify：M.overlay 空 → 不刷也不抛
    closeMemoPanel();
    expect(() => externalModify(vault, [])).not.toThrow();
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
  });

  it('自写短路：MemoData.write 写盘窗口内的 modify 不触发二次防抖重读（syncing 短路）', async () => {
    const { vault, app } = seedVault();
    const overlay = await openPanel(app);

    // 真实 Obsidian 里 vault 写盘会派发 modify——mock 补上这层：vault.modify 后发 modify
    // （jsonFileStore 的写盘通道 = app.vault.modify），该 emit 落在包装 write 的 syncing=true
    // 窗口内（origMemoWrite 未 resolve），应被短路
    const origModify = vault.modify.bind(vault);
    let modifyDuringWrite = 0;
    vault.modify = async (file: any, content: string) => {
      await origModify(file, content);
      modifyDuringWrite += 1;
      vault.emit('modify', vault.file(file.path));
    };

    // 观察 refresh 次数：M.renderFn 每次 refresh 恰好调一次（写路径 refresh 1 次）
    const renderSpy = vi.fn();
    M.renderFn = renderSpy;

    // composer 快速录入 = 一次 MemoData 写盘链（addItem → write）
    const input = overlay.querySelector('[data-memo-composer-input]') as HTMLInputElement;
    input.value = '自写短路探针条目';
    (overlay.querySelector('[data-memo-composer-add]') as HTMLElement).click();

    // 写路径自己的 refresh：renderSpy 恰 1 次；窗口内的 modify 已被 syncing 短路
    await vi.waitFor(() => {
      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(modifyDuringWrite).toBeGreaterThanOrEqual(1); // 证明确实在写盘窗口内发过 modify
    });
    // 防抖窗口（150ms）走完：无二次刷新
    await new Promise((r) => setTimeout(r, 400));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.find((r: any) => r.title === '自写短路探针条目')).toBeTruthy();
  });

  it('unloadMemo 后：write 包装还原、modify 不再刷新、二次 unload 不抛', async () => {
    const { vault, app } = seedVault();
    await openPanel(app);

    // 订阅期：MemoData.write 已是包装函数（syncing 置位层）
    const wrappedWrite = MemoData.write;

    unloadMemo();
    // 包装还原：不再是包装函数（卸载后不再拦截，避免引用的 UI 闭包残留）。
    // 注：现状实现按「本轮订阅时现状」还原而非最初原型方法（A7 猴子补丁的边角：每轮
    // 订阅/还原叠加一层 bind，行为等价仅身份漂移），故只断言「不是包装」+ 后续引用稳定。
    const restored = MemoData.write;
    expect(restored).not.toBe(wrappedWrite);
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();

    // 卸载后 modify：监听已退订，不刷不抛
    expect(() => externalModify(vault, [{ id: 'a', title: 'x', scene: '工作', priority: 'minor', created: '', completed: null, due: null }])).not.toThrow();
    await new Promise((r) => setTimeout(r, 300));

    // 二次 unload：还原幂等，不抛、write 引用不再变化
    expect(() => unloadMemo()).not.toThrow();
    expect(MemoData.write).toBe(restored);
  });
});
