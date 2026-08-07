/**
 * 做题家入口（ticket 17：ensureQuiz/quizUpdate/quizOpen + 单例 re-export）
 * 命令（quiz-master-update / quiz-master-open）由 main.ts 裸注册。
 */
import type { App } from 'obsidian';
import { createAI } from '../core/ai';
import { getSettings } from '../core/settings-provider';
import { QuizManager } from './manager';
import { QuestionGenerator } from './generator';
import { QuizMasterUI, quizUI } from './ui';

let initialized = false;
let _app: App | null = null;

/** 幂等初始化：AI 注入 + 设置注入 + 样式 */
export function ensureQuiz(app: App): void {
  if (initialized) return;
  initialized = true;
  _app = app;
  QuizMasterUI.ai = createAI();
  QuizMasterUI.settings = getSettings();
  quizUI.app = app;
  quizUI.manager = new QuizManager();
  quizUI.generator = new QuestionGenerator(QuizMasterUI.ai);
}

/** 更新题库（quiz-master-update） */
export async function quizUpdate(app: App): Promise<void> {
  ensureQuiz(app);
  try {
    await quizUI.manager.loadQuiz(app);
    await quizUI.updateQuiz(app);
  } catch (e) {
    console.warn('更新题库失败', e);
  }
}

/** 打开做题家（quiz-master-open） */
export async function quizOpen(app: App): Promise<void> {
  ensureQuiz(app);
  await quizUI.startQuiz(app);
}

export { QuizManager, QuestionGenerator, QuizMasterUI, quizUI };
