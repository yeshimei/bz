// @vitest-environment node
/**
 * 加密保险箱数据层测试：SafeManager 加锁/还原（取出即删）状态机、
 * 清单加密存储、平铺点前缀密文镜像、指纹冲突安全、崩溃幂等。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafeManager, fingerprintOf, flatName } from '../../src/encrypt/data';
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

  it('lockNote：按附件逐个 + 笔记本身上报（done/total/current）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const events: Array<{ done: number; total: number; current: string }> = [];
    await sm.lockNote(
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
    expect(events[0]).toMatchObject({ done: 1, total: 3, current: '我的/影视/1.png' });
    expect(events[1]).toMatchObject({ done: 2, total: 3, current: '我的/影视/2.mp4' });
    expect(events[2]).toMatchObject({ done: 3, total: 3, current: '我的/日记/a.md' });
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
});