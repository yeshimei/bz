// @vitest-environment node
/**
 * 留影缩略图管线（issue 519）：descThumbPath 路径映射、ensureThumbFile 落盘口径
 * （已存在跳过 / 源缺与解码失败不写盘）、后台补齐队列（去重 / 串行 / 办结记账 / 取消）。
 * 像素层注入假件，不碰真解码；fs 用内存假件。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  descThumbPath, ensureThumbFile, queueThumbBuild, cancelThumbQueue,
  resetThumbQueueForPanel, thumbHandled, setThumbCompressorForTests, THUMB_DIR,
  type ThumbFs,
} from '../../src/people/thumbs';

/** 内存 fs：文件落在 Map，mkdir 记目录键 */
function memFs(files: Map<string, Uint8Array>): ThumbFs {
  return {
    existsSync: (p) => files.has(p),
    readFileSync: (p) => {
      const hit = files.get(p);
      if (!hit) throw new Error('enoent');
      return hit;
    },
    mkdirSync: (p) => files.set(p, new Uint8Array(0)),
    writeFileSync: (p, d) => files.set(p, d),
  };
}

const PNG = [0x89, 0x50, 0x4e, 0x47] as unknown as Uint8Array;
const WEBP_OUT = new Uint8Array([1, 2, 3]);

beforeEach(() => {
  cancelThumbQueue();
  resetThumbQueueForPanel();
  setThumbCompressorForTests(async (bytes) => (bytes.length ? WEBP_OUT : null));
});

afterEach(() => {
  cancelThumbQueue();
  setThumbCompressorForTests(null);
});

describe('descThumbPath 路径映射', () => {
  it('镜像 desc 子结构、扩展名归一 webp、斜杠归一', () => {
    expect(descThumbPath('D:/数据根', '老王', '2026-09/202609301200_01.jpg'))
      .toBe(`D:/数据根/老王/desc/${THUMB_DIR}/2026-09/202609301200_01.webp`);
    expect(descThumbPath('D:\\数据根', '老王', '2026-09\\a.PNG'))
      .toBe(`D:/数据根/老王/desc/${THUMB_DIR}/2026-09/a.webp`);
  });

  it('无扩展名照补 .webp；不把 desc/thumbs 拼歪', () => {
    expect(descThumbPath('R', 't', '2026-09/noext')).toBe(`R/t/desc/${THUMB_DIR}/2026-09/noext.webp`);
  });
});

describe('ensureThumbFile 落盘口径', () => {
  it('生成成功：建目录 + 写盘', async () => {
    const files = new Map<string, Uint8Array>([['D:/根/t/desc/2026-09/a.jpg', PNG]]);
    const fs = memFs(files);
    const dst = 'D:/根/t/desc/thumbs/2026-09/a.webp';
    await expect(ensureThumbFile(fs, 'D:/根/t/desc/2026-09/a.jpg', dst)).resolves.toBe(true);
    expect([...files.get(dst)!]).toEqual([1, 2, 3]);
  });

  it('已存在直接 true（幂等，不重压缩）', async () => {
    const files = new Map<string, Uint8Array>([
      ['D:/根/t/desc/2026-09/a.jpg', PNG],
      ['D:/根/t/desc/thumbs/2026-09/a.webp', WEBP_OUT],
    ]);
    let called = 0;
    setThumbCompressorForTests(async () => {
      called++;
      return WEBP_OUT;
    });
    await expect(ensureThumbFile(memFs(files), 'D:/根/t/desc/2026-09/a.jpg', 'D:/根/t/desc/thumbs/2026-09/a.webp')).resolves.toBe(true);
    expect(called).toBe(0);
  });

  it('源缺 / 解码失败 / 压缩出空：false 且不写盘', async () => {
    const files = new Map<string, Uint8Array>();
    const fs = memFs(files);
    const dst = 'D:/根/t/desc/thumbs/2026-09/gone.webp';
    await expect(ensureThumbFile(fs, 'D:/根/t/desc/2026-09/gone.jpg', dst)).resolves.toBe(false);
    expect(files.has(dst)).toBe(false);

    setThumbCompressorForTests(async () => null);
    files.set('D:/根/t/desc/2026-09/bad.jpg', PNG);
    await expect(ensureThumbFile(fs, 'D:/根/t/desc/2026-09/bad.jpg', dst)).resolves.toBe(false);
    expect(files.has(dst)).toBe(false);
  });
});

describe('后台补齐队列', () => {
  it('串行完成并回调；同 dst 去重（重画反复路过不重复排队）', async () => {
    const files = new Map<string, Uint8Array>([['src.jpg', PNG]]);
    const fs = memFs(files);
    const done: string[] = [];
    const first = new Promise<void>((res) => queueThumbBuild(fs, 'src.jpg', 'dst.webp', (ok) => { done.push('a'); res(); }));
    queueThumbBuild(fs, 'src.jpg', 'dst.webp', (ok) => { done.push('b'); }); // 同 dst：该回调不该被调
    expect(thumbHandled('dst.webp')).toBe(true);
    await first;
    await new Promise((r) => setTimeout(r, 10)); // 给幽灵第二份留暴露机会
    expect(done).toEqual(['a']);
    expect(files.has('dst.webp')).toBe(true);
  });

  it('办结记账：成败都记，失败不再反复入队；面板重开（reset）给重试机会', async () => {
    const files = new Map<string, Uint8Array>([['src.jpg', PNG]]);
    const fs = memFs(files);
    setThumbCompressorForTests(async () => null); // 必败
    const fail = new Promise<void>((res) => queueThumbBuild(fs, 'src.jpg', 'dst.webp', (ok) => res()));
    await fail;
    let retried = 0;
    queueThumbBuild(fs, 'src.jpg', 'dst.webp', () => { retried++; });
    await new Promise((r) => setTimeout(r, 10));
    expect(retried).toBe(0); // 办结（败）不再排队
    resetThumbQueueForPanel();
    const retry = new Promise<void>((res) => queueThumbBuild(fs, 'src.jpg', 'dst.webp', () => { retried++; res(); }));
    await retry;
    expect(retried).toBe(1); // 重开面板后给重试机会
  });

  it('cancel 清空待处理（关面板停补齐）：没跑到的张不落盘；取消后再入新活照常跑', async () => {
    const files = new Map<string, Uint8Array>([['src.jpg', PNG]]);
    const fs = memFs(files);
    const firstDone = new Promise<void>((res) => queueThumbBuild(fs, 'src.jpg', 'dst1.webp', () => res()));
    queueThumbBuild(fs, 'src.jpg', 'dst2.webp'); // 排第二（Map 保序 = 串行口径）
    await firstDone; // 第一张收工
    cancelThumbQueue(); // 第二张还在队里，被清
    await new Promise((r) => setTimeout(r, 15));
    expect(files.has('dst1.webp')).toBe(true);
    expect(files.has('dst2.webp')).toBe(false);
    const ran = new Promise<void>((res) => queueThumbBuild(fs, 'src.jpg', 'dst2.webp', () => res()));
    await ran; // 取消后入新活照常跑（重开面板口径）
    expect(files.has('dst2.webp')).toBe(true);
  });
});
