/**
 * UI 设置 getter/setter（独立模块：panel/filter-shared/entries/dialogs 共用，避免循环 import）。
 */
let showTagCountSetting = true;
let enableLongPressSetting = true;
let useFileDateTimeSetting = false;

export function applyUiSettings(s: {
  showTagCount?: boolean;
  enableLongPress?: boolean;
  useFileDateTime?: boolean;
}) {
  if (s.showTagCount !== undefined) showTagCountSetting = s.showTagCount;
  if (s.enableLongPress !== undefined) enableLongPressSetting = s.enableLongPress;
  if (s.useFileDateTime !== undefined) useFileDateTimeSetting = s.useFileDateTime;
}

export function getShowTagCountSetting(): boolean {
  return showTagCountSetting;
}
export function getEnableLongPressSetting(): boolean {
  return enableLongPressSetting;
}
/** 默认标签固定为「日记」（设置项已移除） */
export function getDefaultTagSetting(): string {
  return '日记';
}
export function getUseFileDateTimeSetting(): boolean {
  return useFileDateTimeSetting;
}
