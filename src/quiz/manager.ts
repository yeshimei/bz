/**
 * 做题家数据层（ticket 17，源码 L8-88 逐字移植）
 */
import type { App } from 'obsidian';
import { jsonStore } from '../core/json-store';

export const QUIZ_FILE_PATH = 'CONFIG/STORAGE/quiz.json';
export const REVIEW_DATA_PATH = 'CONFIG/STORAGE/review.json';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndices: number[];
  notePath?: string;
  _index?: number;
}

export class QuizManager {
  quiz: { notes: Record<string, QuizQuestion[]> } = { notes: {} };

  /** 加载（损坏/首跑归一化） */
  async loadQuiz(app: App): Promise<void> {
    try {
      const data = (await jsonStore(QUIZ_FILE_PATH).read()) as any;
      if (data && typeof data === 'object' && data.notes) {
        this.quiz = data;
      } else if (Array.isArray(data)) {
        this.quiz = { notes: {} }; // 归一化
      } else {
        this.quiz = { notes: {} };
      }
    } catch {
      this.quiz = { notes: {} };
    }
  }

  async saveQuiz(app: App): Promise<void> {
    await jsonStore(QUIZ_FILE_PATH).write(this.quiz);
  }

  getQuestionsForNote(notePath: string): QuizQuestion[] | null {
    return this.quiz.notes[notePath] || null;
  }

  async saveQuestionsForNote(app: App, notePath: string, questions: QuizQuestion[]): Promise<void> {
    this.quiz.notes[notePath] = questions.map((q) => ({ ...q }));
    await this.saveQuiz(app);
  }

  async removeQuestion(app: App, notePath: string, index: number): Promise<void> {
    const list = this.quiz.notes[notePath];
    if (!list) return;
    list.splice(index, 1);
    if (list.length === 0) delete this.quiz.notes[notePath];
    await this.saveQuiz(app);
  }

  /** 遍历补 notePath/_index */
  getUncompletedQuestions(): QuizQuestion[] {
    const out: QuizQuestion[] = [];
    for (const [notePath, questions] of Object.entries(this.quiz.notes)) {
      questions.forEach((q, i) => {
        out.push({ ...q, notePath, _index: i });
      });
    }
    return out;
  }

  getAllQuestions(): QuizQuestion[] {
    return this.getUncompletedQuestions();
  }
}
