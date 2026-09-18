/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：装载器（news.json + 侧写 + 剪藏目录）。
 *
 * 语义（对齐旧 news/reader.ts loadAll + clipping loadAllArticles）：
 * - news.json 读取：缺失（首用引导）/损坏（错误态）/正常；保留策略清理（未读不处理、
 *   saved N 天删、skipped M 天删，起算 fetchedAt/date）后写回；旧 news-stats.json 迁移；
 * - clipbook.json 侧写读取；
 * - 剪藏目录扫描（目录不存在 → null 区分空态）。
 */
import { readNewsData, writeNewsDataMerged, migrateLegacyStats, applyRetention, normalizeRetentionDays, statsHasData, type NewsWriteIntent } from './news-data';
import { readClipbookData, emptySidecar } from './data';
import { clearArticleTracking } from './anchor';
import { scanClipDirectory, type ClipNote } from './scan';
import { clipUrlSet } from './store';
import { articleKeyOf } from './constants';
import { tryGetSettings } from '../core/settings-provider';
import { getApp } from '../core/app';
import { M } from './state';
import { enqueueNewsWrite } from './write-queue';

export interface PanelData {
  /** news.json 读取结果分类：ok / missing（首用）/ corrupt（损坏） */
  status: 'ok' | 'missing' | 'corrupt';
  articles: any[];
  sidecar: ReturnType<typeof readClipbookData> extends Promise<infer T> ? T : never;
  clipNotes: ClipNote[] | null;
  clipUrls: Set<string>;
  upInfo: Record<string, { name?: string; avatar?: string }>;
}

// 剪藏目录：域内单源在 save.clipDir（尾斜杠归一 + 缺省串一处，CB4/A3），此处转发保旧导出位
import { clipDir } from './save';
export { clipDir };

/** 整盘装载（news 保留清理 + 迁移 + 侧写 + 剪藏扫描）→ 结果写入 M */
export async function readNewsAndSidecar(): Promise<PanelData> {
  const res = await readNewsData();

  if (res.missing) {
    M.articles = [];
    M.clipNotes = null;
    M.clipUrls = new Set();
    M.sidecar = emptySidecar();
    M.upInfo = {};
    return { status: 'missing', articles: [], sidecar: M.sidecar, clipNotes: null, clipUrls: M.clipUrls, upInfo: {} };
  }
  if (!res.ok) {
    M.articles = [];
    M.clipNotes = null;
    M.clipUrls = new Set();
    M.sidecar = emptySidecar();
    M.upInfo = {};
    return { status: 'corrupt', articles: [], sidecar: M.sidecar, clipNotes: null, clipUrls: M.clipUrls, upInfo: {} };
  }

  // 保留策略清理（插件侧，打开时执行一次）
  const s = tryGetSettings() as any;
  // issue 224：保留天数两键合一（未保存文章保留天数，默认 30；已保存/已跳过骨架同口径）
  const days = normalizeRetentionDays(s?.newsRetentionUnsavedDays) ?? 30;
  let data = res.data;
  const cleaned = applyRetention(data.articles, days, days);
  const retentionChanged = cleaned.length !== data.articles.length;
  // F1：被清理的超期条目收进 removeArticleKeys——合并写 articles 段按磁盘并集，
  // 不声明删除意图时清理条目会被磁盘旧值复活（news.json 只增不减、retentionChanged 恒真反复空写）
  let removedKeys: string[] = [];
  if (retentionChanged) {
    const kept = new Set(cleaned.map((a: any) => articleKeyOf(a)));
    removedKeys = (data.articles || []).map((a: any) => articleKeyOf(a)).filter((k: string) => !kept.has(k));
    data = { ...data, articles: cleaned };
    // 被清理条目的侧写三段（marks/savedImages/pendingSource）一并清掉，不随清理永久残留（issue 333 评审）
    for (const k of removedKeys) void clearArticleTracking(k).catch(() => { /* 残留无害，不阻断装载 */ });
  }
  // 旧 stats 迁移（stats 段无真实数据时并入旧 news-stats.json 一次）
  let statsChanged = false;
  if (!statsHasData(data.stats)) {
    const migrated = await migrateLegacyStats(data);
    if (statsHasData(migrated.stats)) {
      data = migrated;
      statsChanged = true;
    }
  }
  // F：清理/迁移写回走共享串行队列 + 段级合并（只声明实际改动的段，daemon 在
  // 读-写窗口内追加的文章不被旧快照覆盖）
  if (retentionChanged || statsChanged) {
    const set: NewsWriteIntent['set'] = {};
    if (retentionChanged) set.articles = data.articles;
    if (statsChanged) set.stats = data.stats;
    await enqueueNewsWrite(() => writeNewsDataMerged({ set, removeArticleKeys: removedKeys }));
  }

  // 侧写
  const sidecar = await readClipbookData();
  // 剪藏目录扫描（C12：每次直读 clipDir() 实时值——原 M.dir 缓存只在 initPanel 与域内设置
  // 弹窗 onClose 赋值，设置面板域改「剪藏文件夹」后扫描仍扫旧目录，读写路径不对称）
  const clipNotes = await scanClipDirectory(clipDir(), {
    vault: getApp().vault,
  });
  // 效率#2：被契约拒收的剪藏不再凭空蒸发——每次装载 warn 一次（含路径清单，控制台可定位；
  // 面板内可视化呈现留给 UI 侧接线）
  if (clipNotes && clipNotes.rejected > 0) {
    console.warn(`[剪藏本] 剪藏目录有 ${clipNotes.rejected} 篇无法识别（缺 url/created frontmatter）`, clipNotes.rejectedPaths);
  }
  const clipUrls = clipUrlSet(clipNotes || []);

  M.articles = data.articles;
  M.stats = data.stats;
  M.sidecar = sidecar;
  M.clipNotes = clipNotes;
  M.clipUrls = clipUrls;
  M.upInfo = data.bilibiliUpInfo || {};
  return { status: 'ok', articles: data.articles, sidecar, clipNotes, clipUrls, upInfo: M.upInfo };
}
