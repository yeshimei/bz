// @vitest-environment node
/**
 * 收藏本 FavoritesAIService 测试（ticket 11）：GitHub 信息获取（增强：真实 GitHub API）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FavoritesAIService } from '../../src/favorites/ai';
import { requestUrl } from '../mock-obsidian-entry';

describe('fetchGitHubInfo', () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ name: 'helloagents', description: 'An agents playground' }),
    } as any);
  });

  it('有效 GitHub URL → 返回仓库名 + 真实简介', async () => {
    const svc = new FavoritesAIService();
    const r = await svc.fetchGitHubInfo('https://github.com/hellowind777/helloagents');
    expect(r).toEqual({ title: 'helloagents', description: 'An agents playground', fetched: true });
    expect(requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://api.github.com/repos/hellowind777/helloagents' })
    );
  });

  it('无协议头/带尾部斜杠的 GitHub URL 也可解析', async () => {
    const svc = new FavoritesAIService();
    const r = await svc.fetchGitHubInfo('github.com/owner/repo/');
    expect(r).toEqual({ title: 'helloagents', description: 'An agents playground', fetched: true });
    expect(requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://api.github.com/repos/owner/repo' })
    );
  });

  it('API 请求失败 → 降级 title=repo、简介空、fetched=false', async () => {
    vi.mocked(requestUrl).mockRejectedValue(new Error('网络错误'));
    const svc = new FavoritesAIService();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await svc.fetchGitHubInfo('https://github.com/abc/def');
    expect(r).toEqual({ title: 'def', description: '', fetched: false });
    warn.mockRestore();
  });

  it('首次请求失败 → 重试成功返回信息', async () => {
    vi.mocked(requestUrl)
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValueOnce({ status: 200, text: JSON.stringify({ name: 'x', description: 'desc' }) } as any);
    const svc = new FavoritesAIService();
    const r = await svc.fetchGitHubInfo('https://github.com/o/r');
    expect(r).toEqual({ title: 'x', description: 'desc', fetched: true });
    expect(requestUrl).toHaveBeenCalledTimes(2);
  });

  it('返回数据缺 name/description → 仓库名兜底', async () => {
    vi.mocked(requestUrl).mockResolvedValue({ status: 200, text: '{}' } as any);
    const svc = new FavoritesAIService();
    const r = await svc.fetchGitHubInfo('https://github.com/a/b');
    expect(r).toEqual({ title: 'b', description: '', fetched: true });
  });

  it('非 GitHub URL → 抛「无效的 GitHub 地址」', async () => {
    const svc = new FavoritesAIService();
    svc.ai = null;
    await expect(svc.fetchGitHubInfo('https://example.com/x')).rejects.toThrow('无效的 GitHub 地址');
    expect(requestUrl).not.toHaveBeenCalled();
  });
});
