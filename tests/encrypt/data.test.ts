// @vitest-environment node
/**
 * 加密保险箱数据层测试：SafeManager 加锁/还原/收回 状态机、
 * 清单加密存储、附件二进制镜像、指纹冲突安全、崩溃幂等。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafeManager, fingerprintOf, mirrorRef, previewMirrorRef } from '../../src/encrypt/data';
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

  it('镜像路径：原路径 → 附件/<原路径>，预览 → 附件/_预览/<原路径>', () => {
    expect(mirrorRef('我的/影视/x.png')).toBe('附件/我的/影视/x.png');
    expect(previewMirrorRef('我的/影视/x.png')).toBe('附件/_预览/我的/影视/x.png');
  });

  it('首次 unlock：创建 safe.enc（密文非明文 JSON），清单为空', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/ENCRYPT');
    const ok = await sm.unlock('master123');
    expect(ok).toBe(true);
    expect(sm.unlocked).toBe(true);
    expect(vault.files.has('CONFIG/ENCRYPT/safe.enc')).toBe(true);
    const content = vault.files.get('CONFIG/ENCRYPT/safe.enc')!;
    expect(content.startsWith('{')).toBe(false);
    expect(content).not.toContain('master123');
    expect(sm.manifest.notes.length).toBe(0);
  });

  it('二次解锁：正确密码成功、错误密码失败', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/ENCRYPT');
    await sm.unlock('pw');
    sm.lock();
    const sm2 = new SafeManager('CONFIG/ENCRYPT');
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

  it('lockNote：正文+附件移入保险箱，原文件删除，密文镜像落盘', async () => {
    makeApp(vault);
    vault.create('我的/日记/2025-06-01.md', '# 日记');
    vault.createBinary('我的/影视/pic.png', new TextEncoder().encode('IMGDATAIMG').buffer);
    const sm = new SafeManager('CONFIG/ENCRYPT');
    await sm.unlock('pw');

    const note = await lockSample(sm, { content: '# 日记' });
    expect(note.attachments.length).toBe(1);
    // 原笔记与附件已移出
    expect(vault.files.has('我的/日记/2025-06-01.md')).toBe(false);
    expect(vault.binaryFiles.has('我的/影视/pic.png')).toBe(false);
    // 密文镜像已生成（原始层 + 预览层）
    const mirrorPath = 'CONFIG/ENCRYPT/' + mirrorRef('我的/影视/pic.png');
    const prevPath = 'CONFIG/ENCRYPT/' + previewMirrorRef('我的/影视/pic.png');
    expect(vault.files.has(mirrorPath)).toBe(true);
    expect(vault.files.has(prevPath)).toBe(true);
    // 密文非明文
    expect(vault.files.get(mirrorPath)!).not.toContain('IMGDATAIMG');
    expect(note.hasSummary).toBe(false);
    expect(note.attachments[0].hasPreview).toBe(true);
  });

  it('lockNote 解锁后可从清单解密出正文（解密内容==原文）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/ENCRYPT');
    await sm.unlock('pw');
    await lockSample(sm);
    // 重开解锁读取
    sm.lock();
    const sm2 = new SafeManager('CONFIG/ENCRYPT');
    await sm2.unlock('pw');
    expect(sm2.manifest.notes.length).toBe(1);
    const plain = await sm2.decryptText(sm2.manifest.notes[0].content);
    expect(plain).toContain('今天写日记');
  });

  it('加锁附件无预览时 hasPreview=false 且无预览镜像', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, { attachments: [{ path: '我的/x.png', data: 'REFLhUlG' }] });
    expect(note.attachments[0].hasPreview).toBe(false);
    expect(vault.files.has('CONFIG/ENCRYPT/' + previewMirrorRef('我的/x.png'))).toBe(false);
  });
});

describe('SafeManager 真还原', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('restoreNote：原文与附件写回原路径（二进制），标记 restored，metadataCache 触发', async () => {
    const trigger = makeApp(vault);
    const sm = new SafeManager('CONFIG/ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, {
      content: '# 待还原',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'PREVIEW' }],
    });

    const { note: restored, conflicts } = await sm.restoreNote(note.id);
    expect(conflicts).toEqual([]);
    expect(restored.restored).toBe(true);
    // 正文写回
    expect(vault.files.get('我的/日记/2025-06-01.md')).toContain('# 待还原');
    // 附件二进制写回
    const bytes = await vault.readBinary(vault.file('我的/影视/pic.png'));
    expect(new TextDecoder().decode(bytes)).toBe('ABCDEFG');
    // metadataCache 触发（正文 + 附件各一次）
    expect(trigger.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('restoreNote 冲突：目标笔记被用户新建同名占用 → 跳过不盖并报冲突', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, { content: '# A' });
    // 用户新建同名笔记
    vault.create('我的/日记/2025-06-01.md', '# 用户的笔记');
    const { conflicts } = await sm.restoreNote(note.id);
    expect(conflicts).toContain('我的/日记/2025-06-01.md');
    // 不覆盖用户文件
    expect(vault.files.get('我的/日记/2025-06-01.md')).toBe('# 用户的笔记');
  });

  it('collectNote：把已还原笔记重新加锁，删除明文，标记 restored=false', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/ENCRYPT');
    await sm.unlock('pw');
    const note = await lockSample(sm, {
      content: '# 收回',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==' }],
    });
    await sm.restoreNote(note.id);
    // 现在明文在 vault
    expect(vault.files.has('我的/日记/2025-06-01.md')).toBe(true);
    await sm.collectNote(note.id);
    // 重新入库，明文消失
    expect(vault.files.has('我的/日记/2025-06-01.md')).toBe(false);
    expect(vault.binaryFiles.has('我的/影视/pic.png')).toBe(false);
    const n = sm.manifest.notes.find((x) => x.id === note.id)!;
    expect(n.restored).toBe(false);
    expect(n.attachments[0].restored).toBe(false);
  });
});

describe('SafeManager 未解锁拦截', () => {
  it('未解锁 lockNote/restoreNote/collectNote/saveManifest 抛「未解锁」', async () => {
    const vault = new MockVault();
    makeApp(vault);
    const sm = new SafeManager('CONFIG/ENCRYPT');
    await expect(sm.saveManifest()).rejects.toThrow('未解锁');
    await expect(lockSample(sm)).rejects.toThrow('未解锁');
    await expect(sm.restoreNote('x')).rejects.toThrow('未解锁');
  });
});