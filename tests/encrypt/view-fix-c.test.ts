/**
 * encrypt 域深审 · 批 C（ui 渲染导航区）回归（view-fix-c）
 * 覆盖：
 *  - T1(P1) 加密日记资产入口恢复（ADR-0158 拍板回潮）：nav/seg 日记项可达、setAsset/setAssetFromNav
 *    不再把 diary 折为 note、renderDeskNotes('diary') 与详情三动作复活、停留日记重开面板直落日记
 *  - T2 概览绑定抽 bindOverviewArea：移动概览 hero/统计卡/流水/体检卡点击可达
 *  - T3 列表滚位保留：行选中全量重建前后 .bz-vault-lc-body scrollTop 还原
 *  - T4 搜索 ESC 清词（有词截断关面板链，安全模式不误上锁；无词放行）+ ✕ 清除钮
 *  - T5 概览流水 data-recent 恢复真实资产值 + hero「N 项资产」与左栏概览计数同口径（note+diary）
 *  - T6 概览流水先排序后截断（显示最新 6 条，非最早 6 条）
 *  - T7 statusbarHtml 单源（vault-assets-view 导出，attachStatusBar 消费同一份）
 *  - T11 renderAll 不再触发 lock-stats 落盘 + pwDataManager.load 解锁会话内一次化
 *  - T12 index.ts init 抛错可重试 + openEncrypt 失败通知（无 unhandled rejection）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { readLockStats } from '../../src/core/lock-stats';
import { SafeManager, type SafeNote } from '../../src/encrypt/data';
import { EncryptAppController, UIManager } from '../../src/encrypt/ui';
import { statusbarHtml } from '../../src/encrypt/vault-assets-view';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, clearNotices } from '../mock-obsidian-entry';

const CONFIG = {
  root: 'CONFIG/.ENCRYPT',
  previewEnabled: false,
  previewSize: 384,
  previewQuality: 0.5,
  autoLoadOriginal: false,
  securityMode: false,
};

async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** 伪造 SafeNote（纯 UI 层 fixture：直塞 manifest，不落盘、不走加密） */
function fakeNote(i: number, kind: 'note' | 'diary-entry' = 'note', iso?: string): SafeNote {
  const isDiary = kind === 'diary-entry';
  return {
    id: (isDiary ? 'd' : 'n') + i,
    kind: isDiary ? 'diary-entry' : undefined, // SafeNote：缺省 kind = 普通加密笔记
    path: (isDiary ? '我的/日记/d' : '笔记/n') + i + '.md',
    title: (isDiary ? '日记' : '笔记') + i,
    createdAt: iso || new Date(Date.UTC(2025, 5, 1, 10, 0, i)).toISOString(),
    contentRef: `fake-${isDiary ? 'd' : 'n'}${i}.enc`,
    attachments: [],
  };
}

describe('批 C 修复回归：日记入口/概览绑定/滚位/搜索/流水口径（UIManager）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let ui: UIManager;

  beforeEach(async () => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => CONFIG as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    ui = new UIManager(sm, CONFIG);
    ui.ensureElements();
    await sm.unlock('pw');
    // 常驻 fixture：1 篇加密日记 + 1 篇加密笔记（直塞 manifest，纯 UI 层）
    sm.manifest.notes.push(fakeNote(1), fakeNote(2, 'diary-entry'));
  });

  afterEach(() => {
    ui.popup?.remove();
    ui.mask?.remove();
    sm.lock();
    document.body.innerHTML = '';
  });

  it('T1(P1) 日记入口恢复：nav/seg 渲染日记项，点击落加密日记列表且详情三动作复活', async () => {
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-detail > .bz-vault-area'));
    // nav 含日记项（k-diary）+ 计数槽位；seg 含日记段
    const diaryItem = document.querySelector('.bz-vault-nav .bz-vault-item[data-asset="diary"]') as HTMLElement;
    expect(diaryItem).toBeTruthy();
    expect(diaryItem.classList.contains('k-diary')).toBe(true);
    expect(document.querySelector('[data-cnt="diary"]')!.textContent).toBe('1');
    expect(document.querySelector('.bz-vault-mseg .sg[data-masset="diary"]')).toBeTruthy();
    // 点击 nav 日记项 → 资产切到 diary，列表渲染日记条目（book-lock 行），详情含「还原回日记」
    diaryItem.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(ui.asset).toBe('diary');
    expect(document.querySelector('.bz-vault-listcol')!.textContent).toContain('日记2');
    expect(document.querySelector('[data-detail="restore-diary"]')).toBeTruthy();
    expect(document.querySelector('[data-detail="copy-diary"]')).toBeTruthy();
    expect(document.querySelector('[data-detail="destroy-diary"]')).toBeTruthy();
    // seg 点击日记段同样可达
    (document.querySelector('.bz-vault-mseg .sg[data-masset="diary"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(ui.asset).toBe('diary');
  });

  it('T1(P1) setAsset/setAssetFromNav 不再把 diary 折为 note（pw 仍兜底）', () => {
    (ui as any).setAssetFromNav('diary');
    expect(ui.asset).toBe('diary');
    // bindVaultShell 的 setAsset 同语义（经 seg 点击路径已验，此处直验兜底值）
    (ui as any).setAssetFromNav('pw');
    expect(ui.asset).toBe('note');
  });

  it('T1(P1) 连带：停留日记后重开面板直落加密日记（restoreLastAsset 不再折 note）', async () => {
    const c = new EncryptAppController({ ...CONFIG });
    try {
      await c.init();
      await c.dataManager.unlock('pw');
      c.dataManager.manifest.notes.push(fakeNote(3, 'diary-entry'));
      c.uiManager.show();
      (c.uiManager as any).setAssetFromNav('diary');
      c.uiManager.hide();
      await c.openManager(); // 已解锁路径：restoreLastAsset
      expect(c.uiManager.asset).toBe('diary');
      const onItem = c.uiManager.popup!.querySelector('.bz-vault-nav .bz-vault-item.on') as HTMLElement;
      expect(onItem.getAttribute('data-asset')).toBe('diary');
    } finally {
      ['bz-encrypt-mask', 'bz-encrypt-popup'].forEach((id) => document.getElementById(id)?.remove());
      c.dataManager.lock();
      EncryptAppController.instance = null;
    }
  });

  it('T2 概览绑定抽公共：移动概览 hero/统计卡/流水点击可达（此前零绑定全哑）', async () => {
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-mob-overview'));
    const onLock = vi.fn();
    ui.onLockCurrentNote = onLock;
    // 统计卡 → 笔记资产
    (document.querySelector('.bz-vault-mob-overview .card[data-nav="note"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(ui.asset).toBe('note');
    // 回概览：hero「存入笔记」触发 onLockCurrentNote
    (document.querySelector('.bz-vault-nav .bz-vault-item[data-asset="overview"]') as HTMLElement).click();
    await waitFor(() => !!document.querySelector('.bz-vault-mob-overview'));
    (document.querySelector('.bz-vault-mob-overview [data-hero="lock-note"]') as HTMLElement).click();
    expect(onLock).toHaveBeenCalledTimes(1);
    // 日记流水行（data-recent="diary"）→ 落加密日记资产
    const diaryRow = document.querySelector('.bz-vault-mob-overview .bz-vault-minirow[data-recent="diary"]') as HTMLElement;
    expect(diaryRow).toBeTruthy();
    diaryRow.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(ui.asset).toBe('diary');
  });

  it('T3 列表滚位保留：行选中全量重建后 .bz-vault-lc-body scrollTop 还原', async () => {
    for (let i = 3; i <= 27; i++) sm.manifest.notes.push(fakeNote(i)); // 凑长列表（1+25=26 条笔记）
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('.bz-vault-nav .bz-vault-item[data-asset="note"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const body = document.querySelector('.bz-vault-lc-body') as HTMLElement;
    expect(body.querySelectorAll('.bz-vault-row').length).toBe(26);
    body.scrollTop = 200;
    // 点中段一行 → 全量重建详情 + 列表
    (body.querySelectorAll('.bz-vault-row')[10] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const body2 = document.querySelector('.bz-vault-lc-body') as HTMLElement;
    expect(body2.querySelectorAll('.bz-vault-row').length).toBe(26);
    expect(body2.scrollTop).toBe(200); // 重建前后滚位保留（不再跳回顶部）
  });

  it('T4a 搜索 ESC 有词：清词重绘且不关面板（安全模式不误上锁）', async () => {
    ui.mask?.remove();
    ui.popup?.remove(); // 摘掉共享实例 DOM，避免同 id 双元素干扰 getElementById 断言
    const ui2 = new UIManager(sm, { ...CONFIG, securityMode: true });
    ui2.ensureElements();
    ui2.show();
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('.bz-vault-nav .bz-vault-item[data-asset="note"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const search = document.querySelector('[data-vault-search]') as HTMLInputElement;
    search.value = '笔记1';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250)); // 防抖尾触
    expect(ui2.searchKw).toBe('笔记1');
    // ESC：清词 + 截断 escManager 关面板链
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 30));
    expect(ui2.searchKw).toBe('');
    expect(search.value).toBe('');
    expect(ui2.mask!.style.display).toBe('block'); // 面板未关
    expect(sm.unlocked).toBe(true); // 安全模式未误上锁
    ui2.popup?.remove();
    ui2.mask?.remove();
  });

  it('T4b 搜索 ESC 无词：放行走面板关闭链', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('.bz-vault-nav .bz-vault-item[data-asset="note"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const search = document.querySelector('[data-vault-search]') as HTMLInputElement;
    expect(search.value).toBe('');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 30));
    expect(ui.mask!.style.display).toBe('none');
  });

  it('T4c 列表头 ✕ 清除钮：有词显、点击清词 + 焦点回框；两框显隐同步', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('.bz-vault-nav .bz-vault-item[data-asset="note"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const search = document.querySelector('[data-vault-search]') as HTMLInputElement;
    const clearBtn = document.querySelector('.bz-vault-listcol [data-search-clear]') as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    expect(clearBtn.hidden).toBe(true); // 无词隐藏
    search.value = '日记';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    expect(clearBtn.hidden).toBe(false); // 有词显示
    expect((ui as any).mob.search.value).toBe('日记'); // 移动框同步
    clearBtn.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(ui.searchKw).toBe('');
    expect(search.value).toBe('');
    expect((ui as any).mob.search.value).toBe('');
    expect(clearBtn.hidden).toBe(true);
    expect(document.activeElement).toBe(search); // 焦点回框
    // 行还在（清词后全量列表）
    expect(document.querySelectorAll('.bz-vault-lc-body .bz-vault-row').length).toBe(1);
  });

  it('T5 概览流水按真实资产值分流 + hero「N 项资产」= 笔记 + 日记（与左栏计数同口径）', async () => {
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-detail > .bz-vault-area'));
    // hero 合计口径：note 1 + diary 1 = 2 项（旧实现只数 counts.note=1）
    const area = document.querySelector('.bz-vault-detail > .bz-vault-area') as HTMLElement;
    expect(area.querySelector('.bz-vault-hero .hn')!.textContent).toContain('2 项资产');
    expect(document.querySelector('[data-cnt="overview"]')!.textContent).toBe('2');
    // 流水行按真实值标记：note 行与 diary 行各归其位，且都带定位 id
    const noteRow = area.querySelector('.bz-vault-minirow[data-recent="note"]') as HTMLElement;
    const diaryRow = area.querySelector('.bz-vault-minirow[data-recent="diary"]') as HTMLElement;
    expect(noteRow).toBeTruthy();
    expect(diaryRow).toBeTruthy();
    expect(noteRow.getAttribute('data-recent-id')).toBe('n1');
    expect(diaryRow.getAttribute('data-recent-id')).toBe('d2');
    // 点击 diary 行 → 落加密日记列表（旧实现落不含该条目的笔记列表，死端点击）
    diaryRow.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(ui.asset).toBe('diary');
    expect(document.querySelector('.bz-vault-listcol')!.textContent).toContain('日记2');
    expect((ui as any)._selNoteId).toBe('d2'); // 直定位该条目
  });

  it('T6 概览流水先排序后截断：显示最新 6 条（非清单里最早 6 条）', async () => {
    // 8 条 createdAt 递增的笔记（清单顺序 = 时间正序，最早在前）
    sm.manifest.notes.length = 0;
    for (let i = 1; i <= 8; i++) {
      sm.manifest.notes.push(fakeNote(100 + i, 'note', new Date(Date.UTC(2025, 5, 1, 9, 0, i)).toISOString()));
    }
    ui.show();
    await waitFor(() => !!document.querySelector('.bz-vault-detail > .bz-vault-area'));
    const area = document.querySelector('.bz-vault-detail > .bz-vault-area') as HTMLElement;
    const rows = [...area.querySelectorAll('.bz-vault-minirow[data-recent]')];
    expect(rows.length).toBe(6);
    // 第一条是最新（101+8=108），最后一条是第 6 新（103）——最早的 101/102 不出现
    expect(rows[0].getAttribute('data-recent-id')).toBe('n108');
    expect(rows[5].getAttribute('data-recent-id')).toBe('n103');
    const ids = rows.map((r) => r.getAttribute('data-recent-id'));
    expect(ids).not.toContain('n101');
    expect(ids).not.toContain('n102');
  });

  it('T7 statusbarHtml 单源：vault-assets-view 导出，attachStatusBar 消费同一份（E5 收编后为 data-lucide 占位串）', async () => {
    expect(statusbarHtml(false)).toContain('保险库');
    expect(statusbarHtml(false)).toContain('data-lucide="lock"'); // lucide 统一占位，无 emoji
    expect(statusbarHtml(true)).toContain('data-lucide="lock-open"'); // 解锁态翻转为开锁图标
    expect(statusbarHtml(true)).not.toBe(statusbarHtml(false));
    // Controller 接管状态栏时消费的是同一导出（innerHTML 归一化自闭合标签，先 round-trip 再比）
    const norm = (s: string) => {
      const d = document.createElement('div');
      d.innerHTML = s;
      return d.innerHTML;
    };
    const c = new EncryptAppController({ ...CONFIG });
    try {
      await c.init();
      const el = document.createElement('span');
      document.body.appendChild(el);
      c.attachStatusBar(el);
      // attachStatusBar 内部 mountIcons 已把占位兑现成 [data-icon] span——按兑现后形态对账
      const iconOf = (root: HTMLElement) => root.querySelector('[data-icon]')?.getAttribute('data-icon');
      expect(iconOf(el)).toBe('lock');
      expect(el.textContent).toContain('保险库');
      await sm2Unlock(c);
      expect(iconOf(el)).toBe('lock-open');
      c.dataManager.lock();
    } finally {
      ['bz-encrypt-mask', 'bz-encrypt-popup'].forEach((id) => document.getElementById(id)?.remove());
      EncryptAppController.instance = null;
    }
  });

  it('T11 renderAll 不再触发 lock-stats 读盘落盘 + pwDataManager.load 解锁会话内一次化', async () => {
    ui.show();
    await new Promise((r) => setTimeout(r, 400));
    expect(await readLockStats('vault')).toBeNull(); // renderAll 链路不再写 lock-stats.json
    // load 一次化：同解锁会话内多次 renderList 不再重复装载（show 时已装载）
    const loadSpy = vi.spyOn(ui.pwDataManager, 'load');
    await ui.renderList();
    await ui.renderList();
    expect(loadSpy).toHaveBeenCalledTimes(0);
    sm.lock();
    await ui.renderList(); // 锁定态：复位装载旗标
    await sm.unlock('pw');
    await ui.renderList(); // 重新解锁 → 重新装载
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });
});

/** 独立解锁辅助（避免依赖外层 ui/sm） */
async function sm2Unlock(c: EncryptAppController): Promise<void> {
  await c.dataManager.unlock('pw');
}

describe('批 C 修复回归：index.ts 懒加载链（T12）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearNotices();
    document.body.innerHTML = '';
    setApp(mockAppWithVault(new MockVault()) as any);
    setSettingsProvider(() => CONFIG as any);
  });

  afterEach(() => {
    ['bz-encrypt-mask', 'bz-encrypt-popup'].forEach((id) => document.getElementById(id)?.remove());
    document.body.innerHTML = '';
  });

  it('init 抛错：openEncrypt 走 .catch 通知（无 unhandled rejection）；旗标未置位可重试成功', async () => {
    const { openEncrypt, ensureEncrypt } = await import('../../src/encrypt/index');
    const spy = vi.spyOn(EncryptAppController.prototype, 'init').mockRejectedValue(new Error('boom'));
    openEncrypt(getApp() as any);
    await waitFor(() => hasNotice('保险库初始化失败，请重试')); // .catch 生效
    spy.mockRestore();
    // 旗标未置位（init 成功才置）：重试可成功
    await expect(ensureEncrypt(getApp() as any)).resolves.toBeUndefined();
    expect((document.getElementById('bz-encrypt-popup') as HTMLElement).isConnected).toBe(true);
    EncryptAppController.instance = null;
  });
});
