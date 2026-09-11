/**
 * 归物本 · AI 归类（issue 231，ADR-0102）：按物品名称建议「分类名 + lucide 图标」。
 *
 * 约束策略 = 菜单内选择（不给自由发挥）：图标只能从 AI_ICON_MENU 取（全部经
 * Obsidian 内置 lucide 表验证存在，setIcon 静默失败不可能发生）；分类名剥 emoji
 * 前缀、限长。走 core createAI().json()（response_format=json_object），
 * 未配置/网络失败原样抛错，由表单内联降级提示（不阻塞手填）。
 */
import { createAI } from '../core/ai';
import { splitEmojiCategory } from './emoji-icon-map';

/** 图标菜单： possessions 高频语义（从 emoji-icon-map 全集挑选，全部已验证） */
export const AI_ICON_MENU: readonly string[] = [
  // 数码影音
  'smartphone', 'laptop', 'monitor', 'watch', 'headphones', 'speaker', 'printer', 'camera',
  'aperture', 'video', 'focus', 'projector', 'gamepad-2', 'keyboard', 'hard-drive', 'disc',
  'plug', 'battery-charging', 'lightbulb', 'tv', 'router', 'signal', 'phone', 'computer',
  // 家居日用
  'bed', 'sofa', 'armchair', 'lamp', 'lamp-desk', 'fan', 'air-vent', 'refrigerator',
  'microwave', 'cooking-pot', 'blinds', 'archive', 'library', 'trash-2', 'key-round',
  'droplets', 'thermometer', 'package', 'box', 'brush-cleaning', 'shower-head', 'bath',
  // 厨房餐茶
  'utensils', 'coffee', 'cup-soda', 'wine', 'milk', 'chef-hat', 'flame', 'snowflake',
  // 衣服饰品
  'shirt', 'footprints', 'handbag', 'backpack', 'luggage', 'briefcase',
  'glasses', 'gem', 'crown', 'sparkles', 'scissors',
  // 文具乐玩
  'book', 'book-open', 'notebook', 'pen-line', 'pencil', 'palette', 'paintbrush',
  'guitar', 'piano', 'drum', 'mic', 'music', 'radio', 'puzzle', 'dices', 'toy-brick',
  // 运动户外
  'volleyball', 'dumbbell', 'person-standing', 'waves', 'fish', 'bike', 'tent', 'mountain',
  'wrench', 'hammer', 'shovel', 'flashlight', 'compass', 'telescope',
  // 交通
  'car', 'bus', 'truck', 'train-front', 'plane', 'rocket', 'sailboat', 'ship', 'helicopter',
  // 生命健康
  'pill', 'syringe', 'stethoscope', 'bandage', 'leaf', 'flower', 'sprout', 'tree-pine',
  'paw-print', 'dog', 'cat', 'bird', 'bug', 'shell',
];

/** 提示词：名称 + 历史分类（供复用既有分类）→ 严格 JSON 两字段 */
export function buildCategoryPrompt(name: string, history: string[]): string {
  const menu = AI_ICON_MENU.join(', ');
  const hist = history.length ? `我的历史分类（优先复用）：${history.join('、')}` : '暂无历史分类。';
  return [
    '你是物品收纳助手。为下面的物品给出一个分类和一枚图标。',
    `物品名称：${name}`,
    hist,
    '要求：',
    '1. category：中文分类名，2-6 个字；若历史分类里有合适的就原样复用其一，否则自拟。',
    `2. icon：只能从这个清单里选一个英文标识符：${menu}`,
    '只输出 JSON 对象，格式：{"category":"分类名","icon":"清单中的标识符"}',
  ].join('\n');
}

/** 图标回退（H20）：AI 只给合法分类但图标非法/缺失时不再整条弃用，回退菜单内通用「杂物」图标 */
export const AI_FALLBACK_ICON = 'package';

/** 解析 + 校验：剥 codefence、剥分类 emoji 前缀；分类非法 = 整条 null；
 *  图标非法 = 回退 AI_FALLBACK_ICON（H20：原「全有或全无」会丢掉本可用的分类建议） */
export function parseCategorySuggestion(raw: string): { category: string; icon: string } | null {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  let obj: any;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  const category = splitEmojiCategory(String(obj?.category ?? '')).name.trim();
  const icon = String(obj?.icon ?? '').trim();
  if (!category || category.length > 16) return null;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(icon) || !AI_ICON_MENU.includes(icon)) {
    return { category, icon: AI_FALLBACK_ICON };
  }
  return { category, icon };
}

/** AI 归类入口：失败/未配置抛错（表单内联降级），成功返回校验过的建议 */
export async function aiSuggestCategory(name: string, history: string[]): Promise<{ category: string; icon: string }> {
  const ai = createAI();
  const raw = await ai.json(buildCategoryPrompt(name, history), {});
  const parsed = parseCategorySuggestion(raw);
  if (!parsed) throw new Error('返回格式无法解析');
  return parsed;
}
