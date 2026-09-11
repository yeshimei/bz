/**
 * 影院豆瓣抓取队列（ADR-0113 / issue 255 / issue 256 修订）：
 * 插件内存队列 → 串行 spawn `douban-poster fetch <笔记绝对路径>`（桌面端 child_process；
 * 执行器 = 系统 Node.js——不能用 process.execPath：Obsidian 的 runAsNode fuse 被禁，
 * ELECTRON_RUN_AS_NODE 静默失效，spawn 出来的是 Obsidian 主程序，秒退假失败；
 * 15s 间隔防限流，单条 3 分钟硬超时杀进程）。完成信号 = spawn 退出 **或** frontmatter 字段
 * 落盘验证（轮询兜底）——宿主内 spawn 退出事件可能延迟/丢失（用户实测：海报/豆瓣信息已
 * 写进笔记但卡片 loading 不退），字段齐全即视为完成并提前收尾；另有 pending 时限硬上限，
 * 双信号全失 loading 也最多转到超时上限。失败才聚合提示（一条错误通知含片名清单）；
 * 队列口径 = 缺海报或缺豆瓣链接（继承原守护全责，ADR-0111 盲区口径并入）；
 * 入队时机 = 面板打开扫描 + 新建落盘；同会话内存去重，每次会话首轮打开补抓一次。
 * 移动端无 child_process → 队列禁用；新片同步到 PC 后打开面板补抓。
 */
import type { App, TFile } from 'obsidian';
import { notice } from '../core/notice';
import { sleep } from '../core/utils';
import { M } from './state';
import { rebuildItems } from './data';

/** 条目间隔 ms（防豆瓣限流，对齐原守护 FETCH_INTERVAL） */
const FETCH_GAP_MS = 15000;
/** 单条硬超时 ms（超时杀进程防悬挂） */
export const FETCH_TIMEOUT_MS = 3 * 60 * 1000;

interface QueueEntry {
  file: TFile;
  name: string;
}

/** spawn 抽象（测试注入点）：调起 CLI 抓单条笔记，resolve 即进程退出 */
export type FetchSpawn = (cliJs: string, notePath: string) => Promise<void>;

const queue: QueueEntry[] = [];
/** 卡片 loading 驱动：抓取中的笔记路径 → 入队时刻（时限兜底用，见 isFetching） */
const pending = new Map<string, number>();
/** 会话内去重：已入队/已处理过的路径，同会话不重复补抓 */
const attempted = new Set<string>();
/** G8：已删除影片的取消集合——正在抓取时影片被删，完成后不再记失败
 *  （否则十几秒后弹「以下影片获取失败：《已删的片》」且「重启后会自动重试」文案不实） */
const cancelled = new Set<string>();
const failedNames: string[] = [];
let pumping = false;
/** CLI 绝对路径缓存：null = 未探测，'' = 探测过但不可用 */
let cliPath: string | null = null;
let cliUnavailableNotified = false;
/** 系统 node.exe 绝对路径缓存：null = 未探测，'' = 探测过但不可用 */
let nodePath: string | null = null;
let nodeUnavailableNotified = false;
/** 测试注入 */
let spawnFn: FetchSpawn | null = null;
let gapMs = FETCH_GAP_MS;
/** 抓取完成后延迟重建渲染的间隔（等 metadataCache 消化磁盘变化；测试注 0） */
let refreshDelayMs = 1500;
/** 字段落盘轮询间隔（完成信号兜底；测试可注小值） */
const POLL_COMPLETE_MS = 3000;
let pollCompleteMs = POLL_COMPLETE_MS;
/** 活动 kill 句柄（卸载/关闭时杀进程） */
let activeKill: (() => void) | null = null;

function getChildProcess(): any | null {
  const w = window as any;
  if (!w.require) return null;
  try {
    return w.require('child_process');
  } catch {
    return null;
  }
}

/** 探测全局安装的 douban-poster CLI；不可用返回 ''（桌面缺安装提示一次，移动端静默禁用） */
function resolveCli(): string {
  if (cliPath !== null) return cliPath;
  const cp = getChildProcess();
  if (!cp) {
    cliPath = '';
    return '';
  }
  try {
    const npmRoot = cp.execSync('npm root -g', { encoding: 'utf-8', timeout: 10000 }).trim();
    const fs = (window as any).require('fs');
    const path = (window as any).require('path');
    const candidate = path.join(npmRoot, '@jwbz', 'obsidian-douban-poster', 'cli.js');
    if (fs.existsSync(candidate)) {
      cliPath = candidate;
      return candidate;
    }
  } catch {
    /* 探测失败按不可用处理 */
  }
  cliPath = '';
  if (!cliUnavailableNotified) {
    cliUnavailableNotified = true;
    notice('豆瓣抓取不可用：未找到全局安装的 douban-poster（npm i -g @jwbz/obsidian-douban-poster 后重载插件）', 'error');
  }
  return '';
}

/** 探测系统 Node.js 绝对路径；不可用返回 ''（提示一次，之后静默）。
 *  必须用系统 node 而非 process.execPath：Obsidian 的 Electron runAsNode fuse 被禁，
 *  ELECTRON_RUN_AS_NODE 环境变量被静默忽略，spawn 出来的是 Obsidian 主程序（秒退假失败）。 */
function resolveNode(): string {
  if (nodePath !== null) return nodePath;
  const cp = getChildProcess();
  if (!cp) {
    nodePath = '';
    return '';
  }
  try {
    // execSync 走 shell 搜 PATH；`node -p` 输出 node 自身绝对路径（shim 也会解析到真身）
    const out = cp.execSync('node -p process.execPath', { encoding: 'utf-8', timeout: 10000 }).trim();
    if (out) {
      nodePath = out;
      return out;
    }
  } catch {
    /* PATH 里没有 node */
  }
  nodePath = '';
  if (!nodeUnavailableNotified) {
    nodeUnavailableNotified = true;
    notice('豆瓣抓取不可用：未找到系统 Node.js（安装 node 后重载 Obsidian）', 'error');
  }
  return '';
}

/** 默认 spawn：系统 node 跑 CLI，3 分钟硬超时杀进程 */
async function defaultSpawn(cliJs: string, notePath: string): Promise<void> {
  const cp = getChildProcess();
  const node = resolveNode();
  if (!cp || !node) throw new Error('spawn 环境不可用');
  const child = cp.spawn(node, [cliJs, 'fetch', notePath], {
    windowsHide: true,
    stdio: 'ignore',
  });
  activeKill = () => {
    try {
      child.kill();
    } catch {
      /* 已退出 */
    }
  };
  await waitForExit(child, FETCH_TIMEOUT_MS, () => child.kill());
  activeKill = null;
}

/** vault 相对路径 → 宿主绝对路径（CLI 在磁盘侧工作；相对路径会被 CLI 拼到影片目录下造成双拼） */
function absPath(app: App | null, path: string): string {
  try {
    const adapter = (app?.vault as unknown as { adapter?: { getFullPath?: (p: string) => string } }).adapter;
    if (adapter?.getFullPath) return adapter.getFullPath(path);
  } catch {
    /* 回退相对路径 */
  }
  return path;
}

/** 等子进程退出；超时 kill 兜底（导出仅为测试：fake child + fake timers） */
export function waitForExit(
  child: { on: (ev: string, cb: (code?: number) => void) => void },
  timeoutMs: number,
  kill: () => void,
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const killer = setTimeout(() => {
      kill();
      finish();
    }, timeoutMs);
    child.on('close', () => {
      clearTimeout(killer);
      finish();
    });
    child.on('error', () => {
      clearTimeout(killer);
      finish();
    });
  });
}

/** frontmatter 字段值读取（行级；剥包裹引号，空值/纯引号如 `""` 返回 null） */
function fieldValue(content: string, key: string): string | null {
  const m = content.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return null;
  const v = m[1].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
  return v || null;
}

/** 字段验证：海报与豆瓣链接都非空才算抓齐（搜索无结果/限流半途而废 → 失败） */
async function fetchComplete(app: App | null, file: TFile): Promise<boolean> {
  if (!app) return false;
  try {
    const content = await app.vault.read(file);
    const poster = fieldValue(content, '海报');
    const url = fieldValue(content, '豆瓣链接');
    return !!(poster && url && /^https?:\/\//.test(url));
  } catch {
    return false;
  }
}

/** 测试注入：替换 spawn 实现 / CLI 与 node 路径 / 条目间隔 / 完成后刷新延迟 / 完成轮询间隔 */
export function configureFetchQueue(hooks: {
  spawn?: FetchSpawn;
  cli?: string;
  node?: string;
  gapMs?: number;
  refreshDelayMs?: number;
  pollMs?: number;
}): void {
  if (hooks.spawn) spawnFn = hooks.spawn;
  if (hooks.cli !== undefined) cliPath = hooks.cli;
  if (hooks.node !== undefined) nodePath = hooks.node;
  if (hooks.gapMs !== undefined) gapMs = hooks.gapMs;
  if (hooks.refreshDelayMs !== undefined) refreshDelayMs = hooks.refreshDelayMs;
  if (hooks.pollMs !== undefined) pollCompleteMs = hooks.pollMs;
}

/** 卡片 loading 查询：该笔记是否在抓取中。
 *  时限兜底：超过「单条超时 + 余量」的 pending 记过期——双完成信号全失时 loading 也不永转 */
export function isFetching(path: string | null | undefined): boolean {
  if (!path) return false;
  const at = pending.get(path);
  if (!at) return false;
  return Date.now() - at < FETCH_TIMEOUT_MS + 30_000;
}

/** 入队（会话内去重）；CLI/node 不可用时静默跳过。返回是否真入队 */
export function enqueueDoubanFetch(file: TFile | null, name: string): boolean {
  if (!file) return false;
  if (!resolveCli() || !resolveNode()) return false;
  const key = file.path;
  if (attempted.has(key)) return false;
  attempted.add(key);
  pending.set(key, Date.now());
  queue.push({ file, name });
  void pump();
  return true;
}

/** G8：删除影片时出队——未开始的条目移出队列、loading 撤销；正在抓取的条目记入取消集合，
 *  完成后不再聚合计入失败通知（文件已删，「重启后会自动重试」的文案对它不成立） */
export function dequeueDoubanFetch(path: string | null | undefined): void {
  if (!path) return;
  const at = queue.findIndex((e) => e.file.path === path);
  if (at >= 0) queue.splice(at, 1);
  pending.delete(path);
  cancelled.add(path);
}

/** 面板打开扫描：未齐条目（缺海报或缺豆瓣链接）入队补抓；有新增即触发一次渲染（loading 首帧可见） */
export function sweepDoubanFetch(_app: App): void {
  let added = 0;
  for (const it of M.items) {
    if (!it.file) continue;
    if (!it.poster || !it.doubanUrl) {
      if (enqueueDoubanFetch(it.file, it.name)) added++;
    }
  }
  if (added > 0 && M.currentOverlay) M.renderFn?.();
}

/**
 * 等单条完成：spawn 退出（原信号）与 frontmatter 字段落盘（轮询兜底）谁先到算谁。
 * 背景：宿主（Electron 渲染进程）内 spawn 的退出事件可能延迟/丢失，或 CLI 写完字段后
 * 收尾迟滞——用户实测海报/豆瓣链接已进笔记而卡片 loading 不退。字段写入是 CLI 的最后
 * 一步，轮询到齐全即杀掉收尾中的进程提前收（waitForExit 的退出/超时兜底仍在后台生效）。
 */
async function waitCompleteOrExit(entry: QueueEntry, running: Promise<boolean>): Promise<boolean> {
  let settled = false;
  return new Promise<boolean>((resolve) => {
    const finish = (v: boolean) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      resolve(v);
    };
    const timer = setInterval(() => {
      void fetchComplete(M.appRef, entry.file).then((ok) => {
        if (!ok) return;
        activeKill?.();
        finish(true);
      });
    }, pollCompleteMs);
    running.then((ok) => finish(ok), () => finish(false));
  });
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    let first = true;
    while (queue.length > 0) {
      const entry = queue.shift()!;
      if (!first) await sleep(gapMs);
      first = false;
      const ok = await waitCompleteOrExit(entry, runOne(entry));
      pending.delete(entry.file.path);
      // G8：已删除影片的条目完成后不记失败（取消集合消费后即清，防集合增长）
      if (cancelled.delete(entry.file.path)) {
        refreshAfterFetch();
        continue;
      }
      if (!ok) failedNames.push(entry.name);
      refreshAfterFetch();
    }
  } finally {
    pumping = false;
  }
  if (failedNames.length > 0) {
    notice(`以下影片豆瓣信息获取失败：${failedNames.join('、')}（重启 Obsidian 后会自动重试）`, 'error');
    failedNames.length = 0;
  }
}

/** 抓取落盘后刷新：立即一次（loading 退场）+ 延迟一次（等 metadataCache 消化磁盘变化，
 *  海报/豆瓣链接字段才会上卡——spawn 刚退出时缓存还是旧值，只渲染不重建会一直白板）。 */
function refreshAfterFetch(): void {
  if (!M.currentOverlay || !M.appRef) return;
  rebuildItems(M.appRef);
  M.renderFn?.();
  setTimeout(() => {
    if (!M.currentOverlay || !M.appRef) return;
    rebuildItems(M.appRef);
    M.renderFn?.();
  }, refreshDelayMs);
}

async function runOne(entry: QueueEntry): Promise<boolean> {
  const cli = resolveCli();
  if (!cli) return false;
  const spawn = spawnFn ?? defaultSpawn;
  try {
    await spawn(cli, absPath(M.appRef, entry.file.path));
  } catch {
    return false;
  }
  return fetchComplete(M.appRef, entry.file);
}



/** 插件卸载：清队列与状态、杀活动子进程（会话语义重置） */
export function shutdownDoubanQueue(): void {
  queue.length = 0;
  pending.clear();
  attempted.clear();
  cancelled.clear();
  failedNames.length = 0;
  activeKill?.();
  activeKill = null;
  pollCompleteMs = POLL_COMPLETE_MS;
  // G8 附带：会话语义重置含泵位——旧 pump 若挂死于永不完成的 spawn（超时兜底不可达时），
  // 重置后新会话才能重新泵（旧 pump 即使后来醒来也只看到空队列，finally 复位无害）
  pumping = false;
}
