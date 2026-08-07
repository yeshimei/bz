/**
 * 弹窗族：添加日记、标签选择器、日期筛选（原脚本 949-1130 + 2243-2430 + 3238-3478）。
 */
import { MarkdownView as MarkdownViewFromObsidian, Notice, moment } from 'obsidian';
import { getApp } from '../app';
import { DIARY_DIRECTORY, getAllAvailableTags, getSortedTagsForAddDialog, getTagEmoji, getParentPrimaryTag, isSubTag } from '../config';
import { parseNaturalTime } from '../parser';
import { addEntry, writeFile } from '../store';
import { diaryDataMap, state } from '../state';
import { getDefaultTagSetting, getUseFileDateTimeSetting } from './ui-settings';
import { rebuildTags } from './filter-shared';
import { applyFilter as applyFilterFromDialogs, insertCard, jumpToEntry, removeCard, showConfirm as showConfirmFromDialogs } from './entries';
import { updateTitleSuffix } from './filter-shared';
import { createDateTimeControl, syncDateTime } from './datetime-picker';

// ===== 日期筛选弹窗（原 949-1129） =====

export function createDatePicker() {
  const existingMask = document.getElementById('diary-date-filter-mask');
  const existingPopup = document.getElementById('diary-date-filter-popup');
  if (existingMask) existingMask.remove();
  if (existingPopup) existingPopup.remove();

  const mask = document.createElement('div');
  mask.id = 'diary-date-filter-mask';
  mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);z-index:10003;display:none;';
  mask.onclick = (e) => {
    if (e.target === mask) mask.style.display = 'none';
  };

  const popup = document.createElement('div');
  popup.id = 'diary-date-filter-popup';
  popup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:10004;width:90%;max-width:480px;display:flex;flex-direction:column;overflow:hidden;';

  const header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px;border-bottom:1px solid var(--background-modifier-border);display:flex;justify-content:space-between;align-items:center;';

  const headerTitle = document.createElement('h4');
  headerTitle.textContent = '按日期筛选';
  headerTitle.style.cssText = 'margin:0;font-size:16px;font-weight:600;color:var(--text-normal);';

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '全部';
  resetBtn.style.cssText = 'background:var(--background-secondary);border:none;border-radius:20px;padding:4px 12px;font-size:13px;cursor:pointer;color:var(--text-normal);';
  resetBtn.onclick = () => {
    state.data.currentDateFilter = null;
    applyFilterFromDialogs();
    mask.style.display = 'none';
  };

  header.appendChild(headerTitle);
  header.appendChild(resetBtn);

  const content = document.createElement('div');
  content.id = 'date-filter-content';
  content.style.cssText = 'flex:1;overflow-y:auto;padding:20px;';

  popup.appendChild(header);
  popup.appendChild(content);
  mask.appendChild(popup);
  document.body.appendChild(mask);
}

/** 获取所有存在的年份 */
function getYears(): string[] {
  const years = new Set<string>();
  state.data.originalDiaryEntries.forEach((entry) => {
    const year = entry.date.split('-')[0];
    years.add(year);
  });
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

/** 显示日期选择器 */
export function showDatePicker() {
  const mask = document.getElementById('diary-date-filter-mask');
  const content = document.getElementById('date-filter-content');
  if (!mask || !content) return;

  const years = getYears();
  let selectedYear: string | null = years.length ? years[0] : null;

  if (state.data.currentDateFilter) {
    if (state.data.currentDateFilter.month) {
      selectedYear = state.data.currentDateFilter.year;
    } else if (state.data.currentDateFilter.year) {
      selectedYear = state.data.currentDateFilter.year;
    }
  }

  renderDatePicker(content, years, selectedYear);
  mask.style.display = 'block';
}

/** 渲染日期选择器内容 */
function renderDatePicker(container: HTMLElement, years: string[], currentYear: string | null) {
  container.innerHTML = '';
  if (!years.length) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = '暂无日记数据';
    emptyMsg.style.cssText = 'text-align:center;padding:40px;color:var(--text-muted);';
    container.appendChild(emptyMsg);
    return;
  }

  const navBar = document.createElement('div');
  navBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;background:var(--background-secondary);border-radius:40px;padding:4px;';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '‹';
  prevBtn.style.cssText = 'width:36px;height:36px;border-radius:50%;border:none;background:var(--background-primary);cursor:pointer;font-size:20px;color:var(--text-normal);display:flex;align-items:center;justify-content:center;';
  prevBtn.onclick = () => {
    const idx = years.indexOf(currentYear!);
    if (idx < years.length - 1) {
      renderDatePicker(container, years, years[idx + 1]);
    }
  };

  const yearDisplay = document.createElement('div');
  yearDisplay.textContent = currentYear!;
  yearDisplay.style.cssText = 'font-weight:600;font-size:18px;color:var(--text-normal);padding:0 12px;cursor:pointer;';
  yearDisplay.onclick = () => {
    state.data.currentDateFilter = { year: currentYear! };
    applyFilterFromDialogs();
    document.getElementById('diary-date-filter-mask')!.style.display = 'none';
  };

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '›';
  nextBtn.style.cssText = 'width:36px;height:36px;border-radius:50%;border:none;background:var(--background-primary);cursor:pointer;font-size:20px;color:var(--text-normal);display:flex;align-items:center;justify-content:center;';
  nextBtn.onclick = () => {
    const idx = years.indexOf(currentYear!);
    if (idx > 0) {
      renderDatePicker(container, years, years[idx - 1]);
    }
  };

  navBar.appendChild(prevBtn);
  navBar.appendChild(yearDisplay);
  navBar.appendChild(nextBtn);
  container.appendChild(navBar);

  const monthStats = new Map<string, number>();
  state.data.originalDiaryEntries.forEach((entry) => {
    const [year, month] = entry.date.split('-');
    if (year === currentYear) {
      monthStats.set(month, (monthStats.get(month) || 0) + 1);
    }
  });

  const monthGrid = document.createElement('div');
  monthGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;';

  for (let i = 1; i <= 12; i++) {
    const monthStr = i.toString().padStart(2, '0');
    const count = monthStats.get(monthStr) || 0;
    const monthCard = document.createElement('div');
    monthCard.className = 'diary-date-filter-month-card';
    monthCard.style.cssText = 'background:var(--background-secondary);border-radius:12px;padding:12px 8px;text-align:center;cursor:pointer;transition:all 0.2s;border:1px solid transparent;';
    if (count === 0) {
      monthCard.style.opacity = '0.5';
      monthCard.style.cursor = 'not-allowed';
    } else {
      monthCard.onclick = () => {
        state.data.currentDateFilter = { year: currentYear!, month: monthStr };
        applyFilterFromDialogs();
        document.getElementById('diary-date-filter-mask')!.style.display = 'none';
      };
      monthCard.onmouseenter = () => {
        if (count > 0) monthCard.style.background = 'var(--background-modifier-hover)';
      };
      monthCard.onmouseleave = () => {
        monthCard.style.background = 'var(--background-secondary)';
      };
    }

    const monthName = document.createElement('div');
    monthName.textContent = `${i}月`;
    monthName.style.cssText = 'font-size:15px;font-weight:500;color:var(--text-normal);margin-bottom:4px;';

    const countSpan = document.createElement('div');
    countSpan.textContent = `${count}篇`;
    countSpan.style.cssText = 'font-size:12px;color:var(--text-muted);';

    monthCard.appendChild(monthName);
    monthCard.appendChild(countSpan);
    monthGrid.appendChild(monthCard);
  }

  container.appendChild(monthGrid);

  if (monthStats.size === 0) {
    const noDataMsg = document.createElement('div');
    noDataMsg.textContent = '该年份无日记记录';
    noDataMsg.style.cssText = 'text-align:center;padding:20px;color:var(--text-muted);margin-top:16px;';
    container.appendChild(noDataMsg);
  }
}

// ===== 标签选择器（原 2243-2430） =====

export function createTagPicker() {
  const existingPopup = document.getElementById('diary-tag-selector-popup');
  const existingMask = document.getElementById('diary-tag-selector-mask');
  if (existingPopup) existingPopup.remove();
  if (existingMask) existingMask.remove();

  const mask = document.createElement('div');
  mask.id = 'diary-tag-selector-mask';
  mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:9999;display:none;';
  mask.onclick = (e) => e.target === mask && (mask.style.display = 'none');

  const popup = document.createElement('div');
  popup.id = 'diary-tag-selector-popup';
  popup.className = 'diary-tag-selector-popup';
  popup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:10000;padding:20px;max-width:300px;width:90%;max-height:80vh;overflow-y:auto;display:none;';

  const title = document.createElement('h4');
  title.className = 'diary-tag-selector-title';
  title.textContent = '选择类型';

  // 按钮容器 - 动态生成内容，不在初始化时填充
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'diary-tag-selector-buttons';

  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'diary-tag-selector-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'diary-action-btn diary-delete-btn';
  deleteBtn.textContent = '删除';
  deleteBtn.style.cssText = 'background:var(--background-modifier-error);color:var(--background-primary);margin-right:auto;';
  deleteBtn.onclick = () => {
    const entryId = popup.dataset.entryId;
    if (entryId) showConfirmFromDialogs(entryId);
  };

  const saveBtn = document.createElement('button');
  saveBtn.className = 'diary-action-btn diary-save-btn';
  saveBtn.textContent = '保存';
  saveBtn.onclick = () => {
    const selTagNames: string[] = [];
    buttonsContainer.querySelectorAll('.diary-tag-selector-btn.diary-active').forEach((btn) => {
      selTagNames.push((btn as HTMLElement).dataset.tag!);
    });
    const entryId = popup.dataset.entryId;
    if (selTagNames.length === 0) {
      new Notice('请至少选择一个标签');
      return;
    }
    if (entryId) updateTags(entryId, selTagNames);
    mask.style.display = 'none';
    popup.style.display = 'none';
  };

  actionsContainer.appendChild(deleteBtn);
  actionsContainer.appendChild(saveBtn);
  popup.appendChild(title);
  popup.appendChild(buttonsContainer);
  popup.appendChild(actionsContainer);
  mask.appendChild(popup);
  document.body.appendChild(mask);
}

export function showTagPicker(entryId: string) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) return;
  const mask = document.getElementById('diary-tag-selector-mask');
  const popup = document.getElementById('diary-tag-selector-popup');
  if (!mask || !popup) return;
  popup.dataset.entryId = entryId;

  const buttonsContainer = popup.querySelector('.diary-tag-selector-buttons');
  if (!buttonsContainer) return;

  // 清空并重新生成按钮
  buttonsContainer.innerHTML = '';

  // 获取排序后的标签列表（隐藏有二级标签的主标签）
  const sortedTags = getSortedTagsForAddDialog();

  // 当前条目的标签集合
  const currentTagsSet = new Set(entry.tags);

  // 生成按钮
  for (const tag of sortedTags) {
    const button = document.createElement('button');
    button.className = 'diary-tag-selector-btn';
    button.dataset.tag = tag;
    const emoji = getTagEmoji(tag);

    let buttonText = `${emoji} ${tag}`;
    if (isSubTag(tag)) {
      const parentTag = getParentPrimaryTag(tag);
      if (parentTag) {
        const parentEmoji = getTagEmoji(parentTag);
        buttonText += ` <span style="font-size: 12px;margin-left:4px;position: absolute;top: 0;right: 0;translate: 5px -5px;">${parentEmoji}</span>`;
      }
    }
    button.innerHTML = buttonText;
    button.style.cssText = 'padding:6px 12px;border-radius:20px;background:var(--background-secondary);border:none;cursor:pointer;font-size:14px;color:var(--text-normal);position: relative;';

    if (currentTagsSet.has(tag)) {
      button.classList.add('diary-active');
      button.style.background = 'var(--interactive-accent)';
      button.style.color = 'var(--background-primary)';
    } else {
      button.style.background = 'var(--background-secondary)';
      button.style.color = 'var(--text-normal)';
    }

    button.onclick = (e) => {
      e.stopPropagation();
      button.classList.toggle('diary-active');
      if (button.classList.contains('diary-active')) {
        button.style.background = 'var(--interactive-accent)';
        button.style.color = 'var(--background-primary)';
      } else {
        button.style.background = 'var(--background-secondary)';
        button.style.color = 'var(--text-normal)';
      }
    };
    buttonsContainer.appendChild(button);
  }

  mask.style.display = 'block';
  popup.style.display = 'block';
}

/** 更新条目标签（原 2372-2430） */
export async function updateTags(entryId: string, newTags: string[]) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) return;

  const oldTags = [...entry.tags];
  if (oldTags.length === newTags.length && oldTags.every((t) => newTags.includes(t))) {
    return;
  }

  entry.tags = newTags;
  // 使用 getTagEmoji 生成 emoji 序列
  entry.emoji = newTags.map((tag) => getTagEmoji(tag)).join('');

  const dateStr = entry.date;
  const entries = diaryDataMap?.get(dateStr) ?? null;
  const targetEntry = entries?.find((e) => e.time === entry.time);
  if (targetEntry) {
    targetEntry.tags = newTags;
    targetEntry.emoji = entry.emoji;
  }

  await writeFile(dateStr);

  // 更新卡片上的 emoji 显示
  const emojiElement = document.querySelector(`#diary-entry-${CSS.escape(entryId)} .diary-emoji`);
  if (emojiElement) {
    let displayEmojiSeq = '';
    if (state.ui.singleSelectedTagForDisplay && entry.tags.includes(state.ui.singleSelectedTagForDisplay)) {
      displayEmojiSeq = getTagEmoji(state.ui.singleSelectedTagForDisplay);
    } else {
      displayEmojiSeq = entry.tags.map((tag) => getTagEmoji(tag)).join('');
    }
    emojiElement.textContent = displayEmojiSeq;
  }

  // 如果当前有筛选，且条目不再匹配筛选条件，则移除卡片
  if (state.data.selectedTags.size > 0) {
    const stillMatches = entry.tags.some((tag) => state.data.selectedTags.has(tag));
    if (!stillMatches) {
      removeCard(entryId);
      const idx = state.data.currentFilteredEntries.findIndex((e) => e.id === entryId);
      if (idx !== -1) state.data.currentFilteredEntries.splice(idx, 1);
    } else {
      // 如果本来不在 filtered 中但现在匹配了，需要插入
      const idx = state.data.currentFilteredEntries.findIndex((e) => e.id === entryId);
      if (idx === -1) {
        state.data.currentFilteredEntries.push(entry);
        state.data.currentFilteredEntries.sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          return dateCmp !== 0 ? dateCmp : b.timeValue - a.timeValue;
        });
        insertCard(entry);
      }
    }
  }

  rebuildTags();
  updateTitleSuffix();
}

// ===== 添加日记弹窗（原 3238-3478） =====

export function createConfirmDialog() {
  // 删除确认弹窗（代理到共享 confirm）
}

export function createAddDialog() {
  const existingMask = document.getElementById('add-diary-mask');
  const existingPopup = document.getElementById('add-diary-popup');
  if (existingMask) existingMask.remove();
  if (existingPopup) existingPopup.remove();

  const mask = document.createElement('div');
  mask.id = 'add-diary-mask';
  mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10001;display:none;';
  mask.onclick = (e) => e.target === mask && (mask.style.display = 'none');

  const popup = document.createElement('div');
  popup.id = 'add-diary-popup';
  popup.className = 'add-diary-popup';
  popup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:10002;padding:24px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto;display:none;';

  const title = document.createElement('h4');
  title.className = 'add-diary-title';
  title.textContent = '写日记';
  title.style.cssText = 'margin:0 0 20px 0;font-size:18px;font-weight:600;color:var(--text-normal);';

  const dateTimePicker = createDateTimeControl();

  const typeLabel = document.createElement('label');
  typeLabel.textContent = '类型';
  typeLabel.style.cssText = 'display:block;margin-bottom:6px;font-size:14px;color:var(--text-muted);font-weight:500;';

  const typeContainer = document.createElement('div');
  typeContainer.id = 'add-diary-type-container';
  typeContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;';

  // 获取所有可用标签（主标签 + 二级标签）
  const allTags = getAllAvailableTags();
  for (const tag of allTags) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'diary-tag-selector-btn';
    btn.dataset.tag = tag;
    const emoji = getTagEmoji(tag);

    // 构建按钮文本
    let buttonText = `${emoji} ${tag}`;
    // 如果是二级标签，在末尾添加父标签的 emoji（小字号提示）
    if (isSubTag(tag)) {
      const parentTag = getParentPrimaryTag(tag);
      if (parentTag) {
        const parentEmoji = getTagEmoji(parentTag);
        buttonText += ` <span style="font-size: 12px;margin-left:4px;position: absolute;top: 0;right: 0;translate: 5px -5px;">${parentEmoji}</span>`;
      }
    }
    btn.innerHTML = buttonText;

    btn.style.cssText = 'padding:6px 12px;border-radius:20px;background:var(--background-secondary);border:none;cursor:pointer;font-size:14px;color:var(--text-normal);position: relative;';
    btn.onclick = (e) => {
      e.preventDefault();
      btn.classList.toggle('diary-active');
    };
    typeContainer.appendChild(btn);
  }

  // 默认选中“日记”（如果存在）
  const defaultBtn = typeContainer.querySelector('[data-tag="日记"]');
  if (defaultBtn) defaultBtn.classList.add('diary-active');

  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.style.cssText = 'padding:8px 16px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--background-primary);cursor:pointer;font-size:14px;font-weight:500;';
  saveBtn.onclick = async () => await saveNewEntry();

  buttonsContainer.appendChild(saveBtn);

  popup.appendChild(title);
  popup.appendChild(dateTimePicker);
  popup.appendChild(typeLabel);
  popup.appendChild(typeContainer);
  popup.appendChild(buttonsContainer);
  mask.appendChild(popup);
  document.body.appendChild(mask);
}

/** 打开添加日记弹窗（原 3348-3426） */
export function openAddDialog() {
  const mask = document.getElementById('add-diary-mask');
  const popup = document.getElementById('add-diary-popup');
  if (!mask || !popup) return;

  // 1. 刷新类型按钮（按排序规则）
  const typeContainer = document.getElementById('add-diary-type-container');
  if (typeContainer) {
    typeContainer.innerHTML = '';
    const sortedTags = getSortedTagsForAddDialog();
    for (const tag of sortedTags) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'diary-tag-selector-btn';
      btn.dataset.tag = tag;
      const emoji = getTagEmoji(tag);
      let buttonText = `${emoji} ${tag}`;
      if (isSubTag(tag)) {
        const parentTag = getParentPrimaryTag(tag);
        if (parentTag) {
          const parentEmoji = getTagEmoji(parentTag);
          buttonText += ` <span style="font-size: 12px;margin-left:4px;position: absolute;top: 0;right: 0;translate: 5px -5px;">${parentEmoji}</span>`;
        }
      }
      btn.innerHTML = buttonText;
      btn.style.cssText = 'padding:6px 12px;border-radius:20px;background:var(--background-secondary);border:none;cursor:pointer;font-size:14px;color:var(--text-normal);position: relative;';
      btn.onclick = (e) => {
        e.preventDefault();
        btn.classList.toggle('diary-active');
      };
      typeContainer.appendChild(btn);
    }

    // ----- 使用设置中的默认标签 -----
    const defaultTag = getDefaultTagSetting();
    const defaultBtn = typeContainer.querySelector(`[data-tag="${defaultTag}"]`);
    if (defaultBtn) {
      defaultBtn.classList.add('diary-active');
      popup.dataset.selectedTag = defaultTag;
    } else {
      const firstBtn = typeContainer.querySelector('.diary-tag-selector-btn');
      if (firstBtn) {
        firstBtn.classList.add('diary-active');
        popup.dataset.selectedTag = (firstBtn as HTMLElement).dataset.tag;
      }
    }
  }

  // 2. 设置日期时间默认值
  let defaultDateStr = moment().format('YYYY-MM-DD');
  let defaultTimeStr = moment().format('HH:mm');

  if (getUseFileDateTimeSetting()) {
    // 改为判断 toggle
    const activeView = getApp().workspace.getActiveViewOfType(MarkdownViewFromObsidian) as any;
    if (activeView && activeView.file) {
      const file = activeView.file;
      if (file.path.startsWith(DIARY_DIRECTORY)) {
        const fileName = file.basename;
        if (/^\d{4}-\d{2}-\d{2}$/.test(fileName)) {
          defaultDateStr = fileName;
        }
      }
    }
  }
  // 否则保持当前时间

  const defaultDateTime = `${defaultDateStr} ${defaultTimeStr}`;
  const datetimeInput = document.getElementById('add-diary-datetime') as HTMLInputElement | null;
  if (datetimeInput) {
    datetimeInput.value = defaultDateTime;
    syncDateTime();
  }

  mask.style.display = 'block';
  popup.style.display = 'block';
  setTimeout(() => datetimeInput && datetimeInput.focus(), 100);
}

/** 保存新日记条目（原 3428-3478） */
export async function saveNewEntry() {
  const datetimeInput = document.getElementById('add-diary-datetime') as HTMLInputElement | null;
  const mask = document.getElementById('add-diary-mask');
  const popup = document.getElementById('add-diary-popup');
  if (!datetimeInput || !mask || !popup) return;

  const userInput = datetimeInput.value.trim();
  const typeContainer = document.getElementById('add-diary-type-container')!;
  const selTagNames: string[] = [];
  typeContainer.querySelectorAll('.diary-tag-selector-btn.diary-active').forEach((btn) => {
    selTagNames.push((btn as HTMLElement).dataset.tag!);
  });
  if (selTagNames.length === 0) {
    new Notice('请至少选择一个类型');
    return;
  }

  let targetMoment = parseNaturalTime(userInput);
  if (!targetMoment || !targetMoment.isValid()) {
    targetMoment = moment(userInput, 'YYYY-MM-DD HH:mm', true);
    if (!targetMoment.isValid()) {
      new Notice('错误：日期时间格式不正确');
      return;
    }
  }

  const dateStr = targetMoment.format('YYYY-MM-DD');
  const timeStr = targetMoment.format('HH:mm');

  try {
    const newEntry = await addEntry(dateStr, timeStr, selTagNames, '');
    mask.style.display = 'none';
    popup.style.display = 'none';

    if (newEntry) {
      jumpToEntry(newEntry, 'edit');
    }

    if (
      newEntry &&
      (!selTagNames.length || newEntry.tags.some((tag) => selTagNames.includes(tag))) &&
      (!state.data.currentDateFilter ||
        (state.data.currentDateFilter.month
          ? newEntry.date.startsWith(`${state.data.currentDateFilter.year}-${state.data.currentDateFilter.month}`)
          : newEntry.date.startsWith(state.data.currentDateFilter.year)))
    ) {
      state.data.currentFilteredEntries.push(newEntry);
      state.data.currentFilteredEntries.sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        return dateCmp !== 0 ? dateCmp : b.timeValue - a.timeValue;
      });
      insertCard(newEntry);
    }
  } catch (error: any) {
    console.error('保存日记失败:', error);
    new Notice('保存日记失败: ' + error.message);
  }
}

