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
 * （issue 476 补：本地已有版本时，入口先秒开本地版，再后台 refreshChangelog 核对
 * 远端有没有新重出的日志——插件版本没动、日志单独重出推送时靠这层拿到新版。）
 * ============================================================ */
import { downloadsVaultPath, ensureAssetReady, refreshAsset } from './remote-asset';
import { cachedSha256For } from './download-manifest';

/** 更新日志文件名（写入插件目录时用；ASCII，避免转义麻烦） */
export const CHANGELOG_FILENAME = 'bz-changelog.html';

/** 更新日志在 vault 里的相对路径（= 插件安装目录内） */
export function changelogVaultPath(app: unknown): string {
  return downloadsVaultPath(app, CHANGELOG_FILENAME);
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

/**
 * 后台核对更新日志是否有新版（issue 476）：远端与本地同版 → null（不动）；
 * 有新版 → 覆盖落盘并返回新文本；离线/失败 → null（静默，保持本地已存版本）。
 * 入口口径 = ensureChangelogReady 先本地秒开，再调本函数后台核对一遍
 * ——日志重出推上 GitHub 而插件版本没动时，靠这层才能拿到新版。
 * ADR-0203 省流：缓存下载清单里日志的 sha256 与本地一致 → 清单确认无新版，
 * 直接跳过远端拉取；清单缺席回落全量核对。
 */
export async function refreshChangelog(app: unknown): Promise<string | null> {
  return refreshAsset(app, CHANGELOG_FILENAME, looksLikeChangelog, '更新日志', await cachedSha256For(app, CHANGELOG_FILENAME));
}
