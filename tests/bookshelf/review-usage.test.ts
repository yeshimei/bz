// @vitest-environment node
/**
 * bz review 的使用快照（src/bookshelf/review-usage.ts）。
 *
 * 这一格要进作者看板，钉住三件事：
 *   1. 状态（没装 / 没启用 / 启用了没数据 / 有条目）；
 *   2. 档位与**码号**（review 认 BZP* 与 BZR* 两种码）；
 *   3. 条目数与最近复习时间——只数个数，卡片正文不进快照。
 */
import { describe, expect, it } from 'vitest';
import { probeReviewUsage } from '../../src/bookshelf/review-usage';
import { MockVault, mockAppWithVault } from '../mock-vault';

const PLUGIN_DIR = '.obsidian/plugins/bz-review';
const DAY = 86_400_000;

/** 造一枚码（签名段随便写：这边本来就不验签） */
function code(payload: Record<string, unknown>, prefix = 'BZP2'): string {
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${prefix}.${b64}.c2ln`;
}

const PERM = { v: 2, id: 'BZR-AF-2026-0125', plan: 'lifetime' };

function appWith(data: unknown, reviewJson?: unknown) {
  const vault = new MockVault();
  vault.files.set(`${PLUGIN_DIR}/manifest.json`, JSON.stringify({ id: 'bz-review', version: '1.0.2' }));
  if (data !== undefined) vault.files.set(`${PLUGIN_DIR}/data.json`, JSON.stringify(data));
  if (reviewJson !== undefined) {
    const dir = String((data as { storagePath?: string } | null)?.storagePath || 'CONFIG/STORAGE');
    vault.files.set(
      `${dir}/review.json`,
      typeof reviewJson === 'string' ? reviewJson : JSON.stringify(reviewJson),
    );
  }
  const app = mockAppWithVault(vault) as any;
  app.plugins = {
    manifests: { 'bz-review': { dir: PLUGIN_DIR, version: '1.0.2' } },
    enabledPlugins: new Set(['bz-review']),
  };
  return app;
}

describe('review-usage · 状态', () => {
  it('没装 → none / unknown（不能塞进基础版充数）', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    app.plugins = { manifests: {}, enabledPlugins: new Set() };
    const snap = await probeReviewUsage(app);
    expect(snap.state).toBe('none');
    expect(snap.tier).toBe('unknown');
    expect(snap.items).toBe(0);
  });

  it('装了没启用 → disabled / unknown', async () => {
    const app = appWith({ licenseKey: code(PERM) });
    app.plugins.enabledPlugins = new Set();
    const snap = await probeReviewUsage(app);
    expect(snap.state).toBe('disabled');
    expect(snap.tier).toBe('unknown');
  });

  it('启用了但还没数据 → idle，条目 0、从未复习', async () => {
    const snap = await probeReviewUsage(appWith({}));
    expect(snap.state).toBe('idle');
    expect(snap.items).toBe(0);
    expect(snap.daysSince).toBe(-1);
    expect(snap.version).toBe('1.0.2');
  });

  it('有条目 → active', async () => {
    const snap = await probeReviewUsage(appWith({}, [{ id: 'a' }, { id: 'b' }]));
    expect(snap.state).toBe('active');
    expect(snap.items).toBe(2);
  });

  it('顶层包一层 { items: [...] } 也认（老写法）', async () => {
    const snap = await probeReviewUsage(appWith({}, { items: [{ id: 'a' }] }));
    expect(snap.items).toBe(1);
  });

  it('review.json 坏了 → 条目 0，不抛错', async () => {
    const snap = await probeReviewUsage(appWith({}, '{坏掉的 json'));
    expect(snap.items).toBe(0);
    expect(snap.state).toBe('idle');
  });
});

describe('review-usage · 档位与码号', () => {
  it('BZP2 码 → paid，并带码号', async () => {
    const snap = await probeReviewUsage(appWith({ licenseKey: code(PERM) }));
    expect(snap.tier).toBe('paid');
    expect(snap.licenseId).toBe('BZR-AF-2026-0125');
  });

  it('BZR 赞助人码 → patron', async () => {
    const snap = await probeReviewUsage(
      appWith({ licenseKey: code({ ...PERM, patron: true }, 'BZR2') }),
    );
    expect(snap.tier).toBe('patron');
  });

  it('没码 → basic，且不带 licenseId 这个键', async () => {
    const snap = await probeReviewUsage(appWith({}));
    expect(snap.tier).toBe('basic');
    expect('licenseId' in snap).toBe(false);
  });

  it('过期码 → basic（卖出去了 ≠ 还在用）', async () => {
    const snap = await probeReviewUsage(appWith({ licenseKey: code({ ...PERM, exp: Date.now() - DAY }) }));
    expect(snap.tier).toBe('basic');
  });
});

describe('review-usage · 最近复习与自定义存储目录', () => {
  it('取最近一条 lastReviewed 算天数', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * DAY).toISOString();
    const old = new Date(Date.now() - 40 * DAY).toISOString();
    const snap = await probeReviewUsage(
      appWith({}, [{ id: 'a', lastReviewed: old }, { id: 'b', lastReviewed: twoDaysAgo }]),
    );
    expect(snap.daysSince).toBe(2);
  });

  it('storagePath 改了 → 去新目录读', async () => {
    const snap = await probeReviewUsage(
      appWith({ storagePath: '我的/复习' }, [{ id: 'a', lastReviewed: new Date().toISOString() }]),
    );
    expect(snap.items).toBe(1);
    expect(snap.daysSince).toBe(0);
  });

  it('storagePath 是上跳路径 → 回落缺省目录，不读到库外', async () => {
    const vault = new MockVault();
    vault.files.set(`${PLUGIN_DIR}/manifest.json`, JSON.stringify({ id: 'bz-review', version: '1.0.2' }));
    vault.files.set(`${PLUGIN_DIR}/data.json`, JSON.stringify({ storagePath: '../外面' }));
    vault.files.set('CONFIG/STORAGE/review.json', JSON.stringify([{ id: 'a' }]));
    const app = mockAppWithVault(vault) as any;
    app.plugins = {
      manifests: { 'bz-review': { dir: PLUGIN_DIR, version: '1.0.2' } },
      enabledPlugins: new Set(['bz-review']),
    };
    const snap = await probeReviewUsage(app);
    expect(snap.items).toBe(1);
  });
});
