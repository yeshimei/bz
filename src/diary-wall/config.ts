/**
 * 回忆墙（diary-wall）域配置：目录常量、标签配置（emoji 编码）。
 *
 * 自包含：从 src/diary/config.ts 拷贝回忆墙需要的集（用户决策「回忆墙自包含，日后删除日记本域」）。
 * - 目录常量：DIARY_DIRECTORY（日记）/MOVIE_DIRECTORY（影视）/LETTER_DIRECTORY（信）/BOOK_DIRECTORY（书库，新增）；
 * - 标签表与 emoji 双向映射、resetTagsConfig（测试/重置入口）；
 * - 裁剪：BATCH_SIZE/getSortedTagsForAddDialog（仅 diary 写弹窗用，回忆墙只读视图不需要）；
 * - 标签表为内置默认 + 测试重置入口（设置项「标签配置」已移除，同 diary 域口径）。
 */
import type { SubTagConfig, TagConfig } from './types';

// ===== 可变常量（设置应用时更新） =====
export let DIARY_DIRECTORY = '我的/日记';
export let MOVIE_DIRECTORY = '我的/影视';
export let LETTER_DIRECTORY = '我的/信';
export let BOOK_DIRECTORY = '书库';

/** 应用目录常量（设置变更时调用；四类内容的读取目录） */
export function applyDirectories(settings: {
  diaryDirectory?: string;
  movieDirectory?: string;
  letterDirectory?: string;
  bookDirectory?: string;
}) {
  DIARY_DIRECTORY = settings.diaryDirectory || '我的/日记';
  MOVIE_DIRECTORY = settings.movieDirectory || '我的/影视';
  LETTER_DIRECTORY = settings.letterDirectory || '我的/信';
  BOOK_DIRECTORY = settings.bookDirectory || '书库';
}

/** 获取当前标签配置 */
export function getPrimaryTagsConfig(): Record<string, TagConfig> {
  return PRIMARY_TAGS_CONFIG;
}

/** 加密分类标签名（ADR-0017；写块标题、筛选/计数、排序用） */
export const ENCRYPT_TAG = '加密';

/**
 * 主标签展示顺序（筛选栏）：配置固定顺序，但「加密」标签固定排在最后（用户决策）。
 * 用于筛选栏主标签按钮的遍历顺序（回忆墙 chips 行）。
 */
export function getPrimaryTagsInDisplayOrder(): string[] {
  const tags = Object.keys(PRIMARY_TAGS_CONFIG);
  const idx = tags.indexOf(ENCRYPT_TAG);
  if (idx === -1) return tags;
  const rest = tags.filter((t) => t !== ENCRYPT_TAG);
  rest.push(ENCRYPT_TAG);
  return rest;
}

/** 恢复默认标签配置（测试与设置重置使用） */
export function resetTagsConfig() {
  PRIMARY_TAGS_CONFIG = JSON.parse(JSON.stringify(DEFAULT_TAGS_CONFIG));
  buildTagMaps();
}

// ===== 默认标签配置 =====
const DEFAULT_TAGS_CONFIG: Record<string, TagConfig> = {
  日记: { emoji: '📖' },
  加密: { emoji: '🔐' },
  念念碎: { emoji: '😶' },
  对谈: { emoji: '🤝' },
  随笔: { emoji: '✍️' },
  梦: { emoji: '🌙' },
  诗: { emoji: '🌟' },
  书: { emoji: '📕' },
  信: { emoji: '✉️' },
  摘抄: { emoji: '📌' },
  摄影: { emoji: '📸' },
  骑行: { emoji: '🚴' },
  代码: { emoji: '⚙️' },
  做饭: { emoji: '🥘' },
  游戏: { emoji: '🎮' },
  音乐: { emoji: '🎧' },
  电影: { emoji: '📽' },
  电视剧: { emoji: '📺' },
  动漫: { emoji: '🎨' },
  纪录片: { emoji: '🎞' },
  猫: { emoji: '🐱' },
  狗: { emoji: '🐶' },
  仓鼠: { emoji: '🐹' },
  熊猫: { emoji: '🐼' },
  博物馆: { emoji: '🏛️' },
  美食: { emoji: '🍔' },
  旅游: {
    emoji: '✈️',
    subTags: [
      { tag: '四川', emoji: '🀄' },
      { tag: '大理', emoji: '🛶' },
    ],
  },
  收藏: {
    emoji: '⭐',
    subTags: [
      { tag: '咪咪', emoji: '🐈' },
      { tag: '广告', emoji: '📢' },
      { tag: '神评', emoji: '🤣' },
      { tag: '冷笑话', emoji: '😅' },
      { tag: '抽象', emoji: '🌀' },
      { tag: 'AI', emoji: '🤖' },
      { tag: '愚人节', emoji: '🤪' },
      { tag: '舞蹈', emoji: '🕺' },
      { tag: '达人秀', emoji: '🤹' },
      { tag: '艺术', emoji: '🧑‍🎨' },
      { tag: '摄影集', emoji: '📷' },
      { tag: '植物', emoji: '🌳' },
      { tag: '创意', emoji: '🧩' },
    ],
  },
};

let PRIMARY_TAGS_CONFIG: Record<string, TagConfig> = JSON.parse(JSON.stringify(DEFAULT_TAGS_CONFIG));

// ===== emoji 映射表（与 config 同步） =====
export const tagToEmojiMap: Record<string, string> = {};
export const emojiToTagMap: Record<string, string> = {};

// ===== 模块加载时立即构建映射（须在映射表声明之后；此调用是唯一构建入口，不可删除） =====
buildTagMaps();

/** 构建标签↔emoji 双向映射 */
export function buildTagMaps() {
  for (const key of Object.keys(tagToEmojiMap)) delete tagToEmojiMap[key];
  for (const key of Object.keys(emojiToTagMap)) delete emojiToTagMap[key];
  for (const [tag, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
    tagToEmojiMap[tag] = config.emoji;
    emojiToTagMap[config.emoji] = tag;
    if (config.subTags) {
      for (const sub of config.subTags) {
        tagToEmojiMap[sub.tag] = sub.emoji;
        emojiToTagMap[sub.emoji] = sub.tag;
      }
    }
  }
}

/** 获取标签对应的 emoji（自动识别主/二级） */
export function getTagEmoji(tag: string): string {
  return tagToEmojiMap[tag] || '📖';
}

/** 获取主标签的二级标签配置 */
export function getSubTagsOfPrimary(primaryTag: string): SubTagConfig[] | null {
  const config = PRIMARY_TAGS_CONFIG[primaryTag];
  return config && config.subTags ? config.subTags : null;
}

/** 判断一个标签是否是二级标签 */
export function isSubTag(tag: string): boolean {
  for (const [, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
    if (config.subTags && config.subTags.some((sub) => sub.tag === tag)) {
      return true;
    }
  }
  return false;
}

/** 获取二级标签所属的主标签 */
export function getParentPrimaryTag(subTag: string): string | null {
  for (const [primary, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
    if (config.subTags && config.subTags.some((sub) => sub.tag === subTag)) {
      return primary;
    }
  }
  return null;
}
