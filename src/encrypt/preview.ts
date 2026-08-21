/**
 * 保险箱预览层生成（encrypt 域，preview）
 * 图片：canvas 缩放压缩（体积小但看得清）；视频：抽帧成图（零外部依赖，用户拍板）。
 * 依赖 document/canvas——仅 UI 层调用；环境不支持（jsdom 无 canvas 实现）时返回 null，
 * 调用方据此跳过预览层（hasPreview=false）。产物为 dataURL(base64)，再经数据层加密入库。
 *
 * 稳定性铁律：预览生成是可选增强，**永不阻塞加密主流程**。
 * 空 src / 资源不可加载 / 加载或抽帧超时（onload/onloadedmetadata/onseeked 永不触发）
 * 一律超时返回 null，由调用方跳过预览层，绝不陷入"无限循环"（挂起/假死）。
 */
export interface CompressResult {
  dataUrl: string;
  width: number;
  height: number;
}

/** 预览单步超时上限（ms）——超时按失败处理，避免资源加载永久挂起 */
export const PREVIEW_TIMEOUT_MS = 5000;

/**
 * 省略图默认档（作为 compressImage/videoFrame 默认参数；实际取值由保险箱设置
 * 「预览目标长边/预览质量」注入——用户可调，无需改代码）。
 * 长边 384 / JPEG 质量 0.5：手机预览清晰、体积小；要看清就点击缩略图按需加载原始质量。
 */
export const PREVIEW_OMIT_SIZE = 384;
export const PREVIEW_OMIT_QUALITY = 0.5;

/** 能否用 canvas（jsdom/node 无实现时 false） */
function canvasAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext && !!c.getContext('2d');
  } catch (e) {
    return false;
  }
}

/**
 * 用超时 + 空值保护包裹 Union 事件 Promise：
 * - src 为空 → 直接 reject（绝不等 onload/onerror 永不触发）
 * - 超过 timeout 仍未触发目标事件 → reject（超时按失败，返回 null 由调用方跳过）
 */
export function withTimeout(promise: Promise<void>, timeoutMs: number, label: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label + ' 超时')), timeoutMs);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** 空/无效 src 快捷返回 null（不进入加载，避免挂起） */
function isEmptySrc(src: string): boolean {
  return !src || !src.trim();
}

/**
 * 压缩图片：把 dataURL / URL 加载为 Image → 按目标长边缩放 → 输出 JPEG dataURL。
 * 固定省略图档（PREVIEW_OMIT_SIZE/PREVIEW_OMIT_QUALITY，无设置项）——
 * 预览窗只展示省略图，点击缩略图才按需加载原始质量（loadOriginal），故预览层越小打开越快。
 * 加载失败或超时返回 null（由调用方跳过预览层）。
 */
export async function compressImage(src: string, maxSize = PREVIEW_OMIT_SIZE, quality = PREVIEW_OMIT_QUALITY): Promise<CompressResult | null> {
  if (!canvasAvailable() || isEmptySrc(src)) return null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
  try {
    await withTimeout(loaded, PREVIEW_TIMEOUT_MS, '图片加载');
  } catch (e) {
    return null;
  }
  if (!img.naturalWidth || !img.naturalHeight) return null;
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { dataUrl, width: w, height: h };
}

/**
 * 视频抽帧：加载 video 元素 → 定位到 ~0.1s 关键帧 → 绘制到 canvas 输出首帧图 dataURL。
 * 仅抽一帧（用户拍板，不重编码短视频），固定省略图档与图片一致。
 * 加载/抽帧失败或超时返回 null。
 */
export async function videoFrame(src: string, maxSize = PREVIEW_OMIT_SIZE, quality = PREVIEW_OMIT_QUALITY): Promise<CompressResult | null> {
  if (!canvasAvailable() || !document.createElement('video') || isEmptySrc(src)) return null;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  const meta = new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('视频加载失败'));
    video.src = src;
  });
  try {
    await withTimeout(meta, PREVIEW_TIMEOUT_MS, '视频元数据加载');
  } catch (e) {
    return null;
  }
  // 等元数据就绪后定位一帧
  const seek = new Promise<void>((resolve, reject) => {
    const t = video.duration ? Math.min(0.1, video.duration / 2) : 0.1;
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error('视频抽帧失败'));
    try {
      video.currentTime = t;
    } catch (e) {
      resolve();
    }
  });
  try {
    await withTimeout(seek, PREVIEW_TIMEOUT_MS, '视频抽帧');
  } catch (e) {
    return null;
  }
  const vw = video.videoWidth || 0;
  const vh = video.videoHeight || 0;
  if (!vw || !vh) return null;
  const scale = Math.min(1, maxSize / Math.max(vw, vh));
  const w = Math.max(1, Math.round(vw * scale));
  const h = Math.max(1, Math.round(vh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { dataUrl, width: w, height: h };
}
