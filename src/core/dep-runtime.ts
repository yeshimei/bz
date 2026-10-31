/* ============================================================
 * bz · 本地运行时依赖（core/dep-runtime.ts）
 *
 * 管的是「插件自己下不下来的那两样」：Python 与 ffmpeg/ffprobe。
 * Node 有兄弟模块 core/node-runtime-install.ts，两者的落盘/校验范式同源，
 * 差别在下面三条，都是踩过才知道的：
 *
 * 1. **不是单文件**。Node 从 150MB 的包里只抽 node.exe 一个文件；ffmpeg 要抽两个
 *    （ffmpeg + ffprobe，只有一个的机器很常见，判就绪必须两个都在），Python 的
 *    install_only 包则是整个目录（标准库四千多个文件），只能整包展开。
 * 2. **不转存进自家 Release**。ffmpeg 直连 gyan 的固定版本路径、Python 直连
 *    astral-sh 的 GitHub Release。理由有两条，都成立：
 *    - 体积：ffmpeg 一个包 109MB，跟着每次发版走等于每版多传 130MB；
 *    - 合规：gyan 的构建是 **GPLv3**。把二进制放进 bz 的 Release／离线包就是再分发，
 *      要履行 GPLv3 的源码提供义务；让用户从上游自己取，我们不构成分发方。
 *    所以 `downloads/tools/*.tar.gz` 那套「清单 + sha256 + 离线包」不适用于这两个，
 *    这里改用**固定版本 + 固定 URL + 下完真跑一次**（与 Node 同口径，Node 也没记 sha256）。
 * 3. **装了不等于能用**。bz 主进程从不 spawn 这两个东西——它只把路径**当参数下发给
 *    两个工具包**（bili-downloader 的 config 默认就是裸 `ffmpeg`/`python`，传了就覆盖；
 *    脸谱走 `--python`/`--ffmpeg`）。所以「装好」的最后一步是**把绝对路径写进设置**，
 *    否则装了也白装：留空 = 走 PATH，而 PATH 上没有。
 *
 * 探测顺序（刻意与 Node 相反）：**设置里填的 → 插件内便携 → PATH → 没有**。
 * Node 是 bz 私有的可复现执行环境，插件内那份优先；Python/ffmpeg 是用户可能自己
 * 在管系统工具，插件内的不能顶掉用户手填的那份——否则「我明明装了 ffmpeg，你怎么
 * 走的是另一份」是最难查的一类困惑。
 * ============================================================ */
import { requestUrl } from 'obsidian';
import { DOWNLOADS_DIR, downloadsVaultPath, ensureDir } from './remote-asset';
import { pluginDirOf } from './plugin-path';
import { extractZipEntry, findZipEntry, readZipEntries } from './zip';
import { untar, type TarFile } from './tar';
import { readOfflineBytes } from './offline-source';
import { fetchBytesWithProgress } from './net-progress';
import { getSettings, saveSettings, tryGetSettings } from './settings-provider';

/** 依赖 id（= 落位目录名 = 引导页那一行的身份） */
export type DepId = 'python' | 'ffmpeg';

/** 「外部工具」组那三个设置键（AI 页 → 外部工具；三键全域共用，ADR-0195） */
export type DepSettingKey = 'pythonPath' | 'ffmpegPath' | 'ffprobePath';

/** Python 版本：3.12 而不是最新的 3.13/3.14 —— funasr / torch 生态对 3.12 的
 *  wheel 覆盖最全，转写是这两个依赖的唯一用途，稳比新重要。 */
export const PYTHON_VERSION = '3.12.16';
/** python-build-standalone 的发布 tag（版本串里也带着它，换版本两处一起改） */
export const PYTHON_BUILD_TAG = '20261026';

/** ffmpeg 版本：锁 gyan 的固定版本路径（`ffmpeg-release-essentials.zip` 会 303 到
 *  带版本号的地址，那个 303 的目标就是下面这个，所以直接锁它，不做重定向） */
export const FFMPEG_VERSION = '9.0.2';

/** 归档缓存目录（downloads 相对；与 Node 共用同一个 .cache） */
export const DEP_CACHE_REL = 'tools/.cache';

/** 一条要落盘的文件 */
interface DepMember {
  /** 包内路径的**尾部**（`bin/ffmpeg.exe` 匹配 `ffmpeg-9.0.2-…/bin/ffmpeg.exe`） */
  from: string;
  /** 落位后的文件名（相对该依赖的落位目录；刻意压平，不保留包内的版本目录） */
  to: string;
}

/** 一份候选归档 */
export interface DepArchive {
  /** 归档文件名（缓存与离线包都用它做键） */
  file: string;
  kind: 'zip' | 'tar.gz';
  /** 依次尝试的地址（国内顺序：代理/镜像在前，官方在后） */
  urls: string[];
  /** zip：只取这些；tar.gz 且为空 = 整包展开 */
  members: DepMember[];
  /** tar 包内要剥掉的前导目录（`python/`） */
  stripPrefix?: string;
  /** 归档体积的估算（引导页显示与进度用；真实体积看服务端） */
  size: number;
}

/** 一个依赖的静态描述 */
interface DepSpec {
  id: DepId;
  /** 引导页行名（说的是「给谁干活」而不是「它叫啥」） */
  label: string;
  /** 行副标题：一句用途 */
  desc: string;
  /** 落位目录（downloads 相对） */
  dir: string;
  /** 入口文件（相对落位目录）与它对应的设置键 */
  entries: Array<{ key: DepSettingKey; rel: string }>;
  /** 验证：入口文件 → 参数 → 输出该匹配什么 */
  probes: Array<{ rel: string; args: string[]; test: RegExp }>;
}

function currentPlatform(): string {
  return typeof process !== 'undefined' && process.platform ? process.platform : 'win32';
}

function currentArch(): string {
  return typeof process !== 'undefined' && process.arch ? process.arch : 'x64';
}

/** 判定「这是真的 Python 3」的正则。
 *
 *  为什么单独导出：Windows 10/11 的 `%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe`
 *  是**应用商店别名占位符**，每台机器都有、跑起来什么都不做（要么弹商店、要么直接退出）。
 *  只看 `where python` 会把它当成「已装 Python」，等转写真跑起来才报一个看不懂的错。
 *  所以拿到输出后必须认版本号。这条判据同时服务本模块与 core/env-check 的自检行，
 *  两边各写一份正则迟早会漂。
 */
export const PYTHON_VERSION_RE = /Python\s+3\.\d+/i;

/** 设置键 → 人话（面板与自检共用的行名） */
export function depSettingLabel(key: DepSettingKey): string {
  return key === 'pythonPath' ? 'Python 路径' : key === 'ffmpegPath' ? 'ffmpeg 路径' : 'ffprobe 路径';
}

/* ==================== 规格表 ==================== */

/** 入口文件名（平台相关：POSIX 的 Python 在 bin/ 下且没有扩展名） */
function entriesOf(id: DepId, platform: string): Array<{ key: DepSettingKey; rel: string }> {
  if (id === 'python') {
    return [{ key: 'pythonPath', rel: platform === 'win32' ? 'python.exe' : 'bin/python3' }];
  }
  return platform === 'win32'
    ? [
        { key: 'ffmpegPath', rel: 'ffmpeg.exe' },
        { key: 'ffprobePath', rel: 'ffprobe.exe' },
      ]
    : [
        { key: 'ffmpegPath', rel: 'bin/ffmpeg' },
        { key: 'ffprobePath', rel: 'bin/ffprobe' },
      ];
}

export function depSpec(id: DepId, platform: string = currentPlatform()): DepSpec {
  if (id === 'python') {
    const rel = entriesOf('python', platform)[0].rel;
    return {
      id: 'python',
      label: 'Python 运行时',
      desc: `便携版 ${PYTHON_VERSION}，语音转写与脸谱工具靠它跑`,
      dir: 'tools/python',
      entries: entriesOf('python', platform),
      probes: [{ rel, args: ['-V'], test: PYTHON_VERSION_RE }],
    };
  }
  const ent = entriesOf('ffmpeg', platform);
  return {
    id: 'ffmpeg',
    label: '音视频工具（ffmpeg）',
    desc: `ffmpeg + ffprobe ${FFMPEG_VERSION}，视频压缩与录音转 wav`,
    dir: 'tools/ffmpeg',
    entries: ent,
    // ffprobe 那句输出是 `ffprobe version …`，跟 ffmpeg 的 `ffmpeg version …` 不同，
    // 所以按入口各自给正则，别图省事共用一个 `/version/`（那样装了个空壳也能过）
    probes: [
      { rel: ent[0].rel, args: ['-version'], test: /ffmpeg version/i },
      { rel: ent[1].rel, args: ['-version'], test: /ffprobe version/i },
    ],
  };
}

/* ==================== 归档地址 ==================== */

/** python-build-standalone 的产物名（平台/架构 → 三段标签） */
function pythonTriple(platform: string, arch: string): string {
  if (platform === 'win32') return `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-pc-windows-msvc`;
  if (platform === 'darwin') return `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-apple-darwin`;
  return `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-unknown-linux-gnu`;
}

/** 南京大学开源镜像站的 GitHub Release 代理（2026-11-01 实测可用且最快）。
 *
 *  路径形状 `<base>/github-release/<owner>/<repo>/<tag>/<asset>`。
 *  为什么按 tag 而不是它提供的 `LatestRelease`：`LatestRelease` 是「最新发布」的软链，
 *  上游一发新版就指向新 tag，而我们要的文件名里钉着旧 tag+版本号 → 404。
 *  按 tag 走是稳定的（实测 47MB / 13s / 3.6 MB/s，比 GitHub 直连还快一倍）。
 *
 *  这是 Python 的主通道，也是本仓「国内要有第二条腿」的落点：
 *  GitHub 直连在国内是不确定的，而 npm 有 npmmirror 这类官方镜像，Python 没有。 */
const NJU_MIRROR_BASE = 'https://mirror.nju.edu.cn/github-release';

/** gh-proxy 反代基址（**仅作最后兜底**）。
 *
 *  2026-11-01 实测：对 GitHub Release 的大资产，它 HEAD 回 200 + 正确的 Content-Length，
 *  但 GET 只给 0 字节然后挂住——比直接不通更坏，会把下载卡死十几分钟。
 *  所以它排在最后，且下载带「无进展超时」兜底（见 STALL_MS），卡住就弃掉换下一个源。
 *  同批实测：ghfast.top 超时、github.moeyy.xyz 连不上、ghp.ci 连不上、ghproxy.net 能下但只有 342 KB/s
 *  （比直连慢，所以没选它当备用）。 */
const GH_PROXY_BASE = 'https://gh-proxy.com';

/** 该依赖在该平台的候选归档（空数组 = 这个平台没有可自动下载的产物） */
export function depArchives(
  id: DepId,
  platform: string = currentPlatform(),
  arch: string = currentArch(),
): DepArchive[] {
  if (id === 'python') {
    if (!['win32', 'darwin', 'linux'].includes(platform)) return [];
    if (!['x64', 'arm64'].includes(arch)) return [];
    const file = `cpython-${PYTHON_VERSION}+${PYTHON_BUILD_TAG}-${pythonTriple(platform, arch)}-install_only.tar.gz`;
    const official = `https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_BUILD_TAG}/${file}`;
    return [
      {
        file,
        kind: 'tar.gz',
        // 通道顺序 = 实测速度顺序：南大镜像（3.6 MB/s）→ GitHub（2.3 MB/s）→ 反代兜底。
        // 前面通了后面的根本不会请求，所以顺序本身就是「优先用国内站」。
        urls: [
          `${NJU_MIRROR_BASE}/astral-sh/python-build-standalone/${PYTHON_BUILD_TAG}/${file}`,
          official,
          `${GH_PROXY_BASE}/${official}`,
        ],
        members: [], // 整包展开（标准库、DLLs、Scripts 都得在）
        stripPrefix: 'python/',
        size: pythonSizeHint(platform),
      },
    ];
  }

  // ffmpeg：只做 Windows。macOS / Linux 的静态构建是 tar.xz（BtbN）或分成两个包发
  // （evermeet.cx 的 ffmpeg 与 ffprobe 各一个 zip），core/tar 只吃 gz，硬做要多引一层
  // xz 解压器；而这两个平台上 `brew install ffmpeg` / `apt install ffmpeg` 本来就是
  // 一行的事。宁可如实说「这个平台请自己装」，也不塞一个半残的自动安装。
  if (platform !== 'win32') return [];
  if (!['x64', 'arm64'].includes(arch)) return [];
  const winArch = arch === 'arm64' ? 'winarm64' : 'win64';
  return [
    {
      // 主源是 BtbN（GitHub）：包大 60MB，但链路快一个数量级。
      // 2026-11-01 实测：gyan 150 KB/s（109MB 要 12 分钟），GitHub 2.28 MB/s（175MB 约 77 秒）。
      // 选「包大但下得快」——用户感知的是等待时间，不是字节数。
      // 代价：这个文件名里的 `latest` 是滚动 tag，内容会随上游发版漂移，所以清单里只写
      // 估算体积、不写死 sha256（与 Node 同口径：靠「下完真跑一次 -version」把住）。
      file: `ffmpeg-master-latest-${winArch}-lgpl.zip`,
      kind: 'zip',
      urls: [`https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-${winArch}-lgpl.zip`],
      members: [
        { from: `bin/ffmpeg.exe`, to: 'ffmpeg.exe' },
        { from: `bin/ffprobe.exe`, to: 'ffprobe.exe' },
      ],
      size: 168 * 1024 * 1024,
    },
    {
      // 备源：gyan 的固定版本构建。慢，但它是「版本号锁死 + 单一静态产物」，
      // 与 BtbN 那个滚动 tag 正好互补：一个快而漂移，一个慢而稳定。
      file: `ffmpeg-${FFMPEG_VERSION}-essentials_build.zip`,
      kind: 'zip',
      urls: [`https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-${FFMPEG_VERSION}-essentials_build.zip`],
      members: [
        { from: `bin/ffmpeg.exe`, to: 'ffmpeg.exe' },
        { from: `bin/ffprobe.exe`, to: 'ffprobe.exe' },
      ],
      size: 109 * 1024 * 1024,
    },
  ];
}

/** Python 归档体积的量级估算（引导页显示用；Windows 的包明显更大，因为带全套 .pyd/DLL） */
function pythonSizeHint(platform: string): number {
  return (platform === 'win32' ? 45 : 24) * 1024 * 1024;
}

/** 归档体积的护栏（下载/解压异常大的包直接拒收；ffmpeg 备源就 168MB，留到 400MB） */
const MAX_ARCHIVE_BYTES = 400 * 1024 * 1024;
/** 解包上限（Python 整包约 4000 文件 / 解出 120MB，远超 core/tar 给插件小包的缺省值） */
const UNTAR_HARD_LIMITS = { maxEntries: 20000, maxTotalBytes: 600 * 1024 * 1024 };

/* ==================== 探测 ==================== */

/** 一个入口的解析结果 */
export interface DepEntry {
  key: DepSettingKey;
  /** 入口文件名（展示用，如 `ffmpeg.exe`） */
  name: string;
  /** 解析到的绝对路径（未找到 = 空串） */
  path: string;
}

/** 依赖的当前状态 */
export interface DepState {
  id: DepId;
  /** 全部入口都解析到、且都跑得起来 */
  ok: boolean;
  /** 从哪来的：设置里填的 / 插件内便携 / PATH / 没有 */
  via: 'settings' | 'bundled' | 'path' | 'none';
  /** 每个入口的解析结果（ffmpeg 有两个；面板与自检按这个逐条列） */
  entries: DepEntry[];
  /** 版本串（拿到才填，`via='none'` 时为空） */
  version: string;
  /** 设置里配了但对不上文件的那条原文（提示用：不要悄悄换成另一份还说没问题） */
  stale?: string;
}

/** spawn 用子进程模块（桌面端才有） */
function childProcess(): any {
  if (typeof window === 'undefined') return null;
  try {
    return (window as any).require?.('child_process') ?? null;
  } catch {
    return null;
  }
}

/** 文件存在性探测的注入缝（仅测试用；生产恒走桌面端 fs）。
 *  沿用 core/tool-runtime 的 `setFsProbe` 同一套约定——测试环境没有 `window.require('fs')`。 */
let fsProbe: ((p: string) => boolean) | null = null;

/** 注入文件探测（仅测试） */
export function setDepFsProbe(fn: ((p: string) => boolean) | null): void {
  fsProbe = fn;
}

function existsOnDisk(p: string): boolean {
  if (!p) return false;
  if (fsProbe) return !!fsProbe(p);
  if (typeof window === 'undefined') return false;
  try {
    const fs = (window as any).require?.('fs');
    return !!fs?.existsSync?.(p);
  } catch {
    return false;
  }
}

/** PATH 上找一个可执行（`where` / `which`）；找不到 → 空串 */
function findOnPath(name: string): string {
  const cp = childProcess();
  if (!cp?.spawnSync) return '';
  const cmd = currentPlatform() === 'win32' ? 'where' : 'which';
  try {
    const r = cp.spawnSync(cmd, [name], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    if (r?.status !== 0) return '';
    return (
      String(r.stdout || '')
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter(Boolean)[0] || ''
    );
  } catch {
    return '';
  }
}

/** 跑一次探针拿版本串（跑不起来 → 空串） */
function probeVersion(binPath: string, args: string[], test: RegExp): string {
  const cp = childProcess();
  if (!cp?.spawnSync || !binPath) return '';
  try {
    // 30s 而不是 5s：与 node-runtime-install 同一个理由——首次执行一个刚下下来的大 exe，
    // Defender 会当场全量扫一遍，冷机十几秒；超时被 kill 会被误判成「装了但跑不起来」。
    const r = cp.spawnSync(binPath, args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    const out = `${r?.stdout || ''}${r?.stderr || ''}`;
    return test.test(out) ? out.trim().split(/\r?\n/)[0] : '';
  } catch {
    return '';
  }
}

/**
 * 解析一个入口：设置里填的 → 插件内便携 → PATH。
 * @returns 路径与来源；三者都没有 → 空串 + `none`
 */
function resolveEntry(
  key: DepSettingKey,
  rel: string,
  configured: string,
  bundledAbs: string,
): { path: string; via: 'settings' | 'bundled' | 'path' | 'none'; stale?: string } {
  const raw = String(configured || '').trim();
  if (raw) {
    // 带分隔符 = 用户填的绝对/相对路径；否则是裸命令名（占位符那种 `python` / `ffmpeg`）
    const looksPath = /[\\/]/.test(raw) || /^[A-Za-z]:/.test(raw);
    if (looksPath) {
      if (existsOnDisk(raw)) return { path: raw, via: 'settings' };
      // 配了但对不上：记下来，别静默换成别的还装没事
      return { path: '', via: 'none', stale: `${key} 指向的 ${raw} 不存在` };
    }
    const onPath = findOnPath(raw);
    if (onPath) return { path: onPath, via: 'settings' };
    return { path: '', via: 'none', stale: `${key} 填的是 ${raw}，但 PATH 上找不到它` };
  }
  if (existsOnDisk(bundledAbs)) return { path: bundledAbs, via: 'bundled' };
  const name = rel.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '');
  const onPath = findOnPath(name);
  if (onPath) return { path: onPath, via: 'path' };
  return { path: '', via: 'none' };
}

/** 依赖的落位目录绝对路径（插件目录相对，含 downloads/） */
export function depDirAbs(app: unknown, id: DepId): string {
  const dir = pluginDirOf(app);
  return dir ? `${dir}/${DOWNLOADS_DIR}/${depSpec(id).dir}` : '';
}

/**
 * 探测一个依赖（不写盘、不改设置、不抛错）。
 * 不缓存：这三样都是几次 stat，面板与自检调用频率低，省下的时间不够补缓存失效的坑。
 */
export function probeDep(app: unknown, id: DepId, platform: string = currentPlatform()): DepState {
  const spec = depSpec(id, platform);
  const settings = (tryGetSettings() || {}) as Record<string, unknown>;
  const entries: DepEntry[] = [];
  let stale = '';
  let via: DepState['via'] = 'none';
  let version = '';

  for (const e of spec.entries) {
    const r = resolveEntry(e.key, e.rel, String(settings[e.key] ?? ''), `${depDirAbs(app, id)}/${e.rel}`);
    entries.push({ key: e.key, name: e.rel.replace(/^.*[\\/]/, ''), path: r.path });
    if (r.stale && !stale) stale = r.stale;
    // 来源取「最弱的那一环」的：ffmpeg 一个走设置、一个走 PATH，整体算混合，别报「设置」
    if (r.via !== 'none' && via === 'none') via = r.via;
    else if (r.via !== 'none' && r.via !== via) via = 'bundled';
  }

  // 每个入口都要真跑一次：文件在 ≠ 能跑（半截下载、被 Defender 隔离、缺 DLL 都长一个样）
  let allOk = true;
  for (const p of spec.probes) {
    const target = entries.find((e) => e.name === p.rel.replace(/^.*[\\/]/, ''));
    if (!target?.path) {
      allOk = false;
      continue;
    }
    const v = probeVersion(target.path, p.args, p.test);
    if (!v) {
      allOk = false;
      continue;
    }
    if (!version) version = v;
  }

  return { id, ok: allOk, via: allOk ? via : 'none', entries, version, stale: stale || undefined };
}

/* ==================== 设置对齐 ==================== */

/**
 * 把「插件内便携已就位」的路径写进设置（幂等；无变更 → 返回 false）。
 *
 * 为什么必须有这一步：留空 = 走 PATH，而便携包不在 PATH 上。装完了不写设置，
 * 工具包拿到的是裸 `python`，于是「包明明在插件目录里、转写还是报找不到 Python」。
 * 这条错在早期 Node 上没有（Node 是插件自己 spawn 的，探到就算数），但 Python/ffmpeg
 * 是**下发给外部工具**的，路径得显式交代。
 *
 * 只写两种情况：设置是空的、或设置指向的文件已经不在（失效配置留着只会让人以为配好了）。
 * 用户填了个好的绝对路径 → 一个字都不动。
 */
export async function ensureDepSettings(app: unknown, id: DepId, platform: string = currentPlatform()): Promise<boolean> {
  const spec = depSpec(id, platform);
  const s = (tryGetSettings() || {}) as Record<string, unknown>;
  const writes: Array<{ key: DepSettingKey; value: string }> = [];

  for (const e of spec.entries) {
    const abs = `${depDirAbs(app, id)}/${e.rel}`;
    if (!existsOnDisk(abs)) continue; // 插件内没有 → 不碰这个键
    const cur = String(s[e.key] ?? '').trim();
    if (cur) {
      // 填的是绝对路径且还在 → 尊重；填的是裸命令名 → 也尊重（那是「走 PATH」的显式意图）
      const looksPath = /[\\/]/.test(cur) || /^[A-Za-z]:/.test(cur);
      if (!looksPath || existsOnDisk(cur)) continue;
    }
    writes.push({ key: e.key, value: abs });
  }
  if (!writes.length) return false;

  try {
    const settings = getSettings() as unknown as Record<string, unknown>;
    for (const w of writes) settings[w.key] = w.value;
    await saveSettings();
    return true;
  } catch {
    return false;
  }
}

/* ==================== 安装 ==================== */

export interface DepInstallDeps {
  fetchBytes?: (url: string) => Promise<Uint8Array>;
  gunzip?: (data: Uint8Array) => Uint8Array;
  inflateRaw?: (data: Uint8Array) => Uint8Array;
  platform?: string;
  arch?: string;
  /** 阶段人话（「正在下载」「正在解压 1200/4000」这类） */
  onStage?: (stage: string) => void;
  /** 进度（已收 / 总字节；总字节 0 = 未知） */
  onProgress?: (received: number, total: number) => void;
}

export interface DepInstallResult {
  id: DepId;
  /** 落位目录绝对路径 */
  dir: string;
  /** 每个入口的绝对路径 */
  entries: Array<{ key: DepSettingKey; path: string }>;
  /** 版本串（探针输出） */
  version: string;
  bytes: number;
}

interface AdapterLike {
  readBinary?: (p: string) => Promise<ArrayBuffer>;
  writeBinary?: (p: string, d: ArrayBuffer) => Promise<void>;
  remove?: (p: string) => Promise<void>;
  mkdir?: (p: string) => Promise<void>;
  rmdir?: (p: string, recursive?: boolean) => Promise<void>;
}

function adapterOf(app: unknown): AdapterLike | null {
  return (app as { vault?: { adapter?: AdapterLike } })?.vault?.adapter ?? null;
}

async function readCached(app: unknown, file: string): Promise<Uint8Array | null> {
  const a = adapterOf(app);
  if (!a?.readBinary) return null;
  try {
    const ab = await a.readBinary(downloadsVaultPath(app, `${DEP_CACHE_REL}/${file}`));
    const bytes = new Uint8Array(ab);
    return bytes.byteLength > 1024 ? bytes : null;
  } catch {
    return null;
  }
}

async function writeCached(app: unknown, file: string, bytes: Uint8Array): Promise<void> {
  const a = adapterOf(app);
  if (!a?.writeBinary) return;
  try {
    await ensureDir(app, `${DEP_CACHE_REL}/${file}`);
    await a.writeBinary(
      downloadsVaultPath(app, `${DEP_CACHE_REL}/${file}`),
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    );
  } catch {
    /* 缓存是加速手段，不是正确性的一部分 */
  }
}

function defaultGunzip(bytes: Uint8Array): Uint8Array {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const zlib = w?.require?.('zlib');
  if (!zlib?.gunzipSync) throw new Error('当前环境不支持解压（本地运行时需要桌面端）');
  const Buf: any = typeof Buffer !== 'undefined' ? Buffer : w?.require?.('buffer')?.Buffer;
  if (!Buf) throw new Error('当前环境不支持解压（缺少 Buffer）');
  const out = zlib.gunzipSync(Buf.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

async function defaultFetch(url: string, onProgress?: (r: number, t: number) => void): Promise<Uint8Array> {
  const streamed = await fetchBytesWithProgress(url, onProgress);
  if (streamed && streamed.byteLength) return streamed;
  const res = await requestUrl({ url, method: 'GET', throw: true });
  const ab = (res as { arrayBuffer?: ArrayBuffer }).arrayBuffer;
  if (!ab) throw new Error('响应没有二进制体');
  return new Uint8Array(ab);
}

/**
 * 无进展超时（秒）：超过这么久没收到任何**新字节**就弃掉这个源。
 *
 * 为什么要有它：`fetchBytesWithProgress` 与 `requestUrl` 都没有超时。2026-11-01 实测
 * gh-proxy 对 GitHub 大资产回 200 + 正确 Content-Length，然后**一个字节都不给**——
 * fetch 会一直挂在那儿，用户看到的是「正在下载」再也不动，十几分钟后才轮到下一个源。
 *
 * 45 秒这个值：就算链路只有 150 KB/s（实测 gyan 那个），45 秒也能收 6-7 MB，
 * 所以「45 秒零字节」一定是卡死，不是慢。慢链路只要还在来数据就永远不触发。
 */
const STALL_MS = 45 * 1000;

async function downloadWithStallGuard(
  url: string,
  onProgress?: (r: number, t: number) => void,
): Promise<Uint8Array> {
  let lastAt = Date.now();
  const work = defaultFetch(url, (got, total) => {
    lastAt = Date.now();
    onProgress?.(got, total);
  });
  const guard = new Promise<never>((_, reject) => {
    const timer = setInterval(() => {
      if (Date.now() - lastAt >= STALL_MS) {
        clearInterval(timer);
        reject(new Error(`${Math.round(STALL_MS / 1000)} 秒没有收到数据（这条通道卡住了）`));
      }
    }, 5000);
    // 下载结束后停表，否则定时器空转到进程结束
    void work.then(
      () => clearInterval(timer),
      () => clearInterval(timer),
    );
  });
  // race 之后 work 仍在跑（fetch 没法从外部中止），泄漏一次请求换「不卡死」是划算的：
  // 这一层只在装依赖时走一次，且卡住的请求不会写盘。
  return Promise.race([work, guard]);
}

/** 清空落位目录（失败 → 忽略，逐文件覆盖会兜住） */
async function clearDir(app: unknown, rel: string): Promise<void> {
  try {
    await adapterOf(app)?.rmdir?.(downloadsVaultPath(app, rel), true);
  } catch {
    /* 不存在 / 不支持递归 */
  }
}

/**
 * 从一份归档装出依赖目录。
 * 缓存、离线包、网络三条来源共用这一步——三种来源的「装」必须完全一样，
 * 否则会出现「网上下的能跑、缓存装的不能跑」这种只在一部分人身上复现的问题。
 */
async function installFromArchive(
  app: unknown,
  id: DepId,
  archive: Uint8Array,
  plan: DepArchive,
  deps: DepInstallDeps,
): Promise<DepInstallResult> {
  const platform = deps.platform ?? currentPlatform();
  const spec = depSpec(id, platform);
  const adapter = adapterOf(app);
  if (!adapter?.writeBinary) throw new Error('当前环境无法写入二进制文件（本地运行时需要桌面端）');

  if (archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error(`归档体积异常（${archive.byteLength} 字节）`);
  }

  await clearDir(app, spec.dir);
  let bytes = 0;
  let count = 0;

  if (plan.kind === 'zip') {
    // zip：只抽需要的条目（ffmpeg 那 109MB 里 ffplay.exe 占了三分之一，用不上，不落盘）
    deps.onStage?.('正在解压');
    const entries = readZipEntries(archive);
    for (const m of plan.members) {
      const e = findZipEntry(entries, m.from);
      if (!e) throw new Error(`${plan.file} 里没有 ${m.from}`);
      const data = extractZipEntry(archive, e, { inflateRaw: deps.inflateRaw });
      const rel = `${spec.dir}/${m.to}`;
      await ensureDir(app, rel);
      await adapter.writeBinary(
        downloadsVaultPath(app, rel),
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
      );
      bytes += data.byteLength;
      count += 1;
    }
  } else {
    // tar.gz：整包展开（Python 的标准库、DLLs、Scripts 一个都不能少）
    deps.onStage?.('正在解压');
    const files: TarFile[] = untar((deps.gunzip ?? defaultGunzip)(archive), UNTAR_HARD_LIMITS);
    const strip = plan.stripPrefix || '';
    let lastDir = '';
    let i = 0;
    for (const f of files) {
      const rel0 = strip && f.path.startsWith(strip) ? f.path.slice(strip.length) : f.path;
      if (!rel0) continue;
      const rel = `${spec.dir}/${rel0}`;
      const dirPart = rel.slice(0, rel.lastIndexOf('/'));
      // 四千多个文件逐个 ensureDir 是几千次 IO：同一目录内复用上一次的结果
      if (dirPart !== lastDir) {
        await ensureDir(app, rel);
        lastDir = dirPart;
      }
      await adapter.writeBinary(
        downloadsVaultPath(app, rel),
        f.data.buffer.slice(f.data.byteOffset, f.data.byteOffset + f.data.byteLength) as ArrayBuffer,
      );
      bytes += f.data.byteLength;
      count += 1;
      if (++i % 500 === 0) deps.onStage?.(`正在写入 ${i}/${files.length}`);
    }
  }
  if (!count) throw new Error(`${plan.file} 里没有可落盘的文件`);

  deps.onStage?.('正在验证');
  const absDir = depDirAbs(app, id);
  let version = '';
  for (const p of spec.probes) {
    const v = probeVersion(`${absDir}/${p.rel}`, p.args, p.test);
    if (!v) {
      // 验不过就删干净：留一个跑不起来的目录在盘上，探测会判「已有运行时」，
      // 症状变成「装好了但一用就失败」，比没装更难查（沿用 Node 那条口径）
      await clearDir(app, spec.dir);
      throw new Error(`下载的 ${spec.label} 无法运行（可能是网络中断或文件被拦截）`);
    }
    if (!version) version = v;
  }

  // 最后一步：把绝对路径写进设置（不然工具包拿到的是裸命令名，走 PATH 找不到）
  await ensureDepSettings(app, id, platform);

  return {
    id,
    dir: absDir,
    entries: spec.entries.map((e) => ({ key: e.key, path: `${absDir}/${e.rel}` })),
    version,
    bytes,
  };
}

/**
 * 下载并安装一个依赖到插件目录。失败一律抛错（含平台不支持 / 双源都不通 / 装起来跑不了）。
 */
export async function installDep(
  app: unknown,
  id: DepId,
  deps: DepInstallDeps = {},
): Promise<DepInstallResult> {
  const platform = deps.platform ?? currentPlatform();
  const arch = deps.arch ?? currentArch();
  const plans = depArchives(id, platform, arch);
  const label = depSpec(id, platform).label;
  if (!plans.length) {
    throw new Error(
      platform === 'win32'
        ? `本平台架构（${arch}）没有可自动下载的 ${label}`
        : `${label} 在这台机器上请用系统包管理器安装（macOS：brew install ffmpeg；Linux：apt install ffmpeg），bz 只做探测`,
    );
  }

  let lastErr = '';
  for (const plan of plans) {
    // ① 归档缓存（Defender 隔离了 exe 时，这一步能免掉重下上百兆）
    const cached = await readCached(app, plan.file);
    if (cached) {
      try {
        deps.onStage?.('用上次下载的归档重装（不联网）');
        return await installFromArchive(app, id, cached, plan, deps);
      } catch (e) {
        lastErr = `缓存归档不可用：${(e as Error)?.message || String(e)}`;
        await adapterOf(app)?.remove?.(downloadsVaultPath(app, `${DEP_CACHE_REL}/${plan.file}`));
      }
    }

    // ② 离线包（`<vault>/bz-offline/dep/<归档>`）：封闭网络里它是唯一来源
    try {
      const offline = await readOfflineBytes(app, `dep/${plan.file}`);
      if (offline && offline.byteLength > 0) {
        deps.onStage?.(`用离线包安装${label}`);
        const r = await installFromArchive(app, id, offline, plan, deps);
        await writeCached(app, plan.file, offline);
        return r;
      }
    } catch {
      /* 没有离线包 */
    }

    // ③ 逐源下载
    for (const url of plan.urls) {
      try {
        deps.onStage?.(`正在下载${label}（约 ${Math.round(plan.size / 1024 / 1024)} MB）`);
        const archive = deps.fetchBytes
          ? await deps.fetchBytes(url)
          : await downloadWithStallGuard(url, (got, total) => deps.onProgress?.(got, total));
        if (!archive.byteLength) {
          lastErr = `${url} 返回空内容`;
          continue;
        }
        const r = await installFromArchive(app, id, archive, plan, deps);
        await writeCached(app, plan.file, archive);
        return r;
      } catch (e) {
        lastErr = `${url} → ${(e as Error)?.message || String(e)}`;
      }
    }
  }
  throw new Error(`${label}安装失败：${lastErr}`);
}

/* ==================== 完整依赖清单（不在下载队列里的那些） ==================== */

/**
 * 引导页的下载队列只管「bz 自己能搬进插件目录」的东西（Node / 工具包 / Python / ffmpeg）。
 * 剩下这些搬不动、也不该搬——但**它们是功能的前提**，用户必须知道存在：
 *
 * | 这一类 | 为什么不能进队列 |
 * |---|---|
 * | 云端 AI 密钥 | 不是安装，是「去申请一个」 |
 * | Ollama | 通用服务，机器上可能已有一份在给别的东西用；自带一份会变成两个端口、两套模型缓存 |
 * | 向量模型 | 几个 GB，且要落在 Ollama 自己的模型目录里（不归 bz 管） |
 * | Python 包 | pip 装 2GB 级依赖，必须用户点头；bz 只能代跑命令，不能静默做 |
 * | 转写模型 | 首次转写时由 modelscope 自动下，提前下纯占地方 |
 *
 * 这张表就是完成屏「还需要装什么」的全部内容。**加新依赖请加在这里**，
 * 别在弹窗里现写一段文案——那是下一个人找不到的第二个事实源。
 */
export interface DepGuideRow {
  /** 分组（渲染时按它聚合，顺序 = 首次出现顺序） */
  group: string;
  /** 要装的东西 */
  name: string;
  /** 服务于什么——写功能名，不写模块名 */
  serves: string;
  /** 怎么装；`{python}` 会替换成本机探测到的 Python 绝对路径 */
  how: string;
  /** 体积（人话；未知/不需要 = 空） */
  size?: string;
  /** 有探测判据的那几项填这个（渲染时按实际情况打勾/标缺） */
  probe?: 'ai' | 'ollama' | 'embedding' | 'asr-model';
}

export const EXTRA_DEP_GUIDE: DepGuideRow[] = [
  /* ---- 云端 AI ---- */
  {
    group: '云端 AI（可选，但一半功能靠它）',
    name: '一个 AI 服务商的密钥',
    serves: '文档摘要、小橘对话、转写后的错别字校对',
    how: '设置 → AI → LLM 里选服务商填密钥。DeepSeek 有免费额度；不填也能用，只是这些功能关着。',
    probe: 'ai',
  },

  /* ---- 本地向量检索 ---- */
  {
    group: '本地向量检索（第二大脑 / 小橘记忆）',
    name: 'Ollama',
    serves: '第二大脑的语义检索、小橘的记忆库——负责把笔记变成向量',
    how:
      '到 ollama.com/download 下安装包，双击装完它自己常驻 11434 端口。装完回「设置 → 关于 → 环境自检」会看到它。\n' +
      '已经装了但用不了，多半是它没在跑：Windows 从开始菜单打开 Ollama（或在命令行跑 `ollama serve`），' +
      'macOS 打开 Ollama.app——托盘出现羊驼图标才算起来了。',
    size: '约 1 GB',
    probe: 'ollama',
  },
  {
    group: '本地向量检索（第二大脑 / 小橘记忆）',
    name: '向量模型 bge-m3',
    serves: '同上：真正干「把文字变成一串数字」这活的东西',
    how: '装完 Ollama 后跑 `ollama pull bge-m3`；或在「设置 → AI → Embedding」点「获取模型」选它。',
    size: '约 1.2 GB',
    probe: 'embedding',
  },
  {
    group: '本地向量检索（第二大脑 / 小橘记忆）',
    name: '（可选）换成 qwen3-embedding:8b',
    serves: '检索更准，代价是体积和显存',
    how: '`ollama pull qwen3-embedding:8b`，再在「设置 → AI → Embedding」里选它。本地重排也认这个模型，换过去才会启用。',
    size: '约 4.7 GB',
  },

  /* ---- 语音转写 ---- */
  {
    group: '语音转写（知识盒视频转文字 / 脸谱语音条）',
    name: 'funasr + torch',
    serves: '缺省引擎 SenseVoice-Small 的 Python 依赖',
    how:
      '这两句要分开跑（torch 的 CPU 轮子在自己的源上，funasr 在 PyPI）：\n' +
      '`{python} -m pip install torch --index-url https://download.pytorch.org/whl/cpu`\n' +
      '`{python} -m pip install funasr`',
    size: '约 2 GB',
  },
  {
    group: '语音转写（知识盒视频转文字 / 脸谱语音条）',
    name: '（备选引擎）faster-whisper',
    serves: '「设置 → AI → 语音转写」里换引擎时才需要',
    how: '`{python} -m pip install faster-whisper`',
    size: '约 300 MB + 模型',
  },
  {
    group: '语音转写（知识盒视频转文字 / 脸谱语音条）',
    name: '（脸谱）pycryptodome',
    serves: '脸谱导入微信聊天记录时需要',
    how: '`{python} -m pip install pycryptodome`',
    size: '约 3 MB',
  },
  {
    group: '语音转写（知识盒视频转文字 / 脸谱语音条）',
    name: '转写模型 SenseVoice-Small',
    serves: '识别中文语音的模型本体',
    how: '不用管：第一次转写时自动从 modelscope 下到 Python 的缓存目录。想换位置就在「设置 → AI → 语音转写 → 模型目录」里指定。',
    size: '约 1 GB',
    probe: 'asr-model',
  },

  /* ---- 可选凭据 ---- */
  {
    group: '可选凭据（不填也能跑，只是成功率低一些）',
    name: '豆瓣 Cookie',
    serves: '影院的条目抓取与片单导入',
    how: '浏览器登录豆瓣后复制请求头里的 Cookie，粘进「设置 → AI → 数据源凭据」。',
  },
  {
    group: '可选凭据（不填也能跑，只是成功率低一些）',
    name: 'B 站 Cookie',
    serves: '知识盒下载视频时能选到更高清晰度',
    how: '同上，在「设置 → AI → 数据源凭据 → B 站 Cookie」。桌面端还有「从 CLI 导入」读本机 ~/.bilibili-cookies.json。',
  },
];

/** 依赖未就绪时指向的设置位置（唯一出处；别在别处再拼一遍这句话） */
export const DEP_SETTINGS_HINT = '「设置 → AI → 外部工具」';

/** 「未找到 X：到 … 里填路径，或让引导页帮你装一份」 */
export function depMissingHint(label = '本地运行时'): string {
  return `未找到${label}：到${DEP_SETTINGS_HINT}里填路径，或在首次引导 / 环境自检里让 bz 装一份`;
}

/** 依赖装完后的占用概览（设置面板与清理入口用） */
export function depRootRel(): string {
  return 'tools';
}
