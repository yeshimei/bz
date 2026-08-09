/**
 * UI 设置 getter/setter（独立模块：panel/filter-shared/entries/dialogs 共用，避免循环 import）。
 */
let showTagCountSetting = true;
let useFileDateTimeSetting = false;
let tagShowEmojiSetting = true;
let contentRenderModeSetting: 'markdown' | 'plain' = 'markdown';
let tagSortModeSetting: 'fixed' | 'count' = 'fixed';
let defaultDateFilterSetting: 'all' | 'this-month' = 'all';
let defaultSelectedTagSetting = '';
let jumpToEditAfterSaveSetting = true;

export function applyUiSettings(s: {
  showTagCount?: boolean;
  useFileDateTime?: boolean;
  diaryTagShowEmoji?: boolean;
  diaryContentRenderMode?: string;
  diaryTagSortMode?: string;
  diaryDefaultDateFilter?: string;
  diaryDefaultSelectedTag?: string;
  diaryJumpToEditAfterSave?: boolean;
}) {
  if (s.showTagCount !== undefined) showTagCountSetting = s.showTagCount;
  if (s.useFileDateTime !== undefined) useFileDateTimeSetting = s.useFileDateTime;
  if (s.diaryTagShowEmoji !== undefined) tagShowEmojiSetting = s.diaryTagShowEmoji;
  if (s.diaryContentRenderMode !== undefined)
    contentRenderModeSetting = s.diaryContentRenderMode === 'plain' ? 'plain' : 'markdown';
  if (s.diaryTagSortMode !== undefined)
    tagSortModeSetting = s.diaryTagSortMode === 'count' ? 'count' : 'fixed';
  if (s.diaryDefaultDateFilter !== undefined)
    defaultDateFilterSetting = s.diaryDefaultDateFilter === 'this-month' ? 'this-month' : 'all';
  if (s.diaryDefaultSelectedTag !== undefined) defaultSelectedTagSetting = s.diaryDefaultSelectedTag;
  if (s.diaryJumpToEditAfterSave !== undefined) jumpToEditAfterSaveSetting = s.diaryJumpToEditAfterSave;
}

export function getShowTagCountSetting(): boolean {
  return showTagCountSetting;
}
/** 长按手势：固定启用（设置项已移除，用户确认保持默认启用） */
export function getEnableLongPressSetting(): boolean {
  return true;
}
export function getUseFileDateTimeSetting(): boolean {
  return useFileDateTimeSetting;
}
/** 标签按钮显示 emoji（筛选栏与写日记弹窗） */
export function getTagShowEmojiSetting(): boolean {
  return tagShowEmojiSetting;
}
/** 卡片内容渲染方式：markdown / plain */
export function getContentRenderModeSetting(): 'markdown' | 'plain' {
  return contentRenderModeSetting;
}
/** 标签排序：fixed（内置配置顺序）/ count（条目数量降序） */
export function getTagSortModeSetting(): 'fixed' | 'count' {
  return tagSortModeSetting;
}
/** 打开面板默认日期筛选：all / this-month */
export function getDefaultDateFilterSetting(): 'all' | 'this-month' {
  return defaultDateFilterSetting;
}
/** 默认选中标签（空=全部） */
export function getDefaultSelectedTagSetting(): string {
  return defaultSelectedTagSetting;
}
/** 保存后立即进入编辑 */
export function getJumpToEditAfterSaveSetting(): boolean {
  return jumpToEditAfterSaveSetting;
}
