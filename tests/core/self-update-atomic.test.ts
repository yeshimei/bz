// @vitest-environment jsdom
/**
 * 自更新落盘（ADR-0282）：空间预检 + 原子替换 + 半装回滚。
 *
 * 为什么这层值得单测：这是**唯一一处能把用户永久焊死**的地方。自更新的代码就在它自己
 * 覆盖的那个 main.js 里——一旦磁盘上留下半截 main.js，插件加载失败，没有任何代码能跑，
 * 备份明明在也没人能拷回去。所以三条要钉死：
 *   1. 正本只经 rename 替换（先写 .bz-tmp、读回核对）；
 *   2. 任何一件写失败，已替换的按备份退回（半装比没装贵）；
 *   3. 空间不够在动手之前就退出（连备份都不做）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { checkSelfUpdate, resetSelfUpdateState, selfUpdateState } from '../../src/core/self-update';
import { setPluginRelDir } from '../../src/core/plugin-path';

const ROOT = '/mock-vault-root';
const PLUGIN = '.obsidian/plugins/bz';
const LOCAL = '1.33.0';
const NEW = '1.34.0';
const TAG = 'v1.34.0';
const OLD_JS = '/*old-bundle-' + 'o'.repeat(1200) + '*/';
const OLD_CSS = '/*old-css*/';

/** 三件套齐全的本地安装（备份才有东西可回滚） */
function appWithFullPlugin(): { vault: MockVault; plugins: { manifests: Record<string, { version: string }> } } {
  const vault = new MockVault();
  vault.files.set(`${PLUGIN}/manifest.json`, JSON.stringify({ id: 'bz', version: LOCAL }));
  vault.files.set(`${PLUGIN}/main.js`, OLD_JS);
  vault.files.set(`${PLUGIN}/styles.css`, OLD_CSS);
  // vaultBasePathOf 读 adapter.basePath（真机是 FileSystemAdapter.getBasePath）
  (vault.adapter as unknown as { basePath: string }).basePath = ROOT;
  return { vault, plugins: { manifests: { bz: { version: LOCAL } } } };
}

interface FakeFsOpts {
  /** 剩余空间（字节）；缺省 1 GB */
  freeBytes?: number;
  /** 第一次 rename 到该相对路径时抛错（模拟杀软/同步盘瞬时锁文件；之后放行，回滚才能成功） */
  failRenameOnce?: string;
  /** rename 到这些相对路径恒定失败（模拟装不上也退不回去的死局） */
  failRenameAlways?: string[];
  /** 第一次写该相对路径时抛错（模拟写临时件就 ENOSPC） */
  failWriteOnce?: string;
}

/** 覆盖在 MockVault.files 上的假 Node fs（绝对路径 ↔ vault 相对路径 一比一映射） */
function mountFakeFs(vault: MockVault, opts: FakeFsOpts = {}) {
  const calls: string[] = [];
  const failed = new Set<string>();
  const rel = (p: string) => (p.startsWith(`${ROOT}/`) ? p.slice(ROOT.length + 1) : p);
  const fs = {
    calls,
    writeFileSync: (p: string, d: string) => {
      const k = rel(p);
      calls.push(`write:${k}`);
      if (opts.failWriteOnce === k && !failed.has(k)) {
        failed.add(k);
        throw new Error('ENOSPC: no space left on device');
      }
      vault.files.set(k, d);
    },
    readFileSync: (p: string) => {
      const v = vault.files.get(rel(p));
      if (v === undefined) throw new Error('ENOENT: ' + p);
      return v;
    },
    unlinkSync: (p: string) => {
      vault.files.delete(rel(p));
    },
    renameSync: (a: string, b: string) => {
      const from = rel(a);
      const to = rel(b);
      calls.push(`rename:${from}->${to}`);
      if ((opts.failRenameAlways ?? []).includes(to)) throw new Error('EPERM: operation not permitted');
      if (opts.failRenameOnce === to && !failed.has(to)) {
        failed.add(to);
        throw new Error('EPERM: operation not permitted');
      }
      const v = vault.files.get(from);
      if (v === undefined) throw new Error(`ENOENT: no such file, rename '${from}' -> '${to}'`);
      vault.files.delete(from);
      vault.files.set(to, v);
    },
    existsSync: (p: string) => vault.files.has(rel(p)),
    statfsSync: () => ({ bavail: Math.floor((opts.freeBytes ?? 1024 * 1024 * 1024) / 4096), bsize: 4096 }),
  };
  (window as unknown as { require: (m: string) => unknown }).require = (m: string) =>
    m === 'fs' ? fs : undefined;
  return fs;
}

/** 远端发布了 NEW：指针 + 三件套 */
function stubRemote(): void {
  vi.mocked(requestUrl).mockImplementation((async ({ url }: { url: string }) => {
    if (url.includes('/releases/latest/download/downloads-manifest.json')) {
      return { status: 200, text: JSON.stringify({ version: 1, release: { version: NEW, tag: TAG } }) };
    }
    if (url.includes('/downloads/version.json')) {
      return { status: 200, text: JSON.stringify({ version: NEW, tag: TAG }) };
    }
    if (url.includes(`/releases/download/${TAG}/main.js`)) {
      return { status: 200, text: '/*new-bundle-' + 'n'.repeat(1200) + '*/' };
    }
    if (url.includes(`/releases/download/${TAG}/styles.css`)) return { status: 200, text: '/*new-css*/' };
    if (url.includes(`/releases/download/${TAG}/manifest.json`)) {
      return { status: 200, text: JSON.stringify({ id: 'bz', version: NEW }) };
    }
    throw new Error('offline');
  }) as never);
}

beforeEach(() => {
  resetObsidianMocks();
  resetSelfUpdateState();
  setPluginRelDir('');
  vi.mocked(requestUrl).mockReset();
  try {
    localStorage.clear();
  } catch {
    /* jsdom 里一定有 */
  }
});

afterEach(() => {
  delete (window as unknown as { require?: unknown }).require;
});

describe('原子替换：正本只经 rename 换上去', () => {
  it('先写 .bz-tmp 再 rename，从不直接往 main.js 里写', async () => {
    const app = appWithFullPlugin();
    const fs = mountFakeFs(app.vault);
    stubRemote();

    expect(await checkSelfUpdate(app, { apply: true })).toBe('installed');

    // 顺序：写临时件 → 改名（临时件内容读回核对过才会走到 rename）
    const tmpWrite = fs.calls.indexOf(`write:${PLUGIN}/main.js.bz-tmp`);
    const rename = fs.calls.indexOf(`rename:${PLUGIN}/main.js.bz-tmp->${PLUGIN}/main.js`);
    expect(tmpWrite).toBeGreaterThanOrEqual(0);
    expect(rename).toBeGreaterThan(tmpWrite);
    // 没有任何一次「直接写正本」（那正是半截文件的来源）
    expect(fs.calls).not.toContain(`write:${PLUGIN}/main.js`);
    expect(fs.calls).not.toContain(`write:${PLUGIN}/styles.css`);
    // 临时件不留在盘上
    expect(app.vault.files.has(`${PLUGIN}/main.js.bz-tmp`)).toBe(false);
    expect(String(app.vault.files.get(`${PLUGIN}/main.js`))).toContain('new-bundle');
  });
});

describe('失败面：不许留下半套', () => {
  it('临时件就写不进去（ENOSPC）→ 报「没有改动任何文件」，正本一字未动', async () => {
    const app = appWithFullPlugin();
    mountFakeFs(app.vault, { failWriteOnce: `${PLUGIN}/main.js.bz-tmp` });
    stubRemote();

    await expect(checkSelfUpdate(app, { apply: true })).rejects.toThrow(/没有改动任何文件/);
    expect(app.vault.files.get(`${PLUGIN}/main.js`)).toBe(OLD_JS);
    expect(app.vault.files.get(`${PLUGIN}/styles.css`)).toBe(OLD_CSS);
    expect(app.vault.files.get(`${PLUGIN}/manifest.json`)).toContain(LOCAL);
    // 没记账：面板不该说「已下载新版，重载后生效」
    expect((await selfUpdateState(app)).pending).toBeNull();
  });

  it('第二件（styles.css）替换失败 → 前面换上去的 main.js 自动按备份退回', async () => {
    const app = appWithFullPlugin();
    mountFakeFs(app.vault, { failRenameOnce: `${PLUGIN}/styles.css` });
    stubRemote();

    await expect(checkSelfUpdate(app, { apply: true })).rejects.toThrow(/已自动回滚到 v1\.33\.0/);
    // 三件套全部回到旧版：不能出现「新 JS + 旧 CSS」这种半装
    expect(app.vault.files.get(`${PLUGIN}/main.js`)).toBe(OLD_JS);
    expect(app.vault.files.get(`${PLUGIN}/styles.css`)).toBe(OLD_CSS);
    expect(app.vault.files.get(`${PLUGIN}/manifest.json`)).toContain(LOCAL);
    // 回滚后那条「待重载」作废
    expect((await selfUpdateState(app)).pending).toBeNull();
  });

  it('回滚也失败时，错误里带上备份目录，别让人只看到一句「失败」', async () => {
    const app = appWithFullPlugin();
    // styles.css 恒定 rename 失败：装不上，也退不回去
    mountFakeFs(app.vault, { failRenameAlways: [`${PLUGIN}/styles.css`] });
    stubRemote();

    await expect(checkSelfUpdate(app, { apply: true })).rejects.toThrow(
      /回滚失败，备份在 downloads\/\.backup\/1\.33\.0/,
    );
  });
});

describe('写前预检', () => {
  it('空间不够 → 动手之前就退出（连备份都不做），正本不动', async () => {
    const app = appWithFullPlugin();
    mountFakeFs(app.vault, { freeBytes: 3 * 1024 * 1024 });
    stubRemote();

    await expect(checkSelfUpdate(app, { apply: true })).rejects.toThrow(/磁盘空间不足/);
    expect(app.vault.files.get(`${PLUGIN}/main.js`)).toBe(OLD_JS);
    expect(app.vault.files.get(`${PLUGIN}/manifest.json`)).toContain(LOCAL);
    // 预检在备份之前：备份目录一个文件都不该出现
    expect([...app.vault.files.keys()].some((k) => k.includes('downloads/.backup'))).toBe(false);
  });
});

describe('兜底：拿不到 Node fs 时退回 adapter 直写', () => {
  it('没有 window.require 也照常装（行为与改动前一致，不因取不到 fs 而放弃更新）', async () => {
    const app = appWithFullPlugin();
    stubRemote();

    expect(await checkSelfUpdate(app, { apply: true })).toBe('installed');
    expect(String(app.vault.files.get(`${PLUGIN}/main.js`))).toContain('new-bundle');
    expect(app.vault.files.has(`${PLUGIN}/main.js.bz-tmp`)).toBe(false);
  });
});
