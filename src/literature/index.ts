/**
 * literature 域（文献盒）：ADR-0072 自 bili-downloader 迁出。
 * 视频转文献任务队列 + 文献笔记列表（详见 ui.ts）；视频批处理的 AI/笔记落盘在插件侧（ADR-0071，CLI 只产转录临时文件 + 交付视频）。
 * 数据 CONFIG/STORAGE/literature.json。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { LiteratureData, normalizeUrl } from './data';
import { UIManager } from './ui';

let initialized = false;
let uiManager: UIManager | null = null;

/** 懒加载初始化（ADR-0003 幂等）：数据层 + 面板 */
export function ensureLiterature(app: App): void {
  if (initialized) return;
  initialized = true;
  LiteratureData.init({ storagePath: (tryGetSettings() as any)?.storagePath });
  uiManager = new UIManager(app);
}

/** 打开文献盒主面板（bz-literature-open 命令回调） */
export function openLiteraturePanel(app: App): void {
  ensureLiterature(app);
  uiManager?.showMain();
}

/**
 * 打开文献盒并弹出预填的「添加转文献任务」弹窗（聚合讯「保存至文献」入口，ticket 134/ADR-0068）。
 * prefill 无 id = 新增模式；标题/UP主仅任务元数据。层级/ESC 由面板自理（动态 z-index 机制），调用方不碰。
 */
export function openLiteratureAddTask(app: App, prefill: { url: string; title?: string | null; uploader?: string | null }): void {
  ensureLiterature(app);
  uiManager?.showMain();
  uiManager?.showAddDialog({ url: normalizeUrl(prefill.url), title: prefill.title ?? null, uploader: prefill.uploader ?? null });
}

/** 卸载（main.ts onunload 调用；幂等空清理） */
export function unloadLiterature(): void {
  uiManager?.destroy();
  uiManager = null;
  initialized = false;
}
