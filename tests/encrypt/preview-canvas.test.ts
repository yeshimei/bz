/**
 * 保险箱预览层生成补充覆盖：canvas/Image/video 替身下的成功与失败路径
 * （挂起回归防护主路径见 preview.test.ts；本文件补齐绘制产物、缩放与各失败分支）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  compressImage,
  videoFrame,
  withTimeout,
  PREVIEW_TIMEOUT_MS,
  PREVIEW_OMIT_SIZE,
  PREVIEW_OMIT_QUALITY,
} from '../../src/encrypt/preview';

type ImageBehavior = 'load' | 'error' | 'hang';

let imageBehavior: ImageBehavior = 'load';
let imgW = 800;
let imgH = 600;
const dataUrlCalls: any[][] = [];
let currentVideo: any = null;

class FakeImage {
  crossOrigin = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = imgW;
  naturalHeight = imgH;
  set src(_v: string) {
    const b = imageBehavior;
    const self = this;
    queueMicrotask(() => {
      if (b === 'load') self.onload?.();
      else if (b === 'error') self.onerror?.();
      // hang：永不触发，走超时分支
    });
  }
}

function makeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: (t: string) => (t === '2d' ? { drawImage: vi.fn() } : null),
    toDataURL: (...args: any[]) => {
      dataUrlCalls.push(args);
      return 'data:image/jpeg;base64,ZmFrZQ==';
    },
  } as any;
}

interface VideoOpts {
  metaFail?: boolean;
  duration?: number;
  vw?: number;
  vh?: number;
  throwOnCurrentTime?: boolean;
  neverSeeked?: boolean;
}
function makeVideo(opts: VideoOpts = {}) {
  const v: any = {
    muted: false,
    playsInline: false,
    preload: '',
    duration: opts.duration ?? 10,
    videoWidth: opts.vw ?? 1280,
    videoHeight: opts.vh ?? 720,
    onloadedmetadata: null,
    onerror: null,
    onseeked: null,
  };
  let ct = 0;
  Object.defineProperty(v, 'src', {
    configurable: true,
    set(_s: string) {
      queueMicrotask(() => (opts.metaFail ? v.onerror?.() : v.onloadedmetadata?.()));
    },
    get() {
      return '';
    },
  });
  Object.defineProperty(v, 'currentTime', {
    configurable: true,
    set(t: number) {
      if (opts.throwOnCurrentTime) throw new Error('setCurrentTime failed');
      ct = t;
      if (!opts.neverSeeked) queueMicrotask(() => v.onseeked?.());
    },
    get() {
      return ct;
    },
  });
  return v;
}

beforeEach(() => {
  imageBehavior = 'load';
  imgW = 800;
  imgH = 600;
  dataUrlCalls.length = 0;
  currentVideo = null;
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'canvas') return makeCanvas();
    if (tag === 'video') return currentVideo ?? makeVideo();
    return realCreate(tag);
  }) as any);
  vi.stubGlobal('Image', FakeImage as any);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('常量档位', () => {
  it('省略图默认档：长边 384 / JPEG 质量 0.5 / 超时 5s', () => {
    expect(PREVIEW_OMIT_SIZE).toBe(384);
    expect(PREVIEW_OMIT_QUALITY).toBe(0.5);
    expect(PREVIEW_TIMEOUT_MS).toBe(5000);
  });
});

describe('compressImage 成功路径', () => {
  it('按省略图档缩放（800×600 → 384 长边）并输出 JPEG dataURL', async () => {
    const r = await compressImage('blob:img');
    expect(r).toEqual({
      dataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      width: 384,
      height: 288,
    });
    expect(dataUrlCalls[0]).toEqual(['image/jpeg', PREVIEW_OMIT_QUALITY]);
  });

  it('自定义 maxSize/quality 生效（400 长边 / 质量 0.9）', async () => {
    const r = await compressImage('blob:img', 400, 0.9);
    expect(r).toEqual({ dataUrl: expect.any(String), width: 400, height: 300 });
    expect(dataUrlCalls[0]).toEqual(['image/jpeg', 0.9]);
  });

  it('小于目标长边不放大（scale 钳位 ≤1）', async () => {
    imgW = 200;
    imgH = 100;
    const r = await compressImage('blob:img');
    expect(r).toEqual({ dataUrl: expect.any(String), width: 200, height: 100 });
  });
});

describe('compressImage 失败路径', () => {
  it('图片 onerror → null（不抛出）', async () => {
    imageBehavior = 'error';
    expect(await compressImage('bad-src')).toBeNull();
  });

  it('naturalWidth=0（未解码）→ null', async () => {
    imgW = 0;
    expect(await compressImage('blob:empty')).toBeNull();
  });

  it('加载超时 → null（绝不挂起）', async () => {
    imageBehavior = 'hang';
    vi.useFakeTimers();
    const p = compressImage('blob:slow');
    await vi.advanceTimersByTimeAsync(PREVIEW_TIMEOUT_MS + 10);
    expect(await p).toBeNull();
  });
});

describe('videoFrame 成功路径', () => {
  it('元数据就绪 → 定位 0.1s 关键帧 → 输出缩放首帧图', async () => {
    currentVideo = makeVideo(); // 1280×720，duration 10
    const r = await videoFrame('blob:video');
    expect(r).toEqual({
      dataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      width: 384,
      height: 216,
    });
    expect(currentVideo.currentTime).toBeCloseTo(0.1, 10);
  });

  it('短视频定位点取 duration/2（duration=0.12 → 0.06）', async () => {
    currentVideo = makeVideo({ duration: 0.12 });
    const r = await videoFrame('blob:short');
    expect(r).not.toBeNull();
    expect(currentVideo.currentTime).toBeCloseTo(0.06, 10);
  });

  it('currentTime 赋值抛错 → 兜底 resolve 继续（仍产出首帧）', async () => {
    currentVideo = makeVideo({ throwOnCurrentTime: true });
    const r = await videoFrame('blob:weird');
    expect(r).not.toBeNull();
    expect(r!.width).toBe(384);
  });
});

describe('videoFrame 失败路径', () => {
  it('视频元数据 onerror → null', async () => {
    currentVideo = makeVideo({ metaFail: true });
    expect(await videoFrame('bad-video')).toBeNull();
  });

  it('videoWidth/videoHeight 为 0 → null（无有效帧）', async () => {
    currentVideo = makeVideo({ vw: 0, vh: 0 });
    expect(await videoFrame('blob:no-dims')).toBeNull();
  });

  it('抽帧阶段超时（onseeked 永不触发）→ null', async () => {
    currentVideo = makeVideo({ neverSeeked: true });
    vi.useFakeTimers();
    const p = videoFrame('blob:slow-seek');
    await vi.advanceTimersByTimeAsync(PREVIEW_TIMEOUT_MS * 2 + 10);
    expect(await p).toBeNull();
  });
});

describe('withTimeout 提前失败', () => {
  it('被包裹的 Promise 先 reject → 原样透传错误并清计时器', async () => {
    const boom = new Error('提前失败');
    await expect(withTimeout(Promise.reject(boom), PREVIEW_TIMEOUT_MS, '资源')).rejects.toBe(boom);
  });
});
