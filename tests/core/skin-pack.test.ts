// @vitest-environment jsdom
/**
 * 皮肤包（ADR-0199 / issue 475）数据层 + 注入链路测试。
 *
 * 钉住四件事：
 *  1. 清单解析够严——坏 JSON / CDN 错误页 / 缺字段 / sha 形状不对 → null（静默跳过，不炸启动）；
 *  2. 版本区间 = `since <= 插件版本 < until`（缺省侧不限）；
 *  3. sha256 与构建脚本同口径（对**归一换行后**的文本取值，免 CRLF/LF 两套 hash）；
 *  4. 同步链路：本地优先（离线也有皮）、只下区间内的、hash 不匹配拒注入、
 *     下架即删本地文件、**没有插件版本就一概不加载**（防按错版本放行）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from './../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { normalizeEol, sha256Hex, textSha256 } from '../../src/core/sha256';
import {
  SKIN_PACK_INDEX,
  injectSkinPackStyles,
  injectedSkinPackCss,
  isInVersionRange,
  isRemoteSkinReady,
  localSkinEntries,
  parseSkinPackManifest,
  remoteSkinIds,
  resetSkinPackState,
  seedSkinPackState,
  skinPackOptions,
  syncSkinPack,
  type SkinPackEntry,
} from '../../src/core/skin-pack';

const INDEX_PATH = `.obsidian/plugins/bz/${SKIN_PACK_INDEX}`;
const MANIFEST_PATH = '.obsidian/plugins/bz/manifest.json';
const REMOTE_INDEX = 'https://raw.githubusercontent.com/yeshimei/bz/master/manual/skins/index.json';

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

function indexText(skins: SkinPackEntry[], version = 1): string {
  return JSON.stringify({ version, skins }, null, 2);
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

describe('sha256（与构建脚本同口径）', () => {
  it('已知向量：空串与 abc', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('CRLF 与 LF 同 hash（textSha256 先归一换行）', () => {
    expect(textSha256('a\r\nb')).toBe(textSha256('a\nb'));
    expect(normalizeEol('a\r\nb\rc')).toBe('a\nb\nc');
  });
});

describe('parseSkinPackManifest（清单解析够严）', () => {
  const good = entryOf('noir', CSS_NOIR);

  it('正常清单 → 解析出条目', () => {
    const m = parseSkinPackManifest(indexText([good]));
    expect(m?.skins).toHaveLength(1);
    expect(m?.skins[0]).toMatchObject({ id: 'noir', domain: 'bookshelf', file: 'skins/bookshelf/noir.css' });
  });

  it('坏 JSON / CDN 错误页 / 空 → null（不抛，静默跳过）', () => {
    expect(parseSkinPackManifest('<html>404 Not Found</html>')).toBeNull();
    expect(parseSkinPackManifest('{')).toBeNull();
    expect(parseSkinPackManifest(null)).toBeNull();
    expect(parseSkinPackManifest(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it('缺 id/domain/file、sha256 形状不对 → null（坚决不部分接受）', () => {
    expect(parseSkinPackManifest(JSON.stringify({ version: 1, skins: [{ domain: 'x', file: 'a.css', sha256: 'a'.repeat(64) }] }))).toBeNull();
    expect(parseSkinPackManifest(JSON.stringify({ version: 1, skins: [{ id: 'a', domain: 'x', sha256: 'a'.repeat(64) }] }))).toBeNull();
    expect(parseSkinPackManifest(JSON.stringify({ version: 1, skins: [{ id: 'a', domain: 'x', file: 'a.css', sha256: 'short' }] }))).toBeNull();
  });
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

describe('syncSkinPack（同步链路）', () => {
  it('拉不到远端清单 → 静默 offline，本地那份继续生效（含注入）', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    vault.files.set(INDEX_PATH, indexText([noir]));
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR);
    routeFetch({ [REMOTE_INDEX]: new Error('ENOTFOUND') });

    const res = await syncSkinPack(appOf(vault));
    expect(res.offline).toBe(true);
    expect(res.ready).toBe(1);
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(true);
    expect(injectedSkinPackCss()).toContain('.bz-bs-skin-noir');
  });

  it('首次同步：只下区间内的，注入并写本地索引', async () => {
    const vault = newVault('1.5.0');
    const noir = entryOf('noir', CSS_NOIR);
    const future = entryOf('kraft', CSS_KRAFT, { since: '9.9.9' });
    routeFetch({
      [REMOTE_INDEX]: indexText([noir, future]),
      'https://raw.githubusercontent.com/yeshimei/bz/master/manual/skins/bookshelf/noir.css': CSS_NOIR,
    });

    const res = await syncSkinPack(appOf(vault));
    expect(res).toMatchObject({ offline: false, downloaded: 1, ready: 1, removed: 0 });
    expect(vault.files.get('.obsidian/plugins/bz/skins/bookshelf/noir.css')).toBe(CSS_NOIR);
    expect(vault.files.has('.obsidian/plugins/bz/skins/bookshelf/kraft.css')).toBe(false);
    expect(injectedSkinPackCss()).toContain('.bz-bs-skin-noir');
    const written = JSON.parse(vault.files.get(INDEX_PATH) || '{}');
    expect(written.skins.map((s: SkinPackEntry) => s.id)).toEqual(['noir']);
  });

  it('sha256 不匹配（被篡改/CDN 错版）→ 拒绝注入、不入索引', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    routeFetch({
      [REMOTE_INDEX]: indexText([noir]),
      'https://raw.githubusercontent.com/yeshimei/bz/master/manual/skins/bookshelf/noir.css': '.bz-bs-skin-noir{color:red}', // 内容变了但 hash 是旧的
      'https://cdn.jsdelivr.net/gh/yeshimei/bz@master/manual/skins/bookshelf/noir.css': '.bz-bs-skin-noir{color:red}',
    });

    const res = await syncSkinPack(appOf(vault));
    expect(res.ready).toBe(0);
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(false);
    expect(injectedSkinPackCss()).toBe('');
    expect(vault.files.has('.obsidian/plugins/bz/skins/bookshelf/noir.css')).toBe(false);
  });

  it('主源不可信时换备源（jsDelivr）', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    routeFetch({
      [REMOTE_INDEX]: indexText([noir]),
      'https://raw.githubusercontent.com/yeshimei/bz/master/manual/skins/bookshelf/noir.css': 'bad',
      'https://cdn.jsdelivr.net/gh/yeshimei/bz@master/manual/skins/bookshelf/noir.css': CSS_NOIR,
    });

    const res = await syncSkinPack(appOf(vault));
    expect(res.ready).toBe(1);
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(true);
  });

  it('下架 = 清单移除 + 删本地文件（已选中者由域内 normalize 回落首套）', async () => {
    const vault = newVault();
    const noir = entryOf('noir', CSS_NOIR);
    vault.files.set(INDEX_PATH, indexText([noir]));
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR);
    routeFetch({ [REMOTE_INDEX]: indexText([]) });

    const res = await syncSkinPack(appOf(vault));
    expect(res.removed).toBe(1);
    expect(vault.files.has('.obsidian/plugins/bz/skins/bookshelf/noir.css')).toBe(false);
    expect(isRemoteSkinReady('bookshelf', 'noir')).toBe(false);
    expect(injectedSkinPackCss()).toBe('');
  });

  it('版本区间外 → 不加载也不残留（本地那份一并清掉）', async () => {
    const vault = newVault('3.0.0');
    const noir = entryOf('noir', CSS_NOIR, { until: '2.0.0' });
    vault.files.set(INDEX_PATH, indexText([noir]));
    vault.files.set('.obsidian/plugins/bz/skins/bookshelf/noir.css', CSS_NOIR);
    routeFetch({ [REMOTE_INDEX]: indexText([noir]) });

    const res = await syncSkinPack(appOf(vault));
    expect(res.ready).toBe(0);
    expect(res.removed).toBe(1);
    expect(injectedSkinPackCss()).toBe('');
  });

  it('读不到插件版本 → 一律不加载（防按错版本放行）', async () => {
    const vault = new MockVault(); // 无 manifest.json
    routeFetch({ [REMOTE_INDEX]: indexText([entryOf('noir', CSS_NOIR)]) });
    const res = await syncSkinPack(appOf(vault));
    expect(res).toEqual({ ready: 0, downloaded: 0, removed: 0, offline: false });
    expect(injectedSkinPackCss()).toBe('');
  });

  it('拉挂了不弹通知（失败静默，等下次启动）', async () => {
    const vault = newVault();
    routeFetch({ [REMOTE_INDEX]: new Error('ENOTFOUND') });
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await syncSkinPack(appOf(vault));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
