/* ============================================================
 * bz · 新版本自更新（core/self-update.ts，单源）
 *
 * 通道（2026-10-28 对外分发重做；2026-10-31 起 raw 退场、Release 主 / jsDelivr 备）：
 *  1. 指针：Release latest 的 `downloads/manifest.json` 顶层 `release`（合并形态），
 *     老指针 `downloads/version.json` 兜底（v1.36 及更早客户端只认它）；
 *  2. 产物：该 tag 下的三件套 manifest.json / main.js / styles.css（Release 资产优先）。
 * 两段分开的理由见 core/remote-base.ts 文件头——指针必须恒可达，产物必须是冻结的提交。
 *
 * 行为分两档（设置键 `autoUpdate`，缺省**开**；2026-10-30 用户拍板）：
 *  开着时同一趟启动链还会更新插件依赖的下载物，见 core/auto-assets.ts。
 *  - 关：仍会检查（启动 15 秒后 / 打开设置面板时），发现新版只记账 + 面板呈现
 *        「有新版 vX」；**不下载、不覆盖**。要不要装由人点「更新」。
 *  - 开：检查到新版直接装（备份旧版 → 覆盖三件套 → 通知重载）。
 *
 * 三条安全线：
 *  - **覆盖前备份**：旧三件套存 `<插件目录>/downloads/.backup/<旧版本>/`。此前没有回滚，
 *    推一次坏包等于把所有用户焊死在坏包上（自更新代码本身就在坏包里，没人能自救）。
 *  - **内容宽校验**：main.js 非空且不像 HTML 错误页才写（CDN 被墙时常见）。
 *  - **失败一律静默**：启动期网络失败不该弹脸；只有「真的装了」才发通知。
 *
 * 巡检失败的可见面在设置面板「关于」组（`selfUpdateState()` 读本模块的模块级状态），
 * 不在这里弹 toast。
 * ============================================================ */
import { requestUrl } from 'obsidian';
import { notice } from './notice';
import { pluginVaultPath } from './plugin-path';
import { downloadRemotesFor, isValidTag, releaseDownloadUrl, RELEASE_POINTER, REPO_SLUG, repoRemotesForTag } from './remote-base';
import { MANIFEST_FILE as DOWNLOAD_MANIFEST_FILE } from './download-manifest';
import { noteReleaseTag } from './remote-asset';

/** 巡检节流：24 小时 */
const CHECK_INTERVAL_MS = 24 * 3600 * 1000;
/** 启动后延迟巡检（躲开 Obsidian 启动高峰） */
const CHECK_DELAY_MS = 15 * 1000;
/**
 * 单通道超时（毫秒）。
 *
 * `requestUrl` **没有超时参数**：网络被墙/半通时它会一直挂着不 resolve，于是「检查并更新」
 * 点下去既没有转圈也没有提示（2026-10-28 用户实测报障）。这里给每个通道加一道硬时限，
 * 五条通道最坏也不会超过十几秒——先说话，再等结果。
 */
const FETCH_TIMEOUT_MS = 6000;
/**
 * 大文件（main.js / styles.css）的单通道时限。
 *
 * 与指针的 6 秒分开：指针是几百字节，慢到 6 秒就是网络真有问题；而三件套里 main.js 有
 * **2.8 MB**，2026-10-30 实测国内直连 jsDelivr 边缘 **18～48 秒**（fastly 48s / gcore 18s）。
 * 用同一个 6 秒等于给本体判死刑：检查能过、下载永远超时，面板还显示「有新版」——
 * 用户看到的是「自动更新开着，但从来没更新过」。慢就慢，让它下完。
 */
export const FETCH_ASSET_TIMEOUT_MS = 90 * 1000;
const LAST_CHECK_KEY = 'bz-selfupdate:last-check';
/** 已下载待重载的版本（`{"version":"1.34.0"}`）：磁盘已是新版、运行中还是旧的 */
const PENDING_KEY = 'bz-selfupdate:pending';
/** 发现但未安装的新版（`{"version":"1.34.0","tag":"v1.34.0","at":123}`） */
const AVAILABLE_KEY = 'bz-selfupdate:available';
/** 发布指针的免 tag 地址：`releases/latest/download/<资产名>`，GitHub 302 到最新发布的同名资产
 *  （latest 语义 = 非 draft 非 prerelease，与「note/资产齐了才转正」的发布口径一致）。
 *  2026-10-31 起指针合并进在线资源清单（顶层 `release` 字段），清单优先——一次请求同时
 *  拿到「有没有新版」和「在线资源清单」。资产名扁平化见 remote-base.releaseDownloadUrl。 */
const LATEST_MANIFEST_URL = `https://github.com/${REPO_SLUG}/releases/latest/download/downloads-manifest.json`;

/** 备份目录（相对插件安装目录；点前缀是「不是下载产物」的视觉声明，也避开 downloads/ 的清单守卫） */
const BACKUP_DIR = 'downloads/.backup';
/** 自更新的四种结局（面板据此说人话） */
export type SelfUpdateResult =
  /** 同版本或更低：无事发生 */
  | 'current'
  /** 发现新版但没装（autoUpdate 关 / 调用方没要装） */
  | 'available'
  /** 装了，等重载 */
  | 'installed'
  /** 检查本身失败（网络 / 指针坏）——调用方决定要不要说话 */
  | 'failed';

/** 面板读的快照（模块级 + localStorage 双写：模块级是本次会话的真值，localStorage 跨重启） */
export interface SelfUpdateState {
  /** 运行中的版本（插件加载时读入的那份） */
  running: string;
  /** 磁盘上的版本（可能已被上一次自更新覆写） */
  onDisk: string;
  /** 远端发现的新版（未安装；null = 没有或没查过） */
  available: { version: string; tag: string; at: number } | null;
  /** 已下载待重载的版本（null = 无） */
  pending: string | null;
  /** 最近一次检查失败的原因（null = 没失败） */
  error: string | null;
  /** 最近一次检查成功的时刻（0 = 本次会话没查过） */
  checkedAt: number;
}

/** 本次会话的检查结果（面板刷新读它，不必再打网络） */
let lastError: string | null = null;
let lastCheckedAt = 0;
let lastAvailable: { version: string; tag: string; at: number } | null = null;

/** 重置会话状态（测试用） */
export function resetSelfUpdateState(): void {
  lastError = null;
  lastCheckedAt = 0;
  lastAvailable = null;
}

function pluginFile(app: unknown, name: string): string {
  // 插件目录名由用户决定（`bz` / `包仔` / `bz-test` 都可能）：写死 `plugins/bz` 时，
  // 改过名字的机器上「检查更新」读不到本地 manifest、覆盖也写去不存在的目录。
  return pluginVaultPath(app, name);
}

/** 给 promise 套一道硬时限（底层请求无法真正取消，但调用方不再无限等） */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`连接超时：${label}`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function fetchText(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<string> {
  const res = await withTimeout(requestUrl({ url, method: 'GET', throw: true }), timeoutMs, url);
  return String(res.text || '');
}

/**
 * 依序试一组 URL（Release 资产在前 → jsDelivr 各边缘入口）。
 *
 * 第一个单独试（Release 主通道），失败了把**其余通道并发**打出去：串行试五条时，
 * 国内半通网络下用户要盯着转圈半分钟才看到「网络不通」。
 */
async function fetchFirst(
  urls: string[],
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<{ text: string; url: string }> {
  const [head, ...rest] = urls;
  let lastErr: unknown = null;
  if (head) {
    try {
      return { text: await fetchText(head, timeoutMs), url: head };
    } catch (e) {
      lastErr = e;
    }
  }
  if (rest.length) {
    try {
      return await Promise.any(rest.map(async (url) => ({ text: await fetchText(url, timeoutMs), url })));
    } catch (e) {
      // AggregateError：里面才是各通道真正的原因
      const errs = (e as { errors?: unknown[] })?.errors;
      lastErr = (errs && errs[0]) || e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || '没有可用的下载源'));
}

/** 语义化版本比较：返回 true 表示 a 更新；非数字段按 0 处理（1.0.0-beta 与 1.0.0 视作相等偏低） */
export function versionGt(a: string, b: string): boolean {
  const pa = String(a || '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** main.js 宽校验：非空且不是 HTML 错误页（CDN 被墙时可能回错误页） */
function looksLikeBundle(text: string): boolean {
  const t = String(text || '');
  return t.length > 1000 && !/^\s*<(!DOCTYPE|html)/i.test(t);
}

/** localStorage 读 JSON（不可用/坏形 → null；极端环境 localStorage 会抛） */
function readStore<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStore(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage 不可用：本次会话仍工作，只是跨重启会重查 */
  }
}

/** 读插件安装目录的 manifest.json 文本（不存在 → null，不抛） */
async function readDiskManifest(app: unknown): Promise<{ version: string; text: string } | null> {
  try {
    const text = await (app as { vault?: { adapter?: { read?: (p: string) => Promise<string> } } })
      .vault!.adapter!.read!(pluginFile(app, 'manifest.json'));
    const version = String(JSON.parse(text)?.version || '');
    return version ? { version, text } : null;
  } catch {
    return null;
  }
}

/**
 * 运行中的版本。Obsidian 把插件清单缓存在 `app.plugins.manifests[id].version`（加载时那份），
 * 拿不到就退回磁盘版本——两者相等时「待重载」自然显示不出来，但不会有更坏的后果。
 */
export function runningVersion(app: unknown): string {
  const v = (app as { plugins?: { manifests?: Record<string, { version?: string }> } })?.plugins?.manifests?.bz?.version;
  return String(v || '');
}

/** 当前自更新状态快照（面板「关于」组读它；纯读，不打网络） */
export async function selfUpdateState(app: unknown): Promise<SelfUpdateState> {
  const disk = await readDiskManifest(app);
  const onDisk = disk?.version || '';
  const running = runningVersion(app) || onDisk;
  const pendingRec = readStore<{ version?: string }>(PENDING_KEY);
  const pendingVer = String(pendingRec?.version || '');
  // 待重载只在「磁盘确实比运行中新」时成立：版本相等说明已经重载过（或本次启动读的就是新版），
  // 此时 localStorage 里那条是过期账，顺手清掉——否则面板会永远挂着「重载后生效」。
  const pending = pendingVer && versionGt(pendingVer, running) ? pendingVer : null;
  if (pendingVer && !pending) writeStore(PENDING_KEY, null);

  const avail = lastAvailable ?? readStore<{ version: string; tag: string; at: number }>(AVAILABLE_KEY);
  // 已装的版本追平了「发现的新版」→ 那条 available 过期
  const stillAhead = !!avail && versionGt(String(avail.version), onDisk || running);
  return {
    running,
    onDisk,
    available: stillAhead ? avail : null,
    pending,
    error: lastError,
    checkedAt: lastCheckedAt,
  };
}

/** 解析一份「可能是发布指针」的内容：**解析不出就返回 null，不抛错**。
 *
 *  为什么不抛错：通道链上会拿到「HTTP 200 但不是指针」的内容——分发仓镜像上的
 *  `downloads/manifest.json` 可能还是**没有 `release` 字段的旧清单**（v1.36 及更早的产物），
 *  它顶层 `version` 是清单 schema 版本（数字 1）、没有 tag。2026-10-31 v1.37.0 首发翻车就是
 *  这里抛了「发布指针的 tag 不可用」，明明后面的 `version.json` 是对的却不再试——
 *  客户端于是把「已是最新」显示成「服务异常」。语义上「这内容不是指针」只是**这条通道无效**，
 *  该换通道，不是检查失败。 */
function tryParsePointer(text: string): { version: string; tag: string } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const o = raw as { version?: unknown; tag?: unknown; release?: unknown };
  // 清单形态：顶层 `release: { version, tag }`（字段名不能叫 version——那被清单 schema 版本占用）
  const rel = o?.release as { version?: unknown; tag?: unknown } | undefined;
  if (rel && typeof rel === 'object') {
    const version = String(rel.version || '').trim();
    const tag = String(rel.tag || '').trim();
    return version && isValidTag(tag) ? { version, tag } : null;
  }
  // 老指针形态：`{ version, tag }`（v1.36 及更早客户端唯一认的文件；这里读它是兜底）
  const version = String(o?.version ?? '').trim();
  const tag = String(o?.tag ?? '').trim();
  return version && isValidTag(tag) ? { version, tag } : null;
}

/** 第一个成功的（按 resolve 顺序，失败的忽略）；全部失败才 reject */
function firstOk<T>(tasks: Array<() => Promise<T>>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let pending = tasks.length;
    if (!pending) {
      reject(new Error('没有可用的下载源'));
      return;
    }
    for (const run of tasks) {
      run().then(resolve, (e) => {
        pending -= 1;
        if (pending === 0) reject(e);
      });
    }
  });
}

async function fetchPointer(): Promise<{ version: string; tag: string }> {
  // 通道链（2026-10-31 起指针合并进清单；raw 退场、Release 主 / jsDelivr 备）：
  //  1. Release 免 tag 形态 `releases/latest/download/<资产名>`——GitHub 302 到**当前最新
  //     发布**的同名资产。它把「指针放哪」与「latest 是哪个 tag」的死结解开了：读指针
  //     不需要事先知道 tag，而 GitHub 的 latest 语义（非 draft、非 prerelease）与
  //     「note/资产齐了才转正」的发布流程天然一致——转正那一刻才对外可见。
  //     清单在前（新客户端主路，一次请求指针+清单），镜像上的老指针 version.json 跟着兜。
  //  2. jsDelivr 边缘 + `?t=` 破缓存兜底：GitHub 直连不通时走它。jsDelivr 对 `@master`
  //     有分钟到小时级缓存，换个缓存键强制回源（remote-asset.FetchAssetOpts.bust 同口径）。
  //
  // **每条通道都要校验内容**：镜像清单可能还是旧版（无 release 字段），那是「这条无效」
  // 不是「检查失败」，必须继续试下一条（v1.37.0 首发翻车的根因）。
  const stamp = Date.now();
  const urls = [
    LATEST_MANIFEST_URL,
    ...downloadRemotesFor(DOWNLOAD_MANIFEST_FILE).map((u) => `${u}?t=${stamp}`),
    ...downloadRemotesFor(RELEASE_POINTER).map((u) => `${u}?t=${stamp}`),
  ];
  const attempt = async (url: string) => {
    const text = await fetchText(url, FETCH_TIMEOUT_MS);
    const p = tryParsePointer(text);
    if (!p) throw new Error(`${url}：内容不是发布指针`);
    return p;
  };
  let pointer: { version: string; tag: string };
  const [head, ...rest] = urls;
  try {
    // 第一条单独试（latest 最新鲜），失败了把其余通道并发打出去——串行试五条时，
    // 国内半通网络下用户要盯着转圈半分钟才看到结果。
    pointer = await attempt(head);
  } catch (headErr) {
    try {
      pointer = await firstOk(rest.map((u) => () => attempt(u)));
    } catch (e) {
      throw new Error(`拿不到发布指针：${(headErr as Error)?.message || headErr}；${(e as Error)?.message || e}`);
    }
  }
  // 回填 Release 通道的 tag 记忆（remote-asset 的下载链据此把 Release 资产排到最前）
  noteReleaseTag(pointer.tag);
  return pointer;
}

/** 备份旧三件套（覆盖前唯一的安全网）；失败只记录不阻断——备份不该成为装不上的理由 */
async function backupCurrent(app: unknown, version: string): Promise<void> {
  const adapter = (app as {
    vault?: {
      adapter?: {
        read?: (p: string) => Promise<string>;
        write?: (p: string, d: string) => Promise<void>;
        mkdir?: (p: string) => Promise<void>;
      };
    };
  }).vault?.adapter;
  if (!adapter?.read || !adapter?.write) return;
  // pluginVaultPath 已带 `downloads/.backup` 前缀，别再拼插件目录（拼了会出 `bz//downloads`）
  const dir = `${pluginVaultPath(app, BACKUP_DIR)}/${version || 'unknown'}`;
  try {
    await adapter.mkdir?.(dir);
  } catch {
    /* 已存在 */
  }
  for (const name of ['main.js', 'styles.css', 'manifest.json']) {
    try {
      const text = await adapter.read(pluginFile(app, name));
      if (text) await adapter.write(`${dir}/${name}`, text);
    } catch (e) {
      console.warn(`[bz] 自更新备份 ${name} 失败（继续）:`, (e as Error)?.message || e);
    }
  }
}

export interface SelfUpdateOptions {
  /**
   * 发现新版时是否直接安装。缺省 = 跟随设置 `autoUpdate`（缺省开）。
   * 面板「更新」按钮显式传 true：人点了才装，与开关无关。
   */
  apply?: boolean;
  /** 跳过 24h 节流（面板手动「检查更新」/ 显式动作）。缺省 true 之外的调用方须显式传 */
  throttle?: boolean;
  /** 装完后不自己弹通知（面板已用一条常驻 toast 全程接管：正在检查 → 结果） */
  silent?: boolean;
}

/**
 * 检查更新（可抛错——调用方决定要不要静默）。
 * @returns 'current' / 'available'（发现但未装）/ 'installed'
 */
export async function checkSelfUpdate(app: unknown, opts: SelfUpdateOptions = {}): Promise<SelfUpdateResult> {
  const now = Date.now();
  const throttle = opts.throttle !== false;
  if (throttle) {
    const last = Number(readStore<number>(LAST_CHECK_KEY) || 0);
    if (last && now - last < CHECK_INTERVAL_MS) {
      // 节流窗内不复检，但把上次的结论原样交回去（面板靠它决定按钮文案）
      return lastAvailable ? 'available' : 'current';
    }
  }
  writeStore(LAST_CHECK_KEY, now);
  lastCheckedAt = now;
  lastError = null;

  const adapter = (app as { vault?: { adapter?: { read?: (p: string) => Promise<string>; write?: (p: string, d: string) => Promise<void> } } }).vault?.adapter;
  // 没有可写适配器 = 这台机器上根本装不了（移动端/异常环境）。此前返回 'current'，
  // 面板会显示「已是最新」——把「做不到」说成「不需要」，比报错更糟。
  if (!adapter?.read || !adapter?.write) throw new Error('当前环境无法读写插件文件（需要在桌面端操作）');

  const local = await readDiskManifest(app);
  const localVer = local?.version || runningVersion(app);
  if (!localVer) return 'current';

  let apply = opts.apply;
  if (apply === undefined) {
    // 缺省跟随设置（core 层不 import 域，走 settings-provider 的只读逃生口）
    try {
      const { tryGetSettings } = await import('./settings-provider');
      apply = tryGetSettings()?.autoUpdate === true;
    } catch {
      apply = false;
    }
  }

  let pointer: { version: string; tag: string };
  try {
    pointer = await fetchPointer();
  } catch (e) {
    lastError = (e as Error)?.message || String(e);
    lastAvailable = null;
    throw e;
  }
  if (!versionGt(pointer.version, localVer)) {
    lastAvailable = null;
    writeStore(AVAILABLE_KEY, null);
    return 'current';
  }

  // 发现新版：先记账（无论装不装，面板都要能显示「有新版」）
  lastAvailable = { version: pointer.version, tag: pointer.tag, at: now };
  writeStore(AVAILABLE_KEY, lastAvailable);
  if (!apply) return 'available';

  // 有新版本才拉大文件（省流量）：三件套全部来自**该 tag**，不是 master。
  // 通道：Release 资产（github.com/<主仓>/releases/download/<tag>/<name>）在前——
  // 按计数、按冻结性都优于分发仓镜像；镜像（jsDelivr）整条链跟在后面兜底。
  // 三件套按「大文件」时限拉：2.8 MB 的 main.js 在慢速边缘上要几十秒（见 FETCH_ASSET_TIMEOUT_MS）
  const bundleUrl = (name: string): string[] => {
    const rel = releaseDownloadUrl(pointer.tag, name);
    return [...(rel ? [rel] : []), ...repoRemotesForTag(pointer.tag, name)];
  };
  const js = await fetchFirst(bundleUrl('main.js'), FETCH_ASSET_TIMEOUT_MS);
  const css = await fetchFirst(bundleUrl('styles.css'), FETCH_ASSET_TIMEOUT_MS);
  const mf = await fetchFirst(bundleUrl('manifest.json'), FETCH_ASSET_TIMEOUT_MS);
  if (!looksLikeBundle(js.text)) throw new Error('远端 main.js 内容异常，放弃覆盖');
  // manifest.json 只有几百字节，不能拿 looksLikeBundle 的「>1000 字节」去卡它——
  // 那份校验是为 main.js 设的（防 CDN 回 HTML 错误页）。清单的可信判据是「能解析且 id 对得上」。
  let mfOk = false;
  try {
    const o = JSON.parse(mf.text) as { id?: unknown };
    mfOk = o?.id === 'bz';
  } catch {
    mfOk = false;
  }
  if (!mfOk) throw new Error('远端 manifest.json 内容异常，放弃覆盖');

  await backupCurrent(app, localVer);
  await adapter.write(pluginFile(app, 'main.js'), js.text);
  await adapter.write(pluginFile(app, 'styles.css'), css.text);
  await adapter.write(pluginFile(app, 'manifest.json'), mf.text);
  writeStore(PENDING_KEY, { version: pointer.version });
  // 用户拍板 2026-10-31：更新插件 = **强制同更更新日志**。新三件套落盘后马上向远端
  // 拉与新版配套的日志（channel 上的 downloads/bz-changelog.html），落进插件目录——
  // 重载后的启动检测（fetchChangelogForStartup）才有得秒开。失败静默：不挡更新完成，
  // 启动检测那条线在重载后还会再强制核对一次，两层兜底。
  void (async () => {
    try {
      const { refreshChangelog } = await import('./changelog');
      await refreshChangelog(app);
    } catch {
      /* 静默：日志没跟上不算更新失败 */
    }
  })();
  if (!opts.silent) notice(`bz 已更新到 v${pointer.version}：重载插件（或重启 Obsidian）后生效`, 'success');
  return 'installed';
}

/**
 * 启动巡检入口：延迟触发、静默失败（自动更新不弹错误脸）。app 未初始化时静默跳过。
 *
 * @param after 自更新**跑完之后**（成功或失败都算完）再执行的启动维护动作。
 *   存在的理由：皮肤包的版本区间校验拿的是 `manifest.json` 的版本号，而本函数会
 *   覆写它——两件事并发会出现「皮肤按旧版本校验通过 → 插件随即更新 → 皮肤当场
 *   变不兼容」（ADR-0199 决策 5）。串行是唯一不会自我打脸的时序。
 *
 * 注意：**开关关着也照跑巡检**（那是「查」，不是「装」）。区别只在 apply——关着时
 * 巡检只把「有新版」记进面板，不动磁盘任何文件。
 */
export function scheduleSelfUpdateCheck(
  getAppFn: () => unknown,
  isUnloaded: () => boolean,
  after?: (app: unknown) => unknown,
): void {
  window.setTimeout(() => {
    if (isUnloaded()) return;
    void (async () => {
      const app = getAppFn();
      try {
        await checkSelfUpdate(app);
      } catch (e) {
        console.warn('[bz] 自更新巡检失败（已静默）:', (e as Error)?.message || e);
      }
      if (!after) return;
      if (isUnloaded()) return;
      try {
        await after(app);
      } catch (e) {
        console.warn('[bz] 启动维护任务失败（已静默）:', (e as Error)?.message || e);
      }
    })();
  }, CHECK_DELAY_MS);
}
