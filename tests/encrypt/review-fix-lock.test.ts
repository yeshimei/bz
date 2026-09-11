// @vitest-environment node
/**
 * 锁家族修复批回归（review-all-bugs.md 三节 E 系 encrypt 数据侧 + D4 encrypt 侧）：
 * E4 首设写盘失败双通道回发解锁态、E12 清单解出 null/非对象走损坏分支、
 * E13 removeNote 与进行中 lockNote 经 opQueue 串行、E14 加密期间原文被编辑保留原文件、
 * D4 mergeDiaryBlock（经 restoreDiaryEntry）读改写与同路径队列任务互斥不互吞。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafeManager } from '../../src/encrypt/data';
import { CryptoService } from '../../src/core/crypto';
import { setApp } from '../../src/core/app';
import { enqueueFileTask } from '../../src/core/storage';
import { clearDomainEvents, onDomainEvent } from '../../src/core/domain-bus';
import { MockVault } from '../mock-vault';

function makeApp(vault: MockVault) {
  setApp({ vault, metadataCache: { trigger: vi.fn() } } as any);
}

describe('锁家族修复批（encrypt 数据层）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    clearDomainEvents();
  });

  it('E4：首设写盘失败 → 回滚解锁态并双通道回发 false（onUnlockChange + encrypt:unlock-changed）', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    const origWrite = vault.adapter.write.bind(vault.adapter);
    vault.adapter.write = async (p: string, c: string) => {
      if (p.endsWith('.safe.enc.tmp')) throw new Error('EACCES: disk full');
      return origWrite(p, c);
    };
    const events: boolean[] = [];
    sm.onUnlockChange = (u) => events.push(u);
    const off = onDomainEvent<{ unlocked: boolean }>('encrypt:unlock-changed', (e) => events.push(!!e?.unlocked));
    const ok = await sm.unlock('pw');
    off();
    expect(ok).toBe(false);
    expect(sm.unlocked).toBe(false);
    expect(sm.password).toBeNull();
    expect(events).toEqual([true, true, false, false]); // 双通道各先发 true（首设开始），失败回滚各补发 false
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc')).toBe(false);
  });

  it('E4 对照：首设写盘成功 → 单发 true，不发 false', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    const events: boolean[] = [];
    sm.onUnlockChange = (u) => events.push(u);
    expect(await sm.unlock('pw')).toBe(true);
    expect(events).toEqual([true]);
  });

  it('E12：清单密文解出 JSON null → manifestIssue=corrupt（不误判密码错误）；forceReset 可重设', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc', await CryptoService.encrypt('null', 'pw'));
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('pw')).toBe(false); // 此前对 null 赋值抛 TypeError 被当「密码错误」
    expect(sm2.manifestIssue).toBe('corrupt');
    // 密码错误路径不设 corrupt 标记（口径不串）
    expect(await sm2.unlock('wrong-pw')).toBe(false);
    expect(sm2.manifestIssue).toBeUndefined();
    expect(await sm2.unlock('pw', true)).toBe(true); // forceReset 重设为空清单
    expect(sm2.manifest.notes).toEqual([]);
  });

  it('E12：清单密文解出 JSON 数组（非对象）同样走 corrupt 分支', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc', await CryptoService.encrypt('[1,2]', 'pw'));
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('pw')).toBe(false);
    expect(sm2.manifestIssue).toBe('corrupt');
  });

  it('E13：removeNote 与进行中的 lockNote 经 opQueue 串行——lockNote 清单写全部完成后 removeNote 才落盘', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const prev = await sm.lockNote({ path: '我的/笔记/old.md', title: 'old', content: 'x', attachments: [] });

    // 记录清单写起止与其时内存清单内容（在 prev 落盘后装探针，事件流干净）。
    // lockNote 的 S2 清单写时 notes 含 old+new；removeNote 的清单写时 notes 只剩 new——
    // 以此区分每次 save 归属，断言 lock 的写在 remove 的写之前完整完成（opQueue 串行）。
    const events: Array<{ phase: string; titles: string[] }> = [];
    const origSave = sm.saveManifest.bind(sm);
    vi.spyOn(sm as any, 'saveManifest').mockImplementation(async (...a: any[]) => {
      events.push({ phase: 'start', titles: sm.manifest.notes.map((n) => n.title) });
      await origSave(...(a as []));
      events.push({ phase: 'end', titles: [] });
    });

    let releaseProgress!: () => void;
    const firstProgress = new Promise<void>((r) => (releaseProgress = r));
    const lockP = sm.lockNote(
      { path: '我的/笔记/new.md', title: 'new', content: 'y', attachments: [{ path: '我的/影视/p.png', data: 'AAA=' }] },
      () => releaseProgress()
    );
    await firstProgress; // lockNote 进行中（附件已入暂存，未到清单提交）
    const removeP = sm.removeNote(prev.id);
    await Promise.all([lockP, removeP]);

    // 串行不变量：第一次清单写是 lockNote 的（含 old+new），第二次是 removeNote 的（只剩 new）；
    // remove 发起于 lock 进行中，其清单写却晚于 lock 的清单写完整结束——证明排队而非交错
    expect(events.map((e) => e.phase)).toEqual(['start', 'end', 'start', 'end']);
    expect(events[0].titles).toEqual(['old', 'new']);
    expect(events[2].titles).toEqual(['new']);
    // 终态：new 在、old 无（并发不互踩）
    const ids = sm.manifest.notes.map((n) => n.id);
    expect(ids).not.toContain(prev.id);
    expect(ids.length).toBe(1);
  });

  it('E14：加密期间原文被编辑（删前重读不一致）→ 保留原文件并经 onSkippedStale 上报', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    vault.files.set('我的/笔记/a.md', '磁盘上的新内容（用户编辑）');
    const staleCb = vi.fn();
    const note = await sm.lockNote(
      { path: '我的/笔记/a.md', title: 'a', content: '加密时的旧内容', attachments: [] },
      undefined,
      undefined,
      staleCb
    );
    expect(staleCb).toHaveBeenCalledTimes(1);
    expect(staleCb).toHaveBeenCalledWith(['我的/笔记/a.md']);
    expect(vault.files.get('我的/笔记/a.md')).toBe('磁盘上的新内容（用户编辑）'); // 增量保留
    expect(await sm.decryptNoteBody(note)).toBe('加密时的旧内容'); // 密文为加密时快照
  });

  it('E14 对照：原文未被编辑 → 照常删除原文件，onSkippedStale 收到空列表', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    vault.files.set('我的/笔记/b.md', '一致的内容');
    const staleCb = vi.fn();
    const note = await sm.lockNote(
      { path: '我的/笔记/b.md', title: 'b', content: '一致的内容', attachments: [] },
      undefined,
      undefined,
      staleCb
    );
    expect(staleCb).toHaveBeenCalledWith([]);
    expect(vault.files.has('我的/笔记/b.md')).toBe(false);
    expect(sm.manifest.notes.some((n) => n.id === note.id)).toBe(true);
  });

  it('D4：mergeDiaryBlock（经 restoreDiaryEntry）读改写与同路径队列任务互斥——双方内容都落盘', async () => {
    makeApp(vault);
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/日记/2025-06-01.md',
      title: '2025-06-01',
      kind: 'diary-entry',
      content: '# 📝 08:00\n晨间记录。',
      attachments: [],
    });

    // 模拟 diary 写层慢任务先占住同路径队列（此前 mergeDiaryBlock 绕过队列，读旧写新互吞）
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const otherWrite = enqueueFileTask('我的/日记/2025-06-01.md', async () => {
      await gate; // 队列被占住：此期间还原若不排队就会读到空文件、写后被覆盖
      await vault.create('我的/日记/2025-06-01.md', '写层全量重写的当天内容');
    });

    const restoreP = sm.restoreDiaryEntry(note.id, '# 📝 08:00\n晨间记录。');
    release();
    const [ok] = await Promise.all([restoreP, otherWrite]);

    expect(ok).toBe(true);
    const final = vault.files.get('我的/日记/2025-06-01.md')!;
    expect(final).toContain('写层全量重写的当天内容'); // 写层内容未被还原覆盖
    expect(final).toContain('晨间记录。'); // 还原块未被写层抹掉
  });
});
