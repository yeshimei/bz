/**
 * 游戏库媒体本地化（issue 368 增补；2026-09-17 扩到图标 + 回写本地路径；
 * 2026-09-18 扩到商店截图；2026-09-22 **成就图标不再本地化**——只留封面 / 库内图标 / 截图，
 * 成就图标改「远端直取、不落盘」，见 ADR-0176）。
 *
 * 落在这个文件夹（默认 CONFIG/游戏海报，设置键 gameshelfPosterFolder）的三类图：
 * - `<appid>.jpg`            封面 header.jpg
 * - `<appid>-icon.jpg`       库内小图标
 * - `<appid>-shot-<n>.jpg`   商店截图（第 n 张，1 基）
 *
 * 为什么成就图标不走这条路（ADR-0176 的判据）：它是**按成就条目逐条生成**的，且每个成就两色
 * （彩色 + 灰图）——实测 147 款库累积出 8,118 个文件，是封面 / 库内图标 / 截图三类合计
 * （约 1,400 个）的近六倍。文件数正是 Obsidian 每次启动都要遍历的量，所以它改成界面直取
 * Steam 的远端 URL（ui.ts::achListHtml），一个本地文件都不产生。判据是**是否随条目数膨胀**，
 * 不是「是不是图标」——库内小图标是每款一张的固定量，照本地化。
 *
 * frontmatter 键的分工（这是本模块的核心约定，别在别处另立一套）：
 * - `封面源` / `图标源` / `截图源` = Steam 远端地址，**同步管辖**（随库刷新，hash 变了能跟上）；
 * - `封面` / `图标` / `截图`       = 本地图片的 vault 路径，**由本模块写**，同步绝不碰
 *   （否则每次同步都把本地路径冲回远端）。`截图源` 与 `截图` **同序同长**，下载失败位留空串。
 *
 * CDN 实测直连可达（不走代理）。两条队列各自串行：封面 / 库内图标一条（要「立刻可看」），
 * 截图另一条（量大，逐条之间留间隔，别拿几百张图去冲 Steam CDN）。
 */
import type { App, TFile } from 'obsidian';
import { requestUrl } from 'obsidian';
import { withTimeout } from '../core/http';
import { tryGetSettings } from '../core/settings-provider';
import { upsertDetail } from './notes';
import { M, type GameItem } from './state';
import { steamCoverUrl } from './steam';
import { GS_FM } from './constants';

export const DEFAULT_POSTER_FOLDER = 'CONFIG/游戏海报';

/**
 * 单张媒体下载超时（深审 F8）：对照本域 steam 通道 withTimeout(…, 20s)。此前裸 requestUrl，
 * 网络劣化时一张挂起图让串行队列整体停摆到传输层自身超时——几百张截图排队时尤其致命。
 * 超时仅弃结果（requestUrl 无中止能力，core/http 同款语义），失败位走原有兜底。
 */
const MEDIA_DOWNLOAD_TIMEOUT_MS = 20_000;

/** 海报文件夹解析（显式配置优先，缺省回落） */
export function resolvePosterFolder(): string {
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    return typeof s.gameshelfPosterFolder === 'string' && s.gameshelfPosterFolder.trim()
      ? s.gameshelfPosterFolder
      : DEFAULT_POSTER_FOLDER;
  } catch {
    return DEFAULT_POSTER_FOLDER;
  }
}

/** 本地封面路径（vault 相对；写进 frontmatter `封面` 的就是它） */
export function localCoverPath(appid: number): string {
  return `${resolvePosterFolder()}/${appid}.jpg`;
}

/** 本地图标路径（与封面同文件夹，`-icon` 后缀区分） */
export function localIconPath(appid: number): string {
  return `${resolvePosterFolder()}/${appid}-icon.jpg`;
}

/** 值是不是远端地址（不是 → 当本地 vault 路径看待） */
function isRemote(v: string | null | undefined): boolean {
  return !!v && /^https?:\/\//i.test(v);
}

/** 本地文件是否存在 */
function hasFile(app: App, path: string): boolean {
  try {
    return app.vault.getAbstractFileByPath(path) !== null;
  } catch {
    return false;
  }
}

/** vault 文件 → 可显示的 resource URL（拿不到 → ''） */
function resourceUrl(app: App, path: string): string {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f) return '';
  try {
    return app.vault.getResourcePath(f as never);
  } catch {
    return '';
  }
}

/**
 * 封面显示 URL：本地文件 → resource URL；否则用属性里的远端值；再否则回落 CDN 直拼。
 * （四种状态都兜得住，UI 侧只管调这一个函数。）
 */
export function coverDisplayUrl(app: App, appid: number, value: string | null, src?: string | null): string {
  const local = resourceUrl(app, `${resolvePosterFolder()}/${appid}.jpg`);
  if (local) return local;
  if (isRemote(value)) return value as string;
  if (isRemote(src)) return src as string;
  return steamCoverUrl(appid);
}

/** 图标显示 URL（无本地文件且属性里也没有远端值 → ''，UI 不渲染图标） */
export function iconDisplayUrl(app: App, appid: number, value: string | null, src?: string | null): string {
  const local = resourceUrl(app, `${resolvePosterFolder()}/${appid}-icon.jpg`);
  if (local) return local;
  if (isRemote(value)) return value as string;
  return isRemote(src) ? (src as string) : '';
}

/** 队列条目（appid + 属性现状 + 远端源；file 为 null 时只显示不落盘——测试场景） */
export interface MediaItem {
  appid: number;
  /** frontmatter `封面` 现值（本地路径或远端） */
  cover: string | null;
  /** frontmatter `封面源`（远端；缺省用 CDN 直拼兜底） */
  coverSrc?: string | null;
  /** frontmatter `图标` 现值 */
  icon?: string | null;
  /** frontmatter `图标源`（远端；没有就跳过图标） */
  iconSrc?: string | null;
  file: TFile | null;
}

/** GameItem[] → 队列条目（ui / index 两处调用共用，别再各拼一遍字段） */
export function mediaItemsOf(items: GameItem[]): MediaItem[] {
  return items.map((it) => ({
    appid: it.appid,
    cover: it.cover,
    coverSrc: it.coverSrc,
    icon: it.icon,
    iconSrc: it.iconSrc,
    file: it.file,
  }));
}

interface QueueJob {
  app: App;
  item: MediaItem;
}
const queue: QueueJob[] = [];
const pending = new Set<number>();
let running = false;
let rerenderTimer: ReturnType<typeof setTimeout> | null = null;

/** 该条目还有没有活要干（本地文件齐 + 属性已指本地 → 无事可做，别排队） */
function needsWork(app: App, it: MediaItem): boolean {
  const cover = `${resolvePosterFolder()}/${it.appid}.jpg`;
  if (!hasFile(app, cover)) return true;
  if (it.cover !== cover) return true;
  if (isRemote(it.iconSrc)) {
    const icon = `${resolvePosterFolder()}/${it.appid}-icon.jpg`;
    if (!hasFile(app, icon)) return true;
    if (it.icon !== icon) return true;
  }
  return false;
}

/** 把缺本地媒体的条目入队（幂等；调用方为同步完成 / 面板打开） */
export function ensurePosters(app: App, items: MediaItem[]): void {
  const folder = resolvePosterFolder();
  if (!app.vault.getAbstractFileByPath(folder)) {
    try {
      void app.vault.createFolder(folder);
    } catch {
      /* 并发建目录：已存在即忽略 */
    }
  }
  let added = 0;
  for (const it of items) {
    if (pending.has(it.appid)) continue;
    if (!needsWork(app, it)) continue;
    pending.add(it.appid);
    queue.push({ app, item: it });
    added += 1;
  }
  if (added > 0 && !running) void runQueue();
}

/** 下载到 vault（成功 true；HTTP 非 2xx / 无 arrayBuffer / 超时 / 异常 → false） */
async function download(app: App, path: string, url: string): Promise<boolean> {
  try {
    const resp = await withTimeout(
      requestUrl({ url, method: 'GET', throw: false }),
      MEDIA_DOWNLOAD_TIMEOUT_MS,
      url,
    );
    // obsidian 的 RequestUrlResponse.arrayBuffer 是属性（非方法）；mock 环境缺省 undefined
    const buf = (resp as { arrayBuffer?: ArrayBuffer }).arrayBuffer;
    if (resp.status >= 200 && resp.status < 300 && buf) {
      if (!app.vault.getAbstractFileByPath(path)) await app.vault.adapter.writeBinary(path, buf);
      return true;
    }
  } catch (e) {
    console.warn('bz 游戏库：媒体下载失败:', url, e);
  }
  return false;
}

async function runQueue(): Promise<void> {
  running = true;
  while (queue.length > 0) {
    const job = queue.shift()!;
    const { app, item } = job;
    try {
      const wrote: Record<string, unknown> = {};
      // 封面：本地文件优先；没有则按「封面源」（缺省 CDN 直拼）下载
      const coverPath = `${resolvePosterFolder()}/${item.appid}.jpg`;
      if (hasFile(app, coverPath)) {
        if (item.cover !== coverPath) wrote[GS_FM.cover] = coverPath;
      } else if (await download(app, coverPath, item.coverSrc || steamCoverUrl(item.appid))) {
        wrote[GS_FM.cover] = coverPath;
      }
      // 图标：只认「图标源」（hash 拼不出，没源就跳过——下次同步会补上）
      if (isRemote(item.iconSrc)) {
        const iconPath = `${resolvePosterFolder()}/${item.appid}-icon.jpg`;
        if (hasFile(app, iconPath)) {
          if (item.icon !== iconPath) wrote[GS_FM.icon] = iconPath;
        } else if (await download(app, iconPath, item.iconSrc as string)) {
          wrote[GS_FM.icon] = iconPath;
        }
      }
      if (Object.keys(wrote).length > 0) {
        // 内存态先跟上（本会话立刻显示本地图），再落盘（同步不碰这两个键，故只写一次）
        const coverWrote = wrote[GS_FM.cover];
        if (typeof coverWrote === 'string') item.cover = coverWrote;
        if (typeof wrote[GS_FM.icon] === 'string') item.icon = wrote[GS_FM.icon] as string;
        if (item.file) {
          try {
            await upsertDetail(app, item.file, wrote);
          } catch (e) {
            console.warn('bz 游戏库：媒体路径写回失败:', item.appid, e);
          }
        }
        scheduleRerender();
      }
    } finally {
      pending.delete(item.appid);
    }
  }
  running = false;
}

/* ---------- 商店截图 ---------- */

/** 本地截图路径（与「截图源」同序，index 0 基 → 文件名 1 基） */
export function localShotPath(appid: number, index: number): string {
  return `${resolvePosterFolder()}/${appid}-shot-${index + 1}.jpg`;
}

/**
 * 截图展示 URL（本地优先、远端兜底）：本地文件在 → resource URL；本地缺 → 该位的远端源。
 * 两数组同序同长（detail.ts::fmToShots 保证），空位跳过。
 */
export function resolveShotUrls(app: App, local: string[], remote: string[]): string[] {
  const n = Math.max(local.length, remote.length);
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const localPath = local[i] ?? '';
    const localUrl = localPath ? resourceUrl(app, localPath) : '';
    if (localUrl) out.push(localUrl);
    else if (isRemote(remote[i])) out.push(remote[i] as string);
  }
  return out;
}

/** 截图下载任务（整组一起下完再写 `截图`——数组是整体的，分次写会留半截状态） */
export interface ShotJob {
  appid: number;
  file: TFile | null;
  /** `截图源` 远端地址（与 album 同序） */
  remote: string[];
  /** 当前的 `截图` 值（相同则不写盘，避免无谓的 frontmatter 重写） */
  prevLocal: string[];
}

/** 第二条队列（截图）。任务间留间隔，别拿几百张图去冲 Steam CDN */
const MEDIA_INTERVAL_MS = 120;
let mediaIntervalMs = MEDIA_INTERVAL_MS;
/** 测试用：把队列间隔归零（生产恒 120ms，见 MEDIA_INTERVAL_MS） */
export function setMediaInterval(ms: number): void {
  mediaIntervalMs = ms;
}
const mediaTasks: Array<() => Promise<void>> = [];
const mediaQueued = new Set<string>();
let mediaRunning = false;

/** 截图入队（缺哪张下哪张；下完把整组路径写回 `截图`，失败位留空串保对齐） */
export function ensureShots(app: App, job: ShotJob): void {
  if (job.remote.length === 0) return;
  const key = `s:${job.appid}`;
  if (mediaQueued.has(key)) return;
  mediaQueued.add(key);
  mediaTasks.push(async () => {
    try {
      const paths: string[] = [];
      let downloaded = 0;
      for (let i = 0; i < job.remote.length; i += 1) {
        const path = localShotPath(job.appid, i);
        if (hasFile(app, path)) {
          paths.push(path);
          continue;
        }
        if (await download(app, path, job.remote[i])) {
          paths.push(path);
          downloaded += 1;
        } else {
          paths.push(''); // 失败留空位：两数组靠下标对齐，不能压缩
        }
      }
      const wanted = job.prevLocal.concat(Array(Math.max(0, job.remote.length - job.prevLocal.length)).fill(''));
      const same = wanted.length === paths.length && wanted.every((v, i) => v === paths[i]);
      if (job.file && (downloaded > 0 || !same)) {
        try {
          await upsertDetail(app, job.file, { [GS_FM.shots]: paths });
          scheduleRerender();
        } catch (e) {
          console.warn('bz 游戏库：截图路径写回失败:', job.appid, e);
        }
      }
    } finally {
      mediaQueued.delete(key);
    }
  });
  void pumpMedia();
}

async function pumpMedia(): Promise<void> {
  if (mediaRunning) return;
  mediaRunning = true;
  while (mediaTasks.length > 0) {
    const task = mediaTasks.shift()!;
    try {
      await task();
    } catch (e) {
      console.warn('bz 游戏库：媒体任务异常:', e);
    }
    if (mediaTasks.length > 0) await new Promise((r) => setTimeout(r, mediaIntervalMs));
  }
  mediaRunning = false;
}

/** 逐条完成后节流重渲（1.5s 尾沿；面板关着 renderFn 空转无害） */
function scheduleRerender(): void {
  if (rerenderTimer) return;
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null;
    M.renderFn?.();
    M.modalRepaintFn?.(); // 详情弹窗不在面板树里，得单独叫一声
  }, 1500);
}

/** 卸载收口：清两条队列与节流计时器（在途请求随响应自然落地，不阻塞卸载） */
export function unloadPosters(): void {
  queue.length = 0;
  pending.clear();
  mediaTasks.length = 0;
  mediaQueued.clear();
  if (rerenderTimer) {
    clearTimeout(rerenderTimer);
    rerenderTimer = null;
  }
}
