// @vitest-environment jsdom
/**
 * 自更新（core/self-update.ts）：发布指针 + tag 通道。
 *
 * 2026-10-28 对外分发时改了四件事，这里各钉一条：
 *  1. 产物**从 tag 拉**，不从 master 拉（`@master` 等于每推一次主干所有人都换代码）；
 *  2. `autoUpdate` 关着时**只查不装**（发现新版记下来，磁盘一个字节不动）；
 *  3. 装之前**备份旧三件套**（此前没有回滚，推一次坏包所有人焊死）；
 *  4. 装完记 pending（面板据此说「重载后生效」，而不是让人以为没更新）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { checkSelfUpdate, resetSelfUpdateState, selfUpdateState } from '../../src/core/self-update';
import { setSettingsProvider } from '../../src/core/settings-provider';

const LOCAL = '1.33.0';
const NEW = '1.34.0';
const TAG = 'v1.34.0';

function appWithPlugin(): { vault: MockVault; plugins: { manifests: Record<string, { version: string }> } } {
  const vault = new MockVault();
  vault.files.set('.obsidian/plugins/bz/manifest.json', JSON.stringify({ id: 'bz', version: LOCAL }));
  // 运行中版本（Obsidian 加载插件时缓存的清单）：自更新装完但没重载时，它仍是旧版本
  return { vault, plugins: { manifests: { bz: { version: LOCAL } } } };
}

/** 一个「远端发布了 1.34.0」的完整假网络（记录每次请求的 URL，用来断言走的是 tag 还是 master） */
function stubRemote(opts: { pointerVersion?: string; badBundle?: boolean } = {}): string[] {
  const seen: string[] = [];
  const js = '/*' + 'x'.repeat(3000) + '*/';
  const css = '/*' + 'y'.repeat(3000) + '*/';
  const manifest = JSON.stringify({ id: 'bz', version: opts.pointerVersion ?? NEW });
  vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
    seen.push(url);
    // 指针三形态里的清单形态（2026-10-31 合并）：Release latest 的清单顶层带 `release`
    if (url.includes('/releases/latest/download/downloads/manifest.json')) {
      return { status: 200, text: JSON.stringify({ version: 1, release: { version: NEW, tag: TAG } }) };
    }
    if (url.includes('/downloads/version.json')) {
      return { status: 200, text: JSON.stringify({ version: NEW, tag: TAG }) };
    }
    if (url.includes(`/releases/${TAG}/main.js`)) {
      return { status: 200, text: opts.badBundle ? '<!DOCTYPE html><html>404</html>' : js };
    }
    if (url.includes(`/releases/${TAG}/styles.css`)) {
      return { status: 200, text: css };
    }
    if (url.includes(`/releases/${TAG}/manifest.json`)) {
      return { status: 200, text: manifest };
    }
    throw new Error('offline');
  }) as never);
  return seen;
}

beforeEach(() => {
  resetObsidianMocks();
  resetSelfUpdateState();
  vi.mocked(requestUrl).mockReset();
  try {
    localStorage.clear();
  } catch {
    /* jsdom 里一定有 */
  }
});

describe('checkSelfUpdate：只查不装', () => {
  it('apply=false：发现新版只记账，磁盘三件套一个字节不动', async () => {
    const app = appWithPlugin();
    const { vault } = app;
    stubRemote();
    const before = vault.files.get('.obsidian/plugins/bz/manifest.json');

    const r = await checkSelfUpdate(app, { apply: false, throttle: false });

    expect(r).toBe('available');
    expect(vault.files.get('.obsidian/plugins/bz/manifest.json')).toBe(before);
    expect(vault.files.has('.obsidian/plugins/bz/main.js')).toBe(false);
    // 面板要能读到「有新版」
    const st = await selfUpdateState(app);
    expect(st.available?.version).toBe(NEW);
    expect(st.pending).toBeNull();
  });

  it('已是最新 → current，不下载任何东西', async () => {
    const app = appWithPlugin();
    const { vault } = app;
    const seen: string[] = [];
    vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
      seen.push(url);
      if (url.includes('version.json')) return { status: 200, text: JSON.stringify({ version: LOCAL, tag: 'v1.33.0' }) };
      throw new Error('不该再请求：' + url);
    }) as never);

    const r = await checkSelfUpdate(app, { apply: true, throttle: false });
    expect(r).toBe('current');
    expect(vault.files.has('.obsidian/plugins/bz/main.js')).toBe(false);
  });
});

describe('checkSelfUpdate：安装', () => {
  it('apply=true：从 tag 拉三件套 → 备份旧版 → 覆盖 → 记 pending', async () => {
    const app = appWithPlugin();
    const { vault } = app;
    const seen = stubRemote();

    const r = await checkSelfUpdate(app, { apply: true, throttle: false });

    expect(r).toBe('installed');
    // 三件套都覆盖了
    expect(vault.files.get('.obsidian/plugins/bz/manifest.json')).toContain(NEW);
    expect(String(vault.files.get('.obsidian/plugins/bz/main.js')).length).toBeGreaterThan(1000);
    expect(vault.files.has('.obsidian/plugins/bz/styles.css')).toBe(true);
    // 旧版备份在 downloads/.backup/<旧版本>/
    expect(vault.files.has(`.obsidian/plugins/bz/downloads/.backup/${LOCAL}/manifest.json`)).toBe(true);
    // 全程走 tag，不碰 master 的三件套
    expect(seen.some((u) => u.includes(`/releases/${TAG}/main.js`))).toBe(true);
    expect(seen.some((u) => /@master\/main\.js|\/master\/main\.js/.test(u))).toBe(false);
    // pending 让面板说「重载后生效」
    const st = await selfUpdateState(app);
    expect(st.pending).toBe(NEW);
    expect(st.onDisk).toBe(NEW);
  });

  it('没传 apply 时跟随设置：autoUpdate 打开（缺省）→ 自动装', async () => {
    const app = appWithPlugin();
    const { vault } = app;
    setSettingsProvider(() => ({ autoUpdate: true }) as never);
    stubRemote();

    const r = await checkSelfUpdate(app, { throttle: false });

    expect(r).toBe('installed');
    expect(vault.files.get('.obsidian/plugins/bz/manifest.json')).toContain(NEW);
  });

  it('没传 apply 时跟随设置：autoUpdate 关着 → 只记账不装', async () => {
    const app = appWithPlugin();
    const { vault } = app;
    setSettingsProvider(() => ({ autoUpdate: false }) as never);
    stubRemote();
    const before = vault.files.get('.obsidian/plugins/bz/manifest.json');

    const r = await checkSelfUpdate(app, { throttle: false });

    expect(r).toBe('available');
    expect(vault.files.get('.obsidian/plugins/bz/manifest.json')).toBe(before);
  });

  it('main.js 像 HTML 错误页（CDN 被墙的常见形态）→ 拒收，不覆盖', async () => {
    const app = appWithPlugin();
    const { vault } = app;
    stubRemote({ badBundle: true });

    await expect(checkSelfUpdate(app, { apply: true, throttle: false })).rejects.toThrow(/内容异常/);
    expect(vault.files.get('.obsidian/plugins/bz/manifest.json')).toContain(LOCAL);
  });
});

describe('checkSelfUpdate：失败面', () => {
  it('发布指针不是 JSON → 抛人话错误，并记进 lastError（面板显示「上次检查失败」）', async () => {
    const app = appWithPlugin();
    const { vault } = app;
    vi.mocked(requestUrl).mockImplementation((async () => ({ status: 200, text: 'not json' })) as never);

    // 全是非指针内容 → 逐条通道校验后仍拿不到指针，才算失败（且失败信息里带上「内容不是发布指针」）
    await expect(checkSelfUpdate(app, { apply: false, throttle: false })).rejects.toThrow(/拿不到发布指针/);
    const st = await selfUpdateState(app);
    expect(st.error).toContain('发布指针');
  });

  it('指针的 tag 不可用（含斜杠 / 空）→ 拒绝拼 URL', async () => {
    const app = appWithPlugin();
    const { vault } = app;
    vi.mocked(requestUrl).mockImplementation((async () => ({
      status: 200,
      text: JSON.stringify({ version: NEW, tag: '../refs/heads/master' }),
    })) as never);

    // 非法 tag 视作「这条通道不是有效指针」，全部通道都无效才失败——绝不把坏 tag 拼进 URL
    await expect(checkSelfUpdate(app, { apply: true, throttle: false })).rejects.toThrow(/拿不到发布指针/);
    expect(vault.files.get('.obsidian/plugins/bz/manifest.json')).toContain(LOCAL);
  });
});

/**
 * 2026-10-31 v1.37.0 首发翻车回归：装完 1.37 再点检查更新，弹出「检查更新失败：发布指针的 tag
 * 不可用：…@master/downloads/manifest.json」。
 *
 * 根因：`fetchPointer` 拿到 HTTP 200 就把内容当指针解析，而分发仓镜像上的清单可能还是
 * **没有 release 字段的旧清单**（顶层 version 是 schema 版本 1、没有 tag）→ 解析抛错 →
 * 后面的 version.json 根本不再试 → 面板把「已是最新」显示成「服务异常」。
 */
describe('回归：通道内容不是指针 → 换通道，而不是报错', () => {
  const OLD_MANIFEST = JSON.stringify({ version: 1, docs: [], skins: [], rowOrder: [] });

  it('latest 404 + 镜像清单还是旧版（无 release）+ version.json 同版本 → current，不报错', async () => {
    const app = appWithPlugin(); // 本地 1.33.0
    const { vault } = app;
    vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
      if (url.includes('/releases/latest/download/')) throw new Error('404 Not Found');
      if (url.includes('/downloads/manifest.json')) return { status: 200, text: OLD_MANIFEST };
      if (url.includes('/downloads/version.json'))
        return { status: 200, text: JSON.stringify({ version: LOCAL, tag: `v${LOCAL}` }) };
      throw new Error('unexpected ' + url);
    }) as never);

    const r = await checkSelfUpdate(app, { apply: true, throttle: false });

    expect(r).toBe('current');
    const st = await selfUpdateState(app);
    expect(st.error).toBeNull();
    expect(vault.files.has('.obsidian/plugins/bz/main.js')).toBe(false);
  });

  it('本地已是 1.37.0，发布页也还是 1.37.0 → current（首发事故的那一步）', async () => {
    const vault = new MockVault();
    vault.files.set('.obsidian/plugins/bz/manifest.json', JSON.stringify({ id: 'bz', version: '1.37.0' }));
    const app = { vault, plugins: { manifests: { bz: { version: '1.37.0' } } } };
    vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
      if (url.includes('/releases/latest/download/')) throw new Error('404 Not Found');
      if (url.includes('/downloads/manifest.json')) return { status: 200, text: OLD_MANIFEST };
      if (url.includes('/downloads/version.json'))
        return { status: 200, text: JSON.stringify({ version: '1.37.0', tag: 'v1.37.0' }) };
      throw new Error('unexpected ' + url);
    }) as never);

    expect(await checkSelfUpdate(app, { apply: true, throttle: false })).toBe('current');
    expect((await selfUpdateState(app)).error).toBeNull();
  });

  it('1.38.0 发布后：新指针 → 正常装到 1.38.0', async () => {
    const vault = new MockVault();
    vault.files.set('.obsidian/plugins/bz/manifest.json', JSON.stringify({ id: 'bz', version: '1.37.0' }));
    const app = { vault, plugins: { manifests: { bz: { version: '1.37.0' } } } };
    const js = '/*' + 'x'.repeat(3000) + '*/';
    vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
      if (url.includes('/releases/latest/download/downloads-manifest.json')) {
        return { status: 200, text: JSON.stringify({ version: 1, release: { version: '1.38.0', tag: 'v1.38.0' } }) };
      }
      if (url.endsWith('/v1.38.0/main.js')) return { status: 200, text: js };
      if (url.endsWith('/v1.38.0/styles.css')) return { status: 200, text: '/*css*/' };
      if (url.endsWith('/v1.38.0/manifest.json'))
        return { status: 200, text: JSON.stringify({ id: 'bz', version: '1.38.0' }) };
      throw new Error('unexpected ' + url);
    }) as never);

    expect(await checkSelfUpdate(app, { apply: true, throttle: false })).toBe('installed');
    expect(vault.files.get('.obsidian/plugins/bz/manifest.json')).toContain('1.38.0');
  });
});
