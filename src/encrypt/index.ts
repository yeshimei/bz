/**
 * 保险库域入口（encrypt）
 * 命令 bz-encrypt-open / bz-encrypt-lock 由 main.ts 裸注册。
 * 懒加载：ensureEncrypt 幂等初始化（ADR-0003）。
 */
import type { App } from 'obsidian';
import { getSettings } from '../core/settings-provider';
import { getApp } from '../core/app';
import { EncryptAppController } from './ui';

let initialized = false;
let controller: EncryptAppController | null = null;

function getController(): EncryptAppController {
  if (!controller) {
    const s = getSettings() as any;
    const config = {
      root: (s.encryptRoot || 'CONFIG/.ENCRYPT').replace(/\/+$/, ''),
      previewEnabled: s.encryptPreviewEnabled !== false,
      previewSize: parseInt(s.encryptPreviewSize) || 384,
      previewQuality: parseFloat(s.encryptPreviewQuality) || 0.5,
      autoLoadOriginal: !!s.encryptAutoLoadOriginal,
      securityMode: !!s.encryptSecurityMode,
      // ADR-0085：密码资产并入保险库；生成器沿用全局键（旧密码本同源）
      pwCharset:
        s.passwordCharset || '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+',
      pwLength: String(parseInt(s.passwordLength) || 16),
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

// ---------- 状态栏（补丁2：状态栏锁状态提示） ----------
let statusBarEl: HTMLElement | null = null;

/**
 * 统一保险库状态栏（main.ts onload 调用，与番茄钟同范式）：
 * 初始显示锁定态，点击打开保险库面板；ensureEncrypt 后由 Controller 接管解锁态刷新。
 */
export function mountEncryptStatusBar(container: HTMLElement): void {
  if (statusBarEl) return;
  const el = document.createElement('span');
  el.className = 'bz-encrypt-statusbar';
  el.title = '保险库：点击打开';
  el.textContent = '🔒 保险库';
  el.addEventListener('click', () => openEncrypt(getApp()));
  container.appendChild(el);
  statusBarEl = el;
  void ensureEncrypt(getApp()).then(() => getController().attachStatusBar(el));
}

/** 卸载状态栏（main.ts onunload 调用） */
export function unmountEncryptStatusBar(): void {
  if (statusBarEl) {
    statusBarEl.remove();
    statusBarEl = null;
  }
}

export function openEncrypt(app: App): void {
  void ensureEncrypt(app).then(() => getController().openManager());
}

export function encryptCurrentNote(app: App): void {
  void ensureEncrypt(app).then(() => getController().lockCurrentNote());
}

/**
 * 快速复制密码（命令 bz-encrypt-copy-password）：轻量 fuzzy 选择器选中即复制
 * （60s 自动清空剪贴板），未解锁先弹主密码；全程不打开保险库主面板。
 */
export function copyVaultPassword(app: App): void {
  void ensureEncrypt(app).then(() => getController().quickCopyPassword());
}

/**
 * 获取保险库 SafeManager 单例（与保险库面板同一实例，共享同一主密码与解锁态）。
 * 供日记域复用（ADR-0017：加密日记=保险库 SafeNote）。惰性读取设置。
 */
export function getSafeManager(): import('./data').SafeManager {
  return getController().dataManager;
}

/**
 * 确保保险库已解锁（供日记域复用）：未解锁则弹主密码（首设两次确认+警告；与保险库同一把密码）。
 * @returns 解锁成功返回 true
 */
export async function ensureSafeUnlocked(): Promise<boolean> {
  const controller = getController();
  if (controller.dataManager.unlocked) return true;
  const ok = await controller.uiManager.showPasswordDialog();
  return ok;
}

/** 保险库数据层类型再导出（diary 复用 SafeNote 时用） */
export type { SafeNote, SafeAttachment, SafeManager } from './data';

/** 卸载清理 */
export function unloadEncrypt(): void {
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
}