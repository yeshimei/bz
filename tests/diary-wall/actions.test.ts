/**
 * 回忆墙条目动作回归（P1 审查修复：id 断层三连）：
 * - 复制双链/加密/删除：普通日记条目按 filename+lineNumber 反查 diary 条目后走既有动作
 *   （wall 条目没有 id，传空 id 会静默失败甚至误删同刻日记）；
 * - 影视/信/书特殊条目：菜单与抽屉屏蔽「加密」「删除」（对齐 diary 面板 !special 语义）。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { applyDirectories as diaryApplyDirectories } from '../../src/diary/config';
import { applyDirectories as wallApplyDirectories } from '../../src/diary-wall/config';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { DiaryWallAppController } from '../../src/diary-wall/ui';
import { state as diaryState } from '../../src/diary/state';

const mocks = vi.hoisted(() => ({
  mediaSrc: vi.fn((_app: any, name: string) => `https://example.com/vault/${encodeURI(name)}`),
  openAddDialog: vi.fn(),
  jumpToEntry: vi.fn(),
  copyLink: vi.fn(async () => {}),
  showConfirm: vi.fn(),
  showTagPicker: vi.fn(),
  deleteEntry: vi.fn(async () => {}),
  loadAll: vi.fn(async () => {}),
  ensureSafeUnlocked: vi.fn(async () => true),
  openEncrypt: vi.fn(),
  isUnlocked: vi.fn(() => false),
  loadEncryptedEntries: vi.fn(async (): Promise<any[]> => []),
  deleteEncryptedEntry: vi.fn(async () => {}),
  encryptEntry: vi.fn(async (_e: any) => ({ encrypted: true })),
}));
vi.mock('../../src/diary-wall/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/diary-wall/data')>();
  return { ...actual, mediaSrc: mocks.mediaSrc };
});
vi.mock('../../src/diary/ui/dialogs', () => ({
  showDatePicker: vi.fn(),
  openAddDialog: mocks.openAddDialog,
  showTagPicker: mocks.showTagPicker,
}));
vi.mock('../../src/diary/ui/entries', () => ({
  jumpToEntry: mocks.jumpToEntry,
  copyLink: mocks.copyLink,
  showConfirm: mocks.showConfirm,
}));
vi.mock('../../src/diary/store', () => ({
  deleteEntry: mocks.deleteEntry,
  loadAll: mocks.loadAll,
}));
vi.mock('../../src/encrypt', () => ({
  ensureSafeUnlocked: mocks.ensureSafeUnlocked,
  openEncrypt: mocks.openEncrypt,
}));
vi.mock('../../src/diary/encrypt', () => ({
  isUnlocked: mocks.isUnlocked,
  loadEncryptedEntries: mocks.loadEncryptedEntries,
  deleteEncryptedEntry: mocks.deleteEncryptedEntry,
  encryptEntry: mocks.encryptEntry,
}));

/** diary state 里反查目标（与 wall 同源解析的普通日记条目：filename=dateStr，lineNumber=标题行号） */
const DIARY_ENTRY = {
  date: '2026-08-19',
  time: '23:02',
  timeValue: 2302,
  tags: ['日记'],
  emoji: '📖',
  content: '被猫盯着',
  filename: '2026-08-19',
  lineNumber: 1,
  id: 'diary-1',
};

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
  diaryApplyDirectories({});
  wallApplyDirectories({});
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
  (await import('../../src/diary/app')).setApp(app);
  // diary state 预置反查目标（wall 与 diary 同源解析，filename+lineNumber 一致）
  diaryState.data.originalDiaryEntries = [{ ...DIARY_ENTRY }];
});

afterEach(() => {
  DiaryWallAppController.instance?.cleanup();
  DiaryWallAppController.instance = null;
  diaryState.data.originalDiaryEntries = [];
  document.body.innerHTML = '';
});

async function openAndWait() {
  const c = DiaryWallAppController.getInstance({ mobileDefaultFullscreen: false });
  await c.openManager();
  await waitFor(() => !!document.querySelector('.bz-diary-wall-day-head'));
  return c;
}

function openMenu(item: HTMLElement): HTMLElement {
  item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 60 }));
  const menu = document.querySelector('.bz-diary-wall-menu') as HTMLElement;
  expect(menu).toBeTruthy();
  return menu;
}

function menuButton(menu: HTMLElement, label: string): HTMLElement | null {
  return Array.from(menu.querySelectorAll('button')).find((b) => b.textContent!.includes(label)) ?? null;
}

describe('回忆墙条目动作（P1 审查修复）', () => {
  it('普通日记条目「复制双链」：反查 diary 条目后走 copyLink（不再传空 id 静默失败）', async () => {
    await openAndWait();
    const item = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-item') as HTMLElement;
    const menu = openMenu(item);
    const btn = menuButton(menu, '复制双链')!;
    btn.click();
    await waitFor(() => mocks.copyLink.mock.calls.length > 0);
    expect(mocks.copyLink).toHaveBeenCalledWith('diary-1');
  });

  it('反查失败（diary 无数据且加载后仍无）：提示找不到原文，copyLink 不被调', async () => {
    diaryState.data.originalDiaryEntries = []; // 反查目标缺失，loadAll mock 不补
    await openAndWait();
    const item = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-item') as HTMLElement;
    const menu = openMenu(item);
    menuButton(menu, '复制双链')!.click();
    await waitFor(() => getNoticeMessages().some((m) => m.includes('找不到原文条目')));
    expect(mocks.copyLink).not.toHaveBeenCalled();
  });

  it('普通日记条目「删除」：反查后走 diary 确认（不再 showConfirm("")）', async () => {
    await openAndWait();
    const item = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-item') as HTMLElement;
    const menu = openMenu(item);
    menuButton(menu, '删除')!.click();
    await waitFor(() => mocks.showConfirm.mock.calls.length > 0);
    expect(mocks.showConfirm).toHaveBeenCalledWith('diary-1');
  });

  it('普通日记条目「加密」：反查条目入库并删除原块（原块不再残留）', async () => {
    await openAndWait();
    const item = document.querySelector('.bz-diary-wall-desk .bz-diary-wall-item') as HTMLElement;
    const menu = openMenu(item);
    menuButton(menu, '加密')!.click();
    await waitFor(() => mocks.deleteEntry.mock.calls.length > 0);
    expect(mocks.ensureSafeUnlocked).toHaveBeenCalled();
    // encryptEntry 收到反查出的 diary 条目（date/time/tags 可用于入库）
    expect(mocks.encryptEntry.mock.calls[0][0]).toMatchObject({ filename: '2026-08-19', lineNumber: 1 });
    expect(mocks.deleteEntry).toHaveBeenCalledWith('diary-1');
  });

  it('影视条目菜单：无「加密」「删除」，改标签保留；动作兜底不触发解锁/删除', async () => {
    const c = await openAndWait();
    const items = document.querySelectorAll('.bz-diary-wall-desk .bz-diary-wall-item');
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
    const mob = document.querySelector('.bz-diary-wall-mob')!;
    // 影视条目（第 2 个）抽屉
    (mob.querySelectorAll('.bz-diary-wall-item')[1] as HTMLElement).click();
    expect(mob.querySelector('.bz-diary-wall-sheet--show')).toBeTruthy();
    const movieActs = mob.querySelector('.bz-diary-wall-sheet-actions') as HTMLElement;
    expect(movieActs.textContent).not.toContain('加密');
    expect(movieActs.textContent).not.toContain('删除');
    // 普通日记条目（第 1 个）抽屉
    (mob.querySelector('.bz-diary-wall-item') as HTMLElement).click();
    const diaryActs = mob.querySelector('.bz-diary-wall-sheet-actions') as HTMLElement;
    expect(diaryActs.textContent).toContain('加密');
    expect(diaryActs.textContent).toContain('删除');
  });

  it('特殊条目「复制双链」：按文件路径本地拼双链，不依赖 diary state', async () => {
    await openAndWait();
    const items = document.querySelectorAll('.bz-diary-wall-desk .bz-diary-wall-item');
    const menu = openMenu(items[1] as HTMLElement);
    menuButton(menu, '复制双链')!.click();
    await waitFor(() => (navigator.clipboard.writeText as any).mock.calls.length > 0);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('[[我的/影视/film]]');
    expect(mocks.copyLink).not.toHaveBeenCalled();
  });
});
