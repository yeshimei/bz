/**
 * 复习计划数据层（ticket 16 修正版：对齐源码 DataManager，日期字段 ISO 字符串）
 * review.json：CONFIG/STORAGE/review.json，jsonStore 读写。
 */
import type { App, TFile } from 'obsidian';
import { jsonStore } from '../core/json-store';
import { tryGetSettings } from '../core/settings-provider';
import { FSRS_FIRST_INTERVALS, LADDER_MAX, TOTAL_STAGES } from './fsrs';

export const REVIEW_FILE_PATH = 'CONFIG/STORAGE/review.json';

/** 复习数据文件路径（ADR-0009：storagePath 优先，旧 reviewStoragePath 兼容兜底） */
export function getReviewFilePath(): string {
  const s = tryGetSettings() as any;
  const dir = (s && (s.storagePath || s.reviewStoragePath)) || 'CONFIG/STORAGE';
  return `${dir}/review.json`;
}

export interface ReviewItem {
  id: string;
  filePath: string;
  name: string;
  reviewStart: string; // ISO
  stage: number;
  phase: 'ladder' | 'fsrs';
  stability: number;
  difficulty: number;
  reviewHistory: any[];
  totalReviews: number;
  averageConfidence: number;
  nextReviewDate: string | null; // ISO
  lastReviewed: string | null; // ISO
  lastDifficulty: string | null;
  completed: boolean;
  // 兼容旧字段（读取时映射）
  reviewStage?: number;
  // 运行时
  file?: TFile;
  isCompleted?: boolean;
  isOverdue?: boolean;
  currentStage?: number;
  totalStages?: number;
}

export class ReviewDataManager {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  /** 加载条目（向后兼容旧字段；日期兼容 ISO 字符串与数字） */
  async loadItems(): Promise<ReviewItem[]> {
    const data = (await jsonStore(getReviewFilePath()).read()) as any;
    const items = Array.isArray(data) ? data : [];
    const valid: ReviewItem[] = [];

    for (const item of items) {
      const file = this.app.vault.getAbstractFileByPath(item.filePath);
      if (!file) continue;
      item.file = file as TFile;
      item.name = (file as TFile).basename;
      // 向后兼容：旧数据用 reviewStage，新数据用 stage
      if (item.stage === undefined) item.stage = (item.reviewStage || 1) - 1;
      if (item.stability === undefined) item.stability = 1;
      if (item.difficulty === undefined) item.difficulty = 0.3;
      if (item.phase === undefined) item.phase = item.stage >= LADDER_MAX ? 'fsrs' : 'ladder';
      const now = new Date();
      const isCompleted = item.completed || false;
      const nextReview = item.nextReviewDate ? new Date(item.nextReviewDate) : null;
      const isOverdue = !!nextReview && now > nextReview && !isCompleted;
      item.isCompleted = isCompleted;
      item.isOverdue = isOverdue;
      item.currentStage = item.stage + 1;
      item.totalStages = TOTAL_STAGES;
      valid.push(item);
    }
    return valid;
  }

  /** 保存（剥离运行时 file 字段） */
  async saveItems(items: ReviewItem[]): Promise<void> {
    const data = items.map(({ file, ...rest }) => rest);
    await jsonStore(getReviewFilePath()).write(data);
  }

  /** 新增条目 */
  async addItem(filePath: string, fileName: string): Promise<ReviewItem> {
    const items = await this.loadItems();
    if (items.some((i) => i.filePath === filePath)) throw new Error('该笔记已在复习计划中');
    const now = new Date();
    const newItem: ReviewItem = {
      id: `review_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      filePath,
      name: fileName,
      reviewStart: now.toISOString(),
      stage: 0,
      phase: 'ladder',
      stability: 1,
      difficulty: 0.3,
      reviewHistory: [],
      totalReviews: 0,
      averageConfidence: 0,
      nextReviewDate: new Date(now.getTime() + FSRS_FIRST_INTERVALS[0] * 86400000).toISOString(),
      lastReviewed: null,
      lastDifficulty: null,
      completed: false,
    };
    items.push(newItem);
    await this.saveItems(items);
    return newItem;
  }

  /** 更新条目（按 filePath 定位 + 就地修改 + 落盘） */
  async updateItem(filePath: string, updateFn: (item: ReviewItem) => void): Promise<void> {
    const items = await this.loadItems();
    const idx = items.findIndex((i) => i.filePath === filePath);
    if (idx === -1) throw new Error('条目不存在');
    updateFn(items[idx]);
    await this.saveItems(items);
  }

  /** 移除条目 */
  async removeItem(filePath: string): Promise<void> {
    let items = await this.loadItems();
    items = items.filter((i) => i.filePath !== filePath);
    await this.saveItems(items);
  }

  getOverdueCount(items: ReviewItem[]): number {
    return items.filter((i) => i.isOverdue && !i.isCompleted).length;
  }

  /** 文件重命名时更新路径 */
  async updateFilePath(oldPath: string, newPath: string, newName: string): Promise<boolean> {
    const items = await this.loadItems();
    const item = items.find((i) => i.filePath === oldPath);
    if (!item) return false;
    if (items.some((i) => i.filePath === newPath && i.filePath !== oldPath)) return false;
    item.filePath = newPath;
    item.name = newName;
    await this.saveItems(items);
    return true;
  }
}
