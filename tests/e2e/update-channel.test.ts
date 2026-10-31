// @vitest-environment jsdom
/**
 * 更新通道端到端（真实网络，打临时仓库 yeshimei/bz-e2e）
 *
 * 为什么要有这一层：单元测试把 `requestUrl` 全 mock 掉，能验「解析逻辑」但验不了
 * 「真实发布出去的资产真的能下」。2026-10-31 v1.37.0 首发就是单元全绿、线上炸
 * （资产名被 gh 剥掉目录前缀 + 上传函数漏调用 + 镜像清单还是旧版导致解析抛错）。
 *
 * 做法：仍然走真实 `checkSelfUpdate`，只把请求 URL 里的仓库 slug 重写到临时仓，
 * 然后真的发 HTTP（跟随 302）。临时仓里铺了 v1.36.0 / v1.37.0 两个发布，
 * master 上是指针与清单——形状与生产完全一致。
 *
 * 跑法（需要联网）：
 *   BZ_E2E_LOCAL=1.36.0 BZ_E2E_EXPECT=installed:1.37.0 npx vitest run --config vitest.e2e.config.ts
 * 不在默认门禁里（vitest.config.ts 排除 tests/e2e/**，见 vitest.e2e.config.ts）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { checkSelfUpdate, selfUpdateState } from '../../src/core/self-update';

const E2E_REPO = process.env.BZ_E2E_REPO || 'yeshimei/bz-e2e';
const LOCAL = process.env.BZ_E2E_LOCAL || '1.36.0';
const [EXPECT, EXPECT_DISK] = (process.env.BZ_E2E_EXPECT || 'installed:1.37.0').split(':');

/** 把生产 slug 重写到临时仓（顺序敏感：先长串，避免 bz-assets 被 bz 规则先吃掉） */
function rewrite(url: string): string {
  return url
    .replaceAll('yeshimei/bz-assets', E2E_REPO)
    .replace(/yeshimei\/bz(?!-)/g, E2E_REPO);
}

/** 本机 github.com 可能不可达（2026-10-31 实测 15s 超时），但 api.github.com 与
 *  objects.githubusercontent.com 通。所以 `releases/download/...` 这条 URL 用 API 复现
 *  GitHub 的 302：先按 tag 查资产 id，再走 assets/<id> 的 octet-stream 拿真内容。 */
async function viaApi(url: string): Promise<unknown> {
  const m = /github\.com\/([^/]+)\/([^/]+)\/releases\/(latest|download\/[^/]+)\/download\/(.+)$/.exec(url);
  if (!m) throw new Error('不可模拟的 github URL: ' + url);
  const [, owner, repo, which, asset] = m;
  const tag = which === 'latest' ? 'latest' : which.slice('download/'.length);
  const rel = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${tag}`, {
    headers: authHeaders(),
  }).then((r) => r.json() as Promise<{ assets?: Array<{ id: number; name: string }> }>);
  const hit = (rel.assets || []).find((a) => a.name === asset);
  if (!hit) throw new Error(`404 资产不存在: ${tag}/${asset}`);
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${hit.id}`, {
    headers: { ...authHeaders(), Accept: 'application/octet-stream' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${res.status} asset ${tag}/${asset}`);
  return asRequestUrlResult(res);
}

let cachedToken: string | null = null;
function authHeaders(): Record<string, string> {
  if (cachedToken === null) {
    try {
      cachedToken = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
    } catch {
      cachedToken = '';
    }
  }
  return cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {};
}

async function asRequestUrlResult(res: Response): Promise<unknown> {
  const buf = new Uint8Array(await res.arrayBuffer());
  return {
    status: res.status,
    text: new TextDecoder().decode(buf),
    arrayBuffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

/** 真实下载：跟随 302，返回 requestUrl 的形状（text + arrayBuffer） */
async function realRequest(url: string): Promise<unknown> {
  const target = rewrite(url);
  if (target.startsWith('https://github.com/')) return viaApi(target);
  const res = await fetch(target, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${target}`);
  return asRequestUrlResult(res);
}

beforeEach(() => {
  resetObsidianMocks();
  vi.mocked(requestUrl).mockReset();
  vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => realRequest(req.url)) as never);
  try {
    localStorage.clear();
  } catch {
    /* jsdom 一定有 */
  }
});

describe(`端到端：本地 ${LOCAL} → 期望 ${EXPECT}`, () => {
  it('真实拉取 latest 清单 → 三件套 → 落盘', async () => {
    const vault = new MockVault();
    vault.files.set('.obsidian/plugins/bz/manifest.json', JSON.stringify({ id: 'bz', version: LOCAL }));
    const app = { vault, plugins: { manifests: { bz: { version: LOCAL } } } };

    const result = await checkSelfUpdate(app, { apply: true, throttle: false });

    expect(result).toBe(EXPECT as 'installed' | 'current' | 'available');
    const st = await selfUpdateState(app);
    expect(st.error).toBeNull();
    if (EXPECT === 'installed') {
      const disk = JSON.parse(String(vault.files.get('.obsidian/plugins/bz/manifest.json')));
      expect(disk.version).toBe(EXPECT_DISK || '1.37.0');
      const js = String(vault.files.get('.obsidian/plugins/bz/main.js'));
      expect(js.length).toBeGreaterThan(1_000_000); // 真包 2.9 MB，不是错误页
      expect(js.trimStart().startsWith('<')).toBe(false);
      expect(vault.files.has('.obsidian/plugins/bz/styles.css')).toBe(true);
    } else {
      // current / available：磁盘一个字节都不该动
      expect(vault.files.has('.obsidian/plugins/bz/main.js')).toBe(false);
    }
  }, 120_000);
});
