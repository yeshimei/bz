/**
 * 归物本 AI 分类推荐（ticket 66）
 * 以数据文件已有分类为参考：已有分类合适则直接复用（返回完整「emoji 分类」串），
 * 均不合适才允许新建（AI 给出 emoji + 中文分类名）。
 * 解析失败一律抛错，由 UI 层提示。
 */
import { createAI } from '../core/ai';

export interface CategoryRecommendation {
  /** 完整分类串（含 emoji 前缀，如「🎸 吉他」） */
  category: string;
}

/** 分类串开头是否为 emoji 记号（\p{Extended_Pictographic}） */
const EMOJI_RE = /\p{Extended_Pictographic}/u;

/**
 * 调用 AI 为物品推荐分类。
 * @param itemName 物品名称（必要上下文）
 * @param description 物品描述（可选）
 * @param existingCategories 已有分类（数据文件分类，作为参考；可为空）
 */
export async function recommendCategory(
  itemName: string,
  description: string,
  existingCategories: string[]
): Promise<CategoryRecommendation> {
  const existingList = existingCategories.length
    ? existingCategories.map((c) => `- ${c}`).join('\n')
    : '（暂无已有分类）';

  const prompt = `你是归物本（物品登记）的分类助手。用户正在登记一件物品，请为它推荐一个合适的分类。

物品名称：${itemName}
物品描述：${description || '（无）'}

已有分类（优先从中选用；已有分类字符串含 emoji 前缀）：
${existingList}

规则：
1. 若已有分类中有合适的，直接复用：返回 {"emoji":"","category":"<与已有分类完全一致的完整串，如 🎸 吉他>"}。
2. 若已有分类都不合适，允许新建：给出 1 个贴切的 emoji 和简短中文分类名，返回 {"emoji":"🎸","category":"吉他"}。
3. 新建分类名控制在 2-6 个汉字；emoji 必须与分类名含义匹配。

只返回 JSON，不要输出任何其他内容。`;

  const ai = createAI();
  const raw = await ai.json(prompt);
  return parseCategoryJson(raw, existingCategories);
}

/** 解析 AI 返回（兼容 ```json 围栏 / 前后杂文本；失败抛 Error） */
export function parseCategoryJson(raw: string, existingCategories: string[]): CategoryRecommendation {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 返回格式无法解析');

  let parsed: any;
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    // 严格 JSON 失败 → 尝试键值正则兜底
    const emoji = (cleaned.match(/"emoji"\s*:\s*"([^"]*)"/) || [])[1] || '';
    const category = (cleaned.match(/"category"\s*:\s*"([^"]*)"/) || [])[1] || '';
    if (!category) throw new Error('AI 返回缺少分类字段');
    return normalizeCategory(emoji, category, existingCategories);
  }

  const emoji = typeof parsed.emoji === 'string' ? parsed.emoji.trim() : '';
  const category = typeof parsed.category === 'string' ? parsed.category.trim() : '';
  if (!category) throw new Error('AI 返回缺少分类字段');
  return normalizeCategory(emoji, category, existingCategories);
}

/** 归一化：已有分类直接采用原串；新建则拼 emoji + 分类名；已有 emoji 前缀则原样 */
function normalizeCategory(emoji: string, category: string, existingCategories: string[]): CategoryRecommendation {
  const trimmed = category.trim();
  if (!trimmed) throw new Error('AI 返回分类为空');

  // 与已有分类完全一致 → 直接复用
  if (existingCategories.includes(trimmed)) return { category: trimmed };

  const firstToken = trimmed.split(/\s+/)[0] || '';
  // AI 按规则 1 返回了完整「emoji 分类」串（emoji 字段为空但分类自带前缀）
  if (EMOJI_RE.test(firstToken) && trimmed.includes(' ')) return { category: trimmed };

  // 新建：拼 emoji + 分类名；emoji 缺失时沿用默认图标兜底（data 层统一处理）
  const finalCategory = emoji ? `${emoji} ${trimmed}` : trimmed;
  return { category: finalCategory };
}