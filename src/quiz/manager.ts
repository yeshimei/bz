/**
 * 做题家数据层（ticket 17 修正版：对齐源码 QuizManager，读方法每次读盘）
 */
import type { App } from 'obsidian';
import { jsonStore } from '../core/json-store';
import { tryGetSettings } from '../core/settings-provider';

/** 默认数据文件路径（设置 quizStoragePath/reviewStoragePath 可改目录） */
export const QUIZ_FILE_PATH = 'CONFIG/STORAGE/quiz.json';
export const REVIEW_DATA_PATH = 'CONFIG/STORAGE/review.json';

/** 共享数据目录（ADR-0009：storagePath 优先，旧 reviewStoragePath 兼容兜底） */
function storageDir(): string {
  const s = tryGetSettings() as any;
  return (s && (s.storagePath || s.reviewStoragePath)) || 'CONFIG/STORAGE';
}

/** 做题家数据文件路径 */
export function getQuizFilePath(): string {
  return `${storageDir()}/quiz.json`;
}

/** 复习数据文件路径（设置可配，默认 CONFIG/STORAGE/review.json） */
export function getReviewDataPath(): string {
  return `${storageDir()}/review.json`;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndices: number[];
  notePath?: string;
  _index?: number;
}

/** 复习数据读取（源码做题家.js 内嵌 ReviewDataManager L16-28） */
export async function loadActiveItems(app: App): Promise<any[]> {
  const data = (await jsonStore(getReviewDataPath()).read()) as any;
  const items = Array.isArray(data) ? data : [];
  return items.filter((f: any) => f && !f.completed);
}

export class QuizManager {
  /** 加载（源码 L33-35；损坏 → {notes:{}}） */
  async loadQuiz(app: App): Promise<{ notes: Record<string, QuizQuestion[]> }> {
    try {
      const data = (await jsonStore(getQuizFilePath()).read()) as any;
      if (data && typeof data === 'object' && data.notes) return data;
      return { notes: {} };
    } catch {
      return { notes: {} };
    }
  }

  async saveQuiz(app: App, quiz: { notes: Record<string, QuizQuestion[]> }): Promise<void> {
    await jsonStore(getQuizFilePath()).write(quiz);
  }

  /** 源码 L40-43 */
  async getQuestionsForNote(app: App, notePath: string): Promise<QuizQuestion[] | null> {
    const quiz = await this.loadQuiz(app);
    return quiz.notes[notePath] || null;
  }

  /** 源码 L45-49 */
  async saveQuestionsForNote(app: App, notePath: string, questions: QuizQuestion[]): Promise<void> {
    const quiz = await this.loadQuiz(app);
    quiz.notes[notePath] = questions.map((q) => ({ ...q }));
    await this.saveQuiz(app, quiz);
  }

  /** 源码 L51-57：splice，不删空键 */
  async removeQuestion(app: App, notePath: string, questionIndex: number): Promise<void> {
    const quiz = await this.loadQuiz(app);
    const list = quiz.notes[notePath];
    if (list && list[questionIndex]) {
      list.splice(questionIndex, 1);
      await this.saveQuiz(app, quiz);
    }
  }

  /** 源码 L59-72：遍历补 notePath/_index */
  async getUncompletedQuestions(app: App): Promise<QuizQuestion[]> {
    const quiz = await this.loadQuiz(app);
    const out: QuizQuestion[] = [];
    for (const [notePath, questions] of Object.entries(quiz.notes)) {
      questions.forEach((q, i) => {
        out.push({ ...q, notePath, _index: i });
      });
    }
    return out;
  }

  /** 源码 L74-87 */
  async getAllQuestions(app: App): Promise<QuizQuestion[]> {
    return this.getUncompletedQuestions(app);
  }
}
