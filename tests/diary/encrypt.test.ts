/**
 * 日记加密分类 UI 测试（ADR-0017）：
 * 筛选栏「加密」上锁态/解锁点击、改类型触发加密、加密条目改分类/删除、关面板即上锁。
 * 保险箱复用同一 SafeManager 单例（getSafeManager/ensureSafeUnlocked，读取设置 encryptRoot）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setApp as setCoreApp } from '../../src/core/app';
import { setApp as setDiaryApp } from '../../src/diary/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import { init, showDiaryPanel } from '../../src/diary/ui/panel';
import { openAddDialog, showTagPicker } from '../../src/diary/ui/dialogs';
import { state, setDiaryDataMap } from '../../src/diary/state';
import { ENCRYPT_TAG, isUnlocked, encryptEntry, lockSafe } from '../../src/diary/encrypt';
import { reloadWithEncrypted, deleteEntry } from '../../src/diary/store';
import { getSafeManager, unloadEncrypt } from '../../src/encrypt';
import { EncryptAppController } from '../../src/encrypt/ui';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, hasNotice } from '../mock-obsidian-entry';

/** 轮询等待（真实 PBKDF2 长异步） */
async function waitFor(cond: () => boolean, timeout = 8000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** 保险箱解锁弹窗（zIndex 10070、flex 布局，复用 encrypt 测试的查找方式） */
function findDialog(): HTMLElement | null {
  return [...document.querySelectorAll('div')].find(
    (d) => (d as HTMLElement).style.zIndex === '10070' && (d as HTMLElement).style.display === 'flex'
  ) as HTMLElement | null;
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
    encryptPreviewSize: 960,
    encryptPreviewQuality: 0.7,
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
  setDiaryDataMap(null); // 模块级映射重置，防跨测试污染
  if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
  vault = new MockVault();
  vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n第一条日记\n');
  const app = mockAppWithVault(vault);
  setCoreApp(app as any);
  setDiaryApp(app as any);
  await init({ registerEvent: () => {} });
});

afterEach(() => {
  unloadEncrypt();
  EncryptAppController.instance = null;
  document.body.innerHTML = '';
});

/** 直连解锁保险箱（与 UI 弹窗解锁同一实例） */
async function unlockSafe() {
  const sm = getSafeManager();
  await sm.unlock('pw');
  expect(isUnlocked()).toBe(true);
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

describe('筛选栏「加密」标签（ADR-0017）', () => {
  it('上锁态显示 🔒 无计数；点击弹主密码，解锁后恢复普通态', async () => {
    // 预置保险箱清单并上锁（非首设：输入主密码模式）
    const sm = getSafeManager();
    await sm.unlock('pw');
    sm.lock();
    expect(isUnlocked()).toBe(false);

    const btn = document.querySelector('.diary-tag-btn[data-tag="加密"]') as HTMLElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('🔒');
    expect(btn.textContent).not.toContain('('); // 上锁态无计数
    expect(btn.classList.contains('bz-encrypt-locked')).toBe(true);

    // 点击 → 弹主密码
    btn.click();
    await waitFor(() => !!findDialog());
    const dialog = findDialog()!;
    expect(dialog.textContent).toContain('输入主密码');
    const inputs = dialog.querySelectorAll('input[type="password"]');
    const confirmBtn = [...dialog.querySelectorAll('button')].find((b) => b.textContent === '确认')!;
    (inputs[0] as HTMLInputElement).value = 'pw';
    confirmBtn.click();

    // 解锁成功 → 标签被选中 + 恢复普通显示（🔐 emoji）
    await waitFor(() => isUnlocked());
    await waitFor(() => state.data.selectedTags.has('加密'));
    const btn2 = document.querySelector('.diary-tag-btn[data-tag="加密"]') as HTMLElement;
    expect(btn2.textContent).toContain('🔐');
    expect(btn2.classList.contains('bz-encrypt-locked')).toBe(false);
    expect(sm.unlocked).toBe(true);
  });

  it('解锁态「加密」标签显示计数（含加密条目）', async () => {
    await encryptViaSetup();
    // reloadWithEncrypted 后标签栏重建：加密计数 = 1
    await waitFor(() => {
      const b = document.querySelector('.diary-tag-btn[data-tag="加密"]') as HTMLElement;
      return !!b && b.textContent.includes('(1)');
    });
    const btn = document.querySelector('.diary-tag-btn[data-tag="加密"]') as HTMLElement;
    expect(btn.textContent).toContain('🔐');
    expect(btn.textContent).toContain('(1)');
  });

  it('写日记弹窗不提供「加密」分类（新建不建加密条目）', () => {
    openAddDialog();
    expect(document.querySelector('#add-diary-type-container [data-tag="加密"]')).toBeNull();
  });
});

describe('改类型触发加密（ADR-0017 Q20-a）', () => {
  it('非加密条目：类型选择器提供「加密」；选中保存 → 加密移入保险箱，md 块移除，列表出现加密条目', async () => {
    const sm = await unlockSafe();
    expect(state.data.originalDiaryEntries.length).toBe(1);

    // 打开类型选择器
    await waitFor(() => !!document.querySelector('.diary-emoji'));
    (document.querySelector('.diary-emoji') as HTMLElement).click();
    expect(document.getElementById('diary-tag-selector-popup')!.style.display).toBe('block');
    // 「加密」按钮出现
    const encBtn = document.querySelector('.diary-tag-selector-btn[data-tag="加密"]') as HTMLElement;
    expect(encBtn).toBeTruthy();
    encBtn.click();
    expect(encBtn.classList.contains('diary-active')).toBe(true);

    // 保存 → 二次确认
    (document.querySelector('.diary-save-btn') as HTMLElement).click();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('加密移出笔记');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();

    // 加密完成：清单 1 条 diary-entry
    await waitFor(() => sm.manifest.notes.length === 1);
    expect(sm.manifest.notes[0].kind).toBe('diary-entry');
    // md 块移除（单条文件整体删除）——deleteEntry 在异步 handler 内，须等待
    await waitFor(() => !vault.files.has('我的/日记/2024-01-01.md'));
    expect(vault.files.has('我的/日记/2024-01-01.md')).toBe(false);
    // 列表出现加密条目
    await waitFor(() => state.data.originalDiaryEntries.some((e) => e.encrypted));
    const encEntry = state.data.originalDiaryEntries.find((e) => e.encrypted)!;
    expect(encEntry.tags).toContain('加密');
    expect(encEntry.noteId).toBeTruthy();
    expect(encEntry.id!.startsWith('enc-diary-')).toBe(true);
    // 卡片 🔐 角标
    await waitFor(() => !!document.querySelector('.bz-encrypt-badge'));
  });

  it('保存时取消二次确认 → 不加密', async () => {
    const sm = await unlockSafe();
    await waitFor(() => !!document.querySelector('.diary-emoji'));
    (document.querySelector('.diary-emoji') as HTMLElement).click();
    const encBtn = document.querySelector('.diary-tag-selector-btn[data-tag="加密"]') as HTMLElement;
    encBtn.click();
    (document.querySelector('.diary-save-btn') as HTMLElement).click();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    // 无加密发生
    expect(sm.manifest.notes.length).toBe(0);
    expect(vault.files.has('我的/日记/2024-01-01.md')).toBe(true);
  });
});

describe('加密条目（ADR-0017）', () => {
  it('类型选择器无「加密」选项；改分类保存 → reclassifyEntry 还原回 md 并从保险箱移除', async () => {
    const sm = await encryptViaSetup();
    const encEntry = state.data.originalDiaryEntries.find((e) => e.encrypted)!;

    // 打开加密条目的类型选择器
    const card = document.getElementById(`diary-entry-${encEntry.id}`)!;
    (card.querySelector('.diary-emoji') as HTMLElement).click();
    const popup = document.getElementById('diary-tag-selector-popup')!;
    expect(popup.style.display).toBe('block');
    // 无「加密」按钮
    expect(popup.querySelector('.diary-tag-selector-btn[data-tag="加密"]')).toBeNull();
    // 原始分类（日记）默认选中
    const diaryBtn = popup.querySelector('.diary-tag-selector-btn[data-tag="日记"]') as HTMLElement;
    expect(diaryBtn.classList.contains('diary-active')).toBe(true);

    // 追加「诗」并保存 → 改分类确认
    (popup.querySelector('.diary-tag-selector-btn[data-tag="诗"]') as HTMLElement).click();
    (popup.querySelector('.diary-save-btn') as HTMLElement).click();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('恢复为普通类型');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();

    // 从保险箱移除 + 块 merge 回 md（新标题 emoji 序列 📖🌟）
    await waitFor(() => sm.manifest.notes.length === 0);
    await waitFor(() => vault.files.has('我的/日记/2024-01-01.md'));
    const md = vault.files.get('我的/日记/2024-01-01.md')!;
    expect(md).toContain('# 📖🌟 08:00');
    expect(md).toContain('第一条日记');
    // 列表不再含加密条目（reloadWithEncrypted 在异步 handler 内，须等待）
    await waitFor(() => !state.data.originalDiaryEntries.some((e) => e.encrypted));
    expect(state.data.originalDiaryEntries.some((e) => e.encrypted)).toBe(false);
  });

  it('加密条目删除 → 永久销毁密文', async () => {
    const sm = await encryptViaSetup();
    const encEntry = state.data.originalDiaryEntries.find((e) => e.encrypted)!;
    const card = document.getElementById(`diary-entry-${encEntry.id}`)!;
    (card.querySelector('.diary-emoji') as HTMLElement).click();
    (document.querySelector('.diary-delete-btn') as HTMLElement).click();
    await waitFor(() => !!document.getElementById('__shared_confirm_mask__'));
    expect(document.getElementById('__shared_confirm_mask__')!.textContent).toContain('永久销毁');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await waitFor(() => sm.manifest.notes.length === 0);
    // reloadWithEncrypted 在异步 handler 内，须等待列表更新
    await waitFor(() => !state.data.originalDiaryEntries.some((e) => e.encrypted));
    expect(state.data.originalDiaryEntries.some((e) => e.encrypted)).toBe(false);
    expect(hasNotice(/日记条目已删除/)).toBe(true);
  });

  it('双击加密卡片 → 只读预览弹窗（Markdown 渲染 + ✕ 关闭）', async () => {
    await encryptViaSetup();
    const encEntry = state.data.originalDiaryEntries.find((e) => e.encrypted)!;
    const content = document.querySelector(
      `.diary-entry-content[data-entry-id="${encEntry.id}"]`
    ) as HTMLElement;
    // 模拟双击（<300ms；用两次独立事件确保双击判定）
    const click = () => content.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    click();
    await new Promise((r) => setTimeout(r, 30));
    click();
    await waitFor(
      () => document.getElementById('bz-diary-encrypt-preview-popup')?.style.display === 'flex'
    );
    const popup = document.getElementById('bz-diary-encrypt-preview-popup')!;
    const title = popup.querySelector('h4') as HTMLElement;
    expect(title.textContent).toBe('2024-01-01 · 08:00 日记');
    expect(popup.textContent).toContain('第一条日记'); // MarkdownRenderer mock 渲染正文
    // ✕ 关闭
    (popup.querySelector('.bz-encrypt-btn') as HTMLElement).click();
    expect(document.getElementById('bz-diary-encrypt-preview-mask')!.style.display).toBe('none');
  });
});

describe('关面板即上锁（ADR-0017 固定行为）', () => {
  it('点击 ❌ 关闭面板 → lockSafe + 加密条目从列表消失；上锁后不可见', async () => {
    await encryptViaSetup();
    expect(isUnlocked()).toBe(true);
    expect(state.data.originalDiaryEntries.some((e) => e.encrypted)).toBe(true);

    const closeBtn = [...document.querySelectorAll('.diary-popup-header button')].find(
      (b) => (b as HTMLElement).title === '关闭'
    ) as HTMLElement;
    closeBtn.click();

    expect(isUnlocked()).toBe(false);
    expect(state.data.originalDiaryEntries.some((e) => e.encrypted)).toBe(false);
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('hidden');
    // 上锁后「加密」标签回到锁定态
    const btn = document.querySelector('.diary-tag-btn[data-tag="加密"]') as HTMLElement;
    expect(btn.textContent).toContain('🔒');
  });

  it('ESC 关闭面板同样上锁', async () => {
    await encryptViaSetup();
    expect(isUnlocked()).toBe(true);
    // 显示主面板（ESC 层 isVisible 依赖 mask visible）
    await showDiaryPanel({ registerEvent: () => {} });
    // 保险箱解锁弹窗已用完后可直接断言 ESC：主面板可见 → ESC 关闭 → 上锁
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(isUnlocked()).toBe(false);
    expect(state.data.originalDiaryEntries.some((e) => e.encrypted)).toBe(false);
  });
});