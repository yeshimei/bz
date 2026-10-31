/* ============================================================
 * bz · 外部工具的运行时解析（core/tool-runtime.ts）
 *
 * 两件事分开：
 *   1. **包**从在线资源下载进插件目录（`downloads/tools/<id>/`，见 core/bundle-asset.ts）；
 *   2. **解释器**按「插件内便携 node → 系统 node」的顺序探测。
 *
 * 口径：**只认本地包**（2026-10-28 用户拍板）。此前还有一条「PATH 上全局装的命令」兜底，
 * 它带来两个真问题：一是同一台机器上可能有开发期的旧版/自建版，插件以为自己带着工具、
 * 实际跑的是别处那个；二是状态面只能说「用系统里已装的命令」——用户看不出插件到底下没下过。
 * 所以现在**没有 PATH 回落**：本地包不在 → 未安装，去「在线资源」下一份。
 * 探测与启动因此是同一个判据（`toolReadyState` / `resolveToolBase` 共用），不会出现
 * 「面板说就绪、起跑时找不到命令」。
 *
 * 为什么不用 Obsidian 自己的 exe 当 node：**实测不可行**（2026-10-28）。Obsidian 关掉了
 * Electron 的 `runAsNode` fuse，`ELECTRON_RUN_AS_NODE=1 obsidian.exe script.js` 会把它
 * 当成 Obsidian 自己的 CLI 命令，回一句 `Command "…" not found`。所以解释器只能另找。
 *
 * 附带的好处：本地包走 `shell:false` + 参数数组。此前 `.cmd` shim 必须 `shell:true`，
 * 而 cmd 对引号、空格、中文、`&` 的解析规则是 Windows 上最经典的一类坑（vault 路径带
 * 空格或中文是常态）。数组参数没有这一层，路径原样到达进程。
 * ============================================================ */
import { DOWNLOADS_DIR, downloadsVaultPath } from './remote-asset';
import { BUNDLE_MARKER } from './bundle-asset';
import { bundledNodeFile, NODE_RUNTIME_DIR } from './node-runtime-install';
import { pluginDirOf, vaultBasePathOf } from './plugin-path';
import { getApp } from './app';
import { toolMissingHint } from './tool-hint';

/** 工具 id（= online 资源 id = downloads/tools/ 下的目录名） */
export type ToolId = 'bili-downloader' | 'obsidian-face' | 'dock-watch';

/** 包内的入口脚本（相对包根） */
export interface ToolEntry {
  /** 包内入口脚本（相对 downloads/tools/<id>/） */
  script: string;
  /** 人话名字（错误消息与面板行名共用） */
  label: string;
}

export const TOOL_ENTRIES: Record<ToolId, ToolEntry> = {
  // 2026-10-29 用户拍板改名：行名是「给谁干活」而不是「工具本身叫啥」——
  // bili-downloader 只服务知识盒的批量下载，叫「B站下载器」会让人以为它是个通用下载器；
  // dock-watch 也不只是一段值守进程，它带着安装/卸载脚本，是个完整的工具坞配套包。
  'bili-downloader': { script: 'cli.js', label: '知识盒工具包' },
  'obsidian-face': { script: 'bin/bz-face.js', label: '脸谱工具包' },
  'dock-watch': { script: 'cli.js', label: '工具坞工具包' },
};

/** 工具 id 的固定顺序（面板行序、诊断行序共用；不随清单来，网络不通时也照样列得出来） */
export const TOOL_IDS: ToolId[] = ['bili-downloader', 'dock-watch', 'obsidian-face'];

/**
 * 工具 id → 在线资源清单里的行 id。
 *
 * `tool-` 前缀是清单侧的分组线索（bundle 类条目都带），面板靠它把三行归进「外部工具」组。
 * 写在一处，别在面板里现拼字符串——拼错的结果是工具静默混进在线资源组。
 */
export function toolManifestId(id: ToolId): string {
  return `tool-${id}`;
}

/** Node 运行时探测结果 */
export interface NodeRuntime {
  /** `bundled` = 插件目录下的便携 node；`system` = PATH 上的；`none` = 都没有 */
  kind: 'bundled' | 'system' | 'none';
  /** 可执行文件绝对路径（none 时为空串） */
  path: string;
  /** 版本串（拿到才填；探测不到不影响可用性判断） */
  version: string;
}

/** 解析结果：直接喂给 runExternalTool 的 spec 片段 */
export interface ResolvedToolCommand {
  /** 可执行文件绝对路径；`via='none'` 时为空串 */
  cmd: string;
  args: string[];
  /** 恒为 false（本地包走数组参数） */
  shell: boolean;
  /** 这次走的是本地包还是根本没有（调用方据此说人话；`none` 时不要 spawn） */
  via: 'bundle' | 'none';
}

function isWindows(): boolean {
  return typeof process !== 'undefined' && process.platform === 'win32';
}

/** 便携 node 的落位目录（与 node-runtime-install 同一常量，避免两处各写一份） */
const BUNDLED_NODE_DIR = NODE_RUNTIME_DIR;

// vaultBasePathOf / pluginDirOf 的唯一实现在 core/plugin-path（插件目录名由用户决定，
// 写死 `plugins/bz` 会让「下载落位」与「探测口径」错位，表现为下载成功但功能不可用）——
// 这里 re-export，既有导入路径不变。
export { pluginDirOf, vaultBasePathOf };

/** 已下载的包目录（相对 downloads/） */
export function toolBundleDir(id: ToolId): string {
  return `${DOWNLOADS_DIR}/tools/${id}`;
}

/** 本地 node 与工具入口在文件系统上的绝对路径（相对路径拼在插件目录后面） */
function fsPath(app: unknown, rel: string): string {
  const dir = pluginDirOf(app);
  return dir ? `${dir}/${rel}` : '';
}

/** spawn 用子进程模块（桌面端才有；移动端 → null） */
function childProcess(): any {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (!w?.require) return null;
  try {
    return w.require('child_process');
  } catch {
    return null;
  }
}

/** 文件是否存在（用 fs 直查——这条路径在插件目录里，不走 vault 索引）。
 *  测试环境没有 `window.require`，用 `setFsProbe` 注入一个假的。 */
let fsProbe: ((p: string) => boolean) | null = null;

/** 注入文件探测（仅测试用；生产恒走桌面端 fs） */
export function setFsProbe(fn: ((p: string) => boolean) | null): void {
  fsProbe = fn;
  cachedNode = null;
}

function existsOnDisk(p: string): boolean {
  if (!p) return false;
  if (fsProbe) return fsProbe(p);
  const w = typeof window !== 'undefined' ? (window as any) : null;
  try {
    const fs = w?.require?.('fs');
    if (fs?.existsSync) return !!fs.existsSync(p);
  } catch {
    /* 移动端 / 无 node integration */
  }
  return false;
}

/** 会话级缓存：node 探测每次开面板都跑一遍 spawnSync 没必要 */
let cachedNode: NodeRuntime | null = null;

/** 重置探测缓存（测试用 / 用户刚下载完便携 node） */
export function resetNodeRuntimeCache(): void {
  cachedNode = null;
}

/**
 * 探测 Node 运行时（带会话缓存）。
 * 顺序：插件目录里的便携 node → PATH 上的 node → none。
 * **不抛错**：探测不到是正常结局（调用方据此给「去下载」的指引）。
 */
export function probeNodeRuntime(app: unknown, opts: { fresh?: boolean } = {}): NodeRuntime {
  if (!opts.fresh && cachedNode) return cachedNode;

  const bundled = fsPath(app, `${BUNDLED_NODE_DIR}/${bundledNodeFile()}`);
  if (existsOnDisk(bundled)) {
    const v = nodeVersionOf(bundled);
    cachedNode = { kind: 'bundled', path: bundled, version: v };
    return cachedNode;
  }

  const cp = childProcess();
  const sysPath = findOnPath(cp, 'node');
  if (sysPath) {
    cachedNode = { kind: 'system', path: sysPath, version: nodeVersionOf(sysPath) };
    return cachedNode;
  }

  cachedNode = { kind: 'none', path: '', version: '' };
  return cachedNode;
}

/** `node -v` 拿版本串（失败 → 空串；不阻断可用性判断） */
function nodeVersionOf(nodePath: string): string {
  const cp = childProcess();
  if (!cp?.spawnSync) return '';
  try {
    const r = cp.spawnSync(nodePath, ['-v'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    return String(r?.stdout || '').trim();
  } catch {
    return '';
  }
}

/** PATH 上找一个可执行（`where` / `which`）；找不到 → 空串。
 *  **只用来找 node**：外部工具本身只认插件目录里的包，不再回落到 PATH（见文件头）。 */
function findOnPath(cp: any, name: string): string {
  if (!cp?.spawnSync) return '';
  const cmd = isWindows() ? 'where' : 'which';
  try {
    const r = cp.spawnSync(cmd, [name], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    if (r?.status !== 0) return '';
    const first = String(r.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || '';
    return first;
  } catch {
    return '';
  }
}

/** 只解析「用谁跑」（不涉及业务参数）——域侧自己拼 args 时用这个 */
export interface ToolCommandBase {
  /** 可执行文件绝对路径；`via='none'` 时为空串（域侧据此给「去下载」的引导，别 spawn 空串） */
  cmd: string;
  /** true = 经 shell 启动。本地包恒为 `false`（数组参数，路径不过 cmd 解析） */
  shell: boolean;
  /** 这次走的是本地包还是根本没有（没有 PATH 回落） */
  via: 'bundle' | 'none';
}

/**
 * 解析工具的命令行（不含业务参数）。
 *
 * 只有一条路：本地包在（`downloads/tools/<id>/<script>` 存在）**且**有 node →
 * 绝对路径 + `shell:false`；否则 `via:'none'`（cmd 为空串）。
 *
 * 调用方**必须看 `via`**：`none` 意味着这台机器上没这份工具，该说的是「去下载」，
 * 而不是 spawn 一个空命令名（Windows 下 `shell:true` 配空命令会起一个空 cmd，
 * 退出码 0 —— 看起来「跑完了」，实际什么都没做）。
 */
export function resolveToolBase(app: unknown, id: ToolId): ToolCommandBase {
  const script = fsPath(app, `${toolBundleDir(id)}/${TOOL_ENTRIES[id].script}`);
  const node = probeNodeRuntime(app);
  if (script && node.kind !== 'none' && existsOnDisk(script)) {
    return { cmd: node.path, shell: false, via: 'bundle' };
  }
  return { cmd: '', shell: false, via: 'none' };
}

/** `safeToolBase` 的测试注入缝（纯函数 builder 在单测里没有 app，又确实需要一条命令） */
let baseProbe: ((id: ToolId) => ToolCommandBase) | null = null;

/** 注入命令解析结果（仅测试用；生产恒走 `resolveToolBase`） */
export function setToolBaseProbe(fn: ((id: ToolId) => ToolCommandBase) | null): void {
  baseProbe = fn;
}

/** 「没有任务书」的解析结果（app 早期/非桌面端）：如实说没有，不编一条命令出来 */
const NO_TOOL: ToolCommandBase = { cmd: '', shell: false, via: 'none' };

/**
 * `resolveToolBase` 的**不跑版**：app 还没初始化（单测 / 早期调用）时不抛，返回「没有」。
 *
 * 存在的理由：域侧那几个 `buildXxxSpec` 是纯函数、被单测直接调（没有 app），但它们
 * 又确实需要知道「这台机器上该用哪条命令」。让它们全部多一个 `command` 参数，会把
 * 「谁负责解析运行时」这件事散到每个调用点；这里集中收口一次，纯函数内部调它即可。
 */
export function safeToolBase(id: ToolId): ToolCommandBase {
  if (baseProbe) return baseProbe(id);
  try {
    return resolveToolBase(getApp(), id);
  } catch {
    return NO_TOOL;
  }
}

/**
 * 解析一条完整的工具命令（业务参数接在入口脚本/命令名之后）。
 *
 * @param args 业务参数（本地产路径下它们会原样进 spawn 的 argv 数组）
 */
export function resolveToolCommand(app: unknown, id: ToolId, args: string[] = []): ResolvedToolCommand {
  const entry = TOOL_ENTRIES[id];
  const base = resolveToolBase(app, id);
  if (base.via === 'bundle') {
    const script = fsPath(app, `${toolBundleDir(id)}/${entry.script}`);
    return { cmd: base.cmd, args: [script, ...args], shell: false, via: 'bundle' };
  }
  return { cmd: '', args, shell: false, via: 'none' };
}

/** 工具是否已就绪（本地包在 + 有 node）——与 `resolveToolBase` 同一个判据 */
export function toolReadyState(app: unknown, id: ToolId): { ready: boolean; via: 'bundle' | 'none' } {
  const entry = TOOL_ENTRIES[id];
  const script = fsPath(app, `${toolBundleDir(id)}/${entry.script}`);
  // 三件事都要：入口脚本在、**整包解完了**（就绪标记在）、有 node。
  //
  // 标记文件这一条是 2026-11-01 补的，补的是「半截解包」：此前只看入口脚本，
  // 而解包是逐文件顺序写的——cli.js 排在前面，解到一半断掉（断网、磁盘满、路径超 260）
  // 时脚本已经躺在盘上了，于是判「已下载」，可一跑就缺模块。用户看到的是
  // 「检测页说已下载，内容页又让我下」和「下载失败了还显示已下载」，同一个根因。
  // 判据与内容页的 bundleStatus 对齐：标记在 = 这份目录是完整解出来的。
  if (script && existsOnDisk(script) && bundleMarkerOnDisk(app, id) && probeNodeRuntime(app).kind !== 'none') {
    return { ready: true, via: 'bundle' };
  }
  return { ready: false, via: 'none' };
}

/**
 * 解包就绪标记在不在（同步）。
 *
 * 为什么不去调 `bundleStatus`：那个是异步的（要读标记 + 比 sha256），而这几个探测函数
 * 是同步的、被面板与自检在渲染路径上直接调用。这里只要回答「整包解完了没有」，
 * 不回答「是不是最新」——有新版但旧版完整，仍然算可用，那是内容页该提示的事。
 * 标记名与 `core/bundle-asset` 的 `BUNDLE_MARKER` 同源（那边是产出方，这边是消费方）。
 */
function bundleMarkerOnDisk(app: unknown, id: ToolId): boolean {
  return existsOnDisk(fsPath(app, `${toolBundleDir(id)}/${BUNDLE_MARKER}`));
}

/**
 * 工具没装时给人看的那句话。
 *
 * 文案本体在 `core/tool-hint`（零依赖：值守进程那条构建链也要用同一句，不能拖进 `obsidian`）。
 * 这里只负责把工具名填进去。
 */
export function toolInstallHint(id?: ToolId): string {
  return toolMissingHint(id ? TOOL_ENTRIES[id].label : undefined);
}

/** 装了包但没有 Node 时的指引（比「未找到工具」更精确，少让人白试一遍） */
export function nodeMissingHint(id: ToolId): string {
  const entry = TOOL_ENTRIES[id];
  // Node 不在在线资源清单里（它没有仓库产物，是运行时现下的），所以指向「环境自检」——
  // 那里有「一键补齐」，也是首次引导走完后的常驻入口。
  return `${entry.label}已下载，但本机没有可用的 Node 运行时：到「设置 → 通用 → 关于 → 环境自检」一键补齐后重试`;
}

/** 诊断用：把「这台机器上到底探到了什么」摊平成几行（面板/报障截图用） */
export function runtimeDiagnostics(app: unknown): Array<{ key: string; value: string }> {
  const node = probeNodeRuntime(app);
  const rows: Array<{ key: string; value: string }> = [
    { key: '插件目录', value: pluginDirOf(app) || '(取不到 vault 路径)' },
    {
      key: 'Node 运行时',
      value:
        node.kind === 'none'
          ? '未找到'
          : `${node.kind === 'bundled' ? '插件内' : '系统'}${node.version ? ` ${node.version}` : ''}（${node.path}）`,
    },
  ];
  for (const id of TOOL_IDS) {
    const st = toolReadyState(app, id);
    rows.push({
      key: TOOL_ENTRIES[id].label,
      // 只剩两种事实：包在磁盘上 / 包不在。系统 PATH 上有没有同名命令与插件的口径无关
      value: st.via === 'bundle' ? '已下载' : '未安装',
    });
  }
  return rows;
}

/** 供 UI 显示解包目录（「装在哪」这类问题一句话答完） */
export function toolVaultDir(app: unknown, id: ToolId): string {
  return downloadsVaultPath(app, toolBundleDir(id));
}
