/**
 * 密码本 UI 测试（Route C 平台聚合重构）：
 * 解锁统一走保险箱主密码弹窗（共享解锁态）、
 * 平台聚合渲染/搜索/收藏/展开、数据读写经 password-vault 条目、生成器。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { PasswordAppController, UIManager, secureRandomPassword, copySensitiveText, passwordSettingsSchema } from '../../src/password/ui';
import { DataManager } from '../../src/password/data';
import { EncryptAppController } from '../../src/encrypt/ui';
import { getSafeManager } from '../../src/encrypt';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, Platform } from '../mock-obsidian-entry';
import { closeItemMenu } from '../../src/core/item-actions';
import { openSettingsModal, closeSettingsModal } from '../../src/core/settings-modal';

/** 轮询等待 */
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

/** 重置两个域的单例 */
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
    dm = new DataManager();
    ui = new UIManager(dm, { charset: 'abc123', length: '8', securityMode: false });
    ui.ensureElements();
  });

  afterEach(() => {
    vi.useRealTimers();
    // 清理注入的 DOM
    if (ui.root && ui.root.parentNode) ui.root.remove();
    if (ui.addMask && ui.addMask.parentNode) ui.addMask.remove();
    if (ui.platMask && ui.platMask.parentNode) ui.platMask.remove();
    document.body.innerHTML = '';
    Platform.isMobile = false;
    closeItemMenu();
    resetControllers();
  });

  function findPasswordDialog(): HTMLElement | null {
    return [...document.querySelectorAll('div')].find(
      (d) => d.classList.contains('bz-encrypt-dialog-mask') && d.style.display === 'flex'
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
    expect(inputs.length).toBe(2);

    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'master123';
    (inputs[1] as HTMLInputElement).value = 'other';
    confirmBtn.click();
    expect(hasNotice('两次密码不一致')).toBe(true);

    (inputs[1] as HTMLInputElement).value = 'master123';
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
    await getSafeManager().unlock('master123');
    getSafeManager().lock();
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findPasswordDialog());
    const dialog = findPasswordDialog()!;
    expect(dialog.textContent).toContain('输入主密码');
    expect(dialog.textContent).toContain('请输入您设置的主密码以解锁保险箱');
    const inputs = dialog.querySelectorAll('input[type="password"]');
    expect(inputs.length).toBe(2);
    expect((inputs[1] as HTMLInputElement).style.display).toBe('none');

    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'wrong';
    confirmBtn.click();
    await new Promise((r) => setTimeout(r, 300));
    expect(dm.unlocked).toBe(false);
    expect(hasNotice('密码错误，请重试')).toBe(true);
    expect(hasNotice(/1 秒后可再次尝试/)).toBe(true);

    await new Promise((r) => setTimeout(r, 1100));
    (inputs[0] as HTMLInputElement).value = 'master123';
    confirmBtn.click();
    await p;
    expect(dm.unlocked).toBe(true);
    expect(hasNotice('解锁成功')).toBe(true);
  }, 15000);

  it('安全模式：关闭面板整体上锁（保险箱与密码本同步）', async () => {
    const dm2 = new DataManager();
    const ui2 = new UIManager(dm2, { charset: 'abc', length: '8', securityMode: true });
    ui2.ensureElements();
    await getSafeManager().unlock('pw');
    ui2.show();
    expect(dm2.unlocked).toBe(true);
    ui2.hide();
    expect(dm2.unlocked).toBe(false);
    expect(getSafeManager().unlocked).toBe(false);
    expect(hasNotice('安全模式：已自动上锁')).toBe(true);
  });

  it('⚙️ 设置弹窗：分组卡片（生成/安全）+ 设置项清单', async () => {
    const dm2 = new DataManager();
    const ui2 = new UIManager(dm2, { charset: 'abc', length: '8', securityMode: false });
    ui2.ensureElements();
    setSettingsProvider(() => ({
      passwordCharset: 'abc', passwordLength: '8', securityMode: false,
    }) as any);
    await getSafeManager().unlock('pw');
    openSettingsModal({ title: '密码本设置', schema: passwordSettingsSchema() });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('密码本设置');
    const isHiddenGroup = (el: Element) =>
      Boolean((el.closest('.bz-settings-group') as HTMLElement | null)?.classList.contains('bz-setting-hidden'));
    const heads = [...popup.querySelectorAll('.bz-settings-group-head')].filter((el) => !isHiddenGroup(el));
    expect(heads.map((el) => (el as HTMLElement).textContent!.trim())).toEqual(['生成2 项', '安全1 项']);
    expect(heads.map((el) => el.querySelector('.bz-settings-group-icon')!.getAttribute('data-icon'))).toEqual(['key-round', 'shield']);
    const names = [...popup.querySelectorAll('.bz-settings-group-body .setting-item')]
      .filter((el) => !el.classList.contains('bz-setting-hidden'))
      .map((el) => (el as HTMLElement).dataset.name);
    expect(names).toEqual(['密码生成字符集', '密码生成长度', '安全模式']);
    expect(popup.querySelector('.bz-settings-group.bz-setting-hidden')).not.toBeNull();
    const settings = [...popup.querySelectorAll('.setting-item')]
      .filter((el) => !el.classList.contains('bz-setting-hidden'))
      .map((el) => (el as any).__setting);
    expect(settings[1].desc).toBe('随机生成密码的字符个数');
    expect(settings[2].desc).toBe('关闭窗口立即自动上锁');
    closeSettingsModal();
  });

  it('⚙️ 设置弹窗（移动端）：追加「移动端」组', async () => {
    Platform.isMobile = true;
    const dm2 = new DataManager();
    const ui2 = new UIManager(dm2, { charset: 'abc', length: '8', securityMode: false });
    ui2.ensureElements();
    setSettingsProvider(() => ({
      passwordCharset: 'abc', passwordLength: '8', securityMode: false,
    }) as any);
    await getSafeManager().unlock('pw');
    openSettingsModal({ title: '密码本设置', schema: passwordSettingsSchema() });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const heads = [...popup.querySelectorAll('.bz-settings-group-head')];
    expect(heads.map((el) => (el as HTMLElement).textContent!.trim())).toEqual(['生成2 项', '安全1 项', '移动端1 项']);
    expect(heads.map((el) => el.querySelector('.bz-settings-group-icon')!.getAttribute('data-icon'))).toEqual([
      'key-round', 'shield', 'smartphone',
    ]);
    const names = [...popup.querySelectorAll('.bz-settings-group-body .setting-item')].map(
      (el) => (el as HTMLElement).dataset.name
    );
    expect(names).toEqual(['密码生成字符集', '密码生成长度', '安全模式', '移动端默认全屏']);
    closeSettingsModal();
    Platform.isMobile = false;
  });
});

describe('UIManager Route C 平台聚合', () => {
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
    document.body.appendChild(ui.root!);
    await getSafeManager().unlock('pw');
    await dm.addItem({ platform: 'GitHub', url: 'https://github.com', account: 'alice', password: 'secret1', note: '主账号' });
    await dm.addItem({ platform: 'GitHub', url: 'https://github.com', account: 'bob', password: 'secret2', note: '' });
    await dm.addItem({ platform: 'Gmail', account: 'charlie', password: 'secret3', note: '' });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (ui.root && ui.root.parentNode) ui.root.remove();
    if (ui.addMask && ui.addMask.parentNode) ui.addMask.remove();
    if (ui.platMask && ui.platMask.parentNode) ui.platMask.remove();
    document.body.innerHTML = '';
    Platform.isMobile = false;
    closeItemMenu();
    resetControllers();
  });

  it('show 渲染平台列表（GitHub 2个账号显示计数徽标、Gmail 1个）', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-plrow').length === 2);
    const rows = document.querySelectorAll('.pw-plrow');
    expect(rows.length).toBe(2);
    // GitHub 行有计数徽标
    const ghRow = [...rows].find((r) => r.textContent?.includes('GitHub'))!;
    expect(ghRow).toBeTruthy();
    expect(ghRow.querySelector('.pw-plcount')?.textContent).toBe('2');
    // Gmail 行无计数徽标
    const gmRow = [...rows].find((r) => r.textContent?.includes('Gmail'))!;
    expect(gmRow).toBeTruthy();
    expect(gmRow.querySelector('.pw-plcount')).toBeNull();
  });

  it('点击平台行 → 详情面板显示该平台的账号卡片', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-plrow').length === 2);
    const ghRow = [...document.querySelectorAll('.pw-plrow')].find((r) => r.textContent?.includes('GitHub'))! as HTMLElement;
    ghRow.click();
    await new Promise((r) => setTimeout(r, 50));
    // 详情面板应显示 GitHub 的两个账号
    const detail = document.querySelector('.pw-detail')!;
    expect(detail.textContent).toContain('GitHub');
    const cards = detail.querySelectorAll('.pw-acctcard');
    expect(cards.length).toBe(2);
    expect(detail.textContent).toContain('alice');
    expect(detail.textContent).toContain('bob');
  });

  it('点击账号卡片展开 → 显示密码字段', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-plrow').length === 2);
    const ghRow = [...document.querySelectorAll('.pw-plrow')].find((r) => r.textContent?.includes('GitHub'))! as HTMLElement;
    ghRow.click();
    await new Promise((r) => setTimeout(r, 50));
    const card = document.querySelector('.pw-acctcard .head') as HTMLElement;
    card.click();
    await new Promise((r) => setTimeout(r, 50));
    const expanded = document.querySelector('.pw-acctcard.expanded')!;
    expect(expanded).toBeTruthy();
    expect(expanded.querySelector('.pw-fvalue')?.textContent).toContain('•');
  });

  it('搜索模式：输入关键词后平铺显示匹配的账号行', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-plrow').length === 2);
    // 通过搜索输入框触发搜索
    const searchInput = document.querySelector('.pw-search input') as HTMLInputElement;
    searchInput.value = 'alice';
    searchInput.dispatchEvent(new Event('input'));
    await waitFor(() => document.querySelectorAll('.pw-srow').length === 1);
    const rows = document.querySelectorAll('.pw-srow');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('alice');
  });

  it('收藏功能：收藏/取消收藏切换', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-plrow').length === 2);
    // 点击 GitHub 行进入详情
    const ghRow = [...document.querySelectorAll('.pw-plrow')].find((r) => r.textContent?.includes('GitHub'))! as HTMLElement;
    ghRow.click();
    await new Promise((r) => setTimeout(r, 100));
    // 展开第一个账号
    const card = document.querySelector('.pw-acctcard .head') as HTMLElement;
    card.click();
    await new Promise((r) => setTimeout(r, 100));
    // 点击收藏按钮
    const favBtn = [...document.querySelectorAll('.pw-acctcard.expanded .pw-btn')].find(
      (b) => b.textContent?.includes('收藏')
    ) as HTMLElement;
    favBtn.click();
    await waitFor(() => hasNotice('已收藏'));
  });

  it('删除账号：确认后删除并更新视图', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-plrow').length === 2);
    // 点击 Gmail 行
    const gmRow = [...document.querySelectorAll('.pw-plrow')].find((r) => r.textContent?.includes('Gmail'))! as HTMLElement;
    gmRow.click();
    await new Promise((r) => setTimeout(r, 50));
    // 展开账号
    const card = document.querySelector('.pw-acctcard .head') as HTMLElement;
    card.click();
    await new Promise((r) => setTimeout(r, 50));
    // 点击删除按钮
    const delBtn = [...document.querySelectorAll('.pw-acctcard.expanded .pw-btn')].find(
      (b) => b.textContent?.includes('删除')
    ) as HTMLElement;
    delBtn.click();
    // 等待确认弹窗出现
    await waitFor(() => !!document.getElementById('__shared_confirm_ok__'));
    const confirmOk = document.getElementById('__shared_confirm_ok__') as HTMLButtonElement;
    confirmOk.click();
    await waitFor(() => dm.pwData.length === 2);
    expect(hasNotice('已删除')).toBe(true);
  });

  it('空态：无条目时显示提示', async () => {
    await dm.deleteItem(dm.pwData[0].id);
    await dm.deleteItem(dm.pwData[0].id);
    await dm.deleteItem(dm.pwData[0].id);
    ui.show();
    await waitFor(() => !!document.querySelector('.pw-rows .pw-empty'));
    expect(document.querySelector('.pw-rows .pw-empty')?.textContent).toContain('暂无密码条目');
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

  it('generatePassword 复制后 60s 定时清空剪贴板（P2）', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    const c = PasswordAppController.getInstance({ charset: 'abc123', length: '8', securityMode: false });
    await c.init();
    vi.useFakeTimers();
    try {
      c.generatePassword();
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText.mock.calls.length).toBe(1);
      expect(writeText.mock.calls[0][0]).toBeTruthy();
      vi.advanceTimersByTime(59_999);
      expect(writeText.mock.calls.length).toBe(1);
      vi.advanceTimersByTime(1);
      expect(writeText.mock.calls.length).toBe(2);
      expect(writeText.mock.calls[1][0]).toBe('');
      c.generatePassword();
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText.mock.calls.length).toBe(3);
      vi.advanceTimersByTime(60_000);
      expect(writeText.mock.calls.length).toBe(4);
      expect(writeText.mock.calls[3][0]).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('cleanup：取消剪贴板自动清空计时', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    const c = PasswordAppController.getInstance({ charset: 'abc123', length: '8', securityMode: false });
    await c.init();
    vi.useFakeTimers();
    try {
      c.generatePassword();
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText.mock.calls.length).toBe(1);
      c.cleanup();
      vi.advanceTimersByTime(60_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText.mock.calls.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('secureRandomPassword 加密安全随机生成器（P2）', () => {
  it('长度与字符集正确；多次生成全部落在字符集内', () => {
    for (let i = 0; i < 200; i++) {
      const pwd = secureRandomPassword(13, 'abc123');
      expect(pwd.length).toBe(13);
      expect([...pwd].every((ch) => 'abc123'.includes(ch))).toBe(true);
    }
  });

  it('边界：length<=0 / 空字符集返回空串；单字符集不崩溃', () => {
    expect(secureRandomPassword(0, 'abc')).toBe('');
    expect(secureRandomPassword(-3, 'abc')).toBe('');
    expect(secureRandomPassword(8, '')).toBe('');
    expect(secureRandomPassword(10, 'Z')).toBe('ZZZZZZZZZZ');
  });

  it('拒绝采样消除模偏差：大样本双字符占比接近均匀（±5%）', () => {
    const N = 4000;
    const pwd = secureRandomPassword(N, 'ab');
    const a = [...pwd].filter((ch) => ch === 'a').length;
    expect(Math.abs(a / N - 0.5)).toBeLessThan(0.05);
  });
});

describe('copySensitiveText clipboard API 缺失兜底', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: () => Promise.resolve(''), writeText: () => Promise.resolve() },
      configurable: true,
    });
  });

  it('writeText 同步抛 TypeError → 转成 rejected promise', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await expect(copySensitiveText('secret')).rejects.toThrow();
  });

  it('正常路径：写入成功并布防 60s 清空计时', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.useFakeTimers();
    try {
      await copySensitiveText('secret');
      expect(writeText).toHaveBeenCalledWith('secret');
      vi.advanceTimersByTime(60_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText.mock.calls.some((c: any[]) => c[0] === '')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
