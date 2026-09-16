// @vitest-environment node
/**
 * 收藏本 FavoritesAIService 测试（ticket 11）：GitHub 信息获取（增强：真实 GitHub API）。
 * ticket 23：isAvailable 真实读取插件 AI 配置。issue 334/ADR-0148：判定单源 core
 * getAIProvider（含 QuickAdd data.json 异步兜底），不再本地复刻第二套口径。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FavoritesAIService } from '../../src/favorites/ai';
import { requestUrl } from '../mock-obsidian-entry';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setApp } from '../../src/core/app';

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

describe('isAvailable（issue 334/ADR-0148：判定单源 core getAIProvider）', () => {
  afterEach(() => {
    // 避免残留设置影响同文件后续用例（保持 provider 已注入）
    setAISettingsProvider(() => ({ aiProvider: 'opencode-go', opencodeGoApiKey: 'sk-x' }) as any);
    resetAIProviderCache();
  });

  it('未配置任何 key → false', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'opencode-go', opencodeGoApiKey: '' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(false);
  });

  it('opencode-go（默认 provider）配 key → true', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'opencode-go', opencodeGoApiKey: 'sk-o' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(true);
  });

  it('provider 未显式设置 → 按默认 opencode-go 口径判定', async () => {
    setAISettingsProvider(() => ({ opencodeGoApiKey: 'sk-o' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(true);
  });

  it('deepseek 配 key → true', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-d' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(true);
  });

  it('deepseek 缺 key 且无 QuickAdd 兜底 → false（旧同步版恒真口径废除）', async () => {
    setApp({ vault: { adapter: { read: async () => { throw new Error('no quickadd'); } } } } as any);
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(false);
  });

  it('deepseek 缺 key → QuickAdd data.json 有配置则 true（legacy 兜底真实生效）', async () => {
    setApp({
      vault: {
        adapter: {
          read: async () => JSON.stringify({ ai: { providers: [{ endpoint: 'https://api.deepseek.com', apiKey: 'sk-legacy' }] } }),
        },
      },
    } as any);
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: '' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(true);
  });

  it('opencode-go 缺 key 时 deepseek key 不顶替（provider 独立判定）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'opencode-go', opencodeGoApiKey: '', deepseekApiKey: 'sk-d' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(false);
  });

  it('注册表提供商（ticket 171）：openai/gemini 等配对应 key → true；缺 key → false', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'openai', openaiApiKey: 'sk-oa' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(true);
    setAISettingsProvider(() => ({ aiProvider: 'openai', openaiApiKey: '' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(false);
    setAISettingsProvider(() => ({ aiProvider: 'google', googleApiKey: 'sk-g' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(true);
    setAISettingsProvider(() => ({ aiProvider: 'google', googleApiKey: '' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(false);
  });

  it('注册表提供商密钥互不顶替（选 openai 时其他家的 key 无效）', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'openai', openaiApiKey: '', anthropicApiKey: 'sk-an' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(false);
  });

  it('custom：endpoint + key 齐全 → true，缺一 → false', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'custom', aiCustomEndpoint: 'https://x.example/v1', aiCustomApiKey: 'sk-c' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(true);
    setAISettingsProvider(() => ({ aiProvider: 'custom', aiCustomEndpoint: '', aiCustomApiKey: 'sk-c' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(false);
  });

  it('ollama（本地）无需密钥 → 恒 true', async () => {
    setAISettingsProvider(() => ({ aiProvider: 'ollama', ollamaApiKey: '' }) as any);
    resetAIProviderCache();
    await expect(new FavoritesAIService().isAvailable()).resolves.toBe(true);
  });
});
