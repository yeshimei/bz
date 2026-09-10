// @vitest-environment node
/**
 * 章节栏小图缓存（issue 212）——node 环境单测：无 indexedDB / 无 DOM 时全部静默降级，
 * 保证真实环境异常路径（隐私模式/旧内核）不抛错、只回退直挂原图。
 */
import { describe, expect, it } from 'vitest';
import { railThumbKey, getRailThumb, putRailThumb, makeImageThumb, makeVideoThumb, THUMB_SIZE } from '../../src/diary/thumb-cache';

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
