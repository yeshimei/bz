/**
 * 模型档位表（issue 342 / ADR-0151）：按「模型名」解析官方最大输出与上下文窗口。
 *
 * 背景：注册表默认值（AI_PROVIDER_REGISTRY.defaultMaxTokens）是 per-provider 静态常量，
 * 而同一服务商端点下可换任意模型（OpenRouter、Together、Ollama、自定义端点尤甚），
 * 静态值必然对不上「当前这个模型」。本表把「模型名 → 官方档位」独立出来，
 * 供设置面板（providerValue）与 provider 解析（getAIProvider）共用——单一事实源，禁留第二套判定。
 *
 * 解析优先级（ADR-0148「面板独裁」链不动）：设置 per-provider 覆盖 > 本表命中 > 注册表默认。
 * 注：contextWindow 字段是纯参考数据（「上下文窗口」设置行已删——模型固有属性、插件零消费点，
 * issue 342 后续），请求链只消费 maxOutput；未来做输入侧裁剪时从这里取窗口值。
 *
 * 数值口径：一律取「官方公开的最大档」。上限只是封顶、不是目标消耗（ADR-0148 §后果），
 * 正常短输出的成本不变；但**不得超过模型真实上限**——超了会被服务端 400 拒绝，
 * 故未收录的模型宁可回退注册表保守默认，也不猜大数。条目注释里写核实日期与出处，
 * 模型版本变动时同步更新。
 */

/** 模型档位（token 数）：官方最大输出 / 官方上下文窗口 */
export interface ModelLimits {
  maxOutput: number;
  contextWindow: number;
}

/** 表条目：id + 常见别名（同一模型的不同写法，如旧 API 名 / 带 vendor 前缀的快照名） */
interface ModelLimitEntry extends ModelLimits {
  id: string;
  aliases?: string[];
}

/**
 * 模型档位表（按核实日期分组；新增模型在此追加一行）。
 * 只收录「有据可查」的模型：无依据的留给注册表保守默认，勿凭印象填大数。
 */
export const MODEL_LIMITS: ModelLimitEntry[] = [
  // ---- DeepSeek 官方（2026-09-16 核对官方「模型 & 价格」页：上下文 1M / 最大输出 384K，在售模型同档）
  {
    id: 'deepseek-flash',
    aliases: ['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'deepseek-flash-latest', 'deepseek-v4.1-flash'],
    maxOutput: 393216,
    contextWindow: 1048576,
  },
  {
    id: 'deepseek-v4-pro',
    aliases: ['deepseek-pro', 'deepseek-pro-latest'],
    maxOutput: 393216,
    contextWindow: 1048576,
  },
  // ---- 阿里云百炼 Qwen3.7 系（2026-09-16 核对官方帮助中心；qwen-plus / qwen-max 等短名指向当前主力版本）
  { id: 'qwen3.7-plus', aliases: ['qwen-plus'], maxOutput: 131072, contextWindow: 1000000 },
  { id: 'qwen3.7-max', aliases: ['qwen-max'], maxOutput: 65536, contextWindow: 1000000 },
  { id: 'qwen3.7-flash', aliases: ['qwen-flash', 'qwen-turbo'], maxOutput: 16384, contextWindow: 1000000 },
  // ---- 智谱 GLM-5.3 系（2026-09-23 核对官方「核心参数」：最大输出 131072 / 默认 65536 / 上下文 1M）
  { id: 'glm-5.3-flash', aliases: ['glm-5.3-flashx', 'glm-5.3'], maxOutput: 131072, contextWindow: 1000000 },
  // ---- 以下条目沿用注册表既有口径（未二次核对官方文档，数值与注册表默认一致，勿据此调大）
  { id: 'claude-sonnet-4-5', aliases: ['claude-sonnet-4.5'], maxOutput: 64000, contextWindow: 200000 },
  { id: 'gpt-4o-mini', maxOutput: 16384, contextWindow: 128000 },
  { id: 'gemini-2.0-flash', maxOutput: 8192, contextWindow: 1048576 },
  { id: 'kimi-k2-0711-preview', aliases: ['kimi-k2'], maxOutput: 131072, contextWindow: 131072 },
  { id: 'glm-4-flash', maxOutput: 8192, contextWindow: 131072 },
];

/**
 * 归一化模型名：小写、去空白、去 `:tag`（如 `:free`）、去 vendor 前缀（`deepseek-ai/DeepSeek-V3` →
 * `deepseek-v3`）。服务商 /models 返回的 id 写法差异在此抹平，匹配只认归一化后的键。
 */
export function normalizeModelId(model: string): string {
  return String(model || '')
    .trim()
    .toLowerCase()
    .split(':')[0]
    .split('/')
    .pop()!
    .trim();
}

/**
 * 按模型名解析官方档位：精确命中（含别名）优先，其次取「最长命中键」的包含匹配
 * （`deepseek-chat-2026-09` 这类带日期后缀的快照名能落到 `deepseek-chat` 条目上）。
 * 未收录返回 null——调用方回退注册表默认，勿在此造兜底值。
 */
export function resolveModelLimits(model?: string): ModelLimits | null {
  const key = normalizeModelId(model || '');
  if (!key) return null;
  let best: { entry: ModelLimitEntry; len: number } | null = null;
  for (const entry of MODEL_LIMITS) {
    for (const k of [entry.id, ...(entry.aliases || [])]) {
      if (key === k) return { maxOutput: entry.maxOutput, contextWindow: entry.contextWindow };
      if (key.includes(k) && (!best || k.length > best.len)) best = { entry, len: k.length };
    }
  }
  return best ? { maxOutput: best.entry.maxOutput, contextWindow: best.entry.contextWindow } : null;
}
