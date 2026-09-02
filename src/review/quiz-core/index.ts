/**
 * 做题家入口（ticket 17）：ensureQuiz/quizUpdate + 单例 re-export。
 * 独立命令入口已退役（ticket 098），做题家经复习计划域进入
 * （review/app.ts ensureQuiz + startReviewSession、review/ui.ts quizUpdate）。
 */
import type { App } from 'obsidian';
import { createAI } from '../../core/ai';
import { getSettings } from '../../core/settings-provider';
import { QuizMasterUI, quizUI } from './session';

let initialized = false;

/** 幂等初始化：AI 注入 + 设置注入 + 样式（源码 entry L739-770） */
export function ensureQuiz(app: App): void {
  if (initialized) return;
  initialized = true;
  QuizMasterUI.ai = createAI();
  quizUI.ai = QuizMasterUI.ai; // 实例镜像：复习域经 quizUI.ai 判断（静态属性不挂实例）
  QuizMasterUI.settings = getSettings();
}

/** 更新题库（复习计划「更新题库」入口调用） */
export async function quizUpdate(app: App): Promise<void> {
  ensureQuiz(app);
  await quizUI.updateQuiz();
}

export { QuizMasterUI, quizUI };
