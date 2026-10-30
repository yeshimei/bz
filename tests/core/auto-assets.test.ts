// @vitest-environment jsdom
/**
 * 启动后台自动更新（core/auto-assets.ts）。
 *
 * 2026-10-31 用户拍板改口径：自动更新只跟**插件本体 + 外部工具包**，
 * **在线资源（手册 / 更新日志 / 索引与数据表 / 皮肤）不再自动下**——那些走到才需要，
 * 首启静默拉 10MB 里 9.7MB 是两个索引，慢链还会超时。
 *
 * 这里钉五件事：
 *  1. 开关关着 → 一个字节都不下（它做的是「装」，不是「查」）；
 *  2. **在线资源条目不碰**（清单里有 doc/skin，也不能发请求）——这条是本次改口径的回归点；
 *  3. 工具包缺的 / 过期的补上，已就绪的不重下；
 *  4. 24h 节流（`throttle: false` 是人在场的显式动作，不受限）；
 *  5. 单项失败不牵连其余（失败留给设置面板呈状态，不在启动期弹脸）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { textSha256 } from '../../src/core/sha256';
import { autoUpdateAssets, resetAutoAssetsThrottle } from '../../src/core/auto-assets';
import type { DownloadManifest, ManifestDocEntry } from '../../src/core/download-manifest';

const PLUGIN = '.obsidian/plugins/bz';
const BLOCK = 512;

function octal(value: number, len: number): string {
  return value.toString(8).padStart(len - 1, '0') + '\0';
}

function header(name: string, size: number): Buffer {
  const buf = Buffer.alloc(BLOCK);
  buf.write(name, 0, 100, 'utf8');
  buf.write(octal(0o644, 8), 100, 'ascii');
  buf.write(octal(0, 8), 108, 'ascii');
  buf.write(octal(0, 8), 116, 'ascii');
  buf.write(octal(size, 12), 124, 'ascii');
  buf.write(octal(0, 12), 136, 'ascii');
  buf.write('        ', 148, 'ascii');
  buf.write('0', 156, 'ascii');
  buf.write('ustar', 257, 5, 'ascii');
  buf.write('00', 263, 'ascii');
  let sum = 0;
  for (const b of buf) sum += b;
  buf.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  return buf;
}

/** 造一个 tar.gz（内容 = entries），与 bundle-asset.test 同款，避免再引依赖 */
function makeTgz(entries: Array<{ name: string; body: string }>): Uint8Array {
  const chunks: Buffer[] = [];
  for (const e of entries) {
    const data = Buffer.from(e.body, 'utf8');
    chunks.push(header(e.name, data.length), data);
    const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (pad) chunks.push(Buffer.alloc(pad));
  }
  chunks.push(Buffer.alloc(BLOCK * 2));
  return new Uint8Array(zlib.gzipSync(Buffer.concat(chunks)));
}

/** 只回一个归档的远端；其余一律「离线」（用来断言没有多余的请求） */
function stubRemote(bytes: Uint8Array): string[] {
  const seen: string[] = [];
  vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
    seen.push(url);
    if (url.endsWith('.tar.gz')) {
      return { status: 200, arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    }
    throw new Error('offline');
  }) as never);
  return seen;
}

function bundleEntry(tgz: Uint8Array, over: Partial<ManifestDocEntry> = {}): ManifestDocEntry {
  return {
    id: 'tool-demo',
    name: '演示工具',
    file: 'tools/demo.tar.gz',
    sha256: sha256Of(tgz),
    kind: 'bundle',
    ...over,
  };
}

function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function manifestWith(docs: ManifestDocEntry[]): DownloadManifest {
  return { version: 1, docs, skins: [], rowOrder: docs.map((d) => d.id) };
}

/** 只做「能跑通解包」的最小 app（MockVault 有 adapter.writeBinary / rmdir） */
function appOf(vault: MockVault): unknown {
  return { vault: { adapter: vault.adapter, configDir: '.obsidian' } };
}

beforeEach(() => {
  resetObsidianMocks();
  vi.mocked(requestUrl).mockReset();
  localStorage.clear();
  resetAutoAssetsThrottle();
  // 目录包解压走桌面端的 window.require('zlib')；jsdom 里没有，补一个
  (window as unknown as { require: (m: string) => unknown }).require = (m: string) =>
    m === 'zlib' ? zlib : m === 'buffer' ? { Buffer } : undefined;
});

afterEach(() => {
  delete (window as unknown as { require?: unknown }).require;
});

describe('autoUpdateAssets：开关与范围', () => {
  it('autoUpdate 关着 → 整段跳过，不联网不落盘', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: false }) as never);
    const tgz = makeTgz([{ name: 'cli.js', body: 'console.log(1)' }]);
    const seen = stubRemote(tgz);

    const r = await autoUpdateAssets(appOf(vault), manifestWith([bundleEntry(tgz)]));

    expect(r.skipped).toBe(true);
    expect(seen.length).toBe(0);
  });

  it('在线资源不再自动下：清单里只有 doc/skin → 零请求、零安装', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const seen = stubRemote(new Uint8Array());

    const r = await autoUpdateAssets(
      appOf(vault),
      manifestWith([
        { id: 'manual', name: '使用手册', file: 'bz-manual.html', sha256: textSha256('<html/>'), kind: 'doc' },
        { id: 'douban', name: '豆瓣索引', file: 'cinema-douban-index.json', sha256: textSha256('{}') },
      ]),
      { throttle: false },
    );

    expect(r.skipped).toBe(false);
    expect(r.done).toBe(0);
    expect(r.pending).toBe(0);
    expect(seen.length).toBe(0);
  });

  it('工具包缺的就装上：解包落盘 + 写就绪标记', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const tgz = makeTgz([{ name: 'cli.js', body: 'console.log(1)' }]);
    stubRemote(tgz);

    const r = await autoUpdateAssets(appOf(vault), manifestWith([bundleEntry(tgz)]));

    expect(r.skipped).toBe(false);
    expect(r.done).toBe(1);
    expect(r.failed).toBe(0);
    expect(vault.binaryFiles.has(`${PLUGIN}/downloads/tools/demo/cli.js`)).toBe(true);
    expect(vault.files.has(`${PLUGIN}/downloads/tools/demo/.bz-bundle.json`)).toBe(true);
  });

  it('已就绪的不重下（第二次运行零请求）', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const tgz = makeTgz([{ name: 'cli.js', body: 'console.log(1)' }]);
    stubRemote(tgz);
    const mf = manifestWith([bundleEntry(tgz)]);

    await autoUpdateAssets(appOf(vault), mf, { throttle: false });
    const seen = stubRemote(tgz);
    const again = await autoUpdateAssets(appOf(vault), mf, { throttle: false });

    expect(again.pending).toBe(0);
    expect(again.done).toBe(0);
    expect(seen.length).toBe(0);
  });

  it('24h 节流：第二次被跳过，显式 throttle:false 不受限', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const tgz = makeTgz([{ name: 'cli.js', body: 'console.log(1)' }]);
    stubRemote(tgz);
    const mf = manifestWith([bundleEntry(tgz)]);

    const first = await autoUpdateAssets(appOf(vault), mf);
    expect(first.done).toBe(1);

    // 节流窗内再来一次：不动手
    const second = await autoUpdateAssets(appOf(vault), mf);
    expect(second.skipped).toBe(true);

    // 人在场点「全部更新」等价于 throttle:false
    const third = await autoUpdateAssets(appOf(vault), mf, { throttle: false });
    expect(third.done).toBe(0); // 已就绪，不重下
    expect(third.pending).toBe(0);
  });

  it('单项失败不牵连其余：坏 hash 计数，好包照常落盘', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const good = makeTgz([{ name: 'ok.js', body: 'ok' }]);
    const bad = makeTgz([{ name: 'bad.js', body: 'bad' }]);
    vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
      const pick = url.endsWith('/tools/good.tar.gz') ? good : bad;
      return { status: 200, arrayBuffer: pick.buffer.slice(pick.byteOffset, pick.byteOffset + pick.byteLength) };
    }) as never);

    const r = await autoUpdateAssets(
      appOf(vault),
      manifestWith([
        bundleEntry(good, { id: 'tool-good', name: '好包', file: 'tools/good.tar.gz' }),
        // 声明的 hash 与内容不符 → 拒收
        bundleEntry(bad, { id: 'tool-bad', name: '坏包', file: 'tools/bad.tar.gz', sha256: textSha256('对不上') }),
      ]),
      { throttle: false },
    );

    expect(r.done).toBe(1);
    expect(r.failed).toBe(1);
    expect(vault.binaryFiles.has(`${PLUGIN}/downloads/tools/good/ok.js`)).toBe(true);
    expect(vault.binaryFiles.has(`${PLUGIN}/downloads/tools/bad/bad.js`)).toBe(false);
  });
});
