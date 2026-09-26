/**
 * 使用手册下载/内嵌打开测试（issue 473，数据层 + 链路）
 * 链路：downloadManual（双远端兜底 + 内容校验 + 失败透原因）→ readManual /
 * ensureManualReady（无则下载，返回手册文本交弹窗层 srcdoc 内嵌渲染——
 * 打开方式用户二次拍板为 OB 内弹窗，系统打开链路 shell.openPath /
 * openExternalUrl file:/// 已退役）。附带 openExternalUrl 的 openUrl 异步
 * rejection 落兜底链回归（原实现只接同步抛错 → Uncaught (in promise)）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, hasNotice, clearNotices } from './mock-obsidian-entry';
import { downloadManual, hasManual, readManual, ensureManualReady, manualVaultPath, MANUAL_FILENAME } from '../src/core/manual';
import { openExternalUrl } from '../src/core/utils';
import { MockVault } from './mock-vault';

const MANUAL_HTML = '<!DOCTYPE html><html><head><title>包仔使用手册</title></head><body>目录</body></html>';
const STORED = `.obsidian/plugins/bz/${MANUAL_FILENAME}`;

const newVault = () => new MockVault();
const appOf = (vault: MockVault, extra: Record<string, unknown> = {}) =>
  ({ vault, workspace: {}, ...extra }) as any;

beforeEach(() => {
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  vi.mocked(requestUrl).mockReset();
  // 缺省：主远端返回合法手册页；个别用例再覆盖
  vi.mocked(requestUrl).mockResolvedValue({ status: 200, text: MANUAL_HTML } as any);
});

describe('downloadManual（issue 473）', () => {
  it('成功：写进插件目录（覆盖口径），hasManual 随之为真', async () => {
    const vault = newVault();
    expect(await hasManual(appOf(vault))).toBe(false);
    await downloadManual(appOf(vault));
    expect(vault.files.get(STORED)).toBe(MANUAL_HTML);
    expect(await hasManual(appOf(vault))).toBe(true);
  });

  it('主远端返回错误页（不像手册）→ 备远端接管；两路都不像 → 抛错含原因', async () => {
    const vault = newVault();
    vi.mocked(requestUrl)
      .mockResolvedValueOnce({ status: 200, text: '{"error":"Not Found"}' } as any)
      .mockResolvedValueOnce({ status: 200, text: MANUAL_HTML } as any);
    await downloadManual(appOf(vault));
    expect(vault.files.get(STORED)).toBe(MANUAL_HTML);
    expect(requestUrl).toHaveBeenCalledTimes(2);

    vi.mocked(requestUrl).mockResolvedValue({ status: 200, text: 'not a manual' } as any);
    await expect(downloadManual(appOf(newVault()))).rejects.toThrow(/手册下载失败/);
  });

  it('网络失败 → 抛错消息带上最后失败原因（人话透传）', async () => {
    vi.mocked(requestUrl).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    await expect(downloadManual(appOf(newVault()))).rejects.toThrow(/手册下载失败.*ENOTFOUND/s);
  });
});

describe('readManual / ensureManualReady（issue 473 二次拍板：OB 内弹窗打开）', () => {
  it('readManual：未下载 → null；已下载 → 手册文本', async () => {
    const vault = newVault();
    expect(await readManual(appOf(vault))).toBeNull();
    await downloadManual(appOf(vault));
    expect(await readManual(appOf(vault))).toBe(MANUAL_HTML);
  });

  it('ensureManualReady：无手册 → 下载后返回文本；已有 → 直接读不重复下载', async () => {
    const vault = newVault();
    expect(await ensureManualReady(appOf(vault))).toBe(MANUAL_HTML);
    expect(vault.files.get(STORED)).toBe(MANUAL_HTML);
    expect(await ensureManualReady(appOf(vault))).toBe(MANUAL_HTML);
    expect(requestUrl).toHaveBeenCalledTimes(1); // 第二次不重复下载
  });

  it('陈旧半截文件自愈：本地内容为空 → 视同未下载重下', async () => {
    const vault = newVault();
    vault.files.set(STORED, '');
    expect(await ensureManualReady(appOf(vault))).toBe(MANUAL_HTML);
    expect(requestUrl).toHaveBeenCalledTimes(1);
  });

  it('读取异常自愈：adapter.read 抛错一次 → 落回下载通道重下', async () => {
    const vault = newVault();
    vault.files.set(STORED, MANUAL_HTML);
    const origRead = vault.adapter.read.bind(vault.adapter);
    vault.adapter.read = async (path: string) => {
      vault.adapter.read = origRead; // 只炸第一次
      throw new Error('EBUSY');
    };
    expect(await ensureManualReady(appOf(vault))).toBe(MANUAL_HTML);
  });

  it('下载失败 → 抛人话 Error（含原因），弹窗层负责 notice', async () => {
    vi.mocked(requestUrl).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    await expect(ensureManualReady(appOf(newVault()))).rejects.toThrow(/手册下载失败.*ENOTFOUND/s);
  });

  it('manualVaultPath：跟随 vault.configDir，缺省兜底 .obsidian', () => {
    expect(manualVaultPath({ vault: { configDir: '.obsidian' } })).toBe(`.obsidian/plugins/bz/${MANUAL_FILENAME}`);
    expect(manualVaultPath({})).toBe(`.obsidian/plugins/bz/${MANUAL_FILENAME}`);
  });
});

describe('openExternalUrl：openUrl 异步 rejection 落兜底链（issue 473 回归，memo/favorites/knowledge 等调用方共用）', () => {
  /** mock 桌面端 electron */
  function mockElectron(openExternal: (u: string) => Promise<void>): void {
    (window as unknown as { require: (id: string) => unknown }).require = (id: string) => {
      if (id === 'electron') return { shell: { openExternal } };
      throw new Error('module not found: ' + id);
    };
  }

  beforeEach(() => {
    delete (window as unknown as { require?: unknown }).require;
  });

  it('openUrl reject → 落 electron openExternal；openExternal 也 reject → 落 window.open', async () => {
    const openExternal = vi.fn(async () => { throw new Error('Failed to open: 0x2'); });
    mockElectron(openExternal);
    const winOpen = vi.spyOn(window, 'open').mockReturnValue(window as unknown as Window);
    const app = { openUrl: () => Promise.reject(new Error('Failed to open: 系统找不到指定的文件。 (0x2)')) };
    openExternalUrl(app, 'https://example.com');
    await new Promise((r) => setTimeout(r, 0));
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
    expect(winOpen).toHaveBeenCalledWith('https://example.com', '_blank');
    winOpen.mockRestore();
  });

  it('全链失败 → 人话 error 通知（不再 Uncaught (in promise)）', async () => {
    mockElectron(async () => { throw new Error('0x2'); });
    const winOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    const app = { openUrl: () => Promise.reject(new Error('nope')) };
    openExternalUrl(app, 'https://example.com');
    await new Promise((r) => setTimeout(r, 0));
    expect(hasNotice('无法打开链接，请复制到浏览器打开')).toBe(true);
    winOpen.mockRestore();
  });

  it('openUrl 缺失（同步 TypeError）→ 原口径落 electron 兜底', () => {
    const openExternal = vi.fn(async () => {});
    mockElectron(openExternal);
    openExternalUrl({}, 'https://example.com');
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
  });
});
