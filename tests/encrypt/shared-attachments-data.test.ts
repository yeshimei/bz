// @vitest-environment node
/**
 * 共享附件他引保护数据层测试（issue 338）：
 * keptShared 标记随清单记账、加密跳过删共享原件、还原取出跳过共享附件明文写回
 * （防覆盖保留的原件）、非共享附件既有语义回归、还原冲突兜底不被共享跳过掩盖。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SafeManager } from '../../src/encrypt/data';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

function makeApp(vault: MockVault) {
  setApp({ vault, metadataCache: { trigger: () => {} } } as any);
}

const IMG_B64 = 'QUJDREVGRw=='; // base64('ABCDEFG')

describe('SafeManager 共享附件他引保护（issue 338）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
  });

  it('lockNote keptShared：共享附件原件保留（他篇嵌入不断链），密文照常入库且 manifest 记标记', async () => {
    makeApp(vault);
    vault.create('我的/日记/2025-06-01.md', '# 日记\n![[pic.png]]');
    // 他篇笔记嵌入同一张图（原件被共享）
    vault.create('笔记/其他.md', '他篇正文\n![[pic.png]]');
    vault.createBinary('我的/影视/pic.png', new TextEncoder().encode('ABCDEFG').buffer);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');

    const note = await sm.lockNote({
      path: '我的/日记/2025-06-01.md',
      title: '2025-06-01',
      content: '# 日记\n![[pic.png]]',
      attachments: [{ path: '我的/影视/pic.png', data: IMG_B64, previewData: 'PREVIEW', keptShared: true }],
    });

    // 原件保留（非共享语义此处会删除）
    expect(vault.binaryFiles.has('我的/影视/pic.png')).toBe(true);
    // 他篇笔记完好，嵌入目标仍在（不断链）
    expect(vault.files.get('笔记/其他.md')).toBe('他篇正文\n![[pic.png]]');
    // 密文侧照常加密入库（原始层 + 预览层）
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.attachments[0].blobRef)).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.attachments[0].previewRef)).toBe(true);
    // manifest 记共享标记
    expect(note.attachments[0].keptShared).toBe(true);
  });

  it('非共享回归：原件照删、清单不带 keptShared 标记（既有语义一字不变）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/笔记/a.md',
      title: 'a',
      content: '# A',
      attachments: [{ path: '我的/影视/only.png', data: IMG_B64 }],
    });
    expect(note.attachments[0].keptShared).toBeUndefined();
    expect(vault.binaryFiles.has('我的/影视/only.png')).toBe(false);
    // 原笔记照常移出
    expect(vault.files.has('我的/笔记/a.md')).toBe(false);
  });

  it('restoreNote keptShared：跳过该附件写回（用户改过原件也不覆盖/不冲突），其余照常还原且镜像清理', async () => {
    makeApp(vault);
    vault.createBinary('我的/影视/pic.png', new TextEncoder().encode('ABCDEFG').buffer);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/笔记/a.md',
      title: 'a',
      content: '# 还原我',
      attachments: [
        // 共享附件（原件保留在原路径）+ 非共享附件（加密时原件已删）
        { path: '我的/影视/pic.png', data: IMG_B64, previewData: 'PREVIEW', keptShared: true },
        { path: '我的/影视/solo.png', data: IMG_B64 },
      ],
    });
    const blobRef = note.attachments[0].blobRef;
    const prevRef = note.attachments[0].previewRef;
    // 加密后共享原件被用户改动（模拟他篇使用者换图）——还原绝不覆盖
    vault.binaryFiles.set('我的/影视/pic.png', new TextEncoder().encode('NEWIMAGE'));

    const { conflicts, removed } = await sm.restoreNote(note.id);
    expect(conflicts).toEqual([]);
    expect(removed).toBe(true);
    // 共享原件保持用户改动后的内容（未被密文写回覆盖；若无跳过，此处会因指纹不符判冲突整体失败）
    const cur = await vault.readBinary(vault.file('我的/影视/pic.png'));
    expect(new TextDecoder().decode(cur)).toBe('NEWIMAGE');
    // 非共享附件照常写回明文
    const solo = await vault.readBinary(vault.file('我的/影视/solo.png'));
    expect(new TextDecoder().decode(solo)).toBe('ABCDEFG');
    // 正文照常还原
    expect(vault.files.get('我的/笔记/a.md')).toContain('# 还原我');
    // 取出即删：共享附件的密文镜像照常清理（不产生孤儿），条目移除
    expect(vault.files.get('CONFIG/.ENCRYPT/' + blobRef)).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/' + prevRef)).toBeUndefined();
    expect(sm.manifest.notes.find((n) => n.id === note.id)).toBeUndefined();
  });

  it('还原冲突兜底保持：共享附件跳过不掩盖正文占用冲突（整体不落盘、条目保留）', async () => {
    makeApp(vault);
    vault.createBinary('我的/影视/pic.png', new TextEncoder().encode('ABCDEFG').buffer);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/笔记/a.md',
      title: 'a',
      content: '# A',
      attachments: [{ path: '我的/影视/pic.png', data: IMG_B64, keptShared: true }],
    });
    // 用户在原路径新建了不同内容的同名笔记（:1193-1196 占用冲突路径）
    vault.create('我的/笔记/a.md', '# 用户的笔记');
    const { conflicts, removed } = await sm.restoreNote(note.id);
    expect(conflicts).toContain('我的/笔记/a.md');
    expect(removed).toBe(false);
    // 不覆盖用户文件；条目仍在清单（安全第一语义不变）
    expect(vault.files.get('我的/笔记/a.md')).toBe('# 用户的笔记');
    expect(sm.manifest.notes.find((n) => n.id === note.id)).toBeTruthy();
    // 共享原件仍未被触碰
    const cur = await vault.readBinary(vault.file('我的/影视/pic.png'));
    expect(new TextDecoder().decode(cur)).toBe('ABCDEFG');
  });

  it('restoreDiaryEntry keptShared：日记降级路径同语义（共享附件跳过写回，块 merge 照常）', async () => {
    makeApp(vault);
    vault.createBinary('我的/影视/pic.png', new TextEncoder().encode('ABCDEFG').buffer);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const target = '我的/日记/2506010800.md'; // v3 题目：YYMMDDHHmm
    const note = await sm.lockNote({
      path: target,
      title: '2025-06-01 · 08:00 日记',
      kind: 'diary-entry',
      content: '# 日记/加密 08:00\n晨间记录。![[pic.png]]',
      attachments: [{ path: '我的/影视/pic.png', data: IMG_B64, keptShared: true }],
    });
    // 加密后共享原件被改动——降级还原不得覆盖
    vault.binaryFiles.set('我的/影视/pic.png', new TextEncoder().encode('USEREDIT'));

    const ok = await sm.restoreDiaryEntry(note.id, '# 日记 08:00\n晨间记录。![[pic.png]]');
    expect(ok).toBe(true);
    // 块 merge 回原 md
    expect(vault.files.get(target)).toContain('晨间记录。');
    // 共享原件保持用户改动（跳过写回）
    const cur = await vault.readBinary(vault.file('我的/影视/pic.png'));
    expect(new TextDecoder().decode(cur)).toBe('USEREDIT');
    // 条目取出
    expect(sm.manifest.notes.find((n) => n.id === note.id)).toBeUndefined();
  });
});
