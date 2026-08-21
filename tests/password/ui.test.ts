/**
 * 密码本 UI 测试（合并至保险箱）：解锁统一走保险箱主密码弹窗（共享解锁态）、
 * 面板渲染/搜索/👁 切换/复制、数据读写经 password-vault 条目、生成器。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { PasswordAppController, UIManager } from '../../src/password/ui';
import { DataManager } from '../../src/password/data';
import { EncryptAppController } from '../../src/encrypt/ui';
import { getSafeManager } from '../../src/encrypt';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';

/** 轮询等待（并行高负载下真实 setTimeout 等待不足，轮询至条件满足） */
async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const CONFIG = { charset: 'abc123', length: '8', securityMode: false };

function setup(vault: MockVault) {
  setApp({ vault, metadataCache: { getFileCache: () => null, trigger: () => {} } } as any);
  setSettingsProvider(() => CONFIG as any);
  resetObsidianMocks();
}

/** 重置两个域的单例（密码本/保险箱共享解锁态，防跨测试污染） */
function resetControllers() {
  PasswordAppController.instance?.cleanup();
  PasswordAppController.instance = null;
  EncryptAppController.instance?.cleanup();
  EncryptAppController.instance = null;
}

describe('UIManager 主密码流程（统一走保险箱弹窗）', () => {
  let vault: MockVault;
  let dm: DataManager;
  let ui: UIManager;

  beforeEach(() => {
    vault = new MockVault();
    setup(vault);
    document.body.innerHTML = '';
    dm = new DataManager(); // 缺省单例 = getSafeManager（与保险箱同一解锁态）
    ui = new UIManager(dm, { charset: 'abc123', length: '8', securityMode: false });
    ui.ensureElements();
  });

  afterEach(() => {
    vi.useRealTimers();
    ['pw-mask', 'pw-popup', 'pw-add-mask', 'pw-add-popup'].forEach((id) => {
      document.getElementById(id)?.remove();
    });
    document.body.innerHTML = '';
    resetControllers();
  });

  function findPasswordDialog(): HTMLElement | null {
    // 保险箱主密码弹窗（zIndex 10070、flex 布局）
    return [...document.querySelectorAll('div')].find(
      (d) => d.style.zIndex === '10070' && d.style.display === 'flex'
    ) as HTMLElement | null;
  }

  it('首次打开（保险箱未设密码）：标题「设置主密码」+ 再次输入确认 + 警告', async () => {
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findPasswordDialog());
    const dialog = findPasswordDialog()!;
    expect(dialog.textContent).toContain('设置主密码');
    expect(dialog.textContent).toContain('请设置一个主密码（用于加密所有数据）');
    expect(dialog.textContent).toContain('重要提醒');
    const inputs = dialog.querySelectorAll('input[type="password"]');
    expect(inputs.length).toBe(2); // 密码 + 再次输入（首次设置模式已显示）

    // 两次不一致 → 「两次密码不一致」
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'master123';
    (inputs[1] as HTMLInputElement).value = 'other';
    confirmBtn.click();
    expect(hasNotice('两次密码不一致')).toBe(true);

    // 一致 → 设置成功（保险箱清单创建，无独立 passwords.enc）
    (inputs[1] as HTMLInputElement).value = 'master123';
    // 硬警告（补丁1）：未勾选风险确认拒绝设置
    const ackBox = dialog.querySelector('.bz-encrypt-dialog-ack input') as HTMLInputElement;
    expect(ackBox).toBeTruthy();
    (ackBox as HTMLInputElement).checked = true;
    confirmBtn.click();
    await p;
    expect(dm.unlocked).toBe(true);
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc')).toBe(true);
    expect(vault.files.has('CONFIG/STORAGE/passwords.enc')).toBe(false);
    expect(hasNotice('密码已设置，数据已加密')).toBe(true);
  });

  it('再次打开（已设密码）：标题「输入主密码」解锁流程', async () => {
    // 先设好保险箱主密码
    await getSafeManager().unlock('master123');
    getSafeManager().lock();
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findPasswordDialog());
    const dialog = findPasswordDialog()!;
    expect(dialog.textContent).toContain('输入主密码');
    expect(dialog.textContent).toContain('请输入您设置的主密码以解锁保险箱');
    // 解锁模式：再次输入框隐藏
    const inputs = dialog.querySelectorAll('input[type="password"]');
    expect(inputs.length).toBe(2); // 元素仍在 DOM
    expect((inputs[1] as HTMLInputElement).style.display).toBe('none'); // 解锁模式隐藏再次输入

    // 错误密码 → 「密码错误，请重试」
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'wrong';
    confirmBtn.click();
    await new Promise((r) => setTimeout(r, 300));
    expect(dm.unlocked).toBe(false);
    expect(hasNotice('密码错误，请重试')).toBe(true);

    // 正确密码 → 解锁成功
    (inputs[0] as HTMLInputElement).value = 'master123';
    confirmBtn.click();
    await p;
    expect(dm.unlocked).toBe(true);
    expect(hasNotice('解锁成功')).toBe(true);
  });

  it('安全模式：关闭面板整体上锁（保险箱与密码本同步）', async () => {
    const dm2 = new DataManager();
    const ui2 = new UIManager(dm2, { charset: 'abc', length: '8', securityMode: true });
    ui2.ensureElements();
    await getSafeManager().unlock('pw');
    ui2.show();
    expect(dm2.unlocked).toBe(true);
    ui2.hide();
    expect(dm2.unlocked).toBe(false);
    expect(getSafeManager().unlocked).toBe(false); // 整体上锁
    expect(hasNotice('安全模式：已自动上锁')).toBe(true);
  });

  it('⚙️ 设置弹窗：字符集/生成长度/安全模式', async () => {
    const dm2 = new DataManager();
    const ui2 = new UIManager(dm2, { charset: 'abc', length: '8', securityMode: false });
    ui2.ensureElements();
    setSettingsProvider(() => ({
      passwordCharset: 'abc', passwordLength: '8', securityMode: false,
    }) as any);
    await getSafeManager().unlock('pw');
    ui2.show();
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '密码本设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('密码本设置');
    const names = [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    expect(names).toEqual(['密码生成字符集', '密码生成长度', '安全模式']);
  });
});

describe('UIManager 面板与条目', () => {
  let vault: MockVault;
  let dm: DataManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    document.body.innerHTML = '';
    dm = new DataManager();
    ui = new UIManager(dm, { charset: 'abc123', length: '8', securityMode: false });
    ui.ensureElements();
    await getSafeManager().unlock('pw');
    await dm.addItem({ platform: 'GitHub', url: 'https://github.com', account: 'alice', password: 'secret1', note: '主账号' });
    await dm.addItem({ platform: 'Gmail', account: 'bob', password: 'secret2', note: '' } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.getElementById('pw-mask')?.remove();
    document.getElementById('pw-popup')?.remove();
    document.getElementById('pw-add-mask')?.remove();
    document.getElementById('pw-add-popup')?.remove();
    resetControllers();
  });

  it('show 渲染条目卡片（平台/账号/掩码密码/👁）', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const container = document.getElementById('pw-entries-container')!;
    const cards = container.querySelectorAll('.pw-entry-card');
    expect(cards.length).toBe(2);
    expect(container.textContent).toContain('GitHub');
    expect(container.textContent).toContain('alice');
    // 密码掩码（• 数量 = 密码长度，secret1=7 位）
    expect(container.textContent).toContain('•'.repeat(7));
    expect(container.textContent).not.toContain('secret1');
  });

  it('👁 切换明文/掩码', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const container = document.getElementById('pw-entries-container')!;
    const eye = container.querySelector('.pw-eye') as HTMLElement;
    eye.click();
    expect(container.textContent).toContain('secret2'); // 首卡 Gmail（后添加在前）
    eye.click();
    expect(container.textContent).not.toContain('secret2');
  });

  it('搜索过滤：输入关键词实时过滤', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    ui.searchInput!.value = 'gmail';
    ui.searchInput!.dispatchEvent(new Event('input'));
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 1);
    const container = document.getElementById('pw-entries-container')!;
    expect(container.querySelectorAll('.pw-entry-card').length).toBe(1);
    expect(container.textContent).toContain('Gmail');
  });

  it('添加弹窗：保存新条目（含生成按钮）', async () => {
    ui.openAddDialog();
    const popup = document.getElementById('pw-add-popup')!;
    expect(popup.style.display).toBe('block');
    expect(popup.textContent).toContain('添加密码条目');

    ui._platformInput.value = 'Twitter';
    ui._accountInput.value = 'jack';
    ui._passwordInput.value = 'tw123';
    ui._noteTextarea.value = '备用';
    const saveBtn = [...popup.querySelectorAll('button')].find((b) => b.textContent === '保存')!;
    saveBtn.click();
    await waitFor(() => dm.pwData.length === 3 && hasNotice('已保存'));
    expect(dm.pwData.length).toBe(3);
    expect(hasNotice('已保存')).toBe(true);
  });

  it('平台为空 → 「平台不能为空」；账号密码空 → 提示', async () => {
    ui.openAddDialog();
    const popup = document.getElementById('pw-add-popup')!;
    const saveBtn = [...popup.querySelectorAll('button')].find((b) => b.textContent === '保存')!;
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('平台不能为空')).toBe(true);

    ui._platformInput.value = 'X';
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('账号和密码不能为空')).toBe(true);
  });

  it('generatePassword：长度与字符集', () => {
    expect(ui.generatePassword().length).toBe(8);
    const pwd = ui.generatePassword();
    expect([...pwd].every((c) => 'abc123'.includes(c))).toBe(true);
  });

  it('长按日期 → 删除确认 → 确认删除', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2); // 真实等待 PBKDF2 解密渲染
    vi.useFakeTimers();
    const container = document.getElementById('pw-entries-container')!;
    const dateSpan = container.querySelector('.pw-date') as HTMLElement;
    dateSpan.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    vi.advanceTimersByTime(550);
    const confirmMask = document.getElementById('__shared_confirm_mask__');
    expect(confirmMask).not.toBeNull();
    expect(confirmMask!.textContent).toContain('删除密码条目');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(50);
    expect(dm.pwData.length).toBe(1);
    vi.useRealTimers();
  });

  it('长按密码区域 → 编辑弹窗', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2); // 真实等待 PBKDF2 解密渲染
    vi.useFakeTimers();
    const container = document.getElementById('pw-entries-container')!;
    const pwArea = container.querySelector('.pw-password-area') as HTMLElement;
    pwArea.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    vi.advanceTimersByTime(550);
    const popup = document.getElementById('pw-add-popup')!;
    expect(popup.style.display).toBe('block');
    expect(popup.textContent).toContain('编辑密码条目');
    expect(ui._platformInput.value).toBe('Gmail'); // 首卡 Gmail
    vi.useRealTimers();
  });
});

describe('PasswordAppController 命令', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setup(vault);
  });

  afterEach(() => {
    resetControllers();
    // 部分测试污染
    for (const id of ['pw-mask', 'pw-popup', 'pw-add-mask', 'pw-add-popup']) {
      document.getElementById(id)?.remove();
    }
    document.body.innerHTML = '';
  });

  it('generatePassword：复制 + 暂存（pendingPassword）', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    const c = PasswordAppController.getInstance({ charset: 'abc123', length: '8', securityMode: false });
    await c.init();
    c.generatePassword();
    expect(c.uiManager.pendingPassword).toBeTruthy();
    expect(hasNotice(/密码已暂存/)).toBe(true);
  });

  it('未解锁时 addEntry → 「请先解锁密码本（打开管理器）」', async () => {
    const c = PasswordAppController.getInstance({ charset: 'abc', length: '8', securityMode: false });
    await c.init();
    c.addEntry();
    expect(hasNotice('请先解锁密码本（打开管理器）')).toBe(true);
  });
});