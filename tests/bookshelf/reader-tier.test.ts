// @vitest-environment node
/**
 * bz 阅读授权档位：激活码 → 基础版 / 高级版 / 赞助人。
 *
 * 这一格数字要进作者看板，判错方向比判不出来更糟（基础版永远为 0、付费率虚高），
 * 所以把「到期」「解不开」「没码」「BZR1 老码」逐条钉住。
 * 档位口径见 src/bookshelf/reader-tier.ts 头注。
 */
import { describe, expect, it } from 'vitest';
import { parseReaderLicense, readerTierOf } from '../../src/bookshelf/reader-tier';
import { probeReaderUsage } from '../../src/bookshelf/reader-usage';
import { MockVault, mockAppWithVault } from '../mock-vault';

const PLUGIN_DIR = '.obsidian/plugins/bz-reader';
const DAY = 86_400_000;

/** 造一枚码（签名段随便写：这边本来就不验签） */
function code(payload: Record<string, unknown>, prefix = 'BZR2'): string {
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${prefix}.${b64}.c2ln`;
}

const PERM = { v: 2, id: 'BZR-AF-2026-0125', plan: 'lifetime' };

describe('reader-tier · 拆码', () => {
  it('BZR2 赞助人码 → patron，且带昵称不影响判定', () => {
    const c = code({ ...PERM, patron: true, name: '沁弦' });
    expect(parseReaderLicense(c)).toEqual({ patron: true, exp: 0 });
  });

  it('BZR1 老码（只有 name/exp）→ 非赞助人', () => {
    expect(parseReaderLicense(code({ v: 1, name: '老用户' }, 'BZR1'))).toEqual({
      patron: false,
      exp: 0,
    });
  });

  it('形状不对 / 前缀不认识 / payload 不是 JSON → null', () => {
    expect(parseReaderLicense('')).toBeNull();
    expect(parseReaderLicense('BZR2.abc')).toBeNull();
    expect(parseReaderLicense('XXR2.YWJj.c2ln')).toBeNull();
    expect(parseReaderLicense('BZR2.bm90LWpzb24.c2ln')).toBeNull();
  });

  it('版本号不认识（v:3）→ null，不猜', () => {
    expect(parseReaderLicense(code({ v: 3 }))).toBeNull();
  });
});

describe('reader-tier · 判档', () => {
  const now = Date.UTC(2026, 10, 12);

  it('没有码 / 配置读不到 → 基础版', () => {
    expect(readerTierOf(null, now)).toBe('basic');
    expect(readerTierOf({}, now)).toBe('basic');
    expect(readerTierOf({ entitlement: { license: '  ' } }, now)).toBe('basic');
  });

  it('有效高级版码 → paid；带赞助人标记 → patron', () => {
    expect(readerTierOf({ entitlement: { license: code(PERM) } }, now)).toBe('paid');
    expect(readerTierOf({ entitlement: { license: code({ ...PERM, patron: true }) } }, now)).toBe(
      'patron',
    );
  });

  it('过期码算基础版：bz 阅读里它已经不放行了，统计不能还算成付费在用', () => {
    const expired = code({ ...PERM, exp: now - DAY });
    expect(readerTierOf({ entitlement: { license: expired } }, now)).toBe('basic');
    const alive = code({ ...PERM, exp: now + DAY });
    expect(readerTierOf({ entitlement: { license: alive } }, now)).toBe('paid');
  });

  it('码解不开 → 基础版（用户看到的就是基础版）', () => {
    expect(readerTierOf({ entitlement: { license: 'BZR2.!!!.x' } }, now)).toBe('basic');
  });
});

describe('reader-tier · 快照', () => {
  /** 装好并启用的 app；data.json 里放一份配置 */
  function appWith(data: unknown) {
    const vault = new MockVault();
    vault.files.set(
      `${PLUGIN_DIR}/manifest.json`,
      JSON.stringify({ id: 'bz-reader', version: '1.2.0' }),
    );
    if (data !== undefined) vault.files.set(`${PLUGIN_DIR}/data.json`, JSON.stringify(data));
    const app = mockAppWithVault(vault) as any;
    app.plugins = {
      manifests: { 'bz-reader': { dir: PLUGIN_DIR, version: '1.2.0' } },
      enabledPlugins: new Set(['bz-reader']),
    };
    return app;
  }

  it('装了 → 带档位；赞助人码报 patron', async () => {
    const snap = await probeReaderUsage(appWith({ entitlement: { license: code({ ...PERM, patron: true }) } }));
    expect(snap.state).toBe('idle');
    expect(snap.tier).toBe('patron');
  });

  it('装了没码 → 基础版', async () => {
    expect((await probeReaderUsage(appWith({}))).tier).toBe('basic');
  });

  it('没装 → unknown（不能塞进基础版充数）', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    app.plugins = { manifests: {}, enabledPlugins: new Set() };
    const snap = await probeReaderUsage(app);
    expect(snap.state).toBe('none');
    expect(snap.tier).toBe('unknown');
  });

  it('装了没启用 → unknown（走不到授权判定，档位不可知）', async () => {
    const app = appWith({ entitlement: { license: code(PERM) } });
    app.plugins.enabledPlugins = new Set();
    const snap = await probeReaderUsage(app);
    expect(snap.state).toBe('disabled');
    expect(snap.tier).toBe('unknown');
  });
});
