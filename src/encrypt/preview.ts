/**
 * 加密保险箱预览层生成（encrypt 域，preview）
 * 图片：canvas 缩放压缩（体积小但看得清）；视频：抽帧成图（零外部依赖，用户拍板）。
 * 依赖 document/canvas——仅 UI 层调用；环境不支持（jsdom 无 canvas 实现）时返回 null，
 * 调用方据此跳过预览层（hasPreview=false）。产物为 dataURL(base64)，再经数据层加密入库。
 */
export interface CompressResult {
  dataUrl: string;
  width: number;
  height: number;
}

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
 * 压缩图片：把 dataURL / URL 加载为 Image → 按目标长边缩放 → 输出 JPEG/WebP dataURL。
 * @param src 图片 dataURL 或 object URL 或 http(s) 链接
 * @param maxSize 目标长边像素（默认 960）
 * @param quality 0-1 JPEG 质量（默认 0.7）
 */
export async function compressImage(src: string, maxSize = 960, quality = 0.7): Promise<CompressResult | null> {
  if (!canvasAvailable()) return null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
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
 * 仅抽一帧（用户拍板，不重编码短视频）。
 * @param src 视频 URL 或 object URL
 * @param maxSize 目标长边像素（默认 960）
 * @param quality JPEG 质量（默认 0.7）
 */
export async function videoFrame(src: string, maxSize = 960, quality = 0.7): Promise<CompressResult | null> {
  if (!canvasAvailable() || !document.createElement('video')) return null;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('视频加载失败'));
    video.src = src;
  });
  // 等元数据就绪后定位一帧
  await new Promise<void>((resolve, reject) => {
    const t = video.duration ? Math.min(0.1, video.duration / 2) : 0.1;
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error('视频抽帧失败'));
    try {
      video.currentTime = t;
    } catch (e) {
      resolve();
    }
  });
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