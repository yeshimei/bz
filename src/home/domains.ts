/**
 * 内容首页（home 域）域清单：卡片 = 域（id/名称/副题/图标），点击开对应命令。
 *
 * 取值原则：命令 id 与图标名对齐 src/main.ts COMMANDS 表（icon 与入口页磁贴一致）；
 * 徽标功能色为数据语义色（域内直给，双主题一致），见徽标色 map。
 * 卡片集合对齐「内容首页」语义：高频域（有统计/常开）+ 系统入口（设置），
 * 工具域（回忆墙/保险库等）在迷你 chips 与侧栏兜底可点。
 */
import type { BzIconName } from '../core/ui';

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
  { id: 'diary', commandId: 'bz-diary-open', name: '日记本', sub: '写今天的闪念', icon: 'notebook-pen' },
  { id: 'memo', commandId: 'bz-memo-open', name: '备忘录', sub: '记录与提醒', icon: 'sticky-note' },
  { id: 'cinema', commandId: 'bz-cinema-open', name: '影院', sub: '影视想看与在看', icon: 'clapperboard' },
  { id: 'review', commandId: 'bz-review-open', name: '复习计划', sub: '到期卡片队列', icon: 'repeat-2' },
  { id: 'pomodoro', commandId: 'bz-pomodoro-open', name: '番茄钟', sub: '专注计时', icon: 'timer' },
  { id: 'favorites', commandId: 'bz-favorites-open', name: '收藏本', sub: '收藏条目', icon: 'star' },
  { id: 'clipping', commandId: 'bz-clipbook-open', name: '剪藏本', sub: '聚合讯与剪藏', icon: 'scissors' },
  // 旧书库（library）域退役：本卡由书架墙（bookshelf）承接（id 变更后旧 home.json 里钉选的 library 自动失效，可在编辑模式重钉）
  { id: 'bookshelf', commandId: 'bz-bookshelf-open', name: '书架墙', sub: '藏书与读书笔记', icon: 'book-open' },
  { id: 'wall', commandId: 'bz-diary-wall-open', name: '回忆墙', sub: '相片墙浏览日记', icon: 'images' },
  { id: 'belongings', commandId: 'bz-belongings-open', name: '归物本', sub: '物品登记', icon: 'package' },
  { id: 'attach', commandId: 'bz-attach-move', name: '移附件', sub: '附件归位', icon: 'folder-down' },
  { id: 'encrypt', commandId: 'bz-encrypt-open', name: '保险库', sub: '密码·加密笔记·日记', icon: 'lock' },
  { id: 'smartcat', commandId: 'bz-smartcat-open', name: '小橘', sub: '桌面陪伴猫', icon: 'cat' },
  { id: 'settings', commandId: 'bz-settings-panel-open', name: '设置', sub: '全域设置', icon: 'settings-2' },
];

export const DOMAIN_MAP: Map<string, HomeDomain> = new Map(DOMAINS.map((d) => [d.id, d]));

/** 徽标功能色（数据语义，双主题一致） */
export const DOMAIN_DOT: Record<string, string> = {
  diary: '#e67341',
  memo: '#d9a13c',
  cinema: '#e6951d',
  review: '#7c5cd6',
  pomodoro: '#e5534b',
  favorites: '#f0b429',
  clipping: '#2f9e5f',
  bookshelf: '#3d7bd6',
  wall: '#7c8cf8',
  belongings: '#45a35c',
  attach: '#8a8f99',
  encrypt: '#8a8f99',
  smartcat: '#e67341',
  settings: '#8a8f99',
};

/** 全量域 id（钉选候选/迷你 chips 遍历顺序） */
export const ALL_DOMAIN_IDS: string[] = DOMAINS.map((d) => d.id);