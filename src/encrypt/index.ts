/**
 * 保险箱域入口（encrypt）
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

/**
 * 获取保险箱 SafeManager 单例（与保险箱面板同一实例，共享同一主密码与解锁态）。
 * 供日记域复用（ADR-0017：加密日记=保险箱 SafeNote）。惰性读取设置。
 */
export function getSafeManager(): import('./data').SafeManager {
  return getController().dataManager;
}

/**
 * 确保保险箱已解锁（供日记域复用）：未解锁则弹主密码（首设两次确认+警告；与保险箱同一把密码）。
 * @returns 解锁成功返回 true
 */
export async function ensureSafeUnlocked(): Promise<boolean> {
  const controller = getController();
  if (controller.dataManager.unlocked) return true;
  const ok = await controller.uiManager.showPasswordDialog();
  return ok;
}

/** 保险箱数据层类型再导出（diary 复用 SafeNote 时用） */
export type { SafeNote, SafeAttachment, SafeManager } from './data';

/** 卸载清理 */
export function unloadEncrypt(): void {
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
}