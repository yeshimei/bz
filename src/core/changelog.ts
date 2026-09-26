/* ============================================================
 * bz · 更新日志下载（core/changelog.ts，单源）
 *
 * 与使用手册同一套口径（issue 474 拍板）：更新日志不随插件构建分发
 * （main.js 里不含它，旧产物 src/settings-panel/changelog-data.ts 已退役），
 * 而是发布在 GitHub 仓库 manual/bz-changelog.html（scripts/_gen-changelog.mjs
 * 从 git 提交历史生成、单文件自包含）；用户点「更新日志」按钮时现场拉取，
 * 写入插件安装目录（<configDir>/plugins/bz/），弹窗层用 iframe srcdoc 内嵌渲染。
 *
 * 下载/校验/落盘/自愈整条链在 core/remote-asset.ts（与手册共用），
 * 本文件只钉更新日志的文件名与内容口径。
 *
 * 失败不兜底（用户拍板）：断网/被墙时下载失败即弹通知说明原因，不退回内置快照
 * ——内置快照会让「日志随发版更新」这件事悄悄失效，混着旧数据更难排查。
 * ============================================================ */
import { assetVaultPath, ensureAssetReady } from './remote-asset';

/** 更新日志文件名（写入插件目录时用；ASCII，避免转义麻烦） */
export const CHANGELOG_FILENAME = 'bz-changelog.html';

/** 更新日志在 vault 里的相对路径（= 插件安装目录内） */
export function changelogVaultPath(app: unknown): string {
  return assetVaultPath(app, CHANGELOG_FILENAME);
}

/** 内容是否像更新日志页（HTML 文档头 + 版本数据锚点，防 CDN 错误页/半截文件） */
function looksLikeChangelog(text: string): boolean {
  const t = String(text || '');
  return (/<!DOCTYPE/i.test(t) || /<html/i.test(t)) && t.includes('const DATA =');
}

/**
 * 确保更新日志在本地并返回 HTML 文本（footer 入口一键口径）：
 * 本地没有 → 从 GitHub 下载 → 再读；本地读取异常视同未下载走重下。
 * 失败抛人话 Error（含远端 URL 与失败明细），调用方弹通知且不打开弹窗。
 */
export function ensureChangelogReady(app: unknown): Promise<string> {
  return ensureAssetReady(app, CHANGELOG_FILENAME, looksLikeChangelog, '更新日志');
}
