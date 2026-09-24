/**
 * 2026-09-24 两需求回归（首页右键「快速生成密码」+ 添加弹窗关闭二次确认）：
 * 1) 待存状态（data 层）：set/consume 消费即清、TTL 过期不吐值；
 * 2) quickGeneratePassword 命令：复制成功 → 记待存 + success 通知；复制失败 → 不记状态；
 * 3) 解锁成功消费：锁屏解锁 → 自动弹添加窗并预填待存密码（一次性，二次解锁不再弹）；
 * 4) 关闭守卫：没动过手直关不烦人；有未保存改动 → 域皮流程框确认，「继续编辑」留弹窗、
 *    「放弃修改」才真关；保存成功走 force 直关不问；
 * 5) preset.password 预填：预填值原样进密码框，不重新生成。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { unloadEncrypt } from '../../src/encrypt';
import { PasswordVaultUIManager } from '../../src/password-vault/ui';
import {
  PasswordVaultDataManager,
  setPendingQuickPassword,
  consumePendingQuickPassword,
  clearPendingQuickPassword,
} from '../../src/password-vault/data';
import { quickGeneratePassword, unloadPasswordVault } from '../../src/password-vault/index';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { cancelClipboardClear } from '../../src/core/utils';

function stubClipboard(ok: boolean): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: ok ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error('denied')),
    },
  });
}

describe('快速生成密码·待存状态（data 层）', () => {
  beforeEach(() => clearPendingQuickPassword());
  afterEach(() => clearPendingQuickPassword());

  it('set → consume 返回明文且消费即清（一次性）', () => {
    setPendingQuickPassword('Abc123');
    expect(consumePendingQuickPassword()).toBe('Abc123');
    expect(consumePendingQuickPassword()).toBeNull();
  });

  it('未记录 → consume 返回 null', () => {
    expect(consumePendingQuickPassword()).toBeNull();
  });

  it('TTL 过期 → consume 返回 null 且槽位已清', () => {
    vi.useFakeTimers();
    try {
      setPendingQuickPassword('oldpw');
      vi.advanceTimersByTime(11 * 60 * 1000); // TTL 10 分钟，前进 11 分钟
      expect(consumePendingQuickPassword()).toBeNull();
      // 再记新的照常可用（过期消费已清槽位，不残留旧时间戳）
      setPendingQuickPassword('newpw');
      expect(consumePendingQuickPassword()).toBe('newpw');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('quickGeneratePassword 命令（index 层）', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    localStorage.clear();
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ passwordCharset: '', passwordLength: '16', securityMode: false }) as any);
    clearPendingQuickPassword();
  });

  afterEach(() => {
    cancelClipboardClear(); // 成功分支布防的 60s 剪贴板清空定时器，别带进下一个用例
    unloadPasswordVault();
    unloadEncrypt();
    document.body.innerHTML = '';
  });

  it('复制成功 → 记待存状态 + success 通知（不解锁不开面板）', async () => {
    stubClipboard(true);
    await quickGeneratePassword(getApp());
    expect(hasNotice('已生成并复制密码，60 秒后自动清空；解锁密码本时将自动弹出录入窗')).toBe(true);
    const pw = consumePendingQuickPassword();
    expect(pw).toBeTruthy();
    expect(pw!.length).toBe(16); // 默认生成长度
    // 全程不开面板、不出锁屏（快速生成契约：不开面板）
    expect(document.querySelector('.bz-password-vault-lock.open')).toBeNull();
  });

  it('复制失败 → 错误通知且不记待存状态', async () => {
    stubClipboard(false); // writeText 拒绝；jsdom 无 execCommand 实现 → 兜底亦失败
    await quickGeneratePassword(getApp());
    expect(hasNotice('复制失败，请手动复制')).toBe(true);
    expect(consumePendingQuickPassword()).toBeNull();
  });
});

describe('解锁消费 + 弹窗关闭守卫（ui 层）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: PasswordVaultUIManager;

  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    localStorage.clear();
    vault = new MockVault();
    setApp({ vault, metadataCache: { trigger: vi.fn() } } as any);
    setSettingsProvider(() => ({ passwordCharset: '', passwordLength: '16', securityMode: false }) as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    dm = new PasswordVaultDataManager(sm);
    ui = new PasswordVaultUIManager(dm, { charset: '', length: '16', securityMode: false });
    clearPendingQuickPassword();
  });

  afterEach(() => {
    ui?.cleanup();
    sm.lock();
    clearPendingQuickPassword();
  });

  /** 建清单 → 锁定 → show（锁屏 open）→ 解锁：返回锁屏元素（用例内自行填值点主钮） */
  async function showLocked(): Promise<HTMLElement> {
    await sm.unlock('pw');
    sm.lock();
    ui.show();
    await vi.waitFor(() =>
      expect(document.querySelector('.bz-password-vault-lock.open [data-ls="p1"]')).toBeTruthy()
    );
    return document.querySelector('.bz-password-vault-lock.open') as HTMLElement;
  }

  it('解锁成功自动弹添加窗并预填待存密码（一次性：二次解锁不再弹）', async () => {
    setPendingQuickPassword('QUICKPW123');
    const lock = await showLocked();
    (lock.querySelector('[data-ls="p1"]') as HTMLInputElement).value = 'pw';
    (lock.querySelector('[data-ls="go"]') as HTMLButtonElement).click();
    // 解锁链（reloadAfterUnlock → renderAll → 消费待存）异步：等弹窗开出且密码已预填
    await vi.waitFor(() =>
      expect(document.querySelector('.bz-password-vault-modal.open')).toBeTruthy()
    );
    const dlg = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog')!;
    expect((dlg.querySelector('[data-f="password"]') as HTMLInputElement).value).toBe('QUICKPW123');
    // 消费即清：收起弹窗再走一轮上锁/解锁，不再自动弹
    (document.querySelector('.bz-password-vault-modal.open [data-act="cancel"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    const lock2 = await showLocked();
    (lock2.querySelector('[data-ls="p1"]') as HTMLInputElement).value = 'pw';
    (lock2.querySelector('[data-ls="go"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeNull();
  });

  it('没动过手：点取消直接关，不弹确认框', async () => {
    await sm.unlock('pw');
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    ui.openEntryDialog(null);
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeTruthy();
    (document.querySelector('.bz-password-vault-modal.open [data-act="cancel"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeNull();
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
  });

  it('有未保存改动：点取消先弹域皮确认框（core confirmDiscard 单源）；「继续编辑」留下、「放弃」真关', async () => {
    await sm.unlock('pw');
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    ui.openEntryDialog(null);
    const dlg = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog')!;
    (dlg.querySelector('[data-f="platform"]') as HTMLInputElement).value = 'GitHub';
    (dlg.querySelector('[data-act="cancel"]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(popup.querySelector('h4')!.textContent).toBe('放弃未保存的内容？'); // confirmDiscard 单源文案
    expect(popup.classList.contains('bz-pwv-flow-dialog')).toBe(true); // 域皮：金色材质随行
    // 「继续编辑」= confirmDiscard 的 actions[1]（占 __shared_confirm_ok__ id，默认聚焦，
    // 回车落这里防误丢）：确认框收场，弹窗留存（手填内容不丢）
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeTruthy();
    // 再点取消 → 确认框再来 → 「放弃」= actions[0]（占 __shared_confirm_cancel__ id）：这次真关
    (dlg.querySelector('[data-act="cancel"]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeNull();
  });

  it('编辑态改动同理守卫；preset.password 预填不重新生成', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'orig', fav: false });
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    // 编辑态：改动 account 后点遮罩关闭 → 确认框（遮罩/取消/ESC 三路同守卫，抽遮罩一路验证）
    const entry = dm.pwData[0];
    ui.openEntryDialog(entry);
    let dlg = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog')!;
    expect((dlg.querySelector('[data-f="account"]') as HTMLInputElement).value).toBe('me');
    (dlg.querySelector('[data-f="account"]') as HTMLInputElement).value = 'me2';
    // 遮罩关闭路径：click 的 target = modal 本体 → closeEntryDialog → dirty 确认框
    const modal = document.querySelector('.bz-password-vault-modal.open') as HTMLElement;
    modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click(); // 「放弃」侧
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeNull();
    // preset 预填：platform/url 照填、password 用预填值不再自动生成
    ui.openEntryDialog(null, { platform: 'GitLab', url: 'https://x', password: 'PRESET9' });
    dlg = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog')!;
    expect((dlg.querySelector('[data-f="platform"]') as HTMLInputElement).value).toBe('GitLab');
    expect((dlg.querySelector('[data-f="url"]') as HTMLInputElement).value).toBe('https://x');
    expect((dlg.querySelector('[data-f="password"]') as HTMLInputElement).value).toBe('PRESET9');
  });

  it('保存成功强制直关：改动已落盘，不走未保存确认', async () => {
    await sm.unlock('pw');
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    ui.openEntryDialog(null);
    const dlg = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog')!;
    (dlg.querySelector('[data-f="platform"]') as HTMLInputElement).value = 'GitHub';
    (dlg.querySelector('[data-f="account"]') as HTMLInputElement).value = 'me';
    // 密码已自动生成（非空），platform/account 已填 → 直接点保存
    (dlg.querySelector('[data-act="save"]') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-password-vault-modal.open')).toBeNull());
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
    expect(dm.pwData.length).toBe(1);
  });

  it('已解锁直进也消费：面板打开时本就解锁 → show() 即弹录入窗预填（review 建议 3 闭环）', async () => {
    await sm.unlock('pw');
    setPendingQuickPassword('UNLOCKEDPW1');
    ui.show(); // 已解锁：不走锁屏，loadAndRender 尾部消费
    await vi.waitFor(() =>
      expect(document.querySelector('.bz-password-vault-modal.open')).toBeTruthy()
    );
    const dlg = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog')!;
    expect((dlg.querySelector('[data-f="password"]') as HTMLInputElement).value).toBe('UNLOCKEDPW1');
    // 消费即清：关掉重开面板不再弹
    (document.querySelector('.bz-password-vault-modal.open [data-act="cancel"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    ui.hide();
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeNull();
  });

  it('添加态双实例同值：一次生成共用，desk/mob 密码字段一致（review 备注 5）', async () => {
    await sm.unlock('pw');
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    ui.openEntryDialog(null);
    const dialogs = document.querySelectorAll('.bz-password-vault-modal .bz-password-vault-dialog');
    expect(dialogs.length).toBe(2); // desk + mob 双实例
    const pw0 = (dialogs[0].querySelector('[data-f="password"]') as HTMLInputElement).value;
    const pw1 = (dialogs[1].querySelector('[data-f="password"]') as HTMLInputElement).value;
    expect(pw0).toBe(pw1);
    expect(pw0).not.toBe('');
  });
});
