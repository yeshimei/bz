/**
 * core/offline-source + 镜像源：企业网 / 无外网环境里「下载」这件事的两条出路。
 *
 * 为什么这层值得单测：它是**只在别人的机器上才会走到**的分支（正常用户永远有网）。
 * 一旦路径拼错（比如少一层 downloads/），症状是「离线包明明放了，插件还说没有」，
 * 而开发者在自己机器上永远复现不了。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import {
  OFFLINE_DIR,
  hasOfflinePack,
  offlineDownloadsFileOf,
  offlineFileOf,
  offlineRootOf,
  readOfflineBytes,
  readOfflineText,
} from '../../src/core/offline-source';
import { normalizeMirrorBase, repoBases, downloadRemotesFor } from '../../src/core/remote-base';
import { ensureAssetWithHash } from '../../src/core/remote-asset';
import { textSha256 } from '../../src/core/sha256';
import { MockVault } from '../mock-vault';
import { setSettingsProvider } from '../../src/core/settings-provider';

const BASE = '/mock-vault';

/** 把 window.require('fs') 接到内存树上（离线包读的是真实文件系统，不走 adapter） */
function stubFs(vault: MockVault): void {
  (window as unknown as { require: (m: string) => unknown }).require = (m: string) => {
    if (m !== 'fs') return null;
    return {
      existsSync: (p: string) => {
        const rel = p.startsWith(`${BASE}/`) ? p.slice(BASE.length + 1) : p;
        if (vault.binaryFiles.has(rel) || vault.files.has(rel)) return true;
        // 目录：只要树里有以它开头的键就算在（真 fs 的语义）
        const prefix = `${rel}/`;
        return [...vault.binaryFiles.keys(), ...vault.files.keys()].some((k) => k.startsWith(prefix));
      },
      readFileSync: (p: string) => {
        const rel = p.startsWith(`${BASE}/`) ? p.slice(BASE.length + 1) : p;
        const bytes = vault.binaryFiles.get(rel);
        if (bytes) return Buffer.from(bytes);
        const text = vault.files.get(rel);
        if (text !== undefined) return Buffer.from(text, 'utf8');
        throw new Error(`ENOENT: ${p}`);
      },
    };
  };
}

function appOf(vault: MockVault): unknown {
  return { vault: { adapter: { ...vault.adapter, basePath: BASE }, configDir: '.obsidian' } };
}

beforeEach(() => {
  vi.mocked(requestUrl).mockReset();
  setSettingsProvider(() => ({ resourceMirror: '' }) as never);
});

afterEach(() => {
  delete (window as unknown as { require?: unknown }).require;
});

describe('离线包的路径口径（vault 根 / bz-offline，逐字镜像仓库 downloads/）', () => {
  it('根目录与下载资源路径', () => {
    const app = appOf(new MockVault());
    expect(offlineRootOf(app)).toBe(`${BASE}/${OFFLINE_DIR}`);
    expect(offlineFileOf(app, 'downloads/manifest.json')).toBe(`${BASE}/${OFFLINE_DIR}/downloads/manifest.json`);
    expect(offlineDownloadsFileOf(app, 'tools/bili-downloader.tar.gz')).toBe(
      `${BASE}/${OFFLINE_DIR}/downloads/tools/bili-downloader.tar.gz`,
    );
  });

  it('拿不到 vault 路径 → 空串（不抛、不拼出诡异的相对路径）', () => {
    expect(offlineRootOf({ vault: { adapter: {} } })).toBe('');
    expect(offlineFileOf({ vault: { adapter: {} } }, 'x')).toBe('');
  });

  it('读不到文件 → null（不是空串，也不是抛错）', async () => {
    const vault = new MockVault();
    stubFs(vault);
    expect(await readOfflineBytes(appOf(vault), 'downloads/none.json')).toBe(null);
    expect(await readOfflineText(appOf(vault), 'downloads/none.json')).toBe(null);
    expect(hasOfflinePack(appOf(vault))).toBe(false);
  });

  it('放了就有：文本按 UTF-8 解出，二进制原样给出', async () => {
    const vault = new MockVault();
    vault.files.set(`${OFFLINE_DIR}/downloads/manifest.json`, '{"version":1}');
    vault.binaryFiles.set(`${OFFLINE_DIR}/node/node-v24.14.1-win-x64.zip`, new Uint8Array([0x50, 0x4b, 3, 4]));
    stubFs(vault);
    const app = appOf(vault);
    expect(hasOfflinePack(app)).toBe(true);
    expect(await readOfflineText(app, 'downloads/manifest.json')).toBe('{"version":1}');
    expect(Array.from((await readOfflineBytes(app, 'node/node-v24.14.1-win-x64.zip'))!)).toEqual([0x50, 0x4b, 3, 4]);
  });
});

describe('离线副本也要过 sha256：本地文件不是免检通道', () => {
  it('离线副本 hash 正确 → 直接用（网络一次都不打）', async () => {
    const vault = new MockVault();
    const text = '{"hello":"world"}';
    vault.files.set(`${OFFLINE_DIR}/downloads/changelog.html`, text);
    stubFs(vault);
    vi.mocked(requestUrl).mockRejectedValue(new Error('断网'));

    const got = await ensureAssetWithHash(appOf(vault), 'changelog.html', textSha256(text), '更新日志');
    expect(got).toBe(text);
    expect(requestUrl).not.toHaveBeenCalled();
    // 落到插件自己的 downloads/ —— 后面读的地方全走这一条
    expect(vault.files.get('.obsidian/plugins/bz/downloads/changelog.html')).toBe(text);
  });

  it('离线副本 hash 对不上 → 不能冒充正版，继续走网络（这里断网 → 报错）', async () => {
    const vault = new MockVault();
    vault.files.set(`${OFFLINE_DIR}/downloads/changelog.html`, '<html>旧版本</html>');
    stubFs(vault);
    vi.mocked(requestUrl).mockRejectedValue(new Error('断网'));

    await expect(
      ensureAssetWithHash(appOf(vault), 'changelog.html', textSha256('<html>新版</html>'), '更新日志'),
    ).rejects.toThrow(/下载失败/);
    expect(vault.files.has('.obsidian/plugins/bz/downloads/changelog.html')).toBe(false);
  });
});

describe('自定义镜像基址', () => {
  it('只接受 http/https，去尾斜杠；乱填的一律忽略', () => {
    expect(normalizeMirrorBase('http://nas.local/bz/')).toBe('http://nas.local/bz');
    expect(normalizeMirrorBase('https://mirror.example.com/bz')).toBe('https://mirror.example.com/bz');
    expect(normalizeMirrorBase('ftp://x/y')).toBe('');
    expect(normalizeMirrorBase('内网/bz')).toBe('');
    expect(normalizeMirrorBase('')).toBe('');
  });

  it('配了镜像 → 静态基址只有镜像；没配 → 空（官方 CDN 快照层 2026-11-02 已整条退场）', () => {
    expect(repoBases()).toEqual([]);
    setSettingsProvider(() => ({ resourceMirror: 'http://nas.local/bz, https://b.example.com/bz' }) as never);
    const bases = repoBases();
    expect(bases).toEqual(['http://nas.local/bz', 'https://b.example.com/bz']);
    expect(downloadRemotesFor('changelog.html')[0]).toBe('http://nas.local/bz/downloads/changelog.html');
  });
});
