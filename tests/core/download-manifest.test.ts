// @vitest-environment node
// @vitest-environment jsdom
/**
 * 下载清单（ADR-0203 / issue 480，core/download-manifest.ts）测试。
 *
 * 钉住四件事：
 *  1. 清单解析够严——坏 JSON / CDN 错误页 / 缺段 / 坏条目 → null（静默跳过，不炸启动）；
 *  2. 拉取写缓存路径 = `<configDir>/plugins/bz/downloads/manifest.json`（与远端 downloads/ 镜像同构）；
 *     拉取失败**不写缓存**（旧缓存原样保留，UI 沿用它渲染）；
 *  3. docStatus 三态（missing / updated / ready）= 在线资源组按钮状态机的事实来源；
 *  4. refreshAsset 的 expectedSha256 省流——本地与清单一致即跳过远端拉取（327KB 不白拉）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from './../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { textSha256 } from '../../src/core/sha256';
import {
  cachedManifest,
  cachedSha256For,
  docStatus,
  parseDownloadManifest,
  refreshManifest,
  SKINS_ROW_ID,
  type DownloadManifest,
} from '../../src/core/download-manifest';
import { refreshAsset } from '../../src/core/remote-asset';

const MANIFEST_CACHE_PATH = '.obsidian/plugins/bz/downloads/manifest.json';
const REMOTE_MANIFEST = 'https://raw.githubusercontent.com/yeshimei/bz/master/downloads/manifest.json';
const BACKUP_MANIFEST = 'https://cdn.jsdelivr.net/gh/yeshimei/bz@master/downloads/manifest.json';
const REMOTE_HTML = (f: string) => `https://raw.githubusercontent.com/yeshimei/bz/master/downloads/${f}`;
const BACKUP_HTML = (f: string) => `https://cdn.jsdelivr.net/gh/yeshimei/bz@master/downloads/${f}`;

const appOf = (vault: MockVault) => ({ vault, workspace: {} }) as any;

const HTML = '<!DOCTYPE html><html><body>ok</body></html>';

const goodManifest = (): DownloadManifest => ({
  version: 1,
  docs: [
    { id: 'changelog', name: '更新日志', file: 'bz-changelog.html', sha256: textSha256(HTML) },
    { id: 'manual', name: '使用手册', file: 'bz-manual.html', sha256: 'a'.repeat(64) },
  ],
  skins: [
    {
      id: 'noir',
      domain: 'bookshelf',
      name: '黑金夜曲',
      file: 'skins/bookshelf/noir.css',
      previewClass: 'bz-skinprev-bs-noir',
      sha256: 'b'.repeat(64),
    },
  ],
});

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
  vi.mocked(requestUrl).mockReset();
});

describe('parseDownloadManifest（清单解析够严）', () => {
  it('正常清单 → docs 与 skins 都解析出来', () => {
    const m = parseDownloadManifest(JSON.stringify(goodManifest()));
    expect(m?.docs).toHaveLength(2);
    expect(m?.skins).toHaveLength(1);
    expect(m?.docs[0]).toMatchObject({ id: 'changelog', file: 'bz-changelog.html' });
    expect(m?.skins[0]).toMatchObject({ id: 'noir', domain: 'bookshelf' });
  });

  it('坏 JSON / CDN 错误页 / 空 / 缺段 → null（不抛，静默跳过）', () => {
    expect(parseDownloadManifest('<html>404 Not Found</html>')).toBeNull();
    expect(parseDownloadManifest('{')).toBeNull();
    expect(parseDownloadManifest(null)).toBeNull();
    expect(parseDownloadManifest(JSON.stringify({ version: 1 }))).toBeNull();
    expect(parseDownloadManifest(JSON.stringify({ version: 1, docs: [] }))).toBeNull();
  });

  it('docs 条目缺 id/name/file、sha 形状不对 → null（坚决不部分接受）', () => {
    const base = goodManifest();
    expect(
      parseDownloadManifest(JSON.stringify({ ...base, docs: [{ name: 'x', file: 'a', sha256: 'a'.repeat(64) }] })),
    ).toBeNull();
    expect(
      parseDownloadManifest(JSON.stringify({ ...base, docs: [{ id: 'x', file: 'a', sha256: 'a'.repeat(64) }] })),
    ).toBeNull();
    expect(
      parseDownloadManifest(JSON.stringify({ ...base, docs: [{ id: 'x', name: 'x', file: 'a', sha256: 'short' }] })),
    ).toBeNull();
  });

  it('skins 条目坏 → null（与旧 skin-pack 解析同口径）', () => {
    const base = goodManifest();
    expect(
      parseDownloadManifest(JSON.stringify({ ...base, skins: [{ domain: 'x', file: 'a', sha256: 'a'.repeat(64) }] })),
    ).toBeNull();
    expect(
      parseDownloadManifest(JSON.stringify({ ...base, skins: [{ id: 'a', domain: 'x', file: 'a', sha256: 'bad' }] })),
    ).toBeNull();
  });
});

describe('refreshManifest（拉取 + 写缓存）', () => {
  it('写入缓存清单，路径与远端 downloads/ 镜像同构；返回 previous', async () => {
    const vault = new MockVault();
    routeFetch({ [REMOTE_MANIFEST]: JSON.stringify(goodManifest()) });

    const { manifest, previous } = await refreshManifest(appOf(vault));
    expect(manifest.docs).toHaveLength(2);
    expect(previous).toBeNull();
    expect(vault.files.get(MANIFEST_CACHE_PATH)).toBe(JSON.stringify(goodManifest()));
  });

  it('主源失败换备源（jsDelivr）', async () => {
    const vault = new MockVault();
    routeFetch({
      [REMOTE_MANIFEST]: new Error('ENOTFOUND'),
      [BACKUP_MANIFEST]: JSON.stringify(goodManifest()),
    });
    const { manifest } = await refreshManifest(appOf(vault));
    expect(manifest.skins).toHaveLength(1);
  });

  it('双源全失败 → 抛人话错误，且**旧缓存原样保留**', async () => {
    const vault = new MockVault();
    vault.files.set(MANIFEST_CACHE_PATH, JSON.stringify(goodManifest()));
    routeFetch({
      [REMOTE_MANIFEST]: new Error('ENOTFOUND'),
      [BACKUP_MANIFEST]: new Error('ETIMEDOUT'),
    });

    await expect(refreshManifest(appOf(vault))).rejects.toThrow('下载清单下载失败');
    expect(vault.files.get(MANIFEST_CACHE_PATH)).toBe(JSON.stringify(goodManifest()));
  });

  it('内容不像清单（CDN 错误页）→ 换源；两源都坏 → 抛错不写缓存', async () => {
    const vault = new MockVault();
    routeFetch({
      [REMOTE_MANIFEST]: '<html>502 Bad Gateway</html>',
      [BACKUP_MANIFEST]: '<html>502 Bad Gateway</html>',
    });
    await expect(refreshManifest(appOf(vault))).rejects.toThrow('下载清单下载失败');
    expect(vault.files.has(MANIFEST_CACHE_PATH)).toBe(false);
  });
});

describe('cachedManifest / cachedSha256For', () => {
  it('读缓存清单；无缓存 → null', async () => {
    const vault = new MockVault();
    expect(await cachedManifest(appOf(vault))).toBeNull();
    vault.files.set(MANIFEST_CACHE_PATH, JSON.stringify(goodManifest()));
    expect((await cachedManifest(appOf(vault)))?.docs).toHaveLength(2);
  });

  it('cachedSha256For 按 file 找 docs 与 skins 两段；缺席 → null', async () => {
    const vault = new MockVault();
    vault.files.set(MANIFEST_CACHE_PATH, JSON.stringify(goodManifest()));
    expect(await cachedSha256For(appOf(vault), 'bz-changelog.html')).toBe(textSha256(HTML));
    expect(await cachedSha256For(appOf(vault), 'skins/bookshelf/noir.css')).toBe('b'.repeat(64));
    expect(await cachedSha256For(appOf(vault), 'other.css')).toBeNull();
  });
});

describe('docStatus（三态：missing / updated / ready）', () => {
  it('未下载 / 本地与清单不符 / 已最新 各归各位', async () => {
    const vault = new MockVault();
    const entry = { id: 'changelog', name: '更新日志', file: 'bz-changelog.html', sha256: textSha256(HTML) };
    expect(await docStatus(appOf(vault), entry)).toBe('missing');
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', '<!DOCTYPE html><html>旧版</html>');
    expect(await docStatus(appOf(vault), entry)).toBe('updated');
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', HTML);
    expect(await docStatus(appOf(vault), entry)).toBe('ready');
  });
});

describe('refreshAsset 的 expectedSha256 省流（ADR-0203）', () => {
  const validate = (t: string) => /<html/i.test(t);

  it('本地与清单 hash 一致 → 直接 null，**零网络请求**', async () => {
    const vault = new MockVault();
    vault.files.set('.obsidian/plugins/bz/downloads/bz-manual.html', HTML);
    routeFetch({});

    const r = await refreshAsset(appOf(vault), 'bz-manual.html', validate, '手册', textSha256(HTML));
    expect(r).toBeNull();
    expect(vi.mocked(requestUrl)).not.toHaveBeenCalled();
  });

  it('清单 hash 与本地不符 → 回落全量拉取对比，有新版则覆盖并返回新文本', async () => {
    const vault = new MockVault();
    vault.files.set('.obsidian/plugins/bz/downloads/bz-manual.html', '<!DOCTYPE html><html>旧版</html>');
    routeFetch({ [REMOTE_HTML('bz-manual.html')]: HTML, [BACKUP_HTML('bz-manual.html')]: HTML });

    const r = await refreshAsset(appOf(vault), 'bz-manual.html', validate, '手册', textSha256(HTML));
    expect(r).toBe(HTML);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/bz-manual.html')).toBe(HTML);
  });

  it('清单缺席（null）→ 保持旧口径全量拉取；同版 → null 不写盘', async () => {
    const vault = new MockVault();
    vault.files.set('.obsidian/plugins/bz/downloads/bz-manual.html', HTML);
    routeFetch({ [REMOTE_HTML('bz-manual.html')]: HTML });

    const r = await refreshAsset(appOf(vault), 'bz-manual.html', validate, '手册', null);
    expect(r).toBeNull();
  });

  it('远端拉挂 → null 静默（保持本地已存版本）', async () => {
    const vault = new MockVault();
    vault.files.set('.obsidian/plugins/bz/downloads/bz-manual.html', HTML);
    routeFetch({
      [REMOTE_HTML('bz-manual.html')]: new Error('ENOTFOUND'),
      [BACKUP_HTML('bz-manual.html')]: new Error('ETIMEDOUT'),
    });
    const r = await refreshAsset(appOf(vault), 'bz-manual.html', validate, '手册', null);
    expect(r).toBeNull();
  });
});

describe('doc 条目版本区间与体积（第 3 / 4 条数据面）', () => {
  it('doc 条目 since / until / size 正常解析', () => {
    const base = goodManifest();
    const m = parseDownloadManifest(
      JSON.stringify({
        ...base,
        docs: [
          { id: 'changelog', name: '更新日志', file: 'bz-changelog.html', sha256: 'a'.repeat(64), since: '1.2.0', until: '2.0.0', size: 12345 },
        ],
      }),
    );
    expect(m?.docs[0]).toMatchObject({
      id: 'changelog',
      since: '1.2.0',
      until: '2.0.0',
      size: 12345,
    });
  });

  it('size 为 0 / 负数 / 字符串 / NaN → 丢弃为 undefined，且不影响清单有效性', () => {
    const base = goodManifest();
    for (const size of [0, -1, '123', NaN]) {
      const m = parseDownloadManifest(
        JSON.stringify({
          ...base,
          docs: [{ id: 'changelog', name: '更新日志', file: 'bz-changelog.html', sha256: 'a'.repeat(64), size }],
        }),
      );
      expect(m).not.toBeNull();
      expect(m?.docs[0].size).toBeUndefined();
    }
  });

  it('必填字段缺失仍然整份失效（回归：新字段是可选的不背锅）', () => {
    const base = goodManifest();
    // size/since/until 给着玩，但 id 缺失 → 整份 null
    expect(
      parseDownloadManifest(
        JSON.stringify({
          ...base,
          docs: [{ name: 'x', file: 'a', sha256: 'a'.repeat(64), size: 10, since: '1.0.0' }],
        }),
      ),
    ).toBeNull();
    // 缺 sha256 也照样 null
    expect(
      parseDownloadManifest(
        JSON.stringify({
          ...base,
          docs: [{ id: 'x', name: 'x', file: 'a', size: 10 }],
        }),
      ),
    ).toBeNull();
  });
});

describe('皮肤条目体积（第 4 条数据面：skins[].size）', () => {
  it('skins 条目 size 正常解析（与 doc 侧同口径）', () => {
    const base = goodManifest();
    const m = parseDownloadManifest(
      JSON.stringify({ ...base, skins: [{ ...base.skins[0], size: 4096 }] }),
    );
    expect(m?.skins[0]).toMatchObject({ id: 'noir', size: 4096 });
  });

  it('skins 条目 size 为 0 / 负数 / 字符串 / NaN → 丢弃为 undefined，条目本身仍在', () => {
    const base = goodManifest();
    for (const size of [0, -1, '123', NaN]) {
      const m = parseDownloadManifest(
        JSON.stringify({ ...base, skins: [{ ...base.skins[0], size }] }),
      );
      expect(m).not.toBeNull();
      expect(m?.skins).toHaveLength(1);
      expect(m?.skins[0].size).toBeUndefined();
    }
  });

  it('skins 条目不登记 size → undefined（旧清单照常可用，UI 不提体积）', () => {
    const m = parseDownloadManifest(JSON.stringify(goodManifest()));
    expect(m?.skins[0].size).toBeUndefined();
  });
});

describe('rowOrder（行序字段：可选、宽容）', () => {
  it('rowOrder 正常解析为字符串数组', () => {
    const base = goodManifest();
    const order = ['changelog', 'manual', SKINS_ROW_ID, 'belongings-categories'];
    const m = parseDownloadManifest(JSON.stringify({ ...base, rowOrder: order }));
    expect(m?.rowOrder).toEqual(order);
  });

  it('rowOrder 不是数组 → 整字段丢弃，清单仍有效', () => {
    const base = goodManifest();
    const m = parseDownloadManifest(JSON.stringify({ ...base, rowOrder: 'changelog,manual' }));
    expect(m).not.toBeNull();
    expect(m?.rowOrder).toBeUndefined();
  });

  it('rowOrder 含空串 → 整字段丢弃', () => {
    const base = goodManifest();
    const m = parseDownloadManifest(JSON.stringify({ ...base, rowOrder: ['changelog', '', 'manual'] }));
    expect(m).not.toBeNull();
    expect(m?.rowOrder).toBeUndefined();
  });

  it('rowOrder 含非字符串 → 整字段丢弃', () => {
    const base = goodManifest();
    const m = parseDownloadManifest(JSON.stringify({ ...base, rowOrder: ['changelog', 1 as unknown as string] }));
    expect(m).not.toBeNull();
    expect(m?.rowOrder).toBeUndefined();
  });

  it('缺 rowOrder 的旧清单照样解析成功，rowOrder === undefined', () => {
    const m = parseDownloadManifest(JSON.stringify(goodManifest()));
    expect(m).not.toBeNull();
    expect(m?.rowOrder).toBeUndefined();
    expect(m?.docs).toHaveLength(2);
  });
});
