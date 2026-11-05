// @vitest-environment jsdom
/**
 * bz reader 安装器（core/reader-install.ts）：
 * - 本机状态：磁盘 manifest / Obsidian 清单 / 启用集合三处真值；
 * - 最新版：GitHub 免 tag 别名主 → 码云 API/raw 备；
 * - 安装：三件套从哪条通道来都要字节落对，manifest 最后写，软加载启用；
 * - 失败：两条通道都不通时把两边原因一起给人看。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestUrl } from 'obsidian';
import { MockVault } from '../mock-vault';
import {
  fetchLatestReaderRelease,
  installReaderPlugin,
  isReaderEnabled,
  readReaderInstall,
  readerPluginDirOf,
  readerStateText,
  READER_GITEE_SLUG,
  READER_PLUGIN_ID,
  READER_REPO_SLUG,
} from '../../src/core/reader-install';

const PLUGIN_DIR = '.obsidian/plugins/bz-reader';
const MANIFEST = JSON.stringify({
  id: 'bz-reader',
  name: 'bz Reader',
  version: '0.2.0',
  minAppVersion: '1.8.7',
  isDesktopOnly: false,
});
/** 超过 assertAsset 的 1000 字节下限 */
const MAIN_JS = 'console.log("bz reader");\n' + 'x'.repeat(2000);
const STYLES = '.bz-reader{color:red}\n' + 'x'.repeat(200);

const ok = (text: string) => ({ status: 200, text });

function appOf(vault: MockVault, over: Record<string, unknown> = {}): { app: any; enabled: Set<string> } {
  const enabled = new Set<string>();
  const app: any = {
    vault: { adapter: vault.adapter, configDir: '.obsidian' },
    plugins: {
      manifests: {},
      enabledPlugins: enabled,
      plugins: {},
      loadManifests: vi.fn(async () => {}),
      enablePluginAndSave: vi.fn(async (id: string) => {
        enabled.add(id);
      }),
      ...over,
    },
  };
  return { app, enabled };
}

/** 按 URL 后缀/包含分派；未命中的 URL 直接抛，暴露漏配 */
function route(rules: Array<[string, string | Error]>): void {
  vi.mocked(requestUrl).mockImplementation((async (opts: { url: string }) => {
    for (const [needle, value] of rules) {
      if (!opts.url.includes(needle)) continue;
      if (value instanceof Error) throw value;
      return ok(value);
    }
    throw new Error(`unmocked url: ${opts.url}`);
  }) as never);
}

beforeEach(() => {
  vi.mocked(requestUrl).mockReset();
});

describe('本机状态：读磁盘与 Obsidian 清单', () => {
  it('未安装：installed=false、broken=false、目录取标准位置', async () => {
    const { app } = appOf(new MockVault());
    const state = await readReaderInstall(app);
    expect(state).toMatchObject({
      id: READER_PLUGIN_ID,
      dir: PLUGIN_DIR,
      installed: false,
      broken: false,
      enabled: false,
      version: '',
    });
  });

  it('磁盘上 manifest.json 的版本优先（刚装完还没 loadManifests 时内存里是旧版）', async () => {
    const vault = new MockVault();
    vault.files.set(`${PLUGIN_DIR}/manifest.json`, JSON.stringify({ id: 'bz-reader', version: '0.2.1' }));
    const { app } = appOf(vault, {
      manifests: { 'bz-reader': { dir: PLUGIN_DIR, version: '0.2.0' } },
      enabledPlugins: new Set(['bz-reader']),
    });
    const state = await readReaderInstall(app);
    expect(state.installed).toBe(true);
    expect(state.version).toBe('0.2.1');
    expect(state.enabled).toBe(true);
    expect(state.broken).toBe(false);
  });

  it('用户改过插件目录名：按 manifests.dir 找，不往标准目录瞎写', async () => {
    const vault = new MockVault();
    vault.files.set('.obsidian/plugins/阅读器/manifest.json', JSON.stringify({ id: 'bz-reader', version: '0.1.2' }));
    const { app } = appOf(vault, { manifests: { 'bz-reader': { dir: '.obsidian/plugins/阅读器' } } });
    expect(readerPluginDirOf(app)).toBe('.obsidian/plugins/阅读器');
    const state = await readReaderInstall(app);
    expect(state.version).toBe('0.1.2');
  });

  it('内存清单还留着旧记录、但目录已被删 → 未安装（不报「安装不完整」）', async () => {
    // 2026-11-05 测试库实测：Obsidian 内存里 manifests['bz-reader'] 还在，
    // 磁盘目录已经没了——以磁盘为准，否则界面会把「没装」说成「装坏了」。
    const { app } = appOf(new MockVault(), {
      manifests: { 'bz-reader': { dir: PLUGIN_DIR, version: '0.2.0' } },
    });
    const state = await readReaderInstall(app);
    expect(state.installed).toBe(false);
    expect(state.broken).toBe(false);
    expect(readerStateText(state)).toBe('未安装');
  });

  it('目录在、manifest 读不出 → broken（磁盘有东西，但展示仍按「未安装」）', async () => {
    const vault = new MockVault();
    vault.dirs.add(PLUGIN_DIR);
    const { app } = appOf(vault);
    const state = await readReaderInstall(app);
    expect(state.installed).toBe(true); // 目录在
    expect(state.broken).toBe(true);
    expect(readerStateText(state)).toBe('未安装');
  });
});

describe('状态文案', () => {
  const base = {
    id: READER_PLUGIN_ID,
    dir: PLUGIN_DIR,
    installed: true,
    version: '0.2.0',
    enabled: true,
    broken: false,
  };

  it('未安装 / 已启用 / 未启用 / 有新版 / 半装', () => {
    expect(readerStateText({ ...base, installed: false })).toBe('未安装');
    expect(readerStateText(base)).toBe('已安装 0.2.0 · 已启用');
    expect(readerStateText({ ...base, enabled: false })).toBe('已安装 0.2.0 · 未启用');
    expect(readerStateText(base, '0.2.1')).toBe('已安装 0.2.0 · 新版 0.2.1');
    expect(readerStateText(base, '0.2.0')).toBe('已安装 0.2.0 · 已启用');
    expect(readerStateText({ ...base, broken: true })).toBe('未安装');
  });
});

describe('最新版：GitHub 主 → 码云备', () => {
  it('GitHub 免 tag 别名拿到版本，manifest 正文原样留着（安装时直接写这份）', async () => {
    route([['/releases/latest/download/manifest.json', MANIFEST]]);
    const rel = await fetchLatestReaderRelease();
    expect(rel.version).toBe('0.2.0');
    expect(rel.via).toBe('github');
    expect(rel.manifestText).toBe(MANIFEST);
  });

  it('GitHub 不通 → 码云 API 拿 tag，再取该 tag 的 manifest', async () => {
    route([
      ['github.com', new Error('net::ERR_CONNECTION_RESET')],
      ['api/v5/repos/ntbl/bz-reader/releases/latest', JSON.stringify({ tag_name: '0.2.0' })],
      ['gitee.com/ntbl/bz-reader/releases/download/0.2.0/manifest.json', MANIFEST],
    ]);
    const rel = await fetchLatestReaderRelease();
    expect(rel).toMatchObject({ version: '0.2.0', via: 'gitee', tag: '0.2.0' });
  });

  it('码云 API 也挂（限流）→ 退 raw master 的 manifest', async () => {
    route([
      ['github.com', new Error('ENOTFOUND')],
      ['api/v5/repos/ntbl/bz-reader/releases/latest', new Error('HTTP 403')],
      ['gitee.com/ntbl/bz-reader/raw/master/manifest.json', MANIFEST],
    ]);
    const rel = await fetchLatestReaderRelease();
    expect(rel).toMatchObject({ version: '0.2.0', via: 'gitee' });
  });

  it('两条通道都不通 → 原因两边都写出来（不只一句「失败」）', async () => {
    route([
      ['github.com', new Error('getaddrinfo ENOTFOUND github.com')],
      ['gitee.com', new Error('getaddrinfo ENOTFOUND gitee.com')],
    ]);
    await expect(fetchLatestReaderRelease()).rejects.toThrow(/GitHub.*码云/);
  });

  it('拿到的不是 bz-reader 的 manifest → 拒收，不当成版本', async () => {
    route([['manifest.json', JSON.stringify({ id: 'other-plugin', version: '9.9.9' })]]);
    await expect(fetchLatestReaderRelease()).rejects.toThrow(/id 不是 bz-reader/);
  });
});

describe('安装：下载 → 写盘 → 启用', () => {
  it('GitHub 三件套：写对目录、manifest 最后写、软加载启用', async () => {
    const vault = new MockVault();
    const { app, enabled } = appOf(vault);
    route([
      ['/releases/latest/download/manifest.json', MANIFEST],
      ['/releases/download/0.2.0/main.js', MAIN_JS],
      ['/releases/download/0.2.0/styles.css', STYLES],
    ]);

    const r = await installReaderPlugin(app);
    expect(r).toMatchObject({ version: '0.2.0', enabled: true, via: 'github' });

    expect(vault.files.get(`${PLUGIN_DIR}/main.js`)).toBe(MAIN_JS);
    expect(vault.files.get(`${PLUGIN_DIR}/styles.css`)).toBe(STYLES);
    expect(JSON.parse(vault.files.get(`${PLUGIN_DIR}/manifest.json`) as string).version).toBe('0.2.0');

    // manifest 最后写：先写它再写 main.js，中途失败会留下「声称装好却打不开」的坏条目
    const idxManifest = vault.modifiedPaths.indexOf(`${PLUGIN_DIR}/manifest.json`);
    const idxMain = vault.modifiedPaths.indexOf(`${PLUGIN_DIR}/main.js`);
    expect(idxManifest).toBeGreaterThan(idxMain);

    expect(enabled.has(READER_PLUGIN_ID)).toBe(true);
    expect(app.plugins.enablePluginAndSave).toHaveBeenCalledWith(READER_PLUGIN_ID);
  });

  it('GitHub 资产 404 → 码云同 tag 的资产顶上（via=gitee）', async () => {
    const vault = new MockVault();
    const { app } = appOf(vault);
    route([
      ['/releases/latest/download/manifest.json', MANIFEST],
      ['github.com/yeshimei/bz-reader/releases/download/0.2.0/main.js', new Error('HTTP 404')],
      ['github.com/yeshimei/bz-reader/releases/download/0.2.0/styles.css', new Error('HTTP 404')],
      ['gitee.com/ntbl/bz-reader/releases/download/0.2.0/main.js', MAIN_JS],
      ['gitee.com/ntbl/bz-reader/releases/download/0.2.0/styles.css', STYLES],
    ]);
    const r = await installReaderPlugin(app);
    expect(r.via).toBe('gitee');
    expect(vault.files.get(`${PLUGIN_DIR}/main.js`)).toBe(MAIN_JS);
  });

  it('资产是网页（通道被劫持/镜像配错）→ 拒收，不把 HTML 写成 main.js', async () => {
    const vault = new MockVault();
    const { app } = appOf(vault);
    route([
      ['/releases/latest/download/manifest.json', MANIFEST],
      ['/releases/download/0.2.0/main.js', `<!DOCTYPE html><html>${'x'.repeat(2000)}</html>`],
      ['/releases/download/0.2.0/styles.css', STYLES],
    ]);
    await expect(installReaderPlugin(app)).rejects.toThrow(/网页而不是文件/);
    expect(vault.files.has(`${PLUGIN_DIR}/main.js`)).toBe(false);
  });

  it('启用失败只降级（三件套已就位 = enabled false），不把安装说成失败', async () => {
    const vault = new MockVault();
    const { app } = appOf(vault, {
      enablePluginAndSave: undefined,
      enablePlugin: undefined,
    });
    route([
      ['/releases/latest/download/manifest.json', MANIFEST],
      ['/releases/download/0.2.0/main.js', MAIN_JS],
      ['/releases/download/0.2.0/styles.css', STYLES],
    ]);
    const r = await installReaderPlugin(app);
    expect(r.enabled).toBe(false);
    expect(vault.files.has(`${PLUGIN_DIR}/manifest.json`)).toBe(true);
  });
});

describe('常量：两条通道的 slug 与 bz reader 自己的仓库对得上', () => {
  it('GitHub / 码云 slug 与插件 id', () => {
    expect(READER_PLUGIN_ID).toBe('bz-reader');
    expect(READER_REPO_SLUG).toBe('yeshimei/bz-reader');
    expect(READER_GITEE_SLUG).toBe('ntbl/bz-reader');
  });

  it('isReaderEnabled 认 Set / 数组 / 插件实例三种形态', () => {
    expect(isReaderEnabled({ plugins: { enabledPlugins: new Set(['bz-reader']) } })).toBe(true);
    expect(isReaderEnabled({ plugins: { enabledPlugins: ['bz-reader'] } })).toBe(true);
    expect(isReaderEnabled({ plugins: { plugins: { 'bz-reader': {} } } })).toBe(true);
    expect(isReaderEnabled({ plugins: { enabledPlugins: new Set(['other']) } })).toBe(false);
    expect(isReaderEnabled({})).toBe(false);
  });
});
