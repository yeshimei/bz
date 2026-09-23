/**
 * 收藏本 AI 服务 + 余额查询（ticket 11）：源码 收藏本.js L69-234 逐字。
 */
import { requestUrl } from 'obsidian';
import { withTimeout } from '../core/http';
import { createAI, getAIProvider } from '../core/ai';
import type { AIService } from '../core/ai';
import { normalizeUrl } from './config';

// ==================== AI 服务 ====================
export class FavoritesAIService {
  ai: AIService | null;

  constructor() {
    this.ai = createAI();
  }

  /**
   * AI 是否已配置（ticket 23 + 审查建议 C：真实读取插件 AI 配置，替代恒真的 !!this.ai）。
   * issue 334/ADR-0148 起判定口径单源 core/ai——getAIProvider() 能解析即已配置，
   * 含 deepseek QuickAdd data.json 异步兜底、ollama 免密钥（issue 411/ADR-0179 起注册表只留
   * deepseek / zhipu-plan / ollama 三条通道）；本地不再复刻第二套判定
   * （旧同步版对 deepseek 恒真，口径偏松）。
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

/**
 * AI 整理结果归一（func-5 数据侧收口）：提示词允许「无法判断则原样返回」无协议链接，
 * 若把 AI 原样返回直接回填表单，保存校验（只认 http(s):// 前缀）必拦截——「整理完即可存」
 * 断链。本函数是回填前的唯一归一出口：url 过 normalizeUrl（config 单源，与读侧/打开链路
 * 同口径；空值跳过不产 'https://'），title/description 收敛字符串（非串 String 纠偏），
 * tags 收敛字符串数组（数组元素非串 String 纠偏、空值剔除；单串按单元素收编）。
 * 消费点：ui.runAiFill 解析 AI JSON 后经本函数再回填表单（接线归深审批 B，本批先行
 * 落数据侧与用例）。
 */
export function normalizeAiOrganizeResult(data: {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  tags?: unknown;
}): { title: string; url: string; description: string; tags: string[] } {
  const s = (v: unknown): string =>
    v === undefined || v === null ? '' : typeof v === 'string' ? v : String(v);
  const url = s(data.url).trim();
  const tags = Array.isArray(data.tags)
    ? data.tags.map((t) => s(t)).filter((t) => t !== '')
    : data.tags
      ? [s(data.tags)]
      : [];
  return {
    title: s(data.title),
    url: url ? normalizeUrl(url) : '',
    description: s(data.description),
    tags,
  };
}
