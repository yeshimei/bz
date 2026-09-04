/**
 * 弹窗族：添加日记、标签选择器、日期筛选（原脚本 949-1130 + 2243-2430 + 3238-3478）。
 */
import { MarkdownView as MarkdownViewFromObsidian, moment } from 'obsidian';
import { pad2 } from '../../core/utils';
import { topifyZ } from '../../core/z-order';
import { notice } from '../../core/notice';
import { openFlowDialog } from '../../core/flow-dialog';
import { emitDomainEvent } from '../../core/domain-bus';
import { getApp } from '../app';
import {
  DIARY_DIRECTORY,
  getSortedTagsForAddDialog,
  getSubTagsOfPrimary,
  getTagEmoji,
  getParentPrimaryTag,
  isSubTag,
} from '../config';
import { parseFlexibleDateTime } from '../parser';
import { addEntry, writeFile, reloadWithEncrypted } from '../store';
import { ENCRYPT_TAG, reclassifyEntry } from '../encrypt';
import { diaryDataMap, state } from '../state';
import { getJumpToEditAfterSaveSetting, getTagShowEmojiSetting, getUseFileDateTimeSetting } from './ui-settings';
import { rebuildTags, updateTitleSuffix } from './filter-shared';
import { applyFilter as applyFilterFromDialogs, insertCard, jumpToEntry, removeCard, showConfirm as showConfirmFromDialogs } from './entries';
import { createDateTimeControl, resetDateTimeControl } from './datetime-picker';

// ===== 类型选择按钮（类型选择器与写日记弹窗共用） =====

/**
 * 生成类型选择按钮（emoji + 标签，二级标签附父标签 emoji 角标）。
 * showEmoji=false 时纯文字（类型选择器跟随 diaryTagShowEmoji 设置；
 * 写日记弹窗保持始终显示 emoji 的既有行为，传 true）。
 */
function createTagOptionButton(tag: string, showEmoji: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'diary-tag-selector-btn';
  btn.dataset.tag = tag;
  let buttonText = showEmoji ? `${getTagEmoji(tag)} ${tag}` : `${tag}`;
  if (isSubTag(tag)) {
    const parentTag = getParentPrimaryTag(tag);
    if (parentTag && showEmoji) {
      buttonText += ` <span style="font-size: 12px;margin-left:4px;position: absolute;top: 0;right: 0;translate: 5px -5px;">${getTagEmoji(parentTag)}</span>`;
    }
  }
  btn.innerHTML = buttonText;
  btn.style.cssText = 'padding:6px 12px;border-radius:20px;background:var(--background-secondary);border:none;cursor:pointer;font-size:14px;color:var(--text-normal);position: relative;';
  return btn;
}

// ===== 日期筛选弹窗（原 949-1129） =====

export function createDatePicker() {
  const existingMask = document.getElementById('diary-date-filter-mask');
  const existingPopup = document.getElementById('diary-date-filter-popup');
  if (existingMask) existingMask.remove();
  if (existingPopup) existingPopup.remove();

  const mask = document.createElement('div');
  mask.id = 'diary-date-filter-mask';
  mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);display:none;';
  mask.onclick = (e) => {
    if (e.target === mask) mask.style.display = 'none';
  };

  const popup = document.createElement('div');
  popup.id = 'diary-date-filter-popup';
  popup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);width:90%;max-width:480px;display:flex;flex-direction:column;overflow:hidden;';

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
  // 当前筛选所在年份优先（DateFilter.year 恒存在）
  if (state.data.currentDateFilter?.year) {
    selectedYear = state.data.currentDateFilter.year;
  }

  renderDatePicker(content, years, selectedYear);
  topifyZ(mask); // ADR-0067：显示即发号，谁后显示谁在上（content 为 mask 子节点随动）
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
    const monthStr = pad2(i);
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
  mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);display:none;';
  mask.onclick = (e) => e.target === mask && (mask.style.display = 'none');

  const popup = document.createElement('div');
  popup.id = 'diary-tag-selector-popup';
  popup.className = 'diary-tag-selector-popup';
  popup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:20px;max-width:300px;width:90%;max-height:80vh;overflow-y:auto;display:none;';

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
    if (!entryId) {
      mask.style.display = 'none';
      popup.style.display = 'none';
      return;
    }
    if (selTagNames.length === 0) {
      notice('请至少选择一个标签');
      return;
    }
    const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
    const isEncryptedEntry = !!entry?.encrypted;
    hideTagPicker();
    void handleTagPickerSave(entryId, selTagNames, isEncryptedEntry);
  };

  actionsContainer.appendChild(deleteBtn);
  actionsContainer.appendChild(saveBtn);
  popup.appendChild(title);
  popup.appendChild(buttonsContainer);
  popup.appendChild(actionsContainer);
  mask.appendChild(popup);
  document.body.appendChild(mask);
}

/** 隐藏标签选择器弹窗 */
function hideTagPicker() {
  const mask = document.getElementById('diary-tag-selector-mask');
  const popup = document.getElementById('diary-tag-selector-popup');
  if (mask) mask.style.display = 'none';
  if (popup) popup.style.display = 'none';
}

/**
 * 标签选择器「保存」分流（ADR-0017）：
 * - 加密条目的保存 = 改分类降级（reclassifyEntry），成功后 merge 回 md 并从保险箱取出。
 * - 非加密条目走原 updateTags 写回（加密入口在抽屉「加密」动作，标签选择器不提供加密分类）。
 */
async function handleTagPickerSave(
  entryId: string,
  selTagNames: string[],
  isEncryptedEntry: boolean
) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) return;

  if (isEncryptedEntry) {
    // 加密条目：改分类 = 解密降级 + 应用新标签（Q20-a）
    const proceed =
      (await openFlowDialog({
        title: '改分类',
        message: '将解密此日记并恢复为普通条目，是否继续？',
        actions: [
          { label: '取消', value: 'cancel' },
          { label: '确定', value: 'ok', cta: true },
        ],
      })) === 'ok';
    if (!proceed) return;
    if (!entry.noteId) return;
    const success = await reclassifyEntry(entry.noteId, selTagNames);
    if (!success) {
      notice('解密改分类失败', 'error');
    } else {
      // UX-8：加密条目改分类成功提示，语义同「已解密还原」
      notice('已解密还原', 'success');
    }
    await reloadWithEncrypted();
    return;
  }

  // 普通改分类
  await updateTags(entryId, selTagNames);
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

  // 加密分类不在类型选择器提供（加密唯一入口 = 抽屉「加密」动作，ADR-0017）；
  // 加密条目的改分类（降级）同样不含「加密」选项
  const isEncryptedEntry = !!entry.encrypted;
  const sortedTags = getSortedTagsForAddDialog();

  // 当前条目的标签集合（加密条目：除「加密」外的原始分类为已选项）
  const currentTagsSet = new Set(isEncryptedEntry ? entry.tags.filter((t) => t !== ENCRYPT_TAG) : entry.tags);

  // 生成按钮
  for (const tag of sortedTags) {
    const button = createTagOptionButton(tag, getTagShowEmojiSetting());

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

  topifyZ(mask, popup); // ADR-0067：显示即发号
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

  const dateStr = entry.date;
  const entries = diaryDataMap?.get(dateStr) ?? null;
  // 稳定定位（P1-12）：行号优先，同 time 多条不再改错位置；旧行号失配时回退「该时间仅一条」
  const sameTime = entries?.filter((e) => e.time === entry.time) ?? [];
  const targetEntry =
    entries?.find((e) => e.time === entry.time && e.lineNumber === entry.lineNumber) ??
    (sameTime.length === 1 ? sameTime[0] : undefined);
  // P2 审查修复：定位失败（map 中无对应块，如数据未加载/被加密链路换血）时告警并中止，
  // 不再盲写旧数据——旧行为 UI 显示新标签、磁盘还是旧标签
  if (!targetEntry) {
    notice('未能在日记数据中定位该条目，标签没有修改', 'error');
    return;
  }

  entry.tags = newTags;
  // 使用 getTagEmoji 生成 emoji 序列
  entry.emoji = newTags.map((tag) => getTagEmoji(tag)).join('');
  targetEntry.tags = newTags;
  targetEntry.emoji = entry.emoji;

  await writeFile(dateStr);

  // 动作埋点：标签变更写盘成功（oldTags 已在函数开头捕获）
  emitDomainEvent('diary:tags-changed', { entryId, date: entry.date, time: entry.time, from: oldTags, to: newTags });

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
        // P2 审查修复：插卡后前移显示计数——新卡片已渲染进 DOM，滚动加载下一批
        // 从其后开始，否则滚到底时尾部条目重复渲染
        state.data.currentDisplayCount += 1;
      }
    }
  }

  rebuildTags();
  updateTitleSuffix();
}

// ===== 添加日记弹窗（原 3238-3478） =====

export function createAddDialog() {
  const existingMask = document.getElementById('add-diary-mask');
  const existingPopup = document.getElementById('add-diary-popup');
  if (existingMask) existingMask.remove();
  if (existingPopup) existingPopup.remove();

  const mask = document.createElement('div');
  mask.id = 'add-diary-mask';
  mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);display:none;';
  mask.onclick = (e) => e.target === mask && (mask.style.display = 'none');

  const popup = document.createElement('div');
  popup.id = 'add-diary-popup';
  popup.className = 'add-diary-popup';
  popup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto;display:none;';

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

  // 类型按钮（排序规则与 openAddDialog 一致：主标签平铺、有二级标签的主标签展开为二级；加密分类不在此提供）
  const allTags = getSortedTagsForAddDialog();
  for (const tag of allTags) {
    const btn = createTagOptionButton(tag, true);
    btn.onclick = (e) => {
      e.preventDefault();
      btn.classList.toggle('diary-active');
    };
    typeContainer.appendChild(btn);
  }


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
      const btn = createTagOptionButton(tag, true);
      btn.onclick = (e) => {
        e.preventDefault();
        btn.classList.toggle('diary-active');
      };
      typeContainer.appendChild(btn);
    }

    // ----- 不预选任何标签（用户确认：默认全部加载，不选择任何标签） -----
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
  // P1 审查修复：打开时同步重置控件内部 currentMoment（显示与滚轮起点一致）。
  // 旧路径只改 hiddenInput 显示值——控件内部时刻停在创建那天，隔天打开直接点
  // 「确定」会把日记写回旧时刻
  resetDateTimeControl(moment(defaultDateTime, 'YYYY-MM-DD HH:mm', true));
  const datetimeInput = document.getElementById('add-diary-datetime') as HTMLInputElement | null;
  if (datetimeInput) {
    datetimeInput.value = defaultDateTime;
  }

  topifyZ(mask, popup); // ADR-0067：显示即发号
  mask.style.display = 'block';
  popup.style.display = 'block';
  setTimeout(() => datetimeInput && datetimeInput.focus(), 100);
}

/** 保存新日记条目（原 3428-3478） */

// P1-14：插入当前视图的条件与 applyFilter 同源求值——
// 标签筛选（含主标签→二级标签展开）+ 日期筛选 + 搜索关键词
function matchesCurrentTagFilter(tags: string[]): boolean {
  if (state.data.selectedTags.size === 0) return true;
  for (const tag of state.data.selectedTags) {
    const subTags = getSubTagsOfPrimary(tag);
    if (subTags && subTags.length > 0) {
      if (tags.includes(tag) || tags.some((t) => subTags.some((sub) => sub.tag === t))) return true;
    } else if (tags.includes(tag)) {
      return true;
    }
  }
  return false;
}

function matchesCurrentSearch(entry: { content: string; tags: string[]; time: string; date: string }): boolean {
  if (!state.data.currentSearchKeyword) return true;
  const lowerKeyword = state.data.currentSearchKeyword.toLowerCase();
  return (
    entry.content.toLowerCase().includes(lowerKeyword) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(lowerKeyword)) ||
    entry.time.toLowerCase().includes(lowerKeyword) ||
    entry.date.includes(state.data.currentSearchKeyword)
  );
}

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
    notice('请至少选择一个类型');
    return;
  }

  let targetMoment = parseFlexibleDateTime(userInput);
  if (!targetMoment || !targetMoment.isValid()) {
    notice('日期时间格式不正确');
    return;
  }

  const dateStr = targetMoment.format('YYYY-MM-DD');
  const timeStr = targetMoment.format('HH:mm');

  try {
    const newEntry = await addEntry(dateStr, timeStr, selTagNames, '');
    // 动作埋点：新增保存成功（本期无消费者，emit 即可）
    emitDomainEvent('diary:entry-added', { date: dateStr, time: timeStr, tags: selTagNames, content: '' });
    // UX-7：保存成功确认（正文不带 emoji，类型图标即视觉前缀）
    notice('已保存日记', 'success');
    mask.style.display = 'none';
    popup.style.display = 'none';

    // 保存后立即进入编辑（设置项 diaryJumpToEditAfterSave，关=仅关闭弹窗）
    if (getJumpToEditAfterSaveSetting() && newEntry) {
      jumpToEntry(newEntry, 'edit');
    }

    if (
      newEntry &&
      matchesCurrentTagFilter(newEntry.tags) &&
      matchesCurrentSearch(newEntry) &&
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
      // P2 审查修复：插卡后前移显示计数——新卡片已渲染进 DOM，滚动加载下一批
      // 从其后开始，否则滚到底时尾部条目重复渲染
      state.data.currentDisplayCount += 1;
    }
  } catch (error: any) {
    console.error('保存日记失败:', error);
    notice('保存日记失败：' + error.message, 'error');
  }
}

