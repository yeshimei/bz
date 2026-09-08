/**
 * 密码本行为单源 · sim 启动入口（issue 251/ADR-0106；范式自 clipbook 适配）
 *
 * 评审壳侧启动器：把真行为层（password-vault ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（setApp 真身——SafeManager 的清单/密文读写经 FakeVault
 *     adapter 直读面跑在 localStorage 上，点前缀兼容与插件同语义）；
 *   - 种子数据：window.PWV_DATA（prototype-data.js，node 端用真 SafeManager + 真加密
 *     链离线生成的演示库密文：主密码 demo，9 平台 16 账号全合成演示数据），首启直写
 *     fake vault 的 CONFIG/.ENCRYPT/.safe.enc 与密文镜像——幂等直写，双 iframe 无竞态；
 *     锁屏以「输入主密码」态打开（清单已存在），输 demo 即解锁；
 *   - 设置注入：setSettingsProvider（真 settings-provider 实现可用，注入密码本/保险库
 *     实际键；securityMode=false——演示期关窗不上锁）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_password_vault，iframe 壳只调 boot + openPanel。
 * 插件的 ui.ts / render.ts / data.ts / index.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp, seedVaultFile } from './fake/fake-obsidian';
import { setApp } from '../core/app';
import { setSettingsProvider } from '../core/settings-provider';
import { openPasswordVault, unloadPasswordVault } from './index';

/** 种子标记：存在 = 已种子过（评审壳里的增删改保留，不被覆盖） */
const SEED_MARK = 'bz-sim:__pwv-seed-v1';
/** 设置持久键（saveSettings 通道；自检可断言） */
export const SETTINGS_KEY = 'bz-sim:__settings';

/** prototype-data.js 单条形状：加密库文件路径 → 密文（.safe.enc + contentRef 镜像） */
declare global {
  interface Window {
    PWV_DATA?: Record<string, string>;
  }
}

/** 演示主密码（与 gen 脚本一致；壳徽牌展示提示） */
export const DEMO_MASTER_PASSWORD = 'demo';

/** 密码本/保险库设置 store（真 settings-provider 注入） */
const settingsStore: Record<string, unknown> = {
  storagePath: 'CONFIG/STORAGE',
  encryptRoot: 'CONFIG/.ENCRYPT',
  encryptPreviewEnabled: false,
  encryptSecurityMode: false,
  // 安全模式演示期关闭：关窗不上锁，评审可反复进出（真插件默认值同为 false）
  securityMode: false,
  passwordCharset: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+',
  passwordLength: '16',
};

/** 种子：PWV_DATA → fake vault（仅首启；演示库密文由 node 端真加密链离线生成） */
function seedDatabase(): void {
  // 自身 window 优先（同文档场景）；iframe 场景读父页（评审壳持有 PWV_DATA）
  const src = window.PWV_DATA || (window.parent && (window.parent as Window).PWV_DATA) || null;
  if (!src || localStorage.getItem(SEED_MARK)) return;
  for (const [path, content] of Object.entries(src)) {
    seedVaultFile(path, content);
  }
  localStorage.setItem(SEED_MARK, new Date().toISOString());
}

/** 设置注入（settings-provider 真实现可用） */
function injectSettings(): void {
  setSettingsProvider(() => settingsStore as never);
}

let simApp: FakeApp | null = null;

/** 壳入口：一次性启动（种子 + 注入；幂等） */
export function bootPasswordVaultSim(): void {
  const g = window as unknown as { __bzPwvSimBooted?: boolean };
  if (g.__bzPwvSimBooted) return;
  g.__bzPwvSimBooted = true;
  seedDatabase();
  // core/app 的 setApp 形参是 obsidian App 类型；评审壳 FakeApp 只实现依赖链消费面，
  // 运行期以 (app.vault as any).adapter 等访问——类型断言收敛此处差异。
  const app = new FakeApp();
  simApp = app;
  setApp(app as never);
  injectSettings();
}

/** 锁屏演示提示（壳侧注入：真锁屏 markup 单源不掺演示文案，演示外景注记归 fake-sim） */
function injectLockHint(): void {
  document.querySelectorAll<HTMLElement>('.bz-password-vault-lock').forEach((lock) => {
    if (lock.querySelector('.bz-pwv-sim-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'bz-pwv-sim-hint';
    hint.style.cssText = 'margin-top:12px;font-size:12px;color:#9a917d;letter-spacing:.5px;';
    hint.textContent = '演示库主密码：demo（小写；两端各自解锁）';
    lock.appendChild(hint);
  });
}

/** 打开密码本（插件 index.openPasswordVault 同名语义：首开建面板 + show，之后 show） */
export function openPanel(): void {
  if (!simApp) bootPasswordVaultSim();
  openPasswordVault(simApp as never);
  injectLockHint();
}

/** 卸载（自检/重置演示数据前清态用） */
export function unload(): void {
  unloadPasswordVault();
}
