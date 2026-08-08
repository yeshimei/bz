/**
 * 密码本域入口（ticket 07）
 * 命令（pw-open-manager/pw-add-entry/pw-generate-password）由 main.ts 裸注册。
 * 懒加载：ensurePassword 幂等初始化（Controller.init）。
 */
import type { App } from 'obsidian';
import { getSettings } from '../core/settings-provider';
import { PasswordAppController } from './ui';

let initialized = false;
let controller: PasswordAppController | null = null;

function getController(): PasswordAppController {
  if (!controller) {
    const s = getSettings();
    // ADR-0009：storagePath 优先，旧 pwStoragePath 兼容兜底
    const storagePath = ((s.storagePath || s.pwStoragePath) || 'CONFIG/STORAGE').replace(/\/+$/, '');
    const charset =
      s.passwordCharset ||
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+';
    const length = String(parseInt(s.passwordLength) || 16);
    const securityMode = !!s.securityMode;
    controller = PasswordAppController.getInstance({ storagePath, charset, length, securityMode });
  }
  return controller;
}

export async function ensurePassword(app: App): Promise<void> {
  if (initialized) return;
  initialized = true;
  await getController().init();
}

export function openPasswordManager(app: App): void {
  void ensurePassword(app).then(() => getController().openManager());
}

export function addPasswordEntry(app: App): void {
  void ensurePassword(app).then(() => getController().addEntry());
}

export function generatePassword(app: App): void {
  void ensurePassword(app).then(() => getController().generatePassword());
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadPassword(): void {
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
}
