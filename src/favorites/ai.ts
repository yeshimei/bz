/**
 * 收藏本 AI 服务 + 余额查询（ticket 11）：源码 收藏本.js L69-234 逐字。
 */
import { createAI } from '../core/ai';
import type { AIService } from '../core/ai';
import type { FavoritesItem } from './types';

// ==================== AI 服务 ====================
export class FavoritesAIService {
  ai: AIService | null;

  constructor() {
    this.ai = createAI();
  }

  isAvailable(): boolean {
    return !!this.ai;
  }

  async fetchGitHubInfo(url: string): Promise<{ title: string; description: string }> {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error('无效的 GitHub 地址');
    const [, owner, repo] = match;

    let title = repo;
    let description = '';

    if (this.ai) {
      const prompt = `你是一个项目介绍助手。根据 GitHub 仓库 ${owner}/${repo}，生成一个简洁的项目标题（直接使用仓库名 ${repo}）和一段中文简介（不超过 50 字，概括项目用途）。返回 JSON 格式：{"title":"...", "description":"..."}`;
      try {
        const result = await this.ai.json(prompt);
        const parsed = JSON.parse(result);
        title = parsed.title || repo;
        description = parsed.description || '';
      } catch (e) {
        console.warn('AI 生成失败，使用降级方案', e);
      }
    }
    return { title, description };
  }
}

// ==================== 余额查询服务 ====================
export interface BalanceResult {
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
