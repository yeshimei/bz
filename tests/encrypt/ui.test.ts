/**
 * 加密保险箱 UI 测试：解锁弹窗（首设/解锁）、主面板列表渲染、
 * 单击开预览/长按还原确认、独立预览窗、安全模式自动上锁、加密二次确认、加锁当前笔记。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager, type SafeAttachment } from '../../src/encrypt/data';
import { EncryptAppController, UIManager, collectMediaSlots, truncateName } from '../../src/encrypt/ui';
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

const CONFIG = { root: 'CONFIG/.ENCRYPT', previewEnabled: false, previewSize: 960, previewQuality: 0.7, securityMode: false };

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
    dm = new SafeManager('CONFIG/.ENCRYPT');
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
    await waitFor(() => !!findDialog());
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
    expect(vault.files.has('CONFIG/.ENCRYPT/.safe.enc')).toBe(true);
    expect(hasNotice('密码已设置，数据已加密')).toBe(true);
  });

  it('已有清单：标题「输入主密码」，错误密码失败、正确成功', async () => {
    await dm.unlock('master123');
    dm.lock();
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
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

  it('回归：首次设主密码后再次打开→解锁弹窗（不再要求重设主密码）', async () => {
    // 首次：设置主密码
    const p1 = dm.unlock('master123');
    expect(await p1).toBe(true);
    expect(await dm.exists()).toBe(true);
    // 再次打开：should 走「输入主密码」解锁流程而非「设置主密码」
    const p2 = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    expect(dialog.textContent).toContain('输入主密码');
    expect(dialog.textContent).not.toContain('设置主密码');
    // 二次确认输入框隐藏（解锁流程无需再次输入）
    const inputs = dialog.querySelectorAll('input[type="password"]');
    expect((inputs[1] as HTMLInputElement).style.display).toBe('none');
    ui.hide();
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
    dm = new SafeManager('CONFIG/.ENCRYPT');
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

  it('show 渲染笔记卡片（标题/附件数），无预览/还原按钮，单击开预览', async () => {
    ui.show();
    const list = document.getElementById('bz-encrypt-list')!;
    expect(list.querySelectorAll('.bz-encrypt-card').length).toBe(1);
    expect(list.textContent).toContain('2025-06-01');
    expect(list.textContent).toContain('1 个附件');
    // 卡片内无「预览」/「还原」按钮（改手势触发）
    expect([...list.querySelectorAll('button')].some((b) => b.textContent === '预览')).toBe(false);
    expect([...list.querySelectorAll('button')].some((b) => b.textContent === '还原')).toBe(false);
    // 单击卡片 → 打开预览窗
    (list.querySelector('.bz-encrypt-card') as HTMLElement).click();
    await waitFor(() => document.getElementById('bz-encrypt-preview-popup')!.style.display === 'flex');
    expect(document.getElementById('bz-encrypt-preview-popup')!.textContent).toContain('2025-06-01');
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

  it('长按卡片 → 确认弹窗 → 确认后取出即删（正文写回、条目移除）', async () => {
    ui.show();
    const card = document.querySelector('.bz-encrypt-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    await new Promise((r) => setTimeout(r, 620)); // 长按 500ms 后触发
    const confirmMask = document.getElementById('__shared_confirm_mask__')!;
    expect(confirmMask.textContent).toContain('还原');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await waitFor(() => dm.manifest.notes.length === 0);
    expect(vault.files.get('我的/日记/2025-06-01.md')).toContain('# 日记');
    // 取出即删：清单空
    expect(dm.manifest.notes.length).toBe(0);
  });

  it('安全模式：关闭面板自动上锁', async () => {
    const dm2 = new SafeManager('CONFIG/.ENCRYPT');
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

describe('collectMediaSlots 混排', () => {
  const ATT = (path: string): SafeAttachment => ({
    path, kind: 'image', blobRef: 'x', blobSize: 1, fingerprint: 'f', hasPreview: true, previewRef: 'p', restored: false,
  });

  it('按文档顺序替换嵌入为占位 token，记录已内联附件', () => {
    const attachments = [ATT('我的/影视/a.png'), ATT('我的/影视/b.png')];
    const { text, slots, inlined } = collectMediaSlots('开头\n![[a.png]]\n中间\n![[b.png]]\n结尾', attachments);
    expect(text).toBe('开头\n@@ENC_MEDIA_0@@\n中间\n@@ENC_MEDIA_1@@\n结尾');
    expect(slots.map((s) => s.attachment?.path)).toEqual(['我的/影视/a.png', '我的/影视/b.png']);
    expect([...inlined]).toEqual(['我的/影视/a.png', '我的/影视/b.png']);
  });

  it('wikilink / markdown 图 / video 三种嵌入混排且按路径后缀匹配', () => {
    const attachments = [ATT('x/海报.png'), ATT('x/片段.mp4')];
    const { slots, inlined } = collectMediaSlots('正文 ![[海报.png]] 后 ![](x/片段.mp4) <video src="x/片段.mp4">', attachments);
    expect(slots.length).toBe(3);
    expect(slots.map((s) => s.attachment?.path)).toEqual(['x/海报.png', 'x/片段.mp4', 'x/片段.mp4']);
    expect([...inlined]).toEqual(['x/海报.png', 'x/片段.mp4']);
  });

  it('未被引用的附件不进 inlined（供底部画廊兜底）', () => {
    const attachments = [ATT('a.png'), ATT('b.png')];
    const { inlined } = collectMediaSlots('只引用 ![[a.png]]', attachments);
    expect([...inlined]).toEqual(['a.png']);
  });
});

describe('truncateName 文件名截断', () => {
  it('短文件名原样，长文件名截断加省略号（防通知栏忽高忽低）', () => {
    expect(truncateName('我的/影视/图.png')).toBe('图.png');
    expect(truncateName('视频/一个特别特别特别特别特别特别特别长的名字.mp4').length).toBeLessThanOrEqual(21);
    expect(truncateName('视频/一个特别特别特别特别特别特别特别长的名字.mp4')).toContain('…');
  });
});

describe('预览窗混排与还原打开', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    document.body.innerHTML = '';
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await dm.unlock('pw');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('正文嵌入图片 → 预览图内联在 markdown 区，不被推到底部画廊', async () => {
    const note = await dm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '开头\n![[pic.png]]\n结尾',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'data:image/jpeg;base64,QUJD' }],
    });
    ui.openPreview(note);
    await waitFor(() => document.getElementById('bz-encrypt-preview-popup')!.style.display === 'flex');
    const md = document.querySelector('.bz-encrypt-preview-md')!;
    // 图片内联在 md 区
    expect(md.querySelectorAll('img.bz-encrypt-preview-media').length).toBe(1);
    // 无底部画廊（该附件已内联）
    expect(document.querySelectorAll('.bz-encrypt-preview-gallery').length).toBe(0);
  });

  it('正文未引用的附件 → 进入底部画廊展示', async () => {
    const note = await dm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '# 无图正文',
      attachments: [{ path: '我的/影视/only.png', data: 'QUJDREVGRw==', previewData: 'data:image/jpeg;base64,QUJD' }],
    });
    ui.openPreview(note);
    await waitFor(() => document.getElementById('bz-encrypt-preview-popup')!.style.display === 'flex');
    const gallery = document.querySelector('.bz-encrypt-preview-gallery')!;
    expect(gallery.querySelectorAll('img').length).toBe(1);
    // md 区无内联图
    expect(document.querySelector('.bz-encrypt-preview-md')!.querySelectorAll('img').length).toBe(0);
  });

  it('长按还原成功 → 打开该笔记（openLinkText）并关闭保险箱面板', async () => {
    const app = setup(vault, CONFIG);
    const openLinkText = vi.fn();
    (app.workspace as any).openLinkText = openLinkText;
    const note = await dm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '# 打开我',
      attachments: [],
    });
    ui.show();
    const card = document.querySelector('.bz-encrypt-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    await new Promise((r) => setTimeout(r, 620));
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await waitFor(() => openLinkText.mock.calls.length > 0);
    expect(openLinkText).toHaveBeenCalledWith('我的/日记/x.md', '我的/日记/x.md');
    // 取出即删 + 关闭面板
    expect(dm.manifest.notes.length).toBe(0);
    expect(document.getElementById('bz-encrypt-popup')!.style.display).toBe('none');
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

  it('lockCurrentNote：先弹二次确认，点「加密」才把当前笔记 + 双链附件移入保险箱', async () => {
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
    const p = c.lockCurrentNote();
    // 二次确认框出现，未确认前不加密
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('加密到保险箱');
    expect(vault.files.has('笔记/主题.md')).toBe(true); // 还在，未加密
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await p;
    // 等待加密完成（进度通知 finish 后打开面板）
    await waitFor(() => document.getElementById('bz-encrypt-popup')!.style.display === 'flex');

    // 笔记与附件移出，进入保险箱
    expect(vault.files.has('笔记/主题.md')).toBe(false);
    expect(vault.binaryFiles.has('笔记/pic.png')).toBe(false);
    expect(c.dataManager.manifest.notes.length).toBe(1);
    expect(c.dataManager.manifest.notes[0].attachments.length).toBe(1);
    // 加密完成主动打开保险箱面板
    expect(document.getElementById('bz-encrypt-popup')!.style.display).toBe('flex');
  });

  it('lockCurrentNote：取消二次确认则不加密', async () => {
    const app = setup(vault, CONFIG);
    vault.create('笔记/主题.md', '正文\n![[pic.png]]');
    vault.createBinary('笔记/pic.png', new TextEncoder().encode('BCD').buffer);
    const activeFile = { path: '笔记/主题.md', basename: '主题', vault: vault as any };
    (app.workspace as any).getActiveFile = () => activeFile;

    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    const p = c.lockCurrentNote();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await p;
    // 未加密：笔记仍在，清单空，面板未开
    expect(vault.files.has('笔记/主题.md')).toBe(true);
    expect(vault.binaryFiles.has('笔记/pic.png')).toBe(true);
    expect(c.dataManager.manifest.notes.length).toBe(0);
    expect(document.getElementById('bz-encrypt-popup')!.style.display).toBe('none');
  });

  it('面板顶部「加密当前笔记」按钮在设置按钮前，点击触发加密确认', async () => {
    const app = setup(vault, CONFIG);
    vault.create('笔记/主题.md', '正文');
    const activeFile = { path: '笔记/主题.md', basename: '主题', vault: vault as any };
    (app.workspace as any).getActiveFile = () => activeFile;

    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    c.uiManager.show();
    // 顶部按钮：加密当前笔记 在 设置 之前，关闭在最后
    const headBtns = [...document.querySelectorAll('.bz-encrypt-head-btns button')].map((b) => b.textContent);
    expect(headBtns.indexOf('🔒')).toBeGreaterThanOrEqual(0);
    expect(headBtns.indexOf('⚙️')).toBeGreaterThanOrEqual(0);
    expect(headBtns.indexOf('❌')).toBeGreaterThanOrEqual(0);
    expect(headBtns.indexOf('🔒')).toBeLessThan(headBtns.indexOf('⚙️'));
    expect(headBtns.indexOf('⚙️')).toBeLessThan(headBtns.indexOf('❌'));
    // 点击 → 弹加密确认
    const lockBtn = [...document.querySelectorAll('.bz-encrypt-head-btns button')].find((b) => b.textContent === '🔒') as HTMLButtonElement;
    lockBtn.click();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('加密到保险箱');
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
  });
});