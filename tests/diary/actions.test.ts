/**
 * 日记本条目动作回归（ADR-0115 定位重构：filename+lineNumber 谓词写层，id 断层根治）：
 * - 复制双链：普通条目由 entry-actions 本地拼锚点双链；影视/信/书按文件路径拼（无 diary state 依赖）；
 * - 删除：locator 对象传 entry-actions showConfirm（加密分支在 actions 内分流）；
 * - 加密：写层 findDiaryEntry 反查真实条目入库 + removeDiaryEntries 摘除原块（文件实变断言）；
 * - 影视/信/书特殊条目：菜单与抽屉屏蔽「加密」「删除」（对齐旧面板 !special 语义）。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories } from '../../src/diary/config';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, getNoticeMessages, Platform } from '../mock-obsidian-entry';
import { DiaryAppController } from '../../src/diary/ui';

const mocks = vi.hoisted(() => ({
  mediaSrc: vi.fn((_app: any, name: string) => `https://example.com/vault/${encodeURI(name)}`),
  openAddDialog: vi.fn(),
  showTagPicker: vi.fn(),
  jumpToEntry: vi.fn(),
  copyDiaryLink: vi.fn(async () => {}),
  showConfirm: vi.fn(),
  ensureSafeUnlocked: vi.fn(async () => true),
  openEncrypt: vi.fn(),
  isUnlocked: vi.fn(() => false),
  loadEncryptedEntries: vi.fn(async (): Promise<any[]> => []),
  deleteEncryptedEntry: vi.fn(async () => {}),
  encryptEntry: vi.fn(async (_e: any) => ({ encrypted: true })),
  reclassifyEntry: vi.fn(async (): Promise<boolean> => true),
}));
vi.mock('../../src/diary/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/diary/data')>();
  return { ...actual, mediaSrc: mocks.mediaSrc };
});
vi.mock('../../src/diary/ui/dialogs', () => ({
  openAddDialog: mocks.openAddDialog,
  showTagPicker: mocks.showTagPicker,
}));
vi.mock('../../src/diary/ui/entry-actions', () => ({
  jumpToDiaryEntry: mocks.jumpToEntry,
  copyDiaryLink: mocks.copyDiaryLink,
  showConfirm: mocks.showConfirm,
}));
// store 不 mock：真实写层（findDiaryEntry/removeDiaryEntries）直接跑在 MockVault 上
vi.mock('../../src/encrypt', () => ({
  ensureSafeUnlocked: mocks.ensureSafeUnlocked,
  openEncrypt: mocks.openEncrypt,
}));
vi.mock('../../src/diary/encrypt', () => ({
  isUnlocked: mocks.isUnlocked,
  loadEncryptedEntries: mocks.loadEncryptedEntries,
  deleteEncryptedEntry: mocks.deleteEncryptedEntry,
  encryptEntry: mocks.encryptEntry,
  reclassifyEntry: mocks.reclassifyEntry,
}));

let vault: MockVault;

async function waitFor(fn: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeEach(async () => {
  document.body.innerHTML = '';
  clearNotices();
  resetObsidianMocks();
  applyDirectories({});
  for (const fn of Object.values(mocks)) fn.mockClear();
  mocks.ensureSafeUnlocked.mockResolvedValue(true);
  mocks.isUnlocked.mockReturnValue(false);
  mocks.encryptEntry.mockResolvedValue({ encrypted: true });
  // 剪贴板 stub（特殊条目复制双链直写剪贴板）
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(async () => {}) },
    configurable: true,
  });
  vault = new MockVault();
  vault.files.set('我的/日记/2026-08-19.md', '# 📖 23:02\n被猫盯着\n');
  vault.files.set('我的/影视/film.md', '---\n影评: 好看\n观影日期: 2026-08-19\ntags: [电影]\n---\n');
  const app = mockAppWithVault(vault);
  setApp(app);
});

afterEach(() => {
  DiaryAppController.instance?.cleanup();
  DiaryAppController.instance = null;
  document.body.innerHTML = '';
});

async function openAndWait() {
  const c = DiaryAppController.getInstance();
  await c.openManager();
  await waitFor(() => !!document.querySelector('.bz-diary-day-head'));
  return c;
}

function openMenu(item: HTMLElement): HTMLElement {
  item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 60 }));
  const menu = document.querySelector('.bz-item-menu') as HTMLElement;
  expect(menu).toBeTruthy();
  return menu;
}

function menuButton(menu: HTMLElement, label: string): HTMLElement | null {
  return Array.from(menu.querySelectorAll('button')).find((b) => b.textContent!.includes(label)) ?? null;
}

describe('日记本条目动作（ADR-0115 定位重构）', () => {
  it('普通日记条目「复制双链」：entry-actions 收到 filename+emoji+time（本地拼锚点，无反查）', async () => {
    await openAndWait();
    const item = document.querySelector('.bz-diary-desk .bz-diary-item') as HTMLElement;
    const menu = openMenu(item);
    const btn = menuButton(menu, '复制双链')!;
    btn.click();
    await waitFor(() => mocks.copyDiaryLink.mock.calls.length > 0);
    expect(mocks.copyDiaryLink).toHaveBeenCalledWith({ filename: '2026-08-19', emoji: '📖', time: '23:02' });
  });

  it('普通日记条目「删除」：locator 对象传 showConfirm（加密分流在 actions 内）', async () => {
    await openAndWait();
    const item = document.querySelector('.bz-diary-desk .bz-diary-item') as HTMLElement;
    const menu = openMenu(item);
    menuButton(menu, '删除')!.click();
    await waitFor(() => mocks.showConfirm.mock.calls.length > 0);
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);
    const loc = mocks.showConfirm.mock.calls[0][0];
    expect(loc).toMatchObject({ filename: '2026-08-19', date: '2026-08-19', time: '23:02', lineNumber: 1 });
  });

  it('普通日记条目「加密」：写层反查条目入库 + removeDiaryEntries 摘除原块（文件实变）', async () => {
    await openAndWait();
    const item = document.querySelector('.bz-diary-desk .bz-diary-item') as HTMLElement;
    const menu = openMenu(item);
    menuButton(menu, '加密')!.click();
    await waitFor(() => {
      const c = vault.files.get('我的/日记/2026-08-19.md');
      return c === undefined || !c.includes('📖');
    });
    expect(mocks.ensureSafeUnlocked).toHaveBeenCalled();
    // encryptEntry 收到写层反查出的真实条目（date/time/lineNumber 与磁盘一致）
    expect(mocks.encryptEntry.mock.calls[0][0]).toMatchObject({ filename: '2026-08-19', time: '23:02', lineNumber: 1 });
    // 原块已从 md 摘除：条目删除后该日期无剩余条目 → 整文件删除（file-vacated 语义）
    expect(vault.files.has('我的/日记/2026-08-19.md')).toBe(false);
  });

  it('加密反查失败（磁盘无对应文件）：提示找不到原文条目，不入库', async () => {
    await openAndWait();
    const c = DiaryAppController.instance as any;
    const ghost = { date: '2026-01-01', time: '00:00', tags: ['日记'], emoji: '📖', content: '', filename: '2026-01-01', lineNumber: 9, kind: 'diary', media: [], text: '', segments: [] };
    await c.encryptEntryAction(ghost);
    expect(mocks.encryptEntry).not.toHaveBeenCalled();
    expect(getNoticeMessages().join('\n')).toContain('找不到原文条目');
  });

  it('影视条目菜单：无「加密」「删除」，改标签保留；动作兜底不触发解锁/删除', async () => {
    const c = await openAndWait();
    const items = document.querySelectorAll('.bz-diary-desk .bz-diary-item');
    // 列表按时间倒序：日记 23:02 在前，影视（文件创建时间 12:00）在后
    const movieItem = items[1] as HTMLElement;
    const menu = openMenu(movieItem);
    expect(menuButton(menu, '加密')).toBeNull();
    expect(menuButton(menu, '删除')).toBeNull();
    expect(menuButton(menu, '改标签')).toBeTruthy();
    // 兜底：直接调动作也不触发解锁/删除链路
    const movieEntry = (c as any)._wallEntries.find((e: any) => e.kind === 'movie');
    expect(movieEntry).toBeTruthy();
    await (c as any).encryptEntryAction(movieEntry);
    await (c as any).deleteEntryAction(movieEntry);
    expect(mocks.ensureSafeUnlocked).not.toHaveBeenCalled();
    expect(mocks.showConfirm).not.toHaveBeenCalled();
    expect(getNoticeMessages().join('\n')).toContain('对应面板');
  });

  it('底部抽屉同口径：影视条目抽屉无「加密/删除」，普通日记条目抽屉有', async () => {
    await openAndWait();
    // 长按开抽屉（2026-09-11 评审：单击入口取消，长按 = 唯一入口）；收尾复位 Platform 防泄漏
    Platform.isMobile = true;
    const press = async (el: HTMLElement) => {
      const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(ts, 'touches', { value: [{ clientX: 10, clientY: 10 }] });
      el.dispatchEvent(ts);
      await new Promise((r) => setTimeout(r, 550));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    };
    const mob = document.querySelector('.bz-diary-mob')!;
    // 影视条目（第 2 个）抽屉（2026-09-11 换核：core openItemSheet 挂 body，全局判定）
    await press(mob.querySelectorAll('.bz-diary-item')[1] as HTMLElement);
    const movieSheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(movieSheet).toBeTruthy();
    expect(movieSheet.textContent).not.toContain('加密');
    expect(movieSheet.textContent).not.toContain('删除');
    // 普通日记条目（第 1 个）抽屉
    await press(mob.querySelector('.bz-diary-item') as HTMLElement);
    const diarySheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(diarySheet).toBeTruthy();
    expect(diarySheet.textContent).toContain('加密');
    expect(diarySheet.textContent).toContain('删除');
    Platform.isMobile = false;
  });

  it('移动端：长按 + contextmenu 同发时只出抽屉，不出桌面跟手菜单（影院 mobile-3fix B 同款回归）', async () => {
    // 真机触屏长按的真实事件序列：touchstart →(~500ms)→ contextmenu（与 longPress 手势同到）。
    // contextmenu 委托不按端分流就弹桌面跟手菜单盖住抽屉（2026-09-11 真机复现）。
    Platform.isMobile = true;
    await openAndWait();
    const mob = document.querySelector('.bz-diary-mob')!;
    const item = mob.querySelector('.bz-diary-item') as HTMLElement;
    const r = item.getBoundingClientRect();
    const ts = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ts, 'touches', { value: [{ clientX: 10, clientY: 10 }] });
    item.dispatchEvent(ts);
    await new Promise((resolve) => setTimeout(resolve, 550));
    item.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    const ctx = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: r.left + 10,
      clientY: r.top + 10,
    });
    item.dispatchEvent(ctx);
    expect(ctx.defaultPrevented, '移动端条目 contextmenu 应被吞（让位给长按抽屉）').toBe(true);
    expect(document.querySelector('.bz-item-sheet'), '长按抽屉应在').toBeTruthy();
    expect(document.querySelector('.bz-item-menu'), '移动端不应出桌面跟手菜单').toBeNull();
    Platform.isMobile = false;
  });

  it('特殊条目「复制双链」：按文件路径本地拼双链，不走 entry-actions', async () => {
    await openAndWait();
    const items = document.querySelectorAll('.bz-diary-desk .bz-diary-item');
    const menu = openMenu(items[1] as HTMLElement);
    menuButton(menu, '复制双链')!.click();
    await waitFor(() => (navigator.clipboard.writeText as any).mock.calls.length > 0);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('[[我的/影视/film]]');
    expect(mocks.copyDiaryLink).not.toHaveBeenCalled();
  });
});
