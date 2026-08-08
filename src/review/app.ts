/**
 * 复习计划核心应用（ticket 16 修正版：对齐源码 App，含 quizReviewLoop/reviewLoop）
 */
import type { App, TFile } from 'obsidian';
import { notice, notify } from '../core/notice';
import { getApp } from '../core/app';
import { FSRS, FSRS_FIRST_INTERVALS, FSRS_FIRST_TEXTS, LADDER_MAX } from './fsrs';
import type { Rating } from './fsrs';
import type { ReviewItem } from './data';
import { ReviewDataManager } from './data';

export const reviewApp = {
  checkInterval: null as ReturnType<typeof setInterval> | null,
  dataManager: null as ReviewDataManager | null,
  /** 测试注入：对齐源码 window.__quiz 语义 */
  _quizOverride: null as any | null,

  async getQuiz(): Promise<any> {
    if (this._quizOverride) return this._quizOverride;
    return (await import('../quiz')).quizUI;
  },

  ensure(app: App): void {
    if (!this.dataManager) this.dataManager = new ReviewDataManager(app);
  },

  async markReview(filePath: string, selectedDifficulty: Rating): Promise<void> {
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
      notice(`⏰ 还未到复习时间（${mins}分钟后）`);
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
      });
      notice(enteringFsrs ? `✅ 进入深度复习，${FSRS_FIRST_TEXTS[targetStage]}后复习` : `✅ ${FSRS_FIRST_TEXTS[targetStage]}后复习`);
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
    });

    const days = Math.round(result.days);
    const rPct = Math.round(R * 100);
    notice(`✅ R=${rPct}% → 下次复习：${days > 0 ? days + '天' : '1天'}后`);
  },

  /** 跳转逾期 */
  async autoJumpOverdue(): Promise<void> {
    const app = getApp();
    this.ensure(app);
    const dm = this.dataManager!;
    const items = await dm.loadItems();
    const overdue = items.filter((i) => i.isOverdue && !i.isCompleted);
    if (!overdue.length) {
      notice('🎉 没有逾期笔记');
      return;
    }
    overdue.sort((a, b) => new Date(a.nextReviewDate as string).getTime() - new Date(b.nextReviewDate as string).getTime());

    let quiz: any = null;
    try {
      quiz = await this.getQuiz();
    } catch {
      /* ignore */
    }

    if (quiz && quiz.ai) {
      const h = notify('正在批量生成题目…', { type: 'progress' });
      const batchQuestions = await this.batchGenerateQuestions(overdue);
      const hasAny = Object.values(batchQuestions).some((qs) => (qs as any[]).length > 0);
      if (!hasAny) {
        h.setType('warning');
        h.setMessage('⚠️ 批量出题失败，改用普通复习');
        await this.reviewLoop(overdue, 0);
      } else {
        h.setType('success');
        h.setMessage('✅ 题目已生成，开始做题复习');
        await this.quizReviewLoop(overdue, 0, batchQuestions);
      }
    } else {
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

  /** 做题复习循环（源码 L587-657 逐字；经做题会话契约驱动做题家，不直写内部状态） */
  async quizReviewLoop(items: ReviewItem[], index: number, batchQuestions: Record<string, any[]>): Promise<void> {
    const app = getApp();
    const quiz: any = await this.getQuiz();

    if (index >= items.length) {
      quiz.endReviewSession();
      notice('🎉 所有做题复习已完成');
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

        await this.markReview(item.filePath, rating);
        await this.applyReviewStyles(app);

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
      return {};
    }

    const notePaths = items.map((i) => i.filePath);

    // 复用做题家的 ensureQuestions：自动检查 quiz.json，只生成缺失的
    await quiz.ensureQuestions(notePaths);

    // 从 quiz.json 读取所有题目，补上 notePath/_index（renderModal 需要）
    const out: Record<string, any[]> = {};
    for (const item of items) {
      const qs = await quiz.manager.getQuestionsForNote(item.filePath);
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
      notice('🎉 所有逾期笔记已复习完成');
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
    notice(`📖 复习中 (${index + 1}/${overdueNotes.length}): ${item.name}`);

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
        notice('⏸️ 复习超时，请手动继续');
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
    notice('✅ 已加入复习计划，首次复习：1分钟后');
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
