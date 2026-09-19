/**
 * 深审修复批 C（渲染/列表/弹窗面）回归：
 * - 新-1（P1）弹窗密码行样式：pwdrow flex + dialog 上下文 .mini 规则存在（样式源文本断言，
 *   jsdom 不解析 css 文件，先例 tests/password-vault/skin.test.ts）；
 * - 新-3（P2）弹窗焦点按生效实例取：移动断点落移动实例（软键盘才弹得起）、桌面落桌面实例；
 *   平台编辑弹窗补聚焦；
 * - N17 mobSegHtml data-id escAttr；
 * - 新-6 双实例搜索状态回写（core debounce 收编）；
 * - 新-9 外部变更回调刷新移动详情页；
 * - 新-10 删最后账号清 selPlatform + 删除动作挂 notifyUndo 撤销链（确认框保留）；
 * - 新-11 fav 视图详情空态文案分叉；
 * - 新-13 添加/平台编辑弹窗 Enter 提交（core bindFormSubmit）；
 * - 口径批：toast 档位（常规 info / 大节点 success）、自称「密码本」、DEFAULT_CHARSET 单源、
 *   移动端触控热区修饰类。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { cancelActiveFlowDialog } from '../../src/core/flow-dialog';
import { SafeManager } from '../../src/encrypt/data';
import { PasswordVaultDataManager, DEFAULT_PW_CHARSET, type PasswordVaultEntry } from '../../src/password-vault/data';
import { PasswordVaultUIManager } from '../../src/password-vault/ui';
import { mobSegHtml } from '../../src/password-vault/render';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { clearDomainEvents } from '../../src/core/domain-bus';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

async function flush(ms = 20) {
  await new Promise((r) => setTimeout(r, ms));
}

/** 轮询等待（写盘含真实 PBKDF2，固定短 flush 会撞上保存中途） */
async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** 等 core 流程框（askConfirm 收编后的唯一确认 UI，挂 body）出现 */
async function waitForFlowPopup(): Promise<HTMLElement> {
  await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
  return document.getElementById('__shared_confirm_popup__') as HTMLElement;
}

/** 控制「当前生效实例」断点（activeWhich 与 styles.css 768px 断点同口径）。
 *  测试环境 window.matchMedia 缺失（undefined），直接赋 stub（afterEach unstubAllGlobals 复原）。 */
function mockMobile(mobile: boolean): void {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: mobile && q === '(max-width: 768px)',
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function entryOf(platform: string, account: string, fav = false): PasswordVaultEntry {
  return {
    id: `pw-${Math.random().toString(36).slice(2)}`,
    platform,
    url: '',
    account,
    password: 'pw',
    note: '',
    createdAt: new Date().toISOString(),
    fav,
  };
}

describe('深审修复批 C（password-vault 渲染/列表/弹窗面）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: PasswordVaultUIManager;

  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    clearNotices();
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
    cancelActiveFlowDialog(); // 未决确认框按取消语义结算（防污染后续用例）
    vi.restoreAllMocks(); // 撤 matchMedia spy 等
    vi.unstubAllGlobals();
    ui.cleanup();
    sm.lock();
    document.body.innerHTML = '';
  });

  // ---------- 新-1（P1）：弹窗密码行样式 ----------
  it('新-1：dialog 上下文 pwdrow flex 布局 + .mini 规则（对齐 acctcard 规格，样式源断言）', () => {
    const css = () => repo('src/password-vault/styles.css');
    const block = (sel: string): string | null => {
      const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = css().match(new RegExp(`${esc}\\s*\\{[^}]*\\}`));
      return m ? m[0] : null;
    };
    const row = block('.bz-password-vault-dialog .pwdrow');
    expect(row, '缺 .bz-password-vault-dialog .pwdrow 规则').not.toBeNull();
    expect(row).toContain('display: flex');
    expect(row).toContain('align-items: center');
    const mini = block('.bz-password-vault-dialog .mini');
    expect(mini, '缺 dialog 上下文 .mini 规则（eye 按钮此前裸奔）').not.toBeNull();
    expect(mini).toContain('width: 30px');
    expect(mini).toContain('height: 30px');
    const svg = block('.bz-password-vault-dialog .mini svg');
    expect(svg, '缺 .mini svg 尺寸约束（内嵌 SVG 按 300×150 默认渲染撑坏弹窗）').not.toBeNull();
    expect(svg).toContain('width: 15px');
    // 生成钮收编行内（原全宽条形在 flex 行内会挤压输入框）
    const gen = block('.bz-password-vault-dialog .gen');
    expect(gen).not.toBeNull();
    expect(gen).not.toContain('width: 100%');
  });

  // ---------- 新-3（P2）：弹窗焦点按生效实例取 ----------
  it('新-3：移动断点下添加弹窗焦点落移动实例 platform 输入框', async () => {
    await sm.unlock('pw');
    ui.show();
    await flush(10);
    mockMobile(true);
    ui.openEntryDialog(null);
    const active = document.activeElement as HTMLInputElement;
    expect(active.getAttribute('data-f')).toBe('platform');
    expect(active.closest('.bz-password-vault-mob'), '焦点必须落移动实例（桌面实例 display:none focus 无效）').toBeTruthy();
  });

  it('新-3：桌面断点下焦点落桌面实例；平台编辑弹窗补聚焦', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui.show();
    await flush(10);
    // jsdom matchMedia 恒 false → 桌面断点
    ui.openEntryDialog(null);
    let active = document.activeElement as HTMLInputElement;
    expect(active.getAttribute('data-f')).toBe('platform');
    expect(active.closest('.bz-password-vault-desk')).toBeTruthy();
    (document.querySelector('.bz-password-vault-modal.open [data-act="cancel"]') as HTMLElement).click();
    // 平台编辑弹窗（此前全平台无 focus）
    (ui as any).openPlatformEdit('GitHub');
    active = document.activeElement as HTMLInputElement;
    expect(active.getAttribute('data-f')).toBe('platform');
    expect(active.closest('.bz-password-vault-platedit')).toBeTruthy();
    active.closest('.bz-password-vault-platedit')!.classList.remove('open');
  });

  // ---------- N17：mobSegHtml data-id 转义 ----------
  it('N17：mobSegHtml 的 data-id 走 escAttr，双引号不再吞属性边界', () => {
    const d = entryOf('GitHub', 'me');
    d.id = 'pw-1" onmouseover="x';
    const html = mobSegHtml(d, false, true);
    expect(html).toContain('data-id="pw-1&quot; onmouseover=&quot;x"');
    expect(html).not.toContain('data-id="pw-1" onmouseover="x"');
  });

  // ---------- 新-6：双实例搜索状态回写（core debounce 收编） ----------
  it('新-6：一侧搜索提交后另一实例输入框同步回写（双向）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    await dm.addItem({ platform: '微信', account: 'wx', password: 'y' });
    ui.show();
    await flush(10);
    const desk = document.querySelector('.bz-password-vault-search input') as HTMLInputElement;
    const mob = document.querySelector('.bz-password-vault-mobsearch input') as HTMLInputElement;
    desk.value = 'GitHub';
    desk.dispatchEvent(new Event('input'));
    await flush(260); // 防抖 180ms
    expect(ui.searchKw).toBe('GitHub');
    expect(mob.value, '桌面输入提交后移动实例框应回写同词').toBe('GitHub');
    // 反向：移动输入 → 桌面回写
    mob.value = '微信';
    mob.dispatchEvent(new Event('input'));
    await flush(260);
    expect(desk.value).toBe('微信');
    // 输入中（未提交）不被渲染路径清空：直接 renderAll 不动输入框
    desk.value = 'GitHub 工作中';
    ui.renderAll();
    await flush(10);
    expect(desk.value).toBe('GitHub 工作中');
  });

  // ---------- 新-9：外部变更回调刷新移动详情页 ----------
  it('新-9：外部变更回调重建停驻中的移动详情页', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui.show();
    await flush(10);
    (document.querySelector('.bz-password-vault-mobcard') as HTMLElement).click();
    await flush(10);
    expect(document.querySelector('.bz-password-vault-mobpage')!.classList.contains('open')).toBe(true);
    // 模拟别域写入同清单后重载完成：内存多一条 + 触发外部回调
    dm.pwData.unshift(entryOf('GitHub', 'ext-account'));
    dm.onExternalChange?.();
    await flush(10);
    const body = document.querySelector('.bz-password-vault-mobbody') as HTMLElement;
    expect(body.textContent).toContain('ext-account');
  });

  // ---------- 新-10：删最后账号清 selPlatform + 撤销链 ----------
  it('新-10：删除平台最后一个账号 → selPlatform 清空回列表（详情不留空壳）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    ui.show();
    await flush(10);
    (document.querySelector('.bz-password-vault-rows .bz-password-vault-plrow') as HTMLElement).click();
    await flush(10);
    expect(ui.selPlatform).toBe('GitHub');
    const d = dm.pwData[0];
    await (ui as any).handleAccountAction(d, 'del');
    await waitForFlowPopup();
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    // splice 先于落盘/重绘完成：轮询等选中态与详情 DOM 同步到位，不做单点观察
    await waitFor(() => dm.pwData.length === 0 && ui.selPlatform === null && ui.selAccount === null);
    await waitFor(() =>
      !!document.querySelector('.bz-password-vault-detail')?.textContent?.includes('选择一个平台')
    );
    // 详情区回落「选择一个平台」空态，不再是「该平台暂无账号」空壳
    const detail = document.querySelector('.bz-password-vault-detail') as HTMLElement;
    expect(detail.textContent).toContain('选择一个平台');
  });

  it('新-10：账号删除挂 notifyUndo，点撤销原样塞回（保 id/fav）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x', fav: true });
    ui.show();
    await flush(10);
    const d = dm.pwData[0];
    await (ui as any).handleAccountAction(d, 'del');
    await waitForFlowPopup();
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await waitFor(() => dm.pwData.length === 0);
    // 通知带「撤销」按钮（delete 档）；轮询等挂出——deleteItem 的 splice 先于落盘完成，
    // 长度归零瞬间通知可能尚未创建
    let undoBtn: HTMLElement | null = null;
    await waitFor(() => {
      undoBtn =
        ([...document.querySelectorAll('.bz-notice-action')].find(
          (el) => el.textContent === '撤销'
        ) as HTMLElement) ?? null;
      return !!undoBtn;
    });
    expect(undoBtn, '删除后应有挂「撤销」按钮的通知').toBeTruthy();
    // 撤销 save 完成旗标：undoRestore 先置内存后落盘，只看长度会在写盘中途读磁盘
    let undoSaveDone = false;
    const origSave = dm.save.bind(dm);
    vi.spyOn(dm, 'save').mockImplementation(async () => {
      await origSave();
      undoSaveDone = true;
    });
    undoBtn!.click();
    await waitFor(() => dm.pwData.length === 1 && undoSaveDone);
    expect(dm.pwData[0].id).toBe(d.id); // 原样塞回：不重发 id/createdAt
    expect(dm.pwData[0].createdAt).toBe(d.createdAt);
    expect(dm.pwData[0].fav).toBe(true);
    // 撤销落盘：重开数据可读回
    const dm2 = new PasswordVaultDataManager(sm);
    await dm2.load();
    expect(dm2.pwData.map((x) => x.id)).toContain(d.id);
    dm2.destroy();
  });

  it('新-10：整平台删除挂 notifyUndo，撤销恢复全部账号', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'a', password: 'x' });
    await dm.addItem({ platform: 'GitHub', account: 'b', password: 'y' });
    const ids = dm.pwData.map((d) => d.id).sort();
    ui.show();
    await flush(10);
    const actions = (ui as any).buildPlatformActions('GitHub') as Array<{ label: string; onClick: () => void }>;
    const del = actions.find((a) => a.label === '删除整个平台')!;
    del.onClick();
    await waitForFlowPopup();
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await waitFor(() => dm.pwData.length === 0);
    let undoBtn: HTMLElement | null = null;
    await waitFor(() => {
      undoBtn =
        ([...document.querySelectorAll('.bz-notice-action')].find(
          (el) => el.textContent === '撤销'
        ) as HTMLElement) ?? null;
      return !!undoBtn;
    });
    undoBtn!.click();
    await waitFor(() => dm.pwData.length === 2);
    expect(dm.pwData.map((d) => d.id).sort()).toEqual(ids); // 全部原样恢复
  });

  // ---------- 新-11：fav 视图详情空态文案 ----------
  it('新-11：fav 视图下无收藏账号的平台详情空态说「暂无收藏账号」', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' }); // 无收藏
    ui.show();
    await flush(10);
    (document.querySelector('.bz-password-vault-rows .bz-password-vault-plrow') as HTMLElement).click();
    await flush(10);
    // 切到收藏视图：平台行从列表消失（无收藏），详情保留选中平台 → 空态按视图分叉
    (document.querySelector('.bz-password-vault-navitem[data-view="fav"]') as HTMLElement).click();
    await flush(10);
    const detail = document.querySelector('.bz-password-vault-detail') as HTMLElement;
    expect(detail.textContent).toContain('该平台暂无收藏账号');
    expect(detail.textContent).not.toContain('该平台暂无账号');
  });

  // ---------- 新-13：Enter 提交 ----------
  it('新-13：添加弹窗输入框内 Enter 触发保存', async () => {
    await sm.unlock('pw');
    ui.show();
    await flush(10);
    ui.openEntryDialog(null);
    const dlg = document.querySelector('.bz-password-vault-modal.open .bz-password-vault-dialog')!;
    const set = (f: string, v: string) => {
      (dlg.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value = v;
    };
    set('platform', 'GitHub');
    set('account', 'me');
    set('password', 'p@ss');
    const note = dlg.querySelector('[data-f="note"]') as HTMLInputElement;
    note.focus();
    // 纯 Enter：keydown 段放行、keypress 段提交（bindFormSubmit 契约）
    note.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    note.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    await waitFor(() => dm.pwData.length === 1);
    expect(dm.pwData[0]).toMatchObject({ platform: 'GitHub', account: 'me' });
  });

  it('新-13：平台编辑弹窗 Enter 触发保存（全账号改名）', async () => {
    await sm.unlock('pw');
    await dm.addItem({ platform: 'GitHub', account: 'a', password: 'x' });
    await dm.addItem({ platform: 'GitHub', account: 'b', password: 'y' });
    ui.show();
    await flush(10);
    (ui as any).openPlatformEdit('GitHub');
    const card = document.querySelector('.bz-password-vault-platedit.open')!;
    const input = card.querySelector('[data-f="platform"]') as HTMLInputElement;
    input.value = 'GitHub2';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    await waitFor(() => dm.pwData.every((d) => d.platform === 'GitHub2'));
    expect(dm.pwData.length).toBe(2);
  });

  // ---------- 口径批：toast 档位 + 自称「密码本」 ----------
  it('口径：常规动作 toast 走 info 档（生成密码）', async () => {
    await sm.unlock('pw');
    ui.show();
    await flush(10);
    ui.openEntryDialog(null);
    (document.querySelector('.bz-password-vault-modal.open [data-act="gen"]') as HTMLButtonElement).click();
    const info = [...document.querySelectorAll('.bz-notice--info .bz-notice-msg')].find(
      (el) => el.textContent === '已生成新密码'
    );
    expect(info, '常规动作应为 info 档（此前一律 success）').toBeTruthy();
    (document.querySelector('.bz-password-vault-modal.open [data-act="cancel"]') as HTMLElement).click();
  });

  it('口径：解锁成功走 success 档且自称「密码本已解锁」', async () => {
    await sm.unlock('correct-pw');
    await dm.addItem({ platform: 'GitHub', account: 'me', password: 'x' });
    sm.lock();
    dm.pwData = []; // 模拟真实重启：锁定后内存清空
    ui.show();
    await flush(30);
    const lock = document.querySelector('.bz-password-vault-lock.open') as HTMLElement;
    (lock.querySelector('[data-ls="p1"]') as HTMLInputElement).value = 'correct-pw';
    (lock.querySelector('[data-ls="go"]') as HTMLButtonElement).click();
    await flush(300);
    const success = [...document.querySelectorAll('.bz-notice--success .bz-notice-msg')].find(
      (el) => el.textContent === '密码本已解锁'
    );
    expect(success, '解锁成功为大节点：success 档 + 密码本自称').toBeTruthy();
  });

  it('口径：UI 文案层不再自称「保险库/保险箱」（源文本断言；首设风险确认真指全局共锁豁免）', () => {
    const src = repo('src/password-vault/ui.ts');
    expect(src).not.toContain('保险库已解锁');
    expect(src).not.toContain('保险箱清单文件为空');
    expect(src).not.toContain("'保险库还是空的'");
    expect(src).not.toContain('请先解锁保险库');
    // 首设风险确认「若遗忘密码，保险库及加密数据将永久丢失」真指共锁全局概念，豁免保留
    expect(src).toContain('保险库及加密数据将永久丢失');
    // 单源收敛：域内 DEFAULT_CHARSET 副本已删，消费 data.ts DEFAULT_PW_CHARSET
    expect(src).not.toMatch(/const DEFAULT_CHARSET/);
    expect(src).toContain('DEFAULT_PW_CHARSET');
  });

  it('口径：生成字符集单源 DEFAULT_PW_CHARSET（config.charset 为空时回落且可用）', () => {
    const pwd = ui.generatePassword();
    expect(pwd).toHaveLength(16);
    for (const ch of pwd) expect(DEFAULT_PW_CHARSET).toContain(ch);
  });

  // ---------- 新-12：移动端触控热区 ----------
  it('新-12：移动端可点元素挂 core 触控热区修饰类（markup 源断言）', () => {
    const src = repo('src/password-vault/render.ts');
    // 34px 档：默认外扩（-6px）
    expect(src).toContain('class="bz-password-vault-mobclose bz-touch-target"');
    expect(src).toContain('class="bz-password-vault-back bz-touch-target"');
    expect(src).toContain('class="ic bz-touch-target"');
    // 30px/28px 档：--lg 外扩（-8px）——弹窗 eye + seg 三钮
    const lg = src.match(/bz-touch-target--lg/g) || [];
    expect(lg.length).toBeGreaterThanOrEqual(4);
  });
});
