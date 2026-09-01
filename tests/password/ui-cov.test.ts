/**
 * 密码本 UI 覆盖率补测（Route C 平台聚合重构）：
 * 🔍 搜索输入、⚙️ 设置弹窗写回（含移动端组）、空态文案、
 * 建议（suggestions）交互、生成按钮、锁定守卫、pendingPassword 暂存、ESC 层级、
 * Controller openManager/addEntry/generatePassword 复制失败、cleanup。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { PasswordAppController, UIManager, secureRandomPassword, passwordSettingsSchema } from '../../src/password/ui';
import { DataManager } from '../../src/password/data';
import { EncryptAppController } from '../../src/encrypt/ui';
import { getSafeManager } from '../../src/encrypt';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices, getNoticeMessages, Platform } from '../mock-obsidian-entry';
import { closeItemMenu } from '../../src/core/item-actions';
import { openSettingsModal, closeSettingsModal } from '../../src/core/settings-modal';

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

describe('密码本 UI 覆盖补测（Route C 面板交互）', () => {
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
    document.body.appendChild(ui.root!);
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

  it('空态两种文案：无关键词提示添加、关键词无命中提示无匹配', async () => {
    await dm.deleteItem(dm.pwData[0].id);
    await dm.deleteItem(dm.pwData[0].id);
    ui.show();
    await waitFor(() => !!document.querySelector('.pw-rows'));
    expect(document.querySelector('.pw-rows')!.textContent).toContain('暂无密码条目');
    // 设置搜索关键词后重新渲染（renderList 重建 DOM，需重新查询）
    (ui as any).searchKeyword = '不存在';
    await (ui as any).renderList();
    expect(document.querySelector('.pw-rows')!.textContent).toContain('没有匹配的条目');
  });

  it('渲染防御：数据加载失败提示错误', async () => {
    (dm as any).load = vi.fn(async () => {
      throw new Error('磁盘坏');
    });
    ui.show();
    await new Promise((r) => setTimeout(r, 50));
    expect(hasNotice('加载数据失败：磁盘坏')).toBe(true);
  });

  it('空平台条目：平台为空时显示「(无平台)」', async () => {
    await dm.addItem({ platform: '', account: 'test', password: 'pw', note: '' } as any);
    ui.show();
    await waitFor(() => document.querySelectorAll('.pw-plrow').length > 0);
    const rows = document.querySelectorAll('.pw-plrow');
    const texts = [...rows].map((r) => r.textContent || '');
    expect(texts.some((t) => t.includes('(无平台)'))).toBe(true);
  });

  it('建议下拉：聚焦展示频次排序候选、点选回填、失焦延时隐藏', async () => {
    ui.openAddDialog();
    const platformInput = ui._platformInput;
    platformInput.dispatchEvent(new Event('focus'));
    const suggest = ui._platformSuggest;
    expect(suggest.style.display).toBe('block');
    const items = [...suggest.querySelectorAll('.pw-suggest-item')] as HTMLElement[];
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0].textContent).toBe('GitHub');
    items[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(platformInput.value).toBe('GitHub');

    // 失焦 → 延时 200ms 隐藏
    platformInput.dispatchEvent(new Event('input'));
    expect(suggest.style.display).toBe('block');
    vi.useFakeTimers();
    platformInput.dispatchEvent(new FocusEvent('blur'));
    expect(suggest.style.display).toBe('block');
    vi.advanceTimersByTime(200);
    expect(suggest.style.display).toBe('none');
    vi.useRealTimers();
  });

  it('生成按钮：点击后密码输入框被随机密码填充（落在字符集内）', () => {
    ui.openAddDialog();
    const genBtn = document.querySelector('.pw-genbtn') as HTMLButtonElement;
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
    expect(ui.pendingPassword).toBeNull();
    // 再次打开 → 重新生成而非复用
    (ui as any).closeAddDialog();
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
    expect(ui.root!.style.display).not.toBe('none'); // 主面板保持
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ui.root!.style.display).toBe('none'); // 第二层：收主面板
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
    openSettingsModal({ title: '密码本设置', schema: passwordSettingsSchema() });
    return document.getElementById('bz-settings-modal-popup')!;
  }

  it('设置项 onChange 写回设置对象并触发保存；重复改动只提示一次重载生效（ticket 55）', async () => {
    const s: any = { passwordCharset: 'abc', passwordLength: '8', securityMode: false };
    setSettingsProvider(() => s);
    const saveSpy = vi.fn(async () => {});
    setSettingsSaver(saveSpy);
    const popup = openModal();
    const settings = [...popup.querySelectorAll('.setting-item')]
      .filter((el) => !el.classList.contains('bz-setting-hidden'))
      .map((el) => (el as any).__setting);
    expect(settings.length).toBe(3);
    const RELOAD_TIP = '设置已保存，重载插件后生效';
    (settings[0].controls[0] as any).trigger('xyz789');
    expect(s.passwordCharset).toBe('xyz789');
    (settings[1].controls[0] as any).trigger('20');
    expect(s.passwordLength).toBe('20');
    (settings[2].controls[0] as any).trigger(true);
    expect(s.securityMode).toBe(true);
    await waitFor(() => saveSpy.mock.calls.length >= 3);
    expect(hasNotice(RELOAD_TIP)).toBe(true);
    expect(getNoticeMessages().filter((m) => m === RELOAD_TIP).length).toBe(1);
    closeSettingsModal();
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
        buf.fill(4294967295);
      } else {
        for (let i = 0; i < buf.length; i++) buf[i] = i % 3;
      }
      return buf;
    });
    try {
      const pwd = secureRandomPassword(5, 'abc');
      expect(pwd.length).toBe(5);
      expect([...pwd].every((c) => 'abc'.includes(c))).toBe(true);
      expect(call).toBeGreaterThanOrEqual(2);
    } finally {
      crypto.getRandomValues = orig;
    }
  });
});
