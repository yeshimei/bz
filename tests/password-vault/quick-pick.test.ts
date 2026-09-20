/**
 * 快速取密统一流测试（password-vault 域，ADR-0158）：
 * 数据侧：fuzzy 匹配得分与条目过滤排序（连续子串优先、子序列兜底）。
 * UI 侧：选择器列出现有条目 + 顶部固定「生成新密码」项（不受过滤影响）；
 * Enter 默认落点：命中非空 → 首个命中项（搜到即复制）；无命中 → 「生成新」；
 * 选中现有条目 → 复制该密码；选「生成新」→ 按设置的长度/字符集生成并复制；
 * 命中 >100 时键盘活动行钳在渲染段内；60s 剪贴板自动清空定时器布防；
 * 防偷窥口径（通知不含明文）；未解锁先弹主密码。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { EncryptAppController } from '../../src/encrypt/ui';
import { unloadEncrypt } from '../../src/encrypt';
import { PasswordVaultDataManager, type PasswordVaultEntry } from '../../src/password-vault/data';
import { fuzzyScore, fuzzyFilterEntries, openPasswordQuickPicker, closePasswordQuickPicker, type QuickPickAction } from '../../src/password-vault/quick-pick';
import { copyGeneratedPassword, unloadPasswordVault } from '../../src/password-vault/index';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';

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
    platform: over.platform ?? '',
    url: over.url ?? '',
    account: over.account ?? '',
    password: over.password ?? '',
    note: over.note ?? '',
    createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
    fav: over.fav ?? false,
  };
}

describe('快速取密 fuzzy 匹配（数据侧）', () => {
  it('连续子串命中得高分且位置越靠前越高；大小写不敏感', () => {
    expect(fuzzyScore('GitHub', 'hub')).toBeGreaterThan(0);
    expect(fuzzyScore('GitHub', 'git')).toBeGreaterThan(fuzzyScore('GitHub', 'hub'));
    expect(fuzzyScore('GitHub', 'GIT')).toBe(fuzzyScore('GitHub', 'git'));
  });

  it('子序列命中得普通分段（fuzzy 容错）；无命中 -1；空查询 0', () => {
    expect(fuzzyScore('GitHub', 'Gh')).toBe(100); // 子序列（G…h）
    expect(fuzzyScore('GitHub', 'zzz')).toBe(-1);
    expect(fuzzyScore('GitHub', '')).toBe(0);
  });

  it('fuzzyFilterEntries：平台/账号/备注任一命中；得分降序，平分按创建时间倒序', () => {
    const list = [
      entry({ id: '1', platform: '微信', account: 'wx-1', createdAt: '2026-01-01T00:00:00.000Z' }),
      entry({ id: '2', platform: 'GitHub', account: 'me', createdAt: '2026-02-01T00:00:00.000Z' }),
      entry({ id: '3', platform: 'Notion', account: 'gh-backup', createdAt: '2026-03-01T00:00:00.000Z' }),
    ];
    // 连续子串命中（gh-backup 账号含 'gh'，高分）在前；子序列命中（G**h 子序列 'gh'）殿后
    const hits = fuzzyFilterEntries(list, 'gh');
    expect(hits.map((e) => e.id)).toEqual(['3', '2']);
    // 空查询全员 0 分 → 按 createdAt 倒序
    const all = fuzzyFilterEntries(list, '');
    expect(all.map((e) => e.id)).toEqual(['3', '2', '1']);
    // 完全无命中
    expect(fuzzyFilterEntries(list, '不存在')).toEqual([]);
  });
});

describe('快速取密统一流（选择器 UI + 命令链路）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;

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
    await sm.unlock('pw');
  });

  afterEach(() => {
    closePasswordQuickPicker();
    unloadPasswordVault();
    // 命令链路经 ensureSafeUnlocked 懒建 encrypt 控制器（模块级缓存）——unloadEncrypt 复位
    // 缓存并清理单例，防跨用例共享旧解锁态（否则后续用例不弹解锁屏/读到旧库数据）
    unloadEncrypt();
    void EncryptAppController;
    sm.lock();
    document.body.innerHTML = '';
  });

  /** 经命令链路打开选择器（未解锁先走解锁屏），返回命令 Promise */
  async function openViaCommand() {
    const run = copyGeneratedPassword(getApp());
    // 未解锁 → 先弹主密码（同库同锁的共享解锁屏）
    await waitFor(() => !!document.querySelector('.bz-lockscreen--mask'));
    const mask = document.querySelector('.bz-lockscreen--mask') as HTMLElement;
    (mask.querySelector('input.bz-lockscreen-input') as HTMLInputElement).value = 'pw';
    (mask.querySelector('.bz-lockscreen-action') as HTMLElement).click();
    await waitFor(() => !!document.getElementById('bz-password-vault-qp-popup'));
    return run;
  }

  it('顶部固定「生成新密码」项不受过滤影响；选中现有条目 Enter 复制该密码（通知不含明文）', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me@x', password: 's3cret' });
    await dm.addItem({ platform: '微信', account: 'wx', password: 'pwx' });
    dm.destroy();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined as any);
    const run = await openViaCommand();
    // 列表首项恒为「生成新密码」，其后列现有条目
    const rows = () => [...document.querySelectorAll<HTMLElement>('.bz-password-vault-qp .bz-popover-item')];
    expect(rows()[0].querySelector('.pl')!.textContent).toBe('生成新密码');
    expect(rows().length).toBe(3);
    // fuzzy 过滤：'gt' 子序列命中 GitHub；「生成新」项仍在首位
    const search = document.querySelector('.bz-password-vault-qp-search') as HTMLInputElement;
    search.value = 'gt';
    search.dispatchEvent(new Event('input'));
    await waitFor(() => rows().length === 2);
    expect(rows()[0].querySelector('.pl')!.textContent).toBe('生成新密码');
    expect(rows()[1].querySelector('.pl')!.textContent).toBe('GitHub');
    // Enter 走活动行：有命中时默认落首个命中项（搜到即复制，深审新-1），无需 ↓
    expect(rows()[1].classList.contains('is-on')).toBe(true);
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await run;
    expect(writeText).toHaveBeenCalledWith('s3cret');
    // 防偷窥：通知只报平台/账号与 60s 口径，不含密码明文
    await waitFor(() => hasNotice('已复制「GitHub」（me@x）的密码，60 秒后自动清空'));
    for (const m of getNoticeMessages()) {
      expect(m).not.toContain('s3cret');
    }
    expect(document.getElementById('bz-password-vault-qp-popup')).toBeNull();
  });

  it('选「生成新」→ 按设置长度生成并复制；60s 自动清空定时器布防（到点回写空串）', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined as any);
    writeText.mockClear(); // vi.spyOn 跨用例返回同一 mock：清掉前序用例调用记录，精确次数断言才成立
    const run = await openViaCommand();
    const rows = () => [...document.querySelectorAll<HTMLElement>('.bz-password-vault-qp .bz-popover-item')];
    // 空库：选择器只剩「生成新」一项（ADR-0158 口径：无命中生成，空库不阻断）
    expect(rows().length).toBe(1);
    expect(rows()[0].querySelector('.pl')!.textContent).toBe('生成新密码');
    // 复制动作发生前先接管时钟：60s 清空定时器由 copySensitiveText 成功后布防，
    // 必须让它在 fake clock 下创建，advance 才命中
    vi.useFakeTimers();
    try {
      rows()[0].click();
      // advance(0) 只 flush 微任务（writeText(密码) + armClipboardClear 布防 + 通知发出），
      // 不推进通知的自动隐藏定时器
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText).toHaveBeenCalledTimes(1);
      const pw = writeText.mock.calls[0][0] as string;
      expect(typeof pw).toBe('string');
      expect(pw.length).toBe(16); // 设置 passwordLength='16'
      await waitFor(() => hasNotice('已生成并复制密码，60 秒后自动清空剪贴板'));
      // 60s 剪贴板自动清空：到点回写空串（明文不留存）。advance 会同时烧掉通知的
      // 自动隐藏定时器，故通知断言必须在其之前完成
      await vi.advanceTimersByTimeAsync(60_000);
      expect(writeText).toHaveBeenLastCalledWith('');
    } finally {
      vi.useRealTimers();
    }
    await run;
  });

  it('命令链路经 ensurePasswordVault/ensureSafeUnlocked 初始化（pv 面板未打开、解锁屏走 encrypt 共享锁）', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me@x', password: 's3cret' });
    dm.destroy();
    const run = copyGeneratedPassword(getApp());
    await waitFor(() => !!document.querySelector('.bz-lockscreen--mask'));
    // 全程未打开 pv 面板（ensurePasswordVault 只建隐藏根，show 才显示——轻量弹层路径）
    const pvRoot = document.querySelector('.bz-password-vault') as HTMLElement | null;
    expect(pvRoot?.style.display).not.toBe('flex');
    const mask = document.querySelector('.bz-lockscreen--mask') as HTMLElement;
    (mask.querySelector('input.bz-lockscreen-input') as HTMLInputElement).value = 'pw';
    (mask.querySelector('.bz-lockscreen-action') as HTMLElement).click();
    await waitFor(() => !!document.getElementById('bz-password-vault-qp-popup'));
    // 选择器列出解锁后加载到的现有条目
    await waitFor(() => document.querySelectorAll('.bz-password-vault-qp .bz-popover-item').length === 2);
    expect(document.querySelector('.bz-password-vault-qp')!.textContent).toContain('GitHub');
    // 关闭选择器取消：命令 Promise 以 void 收场，无残留弹层
    (document.getElementById('bz-password-vault-qp-mask') as HTMLElement).click();
    await run;
    expect(document.getElementById('bz-password-vault-qp-popup')).toBeNull();
  });

  it('无命中时 Enter 落「生成新」（ADR-0158 口径：命中为空才走生成，深审新-1 另半边）', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me@x', password: 's3cret' });
    dm.destroy();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined as any);
    writeText.mockClear();
    const run = await openViaCommand();
    const search = document.querySelector('.bz-password-vault-qp-search') as HTMLInputElement;
    search.value = 'zzz-no-hit';
    search.dispatchEvent(new Event('input'));
    await waitFor(() => document.querySelectorAll('.bz-password-vault-qp .bz-popover-item').length === 1);
    // 活动行落「生成新」
    const on = document.querySelector('.bz-password-vault-qp .bz-popover-item.is-on') as HTMLElement;
    expect(on.querySelector('.pl')!.textContent).toBe('生成新密码');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await run;
    await waitFor(() => hasNotice('已生成并复制密码，60 秒后自动清空剪贴板'));
    // 不误复制现有条目密码
    for (const call of writeText.mock.calls) {
      expect(call[0]).not.toBe('s3cret');
    }
  });

  it('逐键收紧关键词：已选命中项仍在命中里则保持选中，不再命中则落首个命中项', async () => {
    await dm.addItem({ platform: 'GitHub', account: 'me@x', password: 's3cret' });
    await dm.addItem({ platform: 'GitLab', account: 'ops@x', password: 'p2' });
    dm.destroy();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined as any);
    writeText.mockClear();
    const run = await openViaCommand();
    const rows = () => [...document.querySelectorAll<HTMLElement>('.bz-password-vault-qp .bz-popover-item')];
    const search = document.querySelector('.bz-password-vault-qp-search') as HTMLInputElement;
    // 'git' 双命中（平分按 createdAt 倒序：GitLab 后建在前）
    search.value = 'git';
    search.dispatchEvent(new Event('input'));
    await waitFor(() => rows().length === 3);
    expect(rows()[1].querySelector('.pl')!.textContent).toBe('GitLab');
    // ↓↓ 选中第二个命中项 GitHub
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(rows()[2].classList.contains('is-on')).toBe(true);
    // 收紧为 'gith'（只命中 GitHub）：原选中仍命中 → 保持，不回落
    search.value = 'gith';
    search.dispatchEvent(new Event('input'));
    await waitFor(() => rows().length === 2);
    expect(rows()[1].classList.contains('is-on')).toBe(true);
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await run;
    expect(writeText).toHaveBeenCalledWith('s3cret');
  });

  it('命中 >100：键盘活动行钳在渲染段（LIMIT=100）内，Enter 复制的是已渲染末条', async () => {
    const entries = Array.from({ length: 150 }, (_, i) =>
      entry({ id: `pw-${i}`, platform: `站点${String(i).padStart(3, '0')}`, password: `pw-${i}` })
    );
    const picks: QuickPickAction[] = [];
    openPasswordQuickPicker(entries, (a) => picks.push(a));
    const search = document.querySelector('.bz-password-vault-qp-search') as HTMLInputElement;
    search.value = '站点';
    search.dispatchEvent(new Event('input'));
    // 渲染段 = 生成新 + 前 100 条命中
    const rows = () => [...document.querySelectorAll<HTMLElement>('.bz-password-vault-qp .bz-popover-item')];
    await waitFor(() => rows().length === 101);
    // 连按 ↓ 120 次：活动行停在渲染段末条（站点099），而非从未渲染的站点119
    for (let i = 0; i < 120; i++) {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    }
    const on = rows()[100];
    expect(on.classList.contains('is-on')).toBe(true);
    expect(on.querySelector('.pl')!.textContent).toBe('站点099');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(picks.length).toBe(1);
    expect(picks[0]).toMatchObject({ type: 'entry', entry: { id: 'pw-99' } });
  });
});

