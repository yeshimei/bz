/**
 * 移动端窗口模式（ticket 68，ADR-0019）：
 * 13 个有主窗口的域按「移动端默认全屏」设置决定 ≤768px 呈现形态——
 * 开=真全屏（挂 .bz-win-mfs，覆盖整个视口、去圆角、头部避让安全区）；
 * 关=常规卡（95%/90vh 圆角卡，不挂类，走 styles.css ≤768 基规则）。
 * 仅移动端（Platform.isMobile 官方 API）生效；桌面端恒不挂类（设置项也不显示）。
 */
import { Platform } from 'obsidian';

/** 移动端判定（与入口页 isMobileEnv 同口径：obsidian Platform.isMobile） */
export function isMobileEnv(): boolean {
  return typeof Platform !== 'undefined' && !!Platform.isMobile;
}

/**
 * 按开关把主窗口 popup 设为「移动端真全屏 / 常规卡」。
 * enabled：该域「移动端默认全屏」设置值（旧 data.json 缺字段已由 DEFAULT_SETTINGS 兜底，直接取布尔）。
 * 桌面端或 enabled=false → 摘类（常规卡/原形态）。幂等，可重复调用。
 */
export function applyMobileWindowFullscreen(popup: HTMLElement | null | undefined, enabled: boolean): void {
  if (!popup) return;
  popup.classList.toggle('bz-win-mfs', isMobileEnv() && !!enabled);
}