/**
 * 章节栏小图缓存（issue 212）——病根：20px 小格也 forcing 浏览器整张原图解码，
 * 开墙几十张原图 + 视频首帧同时解码 → 整面板冻结。
 * 方案：首次把原图/视频帧压成 48px 小图存 IndexedDB，之后开墙只贴缓存小图，
 * 零原图解码。压缩走 fetch blob + createImageBitmap（离主线程解码）+ canvas cover 裁剪。
 * 无 IDB / 无 DOM / 跨域污染等一切异常静默降级（返回 null，调用方回退原图路径）。
 *
 * 2026-09-10 修正（「章节栏视频格全黑」的根因，已实测）：
 * 旧实现取视频首帧等的是 `loadeddata`——该事件只保证「首帧数据已到达」（readyState=2），
 * 帧尚未合成到可绘表面，drawImage 拿到的是 48×48 纯黑，且被原样写进缓存永久命中。
 * 对照实验（同一条真实视频，headless Chromium，canvas 像素极差为判据）：
 *   游离 + metadata + loadeddata（旧实现）→ 极差 0（全黑）
 *   挂载 + metadata + loadeddata           → 极差 0（全黑）
 *   游离 + auto    + canplay               → 极差 653（真帧）
 *   挂载 + auto    + seeked（seek 0.5s）   → 极差 644（真帧）
 *   挂载 + 0 尺寸  + canplay               → 极差 653（真帧）
 * 结论 = 决定变量只有「等的哪个事件」，与是否挂进文档、格子多小无关 → 一律等 `canplay`。
 */
const DB_NAME = 'bz-diary-thumbs-v2';
const LEGACY_DB_NAME = 'bz-diary-thumbs';
const STORE = 'thumbs';
/** 小图边长：格宽 20px × 高分屏 2x 余量 */
export const THUMB_SIZE = 48;

/** 纯色帧判据（单通道极差）：空帧 ≈ 0，真实画面远大于此 */
const FLAT_TOLERANCE = 12;
/** 单条视频 canplay 等待上限 */
const VIDEO_TIMEOUT = 8000;
/** 单次 seek 等待上限 */
const SEEK_TIMEOUT = 3000;
/** 首选 seek 落点上限：避开不少视频「第 0 帧本身就是黑场」的坑 */
const SEEK_MAX = 0.5;
/** blob 中转上限：整片读入是内存炸弹（vault 单条视频可达数百 MB），超限直接放弃缩略图 */
const BLOB_MAX_BYTES = 48 * 1024 * 1024;

/** 直挂 URL 取帧已被证明污染 canvas（真身 app:// 跨源）——本环境后续直接走 blob 中转 */
let directBlocked = false;
let legacyCleaned = false;

type DrawOutcome = { url: string | null; tainted: boolean };
const NO_DRAW: DrawOutcome = { url: null, tainted: false };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no idb'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      cleanLegacyDb();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

/** v1 库里的全黑小图已被本版弃用，开库顺手删掉（占用中/失败一律静默） */
function cleanLegacyDb(): void {
  if (legacyCleaned) return;
  legacyCleaned = true;
  try {
    indexedDB.deleteDatabase(LEGACY_DB_NAME);
  } catch {
    /* 静默：老库残留不影响正确性 */
  }
}

/** 缓存键：日期+媒体名（媒体名全局唯一性不足时叠加日期消歧） */
export function railThumbKey(entryDate: string, mediaName: string): string {
  return `${entryDate}|${mediaName}`;
}

export async function getRailThumb(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function putRailThumb(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(dataUrl, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* 降级：不缓存 */
  }
}

/**
 * 纯色帧判定：解码未就绪时 drawImage 得到纯色画布（典型全黑），这种图一旦入库会
 * 永久命中 → 一律判失败，交调用方走占位，绝不缓存。
 * 判据 = 每个通道各自的极差都在 tolerance 内（逐通道，不用 R+G+B 和值——和值会被
 * 「等亮度和的色彩变化」掩盖，把真有画面的帧误判成空帧）。
 * 入参 = RGBA 采样数组（4 像素取 1，每 16 字节），48px 小图判定绰绰有余。
 */
export function isFlatFrameData(data: ArrayLike<number>, tolerance = FLAT_TOLERANCE): boolean {
  let rMin = 255;
  let rMax = 0;
  let gMin = 255;
  let gMax = 0;
  let bMin = 255;
  let bMax = 0;
  for (let i = 0; i + 2 < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
    if (g < gMin) gMin = g;
    if (g > gMax) gMax = g;
    if (b < bMin) bMin = b;
    if (b > bMax) bMax = b;
    if (rMax - rMin > tolerance || gMax - gMin > tolerance || bMax - bMin > tolerance) return false;
  }
  return true;
}

/** getImageData 在污染画布上抛 SecurityError——故意不吞，由 drawCover 归类为 tainted */
function isFlatFrame(ctx: CanvasRenderingContext2D, size: number): boolean {
  return isFlatFrameData(ctx.getImageData(0, 0, size, size).data);
}

/** 位图/视频帧 → size×size cover 裁剪小图；`url=null` = 取不到可用帧（含纯色空帧），
 *  `tainted=true` = canvas 被跨源污染（调用方需改走 blob 中转） */
function drawCover(source: CanvasImageSource, w: number, h: number, size = THUMB_SIZE): DrawOutcome {
  try {
    if (typeof document === 'undefined' || !w || !h) return NO_DRAW;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return NO_DRAW;
    const side = Math.min(w, h);
    ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    if (isFlatFrame(ctx, size)) return NO_DRAW;
    return { url: canvas.toDataURL('image/webp', 0.8) || null, tainted: false };
  } catch (e) {
    const name = e && typeof e === 'object' ? (e as { name?: string }).name : '';
    return { url: null, tainted: name === 'SecurityError' };
  }
}

/** 原图 URL → 48px 小图 dataURL（离主线程解码，不阻塞 UI） */
export async function makeImageThumb(src: string): Promise<string | null> {
  try {
    const blob = await (await fetch(src)).blob();
    const bmp = await createImageBitmap(blob);
    const { url } = drawCover(bmp, bmp.width, bmp.height);
    bmp.close();
    return url;
  } catch {
    return null;
  }
}

/** 等媒体事件；返回是否命中（超时/error 均 false） */
function waitMediaEvent(el: HTMLMediaElement, event: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const done = (ok: boolean) => {
      clearTimeout(timer);
      el.removeEventListener(event, onHit);
      el.removeEventListener('error', onErr);
      resolve(ok);
    };
    const onHit = () => done(true);
    const onErr = () => done(false);
    timer = setTimeout(() => done(false), ms);
    el.addEventListener(event, onHit, { once: true });
    el.addEventListener('error', onErr, { once: true });
  });
}

/** 取帧落点候选：先抢 0.5s 内（避开开场黑场），仍空帧再往后换点重试 */
function seekPlan(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const plan = [Math.min(SEEK_MAX, duration * 0.1), duration * 0.25, duration * 0.5];
  return [...new Set(plan)].filter((t) => t > 0.05 && t < duration - 0.05);
}

/**
 * 直挂 URL 取帧（浏览器按需流式取，支持 Range，零整片内存占用）。
 * 必须等 `canplay`（readyState≥3：帧已解码可绘制）——旧实现等的 `loadeddata` 实测全黑。
 * 拿到空帧不立刻放弃：沿 seekPlan 换落点再试，很多视频开场本身就是黑场/纯色。
 */
async function frameFromUrl(src: string): Promise<DrawOutcome> {
  if (typeof document === 'undefined') return NO_DRAW;
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = src;
  try {
    if (!(await waitMediaEvent(v, 'canplay', VIDEO_TIMEOUT))) return NO_DRAW;
    const plan = seekPlan(v.duration);
    if (!plan.length) return drawCover(v, v.videoWidth, v.videoHeight);
    for (const t of plan) {
      v.currentTime = t;
      await waitMediaEvent(v, 'seeked', SEEK_TIMEOUT);
      const r = drawCover(v, v.videoWidth, v.videoHeight);
      if (r.url || r.tainted) return r; // 真帧到手（或已判跨源污染）即收工
    }
    return NO_DRAW;
  } catch {
    return NO_DRAW;
  } finally {
    // 立即断流：20px 格不值得继续缓冲
    v.removeAttribute('src');
    try {
      v.load();
    } catch {
      /* 静默 */
    }
  }
}

/** blob 中转取帧：同源 blob: 不污染 canvas，代价是整片读入 → 有体积上限 */
async function frameFromBlob(src: string): Promise<DrawOutcome> {
  let objectUrl: string | null = null;
  try {
    const res = await fetch(src);
    const declared = Number(res.headers?.get?.('content-length') || 0);
    if (declared > BLOB_MAX_BYTES) return NO_DRAW;
    const blob = await res.blob();
    if (blob.size > BLOB_MAX_BYTES) return NO_DRAW;
    objectUrl = URL.createObjectURL(blob);
    return await frameFromUrl(objectUrl);
  } catch {
    return NO_DRAW;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 视频 URL → 首帧 48px 小图 dataURL；取不到可用帧返回 null（调用方走占位，不缓存）。
 * 路径：先直挂 URL 取帧（流式、零额外内存）；若 canvas 被跨源污染（真身 app://）则记入
 * directBlocked，本环境后续一律走 blob 中转（同源，代价受 BLOB_MAX_BYTES 约束）。
 */
export async function makeVideoThumb(src: string): Promise<string | null> {
  if (!directBlocked) {
    const r = await frameFromUrl(src);
    if (r.url) return r.url;
    if (!r.tainted) return null; // 真·取不到帧（空帧/超时）：不缓存，交调用方占位
    directBlocked = true;
  }
  return (await frameFromBlob(src)).url;
}
