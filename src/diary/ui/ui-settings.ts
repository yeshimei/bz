/**
 * UI 设置 getter/setter（独立模块：panel/filter-shared/entries/dialogs 共用，避免循环 import）。
 */
let showTagCountSetting = true;
let enableLongPressSetting = true;
let defaultTagSetting = '日记';
let useFileDateTimeSetting = false;

export function applyUiSettings(s: {
  showTagCount?: boolean;
  enableLongPress?: boolean;
  defaultTag?: string;
  useFileDateTime?: boolean;
}) {
  if (s.showTagCount !== undefined) showTagCountSetting = s.showTagCount;
  if (s.enableLongPress !== undefined) enableLongPressSetting = s.enableLongPress;
  if (s.defaultTag !== undefined) defaultTagSetting = s.defaultTag;
  if (s.useFileDateTime !== undefined) useFileDateTimeSetting = s.useFileDateTime;
}

export function getShowTagCountSetting(): boolean {
  return showTagCountSetting;
}
export function getEnableLongPressSetting(): boolean {
  return enableLongPressSetting;
}
export function getDefaultTagSetting(): string {
  return defaultTagSetting;
}
export function getUseFileDateTimeSetting(): boolean {
  return useFileDateTimeSetting;
}
