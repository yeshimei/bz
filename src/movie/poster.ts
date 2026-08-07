/**
 * 海报抓取（ticket 21）：新建影视笔记时自动调用全局 npm 包 @jwbz/obsidian-douban-poster，
 * 从豆瓣抓取高清海报 + 补全 frontmatter（豆瓣评分/导演/主演/类型/… 13 字段）。
 *
 * 桌面端专属（依赖 Node.js 外部进程，ADR-0006）：移动端不注册监听，设置项置灰标注。
 * 触发：vault create（新建）或 workspace file-open（打开且无海报）→ 延迟 3s → 串行队列 spawn
 * `node <cli.js> fetch <笔记绝对路径>`（相对路径会被脚本重复拼接 movieFolder 导致「笔记不存在」）；
 * 结果解析 stdout（脚本失败时 exit code 仍为 0）。
 */
import { Notice } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';

/** 全局 npm 包名与 CLI 入口（经 `npm root -g` 定位） */
export const PACKAGE_NAME = '@jwbz/obsidian-douban-poster';
const CLI_FILE = 'cli.js';
/** create 后延迟（ms）：等添加弹窗把用户填写的字段写入 frontmatter */
const CREATE_DELAY = 3000;
/** 同一文件两次触发的冷却（ms）：create + file-open 双触发去重，也避免反复打开反复抓 */
const FETCH_COOLDOWN = 60000;
/** 单个 fetch 进程超时（ms） */
const SPAWN_TIMEOUT = 60000;

export type ProbeState = 'unknown' | 'installed' | 'missing';

/** 探测结果缓存（unknown → 异步探测中/未探测） */
let probeState: ProbeState = 'unknown';
let cliPathCache: string | null = null;

let initialized = false;
let vaultRef: any = null;
let workspaceRef: any = null;
let metadataCacheRef: any = null;
let fileListenerRef: any = null;
let openListenerRef: any = null;
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
const queue: { file: any; name: string }[] = [];
const cooldownMap = new Map<string, number>();
let running = false;
let activeProc: any = null;

/** 获取 Electron renderer 的 Node 模块（桌面端专属；移动端/沙箱返回 null） */
function nodeRequire(mod: string): any {
  try {
    const w = window as any;
    if (!w.require) return null;
    return w.require(mod);
  } catch {
    return null;
  }
}

/** 桌面端检测：能拿到 child_process 即视为桌面端（移动端 Capacitor 无 Node 环境） */
export function isDesktop(): boolean {
  return !!nodeRequire('child_process');
}

/** 异步探测全局包安装状态：`npm root -g` → 定位 <root>/@jwbz/obsidian-douban-poster/cli.js */
export function probeInstall(cb?: (ok: boolean) => void): void {
  const cp = nodeRequire('child_process');
  if (!cp || !cp.execFile) {
    probeState = 'missing';
    cliPathCache = null;
    cb?.(false);
    return;
  }
  // shell: true 兼容 Windows（npm 实为 npm.cmd，spawn/execFile 默认不查 PATHEXT）
  cp.execFile('npm', ['root', '-g'], { shell: true, timeout: 10000 }, (err: any, stdout: string) => {
    if (err) {
      probeState = 'missing';
      cliPathCache = null;
      cb?.(false);
      return;
    }
    const fs = nodeRequire('fs');
    const pathMod = nodeRequire('path');
    const root = String(stdout || '').trim();
    const cli = pathMod ? pathMod.join(root, PACKAGE_NAME, CLI_FILE) : '';
    if (cli && fs && fs.existsSync(cli)) {
      probeState = 'installed';
      cliPathCache = cli;
      cb?.(true);
    } else {
      probeState = 'missing';
      cliPathCache = null;
      cb?.(false);
    }
  });
}

export function getProbeState(): ProbeState {
  return probeState;
}

/** 幂等初始化（桌面端才注册监听；移动端仅标记 initialized，不监听） */
export function ensurePosterFetch(app: any): void {
  if (initialized) return;
  initialized = true;
  vaultRef = app.vault;
  metadataCacheRef = app.metadataCache;
  if (!isDesktop()) return;
  // 新建影视笔记 → 自动抓取
  fileListenerRef = vaultRef.on('create', (file: any) => {
    if (!file || file.extension !== 'md') return;
    const folder = getMovieFolder();
    if (!file.path.startsWith(folder + '/')) return;
    scheduleFetch(file);
  });
  // 打开影视笔记且无海报 → 触发抓取
  workspaceRef = app.workspace;
  openListenerRef = workspaceRef.on('file-open', (file: any) => {
    if (!file || file.extension !== 'md') return;
    const folder = getMovieFolder();
    if (!file.path.startsWith(folder + '/')) return;
    if (!hasPoster(file)) scheduleFetch(file);
  });
}

function getMovieFolder(): string {
  const s = tryGetSettings() as any;
  return (s && s.movieFolderPath) || '我的/影视';
}

/** frontmatter「海报」字段非空即视为已有海报（打开场景的跳过条件） */
function hasPoster(file: any): boolean {
  try {
    const cache = metadataCacheRef?.getFileCache?.(file);
    const p = cache?.frontmatter?.['海报'];
    return !!(p && String(p).trim());
  } catch {
    return false;
  }
}

/** vault 内相对路径 → 磁盘绝对路径（脚本 fetch 分支对相对路径会重复拼接 movieFolder） */
function getFullPath(relPath: string): string {
  const adapter = vaultRef?.adapter;
  if (adapter && typeof adapter.getFullPath === 'function') {
    try { return adapter.getFullPath(relPath); } catch { /* 忽略 */ }
  }
  return relPath;
}

/** 与脚本 extractMovieName 一致：《名称》.md 取《》内，否则全名 */
function extractName(file: any): string {
  const basename = String(file.basename || file.name || '').replace(/\.md$/i, '');
  const m = basename.match(/《(.+)》/);
  return m ? m[1] : basename;
}

/** 触发去重（冷却）+ 延迟入队；延迟期间文件被删则取消 */
function scheduleFetch(file: any): void {
  const now = Date.now();
  if (now - (cooldownMap.get(file.path) || 0) < FETCH_COOLDOWN) return;
  cooldownMap.set(file.path, now);
  // 惰性清理过期条目（防泄漏）
  for (const [p, t] of cooldownMap) {
    if (now - t >= FETCH_COOLDOWN) cooldownMap.delete(p);
  }
  const timer = setTimeout(() => {
    pendingTimers.delete(timer);
    if (vaultRef && !vaultRef.getAbstractFileByPath(file.path)) return;
    enqueue(file);
  }, CREATE_DELAY);
  pendingTimers.add(timer);
}

/** 入队 + 通知 + 启动队列（串行：同一时刻只跑一个 spawn） */
function enqueue(file: any): void {
  const name = extractName(file);
  new Notice(`正在为《${name}》抓取海报与豆瓣信息…`);
  queue.push({ file, name });
  if (!running) runNext();
}

function runNext(): void {
  if (queue.length === 0) {
    running = false;
    return;
  }
  running = true;
  runFetch(queue.shift()!);
}

function notifyResult(job: { name: string }, kind: 'ok' | 'skip' | 'fail', reason: string): void {
  if (kind === 'ok') new Notice(`《${job.name}》海报与豆瓣信息已补全`);
  else if (kind === 'skip') new Notice(`《${job.name}》跳过：${reason}`);
  else new Notice(`《${job.name}》抓取失败：${reason}`);
}

function runFetch(job: { file: any; name: string }): void {
  const cp = nodeRequire('child_process');
  if (!cp || !cp.spawn) {
    notifyResult(job, 'fail', '桌面端 Node.js 环境不可用');
    runNext();
    return;
  }
  if (probeState !== 'installed' || !cliPathCache) {
    notifyResult(job, 'fail', `未检测到全局包 ${PACKAGE_NAME}，请先执行 npm install -g ${PACKAGE_NAME}`);
    runNext();
    return;
  }

  const proc = cp.spawn('node', [cliPathCache, 'fetch', getFullPath(job.file.path)], { windowsHide: true });
  activeProc = proc;
  let stdout = '';
  let stderr = '';
  proc.stdout?.on('data', (d: any) => { stdout += String(d); });
  proc.stderr?.on('data', (d: any) => { stderr += String(d); });

  const timer = setTimeout(() => {
    try { proc.kill(); } catch { /* 忽略 */ }
    notifyResult(job, 'fail', '抓取超时（60s）');
    finishRun();
  }, SPAWN_TIMEOUT);

  proc.on('close', (code: number) => {
    clearTimeout(timer);
    const r = judgeResult(stdout, stderr, code);
    notifyResult(job, r.kind, r.reason);
    finishRun();
  });
}

function finishRun(): void {
  activeProc = null;
  runNext();
}

/** 解析脚本输出判定结果（脚本内部失败时 exit code 仍为 0，必须看 stdout） */
function judgeResult(stdout: string, stderr: string, code: number): { kind: 'ok' | 'skip' | 'fail'; reason: string } {
  if (code !== 0) return { kind: 'fail', reason: tail(stderr || stdout) };
  if (stdout.includes('[完成]')) return { kind: 'ok', reason: '' };
  const skipM = stdout.match(/\[跳过\]\s*([^\n]*)/);
  if (skipM && skipM[1]) return { kind: 'skip', reason: skipM[1].trim() };
  const failM = stdout.match(/\[失败\]\s*([^\n]*)/);
  if (failM && failM[1]) return { kind: 'fail', reason: failM[1].trim() };
  return { kind: 'fail', reason: tail(stdout || stderr) };
}

function tail(s: string, max = 120): string {
  const t = String(s || '').trim();
  if (!t) return '未知错误';
  return t.length > max ? '…' + t.slice(-max) : t;
}

export function isPosterFetchInitialized(): boolean {
  return initialized;
}

/** 卸载清理（main.ts onunload 调用）：清 timer/杀活跃进程/offref */
export function unloadPosterFetch(): void {
  for (const t of pendingTimers) clearTimeout(t);
  pendingTimers.clear();
  if (activeProc) {
    try { activeProc.kill(); } catch { /* 忽略 */ }
    activeProc = null;
  }
  if (fileListenerRef && vaultRef) {
    try { vaultRef.offref(fileListenerRef); } catch { /* 忽略 */ }
    fileListenerRef = null;
  }
  if (openListenerRef && workspaceRef) {
    try { workspaceRef.offref(openListenerRef); } catch { /* 忽略 */ }
    openListenerRef = null;
  }
  workspaceRef = null;
  metadataCacheRef = null;
  initialized = false;
  vaultRef = null;
  queue.length = 0;
  cooldownMap.clear();
  running = false;
  probeState = 'unknown';
  cliPathCache = null;
}
