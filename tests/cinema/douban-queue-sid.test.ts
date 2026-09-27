// @vitest-environment jsdom
/**
 * 解析缝生产通道测试（issue 498 / ADR-0209）：queryDoubanForPreview 在 **previewFn 未注入**
 * （= 生产形态）下的 sid 直取与回落——评审 P2-3 指出的覆盖缺口：
 *   ①sid 命中：直取 ApiZero，不碰 subject_suggest（三路检索零调用）；
 *   ②sid 直取失败（ApiZero null）→ 自动回落按名三路链，返回检索结果；
 *   ③无 sid：行为与现状一致（直接按名检索）。
 * requestUrl 打桩（queue 的 httpGet 走 requestUrl 通道）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { makeApp } from '../helpers/app';
import { queryDoubanForPreview } from '../../src/cinema/douban-queue';
import { setSettingsProvider } from '../../src/core/settings-provider';

const SUGGEST_JSON = JSON.stringify([
  { title: '三体', id: '26647087', img: 'https://img9.doubanio.com/x.jpg', type: 'tv', url: 'https://movie.douban.com/subject/26647087/?suggest=x', year: '2023' },
]);
const AZ_OK = JSON.stringify({ code: 0, data: { name: '三体', year: '2023', score: '8.7', director: '杨磊', actor: '张鲁一', douban_url: 'https://movie.douban.com/subject/26647087/' } });
const AZ_NULL = JSON.stringify({ code: 5020, msg: '无数据' });

beforeEach(() => {
  resetObsidianMocks();
  // queue 的 deps 从插件设置读 ApiZero Key——生产通道测试必须配上（否则 ApiZero 腿直接跳过）
  setSettingsProvider(() => ({ cinemaApizeroKey: 'sk_test' } as any));
  vi.mocked(requestUrl).mockReset();
});

describe('queryDoubanForPreview 生产通道（previewFn 未注入）', () => {
  it('sid 命中：直取 ApiZero，三路检索零调用', async () => {
    const calls: string[] = [];
    vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
      calls.push(req.url);
      if (req.url.includes('apizero.cn')) return { status: 200, text: AZ_OK } as any;
      throw new Error('不应触达: ' + req.url);
    }) as any);
    const r = await queryDoubanForPreview(makeApp(new MockVault()), '三体', '26647087');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.sid).toBe('26647087');
    expect(calls.some((u) => u.includes('subject_suggest'))).toBe(false);
  });

  it('sid 直取失败（ApiZero 无数据）→ 回落按名三路检索', async () => {
    const calls: string[] = [];
    vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
      calls.push(req.url);
      if (req.url.includes('apizero.cn')) return { status: 200, text: AZ_NULL } as any;
      if (req.url.includes('subject_suggest')) return { status: 200, text: SUGGEST_JSON } as any;
      if (req.url.includes('rexxar')) return { status: 200, text: JSON.stringify({ padding: 'x'.repeat(400), directors: [{ name: '杨磊' }], actors: [{ name: '张鲁一' }] }) } as any;
      throw new Error('unmocked url: ' + req.url);
    }) as any);
    const r = await queryDoubanForPreview(makeApp(new MockVault()), '三体', '26647087');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.sid).toBe('26647087'); // 回落链检索到的同一条
    expect(calls.some((u) => u.includes('subject_suggest'))).toBe(true);
  });

  it('无 sid：直接按名检索（现状语义）', async () => {
    const calls: string[] = [];
    vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
      calls.push(req.url);
      if (req.url.includes('subject_suggest')) return { status: 200, text: SUGGEST_JSON } as any;
      if (req.url.includes('apizero.cn')) return { status: 200, text: AZ_OK } as any;
      throw new Error('unmocked url: ' + req.url);
    }) as any);
    const r = await queryDoubanForPreview(makeApp(new MockVault()), '三体');
    expect(r.ok).toBe(true);
    expect(calls.some((u) => u.includes('subject_suggest'))).toBe(true);
  });
});
