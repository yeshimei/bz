/**
 * 做题家入口（ticket 17）：ensureQuiz/resetQuiz + 单例 re-export。
 * 独立命令入口已退役（ticket 098），做题家经复习计划域进入
 * （review/app.ts ensureQuiz + startReviewSession、review/quiz-panel.ts openQuizPanel）。
 * A5（深审批 C）：quizUpdate 删除——「更新题库」入口已随 ADR-0045 退役，
 * 全仓零调用方（原注释宣称的 review/ui.ts 调用点不存在），连带链见 session.ts/manager.ts。
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

/**
 * F6（深审批 C）：会话复位——initialized 旗标与 AI 注入清零，插件禁用/重载后
 * 再启用可重新 ensureQuiz（重建设置引用、不复用旧 app 期的 AI 实例）。
 * 供 unloadReview 调用（接线归批 B/主线程）。
 */
export function resetQuiz(): void {
  initialized = false;
  QuizMasterUI.ai = null;
  quizUI.ai = null; // 实例镜像与静态同清（ensureQuiz 时两者同步重建）
}

export { QuizMasterUI, quizUI };
