/**
 * 锁家族修复批回归（review-all-bugs.md 三节 encrypt UI 侧）：
 * E3 日记详情异步解密回填补验当前资产、E9 渲染超时后迟到 promise 不再向同容器追加、
 * E11 安全模式空闲自动上锁通知收敛为一条、E18 首设主密码至少 4 位（与密码本同规则）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { UIManager } from '../../src/encrypt/ui';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices, mockMarkdownRenderer } from '../mock-obsidian-entry';

async function waitFor(cond: () => boolean, timeout = 4000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const CONFIG = { root: 'CONFIG/.ENCRYPT', previewEnabled: false, previewSize: 384, previewQuality: 0.5, autoLoadOriginal: false, securityMode: true };

function findDialog(): HTMLElement | null {
  return [...document.querySelectorAll('div')].find((d) => d.classList.contains('bz-encrypt-dialog-mask') && d.style.display === 'flex') as HTMLElement | null;
}

describe('锁家族修复批（encrypt UI）', () => {
  let vault: MockVault;
  let dm: SafeManager;
  let ui: UIManager;

  beforeEach(() => {
    vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app as any);
    setSettingsProvider(() => ({ ...CONFIG, securityMode: false }) as any);
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    dm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(dm, CONFIG);
    ui.ensureElements();
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-preview-mask', 'bz-encrypt-preview-popup'].forEach((id) => {
      document.getElementById(id)?.remove();
    });
    ui.stopSessionTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('E18：首设主密码短于 4 位拒绝（与密码本锁屏同规则）；≥4 位可正常设置', async () => {
    const p = ui.showPasswordDialog();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    const inputs = dialog.querySelectorAll('input[type="password"]');
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    // 两遍一致但只有 3 位 → 拒绝
    (inputs[0] as HTMLInputElement).value = 'abc';
    confirmBtn.click(); // 第一步：转入再次输入
    (inputs[1] as HTMLInputElement).value = 'abc';
    confirmBtn.click();
    expect(hasNotice('主密码至少 4 位')).toBe(true);
    expect(dm.unlocked).toBe(false);
    // ≥4 位 → 走风险确认后设置成功
    (inputs[0] as HTMLInputElement).value = 'abcd';
    (inputs[1] as HTMLInputElement).value = 'abcd';
    (dialog.querySelector('.bz-encrypt-dialog-ack input') as HTMLInputElement).checked = true;
    confirmBtn.click();
    await waitFor(() => dm.unlocked);
    void p;
  });

  it('E11：安全模式空闲自动上锁只弹一条通知（lockNow 安静上锁，hide 不再补发）', async () => {
    vi.useFakeTimers();
    try {
      await dm.unlock('long-enough-pw');
      clearNotices();
      ui.show();
      // 拨到 15 分钟无交互
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 10);
    } finally {
      vi.useRealTimers();
    }
    const texts = '';
    void texts;
    // 通知只此一条：空闲路径的「15 分钟无操作」，无 hide 补发的「已自动上锁」
    expect(hasNotice('安全模式：15 分钟无操作，已自动上锁')).toBe(true);
    expect(hasNotice('安全模式：已自动上锁')).toBe(false);
    expect(dm.unlocked).toBe(false);
  });

  it('E3：日记详情异步解密期间切到密码资产 → 回填被资产校验拦下，详情区不再被日记卡覆盖', async () => {
    await dm.unlock('long-enough-pw');
    const note = await dm.lockNote({
      path: '我的/日记/2025-06-01.md',
      title: '2025-06-01',
      kind: 'diary-entry',
      content: '# 📝 08:00\n晨间记录。',
      attachments: [],
    });
    // 延迟解密：让 then 回调落在用户切资产之后
    let resolveDecrypt!: (t: string | null) => void;
    vi.spyOn(dm, 'decryptNoteBody').mockImplementation(() => new Promise((r) => (resolveDecrypt = r)));

    // 打开面板（renderAll 需要 rootVisible）→ 直落日记资产并选中该条目
    ui.show();
    (ui as any).asset = 'diary';
    (ui as any)._selNoteId = note.id;
    const detail = (ui as any).desk.detail as HTMLElement;
    (ui as any).renderAll();
    expect(detail.textContent).toContain('2025-06-01');

    // 用户切到「密码」资产 → 详情区重绘为密码视图；此刻解密才迟到完成
    (ui as any).asset = 'pw';
    (ui as any).renderAll();
    const pwSnapshot = detail.innerHTML;
    resolveDecrypt('# 📝 08:00\n晨间记录。');
    await new Promise((r) => setTimeout(r, 30));
    // 修复前：then 只验条目 id，日记详情卡盖进密码视图；修复后资产不符直接放弃回填
    expect(detail.innerHTML).toBe(pwSnapshot);
    expect(detail.textContent).not.toContain('晨间记录。');
    expect(((ui as any).asset)).toBe('pw');
  });

  it('E9：渲染超时降级纯文本后，迟到的 render promise 追加进孤儿容器——正文不叠双份', async () => {
    await dm.unlock('long-enough-pw');
    const note = await dm.lockNote({
      path: '我的/笔记/late.md',
      title: 'late',
      content: '# 正文\n迟到渲染内容',
      attachments: [],
    });
    // 正文解密替换为即时解析（排除真实 PBKDF2 与虚拟时钟的交错），聚焦渲染超时链路
    vi.spyOn(dm, 'decryptNoteBody').mockResolvedValue('# 正文\n迟到渲染内容');
    const prev = mockMarkdownRenderer.render.getMockImplementation();
    // 3.2s 后才完成（超过 3s 超时）：迟到追加语义与真机一致（appendChild）
    mockMarkdownRenderer.render.mockImplementation(async (_app: any, md: string, el: HTMLElement) => {
      await new Promise((r) => setTimeout(r, 3200));
      const block = document.createElement('div');
      block.textContent = md;
      el.appendChild(block);
    });
    vi.useFakeTimers();
    try {
      void ui.openPreview(note);
      await vi.advanceTimersByTimeAsync(0); // 冲掉微任务：解密完成、render 发起、race 计时开始
      await vi.advanceTimersByTimeAsync(3100); // 越过超时线，纯文本兜底已渲染
      const popup = document.getElementById('bz-encrypt-preview-popup')!;
      expect(popup.textContent).toContain('# 正文');
      expect(popup.querySelector('.bz-encrypt-preview-md')!.children.length).toBe(0); // 纯文本兜底：无子元素
      await vi.advanceTimersByTimeAsync(500); // 迟到 render 此刻才完成并追加
      // 关键断言：追加进了被弃用的孤儿容器，弹窗内正文不叠双份
      expect(popup.querySelectorAll('.bz-encrypt-preview-md > div').length).toBe(0);
      expect(popup.textContent!.split('迟到渲染内容').length - 1).toBeLessThanOrEqual(1);
    } finally {
      vi.useRealTimers();
      mockMarkdownRenderer.render.mockImplementation(prev!);
    }
  });
});
