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
 *
 * 路径口径：`fileName` 是**相对 `manual/` 的路径**（可为多级，如
 * `skins/bookshelf/noir.css`）；落盘位置是**插件安装目录内的同名路径**。
 * 皮肤包（ADR-0199）复用本层，并额外用 `ensureAssetWithHash` 做 sha256 校验。
 * ============================================================ */
import { requestUrl } from 'obsidian';
import { textSha256 } from './sha256';

/** 远端 URL：主 GitHub raw → 备 jsDelivr（同仓库同路径，域名不同） */
export function remotesFor(fileName: string): string[] {
  return [
    `https://raw.githubusercontent.com/yeshimei/bz/master/manual/${fileName}`,
    `https://cdn.jsdelivr.net/gh/yeshimei/bz@master/manual/${fileName}`,
  ];
}

/** 资产在 vault 里的相对路径（= 插件安装目录内同名路径） */
export function assetVaultPath(app: unknown, fileName: string): string {
  const configDir = String((app as { vault?: { configDir?: string } }).vault?.configDir || '.obsidian');
  return `${configDir}/plugins/bz/${fileName}`;
}

/** 建目录（多级路径需要；失败静默——已存在的目录会抛，不当错误） */
async function ensureDir(app: unknown, relPath: string): Promise<void> {
  const adapter = (app as { vault?: { adapter?: { mkdir?: (p: string) => Promise<void> } } }).vault?.adapter;
  if (!adapter?.mkdir) return;
  const slash = relPath.lastIndexOf('/');
  if (slash <= 0) return;
  const dir = assetVaultPath(app, relPath.slice(0, slash));
  try {
    await adapter.mkdir(dir);
  } catch (e) {
    /* 目录已存在 / 不支持 mkdir → 由后续 write 决定成败 */
  }
}

/** 双源取文本（不落盘）；全失败抛人话错误
 *  @param unit 内容校验失败文案的后缀（手册/日志是「页」，皮肤包不是） */
export async function fetchAssetText(
  fileName: string,
  validate: (text: string) => boolean,
  label: string,
  unit = '页',
): Promise<string> {
  let lastErr = '';
  for (const url of remotesFor(fileName)) {
    try {
      const res = await requestUrl({ url, method: 'GET', throw: true });
      const text = String(res.text || '');
      if (!validate(text)) {
        lastErr = `${url} 返回内容不是${label}${unit}`;
        continue;
      }
      return text;
    } catch (e) {
      lastErr = `${url} → ${(e as Error)?.message || String(e)}`;
    }
  }
  throw new Error(`${label}下载失败：${lastErr}`);
}

/** 写资产文本（自动建目录；覆盖旧版） */
export async function writeAssetText(app: unknown, fileName: string, text: string): Promise<void> {
  await ensureDir(app, fileName);
  await (app as { vault?: { adapter?: { write?: (p: string, data: string) => Promise<void> } } })
    .vault!.adapter!.write!(assetVaultPath(app, fileName), text);
}

/**
 * 取资产文本并校验 sha256（皮肤包专用，ADR-0199）：
 * 本地已有且 hash 匹配 → 直接复用（**这就是「存在即跳过」升级后的增量判据**）；
 * 否则双源下载 → hash 不匹配视为该源不可信（换下一个源）→ 全失败抛错。
 * @param expected 期望的 64 位小写 sha256（对归一换行后的文本）
 */
export async function ensureAssetWithHash(
  app: unknown,
  fileName: string,
  expected: string,
  label: string,
): Promise<string | null> {
  const want = String(expected || '').toLowerCase();
  const cached = await readAsset(app, fileName);
  if (cached !== null && (!want || textSha256(cached) === want)) return cached;

  let lastErr = '';
  for (const url of remotesFor(fileName)) {
    try {
      const res = await requestUrl({ url, method: 'GET', throw: true });
      const text = String(res.text || '');
      if (want && textSha256(text) !== want) {
        lastErr = `${url} 内容 sha256 不匹配（可能被篡改或版本错位）`;
        continue;
      }
      await writeAssetText(app, fileName, text);
      return text;
    } catch (e) {
      lastErr = `${url} → ${(e as Error)?.message || String(e)}`;
    }
  }
  throw new Error(`${label}下载失败：${lastErr}`);
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
  const text = await fetchAssetText(fileName, validate, label, '页');
  await writeAssetText(app, fileName, text);
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
