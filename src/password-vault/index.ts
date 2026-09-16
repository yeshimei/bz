/**
 * 保险库（password-vault）域入口
 * 与旧密码本域并存、互不影响：独立 UI（原型 v1 一比一），共享保险箱数据。
 * 命令 bz-password-vault-open 由 main.ts 裸注册（ADR-0004）。
 * 懒加载：ensurePasswordVault 幂等初始化（ADR-0003）。
 */
import type { App } from 'obsidian';
import { getSettings } from '../core/settings-provider';
import { notice } from '../core/notice';
import { copySensitiveWithFallback } from '../core/utils';
import { lockSafe, ensureSafeUnlocked } from '../encrypt';
import { PasswordVaultAppController } from './ui';
import { openPasswordQuickPicker, closePasswordQuickPicker } from './quick-pick';

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
 * 快速取密（命令 bz-password-vault-gen，ADR-0158 统一流；2026-09-10 首页入口菜单联动）：
 * 未解锁先弹主密码（同库同锁）→ fuzzy 选择器列出现有密码条目 + 顶部固定「生成新密码」项——
 * 选中现有条目 → 复制该密码；选「生成新」→ 按设置的字符集/长度生成并复制。
 * 60s 剪贴板自动清空语义、防偷窥口径（通知只报平台/账号，不含明文）与旧链路一致；
 * 全程不打开面板（选择器为轻量弹层）。
 */
export async function copyGeneratedPassword(app: App): Promise<void> {
  await ensurePasswordVault(app);
  if (!(await ensureSafeUnlocked('password-vault'))) return;
  const c = getController();
  try {
    await c.dataManager.load();
  } catch {
    /* 载荷损坏等：按空态处理（选择器只剩「生成新密码」项） */
  }
  openPasswordQuickPicker(c.dataManager.pwData, (pick) => {
    const noticeCopy = (ok: boolean, msg: string) =>
      notice(ok ? msg : '复制失败，请手动复制', ok ? 'success' : 'error');
    if (pick.type === 'generate') {
      const pw = c.uiManager.generatePassword();
      void copySensitiveWithFallback(pw).then((ok) =>
        noticeCopy(ok, '已生成并复制密码，60 秒后自动清空剪贴板')
      );
      return;
    }
    const d = pick.entry;
    void copySensitiveWithFallback(d.password).then((ok) =>
      noticeCopy(ok, `已复制「${d.platform}」${d.account ? `（${d.account}）` : ''}的密码，60 秒后自动清空`)
    );
  });
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
  closePasswordQuickPicker(); // 快速取密选择器若开着：插件卸载即撤（遮罩/ESC 层不残留）
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
}
