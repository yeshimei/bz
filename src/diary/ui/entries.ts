/**
 * 条目列表：筛选、渲染、卡片交互、滚动、编辑、删除确认。
 * 原脚本 1865-2578 行。
 */
import { Component, MarkdownRenderer, Notice } from 'obsidian';
import { confirm } from '../../core/confirm';
import { getApp } from '../app';
import { BATCH_SIZE, DIARY_DIRECTORY, LONG_PRESS_DURATION, MOVIE_DIRECTORY, getSubTagsOfPrimary, getTagEmoji } from '../config';
import { deleteEntry, getIsProcessingRemainingFiles } from '../store';
import { state } from '../state';
import type { DateFilter, DiaryEntry } from '../types';
import { getEnableLongPressSetting } from './ui-settings';
import { showTagPicker } from './dialogs';
import { refreshSubTagsBar, updateTagCounts, updateTitleSuffix } from './filter-shared';

// ===== 渲染 markdown（原 3531-3548） =====

export async function renderMarkdown(content: string, container: HTMLElement, filePath: string | null) {
  if (!content) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '';
  // 如果没有文件路径，或者文件不存在，直接使用 innerHTML 渲染 HTML 标签
  if (!filePath) {
    container.innerHTML = content;
    return;
  }
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) {
    container.innerHTML = content;
    return;
  }
  await MarkdownRenderer.render(getApp(), content, container, file.path, new Component());
}

// ===== 筛选（原 1867-1952） =====

export function applyFilter(options: { skipTagCountUpdate?: boolean } = {}) {
  const { skipTagCountUpdate = false } = options;
  let filtered = [...state.data.originalDiaryEntries];

  // 多标签筛选：对于每个选中的标签，如果是主标签且有二级标签，则匹配该主标签或其任意二级标签
  if (state.data.selectedTags.size > 0) {
    filtered = filtered.filter((entry) => {
      // 遍历选中的标签，只要满足一个即可
      for (const tag of state.data.selectedTags) {
        // 检查是否是主标签且有二级标签
        const subTags = getSubTagsOfPrimary(tag);
        if (subTags && subTags.length > 0) {
          // 主标签条件：entry包含该主标签，或者包含任意一个二级标签
          if (entry.tags.includes(tag) || entry.tags.some((t) => subTags.some((sub) => sub.tag === t))) {
            return true;
          }
        } else {
          // 普通主标签或二级标签：直接匹配
          if (entry.tags.includes(tag)) {
            return true;
          }
        }
      }
      return false;
    });
  }

  // 日期筛选
  if (state.data.currentDateFilter) {
    filtered = filtered.filter((entry) => {
      const [year, month] = entry.date.split('-');
      if (state.data.currentDateFilter!.month) {
        return year === state.data.currentDateFilter!.year && month === state.data.currentDateFilter!.month;
      }
      return year === state.data.currentDateFilter!.year;
    });
  }

  // 搜索筛选
  if (state.data.currentSearchKeyword) {
    const lowerKeyword = state.data.currentSearchKeyword.toLowerCase();
    filtered = filtered.filter((entry) => {
      return (
        entry.content.toLowerCase().includes(lowerKeyword) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(lowerKeyword)) ||
        entry.time.toLowerCase().includes(lowerKeyword) ||
        entry.date.includes(state.data.currentSearchKeyword)
      );
    });
  }

  // 更新显示用的单标签标志
  state.ui.singleSelectedTagForDisplay = state.data.selectedTags.size === 1 ? [...state.data.selectedTags][0] : null;

  state.data.currentFilteredEntries = filtered;
  state.data.currentDisplayCount = 0;
  if (state.ui.entriesContainer) {
    state.ui.entriesContainer.innerHTML = '';
    state.ui.scrollContainer = null;
  }
  renderEntries();
  updateTitleSuffix();
  refreshSubTagsBar();

  if (!skipTagCountUpdate) {
    updateTagCounts();
  }
}

// ===== 标题日期后缀（原 1934-1952，经 filter-shared 桥接） =====
// （实现见 filter-shared.ts）

// ===== 渲染条目列表（原 1955-2029） =====

export function renderEntries() {
  if (!state.ui.entriesContainer) {
    state.ui.entriesContainer = document.getElementById('__diary-entries-container__');
    if (!state.ui.entriesContainer) return;
  }

  if (state.data.currentDisplayCount === 0) state.ui.entriesContainer.innerHTML = '';

  if (!state.data.currentFilteredEntries || state.data.currentFilteredEntries.length === 0) {
    if (state.data.currentDisplayCount === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = state.data.selectedTags.size > 0 ? '没有找到匹配标签的日记内容' : '没有找到日记内容';
      emptyMessage.style.cssText = 'padding:40px;text-align:center;color:var(--text-faint);font-size:16px;';
      state.ui.entriesContainer.appendChild(emptyMessage);
    }
    return;
  }

  const startIndex = state.data.currentDisplayCount;
  const endIndex = Math.min(startIndex + BATCH_SIZE, state.data.currentFilteredEntries.length);
  const batchToShow = state.data.currentFilteredEntries.slice(startIndex, endIndex);

  if (batchToShow.length === 0) return;

  if (!state.ui.scrollContainer) {
    state.ui.scrollContainer = document.createElement('div');
    state.ui.scrollContainer.className = 'diary-scroll-container';
    state.ui.scrollContainer.style.cssText = 'padding:0 20px;';
    state.ui.entriesContainer.appendChild(state.ui.scrollContainer);
  }

  let lastDate: string | null = null;
  let dateSection: HTMLElement | null = null;

  batchToShow.forEach((entry) => {
    if (entry.date !== lastDate) {
      dateSection = document.createElement('div');
      dateSection.className = 'date-section';
      dateSection.style.cssText = 'position:relative;';

      const dateSeparator = document.createElement('div');
      dateSeparator.className = 'diary-date-separator';
      dateSeparator.dataset.date = entry.date;
      dateSeparator.style.cssText = 'position:sticky;top:0;z-index:10;padding:10px 12px;background:var(--background-primary);color:var(--text-normal);font-weight:600;font-size:18px;';
      dateSeparator.textContent = entry.date;

      dateSection.appendChild(dateSeparator);
      state.ui.scrollContainer!.appendChild(dateSection);
      lastDate = entry.date;
    }

    const entryCard = createEntryCard(entry);
    if (dateSection) dateSection.appendChild(entryCard);
    else state.ui.scrollContainer!.appendChild(entryCard);
  });

  state.data.currentDisplayCount = endIndex;

  if (getIsProcessingRemainingFiles()) {
    const loadingHint = document.createElement('div');
    loadingHint.className = 'loading-hint';
    loadingHint.id = 'loading-hint';
    loadingHint.textContent = '后台加载中，请稍候...';
    loadingHint.style.cssText = 'text-align:center;color:var(--text-faint);padding:20px;font-size:14px;';
    state.ui.scrollContainer.appendChild(loadingHint);
  } else if (state.data.currentDisplayCount >= state.data.currentFilteredEntries.length) {
    const allLoaded = document.createElement('div');
    allLoaded.className = 'all-loaded-hint';
    allLoaded.textContent = '已显示所有日记';
    allLoaded.style.cssText = 'text-align:center;color:var(--text-faint);padding:20px;font-size:14px;';
    state.ui.scrollContainer.appendChild(allLoaded);
  }

  state.data.isLoadingMore = false;
}


// ===== 条目卡片（原 2032-2098） =====

export function createEntryCard(entry: DiaryEntry) {
  const entryCard = document.createElement('div');
  entryCard.className = 'diary-entry-card';
  entryCard.id = `diary-entry-${entry.id}`;
  entryCard.style.cssText = 'border:1px solid var(--background-modifier-border);border-radius:12px;padding:20px;background:var(--background-primary);margin:20px 0;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';

  const timeInfo = document.createElement('div');
  timeInfo.style.cssText = 'display:flex;align-items:center;gap:8px;';

  // --- 决定显示的 emoji 字符串 ---
  let displayEmojiSeq = '';
  if (state.ui.singleSelectedTagForDisplay && entry.tags.includes(state.ui.singleSelectedTagForDisplay)) {
    displayEmojiSeq = getTagEmoji(state.ui.singleSelectedTagForDisplay);
  } else {
    displayEmojiSeq = entry.tags.map((tag) => getTagEmoji(tag)).join('');
  }

  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'diary-emoji';
  emojiSpan.dataset.entryId = entry.id;
  emojiSpan.textContent = displayEmojiSeq;
  emojiSpan.style.cssText = 'font-size:20px;cursor:pointer;user-select:none;';

  emojiSpan.addEventListener('click', (e) => {
    e.stopPropagation();
    showTagPicker(entry.id!);
  });

  const timeSpan = document.createElement('span');
  timeSpan.style.cssText = 'font-weight:600;color:var(--text-normal);font-size:16px;';
  timeSpan.textContent = entry.time;

  timeInfo.appendChild(emojiSpan);
  timeInfo.appendChild(timeSpan);
  header.appendChild(timeInfo);

  const content = document.createElement('div');
  content.className = 'diary-entry-content';
  content.dataset.entryId = entry.id;
  content.style.cssText = 'color:var(--text-normal);line-height:1.6;white-space:normal;font-size:15px;margin-bottom:12px;padding:8px;border-radius:4px;min-height:50px;cursor:text;user-select:text;';

  addLongPress(content, 'content', entry.id!);
  fixMobileSelect(content);

  let lastClickTime = 0;
  content.addEventListener('click', async (e) => {
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTime;
    if (timeDiff < 300 && timeDiff > 0) {
      e.stopPropagation();
      e.preventDefault();
      await jumpToEntry(entry);
    }
    lastClickTime = currentTime;
  });

  const contentText = entry.content.trim();
  let filePath = entry.filename.includes('/') ? entry.filename : `${DIARY_DIRECTORY}/${entry.filename}.md`;
  renderMarkdown(contentText, content, filePath);

  entryCard.appendChild(header);
  entryCard.appendChild(content);
  return entryCard;
}

// ===== 跳转（原 2100-2137） =====

export async function jumpToEntry(entry: DiaryEntry, mode: 'select' | 'edit' = 'select') {
  // 判断是否为影视条目（id 以 movie- 开头 或 filename 包含 MOVIE_DIRECTORY）
  const isMovieEntry =
    (entry.id && entry.id.startsWith('movie-')) || (entry.filename && entry.filename.startsWith(MOVIE_DIRECTORY));
  if (isMovieEntry) {
    // 直接打开影视文件
    const file = getApp().vault.getAbstractFileByPath(entry.filename) as any;
    if (!file) {
      new Notice('找不到影视文件');
      return;
    }
    await getApp().workspace.openLinkText(file.path, '', false, { active: true });
    // 关闭日记本弹窗
    if (state.ui.maskLayer) state.ui.maskLayer.style.visibility = 'hidden';
    if (state.ui.tagFilterPopup) state.ui.tagFilterPopup.style.visibility = 'hidden';
    return;
  }

  // 处理普通日记条目
  const fileName = entry.filename; // 日期字符串，不含扩展名
  const filePath = `${DIARY_DIRECTORY}/${fileName}.md`;
  const anchor = `${entry.emoji} ${entry.time}`; // 例如 "📖 14:30"
  const link = `${DIARY_DIRECTORY}/${fileName}#${anchor}`;

  // 检查文件是否存在
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) {
    new Notice('找不到日记文件');
    return;
  }

  // 打开文件并滚动到对应的标题位置
  await getApp().workspace.openLinkText(link, '', false, { active: true });

  // 关闭日记本弹窗
  if (state.ui.maskLayer) state.ui.maskLayer.style.visibility = 'hidden';
  if (state.ui.tagFilterPopup) state.ui.tagFilterPopup.style.visibility = 'hidden';
}

// ===== 长按手势（原 2140-2207） =====

export function addLongPress(element: HTMLElement, type: 'content' | 'emoji', entryId: string) {
  if (!getEnableLongPressSetting()) return; // 禁用长按

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let isLongPress = false;
  let touchStartX = 0;
  let touchStartY = 0;
  const MOVE_THRESHOLD = 10;

  // 使用全局 LONG_PRESS_DURATION（已从设置读取）
  const duration = LONG_PRESS_DURATION;

  const longPressHandler = () => {
    if (type === 'content') {
      copyLink(entryId);
    } else if (type === 'emoji') {
      showTagPicker(entryId);
    }
  };

  element.addEventListener(
    'touchstart',
    (e) => {
      if (state.ui.editingEntryId === entryId) return;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      isLongPress = false;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        longPressHandler();
      }, duration);
    },
    { passive: true }
  );

  element.addEventListener(
    'touchmove',
    (e) => {
      if (!pressTimer) return;
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const deltaY = Math.abs(touch.clientY - touchStartY);
      if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    },
    { passive: true }
  );

  element.addEventListener('touchend', (e) => {
    if (pressTimer) clearTimeout(pressTimer);
    if (isLongPress) {
      e.preventDefault();
      isLongPress = false;
    }
  });

  element.addEventListener('mousedown', (e) => {
    if (state.ui.editingEntryId === entryId) return;
    pressTimer = setTimeout(longPressHandler, duration);
  });

  element.addEventListener('mouseup', () => { if (pressTimer) clearTimeout(pressTimer); });
  element.addEventListener('mouseleave', () => { if (pressTimer) clearTimeout(pressTimer); });
}

// ===== 复制双链（原 2209-2215） =====

export async function copyLink(entryId: string) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) return;
  const link = `[[${entry.filename}#${entry.emoji} ${entry.time}]]`;
  await navigator.clipboard.writeText(link);
  new Notice(`已复制双链引用: ${link}`);
}

// ===== 取消编辑（原 2218-2240） =====

export function cancelEdit(entryId: string, originalHTML: string | null) {
  const contentElement = document.querySelector(
    `.diary-entry-content[data-entry-id="${entryId}"]`
  ) as HTMLElement | null;
  if (!contentElement) return;
  contentElement.contentEditable = 'false';
  contentElement.classList.remove('diary-editing');
  contentElement.style.touchAction = '';
  if (originalHTML) contentElement.innerHTML = originalHTML;
  else {
    const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
    if (entry) {
      const filePath = `${DIARY_DIRECTORY}/${entry.filename}.md`;
      renderMarkdown(entry.content.trim(), contentElement, filePath);
    }
  }
  if ((contentElement as any)._editHandlers) {
    contentElement.removeEventListener('keydown', (contentElement as any)._editHandlers.keydown);
    delete (contentElement as any)._editHandlers;
  }
  const actionsContainer = contentElement.nextElementSibling;
  if (actionsContainer && actionsContainer.classList.contains('diary-edit-actions')) actionsContainer.remove();
  if (state.ui.editingEntryId === entryId) state.ui.editingEntryId = null;
}

// ===== 删除确认（原 2509-2523） =====

export function showConfirm(entryId: string) {
  confirm({
    title: '确认删除',
    message: '确定要删除这篇日记吗？\n\n此操作不可撤销，日记将从笔记中永久删除。',
    confirmText: '删除日记',
    onConfirm: async () => {
      await deleteEntry(entryId);
      const tagSelectorMask = document.getElementById('diary-tag-selector-mask');
      const tagSelectorPopup = document.getElementById('diary-tag-selector-popup');
      if (tagSelectorMask) tagSelectorMask.style.display = 'none';
      if (tagSelectorPopup) tagSelectorPopup.style.display = 'none';
    },
  });
}

// ===== 移除卡片（原 2571-2575） =====

export function removeCard(entryId: string) {
  const card = document.getElementById(`diary-entry-${entryId}`);
  if (card) card.remove();
}

// ===== 插入卡片（原 2577-2624） =====

export function insertCard(entry: DiaryEntry) {
  if (!state.ui.scrollContainer) return;
  const entryCard = createEntryCard(entry);
  const dateSections = state.ui.scrollContainer.querySelectorAll('.date-section');
  let targetSection: HTMLElement | null = null;
  for (const section of dateSections as any) {
    const sep = section.querySelector('.diary-date-separator');
    if (sep && sep.dataset.date === entry.date) {
      targetSection = section;
      break;
    }
  }
  if (targetSection) {
    const cards = targetSection.querySelectorAll('.diary-entry-card');
    let inserted = false;
    for (let i = 0; i < cards.length; i++) {
      const cardTime =
        (cards[i] as HTMLElement).querySelector('.diary-entry-content')?.getAttribute('data-entry-id')?.split('-').slice(1, -1).join('-') ?? '';
      if (entry.time > cardTime) {
        targetSection.insertBefore(entryCard, cards[i]);
        inserted = true;
        break;
      }
    }
    if (!inserted) targetSection.appendChild(entryCard);
  } else {
    const newSection = document.createElement('div');
    newSection.className = 'date-section';
    newSection.style.cssText = 'position:relative;margin-top:20px;';
    const dateSeparator = document.createElement('div');
    dateSeparator.className = 'diary-date-separator';
    dateSeparator.dataset.date = entry.date;
    dateSeparator.style.cssText = 'position:sticky;top:0;z-index:10;padding:12px 0;background:var(--background-primary);color:var(--text-normal);font-weight:600;font-size:18px;';
    dateSeparator.textContent = entry.date;
    newSection.appendChild(dateSeparator);
    newSection.appendChild(entryCard);
    let inserted = false;
    const sections = state.ui.scrollContainer.querySelectorAll('.date-section');
    for (let i = 0; i < sections.length; i++) {
      const sep = (sections[i] as HTMLElement).querySelector('.diary-date-separator');
      if (sep && ((sep as HTMLElement).dataset.date ?? '') < entry.date) {
        state.ui.scrollContainer.insertBefore(newSection, sections[i]);
        inserted = true;
        break;
      }
    }
    if (!inserted) state.ui.scrollContainer.appendChild(newSection);
  }
}

// ===== 滚动与粘性（原 2434-2505） =====

export function initScroll() {
  if (!state.ui.entriesContainer)
    state.ui.entriesContainer = document.getElementById('__diary-entries-container__');
  state.ui.entriesContainer!.addEventListener('scroll', () => {
    if (state.data.isLoadingMore) return;
    const scrollTop = state.ui.entriesContainer!.scrollTop;
    const scrollHeight = state.ui.entriesContainer!.scrollHeight;
    const clientHeight = state.ui.entriesContainer!.clientHeight;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      state.data.isLoadingMore = true;
      renderEntries();
    }
    updateSticky();
  });
  setTimeout(updateSticky, 100);
}

export function updateSticky() {
  if (!state.ui.entriesContainer || !state.ui.scrollContainer) return;
  const dateSeparators = state.ui.scrollContainer.querySelectorAll('.diary-date-separator');
  if (dateSeparators.length === 0) return;
  const containerRect = state.ui.entriesContainer.getBoundingClientRect();
  const scrollTop = state.ui.entriesContainer.scrollTop;
  let currentStickyDate: HTMLElement | null = null;
  for (let i = dateSeparators.length - 1; i >= 0; i--) {
    const separator = dateSeparators[i] as HTMLElement;
    const separatorRect = separator.getBoundingClientRect();
    const separatorTop = separatorRect.top - containerRect.top + scrollTop;
    if (separatorTop <= scrollTop + 5) {
      currentStickyDate = separator;
      break;
    }
  }
  dateSeparators.forEach((separator) => {
    const el = separator as HTMLElement;
    el.style.position = 'sticky';
    el.style.top = '0';
    el.style.zIndex = '10';
    el.style.background = 'var(--background-primary)';
  });
  if (currentStickyDate) currentStickyDate.style.zIndex = '20';
}

export function fixMobileSelect(element: HTMLElement) {
  if (!state.ui.isTouchDevice) return;
  element.addEventListener(
    'touchstart',
    function mobileCursorFix(e) {
      if (document.activeElement !== this) {
        (this as HTMLElement).focus();
        setTimeout(() => {
          if (window.getSelection && window.getSelection()!.rangeCount === 0) {
            const range = document.createRange();
            range.selectNodeContents(this as HTMLElement);
            range.collapse(false);
            const selection = window.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }, 50);
      }
    },
    { passive: true }
  );
  element.addEventListener(
    'touchmove',
    function preventScroll(e) {
      if (state.ui.editingEntryId) e.stopPropagation();
    },
    { passive: false }
  );
}
