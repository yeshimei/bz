/* ============================================================
 * bz · 使用手册下载（core/manual.ts，单源）
 *
 * 手册不随插件构建分发（main.js/styles.css 不含它），而是发布在
 * GitHub 仓库 manual/bz-manual.html；用户点「使用手册」按钮时
 * 现场拉取，写入插件安装目录（<configDir>/plugins/bz/）。
 *
 * 下载/校验/落盘/自愈整条链在 core/remote-asset.ts（与更新日志共用），
 * 本文件只钉手册的文件名与内容口径。
 *
 * 打开（issue 473 二次拍板）：**在 Obsidian 内独立弹窗打开**——
 * ensureManualReady 确保手册在本地并返回文本，弹窗层（settings-panel
 * manual-viewer）用 iframe srcdoc 内嵌渲染（单文件自包含，
 * 不走 file:// 免系统开程序与路径转义整条坑链；原 shell.openPath /
 * openExternalUrl file:/// 方案随「0x2 找不到文件」报障一并退役）。
 * ============================================================ */
import {
  assetVaultPath,
  downloadAsset,
  ensureAssetReady,
  hasAsset,
  readAsset,
} from './remote-asset';

/** 手册文件名（写入插件目录时用；ASCII，避免 file:/// 转义麻烦） */
export const MANUAL_FILENAME = 'bz-manual.html';

/** 手册在 vault 里的相对路径（= 插件安装目录内） */
export function manualVaultPath(app: unknown): string {
  return assetVaultPath(app, MANUAL_FILENAME);
}

/** 内容是否像手册页（最宽校验：HTML 文档头或含产品名即可，防 CDN 错误页） */
function looksLikeManual(text: string): boolean {
  const t = String(text || '');
  return /<!DOCTYPE/i.test(t) || /<html/i.test(t) || t.includes('包仔');
}

/** 手册是否已经下载到插件目录 */
export function hasManual(app: unknown): Promise<boolean> {
  return hasAsset(app, MANUAL_FILENAME);
}

/** 从 GitHub 下载手册，写入插件安装目录（覆盖旧版）；全败抛人话 Error */
export function downloadManual(app: unknown): Promise<void> {
  return downloadAsset(app, MANUAL_FILENAME, looksLikeManual, '手册');
}

/** 读已下载的手册文本；未下载/读失败 → null（调用方决定引导下载） */
export function readManual(app: unknown): Promise<string | null> {
  return readAsset(app, MANUAL_FILENAME);
}

/**
 * 确保手册在本地并返回文本（footer 入口一键口径，issue 473）：
 * 本地没有 → 从 GitHub 下载；然后读出 HTML 交给弹窗层内嵌渲染。
 * 下载失败抛人话 Error；本地读取异常视同未下载走重下（自愈陈旧半截文件）。
 */
export function ensureManualReady(app: unknown): Promise<string> {
  return ensureAssetReady(app, MANUAL_FILENAME, looksLikeManual, '手册');
}
