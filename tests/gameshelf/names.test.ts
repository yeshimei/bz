/**
 * 中文名回填队列测试（names.ts）：
 * 串行拉取、已有中文名不入队（幂等）、写回 frontmatter、连错到上限即停。
 * 队列的落盘只经 fileManager.processFrontMatter（upsertDetail），故假 App 只需记录写入。
 * 用 jsdom（vitest 默认环境）：熔断现在会弹人话通知（S2），node 环境没有 document。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { ZH_NAME_MAX_FAILURES, ensureZhNames, resetZhNameNoLocale, setZhNameInterval, unloadZhNames } from '../../src/gameshelf/names';
import type { GameItem } from '../../src/gameshelf/state';

function item(appid: number, name: string, zhName: string | null = null, file: unknown = null): GameItem {
  return {
    file: file as never, appid, name, zhName, playtimeMin: 0, lastPlayed: '',
    cover: null, coverSrc: null, icon: null, iconSrc: null,
    windowsMin: 0, deckMin: 0, macMin: 0, linuxMin: 0, hasAch: false, offShelf: false, syncedAt: null,
  };
}

/** 记录 frontmatter 写入的假 App（不碰 vault：upsertDetail 只走 processFrontMatter） */
function recorder(sink: Record<string, unknown>[]): never {
  return {
    fileManager: {
      processFrontMatter: async (_f: unknown, cb: (fm: Record<string, unknown>) => void) => {
        const fm: Record<string, unknown> = {};
        cb(fm);
        sink.push(fm);
      },
    },
  } as never;
}

/** appdetails filters=basic 的罐头形状 */
const okReply = (name: string) => ({ status: 200, json: [{ success: true, data: { name } }], text: '{}' });

beforeEach(() => {
  resetObsidianMocks();
  (requestUrl as any).mockReset(); // 调用计数必须逐例清零（否则断言数会攒上一条用例的调用）
  resetZhNameNoLocale(); // 会话级负缓存跨用例残留会让同 appid 的用例被跳过（F7）
  setZhNameInterval(0);
  unloadZhNames();
});

describe('中文名回填队列', () => {
  it('缺中文名的入队 → 拉取 → 更新内存 + 写回 frontmatter', async () => {
    const written: Record<string, unknown>[] = [];
    (requestUrl as any).mockImplementation(async () => okReply('深岩银河'));
    const it0 = item(548430, 'Deep Rock Galactic', null, { path: 'p' });
    ensureZhNames(recorder(written), [it0]);
    await vi.waitFor(() => expect(it0.zhName).toBe('深岩银河'));
    expect(written).toEqual([{ 中文名: '深岩银河' }]);
    expect(String((requestUrl as any).mock.calls[0][0].url)).toContain('filters=basic');
  });

  it('已有中文名不入队；重复调用幂等（同一条只请求一次）', async () => {
    (requestUrl as any).mockImplementation(async () => okReply('小丑牌'));
    const a = item(1, 'Balatro', '小丑牌');
    const b = item(2, 'Hades', null);
    const app = recorder([]);
    ensureZhNames(app, [a, b]);
    ensureZhNames(app, [a, b]);
    await vi.waitFor(() => expect(b.zhName).toBe('小丑牌'));
    expect((requestUrl as any).mock.calls.length).toBe(1);
    expect(String((requestUrl as any).mock.calls[0][0].url)).toContain('appids=2');
  });

  it('连续失败到上限即停（不把队列跑成雪崩）', async () => {
    // parseZhName 在空数组上返回 null → 每条都算失败
    (requestUrl as any).mockImplementation(async () => ({ status: 200, json: [], text: '[]' }));
    const list = [1, 2, 3, 4, 5, 6].map((n) => item(n, 'G' + n));
    ensureZhNames(recorder([]), list);
    await vi.waitFor(() => expect((requestUrl as any).mock.calls.length).toBe(ZH_NAME_MAX_FAILURES));
    await new Promise((r) => setTimeout(r, 30));
    expect((requestUrl as any).mock.calls.length).toBe(ZH_NAME_MAX_FAILURES);
    expect(list.every((g) => g.zhName === null)).toBe(true);
  });

  it('网络异常也计入失败上限（requestUrl 抛错不炸测试）', async () => {
    (requestUrl as any).mockImplementation(async () => {
      throw new Error('boom');
    });
    const list = [1, 2, 3, 4].map((n) => item(n, 'G' + n));
    ensureZhNames(recorder([]), list);
    await vi.waitFor(() => expect((requestUrl as any).mock.calls.length).toBe(ZH_NAME_MAX_FAILURES));
  });
  it('Steam 没本地化（返回的就是原名）→ 只记内存不写盘，避免英文名污染「中文名」', async () => {
    const sink: Record<string, unknown>[] = [];
    (requestUrl as any).mockImplementation(async (o: { url: string }) => ({
      status: 200,
      // 真实形态：外层键 = appid 字符串
      json: { '7': { success: true, data: { name: 'Bongo Cat' } } },
      text: '',
    }));
    const g = item(7, 'Bongo Cat', null, {} as unknown);
    ensureZhNames(recorder(sink), [g]);
    await vi.waitFor(() => expect(g.zhName).toBe('Bongo Cat')); // 内存记住 → 下次不再请求
    expect(sink.length).toBe(0); // 但笔记属性里不落这条
  });
});
