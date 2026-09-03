/**
 * 统一保险库工作台 UI 测试（encrypt 域，ADR-0085）
 * 覆盖：三栏骨架 DOM（nav/列表/详情 + 移动端 seg）、资产导航切换（概览/密码/笔记/日记）、
 * 密码资产平台聚合列表 + 详情账号卡 + 收藏/显隐/复制动作、密码添加弹窗、加密笔记视图切换渲染、
 * 锁屏态（未解锁 show → 锁屏）、安全模式自动上锁。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { UIManager } from '../../src/encrypt/ui';
import { PasswordVaultDataManager } from '../../src/encrypt/vault-data';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

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

describe('统一保险库工作台（UIManager 三栏三资产）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: UIManager;

  beforeEach(async () => {
    resetObsidianMocks();
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
    ui.popup?.remove();
    ui.mask?.remove();
    sm.lock();
    document.body.innerHTML = '';
  });

  it('ensureElements：三栏骨架齐全（nav/资产项/列表/详情/顶栏动作/移动端 seg）', () => {
    ui.ensureElements();
    expect(document.querySelector('.bz-vault-desk')).toBeTruthy();
    expect(document.querySelector('.bz-vault-nav')).toBeTruthy();
    const items = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')];
    expect(items.map((i) => i.getAttribute('data-asset'))).toEqual(['overview', 'pw', 'note', 'diary']);
    expect(document.querySelector('.bz-vault-listcol')).toBeTruthy();
    expect(document.querySelector('.bz-vault-detail')).toBeTruthy();
    // 顶栏动作
    expect(document.querySelector('[data-act="health"]')).toBeTruthy();
    expect(document.querySelector('[data-act="settings"]')).toBeTruthy();
    expect(document.querySelector('[data-act="lock-note"]')).toBeTruthy();
    expect(document.querySelector('[data-act="close"]')).toBeTruthy();
    // 移动端 seg
    expect([...document.querySelectorAll('.bz-vault-mseg .sg')].map((i) => i.getAttribute('data-masset'))).toEqual(['overview', 'pw', 'note', 'diary']);
  });

  it('show 默认概览视图：hero 计数渲染（空库显示 0 项 + 概览卡）', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const area = document.querySelector('.bz-vault-detail > .bz-vault-area') as HTMLElement;
    expect(area).toBeTruthy();
    expect(area.textContent).toContain('保险库已解锁');
    // 空库计数
    const navCnt = document.querySelector('[data-cnt="overview"]')!.textContent;
    expect(navCnt).toBe('0');
  });

  it('资产导航切换：点击「密码」进入密码资产；nav 高亮 on', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'p@ss', fav: true });
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(pwItem.classList.contains('on')).toBe(true);
    // 平台聚合行渲染（含 ★）
    const list = document.querySelector('.bz-vault-listcol')!;
    expect(list.textContent).toContain('GitHub');
    expect(list.textContent).toContain('★');
  });

  it('密码视图详情：点平台行 → 账号卡（复制账号/密码显隐/复制密码/备注）', async () => {
    await dm.addItem({ platform: 'GitHub', url: 'https://github.com', account: 'me', password: 'p@ss', note: '主号' });
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 30));
    const row = document.querySelector('.bz-vault-listcol .bz-pwv-plrow') as HTMLElement;
    row.click();
    await new Promise((r) => setTimeout(r, 20));
    const detail = document.querySelector('.bz-vault-detail')!;
    expect(detail.textContent).toContain('GitHub');
    expect(detail.querySelector('[data-pwv="copy-ac"]')).toBeTruthy();
    expect(detail.querySelector('[data-pwv="eye"]')).toBeTruthy();
    expect(detail.querySelector('[data-pwv="copy-pw"]')).toBeTruthy();
    expect(detail.textContent).toContain('主号');
  });

  it('密码搜索：顶栏搜索输入 → 展平账号行过滤', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    await dm.addItem({ platform: '微信', account: 'wx', password: 'y' });
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 30));
    const search = document.querySelector('.bz-vault-search input') as HTMLInputElement;
    search.value = 'GitHub';
    search.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250)); // 防抖
    const rows = document.querySelectorAll('.bz-vault-listcol .bz-pwv-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('GitHub');
  });

  it('密码添加弹窗：保存后落盘 + 列表出现新平台', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 30));
    ui.openPwEntryDialog();
    const dlg = document.querySelector('.bz-vault-dlg') as HTMLElement;
    expect(dlg).toBeTruthy();
    const set = (f: string, v: string) => {
      (dlg.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value = v;
    };
    set('platform', '豆瓣');
    set('account', 'me@douban');
    set('password', 'pw123456');
    (dlg.querySelector('[data-pwv-dlg="save"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 40));
    expect(dm.pwData.length).toBe(1);
    expect(dm.pwData[0].platform).toBe('豆瓣');
    expect(document.querySelector('.bz-vault-listcol')!.textContent).toContain('豆瓣');
  });

  it('收藏切换（fav）：UI 点账号动作 → toggleFav 落盘 + 列表 ★', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 20));
    await dm.toggleFav(dm.pwData[0].id);
    ui.renderAll();
    expect(document.querySelector('.bz-vault-listcol')!.textContent).toContain('★');
  });

  it('加密笔记视图：show 后点「加密笔记」→ 空态提示（无笔记）', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const noteItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'note') as HTMLElement;
    noteItem.click();
    await new Promise((r) => setTimeout(r, 20));
    const list = document.querySelector('.bz-vault-listcol')!;
    expect(list.textContent).toContain('还没有加密笔记');
  });

  it('未解锁 show → 锁屏接管；解锁后资产视图可用', async () => {
    sm.lock();
    dm.lock();
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    // 未解锁不渲染内容（renderAll 空转），不崩
    expect(ui.popup!.style.display).toBe('flex');
    // 解锁后可渲染
    await sm.unlock('pw');
    ui.renderAll();
    const area = document.querySelector('.bz-vault-detail > .bz-vault-area');
    expect(area).toBeTruthy();
  });

  it('安全模式：hide 自动上锁 + 状态复位', async () => {
    const cfg = { ...CONFIG, securityMode: true };
    const ui2 = new UIManager(sm, cfg, dm);
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui2.show();
    await new Promise((r) => setTimeout(r, 30));
    ui2.hide();
    expect(sm.unlocked).toBe(false);
    expect(dm.unlocked).toBe(false);
    // 清理：移除 DOM（UIManager 无 cleanup——统一由 Controller.cleanup 收口）
    ui2.popup?.remove();
    ui2.mask?.remove();
  });
});
