/**
 * 复习计划数据层（ticket 16 修正版：对齐源码 DataManager，日期字段 ISO 字符串）
 * review.json：CONFIG/STORAGE/review.json，jsonStore 读写。
 * D3 可靠写契约原语 1 收编：全部「读→改→写」事务整体入 core per-path 串行队列
 * （enqueueFileTask，键 = review.json 路径）——复习中评级、文件监控批量增删与列表操作
 * 并发写同文件时按序落盘，后写者不再用陈旧基线覆盖先写者；坏文件由 jsonFileStore
 * 留档降级（原语 3）。read/saveItems 保持无锁原语（队列内调用，勿再入队——不可重入）。
 */
import type { App, TFile } from 'obsidian';
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import { tryGetSettings } from '../core/settings-provider';
import { FSRS_FIRST_INTERVALS, LADDER_MAX, TOTAL_STAGES } from './fsrs';

export const REVIEW_FILE_PATH = 'CONFIG/STORAGE/review.json';

/** 复习数据文件路径（ADR-0009 共享数据路径；trim 收敛至 storageFile） */
export function getReviewFilePath(): string {
  const s = tryGetSettings() as any;
  return storageFile('review.json', (s && s.storagePath) || 'CONFIG/STORAGE');
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
  /** 待重做（做题会话首次评级 ∈ {忘了,困难} 置位；重做通过只清标记不写 FSRS——ADR-0044） */
  pendingRedo?: boolean;
  /** 置顶/星标（ADR-0077：先于逾期队列排序、仅列表置顶、与 R 优先级互斥） */
  pinned?: boolean;
  /** 运行时：文件在 vault 中不存在（挂起记录，列表删除线展示） */
  isMissing?: boolean;
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

  /** 加载条目（向后兼容旧字段；日期兼容 ISO 字符串与数字）。
   *  走模块级 getApp（reviewApp 为单例 dataManager，app 参数注入会绑定旧 app 导致跨测试/重开写错 vault） */
  async loadItems(): Promise<ReviewItem[]> {
    const data = (await jsonFileStore<any[]>(getReviewFilePath()).read()) as any;
    const items = Array.isArray(data) ? data : [];
    const valid: ReviewItem[] = [];

    for (const item of items) {
      const file = this.app.vault.getAbstractFileByPath(item.filePath);
      if (!file) {
        // 挂起记录（ticket 098）：文件不存在 → 保留条目（挂起，列表删除线展示、不计逾期、不进复习队列）
        item.file = null as any;
        item.isMissing = true;
        item.name = item.name || item.filePath.split('/').pop()?.replace(/\.md$/, '') || item.filePath;
        item.isCompleted = item.completed || false;
        item.isOverdue = false;
        item.currentStage = (item.stage ?? (item.reviewStage || 1) - 1) + 1;
        item.totalStages = TOTAL_STAGES;
        valid.push(item);
        continue;
      }
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

  /** 保存（白名单剥离运行时字段：file/isCompleted/isOverdue/isMissing/currentStage/totalStages
   *  均为 loadItems 派生或运行时态，不落盘（数据卫生）；走模块级 getApp——见 loadItems 注释） */
  async saveItems(items: ReviewItem[]): Promise<void> {
    const data = items.map((i) => {
      const {
        file: _file, isCompleted: _isCompleted, isOverdue: _isOverdue, isMissing: _isMissing,
        currentStage: _currentStage, totalStages: _totalStages,
        ...rest
      } = i;
      return rest;
    });
    await jsonFileStore<any[]>(getReviewFilePath()).write(data);
  }

  /** 读改写事务：fn 基于磁盘现值改动，整体入 per-path 串行队列（D3 原语 1） */
  private mutate<T>(fn: (items: ReviewItem[]) => T | Promise<T>): Promise<T> {
    return enqueueFileTask(getReviewFilePath(), async () => {
      const items = await this.loadItems();
      const result = await fn(items);
      await this.saveItems(items);
      return result;
    });
  }

  /** 新增条目 */
  addItem(filePath: string, fileName: string): Promise<ReviewItem> {
    return this.mutate((items) => {
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
      return newItem;
    });
  }

  /** 更新条目（按 filePath 定位 + 就地修改 + 落盘） */
  updateItem(filePath: string, updateFn: (item: ReviewItem) => void): Promise<void> {
    return this.mutate((items) => {
      const idx = items.findIndex((i) => i.filePath === filePath);
      if (idx === -1) throw new Error('条目不存在');
      updateFn(items[idx]);
    }).then(() => undefined);
  }

  /** 移除条目（同路径重复条目全数移除，与旧 filter 语义一致） */
  removeItem(filePath: string): Promise<void> {
    return this.mutate((items) => {
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].filePath === filePath) items.splice(i, 1);
      }
    }).then(() => undefined);
  }

  /** 撤销移出（ticket 141 通病 1）：原条目（含阶段/排期/历史）原样插回，不走 addItem 重置进度。
   *  运行时字段与 saveItems 同口径剥离（file/isCompleted/isOverdue/isMissing/currentStage/totalStages 不落盘） */
  restoreItem(item: ReviewItem): Promise<void> {
    return this.mutate((items) => {
      if (items.some((i) => i.filePath === item.filePath)) return;
      const {
        file: _file, isCompleted: _isCompleted, isOverdue: _isOverdue, isMissing: _isMissing,
        currentStage: _currentStage, totalStages: _totalStages,
        ...rest
      } = item;
      items.push(rest as ReviewItem);
    }).then(() => undefined);
  }

  getOverdueCount(items: ReviewItem[]): number {
    return items.filter((i) => i.isOverdue && !i.isCompleted).length;
  }

  /** 文件重命名时更新路径 */
  updateFilePath(oldPath: string, newPath: string, newName: string): Promise<boolean> {
    return this.mutate((items) => {
      const item = items.find((i) => i.filePath === oldPath);
      if (!item) return false;
      if (items.some((i) => i.filePath === newPath && i.filePath !== oldPath)) return false;
      item.filePath = newPath;
      item.name = newName;
      return true;
    });
  }
}

/** 拟合参数落盘（ADR-0077：独立存储 review-fit.json，不覆盖 DEFAULT_W、不破坏 review.json 数组结构） */
export interface FittedParams {
  /** 拟合出的 19 权重（首版只填前 8 个，其余为 DEFAULT_W） */
  w: number[];
  /** 拟合时间戳 ISO */
  fitAt: string;
  /** 参与拟合的样本数 */
  fitCount: number;
  /** 全参(true)还是子集(false)拟合 */
  full: boolean;
}


export function getReviewFitFilePath(): string {
  const s = tryGetSettings() as any;
  return storageFile('review-fit.json', (s && s.storagePath) || 'CONFIG/STORAGE');
}

export async function loadFittedParams(app: App): Promise<FittedParams | null> {
  const data = (await jsonFileStore<any>(getReviewFitFilePath()).read()) as any;
  if (!data || !Array.isArray(data.w) || data.w.length < 8) return null;
  return data as FittedParams;
}

export async function saveFittedParams(app: App, fit: FittedParams): Promise<void> {
  // D3 原语 1 收编：review-fit.json 拟合写同样入 per-path 串行队列（与 loadFittedParams 读竞态无关，防多端/多入口并发拟合写互踩）
  await enqueueFileTask(getReviewFitFilePath(), () => jsonFileStore<FittedParams>(getReviewFitFilePath()).write(fit));
}
