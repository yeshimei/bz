/**
 * 密码本 UI 测试（合并至保险箱）：解锁统一走保险箱主密码弹窗（共享解锁态）、
 * 面板渲染/搜索/👁 切换/复制、数据读写经 password-vault 条目、生成器。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { PasswordAppController, UIManager, secureRandomPassword, copySensitiveText } from '../../src/password/ui';
import { DataManager } from '../../src/password/data';
import { EncryptAppController } from '../../src/encrypt/ui';
import { getSafeManager } from '../../src/encrypt';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, Platform } from '../mock-obsidian-entry';
import { closeItemMenu } from '../../src/core/item-actions';

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
    Platform.isMobile = false;
    closeItemMenu();
    resetControllers();
  });

  function findPasswordDialog(): HTMLElement | null {
    // 保险箱主密码弹窗（bz-encrypt-dialog-mask、flex 布局）
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

    // 错误密码 → 「密码错误，请重试」（+P2 节流的剩余等待提示）
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'wrong';
    confirmBtn.click();
    await new Promise((r) => setTimeout(r, 300));
    expect(dm.unlocked).toBe(false);
    expect(hasNotice('密码错误，请重试')).toBe(true);
    expect(hasNotice(/1 秒后可再次尝试/)).toBe(true);

    await new Promise((r) => setTimeout(r, 1100)); // 等失败冷却（P2 节流）结束再试
    // 正确密码 → 解锁成功
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
    expect(getSafeManager().unlocked).toBe(false); // 整体上锁
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
    ui2.show();
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '密码本设置')!;
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('密码本设置');
    // 分组卡片结构（桌面：生成/安全 2 组可见；移动端组挂 bz-setting-hidden 整组隐藏——ticket 131 声明式联动
    // 保留结构以便重求值，可见性过滤后与原行为一致），原生图标 + 徽标回填项数
    const isHiddenGroup = (el: Element) =>
      Boolean((el.closest('.bz-settings-group') as HTMLElement | null)?.classList.contains('bz-setting-hidden'));
    const heads = [...popup.querySelectorAll('.bz-settings-group-head')].filter((el) => !isHiddenGroup(el));
    expect(heads.map((el) => (el as HTMLElement).textContent!.trim())).toEqual(['生成2 项', '安全1 项']);
    expect(heads.map((el) => el.querySelector('.bz-settings-group-icon')!.getAttribute('data-icon'))).toEqual(['key-round', 'shield']);
    const names = [...popup.querySelectorAll('.bz-settings-group-body .setting-item')]
      .filter((el) => !el.classList.contains('bz-setting-hidden'))
      .map((el) => (el as HTMLElement).dataset.name);
    expect(names).toEqual(['密码生成字符集', '密码生成长度', '安全模式']);
    expect(popup.querySelector('.bz-settings-group.bz-setting-hidden')).not.toBeNull(); // 移动端组整组隐藏
    // 文案规范：长度/安全模式描述已去掉符号写法
    const settings = [...popup.querySelectorAll('.setting-item')]
      .filter((el) => !el.classList.contains('bz-setting-hidden'))
      .map((el) => (el as any).__setting);
    expect(settings[1].desc).toBe('随机生成密码的字符个数');
    expect(settings[2].desc).toBe('关闭窗口立即自动上锁'); // ticket 170 文案精简
  });

  it('⚙️ 设置弹窗（移动端）：追加「移动端」组（移动端默认全屏）', async () => {
    Platform.isMobile = true;
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
    const heads = [...popup.querySelectorAll('.bz-settings-group-head')];
    expect(heads.map((el) => (el as HTMLElement).textContent!.trim())).toEqual(['生成2 项', '安全1 项', '移动端1 项']);
    expect(heads.map((el) => el.querySelector('.bz-settings-group-icon')!.getAttribute('data-icon'))).toEqual([
      'key-round', 'shield', 'smartphone',
    ]);
    const names = [...popup.querySelectorAll('.bz-settings-group-body .setting-item')].map(
      (el) => (el as HTMLElement).dataset.name
    );
    expect(names).toEqual(['密码生成字符集', '密码生成长度', '安全模式', '移动端默认全屏']);
    Platform.isMobile = false;
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

  it('搜索输入防抖（ticket 43）：快速连续输入只渲染最后一次（180ms 窗口，不逐键整表 load/解密）', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const loadSpy = vi.spyOn(ui.dataManager, 'load');
    vi.useFakeTimers();
    try {
      // 关键词即时生效，渲染延迟到防抖窗结束
      ui.searchInput!.value = 'g';
      ui.searchInput!.dispatchEvent(new Event('input'));
      ui.searchInput!.value = 'gm';
      ui.searchInput!.dispatchEvent(new Event('input'));
      ui.searchInput!.value = 'gmail';
      ui.searchInput!.dispatchEvent(new Event('input'));
      // 未到防抖窗：不触发渲染/load
      vi.advanceTimersByTime(179);
      expect(loadSpy).not.toHaveBeenCalled();
      // 满 180ms → 只渲染最后一次（load 只触发一次，且缓存命中不重解密）
      vi.advanceTimersByTime(1);
      for (let i = 0; i < 40 && loadSpy.mock.calls.length === 0; i++) {
        await vi.advanceTimersByTimeAsync(25); // 冲刷渲染链（load 含真实异步解密）
      }
      expect(loadSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      loadSpy.mockRestore();
    }
    // 防抖后列表按最新关键词过滤
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 1);
    expect(document.getElementById('pw-entries-container')!.textContent).toContain('Gmail');
  });

  it('抽屉复制失败 → 「复制失败，请手动复制」，不弹成功提示（ticket 4）', async () => {
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const container = document.getElementById('pw-entries-container')!;
    Platform.isMobile = true;
    vi.useFakeTimers();
    try {
      const card = container.querySelector('.pw-entry-card') as HTMLElement;
      card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
      vi.advanceTimersByTime(550);
      card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
      card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(10);
      const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
      expect(sheet).not.toBeNull();
      const copyAcc = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
        (b) => b.textContent!.includes('复制账号')
      ) as HTMLElement;
      copyAcc.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(hasNotice('复制失败，请手动复制')).toBe(true);
      expect(hasNotice('账号已复制')).toBe(false);
      // 失败不布防 60s 清空计时（copySensitiveText 只在成功链路布防）
      vi.advanceTimersByTime(60_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(writeSpy.mock.calls.some((c: any[]) => c[0] === '')).toBe(false);
    } finally {
      vi.useRealTimers();
      Platform.isMobile = false;
      writeSpy.mockRestore();
    }
  });

  it('抽屉复制：clipboard API 缺失（writeText 同步抛 TypeError）→ 同样提示「复制失败，请手动复制」（ticket 4 兜底路径）', async () => {
    // 模拟非安全上下文/部分 WebView：navigator.clipboard 不存在，访问 writeText 即同步抛错——
    // copySensitiveText 的 try/catch 须把同步异常转成 rejected promise，调用方 .catch 才能收到
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    try {
      ui.show();
      await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
      const container = document.getElementById('pw-entries-container')!;
      Platform.isMobile = true;
      vi.useFakeTimers();
      try {
        const card = container.querySelector('.pw-entry-card') as HTMLElement;
        card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
        vi.advanceTimersByTime(550);
        card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(10);
        const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
        expect(sheet).not.toBeNull();
        const copyAcc = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
          (b) => b.textContent!.includes('复制账号')
        ) as HTMLElement;
        copyAcc.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(hasNotice('复制失败，请手动复制')).toBe(true);
        expect(hasNotice('账号已复制')).toBe(false);
      } finally {
        vi.useRealTimers();
        Platform.isMobile = false;
      }
    } finally {
      // 恢复 setup 形态的 clipboard（本文件后续用例直接 vi.spyOn(navigator.clipboard...) 依赖它）
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: () => Promise.resolve(''), writeText: () => Promise.resolve() },
        configurable: true,
      });
    }
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

  it('右键卡片 → 菜单「删除」→ 确认删除', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2); // 真实等待 PBKDF2 解密渲染
    const container = document.getElementById('pw-entries-container')!;
    const card = container.querySelector('.pw-entry-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
    const delItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('删除')
    ) as HTMLElement;
    expect(delItem).toBeTruthy();
    delItem.click();
    await new Promise((r) => setTimeout(r, 10));
    const confirmMask = document.getElementById('__shared_confirm_mask__');
    expect(confirmMask).not.toBeNull();
    expect(confirmMask!.textContent).toContain('删除密码条目');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await waitFor(() => dm.pwData.length === 1);
  });

  it('右键卡片 → 菜单「编辑」→ 编辑弹窗（回填）；保存后抽屉关闭', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const container = document.getElementById('pw-entries-container')!;
    const card = container.querySelector('.pw-entry-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
    const editItem = [...document.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('编辑')
    ) as HTMLElement;
    editItem.click();
    await new Promise((r) => setTimeout(r, 10));
    const popup = document.getElementById('pw-add-popup')!;
    expect(popup.style.display).toBe('block');
    expect(popup.textContent).toContain('编辑密码条目');
    expect(ui._platformInput.value).toBe('Gmail'); // 首卡 Gmail
    // 保存 → 抽屉来源编辑标志清理（保存成功关抽屉）
    ui._noteTextarea.value = '改备注';
    const saveBtn = [...popup.querySelectorAll('button')].find((b) => b.textContent === '保存')!;
    saveBtn.click();
    await waitFor(() => hasNotice('已保存'));
  });

  it('抽屉复制账号/复制密码（剪贴板 + toast）+ 头部平台名', async () => {
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined as any);
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const container = document.getElementById('pw-entries-container')!;
    // 移动端长按弹抽屉
    Platform.isMobile = true;
    vi.useFakeTimers();
    const card = container.querySelector('.pw-entry-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 10));

    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    // 头部：🔑 + 平台名 + 账号小字
    expect(sheet.querySelector('.bz-item-sheet-title')!.textContent).toBe('Gmail');
    expect(sheet.querySelector('.bz-item-sheet-sub')!.textContent).toContain('bob');
    const labels = [...sheet.querySelectorAll('.bz-item-sheet-label')].map((e) => e.textContent);
    expect(labels).toEqual(['复制账号', '复制密码', '编辑', '删除']);

    // 点「复制账号」→ 剪贴板 + 成功 toast（异步链路，等 toast）+ 关抽屉（非 keepOpen）
    const copyAcc = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('复制账号')
    ) as HTMLElement;
    copyAcc.click();
    await waitFor(() => hasNotice('账号已复制'));
    expect(writeSpy.mock.calls.some((c: any[]) => c[0] === 'bob')).toBe(true);
    expect(document.querySelector('.bz-item-sheet')).toBeNull();

    // 再开抽屉点「复制密码」
    vi.useFakeTimers();
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 10));
    const copyPwd = [...(document.querySelector('.bz-item-sheet') as HTMLElement).querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('复制密码')
    ) as HTMLElement;
    copyPwd.click();
    await waitFor(() => hasNotice('密码已复制'));
    expect(writeSpy.mock.calls.some((c: any[]) => c[0] === 'secret2')).toBe(true);

    Platform.isMobile = false;
    writeSpy.mockRestore();
  });

  it('复制敏感内容后 60s 定时清空剪贴板（P2）：抽屉「复制密码」布防、到期写空串', async () => {
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined as any);
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const container = document.getElementById('pw-entries-container')!;
    Platform.isMobile = true;
    vi.useFakeTimers();
    try {
      const card = container.querySelector('.pw-entry-card') as HTMLElement;
      card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
      vi.advanceTimersByTime(550);
      card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
      card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(10); // 假时钟下推进长按后续流（等价真实等待）
      const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
      expect(sheet).not.toBeNull();
      const copyPwd = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
        (b) => b.textContent!.includes('复制密码')
      ) as HTMLElement;
      copyPwd.click();
      await vi.advanceTimersByTimeAsync(0); // 冲刷 writeText promise 链（布防计时）
      expect(writeSpy.mock.calls.some((c: any[]) => c[0] === 'secret2')).toBe(true);
      // 未到期不清空
      vi.advanceTimersByTime(59_999);
      expect(writeSpy.mock.calls.some((c: any[]) => c[0] === '')).toBe(false);
      // 到期 → 尽力清空（写入空串）
      vi.advanceTimersByTime(1);
      expect(writeSpy.mock.calls.some((c: any[]) => c[0] === '')).toBe(true);
    } finally {
      vi.useRealTimers();
      Platform.isMobile = false;
      writeSpy.mockRestore();
    }
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

  it('generatePassword 复制后 60s 定时清空剪贴板（P2）：到期写空串、重复复制重新计时', async () => {
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
      await vi.advanceTimersByTimeAsync(0); // 冲刷复制 promise 链
      expect(writeText.mock.calls.length).toBe(1);
      expect(writeText.mock.calls[0][0]).toBeTruthy();
      // 59_999ms 内不清空
      vi.advanceTimersByTime(59_999);
      expect(writeText.mock.calls.length).toBe(1);
      // 满 60s → 清空
      vi.advanceTimersByTime(1);
      expect(writeText.mock.calls.length).toBe(2);
      expect(writeText.mock.calls[1][0]).toBe('');
      // 再次复制：重新计时（re-arm），同样 60s 后清空
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

  it('cleanup：取消剪贴板自动清空计时（l2-pw）——卸载后到期不再写空串', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    const c = PasswordAppController.getInstance({ charset: 'abc123', length: '8', securityMode: false });
    await c.init();
    vi.useFakeTimers();
    try {
      c.generatePassword(); // 复制 → 布防 60s 清空计时
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText.mock.calls.length).toBe(1);
      c.cleanup(); // 卸载：取消计时（cleanup 幂等，afterEach 再调无副作用）
      vi.advanceTimersByTime(60_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText.mock.calls.length).toBe(1); // 不再写空串
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('secureRandomPassword 加密安全随机生成器（P2）', () => {
  it('长度与字符集正确；多次生成全部落在字符集内、无越界崩溃', () => {
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

describe('copySensitiveText clipboard API 缺失兜底（ticket 4 补充）', () => {
  afterEach(() => {
    // 恢复 setup 形态的 clipboard（文件内其它用例依赖）
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: () => Promise.resolve(''), writeText: () => Promise.resolve() },
      configurable: true,
    });
  });

  it('writeText 同步抛 TypeError（clipboard API 缺失）→ 转成 rejected promise，调用方 .catch 可收到', async () => {
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
      // 布防计时须挂在 fake clock 上（先开假时钟再复制）
      vi.advanceTimersByTime(60_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText.mock.calls.some((c: any[]) => c[0] === '')).toBe(true); // 到期写空串布防生效
    } finally {
      vi.useRealTimers();
    }
  });
});