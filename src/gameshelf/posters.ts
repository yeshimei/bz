/**
 * 游戏库媒体本地化（issue 368 增补；2026-09-17 扩到图标 + 回写本地路径）：
 * 把封面 header.jpg 与库内图标拉到本地文件夹（默认 CONFIG/游戏海报，设置键 gameshelfPosterFolder），
 * 并把笔记属性里的 `封面` / `图标` **写成 vault 本地路径**（与影院域 `海报: CONFIG/MOVIE POSTER/x.jpg`
 * 同一约定；Obsidian 属性面板认路径为链接，图片直接出缩略图）。
 *
 * frontmatter 键的分工（这是本模块的核心约定，别在别处另立一套）：
 * - `封面源` / `图标源` = Steam 远端地址，**同步管辖**（随库刷新，图标 hash 变了也能跟上）；
 * - `封面` / `图标`     = 本地图片的 vault 路径，**由本模块写**，同步绝不碰（否则每次同步都把
 *   本地路径冲回远端）。
 * 本地文件在 → 写本地路径；本地文件不在 → 按「源」键下载，下载成功才写。四种状态
 * （本地+有文件 / 本地+没文件 / 远端+有文件 / 远端+没文件）都收敛到同一条链路，故自愈。
 *
 * CDN 实测直连可达（不走代理），串行后台队列，进度静默（完成即重渲，不弹通知）。
 */
import type { App, TFile } from 'obsidian';
import { requestUrl } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { upsertDetail } from './notes';
import { M, type GameItem } from './state';
import { steamCoverUrl } from './steam';

export const DEFAULT_POSTER_FOLDER = 'CONFIG/游戏海报';

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

/** 显示用封面 URL（旧签名保留：本地优先、远端兜底；新代码用 coverDisplayUrl） */
export function posterDisplayUrl(app: App, appid: number, remote: string | null): string {
  return coverDisplayUrl(app, appid, remote);
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

/** 下载到 vault（成功 true；HTTP 非 2xx / 无 arrayBuffer / 异常 → false） */
async function download(app: App, path: string, url: string): Promise<boolean> {
  try {
    const resp = await requestUrl({ url, method: 'GET', throw: false });
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
        if (item.cover !== coverPath) wrote['封面'] = coverPath;
      } else if (await download(app, coverPath, item.coverSrc || steamCoverUrl(item.appid))) {
        wrote['封面'] = coverPath;
      }
      // 图标：只认「图标源」（hash 拼不出，没源就跳过——下次同步会补上）
      if (isRemote(item.iconSrc)) {
        const iconPath = `${resolvePosterFolder()}/${item.appid}-icon.jpg`;
        if (hasFile(app, iconPath)) {
          if (item.icon !== iconPath) wrote['图标'] = iconPath;
        } else if (await download(app, iconPath, item.iconSrc as string)) {
          wrote['图标'] = iconPath;
        }
      }
      if (Object.keys(wrote).length > 0) {
        // 内存态先跟上（本会话立刻显示本地图），再落盘（同步不碰这两个键，故只写一次）
        if (typeof wrote['封面'] === 'string') item.cover = wrote['封面'];
        if (typeof wrote['图标'] === 'string') item.icon = wrote['图标'] as string;
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

/** 逐条完成后节流重渲（1.5s 尾沿；面板关着 renderFn 空转无害） */
function scheduleRerender(): void {
  if (rerenderTimer) return;
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null;
    M.renderFn?.();
  }, 1500);
}

/** 卸载收口：清队列与节流计时器（在途请求随响应自然落地，不阻塞卸载） */
export function unloadPosters(): void {
  queue.length = 0;
  pending.clear();
  if (rerenderTimer) {
    clearTimeout(rerenderTimer);
    rerenderTimer = null;
  }
}
