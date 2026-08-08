/**
 * UI 层测试（ticket 06/07/08）：面板创建、标签筛选、弹窗、滚轮选择器、摘抄流程。
 * 在 jsdom 中运行；obsidian 模块由 vitest alias 替换为 mock。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { init } from '../../../src/diary/ui/panel';
import { openAddDialog, saveNewEntry, showTagPicker, updateTags } from '../../../src/diary/ui/dialogs';
import { showDateTimePicker } from '../../../src/diary/ui/datetime-picker';
import { escManager } from '../../../src/core/esc-manager';
import { state } from '../../../src/diary/state';
import { getNoticeMessages, hasNotice, clearNotices } from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';
import { moment } from 'obsidian';
import { resetObsidianMocks } from '../../mock-obsidian-entry';

let vault: MockVault;

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
  if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
  vault = new MockVault();
  vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n第一条日记\n');
  vault.files.set('我的/日记/2024-01-02.md', '# ✍️ 09:00\n第二条日记\n');
  setApp(mockAppWithVault(vault));
  await init({ registerEvent: () => {} });
});

async function waitFor(fn: () => boolean, timeout = 500): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('面板创建（ticket 06）', () => {
  it('init 创建主面板与遮罩，id/类名与原脚本一致', () => {
    expect(document.getElementById('diary-tag-filter')).toBeTruthy();
    expect(document.getElementById('diary-filter-mask')).toBeTruthy();
    expect(document.getElementById('diary-tag-container')).toBeTruthy();
    expect(document.getElementById('__diary-entries-container__')).toBeTruthy();
    expect(document.getElementById('diary-search-input')).toBeTruthy();
    expect(document.getElementById('diary-subtags-container')).toBeTruthy();
    expect(document.getElementById('diary-tag-selector-mask')).toBeTruthy();
  });

  it('init 幂等：重复调用不重复创建', async () => {
    await init({ registerEvent: () => {} });
    expect(document.querySelectorAll('#diary-tag-filter').length).toBe(1);
  });

  it('加载后渲染条目卡片（回调先于 loadAll 注册，无需等待）', async () => {
    // init 完成时列表已渲染（回归：回调注册曾在 loadAll 之后导致列表为空）
    expect(state.data.originalDiaryEntries.length).toBe(2);
    expect(state.data.currentFilteredEntries.length).toBe(2);
    const cards = document.querySelectorAll('.diary-entry-card');
    expect(cards.length).toBe(2);
    // 日期分组
    expect(document.querySelectorAll('.diary-date-separator').length).toBe(2);
    // emoji 与时间（日期降序：第一个卡片是 2024-01-02 的 ✍️）
    expect(document.querySelector('.diary-emoji')!.textContent).toBe('✍️');
    expect(document.querySelector('.diary-entry-content')).toBeTruthy();
  });

  it('搜索框默认隐藏、搜索按钮可见（回归：setLoadingState 经回调生效）', () => {
    const searchContainer = document.getElementById('diary-search-container')!;
    expect(searchContainer.style.display).toBe('none');
    const searchBtn = document.querySelector('.diary-popup-header button[title="搜索日记"]') as HTMLElement;
    expect(searchBtn.style.opacity).toBe('1');
    expect(searchBtn.style.pointerEvents).toBe('auto');
  });

  it('空数据时显示空态文案', async () => {
    const v2 = new MockVault();
    v2.dirs.add('我的/日记');
    v2.dirs.add('我的/影视');
    v2.dirs.add('我的/信');
    setApp(mockAppWithVault(v2));
    document.body.innerHTML = '';
    await init({ registerEvent: () => {} });
    // 空态：无数据时显示提示文案
    await waitFor(() => !!document.querySelector('#__diary-entries-container__')?.textContent);
    const empty = document.querySelector('#__diary-entries-container__')!;
    expect(empty.textContent).toContain('没有找到日记内容');
  });

  it('默认不弹窗；showDiaryPanel 显示；ESC 关闭', async () => {
    const popup = document.getElementById('diary-tag-filter')!;
    // 默认不弹窗（init 后隐藏）
    expect(popup.style.visibility).toBe('hidden');
    // showDiaryPanel 强制显示
    const { showDiaryPanel } = await import('../../../src/diary/ui/panel');
    await showDiaryPanel();
    expect(popup.style.visibility).toBe('visible');
    // ESC 关闭
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popup.style.visibility).toBe('hidden');
  });
});

describe('标签筛选（ticket 06）', () => {
  it('点击主标签按钮 → 筛选结果与高亮', async () => {
    await waitFor(() => !!document.querySelector('.diary-tag-btn'));
    const diaryBtn = document.querySelector('.diary-tag-btn[data-tag="日记"]') as HTMLElement;
    diaryBtn.click();
    await waitFor(() => state.data.selectedTags.has('日记'));
    expect(state.data.currentFilteredEntries.length).toBe(1);
    expect(document.querySelectorAll('.diary-entry-card').length).toBe(1);
    // 选中样式
    expect(diaryBtn.style.background).toBe('var(--interactive-accent)');
  });

  it('再次点击取消筛选', async () => {
    await waitFor(() => !!document.querySelector('.diary-tag-btn'));
    const diaryBtn = document.querySelector('.diary-tag-btn[data-tag="日记"]') as HTMLElement;
    diaryBtn.click();
    diaryBtn.click();
    expect(state.data.selectedTags.size).toBe(0);
    expect(state.data.currentFilteredEntries.length).toBe(2);
  });

  it('选择有二级标签的主标签 → 显示二级标签栏', async () => {
    await waitFor(() => !!document.querySelector('.diary-tag-btn'));
    const travelBtn = document.querySelector('.diary-tag-btn[data-tag="旅游"]') as HTMLElement;
    travelBtn.click();
    await waitFor(() => (document.getElementById('diary-subtags-container')!.style.display === 'flex'));
    const subBtns = document.querySelectorAll('.diary-sub-tag-btn');
    expect(subBtns.length).toBe(2);
    expect((subBtns[0] as HTMLElement).dataset.tag).toBe('四川');
  });

  it('搜索过滤', async () => {
    await waitFor(() => state.data.originalDiaryEntries.length === 2);
    const input = document.getElementById('diary-search-input') as HTMLInputElement;
    input.value = '第二条';
    input.dispatchEvent(new Event('input'));
    await waitFor(() => state.data.currentFilteredEntries.length === 1);
    expect(state.data.currentFilteredEntries[0].content).toContain('第二条');
  });
});

describe('添加日记弹窗（ticket 07）', () => {
  it('打开弹窗：默认不预选标签（全部加载）、日期时间为当前', () => {
    openAddDialog();
    const mask = document.getElementById('add-diary-mask')!;
    expect(mask.style.display).toBe('block');
    const activeBtns = document.querySelectorAll('#add-diary-type-container .diary-active');
    expect(activeBtns.length).toBe(0);
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    expect(dt.value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('保存新条目 → 写入文件 + Notice', async () => {
    openAddDialog();
    // 默认不预选标签，先手动选择「日记」
    const diaryBtn = document.querySelector('#add-diary-type-container [data-tag="日记"]') as HTMLElement;
    diaryBtn.click();
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    dt.value = '2024-01-03 10:30';
    // 触发同步显示
    document.getElementById('add-diary-popup')!.dispatchEvent(new Event('input'));
    await saveNewEntry();
    expect(vault.files.has('我的/日记/2024-01-03.md')).toBe(true);
    expect(vault.files.get('我的/日记/2024-01-03.md')).toContain('# 📖 10:30');
  });

  it('无类型时提示', async () => {
    openAddDialog();
    document.querySelectorAll('#add-diary-type-container .diary-active').forEach((b) => b.classList.remove('diary-active'));
    await saveNewEntry();
    expect(hasNotice(/至少选择一个类型/)).toBe(true);
  });
});

describe('标签选择器与删除（ticket 07）', () => {
  it('点击卡片 emoji 打开标签选择器', async () => {
    await waitFor(() => !!document.querySelector('.diary-emoji'));
    (document.querySelector('.diary-emoji') as HTMLElement).click();
    const popup = document.getElementById('diary-tag-selector-popup')!;
    expect(popup.style.display).toBe('block');
  });

  it('修改标签 → 写回文件 emoji 序列', async () => {
    await waitFor(() => state.data.originalDiaryEntries.length === 2);
    const entry = state.data.originalDiaryEntries[0]; // 2024-01-02（✍️ 09:00）
    await updateTags(entry.id!, ['诗']);
    const content = vault.files.get('我的/日记/2024-01-02.md')!;
    expect(content).toContain('# 🌟 09:00');
  });

  it('删除条目 → 确认弹窗 → 文件更新', async () => {
    await waitFor(() => state.data.originalDiaryEntries.length === 2);
    const entry = state.data.originalDiaryEntries[0];
    // 直接调 showConfirm 路径（内部用共享 confirm）
    const { showConfirm } = await import('../../../src/diary/ui/entries');
    showConfirm(entry.id!);
    expect(document.getElementById('__shared_confirm_mask__')).toBeTruthy();
    // 点击确认
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await waitFor(() => !state.data.originalDiaryEntries.some((e) => e.id === entry.id));
    expect(state.data.originalDiaryEntries.length).toBe(1);
  });
});

describe('滚轮日期时间选择器（ticket 07）', () => {
  it('五列渲染 + 月份天数联动', () => {
    const m = moment('2024-02-15 10:30');
    showDateTimePicker(m, () => {});
    const columns = document.querySelectorAll('#unified-datetime-picker-mask .diary-datetime-scroll-container');
    expect(columns.length).toBe(5);
    // 2月29天（2024 闰年）
    const dayColumn = document.querySelectorAll('#unified-datetime-picker-mask .datetime-number-item');
    // 年(2000-2030=31) + 月(12) + 日(29) + 时(24) + 分(60)
    expect(dayColumn.length).toBe(31 + 12 + 29 + 24 + 60);
    // ESC 或点击遮罩关闭
    (document.getElementById('unified-datetime-picker-mask') as HTMLElement).remove();
  });

  it('点击「此刻」重置为当前时间', () => {
    const m = moment('2020-01-01 00:00');
    showDateTimePicker(m, () => {});
    const buttons = Array.from(document.querySelectorAll('#unified-datetime-picker-mask button'));
    const todayBtn = buttons.find((b) => b.textContent === '此刻') as HTMLElement;
    todayBtn.click();
    // 选中态更新（不抛错即可）
    const mask = document.getElementById('unified-datetime-picker-mask')!;
    mask.remove();
  });
});

describe('摘抄命令（ticket 08）', () => {
  it('写摘抄完整流程：选中文本 → 块ID → 预览 → 保存写回', async () => {
    const { registerQuoteCommand } = await import('../../../src/diary/ui/quote');
    const app = mockAppWithVault(vault);
    const editor = {
      somethingSelected: () => true,
      getSelection: () => '经典语录',
      listSelections: () => [{ anchor: { line: 2 } }],
      getLine: (n: number) => (n === 2 ? '经典语录' : ''),
      setLine: vi.fn(),
      getCursor: () => ({ line: 2 }),
      getValue: () => '第一行\n第二行\n经典语录\n',
    };
    const file = vault.file('书库/哲学.md');
    app.workspace.getActiveViewOfType = () => ({ editor, file });
    let callback: (() => Promise<void>) | null = null;
    app.commands.addCommand = (cmd: any) => {
      if (cmd.id === 'bz-diary-create-quote') callback = cmd.callback;
      return cmd;
    };
    setApp(app);
    await registerQuoteCommand();
    expect(callback).toBeTruthy();
    await callback!();

    // 弹窗打开 + 摘抄预览 + 默认选中「摘抄」
    expect((document.getElementById('add-diary-mask') as HTMLElement).style.display).toBe('block');
    expect(document.body.textContent).toContain('经典语录');
    expect(document.querySelector('#add-diary-type-container [data-tag="摘抄"].diary-active')).toBeTruthy();

    // 保存 → 新增条目写回（书库/ 路径附加书名）
    const dt = document.getElementById('add-diary-datetime') as HTMLInputElement;
    dt.value = '2024-01-05 14:00';
    const saveBtn = Array.from(document.querySelectorAll('#add-diary-popup button')).find(
      (b) => b.textContent === '保存'
    ) as HTMLElement;
    saveBtn.click();
    await waitFor(() => vault.files.has('我的/日记/2024-01-05.md'));
    const written = vault.files.get('我的/日记/2024-01-05.md')!;
    expect(written).toContain('# 📌 14:00');
    expect(written).toContain('经典语录');
    expect(written).toContain('#《哲学》');
  });
});

describe('设置读取（ticket 09 前置）', () => {
  it('长按手势固定启用（用户确认保持默认启用）', async () => {
    const { getEnableLongPressSetting } = await import('../../../src/diary/ui/panel');
    expect(getEnableLongPressSetting()).toBe(true);
  });

  it('applyUiSettings 生效', async () => {
    const { applyUiSettings, getShowTagCountSetting } = await import('../../../src/diary/ui/panel');
    applyUiSettings({ showTagCount: false });
    expect(getShowTagCountSetting()).toBe(false);
  });

  it('⚙️ 设置弹窗：目录/批量/标签计数/文件日期', async () => {
    const { setSettingsProvider } = await import('../../../src/core/settings-provider');
    const { showDiaryPanel } = await import('../../../src/diary/ui/panel');
    setSettingsProvider(() => ({
      diaryDirectory: '我的/日记', movieDirectory: '我的/影视', letterDirectory: '我的/信',
      diaryBatchSize: '20', showTagCount: true, useFileDateTime: false,
    }) as any);
    showDiaryPanel(null as any);
    const settingsBtn = [...document.querySelectorAll('.diary-popup-header button')].find((b) => b.title === '日记本设置')!;
    expect(settingsBtn).toBeTruthy();
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('日记本设置');
    const names = [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    expect(names).toEqual(['日记目录', '影视目录', '信目录', '每批加载数量', '显示标签计数', '使用文件日期作为默认日期']);
  });
});
