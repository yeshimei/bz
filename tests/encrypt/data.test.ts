// @vitest-environment node
/**
 * 加密保险箱数据层测试：SafeManager 加锁/还原（取出即删）状态机、
 * 清单加密存储、平铺点前缀密文镜像、指纹冲突安全、崩溃幂等。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafeManager, fingerprintOf, flatName, mapLimit } from '../../src/encrypt/data';
import { CryptoService, clearCryptoKeyCache } from '../../src/password/crypto';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

/** 构造带 metadataCache.trigger 探针的 app（数据层改文件后触发刷新，还原测试断言） */
function makeApp(vault: MockVault) {
  const trigger = vi.fn();
  setApp({ vault, metadataCache: { trigger } } as any);
  return trigger;
}

/** 简便加锁：把一篇笔记 + 若干二进制附件移入保险箱 */
async function lockSample(sm: SafeManager, opts?: {
  notePath?: string;
  content?: string;
  attachments?: Array<{ path: string; data: string; previewData?: string }>;
}) {
  const o = opts || {};
  return sm.lockNote({
    path: o.notePath || '我的/日记/2025-06-01.md',
    title: '2025-06-01',
    content: o.content ?? '# 2025-06-01 早晨\n今天写日记。',
    attachments: o.attachments || [
      { path: '我的/影视/pic.png', data: 'SUlHRFJBTQ==', previewData: 'PREVIEWDATA' },
    ],
  });
}

describe('SafeManager 状态机', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('指纹：SHA-256 稳定、不同内容不同', async () => {
    const a = await fingerprintOf('abc');
    const b = await fingerprintOf('abc');
    const c = await fingerprintOf('abd');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('平铺随机名：点前缀 + .enc 后缀、互不相同、不含路径信息', () => {
    const n1 = flatName();
    const n2 = flatName();
    expect(n1.startsWith('.')).toBe(true);
    expect(n1.endsWith('.enc')).toBe(true);
    expect(n1).not.toBe(n2);
    expect(n1.includes('/')).toBe(false);
    expect(n1.includes('附件')).toBe(false);
    expect(n1.includes('.md')).toBe(false);
  });

  it('首次 unlock：创建 .safe.enc（密文非明文 JSON），清单为空', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    const ok = await sm.unlock('master123');
    expect(ok).toBe(true);
    expect(sm.unlocked).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc')).toBe(true);
    const content = vault.files.get('CONFIG/.ENCRYPT/.safe.enc')!;
    expect(content.startsWith('{')).toBe(false);
    expect(content).not.toContain('master123');
    expect(sm.manifest.notes.length).toBe(0);
  });

  it('回归：设主密码后 exists() 为 true（adapter 直读磁盘，点前缀不被 Obsidian 索引不影响）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('master123');
    // 新实例（模拟重启/再次打开）：exists() 应看到磁盘上的 .safe.enc
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.exists()).toBe(true);
    // 二次解锁可打开（密文往返正确）
    expect(await sm2.unlock('master123')).toBe(true);
    expect(sm2.unlocked).toBe(true);
  });

  it('二次解锁：正确密码成功、错误密码失败', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('wrong')).toBe(false);
    expect(sm2.unlocked).toBe(false);
    expect(await sm2.unlock('pw')).toBe(true);
    expect(sm2.unlocked).toBe(true);
  });
});

describe('SafeManager 加锁', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('lockNote：正文+附件移入保险箱，原文件删除，平铺点前缀密文镜像落盘', async () => {
    makeApp(vault);
    vault.create('我的/日记/2025-06-01.md', '# 日记');
    vault.createBinary('我的/影视/pic.png', new TextEncoder().encode('IMGDATAIMG').buffer);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');

    const note = await lockSample(sm, { content: '# 日记' });
    expect(note.attachments.length).toBe(1);
    // 原笔记与附件已移出
    expect(vault.files.has('我的/日记/2025-06-01.md')).toBe(false);
    expect(vault.binaryFiles.has('我的/影视/pic.png')).toBe(false);
    // 密文镜像已生成（原始层 + 预览层），平铺在 encryptRoot 根、点前缀
    const blobRef = note.attachments[0].blobRef;
    const prevRef = note.attachments[0].previewRef;
    const contentRef = note.contentRef;
    expect(blobRef.startsWith('.')).toBe(true);
    expect(prevRef.startsWith('.')).toBe(true);
    expect(contentRef.startsWith('.')).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + blobRef)).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + prevRef)).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + contentRef)).toBe(true);
    // 平铺无 附件/ 子目录
    expect(vault.dirs.has('CONFIG/.ENCRYPT/附件')).toBe(false);
    // 密文非明文
    expect(vault.files.get('CONFIG/.ENCRYPT/' + blobRef)!).not.toContain('IMGDATAIMG');
    expect(note.hasSummary).toBe(false);
    expect(note.attachments[0].hasPreview).toBe(true);
  });

  it('lockNote 正文写入镜像文件（contentRef），重新解锁经 decryptNoteBody 解出原文', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm);
    // 正文镜像平铺落盘（encryptRoot 根），清单不再内嵌 base64
    expect(note.contentRef.startsWith('.')).toBe(true);
    expect(note.contentRef.endsWith('.enc')).toBe(true);
    expect(note.content).toBe('');
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.contentRef)).toBe(true);
    // 重开解锁读取
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    await sm2.unlock('pw');
    expect(sm2.manifest.notes.length).toBe(1);
    const plain = await sm2.decryptNoteBody(sm2.manifest.notes[0]);
    expect(plain).toContain('今天写日记');
  });

  it('加锁附件无预览时 hasPreview=false 且无预览镜像', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, { attachments: [{ path: '我的/x.png', data: 'REFLhUlG' }] });
    expect(note.attachments[0].hasPreview).toBe(false);
    expect(note.attachments[0].previewRef).toBe('');
  });

  it('decryptAttachmentOriginal：解原始层（blobRef）得原始 base64，与预览层互不影响', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, {
      content: '# A',
      attachments: [
        { path: '我的/影视/pic.png', data: 'SUlHRFJBTQ==', previewData: 'PREVIEWDATA' },
        { path: '我的/影视/clip.mp4', data: 'NTY3OA==', previewData: 'FRAME' },
      ],
    });
    const pic = note.attachments[0];
    const clip = note.attachments[1];
    // 原始层解出加锁时传入的 base64（图片/视频各自独立）
    expect(await sm.decryptAttachmentOriginal(pic)).toBe('SUlHRFJBTQ==');
    expect(await sm.decryptAttachmentOriginal(clip)).toBe('NTY3OA==');
    // 预览层解出压缩预览，与原始层不同源
    expect(await sm.decryptPreview(pic)).toBe('PREVIEWDATA');
    expect(await sm.decryptPreview(clip)).toBe('FRAME');
  });

  it('decryptAttachmentOriginal：未解锁抛「未解锁」、镜像缺失返回 null', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, {
      content: '# A',
      attachments: [{ path: '我的/影视/pic.png', data: 'SUlHRFJBTQ==' }],
    });
    const att = note.attachments[0];
    // 镜像缺失（被误删）→ null（按需加载降级）
    vault.files.delete('CONFIG/.ENCRYPT/' + att.blobRef);
    expect(await sm.decryptAttachmentOriginal(att)).toBeNull();
    // 未解锁 → 抛错（与 decryptPreview 同规约）
    sm.lock();
    await expect(sm.decryptAttachmentOriginal(att)).rejects.toThrow('未解锁');
  });

  it('lock 清空派生密钥缓存：上锁后再次解锁解密需重新派生（密钥不残留内存）', async () => {
    clearCryptoKeyCache();
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, { content: '# A' });
    // 解锁态解密一次（正文/清单的 key 均已入缓存）
    expect(await sm.decryptNoteBody(note)).toContain('# A');
    // 打真实 PBKDF2 派生点：若 lock 未清缓存，重解锁/解密全部命中缓存 → 0 次派生
    const spy = vi.spyOn(crypto.subtle, 'deriveKey' as any);
    try {
      sm.lock();
      await sm.unlock('pw');
      expect(await sm.decryptNoteBody(note)).toContain('# A');
      // 缓存被清：清单 + 正文均重新派生（> 0）
      expect(spy.mock.calls.length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
      clearCryptoKeyCache();
    }
  });
});

describe('SafeManager 还原（取出即删）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('restoreNote：原文与附件写回原路径（二进制），removed=true，清单条目与全部镜像清理', async () => {
    const trigger = makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, {
      content: '# 待还原',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'PREVIEW' }],
    });
    const contentRef = note.contentRef;
    const blobRef = note.attachments[0].blobRef;
    const prevRef = note.attachments[0].previewRef;

    const { conflicts, removed } = await sm.restoreNote(note.id);
    expect(conflicts).toEqual([]);
    expect(removed).toBe(true);
    // 正文写回
    expect(vault.files.get('我的/日记/2025-06-01.md')).toContain('# 待还原');
    // 附件二进制写回
    const bytes = await vault.readBinary(vault.file('我的/影视/pic.png'));
    expect(new TextDecoder().decode(bytes)).toBe('ABCDEFG');
    // 取出即删：清单条目移除 + 正文/附件/预览镜像全部清理
    expect(sm.manifest.notes.find((n) => n.id === note.id)).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/' + contentRef)).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/' + blobRef)).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/' + prevRef)).toBeUndefined();
    // metadataCache 触发（正文 + 附件各一次）
    expect(trigger.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('restoreNote 冲突：目标笔记被用户新建同名占用 → 跳过不盖，removed=false，条目保留在保险箱', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, { content: '# A' });
    // 用户新建同名笔记
    vault.create('我的/日记/2025-06-01.md', '# 用户的笔记');
    const { conflicts, removed } = await sm.restoreNote(note.id);
    expect(conflicts).toContain('我的/日记/2025-06-01.md');
    expect(removed).toBe(false);
    // 不覆盖用户文件；条目仍在清单（加密副本保留，安全第一）
    expect(vault.files.get('我的/日记/2025-06-01.md')).toBe('# 用户的笔记');
    expect(sm.manifest.notes.find((n) => n.id === note.id)).toBeTruthy();
  });
});

describe('SafeManager 未解锁拦截', () => {
  it('未解锁 lockNote/restoreNote/saveManifest 抛「未解锁」', async () => {
    const vault = new MockVault();
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await expect(sm.saveManifest()).rejects.toThrow('未解锁');
    await expect(lockSample(sm)).rejects.toThrow('未解锁');
    await expect(sm.restoreNote('x')).rejects.toThrow('未解锁');
  });
});

describe('SafeManager 深层目录（Parent folder 回归）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('加锁深层路径笔记：密文镜像平铺在 encryptRoot 根，不建 附件/ 层级目录', async () => {
    makeApp(vault);
    vault.create('我的/影视/2025/片单.md', '# 片单');
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/影视/2025/片单.md',
      title: '片单',
      content: '# 片单',
      attachments: [{ path: '我的/影视/2025/海报.png', data: 'QUJDREVGRw==' }],
    });
    // 镜像文件平铺落盘于根，无 附件/ 目录链
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.attachments[0].blobRef)).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.contentRef)).toBe(true);
    expect(vault.dirs.has('CONFIG/.ENCRYPT/附件')).toBe(false);
    expect(vault.dirs.has('CONFIG/.ENCRYPT/附件/我的')).toBe(false);
  });

  it('真还原到不存在且带深层的原目录：递归建目录后写回', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '归档/深层/笔记.md',
      title: '笔记',
      content: '# 还原目标',
      attachments: [{ path: '归档/深层/图.png', data: 'QUJDREVGRw==' }],
    });
    // 原目录不存在（模拟 Obsidian 把空目录清掉）
    expect(vault.dirs.has('归档/深层')).toBe(false);
    const { conflicts, removed } = await sm.restoreNote(note.id);
    expect(conflicts).toEqual([]);
    expect(removed).toBe(true);
    expect(vault.files.get('归档/深层/笔记.md')).toContain('# 还原目标');
    const bytes = await vault.readBinary(vault.file('归档/深层/图.png'));
    expect(new TextDecoder().decode(bytes)).toBe('ABCDEFG');
  });
});

describe('SafeManager 进度回调（onProgress）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('lockNote：附件并行加密后按完成数上报（done 递增、total 3、current 覆盖全部文件）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const events: Array<{ done: number; total: number; current: string }> = [];
    const note = await sm.lockNote(
      {
        path: '我的/日记/a.md',
        title: 'a',
        content: '# a',
        attachments: [
          { path: '我的/影视/1.png', data: 'MTIzNA==' },
          { path: '我的/影视/2.mp4', data: 'NTY3OA==' },
        ],
      },
      (p) => events.push(p)
    );
    expect(events.length).toBe(3); // 2 附件 + 1 笔记
    // 并行（BLOB_CONCURRENCY）下完成序不定，但 done 必须严格递增到 total
    expect(events.map((e) => e.done)).toEqual([1, 2, 3]);
    expect(new Set(events.map((e) => e.current))).toEqual(
      new Set(['我的/影视/1.png', '我的/影视/2.mp4', '我的/日记/a.md'])
    );
    // 清单附件顺序 = 输入顺序（并行只提速，不漂移顺序）
    expect(note.attachments.map((a) => a.path)).toEqual(['我的/影视/1.png', '我的/影视/2.mp4']);
  });

  it('restoreNote：按附件逐个 + 笔记本身上报，末尾 done===total', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/a.md',
      title: 'a',
      content: '# a',
      attachments: [{ path: '我的/影视/1.png', data: 'MTIzNA==' }],
    });
    const events: Array<{ done: number; total: number }> = [];
    await sm.restoreNote(note.id, (p) => events.push({ done: p.done, total: p.total }));
    const last = events[events.length - 1];
    expect(last.done).toBe(2);
    expect(last.total).toBe(2);
  });

  it('lockNote kind=diary-entry：不删整 md 原文件、清单带 kind 标记', async () => {
    makeApp(vault);
    vault.create('我的/日记/2025-06-01.md', '# 📖 08:00\n正文\n');
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/2025-06-01.md',
      title: '2025-06-01 · 08:00 日记',
      kind: 'diary-entry',
      content: '# 📖🔐 08:00\n正文',
      attachments: [],
    });
    // 整 md 不被删除（日记条目块由日记域自摘除）
    expect(vault.getAbstractFileByPath('我的/日记/2025-06-01.md')).toBeTruthy();
    expect(note.kind).toBe('diary-entry');
    expect(sm.manifest.notes.some((n) => n.id === note.id && n.kind === 'diary-entry')).toBe(true);
  });

  it('restoreDiaryEntry：解正文并把块 merge 回原 md（时间序）', async () => {
    makeApp(vault);
    vault.create('我的/日记/2025-06-01.md', '# 📖 07:00\n早起\n');
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/2025-06-01.md',
      title: '2025-06-01 · 09:00 日记',
      kind: 'diary-entry',
      content: '# 📖🔐 09:00\n上午写', // 09:00 应在 07:00 之后
      attachments: [],
    });
    expect(await sm.getDiaryEntryPlain(note.id)).toBe('# 📖🔐 09:00\n上午写');
    const ok = await sm.restoreDiaryEntry(note.id, '# 📖 09:00\n上午写');
    expect(ok).toBe(true);
    const md = vault.files.get('我的/日记/2025-06-01.md')!;
    const idx07 = md.indexOf('# 📖 07:00');
    const idx09 = md.indexOf('# 📖 09:00');
    expect(idx07).toBeGreaterThanOrEqual(0);
    expect(idx09).toBeGreaterThan(idx07); // 时间序在 07:00 之后
    expect(md).toContain('上午写');
    // 取出即删：清单不再含有该条
    expect(sm.manifest.notes.some((n) => n.id === note.id)).toBe(false);
  });

  it('restoreDiaryEntry：md 已删则新建该日期文件', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/2025-06-02.md',
      title: '2025-06-02 · 10:30 日记',
      kind: 'diary-entry',
      content: '# ✍️🔐 10:30\n随笔',
      attachments: [],
    });
    const ok = await sm.restoreDiaryEntry(note.id, '# ✍️ 10:30\n随笔');
    expect(ok).toBe(true);
    expect(vault.files.get('我的/日记/2025-06-02.md')).toContain('随笔');
  });
});

describe('SafeManager 提交式加密（ADR-0018）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('lockNote 成功：暂存区与挂起标记无残留，镜像平铺在正式顶层', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, {
      content: '# A',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'PREVIEW' }],
    });
    // 顶层镜像齐备（提交序列 S3 搬入成功）
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.contentRef)).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.attachments[0].blobRef)).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.attachments[0].previewRef)).toBe(true);
    // 暂存区无残留（无挂起标记、无 .staging 文件）
    expect(vault.files.get('CONFIG/.ENCRYPT/.staging/pending.json')).toBeUndefined();
    expect([...vault.files.keys()].some((p) => p.startsWith('CONFIG/.ENCRYPT/.staging/'))).toBe(false);
  });

  it('任一附件加密失败 → 整笔放弃：无顶层镜像、无暂存残留、原文件不动', async () => {
    makeApp(vault);
    vault.create('我的/日记/2025-06-01.md', '# 日记');
    vault.createBinary('我的/影视/1.png', new TextEncoder().encode('FIRST').buffer);
    vault.createBinary('我的/影视/2.png', new TextEncoder().encode('SECOND').buffer);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const realEncrypt = CryptoService.encrypt.bind(CryptoService);
    const spy = vi.spyOn(CryptoService, 'encrypt').mockImplementation(async (data: string, pw: string) => {
      if (data === 'SECOND') throw new Error('boom');
      return realEncrypt(data, pw);
    });
    try {
      await expect(
        sm.lockNote({
          path: '我的/日记/2025-06-01.md',
          title: '2025-06-01',
          content: '# 日记',
          attachments: [
            { path: '我的/影视/1.png', data: 'FIRST', previewData: 'P1' },
            { path: '我的/影视/2.png', data: 'SECOND' },
          ],
        })
      ).rejects.toThrow('boom');
    } finally {
      spy.mockRestore();
    }
    // 原文件未动
    expect(vault.files.get('我的/日记/2025-06-01.md')).toBe('# 日记');
    expect(vault.binaryFiles.has('我的/影视/1.png')).toBe(true);
    expect(vault.binaryFiles.has('我的/影视/2.png')).toBe(true);
    // 无顶层镜像（.safe.enc 除外）、无暂存残留、清单无条目、无挂起标记
    expect(
      [...vault.files.keys()].some(
        (p) => p.startsWith('CONFIG/.ENCRYPT/') && p !== 'CONFIG/.ENCRYPT/.safe.enc' && !p.includes('/.staging/') && p.endsWith('.enc')
      )
    ).toBe(false);
    expect([...vault.files.keys()].some((p) => p.startsWith('CONFIG/.ENCRYPT/.staging/'))).toBe(false);
    expect(sm.manifest.notes.length).toBe(0);
  });

  it('自愈回滚：解锁时丢弃挂起半提交条目、删除已搬入镜像、清空暂存与标记', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, {
      content: '# A',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'PREVIEW' }],
    });
    const contentRef = note.contentRef;
    const blobRef = note.attachments[0].blobRef;
    const prevRef = note.attachments[0].previewRef;
    // 制造崩溃现场（清单先行已提交 + 挂起标记残留 + 暂存残留）
    vault.files.set('CONFIG/.ENCRYPT/.staging/pending.json', JSON.stringify([note.id]));
    vault.files.set('CONFIG/.ENCRYPT/.staging/.stale.enc', 'stale');
    expect(vault.files.has('CONFIG/.ENCRYPT/' + contentRef)).toBe(true); // 镜像已搬入顶层
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    await sm2.unlock('pw');
    // 条目回滚、顶层镜像删除、暂存/标记清空；清单本体保留
    expect(sm2.manifest.notes.length).toBe(0);
    expect(vault.files.get('CONFIG/.ENCRYPT/' + contentRef)).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/' + blobRef)).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/' + prevRef)).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/.staging/pending.json')).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/.staging/.stale.enc')).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/.safe.enc')).toBeTruthy();
  });

  it('自愈回滚：挂起标记无对应条目（S2 前崩溃）→ 仅清空暂存，清单不动', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    vault.files.set('CONFIG/.ENCRYPT/.staging/pending.json', JSON.stringify(['enc-deadbeef']));
    vault.files.set('CONFIG/.ENCRYPT/.staging/.ghost.enc', 'ghost');
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    await sm2.unlock('pw');
    expect(sm2.manifest.notes.length).toBe(0);
    expect(vault.files.get('CONFIG/.ENCRYPT/.staging/pending.json')).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/.staging/.ghost.enc')).toBeUndefined();
  });

  it('手动清理未引用密文（Q5-A）：只删无引用平铺点前缀密文，保留清单/引用镜像/非点前缀文件并清空暂存', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, {
      content: '# A',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==' }],
    });
    const contentRef = note.contentRef;
    const blobRef = note.attachments[0].blobRef;
    vault.files.set('CONFIG/.ENCRYPT/.junk1.enc', 'junk1');
    vault.files.set('CONFIG/.ENCRYPT/.junk2.enc', 'junk2');
    vault.files.set('CONFIG/.ENCRYPT/plain.enc', 'non-dot'); // 非点前缀：不碰（旧布局保守）
    vault.files.set('CONFIG/.ENCRYPT/.staging/.stale.enc', 'stale');
    const removed = await sm.cleanupOrphans();
    expect(removed).toBe(2);
    expect(vault.files.get('CONFIG/.ENCRYPT/.junk1.enc')).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/.junk2.enc')).toBeUndefined();
    // 保留：引用镜像、清单本体、非点前缀文件；暂存已清空
    expect(vault.files.get('CONFIG/.ENCRYPT/' + contentRef)).toBeTruthy();
    expect(vault.files.get('CONFIG/.ENCRYPT/' + blobRef)).toBeTruthy();
    expect(vault.files.get('CONFIG/.ENCRYPT/.safe.enc')).toBeTruthy();
    expect(vault.files.get('CONFIG/.ENCRYPT/plain.enc')).toBe('non-dot');
    expect(vault.files.get('CONFIG/.ENCRYPT/.staging/.stale.enc')).toBeUndefined();
  });
});

describe('SafeManager mapLimit 受控并发', () => {
  it('并发执行、保持输入顺序返回、全部任务执行', async () => {
    const order: number[] = [];
    const results = await mapLimit([1, 2, 3, 4, 5], 3, async (x) => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(x);
      return x * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(order.length).toBe(5);
  });

  it('任一任务 reject → 整体 reject', async () => {
    await expect(
      mapLimit([1, 2, 3], 2, async (x) => {
        if (x === 2) throw new Error('boom');
        return x;
      })
    ).rejects.toThrow('boom');
  });
});

describe('SafeManager 清单损坏与首设回滚（雷 1/4）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('空清单文件：unlock 返回 false + manifestIssue=empty（不再静默重设主密码）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw'); // 首设
    sm.lock();
    // 模拟半写崩溃：清单文件被截断为空
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc', '');
    expect(await sm.unlock('any')).toBe(false);
    expect(sm.manifestIssue).toBe('empty');
    expect(sm.unlocked).toBe(false);
    // 旧密文未被覆盖（等待 UI 显式确认重设）
    expect(vault.files.get('CONFIG/.ENCRYPT/.safe.enc')).toBe('');
  });

  it('损坏清单（解密成功但解析失败）：unlock false + manifestIssue=corrupt；密码错误不设 issue', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    // 用正确密码加密一段非 JSON 内容（模拟清单被改坏）
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc', await CryptoService.encrypt('not-json-at-all', 'pw'));
    sm.lock();
    expect(await sm.unlock('pw')).toBe(false);
    expect(sm.manifestIssue).toBe('corrupt');
    // GCM 认证失败（密码错误）按密码错处理，不设 issue（UI 提示重试而非引导重设）
    expect(await sm.unlock('wrong')).toBe(false);
    expect(sm.manifestIssue).toBeUndefined();
  });

  it('forceReset：损坏清单显式确认后重设新密码（旧数据丢弃语义由 UI 确认负责）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('oldpw');
    sm.lock();
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc', '');
    expect(await sm.unlock('newpw', true)).toBe(true);
    expect(sm.unlocked).toBe(true);
    sm.lock();
    expect(await sm.unlock('newpw')).toBe(true);
  });

  it('saveManifest 原子写：.tmp 临时文件无残留，清单整体可解密再读', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    await sm.lockNote({ path: 'a.md', title: 'a', content: '# a', attachments: [] });
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc')).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc.tmp')).toBe(false); // tmp+rename 无残留
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('pw')).toBe(true);
    expect(sm2.manifest.notes.length).toBe(1);
  });

  it('首设写清单失败：unlock 回滚解锁态并返回 false（不假装成功）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    const spy = vi.spyOn(vault.adapter, 'write').mockRejectedValue(new Error('disk full'));
    try {
      expect(await sm.unlock('pw')).toBe(false);
      expect(sm.unlocked).toBe(false);
      expect(sm.password).toBeNull();
      expect(sm.manifest.notes).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('SafeManager 原子还原（优化五：全部成功才落盘）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('附件可解但正文目标被用户占用 → 整体不落盘：附件明文未写回、条目与密文保留', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/a.md',
      title: 'a',
      content: '# A',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==' }],
    });
    // 用户新建同名笔记占用正文路径；附件路径空闲
    vault.create('我的/日记/a.md', '# 用户的笔记');
    const { conflicts, removed } = await sm.restoreNote(note.id);
    expect(conflicts).toEqual(['我的/日记/a.md']);
    expect(removed).toBe(false);
    // 原子语义：附件明文未写回（未落任何盘）
    expect(vault.binaryFiles.has('我的/影视/pic.png')).toBe(false);
    expect(vault.files.get('我的/日记/a.md')).toBe('# 用户的笔记'); // 用户文件未被覆盖
    expect(sm.manifest.notes.some((n) => n.id === note.id)).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.attachments[0].blobRef)).toBe(true);
  });

  it('任一附件镜像缺失 → 整体不落盘：可解附件与正文均未写回', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/a.md',
      title: 'a',
      content: '# A',
      attachments: [
        { path: '我的/影视/good.png', data: 'QUJDREVGRw==' },
        { path: '我的/影视/missing.png', data: 'REVGSElK' },
      ],
    });
    vault.files.delete('CONFIG/.ENCRYPT/' + note.attachments[1].blobRef); // 镜像被误删
    const { conflicts, removed } = await sm.restoreNote(note.id);
    expect(conflicts).toEqual(['我的/影视/missing.png']);
    expect(removed).toBe(false);
    // 可解附件也未写回（原子：任一失败零落盘）
    expect(vault.binaryFiles.has('我的/影视/good.png')).toBe(false);
    expect(vault.files.has('我的/日记/a.md')).toBe(false);
  });

  it('指纹不符（镜像被替换成另一份同密码密文）→ 完整性冲突不写回，整体不落盘', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/a.md',
      title: 'a',
      content: '# A',
      attachments: [
        { path: '我的/影视/mine.png', data: 'QUJDREVGRw==' },
        { path: '我的/影视/yours.png', data: 'REVGSElK' },
      ],
    });
    // 镜像被替换成另一份同密码加密内容：解密能过但内容指纹与加密时不符（数据被改），永不写回
    vault.files.set(
      'CONFIG/.ENCRYPT/' + note.attachments[1].blobRef,
      await CryptoService.encrypt('TAMPERED-BASE64', 'pw')
    );
    const { conflicts, removed } = await sm.restoreNote(note.id);
    expect(conflicts).toEqual(['我的/影视/yours.png']);
    expect(removed).toBe(false);
    expect(vault.binaryFiles.has('我的/影视/mine.png')).toBe(false); // 未写回
    expect(vault.files.has('我的/日记/a.md')).toBe(false);
  });

  it('目标路径被用户同名文件占用（内容不同）→ 判冲突不覆盖、整体不落盘', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/a.md',
      title: 'a',
      content: '# A',
      attachments: [
        { path: '我的/影视/mine.png', data: 'QUJDREVGRw==' },
        { path: '我的/影视/yours.png', data: 'REVGSElK' },
      ],
    });
    // 用户在附件原路径新建了不同内容的同名文件 → 占用冲突，绝不覆盖
    vault.createBinary('我的/影视/yours.png', new TextEncoder().encode('USER-NEW-FILE').buffer);
    const { conflicts, removed } = await sm.restoreNote(note.id);
    expect(conflicts).toEqual(['我的/影视/yours.png']);
    expect(removed).toBe(false);
    const userBytes = await vault.readBinary(vault.file('我的/影视/yours.png'));
    expect(new TextDecoder().decode(userBytes)).toBe('USER-NEW-FILE'); // 用户文件原样
    expect(vault.binaryFiles.has('我的/影视/mine.png')).toBe(false); // 其余附件未写回
    expect(vault.files.has('我的/日记/a.md')).toBe(false);
  });

  it('同指纹残留文件幂等覆盖：指纹匹配 → 非冲突，整体还原成功', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/a.md',
      title: 'a',
      content: '# A',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==' }],
    });
    // 本次还原先手动写回同内容文件（模拟上次半成状态）：指纹相同 → 放行覆盖
    vault.createBinary('我的/影视/pic.png', new TextEncoder().encode('ABCDEFG').buffer);
    const { conflicts, removed } = await sm.restoreNote(note.id);
    expect(conflicts).toEqual([]);
    expect(removed).toBe(true);
  });
});