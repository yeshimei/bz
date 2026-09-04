/**
 * 保险库增强包·UI 层回归（encrypt 域）：
 * 快速取密路径（解锁直落密码资产 + 记住停留资产 + 搜索聚焦 + bz-encrypt-copy-password 选择器）、
 * 密码表单效率（强度提示/同平台账号查重二次放行/Enter 流转）、防偷看（表单 eye/账号卡 15s 自动回遮）、
 * 体检状态真实化（健康卡读真实状态 + 点直达体检）、解锁会话可见性（已解锁时长 + 安全模式 15min 无交互上锁）、
 * 流程三小修（锁定态加密笔记先解锁/还原冲突列路径/概览搜索生效）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { UIManager, EncryptAppController } from '../../src/encrypt/ui';
import { PasswordVaultDataManager } from '../../src/encrypt/vault-data';
import { closePasswordQuickPicker } from '../../src/encrypt/pw-picker';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';

async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const CONFIG = {
  root: 'CONFIG/.ENCRYPT',
  previewEnabled: false,
  previewSize: 384,
  previewQuality: 0.5,
  autoLoadOriginal: false,
  securityMode: false,
  pwCharset: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+',
  pwLength: '16',
};

describe('保险库增强包（UIManager / Controller）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: UIManager;

  beforeEach(async () => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => CONFIG as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    dm = new PasswordVaultDataManager(sm);
    ui = new UIManager(sm, CONFIG, dm);
    await sm.unlock('pw');
  });

  afterEach(() => {
    closePasswordQuickPicker();
    ui.popup?.remove();
    ui.mask?.remove();
    sm.lock();
    document.body.innerHTML = '';
  });

  function gotoPwAsset() {
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find(
      (i) => i.getAttribute('data-asset') === 'pw'
    ) as HTMLElement;
    pwItem.click();
  }

  function openEntryDialog() {
    ui.show();
    return waitFor(() => !!document.querySelector('.bz-vault-nav')).then(() => {
      gotoPwAsset();
      return waitFor(() => !!document.querySelector('.bz-vault-lc-head [data-lc-add="pw"]')).then(() => {
        (document.querySelector('.bz-vault-lc-head [data-lc-add="pw"]') as HTMLElement).click();
        return waitFor(() => !!document.querySelector('.bz-vault-dlg'));
      });
    });
  }

  // ---------- 1 快速取密路径 ----------
  it('解锁成功后直落密码资产并聚焦搜索框；下次打开直落上次停留资产', async () => {
    const c = new EncryptAppController({ ...CONFIG });
    try {
      await c.init();
      await c.dataManager.unlock('pw'); // 首设清单（避免首设双输入流程）
      c.dataManager.lock();
      // 锁定 → 密码弹窗 → 解锁
      const run = c.openManager();
      await waitFor(() => !!document.querySelector('.bz-encrypt-dialog-mask'));
      const mask = document.querySelector('.bz-encrypt-dialog-mask') as HTMLElement;
      (mask.querySelector('input.bz-encrypt-dialog-input') as HTMLInputElement).value = 'pw';
      (mask.querySelector('.bz-encrypt-dialog-btn--primary') as HTMLElement).click();
      await run;
      expect(c.uiManager.mask!.style.display).toBe('block');
      // 直落密码资产 + 搜索框聚焦
      const onItem = document.querySelector('.bz-vault-nav .bz-vault-item.on') as HTMLElement;
      expect(onItem.getAttribute('data-asset')).toBe('pw');
      const search = document.querySelector('[data-vault-search]') as HTMLInputElement;
      expect(document.activeElement).toBe(search);
      // 切到加密笔记 → 关面板 → 再开（已解锁）→ 直落上次停留资产
      const noteItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find(
        (i) => i.getAttribute('data-asset') === 'note'
      ) as HTMLElement;
      noteItem.click();
      c.uiManager.hide();
      await c.openManager();
      const onItem2 = document.querySelector('.bz-vault-nav .bz-vault-item.on') as HTMLElement;
      expect(onItem2.getAttribute('data-asset')).toBe('note');
    } finally {
      c.cleanup();
      EncryptAppController.instance = null;
    }
  });

  it('bz-encrypt-copy-password：quickCopyPassword 弹轻量选择器（不打开主面板），搜索过滤 + Enter 复制并 60s 自动清空', async () => {
    const c = new EncryptAppController({ ...CONFIG });
    try {
      await c.init();
      await c.dataManager.unlock('pw');
      await c.uiManager.pwDataManager.addItem({ platform: 'GitHub', account: 'me@x', password: 's3cret' });
      await c.uiManager.pwDataManager.addItem({ platform: '微信', account: 'wx', password: 'pwx' });
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined as any);
      const run = c.quickCopyPassword();
      await waitFor(() => !!document.getElementById('bz-encrypt-pw-picker-popup'));
      // 不解锁主面板
      expect(c.uiManager.mask!.style.display).not.toBe('block');
      // fuzzy 搜索过滤：'gt' 子序列命中 GitHub
      const search = document.querySelector('.bz-encrypt-pwqp-search') as HTMLInputElement;
      search.value = 'gt';
      search.dispatchEvent(new Event('input'));
      await waitFor(() => document.querySelectorAll('.bz-encrypt-pwqp-row').length === 1);
      expect(document.querySelector('.bz-encrypt-pwqp-row .pl')!.textContent).toBe('GitHub');
      // Enter 复制（60s 自动清空由 armClipboardClear 承担）
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await run;
      expect(writeText).toHaveBeenCalledWith('s3cret');
      await waitFor(() => hasNotice('已复制「GitHub」（me@x）的密码，60 秒后自动清空'));
      expect(document.getElementById('bz-encrypt-pw-picker-popup')).toBeNull();
    } finally {
      c.cleanup();
      EncryptAppController.instance = null;
    }
  });

  it('bz-encrypt-copy-password：空库提示且不弹选择器', async () => {
    const c = new EncryptAppController({ ...CONFIG });
    try {
      await c.init();
      await c.dataManager.unlock('pw');
      await c.quickCopyPassword();
      expect(document.getElementById('bz-encrypt-pw-picker-popup')).toBeNull();
      await waitFor(() => hasNotice('保险库还没有密码，打开面板后可新增'));
    } finally {
      c.cleanup();
      EncryptAppController.instance = null;
    }
  });

  // ---------- 2 密码表单效率 ----------
  it('密码框强度提示：生成密码=强，输入弱密码=弱（纯本地联动）', async () => {
    await openEntryDialog();
    const dlg = document.querySelector('.bz-vault-dlg') as HTMLElement;
    const pwInput = dlg.querySelector('[data-f="password"]') as HTMLInputElement;
    const strength = dlg.querySelector('[data-pw-strength]') as HTMLElement;
    // 生成密码（16 位混合字符集）= 强
    expect(strength.textContent).toBe('强度：强');
    expect(strength.dataset.level).toBe('strong');
    // 输入弱密码 → 弱
    pwInput.value = 'abc';
    pwInput.dispatchEvent(new Event('input'));
    expect(strength.textContent).toBe('强度：弱');
    expect(strength.dataset.level).toBe('weak');
  });

  it('保存前同平台+账号查重：命中提示「该平台已有同名账号」，再点一次放行', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    await openEntryDialog();
    const dlg = document.querySelector('.bz-vault-dlg') as HTMLElement;
    const set = (f: string, v: string) => {
      (dlg.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value = v;
    };
    set('platform', 'GitHub');
    set('account', 'me');
    set('password', 'other');
    const save = dlg.querySelector('[data-pwv-dlg="save"]') as HTMLButtonElement;
    save.click();
    const err = dlg.querySelector('[data-f-err]') as HTMLElement;
    await waitFor(() => err.textContent!.includes('该平台已有同名账号'));
    expect(dm.pwData.length).toBe(1); // 未落盘
    // 再点一次 → 放行
    save.click();
    await waitFor(() => dm.pwData.length === 2);
  });

  it('Enter 流转：平台→链接→账号→密码→备注，末字段 Enter=保存', async () => {
    await openEntryDialog();
    const dlg = document.querySelector('.bz-vault-dlg') as HTMLElement;
    const f = (name: string) => dlg.querySelector(`[data-f="${name}"]`) as HTMLInputElement;
    f('platform').focus();
    f('platform').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(document.activeElement).toBe(f('url'));
    f('url').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(document.activeElement).toBe(f('account'));
    f('account').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(document.activeElement).toBe(f('password'));
    f('password').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(document.activeElement).toBe(f('note'));
    // 填齐必填后，末字段 Enter 触发保存
    f('platform').value = '豆瓣';
    f('account').value = 'me@douban';
    f('note').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await waitFor(() => dm.pwData.length === 1);
    expect(dm.pwData[0].platform).toBe('豆瓣');
  });

  // ---------- 3 防偷看 ----------
  it('弹窗密码框默认 type=password，eye 切换明文/掩码', async () => {
    await openEntryDialog();
    const dlg = document.querySelector('.bz-vault-dlg') as HTMLElement;
    const pwInput = dlg.querySelector('[data-f="password"]') as HTMLInputElement;
    expect(pwInput.type).toBe('password');
    const eye = dlg.querySelector('[data-pwv-dlg="eye"]') as HTMLElement;
    eye.click();
    expect(pwInput.type).toBe('text');
    expect(eye.title).toBe('隐藏密码');
    eye.click();
    expect(pwInput.type).toBe('password');
  });

  it('账号卡明文 ~15 秒自动回遮；手动提前隐藏即撤计时', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 's3cret!' });
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-nav'));
    gotoPwAsset();
    await waitFor(() => !!document.querySelector('.bz-vault-lc-body .bz-pwv-plrow'));
    (document.querySelector('.bz-vault-lc-body .bz-pwv-plrow') as HTMLElement).click();
    await waitFor(() => !!document.querySelector('.bz-vault-detail .bz-pwv-acctcard'));
    vi.useFakeTimers();
    try {
      const eye = document.querySelector('.bz-vault-detail [data-pwv="eye"]') as HTMLElement;
      eye.click();
      let pw = document.querySelector('.bz-vault-detail .bz-pwv-acctcard .pw') as HTMLElement;
      expect(pw.classList.contains('mask')).toBe(false);
      expect(pw.textContent).toBe('s3cret!');
      // 15s 后自动回遮
      await vi.advanceTimersByTimeAsync(15_000);
      pw = document.querySelector('.bz-vault-detail .bz-pwv-acctcard .pw') as HTMLElement;
      expect(pw.classList.contains('mask')).toBe(true);
      // 再次显示后手动隐藏 → 计时撤销，不再自动改变
      const eye2 = document.querySelector('.bz-vault-detail [data-pwv="eye"]') as HTMLElement;
      eye2.click();
      const eye3 = document.querySelector('.bz-vault-detail [data-pwv="eye"]') as HTMLElement;
      eye3.click();
      await vi.advanceTimersByTimeAsync(30_000);
      pw = document.querySelector('.bz-vault-detail .bz-pwv-acctcard .pw') as HTMLElement;
      expect(pw.classList.contains('mask')).toBe(true); // 手动隐藏后保持掩码
    } finally {
      vi.useRealTimers();
    }
  });

  // ---------- 4 体检状态真实化 ----------
  it('左栏健康卡读真实体检状态（未体检/通过/N 个待处理），点击直达体检', async () => {
    ui.show();
    await waitFor(() => !!document.querySelector('[data-health-d]'));
    const hd = document.querySelector('[data-health-d]') as HTMLElement;
    const dot = document.querySelector('.bz-vault-health .okdot') as HTMLElement;
    // 未体检（不再恒「健康」/硬编码绿点）
    expect(hd.textContent).toContain('未体检');
    expect(dot.style.background).toContain('faint');
    // 体检通过
    ui.lastHealth = { issues: 0, lastChecked: '2026/09/04 12:00' };
    ui.renderAll();
    expect(hd.textContent).toContain('体检通过');
    expect(dot.style.background).toContain('ok');
    // 有待处理
    ui.lastHealth = { issues: 3, lastChecked: '2026/09/04 12:00' };
    ui.renderAll();
    expect(hd.textContent).toContain('3 个待处理');
    expect(dot.style.background).toContain('warn');
    // 点击健康卡直达体检
    ui.lastHealth = null;
    ui.renderAll();
    (document.querySelector('[data-act="health-card"]') as HTMLElement).click();
    await waitFor(() => document.getElementById('bz-encrypt-health-mask')!.style.display === 'flex');
  });

  it('概览体检卡读真实状态且整卡可点直达体检', async () => {
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-detail > .bz-vault-area'));
    // 面板卡（非 hero 顶栏按钮）挂 data-hero="health"：整卡可点
    const q = () => document.querySelector('.bz-vault-detail .bz-vault-two .panel[data-hero="health"]') as HTMLElement;
    const panel = q();
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain('未体检');
    ui.lastHealth = { issues: 2, lastChecked: '2026/09/04 12:00' };
    ui.renderAll();
    expect(q().textContent).toContain('2');
    q().click();
    await waitFor(() => document.getElementById('bz-encrypt-health-mask')!.style.display === 'flex');
  });

  // ---------- 5 解锁会话可见性 ----------
  it('左栏「立即上锁」旁显示已解锁时长（mm:ss）', async () => {
    ui.show();
    await waitFor(() => !!document.querySelector('[data-unlock-dur]'));
    const dur = document.querySelector('[data-unlock-dur]') as HTMLElement;
    expect(dur.textContent).toMatch(/^\d{2}:\d{2}$/);
    // 上锁后清空
    ui.lockNow();
    expect(dm.unlocked).toBe(false);
    expect(dur.textContent).toBe('');
  });

  it('安全模式 15 分钟无面板交互自动上锁；面板内交互重置计时', async () => {
    const cfg = { ...CONFIG, securityMode: true };
    const ui2 = new UIManager(sm, cfg, dm);
    ui2.show();
    await new Promise((r) => setTimeout(r, 30));
    vi.useFakeTimers();
    try {
      // 交互重置：14 分钟时交互一次 → 再 14 分钟仍解锁
      ui2.popup!.dispatchEvent(new Event('pointerdown'));
      await vi.advanceTimersByTimeAsync(14 * 60 * 1000);
      expect(sm.unlocked).toBe(true);
      ui2.popup!.dispatchEvent(new Event('pointerdown'));
      await vi.advanceTimersByTimeAsync(14 * 60 * 1000);
      expect(sm.unlocked).toBe(true);
      // 累计满 15 分钟无交互 → 自动上锁（面板收起 + 通知；虚拟时间停在此刻，通知仍存活）
      await vi.advanceTimersByTimeAsync(1 * 60 * 1000);
      expect(sm.unlocked).toBe(false);
      expect(ui2.popup!.style.display).toBe('none');
      expect(hasNotice('安全模式：15 分钟无操作，已自动上锁')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
    ui2.popup?.remove();
    ui2.mask?.remove();
  });

  // ---------- 6 流程三小修 ----------
  it('锁定态点「加密当前笔记」：先弹解锁，成功后继续原操作（确认框出现）', async () => {
    vault.files.set('我的/N.md', '正文');
    const app = mockAppWithVault(vault);
    app.workspace.getActiveFile = () => vault.file('我的/N.md');
    setApp(app as any);
    const c = new EncryptAppController({ ...CONFIG });
    try {
      await c.init();
      await c.dataManager.unlock('pw'); // 首设清单
      c.dataManager.lock();
      const run = c.lockCurrentNote();
      // 先弹解锁（而非只提示）
      await waitFor(() => !!document.querySelector('.bz-encrypt-dialog-mask'));
      const mask = document.querySelector('.bz-encrypt-dialog-mask') as HTMLElement;
      (mask.querySelector('input.bz-encrypt-dialog-input') as HTMLInputElement).value = 'pw';
      (mask.querySelector('.bz-encrypt-dialog-btn--primary') as HTMLElement).click();
      // 解锁成功 → 继续原操作：出现「加密到保险库」确认框
      await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
      expect(c.dataManager.unlocked).toBe(true);
      // 取消确认 → 不加密
      (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
      await run;
      expect(c.dataManager.manifest.notes.length).toBe(0);
    } finally {
      c.cleanup();
      EncryptAppController.instance = null;
    }
  });

  it('还原冲突：通知列出具体冲突路径', async () => {
    await sm.lockNote({
      path: '我的/N.md',
      title: 'N',
      content: '正文',
      attachments: [{ path: '我的/影视/pic.png', kind: 'image', data: 'QUJD' }],
    });
    // 原路径被用户文件占用（内容不同 → 冲突）
    vault.files.set('我的/N.md', '用户自己的文件');
    vault.binaryFiles.set('我的/影视/pic.png', new Uint8Array([9, 9]));
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-nav'));
    ui.confirmRestore(sm.manifest.notes[0]);
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await waitFor(() => getNoticeMessages().some((m) => m.includes('还原中止')));
    const msg = getNoticeMessages().find((m) => m.includes('还原中止'))!;
    expect(msg).toContain('我的/N.md');
    expect(msg).toContain('pic.png');
    expect(sm.manifest.notes.length).toBe(1); // 条目保留
  });

  it('概览页搜索框生效：输入自动切到密码结果', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    await dm.addItem({ platform: '微信', account: 'wx', password: 'y' });
    ui.show(); // 默认概览
    await waitFor(() => !!document.querySelector('.bz-vault-detail > .bz-vault-area'));
    expect(ui.asset).toBe('overview');
    const search = document.querySelector('[data-vault-search]') as HTMLInputElement;
    search.value = 'GitHub';
    search.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250)); // 防抖
    expect(ui.asset).toBe('pw');
    await waitFor(() => document.querySelectorAll('.bz-vault-listcol .bz-pwv-row').length === 1);
    expect(document.querySelector('.bz-vault-listcol .bz-pwv-row .pl')!.textContent).toContain('GitHub');
  });
});
