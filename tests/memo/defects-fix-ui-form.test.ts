/**
 * memo 重审缺陷修复批 · 表单/交互杂项回归（tests/memo/defects-fix-ui-form.test.ts，防撞命名）
 * 覆盖（来源标注于各用例）：
 *  - memo2-arch 新-1 / memo2-func #9 / memo2-ui MR2-3：编辑保存 url 按场景分流——
 *    非剪藏跟随内容（删链接可表达）、剪藏保留兜底（防丢链）。
 *  - memo2-consistency 旧-1：编辑弹窗 requestClose/confirmDiscard 脏表单拦截。
 *  - memo2-ui MR2-2：公开课编辑联想层不再未经聚焦自动弹出。
 *  - memo2-ui M3-10：卡片/勾选圈/折叠条键盘可达（Enter/Space）。
 *  - memo2-ui M3-3：移动抽屉头「位置」标签可点（先关抽屉再跳转）。
 *  - memo2-consistency 新-6：复制内容失败走 notifyActionError（不再静默 unhandled）。
 * 一切以自造 fixture 验证，不读用户真实数据。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, unloadMemo } from '../../src/memo/ui';
import { MemoData } from '../../src/memo/data';

const PATH = 'CONFIG/STORAGE/memo.json';
const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '@last',
  memoDoneWindow: '30',
  cinemaFolderPath: '我的/影视',
};

function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'x', title: '条目', scene: '工作', priority: 'minor', created: at(-1, '10:00'),
    completed: null, due: null, notePath: null, notePosition: null,
    scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
    ...overrides,
  };
}

function seed(vaultItems: Record<string, unknown>[], settingsOverride: Record<string, unknown> = {}) {
  const vault = new MockVault();
  if (vaultItems.length) vault.files.set(PATH, JSON.stringify(vaultItems, null, 2));
  const settings = { ...SETTINGS, ...settingsOverride };
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app, settings };
}

beforeEach(() => {
  resetObsidianMocks();
  resetMemoState();
  document.body.innerHTML = '';
  MockPlatform.isMobile = false;
});

afterEach(() => {
  closeMemoPanel();
  unloadMemo();
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
});

describe('memo2-arch 新-1 / memo2-func #9 / MR2-3：编辑保存 url 场景分流', () => {
  it('修复前必红形态：非剪藏条目删掉内容里的链接 → 保存后 url 清除（不再 ?? editing.url 残留）', async () => {
    const { app, vault } = seed([item({ id: 'u1', title: '看 https://example.com/a', url: 'https://example.com/a' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(M.items.length).toBe(1));
    const { openEditor } = await import('../../src/memo/ui');
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
    (editor.querySelector('textarea') as HTMLTextAreaElement).value = '看完了'; // 链接已删
    ([...editor.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('保存')) as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeNull());
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw[0].url).toBeNull();
  });

  it('剪藏条目兜底保留：内容无链接（标题=页面标题形态）编辑后 url 不丢', async () => {
    const { app, vault } = seed([item({ id: 'u2', title: '某页面标题', scene: '剪藏', url: 'https://example.com/clip' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(M.items.length).toBe(1));
    const { openEditor } = await import('../../src/memo/ui');
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
    (editor.querySelector('textarea') as HTMLTextAreaElement).value = '我的阅读笔记'; // 正文无 URL
    ([...editor.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('保存')) as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeNull());
    const raw = JSON.parse(vault.files.get(PATH)!);
    expect(raw[0].url).toBe('https://example.com/clip'); // 剪藏兜底保留
  });
});

describe('memo2-consistency 旧-1：编辑弹窗脏表单拦截（requestClose/confirmDiscard）', () => {
  it('修复前必红形态：脏表单 ESC → 放弃确认框；继续编辑保留弹窗与草稿，放弃才关', async () => {
    const { app } = seed([item({ id: 'd1', title: '原内容' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(M.items.length).toBe(1));
    const { openEditor } = await import('../../src/memo/ui');
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
    (editor.querySelector('textarea') as HTMLTextAreaElement).value = '改了一半的内容';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await vi.waitFor(() => {
      const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
      expect(popup?.querySelector('h4')?.textContent).toBe('放弃未保存的内容？');
    });
    // 继续编辑：弹窗与草稿都在
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    const cancel = [...popup.querySelectorAll('button')].find((b) => b.textContent === '继续编辑') as HTMLElement;
    cancel.click();
    expect(document.querySelector('.bz-memo-editor')).toBeTruthy();
    expect((document.querySelector('.bz-memo-editor textarea') as HTMLTextAreaElement).value).toBe('改了一半的内容');
    // 再 ESC → 放弃 → 关闭
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    const popup2 = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    const ok = [...popup2.querySelectorAll('button')].find((b) => b.textContent === '放弃') as HTMLElement;
    ok.click();
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeNull());
  });

  it('未脏（无任何输入改动）时 ESC 直接关闭，不弹确认框', async () => {
    const { app } = seed([item({ id: 'd2', title: '原内容' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(M.items.length).toBe(1));
    const { openEditor } = await import('../../src/memo/ui');
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeNull());
    expect(document.getElementById('__shared_confirm_popup__')).toBeNull();
  });
});

describe('memo2-ui MR2-2：公开课编辑联想层不请自来修复', () => {
  it('修复前必红形态：编辑公开课条目弹窗打开后无联想浮层（不再合成 focus 自动弹出）', async () => {
    const { app, vault } = seed([item({ id: 'c1', title: '上课笔记', scene: '公开课', courseName: '动手学深度学习' })]);
    vault.files.set('我的/影视/动手学深度学习.md', '---\ntags: [公开课]\n---\n课程笔记');
    openMemoPanel(app);
    await vi.waitFor(() => expect(M.items.length).toBe(1));
    const { openEditor } = await import('../../src/memo/ui');
    openEditor(M.items[0]);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-editor')).toBeTruthy());
    // 候选异步装载完成后也不自动弹层
    await new Promise((r) => setTimeout(r, 80));
    const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
    expect(editor.querySelector('.bz-popover')).toBeNull();
    // 真实输入才弹出（功能不回归；候选排除当前值，故输部分字再断言）
    const courseInput = editor.querySelectorAll('.bz-memo-extra')[2].querySelector('input') as HTMLInputElement;
    courseInput.value = '动手';
    courseInput.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(editor.querySelector('.bz-popover')).toBeTruthy());
  });
});

describe('memo2-ui M3-10：键盘可达', () => {
  it('卡片聚焦 Enter 打开操作菜单；勾选圈 Enter 走完成防抖；折叠条 Enter 切换展开', async () => {
    const { app } = seed([
      item({ id: 'k1', title: '键盘条目' }),
      item({ id: 'k2', title: '昨天完成的', completed: at(-1, '18:00') }),
    ]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="k1"]')).toBeTruthy());
    // 卡片：tabindex 在位 + Enter 开菜单
    const card = document.querySelector('.bz-memo-card[data-memo-id="k1"]') as HTMLElement;
    expect(card.getAttribute('tabindex')).toBe('0');
    card.focus();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const { closeItemMenu } = await import('../../src/core/item-actions');
    closeItemMenu();
    // 勾选圈：role/aria/tabindex + Enter 排程完成（防抖窗口内不落盘）
    const check = card.querySelector('[data-memo-check]') as HTMLElement;
    expect(check.getAttribute('role')).toBe('checkbox');
    expect(check.getAttribute('tabindex')).toBe('0');
    check.focus();
    check.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(M.completeTimers.has('k1')).toBe(true); // 300ms 防抖已排程
    check.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); // 反悔取消
    expect(M.completeTimers.has('k1')).toBe(false);
    // 折叠条：role/tabindex + Enter 切换
    const bar = document.querySelector('[data-memo-donebar]') as HTMLElement;
    expect(bar.getAttribute('role')).toBe('button');
    expect(bar.getAttribute('tabindex')).toBe('0');
    const before = M.showDone;
    bar.focus();
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(M.showDone).toBe(!before);
  });
});

describe('memo2-ui M3-3：移动抽屉头「位置」标签可点', () => {
  it('修复前必红形态：长按抽屉头位置标签点击 → 关抽屉 + 提示（目标缺失时面板保留）', async () => {
    MockPlatform.isMobile = true;
    const { app } = seed([item({ id: 's1', title: '有定位的条目', notePath: '笔记/已删.md' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card')).toBeTruthy());
    const card = document.querySelector('.bz-memo-card[data-memo-id="s1"]') as HTMLElement;
    card.dispatchEvent(new Event('touchstart', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1000)); // 越过长按 500ms 阈值
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).toBeTruthy();
    const headPos = sheet.querySelector('.bz-item-sheet-head [data-memo-pos]') as HTMLElement;
    expect(headPos).toBeTruthy();
    headPos.click();
    // 先关抽屉再执行（勾选圈同款收束）；目标缺失 → 提示且面板保留
    await vi.waitFor(() => expect(document.querySelector('.bz-item-sheet')).toBeNull());
    await vi.waitFor(() => {
      const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
      expect(msgs.some((m) => m === '关联笔记不存在')).toBe(true);
    });
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
  });
});

describe('memo2-consistency 新-6：复制内容失败兜底', () => {
  it('修复前必红形态：剪贴板写入拒绝 → 失败通知（不再静默 unhandled）', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.reject(new Error('权限拒绝'))), configurable: true },
    });
    const { app } = seed([item({ id: 'cp1', title: '要复制的条目' })]);
    openMemoPanel(app);
    await vi.waitFor(() => expect(document.querySelector('.bz-memo-card[data-memo-id="cp1"]')).toBeTruthy());
    (document.querySelector('.bz-memo-card[data-memo-id="cp1"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const hit = ([...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[]).find(
      (b) => b.querySelector('.bz-item-menu-label')?.textContent === '复制内容'
    );
    (hit as HTMLElement).click();
    await vi.waitFor(() => {
      const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
      expect(msgs.some((m) => m?.includes('复制内容失败'))).toBe(true);
    });
  });
});
