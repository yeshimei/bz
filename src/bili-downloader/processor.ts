/**
 * 待转文献批量处理器（视频转文献，bili-downloader 域升级）
 * 串行逐部：对「待处理」任务按列表顺序 spawn 工具无头批处理命令
 * （node <tools>/cli.js --batch '<json>' 或全局 bili-dl --batch），
 * _runOne 返回「子进程终结」Promise，循环内 await —— 严格一次一部；
 * 解析 stdout 步骤行（[bz-step] 名称 / [bz-result] {note,video}）驱动 UI 行内进度；
 * 单部失败继续剩余、失败项可重试；abort() 杀死当前子进程并中止整批。
 */
import { notice } from '../core/notice';
import { TasksData } from './data';
import type { BiliTask } from './types';

/** 工具本地 CLI 指针（修复期临时，与 index.ts 保持一致；稳定后改回全局 bili-dl） */
const LOCAL_CLI_CANDIDATE = 'D:/Obsidian/bz/tools/bili-downloader/cli.js';
const INSTALL_HINT = '请先运行 npm install -g @jwbz/bili-downloader';

const STEP_RE = /^\[bz-step\]\s*(.+)$/;
const RESULT_RE = /^\[bz-result\]\s*(\{.*\})$/;

export interface BatchSummary {
  success: number;
  failed: number;
  aborted: boolean;
}

export interface BatchEvents {
  /** 任务行进度更新（步骤文案已写入 task.reason） */
  onTaskProgress(task: BiliTask, stepText: string): void;
  /** 任务终态（成功/失败），task 已持久化 */
  onTaskDone(task: BiliTask): void;
  /** 整批结束 */
  onBatchDone(summary: BatchSummary): void;
}

/** 桌面端专属能力（同 index.ts）：非桌面端返回 null */
function getChildProcess(): any {
  const w = window as any;
  if (!w.require) return null;
  try { return w.require('child_process'); } catch { return null; }
}

/** 解析 spawn 目标：仓库内本地 CLI 优先（node 直启，免 shell 引号），兜底全局 bili-dl（.cmd shim 需 shell） */
function resolveBatchSpawn(taskJson: string): { cmd: string; args: string[]; shell: boolean } {
  try {
    const w = window as any;
    const fsMod = w.require && w.require('fs');
    if (fsMod && typeof fsMod.existsSync === 'function' && fsMod.existsSync(LOCAL_CLI_CANDIDATE)) {
      return { cmd: 'node', args: [LOCAL_CLI_CANDIDATE, '--batch', taskJson], shell: false };
    }
  } catch { /* 非桌面端/无 fs：走全局命令 */ }
  return { cmd: 'bili-dl', args: ['--batch', taskJson], shell: true };
}

/** 取 stderr 尾部做失败原因（滑窗 1KB） */
function tailStderr(chunks: Buffer[]): string {
  let s = '';
  for (const c of chunks) { s += String(c); if (s.length > 2048) s = s.slice(-2048); }
  return s.trim();
}

function nowTs(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export const BatchRunner = {
  running: false,
  aborted: false,
  _child: null as any,
  _cp: null as any,

  /** 桌面端可用（window.require('child_process') 存在） */
  available(): boolean {
    return !!getChildProcess();
  },

  /**
   * 串行处理全部「待处理」任务（按数组顺序，一次一部）。
   * 已成功/失败项不动；失败项不阻塞后续待处理项。
   */
  async runAll(tasks: BiliTask[], events: BatchEvents): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.aborted = false;
    const cp = getChildProcess();
    this._cp = cp;
    if (!cp) {
      notice('仅桌面端可用：待转文献处理需要 Node.js 外部进程', 'error');
      this.running = false;
      return;
    }
    try {
      let success = 0;
      let failed = 0;
      for (const task of tasks) {
        if (this.aborted) break;
        // 只处理待处理项；失败项等手动重试
        if (task.status !== 'pending') continue;
        await this._runOne(cp, task, events, (ok: boolean) => { if (ok) success++; else failed++; });
      }
      events.onBatchDone({ success, failed, aborted: this.aborted });
    } finally {
      this.running = false;
    }
  },

  /** 中止整批：杀死当前子进程，未开始项保持待处理，当前项由 close 标记失败「已中止」 */
  abort(): void {
    this.aborted = true;
    try { this._child?.kill?.(); } catch { /* 已退出 */ }
  },

  /** 单部执行：spawn → 解析步骤行 → 终态落库；Promise 在子进程终结（close/error）时 resolve */
  _runOne(cp: any, task: BiliTask, events: BatchEvents, onEnd: (ok: boolean) => void): Promise<void> {
    return new Promise((resolve) => {
      const taskJson = JSON.stringify({ url: task.url, start: task.start ?? null, end: task.end ?? null });
      void TasksData.updateTask(task.id, { status: 'processing', reason: '启动中…', processedAt: null }).then(() => {
        task.status = 'processing';
        task.reason = '启动中…';
        events.onTaskProgress({ ...task }, '启动中…');
      });
      const { cmd, args, shell } = resolveBatchSpawn(taskJson);
      let child: any;
      let settled = false;
      const finish = (ok: boolean, reason: string | null, notePath: string | null, videoPath: string | null): void => {
        if (settled) return;
        settled = true;
        void this._finish(task, events, onEnd, ok, reason, notePath, videoPath).then(resolve);
      };
      try {
        child = cp.spawn(cmd, args, { shell, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e: any) {
        const reason = /ENOENT/.test(e.message) ? `未找到 bili-dl。${INSTALL_HINT}` : `启动失败：${e.message}。${INSTALL_HINT}`;
        finish(false, reason, null, null);
        return;
      }
      this._child = child;
      let notePath: string | null = null;
      let videoPath: string | null = null;
      const errChunks: Buffer[] = [];
      const onData = (d: Buffer) => {
        const text = String(d);
        for (const line of text.split(/\r?\n/)) {
          let m = line.match(STEP_RE);
          if (m) {
            const stepText = m[1].trim();
            task.reason = stepText;
            // 步骤文案必须落库：refreshPanel 重读 storage 渲染，仅改内存会一直显示「启动中…」
            void TasksData.updateTask(task.id, { reason: stepText });
            events.onTaskProgress({ ...task }, stepText);
            continue;
          }
          m = line.match(RESULT_RE);
          if (m) {
            try {
              const r = JSON.parse(m[1]);
              notePath = r.note || null;
              videoPath = r.video || null;
            } catch { /* 忽略坏结果行 */ }
          }
        }
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', (d: Buffer) => { errChunks.push(d); });
      child.on('error', (e: Error) => {
        const reason = /ENOENT/.test(e.message) ? `未找到 bili-dl。${INSTALL_HINT}` : `启动失败：${e.message}`;
        finish(false, reason, notePath, videoPath);
      });
      child.on('close', (code: number) => {
        if (this.aborted) {
          finish(false, '已中止', notePath, videoPath);
        } else if (code === 0) {
          finish(true, null, notePath, videoPath);
        } else {
          const errTail = tailStderr(errChunks);
          const reason = errTail || `处理失败（退出码 ${code}）。${INSTALL_HINT}`;
          finish(false, reason, notePath, videoPath);
        }
      });
    });
  },

  /** 终态落库 + 事件（resolve 于落库完成后） */
  async _finish(task: BiliTask, events: BatchEvents, onEnd: (ok: boolean) => void, ok: boolean, reason: string | null, notePath: string | null, videoPath: string | null): Promise<void> {
    task.status = ok ? 'success' : 'failed';
    task.reason = reason;
    task.notePath = ok ? notePath : task.notePath;
    task.videoPath = ok ? videoPath : task.videoPath;
    task.processedAt = nowTs();
    await TasksData.updateTask(task.id, {
      status: task.status,
      reason,
      notePath: task.notePath,
      videoPath: task.videoPath,
      processedAt: task.processedAt,
    });
    events.onTaskDone({ ...task });
    onEnd(ok);
  },
};