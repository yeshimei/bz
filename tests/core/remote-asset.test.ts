// @vitest-environment jsdom
/**
 * 远端资产取文本（core/remote-asset.ts）：通道怎么试。
 *
 * 钉住 2026-10-28 那次报障的根因——**串行 + 无单通道超时**：raw 一旦卡住，
 * 调用方（`fetchManifestWithTimeout` 只等 12 s）就把整件事判成「资源清单没拉到」，
 * 后面几条本来能用的通道根本没被试到。所以：
 *  1. 清单这类小文件**并发**试，谁先通过校验用谁；
 *  2. 非 2xx 要把响应体带出来（4xx 的正文常常才是真原因，不是「网络不通」）；
 *  3. 成功过的通道记下来，下次排到队首。
 *
 * 注：2026-11-02 起通道链是 GitHub Release → 码云 Release → 码云 raw，jsDelivr 已整条退场。
 * 这里的「多跳」用 tag 已知时的三条来验（Release 两条 + raw 静态兜底）；分发仓退役后
 * html 资产不再有 gh-proxy 反代，所以不再拿它当多跳样本。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import {
  fetchAssetText,
  noteReleaseTag,
  remotesFor,
  resetChannelPreferenceForTests,
  resetReleaseTagForTests,
} from '../../src/core/remote-asset';
import { setSettingsProvider } from '../../src/core/settings-provider';

/** 一个最小的「通道应答」：按 URL 分派 */
function route(handler: (url: string) => { status: number; text: string } | Promise<never>): void {
  vi.mocked(requestUrl).mockImplementation(((opts: { url: string }) => {
    const r = handler(opts.url);
    return r instanceof Promise ? r : Promise.resolve(r);
  }) as never);
}

const ok = (text: string) => ({ status: 200, text });
const delay = (ms: number): Promise<never> => new Promise((_, reject) => setTimeout(() => reject(new Error('ERR_CONNECTION_RESET')), ms));

describe('fetchAssetText：通道选择', () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
    resetChannelPreferenceForTests();
    // tag 已知 → 通道链三条：GitHub Release / 码云 Release / 码云 raw 静态兜底。
    // 不给 tag 只有 raw 一条，测不出「多通道怎么选」。
    resetReleaseTagForTests();
    noteReleaseTag('v1.39.3');
  });

  it('并发模式：队首卡住/慢死，后面通道的内容照样先到位', async () => {
    // raw 兜底那条慢死，两条 Release 立刻给内容——「不等最慢的那条」
    route((url) => (url.includes('/raw/') ? delay(80) : ok('LIST')));
    const t0 = Date.now();
    const text = await fetchAssetText('manual.html', (t) => t === 'LIST', '使用手册', '页', undefined, {
      concurrent: true,
    });
    expect(text).toBe('LIST');
    // 没等第一条（80 ms）就回来了：并发不是「排队等最慢的」
    expect(Date.now() - t0).toBeLessThan(70);
  });

  it('串行模式（下载正文）：某条失败后换下一条，不整份放弃', async () => {
    route((url) => (url.includes('/raw/') ? { status: 500, text: '' } : ok('DOC')));
    const text = await fetchAssetText('manual.html', (t) => t === 'DOC', '使用手册', '页');
    expect(text).toBe('DOC');
  });

  it('内容校验不过 → 换下一条（不把 CDN 的错误页当正文）', async () => {
    route((url) => (url.includes('/raw/') ? ok('<html>404</html>') : ok('DOC')));
    const text = await fetchAssetText('manual.html', (t) => t === 'DOC', '使用手册', '页');
    expect(text).toBe('DOC');
  });

  it('4xx 把响应体带出来：是「通道那边说清了原因」，不是一句「网络不通」', async () => {
    route((url) =>
      url.includes('/raw/')
        ? { status: 403, text: 'rate limited: too many requests' }
        : { status: 502, text: '' },
    );
    await expect(
      fetchAssetText('manual.html', () => true, '使用手册', '页', undefined, { concurrent: true }),
    ).rejects.toThrow(/HTTP 403 · rate limited/);
  });

  it('成功过的通道排到队首（下次不再先撞死的那条）', async () => {
    // 静态通道默认只剩码云 raw 一条，排不出序；临时加一条用户镜像当「先撞死的那条」
    setSettingsProvider(() => ({ resourceMirror: 'https://mirror.example.com' }) as any);
    try {
      route((url) => (url.includes('mirror.example.com') ? { status: 500, text: '' } : ok('DOC')));
      await fetchAssetText('manifest.json', (t) => t === 'DOC', '下载清单', '', undefined, { concurrent: true });
      expect(remotesFor('manifest.json')[0]).toContain('gitee.com');
      expect(remotesFor('manifest.json')[0]).not.toContain('mirror.example.com');
    } finally {
      setSettingsProvider(() => ({}) as any);
    }
  });

  it('全失败 → 错误里带每一条的原因（主机名 + 原因，不糊整串 URL）', async () => {
    route(() => ({ status: 403, text: 'blocked' }));
    await expect(
      fetchAssetText('manifest.json', () => true, '下载清单', '', undefined, { concurrent: true }),
    ).rejects.toThrow(/下载清单下载失败：.*gitee\.com/);
  });
});
