/**
 * 文献盒批量处理器（视频转文献，bili-downloader 域；面板正名「文献盒」，ADR-0066）
 * 串行逐部：对「待处理」任务按列表顺序 spawn 工具无头批处理命令
 * （node <tools>/cli.js --batch '<json>' 或全局 bili-dl --batch），
 * _runOne 返回「子进程终结」Promise，循环内 await —— 严格一次一部；
 * 解析 stdout 步骤行（[bz-step] 名称 / [bz-p] {"phase","pct"} 进度 / [bz-result] {note,video}）
 * 驱动 UI 行内进度与阶段百分比；步骤文案落库（刷新面板重读可见）+ 进度走内存实时推送；
 * 单部失败继续剩余（或按设置「遇错即停」中断）、失败项可重试；abort() 杀死当前子进程并中止整批。
 */
import { notice } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { tryGetSettings } from '../core/settings-provider';
import { LiteratureData } from './data';
import type { LiteratureTask } from './types';

/** 工具本地 CLI 指针（修复期临时，与 index.ts 保持一致；稳定后改回全局 bili-dl） */
const LOCAL_CLI_CANDIDATE = 'D:/Obsidian/bz/tools/bili-downloader/cli.js';
const INSTALL_HINT = '请先运行 npm install -g @jwbz/bili-downloader';

const STEP_RE = /^\[bz-step\]\s*(.+)$/;
const RESULT_RE = /^\[bz-result\]\s*(\{.*\})$/;
/** [bz-p] {"phase":"download","pct":35}——阶段百分比进度行（pct 0-100，null=该阶段不确定，绝不假报） */
const PROGRESS_RE = /^\[bz-p\]\s*(\{.*\})$/;
/** [bz-info] {"title","uploader","bvid","url","duration"}——解析信息行（ADR-0067，行内「文字+链接」+ UP主） */
const INFO_RE = /^\[bz-info\]\s*(\{.*\})$/;

export interface BatchSummary {
  success: number;
  failed: number;
  aborted: boolean;
  /** 遇错即停（设置 literatureStopOnFailure 触发）：失败后不再处理剩余，未开始项保持待处理 */
  stopped: boolean;
}

/** 阶段百分比进度（[bz-p] 行解析结果；phase null = 未知阶段） */
export interface BiliProgress {
  phase: string | null;
  pct: number | null;
}

export interface BatchEvents {
  /** 任务行进度更新（步骤文案已写入 task.reason；progress 为 [bz-p] 行解析出的阶段百分比，无则 null） */
  onTaskProgress(task: LiteratureTask, stepText: string, progress?: BiliProgress | null): void;
  /** 解析信息落库回调（[bz-info] 行：title/uploader 已写入 task 与 storage，UI 整表刷新显示「文字+链接」） */
  onTaskInfo(task: LiteratureTask): void;
  /** 任务终态（成功/失败），task 已持久化 */
  onTaskDone(task: LiteratureTask): void;
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
  /** 遇错即停（设置 literatureStopOnFailure）：当前任务失败后中断整批，未开始项保持待处理 */
  stoppedFail: false,
  _child: null as any,
  _cp: null as any,

  /** 桌面端可用（window.require('child_process') 存在） */
  available(): boolean {
    return !!getChildProcess();
  },

  /**
   * 串行处理全部「待处理 + 失败」任务（按数组顺序，一次一部；ADR-0067 断点续跑：
   * 失败项重跑时工具自动跳过已成功步骤、从出错步骤继续）。
   * 已成功（归档）项不动；默认失败后继续（遇错即停设置开启时失败后中断）。
   */
  async runAll(tasks: LiteratureTask[], events: BatchEvents): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.aborted = false;
    this.stoppedFail = false;
    const cp = getChildProcess();
    this._cp = cp;
    if (!cp) {
      notice('仅桌面端可用：文献盒处理需要 Node.js 外部进程', 'error');
      this.running = false;
      return;
    }
    const stopOnFailure = tryGetSettings().literatureStopOnFailure === true;
    try {
      let success = 0;
      let failed = 0;
      for (const task of tasks) {
        if (this.aborted) break;
        // 只处理待处理/失败项（成功项已归档不动）
        if (task.status !== 'pending' && task.status !== 'failed') continue;
        let itemFailed = false;
        await this._runOne(cp, task, events, (ok: boolean) => { if (ok) success++; else { failed++; itemFailed = true; } });
        // 遇错即停：单条失败后停止整批（不 kill 子进程——已结束；未开始项保持待处理）
        if (itemFailed && stopOnFailure) { this.stoppedFail = true; break; }
      }
      events.onBatchDone({ success, failed, aborted: this.aborted, stopped: this.stoppedFail });
    } finally {
      this.running = false;
    }
  },

  /** 中止整批：杀死当前子进程，未开始项保持待处理，当前项由 close 标记失败「已中止」 */
  abort(): void {
    this.aborted = true;
    try { this._child?.kill?.(); } catch { /* 已退出 */ }
  },

  /** 单部执行：spawn → 解析步骤/进度行 → 终态落库；Promise 在子进程终结（close/error）时 resolve */
  _runOne(cp: any, task: LiteratureTask, events: BatchEvents, onEnd: (ok: boolean) => void): Promise<void> {
    return new Promise((resolve) => {
      // 文献盒设置项透传（ADR-0066/0067）：清晰度 = 任务级覆盖优先、否则全局设置；保留视频/输出目录走全局；
      // 分P 序号（task.page，1 起）随任务 JSON 下发（工具按 P 选 cid，独立缓存键）
      const s = tryGetSettings();
      const taskJson = JSON.stringify({
        url: task.url,
        start: task.start ?? null,
        end: task.end ?? null,
        page: task.page && task.page > 0 ? task.page : null,
        options: {
          quality: (task.quality || (s && s.literatureQuality) || 'highest') as string,
          keepVideo: !s || s.literatureKeepVideo !== false,
          outputDir: (s && s.literatureOutputDir ? String(s.literatureOutputDir).trim() : ''),
        },
      });
      void LiteratureData.updateTask(task.id, { status: 'processing', reason: '启动中…', processedAt: null }).then(() => {
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
            void LiteratureData.updateTask(task.id, { reason: stepText });
            events.onTaskProgress({ ...task }, stepText, null);
            continue;
          }
          // 阶段百分比进度行：走内存实时推送（不落库——瞬态值，刷新面板时由终态/步骤文案兜底）
          m = line.match(PROGRESS_RE);
          if (m) {
            try {
              const p = JSON.parse(m[1]);
              const progress: BiliProgress = {
                phase: p && typeof p.phase === 'string' ? p.phase : null,
                pct: p && Number.isFinite(p.pct) ? Number(p.pct) : null,
              };
              events.onTaskProgress({ ...task }, task.reason || '', progress);
            } catch { /* 忽略坏进度行 */ }
            continue;
          }
          // 解析信息行（ADR-0067）：标题/UP主 落库（面板行内「文字+链接」展示）。
          // 'parsed' 域事件自 ticket 136 起无订阅者（smartcat 只收 converted/term-generated），保留发射作占位；
          // 先落库再发事件：UI onTaskInfo 整表刷新时能确定性读到新字段（避免读旧快照的竞态）
          m = line.match(INFO_RE);
          if (m) {
            try {
              const info = JSON.parse(m[1]);
              const title = info && typeof info.title === 'string' ? String(info.title).trim() : '';
              const uploader = info && typeof info.uploader === 'string' ? String(info.uploader).trim() : '';
              if (title) {
                task.title = title;
                task.uploader = uploader || task.uploader;
                const patch: Partial<LiteratureTask> = { title, uploader: task.uploader };
                void LiteratureData.updateTask(task.id, patch).then(() => {
                  emitDomainEvent('literature:tasks', { kind: 'parsed', id: task.id, url: task.url, title, uploader: task.uploader || undefined });
                  events.onTaskInfo({ ...task });
                });
              }
            } catch { /* 忽略坏信息行 */ }
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

  /** 终态落库 + 事件（resolve 于落库完成后）；成功 → 自动归档历史（archived+归档时间，ADR-0067） */
  async _finish(task: LiteratureTask, events: BatchEvents, onEnd: (ok: boolean) => void, ok: boolean, reason: string | null, notePath: string | null, videoPath: string | null): Promise<void> {
    task.status = ok ? 'success' : 'failed';
    task.reason = reason;
    task.notePath = ok ? notePath : task.notePath;
    task.videoPath = ok ? videoPath : task.videoPath;
    task.processedAt = nowTs();
    if (ok) { task.archived = true; task.archivedAt = task.processedAt; }
    await LiteratureData.updateTask(task.id, {
      status: task.status,
      reason,
      notePath: task.notePath,
      videoPath: task.videoPath,
      processedAt: task.processedAt,
      archived: task.archived,
      archivedAt: task.archivedAt,
      // 内存态解析信息一并落库（ADR-0067）：终态写与信息写并发时，终态写携带新字段，
      // 避免读-改-写竞态把已落库的 title/uploader 覆盖丢失
      title: task.title,
      uploader: task.uploader,
    });
    events.onTaskDone({ ...task });
    onEnd(ok);
  },
};