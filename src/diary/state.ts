/**
 * 全局状态（原脚本 1-31 行 state 对象，按域分组）
 * 以及原 window.diaryDataMap 等模块级数据。
 */
import type { DateFilter, DiaryEntry } from './types';

export const state = {
  ui: {
    tagFilterPopup: null as HTMLElement | null,
    maskLayer: null as HTMLElement | null,
    entriesContainer: null as HTMLElement | null,
    scrollContainer: null as HTMLElement | null,
    isTouchDevice: false,
    editingEntryId: null as string | null,
    isPopupShown: false,
    singleSelectedTagForDisplay: null as string | null,
  },
  data: {
    selectedTags: new Set<string>(),
    originalDiaryEntries: [] as DiaryEntry[],
    currentFilteredEntries: [] as DiaryEntry[],
    currentDisplayCount: 0,
    isLoadingMore: false,
    currentDateFilter: null as DateFilter | null,
    currentSearchKeyword: '',
    searchDebounceTimer: null as ReturnType<typeof setTimeout> | null,
    isLoadingData: false,
  },
  events: {
    fileModifyHandler: null as ((file: any) => void) | null,
    isInternalUpdate: false,
    fileListenerAttached: false,
  },
};

/**
 * 日期 → 条目数组 的内存映射（原 window.diaryDataMap）。
 * 保存时先更新映射再整体写回文件；加密条目保留在映射中但不在列表显示。
 */
export let diaryDataMap: Map<string, DiaryEntry[]> | null = null;

export function setDiaryDataMap(map: Map<string, DiaryEntry[]> | null) {
  diaryDataMap = map;
}

/** 当前选中二级标签需要显示的主标签（原 currentActiveParentForSub） */
export let currentActiveParentForSub: string | null = null;
export function setCurrentActiveParentForSub(tag: string | null) {
  currentActiveParentForSub = tag;
}
export function getCurrentActiveParentForSub(): string | null {
  return currentActiveParentForSub;
}
