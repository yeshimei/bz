/**
 * 归物本数据层（归物本.js loadDatabase/saveDatabase/工具函数 逐字移植）
 * 数据：CONFIG/STORAGE/belongings.json（dataFolder 可配置）
 * 默认分类 1226 条来自 default-categories.gen.ts（源码逐字提取）
 */
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { getSettings } from '../core/settings-provider';
import { jsonFileStore, storageFile } from '../core/storage';
import { DEFAULT_CATEGORIES } from './default-categories.gen';
import type { BelongingsDatabase } from './types';

/** 数据文件路径（ADR-0009：storagePath 优先，旧 dataFolder 兼容兜底） */
export function getDataFilePath(): string {
  const s = getSettings() as any;
  return storageFile('belongings.json', (s.storagePath || s.belongingsDataFolder) || 'CONFIG/STORAGE');
}

/** 空数据库结构 */
function emptyDatabase(): BelongingsDatabase {
  return {
    version: '1.0',
    last_updated: new Date().toISOString(),
    items: {},
    categories: [],
    categoryIcons: {},
  };
}

/** 加载数据库（统一数据读写层语义：缺失建空库文件、损坏改名留档重建；notice 文案逐字保留——铁律 1） */
export async function loadDatabase(): Promise<BelongingsDatabase> {
  const filePath = getDataFilePath();
  const raw = await jsonFileStore<any>(filePath, {
    defaultValue: () => emptyDatabase(),
    onCorrupt: () => {
      notice('数据文件解析失败，已重置为空', 'warning', 5000);
    },
  }).read();
  let db: BelongingsDatabase;
  try {
    // P2 形状容错：非对象/空对象/数组 → 走既有失败 notice 路径（不再 TypeError 白屏）
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length === 0) {
      throw new Error('数据文件结构异常（非对象或空对象）');
    }
    db = raw as BelongingsDatabase;
  } catch (error) {
    notice('数据文件解析失败，已重置为空', 'warning', 5000);
    console.error('数据文件解析错误:', error);
    db = emptyDatabase();
  }

  // ----- 分类固定使用内置默认（自定义分类设置已移除）-----
  const uniqueCategories = [...new Set(DEFAULT_CATEGORIES)];

  (db as BelongingsDatabase).categories = uniqueCategories;

  // 生成 categoryIcons
  (db as BelongingsDatabase).categoryIcons = {};
  (db as BelongingsDatabase).categories.forEach((cat) => {
    const icon = cat.split(' ')[0];
    (db as BelongingsDatabase).categoryIcons[cat] = icon;
  });

  if (!db.items) db.items = {};
  return db as BelongingsDatabase;
}

/** 保存数据库 */
export async function saveDatabase(database: BelongingsDatabase): Promise<void> {
  const saveData = {
    version: database.version,
    last_updated: new Date().toISOString(),
    items: database.items,
  };
  await jsonFileStore<any>(getDataFilePath()).write(saveData);
}

// ----- 工具函数（复用） -----

export function calculateDailyCost(price: number, purchaseDate: string): string {
  const purchase = new Date(purchaseDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - purchase.getTime());
  const diffDays = Math.ceil(diffTime / 86400000);
  // P2 形状容错：无效日期（NaN）与当天购买同走全价，不产出 "NaN"
  if (!(diffDays > 0)) return price.toFixed(2);
  const dailyCost = price / diffDays;
  return dailyCost < 0.01 ? dailyCost.toFixed(4) : dailyCost.toFixed(2);
}

export function calculateDaysUsed(purchaseDate: string): number {
  const purchase = new Date(purchaseDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - purchase.getTime());
  // P2 形状容错：无效日期按 0 天，不产出 NaN
  if (!isFinite(diffTime)) return 0;
  return Math.ceil(diffTime / 86400000);
}
