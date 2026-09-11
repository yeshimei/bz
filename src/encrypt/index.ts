/**
 * 保险库域入口（encrypt）
 * 命令 bz-encrypt-open / bz-encrypt-lock 由 main.ts 裸注册。
 * 懒加载：ensureEncrypt 幂等初始化（ADR-0003）。
 */
import type { App } from 'obsidian';
import { getSettings } from '../core/settings-provider';
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { EncryptAppController, DEFAULT_PW_CHARSET } from './ui';
import { vIc } from './vault-assets-view';

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
      pwCharset: s.passwordCharset || DEFAULT_PW_CHARSET,
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

/** 状态栏内容：lucide 锁图标（解锁态开锁）+ 文案（铁律：图标不用 emoji） */
function statusbarHtml(unlocked: boolean): string {
  return `${vIc(unlocked ? 'lock-open' : 'lock', 12)} 保险库`;
}

/**
 * 统一保险库状态栏（main.ts onload 调用，与番茄钟同范式）：
 * 初始显示锁定态，点击打开保险库面板；ensureEncrypt 后由 Controller 接管解锁态刷新。
 */
export function mountEncryptStatusBar(container: HTMLElement): void {
  if (statusBarEl) return;
  const el = document.createElement('span');
  el.className = 'bz-encrypt-statusbar';
  el.title = '保险库：点击打开';
  el.innerHTML = statusbarHtml(false);
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
 * 静默上锁（2026-09-11）：已锁定返回 false；否则清内存态并返回 true，**不弹通知**。
 * 复用面板「立即上锁」同一条路径（uiManager.lockNow：SafeManager + 密码本包装层 + 明文缓存
 * + 解锁态 UI 同步，安全模式下顺带落锁屏）——命令侧只负责通知文案，故与加密域拆开。
 * 保险库与密码本共用一个 SafeManager（一把主密码），两个域的「锁定」命令都落到这里。
 */
export async function lockSafe(app: App): Promise<boolean> {
  await ensureEncrypt(app);
  if (!getSafeManager().unlocked) return false;
  getController().uiManager.lockNow();
  return true;
}

/**
 * 锁定保险库（命令 bz-encrypt-lock，2026-09-11 首页入口菜单）：
 * 一步上锁、全程不打开面板。此前只能进面板点顶栏「立即上锁」。
 */
export async function lockEncrypt(app: App): Promise<void> {
  const ok = await lockSafe(app);
  if (ok) notice('保险库已锁定', 'success');
  else notice('保险库本来就是锁着的', 'warning');
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