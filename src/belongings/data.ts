/**
 * 归物本数据层（归物本.js loadDatabase/saveDatabase/工具函数 逐字移植）
 * 数据：CONFIG/STORAGE/belongings.json（dataFolder 可配置）
 * 默认分类 1226 条来自 default-categories.gen.ts（源码逐字提取）
 */
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { getSettings } from '../core/settings-provider';
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import moment from 'moment';
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
    // P2 形状容错：非对象/数组 → 走既有失败 notice 路径（不再 TypeError 白屏）；
    // 合法空对象 {}（文件被手动清空等）视为空库，不告警
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('数据文件结构异常（非对象）');
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

/**
 * 保存数据库（D2 可靠写契约原语 1 收编）：写盘入 core per-path 串行队列（键 =
 * belongings.json 路径）——并发保存按序落盘，杜绝交错写导致的半截/覆盖竞态；
 * 坏文件由 jsonFileStore 留档降级（原语 3）。数据形状与 API 不变。
 */
export async function saveDatabase(database: BelongingsDatabase): Promise<void> {
  const saveData = {
    version: database.version,
    last_updated: new Date().toISOString(),
    items: database.items,
  };
  await enqueueFileTask(getDataFilePath(), () => jsonFileStore<any>(getDataFilePath()).write(saveData));
}

// ----- 工具函数（复用） -----

/** 已用天数（本地日历日口径，对照 todo/due 的 moment 用法）：
 *  购买日与今天按本地时区取自然日相减；当天/无效日期 = 0 天（全价）。
 *  原 new Date('YYYY-MM-DD') 按 UTC 解析，UTC+8 早 8 点前会多算一天。 */
export function calculateDaysUsed(purchaseDate: string): number {
  const purchase = moment(String(purchaseDate || '').slice(0, 10), 'YYYY-MM-DD');
  if (!purchase.isValid()) return 0;
  const days = moment().startOf('day').diff(purchase.startOf('day'), 'days');
  return days > 0 ? days : 0;
}

/** 已用天数封口版（ticket 189，ADR-0089 出离闭环）：endDate 缺省 = 截至今天（同 calculateDaysUsed）；
 *  出离条目传 exit_date 把陪伴天数封在出离日（不再随时间增长）。
 *  endDate 无效回落今天口径；早于购买日（脏数据）= 0 天。 */
export function calculateDaysUsedUntil(purchaseDate: string, endDate?: string | null): number {
  if (!endDate) return calculateDaysUsed(purchaseDate);
  const purchase = moment(String(purchaseDate || '').slice(0, 10), 'YYYY-MM-DD');
  if (!purchase.isValid()) return 0;
  const end = moment(String(endDate).slice(0, 10), 'YYYY-MM-DD');
  if (!end.isValid()) return calculateDaysUsed(purchaseDate);
  const days = end.startOf('day').diff(purchase.startOf('day'), 'days');
  return days > 0 ? days : 0;
}

export function calculateDailyCost(price: number, purchaseDate: string): string {
  const diffDays = calculateDaysUsed(purchaseDate);
  // 当天/无效日期（0 天）同走全价，不产出 "NaN"
  if (!(diffDays > 0)) return price.toFixed(2);
  const dailyCost = price / diffDays;
  return dailyCost < 0.01 ? dailyCost.toFixed(4) : dailyCost.toFixed(2);
}
