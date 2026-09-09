/**
 * 收藏本 AI 服务 + 余额查询（ticket 11）：源码 收藏本.js L69-234 逐字。
 */
import { requestUrl } from 'obsidian';
import { createAI, getProviderDescriptor } from '../core/ai';
import type { AIService } from '../core/ai';
import { getSettings } from '../core/settings-provider';

// ==================== AI 服务 ====================
export class FavoritesAIService {
  ai: AIService | null;

  constructor() {
    this.ai = createAI();
  }

  /**
   * AI 是否已配置（ticket 23 + 审查建议 C：真实读取插件 AI 配置，替代恒真的 !!this.ai）。
   * 判定口径与 core/ai.ts getAIProvider 一致：provider = aiProvider || 'opencode-go'；
   * - opencode-go 无 legacy 兜底：缺 opencodeGoApiKey 即拦截；
   * - deepseek 的 quickadd data.json 兜底是异步文件读取（core/ai getAIProvider 运行时判定），
   *   插件设置缺 key 不判死——交给运行时兜底，避免误拦仅 QuickAdd data.json 配置的老用户；
   * - 其余注册表提供商（ticket 171）：缺 apiKeyKey 对应键即拦截（ollama 本地服务无密钥豁免）；
   * - custom（ticket 170）：需 endpoint + key 齐全才算已配置。
   */
  isAvailable(): boolean {
    if (!this.ai) return false;
    const s = getSettings() as any;
    const provider = s.aiProvider || 'opencode-go';
    if (provider === 'opencode-go') return !!s.opencodeGoApiKey;
    if (provider === 'custom') return !!s.aiCustomEndpoint && !!s.aiCustomApiKey;
    if (provider === 'ollama') return true; // 本地服务无需密钥
    const desc = getProviderDescriptor(provider);
    // 注册表提供商：缺对应密钥键即拦截；deepseek 缺 key 不判死（运行时 QuickAdd 兜底）
    if (provider === 'deepseek') return true;
    return !!s[desc.apiKeyKey];
  }

  /**
   * 获取 GitHub 仓库信息（真实 API，增强：原稿为纯 AI 生成，现改为
   * https://api.github.com/repos/{owner}/{repo} 取仓库名与简介原文）。
   * 返回 {title, description, fetched}：fetched=false 表示请求失败/限流
   * （此时 description 恒为空串，调用方不得让 AI 编造简介）；
   * 非 GitHub 地址抛「无效的 GitHub 地址」。8s 超时 + 重试 1 次（api.github.com 网络不稳）。
   */
  async fetchGitHubInfo(url: string): Promise<{ title: string; description: string; fetched: boolean }> {
    const match = url.match(/github\.com\/([^\/?#]+)\/([^\/?#]+)/);
    if (!match) throw new Error('无效的 GitHub 地址');
    const [, owner, repo] = match;

    let title = repo;
    let description = '';
    let fetched = false;
    for (let attempt = 0; attempt < 2 && !fetched; attempt++) {
      try {
        const resp: any = await this._requestUrlWithTimeout(
          {
            url: `https://api.github.com/repos/${owner}/${repo}`,
            method: 'GET',
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'obsidian-bz' },
          },
          8000
        );
        if (resp.status && resp.status >= 400) throw new Error(`HTTP ${resp.status}`);
        const data = JSON.parse(resp.text || '{}');
        title = data.name || repo;
        description = String(data.description || '').trim();
        fetched = true;
      } catch (e) {
        if (attempt === 1) console.warn('GitHub API 获取失败，使用降级方案', e);
      }
    }
    return { title, description, fetched };
  }

  /** requestUrl 包超时（避免 api.github.com 长时间挂起） */
  private _requestUrlWithTimeout(opts: any, timeoutMs: number): Promise<any> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('GitHub API 请求超时')), timeoutMs);
    });
    return Promise.race([requestUrl(opts), timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }
}
