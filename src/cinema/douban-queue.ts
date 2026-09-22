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
import { notice, notify } from '../core/notice';
import { sleep } from '../core/utils';
import { tryGetSettings } from '../core/settings-provider';
import { M } from './state';
import { rebuildItems } from './data';
import { fetchNoteDouban, queryDoubanByName, downloadPosterToVault, type DoubanFetchDeps, type DoubanFetchOutcome, type DoubanQueryOutcome } from './douban-fetcher';

/** 查询结果类型再导出：测试注入 `configureFetchQueue({ preview })` 时要用 */
export type { DoubanQueryOutcome };

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
/** C7：路径 → 入队时刻队列中的前方条目数（快照）——仍在队列未开抓的条目按
 *  「入队时刻 + 快照 × 间隔 + 单条超时 + 余量」放宽 loading 时限；开抓（出队）即清除，
 *  此后回归单条时限。快照不随中途出队收缩（偏保守，loading 至多多挂片刻，无害） */
const waitAhead = new Map<string, number>();
/** 会话内去重：已入队/已处理过的路径，同会话不重复补抓 */
const attempted = new Set<string>();
/** G8：已删除影片的取消集合——正在抓取时影片被删，完成后不再记失败 */
const cancelled = new Set<string>();
const failedNames: string[] = [];
/** 本轮失败条目（呈报#23 / C4「重试」动作的重入队数据源，随 failedNames 同步清） */
let failedEntries: QueueEntry[] = [];
/** 风控失败单独聚合（文案区分：重启 Obsidian 重载插件后随 sweep 自动重试，非数据缺失） */
let blockedNames: string[] = [];
let blockedEntries: QueueEntry[] = [];
let pumping = false;
/** 测试注入 */
let fetchFn: FetchNote | null = null;
let gapMs = FETCH_GAP_MS;
/** 抓取完成后延迟重建渲染的间隔（等 metadataCache 消化磁盘变化；测试注 0） */
let refreshDelayMs = 1500;

// ---------- requestUrl 适配（生产默认 HTTP 通道） ----------

/** 带 15s 超时的 requestUrl GET；非 2xx / 超时 → null（由调用方判形态）；
 *  网络异常向上抛（审查 C6：吞成 null 会被 suggestLooksBlocked 误判为风控拦截） */
async function httpGet(url: string, headers?: Record<string, string>): Promise<string | null> {
  const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), HTTP_TIMEOUT_MS));
  const req = requestUrl({ url, method: 'GET', headers, throw: false }).then((resp) => {
    return resp.status >= 200 && resp.status < 300 ? resp.text : null;
  });
  req.catch(() => {}); // race 选中 timer 时消化 rejection，防 unhandled
  return await Promise.race([req, timer]);
}

async function downloadBinary(url: string, headers?: Record<string, string>): Promise<ArrayBuffer | null> {
  const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), HTTP_TIMEOUT_MS * 2));
  const req = requestUrl({ url, method: 'GET', headers, throw: false }).then((resp) => {
    return resp.status >= 200 && resp.status < 300 ? resp.arrayBuffer : null;
  });
  req.catch(() => {}); // 同上
  return await Promise.race([req, timer]);
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
    posterFolder: typeof s.cinemaPosterFolder === 'string' ? s.cinemaPosterFolder.trim() : '',
  };
}

/** 表单「解析」查询器类型（测试注入面） */
export type PreviewQuery = (app: App, name: string) => Promise<DoubanQueryOutcome>;
/** 测试注入：解析查询器（默认走真 queryDoubanByName） */
let previewFn: PreviewQuery | null = null;

/** 表单「解析」入口（issue 395）：按片名查询豆瓣字段。
 *  复用队列的 deps 组装（ApiZero Key / 豆瓣 Cookie / requestUrl 通道）——单一来源，
 *  表单不自己拼一份 HTTP 层。 */
export async function queryDoubanForPreview(app: App, name: string): Promise<DoubanQueryOutcome> {
  return previewFn ? previewFn(app, name) : queryDoubanByName(name, fetchDepsFromSettings(app));
}

/** 保存海报的注入面（测试用；默认走真下载） */
export type PreviewPosterSave = (app: App, name: string, posterUrl: string) => Promise<string | null>;
/** 测试注入：保存海报落库（默认走真 downloadPosterToVault） */
let posterFn: PreviewPosterSave | null = null;

/** 「添加影视」保存时把解析到的海报落库（issue 397）：与队列抓取共用 downloadPosterToVault
 *  与同一套 deps（requestUrl 下载 + adapter 写盘）。返回 vault 相对路径；null = 没落成
 *  （没网 / 写盘失败 / 未配置），由调用方决定是否回退后台抓取补齐。 */
export async function downloadPreviewPoster(app: App, name: string, posterUrl: string): Promise<string | null> {
  if (posterFn) return posterFn(app, name, posterUrl);
  const r = await downloadPosterToVault(name, posterUrl, fetchDepsFromSettings(app));
  return r.ok ? r.path : null;
}

/** 测试注入：替换执行器 / 条目间隔 / 完成后刷新延迟 */
export function configureFetchQueue(hooks: {
  fetch?: FetchNote;
  gapMs?: number;
  refreshDelayMs?: number;
  /** 解析查询器；传 null 复位（测试 afterEach 用） */
  preview?: PreviewQuery | null;
  /** 保存海报落库；传 null 复位（测试 afterEach 用） */
  poster?: PreviewPosterSave | null;
}): void {
  if (hooks.fetch) fetchFn = hooks.fetch;
  if (hooks.preview !== undefined) previewFn = hooks.preview;
  if (hooks.poster !== undefined) posterFn = hooks.poster;
  if (hooks.gapMs !== undefined) gapMs = hooks.gapMs;
  if (hooks.refreshDelayMs !== undefined) refreshDelayMs = hooks.refreshDelayMs;
}

/** 卡片 loading 查询：该笔记是否在抓取中。
 *  时限兜底：开抓后超过「单条超时 + 余量」的 pending 记过期——执行器挂死时 loading 也不永转。
 *  仍在队列未开抓的条目放宽为「入队时刻 + 入队时前方条目数 × 间隔 + 单条超时 + 余量」
 *  （审查 C7：长队尾条目按入队时刻的单条时限会在开抓前就过期、spinner 提前消失） */
export function isFetching(path: string | null | undefined): boolean {
  if (!path) return false;
  const at = pending.get(path);
  if (!at) return false;
  const ahead = waitAhead.get(path) ?? 0;
  return Date.now() - at < ahead * gapMs + FETCH_TIMEOUT_MS + 30_000;
}

/** 入队（会话内去重）；全平台启用（ADR-0129：requestUrl 移动端可用）。返回是否真入队 */
export function enqueueDoubanFetch(file: TFile | null, name: string): boolean {
  if (!file) return false;
  const key = file.path;
  // G8 豁免只在「在抓被删」那一次：dequeue（删除）会无条件记 cancelled，删过**未入队**的
  // 影片会留残留标记——同名重建后首次真失败会被 pump 当取消静默吞掉。入队即视为新会话条目，
  // 先清残留（attempted 已由 dequeue 清除，此处兜对齐）。
  cancelled.delete(key);
  if (attempted.has(key)) return false;
  attempted.add(key);
  pending.set(key, Date.now());
  waitAhead.set(key, queue.length); // push 前长度 = 前方条目数（快照，见 isFetching C7）
  queue.push({ file, name });
  void pump();
  return true;
}

/** G8：删除影片时出队——未开始的条目移出队列、loading 撤销；正在抓取的条目记入取消集合，
 *  完成后不再聚合计入失败通知（文件已删，「重启后会自动重试」的文案对它不成立）。
 *  同时清除会话去重标记（审查 C10）：删除后同名重建的影片允许重新入队补抓 */
export function dequeueDoubanFetch(path: string | null | undefined): void {
  if (!path) return;
  const at = queue.findIndex((e) => e.file.path === path);
  if (at >= 0) queue.splice(at, 1);
  pending.delete(path);
  waitAhead.delete(path);
  cancelled.add(path);
  attempted.delete(path);
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
      // C7：出队即刷新打点并清除队列等待预算——loading 时限从「真正开抓」起算，
      // 长队尾条目不再按入队时刻提前过期
      pending.set(entry.file.path, Date.now());
      waitAhead.delete(entry.file.path);
      if (!first) await sleep(gapMs);
      first = false;
      const r = await runOne(entry);
      pending.delete(entry.file.path);
      waitAhead.delete(entry.file.path);
      // G8：已删除影片的条目完成后不记失败（取消集合消费后即清，防集合增长）
      if (cancelled.delete(entry.file.path)) {
        refreshAfterFetch();
        continue;
      }
      // 审计#12（issue 337）：写回前存在性守卫——目标笔记已被删（含插件外删除，不经 G8
      // dequeueDoubanFetch）→ 静默出队：清会话去重标记（对齐 G8/C10，同名重建可重新入队），
      // 不记失败不发错误通知（外部删除是用户意图，「重启后会自动重试」的文案对它不成立）
      if (M.appRef && !M.appRef.vault.getAbstractFileByPath(entry.file.path)) {
        console.info(`bz 影院：豆瓣抓取目标笔记已删除，静默出队：${entry.file.path}`);
        attempted.delete(entry.file.path);
        refreshAfterFetch();
        continue;
      }
      if (!r.ok) {
        if (r.reason === 'blocked') {
          blockedNames.push(entry.name);
          blockedEntries.push(entry);
        } else {
          failedNames.push(entry.name);
          failedEntries.push(entry);
        }
      }
      refreshAfterFetch();
    }
  } finally {
    pumping = false;
  }
  // 失败聚合通知：风控与一般失败分开文案。
  //  会话去重只在插件卸载时重置，重开面板 sweep 会被拦下、不会重试（C5：文案如实）。
  //  呈报#23（C4）：两份通知都挂「重试」动作——清会话去重标记重新入队（一键替代重启重载）。
  //  C5 文案保留不冲突：不重试它仍会在重启重载后自动补抓。
  if (blockedNames.length > 0) {
    const entries = blockedEntries; // 先捕获本轮数组：模块变量随通知清零，onClick 以捕获值为准
    notify(`豆瓣风控拦截，以下影片本轮未抓到：${blockedNames.join('、')}（重启 Obsidian（重载插件）后会自动重试）`, {
      type: 'error',
      action: { label: '重试', onClick: () => requeueFailed(entries) },
    });
    blockedNames = [];
    blockedEntries = [];
  }
  if (failedNames.length > 0) {
    const entries = failedEntries;
    notify(`以下影片豆瓣信息获取失败：${failedNames.join('、')}（重启 Obsidian（重载插件）后会自动重试）`, {
      type: 'error',
      action: { label: '重试', onClick: () => requeueFailed(entries) },
    });
    failedNames.length = 0;
    failedEntries = [];
  }
}

/**
 * 失败通知「重试」（呈报#23 / C4）：清会话去重标记后重新入队（enqueueDoubanFetch 内会
 * 重置 loading 打点与队列快照）。笔记已删除的条目跳过并对齐审计#12 口径清去重标记；
 * 全部不可重试时如实说明。条目**消费即出列**——重复点击不重复入队（防重复请求踩限流）。
 */
function requeueFailed(entries: QueueEntry[]): void {
  const app = M.appRef;
  if (!app) return;
  let added = 0;
  let gone = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    entries.splice(i, 1);
    attempted.delete(e.file.path);
    const file = app.vault.getAbstractFileByPath(e.file.path) as TFile | null;
    if (!file) {
      gone++;
      continue;
    }
    if (enqueueDoubanFetch(file, e.name)) added++;
  }
  if (added > 0) notice(`已重新入队 ${added} 部影片的豆瓣抓取`);
  else if (gone > 0) notice('没有可重试的影片', 'warning');
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
  waitAhead.clear();
  attempted.clear();
  cancelled.clear();
  failedNames.length = 0;
  failedEntries = [];
  blockedNames = [];
  blockedEntries = [];
  pumping = false;
}
