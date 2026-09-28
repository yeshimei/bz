/**
 * ADR-0211 修改主密码 UI 流程（issue 508）：两屏接力复用解锁屏骨架——
 * 屏1 验证当前主密码（错误停留 / 正确前进）、屏2 设置新主密码（一致性 / 当前相同 /
 * 勾选确认 / 成功改密后旧密码失效数据可读）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { UIManager } from '../../src/encrypt/ui';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';

/** 轮询等待（真实 PBKDF2 长异步） */
async function waitFor(cond: () => boolean, timeout = 5000) {
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
}

function findDialog(): HTMLElement | null {
  return [...document.querySelectorAll('div')].find((d) => d.classList.contains('bz-lockscreen--mask') && d.style.display === 'flex') as HTMLElement | null;
}

describe('UIManager 修改主密码（ADR-0211 两屏接力）', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    vault = new MockVault();
    setup(vault);
    document.body.innerHTML = '';
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
    expect(await dm.unlock('old-pw')).toBe(true); // 首设 v2 清单；改密入口要求已解锁
    clearNotices();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('屏1：当前密码错误停留并报错；正确密码进屏2（设置新主密码）', async () => {
    ui.openChangePassword();
    await waitFor(() => !!findDialog());
    let dialog = findDialog()!;
    expect(dialog.textContent).toContain('修改主密码');
    expect(dialog.textContent).toContain('请先验证当前主密码');
    // 错误密码：停留屏1 + 行内/通知报错
    (dialog.querySelector('input[type="password"]') as HTMLInputElement).value = 'wrong';
    (dialog.querySelector('.bz-lockscreen-action') as HTMLElement).click();
    await waitFor(() => hasNotice('当前主密码不正确'));
    expect(findDialog()).toBeTruthy();
    // 正确密码 → 屏2
    dialog = findDialog()!;
    (dialog.querySelector('input[type="password"]') as HTMLInputElement).value = 'old-pw';
    (dialog.querySelector('.bz-lockscreen-action') as HTMLElement).click();
    await waitFor(() => {
      const d = findDialog();
      return !!d && d.textContent!.includes('设置新主密码');
    });
    expect(findDialog()!.querySelectorAll('input[type="password"]').length).toBe(2); // 首设式双输入
  });

  it('屏2：一致性/当前相同/勾选三道闸；通过后改密成功（旧密码失效、数据可读）', async () => {
    await dm.lockNote({ path: '我的/日记/x.md', title: 'x', content: '正文内容', attachments: [] });
    ui.openChangePassword();
    await waitFor(() => !!findDialog());
    let dialog = findDialog()!;
    (dialog.querySelector('input[type="password"]') as HTMLInputElement).value = 'old-pw';
    (dialog.querySelector('.bz-lockscreen-action') as HTMLElement).click();
    await waitFor(() => {
      const d = findDialog();
      return !!d && d.textContent!.includes('设置新主密码');
    });
    dialog = findDialog()!;
    const inputs = [...dialog.querySelectorAll('input[type="password"]')] as HTMLInputElement[];
    const act = () => (dialog.querySelector('.bz-lockscreen-action') as HTMLElement).click();
    // 两次不一致
    inputs[0].value = 'new-pw';
    inputs[1].value = 'new-px';
    act();
    expect(hasNotice('两次密码不一致')).toBe(true);
    // 与当前密码相同
    inputs[0].value = 'old-pw';
    inputs[1].value = 'old-pw';
    act();
    expect(hasNotice('新密码不能与当前密码相同')).toBe(true);
    // 一致但未勾选确认
    inputs[0].value = 'new-pw';
    inputs[1].value = 'new-pw';
    act();
    expect(hasNotice('请先勾选确认')).toBe(true);
    expect(dm.password).toBe('old-pw'); // 三道闸期间密码未动
    // 勾选 → 改密成功（data-ls="ack" 是 label，checkbox 在其内）
    const ack = dialog.querySelector('[data-ls="ack"] input') as HTMLInputElement;
    ack.checked = true;
    act();
    await waitFor(() => hasNotice('主密码已修改，数据文件未变动'), 8000);
    // 数据层裁决：旧密码失效、新密码解锁且数据原样
    const sm2 = new SafeManager('CONFIG/.ENCRYPT');
    expect(await sm2.unlock('old-pw')).toBe(false);
    expect(await sm2.unlock('new-pw')).toBe(true);
    expect(await sm2.decryptNoteBody(sm2.manifest.notes[0])).toBe('正文内容');
  });

  it('未解锁时入口直接返回（不弹改密屏）', async () => {
    dm.lock();
    ui.openChangePassword();
    await new Promise((r) => setTimeout(r, 60));
    expect(findDialog()).toBeFalsy();
  });
});
