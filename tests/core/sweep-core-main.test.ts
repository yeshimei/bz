/**
 * main.ts / settings.ts 共享基座修复批回归（C13/C15/C16）：
 * - C13 onLayoutReady 回调随卸载旗标短路——启动窗口期内禁用插件后布局就绪不再幽灵初始化
 *   （备忘录自动弹出/剪藏摘要/复习监听/番茄钟/小橘的 ensure* 全部有卸载路径）；
 * - C15 saveSettings promise 链串行化——并发调用排队写 data.json，不再并发 saveData；
 * - C16 旧 todo* 设置键迁移发生时调度落盘（migrateMemoSettingKeys 返回迁移发生与否）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ensure* 全部替换为 spy：C13 断言「调用/未调用」，且避免真实初始化副作用
vi.mock('../../src/memo', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ensureMemoReminders: vi.fn(),
  ensureFileSync: vi.fn(),
}));
vi.mock('../../src/auto-summary', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ensureAutoSummary: vi.fn(),
}));
vi.mock('../../src/review', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ensureReview: vi.fn(),
}));
vi.mock('../../src/pomodoro', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ensurePomodoro: vi.fn(),
}));
vi.mock('../../src/smartcat', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ensureSmartCat: vi.fn(),
}));
// 第二大脑自 2026-09-12 起启动即加载（secondBrainEnabled 开关退役）→ 必须 spy 掉真实初始化
// （原测试靠传 secondBrainEnabled: false 规避，键删后改为 mock）
vi.mock('../../src/secondbrain', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ensureSecondBrain: vi.fn(),
}));

import BzPlugin, { applyDiarySettingsToRuntime } from '../../src/main';
import { migrateMemoSettingKeys } from '../../src/settings';
import { MockVault } from '../mock-vault';
import { ensureMemoReminders, ensureFileSync } from '../../src/memo';
import { ensureAutoSummary } from '../../src/auto-summary';
import { ensureReview } from '../../src/review';
import { ensurePomodoro } from '../../src/pomodoro';
import { ensureSmartCat } from '../../src/smartcat';

/** mock app：onLayoutReady 捕获回调（供测试手动触发「布局就绪」） */
function makeApp() {
  const state: { layoutReadyCb: (() => void) | null } = { layoutReadyCb: null };
  const app = {
    vault: new MockVault(),
    workspace: {
      onLayoutReady: (cb: () => void) => {
        state.layoutReadyCb = cb;
      },
      getActiveFile: () => null,
      getActiveViewOfType: () => null,
      activeEditor: null,
      on: () => ({ ref: 'ref' }),
    },
    commands: {
      addCommand: () => {},
      removeCommand: () => {},
      listCommands: () => [],
      executeCommandById: () => {},
    },
    metadataCache: { getFileCache: () => null, getBacklinksForFile: () => null, on: () => ({ ref: 'ref' }) },
    fileManager: { processFrontMatter: () => Promise.resolve() },
  };
  return { app, state };
}

async function createPlugin(loadData: unknown, saveDataImpl?: (data: any) => Promise<void>) {
  const { app, state } = makeApp();
  const plugin: any = new BzPlugin(app as any, {} as any);
  plugin.app = app;
  plugin.loadData = async () => loadData;
  plugin.saveData = saveDataImpl ?? (async () => {});
  await plugin.onload();
  return { plugin, state };
}

function clearEnsureSpies(): void {
  [ensureMemoReminders, ensureFileSync, ensureAutoSummary, ensureReview, ensurePomodoro, ensureSmartCat].forEach(
    (fn) => vi.mocked(fn).mockClear()
  );
}

beforeEach(() => {
  document.body.innerHTML = '';
  clearEnsureSpies();
});

// 注：三条用例原以 `secondBrainEnabled: false` 规避第二大脑真实初始化；该键已退役、
// 启动改为无条件加载（2026-09-12），故改为 spy ensureSecondBrain 后传空设置。
describe('C13：onLayoutReady 回调随卸载旗标短路', () => {
  it('未卸载时布局就绪正常触发 ensure*（接线通的对照）', async () => {
    const { state } = await createPlugin({});
    expect(state.layoutReadyCb).not.toBeNull();
    state.layoutReadyCb!();
    expect(ensureMemoReminders).toHaveBeenCalledTimes(1);
    expect(ensurePomodoro).toHaveBeenCalledTimes(1);
  });

  it('卸载后布局就绪回调短路：ensure* 全部不触发（幽灵初始化消除）', async () => {
    const { plugin, state } = await createPlugin({});
    await plugin.onunload();
    clearEnsureSpies();
    state.layoutReadyCb!(); // 插件已禁用后布局才就绪
    expect(ensureMemoReminders).not.toHaveBeenCalled();
    expect(ensureFileSync).not.toHaveBeenCalled();
    expect(ensureAutoSummary).not.toHaveBeenCalled();
    expect(ensureReview).not.toHaveBeenCalled();
    expect(ensurePomodoro).not.toHaveBeenCalled();
    expect(ensureSmartCat).not.toHaveBeenCalled();
  });

  it('未卸载时触发回调后插件卸载：ensure* 已真实初始化（不受旗标影响，回归保护）', async () => {
    const { plugin, state } = await createPlugin({});
    state.layoutReadyCb!();
    expect(ensureMemoReminders).toHaveBeenCalledTimes(1);
    await plugin.onunload();
    expect(ensureMemoReminders).toHaveBeenCalledTimes(1); // 卸载不回溯已发生的初始化
  });
});

describe('C15：saveSettings 串行化', () => {
  it('并发 saveSettings 排队写盘：前一次完成前不发起下一次 saveData', async () => {
    const resolvers: Array<() => void> = [];
    const saveDataSpy = vi.fn(
      () => new Promise<void>((resolve) => resolvers.push(resolve))
    );
    const { plugin } = await createPlugin({}, async () => saveDataSpy());
    const s1 = plugin.saveSettings();
    const s2 = plugin.saveSettings();
    const s3 = plugin.saveSettings();
    // flush 微任务：promise 链启动第一个 saveData（其返回 promise 挂起，后续排队）
    await new Promise((r) => setTimeout(r, 0));
    expect(saveDataSpy).toHaveBeenCalledTimes(1); // 第二/三个在队列中等待

    resolvers[0]!();
    await s1;
    expect(saveDataSpy).toHaveBeenCalledTimes(2);
    resolvers[1]!();
    await s2;
    expect(saveDataSpy).toHaveBeenCalledTimes(3);
    resolvers[2]!();
    await s3;
    expect(saveDataSpy).toHaveBeenCalledTimes(3);
  });

  it('前一次保存失败不断链：后续保存照常执行', async () => {
    let fail = true;
    const saveDataSpy = vi.fn(async () => {
      if (fail) throw new Error('磁盘写失败');
    });
    const { plugin } = await createPlugin({}, async () => saveDataSpy());
    await expect(plugin.saveSettings()).rejects.toThrow('磁盘写失败'); // 错误照常透出给调用方
    fail = false;
    await plugin.saveSettings(); // 队列未被毒化
    expect(saveDataSpy).toHaveBeenCalledTimes(2);
  });
});

describe('C16：设置键迁移落盘', () => {
  it('migrateMemoSettingKeys：旧键存在返回 true（含新键已在）；无旧键返回 false', () => {
    expect(migrateMemoSettingKeys({ todoPanelWidth: 300 })).toBe(true);
    expect(migrateMemoSettingKeys({ todoSkin: 'a', memoSkin: 'a' })).toBe(true); // 新键已在也发生了删旧
    expect(migrateMemoSettingKeys({ memoSkin: 'a' })).toBe(false);
    expect(migrateMemoSettingKeys(null)).toBe(false);
    expect(migrateMemoSettingKeys('x')).toBe(false);
    // 迁移结果：新键继承旧值、旧键删除
    const rec: any = { todoLayout: 'jingwei' };
    migrateMemoSettingKeys(rec);
    expect(rec.memoLayout).toBe('jingwei');
    expect(rec.todoLayout).toBeUndefined();
  });

  it('onload 检测到迁移即调度落盘：data.json 不再残留旧键', async () => {
    const savedPayloads: any[] = [];
    const { plugin } = await createPlugin({ todoPanelWidth: 300, memoSkin: 'dark' }, async (data) => {
      savedPayloads.push(data);
    });
    await vi.waitFor(() => expect(savedPayloads.length).toBeGreaterThan(0));
    const saved = savedPayloads[0];
    expect(saved.todoPanelWidth).toBeUndefined();
    expect(saved.memoPanelWidth).toBe(300);
    expect(saved.memoSkin).toBe('dark');
    void plugin;
  });

  it('无旧键时不触发额外落盘', async () => {
    const saveDataSpy = vi.fn(async () => {});
    await createPlugin({ aiProvider: 'deepseek' }, async () => saveDataSpy());
    // 让微任务队列跑空
    await new Promise((r) => setTimeout(r, 0));
    expect(saveDataSpy).not.toHaveBeenCalled();
  });
});

void applyDiarySettingsToRuntime; // 保持导出面引用（避免 unused 告警）
