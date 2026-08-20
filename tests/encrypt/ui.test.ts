/**
 * 加密保险箱 UI 测试：解锁弹窗（首设/解锁）、主面板列表渲染、
 * 真还原确认、独立预览窗、安全模式自动上锁、收回全部、加锁当前笔记。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { EncryptAppController, UIManager } from '../../src/encrypt/ui';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';

/** 轮询等待（真实 PBKDF2 长异步） */
async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const CONFIG = { root: 'CONFIG/ENCRYPT', previewEnabled: false, previewSize: 960, previewQuality: 0.7, securityMode: false };

function setup(vault: MockVault, config = CONFIG) {
  const app = mockAppWithVault(vault);
  setApp(app as any);
  setSettingsProvider(() => CONFIG as any);
  resetObsidianMocks();
  return app;
}

function findDialog(): HTMLElement | null {
  return [...document.querySelectorAll('div')].find((d) => d.style.zIndex === '10070' && d.style.display === 'flex') as HTMLElement | null;
}

describe('UIManager 解锁弹窗', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(() => {
    vault = new MockVault();
    setup(vault);
    document.body.innerHTML = '';
    dm = new SafeManager('CONFIG/ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-preview-mask', 'bz-encrypt-preview-popup'].forEach((id) => {
      document.getElementById(id)?.remove();
    });
    document.body.innerHTML = '';
  });

  it('首次无清单：标题「设置主密码」+ 再次确认 + 警告；一致则设置成功', async () => {
    const p = ui.showPasswordDialog();
    const dialog = findDialog()!;
    expect(dialog.textContent).toContain('设置主密码');
    expect(dialog.textContent).toContain('重要提醒');
    const inputs = dialog.querySelectorAll('input[type="password"]');
    expect(inputs.length).toBe(2);
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    // 两次不一致
    (inputs[0] as HTMLInputElement).value = 'pw1';
    (inputs[1] as HTMLInputElement).value = 'pw2';
    confirmBtn.click();
    expect(hasNotice('两次密码不一致')).toBe(true);
    // 一致
    (inputs[1] as HTMLInputElement).value = 'pw1';
    confirmBtn.click();
    await p;
    expect(dm.unlocked).toBe(true);
    expect(vault.files.has('CONFIG/ENCRYPT/safe.enc')).toBe(true);
    expect(hasNotice('密码已设置，数据已加密')).toBe(true);
  });

  it('已有清单：标题「输入主密码」，错误密码失败、正确成功', async () => {
    await dm.unlock('master123');
    dm.lock();
    const p = ui.showPasswordDialog();
    const dialog = findDialog()!;
    expect(dialog.textContent).toContain('输入主密码');
    const inputs = dialog.querySelectorAll('input[type="password"]');
    expect((inputs[1] as HTMLInputElement).style.display).toBe('none');
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'wrong';
    confirmBtn.click();
    await new Promise((r) => setTimeout(r, 200));
    expect(dm.unlocked).toBe(false);
    expect(hasNotice('密码错误，请重试')).toBe(true);
    (inputs[0] as HTMLInputElement).value = 'master123';
    confirmBtn.click();
    await p;
    expect(dm.unlocked).toBe(true);
  });
});

describe('UIManager 主面板', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    document.body.innerHTML = '';
    dm = new SafeManager('CONFIG/ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await dm.unlock('pw');
    await dm.lockNote({
      path: '我的/日记/2025-06-01.md',
      title: '2025-06-01',
      content: '# 日记\n正文',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'PREVIEW' }],
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('show 渲染笔记卡片（标题/徽标/附件数）', async () => {
    ui.show();
    const list = document.getElementById('bz-encrypt-list')!;
    expect(list.querySelectorAll('.bz-encrypt-card').length).toBe(1);
    expect(list.textContent).toContain('2025-06-01');
    expect(list.textContent).toContain('已入库');
    expect(list.textContent).toContain('1 个附件');
  });

  it('预览按钮显示（有附件/摘要）→ 点击打开独立预览窗', async () => {
    ui.show();
    ui.openPreview(dm.manifest.notes[0]);
    await waitFor(() => document.getElementById('bz-encrypt-preview-popup')!.style.display === 'flex');
    const popup = document.getElementById('bz-encrypt-preview-popup')!;
    expect(popup.textContent).toContain('2025-06-01');
    expect(popup.querySelectorAll('img').length).toBe(1);
    ui.closePreview();
    expect(popup.style.display).toBe('none');
  });

  it('真还原按钮 → 确认弹窗 → 确认后调用 restoreNote 还原', async () => {
    ui.show();
    const restoreBtn = [...document.querySelectorAll('.bz-encrypt-btn--primary')].find((b) => b.textContent === '真还原') as HTMLButtonElement;
    restoreBtn.click();
    const confirmMask = document.getElementById('__shared_confirm_mask__')!;
    expect(confirmMask.textContent).toContain('真还原');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await waitFor(() => dm.manifest.notes[0].restored === true);
    expect(vault.files.get('我的/日记/2025-06-01.md')).toContain('# 日记');
  });

  it('安全模式：关闭面板自动上锁', async () => {
    const dm2 = new SafeManager('CONFIG/ENCRYPT');
    const ui2 = new UIManager(dm2, { ...CONFIG, securityMode: true });
    ui2.ensureElements();
    await dm2.unlock('pw');
    ui2.show();
    expect(dm2.unlocked).toBe(true);
    ui2.hide();
    expect(dm2.unlocked).toBe(false);
    expect(hasNotice('安全模式：已自动上锁')).toBe(true);
  });
});

describe('EncryptAppController', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setup(vault);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    EncryptAppController.instance?.cleanup();
    EncryptAppController.instance = null;
  });

  it('openManager：未解锁先弹解锁；解锁后显示面板', async () => {
    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    const p = c.openManager();
    await waitFor(() => !!findDialog());
    // 首设两次一致
    const dialog = findDialog()!;
    const inputs = dialog.querySelectorAll('input[type="password"]');
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'pw';
    confirmBtn.click();
    (inputs[1] as HTMLInputElement).value = 'pw';
    confirmBtn.click();
    await p;
    expect(c.dataManager.unlocked).toBe(true);
    expect(document.getElementById('bz-encrypt-popup')!.style.display).toBe('flex');
  });

  it('lockCurrentNote：把当前笔记 + 双链附件移入保险箱', async () => {
    const app = setup(vault, CONFIG);
    // 当前笔记引用图片附件
    vault.create('笔记/主题.md', '正文\n![[pic.png]]');
    vault.createBinary('笔记/pic.png', new TextEncoder().encode('BCD').buffer);
    // activeFile 指向当前笔记
    const activeFile = { path: '笔记/主题.md', basename: '主题', vault: vault as any };
    (app.workspace as any).getActiveFile = () => activeFile;

    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    await c.lockCurrentNote();

    // 笔记与附件移出，进入保险箱
    expect(vault.files.has('笔记/主题.md')).toBe(false);
    expect(vault.binaryFiles.has('笔记/pic.png')).toBe(false);
    expect(c.dataManager.manifest.notes.length).toBe(1);
    expect(c.dataManager.manifest.notes[0].attachments.length).toBe(1);
    expect(hasNotice(/已加密/)).toBe(true);
  });
});