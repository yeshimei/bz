// @vitest-environment node
/**
 * bz 阅读授权档位：激活码 → 基础版 / 高级版 / 赞助人。
 *
 * 这一格数字要进作者看板，判错方向比判不出来更糟（基础版永远为 0、付费率虚高），
 * 所以把「到期」「解不开」「没码」「BZR1 老码」逐条钉住。
 * 档位口径见 src/bookshelf/reader-tier.ts 头注。
 */
import { describe, expect, it } from 'vitest';
import {
  licenseIdOf,
  parseReaderLicense,
  readerLicenseIdOf,
  readerRevokedFlags,
  readerTierOf,
  reviewLicenseIdOf,
  reviewRevokedFlags,
  reviewTierOf,
} from '../../src/bookshelf/reader-tier';
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

describe('reader-tier · 码号（2026-11-22 起带）', () => {
  it('从 BZR2 码里取码号（只取 id，昵称不读）', () => {
    const c = code({ ...PERM, patron: true, name: '沁弦' });
    expect(licenseIdOf(c)).toBe('BZR-AF-2026-0125');
  });

  it('reader 配置里的码号', () => {
    expect(readerLicenseIdOf({ entitlement: { license: code(PERM) } })).toBe('BZR-AF-2026-0125');
  });

  it('没码 / 解不开 → 空串', () => {
    expect(readerLicenseIdOf({})).toBe('');
    expect(licenseIdOf('')).toBe('');
    expect(licenseIdOf('BZR2.bm90LWpzb24.c2ln')).toBe('');
  });

  it('码号只留字母数字与横线：手改坏的文件不能把奇怪字符带进统计', () => {
    expect(licenseIdOf(code({ v: 2, id: '<script>alert(1)</script>' }))).toBe('scriptalert1script');
    expect(licenseIdOf(code({ v: 2, id: '  BZR-AF-2026-0009  ' }))).toBe('BZR-AF-2026-0009');
  });

  it('BZP 码也认（bz review 的那批）', () => {
    expect(licenseIdOf(code(PERM, 'BZP2'))).toBe('BZR-AF-2026-0125');
  });
});

describe('review-tier · 判档与码号', () => {
  const now = Date.UTC(2026, 10, 12);

  it('BZP2 码 → paid', () => {
    expect(reviewTierOf({ licenseKey: code(PERM, 'BZP2') }, now)).toBe('paid');
  });

  it('BZR 赞助人码 → patron（赞助人码跨插件可用）', () => {
    expect(reviewTierOf({ licenseKey: code({ ...PERM, patron: true }, 'BZR2') }, now)).toBe('patron');
  });

  it('没码 / 空 / 读不到 → basic', () => {
    expect(reviewTierOf(null, now)).toBe('basic');
    expect(reviewTierOf({}, now)).toBe('basic');
    expect(reviewTierOf({ licenseKey: '   ' }, now)).toBe('basic');
  });

  it('过期 → basic；没过期 → paid', () => {
    const expired = code({ ...PERM, exp: now - DAY }, 'BZP2');
    const alive = code({ ...PERM, exp: now + DAY }, 'BZP2');
    expect(reviewTierOf({ licenseKey: expired }, now)).toBe('basic');
    expect(reviewTierOf({ licenseKey: alive }, now)).toBe('paid');
  });

  it('解不开的码 → basic（不猜）', () => {
    expect(reviewTierOf({ licenseKey: 'BZP2.!!!.x' }, now)).toBe('basic');
  });

  it('码号', () => {
    expect(reviewLicenseIdOf({ licenseKey: code(PERM, 'BZP2') })).toBe('BZR-AF-2026-0125');
    expect(reviewLicenseIdOf({})).toBe('');
  });
});

/* ============================================================
 * 封码状态与「为什么掉级」（2026-11-22）
 *
 * 这几样只有两个插件自己知道，bz 只读。要钉住的是**读不出来时不能编**：
 * 老版本插件没有这些键，编成 false / 'none' 会把「没探测到」冒充成
 * 「核对过没问题」和「没买」，两个数都会歪。
 * ============================================================ */
describe('封码状态与档位成因', () => {
  it('reader：从 entitlement 里读全五项', () => {
    const cfg = {
      entitlement: {
        license: 'BZR2.x.y',
        revoked: true,
        revokedAt: 1_800_000_000_000,
        tierReason: 'revoked',
        activateFail: 'offline',
        activateFailAt: '2026-11-20T10:00:00.000Z',
      },
    };
    const f = readerRevokedFlags(cfg);
    expect(f.revoked).toBe(true);
    expect(f.revokedAt).toBe(1_800_000_000_000);
    expect(f.tierReason).toBe('revoked');
    expect(f.activateFail).toBe('offline');
    expect(f.activateFailAt).toBe(Date.parse('2026-11-20T10:00:00.000Z'));
  });

  it('老版本插件没有这几个键：一律 undefined，不编默认值', () => {
    const f = readerRevokedFlags({ entitlement: { license: 'BZR2.x.y' } });
    expect(f.revoked).toBeUndefined();
    expect(f.revokedAt).toBeUndefined();
    expect(f.tierReason).toBeUndefined();
    expect(f.activateFail).toBeUndefined();
    expect(readerRevokedFlags(null)).toEqual({});
    expect(readerRevokedFlags({})).toEqual({});
  });

  it('脏值一律丢掉：枚举不在表内、时间戳是垃圾、布尔写成字符串', () => {
    const f = readerRevokedFlags({
      entitlement: {
        revoked: 'true',
        revokedAt: -5,
        tierReason: 'banned',
        activateFail: 'whatever',
        activateFailAt: 'not-a-date',
      },
    });
    expect(f.revoked).toBeUndefined();
    expect(f.revokedAt).toBeUndefined();
    expect(f.tierReason).toBeUndefined();
    expect(f.activateFail).toBeUndefined();
    expect(f.activateFailAt).toBeUndefined();
  });

  it('review：键带 license 前缀，口径与 reader 一致', () => {
    const cfg = {
      licenseKey: 'BZP2.x.y',
      licenseRevoked: false,
      licenseRevokedAt: 1_800_000_000_000,
      licenseTierReason: 'expired',
      licenseActivateFail: 'format',
      licenseActivateFailAt: 1_800_000_500_000,
    };
    const f = reviewRevokedFlags(cfg);
    expect(f.revoked).toBe(false); // false = 核对过、没被封，与 undefined 不同
    expect(f.revokedAt).toBe(1_800_000_000_000);
    expect(f.tierReason).toBe('expired');
    expect(f.activateFail).toBe('format');
    expect(f.activateFailAt).toBe(1_800_000_500_000);
  });

  it('review：老版本没有这些键 → undefined', () => {
    expect(reviewRevokedFlags({ licenseKey: 'BZP2.x.y' })).toEqual({
      revoked: undefined,
      revokedAt: undefined,
      tierReason: undefined,
      activateFail: undefined,
      activateFailAt: undefined,
    });
  });
});
