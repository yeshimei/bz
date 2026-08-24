/**
 * 覆盖率补测：dialogs 弹窗族。
 * 重点：日期筛选弹窗全流程（showDatePicker/renderDatePicker/年份导航/月份卡片/全部重置）、
 * 标签选择器保存/删除守卫、updateTags 筛选联动分支、saveNewEntry/openAddDialog 守卫、
 * 搜索命中分支与二级标签按钮角标。
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { setApp } from '../../../src/diary/app';
import { applyDirectories, resetTagsConfig, DIARY_DIRECTORY } from '../../../src/diary/config';
import { init } from '../../../src/diary/ui/panel';
import {
  createDatePicker,
  createTagPicker,
  createAddDialog,
  openAddDialog,
  saveNewEntry,
  showDatePicker,
  showTagPicker,
  updateTags,
} from '../../../src/diary/ui/dialogs';
import { state, setDiaryDataMap } from '../../../src/diary/state';
import { applyUiSettings } from '../../../src/diary/ui/ui-settings';
import { clearNotices, hasNotice, getNoticeMessages, resetObsidianMocks } from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';

let vault: MockVault;
let app: any;

beforeEach(async () => {
  document.body.innerHTML = '';
  resetTagsConfig();
  applyDirectories({});
  resetObsidianMocks();
  clearNotices();
  state.data.selectedTags.clear();
  state.data.currentDateFilter = null;
  state.data.currentSearchKeyword = '';
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.ui.isPopupShown = false;
  state.ui.editingEntryId = null;
  state.ui.singleSelectedTagForDisplay = null;
  if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
  setDiaryDataMap(null);
  vault = new MockVault();
  // 跨两年数据：驱动日期筛选弹窗的年份导航
  vault.files.set('我的/日记/2024-03-05.md', '# 📖 08:00\n三月内容\n');
  vault.files.set('我的/日记/2024-07-10.md', '# ✍️ 09:00\n七月内容\n');
  vault.files.set('我的/日记/2023-12-31.md', '# 🌙 22:00\n去年内容\n');
  app = mockAppWithVault(vault);
  setApp(app);
  await init({ registerEvent: () => {} });
});

/** 找日期筛选弹窗内的按钮（按文本） */
function popupButton(text: string): HTMLElement {
  const btn = [...document.querySelectorAll('#diary-date-filter-popup button')].find(
    (b) => b.textContent === text
  ) as HTMLElement;
  expect(btn, `弹窗内应有「${text}」按钮`).toBeTruthy();
  return btn;
}

/** 年份显示区 */
function yearDisplay(): HTMLElement {
  return document.querySelector('#date-filter-content .navbar-year') as HTMLElement
    ?? ([...document.querySelectorAll('#date-filter-content div')].find((d) => /^\d{4}$/.test(d.textContent ?? '')) as HTMLElement);
}

describe('日期筛选弹窗', () => {
  it('showDatePicker 渲染年份导航与月度计数（默认最新年份）', () => {
    showDatePicker();
    const mask = document.getElementById('diary-date-filter-mask')!;
    expect(mask.style.display).toBe('block');
    expect(yearDisplay().textContent).toBe('2024'); // 最新年在前
    const cards = document.querySelectorAll('.diary-date-filter-month-card');
    expect(cards.length).toBe(12);
    // 2024 年 3 月与 7 月各 1 篇
    expect(cards[2].textContent).toContain('3月');
    expect(cards[2].textContent).toContain('1篇');
    expect(cards[6].textContent).toContain('1篇');
    expect(cards[0].textContent).toContain('0篇');
  });

  it('‹ › 年份切换导航：到最旧年后 ‹ 不再前进；回最新年后 › 不再后退', () => {
    showDatePicker();
    popupButton('‹').click(); // 2024 → 2023
    expect(yearDisplay().textContent).toBe('2023');
    popupButton('‹').click(); // 已是最旧 → 无变化
    expect(yearDisplay().textContent).toBe('2023');
    popupButton('›').click(); // 2023 → 2024
    expect(yearDisplay().textContent).toBe('2024');
    popupButton('›').click(); // 已是最新 → 无变化
    expect(yearDisplay().textContent).toBe('2024');
  });

  it('点击年份应用年度筛选并关闭弹窗', () => {
    showDatePicker();
    yearDisplay().click();
    expect(state.data.currentDateFilter).toEqual({ year: '2024' });
    expect(state.data.currentFilteredEntries.every((e) => e.date.startsWith('2024'))).toBe(true);
    expect(document.getElementById('diary-date-filter-mask')!.style.display).toBe('none');
  });

  it('点击有数据的月份卡片应用月度筛选；点击遮罩自身关闭', () => {
    showDatePicker();
    const card7 = document.querySelectorAll('.diary-date-filter-month-card')[6] as HTMLElement;
    card7.click();
    expect(state.data.currentDateFilter).toEqual({ year: '2024', month: '07' });
    expect(state.data.currentFilteredEntries.length).toBe(1);
    expect(state.data.currentFilteredEntries[0].content).toContain('七月内容');
    expect(document.getElementById('diary-date-filter-mask')!.style.display).toBe('none');

    // 再次打开后点击遮罩空白处 → 关闭
    showDatePicker();
    const mask = document.getElementById('diary-date-filter-mask')!;
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mask.style.display).toBe('none');
  });

  it('无数据年份：月份卡片不可点 + 「该年份无日记记录」提示', () => {
    state.data.currentDateFilter = { year: '2099' };
    showDatePicker();
    const content = document.getElementById('date-filter-content')!;
    expect(content.textContent).toContain('该年份无日记记录');
    const card1 = document.querySelectorAll('.diary-date-filter-month-card')[0] as HTMLElement;
    expect(card1.style.opacity).toBe('0.5');
    expect(card1.style.cursor).toBe('not-allowed');
    expect(card1.onclick).toBeNull(); // 无数据月份不绑定点击
    card1.click();
    expect(state.data.currentDateFilter).toEqual({ year: '2099' }); // 筛选未变
  });

  it('空数据时显示「暂无日记数据」', () => {
    state.data.originalDiaryEntries = [];
    showDatePicker();
    expect(document.getElementById('date-filter-content')!.textContent).toContain('暂无日记数据');
  });

  it('「全部」按钮清除日期筛选并关闭弹窗', () => {
    state.data.currentDateFilter = { year: '2023' };
    showDatePicker();
    popupButton('全部').click();
    expect(state.data.currentDateFilter).toBeNull();
    expect(document.getElementById('diary-date-filter-mask')!.style.display).toBe('none');
  });

  it('内容元素缺失时 showDatePicker 直接返回', () => {
    document.getElementById('date-filter-content')!.remove();
    expect(() => showDatePicker()).not.toThrow();
    expect(document.getElementById('diary-date-filter-mask')!).toBeTruthy(); // 遮罩仍在（init 创建）
  });
});

describe('标签选择器守卫与保存', () => {
  it('未设置 entryId 时点保存直接隐藏弹窗（无通知）', () => {
    createTagPicker();
    (document.querySelector('.diary-save-btn') as HTMLElement).click();
    expect(document.getElementById('diary-tag-selector-mask')!.style.display).toBe('none');
    expect(document.getElementById('diary-tag-selector-popup')!.style.display).toBe('none');
    expect(getNoticeMessages().length).toBe(0);
  });

  it('未设置 entryId 时点删除不弹确认框', () => {
    createTagPicker();
    (document.querySelector('.diary-delete-btn') as HTMLElement).click();
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();
  });

  it('未选任何标签时点保存提示且弹窗保持打开', () => {
    const entry = state.data.originalDiaryEntries.find((e) => e.tags.includes('随笔'))!;
    createTagPicker();
    showTagPicker(entry.id!);
    // 取消所有已选按钮
    document.querySelectorAll('#diary-tag-selector-popup .diary-tag-selector-btn.diary-active')
      .forEach((b) => (b as HTMLElement).click());
    (document.querySelector('.diary-save-btn') as HTMLElement).click();
    expect(hasNotice('请至少选择一个标签')).toBe(true);
    expect(document.getElementById('diary-tag-selector-popup')!.style.display).toBe('block');
  });

  it('选择器不存在时 showTagPicker 直接返回', () => {
    const entry = state.data.originalDiaryEntries[0];
    // init 已创建选择器，先移除验证缺失守卫
    document.getElementById('diary-tag-selector-mask')?.remove();
    document.getElementById('diary-tag-selector-popup')?.remove();
    expect(() => showTagPicker(entry.id!)).not.toThrow();
    expect(document.getElementById('diary-tag-selector-popup')).toBeNull();
  });

  it('点击弹窗内部冒泡到遮罩不关闭（target 非 mask）', () => {
    createTagPicker();
    const popup = document.getElementById('diary-tag-selector-popup')!;
    popup.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(popup.isConnected).toBe(true);
  });

  it('普通条目改标签走 updateTags 写回（选择器保存路径）', async () => {
    const entry = state.data.originalDiaryEntries.find((e) => e.date === '2024-03-05')!;
    createTagPicker();
    showTagPicker(entry.id!);
    // 当前选中 日记，追加 书
    (document.querySelector('#diary-tag-selector-popup [data-tag="书"]') as HTMLElement).click();
    (document.querySelector('.diary-save-btn') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(vault.files.get('我的/日记/2024-03-05.md')).toContain('# 📖📕 08:00');
  });
});

describe('二级标签按钮样式（createTagOptionButton）', () => {
  it('写日记弹窗：二级标签带自身 emoji 与父标签角标', () => {
    openAddDialog();
    const btn = document.querySelector('#add-diary-type-container [data-tag="四川"]') as HTMLElement;
    expect(btn.textContent).toContain('🀄');
    expect(btn.innerHTML).toContain('✈️'); // 父标签「旅游」emoji 角标
  });

  it('标签选择器 diaryTagShowEmoji=false 时纯文字（无 emoji 与角标）；true 时显示', () => {
    const entry = state.data.originalDiaryEntries[0];
    createTagPicker();
    applyUiSettings({ diaryTagShowEmoji: false });
    showTagPicker(entry.id!);
    const btnOff = document.querySelector('#diary-tag-selector-popup [data-tag="四川"]') as HTMLElement;
    expect(btnOff.textContent!.includes('🀄')).toBe(false);
    expect(btnOff.innerHTML.includes('✈️')).toBe(false);

    applyUiSettings({ diaryTagShowEmoji: true });
    showTagPicker(entry.id!);
    const btnOn = document.querySelector('#diary-tag-selector-popup [data-tag="四川"]') as HTMLElement;
    expect(btnOn.textContent).toContain('🀄');
    expect(btnOn.innerHTML).toContain('✈️');
  });
});

describe('updateTags 筛选联动分支', () => {
  function findJuly() {
    return state.data.originalDiaryEntries.find((e) => e.date === '2024-07-10')!;
  }

  it('修改后不再匹配当前筛选 → 移除卡片并从筛选列表剔除', async () => {
    const entry = findJuly();
    // 清空面板渲染的真实卡片，保证手动卡片是该 id 的唯一元素
    document.getElementById('__diary-entries-container__')!.innerHTML = '';
    state.data.selectedTags.add('随笔'); // ✍️ 对应随笔
    state.data.currentFilteredEntries = [entry];
    const card = document.createElement('div');
    card.id = `diary-entry-${entry.id}`;
    document.body.appendChild(card);
    await updateTags(entry.id!, ['诗']);
    expect(document.getElementById(`diary-entry-${entry.id}`)).toBeNull(); // 卡片移除
    expect(state.data.currentFilteredEntries.length).toBe(0); // 列表剔除
    expect(vault.files.get('我的/日记/2024-07-10.md')).toContain('🌟');
  });

  it('修改后匹配当前筛选但不在列表 → 插入列表与 DOM', async () => {
    const entry = findJuly();
    entry.tags = ['随笔'];
    entry.emoji = '✍️';
    state.data.selectedTags.add('诗');
    state.data.currentFilteredEntries = [];
    const section = document.createElement('div');
    section.className = 'date-section';
    const sep = document.createElement('div');
    sep.className = 'diary-date-separator';
    sep.dataset.date = entry.date;
    section.appendChild(sep);
    state.ui.scrollContainer = section; // 独立容器，便于断言插入结果

    await updateTags(entry.id!, ['诗']);
    expect(state.data.currentFilteredEntries.some((e) => e.id === entry.id)).toBe(true);
    expect(section.querySelectorAll('.diary-entry-card').length).toBe(1);
  });

  it('单选标签显示态下更新 → 卡片只显示选中标签的 emoji', async () => {
    const entry = findJuly();
    // 清空面板渲染的真实卡片，避免同 id 元素干扰定位
    document.getElementById('__diary-entries-container__')!.innerHTML = '';
    state.ui.singleSelectedTagForDisplay = '书';
    const emoji = document.createElement('span');
    emoji.className = 'diary-emoji';
    const card = document.createElement('div');
    card.id = `diary-entry-${entry.id}`;
    card.appendChild(emoji);
    document.body.appendChild(card);
    state.ui.scrollContainer = null; // 跳过插入路径，聚焦 emoji 更新

    await updateTags(entry.id!, ['书', '诗']);
    expect(emoji.textContent).toBe('📕'); // 只显示选中「书」的 emoji
  });
});

describe('弹窗守卫与搜索命中分支', () => {
  it('add-diary 元素缺失时 openAddDialog/saveNewEntry 直接返回', async () => {
    createAddDialog(); // 显式确保 mask+popup 成对就位
    (document.getElementById('add-diary-mask') as HTMLElement).remove();
    expect(() => openAddDialog()).not.toThrow(); // mask 缺失 → 早退
    (document.getElementById('add-diary-popup') as HTMLElement | null)?.remove();
    await saveNewEntry(); // 输入元素随弹窗一并缺失 → 早退
  });

  it('createAddDialog 自带的类型按钮与保存按钮可用（未选类型提示）', async () => {
    createAddDialog();
    // 直接点击弹窗自带的保存按钮（非 openAddDialog 重建的）：未选类型 → 提示
    const saveBtn = [...document.querySelectorAll('#add-diary-popup button')]
      .find((b) => b.textContent === '保存') as HTMLElement;
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice(/至少选择一个类型|至少选择一个标签/)).toBe(true);
    // 弹窗自带类型按钮可切换选中态
    const diaryBtn = document.querySelector('#add-diary-type-container [data-tag="日记"]') as HTMLElement;
    diaryBtn.click();
    expect(diaryBtn.classList.contains('diary-active')).toBe(true);
  });

  it('搜索关键词命中时间 → 新条目插入当前列表', async () => {
    state.data.currentSearchKeyword = '09:00';
    openAddDialog();
    (document.querySelector('#add-diary-type-container [data-tag="日记"]') as HTMLElement).click();
    (document.getElementById('add-diary-datetime') as HTMLInputElement).value = '2024-02-01 09:00';
    await saveNewEntry();
    expect(state.data.currentFilteredEntries.some((e) => e.time === '09:00' && e.date === '2024-02-01')).toBe(true);
  });

  it('搜索关键词命中标签名 → 插入', async () => {
    state.data.currentSearchKeyword = '书';
    openAddDialog();
    (document.querySelector('#add-diary-type-container [data-tag="书"]') as HTMLElement).click();
    (document.getElementById('add-diary-datetime') as HTMLInputElement).value = '2024-02-02 08:00';
    await saveNewEntry();
    expect(state.data.currentFilteredEntries.some((e) => e.tags.includes('书'))).toBe(true);
  });

  it('搜索关键词命中日期 → 插入', async () => {
    state.data.currentSearchKeyword = '2024-02-14';
    openAddDialog();
    (document.querySelector('#add-diary-type-container [data-tag="日记"]') as HTMLElement).click();
    (document.getElementById('add-diary-datetime') as HTMLInputElement).value = '2024-02-14 10:00';
    await saveNewEntry();
    expect(state.data.currentFilteredEntries.some((e) => e.date === '2024-02-14')).toBe(true);
  });
});
