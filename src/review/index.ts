/**
 * 复习计划入口（ticket 16 修正版：对齐源码 entry，含 4 快捷命令与完整事件监听）
 * 命令（review-*）由 main.ts 裸注册（含 review-mark-again/hard/good/easy）。
 */
import type { App } from 'obsidian';
import { notice, notifyUndo, notifySaveError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { onDomainEvent } from '../core/domain-bus';
import { ReviewDataManager } from './data';
import { ReviewWatcher } from './watch';
import { UIManager } from './ui';
import { reviewApp } from './app';
import type { Rating } from './fsrs';

let initialized = false;
export let dataManager: ReviewDataManager | null = null;
export let uiManager: UIManager | null = null;
export let reviewWatcher: ReviewWatcher | null = null;
let checkInterval: ReturnType<typeof setInterval> | null = null;
/** P3：2s 首查句柄（卸载时取消，防卸载后仍触发逾期检查） */
let firstCheckTimer: ReturnType<typeof setTimeout> | null = null;
/** P2：ensureReview 注册的全部退订函数（unload 统一调用，防卸载后监听残留双触发） */
let unsubscribers: (() => void)[] = [];

/** 原生事件注册即记账（把 offref 语义包装成退订函数：真实 Obsidian 与测试 mock 均按 ref 注销） */
function listen(source: any, event: string, cb: (...args: any[]) => void): void {
  const ref = source.on(event, cb);
  if (!ref) return;
  unsubscribers.push(() => source.offref?.(ref));
}

/** 总线订阅即记账（onDomainEvent 返回幂等退订函数，直接入账） */
function listenBus<E>(channel: string, cb: (evt: E) => void): void {
  unsubscribers.push(onDomainEvent(channel, cb));
}

/** 总线载荷 → watcher 方法签名所需的伪 TFile（仅路径派生字段，满足签名即可） */
function pseudoMdFile(path: string): any {
  const base = path.split('/').pop() || '';
  return { path, basename: base.replace(/\.md$/, ''), extension: 'md' };
}

/** 幂等初始化（对齐源码 entry：UI 构建 + 事件监听 + 2s 后首查 + 60s 周期） */
export function ensureReview(app: App): void {
  if (initialized) return;
  initialized = true;
  reviewApp.ensure(app);
  dataManager = new ReviewDataManager(app);
  uiManager = new UIManager(app, dataManager);
  // item 12：R 展示与调度排期同口径——UI 层权重源接拟合权重 currentW()（拟合重算后自动生效）
  uiManager.wSource = () => reviewApp.currentW();
  reviewWatcher = new ReviewWatcher(app, dataManager);
  // ADR-0077：启动加载拟合参数（个人化记忆曲线优先，回退默认）
  void reviewApp.loadFitParams(app).catch(() => {});

  // P3：首查句柄入账，卸载时取消（2s 内禁用插件不再触发逾期检查/周期注册）
  firstCheckTimer = setTimeout(() => {
    firstCheckTimer = null;
    reviewApp.checkOverdueAndNotify();
    checkInterval = setInterval(() => reviewApp.checkOverdueAndNotify(), 60000);
  }, 2000);

  // 事件监听（metadataCache resolved / vault modify / workspace quit 保持原生订阅；
  // created/deleted/renamed 已迁域事件总线，见下方总线接线）
  listen(app.metadataCache as any, 'resolved', async () => {
    await reviewApp.applyReviewStyles(app);
  });
  listen(app.vault as any, 'modify', async (file: any) => {
    if (file.extension === 'md') await reviewApp.applyReviewStyles(app, file);
  });
  // ticket 098：监听文件夹自动加入（created）+ 删除/改名/移动确认（deleted/renamed）——
  // 订域事件总线通用兜底通道（obsidian-adapter 恒发、仅 md，载荷见 src/core/obsidian-adapter.ts），
  // 目录过滤逻辑留在 ReviewWatcher 内部
  listenBus<{ path: string }>('vault:md-created', (evt) => {
    void reviewWatcher?.onVaultCreate(pseudoMdFile(evt.path));
  });
  listenBus<{ path: string }>('vault:md-deleted', (evt) => {
    reviewWatcher?.onVaultDelete(pseudoMdFile(evt.path));
  });
  listenBus<{ oldPath: string; newPath: string }>('vault:md-renamed', (evt) => {
    const file = pseudoMdFile(evt.newPath);
    file.oldPath = evt.oldPath;
    reviewWatcher?.onVaultRename(file, evt.oldPath);
  });
  listen(app.workspace as any, 'quit', () => {
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

/** 复习计划分析报告（review-report）：独立命令，直接打开统计弹窗（ticket 174） */
export async function openReviewReport(app: App): Promise<void> {
  ensureReview(app);
  const { showStatsModal } = await import('./stats-ui');
  await showStatsModal(app, dataManager!);
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
    notice('加入复习计划失败：' + e.message + '，请重试', 'error');
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
  const target = items.find((i) => i.filePath === file.path);
  if (!target) {
    notice('该笔记不在复习计划中');
    return;
  }
  void openFlowDialog({
    title: '移出复习计划',
    message: `确定把「${file.basename}」移出复习计划吗？所有复习数据将被删除，移出后可在通知中撤销。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '移出', value: 'ok', cta: true },
    ],
  }).then(async (v) => {
    if (v !== 'ok') return;
    await dataManager!.removeItem(file.path);
    notifyUndo(`已移出「${file.basename}」`, () => {
      void (async () => {
        try {
          await dataManager!.restoreItem(target);
          await uiManager!.refreshPanel();
        } catch (e) {
          notifySaveError(e, '恢复复习条目');
        }
      })();
    });
    await uiManager!.refreshPanel();
    await reviewApp.applyReviewStyles(app);
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
  if (firstCheckTimer) {
    clearTimeout(firstCheckTimer);
    firstCheckTimer = null;
  }
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  // P3：终止 reviewLoop 1s 轮询 + 释放单例 dataManager（插件禁用后不得继续读盘/持旧 app 引用）
  reviewApp.stopReviewLoops();
  reviewApp.dataManager = null;
  // P2：全部退订函数统一调用（原生 offref + 总线退订），防卸载后旧监听残留（再 ensure 后事件双触发）
  for (const off of unsubscribers) {
    try {
      off();
    } catch (e) {
      /* 单个注销失败不阻断其余清理 */
    }
  }
  unsubscribers = [];
  uiManager?.destroy();
  uiManager = null;
  dataManager = null;
  reviewWatcher?.destroy();
  reviewWatcher = null;
}
