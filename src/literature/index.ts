/**
 * literature 域（文献盒）入口：ADR-0072 自 bili-downloader 迁出。
 * 主面板 = 文献目录下的文献笔记列表（右上角：文字录入 / 视频录入 / 设置，见 ui.ts）；
 * 视频转文献批处理的 AI/笔记落盘在插件侧（ADR-0071），CLI 只产转录临时文件 + 交付视频。
 * 数据 CONFIG/STORAGE/literature.json（视频任务）；术语生成不留任务记录（ticket 136 §2）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { LiteratureData } from './data';
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
 * 打开「视频录入」面板并预填（聚合讯「保存至文献」入口，ADR-0068）。
 * 注意：该入口打开的是视频录入面板（任务队列 + 添加转文献任务弹窗），而非文献列表主面板；
 * prefill 含链接/标题/UP主 时输入框预填。层级/ESC 由面板自理，调用方不碰。
 */
export function openLiteratureAddTask(app: App, prefill?: { url: string; title?: string | null; uploader?: string | null }): void {
  ensureLiterature(app);
  uiManager?.showVideoEntry(prefill);
}

/**
 * 术语生成入口（bz-literature-note-term 命令回调）：打开「文字录入」面板（ticket 136 §6）。
 * 显式 term 预填输入框；为空时读取当前激活 Markdown 编辑器选区预填（选中词），
 * 无选区则空输入框手动填。
 */
export function openTermNote(app: App, term?: string): void {
  ensureLiterature(app);
  let t = term?.trim();
  if (!t) {
    // 读当前激活 Markdown 编辑器选区（getActiveViewOfType('markdown') 字符串重载）
    const view = (app.workspace.getActiveViewOfType as any)?.('markdown');
    t = view?.editor?.getSelection()?.trim() || undefined;
  }
  uiManager?.showTermEntry(t);
}

/** 卸载（main.ts onunload 调用；幂等空清理） */
export function unloadLiterature(): void {
  uiManager?.destroy();
  uiManager = null;
  initialized = false;
}