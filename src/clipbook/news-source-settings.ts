/**
 * 剪藏本设置「数据源」组的数据操作（ticket 124，ADR-0060；自旧 news 域迁入 clipbook，ADR-0086）：
 * 检测 news.json 存在性、读/写 sources 开关与 bilibiliUps 名单、最近抓取时间。
 * 纯数据层（无 DOM），供 src/clipbook/news-sources-group.ts 设置组调用。
 */
import { readNewsData, writeNewsDataMerged, remapRssFeedInstance, DEFAULT_SOURCES, normalizeRssFeedUrl, normalizeFetchIntervalMin, normalizeRsshubInstance, type BilibiliUpInfo, type RssFeed } from './news-data';
import { RSS_HUB_DEFAULT_INSTANCE } from '../core/rss-catalog';
import { enqueueNewsWrite } from './write-queue';
import { markPanelDirty } from './state';

export interface DataSourceState {
  /** news.json 是否存在（news-watcher 库存在的检测信号） */
  exists: boolean;
  sources: { zhihu: boolean; guokr: boolean; bilibili: boolean; rss: boolean };
  bilibiliUps: string[];
  /** UP 主资料（后台抓到消息后回填；缺失时 UI 回退显示 uid） */
  bilibiliUpInfo: Record<string, BilibiliUpInfo>;
  /** B 站每 UP 抓取条数（ticket 127：最近 N 条，默认 10） */
  bilibiliMaxItems: number;
  /** 用户配置的 B 站 Cookie（ticket 127：API 风控 412 时使用；缺省空串走自动引导） */
  bilibiliCookie: string;
  totalArticles: number;
  /** RSS 订阅列表（ADR-0121：news.json rssFeeds 段） */
  rssFeeds: RssFeed[];
  /** 最近抓取时间（epoch ms；issue 302 / ADR-0128 间隔判定锚点；0 = 从未抓取） */
  lastFetchAt: number;
  /** 抓取间隔档位（分钟，30/60/120/360） */
  fetchIntervalMin: number;
  /** RSSHub 实例地址（ADR-0209）：源库路由型条目订阅时按它重拼 URL */
  rsshubInstance: string;
}

/** 空数据源状态（news.json 缺失/损坏时的回退值；schema 构建与测试共用） */
export function emptyDataSourceState(exists = false): DataSourceState {
  return { exists, sources: { ...DEFAULT_SOURCES }, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '', totalArticles: 0, rssFeeds: [], lastFetchAt: 0, fetchIntervalMin: 30, rsshubInstance: RSS_HUB_DEFAULT_INSTANCE };
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
  return {
    exists: true,
    sources: { ...res.data.sources },
    bilibiliUps: [...res.data.bilibiliUps],
    bilibiliUpInfo: { ...res.data.bilibiliUpInfo },
    bilibiliMaxItems: res.data.bilibiliMaxItems,
    bilibiliCookie: res.data.bilibiliCookie,
    totalArticles: res.data.articles.length,
    rssFeeds: [...res.data.rssFeeds],
    lastFetchAt: res.data.lastFetchAt,
    fetchIntervalMin: res.data.fetchIntervalMin,
    rsshubInstance: res.data.rsshubInstance,
  };
}

/**
 * 增写结果（C4）：区分「已写入 / 已存在 / 入参非法 / 读盘失败」——
 * 旧布尔返回值把「已存在」与「读盘失败」混成同一个 false，调用方只能给误导文案。
 */
export type AddSourceOutcome = 'added' | 'exists' | 'invalid' | 'read-failed';

/**
 * 写 sources 开关（串行队列 + 段级合并：只声明 sources 段，其余段取磁盘现值）；缺失时合并写落默认骨架。
 * C4：返回是否落盘——news.json 损坏/读盘失败时写路径放弃落盘（F8 保护），调用方须据此提示，
 * 不再静默丢弃设置（字盒已改、磁盘未写、重开回弹且无任何告警）。
 */
export async function writeSources(sources: { zhihu: boolean; guokr: boolean; bilibili: boolean; rss: boolean }): Promise<boolean> {
  const ok = await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return false;
    return writeNewsDataMerged({ set: { sources: { ...sources } } });
  });
  if (ok) markPanelDirty();
  return ok;
}

/** 添加 UP 主 uid（去重；串行队列 + 段级合并只声明 bilibiliUps 段）。C4：结果区分四种语义 */
export async function addBilibiliUp(uid: string): Promise<AddSourceOutcome> {
  const id = String(uid || '').trim();
  if (!id) return 'invalid';
  const outcome = await enqueueNewsWrite(async (): Promise<AddSourceOutcome> => {
    const res = await readNewsData();
    if (!res.ok) return 'read-failed';
    if (res.data.bilibiliUps.includes(id)) return 'exists';
    if (!(await writeNewsDataMerged({ set: { bilibiliUps: [...res.data.bilibiliUps, id] } }))) return 'read-failed';
    return 'added';
  });
  if (outcome === 'added') markPanelDirty();
  return outcome;
}

/**
 * 回填单个 UP 主资料（name/avatar；串行队列 + 段级合并只声明 bilibiliUpInfo 段——该 uid
 * 既有键并入，其余 uid 与其余段取磁盘现值，不覆盖后台抓取刚写入的资料）。
 * C4：返回是否落盘（news.json 损坏/读盘失败 → false，调用方须提示）。
 */
export async function writeBilibiliUpInfo(uid: string, info: BilibiliUpInfo): Promise<boolean> {
  const id = String(uid || '').trim();
  if (!id) return false;
  const ok = await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return false;
    const prev = res.data.bilibiliUpInfo[id];
    return writeNewsDataMerged({ set: { bilibiliUpInfo: { ...res.data.bilibiliUpInfo, [id]: { ...prev, ...info } } } });
  });
  if (ok) markPanelDirty();
  return ok;
}

/** 写 B 站每 UP 抓取条数（ticket 127；默认 10，夹取 1..50，非法回退 10；串行队列 + 段级合并）。
 *  C4：返回是否落盘（news.json 损坏/读盘失败 → false，调用方须提示） */
export async function writeBilibiliMaxItems(v: string | number): Promise<boolean> {
  const n = Math.floor(Number(v));
  const maxItems = Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : 10;
  const ok = await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return false;
    return writeNewsDataMerged({ set: { bilibiliMaxItems: maxItems } });
  });
  if (ok) markPanelDirty();
  return ok;
}

/** 写 B 站 Cookie（ticket 127；空串=清除，回到自动引导；串行队列 + 段级合并）。
 *  C4：返回是否落盘（news.json 损坏/读盘失败 → false） */
export async function writeBilibiliCookie(cookie: string): Promise<boolean> {
  const c = String(cookie || '').trim();
  const ok = await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return false;
    return writeNewsDataMerged({ set: { bilibiliCookie: c } });
  });
  if (ok) markPanelDirty();
  return ok;
}

/** 写抓取间隔档位（issue 302 / ADR-0128；非法回退 30；串行队列 + 段级合并）。
 *  C4：返回是否落盘（news.json 损坏/读盘失败 → false，调用方须提示） */
export async function writeFetchInterval(v: string | number): Promise<boolean> {
  const n = normalizeFetchIntervalMin(v);
  const ok = await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return false;
    return writeNewsDataMerged({ set: { fetchIntervalMin: n } });
  });
  if (ok) markPanelDirty();
  return ok;
}

/** 写 RSSHub 实例地址的结果：ok = 是否落盘；remapped = 顺带重拼了几条路由型订阅 */
export interface RsshubInstanceWrite {
  ok: boolean;
  remapped: number;
}

/**
 * 写 RSSHub 实例地址（ADR-0209；归一去尾斜杠，非法/空回退默认实例；串行队列 + 段级合并）。
 * 订阅时地址已按旧实例拼死落盘，只改实例字段对存量订阅无效——这里同一次写里把 origin
 * 指向旧实例的订阅重拼到新实例（remapRssFeedInstance），否则用户换自建实例等于没换。
 * C4：返回是否落盘（news.json 损坏/读盘失败 → ok:false，调用方须提示）。
 */
export async function writeRsshubInstance(v: string): Promise<RsshubInstanceWrite> {
  const inst = normalizeRsshubInstance(v) ?? RSS_HUB_DEFAULT_INSTANCE;
  const r = await enqueueNewsWrite(async (): Promise<RsshubInstanceWrite> => {
    const res = await readNewsData();
    if (!res.ok) return { ok: false, remapped: 0 };
    const from = normalizeRsshubInstance(res.data.rsshubInstance) ?? RSS_HUB_DEFAULT_INSTANCE;
    const remap = remapRssFeedInstance(res.data.rssFeeds, from, inst);
    const ok = await writeNewsDataMerged({
      set: remap.changed > 0 ? { rsshubInstance: inst, rssFeeds: remap.feeds } : { rsshubInstance: inst },
    });
    return { ok, remapped: ok ? remap.changed : 0 };
  });
  if (r.ok) markPanelDirty();
  return r;
}

// ===== RSS 订阅列表（ADR-0121：rssFeeds 段）=====

/** 添加 RSS 订阅源（url 归一去重，title 可缺省由试拉/守护回填）。C4：结果区分四种语义 */
export async function addRssFeed(url: string, title?: string): Promise<AddSourceOutcome> {
  const u = normalizeRssFeedUrl(url);
  if (!u) return 'invalid';
  const t = String(title || '').trim();
  const outcome = await enqueueNewsWrite(async (): Promise<AddSourceOutcome> => {
    const res = await readNewsData();
    if (!res.ok) return 'read-failed';
    if (res.data.rssFeeds.some((f) => f.url === u)) return 'exists';
    const feed: RssFeed = t ? { url: u, title: t } : { url: u };
    if (!(await writeNewsDataMerged({ set: { rssFeeds: [...res.data.rssFeeds, feed] } }))) return 'read-failed';
    return 'added';
  });
  if (outcome === 'added') markPanelDirty();
  return outcome;
}

/** 移除 RSS 订阅源（按 url；串行队列 + 段级合并只声明 rssFeeds 段）。
 *  C4：返回是否落盘——旧实现读盘失败静默 no-op，调用方却已弹「已移除」假成功（重开复活） */
export async function removeRssFeed(url: string): Promise<boolean> {
  const u = String(url || '').trim();
  if (!u) return false;
  const ok = await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return false;
    return writeNewsDataMerged({ set: { rssFeeds: res.data.rssFeeds.filter((f) => f.url !== u) } });
  });
  if (ok) markPanelDirty();
  return ok;
}

/** 删除 UP 主 uid（连同其资料条目；串行队列 + 段级合并声明 bilibiliUps/bilibiliUpInfo 两段）。
 *  C4：返回是否落盘（同 removeRssFeed：假成功要消灭） */
export async function removeBilibiliUp(uid: string): Promise<boolean> {
  const ok = await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok) return false;
    const info = { ...res.data.bilibiliUpInfo };
    delete info[uid];
    return writeNewsDataMerged({
      set: { bilibiliUps: res.data.bilibiliUps.filter((u) => u !== uid), bilibiliUpInfo: info },
    });
  });
  if (ok) markPanelDirty();
  return ok;
}
