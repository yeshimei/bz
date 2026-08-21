/**
 * 加密保险箱域入口（encrypt）
 * 命令 bz-encrypt-open / bz-encrypt-lock 由 main.ts 裸注册。
 * 懒加载：ensureEncrypt 幂等初始化（ADR-0003）。
 */
import type { App } from 'obsidian';
import { getSettings } from '../core/settings-provider';
import { EncryptAppController } from './ui';

let initialized = false;
let controller: EncryptAppController | null = null;

function getController(): EncryptAppController {
  if (!controller) {
    const s = getSettings() as any;
    const config = {
      root: (s.encryptRoot || 'CONFIG/.ENCRYPT').replace(/\/+$/, ''),
      previewEnabled: s.encryptPreviewEnabled !== false,
      previewSize: parseInt(s.encryptPreviewSize) || 960,
      previewQuality: parseFloat(s.encryptPreviewQuality) || 0.7,
      securityMode: !!s.encryptSecurityMode,
    };
    controller = EncryptAppController.getInstance(config);
  }
  return controller;
}

export async function ensureEncrypt(app: App): Promise<void> {
  if (initialized) return;
  initialized = true;
  await getController().init();
}

export function openEncrypt(app: App): void {
  void ensureEncrypt(app).then(() => getController().openManager());
}

export function encryptCurrentNote(app: App): void {
  void ensureEncrypt(app).then(() => getController().lockCurrentNote());
}

/** 卸载清理 */
export function unloadEncrypt(): void {
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
}