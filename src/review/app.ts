/**
 * 复习计划核心逻辑（ticket 16，源码 L483-894 逐字移植）
 */
import type { App, TFile } from 'obsidian';
import { Notice } from 'obsidian';
import { getSettings } from '../core/settings-provider';
import { getApp } from '../core/app';
import { FSRS, FSRS_FIRST_INTERVALS, FSRS_FIRST_TEXTS, LADDER_MAX, TOTAL_STAGES } from './fsrs';
import type { Rating } from './fsrs';
import type { ReviewItem } from './data';

export const reviewApp = {
  FSRS: new FSRS(),

  /** 复习标记（阶梯/FSRS 分支） */
  async markReview(app: App, item: ReviewItem, rating: Rating): Promise<ReviewItem> {
    const now = Date.now();
    const fsrs = reviewApp.FSRS;

    // 未到时间检查
    if (item.nextReviewDate && now < item.nextReviewDate && !item.completed) {
      const mins = Math.max(1, Math.round((item.nextReviewDate - now) / 60000));
      new Notice(`⏰ 还未到复习时间（${mins}分钟后）`);
      return item;
    }

    if (item.phase === 'ladder' || item.stage < LADDER_MAX) {
      // 阶梯分支
      let targetStage = item.stage;
      if (rating === 'again') targetStage = Math.max(0, item.stage - 1);
      else if (rating === 'hard') targetStage = item.stage;
      else if (rating === 'good') targetStage = item.stage + 1;
      else if (rating === 'easy') targetStage = item.stage + 2;
      targetStage = Math.max(0, Math.min(9, targetStage));

      item.reviewHistory.push({ timestamp: now, stage: targetStage + 1, rating });
      item.stage = targetStage;
      item.lastReviewed = now;
      item.lastDifficulty = rating;
      item.totalReviews = (item.totalReviews || 0) + 1;

      const enteringFsrs = targetStage >= LADDER_MAX;
      if (enteringFsrs) {
        item.phase = 'fsrs';
        item.stability = fsrs.initS(rating);
        item.difficulty = rating === 'again' ? fsrs.w[4] : 0.3;
        item.nextReviewDate = now + item.stability * 86400000;
        new Notice(`✅ 进入深度复习，${Math.round(item.stability)}天后复习`);
      } else {
        item.phase = 'ladder';
        item.nextReviewDate = now + FSRS_FIRST_INTERVALS[targetStage] * 86400000;
        new Notice(`✅ ${FSRS_FIRST_TEXTS[targetStage]}后复习`);
      }
      return item;
    }

    // FSRS 分支
    const S = item.stability || 1;
    const D = item.difficulty || 0.3;
    const t = (now - (item.lastReviewed || item.reviewStart)) / 86400000;
    const R = fsrs.R(t, S);
    const result = fsrs.nextInterval(S, D, rating, R);

    item.stability = Math.round(result.S * 100) / 100;
    item.difficulty = Math.round(result.D * 100) / 100;
    item.stage = item.stage + 1;
    item.lastReviewed = now;
    item.lastDifficulty = rating;
    item.totalReviews = (item.totalReviews || 0) + 1;
    item.nextReviewDate = now + Math.max(result.days, 1) * 86400000;
    item.reviewHistory.push({
      timestamp: now,
      stage: item.stage + 1,
      rating,
      stability: item.stability,
      R: Math.round(R * 100),
    });

    const rPct = Math.round(R * 100);
    const days = Math.round(result.days);
    new Notice(`✅ R=${rPct}% → 下次复习：${days > 0 ? days + '天' : '1天'}后`);
    return item;
  },

  /** 跳转逾期（批量出题模式） */
  async autoJumpOverdue(app: App, dataManager: any, quiz: any): Promise<void> {
    await dataManager.loadItems();
    const overdue = dataManager.items.filter((i: ReviewItem) => i.isOverdue && !i.completed);
    if (overdue.length === 0) {
      new Notice('🎉 没有逾期笔记');
      return;
    }

    const settings = getSettings();
    if (settings.forceQuizForReview && quiz && quiz.ai) {
      const ok = await reviewApp.batchGenerateQuestions(app, quiz, overdue.map((i: ReviewItem) => i.filePath));
      if (!ok) {
        new Notice('⚠️ 批量出题失败，改用普通复习');
      }
    }
  },

  /** 准确率 → 难度评级 */
  accuracyToRating(accuracy: number): Rating {
    if (accuracy >= 90) return 'easy';
    if (accuracy >= 70) return 'good';
    if (accuracy >= 50) return 'hard';
    return 'again';
  },

  /** 批量生成题目（做题家联动） */
  async batchGenerateQuestions(app: App, quiz: any, notePaths: string[]): Promise<boolean> {
    try {
      if (quiz && quiz.ensureQuestions) {
        await quiz.ensureQuestions(notePaths);
        return true;
      }
      const { QuizManager, quizUI } = await import('../quiz');
      if (quizUI && quizUI.ensureQuestions) {
        await quizUI.ensureQuestions(notePaths);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('批量出题失败', e);
      return false;
    }
  },

  /** 加入当前笔记到复习计划 */
  async addCurrentToReview(app: App, dataManager: any): Promise<void> {
    const file = app.workspace.getActiveFile();
    if (!file) {
      new Notice('请先打开一个笔记');
      return;
    }
    try {
      await dataManager.addItem(file);
      new Notice('✅ 已加入复习计划，首次复习：1分钟后');
    } catch (e: any) {
      new Notice(e.message || '加入失败');
    }
  },
};
