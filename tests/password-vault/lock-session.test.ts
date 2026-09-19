/**
 * 密码本域深审 · 批 B「ui 会话锁屏」回归（pv-ui/pv-func/pv-consistency/pv-arch 汇总条目）：
 * S1 空锁屏卡死（N16 升级：外部上锁必挂内容锁屏 + 幂等重入清输入）、
 * S2 kw 残留渲染链（未解锁守卫 + 搜索态随上锁复位）、S3 安全模式双键全链（旧键 OR + 设置双写）、
 * S4 上锁收场弹窗（面板内弹窗 + body 流程框随锁收起）、S5 15 分钟 idle 自动上锁（交互重置 + 单通知）、
 * S6 shownIds/mobpage 清理（N14：重解锁不明文直出）、S7 renderAll 写盘摘除（T12 对齐 encrypt）、
 * S8 密码错误单通知 + 冷却倒计时（N15/ui 新-7）、S9 eye 三件套复位（N13）、S10 防重入（保存双击/首设确认叠框）。
 * 安全红线：全部自造 fixture，不读用户 vault 真实密文。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { cancelActiveFlowDialog } from '../../src/core/flow-dialog';
import { SafeManager } from '../../src/encrypt/data';
import { PasswordVaultDataManager } from '../../src/password-vault/data';
import { PasswordVaultUIManager } from '../../src/password-vault/ui';
import { readLockStats } from '../../src/core/lock-stats';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, hasNotice } from '../mock-obsidian-entry';
import { clearDomainEvents } from '../../src/core/domain-bus';

async function flush(ms = 20) {
  await new Promise((r) => setTimeout(r, ms));
}

/** 轮询等待异步落盘/回落完成（fire-and-forget 链无完成信号） */
async function waitForAsync(cond: () => Promise<boolean>, timeout = 4000) {
  const start = Date.now();
  while (!(await cond())) {
    if (Date.now() - start > timeout) throw new Error('waitForAsync 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** 已解锁进入面板（锁屏关闭 + 列表渲染就绪——load 是异步的，未等渲染就读列表会撞空） */
async function showUnlocked(ui: PasswordVaultUIManager) {
  ui.show();
  await vi.waitFor(() => {
    expect(document.querySelectorAll('.bz-password-vault-lock.open').length).toBe(0);
    expect(document.querySelector('.bz-password-vault-mobcard')).toBeTruthy();
  });
}

describe('批 B · ui 会话锁屏回归（password-vault）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: PasswordVaultUIManager;

  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    clearNotices();
    document.body.innerHTML = '';
    localStorage.clear();
    vault = new MockVault();
    setApp({ vault, metadataCache: { trigger: vi.fn() } } as any);
    setSettingsProvider(() => ({ passwordCharset: '', passwordLength: '16', securityMode: false }) as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    dm = new PasswordVaultDataManager(sm);
    ui = new PasswordVaultUIManager(dm, { charset: '', length: '16', securityMode: false });
  });

  afterEach(() => {
    cancelActiveFlowDialog(); // 未决确认框按取消语义结算（防污染后续用例）
    ui.cleanup();
    sm.lock();
    document.body.innerHTML = '';
  });

  // ---------- S1 空锁屏卡死（N16 升级，P1） ----------

  it('S1：解锁态开面板 → 别域上锁 → 锁屏带内容（输入框在场，非空壳金底）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    await showUnlocked(ui); // showLock 从未跑过（修复前锁屏容器是空 div）
    sm.lock();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-password-vault-lock.open').length).toBe(2);
      // 修复前：锁屏容器只切 .open、内容从未装配 → 空白锁屏无输入框无法就地解锁
      expect(document.querySelectorAll('.bz-password-vault-lock.open [data-ls="p1"]').length).toBe(2);
    });
    expect(document.querySelector('.bz-password-vault-lock.open [data-ls="title"]')!.textContent).toBe('密码本已上锁');
  });

  it('S1b：解锁成功后再上锁 → 锁屏重挂时输入已清空（口令不残留 DOM，arch 亚型 b）', async () => {
    await sm.unlock('correct-pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    sm.lock();
    dm.pwData = []; // 模拟真实重启：锁定后内存数据清空
    ui.show();
    await vi.waitFor(() => expect(document.querySelector('.bz-password-vault-lock.open [data-ls="p1"]')).toBeTruthy());
    const lock = document.querySelector('.bz-password-vault-lock.open') as HTMLElement;
    (lock.querySelector('[data-ls="p1"]') as HTMLInputElement).value = 'correct-pw';
    (lock.querySelector('[data-ls="go"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-password-vault-lock.open').length).toBe(0));
    // 别域上锁 → showLock 幂等重入 → 输入框清空（修复前只切 .open，输入残留上一次口令）
    sm.lock();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('.bz-password-vault-lock.open [data-ls="p1"]').length).toBe(2)
    );
    for (const el of document.querySelectorAll('.bz-password-vault-lock.open [data-ls="p1"]')) {
      expect((el as HTMLInputElement).value).toBe('');
    }
  });

  // ---------- S2 kw 残留渲染链（func 新-1 症状 B，P1） ----------

  it('S2：搜索后别域上锁 → renderAll 不抛、无 unhandled rejection、锁屏内容在；重开面板仍正常', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    await showUnlocked(ui);
    // 搜索（防抖落定后 searchKw 残留）
    const search = document.querySelector('.bz-password-vault-search input') as HTMLInputElement;
    search.value = 'GitHub';
    search.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    // 修复前：search(未解锁) throw '未解锁' → renderAll 断裂 + showLock 被跳过（空锁屏 + unhandled rejection）
    const unhandled: unknown[] = [];
    const onUnhandled = (e: PromiseRejectionEvent) => unhandled.push(e.reason);
    window.addEventListener('unhandledrejection', onUnhandled);
    sm.lock();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-password-vault-lock.open [data-ls="p1"]').length).toBe(2);
    });
    await flush(50);
    window.removeEventListener('unhandledrejection', onUnhandled);
    expect(unhandled).toEqual([]);
    expect((document.querySelector('.bz-password-vault-rows') as HTMLElement).textContent).toBe('');
    expect(ui.searchKw).toBe(''); // 搜索态随上锁复位（清 kw + 双实例搜索框值）
    // 重开面板：锁定态 loadAndRender 不再因残留词炸断
    ui.hide();
    ui.show();
    await flush(50);
    expect(document.querySelectorAll('.bz-password-vault-lock.open [data-ls="p1"]').length).toBe(2);
  });

  // ---------- S3 安全模式双键全链（N18②/cons 新-1，P2） ----------

  it('S3a：安全模式旧键（settings.encryptSecurityMode=true，config 快照 false）→ hide 仍自动上锁 + 弹窗收场', async () => {
    setSettingsProvider(() => ({ passwordCharset: '', passwordLength: '16', securityMode: false, encryptSecurityMode: true }) as any);
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    const ui2 = new PasswordVaultUIManager(dm, { charset: '', length: '16', securityMode: false });
    ui2.ensureElements();
    await showUnlocked(ui2);
    ui2.openEntryDialog(null); // 弹窗开着关面板：修复前明文弹窗原样复现，且旧键用户 hide 永不上锁
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeTruthy();
    ui2.hide();
    expect(dm.unlocked).toBe(false); // 修复前单读 config 快照：不上锁
    expect(hasNotice('安全模式：已自动上锁')).toBe(true);
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeNull(); // 收场（cons 新-2）
    ui2.cleanup();
  });

  it('S3b：设置页安全模式 binding 双键 OR 读 + 同步双写（pv 关掉 encrypt 侧旧键不再生效）', async () => {
    const { passwordVaultSettingsSchema } = await import('../../src/password-vault/settings');
    const state: any = { securityMode: false, encryptSecurityMode: true };
    setSettingsProvider(() => state);
    const schema = passwordVaultSettingsSchema();
    const row = schema.groups.flatMap((g) => g.rows).find((r) => (r as any).name === '安全模式') as any;
    expect(row.desc).toBe('关闭密码本窗口立即自动上锁'); // 两域 desc 口径统一（cons 新-13）
    expect(row.binding.get()).toBe(true); // 旧键开着即视为开（OR 读，修复前 toggle 显示关）
    row.binding.set(false);
    expect(state.securityMode).toBe(false);
    expect(state.encryptSecurityMode).toBe(false); // 同步双写：修复前旧键残留 → encrypt 侧关不掉
    expect(row.binding.get()).toBe(false);
    await row.binding.save(); // saveSettings 未注入 saver 时静默，不抛
  });

  // ---------- S4 上锁收场弹窗（cons 新-2 对齐 encrypt N9，P2） ----------

  it('S4：别域上锁 → 面板内弹窗与 body 流程框一并收场（明文不浮在锁屏上方）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', url: 'https://github.com', account: 'me', password: 'secret' });
    await showUnlocked(ui);
    ui.openEntryDialog(null); // 添加弹窗（密码字段有明文）
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeTruthy();
    (ui as any).openPlatformEdit('GitHub'); // 平台编辑弹窗（z-index 55 > 锁屏 20）
    expect(document.querySelectorAll('.bz-password-vault-platedit.open').length).toBe(2);
    ui.askConfirm('删除', 'm', true, () => {}); // body 级流程确认框
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    sm.lock();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('.bz-password-vault-lock.open [data-ls="p1"]').length).toBe(2)
    );
    expect(document.querySelector('.bz-password-vault-modal.open')).toBeNull();
    expect(document.querySelectorAll('.bz-password-vault-platedit.open').length).toBe(0);
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull(); // 流程框按取消语义收场，不悬挂
    expect((document.querySelector('.bz-password-vault-rows') as HTMLElement).textContent).not.toContain('secret');
  });

  // ---------- S5 15 分钟 idle 自动上锁（cons 新-3 对齐 encrypt 形制，P2） ----------

  it('S5：安全模式 15 分钟无交互自动上锁（交互重置 + 单通知 + 随锁收面板）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    const ui2 = new PasswordVaultUIManager(dm, { charset: '', length: '16', securityMode: true });
    await showUnlocked(ui2); // renderAll 解锁态即布防 idle
    clearNotices();
    vi.useFakeTimers();
    try {
      document.dispatchEvent(new Event('pointerdown')); // 交互布防
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000 - 1);
      expect(dm.unlocked).toBe(true); // 差 1ms 不锁
      document.dispatchEvent(new Event('pointerdown')); // 交互重置倒计时
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000 - 1);
      expect(dm.unlocked).toBe(true); // 重置生效
      await vi.advanceTimersByTimeAsync(1000); // 到点（余量吸收广播链异步段）
      expect(dm.unlocked).toBe(false);
      expect(hasNotice('安全模式：15 分钟无操作，已自动上锁')).toBe(true); // 单通知（不与 hide 通知叠加）
      expect(ui2.root!.style.display).toBe('none'); // 安全模式随锁收面板（对齐 encrypt lockNow）
    } finally {
      vi.useRealTimers();
      ui2.cleanup();
    }
  });

  it('S5b：非安全模式 idle 不布防（15 分钟后仍解锁、面板不收）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    await showUnlocked(ui);
    vi.useFakeTimers();
    try {
      document.dispatchEvent(new Event('pointerdown'));
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1000);
      expect(dm.unlocked).toBe(true);
      expect(ui.root!.style.display).toBe('flex');
    } finally {
      vi.useRealTimers();
    }
  });

  // ---------- S6 shownIds/mobpage 清理（N14/新-4，P2） ----------

  it('S6：上锁收移动详情页并清 shownIds——重解锁不明文直出', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'secret' });
    await showUnlocked(ui);
    // 进入移动详情页 + 点眼睛明文
    (document.querySelector('.bz-password-vault-mobcard') as HTMLElement).click();
    await flush();
    const page = document.querySelector('.bz-password-vault-mobpage') as HTMLElement;
    expect(page.classList.contains('open')).toBe(true);
    (document.querySelector('.bz-password-vault-mobbody [data-act="eye"]') as HTMLElement).click();
    await flush();
    expect((document.querySelector('.bz-password-vault-mobbody') as HTMLElement).textContent).toContain('secret');
    // 别域上锁 → 收页 + 清明文开关
    sm.lock();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('.bz-password-vault-lock.open [data-ls="p1"]').length).toBe(2)
    );
    expect(page.classList.contains('open')).toBe(false);
    // 重解锁 → 密码回掩码（修复前 shownIds 残留 → 明文直出）
    await sm.unlock('pw');
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-password-vault-lock.open').length).toBe(0));
    (document.querySelector('.bz-password-vault-mobcard') as HTMLElement).click();
    await flush();
    const body = document.querySelector('.bz-password-vault-mobbody') as HTMLElement;
    expect(body.querySelector('.pw')!.classList.contains('mask')).toBe(true);
    expect(body.textContent).not.toContain('secret');
  });

  it('S6b：hide 收移动详情页（页体与平台/账号记录复位，不跨 hide/show 残留）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'secret' });
    await showUnlocked(ui);
    (document.querySelector('.bz-password-vault-mobcard') as HTMLElement).click();
    await flush();
    expect(document.querySelector('.bz-password-vault-mobpage')!.classList.contains('open')).toBe(true);
    ui.hide();
    expect(document.querySelector('.bz-password-vault-mobpage')!.classList.contains('open')).toBe(false);
    expect((ui as any).mobPagePlatform).toBeNull();
    expect((ui as any).mobPageAccount).toBeNull();
    ui.show();
    await flush();
    expect(document.querySelector('.bz-password-vault-mobpage')!.classList.contains('open')).toBe(false);
  });

  // ---------- S7 renderAll 写盘摘除（func 新-6/ui 新-5，T12 对齐 encrypt，P2） ----------

  it('S7：renderAll 不再落盘 lock-stats；外部上锁路径恰好快照一次', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x', fav: true });
    await showUnlocked(ui);
    ui.renderAll(); // 高频重绘入口（搜索防抖/点眼/收藏全走它）
    await flush(80);
    expect(await readLockStats('password-vault')).toBeNull(); // 修复前每次 renderAll 落盘
    sm.lock();
    await waitForAsync(async () => (await readLockStats('password-vault')) !== null);
    const hit = await readLockStats('password-vault');
    expect(hit!.map((s) => s.num)).toEqual(['1', '1', '1']); // 锁前快照，真实统计非零值
  });

  // ---------- S8 密码错误单通知 + 冷却倒计时（N15/ui 新-7，P3） ----------

  it('S8：密码错误单条倒计时通知、冷却期按钮按住、归零复位；空输入错误自动消失', async () => {
    await sm.unlock('correct-pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    sm.lock();
    dm.pwData = [];
    ui.show();
    await vi.waitFor(() => expect(document.querySelector('.bz-password-vault-lock.open [data-ls="p1"]')).toBeTruthy());
    const lock = document.querySelector('.bz-password-vault-lock.open') as HTMLElement;
    const input = lock.querySelector('[data-ls="p1"]') as HTMLInputElement;
    const go = lock.querySelector('[data-ls="go"]') as HTMLButtonElement;
    const err = lock.querySelector('[data-ls="err"]') as HTMLElement;
    // 空输入错误 2600ms 自动消失（修复前清除条件 `if (input.value)` 恒不成立 → 错误永驻）
    go.click();
    await vi.waitFor(() => expect(err.textContent).toBe('请输入主密码'));
    await new Promise((r) => setTimeout(r, 2700));
    expect(err.textContent).toBe('');
    // 错误密码 → 单条倒计时通知（修复前「密码错误，请重试」+「N 秒后可再次尝试」两连发互顶且不倒数）
    input.value = 'wrong';
    go.click();
    await vi.waitFor(() => expect(err.textContent).toBe('密码错误，1 秒后可重试'));
    expect(go.disabled).toBe(true); // 冷却期按钮按住
    await new Promise((r) => setTimeout(r, 1200));
    expect(err.textContent).toBe(''); // 归零清错误
    expect(go.disabled).toBe(false); // 复位按钮
  }, 15000);

  // ---------- S9 eye 三件套复位（N13，P3） ----------

  it('S9：弹窗重开复位 eye 三件套——上次明文态不泄给新弹窗', async () => {
    await sm.unlock('pw');
    ui.show();
    await flush();
    ui.openEntryDialog(null);
    const dlg = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog') as HTMLElement;
    const input = dlg.querySelector('[data-f="password"]') as HTMLInputElement;
    const eye = dlg.querySelector('[data-act="pw-eye"]') as HTMLElement;
    eye.click();
    expect(input.type).toBe('text');
    // 关闭重开（含添加态：自动生成的新密码不得以明文示人）
    (dlg.querySelector('[data-act="cancel"]') as HTMLElement).click();
    ui.openEntryDialog(null);
    const dlg2 = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog') as HTMLElement;
    const input2 = dlg2.querySelector('[data-f="password"]') as HTMLInputElement;
    const eye2 = dlg2.querySelector('[data-act="pw-eye"]') as HTMLElement;
    expect(input2.type).toBe('password'); // 修复前仍 text
    expect(eye2.title).toBe('显示密码');
    // innerHTML 读取会把自闭合标签重序列化，比 path d 属性（eye 与 eyeoff 的判别特征）
    expect(eye2.querySelector('path')?.getAttribute('d')).toBe('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z');
  });

  // ---------- S10 防重入（func 新-4，P3） ----------

  it('S10a：保存双击防重入——整表重加密窗口期内只落一条', async () => {
    await sm.unlock('pw');
    ui.show();
    await flush();
    ui.openEntryDialog(null);
    const modal = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog') as HTMLElement;
    const set = (f: string, v: string) => ((modal.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value = v);
    set('platform', 'GitHub');
    set('account', 'me');
    set('password', 'p@ss');
    const spy = vi.spyOn(dm, 'addItem');
    const saveBtn = modal.querySelector('[data-act="save"]') as HTMLButtonElement;
    saveBtn.click();
    saveBtn.click(); // 第二击：按钮已 disabled + busy 旗标，不再入队
    await vi.waitFor(() => expect(saveBtn.disabled).toBe(false)); // 保存完成后复位
    expect(spy).toHaveBeenCalledTimes(1);
    expect(dm.pwData.length).toBe(1);
  });

  it('S10b：首设确认框打开期间动作钮 busy，取消后复位（防叠框连环 unlock）', async () => {
    ui.show(); // 无清单 → 首设态
    await vi.waitFor(() => expect(document.querySelector('.bz-password-vault-lock.open [data-ls="p1"]')).toBeTruthy());
    const lock = document.querySelector('.bz-password-vault-lock.open') as HTMLElement;
    (lock.querySelector('[data-ls="p1"]') as HTMLInputElement).value = 'abcd';
    (lock.querySelector('[data-ls="p2"]') as HTMLInputElement).value = 'abcd';
    (lock.querySelector('[data-ls="go"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    const go = lock.querySelector('[data-ls="go"]') as HTMLButtonElement;
    expect(go.disabled).toBe(true); // 确认框开着时动作钮 busy：修复前可反复点开叠加确认框
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(go.disabled).toBe(false)); // 取消后复位
    expect((lock.querySelector('[data-ls="err"]') as HTMLElement).textContent).toBe('已取消设置');
  });
});
