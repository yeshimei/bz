/**
 * 密码本全域深审拍板后修复批（呈报 #3/#21/#16/#12-P3）回归测试。
 * 命名独立（bd-password-vault-fix-*）防撞其他批次。
 *
 * - P6（呈报#3）：添加弹窗已手填密码再点「生成」→ 先确认再覆盖；密码框为空 → 直接生成。
 * - P2（呈报#21）：账号/密码为空时点复制 → 提示「该条目无账号/密码」且不执行复制，
 *   不再虚报「已复制」。
 * - P4（呈报#16①）：移动端顶栏补「全部/收藏」切换，与桌面导航双端联动。
 * - P5（呈报#16②）：移动详情页账号段网址变可点链接，点击走 core openExternalUrl 单源。
 * - P3（呈报#12-P3）：快速取密选择器键盘导航圈闭——↑↓/Enter 挂弹窗容器级，
 *   焦点出搜索框仍可键盘选中，焦点不丢。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { PasswordVaultDataManager, type PasswordVaultEntry } from '../../src/password-vault/data';
import { PasswordVaultUIManager } from '../../src/password-vault/ui';
import { openPasswordQuickPicker, closePasswordQuickPicker, type QuickPickAction } from '../../src/password-vault/quick-pick';
import { mobSegHtml } from '../../src/password-vault/render';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';

async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 20));
  }
}

function entry(over: Partial<PasswordVaultEntry>): PasswordVaultEntry {
  return {
    id: over.id || 'pw-1',
    platform: over.platform ?? 'GitHub',
    url: over.url ?? '',
    account: over.account ?? 'me',
    password: over.password ?? 'secret',
    note: over.note ?? '',
    createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
    fav: over.fav ?? false,
  };
}

describe('P6：添加弹窗「生成」覆盖已填密码前先确认', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: PasswordVaultUIManager;

  beforeEach(async () => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    localStorage.clear();
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ passwordCharset: '', passwordLength: '16', securityMode: false }) as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    dm = new PasswordVaultDataManager(sm);
    ui = new PasswordVaultUIManager(dm, { charset: '', length: '16', securityMode: false });
    await sm.unlock('pw');
    ui.ensureElements();
  });

  afterEach(() => {
    ui.cleanup();
    sm.lock();
    document.body.innerHTML = '';
  });

  /** 桌面实例弹窗的密码框与生成钮 */
  function deskDialog() {
    const modal = document.querySelector('.bz-password-vault-modal[data-modal="desk"]') as HTMLElement;
    return {
      pw: modal.querySelector('[data-f="password"]') as HTMLInputElement,
      gen: modal.querySelector('[data-act="gen"]') as HTMLButtonElement,
    };
  }

  it('密码框非空：点生成先弹确认框，确认前不覆盖原值', () => {
    ui.openEntryDialog(null);
    const { pw, gen } = deskDialog();
    pw.value = '手填的密码';
    gen.click();
    // 确认框已出现（core openFlowDialog），原值原样保留
    expect(document.querySelector('.bz-flow-dialog')).toBeTruthy();
    expect(pw.value).toBe('手填的密码');
  });

  it('密码框非空：确认后覆盖为新生成值（旧值不保留）', async () => {
    ui.openEntryDialog(null);
    const { pw, gen } = deskDialog();
    pw.value = '手填的密码';
    gen.click();
    // 两动作流程框：确定钮 = FLOW_DIALOG_OK_ID（openFlowDialog resolve 在微任务，点击后让一轮队列）
    const okBtn = document.getElementById('__shared_confirm_ok__') as HTMLButtonElement;
    expect(okBtn.textContent).toBe('确定');
    okBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(pw.value).not.toBe('手填的密码');
    expect(pw.value.length).toBeGreaterThan(0);
    expect(document.querySelector('.bz-flow-dialog')).toBeNull();
  });

  it('密码框非空：取消确认则原值不动', async () => {
    ui.openEntryDialog(null);
    const { pw, gen } = deskDialog();
    pw.value = '手填的密码';
    gen.click();
    const cancelBtn = document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement;
    expect(cancelBtn.textContent).toBe('取消');
    cancelBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(pw.value).toBe('手填的密码');
  });

  it('密码框为空：点生成直接出值，不加确认步骤', () => {
    ui.openEntryDialog(null);
    const { pw, gen } = deskDialog();
    expect(pw.value).not.toBe(''); // 添加态自动预生成（N13 口径维持）
    pw.value = '';
    gen.click();
    expect(pw.value).not.toBe('');
    expect(document.querySelector('.bz-flow-dialog')).toBeNull();
  });
});

describe('P2：空账号/密码复制不再虚报成功', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: PasswordVaultUIManager;

  beforeEach(async () => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    localStorage.clear();
    vault = new MockVault();
    const app = mockAppWithVault(vault) as any;
    app.openUrl = vi.fn();
    setApp(app);
    setSettingsProvider(() => ({ passwordCharset: '', passwordLength: '16', securityMode: false }) as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    dm = new PasswordVaultDataManager(sm);
    ui = new PasswordVaultUIManager(dm, { charset: '', length: '16', securityMode: false });
    await sm.unlock('pw');
    await dm.addItem({ platform: 'Bare', account: '', password: '' } as any);
    ui.ensureElements();
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-password-vault-plrow'));
  });

  afterEach(() => {
    ui.cleanup();
    sm.lock();
    document.body.innerHTML = '';
  });

  it('账号卡：空账号点「复制账号」提示该条目无账号，不报已复制', async () => {
    // 选中平台 → 详情区出账号卡
    (document.querySelector('.bz-password-vault-plrow') as HTMLElement).click();
    await waitFor(() => !!document.querySelector('[data-act="copy-ac"]'));
    clearNotices();
    (document.querySelector('[data-act="copy-ac"]') as HTMLButtonElement).click();
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('该条目无账号');
    expect(msgs).not.toContain('已复制');
  });

  it('账号卡：空密码点「复制密码」提示该条目无密码，不报已复制', async () => {
    (document.querySelector('.bz-password-vault-plrow') as HTMLElement).click();
    await waitFor(() => !!document.querySelector('[data-act="copy-pw"]'));
    clearNotices();
    (document.querySelector('[data-act="copy-pw"]') as HTMLButtonElement).click();
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('该条目无密码');
    expect(msgs).not.toContain('已复制');
  });

  it('右键菜单/抽屉动作：空值同口径拦截（复制账号/复制密码）', () => {
    const d = dm.pwData.find((x) => x.platform === 'Bare')!;
    const actions = (ui as any).buildAccountActions(d) as Array<{ label: string; onClick: () => void }>;
    clearNotices();
    actions.find((a) => a.label === '复制账号')!.onClick();
    actions.find((a) => a.label === '复制密码')!.onClick();
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('该条目无账号');
    expect(msgs).toContain('该条目无密码');
    expect(msgs).not.toContain('已复制');
  });

  it('平台动作：最近账号为空时「复制最近账号/密码」同口径拦截', () => {
    const actions = (ui as any).buildPlatformActions('Bare') as Array<{ label: string; onClick: () => void }>;
    clearNotices();
    actions.find((a) => a.label === '复制最近账号')!.onClick();
    actions.find((a) => a.label === '复制最近密码')!.onClick();
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('该条目无账号');
    expect(msgs).toContain('该条目无密码');
    expect(msgs).not.toContain('已复制');
  });
});

describe('P4：移动端顶栏「全部/收藏」切换（与桌面导航双端联动）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: PasswordVaultUIManager;

  beforeEach(async () => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    localStorage.clear();
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => ({ passwordCharset: '', passwordLength: '16', securityMode: false }) as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    dm = new PasswordVaultDataManager(sm);
    ui = new PasswordVaultUIManager(dm, { charset: '', length: '16', securityMode: false });
    await sm.unlock('pw');
    await dm.addItem({ platform: 'Plain', account: 'a', password: 'p' } as any);
    ui.ensureElements();
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-password-vault-plrow'));
  });

  afterEach(() => {
    ui.cleanup();
    sm.lock();
    document.body.innerHTML = '';
  });

  it('移动顶栏存在全部/收藏两个切换钮', () => {
    const tabs = [...document.querySelectorAll('[data-mobview]')];
    expect(tabs.map((t) => t.getAttribute('data-mobview'))).toEqual(['all', 'fav']);
  });

  it('点「已收藏」：view 切到 fav、双端高亮联动、列表只剩收藏平台', async () => {
    (document.querySelector('[data-mobview="fav"]') as HTMLElement).click();
    expect(ui.view).toBe('fav');
    // 桌面导航 on 态同步
    const deskOn = document.querySelector('.bz-password-vault-navitem.on');
    expect(deskOn!.getAttribute('data-view')).toBe('fav');
    // 移动 tabs on 态同步
    const mobOn = document.querySelector('[data-mobview].on');
    expect(mobOn!.getAttribute('data-mobview')).toBe('fav');
    // 无收藏 → fav 空态
    await waitFor(() => document.querySelector('.bz-password-vault-rows')!.textContent!.includes('还没有收藏'));
  });

  it('点「全部」切回：列表恢复全量', async () => {
    (document.querySelector('[data-mobview="fav"]') as HTMLElement).click();
    await waitFor(() => document.querySelector('.bz-password-vault-rows')!.textContent!.includes('还没有收藏'));
    (document.querySelector('[data-mobview="all"]') as HTMLElement).click();
    expect(ui.view).toBe('all');
    await waitFor(() => document.querySelector('.bz-password-vault-rows')!.textContent!.includes('Plain'));
  });

  it('桌面导航切换同样联动移动 tabs 高亮', () => {
    (document.querySelector('.bz-password-vault-navitem[data-view="fav"]') as HTMLElement).click();
    expect(ui.view).toBe('fav');
    const mobOn = document.querySelector('[data-mobview].on');
    expect(mobOn!.getAttribute('data-mobview')).toBe('fav');
  });
});

describe('P5：移动详情页网址可点（core openExternalUrl 单源）', () => {
  it('mobSegHtml 账号段网址出可点 <a>（data-extlink 标记）', () => {
    const d = entry({ url: 'https://example.com/login' });
    const html = mobSegHtml(d, false, true);
    expect(html).toContain('<a ');
    expect(html).toContain('data-extlink');
    expect(html).toContain('href="https://example.com/login"');
  });

  it('无网址时不出链接占位', () => {
    const html = mobSegHtml(entry({ url: '' }), false, false);
    expect(html).not.toContain('<a ');
  });

  it('移动详情页点击网址 → openExternalUrl（app.openUrl）且不冒泡开卡', async () => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    localStorage.clear();
    const v = new MockVault();
    const app = mockAppWithVault(v) as any;
    app.openUrl = vi.fn();
    setApp(app);
    setSettingsProvider(() => ({ passwordCharset: '', passwordLength: '16', securityMode: false }) as any);
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    const dm2 = new PasswordVaultDataManager(sm2);
    const ui2 = new PasswordVaultUIManager(dm2, { charset: '', length: '16', securityMode: false });
    try {
      await sm2.unlock('pw');
      await dm2.addItem({ platform: 'Linked', account: 'a', password: 'p', url: 'https://example.com/x' } as any);
      ui2.ensureElements();
      ui2.show();
      await waitFor(() => !!document.querySelector('.bz-password-vault-mobcard'));
      // 进移动平台详情页
      (document.querySelector('.bz-password-vault-mobcard') as HTMLElement).click();
      await waitFor(() => !!document.querySelector('.bz-password-vault-mobpage.open'));
      const link = document.querySelector('.bz-password-vault-mobbody a[data-extlink]') as HTMLAnchorElement;
      expect(link).toBeTruthy();
      const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(evt);
      expect(app.openUrl).toHaveBeenCalledWith('https://example.com/x');
      expect(evt.defaultPrevented).toBe(true);
    } finally {
      ui2.cleanup();
      sm2.lock();
      document.body.innerHTML = '';
    }
  });

  it('移动平台页头的网址链接同走 openExternalUrl 单源', async () => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    localStorage.clear();
    const v = new MockVault();
    const app = mockAppWithVault(v) as any;
    app.openUrl = vi.fn();
    setApp(app);
    setSettingsProvider(() => ({ passwordCharset: '', passwordLength: '16', securityMode: false }) as any);
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    const dm2 = new PasswordVaultDataManager(sm2);
    const ui2 = new PasswordVaultUIManager(dm2, { charset: '', length: '16', securityMode: false });
    try {
      await sm2.unlock('pw');
      await dm2.addItem({ platform: 'Head', account: 'a', password: 'p', url: 'https://head.example.com' } as any);
      ui2.ensureElements();
      ui2.show();
      await waitFor(() => !!document.querySelector('.bz-password-vault-mobcard'));
      (document.querySelector('.bz-password-vault-mobcard') as HTMLElement).click();
      await waitFor(() => !!document.querySelector('.bz-password-vault-mobpage.open'));
      const link = document.querySelector('.bz-password-vault-mobplathead a[data-extlink]') as HTMLAnchorElement;
      expect(link).toBeTruthy();
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(app.openUrl).toHaveBeenCalledWith('https://head.example.com');
    } finally {
      ui2.cleanup();
      sm2.lock();
      document.body.innerHTML = '';
    }
  });
});

describe('P3：快速取密选择器键盘导航圈闭（焦点出搜索框不失灵）', () => {
  const seeds: PasswordVaultEntry[] = [
    entry({ id: '1', platform: 'GitHub', account: 'me', createdAt: '2026-01-01T00:00:00.000Z' }),
    entry({ id: '2', platform: 'GitLab', account: 'ci', createdAt: '2026-02-01T00:00:00.000Z' }),
  ];

  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    closePasswordQuickPicker();
    document.body.innerHTML = '';
  });

  function open() {
    const picks: QuickPickAction[] = [];
    openPasswordQuickPicker(seeds, (a) => picks.push(a));
    return picks;
  }

  function activeIdx(): number {
    return [...document.querySelectorAll('#bz-password-vault-qp-popup .bz-popover-item')].findIndex((el) =>
      el.classList.contains('is-on')
    );
  }

  it('列表容器带 listbox 语义、行带 option 语义', () => {
    open();
    expect(document.querySelector('#bz-password-vault-qp-popup .bz-password-vault-qp-list')!.getAttribute('role')).toBe('listbox');
    expect(document.querySelectorAll('#bz-password-vault-qp-popup [role="option"]').length).toBe(3);
  });

  it('焦点移出搜索框后 ↑↓ 仍换活动行（容器级监听圈闭）', () => {
    open();
    const popup = document.getElementById('bz-password-vault-qp-popup')!;
    const search = popup.querySelector('input') as HTMLInputElement;
    // 焦点抖出搜索框（Tab 出框 / 点击弹窗空白等场景）
    search.blur();
    expect(document.activeElement).not.toBe(search);
    const before = activeIdx();
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(activeIdx()).toBe(before + 1);
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    expect(activeIdx()).toBe(before);
  });

  it('焦点在弹窗内任意位置按 Enter 选中当前活动行', () => {
    const picks = open();
    const popup = document.getElementById('bz-password-vault-qp-popup')!;
    const search = popup.querySelector('input') as HTMLInputElement;
    search.blur();
    // 打开时活动行落首个命中（ADR-0158 搜到即复制）；空查询按 createdAt 倒序 → GitLab(02-01) 在前
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(picks).toHaveLength(1);
    expect(picks[0]).toEqual({ type: 'entry', entry: seeds[1] });
    expect(document.getElementById('bz-password-vault-qp-popup')).toBeNull();
  });

  it('↑↓ 不把焦点赶出搜索框（preventDefault 圈闭）', () => {
    open();
    const popup = document.getElementById('bz-password-vault-qp-popup')!;
    const search = popup.querySelector('input') as HTMLInputElement;
    search.focus();
    const evt = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    search.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(search);
  });

  it('点击列表行不抢走搜索框焦点（mousedown 圈闭，选择由 click 完成）', () => {
    open();
    const popup = document.getElementById('bz-password-vault-qp-popup')!;
    const search = popup.querySelector('input') as HTMLInputElement;
    search.focus();
    const row = popup.querySelectorAll('.bz-popover-item')[1] as HTMLElement;
    const evt = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    row.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(search);
  });
});
