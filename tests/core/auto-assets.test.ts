// @vitest-environment jsdom
/**
 * 启动后台自动更新（core/auto-assets.ts）。
 *
 * 2026-10-30 用户拍板：设置里「自动更新」缺省打开，且打开后**不只更新插件本体**——
 * 在线资源（文档 / 数据表 / 皮肤）与三个外部工具包也要跟着下。这里钉四件事：
 *  1. 开关关着 → 一个字节都不下（它做的是「装」，不是「查」）；
 *  2. 开关打开 → 缺的 / 过期的都补上，已就绪的不重下；
 *  3. 24h 节流（`throttle: false` 是人在场的显式动作，不受限）；
 *  4. 单项失败不牵连其余（失败留给设置面板呈状态，不在启动期弹脸）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { textSha256 } from '../../src/core/sha256';
import { autoUpdateAssets, resetAutoAssetsThrottle } from '../../src/core/auto-assets';
import type { DownloadManifest } from '../../src/core/download-manifest';

const PLUGIN = '.obsidian/plugins/bz';

function app(): { vault: MockVault } {
  const vault = new MockVault();
  vault.files.set(`${PLUGIN}/manifest.json`, JSON.stringify({ id: 'bz', version: '1.35.0' }));
  return { vault };
}

function manifestWith(text: string): DownloadManifest {
  return {
    version: 1,
    docs: [
      { id: 'manual', name: '使用手册', file: 'bz-manual.html', sha256: textSha256(text) },
    ],
    skins: [],
    rowOrder: ['manual'],
  };
}

/** 只回一个文档的远端；其余一律「离线」（用来断言没有多余的请求） */
function stubRemote(text: string): string[] {
  const seen: string[] = [];
  vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
    seen.push(url);
    if (url.endsWith('/bz-manual.html')) return { status: 200, text };
    throw new Error('offline');
  }) as never);
  return seen;
}

beforeEach(() => {
  resetObsidianMocks();
  vi.mocked(requestUrl).mockReset();
  localStorage.clear();
  resetAutoAssetsThrottle();
});

describe('autoUpdateAssets：开关语义', () => {
  it('autoUpdate 关着 → 整段跳过，不联网不落盘', async () => {
    const a = app();
    setSettingsProvider(() => ({ autoUpdate: false }) as never);
    const seen = stubRemote('<html>新手册</html>');

    const r = await autoUpdateAssets(a, manifestWith('<html>新手册</html>'));

    expect(r.skipped).toBe(true);
    expect(seen.length).toBe(0);
    expect(a.vault.files.has(`${PLUGIN}/downloads/bz-manual.html`)).toBe(false);
  });

  it('autoUpdate 打开 → 缺的资源下下来，落盘且过 sha256 校验', async () => {
    const a = app();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    stubRemote('<html>新手册</html>');

    const r = await autoUpdateAssets(a, manifestWith('<html>新手册</html>'));

    expect(r.skipped).toBe(false);
    expect(r.done).toBe(1);
    expect(r.failed).toBe(0);
    expect(a.vault.files.get(`${PLUGIN}/downloads/bz-manual.html`)).toBe('<html>新手册</html>');
  });

  it('已就绪的不重下（第二次运行零请求）', async () => {
    const a = app();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    a.vault.files.set(`${PLUGIN}/downloads/bz-manual.html`, '<html>新手册</html>');
    const seen = stubRemote('<html>新手册</html>');

    const r = await autoUpdateAssets(a, manifestWith('<html>新手册</html>'), { throttle: false });

    expect(r.pending).toBe(0);
    expect(r.done).toBe(0);
    expect(seen.length).toBe(0);
  });

  it('24h 节流：第二次被跳过，显式 throttle:false 不受限', async () => {
    const a = app();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    a.vault.files.set(`${PLUGIN}/downloads/bz-manual.html`, '旧内容');
    stubRemote('<html>新手册</html>');
    const mf = manifestWith('<html>新手册</html>');

    const first = await autoUpdateAssets(a, mf);
    expect(first.done).toBe(1);
    // 把盘上改回旧的（模拟「又有更新」），节流窗内不该再动手
    a.vault.files.set(`${PLUGIN}/downloads/bz-manual.html`, '旧内容');
    const second = await autoUpdateAssets(a, mf);
    expect(second.skipped).toBe(true);
    expect(a.vault.files.get(`${PLUGIN}/downloads/bz-manual.html`)).toBe('旧内容');
    // 人在场点「全部更新」等价于 throttle:false
    const third = await autoUpdateAssets(a, mf, { throttle: false });
    expect(third.done).toBe(1);
    expect(a.vault.files.get(`${PLUGIN}/downloads/bz-manual.html`)).toBe('<html>新手册</html>');
  });

  it('单项失败不牵连其余：坏项计数，好项照常落盘', async () => {
    const a = app();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const good = '手册正文';
    const bad = '期刊正文';
    vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
      if (url.endsWith('/bz-manual.html')) return { status: 200, text: good };
      if (url.endsWith('/bz-changelog.html')) return { status: 200, text: '被篡改的内容' };
      throw new Error('offline');
    }) as never);

    const mf: DownloadManifest = {
      version: 1,
      docs: [
        { id: 'manual', name: '使用手册', file: 'bz-manual.html', sha256: textSha256(good) },
        { id: 'changelog', name: '更新日志', file: 'bz-changelog.html', sha256: textSha256(bad) },
      ],
      skins: [],
      rowOrder: ['manual', 'changelog'],
    };

    const r = await autoUpdateAssets(a, mf, { throttle: false });

    expect(r.done).toBe(1);
    expect(r.failed).toBe(1);
    expect(a.vault.files.get(`${PLUGIN}/downloads/bz-manual.html`)).toBe(good);
    // hash 对不上的内容绝不落盘
    expect(a.vault.files.has(`${PLUGIN}/downloads/bz-changelog.html`)).toBe(false);
  });
});
