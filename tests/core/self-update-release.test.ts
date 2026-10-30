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

    await expect(checkSelfUpdate(app, { apply: false, throttle: false })).rejects.toThrow(/发布指针不是 JSON/);
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

    await expect(checkSelfUpdate(app, { apply: true, throttle: false })).rejects.toThrow(/tag 不可用/);
  });
});
