/**
 * 保险库（password-vault）域入口
 * 与旧密码本域并存、互不影响：独立 UI（原型 v1 一比一），共享保险箱数据。
 * 命令 bz-password-vault-open 由 main.ts 裸注册（ADR-0004）。
 * 懒加载：ensurePasswordVault 幂等初始化（ADR-0003）。
 */
import type { App } from 'obsidian';
import { getSettings } from '../core/settings-provider';
import { notice } from '../core/notice';
import { lockSafe } from '../encrypt';
import { PasswordVaultAppController } from './ui';
import { copySensitiveText } from '../core/utils';

let initialized = false;
let controller: PasswordVaultAppController | null = null;

function getController(): PasswordVaultAppController {
  if (!controller) {
    const s = getSettings();
    // 生成器设置复用现有全局键（与旧密码本同源；Q7：字符集/长度用现有全局设置）
    const charset =
      s.passwordCharset ||
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+';
    const length = String(parseInt(s.passwordLength) || 16);
    const securityMode = !!s.securityMode;
    controller = PasswordVaultAppController.getInstance({ charset, length, securityMode });
  }
  return controller;
}

export async function ensurePasswordVault(app: App): Promise<void> {
  if (initialized) return;
  initialized = true;
  await getController().init();
}

export function openPasswordVault(app: App): void {
  void ensurePasswordVault(app).then(() => getController().openManager());
}

/**
 * 快速生成密码（命令 bz-password-vault-gen，2026-09-10 首页入口菜单联动）：
 * 按设置的字符集/长度生成 → 复制到剪贴板（60 秒后自动清空，与面板内「复制」同一路径）→ 通知。
 * 全程不打开面板；生成器与面板同源（同一个 controller 实例读同一份设置）。
 */
export async function copyGeneratedPassword(app: App): Promise<void> {
  await ensurePasswordVault(app);
  const pw = getController().uiManager.generatePassword();
  try {
    await copySensitiveText(pw);
    notice('已生成并复制密码，60 秒后自动清空剪贴板');
  } catch {
    notice('密码已生成，但复制失败（剪贴板不可用）', 'warning');
  }
}

/**
 * 锁定密码本（命令 bz-password-vault-lock，2026-09-11 首页入口菜单）：
 * 与保险库**同一把主密码、同一个 SafeManager**（ADR-0109 同库共存），故直接复用 encrypt 的
 * `lockSafe` —— 一步锁掉两边，本域自己的明文缓存再清一次（两个域 UI 各自实例化包装层，
 * 保险库侧清不到本域实例）。此前只能进面板走缺省上锁路径。
 */
export async function lockPasswordVault(app: App): Promise<void> {
  await ensurePasswordVault(app);
  const ok = await lockSafe(app);
  getController().dataManager.lock();
  if (ok) notice('密码本已锁定', 'success');
  else notice('密码本本来就是锁着的', 'warning');
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadPasswordVault(): void {
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
}
