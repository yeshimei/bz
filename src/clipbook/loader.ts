/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：装载器（news.json + 侧写 + 剪藏目录）。
 *
 * 语义（对齐旧 news/reader.ts loadAll + clipping loadAllArticles）：
 * - news.json 读取：缺失（首用引导）/损坏（错误态）/正常；保留策略清理（未读不处理、
 *   saved N 天删、skipped M 天删，起算 fetchedAt/date）后写回；旧 news-stats.json 迁移；
 * - clipbook.json 侧写读取；
 * - 剪藏目录扫描（目录不存在 → null 区分空态）。
 */
import { readNewsData, writeNewsData, migrateLegacyStats, applyRetention, normalizeRetentionDays, statsHasData } from '../news/data';
import { readClipbookData } from './data';
import { scanClipDirectory, type ClipNote } from './scan';
import { clipUrlSet } from './store';
import { tryGetSettings } from '../core/settings-provider';
import { getApp } from '../core/app';
import { M } from './state';

export interface PanelData {
  /** news.json 读取结果分类：ok / missing（首用）/ corrupt（损坏） */
  status: 'ok' | 'missing' | 'corrupt';
  articles: any[];
  sidecar: ReturnType<typeof readClipbookData> extends Promise<infer T> ? T : never;
  clipNotes: ClipNote[] | null;
  clipUrls: Set<string>;
  upInfo: Record<string, { name?: string; avatar?: string }>;
}

/** 剪藏目录（读设置，去尾斜杠） */
export function clipDir(): string {
  const s = tryGetSettings() as any;
  return ((s && s.articleDirectory) || '归档/网页剪藏').replace(/\/+$/, '');
}

/** 整盘装载（news 保留清理 + 迁移 + 侧写 + 剪藏扫描）→ 结果写入 M */
export async function readNewsAndSidecar(): Promise<PanelData> {
  const res = await readNewsData();

  if (res.missing) {
    M.articles = [];
    M.clipNotes = null;
    M.clipUrls = new Set();
    M.sidecar = { articleOverrides: {}, savedArchive: [], order: [] };
    M.upInfo = {};
    return { status: 'missing', articles: [], sidecar: M.sidecar, clipNotes: null, clipUrls: M.clipUrls, upInfo: {} };
  }
  if (!res.ok) {
    M.articles = [];
    M.clipNotes = null;
    M.clipUrls = new Set();
    M.sidecar = { articleOverrides: {}, savedArchive: [], order: [] };
    M.upInfo = {};
    return { status: 'corrupt', articles: [], sidecar: M.sidecar, clipNotes: null, clipUrls: M.clipUrls, upInfo: {} };
  }

  // 保留策略清理（插件侧，打开时执行一次）
  const s = tryGetSettings() as any;
  const savedDays = normalizeRetentionDays(s?.newsRetentionSavedDays) ?? 3;
  const skippedDays = normalizeRetentionDays(s?.newsRetentionSkippedDays) ?? 7;
  let data = res.data;
  const cleaned = applyRetention(data.articles, savedDays, skippedDays);
  let changed = cleaned.length !== data.articles.length;
  if (changed) data = { ...data, articles: cleaned };
  // 旧 stats 迁移（stats 段无真实数据时并入旧 news-stats.json 一次）
  if (!statsHasData(data.stats)) {
    const migrated = await migrateLegacyStats(data);
    if (statsHasData(migrated.stats)) {
      data = migrated;
      changed = true;
    }
  }
  if (changed) await writeNewsData(data);

  // 侧写
  const sidecar = await readClipbookData();
  // 剪藏目录扫描
  const clipNotes = await scanClipDirectory(M.dir || clipDir(), {
    vault: getApp().vault,
  });
  const clipUrls = clipUrlSet(clipNotes || []);

  M.articles = data.articles;
  M.sidecar = sidecar;
  M.clipNotes = clipNotes;
  M.clipUrls = clipUrls;
  M.upInfo = data.bilibiliUpInfo || {};
  return { status: 'ok', articles: data.articles, sidecar, clipNotes, clipUrls, upInfo: M.upInfo };
}
