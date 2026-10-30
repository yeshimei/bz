/* ============================================================
 * bz · 启动后台自动更新「外部工具包」（core/auto-assets.ts）
 *
 * 与 core/self-update.ts 分工：
 *  - self-update 管**插件本体**（releases/<tag>/ 三件套）；
 *  - 本模块只管 `downloads/tools/*.tar.gz` 这几个**外部工具目录包**（bili-downloader /
 *    dock-watch / obsidian-face）。
 *
 * **在线资源（手册、更新日志、各类索引与数据表、皮肤）不在这里自动下**（2026-10-31 用户拍板）：
 * 那些是「用到才需要」的东西，一次性拉 10MB 里 9.7MB 都是两个索引（豆瓣索引 7.16MB、
 * RSS 目录 1.91MB），首启静默下几分钟、慢链还会超时失败。它们仍在设置 → 通用 → 在线资源
 * 里按需下载，失败态与重试入口也在那里。工具包不同：它们是**功能依赖**——用户在设置里装了
 * 「B站下载」或工具坞值守，缺了包那几个功能就是坏的，所以跟着本体一起自动补齐。
 *
 * 三条约束：
 *  - **只有开关打开才动手**（`autoUpdate`）。关着时这里一个字节都不下。
 *  - **清单取一次，全程复用**：启动链已经拉过一份 manifest，这里接着用，不为同一次启动拉第二遍。
 *  - **失败一律静默**：启动期网络问题不该弹脸；失败项留到下次启动，或由设置面板自己呈状态。
 *
 * 节流 24h（与 self-update 同口径）：逐文件 sha256 要读本地文件，每次启动都做一遍不值当；
 * 新装的用户首次启动那次本来就没有标记，照跑。
 * ============================================================ */
import { notice } from './notice';
import { tryGetSettings } from './settings-provider';
import { refreshManifest, type DownloadManifest } from './download-manifest';
import { bundleStatus, installBundle } from './bundle-asset';
import { isMobileEnv } from './mobile';

/** 最近一次自动更新时刻（localStorage；跨重启） */
const LAST_RUN_KEY = 'bz-auto-assets:last-run';
/** 节流窗：24 小时（与自更新巡检同期） */
const THROTTLE_MS = 24 * 3600 * 1000;

/** 自动更新结果（面板/测试读它；生产只用来决定要不要发通知） */
export interface AutoAssetResult {
  /** 本次是否因节流/开关关闭而整段跳过 */
  skipped: boolean;
  /** 实际安装成功并落盘的工具包数 */
  done: number;
  /** 失败项目数（本地已有的不动，下次再试） */
  failed: number;
  /** 本次检查覆盖的待办项目数（done + failed） */
  pending: number;
}

function readLastRun(): number {
  try {
    return Number(window.localStorage.getItem(LAST_RUN_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function writeLastRun(at: number): void {
  try {
    window.localStorage.setItem(LAST_RUN_KEY, String(at));
  } catch {
    /* 隐私模式/配额满：不记也罢，下次照跑 */
  }
}

/** 重置节流（测试用） */
export function resetAutoAssetsThrottle(): void {
  try {
    window.localStorage.removeItem(LAST_RUN_KEY);
  } catch {
    /* 同上 */
  }
}

/** 同一次启动里并发调用（启动链 + 面板显式动作）只跑一遍，后到的复用前一次的结果 */
let inFlight: Promise<AutoAssetResult> | null = null;

/**
 * 把清单里「缺的/不是最新」的**外部工具包**装一遍。在线资源不碰（见文件头）。
 *
 * @param manifest 本次启动已拉的清单；不传则自己拉（独立调用/测试）
 * @param opts.throttle 缺省 true。面板/自检的显式动作传 false——人在场点的不该被节流挡。
 */
export function autoUpdateAssets(
  app: unknown,
  manifest?: DownloadManifest | null,
  opts: { throttle?: boolean } = {},
): Promise<AutoAssetResult> {
  if (inFlight) return inFlight;
  const run = runAutoUpdateAssets(app, manifest, opts).finally(() => {
    inFlight = null;
  });
  inFlight = run;
  return run;
}

async function runAutoUpdateAssets(
  app: unknown,
  manifest: DownloadManifest | null | undefined,
  opts: { throttle?: boolean },
): Promise<AutoAssetResult> {
  const empty: AutoAssetResult = { skipped: true, done: 0, failed: 0, pending: 0 };
  if (tryGetSettings()?.autoUpdate !== true) return empty;
  // 移动端没有 Node：这些工具包（ffmpeg / python / whisper）下下来也 exec 不了，纯占空间。
  // 插件本体照旧走 Obsidian 自己的更新通道，与这里无关。
  if (isMobileEnv()) return empty;

  const now = Date.now();
  if (opts.throttle !== false) {
    const last = readLastRun();
    if (last && now - last < THROTTLE_MS) return empty;
  }

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

  for (const entry of mf.docs) {
    if (!entry?.file || entry.kind !== 'bundle') continue; // 只管工具包，在线资源按需下载
    try {
      if ((await bundleStatus(app, entry)) === 'ready') continue;
      pending++;
      await installBundle(app, entry);
      done++;
    } catch (e) {
      failed++;
      console.warn(`[bz] 自动更新：「${entry.name}」失败（已静默）:`, (e as Error)?.message || e);
    }
  }

  // 记账 + 说一句（只在真装了东西时说；失败留给下次启动）
  writeLastRun(now);
  if (done > 0) {
    notice(`已自动更新 ${done} 个外部工具包，相关功能即刻可用`, 'success');
  }
  return { skipped: false, done, failed, pending };
}
