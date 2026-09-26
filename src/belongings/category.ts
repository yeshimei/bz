/**
 * 归物本 · 分类串拆分（纯函数单源）
 *
 * 沿革（issue 477 / ADR-0201）：本模块原为「emoji → lucide 图标映射表」
 * （`emoji-icon-map.ts`，445 条，issue 231/ADR-0102 引入），承担三重职责——
 *   1. 载入迁移转换器（emoji 前缀分类 → 纯文字 + icon 字段）；
 *   2. 遗留 emoji 渲染兜底；
 *   3. AI 图标菜单词源。
 * 三项均已失效或另有所属，故 445 条映射表随本票删除：
 *   1. 迁移已于 2026-09 全量落盘（`icon` 由 `item.icon` 字段承载），迁移路径不再需要图标补写；
 *   2. 渲染兜底改由 `catEmoji`/`catNameOf` 首字路径承担（见 `shared.ts`），遗留 emoji 分类原样显示 emoji；
 *   3. `AI_ICON_MENU`（118 条）早已是冻结字面量（`ai.ts`），与映射表无运行时依赖。
 * 仅保留 emoji 前缀拆分本身——迁移剥离与 AI 返回解析两处共用，口径不得私有。
 */

/** 分类串拆分：取首字符 emoji（含变体选择符），剥前缀得纯文字分类名 */
export function splitEmojiCategory(cat: string): { emoji: string | null; name: string } {
  const s = String(cat || '');
  const m = s.match(/^(\p{Extended_Pictographic})\uFE0F?/u);
  if (!m) return { emoji: null, name: s };
  return { emoji: m[1], name: s.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '') };
}
