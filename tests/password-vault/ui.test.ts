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
import { readLockStats } from '../../src/core/lock-stats';

/** 轮询等待异步落盘/回落完成（fire-and-forget 链无完成信号） */
async function waitForAsync(cond: () => Promise<boolean>, timeout = 4000) {
  const start = Date.now();
  while (!(await cond())) {
    if (Date.now() - start > timeout) throw new Error('waitForAsync 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

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

  it('未解锁 show → 锁屏 open；标题为「密码本已上锁」', async () => {
    // 先建主密码再锁定
    await sm.unlock('pw');
    sm.lock();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    const locks = document.querySelectorAll('.bz-password-vault-lock.open');
    expect(locks.length).toBe(2);
    expect(locks[0].querySelector('[data-ls="title"]')!.textContent).toBe('密码本已上锁');
  });

  it('首设：无清单 → 锁屏标题「设置主密码」', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    const locks = document.querySelectorAll('.bz-password-vault-lock.open');
    expect(locks.length).toBe(2);
    expect(locks[0].querySelector('[data-ls="title"]')!.textContent).toBe('设置主密码');
  });

  it('冷启动锁屏统计回落 lock-stats.json 快照（ADR-0124 决策 4 修订，issue 299）', async () => {
    await vault.create('CONFIG/STORAGE/lock-stats.json', JSON.stringify({
      'password-vault': [{ num: '3', label: '平台' }, { num: '5', label: '口令条目' }, { num: '1', label: '收藏' }],
    }));
    ui.show();
    // hydrate 是 fire-and-forget 链：轮询等首个实例渲染出回落数字，不定长 sleep
    await waitForAsync(async () => {
      const nums = [...document.querySelectorAll('.bz-password-vault-lock.open .bz-lockscreen-num')].map((n) => n.textContent);
      return nums.length >= 3 && nums[0] === '3';
    });
    const nums = [...document.querySelectorAll('.bz-password-vault-lock.open .bz-lockscreen-num')].map((n) => n.textContent);
    expect(nums.slice(0, 3)).toEqual(['3', '5', '1']);
  });

  it('解锁态快照落盘 lock-stats.json（captureLockStats → writeLockStats，issue 299）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x', fav: true });
    ui.show(); // 已解锁 → renderAll → captureLockStats
    await waitForAsync(async () => (await readLockStats('password-vault')) !== null);
    const hit = await readLockStats('password-vault');
    expect(hit!.map((s) => s.num)).toEqual(['1', '1', '1']);
  });

  it('已有清单：锁屏标题「密码本已上锁」+ 正确密码解锁成功（回归：first 取反 bug + 解锁不重载 → 空列表）', async () => {
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
    expect(locks[0].querySelector('[data-ls="title"]')!.textContent).toBe('密码本已上锁');
    // 输入正确密码 → 解锁 → 锁屏关闭 + 数据从磁盘重载后列表渲染
    (locks[0].querySelector('[data-ls="p1"]') as HTMLInputElement).value = 'correct-pw';
    (locks[0].querySelector('[data-ls="go"]') as HTMLButtonElement).click();
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

  // issue 291：首设风险确认走 core/flow-dialog（真实实现，本文件未 mock），
  // 弹窗挂 body —— 必须自带 bz-pwv-flow-dialog 域类，否则金色/材质掉回 core 裸皮。
  it('首设风险确认框挂 bz-pwv-flow-dialog（域皮随行，与统一壳类共存）', async () => {
    ui.show(); // 无清单 → 首设态锁屏（双输入）
    await new Promise((r) => setTimeout(r, 20));
    const lock = document.querySelector('.bz-password-vault-lock.open') as HTMLElement;
    expect(lock).toBeTruthy();
    (lock.querySelector('[data-ls="p1"]') as HTMLInputElement).value = 'abcd';
    (lock.querySelector('[data-ls="p2"]') as HTMLInputElement).value = 'abcd';
    (lock.querySelector('[data-ls="go"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(popup.querySelector('h4')!.textContent).toBe('设置主密码');
    expect(popup.classList.contains('bz-overlay-popup')).toBe(true); // 统一壳（issue 291 核心）
    expect(popup.classList.contains('bz-flow-dialog')).toBe(true);
    expect(popup.classList.contains('bz-pwv-flow-dialog')).toBe(true); // 域皮
    // 刻意不挂危险修饰（issue 291 评审）：本框是「风险告知门」，主动作是把主密码设下去的
    // 正向路径、动作本身不破坏数据，故保留金色主钮；域 CSS 的
    // :not(.bz-flow-dialog--danger) 守卫就是给它的通路（对照下方「仍要重设」用例）。
    expect(popup.classList.contains('bz-flow-dialog--danger')).toBe(false);
    // 收尾：取消（按取消语义结算并移除 DOM，防污染后续用例）
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();
  });

  // issue 291 评审补：「仍要重设」会生成全新空清单、旧加密数据永久无法恢复 —— 破坏性主动作，
  // 必须挂 bz-flow-dialog--danger（core 把主钮整套压回中性次级形制、只留红字，手册 §9/§10）。
  it('清单损坏重设确认：破坏性主动作挂 bz-flow-dialog--danger（主钮不高亮）', async () => {
    await sm.unlock('oldpw'); // 先建清单，避免落进首设分支
    sm.lock();
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc', ''); // 半写崩溃现场：清单为空 → manifestIssue='empty'
    ui.show();
    // 锁屏是异步装配的（isFirstTime → 建锁屏 DOM）：等输入框本体，别只等 .open 外壳
    await vi.waitFor(() =>
      expect(document.querySelector('.bz-password-vault-lock.open [data-ls="p1"]')).toBeTruthy()
    );
    const lock = document.querySelector('.bz-password-vault-lock.open') as HTMLElement;
    (lock.querySelector('[data-ls="p1"]') as HTMLInputElement).value = 'newpw';
    (lock.querySelector('[data-ls="go"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(popup.querySelector('h4')!.textContent).toBe('清单疑似损坏');
    expect(popup.classList.contains('bz-pwv-flow-dialog')).toBe(true);
    expect(popup.classList.contains('bz-flow-dialog--danger')).toBe(true);
    // 收尾：取消（不重设，避免污染后续用例）
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 20));
  });
});
