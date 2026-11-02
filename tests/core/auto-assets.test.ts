// @vitest-environment jsdom
/**
 * 启动后台自动更新（core/auto-assets.ts）。
 *
 * 2026-11-01 用户拍板改口径：自动更新要覆盖**所有在线资源**，顺序固定为
 *   ① 更新日志 → ② 外部工具包 → ③ 其余在线资源（手册 / 索引与数据表）→ ④ 皮肤
 * 插件本体不在此列（core/self-update.ts 在同一趟启动链里先跑完）。
 *
 * 这里钉四件事：
 *  1. 开关关着 → 一个字节都不下；
 *  2. 缺的资源会补、已就绪的不重下（靠本地 sha256 判断，不产生请求）；
 *  3. 顺序固定：日志先于工具包，工具包先于其余资源；
 *  4. 单项失败不牵连其余（失败留给设置面板呈状态，不在启动期弹脸）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { textSha256 } from '../../src/core/sha256';
import { autoUpdateAssets } from '../../src/core/auto-assets';
import { DOC_VISIBILITY } from '../../src/core/doc-visibility';
import type { DownloadManifest, ManifestDocEntry } from '../../src/core/download-manifest';

const PLUGIN = '.obsidian/plugins/bz';
const BLOCK = 512;
const LOG = '<html>更新日志</html>';
const MANUAL = '<html>使用手册</html>';

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

function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
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

function docEntry(id: string, name: string, file: string, text: string): ManifestDocEntry {
  return { id, name, file, sha256: textSha256(text), kind: 'doc' };
}

function manifestWith(docs: ManifestDocEntry[]): DownloadManifest {
  return { version: 1, docs, skins: [], rowOrder: docs.map((d) => d.id) };
}

/** 只做「能跑通解包」的最小 app（MockVault 有 adapter.writeBinary / rmdir） */
function appOf(vault: MockVault): unknown {
  return { vault: { adapter: vault.adapter, configDir: '.obsidian' } };
}

/**
 * 假远端：归档走 arrayBuffer，文本走 text；`seen` 记录请求顺序（用来断言编排顺序）。
 * 未命中的 URL 一律「离线」（模拟备用通道也不通）。
 */
function stubRemote(tgz: Uint8Array, texts: Record<string, string>): string[] {
  const seen: string[] = [];
  vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
    seen.push(url);
    if (url.endsWith('.tar.gz')) {
      return { status: 200, arrayBuffer: tgz.buffer.slice(tgz.byteOffset, tgz.byteOffset + tgz.byteLength) };
    }
    for (const [file, body] of Object.entries(texts)) {
      if (url.includes(file)) return { status: 200, text: body };
    }
    throw new Error('offline');
  }) as never);
  return seen;
}

beforeEach(() => {
  resetObsidianMocks();
  vi.mocked(requestUrl).mockReset();
  localStorage.clear();
  // 目录包解压走桌面端的 window.require('zlib')；jsdom 里没有，补一个
  (window as unknown as { require: (m: string) => unknown }).require = (m: string) =>
    m === 'zlib' ? zlib : m === 'buffer' ? { Buffer } : undefined;
  // 与「在线资源」组的测试同口径：本文件钉的是启动链的编排与状态机，文档显隐开关默认关
  // （core/doc-visibility）——这里翻回 true，日志/手册照旧进链，「功能还在」有凭据；
  // 关着的行为由文件末尾那一组单独钉。
  DOC_VISIBILITY.changelogInResources = true;
  DOC_VISIBILITY.manualInResources = true;
});

afterEach(() => {
  delete (window as unknown as { require?: unknown }).require;
  DOC_VISIBILITY.changelogInResources = false;
  DOC_VISIBILITY.manualInResources = false;
});

describe('autoUpdateAssets：开关与范围', () => {
  it('autoUpdate 关着 → 整段跳过，不联网不落盘', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: false }) as never);
    const tgz = makeTgz([{ name: 'cli.js', body: 'console.log(1)' }]);
    const seen = stubRemote(tgz, { 'bz-manual.html': MANUAL });

    const r = await autoUpdateAssets(
      appOf(vault),
      manifestWith([bundleEntry(tgz), docEntry('manual', '使用手册', 'bz-manual.html', MANUAL)]),
    );

    expect(r.skipped).toBe(true);
    expect(seen.length).toBe(0);
  });

  it('在线资源（doc）缺的会下——2026-11-01 起不再是「只补工具包」', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    stubRemote(makeTgz([{ name: 'x', body: 'x' }]), { 'bz-manual.html': MANUAL });

    const r = await autoUpdateAssets(
      appOf(vault),
      manifestWith([docEntry('manual', '使用手册', 'bz-manual.html', MANUAL)]),
    );

    expect(r.skipped).toBe(false);
    expect(r.done).toBe(1);
    expect(vault.files.get(`${PLUGIN}/downloads/bz-manual.html`)).toBe(MANUAL);
  });

  it('工具包缺的就装上：解包落盘 + 写就绪标记', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const tgz = makeTgz([{ name: 'cli.js', body: 'console.log(1)' }]);
    stubRemote(tgz, {});

    const r = await autoUpdateAssets(appOf(vault), manifestWith([bundleEntry(tgz)]));

    expect(r.skipped).toBe(false);
    expect(r.done).toBe(1);
    expect(r.failed).toBe(0);
    expect(vault.binaryFiles.has(`${PLUGIN}/downloads/tools/demo/cli.js`)).toBe(true);
    expect(vault.files.has(`${PLUGIN}/downloads/tools/demo/.bz-bundle.json`)).toBe(true);
  });

  it('已就绪的不重下：第二次运行零请求（没有节流，靠本地 hash 判断）', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const tgz = makeTgz([{ name: 'cli.js', body: 'console.log(1)' }]);
    const mf = manifestWith([bundleEntry(tgz), docEntry('manual', '使用手册', 'bz-manual.html', MANUAL)]);

    stubRemote(tgz, { 'bz-manual.html': MANUAL });
    await autoUpdateAssets(appOf(vault), mf);

    const seen = stubRemote(tgz, { 'bz-manual.html': MANUAL });
    const again = await autoUpdateAssets(appOf(vault), mf);

    expect(again.pending).toBe(0);
    expect(again.done).toBe(0);
    expect(seen.length).toBe(0);
  });

  it('顺序固定：更新日志 → 工具包 → 其余在线资源', async () => {
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const tgz = makeTgz([{ name: 'cli.js', body: 'console.log(1)' }]);
    const seen = stubRemote(tgz, { 'bz-changelog.html': LOG, 'bz-manual.html': MANUAL });

    await autoUpdateAssets(
      appOf(vault),
      // 清单顺序故意打乱：编排顺序由代码定，不由清单顺序定
      manifestWith([
        docEntry('manual', '使用手册', 'bz-manual.html', MANUAL),
        bundleEntry(tgz),
        docEntry('changelog', '更新日志', 'bz-changelog.html', LOG),
      ]),
    );

    const at = (needle: string) => seen.findIndex((u) => u.includes(needle));
    expect(at('bz-changelog.html'), '日志要最先').toBeGreaterThanOrEqual(0);
    expect(at('.tar.gz'), '工具包排在日志之后').toBeGreaterThan(at('bz-changelog.html'));
    expect(at('bz-manual.html'), '手册排在工具包之后').toBeGreaterThan(at('.tar.gz'));
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
    );

    expect(r.done).toBe(1);
    expect(r.failed).toBe(1);
    expect(vault.binaryFiles.has(`${PLUGIN}/downloads/tools/good/ok.js`)).toBe(true);
    expect(vault.binaryFiles.has(`${PLUGIN}/downloads/tools/bad/bad.js`)).toBe(false);
  });
});

describe('已隐藏的文档不进启动链（core/doc-visibility，2026-11-02：只隐藏不删）', () => {
  it('开关关（默认）：日志 / 手册一个请求都不发，工具包照下', async () => {
    DOC_VISIBILITY.changelogInResources = false;
    DOC_VISIBILITY.manualInResources = false;
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const tgz = makeTgz([{ name: 'cli.js', body: 'console.log(1)' }]);
    const seen = stubRemote(tgz, { 'bz-changelog.html': LOG, 'bz-manual.html': MANUAL });

    const r = await autoUpdateAssets(
      appOf(vault),
      manifestWith([
        docEntry('changelog', '更新日志', 'bz-changelog.html', LOG),
        docEntry('manual', '使用手册', 'bz-manual.html', MANUAL),
        bundleEntry(tgz),
      ]),
    );

    expect(seen.some((u) => u.includes('bz-changelog.html'))).toBe(false);
    expect(seen.some((u) => u.includes('bz-manual.html'))).toBe(false);
    expect(r.done).toBe(1); // 只有工具包
    expect(vault.binaryFiles.has(`${PLUGIN}/downloads/tools/demo/cli.js`)).toBe(true);
  });

  it('开关翻回 true：顺序照旧 更新日志 → 工具包 → 其余（功能没删）', async () => {
    DOC_VISIBILITY.changelogInResources = true;
    DOC_VISIBILITY.manualInResources = true;
    const vault = new MockVault();
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    const tgz = makeTgz([{ name: 'cli.js', body: 'console.log(1)' }]);
    const seen = stubRemote(tgz, { 'bz-changelog.html': LOG, 'bz-manual.html': MANUAL });

    await autoUpdateAssets(
      appOf(vault),
      manifestWith([
        docEntry('manual', '使用手册', 'bz-manual.html', MANUAL),
        bundleEntry(tgz),
        docEntry('changelog', '更新日志', 'bz-changelog.html', LOG),
      ]),
    );

    const at = (needle: string) => seen.findIndex((u) => u.includes(needle));
    expect(at('bz-changelog.html'), '日志要最先').toBeGreaterThanOrEqual(0);
    expect(at('.tar.gz'), '工具包排在日志之后').toBeGreaterThan(at('bz-changelog.html'));
    expect(at('bz-manual.html'), '手册排在工具包之后').toBeGreaterThan(at('.tar.gz'));
  });
});
