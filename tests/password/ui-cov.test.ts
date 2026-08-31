/**
 * 密码本 UI 覆盖率补测：
 * 🔍 搜索显隐开关、⚙️ 设置弹窗写回（含移动端组）、👁 备注联动、空态文案、
 * 建议（suggestions）交互、生成按钮、锁定守卫、pendingPassword 暂存、ESC 层级、
 * Controller openManager/addEntry/generatePassword 复制失败、cleanup。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { PasswordAppController, UIManager, secureRandomPassword } from '../../src/password/ui';
import { DataManager } from '../../src/password/data';
import { EncryptAppController } from '../../src/encrypt/ui';
import { getSafeManager } from '../../src/encrypt';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices, getNoticeMessages, Platform } from '../mock-obsidian-entry';
import { closeItemMenu } from '../../src/core/item-actions';
import { closeSettingsModal } from '../../src/core/settings-modal';

/** 轮询等待 */
async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const CONFIG = { charset: 'abc123', length: '8', securityMode: false };

function baseSetup(vault: MockVault) {
  setApp({ vault, metadataCache: { getFileCache: () => null, trigger: () => {} } } as any);
  setSettingsProvider(() => CONFIG as any);
  resetObsidianMocks();
  clearNotices();
}

function resetControllers() {
  PasswordAppController.instance?.cleanup();
  PasswordAppController.instance = null;
  EncryptAppController.instance?.cleanup();
  EncryptAppController.instance = null;
}

describe('密码本 UI 覆盖补测（面板交互）', () => {
  let vault: MockVault;
  let dm: DataManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    baseSetup(vault);
    document.body.innerHTML = '';
    dm = new DataManager();
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await getSafeManager().unlock('pw');
    await dm.addItem({ platform: 'GitHub', url: '', account: 'alice', password: 'secret1', note: '主账号' });
    await dm.addItem({ platform: 'Gmail', account: '', password: '', note: '' } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    closeItemMenu();
    document.body.innerHTML = '';
    Platform.isMobile = false;
    resetControllers();
  });

  it('🔍 搜索按钮：收起时清空关键词并重渲染，再点展开并聚焦', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const searchBtn = [...document.querySelectorAll('button')].find((b) => b.title === '搜索')!;
    expect(ui.searchContainer!.style.display).not.toBe('none');
    // 预置关键词后收起 → 关键词与输入框一并清空
    ui.searchKeyword = 'github';
    ui.searchInput!.value = 'github';
    searchBtn.click(); // 可见 → 隐藏
    expect(ui.searchContainer!.style.display).toBe('none');
    expect(ui.searchKeyword).toBe('');
    expect(ui.searchInput!.value).toBe('');
    searchBtn.click(); // 隐藏 → 显示并聚焦
    expect(ui.searchContainer!.style.display).toBe('block');
    expect(document.activeElement).toBe(ui.searchInput);
  });

  it('👁 切换时同步显示/隐藏备注（有备注的条目）', async () => {
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const container = document.getElementById('pw-entries-container')!;
    // GitHub 卡片带备注（添加顺序在后 → 渲染在前的可能是 Gmail；找带 .pw-note 的卡片）
    const card = [...container.querySelectorAll('.pw-entry-card')].find(
      (c) => c.querySelector('.pw-note')
    ) as HTMLElement;
    expect(card).toBeTruthy();
    const eye = card.querySelector('.pw-eye') as HTMLElement;
    const noteEl = card.querySelector('.pw-note') as HTMLElement;
    expect(noteEl.classList.contains('hidden')).toBe(true);
    eye.click();
    expect(card.textContent).toContain('secret1'); // 明文
    expect(noteEl.classList.contains('hidden')).toBe(false); // 备注同步展开
    expect(noteEl.textContent).toContain('主账号');
    eye.click();
    expect(noteEl.classList.contains('hidden')).toBe(true); // 备注同步隐藏
    expect(noteEl.textContent).toContain('主账号'); // 有备注时保留原文（占位文案仅用于无备注兜底）
  });

  it('空态两种文案：无关键词提示添加、关键词无命中提示无匹配', async () => {
    await dm.deleteItem(dm.pwData[0].id);
    await dm.deleteItem(dm.pwData[0].id);
    ui.show();
    await waitFor(() => !!ui.entriesContainer!.textContent!.includes('没有密码条目'));
    expect(ui.entriesContainer!.textContent).toContain('没有密码条目，点击 ✏️ 添加');
    ui.searchKeyword = '不存在';
    await ui.renderList();
    expect(ui.entriesContainer!.textContent).toContain('没有匹配的条目');
  });

  it('renderList 防御：容器未初始化直接返回；数据加载失败提示错误', async () => {
    const saved = ui.entriesContainer;
    ui.entriesContainer = null;
    await expect(ui.renderList()).resolves.toBeUndefined(); // 早退不抛
    ui.entriesContainer = saved;
    (dm as any).load = vi.fn(async () => {
      throw new Error('磁盘坏');
    });
    await ui.renderList();
    expect(hasNotice('加载数据失败：磁盘坏')).toBe(true);
  });

  it('卡片形态分支：无平台不渲染平台元素、空账号显示「(无账号)」、空密码掩码 8 位、url 空用纯文本', async () => {
    await dm.addItem({ platform: '', account: '', password: '', note: '' } as any);
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 3);
    const container = document.getElementById('pw-entries-container')!;
    // 全空条目（最新添加 → 排最前）
    const blankCard = [...container.querySelectorAll('.pw-entry-card')].find(
      (c) => c.querySelector('.pw-account')!.textContent === '(无账号)' && !c.querySelector('.pw-platform-text')
    ) as HTMLElement;
    expect(blankCard).toBeTruthy(); // 无平台 → 不渲染任何平台元素
    expect(blankCard.querySelector('.pw-password-text')!.textContent).toBe('•'.repeat(8)); // 空密码按 8 位掩码
    // Gmail 条目：url 为空 → 平台用纯文本 span 而非链接
    const gmailCard = [...container.querySelectorAll('.pw-entry-card')].find(
      (c) => c.querySelector('.pw-platform-text')
    ) as HTMLElement;
    expect(gmailCard.querySelector('.pw-platform-text')!.textContent).toBe('Gmail');
    expect(gmailCard.querySelector('.pw-platform-link')).toBeNull();
  });

  it('抽屉头部兜底：平台为空回退账号、两者皆空回退「密码条目」', async () => {
    Platform.isMobile = true;
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const container = document.getElementById('pw-entries-container')!;
    vi.useFakeTimers();
    const gmailCard = [...container.querySelectorAll('.pw-entry-card')].find(
      (c) => c.querySelector('.pw-account')!.textContent === '(无账号)'
    ) as HTMLElement;
    gmailCard.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 10, clientY: 10 }));
    vi.advanceTimersByTime(550);
    gmailCard.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    gmailCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 10));
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet.querySelector('.bz-item-sheet-title')!.textContent).toBe('Gmail'); // 平台在、账号空
    closeItemMenu();

    // 平台与账号都空的条目 → 「密码条目」
    await dm.addItem({ platform: '', account: '', password: 'x', note: '' } as any);
    await ui.renderList();
    const blank = [...document.getElementById('pw-entries-container')!.querySelectorAll('.pw-entry-card')].find(
      (c) => !c.querySelector('.pw-platform-text, .pw-platform-link') && c.querySelector('.pw-account')!.textContent === '(无账号)'
    ) as HTMLElement;
    expect(blank).toBeTruthy();
    // 先装 fake clock 再派发 mousedown：longPress 的 500ms 定时器必须挂在可推进的假时钟上
    vi.useFakeTimers();
    blank.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 10, clientY: 10 }));
    vi.advanceTimersByTime(550);
    blank.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    blank.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 10));
    const sheet2 = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet2.querySelector('.bz-item-sheet-title')!.textContent).toBe('密码条目');
    closeItemMenu();
  });

  it('复制动作守卫：账号/密码为空时不写剪贴板也不弹通知', async () => {
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined as any);
    Platform.isMobile = true;
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-entry-card').length === 2);
    const container = document.getElementById('pw-entries-container')!;
    vi.useFakeTimers();
    try {
      const gmailCard = [...container.querySelectorAll('.pw-entry-card')].find(
        (c) => c.querySelector('.pw-account')!.textContent === '(无账号)'
      ) as HTMLElement;
      gmailCard.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 10, clientY: 10 }));
      vi.advanceTimersByTime(550);
      gmailCard.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
      gmailCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(0);
      const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
      for (const label of ['复制账号', '复制密码']) {
        const item = [...sheet.querySelectorAll('.bz-item-sheet-item')].find((b) =>
          b.textContent!.includes(label)
        ) as HTMLElement;
        item.click();
        await vi.advanceTimersByTimeAsync(0);
      }
      expect(writeSpy).not.toHaveBeenCalled();
      expect(hasNotice(/已复制/)).toBe(false);
    } finally {
      vi.useRealTimers();
      writeSpy.mockRestore();
    }
  });

  it('建议下拉：聚焦展示频次排序候选、点选回填、失焦延时隐藏、无候选隐藏', async () => {
    ui.openAddDialog();
    const platformInput = ui._platformInput;
    platformInput.dispatchEvent(new Event('focus'));
    const suggest = ui._platformSuggest;
    expect(suggest.style.display).toBe('block');
    const items = [...suggest.querySelectorAll('.suggestion-item')] as HTMLElement[];
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('GitHub');
    items[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(platformInput.value).toBe('GitHub'); // 点选回填
    expect(suggest.style.display).toBe('block'); // 回填触发 input → 候选刷新仍显示

    // 失焦 → 延时 200ms 隐藏
    platformInput.dispatchEvent(new Event('input'));
    expect(suggest.style.display).toBe('block');
    vi.useFakeTimers();
    platformInput.dispatchEvent(new FocusEvent('blur'));
    expect(suggest.style.display).toBe('block'); // 未到延时仍显示
    vi.advanceTimersByTime(200);
    expect(suggest.style.display).toBe('none');
    vi.useRealTimers();

    // 不存在的字段 → 无候选
    expect(ui.getSuggestions('不存在的字段')).toEqual([]);
  });

  it('生成按钮：点击后密码输入框被随机密码填充（落在字符集内）', () => {
    ui.openAddDialog();
    const genBtn = document.querySelector('.pw-generate-btn') as HTMLButtonElement;
    genBtn.click();
    const pwd = ui._passwordInput.value;
    expect(pwd.length).toBe(8);
    expect([...pwd].every((c) => 'abc123'.includes(c))).toBe(true);
  });

  it('openAddDialog 锁定守卫：未解锁只提示不弹窗', () => {
    getSafeManager().lock();
    ui.openAddDialog();
    expect(hasNotice('请先解锁密码本')).toBe(true);
    expect(ui.addMask!.style.display).not.toBe('block');
  });

  it('pendingPassword 暂存：打开添加弹窗自动填入并消费一次', () => {
    ui.pendingPassword = 'STAGED-PW';
    ui.openAddDialog();
    expect(ui._passwordInput.value).toBe('STAGED-PW');
    expect(ui.pendingPassword).toBeNull(); // 用后即清
    // 再次打开 → 重新生成而非复用
    ui.closeAddDialog();
    ui.openAddDialog();
    expect(ui._passwordInput.value).not.toBe('STAGED-PW');
  });

  it('generatePassword 兜底：length/charset 非法时用默认值（16 位默认字符集）', () => {
    const ui2 = new UIManager(dm, { charset: '', length: '', securityMode: false });
    const pwd = ui2.generatePassword();
    expect(pwd.length).toBe(16);
    expect([...pwd].every((c) => '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+'.includes(c))).toBe(true);
  });

  it('ESC 层级：添加弹窗开着先关弹窗；仅主面板开着则收主面板', () => {
    ui.show();
    ui.openAddDialog();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ui.addMask!.style.display).toBe('none'); // 第一层：关添加弹窗
    expect(ui.mask!.style.display).toBe('block'); // 主面板保持
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ui.mask!.style.display).toBe('none'); // 第二层：收主面板
  });

  it('closeAddDialog 防御：未初始化（addMask 为 null）调用不抛错', () => {
    const fresh = new UIManager(dm, CONFIG);
    expect(() => fresh.closeAddDialog()).not.toThrow();
  });
});

describe('密码本 ⚙️ 设置弹窗覆盖补测', () => {
  let vault: MockVault;
  beforeEach(() => {
    vault = new MockVault();
    baseSetup(vault);
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
    Platform.isMobile = false;
    resetControllers();
  });

  function openModal() {
    const dm = new DataManager();
    const ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '密码本设置')!;
    settingsBtn.click();
    return document.getElementById('bz-settings-modal-popup')!;
  }

  it('设置项 onChange 写回设置对象并触发保存；重复改动只提示一次重载生效（ticket 55）', async () => {
    const s: any = { passwordCharset: 'abc', passwordLength: '8', securityMode: false };
    setSettingsProvider(() => s);
    const saveSpy = vi.fn(async () => {});
    setSettingsSaver(saveSpy);
    const popup = openModal();
    // 桌面端：移动端组整组隐藏（行仍在 DOM 挂 bz-setting-hidden，ticket 131 声明式联动保留结构）
    const settings = [...popup.querySelectorAll('.setting-item')]
      .filter((el) => !el.classList.contains('bz-setting-hidden'))
      .map((el) => (el as any).__setting);
    expect(settings.length).toBe(3);
    const RELOAD_TIP = '设置已保存，重载插件后生效'; // ticket 170 统一文案
    // 字符集 / 长度文本项
    (settings[0].controls[0] as any).trigger('xyz789');
    expect(s.passwordCharset).toBe('xyz789');
    (settings[1].controls[0] as any).trigger('20');
    expect(s.passwordLength).toBe('20');
    // 安全模式开关
    (settings[2].controls[0] as any).trigger(true);
    expect(s.securityMode).toBe(true);
    await waitFor(() => saveSpy.mock.calls.length >= 3);
    // 改动提示重载生效，且多次改动只提示一次
    expect(hasNotice(RELOAD_TIP)).toBe(true);
    expect(getNoticeMessages().filter((m) => m === RELOAD_TIP).length).toBe(1);
    closeSettingsModal(); // 关闭弹窗清理
  });

  it('移动端组：isMobileEnv 时追加「移动端默认全屏」开关并可切换', async () => {
    Platform.isMobile = true;
    const s: any = { passwordCharset: 'abc', passwordLength: '8', securityMode: false, passwordMobileDefaultFullscreen: true };
    setSettingsProvider(() => s);
    const popup = openModal();
    const heads = [...popup.querySelectorAll('.bz-settings-group-head')].map((el) => el.textContent!.trim());
    expect(heads).toEqual(['生成2 项', '安全1 项', '移动端1 项']);
    const settings = [...popup.querySelectorAll('.setting-item')].map((el) => (el as any).__setting);
    (settings[3].controls[0] as any).trigger(false);
    expect(s.passwordMobileDefaultFullscreen).toBe(false);
    closeSettingsModal();
  });
});

describe('secureRandomPassword 拒绝采样丢弃分支', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('采样值超出均匀区间被丢弃重采（buf[i] >= LIMIT → continue），最终长度正确', () => {
    const orig = crypto.getRandomValues.bind(crypto);
    let call = 0;
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((buf: Uint32Array) => {
      call++;
      if (call === 1) {
        buf.fill(4294967295); // 字符集长 3 时 LIMIT=4294967295，该值必被丢弃
      } else {
        for (let i = 0; i < buf.length; i++) buf[i] = i % 3;
      }
      return buf;
    });
    try {
      const pwd = secureRandomPassword(5, 'abc');
      expect(pwd.length).toBe(5);
      expect([...pwd].every((c) => 'abc'.includes(c))).toBe(true);
      expect(call).toBeGreaterThanOrEqual(2); // 发生过重采
    } finally {
      crypto.getRandomValues = orig;
    }
  });
});
