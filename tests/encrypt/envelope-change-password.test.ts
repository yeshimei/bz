// @vitest-environment node
/**
 * ADR-0211 信封结构与修改主密码（issue 508）数据层测试：
 * 清单 v2（masterWrap + keys 记住每文件密钥）、changePassword 亚秒改密（镜像零接触）、
 * v1→v2 自动迁移（成功 / 坏镜像中止保 v1 / 中断孤儿体检收敛）、旧密码失效。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafeManager, fingerprintOf, flatName } from '../../src/encrypt/data';
import { CryptoService, clearCryptoKeyCache, __keyCacheSizeForTests } from '../../src/core/crypto';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

const ROOT = 'CONFIG/.ENCRYPT';
const BODY = '# 2025-06-01 早晨\n信封迁移前的日记正文。';
const ATT = 'SUlHRFJBTQ==';
const PREVIEW = 'PREVIEWDATA';

function makeApp(vault: MockVault) {
  setApp({ vault, metadataCache: { trigger: vi.fn() } } as any);
}

/** 手工构造 v1 库（清单 version:1，镜像全部主密码加密——信封之前的真实磁盘形态） */
async function seedV1(vault: MockVault, pw: string) {
  const bodyRef = flatName();
  const blobRef = flatName();
  const prevRef = flatName();
  vault.files.set(ROOT + '/' + bodyRef, await CryptoService.encrypt(BODY, pw));
  vault.files.set(ROOT + '/' + blobRef, await CryptoService.encrypt(ATT, pw));
  vault.files.set(ROOT + '/' + prevRef, await CryptoService.encrypt(PREVIEW, pw));
  const manifest = {
    version: 1,
    notes: [
      {
        id: 'enc-v1-seed',
        path: '我的/日记/2025-06-01.md',
        title: '2025-06-01',
        createdAt: '2025-06-01T08:00:00.000Z',
        contentRef: bodyRef,
        attachments: [
          {
            path: '我的/影视/a.png',
            kind: 'image',
            blobRef,
            blobSize: 10,
            fingerprint: await fingerprintOf(ATT),
            hasPreview: true,
            previewRef: prevRef,
          },
        ],
      },
    ],
  };
  vault.files.set(ROOT + '/.safe.enc', await CryptoService.encrypt(JSON.stringify(manifest), pw));
  return { bodyRef, blobRef, prevRef };
}

/** 解锁并等待迁移收场；空库瞬时升级（无迁移回调）直接返回 */
async function unlockAndWait(pw: string): Promise<SafeManager> {
  const sm = new SafeManager(ROOT);
  const done = new Promise<void>((r) => {
    sm.onMigrationEnd = () => r();
  });
  const ok = await sm.unlock(pw);
  expect(ok).toBe(true);
  await new Promise((r) => setTimeout(r, 30)); // 让 opQueue 里的迁移任务起跑（空库瞬时升级无回调）
  if (sm.manifest.version < 2 || !sm.manifest.masterWrap) {
    await Promise.race([done, new Promise((r) => setTimeout(r, 10000))]);
  }
  return sm;
}

describe('信封结构（清单 v2）', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    clearCryptoKeyCache();
  });

  it('首设即 v2：masterWrap/keys 落进清单密文，明文不泄露', async () => {
    makeApp(vault);
    const sm = new SafeManager(ROOT);
    expect(await sm.unlock('pw1234')).toBe(true);
    const raw = vault.files.get(ROOT + '/.safe.enc')!;
    expect(raw).not.toContain('masterWrap'); // 密文整体 base64，无明文字段名
    const plain = JSON.parse(await CryptoService.decrypt(raw, 'pw1234'));
    expect(plain.version).toBe(2);
    expect(typeof plain.masterWrap).toBe('string');
    expect(plain.keys).toEqual({});
  });

  it('lockNote 信封写入：镜像由独立 fileKey 加密（主密码解不开），清单 keys 记住每文件密码', async () => {
    makeApp(vault);
    const sm = new SafeManager(ROOT);
    await sm.unlock('pw1234');
    const note = await sm.lockNote({
      path: '我的/日记/2025-06-01.md',
      title: '2025-06-01',
      content: BODY,
      attachments: [{ path: '我的/影视/a.png', data: ATT, previewData: PREVIEW }],
    });
    // 三个镜像全部存在且主密码解不开（fileKey ≠ 主密码）
    for (const ref of [note.contentRef, note.attachments[0].blobRef, note.attachments[0].previewRef]) {
      const cipher = vault.files.get(ROOT + '/' + ref)!;
      expect(cipher).toBeTruthy();
      await expect(CryptoService.decrypt(cipher, 'pw1234')).rejects.toThrow();
      // 清单 keys[ref] 经 masterKey 解出 fileKey，fileKey 能解镜像回明文
      const plain = JSON.parse(await CryptoService.decrypt(vault.files.get(ROOT + '/.safe.enc')!, 'pw1234'));
      const fileKey = await CryptoService.decrypt(plain.keys[ref], plain.masterWrap ? await CryptoService.decrypt(plain.masterWrap, 'pw1234') : '');
      expect(await CryptoService.decrypt(cipher, fileKey)).toBeTruthy();
    }
    expect(await sm.decryptNoteBody(note)).toBe(BODY);
    expect(await sm.decryptAttachmentOriginal(note.attachments[0])).toBe(ATT);
    expect(await sm.decryptPreview(note.attachments[0])).toBe(PREVIEW);
  });

  it('updateNotePayload 复用同一 wrap（keys 不增项）；removeNote 同步摘除 wrap', async () => {
    makeApp(vault);
    const sm = new SafeManager(ROOT);
    await sm.unlock('pw1234');
    const note = await sm.lockNote({ path: 'a.md', title: 'a', content: 'V1', attachments: [] });
    const keysOf = async () => Object.keys(JSON.parse(await CryptoService.decrypt(vault.files.get(ROOT + '/.safe.enc')!, 'pw1234')).keys);
    expect((await keysOf()).length).toBe(1);
    await sm.updateNotePayload(note.id, 'V2');
    expect((await keysOf()).length).toBe(1); // 覆盖写换密文不换钥
    expect(await sm.decryptNoteBody(note)).toBe('V2');
    await sm.removeNote(note.id);
    expect((await keysOf()).length).toBe(0); // 条目移除 wrap 随清单落盘摘除
  });
});

describe('修改主密码（changePassword，ADR-0211）', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    clearCryptoKeyCache();
  });

  it('改密成功：镜像文件逐字节不动；新密码可解锁且数据原样可读；旧密码失效', async () => {
    makeApp(vault);
    const sm = new SafeManager(ROOT);
    await sm.unlock('old-pw');
    const note = await sm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: BODY,
      attachments: [{ path: '我的/影视/a.png', data: ATT, previewData: PREVIEW }],
    });
    // 改密前镜像快照
    const mirrorSnapshot = new Map<string, string>();
    for (const [p, c] of vault.files) if (!p.endsWith('.safe.enc')) mirrorSnapshot.set(p, c);

    clearCryptoKeyCache();
    expect(await sm.changePassword('old-pw', 'new-pw')).toBe(true);
    expect(__keyCacheSizeForTests()).toBe(0); // 旧主密码派生密钥不残留

    // 镜像零接触：路径集合与字节内容完全一致
    const mirrorsNow = new Map<string, string>();
    for (const [p, c] of vault.files) if (!p.endsWith('.safe.enc')) mirrorsNow.set(p, c);
    expect(mirrorsNow).toEqual(mirrorSnapshot);

    // 旧密码解锁失败、新密码成功且全部数据可读
    const sm2 = new SafeManager(ROOT);
    expect(await sm2.unlock('old-pw')).toBe(false);
    expect(await sm2.unlock('new-pw')).toBe(true);
    expect(await sm2.decryptNoteBody(note)).toBe(BODY);
    expect(await sm2.decryptAttachmentOriginal(note.attachments[0])).toBe(ATT);
    expect(await sm2.decryptPreview(note.attachments[0])).toBe(PREVIEW);
    expect(await sm2.verifyPassword('old-pw')).toBe(false);
    expect(await sm2.verifyPassword('new-pw')).toBe(true);
  });

  it('当前密码错误：返回 false、清单未被改动、旧密码仍可解锁', async () => {
    makeApp(vault);
    const sm = new SafeManager(ROOT);
    await sm.unlock('old-pw');
    await sm.lockNote({ path: 'a.md', title: 'a', content: BODY, attachments: [] });
    const manifestBefore = vault.files.get(ROOT + '/.safe.enc');
    expect(await sm.changePassword('wrong-pw', 'new-pw')).toBe(false);
    expect(vault.files.get(ROOT + '/.safe.enc')).toBe(manifestBefore);
    expect(sm.password).toBe('old-pw');
    const sm2 = new SafeManager(ROOT);
    expect(await sm2.unlock('old-pw')).toBe(true);
  });

  it('改密落盘失败：内存回滚（旧密码仍生效），磁盘清单仍是旧的', async () => {
    makeApp(vault);
    const sm = new SafeManager(ROOT);
    await sm.unlock('old-pw');
    // 破坏 adapter.write 模拟磁盘故障（三段式首段写 .tmp 即失败）
    const origWrite = vault.adapter.write.bind(vault);
    (vault.adapter as any).write = async () => {
      throw new Error('EACCES: disk failure');
    };
    await expect(sm.changePassword('old-pw', 'new-pw')).rejects.toThrow();
    (vault.adapter as any).write = origWrite;
    expect(sm.password).toBe('old-pw');
    expect(sm.manifest.masterWrap).toBeDefined();
    const sm2 = new SafeManager(ROOT);
    expect(await sm2.unlock('old-pw')).toBe(true);
    expect(await sm2.unlock('new-pw')).toBe(false);
  });
});

describe('v1→v2 信封迁移（解锁后自动）', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    makeApp(vault);
    clearCryptoKeyCache();
  });

  it('迁移成功：清单切 v2、数据原样可读、旧镜像删除、新镜像 fileKey 加密、体检完整性通过', async () => {
    const refs = await seedV1(vault, 'pw1');
    const topBefore = [...vault.files.keys()].filter((p) => p.startsWith(ROOT + '/.') && p !== ROOT + '/.safe.enc').length;
    expect(topBefore).toBe(3);
    const sm = await unlockAndWait('pw1');
    expect(sm.manifest.version).toBe(2);
    expect(sm.manifest.keys && Object.keys(sm.manifest.keys).length).toBe(3);
    const note = sm.manifest.notes[0];
    // ref 已换新名
    expect(note.contentRef).not.toBe(refs.bodyRef);
    expect(note.attachments[0].blobRef).not.toBe(refs.blobRef);
    // 数据原样
    expect(await sm.decryptNoteBody(note)).toBe(BODY);
    expect(await sm.decryptAttachmentOriginal(note.attachments[0])).toBe(ATT);
    expect(await sm.decryptPreview(note.attachments[0])).toBe(PREVIEW);
    // 旧镜像已删，新镜像主密码解不开（fileKey 加密）
    expect(vault.files.has(ROOT + '/' + refs.bodyRef)).toBe(false);
    await expect(CryptoService.decrypt(vault.files.get(ROOT + '/' + note.contentRef)!, 'pw1')).rejects.toThrow();
    // 体检完整性段全绿（解密 + 指纹）
    const report = await sm.scanHealth();
    expect(report.integrityChecked).toBe(true);
    expect(report.items).toEqual([]);
  });

  it('迁移后改密：链路全通（迁移 → changePassword → 旧密码失效、数据可读）', async () => {
    await seedV1(vault, 'pw1');
    const sm = await unlockAndWait('pw1');
    expect(await sm.changePassword('pw1', 'pw2')).toBe(true);
    const sm2 = new SafeManager(ROOT);
    expect(await sm2.unlock('pw1')).toBe(false);
    expect(await sm2.unlock('pw2')).toBe(true);
    expect(await sm2.decryptNoteBody(sm2.manifest.notes[0])).toBe(BODY);
  });

  it('坏镜像中止迁移：清单保持 v1（下次解锁重试），v1 路径照常可用', async () => {
    const refs = await seedV1(vault, 'pw1');
    // 正文镜像换成别的密码加密的密文（模拟损坏/被替换）
    vault.files.set(ROOT + '/' + refs.bodyRef, await CryptoService.encrypt('corrupted', 'other-pw'));
    const ends: Array<{ ok: boolean; reason?: string }> = [];
    const sm = new SafeManager(ROOT);
    sm.onMigrationEnd = (ok, reason) => ends.push({ ok, reason });
    expect(await sm.unlock('pw1')).toBe(true);
    await vi.waitFor(() => expect(ends.length).toBe(1), { timeout: 8000 });
    expect(ends[0]).toEqual({ ok: false, reason: 'error' });
    // 保持 v1 运行态：无 keys、附件/预览按主密码可读、版本不变
    expect(sm.manifest.version).toBe(1);
    expect(sm.manifest.keys ?? {}).toEqual({});
    expect(await sm.decryptAttachmentOriginal(sm.manifest.notes[0].attachments[0])).toBe(ATT);
    // 磁盘清单未升级
    const plain = JSON.parse(await CryptoService.decrypt(vault.files.get(ROOT + '/.safe.enc')!, 'pw1'));
    expect(plain.version).toBe(1);
  });

  it('中断残留孤儿不阻塞重迁移，体检可清（中断态最终收敛）', async () => {
    await seedV1(vault, 'pw1');
    // 模拟上次迁移 P1 后中断：顶层多出一个未被清单引用的新形态密文
    const orphan = flatName();
    vault.files.set(ROOT + '/' + orphan, await CryptoService.encrypt('stale-mirror', 'whatever'));
    const sm = await unlockAndWait('pw1');
    expect(sm.manifest.version).toBe(2); // 重迁移不受孤儿影响
    const report = await sm.scanHealth();
    const orphans = report.items.filter((i) => i.cat === 'orphan-file');
    expect(orphans.map((i) => i.ref)).toEqual([orphan]);
    const res = await sm.resolveHealth([orphans[0].key]);
    expect(res.files).toBe(1);
    expect(vault.files.has(ROOT + '/' + orphan)).toBe(false);
  });

  it('v1 空清单：解锁瞬时升 v2（无镜像迁移）', async () => {
    vault.files.set(
      ROOT + '/.safe.enc',
      await CryptoService.encrypt(JSON.stringify({ version: 1, notes: [] }), 'pw1')
    );
    const sm = await unlockAndWait('pw1');
    expect(sm.manifest.version).toBe(2);
    expect(sm.manifest.masterWrap).toBeDefined();
    const sm2 = new SafeManager(ROOT);
    expect(await sm2.unlock('pw1')).toBe(true);
  });

  it('体检清理复核当前引用：报告生成后才被引用的文件绝不删（迁移 P1 窗口防护，深审 P0）', async () => {
    await seedV1(vault, 'pw1');
    const sm = await unlockAndWait('pw1');
    // 真孤儿入报告
    const orphan = flatName();
    vault.files.set(ROOT + '/' + orphan, await CryptoService.encrypt('x', 'y'));
    const report = await sm.scanHealth();
    expect(report.items.some((i) => i.key === 'file:' + orphan)).toBe(true);
    // 报告生成后该文件被条目引用（模拟迁移 P1 完成的引用切换 → 报告已陈旧）
    sm.manifest.notes[0].attachments.push({
      path: '我的/影视/b.png',
      kind: 'image',
      blobRef: orphan,
      blobSize: 1,
      fingerprint: 'fp',
      hasPreview: false,
      previewRef: '',
    });
    const res = await sm.resolveHealth(['file:' + orphan]);
    expect(res.files).toBe(0); // 当前引用复核拦截
    expect(vault.files.has(ROOT + '/' + orphan)).toBe(true);
  });
});
