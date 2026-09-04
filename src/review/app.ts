/**
 * 复习计划核心应用（ticket 16 修正版：对齐源码 App，含 quizReviewLoop/reviewLoop）
 */
import type { App, TFile } from 'obsidian';
import { notice, notify } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import { getApp } from '../core/app';
import { getSettings } from '../core/settings-provider';
import { escapeHtml } from '../core/utils';
import { FSRS, FSRS_FIRST_TEXTS, scheduleNext } from './fsrs';
import type { Rating } from './fsrs';
import type { ReviewItem } from './data';
import { ReviewDataManager } from './data';
import { loadFittedParams, saveFittedParams } from './data';
import { fitFromItems, mergeFittedW } from './fit';
import { DEFAULT_W } from './fsrs';
import { isEarlyDue, roundQueue } from './queue';
import { computeStats } from './stats';

/** item 5：普通复习离篇宽限期（ms）——持续离篇超过此时长才算中断；测试可注入 */
export let REVIEW_AWAY_GRACE_MS = 120000;
export function __setReviewAwayGraceMsForTests(ms: number): void {
  REVIEW_AWAY_GRACE_MS = ms;
}

export const reviewApp = {
  checkInterval: null as ReturnType<typeof setInterval> | null,
  dataManager: null as ReviewDataManager | null,
  /** 测试注入：对齐源码 window.__quiz 语义 */
  _quizOverride: null as any | null,
  /** 连续复习单框通知（同键合并，动态更新消息） */
  _reviewNotice: null as NoticeHandle | null,
  /** 已通知逾期的笔记路径（ticket 100：diff 记忆集合，避免重复刷屏） */
  _notifiedOverdue: new Set<string>(),
  /** 逾期常驻通知句柄：同键合并时 notify 返回空操作，留存真句柄供逾期清零时主动收起 */
  _overdueNotice: null as NoticeHandle | null,
  /** ticket 48：已染色/挂徽章的文件路径（移出计划后据此回退；仅提交计划路径 + 曾染色路径，不再全库扫描） */
  _styledPaths: new Set<string>(),
  /** ADR-0077：最近一次复习的累计计数（每 N 次触发拟合重算） */
  _reviewCountSinceFit: 0,
  /** ADR-0077：当前生效的拟合权重（null=用默认 DEFAULT_W） */
  _fittedW: null as number[] | null,
  /** ADR-0077：拟合运行防重入 */
  _fitRunning: false,
  /** P3：reviewLoop 活动轮询句柄（卸载统一清理；插件禁用后不得继续读盘翻篇弹通知） */
  _reviewLoops: new Set<ReturnType<typeof setInterval>>(),
  /** item 4：普通复习悬浮迷你评级条句柄（reviewLoop 存续期间挂屏幕底部） */
  _reviewBar: null as { close: () => void } | null,
  /** item 5：本轮队列断点（中断/超时可恢复继续） */
  _pendingRound: null as { items: ReviewItem[]; index: number } | null,

  /** P3：终止全部 reviewLoop 轮询（unloadReview 调用；幂等） */
  stopReviewLoops(): void {
    for (const t of this._reviewLoops) clearInterval(t);
    this._reviewLoops.clear();
    this.hideReviewBar();
    this._pendingRound = null;
  },

  /** item 4：收起悬浮评级条（幂等） */
  hideReviewBar(): void {
    this._reviewBar?.close();
    this._reviewBar = null;
  },

  async getQuiz(): Promise<any> {
    if (this._quizOverride) return this._quizOverride;
    return (await import('./quiz-core')).quizUI;
  },

  ensure(app: App): void {
    if (!this.dataManager) this.dataManager = new ReviewDataManager(app);
  },

  /** ADR-0077：加载拟合参数到 _fittedW（无则 null 回退默认）；ensureReview 启动时调用 */
  async loadFitParams(app: App): Promise<void> {
    try {
      const fit = await loadFittedParams(app);
      this._fittedW = fit ? mergeFittedW(fit.w) : null;
    } catch (e) {
      this._fittedW = null;
    }
  },

  /**
   * ADR-0077：每 N 次复习自动重拟合（全自动定期重算）。
   * markReview 每次评级后调用（count+1）；达阈值且开关开 → 异步后台跑，完成后轻提示；
   * 样本不足/失败静默回退默认；防重入。
   */
  async maybeRunFit(app: App): Promise<void> {
    const s = getSettings() as any;
    if (s.reviewEnableFit === false) return;
    const n = Number(s.reviewFitEveryN) || 10;
    this._reviewCountSinceFit++;
    if (this._reviewCountSinceFit < n || this._fitRunning) return;
    this._fitRunning = true;
    this._reviewCountSinceFit = 0;
    try {
      const dm = this.dataManager!;
      const items = await dm.loadItems();
      const result = fitFromItems(items);
      if (result) {
        await saveFittedParams(app, {
          w: result.fit.w,
          fitAt: new Date().toISOString(),
          fitCount: result.count,
          full: result.fit.w.length >= 19,
        });
        this._fittedW = mergeFittedW(result.fit.w);
        notice(`已根据 ${result.count} 条复习记录拟合记忆参数`, 'success');
      }
      // 样本不足 → 静默保留默认（不提示）
    } catch (e) {
      console.warn('复习参数拟合失败，回退默认:', e);
    } finally {
      this._fitRunning = false;
    }
  },

  /** ADR-0077：获取当前生效权重（拟合参数优先，回退默认） */
  currentW(): number[] {
    return this._fittedW || DEFAULT_W;
  },

  /** ADR-0077：某条目当前记忆保留度 R（FSRS 相位且已复习过才可算；否则 null） */
  currentR(item: ReviewItem): number | null {
    if (item.phase !== 'fsrs' || !item.stability || !item.lastReviewed) return null;
    const t = (new Date().getTime() - new Date(item.lastReviewed).getTime()) / 86400000;
    if (!(t > 0)) return null;
    return new FSRS(this.currentW()).R(t, item.stability);
  },

  /** ADR-0077：逾期队列排序 + 每日上限截断。
   *  R 升序（遗忘风险最高优先，仅可算 R 的条目）→ nextReviewDate 升序。
   *  ticket 174：移除置顶（用户拍板去掉置顶功能）。 */
  sortOverdue(items: ReviewItem[], dailyLimit = 0): ReviewItem[] {
    const sorted = [...items].sort((a, b) => {
      const rA = this.currentR(a);
      const rB = this.currentR(b);
      if (rA !== null && rB !== null && rA !== rB) return rA - rB;
      return new Date(a.nextReviewDate as string).getTime() - new Date(b.nextReviewDate as string).getTime();
    });
    return dailyLimit > 0 ? sorted.slice(0, dailyLimit) : sorted;
  },

  async markReview(filePath: string, selectedDifficulty: Rating, opts?: { autoPending?: boolean }): Promise<void> {
    const app = getApp();
    this.ensure(app);
    const dm = this.dataManager!;
    const items = await dm.loadItems();
    const item = items.find((i) => i.filePath === filePath);
    if (!item) {
      notice('条目不存在');
      return;
    }
    if (item.completed) {
      notice('该笔记已完成全部复习');
      return;
    }

    const now = new Date();
    const nextReview = item.nextReviewDate ? new Date(item.nextReviewDate) : new Date(0);
    if (now < nextReview) {
      // dueItems 的 R 阈值「提前逾期」口径放行（queue.isEarlyDue 同一纯函数，item 6 口径统一）——
      // 否则开始本轮纳入的条目评级会被此处整体拒掉（通过不刷新排期、答错不挂待重做）
      const rThreshold = Number((getSettings() as any).reviewRThreshold) || 0.9;
      if (!isEarlyDue(item, rThreshold, this.currentW())) {
        const diff = nextReview.getTime() - now.getTime();
        const mins = Math.ceil(diff / 60000);
        notice(`还未到复习时间（${mins}分钟后）`);
        return;
      }
    }

    const rating = selectedDifficulty;
    // ADR-0077：优先用拟合权重（个人化记忆曲线），回退默认
    // 满血 FSRS：调度决策收敛到纯函数 scheduleNext（9 级前爬阶梯、9 级后按 S/D/R 动态，
    // 不再固定 120 天循环、不再重复 initS 重置记忆参数）
    const decision = scheduleNext(
      {
        stage: item.stage,
        phase: item.phase,
        stability: item.stability,
        difficulty: item.difficulty,
        lastReviewed: item.lastReviewed,
        reviewStart: item.reviewStart,
      },
      rating,
      now,
      this.currentW()
    );
    // ticket 100：复习间隔缩放（ADR-0046）——仅 FSRS 动态间隔乘系数；阶梯固定表（含进入点 120d）不受影响
    const scaleRaw = Number((getSettings() as any).reviewIntervalScale);
    const scale = decision.phase === 'fsrs' && !decision.enteringFsrs && scaleRaw > 0 ? scaleRaw : 1;
    const scaledDays = Math.max(0.01, decision.intervalDays * scale);
    const nextDate = new Date(now.getTime() + scaledDays * 86400000);

    await dm.updateItem(filePath, (it) => {
      it.stage = decision.stage;
      it.phase = decision.phase;
      if (decision.stability !== null) it.stability = decision.stability;
      if (decision.difficulty !== null) it.difficulty = decision.difficulty;
      it.lastReviewed = now.toISOString();
      it.lastDifficulty = rating;
      it.totalReviews = (it.totalReviews || 0) + 1;
      if (!it.reviewHistory) it.reviewHistory = [];
      const entry: Record<string, unknown> = { timestamp: now.toISOString(), stage: decision.historyStage, rating };
      // ADR-0077：S/D 记入历史（下游拟合配对依赖上一条含 stability/difficulty）
      if (decision.historyStability !== null) {
        entry.stability = decision.historyStability;
        entry.difficulty = decision.historyDifficulty;
      }
      if (decision.R !== null) entry.R = Math.round(decision.R * 100);
      it.reviewHistory.push(entry as (typeof it.reviewHistory)[number]);
      it.nextReviewDate = nextDate.toISOString();
      if (decision.enteringFsrs) it.completed = false; // 进入 FSRS 不算完成

      // ticket 098：做题会话自动评级未通过/通过联动待重做标记；其余路径 good/easy 清（ADR-0044）
      if (opts?.autoPending) it.pendingRedo = rating === 'again' || rating === 'hard';
      else if (rating === 'good' || rating === 'easy') it.pendingRedo = false;
    });

    if (decision.enteringFsrs) {
      notice(`进入深度复习，${FSRS_FIRST_TEXTS[decision.stage]}后复习`, 'success');
    } else if (decision.phase === 'ladder') {
      notice(`${FSRS_FIRST_TEXTS[decision.stage]}后复习`, 'success');
    } else {
      const days = Math.round(scaledDays);
      const rPct = Math.round((decision.R || 0) * 100);
      notice(`R=${rPct}% → 下次复习：${days > 0 ? days + '天' : '1天'}后`, 'success');
    }
    // ADR-0077：评级也累计拟合计数（含阶梯阶段；样本过滤在 fit.ts 内做）。
    // fire-and-forget：计数在入口同步累加，拟合自防重入；不 await 避免大历史时卡评级路径
    void this.maybeRunFit(getApp());
  },

  /** 跳转逾期（做题决定难度：开启 → 做题复习；关闭 → 普通复习跳转笔记） */
  /** 跳转逾期（bz-review-start/overdue 命令入口）：完整复习流程 = startRoundSprint */
  async autoJumpOverdue(): Promise<void> {
    await this.startRoundSprint();
  },

  /** 准确率 → 难度评级 */
  accuracyToRating(accuracy: number): Rating {
    if (accuracy >= 90) return 'easy';
    if (accuracy >= 70) return 'good';
    if (accuracy >= 50) return 'hard';
    return 'again';
  },

  /** 待重做条目（文件存在、未完成；按进入顺序 = lastReviewed 升序 FIFO） */
  pendingRedoItems(items: ReviewItem[]): ReviewItem[] {
    return items
      .filter((i) => i.pendingRedo && !i.isCompleted && i.file)
      .sort(
        (a, b) =>
          new Date(a.lastReviewed || a.reviewStart).getTime() - new Date(b.lastReviewed || b.reviewStart).getTime()
      );
  },
  /** 重做出题（ADR-0044/Q7-②）：清空旧题 → ensureQuestions 全新生成；失败或空题回退剩余错题 */
  async regenerateQuestions(filePath: string): Promise<any[]> {
    const quiz: any = await this.getQuiz();
    if (!quiz || !quiz.ai) return [];
    const leftover = (await quiz.manager.getQuestionsForNote(getApp(), filePath)) || [];
    await quiz.manager.saveQuestionsForNote(getApp(), filePath, []);
    await quiz.ensureQuestions([filePath]);
    const fresh = (await quiz.manager.getQuestionsForNote(getApp(), filePath)) || [];
    const picked = fresh.length ? fresh : leftover;
    return picked.map((q: any, i: number) => ({ ...q, notePath: filePath, _index: i }));
  },

  /** 批量生成题目（返回 {filePath: questions[]} 映射）：先清空存量题再 ensureQuestions 全新生成 */
  async batchGenerateQuestions(items: ReviewItem[]): Promise<Record<string, any[]>> {
    const quiz: any = await this.getQuiz();
    if (!quiz || !quiz.ai) {
      console.warn('做题家未初始化（缺少 AI）');
      notify('做题家未初始化（缺少 AI），已改用普通复习', { type: 'warning', dedupeKey: 'review-quiz-ai' });
      return {};
    }
    for (const item of items) {
      await quiz.manager.saveQuestionsForNote(getApp(), item.filePath, []);
    }
    await quiz.ensureQuestions(items.map((i) => i.filePath));
    const out: Record<string, any[]> = {};
    for (const item of items) {
      const qs = await quiz.manager.getQuestionsForNote(getApp(), item.filePath);
      if (qs && qs.length) {
        out[item.filePath] = qs.map((q: any, i: number) => ({
          ...q,
          notePath: item.filePath,
          _index: i,
        }));
      }
    }
    return out;
  },

  /** 单条做题冲刺（点队列到期卡片）：该篇直接进入做题会话 */
  async startSingleSprint(item: ReviewItem): Promise<void> {
    const app = getApp();
    this.ensure(app);
    const quiz: any = await this.getQuiz();
    if (quiz && !quiz.ai) {
      try {
        const { ensureQuiz } = await import('./quiz-core');
        ensureQuiz(app);
      } catch {
        /* ignore */
      }
    }
    if (!quiz || !quiz.ai) {
      // 做题家不可用（无 AI）：降级为普通复习（打开笔记等自评）
      notify('做题家未初始化，改用普通复习', { type: 'warning', dedupeKey: 'review-quiz-ai' });
      await this.reviewLoop([item], 0);
      return;
    }
    // 单条：取现成题（无题则重生成）；无题 → 会话内跳过提示
    await this.runSprintSession([item], 'single');
  },

  /** 开始本轮（队列视图「开始本轮」）：待重做优先 → 逾期队列 → 做题/普通分流 */
  async startRoundSprint(): Promise<void> {
    const app = getApp();
    this.ensure(app);
    let items = await this.dataManager!.loadItems();
    const pend = this.pendingRedoItems(items);
    if (pend.length && getSettings().forceQuizForReview) {
      const quiz: any = await this.getQuiz();
      if (quiz && !quiz.ai) {
        try {
          const { ensureQuiz } = await import('./quiz-core');
          ensureQuiz(app);
        } catch {
          /* ignore */
        }
      }
      if (quiz && quiz.ai) {
        await this.runSprintSession(pend, 'redo');
        // 重做会话结束后重新读盘：pendingRedo 已清的 = 通过集（会话内 updateItem 落盘）
        const fresh = await this.dataManager!.loadItems();
        const passedSet = new Set(
          fresh.filter((i) => pend.some((p) => p.filePath === i.filePath) && !i.pendingRedo).map((i) => i.filePath)
        );
        if (passedSet.size) items = fresh.filter((i) => !passedSet.has(i.filePath));
        else items = fresh; // 无通过也刷新（会话内可能写过排期）
      } else {
        notify('做题家未初始化，跳过待重做队列', { type: 'warning', dedupeKey: 'review-quiz-ai' });
      }
    }

    // item 6/9：开始本轮与三区列同口径（roundQueue 纯函数）——
    // 逾期 ∪ R 阈值提前 ∪ 今日到期（今日到期时刻未到 = 允许提前开始今天全部）
    const rThreshold = Number((getSettings() as any).reviewRThreshold) || 0.9;
    const round = roundQueue(items, rThreshold, this.currentW());
    if (!round.length) {
      notice('没有逾期笔记', 'success');
      return;
    }
    // item 9：纳入了「今日到期但时刻未到」的篇目 → 明确反馈
    const earlyToday = round.filter((i) => !i.isOverdue && !isEarlyDue(i, rThreshold, this.currentW()));
    if (earlyToday.length) {
      notice(`今日到期 ${earlyToday.length} 篇已提前纳入本轮`, 'info');
    }
    const dailyLimit = Number((getSettings() as any).reviewDailyLimit) || 0;
    const limited = this.sortOverdue(round, dailyLimit);
    if (limited.length < round.length) {
      notice(`本轮复习 ${limited.length} 篇，剩余 ${round.length - limited.length} 篇留到下次`, 'info');
    }

    if (!getSettings().forceQuizForReview) {
      await this.reviewLoop(limited, 0);
      return;
    }
    let quiz: any = null;
    try {
      quiz = await this.getQuiz();
    } catch {
      /* ignore */
    }
    if (quiz && !quiz.ai) {
      try {
        const { ensureQuiz } = await import('./quiz-core');
        ensureQuiz(app);
      } catch {
        /* ignore */
      }
    }
    if (!quiz || !quiz.ai) {
      notify('做题家未初始化，已改用普通复习', { type: 'warning', dedupeKey: 'review-quiz-ai' });
      await this.reviewLoop(limited, 0);
      return;
    }
    // 直接进做题界面（题在 session 内懒批量生成：首篇 fetch 时触发整轮后台生成，
    // 界面立即出现 + 中心 loading「正在准备题目」——不在进 session 前同步干等 AI）
    await this.runSprintSession(limited, 'round');
  },

  /** 当前逾期条目（item 6：改用 roundQueue 同口径——逾期 ∪ R 阈值提前 ∪ 今日到期） */
  dueItems(items: ReviewItem[]): ReviewItem[] {
    const rThreshold = Number((getSettings() as any).reviewRThreshold) || 0.9;
    return roundQueue(items, rThreshold, this.currentW());
  },

  /**
   * 统一冲刺会话驱动：把队列交给 UI 层 SprintSession 渲染，本层只提供
   * 取题/评级写盘回调。会话结束（done/quit/fail）后刷新列表与染色。
   *  - round/single：通过 → markReview autoPending；未通过 → markReview autoPending + 开笔记
   *  - redo：通过 → 仅清 pendingRedo（ADR-0044 不写 FSRS）；未通过 → 开笔记（保持待重做）
   */
  async runSprintSession(items: ReviewItem[], mode: 'round' | 'single' | 'redo'): Promise<void> {
    const app = getApp();
    const { uiManager } = await import('./index');
    if (!uiManager) return;

    // item 8：结算屏「连续 N 天」——进会话时算好 streak 传入
    let streakDays = 0;
    try {
      streakDays = computeStats(await this.dataManager!.loadItems()).streak;
    } catch {
      /* ignore */
    }

    const quiz: any = await this.getQuiz();
    // 懒批量：首篇 fetch 触发整轮后台生成；后续篇目直接读已生成结果
    // （进 session 即出界面 + loading，不在进 session 前同步干等 AI）
    let batchStarted = false;
    let batchMap: Record<string, any[]> | null = null;
    const ensureBatch = async (): Promise<void> => {
      if (batchStarted) return;
      batchStarted = true;
      try {
        batchMap = await this.batchGenerateQuestions(items);
      } catch {
        batchMap = {};
      }
    };
    await uiManager.startSprint({
      queue: items,
      mode,
      quiz,
      streakDays,
      fetchQuestions: async (item) => {
        // 现成题直接读（single：现成无则重新生成；redo：重新生成）
        const qs = await quiz?.manager?.getQuestionsForNote(app, item.filePath);
        if (qs && qs.length) {
          return qs.map((q: any, i: number) => ({ ...q, notePath: item.filePath, _index: i }));
        }
        if (!quiz?.ai) return null;
        if (mode === 'round') {
          // round：懒批量——首篇现场触发生成（本篇在批内），后台批完前先等本篇
          await ensureBatch();
          const mapped = batchMap?.[item.filePath];
          if (mapped && mapped.length) {
            return mapped;
          }
          return null; // 本篇生成失败/空 → 跳过（runNext 已有空题跳过语义）
        }
        const fresh = await this.regenerateQuestions(item.filePath);
        return fresh.length ? fresh : null;
      },
      onPassed: async (item, rating, entry) => {
        if (mode === 'redo') {
          await this.dataManager!.updateItem(item.filePath, (it) => {
            it.pendingRedo = false;
          });
          return undefined;
        }
        await this.markReview(item.filePath, rating as Rating, { autoPending: true });
        await this.applyReviewStyles(app);
        // 返回写盘后的真实排期（markReview 内部 updateItem 改的是新 load 的对象，item 快照不更新）
        const fresh = await this.dataManager!.loadItems();
        const updated = fresh.find((i) => i.filePath === item.filePath);
        return updated?.nextReviewDate || undefined;
      },
      onFailed: async (item, rating, entry) => {
        if (mode !== 'redo') {
          await this.markReview(item.filePath, rating as Rating, { autoPending: true });
          await this.applyReviewStyles(app);
        }
        // 打开原文（复习此笔记语义）
        const file = app.vault.getAbstractFileByPath(item.filePath);
        if (file) {
          const leaf = app.workspace.getLeaf(false);
          await leaf.openFile(file as TFile);
        }
      },
    });
    // 会话结束：回队列 + 染色 + 通知（done 全清）
    await this.refreshPanel();
    await this.applyReviewStyles(app);
  },


  /** 顺序复习循环（源码 L686-709 逐字；item 4 悬浮评级条 + item 5 离篇宽限/断点可恢复）
   *  - 屏幕底部挂迷你评级条（忘了/困难/一般/简单 + 跳过）：点评级写盘 → 轮询检测翻篇；跳过不评级直接下一篇
   *  - 离篇持续 REVIEW_AWAY_GRACE_MS 才判中断（宽限期内回篇继续）；中断/超时保留 _pendingRound，
   *    通知挂「继续本轮」action 断点续跑 */
  async reviewLoop(overdueNotes: ReviewItem[], index: number): Promise<void> {
    const app = getApp();
    this.ensure(app);
    const dm = this.dataManager!;
    if (index >= overdueNotes.length) {
      this._pendingRound = null;
      this.hideReviewBar();
      if (this._reviewNotice) {
        this._reviewNotice.setType('success');
        this._reviewNotice.setMessage('所有逾期笔记已复习完成');
        this._reviewNotice = null;
      } else {
        notice('所有逾期笔记已复习完成', 'success');
      }
      return;
    }
    const item = overdueNotes[index];
    const file = app.vault.getAbstractFileByPath(item.filePath);
    if (!file) {
      await dm.removeItem(item.filePath);
      await this.reviewLoop(overdueNotes, index + 1);
      return;
    }
    this._pendingRound = { items: overdueNotes, index }; // item 5：断点（完成/清零时置空）
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file as TFile);
    // 连续复习：常驻单框动态更新（同键存活时原地合并，不刷屏）
    const reviewMsg = `复习中 (${index + 1}/${overdueNotes.length}): ${item.name}`;
    if (this._reviewNotice) {
      this._reviewNotice.setMessage(reviewMsg);
    } else {
      this._reviewNotice = notify(reviewMsg, { type: 'progress', dedupeKey: 'review-loop' });
    }
    // item 4：挂悬浮迷你评级条（fire-and-forget：不阻塞轮询/翻篇链路；ui 不可用时静默降级为命令评级）
    this.hideReviewBar();
    void (async () => {
      try {
        const { mountFloatingRatingBar } = await import('./ui');
        this._reviewBar = mountFloatingRatingBar({
          name: item.name,
          index: index + 1,
          total: overdueNotes.length,
          onRate: (rating) => {
            // 评级写盘 → 下方轮询检测 lastReviewed 更新自动翻篇（本条收起由按钮点击即收）
            void this.markReview(item.filePath, rating);
          },
          onSkip: () => {
            // 跳过：不评级不写盘，直接进下一篇
            void advance();
          },
        });
      } catch {
        /* ignore */
      }
    })();

    let checkCount = 0;
    const maxChecks = 300;
    let advanced = false;
    let awaySince: number | null = null; // item 5：持续离篇起点（null=在篇上）
    const advance = async (): Promise<void> => {
      if (advanced) return;
      advanced = true;
      this.hideReviewBar();
      clearLoop();
      await this.reviewLoop(overdueNotes, index + 1);
    };
    const interval = setInterval(async () => {
      checkCount++;
      const activeFile = app.workspace.getActiveFile();
      if (!activeFile || activeFile.path !== item.filePath) {
        // item 5：离篇宽限——持续离篇超过阈值才算中断；宽限期内回篇自动续候
        const nowMs = Date.now();
        if (awaySince === null) awaySince = nowMs;
        if (nowMs - awaySince < REVIEW_AWAY_GRACE_MS) return;
        advanced = true;
        this.hideReviewBar();
        clearLoop();
        // P1-2：本轮连续复习中断（保留 _pendingRound 供「继续本轮」断点续跑）
        if (this._reviewNotice) {
          this._reviewNotice.setMessage('已离开当前笔记，本轮复习中断');
          this._reviewNotice.setType('warning');
          this._reviewNotice = null;
        }
        notify('已离开当前笔记，本轮复习中断', {
          type: 'warning',
          dedupeKey: 'review-loop-interrupted',
          action: { label: '继续本轮', onClick: () => void reviewApp.resumeRound() },
        });
        return;
      }
      awaySince = null; // 回到篇上：宽限计时复位
      const updatedItems = await dm.loadItems();
      const updated = updatedItems.find((i) => i.filePath === item.filePath);
      if (updated && updated.lastReviewed) {
        const last = new Date(updated.lastReviewed);
        if (Date.now() - last.getTime() < 30000) {
          await advance();
          return;
        }
      }
      if (checkCount >= maxChecks) {
        advanced = true;
        this.hideReviewBar();
        clearLoop();
        if (this._reviewNotice) {
          this._reviewNotice.setMessage('复习超时，请手动继续');
          this._reviewNotice.setType('warning');
          this._reviewNotice = null;
        } else {
          notice('复习超时，请手动继续', 'warning');
        }
        notify('复习超时，可从断点继续本轮', {
          type: 'info',
          dedupeKey: 'review-loop-timeout',
          action: { label: '继续本轮', onClick: () => void reviewApp.resumeRound() },
        });
      }
    }, 1000);
    // P3：句柄入账（stopReviewLoops 统一清理），防插件禁用后轮询残留
    this._reviewLoops.add(interval);
    const clearLoop = (): void => {
      clearInterval(interval);
      this._reviewLoops.delete(interval);
    };
  },

  /** item 5：从断点恢复本轮（中断/超时后「继续本轮」入口；无断点给明确反馈） */
  resumeRound(): void {
    const r = this._pendingRound;
    if (!r) {
      notice('没有进行中的本轮复习');
      return;
    }
    void this.reviewLoop(r.items, r.index);
  },

  /** 加入当前笔记到复习计划 */
  async addCurrentToReview(file: TFile): Promise<void> {
    this.ensure(getApp());
    const dm = this.dataManager!;
    const items = await dm.loadItems();
    if (items.some((i) => i.filePath === file.path)) throw new Error('该笔记已在复习计划中');
    await dm.addItem(file.path, file.basename);
    notice('已加入复习计划，首次复习：1分钟后', 'success');
  },

  /** 文件树染色 + 阶段徽标（源码 L719-772 逐字；ticket 100 加「文件树标记」开关；
   *   ticket 48 收敛：不再全库 getMarkdownFiles + 逐路径 querySelector——
   *   处理范围 = 复习条目路径 + 曾染色路径（移出计划后回退），树节点一次 querySelectorAll 建 Map 查找；
   *   可选 items 参数：checkOverdueAndNotify 传本轮已加载结果，避免每轮二次读盘。 */
  async applyReviewStyles(app: App, changedFile?: TFile, items?: ReviewItem[]): Promise<void> {
    if ((getSettings() as any).reviewTreeBadge === false) return; // ticket 100：关=清爽文件树（不染色不挂徽章）
    this.ensure(app);
    const allItems = items || (await this.dataManager!.loadItems());
    const itemByPath = new Map<string, ReviewItem>();
    for (const item of allItems) {
      if (item.filePath) itemByPath.set(item.filePath, item);
    }

    // 处理路径集：单文件事件只处理该文件；全量轮 = 复习条目 + 曾染色路径（回退清洗用）
    const paths = new Set<string>();
    if (changedFile) {
      paths.add(changedFile.path);
    } else {
      for (const p of itemByPath.keys()) paths.add(p);
      for (const p of this._styledPaths) paths.add(p);
    }

    // 树节点一次收集（data-path → 元素，首个匹配语义与原 querySelector 一致）
    const els = new Map<string, HTMLElement>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('div[data-path]'))) {
      const p = el.getAttribute('data-path');
      if (p && !els.has(p)) els.set(p, el);
    }

    // R 染色与排期同口径：读拟合权重 currentW()（ADR-0077；默认回退 DEFAULT_W）
    const fsrs = new FSRS(this.currentW());

    for (const path of paths) {
      const el = els.get(path);
      if (!el) {
        // 树节点不存在（文件删除/目录收起）：从曾染色集合剔除，防集合无限增长
        this._styledPaths.delete(path);
        continue;
      }
      const target = el.querySelector('div.tree-item-inner') as HTMLElement | null;
      if (!target) continue;
      const badge = target.querySelector('.review-stage-badge');
      if (badge) badge.remove();

      const item = itemByPath.get(path);
      if (!item) {
        // 仅回退「本插件曾染色」的路径（从未染色的非条目节点不触碰，缩范围语义）
        if (this._styledPaths.has(path)) {
          target.style.color = '';
          this._styledPaths.delete(path);
        }
        continue;
      }
      const currentStage = item.stage || 0;
      const now = new Date();
      const nextReview = item.nextReviewDate ? new Date(item.nextReviewDate) : null;
      let color = 'currentColor';
      let status = '';
      if (item.completed) {
        color = '#52c41a';
        status = 'complete';
      } else if (nextReview && now > nextReview) {
        color = '#ff4757';
        status = 'overdue';
      } else if (item.phase === 'fsrs' && item.stability && item.lastReviewed) {
        const t = (now.getTime() - new Date(item.lastReviewed).getTime()) / 86400000;
        const r = fsrs.R(t, item.stability);
        if (r >= 0.9) color = '#52c41a';
        else if (r >= 0.7) color = '#faad14';
        else color = '#ff9f43';
      } else if (currentStage <= 2) {
        color = '#1890ff';
      } else if (currentStage <= 6) {
        color = '#faad14';
      } else {
        color = '#52c41a';
      }
      target.style.color = color;

      let timeText = '';
      let badgeIcon: 'check' | 'calendar' | null = null;
      if (status === 'complete') badgeIcon = 'check'; // item 14：✅ → lucide check
      else if (nextReview) {
        const diff = nextReview.getTime() - now.getTime();
        if (diff > 0) {
          const d = Math.floor(diff / (1000 * 60 * 60 * 24));
          const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          if (d > 0) timeText = `${d}d`;
          else if (h > 0) timeText = `${h}h`;
          else timeText = `${m}m`;
        } else badgeIcon = 'calendar'; // item 14：📅 → lucide calendar
      }
      if (badgeIcon || timeText) {
        const badgeEl = document.createElement('span');
        badgeEl.className = 'review-stage-badge';
        if (badgeIcon) {
          // item 14：徽标用 lucide（uiIcon 工厂；尺寸走域样式 .review-stage-badge svg）
          const { uiIcon } = await import('../core/ui');
          badgeEl.appendChild(uiIcon(badgeIcon));
        } else {
          badgeEl.textContent = timeText;
        }
        badgeEl.style.cssText = `font-size:0.7em;opacity:0.8;margin-left:6px;color:${color};background:color-mix(in srgb, ${color} 10%, transparent);padding:1px 4px;border-radius:3px;border:1px solid color-mix(in srgb, ${color} 30%, transparent);font-weight:500;`;
        target.appendChild(badgeEl);
      }
      this._styledPaths.add(path);
    }
  },

  /**
   * 到期提醒 + 染色刷新（ticket 100：原只刷染色，重写为 diff + 通知；染色职责保留）
   * 每轮与已通知集合对比：新增逾期 → 弹篇数常驻通知（duration 0，逾期清零主动收起；不列题目）；
   * 移出逾期（评级/完成/挂起）从集合剔除 → 之后再次逾期重新提醒。
   * 启动首查把存量逾期当新产生 → 汇总篇数（Q1 拍板接受）。
   * ticket 48 收敛：与本轮 loadItems 共用结果，不再二次读盘；
   * ticket 58：通知挂「去复习」action → 打开最早逾期笔记；
   * ticket 153：「去复习」升级为走 autoJumpOverdue 完整流程（做题决定难度分流）。
   */
  async checkOverdueAndNotify(): Promise<void> {
    try {
      this.ensure(getApp());
      const dm = this.dataManager!;
      const items = await dm.loadItems();
      // 染色刷新保留（原 60s 轮询职责：逾期文件实时变红；是否染色由 reviewTreeBadge 决定）
      await this.applyReviewStyles(getApp(), undefined, items);
      if ((getSettings() as any).enableAutoNotify === false) return; // 通知开关关 → 不弹通知
      const overdueMap = new Map<string, ReviewItem>(
        items.filter((i) => i.isOverdue && !i.completed && !i.isMissing).map((i) => [i.filePath, i])
      );
      const newly = [...overdueMap.entries()].filter(([p]) => !this._notifiedOverdue.has(p));
      // 清掉已不再逾期的（评级/完成/挂起后）
      for (const p of this._notifiedOverdue) {
        if (!overdueMap.has(p)) this._notifiedOverdue.delete(p);
      }
      if (newly.length) {
        for (const [p] of newly) this._notifiedOverdue.add(p);
        // 通知只报当前逾期篇数，不列具体题目（用户拍板 2026-08-29）；duration 0 = 常驻（通知系统语义）
        // ticket 153：「去复习」不再只打开单篇（旧 ticket 58/修 #1 语义），
        // 而是走 autoJumpOverdue 完整复习流程（按 forceQuizForReview 分流做题/普通复习），
        // 通知名单仍只报 newly（diff 记忆语义保留，见上方过滤）。
        const handle = notify(`有 ${overdueMap.size} 篇笔记逾期`, {
          type: 'info',
          duration: 0, // 常驻不自动消失，靠点击「去复习」/本体收起
          dedupeKey: 'review-overdue-notice',
          action: {
            label: '去复习', // action 文案不带 emoji（通知规范）
            onClick: () => {
              // ticket 153：走统一开始复习流程（autoJumpOverdue 内按 forceQuizForReview 分流：
              // 开启 → 批量出题做题；关闭 → 普通复习跳转笔记），不再裸开最早逾期笔记
              void reviewApp.autoJumpOverdue();
            },
          },
        });
        // 同键合并返回空操作句柄：仅当旧句柄已失联（被消费）时才换存新句柄，保证清零收起有效
        const cur = this._overdueNotice;
        if (!cur || !cur.el.isConnected) this._overdueNotice = handle;
      } else if (!overdueMap.size) {
        // 逾期清零：常驻通知失去时效，主动收起（句柄已被点击消费时 hide 幂等无害）
        this._overdueNotice?.hide();
        this._overdueNotice = null;
      }
    } catch (e) {
      console.error('复习计划检查出错:', e);
    }
  },

  /** 刷新面板（源码 refreshPanel） */
  async refreshPanel(): Promise<void> {
    const { uiManager } = await import('./index');
    if (!uiManager) return;
    const items = await this.dataManager!.loadItems();
    uiManager.renderEntries(items);
  },
};
