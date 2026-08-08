/**
 * diary UI 补测（覆盖率 85% 目标）：entries 卡片/长按/跳转/插入/编辑恢复、
 * dialogs 标签选择器/添加弹窗/更新标签、datetime-picker 控件同步、quote 命令空态。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { init } from '../../../src/diary/ui/panel';
import { createEntryCard, addLongPress, copyLink, jumpToEntry, cancelEdit, removeCard, insertCard, updateSticky, fixMobileSelect } from '../../../src/diary/ui/entries';
import { createTagPicker, showTagPicker, updateTags, createAddDialog, openAddDialog, createDatePicker } from '../../../src/diary/ui/dialogs';
import { createDateTimeControl, syncDateTime, showDateTimePicker } from '../../../src/diary/ui/datetime-picker';
import { registerQuoteCommand } from '../../../src/diary/ui/quote';
import { state } from '../../../src/diary/state';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';
import { moment } from 'obsidian';

let vault: MockVault;
let app: any;

beforeEach(async () => {
  document.body.innerHTML = '';
  resetTagsConfig();
  applyDirectories({});
  resetObsidianMocks();
  state.data.selectedTags.clear();
  state.data.currentDateFilter = null;
  state.data.currentSearchKeyword = '';
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.ui.isPopupShown = false;
  state.ui.editingEntryId = null;
  state.ui.singleSelectedTagForDisplay = null;
  state.ui.isTouchDevice = false;
  if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
  vault = new MockVault();
  vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n第一条日记\n');
  vault.files.set('我的/日记/2024-01-02.md', '# ✍️ 09:00\n第二条日记\n');
  app = mockAppWithVault(vault);
  setApp(app);
  await init({ registerEvent: () => {} });
});

/** 独立条目（id 唯一，避免与 init 渲染的面板卡片冲突） */
function soloEntry() {
  const e = state.data.originalDiaryEntries[0];
  return { ...e, id: 'test-1' };
}

describe('entries 补测', () => {
  it('createEntryCard：结构 + 单选标签显示分支', () => {
    const entry = soloEntry();
    const card = createEntryCard(entry);
    expect(card.className).toBe('diary-entry-card');
    expect(card.id).toBe('diary-entry-test-1');
    expect(card.querySelector('.diary-emoji')!.textContent).toBe(entry.emoji);
    expect(card.querySelector('.diary-entry-content')).toBeTruthy();
    // 多标签条目 + 单选显示：只显示选中标签 emoji
    const multi = { ...entry, id: 'test-2', tags: ['书', '电影'], emoji: '📕🎬' };
    state.ui.singleSelectedTagForDisplay = '书';
    const card2 = createEntryCard(multi);
    expect((card2.querySelector('.diary-emoji') as HTMLElement).textContent).toBe('📕');
    expect((card2.querySelector('.diary-emoji') as HTMLElement).textContent).not.toContain('🎬');
  });

  it('addLongPress：content 类型长按触发 copyLink（剪贴板 + Notice）', async () => {
    const entry = state.data.originalDiaryEntries[0];
    const el = document.createElement('div');
    document.body.appendChild(el);
    addLongPress(el, 'content', entry.id!);
    el.dispatchEvent(new MouseEvent('mousedown'));
    await new Promise((r) => setTimeout(r, 900)); // LONG_PRESS_DURATION=800
    el.dispatchEvent(new MouseEvent('mouseup'));
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice(/已复制双链引用/)).toBe(true);
  });

  it('addLongPress：emoji 类型长按打开标签选择器', async () => {
    const entry = state.data.originalDiaryEntries[0];
    createTagPicker();
    const el = document.createElement('div');
    document.body.appendChild(el);
    addLongPress(el, 'emoji', entry.id!);
    el.dispatchEvent(new MouseEvent('mousedown'));
    await new Promise((r) => setTimeout(r, 900));
    expect(document.getElementById('diary-tag-selector-popup')!.style.display).toBe('block');
  });

  it('copyLink：生成双链并写剪贴板', async () => {
    const entry = state.data.originalDiaryEntries[0];
    await copyLink(entry.id!);
    expect(hasNotice(/已复制双链引用/)).toBe(true);
  });

  it('jumpToEntry：日记文件存在时 openLinkText 并隐藏弹窗', async () => {
    const entry = soloEntry();
    const openSpy = vi.spyOn(app.workspace, 'openLinkText').mockResolvedValue(undefined);
    await jumpToEntry(entry);
    expect(openSpy).toHaveBeenCalled();
  });

  it('jumpToEntry：文件不存在 → 「找不到日记文件」', async () => {
    const entry = { ...soloEntry(), filename: '2099-12-31' };
    await jumpToEntry(entry);
    expect(hasNotice('找不到日记文件')).toBe(true);
  });

  it('jumpToEntry：影视条目找不到文件 → 「找不到影视文件」', async () => {
    const entry = { ...soloEntry(), id: 'movie-1', filename: '我的/影视/不存在.md' };
    await jumpToEntry(entry);
    expect(hasNotice('找不到影视文件')).toBe(true);
  });

  it('cancelEdit：无内容元素直接返回；有元素恢复 contentEditable', () => {
    cancelEdit('nope', null);
    expect(state.ui.editingEntryId).toBeNull();
    const entry = soloEntry();
    const card = createEntryCard(entry);
    document.body.appendChild(card);
    const content = card.querySelector('.diary-entry-content') as HTMLElement;
    content.contentEditable = 'true';
    content.innerHTML = '修改中';
    state.ui.editingEntryId = entry.id;
    cancelEdit(entry.id, '原始内容');
    expect(content.contentEditable).toBe('false');
    expect(content.innerHTML).toBe('原始内容');
    expect(state.ui.editingEntryId).toBeNull();
  });

  it('insertCard：新日期创建 date-section；已有日期按时间插入', () => {
    const container = document.createElement('div');
    state.ui.scrollContainer = container;
    const entry = soloEntry();
    insertCard(entry);
    expect(container.querySelectorAll('.date-section').length).toBe(1);
    expect(container.querySelector('.diary-date-separator')!.textContent).toBe(entry.date);
    // 同日期时间更大的插到前面
    const entry2 = { ...entry, id: 'test-2', time: '23:59', timeValue: 2359 };
    insertCard(entry2);
    expect(container.querySelectorAll('.diary-entry-card').length).toBe(2);
  });

  it('removeCard：移除卡片', () => {
    const entry = soloEntry();
    const card = createEntryCard(entry);
    document.body.appendChild(card);
    removeCard(entry.id);
    expect(document.getElementById('diary-entry-test-1')).toBeNull();
  });

  it('updateSticky：无容器直接返回；有分隔符设置 sticky', () => {
    updateSticky();
    const container = document.createElement('div');
    const sep = document.createElement('div');
    sep.className = 'diary-date-separator';
    container.appendChild(sep);
    state.ui.entriesContainer = container;
    state.ui.scrollContainer = container;
    updateSticky();
    expect(sep.style.position).toBe('sticky');
  });

  it('fixMobileSelect：非触屏设备不绑定监听', () => {
    const el = document.createElement('div');
    fixMobileSelect(el);
    expect(el.getAttribute('listener')).toBeNull();
    expect(el.onclick).toBeNull();
  });
});

describe('dialogs 补测', () => {
  it('createTagPicker：每次重建但 DOM 唯一', () => {
    createTagPicker();
    createTagPicker();
    expect(document.querySelectorAll('#diary-tag-selector-mask').length).toBe(1);
    expect(document.getElementById('diary-tag-selector-popup')).toBeTruthy();
  });

  it('showTagPicker：entry 不存在直接返回（弹窗保持隐藏）', () => {
    createTagPicker();
    showTagPicker('nope');
    expect(document.getElementById('diary-tag-selector-popup')!.style.display).not.toBe('block');
  });

  it('showTagPicker：生成标签按钮（选中态）', () => {
    createTagPicker();
    const entry = state.data.originalDiaryEntries[0];
    showTagPicker(entry.id!);
    const popup = document.getElementById('diary-tag-selector-popup')!;
    expect(popup.style.display).toBe('block');
    expect(popup.querySelectorAll('.diary-tag-selector-btn').length).toBeGreaterThan(0);
    expect(popup.querySelectorAll('.diary-tag-selector-btn.diary-active').length).toBeGreaterThan(0);
  });

  it('updateTags：entry 不存在/标签未变直接返回', async () => {
    await updateTags('nope', []);
    const entry = state.data.originalDiaryEntries[0];
    await updateTags(entry.id!, [...entry.tags]);
    expect(getNoticeMessages().length).toBe(0);
  });

  it('updateTags：修改标签写回文件 + 卡片 emoji 更新', async () => {
    const entry = state.data.originalDiaryEntries[0];
    createTagPicker();
    const card = createEntryCard(entry);
    card.id = `diary-entry-${entry.id}`;
    document.body.appendChild(card);
    await updateTags(entry.id!, ['书']);
    expect(entry.emoji).toBe('📕');
    expect((document.querySelector(`#diary-entry-${CSS.escape(entry.id)} .diary-emoji`) as HTMLElement).textContent).toBe('📕');
    expect(vault.files.get(`我的/日记/${entry.date}.md`)).toContain('📕');
  });

  it('createAddDialog：渲染添加弹窗 DOM + 打开显示', () => {
    createAddDialog();
    expect(document.getElementById('add-diary-mask')).toBeTruthy();
    expect(document.getElementById('add-diary-popup')).toBeTruthy();
    openAddDialog();
    expect(document.getElementById('add-diary-mask')!.style.display).toBe('block');
    expect(document.getElementById('add-diary-popup')!.style.display).toBe('block');
  });

  it('createDatePicker：渲染日期筛选弹窗结构', () => {
    createDatePicker();
    expect(document.getElementById('diary-date-filter-mask')).toBeTruthy();
    expect(document.getElementById('diary-date-filter-popup')).toBeTruthy();
    expect(document.getElementById('date-filter-content')).toBeTruthy();
  });
});

describe('datetime-picker 补测', () => {
  function mountControl() {
    // init 可能已创建同名弹窗，先移除保证 id 唯一
    document.querySelectorAll('#add-diary-popup').forEach((el) => el.remove());
    const ctrl = createDateTimeControl();
    const popup = document.createElement('div');
    popup.id = 'add-diary-popup';
    popup.appendChild(ctrl);
    document.body.appendChild(popup);
    return ctrl;
  }

  it('createDateTimeControl：结构 + 默认当前时间显示', () => {
    const ctrl = mountControl();
    expect(ctrl.querySelector('#datetime-display-area')).toBeTruthy();
    expect(ctrl.querySelectorAll('.dt-part').length).toBe(5);
    const hidden = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(hidden.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('syncDateTime：隐藏输入更新各段显示', () => {
    const ctrl = mountControl();
    const hidden = document.getElementById('add-diary-datetime') as HTMLInputElement;
    hidden.value = '2024-06-15 14:30';
    syncDateTime();
    const parts = ctrl.querySelectorAll('.dt-part');
    expect(parts[0].textContent).toBe('2024');
    expect(parts[1].textContent).toBe('06');
    expect(parts[2].textContent).toBe('15');
    expect(parts[3].textContent).toBe('14');
    expect(parts[4].textContent).toBe('30');
  });

  it('showDateTimePicker：打开滚轮选择器弹窗', () => {
    showDateTimePicker(moment('2024-06-15 14:30'), vi.fn());
    expect(document.getElementById('unified-datetime-picker-mask')).toBeTruthy();
  });
});

describe('quote 命令补测', () => {
  it('registerQuoteCommand：注册命令（无选中文本回调不抛错）', async () => {
    const addCommandSpy = vi.spyOn(app.commands, 'addCommand');
    await registerQuoteCommand();
    expect(addCommandSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bz-diary-create-quote' })
    );
  });
});
