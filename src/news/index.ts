/**
 * 聚合讯域入口（ticket 09）
 * 命令（news-reader-open）由 main.ts 裸注册；此处提供回调 + 幂等初始化。
 */
import type { App } from 'obsidian';
import { init, show, unloadNews } from './reader';
import { checkAndShowChangelog } from '../core/changelog';

let initialized = false;

/** 幂等初始化（懒加载：首次打开时 init(false) 创建隐藏弹窗） */
export function ensureNews(app: App): void {
  if (initialized) return;
  initialized = true;
  init(false);
}

/** 打开资讯阅读器（news-reader-open 命令回调；Q3 无 'news' changelog，调用静默跳过） */
export function openNewsReader(app: App): void {
  ensureNews(app);
  checkAndShowChangelog('news');
  show();
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadNewsReader(): void {
  unloadNews();
}