/**
 * 统一保险库工作台 UI 测试（encrypt 域，ADR-0085；ADR-0155 密码资产视图摘除后收敛版）
 * 覆盖：三栏骨架 DOM（nav/列表/详情 + 移动端 seg）、资产导航收敛（概览/笔记；密码视图
 * 已退役——直通 pw 资产兜底落笔记且不渲染任何密码元素）、密码镜像 SafeNote 不进面板、
 * 加密笔记视图切换渲染、日记移动端详情抽屉、锁屏态（未解锁 show → 锁屏）、
 * 安全模式自动上锁（含共享密码明文缓存清空）、销毁加密笔记二次确认。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { UIManager } from '../../src/encrypt/ui';
import { PasswordVaultDataManager } from '../../src/password-vault/data';
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
};

describe('统一保险库工作台（UIManager；ADR-0155 收敛为加密笔记 + 加密日记）', () => {
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
    expect(items.map((i) => i.getAttribute('data-asset'))).toEqual(['overview', 'note']);
    expect(document.querySelector('.bz-vault-listcol')).toBeTruthy();
    expect(document.querySelector('.bz-vault-detail')).toBeTruthy();
    // 顶栏三按钮（health/lock-note/close）2026-09-12 按评审移除：顶栏只留标题
    expect(document.querySelector('.bz-vault-bar [data-act]')).toBeNull();
    expect(document.querySelector('[data-vault-title]')).toBeTruthy();
    expect(document.querySelector('[data-act="settings"]')).toBeNull();
    expect(document.querySelector('[data-act="gen"]')).toBeNull();
    // 面板空白处右键 → 面板菜单（保险库设置/体检入口）
    ui.popup!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    const menuTexts = [...document.querySelectorAll('.bz-item-menu-item')].map((b) => b.textContent!.trim());
    expect(menuTexts).toContain('保险库设置');
    expect(menuTexts).toContain('保险库体检');
    // 移动端 seg
    expect([...document.querySelectorAll('.bz-vault-mseg .sg')].map((i) => i.getAttribute('data-masset'))).toEqual(['overview', 'note']);
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

  it('ADR-0155 摘除断言：直通 pw 资产兜底落笔记，不渲染任何密码视图元素', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'p@ss', fav: true });
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-detail > .bz-vault-area'));
    // 入口收敛：nav/seg 均无 pw/diary 项
    const navAssets = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].map((i) => i.getAttribute('data-asset'));
    expect(navAssets).not.toContain('pw');
    expect(navAssets).not.toContain('diary');
    // 密码视图已退役：直通置 pw 资产 → 渲染分支只剩笔记/日记口径（按非日记渲染），无任何密码元素
    (ui as any).asset = 'pw';
    ui.renderAll();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('.bz-vault-listcol')!.textContent).not.toContain('GitHub');
    expect(document.querySelectorAll('.bz-pwv-plrow, .bz-pwv-row, .bz-pwv-acctcard, .bz-vault-dlg').length).toBe(0);
    // 正规导航兜底：pw 残留值经 setAssetFromNav 统一落 note
    (ui as any).setAssetFromNav('pw');
    expect(ui.asset).toBe('note');
  });

  it('密码镜像 SafeNote（kind=password-vault）不进 encrypt 面板任何资产列表', async () => {
    await sm.lockNote({ path: '笔记/a.md', title: '笔记A', content: '# a', attachments: [] });
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' }); // 密码整表镜像 = kind=password-vault 一条
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-detail > .bz-vault-area'));
    // 概览计数只算库内加密资产（笔记 + 日记），不含密码镜像
    expect(document.querySelector('[data-cnt="overview"]')!.textContent).toBe('1');
    expect(document.querySelector('[data-cnt="note"]')!.textContent).toBe('1');
    // 笔记列表不含密码镜像（无「密码本」标题条目）
    (ui as any).setAssetFromNav('note');
    await new Promise((r) => setTimeout(r, 30));
    const rows = [...document.querySelectorAll('.bz-vault-listcol .bz-vault-row')];
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('笔记A');
  });

  it('加密笔记视图：show 后点「笔记」→ 空态提示（无笔记）', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const noteItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'note') as HTMLElement;
    noteItem.click();
    await new Promise((r) => setTimeout(r, 20));
    const list = document.querySelector('.bz-vault-listcol')!;
    expect(list.textContent).toContain('还没有笔记');
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

  it('安全模式：hide 自动上锁 + 共享锁双清（SafeManager 与密码明文缓存同清）', async () => {
    const cfg = { ...CONFIG, securityMode: true };
    const ui2 = new UIManager(sm, cfg, dm);
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui2.show();
    await new Promise((r) => setTimeout(r, 30));
    ui2.hide();
    expect(sm.unlocked).toBe(false);
    expect(dm.unlocked).toBe(false);
    expect(dm.pwData.length).toBe(0); // 密码本包装层明文缓存随共享锁清出
    // 清理：移除 DOM（UIManager 无 cleanup——统一由 Controller.cleanup 收口）
    ui2.popup?.remove();
    ui2.mask?.remove();
  });

  it('E6：移动端日记详情 ⋮ 直接开底部抽屉（旧 tmp.click() 触发不了长按/右键手势致按钮失效）', async () => {
    await sm.lockNote({
      path: '我的/日记/2025-06-01.md',
      title: '2025-06-01 · 09:00 日记',
      kind: 'diary-entry',
      content: '# 📖🔐 09:00\n正文',
      attachments: [],
    });
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    ui.asset = 'diary'; // nav 日记入口已收敛；日记视图保留，直通置资产回归
    ui.renderAll();
    await new Promise((r) => setTimeout(r, 30));
    // 移动端列表行 → 详情二级页
    const mobRow = document.querySelector('[data-mob-body] .bz-vault-row') as HTMLElement;
    expect(mobRow).toBeTruthy();
    mobRow.click();
    const page = document.querySelector('.bz-vault-mobpage') as HTMLElement;
    expect(page).toBeTruthy();
    // ⋮ → 底部抽屉（预览/还原/销毁全入口可达）
    (page.querySelector('[data-mob-menu]') as HTMLElement).click();
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).toBeTruthy();
    expect(sheet.textContent).toContain('预览正文');
    expect(sheet.textContent).toContain('还原回日记');
    expect(sheet.textContent).toContain('彻底销毁');
  });

  // issue 291 评审补：encrypt 的 askConfirm 走 core 流程框（与 password-vault 的域内自绘确认不同），
  // 因此删除/销毁类主动作必须由调用方显式传 danger —— 这里直接验参数语义（两条分支）。
  it('askConfirm(danger)：销毁类 → 弹窗挂 bz-flow-dialog--danger；还原类 → 保持普通高亮', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const fired: string[] = [];
    (ui as any).askConfirm('彻底销毁日记', '将永久销毁密文（含附件）。此操作不可撤销。', '永久销毁', true, () =>
      fired.push('destroy')
    );
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    const dangerPopup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(dangerPopup.querySelector('h4')!.textContent).toBe('彻底销毁日记');
    expect(dangerPopup.classList.contains('bz-flow-dialog--danger')).toBe(true);
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(fired).toEqual(['destroy']));

    (ui as any).askConfirm('还原', '将原文还原到原路径？', '还原', false, () => fired.push('restore'));
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    const plainPopup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(plainPopup.classList.contains('bz-flow-dialog--danger')).toBe(false);
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(fired).toEqual(['destroy']);
  });

  it('B 包扫尾：概览空态为 .bz-empty 三件套（图标 + 标题 + 描述），不再是单行灰字', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const empty = document.querySelector('.bz-empty') as HTMLElement;
    expect(empty).toBeTruthy();
    expect(empty.querySelector('.bz-empty-ic')).toBeTruthy();
    expect(empty.querySelector('.bz-empty-title')!.textContent).toBe('还没有动态');
    expect(empty.querySelector('.bz-empty-desc')!.textContent).toContain('最近动态在这里显示');
  });

  it('销毁加密笔记：重输主密码二次确认——错密码行内报错不销毁，对密码销毁并刷新', async () => {
    await sm.lockNote({ path: '笔记/n.md', title: '机密笔记', content: '# x', attachments: [] });
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    ui.asset = 'note';
    ui.renderAll();
    await new Promise((r) => setTimeout(r, 30));
    // 详情卡「销毁」→ 确认窗（复用共享解锁屏骨架，挂 body 全屏遮罩）
    (document.querySelector('[data-detail="delete"]') as HTMLElement).click();
    const mask = document.querySelector('.bz-lockscreen--mask') as HTMLElement;
    expect(mask).toBeTruthy();
    expect(mask.textContent).toContain('销毁确认');
    expect(mask.textContent).toContain('机密笔记');
    // 错密码：行内报错（含「未销毁」），条目保留
    const input = mask.querySelector('input.bz-lockscreen-input') as HTMLInputElement;
    input.value = 'wrong';
    (mask.querySelector('.bz-lockscreen-action') as HTMLElement).click();
    await waitFor(() => (document.querySelector('.bz-lockscreen-err')?.textContent || '').includes('主密码错误'));
    expect(sm.manifest.notes.length).toBe(1);
    // 对密码：确认销毁，弹窗关闭 + 条目移除
    input.value = 'pw';
    (mask.querySelector('.bz-lockscreen-action') as HTMLElement).click();
    await waitFor(() => sm.manifest.notes.length === 0);
    expect(mask.isConnected).toBe(false);
  });
});
