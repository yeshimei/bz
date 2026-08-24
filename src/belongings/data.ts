/**
 * 归物本数据层（归物本.js loadDatabase/saveDatabase/工具函数 逐字移植）
 * 数据：CONFIG/STORAGE/belongings.json（dataFolder 可配置）
 * 默认分类 1226 条来自 default-categories.gen.ts（源码逐字提取）
 */
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { getSettings } from '../core/settings-provider';
import { DEFAULT_CATEGORIES } from './default-categories.gen';
import type { BelongingsDatabase } from './types';

/** 数据文件路径（ADR-0009：storagePath 优先，旧 dataFolder 兼容兜底） */
export function getDataFilePath(): string {
  const s = getSettings() as any;
  const folder = ((s.storagePath || s.belongingsDataFolder) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${folder}/belongings.json`;
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

/** 加载数据库（解析失败 → 警告弹窗 + 重置；含默认/自定义分类合并） */
export async function loadDatabase(): Promise<BelongingsDatabase> {
  const app = getApp();
  const DATA_FILE = getDataFilePath();
  let db: Partial<BelongingsDatabase> = {};
  const file = app.vault.getAbstractFileByPath(DATA_FILE);

  if (file) {
    try {
      const content = await app.vault.read(file as any);
      const parsed = JSON.parse(content);
      // P2 形状容错：解析结果须为非空对象，否则走既有失败 notice 路径（不再 TypeError 白屏）
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
        throw new Error('数据文件结构异常（非对象或空对象）');
      }
      db = parsed;
    } catch (error) {
      notice('数据文件解析失败，已重置为空', 'warning', 5000);
      console.error('数据文件解析错误:', error);
      db = emptyDatabase();
    }
  } else {
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
  const app = getApp();
  const saveData = {
    version: database.version,
    last_updated: new Date().toISOString(),
    items: database.items,
  };
  const content = JSON.stringify(saveData, null, 2);
  const file = app.vault.getAbstractFileByPath(getDataFilePath());
  if (file) {
    await app.vault.modify(file as any, content);
  } else {
    await app.vault.create(getDataFilePath(), content);
  }
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
