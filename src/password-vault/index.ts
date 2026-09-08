/**
 * 保险库（password-vault）域入口
 * 与旧密码本域并存、互不影响：独立 UI（原型 v1 一比一），共享保险箱数据。
 * 命令 bz-password-vault-open 由 main.ts 裸注册（ADR-0004）。
 * 懒加载：ensurePasswordVault 幂等初始化（ADR-0003）。
 */
import type { App } from 'obsidian';
import { getSettings } from '../core/settings-provider';
import { PasswordVaultAppController } from './ui';

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

/** 卸载清理（main.ts onunload 调用） */
export function unloadPasswordVault(): void {
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
}
