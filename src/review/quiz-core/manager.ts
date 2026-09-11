/**
 * 做题家数据层（ticket 17 修正版：对齐源码 QuizManager，读方法每次读盘）
 * G3：quiz.json 全部读改写事务收编 core per-path 串行队列（与 review.json D3 原语 1 同法，
 * enqueueFileTask 键 = quiz.json 路径）——AI 批量出题长耗时窗口内的并发删题（答题出库）与
 * 批量写回按序落盘，写回方不再用陈旧快照覆盖（答对的题复活）。纯读方法保持无锁原语。
 */
import type { App } from 'obsidian';
import { enqueueFileTask, jsonFileStore, storageFile } from '../../core/storage';
import { tryGetSettings } from '../../core/settings-provider';

/** 默认数据文件路径 */
export const QUIZ_FILE_PATH = 'CONFIG/STORAGE/quiz.json';
export const REVIEW_DATA_PATH = 'CONFIG/STORAGE/review.json';

/** 共享数据目录（ADR-0009；trim 收敛至 storageFile） */
function storageDir(): string {
  const s = tryGetSettings() as any;
  return (s && s.storagePath) || 'CONFIG/STORAGE';
}

/** 做题家数据文件路径 */
export function getQuizFilePath(): string {
  return storageFile('quiz.json', storageDir());
}

/** 复习数据文件路径（设置可配，默认 CONFIG/STORAGE/review.json） */
export function getReviewDataPath(): string {
  return storageFile('review.json', storageDir());
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndices: number[];
  /** 一句话解析+原文依据（item 3：答错时选项下方渲染；存量题无此字段静默不显示，零迁移） */
  explain?: string;
  notePath?: string;
  _index?: number;
}

/** 复习数据读取（源码做题家.js 内嵌 ReviewDataManager L16-28） */
export async function loadActiveItems(app: App): Promise<any[]> {
  const data = await jsonFileStore<any[]>(getReviewDataPath(), { app }).read();
  const items = Array.isArray(data) ? data : [];
  return items.filter((f: any) => f && !f.completed);
}

/** 题目同一性判断（P0-2 稳定定位）：question + options 逐项相等，correctIndices 视为集合 */
export function sameQuestion(
  a: Pick<QuizQuestion, 'question' | 'options' | 'correctIndices'>,
  b: Pick<QuizQuestion, 'question' | 'options' | 'correctIndices'>
): boolean {
  if (a.question !== b.question) return false;
  if (a.options.length !== b.options.length) return false;
  for (let i = 0; i < a.options.length; i++) {
    if (a.options[i] !== b.options[i]) return false;
  }
  const sa = [...a.correctIndices].sort();
  const sb = [...b.correctIndices].sort();
  if (sa.length !== sb.length) return false;
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

export class QuizManager {
  /** 加载（源码 L33-35；损坏 → {notes:{}}） */
  async loadQuiz(app: App): Promise<{ notes: Record<string, QuizQuestion[]> }> {
    try {
      const data = await jsonFileStore<{ notes: Record<string, QuizQuestion[]> }>(getQuizFilePath(), {
        defaultValue: { notes: {} },
        app,
      }).read();
      if (data && typeof data === 'object' && data.notes) return data;
      return { notes: {} };
    } catch {
      return { notes: {} };
    }
  }

  async saveQuiz(app: App, quiz: { notes: Record<string, QuizQuestion[]> }): Promise<void> {
    await jsonFileStore<{ notes: Record<string, QuizQuestion[]> }>(getQuizFilePath(), { app }).write(quiz);
  }

  /**
   * G3：quiz.json 读改写事务（写路径唯一入口，纯读勿入——队列只为串行化「读→改→写」）。
   * fn 基于队列内读出的磁盘现值改动；fn 返回 false = 无改动跳过写盘。
   * 队列不可重入：fn 内勿再调 mutateQuiz/enqueueFileTask 同路径（死锁）。
   * （session.ts 批量出题写回/清理非活跃键共用——AI 长耗时窗口内基于磁盘现值合并，不覆盖并发删题）
   */
  mutateQuiz<T>(
    app: App,
    fn: (quiz: { notes: Record<string, QuizQuestion[]> }) => T | Promise<T>
  ): Promise<T> {
    return enqueueFileTask(getQuizFilePath(), async () => {
      const quiz = await this.loadQuiz(app);
      const result = await fn(quiz);
      if (result !== false) await this.saveQuiz(app, quiz);
      return result;
    });
  }

  /** 源码 L40-43 */
  async getQuestionsForNote(app: App, notePath: string): Promise<QuizQuestion[] | null> {
    const quiz = await this.loadQuiz(app);
    return quiz.notes[notePath] || null;
  }

  /** 源码 L45-49（G3：RMW 入队，fn 内改现值） */
  async saveQuestionsForNote(app: App, notePath: string, questions: QuizQuestion[]): Promise<void> {
    await this.mutateQuiz(app, (quiz) => {
      quiz.notes[notePath] = questions.map((q) => ({ ...q }));
    });
  }

  /** 源码 L51-57 splice 语义 + P0-2 稳定定位改造：
   *  会话期 _index 是开考时的快照，题库并发变化（同笔记多题先后答对、复习重出题等）
   *  后按快照下标会删错行/漏删；改为按题目生成标识（question+options+correctIndices，
   *  correctIndices 顺序不敏感）在存储数组内定位。
   *  同内容多题：每次删除首个匹配＝按未答优先逐个消费。
   *  目标题已不在库中（并发刷新等）→ 终态已达成，静默成功不写盘（fn 返回 false）；
   *  空键仍保留（源码语义）。G3：RMW 入队，与批量出题写回互斥串行。 */
  async removeQuestion(
    app: App,
    notePath: string,
    target: Pick<QuizQuestion, 'question' | 'options' | 'correctIndices'>
  ): Promise<void> {
    await this.mutateQuiz(app, (quiz) => {
      const list = quiz.notes[notePath];
      if (!list) return false;
      const idx = list.findIndex((q) => sameQuestion(q, target));
      if (idx === -1) return false;
      list.splice(idx, 1);
      return undefined as void;
    });
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
