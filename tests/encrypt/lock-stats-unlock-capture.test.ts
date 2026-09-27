// @vitest-environment jsdom
/**
 * issue 492 续：解锁成功即快照落盘——people 档（482）数字不再依赖「经历一次上锁 / 走控制器
 * 卸载」，解锁那一刻 manifest 已在内存，立即写 lock-stats.json；下次解锁屏冷启动直接回落
 * 真实数字，不再恒「—」。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { UIManager } from '../../src/encrypt/ui';
import { readLockStats } from '../../src/core/lock-stats';
import { PeopleSafeStore } from '../../src/people/safe-store';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';

async function waitFor(cond: () => boolean, timeout = 4000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const CONFIG = { root: 'CONFIG/.ENCRYPT', previewEnabled: false, previewSize: 384, previewQuality: 0.5, autoLoadOriginal: false, securityMode: false };
const PW = '492-pw-test';

function findDialog(): HTMLElement | null {
  return [...document.querySelectorAll('div')].find((d) => d.classList.contains('bz-lockscreen--mask')) as HTMLElement | null;
}

describe('解锁成功即快照落盘（issue 492 续）', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(() => {
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ ...CONFIG }) as any);
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG as never);
    ui.ensureElements();
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup'].forEach((id) => document.getElementById(id)?.remove());
    document.querySelectorAll('.bz-lockscreen--mask').forEach((n) => n.remove());
    ui.stopSessionTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('解锁成功后 people 档快照写入 lock-stats.json（联系人数 = 1）', async () => {
    // 首设 + 建一条 people 记录（带头像附件，附件密文列有值）
    await dm.unlock(PW);
    const safe = new PeopleSafeStore(dm);
    await safe.write('wxid_a', (rec) => {
      rec.person = { id: 'wxid_a', name: '阿琳', createdAt: '2026-09-27T00:00:00.000Z', imports: [] };
    }, { avatar: { base64: 'aGk=', ext: 'jpg' } });
    await dm.lock();

    // 解锁屏 → 输密码 → 解锁成功
    const p = ui.showPasswordDialog('people');
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    const input = dialog.querySelector('input[type="password"]') as HTMLInputElement;
    input.value = PW;
    (dialog.querySelector('.bz-lockscreen-action') as HTMLElement).click();
    await waitFor(() => dm.unlocked);
    void p;

    // 快照已写盘：people 档可冷启动回落
    const stats = await readLockStats('people');
    expect(stats).not.toBeNull();
    expect(stats![0]).toEqual({ num: '1', label: '联系人' });
    expect(stats![1]?.num).toBe('1'); // 随记录附件（头像）
  });
});
