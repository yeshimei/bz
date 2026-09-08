/** 移动端判定（与入口页 isMobileEnv 同口径：obsidian Platform.isMobile） */
import { Platform } from 'obsidian';

export function isMobileEnv(): boolean {
  return typeof Platform !== 'undefined' && !!Platform.isMobile;
}
