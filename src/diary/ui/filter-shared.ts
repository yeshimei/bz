/**
 * 筛选联动共享逻辑（applyFilter 与标签栏重建共用，避免 entries ↔ panel 循环依赖）。
 * 原脚本 updateTitleSuffix（1934）、refreshSubTagsBar（1208）、updateSubTagsCounts（1312）、updateTagCounts（914）。
 */
import { getPrimaryTagsConfig, getParentPrimaryTag, getSubTagsOfPrimary, getTagEmoji, isSubTag } from '../config';
import { getCurrentActiveParentForSub, setCurrentActiveParentForSub, state } from '../state';
import { getShowTagCountSetting } from './ui-settings';

/** 更新标题上的日期后缀（原 1934-1952） */
export function updateTitleSuffix() {
  const titleElement = document.querySelector('#diary-tag-filter .diary-popup-header h3');
  if (!titleElement) return;

  const existingSuffix = titleElement.querySelector('.date-filter-suffix');
  if (existingSuffix) existingSuffix.remove();

  if (state.data.currentDateFilter) {
    const suffixSpan = document.createElement('span');
    suffixSpan.className = 'date-filter-suffix';
    suffixSpan.style.cssText = 'margin-left: 8px; font-size: 14px; font-weight: normal; color: var(--text-muted);';
    if (state.data.currentDateFilter.month) {
      suffixSpan.textContent = `${state.data.currentDateFilter.year}-${state.data.currentDateFilter.month}`;
    } else {
      suffixSpan.textContent = state.data.currentDateFilter.year;
    }
    titleElement.appendChild(suffixSpan);
  }
}

/** 刷新二级标签区域（根据选中的主标签或二级标签，原 1208-1309） */
export function refreshSubTagsBar() {
  const subContainer = document.getElementById('diary-subtags-container');
  if (!subContainer) return;

  // 寻找需要显示二级标签的父标签：
  // 1. 如果有选中的主标签且包含二级标签，使用它
  // 2. 否则如果有选中的二级标签，使用它的父标签
  let activeParent: string | null = null;
  for (const tag of state.data.selectedTags) {
    const subTags = getSubTagsOfPrimary(tag);
    if (subTags && subTags.length > 0) {
      activeParent = tag;
      break;
    }
  }
  if (!activeParent) {
    for (const tag of state.data.selectedTags) {
      if (isSubTag(tag)) {
        activeParent = getParentPrimaryTag(tag);
        break;
      }
    }
  }

  setCurrentActiveParentForSub(activeParent);

  if (!activeParent) {
    subContainer.style.display = 'none';
    subContainer.innerHTML = '';
    return;
  }

  subContainer.style.display = 'flex';
  subContainer.innerHTML = '';

  const subTags = getSubTagsOfPrimary(activeParent);
  if (!subTags) return;

  // 基于原始数据统计二级标签出现次数
  const countMap = new Map<string, number>();
  state.data.originalDiaryEntries.forEach((entry) => {
    entry.tags.forEach((tag) => {
      if (isSubTag(tag) && getParentPrimaryTag(tag) === activeParent) {
        countMap.set(tag, (countMap.get(tag) || 0) + 1);
      }
    });
  });

  for (const sub of subTags) {
    const btn = document.createElement('button');
    btn.className = 'diary-tag-btn diary-sub-tag-btn';
    btn.dataset.tag = sub.tag;
    const count = countMap.get(sub.tag) || 0;
    btn.innerHTML = `${sub.emoji} ${sub.tag} <span style="margin-left:4px; font-size:10px; opacity:0.8;">(${count})</span>`;
    btn.style.cssText =
      'border-radius:10px;background:var(--background-secondary);cursor:pointer;font-size:10px;color:var(--text-normal);transition:all 0.2s;display:flex;align-items:center;flex-shrink:0;box-shadow:none;';

    if (state.data.selectedTags.has(sub.tag)) {
      btn.style.background = 'var(--interactive-accent)';
      btn.style.color = 'var(--background-primary)';
    }

    btn.onmouseenter = () => !state.data.selectedTags.has(sub.tag) && (btn.style.backgroundColor = 'var(--background-modifier-hover)');
    btn.onmouseleave = () => !state.data.selectedTags.has(sub.tag) && (btn.style.backgroundColor = 'var(--background-secondary)');

    btn.onclick = (e) => {
      e.stopPropagation();
      // 点击二级标签：如果未选中，则清空所有标签后只选中它；如果已选中，则清空所有标签
      if (!state.data.selectedTags.has(sub.tag)) {
        // 清空所有选中的标签
        state.data.selectedTags.clear();
        // 添加当前二级标签
        state.data.selectedTags.add(sub.tag);
        // 更新所有主标签按钮的样式（取消高亮）
        document.querySelectorAll('.diary-tag-btn:not(.diary-sub-tag-btn)').forEach((btn2) => {
          (btn2 as HTMLElement).style.background = 'var(--background-secondary)';
          (btn2 as HTMLElement).style.color = 'var(--text-normal)';
        });
        // 更新二级标签按钮样式（当前按钮高亮，其他二级标签取消高亮）
        document.querySelectorAll('.diary-sub-tag-btn').forEach((btn2) => {
          const el = btn2 as HTMLElement;
          if (el.dataset.tag === sub.tag) {
            el.style.background = 'var(--interactive-accent)';
            el.style.color = 'var(--background-primary)';
          } else {
            el.style.background = 'var(--background-secondary)';
            el.style.color = 'var(--text-normal)';
          }
        });
      } else {
        // 已选中，则清空所有标签
        state.data.selectedTags.clear();
        // 重置所有按钮样式
        document.querySelectorAll('.diary-tag-btn').forEach((btn2) => {
          (btn2 as HTMLElement).style.background = 'var(--background-secondary)';
          (btn2 as HTMLElement).style.color = 'var(--text-normal)';
        });
      }
      applyFilterFromShared({ skipTagCountUpdate: true });
    };

    subContainer.appendChild(btn);
  }
}

export function rebuildTags() {
  const tagsContainer = document.getElementById('diary-tag-container');
  if (!tagsContainer) return;

  const currentSelectedTags = new Set(state.data.selectedTags);
  const tagsScrollContainer = document.createElement('div');
  tagsScrollContainer.className = 'diary-tags-scroll-container';

  for (const tag of Object.keys(getPrimaryTagsConfig())) {
    const count = getTagCountForPrimary(tag);
    const emoji = getTagEmoji(tag);
    const btn = createTag(tag, emoji, count); // createTag 内部会根据设置决定是否显示计数
    if (currentSelectedTags.has(tag)) {
      btn.style.background = 'var(--interactive-accent)';
      btn.style.color = 'var(--background-primary)';
    }
    tagsScrollContainer.appendChild(btn);
  }

  const oldContainer = tagsContainer.querySelector('.diary-tags-scroll-container');
  if (oldContainer) oldContainer.remove();
  tagsContainer.appendChild(tagsScrollContainer);

  refreshSubTagsBar();
}

// 辅助函数：统计主标签自身 + 所有二级标签的总条目数
function getTagCountForPrimary(primaryTag: string) {
  let count = 0;
  const subTags = getSubTagsOfPrimary(primaryTag);
  for (const entry of state.data.originalDiaryEntries) {
    if (entry.tags.includes(primaryTag)) {
      count++;
    } else if (subTags) {
      if (entry.tags.some((t) => subTags.some((sub) => sub.tag === t))) {
        count++;
      }
    }
  }
  return count;
}

// 创建单个标签按钮
export function createTag(tag: string, emoji: string, count: number | null) {
  const showCount = getShowTagCountSetting(); // 默认 true

  const button = document.createElement('button');
  button.className = 'diary-tag-btn';
  button.dataset.tag = tag;

  let countHtml = '';
  if (showCount && count !== null && count !== undefined) {
    countHtml = `<span style="margin-left:4px; font-size:10px; opacity:0.8;">(${count})</span>`;
  }
  button.innerHTML = `${emoji} ${tag} ${countHtml}`;
  button.style.cssText =
    'border-radius:10px;background:var(--background-secondary);cursor:pointer;font-size:10px;color:var(--text-normal);transition:all 0.2s;display:flex;align-items:center;flex-shrink:0;box-shadow:none;';

  const subTags = getSubTagsOfPrimary(tag);
  if (subTags && subTags.length > 0) {
    button.style.border = '1px solid var(--background-modifier-hover)';
    button.style.padding = '0 8px';
  }

  button.onmouseenter = () => !state.data.selectedTags.has(tag) && (button.style.backgroundColor = 'var(--background-modifier-hover)');
  button.onmouseleave = () => !state.data.selectedTags.has(tag) && (button.style.backgroundColor = 'var(--background-secondary)');

  button.onclick = (e) => {
    e.stopPropagation();
    if (!state.data.selectedTags.has(tag)) {
      state.data.selectedTags.clear();
      state.data.selectedTags.add(tag);
      document.querySelectorAll('.diary-tag-btn').forEach((btn) => {
        (btn as HTMLElement).style.background = 'var(--background-secondary)';
        (btn as HTMLElement).style.color = 'var(--text-normal)';
      });
      button.style.background = 'var(--interactive-accent)';
      button.style.color = 'var(--background-primary)';
    } else {
      state.data.selectedTags.delete(tag);
      button.style.background = 'var(--background-secondary)';
      button.style.color = 'var(--text-normal)';
    }
    applyFilterFromShared({ skipTagCountUpdate: true });
  };

  return button;
}

/** 更新二级标签区域的计数（在 applyFilter 后调用，原 1312-1315） */
export function updateSubTagsCounts() {
  if (!getCurrentActiveParentForSub()) return;
  refreshSubTagsBar(); // 简单重建，保持计数准确
}

/** 更新标签计数（原 914-947） */
export function updateTagCounts() {
  if (!getShowTagCountSetting()) return; // 不显示计数，跳过更新

  const tagButtons = document.querySelectorAll('.diary-tag-btn:not(.diary-sub-tag-btn)');
  if (!tagButtons.length) return;

  const countMap = new Map<string, number>();
  for (const tag of Object.keys(getPrimaryTagsConfig())) {
    countMap.set(tag, 0);
  }

  for (const entry of state.data.originalDiaryEntries) {
    for (const [tag, config] of Object.entries(getPrimaryTagsConfig())) {
      if (entry.tags.includes(tag)) {
        countMap.set(tag, countMap.get(tag)! + 1);
      } else if (config.subTags && config.subTags.length) {
        const hasSub = entry.tags.some((t) => config.subTags!.some((sub) => sub.tag === t));
        if (hasSub) {
          countMap.set(tag, countMap.get(tag)! + 1);
        }
      }
    }
  }

  for (const btn of tagButtons) {
    const tag = (btn as HTMLElement).dataset.tag;
    const count = countMap.get(tag!) || 0;
    const emoji = getTagEmoji(tag!);
    (btn as HTMLElement).innerHTML = `${emoji} ${tag} <span style="margin-left:4px; font-size:10px; opacity:0.8;">(${count})</span>`;
  }

  updateSubTagsCounts();
}

import type { DateFilter } from '../types';
import { applyFilter as applyFilterFromShared } from './entries';
