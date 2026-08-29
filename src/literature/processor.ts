/**
 * 文献盒批量处理器（视频转文献，literature 域；ADR-0071：AI 回迁插件侧）
 * 串行逐部：对「待处理/失败」任务按列表顺序 spawn 工具无头批处理命令
 * （全局 bili-dl --batch '<json>'，.cmd shim 以 shell:true 启动；P2-2 移除修复期本机 CLI 指针探测），
 * _runOne 返回「子进程终结」Promise，循环内 await —— 严格一次一部。
 *
 * AI 回迁（ticket 136/ADR-0071）：CLI 不再调 AI、不再写笔记，只产出机械步骤
 * （[bz-step]/[bz-p]/[bz-info]）+ 末尾 [bz-result] {"transcript","video"}（转录临时文件
 * 绝对路径 + 视频落地路径 vault 相对|绝对|null）。插件侧在 close(0) 后接管：
 * 读转录临时文件 → 插件侧 AI 生成文献笔记（note-gen.ts generateVideoNote）→
 * 读毕删除转录临时文件 → 任务成功落库并归档；转录读取失败 / AI 失败（含 AI 未配置）
 * → 该任务 failed（不落半成品笔记），临时文件尽力清理。
 * 失败即整批语义：单部失败继续剩余（或按设置「遇错即停」中断）；失败项可重试。
 * abort() 杀死当前子进程并中止整批；中止发生在 AI 阶段时（子进程已退出）当前部
 * 照常跑完，未开始项保持待处理（数据一致性优先：已写好的笔记不丢弃）。
 *
 * 步骤文案：CLI 步骤行原样透传；插件侧 AI 步骤用固定文案「AI 生成文献笔记中」
 * 「笔记落盘中」（ui.ts STEP_DONE_MAP 完成态文案按此精确匹配）。
 */
import { notice } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { tryGetSettings } from '../core/settings-provider';
import { getApp } from '../core/app';
import { LiteratureData } from './data';
import { generateVideoNote } from './note-gen';
import type { LiteratureTask } from './types';

/** 统一走全局 bili-dl（P2-2：移除修复期本机绝对路径 LOCAL_CLI_CANDIDATE；未安装由 INSTALL_HINT 引导） */
const INSTALL_HINT = '请先运行 npm install -g @jwbz/bili-downloader';

const STEP_RE = /^\[bz-step\]\s*(.+)$/;
const RESULT_RE = /^\[bz-result\]\s*(\{.*\})$/;
/** [bz-p] {"phase":"download","pct":35}——阶段百分比进度行（pct 0-100，null=该阶段不确定，绝不假报） */
const PROGRESS_RE = /^\[bz-p\]\s*(\{.*\})$/;
/** [bz-info] {"title","uploader","bvid","url","duration"}——解析信息行（ADR-0067，行内「文字+链接」+ UP主） */
const INFO_RE = /^\[bz-info\]\s*(\{.*\})$/;

/** 插件侧 AI 步骤固定文案（ui.ts STEP_DONE_MAP 完成态文案按此精确匹配） */
const AI_STEP_TEXT = 'AI 生成文献笔记中';
const NOTE_STEP_TEXT = '笔记落盘中';

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

/** fs 模块（转录临时文件读/删）：非桌面端/不可得返回 null */
function getFs(): any {
  const w = window as any;
  if (!w.require) return null;
  try { return w.require('fs'); } catch { return null; }
}

/** 解析 spawn 目标（P2-2）：纯走全局 bili-dl --batch，.cmd shim 需 shell:true（不再探测本机 CLI 绝对路径） */
function resolveBatchSpawn(taskJson: string): { cmd: string; args: string[]; shell: boolean } {
  return { cmd: 'bili-dl', args: ['--batch', taskJson], shell: true };
}

/** 转录临时文件删除（尽力而为：已删/读失败等一律静默，不阻塞主流程） */
function tryUnlink(path: string | null | undefined): void {
  if (!path) return;
  try {
    const fsMod = getFs();
    if (fsMod && typeof fsMod.unlinkSync === 'function') fsMod.unlinkSync(path);
  } catch { /* 临时文件可能已被清走 */ }
}

/** vault 绝对路径（ADR-0071：随 taskJson 下发，供 CLI 计算视频相对路径）；不可得 → 空串 */
function getVaultBasePath(): string {
  try {
    const bp = (getApp().vault as any)?.adapter?.getBasePath?.();
    return typeof bp === 'string' ? bp : '';
  } catch { return ''; }
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

/** 单部终态回调（内部：ok + reason + 笔记/视频路径；resolve 于落库完成后） */
type FinishOne = (ok: boolean, reason: string | null, notePath: string | null, videoPath: string | null) => void;

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

  /** 单部执行：spawn → 解析步骤/进度/信息/结果行 → CLI 终态 → 插件侧 AI 阶段 → 落库；Promise 在终态落库后 resolve */
  _runOne(cp: any, task: LiteratureTask, events: BatchEvents, onEnd: (ok: boolean) => void): Promise<void> {
    return new Promise((resolve) => {
      // 文献盒设置项全量下发（ADR-0071）：CLI 不再读插件配置，taskJson 一次性带全；
      // 分P 序号（task.page，1 起）随任务 JSON 下发；vaultPath 供 CLI 计算视频相对路径
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
          compress: !s || s.literatureCompress !== false,
          crf: (s && s.literatureCrf) || 23,
          vaultPath: getVaultBasePath(),
          ffmpegPath: (s && s.literatureFfmpegPath ? String(s.literatureFfmpegPath) : ''),
          ffprobePath: (s && s.literatureFfprobePath ? String(s.literatureFfprobePath) : ''),
          pythonPath: (s && s.literaturePythonPath ? String(s.literaturePythonPath) : ''),
          whisperModel: (s && s.literatureWhisperModel ? String(s.literatureWhisperModel) : ''),
          cacheDir: (s && s.literatureCacheDir ? String(s.literatureCacheDir) : ''),
          cacheRetentionDays: (s && s.literatureCacheRetentionDays) || 7,
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
      // CLI 交付内容（[bz-result] 行）：转录临时文件绝对路径 + 视频落地路径（vault 相对|绝对|null）
      let transcriptPath: string | null = null;
      let videoPath: string | null = null;
      const finish: FinishOne = (ok, reason, notePath, video) => {
        if (settled) return;
        settled = true;
        // P2-1：reject 兜底——_finish 意外抛错（任务处理中被删致 updateTask 抛错、或回调异常）时
        // 也必须 resolve，否则本 Promise 永不 settle → runAll 卡死、BatchRunner.running 恒 true
        void this._finish(task, events, onEnd, ok, reason, notePath, video).then(resolve, () => { onEnd(false); resolve(); });
      };
      try {
        child = cp.spawn(cmd, args, { shell, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e: any) {
        const reason = /ENOENT/.test(e.message) ? `未找到 bili-dl。${INSTALL_HINT}` : `启动失败：${e.message}。${INSTALL_HINT}`;
        finish(false, reason, null, null);
        return;
      }
      this._child = child;
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
          // 先落库再回调：UI onTaskInfo 整表刷新时能确定性读到新字段（避免读旧快照的竞态）。
          // P3-2：不发射 literature:tasks 域事件——契约 §10 观察收敛为 converted/failed 两类，parsed 无订阅者
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
                  events.onTaskInfo({ ...task });
                });
              }
            } catch { /* 忽略坏信息行 */ }
            continue;
          }
          // 交付结果行（ADR-0071）：CLI 不再写笔记，只交付转录临时文件路径 + 视频路径
          m = line.match(RESULT_RE);
          if (m) {
            try {
              const r = JSON.parse(m[1]);
              transcriptPath = r && typeof r.transcript === 'string' && r.transcript ? r.transcript : null;
              videoPath = r && typeof r.video === 'string' && r.video ? r.video : null;
            } catch { /* 忽略坏结果行 */ }
          }
        }
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', (d: Buffer) => { errChunks.push(d); });
      child.on('error', (e: Error) => {
        // 已终态（如 spawn 抛错路径）或 error 后再补发 close：一律忽略
        if (settled) return;
        const reason = /ENOENT/.test(e.message) ? `未找到 bili-dl。${INSTALL_HINT}` : `启动失败：${e.message}`;
        finish(false, reason, null, null);
      });
      child.on('close', (code: number) => {
        // 幂等护栏：finish 已落终态（error/中止/重复 close）后不再触发 AI 阶段
        if (settled) return;
        if (this.aborted) {
          finish(false, '已中止', null, null);
          return;
        }
        if (code === 0) {
          // CLI 成功 → 插件侧 AI 阶段（ADR-0071：读转录 → 生成笔记 → 删临时文件）
          void this._aiStep(task, events, transcriptPath, videoPath, finish);
        } else {
          // P2-4：CLI 非 0 退出时转录文件可能已写出（失败瞬间产物残留系统临时目录），尽力清理一次
          tryUnlink(transcriptPath);
          const errTail = tailStderr(errChunks);
          const reason = errTail || `处理失败（退出码 ${code}）。${INSTALL_HINT}`;
          finish(false, reason, null, null);
        }
      });
    });
  },

  /**
   * 插件侧 AI 阶段（ADR-0071）：CLI close(0) 后由插件接管——
   * 「AI 生成文献笔记中」→ 读转录临时文件 → generateVideoNote（元数据 + 分块润色 + 落盘）→
   * 读毕删临时文件 → 「笔记落盘中」→ 成功终态。
   * 转录读取失败 / AI 失败（含 AI 未配置）→ 该任务 failed（reason 中文、不落半成品笔记），
   * 转录临时文件尽力清理；单部失败即整批语义与 CLI 失败一致（继续剩余 / 遇错即停）。
   */
  async _aiStep(task: LiteratureTask, events: BatchEvents, transcriptPath: string | null, videoPath: string | null, finish: FinishOne): Promise<void> {
    task.reason = AI_STEP_TEXT;
    void LiteratureData.updateTask(task.id, { reason: AI_STEP_TEXT });
    events.onTaskProgress({ ...task }, AI_STEP_TEXT);
    // 读转录临时文件（缺失/读取失败 → 该任务 failed）
    let transcript: string;
    try {
      const fsMod = getFs();
      if (!fsMod || typeof fsMod.readFileSync !== 'function' || !transcriptPath) {
        throw new Error('无转录文件');
      }
      transcript = fsMod.readFileSync(transcriptPath, 'utf8');
    } catch {
      tryUnlink(transcriptPath);
      finish(false, '转录文件读取失败', null, null);
      return;
    }
    // 插件侧 AI 生成文献笔记（失败 → 该任务 failed，不落半成品笔记）
    let notePath: string;
    try {
      notePath = await generateVideoNote({
        transcript,
        videoTitle: task.title || '',
        url: task.url,
        uploader: task.uploader || '',
      });
    } catch (e: any) {
      tryUnlink(transcriptPath);
      finish(false, `AI 生成文献笔记失败：${e?.message || String(e)}`, null, null);
      return;
    }
    // 读毕删除转录临时文件（尽力而为）
    tryUnlink(transcriptPath);
    task.reason = NOTE_STEP_TEXT;
    void LiteratureData.updateTask(task.id, { reason: NOTE_STEP_TEXT });
    events.onTaskProgress({ ...task }, NOTE_STEP_TEXT);
    finish(true, null, notePath, videoPath);
  },

  /** 终态落库 + 事件（resolve 于落库完成后）；成功 → 自动归档历史（archived+归档时间，ADR-0067） */
  async _finish(task: LiteratureTask, events: BatchEvents, onEnd: (ok: boolean) => void, ok: boolean, reason: string | null, notePath: string | null, videoPath: string | null): Promise<void> {
    task.status = ok ? 'success' : 'failed';
    task.reason = reason;
    // 失败不清 notePath/videoPath：保留既有值（断点续跑时旧成果不丢）
    task.notePath = ok ? notePath : task.notePath;
    task.videoPath = ok ? videoPath : task.videoPath;
    task.processedAt = nowTs();
    if (ok) { task.archived = true; task.archivedAt = task.processedAt; }
    // P2-1：任务处理中可能已被删除（抽屉「删除」对任意状态可用 / cleanupTaskRecordsForNote 连带删除），
    // 终态落库视为尽力而为：updateTask 抛「任务不存在」不中断批处理，事件与回调照常（计数沿用原 ok）
    try {
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
    } catch { /* 任务已不存在：尽力落库失败，照常走事件/回调 */ }
    events.onTaskDone({ ...task });
    // 域事件（ADR-0071）：任务终态统一由处理器发射（smartcat 观察 converted；
    // failed 为占位语义——ticket 136 起 smartcat 不再订阅失败）
    if (ok) {
      emitDomainEvent('literature:tasks', { kind: 'converted', id: task.id, url: task.url, notePath: task.notePath });
    } else {
      emitDomainEvent('literature:tasks', { kind: 'failed', id: task.id, url: task.url, notePath: task.notePath ?? null });
    }
    onEnd(ok);
  },
};