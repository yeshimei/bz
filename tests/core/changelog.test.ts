/**
 * 更新日志下载/内嵌打开测试（issue 474，数据层 + 链路）
 * 链路：更新日志不再随构建分发（旧产物 src/settings-panel/changelog-data.ts 已退役），
 * 改为发布 manual/bz-changelog.html，用户点入口时 core/changelog.ensureChangelogReady
 * 现场下载（双远端兜底 + 内容校验 + 失败透原因）→ 返回 HTML 文本交弹窗层 srcdoc 内嵌。
 * 失败不兜底（用户拍板）：不退回内置快照，抛人话 Error 由入口层出 notice。
 * 与手册共用内核 core/remote-asset.ts，此处钉更新日志自己的文件名校验口径。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, clearNotices } from './../mock-obsidian-entry';
import {
  CHANGELOG_FILENAME,
  changelogVaultPath,
  ensureChangelogReady,
} from '../../src/core/changelog';
import {
  assetVaultPath,
  ensureAssetReady,
  hasAsset,
  readAsset,
  remotesFor,
} from '../../src/core/remote-asset';
import { MockVault } from '../mock-vault';

const CHG_HTML = '<!DOCTYPE html><html><head><title>包仔更新日志</title></head><body><script>\nconst DATA = {"current":"1.24.0","releases":[]};\n</script></body></html>';
const STORED = `.obsidian/plugins/bz/${CHANGELOG_FILENAME}`;
const REMOTE_RAW = 'https://raw.githubusercontent.com/yeshimei/bz/master/manual/bz-changelog.html';
const REMOTE_CDN = 'https://cdn.jsdelivr.net/gh/yeshimei/bz@master/manual/bz-changelog.html';

const newVault = () => new MockVault();
const appOf = (vault: MockVault, extra: Record<string, unknown> = {}) =>
  ({ vault, workspace: {}, ...extra }) as any;

beforeEach(() => {
  resetObsidianMocks();
  clearNotices();
  vi.mocked(requestUrl).mockReset();
  vi.mocked(requestUrl).mockResolvedValue({ status: 200, text: CHG_HTML } as any);
});

describe('remotesFor / assetVaultPath（issue 474 共用内核）', () => {
  it('双远端顺序：raw.githubusercontent 主 → jsDelivr 备，同仓库同路径', () => {
    expect(remotesFor(CHANGELOG_FILENAME)).toEqual([REMOTE_RAW, REMOTE_CDN]);
  });

  it('落盘路径 = 插件安装目录（跟随 configDir），非数据目录', () => {
    expect(assetVaultPath(appOf(newVault()), CHANGELOG_FILENAME)).toBe(STORED);
    expect(changelogVaultPath(appOf(newVault(), { vault: { configDir: '.myconfig' } }))).toBe(
      `.myconfig/plugins/bz/${CHANGELOG_FILENAME}`,
    );
  });
});

describe('ensureChangelogReady（issue 474 一键口径）', () => {
  it('首次打开（本地无）→ 下载写入插件目录 → 返回 HTML 文本', async () => {
    const vault = newVault();
    const text = await ensureChangelogReady(appOf(vault));
    expect(text).toBe(CHG_HTML);
    expect(vault.files.get(STORED)).toBe(CHG_HTML);
    expect(await hasAsset(appOf(vault), CHANGELOG_FILENAME)).toBe(true);
  });

  it('已下载 → 直接读，不再发请求', async () => {
    const vault = newVault();
    vault.files.set(STORED, CHG_HTML);
    const text = await ensureChangelogReady(appOf(vault));
    expect(text).toBe(CHG_HTML);
    expect(requestUrl).not.toHaveBeenCalled();
  });

  it('主远端返回错误页（不像日志）→ 备远端接管', async () => {
    const vault = newVault();
    vi.mocked(requestUrl)
      .mockResolvedValueOnce({ status: 200, text: '<html>404 Not Found</html>' } as any)
      .mockResolvedValueOnce({ status: 200, text: CHG_HTML } as any);
    await ensureChangelogReady(appOf(vault));
    expect(vault.files.get(STORED)).toBe(CHG_HTML);
    expect(requestUrl).toHaveBeenCalledTimes(2);
  });

  it('两路都不可信 → 抛人话错（含「更新日志下载失败」与最后失败远端），不写文件、不兜底快照', async () => {
    const vault = newVault();
    vi.mocked(requestUrl).mockResolvedValue({ status: 200, text: '{"error":"Not Found"}' } as any);
    await expect(ensureChangelogReady(appOf(vault))).rejects.toThrow(/更新日志下载失败/);
    // 两路都试过（信息含最后失败的那条），且报错内容指明「返回内容不是更新日志页」
    await expect(ensureChangelogReady(appOf(vault))).rejects.toThrow(/jsdelivr\.net.*不是更新日志页/s);
    expect(vault.files.has(STORED)).toBe(false);
  });

  it('网络失败 → 抛人话错并带失败明细', async () => {
    vi.mocked(requestUrl).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    await expect(ensureChangelogReady(appOf(newVault()))).rejects.toThrow(/ENOTFOUND/);
  });

  it('内容校验：真实产物形状（<!DOCTYPE + 数据锚点）放行；只有 HTML 头、缺数据锚点 → 视为不可信换远端', async () => {
    const vault = newVault();
    vi.mocked(requestUrl)
      .mockResolvedValueOnce({ status: 200, text: '<html><body>维护中</body></html>' } as any)
      .mockResolvedValueOnce({ status: 200, text: CHG_HTML } as any);
    await ensureChangelogReady(appOf(vault));
    expect(requestUrl).toHaveBeenCalledTimes(2);
    expect(vault.files.get(STORED)).toBe(CHG_HTML);
  });

  it('本地读取异常 → 视同未下载自愈重下（陈旧半截文件）', async () => {
    const vault = newVault();
    vault.files.set(STORED, ''); // 空串 = 半截文件
    const text = await ensureChangelogReady(appOf(vault));
    expect(text).toBe(CHG_HTML);
    expect(requestUrl).toHaveBeenCalledTimes(1);
  });
});

describe('ensureAssetReady（共用内核边界）', () => {
  it('下载成功但读不回来（写盘异常）→ 抛「下载后读取失败」', async () => {
    const vault = newVault();
    const broken = {
      vault: {
        configDir: '.obsidian',
        adapter: {
          exists: async () => false,
          write: async () => undefined,
          read: async () => '',
        },
      },
    };
    await expect(ensureAssetReady(broken as any, 'x.html', () => true, '资产')).rejects.toThrow(
      /资产下载后读取失败/,
    );
    void vault;
  });

  it('readAsset：未下载 → null；读抛错 → null', async () => {
    expect(await readAsset(appOf(newVault()), 'nope.html')).toBeNull();
    const throwing = {
      vault: { configDir: '.obsidian', adapter: { exists: async () => true, read: async () => { throw new Error('boom'); } } },
    };
    expect(await readAsset(throwing as any, 'x.html')).toBeNull();
  });
});
