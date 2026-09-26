/* ============================================================
 * bz · 远端单文件资产下载（core/remote-asset.ts，单源）
 *
 * 使用手册（core/manual.ts）、更新日志（core/changelog.ts）与下载清单
 * （core/download-manifest.ts）都走这一层：资产不随插件构建分发
 * （main.js 里不含它们），而是发布在 GitHub 仓库 downloads/ 目录下，
 * 写入**插件安装目录**（<configDir>/plugins/bz/）。
 *
 * 为什么放插件目录而不是数据目录：这些是程序资产、跟版本走，
 * 放数据目录会跟「数据存储路径」这个用户键纠缠。
 *
 * 下载链路：raw.githubusercontent 主 → cdn.jsdelivr 备（国内被墙时
 * 的第二通道）；两路都 404/失败才报错。内容校验由调用方给的
 * validate 判定（防把 CDN 的错误页写进文件）。
 *
 * 路径口径（ADR-0202）：`fileName` 是**相对 `downloads/` 的路径**（可为多级，
 * 如 `skins/bookshelf/noir.css`）；本地落盘是插件安装目录内的同名路径——
 * 本地即远端 downloads/ 的镜像。仓库旧 `manual/` 目录是改名前的冻结过渡副本
 * （旧版插件还在读它，内容停更，若干版本后删除）。
 *
 * 三条口径：`ensureAssetReady` 管「有没有」——无则下载、有则直接用；
 * `refreshAsset` 管「新不新」——入口先本地秒开，再后台核对一次，远端真变了才覆盖；
 * `ensureAssetWithHash` 管「信不信」——下载内容 sha256 对不上清单声明就拒收。
 * ============================================================ */
import { requestUrl } from 'obsidian';
import { textSha256 } from './sha256';

/** 远端 URL：主 GitHub raw → 备 jsDelivr（同仓库同路径，域名不同） */
export function remotesFor(fileName: string): string[] {
  return [
    `https://raw.githubusercontent.com/yeshimei/bz/master/downloads/${fileName}`,
    `https://cdn.jsdelivr.net/gh/yeshimei/bz@master/downloads/${fileName}`,
  ];
}

/** 资产在 vault 里的相对路径（= 插件安装目录内同名路径） */
export function assetVaultPath(app: unknown, fileName: string): string {
  const configDir = String((app as { vault?: { configDir?: string } }).vault?.configDir || '.obsidian');
  return `${configDir}/plugins/bz/${fileName}`;
}

/**
 * 建目录（**逐级**；失败静默）。
 * 逐级的理由：皮肤包落在 `skins/<域>/<id>.css`——`skins/` 在全新安装时并不存在，
 * 而 Obsidian `adapter.mkdir` 未文档化「递归建父级」，单次 `mkdir('skins/bookshelf')`
 * 在非递归实现下会直接失败 → write 失败 → 远端皮肤永久静默回落首套（功能全失效）。
 * 逐级 try/catch 幂等：目录已存在抛错也无所谓，最终由 write 决定成败。
 */
async function ensureDir(app: unknown, relPath: string): Promise<void> {
  const adapter = (app as { vault?: { adapter?: { mkdir?: (p: string) => Promise<void> } } }).vault?.adapter;
  if (!adapter?.mkdir) return;
  const slash = relPath.lastIndexOf('/');
  if (slash <= 0) return;
  let cur = '';
  for (const part of relPath.slice(0, slash).split('/')) {
    cur = cur ? `${cur}/${part}` : part;
    try {
      await adapter.mkdir(assetVaultPath(app, cur));
    } catch (e) {
      /* 已存在 / 不支持 mkdir → 继续下一级 */
    }
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

/**
 * 新鲜度核对（issue 476）：远端内容与本地不同 → 覆盖落盘并返回新文本；否则 null。
 *
 * 与 `ensureAssetReady` 的分工：那个管**有没有**（无则下载），本函数管**新不新**
 * （有则核对）。入口口径 = 先 `ensureAssetReady` 本地秒开，再后台调本函数：
 * 远端推了新文档（重新生成 manual/*.html 并 push，插件版本没动）时，
 * 靠这一层才能发现——否则「存在即用」会让线上新版永远进不来。
 *
 * **全程静默**：同版 → null；离线 / 被墙 / 内容可疑 → null（保持本地已存版本，
 * 不给用户任何通知与转圈——它是后台动作，失败不是用户的操作失败）。
 *
 * 比对用 sha256 且先过 `normalizeEol`（`textSha256` 内建）：Windows 本地 CRLF
 * 与仓库 LF 不会被误判成新版而触发一次无意义的重写。
 *
 * `expectedSha256`（ADR-0202 省流增补）：调用方从缓存下载清单取该文件的清单 hash
 * 传入——本地内容与之相等即「清单确认无新版」，**直接返回 null 跳过远端拉取**
 * （手册 327KB 不必每次打开都白拉）。清单缺席（null/空串）回落全量拉取对比，行为只省不破。
 *
 * @returns 新版文本（调用方据此决定是否热替换已打开的弹窗）；同版或失败 → null
 */
export async function refreshAsset(
  app: unknown,
  fileName: string,
  validate: (text: string) => boolean,
  label: string,
  expectedSha256?: string | null,
): Promise<string | null> {
  try {
    const want = String(expectedSha256 || '').toLowerCase();
    if (want) {
      const local = await readAsset(app, fileName);
      if (local !== null && textSha256(local) === want) return null;
    }
    const text = await fetchAssetText(fileName, validate, label, '页');
    const local = await readAsset(app, fileName);
    if (local !== null && textSha256(text) === textSha256(local)) return null;
    await writeAssetText(app, fileName, text);
    return text;
  } catch (e) {
    return null;
  }
}
