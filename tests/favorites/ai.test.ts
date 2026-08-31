// @vitest-environment node
/**
 * 收藏本 FavoritesAIService 测试（ticket 11）：GitHub 信息获取（增强：真实 GitHub API）。
 * ticket 23：isAvailable 真实读取插件 AI 配置（core/ai 判定口径）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FavoritesAIService } from '../../src/favorites/ai';
import { requestUrl } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';

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

describe('isAvailable（ticket 23：真实读取插件 AI 配置，替代恒真 !!this.ai）', () => {
  afterEach(() => {
    // 避免残留设置影响同文件后续用例（保持 provider 已注入，getSettings 不抛）
    setSettingsProvider(() => ({ aiProvider: 'opencode-go', opencodeGoApiKey: 'sk-x' }) as any);
  });

  it('未配置任何 key → false', () => {
    setSettingsProvider(() => ({ aiProvider: 'opencode-go', opencodeGoApiKey: '' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(false);
  });

  it('opencode-go（默认 provider）配 key → true', () => {
    setSettingsProvider(() => ({ aiProvider: 'opencode-go', opencodeGoApiKey: 'sk-o' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(true);
  });

  it('provider 未显式设置 → 按默认 opencode-go 口径判定', () => {
    setSettingsProvider(() => ({ opencodeGoApiKey: 'sk-o' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(true);
  });

  it('deepseek 配 key → true', () => {
    setSettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-d' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(true);
  });

  it('deepseek 缺 key → 不判死（true）：legacy quickadd data.json 兜底交由 getAIProvider 运行时判定（审查建议 C）', () => {
    setSettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(true);
  });

  it('opencode-go 缺 key 时 deepseek key 不顶替（provider 独立判定）', () => {
    setSettingsProvider(() => ({ aiProvider: 'opencode-go', opencodeGoApiKey: '', deepseekApiKey: 'sk-d' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(false);
  });

  it('注册表提供商（ticket 171）：openai/gemini 等配对应 key → true；缺 key → false', () => {
    setSettingsProvider(() => ({ aiProvider: 'openai', openaiApiKey: 'sk-oa' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(true);
    setSettingsProvider(() => ({ aiProvider: 'openai', openaiApiKey: '' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(false);
    setSettingsProvider(() => ({ aiProvider: 'google', googleApiKey: 'sk-g' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(true);
    setSettingsProvider(() => ({ aiProvider: 'google', googleApiKey: '' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(false);
  });

  it('注册表提供商密钥互不顶替（选 openai 时其他家的 key 无效）', () => {
    setSettingsProvider(() => ({ aiProvider: 'openai', openaiApiKey: '', anthropicApiKey: 'sk-an' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(false);
  });

  it('ollama（本地）无需密钥 → 恒 true', () => {
    setSettingsProvider(() => ({ aiProvider: 'ollama', ollamaApiKey: '' }) as any);
    expect(new FavoritesAIService().isAvailable()).toBe(true);
  });
});
