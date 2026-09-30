/* ============================================================
 * 留影缩略图管线（issue 519）——病根：1616 张全尺寸原图当 104px 格子用，
 * 开页全量同步读盘 + base64 直接把面板冻死。
 * 网格只读 240px webp 缩略档（desc/thumbs/ 镜像 desc/<月>/ 子结构）；
 * 缺档后台串行补齐，补上之前回退原图 data URL（分片渲染兜住单页量）。
 * 缩略档是派生品：删了随下次渲染重建，不担数据安全；生成失败不写盘，
 * 读取侧永远回退原图，没有死路。
 * ============================================================ */
import { imageMimeOfPath } from '../core/ai';

/** 缩略档长边：104px 格 × 高分屏 2x 余量（灯箱不看它，看原图） */
export const THUMB_EDGE = 240;

/** 缩略档相对 desc 的子目录（镜像 desc/<月>/ 子结构） */
export const THUMB_DIR = 'thumbs';

/** 缩略图质量（webp；观感够认、体积够小） */
const THUMB_QUALITY = 0.72;

/** desc 派生档相对路径（`月/名`）→ 缩略档绝对路径（`desc/thumbs/月/名.webp`，扩展名归一 webp） */
export function descThumbPath(dataRoot: string, talker: string, img: string): string {
  const src = String(img).trim().replace(/\\/g, '/');
  const dot = src.lastIndexOf('.');
  const stem = dot > 0 ? src.slice(0, dot) : src;
  const base = `${dataRoot}/${talker}/desc/${THUMB_DIR}/${stem}.webp`.replace(/\\/g, '/');
  return base.replace(/\/+/g, '/');
}

/** thumb 管线够用的 fs 面（与 window.require('fs') 结构兼容；数据层测试给内存假件） */
export interface ThumbFs {
  existsSync(p: string): boolean;
  readFileSync(p: string): Uint8Array;
  mkdirSync(p: string, opts: { recursive: boolean }): void;
  writeFileSync(p: string, data: Uint8Array): void;
}

/** 像素层单点：字节 → 长边 THUMB_EDGE 的 webp 字节。默认实现 createImageBitmap + canvas
 *  （库外文件走 fs 字节 → Blob，同源无污染）；测试注入假件，路径/队列行为不碰真解码。 */
let compressOverride: ((bytes: Uint8Array, mime: string) => Promise<Uint8Array | null>) | null = null;

/** 测试注入口；传 null 还原默认实现 */
export function setThumbCompressorForTests(
  fn: ((bytes: Uint8Array, mime: string) => Promise<Uint8Array | null>) | null,
): void {
  compressOverride = fn;
}

async function compressThumb(bytes: Uint8Array, mime: string): Promise<Uint8Array | null> {
  if (compressOverride) return compressOverride(bytes, mime);
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return null;
  try {
    const bmp = await createImageBitmap(new Blob([bytes as unknown as BlobPart], { type: mime }));
    const scale = Math.min(1, THUMB_EDGE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      return null;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', THUMB_QUALITY));
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

/** 生成并落一份缩略档：已存在直接 true（幂等）；源缺 / 解码失败一律 false 不写盘。 */
export async function ensureThumbFile(fs: ThumbFs, srcAbs: string, dstAbs: string): Promise<boolean> {
  try {
    if (fs.existsSync(dstAbs)) return true;
    if (!fs.existsSync(srcAbs)) return false;
    const mime = imageMimeOfPath(srcAbs);
    if (!mime) return false;
    const bytes = fs.readFileSync(srcAbs);
    if (!bytes || !bytes.length) return false;
    const out = await compressThumb(bytes, mime);
    if (!out || !out.length) return false;
    fs.mkdirSync(dstAbs.slice(0, dstAbs.lastIndexOf('/')), { recursive: true });
    fs.writeFileSync(dstAbs, out);
    return true;
  } catch {
    return false;
  }
}

type ThumbJob = { src: string; dst: string; onDone?: (ok: boolean) => void };

/** 待补队列（键 = dst 绝对路径，天然去重） */
const pendingJobs = new Map<string, ThumbJob>();
/** 在跑的那张（取队即记、办结才消——否则「已出队未办结」的窗口拦不住重复入队） */
const inFlight = new Set<string>();
/** 已办结（成 / 败都记）：坏档不反复重试；面板重开清一次给重试机会 */
const settledPaths = new Set<string>();
let running = false;
let queueFs: ThumbFs | null = null;

/** 面板重开给坏档重试机会（待处理队列不动：重开接着补） */
export function resetThumbQueueForPanel(): void {
  settledPaths.clear();
}

/** 关面板停补齐（幂等；在跑那张自然收尾，重开面板入新活时接着跑） */
export function cancelThumbQueue(): void {
  pendingJobs.clear();
}

/** 已办结（成 / 败）、在跑或已在队 = 别再入队（渲染重画会反复路过同一批缺档） */
export function thumbHandled(dstAbs: string): boolean {
  return pendingJobs.has(dstAbs) || inFlight.has(dstAbs) || settledPaths.has(dstAbs);
}

/** 入队一份补齐（fire-and-forget）；串行逐张跑，张间让出主线程——补齐是后台事，不抢 UI */
export function queueThumbBuild(fs: ThumbFs, srcAbs: string, dstAbs: string, onDone?: (ok: boolean) => void): void {
  if (thumbHandled(dstAbs)) return;
  queueFs = fs;
  pendingJobs.set(dstAbs, { src: srcAbs, dst: dstAbs, onDone });
  void runThumbQueue();
}

async function runThumbQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const job = pendingJobs.values().next().value as ThumbJob | undefined;
      if (!job) break;
      pendingJobs.delete(job.dst);
      inFlight.add(job.dst);
      const ok = queueFs ? await ensureThumbFile(queueFs, job.src, job.dst) : false;
      inFlight.delete(job.dst);
      settledPaths.add(job.dst);
      job.onDone?.(ok);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    running = false;
  }
}
