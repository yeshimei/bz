/**
 * 剪藏本设置「数据源」组的数据操作（ticket 124，ADR-0060）：
 * 检测 news.json 存在性、读/写 sources 开关与 bilibiliUps 名单、最近抓取时间。
 * 纯数据层（无 DOM），供 src/clipping/view.ts 设置弹窗调用。
 */
import { readNewsData, writeNewsData, NEWS_JSON_PATH, type BilibiliUpInfo } from './data';

export interface DataSourceState {
  /** news.json 是否存在（news-watcher 库存在的检测信号） */
  exists: boolean;
  sources: { zhihu: boolean; guokr: boolean; bilibili: boolean };
  bilibiliUps: string[];
  /** UP 主资料（后台抓到消息后回填；缺失时 UI 回退显示 uid） */
  bilibiliUpInfo: Record<string, BilibiliUpInfo>;
  /** 最近抓取时间（articles 最新 fetchedAt；无文章返回 null） */
  lastFetchAt: string | null;
  totalArticles: number;
}

/** 读数据源状态（检测 + sources + 名单 + UP 资料 + 最近抓取时间） */
export async function readDataSourceState(): Promise<DataSourceState> {
  const res = await readNewsData();
  if (res.missing) {
    return { exists: false, sources: { zhihu: true, guokr: true, bilibili: true }, bilibiliUps: [], bilibiliUpInfo: {}, lastFetchAt: null, totalArticles: 0 };
  }
  if (!res.ok) {
    return { exists: true, sources: { zhihu: true, guokr: true, bilibili: true }, bilibiliUps: [], bilibiliUpInfo: {}, lastFetchAt: null, totalArticles: 0 };
  }
  let lastFetchAt: string | null = null;
  for (const a of res.data.articles) {
    if (a && a.fetchedAt && (!lastFetchAt || String(a.fetchedAt) > lastFetchAt)) lastFetchAt = String(a.fetchedAt);
  }
  return {
    exists: true,
    sources: { ...res.data.sources },
    bilibiliUps: [...res.data.bilibiliUps],
    bilibiliUpInfo: { ...res.data.bilibiliUpInfo },
    lastFetchAt,
    totalArticles: res.data.articles.length,
  };
}

/** 写 sources 开关（读盘 → 替换 sources 段 → 写回，保留其它段）；文件缺失时先落默认骨架 */
export async function writeSources(sources: { zhihu: boolean; guokr: boolean; bilibili: boolean }): Promise<void> {
  const res = await readNewsData();
  if (res.missing) {
    await writeNewsData({ articles: [], stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} }, bilibiliUps: [], bilibiliUpInfo: {}, sources: { ...sources } });
    return;
  }
  if (!res.ok) return;
  await writeNewsData({ ...res.data, sources: { ...sources } });
}

/** 添加 UP 主 uid（去重；同时保留其它段） */
export async function addBilibiliUp(uid: string): Promise<boolean> {
  const id = String(uid || '').trim();
  if (!id) return false;
  const res = await readNewsData();
  if (res.missing) {
    await writeNewsData({ articles: [], stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} }, bilibiliUps: [id], bilibiliUpInfo: {}, sources: { zhihu: true, guokr: true, bilibili: true } });
    return true;
  }
  if (!res.ok) return false;
  if (res.data.bilibiliUps.includes(id)) return false; // 已存在
  await writeNewsData({ ...res.data, bilibiliUps: [...res.data.bilibiliUps, id] });
  return true;
}

/** 删除 UP 主 uid（连同其资料条目，保留其它段） */
export async function removeBilibiliUp(uid: string): Promise<void> {
  const res = await readNewsData();
  if (!res.ok || res.missing) return;
  const info = { ...res.data.bilibiliUpInfo };
  delete info[uid];
  await writeNewsData({ ...res.data, bilibiliUps: res.data.bilibiliUps.filter((u) => u !== uid), bilibiliUpInfo: info });
}