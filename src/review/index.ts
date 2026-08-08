/**
 * 复习计划入口（ticket 16 修正版：对齐源码 entry，含 4 快捷命令与完整事件监听）
 * 命令（review-*）由 main.ts 裸注册（含 review-mark-again/hard/good/easy）。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { confirm } from '../core/confirm';
import { ReviewDataManager } from './data';
import { UIManager } from './ui';
import { reviewApp } from './app';
import type { Rating } from './fsrs';

let initialized = false;
let appRef: App | null = null;
export let dataManager: ReviewDataManager | null = null;
export let uiManager: UIManager | null = null;
let checkInterval: ReturnType<typeof setInterval> | null = null;

/** 幂等初始化（对齐源码 entry：UI 构建 + 事件监听 + 2s 后首查 + 60s 周期） */
export function ensureReview(app: App): void {
  if (initialized) return;
  initialized = true;
  appRef = app;
  reviewApp.ensure(app);
  dataManager = new ReviewDataManager(app);
  uiManager = new UIManager(app, dataManager);

  setTimeout(() => {
    reviewApp.checkOverdueAndNotify();
    checkInterval = setInterval(() => reviewApp.checkOverdueAndNotify(), 60000);
  }, 2000);

  // 事件监听（源码 L864-879 逐字）
  (app.metadataCache as any).on('resolved', async () => {
    await reviewApp.applyReviewStyles(app);
  });
  (app.vault as any).on('modify', async (file: any) => {
    if (file.extension === 'md') await reviewApp.applyReviewStyles(app, file);
  });
  (app.vault as any).on('rename', async (file: any, oldPath: string) => {
    if (file.extension !== 'md') return;
    if (oldPath === file.path) return;
    try {
      const items = await dataManager!.loadItems();
      if (!items.some((i) => i.filePath === oldPath)) return;
      const updated = await dataManager!.updateFilePath(oldPath, file.path, file.basename);
      if (updated) {
        console.log(`📂 复习计划：更新路径 ${oldPath} → ${file.path}`);
        await uiManager!.refreshPanel();
        await reviewApp.applyReviewStyles(app);
      }
    } catch (e) {
      console.error('复习计划：处理重命名事件失败', e);
      notice('❌ 复习计划路径更新失败');
    }
  });
  (app.workspace as any).on('quit', () => {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  });
}

/** 打开复习面板（review-open-panel） */
export function openReviewPanel(app: App): void {
  ensureReview(app);
  uiManager?.showMain();
}

/** 加入复习计划（review-add-current） */
export async function reviewAddCurrent(app: App): Promise<void> {
  ensureReview(app);
  const file = app.workspace.getActiveFile();
  if (!file) {
    notice('请先打开一个笔记');
    return;
  }
  try {
    await reviewApp.addCurrentToReview(file);
    await uiManager!.refreshPanel();
    await reviewApp.applyReviewStyles(app);
  } catch (e: any) {
    notice('❌ 操作失败：' + e.message);
  }
}

/** 移出复习计划（review-remove-current） */
export async function reviewRemoveCurrent(app: App): Promise<void> {
  ensureReview(app);
  const file = app.workspace.getActiveFile();
  if (!file) {
    notice('请先打开一个笔记');
    return;
  }
  const items = await dataManager!.loadItems();
  if (!items.some((i) => i.filePath === file.path)) {
    notice('该笔记不在复习计划中');
    return;
  }
  confirm({
    title: '确认移出复习计划？',
    message: '所有复习数据将被删除。',
    confirmText: '确定',
    cancelText: '取消',
    onConfirm: async () => {
      await dataManager!.removeItem(file.path);
      notice('✅ 已移出复习计划');
      await uiManager!.refreshPanel();
      await reviewApp.applyReviewStyles(app);
    },
  });
}

/** 复习（跳转逾期）（review-jump-overdue） */
export async function reviewJumpOverdue(app: App): Promise<void> {
  ensureReview(app);
  await reviewApp.autoJumpOverdue();
}

/** 开始复习（进入复习流程）：跳过逾期 → 出题/复习循环（review-start） */
export async function reviewStart(app: App): Promise<void> {
  ensureReview(app);
  await reviewApp.autoJumpOverdue();
}

/** 复习（选择难度）（review-mark-dialog） */
export async function reviewMarkDialog(app: App): Promise<void> {
  ensureReview(app);
  const file = app.workspace.getActiveFile();
  if (!file) {
    notice('请先打开一个笔记');
    return;
  }
  const items = await dataManager!.loadItems();
  const item = items.find((i) => i.filePath === file.path);
  if (!item) {
    notice('该笔记不在复习计划中');
    return;
  }
  if (item.completed) {
    notice('该笔记已完成全部复习');
    return;
  }
  uiManager?.showDifficultyDialog(item, async (diff) => {
    await reviewApp.markReview(file.path, diff as Rating);
    await reviewApp.applyReviewStyles(app);
  });
}

/** 快捷标记（review-mark-again/hard/good/easy） */
export async function reviewMarkRating(app: App, rating: Rating): Promise<void> {
  ensureReview(app);
  const file = app.workspace.getActiveFile();
  if (!file) {
    notice('请先打开一个笔记');
    return;
  }
  const items = await dataManager!.loadItems();
  const item = items.find((i) => i.filePath === file.path);
  if (!item) {
    notice('该笔记不在复习计划中');
    return;
  }
  if (item.completed) {
    notice('该笔记已完成全部复习');
    return;
  }
  await reviewApp.markReview(file.path, rating);
  await reviewApp.applyReviewStyles(app);
}

/** 卸载清理 */
export function unloadReview(): void {
  initialized = false;
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  uiManager?.destroy();
  uiManager = null;
  dataManager = null;
  appRef = null;
}
