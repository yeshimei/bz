/**
 * UI 设置 getter/setter（独立模块：panel/filter-shared/entries/dialogs 共用，避免循环 import）。
 */
let showTagCountSetting = true;
let useFileDateTimeSetting = false;

export function applyUiSettings(s: {
  showTagCount?: boolean;
  useFileDateTime?: boolean;
}) {
  if (s.showTagCount !== undefined) showTagCountSetting = s.showTagCount;
  if (s.useFileDateTime !== undefined) useFileDateTimeSetting = s.useFileDateTime;
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
