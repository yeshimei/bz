/**
 * 收藏本 AI 服务 + 余额查询（ticket 11）：源码 收藏本.js L69-234 逐字。
 */
import { requestUrl } from 'obsidian';
import { withTimeout } from '../core/http';
import { createAI, getAIProvider } from '../core/ai';
import type { AIService } from '../core/ai';

// ==================== AI 服务 ====================
export class FavoritesAIService {
  ai: AIService | null;

  constructor() {
    this.ai = createAI();
  }

  /**
   * AI 是否已配置（ticket 23 + 审查建议 C：真实读取插件 AI 配置，替代恒真的 !!this.ai）。
   * issue 334/ADR-0148 起判定口径单源 core/ai——getAIProvider() 能解析即已配置，
   * 含 deepseek QuickAdd data.json 异步兜底、ollama 免密钥、custom 三件套齐全；
   * 本地不再复刻第二套判定（旧同步版对 deepseek 恒真，口径偏松）。
   */
  async isAvailable(): Promise<boolean> {
    if (!this.ai) return false;
    try {
      await getAIProvider();
      return true;
    } catch {
      return false;
    }
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
        // 8s 超时（withTimeout，core/http 单源，issue 365）：api.github.com 网络不稳，
        // 超时/请求失败同样进 catch → 重试 1 次 → 降级
        const resp: any = await withTimeout(
          requestUrl({
            url: `https://api.github.com/repos/${owner}/${repo}`,
            method: 'GET',
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'obsidian-bz' },
          }),
          8000,
          'GitHub API',
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
}
