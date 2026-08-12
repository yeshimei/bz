/**
 * 剪藏本域入口（ticket 08）
 * 命令（article-open-view）由 main.ts 裸注册；此处提供回调 + 幂等初始化。
 */
import type { App } from 'obsidian';
import { initArticleView, applyArticleSettings, unloadClipping } from './view';

let initialized = false;

/** 幂等初始化（懒加载：UI 域首次打开初始化） */
export function ensureClipping(app: App): void {
  if (initialized) return;
  initialized = true;
  applyArticleSettings();
}

/** 打开文章列表（article-open-view 命令回调） */
export function openArticleView(app: App): void {
  ensureClipping(app);
  void initArticleView(true);
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadArticleView(): void {
  unloadClipping();
}