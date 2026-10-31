// @vitest-environment jsdom
/**
 * 皮肤整包快路（2026-10-31）测试。
 *
 * 钉住四件事：
 *  1. 产物自洽：仓库里真实的 downloads/skins.zip 能被 core/zip.ts 读出，解出的每个 css
 *     与真实 downloads/manifest.json 的 skins[] sha256 逐条一致（发布链「zip 与清单同版」的硬证据）；
 *  2. 整包快路：清单带 skinsPack 时，一次下载覆盖全部待办，落盘 + 注入与逐文件口径一致；
 *  3. 整包与清单不同版（sha 不符）→ 整体回落逐文件下载，**不写半套文件**；
 *  4. 整包缺条目 → 同样整体回落。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from './../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { crc32, extractZipEntry, readZipEntries, type ZipEntry } from '../../src/core/zip';
import { textSha256 } from '../../src/core/sha256';
import { parseDownloadManifest } from '../../src/core/download-manifest';
import { downloadSkinUpdates, injectedSkinPackCss, resetSkinPackState } from '../../src/core/skin-pack';
import { noteReleaseTag, resetChannelPreferenceForTests, resetReleaseTagForTests } from '../../src/core/remote-asset';
import type { DownloadManifest, SkinPackEntry } from '../../src/core/download-manifest';

const require = createRequire(import.meta.url);
const zlib = require('node:zlib') as typeof import('node:zlib');

/** 扁平资产名：GitHub 网页/API 允许带斜杠的资产名，但 `gh release upload` **只取 basename**
 *  造不出来——所以上传侧按 `/` → `-` 扁平化，`downloads/skins.zip` 的资产名是
 *  `downloads-skins.zip`；客户端侧同口径，见 `remote-base.releaseDownloadUrl`。
 *  （此前这里 mock 的是带斜杠形态，于是整包快路在单测里一直「成功」，
 *  掩盖了上传侧的对不上——review #1。） */
const releaseZipUrl = (tag: string) => `https://github.com/yeshimei/bz/releases/download/${tag}/downloads-skins.zip`;
const MANIFEST_PATH = '.obsidian/plugins/bz/manifest.json';

const appOf = (vault: MockVault) => ({ vault, workspace: {} }) as any;

/* ---------- 测试用 zip 写入器（store 模式，够用即可；产出可被 core/zip.ts 读回） ---------- */

function u16(v: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, v, true);
  return b;
}
function u32(v: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v >>> 0, true);
  return b;
}
function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
const encoder = new TextEncoder();

/** 极简 zip 写入（store）；paths → 文本内容 */
function buildZip(files: Array<{ name: string; text: string }>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const { name, text } of files) {
    const data = encoder.encode(text);
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes,
    ]);
    chunks.push(local, data);
    central.push(
      concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
      ]),
    );
    offset += local.length + data.length;
  }
  const cd = concat(central);
  chunks.push(
    cd,
    concat([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(cd.length), u32(offset), u16(0),
    ]),
  );
  return concat(chunks);
}

/** requestUrl 桩：文本与二进制都支持（requestBytes 读 arrayBuffer） */
function routeFetch(map: Record<string, string | Uint8Array | Error>): void {
  vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
    const hit = map[req.url];
    console.log('[routeFetch]', hit === undefined ? 'MISS' : 'HIT ', req.url);
    if (hit === undefined) throw new Error('unmocked url: ' + req.url);
    if (hit instanceof Error) throw hit;
    if (hit instanceof Uint8Array) {
      const ab = hit.buffer.slice(hit.byteOffset, hit.byteOffset + hit.byteLength) as ArrayBuffer;
      return { status: 200, arrayBuffer: ab, text: '' } as any;
    }
    return { status: 200, text: hit } as any;
  }) as any);
}

/* ---------- 夹具 ---------- */

const CSS_A = '/* noir */\n.bz-bs-skin-noir { --bz-brand: #d9b45f; }\n';
const CSS_B = '/* kraft */\n.bz-bs-skin-kraft { --bz-brand: #8a6a3e; }\n';

function skinOf(id: string, text: string): SkinPackEntry {
  return {
    id,
    domain: 'bookshelf',
    name: id,
    file: `skins/bookshelf/${id}.css`,
    sha256: textSha256(text),
    size: encoder.encode(text).length,
  };
}

function manifestWithPack(skins: SkinPackEntry[], zipBytes: Uint8Array, file = 'skins.zip'): DownloadManifest {
  return {
    version: 1,
    docs: [],
    skins,
    skinsPack: {
      file,
      sha256: require('node:crypto').createHash('sha256').update(zipBytes).digest('hex'),
      size: zipBytes.length,
    },
  };
}

function newVault(): MockVault {
  const v = new MockVault();
  v.files.set(MANIFEST_PATH, JSON.stringify({ id: 'bz', version: '1.0.0' }));
  return v;
}

beforeEach(() => {
  resetObsidianMocks();
  resetSkinPackState();
  resetChannelPreferenceForTests();
  resetReleaseTagForTests();
  vi.mocked(requestUrl).mockReset();
});

describe('皮肤整包快路', () => {
  it('整包成功：一次下载覆盖全部待办，落盘 + 注入', async () => {
    const zip = buildZip([
      { name: 'skins/bookshelf/noir.css', text: CSS_A },
      { name: 'skins/bookshelf/kraft.css', text: CSS_B },
    ]);
    const manifest = manifestWithPack([skinOf('noir', CSS_A), skinOf('kraft', CSS_B)], zip);
    noteReleaseTag('v1.0.0');
    routeFetch({
      [releaseZipUrl('v1.0.0')]: zip,
    });
    const vault = newVault();

    const result = await downloadSkinUpdates(appOf(vault), manifest);

    expect(result).toEqual({ downloaded: 2, failed: 0 });
    expect(vault.files.get('.obsidian/plugins/bz/downloads/skins/bookshelf/noir.css')).toBe(CSS_A);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/skins/bookshelf/kraft.css')).toBe(CSS_B);
    expect(injectedSkinPackCss()).toContain('.bz-bs-skin-noir');
    expect(injectedSkinPackCss()).toContain('.bz-bs-skin-kraft');
  });

  it('整包与清单不同版（zip sha 不符）→ 整体回落逐文件，且不写半套文件', async () => {
    const zip = buildZip([{ name: 'skins/bookshelf/noir.css', text: CSS_A }]);
    const manifest = manifestWithPack([skinOf('noir', CSS_A), skinOf('kraft', CSS_B)], zip);
    routeFetch({
      [releaseZipUrl('v1.0.0')]: zip,
      // 逐文件回落的两个 raw 地址
      'https://fastly.jsdelivr.net/gh/yeshimei/bz-assets@master/downloads/skins/bookshelf/noir.css': CSS_A,
      'https://fastly.jsdelivr.net/gh/yeshimei/bz-assets@master/downloads/skins/bookshelf/kraft.css': CSS_B,
    });
    const vault = newVault();

    const result = await downloadSkinUpdates(appOf(vault), manifest);

    expect(result).toEqual({ downloaded: 2, failed: 0 });
    expect(vault.files.get('.obsidian/plugins/bz/downloads/skins/bookshelf/noir.css')).toBe(CSS_A);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/skins/bookshelf/kraft.css')).toBe(CSS_B);
  });

  it('整包缺条目 → 回落逐文件补齐', async () => {
    const zip = buildZip([{ name: 'skins/bookshelf/noir.css', text: CSS_A }]);
    const manifest = manifestWithPack([skinOf('noir', CSS_A), skinOf('kraft', CSS_B)], zip);
    routeFetch({
      [releaseZipUrl('v1.0.0')]: zip,
      'https://fastly.jsdelivr.net/gh/yeshimei/bz-assets@master/downloads/skins/bookshelf/noir.css': CSS_A,
      'https://fastly.jsdelivr.net/gh/yeshimei/bz-assets@master/downloads/skins/bookshelf/kraft.css': CSS_B,
    });
    const vault = newVault();

    const result = await downloadSkinUpdates(appOf(vault), manifest);

    expect(result.downloaded).toBe(2);
    expect(result.failed).toBe(0);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/skins/bookshelf/kraft.css')).toBe(CSS_B);
  });

  it('清单没有 skinsPack（旧清单）→ 直接走逐文件，行为不变', async () => {
    const a = skinOf('noir', CSS_A);
    const manifest: DownloadManifest = { version: 1, docs: [], skins: [a] };
    routeFetch({
      'https://fastly.jsdelivr.net/gh/yeshimei/bz-assets@master/downloads/skins/bookshelf/noir.css': CSS_A,
    });
    const vault = newVault();

    const result = await downloadSkinUpdates(appOf(vault), manifest);

    expect(result).toEqual({ downloaded: 1, failed: 0 });
  });
});

describe('清单 skinsPack 字段（宽容解析）', () => {
  it('形状完整才收；缺失/坏形 = undefined，不影响整份清单', () => {
    const base = JSON.stringify({ version: 1, docs: [], skins: [] });
    const good = JSON.stringify({ version: 1, docs: [], skins: [], skinsPack: { file: 'skins.zip', sha256: 'a'.repeat(64), size: 100 } });
    const badSha = JSON.stringify({ version: 1, docs: [], skins: [], skinsPack: { file: 'skins.zip', sha256: 'nope', size: 100 } });
    expect(parseDownloadManifest(good)?.skinsPack?.file).toBe('skins.zip');
    expect(parseDownloadManifest(base)?.skinsPack).toBeUndefined();
    expect(parseDownloadManifest(badSha)?.skinsPack).toBeUndefined();
  });
});

describe('产物自洽：真实 downloads/skins.zip ↔ downloads/manifest.json', () => {
  const inflateRaw = (data: Uint8Array): Uint8Array => new Uint8Array(zlib.inflateRawSync(Buffer.from(data)));

  it('zip 能读、逐条目 sha256 与清单一致、crc/长度全过', () => {
    const root = join(__dirname, '..', '..');
    const zipBytes = new Uint8Array(readFileSync(join(root, 'downloads', 'skins.zip')));
    const manifest = parseDownloadManifest(readFileSync(join(root, 'downloads', 'manifest.json'), 'utf8'));
    expect(manifest?.skinsPack?.file).toBe('skins.zip');

    const entries: ZipEntry[] = readZipEntries(zipBytes);
    const byName = new Map(entries.map((e) => [e.name, e]));
    for (const skin of manifest!.skins) {
      const z = byName.get(skin.file);
      expect(z, `zip 缺 ${skin.file}`).toBeTruthy();
      const text = new TextDecoder().decode(extractZipEntry(zipBytes, z!, { inflateRaw }));
      expect(textSha256(text)).toBe(skin.sha256);
    }
  });
});
