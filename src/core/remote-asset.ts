/* ============================================================
 * bz · 远端单文件资产下载（core/remote-asset.ts，单源）
 *
 * 使用手册（core/manual.ts）与更新日志（core/changelog.ts）都走这一层：
 * 资产不随插件构建分发（main.js 里不含它们），而是发布在 GitHub 仓库
 * manual/ 目录下，用户点入口时现场拉取，写入**插件安装目录**
 * （<configDir>/plugins/bz/）。
 *
 * 为什么放插件目录而不是数据目录：这些是程序资产、跟版本走，
 * 放数据目录会跟「数据存储路径」这个用户键纠缠。
 *
 * 下载链路：raw.githubusercontent 主 → cdn.jsdelivr 备（国内被墙时
 * 的第二通道）；两路都 404/失败才报错。内容校验由调用方给的
 * validate 判定（防把 CDN 的错误页写进文件）。
 * ============================================================ */
import { requestUrl } from 'obsidian';

/** 远端清单：主 GitHub raw → 备 jsDelivr（同仓库同路径，域名不同） */
export function remotesFor(fileName: string): string[] {
  return [
    `https://raw.githubusercontent.com/yeshimei/bz/master/manual/${fileName}`,
    `https://cdn.jsdelivr.net/gh/yeshimei/bz@master/manual/${fileName}`,
  ];
}

/** 资产在 vault 里的相对路径（= 插件安装目录内） */
export function assetVaultPath(app: unknown, fileName: string): string {
  const configDir = String((app as { vault?: { configDir?: string } }).vault?.configDir || '.obsidian');
  return `${configDir}/plugins/bz/${fileName}`;
}

/** 资产是否已经下载到插件目录 */
export async function hasAsset(app: unknown, fileName: string): Promise<boolean> {
  try {
    return await (app as { vault?: { adapter?: { exists?: (p: string) => Promise<boolean> } } })
      .vault!.adapter!.exists!(assetVaultPath(app, fileName));
  } catch (e) {
    return false;
  }
}

/**
 * 从 GitHub 下载资产并写入插件安装目录（覆盖旧版）。
 * @param validate 内容可信判定（false = 该远端内容可疑，换下一个）
 * @param label    错误消息里的资产名（人话，如「手册」「更新日志」）
 * 全部远端失败/内容不可信 → 抛错（人话消息，含最后失败原因），调用方弹通知。
 */
export async function downloadAsset(
  app: unknown,
  fileName: string,
  validate: (text: string) => boolean,
  label: string,
): Promise<void> {
  let lastErr = '';
  for (const url of remotesFor(fileName)) {
    try {
      const res = await requestUrl({ url, method: 'GET', throw: true });
      const text = String(res.text || '');
      if (!validate(text)) {
        lastErr = `${url} 返回内容不是${label}页`;
        continue;
      }
      await (app as { vault?: { adapter?: { write?: (p: string, data: string) => Promise<void> } } })
        .vault!.adapter!.write!(assetVaultPath(app, fileName), text);
      return;
    } catch (e) {
      lastErr = `${url} → ${(e as Error)?.message || String(e)}`;
    }
  }
  throw new Error(`${label}下载失败：${lastErr}`);
}

/** 读已下载的资产文本；未下载/读失败 → null（调用方决定引导下载） */
export async function readAsset(app: unknown, fileName: string): Promise<string | null> {
  try {
    if (!(await hasAsset(app, fileName))) return null;
    return await (app as { vault?: { adapter?: { read?: (p: string) => Promise<string> } } })
      .vault!.adapter!.read!(assetVaultPath(app, fileName));
  } catch (e) {
    return null;
  }
}

/**
 * 确保资产在本地并返回文本（入口一键口径）：
 * 本地没有 → 从 GitHub 下载；然后读出文本交给弹窗层内嵌渲染。
 * 下载失败抛人话 Error；本地读取异常视同未下载走重下（自愈陈旧半截文件）。
 */
export async function ensureAssetReady(
  app: unknown,
  fileName: string,
  validate: (text: string) => boolean,
  label: string,
): Promise<string> {
  let text = await readAsset(app, fileName);
  if (!text) {
    await downloadAsset(app, fileName, validate, label);
    text = await readAsset(app, fileName);
  }
  if (!text) throw new Error(`${label}下载后读取失败：插件目录写入异常`);
  return text;
}
