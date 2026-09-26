/**
 * 使用手册下载/打开测试（issue 473，数据层 + 打开链路）
 * 链路：downloadManual（双远端兜底 + 内容校验 + 失败透原因）→ openManual
 * （先 hasManual 实查文件在不在，electron shell.openPath 优先、失败显原因）→
 * ensureManualOpen 一键口径（footer 入口消费）。附带 openExternalUrl 的
 * openUrl 异步 rejection 落兜底链回归（原实现只接同步抛错 → Uncaught (in promise)）。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, hasNotice, clearNotices } from './mock-obsidian-entry';
import { downloadManual, hasManual, openManual, ensureManualOpen, manualVaultPath, MANUAL_FILENAME } from '../src/core/manual';
import { openExternalUrl } from '../src/core/utils';
import { MockVault } from './mock-vault';

const MANUAL_HTML = '<!DOCTYPE html><html><head><title>包仔使用手册</title></head><body>目录</body></html>';
const STORED = `.obsidian/plugins/bz/${MANUAL_FILENAME}`;
const ABS = `/mock-vault-root/${STORED}`;

const newVault = () => new MockVault();
const appOf = (vault: MockVault, extra: Record<string, unknown> = {}) =>
  ({ vault, workspace: {}, ...extra }) as any;

/** mock 桌面端 electron：openPath 返回空串=成功，字符串=失败原因 */
function mockElectron(shell: { openPath?: (p: string) => Promise<string>; openExternal?: (u: string) => Promise<void> }): void {
  (window as unknown as { require: (id: string) => unknown }).require = (id: string) => {
    if (id === 'electron') return { shell };
    throw new Error('module not found: ' + id);
  };
}

beforeEach(() => {
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  delete (window as unknown as { require?: unknown }).require;
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

describe('openManual（issue 473 重做：openPath 优先 + 显原因）', () => {
  it('未下载 → warn 引导下载，不发起打开', async () => {
    const openPath = vi.fn(async () => '');
    mockElectron({ openPath });
    expect(await openManual(appOf(newVault()))).toBe(false);
    expect(openPath).not.toHaveBeenCalled();
    expect(hasNotice(/尚未下载/)).toBe(true);
  });

  it('已下载 → shell.openPath 收到绝对路径，成功返回 true', async () => {
    const vault = newVault();
    await downloadManual(appOf(vault));
    const openPath = vi.fn(async () => '');
    mockElectron({ openPath });
    expect(await openManual(appOf(vault))).toBe(true);
    expect(openPath).toHaveBeenCalledWith(ABS);
  });

  it('openPath 报原因 → error 通知带原因串，返回 false（不再 Uncaught）', async () => {
    const vault = newVault();
    await downloadManual(appOf(vault));
    mockElectron({ openPath: async () => '系统找不到指定的文件。' });
    expect(await openManual(appOf(vault))).toBe(false);
    expect(hasNotice(/手册打开失败.*找不到指定的文件/s)).toBe(true);
  });

  it('openPath 抛异常 → error 通知带异常消息', async () => {
    const vault = newVault();
    await downloadManual(appOf(vault));
    mockElectron({ openPath: async () => { throw new Error('EBUSY'); } });
    expect(await openManual(appOf(vault))).toBe(false);
    expect(hasNotice(/手册打开失败.*EBUSY/s)).toBe(true);
  });

  it('无 electron（移动端/jsdom）→ file:/// 走 openExternalUrl（openUrl 被调）', async () => {
    const vault = newVault();
    await downloadManual(appOf(vault));
    const openUrl = vi.fn();
    expect(await openManual(appOf(vault, { openUrl }))).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(`file://${ABS.split('\\').join('/')}`);
  });
});

describe('ensureManualOpen（footer 一键口径）', () => {
  it('无手册 → 自动下载后打开；已有手册 → 直接打开不再重复下载', async () => {
    const openPath = vi.fn(async () => '');
    mockElectron({ openPath });
    const vault = newVault();
    expect(await ensureManualOpen(appOf(vault))).toBe(true);
    expect(vault.files.get(STORED)).toBe(MANUAL_HTML);
    expect(await ensureManualOpen(appOf(vault))).toBe(true);
    expect(requestUrl).toHaveBeenCalledTimes(1); // 第二次不重复下载
  });
});

describe('openExternalUrl：openUrl 异步 rejection 落兜底链（issue 473 回归）', () => {
  it('openUrl reject → 落 electron openExternal；openExternal 也 reject → 落 window.open', async () => {
    const openExternal = vi.fn(async () => { throw new Error('Failed to open: 0x2'); });
    mockElectron({ openExternal });
    const winOpen = vi.spyOn(window, 'open').mockReturnValue(window as unknown as Window);
    const app = { openUrl: () => Promise.reject(new Error('Failed to open: 系统找不到指定的文件。 (0x2)')) };
    openExternalUrl(app, 'file:///x.html');
    await new Promise((r) => setTimeout(r, 0));
    expect(openExternal).toHaveBeenCalledWith('file:///x.html');
    expect(winOpen).toHaveBeenCalledWith('file:///x.html', '_blank');
    winOpen.mockRestore();
  });

  it('全链失败 → 人话 error 通知（不再 Uncaught (in promise)）', async () => {
    mockElectron({ openExternal: async () => { throw new Error('0x2'); } });
    const winOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    const app = { openUrl: () => Promise.reject(new Error('nope')) };
    openExternalUrl(app, 'file:///x.html');
    await new Promise((r) => setTimeout(r, 0));
    expect(hasNotice('无法打开链接，请复制到浏览器打开')).toBe(true);
    winOpen.mockRestore();
  });

  it('openUrl 缺失（同步 TypeError）→ 原口径落 electron 兜底', () => {
    const openExternal = vi.fn(async () => {});
    mockElectron({ openExternal });
    openExternalUrl({}, 'https://example.com');
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
  });
});
