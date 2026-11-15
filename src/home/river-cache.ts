/**
 * 内容首页 · 活动河会话缓存（2026-11-15，用户报「首页每次打开都卡一小会儿」）。
 *
 * 病因：`ui.showOverlay()` 每次重开无条件 `collectRiver`——7 天回顾 / 12 个域 / 十几个计数
 * 加起来约 20 轮全库遍历，采完还要全量重建 5 个容器。issue 290 的「DOM 常驻秒显」收益被它吃光。
 *
 * 口径照 ADR-0170（日记墙）：
 * - 会话级、按 app 键控、在途去重、**不做跨会话持久缓存**、失败不缓存、刷新恒回源；
 * - 失效靠域事件（vault md 四通道 + 各域动作通道），**不自挂 app.vault.on**（ADR-0047 唯一订阅点）；
 * - 点前缀数据目录收不到 vault modify（ADR-0289），故额外加 5 分钟兜底与「跨天必回源」；
 * - 只填数据、不建 DOM、不写盘（home 域只读契约）。
 */
import type { App } from 'obsidian';
import type { RiverData } from './river';
import { collectRiver } from './river';
import { onDomainEvent } from '../core/domain-bus';
import { tryGetSettings } from '../core/settings-provider';

/** 兜底新鲜度：域事件漏发也不会长期显示旧数；跨天另算，不受本值影响 */
export const RIVER_CACHE_TTL_MS = 5 * 60 * 1000;

/** 首页数据一旦可能变化就置脏：笔记四通道恒发 + 各域动作事件 + 入口顺序/设置类通道 */
const INVALIDATE_CHANNELS = [
  'vault:md-created', 'vault:md-modified', 'vault:md-deleted', 'vault:md-renamed', 'vault:md-indexed',
  'memo', 'diary', 'review', 'favorites', 'belongings', 'pomodoro',
  'movie', 'cinema', 'gameshelf', 'knowledge:tasks', 'news', 'attach',
  'bookshelf', 'clipping', 'secondbrain', 'reader', 'home',
];

let cacheApp: App | null = null;
let cached: RiverData | null = null;
let inflight: Promise<RiverData> | null = null;
let cachedAt = 0;
let cachedKey = '';
let invalidated = false;
let detachers: Array<() => void> = [];
let prewarmed = false;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 本地日历日（与 river.dateStrOf 同口径，不用 UTC，否则跨天会更早/更晚一小时） */
function localDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 缓存键 = 日历日 + 首页设置快照。
 * 「时间范围」档变了，7 天回顾窗口就变了；其余时间线/预告设置变了，五区 HTML 也得重排。
 * 这条是给 `readHomeSettings()` 那句「每次开面板现读、刻意不缓存」兜底：设置一改，
 * 键变 → 回源 → 新对象 → UI 不认缓存命中，照常重建，用户在设置里改完立刻再开就生效。
 */
function snapshotKey(now: number): string {
  let s: Record<string, unknown> = {};
  try {
    s = (tryGetSettings() as Record<string, unknown>) ?? {};
  } catch {
    /* 设置没注入（测试 / 启动早期）：空快照与 collectRiver 的默认回落一致 */
  }
  const v = (k: string): string => String(s[k] ?? '');
  const keys = [
    v('homeTimelineRange'), v('homeTimelineProduce'), v('homeTimelineProgress'),
    v('homeTimelineNotes'), v('homeTimelineSize'), v('homeTimelineTime'),
    v('homeDefaultDay'), v('homeNextCards'),
  ];
  return `${localDay(now)}|${keys.join(',')}`;
}

function attachInvalidators(): void {
  if (detachers.length) return;
  for (const channel of INVALIDATE_CHANNELS) {
    detachers.push(onDomainEvent(channel, () => markDirty()));
  }
}

function detachInvalidators(): void {
  for (const off of detachers) off();
  detachers = [];
}

/** 外部数据变动作废：在途那一轮的结果也不许写缓存（下轮回源重取） */
function markDirty(): void {
  invalidated = true;
  cached = null;
  inflight = null;
}

/**
 * 主动要求回源（手动刷新 / keepHome 动作落地 / 重试）：清掉好数据，但**不置脏**——
 * 新采回来的这一轮就是新基线，可以正常写缓存。
 */
export function invalidateRiverCache(): void {
  cached = null;
  inflight = null;
}

/** 插件卸载 / 换库 / 测试逐例：缓存、订阅、预热旗标一起归零 */
export function resetRiverCache(): void {
  detachInvalidators();
  cacheApp = null;
  cached = null;
  inflight = null;
  cachedAt = 0;
  cachedKey = '';
  invalidated = false;
  prewarmed = false;
}

/** 这份缓存还新不新：同一 app、有好数据、没被置脏、没超兜底、日历日与时间范围档都没变 */
export function riverCacheFresh(app: App, now: number = Date.now()): boolean {
  return (
    cacheApp === app &&
    !!cached &&
    !invalidated &&
    now - cachedAt < RIVER_CACHE_TTL_MS &&
    snapshotKey(now) === cachedKey
  );
}

export interface RiverCacheOptions {
  /** 恒回源（刷新/动作落地/重试），不吃缓存也不写脏标记 */
  force?: boolean;
  /** 注入时钟：测试里验 TTL / 跨天；运行时留空取 Date.now() */
  now?: number;
}

/** 取活动河：命中缓存返回同一份对象引用（UI 据此判断「不必整屏重建」） */
export function loadRiverCached(app: App, opts: RiverCacheOptions = {}): Promise<RiverData> {
  const now = opts.now ?? Date.now();
  if (cacheApp !== app) {
    resetRiverCache();
    cacheApp = app;
  }
  attachInvalidators();
  if (opts.force) invalidateRiverCache();
  if (cached && riverCacheFresh(app, now)) return Promise.resolve(cached);
  // 在途去重：同一会话并发刷新只跑一趟全库扫描
  if (inflight) return inflight;
  // 新采集代表新基线：清掉上一轮可能残留的脏标记，否则这一轮又写不进缓存
  invalidated = false;
  const key = snapshotKey(now);
  const run = collectRiver(app, now).then(
    (data) => {
      if (inflight === run && cacheApp === app && !invalidated) {
        cached = data;
        cachedAt = now;
        cachedKey = key;
      }
      if (inflight === run) inflight = null;
      return data;
    },
    (err) => {
      // 失败不缓存：复位，下次调用重新读盘（旧语义「异常即重抛、无残留态」）
      if (inflight === run) {
        cached = null;
        inflight = null;
      }
      throw err;
    }
  );
  inflight = run;
  return run;
}

/**
 * 启动后台预热（ADR-0170 决策 3 / issue 381）：只填数据缓存，不建 DOM、不实例化面板
 * （ADR-0003 兼容）；延迟到首屏空闲，卸载旗标为真时短路，防插件刚禁用还留幽灵任务。
 * 失败静默：预热只是加速，真正打开时 loadRiverCached 会自行重采并呈现错误态。
 */
export function prewarmRiver(app: App, isUnloaded: () => boolean = () => false): void {
  if (prewarmed) return;
  prewarmed = true;
  const run = (): void => {
    if (isUnloaded()) return;
    void loadRiverCached(app).catch(() => undefined);
  };
  const host = typeof window === 'undefined'
    ? null
    : (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number });
  if (host && typeof host.requestIdleCallback === 'function') {
    // 首开分段渲染后，预热跑的是「慢数据」那一轮：8 秒兜底会让启动后马上点开首页时
    // 白等一整段空闲，故压到 1.2 秒——仍让出启动首帧，又赶得上用户第一次点开。
    host.requestIdleCallback(run, { timeout: 1200 });
  } else {
    setTimeout(run, 0);
  }
}
