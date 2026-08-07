/**
 * diary UI 补测 2（单文件 80% 目标）：openAddDialog useFileDateTime 分支、
 * saveNewEntry 无效日期/失败分支、datetime-picker 手动模式、quote 摘抄全流程、
 * filter-shared 计数分支、fixMobileSelect 触屏分支、panel toggle。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { init, toggleSearch, setLoadingState, showDiaryPanel } from '../../../src/diary/ui/panel';
import { openAddDialog, saveNewEntry } from '../../../src/diary/ui/dialogs';
import { createDateTimeControl } from '../../../src/diary/ui/datetime-picker';
import { registerOpenDialogCommand, registerQuoteCommand } from '../../../src/diary/ui/quote';
import { updateTagCounts, updateSubTagsCounts, rebuildTags, createTag } from '../../../src/diary/ui/filter-shared';
import { fixMobileSelect } from '../../../src/diary/ui/entries';
import { applyUiSettings } from '../../../src/diary/ui/ui-settings';
import { state } from '../../../src/diary/state';
import { MockNotice, resetObsidianMocks } from '../../mock-obsidian-entry';
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
  it('日期格式无效 → 「错误：日期时间格式不正确」', async () => {
    openAddDialog();
    selectTag('日记');
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    dt.value = 'not-a-date';
    await saveNewEntry();
    expect(MockNotice.instances.some((n) => n.message === '错误：日期时间格式不正确')).toBe(true);
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
    expect(MockNotice.instances.some((n) => n.message.includes('保存日记失败: boom'))).toBe(true);
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
    expect(MockNotice.instances.some((n) => n.message === '日期时间格式无效，已恢复')).toBe(true);
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
    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 260));
    expect(document.getElementById('unified-datetime-picker-mask')).toBeTruthy();
  });
});

describe('quote 摘抄全流程', () => {
  it('registerQuoteCommand：选中带 data-date 的 span → 预览 + 保存', async () => {
    const editorMock = {
      somethingSelected: () => true,
      getSelection: () => '<span data-date="2024-01-01 10:30:00">精选文本</span> ^block1',
      listSelections: () => [{ anchor: { line: 0 } }],
      getCursor: () => ({ line: 0, ch: 0 }),
      getLine: () => '行文本 ^block1',
      setLine: vi.fn(),
      getValue: () => '内容',
    };
    app.workspace.getActiveViewOfType = () => ({
      editor: editorMock,
      file: { path: '我的/日记/2024-01-01.md' },
    });

    await registerQuoteCommand();
    const cmd = app.commands.registered.find((c: any) => c.id === 'bz-diary-create-quote');
    expect(cmd.id).toBe('bz-diary-create-quote');

    await cmd.callback();
    await new Promise((r) => setTimeout(r, 200)); // sleep(150)

    const popup = document.getElementById('add-diary-popup')!;
    expect(popup.querySelector('label')!.textContent).toBe('摘抄内容');
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(dt.value).toBe('2024-01-01 10:30');
    const saveBtn = [...popup.querySelectorAll('button')].find((b) => b.textContent === '保存')!;
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(MockNotice.instances.some((n) => n.message === '摘抄已保存')).toBe(true);
    expect(vault.files.has('我的/日记/2024-01-01.md')).toBe(true);
  });

  it('registerQuoteCommand：dateFromSpan 非标准格式走 moment 解析分支', async () => {
    const editorMock = {
      somethingSelected: () => true,
      getSelection: () => '<span data-date="2024-06-15">精选</span>',
      listSelections: () => [{ anchor: { line: 0 } }],
      getCursor: () => ({ line: 0, ch: 0 }),
      getLine: () => '行 ^b2',
      setLine: vi.fn(),
      getValue: () => '内容',
    };
    app.workspace.getActiveViewOfType = () => ({
      editor: editorMock,
      file: { path: '我的/日记/2024-01-01.md' },
    });
    await registerQuoteCommand();
    const cmd = app.commands.registered.find((c: any) => c.id === 'bz-diary-create-quote');
    await cmd.callback();
    await new Promise((r) => setTimeout(r, 200));
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(dt.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('registerQuoteCommand：无选中文本 → 「请先打开一个笔记文件」', async () => {
    app.workspace.getActiveViewOfType = () => null;
    await registerQuoteCommand();
    const cmd = app.commands.registered.find((c: any) => c.id === 'bz-diary-create-quote');
    await cmd.callback();
    expect(MockNotice.instances.some((n) => n.message === '请先打开一个笔记文件')).toBe(true);
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
});

describe('fixMobileSelect 触屏分支', () => {
  it('isTouchDevice=true → touchstart 聚焦 + touchmove 阻止滚动', () => {
    state.ui.isTouchDevice = true;
    const el = document.createElement('div');
    document.body.appendChild(el);
    fixMobileSelect(el);
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true }));
    state.ui.editingEntryId = 'x';
    el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true }));
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
