/**
 * 复习计划核心应用（ticket 16 修正版：对齐源码 App，含 quizReviewLoop/reviewLoop）
 */
import type { App, TFile } from 'obsidian';
import { notice, notify } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import { getApp } from '../core/app';
import { getSettings } from '../core/settings-provider';
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
    const nextDate = new Date(now.getTime() + result.days * 86400000);

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

    const days = Math.round(result.days);
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

    // 做题决定难度关闭 → 普通复习（跳转笔记，逐篇等待评级）
    if (!getSettings().forceQuizForReview) {
      await this.reviewLoop(overdue, 0);
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
      const batchQuestions = await this.batchGenerateQuestions(overdue);
      const hasAny = Object.values(batchQuestions).some((qs) => (qs as any[]).length > 0);
      if (!hasAny) {
        h.setType('warning');
        h.setMessage('批量出题失败，改用普通复习');
        await this.reviewLoop(overdue, 0);
      } else {
        h.setType('success');
        h.setMessage('题目已生成，开始做题复习');
        await this.quizReviewLoop(overdue, 0, batchQuestions);
      }
    } else {
      notify('做题家未初始化，已改用普通复习', { type: 'warning', dedupeKey: 'review-quiz-ai' });
      await this.reviewLoop(overdue, 0);
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

  /** 待重做队列复习（ADR-0044）：AI 全新出题 → 做题 → 通过仅清标记不写 FSRS；失败 → 「复习此笔记」中断会话 */
  async redoReviewLoop(items: ReviewItem[], index: number): Promise<string[] | null> {
    const app = getApp();
    this.ensure(app);
    if (index >= items.length) return items.map((i) => i.filePath);
    const quiz: any = await this.getQuiz();
    const item = items[index];
    const questions = await this.regenerateQuestions(item.filePath);
    if (!questions.length) {
      notice('重做失败：无题目可用，保持待重做', 'warning');
      return this.redoReviewLoop(items, index + 1);
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
          }
          const popup = quiz.popup;
          if (!popup) {
            resolve(failed ? null : await this.redoReviewLoop(items, index + 1));
            return;
          }
          if (failed) {
            popup.innerHTML = this.buildFailCard(item, results, rating);
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
          });
          const action = await new Promise<string>((resolveAction) => {
            popup.querySelector('#quiz-next-note')!.onclick = () => resolveAction('next');
            popup.querySelector('#quiz-end-review')!.onclick = () => resolveAction('end');
          });
          if (action === 'end') {
            quiz.endReviewSession();
            resolve(null);
            return;
          }
          resolve(await this.redoReviewLoop(items, index + 1));
        },
      });
    });
  },

  /** 未通过结果卡（ADR-0044）：唯一按钮「复习此笔记」→ 点击关弹窗 + 开笔记 + 会话中断 */
  buildFailCard(item: ReviewItem, results: any, rating: Rating): string {
    const ratingNames: Record<string, string> = { again: '忘了', hard: '困难', good: '一般', easy: '简单' };
    const tagColors: Record<string, string> = { again: '#ff4757', hard: '#ff9f43', good: '#2ed573', easy: '#7bed9f' };
    return `
      <div style="text-align:center;padding:24px;">
        <div style="font-size:18px;font-weight:600;margin-bottom:16px;color:var(--text-normal);">🎯 ${item.name.replace(/^《|》$/g, '')}</div>
        <div style="font-size:40px;margin-bottom:16px;">${results.correct}/${results.total}</div>
        <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">✅ 答对 ${results.correct} 题　❌ 答错 ${results.wrong} 题</div>
        <div style="display:inline-block;padding:6px 16px;border-radius:16px;font-size:14px;font-weight:500;background:${tagColors[rating]}22;color:${tagColors[rating]};margin-bottom:20px;">自动标记：${ratingNames[rating]}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">本次复习未通过，请打开笔记复习；下次点「开始复习」将为这篇重新做题</div>
      </div>
      <button id="quiz-review-note" style="display:block;width:100%;padding:10px;border:none;border-radius:6px;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:13px;font-weight:500;">复习此笔记</button>
    `;
  },

  /** 通过结果卡（重做复用视觉）：下一篇/完成复习/结束这次复习 */
  buildPassCard(item: ReviewItem, results: any, rating: Rating, opts: { nextLabel?: string }): string {
    const ratingNames: Record<string, string> = { again: '忘了', hard: '困难', good: '一般', easy: '简单' };
    const tagColors: Record<string, string> = { again: '#ff4757', hard: '#ff9f43', good: '#2ed573', easy: '#7bed9f' };
    return `
      <div style="text-align:center;padding:24px;">
        <div style="font-size:18px;font-weight:600;margin-bottom:16px;color:var(--text-normal);">🎯 ${item.name.replace(/^《|》$/g, '')}</div>
        <div style="font-size:40px;margin-bottom:16px;">${results.correct}/${results.total}</div>
        <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">✅ 答对 ${results.correct} 题　❌ 答错 ${results.wrong} 题</div>
        <div style="display:inline-block;padding:6px 16px;border-radius:16px;font-size:14px;font-weight:500;background:${tagColors[rating]}22;color:${tagColors[rating]};margin-bottom:20px;">自动标记：${ratingNames[rating]}</div>
      </div>
      <button id="quiz-next-note" style="display:block;width:100%;padding:10px;border:none;border-radius:6px;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:13px;font-weight:500;">${opts.nextLabel || '完成复习'}</button>
      <button id="quiz-end-review" style="display:block;width:100%;padding:10px;margin-top:8px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-secondary);color:var(--text-muted);cursor:pointer;font-size:13px;">结束这次复习</button>
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
        const ratingNames: Record<string, string> = { again: '忘了', hard: '困难', good: '一般', easy: '简单' };
        const tagColors: Record<string, string> = { again: '#ff4757', hard: '#ff9f43', good: '#2ed573', easy: '#7bed9f' };

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

        // 在弹窗内显示结果（弹窗不关闭）
        const popup = quiz.popup;
        if (popup) {
          const isLast = index >= items.length - 1;
          popup.innerHTML = `
            <div style="text-align:center;padding:24px;">
              <div style="font-size:18px;font-weight:600;margin-bottom:16px;color:var(--text-normal);">🎯 ${item.name.replace(/^《|》$/g, '')}</div>
              <div style="font-size:40px;margin-bottom:16px;">${results.correct}/${results.total}</div>
              <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">
                ✅ 答对 ${results.correct} 题　❌ 答错 ${results.wrong} 题
              </div>
              <div style="display:inline-block;padding:6px 16px;border-radius:16px;font-size:14px;font-weight:500;background:${tagColors[rating]}22;color:${tagColors[rating]};margin-bottom:20px;">
                自动标记：${ratingNames[rating]}
              </div>
            </div>
            <button id="quiz-next-note" style="display:block;width:100%;padding:10px;border:none;border-radius:6px;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:13px;font-weight:500;">${isLast ? '完成复习' : `下一篇（${index + 2}/${items.length}）`}</button>
            <button id="quiz-end-review" style="display:block;width:100%;padding:10px;margin-top:8px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-secondary);color:var(--text-muted);cursor:pointer;font-size:13px;">结束这次复习</button>
          `;

          const action = await new Promise<string>((resolveAction) => {
            popup.querySelector('#quiz-next-note')!.onclick = () => resolveAction('next');
            popup.querySelector('#quiz-end-review')!.onclick = () => resolveAction('end');
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

  /** 文件树染色 + 阶段徽标（源码 L719-772 逐字） */
  async applyReviewStyles(app: App, changedFile?: TFile): Promise<void> {
    this.ensure(app);
    const dm = this.dataManager!;
    const allItems = await dm.loadItems();
    const files = changedFile ? [changedFile] : app.vault.getMarkdownFiles();
    const fsrs = new FSRS();

    for (const file of files) {
      const el = document.querySelector(`div[data-path="${file.path}"]`);
      if (!el) continue;
      const target = el.querySelector('div.tree-item-inner') as HTMLElement | null;
      if (!target) continue;
      const badge = target.querySelector('.review-stage-badge');
      if (badge) badge.remove();

      const item = allItems.find((i) => i.filePath === file.path);
      if (!item) {
        target.style.color = '';
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
    }
  },

  /** 逾期检查（只刷新文件树染色，源码 L774-778） */
  async checkOverdueAndNotify(): Promise<void> {
    try {
      await this.applyReviewStyles(getApp());
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
