/**
 * diary 域动作事件埋点测试（真实总线）：UI 确认回调 / store 结构事实 emit，
 * 用 onDomainEvent 订阅 spy 断言通道与载荷契约。本期埋点无消费者，仅验证派发本身。
 * 加密相关流程复用 tests/diary/encrypt.test.ts 的保险箱测试姿势（真实 PBKDF2，等待轮询）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { onDomainEvent } from '../../src/core/domain-bus';
import { setApp as setCoreApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp as setDiaryApp } from '../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import { init } from '../../src/diary/ui/panel';
import { openAddDialog, saveNewEntry, updateTags } from '../../src/diary/ui/dialogs';
import { showConfirm } from '../../src/diary/ui/entries';
import { deleteEntry, reloadWithEncrypted } from '../../src/diary/store';
import { state, setDiaryDataMap } from '../../src/diary/state';
import { encryptEntry, ENCRYPT_TAG } from '../../src/diary/encrypt';
import { getSafeManager, unloadEncrypt } from '../../src/encrypt';
import { EncryptAppController } from '../../src/encrypt/ui';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, Platform as MockPlatform } from '../mock-obsidian-entry';

/** 轮询等待（真实 PBKDF2 长异步） */
async function waitFor(cond: () => boolean, timeout = 8000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** 总线订阅 spy：记录该通道全部载荷；退订函数登记进 offs 统一清理 */
const offs: (() => void)[] = [];
function spyChannel(channel: string): { received: any[] } {
  const received: any[] = [];
  offs.push(onDomainEvent(channel, (evt) => received.push(evt)));
  return { received };
}

/** 长按卡片弹抽屉（移动端路径，与 encrypt.test 同款步骤） */
async function openSheet(card: HTMLElement): Promise<HTMLElement> {
  MockPlatform.isMobile = true;
  card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
  await new Promise((r) => setTimeout(r, 600)); // 真实长按 500ms 触发
  card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
  card.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 消费残余 click
  const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
  expect(sheet).not.toBeNull();
  return sheet;
}

function sheetItem(sheet: HTMLElement, label: string): HTMLElement {
  const item = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
    (b) => b.textContent!.includes(label)
  ) as HTMLElement;
  expect(item).toBeTruthy();
  return item;
}

let vault: MockVault;

beforeEach(async () => {
  document.body.innerHTML = '';
  clearNotices();
  resetObsidianMocks();
  resetTagsConfig();
  applyDirectories({});
  // 重置保险箱控制器单例：getSafeManager 惰性读设置（encryptRoot 默认 CONFIG/.ENCRYPT）
  unloadEncrypt();
  EncryptAppController.instance = null;
  setSettingsProvider(() => ({
    encryptRoot: 'CONFIG/.ENCRYPT',
    encryptPreviewEnabled: false,
    encryptSecurityMode: false,
    showTagCount: true,
  }) as any);
  state.data.selectedTags.clear();
  state.data.currentDateFilter = null;
  state.data.currentSearchKeyword = '';
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.data.isLoadingData = false;
  state.data.currentDisplayCount = 0;
  state.ui.isPopupShown = false;
  state.ui.editingEntryId = null;
  state.ui.entriesContainer = null;
  state.ui.scrollContainer = null;
  state.ui.tagFilterPopup = null;
  state.ui.maskLayer = null;
  state.events.isInternalUpdate = false;
  state.events.fileListenerAttached = false;
  setDiaryDataMap(null);
  if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
  vault = new MockVault();
  vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n第一条日记\n');
  vault.files.set('我的/日记/2024-01-02.md', '# ✍️ 09:00\n第二条日记\n');
  const app = mockAppWithVault(vault);
  setCoreApp(app as any);
  setDiaryApp(app as any);
  await init({ registerEvent: () => {} });
});

afterEach(() => {
  for (const off of offs.splice(0)) off(); // spy 全部退订，不向同文件后续用例泄漏
  unloadEncrypt();
  EncryptAppController.instance = null;
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
});

// ===== UI 动作埋点 =====

describe('动作事件埋点（UI 确认回调处）', () => {
  it('saveNewEntry 成功保存 → diary:entry-added {date,time,tags,content}', async () => {
    const added = spyChannel('diary:entry-added');
    openAddDialog();
    (document.querySelector('#add-diary-type-container [data-tag="日记"]') as HTMLElement).click();
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    dt.value = '2024-01-03 10:30';
    document.getElementById('add-diary-popup')!.dispatchEvent(new Event('input'));
    await saveNewEntry();

    expect(added.received).toHaveLength(1);
    expect(added.received[0]).toEqual({ date: '2024-01-03', time: '10:30', tags: ['日记'], content: '' });
    expect(vault.files.get('我的/日记/2024-01-03.md')).toContain('# 📖 10:30');
  });

  it('updateTags 写盘成功 → diary:tags-changed {entryId,date,time,from,to}', async () => {
    const changed = spyChannel('diary:tags-changed');
    const entry = state.data.originalDiaryEntries[0]; // 2024-01-02（✍️ 09:00）
    const oldTags = [...entry.tags];

    await updateTags(entry.id!, ['诗']);

    expect(changed.received).toHaveLength(1);
    expect(changed.received[0]).toEqual({
      entryId: entry.id,
      date: entry.date,
      time: entry.time,
      from: oldTags,
      to: ['诗'],
    });
    expect(vault.files.get('我的/日记/2024-01-02.md')).toContain('# 🌟 09:00');
  });

  it('showConfirm 普通分支确认 → diary:entry-deleted；该日期整文件清空时 store 另发 diary:file-vacated', async () => {
    const deleted = spyChannel('diary:entry-deleted');
    const vacated = spyChannel('diary:file-vacated');
    const target = state.data.originalDiaryEntries.find((e) => e.date === '2024-01-02')!;

    showConfirm(target.id!);
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await waitFor(() => deleted.received.length > 0 && vacated.received.length > 0);

    expect(deleted.received).toHaveLength(1);
    expect(deleted.received[0]).toEqual({ date: '2024-01-02', time: '09:00', wasEncrypted: false });
    expect(vacated.received).toHaveLength(1);
    expect(vacated.received[0]).toEqual({ date: '2024-01-02' });
    expect(vacated.received.some((p) => p.date === '2024-01-01')).toBe(false); // 未清空的日期不发
    expect(vault.files.has('我的/日记/2024-01-02.md')).toBe(false);
  });

  it('store 直调 deleteEntry 只发结构性事实：有 file-vacated、无 entry-deleted（意图类事件留在 UI）', async () => {
    const deleted = spyChannel('diary:entry-deleted');
    const vacated = spyChannel('diary:file-vacated');
    const target = state.data.originalDiaryEntries.find((e) => e.date === '2024-01-02')!;

    await deleteEntry(target.id!);

    expect(vacated.received).toHaveLength(1);
    expect(vacated.received[0]).toEqual({ date: '2024-01-02' });
    expect(deleted.received).toHaveLength(0);
  });
});

// ===== 加密相关埋点（ADR-0017 流程）=====

describe('动作事件埋点（加密流程）', () => {
  /** 直连解锁保险箱 */
  async function unlockSafe() {
    const sm = getSafeManager();
    await sm.unlock('pw');
    return sm;
  }

  /** 以 UI 同款步骤完成一条加密：encryptEntry + 摘除普通块 + 重并 */
  async function encryptViaSetup() {
    const sm = await unlockSafe();
    const entry = state.data.originalDiaryEntries[0];
    await encryptEntry(entry);
    if (entry.id) await deleteEntry(entry.id);
    await reloadWithEncrypted();
    await waitFor(() => state.data.originalDiaryEntries.some((e) => e.encrypted));
    return sm;
  }

  it('showConfirm 加密分支确认销毁密文 → diary:encrypted-purged {noteId}', async () => {
    const sm = await encryptViaSetup();
    const encEntry = state.data.originalDiaryEntries.find((e) => e.encrypted)!;
    const purged = spyChannel('diary:encrypted-purged');

    showConfirm(encEntry.id!);
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await waitFor(() => purged.received.length > 0 && sm.manifest.notes.length === 0);

    expect(purged.received).toHaveLength(1);
    expect(purged.received[0]).toEqual({ noteId: encEntry.noteId });
  });

  it('抽屉「加密」成功 → diary:entry-encrypted {entryId,date,time}', async () => {
    const sm = await unlockSafe();
    expect(state.data.originalDiaryEntries.length).toBe(2);
    const plain = state.data.originalDiaryEntries.find((e) => e.date === '2024-01-01')!;
    const encrypted = spyChannel('diary:entry-encrypted');

    const card = [...document.querySelectorAll('.diary-entry-card')].find(
      (c) => c.id === `diary-entry-${plain.id}`
    ) as HTMLElement;
    const sheet = await openSheet(card);
    sheetItem(sheet, '加密').click();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await waitFor(() => encrypted.received.length > 0);

    expect(encrypted.received).toHaveLength(1);
    expect(encrypted.received[0]).toEqual({ entryId: plain.id, date: '2024-01-01', time: '08:00' });
    // 结构性事实随行：单条文件整体删除 → file-vacated 由 store 发出
    expect(vault.files.has('我的/日记/2024-01-01.md')).toBe(false);
    await waitFor(() => sm.manifest.notes.length === 1);
  });

  it('抽屉「解密」成功 → diary:entry-decrypted {noteId,date,newTags}', async () => {
    const sm = await encryptViaSetup();
    const encEntry = state.data.originalDiaryEntries.find((e) => e.encrypted)!;
    const decrypted = spyChannel('diary:entry-decrypted');

    const card = document.getElementById(`diary-entry-${encEntry.id}`) as HTMLElement;
    const sheet = await openSheet(card);
    sheetItem(sheet, '解密').click();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await waitFor(() => decrypted.received.length > 0);

    expect(decrypted.received).toHaveLength(1);
    // 还原分类 = 原始标签去掉「加密」（encryptViaSetup 加密的是列表首条，日期/标签从条目本身取）
    const expectedTags = encEntry.tags.filter((t) => t !== ENCRYPT_TAG);
    expect(decrypted.received[0]).toEqual({ noteId: encEntry.noteId, date: encEntry.date, newTags: expectedTags });
    await waitFor(() => sm.manifest.notes.length === 0);
    expect(state.data.originalDiaryEntries.some((e) => e.encrypted)).toBe(false);
  });
});
