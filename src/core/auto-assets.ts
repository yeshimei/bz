/* ============================================================
 * bz · 启动后台自动更新（core/auto-assets.ts）
 *
 * 开关 `autoUpdate` 打开时，启动链把**所有在线依赖**按固定顺序补齐
 * （2026-11-01 用户拍板改口径：此前只补三个工具包）：
 *
 *   ① 更新日志（13 KB）—— 更新完插件重载，首屏就可能要看它
 *   ② 外部工具包（bili-downloader / dock-watch / obsidian-face）—— 缺了功能直接是坏的
 *   ③ 其余在线资源（使用手册、归物分类表、RSS 源库、豆瓣影视索引）—— 用到才翻
 *   ④ 皮肤（逐文件或整包）
 *
 * 插件本体不在这里：它由 core/self-update.ts 在同一趟启动链里更早跑完
 * （皮肤版本区间校验吃 manifest 版本号，所以本体必须在前，见 main.ts 的 after）。
 *
 * 三条约束：
 *  - **只有开关打开才动手**（`autoUpdate`）。关着时这里一个字节都不下。
 *  - **不节流**（2026-11-01 用户拍板）：每次启动都核对一遍。所有条目都走
 *    「本地 sha256 对上就跳过」，所以常态是一次清单请求 + 几次本地读，不会重复下载。
 *  - **失败一律静默**：单项失败不牵连其余；失败项留到下次启动，状态由设置面板自己呈。
 * ============================================================ */
import { notice } from './notice';
import { tryGetSettings } from './settings-provider';
import { docStatus, refreshManifest, type DownloadManifest, type ManifestDocEntry } from './download-manifest';
import { bundleStatus, installBundle } from './bundle-asset';
import { isMobileEnv } from './mobile';
import { ensureAssetWithHash } from './remote-asset';
import { CHANGELOG_FILENAME } from './changelog';
import { downloadSkinUpdates, isInVersionRange, readPluginVersion, skinStatus } from './skin-pack';

/** 自动更新结果（面板/测试读它；生产只用来决定要不要发通知） */
export interface AutoAssetResult {
  /** 本次是否因开关关闭 / 移动端而整段跳过 */
  skipped: boolean;
  /** 实际装好并落盘的条目数 */
  done: number;
  /** 失败条目数（本地已有的不动，下次再试） */
  failed: number;
  /** 本次判定「需要动手」的条目数（done + failed） */
  pending: number;
}

/** 同一次启动里并发调用（启动链 + 面板显式动作）只跑一遍，后到的复用前一次的结果 */
let inFlight: Promise<AutoAssetResult> | null = null;

/**
 * 把清单里「缺的 / 不是最新」的在线依赖按 日志 → 工具包 → 其余资源 → 皮肤 的顺序补齐。
 *
 * @param manifest 本次启动已拉的清单；不传则自己拉（独立调用/测试）
 */
export function autoUpdateAssets(app: unknown, manifest?: DownloadManifest | null): Promise<AutoAssetResult> {
  if (inFlight) return inFlight;
  const run = runAutoUpdateAssets(app, manifest).finally(() => {
    inFlight = null;
  });
  inFlight = run;
  return run;
}

async function runAutoUpdateAssets(
  app: unknown,
  manifest: DownloadManifest | null | undefined,
): Promise<AutoAssetResult> {
  const empty: AutoAssetResult = { skipped: true, done: 0, failed: 0, pending: 0 };
  if (tryGetSettings()?.autoUpdate !== true) return empty;
  // 移动端没有 Node：工具包（ffmpeg / python / whisper）下下来也 exec 不了，纯占空间。
  // 在线资源同样按「桌面端功能」对待——移动端不在这里下，用户点开时按需走。
  if (isMobileEnv()) return empty;

  let mf = manifest ?? null;
  if (!mf) {
    try {
      mf = (await refreshManifest(app)).manifest;
    } catch (e) {
      console.warn('[bz] 自动更新：资源清单拉取失败（已静默）:', (e as Error)?.message || e);
      return empty;
    }
  }
  if (!mf) return empty;

  let done = 0;
  let failed = 0;
  let pending = 0;
  const warn = (name: string, e: unknown) =>
    console.warn(`[bz] 自动更新：「${name}」失败（已静默）:`, (e as Error)?.message || e);

  // 单文件资源：本地 hash 对得上就不动手（`docStatus` 只读一次本地文件）
  const syncDoc = async (entry: ManifestDocEntry): Promise<void> => {
    if ((await docStatus(app, entry)) === 'ready') return;
    pending++;
    try {
      await ensureAssetWithHash(app, entry.file, entry.sha256, entry.name, entry.size);
      done++;
    } catch (e) {
      failed++;
      warn(entry.name, e);
    }
  };

  // 目录包：就绪判据是解包目录里的标记（不是文件 hash）
  const syncBundle = async (entry: ManifestDocEntry): Promise<void> => {
    if ((await bundleStatus(app, entry)) === 'ready') return;
    pending++;
    try {
      await installBundle(app, entry);
      done++;
    } catch (e) {
      failed++;
      warn(entry.name, e);
    }
  };

  // 版本区间外（旧版插件看到「需要更新版插件」的资源）不下载、不计数
  const version = await readPluginVersion(app);
  const docs = mf.docs.filter((d) => !version || isInVersionRange(d, version));

  const changelog = docs.find((d) => d.kind !== 'bundle' && d.file === CHANGELOG_FILENAME);
  const bundles = docs.filter((d) => d.kind === 'bundle');
  const others = docs.filter((d) => d.kind !== 'bundle' && d !== changelog);

  if (changelog) await syncDoc(changelog);
  for (const entry of bundles) await syncBundle(entry);
  for (const entry of others) await syncDoc(entry);

  // 皮肤：缺的 / 过期的套数由清单实测决定；下载完 `downloadSkinUpdates` 自己注入
  if (mf.skins.length) {
    const st = await skinStatus(app, mf);
    if (st.missing + st.updated > 0) {
      pending++;
      try {
        const r = await downloadSkinUpdates(app, mf);
        if (r.failed > 0) {
          failed++;
          warn('皮肤', new Error(`${r.failed} 套下载失败`));
        } else {
          done++;
        }
      } catch (e) {
        failed++;
        warn('皮肤', e);
      }
    }
  }

  // 说一句（只在真装了东西时说；失败留给下次启动）
  if (done > 0) notice(`已自动更新 ${done} 项资源，相关功能即刻可用`, 'success');
  return { skipped: false, done, failed, pending };
}
