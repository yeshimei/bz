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
import { DEFAULT_PW_CHARSET, clearPendingQuickPassword, setPendingQuickPassword } from './data';
import { openPasswordQuickPicker, closePasswordQuickPicker } from './quick-pick';

let initialized = false;
let controller: PasswordVaultAppController | null = null;

function getController(): PasswordVaultAppController {
  if (!controller) {
    const s = getSettings();
    // 生成器设置复用现有全局键（与旧密码本同源；Q7：字符集/长度用现有全局设置）
    const charset = s.passwordCharset || DEFAULT_PW_CHARSET;
    const length = String(parseInt(s.passwordLength) || 16);
    const securityMode = !!s.securityMode;
    controller = PasswordVaultAppController.getInstance({ charset, length, securityMode });
  }
  return controller;
}

export async function ensurePasswordVault(app: App): Promise<void> {
  if (initialized) return;
  await getController().init();
  // init 成功后再置旗标（对齐 encrypt ensureEncrypt 同款：先置会让 init 抛错后的
  // 后续调用全部短路，无法重试）
  initialized = true;
}

export function openPasswordVault(app: App): void {
  void ensurePasswordVault(app)
    .then(() => getController().openManager())
    .catch(() => notice('密码本初始化失败，请重试', 'error')); // void 链 catch 收口（对齐 encrypt openEncrypt）
}

/**
 * 快速生成密码（命令 bz-password-vault-quick-gen，2026-09-24 首页右键菜单点名）：
 * 不解锁、不开任何面板——按设置的字符集/长度生成 → 复制剪贴板（60s 自动清空语义同快速
 * 取密）→ 把明文记入 data 层待存状态（内存单条 + 10 分钟 TTL，不上盘）。之后用户解锁
 * 密码本（锁屏任意路径）时由 ui 层 maybeOpenPendingAdd 消费：自动弹出添加窗并预填该密码，
 * 「复制去注册 → 回密码本存档」一步到位。与「快速取密」（bz-password-vault-gen）的差异：
 * 那条出 fuzzy 选择器（可挑存量），这条跳过选择器直接出新密码。
 */
export async function quickGeneratePassword(app: App): Promise<void> {
  try {
    await ensurePasswordVault(app);
  } catch {
    notice('密码本初始化失败，请重试', 'error'); // main.ts 侧 void 调用，链内自兜底防 unhandled rejection
    return;
  }
  const pw = getController().uiManager.generatePassword();
  const ok = await copySensitiveWithFallback(pw);
  if (!ok) {
    notice('复制失败，请手动复制', 'error');
    return;
  }
  setPendingQuickPassword(pw);
  notice('已生成并复制密码，60 秒后自动清空；解锁密码本时将自动弹出录入窗', 'success');
}

/**
 * 快速取密（命令 bz-password-vault-gen，ADR-0158 统一流；2026-09-10 首页入口菜单联动）：
 * 未解锁先弹主密码（同库同锁）→ fuzzy 选择器列出现有密码条目 + 顶部固定「生成新密码」项——
 * 选中现有条目 → 复制该密码；选「生成新」→ 按设置的字符集/长度生成并复制。
 * 60s 剪贴板自动清空语义、防偷窥口径（通知只报平台/账号，不含明文）与旧链路一致；
 * 全程不打开面板（选择器为轻量弹层）。
 */
export async function copyGeneratedPassword(app: App): Promise<void> {
  try {
    await ensurePasswordVault(app);
  } catch {
    notice('密码本初始化失败，请重试', 'error'); // main.ts 侧 void 调用，链内自兜底防 unhandled rejection
    return;
  }
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
 * `lockSafe` —— 一步锁掉两边。本域实例的明文缓存（pwData/loadCache）自深审新-2 起由数据层
 * 订阅 encrypt:unlock-changed(false) 统一自清（SafeManager.lock 幂等短路后上锁必广播一次），
 * 此处不再显式 dataManager.lock()。
 */
export async function lockPasswordVault(app: App): Promise<void> {
  try {
    await ensurePasswordVault(app);
  } catch {
    notice('密码本初始化失败，请重试', 'error');
    return;
  }
  const ok = await lockSafe(app);
  if (ok) notice('密码本已锁定', 'success');
  else notice('密码本本来就是锁着的', 'warning');
}

/** 卸载清理（main.ts onunload 调用） */
export function unloadPasswordVault(): void {
  closePasswordQuickPicker(); // 快速取密选择器若开着：插件卸载即撤（遮罩/ESC 层不残留）
  clearPendingQuickPassword(); // 快速生成密码的待存状态是内存便签：卸载即弃（不留跨重载的明文）
  if (controller) controller.cleanup();
  controller = null;
  initialized = false;
}
