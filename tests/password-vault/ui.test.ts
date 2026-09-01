/**
 * 保险库（password-vault）UI 层测试：
 * 1) DOM 创建（桌面三栏 + 移动端 + 锁屏/弹窗齐全）；
 * 2) 渲染：平台聚合行 / 搜索展平 / 详情账号卡；
 * 3) 锁屏：未解锁显示、首设/解锁标题切换（安全机制走 SafeManager）；
 * 4) 添加弹窗：字段填充 + fav 落盘。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { PasswordVaultDataManager, type PasswordVaultEntry } from '../../src/password-vault/data';
import { PasswordVaultUIManager } from '../../src/password-vault/ui';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

describe('PasswordVaultUIManager', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: PasswordVaultUIManager;

  beforeEach(() => {
    resetObsidianMocks();
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
  });

  it('ensureElements：桌面三栏 + 移动端 + 锁屏/弹窗 DOM 齐全', async () => {
    ui.ensureElements();
    expect(document.querySelector('.bz-password-vault')).toBeTruthy();
    expect(document.querySelector('.bz-password-vault-desk')).toBeTruthy();
    expect(document.querySelector('.bz-password-vault-nav')).toBeTruthy();
    expect(document.querySelector('.bz-password-vault-list')).toBeTruthy();
    expect(document.querySelector('.bz-password-vault-detail')).toBeTruthy();
    expect(document.querySelector('.bz-password-vault-mob')).toBeTruthy();
    expect(document.querySelector('.bz-password-vault-moblist')).toBeTruthy();
    expect(document.querySelectorAll('.bz-password-vault-lock').length).toBe(2);
    expect(document.querySelectorAll('.bz-password-vault-modal').length).toBe(2);
    expect(document.querySelectorAll('.bz-password-vault-pop2').length).toBe(4); // 2 confirm + 2 platEdit
    expect(document.querySelectorAll('.bz-password-vault-toast').length).toBe(2);
    // 标题改为「密码本」；无 cmenu/sheet/lockstate（右键菜单/抽屉走 bz item-actions）
    expect(document.querySelector('.bz-password-vault-logo .name')!.textContent).toContain('密码本');
    expect(document.querySelectorAll('.bz-password-vault-cmenu').length).toBe(0);
    expect(document.querySelectorAll('.bz-password-vault-sheet').length).toBe(0);
    expect(document.querySelectorAll('.bz-password-vault-lockstate').length).toBe(0);
  });

  it('show：未解锁 → 锁屏 open；解锁后锁屏关闭、列表渲染', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x', fav: true });
    ui.show();
    await new Promise((r) => setTimeout(r, 10));
    // 锁屏应关闭（已解锁）
    expect(document.querySelectorAll('.bz-password-vault-lock.open').length).toBe(0);
    // 列表渲染平台聚合行
    const rows = document.querySelector('.bz-password-vault-rows')!;
    expect(rows.textContent).toContain('GitHub');
    expect(rows.textContent).toContain('★');
  });

  it('未解锁 show → 锁屏 open；标题为「输入主密码」', async () => {
    // 先建主密码再锁定
    await sm.unlock('pw');
    sm.lock();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    const locks = document.querySelectorAll('.bz-password-vault-lock.open');
    expect(locks.length).toBe(2);
    expect(locks[0].querySelector('[data-lock-title]')!.textContent).toBe('输入主密码');
  });

  it('首设：无清单 → 锁屏标题「设置主密码」', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    const locks = document.querySelectorAll('.bz-password-vault-lock.open');
    expect(locks.length).toBe(2);
    expect(locks[0].querySelector('[data-lock-title]')!.textContent).toBe('设置主密码');
  });

  it('已有清单：锁屏标题「输入主密码」+ 正确密码解锁成功（回归：first 取反 bug + 解锁不重载 → 空列表）', async () => {
    // 先建清单 + 设主密码
    await sm.unlock('correct-pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    sm.lock();
    // 模拟真实重启：锁定后内存数据也清空（新会话从磁盘重载）
    dm.pwData = [];
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    const locks = document.querySelectorAll<HTMLElement>('.bz-password-vault-lock.open');
    expect(locks.length).toBe(2);
    expect(locks[0].querySelector('[data-lock-title]')!.textContent).toBe('输入主密码');
    // 输入正确密码 → 解锁 → 锁屏关闭 + 数据从磁盘重载后列表渲染
    (locks[0].querySelector('[data-lock-p1]') as HTMLInputElement).value = 'correct-pw';
    (locks[0].querySelector('[data-lock-go]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 200));
    expect(document.querySelectorAll('.bz-password-vault-lock.open').length).toBe(0);
    expect(dm.unlocked).toBe(true);
    expect(dm.pwData.length).toBe(1);
    expect(document.querySelector('.bz-password-vault-rows')!.textContent).toContain('GitHub');
  });

  it('搜索：输入 → 展平账号行；空结果 → 空态', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    await dm.addItem({ platform: '微信', account: 'wx', password: 'y' });
    ui.show();
    await new Promise((r) => setTimeout(r, 10));
    const search = document.querySelector('.bz-password-vault-search input') as HTMLInputElement;
    search.value = 'GitHub';
    search.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250)); // 防抖 180ms
    const rows = document.querySelector('.bz-password-vault-rows')!;
    expect(rows.querySelectorAll('.bz-password-vault-row').length).toBe(1);
    expect(rows.textContent).toContain('GitHub');
    // 空结果
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    expect(document.querySelector('.bz-password-vault-rows .bz-password-vault-empty')).toBeTruthy();
  });

  it('详情区账号卡：复制账号常驻 + 密码行 + 永不折叠 + 时间简写', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', url: 'https://github.com', account: 'me', password: 'p@ss', note: '主号' });
    ui.show();
    await new Promise((r) => setTimeout(r, 10));
    // 选中平台 → 详情区渲染账号卡
    const row = document.querySelector('.bz-password-vault-rows .bz-password-vault-plrow')!;
    (row as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 10));
    const card = document.querySelector('.bz-password-vault-acctcard')!;
    expect(card).toBeTruthy();
    // 复制账号按钮常驻（data-act="copy-ac"）
    expect(card.querySelector('[data-act="copy-ac"]')).toBeTruthy();
    // 密码行 + 复制密码 + 眼睛
    expect(card.querySelector('[data-act="copy-pw"]')).toBeTruthy();
    expect(card.querySelector('[data-act="eye"]')).toBeTruthy();
    // 永不折叠：无 .details 折叠容器、无 chevron
    expect(card.querySelector('.details')).toBeNull();
    expect(card.querySelector('.chevron')).toBeNull();
    // 备注直显 + 时间简写（无「加密存储」）
    expect(card.textContent).toContain('主号');
    expect(card.textContent).toContain('创建于');
    expect(card.textContent).not.toContain('加密存储');
    // 平台头无头像
    expect(document.querySelector('.bz-password-vault-detailhead .bz-pwv-avatar')).toBeNull();
  });

  it('添加弹窗：字段填充 + fav 默认 false + 保存落盘', async () => {
    await sm.unlock('pw');
    ui.show();
    await new Promise((r) => setTimeout(r, 10));
    ui.openEntryDialog(null);
    const modal = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog')!;
    expect(modal).toBeTruthy();
    const set = (f: string, v: string) => {
      (modal.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value = v;
    };
    set('platform', 'GitHub');
    set('url', 'https://github.com');
    set('account', 'me');
    set('password', 'p@ss');
    set('note', '主号');
    (modal.querySelector('[data-act="save"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(dm.pwData.length).toBe(1);
    expect(dm.pwData[0]).toMatchObject({ platform: 'GitHub', account: 'me', password: 'p@ss', fav: false });
  });

  it('收藏切换：toggleFav 经 UI 落盘', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui.show();
    await new Promise((r) => setTimeout(r, 10));
    await dm.toggleFav(dm.pwData[0].id);
    expect(dm.pwData[0].fav).toBe(true);
    ui.renderAll();
    const rows = document.querySelector('.bz-password-vault-rows')!;
    expect(rows.textContent).toContain('★');
  });

  it('锁屏：无灰色描述（sub/sec/hint），输入框自动聚焦', async () => {
    await sm.unlock('pw');
    sm.lock();
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const lock = document.querySelector('.bz-password-vault-lock.open') as HTMLElement;
    expect(lock.querySelector('[data-lock-sub]')).toBeNull();
    expect(lock.querySelector('[data-lock-sec]')).toBeNull();
    expect(lock.querySelector('[data-lock-hint]')).toBeNull();
    // 聚焦（jsdom：activeElement 与查询元素引用可能不同，用 placeholder 区分）
    const active = document.activeElement as HTMLInputElement | null;
    expect(active && active.getAttribute('placeholder')).toBe('主密码');
  });

  it('遮罩点击关闭窗口', async () => {
    await sm.unlock('pw');
    ui.show();
    await new Promise((r) => setTimeout(r, 10));
    expect(ui.root!.style.display).toBe('flex');
    // 点击根容器（卡片外遮罩）
    ui.root!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ui.root!.style.display).toBe('none');
  });

  it('在该平台新增账号：弹窗预填平台和链接', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', url: 'https://github.com', account: 'me', password: 'x' });
    ui.show();
    await new Promise((r) => setTimeout(r, 10));
    ui.openEntryDialog(null, { platform: 'GitHub', url: 'https://github.com' });
    const dlg = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog')!;
    expect((dlg.querySelector('[data-f="platform"]') as HTMLInputElement).value).toBe('GitHub');
    expect((dlg.querySelector('[data-f="url"]') as HTMLInputElement).value).toBe('https://github.com');
  });

  it('移动端顶栏关闭按钮：点击 → 关闭窗口', async () => {
    await sm.unlock('pw');
    ui.show();
    await new Promise((r) => setTimeout(r, 10));
    expect(ui.root!.style.display).toBe('flex');
    (ui.root!.querySelector('[data-act="mob-close"]') as HTMLButtonElement).click();
    expect(ui.root!.style.display).toBe('none');
  });

  it('次级面板：打开后点击遮罩关闭，面板内不关闭', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui.show();
    await new Promise((r) => setTimeout(r, 10));
    // 打开平台详情页（点击移动端平台卡）
    const card = document.querySelector('.bz-password-vault-mobcard')!;
    expect(card).toBeTruthy();
    (card as HTMLElement).click();
    const page = document.querySelector('.bz-password-vault-mobpage')!;
    expect(page.classList.contains('open')).toBe(true);
    // 面板内点击不关闭
    const sheet = page.querySelector('.bz-password-vault-mobsheet')!;
    sheet.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(page.classList.contains('open')).toBe(true);
    // 遮罩点击关闭
    page.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(page.classList.contains('open')).toBe(false);
  });
});
