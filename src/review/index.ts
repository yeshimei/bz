/**
 * 复习计划入口（ticket 16：ensureReview + 5 命令回调 + unloadReview）
 * 命令（review-*）由 main.ts 裸注册。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { getSettings } from '../core/settings-provider';
import { confirm } from '../core/confirm';
import { ReviewDataManager } from './data';
import { UIManager } from './ui';
import { reviewApp } from './app';
import type { Rating } from './fsrs';

let initialized = false;
let dataManager: ReviewDataManager | null = null;
let uiManager: UIManager | null = null;
let timers: ReturnType<typeof setInterval>[] = [];
let listeners: { off: () => void }[] = [];

export function ensureReview(app: App): void {
  if (initialized) return;
  initialized = true;
  dataManager = new ReviewDataManager(app);
  uiManager = new UIManager(app, dataManager);
  registerEvents(app);
  startAutoCheck(app);
}

function registerEvents(app: App): void {
  const onModify = async (file: any) => {
    if (dataManager && file && file.path) {
      // 笔记修改 → 刷新文件树徽标
      try {
        const { applyReviewStyles } = await import('./styles-applier');
        applyReviewStyles(app, dataManager, file);
      } catch {
        /* ignore */
      }
    }
  };
  const onRename = async (file: any, oldPath: string) => {
    if (!dataManager) return;
    const ok = await dataManager.updateFilePath(oldPath, file.path, file.basename);
    if (!ok) {
      new Notice('复习计划路径更新失败，请检查控制台');
    }
  };
  listeners.push({ off: () => {} });
  (app.vault as any).on('modify', onModify);
  (app.vault as any).on('rename', onRename);
}

function startAutoCheck(app: App): void {
  const settings = getSettings();
  const intervalMin = parseInt(String(settings.autoCheckInterval)) || 60;
  const checkOverdueAndNotify = async () => {
    if (!dataManager || !settings.enableAutoNotify) return;
    try {
      await dataManager.loadItems();
      const overdue = dataManager.items.filter((i) => i.isOverdue && !i.completed);
      if (overdue.length > 0) {
        new Notice(`📚 有 ${overdue.length} 条复习逾期`);
      }
    } catch {
      /* ignore */
    }
  };
  const t = setTimeout(() => {
    const interval = setInterval(checkOverdueAndNotify, Math.max(intervalMin, 1) * 60000);
    timers.push(interval);
  }, 2000);
  timers.push(t as any);
}

/** 打开复习面板 */
export async function openReviewPanel(app: App): Promise<void> {
  ensureReview(app);
  if (uiManager) await uiManager.showMain();
}

/** 加入复习计划 */
export async function reviewAddCurrent(app: App): Promise<void> {
  ensureReview(app);
  if (!dataManager) return;
  await reviewApp.addCurrentToReview(app, dataManager);
  uiManager?.refreshPanel();
}

/** 移出复习计划 */
export async function reviewRemoveCurrent(app: App): Promise<void> {
  ensureReview(app);
  if (!dataManager) return;
  const file = app.workspace.getActiveFile();
  if (!file) {
    new Notice('请先打开一个笔记');
    return;
  }
  const item = dataManager.items.find((i) => i.filePath === file.path);
  if (!item) {
    new Notice('该笔记不在复习计划中');
    return;
  }
  confirm({
    title: '确认移出复习计划？',
    message: '所有复习数据将被删除。',
    confirmText: '确定',
    cancelText: '取消',
    onConfirm: async () => {
      await dataManager!.removeItem(item.id);
      new Notice('✅ 已移出复习计划');
      uiManager?.refreshPanel();
    },
  });
}

/** 复习（跳转逾期） */
export async function reviewJumpOverdue(app: App): Promise<void> {
  ensureReview(app);
  if (!dataManager) return;
  let quiz: any = null;
  try {
    const q = await import('../quiz');
    quiz = q.quizUI;
  } catch {
    /* ignore */
  }
  await reviewApp.autoJumpOverdue(app, dataManager, quiz);
}

/** 复习（选择难度） */
export async function reviewMarkDialog(app: App): Promise<void> {
  ensureReview(app);
  if (!dataManager) return;
  const file = app.workspace.getActiveFile();
  if (!file) {
    new Notice('请先打开一个笔记');
    return;
  }
  const item = dataManager.items.find((i) => i.filePath === file.path);
  if (!item) {
    new Notice('该笔记不在复习计划中');
    return;
  }
  uiManager?.showDifficultyDialog(item, async (rating: Rating) => {
    await reviewApp.markReview(app, item, rating);
    await dataManager!.saveItems();
    uiManager?.refreshPanel();
  });
}

/** 卸载清理 */
export function unloadReview(): void {
  initialized = false;
  timers.forEach((t) => clearInterval(t));
  timers = [];
  listeners.forEach((l) => l.off());
  listeners = [];
  uiManager?.destroy();
  uiManager = null;
  dataManager = null;
}
