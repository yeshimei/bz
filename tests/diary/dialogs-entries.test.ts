/**
 * dialogs 层审查修复回归（P2 批次）：
 * - updateTags 定位失败：告警并 return，不盲写旧数据；
 * - 插卡后 currentDisplayCount 前移：滚动加载下一批不重复渲染尾部条目
 *   （saveNewEntry 与 updateTags 插入分支两处）。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../src/diary/config';
import { setDiaryDataMap, state } from '../../src/diary/state';
import { applyUiSettings } from '../../src/diary/ui/ui-settings';
import { updateTags, createAddDialog, openAddDialog, saveNewEntry } from '../../src/diary/ui/dialogs';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import type { DiaryEntry } from '../../src/diary/types';

let vault: MockVault;

function makeVault(files: Record<string, string>) {
  vault = new MockVault();
  for (const [p, c] of Object.entries(files)) vault.files.set(p, c);
  setApp(mockAppWithVault(vault));
  return vault;
}

function mkEntry(over: Partial<DiaryEntry>): DiaryEntry {
  return {
    date: '2024-01-01',
    time: '08:00',
    timeValue: 800,
    tags: ['日记'],
    emoji: '📖',
    content: 'x',
    filename: '2024-01-01',
    lineNumber: 1,
    ...over,
  } as DiaryEntry;
}

/** 搭已渲染窗口：entriesContainer + scrollContainer + 两条已渲染条目 */
function setupRenderedWindow() {
  const entriesContainer = document.createElement('div');
  entriesContainer.id = '__diary-entries-container__';
  const scroll = document.createElement('div');
  scroll.className = 'diary-scroll-container';
  entriesContainer.appendChild(scroll);
  document.body.appendChild(entriesContainer);
  state.ui.entriesContainer = entriesContainer;
  state.ui.scrollContainer = scroll;
  state.data.currentDisplayCount = 2;
}

beforeEach(() => {
  document.body.innerHTML = '';
  clearNotices();
  resetTagsConfig();
  applyDirectories({});
  applyUiSettings({ diaryJumpToEditAfterSave: false });
  setDiaryDataMap(null);
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.data.selectedTags.clear();
  state.data.currentDateFilter = null;
  state.data.currentSearchKeyword = '';
  state.ui.entriesContainer = null as any;
  state.ui.scrollContainer = null as any;
  state.ui.singleSelectedTagForDisplay = null;
  state.events.isInternalUpdate = false;
  vi.restoreAllMocks();
});

describe('updateTags 定位失败告警（P2 审查修复）', () => {
  it('map 中无对应块：告警、不改内存标签、不落盘', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '# 📖 08:00\nx\n' });
    const entry = mkEntry({ id: 'e1' });
    state.data.originalDiaryEntries = [entry];
    // map 中该日期为空 → targetEntry 定位失败（同 time 也非唯一）
    setDiaryDataMap(new Map([['2024-01-01', []]]));
    await updateTags('e1', ['随笔']);
    const msgs = getNoticeMessages().join('\n');
    expect(msgs).toContain('未能');
    expect(msgs).toContain('标签没有修改');
    // 内存标签未被改（UI 与磁盘一致），文件未被重写
    expect(entry.tags).toEqual(['日记']);
    expect(vault.files.get('我的/日记/2024-01-01.md')).toBe('# 📖 08:00\nx\n');
  });
});

describe('插卡后 currentDisplayCount 前移（P2 审查修复）', () => {
  it('updateTags 插入分支：插卡后计数 +1', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '# 📖 08:00\nx\n' });
    const flat = mkEntry({ id: 'e1', tags: ['日记'] });
    const mapEntry = mkEntry({ id: 'map-e1', tags: ['日记'] });
    state.data.originalDiaryEntries = [flat];
    setDiaryDataMap(new Map([['2024-01-01', [mapEntry]]]));
    state.data.selectedTags = new Set(['随笔']);
    setupRenderedWindow();
    await updateTags('e1', ['随笔']);
    expect(state.data.currentDisplayCount).toBe(3);
    // 新卡片在 DOM 中（scrollContainer 内）
    expect(state.ui.scrollContainer!.querySelector('#diary-entry-e1')).toBeTruthy();
  });

  it('saveNewEntry：插卡后计数 +1，滚动下一批不重复渲染', async () => {
    makeVault({ '我的/日记/2024-01-01.md': '' });
    const past = mkEntry({ id: 'p1', date: '2023-12-31', time: '09:00', timeValue: 900, lineNumber: 0 });
    state.data.originalDiaryEntries = [past];
    state.data.currentFilteredEntries = [past];
    setDiaryDataMap(new Map([['2023-12-31', [past]]]));
    setupRenderedWindow();

    createAddDialog();
    openAddDialog();
    // 选一个类型
    const typeBtn = document.querySelector<HTMLElement>('#add-diary-type-container .diary-tag-selector-btn')!;
    expect(typeBtn).toBeTruthy();
    typeBtn.click();
    await saveNewEntry();

    expect(state.data.currentDisplayCount).toBe(3);
    // 新条目卡片已插入 DOM（窗口未预置旧卡 DOM，此处只应出现新卡这一张）
    const cards = state.ui.scrollContainer!.querySelectorAll('.diary-entry-card');
    expect(cards.length).toBe(1);
  });
});
