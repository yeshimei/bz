/**
 * 游戏海报本地缓存（issue 368 增补）：封面 header.jpg 拉到本地海报文件夹
 * （默认 CONFIG/游戏海报，设置键 gameshelfPosterFolder），显示层本地优先、远端兜底。
 * CDN 实测直连可达（不走代理），串行后台队列拉取，进度静默（完成即可，不弹通知）。
 */
import type { App } from 'obsidian';
import { requestUrl } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { M } from './state';

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

/** 显示用封面 URL：本地已缓存 → vault 资源路径；否则远端直拼 */
export function posterDisplayUrl(app: App, appid: number, remote: string | null): string {
  const f = app.vault.getAbstractFileByPath(`${resolvePosterFolder()}/${appid}.jpg`);
  if (f) {
    try {
      return app.vault.getResourcePath(f as never);
    } catch {
      /* mock/异常回落远端 */
    }
  }
  return remote ?? '';
}

/** 本地是否已有该海报 */
function hasPoster(app: App, folder: string, appid: number): boolean {
  return app.vault.getAbstractFileByPath(`${folder}/${appid}.jpg`) !== null;
}

/** 串行队列（路径去重；面板开着时逐张完成后节流重渲，本地封面渐进替换远端） */
interface QueueJob {
  app: App;
  path: string;
  url: string;
  appid: number;
}
const queue: QueueJob[] = [];
const pending = new Set<string>();
let running = false;
let rerenderTimer: ReturnType<typeof setTimeout> | null = null;

/** 把缺本地海报的条目入队（幂等；调用方为 sync 完成 / 面板打开） */
export function ensurePosters(app: App, items: Array<{ appid: number; cover: string | null }>): void {
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
    if (!it.cover) continue;
    if (hasPoster(app, folder, it.appid)) continue;
    const path = `${folder}/${it.appid}.jpg`;
    if (pending.has(path)) continue;
    pending.add(path);
    queue.push({ app, path, url: it.cover, appid: it.appid });
    added += 1;
  }
  if (added > 0 && !running) void runQueue();
}

async function runQueue(): Promise<void> {
  running = true;
  while (queue.length > 0) {
    const job = queue.shift()!;
    try {
      const resp = await requestUrl({ url: job.url, method: 'GET', throw: false });
      // obsidian 的 RequestUrlResponse.arrayBuffer 是属性（非方法）；mock 环境缺省 undefined
      const buf = (resp as { arrayBuffer?: ArrayBuffer }).arrayBuffer;
      if (resp.status >= 200 && resp.status < 300 && buf) {
        if (!job.app.vault.getAbstractFileByPath(job.path)) {
          await job.app.vault.adapter.writeBinary(job.path, buf);
          scheduleRerender(job.app);
        }
      }
    } catch (e) {
      console.warn('bz 游戏架：海报下载失败:', job.url, e);
    } finally {
      pending.delete(job.path);
    }
  }
  running = false;
}

/** 逐张完成后节流重渲（1.5s 尾沿；本地封面渐进替换远端，面板关着 renderFn 空转无害） */
function scheduleRerender(_app: App): void {
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
