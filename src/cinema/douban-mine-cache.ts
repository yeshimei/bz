/**
 * 影院：豆瓣「我账号的」三份名单本地缓存（2026-10-31 拍板）。
 *
 * 为什么要缓存：三份名单要翻十几到几十页（实测 408 部看过 = 28 页），每次开弹层重抓
 * 既慢又反复踩豆瓣限流。抓完落盘一次，之后开层直接读缓存即时出清单；用户要最新数据
 * 再点「重新导入」（只在缓存态出现）。
 *
 * 存的是**豆瓣原始清单**（片名 / 星级 / 标记日期 / 所属状态），不是影院条目——它只用来
 * 给导入弹层做勾选，与影院建档数据是两回事，删了不影响已导入的影片。
 */
import type { App } from 'obsidian';
import { jsonFileStore, storageFile } from '../core/storage';

/** 缓存行：与导入弹层 MineRow 同形状（inLib / sel 是运行时态，不落盘） */
export interface DoubanMineCacheRow {
  sid: string;
  name: string;
  stars: number | null;
  at: string | null;
  group: 'want' | 'doing' | 'watched';
}

export interface DoubanMineCache {
  /** 抓取时刻（ISO），用于界面提示「这份清单是什么时候抓的」 */
  at: string;
  rows: DoubanMineCacheRow[];
}

const CACHE_FILE = 'cinema-douban-mine.json';

/** 缓存文件路径（数据目录单源 core/storage 的 storageFile） */
export function doubanMineCachePath(): string {
  return storageFile(CACHE_FILE);
}

function store(app: App) {
  return jsonFileStore<DoubanMineCache>(doubanMineCachePath(), {
    defaultValue: () => ({ at: '', rows: [] }),
    app,
  });
}

/** 读缓存；没有/空/形状不对 → null（形状不对不能当空清单用，否则会把用户的清单当「0 部」） */
export async function readDoubanMineCache(app: App): Promise<DoubanMineCache | null> {
  try {
    const data = await store(app).read();
    if (!data || !Array.isArray(data.rows) || !data.rows.length) return null;
    const rows = data.rows.filter((r) => r && typeof r.sid === 'string' && typeof r.name === 'string'
      && (r.group === 'want' || r.group === 'doing' || r.group === 'watched'));
    if (!rows.length) return null;
    return { at: typeof data.at === 'string' ? data.at : '', rows };
  } catch {
    return null;
  }
}

/** 写缓存（抓完即写；写失败不打断导入流程，下次照样重抓） */
export async function writeDoubanMineCache(app: App, rows: DoubanMineCacheRow[]): Promise<void> {
  try {
    await store(app).write({ at: new Date().toISOString(), rows });
  } catch (e) {
    console.error('bz 影院：豆瓣清单缓存写入失败（不影响本次导入）', e);
  }
}
