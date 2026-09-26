// @vitest-environment jsdom
/**
 * 启动编排测试（ADR-0199 决策 5）：`scheduleSelfUpdateCheck` 的 `after` 回调
 * **必须**在自更新巡检跑完之后执行——皮肤包的版本区间校验吃的是 `manifest.json`
 * 的版本号，而自更新会覆写它。两件事并发 = 「按旧版本校验通过 → 插件随即更新 →
 * 皮肤当场变不兼容」，且全程静默（没有任何报错可循）。
 *
 * 这里只钉顺序与静默两条不变式，不测自更新本身。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { scheduleSelfUpdateCheck } from '../../src/core/self-update';

/** 自更新巡检的启动延迟（= self-update.ts::CHECK_DELAY_MS） */
const DELAY_MS = 15 * 1000;

/** 装了插件（有 manifest.json 版本号）的 app——否则 checkSelfUpdate 在读版本前就早退 */
function appWithPlugin(): { vault: MockVault } {
  const vault = new MockVault();
  vault.files.set('.obsidian/plugins/bz/manifest.json', JSON.stringify({ id: 'bz', version: '1.0.0' }));
  return { vault };
}

beforeEach(() => {
  resetObsidianMocks();
  vi.mocked(requestUrl).mockReset();
  vi.useFakeTimers();
  try {
    localStorage.clear(); // 24h 节流时间戳别跨用例残留
  } catch {
    /* 无 localStorage 也不太可能——jsdom 里有 */
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe('scheduleSelfUpdateCheck 的 after 编排', () => {
  it('延迟未到不触发；到点后先自更新、后 after（严格串行）', async () => {
    const order: string[] = [];
    vi.mocked(requestUrl).mockImplementation((async () => {
      // fetchViaBases 会依次试两个源，同一阶段只记一次
      if (!order.includes('self-update')) order.push('self-update');
      throw new Error('offline'); // 巡检失败也算「跑完」
    }) as never);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    scheduleSelfUpdateCheck(
      () => appWithPlugin(),
      () => false,
      () => {
        order.push('after');
      },
    );

    await vi.advanceTimersByTimeAsync(DELAY_MS - 1);
    expect(order, '15 秒前不该有任何动作').toEqual([]);

    await vi.advanceTimersByTimeAsync(2);
    expect(order, 'after 必须排在自更新之后').toEqual(['self-update', 'after']);
    warn.mockRestore();
  });

  it('after 自身抛错也静默（启动维护不该弹脸）', async () => {
    vi.mocked(requestUrl).mockImplementation((async () => {
      throw new Error('offline');
    }) as never);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let ran = false;

    scheduleSelfUpdateCheck(
      () => appWithPlugin(),
      () => false,
      () => {
        ran = true;
        throw new Error('boom');
      },
    );

    await vi.advanceTimersByTimeAsync(DELAY_MS + 1);
    expect(ran).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('插件已卸载 → 自更新与 after 都不跑', async () => {
    const order: string[] = [];
    vi.mocked(requestUrl).mockImplementation((async () => {
      if (!order.includes('self-update')) order.push('self-update');
      return { status: 200, text: '{}' } as never;
    }) as never);

    scheduleSelfUpdateCheck(
      () => appWithPlugin(),
      () => true, // 已卸载
      () => {
        order.push('after');
      },
    );

    await vi.advanceTimersByTimeAsync(DELAY_MS + 1);
    expect(order).toEqual([]);
  });
});
