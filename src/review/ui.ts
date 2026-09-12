/**
 * 复习计划 UI（2026-09-04 拍板形态重写：三区队列面板；issue 253 起 markup 单源自 render.ts）
 *
 * 用户拍板（原型 rp1x 评审结论）：
 *  - 桌面右上角无设置按钮；「归档 / 统计」改为非按钮 → 沉到面板底部一条弱化信息行
 *  - 移动端无设置按钮（顶栏仅 ✕）；归档/统计同走移动归档钮 + 统计弹窗
 *  - 全部 emoji 换 lucide 图标
 *  - 三区列：已逾期 / 今天到期 / 未来；只有到期（逾期/今天）条目可点击开始答题（sprint）
 *  - 「开始本轮」= 逾期 + 今天批量进入做题冲刺（forceQuizForReview 关闭时 = 普通跳转复习）
 *  - 面板容器沿用 #review-mask/#review-popup id 几何契约，壳类接组件库
 *    .bz-panel-overlay/.bz-panel-frame（ADR-0094）；内容区三区队列渲染
 *  - 整窗冲刺由 SprintSession 驱动，宿主为 #review-entries-container 内容区
 *
 * issue 253（V1 原型为真理，评审壳行为单源化）：
 *  - markup 全部出自 ./render（queueViewHtml / 冲刺视图 / 难度弹窗 / 评级条），本文件只做
 *    生命周期/事件委托/数据流；评审壳经 prototype-behavior.js 跑同一份 ui.ts
 *  - V1 增量落地：卡片「待重做」红 tag 显性化；归档态状态条改绿点「已完成复习」；
 *    列内排序 置顶 → R 升序 → 到期（render.sortColumn）
 *
 * 公共面（对外契约不变）：UIManager / reviewSettingsSchema（re-export）/ isPlayable / isDueToday
 */
import { type App, type TFile } from 'obsidian';
import { topifyZ, allocZ } from '../core/z-order';
import { notice, notifyUndo, notifySaveError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { escManager } from '../core/esc-manager';
import { tryGetSettings } from '../core/settings-provider';
import { escapeHtml } from '../core/utils';
import { uiEmpty, mountIcons } from '../core/ui';
import { unregisterSheetCompanion } from '../core/item-actions';
import { DEFAULT_W } from './fsrs';
import type { ReviewItem } from './data';
import { ReviewDataManager } from './data';
import {
  queueViewHtml, sprintHeadHtml, sprintLoadingHtml, sprintQuestionHtml, sprintBodyHtml,
  sprintResultHtml, sprintSummaryHtml, difficultyDialogHtml, reviewBarHtml,
  isPlayable as isPlayableRender,
} from './render';
import { DEFAULT_R_THRESHOLD, isDueToday } from './queue';
import { SprintSession } from './sprint';
import type { SprintMode } from './sprint';
import type { QuizQuestion } from './quiz-core/manager';
import type { QuizMasterUI } from './quiz-core/session';

export { reviewSettingsSchema } from './settings-schema';
// item 6：isDueToday 下沉 queue.ts 纯函数（ui 保留 re-export 签名兼容）
export { isDueToday };
// issue 253：isPlayable 实现迁 render.ts（ui 保留 re-export 签名兼容）
export { isPlayableRender as isPlayable };

/** 到期可做题判定（render 实现；本文件内部沿用旧名） */
const isPlayable = isPlayableRender;

// issue 253：到期标签/可做题判定等纯口径随 markup 一并迁 render.ts（dueLabelOf/isPlayable/stageTagHtml/stageNum）

export class UIManager {
  app: App;
  dataManager: ReviewDataManager;
  /** R 展示口径权重源（item 12：与调度排期同读拟合权重；ensureReview 注入 reviewApp.currentW，缺省回退默认） */
  wSource: () => number[] = () => DEFAULT_W;
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  /** 内容区容器（队列/冲刺共用宿主） */
  entriesContainer: HTMLElement | null = null;
  /** 当前冲刺会话（内容区被占用时队列交互禁用） */
  private sprint: SprintSession | null = null;
  /** 冲刺入口 in-flight 防抖（双击/并发触发只放行一次，防双开会话双倍 AI 调用） */
  private sprintStarting = false;
  showArchived = false;
  private escHandle: { unregister: () => void } | null = null;

  constructor(app: App, dataManager: ReviewDataManager) {
    this.app = app;
    this.dataManager = dataManager;
    this.createMainUI();
    this.registerEscLayer();
  }

  get inSprint(): boolean {
    return !!this.sprint;
  }

  // ================= 面板构建 =================

  createMainUI(): void {
    if (this.mask && document.body.contains(this.mask)) return;
    // 面板壳接组件库（ADR-0094）：遮罩 = .bz-panel-overlay、面板 = .bz-panel-frame；
    // id 几何（居中定位/宽高/动画）仍由 #review-mask/#review-popup 域内规则接管
    this.mask = document.createElement('div');
    this.mask.id = 'review-mask';
    this.mask.classList.add('bz-panel-overlay');
    this.mask.style.display = 'none';
    this.mask.style.zIndex = String(allocZ());
    this.mask.onclick = () => {
      if (!this.sprint) this.hideMain();
    };

    this.popup = document.createElement('div');
    this.popup.id = 'review-popup';
    this.popup.classList.add('bz-panel-frame');
    // ≤768px 弹窗满宽近全屏：挂顶距工具类（44px 避让 Obsidian 移动端头，components.css 统一档）
    this.popup.classList.add('bz-panel-mtop');
    this.popup.style.display = 'none';
    this.popup.style.zIndex = String(allocZ());
    const content = document.createElement('div');
    content.id = 'review-entries-container';
    this.popup.appendChild(content);
    this.entriesContainer = content;

    document.body.appendChild(this.mask);
    document.body.appendChild(this.popup);
  }

  private registerEscLayer(): void {
    if (this.escHandle) return;
    this.escHandle = escManager.register('review-main', {
      isVisible: () => !!this.mask && this.mask.style.display === 'block',
      close: () => this.hideMain(),
    });
  }

  // ================= 显示/隐藏 =================

  async showMain(): Promise<void> {
    this.createMainUI();
    if (!this.mask || !this.popup) return;
    topifyZ(this.mask, this.popup);
    this.mask.style.display = 'block';
    this.popup.style.display = 'flex';
    await this.showQueue();
  }

  hideMain(): void {
    if (this.sprint) return; // 冲刺中不响应遮罩关闭
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  destroy(): void {
    // 先置空再销毁：destroy → finish → onExit → showQueue 不再对同一会话二次 destroy
    const sprint = this.sprint;
    this.sprint = null;
    sprint?.destroy();
    this.hideMain();
    if (this.escHandle) {
      this.escHandle.unregister();
      this.escHandle = null;
    }
    if (this.mask) this.mask.remove();
    if (this.popup) this.popup.remove();
    this.mask = null;
    this.popup = null;
    this.entriesContainer = null;
  }

  // ================= 队列渲染（三区） =================

  /** 读盘并渲染三区队列（外部刷新入口） */
  async refreshPanel(): Promise<void> {
    if (this.sprint) return;
    const items = await this.dataManager.loadItems();
    this.renderEntries(items);
  }

  /** 渲染队列视图（冲刺态不响应） */
  renderEntries(items: ReviewItem[]): void {
    if (this.sprint) return;
    const container = this.entriesContainer;
    if (!container) return;
    container.innerHTML = this.queueViewHtml(items);
    if (!items.length) {
      // item 10：空库两条路引导（组件库 uiEmpty 工厂）
      const host = container.querySelector('[data-empty-host]');
      if (host) {
        const acts = document.createElement('div');
        acts.className = 'bz-btn-row';
        const addBtn = document.createElement('button');
        addBtn.className = 'bz-btn bz-btn--primary';
        addBtn.dataset.act = 'add-current';
        addBtn.textContent = '把当前笔记加入复习';
        const helpBtn = document.createElement('button');
        helpBtn.className = 'bz-btn bz-btn--ghost';
        helpBtn.dataset.act = 'watch-help';
        helpBtn.textContent = '如何配置监听文件夹';
        acts.appendChild(addBtn);
        acts.appendChild(helpBtn);
        host.appendChild(
          uiEmpty({
            icon: 'inbox',
            title: '复习计划还是空的',
            desc: '在 设置 → 复习计划 → 监听文件夹 添加文件夹后，新笔记会自动加入复习；也可以先把当前笔记加入。',
            actions: acts,
          })
        );
      }
    }
    mountIcons(container);
    this.bindQueueEvents(container, items);
  }
  /** 切回队列视图（冲刺结束回调）；遇仍活动的会话先销毁再置空（防孤儿 ESC 层） */
  async showQueue(): Promise<void> {
    if (!this.entriesContainer) return;
    const active = this.sprint;
    this.sprint = null;
    active?.destroy();
    await this.refreshPanel();
  }

  // ================= 队列视图 HTML（markup 单源：render.queueViewHtml，issue 253） =================

  /** R 阈值提前复习判定（item 6：与开始本轮同口径；wSource=拟合权重） */
  private rThreshold(): number {
    const s = tryGetSettings() as any;
    return Number(s?.reviewRThreshold) || DEFAULT_R_THRESHOLD;
  }

  private queueViewHtml(items: ReviewItem[]): string {
    return queueViewHtml(items, {
      showArchived: this.showArchived,
      rThreshold: this.rThreshold(),
      w: this.wSource(),
    });
  }

  // ================= 队列事件 =================

  private bindQueueEvents(container: HTMLElement, items: ReviewItem[]): void {
    container.querySelector('[data-act="close"]')?.addEventListener('click', () => this.hideMain());
    // ⚙设置直达钮已退役（issue 254 迭代拍板）：设置走插件设置页，头行不再深链 settings-panel
    container.querySelector('[data-act="begin"]')?.addEventListener('click', () => void this.beginRound());
    container.querySelector('[data-act="arch"]')?.addEventListener('click', () => {
      this.showArchived = !this.showArchived;
      void this.refreshPanel();
    });
    container.querySelector('[data-act="stats"]')?.addEventListener('click', () => void this.openStats());
    // item 10：空态两条路（把当前笔记加入复习 / 监听文件夹配置说明）
    container.querySelector('[data-act="add-current"]')?.addEventListener('click', () => void this.addCurrentNote());
    container.querySelector('[data-act="watch-help"]')?.addEventListener('click', () => void this.showWatchHelp());
    // 搜索框已退役（issue 254 迭代拍板）
    // 卡片点击（到期条目 → 单条冲刺；.no = 未来/不可做，div 无 disabled 用类排除）
    container.querySelectorAll<HTMLElement>('.bz-q-card[data-id]:not(.no)').forEach((card) => {
      const activate = () => {
        const it = items.find((x) => x.id === card.dataset.id);
        if (it && isPlayable(it)) void this.beginSingle(it);
      };
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
    });
    // 右键/长按抽屉（保留既有统一抽屉：打开原文/查看历史/移出）
    container.querySelectorAll('.bz-q-card[data-id]').forEach((card) => {
      this.attachDrawer(card as HTMLElement, items);
    });
  }

  // ================= 空态两条路（item 10） =================

  /** 把当前笔记加入复习（空库引导动作；命令同语义） */
  private async addCurrentNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      notice('请先打开一个笔记', 'warning');
      return;
    }
    const { reviewApp } = await import('./app');
    try {
      await reviewApp.addCurrentToReview(file as TFile);
      await this.refreshPanel();
      await reviewApp.applyReviewStyles(this.app);
    } catch (e: any) {
      notice('加入复习计划失败：' + (e?.message || e) + '，请重试', 'error');
    }
  }

  /** 配置监听文件夹说明（空库引导动作；设置面板路径指路） */
  private async showWatchHelp(): Promise<void> {
    await openFlowDialog({
      title: '配置监听文件夹',
      message: '打开 设置 → 复习计划 → 监听文件夹，添加文件夹后，其中新建的笔记会自动加入复习计划；已存在的笔记可在添加时选择一并加入。',
      actions: [{ label: '知道了', value: 'ok', cta: true }],
    });
  }

  // ================= 冲刺入口（连接 app 编排） =================

  private async beginRound(): Promise<void> {
    if (this.sprintStarting) return; // 双击/并发防抖：只放行一次
    this.sprintStarting = true;
    try {
      const { reviewApp } = await import('./app');
      await reviewApp.autoJumpOverdue();
    } finally {
      this.sprintStarting = false;
    }
  }

  private async beginSingle(item: ReviewItem): Promise<void> {
    if (this.sprintStarting) return; // 双击/并发防抖：只放行一次
    this.sprintStarting = true;
    try {
      const { reviewApp } = await import('./app');
      await reviewApp.startSingleSprint(item);
    } finally {
      this.sprintStarting = false;
    }
  }

  /** 供 app 编排：进入做题冲刺会话（宿主接管内容区）。
   *  互斥：进入前强制销毁旧会话（防孤儿冲刺 ESC 层 + 旧题面覆盖队列视图）。 */
  startSprint(opts: {
    queue: ReviewItem[];
    mode: SprintMode;
    quiz: QuizMasterUI | null;
    /** item 8：连续复习天数（结算屏展示；由 app 层 computeStats 算好传入） */
    streakDays?: number;
    fetchQuestions: (item: ReviewItem) => Promise<QuizQuestion[] | null>;
    onPassed: (item: ReviewItem, rating: string, entry: { acc: number; wrong: number }) => Promise<void>;
    onFailed: (item: ReviewItem, rating: string, entry: { acc: number; wrong: number }) => Promise<void>;
  }): Promise<'done' | 'quit' | 'fail'> {
    const container = this.entriesContainer;
    if (!container) return Promise.resolve('quit');
    const old = this.sprint;
    this.sprint = null;
    old?.destroy();
    this.sprint = new SprintSession({
      app: this.app,
      host: container,
      queue: opts.queue,
      mode: opts.mode,
      quiz: opts.quiz,
      streakDays: opts.streakDays,
      fetchQuestions: opts.fetchQuestions,
      onPassed: opts.onPassed,
      onFailed: opts.onFailed,
      onExit: () => this.showQueue(),
    });
    return this.sprint.start();
  }

  // ================= 归档 / 统计 =================

  private async openStats(): Promise<void> {
    const { showStatsModal } = await import('./stats-ui');
    await showStatsModal(this.app, this.dataManager);
  }

  // ================= 难度弹窗（评分命令用；markup 单源 render.difficultyDialogHtml） =================

  showDifficultyDialog(item: ReviewItem, onSelect?: (diff: string) => void): void {
    const old = document.querySelector('.difficulty-dialog');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'difficulty-dialog';
    div.style.zIndex = String(allocZ());
    div.innerHTML = difficultyDialogHtml(item);
    document.body.appendChild(div);
    div.style.display = 'block';
    div.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        unregisterSheetCompanion(div);
        div.remove();
        const diff = (btn as HTMLElement).dataset.diff;
        if (diff !== 'cancel' && diff && onSelect) onSelect(diff);
      });
    });
    setTimeout(() => {
      const handler = (e: MouseEvent) => {
        if (!div.contains(e.target as Node)) {
          unregisterSheetCompanion(div);
          div.remove();
          document.removeEventListener('click', handler);
        }
      };
      document.addEventListener('click', handler);
    }, 100);
  }

  // ================= 抽屉（右键/长按） =================

  private attachDrawer(card: HTMLElement, items: ReviewItem[]): void {
    const item = items.find((x) => x.id === (card as HTMLElement).dataset.id);
    if (!item) return;
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.openDrawer(item, card);
    });
  }

  private async openDrawer(item: ReviewItem, anchor: HTMLElement): Promise<void> {
    const { attachItemActions, closeItemMenu } = await import('../core/item-actions');
    const actions: ItemActionLite[] = [
      {
        icon: 'file-text',
        label: '打开原文',
        onClick: () => void this.openItemFile(item),
      },
      {
        icon: 'history',
        label: '查看历史',
        onClick: () => {
          void (async () => {
            const { showTimeline } = await import('./stats-ui');
            showTimeline(this.app, this.dataManager, item);
          })();
        },
      },
      {
        icon: 'trash-2',
        label: '移出复习计划',
        kind: 'danger',
        onClick: () => {
          void openFlowDialog({
            title: '移出复习计划',
            message: `确定移出「${item.name}」吗？移出后可在通知中撤销。`,
            actions: [
              { label: '取消', value: 'cancel' },
              // danger（issue 291 评审补）：移出 = 删除该笔记的复习数据（可撤销但仍是删除类主动作）
              { label: '移出', value: 'ok', cta: true, danger: true },
            ],
          }).then(async (v) => {
            if (v !== 'ok') return;
            try {
              await this.dataManager.removeItem(item.filePath);
              await this.refreshPanel();
              const { reviewApp } = await import('./app');
              await reviewApp.applyReviewStyles(this.app);
              notifyUndo(`已移出「${item.name}」`, () => {
                void (async () => {
                  try {
                    await this.dataManager.restoreItem(item);
                    await this.refreshPanel();
                    const { reviewApp: ra } = await import('./app');
                    await ra.applyReviewStyles(this.app);
                  } catch (e) {
                    notifySaveError(e, '恢复复习条目');
                  }
                })();
              });
            } catch (e) {
              notifySaveError(e, '移出复习条目');
            }
          });
        },
      },
    ];
    attachItemActions(anchor, actions);
  }

  private async openItemFile(item: ReviewItem): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(item.filePath);
    if (!file) {
      notice(`笔记「${item.name}」的文件已删除`, 'warning');
      return;
    }
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file as TFile);
  }
}

/** 抽屉动作轻类型（避免引 core 类型依赖闭环） */
interface ItemActionLite {
  icon: string;
  label: string;
  kind?: 'danger';
  onClick: () => void;
}

// ================= 普通复习悬浮迷你评级条（item 4） =================

/** 屏幕底部挂悬浮迷你评级条（reviewLoop 存续期间）。返回句柄供收起（close 幂等）。
 *  issue 253：markup 单源 render.reviewBarHtml（四档语义/评级 class 契约不变）。 */
export function mountFloatingRatingBar(opts: {
  name: string;
  index: number;
  total: number;
  onRate: (rating: 'again' | 'hard' | 'good' | 'easy') => void;
  onSkip: () => void;
}): { close: () => void } {
  const el = document.createElement('div');
  el.className = 'bz-review-bar';
  el.style.zIndex = String(allocZ());
  el.innerHTML = reviewBarHtml(opts);
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    el.remove();
  };
  el.querySelectorAll<HTMLButtonElement>('.bz-review-bar-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.rating;
      if (r === 'skip') opts.onSkip();
      else if (r === 'again' || r === 'hard' || r === 'good' || r === 'easy') opts.onRate(r);
      close(); // 点评级/跳过即收起（评级路径由轮询翻篇重建下一条的评级条）
    });
  });
  document.body.appendChild(el);
  return { close };
}
