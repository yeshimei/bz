/**
 * 剪藏本设置「数据源」组的数据操作（ticket 124，ADR-0060；自旧 news 域迁入 clipbook，ADR-0086）：
 * 检测 news.json 存在性、读/写 sources 开关与 bilibiliUps 名单、最近抓取时间。
 * 纯数据层（无 DOM），供 src/clipbook/news-sources-group.ts 设置组调用。
 */
import { readNewsData, writeNewsDataMerged, DEFAULT_SOURCES, type BilibiliUpInfo } from './news-data';
import { enqueueNewsWrite } from './write-queue';

export interface DataSourceState {
  /** news.json 是否存在（news-watcher 库存在的检测信号） */
  exists: boolean;
  sources: { zhihu: boolean; guokr: boolean; bilibili: boolean };
  bilibiliUps: string[];
  /** UP 主资料（后台抓到消息后回填；缺失时 UI 回退显示 uid） */
  bilibiliUpInfo: Record<string, BilibiliUpInfo>;
  /** B 站每 UP 抓取条数（ticket 127：最近 N 条，默认 10） */
  bilibiliMaxItems: number;
  /** 用户配置的 B 站 Cookie（ticket 127：API 风控 412 时使用；缺省空串走自动引导） */
  bilibiliCookie: string;
  /** 最近抓取时间（articles 最新 fetchedAt；无文章返回 null） */
  lastFetchAt: string | null;
  totalArticles: number;
  /** 每日简报名单（ADR-0119：news.json briefUps 段，独立于 bilibiliUps） */
  briefUps: string[];
  /** 简报条目数（列表计数用） */
  totalBriefs: number;
}

/** 空数据源状态（news.json 缺失/损坏时的回退值；schema 构建与测试共用） */
export function emptyDataSourceState(exists = false): DataSourceState {
  return { exists, sources: { ...DEFAULT_SOURCES }, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', lastFetchAt: null, totalArticles: 0, briefUps: [], totalBriefs: 0 };
}

/** 读数据源状态（检测 + sources + 名单 + UP 资料 + B站配置 + 最近抓取时间） */
export async function readDataSourceState(): Promise<DataSourceState> {
  const res = await readNewsData();
  if (res.missing) {
    return emptyDataSourceState(false);
  }
  if (!res.ok) {
    return emptyDataSourceState(true);
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
    bilibiliMaxItems: res.data.bilibiliMaxItems,
    bilibiliCookie: res.data.bilibiliCookie,
    lastFetchAt,
    totalArticles: res.data.articles.length,
    briefUps: [...(res.data.briefUps || [])],
    totalBriefs: (res.data.briefs || []).length,
  };
}

/** 写 sources 开关（串行队列 + 段级合并：只声明 sources 段，其余段取磁盘现值）；缺失时合并写落默认骨架 */
export async function writeSources(sources: { zhihu: boolean; guokr: boolean; bilibili: boolean }): Promise<void> {
  await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return;
    await writeNewsDataMerged({ set: { sources: { ...sources } } });
  });
}

/** 添加 UP 主 uid（去重；串行队列 + 段级合并只声明 bilibiliUps 段） */
export async function addBilibiliUp(uid: string): Promise<boolean> {
  const id = String(uid || '').trim();
  if (!id) return false;
  return enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return false;
    if (res.data.bilibiliUps.includes(id)) return false; // 已存在
    await writeNewsDataMerged({ set: { bilibiliUps: [...res.data.bilibiliUps, id] } });
    return true;
  });
}

/** 写 B 站每 UP 抓取条数（ticket 127；默认 10，夹取 1..50，非法回退 10；串行队列 + 段级合并） */
export async function writeBilibiliMaxItems(v: string | number): Promise<void> {
  const n = Math.floor(Number(v));
  const maxItems = Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : 10;
  await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return;
    await writeNewsDataMerged({ set: { bilibiliMaxItems: maxItems } });
  });
}

/** 写 B 站 Cookie（ticket 127；空串=清除，回到自动引导；串行队列 + 段级合并） */
export async function writeBilibiliCookie(cookie: string): Promise<void> {
  const c = String(cookie || '').trim();
  await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return;
    await writeNewsDataMerged({ set: { bilibiliCookie: c } });
  });
}

// ===== 每日简报名单（ADR-0119：briefUps 段，与 bilibiliUps 互斥）=====

/**
 * 添加每日简报名单 uid。互斥（ADR-0119 §8）：同一 UP 不同时出现在两个名单——
 * 加入简报名单时自动从 bilibiliUps 移除（同一视频不在「B站源」与「每日简报」两处重复出现）。
 * 返回是否新增（已存在 → false）。
 */
export async function addBriefUp(uid: string): Promise<boolean> {
  const id = String(uid || '').trim();
  if (!id) return false;
  return enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return false;
    if ((res.data.briefUps || []).includes(id)) return false;
    const set: any = { briefUps: [...(res.data.briefUps || []), id] };
    if (res.data.bilibiliUps.includes(id)) set.bilibiliUps = res.data.bilibiliUps.filter((u) => u !== id);
    await writeNewsDataMerged({ set });
    return true;
  });
}

/** 移除每日简报名单 uid（只动 briefUps 段；已产出的简报条目保留，由保留策略自然回收） */
export async function removeBriefUp(uid: string): Promise<void> {
  const id = String(uid || '').trim();
  if (!id) return;
  await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok || res.missing) return;
    await writeNewsDataMerged({ set: { briefUps: (res.data.briefUps || []).filter((u) => u !== id) } });
  });
}

/** 删除 UP 主 uid（连同其资料条目；串行队列 + 段级合并声明 bilibiliUps/bilibiliUpInfo 两段） */
export async function removeBilibiliUp(uid: string): Promise<void> {
  await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok || res.missing) return;
    const info = { ...res.data.bilibiliUpInfo };
    delete info[uid];
    await writeNewsDataMerged({
      set: { bilibiliUps: res.data.bilibiliUps.filter((u) => u !== uid), bilibiliUpInfo: info },
    });
  });
}