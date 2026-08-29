/**
 * 复习计划核心应用（ticket 16 修正版：对齐源码 App，含 quizReviewLoop/reviewLoop）
 */
import type { App, TFile } from 'obsidian';
import { notice, notify } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import { getApp } from '../core/app';
import { getSettings } from '../core/settings-provider';
import { escapeHtml } from '../core/utils';
import { FSRS, FSRS_FIRST_INTERVALS, FSRS_FIRST_TEXTS, LADDER_MAX } from './fsrs';
import type { Rating } from './fsrs';
import type { ReviewItem } from './data';
import { ReviewDataManager } from './data';

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

  async getQuiz(): Promise<any> {
    if (this._quizOverride) return this._quizOverride;
    return (await import('../quiz')).quizUI;
  },

  ensure(app: App): void {
    if (!this.dataManager) this.dataManager = new ReviewDataManager(app);
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
      const diff = nextReview.getTime() - now.getTime();
      const mins = Math.ceil(diff / 60000);
      notice(`还未到复习时间（${mins}分钟后）`);
      return;
    }

    const rating = selectedDifficulty;
    const currentStage = item.stage;
    const fsrs = new FSRS();

    // ===== 阶段 0-9：固定阶梯 =====
    if (currentStage <= LADDER_MAX) {
      let targetStage: number;
      if (rating === 'again') targetStage = Math.max(0, currentStage - 1);
      else if (rating === 'hard') targetStage = currentStage;
      else if (rating === 'good') targetStage = currentStage + 1;
      else targetStage = currentStage + 2; // easy
      targetStage = Math.max(0, Math.min(targetStage, LADDER_MAX));
      const nextDate = new Date(now.getTime() + FSRS_FIRST_INTERVALS[targetStage] * 86400000);
      const enteringFsrs = targetStage >= LADDER_MAX;

      await dm.updateItem(filePath, (it) => {
        it.stage = targetStage;
        it.phase = enteringFsrs ? 'fsrs' : 'ladder';
        it.lastReviewed = now.toISOString();
        it.lastDifficulty = rating;
        it.totalReviews = (it.totalReviews || 0) + 1;
        if (!it.reviewHistory) it.reviewHistory = [];
        it.reviewHistory.push({ timestamp: now.toISOString(), stage: targetStage + 1, rating });
        // 进入 FSRS 阶段时，用对应评分初始化 S
        if (enteringFsrs) {
          it.stability = fsrs.initS(rating);
          it.difficulty = rating === 'again' ? fsrs.w[4] : 0.3;
        }
        it.nextReviewDate = nextDate.toISOString();
        if (enteringFsrs) it.completed = false; // 进入 FSRS 不算完成

        // ticket 098：做题会话自动评级未通过/通过联动待重做标记；其余路径 good/easy 清（ADR-0044）
        if (opts?.autoPending) it.pendingRedo = rating === 'again' || rating === 'hard';
        else if (rating === 'good' || rating === 'easy') it.pendingRedo = false;
      });
      notice(enteringFsrs ? `进入深度复习，${FSRS_FIRST_TEXTS[targetStage]}后复习` : `${FSRS_FIRST_TEXTS[targetStage]}后复习`, 'success');
      return;
    }

    // ===== 阶段 10+：满血 FSRS =====
    const S = item.stability || 1;
    const D = item.difficulty || 0.3;
    const t = (now.getTime() - new Date(item.lastReviewed || item.reviewStart).getTime()) / 86400000;
    const R = fsrs.R(t, S);
    const result = fsrs.nextInterval(S, D, rating, R);
    // ticket 100：复习间隔缩放（ADR-0046，用户拍板解冻）——FSRS 相位出题天数 × 系数；阶梯阶段固定表不受影响
    const scale = (getSettings() as any).reviewIntervalScale ?? 1;
    const scaledDays = Math.max(0.01, result.days * (Number(scale) > 0 ? Number(scale) : 1));
    const nextDate = new Date(now.getTime() + scaledDays * 86400000);

    await dm.updateItem(filePath, (it) => {
      it.stability = Math.round(result.S * 100) / 100;
      it.difficulty = Math.round(result.D * 100) / 100;
      it.lastReviewed = now.toISOString();
      it.lastDifficulty = rating;
      it.totalReviews = (it.totalReviews || 0) + 1;
      if (!it.reviewHistory) it.reviewHistory = [];
      it.reviewHistory.push({ timestamp: now.toISOString(), stage: currentStage + 1, rating, stability: Math.round(result.S * 100) / 100, R: Math.round(R * 100) });
      it.nextReviewDate = nextDate.toISOString();

      // ticket 098：做题会话自动评级未通过/通过联动待重做标记；其余路径 good/easy 清（ADR-0044）
      if (opts?.autoPending) it.pendingRedo = rating === 'again' || rating === 'hard';
      else if (rating === 'good' || rating === 'easy') it.pendingRedo = false;
    });

    const days = Math.round(scaledDays);
    const rPct = Math.round(R * 100);
    notice(`R=${rPct}% → 下次复习：${days > 0 ? days + '天' : '1天'}后`, 'success');
  },

  /** 跳转逾期（做题决定难度：开启 → 做题复习；关闭 → 普通复习跳转笔记） */
  async autoJumpOverdue(): Promise<void> {
    const app = getApp();
    this.ensure(app);
    const dm = this.dataManager!;
    let items = await dm.loadItems();

    // ticket 098：待重做队列 FIFO 优先（ADR-0044）——全部通过后才进入逾期流程；中途失败/手动结束 → 本次会话终止
    if (getSettings().forceQuizForReview) {
      const pend = this.pendingRedoItems(items);
      if (pend.length) {
        let quiz: any = null;
        try {
          quiz = await this.getQuiz();
        } catch {
          /* ignore */
        }
        if (quiz && !quiz.ai) {
          try {
            const { ensureQuiz } = await import('../quiz');
            ensureQuiz(app);
          } catch {
            /* ignore */
          }
        }
        if (quiz && quiz.ai) {
          const passed = await this.redoReviewLoop(pend, 0);
          if (!passed) return;
          const passedSet = new Set(passed);
          // 本会话已重做通过的条目从逾期集剔除（防「1 分钟后」短间隔同会话循环）
          items = items.filter((i) => !passedSet.has(i.filePath));
        } else {
          notify('做题家未初始化，跳过待重做队列', { type: 'warning', dedupeKey: 'review-quiz-ai' });
        }
      }
    }

    const overdue = items.filter((i) => i.isOverdue && !i.isCompleted);
    if (!overdue.length) {
      notice('没有逾期笔记', 'success');
      return;
    }
    overdue.sort((a, b) => new Date(a.nextReviewDate as string).getTime() - new Date(b.nextReviewDate as string).getTime());

    // ticket 100：每日复习上限（0=不限）——逾期队列截断，剩余留到下次；待重做队列不受限（重做是强制通过路径）
    const dailyLimit = Number((getSettings() as any).reviewDailyLimit) || 0;
    const limited = dailyLimit > 0 ? overdue.slice(0, dailyLimit) : overdue;
    if (limited.length < overdue.length) {
      notice(`本轮复习 ${limited.length} 篇，剩余 ${overdue.length - limited.length} 篇留到下次`, 'info');
    }

    // 做题决定难度关闭 → 普通复习（跳转笔记，逐篇等待评级）
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
    // 未开过做题家时 ai 为 null：先初始化（AI 注入），避免静默降级为普通复习
    if (quiz && !quiz.ai) {
      try {
        const { ensureQuiz } = await import('../quiz');
        ensureQuiz(app);
      } catch {
        /* ignore */
      }
    }

    if (quiz && quiz.ai) {
      const h = notify('正在批量生成题目…', { type: 'progress', dedupeKey: 'review-generate' });
      const batchQuestions = await this.batchGenerateQuestions(limited);
      const hasAny = Object.values(batchQuestions).some((qs) => (qs as any[]).length > 0);
      if (!hasAny) {
        h.setType('warning');
        h.setMessage('批量出题失败，改用普通复习');
        await this.reviewLoop(limited, 0);
      } else {
        h.setType('success');
        h.setMessage('题目已生成，开始做题复习');
        await this.quizReviewLoop(limited, 0, batchQuestions);
      }
    } else {
      notify('做题家未初始化，已改用普通复习', { type: 'warning', dedupeKey: 'review-quiz-ai' });
      await this.reviewLoop(limited, 0);
    }
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

  /** 重做出题（ADR-0044/Q7-②）：清空旧题 → ensureQuestions 全新生成；失败或空题回退剩余错题
   *  ticket 099：与 batchGenerateQuestions 对齐补 notePath/_index（renderModal 需要；缺失曾致 split 崩溃） */
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

  /** 待重做队列复习（ADR-0044）：AI 全新出题 → 做题 → 通过仅清标记不写 FSRS；失败 → 「复习此笔记」中断会话
   *  P1-3：passed 逐步累积，无题跳过项不入返回集合（留在逾期队列可进普通复习） */
  async redoReviewLoop(items: ReviewItem[], index: number, passed: string[] = []): Promise<string[] | null> {
    const app = getApp();
    this.ensure(app);
    if (index >= items.length) return passed;
    const quiz: any = await this.getQuiz();
    const item = items[index];
    const questions = await this.regenerateQuestions(item.filePath);
    if (!questions.length) {
      notice('重做失败：无题目可用，保持待重做', 'warning');
      return this.redoReviewLoop(items, index + 1, passed);
    }
    return new Promise((resolve) => {
      quiz.startReviewSession({
        questions,
        onComplete: async (results: any) => {
          const rating = this.accuracyToRating(results.accuracy);
          const failed = rating === 'again' || rating === 'hard';
          if (!failed) {
            // 通过：仅清待重做标记，不写任何 FSRS 数据（排期/历史保持首次评级结果——ADR-0044）
            await this.dataManager!.updateItem(item.filePath, (it) => {
              it.pendingRedo = false;
            });
            await this.applyReviewStyles(app);
            passed.push(item.filePath);
          }
          const popup = quiz.popup;
          if (!popup) {
            resolve(failed ? null : await this.redoReviewLoop(items, index + 1, passed));
            return;
          }
          if (failed) {
            popup.innerHTML = this.buildFailCard(item, results, rating, { showAutoMark: false });
            await new Promise<void>((resolveClick) => {
              popup.querySelector('#quiz-review-note')!.onclick = () => {
                quiz.close();
                resolveClick();
              };
            });
            const file = app.vault.getAbstractFileByPath(item.filePath);
            if (file) {
              const leaf = app.workspace.getLeaf(false);
              await leaf.openFile(file as TFile);
            }
            resolve(null);
            return;
          }
          const isLast = index >= items.length - 1;
          popup.innerHTML = this.buildPassCard(item, results, rating, {
            nextLabel: isLast ? '' : `下一篇（${index + 2}/${items.length}）`,
            showAutoMark: false, // 二次复习不写评级数据，不显示自动标记（用户拍板 2026-08-29）
          });
          const action = await new Promise<string>((resolveAction) => {
            popup.querySelector('#quiz-next-note')!.onclick = () => resolveAction('next');
            const endBtn = popup.querySelector('#quiz-end-review');
            if (endBtn) endBtn.onclick = () => resolveAction('end'); // 最后一篇无此按钮
          });
          if (action === 'end') {
            quiz.endReviewSession();
            resolve(null);
            return;
          }
          resolve(await this.redoReviewLoop(items, index + 1, passed));
        },
      });
    });
  },

  /** 未通过结果卡（ADR-0044）：唯一按钮「复习此笔记」→ 点击关弹窗 + 开笔记 + 会话中断
   *  ticket s1：文件名经 escapeHtml 转义后拼 HTML（review 结果卡 XSS 修复）
   *  用户拍板 2026-08-29：二次复习（重做队列）不写评级数据，传 showAutoMark: false 隐藏「自动标记」徽标 */
  buildFailCard(item: ReviewItem, results: any, rating: Rating, opts?: { showAutoMark?: boolean }): string {
    const ratingNames: Record<string, string> = { again: '忘了', hard: '困难', good: '一般', easy: '简单' };
    const tagColors: Record<string, string> = { again: '#ff4757', hard: '#ff9f43', good: '#2ed573', easy: '#7bed9f' };
    const name = escapeHtml(item.name.replace(/^《|》$/g, ''));
    const autoMark =
      opts?.showAutoMark === false
        ? ''
        : `<div style="display:inline-block;padding:6px 16px;border-radius:16px;font-size:14px;font-weight:500;background:${tagColors[rating]}22;color:${tagColors[rating]};margin-bottom:20px;">自动标记：${ratingNames[rating]}</div>`;
    return `
      <div style="text-align:center;padding:24px;">
        <div style="font-size:18px;font-weight:600;margin-bottom:16px;color:var(--text-normal);">🎯 ${name}</div>
        <div style="font-size:40px;margin-bottom:16px;">${results.correct}/${results.total}</div>
        <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">✅ 答对 ${results.correct} 题　❌ 答错 ${results.wrong} 题</div>
        ${autoMark}
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">本次复习未通过，请打开笔记复习；下次点「开始复习」将为这篇重新做题</div>
      </div>
      <button id="quiz-review-note" style="display:block;width:100%;padding:10px;border:none;border-radius:6px;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:13px;font-weight:500;">复习此笔记</button>
    `;
  },

  /** 通过结果卡（重做复用视觉）：下一篇/完成复习；最后一篇（nextLabel 空）只保留「完成复习」按钮
   *  ticket s1：文件名经 escapeHtml 转义后拼 HTML（review 结果卡 XSS 修复）
   *  用户拍板 2026-08-29：二次复习（重做队列）不写评级数据，传 showAutoMark: false 隐藏「自动标记」徽标 */
  buildPassCard(item: ReviewItem, results: any, rating: Rating, opts: { nextLabel?: string; showAutoMark?: boolean }): string {
    const ratingNames: Record<string, string> = { again: '忘了', hard: '困难', good: '一般', easy: '简单' };
    const tagColors: Record<string, string> = { again: '#ff4757', hard: '#ff9f43', good: '#2ed573', easy: '#7bed9f' };
    const name = escapeHtml(item.name.replace(/^《|》$/g, ''));
    const autoMark =
      opts?.showAutoMark === false
        ? ''
        : `<div style="display:inline-block;padding:6px 16px;border-radius:16px;font-size:14px;font-weight:500;background:${tagColors[rating]}22;color:${tagColors[rating]};margin-bottom:20px;">自动标记：${ratingNames[rating]}</div>`;
    // 非最后一篇才保留「结束这次复习」按钮；终局结算面板只有「完成复习」一条路（用户拍板 2026-08-29）
    const endBtn = opts?.nextLabel
      ? `<button id="quiz-end-review" style="display:block;width:100%;padding:10px;margin-top:8px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-secondary);color:var(--text-muted);cursor:pointer;font-size:13px;">结束这次复习</button>`
      : '';
    return `
      <div style="text-align:center;padding:24px;">
        <div style="font-size:18px;font-weight:600;margin-bottom:16px;color:var(--text-normal);">🎯 ${name}</div>
        <div style="font-size:40px;margin-bottom:16px;">${results.correct}/${results.total}</div>
        <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">✅ 答对 ${results.correct} 题　❌ 答错 ${results.wrong} 题</div>
        ${autoMark}
      </div>
      <button id="quiz-next-note" style="display:block;width:100%;padding:10px;border:none;border-radius:6px;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:13px;font-weight:500;">${opts.nextLabel || '完成复习'}</button>
      ${endBtn}
    `;
  },

  /** 做题复习循环（源码 L587-657 逐字；经做题会话契约驱动做题家，不直写内部状态） */
  async quizReviewLoop(items: ReviewItem[], index: number, batchQuestions: Record<string, any[]>): Promise<void> {
    const app = getApp();
    const quiz: any = await this.getQuiz();

    if (index >= items.length) {
      quiz.endReviewSession();
      notice('所有做题复习已完成', 'success');
      return;
    }
    const item = items[index];
    const questions = batchQuestions[item.filePath] || [];

    if (!questions.length) {
      await this.quizReviewLoop(items, index + 1, batchQuestions);
      return;
    }

    return new Promise((resolve) => {
      quiz.startReviewSession({
        questions,
        onComplete: async (results: any) => {
        const rating = this.accuracyToRating(results.accuracy);

        // 首次评级照常写排期/历史（预期判断标准，ADR-0044）；未通过联动待重做标记
        await this.markReview(item.filePath, rating, { autoPending: true });
        await this.applyReviewStyles(app);

        // ticket 098：自动评级未通过（忘了/困难）→ 结果卡唯一按钮「复习此笔记」+ 强制打开笔记，本次会话中断
        if (rating === 'again' || rating === 'hard') {
          if (quiz.popup) {
            quiz.popup.innerHTML = this.buildFailCard(item, results, rating);
            await new Promise<void>((resolveClick) => {
              quiz.popup!.querySelector('#quiz-review-note')!.onclick = () => {
                quiz.close();
                resolveClick();
              };
            });
            const file = app.vault.getAbstractFileByPath(item.filePath);
            if (file) {
              const leaf = app.workspace.getLeaf(false);
              await leaf.openFile(file as TFile);
            }
          }
          resolve();
          return;
        }

        // 在弹窗内显示结果（弹窗不关闭；结果卡与重做路径共用 buildPassCard）
        const popup = quiz.popup;
        if (popup) {
          const isLast = index >= items.length - 1;
          popup.innerHTML = this.buildPassCard(item, results, rating, {
            nextLabel: isLast ? '' : `下一篇（${index + 2}/${items.length}）`,
          });

          const action = await new Promise<string>((resolveAction) => {
            popup.querySelector('#quiz-next-note')!.onclick = () => resolveAction('next');
            const endBtn = popup.querySelector('#quiz-end-review');
            if (endBtn) endBtn.onclick = () => resolveAction('end'); // 最后一篇无此按钮
          });

          if (action === 'end') {
            quiz.endReviewSession();
            resolve();
            return;
          }
        }

        resolve();
        await this.quizReviewLoop(items, index + 1, batchQuestions);
      },
    });
    });
},

  /** 批量生成题目（返回 {filePath: questions[]} 映射） */
  async batchGenerateQuestions(items: ReviewItem[]): Promise<Record<string, any[]>> {
    const quiz: any = await this.getQuiz();
    if (!quiz || !quiz.ai) {
      console.warn('做题家未初始化（缺少 AI）');
      notify('做题家未初始化（缺少 AI），已改用普通复习', { type: 'warning', dedupeKey: 'review-quiz-ai' });
      return {};
    }

    const notePaths = items.map((i) => i.filePath);

    // 复用做题家的 ensureQuestions：自动检查 quiz.json，只生成缺失的
    await quiz.ensureQuestions(notePaths);

    // 从 quiz.json 读取所有题目，补上 notePath/_index（renderModal 需要）
    // 注意：getQuestionsForNote 签名为 (app, notePath)，缺参会导致 notePath=undefined 读不到题目
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

  /** 顺序复习循环（源码 L686-709 逐字） */
  async reviewLoop(overdueNotes: ReviewItem[], index: number): Promise<void> {
    const app = getApp();
    this.ensure(app);
    const dm = this.dataManager!;
    if (index >= overdueNotes.length) {
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
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file as TFile);
    // 连续复习：常驻单框动态更新（同键存活时原地合并，不刷屏）
    const reviewMsg = `复习中 (${index + 1}/${overdueNotes.length}): ${item.name}`;
    if (this._reviewNotice) {
      this._reviewNotice.setMessage(reviewMsg);
    } else {
      this._reviewNotice = notify(reviewMsg, { type: 'progress', dedupeKey: 'review-loop' });
    }

    let checkCount = 0;
    const maxChecks = 300;
    const interval = setInterval(async () => {
      checkCount++;
      const activeFile = app.workspace.getActiveFile();
      if (!activeFile || activeFile.path !== item.filePath) {
        clearInterval(interval);
        // P1-2：活动文件切走 = 本轮连续复习中断，与超时分支同样收尾常驻通知
        if (this._reviewNotice) {
          this._reviewNotice.setMessage('已切换到其他笔记，本轮复习中断');
          this._reviewNotice.setType('warning');
          this._reviewNotice = null;
        }
        return;
      }
      const updatedItems = await dm.loadItems();
      const updated = updatedItems.find((i) => i.filePath === item.filePath);
      if (updated && updated.lastReviewed) {
        const last = new Date(updated.lastReviewed);
        if (Date.now() - last.getTime() < 30000) {
          clearInterval(interval);
          await this.reviewLoop(overdueNotes, index + 1);
          return;
        }
      }
      if (checkCount >= maxChecks) {
        clearInterval(interval);
        if (this._reviewNotice) {
          this._reviewNotice.setMessage('复习超时，请手动继续');
          this._reviewNotice.setType('warning');
          this._reviewNotice = null;
        } else {
          notice('复习超时，请手动继续', 'warning');
        }
      }
    }, 1000);
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

    const fsrs = new FSRS();

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
      if (status === 'complete') timeText = '✅';
      else if (nextReview) {
        const diff = nextReview.getTime() - now.getTime();
        if (diff > 0) {
          const d = Math.floor(diff / (1000 * 60 * 60 * 24));
          const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          if (d > 0) timeText = `${d}d`;
          else if (h > 0) timeText = `${h}h`;
          else timeText = `${m}m`;
        } else timeText = '📅';
      }
      if (timeText) {
        const badgeEl = document.createElement('span');
        badgeEl.className = 'review-stage-badge';
        badgeEl.textContent = timeText;
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
   * ticket 58：通知挂「去复习」action → 打开最早逾期笔记。
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
        // ticket 58：最早逾期（最紧迫）作「去复习」跳转目标。
        // 修 #1：目标只从本次 newly（通知名单）取——全逾集合含已在通知而逾期未清的旧条目，
        // 同键合并通知的 action 闭包保持首目标，会出现「通知 B 却打开 A」。
        const earliest = newly
          .map(([, i]) => i)
          .sort(
            (a, b) =>
              new Date((a.nextReviewDate as string) || '0').getTime() -
              new Date((b.nextReviewDate as string) || '0').getTime()
          )[0];
        const handle = notify(`有 ${overdueMap.size} 篇笔记逾期`, {
          type: 'info',
          duration: 0, // 常驻不自动消失，靠点击「去复习」/本体收起
          dedupeKey: 'review-overdue-notice',
          action: {
            label: '去复习', // action 文案不带 emoji（通知规范）
            onClick: () => {
              if (!earliest) return;
              const app = getApp();
              const file = app.vault.getAbstractFileByPath(earliest.filePath);
              if (!file) return;
              const leaf = app.workspace.getLeaf(false);
              void leaf.openFile(file as TFile);
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
