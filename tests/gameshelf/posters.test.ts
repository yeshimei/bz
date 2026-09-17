// @vitest-environment node
/**
 * 海报本地缓存测试（issue 368 增补）：串行队列下载到海报文件夹、幂等去重、
 * 已缓存跳过、显示层本地缺失回落远端 URL。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { ensurePosters, posterDisplayUrl, resolvePosterFolder, DEFAULT_POSTER_FOLDER } from '../../src/gameshelf/posters';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { requestUrl } from 'obsidian';

const vault = new MockVault();
const app = { vault } as any;

function setup() {
  setApp(app);
  setSettingsProvider(() => ({}) as any);
}

beforeEach(() => {
  vault.files.clear();
  vault.binaryFiles.clear();
  vault.dirs.clear();
  (requestUrl as any).mockReset();
});

describe('海报本地缓存', () => {
  it('缺海报入队串行下载 → 落到海报文件夹；重复入队去重', async () => {
    setup();
    (requestUrl as any).mockImplementation(async () => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));
    const items = [{ appid: 1, cover: 'https://cdn/1.jpg' }];
    ensurePosters(app, items);
    ensurePosters(app, items); // 重复调用：pending 去重
    await vi.waitFor(() => {
      expect(vault.binaryFiles.has('CONFIG/游戏海报/1.jpg')).toBe(true);
    });
    expect((requestUrl as any).mock.calls.filter((c: any[]) => String(c[0]?.url).includes('cdn/1.jpg')).length).toBe(1);
  });

  it('本地已有海报 → 不发请求', () => {
    setup();
    vault.binaryFiles.set('CONFIG/游戏海报/2.jpg', new Uint8Array(8));
    ensurePosters(app, [{ appid: 2, cover: 'https://cdn/2.jpg' }]);
    expect((requestUrl as any).mock.calls.length).toBe(0);
  });

  it('显示 URL：本地缺失回落远端；设置未配置时文件夹回落默认', () => {
    setup();
    expect(resolvePosterFolder()).toBe(DEFAULT_POSTER_FOLDER);
    expect(posterDisplayUrl(app, 3, 'https://cdn/3.jpg')).toBe('https://cdn/3.jpg');
    expect(posterDisplayUrl(app, 3, null)).toBe('');
  });
});
