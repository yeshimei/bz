/* ============================================================
 * bz · 启动后台自动更新「在线资源 + 外部工具」（core/auto-assets.ts）
 *
 * 与 core/self-update.ts 分工：
 *  - self-update 管**插件本体**（releases/<tag>/ 三件套）；
 *  - 本模块管**插件目录里其余的下载物**：`downloads/` 下的文档/数据表/皮肤
 *    （单文件资源）与 `downloads/tools/*.tar.gz`（三个外部工具目录包）。
 *
 * 为什么要有它：设置里「自动更新」原先只管插件本体。用户的理解是「打开了就自动
 * 更新」，实际结果是插件换了新代码、它依赖的索引/皮肤/工具包还停在旧版本——
 * 表现成「更新了但还是不好用」，比不更新更难查（2026-10-30 用户点名）。
 *
 * 三条约束：
 *  - **只有开关打开才动手**（`autoUpdate`）。关着时这里一个字节都不下——它做的是「装」，
 *    不是「查」；「查」由设置面板的「检查更新」负责。
 *  - **清单取一次，全程复用**：启动链已经为了皮肤拉过一份 manifest，这里接着用，
 *    不为同一次启动拉第二遍。
 *  - **失败一律静默**：启动期网络问题不该弹脸；失败项留给「设置 → 通用 → 在线资源」
 *    自己呈状态与重试入口。只有真下成了才发一条通知。
 *
 * 节流 24h（与 self-update 同口径）：逐文件 sha256 要读几十 MB 本地文件，
 * 每次启动都做一遍不值当；新装的用户首次启动那次本来就没有标记，照跑。
 * ============================================================ */
import { notice } from './notice';
import { tryGetSettings } from './settings-provider';
import { docStatus, refreshManifest, type DownloadManifest } from './download-manifest';
import { bundleStatus, installBundle } from './bundle-asset';
import { ensureAssetWithHash } from './remote-asset';
import { applySkinManifest, downloadSkinUpdates, skinStatus } from './skin-pack';

/** 最近一次自动更新时刻（localStorage；跨重启） */
const LAST_RUN_KEY = 'bz-auto-assets:last-run';
/** 节流窗：24 小时（与自更新巡检同期） */
const THROTTLE_MS = 24 * 3600 * 1000;

/** 自动更新结果（面板/测试读它；生产只用来决定要不要发通知） */
export interface AutoAssetResult {
  /** 本次是否因节流/开关关闭而整段跳过 */
  skipped: boolean;
  /** 实际下载成功并落盘的项目数（目录包按 1 项计、皮肤按套计） */
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

/**
 * 把「清单里有、但本地不是最新」的资源全部拉一遍。
 *
 * @param manifest 本次启动已拉的清单；不传则自己拉（独立调用/测试）
 * @param opts.throttle 缺省 true。面板/自检的显式动作传 false——人在场点的不该被节流挡。
 */
export async function autoUpdateAssets(
  app: unknown,
  manifest?: DownloadManifest | null,
  opts: { throttle?: boolean } = {},
): Promise<AutoAssetResult> {
  const empty: AutoAssetResult = { skipped: true, done: 0, failed: 0, pending: 0 };
  if (tryGetSettings()?.autoUpdate !== true) return empty;

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

  // 1) 皮肤：先按新清单重灌本地就绪表（这一步不下载，离线也能用已有的），
  //    再把区间内「缺的/有更新」的套数拉一遍，最后重灌一次让新下的当场生效。
  try {
    await applySkinManifest(app, mf);
    const st = await skinStatus(app, mf);
    if (st.missing + st.updated > 0) {
      pending += st.missing + st.updated;
      const r = await downloadSkinUpdates(app, mf);
      done += r.downloaded;
      failed += r.failed;
      if (r.downloaded > 0) await applySkinManifest(app, mf);
    }
  } catch (e) {
    console.warn('[bz] 自动更新：皮肤处理失败（已静默）:', (e as Error)?.message || e);
    failed++;
  }

  // 2) 文档 / 数据表 / 外部工具包：逐条按磁盘事实判，只处理非就绪的
  for (const entry of mf.docs) {
    if (!entry?.file) continue;
    try {
      const isBundle = entry.kind === 'bundle';
      const state = isBundle ? await bundleStatus(app, entry) : await docStatus(app, entry);
      if (state === 'ready') continue;
      pending++;
      if (isBundle) await installBundle(app, entry);
      else await ensureAssetWithHash(app, entry.file, entry.sha256, entry.name, entry.size);
      done++;
    } catch (e) {
      failed++;
      console.warn(`[bz] 自动更新：「${entry.name}」失败（已静默）:`, (e as Error)?.message || e);
    }
  }

  // 3) 记账 + 说一句（只在真装了东西时说；失败留给面板自己呈状态）
  writeLastRun(now);
  if (done > 0) {
    notice(`已自动更新 ${done} 项在线资源与工具包，相关功能即刻可用`, 'success');
  }
  return { skipped: false, done, failed, pending };
}
