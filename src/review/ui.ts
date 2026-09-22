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
 * 深审批 C（2026-09-19）：
 *  - U4/A4/E7/U10 难度弹窗迁 openFlowDialog choice 形态（ESC/遮罩/焦点 core 单源收口 +
 *    1-4 快捷键 + onSelect promise 兜底），旧自绘 .difficulty-dialog 不再产出
 *  - E1/C1 抽屉「移出复习计划」免确认直达 notifyUndo（效率整改 5 口径）
 *  - E6 队列重建前记录三区列滚位与焦点控件，重建后还原
 *  - C15 构造期 allocZ 删（ADR-0067 仅显示时 topifyZ 发号）；ESC 层 id 改 'bz-review-main'
 *
 * 公共面（对外契约不变）：UIManager / reviewSettingsSchema（re-export）/ isPlayable / isDueToday
 */
import { type App, type TFile } from 'obsidian';
import { topifyZ, allocZ } from '../core/z-order';
import { trapPanelFocus } from '../core/ui/focus-trap';
import { notice, notifyUndo, notifySaveError, notifyActionError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { escManager } from '../core/esc-manager';
import { tryGetSettings } from '../core/settings-provider';
import { uiEmpty, mountIcons } from '../core/ui';
import { DEFAULT_W } from './fsrs';
import type { ReviewItem } from './data';
import { ReviewDataManager } from './data';
import {
  queueViewHtml, sprintHeadHtml, sprintLoadingHtml, sprintQuestionHtml, sprintBodyHtml,
  sprintResultHtml, sprintSummaryHtml, reviewBarHtml,
  isPlayable as isPlayableRender,
} from './render';
import {
  motionQueueBoot, motionChargeStrip, motionDrawCard, motionTeardown, motionRatingBar,
} from './motion';
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

/** E6 焦点记忆：面板内焦点控件 → data-* 特征键（data-id=… / data-act=…），null = 无可记忆焦点 */
function captureFocusKey(scope: HTMLElement): string | null {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || !scope.contains(el)) return null;
  for (const attr of ['data-id', 'data-act']) {
    const v = el.getAttribute(attr);
    if (v != null) return `${attr}=${v}`;
  }
  return null;
}

/** E6 焦点还原：按特征键在重建后的容器内找回同位控件并聚焦（找不到则静默放弃） */
function restoreFocusKey(scope: HTMLElement, key: string): void {
  const eq = key.indexOf('=');
  const el = scope.querySelector<HTMLElement>(`[${key.slice(0, eq)}="${CSS.escape(key.slice(eq + 1))}"]`);
  el?.focus({ preventScroll: true });
}

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
  /** 动效 boot 消费标志：showMain 置位，首个 renderEntries 消费（后台刷新静默不重播） */
  private motionBootPending = false;

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
    // C15（ADR-0067）：构造期不发号——display:none 壳不占号，showMain 时 topifyZ 统一发号
    this.mask.onclick = () => {
      if (!this.sprint) this.hideMain();
    };

    this.popup = document.createElement('div');
    this.popup.id = 'review-popup';
    this.popup.classList.add('bz-panel-frame');
    // ≤768px 弹窗满宽近全屏：挂顶距工具类（44px 避让 Obsidian 移动端头，components.css 统一档）
    this.popup.classList.add('bz-panel-mtop');
    this.popup.style.display = 'none';
    const content = document.createElement('div');
    content.id = 'review-entries-container';
    this.popup.appendChild(content);
    this.entriesContainer = content;

    document.body.appendChild(this.mask);
    document.body.appendChild(this.popup);
  }

  private registerEscLayer(): void {
    if (this.escHandle) return;
    // U5/C7：层 id 统一 `bz-<域>` 约定（原 'review-main' 无前缀）
    this.escHandle = escManager.register('bz-review-main', {
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
    this.motionBootPending = true; // 动效首屏编排由紧随的 renderEntries 消费
    // 打开即入焦 + Tab 圈闭（呈报#13 F3+H3 全域范式，core trapPanelFocus 单源）
    trapPanelFocus(this.popup);
    await this.showQueue();
  }

  hideMain(): void {
    if (this.sprint) return; // 冲刺中不响应遮罩关闭
    motionTeardown(); // 动效延时编排随面板收场
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  destroy(): void {
    // 先置空再销毁：destroy → finish → onExit → showQueue 不再对同一会话二次 destroy
    const sprint = this.sprint;
    this.sprint = null;
    sprint?.destroy();
    motionTeardown();
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

  /** 渲染队列视图（冲刺态不响应）。
   *  E6：重建前记录三区列各 scrollTop 与面板内焦点控件（data-* 定位），重建后还原——
   *  翻篇/冲刺回收等一切刷新不再把滚位打回顶部、不再丢键盘焦点。 */
  renderEntries(items: ReviewItem[]): void {
    if (this.sprint) return;
    const container = this.entriesContainer;
    if (!container) return;
    const focusKey = captureFocusKey(container);
    const scrollTops = new Map<string, number>();
    container.querySelectorAll<HTMLElement>('.bz-q-col').forEach((col) => {
      scrollTops.set(col.className, col.scrollTop);
    });
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
    // E6 还原：先滚位（focus 用 preventScroll 不扰动），后焦点
    container.querySelectorAll<HTMLElement>('.bz-q-col').forEach((col) => {
      const top = scrollTops.get(col.className);
      if (top != null) col.scrollTop = top;
    });
    if (focusKey) restoreFocusKey(container, focusKey);
    this.bindQueueEvents(container, items);
    // 动效：仅首屏编排（boot 消费即熄）；刷新渲染静默（E6 滚位/焦点还原不受扰动）
    if (this.motionBootPending) {
      this.motionBootPending = false;
      motionQueueBoot(container);
    }
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
    container.querySelector('[data-act="begin"]')?.addEventListener('click', () => {
      const strip = container.querySelector<HTMLElement>('.bz-q-strip');
      if (strip) motionChargeStrip(strip); // 蓄力涟漪：出发的召唤感
      void this.beginRound();
    });
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
        if (it && isPlayable(it)) {
          motionDrawCard(card); // 抽卡手感：先一记「抽走」再切题面
          void this.beginSingle(it);
        }
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
      // C9：动作失败提示走 core 单源（不再手拼「X失败：msg，请重试」）
      notifyActionError(e, '加入复习计划');
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

  // ================= 难度弹窗（评分命令用；U4/A4/E7/U10 迁 openFlowDialog choice 形态） =================

  /** 四档评级 + 取消：ESC/遮罩/焦点圈闭/关闭还原焦点全由 core flow-dialog 单源收口
   *  （旧自绘 .difficulty-dialog 的 ESC 关错层、外点穿透、companion 残留随之消亡）。
   *  1-4 直达档位（对齐做题模式键盘化拍板）；onSelect 的 promise 兜底 catch + notifySaveError。 */
  showDifficultyDialog(item: ReviewItem, onSelect?: (diff: string) => void): void {
    const report = (diff: string): void => {
      if (!onSelect) return;
      try {
        // 调用方（bz-review-rate 命令）实为 async 回调：签名 void 但运行时返回 promise，
        // 兜底 catch 防 unhandled rejection（U10）
        const r = onSelect(diff) as unknown;
        if (r instanceof Promise) r.catch((e: unknown) => notifySaveError(e, '标记复习'));
      } catch (e) {
        notifySaveError(e, '标记复习');
      }
    };
    // 1-4 快捷键：flow-dialog 多动作按钮 id 契约 `bz-flow-dialog-action-<i>`；修饰键组合不劫持；
    // settle 后按钮 DOM 已移除，getElementById 自然失配（监听随 promise 结算统一摘除）
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i < 0) return;
      const btn = document.getElementById(`bz-flow-dialog-action-${i}`);
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    };
    document.addEventListener('keydown', onKey);
    void openFlowDialog({
      title: `标记复习：${item.name}`,
      message: '选择本次复习的难度（快捷键 1-4）',
      actions: [
        { label: '忘了（Again）', value: 'again' },
        { label: '困难（Hard）', value: 'hard' },
        { label: '一般（Good）', value: 'good' },
        { label: '简单（Easy）', value: 'easy' },
        { label: '取消', value: 'cancel' },
      ],
    }).then((v) => {
      document.removeEventListener('keydown', onKey);
      if (v && v !== 'cancel') report(v);
    });
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
          // E1/C1（效率整改 5 口径）：撤销链已在位（notifyUndo + restoreItem 原样插回），
          // 删除免确认直达——不再弹 openFlowDialog 双保险
          void (async () => {
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
          })();
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
 *  issue 253：markup 单源 render.reviewBarHtml（四档语义/评级 class 契约不变）。
 *  呈报#12-R8 键盘化：挂载即焦点入条（tabindex=-1 容器）→ 数字键 1-4 评级（翻篇主路径
 *  全程可键盘完成）；焦点被用户主动拿回输入框/文本域时数字键放行（不劫持打字）；
 *  ESC 在条内局部监听归还焦点（条保留，复习未完可再评级）——不私挂 document 级 ESC
 *  （esc-manager 立约：ESC 一律走层级注册）。close 时注销 document 数字键监听。 */
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
  el.tabIndex = -1; // 程序化 focus 落点（容器不进 Tab 序，键盘 Tab 仍直达各评级按钮）
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onDigitKey);
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
  // 数字键 1-4 评级（document 级，先例 showDifficultyDialog 同形制）：输入态放行不劫持打字
  const onDigitKey = (e: KeyboardEvent): void => {
    if (closed) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i < 0) return;
    const btn = el.querySelectorAll<HTMLButtonElement>('.bz-review-bar-btn')[i];
    if (btn) {
      e.preventDefault();
      btn.click();
    }
  };
  document.addEventListener('keydown', onDigitKey);
  // ESC 归还焦点：条内局部监听（keydown 自条冒泡，容器截停后不到 document/escManager）——
  // 只归还焦点不关条：普通轮尚未结束，条消失键盘用户就没有评级入口了
  const prevFocus = document.activeElement as HTMLElement | null;
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    if (prevFocus && typeof prevFocus.focus === 'function' && prevFocus !== document.body) prevFocus.focus();
    else el.blur();
  });
  document.body.appendChild(el);
  motionRatingBar(el); // 底部弹升入场（保留 translateX(-50%) 居中）
  el.focus({ preventScroll: true });
  return { close };
}
