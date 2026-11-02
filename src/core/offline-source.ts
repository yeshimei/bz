/* ============================================================
 * bz · 离线资源与自定义镜像（core/offline-source.ts）
 *
 * 存在的理由：企业网 / 无外网环境里，GitHub 与码云可能**全部**不通。
 * 那时插件不缺功能，缺的是「路」—— 而这条路不能只有「请你改系统代理」一句话。
 *
 * 两条出路：
 *
 * 1. **离线包**：把仓库的 `downloads/` 目录（以及便携 Node 的 zip）拷进 vault 根下的
 *    `bz-offline/`，插件优先从磁盘取，一个字节都不联网：
 *
 *    ```
 *    <vault>/bz-offline/
 *      downloads/manifest.json          ← 清单（必需，决定要下什么、校验值是多少）
 *      downloads/changelog.html         ← 各类文档
 *      downloads/tools/*.tar.gz         ← 三个工具包
 *      downloads/skins/...              ← 皮肤
 *      node/node-v24.14.1-win-x64.zip   ← 便携 Node（可选）
 *    ```
 *
 * 2. **自定义镜像**：把内网镜像的基址填进「设置 → 通用 → 在线资源 → 镜像源」，下载时优先走它。
 *    地址形状与仓库一致（`<基址>/downloads/xxx`），这样自建一个 nginx 静态目录就能用。
 *
 * 离线包为什么排在网络之前：能放到本地的只有用户自己，他是明确的意图表达；
 * 网络那条路上则有个「CDN 缓存了旧版本」的坑。本地文件反而更可信——而且 hash 校验
 * 依然会做，对不上就当没有。
 * ============================================================ */
import { vaultBasePathOf } from './plugin-path';

/** 离线包目录名（vault 根下） */
export const OFFLINE_DIR = 'bz-offline';

/** 离线包在磁盘上的绝对路径（拿不到 vault 路径 → 空串） */
export function offlineRootOf(app: unknown): string {
  const base = vaultBasePathOf(app);
  return base ? `${base}/${OFFLINE_DIR}` : '';
}

/** 离线包内某文件的绝对路径（`rel` 相对 `bz-offline/`） */
export function offlineFileOf(app: unknown, rel: string): string {
  const root = offlineRootOf(app);
  if (!root) return '';
  return `${root}/${String(rel || '').replace(/^[\\/]+/, '')}`;
}

/** 下载类资源在离线包里的路径（`file` 相对 `downloads/`，与远端严格同构） */
export function offlineDownloadsFileOf(app: unknown, file: string): string {
  return offlineFileOf(app, `downloads/${String(file || '').replace(/^[\\/]+/, '')}`);
}

function nodeRequire(name: string): any {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  try {
    return w?.require?.(name) ?? null;
  } catch {
    return null;
  }
}

/**
 * 从离线包读字节。
 *
 * 走真实文件系统的 `fs` 而不是 vault adapter：离线包在 vault 里，但 adapter 会按 vault
 * 索引判定（Obsidian 会不会索引 `bz-offline/` 取决于用户配置），而 `fs` 只看文件在不在。
 * 返回值：读不到 → null（不抛；离线包本来就可能不存在）。
 */
export async function readOfflineBytes(app: unknown, rel: string): Promise<Uint8Array | null> {
  const abs = offlineFileOf(app, rel);
  if (!abs) return null;
  const fs = nodeRequire('fs');
  if (!fs?.readFileSync) return null;
  try {
    if (fs.existsSync && !fs.existsSync(abs)) return null;
    const buf = fs.readFileSync(abs);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch {
    return null;
  }
}

/** 从离线包读文本（读不到 → null） */
export async function readOfflineText(app: unknown, rel: string): Promise<string | null> {
  const bytes = await readOfflineBytes(app, rel);
  if (!bytes) return null;
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return null;
  }
}

/** 离线包在不在（判定「要不要在提示里提一嘴」） */
export function hasOfflinePack(app: unknown): boolean {
  const fs = nodeRequire('fs');
  const root = offlineRootOf(app);
  if (!fs?.existsSync || !root) return false;
  try {
    return !!fs.existsSync(root);
  } catch {
    return false;
  }
}
