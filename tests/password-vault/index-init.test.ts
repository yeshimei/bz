/**
 * password-vault 域入口命令链回归（index.ts）：
 * - ensurePasswordVault：init 成功后才置旗标（先置会让 init 抛错后的后续调用全部短路，深审新-6）；
 * - void 命令链 catch 收口（openPasswordVault / copyGeneratedPassword 初始化失败走通知，不裸抛）；
 * - lockPasswordVault：上锁广播即自清本域明文缓存（数据层订阅统一收口，深审新-2/N18①），
 *   ok=false「本来就是锁着的」文案保留。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { unloadEncrypt } from '../../src/encrypt';
import { PasswordVaultAppController } from '../../src/password-vault/ui';
import { closePasswordQuickPicker } from '../../src/password-vault/quick-pick';
import {
  ensurePasswordVault,
  openPasswordVault,
  copyGeneratedPassword,
  lockPasswordVault,
  unloadPasswordVault,
} from '../../src/password-vault/index';
import { PasswordVaultDataManager } from '../../src/password-vault/data';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';

async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('password-vault 域入口命令链', () => {
  let vault: MockVault;
  let sm: SafeManager;

  beforeEach(async () => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    localStorage.clear();
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ passwordCharset: '', passwordLength: '16', securityMode: false }) as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    await sm.unlock('pw');
  });

  afterEach(() => {
    closePasswordQuickPicker();
    unloadPasswordVault();
    // 命令链路懒建的 encrypt 控制器（模块级缓存）——unloadEncrypt 复位，防跨用例共享旧解锁态
    unloadEncrypt();
    sm.lock();
    document.body.innerHTML = '';
  });

  it('ensurePasswordVault：init 抛错不置旗标（后续调用可重试），成功后才短路', async () => {
    const spy = vi.spyOn(PasswordVaultAppController.prototype, 'init').mockRejectedValueOnce(new Error('init-boom'));
    await expect(ensurePasswordVault(getApp())).rejects.toThrow('init-boom');
    expect(spy).toHaveBeenCalledTimes(1);
    // 第二次调用真正 init（旗标未先置 → 可重试）
    await ensurePasswordVault(getApp());
    expect(spy).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.bz-password-vault')).not.toBeNull();
    // 成功后短路：不再重复 init
    await ensurePasswordVault(getApp());
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('openPasswordVault：init 失败走「初始化失败」通知（void 链 catch 收口，无 unhandled）', async () => {
    const spy = vi.spyOn(PasswordVaultAppController.prototype, 'init').mockRejectedValue(new Error('boom'));
    openPasswordVault(getApp());
    await waitFor(() => hasNotice('密码本初始化失败，请重试'));
    spy.mockRestore();
  });

  it('copyGeneratedPassword：初始化失败链内自兜底（通知收场，不弹解锁屏、不 reject）', async () => {
    const spy = vi.spyOn(PasswordVaultAppController.prototype, 'init').mockRejectedValue(new Error('boom'));
    await expect(copyGeneratedPassword(getApp())).resolves.toBeUndefined();
    expect(hasNotice('密码本初始化失败，请重试')).toBe(true);
    expect(document.querySelector('.bz-lockscreen--mask')).toBeNull();
    spy.mockRestore();
  });

  it('lockPasswordVault：上锁广播即自清本域明文缓存（订阅统一收口）；已锁再跑报「本来就是锁着的」', async () => {
    // 预置一条数据落盘（测试自有 dm，写完即销毁避免双订阅干扰）
    const seed = new PasswordVaultDataManager(sm);
    await seed.addItem({ platform: 'GitHub', account: 'me@x', password: 's3cret' });
    seed.destroy();
    // 快速取密链路：解锁 → pv 控制器与数据层就位 → 整表解密驻留 pwData → 关闭选择器（取消）
    const run = copyGeneratedPassword(getApp());
    await waitFor(() => !!document.querySelector('.bz-lockscreen--mask'));
    const mask = document.querySelector('.bz-lockscreen--mask') as HTMLElement;
    (mask.querySelector('input.bz-lockscreen-input') as HTMLInputElement).value = 'pw';
    (mask.querySelector('.bz-lockscreen-action') as HTMLElement).click();
    await waitFor(() => !!document.getElementById('bz-password-vault-qp-popup'));
    (document.getElementById('bz-password-vault-qp-mask') as HTMLElement).click();
    await run;
    const c = PasswordVaultAppController.instance!;
    expect(c.dataManager.pwData.length).toBe(1);
    // 锁定密码本命令：SafeManager 上锁广播 → 本域实例明文自清（不再依赖显式 dataManager.lock()）
    clearNotices();
    await lockPasswordVault(getApp());
    expect(hasNotice('密码本已锁定')).toBe(true);
    expect(c.dataManager.pwData.length).toBe(0);
    // 已锁再跑：ok=false 分支文案保留
    clearNotices();
    await lockPasswordVault(getApp());
    expect(hasNotice('密码本本来就是锁着的')).toBe(true);
  });
});
