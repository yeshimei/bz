/**
 * 收藏本类型（ticket 11）：13 字段（零迁移基准，与收藏本.js 数据格式一致）。
 */
export interface FavoritesItem {
  id: string;                 // 新增时 Date.now().toString()
  tags: string[];
  title: string;
  description: string;
  pinned: boolean;
  url: string;
  balance: string | null;
  balanceCacheTime: number | null;
  balanceError: string | null;
  linkedNote: string | null;
  created: string;            // moment().format('YYYY-MM-DD HH:mm:ss')
  type: string;               // = tags[0]
  llmConfig?: { apiKeys: string; balanceUrl: string } | null;
}
