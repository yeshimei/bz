/**
 * 复习计划 UI（2026-09-04 拍板形态重写：三区队列面板）
 *
 * 用户拍板（原型 rp1x 评审结论）：
 *  - 桌面右上角无设置按钮；「归档 / 统计」改为非按钮 → 沉到面板底部一条弱化信息行
 *    （「已完成 N 篇 · 点此查看归档」「累计复习 X 次 · 连续 Y 天 · 点此看分布」）
 *  - 移动端无设置按钮（顶栏仅 ✕）；归档/统计同走移动归档钮 + 统计弹窗
 *  - 全部 emoji 换 lucide 图标
 *  - 三区列：已逾期 / 今天到期 / 未来；只有到期（逾期/今天）条目可点击开始答题（sprint）
 *  - 「开始本轮」= 逾期 + 今天批量进入做题冲刺（forceQuizForReview 关闭时 = 普通跳转复习）
 *  - 面板容器沿用 #review-mask/#review-popup（core 主窗口规范）；内容区三区队列渲染
 *  - 整窗冲刺由 SprintSession 驱动，宿主为 #review-entries-container 内容区
 *
 * 公共面（对外契约不变）：UIManager / reviewSettingsSchema（re-export）
 */
import { type App, TFile } from 'obsidian';
import { topifyZ, allocZ } from '../core/z-order';
import { notice, notifyUndo, notifySaveError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { escManager } from '../core/esc-manager';
import { tryGetSettings } from '../core/settings-provider';
import { escapeHtml } from '../core/utils';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { uiIcon } from '../core/ui';
import { unregisterSheetCompanion } from '../core/item-actions';
import { FSRS, DEFAULT_W, LADDER_MAX, TOTAL_STAGES } from './fsrs';
import type { ReviewItem } from './data';
import { ReviewDataManager } from './data';
import { computeStats } from './stats';
import { partitionQueue, roundQueue, isDueToday, isEarlyDue } from './queue';
import { uiEmpty } from '../core/ui';
import { SprintSession } from './sprint';
import type { SprintMode } from './sprint';
import type { QuizQuestion } from './quiz-core/manager';
import type { QuizMasterUI } from './quiz-core/session';

export { reviewSettingsSchema } from './settings-schema';
// item 6：isDueToday 下沉 queue.ts 纯函数（ui 保留 re-export 签名兼容）
export { isDueToday };

/** 到期标签工具 */
function dueLabelOf(item: ReviewItem): { label: string; cls: string } {
  if (item.isMissing) return { label: '文件缺失', cls: 'is-missing' };
  if (item.isCompleted) return { label: '已完成', cls: 'is-done' };
  if (!item.nextReviewDate) return { label: '待定', cls: 'is-future' };
  const diff = new Date(item.nextReviewDate).getTime() - Date.now();
  if (diff > 0) {
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return { label: `${days} 天后`, cls: 'is-future' };
    if (hours > 0) return { label: `${hours} 小时后`, cls: 'is-future' };
    return { label: `${Math.max(1, Math.floor(diff / 60000))} 分钟后`, cls: 'is-future' };
  }
  return { label: '已逾期', cls: 'is-overdue' };
}

/** 是否可做题（到期：逾期/今天；已完成/挂起/未来 → 不可） */
export function isPlayable(item: ReviewItem): boolean {
  if (item.isMissing || item.isCompleted || item.completed) return false;
  if (!item.nextReviewDate) return false;
  return new Date(item.nextReviewDate).getTime() <= Date.now();
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
  private searchTimer: number | null = null;
  searchText = '';
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
    this.mask = document.createElement('div');
    this.mask.id = 'review-mask';
    this.mask.style.display = 'none';
    this.mask.style.zIndex = String(allocZ());
    this.mask.onclick = () => {
      if (!this.sprint) this.hideMain();
    };

    this.popup = document.createElement('div');
    this.popup.id = 'review-popup';
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
    applyMobileWindowFullscreen(this.popup, tryGetSettings().reviewMobileDefaultFullscreen === true);
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
    if (this.searchTimer !== null) {
      window.clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
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
    this.renderEntries(items, this.searchText);
  }

  /** 渲染队列视图（冲刺态不响应） */
  renderEntries(items: ReviewItem[], searchText = ''): void {
    if (this.sprint) return;
    const container = this.entriesContainer;
    if (!container) return;
    this.searchText = searchText;
    container.innerHTML = this.queueViewHtml(items, searchText);
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
    this.mountIcons(container);
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

  // ================= 队列视图 HTML =================

  /** R 阈值提前复习判定（item 6：与开始本轮同口径；wSource=拟合权重） */
  private rThreshold(): number {
    const s = tryGetSettings() as any;
    return Number(s?.reviewRThreshold) || 0.9;
  }

  private isEarly(it: ReviewItem): boolean {
    return isEarlyDue(it, this.rThreshold(), this.wSource());
  }

  private queueViewHtml(items: ReviewItem[], searchText: string): string {
    const kw = searchText.trim().toLowerCase();
    const vis = kw ? items.filter((i) => i.name.toLowerCase().includes(kw)) : items;
    // item 6：三区列走 partitionQueue 纯函数（与开始本轮 roundQueue 同源口径；提前卡落「今天」列）
    const rt = this.rThreshold();
    const w = this.wSource();
    const col = partitionQueue(items, rt, w);
    const visCol = partitionQueue(vis, rt, w);
    const over = visCol.overdue;
    const today = visCol.today;
    const future = visCol.future;
    const done = visCol.done;

    // item 8：今日全清（开始本轮集合为空 = 逾期/今日/提前全无）→ 绿点 +「今日已清空」+ 隐藏主按钮
    const round = roundQueue(items, this.rThreshold(), this.wSource());
    const clearToday = !round.length;
    const futureCount = col.future.length;

    const head = `
      <div class="bz-q-head">
        <div class="t">
          <div class="bz-q-title">复习计划</div>
          <div class="bz-q-sub">${this.todayLabel()}</div>
        </div>
        <div class="tools">
          <button class="bz-icon-btn bz-win-close" data-act="close" title="关闭">${this.icon('x')}</button>
        </div>
      </div>
      <div class="bz-q-tools">
        <div class="bz-q-search${searchText ? ' typing' : ''}">${this.icon('search')}<input type="text" id="bz-q-search" placeholder="搜索笔记…" value="${escapeHtml(searchText)}"></div>
      </div>`;

    // item 10：空库 → 头行 + 清空条 + 空态宿主（uiEmpty 于 renderEntries 挂载并绑两条路动作）
    if (!items.length) {
      const strip = `
      <div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>今日已清空</strong>
        <span class="bz-q-strip-txt">还没有任何复习条目</span>
      </div>`;
      return `<div class="bz-q-view">${head}${strip}<div class="bz-q-cols bz-q-empty-wrap"><div data-empty-host></div></div></div>`;
    }

    const strip = clearToday
      ? `<div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>今日已清空</strong>
        <span class="bz-q-strip-txt">${futureCount ? `未来还有 ${futureCount} 篇待复习` : '没有待复习条目'}</span>
      </div>`
      : `<div class="bz-q-strip">
        <span class="bz-q-strip-dot"></span>
        <strong>开始本轮</strong>
        <span class="bz-q-strip-txt">${this.showArchived ? '查看已完成复习' : `今日 ${col.today.length} 篇到期 · 逾期 ${col.overdue.length} 篇顺延`}</span>
        ${this.showArchived ? '' : `<button class="bz-btn bz-btn--primary" data-act="begin">开始本轮</button>`}
      </div>`;

    const body = this.showArchived
      ? `<div class="bz-q-cols"><div class="bz-q-col done">${this.colHead(done.length, '已完成')}${this.cardsOf(done)}</div></div>`
      : `<div class="bz-q-cols">
          <div class="bz-q-col danger">${this.colHead(col.overdue.length, '已逾期')}${this.cardsOf(over)}</div>
          <div class="bz-q-col warn">${this.colHead(col.today.length, '今天到期')}${this.cardsOf(today)}</div>
          <div class="bz-q-col future">${this.colHead(future.length, '未来')}${this.cardsOf(future)}</div>
        </div>`;

    // 底部信息行：整行可点（归档 → 切换归档；统计 → 打开分布），无引导小字
    // item 13：「累计复习 X 次」→「累计 X 天 · 连续 Y 天」（X=去重同日天数，computeStats.totalReviews）
    const stats = computeStats(items);
    const footer = `
      <div class="bz-q-footer">
        <span class="bz-q-fitem" data-act="arch" title="查看已完成复习">
          ${this.icon('folder')}<span class="lbl">已完成 <b>${done.length}</b> 篇</span>
        </span>
        <i class="sep"></i>
        <span class="bz-q-fitem" data-act="stats" title="查看复习统计分布">
          ${this.icon('chart')}<span class="lbl">累计 <b>${stats.totalReviews}</b> 天 · 连续 <b>${stats.streak}</b> 天</span>
        </span>
      </div>`;

    return `<div class="bz-q-view">${head}${strip}${body}${footer}</div>`;
  }

  private colHead(count: number, name: string): string {
    return `<div class="bz-q-col-head"><span class="cnt">${count}</span><span class="name">${name}</span></div>`;
  }

  private cardsOf(items: ReviewItem[]): string {
    if (!items.length) return `<div class="bz-q-hint">没有条目</div>`;
    return items.map((it) => this.cardHtml(it)).join('');
  }

  private cardHtml(it: ReviewItem): string {
    const due = dueLabelOf(it);
    const canPlay = isPlayable(it) && !it.isMissing;
    const title = it.isCompleted ? `<s>${escapeHtml(it.name)}</s>` : escapeHtml(it.name);
    const cls = [
      'bz-q-card',
      it.isOverdue ? 'danger' : '',
      it.isCompleted ? 'done' : '',
      canPlay ? '' : 'no',
      it.isMissing ? 'missing' : '',
    ].join(' ').trim();
    const tags = [
      it.isMissing ? `<span class="bz-q-tag is-missing">文件缺失</span>` : `<span class="bz-q-tag ${due.cls}">${due.label}</span>`,
      // item 6：R<阈值提前复习卡挂「提前」tag（与开始本轮同口径，落「今天」列）
      !it.isMissing && this.isEarly(it) ? `<span class="bz-q-tag is-early">提前</span>` : '',
      this.stageTagHtml(it),
    ].join('');
    return `
      <div class="${cls}" data-id="${it.id}" role="button" tabindex="0" aria-disabled="${canPlay ? 'false' : 'true'}">
        <div class="bz-q-card-top"><span class="bz-q-card-title">${title}</span><span class="bz-q-card-stage">${it.isMissing ? '挂起' : this.stageNum(it)}</span></div>
        <div class="bz-q-card-meta">${tags}</div>
      </div>`;
  }

  private stageTagHtml(it: ReviewItem): string {
    if (it.completed) return '<span class="bz-q-tag is-done">已完成</span>';
    if (it.phase === 'fsrs') {
      const r = this.currentRPct(it);
      if (r !== null) {
        const cls = r >= 90 ? 'r-high' : r >= 70 ? 'r-mid' : 'r-low';
        return `<span class="bz-q-tag is-r ${cls}">R=${r}%</span>`;
      }
      return `<span class="bz-q-tag is-r">FSRS</span>`;
    }
    return `<span class="bz-q-tag is-stage">阶段 ${it.currentStage ?? it.stage + 1}/${TOTAL_STAGES}</span>`;
  }

  private stageNum(it: ReviewItem): string {
    if (it.phase === 'fsrs') return `FSRS Lv.${it.stage - LADDER_MAX + 1}`;
    return `${it.currentStage ?? it.stage + 1}/${TOTAL_STAGES}`;
  }

  private currentRPct(it: ReviewItem): number | null {
    if (it.phase !== 'fsrs' || !it.stability || !it.lastReviewed) return null;
    const t = (Date.now() - new Date(it.lastReviewed).getTime()) / 86400000;
    if (!(t > 0)) return null;
    // R 展示与调度排期同口径：读拟合权重（wSource 由 ensureReview 注入 reviewApp.currentW）
    const fsrs = new FSRS(this.wSource());
    return Math.round(fsrs.R(t, it.stability) * 100);
  }

  private todayLabel(): string {
    const d = new Date();
    const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${week}`;
  }

  // ================= 队列事件 =================

  private bindQueueEvents(container: HTMLElement, items: ReviewItem[]): void {
    container.querySelector('[data-act="close"]')?.addEventListener('click', () => this.hideMain());
    container.querySelector('[data-act="begin"]')?.addEventListener('click', () => void this.beginRound());
    container.querySelector('[data-act="arch"]')?.addEventListener('click', () => {
      this.showArchived = !this.showArchived;
      void this.refreshPanel();
    });
    container.querySelector('[data-act="stats"]')?.addEventListener('click', () => void this.openStats());
    // item 10：空态两条路（把当前笔记加入复习 / 监听文件夹配置说明）
    container.querySelector('[data-act="add-current"]')?.addEventListener('click', () => void this.addCurrentNote());
    container.querySelector('[data-act="watch-help"]')?.addEventListener('click', () => void this.showWatchHelp());
    const search = container.querySelector<HTMLInputElement>('#bz-q-search');
    if (search) {
      search.addEventListener('input', () => {
        if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
        this.searchTimer = window.setTimeout(() => {
          this.searchTimer = null;
          this.searchText = search.value;
          void this.refreshPanel();
        }, 180);
      });
    }
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
    const { openFlowDialog } = await import('../core/flow-dialog');
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

  // ================= 难度弹窗（评分命令用，保留旧实现） =================

  showDifficultyDialog(item: ReviewItem, onSelect?: (diff: string) => void): void {
    const old = document.querySelector('.difficulty-dialog');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'difficulty-dialog';
    div.style.zIndex = String(allocZ());
    div.innerHTML = `
      <h4>标记复习：${escapeHtml(item.name)}</h4>
      <button class="diff-btn" data-diff="again">忘了（Again）</button>
      <button class="diff-btn" data-diff="hard">困难（Hard）</button>
      <button class="diff-btn" data-diff="good">一般（Good）</button>
      <button class="diff-btn" data-diff="easy">简单（Easy）</button>
      <button class="diff-btn diff-btn-cancel" data-diff="cancel">取消</button>
    `;
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
              { label: '移出', value: 'ok', cta: true },
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

  // ================= 工具 =================

  private icon(name: string): string {
    return `<span class="bz-q-ic" data-lucide="${name}"></span>`;
  }

  private mountIcons(host: HTMLElement): void {
    host.querySelectorAll<HTMLElement>('[data-lucide]').forEach((el) => {
      const name = el.dataset.lucide || '';
      const ic = uiIcon(name);
      ic.classList.add('bz-q-ic');
      el.replaceWith(ic);
    });
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

/** 评级条四档语义（复用既有 again/hard/good/easy；同 RATING_NAMES 口径） */
const BAR_RATINGS: Array<{ rating: 'again' | 'hard' | 'good' | 'easy'; label: string; cls: string }> = [
  { rating: 'again', label: '忘了', cls: 'again' },
  { rating: 'hard', label: '困难', cls: 'hard' },
  { rating: 'good', label: '一般', cls: 'good' },
  { rating: 'easy', label: '简单', cls: 'easy' },
];

/** 屏幕底部挂悬浮迷你评级条（reviewLoop 存续期间）。返回句柄供收起（close 幂等）。 */
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
  const btns = BAR_RATINGS.map(
    (r) => `<button class="bz-review-bar-btn is-${r.cls}" data-rating="${r.rating}">${r.label}</button>`
  ).join('');
  el.innerHTML = `
    <span class="bz-review-bar-info">${escapeHtml(opts.name.replace(/^《|》$/g, ''))}<i>(${opts.index}/${opts.total})</i></span>
    <span class="bz-review-bar-act">${btns}
      <button class="bz-review-bar-btn is-skip" data-rating="skip">${'跳过'}</button>
    </span>`;
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
