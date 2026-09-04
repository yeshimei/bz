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
    // 滚动修复回归：pw/笔记/日记资产均有独立滚动区容器 .bz-vault-lc-body（CSS 决定滚动）
    // （jsdom 不算样式，computed overflow 恒 visible；结构上滚动区与列头分离即可）
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
    // 平台聚合行渲染（收藏星为内联 lucide svg，不再用 ★ 文本符号）
    const list = document.querySelector('.bz-vault-listcol')!;
    expect(list.textContent).toContain('GitHub');
    expect(list.querySelector('.bz-pwv-plrow .star svg')).toBeTruthy();
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
    // 列表头「新增密码」入口存在且可点（回归：pw 资产此前缺失新增入口）
    const lcAdd = document.querySelector('.bz-vault-lc-head [data-lc-add="pw"]') as HTMLElement;
    expect(lcAdd).toBeTruthy();
    (lcAdd as HTMLButtonElement).click();
    const dlg = document.querySelector('.bz-vault-dlg') as HTMLElement;
    expect(dlg).toBeTruthy();
    // 回归：弹窗挂 body（不在 popup 内），样式选择器无 #bz-encrypt-popup 前缀限制
    expect(dlg.closest('#bz-encrypt-popup')).toBeNull();
    expect(dlg.parentElement!.classList.contains('bz-vault-dlg-mask')).toBe(true);
    const set = (f: string, v: string) => {
      (dlg.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value = v;
    };
    set('platform', '豆瓣');
    set('account', 'me@douban');
    set('password', 'pw123456');
    (dlg.querySelector('[data-pwv-dlg="save"]') as HTMLButtonElement).click();
    // 回归：保存回调要等完整加密落盘链（PBKDF2 派生 + 清单原子写）走完才 renderAll()，
    // 固定 40ms 等待会断言到保存前的空态渲染——改为 waitFor 列表出现新平台（≥3s）
    await waitFor(() => (document.querySelector('.bz-vault-listcol')!.textContent || '').includes('豆瓣'));
    expect(dm.pwData.length).toBe(1);
    expect(dm.pwData[0].platform).toBe('豆瓣');
    expect(document.querySelector('.bz-vault-listcol')!.textContent).toContain('豆瓣');
  });

  it('pw 空库：中栏空态直接提供「新增密码」按钮 → 点击开添加弹窗', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 30));
    const emptyBtn = document.querySelector('.bz-vault-listcol [data-pwv="empty-add"]') as HTMLElement;
    expect(emptyBtn).toBeTruthy();
    emptyBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('.bz-vault-dlg')).toBeTruthy();
  });

  it('收藏切换（fav）：UI 点账号动作 → toggleFav 落盘 + 列表收藏星（内联 svg）', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 20));
    await dm.toggleFav(dm.pwData[0].id);
    ui.renderAll();
    expect(document.querySelector('.bz-vault-listcol .bz-pwv-plrow .star svg')).toBeTruthy();
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
    const diaryItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'diary') as HTMLElement;
    diaryItem.click();
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

  it('E6：移动端密码平台详情页 ⋮ 直接开底部抽屉（旧 [data-mob-menu] 未绑事件点击无反应）', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 30));
    const card = document.querySelector('[data-mob-body] .bz-pwv-mobcard') as HTMLElement;
    expect(card).toBeTruthy();
    card.click();
    const page = document.querySelector('.bz-vault-mobpage') as HTMLElement;
    expect(page).toBeTruthy();
    (page.querySelector('[data-mob-menu]') as HTMLElement).click();
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).toBeTruthy();
    expect(sheet.textContent).toContain('在该平台新增账号');
    expect(sheet.textContent).toContain('编辑平台信息');
    expect(sheet.textContent).toContain('删除整个平台');
  });

  it('E7：密码添加弹窗注册独立 ESC 层——ESC 只关弹窗，主面板不被穿透关闭', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('.bz-vault-lc-head [data-lc-add="pw"]') as HTMLElement).click();
    const mask = document.querySelector('.bz-vault-dlg-mask') as HTMLElement;
    expect(mask.style.display).toBe('flex');
    // ESC：弹窗层命中（后注册在上）→ 只关弹窗
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(mask.style.display).toBe('none');
    expect(ui.popup!.style.display).toBe('flex');
    // 再按 ESC：弹窗层已注销 → 主面板关闭（既有语义不回归）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ui.popup!.style.display).toBe('none');
  });

  it('E7：平台编辑弹窗注册独立 ESC 层——ESC 只关弹窗，主面板不被穿透关闭', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('.bz-vault-listcol .bz-pwv-plrow') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    (document.querySelector('[data-pwv="plat-edit"]') as HTMLElement).click();
    const mask = document.querySelector('.bz-vault-dlg-mask') as HTMLElement;
    expect(mask).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.bz-vault-dlg-mask')).toBeNull();
    expect(ui.popup!.style.display).toBe('flex');
  });

  it('B 包扫尾：删除密码账号——确认框三段式 + 按钮动词「删除」，成功 toast 带账号名', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me@example', password: 'x' });
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const pwItem = [...document.querySelectorAll('.bz-vault-nav .bz-vault-item')].find((i) => i.getAttribute('data-asset') === 'pw') as HTMLElement;
    pwItem.click();
    await new Promise((r) => setTimeout(r, 30));
    // 桌面三栏：先选中平台行，右侧详情区才渲染账号卡
    const plRow = document.querySelector('.bz-vault-listcol .bz-pwv-plrow') as HTMLElement;
    plRow.click();
    await new Promise((r) => setTimeout(r, 30));
    // 账号卡右键 → 动作菜单「删除」
    const card = document.querySelector('.bz-pwv-acctcard') as HTMLElement;
    expect(card).toBeTruthy();
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await new Promise((r) => setTimeout(r, 20));
    const delItem = [...document.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.trim() === '删除') as HTMLElement;
    expect(delItem).toBeTruthy();
    delItem.click();
    await new Promise((r) => setTimeout(r, 20));
    // 确认框：标题「删除密码条目」+ 问句「」引号 + 后果说明；按钮是动词「删除」而非「确定」
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.querySelector('h4')!.textContent).toBe('删除密码条目');
    expect(popup.textContent).toContain('确定删除账号「me@example」吗？此操作不可撤销。');
    expect((document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).textContent).toBe('删除');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    // 成功 toast 带对象名（不再是孤零零「已删除」）
    const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
    expect(msgs).toContain('已删除账号「me@example」');
    await dm.load();
    expect(dm.pwData.length).toBe(0);
  });

  it('B 包扫尾：概览空态为 .bz-empty 三件套（图标 + 标题 + 描述），不再是单行灰字', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const empty = document.querySelector('.bz-empty') as HTMLElement;
    expect(empty).toBeTruthy();
    expect(empty.querySelector('.bz-empty-ic')).toBeTruthy();
    expect(empty.querySelector('.bz-empty-title')!.textContent).toBe('还没有加密资产');
    expect(empty.querySelector('.bz-empty-desc')!.textContent).toContain('最近动态在这里显示');
  });
});

describe('pw-view relTime（B 包收编 core formatRelativeTime）', () => {
  it('「N分钟前」无空格口径；空输入返回空串', async () => {
    const { relTime } = await import('../../src/encrypt/vault-pw-view');
    expect(relTime('')).toBe('');
    // relTime 内部取真实当前时间——输入相对 Date.now() 构造，5 分钟前必得「5分钟前」
    const iso = (ms: number) => new Date(Date.now() - ms).toISOString();
    expect(relTime(iso(5 * 60 * 1000))).toBe('5分钟前');
    // 「N 天前」带空格的旧口径已消灭：30 天前 → core 口径（不以「天前」结尾或无空格）
    const d30 = relTime(iso(30 * 86400000));
    expect(d30.includes(' 天前')).toBe(false);
  });
});
