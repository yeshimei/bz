// @vitest-environment jsdom
/**
 * 呈报#12-E7（12A 全量拍板的尾巴）保险库工作台键盘化 · 回归测试
 *
 * 拍板内容：工作台内控件 Tab 序完整（div 化的导航项/列表行/健康卡/上锁钮/概览卡/流水行
 * 统一 role=button + tabindex=0 + Enter/Space → click）、ESC 语义收编 registerPanelEsc
 * 六域先例（层 id 'bz-encrypt'，语义不变：预览窗 > 主面板）、不私挂 document 级键盘监听。
 * 牵动剪藏本同型面板（tests/clipbook/bd-paradigm-clip-keyboard.test.ts）；
 * memo 同型面板随 memo 队尾重审统一处理（本轮禁改，代码注释已注记）。
 * 测试自造 fixture（MockVault + SafeManager），不读任何真实密文。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { UIManager } from '../../src/encrypt/ui';
import { PasswordVaultDataManager } from '../../src/password-vault/data';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { unregisterPanelEsc } from '../../src/core/esc-manager';

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

function pressKey(el: Element, key: 'Enter' | ' '): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('保险库工作台键盘化（E7）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: UIManager;

  beforeEach(async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    unregisterPanelEsc('bz-encrypt'); // escManager/panelEscHandles 是模块单例：清上一用例的层槽位
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => CONFIG as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    dm = new PasswordVaultDataManager(sm);
    ui = new UIManager(sm, CONFIG, dm);
    await sm.unlock('pw');
  });

  afterEach(() => {
    unregisterPanelEsc('bz-encrypt'); // 本用例的层随手摘（防串到下一用例）
    ui.popup?.remove();
    ui.mask?.remove();
    sm.lock();
    document.body.innerHTML = '';
  });

  it('骨架 div 化控件全部可焦：导航三项/健康卡/上锁钮/移动 seg 均 role=button + tabindex=0', () => {
    ui.ensureElements();
    for (const sel of ['.bz-vault-nav .bz-vault-item', '.bz-vault-health', '.bz-vault-lockbtn', '.bz-vault-mseg .sg']) {
      const els = [...document.querySelectorAll(sel)];
      expect(els.length, `${sel} 应存在`).toBeGreaterThan(0);
      for (const el of els) {
        expect(el.getAttribute('role'), `${sel} 缺 role=button`).toBe('button');
        expect(el.getAttribute('tabindex'), `${sel} 缺 tabindex=0`).toBe('0');
      }
    }
  });

  it('概览区 div 卡（统计卡/流水行/最近「查看全部」/体检面板）全部可焦', async () => {
    await sm.lockNote({ path: '笔记/a.md', title: '笔记A', content: '# a', attachments: [] });
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-detail > .bz-vault-area'));
    const cards = document.querySelectorAll('.bz-vault-area .card[data-nav]');
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      expect(c.getAttribute('role')).toBe('button');
      expect(c.getAttribute('tabindex')).toBe('0');
    }
    for (const sel of ['.bz-vault-minirow[data-recent]', '[data-hero="recent-all"]', '.bz-vault-two .panel[data-hero="health"]']) {
      const els = [...document.querySelectorAll(sel)];
      expect(els.length, `${sel} 应存在`).toBeGreaterThan(0);
      for (const el of els) {
        expect(el.getAttribute('role'), `${sel} 缺 role=button`).toBe('button');
        expect(el.getAttribute('tabindex'), `${sel} 缺 tabindex=0`).toBe('0');
      }
    }
  });

  it('Enter/Space 触发导航：Enter 落笔记资产（与点击同一落点），aria-current 随高亮同步', async () => {
    ui.ensureElements();
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    const noteItem = document.querySelector('.bz-vault-nav .bz-vault-item[data-asset="note"]') as HTMLElement;
    noteItem.focus();
    pressKey(noteItem, 'Enter');
    await new Promise((r) => setTimeout(r, 30));
    expect(ui.asset).toBe('note');
    expect(noteItem.getAttribute('aria-current')).toBe('true');
    const overviewItem = document.querySelector('.bz-vault-nav .bz-vault-item[data-asset="overview"]') as HTMLElement;
    expect(overviewItem.getAttribute('aria-current')).toBe('false');
  });

  it('列表行键盘化：Enter 选中行并把焦点接回选中行（整刷不断 Tab 序）；Space 同语义', async () => {
    await sm.lockNote({ path: '笔记/a.md', title: '笔记A', content: '# a', attachments: [] });
    await sm.lockNote({ path: '笔记/b.md', title: '笔记B', content: '# b', attachments: [] });
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-detail > .bz-vault-area'));
    (ui as any).setAssetFromNav('note');
    await waitFor(() => document.querySelectorAll('.bz-vault-row').length >= 2);

    const rows = [...document.querySelectorAll<HTMLElement>('.bz-vault-row')];
    for (const r of rows) {
      expect(r.getAttribute('role')).toBe('button');
      expect(r.getAttribute('tabindex')).toBe('0');
    }
    // 键盘流：焦点进「笔记B」行 → Enter 选中 → 焦点接回 .on 行
    //（列表按 createdAt 倒序，同时刻落库顺序不稳，按标题定位目标行）
    const target = rows.find((r) => r.textContent?.includes('笔记B'));
    expect(target, '应能按标题定位到目标行').toBeTruthy();
    const row = target as HTMLElement;
    row.focus();
    pressKey(row, 'Enter');
    await waitFor(() =>
      Boolean((document.querySelector('.bz-vault-row.on') as HTMLElement | null)?.textContent?.includes('笔记B')),
    );
    const onRow = document.querySelector('.bz-vault-row.on') as HTMLElement;
    expect(onRow.dataset.noteid).toBe(row.dataset.noteid);
    expect(document.activeElement).toBe(onRow);
    // Space 同语义：焦点在选中行上按 Space = 再点一次（仍是它）
    pressKey(document.activeElement as HTMLElement, ' ');
    expect((document.querySelector('.bz-vault-row.on') as HTMLElement).dataset.noteid).toBe(row.dataset.noteid);
  });

  it('ESC 语义收编 registerPanelEsc：预览窗开着时第一层收预览，再按才收面板（对外行为不变）', async () => {
    await sm.lockNote({ path: '笔记/a.md', title: '笔记A', content: '# a', attachments: [] });
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-detail > .bz-vault-area'));
    (ui as any).setAssetFromNav('note');
    await waitFor(() => !!document.querySelector('.bz-vault-row'));
    // 打开预览浮层
    (ui as any).openPreview((ui as any).dataManager.manifest.notes[0], 'note');
    await waitFor(() => (ui as any).previewMask?.style.display === 'block');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect((ui as any).previewMask.style.display).toBe('none'); // 第一层：只收预览
    expect(ui.mask!.style.display).toBe('block');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(ui.mask!.style.display).toBe('none'); // 第二层：收面板
  });
});
