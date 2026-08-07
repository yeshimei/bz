/**
 * 归物本类型（数据格式与 belongings.json 零迁移，spec 8 字段）
 */
export interface BelongingsItem {
  id: string;
  name: string;
  category: string;
  purchase_price: number;
  purchase_date: string;
  current_status: string; // 使用中/闲置/已转卖/已丢弃
  description: string;
  created_date: string;
  last_updated: string;
}

export interface BelongingsDatabase {
  version: string;
  last_updated: string;
  items: Record<string, BelongingsItem>;
  categories: string[];
  categoryIcons: Record<string, string>;
}
