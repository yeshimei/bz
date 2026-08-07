/**
 * 收藏本 FavoritesAIService 测试（ticket 11）：GitHub 信息获取。
 */
import { describe, it, expect, vi } from 'vitest';
import { FavoritesAIService } from '../../src/favorites/ai';

describe('fetchGitHubInfo', () => {
  it('有效 GitHub URL → AI JSON 结果解析', async () => {
    const ai = { json: vi.fn().mockResolvedValue('{"title":"RepoName","description":"中文简介"}') };
    const svc = new FavoritesAIService();
    svc.ai = ai as any;
    const r = await svc.fetchGitHubInfo('https://github.com/owner/repo');
    expect(r).toEqual({ title: 'RepoName', description: '中文简介' });
    // 提示词包含 owner/repo
    expect(ai.json.mock.calls[0][0]).toContain('owner/repo');
  });

  it('AI reject → 降级 title=repo、简介空', async () => {
    const ai = { json: vi.fn().mockRejectedValue(new Error('boom')) };
    const svc = new FavoritesAIService();
    svc.ai = ai as any;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await svc.fetchGitHubInfo('https://github.com/abc/def');
    expect(r).toEqual({ title: 'def', description: '' });
    warn.mockRestore();
  });

  it('非 GitHub URL → 抛「无效的 GitHub 地址」', async () => {
    const svc = new FavoritesAIService();
    svc.ai = null;
    await expect(svc.fetchGitHubInfo('https://example.com/x')).rejects.toThrow('无效的 GitHub 地址');
  });
});
