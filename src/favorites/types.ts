/**
 * 收藏本类型（ticket 11）：13 字段（零迁移基准，与收藏本.js 数据格式一致）。
 * ticket 140 加法扩展（ADR-0074）：archived/archivedAt 可选字段，旧数据无字段 = 未归档，照常可读。
 */

/**
 * 标签定义（issue 363 标签自定义）：名称 + 图标 + 稳定 id，定义本体存 data.json 设置键
 * favoriteTags（issue 363 修订：伴生文件 favorites.tags.json 退役——favorites.json 顶层
 * 纯条目数组契约不动：主页.js 读 favorites.length、checkup 字段漂移检查均依赖纯数组根）。
 * id 稳定不随改名变化：内置 9 类固定 id（seed），新增 =
 * 't' + 时间戳；GitHub 强标签等内部特判按 id 取当前 label，改名不失效。
 * 条目 tags[] 仍存 label（旧数据零迁移），改名经 updateTagLabelBulk 批量跟随。
 */
export interface FavTag {
  id: string;
  label: string;
  ic: string; // lucide 图标名
}

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
  archived?: boolean;         // 归档冷存（ADR-0074 纯冷存不可见：真 = 界面全排除，无 UI 反悔）
  archivedAt?: string | null; // 归档时间 'YYYY-MM-DD HH:mm:ss'；未归档缺省
}
