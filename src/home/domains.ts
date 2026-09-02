/**
 * 内容首页（home 域）域清单：卡片 = 域（id/名称/副题/图标），点击开对应命令。
 *
 * 取值原则：命令 id 与图标名对齐 src/main.ts COMMANDS 表（icon 与入口页磁贴一致）；
 * 徽标功能色为数据语义色（域内直给，双主题一致），见徽标色 map。
 */
import type { BzIconName } from '../core/ui';

export interface HomeDomain {
  /** 域名 id（home.json pinned 存储值） */
  id: string;
  /** 命令 id（点卡执行；settings 域无命令 → 空串占位，点击开设置面板命令） */
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
  { id: 'clipping', commandId: 'bz-clipping-open', name: '剪藏本', sub: '网页剪藏', icon: 'scissors' },
  { id: 'library', commandId: 'bz-library-open', name: '书库', sub: '藏书与笔记', icon: 'library' },
  { id: 'news', commandId: 'bz-news-open', name: '聚合讯', sub: '资讯聚合', icon: 'radio' },
  { id: 'quiz', commandId: 'bz-review-open', name: '做题家', sub: '题目练习', icon: 'brain' },
  { id: 'belongings', commandId: 'bz-belongings-open', name: '归物本', sub: '物品登记', icon: 'package' },
  { id: 'attach', commandId: 'bz-attach-move', name: '移附件', sub: '附件归位', icon: 'folder-down' },
  { id: 'encrypt', commandId: 'bz-encrypt-open', name: '保险箱', sub: '加密容器', icon: 'lock' },
  { id: 'smartcat', commandId: 'bz-smartcat-open', name: '小橘', sub: '桌面陪伴猫', icon: 'cat' },
  { id: 'settings', commandId: 'bz-settings-panel-open', name: '设置', sub: '全域设置', icon: 'settings' },
];

export const DOMAIN_MAP: Map<string, HomeDomain> = new Map(DOMAINS.map((d) => [d.id, d]));

/** 徽标功能色（数据语义，双主题一致；diary 无数字徽标用品牌主色） */
export const DOMAIN_DOT: Record<string, string> = {
  diary: '#e67341',
  memo: '#d9a13c',
  cinema: '#e6951d',
  review: '#7c5cd6',
  pomodoro: '#e5534b',
  favorites: '#f0b429',
  clipping: '#2f9e5f',
  library: '#3d7bd6',
  news: '#0f6fdc',
  quiz: '#a05bd6',
  belongings: '#45a35c',
  attach: '#8a8f99',
  encrypt: '#8a8f99',
  smartcat: '#e67341',
  settings: '#8a8f99',
};

/** 徽标高亮（非零数或运行中文案）：该域的数字文案与「+1 醒目」开关 */
export const DOT_ACCENT: ReadonlySet<string> = new Set(['diary', 'memo', 'review', 'cinema', 'pomodoro']);

/** 全量域 id（钉选候选/迷你 chips 遍历顺序） */
export const ALL_DOMAIN_IDS: string[] = DOMAINS.map((d) => d.id);
