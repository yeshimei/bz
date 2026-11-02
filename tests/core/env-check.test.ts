// @vitest-environment jsdom
/**
 * 环境自检（core/env-check.ts）：把「这台机器缺什么」一次说清。
 *
 * 钉住两条最容易骗人的判据：
 *  1. **「目录还没建」不等于「不可写」**——首次运行时数据目录是空的，逐级建一遍再写探针才作数；
 *  2. **真写一次**才算可写——`exists()` / 只读盘 / 占位文件都能让「存在」错当成「能写」。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestUrl } from 'obsidian';
import { MockVault } from '../mock-vault';
import { environmentCheck, explainNetError, isRealPythonOutput, probeNetwork } from '../../src/core/env-check';
import { resetNodeRuntimeCache, setFsProbe } from '../../src/core/tool-runtime';
import { DEFAULT_STORAGE_DIR } from '../../src/core/storage-path';

function appOf(vault: MockVault): unknown {
  return { vault: { adapter: vault.adapter, configDir: '.obsidian' } };
}

describe('environmentCheck', () => {
  it('一次给出运行环境 / vault / 插件目录 / 数据目录 / 三个工具', async () => {
    resetNodeRuntimeCache();
    setFsProbe(() => false);
    const vault = new MockVault();
    setFsProbe(() => false);

    const rows = await environmentCheck(appOf(vault));
    const keys = rows.map((r) => r.key);

    expect(keys).toContain('运行环境');
    expect(keys).toContain('vault 路径');
    expect(keys).toContain('数据目录可写');
    expect(keys).toContain('知识盒工具包');
    setFsProbe(null);
  });

  it('数据目录还不存在（首次运行）→ 判可写，不误报', async () => {
    resetNodeRuntimeCache();
    setFsProbe(() => false);
    const vault = new MockVault();
    // 不预置任何目录：缺省数据目录此刻并不存在
    const rows = await environmentCheck(appOf(vault));
    const row = rows.find((r) => r.key === '数据目录可写')!;
    expect(row.value).toContain(DEFAULT_STORAGE_DIR);
    expect(row.ok).toBe(true);
    setFsProbe(null);
  });

  it('写盘抛错 → 判不可写，并把原因写进 value（不是只给一个红点）', async () => {
    resetNodeRuntimeCache();
    setFsProbe(() => false);
    const vault = new MockVault();
    vi.spyOn(vault.adapter, 'write').mockRejectedValue(new Error('EACCES: permission denied'));

    const rows = await environmentCheck(appOf(vault));
    const row = rows.find((r) => r.key === '数据目录可写')!;
    expect(row.ok).toBe(false);
    expect(row.value).toContain('写不进去');
    setFsProbe(null);
  });

  it('系统级运行时不再占这一屏的三行（它们归「安装外部工具」那张清单）', async () => {
    resetNodeRuntimeCache();
    setFsProbe(() => false);
    delete (window as unknown as { require?: unknown }).require;
    const rows = await environmentCheck(appOf(new MockVault()));
    const keys = rows.map((r) => r.key);
    // 2026-11-01 用户拍板：Node / Python / ffmpeg 的装法在依赖清单弹窗里，
    // 检查页留着一个「未找到」的红点却点不动任何东西，只会让人去翻设置。
    expect(keys).not.toContain('Node 运行时');
    expect(keys).not.toContain('Python 环境');
    expect(keys).not.toContain('音视频工具');
    setFsProbe(null);
  });
});

describe('Python 探测的真实性判据', () => {
  it('应用商店别名占位符不算 Python（每台 Win10/11 都有，跑起来什么都不做）', () => {
    expect(isRealPythonOutput('')).toBe(false);
    expect(isRealPythonOutput('Python was not found; run without arguments to install from the Microsoft Store')).toBe(false);
  });

  it('真 Python 的 -V 输出认（大小写不敏感，stderr 也认——老版本打到 stderr）', () => {
    expect(isRealPythonOutput('Python 3.12.4')).toBe(true);
    expect(isRealPythonOutput('python 3.11.9')).toBe(true);
    expect(isRealPythonOutput('Python 2.7.18')).toBe(false);
  });
});

/**
 * 通道探测（2026-10-28 用户报障：网页能开 GitHub，引导却显示两条通道都不可达）。
 *
 * 根因不是网络，是探测本身：`await import('obsidian')` 在 Obsidian 的渲染进程里解析不了
 * 裸模块名（跑的是 CJS、没有 importmap），永远进 catch。这几条钉住「探的是网络」这个语义。
 */
describe('probeNetwork：通道可达性', () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
  });

  // 2026-11-02 起 jsDelivr 整条退场：主通道探 GitHub 仓库页（Release 下载同域），备用探码云
  const GH = 'https://github.com/yeshimei/bz';
  const GITEE = 'https://gitee.com/ntbl/bz';

  /** 按域名分派：命中的 resolve，其余按给的错误 reject */
  function route(ok: (url: string) => boolean, err = 'net::ERR_CONNECTION_RESET'): void {
    vi.mocked(requestUrl).mockImplementation((async (opts: { url: string }) => {
      if (ok(opts.url)) return { status: 200, text: '{"version":"1.33.0"}' };
      throw new Error(err);
    }) as never);
  }

  it('主通道通 → github 可达、耗时为正、无原因', async () => {
    route(() => true);
    const net = await probeNetwork();
    expect(net.github).toBe(true);
    expect(net.githubMs).toBeGreaterThanOrEqual(0);
    expect(net.githubError).toBe('');
    expect(net.gitee).toBe(true);
  });

  it('主通道被墙、备用通 → 各说各的（国内最常见的那一种）', async () => {
    route((u) => u.startsWith(GITEE), 'net::ERR_CONNECTION_RESET');
    const net = await probeNetwork();
    expect(net.github).toBe(false);
    expect(net.githubError).toBe('连接被重置（常见于被墙）');
    expect(net.gitee).toBe(true);
    expect(net.giteeError).toBe('');
  });

  it('只有备用通道通 → 照样给出耗时（引导页据此说「可达 · N ms」）', async () => {
    route((u) => u.startsWith(GITEE));
    const net = await probeNetwork();
    expect(net.gitee).toBe(true);
    expect(net.giteeMs).toBeGreaterThanOrEqual(0);
    expect(net.github).toBe(false);
  });

  it('全都不通 → 两条都红，原因折成人话（不是一句「不可达」）', async () => {
    route(() => false, 'getaddrinfo ENOTFOUND raw.githubusercontent.com');
    const net = await probeNetwork();
    expect(net.github).toBe(false);
    expect(net.gitee).toBe(false);
    expect(net.githubError).toBe('域名解析失败');
    expect(net.giteeError).toBe('域名解析失败');
  });

  it('404 也算通：探的是「网络通不通」，不是「这个文件在不在」', async () => {
    vi.mocked(requestUrl).mockImplementation((async (opts: { url: string }) => ({
      status: opts.url === GH ? 404 : 200,
      text: '',
    })) as never);
    const net = await probeNetwork();
    expect(net.github).toBe(true); // 有 HTTP 响应 = 网络通（文件缺失是另一件事）
  });

  it('403 / 407 / 451 不算可达：通道拒了你，跟断网一样用不上', async () => {
    vi.mocked(requestUrl).mockImplementation((async () => ({
      status: 403,
      text: 'Package size exceeded the configured limit of 50 MB.',
    })) as never);
    const net = await probeNetwork();
    expect(net.github).toBe(false);
    expect(net.gitee).toBe(false);
    expect(net.githubError).toBe('HTTP 403');
  });

  it('用静态 import 拿 requestUrl（动态 import 裸模块在 Obsidian 里永远失败）', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/core/env-check.ts', 'utf8'));
    expect(src).toContain("import { requestUrl } from 'obsidian'");
    expect(src).not.toMatch(/requestUrls*=s*await import/);
  });
});

describe('explainNetError：错误原文 → 一句人话', () => {
  it('按最常见的几类分', () => {
    expect(explainNetError('net::ERR_NAME_NOT_RESOLVED')).toBe('域名解析失败');
    expect(explainNetError('connect ETIMEDOUT 185.199.108.133:443')).toBe('超时');
    expect(explainNetError('net::ERR_CONNECTION_REFUSED')).toBe('连接被拒绝（代理没开？）');
    expect(explainNetError('net::ERR_CERT_AUTHORITY_INVALID')).toBe('证书校验失败（代理做了解密？）');
    expect(explainNetError('net::ERR_INTERNET_DISCONNECTED')).toBe('本机没有网络');
  });

  it('不认识的原文截断后照抄，空串给「未知原因」', () => {
    expect(explainNetError('')).toBe('未知原因');
    expect(explainNetError('x'.repeat(80)).endsWith('…')).toBe(true);
  });
});
