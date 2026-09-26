// @vitest-environment jsdom
/**
 * 皮肤包（ADR-0199 / issue 475；加载策略经 ADR-0202 / issue 480 修订）数据层 + 注入链路测试。
 *
 * 钉住四件事：
 *  1. 版本区间 = `since <= 插件版本 < until`（缺省侧不限）；
 *  2. 就绪判定 = 缓存清单条目 + 本地文件 sha256 匹配（旧本地就绪表 skins/index.json 已退役），
 *     hash 不匹配拒注入（半截/被改写的文件不进选择卡）；
 *  3. **启动链绝不下载**（applySkinManifest 只对比 + 清理 + 注入）——ADR-0202 半自动铁则；
 *     下载只走 downloadSkinUpdates（用户显式触发），且只拉非就绪的；
 *  4. 下架 = previous 缓存清单有、新清单区间内无 → 删本地文件；
 *     **没有插件版本就一概不加载**（防按错版本放行）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from './../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { textSha256 } from '../../src/core/sha256';
import {
  applySkinManifest,
  downloadSkinUpdates,
  injectSkinPackStyles,
  injectedSkinPackCss,
  isRemoteSkinReady,
  isInVersionRange,
  loadLocalSkinPack,
  localSkinEntries,
  remoteSkinIds,
  resetSkinPackState,
  seedSkinPackState,
  skinPackOptions,
  skinStatus,
  type SkinPackEntry,
} from '../../src/core/skin-pack';
import type { DownloadManifest } from '../../src/core/download-manifest';

const MANIFEST_CACHE_PATH = '.obsidian/plugins/bz/downloads/manifest.json';
const MANIFEST_PATH = '.obsidian/plugins/bz/manifest.json';
const REMOTE_MANIFEST = 'https://raw.githubusercontent.com/yeshimei/bz/master/downloads/manifest.json';
const OLD_INDEX_PATH = '.obsidian/plugins/bz/skins/index.json';

const appOf = (vault: MockVault) => ({ vault, workspace: {} }) as any;

const CSS_NOIR = '/* noir */\n.bz-bs-skin-noir { --bz-brand: #d9b45f; }\n.bz-skinprev-bs-noir { background: #000; }\n';
const CSS_KRAFT = '/* kraft */\n.bz-bs-skin-kraft { --bz-brand: #8a6a3e; }\n.bz-skinprev-bs-kraft { background: #c2a476; }\n';

function entryOf(id: string, text: string, extra: Partial<SkinPackEntry> = {}): SkinPackEntry {
  return {
    id,
    domain: 'bookshelf',
    name: id,
    file: `skins/bookshelf/${id}.css`,
    previewClass: `bz-skinprev-bs-${id}`,
    sha256: textSha256(text),
    ...extra,
  };
}

function manifestText(skins: SkinPackEntry[], version = 1): string {
  return JSON.stringify({ version, docs: [], skins }, null, 2);
}

/** 建一个「已装插件 + 指定版本」的 vault */
function newVault(version = '1.0.0'): MockVault {
  const v = new MockVault();
  v.files.set(MANIFEST_PATH, JSON.stringify({ id: 'bz', version }));
  return v;
}

/** requestUrl 按 URL 分发的桩（未命中的 URL 抛错，暴露漏配） */
function routeFetch(map: Record<string, string | Error>): void {
  vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
    const hit = map[req.url];
    if (hit === undefined) throw new Error('unmocked url: ' + req.url);
    if (hit instanceof Error) throw hit;
    return { status: 200, text: hit } as any;
  }) as any);
}

beforeEach(() => {
  resetObsidianMocks();
  resetSkinPackState();
  vi.mocked(requestUrl).mockReset();
  document.getElementById('bz-skin-pack-style')?.remove();
});

describe('isInVersionRange（since <= 版本 < until）', () => {
  const e = (since?: string, until?: string) => entryOf('noir', CSS_NOIR, { since, until });

  it('两侧缺省 = 不限', () => {
    expect(isInVersionRange(e(), '1.0.0')).toBe(true);
  });
  it('since 含（等于放行、低于拒绝）', () => {
    expect(isInVersionRange(e('1.2.0'), '1.2.0')).toBe(true);
    expect(isInVersionRange(e('1.2.0'), '1.3.0')).toBe(true);
    expect(isInVersionRange(e('1.2.0'), '1.1.9')).toBe(false);
  });
  it('until 不含（等于即拒）', () => {
    expect(isInVersionRange(e(undefined, '2.0.0'), '1.9.9')).toBe(true);
    expect(isInVersionRange(e(undefined, '2.0.0'), '2.0.0')).toBe(false);
  });
  it('插件版本为空 → 一律不在区间（宁可不加载）', () => {
    expect(isInVersionRange(e(), '')).toBe(false);
  });
});

describe('就绪表 / 选择卡选项', () => {
  it('选项 = 内置首套（恒首位）+ 就绪远端皮（清单顺序）', () => {
    seedSkinPackState([entryOf('noir', CSS_NOIR), entryOf('kraft', CSS_KRAFT)]);
    const opts = skinPackOptions('bookshelf', [{ value: 'nordic', label: '雪松白', layout: 'default', prevClass: 'bz-skinprev-bs-nordic' }]);
    expect(opts.map((o) => o.value)).toEqual(['nordic', 'noir', 'kraft']);
    expect(opts[1]).toMatchObject({ label: 'noir', layout: 'default', prevClass: 'bz-skinprev-bs-noir' });
  });

  it('就绪判定按域隔离；远端 id 未就绪时不可用', () => {
    seedSkinPackState([entryOf('noir', CSS_NOIR)]);
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(true);
    expect(isRemoteSkinReady('bookshelf', 'kraft')).toBe(false);
    expect(isRemoteSkinReady('memo', 'noir')).toBe(false);
    expect(remoteSkinIds('bookshelf')).toEqual(['noir']);
    expect(localSkinEntries('memo')).toEqual([]);
  });
});

describe('injectSkinPackStyles（唯一注入点）', () => {
  it('单节点、可重入、空串则摘除', () => {
    injectSkinPackStyles('.a{}');
    injectSkinPackStyles('.b{}');
    expect(document.querySelectorAll('#bz-skin-pack-style')).toHaveLength(1);
    expect(injectedSkinPackCss()).toBe('.b{}');
    injectSkinPackStyles('');
    expect(document.getElementById('bz-skin-pack-style')).toBeNull();
  });
});

describe('skinStatus（三态计数：在线资源组按钮的数据源）', () => {
  it('ready / missing / updated 各归各位', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    const kraft = entryOf('kraft', CSS_KRAFT);
    const ghost = entryOf('ghost', '/* ghost */');
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR); // 就绪
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/kraft.css', '/* 被改过 */'); // hash 不符 → updated
    const st = await skinStatus(appOf(vault), { version: 1, docs: [], skins: [noir, kraft, ghost] });
    expect(st).toEqual({ ready: 1, missing: 1, updated: 1 });
  });

  it('读不到插件版本 → 全 0（区间无从判定，宁可不加载）', async () => {
    const vault = new MockVault();
    const st = await skinStatus(appOf(vault), { version: 1, docs: [], skins: [entryOf('noir', CSS_NOIR)] });
    expect(st).toEqual({ ready: 0, missing: 0, updated: 0 });
  });
});

describe('applySkinManifest（启动链：对比 + 清理 + 注入，绝不下载）', () => {
  it('就绪皮肤注入；未下载的只计数（missing），**不发任何网络请求**', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    const ghost = entryOf('ghost', '/* ghost */');
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR);
    routeFetch({}); // 任何请求都会抛 unmocked → 半自动铁则的守卫

    const res = await applySkinManifest(appOf(vault), { version: 1, docs: [], skins: [noir, ghost] }, null);
    expect(res).toMatchObject({ ready: 1, missing: 1, updated: 0, removed: 0 });
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(true);
    expect(injectedSkinPackCss()).toContain('.bz-bs-skin-noir');
    expect(vault.files.has('.obsidian/plugins/bz/skins/bookshelf/ghost.css')).toBe(false);
  });

  it('文件被改写 → 不入就绪表但计入 updated（等用户点「更新」重下）', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', '/* 被改过 */');
    routeFetch({});

    const res = await applySkinManifest(appOf(vault), { version: 1, docs: [], skins: [noir] }, null);
    expect(res).toMatchObject({ ready: 0, updated: 1 });
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(false);
    expect(injectedSkinPackCss()).toBe('');
  });

  it('下架 = previous 缓存清单有、新清单无 → 删本地文件', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR);
    routeFetch({});

    const res = await applySkinManifest(appOf(vault), { version: 1, docs: [], skins: [] }, { version: 1, docs: [], skins: [noir] });
    expect(res.removed).toBe(1);
    expect(vault.files.has('.obsidian/plugins/bz/skins/bookshelf/noir.css')).toBe(false);
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(false);
    expect(injectedSkinPackCss()).toBe('');
  });

  it('版本区间外 → 不加载也不残留（previous 里有就一并清掉）', async () => {
    const vault = newVault('3.0.0');
    const noir = entryOf('noir', CSS_NOIR, { until: '2.0.0' });
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR);
    routeFetch({});

    const res = await applySkinManifest(appOf(vault), { version: 1, docs: [], skins: [noir] }, { version: 1, docs: [], skins: [noir] });
    expect(res.ready).toBe(0);
    expect(res.removed).toBe(1);
    expect(injectedSkinPackCss()).toBe('');
  });

  it('旧版就绪表 skins/index.json 随清单统一退役（幂等清理）', async () => {
    const vault = newVault();
    vault.files.set(OLD_INDEX_PATH, '{"version":1,"skins":[]}');
    routeFetch({});
    await applySkinManifest(appOf(vault), { version: 1, docs: [], skins: [] }, null);
    expect(vault.files.has(OLD_INDEX_PATH)).toBe(false);
  });

  it('读不到插件版本 → 全 0 且不注入（防按错版本放行）', async () => {
    const vault = new MockVault(); // 无 manifest.json
    routeFetch({});
    const res = await applySkinManifest(appOf(vault), { version: 1, docs: [], skins: [entryOf('noir', CSS_NOIR)] }, null);
    expect(res).toEqual({ ready: 0, missing: 0, updated: 0, removed: 0 });
    expect(injectedSkinPackCss()).toBe('');
  });
});

describe('downloadSkinUpdates（用户显式下载：只拉非就绪）', () => {
  it('只拉缺失/被改写的；就绪的不动；完成后重验注入', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    const kraft = entryOf('kraft', CSS_KRAFT);
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR); // 已就绪 → 不拉
    routeFetch({
      [REMOTE_MANIFEST]: manifestText([noir, kraft]), // 混在请求里也无妨（真实流程先 refreshManifest）
      'https://raw.githubusercontent.com/yeshimei/bz/master/downloads/skins/bookshelf/kraft.css': CSS_KRAFT,
    });

    const res = await downloadSkinUpdates(appOf(vault), { version: 1, docs: [], skins: [noir, kraft] });
    expect(res).toEqual({ downloaded: 1, failed: 0 });
    expect(vault.files.get('.obsidian/plugins/bz/skins/bookshelf/kraft.css')).toBe(CSS_KRAFT);
    expect(isRemoteSkinReady('bookshelf', 'kraft')).toBe(true);
    expect(injectedSkinPackCss()).toContain('.bz-bs-skin-kraft');
    expect(injectedSkinPackCss()).toContain('.bz-bs-skin-noir');
  });

  it('sha256 不匹配（被篡改/CDN 错版）→ 拒收计 failed，不注入', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    const bad = 'https://raw.githubusercontent.com/yeshimei/bz/master/downloads/skins/bookshelf/noir.css';
    routeFetch({
      [bad]: '.bz-bs-skin-noir{color:red}', // 内容变了但 hash 是旧的
      'https://cdn.jsdelivr.net/gh/yeshimei/bz@master/downloads/skins/bookshelf/noir.css': '.bz-bs-skin-noir{color:red}',
    });

    const res = await downloadSkinUpdates(appOf(vault), { version: 1, docs: [], skins: [noir] });
    expect(res).toEqual({ downloaded: 0, failed: 1 });
    expect(vault.files.has('.obsidian/plugins/bz/skins/bookshelf/noir.css')).toBe(false);
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(false);
  });

  it('全部就绪 → 零请求零下载', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR);
    routeFetch({});
    const res = await downloadSkinUpdates(appOf(vault), { version: 1, docs: [], skins: [noir] });
    expect(res).toEqual({ downloaded: 0, failed: 0 });
  });
});

describe('loadLocalSkinPack（启动即用缓存清单，不等 15 秒的启动链）', () => {
  it('缓存清单 + 本地文件 → 立刻就绪并注入，且**不发任何网络请求**', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    vault.files.set(MANIFEST_CACHE_PATH, manifestText([noir]));
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR);
    const spy = vi.mocked(requestUrl); // 不配置任何 route：一旦发请求就会抛 unmocked

    await loadLocalSkinPack(appOf(vault));
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(true);
    expect(injectedSkinPackCss()).toContain('.bz-bs-skin-noir');
    expect(spy).not.toHaveBeenCalled();
  });

  it('区间外的皮肤不加载；坏清单视同无缓存', async () => {
    const vault = newVault('1.0.0');
    const ghost = entryOf('ghost', '/* ghost */', { since: '9.9.9' });
    vault.files.set(MANIFEST_CACHE_PATH, manifestText([ghost]));
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/ghost.css', '/* ghost */');

    await loadLocalSkinPack(appOf(vault));
    expect(isRemoteSkinReady('bookshelf', 'ghost')).toBe(false);
    expect(injectedSkinPackCss()).toBe('');

    vault.files.set(MANIFEST_CACHE_PATH, '<html>502</html>');
    await loadLocalSkinPack(appOf(vault));
    expect(injectedSkinPackCss()).toBe('');
  });

  it('无缓存清单 → 静默什么都不做（首装/未联网过）', async () => {
    const vault = newVault();
    await expect(loadLocalSkinPack(appOf(vault))).resolves.toBeUndefined();
    expect(remoteSkinIds('bookshelf')).toEqual([]);
    expect(injectedSkinPackCss()).toBe('');
  });

  it('读不到插件版本 → 不加载（与 applySkinManifest 同口径）', async () => {
    const vault = new MockVault(); // 无 manifest.json
    const noir = entryOf('noir', CSS_NOIR);
    vault.files.set(MANIFEST_CACHE_PATH, manifestText([noir]));
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR);

    await loadLocalSkinPack(appOf(vault));
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(false);
  });
});

/** 类型侧钉：清单类型从 download-manifest 单源（skin-pack 只转出不重decl） */
describe('类型单源', () => {
  it('SkinPackEntry 与 DownloadManifest.skins 同构', async () => {
    const e: SkinPackEntry = entryOf('noir', CSS_NOIR);
    const m: DownloadManifest = { version: 1, docs: [], skins: [e] };
    expect(m.skins[0].id).toBe('noir');
  });
});
