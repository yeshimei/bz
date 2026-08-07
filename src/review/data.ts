/**
 * 复习计划数据层（ticket 16，源码 L66-146 逐字移植）
 * review.json：CONFIG/STORAGE/review.json，jsonStore 读写。
 */
import type { App, TFile } from 'obsidian';
import { jsonStore } from '../core/json-store';
import { FSRS_FIRST_INTERVALS, LADDER_MAX } from './fsrs';

export const REVIEW_FILE_PATH = 'CONFIG/STORAGE/review.json';

export interface ReviewItem {
  id: string;
  filePath: string;
  fileName: string;
  reviewStart: number;
  stage: number;
  phase: 'ladder' | 'fsrs';
  stability: number;
  difficulty: number;
  reviewHistory: any[];
  totalReviews: number;
  averageConfidence: number;
  nextReviewDate: number;
  lastReviewed: number | null;
  lastDifficulty: string | null;
  completed: boolean;
  // 兼容旧字段（读取时映射）
  reviewStage?: number;
  isOverdue?: boolean;
  currentStage?: number;
  // 运行时
  file?: TFile;
}

export class ReviewDataManager {
  app: App;
  items: ReviewItem[] = [];

  constructor(app: App) {
    this.app = app;
  }

  /** 加载条目（向后兼容旧字段） */
  async loadItems(): Promise<ReviewItem[]> {
    const data = (await jsonStore(REVIEW_FILE_PATH).read()) as any;
    const items = (data && Array.isArray(data.items) ? data.items : []) as ReviewItem[];
    const now = Date.now();
    const loaded: ReviewItem[] = [];

    for (const raw of items) {
      const item: ReviewItem = { ...raw };
      const file = this.app.vault.getAbstractFileByPath(item.filePath);
      if (!file) continue; // 文件不存在跳过
      item.file = file as TFile;
      item.fileName = (file as TFile).basename;
      // 向后兼容
      if (item.stage === undefined) item.stage = ((item.reviewStage || 1) - 1);
      if (item.stability === undefined) item.stability = 1;
      if (item.difficulty === undefined) item.difficulty = 0.3;
      if (item.phase === undefined) item.phase = item.stage >= LADDER_MAX ? 'fsrs' : 'ladder';
      item.isOverdue = !!item.nextReviewDate && now > item.nextReviewDate && !item.completed;
      item.currentStage = item.stage + 1;
      loaded.push(item);
    }
    this.items = loaded;
    return loaded;
  }

  /** 保存（剥离运行时 file 字段） */
  async saveItems(): Promise<void> {
    const items = this.items.map(({ file, ...rest }) => rest);
    await jsonStore(REVIEW_FILE_PATH).write({ items });
  }

  /** 新增条目 */
  async addItem(file: TFile): Promise<ReviewItem> {
    if (this.items.some((i) => i.filePath === file.path)) {
      throw new Error('该笔记已在复习计划中');
    }
    const now = Date.now();
    const item: ReviewItem = {
      id: `rev_${now}_${Math.random().toString(36).slice(2, 8)}`,
      filePath: file.path,
      fileName: file.basename,
      reviewStart: now,
      stage: 0,
      phase: 'ladder',
      stability: 1,
      difficulty: 0.3,
      reviewHistory: [],
      totalReviews: 0,
      averageConfidence: 0,
      nextReviewDate: now + FSRS_FIRST_INTERVALS[0] * 86400000,
      lastReviewed: null,
      lastDifficulty: null,
      completed: false,
      file,
      currentStage: 1,
    };
    this.items.push(item);
    await this.saveItems();
    return item;
  }

  /** 更新条目 */
  async updateItem(item: ReviewItem): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === item.id);
    if (idx === -1) throw new Error('条目不存在');
    this.items[idx] = item;
    await this.saveItems();
  }

  /** 移除条目 */
  async removeItem(id: string): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id);
    await this.saveItems();
  }

  /** 文件重命名时更新路径 */
  async updateFilePath(oldPath: string, newPath: string, newName: string): Promise<boolean> {
    const item = this.items.find((i) => i.filePath === oldPath);
    if (!item) return false;
    if (this.items.some((i) => i.filePath === newPath && i.id !== item.id)) return false;
    item.filePath = newPath;
    item.fileName = newName;
    await this.saveItems();
    return true;
  }
}
