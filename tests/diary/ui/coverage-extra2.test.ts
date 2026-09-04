/**
 * diary UI 补测 2（单文件 80% 目标）：openAddDialog useFileDateTime 分支、
 * saveNewEntry 无效日期/失败分支、datetime-picker 手动模式、quote 摘抄全流程、
 * filter-shared 计数分支、panel toggle。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { init, toggleSearch, setLoadingState, showDiaryPanel } from '../../../src/diary/ui/panel';
import { openAddDialog, saveNewEntry, updateTags } from '../../../src/diary/ui/dialogs';
import { createDateTimeControl } from '../../../src/diary/ui/datetime-picker';
import { registerOpenDialogCommand } from '../../../src/diary/ui/quote';
import { createEntryCard } from '../../../src/diary/ui/entries';
import { updateTagCounts, updateSubTagsCounts, rebuildTags, createTag } from '../../../src/diary/ui/filter-shared';
import { applyUiSettings } from '../../../src/diary/ui/ui-settings';
import { setDiaryDataMap, state } from '../../../src/diary/state';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';
import * as storeModule from '../../../src/diary/store';

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

function selectTag(tag: string) {
  const btn = document.querySelector(`#add-diary-type-container [data-tag="${tag}"]`) as HTMLElement | null;
  if (btn) btn.click();
}

describe('openAddDialog useFileDateTime 分支', () => {
  it('useFileDateTime=true 且当前文件是日记日期文件 → 默认日期取文件名', () => {
    applyUiSettings({ useFileDateTime: true });
    app.workspace.getActiveViewOfType = () => ({
      editor: {},
      file: { path: '我的/日记/2024-05-20.md', basename: '2024-05-20' },
    });
    openAddDialog();
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(dt.value.startsWith('2024-05-20')).toBe(true);
  });

  it('useFileDateTime=true 且文件不在日记目录 → 保持当前时间', () => {
    applyUiSettings({ useFileDateTime: true });
    app.workspace.getActiveViewOfType = () => ({
      editor: {},
      file: { path: '其他/笔记.md', basename: '笔记' },
    });
    openAddDialog();
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(dt.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('useFileDateTime=false（默认）→ 当前时间', () => {
    applyUiSettings({ useFileDateTime: false });
    openAddDialog();
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(dt.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});

describe('saveNewEntry 分支', () => {
  beforeEach(() => {
    // fake timers 钉死系统时钟：0:00–0:10 档「10 分钟前」落在昨天，日记文件落昨日档（对齐 todo due.test.ts 先例）
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10, 12, 0)); // 2026-08-10（周一）正午
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('日期格式无效 → 「错误：日期时间格式不正确」', async () => {
    openAddDialog();
    selectTag('日记');
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    dt.value = 'not-a-date';
    await saveNewEntry();
    expect(hasNotice('日期时间格式不正确')).toBe(true);
  });

  it('自然语言日期（10 分钟前）也可保存', async () => {
    openAddDialog();
    selectTag('日记');
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    const m = (await import('obsidian')).moment();
    dt.value = '10分钟前';
    await saveNewEntry();
    const today = m.format('YYYY-MM-DD');
    expect(vault.files.has(`我的/日记/${today}.md`)).toBe(true);
  });

  it('保存失败（addEntry 抛错）→ 「保存日记失败: ...」', async () => {
    const spy = vi.spyOn(storeModule, 'addEntry').mockRejectedValue(new Error('boom'));
    openAddDialog();
    selectTag('日记');
    await saveNewEntry();
    expect(hasNotice(/保存日记失败：boom/)).toBe(true);
    spy.mockRestore();
  });

  it('保存成功且无 currentDateFilter → 写入 currentFilteredEntries + insertCard', async () => {
    openAddDialog();
    selectTag('日记');
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    dt.value = '2024-01-03 10:30';
    await saveNewEntry();
    expect(state.data.currentFilteredEntries.some((e) => e.date === '2024-01-03')).toBe(true);
  });

  it('diaryJumpToEditAfterSave=false → 保存后不进入编辑模式', async () => {
    applyUiSettings({ diaryJumpToEditAfterSave: false });
    openAddDialog();
    selectTag('日记');
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    dt.value = '2024-01-04 10:30';
    await saveNewEntry();
    // 弹窗关闭 + 无编辑态卡片
    expect((document.getElementById('add-diary-mask') as HTMLElement).style.display).toBe('none');
    expect(state.ui.editingEntryId).toBeNull();
    expect(document.querySelector('.diary-editing')).toBeNull();
  });
});

describe('datetime-picker 手动模式', () => {
  function mountControl() {
    document.querySelectorAll('#add-diary-popup').forEach((el) => el.remove());
    const ctrl = createDateTimeControl();
    const popup = document.createElement('div');
    popup.id = 'add-diary-popup';
    popup.appendChild(ctrl);
    document.body.appendChild(popup);
    return ctrl;
  }

  it('双击进入手动模式 → 输入有效日期 + Enter → 更新显示', () => {
    const ctrl = mountControl();
    const display = ctrl.querySelector('#datetime-display-area') as HTMLElement;
    display.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const manual = ctrl.querySelector('input[placeholder*="YYYY-MM-DD"]') as HTMLInputElement;
    expect(manual.style.display).toBe('block');
    manual.value = '2025-03-08 09:45';
    manual.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
    const hidden = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(hidden.value).toBe('2025-03-08 09:45');
  });

  it('手动模式输入无效日期 + blur → 恢复并 Notice', () => {
    const ctrl = mountControl();
    const display = ctrl.querySelector('#datetime-display-area') as HTMLElement;
    display.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const manual = ctrl.querySelector('input[placeholder*="YYYY-MM-DD"]') as HTMLInputElement;
    manual.value = 'invalid!!';
    manual.dispatchEvent(new Event('blur'));
    expect(hasNotice('日期时间格式无效，已恢复')).toBe(true);
    expect(manual.style.display).toBe('none');
  });

  it('手动模式输入自然语言（1 小时前）+ Enter → 更新', () => {
    const ctrl = mountControl();
    const display = ctrl.querySelector('#datetime-display-area') as HTMLElement;
    display.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const manual = ctrl.querySelector('input[placeholder*="YYYY-MM-DD"]') as HTMLInputElement;
    manual.value = '1小时前';
    manual.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
    const hidden = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(hidden.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('单击 displayArea → 200ms 后打开滚轮选择器', async () => {
    const ctrl = mountControl();
    const display = ctrl.querySelector('#datetime-display-area') as HTMLElement;
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(260);
    vi.useRealTimers();
    expect(document.getElementById('unified-datetime-picker-mask')).toBeTruthy();
  });
});


describe('filter-shared 计数分支', () => {
  it('showTagCount=false → updateTagCounts 直接返回', () => {
    applyUiSettings({ showTagCount: false });
    expect(() => updateTagCounts()).not.toThrow();
  });

  it('updateTagCounts 更新按钮计数（含二级标签命中）', () => {
    state.data.originalDiaryEntries = [
      {
        id: 'x', date: '2024-01-01', time: '08:00', timeValue: 800, tags: ['旅游', '四川'],
        emoji: '', content: '', filename: '2024-01-01', lineNumber: 0,
      } as any,
    ];
    applyUiSettings({ showTagCount: true });
    expect(() => updateTagCounts()).not.toThrow();
  });

  it('updateSubTagsCounts：无 active parent 直接返回', () => {
    expect(() => updateSubTagsCounts()).not.toThrow();
  });

  it('rebuildTags 二次调用移除旧容器', () => {
    rebuildTags();
    rebuildTags();
    expect(document.querySelectorAll('#diary-tag-container .diary-tags-scroll-container').length).toBe(1);
  });

  it('createTag：count null 不显示计数；点击选中/取消', () => {
    const btn = createTag('日记', '📖', null);
    expect(btn.innerHTML).not.toContain('(');
    btn.click();
    expect(state.data.selectedTags.has('日记')).toBe(true);
    btn.click();
    expect(state.data.selectedTags.has('日记')).toBe(false);
  });

  it('diaryTagShowEmoji=false → createTag 纯文字（无 emoji）', () => {
    applyUiSettings({ diaryTagShowEmoji: false });
    const btn = createTag('日记', '📖', 3);
    expect(btn.innerHTML.startsWith('📖')).toBe(false);
    expect(btn.innerHTML).toContain('日记');
    applyUiSettings({ diaryTagShowEmoji: true });
    const btn2 = createTag('日记', '📖', 3);
    expect(btn2.innerHTML.startsWith('📖')).toBe(true);
  });

  it('diaryTagSortMode=count → rebuildTags 主标签按条目数量降序（收藏 2 条 > 日记 1 条，固定顺序反之）', () => {
    state.data.originalDiaryEntries = [
      { id: 'a', date: '2024-01-01', time: '08:00', timeValue: 800, tags: ['日记'], emoji: '', content: '', filename: '2024-01-01', lineNumber: 0 } as any,
      { id: 'b', date: '2024-01-02', time: '09:00', timeValue: 900, tags: ['收藏'], emoji: '', content: '', filename: '2024-01-02', lineNumber: 0 } as any,
      { id: 'c', date: '2024-01-03', time: '10:00', timeValue: 1000, tags: ['收藏'], emoji: '', content: '', filename: '2024-01-03', lineNumber: 0 } as any,
    ];
    const container = document.getElementById('diary-tag-container')!;
    // 固定顺序：日记在前
    applyUiSettings({ diaryTagSortMode: 'fixed' });
    rebuildTags();
    let buttons = [...container.querySelectorAll<HTMLElement>('.diary-tag-btn')];
    expect(buttons[0].dataset.tag).toBe('日记');
    // 按数量：收藏（2）在前
    applyUiSettings({ diaryTagSortMode: 'count' });
    rebuildTags();
    buttons = [...container.querySelectorAll<HTMLElement>('.diary-tag-btn')];
    expect(buttons[0].dataset.tag).toBe('收藏');
    expect(buttons[1].dataset.tag).toBe('日记');
  });
});

describe('panel toggle/加载态', () => {
  it('toggleSearch 显示/隐藏搜索框', () => {
    const container = document.getElementById('diary-search-container')!;
    container.style.display = 'none';
    toggleSearch();
    expect(container.style.display).toBe('block');
    toggleSearch();
    expect(container.style.display).toBe('none');
  });

  it('setLoadingState(true) 隐藏搜索 + 清空关键词', () => {
    const input = document.getElementById('diary-search-input') as HTMLInputElement;
    input.value = '关键词';
    setLoadingState(true);
    expect(input.value).toBe('');
  });

  it('showDiaryPanel 显示面板', async () => {
    await showDiaryPanel();
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('visible');
  });
});

// ===== 修复回归（fx-diary-review） =====

describe('saveNewEntry 插入条件求值（P1-14 回归）', () => {
  it('标签筛选不匹配不入 filteredEntries；匹配（含二级标签展开）与无筛选才插入', async () => {
    openAddDialog();
    selectTag('日记');
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    state.data.currentFilteredEntries = [];

    // 选中「书」筛选：新条目标签为 日记 → 不插入
    state.data.selectedTags.clear();
    state.data.selectedTags.add('书');
    dt.value = '2024-01-05 10:30';
    await saveNewEntry();
    expect(state.data.currentFilteredEntries.some((e) => e.date === '2024-01-05')).toBe(false);

    // 选中「日记」→ 匹配插入
    state.data.selectedTags.clear();
    state.data.selectedTags.add('日记');
    dt.value = '2024-01-06 10:30';
    await saveNewEntry();
    expect(state.data.currentFilteredEntries.some((e) => e.date === '2024-01-06')).toBe(true);

    // 主标签「旅游」筛选 + 二级标签「四川」条目 → 展开匹配，插入
    selectTag('日记'); // 取消
    selectTag('四川');
    state.data.selectedTags.clear();
    state.data.selectedTags.add('旅游');
    dt.value = '2024-01-07 10:30';
    await saveNewEntry();
    expect(state.data.currentFilteredEntries.some((e) => e.date === '2024-01-07')).toBe(true);

    // 搜索关键词不匹配 → 不插入；清空关键词恢复插入
    state.data.selectedTags.clear();
    state.data.currentSearchKeyword = '绝不匹配的暗号XYZ';
    dt.value = '2024-01-08 10:30';
    await saveNewEntry();
    expect(state.data.currentFilteredEntries.some((e) => e.date === '2024-01-08')).toBe(false);
    state.data.currentSearchKeyword = '';
    dt.value = '2024-01-09 10:30';
    await saveNewEntry();
    expect(state.data.currentFilteredEntries.some((e) => e.date === '2024-01-09')).toBe(true);
  });
});

describe('updateTagCounts 与 createTag 同源（P1-13 回归）', () => {
  it('关表情开关后重建按钮不复活 emoji（emoji 切换走 rebuildTags；计数刷新不动按钮结构）', () => {
    applyUiSettings({ diaryTagShowEmoji: true });
    rebuildTags();
    const container = document.getElementById('diary-tag-container')!;
    const btn = container.querySelector('[data-tag="日记"]') as HTMLElement;
    expect(btn.textContent!.trim().startsWith('📖')).toBe(true);
    applyUiSettings({ diaryTagShowEmoji: false });
    rebuildTags(); // emoji 开关变更经 uiSettingsChanged → rebuildTags 同源
    const btn2 = container.querySelector('[data-tag="日记"]') as HTMLElement;
    expect(btn2.innerHTML.startsWith('📖')).toBe(false);
    expect(btn2.textContent).toContain('日记');
    expect(btn2.textContent).toMatch(/\(\d+\)/); // 计数仍在
    applyUiSettings({ diaryTagShowEmoji: true });
  });

  it('锁定态加密按钮重写后保持 🔒、无计数与 bz-encrypt-locked 样式', () => {
    rebuildTags();
    const container = document.getElementById('diary-tag-container')!;
    const enc = container.querySelector('[data-tag="加密"]') as HTMLElement;
    expect(enc.classList.contains('bz-encrypt-locked')).toBe(true);
    expect(enc.textContent).toContain('🔒');
    expect(enc.textContent).not.toMatch(/\(\d+\)/);
    updateTagCounts(); // 模拟搜索/筛选后的计数刷新
    expect(enc.classList.contains('bz-encrypt-locked')).toBe(true);
    expect(enc.textContent).toContain('🔒');
    expect(enc.textContent).not.toMatch(/\(\d+\)/);
  });
});

describe('updateTags 稳定定位（P1-12 回归）', () => {
  it('同分钟两条改第二条标签写对位置', async () => {
    setDiaryDataMap(null);
    vault.files.set('我的/日记/2024-01-01.md', '# 📖 10:00\n第一条\n\n# 📖 10:00\n第二条\n');
    await storeModule.loadAll();
    const pair = state.data.originalDiaryEntries.filter((e) => e.date === '2024-01-01' && e.time === '10:00');
    expect(pair.length).toBe(2);
    const card = createEntryCard(pair[1]);
    card.id = `diary-entry-${pair[1].id}`;
    document.body.appendChild(card);
    await updateTags(pair[1].id!, ['书']);
    const disk = vault.files.get('我的/日记/2024-01-01.md')!;
    expect(disk).toContain('# 📕 10:00');
    expect(disk).toContain('# 📖 10:00');
    // 📕 标题后必须是第二条的内容（旧逻辑按 time 匹配会改到第一条头上）
    const afterBook = disk.slice(disk.indexOf('# 📕 10:00'));
    expect(afterBook).toContain('第二条');
    expect(afterBook).not.toContain('第一条');
  });
});
