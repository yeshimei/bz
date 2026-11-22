/* ============================================================
 * bz · 配套插件安装器（core/reader-install.ts）
 *
 * 引导页（core/setup-wizard 的检测屏 / ③ 下载队列）与环境自检（同一视图的
 * checkOnly 模式）共用这里：读本机装没装、去 Release 拉最新版、把 Obsidian
 * 插件三件套写进插件目录并启用。
 *
 * 2026-11-22 起从「只管 bz reader」扩成「管一组同构插件」：bz reader 与
 * bz review 共用这一整套（读状态 / 拉 Release / 写三件套 / 启用 / 自动更新），
 * 每个插件只是一份 PluginSpec。下第三个同构插件时按 COMPANION_SPECS 加一行即可，
 * 安装链路不用再复制一遍。
 *
 * 为什么自己装而不是丢一条 obsidian://show-plugin（2026-11-05 用户拍板）：
 * 引导页的目标是「一台干净机器走完就能用」。市场详情页只能把用户送到页面，
 * 「安装 → 启用」还得点两下，而且详情页在旧版 Obsidian 上可能打不开；直装才是
 * 一键。市场里那一份照旧存在（两个插件都已上架），用户以后想从市场更新也行——
 * 两边装的是同一批 Release 资产。
 *
 * ---------- 版本从哪来 ----------
 * 主通道（GitHub）用**免 tag 别名**：
 *   https://github.com/<owner>/<repo>/releases/latest/download/manifest.json
 * 它 302 到当前最新 Release 的资产，不用 GitHub API（未登录 60 次/小时、按 IP 限流，
 * 国内还常在超时名单里——bz 自己的 self-update 早就绕开它了）。
 * 备用通道（码云，2026-11-05 用户要求「同样给备用线路」）没有 releases/latest 别名，
 * 走三段链：API releases/latest 拿 tag → 该 tag 的 manifest.json；API 也被限流
 * （60 次/小时/IP）时退到 raw master 的 manifest（推代码即变，可能比 Release 新，
 * 只作为最后兜底）。
 *
 * 资产下载：GitHub 走同一个免 tag 别名（清单与两件套同源）；GitHub 失败（网络/404）才走码云，
 * 码云没有 latest 别名，按 Release 的 tag 拼。两端资产由 scripts/push-gitee.mjs 保证字节一致
 * （码云那份从 GitHub Release 原样搬）。
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

/* ==================== 插件描述 ==================== */

/**
 * 一个配套插件的全部静态信息。
 *
 * 只放「同一套安装链路需要的差异」：id 决定目录与启用、两个 slug 决定 Release 地址。
 * 不塞任何行为回调——两个插件的装法一致，差异不该扩散到代码路径里。
 */
export interface PluginSpec {
  /** Obsidian 插件 id（= 社区目录键 = 其 manifest.id） */
  id: string;
  /** 展示名（引导页 / 设置面板统一小写，与命令和插件目录同名） */
  name: string;
  /** 源码仓库（与 bz 的 REPO_SLUG 不是同一个） */
  repoSlug: string;
  /** 码云镜像（备用通道；scripts/push-gitee.mjs 往这里发同 tag 的 Release） */
  giteeSlug: string;
}

/** bz reader：阅读器本体 */
export const READER_SPEC: PluginSpec = {
  id: 'bz-reader',
  name: 'bz reader',
  repoSlug: 'yeshimei/bz-reader',
  giteeSlug: 'ntbl/bz-reader',
};

/** bz review：复习卡（从 bz reader 的划线做卡，所以顺序上跟在 reader 后面） */
export const REVIEW_SPEC: PluginSpec = {
  id: 'bz-review',
  name: 'bz review',
  repoSlug: 'yeshimei/bz-review',
  giteeSlug: 'ntbl/bz-review',
};

/**
 * 顺序有含义：review 依赖 reader（卡片来源是 reader 的划线），
 * 装的时候必须 reader 先落地，「全部更新」也按这个顺序跑。
 */
export const COMPANION_SPECS: readonly PluginSpec[] = [READER_SPEC, REVIEW_SPEC];

/** 兼容旧名（外部还有大量调用点按这几个名字取） */
export const READER_PLUGIN_ID = READER_SPEC.id;
export const READER_PLUGIN_NAME = READER_SPEC.name;
export const READER_REPO_SLUG = READER_SPEC.repoSlug;
export const READER_GITEE_SLUG = READER_SPEC.giteeSlug;

function githubBaseOf(spec: PluginSpec): string {
  return `https://github.com/${spec.repoSlug}`;
}

/** GitHub 的免 tag 最新资产目录（唯一的「最新版」入口） */
function githubLatestOf(spec: PluginSpec): string {
  return `${githubBaseOf(spec)}/releases/latest/download`;
}

function giteeBaseOf(spec: PluginSpec): string {
  return `https://gitee.com/${spec.giteeSlug}`;
}

/** 码云没有 latest 别名，只能先问 API 要 tag（限流 60 次/小时/IP，只在主通道失败时走） */
function giteeLatestApiOf(spec: PluginSpec): string {
  return `https://gitee.com/api/v5/repos/${spec.giteeSlug}/releases/latest`;
}

/** 三个文件的下载超时（main.js 0.6 MB，给足；样式 0.2 MB） */
const MANIFEST_TIMEOUT_MS = 8000;
const MAIN_TIMEOUT_MS = 60000;
const STYLES_TIMEOUT_MS = 30000;

/** vault 里一个配套插件的落位状态 */
export interface PluginInstallState {
  /** 插件 id（bz-reader / bz-review） */
  id: string;
  /** vault 相对插件目录（Obsidian 记录的真实目录优先，用户改过文件夹名也认） */
  dir: string;
  /** 装没装（以磁盘为准；Obsidian 内存清单只做补充） */
  installed: boolean;
  /** 磁盘上的版本（读不到 = 空串） */
  version: string;
  /** Obsidian 当前是否启用它 */
  enabled: boolean;
  /** 目录在、但 manifest.json 读不出/不是这个插件（半装或坏了，建议重装） */
  broken: boolean;
}

/** 兼容旧名 */
export type ReaderInstallState = PluginInstallState;

/** 最新版清单（安装器内部用） */
export interface PluginRelease {
  version: string;
  /** 归一后的 manifest 正文（安装时直接写这份，不再拉第二次） */
  manifestText: string;
  /** tag（GitHub 通常 = version；码云 API 给什么用什么） */
  tag: string;
  /** 从哪条通道拿到的（诊断用） */
  via: 'github' | 'gitee';
}

/** 兼容旧名 */
export type ReaderRelease = PluginRelease;

export interface PluginInstallHooks {
  /** 阶段文案（获取版本 / 下载 / 写入 / 启用），UI 原样显示 */
  onStage?: (text: string) => void;
}

/** 兼容旧名 */
export type ReaderInstallHooks = PluginInstallHooks;

export interface PluginInstallResult {
  version: string;
  dir: string;
  /** 软加载是否成功；false = 三件套已就位，但需要用户手动启用 */
  enabled: boolean;
  /** 三件套最终来自哪条通道 */
  via: 'github' | 'gitee';
}

/** 兼容旧名 */
export type ReaderInstallResult = PluginInstallResult;

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
 * 一个配套插件的目录（vault 相对）。
 *
 * 与 core/plugin-path 对 bz 自己的解析同构，但**不能复用**它：那边有「注入运行中目录」
 * 一层，只对 bz 有效。这里按 Obsidian 的清单记录 → 标准位置两级——用户把文件夹改名成
 * 「阅读器」时 manifests['bz-reader'].dir 记着真路径，照标准位置写会凭空多出第二个插件。
 */
export function pluginDirOf(app: unknown, spec: PluginSpec): string {
  const fromManifests = trimSlashes(String(pluginsOf(app)?.manifests?.[spec.id]?.dir || ''));
  if (fromManifests) return fromManifests;
  return `${configDirOf(app)}/plugins/${spec.id}`;
}

/** Obsidian 是否启用了这个插件（内部 API；拿不到就按「没启用」算，不影响已装判定） */
export function isPluginEnabled(app: unknown, spec: PluginSpec): boolean {
  const plugins = pluginsOf(app);
  if (!plugins) return false;
  const enabled = plugins.enabledPlugins;
  if (enabled && typeof (enabled as Set<string>).has === 'function') {
    return (enabled as Set<string>).has(spec.id);
  }
  if (Array.isArray(enabled)) return enabled.includes(spec.id);
  return !!plugins.plugins?.[spec.id];
}

/**
 * 读本机状态（只读磁盘 + 内存清单，不联网）。
 *
 * 两类真值都看：`app.plugins.manifests` 是 Obsidian 加载过的清单（用户改名目录后唯一
 * 记得真路径的地方），磁盘 manifest.json 是此刻的真实版本（刚装完还没 loadManifests
 * 时，内存里仍是旧版本）。文件读到以文件为准。
 */
export async function readPluginInstall(app: unknown, spec: PluginSpec): Promise<PluginInstallState> {
  const record = pluginsOf(app)?.manifests?.[spec.id];
  const dir = pluginDirOf(app, spec);
  const adapter = adapterOf(app);

  let installed = !!record;
  let version = normalizeVersion(String(record?.version || ''));
  let fileOk = false;

  if (adapter?.read) {
    try {
      const raw = await adapter.read(`${dir}/manifest.json`);
      const json = JSON.parse(raw) as { id?: string; version?: string };
      if (json && json.id === spec.id) {
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
    id: spec.id,
    dir,
    installed,
    version,
    enabled: isPluginEnabled(app, spec),
    // 目录在却读不出 manifest：半装、写坏、或目录里躺着别人（展示上仍按「未安装」算）
    broken: !fileOk && installed,
  };
}

/**
 * 装好且可用（未装 / 半装都不算）。
 * 「装没装好」只有这一个判据：引导页的标记、设置面板的按钮显隐、向导的完成判定都从这里取。
 */
export function isPluginHealthy(state: PluginInstallState): boolean {
  return state.installed && !state.broken;
}

/** 现在该干什么：安装（未装/半装）、更新（确认有新版）、什么都不做 */
export type PluginAction = 'install' | 'update' | 'none';

/** 兼容旧名 */
export type ReaderAction = PluginAction;

/**
 * 状态 + 最新版 → 动作（单源）。
 *
 * 三个入口此前各写一套（引导检测屏的 needInstall/needUpdate、设置面板的
 * actionVisible/hasKnownUpdate、向导完成屏的 missing 判定）：结论一致时看不出问题，
 * 改一处忘另两处就会出现「已装却提示更新」「半装被当成已装」这类互相矛盾的界面。
 * 最新版未知（null / 查询失败）按「不更新」算——不替用户猜有新版。
 */
export function pluginActionOf(state: PluginInstallState, latest?: string | null): PluginAction {
  if (!isPluginHealthy(state)) return 'install';
  const v = normalizeVersion(String(latest || ''));
  if (v && compareVersions(v, state.version) > 0) return 'update';
  return 'none';
}

/**
 * 状态 → 人话（检测屏 / 完成屏共用）。
 * `latest` 传 null/undefined 就只报本机状态（完成屏不联网）。
 */
export function pluginStateText(state: PluginInstallState, latest?: string | null): string {
  // 半装与没装在界面上是同一句话（2026-11-05 用户拍板）：用户只需知道「没装好、点安装」，
  // 「安装不完整（需重装）」这种词只会让人犹豫要不要先卸载。
  if (!isPluginHealthy(state)) return '未安装';
  const head = `已安装 ${state.version || '版本未知'}`;
  if (pluginActionOf(state, latest) === 'update') {
    return `${head} · 新版 ${normalizeVersion(String(latest))}`;
  }
  return `${head} · ${state.enabled ? '已启用' : '未启用'}`;
}

/* ==================== 兼容旧名（reader） ==================== */

/** bz reader 插件目录（vault 相对） */
export function readerPluginDirOf(app: unknown): string {
  return pluginDirOf(app, READER_SPEC);
}

/** Obsidian 是否启用了 bz reader */
export function isReaderEnabled(app: unknown): boolean {
  return isPluginEnabled(app, READER_SPEC);
}

/** 读 bz reader 的本机状态 */
export function readReaderInstall(app: unknown): Promise<PluginInstallState> {
  return readPluginInstall(app, READER_SPEC);
}

/** 读 bz review 的本机状态 */
export function readReviewInstall(app: unknown): Promise<PluginInstallState> {
  return readPluginInstall(app, REVIEW_SPEC);
}

/** bz reader 装好且可用 */
export function isReaderHealthy(state: PluginInstallState): boolean {
  return isPluginHealthy(state);
}

/** bz reader 该干什么 */
export function readerActionOf(state: PluginInstallState, latest?: string | null): PluginAction {
  return pluginActionOf(state, latest);
}

/** bz reader 状态 → 人话 */
export function readerStateText(state: PluginInstallState, latest?: string | null): string {
  return pluginStateText(state, latest);
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

/** 清单必须真的是这个插件的 manifest，且带版本号（防止代理/镜像把错误页当资产） */
function parseManifest(text: string, channel: string, spec: PluginSpec): { version: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${channel} 返回的不是 manifest.json（可能被代理或镜像改写）`);
  }
  const obj = json as { id?: string; version?: string };
  if (!obj || obj.id !== spec.id) throw new Error(`${channel} 的清单 id 不是 ${spec.id}`);
  const version = normalizeVersion(String(obj.version || ''));
  if (!version) throw new Error(`${channel} 的清单没有版本号`);
  return { version };
}

/** 主通道：GitHub 免 tag 别名（同时拿到版本与要写盘的 manifest 正文） */
async function fetchLatestFromGithub(spec: PluginSpec): Promise<PluginRelease> {
  const text = await fetchText(
    `${githubLatestOf(spec)}/manifest.json`,
    MANIFEST_TIMEOUT_MS,
    `${spec.name} 最新版清单`,
  );
  const { version } = parseManifest(text, 'GitHub', spec);
  return { version, manifestText: text, tag: version, via: 'github' };
}

/** 备用通道：码云（API 拿 tag → 该 tag 的 manifest；API 挂了退 raw master） */
async function fetchLatestFromGitee(spec: PluginSpec): Promise<PluginRelease> {
  let tag = '';
  try {
    const raw = await fetchText(
      giteeLatestApiOf(spec),
      MANIFEST_TIMEOUT_MS,
      `${spec.name} 最新版（码云 API）`,
    );
    tag = String((JSON.parse(raw) as { tag_name?: string })?.tag_name || '');
  } catch {
    /* API 限流 / 失败：下面用 raw master 兜底 */
  }
  if (tag) {
    const text = await fetchText(
      `${giteeBaseOf(spec)}/releases/download/${encodeURIComponent(tag)}/manifest.json`,
      MANIFEST_TIMEOUT_MS,
      `${spec.name} 清单（码云 Release）`,
    );
    const { version } = parseManifest(text, '码云', spec);
    // 码云 Release 的 tag 可能与 manifest.version 不同形（例如带 v），下载按 tag 拼
    return { version, manifestText: text, tag, via: 'gitee' };
  }
  const text = await fetchText(
    `${giteeBaseOf(spec)}/raw/master/manifest.json`,
    MANIFEST_TIMEOUT_MS,
    `${spec.name} 清单（码云 raw）`,
  );
  const { version } = parseManifest(text, '码云 raw', spec);
  return { version, manifestText: text, tag: version, via: 'gitee' };
}

/**
 * 最新版：GitHub 主 → 码云备。
 * 两条都不通时把两边的**原因**一起抛出去（只说「连不上」排查不了是墙、代理还是仓库没发版）。
 */
export async function fetchLatestPluginRelease(spec: PluginSpec): Promise<PluginRelease> {
  try {
    return await fetchLatestFromGithub(spec);
  } catch (ghErr) {
    try {
      return await fetchLatestFromGitee(spec);
    } catch (geErr) {
      throw new Error(`两条通道都拿不到最新版：GitHub ${messageOf(ghErr)}；码云 ${messageOf(geErr)}`);
    }
  }
}

/** bz reader 的最新版（兼容旧名） */
export function fetchLatestReaderRelease(): Promise<PluginRelease> {
  return fetchLatestPluginRelease(READER_SPEC);
}

/** bz review 的最新版 */
export function fetchLatestReviewRelease(): Promise<PluginRelease> {
  return fetchLatestPluginRelease(REVIEW_SPEC);
}

/* ==================== 下载 ==================== */

interface PluginAssets {
  mainJs: string;
  styles: string;
  via: 'github' | 'gitee';
}

/** 从一条通道的资产目录下两件套（manifest 不在里面：它就是要写盘的那份正文） */
async function fetchAssetsFrom(
  base: string,
  spec: PluginSpec,
): Promise<{ mainJs: string; styles: string }> {
  const mainJs = await fetchText(`${base}/main.js`, MAIN_TIMEOUT_MS, `${spec.name} main.js`);
  const styles = await fetchText(`${base}/styles.css`, STYLES_TIMEOUT_MS, `${spec.name} styles.css`);
  return { mainJs, styles };
}

/** 资产：GitHub 主 → 码云备。
 *  GitHub 走**免 tag 别名**（releases/latest/download）：清单也是从那里拿的，两件套跟它同源；
 *  即便以后 tag 改成 `v0.2.0` 这类带前缀的写法，资产地址也不会 404。
 *  码云没有 latest 别名，仍按 release tag 拼（tag 由 API/Release 页提供，与 manifest 同批发布）。 */
async function downloadAssets(spec: PluginSpec, tag: string): Promise<PluginAssets> {
  const safeTag = encodeURIComponent(tag);
  let ghErr: unknown = null;
  try {
    const a = await fetchAssetsFrom(githubLatestOf(spec), spec);
    return { ...a, via: 'github' };
  } catch (e) {
    ghErr = e;
  }
  try {
    const a = await fetchAssetsFrom(`${giteeBaseOf(spec)}/releases/download/${safeTag}`, spec);
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
async function enablePlugin(app: unknown, spec: PluginSpec): Promise<boolean> {
  const plugins = pluginsOf(app);
  if (!plugins) return false;
  if (isPluginEnabled(app, spec)) return true;
  try {
    if (typeof plugins.loadManifests === 'function') await plugins.loadManifests();
  } catch (e) {
    console.warn(`[bz] ${spec.name} 清单刷新失败（继续尝试启用）:`, messageOf(e));
  }
  if (isPluginEnabled(app, spec)) return true;
  try {
    if (typeof plugins.enablePluginAndSave === 'function') {
      await plugins.enablePluginAndSave(spec.id);
      return true;
    }
    if (typeof plugins.enablePlugin === 'function') {
      await plugins.enablePlugin(spec.id);
      await plugins.saveConfig?.();
      return true;
    }
  } catch (e) {
    console.warn(`[bz] ${spec.name} 自动启用失败（已装好，需手动启用）:`, messageOf(e));
  }
  return false;
}

/* ==================== 安装 ==================== */

/**
 * 装 / 更新一个配套插件。
 *
 * 顺序：拿最新版 → 下载两件套 → 校验内容 → 写 main.js / styles.css / manifest.json
 * → 回读核对 → 启用。任何一步抛错，调用方把 message 原样给人看。
 *
 * 单飞（2026-11-06）：向导、设置面板、启动自动更新三处入口各有各的 busy，彼此不知道；
 * 两路同时写同一批 `.bz-tmp` / 三件套会互相覆盖，最后核对报「安装后版本对不上」。
 * 后到的调用复用同一趟（拿同一个结果），不重复下载、不交错写盘。
 * 2026-11-22 起按插件 id 分开单飞：两个插件互不影响，一个在跑不该把另一个也挂住。
 * 代价：复用者自己的 `onStage` 收不到进度（它的界面停在「安装中…」直到完成）——比写坏好。
 */
const installInFlight = new Map<string, Promise<PluginInstallResult>>();

export function installPlugin(
  app: unknown,
  spec: PluginSpec,
  hooks: PluginInstallHooks = {},
): Promise<PluginInstallResult> {
  const running = installInFlight.get(spec.id);
  if (running) return running;
  const run: Promise<PluginInstallResult> = installOne(app, spec, hooks).finally(() => {
    if (installInFlight.get(spec.id) === run) installInFlight.delete(spec.id);
  });
  installInFlight.set(spec.id, run);
  return run;
}

async function installOne(
  app: unknown,
  spec: PluginSpec,
  hooks: PluginInstallHooks,
): Promise<PluginInstallResult> {
  const stage = (text: string): void => hooks.onStage?.(text);

  stage('获取最新版…');
  const release = await fetchLatestPluginRelease(spec);

  stage(`下载 ${release.version}…`);
  const assets = await downloadAssets(spec, release.tag);
  assertAsset('main.js', assets.mainJs, 1000);
  assertAsset('styles.css', assets.styles, 1);

  stage('写入插件目录…');
  const dir = pluginDirOf(app, spec);
  await ensureDir(app, dir);
  // manifest 最后写：中途失败时 Obsidian 仍按旧版加载，不会出现「声称装好却打不开」的坏条目
  await writeVaultText(app, `${dir}/main.js`, assets.mainJs);
  await writeVaultText(app, `${dir}/styles.css`, assets.styles);
  await writeVaultText(app, `${dir}/manifest.json`, release.manifestText);

  stage('核对安装结果…');
  const check = await readPluginInstall(app, spec);
  if (!check.installed || compareVersions(check.version, release.version) !== 0) {
    throw new Error(
      `安装后版本对不上（磁盘 ${check.version || '读不到'}，期望 ${release.version}）；可重试一次`,
    );
  }

  stage('启用插件…');
  const enabled = await enablePlugin(app, spec);
  return { version: release.version, dir, enabled, via: assets.via };
}

/** bz reader 装 / 更新（兼容旧名） */
export function installReaderPlugin(
  app: unknown,
  hooks: PluginInstallHooks = {},
): Promise<PluginInstallResult> {
  return installPlugin(app, READER_SPEC, hooks);
}

/** bz review 装 / 更新 */
export function installReviewPlugin(
  app: unknown,
  hooks: PluginInstallHooks = {},
): Promise<PluginInstallResult> {
  return installPlugin(app, REVIEW_SPEC, hooks);
}

/**
 * 启动链的自动更新（2026-11-05 用户要求：「也随着自动更新和插件更新一起更新」）。
 * 2026-11-22 起按插件分派：两个插件各自更各自的。
 *
 * 只有 `autoUpdate` 打开 + 桌面端才动手（与 core/auto-assets 同一口径：关着时一个字节都不下）。
 * 已是最新 → 返回 false，不白下一次 0.8 MB。调用方（main.ts）负责静默失败。
 */
export async function autoUpdatePlugin(app: unknown, spec: PluginSpec): Promise<boolean> {
  if (tryGetSettings()?.autoUpdate !== true) return false;
  if (isMobileEnv()) return false;
  const state = await readPluginInstall(app, spec);
  const release = await fetchLatestPluginRelease(spec);
  if (state.installed && !state.broken && compareVersions(release.version, state.version) <= 0) {
    return false;
  }
  await installPlugin(app, spec);
  return true;
}

/** bz reader 自动更新（兼容旧名） */
export function autoUpdateReaderPlugin(app: unknown): Promise<boolean> {
  return autoUpdatePlugin(app, READER_SPEC);
}

/**
 * 一组配套插件依次自动更新（按 COMPANION_SPECS 顺序：reader 在前，review 在后）。
 *
 * 串行而不是并发：两个插件各要下 ~0.7 MB，并发在慢网下互相拖慢；
 * 顺序也保证「reader 先就位，review 再装」。单个失败不阻断后面的，
 * 返回真正更新了的那几个 id。
 */
export async function autoUpdateCompanionPlugins(app: unknown): Promise<string[]> {
  const updated: string[] = [];
  for (const spec of COMPANION_SPECS) {
    try {
      if (await autoUpdatePlugin(app, spec)) updated.push(spec.id);
    } catch (e) {
      console.warn(`[bz] ${spec.name} 自动更新失败（已跳过）:`, messageOf(e));
    }
  }
  return updated;
}
