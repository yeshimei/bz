/* ============================================================
 * bz · 使用手册下载（core/manual.ts，单源）
 *
 * 手册不随插件构建分发（main.js/styles.css 不含它），而是发布在
 * GitHub 仓库 docs/manual/bz-manual.html；用户点「使用手册」按钮时
 * 现场拉取，写入**插件安装目录**（<configDir>/plugins/bz/），再打开。
 *
 * 为什么放插件目录而不是数据目录：手册是程序资产、跟版本走，
 * 放数据目录会跟「数据存储路径」这个用户键纠缠。
 *
 * 下载链路：raw.githubusercontent 主 → cdn.jsdelivr 备（国内被墙时
 * 的第二通道）；两路都 404/失败才报错。内容校验取最宽口径（<!DOCTYPE
 * 或 <html 或含「包仔」），防把 CDN 的错误页写进文件。
 * 打开：绝对路径 file:/// URL 走 core openExternalUrl 单源
 * （app.openUrl → electron shell → window.open 三级兜底，utils.ts）。
 * ============================================================ */
import { requestUrl } from 'obsidian';
import { notice } from './notice';
import { openExternalUrl } from './utils';

/** 手册文件名（写入插件目录时用；ASCII，避免 file:/// 转义麻烦） */
export const MANUAL_FILENAME = 'bz-manual.html';

/** 手册远端清单：主 GitHub raw → 备 jsDelivr（同仓库同路径，域名不同）。
 *  路径 = 仓库根 manual/（docs/ 不上 GitHub，别挪回去）。 */
const MANUAL_REMOTES = [
  'https://raw.githubusercontent.com/yeshimei/bz/master/manual/bz-manual.html',
  'https://cdn.jsdelivr.net/gh/yeshimei/bz@master/manual/bz-manual.html',
];

/** 手册在 vault 里的相对路径（= 插件安装目录内） */
export function manualVaultPath(app: unknown): string {
  const configDir = String((app as { vault?: { configDir?: string } }).vault?.configDir || '.obsidian');
  return `${configDir}/plugins/bz/${MANUAL_FILENAME}`;
}

/** 手册是否已经下载到插件目录 */
export async function hasManual(app: unknown): Promise<boolean> {
  try {
    const p = manualVaultPath(app);
    return await (app as { vault?: { adapter?: { exists?: (p: string) => Promise<boolean> } } })
      .vault!.adapter!.exists!(p);
  } catch (e) {
    return false;
  }
}

/** 手册绝对路径（桌面端 FileSystemAdapter 有 getFullPath；取不到返回 null） */
function manualAbsPath(app: unknown): string | null {
  try {
    const adapter = (app as { vault?: { adapter?: { getFullPath?: (p: string) => string } } }).vault?.adapter;
    return adapter?.getFullPath ? adapter.getFullPath(manualVaultPath(app)) : null;
  } catch (e) {
    return null;
  }
}

/** 内容是否像手册页（最宽校验：HTML 文档头或含产品名即可，防 CDN 错误页） */
function looksLikeManual(text: string): boolean {
  const t = String(text || '');
  return /<!DOCTYPE/i.test(t) || /<html/i.test(t) || t.includes('包仔');
}

/**
 * 从 GitHub 下载手册，写入插件安装目录（覆盖旧版）。
 * 全部远端失败/内容不可信 → 抛错（人话消息，含最后失败原因），调用方弹通知。
 */
export async function downloadManual(app: unknown): Promise<void> {
  let lastErr = '';
  for (const url of MANUAL_REMOTES) {
    try {
      const res = await requestUrl({ url, method: 'GET', throw: true });
      const text = String(res.text || '');
      if (!looksLikeManual(text)) {
        lastErr = `${url} 返回内容不是手册页`;
        continue;
      }
      await (app as { vault?: { adapter?: { write?: (p: string, data: string) => Promise<void> } } })
        .vault!.adapter!.write!(manualVaultPath(app), text);
      return;
    } catch (e) {
      lastErr = `${url} → ${(e as Error)?.message || String(e)}`;
    }
  }
  throw new Error(`手册下载失败：${lastErr}`);
}

/** 打开已下载的手册（系统浏览器）。未下载 → 提示去下载；取不到绝对路径 → 提示路径。 */
export function openManual(app: unknown): void {
  const abs = manualAbsPath(app);
  if (!abs) {
    notice(`手册已存放在插件目录：${manualVaultPath(app)}`, 'info');
    return;
  }
  openExternalUrl(app, `file:///${abs.replace(/\\/g, '/')}`);
}
