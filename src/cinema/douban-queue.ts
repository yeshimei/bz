/**
 * 影院豆瓣抓取队列（ADR-0113 / issue 255 / 256 修订；ADR-0129 执行层迁入插件）：
 * 插件内存队列 → 串行执行插件内 fetchNoteDouban（**不再 spawn CLI**——进程边界整类缺陷
 * 消灭：Node 探测/runAsNode fuse/绝对路径契约/退出信号丢失；完成信号 = 函数返回值，
 * 字段落盘轮询兜底退役）。15s 间隔防限流，单条 3 分钟硬超时（Promise.race）。
 * 卡片 loading / 失败聚合通知 / 队列口径（缺海报或缺豆瓣链接）/ 会话去重 / 会话首轮
 * 补抓 / 删除取消（G8）全部保留。**移动端启用**（requestUrl + writeBinary 全平台可用）。
 */
import type { App, TFile } from 'obsidian';
import { requestUrl } from 'obsidian';
import { notice } from '../core/notice';
import { sleep } from '../core/utils';
import { tryGetSettings } from '../core/settings-provider';
import { M } from './state';
import { rebuildItems } from './data';
import { fetchNoteDouban, type DoubanFetchDeps, type DoubanFetchOutcome } from './douban-fetcher';

/** 条目间隔 ms（防豆瓣限流，对齐原守护 FETCH_INTERVAL） */
const FETCH_GAP_MS = 15000;
/** 单条硬超时 ms（Promise.race 兜底，防单条网络悬挂拖死队列） */
export const FETCH_TIMEOUT_MS = 3 * 60 * 1000;
/** 单请求超时 ms（requestUrl 不支持中止 → Promise.race） */
const HTTP_TIMEOUT_MS = 15000;

interface QueueEntry {
  file: TFile;
  name: string;
}

/** 执行器抽象（测试注入点）：抓单条笔记，返回抓取结果 */
export type FetchNote = (file: TFile, name: string) => Promise<DoubanFetchOutcome>;

const queue: QueueEntry[] = [];
/** 卡片 loading 驱动：抓取中的笔记路径 → 入队时刻（时限兜底用，见 isFetching） */
const pending = new Map<string, number>();
/** 会话内去重：已入队/已处理过的路径，同会话不重复补抓 */
const attempted = new Set<string>();
/** G8：已删除影片的取消集合——正在抓取时影片被删，完成后不再记失败 */
const cancelled = new Set<string>();
const failedNames: string[] = [];
/** 风控失败单独聚合（文案区分：等下轮自动重试，非数据缺失） */
let blockedNames: string[] = [];
let pumping = false;
/** 测试注入 */
let fetchFn: FetchNote | null = null;
let gapMs = FETCH_GAP_MS;
/** 抓取完成后延迟重建渲染的间隔（等 metadataCache 消化磁盘变化；测试注 0） */
let refreshDelayMs = 1500;

// ---------- requestUrl 适配（生产默认 HTTP 通道） ----------

/** 带 15s 超时的 requestUrl GET；非 2xx → null（风控/404 统一 null，由调用方判形态） */
async function httpGet(url: string, headers?: Record<string, string>): Promise<string | null> {
  try {
    const req = requestUrl({ url, method: 'GET', headers, throw: false }).then((resp) => {
      return resp.status >= 200 && resp.status < 300 ? resp.text : null;
    });
    const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), HTTP_TIMEOUT_MS));
    return await Promise.race([req, timer]);
  } catch {
    return null;
  }
}

async function downloadBinary(url: string, headers?: Record<string, string>): Promise<ArrayBuffer | null> {
  try {
    const req = requestUrl({ url, method: 'GET', headers, throw: false }).then((resp) => {
      return resp.status >= 200 && resp.status < 300 ? resp.arrayBuffer : null;
    });
    const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), HTTP_TIMEOUT_MS * 2));
    return await Promise.race([req, timer]);
  } catch {
    return null;
  }
}

/** 从插件设置读抓取配置（ApiZero Key / 豆瓣 Cookie，随库同步移动端） */
function fetchDepsFromSettings(app: App): DoubanFetchDeps {
  const s = (tryGetSettings() ?? {}) as Record<string, unknown>;
  const adapter = (app.vault as unknown as { adapter?: { writeBinary?: (p: string, d: ArrayBuffer) => Promise<void>; mkdir?: (p: string) => Promise<void> } }).adapter;
  const uaHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' };
  return {
    httpGet: (url, headers) => httpGet(url, { ...uaHeaders, ...(headers || {}) }),
    downloadBinary: (url, headers) => downloadBinary(url, { ...uaHeaders, ...(headers || {}) }),
    writeBinary: async (path, data) => {
      if (!adapter?.writeBinary) throw new Error('adapter.writeBinary 不可用');
      await adapter.writeBinary(path, data);
    },
    mkdir: async (path) => {
      await adapter?.mkdir?.(path);
    },
    apizeroKey: typeof s.cinemaApizeroKey === 'string' ? s.cinemaApizeroKey.trim() : '',
    doubanCookie: typeof s.cinemaDoubanCookie === 'string' ? s.cinemaDoubanCookie.trim() : '',
  };
}

/** 测试注入：替换执行器 / 条目间隔 / 完成后刷新延迟 */
export function configureFetchQueue(hooks: {
  fetch?: FetchNote;
  gapMs?: number;
  refreshDelayMs?: number;
}): void {
  if (hooks.fetch) fetchFn = hooks.fetch;
  if (hooks.gapMs !== undefined) gapMs = hooks.gapMs;
  if (hooks.refreshDelayMs !== undefined) refreshDelayMs = hooks.refreshDelayMs;
}

/** 卡片 loading 查询：该笔记是否在抓取中。
 *  时限兜底：超过「单条超时 + 余量」的 pending 记过期——执行器挂死时 loading 也不永转 */
export function isFetching(path: string | null | undefined): boolean {
  if (!path) return false;
  const at = pending.get(path);
  if (!at) return false;
  return Date.now() - at < FETCH_TIMEOUT_MS + 30_000;
}

/** 入队（会话内去重）；全平台启用（ADR-0129：requestUrl 移动端可用）。返回是否真入队 */
export function enqueueDoubanFetch(file: TFile | null, name: string): boolean {
  if (!file) return false;
  const key = file.path;
  if (attempted.has(key)) return false;
  attempted.add(key);
  pending.set(key, Date.now());
  queue.push({ file, name });
  void pump();
  return true;
}

/** G8：删除影片时出队——未开始的条目移出队列、loading 撤销；正在抓取的条目记入取消集合，
 *  完成后不再聚合计入失败通知（文件已删，「重启后会自动重试」的文案对它不成立） */
export function dequeueDoubanFetch(path: string | null | undefined): void {
  if (!path) return;
  const at = queue.findIndex((e) => e.file.path === path);
  if (at >= 0) queue.splice(at, 1);
  pending.delete(path);
  cancelled.add(path);
}

/** 面板打开扫描：未齐条目（缺海报或缺豆瓣链接）入队补抓；有新增即触发一次渲染（loading 首帧可见） */
export function sweepDoubanFetch(_app: App): void {
  let added = 0;
  for (const it of M.items) {
    if (!it.file) continue;
    if (!it.poster || !it.doubanUrl) {
      if (enqueueDoubanFetch(it.file, it.name)) added++;
    }
  }
  if (added > 0 && M.currentOverlay) M.renderFn?.();
}

/** 执行单条：注入执行器优先；默认 = 插件内 fetchNoteDouban + 3 分钟硬超时 */
async function runOne(entry: QueueEntry): Promise<DoubanFetchOutcome> {
  const fn = fetchFn ?? defaultFetchNote;
  try {
    return await Promise.race([
      fn(entry.file, entry.name),
      new Promise<DoubanFetchOutcome>((resolve) => setTimeout(() => resolve({ ok: false, reason: 'network' }), FETCH_TIMEOUT_MS)),
    ]);
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** 默认执行器：组装设置依赖跑插件内抓取 */
async function defaultFetchNote(file: TFile, _name: string): Promise<DoubanFetchOutcome> {
  const app = M.appRef;
  if (!app) return { ok: false, reason: 'network' };
  return fetchNoteDouban(app, file, fetchDepsFromSettings(app));
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    let first = true;
    while (queue.length > 0) {
      const entry = queue.shift()!;
      if (!first) await sleep(gapMs);
      first = false;
      const r = await runOne(entry);
      pending.delete(entry.file.path);
      // G8：已删除影片的条目完成后不记失败（取消集合消费后即清，防集合增长）
      if (cancelled.delete(entry.file.path)) {
        refreshAfterFetch();
        continue;
      }
      if (!r.ok) {
        if (r.reason === 'blocked') blockedNames.push(entry.name);
        else failedNames.push(entry.name);
      }
      refreshAfterFetch();
    }
  } finally {
    pumping = false;
  }
  // 失败聚合通知：风控与一般失败分开文案（风控等下轮自动重试，非数据缺失）
  if (blockedNames.length > 0) {
    notice(`豆瓣风控拦截，以下影片本轮未抓到：${blockedNames.join('、')}（重开面板会自动重试）`, 'error');
    blockedNames = [];
  }
  if (failedNames.length > 0) {
    notice(`以下影片豆瓣信息获取失败：${failedNames.join('、')}（重开面板会自动重试）`, 'error');
    failedNames.length = 0;
  }
}

/** 抓取落盘后刷新：立即一次（loading 退场）+ 延迟一次（等 metadataCache 消化磁盘变化，
 *  海报/豆瓣链接字段才会上卡）。 */
function refreshAfterFetch(): void {
  if (!M.currentOverlay || !M.appRef) return;
  rebuildItems(M.appRef);
  M.renderFn?.();
  setTimeout(() => {
    if (!M.currentOverlay || !M.appRef) return;
    rebuildItems(M.appRef);
    M.renderFn?.();
  }, refreshDelayMs);
}

/** 插件卸载：清队列与状态（会话语义重置） */
export function shutdownDoubanQueue(): void {
  queue.length = 0;
  pending.clear();
  attempted.clear();
  cancelled.clear();
  failedNames.length = 0;
  blockedNames = [];
  pumping = false;
}
