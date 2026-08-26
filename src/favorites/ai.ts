/**
 * 收藏本 AI 服务 + 余额查询（ticket 11）：源码 收藏本.js L69-234 逐字。
 */
import { requestUrl } from 'obsidian';
import { createAI } from '../core/ai';
import type { AIService } from '../core/ai';
import { getSettings } from '../core/settings-provider';
import type { FavoritesItem } from './types';

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
   *   插件设置缺 key 不判死——交给运行时兜底，避免误拦仅 QuickAdd data.json 配置的老用户。
   */
  isAvailable(): boolean {
    if (!this.ai) return false;
    const s = getSettings();
    const provider = s.aiProvider || 'opencode-go';
    return provider === 'opencode-go' ? !!s.opencodeGoApiKey : true;
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

// ==================== 余额查询服务 ====================
interface BalanceResult {
  balance: string;
  timestamp: number;
}

export class BalanceService {
  CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  // 检查缓存是否有效
  isCacheValid(cacheTime: number | null | undefined): boolean {
    if (!cacheTime) return false;
    return Date.now() - cacheTime < this.CACHE_DURATION;
  }

  // 查询余额
  async fetchBalance(llmConfig: { apiKeys: string; balanceUrl: string }): Promise<BalanceResult> {
    const { apiKeys, balanceUrl } = llmConfig;

    if (!apiKeys || !balanceUrl) {
      throw new Error('配置不完整');
    }

    // 取第一个Key
    const firstKey = apiKeys.split('\n').find((k) => k.trim());
    if (!firstKey) {
      throw new Error('API Key为空');
    }

    if (!balanceUrl) {
      throw new Error('余额查询URL为空');
    }

    try {
      const response = await fetch(balanceUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${firstKey.trim()}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(3000), // 3秒超时
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // 自动从对象中查找数字字段
      const balance = this.findNumberInObject(data);
      if (balance === null) {
        throw new Error('未找到余额数字');
      }

      return {
        balance: String(balance),
        timestamp: Date.now(),
      };
    } catch (error: any) {
      throw new Error(error.message || '查询失败');
    }
  }

  // 从对象中递归查找第一个数字值
  findNumberInObject(obj: any, depth = 0): number | null {
    if (depth > 5 || obj === null || obj === undefined) {
      return null;
    }

    // 如果是数字，直接返回
    if (typeof obj === 'number') {
      return obj;
    }

    // 如果是字符串，尝试转换
    if (typeof obj === 'string') {
      const num = parseFloat(obj);
      if (!isNaN(num) && isFinite(num)) {
        return num;
      }
      return null;
    }

    // 如果是对象，递归查找
    if (typeof obj === 'object') {
      // 优先查找常见的余额字段名
      const balanceKeys = [
        'balance', 'available_balance', 'total_balance',
        'credits', 'quota', 'amount', 'remaining',
        'total_usage', 'used',
      ];
      for (const key of balanceKeys) {
        if (obj[key] !== undefined) {
          const result = this.findNumberInObject(obj[key], depth + 1);
          if (result !== null) {
            return result;
          }
        }
      }

      // 如果没找到，遍历所有字段
      for (const key of Object.keys(obj)) {
        const result = this.findNumberInObject(obj[key], depth + 1);
        if (result !== null) {
          return result;
        }
      }
    }

    return null;
  }

  // 批量查询余额
  async fetchAllBalances(items: FavoritesItem[]): Promise<Record<string, { balance?: string; timestamp?: number; cached: boolean; error?: string }>> {
    const results: Record<string, any> = {};

    // 并发查询所有大模型条目
    const promises = items
      .filter((item) => item.llmConfig && item.llmConfig.apiKeys)
      .map(async (item) => {
        try {
          // 检查缓存
          if (item.balance && this.isCacheValid(item.balanceCacheTime)) {
            results[item.id] = { balance: item.balance, cached: true };
            return;
          }

          const result = await this.fetchBalance(item.llmConfig!);
          results[item.id] = { ...result, cached: false };
        } catch (error: any) {
          results[item.id] = { error: error.message, cached: false };
        }
      });

    await Promise.all(promises);
    return results;
  }
}
