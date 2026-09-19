// @vitest-environment node
/**
 * encrypt 域深审批 A（数据层）修复回归：
 * ①restoreDiaryEntry 收尾调序后清单落盘失败可重试收敛（同 restoreNoteSerial，深审新-1）；
 * ②restoreDiaryEntry 入 opQueue（E13 收编补漏，深审新-2）；
 * ③selfHeal 前置于解锁广播之前且入 opQueue（深审新-4）；
 * ④resolveHealth 孤儿清理形态防御：.safe.enc 本体与越界相对段不得删（深审新-5）；
 * ⑤updateNotePayload 镜像覆盖路径跳过冗余整库清单重写、显式广播补真 noteId（深审新-6）；
 * ⑥SafeManager.lock 幂等短路：已锁再锁不重复广播（深审新-7）；
 * ⑦还原回日记按当前日记目录实时重算落点（两域同规则，深审新-4/func 侧对偶）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SafeManager,
  ENCRYPT_CHANGED_CHANNEL,
  ENCRYPT_UNLOCK_CHANGED_CHANNEL,
} from '../../src/encrypt/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { clearDomainEvents, onDomainEvent } from '../../src/core/domain-bus';
import { MockVault } from '../mock-vault';

function makeApp(vault: MockVault) {
  setApp({ vault, metadataCache: { trigger: () => {} } } as any);
}

/** 简便加锁一篇日记条目（diary-entry，无附件） */
function lockDiary(sm: SafeManager, path: string, content: string) {
  return sm.lockNote({
    path,
    title: '日记条目',
    kind: 'diary-entry',
    content,
    attachments: [],
  });
}

describe('encrypt 数据层深审批 A 回归', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    makeApp(vault);
    clearDomainEvents();
    setSettingsProvider(() => ({}) as any); // 未注入态（回退默认日记目录），防跨文件泄漏
  });

  it('①restoreDiaryEntry 清单落盘失败：块已 merge、镜像俱在、如实返回 false；重解锁重试幂等收敛 true', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockDiary(sm, '我的/日记/2506010900.md', '# 日记/加密 09:00\n上午写');
    const spy = vi.spyOn(sm, 'saveManifest').mockRejectedValue(new Error('disk error'));
    const ok1 = await sm.restoreDiaryEntry(note.id, '# 日记 09:00\n上午写');
    spy.mockRestore();
    expect(ok1).toBe(false);
    // 块已 merge 落盘、镜像俱在（收尾调序：落盘失败时镜像不删，重试可收敛）
    expect(vault.files.get('我的/日记/2506010900.md')).toContain('上午写');
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.contentRef)).toBe(true);
    // 下次解锁（磁盘清单仍含条目）后重试：merge 幂等跳过 + 收尾收敛 removed（true）
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('pw')).toBe(true);
    expect(await sm2.restoreDiaryEntry(note.id, '# 日记 09:00\n上午写')).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.contentRef)).toBe(false);
    sm2.lock();
    const sm3 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm3.unlock('pw')).toBe(true);
    expect(sm3.manifest.notes.length).toBe(0); // 收敛已固化
  });

  it('②restoreDiaryEntry 入 opQueue：lockNote 进行中发起的还原排队在后，清单写严格串行不交错', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const prev = await lockDiary(sm, '我的/日记/2506010800.md', '# 日记/加密 08:00\n旧块');

    // 清单写探针（prev 落盘后装，事件流干净）：记录每次清单写时的内存清单标题序
    const events: string[] = [];
    const origSave = sm.saveManifest.bind(sm);
    vi.spyOn(sm as any, 'saveManifest').mockImplementation(async (...a: any[]) => {
      events.push('save[' + sm.manifest.notes.map((n) => n.title).join('|') + ']');
      await origSave(...(a as []));
      events.push('saved');
    });

    let releaseProgress!: () => void;
    const firstProgress = new Promise<void>((r) => (releaseProgress = r));
    const lockP = sm.lockNote(
      {
        path: '我的/日记/2506010900.md',
        title: '新日记',
        kind: 'diary-entry',
        content: '# 日记/加密 09:00\n新块',
        attachments: [{ path: '我的/p.png', data: 'AAA=' }],
      },
      () => releaseProgress()
    );
    await firstProgress; // lockNote 进行中（附件加密期，未到清单提交）
    const restoreP = sm.restoreDiaryEntry(prev.id, '# 日记 08:00\n旧块');
    await Promise.all([lockP, restoreP]);

    // 串行不变量：lockNote 的清单写（旧+新）先完整结束，restoreDiaryEntry 的清单写（只剩新）在后
    expect(events).toEqual(['save[日记条目|新日记]', 'saved', 'save[新日记]', 'saved']);
    // 双方意图均完整：lockNote 新条目在、还原条目已取出、块 merge 成功
    expect(sm.manifest.notes.map((n) => n.title)).toEqual(['新日记']);
    expect(vault.files.get('我的/日记/2506010800.md')).toContain('旧块');
  });

  it('③挂起现场解锁：自愈先于解锁广播完成（selfHealRolledBack 就绪），后续操作经 opQueue 拿到自愈后清单', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/笔记/a.md',
      title: 'a',
      content: '# 半提交',
      attachments: [],
    });
    // 制造半提交现场：清单已提交 + 挂起标记残留
    vault.files.set('CONFIG/.ENCRYPT/.staging/pending.json', JSON.stringify([note.id]));
    sm.lock();

    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    const order: string[] = [];
    const realHeal = sm2.selfHeal.bind(sm2);
    const spyHeal = vi.spyOn(sm2, 'selfHeal').mockImplementation(async () => {
      order.push('heal-start');
      const r = await realHeal();
      order.push('heal-end');
      return r;
    });
    let subscriberOp: Promise<void> | null = null;
    sm2.onUnlockChange = (u) => {
      if (!u) return;
      order.push('broadcast');
      // 模拟订阅方（密码本/日记域）收到解锁事件即刻发起的 opQueue 操作：
      // 必须拿到自愈后的清单（挂起条目已回滚），而非与自愈并发互踩
      subscriberOp = (sm2 as any).enqueueOp(async () => {
        order.push('op-run:notes=' + sm2.manifest.notes.length);
      });
    };
    expect(await sm2.unlock('pw')).toBe(true);
    await subscriberOp;
    spyHeal.mockRestore();
    // 自愈完整收尾 → 才广播解锁 → 订阅方操作串行在后且看到回滚后的空清单
    expect(order).toEqual(['heal-start', 'heal-end', 'broadcast', 'op-run:notes=0']);
    expect(sm2.selfHealRolledBack).toBe(1); // 计数就绪于广播前，订阅方首读即正确
    expect(sm2.manifest.notes.length).toBe(0);
    expect(vault.files.has('CONFIG/.ENCRYPT/' + note.contentRef)).toBe(false);
    expect(vault.files.has('CONFIG/.ENCRYPT/.staging/pending.json')).toBe(false);
  });

  it('④resolveHealth 孤儿清理形态防御：.safe.enc 本体与越界相对段 key 不得删；扫描侧同样不报本体', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: '我的/笔记/a.md',
      title: 'a',
      content: '# A',
      attachments: [],
    });
    vault.files.set('CONFIG/.ENCRYPT/.junk.enc', 'junk');
    // 扫描侧：清单本体不入孤儿报告（形态判定单源）
    const report = await sm.scanHealth();
    expect(report.items.some((i) => i.key === 'file:.safe.enc')).toBe(false);
    expect(report.items.some((i) => i.key === 'file:.junk.enc')).toBe(true);
    // 清理侧：上游 key 回归（本体 + 越界相对段）→ 形态防御拦下，绝不删整库唯一清单
    const { files } = await sm.resolveHealth(['file:.safe.enc', 'file:../x.enc', 'file:.junk.enc', 'file:.enc']);
    expect(files).toBe(1); // 只有 .junk.enc 被清
    expect(vault.files.get('CONFIG/.ENCRYPT/.junk.enc')).toBeUndefined();
    expect(vault.files.get('CONFIG/.ENCRYPT/.safe.enc')).toBeTruthy();
    expect(vault.files.get('CONFIG/.ENCRYPT/' + note.contentRef)).toBeTruthy();
    // 清单无损：重开解锁成功
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('pw')).toBe(true);
    expect(sm2.manifest.notes.length).toBe(1);
  });

  it('⑤updateNotePayload 镜像覆盖路径：跳过整库清单重写（.safe.enc 密文不变）但显式广播补真 noteId', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await sm.lockNote({
      path: 'CONFIG/.ENCRYPT/passwords',
      title: '密码本',
      kind: 'password-vault',
      content: '[]',
      attachments: [],
    });
    const manifestBefore = vault.files.get('CONFIG/.ENCRYPT/.safe.enc');
    const seen: Array<{ noteId: string | null }> = [];
    const off = onDomainEvent<{ noteId: string | null }>(ENCRYPT_CHANGED_CHANNEL, (e) => seen.push(e));
    await sm.updateNotePayload(note.id, '[{"id":"pw-1"}]');
    off();
    // 清单零变化：无整库重加密写盘（密文逐字节不变——旧实现每存一条全量重写一次）
    expect(vault.files.get('CONFIG/.ENCRYPT/.safe.enc')).toBe(manifestBefore);
    // 广播不缺位：同频道同事件，noteId 语义补真（订阅方不再盲比对）
    expect(seen).toEqual([{ noteId: note.id }]);
    // 镜像已原子换入新载荷：原地可读，重开（清单未重写）仍可读
    expect(await sm.decryptNoteBody(sm.manifest.notes[0])).toBe('[{"id":"pw-1"}]');
    sm.lock();
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('pw')).toBe(true);
    expect(await sm2.decryptNoteBody(sm2.manifest.notes[0])).toBe('[{"id":"pw-1"}]');
  });

  it('⑤对照：新分配 contentRef（清单结构变化）仍落盘且广播不缺位', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    // 手工构造无 contentRef 的防御分支条目并固化
    sm.manifest.notes.push({
      id: 'enc-ghost',
      path: 'x.md',
      title: 'ghost',
      createdAt: '2026-01-01T00:00:00.000Z',
      contentRef: '',
      attachments: [],
    });
    await sm.saveManifest();
    const manifestBefore = vault.files.get('CONFIG/.ENCRYPT/.safe.enc');
    const seen: Array<{ noteId: string | null }> = [];
    const off = onDomainEvent<{ noteId: string | null }>(ENCRYPT_CHANGED_CHANNEL, (e) => seen.push(e));
    await sm.updateNotePayload('enc-ghost', '首次载荷');
    off();
    // 清单结构变化（新分配 contentRef）→ 落盘（密文已变）
    expect(vault.files.get('CONFIG/.ENCRYPT/.safe.enc')).not.toBe(manifestBefore);
    expect(sm.manifest.notes[0].contentRef.startsWith('.')).toBe(true);
    expect(seen.length).toBeGreaterThanOrEqual(1); // saveManifest 尾部自带 changed 广播
    expect(await sm.decryptNoteBody(sm.manifest.notes[0])).toBe('首次载荷');
  });

  it('⑥lock 幂等短路：已锁再锁不重复广播（回调与域事件各只一轮）', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const cb: boolean[] = [];
    sm.onUnlockChange = (u) => cb.push(u);
    const domainEvents: boolean[] = [];
    const off = onDomainEvent<{ unlocked: boolean }>(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (e) =>
      domainEvents.push(!!e?.unlocked)
    );
    sm.lock();
    sm.lock(); // 已锁再锁：短路
    sm.lock();
    off();
    expect(cb).toEqual([false]);
    expect(domainEvents).toEqual([false]);
    expect(sm.unlocked).toBe(false);
    expect(sm.password).toBeNull();
    // 短路不影响后续重新解锁
    expect(await sm.unlock('pw')).toBe(true);
    sm.lock();
    expect(cb).toEqual([false, true, false]); // 解锁/再锁正常广播
  });

  it('⑦还原回日记按当前日记目录实时重算落点：改目录设置后还原落新目录（basename 保留）', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockDiary(sm, '我的/日记/2506010900.md', '# 日记/加密 09:00\n上午写');
    // 用户改了日记目录设置
    setSettingsProvider(() => ({ diaryDirectory: '日记2' }) as any);
    try {
      const ok = await sm.restoreDiaryEntry(note.id, '# 日记 09:00\n上午写');
      expect(ok).toBe(true);
      // 落新目录（basename 保留、frontmatter 重建），旧目录无残留
      const md = vault.files.get('日记2/2506010900.md')!;
      expect(md).toContain('上午写');
      expect(md).toContain('date: 2025-06-01 09:00');
      expect(vault.files.has('我的/日记/2506010900.md')).toBe(false);
      // 重算随收尾清单落盘：重开无该条目（取出即删，path 不悬挂旧目录）
      sm.lock();
      const sm2 = new SafeManager('CONFIG/.ENCRYPT');
      expect(await sm2.unlock('pw')).toBe(true);
      expect(sm2.manifest.notes.length).toBe(0);
    } finally {
      setSettingsProvider(() => ({}) as any);
    }
  });

  it('⑦对照：basename 非条目形状（旧日期文件历史清单）保持原路径不动，由 merge legacy 兜底换算', async () => {
    const sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
    const note = await lockDiary(sm, '我的/日记/2025-06-01.md', '# 日记/加密 09:00\n旧名目');
    setSettingsProvider(() => ({ diaryDirectory: '日记2' }) as any);
    try {
      const ok = await sm.restoreDiaryEntry(note.id, '# 日记 09:00\n旧名目');
      expect(ok).toBe(true);
      // 非条目形状不改目录段：在旧目录内按 legacy 规则换算条目文件名（YYMMDDHHmm）落盘
      expect(vault.files.has('我的/日记/2506010900.md')).toBe(true);
      expect(vault.files.get('我的/日记/2506010900.md')).toContain('旧名目');
      expect([...vault.files.keys()].some((p) => p.startsWith('日记2/'))).toBe(false);
    } finally {
      setSettingsProvider(() => ({}) as any);
    }
  });
});
