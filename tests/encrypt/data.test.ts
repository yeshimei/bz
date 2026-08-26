// @vitest-environment node
/**
 * 加密保险箱数据层测试：SafeManager 加锁/还原（取出即删）状态机、
 * 清单加密存储、平铺点前缀密文镜像、指纹冲突安全、崩溃幂等。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafeManager, fingerprintOf, flatName, mapLimit, type HealthProgress, type SafeNote } from '../../src/encrypt/data';
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
    expect(note.attachments[0].hasPreview).toBe(true);
  });

  it('lockNote 正文写入镜像文件（contentRef），重新解锁经 decryptNoteBody 解出原文', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm);
    // 正文镜像平铺落盘（encryptRoot 根），清单不含正文本体
    expect(note.contentRef.startsWith('.')).toBe(true);
    expect(note.contentRef.endsWith('.enc')).toBe(true);
    expect((note as any).content).toBeUndefined(); // 内嵌字段已移除（不做旧版兼容）
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

  it('restoreDiaryEntry 幂等：目标 md 已含相同标题行（中断残留）→ 不重复插入，仍成功清理', async () => {
    makeApp(vault);
    vault.create('我的/日记/2025-06-01.md', '# 📖 07:00\n早起\n');
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/2025-06-01.md',
      title: '2025-06-01 · 09:00 日记',
      kind: 'diary-entry',
      content: '# 📖🔐 09:00\n上午写',
      attachments: [],
    });
    // 模拟「块已 merge 但清单没保存」的残留现场：目标 md 已含还原块标题行
    vault.create('我的/日记/2025-06-01.md', '# 📖 07:00\n早起\n# 📖 09:00\n上午写\n');
    const ok = await sm.restoreDiaryEntry(note.id, '# 📖 09:00\n上午写');
    expect(ok).toBe(true);
    const md = vault.files.get('我的/日记/2025-06-01.md')!;
    // 09:00 块只出现一次（不重复插入）
    expect(md.match(/# 📖 09:00/g)).toHaveLength(1);
    expect(sm.manifest.notes.some((n) => n.id === note.id)).toBe(false);
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

  it('回归（P1-7）：附件一败两成 → catch 清理覆盖全部已登记暂存，暂存区零残留', async () => {
    makeApp(vault);
    vault.create('我的/日记/2025-06-01.md', '# 日记');
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const realEncrypt = CryptoService.encrypt.bind(CryptoService);
    const spy = vi.spyOn(CryptoService, 'encrypt').mockImplementation(async (data: string, pw: string) => {
      if (data === 'BAD') throw new Error('boom-BAD');
      return realEncrypt(data, pw);
    });
    try {
      await expect(
        sm.lockNote({
          path: '我的/日记/2025-06-01.md',
          title: '2025-06-01',
          content: '# 正文',
          attachments: [
            { path: '我的/a.png', data: 'QUJDREVGRw==' },
            { path: '我的/b.png', data: 'BAD' },
            { path: '我的/c.png', data: 'REVGSElK' },
          ],
        })
      ).rejects.toThrow('boom-BAD');
    } finally {
      spy.mockRestore();
    }
    // 原文件未动、清单无条目
    expect(vault.files.get('我的/日记/2025-06-01.md')).toBe('# 日记');
    expect(sm.manifest.notes.length).toBe(0);
    // 顶层仅清单本体（两笔成功附件的镜像未搬入）；暂存区零残留（即时登记 → catch 全量收走）
    const topLevelEnc = [...vault.files.keys()].filter(
      (p) => p.startsWith('CONFIG/.ENCRYPT/') && !p.includes('/.staging/') && p.endsWith('.enc')
    );
    expect(topLevelEnc).toEqual(['CONFIG/.ENCRYPT/.safe.enc']);
    expect([...vault.files.keys()].some((p) => p.startsWith('CONFIG/.ENCRYPT/.staging/'))).toBe(false);
  });

  it('回归（P1-5）：saveManifest 注入失败 → 清单无幽灵条目，同会话后续成功保存不固化', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    // 第一笔：清单落盘阶段注入失败
    const spy = vi.spyOn(sm, 'saveManifest').mockRejectedValueOnce(new Error('disk error'));
    try {
      await expect(lockSample(sm, { content: '# 第一笔（落盘失败）' })).rejects.toThrow('disk error');
    } finally {
      spy.mockRestore();
    }
    // 内存清单已回退：无幽灵条目
    expect(sm.manifest.notes.length).toBe(0);
    // 同会话后续成功保存不会把幽灵条目固化：第二笔正常入库后重开只见这一笔
    await lockSample(sm, { notePath: '我的/日记/2025-06-02.md', content: '# 第二笔（成功）' });
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    await sm2.unlock('pw');
    expect(sm2.manifest.notes.length).toBe(1);
    expect(await sm2.decryptNoteBody(sm2.manifest.notes[0])).toContain('第二笔');
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
    // 解锁入口暴露回滚计数（ticket 6：UI 解锁成功追加「自动回滚」提示）
    expect(sm2.selfHealRolledBack).toBe(1);
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
    // 无条目录回滚 → 计数为 0（不误报）
    expect(sm2.selfHealRolledBack).toBe(0);
  });

  it('自愈回滚计数（ticket 6）：selfHeal 返回值 = 实际移除条目数；无对应条目的挂起标记不计入；无挂起为 0', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const a = await lockSample(sm, { content: '# A' });
    const b = await lockSample(sm, { notePath: '我的/日记/2025-06-02.md', content: '# B' });
    // 现场：A 是真实半提交（清单有条目 + 挂起标记）；B 是 S2 前崩溃残留（标记无对应条目）
    vault.files.set('CONFIG/.ENCRYPT/.staging/pending.json', JSON.stringify([a.id, 'enc-nothing']));
    expect(await sm.selfHeal()).toBe(1); // 只有 A 被回滚
    expect(sm.manifest.notes.length).toBe(1); // B 保留
    expect(sm.selfHealRolledBack).toBe(1); // selfHeal 直接调用同样写回计数
    // 无挂起条目 → 0
    expect(await sm.selfHeal()).toBe(0);
  });

  it('体检扫描孤儿密文（不删）：报告顶层无引用点前缀密文，保留清单/引用镜像/非点前缀文件；勾选后清理并清空暂存', async () => {
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
    vault.files.set('CONFIG/.ENCRYPT/plain.enc', 'non-dot'); // 非点前缀：不碰（目录结构保护）
    vault.files.set('CONFIG/.ENCRYPT/.staging/.stale.enc', 'stale');
    // 扫描只报告不删：孤儿仍在磁盘上
    const report = await sm.scanHealth();
    const orphans = report.items.filter((i) => i.cat === 'orphan-file');
    expect(orphans.length).toBe(2);
    expect(report.items.some((i) => i.cat === 'dead-entry')).toBe(false);
    expect(vault.files.get('CONFIG/.ENCRYPT/.junk1.enc')).toBe('junk1');
    // 勾选两个孤儿 → 清理
    const { files, notes } = await sm.resolveHealth(orphans.map((i) => i.key));
    expect(files).toBe(2);
    expect(notes).toBe(0);
    expect(vault.files.get('CONFIG/.ENCRYPT/.junk1.enc')).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/.junk2.enc')).toBeUndefined();
    // 保留：引用镜像、清单本体、非点前缀文件；暂存已清空
    expect(vault.files.get('CONFIG/.ENCRYPT/' + contentRef)).toBeTruthy();
    expect(vault.files.get('CONFIG/.ENCRYPT/' + blobRef)).toBeTruthy();
    expect(vault.files.get('CONFIG/.ENCRYPT/.safe.enc')).toBeTruthy();
    expect(vault.files.get('CONFIG/.ENCRYPT/plain.enc')).toBe('non-dot');
    expect(vault.files.get('CONFIG/.ENCRYPT/.staging/.stale.enc')).toBeUndefined();
  });

  it('体检失效条目：正文镜像已丢失 → dead-entry 报告；勾选后整条清除（含残留附件镜像），清单同步持久化', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const dead = await lockSample(sm, {
      content: '# 正文已丢',
      attachments: [
        { path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'PREVIEW' },
      ],
    });
    const alive = await lockSample(sm, {
      notePath: '我的/日记/2025-06-02.md',
      content: '# 存活的笔记',
      attachments: [],
    });
    // 模拟镜像被误删/同步丢失：dead 的正文镜像没了
    vault.files.delete('CONFIG/.ENCRYPT/' + dead.contentRef);
    const report = await sm.scanHealth();
    const deadItems = report.items.filter((i) => i.cat === 'dead-entry');
    expect(deadItems.length).toBe(1);
    expect(deadItems[0].label).toBe(dead.title);
    expect(deadItems[0].key).toBe('entry:' + dead.id);
    expect(report.items.some((i) => i.cat === 'orphan-file')).toBe(false);
    // 勾选清理
    const { files, notes } = await sm.resolveHealth(deadItems.map((i) => i.key));
    expect(notes).toBe(1);
    expect(files).toBe(0);
    // dead 条目从清单移除，其残留附件镜像（原始层+预览层）一并删除
    expect(sm.manifest.notes.some((n) => n.id === dead.id)).toBe(false);
    expect(vault.files.get('CONFIG/.ENCRYPT/' + dead.attachments[0].blobRef)).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/' + dead.attachments[0].previewRef)).toBeUndefined();
    // alive 条目原样保留（正文镜像仍在）
    expect(sm.manifest.notes.some((n) => n.id === alive.id)).toBe(true);
    expect(vault.files.get('CONFIG/.ENCRYPT/' + alive.contentRef)).toBeTruthy();
    // 清单已持久化：重开解锁后条目数一致
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    await sm2.unlock('pw');
    expect(sm2.manifest.notes.length).toBe(1);
  });

  it('体检附件缺失：仅附件原始层镜像缺失但正文可读 → 条目保留，报告 missing-attachment 且勾选无效（不误删）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, {
      content: '# 正文还在',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'PREVIEW' }],
    });
    vault.files.delete('CONFIG/.ENCRYPT/' + note.attachments[0].blobRef); // 仅附件原始层镜像缺失
    const report = await sm.scanHealth();
    expect(report.items.some((i) => i.cat === 'dead-entry')).toBe(false);
    expect(report.items.some((i) => i.cat === 'orphan-file')).toBe(false); // 预览镜像仍被清单引用，不误报孤儿
    const missing = report.items.filter((i) => i.cat === 'missing-attachment');
    expect(missing.length).toBe(1);
    expect(missing[0].label).toBe('我的/影视/pic.png');
    // 勾选缺失类 / 损坏类 key → 防御性忽略，什么都不删
    const { files, notes } = await sm.resolveHealth([missing[0].key, 'body:' + note.id]);
    expect(files).toBe(0);
    expect(notes).toBe(0);
    expect(sm.manifest.notes.some((n) => n.id === note.id)).toBe(true);
  });

  it('体检损坏镜像（解锁后完整性检测）：正文被篡改 → corrupted-body；附件被替换/篡改 → corrupted-attachment', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, {
      content: '# 完好',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==' }],
    });
    const att = note.attachments[0];
    // 正文镜像被垃圾覆盖（解密失败）→ corrupted-body
    vault.files.set('CONFIG/.ENCRYPT/' + note.contentRef, 'garbage-not-cipher');
    // 附件镜像被替换为「另一段正确加密」→ 解密成功但指纹不符 → corrupted-attachment
    const otherCipher = await CryptoService.encrypt('OTM3MjQx', 'pw');
    vault.files.set('CONFIG/.ENCRYPT/' + att.blobRef, otherCipher);
    const report = await sm.scanHealth();
    expect(report.integrityChecked).toBe(true);
    expect(report.items.some((i) => i.cat === 'corrupted-body' && i.label === note.title)).toBe(true);
    const corruptedAtt = report.items.filter((i) => i.cat === 'corrupted-attachment');
    expect(corruptedAtt.length).toBe(1);
    expect(corruptedAtt[0].label).toBe('我的/影视/pic.png');
    // 条目与镜像仍在（只报告不清理）；再勾损坏类 key 也不会误删
    await sm.resolveHealth(report.items.map((i) => i.key));
    expect(sm.manifest.notes.some((n) => n.id === note.id)).toBe(true);
    expect(vault.files.get('CONFIG/.ENCRYPT/' + att.blobRef)).toBe(otherCipher);
  });

  it('体检未解锁：返回空报告（清单明文已清空，无引用判定依据——绝不误把正文镜像当孤儿）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, { content: '# x', attachments: [] });
    vault.files.delete('CONFIG/.ENCRYPT/' + note.contentRef); // 正文镜像丢失
    vault.files.set('CONFIG/.ENCRYPT/.junk.enc', 'junk');
    sm.lock();
    const report = await sm.scanHealth();
    expect(report.integrityChecked).toBe(false);
    expect(report.items.length).toBe(0); // 未解锁不做任何对账（否则正文镜像会被误判为孤儿）
  });

  it('解锁后重新体检：孤儿/失效条目/完整性恢复可见', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, { content: '# x', attachments: [] });
    vault.files.delete('CONFIG/.ENCRYPT/' + note.contentRef);
    vault.files.set('CONFIG/.ENCRYPT/.junk.enc', 'junk');
    sm.lock();
    expect((await sm.scanHealth()).items.length).toBe(0); // 锁定态空报告
    await sm.unlock('pw'); // 二次解锁
    const report = await sm.scanHealth();
    expect(report.integrityChecked).toBe(true);
    expect(report.items.some((i) => i.cat === 'dead-entry')).toBe(true);
    expect(report.items.some((i) => i.cat === 'orphan-file')).toBe(true);
  });

  it('体检进度回调：done 递增至 total、found 增量之和 = 报告、current 逐项变化', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    await lockSample(sm, {
      content: '# 有附件',
      attachments: [{ path: '我的/影视/p1.png', data: 'QUJDREVGRw==' }],
    });
    await lockSample(sm, {
      notePath: '我的/笔记/b.md',
      content: '# 无附件',
      attachments: [],
    });
    const events: HealthProgress[] = [];
    const report = await sm.scanHealth((p) => events.push(p));
    // 步数 = 孤儿轮 1 + 每条（容器 + 正文完整性）+ 每个附件
    const steps = 1 + (2 + 1) + (2 + 0);
    expect(events.length).toBe(steps);
    expect(events[0].done).toBe(1);
    for (let i = 1; i < events.length; i++) expect(events[i].done).toBe(events[i - 1].done + 1);
    expect(events[events.length - 1].done).toBe(events[events.length - 1].total);
    expect(events.every((e) => e.current.length > 0)).toBe(true);
    // 增量 found 之和 = 最终报告 items（本次无问题 → 全部为空数组也一致）
    const foundAll = events.flatMap((e) => e.found);
    expect(foundAll.length).toBe(report.items.length);

    // 有发现时：失效条目的 found 在其对应的进度事件中增量出现
    const n3 = await lockSample(sm, { notePath: '我的/笔记/c.md', content: '# 将失效', attachments: [] });
    vault.files.delete('CONFIG/.ENCRYPT/' + n3.contentRef);
    const events2: HealthProgress[] = [];
    const report2 = await sm.scanHealth((p) => events2.push(p));
    const deadFound = events2.filter((e) => e.found.some((i) => i.cat === 'dead-entry'));
    expect(deadFound.length).toBe(1);
    expect(deadFound[0].current).toBe(n3.title);
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

  it('回归（P1-7）：单任务失败时等其余任务全部完成后才整体 reject（allSettled 收敛）', async () => {
    const completed: number[] = [];
    // 任务 1 立即失败；任务 2/3 各需 15ms 才完成——旧实现（Promise.all）会在它们收尾前就 reject
    const err = await mapLimit([1, 2, 3], 3, async (x) => {
      if (x === 1) throw new Error('boom');
      await new Promise((r) => setTimeout(r, 15));
      completed.push(x);
      return x;
    }).then(
      () => null,
      (e) => e
    );
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('boom');
    // reject 抛给调用方时，其余任务的副作用已全部完成（catch 可一次性清理）
    expect([...completed].sort()).toEqual([2, 3]);
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

  it('saveManifest 三段式原子写：tmp/bak 均无残留，清单整体可解密再读', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    await sm.lockNote({ path: 'a.md', title: 'a', content: '# a', attachments: [] });
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc')).toBe(true);
    // Obsidian rename 不支持覆盖目标（Destination file already exists）→ 三段式，无任何残留副本
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc.tmp')).toBe(false);
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc.bak')).toBe(false);
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('pw')).toBe(true);
    expect(sm2.manifest.notes.length).toBe(1);
  });

  it('原子写中断恢复：S2 后崩溃（tmp+bak 在、正位缺）→ unlock 用 tmp 恢复最新清单并删 bak', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    await sm.lockNote({ path: 'a.md', title: 'a', content: '# A', attachments: [] });
    // 模拟 S2 后崩溃：旧清单已被挪成 .bak，新密文在 .tmp，正位缺失
    const bak = await CryptoService.encrypt('{"version":1,"notes":[]}', 'pw');
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc.bak', bak);
    const newer = await CryptoService.encrypt(
      JSON.stringify({ version: 1, notes: [{ id: 'enc-x', path: 'b.md', title: 'b', contentRef: '.x.enc', createdAt: '2026-01-01T00:00:00.000Z', attachments: [] }] }),
      'pw'
    );
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc.tmp', newer);
    vault.files.delete('CONFIG/.ENCRYPT/.safe.enc'); // 正位缺失
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('pw')).toBe(true);
    // 恢复为 tmp 的最新内容；bak/tmp 已清
    expect(sm2.manifest.notes.length).toBe(1);
    expect(sm2.manifest.notes[0].title).toBe('b');
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc.bak')).toBe(false);
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc.tmp')).toBe(false);
  });

  it('原子写中断恢复：S3 后崩溃（正位新、bak 旧）→ unlock 删 bak 保留新清单', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    await sm.lockNote({ path: 'a.md', title: 'a', content: '# A', attachments: [] });
    // 模拟 S3 后崩溃：正位已是新清单，旧副本在 .bak
    vault.files.set(
      'CONFIG/.ENCRYPT/.safe.enc.bak',
      await CryptoService.encrypt('{"version":1,"notes":[]}', 'pw')
    );
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('pw')).toBe(true);
    expect(sm2.manifest.notes.length).toBe(1); // 保留新清单（含 a.md）
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc.bak')).toBe(false);
  });

  it('原子写中断恢复：S1 后崩溃（仅 tmp 残留）→ unlock 清理 tmp，清单不受影响', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    await sm.lockNote({ path: 'a.md', title: 'a', content: '# A', attachments: [] });
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc.tmp', '残留密文');
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('pw')).toBe(true);
    expect(sm2.manifest.notes.length).toBe(1);
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc.tmp')).toBe(false);
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

describe('SafeManager password-vault 载荷（路线 B：密码本合并至保险箱）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('lockNote kind=password-vault：不删任何原文件、清单带 kind 标记、正文镜像落盘', async () => {
    makeApp(vault);
    vault.create('某个/普通笔记.md', '# 别删我'); // 无关文件必须原样保留
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: 'CONFIG/.ENCRYPT/passwords', // 虚拟占位路径（无原文件）
      title: '密码本',
      kind: 'password-vault',
      content: JSON.stringify([{ id: 'pw-1', platform: 'GitHub' }]),
      attachments: [],
    });
    expect(note.kind).toBe('password-vault');
    expect(sm.manifest.notes.some((n) => n.id === note.id && n.kind === 'password-vault')).toBe(true);
    expect(vault.files.has('某个/普通笔记.md')).toBe(true); // 原文件未动
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.contentRef)).toBe(true);
    // 密文非明文
    expect(vault.files.get('CONFIG/.ENCRYPT/' + note.contentRef)!).not.toContain('GitHub');
  });

  it('updateNotePayload：覆盖同一 contentRef 镜像（不产生孤儿）、清单同步、重开可读', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: 'CONFIG/.ENCRYPT/passwords',
      title: '密码本',
      kind: 'password-vault',
      content: '[]',
      attachments: [],
    });
    const ref = note.contentRef;
    await sm.updateNotePayload(note.id, '[{"id":"pw-1"}]');
    // 同一镜像名被覆盖：无新镜像、无孤儿
    expect(sm.manifest.notes[0].contentRef).toBe(ref);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + ref)).toBe(true);
    // 原子换入（P0-1）成功后无 .bak 残留副本
    expect(vault.files.has('CONFIG/.ENCRYPT/' + ref + '.bak')).toBe(false);
    const topLevel = [...vault.files.keys()].filter(
      (p) => p.startsWith('CONFIG/.ENCRYPT/') && !p.includes('/.staging/') && p.endsWith('.enc')
    ).length;
    expect(topLevel).toBe(2); // .safe.enc + 唯一正文镜像
    // 重开（重新解锁）可读
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    await sm2.unlock('pw');
    const plain = await sm2.decryptNoteBody(sm2.manifest.notes[0]);
    expect(JSON.parse(plain!)).toEqual([{ id: 'pw-1' }]);
  });

  it('updateNotePayload：未解锁/条目不存在抛错', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await expect(sm.updateNotePayload('enc-x', '[]')).rejects.toThrow('未解锁');
    await sm.unlock('pw');
    await expect(sm.updateNotePayload('enc-x', '[]')).rejects.toThrow('未找到清单条目');
  });

  it('回归（P0-1）暂存写入失败：正式位保持旧完整密文、无半截文件、无 .bak/暂存残留', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: 'CONFIG/.ENCRYPT/passwords',
      title: '密码本',
      kind: 'password-vault',
      content: '[{"id":"old"}]',
      attachments: [],
    });
    const refPath = 'CONFIG/.ENCRYPT/' + note.contentRef;
    const oldCipher = vault.files.get(refPath)!;
    // 注入：所有 adapter.write 失败（模拟磁盘满/半写中断）——新密文尚未换入即失败
    const spy = vi.spyOn(vault.adapter, 'write').mockRejectedValue(new Error('disk full'));
    try {
      await expect(sm.updateNotePayload(note.id, '[{"id":"new"}]')).rejects.toThrow('disk full');
    } finally {
      spy.mockRestore();
    }
    // 正式位仍是旧完整密文，可解密为旧数据
    expect(vault.files.get(refPath)).toBe(oldCipher);
    expect(await sm.decryptNoteBody(sm.manifest.notes[0])).toBe('[{"id":"old"}]');
    // 无半截文件/换入残留副本；暂存区零残留
    expect(vault.files.has(refPath + '.bak')).toBe(false);
    expect([...vault.files.keys()].some((p) => p.startsWith('CONFIG/.ENCRYPT/.staging/'))).toBe(false);
    // 恢复后可正常覆盖写入新数据
    await sm.updateNotePayload(note.id, '[{"id":"new"}]');
    expect(await sm.decryptNoteBody(sm.manifest.notes[0])).toBe('[{"id":"new"}]');
  });

  it('回归（P0-1）换入（rename）失败：旧镜像回滚正位、内容仍可解密为旧数据', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: 'CONFIG/.ENCRYPT/passwords',
      title: '密码本',
      kind: 'password-vault',
      content: '[{"id":"old"}]',
      attachments: [],
    });
    const refPath = 'CONFIG/.ENCRYPT/' + note.contentRef;
    const oldCipher = vault.files.get(refPath)!;
    // 注入：仅「暂存镜像→顶层正位」的换入 rename 失败（旧镜像挪走成功；回滚路径不拦）
    const realRename = vault.adapter.rename.bind(vault.adapter);
    const spy = vi.spyOn(vault.adapter, 'rename').mockImplementation(async (from: string, to: string) => {
      void to;
      if (/\/\.staging\//.test(from)) throw new Error('promote failed');
      return realRename(from, to);
    });
    try {
      await expect(sm.updateNotePayload(note.id, '[{"id":"new"}]')).rejects.toThrow('promote failed');
    } finally {
      spy.mockRestore();
    }
    // 正式位回滚为旧完整密文
    expect(vault.files.get(refPath)).toBe(oldCipher);
    expect(await sm.decryptNoteBody(sm.manifest.notes[0])).toBe('[{"id":"old"}]');
    // .bak 已滚回正位（无残留）、暂存区零残留
    expect(vault.files.has(refPath + '.bak')).toBe(false);
    expect([...vault.files.keys()].some((p) => p.startsWith('CONFIG/.ENCRYPT/.staging/'))).toBe(false);
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

  it('还原重试幂等：正文/附件目标已存在且内容一致（上次中断残留）→ 放行，还原成功清理条目', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/a.md',
      title: 'a',
      content: '# 待还原内容',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==' }],
    });
    // 模拟「文件已还原但清单没保存」的残留现场：正文与附件都已在 vault（内容一致）
    vault.create('我的/日记/a.md', '# 待还原内容');
    vault.createBinary('我的/影视/pic.png', new TextEncoder().encode('ABCDEFG').buffer);
    const { conflicts, removed } = await sm.restoreNote(note.id);
    // 内容一致 → 无冲突，本次完成删镜像与条目清理
    expect(conflicts).toEqual([]);
    expect(removed).toBe(true);
    expect(sm.manifest.notes.some((n) => n.id === note.id)).toBe(false);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.contentRef)).toBe(false);
  });

  it('清单落盘失败（磁盘异常）：文件已还原、manifestSaveFailed=true、内存条目移除，可幂等重试', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const noteStash = await sm.lockNote({
      path: '我的/日记/a.md',
      title: 'a',
      content: '# 待还原',
      attachments: [],
    });
    const origSave = sm.saveManifest.bind(sm);
    const spy = vi.spyOn(sm, 'saveManifest').mockRejectedValue(new Error('disk error'));
    try {
      const { conflicts, removed, manifestSaveFailed } = await sm.restoreNote(noteStash.id);
      expect(conflicts).toEqual([]);
      expect(removed).toBe(false);
      expect(manifestSaveFailed).toBe(true);
      // 文件已还原到原位置
      expect(vault.files.get('我的/日记/a.md')).toContain('# 待还原');
      // 镜像已删、内存条目已移除（列表刷新后不再显示，磁盘清单留待下次保存）
      expect(vault.files.has('CONFIG/.ENCRYPT/' + noteStash.contentRef)).toBe(false);
      expect(sm.manifest.notes.some((n) => n.id === noteStash.id)).toBe(false);
    } finally {
      spy.mockRestore();
      void origSave;
    }
  });
});

describe('SafeManager 操作级互斥与挂起标记读改写（P1-6）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('挂起标记读-改-写：先前半提交笔的标记不被后续成功笔的清除吞掉，解锁自愈仍可回滚', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    // 笔 A：注入「暂存镜像→顶层」搬入失败（S3 崩溃现场）→ 清单已提交 + 挂起标记残留
    const realRename = vault.adapter.rename.bind(vault.adapter);
    const spyRename = vi.spyOn(vault.adapter, 'rename').mockImplementation(async (from: string, to: string) => {
      void to;
      if (/\/\.staging\//.test(from)) throw new Error('crash-S3');
      return realRename(from, to);
    });
    try {
      await expect(
        lockSample(sm, { content: '# A（半提交）', attachments: [{ path: '我的/pic.png', data: 'QUJDREVGRw==' }] })
      ).rejects.toThrow('crash-S3');
    } finally {
      spyRename.mockRestore();
    }
    const noteA = sm.manifest.notes[0];
    expect(noteA).toBeTruthy(); // 清单已先行提交（S2 成功、S3 失败 → 不回退，留待自愈）
    expect(JSON.parse(vault.files.get('CONFIG/.ENCRYPT/.staging/pending.json')!)).toEqual([noteA.id]);
    // 笔 B 正常完成：其 S4 只摘除自己的 id，A 的标记原样保留（旧实现整写/整删会互吞）
    await lockSample(sm, { notePath: '我的/日记/b.md', content: '# B（成功）', attachments: [] });
    expect(JSON.parse(vault.files.get('CONFIG/.ENCRYPT/.staging/pending.json')!)).toEqual([noteA.id]);
    // 自愈视角收敛：解锁后 A 被回滚、B 完好；无孤儿无 dead-entry，暂存与标记清空
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    await sm2.unlock('pw');
    expect(sm2.manifest.notes.length).toBe(1);
    expect(await sm2.decryptNoteBody(sm2.manifest.notes[0])).toContain('# B');
    const report = await sm2.scanHealth();
    expect(report.items.some((i) => i.cat === 'orphan-file')).toBe(false);
    expect(report.items.some((i) => i.cat === 'dead-entry')).toBe(false);
    expect([...vault.files.keys()].some((p) => p.startsWith('CONFIG/.ENCRYPT/.staging/'))).toBe(false);
  });

  it('操作级互斥：并发两笔 lockNote 串行执行——一成一败后两方意图均完整（无孤儿无幽灵）', async () => {
    makeApp(vault);
    vault.create('我的/x.md', '# X 原文');
    vault.create('我的/y.md', '# Y 原文');
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const realEncrypt = CryptoService.encrypt.bind(CryptoService);
    const order: string[] = [];
    const spy = vi.spyOn(CryptoService, 'encrypt').mockImplementation(async (data: string, pw: string) => {
      order.push(data);
      if (data === 'BAD-Y') throw new Error('boom-Y');
      return realEncrypt(data, pw);
    });
    try {
      const pX = sm.lockNote({
        path: '我的/x.md',
        title: 'X',
        content: '# X 密文',
        attachments: [{ path: '我的/x.png', data: 'GOOD-X' }],
      });
      const pY = sm.lockNote({
        path: '我的/y.md',
        title: 'Y',
        content: '# Y 密文',
        attachments: [{ path: '我的/y.png', data: 'BAD-Y' }],
      });
      const noteX: SafeNote = await pX;
      await expect(pY).rejects.toThrow('boom-Y');
      expect(noteX.title).toBe('X');
    } finally {
      spy.mockRestore();
    }
    // 串行证据：X 的全部加密（附件+正文）先于 Y 的任何加密发生
    expect(order.indexOf('BAD-Y')).toBeGreaterThan(order.indexOf('# X 密文'));
    // X 已完整提交：原文件删除、清单恰一条目；Y 整笔放弃：原文件未动
    expect(vault.files.has('我的/x.md')).toBe(false);
    expect(vault.files.get('我的/y.md')).toBe('# Y 原文');
    expect(sm.manifest.notes.length).toBe(1);
    // 自愈视角：重开解锁后仅 X 可读，无孤儿无 dead-entry，暂存与挂起标记零残留
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    await sm2.unlock('pw');
    expect(sm2.manifest.notes.length).toBe(1);
    expect(await sm2.decryptNoteBody(sm2.manifest.notes[0])).toContain('# X 密文');
    const report = await sm2.scanHealth();
    expect(report.items.length).toBe(0);
    expect([...vault.files.keys()].some((p) => p.startsWith('CONFIG/.ENCRYPT/.staging/'))).toBe(false);
  });
});