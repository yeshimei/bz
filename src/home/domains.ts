/**
 * 内容首页（home 域）域清单：卡片 = 域（id/名称/副题/图标），点击开对应命令。
 *
 * 取值原则：命令 id 与图标名对齐 src/core/domain-icons.ts（域图标单一事实源，enh-sweep-a 收敛）；
 * icon 一律经 iconOf() 引 DOMAIN_ICONS（终局 review 批 B 迁移，值与原字面量逐一一致）；
 * 徽标功能色为数据语义色（域内直给，双主题一致），见徽标色 map。
 * 卡片集合对齐「内容首页」语义：高频域（有统计/常开）+ 系统入口（设置），
 * 工具域（回忆墙/保险库等）在迷你 chips 与侧栏兜底可点。
 */
import type { BzIconName } from '../core/ui';
import { DOMAIN_ICONS } from '../core/domain-icons';

/** 磁贴 id → 事实源键（wall/settings 与域 id 异名，其余同键） */
const ICON_KEY: Record<string, string> = { wall: 'diary-wall', settings: 'settings-panel' };
/** 图标一律取 core/domain-icons 单一事实源（终局 review 批 B：17 条字面量迁移，值不变） */
const iconOf = (id: string): BzIconName => DOMAIN_ICONS[ICON_KEY[id] ?? id] as BzIconName;

export interface HomeDomain {
  /** 域名 id（home.json pinned 存储值） */
  id: string;
  /** 命令 id（点卡执行） */
  commandId: string;
  name: string;
  /** 卡片副题（静态；动态统计见徽标） */
  sub: string;
  /** lucide 图标名（Obsidian setIcon 已注册名） */
  icon: BzIconName;
}

export const DOMAINS: HomeDomain[] = [
  { id: 'diary', commandId: 'bz-diary-open', name: '日记本', sub: '写今天的闪念', icon: iconOf('diary') },
  // 今日回顾（recap 域，方向一 R2）：当天五域痕迹聚合面板（icon 与 DOMAIN_ICONS.recap 一致）
  { id: 'recap', commandId: 'bz-recap-today', name: '今日回顾', sub: '今天的痕迹一条线', icon: iconOf('recap') },
  { id: 'cinema', commandId: 'bz-cinema-open', name: '影院', sub: '影视想看与在看', icon: iconOf('cinema') },
  { id: 'review', commandId: 'bz-review-open', name: '复习计划', sub: '到期卡片队列', icon: iconOf('review') },
  { id: 'pomodoro', commandId: 'bz-pomodoro-open', name: '番茄钟', sub: '专注计时', icon: iconOf('pomodoro') },
  { id: 'favorites', commandId: 'bz-favorites-open', name: '收藏本', sub: '收藏条目', icon: iconOf('favorites') },
  { id: 'clipping', commandId: 'bz-clipbook-open', name: '剪藏本', sub: '聚合讯与剪藏', icon: iconOf('clipping') },
  // 文献盒（literature 域，ADR-0072）：文献笔记列表 + 视频/术语录入（补内容域曝光位）
  { id: 'literature', commandId: 'bz-literature-open', name: '文献盒', sub: '文献笔记与录入', icon: iconOf('literature') },
  // 旧书库（library）域退役：本卡由书架墙（bookshelf）承接（id 变更后旧 home.json 里钉选的 library 自动失效，可在编辑模式重钉）
  { id: 'bookshelf', commandId: 'bz-bookshelf-open', name: '书架墙', sub: '藏书与读书笔记', icon: iconOf('bookshelf') },
  // 阅读报告（reading-report 域）：metadataCache 统计的阅读数据分析（补内容域曝光位）
  { id: 'reading-report', commandId: 'bz-reading-report-open', name: '阅读报告', sub: '阅读数据分析', icon: iconOf('reading-report') },
  { id: 'wall', commandId: 'bz-diary-wall-open', name: '回忆墙', sub: '相片墙浏览日记', icon: iconOf('wall') },
  { id: 'belongings', commandId: 'bz-belongings-open', name: '归物本', sub: '物品登记', icon: iconOf('belongings') },
  { id: 'attach', commandId: 'bz-attach-move', name: '移附件', sub: '附件归位', icon: iconOf('attach') },
  { id: 'encrypt', commandId: 'bz-encrypt-open', name: '保险库', sub: '密码·加密笔记·日记', icon: iconOf('encrypt') },
  { id: 'smartcat', commandId: 'bz-smartcat-open', name: '小橘', sub: '桌面陪伴猫', icon: iconOf('smartcat') },
  { id: 'settings', commandId: 'bz-settings-panel-open', name: '设置', sub: '全域设置', icon: iconOf('settings') },
];

export const DOMAIN_MAP: Map<string, HomeDomain> = new Map(DOMAINS.map((d) => [d.id, d]));

/** 徽标功能色（数据语义，双主题一致） */
export const DOMAIN_DOT: Record<string, string> = {
  diary: '#e67341',
  recap: '#d64d8f',
  cinema: '#e6951d',
  review: '#7c5cd6',
  pomodoro: '#e5534b',
  favorites: '#f0b429',
  clipping: '#2f9e5f',
  literature: '#c2559d',
  bookshelf: '#3d7bd6',
  'reading-report': '#3fa7a0',
  wall: '#7c8cf8',
  belongings: '#45a35c',
  attach: '#8a8f99',
  encrypt: '#8a8f99',
  smartcat: '#e67341',
  settings: '#8a8f99',
};

/** 全量域 id（钉选候选/迷你 chips 遍历顺序） */
export const ALL_DOMAIN_IDS: string[] = DOMAINS.map((d) => d.id);