/**
 * encrypt 域深审批 B（ui 会话安全区）回归：
 * T1 孤立 % 附件名不再静默失败、T2 上锁/关窗收场预览与弹层、T3 锁屏清扫（cleanup 后不可再解锁）、
 * T4 销毁日记升级主密码防护、T5 外部上锁事件侧清场 + 锁定态预览提示、T6 解锁屏单例、
 * T7 解锁 busy 防重、T8 预览正文解密 null 占位、T9 体检重入守卫、T10 体检锁定态如实、
 * T11 密码错误单通知、T12 统计快照挪上锁消费点、T13 预览渲染 Component unload、
 * T14 错误文案收口 notifyActionError、T15 死代码清扫（LOCK_KIND_META/DEFAULT_PW_CHARSET 降模块）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager, type SafeAttachment } from '../../src/encrypt/data';
import {
  EncryptAppController,
  UIManager,
  collectNoteAttachments,
  findSharedAttachmentPaths,
  collectMediaSlots,
} from '../../src/encrypt/ui';
import { readLockStats } from '../../src/core/lock-stats';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';

async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const CONFIG = { root: 'CONFIG/.ENCRYPT', previewEnabled: false, previewSize: 384, previewQuality: 0.5, autoLoadOriginal: false, securityMode: false };

function setup(vault: MockVault) {
  const app = mockAppWithVault(vault);
  setApp(app as any);
  setSettingsProvider(() => CONFIG as any);
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  return app;
}

function findDialog(): HTMLElement | null {
  return [...document.querySelectorAll('div')].find((d) => d.classList.contains('bz-lockscreen--mask') && d.style.display === 'flex') as HTMLElement | null;
}

/** 解锁屏主输入/主按钮 */
function dialogControls(mask: HTMLElement) {
  return {
    input: mask.querySelector('input.bz-lockscreen-input') as HTMLInputElement,
    btn: mask.querySelector('.bz-lockscreen-action') as HTMLButtonElement,
  };
}

describe('批 B · T1 孤立 % 附件名（decodeURIComponent URIError 静默失败）', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(() => {
    vault = new MockVault();
    setup(vault);
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-preview-mask', 'bz-encrypt-preview-popup'].forEach((id) => document.getElementById(id)?.remove());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('collectNoteAttachments / findSharedAttachmentPaths / collectMediaSlots：孤立 % 按原文匹配不抛 URIError', () => {
    const files = [{ path: '附件/100%.png' }];
    // 修复前：decodeURIComponent('100%.png') 抛 URIError，整链静默失败
    expect(() => collectNoteAttachments('![[100%.png]]', [], files)).not.toThrow();
    expect(collectNoteAttachments('![[100%.png]]', [], files)).toEqual(['附件/100%.png']);
    expect(findSharedAttachmentPaths('a.md', ['附件/100%.png'], [{ path: 'b.md', links: ['100%.png'] }])).toEqual(['附件/100%.png']);
    const att = { path: '附件/100%.png', kind: 'image', blobRef: 'r', blobSize: 1, fingerprint: 'f', hasPreview: false, previewRef: '' } as SafeAttachment;
    expect(collectMediaSlots('![[100%.png]]', [att]).slots[0].attachment).toBe(att);
    // 正常 URL 编码引用不受影响（仍走解码匹配）
    expect(collectNoteAttachments('![](%E9%99%84%E4%BB%B6/100%25.png)', [], files)).toEqual(['附件/100%.png']);
  });

  it('整链回归：![[100%.png]] 笔记可正常加密入库（附件随迁）', async () => {
    const app = setup(vault);
    vault.create('笔记/pct.md', '正文\n![[100%.png]]');
    vault.createBinary('笔记/100%.png', new TextEncoder().encode('PCT').buffer);
    (app.workspace as any).getActiveFile = () => ({ path: '笔记/pct.md', basename: 'pct', vault: vault as any });
    const c = new EncryptAppController(CONFIG);
    try {
      await c.init();
      await c.dataManager.unlock('pw');
      const p = c.lockCurrentNote();
      await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
      (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
      await p;
      expect(c.dataManager.manifest.notes.length).toBe(1);
      expect(c.dataManager.manifest.notes[0].attachments.map((a) => a.path)).toEqual(['笔记/100%.png']);
      expect(vault.files.has('笔记/pct.md')).toBe(false); // 原文已移出
    } finally {
      c.cleanup();
      EncryptAppController.instance = null;
    }
  });

  it('整链兜底：前置步骤抛错不再静默 reject（try/finally 无 catch → notifyActionError）', async () => {
    const app = setup(vault);
    vault.create('笔记/x.md', '正文');
    (app.workspace as any).getActiveFile = () => ({ path: '笔记/x.md', basename: 'x', vault: vault as any });
    const c = new EncryptAppController(CONFIG);
    try {
      await c.init();
      await c.dataManager.unlock('pw');
      vi.spyOn(vault, 'read').mockRejectedValue(new Error('读取炸了'));
      await expect(c.lockCurrentNote()).resolves.toBeUndefined(); // 不再 reject（无声失败）
      expect(hasNotice('加密当前笔记失败：读取炸了，请重试')).toBe(true);
    } finally {
      c.cleanup();
      EncryptAppController.instance = null;
    }
  });
});

describe('批 B · T2 上锁/关窗收场（预览明文浮层 + body 弹层）', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await dm.unlock('pw');
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-preview-mask', 'bz-encrypt-preview-popup', 'bz-encrypt-health-mask', 'bz-encrypt-health-popup'].forEach((id) => document.getElementById(id)?.remove());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('lockNow 收场：开着预览窗立即上锁 → 预览随上锁关闭（明文不残留屏上）', async () => {
    const note = await dm.lockNote({
      path: '笔记/p.md', title: 'P', content: '![[pic.png]]',
      attachments: [{ path: 'pic.png', data: 'QUJD', previewData: 'data:image/jpeg;base64,QUJD' }],
    });
    await ui.openPreview(note);
    await waitFor(() => ui.previewPopup!.style.display === 'flex');
    ui.lockNow();
    expect(dm.unlocked).toBe(false);
    expect(ui.previewPopup!.style.display).toBe('none');
    expect(ui.previewMask!.style.display).toBe('none');
  });

  it('hide 收场：体检窗（窗内为体检发现）随面板关闭一并收起', async () => {
    await dm.lockNote({ path: '笔记/h.md', title: 'H', content: '# h', attachments: [] });
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    await ui.openHealthDialog();
    await waitFor(() => document.getElementById('bz-encrypt-health-popup')!.style.display === 'flex');
    ui.hide();
    expect(ui.popup!.style.display).toBe('none');
    expect(document.getElementById('bz-encrypt-health-popup')!.style.display).toBe('none');
  });
});

describe('批 B · T3 锁屏清扫（closeAllDialogs + cleanup）', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await dm.unlock('pw');
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup'].forEach((id) => document.getElementById(id)?.remove());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('closeAllDialogs：进行中的解锁屏被正规取消（等待方 resolve(false)），DOM 无锁屏残留', async () => {
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    ui.closeAllDialogs();
    expect(await p).toBe(false);
    expect(document.querySelector('body > .bz-lockscreen--mask')).toBeNull();
  });

  it('closeAllDialogs：销毁确认屏一并清扫，未确认不销毁', async () => {
    const note = await dm.lockNote({ path: '笔记/k.md', title: 'K', content: '# k', attachments: [] });
    ui.confirmDeleteNote(note);
    await waitFor(() => !!document.querySelector('body > .bz-lockscreen--mask'));
    ui.closeAllDialogs();
    expect(document.querySelector('body > .bz-lockscreen--mask')).toBeNull();
    expect(dm.manifest.notes.length).toBe(1); // 未重输主密码确认 → 不销毁
  });

  it('T5 配套：解锁屏开着时禁用插件（cleanup）→ body 无锁屏残留，等待方不悬挂', async () => {
    // 摘掉 describe 级 ui 的同 id 骨架，避免与 controller 的 popup 撞 id 干扰断言
    ui.popup?.remove();
    ui.mask?.remove();
    const c = new EncryptAppController(CONFIG);
    await c.init();
    const p = c.openManager(); // 锁定（controller 自有 SafeManager）→ 解锁屏（openManager 挂在解锁结果上）
    await waitFor(() => !!document.querySelector('body > .bz-lockscreen--mask'));
    c.cleanup();
    expect(document.querySelector('body > .bz-lockscreen--mask')).toBeNull();
    await p; // 正规取消链放行：cleanup 后 await 可完成（不悬挂）
    expect(c.uiManager.popup).toBeNull(); // cleanup 收口置空；面板未展示（取消路径）
    EncryptAppController.instance = null;
  });
});

describe('批 B · T4 销毁日记升级主密码防护（对齐销毁笔记）', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await dm.unlock('pw');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('confirmDestroyDiary：错密码行内报错不销毁；对密码销毁并清明文缓存', async () => {
    const note = await dm.lockNote({
      path: '我的/日记/2025-06-01.md', title: 'D', kind: 'diary-entry', content: '# 日记', attachments: [],
    });
    (ui as any)._diaryPlain[note.id] = '明文残留';
    ui.confirmDestroyDiary(note);
    await waitFor(() => !!findDialog());
    const mask = findDialog()!;
    // 防护升级：销毁确认屏（重输主密码），而非旧版普通确认框
    expect(mask.textContent).toContain('彻底销毁日记');
    expect(mask.querySelector('input.bz-lockscreen-input')).toBeTruthy();
    const { input, btn } = dialogControls(mask);
    // 错密码：行内报错，条目保留
    input.value = 'wrong';
    btn.click();
    await waitFor(() => (document.querySelector('.bz-lockscreen-err')?.textContent || '').includes('主密码错误'));
    expect(dm.manifest.notes.length).toBe(1);
    // 对密码：销毁成功 + 明文缓存清理（以成功 toast 为锚——它在 onConfirmed 链内
    // delete 明文缓存之后同拍发出；removeNote 先清 manifest 后 resolve，单等 notes=0 有竞态）
    input.value = 'pw';
    btn.click();
    await waitFor(() => hasNotice('已销毁「D」'));
    expect(dm.manifest.notes.length).toBe(0);
    expect((ui as any)._diaryPlain[note.id]).toBeUndefined();
    expect(findDialog()).toBeFalsy();
  });
});

describe('批 B · T5 外部上锁事件侧清场 + 锁定态预览提示', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await dm.unlock('pw');
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-preview-mask', 'bz-encrypt-preview-popup'].forEach((id) => document.getElementById(id)?.remove());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('encrypt:unlock-changed(false)（他域直调 lock）→ 清选择态/明文缓存/体检缓存 + 收起预览与面板', async () => {
    const note = await dm.lockNote({
      path: '笔记/e.md', title: 'E', content: '![[pic.png]]',
      attachments: [{ path: 'pic.png', data: 'QUJD', previewData: 'data:image/jpeg;base64,QUJD' }],
    });
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    (ui as any)._selNoteId = note.id;
    (ui as any)._diaryPlain['d1'] = '明文';
    ui.lastHealth = { issues: 1, lastChecked: 'x' };
    await ui.openPreview(note);
    await waitFor(() => ui.previewPopup!.style.display === 'flex');
    // 模拟密码本面板侧直调 SafeManager.lock()（不经本域 lockNow/hide）
    dm.lock();
    await new Promise((r) => setTimeout(r, 30));
    expect(ui.popup!.style.display).toBe('none'); // 面板收起（重开走解锁）
    expect(ui.previewPopup!.style.display).toBe('none'); // 预览明文收起
    expect((ui as any)._selNoteId).toBeNull();
    expect((ui as any)._diaryPlain).toEqual({});
    expect(ui.lastHealth).toBeNull();
  });

  it('锁定态 openPreview 早退不再静默：提示「保险库已上锁，请先解锁再预览」', async () => {
    const note = await dm.lockNote({ path: '笔记/n.md', title: 'N', content: '# n', attachments: [] });
    dm.lock();
    const spy = vi.spyOn(dm, 'decryptNoteBody');
    await ui.openPreview(note);
    expect(hasNotice('保险库已上锁，请先解锁再预览')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    expect(ui.previewPopup!.style.display).toBe('none');
  });
});

describe('批 B · T6 解锁屏单例 + T7 busy 防重 + T11 密码错误单通知', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await dm.unlock('pw');
    dm.lock();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('T6 单例守卫：进行中复用同一 Promise，快速双触发只开一层解锁屏', async () => {
    const p1 = ui.showPasswordDialog();
    const p2 = ui.showPasswordDialog(); // 同步双触发：占位期内复用
    await waitFor(() => !!findDialog());
    expect(document.querySelectorAll('body > .bz-lockscreen--mask').length).toBe(1);
    const mask = findDialog()!;
    const { input, btn } = dialogControls(mask);
    input.value = 'pw';
    btn.click();
    expect(await p1).toBe(true);
    expect(await p2).toBe(true); // 同一 Promise：解锁一次两个等待方同拍放行
    expect(findDialog()).toBeFalsy();
  });

  it('T7 busy 防重：PBKDF2 窗口内连点/回车不再并发 unlock（主按钮 disabled）', async () => {
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    let resolveUnlock!: (v: boolean) => void;
    const spy = vi.spyOn(dm, 'unlock').mockImplementation(() => new Promise<boolean>((r) => { resolveUnlock = r; }));
    const { input, btn } = dialogControls(findDialog()!);
    input.value = 'pw';
    btn.click();
    expect(btn.disabled).toBe(true); // busy：主按钮禁用（输入框同步禁用）
    btn.click(); // 连点
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); // Enter（busy 期 click 不触发）
    expect(spy.mock.calls.length).toBe(1);
    resolveUnlock(true);
    expect(await p).toBe(true);
  });

  it('T11 密码错误单通知：行内报错与冷却提示合并为一条「密码错误，N 秒后可重试」', async () => {
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const { input, btn } = dialogControls(findDialog()!);
    input.value = 'wrong';
    btn.click();
    await waitFor(() => (document.querySelector('.bz-lockscreen-err')?.textContent || '').includes('密码错误'));
    const msgs = getNoticeMessages().filter((m) => m.includes('密码错误'));
    expect(msgs).toEqual(['密码错误，1 秒后可重试']); // 恰一条，双信息合一
    expect(getNoticeMessages().some((m) => m.includes('可再次尝试'))).toBe(false);
    // 冷却结束后正确密码可解锁（不回归节流行为）
    await new Promise((r) => setTimeout(r, 1100));
    input.value = 'pw';
    btn.click();
    expect(await p).toBe(true);
  });
});

describe('批 B · T8 预览正文解密 null 占位 + T13 渲染 Component unload', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await dm.unlock('pw');
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-preview-mask', 'bz-encrypt-preview-popup'].forEach((id) => document.getElementById(id)?.remove());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('T8：decryptNoteBody 返 null → 显式「正文解密失败」占位（与 throw 分支同文案）+ 画廊兜底', async () => {
    const note = await dm.lockNote({
      path: '笔记/null.md', title: 'NL', content: '# 无镜像',
      attachments: [{ path: 'only.png', data: 'QUJD', previewData: 'data:image/jpeg;base64,QUJD' }],
    });
    vi.spyOn(dm, 'decryptNoteBody').mockResolvedValue(null);
    await ui.openPreview(note);
    const popup = () => document.getElementById('bz-encrypt-preview-popup')!;
    await waitFor(() => popup().textContent!.includes('正文解密失败'));
    expect(document.querySelector('.bz-encrypt-preview-gallery')).toBeTruthy(); // 附件仍走画廊兜底
  });

  it('T13：closePreview 收掉渲染 Component（unload），句柄清空', async () => {
    const note = await dm.lockNote({ path: '笔记/c.md', title: 'C', content: '# 正文', attachments: [] });
    await ui.openPreview(note);
    await waitFor(() => !!document.querySelector('.bz-encrypt-preview-md'));
    const comp = (ui as any)._previewComponent as { unload: ReturnType<typeof vi.fn> } | null;
    expect(comp).toBeTruthy();
    ui.closePreview();
    expect(comp!.unload).toHaveBeenCalled();
    expect((ui as any)._previewComponent).toBeNull();
  });
});

describe('批 B · T9 体检重入守卫 + T10 体检锁定态如实', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await dm.unlock('pw');
    await dm.lockNote({ path: '笔记/hs.md', title: 'HS', content: '# hs', attachments: [] });
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-health-mask', 'bz-encrypt-health-popup'].forEach((id) => document.getElementById(id)?.remove());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('T9：扫描中点「重新体检」不并发双扫（按钮 disabled，旗标拦截）', async () => {
    let resolveScan!: (v: { items: never[]; integrityChecked: boolean }) => void;
    const spy = vi.spyOn(dm, 'scanHealth').mockImplementation(
      () => new Promise((r) => { resolveScan = r; })
    );
    await ui.openHealthDialog();
    const rescan = () => document.getElementById('bz-encrypt-health-rescan') as HTMLButtonElement;
    await waitFor(() => rescan()?.disabled === true); // 扫描中禁用
    const calls = spy.mock.calls.length;
    rescan().click(); // 重入被旗标拦截
    await new Promise((r) => setTimeout(r, 40));
    expect(spy.mock.calls.length).toBe(calls);
    resolveScan({ items: [], integrityChecked: true });
    await waitFor(() => rescan()?.disabled === false); // 收场复位
    // 完成后再点可正常重扫
    rescan().click();
    await waitFor(() => spy.mock.calls.length === calls + 1);
  });

  it('T10：锁定态体检如实呈现「保险库已上锁，无法体检」+ 禁用清理/重扫（不误报全绿）', async () => {
    dm.lock();
    const spy = vi.spyOn(dm, 'scanHealth');
    ui.showPasswordDialog = vi.fn(async () => true); // 体检窗已开着（外部上锁场景）：绕过解锁直接进扫描
    await ui.openHealthDialog();
    const body = document.getElementById('bz-encrypt-health-body')!;
    await waitFor(() => body.textContent!.includes('保险库已上锁，无法体检'));
    expect(spy).not.toHaveBeenCalled(); // 锁定态不跑扫描，不误报「0 个问题」
    expect((document.getElementById('bz-encrypt-health-clean') as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById('bz-encrypt-health-rescan') as HTMLButtonElement).disabled).toBe(true);
  });
});

/** 轮询等 lock-stats 落盘（writeLockStats 为 fire-and-forget 异步写） */
async function readStatsEventually(kind: 'vault' | 'diary' | 'password-vault') {
  const start = Date.now();
  let stats: Awaited<ReturnType<typeof readLockStats>> = null;
  while (!(stats = await readLockStats(kind))) {
    if (Date.now() - start > 4000) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  return stats;
}

describe('批 B · T12 统计快照挪上锁消费点 + T14 错误文案收口 + T15 死代码', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    await dm.unlock('pw');
    await dm.lockNote({ path: '笔记/s.md', title: 'S', content: '# s', attachments: [] });
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup'].forEach((id) => document.getElementById(id)?.remove());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('T12：lockNow 在面板未打开（renderAll 不触发）时也快照——lock-stats.json 落真实计数', async () => {
    // 面板从未 show：rootVisible 恒 false，renderAll 首行快照不会触发；快照须由 lockNow 自身承担
    ui.lockNow();
    expect(dm.unlocked).toBe(false);
    const stats = await readStatsEventually('vault');
    expect(stats?.[0]).toMatchObject({ num: '1', label: '笔记条目' });
  });

  it('T12：安全模式 hide 上锁前快照一次', async () => {
    const ui2 = new UIManager(dm, { ...CONFIG, securityMode: true });
    ui2.ensureElements();
    ui2.hide(); // 安全模式：hide 即上锁，上锁前须快照
    expect(dm.unlocked).toBe(false);
    const stats = await readStatsEventually('vault');
    expect(stats?.[0]).toMatchObject({ num: '1', label: '笔记条目' });
    ui2.popup?.remove();
    ui2.mask?.remove();
  });

  it('T14：还原日记失败走「还原日记失败：…，请重试」（notifyActionError 单源）', async () => {
    const note = await dm.lockNote({
      path: '我的/日记/r.md', title: 'R', kind: 'diary-entry', content: '# r', attachments: [],
    });
    vi.spyOn(dm, 'decryptNoteBody').mockRejectedValue(new Error('解密炸了'));
    await (ui as any).restoreDiaryEntry(note, null);
    expect(hasNotice('还原日记失败：解密炸了，请重试')).toBe(true);
    expect(hasNotice('还原失败：解密炸了')).toBe(false); // 旧手拼 toast 退役
  });

  it('T14：销毁失败（removeNote 拒绝）走「销毁失败：…，请重试」', async () => {
    const note = await dm.lockNote({ path: '笔记/dd.md', title: 'DD', content: '# dd', attachments: [] });
    vi.spyOn(dm, 'removeNote').mockRejectedValue(new Error('删炸了'));
    ui.confirmDeleteNote(note);
    await waitFor(() => !!findDialog());
    const { input, btn } = dialogControls(findDialog()!);
    input.value = 'pw';
    btn.click();
    await waitFor(() => hasNotice('销毁失败：删炸了，请重试'));
  });

  it('T15：LOCK_KIND_META / DEFAULT_PW_CHARSET 不再由 ui.ts 导出（降模块常量/删再导出）', async () => {
    const mod = await import('../../src/encrypt/ui');
    expect((mod as any).LOCK_KIND_META).toBeUndefined();
    expect((mod as any).DEFAULT_PW_CHARSET).toBeUndefined();
  });

  it('T15：体检时间格式统一 zh-CN 24 小时制（lastChecked 无 AM/PM）', async () => {
    await ui.openHealthDialog();
    await waitFor(() => !!document.querySelector('.bz-encrypt-health-summary'));
    const lastChecked = (ui as any).lastHealth.lastChecked as string;
    expect(lastChecked).toMatch(/^\d{4}\/\d{1,2}\/\d{1,2} \d{1,2}:\d{2}:\d{2}$/);
    expect(lastChecked).not.toMatch(/AM|PM|上午|下午/);
  });
});
