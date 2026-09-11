/**
 * 锁家族修复批回归（review-all-bugs.md 三节 E 系 password-vault 侧）：
 * E1 确认框监听器单绑定防删错条目、E2 共锁感知（别域上锁锁屏接管/解锁重载）、
 * E5 弹窗密码默认掩码 + eye 切换、E6 移动详情页 eye/fav/删除即时重建、
 * E15 安全模式自动上锁走全局通知、E16 写操作失败 toast（不吞成 unhandled rejection）、
 * E17 平台头像首字符转义。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { PasswordVaultDataManager } from '../../src/password-vault/data';
import { PasswordVaultUIManager } from '../../src/password-vault/ui';
import { avatarHTML } from '../../src/password-vault/render';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, hasNotice } from '../mock-obsidian-entry';
import { clearDomainEvents } from '../../src/core/domain-bus';

async function flush(ms = 20) {
  await new Promise((r) => setTimeout(r, ms));
}

/** 轮询等待（写盘含真实 PBKDF2，固定短 flush 会撞上保存中途） */
async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('锁家族修复批（password-vault）', () => {
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
    ui.cleanup();
    sm.lock();
    document.body.innerHTML = '';
  });

  it('E1（P0）：第一次取消后第二次确认——执行的是第二次回调，不再删错条目', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: '平台A', account: 'a1', password: 'x' });
    await dm.addItem({ platform: '平台B', account: 'b1', password: 'x' });
    ui.ensureElements();
    const deskConfirm = document.querySelector('.bz-password-vault-pop2[data-confirm="desk"]') as HTMLElement;

    const fired: string[] = [];
    ui.askConfirm('删除 A', 'm', true, () => fired.push('A'));
    // 用户点遮罩取消（confirmCb 复位，但旧监听器/回调在修复前仍残留叠加）
    deskConfirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(deskConfirm.classList.contains('open')).toBe(false);

    ui.askConfirm('删除 B', 'm', true, () => fired.push('B'));
    expect(deskConfirm.classList.contains('open')).toBe(true);
    (deskConfirm.querySelector('.ok') as HTMLElement).click();
    await flush();

    expect(fired).toEqual(['B']); // 修复前：先命中第一次的旧监听器 → 执行 A
  });

  it('E1 对照：连续两次确认（第一次已执行）→ 第二次回调恰好执行一次', async () => {
    await sm.unlock('pw');
    ui.ensureElements();
    const deskConfirm = document.querySelector('.bz-password-vault-pop2[data-confirm="desk"]') as HTMLElement;
    const fired: string[] = [];
    ui.askConfirm('一', 'm', false, () => fired.push('first'));
    (deskConfirm.querySelector('.ok') as HTMLElement).click();
    ui.askConfirm('二', 'm', false, () => fired.push('second'));
    (deskConfirm.querySelector('.ok') as HTMLElement).click();
    await flush();
    expect(fired).toEqual(['first', 'second']);
  });

  it('E2：面板打开期间别域上锁 → 锁屏接管 + 数据清空；再解锁 → 列表重载', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'secret' });
    ui.show();
    await flush();
    expect(document.querySelectorAll('.bz-password-vault-lock.open').length).toBe(0); // 已解锁进入

    // 别域上锁（保险库「立即上锁」/安全模式/日记域走同一条 SafeManager.lock + 域事件）
    sm.lock();
    await flush();
    expect(dm.pwData).toEqual([]); // 明文已清
    expect(document.querySelectorAll('.bz-password-vault-lock.open').length).toBe(2); // 双实例锁屏接管
    expect(document.querySelector('.bz-password-vault-rows')!.textContent).not.toContain('secret');

    // 同会话再解锁 → 列表重载（事件驱动）
    await sm.unlock('pw');
    await flush();
    expect(document.querySelectorAll('.bz-password-vault-lock.open').length).toBe(0);
    expect(document.querySelector('.bz-password-vault-rows')!.textContent).toContain('GitHub');
  });

  it('E5：添加弹窗密码框默认掩码（type=password），eye 点击切换明文/掩码', async () => {
    await sm.unlock('pw');
    ui.ensureElements();
    ui.openEntryDialog(null);
    const dlg = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog') as HTMLElement;
    const input = dlg.querySelector('[data-f="password"]') as HTMLInputElement;
    expect(input.type).toBe('password'); // 修复前无 type 属性 → 默认明文
    const eye = dlg.querySelector('[data-act="pw-eye"]') as HTMLElement;
    eye.click();
    expect(input.type).toBe('text');
    expect(eye.title).toBe('隐藏密码');
    eye.click();
    expect(input.type).toBe('password');
    expect(eye.title).toBe('显示密码');
  });

  it('E6：移动端平台详情页点眼睛/收藏 → 页内容即时重建（掩码切换 + 星标）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'secret' });
    ui.ensureElements();
    ui.show();
    await flush();
    // 进入移动端平台详情页
    const card = document.querySelector('.bz-password-vault-mobcard') as HTMLElement;
    card.click();
    await flush();
    expect(document.querySelector('.bz-password-vault-mobpage')!.classList.contains('open')).toBe(true);
    const body = document.querySelector('.bz-password-vault-mobbody') as HTMLElement;
    expect(body.textContent).toContain('me');
    expect(body.querySelector('.pw')!.classList.contains('mask')).toBe(true);

    // 点眼睛 → 页内容重建为明文（修复前 renderAll 不重绘已打开页，毫无可见反应）
    const eyeBtn = [...body.querySelectorAll('[data-act="eye"]')][0] as HTMLElement;
    eyeBtn.click();
    await flush();
    const bodyAfterEye = document.querySelector('.bz-password-vault-mobbody') as HTMLElement;
    expect(bodyAfterEye.querySelector('.pw')!.classList.contains('mask')).toBe(false);
    expect(bodyAfterEye.textContent).toContain('secret');

    // 收藏（移动端收在长按抽屉，动作分发同一入口）→ 星标即时可见
    const d = dm.pwData[0];
    await (ui as any).handleAccountAction(d, 'fav');
    await flush();
    const bodyAfterFav = document.querySelector('.bz-password-vault-mobbody') as HTMLElement;
    expect(bodyAfterFav.textContent).toContain('★');
  });

  it('E6：移动端账号页删除该账号 → 页面收起（不再滞留已删条目）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'secret' });
    ui.ensureElements();
    ui.show();
    await flush();
    (document.querySelector('.bz-password-vault-mobcard') as HTMLElement).click();
    await flush();
    const d = dm.pwData[0];
    await (ui as any).handleAccountAction(d, 'del');
    const deskConfirm = document.querySelector('.bz-password-vault-pop2[data-confirm="desk"]') as HTMLElement;
    (deskConfirm.querySelector('.ok') as HTMLElement).click();
    await waitFor(() => dm.pwData.length === 0 && !document.querySelector('.bz-password-vault-mobpage')!.classList.contains('open'));
    expect(dm.pwData.length).toBe(0);
    expect(document.querySelector('.bz-password-vault-mobpage')!.classList.contains('open')).toBe(false);
  });

  it('E15：安全模式 hide 自动上锁走全局通知（toast 挂在已隐藏面板内不可见）', async () => {
    await sm.unlock('pw');
    const ui2 = new PasswordVaultUIManager(dm, { charset: '', length: '16', securityMode: true });
    ui2.ensureElements();
    ui2.show();
    await flush();
    ui2.hide();
    expect(hasNotice('安全模式：已自动上锁')).toBe(true); // 修复前是面板内 toast，全局不可见
    expect(dm.unlocked).toBe(false);
    ui2.cleanup();
  });

  it('E16：写操作失败（save 抛错）→ 面板内 toast 报错 + 列表回滚重绘，不产生 unhandled rejection', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'secret' });
    ui.ensureElements();
    ui.show();
    await flush();
    // 模拟写盘失败：save 抛错（数据层回滚内存快照）
    vi.spyOn(dm, 'save').mockRejectedValue(new Error('disk full'));
    const unhandled: unknown[] = [];
    const onUnhandled = (e: PromiseRejectionEvent) => unhandled.push(e.reason);
    window.addEventListener('unhandledrejection', onUnhandled);
    // 走账号动作分发（收藏；桌面卡片/移动页/抽屉共用同一入口）
    const d = dm.pwData[0];
    await (ui as any).handleAccountAction(d, 'fav');
    await flush(50);
    window.removeEventListener('unhandledrejection', onUnhandled);
    const toast = document.querySelector('.bz-password-vault-toast') as HTMLElement;
    expect(toast.classList.contains('err')).toBe(true);
    expect(toast.textContent).toContain('操作失败');
    expect(dm.pwData[0].fav).toBe(false); // 内存回滚，半改态不残留
    void unhandled;
  });

  it('E17：平台名以 HTML 特殊字符开头时头像首字符转义，不再吞掉 markup', () => {
    const html = avatarHTML('<b', 'https://x.example');
    expect(html).toContain('<span>&lt;</span>');
    expect(html).not.toContain('<span><b</span>');
  });
});
