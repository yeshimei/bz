/**
 * 影院豆瓣抓取队列（ADR-0113 / issue 255）：
 * 插件内存队列 → 串行 spawn `douban-poster fetch <笔记绝对路径>`（桌面端 child_process；
 * 15s 间隔防限流，单条 3 分钟硬超时杀进程）。完成信号 = spawn 退出 + frontmatter 字段验证。
 * 失败才聚合提示（一条错误通知含片名清单）；进度零通知——反馈在卡片海报遮罩 spinner。
 * 队列口径 = 缺海报或缺豆瓣链接（继承原守护全责，ADR-0111 盲区口径并入）；
 * 入队时机 = 面板打开扫描 + 新建落盘；同会话内存去重，每次会话首轮打开补抓一次。
 * 移动端无 child_process → 队列禁用；新片同步到 PC 后打开面板补抓。
 */
import type { App, TFile } from 'obsidian';
import { notice } from '../core/notice';
import { M } from './state';

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
/** 卡片 loading 驱动：抓取中的笔记路径 */
const pending = new Set<string>();
/** 会话内去重：已入队/已处理过的路径，同会话不重复补抓 */
const attempted = new Set<string>();
const failedNames: string[] = [];
let pumping = false;
/** CLI 绝对路径缓存：null = 未探测，'' = 探测过但不可用 */
let cliPath: string | null = null;
let cliUnavailableNotified = false;
/** 测试注入 */
let spawnFn: FetchSpawn | null = null;
let gapMs = FETCH_GAP_MS;
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

/** 默认 spawn：Electron 以 node 模式跑 CLI（ELECTRON_RUN_AS_NODE），3 分钟硬超时杀进程 */
async function defaultSpawn(cliJs: string, notePath: string): Promise<void> {
  const cp = getChildProcess();
  if (!cp) return;
  const nodeProcess = (globalThis as any).process;
  const child = cp.spawn(nodeProcess.execPath, [cliJs, 'fetch', notePath], {
    windowsHide: true,
    stdio: 'ignore',
    env: { ...(nodeProcess.env ?? {}), ELECTRON_RUN_AS_NODE: '1' },
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

/** 测试注入：替换 spawn 实现 / CLI 路径 / 条目间隔 */
export function configureFetchQueue(hooks: { spawn?: FetchSpawn; cli?: string; gapMs?: number }): void {
  if (hooks.spawn) spawnFn = hooks.spawn;
  if (hooks.cli !== undefined) cliPath = hooks.cli;
  if (hooks.gapMs !== undefined) gapMs = hooks.gapMs;
}

/** 卡片 loading 查询：该笔记是否在抓取中 */
export function isFetching(path: string | null | undefined): boolean {
  return !!(path && pending.has(path));
}

/** 入队（会话内去重）；CLI 不可用时静默跳过 */
export function enqueueDoubanFetch(file: TFile | null, name: string): void {
  if (!file) return;
  if (!resolveCli()) return;
  const key = file.path;
  if (attempted.has(key)) return;
  attempted.add(key);
  pending.add(key);
  queue.push({ file, name });
  void pump();
}

/** 面板打开扫描：未齐条目（缺海报或缺豆瓣链接）入队补抓 */
export function sweepDoubanFetch(_app: App): void {
  for (const it of M.items) {
    if (!it.file) continue;
    if (!it.poster || !it.doubanUrl) enqueueDoubanFetch(it.file, it.name);
  }
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
      const ok = await runOne(entry);
      pending.delete(entry.file.path);
      if (!ok) failedNames.push(entry.name);
      if (M.currentOverlay) M.renderFn?.();
    }
  } finally {
    pumping = false;
  }
  if (failedNames.length > 0) {
    notice(`以下影片豆瓣信息获取失败：${failedNames.join('、')}（重启 Obsidian 后会自动重试）`, 'error');
    failedNames.length = 0;
  }
}

async function runOne(entry: QueueEntry): Promise<boolean> {
  const cli = resolveCli();
  if (!cli) return false;
  const spawn = spawnFn ?? defaultSpawn;
  try {
    await spawn(cli, entry.file.path);
  } catch {
    return false;
  }
  return fetchComplete(M.appRef, entry.file);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 插件卸载：清队列与状态、杀活动子进程（会话语义重置） */
export function shutdownDoubanQueue(): void {
  queue.length = 0;
  pending.clear();
  attempted.clear();
  failedNames.length = 0;
  activeKill?.();
  activeKill = null;
}
