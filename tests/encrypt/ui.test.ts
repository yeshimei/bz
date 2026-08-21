/**
 * 加密保险箱 UI 测试：解锁弹窗（首设/解锁）、主面板列表渲染、
 * 单击开预览/长按还原确认、独立预览窗、安全模式自动上锁、加密二次确认、加锁当前笔记。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager, type SafeAttachment } from '../../src/encrypt/data';
import { EncryptAppController, UIManager, collectMediaSlots, truncateName, mimeOf, collectNoteAttachments, collectNoteAttachmentPaths } from '../../src/encrypt/ui';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices, mockMarkdownRenderer } from '../mock-obsidian-entry';

/** 轮询等待（真实 PBKDF2 长异步） */
async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const CONFIG = { root: 'CONFIG/.ENCRYPT', previewEnabled: false, previewSize: 384, previewQuality: 0.5, autoLoadOriginal: false, securityMode: false };

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

  it('首次无清单：标题「设置主密码」+ 再次确认 + 硬警告；未勾选风险确认拒绝设置，勾选后成功', async () => {
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    expect(dialog.textContent).toContain('设置主密码');
    expect(dialog.textContent).toContain('重要提醒');
    const inputs = dialog.querySelectorAll('input[type="password"]');
    expect(inputs.length).toBe(2);
    expect(dialog.querySelector('.bz-encrypt-dialog-ack')).toBeTruthy(); // 硬警告确认勾选（仅首设显示）
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    // 两次不一致
    (inputs[0] as HTMLInputElement).value = 'pw1';
    (inputs[1] as HTMLInputElement).value = 'pw2';
    confirmBtn.click();
    expect(hasNotice('两次密码不一致')).toBe(true);
    // 一致但未勾选风险确认 → 拒绝设置
    (inputs[1] as HTMLInputElement).value = 'pw1';
    confirmBtn.click();
    expect(hasNotice('请先勾选风险确认')).toBe(true);
    expect(dm.unlocked).toBe(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(dm.unlocked).toBe(false);
    // 勾选后再确认 → 设置成功
    const ackBox = dialog.querySelector('.bz-encrypt-dialog-ack input') as HTMLInputElement;
    ackBox.click();
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

  it('回归：触屏短按卡片 → longPress 补发 click → 打开预览窗（touchstart preventDefault 不再吞掉单击）', async () => {
    ui.show();
    const card = document.querySelector('.bz-encrypt-card') as HTMLElement;
    // 模拟触屏：touchstart（preventDefault 会抑制原生 click）→ 短按后 touchend
    const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ts, 'touches', { value: [{ clientX: 30, clientY: 30 }] });
    card.dispatchEvent(ts);
    await new Promise((r) => setTimeout(r, 60)); // 短按（< 500ms 长按阈值）
    card.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    // 补发 click → 预览窗打开
    await waitFor(() => document.getElementById('bz-encrypt-preview-popup')!.style.display === 'flex');
    expect(document.getElementById('bz-encrypt-preview-popup')!.textContent).toContain('2025-06-01');
  });

  it('单击卡片 → 先同步弹出预览窗骨架，再异步填充正文（标题 + 图片）', async () => {
    ui.show();
    ui.openPreview(dm.manifest.notes[0]);
    // 骨架先显示（同步）：弹窗立即可见，内容随后异步填充
    await waitFor(() => document.getElementById('bz-encrypt-preview-popup')!.style.display === 'flex');
    // 异步填充到达后再断言正文内容
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-md'));
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

  it('面板只显示普通加密笔记：过滤 diary-entry 与 password-vault', async () => {
    // 既有 beforeEach 已加锁 1 篇普通笔记；再补日记条目与密码本整表
    await dm.lockNote({ path: '我的/日记/d.md', title: '日记d', kind: 'diary-entry', content: '# x', attachments: [] });
    await dm.lockNote({ path: 'CONFIG/.ENCRYPT/passwords', title: '密码本', kind: 'password-vault', content: '[]', attachments: [] });
    ui.show();
    const list = document.getElementById('bz-encrypt-list')!;
    expect(list.querySelectorAll('.bz-encrypt-card').length).toBe(1);
    expect(list.textContent).toContain('2025-06-01');
    expect(list.textContent).not.toContain('密码本');
    expect(list.textContent).not.toContain('日记d');
  });
});

describe('collectMediaSlots 混排', () => {
  const ATT = (path: string): SafeAttachment => ({
    path, kind: 'image', blobRef: 'x', blobSize: 1, fingerprint: 'f', hasPreview: true, previewRef: 'p',
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
    // 骨架先显示，等异步填充完成后断言内联图
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-md'));
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
    // 骨架先显示，等异步填充完成后断言画廊
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-gallery'));
    const gallery = document.querySelector('.bz-encrypt-preview-gallery')!;
    expect(gallery.querySelectorAll('img').length).toBe(1);
    // md 区无内联图
    expect(document.querySelector('.bz-encrypt-preview-md')!.querySelectorAll('img').length).toBe(0);
  });

  it('回归：Markdown 渲染挂起（超时不返回）→ 单击仍弹出预览窗，超时后降级纯文本', async () => {
    ui.show();
    const note = await dm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '# 正文测试',
      attachments: [],
    });
    // 模拟真实 Obsidian 里 render 永不 resolve 的挂起
    const orig = mockMarkdownRenderer.render;
    mockMarkdownRenderer.render = vi.fn(async () => new Promise<void>(() => {})) as any;
    try {
      ui.openPreview(note);
      // 弹窗立即可见（骨架同步显示，不依赖渲染完成）
      await waitFor(() => document.getElementById('bz-encrypt-preview-popup')!.style.display === 'flex');
      // 超时兜底后降级纯文本正文（等 3s 渲染超时 + 余量）
      await waitFor(() => (document.querySelector('.bz-encrypt-preview-md') as HTMLElement)?.textContent?.includes('正文'), 8000);
      const md = document.querySelector('.bz-encrypt-preview-md')!;
      expect(md.textContent).toContain('正文');
      expect(md.querySelectorAll('img').length).toBe(0);
    } finally {
      mockMarkdownRenderer.render = orig;
    }
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
    // 首设两次一致 + 勾选风险确认
    const dialog = findDialog()!;
    const inputs = dialog.querySelectorAll('input[type="password"]');
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'pw';
    confirmBtn.click();
    (inputs[1] as HTMLInputElement).value = 'pw';
    (dialog.querySelector('.bz-encrypt-dialog-ack input') as HTMLInputElement).click();
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

  it('面板顶部「体检」按钮（替换原扫把）：体检弹窗报告失效条目与孤儿密文，默认勾选，清理后列表刷新', async () => {
    setup(vault, CONFIG);
    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    c.uiManager.show();
    // 预置无引用密文孤儿 + 正文镜像丢失的失效条目
    vault.files.set('CONFIG/.ENCRYPT/.junk.enc', 'junk');
    const dead = await c.dataManager.lockNote({
      path: '笔记/没了.md', title: '失效笔记', content: '# x', attachments: [],
    });
    vault.files.delete('CONFIG/.ENCRYPT/' + dead.contentRef); // 正文镜像丢失
    const headBtns = [...document.querySelectorAll('.bz-encrypt-head-btns button')].map((b) => b.textContent);
    expect(headBtns.indexOf('🩺')).toBeGreaterThanOrEqual(0);
    expect(headBtns.indexOf('🧹')).toBe(-1); // 原扫把已被体检替换
    const healthBtn = [...document.querySelectorAll('.bz-encrypt-head-btns button')].find((b) => b.textContent === '🩺') as HTMLButtonElement;
    healthBtn.click();
    await waitFor(() => !!document.getElementById('bz-encrypt-health-popup') && document.getElementById('bz-encrypt-health-popup')!.style.display === 'flex');
    // 回归：弹窗卡片必须是遮罩的子元素（脱离 flex 容器会沉入文档流，出现「只有遮罩没有内容」）
    expect(document.getElementById('bz-encrypt-health-popup')!.parentElement).toBe(document.getElementById('bz-encrypt-health-mask'));
    // 等扫描完成：可清理区块出现
    await waitFor(() => !!document.querySelector('.bz-encrypt-health-section--clean'));
    const body = document.getElementById('bz-encrypt-health-body')!;
    // 解锁态：完整性段已执行（全部镜像完整提示）
    expect(body.textContent).toContain('全部镜像完整');
    expect(body.textContent).toContain('失效笔记');
    expect(body.textContent).toContain('.junk.enc');
    // 可清理项默认全选（2 项：1 失效条目 + 1 孤儿密文）
    const checks = [...document.querySelectorAll('input.bz-encrypt-health-check')] as HTMLInputElement[];
    expect(checks.length).toBe(2);
    expect(checks.every((x) => x.checked)).toBe(true);
    (document.getElementById('bz-encrypt-health-clean') as HTMLButtonElement).click();
    await waitFor(() => hasNotice(/已清理/));
    expect(vault.files.get('CONFIG/.ENCRYPT/.junk.enc')).toBeUndefined();
    expect(c.dataManager.manifest.notes.some((n) => n.id === dead.id)).toBe(false);
    // 列表同步刷新（失效条目不再显示；beforeEach 的完好日记条目仍在）
    await waitFor(() => !document.getElementById('bz-encrypt-list')!.textContent.includes('失效笔记'));
    await waitFor(() => (document.getElementById('bz-encrypt-health-clean') as HTMLButtonElement).textContent === '清理勾选项 (0)');
    c.uiManager.hide();
  });

  it('体检弹窗：损坏镜像只展示不可勾选；可取消勾选后只清理所选项', async () => {
    setup(vault, CONFIG);
    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    const note = await c.dataManager.lockNote({
      path: '笔记/坏.md', title: '被篡改的笔记', content: '# x',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==' }],
    });
    vault.files.set('CONFIG/.ENCRYPT/' + note.contentRef, 'garbage-not-cipher'); // 正文镜像损坏
    vault.files.delete('CONFIG/.ENCRYPT/' + note.attachments[0].blobRef); // 附件镜像缺失
    c.uiManager.openHealthDialog();
    await waitFor(() => !!document.getElementById('bz-encrypt-health-popup'));
    const body = document.getElementById('bz-encrypt-health-body')!;
    await waitFor(() => body.textContent.includes('损坏镜像'));
    // 损坏镜像区块：只读展示（无 checkbox），提示不可清理
    expect(body.textContent).toContain('不可清理');
    expect(body.textContent).toContain('被篡改的笔记');
    expect(body.textContent).toContain('我的/影视/pic.png');
    expect(body.querySelectorAll('.bz-encrypt-health-item--bad').length).toBeGreaterThan(0);
    // 损坏/缺失类不带勾选框（只有可清理类才有）
    const checks = [...document.querySelectorAll('input.bz-encrypt-health-check')] as HTMLInputElement[];
    expect(checks.length).toBe(0);
    expect((document.getElementById('bz-encrypt-health-clean') as HTMLButtonElement).textContent).toBe('清理勾选项 (0)');
    // 条目与镜像原样保留（只报告不清理）
    expect(c.dataManager.manifest.notes.some((n) => n.id === note.id)).toBe(true);
    expect(vault.files.get('CONFIG/.ENCRYPT/' + note.attachments[0].blobRef)).toBeUndefined();
    // 恢复现场：移除本用例条目（单例后续用例依赖清单干净）
    await c.dataManager.removeNote(note.id);
  });

  it('体检弹窗：锁定态打开先弹主密码，解锁后进入体检并做完整性检测', async () => {
    setup(vault, CONFIG);
    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    const note = await c.dataManager.lockNote({
      path: '笔记/x.md', title: 'x', content: '# x', attachments: [],
    });
    vault.files.delete('CONFIG/.ENCRYPT/' + note.contentRef); // 正文镜像丢失（失效条目）
    c.dataManager.lock();
    // 锁定态点体检 → 先弹主密码（不进入体检页）
    const p = c.uiManager.openHealthDialog();
    await waitFor(() => !!findDialog());
    expect(findDialog()!.textContent).toContain('输入主密码');
    const dialog = findDialog()!;
    const inputs = dialog.querySelectorAll('input[type="password"]');
    (inputs[0] as HTMLInputElement).value = 'pw';
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    confirmBtn.click();
    await p;
    // 解锁后进入体检：对账报告失效条目（x），完整性段补检（其余镜像完好）
    await waitFor(() => !!document.getElementById('bz-encrypt-health-popup') && document.getElementById('bz-encrypt-health-popup')!.style.display === 'flex');
    const body = document.getElementById('bz-encrypt-health-body')!;
    await waitFor(() => body.textContent.includes('可清理'));
    expect(body.textContent).toContain('x');
    expect(body.textContent).toContain('全部镜像完整');
    // 恢复现场：移除本用例条目
    await c.dataManager.removeNote(note.id);
  });

  it('体检动态显示：扫描中实时进度 + 发现即时追加（无勾选框），完成后整理成整篇报告', async () => {
    setup(vault, CONFIG);
    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    // 模拟慢速扫描：先回调一次进度（含一个实时发现），延迟后再完成
    const spy = vi.spyOn(c.dataManager, 'scanHealth').mockImplementation(
      (async (onProgress: any) => {
        onProgress?.({
          done: 1, total: 6, current: '第一篇',
          found: [{ cat: 'orphan-file', key: 'file:.junk.enc', label: '.junk.enc' }],
        });
        await new Promise((r) => setTimeout(r, 60));
        onProgress?.({ done: 6, total: 6, current: '扫描完成', found: [] });
        return { items: [{ cat: 'orphan-file', key: 'file:.junk.enc', label: '.junk.enc' }], integrityChecked: true };
      }) as any
    );
    try {
      c.uiManager.openHealthDialog();
      // 扫描中：进度文本 + 实时发现行已追加；尚未整理 → 无勾选框
      await waitFor(() => document.getElementById('bz-encrypt-health-body')!.textContent.includes('检查中 1/6'));
      const liveBody = document.getElementById('bz-encrypt-health-body')!;
      expect(liveBody.textContent).toContain('.junk.enc');
      expect(document.querySelector('input.bz-encrypt-health-check')).toBeNull();
      // 完成后：整篇勾选报告（进度行消失）
      await waitFor(() => !!document.querySelector('input.bz-encrypt-health-check'));
      expect(document.getElementById('bz-encrypt-health-body')!.textContent).not.toContain('检查中');
    } finally {
      spy.mockRestore();
    }
  });

  it('lockCurrentNote：附件读取失败 → 整笔放弃（不落任何东西、原文件不动、提示失败）', async () => {
    const app = setup(vault, CONFIG);
    vault.create('笔记/主题.md', '正文\n![[pic.png]]');
    vault.createBinary('笔记/pic.png', new TextEncoder().encode('BCD').buffer);
    const activeFile = { path: '笔记/主题.md', basename: '主题', vault: vault as any };
    (app.workspace as any).getActiveFile = () => activeFile;

    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    vi.spyOn(vault, 'readBinary').mockRejectedValue(new Error('boom'));
    const p = c.lockCurrentNote();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await p;
    expect(hasNotice('加密失败：附件读取失败（笔记/pic.png）')).toBe(true);
    // 整笔放弃：原文件未动、无清单条目、无任何密文镜像/暂存残留
    expect(vault.files.has('笔记/主题.md')).toBe(true);
    expect(vault.binaryFiles.has('笔记/pic.png')).toBe(true);
    expect(c.dataManager.manifest.notes.length).toBe(0);
    // 无任何密文镜像残留（.safe.enc 清单本体除外）
    expect([...vault.files.keys()].some((k) => k.startsWith('CONFIG/.ENCRYPT/') && k !== 'CONFIG/.ENCRYPT/.safe.enc' && k.endsWith('.enc'))).toBe(false);
  });
});

describe('mimeOf 附件 MIME 推断', () => {
  it('图片/视频/未知扩展名各归其类（大小写不敏感）', () => {
    expect(mimeOf('x.PNG')).toBe('image/png');
    expect(mimeOf('a.jpeg')).toBe('image/jpeg');
    expect(mimeOf('w.webp')).toBe('image/webp');
    expect(mimeOf('v.mp4')).toBe('video/mp4');
    expect(mimeOf('v.mkv')).toBe('video/x-matroska');
    expect(mimeOf('v.webm')).toBe('video/webm');
    expect(mimeOf('noext')).toBe('application/octet-stream');
  });
});

describe('预览窗缩略图按需加载原始层', () => {
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

  it('点击缩略图：该图 slot 转圈 → 解密原始层 → 原地替换为原图（只加载被点的那一张，不弹通知）', async () => {
    const note = await dm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '开头\n![[pic1.png]]\n中间\n![[pic2.png]]',
      attachments: [
        { path: '我的/影视/pic1.png', data: 'QUJDREVGRw==', previewData: 'data:image/jpeg;base64,QUJD' },
        { path: '我的/影视/pic2.png', data: 'MTIzNDU2', previewData: 'data:image/jpeg;base64,MTIz' },
      ],
    });
    ui.openPreview(note);
    await waitFor(() => document.querySelectorAll('.bz-encrypt-preview-slot').length === 2);
    const imgs = [...document.querySelectorAll('.bz-encrypt-preview-media')] as HTMLImageElement[];
    // 初始显示均为预览层省略图
    expect(imgs[0].getAttribute('src')).toBe('data:image/jpeg;base64,QUJD');
    // 放慢原始层解密，便于断言转圈中间态
    const orig = dm.decryptAttachmentOriginal.bind(dm);
    const spy = vi.spyOn(dm, 'decryptAttachmentOriginal').mockImplementation(async (a) => {
      await new Promise((r) => setTimeout(r, 80));
      return orig(a);
    });
    try {
      const slot0 = imgs[0].closest('.bz-encrypt-preview-slot') as HTMLElement;
      slot0.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      // 该图立显加载转圈（loading class + spinner 可见）
      expect(slot0.classList.contains('bz-encrypt-preview-slot--loading')).toBe(true);
      await waitFor(() => slot0.classList.contains('bz-encrypt-preview-slot--loaded'));
      const img0 = slot0.querySelector('.bz-encrypt-preview-media') as HTMLImageElement;
      // 原图替换：png mime 的 dataURL（jsdom 无 Blob URL，走 dataURL 兜底）
      expect(img0.src).toMatch(/^(blob:|data:image\/png)/);
      expect(spy).toHaveBeenCalledTimes(1);
      // 相邻缩略图未被加载（只加载被点的那一张）
      const slot1 = imgs[1].closest('.bz-encrypt-preview-slot') as HTMLElement;
      expect(slot1.querySelector('.bz-encrypt-preview-media')?.getAttribute('src')).toBe('data:image/jpeg;base64,MTIz');
      expect(spy.mock.calls[0]![0].path).toBe('我的/影视/pic1.png');
      // 不弹通知（缩略图内加载态更直观）
      expect(document.querySelectorAll('.bz-notice').length).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('点击视频封面：转圈后替换为可播放 <video controls>（原始质量直供）', async () => {
    const note = await dm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '片尾\n<video src="clip.mp4">',
      attachments: [{ path: '我的/影视/clip.mp4', kind: 'video', data: 'QUJDREVGRw==', previewData: 'data:image/jpeg;base64,QUJD' }],
    });
    ui.openPreview(note);
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-slot'));
    const slot = document.querySelector('.bz-encrypt-preview-slot') as HTMLElement;
    // 初始为封面缩略图
    const cover = slot.querySelector('.bz-encrypt-preview-media') as HTMLImageElement;
    expect(cover.getAttribute('src')).toBe('data:image/jpeg;base64,QUJD');
    slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => !!document.querySelector('video.bz-encrypt-preview-video'));
    const video = document.querySelector('video.bz-encrypt-preview-video') as HTMLVideoElement;
    expect(video.controls).toBe(true);
    expect(video.src).toMatch(/^(blob:|data:video\/mp4)/);
    expect(slot.classList.contains('bz-encrypt-preview-slot--loaded')).toBe(true);
    // 封面缩略图已被替换（不再存在）
    expect(slot.querySelector('.bz-encrypt-preview-media')).toBeNull();
  });

  it('解密失败：转圈消失、缩略图保留、title 提示可重试（不弹通知、不误标 loaded）', async () => {
    const note = await dm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '![[pic.png]]',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'data:image/jpeg;base64,QUJD' }],
    });
    ui.openPreview(note);
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-slot'));
    const spy = vi.spyOn(dm, 'decryptAttachmentOriginal').mockResolvedValue(null);
    try {
      const slot = document.querySelector('.bz-encrypt-preview-slot') as HTMLElement;
      slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await waitFor(() => slot.classList.contains('bz-encrypt-preview-slot--loading') === false && slot.dataset.loading === undefined);
      // 缩略图仍在、未标记已加载、title 提示可重试
      const img = slot.querySelector('.bz-encrypt-preview-media') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe('data:image/jpeg;base64,QUJD');
      expect(img.title).toBe('加载失败，点击重试');
      expect(slot.classList.contains('bz-encrypt-preview-slot--loaded')).toBe(false);
      expect(document.querySelectorAll('.bz-notice').length).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('无预览层占位也可点击加载原图（missing 提示 → 点击出原图）', async () => {
    const note = await dm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '![[only.png]]',
      attachments: [{ path: '我的/影视/only.png', data: 'QUJDREVGRw==' }],
    });
    ui.openPreview(note);
    // 无预览层 → 占位提示（非 img）
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-missing'));
    const slot = document.querySelector('.bz-encrypt-preview-slot') as HTMLElement;
    expect(slot.querySelector('.bz-encrypt-preview-media')).toBeNull();
    expect(slot.textContent).toContain('点击加载原图');
    slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 占位被替换为原始质量图
    await waitFor(() => !!slot.querySelector('img.bz-encrypt-preview-media'));
    const img = slot.querySelector('img.bz-encrypt-preview-media') as HTMLImageElement;
    expect(img.src).toMatch(/^(blob:|data:image\/png)/);
    expect(slot.classList.contains('bz-encrypt-preview-slot--loaded')).toBe(true);
  });

  it('已加载的 slot 重复点击不重复解密（loaded 短路）', async () => {
    const note = await dm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '![[pic.png]]',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'data:image/jpeg;base64,QUJD' }],
    });
    ui.openPreview(note);
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-slot'));
    const spy = vi.spyOn(dm, 'decryptAttachmentOriginal');
    const slot = document.querySelector('.bz-encrypt-preview-slot') as HTMLElement;
    slot.dataset.loaded = '1'; // 预置已加载态
    slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('默认（开关关）：打开预览只显示省略图，不自动解密原始层', async () => {
    const note = await dm.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '![[pic.png]]',
      attachments: [{ path: '我的/影视/pic.png', data: 'QUJDREVGRw==', previewData: 'data:image/jpeg;base64,QUJD' }],
    });
    const spy = vi.spyOn(dm, 'decryptAttachmentOriginal');
    try {
      ui.openPreview(note);
      await waitFor(() => !!document.querySelector('.bz-encrypt-preview-slot'));
      await new Promise((r) => setTimeout(r, 120));
      // 无自动加载：原始层从未解密、缩略图保持省略图
      expect(spy).not.toHaveBeenCalled();
      const img = document.querySelector('.bz-encrypt-preview-media') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe('data:image/jpeg;base64,QUJD');
    } finally {
      spy.mockRestore();
    }
  });

  it('自动加载原图（开关开）：预览打开即自动解密全部原始层替换省略图（逐个转圈/替换）', async () => {
    const dmA = new SafeManager('CONFIG/.ENCRYPT');
    const uiA = new UIManager(dmA, { ...CONFIG, autoLoadOriginal: true });
    uiA.ensureElements();
    await dmA.unlock('pw');
    const note = await dmA.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '开头\n![[pic1.png]]\n中间\n![[pic2.png]]',
      attachments: [
        { path: '我的/影视/pic1.png', data: 'QUJDREVGRw==', previewData: 'data:image/jpeg;base64,QUJD' },
        { path: '我的/影视/pic2.png', data: 'MTIzNDU2', previewData: 'data:image/jpeg;base64,MTIz' },
      ],
    });
    const spy = vi.spyOn(dmA, 'decryptAttachmentOriginal');
    try {
      uiA.openPreview(note);
      // 打开后自动加载：两个 slot 全部进入替换（原图 src / loaded 态），无需手动点击
      await waitFor(() => document.querySelectorAll('.bz-encrypt-preview-slot--loaded').length === 2);
      expect(spy.mock.calls.length).toBe(2);
      const imgs = [...document.querySelectorAll('.bz-encrypt-preview-media')] as HTMLImageElement[];
      expect(imgs[0].src).toMatch(/^(blob:|data:image\/png)/);
      expect(imgs[1].src).toMatch(/^(blob:|data:image\/png)/);
      // 再次点击已加载 slot 不再解密（loaded 短路，自动与手动链路同语义）
      const slot0 = imgs[0].closest('.bz-encrypt-preview-slot') as HTMLElement;
      slot0.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 80));
      expect(spy.mock.calls.length).toBe(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('自动加载原图：某张解密失败不影响其他（失败者保留省略图可重试）', async () => {
    const dmA = new SafeManager('CONFIG/.ENCRYPT');
    const uiA = new UIManager(dmA, { ...CONFIG, autoLoadOriginal: true });
    uiA.ensureElements();
    await dmA.unlock('pw');
    const note = await dmA.lockNote({
      path: '我的/日记/x.md',
      title: 'x',
      content: '![[pic1.png]]\n![[pic2.png]]',
      attachments: [
        { path: '我的/影视/pic1.png', data: 'QUJDREVGRw==', previewData: 'data:image/jpeg;base64,QUJD' },
        { path: '我的/影视/pic2.png', data: 'MTIzNDU2', previewData: 'data:image/jpeg;base64,MTIz' },
      ],
    });
    const orig = dmA.decryptAttachmentOriginal.bind(dmA);
    const spy = vi
      .spyOn(dmA, 'decryptAttachmentOriginal')
      .mockImplementation(async (a) => (a.path.includes('pic1') ? null : orig(a)));
    try {
      uiA.openPreview(note);
      // pic2 自动加载成功；pic1 失败保留省略图（title 提示可重试）
      await waitFor(() => document.querySelectorAll('.bz-encrypt-preview-slot').length === 2);
      await waitFor(() => {
        const slots = [...document.querySelectorAll<HTMLElement>('.bz-encrypt-preview-slot')];
        const ok = slots.find((s) => s.querySelector('.bz-encrypt-preview-slot--loaded') || s.classList.contains('bz-encrypt-preview-slot--loaded'));
        return slots.some((s) => s.classList.contains('bz-encrypt-preview-slot--loaded')) && slots.some((s) => s.querySelector('.bz-encrypt-preview-media')?.getAttribute('title') === '加载失败，点击重试');
      });
      const slots = [...document.querySelectorAll<HTMLElement>('.bz-encrypt-preview-slot')];
      expect(slots.filter((s) => s.classList.contains('bz-encrypt-preview-slot--loaded')).length).toBe(1);
      const failedImg = slots.find((s) => !s.classList.contains('bz-encrypt-preview-slot--loaded'))!.querySelector('.bz-encrypt-preview-media') as HTMLImageElement;
      expect(failedImg.getAttribute('src')).toBe('data:image/jpeg;base64,QUJD');
      expect(failedImg.title).toBe('加载失败，点击重试');
      // 手动点击可重试成功
      spy.mockImplementation((a) => orig(a));
      slots.find((s) => !s.classList.contains('bz-encrypt-preview-slot--loaded'))!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await waitFor(() => !!document.querySelector('.bz-encrypt-preview-slot--loaded') && document.querySelectorAll('.bz-encrypt-preview-slot--loaded').length === 2);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('collectNoteAttachments embeds 收集（优化三：metadataCache 自带链接信息）', () => {
  it('embeds 与正则兜底取并集：embeds 覆盖 ![[，正则兜底 md 图/video', () => {
    const files = [
      { path: '我的/影视/a.png' },
      { path: '我的/影视/b/海报.png' },
    ];
    // embeds 提供（Obsidian 自带链接信息）：content 里没有嵌入语法也能收到
    expect(collectNoteAttachments('# 无嵌入', ['a.png'], files)).toEqual(['我的/影视/a.png']);
    // 正则兜底：markdown 图 + video（embeds 不覆盖的语法）
    expect(collectNoteAttachments('![](b/海报.png) <video src="b/海报.png">', [], files)).toEqual(['我的/影视/b/海报.png']);
    // 并集去重：同一引用两路来只出一个
    expect(collectNoteAttachments('![[a.png]]', ['a.png'], files)).toEqual(['我的/影视/a.png']);
    // 相对路径（含子目录）退化匹配
    expect(collectNoteAttachments('![[影视/海报.png]]', [], [{ path: '我的/影视/海报.png' }])).toEqual(['我的/影视/海报.png']);
    // 未知引用忽略
    expect(collectNoteAttachments('![[不存在.png]]', ['也/没有.png'], files)).toEqual([]);
  });

  it('collectNoteAttachmentPaths：从 app.metadataCache.getFileCache().embeds 收集（app 级入口，路径字符串）', () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    vault.create('笔记/x.md', '正文\n![[pic.png]]');
    vault.createBinary('笔记/pic.png', new TextEncoder().encode('X').buffer);
    const paths = collectNoteAttachmentPaths(app, '笔记/x.md', '正文\n![[pic.png]]');
    expect(paths).toEqual(['笔记/pic.png']);
  });
});

describe('解锁弹窗：清单损坏重设确认 + 首设写失败（雷 1/4 UI 侧）', () => {
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
    document.body.innerHTML = '';
  });

  it('空清单损坏：输密码解锁失败 → 弹「清单疑似损坏」确认 → 仍要重设 → 重设成功', async () => {
    await dm.unlock('oldpw');
    dm.lock();
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc', ''); // 半写崩溃现场：清单为空
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    const inputs = dialog.querySelectorAll('input[type="password"]');
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'newpw';
    confirmBtn.click();
    // 不清静默重设：先出损坏确认框
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('清单疑似损坏');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    expect(await p).toBe(true);
    expect(dm.unlocked).toBe(true);
    expect(hasNotice('已重设主密码（旧数据不可恢复）')).toBe(true);
  });

  it('空清单损坏：点「暂不重设」→ 弹窗保留、未解锁、有警示', async () => {
    await dm.unlock('oldpw');
    dm.lock();
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc', '');
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    const inputs = dialog.querySelectorAll('input[type="password"]');
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'newpw';
    confirmBtn.click();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    expect(hasNotice('未重设：请先检查或备份数据文件')).toBe(true);
    // 密码弹窗仍保留、未解锁
    expect(findDialog()).toBeTruthy();
    expect(dm.unlocked).toBe(false);
    void p;
  });

  it('密码错误（清单正常）仍走「密码错误，请重试」而非损坏确认', async () => {
    await dm.unlock('pw');
    dm.lock();
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    const inputs = dialog.querySelectorAll('input[type="password"]');
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'wrong';
    confirmBtn.click();
    await new Promise((r) => setTimeout(r, 200));
    expect(hasNotice('密码错误，请重试')).toBe(true);
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull(); // 无损坏确认
    (inputs[0] as HTMLInputElement).value = 'pw';
    confirmBtn.click();
    expect(await p).toBe(true);
  });

  it('解锁弹窗：打开即自动聚焦密码输入框（移动端直接弹键盘）', async () => {
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    const inputs = dialog.querySelectorAll('input[type="password"]');
    expect(document.activeElement).toBe(inputs[0]);
    // 取消关闭
    const cancelBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '取消')!;
    cancelBtn.click();
    expect(await p).toBe(false);
  });

  it('解锁弹窗：点击遮罩（内容区外）关闭面板 = 取消；点内容区不关闭', async () => {
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const mask = findDialog()!;
    // 点内容区（box）不关闭
    const box = mask.querySelector('.bz-encrypt-dialog-box') as HTMLElement;
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    expect(findDialog()).toBeTruthy();
    // 点遮罩自身 → 关闭并取消
    mask.dispatchEvent(new MouseEvent('click', { bubbles: false }));
    expect(await p).toBe(false);
    expect(findDialog()).toBeFalsy();
  });

  it('首设写清单失败：提示设置失败并关闭弹窗（不再假装成功）', async () => {
    const spy = vi.spyOn(vault.adapter, 'write').mockRejectedValue(new Error('disk full'));
    try {
      const p = ui.showPasswordDialog();
      await waitFor(() => !!findDialog());
      const dialog = findDialog()!;
      const inputs = dialog.querySelectorAll('input[type="password"]');
      const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
      (inputs[0] as HTMLInputElement).value = 'pw';
      confirmBtn.click();
      (inputs[1] as HTMLInputElement).value = 'pw';
      (dialog.querySelector('.bz-encrypt-dialog-ack input') as HTMLInputElement).click();
      confirmBtn.click();
      expect(await p).toBe(false);
      expect(hasNotice('设置失败：无法写入清单，请检查磁盘空间后重试')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('EncryptAppController 重入保护（雷 3）', () => {
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

  it('lockCurrentNote 处理中再次触发被拒（busy 提示），原操作不受影响', async () => {
    const app = setup(vault, CONFIG);
    vault.create('笔记/主题.md', '正文');
    const activeFile = { path: '笔记/主题.md', basename: '主题' };
    (app.workspace as any).getActiveFile = () => activeFile;
    const c = EncryptAppController.getInstance(CONFIG);
    await c.init();
    await c.dataManager.unlock('pw');
    const p = c.lockCurrentNote();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__')); // 第一次停在二次确认
    await c.lockCurrentNote(); // 第二次触发 → 拒
    expect(hasNotice('正在加密当前笔记，请稍候')).toBe(true);
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await p;
    expect(c.dataManager.manifest.notes.length).toBe(0);
  });
});

describe('预览窗 Blob URL 释放（优化四：换预览即释放上一批）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setup(vault);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('连开两篇预览不关窗：上一批 Blob URL 被 revoke', async () => {
    // jsdom 无 Blob URL：stub 出真实链路（create/revoke 记录）
    const created: string[] = [];
    const revoked: string[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => {
        const u = 'blob:mock-' + created.length;
        created.push(u);
        return u;
      }),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn((u: string) => {
        revoked.push(u);
      }),
      configurable: true,
    });
    try {
      const dm = new SafeManager('CONFIG/.ENCRYPT');
      const ui = new UIManager(dm, CONFIG);
      ui.ensureElements();
      await dm.unlock('pw');
      const noteA = await dm.lockNote({
        path: 'a.md', title: 'a', content: '![[p.png]]',
        attachments: [{ path: 'p.png', data: 'QUJD' }],
      });
      const noteB = await dm.lockNote({
        path: 'b.md', title: 'b', content: '![[p2.png]]',
        attachments: [{ path: 'p2.png', data: 'REVG' }],
      });
      ui.openPreview(noteA);
      await waitFor(() => document.querySelectorAll('.bz-encrypt-preview-slot').length === 1);
      // 点击加载原图 → 产生 blob URL
      (document.querySelector('.bz-encrypt-preview-slot') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await waitFor(() => created.length === 1);
      // 不关窗直接开第二篇 → 上一篇 blob 立即释放
      ui.openPreview(noteB);
      expect(revoked).toEqual(['blob:mock-0']);
      // 关窗幂等（空列表）
      ui.closePreview();
    } finally {
      delete (URL as any).createObjectURL;
      delete (URL as any).revokeObjectURL;
    }
  });
});

describe('保险箱状态栏（补丁：锁状态提示）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setup(vault);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    EncryptAppController.instance?.cleanup();
    EncryptAppController.instance = null;
    document.body.innerHTML = '';
  });

  it('挂载后显示锁定态；解锁成功变解锁态、lock() 回锁定态', async () => {
    const c = new EncryptAppController(CONFIG);
    const el = document.createElement('span');
    document.body.appendChild(el);
    c.attachStatusBar(el);
    expect(el.textContent).toBe('🔒 保险箱');
    await c.dataManager.unlock('pw');
    expect(el.textContent).toBe('🔓 保险箱');
    c.dataManager.lock();
    expect(el.textContent).toBe('🔒 保险箱');
    // 二次解锁（已存在清单）同样刷新
    await c.dataManager.unlock('pw');
    expect(el.textContent).toBe('🔓 保险箱');
  });
});