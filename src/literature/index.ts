/**
 * literature 域（文献盒）入口：ADR-0072 自 bili-downloader 迁出。
 * 主面板 = 文献目录下的文献笔记列表（右上角：文字录入 / 视频录入 / 设置，见 ui.ts）；
 * 视频转文献批处理的 AI/笔记落盘在插件侧（ADR-0071），CLI 只产转录临时文件 + 交付视频。
 * 数据 CONFIG/STORAGE/literature.json（视频任务）；术语生成不留任务记录（ticket 136 §2）。
 */
import type { App } from 'obsidian';
import { MarkdownView } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { LiteratureData } from './data';
import { UIManager } from './ui';

let initialized = false;
let uiManager: UIManager | null = null;

/**
 * 懒加载初始化（ADR-0003 幂等）：数据层 + 面板。
 * ticket 138 §1.2：initialized 在构造成功后置位；构造函数若在真实环境抛错（jsdom 掩盖），
 * 保持未初始化 → 下次命令自动重试，杜绝「构造失败后 uiManager 恒 null、面板永不再开」。
 */
export function ensureLiterature(app: App): void {
  if (initialized) return;
  try {
    LiteratureData.init({ storagePath: (tryGetSettings() as any)?.storagePath });
    uiManager = new UIManager(app);
    initialized = true;
  } catch (e) {
    console.error('bz: 文献盒初始化失败（下次打开命令将自动重试）', e);
    uiManager = null;
  }
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
    // ticket 138 §1.1：getActiveViewOfType 内部做 view instanceof type，右值必须是类（MarkdownView），
    // 传字符串会在真实 Obsidian 抛 TypeError（测试 mock 掩盖）；选区空则 undefined → 空输入框手填
    const view = app.workspace.getActiveViewOfType(MarkdownView);
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