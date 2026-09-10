// @vitest-environment node
/**
 * 章节栏小图缓存（issue 212）——node 环境单测：无 indexedDB / 无 DOM 时全部静默降级，
 * 保证真实环境异常路径（隐私模式/旧内核）不抛错、只回退直挂原图。
 */
import { describe, expect, it } from 'vitest';
import { railThumbKey, getRailThumb, putRailThumb, makeImageThumb, makeVideoThumb, isFlatFrameData, THUMB_SIZE } from '../../src/diary/thumb-cache';

describe('小图缓存模块（无 IDB/无 DOM 降级）', () => {
  it('railThumbKey：日期+媒体名消歧', () => {
    expect(railThumbKey('2026-06-11', 'IMG_1.jpg')).toBe('2026-06-11|IMG_1.jpg');
  });

  it('getRailThumb 无 indexedDB 返回 null 不抛错', async () => {
    await expect(getRailThumb('k')).resolves.toBeNull();
  });

  it('putRailThumb 无 indexedDB 静默成功', async () => {
    await expect(putRailThumb('k', 'data:image/webp;base64,x')).resolves.toBeUndefined();
  });

  it('makeImageThumb 非法 URL 返回 null（回退直挂原图路径）', async () => {
    await expect(makeImageThumb('not-a-url')).resolves.toBeNull();
  });

  it('makeVideoThumb 非 DOM/非法输入返回 null', async () => {
    await expect(makeVideoThumb('not-a-url')).resolves.toBeNull();
  });

  it('THUMB_SIZE = 48（20px 格 × 高分屏 2x 余量）', () => {
    expect(THUMB_SIZE).toBe(48);
  });
});

/**
 * 空帧判定（2026-09-10 修正）——病根回归守卫：旧实现等 `loadeddata` 取视频首帧，
 * 帧未合成到可绘表面，drawImage 得到纯黑并被写进缓存永久命中（章节栏视频格全黑）。
 * 修法之一就是本判据：纯色帧一律判失败 → 不写缓存、不换图。
 */
describe('空帧判定（纯色帧绝不入库）', () => {
  /** 整帧纯色 RGBA 采样数组 */
  const flat = (r: number, g: number, b: number) => {
    const d = new Uint8ClampedArray(48 * 48 * 4);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
    return d;
  };

  it('全黑帧判为纯色（旧 loadeddata 取帧的真实产物）', () => {
    expect(isFlatFrameData(flat(0, 0, 0))).toBe(true);
  });

  it('纯白/纯灰场同样判为纯色（解码异常与过曝同属「无内容」）', () => {
    expect(isFlatFrameData(flat(250, 250, 250))).toBe(true);
    expect(isFlatFrameData(flat(128, 128, 128))).toBe(true);
  });

  it('真实画面判为非纯色（不得误杀）', () => {
    const d = new Uint8ClampedArray(48 * 48 * 4);
    for (let i = 0; i < d.length; i += 4) {
      const v = (i / 4) % 256;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = 255 - v;
      d[i + 3] = 255;
    }
    expect(isFlatFrameData(d)).toBe(false);
  });

  it('等亮度和的色彩变化 → 判为有内容（逐通道判据，不被和值掩盖）', () => {
    // R+G+B 恒为 375：若按和值判就会误杀成空帧
    const d = new Uint8ClampedArray(48 * 48 * 4);
    for (let i = 0; i < d.length; i += 4) {
      const v = (i / 4) % 256;
      d[i] = v;
      d[i + 1] = 255 - v;
      d[i + 2] = 120;
      d[i + 3] = 255;
    }
    expect(isFlatFrameData(d)).toBe(false);
  });

  it('仅个别采样点亮起 → 判为有内容（暗场但有画面不算空帧）', () => {
    const d = new Uint8ClampedArray(48 * 48 * 4);
    d[0] = 250;
    d[1] = 250;
    d[2] = 250;
    d[3] = 255;
    expect(isFlatFrameData(d)).toBe(false);
  });

  it('tolerance 可覆盖（默认 12：每通道极差 12 以内视为纯色）', () => {
    const d = flat(4, 4, 4); // 每通道恒 4 → 极差 0
    expect(isFlatFrameData(d)).toBe(true);
    d[0] = 20; // 单点 R 极差 16 > 12
    expect(isFlatFrameData(d)).toBe(false);
    expect(isFlatFrameData(d, 20)).toBe(true);
  });
});
