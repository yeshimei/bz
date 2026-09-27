/**
 * 脸谱专属解锁屏测试（issue 482）：
 * - LOCK_KIND_META people 档：脸谱标题 / 副文案 / 动作 + 统计口径（联系人 / 随记录附件 / 附件密文）
 *   + `bz-lockscreen--people` 作用域类（朱砂皮在域 styles.css，结构类在此钉死）+ contact 印章图标；
 * - 冷启动统计回落 lock-stats.json 的 people 档上次快照（core/lock-stats 段级合并写）；
 * - 解锁期 captureLockStats 快照含 people 档（清单级计数，不解密正文；既有三档不受影响）；
 * - 脸谱面板门禁默认走 people 档：peopleUnlockGate → ensureSafeUnlocked('people')，
 *   真链（MockVault 上的共锁 SafeManager）弹出的是脸谱口径解锁屏，不再借 'vault' 文案。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { UIManager } from '../../src/encrypt/ui';
import { peopleUnlockGate } from '../../src/people/ui';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { readLockStats } from '../../src/core/lock-stats';

async function waitFor(cond: () => boolean | Promise<boolean>, timeout = 4000) {
  const start = Date.now();
  while (!(await cond())) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const CONFIG = { root: 'CONFIG/.ENCRYPT', previewEnabled: false, previewSize: 384, previewQuality: 0.5, autoLoadOriginal: false, securityMode: false };
const PW = 'people-test-pw';

function findLockMask(): HTMLElement | null {
  // 解锁屏（共享骨架）挂 body 全屏遮罩
  return [...document.querySelectorAll('div')].find((d) => d.classList.contains('bz-lockscreen--mask')) as HTMLElement | null;
}

/** 装配：MockVault + 设置Provider + 独立 UIManager（同 tests/encrypt 锁家族测试的范式） */
async function bootUi(): Promise<{ vault: MockVault; dm: SafeManager; ui: UIManager }> {
  const vault = new MockVault();
  setApp(mockAppWithVault(vault) as any);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  const dm = new SafeManager('CONFIG/.ENCRYPT');
  const ui = new UIManager(dm, CONFIG);
  ui.ensureElements();
  return { vault, dm, ui };
}

/** 清单落库（解锁一次即写入 .safe.enc），随后回到锁定态——解锁屏走「已上锁」文案 */
async function seedManifest(dm: SafeManager): Promise<void> {
  await dm.unlock(PW);
  dm.lock();
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('people 档解锁屏（LOCK_KIND_META，issue 482）', () => {
  it('脸谱文案与统计口径：标题 / 副文案 / 动作 / 联系人三卡 + 朱砂作用域类 + contact 印章', async () => {
    const { dm, ui } = await bootUi();
    await seedManifest(dm);
    const p = ui.showPasswordDialog('people');
    await waitFor(() => !!findLockMask());
    const mask = findLockMask()!;
    expect(mask.classList.contains('bz-lockscreen--people')).toBe(true);
    expect(mask.querySelector('[data-ls="title"]')!.textContent).toBe('脸谱已上锁');
    expect(mask.querySelector('[data-ls="sub"]')!.textContent).toContain('联系人卡片与聊天记录均以密文保存');
    expect(mask.querySelector('[data-ls="go"]')!.textContent).toBe('解锁');
    expect(mask.querySelector('.bz-lockscreen-seal-ic')!.getAttribute('data-icon')).toBe('contact');
    // 无快照时三卡回落「—」，口径即脸谱档
    const labels = [...mask.querySelectorAll('.bz-lockscreen-label')].map((n) => n.textContent);
    expect(labels).toEqual(['联系人', '随记录附件', '附件密文']);
    const nums = [...mask.querySelectorAll('.bz-lockscreen-num')].map((n) => n.textContent);
    expect(nums).toEqual(['—', '—', '—']);
    // 点遮罩取消收场
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(await p).toBe(false);
  });

  it('冷启动统计回落 lock-stats.json 的 people 档上次快照', async () => {
    const { vault, dm, ui } = await bootUi();
    await seedManifest(dm);
    await vault.create('CONFIG/STORAGE/lock-stats.json', JSON.stringify({
      people: [
        { num: '12', label: '联系人' },
        { num: '12', label: '随记录附件' },
        { num: '36.5 KB', label: '附件密文' },
      ],
    }));
    const p = ui.showPasswordDialog('people');
    await waitFor(() => !!findLockMask());
    const nums = [...findLockMask()!.querySelectorAll('.bz-lockscreen-num')].map((n) => n.textContent);
    expect(nums).toEqual(['12', '12', '36.5 KB']);
    findLockMask()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    void p;
  });
});

describe('解锁屏统计快照含 people 档（captureLockStats）', () => {
  it('解锁期快照写 people 档（清单级计数）；既有 vault / diary / password-vault 三档不受影响', async () => {
    const { dm, ui } = await bootUi();
    await dm.unlock(PW);
    // 脸谱保库记录一条（含头像附件）——与 safe-store 的 PEOPLE_KIND / 虚拟 path 同口径
    await dm.lockNote({
      path: 'CONFIG/STORAGE/people/大琳',
      title: '脸谱：大琳',
      kind: 'people',
      content: '{}',
      attachments: [{ path: 'CONFIG/STORAGE/people/大琳/avatar.jpg', kind: 'image', data: 'AAAA', keptShared: true }],
    });
    ui.show();
    await new Promise((r) => setTimeout(r, 60)); // 等 renderList 的共享锁载荷装载（同既有 encrypt 测试）
    (ui as any).captureLockStats();
    await waitFor(async () => Boolean(await readLockStats('people')));
    const people = (await readLockStats('people'))!;
    expect(people.map((s) => s.label)).toEqual(['联系人', '随记录附件', '附件密文']);
    expect(people[0].num).toBe('1'); // 一位联系人
    expect(people[1].num).toBe('1'); // 一个头像附件
    expect(await readLockStats('vault')).toBeTruthy();
    expect(await readLockStats('diary')).toBeTruthy();
    expect(await readLockStats('password-vault')).toBeTruthy();
  });
});

describe('脸谱面板门禁默认走 people 档（issue 482）', () => {
  it('peopleUnlockGate 真链弹出脸谱口径解锁屏（不再借 vault 文案）；遮罩取消放行 false', async () => {
    const { ui } = await bootUi();
    ui.stopSessionTimers();
    // 门禁真链的清单根 = encryptDir() = CONFIG/STORAGE/.ENCRYPT（与上面 bootUi 的 CONFIG/.ENCRYPT 故意不同根）
    const seed = new SafeManager('CONFIG/STORAGE/.ENCRYPT');
    await seed.unlock(PW);
    seed.lock();
    const gate = peopleUnlockGate();
    await waitFor(() => !!findLockMask());
    const mask = findLockMask()!;
    expect(mask.classList.contains('bz-lockscreen--people')).toBe(true);
    expect(mask.querySelector('[data-ls="title"]')!.textContent).toBe('脸谱已上锁');
    const labels = [...mask.querySelectorAll('.bz-lockscreen-label')].map((n) => n.textContent);
    expect(labels).toEqual(['联系人', '随记录附件', '附件密文']);
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(await gate).toBe(false);
  });
});
