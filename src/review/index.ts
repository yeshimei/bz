/**
 * 复习计划入口（ticket 16 修正版：对齐源码 entry，含 4 快捷命令与完整事件监听）
 * 命令（review-*）由 main.ts 裸注册（含 review-mark-again/hard/good/easy）。
 */
import { stripMdExt } from '../core/utils';
import type { App } from 'obsidian';
import { notice, notifyUndo, notifySaveError, notifyActionError } from '../core/notice';
import { onDomainEvent, emitDomainEvent } from '../core/domain-bus';
import { ReviewDataManager, isCardItem } from './data';
import { ReviewWatcher } from './watch';
import { UIManager } from './ui';
import { reviewApp } from './app';
import { openQuizPanel, unloadQuizPanel } from './quiz-panel';
import { resetQuiz } from './quiz-core';
import { closeStatsModal } from './stats-ui';
import { unloadReviewAnalysis } from './analysis/index';
import { cancelActiveFlowDialog } from '../core/flow-dialog';
import type { Rating } from './fsrs';
import { setReviewPlanApi } from './reader-api';
import { cardModeOf, ensureCardContent, queueCardPreparation, safeMakeAI, type CardMode, type CardPrepareContext } from './card-ai';
import { getCardQuiz, saveCardQuiz } from './card-quiz-store';
import {
  addNote as planAddNote,
  addNotes as planAddNotes,
  hasNote as planHasNote,
  removeNote as planRemoveNote,
  addCards as planAddCards,
  removeCard as planRemoveCard,
  statusOf as planStatusOf,
} from './plan-ops';

let initialized = false;
export let dataManager: ReviewDataManager | null = null;
export let uiManager: UIManager | null = null;
export let reviewWatcher: ReviewWatcher | null = null;
let checkInterval: ReturnType<typeof setInterval> | null = null;
/** P3：2s 首查句柄（卸载时取消，防卸载后仍触发逾期检查） */
let firstCheckTimer: ReturnType<typeof setTimeout> | null = null;
/** P2：ensureReview 注册的全部退订函数（unload 统一调用，防卸载后监听残留双触发） */
let unsubscribers: (() => void)[] = [];

/**
 * 卡片 AI 内容的生成上下文。
 *
 * 闭包读模块级 dataManager：unloadReview 把它置空后，排队里的任务自然读到
 * null 各自退出，不会拿着已销毁的数据层继续写盘。
 */
function cardPrepareCtx(mode: CardMode): CardPrepareContext {
  return {
    mode,
    loadCard: async (key) => {
      if (!dataManager) return null;
      const items = await dataManager.loadItems();
      return items.find((i) => i.filePath === key && isCardItem(i))?.card ?? null;
    },
    updateCard: (key, patch) => (dataManager ? dataManager.updateCard(key, patch) : Promise.resolve(false)),
    loadQuiz: (key) => getCardQuiz(key),
    saveQuiz: (key, questions) => saveCardQuiz(key, questions),
    makeAI: safeMakeAI,
  };
}

/**
 * 重新生成一张卡的 AI 内容（复习面板右键菜单 / 复习会话里的「重新生成」）。
 *
 * 当前方式是「展开全文」时按抽认卡生成——这档本来不用模型，但用户既然点了
 * 「重新生成」，多半是在为以后切回抽认卡做准备。
 *
 * 返回是否真的换了内容；生成失败返回 false（不清旧内容，卡片照常能复习）。
 */
export async function regenerateCardContent(key: string): Promise<boolean> {
  if (!dataManager) return false;
  const items = await dataManager.loadItems();
  const card = items.find((i) => i.filePath === key && isCardItem(i))?.card;
  if (!card) return false;
  const mode = cardModeOf();
  try {
    return await ensureCardContent(card, cardPrepareCtx(mode === 'plain' ? 'flashcard' : mode), true);
  } catch {
    return false;
  }
}

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
  return { path, basename: stripMdExt(base), extension: 'md' };
}

/**
 * 外部（bz-reader）把卡片加进计划之后的收尾：行为流记账 + 面板即时补卡。
 *
 * 与 reviewRemoveCurrent 的 removed 事件同一套（issue 261 的小橘行为流）。
 * 面板刷新失败不影响「已经加进去了」这个事实，所以只吞掉、不往回抛——
 * 阅读器那边拿到异常只会弹一句看不懂的红字。
 */
function notePlanAdded(path: string): void {
  const title = stripMdExt(String(path ?? '').split('/').pop() || '');
  emitDomainEvent('review', { kind: 'added', title });
  if (uiManager) void uiManager.refreshPanel().catch(() => undefined);
}

/** 幂等初始化（对齐源码 entry：UI 构建 + 事件监听 + 2s 后首查 + 60s 周期） */
export function ensureReview(app: App): void {
  if (initialized) return;
  initialized = true;
  dataManager = new ReviewDataManager(app);
  // A11：注入共享单例（消除 reviewApp 自持/入口面板双实例并存；reviewApp.ensure 保留缺省兜底防独立调用时序）
  reviewApp.dataManager = dataManager;
  /* 对外门面（bz-reader 的「划线 → 复习卡」，ADR-0294 同范式）：注册一次，卸载置空。
     闭包读模块级 dataManager / uiManager，而不是捕获此刻的实例——unloadReview 会把
     门面和这两个字段一起清掉，不存在「门面还活着、数据层已经没了」的窗口。 */
  setReviewPlanApi({
    isReady: () => !!dataManager,
    hasNote: async (path) => (dataManager ? planHasNote(dataManager, path) : false),
    addNote: async (path) => {
      if (!dataManager) return { added: false, reason: 'notFound' };
      const res = await planAddNote(dataManager, app, path);
      if (res.added) notePlanAdded(path);
      return res;
    },
    addNotes: async (paths) => {
      if (!dataManager) return { added: 0, exists: 0, notFound: 0 };
      const res = await planAddNotes(dataManager, app, paths);
      if (res.added) notePlanAdded(paths[0] ?? '');
      return res;
    },
    removeNote: async (path) => (dataManager ? planRemoveNote(dataManager, path) : false),
    /* 划线卡：内容进排期表，不落文件。加完刷新面板，队列里立刻能看到。
       AI 内容按当前复习方式在后台补（加入那一刻生成一次，之后固定）——
       不在这里 await，阅读器该立刻拿到「已加入」。 */
    addCards: async (cards) => {
      if (!dataManager) return { added: 0, exists: 0, notFound: 0 };
      const res = await planAddCards(dataManager, cards);
      if (res.added) {
        notePlanAdded(cards[0]?.key ?? '');
        void queueCardPreparation(res.addedKeys ?? [], cardPrepareCtx(cardModeOf()));
      }
      return res;
    },
    removeCard: async (key) => (dataManager ? planRemoveCard(dataManager, key) : false),
    /* 只读查询：不触发 notePlanAdded（没加东西），也不刷新面板 */
    statusOf: async (paths) => (dataManager ? planStatusOf(dataManager, paths) : []),
  });
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
    // F9：vault modify 高频路径改走单文件刷新（复用 60s 轮询快照/按需单读，不再每次保存任意 md 全量读）
    if (file.extension === 'md') await reviewApp.applyReviewStylesForFile(app, file);
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

/** 记忆分析特刊（bz-review-analysis）：全屏逐幕分析层（analysis/）——
 *  空库/无动画宿主/装配失败在层内回落经典统计弹层（press 降级口径） */
export async function openReviewAnalysis(app: App): Promise<void> {
  ensureReview(app);
  const mod = await import('./analysis/index');
  await mod.openReviewAnalysis(app);
}

/** 做题练习独立面板（bz-review-quiz-open，issue 362）：quiz-core 引擎 + 做题会话契约的
 *  直接消费壳——不进复习流程、不写排期（域内 feature 文件静态引入，unloadReview 统一收口）。 */
export function openQuizPractice(app: App): void {
  void openQuizPanel(app);
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
    // C9：动作失败提示走 notifyActionError 单源（白拿 onRetry 挂「重试」出口，效率整改 8）
    notifyActionError(e, '加入复习计划', { onRetry: () => void reviewAddCurrent(app) });
  }
}

/** 移出复习计划（review-remove-current）：A12/E1/C1——免前置确认直达 notifyUndo
 *  （效率整改 5 定稿口径：接了 notifyUndo 的删除不再二次确认，restoreItem 撤销链兜底误删）；
 *  写盘/刷新链包 try/catch + notifySaveError（对齐抽屉同动作口径，写失败不再零反馈） */
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
  try {
    await dataManager!.removeItem(file.path);
    // 行为流（issue 261）：移出复习计划入小橘行为流（review:removed）
    emitDomainEvent('review', { kind: 'removed', title: file.basename });
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
  } catch (e) {
    notifySaveError(e, '移出复习条目');
  }
}

/** 跳转逾期复习（bz-review-overdue；R12 动宾式更名前为「复习（跳转逾期）」） */
export async function reviewJumpOverdue(app: App): Promise<void> {
  ensureReview(app);
  await reviewApp.autoJumpOverdue();
}

/** 开始复习（进入复习流程）：跳过逾期 → 出题/复习循环（review-start） */
export async function reviewStart(app: App): Promise<void> {
  ensureReview(app);
  await reviewApp.autoJumpOverdue();
}

/** 选择复习难度（bz-review-rate；R12 动宾式更名前为「复习（选择难度）」） */
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
  /* 先摘对外门面：外部插件在本域卸载后再调，拿到的必须是 null 而不是
     一个还攥着旧 app 的闭包 */
  setReviewPlanApi(null);
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
  // A3/U3：浮层与会话态清场——统计/历史弹窗（closeStatsModal 内部连带 closeTimeline）、
  // 在途 flow-dialog（难度弹窗已迁 flow-dialog 形态，main onunload 亦调，幂等）、
  // 文件树染色回退、进度通知收起、diff 记忆清空（禁用→再启用后存量逾期重新提醒）
  closeStatsModal();
  cancelActiveFlowDialog();
  reviewApp.revertReviewStyles();
  if (reviewApp._reviewNotice?.el?.isConnected) reviewApp._reviewNotice.hide();
  reviewApp._reviewNotice = null;
  reviewApp._notifiedOverdue.clear();
  // 做题练习独立面板（issue 362）：会话在途契约强制收口 + 面板 DOM/ESC 层摘除
  unloadQuizPanel();
  // 记忆分析特刊层（analysis/）：引擎/监听/ESC 句柄随域卸载收口（幂等）
  unloadReviewAnalysis();
  // F6：quiz-core 单例 initialized/ai 复位——禁用→再启用后 ensureQuiz 重建 AI/设置引用（否则旧配置常驻）
  resetQuiz();
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
