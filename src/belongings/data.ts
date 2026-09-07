/**
 * 归物本数据层（归物本.js loadDatabase/saveDatabase/工具函数 逐字移植）
 * 数据：CONFIG/STORAGE/belongings.json（dataFolder 可配置）
 * 历史分类派生 + emoji 分类迁移（issue 231/ADR-0102：内置预设 1226 条退役）
 */
import { notice } from '../core/notice';
import { getSettings } from '../core/settings-provider';
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import { splitEmojiCategory } from './emoji-icon-map';
import type { BelongingsDatabase } from './types';

/** 数据文件路径（ADR-0009：storagePath 优先，旧 dataFolder 兼容兜底） */
export function getDataFilePath(): string {
  const s = getSettings() as any;
  return storageFile('belongings.json', s.storagePath || 'CONFIG/STORAGE');
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

/** 加载数据库（统一数据读写层语义：缺失建空库文件、损坏改名留档重建；解析失败走 core 默认通知——含留档路径与「数据不会丢」承诺） */
export async function loadDatabase(): Promise<BelongingsDatabase> {
  const filePath = getDataFilePath();
  const raw = await jsonFileStore<any>(filePath, {
    defaultValue: () => emptyDatabase(),
  }).read();
  let db: BelongingsDatabase;
  try {
    // P2 形状容错：非对象/数组 → 结构异常提示（不再 TypeError 白屏）；
    // 合法空对象 {}（文件被手动清空等）视为空库，不告警
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('数据文件结构异常（非对象）');
    }
    db = raw as BelongingsDatabase;
  } catch (error) {
    notice('数据文件结构异常，已按空库继续，原文件未改动', 'warning', 5000);
    console.error('数据文件结构异常:', error);
    db = emptyDatabase();
  }

  if (!db.items) db.items = {};

  // ----- 迁移（issue 231/ADR-0102）：emoji 前缀分类 → 纯文字分类 + icon 字段 -----
  // 内存迁移、幂等（无 emoji 前缀即跳过）；icon 只在未设时由映射表补，已有值不覆写；
  // 落盘随下一次自然保存发生，不在读取路径写盘
  for (const it of Object.values(db.items)) {
    if (!it || typeof it !== 'object') continue;
    const split = splitEmojiCategory(it.category);
    if (!split.emoji) continue;
    it.category = split.name;
    if (split.icon && (it.icon == null || it.icon === '')) it.icon = split.icon;
  }

  // ----- 历史分类派生（issue 231：内置预设退役，联想 = 自己的历史分类）-----
  // categories = 去重历史（频次降序 → 最近更新降序）；categoryIcons = 分类 → 馆内首个已设图标
  const freq = new Map<string, { n: number; last: string }>();
  const icons: Record<string, string> = {};
  for (const it of Object.values(db.items)) {
    if (!it || typeof it !== 'object') continue;
    const cat = String(it.category || '').trim();
    if (!cat) continue;
    const cur = freq.get(cat) || { n: 0, last: '' };
    cur.n += 1;
    cur.last = String(it.last_updated || '');
    freq.set(cat, cur);
    if (it.icon && !icons[cat]) icons[cat] = it.icon;
  }
  (db as BelongingsDatabase).categories = [...freq.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last))
    .map(([c]) => c);
  (db as BelongingsDatabase).categoryIcons = icons;
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
