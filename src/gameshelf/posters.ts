/**
 * 游戏库媒体本地化（issue 368 增补；2026-09-17 扩到图标 + 回写本地路径；
 * 2026-09-18 扩到**成就图标 + 商店截图**——用户拍板「图片图标都存本地指定文件夹」）。
 *
 * 落在这个文件夹（默认 CONFIG/游戏海报，设置键 gameshelfPosterFolder）的四类图：
 * - `<appid>.jpg`            封面 header.jpg
 * - `<appid>-icon.jpg`       库内小图标
 * - `<appid>-ach-<apiname>-{on,off}.jpg`  成就图标（彩色 = 已解锁 / 灰色 = 未解锁）
 * - `<appid>-shot-<n>.jpg`   商店截图（第 n 张，1 基）
 *
 * frontmatter 键的分工（这是本模块的核心约定，别在别处另立一套）：
 * - `封面源` / `图标源` / `截图源` = Steam 远端地址，**同步管辖**（随库刷新，hash 变了能跟上）；
 * - `封面` / `图标` / `截图`       = 本地图片的 vault 路径，**由本模块写**，同步绝不碰
 *   （否则每次同步都把本地路径冲回远端）。`截图源` 与 `截图` **同序同长**，下载失败位留空串。
 * - **成就图标一个属性键都不占**：文件名由 (appid, apiname, 解锁态) 推出，写进属性纯属冗余；
 *   134 款成就光图标地址清单就要 1.4 MB，这是属性体积的命门。
 *
 * CDN 实测直连可达（不走代理）。两条队列各自串行：封面/库内图标一条（要「立刻可看」），
 * 成就图标与截图另一条（量级差两个数量级，混排会把封面挤到几千张之后）。
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

/* ---------- 成就图标与商店截图（2026-09-18 全量本地化） ---------- */

/** 文件名段净化（apiname 一般是 [A-Z0-9_]，仍兜一手：非法字符换 _、限长防超路径上限） */
function safeNameSeg(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'x';
}

/** 本地成就图标路径（彩色 = 已解锁 / 灰色 = 未解锁；两色都下，状态翻转零下载） */
export function localAchIconPath(appid: number, apiName: string, unlocked: boolean): string {
  return `${resolvePosterFolder()}/${appid}-ach-${safeNameSeg(apiName)}-${unlocked ? 'on' : 'off'}.jpg`;
}

/** 本地截图路径（与「截图源」同序，index 0 基 → 文件名 1 基） */
export function localShotPath(appid: number, index: number): string {
  return `${resolvePosterFolder()}/${appid}-shot-${index + 1}.jpg`;
}

/** 成就图标显示 URL（本地文件在 → vault resource URL；否则 ''，界面用占位圆点） */
export function achIconDisplayUrl(app: App, appid: number, apiName: string, unlocked: boolean): string {
  return resourceUrl(app, localAchIconPath(appid, apiName, unlocked));
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

/** 成就图标下载任务（两色都给 URL；Steam 没给的那色跳过） */
export interface AchIconJob {
  apiName: string;
  /** 已解锁用的彩色图（Schema icon） */
  on: string | null;
  /** 未解锁用的灰图（Schema icongray；Steam 多数给，个别没有 → 界面回落彩色 + CSS 灰度） */
  off: string | null;
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

/** 第二条队列（成就图标 + 截图）。任务间留间隔，别拿几千张图去冲 Steam CDN */
const MEDIA_INTERVAL_MS = 120;
let mediaIntervalMs = MEDIA_INTERVAL_MS;
/** 测试用：把队列间隔归零（生产恒 120ms，见 MEDIA_INTERVAL_MS） */
export function setMediaInterval(ms: number): void {
  mediaIntervalMs = ms;
}
const mediaTasks: Array<() => Promise<void>> = [];
const mediaQueued = new Set<string>();
let mediaRunning = false;

/** 成就图标入队（幂等：本地文件已在 → 不排队；这条队列不写属性，故不需要 file） */
export function ensureAchIcons(app: App, appid: number, jobs: AchIconJob[]): void {
  for (const job of jobs) {
    const wants: Array<[string | null, boolean]> = [[job.on, true], [job.off, false]];
    for (const [url, unlocked] of wants) {
      if (!url) continue;
      const path = localAchIconPath(appid, job.apiName, unlocked);
      if (hasFile(app, path)) continue;
      const key = `i:${path}`;
      if (mediaQueued.has(key)) continue;
      mediaQueued.add(key);
      mediaTasks.push(async () => {
        try {
          // 图标不写属性（文件名可推导），唯一的副作用就是文件本身 ——
          // 所以下完必须显式叫一次重渲，否则界面上永远停在占位图（弹窗也靠这个钩子）
          if (await download(app, path, url)) scheduleRerender();
        } finally {
          mediaQueued.delete(key);
        }
      });
    }
  }
  void pumpMedia();
}

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
          await upsertDetail(app, job.file, { 截图: paths });
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

/**
 * 该款的成就图标有没有缺（按属性里的行判断）。
 * 只查**当前解锁态对应的那一色**：Steam 个别成就没给 icongray，若两色都查，
 * 那款会永远判「缺」→ 每次开面板都重拉一次 schema，白跑。
 * 用途：属性里不存图标地址，所以图标缺了只能靠重拉 schema 才拿得到 URL。
 */
export function achIconsMissing(app: App, appid: number, rows: Array<{ apiName: string; unlocked: boolean }>): boolean {
  for (const r of rows) {
    if (!hasFile(app, localAchIconPath(appid, r.apiName, r.unlocked))) return true;
  }
  return false;
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
