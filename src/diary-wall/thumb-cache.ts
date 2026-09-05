/**
 * 章节栏小图缓存（issue 212）——病根：20px 小格也 forcing 浏览器整张原图解码，
 * 开墙几十张原图 + 视频首帧同时解码 → 整面板冻结。
 * 方案：首次把原图/视频帧压成 48px 小图存 IndexedDB，之后开墙只贴缓存小图，
 * 零原图解码。压缩走 fetch blob + createImageBitmap（离主线程解码）+ canvas cover 裁剪。
 * 无 IDB / 无 DOM / 跨域污染等一切异常静默降级（返回 null，调用方回退原图路径）。
 */
const DB_NAME = 'bz-diary-wall-thumbs';
const STORE = 'thumbs';
/** 小图边长：格宽 20px × 高分屏 2x 余量 */
export const THUMB_SIZE = 48;

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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

/** 位图/视频帧 → size×size cover 裁剪小图 dataURL；任何失败返回 null */
function drawCover(source: CanvasImageSource, w: number, h: number, size = THUMB_SIZE): string | null {
  try {
    if (typeof document === 'undefined' || !w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const side = Math.min(w, h);
    ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/webp', 0.8) || null;
  } catch {
    return null;
  }
}

/** 原图 URL → 48px 小图 dataURL（离主线程解码，不阻塞 UI） */
export async function makeImageThumb(src: string): Promise<string | null> {
  try {
    const blob = await (await fetch(src)).blob();
    const bmp = await createImageBitmap(blob);
    const url = drawCover(bmp, bmp.width, bmp.height);
    bmp.close();
    return url;
  } catch {
    return null;
  }
}

/** 视频 URL → 首帧 48px 小图 dataURL（blob 中转避免 canvas 污染；8s 超时放弃） */
export async function makeVideoThumb(src: string): Promise<string | null> {
  let objectUrl: string | null = null;
  try {
    const blob = await (await fetch(src)).blob();
    objectUrl = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'metadata';
    v.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 8000);
      v.addEventListener('loadeddata', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      v.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('video'));
      }, { once: true });
    });
    return drawCover(v, v.videoWidth, v.videoHeight);
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
