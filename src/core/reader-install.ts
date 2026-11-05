/* ============================================================
 * bz · bz reader 安装器（core/reader-install.ts）
 *
 * 引导页（core/setup-wizard 的检测屏 / ③ 下载队列）与环境自检（同一视图的
 * checkOnly 模式）共用这里：读本机装没装、去 Release 拉最新版、把 Obsidian
 * 插件三件套写进插件目录并启用。
 *
 * 为什么自己装而不是丢一条 obsidian://show-plugin（2026-11-05 用户拍板）：
 * 引导页的目标是「一台干净机器走完就能用」。市场详情页只能把用户送到页面，
 * 「安装 → 启用」还得点两下，而且详情页在旧版 Obsidian 上可能打不开；直装才是
 * 一键。市场里那一份照旧存在（bz reader 已上架），用户以后想从市场更新也行——
 * 两边装的是同一批 Release 资产。
 *
 * ---------- 版本从哪来 ----------
 * 主通道（GitHub）用**免 tag 别名**：
 *   https://github.com/yeshimei/bz-reader/releases/latest/download/manifest.json
 * 它 302 到当前最新 Release 的资产，不用 GitHub API（未登录 60 次/小时、按 IP 限流，
 * 国内还常在超时名单里——bz 自己的 self-update 早就绕开它了）。
 * 备用通道（码云，2026-11-05 用户要求「同样给备用线路」）没有 releases/latest 别名，
 * 走三段链：API releases/latest 拿 tag → 该 tag 的 manifest.json；API 也被限流
 * （60 次/小时/IP）时退到 raw master 的 manifest（推代码即变，可能比 Release 新，
 * 只作为最后兜底）。
 *
 * 资产下载两条通道都按**同一个 tag** 拼：GitHub 失败（网络/404）才走码云。
 * 两端资产由 scripts/push-gitee.mjs 保证字节一致（码云那份从 GitHub Release 原样搬）。
 *
 * ---------- 落盘顺序 ----------
 *   main.js → styles.css → manifest.json
 * manifest 最后写：Obsidian 只看 manifest.json 判断目录是不是插件；先写它再写
 * main.js，中途失败会留下一个「声称装好了、其实加载不了」的坏条目。反过来最坏
 * 只是「还是上一版」，可自愈。
 *
 * 启用走 Obsidian 的软加载（loadManifests → enablePluginAndSave），失败降级成
 * 「已安装，请手动启用」——不因为一个内部 API 改签名就把装好的东西说成失败。
 * ============================================================ */
import { requestUrl } from 'obsidian';
import { withTimeout } from './http';
import { compareVersions, normalizeVersion } from './version';
import { tryGetSettings } from './settings-provider';
import { isMobileEnv } from './mobile';

/** bz-reader 的 Obsidian 插件 id（= 社区目录键 = 其 manifest.id） */
export const READER_PLUGIN_ID = 'bz-reader';
/** 展示名（社区目录里显示的名字，与 id 不同） */
export const READER_PLUGIN_NAME = 'bz Reader';
/** 源码仓库（同作者另一个仓库；与 bz 的 REPO_SLUG 不是同一个） */
export const READER_REPO_SLUG = 'yeshimei/bz-reader';
/** 码云镜像（备用通道；scripts/push-gitee.mjs 往这里发同 tag 的 Release） */
export const READER_GITEE_SLUG = 'ntbl/bz-reader';

const GITHUB_BASE = `https://github.com/${READER_REPO_SLUG}`;
const GITEE_BASE = `https://gitee.com/${READER_GITEE_SLUG}`;
/** GitHub 的免 tag 最新资产目录（唯一的「最新版」入口） */
const GITHUB_LATEST = `${GITHUB_BASE}/releases/latest/download`;
/** 码云没有 latest 别名，只能先问 API 要 tag（限流 60 次/小时/IP，只在主通道失败时走） */
const GITEE_LATEST_API = `https://gitee.com/api/v5/repos/${READER_GITEE_SLUG}/releases/latest`;

/** 三个文件的下载超时（main.js 0.6 MB，给足；样式 0.2 MB） */
const MANIFEST_TIMEOUT_MS = 8000;
const MAIN_TIMEOUT_MS = 60000;
const STYLES_TIMEOUT_MS = 30000;

/** vault 里 bz reader 的落位状态 */
export interface ReaderInstallState {
  /** 插件 id（固定 bz-reader） */
  id: string;
  /** vault 相对插件目录（Obsidian 记录的真实目录优先，用户改过文件夹名也认） */
  dir: string;
  /** 装没装（以磁盘为准；Obsidian 内存清单只做补充） */
  installed: boolean;
  /** 磁盘上的版本（读不到 = 空串） */
  version: string;
  /** Obsidian 当前是否启用它 */
  enabled: boolean;
  /** 目录在、但 manifest.json 读不出/不是 bz-reader（半装或坏了，建议重装） */
  broken: boolean;
}

/** 最新版清单（安装器内部用） */
export interface ReaderRelease {
  version: string;
  /** 归一后的 manifest 正文（安装时直接写这份，不再拉第二次） */
  manifestText: string;
  /** tag（GitHub 通常 = version；码云 API 给什么用什么） */
  tag: string;
  /** 从哪条通道拿到的（诊断用） */
  via: 'github' | 'gitee';
}

export interface ReaderInstallHooks {
  /** 阶段文案（获取版本 / 下载 / 写入 / 启用），UI 原样显示 */
  onStage?: (text: string) => void;
}

export interface ReaderInstallResult {
  version: string;
  dir: string;
  /** 软加载是否成功；false = 三件套已就位，但需要用户手动启用 */
  enabled: boolean;
  /** 三件套最终来自哪条通道 */
  via: 'github' | 'gitee';
}

/* ==================== app 形状 ==================== */

interface AdapterLike {
  read?: (p: string) => Promise<string>;
  write?: (p: string, d: string) => Promise<void>;
  mkdir?: (p: string) => Promise<void>;
  rename?: (a: string, b: string) => Promise<void>;
  remove?: (p: string) => Promise<void>;
  exists?: (p: string) => Promise<boolean>;
}

interface ManifestRecord {
  dir?: string;
  version?: string;
}

interface PluginsLike {
  manifests?: Record<string, ManifestRecord>;
  enabledPlugins?: Set<string> | string[];
  plugins?: Record<string, unknown>;
  loadManifests?: () => Promise<void> | void;
  enablePluginAndSave?: (id: string) => Promise<void>;
  enablePlugin?: (id: string) => Promise<void>;
  saveConfig?: () => Promise<void> | void;
}

function adapterOf(app: unknown): AdapterLike | null {
  return (app as { vault?: { adapter?: AdapterLike } })?.vault?.adapter ?? null;
}

function pluginsOf(app: unknown): PluginsLike | null {
  return (app as { plugins?: PluginsLike })?.plugins ?? null;
}

function configDirOf(app: unknown): string {
  const raw = String((app as { vault?: { configDir?: string } })?.vault?.configDir || '.obsidian');
  return trimSlashes(raw) || '.obsidian';
}

function trimSlashes(p: string): string {
  return String(p || '').replace(/^[\\/]+|[\\/]+$/g, '');
}

/* ==================== 状态读取 ==================== */

/**
 * bz reader 插件目录（vault 相对）。
 *
 * 与 core/plugin-path 对 bz 自己的解析同构，但**不能复用**它：那边有「注入运行中目录」
 * 一层，只对 bz 有效。这里按 Obsidian 的清单记录 → 标准位置两级——用户把文件夹改名成
 * 「阅读器」时 manifests['bz-reader'].dir 记着真路径，照标准位置写会凭空多出第二个插件。
 */
export function readerPluginDirOf(app: unknown): string {
  const fromManifests = trimSlashes(String(pluginsOf(app)?.manifests?.[READER_PLUGIN_ID]?.dir || ''));
  if (fromManifests) return fromManifests;
  return `${configDirOf(app)}/plugins/${READER_PLUGIN_ID}`;
}

/** Obsidian 是否启用了 bz reader（内部 API；拿不到就按「没启用」算，不影响已装判定） */
export function isReaderEnabled(app: unknown): boolean {
  const plugins = pluginsOf(app);
  if (!plugins) return false;
  const enabled = plugins.enabledPlugins;
  if (enabled && typeof (enabled as Set<string>).has === 'function') {
    return (enabled as Set<string>).has(READER_PLUGIN_ID);
  }
  if (Array.isArray(enabled)) return enabled.includes(READER_PLUGIN_ID);
  return !!plugins.plugins?.[READER_PLUGIN_ID];
}

/**
 * 读本机状态（只读磁盘 + 内存清单，不联网）。
 *
 * 两类真值都看：`app.plugins.manifests` 是 Obsidian 加载过的清单（用户改名目录后唯一
 * 记得真路径的地方），磁盘 manifest.json 是此刻的真实版本（刚装完还没 loadManifests
 * 时，内存里仍是旧版本）。文件读到以文件为准。
 */
export async function readReaderInstall(app: unknown): Promise<ReaderInstallState> {
  const record = pluginsOf(app)?.manifests?.[READER_PLUGIN_ID];
  const dir = readerPluginDirOf(app);
  const adapter = adapterOf(app);

  let installed = !!record;
  let version = normalizeVersion(String(record?.version || ''));
  let fileOk = false;

  if (adapter?.read) {
    try {
      const raw = await adapter.read(`${dir}/manifest.json`);
      const json = JSON.parse(raw) as { id?: string; version?: string };
      if (json && json.id === READER_PLUGIN_ID) {
        fileOk = true;
        installed = true;
        const v = normalizeVersion(String(json.version || ''));
        if (v) version = v;
      }
    } catch {
      /* 未安装 / 文件坏了：由下面的 broken 判据兜 */
    }
  }

  let dirExists = false;
  if (!fileOk && adapter?.exists) {
    try {
      dirExists = await adapter.exists(dir);
    } catch {
      dirExists = false;
    }
  }
  // **磁盘是唯一真值**：Obsidian 的内存清单可能还留着「目录已经被删掉」的旧记录
  // （2026-11-05 测试库实测），不查目录就会把「没装」报成「安装不完整」。
  if (adapter?.exists) installed = fileOk || dirExists;

  return {
    id: READER_PLUGIN_ID,
    dir,
    installed,
    version,
    enabled: isReaderEnabled(app),
    // 目录在却读不出 manifest：半装、写坏、或目录里躺着别人（展示上仍按「未安装」算）
    broken: !fileOk && installed,
  };
}

/**
 * 状态 → 人话（检测屏 / 完成屏共用）。
 * `latest` 传 null/undefined 就只报本机状态（完成屏不联网）。
 */
export function readerStateText(state: ReaderInstallState, latest?: string | null): string {
  // 半装与没装在界面上是同一句话（2026-11-05 用户拍板）：用户只需知道「没装好、点安装」，
  // 「安装不完整（需重装）」这种词只会让人犹豫要不要先卸载。
  if (!state.installed || state.broken) return '未安装';
  const head = `已安装 ${state.version || '版本未知'}`;
  const v = normalizeVersion(String(latest || ''));
  if (v && compareVersions(v, state.version) > 0) return `${head} · 新版 ${v}`;
  return `${head} · ${state.enabled ? '已启用' : '未启用'}`;
}

/* ==================== 网络 ==================== */

function messageOf(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e || '');
  return m.length > 160 ? `${m.slice(0, 160)}…` : m;
}

/** GET 文本：非 2xx → 抛（带状态码，调用方据此决定换不换通道） */
async function fetchText(url: string, timeoutMs: number, label: string): Promise<string> {
  const work = requestUrl({ url, method: 'GET', throw: false }).then((r) => {
    const status = Number((r as { status?: number })?.status) || 0;
    if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
    return String((r as { text?: string })?.text || '');
  });
  return withTimeout(work, timeoutMs, label);
}

/** 清单必须真的是 bz-reader 的 manifest，且带版本号（防止代理/镜像把错误页当资产） */
function parseManifest(text: string, channel: string): { version: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${channel} 返回的不是 manifest.json（可能被代理或镜像改写）`);
  }
  const obj = json as { id?: string; version?: string };
  if (!obj || obj.id !== READER_PLUGIN_ID) throw new Error(`${channel} 的清单 id 不是 ${READER_PLUGIN_ID}`);
  const version = normalizeVersion(String(obj.version || ''));
  if (!version) throw new Error(`${channel} 的清单没有版本号`);
  return { version };
}

/** 主通道：GitHub 免 tag 别名（同时拿到版本与要写盘的 manifest 正文） */
async function fetchLatestFromGithub(): Promise<ReaderRelease> {
  const text = await fetchText(`${GITHUB_LATEST}/manifest.json`, MANIFEST_TIMEOUT_MS, 'bz reader 最新版清单');
  const { version } = parseManifest(text, 'GitHub');
  return { version, manifestText: text, tag: version, via: 'github' };
}

/** 备用通道：码云（API 拿 tag → 该 tag 的 manifest；API 挂了退 raw master） */
async function fetchLatestFromGitee(): Promise<ReaderRelease> {
  let tag = '';
  try {
    const raw = await fetchText(GITEE_LATEST_API, MANIFEST_TIMEOUT_MS, 'bz reader 最新版（码云 API）');
    tag = String((JSON.parse(raw) as { tag_name?: string })?.tag_name || '');
  } catch {
    /* API 限流 / 失败：下面用 raw master 兜底 */
  }
  if (tag) {
    const text = await fetchText(
      `${GITEE_BASE}/releases/download/${encodeURIComponent(tag)}/manifest.json`,
      MANIFEST_TIMEOUT_MS,
      'bz reader 清单（码云 Release）',
    );
    const { version } = parseManifest(text, '码云');
    // 码云 Release 的 tag 可能与 manifest.version 不同形（例如带 v），下载按 tag 拼
    return { version, manifestText: text, tag, via: 'gitee' };
  }
  const text = await fetchText(`${GITEE_BASE}/raw/master/manifest.json`, MANIFEST_TIMEOUT_MS, 'bz reader 清单（码云 raw）');
  const { version } = parseManifest(text, '码云 raw');
  return { version, manifestText: text, tag: version, via: 'gitee' };
}

/**
 * 最新版：GitHub 主 → 码云备。
 * 两条都不通时把两边的**原因**一起抛出去（只说「连不上」排查不了是墙、代理还是仓库没发版）。
 */
export async function fetchLatestReaderRelease(): Promise<ReaderRelease> {
  try {
    return await fetchLatestFromGithub();
  } catch (ghErr) {
    try {
      return await fetchLatestFromGitee();
    } catch (geErr) {
      throw new Error(`两条通道都拿不到最新版：GitHub ${messageOf(ghErr)}；码云 ${messageOf(geErr)}`);
    }
  }
}

/* ==================== 下载 ==================== */

interface ReaderAssets {
  mainJs: string;
  styles: string;
  via: 'github' | 'gitee';
}

/** 从一条通道的资产目录下两件套（manifest 不在里面：它就是要写盘的那份正文） */
async function fetchAssetsFrom(base: string): Promise<{ mainJs: string; styles: string }> {
  const mainJs = await fetchText(`${base}/main.js`, MAIN_TIMEOUT_MS, 'bz reader main.js');
  const styles = await fetchText(`${base}/styles.css`, STYLES_TIMEOUT_MS, 'bz reader styles.css');
  return { mainJs, styles };
}

/** 资产：GitHub 主 → 码云备（两端口径一致：同 tag、同文件名） */
async function downloadAssets(tag: string): Promise<ReaderAssets> {
  const safeTag = encodeURIComponent(tag);
  let ghErr: unknown = null;
  try {
    const a = await fetchAssetsFrom(`${GITHUB_BASE}/releases/download/${safeTag}`);
    return { ...a, via: 'github' };
  } catch (e) {
    ghErr = e;
  }
  try {
    const a = await fetchAssetsFrom(`${GITEE_BASE}/releases/download/${safeTag}`);
    return { ...a, via: 'gitee' };
  } catch (e) {
    throw new Error(`两件套下载失败：GitHub ${messageOf(ghErr)}；码云 ${messageOf(e)}`);
  }
}

/** 内容像不像资产（挡住 404 页面、CDN 错误页、被截断的空文件） */
function assertAsset(name: string, text: string, minBytes: number): void {
  if (!text || text.length < minBytes) throw new Error(`${name} 内容不完整（${text.length} 字节）`);
  const head = text.slice(0, 200).toLowerCase();
  if (head.includes('<!doctype html') || head.includes('<html')) {
    throw new Error(`${name} 拿到的是网页而不是文件（通道被劫持或镜像配错）`);
  }
}

/* ==================== 写盘 ==================== */

/** 逐级 mkdir（Obsidian 的 adapter.mkdir 不保证递归建父级，与 remote-asset 同坑） */
async function ensureDir(app: unknown, dir: string): Promise<void> {
  const adapter = adapterOf(app);
  if (!adapter?.mkdir) return;
  let cur = '';
  for (const part of dir.split('/').filter(Boolean)) {
    cur = cur ? `${cur}/${part}` : part;
    try {
      await adapter.mkdir(cur);
    } catch {
      /* 已存在 */
    }
  }
}

/**
 * 写一个文本文件：先落 `.bz-tmp` 再 rename 覆盖。
 * rename 失败（移动端 SAF / 目标被占用）退回直写——直写没有原子性，但比装不上好；
 * 临时件尽力删掉，删不掉下次会被覆盖。
 */
async function writeVaultText(app: unknown, path: string, text: string): Promise<void> {
  const adapter = adapterOf(app);
  if (!adapter?.write) throw new Error('当前环境无法写入插件文件（需要在桌面端操作）');
  const tmp = `${path}.bz-tmp`;
  await adapter.write(tmp, text);
  if (adapter.rename) {
    try {
      await adapter.rename(tmp, path);
      return;
    } catch {
      /* 退回直写 */
    }
  }
  await adapter.write(path, text);
  try {
    await adapter.remove?.(tmp);
  } catch {
    /* 幂等 */
  }
}

/* ==================== 启用 ==================== */

/**
 * 软加载：首次安装时 Obsidian 的内存清单还没有这个目录，不 refresh 就 enable 不到。
 * 任何一步失败都只降级成「已安装，请手动启用」——三件套已经在磁盘上，说成失败反而误导。
 */
async function enableReaderPlugin(app: unknown): Promise<boolean> {
  const plugins = pluginsOf(app);
  if (!plugins) return false;
  if (isReaderEnabled(app)) return true;
  try {
    if (typeof plugins.loadManifests === 'function') await plugins.loadManifests();
  } catch (e) {
    console.warn('[bz] bz reader 清单刷新失败（继续尝试启用）:', messageOf(e));
  }
  if (isReaderEnabled(app)) return true;
  try {
    if (typeof plugins.enablePluginAndSave === 'function') {
      await plugins.enablePluginAndSave(READER_PLUGIN_ID);
      return true;
    }
    if (typeof plugins.enablePlugin === 'function') {
      await plugins.enablePlugin(READER_PLUGIN_ID);
      await plugins.saveConfig?.();
      return true;
    }
  } catch (e) {
    console.warn('[bz] bz reader 自动启用失败（已装好，需手动启用）:', messageOf(e));
  }
  return false;
}

/* ==================== 安装 ==================== */

/**
 * 装 / 更新 bz reader。
 *
 * 顺序：拿最新版 → 下载两件套 → 校验内容 → 写 main.js / styles.css / manifest.json
 * → 回读核对 → 启用。任何一步抛错，调用方把 message 原样给人看。
 */
export async function installReaderPlugin(
  app: unknown,
  hooks: ReaderInstallHooks = {},
): Promise<ReaderInstallResult> {
  const stage = (text: string): void => hooks.onStage?.(text);

  stage('获取最新版…');
  const release = await fetchLatestReaderRelease();

  stage(`下载 ${release.version}…`);
  const assets = await downloadAssets(release.tag);
  assertAsset('main.js', assets.mainJs, 1000);
  assertAsset('styles.css', assets.styles, 1);

  stage('写入插件目录…');
  const dir = readerPluginDirOf(app);
  await ensureDir(app, dir);
  // manifest 最后写：中途失败时 Obsidian 仍按旧版加载，不会出现「声称装好却打不开」的坏条目
  await writeVaultText(app, `${dir}/main.js`, assets.mainJs);
  await writeVaultText(app, `${dir}/styles.css`, assets.styles);
  await writeVaultText(app, `${dir}/manifest.json`, release.manifestText);

  stage('核对安装结果…');
  const check = await readReaderInstall(app);
  if (!check.installed || compareVersions(check.version, release.version) !== 0) {
    throw new Error(
      `安装后版本对不上（磁盘 ${check.version || '读不到'}，期望 ${release.version}）；可重试一次`,
    );
  }

  stage('启用插件…');
  const enabled = await enableReaderPlugin(app);
  return { version: release.version, dir, enabled, via: assets.via };
}

/**
 * 启动链的自动更新（2026-11-05 用户要求：「也随着自动更新和插件更新一起更新」）。
 *
 * 只有 `autoUpdate` 打开 + 桌面端才动手（与 core/auto-assets 同一口径：关着时一个字节都不下）。
 * 已是最新 → 返回 false，不白下一次 0.8 MB。调用方（main.ts）负责静默失败。
 */
export async function autoUpdateReaderPlugin(app: unknown): Promise<boolean> {
  if (tryGetSettings()?.autoUpdate !== true) return false;
  if (isMobileEnv()) return false;
  const state = await readReaderInstall(app);
  const release = await fetchLatestReaderRelease();
  if (state.installed && !state.broken && compareVersions(release.version, state.version) <= 0) {
    return false;
  }
  await installReaderPlugin(app);
  return true;
}
