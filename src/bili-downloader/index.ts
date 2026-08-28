/**
 * B站下载器域（视频转文献，bili-downloader 域升级）：
 * 1) 启动命令 bz-bili-open：外部工具 @jwbz/bili-downloader（tools/bili-downloader，ADR-0011）
 *    桌面端 spawn 全局命令 bili-dl → 起本地服务并自动开浏览器；
 *    解析 stdout 中的服务地址，经自绘 toast 提示用户。
 * 2) 文献盒面板 bz-bili-tasks-open：移动端暂存录入 / 桌面端批量处理（ADR-0065；ADR-0066 正名、
 *    并入口下载按钮、设置提取、行内进度、域事件分发），
 *    数据 CONFIG/STORAGE/bili-tasks.json，面板见 ui.ts，跑批器见 processor.ts。
 */
import { notice } from '../core/notice';
import type { NoticeType } from '../core/notice';
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { TasksData } from './data';
import { UIManager } from './ui';

/** 桌面端专属能力（CONTEXT.md）：window.require('child_process') 为 null 即非桌面端 */
function getChildProcess(): any {
  const w = window as any;
  if (!w.require) return null;
  try { return w.require('child_process'); } catch { return null; }
}

const ADDR_RE = /地址:\s*(https?:\/\/\S+)/;
const INSTALL_HINT = '请先运行 npm install -g @jwbz/bili-downloader';

/**
 * 修复期临时指针（2026-08-25 用户拍板：发布未稳定前停止 npm publish，
 * B站下载直连本仓库未发布 CLI 验证；稳定后再恢复全局 bili-dl 并删除此段）。
 */
const LOCAL_CLI_CANDIDATE = 'D:/Obsidian/bz/tools/bili-downloader/cli.js';
function resolveCmd(): string {
  try {
    const w = window as any;
    const fsMod = w.require && w.require('fs');
    if (fsMod && typeof fsMod.existsSync === 'function' && fsMod.existsSync(LOCAL_CLI_CANDIDATE)) {
      return `node "${LOCAL_CLI_CANDIDATE}"`;
    }
  } catch { /* 非桌面端/无 fs：走全局命令 */ }
  return 'bili-dl';
}

/** 打开 B站下载器（bz-bili-open 命令回调） */
export function openBiliDownloader(): void {
  const cp = getChildProcess();
  if (!cp) { notice('仅桌面端可用：B站下载器需要 Node.js 外部进程', 'error'); return; }
  let child: any;
  try {
    // Windows 全局 bin 是 bili-dl.cmd shim，需 shell:true 解析（参数为空，无注入风险）；
    // 本地 CLI 指针（resolveCmd）同样经 shell 执行 node "<path>"
    child = cp.spawn(resolveCmd(), [], { shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e: any) {
    notice(`启动失败：${e.message}。${INSTALL_HINT}`, 'error');
    return;
  }
  let settled = false;
  const done = (msg: string, type: NoticeType = 'info') => {
    if (settled) return;
    settled = true;
    notice(msg, type);
  };
  // 即时反馈（ticket 117）：spawn 落地就提示，消除 1~3s 的空窗无响应感
  notice('正在启动 B站下载器…');
  // P2 缓冲防护：buf 只保留尾部 8KB 滑窗（防长时运行/刷屏输出把缓冲无界撑大）；
  // 地址命中 settled 后移除 data 监听并短路匹配（不再做无谓的正则扫描）。
  const BUF_CAP = 8 * 1024;
  const trimBuf = (): void => { if (buf.length > BUF_CAP) buf = buf.slice(-BUF_CAP); };
  let buf = '';
  const onData = (d: Buffer): void => {
    buf += String(d);
    trimBuf();
    if (settled) return; // 已命中地址：短路（监听移除前的残余事件也不再扫描）
    const m = buf.match(ADDR_RE);
    if (m) {
      child.stdout?.removeListener?.('data', onData);
      done(`B站下载器已启动：${m[1]}`, 'success');
    }
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', (d: Buffer) => { buf += String(d); trimBuf(); });
  child.on('error', (e: Error) => {
    done(/ENOENT/.test(e.message) ? `未找到 bili-dl。${INSTALL_HINT}` : `启动失败：${e.message}`, 'error');
  });
  child.on('close', (code: number) => {
    // 软超时未 settle 时仍可升级：启动失败（非 0 退出）覆盖「启动中…」提示，不再被吞
    if (!settled) done(code === 0 ? 'B站下载器已退出' : `B站下载器启动失败。${INSTALL_HINT}`, code === 0 ? 'info' : 'error');
  });
  // 软超时（ticket 117）：6 秒未解析到地址先提示启动中（不 settle 死），
  // 进程随后失败/退出仍可被 close/error 覆盖升级为准确提示。
  setTimeout(() => {
    if (!settled) notice('B站下载器启动中…浏览器将自动打开；若未打开请重新执行命令', 'info');
  }, 6000);
}

// ---- 文献盒面板（ADR-0065 待转文献正名，ADR-0066）----

let initialized = false;
let uiManager: UIManager | null = null;

/** 懒加载初始化（ADR-0003 幂等）：数据层 + 面板（⬇️ 下载按钮接入原 B站下载弹窗，ADR-0066） */
export function ensureBiliTasks(app: App): void {
  if (initialized) return;
  initialized = true;
  TasksData.init({ storagePath: (tryGetSettings() as any)?.storagePath });
  uiManager = new UIManager(app, { onDownload: () => openBiliDownloader() });
}

/** 打开文献盒面板（bz-bili-tasks-open 命令回调，面板正名「文献盒」） */
export function openBiliTasksPanel(app: App): void {
  ensureBiliTasks(app);
  uiManager?.showMain();
}

/** 卸载（main.ts onunload 调用；幂等空清理） */
export function unloadBiliDownloader(): void {
  uiManager?.destroy();
  uiManager = null;
  initialized = false;
}