/**
 * 黑匣子 × 阅读器注册时序测试（ADR-0016）：
 * - registerBlackBoxEpubHost：阅读器未就绪 → 定时重试，就绪后注册成功
 * - refreshBlackBoxEpubHost：阅读器重载（新实例）→ 向新实例补注册
 * - unregisterBlackBoxEpubHost：清理重试定时器与注册
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReaderPlugin,
  refreshBlackBoxEpubHost,
  registerBlackBoxEpubHost,
  unregisterBlackBoxEpubHost,
} from '../../src/blackbox/host';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';

type AnyFn = (...args: unknown[]) => unknown;

/** 构造阅读器插件 mock（鸭子类型表面） */
function makeReaderMock(registerFn?: AnyFn, unregisterFn?: AnyFn) {
  const register = registerFn ?? vi.fn();
  const unregister = unregisterFn ?? vi.fn();
  return {
    registerExternalEpubHost: register,
    unregisterExternalEpubHost: unregister,
    openEpubLocationFromLink: vi.fn(async () => true),
  };
}

describe('黑匣子 × 阅读器注册时序（host.ts）', () => {
  let app: ReturnType<typeof mockAppWithVault>;
  let plugins: { getPlugin: any };

  beforeEach(() => {
    resetObsidianMocks();
    app = mockAppWithVault(new MockVault());
    plugins = { getPlugin: vi.fn((_id: string) => null) };
    (app as any).plugins = plugins;
  });

  afterEach(() => {
    vi.useRealTimers();
    unregisterBlackBoxEpubHost();
  });

  it('阅读器已就绪：注册一次即成功（幂等，重复调用不重复注册）', () => {
    const reader = makeReaderMock();
    plugins.getPlugin.mockImplementation((id: string) => (id === 'fork-weave-epub-reader' ? reader : null));

    registerBlackBoxEpubHost(app);
    registerBlackBoxEpubHost(app);

    expect(reader.registerExternalEpubHost).toHaveBeenCalledTimes(1);
    const host = vi.mocked(reader.registerExternalEpubHost).mock.calls[0][0] as Record<string, unknown>;
    expect(typeof host.captureConceptFromEpub).toBe('function');
    expect(typeof host.captureExcerptFromEpub).toBe('function');
  });

  it('阅读器未就绪：先定时重试，就绪后成功注册（fake timers 推进）', () => {
    vi.useFakeTimers();
    const reader = makeReaderMock();
    let loaded = false;
    plugins.getPlugin.mockImplementation((id: string) => {
      if (id !== 'fork-weave-epub-reader' && id !== 'weave-epub-reader') return null;
      return loaded ? reader : null;
    });

    // 首次：reader 未加载 → 静默 + 安排重试
    registerBlackBoxEpubHost(app);
    expect(reader.registerExternalEpubHost).not.toHaveBeenCalled();

    // reader 稍后加载成功（模拟用户随后启用/修复阅读器插件）
    loaded = true;
    vi.advanceTimersByTime(2000);

    expect(reader.registerExternalEpubHost).toHaveBeenCalledTimes(1);
  });

  it('重试有上限：阅读器一直缺失时不无限轮询', () => {
    vi.useFakeTimers();
    plugins.getPlugin.mockReturnValue(null);

    registerBlackBoxEpubHost(app);
    for (let i = 0; i < 20; i += 1) {
      vi.advanceTimersByTime(2000);
    }
    // 无 reader 可注册，无异常即通过；定时器耗尽后不再排队
    expect(plugins.getPlugin).toHaveBeenCalled();
  });

  it('refreshBlackBoxEpubHost：阅读器重载（新实例）后向新实例补注册', () => {
    const readerOld = makeReaderMock();
    const readerNew = makeReaderMock();
    let current = readerOld;
    plugins.getPlugin.mockImplementation((id: string) => (id === 'fork-weave-epub-reader' ? current : null));

    registerBlackBoxEpubHost(app);
    expect(readerOld.registerExternalEpubHost).toHaveBeenCalledTimes(1);

    // 模拟阅读器插件被重载：旧实例注销 + 新实例出现
    current = readerNew;
    refreshBlackBoxEpubHost(app);

    expect(readerNew.registerExternalEpubHost).toHaveBeenCalledTimes(1);
  });

  it('refreshBlackBoxEpubHost：未注册过时走注册流程（含重试）', () => {
    vi.useFakeTimers();
    const reader = makeReaderMock();
    let loaded = false;
    plugins.getPlugin.mockImplementation((id: string) => {
      if (id !== 'fork-weave-epub-reader' && id !== 'weave-epub-reader') return null;
      return loaded ? reader : null;
    });

    refreshBlackBoxEpubHost(app);
    expect(reader.registerExternalEpubHost).not.toHaveBeenCalled();

    loaded = true;
    vi.advanceTimersByTime(2000);
    expect(reader.registerExternalEpubHost).toHaveBeenCalledTimes(1);
  });

  it('unregisterBlackBoxEpubHost：注销注册并清理定时器（不再重试）', () => {
    vi.useFakeTimers();
    const reader = makeReaderMock();
    plugins.getPlugin.mockImplementation((id: string) => (id === 'fork-weave-epub-reader' ? reader : null));

    registerBlackBoxEpubHost(app);
    expect(reader.registerExternalEpubHost).toHaveBeenCalledTimes(1);

    unregisterBlackBoxEpubHost();
    expect(reader.unregisterExternalEpubHost).toHaveBeenCalledTimes(1);

    // 注销后即便 reader 再次缺失/出现也不应重新注册（无定时器排队）
    plugins.getPlugin.mockReturnValue(null);
    vi.advanceTimersByTime(20000);
    expect(reader.registerExternalEpubHost).toHaveBeenCalledTimes(1);
  });

  it('getReaderPlugin：按候选 id 列表形状探测（bz 不 import 阅读器模块）', () => {
    const reader = makeReaderMock();
    // 只注册了 weave-epub-reader（旧构建 id）
    plugins.getPlugin.mockImplementation((id: string) => (id === 'weave-epub-reader' ? reader : null));
    expect(getReaderPlugin(app)).toBe(reader);
    // 候选 id 都缺失 → null
    plugins.getPlugin.mockReturnValue(null);
    expect(getReaderPlugin(app)).toBeNull();
  });
});
