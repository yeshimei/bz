// @vitest-environment node
/**
 * encrypt 域 D2 可靠写契约回归（试点域写路径迁移）。
 * 收编面说明：保险库数据为点前缀加密文件（vault API 不可见，jsonFileStore 不适用），
 * 收编对象是 core enqueueFileTask 队列原语本身——清单 .safe.enc 写（三段式 rename）与
 * 暂存区 pending.json 读改写统一入 per-path 串行队列。
 * ①并发写不互踩——removeNote/updateNotePayload（此前不经 opQueue 串行）与任意清单写
 *   并发时不再交错三段式 rename，终态一致且无 .tmp/.bak 残留；
 * ②坏 json 降级可用——pending.json 损坏 → 解析降级为空，解锁自愈不误伤清单，域功能可用。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SafeManager } from '../../src/encrypt/data';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

const ROOT = 'CONFIG/.ENCRYPT';

function makeApp(vault: MockVault) {
  setApp({ vault, metadataCache: { trigger: () => {} } } as any);
}

const lockInput = (path: string, title: string, content: string) => ({
  path, title, content, attachments: [],
});

describe('SafeManager D2 可靠写契约', () => {
  let vault: MockVault;
  let sm: SafeManager;

  beforeEach(async () => {
    vault = new MockVault();
    makeApp(vault);
    sm = new SafeManager();
    expect(await sm.unlock('pw-测试')).toBe(true); // 首设空清单
  });

  it('①并发清单写（removeNote × updateNotePayload）串行落盘：终态一致、无 tmp/bak 残留', async () => {
    const n1 = await sm.lockNote(lockInput('我的/日记/d1.md', 'd1', '正文一'));
    const n2 = await sm.lockNote(lockInput('我的/日记/d2.md', 'd2', '正文二'));
    await Promise.all([
      sm.removeNote(n1.id),
      sm.updateNotePayload(n2.id, '更新后的密码表载荷'),
    ]);
    // 全新实例重新解锁：落盘清单 = 双方改动都生效的终态（n1 移除 + n2 载荷更新）
    const fresh = new SafeManager();
    expect(await fresh.unlock('pw-测试')).toBe(true);
    expect(fresh.manifest.notes).toHaveLength(1);
    expect(fresh.manifest.notes[0].id).toBe(n2.id);
    expect(await fresh.decryptNoteBody(fresh.manifest.notes[0])).toBe('更新后的密码表载荷');
    // 三段式 rename 无交错残留
    expect(vault.files.has(ROOT + '/.safe.enc.tmp')).toBe(false);
    expect(vault.files.has(ROOT + '/.safe.enc.bak')).toBe(false);
  });

  it('②pending.json 损坏 → 解析降级为空，解锁自愈不误伤清单，域功能可用', async () => {
    await sm.lockNote(lockInput('我的/日记/d1.md', 'd1', '正文一'));
    // 模拟中断/同步冲突留下的半截挂起标记
    vault.files.set(ROOT + '/.staging/pending.json', '[{"half":');
    const fresh = new SafeManager();
    expect(await fresh.unlock('pw-测试')).toBe(true); // 解锁含自愈，坏标记降级为空不抛
    expect(fresh.manifest.notes).toHaveLength(1); // 清单不被坏标记误伤
    expect(await fresh.decryptNoteBody(fresh.manifest.notes[0])).toBe('正文一');
    // 降级后域功能可用：继续加锁新笔记
    await fresh.lockNote(lockInput('我的/日记/d2.md', 'd2', '正文二'));
    const again = new SafeManager();
    expect(await again.unlock('pw-测试')).toBe(true);
    expect(again.manifest.notes).toHaveLength(2);
  });
});
